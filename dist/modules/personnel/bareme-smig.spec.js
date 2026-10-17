"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bareme_smig_1 = require("./bareme-smig");
describe('le décret n° 18/017, abrogé mais applicable avant mai 2025 (audit D2-C1)', () => {
    it('sa grille est CLOSE sur 7 075 FC · la classe 8 rétablie à 19 385,5', () => {
        const a = bareme_smig_1.ANNEXE_DECRET_18_017;
        expect(a.smigJournalierFc).toBe(7_075);
        bareme_smig_1.TENSIONS.forEach((t, i) => expect([i + 1, a.tauxParClasse[i]]).toEqual([i + 1, (t * 7_075) / 100]));
        expect(a.tauxParClasse[7]).toBe(19_385.5);
        expect(a.allocationFamilialeJournaliereFc).toBeCloseTo(7_075 / 27, 2);
        expect(a.contreValeurLogementJournaliereFc).toBeCloseTo(7_075 / 27 / 5, 2);
    });
    it('régit les paies de juillet 2019 à avril 2025, et dit ses réserves de lecture', () => {
        for (const mois of ['2019-07', '2022-06', '2025-04']) {
            const r = (0, bareme_smig_1.annexeApplicable)(mois);
            expect([mois, r.valeur?.smigJournalierFc]).toEqual([mois, 7_075]);
            expect(r.explication).toContain(bareme_smig_1.RESERVE_ANNEXE_18_017);
            expect(r.explication).toContain('décret n° 18/017');
        }
        expect((0, bareme_smig_1.annexeApplicable)('2025-05').valeur.smigJournalierFc).toBe(14_500);
        expect((0, bareme_smig_1.allocationFamilialeJournaliere)('2021-01', 2).valeur.totalFc).toBeCloseTo(2 * 262.04, 6);
    });
    it('ne rend le taux d’une classe qu’à ancienneté nulle · art. 7, 3 % au moins par année', () => {
        const sans = (0, bareme_smig_1.tauxJournalierDeLaClasse)(5, '2022-06');
        expect(sans.valeur).toBeNull();
        expect(sans.refus).toBe('MAJORATION_ANCIENNETE_NON_RENSEIGNEE');
        expect(sans.explication).toContain('3 %');
        expect((0, bareme_smig_1.tauxJournalierDeLaClasse)(5, '2022-06', [], 4).valeur).toBeNull();
        expect((0, bareme_smig_1.tauxJournalierDeLaClasse)(5, '2022-06', [], 0).valeur.tauxFc).toBe(12_593.5);
        expect((0, bareme_smig_1.tauxJournalierDeLaClasse)(5, '2026-01').valeur.tauxFc).toBe(38_270);
    });
});
describe('la transcription des annexes est CLOSE · c’est ce qui la prouve', () => {
    it('les trente-quatre taux valent tension × SMIG / 100, sans un écart', () => {
        for (const a of bareme_smig_1.ANNEXES) {
            expect(a.tauxParClasse).toHaveLength(bareme_smig_1.TENSIONS.length);
            a.tauxParClasse.forEach((taux, i) => {
                expect([a.numero, i + 1, taux]).toEqual([
                    a.numero,
                    i + 1,
                    (bareme_smig_1.TENSIONS[i] * a.smigJournalierFc) / 100,
                ]);
            });
            expect(a.tauxParClasse[0]).toBe(a.smigJournalierFc);
            expect(bareme_smig_1.TENSIONS[0]).toBe(100);
        }
    });
    it('les colonnes 19 et 20 valent SMIG/27 et son cinquième, au centime', () => {
        for (const a of bareme_smig_1.ANNEXES) {
            const af = a.smigJournalierFc / bareme_smig_1.DIVISEUR_ALLOCATION_FAMILIALE;
            expect(a.allocationFamilialeJournaliereFc).toBeCloseTo(af, bareme_smig_1.DECIMALES_ANNEXE);
            expect(a.contreValeurLogementJournaliereFc).toBeCloseTo(af / bareme_smig_1.DIVISEUR_CONTRE_VALEUR_LOGEMENT, bareme_smig_1.DECIMALES_ANNEXE);
        }
        expect(bareme_smig_1.ANNEXES[0].allocationFamilialeJournaliereFc).toBe(537.04);
        expect(bareme_smig_1.ANNEXES[0].contreValeurLogementJournaliereFc).toBe(107.41);
        expect(bareme_smig_1.ANNEXES[1].allocationFamilialeJournaliereFc).toBe(796.3);
        expect(bareme_smig_1.ANNEXES[1].contreValeurLogementJournaliereFc).toBe(159.26);
    });
    it('les sept catégories couvrent les dix-sept classes, sans trou ni doublon', () => {
        const classes = bareme_smig_1.CATEGORIES.flatMap((c) => c.classes);
        expect(classes).toEqual([...Array(17)].map((_, i) => i + 1));
        expect(bareme_smig_1.CATEGORIES).toHaveLength(7);
        for (const c of bareme_smig_1.CATEGORIES)
            expect([c.rang, c.echelons.length]).toEqual([c.rang, c.classes.length]);
        expect(bareme_smig_1.CATEGORIES[0].libelle).toBe('Manœuvre');
        expect(bareme_smig_1.CATEGORIES[0].echelons[0]).toBe('Ordinaire');
        expect(bareme_smig_1.CATEGORIES[6].libelle).toBe('Cadre de collaboration');
    });
    it('LA COLONNE 19 EST L’ALLOCATION FAMILIALE · l’article 5 fixe la numérotation', () => {
        expect(bareme_smig_1.COLONNE_ALLOCATIONS_FAMILIALES).toBe(19);
        expect(bareme_smig_1.COLONNE_CONTRE_VALEUR_LOGEMENT).toBe(20);
        expect((0, bareme_smig_1.colonneDeLaClasse)(1)).toBe(2);
        expect((0, bareme_smig_1.colonneDeLaClasse)(17)).toBe(18);
        expect((0, bareme_smig_1.colonneDeLaClasse)(bareme_smig_1.TENSIONS.length) + 1).toBe(bareme_smig_1.COLONNE_ALLOCATIONS_FAMILIALES);
    });
});
describe('l’article 2 fixe, l’article 3 échelonne, et L’ANNEXE TRANCHE', () => {
    it('le SMIG de l’article 2 reste 21 500 depuis le 30 mai 2025', () => {
        expect(bareme_smig_1.SMIG_JOURNALIER_FC).toBe(21_500);
        expect(bareme_smig_1.DECRET_SMIG.entreEnVigueurLe).toBe('2025-05-30');
        expect(bareme_smig_1.DECRET_SMIG.formuleEntreeEnVigueur).toContain('à la date de sa signature');
    });
    it('MAIS LES GRANDEURS DÉRIVÉES S’ASSIENT SUR LE MONTANT PAYÉ, pas sur 21 500', () => {
        const mai = (0, bareme_smig_1.allocationFamilialeJournaliere)('2025-06').valeur;
        expect(mai.parEnfantFc).toBe(537.04);
        expect(mai.parEnfantFc).toBeCloseTo(14_500 / 27, 2);
        expect(mai.parEnfantFc).not.toBeCloseTo(21_500 / 27, 1);
        const apres = (0, bareme_smig_1.allocationFamilialeJournaliere)('2026-02').valeur;
        expect(apres.parEnfantFc).toBe(796.3);
    });
    it('le taux du manœuvre ordinaire suit le palier, classe 1 en tête', () => {
        expect((0, bareme_smig_1.tauxJournalierDeLaClasse)(1, '2025-06').valeur.tauxFc).toBe(14_500);
        expect((0, bareme_smig_1.tauxJournalierDeLaClasse)(1, '2025-12').valeur.tauxFc).toBe(14_500);
        expect((0, bareme_smig_1.tauxJournalierDeLaClasse)(1, '2026-01').valeur.tauxFc).toBe(21_500);
    });
    it('rend la classe AVEC sa catégorie, son échelon et sa colonne', () => {
        const m = (0, bareme_smig_1.tauxJournalierDeLaClasse)(12, '2026-01').valeur;
        expect(m.categorie.libelle).toBe('Maîtrise');
        expect(m.categorie.rang).toBe('VI');
        expect(m.echelon).toBe('3');
        expect(m.tension).toBe(488);
        expect(m.tauxFc).toBe(104_920);
        expect(m.colonne).toBe(13);
    });
    it('NE MONTE PAS AU-DESSUS DU CADRE DE COLLABORATION · rien ne s’extrapole', () => {
        const r = (0, bareme_smig_1.tauxJournalierDeLaClasse)(18, '2026-01');
        expect(r.valeur).toBeNull();
        expect(r.refus).toBe('CLASSE_HORS_BAREME');
        expect(r.explication).toContain('cadre de collaboration');
        expect((0, bareme_smig_1.tauxJournalierDeLaClasse)(0, '2026-01').refus).toBe('CLASSE_HORS_BAREME');
    });
    it('NE RECONSTITUE RIEN avant juillet 2019, et dit le motif vrai', () => {
        const s1 = (0, bareme_smig_1.annexeApplicable)('2019-03');
        expect(s1.valeur).toBeNull();
        expect(s1.refus).toBe('ANTERIEUR_AU_DECRET');
        expect(s1.explication).toContain('agro-industriel');
        expect((0, bareme_smig_1.annexeApplicable)('2018-09').explication).toContain('suivant l\'annexe');
        expect((0, bareme_smig_1.annexeApplicable)('2017-06').explication).toContain('08/040');
        expect((0, bareme_smig_1.allocationFamilialeJournaliere)('2019-06').valeur).toBeNull();
    });
    it('refuse un mois mal formé plutôt que d’en deviner un', () => {
        expect((0, bareme_smig_1.annexeApplicable)('2025-13').refus).toBe('MOIS_MAL_FORME');
        expect((0, bareme_smig_1.annexeApplicable)('mai 2025').refus).toBe('MOIS_MAL_FORME');
        expect((0, bareme_smig_1.annexeApplicable)('2025-5').refus).toBe('MOIS_MAL_FORME');
    });
});
describe('les deux grandeurs dérivées', () => {
    it('l’allocation est servie PAR ENFANT, et le total suit le nombre', () => {
        const a = (0, bareme_smig_1.allocationFamilialeJournaliere)('2026-01', 5).valeur;
        expect(a.parEnfantFc).toBe(796.3);
        expect(a.totalFc).toBeCloseTo(5 * 796.3, 6);
        expect(a.colonne).toBe(19);
    });
    it('DIT QUE LES CONDITIONS DE SUSPENSION NE SONT PAS AU CORPUS', () => {
        const e = (0, bareme_smig_1.allocationFamilialeJournaliere)('2026-01').explication;
        expect(e).toContain('CONDITIONS DE SUSPENSION');
        expect(e).toContain('137/CAB/MINETAT/MTEPS/01/2018');
    });
    it('LA CONTRE-VALEUR DU LOGEMENT SE CALCULE SUR L’ALLOCATION, PAS SUR LE SMIG', () => {
        const c = (0, bareme_smig_1.contreValeurLogementJournaliere)('2026-01').valeur;
        expect(c.montantFc).toBe(159.26);
        expect(c.montantFc).toBeCloseTo(21_500 / 27 / 5, 2);
        expect(c.montantFc).not.toBeCloseTo(21_500 / 5, 2);
        expect(c.montantFc * 27).toBeCloseTo(21_500 / 5, 0);
    });
    it('DIT QUE C’EST UNE DÉFALCATION, et nomme SES DEUX TEXTES (audit D2-C8)', () => {
        const e = (0, bareme_smig_1.contreValeurLogementJournaliere)('2026-01').explication;
        expect(e).toContain('DÉFALCATION');
        expect(e).toContain('de la RÉMUNÉRATION dès que le logement est fourni en nature (arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10)');
        expect(e).toContain('MUTATION (décret n° 25/21, art. 15)');
        expect(bareme_smig_1.DECRET_MODALITES.defalcationLogementEnNature).toContain('arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10');
        expect(bareme_smig_1.DECRET_MODALITES.defalcationLogementEnNature).toContain('mutation');
    });
});
describe('article 7 · les trois multiplicateurs sont dans le texte', () => {
    it('6, 26 et 312 · fixes, et non tirés du calendrier', () => {
        expect(bareme_smig_1.MULTIPLICATEURS_ARTICLE_7).toEqual({ SEMAINE: 6, MOIS: 26, ANNEE: 312 });
        expect((0, bareme_smig_1.valeurPeriodique)(21_500, 'MOIS')).toBe(559_000);
        expect((0, bareme_smig_1.valeurPeriodique)(14_500, 'MOIS')).toBe(377_000);
        expect((0, bareme_smig_1.valeurPeriodique)(21_500, 'ANNEE')).toBe(6_708_000);
        expect(bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS * 12).toBe(bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.ANNEE);
    });
    it('ILS VALENT POUR LES TROIS GRANDEURS · l’article les nomme toutes', () => {
        const af = (0, bareme_smig_1.allocationFamilialeJournaliere)('2026-01').valeur.parEnfantFc;
        expect((0, bareme_smig_1.valeurPeriodique)(af, 'MOIS')).toBeCloseTo(796.3 * 26, 6);
        const cv = (0, bareme_smig_1.contreValeurLogementJournaliere)('2026-01').valeur.montantFc;
        expect((0, bareme_smig_1.valeurPeriodique)(cv, 'ANNEE')).toBeCloseTo(159.26 * 312, 6);
    });
    it('NE DONNE AUCUN TAUX HORAIRE, et le dépôt ne le divise pas', () => {
        expect(Object.values(bareme_smig_1.MULTIPLICATEURS_ARTICLE_7).every((m) => m > 1)).toBe(true);
    });
});
describe('le décret compagnon n° 25/21, et ce qui manque encore', () => {
    it('porte les modalités que le n° 25/22 vise, avec ses deux seuils', () => {
        expect(bareme_smig_1.DECRET_MODALITES.reference).toContain('25/21');
        expect(bareme_smig_1.DECRET_MODALITES.entreEnVigueurLe).toBe('2025-05-30');
        expect(bareme_smig_1.DECRET_MODALITES.seuilAjustementIpcPourCent).toBe(50);
        expect(bareme_smig_1.DECRET_MODALITES.moisDAjustement).toBe('janvier');
        expect(bareme_smig_1.DECRET_MODALITES.abroge).toContain('079/2002');
    });
    it('LES ANNEXES SONT POSTÉRIEURES AU DÉCRET · elles sont du 17 septembre 2025', () => {
        expect(bareme_smig_1.DECRET_SMIG.signeLe).toBe('2025-05-30');
        expect(bareme_smig_1.DECRET_SMIG.annexesArreteesLe).toBe('2025-09-17');
        expect(bareme_smig_1.DECRET_SMIG.publieAu).toContain('28 octobre 2025');
    });
    it('AVERTIT QUE LES ANNEXES ONT UNE FIN · un ajustement se prend chaque janvier', () => {
        expect(bareme_smig_1.ANNEXES[1].auMoisDePaie).toBeNull();
    });
});
//# sourceMappingURL=bareme-smig.spec.js.map