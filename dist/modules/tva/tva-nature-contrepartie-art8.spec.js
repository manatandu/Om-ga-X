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
const impayee = (tiers) => ({ statut: 'PARTIEL', solde: tiers, soldeAt: null, reglements: [] });
const regleeEnJuin = (tiers) => ({
    statut: 'SOLDE',
    solde: 0,
    soldeAt: new Date('2026-09-30'),
    reglements: [{ date: '2026-06-12', montant: tiers }],
});
function ligne(opts) {
    const sens = opts.compteTva.startsWith('443') ? 'VENTE' : 'ACHAT';
    const classe = `CLASSE_${opts.contrepartie[0]}`;
    const groupe = {
        ...opts.lettrage,
        lignes: [
            {
                debit: sens === 'VENTE' ? opts.tiers : 0,
                credit: sens === 'ACHAT' ? opts.tiers : 0,
                ecriture: { date: new Date(opts.date) },
            },
            ...opts.lettrage.reglements.map((r) => ({
                debit: sens === 'ACHAT' ? r.montant : 0,
                credit: sens === 'VENTE' ? r.montant : 0,
                ecriture: { date: new Date(r.date) },
            })),
        ],
    };
    return {
        id: `l-${opts.compteTva}-${opts.contrepartie}-${opts.date}`,
        tauxTvaId: TAUX.id,
        compte: { numero: opts.compteTva },
        debit: sens === 'ACHAT' ? opts.tva : 0,
        credit: sens === 'VENTE' ? opts.tva : 0,
        ecriture: {
            date: new Date(opts.date),
            lignes: [
                {
                    debit: sens === 'VENTE' ? opts.tiers : 0,
                    credit: sens === 'ACHAT' ? opts.tiers : 0,
                    compte: { numero: sens === 'VENTE' ? '41100000' : '40100000', classe: 'CLASSE_4' },
                    lettrage: groupe,
                },
                {
                    debit: sens === 'ACHAT' ? opts.tiers - opts.tva : 0,
                    credit: sens === 'VENTE' ? opts.tiers - opts.tva : 0,
                    compte: { numero: opts.contrepartie, classe },
                    lettrage: null,
                },
            ],
        },
    };
}
function service(regime, lignesTva) {
    const prisma = {
        tenant: {
            findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: regime, referentiel: 'SYSCOHADA' }),
        },
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
const JUIN = new Date('2026-06-01');
const FIN_JUIN = new Date('2026-06-30T23:59:59.999Z');
describe('La requête charge bien les contreparties qui portent la nature', () => {
    it('demande les lignes de classe 7, 6 et 2 en plus des tiers de classe 4', async () => {
        const s = service('ENCAISSEMENTS', []);
        await s.declaration('t1', MARS, FIN_MARS);
        const prisma = s.prisma;
        const appels = prisma.ligneEcriture.findMany.mock.calls.map((c) => JSON.stringify(c[0]));
        const requete = appels.find((a) => a.includes('lettrage'));
        expect(requete).toBeDefined();
        for (const classe of ['CLASSE_7', 'CLASSE_6', 'CLASSE_2', 'CLASSE_4']) {
            expect(requete).toContain(classe);
        }
    });
});
describe('TVA collectée · le 707 ne fait pas de tout une vente de biens (art. 8)', () => {
    it('une COMMISSION (70720000) impayée n’est pas exigible, malgré son compte de TVA 4431', async () => {
        const s = service('LIVRAISONS', [
            ligne({
                compteTva: '44310000',
                contrepartie: '70720000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: impayee(1_160_000),
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(0);
        expect(d.tvaEnAttenteEncaissement).toBe(160_000);
    });
    it('la même commission, encaissée en juin, tombe dans la déclaration de JUIN', async () => {
        const s = service('LIVRAISONS', [
            ligne({
                compteTva: '44310000',
                contrepartie: '70720000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: regleeEnJuin(1_160_000),
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalCollecte).toBe(0);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalCollecte).toBe(160_000);
    });
    it('une LOCATION (70730000) et une REDEVANCE (70760000) suivent la même règle', async () => {
        for (const contrepartie of ['70730000', '70760000']) {
            const s = service('LIVRAISONS', [
                ligne({
                    compteTva: '44310000',
                    contrepartie,
                    date: '2026-03-10',
                    tva: 160_000,
                    tiers: 1_160_000,
                    lettrage: impayee(1_160_000),
                }),
            ]);
            const d = await s.declaration('t1', MARS, FIN_MARS);
            expect(d.totalCollecte).toBe(0);
            expect(d.tvaEnAttenteEncaissement).toBe(160_000);
        }
    });
    it('une VENTE DE MARCHANDISES (70110000) reste exigible à la livraison', async () => {
        const s = service('ENCAISSEMENTS', [
            ligne({
                compteTva: '44310000',
                contrepartie: '70110000',
                date: '2026-03-10',
                tva: 1_600_000,
                tiers: 11_600_000,
                lettrage: impayee(11_600_000),
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(1_600_000);
        expect(d.tvaEnAttenteEncaissement).toBe(0);
    });
    it('une écriture qui MÊLE une vente de marchandises et une commission ne tranche pas', async () => {
        const l = ligne({
            compteTva: '44310000',
            contrepartie: '70110000',
            date: '2026-03-10',
            tva: 160_000,
            tiers: 1_160_000,
            lettrage: impayee(1_160_000),
        });
        l.ecriture.lignes.push({
            debit: 0,
            credit: 500_000,
            compte: { numero: '70720000', classe: 'CLASSE_7' },
            lettrage: null,
        });
        const d = await service('ENCAISSEMENTS', [l]).declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(0);
        expect(d.mentionExigibilite).toContain('REPLI DÉCLARÉ');
    });
});
describe('TVA déductible · le 605 n’est pas un achat de biens (art. 8)', () => {
    it('une facture d’ÉLECTRICITÉ (60520000) n’est déductible qu’au paiement du fournisseur', async () => {
        const s = service('LIVRAISONS', [
            ligne({
                compteTva: '44520000',
                contrepartie: '60520000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: regleeEnJuin(1_160_000),
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(0);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalDeductible).toBe(160_000);
    });
    it('l’EAU (60510000) et les ÉTUDES (60570000) suivent la même règle', async () => {
        for (const contrepartie of ['60510000', '60570000']) {
            const s = service('LIVRAISONS', [
                ligne({
                    compteTva: '44520000',
                    contrepartie,
                    date: '2026-03-10',
                    tva: 160_000,
                    tiers: 1_160_000,
                    lettrage: regleeEnJuin(1_160_000),
                }),
            ]);
            expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(0);
            expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalDeductible).toBe(160_000);
        }
    });
    it('un ACHAT DE MARCHANDISES (60110000) reste déductible dès la facture', async () => {
        const s = service('ENCAISSEMENTS', [
            ligne({
                compteTva: '44520000',
                contrepartie: '60110000',
                date: '2026-03-10',
                tva: 1_600_000,
                tiers: 11_600_000,
                lettrage: impayee(11_600_000),
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(1_600_000);
    });
    it('le 60580000 « travaux, matériels et équipements » porte DEUX sens et n’est pas tranché', async () => {
        const s = service('ENCAISSEMENTS', [
            ligne({
                compteTva: '44520000',
                contrepartie: '60580000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: impayee(1_160_000),
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('REPLI DÉCLARÉ');
    });
});
describe('Article 26, alinéa 3 · l’encaissement antérieur au débit est DÉCLARÉ, jamais supposé résolu', () => {
    it('un dossier aux DÉBITS voit sa TVA sur services annoncée avec la réserve de l’alinéa 3', async () => {
        const s = service('DEBITS', [
            ligne({
                compteTva: '44320000',
                contrepartie: '70610000',
                date: '2026-03-10',
                tva: 320_000,
                tiers: 2_320_000,
                lettrage: impayee(2_320_000),
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(320_000);
        expect(d.mentionExigibilite).toContain('ENCAISSEMENT ANTÉRIEUR AU DÉBIT, NON VÉRIFIÉ');
        expect(d.mentionExigibilite).toContain(`${(320_000).toLocaleString('fr-FR')} CDF de TVA collectée`);
        expect(d.mentionExigibilite).toContain('avance reçue');
    });
    it('un dossier qui n’est PAS aux débits ne porte pas cette réserve', async () => {
        const s = service('ENCAISSEMENTS', [
            ligne({
                compteTva: '44320000',
                contrepartie: '70610000',
                date: '2026-03-10',
                tva: 320_000,
                tiers: 2_320_000,
                lettrage: impayee(2_320_000),
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.mentionExigibilite).not.toContain('ENCAISSEMENT ANTÉRIEUR AU DÉBIT');
    });
});
//# sourceMappingURL=tva-nature-contrepartie-art8.spec.js.map