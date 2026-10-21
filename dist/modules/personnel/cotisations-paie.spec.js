"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const bareme_smig_1 = require("./bareme-smig");
const cotisations_paie_1 = require("./cotisations-paie");
const decimal_exact_1 = require("../../common/decimal-exact");
const M = { moisDePaie: '2026-03' };
describe('Les taux CNSS, recopiés du décret n° 18/041', () => {
    it('portent 6,5 %, 5 % + 5 % et 1,5 %, et leur total fait DIX-HUIT', () => {
        const total = cotisations_paie_1.TAUX_CNSS.prestationsAuxFamilles.tauxPourCent +
            cotisations_paie_1.TAUX_CNSS.pensionsEmployeur.tauxPourCent +
            cotisations_paie_1.TAUX_CNSS.pensionsTravailleur.tauxPourCent +
            cotisations_paie_1.TAUX_CNSS.risquesProfessionnels.tauxPourCent;
        expect(total).toBeCloseTo(18, 10);
    });
    it('répartit 13 % côté employeur et 5 % côté travailleur', () => {
        const v = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        const cnss = v.lignes.filter((l) => l.organisme === 'CNSS');
        const emp = cnss.filter((l) => l.charge === 'EMPLOYEUR').reduce((n, l) => n + l.tauxPourCent, 0);
        const trav = cnss.filter((l) => l.charge === 'TRAVAILLEUR').reduce((n, l) => n + l.tauxPourCent, 0);
        expect(emp).toBeCloseTo(13, 10);
        expect(trav).toBeCloseTo(5, 10);
    });
    it('ne retient sur la paie QUE la quote-part ouvrière des pensions', () => {
        const v = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        const retenues = v.lignes.filter((l) => l.charge === 'TRAVAILLEUR');
        expect(retenues).toHaveLength(1);
        expect(retenues[0].cle).toBe('cnss-pension-travailleur');
        expect(v.totalTravailleurFc).toBeCloseTo(50_000, 6);
        expect(v.totalEmployeurFc).toBeGreaterThan(v.totalTravailleurFc);
    });
    it('ne majore le taux des risques professionnels que sur DÉCLARATION, au niveau notifié', () => {
        const normal = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        const rp = (v) => v.lignes.find((l) => l.cle === 'cnss-rp');
        expect(rp(normal).tauxPourCent).toBeCloseTo(1.5, 10);
        const cinquante = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10, majorationRisquesProfessionnelsPourCent: 50 });
        expect(rp(cinquante).tauxPourCent).toBeCloseTo(2.25, 10);
        expect(rp(cinquante).reserve).toContain('art. 22');
        expect(rp(cinquante).reserve).not.toMatch(/RÉCIDIVE/);
        const cent = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10, majorationRisquesProfessionnelsPourCent: 100 });
        expect(rp(cent).tauxPourCent).toBeCloseTo(1.5 * cotisations_paie_1.MAJORATION_RISQUES_PROFESSIONNELS_MAXIMUM, 10);
        expect(rp(cent).reserve).toContain('art. 24, al. 3');
        expect(rp(cent).reserve).toContain('article 5');
    });
    it('refuse une majoration que l’arrêté n° 140/2018 ne connaît pas', () => {
        expect(() => (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, majorationRisquesProfessionnelsPourCent: 150 })).toThrow(/50 %.*100 %/);
    });
});
describe("L'APPRENTI · la seule branche des risques professionnels (loi n° 16/009, art. 4)", () => {
    it('ne porte ni pensions ni prestations aux familles, et aucune quote-part ouvrière', () => {
        const v = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10, regimeCnss: 'APPRENTI' });
        const cnss = v.lignes.filter((l) => l.organisme === 'CNSS').map((l) => l.cle);
        expect(cnss).toEqual(['cnss-rp']);
        expect(v.lignes.some((l) => l.cle === 'cnss-pension-travailleur')).toBe(false);
        expect(v.totalTravailleurFc).toBe(0);
        expect(v.abstentions.filter((a) => a.startsWith('CNSS'))).toEqual([]);
        expect(v.reserves).toContain(cotisations_paie_1.NON_DUES_APPRENTI);
        const rp = v.lignes.find((l) => l.cle === 'cnss-rp');
        expect(rp.charge).toBe('EMPLOYEUR');
        expect(rp.reserve).toContain('art. 13, al. 2');
    });
    it('un travailleur garde les trois branches, et sans contrat lu l’hypothèse est dite', () => {
        const t = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10, regimeCnss: 'TRAVAILLEUR' });
        expect(t.lignes.filter((l) => l.organisme === 'CNSS')).toHaveLength(4);
        expect(t.reserves).not.toContain(cotisations_paie_1.RESERVE_REGIME_CNSS_INCONNU);
        const inconnu = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        expect(inconnu.reserves).toContain(cotisations_paie_1.RESERVE_REGIME_CNSS_INCONNU);
    });
});
describe("L'INPP · la nature d'abord, la tranche ensuite", () => {
    it('porte les deux barèmes, dans leur ordre de date', () => {
        expect(cotisations_paie_1.BAREMES_INPP.map((b) => b.aPartirDu)).toEqual(['2006-02-14', '2025-09-24']);
    });
    it('applique le barème de 2006 à un mois de 2025 antérieur à septembre', () => {
        expect((0, cotisations_paie_1.tauxInpp)('2025-08', 'PRIVE', 10).tauxPourCent).toBeCloseTo(3, 10);
        expect((0, cotisations_paie_1.tauxInpp)('2025-08', 'PUBLIC', null).tauxPourCent).toBeCloseTo(3, 10);
    });
    it('bascule sur le barème de 2025 dès le mois de la signature', () => {
        expect((0, cotisations_paie_1.tauxInpp)('2025-09', 'PRIVE', 10).tauxPourCent).toBeCloseTo(3.5, 10);
        expect((0, cotisations_paie_1.tauxInpp)('2025-09', 'PUBLIC', null).tauxPourCent).toBeCloseTo(4, 10);
    });
    it('lit les trois tranches du privé sur leurs bornes exactes', () => {
        expect((0, cotisations_paie_1.tauxInpp)('2026-01', 'PRIVE', 50).tauxPourCent).toBeCloseTo(3.5, 10);
        expect((0, cotisations_paie_1.tauxInpp)('2026-01', 'PRIVE', 51).tauxPourCent).toBeCloseTo(3, 10);
        expect((0, cotisations_paie_1.tauxInpp)('2026-01', 'PRIVE', 300).tauxPourCent).toBeCloseTo(3, 10);
        expect((0, cotisations_paie_1.tauxInpp)('2026-01', 'PRIVE', 301).tauxPourCent).toBeCloseTo(2, 10);
    });
    it("n'applique AUCUNE tranche d'effectif à un employeur public", () => {
        for (const effectif of [1, 100, 5_000]) {
            expect((0, cotisations_paie_1.tauxInpp)('2026-01', 'PUBLIC', effectif).tauxPourCent).toBeCloseTo(4, 10);
        }
    });
    it("s'abstient sur un privé dont l'effectif n'est pas renseigné", () => {
        const v = (0, cotisations_paie_1.tauxInpp)('2026-01', 'PRIVE', null);
        expect(v.tauxPourCent).toBeNull();
        expect(v.motifAbstention).toContain("tranche d'effectif");
    });
    it("s'abstient tant que la NATURE de l'employeur n'est pas déclarée", () => {
        const v = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M });
        expect(v.lignes.find((l) => l.organisme === 'INPP')).toBeUndefined();
        expect(v.abstentions.join(' ')).toContain('NATURE');
        expect(v.lignes.some((l) => l.organisme === 'CNSS')).toBe(true);
        expect(v.lignes.some((l) => l.organisme === 'ONEM')).toBe(true);
    });
});
describe("L'ONEM · un exercice à cheval porte les deux taux", () => {
    it('porte les deux barèmes, dans leur ordre de date', () => {
        expect(cotisations_paie_1.BAREMES_ONEM.map((b) => b.tauxPourCent)).toEqual([0.2, 0.5]);
    });
    it('rend 0,2 % avant septembre 2025 et 0,5 % à partir de septembre 2025', () => {
        expect((0, cotisations_paie_1.tauxOnem)('2025-08').tauxPourCent).toBeCloseTo(0.2, 10);
        expect((0, cotisations_paie_1.tauxOnem)('2025-09').tauxPourCent).toBeCloseTo(0.5, 10);
        expect((0, cotisations_paie_1.tauxOnem)('2026-03').tauxPourCent).toBeCloseTo(0.5, 10);
    });
    it("T5 · une paie antérieure à septembre 2025 porte la réserve de l'art. 6 de l'arrêté n° 028/2025", () => {
        const onem = (mois) => (0, cotisations_paie_1.cotisations)(1_000_000, { moisDePaie: mois }).lignes.find((l) => l.cle === 'onem');
        expect(onem('2025-08').reserve).toContain('art. 6');
        expect(onem('2025-08').reserve).toContain('25 septembre 2025');
        expect(onem('2025-09').reserve ?? '').not.toContain('art. 6');
        expect(onem('2026-03').reserve ?? '').not.toContain('art. 6');
    });
});
describe("T5 · le taux INPP de septembre 2025 suit la date de VERSEMENT", () => {
    const inpp = (dateMiseADisposition) => (0, cotisations_paie_1.cotisations)(1_000_000, { moisDePaie: '2025-09', natureEmployeurInpp: 'PRIVE', effectif: 50, dateMiseADisposition }).lignes.find((l) => l.cle === 'inpp');
    it('versée à partir du 24 septembre · nouveau barème, 35 000 ; avant · ancien, 30 000', () => {
        expect(inpp('2025-09-24').montantFc).toBeCloseTo(35_000, 6);
        expect(inpp('2025-09-30').montantFc).toBeCloseTo(35_000, 6);
        expect(inpp('2025-09-23').montantFc).toBeCloseTo(30_000, 6);
        expect((0, cotisations_paie_1.tauxInpp)('2025-09', 'PRIVE', 50, [], '2025-09-23').tauxPourCent).toBeCloseTo(3, 10);
    });
    it('sans date déclarée · barème du mois, et la réserve le dit', () => {
        const l = inpp();
        expect(l.montantFc).toBeCloseTo(35_000, 6);
        expect(l.reserve).toContain('Déclarez la date de mise à disposition');
        const mars = (0, cotisations_paie_1.cotisations)(1_000_000, { moisDePaie: '2026-03', natureEmployeurInpp: 'PRIVE', effectif: 50 }).lignes.find((x) => x.cle === 'inpp');
        expect(mars.reserve).not.toContain('Déclarez la date de mise à disposition');
    });
    it("cite l'ordonnance n° 84/186 comme texte de la période trimestrielle, et ne la dit plus absente", () => {
        const reserve = inpp().reserve ?? '';
        expect(reserve).toContain('ordonnance n° 84/186 du 15 octobre 1984, art. 1er et 3');
        expect(reserve).toContain('le 30 avril, le 31 juillet, le 31 octobre et le 31 janvier');
        expect(reserve).toContain("Aucun texte ne dit à quelle date se lit l'effectif");
    });
});
describe("L'assiette empruntée de l'INPP et de l'ONEM est DÉCLARÉE", () => {
    it("porte la réserve de lecture sur l'ONEM, et sur l'INPP le renvoi au Code qui la crée", () => {
        const v = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        expect(v.lignes.find((l) => l.cle === 'onem').reserve).toContain("sans renvoyer à l'article 7");
        const inpp = v.lignes.find((l) => l.cle === 'inpp');
        expect(inpp.source).toContain('art. 15 b)');
        expect(inpp.reserve).toContain('article 7 du même Code');
    });
    it("cite l'art. 15 b) MOT POUR MOT, dit que la conciliation est une LECTURE et nomme l'autre", () => {
        const v = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        const reserve = v.lignes.find((l) => l.cle === 'inpp').reserve ?? '';
        expect(reserve).toContain('« la cotisation mensuelle des employeurs proportionnelle à la somme des rémunérations versées par eux à leur personnel au cours du trimestre précédent »');
        expect(reserve).toContain("c'est une LECTURE, qu'aucun texte n'écrit");
        expect(reserve).toContain("L'autre lecture prend pour assiette les rémunérations du trimestre précédent, ce qui décale la cotisation d'un trimestre");
    });
    it("ne porte PAS cette réserve sur la CNSS, dont l'assiette est routée par la loi", () => {
        const v = (0, cotisations_paie_1.cotisations)(1_000_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        const pf = v.lignes.find((l) => l.cle === 'cnss-pf');
        expect(pf.reserve).toBeNull();
        expect(pf.source).toContain("article 13 de la loi n° 16/009");
    });
});
describe("Le net à payer part du TOTAL VERSÉ, jamais de l'assiette", () => {
    it("ne retranche pas du net ce que l'article 7 sort de l'assiette", () => {
        const v = (0, cotisations_paie_1.netAPayer)(1_400_000, 50_000, 30_000);
        expect(v.totalVerseFc).toBe(1_400_000);
        expect(v.netAPayerFc).toBe(1_320_000);
        expect(v.netAPayerFc).not.toBe(920_000);
    });
    it("ne chiffre aucun net tant que l'impôt est indéterminé", () => {
        expect((0, cotisations_paie_1.netAPayer)(1_400_000, 50_000, null).netAPayerFc).toBeNull();
    });
    it('ne rend jamais un net négatif', () => {
        expect((0, cotisations_paie_1.netAPayer)(100_000, 50_000, 500_000).netAPayerFc).toBe(0);
    });
    it("dit ce qu'il ne retient pas, et pourquoi", () => {
        const r = (0, cotisations_paie_1.netAPayer)(1_000_000, 50_000, 30_000).reserves.join(' ');
        expect(r).toMatch(/article 112/i);
        expect(r).toMatch(/article 114/i);
        expect(r).toContain("LA QUOTITÉ SAISISSABLE DE L'ARTICLE 114 EST CALCULÉE À PART");
        expect(r).toContain('décret n° 25/22');
        expect(r).toContain('arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10');
        expect(r).toContain("n'est retenue sur aucun bulletin");
    });
});
describe('F109 · chaque taux calculé est celui que le registre des retenues cite', () => {
    const texte = (cle) => {
        const n = correspondance_retenues_1.NATURES_RETENUES.find((x) => x.cle === cle);
        expect(n).toBeDefined();
        return `${n.baseLegale} ${n.reserve ?? ''}`;
    };
    const phrase = (t, repere) => {
        const p = t.split(/\.\s+(?=[A-ZÉÀ«])/).find((x) => x.includes(repere));
        expect(p).toBeDefined();
        return p;
    };
    const pc = (x) => `${String(x).replace('.', ',')} %`;
    const numeroDe = (reference) => reference.match(/n° \S+/)[0].replace(/,$/, '');
    it('INPP · chaque version, public et tranches du privé', () => {
        const t = texte('inppOnem');
        for (const v of cotisations_paie_1.BAREMES_INPP) {
            const p = phrase(t, numeroDe(v.reference));
            expect(p).toContain(pc(v.publicPourCent));
            const [t1, t2, t3] = v.priveParTranche.map((x) => x.tauxPourCent);
            expect(p).toContain(`${pc(t1)} de 1 à 50`);
            expect(p).toContain(`${pc(t2)} de 51 à 300`);
            expect(p).toContain(`${pc(t3)} au-delà de 300`);
        }
    });
    it('ONEM · chaque version', () => {
        const t = texte('inppOnem');
        for (const v of cotisations_paie_1.BAREMES_ONEM)
            expect(phrase(t, numeroDe(v.reference))).toContain(pc(v.tauxPourCent));
    });
    it('CNSS · la version en vigueur', () => {
        const v = cotisations_paie_1.BAREMES_CNSS[cotisations_paie_1.BAREMES_CNSS.length - 1];
        const p = phrase(texte('cnss'), 'décret n° 18/041');
        expect(p).toContain(`prestations aux familles ${pc(v.prestationsAuxFamilles)}`);
        expect(p).toContain(`${pc(v.pensionsEmployeur)} employeur, ${pc(v.pensionsTravailleur)} travailleur`);
        expect(p).toContain(`risques professionnels ${pc(v.risquesProfessionnels)}`);
    });
});
describe('F112 · le plancher de la CNSS', () => {
    it('jumeau de C1 · une assiette EXACTEMENT au SMIG du mois, faite de plusieurs lignes, n’est pas sous le plancher', () => {
        const assiette = [157_287.52, 117_823.56, 116_773.59, 45_556.48, 121_558.85].reduce((n, m) => n + m, 0);
        expect(assiette).toBeLessThan(559_000);
        expect((0, cotisations_paie_1.plancherCnss)('2026-03', assiette)).toMatchObject({ baseFc: assiette, plancherFc: 559_000, applique: false, message: null });
        expect((0, cotisations_paie_1.plancherCnss)('2026-03', 558_999.99).baseFc).toBeNull();
    });
    it('jumeau de C1 · un SMIG du cabinet aux centimes se compare au centime', () => {
        const grille = (0, bareme_smig_1.annexeDuCabinet)({ aPartirDu: '2027-01-01', reference: 'Arrêté du banc', smigJournalierFc: 21_500.01 });
        expect((0, cotisations_paie_1.plancherCnss)('2027-03', 559_000.26, null, [grille])).toMatchObject({ applique: false, message: null });
        expect((0, cotisations_paie_1.plancherCnss)('2027-03', 559_000.25, null, [grille]).baseFc).toBeNull();
    });
    it('sous le décret n° 18/017, le plancher est le SMIG de 7 075 FC (audit D2-C1)', () => {
        expect((0, cotisations_paie_1.plancherCnss)('2022-06', 100_000, 26).baseFc).toBe(7_075 * 26);
    });
    it('sans annexe (avant juillet 2019), rien n’est vérifié et c’est dit', () => {
        const p = (0, cotisations_paie_1.plancherCnss)('2018-06', 100_000);
        expect(p.baseFc).toBe(100_000);
        expect(p.message).toContain('PLANCHER NON VÉRIFIÉ');
        expect(p.message).toContain('décret n° 18/017');
        expect(p.message).toMatch(/paliers/);
    });
    it('au-dessus du SMIG d’un mois entier (21 500 × 26 = 559 000), rien ne change', () => {
        const p = (0, cotisations_paie_1.plancherCnss)('2026-03', 600_000);
        expect(p).toMatchObject({ baseFc: 600_000, applique: false, message: null, plancherFc: 559_000 });
    });
    it('sous le plancher sans jours payés déclarés, la CNSS s’abstient et demande les jours', () => {
        const p = (0, cotisations_paie_1.plancherCnss)('2026-03', 300_000);
        expect(p.baseFc).toBeNull();
        expect(p.message).toContain('déclarez les jours payés');
    });
    it('un mois incomplet se mesure au SMIG de ses jours · 10 jours, 215 000 FC', () => {
        expect((0, cotisations_paie_1.plancherCnss)('2026-03', 300_000, 10)).toMatchObject({ baseFc: 300_000, applique: false });
        const p = (0, cotisations_paie_1.plancherCnss)('2026-03', 100_000, 10);
        expect(p).toMatchObject({ baseFc: 215_000, applique: true, plancherFc: 215_000 });
        expect(p.message).toContain('PLANCHER APPLIQUÉ');
    });
    it('T4 · mai à décembre 2025 · le plancher est le SMIG PAYÉ, 14 500 × jours payés', () => {
        const p = (0, cotisations_paie_1.plancherCnss)('2025-11', 400_000);
        expect(p).toMatchObject({ baseFc: 400_000, plancherFc: 377_000, applique: false, message: null });
        expect((0, cotisations_paie_1.plancherCnss)('2025-10', 600_000).baseFc).toBe(600_000);
        const sous = (0, cotisations_paie_1.plancherCnss)('2025-11', 300_000);
        expect(sous.baseFc).toBeNull();
        expect(sous.message).toContain('déclarez les jours payés');
        expect((0, cotisations_paie_1.plancherCnss)('2025-11', 100_000, 10)).toMatchObject({ baseFc: 145_000, applique: true });
    });
    it('T4 · P07 (d) · novembre 2025, 400 000 · cotisations chiffrées', () => {
        const v = (0, cotisations_paie_1.cotisations)(400_000, { moisDePaie: '2025-11', natureEmployeurInpp: 'PRIVE', effectif: 30 });
        const par = (cle) => v.lignes.find((l) => l.cle === cle).montantFc;
        expect(v.quotePartOuvriereNonChiffree).toBeNull();
        expect(par('cnss-pension-travailleur')).toBeCloseTo(20_000, 6);
        expect(par('cnss-pension-employeur')).toBeCloseTo(20_000, 6);
        expect(par('cnss-pf')).toBeCloseTo(26_000, 6);
        expect(par('cnss-rp')).toBeCloseTo(6_000, 6);
        expect(par('inpp')).toBeCloseTo(14_000, 6);
        expect(par('onem')).toBeCloseTo(2_000, 6);
    });
    it('une grille du cabinet porte un seul taux, et il fait le plancher', () => {
        const grille = (0, bareme_smig_1.annexeDuCabinet)({ aPartirDu: '2027-01-01', reference: 'Arrêté de test', smigJournalierFc: 25_000 });
        expect((0, cotisations_paie_1.plancherCnss)('2027-02', 600_000, null, [grille]).baseFc).toBeNull();
        expect((0, cotisations_paie_1.plancherCnss)('2027-02', 600_000, 26, [grille])).toMatchObject({ baseFc: 650_000, applique: true });
    });
    it('les cotisations CNSS se calculent sur le plancher, l’INPP et l’ONEM sur l’assiette', () => {
        const v = (0, cotisations_paie_1.cotisations)(100_000, { ...M, joursPayes: 10, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        const par = (cle) => v.lignes.find((l) => l.cle === cle);
        for (const cle of ['cnss-pf', 'cnss-pension-employeur', 'cnss-pension-travailleur', 'cnss-rp']) {
            expect(par(cle).assietteFc).toBe(215_000);
        }
        expect(par('cnss-pension-travailleur').montantFc).toBeCloseTo(10_750, 6);
        expect(par('inpp').assietteFc).toBe(100_000);
        expect(par('onem').assietteFc).toBe(100_000);
        expect(v.reserves?.join(' ')).toContain('PLANCHER APPLIQUÉ');
    });
    it('une CNSS en abstention ne pose aucune ligne CNSS, et garde l’INPP et l’ONEM', () => {
        const v = (0, cotisations_paie_1.cotisations)(100_000, { ...M, natureEmployeurInpp: 'PRIVE', effectif: 10 });
        expect(v.lignes.some((l) => l.organisme === 'CNSS')).toBe(false);
        expect(v.abstentions.join(' ')).toContain('ASSIETTE SOUS LE PLANCHER');
        expect(v.lignes.map((l) => l.cle)).toEqual(expect.arrayContaining(['inpp', 'onem']));
    });
});
describe('Passe O4 · la saisie-arrêt et la cession notifiées ne sont plus « un acte que le registre ne porte pas »', () => {
    it('le net les nomme avec leurs articles et le compte 4232', () => {
        for (const avances of [0, 1_000]) {
            const r = (0, cotisations_paie_1.netAPayer)(1_000_000, 50_000, 10_000, avances).reserves.join(' ');
            expect(r).toContain(cotisations_paie_1.RESERVE_SAISIES_ET_CESSIONS);
        }
        expect(cotisations_paie_1.RESERVE_SAISIES_ET_CESSIONS).toMatch(/art\. 184, 3° et 206/);
        expect(cotisations_paie_1.RESERVE_SAISIES_ET_CESSIONS).toMatch(/personnellement débiteur/);
        expect(cotisations_paie_1.RESERVE_SAISIES_ET_CESSIONS).toContain('42320000');
    });
});
describe('Le net négatif se juge en centimes, comme la colonne qui le fige', () => {
    it('un reste flottant n’est pas un net négatif', () => {
        expect((0, cotisations_paie_1.netNegatifAuCentime)((0, decimal_exact_1.depuisNombre)(-1.1641532182693481e-10))).toBe(false);
        expect((0, cotisations_paie_1.netNegatifAuCentime)((0, decimal_exact_1.depuisNombre)(-0.0049999))).toBe(false);
    });
    it('-0,005 FC, que la colonne range -0,01, est un net négatif', () => {
        expect((0, cotisations_paie_1.netNegatifAuCentime)((0, decimal_exact_1.depuisNombre)(-0.005))).toBe(true);
        expect((0, cotisations_paie_1.netNegatifAuCentime)((0, decimal_exact_1.depuisNombre)(-0.01))).toBe(true);
    });
    it('le net se calcule en valeur exacte · 880 000 − 44 000 − 106 000 − 730 000 = 0', () => {
        const cinq = [51_905.39, 53_651.71, 168_138.49, 68_332.09, 537_972.32];
        const sommeFlottante = cinq.reduce((a, b) => a + b, 0);
        expect(sommeFlottante - 44_000 - 106_000 - 730_000).toBeLessThan(0);
        const { netExact } = (0, cotisations_paie_1.netAPayerExact)((0, decimal_exact_1.somme)(cinq.map(decimal_exact_1.depuisNombre)), (0, decimal_exact_1.depuisNombre)(44_000), 106_000, (0, decimal_exact_1.depuisNombre)(730_000));
        expect(netExact).not.toBeNull();
        expect((0, cotisations_paie_1.netNegatifAuCentime)(netExact)).toBe(false);
        expect((0, cotisations_paie_1.netAPayer)(880_000, 44_000, 106_000, 730_000).netAPayerFc).toBe(0);
    });
});
//# sourceMappingURL=cotisations-paie.spec.js.map