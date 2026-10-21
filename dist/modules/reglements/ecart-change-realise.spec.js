"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAS_NATURE = exports.CAS_ADMIS = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const ecart_change_realise_1 = require("./ecart-change-realise");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const reglements_service_1 = require("./reglements.service");
const reglements_dto_1 = require("./reglements.dto");
const reevaluationModule = require("./reevaluation-et-ecart-realise");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
const report_a_nouveau_1 = require("../exercice/report-a-nouveau");
const COURS_FACTURE = 1680;
const HT_FRANCS = 1000 * COURS_FACTURE;
const TVA_FRANCS = Math.round(HT_FRANCS * 0.16 * 100) / 100;
const TTC_USD = 1160;
const TTC_FRANCS = HT_FRANCS + TVA_FRANCS;
describe('le jeu d’essai du séminaire, TVA corrigée', () => {
    it('16 % de 1 680 000 font 268 800, et le TTC est 1 160 USD au cours de 1 680', () => {
        expect(TVA_FRANCS).toBe(268800);
        expect(TTC_FRANCS).toBe(1948800);
        expect(TTC_USD * COURS_FACTURE).toBe(TTC_FRANCS);
    });
});
describe('les comptes que le texte donne', () => {
    it('SYSCOHADA · 656 et 756 pour le commercial, 676 et 776 pour le financier', () => {
        expect((0, ecart_change_realise_1.comptesPrescrits)('SYSCOHADA', 'COMMERCIALE')).toEqual({ perte: '65600000', gain: '75600000' });
        expect((0, ecart_change_realise_1.comptesPrescrits)('SYSCOHADA', 'FINANCIERE')).toEqual({ perte: '67600000', gain: '77600000' });
    });
    it('SYCEBNL · 676 et 776 pour le financier, 658 et 7588 pour le commercial, semés', () => {
        expect((0, ecart_change_realise_1.comptesPrescrits)('SYCEBNL', 'FINANCIERE')).toEqual({ perte: '67600000', gain: '77600000' });
        expect((0, ecart_change_realise_1.comptesPrescrits)('SYCEBNL', 'COMMERCIALE')).toEqual({ perte: '65800000', gain: '75880000' });
        const sycebnl = new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c.intitule]));
        expect(sycebnl.get('65800000')).toBe('Charges diverses');
        expect(sycebnl.get('75880000')).toMatch(/Produits divers · autres/);
    });
    it('la nature se lit sur le compte · 40 et 41 commerciaux, emprunts et prêts financiers, le reste au cabinet', () => {
        for (const r of ['SYSCOHADA', 'SYCEBNL']) {
            expect((0, ecart_change_realise_1.natureDuCompte)('40110000', r)).toBe('COMMERCIALE');
            expect((0, ecart_change_realise_1.natureDuCompte)('41110000', r)).toBe('COMMERCIALE');
            expect((0, ecart_change_realise_1.natureDuCompte)('27100000', r)).toBe('FINANCIERE');
            expect((0, ecart_change_realise_1.natureDuCompte)('47100000', r)).toBeNull();
        }
        expect((0, ecart_change_realise_1.natureDuCompte)('16200000', 'SYSCOHADA')).toBe('FINANCIERE');
        expect((0, ecart_change_realise_1.natureDuCompte)('18200000', 'SYCEBNL')).toBe('FINANCIERE');
    });
    it('le 16 du SYCEBNL est un fonds, le 18 du SYSCOHADA une liaison · ni l’un ni l’autre n’est un emprunt', () => {
        expect((0, ecart_change_realise_1.natureDuCompte)('16200000', 'SYCEBNL')).toBeNull();
        expect((0, ecart_change_realise_1.natureDuCompte)('18400000', 'SYSCOHADA')).toBeNull();
        const sycebnl = new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c.intitule]));
        expect(sycebnl.get('16')).toMatch(/fonds affect/i);
        expect(sycebnl.get('18')).toMatch(/emprunts/i);
        const syscohada = new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c.intitule]));
        expect(syscohada.get('16')).toMatch(/emprunts/i);
    });
    it('les deux semis · le SYSCOHADA ouvre 656, 756, 676, 776 ; le SYCEBNL 676 et 776 seulement', () => {
        const syscohada = new Set(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => c.numero));
        const sycebnl = new Set(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => c.numero));
        for (const n of ['65600000', '75600000', '67600000', '77600000'])
            expect(syscohada.has(n)).toBe(true);
        for (const n of ['67600000', '77600000'])
            expect(sycebnl.has(n)).toBe(true);
        for (const n of ['656', '65600000', '756', '75600000'])
            expect(sycebnl.has(n)).toBe(false);
        expect([...sycebnl].some((n) => n.startsWith('656') || n.startsWith('756'))).toBe(false);
    });
    it('le compte choisi au SYCEBNL · le 658 ou le 7588 et leurs sous-comptes, jamais les autres subdivisions des fiches 65 et 75', () => {
        const p = { referentiel: 'SYCEBNL', nature: 'COMMERCIALE' };
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'PERTE', numero: '65800000' })).toBeNull();
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'PERTE', numero: '65810000' })).toBeNull();
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'GAIN', numero: '75880000' })).toBeNull();
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'PERTE', numero: '67600000' })).toMatch(/réservé par le SYCEBNL aux opérations à caractère financier/);
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'GAIN', numero: '77600000' })).toMatch(/réservé par le SYCEBNL/);
        for (const n of ['65110000', '65200000', '65410000', '65700000', '65910000']) {
            expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'PERTE', numero: n })).toMatch(/se passe sous le 658/);
        }
        for (const n of ['75100000', '75200000', '75420000', '75820000', '75830000', '75910000']) {
            expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'GAIN', numero: n })).toMatch(/se passe sous le 7588/);
        }
    });
    it('le compte choisi au SYSCOHADA · dans la racine que le texte donne, sous-comptes admis', () => {
        const p = { referentiel: 'SYSCOHADA', nature: 'COMMERCIALE' };
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'PERTE', numero: '65610000' })).toBeNull();
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'PERTE', numero: '67600000' })).toMatch(/se passe sous le 656/);
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ ...p, ecart: 'GAIN', numero: '77600000' })).toMatch(/Un gain de change .* se passe sous le 756/);
    });
});
exports.CAS_ADMIS = [
    ['SYSCOHADA', 'COMMERCIALE', 'PERTE', '65610000', true],
    ['SYSCOHADA', 'COMMERCIALE', 'PERTE', '67600000', false],
    ['SYSCOHADA', 'FINANCIERE', 'GAIN', '77600000', true],
    ['SYSCOHADA', 'FINANCIERE', 'GAIN', '75600000', false],
    ['SYSCOHADA', null, 'PERTE', '65600000', true],
    ['SYSCOHADA', null, 'PERTE', '67600000', true],
    ['SYSCOHADA', null, 'PERTE', '60110000', false],
    ['SYSCOHADA', null, 'PERTE', '65800000', false],
    ['SYSCOHADA', null, 'GAIN', '77600000', true],
    ['SYCEBNL', 'COMMERCIALE', 'PERTE', '65800000', true],
    ['SYCEBNL', 'COMMERCIALE', 'PERTE', '65110000', false],
    ['SYCEBNL', 'COMMERCIALE', 'PERTE', '65700000', false],
    ['SYCEBNL', 'COMMERCIALE', 'PERTE', '65910000', false],
    ['SYCEBNL', 'COMMERCIALE', 'PERTE', '67600000', false],
    ['SYCEBNL', 'COMMERCIALE', 'GAIN', '75880000', true],
    ['SYCEBNL', 'COMMERCIALE', 'GAIN', '75820000', false],
    ['SYCEBNL', 'COMMERCIALE', 'GAIN', '75200000', false],
    ['SYCEBNL', 'COMMERCIALE', 'GAIN', '75910000', false],
    ['SYCEBNL', 'FINANCIERE', 'PERTE', '67600000', true],
    ['SYCEBNL', 'FINANCIERE', 'PERTE', '65800000', false],
    ['SYCEBNL', null, 'PERTE', '65800000', true],
    ['SYCEBNL', null, 'PERTE', '67600000', true],
    ['SYCEBNL', null, 'PERTE', '60110000', false],
    ['SYCEBNL', null, 'GAIN', '77600000', true],
    ['SYCEBNL', null, 'GAIN', '75880000', true],
    ['SYCEBNL', null, 'GAIN', '75100000', false],
    ['SYCEBNL', null, 'GAIN', '75910000', false],
    ['SYSCOHADA', 'FINANCIERE', 'PERTE', '65600000', false],
    ['SYSCOHADA', 'FINANCIERE', 'PERTE', '67600000', true],
    ['SYSCOHADA', null, 'GAIN', '75600000', true],
    ['SYSCOHADA', null, 'GAIN', '75800000', false],
];
exports.CAS_NATURE = [
    ['SYSCOHADA', '40110000', 'COMMERCIALE'],
    ['SYSCOHADA', '40410000', 'FINANCIERE'],
    ['SYSCOHADA', '40470000', 'FINANCIERE'],
    ['SYSCOHADA', '48120000', 'FINANCIERE'],
    ['SYSCOHADA', '41110000', 'COMMERCIALE'],
    ['SYSCOHADA', '41420000', null],
    ['SYSCOHADA', '16200000', 'FINANCIERE'],
    ['SYCEBNL', '40110000', 'COMMERCIALE'],
    ['SYCEBNL', '41200000', 'COMMERCIALE'],
    ['SYCEBNL', '16200000', null],
    ['SYCEBNL', '18710000', 'FINANCIERE'],
];
describe('les comptes admis pour l’écart, serveur et écran sur une seule table', () => {
    it.each(exports.CAS_ADMIS)('%s, nature %s, %s · %s admis : %s', (referentiel, nature, ecart, numero, admis) => {
        expect((0, ecart_change_realise_1.compteAdmisPourEcart)((0, ecart_change_realise_1.racinesAdmises)(referentiel, nature, ecart), numero)).toBe(admis);
        expect((0, ecart_change_realise_1.motifRefusCompteEcart)({ referentiel, nature, ecart, numero }) === null).toBe(admis);
    });
    it.each(exports.CAS_NATURE)('%s · %s · nature %s', (referentiel, numero, nature) => {
        expect((0, ecart_change_realise_1.natureDuCompte)(numero, referentiel)).toBe(nature);
    });
    it('le 404 et le 414 tels que les semis les ouvrent · le SYCEBNL n’en a aucun', () => {
        const syscohada = new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c.intitule]));
        expect(syscohada.get('404')).toMatch(/acquisitions courantes d.immobilisations/i);
        expect(syscohada.get('414')).toMatch(/cessions courantes d.immobilisations/i);
        expect(compte_seed_1.PLAN_COMPTES_SYCEBNL.some((c) => c.numero.startsWith('404') || c.numero.startsWith('414'))).toBe(false);
    });
    it('la nature lue · 17 et 481 au SYSCOHADA, 187 et 481 au SYCEBNL sont financiers ; le 17 du SYCEBNL est un fonds', () => {
        expect((0, ecart_change_realise_1.natureDuCompte)('17200000', 'SYSCOHADA')).toBe('FINANCIERE');
        expect((0, ecart_change_realise_1.natureDuCompte)('48120000', 'SYSCOHADA')).toBe('FINANCIERE');
        expect((0, ecart_change_realise_1.natureDuCompte)('18710000', 'SYCEBNL')).toBe('FINANCIERE');
        expect((0, ecart_change_realise_1.natureDuCompte)('48120000', 'SYCEBNL')).toBe('FINANCIERE');
        expect((0, ecart_change_realise_1.natureDuCompte)('17100000', 'SYCEBNL')).toBeNull();
        expect((0, ecart_change_realise_1.natureDuCompte)('48500000', 'SYSCOHADA')).toBeNull();
        const sycebnl = new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c.intitule]));
        const syscohada = new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c.intitule]));
        expect(syscohada.get('17')).toMatch(/location acquisition/i);
        expect(sycebnl.get('17')).toMatch(/fonds report/i);
        expect(sycebnl.get('187')).toMatch(/location-acquisition/i);
        expect(syscohada.get('481')).toMatch(/investissement/i);
        expect(sycebnl.get('481')).toMatch(/investissement/i);
    });
    it('le libellé s’accorde · « Perte de change réalisée », « Gain de change réalisé »', () => {
        expect((0, ecart_change_realise_1.libelleEcartRealise)(1)).toBe('Perte de change réalisée');
        expect((0, ecart_change_realise_1.libelleEcartRealise)(-1)).toBe('Gain de change réalisé');
    });
    it('ni cours ni débit saisi · refus, jamais un cours deviné', () => {
        expect((0, ecart_change_realise_1.coursEtFrancsDuReglement)({ montantDevise: 600, tolerance: () => true })).toHaveProperty('motif');
    });
    it('rien de nul ni de négatif · francs, cours saisi ou déduit, montant en devise', () => {
        const t = () => true;
        for (const francs of [0, -600, null, Number.NaN, 0.004]) {
            expect((0, ecart_change_realise_1.coursEtFrancsDuReglement)({ montantDevise: 600, francs, tolerance: t })).toEqual({ motif: expect.stringMatching(/francs doit être strictement positif/) });
        }
        for (const cours of [0, -1, null, Number.NaN]) {
            expect((0, ecart_change_realise_1.coursEtFrancsDuReglement)({ montantDevise: 600, cours, tolerance: t })).toEqual({ motif: expect.stringMatching(/cours du jour du règlement doit être strictement positif/) });
        }
        expect((0, ecart_change_realise_1.coursEtFrancsDuReglement)({ montantDevise: 0.01, cours: 0.1, tolerance: t })).toEqual({ motif: expect.stringMatching(/francs doit être/) });
        expect((0, ecart_change_realise_1.coursEtFrancsDuReglement)({ montantDevise: 1_000_000, francs: 0.01, tolerance: t })).toEqual({ motif: expect.stringMatching(/cours du jour/) });
        for (const montantDevise of [0, -600, Number.NaN]) {
            expect((0, ecart_change_realise_1.coursEtFrancsDuReglement)({ montantDevise, cours: 1750, tolerance: t })).toEqual({ motif: expect.stringMatching(/devise doit être strictement positif/) });
        }
        expect((0, ecart_change_realise_1.coursEtFrancsDuReglement)({ montantDevise: 600, cours: 1750, tolerance: t })).toEqual({ cours: 1750, francs: 1050000 });
    });
    it('la porte · `montant` facultatif, jamais `null`, zéro ni négatif', async () => {
        const uuid = '0f8fad5b-d9cb-469f-a165-70867728950e';
        const erreurs = async (montant) => (await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(reglements_dto_1.ReglementTiersDto, { compteId: uuid, ligneIds: [uuid], montant }))).map((e) => e.property);
        expect(await erreurs(null)).toEqual(['montant']);
        expect(await erreurs(0)).toEqual(['montant']);
        expect(await erreurs(-600)).toEqual(['montant']);
        expect(await erreurs(1050000)).toEqual([]);
        expect((await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(reglements_dto_1.ReglementTiersDto, { compteId: uuid, ligneIds: [uuid] }))).length).toBe(0);
    });
});
describe('le coût historique de ce qui est réglé (AUDCIF art. 55)', () => {
    const facture = { id: 'f', francs: TTC_FRANCS, montantDevise: TTC_USD, date: new Date('2026-05-15') };
    it('600 USD d’une facture de 1 160 USD à 1 680 éteignent 1 008 000', () => {
        expect((0, ecart_change_realise_1.coutHistoriqueRegle)([facture], 600)).toBe(1008000);
    });
    it('réglée en entier, la facture rend sa contrevaleur d’origine au centime', () => {
        expect((0, ecart_change_realise_1.coutHistoriqueRegle)([{ ...facture, francs: 1000.01, montantDevise: 3 }], 3)).toBe(1000.01);
    });
    it('plusieurs factures · les plus anciennes d’abord, la dernière seule en partie', () => {
        const vieille = { id: 'a', francs: 160000, montantDevise: 100, date: new Date('2026-01-10') };
        const recente = { id: 'b', francs: 340000, montantDevise: 200, date: new Date('2026-03-10') };
        expect((0, ecart_change_realise_1.coutHistoriqueRegle)([recente, vieille], 150)).toBe(245000);
    });
    it('deux factures du même jour · départagées par l’identifiant de ligne, quel que soit l’ordre reçu', () => {
        const a = { id: 'a', francs: 160000, montantDevise: 100, date: new Date('2026-03-10') };
        const b = { id: 'b', francs: 170000, montantDevise: 100, date: new Date('2026-03-10') };
        expect((0, ecart_change_realise_1.coutHistoriqueRegle)([b, a], 100)).toBe(160000);
        expect((0, ecart_change_realise_1.coutHistoriqueRegle)([a, b], 100)).toBe(160000);
        expect((0, ecart_change_realise_1.coutHistoriqueRegle)([b, a], 150)).toBe(245000);
    });
    it('règlements successifs · le premier rend coutHistoriqueRegle, la facture entamée s’épuise au centime', () => {
        const f = { id: 'f', francs: 1000.01, montantDevise: 3, date: new Date('2026-01-10') };
        const g = { id: 'g', francs: 340000, montantDevise: 200, date: new Date('2026-03-10') };
        const couts = (0, ecart_change_realise_1.coutsHistoriquesSuccessifs)([g, f], [1, 2, 100]);
        expect(couts[0]).toBe((0, ecart_change_realise_1.coutHistoriqueRegle)([g, f], 1));
        expect(Math.round((couts[0] + couts[1]) * 100) / 100).toBe(1000.01);
        expect(couts[2]).toBe(170000);
    });
    it('l’écart est signé · positif pour une perte, dans les deux sens de règlement', () => {
        expect((0, ecart_change_realise_1.ecartSigne)('FOURNISSEUR', 1008000, 1050000)).toBe(42000);
        expect((0, ecart_change_realise_1.ecartSigne)('CLIENT', 1008000, 1050000)).toBe(-42000);
        expect((0, ecart_change_realise_1.ecartSigne)('CLIENT', 1008000, 1000000)).toBe(8000);
    });
});
describe('les lignes du règlement en devise', () => {
    const commun = {
        compteTresorerieId: '571',
        historique: 1008000,
        francsPayes: 1050000,
        deviseId: 'usd',
        montantDevise: 600,
        coursReglement: 1750,
        tresorerieEnDevise: false,
        libelle: 'R',
    };
    it('MBIKAYI paie NZUZI · D 401 1 008 000, D 656 42 000, C 571 1 050 000', () => {
        const l = (0, ecart_change_realise_1.lignesDuReglementEnDevise)({ ...commun, sens: 'FOURNISSEUR', compteTiersId: '401', compteEcartId: '656' });
        expect(l.map((x) => [x.compteId, x.debit ?? 0, x.credit ?? 0])).toEqual([
            ['401', 1008000, 0],
            ['656', 42000, 0],
            ['571', 0, 1050000],
        ]);
        expect(l[0]).toMatchObject({ deviseId: 'usd', montantDevise: 600 });
        expect(l[2].deviseId).toBeUndefined();
    });
    it('NZUZI encaisse · D 571 1 050 000, C 411 1 008 000, C 756 42 000', () => {
        const l = (0, ecart_change_realise_1.lignesDuReglementEnDevise)({ ...commun, sens: 'CLIENT', compteTiersId: '411', compteEcartId: '756' });
        expect(l.map((x) => [x.compteId, x.debit ?? 0, x.credit ?? 0])).toEqual([
            ['571', 1050000, 0],
            ['411', 0, 1008000],
            ['756', 0, 42000],
        ]);
    });
    it('la pièce est équilibrée, et la trésorerie en devise porte le cours du jour', () => {
        const l = (0, ecart_change_realise_1.lignesDuReglementEnDevise)({ ...commun, sens: 'FOURNISSEUR', compteTiersId: '401', compteEcartId: '656', tresorerieEnDevise: true });
        const d = l.reduce((s, x) => s + (x.debit ?? 0), 0);
        const c = l.reduce((s, x) => s + (x.credit ?? 0), 0);
        expect(d).toBe(c);
        expect(l.find((x) => x.compteId === '571')).toMatchObject({ deviseId: 'usd', montantDevise: 600, coursApplique: 1750 });
    });
    it('un écart sans compte ne se fabrique pas · la règle s’arrête', () => {
        expect(() => (0, ecart_change_realise_1.lignesDuReglementEnDevise)({ ...commun, sens: 'FOURNISSEUR', compteTiersId: '401', compteEcartId: null })).toThrow();
    });
});
describe('l’écart d’un groupe de lettrage soldé dans sa devise', () => {
    const mbikayi = [
        { debit: 0, credit: TTC_FRANCS, deviseId: 'usd', montantDevise: TTC_USD },
        { debit: 1008000, credit: 0, deviseId: 'usd', montantDevise: 600 },
        { debit: 560 * 1900, credit: 0, deviseId: 'usd', montantDevise: 560 },
    ];
    it('MBIKAYI · perte de 123 200, D 656 / C 401', () => {
        expect((0, ecart_change_realise_1.ecartDuGroupe)(mbikayi)).toEqual({ deviseId: 'usd', ecart: 123200 });
        expect((0, ecart_change_realise_1.lignesEcartDuGroupe)({ compteTiersId: '401', compteEcartId: '656', ecart: 123200, libelle: 'x' })).toEqual([
            { compteId: '656', debit: 123200, libelle: 'x' },
            { compteId: '401', credit: 123200, libelle: 'x' },
        ]);
    });
    it('NZUZI · gain de 123 200, D 411 / C 756', () => {
        const nzuzi = mbikayi.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
        expect((0, ecart_change_realise_1.ecartDuGroupe)(nzuzi)).toEqual({ deviseId: 'usd', ecart: -123200 });
        expect((0, ecart_change_realise_1.lignesEcartDuGroupe)({ compteTiersId: '411', compteEcartId: '756', ecart: -123200, libelle: 'x' })).toEqual([
            { compteId: '411', debit: 123200, libelle: 'x' },
            { compteId: '756', credit: 123200, libelle: 'x' },
        ]);
    });
    it('pas soldé en devise, ou deux devises · aucune proposition', () => {
        expect((0, ecart_change_realise_1.ecartDuGroupe)(mbikayi.slice(0, 2))).toBeNull();
        expect((0, ecart_change_realise_1.ecartDuGroupe)([...mbikayi.slice(0, 2), { ...mbikayi[2], deviseId: 'eur' }])).toBeNull();
        expect((0, ecart_change_realise_1.ecartDuGroupe)([{ debit: 10, credit: 0, deviseId: null, montantDevise: null }])).toBeNull();
    });
});
const CHAMP_CREDIT = { colonne: 'credit' };
function ligneRetenue(l, where) {
    if (where.compteId !== undefined && l.compteId !== where.compteId)
        return false;
    if (where.deviseId !== undefined && l.deviseId !== where.deviseId)
        return false;
    if (where.id?.notIn?.includes(l.id))
        return false;
    if ('lettre' in where && (l.lettre ?? null) !== null)
        return false;
    if ('lettrageId' in where && (l.lettrageId ?? null) !== null)
        return false;
    if (where.ecriture?.exerciceId !== undefined && l.ecriture.exerciceId !== where.ecriture.exerciceId)
        return false;
    if (where.ecriture?.OR && !where.ecriture.OR.some((c) => Object.entries(c).every(([k, v]) => (l.ecriture[k] ?? false) === v)))
        return false;
    const valeur = (b) => (b === CHAMP_CREDIT ? l.credit : Number(b));
    for (const colonne of ['debit', 'credit']) {
        const borne = where[colonne];
        if (!borne)
            continue;
        const x = l[colonne];
        if (borne.gt !== undefined && !(x > valeur(borne.gt)))
            return false;
        if (borne.lt !== undefined && !(x < valeur(borne.lt)))
            return false;
        if (borne.gte !== undefined && !(x >= valeur(borne.gte)))
            return false;
        if (borne.lte !== undefined && !(x <= valeur(borne.lte)))
            return false;
    }
    return true;
}
function monter(referentiel = 'SYSCOHADA', lignesEnPlus = []) {
    const date = new Date('2026-05-15');
    const ecriture = { exerciceId: 'ex', date, journalId: 'jACH', journal: { code: 'ACH' }, exercice: { statut: 'OUVERT' } };
    const lignes = [
        { id: 'fm', compteId: 'c401', debit: 0, credit: TTC_FRANCS, deviseId: 'usd', montantDevise: TTC_USD, lettrageId: null, compte: { numero: '40110000', intitule: 'NZUZI', lettrable: true }, ecriture },
        { id: 'fn', compteId: 'c411', debit: TTC_FRANCS, credit: 0, deviseId: 'usd', montantDevise: TTC_USD, lettrageId: null, compte: { numero: '41110000', intitule: 'MBIKAYI', lettrable: true }, ecriture },
        { id: 'ff', compteId: 'c402', debit: 0, credit: 500, deviseId: null, montantDevise: null, lettrageId: null, compte: { numero: '40120000', intitule: 'Francs', lettrable: true }, ecriture },
        { id: 'fe', compteId: 'c401', debit: 0, credit: 1000, deviseId: null, montantDevise: null, lettrageId: null, compte: { numero: '40110000', intitule: 'NZUZI', lettrable: true }, ecriture },
    ];
    lignes.push(...lignesEnPlus);
    const comptes = [
        { id: 'c656', numero: '65600000', typeCompte: 'DETAIL', estActif: true },
        { id: 'c756', numero: '75600000', typeCompte: 'DETAIL', estActif: true },
        { id: 'c676', numero: '67600000', typeCompte: 'DETAIL', estActif: true },
        { id: 'c658', numero: '65800000', typeCompte: 'DETAIL', estActif: true },
        { id: 'c6561', numero: '65610000', typeCompte: 'DETAIL', estActif: true },
    ].filter((c) => referentiel === 'SYSCOHADA' || !c.numero.startsWith('656') && !c.numero.startsWith('756'));
    const prisma = {
        journal: { findFirst: jest.fn(async () => ({ id: 'bq', code: 'CA', type: 'TRESORERIE', compteTresorerieId: 'c571' })) },
        ligneEcriture: {
            findMany: jest.fn(async ({ where }) => (where.id ? lignes.filter((l) => where.id.in.includes(l.id)) : [])),
            fields: { credit: CHAMP_CREDIT },
            aggregate: jest.fn(async ({ where }) => {
                const retenues = lignes.filter((l) => ligneRetenue(l, where));
                const somme = (f) => (retenues.length > 0 ? retenues.reduce((s, l) => s + f(l), 0) : null);
                return {
                    _sum: {
                        montantDevise: somme((l) => Number(l.montantDevise ?? 0)),
                        debit: somme((l) => l.debit),
                        credit: somme((l) => l.credit),
                    },
                };
            }),
        },
        cloture: { findMany: jest.fn(async () => []) },
        lettrage: {
            findMany: jest.fn(async ({ where }) => {
                const ids = [...new Set(lignes.flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])))];
                return where.tenantId !== 't'
                    ? []
                    : ids
                        .filter((id) => where.id.in.includes(id))
                        .map((id) => {
                        const siennes = lignes.filter((l) => l.lettrageId === id);
                        return { id, code: 'C', statut: 'PARTIEL', verrouille: false, compteId: siennes[0].compteId, lignes: siennes };
                    });
            }),
        },
        tenant: { findFirst: jest.fn(async () => ({ referentiel })) },
        compte: {
            findFirst: jest.fn(async ({ where }) => comptes.find((c) => (where.id ? c.id === where.id : c.numero === where.numero)) ?? null),
            findMany: jest.fn(async ({ where }) => comptes.filter((c) => c.numero.startsWith(where.numero.startsWith) && c.estActif && c.typeCompte === 'DETAIL')),
        },
        devise: {
            findMany: jest.fn(async () => [
                { id: 'usd', code: 'USD' },
                { id: 'eur', code: 'EUR' },
            ]),
        },
        ribBanque: { findFirst: jest.fn(async () => null) },
        creanceDouteuse: { findMany: jest.fn(async () => []) },
        reevaluation: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
        exercice: { findFirst: jest.fn(async () => ({ dateDebut: new Date('2026-01-01') })) },
        coursDevise: { findFirst: jest.fn(async () => ({ cours: 1850 })) },
    };
    let n = 0;
    const creer = jest.fn(async (_t, _u, dto) => {
        n += 1;
        return { id: 'e' + n, numeroPiece: n, lignes: dto.lignes.map((l, i) => ({ ...l, id: `p${n}-${i}` })) };
    });
    const lettrerManuel = jest.fn(async () => ({ lettre: 'a' }));
    const completer = jest.fn(async () => ({ lettre: 'A', statut: 'SOLDE', solde: 0 }));
    const propositionEcartChange = jest.fn();
    const retirerCompensation = jest.fn(async () => undefined);
    const service = new reglements_service_1.ReglementsService(prisma, { creer, retirerCompensation }, { lettrerManuel, completer, propositionEcartChange }, {});
    return { service, creer, lettrerManuel, completer, propositionEcartChange, retirerCompensation, prisma };
}
const base = { exerciceId: 'ex', journalId: 'bq', date: '2026-11-30' };
const resume = (lignes) => lignes.map((l) => [l.compteId, l.debit ?? 0, l.credit ?? 0]);
describe('enregistrer un règlement en devise', () => {
    it('MBIKAYI règle 600 USD au cours de 1 750 · perte de 42 000 au 656, lettrage partiel', async () => {
        const { service, creer, lettrerManuel } = monter();
        const r = await service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750 }],
        });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 1008000, 0],
            ['c656', 42000, 0],
            ['c571', 0, 1050000],
        ]);
        expect(creer.mock.calls[0][2].lignes[0]).toMatchObject({ deviseId: 'usd', montantDevise: 600 });
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['fm', 'p1-0'], 'u', { autoriserPartiel: true, ecartChangeRealise: 42000 });
        expect(creer.mock.calls[0][2].lignes[1].libelle).toMatch(/^Perte de change réalisée · /);
        expect(r.reglements[0]).toMatchObject({ montant: 1050000, partiel: true, montantDevise: 600, ecartChange: 42000 });
    });
    it('NZUZI encaisse 600 USD au cours de 1 750 · gain de 42 000 au 756', async () => {
        const { service, creer } = monter();
        await service.enregistrer('t', 'u', {
            ...base,
            sens: 'CLIENT',
            reglements: [{ compteId: 'c411', ligneIds: ['fn'], montantDevise: 600, coursReglement: 1750 }],
        });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c571', 1050000, 0],
            ['c411', 0, 1008000],
            ['c756', 0, 42000],
        ]);
    });
    it('le dû entier à un cours plus haut passe · le groupe est soldé et garde son écart', async () => {
        const { service, creer, lettrerManuel } = monter();
        const r = await service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            reglements: [{ compteId: 'c401', ligneIds: ['fm'], coursReglement: 1750 }],
        });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 1948800, 0],
            ['c656', 81200, 0],
            ['c571', 0, 2030000],
        ]);
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['fm', 'p1-0'], 'u', { autoriserPartiel: false, ecartChangeRealise: 81200 });
        expect(r.reglements[0].partiel).toBe(false);
    });
    it('même cours · aucune ligne d’écart, et aucun compte demandé', async () => {
        const { service, creer, prisma } = monter('SYCEBNL');
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'], coursReglement: 1680 }] });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 1948800, 0],
            ['c571', 0, 1948800],
        ]);
        expect(prisma.compte.findFirst).not.toHaveBeenCalled();
    });
    it('plus que le dû EN DEVISE est refusé, avant toute pièce', async () => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 1160.01, coursReglement: 1750 }] })).rejects.toThrow(/dépasse le dû en devise/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('deux factures du même jour · le passage suit l’identifiant de ligne, jamais l’ordre reçu', async () => {
        const ecriture = { exerciceId: 'ex', date: new Date('2026-03-10'), journalId: 'jACH', journal: { code: 'ACH' }, exercice: { statut: 'OUVERT' } };
        const compte = { numero: '40110000', intitule: 'NZUZI', lettrable: true };
        const { service, creer } = monter('SYSCOHADA', [
            { id: 'jb', compteId: 'c401', debit: 0, credit: 170000, deviseId: 'usd', montantDevise: 100, lettrageId: null, compte, ecriture },
            { id: 'ja', compteId: 'c401', debit: 0, credit: 160000, deviseId: 'usd', montantDevise: 100, lettrageId: null, compte, ecriture },
        ]);
        await service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            reglements: [{ compteId: 'c401', ligneIds: ['jb', 'ja'], montantDevise: 100, coursReglement: 1750 }],
        });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 160000, 0],
            ['c656', 15000, 0],
            ['c571', 0, 175000],
        ]);
    });
    it('sans le cours du jour, refus nommé · jamais un cours deviné', async () => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'] }] })).rejects.toThrow(/cours du jour du règlement, ou le montant réellement payé en francs, est exigé/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('francs et devise dans la même pièce · refus ; un cours sur des factures en francs · refus', async () => {
        const { service } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm', 'fe'], coursReglement: 1750 }] })).rejects.toThrow(/francs et des factures en devise/);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c402', ligneIds: ['ff'], coursReglement: 1750 }] })).rejects.toThrow(/sont en francs/);
    });
    it('un montant en francs qui n’est pas la contrevaleur du cours saisi · refusé', async () => {
        const { service } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750, montant: 1000000 }] })).rejects.toThrow(/font 1050000.00 en francs/);
    });
    it('le débit réel saisi en francs, sans cours · le cours se déduit, le payé n’est pas recalculé', async () => {
        const { service, creer } = monter();
        await service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            tresorerieEnDevise: true,
            deviseTresorerieId: 'usd',
            reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, montant: 1050010 }],
        });
        const lignes = creer.mock.calls[0][2].lignes;
        expect(resume(lignes)).toEqual([
            ['c401', 1008000, 0],
            ['c656', 42010, 0],
            ['c571', 0, 1050010],
        ]);
        expect(lignes[2]).toMatchObject({ deviseId: 'usd', montantDevise: 600, coursApplique: 1750.016667 });
    });
    it('des francs sans montant en devise · refus nommé, avant toute pièce', async () => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'], montant: 500000 }] })).rejects.toThrow(/saisissez aussi le montant réglé en devise/);
        expect(creer).not.toHaveBeenCalled();
    });
    it.each([
        ['zéro franc payé', { montantDevise: 600, montant: 0 }],
        ['des francs nuls (null)', { montantDevise: 600, montant: null }],
        ['des francs négatifs', { montantDevise: 600, montant: -600 }],
        ['un cours nul', { montantDevise: 600, coursReglement: 0 }],
        ['un cours négatif', { montantDevise: 600, coursReglement: -1 }],
        ['un montant en devise nul (null)', { montantDevise: null, coursReglement: 1750 }],
    ])('%s · refus nommé, avant toute pièce', async (_cas, saisie) => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            reglements: [{ compteId: 'c401', ligneIds: ['fm'], ...saisie }],
        })).rejects.toThrow(/strictement positif/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('cours et débit saisis qui s’accordent à l’arrondi du cours près · admis', async () => {
        const { service, creer } = monter();
        await service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750, montant: 1050000.01 }],
        });
        expect(resume(creer.mock.calls[0][2].lignes)[2]).toEqual(['c571', 0, 1050000.01]);
    });
    it('SYCEBNL · sans compte choisi, la perte va au 658 prescrit (décision D2)', async () => {
        const { service, creer } = monter('SYCEBNL');
        await service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750 }],
        });
        expect(resume(creer.mock.calls[0][2].lignes)[1]).toEqual(['c658', 42000, 0]);
    });
    it('SYCEBNL · le 676 choisi est refusé, le 658 passe', async () => {
        const { service, creer } = monter('SYCEBNL');
        const regl = { compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750 };
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ ...regl, compteEcartChangeId: 'c676' }] })).rejects.toThrow(/réservé par le SYCEBNL/);
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ ...regl, compteEcartChangeId: 'c658' }] });
        expect(resume(creer.mock.calls[0][2].lignes)[1]).toEqual(['c658', 42000, 0]);
    });
    it('SYSCOHADA · le 656 du plan absent est un refus nommé, jamais un compte de repli', async () => {
        const { service, prisma } = monter();
        prisma.compte.findFirst.mockResolvedValueOnce(null);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750 }] })).rejects.toThrow(/65600000 que le texte donne .* n'est pas ouvert/);
    });
    it('SYSCOHADA · le 656 en sommeil · refus qui nomme le sous-compte, puis le sous-compte choisi passe', async () => {
        const { service, prisma, creer } = monter();
        prisma.compte.findFirst.mockResolvedValueOnce({ id: 'c656', numero: '65600000', typeCompte: 'DETAIL', estActif: false });
        const regl = { compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750 };
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [regl] })).rejects.toThrow(/65600000 est en sommeil.*sous-comptes · 65600000, 65610000/);
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ ...regl, compteEcartChangeId: 'c6561' }] });
        expect(resume(creer.mock.calls[0][2].lignes)[1]).toEqual(['c6561', 42000, 0]);
    });
    it('un compte choisi en sommeil ou de regroupement · refusé', async () => {
        const { service, prisma } = monter();
        prisma.compte.findFirst.mockResolvedValueOnce({ id: 'c6561', numero: '65610000', typeCompte: 'DETAIL', estActif: false });
        const regl = { compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750, compteEcartChangeId: 'c6561' };
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [regl] })).rejects.toThrow(/en sommeil/);
        prisma.compte.findFirst.mockResolvedValueOnce({ id: 'c6561', numero: '656', typeCompte: 'TOTAL', estActif: true });
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [regl] })).rejects.toThrow(/regroupement/);
    });
});
describe('le règlement d’une facture déjà réévaluée', () => {
    it('la facture B réévaluée le 05/01, réglée le 08/01 en N · 409, rien n’est passé', async () => {
        const { service, creer, prisma } = monter();
        prisma.reevaluation.findFirst.mockResolvedValueOnce({
            dateReevaluation: new Date('2026-12-31'),
            createdAt: new Date('2027-01-05'),
            ecritureEcarts: { lignes: [{ debit: 0, credit: 75000 }] },
        });
        const lues = [{ id: 'fm', deviseId: 'usd', debit: 0, credit: TTC_FRANCS, montantDevise: TTC_USD, lettrageId: null, lettrage: null }];
        const parId = prisma.ligneEcriture.findMany.getMockImplementation();
        prisma.ligneEcriture.findMany.mockImplementation(async (a) => (a.where.id ? parId(a) : lues));
        await expect(service.enregistrer('t', 'u', { ...base, date: '2026-12-28', sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1860 }] })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/a lu une facture choisie du 40110000.*annulez cette réévaluation/) });
        expect(creer).not.toHaveBeenCalled();
    });
});
describe('le règlement en N+1, réévaluation de N non contre-passée', () => {
    afterEach(() => jest.restoreAllMocks());
    it('l’avertissement revient avec les règlements, la pièce est passée', async () => {
        const espion = jest.spyOn(reevaluationModule, 'avertissementExtourneManquante').mockResolvedValue('40110000 · non contre-passée');
        const { service, creer } = monter();
        const r = await service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            reglements: [{ compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750 }],
        });
        expect(creer).toHaveBeenCalled();
        expect(espion).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ compteId: 'c401', ligneIds: ['fm'] }));
        expect(r.avertissements).toEqual(['40110000 · non contre-passée']);
    });
});
describe('la facture de N payée en partie, reportée entière en N+1', () => {
    const aNouveau = (drapeaux) => ({
        exerciceId: 'ex',
        date: new Date('2026-01-01'),
        journalId: 'jAN',
        journal: { code: 'AN' },
        exercice: { statut: 'OUVERT' },
        ...drapeaux,
    });
    const cloture = aNouveau({ estGenereeParCloture: true, estSoldeDesComptesDeGestion: false });
    const ordinaire = { exerciceId: 'ex', date: new Date('2026-02-10'), journalId: 'jBQ', journal: { code: 'BQ' }, exercice: { statut: 'OUVERT' } };
    const ligne = (id, compteId, debit, credit, devise, ecriture, enPlus = {}) => ({
        id,
        compteId,
        debit,
        credit,
        deviseId: 'usd',
        montantDevise: devise,
        lettre: null,
        lettrageId: null,
        compte: { numero: compteId === 'c401' ? '40110000' : '41110000', intitule: 'Tiers', lettrable: true },
        ecriture,
        ...enPlus,
    });
    const factureReportee = (ecriture = cloture) => ligne('ranF', 'c401', 0, 1_948_800, 1160, ecriture);
    const reglerLaReportee = { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['ranF'], coursReglement: 1750 }] };
    const reglerFm = { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['fm'], coursReglement: 1750 }] };
    it('le report Détail reprend la facture entière et le règlement partiel, chacun sans lettre (la vérification)', () => {
        const report = (0, report_a_nouveau_1.lignesReportANouveau)([
            {
                id: 'c401',
                numero: '40110000',
                intitule: 'NZUZI',
                modeReportANouveau: 'DETAIL',
                lignes: [
                    { debit: 0, credit: 1_948_800, lettre: null, libelle: 'Facture', dateEcheance: null, deviseId: 'usd', montantDevise: 1160 },
                    { debit: 1_008_000, credit: 0, lettre: null, libelle: 'Règlement', dateEcheance: null, deviseId: 'usd', montantDevise: 600 },
                ],
            },
        ], null);
        expect(report.map((l) => [l.debit, l.credit, l.montantDevise])).toEqual([
            [0, 1_948_800, 1160],
            [1_008_000, 0, 600],
        ]);
    });
    it('la ligne d’à-nouveau choisie, 1 160 USD contre 600 reportés · refusée avant toute pièce, l’issue nommée ; 560 USD passent', async () => {
        const provisoire = monter('SYSCOHADA', [
            factureReportee(aNouveau({ estANouveauProvisoire: true })),
            ligne('ranP', 'c401', 1_008_000, 0, 600, aNouveau({ estANouveauProvisoire: true })),
        ]);
        await expect(provisoire.service.enregistrer('t', 'u', reglerLaReportee)).rejects.toThrow(/la ligne d'à-nouveau choisie est PROVISOIRE/);
        for (const drapeaux of [{ estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }]) {
            const enPlus = [factureReportee(aNouveau(drapeaux)), ligne('ranP', 'c401', 1_008_000, 0, 600, aNouveau(drapeaux))];
            const { service, creer } = monter('SYSCOHADA', enPlus);
            await expect(service.enregistrer('t', 'u', reglerLaReportee)).rejects.toThrow(/600\.00 dans la devise des factures choisies sont déjà réglés au report à-nouveau[\s\S]*lettrez-les d'abord avec leur facture[\s\S]*les lignes d'à-nouveau choisies ne doivent plus que 560\.00 · réglez au plus 560\.00, puis complétez le lettrage/);
            await expect(service.enregistrer('t', 'u', reglerLaReportee)).rejects.toThrow(/Pour payer autrement, saisissez le règlement au journal de trésorerie, puis lettrez-le à la main avec la facture qu'il solde/);
            await expect(service.enregistrer('t', 'u', { ...reglerLaReportee, reglements: [{ compteId: 'c401', ligneIds: ['ranF'], montantDevise: 560.01, coursReglement: 1750 }] })).rejects.toThrow(/au plus 560\.00/);
            expect(creer).not.toHaveBeenCalled();
        }
        const { service, creer, lettrerManuel } = monter('SYSCOHADA', [factureReportee(), ligne('ranP', 'c401', 1_008_000, 0, 600, cloture)]);
        await service.enregistrer('t', 'u', { ...reglerLaReportee, reglements: [{ compteId: 'c401', ligneIds: ['ranF'], montantDevise: 560, coursReglement: 1750 }] });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 940_800, 0],
            ['c656', 39_200, 0],
            ['c571', 0, 980_000],
        ]);
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['ranF', 'p1-0'], 'u', { autoriserPartiel: true, ecartChangeRealise: 39_200 });
    });
    it('une facture de l’exercice, à côté d’un règlement reporté, n’est jamais bornée par lui (le premier tour la refusait à tort)', async () => {
        const { service, creer } = monter('SYSCOHADA', [factureReportee(), ligne('ranP', 'c401', 1_008_000, 0, 600, cloture)]);
        await service.enregistrer('t', 'u', reglerFm);
        expect(resume(creer.mock.calls[0][2].lignes)[0]).toEqual(['c401', 1_948_800, 0]);
    });
    it('un lot · la facture de l’exercice garde son dû entier, la reportée sa seule part (2 320 dus, 1 720 au plus)', async () => {
        const lot = { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['ranF', 'fm'], coursReglement: 1750 }] };
        const { service, creer } = monter('SYSCOHADA', [factureReportee(), ligne('ranP', 'c401', 1_008_000, 0, 600, cloture)]);
        await expect(service.enregistrer('t', 'u', lot)).rejects.toThrow(/ne doivent plus que 560\.00 · réglez au plus 1720\.00/);
        await service.enregistrer('t', 'u', { ...lot, reglements: [{ ...lot.reglements[0], montantDevise: 1720 }] });
        expect(creer).toHaveBeenCalledTimes(1);
    });
    it('côté client, l’encaissement reporté borne la créance reportée de même', async () => {
        const { service, creer } = monter('SYSCOHADA', [ligne('ranC', 'c411', 1_948_800, 0, 1160, cloture), ligne('ranE', 'c411', 0, 1_008_000, 600, cloture)]);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['ranC'], coursReglement: 1750 }] })).rejects.toThrow(/réglez au plus 560\.00/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('une ligne reportée déjà lettrée avec SA facture, ou annulée par son inscription en négatif · ne borne rien', async () => {
        const lettree = monter('SYSCOHADA', [
            factureReportee(),
            ligne('f3', 'c401', 0, 1_850_000, 1000, cloture, { lettrageId: 'G' }),
            ligne('ranP', 'c401', 1_008_000, 0, 600, cloture, { lettrageId: 'G' }),
        ]);
        await lettree.service.enregistrer('t', 'u', reglerLaReportee);
        expect(lettree.creer).toHaveBeenCalled();
        const annulee = monter('SYSCOHADA', [
            factureReportee(),
            ligne('ranP', 'c401', 1_008_000, 0, 600, cloture),
            ligne('ranN', 'c401', -1_008_000, 0, 600, cloture),
        ]);
        await annulee.service.enregistrer('t', 'u', reglerLaReportee);
        expect(annulee.creer).toHaveBeenCalled();
    });
    it('un règlement, un acompte ou un avoir non lettré passé dans l’exercice ne borne rien · l’avoir se lettre à part (fiche du compte 40)', async () => {
        const { service, creer, prisma } = monter('SYSCOHADA', [ligne('p', 'c401', 1_050_000, 0, 600, ordinaire)]);
        await service.enregistrer('t', 'u', reglerFm);
        expect(creer).toHaveBeenCalled();
        expect(prisma.ligneEcriture.aggregate).not.toHaveBeenCalled();
    });
    it('la doublure lit la requête · lignes reportées du compte, de la devise et de l’exercice, hors groupe, factures choisies écartées', async () => {
        const { service, prisma } = monter('SYSCOHADA', [factureReportee()]);
        await service.enregistrer('t', 'u', reglerLaReportee);
        const appels = prisma.ligneEcriture.aggregate.mock.calls.map((c) => c[0]);
        expect(appels).toHaveLength(4);
        for (const { where: w } of appels) {
            expect(w).toMatchObject({
                compteId: 'c401',
                id: { notIn: ['ranF'] },
                lettrageId: null,
                ecriture: { tenantId: 't', exerciceId: 'ex', OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }] },
            });
        }
        expect(appels.map((a) => a.where.deviseId)).toEqual(['usd', 'usd', null, null]);
        expect(appels[0].where).toMatchObject({ debit: { gt: 0 } });
        expect(appels[1].where).toMatchObject({ debit: { lt: 0 } });
        expect(appels[2]).toMatchObject({ where: { debit: { gt: 0 } }, _sum: { debit: true } });
        expect(appels[3]).toMatchObject({ where: { debit: { lt: 0 } }, _sum: { debit: true } });
    });
    it('un règlement reporté en francs sans devise · le règlement passe, avec l’avertissement qui le chiffre', async () => {
        const enFrancs = { ...ligne('ranX', 'c401', 500_000, 0, 0, cloture), deviseId: null, montantDevise: null };
        const { service, creer } = monter('SYSCOHADA', [factureReportee(), enFrancs]);
        const r = await service.enregistrer('t', 'u', reglerLaReportee);
        expect(creer).toHaveBeenCalled();
        expect(r.avertissements).toEqual([expect.stringMatching(/40110000 · 500000\.00 en francs, sans devise, sont reportés à l'à-nouveau de ce compte hors de tout lettrage/)]);
        const net = monter('SYSCOHADA', [factureReportee()]);
        expect((await net.service.enregistrer('t', 'u', reglerLaReportee)).avertissements).toEqual([]);
    });
    it('la ligne reportée d’une réévaluation · reconnue par sa liaison, aucun avertissement', async () => {
        const enFrancs = { ...ligne('ranX', 'c401', 500_000, 0, 0, cloture), deviseId: null, montantDevise: null };
        const ecartDeN = { id: 'eR1', compteId: 'c401', debit: 500_000, credit: 0, deviseId: null, montantDevise: null, lettre: null, ecriture: { exerciceId: 'n0', date: new Date('2025-12-31') } };
        const { service, prisma } = monter('SYSCOHADA', [factureReportee(), enFrancs]);
        prisma.reevaluation.findMany.mockImplementation(async ({ where }) => where.OR?.some((c) => c.ecritureEcartsId) ? [{ ecritureEcartsId: 'eR', ecritureExtourneId: null }] : []);
        const findMany = prisma.ligneEcriture.findMany;
        const ordinaire = findMany.getMockImplementation();
        findMany.mockImplementation(async (args) => {
            const w = args.where;
            if (w.ecritureId?.in)
                return w.ecritureId.in.includes('eR') && w.compteId.in.includes('c401') ? [ecartDeN] : [];
            if (w.deviseId === null && w.compteId?.in) {
                return [enFrancs].filter((l) => w.compteId.in.includes(l.compteId) && ligneRetenue(l, { ...w, compteId: undefined }));
            }
            return ordinaire(args);
        });
        const r = await service.enregistrer('t', 'u', reglerLaReportee);
        expect(r.avertissements).toEqual([]);
    });
});
describe('la trésorerie en devise', () => {
    const regl = { compteId: 'c401', ligneIds: ['fm'], montantDevise: 600, coursReglement: 1750 };
    it('déclarée et conforme · la ligne de trésorerie porte la devise et le cours', async () => {
        const { service, creer } = monter();
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', tresorerieEnDevise: true, deviseTresorerieId: 'usd', reglements: [regl] });
        expect(creer.mock.calls[0][2].lignes[2]).toMatchObject({ compteId: 'c571', deviseId: 'usd', montantDevise: 600, coursApplique: 1750 });
    });
    it('case cochée sans devise déclarée, ou une devise autre que celle des factures · refus avant toute pièce', async () => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', tresorerieEnDevise: true, reglements: [regl] })).rejects.toThrow(/Précisez la devise du moyen de paiement/);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', tresorerieEnDevise: true, deviseTresorerieId: 'eur', reglements: [regl] })).rejects.toThrow(/moyen de paiement est en EUR et les factures en USD/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('un lot à factures en francs et en devise · refus', async () => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', {
            ...base,
            sens: 'FOURNISSEUR',
            tresorerieEnDevise: true,
            deviseTresorerieId: 'usd',
            reglements: [{ compteId: 'c402', ligneIds: ['ff'] }, regl],
        })).rejects.toThrow(/ne règle que des factures en devise/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('le RIB du journal tenu dans une autre devise · refus ; tenu en USD et case décochée · refus', async () => {
        const { service, prisma, creer } = monter();
        prisma.ribBanque.findFirst.mockResolvedValueOnce({ devise: 'EUR' });
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', tresorerieEnDevise: true, deviseTresorerieId: 'usd', reglements: [regl] })).rejects.toThrow(/RIB du journal CA est tenu en EUR, et non en USD/);
        prisma.ribBanque.findFirst.mockResolvedValueOnce({ devise: 'usd' });
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [regl] })).rejects.toThrow(/RIB du journal CA est tenu en USD · cochez « Moyen de paiement en devise ».*ou, si le RIB est mal renseigné, corrigez sa devise \(Banques\)/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('le RIB du journal tenu en USD, des factures en francs, case décochée · refus avant toute pièce', async () => {
        const { service, prisma, creer } = monter();
        prisma.ribBanque.findFirst.mockResolvedValueOnce({ devise: 'USD' });
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c402', ligneIds: ['ff'] }] })).rejects.toThrow(/RIB du journal CA est tenu en USD et les factures choisies sont en francs.*ou, si le RIB est mal renseigné, corrigez sa devise \(Banques\)/);
        expect(creer).not.toHaveBeenCalled();
        for (const devise of ['cdf', null, '']) {
            prisma.ribBanque.findFirst.mockResolvedValueOnce({ devise });
            await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c402', ligneIds: ['ff'] }] });
        }
        expect(creer).toHaveBeenCalledTimes(3);
    });
    it('un lot USD et EUR · la règle pure refuse un moyen de paiement à deux devises', () => {
        expect((0, ecart_change_realise_1.motifRefusTresorerieEnDevise)({
            tresorerieEnDevise: true,
            devisesDuLot: [
                { id: 'usd', code: 'USD' },
                { id: 'eur', code: 'EUR' },
            ],
            deviseTresorerie: { id: 'usd', code: 'USD' },
            deviseRib: null,
            monnaieDeTenue: 'CDF',
            journalCode: 'BQ',
        })).toMatch(/plusieurs devises \(USD, EUR\)/);
        expect((0, ecart_change_realise_1.motifRefusTresorerieEnDevise)({
            tresorerieEnDevise: false,
            devisesDuLot: [null, null],
            deviseTresorerie: null,
            deviseRib: ' usd ',
            monnaieDeTenue: 'CDF',
            journalCode: 'BQ',
        })).toMatch(/tenu en USD et les factures choisies sont en francs/);
        expect((0, ecart_change_realise_1.motifRefusTresorerieEnDevise)({
            tresorerieEnDevise: false,
            devisesDuLot: [{ id: 'usd', code: 'USD' }],
            deviseTresorerie: null,
            deviseRib: 'CDF',
            monnaieDeTenue: 'CDF',
            journalCode: 'BQ',
        })).toBeNull();
    });
});
function reevaluationDuCasMixte(prisma, perte) {
    prisma.reevaluation.findFirst.mockResolvedValueOnce({
        dateReevaluation: new Date('2026-12-31'),
        createdAt: new Date('2027-01-05'),
        ecritureEcarts: { lignes: [{ debit: 0, credit: perte }] },
    });
    const l = (debit, credit, montantDevise, lettrageId) => ({
        deviseId: 'usd',
        debit,
        credit,
        montantDevise,
        lettrageId,
        lettrage: lettrageId ? { createdAt: new Date('2026-05-15') } : null,
        compteId: 'c401',
        ecriture: { exerciceId: 'ex', date: new Date('2026-06-01') },
    });
    const groupe = [l(0, 1_948_800, 1160, 'L'), l(1_008_000, 0, 600, 'L'), l(1_064_000, 0, 560, 'L')];
    prisma.ligneEcriture.findMany
        .mockResolvedValueOnce([...groupe, l(0, 850_000, 500, null)])
        .mockResolvedValueOnce(groupe);
}
describe('passer l’écart de change proposé au lettrage', () => {
    const proposition = {
        lettrageId: 'L',
        code: 'a',
        compteId: 'c401',
        compteNumero: '40110000',
        ecart: 123200,
        exerciceId: 'ex',
        date: new Date('2026-11-30'),
        deviseId: 'usd',
    };
    it('MBIKAYI · le solde de 560 USD payé à 1 900 · D 656 123 200 / C 401, puis le groupe complété', async () => {
        const { service, creer, completer, propositionEcartChange, prisma } = monter();
        propositionEcartChange.mockResolvedValueOnce(proposition);
        prisma.journal.findFirst.mockResolvedValueOnce({ id: 'od', code: 'OD', type: 'GENERAL' });
        const r = await service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'od', date: '2026-12-02' });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c656', 123200, 0],
            ['c401', 0, 123200],
        ]);
        expect(completer).toHaveBeenCalledWith('t', 'L', ['p1-1'], { groupeTolere: 'L' });
        expect(r).toMatchObject({ ecart: 123200, compte: '65600000', statut: 'SOLDE' });
        expect(creer.mock.calls[0][2].libelle).toBe('Perte de change réalisée · 40110000 a');
        expect(creer.mock.calls[0][2]).not.toHaveProperty('reporterAuPremierJourOuvert');
    });
    it('période close · la demande expresse passe à la saisie, la date posée et la date de valeur reviennent', async () => {
        const { service, creer, propositionEcartChange, prisma } = monter();
        propositionEcartChange.mockResolvedValueOnce(proposition);
        prisma.journal.findFirst.mockResolvedValueOnce({ id: 'od', code: 'OD', type: 'GENERAL' });
        creer.mockImplementationOnce(async (_t, _u, dto) => ({
            id: 'e1',
            numeroPiece: 1,
            date: new Date('2026-12-01'),
            dateValeur: new Date('2026-11-30'),
            lignes: dto.lignes.map((l, i) => ({ ...l, id: `p1-${i}` })),
        }));
        const r = await service.passerEcartChange('t', 'u', {
            lettrageId: 'L',
            exerciceId: 'ex',
            journalId: 'od',
            date: '2026-11-30',
            reporterAuPremierJourOuvert: true,
        });
        expect(creer.mock.calls[0][2]).toMatchObject({ date: '2026-11-30', reporterAuPremierJourOuvert: true });
        expect(r).toMatchObject({ date: new Date('2026-12-01'), dateValeur: new Date('2026-11-30') });
    });
    it('avant le dénouement, ou dans un autre exercice · refus avant toute pièce', async () => {
        const { service, creer, propositionEcartChange } = monter();
        propositionEcartChange.mockResolvedValue(proposition);
        await expect(service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'od', date: '2026-11-29' })).rejects.toThrow(/date du règlement qui dénoue la position, le 2026-11-30, ou après/);
        await expect(service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex2', journalId: 'od', date: '2027-01-05' })).rejects.toThrow(/dans l'exercice de son dernier règlement/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('une réévaluation postérieure qui a déjà repris ces lignes · 409 avant toute pièce', async () => {
        const { service, creer, propositionEcartChange, prisma } = monter();
        propositionEcartChange.mockResolvedValueOnce(proposition);
        prisma.journal.findFirst.mockResolvedValueOnce({ id: 'od', code: 'OD', type: 'GENERAL' });
        reevaluationDuCasMixte(prisma, 198_200);
        await expect(service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'od', date: '2026-12-02' })).rejects.toMatchObject({
            status: 409,
            message: expect.stringMatching(/compterait la perte deux fois/),
        });
        expect(creer).not.toHaveBeenCalled();
    });
    it('un compte qui ne se reconstitue plus · l’écart passe, avec l’avertissement, jamais un 409', async () => {
        const { service, creer, propositionEcartChange, prisma } = monter();
        propositionEcartChange.mockResolvedValueOnce(proposition);
        prisma.journal.findFirst.mockResolvedValueOnce({ id: 'od', code: 'OD', type: 'GENERAL' });
        reevaluationDuCasMixte(prisma, 90_000);
        const r = await service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'od', date: '2026-12-02' });
        expect(creer).toHaveBeenCalled();
        expect(r.avertissement).toMatch(/ont changé depuis la réévaluation/);
    });
    it('l’à-nouveau du groupe et une réévaluation précédente non contre-passée · avertissement rendu', async () => {
        const espion = jest
            .spyOn(reevaluationModule, 'avertissementExtourneManquante')
            .mockResolvedValue('40110000 · la réévaluation des devises du 2025-12-31 n’a pas été contre-passée');
        const { service, propositionEcartChange, prisma } = monter();
        propositionEcartChange.mockResolvedValueOnce(proposition);
        prisma.journal.findFirst.mockResolvedValueOnce({ id: 'od', code: 'OD', type: 'GENERAL' });
        const parId = prisma.ligneEcriture.findMany.getMockImplementation();
        prisma.ligneEcriture.findMany.mockImplementation(async (a) => a.where.lettrageId === 'L' ? [{ id: 'an' }, { id: 'p' }] : parId(a));
        const r = await service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'od', date: '2026-12-02' });
        expect(espion).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ligneIds: ['an', 'p'], compteId: 'c401' }));
        expect(r.avertissement).toMatch(/n’a pas été contre-passée/);
        espion.mockRestore();
    });
    it('un groupe resté partiel après l’écart · la pièce est retirée, 409', async () => {
        const { service, completer, propositionEcartChange, retirerCompensation, prisma } = monter();
        propositionEcartChange.mockResolvedValueOnce(proposition);
        prisma.journal.findFirst.mockResolvedValueOnce({ id: 'od', code: 'OD', type: 'GENERAL' });
        completer.mockResolvedValueOnce({ lettre: 'a', statut: 'PARTIEL', solde: -5 });
        await expect(service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'od', date: '2026-12-01' })).rejects.toMatchObject({
            status: 409,
        });
        expect(retirerCompensation).toHaveBeenCalledWith('t', 'e1', expect.any(Function));
    });
    it('rien à passer, ou un journal de trésorerie · refus avant toute pièce', async () => {
        const { service, creer, propositionEcartChange } = monter();
        propositionEcartChange.mockResolvedValueOnce({ ...proposition, ecart: null, motif: "pas soldé dans sa devise" });
        await expect(service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'bq', date: '2026-12-02' })).rejects.toThrow(/pas soldé dans sa devise/);
        propositionEcartChange.mockResolvedValueOnce(proposition);
        await expect(service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'bq', date: '2026-12-02' })).rejects.toThrow(/ne mouvemente aucune trésorerie/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('un complètement refusé retire l’écriture d’écart', async () => {
        const { service, completer, propositionEcartChange, retirerCompensation, prisma } = monter();
        propositionEcartChange.mockResolvedValueOnce(proposition);
        prisma.journal.findFirst.mockResolvedValueOnce({ id: 'od', code: 'OD', type: 'GENERAL' });
        completer.mockRejectedValueOnce(new Error('verrouillé'));
        await expect(service.passerEcartChange('t', 'u', { lettrageId: 'L', exerciceId: 'ex', journalId: 'od', date: '2026-12-02' })).rejects.toThrow('verrouillé');
        expect(retirerCompensation).toHaveBeenCalledWith('t', 'e1');
    });
    it('la route d’écriture porte les rôles qui écrivent', () => {
        const src = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'reglements.controller.ts'), 'utf8');
        expect(src).toContain("@Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)\n  @Post('ecart-change')");
    });
});
describe('Règlement en devise du reste d’un lettrage partiel reconduit', () => {
    const N1 = { exerciceId: 'ex', date: new Date('2026-01-01'), journalId: 'jOD', journal: { code: 'OD' }, exercice: { statut: 'OUVERT' } };
    const reconduites = [
        { id: 'xF', compteId: 'c401', debit: 0, credit: 2_800_000, deviseId: 'usd', montantDevise: 1000, lettrageId: 'H', compte: { numero: '40110000', intitule: 'NZUZI', lettrable: true }, ecriture: N1 },
        { id: 'xR', compteId: 'c401', debit: 1_120_000, credit: 0, deviseId: 'usd', montantDevise: 400, lettrageId: 'H', compte: { numero: '40110000', intitule: 'NZUZI', lettrable: true }, ecriture: N1 },
    ];
    it('1 000 USD pour 600 dus · REFUSÉ, le groupe nommé, aucune pièce', async () => {
        const { service, creer } = monter('SYSCOHADA', reconduites);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['xF'], montantDevise: 1000, coursReglement: 3000 }] })).rejects.toThrow(/dépasse le reste dû \(600\.00\) dans la devise des factures.*lettrage partiel c/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('acompte en francs seuls dans le groupe · le règlement en devise est REFUSÉ, issues nommées, aucune pièce', async () => {
        const enFrancs = [
            reconduites[0],
            { id: 'xA', compteId: 'c401', debit: 1_680_000, credit: 0, deviseId: null, montantDevise: null, lettrageId: 'H', compte: { numero: '40110000', intitule: 'NZUZI', lettrable: true }, ecriture: N1 },
        ];
        const { service, creer } = monter('SYSCOHADA', enFrancs);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['xF'], montantDevise: 1000, coursReglement: 3000 }] })).rejects.toThrow(/lettrage partiel c, qui porte un acompte, un règlement ou un avoir en francs seuls.*lettrez-le à la main.*repassez-le avec son montant en devise/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('reste du groupe 400 USD et facture libre 500 USD · 900 USD admis, le groupe complété avec la facture libre', async () => {
        const libre = { id: 'fl', compteId: 'c401', debit: 0, credit: 1_400_000, deviseId: 'usd', montantDevise: 500, lettrageId: null, compte: { numero: '40110000', intitule: 'NZUZI', lettrable: true }, ecriture: N1 };
        const quatreCents = [reconduites[0], { ...reconduites[1], debit: 1_680_000, montantDevise: 600 }, libre];
        const { service, creer, completer } = monter('SYSCOHADA', quatreCents);
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['xF', 'fl'], montantDevise: 900, coursReglement: 3000 }] });
        expect(creer).toHaveBeenCalledTimes(1);
        expect(completer).toHaveBeenCalledWith('t', 'H', expect.arrayContaining(['fl']), expect.anything());
    });
    const ecr = (date) => ({ ...N1, date: new Date(`${date}T00:00:00.000Z`) });
    const du401 = { compte: { numero: '40110000', intitule: 'NZUZI', lettrable: true } };
    it('cas (a) · 700 USD pour 1 000 000 réglés 33,33 et 66,67 USD · le solde de 600 USD inscrit à 857 142,85, le groupe soldé à zéro', async () => {
        const groupe = [
            { id: 'xF', compteId: 'c401', debit: 0, credit: 1_000_000, deviseId: 'usd', montantDevise: 700, lettrageId: 'H', ...du401, ecriture: ecr('2026-01-10') },
            { id: 'x1', compteId: 'c401', debit: 47_614.29, credit: 0, deviseId: 'usd', montantDevise: 33.33, lettrageId: 'H', ...du401, ecriture: ecr('2026-02-01') },
            { id: 'x2', compteId: 'c401', debit: 95_242.86, credit: 0, deviseId: 'usd', montantDevise: 66.67, lettrageId: 'H', ...du401, ecriture: ecr('2026-03-01') },
        ];
        const { service, creer, completer } = monter('SYSCOHADA', groupe);
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['xF'], montantDevise: 600, coursReglement: 1500 }] });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 857_142.85, 0],
            ['c656', 42_857.15, 0],
            ['c571', 0, 900_000],
        ]);
        expect(completer).toHaveBeenCalledWith('t', 'H', ['p1-0'], {
            ecartChangeRealise: 42_857.15,
            borne: { soldeAttendu: -857_142.85, sensDesFactures: 'CREDIT', deviseId: 'usd' },
        });
    });
    it('cas (b) · acompte de 400 USD inscrit au payé (1 200 000, D4) · le solde de 600 USD inscrit à 1 600 000, le réalisé ancien compris', async () => {
        const groupe = [
            { id: 'xF', compteId: 'c401', debit: 0, credit: 2_800_000, deviseId: 'usd', montantDevise: 1000, lettrageId: 'H', ...du401, ecriture: ecr('2026-01-10') },
            { id: 'xA', compteId: 'c401', debit: 1_200_000, credit: 0, deviseId: 'usd', montantDevise: 400, lettrageId: 'H', ...du401, ecriture: ecr('2026-02-01') },
        ];
        const { service, creer, completer } = monter('SYSCOHADA', groupe);
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['xF'], montantDevise: 600, coursReglement: 3000 }] });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 1_600_000, 0],
            ['c656', 200_000, 0],
            ['c571', 0, 1_800_000],
        ]);
        expect(completer).toHaveBeenCalledWith('t', 'H', ['p1-0'], expect.objectContaining({ borne: { soldeAttendu: -1_600_000, sensDesFactures: 'CREDIT', deviseId: 'usd' } }));
    });
    const casC = [
        { id: 'F1', compteId: 'c401', debit: 0, credit: 2_800_000, deviseId: 'usd', montantDevise: 1000, dateEcheance: new Date('2026-12-31'), lettrageId: 'H', ...du401, ecriture: ecr('2026-01-10') },
        { id: 'F2', compteId: 'c401', debit: 0, credit: 2_500_000, deviseId: 'usd', montantDevise: 1000, dateEcheance: new Date('2026-03-10'), lettrageId: 'H', ...du401, ecriture: ecr('2026-02-10') },
        { id: 'P', compteId: 'c401', debit: 1_400_000, credit: 0, deviseId: 'usd', montantDevise: 500, lettrageId: 'H', ...du401, ecriture: ecr('2026-06-01') },
    ];
    it('cas (c) · F1 non échue la plus ancienne, F2 échue, 500 USD inscrits sur F1 · le solde de 1 500 USD inscrit à 3 900 000', async () => {
        const { service, creer, completer } = monter('SYSCOHADA', casC);
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['F1', 'F2'], montantDevise: 1500, coursReglement: 3000 }] });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 3_900_000, 0],
            ['c656', 600_000, 0],
            ['c571', 0, 4_500_000],
        ]);
        expect(completer).toHaveBeenCalledWith('t', 'H', ['p1-0'], expect.objectContaining({ borne: { soldeAttendu: -3_900_000, sensDesFactures: 'CREDIT', deviseId: 'usd' } }));
    });
    it('cas (c), F2 seule choisie pour 500 USD · le coût suit l’ordre du groupe (le reste de F1, 1 400 000), et c’est DIT', async () => {
        const { service, creer } = monter('SYSCOHADA', casC);
        const r = await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['F2'], montantDevise: 500, coursReglement: 3000 }] });
        expect(resume(creer.mock.calls[0][2].lignes)[0]).toEqual(['c401', 1_400_000, 0]);
        expect(r.avertissements.join(' ')).toMatch(/s’inscrit d’abord sur les factures les plus anciennes du groupe · 500\.00 en devise sur .* du 2026-01-10/);
    });
    it('une AUTRE facture du groupe dans la devise au reste inconnu · le règlement en devise est refusé, aucune pièce', async () => {
        const groupe = [
            { id: 'G1', compteId: 'c401', debit: 0, credit: 2_800_000, deviseId: 'usd', montantDevise: 1000, lettrageId: 'H', ...du401, ecriture: ecr('2026-01-10') },
            { id: 'G2', compteId: 'c401', debit: 0, credit: 2_800_000, deviseId: 'usd', montantDevise: 1000, lettrageId: 'H', ...du401, ecriture: ecr('2026-02-10') },
            { id: 'GA', compteId: 'c401', debit: 1_000_000, credit: 0, deviseId: null, montantDevise: null, lettrageId: 'H', ...du401, ecriture: ecr('2026-03-01') },
        ];
        const { service, creer } = monter('SYSCOHADA', groupe);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['G2'], montantDevise: 1000, coursReglement: 3000 }] })).rejects.toThrow(/reste en devise est inconnu/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('600 USD à 3 000 · le tiers soldé au coût historique (1 680 000), la perte de 120 000 au 656, le groupe complété avec son réalisé', async () => {
        const { service, creer, completer, lettrerManuel } = monter('SYSCOHADA', reconduites);
        await service.enregistrer('t', 'u', { ...base, sens: 'FOURNISSEUR', reglements: [{ compteId: 'c401', ligneIds: ['xF'], montantDevise: 600, coursReglement: 3000 }] });
        expect(resume(creer.mock.calls[0][2].lignes)).toEqual([
            ['c401', 1_680_000, 0],
            ['c656', 120_000, 0],
            ['c571', 0, 1_800_000],
        ]);
        expect(creer.mock.calls[0][2].lignes[0]).toMatchObject({ deviseId: 'usd', montantDevise: 600 });
        expect(completer).toHaveBeenCalledWith('t', 'H', ['p1-0'], {
            ecartChangeRealise: 120_000,
            borne: { soldeAttendu: -1_680_000, sensDesFactures: 'CREDIT', deviseId: 'usd' },
        });
        expect(lettrerManuel).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ecart-change-realise.spec.js.map