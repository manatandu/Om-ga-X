"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assiettes_paie_1 = require("./assiettes-paie");
const bareme_smig_1 = require("./bareme-smig");
const salaire = (montantFc) => ({
    nature: 'SALAIRE_OU_TRAITEMENT',
    libelle: 'Salaire de base',
    montantFc,
});
describe("L'assiette sociale de l'article 7, point 8 du Code du travail", () => {
    it('sort CINQ natures, et la liste est fermée', () => {
        expect([...assiettes_paie_1.HORS_REMUNERATION_ARTICLE_7]).toEqual([
            'SOINS_DE_SANTE',
            'LOGEMENT_OU_SON_INDEMNITE',
            'ALLOCATIONS_FAMILIALES_LEGALES',
            'INDEMNITE_DE_TRANSPORT',
            'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION',
        ]);
    });
    it("exclut SANS CONDITION, quel que soit le montant", () => {
        const petit = (0, assiettes_paie_1.assietteSociale)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 100_000 },
        ]);
        const enorme = (0, assiettes_paie_1.assietteSociale)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 5_000_000 },
        ]);
        expect(petit.montantFc).toBe(1_000_000);
        expect(enorme.montantFc).toBe(1_000_000);
        expect(enorme.horsRemuneration[0].motif).toContain("ne porte aucune condition");
    });
    it("fait entrer dans la rémunération tout ce que l'article 7 n'a pas exclu", () => {
        const verdict = (0, assiettes_paie_1.assietteSociale)([
            salaire(500_000),
            { nature: 'PRIME', libelle: 'Prime de rendement', montantFc: 200_000 },
            { nature: 'AVANTAGE_EN_NATURE', libelle: 'Véhicule', montantFc: 300_000 },
            {
                nature: 'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT',
                libelle: 'Congé de maternité',
                montantFc: 100_000,
            },
        ]);
        expect(verdict.montantFc).toBe(1_100_000);
        expect(verdict.horsRemuneration).toHaveLength(0);
    });
});
describe("Les deux assiettes ne se servent JAMAIS l'une pour l'autre", () => {
    it("impose un logement que l'assiette sociale exclut de plein droit", () => {
        const elements = [
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
        ];
        const verdict = (0, assiettes_paie_1.assiettes)(elements);
        expect(verdict.assietteSocialeFc).toBe(1_000_000);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_400_000);
        expect(verdict.assietteFiscaleBruteFc).not.toBe(verdict.assietteSocialeFc);
    });
    it("n'impose PAS un logement qui reste sous les 30 %", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 300_000 },
        ]);
        expect(verdict.assietteSocialeFc).toBe(1_000_000);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_000_000);
    });
    it("bascule à l'exact franc où la condition cesse d'être remplie", () => {
        const plafond = (1_000_000 * assiettes_paie_1.PLAFOND_LOGEMENT_POUR_CENT) / 100;
        const juste = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: plafond },
        ]);
        const unFrancDeTrop = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: plafond + 1 },
        ]);
        expect(juste.assietteFiscaleBruteFc).toBe(1_000_000);
        expect(unFrancDeTrop.assietteFiscaleBruteFc).toBe(1_000_000 + plafond + 1);
    });
});
describe("« Pour autant que » n'est pas « dans la limite de »", () => {
    it("impose le logement ENTIER, pas seulement son excédent", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
        ]);
        const logement = verdict.sortsFiscaux.find((s) => s.libelle === 'Logement');
        expect(logement?.imposableFc).toBe(400_000);
        expect(logement?.imposableFc).not.toBe(100_000);
    });
    it('la condition porte sur l’indemnité du salarié, toutes lignes · deux lignes de 20 % sont une indemnité de 40 % (passe F5)', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Loyer', montantFc: 200_000 },
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Charges', montantFc: 200_000 },
        ]);
        expect(verdict.sortsFiscaux.find((x) => x.libelle === 'Loyer')?.imposableFc).toBe(200_000);
        expect(verdict.sortsFiscaux.find((x) => x.libelle === 'Charges')?.imposableFc).toBe(200_000);
        expect(verdict.reserves.some((r) => r.includes("seul l'excédent"))).toBe(false);
        expect(verdict.reserves.filter((r) => r.startsWith('BASE DES 30 %'))).toHaveLength(1);
    });
    it('le taux légal des allocations se consomme une fois, pas à chaque ligne (art. 69, 1, passe F5)', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Alloc. 1', montantFc: 50_000 },
            { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Alloc. 2', montantFc: 50_000 },
        ], { tauxLegalAllocationsFamilialesFc: 60_000 });
        expect(verdict.sortsFiscaux.find((x) => x.libelle === 'Alloc. 1')?.imposableFc).toBe(0);
        expect(verdict.sortsFiscaux.find((x) => x.libelle === 'Alloc. 2')?.imposableFc).toBe(40_000);
    });
    it("T3 · la condition est tranchée par le texte · l'autre lecture ne se chiffre plus en réserve", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
        ]);
        const reserves = verdict.reserves.join(' ');
        expect(reserves).not.toContain('100000.00 FC');
        expect(reserves).toContain('BASE DES 30 %');
        expect(verdict.sortsFiscaux.find((x) => x.libelle === 'Logement')?.motif).toContain('« pour autant que », non « dans la limite de »');
    });
    it("plafonne au contraire les allocations familiales, qui sont écrites « dans la mesure où »", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            {
                nature: 'ALLOCATIONS_FAMILIALES_LEGALES',
                libelle: 'Allocations familiales',
                montantFc: 50_000,
            },
        ], { tauxLegalAllocationsFamilialesFc: 30_000 });
        const allocation = verdict.sortsFiscaux.find((s) => s.libelle === 'Allocations familiales');
        expect(allocation?.imposableFc).toBe(20_000);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_020_000);
    });
    it("les deux formes rendent des chiffres différents sur des données identiques", () => {
        const communs = { montantFc: 400_000 };
        const logement = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'L', ...communs },
        ]);
        const allocations = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'A', ...communs },
        ], { tauxLegalAllocationsFamilialesFc: 300_000 });
        expect(logement.assietteFiscaleBruteFc).toBe(1_400_000);
        expect(allocations.assietteFiscaleBruteFc).toBe(1_100_000);
    });
});
describe("Les abstentions plutôt que les suppositions", () => {
    it("n'immunise JAMAIS un transport dont la condition n'est pas attestée", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'INDEMNITE_DE_TRANSPORT', libelle: 'Transport', montantFc: 120_000 },
        ]);
        expect(verdict.assietteFiscaleBruteFc).toBeNull();
        expect(verdict.assietteFiscaleNetteFc).toBeNull();
        expect(verdict.abstentions).toHaveLength(1);
        expect(verdict.abstentions[0].motif).toBe('CONDITION_ARTICLE_69_NON_ATTESTEE');
        expect(verdict.assietteSocialeFc).toBe(1_000_000);
    });
    it("immunise le transport quand le cabinet atteste, et l'impose quand il ne peut pas", () => {
        const atteste = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            {
                nature: 'INDEMNITE_DE_TRANSPORT',
                libelle: 'Transport',
                montantFc: 120_000,
                conditionArticle69Attestee: true,
            },
        ]);
        const refuse = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            {
                nature: 'INDEMNITE_DE_TRANSPORT',
                libelle: 'Transport',
                montantFc: 120_000,
                conditionArticle69Attestee: false,
            },
        ]);
        expect(atteste.assietteFiscaleBruteFc).toBe(1_000_000);
        expect(refuse.assietteFiscaleBruteFc).toBe(1_120_000);
        expect(refuse.abstentions).toHaveLength(0);
    });
    it("s'abstient sur les allocations familiales tant que le taux légal n'est pas fourni", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            {
                nature: 'ALLOCATIONS_FAMILIALES_LEGALES',
                libelle: 'Allocations',
                montantFc: 50_000,
            },
        ]);
        expect(verdict.assietteFiscaleBruteFc).toBeNull();
        expect(verdict.abstentions[0].motif).toBe('TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI');
        expect(verdict.abstentions[0].explication).toContain('25/22');
        expect(verdict.abstentions[0].explication).toMatch(/colonne 19/i);
    });
});
describe("C2 · l'abstention sur les allocations dit ce qui manque et quoi faire", () => {
    const NOM_INTERNE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;
    const elements = [
        salaire(1_000_000),
        { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc: 50_000 },
    ];
    const explication = (parametres) => {
        const verdict = (0, assiettes_paie_1.assiettes)(elements, parametres);
        expect(verdict.assietteFiscaleBruteFc).toBeNull();
        expect(verdict.abstentions).toHaveLength(1);
        expect(verdict.abstentions[0].motif).toBe('TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI');
        return verdict.abstentions[0].explication;
    };
    const grille2019 = (0, bareme_smig_1.annexeApplicable)('2019-03');
    const RAISON_2019 = grille2019.explication;
    it('le témoin · mars 2019 n’a pas de grille, et la grille dit pourquoi', () => {
        expect(grille2019.valeur).toBeNull();
        expect(RAISON_2019).toContain('2019');
    });
    it('enfants non renseignés · demande de les renseigner, sans parler de saisir un taux', () => {
        const texte = explication({ tauxLegalAllocationsNonCalcule: { cause: 'ENFANTS_BENEFICIAIRES_NON_RENSEIGNES' } });
        expect(texte).toContain("Le nombre d'enfants bénéficiaires n'est pas renseigné");
        expect(texte).toContain("Renseignez le nombre d'enfants bénéficiaires des allocations familiales");
        expect(texte).not.toMatch(/saisissez le taux légal/i);
        expect(texte.match(NOM_INTERNE)).toBeNull();
    });
    it("mois qu'aucune grille ne couvre · dit pourquoi et demande de saisir le taux légal, pas les enfants", () => {
        const texte = explication({
            tauxLegalAllocationsNonCalcule: { cause: 'MOIS_SANS_GRILLE_DU_SMIG', raison: RAISON_2019 },
        });
        expect(texte).toContain("OmegaX n'a aucune grille du SMIG pour ce mois de paie");
        expect(texte).toContain(RAISON_2019);
        expect(texte).toContain('Saisissez le taux légal du mois');
        expect(texte).not.toMatch(/renseignez le nombre d.enfants/i);
        expect(texte.match(NOM_INTERNE)).toBeNull();
    });
    it('cause inconnue · nomme les deux causes et les deux gestes', () => {
        const texte = explication({});
        expect(texte).toContain("Renseignez le nombre d'enfants bénéficiaires");
        expect(texte).toContain('saisissez le taux légal du mois');
        expect(texte.match(NOM_INTERNE)).toBeNull();
    });
    it('chaque variante rappelle la règle et la colonne 19 du décret n° 25/22', () => {
        const immunite = assiettes_paie_1.IMMUNITES_ARTICLE_69.find((i) => i.nature === 'ALLOCATIONS_FAMILIALES_LEGALES');
        for (const cause of [
            null,
            { cause: 'ENFANTS_BENEFICIAIRES_NON_RENSEIGNES' },
            { cause: 'MOIS_SANS_GRILLE_DU_SMIG', raison: RAISON_2019 },
        ]) {
            const texte = (0, assiettes_paie_1.explicationTauxLegalNonChiffre)(immunite, cause);
            expect(texte).toContain("L'article 69, 1 de la loi n° 23/053 immunise");
            expect(texte).toContain('dans la mesure où elles ne dépassent pas les taux légaux');
            expect(texte).toContain('colonne 19');
            expect(texte).toContain('25/22');
        }
    });
    it('la constante de résolution reste la référence du code, et le moteur ne la cite plus', () => {
        expect(explication({})).not.toContain('RESOLUTION_TAUX_LEGAL_ALLOCATIONS');
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toMatch(/colonne 19/i);
    });
});
describe("Le « taux légal » de l'article 69, 1", () => {
    it('désigne la colonne 19 du décret, et écarte nommément les 8 100 FC de la Caisse', () => {
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toMatch(/colonne 19/i);
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toContain('25/22');
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toContain('8 100');
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toContain('137/2018');
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toContain('143/2018');
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toMatch(/n'est PAS le montant de 8 100 FC/i);
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toMatch(/SERVIE DIRECTEMENT PAR LA CAISSE/i);
        expect(assiettes_paie_1.RESOLUTION_TAUX_LEGAL_ALLOCATIONS).toMatch(/RÉELLEMENT ACCORDÉ/i);
    });
    it("n'immunise que jusqu'au taux légal, et reprend l'excédent", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc: 50_000 },
        ], { tauxLegalAllocationsFamilialesFc: 20_703.8 });
        expect(verdict.abstentions).toHaveLength(0);
        expect(verdict.assietteFiscaleBruteFc).toBeCloseTo(1_000_000 + 50_000 - 20_703.8, 2);
    });
});
describe("C1 · le plafond de l'article 69, 1 se juge au centime", () => {
    const TAUX_FLOTTANT = 796.3 * 26 * 3;
    const allocation = (libelle, montantFc) => ({
        nature: 'ALLOCATIONS_FAMILIALES_LEGALES',
        libelle,
        montantFc,
    });
    it("le témoin · le flottant ne rend pas le taux légal au centime", () => {
        expect(TAUX_FLOTTANT).not.toBe(62_111.4);
        expect(62_111.4 - TAUX_FLOTTANT).toBeGreaterThan(0);
    });
    it("une allocation égale au taux légal est entièrement immunisée, rien n'est imposable", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(1_000_000), allocation('Allocations', 62_111.4)], {
            tauxLegalAllocationsFamilialesFc: TAUX_FLOTTANT,
        });
        const sort = verdict.sortsFiscaux.find((x) => x.libelle === 'Allocations');
        expect(sort?.imposableFc).toBe(0);
        expect(sort?.motif).toContain("L'allocation est entièrement immunisée.");
        expect(sort?.motif).not.toMatch(/excédent de 0\.00/);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_000_000);
    });
    it("cinq centimes au-delà du taux légal · seuls ces cinq centimes sont imposables", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(1_000_000), allocation('Allocations', 62_111.45)], {
            tauxLegalAllocationsFamilialesFc: TAUX_FLOTTANT,
        });
        const sort = verdict.sortsFiscaux.find((x) => x.libelle === 'Allocations');
        expect(sort?.imposableFc).toBe(0.05);
        expect(sort?.motif).toContain("Seul l'excédent de 0.05 FC est imposable.");
        expect(verdict.assietteFiscaleBruteFc).toBe(1_000_000.05);
    });
    it("deux lignes qui font ensemble le taux légal · ni l'une ni l'autre n'est imposable", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(1_000_000), allocation('Alloc. 1', 20_000.1), allocation('Alloc. 2', 42_111.3)], { tauxLegalAllocationsFamilialesFc: TAUX_FLOTTANT });
        expect(verdict.sortsFiscaux.filter((x) => x.libelle.startsWith('Alloc.')).map((x) => x.imposableFc)).toEqual([0, 0]);
        expect(verdict.sortsFiscaux.some((x) => /excédent de 0\.00/.test(x.motif))).toBe(false);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_000_000);
    });
    it('constat 3 · un montant au millième ne rend jamais une part imposable négative', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(1_000_000), allocation('Allocations', 50_000.005)], {
            tauxLegalAllocationsFamilialesFc: TAUX_FLOTTANT,
        });
        const sort = verdict.sortsFiscaux.find((x) => x.libelle === 'Allocations');
        expect(sort?.imposableFc).toBe(0);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_000_000);
    });
    it("la règle du plafond ne bouge pas · au-delà, l'excédent entier est repris", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(1_000_000), allocation('Allocations', 100_000)], {
            tauxLegalAllocationsFamilialesFc: TAUX_FLOTTANT,
        });
        expect(verdict.sortsFiscaux.find((x) => x.libelle === 'Allocations')?.imposableFc).toBe(37_888.6);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_037_888.6);
    });
});
describe("Jumeau de C1 · la condition de l'article 69, 8, a) se juge au centime", () => {
    const logement = (montantFc) => ({ nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc });
    it('témoin · le flottant rend 131 072,30 × 30 % sous 39 321,69', () => {
        expect((131_072.3 * assiettes_paie_1.PLAFOND_LOGEMENT_POUR_CENT) / 100).toBeLessThan(39_321.69);
    });
    it('à 30 % EXACTEMENT, le logement reste immunisé tout entier', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(131_072.3), logement(39_321.69)]);
        const sort = verdict.sortsFiscaux.find((x) => x.libelle === 'Logement');
        expect(sort?.imposableFc).toBe(0);
        expect(sort?.motif).toContain('La condition est remplie');
        expect(sort?.motif).toContain('plafond de comparaison : 39321.69 FC');
        expect(verdict.assietteFiscaleBruteFc).toBe(131_072.3);
    });
    it('un centime au-dessus, le logement entier est imposé', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(131_072.3), logement(39_321.7)]);
        expect(verdict.sortsFiscaux.find((x) => x.libelle === 'Logement')?.imposableFc).toBe(39_321.7);
    });
    it('deux lignes de logement qui font 30 % pile · la condition porte sur leur total, au centime', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(131_072.3), logement(20_000.1), logement(19_321.59)]);
        expect(verdict.sortsFiscaux.filter((x) => x.libelle === 'Logement').map((x) => x.imposableFc)).toEqual([0, 0]);
    });
    it('un plafond au millième se dit au millième, jamais arrondi sur le total qui le dépasse', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(131_072.33), logement(39_321.7)]);
        const sort = verdict.sortsFiscaux.find((x) => x.libelle === 'Logement');
        expect(sort?.imposableFc).toBe(39_321.7);
        expect(sort?.motif).toContain('plafond de comparaison : 39321.699 FC');
    });
});
describe("Les articles 70 et 71 · l'ordre de calcul", () => {
    it("déduit les retenues de l'article 71 APRÈS l'article 69, jamais avant", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(1_000_000), { nature: 'PRIME', libelle: 'Prime', montantFc: 200_000 }], { retenuesArticle71Fc: 60_000 });
        expect(verdict.assietteFiscaleBruteFc).toBe(1_200_000);
        expect(verdict.retenuesArticle71Fc).toBe(60_000);
        expect(verdict.assietteFiscaleNetteFc).toBe(1_140_000);
    });
    it("dit pourquoi la quote-part ouvrière de la CNSS y entre, et la patronale non", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(1_000_000)], { retenuesArticle71Fc: 50_000 });
        const reserves = verdict.reserves.join(' ');
        expect(reserves).toMatch(/article 71/i);
        expect(reserves).toContain('caisses de pension officielles');
        expect(reserves).toContain('patronales');
    });
    it('ne rend jamais une assiette nette négative', () => {
        const verdict = (0, assiettes_paie_1.assiettes)([salaire(100_000)], { retenuesArticle71Fc: 500_000 });
        expect(verdict.assietteFiscaleNetteFc).toBe(0);
    });
});
describe("L'article 68, 1 · le remboursement de dépenses professionnelles", () => {
    it("sort du brut fiscal une dépense professionnelle EFFECTIVE, sans passer par l'article 69", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            {
                nature: 'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION',
                libelle: 'Mission Lubumbashi',
                montantFc: 250_000,
                remboursementDeDepenseProfessionnelleEffective: true,
            },
        ]);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_000_000);
        const ligne = verdict.sortsFiscaux.find((s) => s.libelle === 'Mission Lubumbashi');
        expect(ligne?.motif).toContain('Article 68, 1');
    });
    it("impose au contraire un frais de voyage qui n'est pas un remboursement effectif", () => {
        const verdict = (0, assiettes_paie_1.assiettes)([
            salaire(1_000_000),
            {
                nature: 'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION',
                libelle: 'Billet de congé',
                montantFc: 250_000,
            },
        ]);
        expect(verdict.assietteSocialeFc).toBe(1_000_000);
        expect(verdict.assietteFiscaleBruteFc).toBe(1_250_000);
    });
});
describe("La table des immunités", () => {
    it('ne porte que les points que l\'article 69 applique à un élément de paie', () => {
        expect(assiettes_paie_1.IMMUNITES_ARTICLE_69.map((i) => i.point)).toEqual([
            'article 69, 1',
            'article 69, 8, a)',
            'article 69, 8, b)',
            'article 69, 8, c)',
        ]);
    });
    it('distingue la forme de chaque point, et une seule est un plafond', () => {
        const formes = assiettes_paie_1.IMMUNITES_ARTICLE_69.map((i) => i.forme);
        expect(formes).toEqual(['PLAFOND', 'CONDITION', 'CONDITION', 'CONDITION']);
        expect(formes.filter((f) => f === 'PLAFOND')).toHaveLength(1);
    });
    it("nomme les deux conditions qu'aucun livre comptable ne porte", () => {
        const nonVerifiables = assiettes_paie_1.IMMUNITES_ARTICLE_69.filter((i) => i.conditionNonVerifiableParLeLogiciel).map((i) => i.point);
        expect(nonVerifiables).toEqual(['article 69, 8, b)', 'article 69, 8, c)']);
    });
});
//# sourceMappingURL=assiettes-paie.spec.js.map