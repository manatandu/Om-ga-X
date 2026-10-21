"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const fs_1 = require("fs");
const path_1 = require("path");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_smt_syscohada_1 = require("./correspondance-smt-syscohada");
const MAQUETTE_ACTIF = ['Immobilisations (1)', 'Stocks', 'Clients et débiteurs divers', 'Caisse', 'Banque (en + ou en –)', 'Total actif'];
const MAQUETTE_PASSIF = ['Compte exploitant', 'Résultat exercice', 'Emprunt', 'Fournisseurs et créditeurs divers', 'Total passif'];
const MAQUETTE_COMPTE_RESULTAT = [
    'Recettes sur ventes ou prestations de services',
    'Autres recettes sur activités',
    'TOTAL DES RECETTES SUR PRODUITS',
    'Dépenses sur achats',
    'Dépenses sur loyers',
    'Dépenses sur salaires',
    'Dépenses sur impôts et taxes',
    "Charges d'intérêts",
    'Autres dépenses sur activités',
    'TOTAL DÉPENSES SUR CHARGES',
    'SOLDE : Excédent (+) ou insuffisance (–) de recettes (C = A – B)',
    '– Variation des stocks N / N-1',
    '– Variation des créances N / N-1',
    "+ Variation des dettes d'exploitation N / N-1",
    'DOTATIONS AMORTISSEMENTS',
    'RÉSULTAT EXERCICE (G = C – D + E – F)',
];
const FEUILLES = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL');
const FEUILLES_BILAN = FEUILLES.filter((c) => /^[1-5]/.test(c.numero));
const FEUILLES_1_A_8 = FEUILLES.filter((c) => /^[1-8]/.test(c.numero));
const TOUS_POSTES_BILAN = [...correspondance_smt_syscohada_1.POSTES_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA];
function libelleDe(ref) {
    if (ref === correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA)
        return correspondance_smt_syscohada_1.LIBELLE_RESULTAT_SMT_SYSCOHADA;
    return (TOUS_POSTES_BILAN.find((p) => p.ref === ref)?.libelle ??
        [...correspondance_smt_syscohada_1.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA].find((t) => t.ref === ref)?.libelle ??
        [...correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA].find((p) => p.ref === ref)?.libelle ??
        correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.find((r) => r.ref === ref)?.libelle ??
        correspondance_smt_syscohada_1.TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA.find((t) => t.ref === ref)?.libelle);
}
function prefixesBilanCites() {
    const out = [];
    for (const p of TOUS_POSTES_BILAN) {
        p.comptes.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'comptes' }));
        p.exclusions?.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'exclusions' }));
        p.comptesSansFiltreDeSens?.forEach((c) => out.push({ prefixe: c, ref: p.ref, role: 'comptesSansFiltreDeSens' }));
    }
    correspondance_smt_syscohada_1.COMPTES_RESULTAT_SMT_SYSCOHADA.forEach((c) => out.push({ prefixe: c, ref: correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA, role: 'resultat' }));
    return out;
}
function postesReclamant(numero) {
    const out = [];
    for (const p of TOUS_POSTES_BILAN) {
        if ((0, etats_financiers_communs_1.correspond)(numero, p.comptes, p.exclusions))
            out.push({ ref: p.ref, parFiltre: p.sens_qualificatif !== undefined });
        if (p.comptesSansFiltreDeSens && (0, etats_financiers_communs_1.correspond)(numero, p.comptesSansFiltreDeSens))
            out.push({ ref: p.ref, parFiltre: false });
    }
    return out;
}
describe('correspondance SMT SYSCOHADA (AUDCIF Titre X)', () => {
    it('le jeu SMT est celui du Titre X ch. 1 § 2 : Bilan, Compte de résultat, Notes annexes · pas de TFT (anomalie n° 3)', () => {
        expect([...correspondance_smt_syscohada_1.DOCUMENTS_SMT_SYSCOHADA]).toEqual(['BILAN', 'COMPTE_DE_RESULTAT', 'NOTES_ANNEXES']);
        expect(correspondance_smt_syscohada_1.AMORTISSEMENT_SMT).toEqual({ mode: 'LINEAIRE', prorataTemporis: false });
    });
    it("l'ordre du bilan reprend EXACTEMENT les libellés de la maquette du ch. 2 § 1, dans l'ordre du texte", () => {
        expect(correspondance_smt_syscohada_1.ORDRE_BILAN_ACTIF_SMT_SYSCOHADA.map(libelleDe)).toEqual(MAQUETTE_ACTIF);
        expect(correspondance_smt_syscohada_1.ORDRE_BILAN_PASSIF_SMT_SYSCOHADA.map(libelleDe)).toEqual(MAQUETTE_PASSIF);
    });
    it("l'ordre du compte de résultat reprend EXACTEMENT les rubriques de la maquette du ch. 2 § 2, dans l'ordre du texte", () => {
        expect(correspondance_smt_syscohada_1.ORDRE_COMPTE_RESULTAT_SMT_SYSCOHADA.map(libelleDe)).toEqual(MAQUETTE_COMPTE_RESULTAT);
    });
    it('ne comporte aucune ref en double, bilan et compte de résultat confondus', () => {
        const toutes = [
            ...TOUS_POSTES_BILAN.map((p) => p.ref),
            ...correspondance_smt_syscohada_1.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA.map((t) => t.ref),
            ...correspondance_smt_syscohada_1.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA.map((t) => t.ref),
            correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA,
            ...correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA.map((p) => p.ref),
            ...correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA.map((p) => p.ref),
            ...correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.map((r) => r.ref),
            ...correspondance_smt_syscohada_1.TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA.map((t) => t.ref),
        ];
        expect(new Set(toutes).size).toBe(toutes.length);
    });
    it("les codes REF sont ceux choisis par OmegaX (préfixe S), jamais un code du Système normal ni d'un autre référentiel", () => {
        for (const ref of [...correspondance_smt_syscohada_1.ORDRE_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.ORDRE_BILAN_PASSIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.ORDRE_COMPTE_RESULTAT_SMT_SYSCOHADA]) {
            expect(ref).toMatch(/^S[A-Z0-9]{1,2}$/);
        }
    });
    it("l'ordre d'affichage du bilan couvre les postes de détail + totaux + résultat, rien de plus, rien de moins", () => {
        const refsActif = new Set([...correspondance_smt_syscohada_1.POSTES_BILAN_ACTIF_SMT_SYSCOHADA.map((p) => p.ref), ...correspondance_smt_syscohada_1.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA.map((t) => t.ref)]);
        expect(new Set(correspondance_smt_syscohada_1.ORDRE_BILAN_ACTIF_SMT_SYSCOHADA)).toEqual(refsActif);
        const refsPassif = new Set([
            ...correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA.map((p) => p.ref),
            ...correspondance_smt_syscohada_1.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA.map((t) => t.ref),
            correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA,
        ]);
        expect(new Set(correspondance_smt_syscohada_1.ORDRE_BILAN_PASSIF_SMT_SYSCOHADA)).toEqual(refsPassif);
    });
    it('un total ne référence jamais une ref définie APRÈS lui · le calcul en une passe lirait 0 en silence', () => {
        const resolues = new Set([...TOUS_POSTES_BILAN.map((p) => p.ref), correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA]);
        for (const total of [...correspondance_smt_syscohada_1.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA]) {
            for (const ref of total.deRefs)
                expect(resolues.has(ref)).toBe(true);
            resolues.add(total.ref);
        }
        expect(correspondance_smt_syscohada_1.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA[0].deRefs).toEqual(correspondance_smt_syscohada_1.POSTES_BILAN_ACTIF_SMT_SYSCOHADA.map((p) => p.ref));
        expect(new Set(correspondance_smt_syscohada_1.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA[0].deRefs)).toEqual(new Set([...correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA.map((p) => p.ref), correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA]));
    });
    it('SP2 (résultat) est hors POSTES_PASSIF et vaut 131 à 139 et le 130 (paquet 1, A6) · le 13 n’est réclamé par aucun poste de passif', () => {
        expect(correspondance_smt_syscohada_1.REF_RESULTAT_SMT_SYSCOHADA).toBe('SP2');
        expect((0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SP2')).toBeUndefined();
        expect(correspondance_smt_syscohada_1.COMPTES_RESULTAT_SMT_SYSCOHADA).toEqual(['131', '132', '133', '134', '135', '136', '137', '138', '139', '130']);
        expect((0, etats_financiers_communs_1.correspond)('13010000', correspondance_smt_syscohada_1.COMPTES_RESULTAT_SMT_SYSCOHADA)).toBe(true);
        for (const c of FEUILLES_BILAN.filter((c) => c.numero.startsWith('13'))) {
            expect(postesReclamant(c.numero)).toEqual([]);
        }
    });
    it('chaque préfixe cité par le bilan correspond à au moins un compte d’imputation du semis SYSCOHADA, dans les classes 1 à 5', () => {
        const absents = prefixesBilanCites().filter(({ prefixe }) => !FEUILLES_BILAN.some((c) => c.numero.startsWith(prefixe)));
        expect(absents).toEqual([]);
        for (const { prefixe } of prefixesBilanCites())
            expect(prefixe).toMatch(/^[1-5]/);
    });
    it('aucun compte de bilan du semis n’est orphelin : chaque feuille des classes 1 à 5 est captée par un poste ou par le résultat', () => {
        const orphelins = FEUILLES_BILAN.filter((c) => postesReclamant(c.numero).length === 0 && !(0, etats_financiers_communs_1.correspond)(c.numero, correspondance_smt_syscohada_1.COMPTES_RESULTAT_SMT_SYSCOHADA)).map((c) => c.numero);
        expect(orphelins).toEqual([]);
    });
    it('aucun compte n’est réclamé deux fois, sauf les tiers partagés entre SA3 et SP4 par le sens de leur solde', () => {
        for (const c of FEUILLES_BILAN) {
            const postes = postesReclamant(c.numero);
            if (postes.length <= 1)
                continue;
            expect(postes.map((p) => p.ref).sort()).toEqual(['SA3', 'SP4']);
            expect(postes.every((p) => p.parFiltre)).toBe(true);
        }
    });
    it('SA3 porte « débiteur », SP4 « créditeur », sur la même classe 4 hors 49 · l’union ne perd aucun tiers', () => {
        const sa3 = (0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SA3');
        const sp4 = (0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SP4');
        expect(sa3.sens_qualificatif).toBe('DEBITEUR');
        expect(sp4.sens_qualificatif).toBe('CREDITEUR');
        expect(sa3.comptes).toEqual(sp4.comptes);
        expect(sa3.exclusions).toEqual(sp4.exclusions);
        expect(sa3.exclusions).toEqual(['49']);
    });
    it('dépréciations et provisions à court terme (49, 59) · anomalie n° 5 : 490 à 498, 590, 591 en moins de l’actif ; 499, 599 au passif', () => {
        const sa3 = (0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SA3');
        const sa5 = (0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SA5');
        const sp4 = (0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SP4');
        for (const n of ['49000000', '49110000', '49700000', '49800000', '59000000', '59100000']) {
            expect(postesReclamant(n).map((p) => p.ref)).toEqual(['SA3']);
            expect((0, etats_financiers_communs_1.correspond)(n, sa3.comptesSansFiltreDeSens)).toBe(true);
        }
        for (const n of ['59200000', '59300000', '59400000']) {
            expect(postesReclamant(n).map((p) => p.ref)).toEqual(['SA5']);
            expect((0, etats_financiers_communs_1.correspond)(n, sa5.comptes)).toBe(true);
        }
        for (const n of ['49900000', '59900000']) {
            expect(postesReclamant(n).map((p) => p.ref)).toEqual(['SP4']);
            expect((0, etats_financiers_communs_1.correspond)(n, sp4.comptesSansFiltreDeSens)).toBe(true);
        }
    });
    it('titres de placement (50) et valeurs à encaisser (51) sont en SA3 sans filtre de sens · anomalie n° 6', () => {
        for (const n of ['50100000', '51300000']) {
            expect(postesReclamant(n)).toEqual([{ ref: 'SA3', parFiltre: false }]);
        }
    });
    it('Caisse = 57 seul ; Banque = 52 à 56 et 58 sans filtre de sens (« en + ou en – ») · anomalie n° 7', () => {
        expect((0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SA4').comptes).toEqual(['57']);
        const sa5 = (0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SA5');
        expect(sa5.sens_qualificatif).toBeUndefined();
        expect(sa5.comptes).toEqual(['52', '53', '54', '55', '56', '58', '592', '593', '594']);
        for (const c of FEUILLES_BILAN.filter((c) => c.numero.startsWith('5'))) {
            expect(correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions)).map((p) => p.ref)).toEqual([]);
        }
        expect(postesReclamant('58500000').map((p) => p.ref)).toEqual(['SA5']);
        expect(postesReclamant('58800000').map((p) => p.ref)).toEqual(['SA5']);
    });
    it('Compte exploitant reçoit tous les capitaux propres hors 13 ; Emprunt reçoit 16 à 19 · anomalies n° 8 et 9', () => {
        expect((0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SP1').comptes).toEqual(['10', '11', '12', '14', '15']);
        expect((0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SP3').comptes).toEqual(['16', '17', '18', '19']);
        expect((0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SP1').sens_qualificatif).toBeUndefined();
        expect((0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)('SP3').sens_qualificatif).toBeUndefined();
        for (const c of FEUILLES_BILAN.filter((c) => c.numero.startsWith('1'))) {
            const refs = postesReclamant(c.numero).map((p) => p.ref);
            if (c.numero.startsWith('13'))
                expect(refs).toEqual([]);
            else
                expect(['SP1', 'SP3']).toContain(refs[0]);
        }
    });
    it('les renvois de notes du bilan sont ceux imprimés par la maquette (Compte exploitant → 1, anomalie n° 4 ; Caisse et Banque sans renvoi)', () => {
        const notes = Object.fromEntries(TOUS_POSTES_BILAN.map((p) => [p.ref, p.note]));
        expect(notes).toEqual({ SA1: '1', SA2: '2', SA3: '3', SA4: null, SA5: null, SP1: '1', SP3: null, SP4: '3' });
    });
    it('chaque poste de bilan porte un fondement qui cite sa source', () => {
        for (const p of TOUS_POSTES_BILAN) {
            expect(p.fondement.length).toBeGreaterThan(40);
            expect(p.fondement).toMatch(/Titre VII|plan de comptes SYSCOHADA|Classe|NOTE/);
        }
    });
    it('chaque préfixe cité par un poste de flux ou une colonne de ventilation existe au plan (classes 1 à 8)', () => {
        const cites = [];
        for (const p of [...correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA])
            cites.push(...p.comptes, ...(p.exclusions ?? []));
        for (const c of [...correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA])
            cites.push(...c.comptes, ...(c.exclusions ?? []));
        cites.push(...correspondance_smt_syscohada_1.COMPTES_DOTATIONS_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.COMPTES_CHIFFRE_AFFAIRES_ART13);
        const absents = cites.filter((prefixe) => !FEUILLES_1_A_8.some((c) => c.numero.startsWith(prefixe)));
        expect(absents).toEqual([]);
    });
    it("le périmètre de A et B est EXACTEMENT « produits et charges » + « postes de bilan porteurs d'une variation » · anomalie n° 13", () => {
        const avecVariation = correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.map((r) => r.posteBilan).filter((r) => r !== null);
        expect(avecVariation).toEqual(['SA2', 'SA3', 'SP4']);
        for (const c of FEUILLES_1_A_8) {
            const dansPerimetre = (0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)(c.numero);
            if (/^[6-8]/.test(c.numero)) {
                expect(dansPerimetre).toBe(true);
                continue;
            }
            const corrige = !(0, correspondance_smt_syscohada_1.estTiersHorsExploitationSmt)(c.numero) && postesReclamant(c.numero).some((p) => avecVariation.includes(p.ref));
            expect({ numero: c.numero, dansPerimetre }).toEqual({ numero: c.numero, dansPerimetre: corrige });
        }
    });
    it("toute contrepartie DU PÉRIMÈTRE tombe dans EXACTEMENT un poste de recette et un poste de dépense ; aucune autre n'entre dans un poste de flux", () => {
        for (const c of FEUILLES_1_A_8) {
            const attendu = (0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)(c.numero) ? 1 : 0;
            expect(correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions)).length).toBe(attendu);
            expect(correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions)).length).toBe(attendu);
        }
        for (const n of ['16100000', '10300000', '10400000', '24400000', '14100000']) {
            expect(correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(n, p.comptes, p.exclusions))).toEqual([]);
            expect(correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA.filter((p) => (0, etats_financiers_communs_1.correspond)(n, p.comptes, p.exclusions))).toEqual([]);
        }
    });
    it("les comptes de trésorerie ne sont jamais leur propre contrepartie, et la définition exportée exclut 50, 51 et 59 · anomalie n° 14", () => {
        expect(correspondance_smt_syscohada_1.COMPTES_TRESORERIE_SMT_SYSCOHADA).toEqual(['52', '53', '54', '55', '56', '57', '58']);
        expect(correspondance_smt_syscohada_1.COMPTES_DEPRECIATION_TRESORERIE_SMT_SYSCOHADA).toEqual(['592', '593', '594']);
        for (const n of ['50100000', '51300000', '59000000', '59200000', '59900000']) {
            expect((0, etats_financiers_communs_1.correspond)(n, correspondance_smt_syscohada_1.COMPTES_TRESORERIE_SMT_SYSCOHADA)).toBe(false);
        }
        for (const c of FEUILLES_1_A_8.filter((c) => (0, etats_financiers_communs_1.correspond)(c.numero, [...correspondance_smt_syscohada_1.COMPTES_TRESORERIE_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.COMPTES_DEPRECIATION_TRESORERIE_SMT_SYSCOHADA]))) {
            expect((0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)(c.numero)).toBe(false);
        }
    });
    it('chaque feuille des classes 1 à 8 appartient à un seul des quatre périmètres exportés · rien n’est laissé sans nom', () => {
        for (const c of FEUILLES_1_A_8) {
            const appartenances = [
                (0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)(c.numero),
                correspondance_smt_syscohada_1.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA.some((b) => (0, etats_financiers_communs_1.correspond)(c.numero, b.comptes)),
                (0, etats_financiers_communs_1.correspond)(c.numero, correspondance_smt_syscohada_1.COMPTES_TRESORERIE_SMT_SYSCOHADA),
                (0, etats_financiers_communs_1.correspond)(c.numero, correspondance_smt_syscohada_1.COMPTES_DEPRECIATION_TRESORERIE_SMT_SYSCOHADA),
            ].filter(Boolean).length;
            expect({ numero: c.numero, appartenances }).toEqual({ numero: c.numero, appartenances: 1 });
        }
        expect(correspondance_smt_syscohada_1.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA.map((b) => [b.cle, b.comptes])).toEqual([
            ['financement', ['1', '461', '465', '467', '4493', '4494']],
            ['investissement', ['2', '481', '482']],
        ]);
        for (const b of correspondance_smt_syscohada_1.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA)
            expect(b.fondement).toMatch(/Titre X|Titre VII/);
    });
    it('toute contrepartie des classes 1 à 8 tombe dans EXACTEMENT une colonne de ventilation de la NOTE 4, recettes et dépenses', () => {
        for (const c of FEUILLES_1_A_8) {
            expect(correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA.filter((k) => (0, etats_financiers_communs_1.correspond)(c.numero, k.comptes, k.exclusions)).length).toBe(1);
            expect(correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA.filter((k) => (0, etats_financiers_communs_1.correspond)(c.numero, k.comptes, k.exclusions)).length).toBe(1);
        }
    });
    it('les postes nommés du compte de résultat visent les comptes de leur libellé (70 · 60 · 622 · 66 · 64 + 89 · 67)', () => {
        const comptesDe = (ref) => [...correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA].find((p) => p.ref === ref).comptes;
        expect(comptesDe('SR1')).toEqual(['70', '411', '412', '413', '415', '416', '4181', '4191', '4192']);
        const sr = (numero) => correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA.find((p) => (0, etats_financiers_communs_1.correspond)(numero, p.comptes, p.exclusions))?.ref;
        expect({ c4111: sr('41110000'), c4141: sr('41410000'), c4186: sr('41860000'), c4194: sr('41940000'), c4198: sr('41980000') }).toEqual({
            c4111: 'SR1',
            c4141: 'SR2',
            c4186: 'SR2',
            c4194: 'SR2',
            c4198: 'SR2',
        });
        expect(comptesDe('SD1')).toEqual(['60']);
        expect(comptesDe('SD2')).toEqual(['622']);
        expect(comptesDe('SD3')).toEqual(['66']);
        expect(comptesDe('SD4')).toEqual(['64', '89']);
        expect(comptesDe('SD5')).toEqual(['67']);
        expect(correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA.find((p) => (0, etats_financiers_communs_1.correspond)('62320000', p.comptes, p.exclusions)).ref).toBe('SD6');
        expect(correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA.find((p) => (0, etats_financiers_communs_1.correspond)('62240000', p.comptes, p.exclusions)).ref).toBe('SD2');
        expect(correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA.find((p) => (0, etats_financiers_communs_1.correspond)('66610000', p.comptes, p.exclusions)).ref).toBe('SD3');
    });
    it('les renvois de notes du compte de résultat sont ceux de la maquette · seule « Charges d’intérêts » et « DOTATIONS » n’en portent pas', () => {
        const notes = Object.fromEntries([...correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA].map((p) => [p.ref, p.note]));
        expect(notes).toEqual({
            SR1: '4', SR2: '4',
            SD1: '4', SD2: '4', SD3: '4', SD4: '4', SD5: null, SD6: '4',
            SV1: '2', SV2: '3', SV3: '3', SF: null,
        });
    });
    it('les colonnes officielles de la NOTE 4 sont là, dans l’ordre du texte, et la seule colonne ajoutée est « Compte exploitant » (anomalie n° 12)', () => {
        const officielles = (cols) => cols.filter((c) => !c.rajoutAutorise).map((c) => c.libelle);
        expect(officielles(correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA)).toEqual(['Ventes', 'Autres', 'Matériel et Mobilier']);
        expect(officielles(correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA)).toEqual([
            'Achats marchandises', 'Achats matières et fournitures', 'Loyers', 'Salaires', 'Impôts et taxes', 'Autres',
        ]);
        const rajouts = [...correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA].filter((c) => c.rajoutAutorise);
        expect(rajouts.map((c) => c.libelle)).toEqual(['Compte exploitant', 'Compte exploitant']);
        for (const r of rajouts)
            expect(r.comptes).toEqual(['103', '104']);
        for (const cols of [correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA, correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA]) {
            expect(cols.findIndex((c) => c.rajoutAutorise)).toBe(cols.length - 1);
        }
    });
    it("la NOTE 4 porte TOUS les mouvements de trésorerie, y compris ceux que A et B excluent · anomalie n° 21", () => {
        const colonneRecette = (n) => correspondance_smt_syscohada_1.VENTILATION_RECETTES_SMT_SYSCOHADA.find((k) => (0, etats_financiers_communs_1.correspond)(n, k.comptes, k.exclusions)).cle;
        const colonneDepense = (n) => correspondance_smt_syscohada_1.VENTILATION_DEPENSES_SMT_SYSCOHADA.find((k) => (0, etats_financiers_communs_1.correspond)(n, k.comptes, k.exclusions)).cle;
        expect(colonneRecette('16100000')).toBe('autres');
        expect(colonneDepense('24400000')).toBe('autres');
        expect(colonneDepense('58500000')).toBe('autres');
        expect(colonneRecette('24400000')).toBe('materielMobilier');
        expect(colonneRecette('82100000')).toBe('materielMobilier');
        expect(colonneRecette('10400000')).toBe('compteExploitant');
        expect(colonneDepense('10400000')).toBe('compteExploitant');
    });
    it('les opérateurs officiels sont conservés (\u2013, \u2013, +) et la variation est définie (N-1) - N · anomalie n° 2', () => {
        expect(correspondance_smt_syscohada_1.DEFINITION_VARIATION_SMT_SYSCOHADA).toBe('N1_MOINS_N');
        expect(correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.map((r) => [r.ref, r.signeOfficiel, r.lettre, r.posteBilan])).toEqual([
            ['SV1', -1, 'D', 'SA2'],
            ['SV2', -1, 'D', 'SA3'],
            ['SV3', 1, 'E', 'SP4'],
            ['SF', -1, 'F', null],
        ]);
        for (const r of correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.filter((r) => r.posteBilan)) {
            expect(r.libelle.startsWith(r.signeOfficiel === 1 ? '+ ' : '\u2013 ')).toBe(true);
        }
        expect([...correspondance_smt_syscohada_1.LETTRES_D_E_SMT_SYSCOHADA.D, ...correspondance_smt_syscohada_1.LETTRES_D_E_SMT_SYSCOHADA.E]).toEqual(['SV1', 'SV2', 'SV3']);
        for (const r of correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA)
            if (r.posteBilan)
                expect((0, correspondance_smt_syscohada_1.trouvePosteBilanSmtSyscohada)(r.posteBilan)).toBeDefined();
    });
    it('G = C – D + E – F redonne le résultat d’engagement sur un exemple chiffré · la lecture des anomalies n° 1 et 2 est exacte', () => {
        const r = (0, correspondance_smt_syscohada_1.calculerResultatSmt)({
            recettes: 100,
            depenses: 60,
            stocks: { n: 15, n1: 10 },
            creances: { n: 20, n1: 0 },
            dettes: { n: 8, n1: 0 },
            dotations: 3,
        });
        expect(r.C).toBe(40);
        expect(r.lignes).toEqual({ SV1: -5, SV2: -20, SV3: -8, SF: 3 });
        expect(r.D).toBe(-25);
        expect(r.E).toBe(-8);
        expect(r.F).toBe(3);
        expect(r.G).toBe(54);
        const parLignes = correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.reduce((s, l) => s + l.signeOfficiel * r.lignes[l.ref], r.C);
        expect(parLignes).toBe(r.G);
        expect((0, correspondance_smt_syscohada_1.calculerResultatSmt)({ recettes: 100, depenses: 60, stocks: { n: 5, n1: 10 }, creances: { n: 0, n1: 20 }, dettes: { n: 0, n1: 8 }, dotations: 0 }).G).toBe(40 - 5 - 20 + 8);
    });
    it('les dotations F sont lues dans 68, 69 et 85 · jamais dans un poste de flux', () => {
        expect(correspondance_smt_syscohada_1.COMPTES_DOTATIONS_SMT_SYSCOHADA).toEqual(['68', '69', '85']);
        for (const n of ['659', '679', '839'])
            expect(correspondance_smt_syscohada_1.COMPTES_DOTATIONS_SMT_SYSCOHADA).not.toContain(n);
    });
    it("chaque total du compte de résultat dit de quelles lignes il est fait, toutes définies AVANT lui", () => {
        const rang = (ref) => correspondance_smt_syscohada_1.ORDRE_COMPTE_RESULTAT_SMT_SYSCOHADA.indexOf(ref);
        for (const total of correspondance_smt_syscohada_1.TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA) {
            expect(rang(total.ref)).toBeGreaterThanOrEqual(0);
            for (const ref of total.deRefs) {
                expect(rang(ref)).toBeGreaterThanOrEqual(0);
                expect(rang(ref)).toBeLessThan(rang(total.ref));
            }
        }
        const de = (ref) => correspondance_smt_syscohada_1.TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA.find((t) => t.ref === ref).deRefs;
        expect(de('SRA')).toEqual(correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA.map((p) => p.ref));
        expect(de('SDB')).toEqual(correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA.map((p) => p.ref));
        expect(de('SC')).toEqual(['SRA', 'SDB']);
        expect(de('SG')).toEqual(['SC', ...correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA.map((r) => r.ref)]);
    });
    it('les quatre notes du ch. 3 sont là, numérotées 1 à 4, avec les colonnes de leur maquette', () => {
        expect(correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA.map((n) => n.numero)).toEqual([1, 2, 3, 4]);
        expect(correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA.map((n) => n.intitule)).toEqual([
            'Tableau SMT de suivi du matériel, du mobilier et des cautions',
            'État des stocks',
            'État des créances et des dettes non échues',
            'Journal de trésorerie SMT',
        ]);
        expect(correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA[0].colonnes).toEqual(['Date', 'Désignation', 'Montant', 'Date de sortie', 'Prix de cession']);
        expect(correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA[1].colonnes).toEqual(['Référence', 'Désignation', 'Quantité', 'Prix unitaire', 'Montant']);
        expect(correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA[3].colonnes).toEqual(['Date', 'Libellés', 'Recettes', 'Dépenses', 'Solde']);
        for (const n of correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA)
            expect(n.colonnes === null).toBe(n.sousTableaux !== undefined);
        expect(correspondance_smt_syscohada_1.JOURNAUX_DE_SUIVI_SMT_SYSCOHADA.map((j) => j.cle)).toEqual(['creancesImpayees', 'dettesAPayer']);
        expect(correspondance_smt_syscohada_1.LIGNES_SYNTHESE_NOTE_2_SMT_SYSCOHADA).toEqual(['VALEUR DU STOCK FINAL', 'VALEUR DU STOCK INITIAL']);
        const numeros = new Set(correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA.map((n) => String(n.numero)));
        for (const p of [...TOUS_POSTES_BILAN, ...correspondance_smt_syscohada_1.POSTES_RECETTES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_DEPENSES_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.RETRAITEMENTS_SMT_SYSCOHADA]) {
            if (p.note !== null)
                expect(numeros.has(p.note)).toBe(true);
        }
    });
    it("la NOTE 3 est faite des DEUX tableaux du ch. 3, chacun avec ses colonnes et sa ligne de total · anomalie n° 19", () => {
        const note3 = correspondance_smt_syscohada_1.NOTES_SMT_SYSCOHADA.find((n) => n.numero === 3);
        expect(note3.colonnes).toBeNull();
        expect(note3.sousTableaux).toEqual([
            {
                cle: 'creances',
                intitule: 'Créances',
                colonnes: ['Date', 'Nom du client', 'Montant au 31 décembre', 'Montant au 1er janvier', 'Variation %'],
                ligneTotal: 'TOTAL DES CRÉANCES',
            },
            {
                cle: 'dettes',
                intitule: 'Dettes',
                colonnes: ['Date', 'Nom du fournisseur', 'Montant au 31 décembre', 'Montant au 1er janvier', 'Variation %'],
                ligneTotal: 'TOTAL DES DETTES',
            },
        ]);
    });
    it('les trois seuils de l’art. 13 sont exposés en F CFA, avec la clause « ou l’équivalent », et le CA se lit au 70', () => {
        expect(correspondance_smt_syscohada_1.SEUILS_SMT_ART13_FCFA.map((s) => [s.cle, s.montantFcfa])).toEqual([
            ['negoce', 60_000_000],
            ['artisanat', 40_000_000],
            ['services', 30_000_000],
        ]);
        expect(correspondance_smt_syscohada_1.CLAUSE_EQUIVALENT_ART13).toBe("ou l'équivalent dans l'unité monétaire ayant cours légal dans l'État partie");
        expect(correspondance_smt_syscohada_1.COMPTES_CHIFFRE_AFFAIRES_ART13).toBe(correspondance_compte_resultat_syscohada_1.PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA);
    });
    it('aucun cadratin nulle part dans la source (CLAUDE.md §4) · le caractère est écrit échappé pour ne pas le réintroduire', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'correspondance-smt-syscohada.ts'), 'utf8');
        expect(source).not.toMatch(/\u2014/);
    });
    it('passe R2, C1 · chaque tiers hors exploitation est ouvert au plan semé, en classe 4, et hors du périmètre de A et de B', () => {
        for (const t of correspondance_smt_syscohada_1.TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA) {
            const semes = FEUILLES_1_A_8.filter((c) => c.numero.startsWith(t.prefixe));
            expect({ prefixe: t.prefixe, ouvert: semes.length > 0 }).toEqual({ prefixe: t.prefixe, ouvert: true });
            for (const c of semes) {
                expect((0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)(c.numero)).toBe(false);
                expect(postesReclamant(c.numero).some((p) => p.ref === 'SA3' || p.ref === 'SP4')).toBe(true);
            }
        }
        expect((0, correspondance_smt_syscohada_1.dansPerimetreResultatSmt)('48510000')).toBe(true);
    });
});
//# sourceMappingURL=correspondance-smt-syscohada.spec.js.map