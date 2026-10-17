"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };
function service(achats, referentiel = 'SYSCOHADA') {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                if (!compte?.OR)
                    return Promise.resolve([]);
                return Promise.resolve(achats.map((a) => ({
                    id: `l-${a.date}`,
                    tauxTvaId: TAUX.id,
                    compte: { numero: a.numero ?? '44520000' },
                    debit: a.tva,
                    credit: 0,
                    ecriture: {
                        date: new Date(a.date),
                        lignes: a.charges.map((c) => ({
                            debit: c.debit,
                            credit: 0,
                            compte: { numero: c.numero, classe: 'CLASSE_6' },
                            lettrage: null,
                        })),
                    },
                })));
            }),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    return new taux_tva_service_1.TauxTvaService(prisma, {});
}
const MARS = new Date('2026-03-01');
const FIN_MARS = new Date('2026-03-31T23:59:59.999Z');
describe('Article 41 · ce que le plan de comptes établit est ÉCARTÉ de la déduction', () => {
    it('la TVA sur RÉCEPTIONS (6383) n’ouvre pas droit à déduction', async () => {
        const s = service([{ date: '2026-03-10', tva: 160_000, charges: [{ numero: '63830000', debit: 1_000_000 }] }]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.tvaExclueArt41).toBe(160_000);
        expect(d.mentionExigibilite).toContain('EXCLUSIONS DE L’ARTICLE 41');
    });
    it('la TVA sur MISSIONS (6384) et sur VOYAGES ET DÉPLACEMENTS (6181) non plus', async () => {
        const s = service([
            { date: '2026-03-10', tva: 80_000, charges: [{ numero: '63840000', debit: 500_000 }] },
            { date: '2026-03-12', tva: 48_000, charges: [{ numero: '61810000', debit: 300_000 }] },
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.tvaExclueArt41).toBe(128_000);
    });
    it('un ACHAT ORDINAIRE reste intégralement déductible', async () => {
        const s = service([{ date: '2026-03-10', tva: 320_000, charges: [{ numero: '60110000', debit: 2_000_000 }] }]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(320_000);
        expect(d.tvaExclueArt41).toBe(0);
    });
    it('une facture MIXTE répartit la taxe au prorata de ses charges', async () => {
        const s = service([
            {
                date: '2026-03-10',
                tva: 160_000,
                charges: [
                    { numero: '60110000', debit: 750_000 },
                    { numero: '63830000', debit: 250_000 },
                ],
            },
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.tvaExclueArt41).toBe(40_000);
        expect(d.totalDeductible).toBe(120_000);
    });
    it('annonce l’exception des professionnels du tourisme, de la restauration et du spectacle', async () => {
        const s = service([{ date: '2026-03-10', tva: 160_000, charges: [{ numero: '63830000', debit: 1_000_000 }] }]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.mentionExigibilite).toContain('professionnels du tourisme');
        expect(d.mentionExigibilite).toContain('réintégrez');
    });
});
describe('Ce que le compte ne tranche pas · avertir, jamais deviner', () => {
    it('les CADEAUX À LA CLIENTÈLE (6276) restent déduits, et sont NOMMÉS · art. 41, 7°', async () => {
        const s = service([{ date: '2026-03-10', tva: 96_000, charges: [{ numero: '62760000', debit: 600_000 }] }]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(96_000);
        expect(d.tvaExclueArt41).toBe(0);
        expect(d.tvaAVerifierArt41).toBe(96_000);
        expect(d.mentionExigibilite).toContain('À VÉRIFIER, ARTICLES 41 ET 42');
        expect(d.mentionExigibilite).toContain('10.000,00 Francs congolais');
        expect(d.mentionExigibilite).toContain('art. 107');
        expect(d.mentionExigibilite).toContain('EST saisie sur la');
        expect(d.mentionExigibilite).not.toContain('n’est nulle part dans le modèle');
    });
    it('le TRANSPORT DU PERSONNEL (6140) aussi · art. 42, 2° le réserve au contrat permanent', async () => {
        const s = service([{ date: '2026-03-10', tva: 32_000, charges: [{ numero: '61400000', debit: 200_000 }] }]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(32_000);
        expect(d.tvaAVerifierArt41).toBe(32_000);
        expect(d.mentionExigibilite).toContain('contrat permanent');
    });
    it('une TVA sans contrepartie de charge · le VÉHICULE DE TOURISME de l’art. 42, 1° est annoncé', async () => {
        const s = service([{ numero: '44510000', date: '2026-03-10', tva: 4_800_000, charges: [] }]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(4_800_000);
        expect(d.tvaNatureDepenseIllisible).toBe(4_800_000);
        expect(d.mentionExigibilite).toContain('NATURE DE LA DÉPENSE NON LISIBLE');
        expect(d.mentionExigibilite).toContain('transport des personnes');
    });
    it('un dossier SYCEBNL exclut ses RÉCEPTIONS comme un dossier SYSCOHADA · le plan les sème', async () => {
        const s = service([{ date: '2026-03-10', tva: 160_000, charges: [{ numero: '63830000', debit: 1_000_000 }] }], 'SYCEBNL');
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.tvaExclueArt41).toBe(160_000);
        expect(d.mentionExigibilite).toContain('EXCLUSIONS DE L’ARTICLE 41');
    });
    it('et ses MISSIONS et VOYAGES de même', async () => {
        for (const numero of ['63840000', '61810000']) {
            const s = service([{ date: '2026-03-10', tva: 160_000, charges: [{ numero, debit: 1_000_000 }] }], 'SYCEBNL');
            const d = await s.declaration('t1', MARS, FIN_MARS);
            expect(d.totalDeductible).toBe(0);
            expect(d.tvaExclueArt41).toBe(160_000);
        }
    });
    it('un compte VRAIMENT agrégé (63800000) n’exclut toujours rien, et n’est plus expliqué à tort', async () => {
        const s = service([{ date: '2026-03-10', tva: 160_000, charges: [{ numero: '63800000', debit: 1_000_000 }] }], 'SYCEBNL');
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(160_000);
        expect(d.tvaExclueArt41).toBe(0);
        expect(d.tvaNatureDepenseIllisible).toBe(0);
    });
    it('les PRODUITS PÉTROLIERS (6042) sont comptés et nommés, jamais amputés d’un pourcentage', async () => {
        for (const referentiel of ['SYSCOHADA', 'SYCEBNL']) {
            const s = service([{ date: '2026-03-10', tva: 160_000, charges: [{ numero: '60420000', debit: 1_000_000 }] }], referentiel);
            const d = await s.declaration('t1', MARS, FIN_MARS);
            expect(d.totalDeductible).toBe(160_000);
            expect(d.tvaExclueArt41).toBe(0);
            expect(d.tvaAVerifierArt41).toBe(160_000);
            expect(d.mentionExigibilite).toContain('produits pétroliers');
            expect(d.mentionExigibilite).toContain('50 %');
        }
    });
});
//# sourceMappingURL=tva-exclusions-art41.spec.js.map