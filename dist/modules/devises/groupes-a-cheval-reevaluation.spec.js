"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const devises_service_1 = require("./devises.service");
const perimetre_reevaluation_1 = require("./perimetre-reevaluation");
const EXERCICES = {
    N: { id: 'N', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' },
    N1: { id: 'N1', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31'), statut: 'OUVERT' },
};
function monter(lignes) {
    const habiller = (l) => ({
        ...l,
        compteId: 'c411',
        deviseId: l.montantDevise === null ? null : 'usd',
        compte: { id: 'c411', numero: '41110000', intitule: 'Client KASONGO' },
        devise: l.montantDevise === null ? null : { id: 'usd', code: 'USD' },
        lettrage: l.lettrageId ? { code: 'A' } : null,
        ecriture: { exerciceId: l.exerciceId, date: new Date(l.date) },
    });
    const sortDe = (groupe, exerciceId, date) => lignes.some((x) => x.lettrageId === groupe && (x.exerciceId !== exerciceId || new Date(x.date) > date));
    const findMany = jest.fn(async ({ where }) => {
        if (where.lettrageId) {
            const ids = where.lettrageId.in;
            return lignes.filter((l) => l.lettrageId && ids.includes(l.lettrageId)).map(habiller);
        }
        const e = where.ecriture;
        if (!e?.exerciceId || !e.date || !(Array.isArray(where.OR) || where.lettre === null))
            return [];
        const branche = Array.isArray(where.OR);
        return lignes
            .filter((l) => l.exerciceId === e.exerciceId && new Date(l.date) <= e.date.lte && l.montantDevise !== null)
            .filter((l) => l.lettre === null || (branche && l.lettrageId !== null && sortDe(l.lettrageId, e.exerciceId, e.date.lte)))
            .map(habiller);
    });
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn(async ({ where }) => (where.id ? EXERCICES[where.id] : null)),
        },
        ligneEcriture: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }), findMany },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
        ecriture: { count: jest.fn().mockResolvedValue(1) },
        coursDevise: {
            findFirst: jest.fn(async ({ where }) => ({
                cours: where.date.lte <= EXERCICES.N.dateFin ? 2750 : 2700,
            })),
        },
    };
    return { svc: new devises_service_1.DevisesService(prisma, {}), findMany };
}
const facture = { id: 'F', exerciceId: 'N', date: '2026-11-10', debit: 2_800_000, credit: 0, montantDevise: 1000, lettrageId: 'G', lettre: 'A' };
const aNouveau = { id: 'AN', exerciceId: 'N1', date: '2027-01-01', debit: 2_800_000, credit: 0, montantDevise: 1000, lettrageId: null, lettre: null };
const auCoutHistorique = { id: 'R', exerciceId: 'N1', date: '2027-03-15', debit: 0, credit: 2_800_000, montantDevise: 1000, lettrageId: 'G', lettre: 'A' };
const auPaye = { id: 'R', exerciceId: 'N1', date: '2027-03-15', debit: 0, credit: 2_700_000, montantDevise: 1000, lettrageId: 'G', lettre: 'A' };
const ecartPasse = { id: 'E', exerciceId: 'N1', date: '2027-03-15', debit: 0, credit: 100_000, montantDevise: null, lettrageId: 'G', lettre: 'A' };
describe('A6 bis, B1 · en N+1, le règlement d’un groupe à cheval compense l’à-nouveau', () => {
    it('au Détail, règlement au coût historique · la position est dénouée, rien à doter', async () => {
        const { svc } = monter([facture, aNouveau, auCoutHistorique]);
        const r = await svc.calculer('t', { exerciceId: 'N1' });
        expect(r.positions).toEqual([]);
        expect(r.provision).toBe(0);
        expect(r.perteLatente).toBe(0);
    });
    it('règlement au payé et écart réalisé passé sur le groupe · la ligne en francs entre dans la valeur comptable, rien à doter', async () => {
        const { svc } = monter([facture, aNouveau, auPaye, ecartPasse]);
        const r = await svc.calculer('t', { exerciceId: 'N1' });
        expect(r.positions).toEqual([]);
        expect(r.positionsNonReevaluees).toEqual([]);
        expect(r.provision).toBe(0);
    });
    it('écart réalisé PAS ENCORE passé · la position soldée en devise est dite dénouée, 100 000 à passer, jamais au 478', async () => {
        const { svc } = monter([facture, aNouveau, auPaye]);
        const r = await svc.calculer('t', { exerciceId: 'N1' });
        expect(r.positions).toEqual([]);
        expect(r.positionsNonReevaluees).toEqual([
            expect.objectContaining({ numero: '41110000', montantDevise: 0, motif: expect.stringMatching(/position dénouée.*100000\.00/) }),
        ]);
    });
    it('au SOLDE, réglée pour moitié en N et soldée en N+1 · l’à-nouveau de 500 USD et le solde se compensent', async () => {
        const partielN = { id: 'P', exerciceId: 'N', date: '2026-12-01', debit: 0, credit: 1_400_000, montantDevise: 500, lettrageId: 'G', lettre: 'A' };
        const anSolde = { id: 'AN', exerciceId: 'N1', date: '2027-01-01', debit: 1_400_000, credit: 0, montantDevise: 500, lettrageId: null, lettre: null };
        const solde = { id: 'S', exerciceId: 'N1', date: '2027-03-15', debit: 0, credit: 1_400_000, montantDevise: 500, lettrageId: 'G', lettre: 'A' };
        const { svc } = monter([facture, partielN, anSolde, solde]);
        const r = await svc.calculer('t', { exerciceId: 'N1' });
        expect(r.positions).toEqual([]);
        expect(r.provision).toBe(0);
    });
});
describe('A6 bis, B2 · la provision et la charge de N+1 avec une seconde facture ouverte', () => {
    const ouverte = { id: 'H', exerciceId: 'N1', date: '2027-05-01', debit: 1_400_000, credit: 0, montantDevise: 500, lettrageId: null, lettre: null };
    it('provision 50 000 et non 150 000 · charge 150 000 (100 000 réalisés, 50 000 dotés) et non 250 000', async () => {
        const { svc } = monter([facture, aNouveau, auPaye, ecartPasse, ouverte]);
        const r = await svc.calculer('t', { exerciceId: 'N1' });
        expect(r.positions).toEqual([expect.objectContaining({ montantDevise: 500, valeurComptable: 1_400_000, ecart: -50_000 })]);
        expect(r.provision).toBe(50_000);
        const dotation = r.ajustementsProvision.reduce((t, a) => t + a.dotation, 0);
        expect(dotation).toBe(50_000);
        expect(ecartPasse.credit + dotation).toBe(150_000);
    });
    it('réalisé PAS ENCORE passé · il sort de la position et se nomme · la seconde facture seule se réévalue (−50 000), jamais −150 000', async () => {
        const { svc } = monter([facture, aNouveau, auPaye, ouverte]);
        const r = await svc.calculer('t', { exerciceId: 'N1' });
        expect(r.positions).toEqual([expect.objectContaining({ montantDevise: 500, valeurComptable: 1_400_000, ecart: -50_000 })]);
        expect(r.provision).toBe(50_000);
        expect(r.positionsNonReevaluees).toEqual([expect.objectContaining({ motif: expect.stringMatching(/^lettrage a · position dénouée.*100000\.00/) })]);
    });
});
describe('A6 bis, B-3 · en N, une facture lettrée par un règlement de N+1 subsiste à la clôture', () => {
    it('lettrée (SOLDE) par un groupe qui a une ligne en N+1 · lue ouverte, réévaluée · −50 000 au cours de 2 750', async () => {
        const { svc } = monter([facture, aNouveau, auCoutHistorique]);
        const r = await svc.calculer('t', { exerciceId: 'N' });
        expect(r.positions).toEqual([expect.objectContaining({ montantDevise: 1000, valeurComptable: 2_800_000, ecart: -50_000 })]);
        expect(r.perteLatente).toBe(50_000);
    });
    it('réglée pour moitié en N, soldée en N+1 · les 500 USD restants se réévaluent · −25 000', async () => {
        const partielN = { id: 'P', exerciceId: 'N', date: '2026-12-01', debit: 0, credit: 1_400_000, montantDevise: 500, lettrageId: 'G', lettre: 'A' };
        const solde = { id: 'S', exerciceId: 'N1', date: '2027-03-15', debit: 0, credit: 1_400_000, montantDevise: 500, lettrageId: 'G', lettre: 'A' };
        const { svc } = monter([facture, partielN, solde]);
        const r = await svc.calculer('t', { exerciceId: 'N' });
        expect(r.positions).toEqual([expect.objectContaining({ montantDevise: 500, valeurComptable: 1_400_000, ecart: -25_000 })]);
    });
    it('un groupe soldé tout entier dans N reste éteint · rien à réévaluer', async () => {
        const regleeN = { ...auCoutHistorique, exerciceId: 'N', date: '2026-12-15' };
        const { svc, findMany } = monter([facture, regleeN]);
        const r = await svc.calculer('t', { exerciceId: 'N' });
        expect(r.positions).toEqual([]);
        const lue = findMany.mock.calls[0][0];
        expect(lue.where.OR).toEqual([
            { lettre: null },
            {
                lettrage: {
                    lignes: { some: { OR: [{ ecriture: { exerciceId: { not: 'N' } } }, { ecriture: { date: { gt: EXERCICES.N.dateFin } } }] } },
                },
            },
        ]);
    });
});
describe('lectureDesGroupes · la règle pure', () => {
    const l = (id, lettrageId, exerciceId, date, devise) => ({
        id,
        lettrageId,
        code: 'A',
        compteId: 'c',
        compte: null,
        debit: 0,
        credit: 1,
        deviseId: devise,
        montantDevise: devise ? 1 : null,
        devise: devise ? { id: devise, code: devise.toUpperCase() } : null,
        ecriture: { exerciceId, date: new Date(date) },
    });
    const p = { exerciceId: 'N1', date: new Date('2027-12-31') };
    it('à cheval par l’exercice ou par la date · la ligne en francs de l’exercice est rendue, avec la devise du groupe', () => {
        const r = (0, perimetre_reevaluation_1.lectureDesGroupes)([
            l('F', 'G', 'N', '2026-11-10', 'usd'),
            l('R', 'G', 'N1', '2027-03-15', 'usd'),
            l('E', 'G', 'N1', '2027-03-15', null),
            l('X', 'H', 'N1', '2027-03-15', 'usd'),
            l('Y', 'H', 'N1', '2027-04-15', null),
        ], p);
        expect([...r.aCheval]).toEqual(['G']);
        expect(r.lignesEnFrancs.map((x) => x.id)).toEqual(['E']);
        expect(r.deviseDuGroupe.get('G')).toEqual({ id: 'usd', code: 'USD' });
    });
    it('un groupe à deux devises n’a pas de devise · rien n’est deviné', () => {
        const r = (0, perimetre_reevaluation_1.lectureDesGroupes)([l('F', 'G', 'N', '2026-11-10', 'usd'), l('R', 'G', 'N1', '2027-03-15', 'eur')], p);
        expect(r.deviseDuGroupe.has('G')).toBe(false);
    });
});
//# sourceMappingURL=groupes-a-cheval-reevaluation.spec.js.map