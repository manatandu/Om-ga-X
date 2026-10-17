"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const decompte_final_1 = require("./decompte-final");
const decompte_final_emis_1 = require("./decompte-final-emis");
const passation_paie_1 = require("./passation-paie");
const assiettes_paie_1 = require("./assiettes-paie");
const LICENCIEMENT = {
    anneesAnciennete: 3,
    moisNonCouvertsParUnConge: 6,
    moinsDeDixHuitAns: false,
    initiative: 'EMPLOYEUR',
    motif: 'LICENCIEMENT',
    typeContrat: 'DUREE_INDETERMINEE',
    executionPreavis: 'DISPENSE_PAR_EMPLOYEUR',
    dateNotification: '2026-05-18',
    remunerationJournaliereFc: 10_000,
    moyenneMensuelleArticle66Fc: 0,
    moyenneMensuelleArticle142Fc: 0,
    avantagesPendantPreavisFc: 0,
    arrieresFc: 0,
    gratificationFc: 0,
    enfantsBeneficiairesAllocations: 0,
};
describe('A8 · le verdict du décompte traduit en éléments de paie', () => {
    it('range chaque rubrique chiffrée sous sa nature, le préavis au 6614 par la nature de fin de contrat', () => {
        const v = (0, decompte_final_1.decompteFinal)(LICENCIEMENT);
        const { elements, refus } = (0, decompte_final_emis_1.elementsDuDecompte)(v);
        expect(refus).toEqual([]);
        const preavis = elements.find((e) => e.cleRubrique === 'preavis');
        expect(preavis).toEqual(expect.objectContaining({ nature: 'INDEMNITE_DE_FIN_DE_CONTRAT', montantFc: 350_000 }));
        const conge = elements.find((e) => e.cleRubrique === 'conge');
        expect(conge).toEqual(expect.objectContaining({ nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', montantFc: 60_000 }));
        expect(elements.map((e) => e.cleRubrique).sort()).toEqual(['conge', 'preavis']);
    });
    it("REFUSE un solde partiel, en nommant chaque rubrique non chiffrée (un total null n'est pas un total)", () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...LICENCIEMENT, executionPreavis: null, gratificationFc: null });
        expect(v.totalBrutFc).toBeNull();
        const { refus } = (0, decompte_final_emis_1.elementsDuDecompte)(v);
        expect(refus.some((m) => m.startsWith('Indemnité compensatrice de préavis non chiffrée'))).toBe(true);
        expect(refus).toContain(decompte_final_emis_1.MOTIF_GRATIFICATION);
    });
    it("ne range JAMAIS une rubrique inconnue par défaut", () => {
        const v = (0, decompte_final_1.decompteFinal)(LICENCIEMENT);
        const inventee = { ...v, rubriques: [...v.rubriques, { cle: 'prime-de-depart', libelle: 'Prime de départ', montantFc: 1, fondement: 'x', reserve: null }] };
        const { refus, elements } = (0, decompte_final_emis_1.elementsDuDecompte)(inventee);
        expect(refus).toHaveLength(1);
        expect(refus[0]).toContain('Prime de départ');
        expect(elements.some((e) => e.cleRubrique === 'prime-de-depart')).toBe(false);
    });
    it('couvre EXACTEMENT les rubriques que le moteur du décompte sait produire', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'decompte-final.ts'), 'utf8');
        const cles = [...new Set([...source.matchAll(/cle: '([a-z0-9-]+)'/g)].map((m) => m[1]))].sort();
        const servies = [decompte_final_emis_1.CLE_ARRIERES, ...Object.keys(decompte_final_emis_1.NATURE_DES_RUBRIQUES)].sort();
        expect(cles).toEqual(servies);
    });
    it("garde l'indemnité de fin de contrat DANS la rémunération et DANS l'imposable", () => {
        expect(assiettes_paie_1.HORS_REMUNERATION_ARTICLE_7).not.toContain('INDEMNITE_DE_FIN_DE_CONTRAT');
        expect(assiettes_paie_1.IMMUNITES_ARTICLE_69.map((i) => i.nature)).not.toContain('INDEMNITE_DE_FIN_DE_CONTRAT');
        expect(passation_paie_1.IMPUTATION_PAR_NATURE.INDEMNITE_DE_FIN_DE_CONTRAT).toBe('INDEMNITES_DE_PREAVIS_ET_LICENCIEMENT');
    });
    it("n'ouvre la nature NI à l'élément saisi NI aux rubriques du cabinet", () => {
        const dto = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'dto', 'personnel.dto.ts'), 'utf8');
        const rubriques = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'rubriques-paie.ts'), 'utf8');
        expect(dto.includes("'INDEMNITE_DE_FIN_DE_CONTRAT'")).toBe(false);
        expect(rubriques.includes("'INDEMNITE_DE_FIN_DE_CONTRAT'")).toBe(false);
    });
    it('écrit la réserve du versement unique avec ses deux articles', () => {
        expect(decompte_final_emis_1.RESERVE_VERSEMENT_UNIQUE).toContain('art. 118 et 119');
        expect(decompte_final_emis_1.RESERVE_VERSEMENT_UNIQUE).toContain('68, 6°');
        expect(decompte_final_emis_1.RESERVE_VERSEMENT_UNIQUE).toContain('art. 121, al. 3');
        expect(decompte_final_emis_1.RESERVE_VERSEMENT_UNIQUE).toContain('AUCUN TAUX SPÉCIAL');
    });
});
describe('A8 · au journal, D 6614 / C 422 dans les trois temps de la paie', () => {
    it.each(['SYSCOHADA', 'SYCEBNL'])('passe le préavis au 66140000 et le 422 au brut en %s', (referentiel) => {
        const v = (0, passation_paie_1.passationPaie)({
            referentiel,
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire des jours prestés', montantFc: 100_000 },
                { nature: 'INDEMNITE_DE_FIN_DE_CONTRAT', libelle: 'Indemnité compensatrice de préavis', montantFc: 350_000 },
            ],
            cotisations: [{ cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: 22_500 }],
            abstentionsCotisations: [],
            irppFc: 40_000,
            netAPayerFc: 450_000 - 22_500 - 40_000,
        });
        expect(v.refus).toEqual([]);
        const brut = v.lignes.filter((l) => l.bloc === 'BRUT');
        expect(brut.find((l) => l.compte === '66140000')).toEqual(expect.objectContaining({ sens: 'DEBIT', montantFc: 350_000 }));
        expect(brut.find((l) => l.compte === '42200000')).toEqual(expect.objectContaining({ sens: 'CREDIT', montantFc: 450_000 }));
        expect(passation_paie_1.NOMENCLATURE_PAIE.INDEMNITES_DE_PREAVIS_ET_LICENCIEMENT[referentiel]).toBe('66140000');
        expect(v.equilibree).toBe(true);
    });
});
describe('A8 · les arriérés sont les éléments du mois versés en espèces', () => {
    it('additionne au centime et écarte ce qui est fourni en nature', () => {
        expect((0, decompte_final_emis_1.arrieresDesElements)([
            { nature: 'SALAIRE_OU_TRAITEMENT', montantFc: 100_000.105 },
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', montantFc: 20_000 },
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', montantFc: 50_000, enNature: true },
            { nature: 'AVANTAGE_EN_NATURE', montantFc: 9_000 },
        ])).toBe(120_000.11);
    });
});
describe('A8 · le décompte suit le registre', () => {
    it("refuse un contrat sans fin, ou un mois qui n'est pas celui de la fin", () => {
        expect((0, decompte_final_emis_1.motifRefusMoisDeCessation)(null, '2026-05')).toContain('pas terminé');
        expect((0, decompte_final_emis_1.motifRefusMoisDeCessation)(new Date(Date.UTC(2026, 4, 31)), '2026-06')).toContain('2026-05');
        expect((0, decompte_final_emis_1.motifRefusMoisDeCessation)(new Date(Date.UTC(2026, 4, 31)), '2026-05')).toBeNull();
    });
    it('prend le type du contrat au registre, jamais celui que le client envoie', () => {
        expect((0, decompte_final_emis_1.motifRefusTypeContrat)('DUREE_INDETERMINEE', 'DUREE_INDETERMINEE')).toBeNull();
        expect((0, decompte_final_emis_1.motifRefusTypeContrat)('DUREE_INDETERMINEE', 'DUREE_DETERMINEE')).toContain('contredit');
        expect((0, decompte_final_emis_1.motifRefusTypeContrat)('APPRENTISSAGE', 'DUREE_DETERMINEE')).toContain('autre type');
    });
});
describe('A8 · premier tour de relecture · la règle pure', () => {
    it('(k) arrondit chaque rubrique au centime avant d’en faire un élément', () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...LICENCIEMENT, remunerationJournaliereFc: 10_000.0003 });
        const { elements, refus } = (0, decompte_final_emis_1.elementsDuDecompte)(v);
        expect(refus).toEqual([]);
        for (const e of elements)
            expect((0, decompte_final_emis_1.auCentime)(e.montantFc)).toBe(e.montantFc);
    });
    it("ASSIETTE · des avantages compris dans le préavis et NON ventilés refusent · logement et transport sont exclus nommément (art. 7, point 8)", () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...LICENCIEMENT, avantagesPendantPreavisFc: 35_000 });
        const { refus } = (0, decompte_final_emis_1.elementsDuDecompte)(v);
        expect(refus.join(' ')).toContain('ventilez-les');
    });
    it('ASSIETTE · ventilés, ils sortent sous leur nature, le reste garde la réserve « corpus muet »', () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...LICENCIEMENT, avantagesPendantPreavisFc: 35_000 });
        const { elements, refus } = (0, decompte_final_emis_1.elementsDuDecompte)(v, [
            { rubrique: 'preavis', nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 20_000 },
            { rubrique: 'preavis', nature: 'REMUNERATION', libelle: 'Véhicule de fonction', montantFc: 15_000 },
        ]);
        expect(refus).toEqual([]);
        const preavis = elements.filter((e) => e.cleRubrique === 'preavis');
        expect(preavis.map((e) => [e.nature, e.montantFc])).toEqual([
            ['INDEMNITE_DE_FIN_DE_CONTRAT', 350_000],
            ['LOGEMENT_OU_SON_INDEMNITE', 20_000],
            ['INDEMNITE_DE_FIN_DE_CONTRAT', 15_000],
        ]);
        expect(preavis[0].reserve).toBe(decompte_final_emis_1.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE);
        expect(preavis[1].reserve).toBeNull();
        expect(decompte_final_emis_1.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE).toContain('par le texte');
        expect(decompte_final_emis_1.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE).toContain('art. 63, al. 3');
        expect(decompte_final_emis_1.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE).toContain('art. 7, point 8');
        expect(decompte_final_emis_1.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE).toContain('arrêté n° 146/2018, art. 20');
    });
    it('ASSIETTE · une ventilation qui ne fait pas le compte, ou qui vise une rubrique sans avantages, refuse', () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...LICENCIEMENT, avantagesPendantPreavisFc: 35_000 });
        expect((0, decompte_final_emis_1.elementsDuDecompte)(v, [{ rubrique: 'preavis', nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 30_000 }]).refus.join(' ')).toContain('30000.00 FC ventilés');
        const sans = (0, decompte_final_1.decompteFinal)(LICENCIEMENT);
        expect((0, decompte_final_emis_1.elementsDuDecompte)(sans, [{ rubrique: 'preavis', nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 1 }]).refus.join(' ')).toContain('aucun avantage à ventiler');
    });
    it('(m) refuse une nature payée à la fois par le mois et par une rubrique du décompte', () => {
        const { elements } = (0, decompte_final_emis_1.elementsDuDecompte)((0, decompte_final_1.decompteFinal)(LICENCIEMENT));
        expect((0, decompte_final_emis_1.motifsDoubleCompte)([{ nature: 'SALAIRE_OU_TRAITEMENT', montantFc: 1 }], elements)).toEqual([]);
        const m = (0, decompte_final_emis_1.motifsDoubleCompte)([{ nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', montantFc: 10 }], elements);
        expect(m).toHaveLength(1);
        expect(m[0]).toContain('versée deux fois');
    });
    it('(j) un élément négatif ou illisible est nommé, jamais ramené à zéro', () => {
        expect((0, decompte_final_emis_1.motifsElementsNegatifs)([{ libelle: 'Salaire', montantFc: 10 }])).toEqual([]);
        expect((0, decompte_final_emis_1.motifsElementsNegatifs)([{ libelle: 'Salaire', montantFc: -1 }])[0]).toContain('« Salaire »');
        expect((0, decompte_final_emis_1.motifsElementsNegatifs)([{ libelle: 'Prime', montantFc: Number.NaN }])).toHaveLength(1);
        expect((0, decompte_final_emis_1.arrieresDesElements)([{ nature: 'SALAIRE_OU_TRAITEMENT', montantFc: -5 }])).toBe(-5);
    });
    it("(n) les allocations familiales avertissent qu'elles ne passeront pas au journal, rien n'est imputé à leur place", () => {
        const elements = [
            { nature: 'INDEMNITE_DE_FIN_DE_CONTRAT' },
            { nature: 'ALLOCATIONS_FAMILIALES_LEGALES' },
            { nature: 'ALLOCATIONS_FAMILIALES_LEGALES' },
        ];
        const a = (0, decompte_final_emis_1.avertissementsPassation)(elements, passation_paie_1.NATURES_SANS_IMPUTATION);
        expect(a).toEqual([`ALLOCATIONS_FAMILIALES_LEGALES · ${decompte_final_emis_1.AVERTISSEMENT_SANS_COMPTE}`]);
        expect((0, decompte_final_emis_1.avertissementsPassation)((0, decompte_final_emis_1.elementsDuDecompte)((0, decompte_final_1.decompteFinal)(LICENCIEMENT)).elements, passation_paie_1.NATURES_SANS_IMPUTATION)).toEqual([]);
    });
});
//# sourceMappingURL=decompte-final-emis.spec.js.map