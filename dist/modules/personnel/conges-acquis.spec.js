"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const conges_acquis_1 = require("./conges-acquis");
const decompte_final_1 = require("./decompte-final");
const moisPayes = (du, au) => {
    const sortie = [];
    let [a, m] = du.split('-').map(Number);
    const [af, mf] = au.split('-').map(Number);
    while (a < af || (a === af && m <= mf)) {
        sortie.push(`${a}-${String(m).padStart(2, '0')}`);
        m += 1;
        if (m === 13) {
            m = 1;
            a += 1;
        }
    }
    return sortie;
};
const base = (f) => ({
    origine: '2026-01-01',
    fin: null,
    dateNaissance: '1990-06-15',
    millesimeNaissance: null,
    moisPayes: [],
    joursHorsService: [],
    reprise: null,
    conges: [],
    aLa: '2026-10-14',
    ...f,
});
const ok = (r) => {
    if ('refus' in r)
        throw new Error(r.refus);
    return r;
};
describe('congés acquis chaque mois · art. 140 et 141 du Code du travail', () => {
    it("un mois de service révolu et payé donne un jour, un mois en cours rien encore", () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({ moisPayes: moisPayes('2026-01', '2026-09') })));
        expect(c.periodes).toHaveLength(1);
        expect(c.periodes[0].etat).toBe('EN_COURS');
        expect(c.periodes[0].moisAcquis).toBe(9);
        expect(c.periodes[0].joursDeBase).toBe(9);
        expect(c.droitsNes).toBe(0);
        expect(c.enCours).toBe(9);
        expect(c.solde).toBe(0);
    });
    it("le mois de service se compte de date à date · entré le 15, douze mois et non onze", () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({ origine: '2025-03-15', aLa: '2026-03-20', moisPayes: moisPayes('2025-03', '2026-03') })));
        expect(c.periodes[0]).toMatchObject({ du: '2025-03-15', au: '2026-03-14', etat: 'NEE', moisAcquis: 12, joursAcquis: 12 });
        expect(c.droitsNes).toBe(12);
    });
    it('un mois civil sans bulletin laisse le mois de service non acquis, et le dit', () => {
        const payes = moisPayes('2026-01', '2026-09').filter((m) => m !== '2026-04');
        const c = ok((0, conges_acquis_1.compteurConges)(base({ moisPayes: payes })));
        const avril = c.periodes[0].mois.find((m) => m.du === '2026-04-01');
        expect(avril?.statut).toBe('SANS_BULLETIN');
        expect(avril?.motif).toContain('2026-04');
        expect(c.periodes[0].moisAcquis).toBe(8);
        expect(c.signaux.some((s) => s.includes('sans bulletin'))).toBe(true);
    });
    it("le travailleur de moins de dix-huit ans acquiert un jour et demi par mois", () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({ dateNaissance: '2009-07-01', moisPayes: moisPayes('2026-01', '2026-09') })));
        expect(c.periodes[0].joursDeBase).toBe(13.5);
    });
    it("l'âge que le registre ne dit pas rend le mois non chiffré, jamais un jour présumé", () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({ dateNaissance: null, millesimeNaissance: 2008, moisPayes: moisPayes('2026-01', '2026-09') })));
        expect(c.periodes[0].joursDeBase).toBeNull();
        expect(c.enCours).toBeNull();
        expect((0, conges_acquis_1.moinsDeDixHuitAnsAu)(new Date('2026-05-01T00:00:00Z'), null, 2008)).toBeNull();
        expect((0, conges_acquis_1.moinsDeDixHuitAnsAu)(new Date('2026-05-01T00:00:00Z'), null, 1990)).toBe(false);
        expect((0, conges_acquis_1.moinsDeDixHuitAnsAu)(new Date('2026-05-01T00:00:00Z'), null, 2010)).toBe(true);
    });
    it("la tranche d'ancienneté naît avec la cinquième année, entière (décision T6)", () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({ origine: '2021-01-01', moisPayes: moisPayes('2021-01', '2026-09') })));
        expect(c.periodes.map((p) => p.joursAcquis)).toEqual([12, 12, 12, 12, 13, 10]);
        expect(c.droitsNes).toBe(61);
        expect(c.enCours).toBe(10);
        expect((0, decompte_final_1.congeLegal)({ moisNonCouvertsParUnConge: 12, moinsDeDixHuitAns: false, anneesAnciennete: 5 }).joursOuvrables).toBe(13);
        expect((0, decompte_final_1.trancheDAnciennete)(4.9)).toBe(0);
        expect((0, decompte_final_1.trancheDAnciennete)(10)).toBe(2);
    });
    it('un jour hors service rend le mois non entier, avec son motif', () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({
            moisPayes: moisPayes('2026-01', '2026-09'),
            joursHorsService: [{ du: '2026-05-12', au: '2026-05-13', motif: 'Mise à pied disciplinaire' }],
        })));
        const mai = c.periodes[0].mois.find((m) => m.du === '2026-05-01');
        expect(mai?.statut).toBe('NON_ENTIER');
        expect(mai?.motif).toContain('Mise à pied');
        expect(c.periodes[0].moisAcquis).toBe(8);
    });
    it('les congés pris se retranchent des droits nés, et le solde négatif dit l’anticipation', () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({
            origine: '2025-01-01',
            moisPayes: moisPayes('2025-01', '2026-09'),
            conges: [{ id: 'c1', du: '2026-02-02', jours: 14 }],
        })));
        expect(c.droitsNes).toBe(12);
        expect(c.pris).toBe(14);
        expect(c.solde).toBe(-2);
    });
    it('les droits nés non pris six mois après leur naissance sont signalés (art. 140, al. 4)', () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({ origine: '2025-01-01', moisPayes: moisPayes('2025-01', '2026-09') })));
        expect(c.signaux.some((s) => s.includes('article 140, alinéa 4') && s.includes('2026-01-01'))).toBe(true);
        const pris = ok((0, conges_acquis_1.compteurConges)(base({ origine: '2025-01-01', moisPayes: moisPayes('2025-01', '2026-09'), conges: [{ id: 'c', du: '2026-03-02', jours: 12 }] })));
        expect(pris.signaux.some((s) => s.includes('article 140, alinéa 4'))).toBe(false);
    });
    it('la reprise déclarée couvre ce qui précède sa date, les bulletins font le reste', () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({
            origine: '2020-01-01',
            reprise: { arreteAu: '2026-06-30', joursNesNonPris: 7, moisEnCoursAccomplis: 6 },
            moisPayes: moisPayes('2026-07', '2026-09'),
            conges: [{ id: 'avant', du: '2026-03-02', jours: 3 }],
        })));
        const enCours = c.periodes.find((p) => p.etat === 'EN_COURS');
        expect(enCours?.moisAcquis).toBe(9);
        expect(enCours?.joursAcquis).toBe(10);
        expect(c.droitsNes).toBe(7);
        expect(c.pris).toBe(0);
        expect(c.congesAvantReprise).toEqual(['avant']);
        expect(c.periodes.filter((p) => p.etat === 'REPRISE')).toHaveLength(6);
    });
    it('la reprise se refuse quand elle déclare plus de mois que la période n’en a vu', () => {
        expect((0, conges_acquis_1.motifRefusReprise)({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4, moisEnCoursAccomplis: 5, source: 'registre' })).toContain('3 mois');
        expect((0, conges_acquis_1.motifRefusReprise)({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4, moisEnCoursAccomplis: 3, source: 'registre' })).toBeNull();
        expect((0, conges_acquis_1.motifRefusReprise)({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4.25, moisEnCoursAccomplis: 3, source: 'registre' })).toContain('demi-jours');
        expect((0, conges_acquis_1.motifRefusReprise)({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4, moisEnCoursAccomplis: 3, source: ' ' })).toContain('source');
    });
    it('la fin du service ferme la dernière période · les mois au-delà ne comptent pas', () => {
        const c = ok((0, conges_acquis_1.compteurConges)(base({ fin: '2026-06-15', moisPayes: moisPayes('2026-01', '2026-06') })));
        expect(c.periodes[0].etat).toBe('FIN_DE_SERVICE');
        expect(c.periodes[0].moisAcquis).toBe(5);
        expect(c.periodes[0].mois.find((m) => m.du === '2026-06-01')?.statut).toBe('HORS_CONTRAT');
    });
});
describe('jours d’un congé · art. 141, al. 3 et 4', () => {
    it('compte les jours ouvrables du Code, samedi compris, dimanche et fériés exclus', () => {
        expect((0, conges_acquis_1.joursDuConge)({ du: '2026-08-03', au: '2026-08-15', joursVoyage: 0, joursMaladie: new Set() })).toEqual({
            jours: 12,
            ouvrables: 12,
            maladie: 0,
        });
        expect((0, conges_acquis_1.joursDuConge)({ du: '2026-06-29', au: '2026-07-04', joursVoyage: 0, joursMaladie: new Set() })).toMatchObject({ jours: 5 });
    });
    it('retranche les jours de maladie et les jours de voyage déclarés', () => {
        expect((0, conges_acquis_1.joursDuConge)({ du: '2026-08-03', au: '2026-08-15', joursVoyage: 2, joursMaladie: new Set(['2026-08-05', '2026-08-06']) })).toEqual({ jours: 8, ouvrables: 10, maladie: 2 });
    });
    it('refuse plus de jours de voyage que de jours ouvrables', () => {
        expect((0, conges_acquis_1.joursDuConge)({ du: '2026-08-03', au: '2026-08-04', joursVoyage: 3, joursMaladie: new Set() })).toHaveProperty('refus');
    });
    it("l'allocation se paie au plus tard le dernier jour ouvrable avant le départ (art. 145)", () => {
        expect((0, conges_acquis_1.dernierJourOuvrableAvant)('2026-08-03')).toBe('2026-07-31');
    });
});
describe("l'allocation de l'art. 142 · un seul moteur avec le décompte final", () => {
    it('jours × (taux journalier + moyenne mensuelle / 26)', () => {
        expect((0, decompte_final_1.allocationDeConge)({ jours: 12, remunerationJournaliereFc: 20_000, moyenneMensuelleArticle142Fc: 52_000 })).toEqual({
            montantFc: 264_000,
            tauxJournalierFc: 22_000,
            motif: null,
        });
    });
    it('rend null avec son motif, jamais zéro, quand un élément manque', () => {
        expect((0, decompte_final_1.allocationDeConge)({ jours: 12, remunerationJournaliereFc: null, moyenneMensuelleArticle142Fc: 0 }).montantFc).toBeNull();
        expect((0, decompte_final_1.allocationDeConge)({ jours: 12, remunerationJournaliereFc: 20_000, moyenneMensuelleArticle142Fc: null }).motif).toContain('zéro est une réponse');
    });
});
//# sourceMappingURL=conges-acquis.spec.js.map