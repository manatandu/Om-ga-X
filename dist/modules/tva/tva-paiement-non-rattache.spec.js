"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const jour = (d) => new Date(`${d}T00:00:00.000Z`);
const ouverte = (id, date, montant, libelle, autre = {}) => ({
    id,
    compteId: 'c411',
    debit: montant,
    credit: 0,
    lettrageId: null,
    libelle: null,
    dateEcheance: null,
    statut: 'VALIDEE',
    exerciceId: 'ex27',
    tenantId: 't1',
    ecriture: { date: jour(date), libelle, estGenereeParCloture: false },
    ...autre,
});
const A = ouverte('A', '2027-01-01', 580_000, 'À-nouveaux 2027', {
    libelle: 'Facture F7 du 10/11/2026',
    ecriture: { date: jour('2027-01-01'), libelle: 'À-nouveaux 2027', estGenereeParCloture: true },
});
const B = ouverte('B', '2027-02-10', 1_160_000, 'Facture F9');
const paiement = (id, date, montant, compte = { id: 'c411', numero: '41110101' }) => ({
    id,
    compteId: compte.id,
    debit: 0,
    credit: montant,
    aRelettrerDepuis: jour('2027-01-15'),
    lettrageId: null,
    compte: { numero: compte.numero },
    ecriture: { date: jour(date), exerciceId: 'ex27' },
});
function lireOuvertes(lignes, where) {
    return lignes.filter((l) => l.compteId === where.compteId &&
        l.lettrageId === null &&
        !(where.id?.notIn ?? []).includes(l.id) &&
        (!where.debit || l.debit > where.debit.gt) &&
        (!where.credit || l.credit > where.credit.gt) &&
        l.tenantId === where.ecriture.tenantId &&
        l.statut === where.ecriture.statut &&
        l.exerciceId === where.ecriture.exerciceId &&
        l.ecriture.date <= where.ecriture.date.lte);
}
function lireOrigines(origines, where) {
    return origines.filter((o) => o.compteId === where.compteId &&
        !o.ecriture.estGenereeParCloture &&
        o.ecriture.date < where.ecriture.date.lt &&
        where.OR.some((m) => m.debit === o.debit && m.credit === o.credit));
}
function service(ouvertes, aRelettrer = [], origines = []) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([]) },
        ecriture: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
        ligneEcriture: {
            findMany: jest.fn(({ where }) => {
                if ('aRelettrerDepuis' in where)
                    return Promise.resolve(aRelettrer);
                if (typeof where.compteId === 'string' && where.ecriture?.NOT) {
                    return Promise.resolve(lireOrigines(origines, where));
                }
                if (typeof where.compteId === 'string')
                    return Promise.resolve(lireOuvertes(ouvertes, where));
                return Promise.resolve([]);
            }),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
        evenementAudit: { findMany: jest.fn().mockResolvedValue([]) },
        exercice: { count: jest.fn().mockResolvedValue(1) },
        imputationPaiement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
describe('paiement non rattaché · l’imputation légale dite (art. 154)', () => {
    it('P1 (700 000) paie A, la plus ancienne, puis 120 000 de B · P2 (2 000 000) paie le reste de B, 960 000 d’avance', async () => {
        const s = service([A, B]);
        const r = await s.imputerLesPaiementsNonRattaches('t1', [paiement('P1', '2027-02-20', 700_000), paiement('P2', '2027-03-01', 2_000_000)]);
        expect(r.get('P1')).toEqual({
            imputation: [
                { facture: 'Facture F7 du 10/11/2026', date: '2027-01-01', montant: 580_000 },
                { facture: 'Facture F9', date: '2027-02-10', montant: 120_000 },
            ],
        });
        expect(r.get('P2')).toEqual({ imputation: [{ facture: 'Facture F9', date: '2027-02-10', montant: 1_040_000 }], avance: 960_000 });
    });
    it('une facture lettrée, d’un autre exercice, d’un autre dossier ou au brouillard n’est pas ouverte · aucune facture, tout en avance', async () => {
        const s = service([
            { ...A, lettrageId: 'G' },
            { ...B, exerciceId: 'ex26' },
            ouverte('C', '2027-02-01', 100_000, 'Facture C', { tenantId: 't2' }),
            ouverte('D', '2027-02-01', 100_000, 'Facture D', { statut: 'BROUILLARD' }),
        ]);
        const r = await s.imputerLesPaiementsNonRattaches('t1', [paiement('P1', '2027-02-20', 700_000)]);
        expect(r.get('P1')).toEqual({ imputation: [], avance: 700_000 });
    });
    it('un compte ni client ni fournisseur, ou plus de 200 factures ouvertes · imputation NON DITE, avec son motif', async () => {
        const trop = Array.from({ length: 201 }, (_, i) => ouverte(`F${i}`, '2027-01-10', 1_000, `Facture ${i}`));
        const r1 = await service([]).imputerLesPaiementsNonRattaches('t1', [paiement('P', '2027-02-20', 1, { id: 'c47', numero: '47100000' })]);
        expect(r1.get('P')).toEqual({ imputationNonDite: 'compte ni client (41) ni fournisseur (40)' });
        const r2 = await service(trop).imputerLesPaiementsNonRattaches('t1', [paiement('P', '2027-02-20', 1)]);
        expect(r2.get('P')).toEqual({ imputationNonDite: 'plus de 200 factures ouvertes sur le compte' });
    });
    it('au fournisseur, la facture est au CRÉDIT et le paiement au débit', async () => {
        const facture = ouverte('FF', '2027-01-20', 300_000, 'Facture fournisseur', { compteId: 'c401', debit: 0, credit: 300_000 });
        const p = { ...paiement('PF', '2027-02-01', 300_000, { id: 'c401', numero: '40110101' }), debit: 300_000, credit: 0 };
        const r = await service([facture]).imputerLesPaiementsNonRattaches('t1', [p]);
        expect(r.get('PF')).toEqual({ imputation: [{ facture: 'Facture fournisseur', date: '2027-01-20', montant: 300_000 }] });
    });
    it('la déclaration DIT l’imputation du paiement non rattaché, et l’avance', async () => {
        const s = service([A, B], [paiement('P1', '2027-02-20', 700_000), paiement('P2', '2027-03-01', 2_000_000)]);
        const d = await s.declaration('t1', jour('2027-03-01'), jour('2027-03-31'));
        expect(d.paiementsARelettrer.map((p) => p.imputation?.length)).toEqual([2, 1]);
        expect(d.mentionExigibilite).toContain('imputé par l’art. 154 sur « Facture F7 du 10/11/2026 » du 01/01/2027 pour 580');
        expect(d.mentionExigibilite).toContain('960');
        expect(d.mentionExigibilite).toContain('d’avance');
    });
    it('M5 · une FACTURE délettrée n’est pas un paiement · seule la ligne de sens règlement est nommée', async () => {
        const factureDelettree = { ...paiement('FX', '2027-02-05', 0), debit: 580_000, credit: 0 };
        const s = service([A, B], [factureDelettree, paiement('P1', '2027-02-20', 700_000)]);
        const d = await s.declaration('t1', jour('2027-02-01'), jour('2027-02-28'));
        expect(d.paiementsARelettrer.map((p) => p.montant)).toEqual([700_000]);
        expect(d.paiementsARelettrerTotal).toBe(1);
    });
    it('M5 · le paiement ne se compte jamais parmi les factures qu’il paie (la requête l’écarte)', async () => {
        const r = await service([A, B]).imputerLesPaiementsNonRattaches('t1', [{ ...paiement('B', '2027-02-20', 0), debit: 1_160_000, credit: 0 }]);
        expect(r.get('B')).toEqual({ imputation: [{ facture: 'Facture F7 du 10/11/2026', date: '2027-01-01', montant: 580_000 }], avance: 580_000 });
    });
    it('M5 · au fournisseur, le paiement est VERSÉ par le dossier, jamais « encaissé »', async () => {
        const facture = ouverte('FF', '2027-01-20', 300_000, 'Facture fournisseur', { compteId: 'c401', debit: 0, credit: 300_000 });
        const p = { ...paiement('PF', '2027-02-01', 0, { id: 'c401', numero: '40110101' }), debit: 300_000, credit: 0 };
        const factureDelettree = { ...paiement('FF2', '2027-02-02', 50_000, { id: 'c401', numero: '40110101' }) };
        const d = await service([facture], [p, factureDelettree]).declaration('t1', jour('2027-02-01'), jour('2027-02-28'));
        expect(d.paiementsARelettrer.map((x) => x.montant)).toEqual([300_000]);
        expect(d.mentionExigibilite).toContain('paiement versé le 01/02');
        expect(d.mentionExigibilite).not.toContain('paiement encaissé');
    });
});
describe('SECOND TOUR M-d · une facture de N reportée se date par sa facture, jamais au 1er janvier', () => {
    const F8 = ouverte('F8', '2026-11-05', 600_000, 'Facture F8', { exerciceId: 'ex26' });
    const F7 = ouverte('F7', '2026-11-10', 580_000, 'Facture F7', { exerciceId: 'ex26' });
    const report = (id, o) => ouverte(id, '2027-01-01', o.debit, 'À-nouveaux 2027', {
        libelle: `RAN détail 41110101 · ${o.ecriture.libelle}`,
        ecriture: { date: jour('2027-01-01'), libelle: 'À-nouveaux 2027', estGenereeParCloture: true },
    });
    it('F8, la plus ancienne, d’abord · 600 000, puis F7 · 100 000, chacune à la date de sa facture', async () => {
        const s = service([report('rF8', F8), report('rF7', F7)], [], [F8, F7]);
        const r = await s.imputerLesPaiementsNonRattaches('t1', [paiement('P1', '2027-02-20', 700_000)]);
        expect(r.get('P1')).toEqual({
            imputation: [
                { facture: 'RAN détail 41110101 · Facture F8', date: '2026-11-05', montant: 600_000 },
                { facture: 'RAN détail 41110101 · Facture F7', date: '2026-11-10', montant: 100_000 },
            ],
        });
    });
    it('sans facture d’origine retrouvée, le report garde sa date', async () => {
        const s = service([report('rF8', F8), report('rF7', F7)], [], []);
        const r = await s.imputerLesPaiementsNonRattaches('t1', [paiement('P1', '2027-02-20', 700_000)]);
        expect(r.get('P1')?.imputation?.map((x) => x.date)).toEqual(['2027-01-01', '2027-01-01']);
    });
});
//# sourceMappingURL=tva-paiement-non-rattache.spec.js.map