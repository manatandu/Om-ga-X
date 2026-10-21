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
describe('Article 10 du décret · la location-vente est une LIVRAISON DE BIENS', () => {
    it('le 62340000 est déductible dès la facture, malgré la racine 62 classée SERVICES', async () => {
        for (const referentiel of ['SYSCOHADA', 'SYCEBNL']) {
            const s = service('ENCAISSEMENTS', [
                ligne({
                    compteTva: '44520000',
                    contrepartie: '62340000',
                    date: '2026-03-10',
                    tva: 1_600_000,
                    tiers: 11_600_000,
                    lettrage: impayee(11_600_000),
                }),
            ], referentiel);
            expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(1_600_000);
        }
    });
    it('une AUTRE charge de la racine 62 reste un service · l’exception ne déborde pas', async () => {
        const s = service('ENCAISSEMENTS', [
            ligne({
                compteTva: '44540000',
                contrepartie: '62230000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: impayee(1_160_000),
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(0);
    });
});
describe('Article 17 du décret · un dossier SYCEBNL lit sa contrepartie de charge comme un autre', () => {
    it('l’ÉLECTRICITÉ (60520000) d’un dossier SYCEBNL n’est déductible qu’au paiement', async () => {
        const s = service('LIVRAISONS', [
            ligne({
                compteTva: '44520000',
                contrepartie: '60520000',
                date: '2026-03-10',
                tva: 160_000,
                tiers: 1_160_000,
                lettrage: regleeEnJuin(1_160_000),
            }),
        ], 'SYCEBNL');
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(0);
        const juin = await s.declaration('t1', new Date('2026-06-01'), new Date('2026-06-30T23:59:59.999Z'));
        expect(juin.totalDeductible).toBe(160_000);
    });
    it('mais son 60110000 ne tranche PAS · le SYCEBNL y sème « biens ET services »', async () => {
        const s = service('ENCAISSEMENTS', [
            ligne({
                compteTva: '44520000',
                contrepartie: '60110000',
                date: '2026-03-10',
                tva: 1_600_000,
                tiers: 11_600_000,
                lettrage: impayee(11_600_000),
            }),
        ], 'SYCEBNL');
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('REPLI DÉCLARÉ');
    });
    it('le même 60110000 tranche BIENS au SYSCOHADA · son plan, lui, le dit', async () => {
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
});
describe('La classe 7 reste fermée au SYCEBNL, et c’est ce qui évite un défaut neuf', () => {
    it('une vente SYCEBNL portée au 70510000 n’est PAS datée comme un travail facturé', async () => {
        const s = service('LIVRAISONS', [
            ligne({
                compteTva: '44310000',
                contrepartie: '70510000',
                date: '2026-03-10',
                tva: 1_600_000,
                tiers: 11_600_000,
                lettrage: impayee(11_600_000),
            }),
        ], 'SYCEBNL');
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.tvaEnAttenteEncaissement).toBe(0);
        expect(d.totalCollecte).toBe(1_600_000);
        expect(d.mentionExigibilite).toContain('REPLI DÉCLARÉ');
    });
    it('au SYSCOHADA, le même numéro reste un travail facturé', async () => {
        const s = service('LIVRAISONS', [
            ligne({
                compteTva: '44330000',
                contrepartie: '70510000',
                date: '2026-03-10',
                tva: 1_600_000,
                tiers: 11_600_000,
                lettrage: impayee(11_600_000),
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalCollecte).toBe(0);
        expect(d.tvaEnAttenteEncaissement).toBe(1_600_000);
    });
});
describe('Les deux réserves du décret sont ANNONCÉES, faute de pouvoir être calculées', () => {
    it('la déclaration nomme le contrat d’abonnement (art. 55) et l’effet de commerce (art. 57)', async () => {
        const s = service('ENCAISSEMENTS', []);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.mentionExigibilite).toContain('CONTRAT D’ABONNEMENT');
        expect(d.mentionExigibilite).toContain('art. 55');
        expect(d.mentionExigibilite).toContain('EFFET DE COMMERCE');
        expect(d.mentionExigibilite).toContain('remise à l’escompte');
    });
});
//# sourceMappingURL=tva-decret-011-42.spec.js.map