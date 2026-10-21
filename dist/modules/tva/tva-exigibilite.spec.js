"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = {
    id: 'tx16',
    code: 'TVA16',
    intitule: 'TVA 16 %',
    taux: 16,
    compteCollecteId: 'c443',
    compteDeductibleId: 'c445',
};
function ligneTva(opts) {
    const sens = opts.compte.startsWith('443') ? 'VENTE' : 'ACHAT';
    const tiers = opts.tiers ?? 0;
    const groupe = opts.lettrage
        ? {
            ...opts.lettrage,
            lignes: [
                { debit: sens === 'VENTE' ? tiers : 0, credit: sens === 'ACHAT' ? tiers : 0, ecriture: { date: new Date(opts.date) } },
                ...(opts.lettrage.reglements ?? []).map((r) => ({
                    debit: sens === 'ACHAT' ? r.montant : 0,
                    credit: sens === 'VENTE' ? r.montant : 0,
                    ecriture: { date: new Date(r.date) },
                })),
            ],
        }
        : null;
    return {
        id: `l-${opts.compte}-${opts.date}`,
        tauxTvaId: TAUX.id,
        compte: { numero: opts.compte },
        debit: sens === 'ACHAT' ? opts.tva : 0,
        credit: sens === 'VENTE' ? opts.tva : 0,
        ecriture: {
            date: new Date(opts.date),
            lignes: groupe
                ? [
                    {
                        debit: sens === 'VENTE' ? tiers : 0,
                        credit: sens === 'ACHAT' ? tiers : 0,
                        compte: { numero: sens === 'VENTE' ? '41100000' : '40100000', classe: 'CLASSE_4' },
                        lettrage: groupe,
                    },
                ]
                : [],
        },
    };
}
function facture(opts) {
    return ligneTva({ compte: '44310000', date: opts.date, tva: opts.tva, tiers: opts.creance, lettrage: opts.lettrage });
}
function service(regime, lignesTva, referentiel = 'SYSCOHADA') {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: regime, referentiel }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue(lignesTva),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
const MARS = new Date('2026-03-01');
const FIN_MARS = new Date('2026-03-31T23:59:59.999Z');
const AVRIL = new Date('2026-04-01');
const FIN_AVRIL = new Date('2026-04-30T23:59:59.999Z');
const JUIN = new Date('2026-06-01');
const FIN_JUIN = new Date('2026-06-30T23:59:59.999Z');
const SEPTEMBRE = new Date('2026-09-01');
const FIN_SEPTEMBRE = new Date('2026-09-30T23:59:59.999Z');
const impayee = (tiers) => ({ statut: 'PARTIEL', solde: tiers, soldeAt: null, reglements: [] });
const regleeEnJuin = (tiers) => ({
    statut: 'SOLDE',
    solde: 0,
    soldeAt: new Date('2026-09-30'),
    reglements: [{ date: '2026-06-12', montant: tiers }],
});
describe('Exigibilité de la TVA collectée · la NATURE de l’opération, pas le dossier (art. 25)', () => {
    it('une VENTE DE BIENS impayée est exigible à la livraison, même dossier paramétré aux ENCAISSEMENTS', async () => {
        const s = service('ENCAISSEMENTS', [
            ligneTva({ compte: '44310000', date: '2026-03-10', tva: 1_600_000, tiers: 11_600_000, lettrage: impayee(11_600_000) }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(1_600_000);
        expect(d.tvaEnAttenteEncaissement).toBe(0);
    });
    it('une PRESTATION DE SERVICES impayée n’est pas exigible, même dossier paramétré aux LIVRAISONS', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({ compte: '44320000', date: '2026-03-10', tva: 320_000, tiers: 2_320_000, lettrage: impayee(2_320_000) }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(0);
        expect(d.tvaEnAttenteEncaissement).toBe(320_000);
    });
    it('un dossier MIXTE date les deux natures dans la MÊME déclaration', async () => {
        const s = service('ENCAISSEMENTS', [
            ligneTva({ compte: '44310000', date: '2026-03-10', tva: 1_600_000, tiers: 11_600_000, lettrage: impayee(11_600_000) }),
            ligneTva({ compte: '44320000', date: '2026-03-12', tva: 320_000, tiers: 2_320_000, lettrage: impayee(2_320_000) }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(1_600_000);
        expect(d.tvaEnAttenteEncaissement).toBe(320_000);
    });
    it('les TRAVAUX (4433) suivent les services · encaissement, article 25, 2°', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({ compte: '44330000', date: '2026-03-10', tva: 500_000, tiers: 3_625_000, lettrage: regleeEnJuin(3_625_000) }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalCollecte).toBe(0);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalCollecte).toBe(500_000);
    });
    it('la LIVRAISON À SOI-MÊME (4434) est exigible au fait générateur, jamais à un encaissement qui n’existe pas', async () => {
        const s = service('ENCAISSEMENTS', [
            ligneTva({ compte: '44340000', date: '2026-03-10', tva: 800_000, tiers: 0, lettrage: null }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalCollecte).toBe(800_000);
    });
    it('le régime des DÉBITS (art. 26) ne déplace QUE les services · les biens sont déjà à la facture', async () => {
        const s = service('DEBITS', [
            ligneTva({ compte: '44320000', date: '2026-03-10', tva: 320_000, tiers: 2_320_000, lettrage: impayee(2_320_000) }),
            ligneTva({ compte: '44310000', date: '2026-03-11', tva: 160_000, tiers: 1_160_000, lettrage: impayee(1_160_000) }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(480_000);
        expect(d.mentionExigibilite).toContain('art. 26');
        expect(d.mentionExigibilite).toContain('Directeur Général des Impôts');
    });
});
describe('Naissance du droit à déduction · chez le FOURNISSEUR (art. 37 al. 1, décret art. 96)', () => {
    it('la TVA d’un ACHAT DE BIENS se déduit à la facture, même dossier aux ENCAISSEMENTS', async () => {
        const s = service('ENCAISSEMENTS', [
            ligneTva({ compte: '44520000', date: '2026-03-10', tva: 400_000, tiers: 2_900_000, lettrage: impayee(2_900_000) }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(400_000);
    });
    it('la TVA d’une PRESTATION reçue ne se déduit qu’au paiement, même dossier aux LIVRAISONS', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({ compte: '44540000', date: '2026-03-10', tva: 160_000, tiers: 1_160_000, lettrage: regleeEnJuin(1_160_000) }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(0);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalDeductible).toBe(160_000);
    });
    it('le TRANSPORT (4453) est une prestation · même règle', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({ compte: '44530000', date: '2026-03-10', tva: 48_000, tiers: 348_000, lettrage: impayee(348_000) }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(0);
    });
    it('l’autorisation de DÉBITS du dossier ne touche pas sa TVA déductible', async () => {
        const s = service('DEBITS', [
            ligneTva({ compte: '44540000', date: '2026-03-10', tva: 160_000, tiers: 1_160_000, lettrage: impayee(1_160_000) }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(0);
    });
    it('avertit que le régime du FOURNISSEUR peut être celui des débits, et qu’OmegaX ne le connaît pas', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({ compte: '44540000', date: '2026-03-10', tva: 160_000, tiers: 1_160_000, lettrage: impayee(1_160_000) }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.mentionExigibilite).toContain('article 37 al. 1');
        expect(d.mentionExigibilite).toContain('art. 96');
        expect(d.mentionExigibilite).toContain('art. 60');
    });
});
describe('Ce que le plan ne dit pas · repli DÉCLARÉ (SYCEBNL et comptes non classés)', () => {
    it('un dossier SYCEBNL retombe sur son paramètre, et la déclaration l’annonce', async () => {
        const s = service('ENCAISSEMENTS', [ligneTva({ compte: '44310000', date: '2026-03-10', tva: 160_000, tiers: 1_160_000, lettrage: impayee(1_160_000) })], 'SYCEBNL');
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(0);
        expect(d.tvaEnAttenteEncaissement).toBe(160_000);
        expect(d.mentionExigibilite).toContain('REPLI DÉCLARÉ');
        expect(d.mentionExigibilite).toContain('SYCEBNL');
    });
    it('un compte SYSCOHADA non classé (4451 immobilisations) retombe aussi, et le dit', async () => {
        const s = service('ENCAISSEMENTS', [
            ligneTva({ compte: '44510000', date: '2026-03-10', tva: 3_200_000, tiers: 23_200_000, lettrage: impayee(23_200_000) }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('REPLI DÉCLARÉ');
        expect(d.mentionExigibilite).toContain('4451');
    });
    it('porte toujours la règle appliquée et son article · un chiffre sans sa règle ne se vérifie pas', async () => {
        const s = service('LIVRAISONS', []);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.regimeExigibilite).toBe('LIVRAISONS');
        expect(d.mentionExigibilite).toContain('article 25');
        expect(d.mentionExigibilite).toContain('art. 25, 2°');
    });
});
describe('Mécanique du lettrage · inchangée, elle date l’encaissement', () => {
    it('une facture de services de mars, réglée en juin, se déclare en JUIN', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({ compte: '44320000', date: '2026-03-10', tva: 160_000, tiers: 1_160_000, lettrage: regleeEnJuin(1_160_000) }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalCollecte).toBe(0);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalCollecte).toBe(160_000);
    });
    it('un règlement PARTIEL rend la taxe exigible à proportion de l’encaissement', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({
                compte: '44320000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: {
                    statut: 'PARTIEL',
                    solde: 290_000,
                    soldeAt: null,
                    reglements: [{ date: '2026-06-12', montant: 870_000 }],
                },
            }),
        ]);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalCollecte).toBe(120_000);
    });
    it('une prestation au comptant, sans créance lettrable, reste exigible à sa date', async () => {
        const s = service('LIVRAISONS', [facture({ date: '2026-03-10', tva: 160_000, creance: 0, lettrage: null })]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalCollecte).toBe(160_000);
    });
});
describe('La date de l’encaissement · le RÈGLEMENT, jamais le lettrage (décret art. 57)', () => {
    it('une prestation réglée en JUIN et lettrée en SEPTEMBRE est exigible en JUIN', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({ compte: '44320000', date: '2026-03-10', tva: 160_000, tiers: 1_160_000, lettrage: regleeEnJuin(1_160_000) }),
        ]);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalCollecte).toBe(160_000);
        expect((await s.declaration('t1', SEPTEMBRE, FIN_SEPTEMBRE)).totalCollecte).toBe(0);
    });
    it('un ACOMPTE encaissé le mois SUIVANT la facture entre dans la déclaration de ce mois-là', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({
                compte: '44330000',
                date: '2026-03-10',
                tva: 800_000,
                tiers: 5_800_000,
                lettrage: {
                    statut: 'PARTIEL',
                    solde: 2_900_000,
                    soldeAt: null,
                    reglements: [{ date: '2026-04-10', montant: 2_900_000 }],
                },
            }),
        ]);
        const mars = await s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalCollecte).toBe(0);
        expect((await s.declaration('t1', AVRIL, FIN_AVRIL)).totalCollecte).toBe(400_000);
        expect(mars.tvaEnAttenteEncaissement).toBe(400_000);
    });
    it('chaque acompte est exigible à SA date, pour SA part (décret art. 57, ligne A7 bis)', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({
                compte: '44320000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: {
                    statut: 'PARTIEL',
                    solde: 290_000,
                    soldeAt: null,
                    reglements: [
                        { date: '2026-04-10', montant: 290_000 },
                        { date: '2026-06-12', montant: 580_000 },
                    ],
                },
            }),
        ]);
        expect((await s.declaration('t1', AVRIL, FIN_AVRIL)).totalCollecte).toBe(40_000);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalCollecte).toBe(80_000);
    });
    it('sans aucun règlement identifiable, la date de l’écriture sert de repli · jamais celle du lettrage', async () => {
        const s = service('LIVRAISONS', [
            ligneTva({
                compte: '44320000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: { statut: 'SOLDE', solde: 0, soldeAt: new Date('2026-09-30'), reglements: [] },
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalCollecte).toBe(160_000);
        expect((await s.declaration('t1', SEPTEMBRE, FIN_SEPTEMBRE)).totalCollecte).toBe(0);
    });
});
//# sourceMappingURL=tva-exigibilite.spec.js.map