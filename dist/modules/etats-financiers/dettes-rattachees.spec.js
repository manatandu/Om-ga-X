"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dettes_rattachees_1 = require("./dettes-rattachees");
const engagements_anterieurs_1 = require("./engagements-anterieurs");
const EX26 = { id: 'e26', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const EX27 = { id: 'e27', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
function grandLivre(ecritures, lignes) {
    const ecr = new Map(ecritures.map((e) => [e.id, e]));
    const sansGroupe = (l) => ({
        ...l,
        compteId: `c-${l.numero}`,
        deviseId: null,
        montantDevise: null,
        compte: { numero: l.numero, intitule: `Compte ${l.numero}`, modeReportANouveau: 'DETAIL' },
        ecriture: ecr.get(l.ecritureId),
    });
    const vue = (l) => ({
        ...sansGroupe(l),
        lettrage: l.lettrageId ? { code: l.lettrageId, lignes: lignes.filter((x) => x.lettrageId === l.lettrageId).map(sansGroupe) } : null,
    });
    const valeur = (v, cond) => {
        if (cond === null)
            return v === null || v === undefined;
        if (cond instanceof Date)
            return v instanceof Date && v.getTime() === cond.getTime();
        if (typeof cond !== 'object')
            return v === cond;
        const c = cond;
        if ('in' in c)
            return c.in.includes(v);
        if ('not' in c) {
            if (c.not !== null)
                return v !== c.not;
            return v !== null && v !== undefined;
        }
        if ('startsWith' in c)
            return typeof v === 'string' && v.startsWith(c.startsWith);
        if ('lt' in c || 'gt' in c) {
            const t = v.getTime();
            return (!('lt' in c) || t < c.lt.getTime()) && (!('gt' in c) || t > c.gt.getTime());
        }
        if ('some' in c)
            return v.some((x) => satisfait(x, c.some));
        return v !== null && v !== undefined && satisfait(v, c);
    };
    const CLES = new Set([
        'id',
        'compteId',
        'ecritureId',
        'lettrageId',
        'lettre',
        'debit',
        'credit',
        'dateEcheance',
        'compte',
        'ecriture',
        'lettrage',
        'lignes',
        'numero',
        'tenantId',
        'exerciceId',
        'statut',
        'estGenereeParCloture',
        'estSoldeDesComptesDeGestion',
        'estANouveauProvisoire',
        'date',
    ]);
    function satisfait(objet, where) {
        return Object.entries(where).every(([cle, cond]) => {
            if (cle === 'OR')
                return cond.some((w) => satisfait(objet, w));
            if (cle === 'AND')
                return cond.every((w) => satisfait(objet, w));
            if (cle === 'NOT')
                return (Array.isArray(cond) ? cond : [cond]).every((w) => !satisfait(objet, w));
            if (!CLES.has(cle))
                throw new Error(`doublure : filtre non honoré (${cle})`);
            return valeur(objet[cle], cond);
        });
    }
    function projeter(objet, select) {
        const r = {};
        for (const [cle, spec] of Object.entries(select)) {
            if (spec === true)
                r[cle] = objet[cle];
            else
                r[cle] = projeter(objet[cle], spec.select);
        }
        return r;
    }
    const findMany = jest.fn(async (args) => {
        let rendu = lignes.map(vue).filter((l) => satisfait(l, args.where));
        rendu.sort((a, b) => (a.id < b.id ? -1 : 1));
        if (args.cursor)
            rendu = rendu.slice(rendu.findIndex((l) => l.id === args.cursor.id));
        if (args.skip)
            rendu = rendu.slice(args.skip);
        if (args.take !== undefined)
            rendu = rendu.slice(0, args.take);
        return rendu.map((l) => projeter(l, args.select));
    });
    return { ligneEcriture: { findMany } };
}
const ecriture = (id, exerciceId, date, libelle, x = {}) => ({
    id,
    tenantId: 't',
    exerciceId,
    date: new Date(date),
    libelle,
    statut: client_1.StatutEcriture.VALIDEE,
    estGenereeParCloture: false,
    estSoldeDesComptesDeGestion: false,
    estANouveauProvisoire: false,
    ...x,
});
const ligne = (id, ecritureId, numero, debit, credit, x = {}) => ({
    id,
    ecritureId,
    numero,
    debit,
    credit,
    libelle: null,
    dateEcheance: null,
    lettrageId: null,
    lettre: null,
    ...x,
});
const DETTES = { comptes: ['401'] };
const POSTES = [
    { ref: 'FM', comptes: ['60'], exclusions: ['603'] },
    { ref: 'FN', comptes: ['61'] },
    { ref: 'FO', comptes: ['62', '63'] },
];
describe('La dette « concernée » se lit sur ses pièces (B4)', () => {
    it('partage la dette d’une facture selon SES lignes de poste, la taxe suivant la facture', async () => {
        const db = grandLivre([
            ecriture('f', 'e26', '2026-03-01', 'Fournitures et transport'),
            ecriture('v', 'e26', '2026-03-05', 'Avoir sur fournitures'),
        ], [
            ligne('f1', 'f', '60110000', 600, 0),
            ligne('f2', 'f', '61810000', 400, 0),
            ligne('f3', 'f', '44520000', 160, 0),
            ligne('f9', 'f', '40110000', 0, 1160),
            ligne('v1', 'v', '60110000', 0, 100),
            ligne('v9', 'v', '40110000', 100, 0),
        ]);
        const cloture = await (0, dettes_rattachees_1.dettesALaCloture)(db, 't', EX26, DETTES);
        const parPoste = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', cloture, POSTES);
        expect(Object.fromEntries(parPoste.parRef)).toEqual({ FM: 596, FN: 464 });
        expect(parPoste.nonRattache).toBe(0);
    });
    it('un compte qui porte un règlement non lettré ne se rattache pas du tout · C10, le véhicule au 4812', async () => {
        const db = grandLivre([
            ecriture('f', 'e26', '2026-02-01', 'Véhicule du projet'),
            ecriture('r', 'e26', '2026-02-10', 'Règlement du véhicule'),
            ecriture('g', 'e26', '2026-03-01', 'Ordinateur'),
        ], [
            ligne('f1', 'f', '24510000', 3_000_000, 0),
            ligne('f9', 'f', '48120000', 0, 3_000_000),
            ligne('r1', 'r', '48120000', 3_000_000, 0),
            ligne('r2', 'r', '52110000', 0, 3_000_000),
            ligne('g1', 'g', '24410000', 800_000, 0),
            ligne('g9', 'g', '48121000', 0, 800_000),
        ]);
        const postes = [
            { ref: 'FI', comptes: ['24'], exclusions: ['245'] },
            { ref: 'FJ', comptes: ['245'] },
        ];
        const parPoste = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', await (0, dettes_rattachees_1.dettesALaCloture)(db, 't', EX26, { comptes: ['481'] }), postes);
        expect(Object.fromEntries(parPoste.parRef)).toEqual({ FI: 800_000 });
        expect(parPoste.nonRattache).toBe(0);
    });
    it('la dette du 40 née d’une immobilisation se lit par la composition de sa pièce (majeur 3 et sa suite)', async () => {
        const db = grandLivre([ecriture('m', 'e26', '2026-12-01', 'Mobilier'), ecriture('f', 'e26', '2026-12-02', 'Fournitures')], [
            ligne('m1', 'm', '24410000', 600, 0),
            ligne('m9', 'm', '40110000', 0, 600),
            ligne('f1', 'f', '60110000', 400, 0),
            ligne('f9', 'f', '40110000', 0, 400),
        ]);
        expect(await (0, dettes_rattachees_1.dettesFournisseursNeesDImmobilisations)(db, 't', EX26, DETTES)).toEqual({ ouverture: 0, cloture: 600 });
    });
    it('un acompte lettré en partiel avec sa facture se rattache à elle, jamais au prorata (mineur 4)', async () => {
        const db = grandLivre([
            ecriture('a', 'e26', '2026-03-01', 'Fournitures'),
            ecriture('r', 'e26', '2026-03-10', 'Acompte sur fournitures'),
            ecriture('b', 'e26', '2026-04-01', 'Transport'),
        ], [
            ligne('a1', 'a', '60110000', 1000, 0),
            ligne('a9', 'a', '40110000', 0, 1000, { lettrageId: 'p' }),
            ligne('r1', 'r', '40110000', 400, 0, { lettrageId: 'p' }),
            ligne('r2', 'r', '52110000', 0, 400),
            ligne('b1', 'b', '61810000', 600, 0),
            ligne('b9', 'b', '40110000', 0, 600),
        ]);
        const parPoste = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', await (0, dettes_rattachees_1.dettesALaCloture)(db, 't', EX26, DETTES), POSTES);
        expect(Object.fromEntries(parPoste.parRef)).toEqual({ FM: 600, FN: 600 });
        expect(parPoste.nonRattache).toBe(0);
    });
    it('la ligne d’à-nouveau se rattache à la facture qu’elle reporte · C10, facture B de 500 000', async () => {
        const db = grandLivre([
            ecriture('b', 'e26', '2026-11-15', 'Facture B fournitures'),
            ecriture('an', 'e27', '2027-01-01', 'Report à-nouveau', { estGenereeParCloture: true }),
            ecriture('r', 'e27', '2027-01-20', 'Règlement facture B'),
        ], [
            ligne('b1', 'b', '60110000', 500_000, 0),
            ligne('b9', 'b', '40110000', 0, 500_000),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures', lettrageId: 'g', lettre: 'A' }),
            ligne('r1', 'r', '40110000', 500_000, 0, { lettrageId: 'g', lettre: 'A' }),
            ligne('r2', 'r', '52110000', 0, 500_000),
        ]);
        const fin26 = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', await (0, dettes_rattachees_1.dettesALaCloture)(db, 't', EX26, DETTES), POSTES);
        expect(Object.fromEntries(fin26.parRef)).toEqual({ FM: 500_000 });
        const debut27 = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', await (0, dettes_rattachees_1.dettesALOuverture)(db, 't', 'e27', DETTES), POSTES);
        expect(Object.fromEntries(debut27.parRef)).toEqual({ FM: 500_000 });
        expect(debut27.nonRattache).toBe(0);
        const fin27 = await (0, dettes_rattachees_1.dettesALaCloture)(db, 't', EX27, DETTES);
        expect(fin27).toEqual([]);
    });
    it('une SIMULATION jumelle de la facture ne rend pas l’origine ambiguë (ligne sage-l1, relecture m6)', async () => {
        const db = grandLivre([
            ecriture('b', 'e26', '2026-11-15', 'Facture B fournitures'),
            ecriture('s', 'e26', '2026-11-20', 'Facture B fournitures', { statut: client_1.StatutEcriture.SITUATION }),
            ecriture('an', 'e27', '2027-01-01', 'Report à-nouveau', { estGenereeParCloture: true }),
        ], [
            ligne('b1', 'b', '60110000', 500_000, 0),
            ligne('b9', 'b', '40110000', 0, 500_000),
            ligne('s1', 's', '61810000', 500_000, 0),
            ligne('s9', 's', '40110000', 0, 500_000),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures' }),
        ]);
        const debut27 = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', await (0, dettes_rattachees_1.dettesALOuverture)(db, 't', 'e27', DETTES), POSTES);
        expect(Object.fromEntries(debut27.parRef)).toEqual({ FM: 500_000 });
        expect(debut27.nonRattache).toBe(0);
    });
    it('une paire à cheval éteint l’à-nouveau · la facture de N réglée en N+1 et lettrée avec elle', async () => {
        const db = grandLivre([
            ecriture('b', 'e26', '2026-11-15', 'Facture transport'),
            ecriture('an', 'e27', '2027-01-01', 'Report à-nouveau', { estGenereeParCloture: true }),
            ecriture('r', 'e27', '2027-01-20', 'Règlement'),
        ], [
            ligne('b1', 'b', '61810000', 300, 0),
            ligne('b9', 'b', '40110000', 0, 300, { lettrageId: 'g', lettre: 'A' }),
            ligne('an1', 'an', '40110000', 0, 300, { libelle: 'RAN détail 40110000 · Facture transport' }),
            ligne('r1', 'r', '40110000', 300, 0, { lettrageId: 'g', lettre: 'A' }),
            ligne('r2', 'r', '52110000', 0, 300),
        ]);
        const fin26 = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', await (0, dettes_rattachees_1.dettesALaCloture)(db, 't', EX26, DETTES), POSTES);
        expect(Object.fromEntries(fin26.parRef)).toEqual({ FN: 300 });
        expect(await (0, dettes_rattachees_1.dettesALaCloture)(db, 't', EX27, DETTES)).toEqual([]);
    });
    it('nomme sans deviner · un report sans facture unique ne se rattache à aucun poste', async () => {
        const db = grandLivre([
            ecriture('x', 'e26', '2026-06-01', 'Achat'),
            ecriture('y', 'e26', '2026-06-01', 'Achat'),
            ecriture('an', 'e27', '2027-01-01', 'Report', { estGenereeParCloture: true }),
        ], [
            ligne('x1', 'x', '60110000', 100, 0),
            ligne('x9', 'x', '40110000', 0, 100),
            ligne('y1', 'y', '62210000', 100, 0),
            ligne('y9', 'y', '40110000', 0, 100),
            ligne('an1', 'an', '40110000', 0, 100, { libelle: 'RAN détail 40110000 · Achat' }),
            ligne('an2', 'an', '40110000', 0, 100, { libelle: 'RAN détail 40110000 · Achat' }),
        ]);
        const debut = await (0, dettes_rattachees_1.dettesParPoste)(db, 't', await (0, dettes_rattachees_1.dettesALOuverture)(db, 't', 'e27', DETTES), POSTES);
        expect(debut.parRef.size).toBe(0);
        expect(debut.nonRattache).toBe(200);
    });
});
describe('La dépense engagée en N-1 se suit en N (B3)', () => {
    const dette = (id, lettrageId = null, libelle = 'Facture B fournitures') => ({
        id,
        compteId: 'c-40110000',
        numero: '40110000',
        debit: 0,
        credit: 500_000,
        dateEcheance: null,
        lettrageId,
        libelle,
    });
    const DECAISSEE = { decaisseEnN: 500_000, engageEnN: 0 };
    const ENGAGEE = { decaisseEnN: 0, engageEnN: 500_000 };
    const base = (lignesN, ecrituresN = []) => grandLivre([
        ecriture('b', 'e26', '2026-11-15', 'Facture B fournitures'),
        ecriture('an', 'e27', '2027-01-01', 'Report à-nouveau', { estGenereeParCloture: true }),
        ecriture('r', 'e27', '2027-01-20', 'Règlement facture B'),
        ...ecrituresN,
    ], [ligne('b1', 'b', '60110000', 500_000, 0), ...lignesN]);
    it('C10 · réglée le 20 janvier et lettrée avec sa ligne d’à-nouveau · décaissement de N', async () => {
        const db = base([
            ligne('b9', 'b', '40110000', 0, 500_000),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures', lettrageId: 'g', lettre: 'A' }),
            ligne('r1', 'r', '40110000', 500_000, 0, { lettrageId: 'g', lettre: 'A' }),
        ]);
        const suite = await (0, engagements_anterieurs_1.suiteEnNDesDettes)(db, 't', EX26, EX27, [{ ...dette('b9') }]);
        expect(suite.get('b9')).toEqual(DECAISSEE);
    });
    it('lettrée directement avec un règlement de N · décaissement de N', async () => {
        const db = base([
            ligne('b9', 'b', '40110000', 0, 500_000, { lettrageId: 'g', lettre: 'A' }),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures' }),
            ligne('r1', 'r', '40110000', 500_000, 0, { lettrageId: 'g', lettre: 'A' }),
        ]);
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(db, 't', EX26, EX27, [dette('b9', 'g')])).get('b9')).toEqual(DECAISSEE);
    });
    it('encore due à la clôture de N, ou réglée après · engagement de N', async () => {
        const due = base([
            ligne('b9', 'b', '40110000', 0, 500_000),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures' }),
        ]);
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(due, 't', EX26, EX27, [dette('b9')])).get('b9')).toEqual(ENGAGEE);
        const regleeEn2028 = base([
            ligne('b9', 'b', '40110000', 0, 500_000),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures', lettrageId: 'g', lettre: 'A' }),
            ligne('r8', 'r28', '40110000', 500_000, 0, { lettrageId: 'g', lettre: 'A' }),
        ], [ecriture('r28', 'e28', '2028-01-15', 'Règlement')]);
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(regleeEn2028, 't', EX26, EX27, [dette('b9')])).get('b9')).toEqual(ENGAGEE);
    });
    it('nomme sans deviner · report au solde, ou deux lignes d’à-nouveau identiques', async () => {
        const auSolde = base([
            ligne('b9', 'b', '40110000', 0, 500_000),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'Report à-nouveau 40110000 · Fournisseurs' }),
        ]);
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(auSolde, 't', EX26, EX27, [dette('b9')])).get('b9')).toBe('INCONNUE');
        const doubles = base([
            ligne('b9', 'b', '40110000', 0, 500_000),
            ligne('an1', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures' }),
            ligne('an2', 'an', '40110000', 0, 500_000, { libelle: 'RAN détail 40110000 · Facture B fournitures' }),
        ]);
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(doubles, 't', EX26, EX27, [dette('b9')])).get('b9')).toBe('INCONNUE');
    });
    it('réglée en partie en N-1 (lettrage partiel, les deux lignes reportées) · seul le reste dû se décaisse en N', async () => {
        const facture = { ...dette('f9', 'p'), credit: 1_000_000, libelle: 'Facture F' };
        const lignes = (fin) => [
            ligne('f9', 'f', '40110000', 0, 1_000_000, { lettrageId: 'p' }),
            ligne('a9', 'a', '40110000', 400_000, 0, { lettrageId: 'p' }),
            ligne('anf', 'an', '40110000', 0, 1_000_000, { libelle: 'RAN détail 40110000 · Facture F', lettrageId: 'q' }),
            ligne('ana', 'an', '40110000', 400_000, 0, { libelle: 'RAN détail 40110000 · Acompte F', lettrageId: 'q' }),
            ...fin,
        ];
        const ecr = [
            ecriture('f', 'e26', '2026-06-01', 'Facture F'),
            ecriture('a', 'e26', '2026-07-01', 'Acompte F'),
            ecriture('an', 'e27', '2027-01-01', 'Report à-nouveau', { estGenereeParCloture: true }),
            ecriture('r', 'e27', '2027-02-01', 'Solde F'),
        ];
        const soldee = grandLivre(ecr, lignes([ligne('r1', 'r', '40110000', 600_000, 0, { lettrageId: 'q', lettre: 'A' })]));
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(soldee, 't', EX26, EX27, [facture])).get('f9')).toEqual({ decaisseEnN: 600_000, engageEnN: 0 });
        const partielle = grandLivre(ecr, lignes([ligne('r1', 'r', '40110000', 250_000, 0, { lettrageId: 'q' })]));
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(partielle, 't', EX26, EX27, [facture])).get('f9')).toEqual({ decaisseEnN: 250_000, engageEnN: 350_000 });
    });
    it('un groupe qui réunit deux factures ne dit pas laquelle a été payée · nommée', async () => {
        const db = grandLivre([ecriture('f', 'e26', '2026-06-01', 'Facture F'), ecriture('g', 'e26', '2026-06-02', 'Facture G'), ecriture('a', 'e26', '2026-07-01', 'Acompte')], [
            ligne('f9', 'f', '40110000', 0, 500_000, { lettrageId: 'p' }),
            ligne('g9', 'g', '40110000', 0, 500_000, { lettrageId: 'p' }),
            ligne('a9', 'a', '40110000', 400_000, 0, { lettrageId: 'p' }),
        ]);
        expect((await (0, engagements_anterieurs_1.suiteEnNDesDettes)(db, 't', EX26, EX27, [dette('f9', 'p')])).get('f9')).toBe('INCONNUE');
    });
});
//# sourceMappingURL=dettes-rattachees.spec.js.map