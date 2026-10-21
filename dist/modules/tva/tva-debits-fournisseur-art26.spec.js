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
function rattachement(c) {
    if (!c)
        return null;
    return {
        tiers: {
            autoriseTvaDebits: c.autorise,
            referenceAutorisationDebits: c.reference ?? null,
        },
    };
}
function achat(opts) {
    const fournisseurs = opts.fournisseurs ?? [null];
    const groupe = opts.lettrage
        ? {
            ...opts.lettrage,
            lignes: [
                { debit: 0, credit: opts.dette, ecriture: { date: new Date(opts.date) } },
                ...(opts.lettrage.reglements ?? []).map((r) => ({
                    debit: r.montant,
                    credit: 0,
                    ecriture: { date: new Date(r.date) },
                })),
            ],
        }
        : null;
    return {
        id: `l-${opts.compte}-${opts.date}`,
        tauxTvaId: TAUX.id,
        compte: { numero: opts.compte },
        debit: opts.tva,
        credit: 0,
        ecriture: {
            date: new Date(opts.date),
            lignes: fournisseurs.map((f, i) => ({
                debit: 0,
                credit: opts.dette / fournisseurs.length,
                compte: { numero: '40100000', classe: 'CLASSE_4', tiersCompte: rattachement(f) },
                lettrage: i === 0 ? groupe : null,
            })),
        },
    };
}
function vente(opts) {
    const groupe = opts.lettrage
        ? {
            ...opts.lettrage,
            lignes: [
                { debit: opts.creance, credit: 0, ecriture: { date: new Date(opts.date) } },
                ...(opts.lettrage.reglements ?? []).map((r) => ({
                    debit: 0,
                    credit: r.montant,
                    ecriture: { date: new Date(r.date) },
                })),
            ],
        }
        : null;
    return {
        id: `v-${opts.compte}-${opts.date}`,
        tauxTvaId: TAUX.id,
        compte: { numero: opts.compte },
        debit: 0,
        credit: opts.tva,
        ecriture: {
            date: new Date(opts.date),
            lignes: [
                {
                    debit: opts.creance,
                    credit: 0,
                    compte: { numero: '41100000', classe: 'CLASSE_4', tiersCompte: rattachement(opts.client ?? null) },
                    lettrage: groupe,
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
const JUIN = new Date('2026-06-01');
const FIN_JUIN = new Date('2026-06-30T23:59:59.999Z');
const impayee = (montant) => ({ statut: 'PARTIEL', solde: montant, soldeAt: null, reglements: [] });
const payeeEnJuin = (montant) => ({
    statut: 'SOLDE',
    solde: 0,
    soldeAt: new Date('2026-09-30'),
    reglements: [{ date: '2026-06-12', montant }],
});
const AUTORISE = { autorise: true, reference: 'DGI/DIR.GEN/2025/1142' };
const AUTORISE_SANS_REFERENCE = { autorise: true };
const NON_RENSEIGNE = { autorise: false };
describe('Fournisseur autorisé aux débits · la déduction naît à la facture (art. 26, 37 al. 1)', () => {
    it('une PRESTATION reçue d’un fournisseur autorisé se déduit DÈS LA FACTURE, sans attendre le paiement', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: payeeEnJuin(1_160_000),
                fournisseurs: [AUTORISE],
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(160_000);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalDeductible).toBe(0);
    });
    it('une facture IMPAYÉE d’un fournisseur autorisé se déduit quand même · la taxe lui est déjà exigible', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44530000',
                date: '2026-03-10',
                tva: 48_000,
                dette: 348_000,
                lettrage: impayee(348_000),
                fournisseurs: [AUTORISE],
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(48_000);
    });
    it('la déclaration NOMME cette anticipation, avec l’article qui l’autorise', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: impayee(1_160_000),
                fournisseurs: [AUTORISE],
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.mentionExigibilite).toContain('FOURNISSEURS AUTORISÉS AUX DÉBITS');
        expect(d.mentionExigibilite).toContain((160_000).toLocaleString('fr-FR'));
        expect(d.mentionExigibilite).toContain('art. 26');
        expect(d.mentionExigibilite).toContain('art. 61');
        expect(d.mentionExigibilite).not.toContain('DÉDUCTION SUR SERVICES');
    });
    it('une autorisation SANS RÉFÉRENCE de décision est appliquée, mais signalée', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: impayee(1_160_000),
                fournisseurs: [AUTORISE_SANS_REFERENCE],
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(160_000);
        expect(d.mentionExigibilite).toContain('AUTORISATION AUX DÉBITS SANS RÉFÉRENCE');
        const avec = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: impayee(1_160_000),
                fournisseurs: [AUTORISE],
            }),
        ]);
        expect((await avec.declaration('t1', MARS, FIN_MARS)).mentionExigibilite).not.toContain('AUTORISATION AUX DÉBITS SANS RÉFÉRENCE');
    });
});
describe('Ce que l’autorisation ne déplace PAS', () => {
    it('un ACHAT DE BIENS chez un fournisseur autorisé reste au fait générateur, et n’est pas compté comme anticipé', async () => {
        const s = service('ENCAISSEMENTS', [
            achat({
                compte: '44520000',
                date: '2026-03-10',
                tva: 400_000,
                dette: 2_900_000,
                lettrage: impayee(2_900_000),
                fournisseurs: [AUTORISE],
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(400_000);
        expect(d.mentionExigibilite).not.toContain('FOURNISSEURS AUTORISÉS AUX DÉBITS');
    });
    it('un CLIENT coché « autorisé aux débits » n’avance pas la TVA COLLECTÉE de son vendeur', async () => {
        const s = service('LIVRAISONS', [
            vente({
                compte: '44320000',
                date: '2026-03-10',
                tva: 320_000,
                creance: 2_320_000,
                lettrage: payeeEnJuin(2_320_000),
                client: AUTORISE,
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalCollecte).toBe(0);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalCollecte).toBe(320_000);
    });
    it('un compte de TVA dont la nature est INDÉTERMINÉE reste au repli déclaré, autorisation ou non', async () => {
        const s = service('ENCAISSEMENTS', [
            achat({
                compte: '44510000',
                date: '2026-03-10',
                tva: 3_200_000,
                dette: 23_200_000,
                lettrage: impayee(23_200_000),
                fournisseurs: [AUTORISE],
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('REPLI DÉCLARÉ');
        expect(d.mentionExigibilite).not.toContain('FOURNISSEURS AUTORISÉS AUX DÉBITS');
    });
});
describe('« Non renseigné » n’est pas « non autorisé » · le module continue de dire qu’il ne peut pas savoir', () => {
    it('un fournisseur NON RENSEIGNÉ garde exactement le traitement d’hier · droit commun et avertissement', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: payeeEnJuin(1_160_000),
                fournisseurs: [NON_RENSEIGNE],
            }),
        ]);
        const mars = await s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalDeductible).toBe(0);
        expect((await s.declaration('t1', JUIN, FIN_JUIN)).totalDeductible).toBe(160_000);
        expect(mars.mentionExigibilite).toContain('DÉDUCTION SUR SERVICES');
        expect(mars.mentionExigibilite).toContain('ne PEUT pas');
        expect(mars.mentionExigibilite).toContain('article 37 al. 1');
        expect(mars.mentionExigibilite).toContain('art. 96');
        expect(mars.mentionExigibilite).toContain('art. 60');
    });
    it('une contrepartie de tiers NON RATTACHÉE ne nomme aucun fournisseur · droit commun', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: payeeEnJuin(1_160_000),
                fournisseurs: [null],
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('DÉDUCTION SUR SERVICES');
    });
    it('deux fournisseurs sur la même écriture, dont un seul autorisé · le module ne tranche pas', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: payeeEnJuin(1_160_000),
                fournisseurs: [AUTORISE, NON_RENSEIGNE],
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('DÉDUCTION SUR SERVICES');
        expect(d.mentionExigibilite).not.toContain('FOURNISSEURS AUTORISÉS AUX DÉBITS');
    });
    it('deux fournisseurs TOUS DEUX autorisés · la réponse est la même quel qu’il soit', async () => {
        const s = service('LIVRAISONS', [
            achat({
                compte: '44540000',
                date: '2026-03-10',
                tva: 160_000,
                dette: 1_160_000,
                lettrage: payeeEnJuin(1_160_000),
                fournisseurs: [AUTORISE, AUTORISE],
            }),
        ]);
        expect((await s.declaration('t1', MARS, FIN_MARS)).totalDeductible).toBe(160_000);
    });
});
//# sourceMappingURL=tva-debits-fournisseur-art26.spec.js.map