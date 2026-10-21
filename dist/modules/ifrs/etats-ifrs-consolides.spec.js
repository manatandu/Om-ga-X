"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const etats_ifrs_1 = require("./etats-ifrs");
const etats_ifrs_consolides_1 = require("./etats-ifrs-consolides");
const rubriques_ifrs_1 = require("./rubriques-ifrs");
const L = (cle, solde, poste = !/^\d/.test(cle)) => ({ cle, intitule: `Ligne ${cle}`, solde, poste });
const cumul = (extra = [], cp = {}) => ({
    lignes: [
        L('24100000', 1000), L('52100000', 200), L('40100000', -300), L('70100000', -900), L('60100000', 600),
        L('ECART_ACQUISITION', 100), L('AMORTISSEMENT_ECART_ACQUISITION', -20), L('DOTATION_ECART_ACQUISITION', 10),
        L('CAPITAL', -500), L('RESERVES_GROUPE', -130), L('INTERETS_MINORITAIRES', -60),
        ...extra,
    ],
    capitauxPropres: {
        capital: 500, primes: 0, ecartsReevaluation: 0, reservesGroupe: 130, ecartsConversion: 0,
        resultatGroupe: 250, interetsMinoritairesHorsResultat: 60, resultatMinoritaires: 40, resultatEnsemble: 290, ...cp,
    },
    conversions: [],
});
const REGLES = [
    { prefixe: '24', rubrique: 'SF_IMMOBILISATIONS_CORPORELLES' }, { prefixe: '52', rubrique: 'SF_TRESORERIE' },
    { prefixe: '40', rubrique: 'SF_FOURNISSEURS' }, { prefixe: '70', rubrique: 'PL_PRODUITS' }, { prefixe: '60', rubrique: 'PL_ACHATS_CONSOMMES' },
];
const DOTATION = [{ poste: 'DOTATION_ECART_ACQUISITION', rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES' }];
const EX = { dateDebut: new Date('2026-01-01') };
const ANNULATION = {
    id: 'g',
    libelle: 'Annulation de l’amortissement de l’écart d’acquisition',
    fondement: 'IFRS 3 § B63 a, IAS 36 § 90',
    lignes: [
        { rubrique: 'SF_GOODWILL', montant: 20 },
        { rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: -10 },
        { rubrique: 'SF_RESERVES', montant: -10 },
    ],
    partMinoritairesResultat: 0,
    partMinoritairesCapitauxPropres: 0,
};
const jouer = (retr = [], c = cumul(), regles = DOTATION) => (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)(EX, c, REGLES, regles, retr, 'AUCUNE');
const X = (xs, cle) => xs.find((x) => x.cle === cle);
describe('IFRS consolidés · la balance du D4C projetée, la part des minoritaires répartie', () => {
    const e = jouer();
    it('§ 104 · capitaux propres des propriétaires, puis participations ne donnant pas le contrôle, et l’état boucle', () => {
        expect(X(e.situation, 'SF_GOODWILL').ifrs).toBe(80);
        expect(X(e.situation, 'SF_RESULTAT')).toMatchObject({ legal: 250, ifrs: 250 });
        expect(X(e.situation, 'TOTAL_CAPITAUX_PROPRES_PROPRIETAIRES').ifrs).toBe(880);
        expect(X(e.situation, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE')).toMatchObject({ legal: 100, retraitements: 0, ifrs: 100 });
        expect(X(e.situation, 'TOTAL_CAPITAUX_PROPRES').ifrs).toBe(980);
        expect(X(e.situation, 'TOTAL_ACTIF').ifrs).toBe(1280);
        expect(e.controles.every((c) => c.ok)).toBe(true);
        const cp = e.situation.map((l) => l.cle);
        expect(cp.indexOf('TOTAL_CAPITAUX_PROPRES_PROPRIETAIRES')).toBeLessThan(cp.indexOf('SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE'));
    });
    it('§ 76 et § 87 · le résultat net et le résultat global répartis sous leur total', () => {
        expect(X(e.resultat, 'RESULTAT_NET').ifrs).toBe(290);
        expect(X(e.resultat, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(40);
        expect(X(e.resultat, 'RN_PROPRIETAIRES').ifrs).toBe(250);
        const cles = e.resultat.map((l) => l.cle);
        expect(cles.slice(-3)).toEqual(['RESULTAT_NET', 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE', 'RN_PROPRIETAIRES']);
        expect(X(e.resultatGlobal, 'RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(40);
        expect(X(e.resultatGlobal, 'RG_PROPRIETAIRES').ifrs).toBe(250);
    });
    it('une consolidation D4C incomplète rend le jeu IFRS non publiable, avec son motif', () => {
        const c = { ...cumul(), impotsDifferesIncomplets: ['Filiale B · taux non déclaré'], conversionsIncompletes: ['Filiale C · monnaie non déclarée'], retraitementsNonJoues: ['Dividendes non déclarés'] };
        const m = jouer([ANNULATION], c).motifsNonPubliable;
        expect(m).toContain('Consolidation · impôts différés incomplets · Filiale B · taux non déclaré');
        expect(m).toContain('Consolidation · conversion · Filiale C · monnaie non déclarée');
        expect(m).toContain('Consolidation · retraitement non joué · Dividendes non déclarés');
    });
    it('les postes rangés par IFRS 18 et les postes déclarés sont rendus avec leur rubrique', () => {
        expect(e.postes.find((p) => p.poste === 'ECART_ACQUISITION')).toMatchObject({ rubrique: 'SF_GOODWILL', declare: false });
        expect(e.postes.find((p) => p.poste === 'DOTATION_ECART_ACQUISITION')).toMatchObject({ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', declare: true });
        expect(X(e.resultat, 'PL_AUTRES_CHARGES_OPERATIONNELLES').legal).toBe(-10);
    });
    it('IFRS 3 § B63 a · l’amortissement de l’écart d’acquisition rend le jeu non publiable tant qu’il n’est pas retraité', () => {
        expect(e.motifsNonPubliable.some((m) => /AUDCIF art\. 82 · IFRS 3 § B63 a/.test(m))).toBe(true);
        const r = jouer([ANNULATION]);
        expect(r.motifsNonPubliable.some((m) => /IFRS 3 § B63 a/.test(m))).toBe(false);
        expect(X(r.situation, 'SF_GOODWILL').ifrs).toBe(100);
        expect(X(r.resultat, 'RESULTAT_NET').ifrs).toBe(300);
        expect(X(r.resultat, 'RN_PROPRIETAIRES').ifrs).toBe(260);
        expect(X(r.situation, 'SF_RESERVES').ifrs).toBe(140);
        expect(X(r.situation, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(100);
        expect(r.controles.every((c) => c.ok)).toBe(true);
    });
    it('IFRS 10 § B94 · la part déclarée des minoritaires passe des propriétaires aux minoritaires, sans rien changer au total', () => {
        const depreciation = {
            id: 'd',
            libelle: 'Dépréciation d’un équipement de la filiale',
            fondement: 'IAS 36 § 59',
            lignes: [{ rubrique: 'PL_AUTRES_CHARGES_OPERATIONNELLES', montant: 30 }, { rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: -30 }, { rubrique: 'SF_RESERVES', montant: 5 }, { rubrique: 'SF_TRESORERIE', montant: -5 }],
            partMinoritairesResultat: -12,
            partMinoritairesCapitauxPropres: -2,
        };
        const r = jouer([ANNULATION, depreciation]);
        expect(X(r.resultat, 'RESULTAT_NET').ifrs).toBe(270);
        expect(X(r.resultat, 'RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE')).toMatchObject({ legal: 40, retraitements: -12, ifrs: 28 });
        expect(X(r.resultat, 'RN_PROPRIETAIRES').ifrs).toBe(242);
        expect(X(r.situation, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE')).toMatchObject({ legal: 100, retraitements: -14, ifrs: 86 });
        expect(X(r.situation, 'SF_RESERVES')).toMatchObject({ legal: 130, retraitements: 7, ifrs: 137 });
        expect(X(r.resultatGlobal, 'RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(28);
        expect(r.controles.every((c) => c.ok)).toBe(true);
    });
    it('§ 87 · la part des minoritaires d’un autre élément du résultat global leur est attribuée, et retirée aux propriétaires', () => {
        const reevaluation = {
            id: 'o',
            libelle: 'Réévaluation d’un terrain de la filiale',
            fondement: 'IAS 16 § 39',
            lignes: [{ rubrique: 'SF_IMMOBILISATIONS_CORPORELLES', montant: 50 }, { rubrique: 'OCI_NR_AUTRES', montant: -50 }],
            partMinoritairesOci: 10,
        };
        const r = jouer([reevaluation]);
        expect(X(r.resultatGlobal, 'RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE')).toMatchObject({ legal: 40, retraitements: 10, ifrs: 50 });
        expect(X(r.resultatGlobal, 'RG_PROPRIETAIRES')).toMatchObject({ legal: 250, retraitements: 40, ifrs: 290 });
        expect(X(r.situation, 'SF_OCI_EXERCICE').ifrs).toBe(40);
        expect(X(r.situation, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').ifrs).toBe(110);
        expect(X(r.situation, 'TOTAL_CAPITAUX_PROPRES').ifrs).toBe(1030);
        expect(r.controles.every((c) => c.ok)).toBe(true);
    });
    it('un effet sans sa part des minoritaires, une part de trop ou de signe contraire, est refusé', () => {
        const base = { ...ANNULATION, partMinoritairesResultat: null };
        expect(() => jouer([base])).toThrow(/effet au résultat net \(10\).*IFRS 10 § B94/);
        expect(() => jouer([{ ...ANNULATION, partMinoritairesResultat: 11 }])).toThrow(/ne le dépasse pas/);
        expect(() => jouer([{ ...ANNULATION, partMinoritairesResultat: -3 }])).toThrow(/a le signe de l’effet/);
        expect(() => jouer([{ ...ANNULATION, partMinoritairesOci: 1 }])).toThrow(/sans effet aux autres éléments/);
        expect(() => jouer([{ ...ANNULATION, lignes: [{ rubrique: 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE', montant: 5 }, { rubrique: 'SF_RESERVES', montant: -5 }] }])).toThrow(etats_ifrs_1.RefusIfrs);
    });
    it('en comptes individuels, une part des minoritaires est refusée et la rubrique n’existe pas', () => {
        const b = [{ numero: '24100000', intitule: 'x', solde: 10 }, { numero: '10100000', intitule: 'y', solde: -10 }];
        const r = [{ prefixe: '24', rubrique: 'SF_IMMOBILISATIONS_CORPORELLES' }, { prefixe: '10', rubrique: 'SF_CAPITAL' }];
        expect(() => (0, etats_ifrs_1.construireEtatsIfrs)(EX, b, r, [{ ...ANNULATION, partMinoritairesResultat: 0, partMinoritairesCapitauxPropres: null }], 'AUCUNE')).toThrow(/n’existe que dans les comptes consolidés/);
        expect((0, etats_ifrs_1.construireEtatsIfrs)(EX, b, r, [], 'AUCUNE').situation.some((l) => l.cle === 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE')).toBe(false);
        const avecCle = (0, etats_ifrs_1.construireEtatsIfrs)(EX, [...b, { numero: 'ECART_ACQUISITION', intitule: 'z', solde: 5 }], r, [], 'AUCUNE');
        expect(avecCle.nonClasses).toEqual([]);
        expect(X(avecCle.situation, 'TOTAL_ACTIF').ifrs).toBe(10);
        expect((0, rubriques_ifrs_1.motifRefusRegle)('10', 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE')).toMatch(/IFRS 10 § 22/);
    });
});
describe('IFRS consolidés · ce que le D4C porte autrement', () => {
    it('IFRS 3 § 34 · un écart d’acquisition négatif étalé rend le jeu non publiable tant qu’il n’est pas soldé', () => {
        const c = cumul([L('ECART_ACQUISITION_NEGATIF', -50), L('RESERVES_GROUPE_BIS', 50, true)]);
        const e = jouer([], c, [...DOTATION, { poste: 'ECART_ACQUISITION_NEGATIF', rubrique: 'SF_PROVISIONS_NC' }]);
        expect(e.motifsNonPubliable.some((m) => /IFRS 3 § 34/.test(m))).toBe(true);
        const solde = {
            id: 'n', libelle: 'Profit d’acquisition', fondement: 'IFRS 3 § 34',
            lignes: [{ rubrique: 'SF_PROVISIONS_NC', montant: 50 }, { rubrique: 'SF_RESERVES', montant: -50 }], partMinoritairesCapitauxPropres: 0,
        };
        expect(jouer([solde], c, [...DOTATION, { poste: 'ECART_ACQUISITION_NEGATIF', rubrique: 'SF_PROVISIONS_NC' }]).motifsNonPubliable.some((m) => /IFRS 3 § 34/.test(m))).toBe(false);
    });
    it('IAS 21 § 39 c · des écarts de conversion rendent le jeu non publiable', () => {
        const c = cumul([L('ECARTS_CONVERSION', -15), L('60200000', 15)]);
        expect(jouer([ANNULATION], c).motifsNonPubliable.some((m) => /IAS 21 § 39 c/.test(m))).toBe(true);
        expect(jouer([ANNULATION]).motifsNonPubliable.some((m) => /IAS 21/.test(m))).toBe(false);
    });
    it('IAS 21 § 39 c et § 41 · la variation de l’exercice passe en OCI, la part des minoritaires leur est attribuée', () => {
        const n = cumul([L('ECARTS_CONVERSION', -15), L('INTERETS_MINORITAIRES', -5), L('24100000', 20)], { ecartsConversion: 15, ecartsConversionMinoritaires: 5, ecartsConversionMe: 4, interetsMinoritairesHorsResultat: 65 });
        n.conversions = [{ entite: 'Filiale' }];
        const n1 = cumul([], { ecartsConversion: 10, ecartsConversionMinoritaires: 3, ecartsConversionMe: 1 });
        n1.conversions = [{ entite: 'Filiale' }];
        const e = (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)(EX, n, REGLES, DOTATION, [ANNULATION], 'AUCUNE', { cumulPrecedent: n1, changements: [] });
        expect(X(e.resultatGlobal, 'OCI_R_AUTRES').legal).toBe(4);
        expect(X(e.resultatGlobal, 'OCI_R_QUOTE_PART_MEE').legal).toBe(3);
        expect(X(e.resultatGlobal, 'TOTAL_OCI').legal).toBe(7);
        expect(X(e.resultatGlobal, 'RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').legal).toBe(42);
        expect(X(e.resultatGlobal, 'RG_PROPRIETAIRES').legal).toBe(255);
        expect(X(e.situation, 'SF_AUTRES_COMPOSANTES_CP').legal).toBe(10);
        expect(X(e.situation, 'SF_OCI_EXERCICE').legal).toBe(5);
        expect(X(e.situation, 'TOTAL_CAPITAUX_PROPRES_PROPRIETAIRES').legal).toBe(895);
        expect(X(e.situation, 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE').legal).toBe(105);
        expect(X(e.situation, 'TOTAL_CAPITAUX_PROPRES').legal).toBe(1000);
        expect(e.controles.every((c) => c.ok)).toBe(true);
        expect(e.motifsNonPubliable.some((m) => /IAS 21/.test(m))).toBe(false);
        expect(e.mentions.some((m) => /IAS 21 § 39 c/.test(m) && /§ 41/.test(m))).toBe(true);
        const sans = (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)(EX, n, REGLES, DOTATION, [ANNULATION], 'AUCUNE', { cumulPrecedent: null, changements: [] });
        expect(X(sans.resultatGlobal, 'TOTAL_OCI').legal).toBe(0);
        expect(X(sans.situation, 'SF_AUTRES_COMPOSANTES_CP').legal).toBe(15);
        expect(sans.motifsNonPubliable.some((m) => /IAS 21 § 39 c/.test(m) && /exercice précédent/.test(m))).toBe(true);
        const entree = (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)(EX, n, REGLES, DOTATION, [ANNULATION], 'AUCUNE', {
            cumulPrecedent: n1,
            changements: [{ nom: 'Filiale', nature: 'ENTREE' }, { nom: 'Autre', nature: 'SORTIE' }],
        });
        expect(X(entree.resultatGlobal, 'TOTAL_OCI').legal).toBe(7);
        const sortie = (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)(EX, n, REGLES, DOTATION, [ANNULATION], 'AUCUNE', { cumulPrecedent: n1, changements: [{ nom: ' filiale ', nature: 'SORTIE' }] });
        expect(X(sortie.resultatGlobal, 'TOTAL_OCI').legal).toBe(0);
        expect(sortie.motifsNonPubliable.some((m) => /IAS 21 § 48/.test(m))).toBe(true);
        const pct = (0, etats_ifrs_consolides_1.construireEtatsIfrsConsolides)(EX, n, REGLES, DOTATION, [ANNULATION], 'AUCUNE', { cumulPrecedent: n1, changements: [{ nom: 'Filiale', nature: 'POURCENTAGE' }] });
        expect(X(pct.resultatGlobal, 'TOTAL_OCI').legal).toBe(0);
        expect(pct.motifsNonPubliable.some((m) => /IFRS 10 § B96/.test(m))).toBe(true);
    });
    it('un poste à déclarer qui ne l’est pas est nommé, et reste sur la ligne « sans rubrique »', () => {
        const e = jouer([], cumul(), []);
        expect(e.motifsNonPubliable).toContain('Poste de consolidation « Dotations aux amortissements et dépréciations de l’écart d’acquisition » sans rubrique IFRS · déclarez la ligne où il se range.');
        expect(X(e.resultat, 'PL_NON_CLASSES').ifrs).toBe(-10);
    });
    it('les règles de postes · seuls les postes à déclarer, vers le bon état, jamais les minoritaires', () => {
        expect((0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)('ECART_ACQUISITION', 'SF_GOODWILL')).toMatch(/rangé par IFRS 18 elle-même/);
        expect((0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)('RESULTAT_DEJA_CONSTATE', 'PL_PRODUITS')).toMatch(/n’est pas un poste de consolidation qui se déclare/);
        expect((0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)('ELIMINATION_RESULTATS_INTERNES', 'SF_STOCKS')).toMatch(/est du résultat/);
        expect((0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)('PRIMES_CONSOLIDANTE', 'PL_PRODUITS')).toMatch(/est du bilan/);
        expect((0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)('PRIMES_CONSOLIDANTE', 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE')).toMatch(/IFRS 10 § 22/);
        expect((0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)('PRIMES_CONSOLIDANTE', 'OCI_R_AUTRES')).toMatch(/autre élément du résultat global/);
        expect((0, etats_ifrs_consolides_1.motifRefusRegleConsolidation)('PRIMES_CONSOLIDANTE', 'SF_RESERVES')).toBeNull();
        expect(() => jouer([], cumul(), [{ poste: 'ECART_ACQUISITION', rubrique: 'SF_GOODWILL' }])).toThrow(etats_ifrs_1.RefusIfrs);
        expect(etats_ifrs_consolides_1.POSTES_A_DECLARER.filter((p) => p in etats_ifrs_consolides_1.POSTES_RANGES)).toEqual([]);
    });
    it('le résultat projeté est contrôlé contre le résultat de l’ensemble du D4C', () => {
        const e = jouer([], cumul([], { resultatEnsemble: 300 }));
        expect(e.controles.find((c) => c.cle === 'RESULTAT_ENSEMBLE')).toMatchObject({ ok: false, ecart: -10 });
    });
});
//# sourceMappingURL=etats-ifrs-consolides.spec.js.map