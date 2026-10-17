"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const ouverture_passee_1 = require("./ouverture-passee");
function champ(v, f) {
    if (f === null || typeof f !== 'object' || f instanceof Date) {
        return f instanceof Date ? v instanceof Date && v.getTime() === f.getTime() : (v ?? null) === f;
    }
    return Object.entries(f).every(([op, x]) => {
        if (op === 'in')
            return x.includes(v);
        if (op === 'not' && (x === null || typeof x !== 'object'))
            return (v ?? null) !== x;
        throw new Error(`évaluateur : opérateur « ${op} » non honoré`);
    });
}
function relation(x, f) {
    if ('is' in f)
        return f.is === null ? !x : !!x && evaluer(x, f.is);
    if ('isNot' in f)
        return f.isNot === null ? !!x : !x || !evaluer(x, f.isNot);
    return !!x && evaluer(x, f);
}
function evaluer(r, where) {
    return Object.entries((where ?? {})).every(([cle, f]) => {
        if (cle === 'AND')
            return f.every((w) => evaluer(r, w));
        if (cle === 'OR')
            return f.some((w) => evaluer(r, w));
        if (cle === 'journal' || cle === 'corrigeEcriture' || cle === 'reevaluationExtourne' || cle === 'compte') {
            return relation(r[cle], f);
        }
        if (cle === 'lignes') {
            const { none, ...reste } = f;
            if (Object.keys(reste).length > 0 || none === undefined)
                throw new Error('évaluateur : filtre de lignes non honoré');
            return !(r.lignes ?? []).some((l) => evaluer(l, none));
        }
        if (cle === 'classe')
            return champ(r.classe, f);
        return champ(r[cle], f);
    });
}
const N1 = { id: 'n1', dateDebut: new Date('2027-01-01') };
const filtre = (0, ouverture_passee_1.filtreOuverturePasseeAuPremierJour)('t', N1);
const OD = { type: client_1.TypeJournal.GENERAL };
const BQ = { type: client_1.TypeJournal.TRESORERIE };
const bilan = (numero) => ({ compte: { classe: client_1.ClasseCompte.CLASSE_4, numero } });
const ecriture = (x) => ({
    tenantId: 't',
    exerciceId: 'n1',
    statut: 'VALIDEE',
    date: N1.dateDebut,
    dateValeur: null,
    estANouveauProvisoire: false,
    estSoldeDesComptesDeGestion: false,
    estGenereeParCloture: false,
    journal: OD,
    corrigeEcriture: null,
    corrigeEcritureId: null,
    reevaluationExtourne: null,
    lignes: [bilan('41110001'), bilan('47910000')],
    ...x,
});
describe('A8 · la contre-passation d’une réévaluation n’est pas une ouverture', () => {
    it('une ouverture saisie en OD au premier jour reste dans le périmètre (AU2 inchangé)', () => {
        expect(evaluer(ecriture({}), filtre)).toBe(true);
    });
    it('une écriture de situation n’est jamais une ouverture, le filtre le dit de lui-même (ligne sage-l1)', () => {
        expect(evaluer(ecriture({ statut: 'SITUATION' }), filtre)).toBe(false);
        expect(evaluer(ecriture({ statut: 'BROUILLARD' }), filtre)).toBe(true);
    });
    it('la contre-passation du MODULE, reconnue par sa liaison, en sort', () => {
        expect(evaluer(ecriture({ reevaluationExtourne: { id: 'r26' } }), filtre)).toBe(false);
    });
    it('le négatif de cette contre-passation (annulation de la réévaluation, D6, liaison gardée) en sort avec elle', () => {
        const extourne = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: { id: 'r26' } };
        expect(evaluer(ecriture({ corrigeEcritureId: 'x', corrigeEcriture: extourne }), filtre)).toBe(false);
    });
    it('une contre-passation ANNULÉE seule (déliée) et son négatif restent, et se soldent', () => {
        const extourneDeliee = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: null };
        expect(evaluer(ecriture({}), filtre)).toBe(true);
        expect(evaluer(ecriture({ corrigeEcritureId: 'x', corrigeEcriture: extourneDeliee }), filtre)).toBe(true);
    });
    it('les autres bornes tiennent · journal de trésorerie, compte de gestion, provisoire, lendemain', () => {
        expect(evaluer(ecriture({ journal: BQ }), filtre)).toBe(false);
        expect(evaluer(ecriture({ lignes: [bilan('41110001'), { compte: { classe: client_1.ClasseCompte.CLASSE_7, numero: '77610000' } }] }), filtre)).toBe(false);
        expect(evaluer(ecriture({ estANouveauProvisoire: true }), filtre)).toBe(false);
        expect(evaluer(ecriture({ date: new Date('2027-01-02') }), filtre)).toBe(false);
        expect(evaluer(ecriture({ date: new Date('2027-01-02'), dateValeur: N1.dateDebut }), filtre)).toBe(true);
    });
    it('l’exclusion est DANS le AND · le lecteur qui ne reprend que `AND` et `lignes` (reconduction du lettrage) l’a aussi', () => {
        const { AND, lignes } = filtre;
        expect(evaluer(ecriture({ reevaluationExtourne: { id: 'r26' } }), { AND, lignes })).toBe(false);
        expect(evaluer(ecriture({}), { AND, lignes })).toBe(true);
    });
});
describe('A8 · la contre-passation faite à la main et DÉCLARÉE · ses seules lignes de l’écart', () => {
    const ecarts = {
        lignes: [
            { compteId: 'c411', debit: 100_000, credit: 0, compte: { numero: '41110001' } },
            { compteId: 'c4791', debit: 0, credit: 100_000, compte: { numero: '47910000' } },
            { compteId: 'c4783', debit: 50_000, credit: 0, compte: { numero: '47830000' } },
            { compteId: 'c401', debit: 0, credit: 50_000, compte: { numero: '40110001' } },
            { compteId: 'c521', debit: 30_000, credit: 0, compte: { numero: '52110000' } },
            { compteId: 'c776', debit: 0, credit: 30_000, compte: { numero: '77610000' } },
        ],
    };
    it('écarte, par écriture, les comptes de l’écart de conversion (tiers, 478, 479), jamais la banque', () => {
        const r = (0, ouverture_passee_1.lignesDeContrePassationDeclaree)([{ id: 'od', reevaluationContrePassationDeclaree: { annuleeLe: null, ecritureEcarts: ecarts } }]);
        expect([...(r.get('od') ?? [])].sort()).toEqual(['c401', 'c411', 'c4783', 'c4791']);
    });
    it('une écriture sans déclaration, ou déclarée pour une réévaluation ANNULÉE, n’écarte rien', () => {
        expect((0, ouverture_passee_1.lignesDeContrePassationDeclaree)([{ id: 'od' }, { id: 'od2', reevaluationContrePassationDeclaree: null }]).size).toBe(0);
        expect((0, ouverture_passee_1.lignesDeContrePassationDeclaree)([{ id: 'od', reevaluationContrePassationDeclaree: { annuleeLe: new Date('2027-02-01'), ecritureEcarts: ecarts } }]).size).toBe(0);
    });
});
describe('B2 · le négatif d’une écriture du premier jour en fait partie, quelle que soit sa date (AUDCIF art. 20, al. 2)', () => {
    const od = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: null, date: N1.dateDebut, dateValeur: null };
    const plusTard = new Date('2027-02-15');
    it('le négatif daté du 15/02 d’une OD du 01/01 entre dans le périmètre', () => {
        expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'od', corrigeEcriture: od }), filtre)).toBe(true);
    });
    it('le négatif d’une écriture qui n’est PAS du premier jour n’y entre pas', () => {
        const odDuLendemain = { ...od, date: new Date('2027-01-02') };
        expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'od', corrigeEcriture: odDuLendemain }), filtre)).toBe(false);
    });
    it('le négatif d’une écriture de trésorerie du premier jour n’y entre pas (même journal, opération de l’exercice)', () => {
        const banque = { ...od, journal: BQ };
        expect(evaluer(ecriture({ journal: BQ, date: plusTard, corrigeEcritureId: 'bq', corrigeEcriture: banque }), filtre)).toBe(false);
    });
    it('le négatif d’une contre-passation du MODULE, daté plus tard, reste dehors', () => {
        const extourne = { ...od, reevaluationExtourne: { id: 'r26' } };
        expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'x', corrigeEcriture: extourne }), filtre)).toBe(false);
    });
    it('dans le AND aussi · la reconduction du lettrage le lit', () => {
        const { AND, lignes } = filtre;
        expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'od', corrigeEcriture: od }), { AND, lignes })).toBe(true);
    });
});
describe('B2 · une ouverture qui se solde n’est pas une ouverture (`ouverturePasseeNonNulle`)', () => {
    const ligne = (id, ecritureId, compteId, debit, credit) => ({
        id, ecritureId, compteId, debit, credit, deviseId: null, montantDevise: null, compte: { classe: client_1.ClasseCompte.CLASSE_4, numero: compteId },
    });
    const odOuverture = ecriture({
        id: 'od', statut: 'VALIDEE', numeroPiece: 2,
        lignes: [ligne('l1', 'od', 'c521', 10_500_000, 0), ligne('l2', 'od', 'c101', 0, 10_000_000), ligne('l3', 'od', 'c131', 0, 500_000)],
    });
    const negatif = ecriture({
        id: 'neg', statut: 'VALIDEE', numeroPiece: 3, date: new Date('2027-02-15'), corrigeEcritureId: 'od', corrigeEcriture: odOuverture,
        lignes: [ligne('n1', 'neg', 'c521', -10_500_000, 0), ligne('n2', 'neg', 'c101', 0, -10_000_000), ligne('n3', 'neg', 'c131', 0, -500_000)],
    });
    function lecteur(ecritures) {
        const retenues = (w) => ecritures.filter((e) => evaluer(e, w));
        return {
            ligneEcriture: {
                count: jest.fn(({ where }) => Promise.resolve(retenues(where.ecriture).reduce((n, e) => n + e.lignes.length, 0))),
                findMany: jest.fn(({ where, cursor }) => Promise.resolve(cursor ? [] : retenues(where.ecriture).flatMap((e) => e.lignes))),
            },
            ecriture: {
                findMany: jest.fn(({ where }) => Promise.resolve(retenues(where).map((e) => ({ ...e, journal: { code: 'OD' }, reevaluationContrePassationDeclaree: e.reevaluationContrePassationDeclaree ?? null })))),
            },
        };
    }
    it('l’OD seule est une ouverture · ses pièces sont nommées', async () => {
        expect(await (0, ouverture_passee_1.ouverturePasseeNonNulle)(lecteur([odOuverture]), 't', N1, { validees: true })).toEqual({ nombre: 1, pieces: ['OD n° 2'] });
    });
    it('l’OD et son négatif daté plus tard se soldent compte par compte · aucune ouverture', async () => {
        expect(await (0, ouverture_passee_1.ouverturePasseeNonNulle)(lecteur([odOuverture, negatif]), 't', N1, { validees: true })).toBeNull();
    });
    it('au livre-journal seul · un négatif encore au brouillard n’annule rien', async () => {
        const auBrouillard = { ...negatif, statut: 'BROUILLARD' };
        expect(await (0, ouverture_passee_1.ouverturePasseeNonNulle)(lecteur([odOuverture, auBrouillard]), 't', N1, { validees: true })).toEqual({ nombre: 1, pieces: ['OD n° 2'] });
    });
    it('aucune écriture au premier jour · aucune ouverture', async () => {
        expect(await (0, ouverture_passee_1.ouverturePasseeNonNulle)(lecteur([]), 't', N1, { validees: true })).toBeNull();
    });
    it('second tour, B1 · une position nulle dit son négatif inscrit après le premier jour, jamais celui du premier jour', async () => {
        expect(await (0, ouverture_passee_1.positionDOuverturePassee)(lecteur([odOuverture, negatif]), 't', N1, { validees: true })).toEqual({
            etat: 'NULLE',
            negatifsTardifs: [{ piece: 'OD n° 3', date: new Date('2027-02-15') }],
        });
        const duPremierJour = { ...negatif, date: N1.dateDebut };
        expect(await (0, ouverture_passee_1.positionDOuverturePassee)(lecteur([odOuverture, duPremierJour]), 't', N1, { validees: true })).toEqual({ etat: 'NULLE', negatifsTardifs: [] });
        expect(await (0, ouverture_passee_1.positionDOuverturePassee)(lecteur([]), 't', N1, { validees: true })).toEqual({ etat: 'AUCUNE' });
        expect(await (0, ouverture_passee_1.positionDOuverturePassee)(lecteur([odOuverture]), 't', N1, { validees: true })).toEqual({ etat: 'NON_NULLE', nombre: 1, pieces: ['OD n° 2'] });
    });
    it('M4 · les états lisent l’ouverture NETTE · l’OD et son négatif ne vident plus le tableau des flux', async () => {
        const service = (ecritures) => new ecriture_service_1.EcritureService({ ...lecteur(ecritures), exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', dateDebut: N1.dateDebut }) } }, {}, {}, {});
        expect(await service([odOuverture, negatif]).ouverturePasseeAuPremierJour('t', 'n1')).toBeNull();
        expect(await service([odOuverture]).ouverturePasseeAuPremierJour('t', 'n1')).toEqual({ nombre: 1, pieces: ['OD n° 2'] });
    });
    it('second tour, B1 · le câblage des états · `positionDOuvertureAuPremierJour` dit le négatif inscrit après le premier jour', async () => {
        const service = new ecriture_service_1.EcritureService({ ...lecteur([odOuverture, negatif]), exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', dateDebut: N1.dateDebut }) } }, {}, {}, {});
        expect(await service.positionDOuvertureAuPremierJour('t', 'n1')).toEqual({
            etat: 'NULLE',
            negatifsTardifs: [{ piece: 'OD n° 3', date: new Date('2027-02-15') }],
        });
    });
});
describe('second tour, B1 · `negatifsTardifs`', () => {
    const jour1 = new Date('2027-01-01');
    const base = { numeroPiece: 4, journal: { code: 'OD' }, dateValeur: null };
    it('un négatif lié daté du 15/03 est tardif, et se nomme avec sa date', () => {
        const t = (0, ouverture_passee_1.negatifsTardifs)([{ ...base, date: new Date('2027-03-15'), corrigeEcritureId: 'od' }], jour1);
        expect(t).toEqual([{ piece: 'OD n° 4', date: new Date('2027-03-15') }]);
        expect((0, ouverture_passee_1.negatifsTardifsLisibles)(t)).toBe('OD n° 4 du 15/03/2027');
    });
    it('daté ou valorisé au premier jour, ou sans liaison, il ne l’est pas', () => {
        expect((0, ouverture_passee_1.negatifsTardifs)([{ ...base, date: jour1, corrigeEcritureId: 'od' }], jour1)).toEqual([]);
        expect((0, ouverture_passee_1.negatifsTardifs)([{ ...base, date: new Date('2027-03-15'), dateValeur: jour1, corrigeEcritureId: 'od' }], jour1)).toEqual([]);
        expect((0, ouverture_passee_1.negatifsTardifs)([{ ...base, date: new Date('2027-03-15'), corrigeEcritureId: null }], jour1)).toEqual([]);
    });
});
//# sourceMappingURL=ouverture-passee.spec.js.map