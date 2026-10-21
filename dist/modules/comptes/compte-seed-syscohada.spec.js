"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
const compte_seed_1 = require("./compte-seed");
const compte_service_1 = require("./compte.service");
const famille_immobilisation_seed_1 = require("../immobilisations/famille-immobilisation-seed");
const taux_tva_seed_1 = require("../tva/taux-tva-seed");
const journal_seed_1 = require("../journaux/journal-seed");
describe('plan SYSCOHADA · structure Total/Détail', () => {
    const totaux = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte === 'TOTAL');
    const detail = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL');
    it('reprend le plan officiel, contreparties d’engagements développées au 4e chiffre', () => {
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA).toHaveLength(1441);
        expect(totaux).toHaveLength(311);
        expect(detail).toHaveLength(1130);
    });
    it('ne porte aucun doublon de numéro', () => {
        const numeros = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => c.numero);
        expect(new Set(numeros).size).toBe(numeros.length);
    });
    it('sème les Totaux non complétés (2-3 chiffres) et les Détails complétés à 8 chiffres', () => {
        expect(totaux.every((c) => /^\d{2,3}$/.test(c.numero))).toBe(true);
        expect(detail.every((c) => /^\d{8}$/.test(c.numero))).toBe(true);
    });
    it('chaque Total regroupe au moins un compte Détail réel de sa division', () => {
        const ANALYTIQUE_LIBRE = new Set(['92', '93', '94', '95', '96', '97', '98', '99']);
        for (const t of totaux) {
            const enfants = detail.filter((d) => d.numero.startsWith(t.numero) && d.classe === t.classe);
            if (ANALYTIQUE_LIBRE.has(t.numero)) {
                expect(enfants).toHaveLength(0);
                continue;
            }
            expect(enfants.length).toBeGreaterThan(0);
        }
    });
    it('donne à chaque compte 90xx sa contrepartie 91xx, sans exception', () => {
        const engagements = detail.filter((c) => c.numero.startsWith('90'));
        expect(engagements).toHaveLength(32);
        for (const e of engagements) {
            const contrepartie = detail.find((c) => c.numero === `91${e.numero.slice(2)}`);
            expect({ engagement: e.numero, contrepartie: contrepartie?.numero }).toEqual({
                engagement: e.numero,
                contrepartie: `91${e.numero.slice(2)}`,
            });
        }
        expect(detail.filter((c) => c.numero.startsWith('91'))).toHaveLength(32);
    });
    it('sème les huit divisions 92 à 99 en en-têtes, sans compte d’imputation', () => {
        for (let n = 92; n <= 99; n += 1) {
            const tete = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === String(n));
            expect(tete?.typeCompte).toBe('TOTAL');
            expect(detail.some((c) => c.numero.startsWith(String(n)))).toBe(false);
        }
    });
    it('classe chaque compte selon son premier chiffre', () => {
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.every((c) => c.classe === `CLASSE_${c.numero[0]}`)).toBe(true);
    });
});
describe('plan SYSCOHADA · modes de report à-nouveau', () => {
    const parNumero = new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c]));
    it('bilan (classes 1, 2, 3, 5) au SOLDE, gestion (6, 7, 8) sans report', () => {
        for (const c of compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA) {
            if ('1235'.includes(c.numero[0]))
                expect(c.modeReportANouveau).toBe(client_1.ModeReportANouveau.SOLDE);
            if ('678'.includes(c.numero[0]))
                expect(c.modeReportANouveau).toBe(client_1.ModeReportANouveau.AUCUN);
        }
    });
    it('tiers lettrés (40, 41, 45, 46, 47) au DÉTAIL, autres divisions de la classe 4 au SOLDE', () => {
        for (const c of compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((x) => x.numero[0] === '4')) {
            const attendu = ['40', '41', '45', '46', '47'].includes(c.numero.slice(0, 2))
                ? client_1.ModeReportANouveau.DETAIL
                : client_1.ModeReportANouveau.SOLDE;
            expect(c.modeReportANouveau).toBe(attendu);
        }
    });
    it('engagements hors bilan (classe 9) au SOLDE, comme la classe 9 du SYCEBNL', () => {
        expect(parNumero.get('90').modeReportANouveau).toBe(client_1.ModeReportANouveau.SOLDE);
        expect(parNumero.get('90110000').modeReportANouveau).toBe(client_1.ModeReportANouveau.SOLDE);
    });
});
describe('plan SYSCOHADA · ancrage des semis annexes', () => {
    const imputation = new Set(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL').map((c) => c.numero));
    it('journaux par défaut · banque commune (5211), caisse propre au référentiel (5711 et non 5710)', () => {
        for (const j of (0, journal_seed_1.journauxDefaut)('SYSCOHADA')) {
            if (j.numeroCompteTresorerie)
                expect(imputation.has(j.numeroCompteTresorerie)).toBe(true);
        }
        expect((0, journal_seed_1.journauxDefaut)('SYSCOHADA').find((j) => j.code === 'CA').numeroCompteTresorerie).toBe('57110000');
        expect((0, journal_seed_1.journauxDefaut)('SYCEBNL').find((j) => j.code === 'CA').numeroCompteTresorerie).toBe('57100000');
    });
    it('taux de TVA · collecte sur 4431, déductible sur 4452 (le 4451 SYSCOHADA est réservé aux immobilisations)', () => {
        for (const t of (0, taux_tva_seed_1.tauxTvaDefaut)('SYSCOHADA')) {
            if (t.numeroCompteCollecte)
                expect(imputation.has(t.numeroCompteCollecte)).toBe(true);
            if (t.numeroCompteDeductible) {
                expect(t.numeroCompteDeductible).toBe('44520000');
                expect(imputation.has(t.numeroCompteDeductible)).toBe(true);
            }
        }
        expect((0, taux_tva_seed_1.tauxTvaDefaut)('SYCEBNL')[0].numeroCompteDeductible).toBe('44510000');
    });
    it("familles d'immobilisations · immobilisation, amortissement et dotation existent tous", () => {
        for (const f of famille_immobilisation_seed_1.FAMILLES_IMMOBILISATION_DEFAUT_SYSCOHADA) {
            expect(imputation.has(f.numeroCompteImmobilisation)).toBe(true);
            expect(imputation.has(f.numeroCompteAmortissement)).toBe(true);
            expect(imputation.has(f.numeroCompteDotation)).toBe(true);
        }
    });
    it('mobilier en 2444 et amortissement des agencements en 2834 · les deux divergences vérifiées', () => {
        const mobilier = famille_immobilisation_seed_1.FAMILLES_IMMOBILISATION_DEFAUT_SYSCOHADA.find((f) => f.code === 'MOBILIER');
        expect(mobilier.numeroCompteImmobilisation).toBe('24440000');
        const agencements = famille_immobilisation_seed_1.FAMILLES_IMMOBILISATION_DEFAUT_SYSCOHADA.find((f) => f.code === 'AGENCEMENTS');
        expect(agencements.numeroCompteAmortissement).toBe('28340000');
    });
});
describe('CompteService.seedPlan · aiguillage par référentiel', () => {
    function serviceCapturant() {
        const captures = [];
        const passages = [];
        const prisma = {
            compte: {
                createMany: async (args) => void captures.push(args),
                findUnique: async () => ({ lettrable: true, modeReportANouveau: 'DETAIL' }),
                findMany: async () => [],
                create: async ({ data }) => {
                    passages.push(data.numero);
                    return { id: data.numero, ...data };
                },
            },
            compteVirementFonds: { findMany: async () => [], create: async () => ({}) },
            tenant: { findUniqueOrThrow: async () => ({ referentiel: 'SYSCOHADA', longueurCompte: 8 }) },
        };
        return { service: new compte_service_1.CompteService(prisma), captures, passages };
    }
    it('ouvre les quatre comptes de passage des virements de fonds sous le 585, dans les deux plans', async () => {
        const { service, captures, passages } = serviceCapturant();
        await service.seedPlan('t1', 'SYSCOHADA');
        await service.seedPlan('t2', 'SYCEBNL');
        expect(captures[0].data.some((c) => c.numero === '58500000')).toBe(true);
        expect(captures[1].data.some((c) => c.numero === '58500000')).toBe(true);
        expect(passages).toEqual(['58500001', '58500002', '58500003', '58500004', '58500001', '58500002', '58500003', '58500004']);
    });
    it('sème le plan SYSCOHADA pour un dossier SYSCOHADA, le SYCEBNL sinon', async () => {
        const { service, captures } = serviceCapturant();
        await service.seedPlan('t1', 'SYSCOHADA');
        await service.seedPlan('t2', 'SYCEBNL');
        expect(captures[0].data).toHaveLength(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.length);
        expect(captures[1].data).toHaveLength(compte_seed_1.PLAN_COMPTES_SYCEBNL.length);
        expect(captures[0].data.some((c) => c.numero === '10120000')).toBe(true);
        expect(captures[1].data.some((c) => c.numero === '10120000')).toBe(false);
        expect(captures[1].data.some((c) => c.numero === '10490000')).toBe(true);
        expect(captures[0].data.some((c) => c.numero === '10490000')).toBe(false);
    });
    it('ouvre le lettrage sur les tiers Détail et jamais sur un Total', async () => {
        const { service, captures } = serviceCapturant();
        await service.seedPlan('t1', 'SYSCOHADA');
        const fournisseurs = captures[0].data.find((c) => c.numero === '40110000');
        expect(fournisseurs.lettrable).toBe(true);
        const totalFournisseurs = captures[0].data.find((c) => c.numero === '401');
        expect(totalFournisseurs.lettrable).toBe(false);
        const banque = captures[0].data.find((c) => c.numero === '52110000');
        expect(banque.lettrable).toBe(false);
    });
});
describe("T1 · l'INPP et l'ONEM vont au 64 contre le 4428, DANS LES DEUX référentiels", () => {
    const SEMIS = (0, node_path_1.join)(__dirname);
    const sources = {
        SYCEBNL: (0, node_fs_1.readFileSync)((0, node_path_1.join)(SEMIS, 'compte-seed.ts'), 'utf8'),
        SYSCOHADA: (0, node_fs_1.readFileSync)((0, node_path_1.join)(SEMIS, 'compte-seed-syscohada.ts'), 'utf8'),
    };
    it("ne sème plus ni 43340000 ni 43350000 · ni au SYSCOHADA ni au SYCEBNL", () => {
        for (const numero of ['43340000', '43350000']) {
            expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === numero)).toBeUndefined();
            expect(compte_seed_1.PLAN_COMPTES_SYCEBNL.find((c) => c.numero === numero)).toBeUndefined();
            expect(sources.SYSCOHADA).not.toContain(`'${numero}'`);
            expect(sources.SYCEBNL).not.toContain(`'${numero}'`);
        }
    });
    it('sème 64130000, 64150000 et 44280000 aux deux plans, imputables', () => {
        for (const numero of ['64130000', '64150000', '44280000']) {
            const sys = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === numero);
            const syc = compte_seed_1.PLAN_COMPTES_SYCEBNL.find((c) => c.numero === numero);
            expect(sys).toBeDefined();
            expect(syc).toBeDefined();
            expect(sys.typeCompte).toBeUndefined();
            expect(syc.typeCompte).toBeUndefined();
        }
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === '64130000').intitule).toBe('Taxes sur appointements et salaires');
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === '64150000').intitule).toBe('Formation professionnelle continue');
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === '44280000').intitule).toBe('Autres impôts et taxes');
    });
});
//# sourceMappingURL=compte-seed-syscohada.spec.js.map