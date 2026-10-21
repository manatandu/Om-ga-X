"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const livre_de_paie_1 = require("./livre-de-paie");
const TOUTES = livre_de_paie_1.MENTIONS_MODELE_2008.map((m) => m.rang);
describe("Les trente mentions de l'article 25, recopiées", () => {
    it('en porte exactement trente, numérotées de 1 à 30 sans trou', () => {
        expect(livre_de_paie_1.MENTIONS_ARTICLE_25).toHaveLength(30);
        expect(livre_de_paie_1.MENTIONS_ARTICLE_25.map((m) => m.rang)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    });
    it('porte les quatre mentions que les autres modules alimentent', () => {
        const libelle = (rang) => livre_de_paie_1.MENTIONS_ARTICLE_25[rang - 1].libelle;
        expect(libelle(19)).toContain('pension');
        expect(libelle(23)).toContain('retenue fiscale');
        expect(libelle(27)).toContain('allocations familiales');
        expect(libelle(29)).toContain('pris en considération pour le calcul des cotisations');
    });
    it("n'a aucun libellé vide ni dupliqué", () => {
        const libelles = livre_de_paie_1.MENTIONS_ARTICLE_25.map((m) => m.libelle);
        expect(libelles.every((l) => l.trim().length > 3)).toBe(true);
        expect(new Set(libelles).size).toBe(30);
    });
});
describe("L'arrêté du modèle · AU CORPUS depuis le 19/09/2026", () => {
    it('porte son numéro, son signataire, et ce qu\'il abroge', () => {
        expect(livre_de_paie_1.ARRETE_DU_MODELE.reference).toContain('12/CAB.MIN/ETPS/042');
        expect(livre_de_paie_1.ARRETE_DU_MODELE.reference).toContain('8 août 2008');
        expect(livre_de_paie_1.ARRETE_DU_MODELE.lu).toBe(true);
        expect(livre_de_paie_1.ARRETE_DU_MODELE.signataire).toBe('Marie Ange Lukiana Mufwankolo');
        expect(livre_de_paie_1.ARRETE_DU_MODELE.abroge).toContain('17/67');
        expect(livre_de_paie_1.ARRETE_DU_MODELE.viseParLeCodeDuTravail).toEqual([
            'article 103',
            'article 214',
            'article 215',
        ]);
    });
    it('ne certifie TOUJOURS PAS la conformité au modèle, et pour une autre raison', () => {
        const v = (0, livre_de_paie_1.livreDePaie)({
            siegeDExploitation: 'Kinshasa / Gombe',
            formeDuDocument: 'FICHIER_INFORMATISE',
            effectifHabituel: 12,
            mentionsPortees: TOUTES,
        });
        expect(v.mentionsManquantes).toHaveLength(0);
        expect(v.mentionsPorteesCount).toBe(33);
        expect(v.enonciationsCompletes).toBe(true);
        expect(v.conformiteAuModeleCertifiee).toBe(false);
        expect(v.refus.map((r) => r.motif)).toContain('MISE_EN_FORME_NON_VERIFIABLE');
        expect(v.refus.map((r) => r.motif)).not.toContain('ENONCIATIONS_INCOMPLETES');
    });
    it("dit pourquoi la mise en forme ne se vérifie pas depuis une liste", () => {
        expect(livre_de_paie_1.RESERVE_MISE_EN_FORME).toMatch(/MODÈLE ANNEXÉ/);
        expect(livre_de_paie_1.RESERVE_MISE_EN_FORME).toMatch(/mise en forme/i);
        expect(livre_de_paie_1.RESERVE_MISE_EN_FORME).toMatch(/jamais certifiée/i);
    });
    it("garde la liste de l'arrêté n° 146/2018, qui est une AUTRE liste", () => {
        expect(livre_de_paie_1.MENTIONS_ARTICLE_25).toHaveLength(30);
        expect(livre_de_paie_1.MENTIONS_MODELE_2008).toHaveLength(33);
    });
});
describe("Les trente-trois énonciations de l'article 1er", () => {
    it('sont numérotées de 1 à 33 sans trou et sans doublon', () => {
        expect(TOUTES).toEqual(Array.from({ length: 33 }, (_, i) => i + 1));
        expect(new Set(livre_de_paie_1.MENTIONS_MODELE_2008.map((m) => m.libelle)).size).toBe(33);
    });
    it('nomment le SAMEDI, que la liste de la sécurité sociale ne nomme pas', () => {
        expect(livre_de_paie_1.MENTIONS_MODELE_2008[10].libelle).toContain('samedi');
        expect(livre_de_paie_1.MENTIONS_ARTICLE_25[8].libelle).not.toContain('samedi');
    });
    it("visent l'INSTITUT NATIONAL DE SÉCURITÉ SOCIALE, nom de 2008", () => {
        expect(livre_de_paie_1.MENTIONS_MODELE_2008[3].libelle).toContain('Institut National de Sécurité Sociale');
    });
});
describe('Les trois formules de somme, et ce que la première démontre', () => {
    it('ferment le brut, les déductions et les jours', () => {
        expect(livre_de_paie_1.FORMULES_DU_MODELE.brut).toEqual({ rang: 20, composantes: [7, 10, 11, 12, 13, 16, 19] });
        expect(livre_de_paie_1.FORMULES_DU_MODELE.totalDesDeductions).toEqual({
            rang: 26,
            composantes: [21, 22, 23, 24, 25],
        });
        expect(livre_de_paie_1.FORMULES_DU_MODELE.joursDAllocationsFamiliales).toEqual({
            rang: 28,
            composantes: [6, 14, 17],
        });
    });
    it('EXCLUENT les allocations familiales du brut · le modèle corrobore l\'article 7', () => {
        for (const rang of [27, 28, 29, 30]) {
            expect(livre_de_paie_1.FORMULES_DU_MODELE.brut.composantes).not.toContain(rang);
        }
        expect(livre_de_paie_1.FORMULES_DU_MODELE.brut.composantes).not.toContain(22);
        expect(livre_de_paie_1.FORMULES_DU_MODELE.totalDesDeductions.composantes).toContain(22);
    });
    it("n'inclut aucune composante hors de la liste des trente-trois", () => {
        const toutes = new Set(TOUTES);
        for (const f of Object.values(livre_de_paie_1.FORMULES_DU_MODELE)) {
            for (const c of f.composantes)
                expect(toutes.has(c)).toBe(true);
            expect(toutes.has(f.rang)).toBe(true);
            expect(f.composantes).not.toContain(f.rang);
        }
    });
});
describe("LE FICHIER INFORMATISÉ EST UNE FORME DU LIVRE, pas un autre document", () => {
    it("N'EXIGE PLUS d'autorisation pour un fichier informatisé", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({
            siegeDExploitation: 'Lubumbashi',
            formeDuDocument: 'FICHIER_INFORMATISE',
            mentionsPortees: TOUTES,
        });
        expect(v.remplacementAutorise).toBe(true);
        expect(v.refus.map((r) => r.motif)).not.toContain('AUTORISATION_INSPECTEUR_ABSENTE');
    });
    it("ne l'exige pas davantage pour le livre papier", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({
            siegeDExploitation: 'Lubumbashi',
            formeDuDocument: 'LIVRE_PAPIER',
            mentionsPortees: TOUTES,
        });
        expect(v.remplacementAutorise).toBe(true);
    });
    it("l'exige pour TOUT AUTRE DOCUMENT, et le dit avec l'article 1er", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({
            siegeDExploitation: 'Lubumbashi',
            formeDuDocument: 'AUTRE_DOCUMENT',
            mentionsPortees: TOUTES,
        });
        expect(v.remplacementAutorise).toBe(false);
        const refus = v.refus.find((r) => r.motif === 'AUTORISATION_INSPECTEUR_ABSENTE');
        expect(refus.explication).toMatch(/Inspecteur du Travail/i);
        expect(refus.explication).toMatch(/OU FICHIER INFORMATISÉ/);
        expect((0, livre_de_paie_1.livreDePaie)({
            siegeDExploitation: 'Lubumbashi',
            formeDuDocument: 'AUTRE_DOCUMENT',
            autorisationInspecteurDuTravail: true,
            mentionsPortees: TOUTES,
        }).remplacementAutorise).toBe(true);
    });
    it("NE SUPPOSE PAS le fichier informatisé quand la forme n'est pas déclarée", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({ siegeDExploitation: 'Matadi', mentionsPortees: TOUTES });
        expect(v.remplacementAutorise).toBe(false);
        expect(v.refus.map((r) => r.motif)).toContain('AUTORISATION_INSPECTEUR_ABSENTE');
    });
    it("ne prend PAS l'absence de réponse pour une autorisation", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({
            siegeDExploitation: 'Matadi',
            formeDuDocument: 'AUTRE_DOCUMENT',
            autorisationInspecteurDuTravail: null,
        });
        expect(v.remplacementAutorise).toBe(false);
    });
});
describe("L'article 213 · un livre par siège, et une seule dispense", () => {
    it('exige la désignation du siège', () => {
        const v = (0, livre_de_paie_1.livreDePaie)({ autorisationInspecteurDuTravail: true });
        expect(v.refus.map((r) => r.motif)).toContain('SIEGE_DEXPLOITATION_NON_DESIGNE');
    });
    it("ne dispense QUE l'employeur de personnel exclusivement domestique", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({ exclusivementPersonnelDomestique: true });
        expect(v.livreDu).toBe(false);
        expect(v.refus.map((r) => r.motif)).not.toContain('AUTORISATION_INSPECTEUR_ABSENTE');
        expect(v.refus.map((r) => r.motif)).not.toContain('SIEGE_DEXPLOITATION_NON_DESIGNE');
        expect(v.refus.map((r) => r.motif)).not.toContain('ENONCIATIONS_INCOMPLETES');
        expect(v.refus.map((r) => r.motif)).toContain('MISE_EN_FORME_NON_VERIFIABLE');
    });
});
describe("L'article 215, alinéa 3 · le seuil de vingt-cinq, CONTRE celui de l'arrêté", () => {
    it('retient le seuil de la LOI, pas celui de l\'arrêté', () => {
        expect(livre_de_paie_1.EFFECTIF_LIVRE_INSPIRE).toBe(25);
        expect(livre_de_paie_1.EFFECTIF_LIVRE_INSPIRE_ARRETE).toBe(10);
        expect((0, livre_de_paie_1.livreDePaie)({ effectifHabituel: 15 }).livreInspireAdmis).toBe(true);
        expect(livre_de_paie_1.RESERVE_CONTRADICTION_DE_SEUIL).toMatch(/UN ARRÊTÉ NE DÉROGE PAS À LA LOI/);
        expect(livre_de_paie_1.RESERVE_CONTRADICTION_DE_SEUIL).toMatch(/OmegaX retient VINGT-CINQ/);
    });
    it('est un seuil STRICT · vingt-cinq travailleurs ne donne pas le régime allégé', () => {
        expect((0, livre_de_paie_1.livreDePaie)({ effectifHabituel: 24 }).livreInspireAdmis).toBe(true);
        expect((0, livre_de_paie_1.livreDePaie)({ effectifHabituel: 25 }).livreInspireAdmis).toBe(false);
        expect((0, livre_de_paie_1.livreDePaie)({ effectifHabituel: 26 }).livreInspireAdmis).toBe(false);
    });
    it("ne l'accorde pas quand l'effectif n'est pas déclaré", () => {
        expect((0, livre_de_paie_1.livreDePaie)({}).livreInspireAdmis).toBe(false);
    });
});
describe('Ce que le document ne porte pas', () => {
    it('énumère nommément les mentions manquantes, et REFUSE', () => {
        const v = (0, livre_de_paie_1.livreDePaie)({ mentionsPortees: [1, 2, 3] });
        expect(v.mentionsPorteesCount).toBe(3);
        expect(v.mentionsManquantes).toHaveLength(30);
        expect(v.mentionsManquantes.map((m) => m.rang)).toContain(32);
        expect(v.enonciationsCompletes).toBe(false);
        const refus = v.refus.find((r) => r.motif === 'ENONCIATIONS_INCOMPLETES');
        expect(refus.explication).toMatch(/liste est FERMÉE/i);
        expect(refus.explication).toMatch(/AUTANT DE FOIS/);
    });
    it('compte zéro quand rien n\'est déclaré', () => {
        expect((0, livre_de_paie_1.livreDePaie)({}).mentionsManquantes).toHaveLength(33);
    });
    it("ne reproche rien à l'employeur de personnel exclusivement domestique", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({ exclusivementPersonnelDomestique: true });
        expect(v.refus.map((r) => r.motif)).not.toContain('ENONCIATIONS_INCOMPLETES');
    });
});
describe("L'article 2 de l'arrêté · les deux doubles et le décompte à la rupture", () => {
    it('donne la destination des deux doubles de l\'article 214', () => {
        expect(livre_de_paie_1.DESTINATION_DES_DOUBLES.premier).toMatch(/TRAVAILLEUR/);
        expect(livre_de_paie_1.DESTINATION_DES_DOUBLES.premier).toMatch(/à chaque paie/i);
        expect(livre_de_paie_1.DESTINATION_DES_DOUBLES.second).toBe('à la CNSS, selon la réglementation en vigueur');
        expect(livre_de_paie_1.TEXTE_ARTICLE_2_SECOND_DOUBLE).toContain("l'Institut National de Sécurité Sociale");
        expect(livre_de_paie_1.TEXTE_ARTICLE_2_SECOND_DOUBLE).toContain('18/027');
    });
    it('porte le décompte dû à la RUPTURE, en plus du bulletin', () => {
        expect(livre_de_paie_1.DECOMPTE_A_LA_RUPTURE).toMatch(/POUR QUELQUE CAUSE QUE CE SOIT/);
        expect(livre_de_paie_1.DECOMPTE_A_LA_RUPTURE).toMatch(/SECONDE échéance/i);
        expect(livre_de_paie_1.DECOMPTE_A_LA_RUPTURE).toContain('103');
    });
    it("est rendu dans les réserves de tout verdict", () => {
        const v = (0, livre_de_paie_1.livreDePaie)({});
        expect(v.reserves).toContain(livre_de_paie_1.DECOMPTE_A_LA_RUPTURE);
        expect(v.reserves).toContain(livre_de_paie_1.EXIGENCE_INALTERABILITE);
        expect(v.reserves).toContain(livre_de_paie_1.SANCTION_ARTICLE_328);
    });
});
describe("L'article 4 · l'écriture indélébile devenue inaltérabilité", () => {
    it('vise TOUTE forme, fichier informatisé compris', () => {
        expect(livre_de_paie_1.EXIGENCE_INALTERABILITE).toMatch(/QUELLE QUE SOIT LA FORME ADOPTÉE/);
        expect(livre_de_paie_1.EXIGENCE_INALTERABILITE).toMatch(/INALTÉRABILITÉ/);
    });
});
describe("L'article 328 a) · l'amende se multiplie par les omissions", () => {
    it('le dit, et signale l\'anomalie du renvoi 323 (9)', () => {
        expect(livre_de_paie_1.SANCTION_ARTICLE_328).toMatch(/AUTANT DE FOIS QU'IL Y A DE TRAVAILLEURS/);
        expect(livre_de_paie_1.SANCTION_ARTICLE_328).toMatch(/cinquante fois/i);
        expect(livre_de_paie_1.SANCTION_ARTICLE_328).toMatch(/qui n'existe pas/i);
    });
});
describe("L'article 103 et sa sanction probatoire", () => {
    it('dit le renversement de la charge de la preuve, et ses trois échappatoires', () => {
        expect(livre_de_paie_1.SANCTION_ARTICLE_103).toMatch(/SONT REJETÉES/);
        expect(livre_de_paie_1.SANCTION_ARTICLE_103).toMatch(/AU MOMENT DU PAIEMENT/);
        expect(livre_de_paie_1.SANCTION_ARTICLE_103).toMatch(/faute du travailleur/i);
        expect(livre_de_paie_1.SANCTION_ARTICLE_103).toMatch(/commencement de preuve/i);
        expect(livre_de_paie_1.SANCTION_ARTICLE_103).toMatch(/aveu du travailleur/i);
    });
    it("dit que « pour solde de tout compte » ne clôt rien", () => {
        expect(livre_de_paie_1.RESERVE_ARTICLE_104).toMatch(/NE VALENT PAS renonciation/i);
        expect(livre_de_paie_1.RESERVE_ARTICLE_104).toContain('317');
    });
});
describe("L'article 214", () => {
    it('porte le minimum de deux doubles détachables', () => {
        expect(livre_de_paie_1.DOUBLES_DETACHABLES_MINIMUM).toBe(2);
    });
});
describe("Passe D2 · l'arrêté n° 142/2018, second texte du bulletin de paie", () => {
    it('porte trente-trois mentions, avec les mêmes trois formules de somme que 2008', () => {
        expect(livre_de_paie_1.MENTIONS_ARRETE_142_2018.map((m) => m.rang)).toEqual(Array.from({ length: 33 }, (_, i) => i + 1));
        expect(livre_de_paie_1.MENTIONS_ARRETE_142_2018[19].libelle).toContain('7, 10, 11, 12, 13,16 et 19');
        expect(livre_de_paie_1.MENTIONS_ARRETE_142_2018[25].libelle).toContain('21, 22, 23,24 et 25');
        expect(livre_de_paie_1.MENTIONS_ARRETE_142_2018[27].libelle).toContain('6, 14 et 17');
    });
    it('nomme ses écarts avec 2008 sans les trancher', () => {
        expect(livre_de_paie_1.MENTIONS_ARRETE_142_2018[3].libelle).toContain('caisse de sécurité sociale');
        expect(livre_de_paie_1.MENTIONS_ARRETE_142_2018[10].libelle).not.toContain('samedi');
        expect(livre_de_paie_1.MENTIONS_ARRETE_142_2018[26].libelle).toContain('extra-légales');
        expect(livre_de_paie_1.ECARTS_2008_2018.map((e) => e.rangs)).toEqual(['4', '11', '16 et 17', '24', '27 à 30']);
    });
});
//# sourceMappingURL=livre-de-paie.spec.js.map