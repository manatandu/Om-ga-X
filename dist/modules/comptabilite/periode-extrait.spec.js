"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
const balance_trois_colonnes_1 = require("./balance-trois-colonnes");
const periode_extrait_1 = require("./periode-extrait");
const EXERCICE = { dateDebut: new Date('2026-01-01T00:00:00.000Z'), dateFin: new Date('2026-12-31T00:00:00.000Z') };
describe('la période demandée · bornée à l’exercice, sinon l’exercice entier', () => {
    it('sans date, l’exercice entier · aucun extrait', () => {
        expect((0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, {})).toBeNull();
        expect((0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '', au: '' })).toBeNull();
    });
    it('une période égale à l’exercice n’est pas un extrait', () => {
        expect((0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-01-01', au: '2026-12-31' })).toBeNull();
    });
    it('une borne manquante prend celle de l’exercice, et la fin s’exclut au lendemain', () => {
        const p = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-04-01' });
        expect(p.du.toISOString()).toBe('2026-04-01T00:00:00.000Z');
        expect(p.au.toISOString()).toBe('2026-12-31T00:00:00.000Z');
        expect(p.finExclue.toISOString()).toBe('2027-01-01T00:00:00.000Z');
        expect((0, periode_extrait_1.periodeServie)(p)).toEqual({ du: '2026-04-01', au: '2026-12-31' });
        expect((0, periode_extrait_1.libellePeriode)(p)).toBe('du 01/04/2026 au 31/12/2026');
        expect((0, periode_extrait_1.veilleDe)(p.du).toISOString()).toBe('2026-03-31T00:00:00.000Z');
    });
    it('À CHEVAL SUR DEUX EXERCICES, REFUSÉE ET NOMMÉE (condition 4)', () => {
        expect(() => (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2025-12-01', au: '2026-03-31' })).toThrow(/l'à-nouveau du second/);
        expect(() => (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-11-01', au: '2027-01-31' })).toThrow(common_1.BadRequestException);
    });
    it('une date illisible est refusée, jamais lue comme l’exercice entier', () => {
        expect(() => (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-02-30' })).toThrow(/AAAA-MM-JJ/);
        expect(() => (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-06-30', au: '2026-04-01' })).toThrow(/dépasse sa date de fin/);
    });
    it('une seule borne hors de l’exercice se dit HORS de l’exercice, jamais « à l’envers »', () => {
        expect(() => (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2027-02-01' })).toThrow(/doit tenir dans l'exercice/);
        expect(() => (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { au: '2025-12-31' })).toThrow(/doit tenir dans l'exercice/);
    });
});
function valeurRepond(v, condition) {
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
        return v instanceof Date && condition instanceof Date ? v.getTime() === condition.getTime() : v === condition;
    }
    for (const [op, attendu] of Object.entries(condition)) {
        if (op === 'not') {
            if (valeurRepond(v, attendu))
                return false;
        }
        else if (op === 'in') {
            if (!attendu.includes(v))
                return false;
        }
        else if (op === 'lt' || op === 'lte' || op === 'gte') {
            const a = v.getTime();
            const b = attendu.getTime();
            if (op === 'lt' && !(a < b))
                return false;
            if (op === 'lte' && !(a <= b))
                return false;
            if (op === 'gte' && !(a >= b))
                return false;
        }
        else {
            throw new Error(`Opérateur non lu par la doublure · ${op}`);
        }
    }
    return true;
}
function repond(e, where) {
    if (!where)
        return true;
    for (const [cle, condition] of Object.entries(where)) {
        if (condition === undefined)
            continue;
        if (cle === 'AND') {
            const liste = Array.isArray(condition) ? condition : [condition];
            if (!liste.every((c) => repond(e, c)))
                return false;
        }
        else if (cle === 'OR') {
            if (!condition.some((c) => repond(e, c)))
                return false;
        }
        else if (!valeurRepond(e[cle], condition)) {
            return false;
        }
    }
    return true;
}
const jour = (s) => new Date(`${s}T00:00:00.000Z`);
const ecr = (date, o = {}) => ({
    tenantId: 't1',
    exerciceId: 'ex',
    statut: 'VALIDEE',
    date: jour(date),
    estGenereeParCloture: false,
    estSoldeDesComptesDeGestion: false,
    ...o,
});
const ECRITURES = {
    aNouveau: ecr('2026-01-01', { estGenereeParCloture: true }),
    janvier: ecr('2026-01-15'),
    finMars: ecr('2026-03-31', { statut: 'BROUILLARD' }),
    premierJour: ecr('2026-04-01'),
    dernierJour: ecr('2026-06-30'),
    apres: ecr('2026-07-01'),
    repriseMai: ecr('2026-05-10', { estGenereeParCloture: true }),
    reprisePremierJour: ecr('2026-04-01', { estGenereeParCloture: true }),
    virementResultat: ecr('2026-12-31', { estGenereeParCloture: true }),
    soldeGestion: ecr('2026-12-31', { estGenereeParCloture: true, estSoldeDesComptesDeGestion: true }),
    simulation: ecr('2026-04-15', { statut: 'SITUATION' }),
};
describe('les trois colonnes d’une période · chaque ligne dans une colonne, et une seule', () => {
    const base = { tenantId: 't1', exerciceId: 'ex' };
    const colonnesDe = (f) => (e) => ['reports', 'mouvements', 'clotures'].filter((c) => repond(e, f[c]));
    it('du 1er avril au 30 juin · le report garde ce qui précède et l’ouverture du premier jour ; la période ses jours ; rien après', () => {
        const periode = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-04-01', au: '2026-06-30' });
        const de = colonnesDe((0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)(base, periode));
        expect(Object.fromEntries(Object.entries(ECRITURES).map(([k, e]) => [k, de(e)]))).toEqual({
            aNouveau: ['reports'],
            janvier: ['reports'],
            finMars: ['reports'],
            premierJour: ['mouvements'],
            dernierJour: ['mouvements'],
            apres: [],
            repriseMai: ['mouvements'],
            reprisePremierJour: ['reports'],
            virementResultat: [],
            soldeGestion: [],
            simulation: [],
        });
    });
    it('jusqu’à la fin de l’exercice · le virement du résultat est un mouvement, le solde des comptes de gestion a sa colonne', () => {
        const periode = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-04-01' });
        const de = colonnesDe((0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)(base, periode));
        expect(de(ECRITURES.soldeGestion)).toEqual(['clotures']);
        expect(de(ECRITURES.virementResultat)).toEqual(['mouvements']);
        expect(de(ECRITURES.apres)).toEqual(['mouvements']);
    });
    it('du premier jour de l’exercice · l’à-nouveau reste au report, janvier est un mouvement', () => {
        const periode = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-01-01', au: '2026-03-31' });
        const de = colonnesDe((0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)(base, periode));
        expect(de(ECRITURES.aNouveau)).toEqual(['reports']);
        expect(de(ECRITURES.janvier)).toEqual(['mouvements']);
        expect(de(ECRITURES.finMars)).toEqual(['mouvements']);
        expect(de(ECRITURES.premierJour)).toEqual([]);
    });
    it('le dernier jour seul · le virement du résultat, daté de ce jour, n’est jamais une ouverture', () => {
        const periode = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-12-31', au: '2026-12-31' });
        const de = colonnesDe((0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)(base, periode));
        expect(de(ECRITURES.virementResultat)).toEqual(['mouvements']);
        expect(de(ECRITURES.soldeGestion)).toEqual(['clotures']);
        expect(de(ECRITURES.apres)).toEqual(['reports']);
    });
    it('CHAQUE LIGNE DANS UNE COLONNE ET UNE SEULE, quelle que soit la période', () => {
        const jours = ['2026-01-01', '2026-01-15', '2026-03-31', '2026-04-01', '2026-05-10', '2026-06-30', '2026-12-31'];
        for (const du of jours) {
            for (const au of jours.filter((j) => j >= du)) {
                const periode = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du, au });
                if (!periode)
                    continue;
                const de = colonnesDe((0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)(base, periode));
                for (const [cle, e] of Object.entries(ECRITURES)) {
                    const attendu = e.statut === 'SITUATION' || e.date.getTime() > periode.au.getTime() ? 0 : 1;
                    expect([du, au, cle, de(e).length]).toEqual([du, au, cle, attendu]);
                }
            }
        }
    });
    it('le livre-journal seul, quand l’appelant le demande · le brouillard n’entre dans aucune colonne', () => {
        const periode = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-04-01', au: '2026-06-30' });
        const de = colonnesDe((0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)({ ...base, statut: 'VALIDEE' }, periode));
        expect(de(ECRITURES.finMars)).toEqual([]);
        expect(de(ECRITURES.janvier)).toEqual(['reports']);
    });
});
const COMPTES = {
    banque: { id: 'banque', numero: '52110000', intitule: 'Banque' },
    dotation: { id: 'dotation', numero: '10100000', intitule: 'Dotation' },
    achats: { id: 'achats', numero: '60110000', intitule: 'Achats' },
    caisse: { id: 'caisse', numero: '57110000', intitule: 'Caisse' },
};
const l = (id, compte, debit, credit, ecriture) => ({
    id,
    compteId: compte,
    numero: COMPTES[compte].numero,
    debit,
    credit,
    ecriture,
});
const LIGNES = [
    l('an1', 'banque', 1000, 0, ECRITURES.aNouveau),
    l('an2', 'dotation', 0, 1000, ECRITURES.aNouveau),
    l('j1', 'achats', 200, 0, ECRITURES.janvier),
    l('j2', 'banque', 0, 200, ECRITURES.janvier),
    l('m1', 'caisse', 50, 0, ECRITURES.finMars),
    l('m2', 'banque', 0, 50, ECRITURES.finMars),
    l('p1', 'achats', 300, 0, ECRITURES.premierJour),
    l('p2', 'banque', 0, 300, ECRITURES.premierJour),
    l('a1', 'achats', 999, 0, ECRITURES.apres),
    l('a2', 'banque', 0, 999, ECRITURES.apres),
    l('s1', 'achats', 7, 0, ECRITURES.simulation),
    l('s2', 'banque', 0, 7, ECRITURES.simulation),
];
function serviceAvec(lignes) {
    const enLigne = (x) => ({
        id: x.id,
        ecritureId: `e-${x.ecriture.date.toISOString()}`,
        compteId: x.compteId,
        libelle: null,
        lettre: null,
        debit: new client_1.Prisma.Decimal(x.debit),
        credit: new client_1.Prisma.Decimal(x.credit),
        compte: COMPTES[x.compteId],
        ecriture: { ...x.ecriture, libelle: 'Essai', reference: null, numeroPiece: 1, journal: { code: 'OD' } },
    });
    const choisies = (where) => lignes.filter((x) => {
        const filtreCompte = where.compteId;
        if (typeof filtreCompte === 'string' && x.compteId !== filtreCompte)
            return false;
        if (filtreCompte && typeof filtreCompte === 'object' && !filtreCompte.in.includes(x.compteId))
            return false;
        const ecriture = { ...where.ecriture };
        delete ecriture.lignes;
        return repond(x.ecriture, ecriture);
    });
    const prisma = {
        compte: {
            findFirst: jest.fn(async ({ where }) => COMPTES[where.id] ?? null),
            findMany: jest.fn(async ({ where }) => where.id.in.map((id) => COMPTES[id]).filter(Boolean)),
        },
        ligneEcriture: {
            count: jest.fn(async ({ where }) => choisies(where).length),
            findMany: jest.fn(async ({ where }) => choisies(where).map(enLigne)),
            groupBy: jest.fn(async ({ where }) => {
                const parCompte = new Map();
                for (const x of choisies(where)) {
                    const a = parCompte.get(x.compteId) ?? { debit: 0, credit: 0 };
                    a.debit += x.debit;
                    a.credit += x.credit;
                    parCompte.set(x.compteId, a);
                }
                return [...parCompte].map(([compteId, s]) => ({ compteId, _sum: s }));
            }),
        },
    };
    return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
}
describe('le grand livre de l’écran sur une période · le solde de départ ne se perd jamais', () => {
    const periode = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du: '2026-04-01', au: '2026-06-30' });
    it('chaque compte ouvre sur son report à la veille, brut, et le solde progressif part de lui', async () => {
        const livre = await serviceAvec(LIGNES).grandLivreComplet('t1', 'ex', periode);
        const banque = livre.find((s) => s.compte.id === 'banque');
        expect(banque.report).toEqual({ au: jour('2026-03-31'), debit: 1000, credit: 250 });
        expect(banque.lignes.map((x) => [x.id, x.soldeProgressif])).toEqual([['p2', 450]]);
        expect(banque.soldeFinal).toBe(450);
        expect([banque.totalDebit, banque.totalCredit]).toEqual([0, 300]);
    });
    it('un compte qui n’a que son report garde sa section, à son rang · jamais une simulation, jamais l’après', async () => {
        const livre = await serviceAvec(LIGNES).grandLivreComplet('t1', 'ex', periode);
        expect(livre.map((s) => s.compte.numero)).toEqual(['10100000', '52110000', '57110000', '60110000']);
        const caisse = livre.find((s) => s.compte.id === 'caisse');
        expect(caisse.lignes).toEqual([]);
        expect(caisse.soldeFinal).toBe(50);
        const achats = livre.find((s) => s.compte.id === 'achats');
        expect(achats.lignes.map((x) => x.id)).toEqual(['p1']);
        expect(achats.soldeFinal).toBe(500);
    });
    it('le grand livre d’un compte porte aussi son report', async () => {
        const r = await serviceAvec(LIGNES).grandLivre('t1', 'banque', 'ex', undefined, periode);
        expect(r.report).toEqual({ au: jour('2026-03-31'), debit: 1000, credit: 250 });
        expect(r.soldeFinal).toBe(450);
    });
    it('LA BALANCE ET LE LIVRE DISENT LE MÊME REPORT ET LES MÊMES MOUVEMENTS, compte par compte', async () => {
        const lignes = [
            ...LIGNES,
            l('o1', 'banque', 5, 0, ECRITURES.reprisePremierJour),
            l('o2', 'dotation', 0, 5, ECRITURES.reprisePremierJour),
            l('r1', 'caisse', 40, 0, ECRITURES.repriseMai),
            l('r2', 'dotation', 0, 40, ECRITURES.repriseMai),
            l('v1', 'dotation', 9, 0, ECRITURES.virementResultat),
            l('v2', 'banque', 0, 9, ECRITURES.virementResultat),
        ];
        const base = { tenantId: 't1', exerciceId: 'ex' };
        for (const [du, au] of [['2026-04-01', '2026-06-30'], ['2026-05-10', '2026-12-31'], ['2026-01-01', '2026-03-31'], ['2026-12-31', '2026-12-31']]) {
            const p = (0, periode_extrait_1.periodeDeLExtrait)(EXERCICE, { du, au });
            const colonnes = (0, balance_trois_colonnes_1.filtresDesTroisColonnesDeLaPeriode)(base, p);
            const livre = await serviceAvec(lignes).grandLivreComplet('t1', 'ex', p);
            for (const compte of Object.keys(COMPTES)) {
                const somme = (f) => lignes
                    .filter((x) => x.compteId === compte && repond(x.ecriture, f))
                    .reduce((a, x) => [a[0] + x.debit, a[1] + x.credit], [0, 0]);
                const [rd, rc] = somme(colonnes.reports);
                const [md, mc] = somme(colonnes.mouvements);
                const [cd, cc] = somme(colonnes.clotures);
                const section = livre.find((s) => s.compte.id === compte);
                const reportLivre = section?.report ? [section.report.debit, section.report.credit] : [0, 0];
                const periodeLivre = section ? [section.totalDebit, section.totalCredit] : [0, 0];
                expect([du, compte, reportLivre]).toEqual([du, compte, [rd, rc]]);
                expect([du, compte, periodeLivre]).toEqual([du, compte, [md + cd, mc + cc]]);
            }
        }
    });
    it('sans période, le livre de l’exercice ne change pas · aucun report, toutes les lignes', async () => {
        const livre = await serviceAvec(LIGNES).grandLivreComplet('t1', 'ex');
        expect(livre.every((s) => !('report' in s))).toBe(true);
        expect(livre.find((s) => s.compte.id === 'achats').lignes.map((x) => x.id)).toEqual(['j1', 'p1', 'a1']);
    });
});
//# sourceMappingURL=periode-extrait.spec.js.map