"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const copies_avant_mise_a_jour_1 = require("./copies-avant-mise-a-jour");
const sauvegarde_sur_site_service_1 = require("./sauvegarde-sur-site.service");
const T = new Date(2026, 8, 28, 10, 15, 0);
const COPIE = (0, copies_avant_mise_a_jour_1.nomCopieAvantMiseAJour)(T, 'aaa111bbb222');
describe('copies avant mise à jour · le nom et le motif', () => {
    it('le nom porte l’horodatage d’une copie quotidienne et la version dont la base a la forme', () => {
        expect(COPIE).toBe('omegax-20260928-101500-avant-mise-a-jour-aaa111bbb222.dump');
        expect(COPIE.startsWith((0, sauvegarde_sur_site_service_1.nomSauvegarde)(T).replace(/\.dump$/, ''))).toBe(true);
        expect(copies_avant_mise_a_jour_1.MOTIF_AVANT_MISE_A_JOUR.test(COPIE)).toBe(true);
    });
    it('une version par date ou inconnue donne encore un nom reconnu', () => {
        expect((0, copies_avant_mise_a_jour_1.nomCopieAvantMiseAJour)(T, '2026-09-26')).toBe('omegax-20260928-101500-avant-mise-a-jour-20260926.dump');
        expect((0, copies_avant_mise_a_jour_1.nomCopieAvantMiseAJour)(T, null)).toMatch(/-avant-mise-a-jour-inconnue\.dump$/);
        for (const v of ['2026-09-26', null, 'x'.repeat(40), '../..'])
            expect(copies_avant_mise_a_jour_1.MOTIF_AVANT_MISE_A_JOUR.test((0, copies_avant_mise_a_jour_1.nomCopieAvantMiseAJour)(T, v))).toBe(true);
    });
    it('une copie quotidienne et une copie avant mise à jour ne se confondent pas', () => {
        expect(copies_avant_mise_a_jour_1.MOTIF_AVANT_MISE_A_JOUR.test((0, sauvegarde_sur_site_service_1.nomSauvegarde)(T))).toBe(false);
        expect(copies_avant_mise_a_jour_1.MOTIF_AVANT_MISE_A_JOUR.test(`${COPIE}.partiel`)).toBe(false);
        expect((0, copies_avant_mise_a_jour_1.provisoiresAvantMiseAJour)([`${COPIE}.partiel`, COPIE, `${(0, sauvegarde_sur_site_service_1.nomSauvegarde)(T)}.partiel`, 'notes.txt'])).toEqual([`${COPIE}.partiel`]);
    });
    it('cinq copies gardées par défaut, réglables sur le poste', () => {
        expect((0, copies_avant_mise_a_jour_1.avantMiseAJourAGarder)({})).toBe(5);
        expect((0, copies_avant_mise_a_jour_1.avantMiseAJourAGarder)({ SAUVEGARDES_AVANT_MISE_A_JOUR_A_GARDER: '2' })).toBe(2);
        expect((0, copies_avant_mise_a_jour_1.avantMiseAJourAGarder)({ SAUVEGARDES_AVANT_MISE_A_JOUR_A_GARDER: '0' })).toBe(5);
    });
});
describe('copies avant mise à jour · le repère et le plan (audit final F191)', () => {
    const existe = (noms) => (n) => noms.includes(n);
    it('poste neuf, même version, nouvelle version', () => {
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)(null, 'V', existe([]))).toEqual({ action: 'PREMIER_DEMARRAGE' });
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)({ commit: 'V' }, 'V', existe([]))).toEqual({ action: 'AUCUNE' });
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)({ commit: 'P' }, 'V', existe([]))).toEqual({ action: 'COPIER', versionDeLaBase: 'P', copiePerdue: null });
    });
    it('une migration inachevée REPREND sa copie, même si un correctif a changé la version à installer', () => {
        const r = (0, copies_avant_mise_a_jour_1.repereApresCopie)({ commit: 'P' }, 'V', COPIE);
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)(r, 'V', existe([COPIE]))).toEqual({ action: 'REPRENDRE', copie: COPIE });
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)(r, 'W', existe([COPIE]))).toEqual({ action: 'REPRENDRE', copie: COPIE });
        expect((0, copies_avant_mise_a_jour_1.repereApresReprise)(r, 'W')).toEqual({ commit: 'P', enCours: { vers: 'W', copie: COPIE } });
    });
    it('une copie en cours que le disque n’a plus est dite perdue, et une nouvelle part', () => {
        const r = (0, copies_avant_mise_a_jour_1.repereApresCopie)({ commit: 'P' }, 'V', COPIE);
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)(r, 'V', existe([]))).toEqual({ action: 'COPIER', versionDeLaBase: 'P', copiePerdue: COPIE });
    });
    it('un repère illisible n’est pas un poste neuf · la copie part, de version inconnue', () => {
        expect((0, copies_avant_mise_a_jour_1.lireRepere)('{"com')).toEqual({ commit: null });
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)((0, copies_avant_mise_a_jour_1.lireRepere)('{"com'), 'V', existe([]))).toEqual({ action: 'COPIER', versionDeLaBase: null, copiePerdue: null });
        expect((0, copies_avant_mise_a_jour_1.lireRepere)(null)).toBeNull();
    });
    it('le repère d’avant ce correctif se relit, et un nom retouché à la main n’est ni repris ni protégé', () => {
        expect((0, copies_avant_mise_a_jour_1.lireRepere)('{"commit":"P"}')).toEqual({ commit: 'P' });
        expect((0, copies_avant_mise_a_jour_1.lireRepere)(JSON.stringify({ commit: 'P', enCours: { vers: 'V', copie: '../omegax.env' }, nonAbouties: ['pgdata', COPIE] }))).toEqual({
            commit: 'P',
            nonAbouties: [COPIE],
        });
    });
    it('une migration aboutie clôt la copie · un retour à la version précédente la garde hors rotation', () => {
        const r = (0, copies_avant_mise_a_jour_1.repereApresCopie)({ commit: 'P' }, 'V', COPIE);
        expect((0, copies_avant_mise_a_jour_1.repereApresMigration)(r, 'V')).toEqual({ commit: 'V' });
        expect((0, copies_avant_mise_a_jour_1.planMiseAJour)(r, 'P', existe([COPIE]))).toEqual({ action: 'AUCUNE' });
        const retour = (0, copies_avant_mise_a_jour_1.repereApresMigration)(r, 'P');
        expect(retour).toEqual({ commit: 'P', nonAbouties: [COPIE] });
        expect((0, copies_avant_mise_a_jour_1.repereApresMigration)(retour, 'P')).toEqual(retour);
        expect((0, copies_avant_mise_a_jour_1.copiesProtegees)(r, retour)).toEqual([COPIE]);
    });
    it('la copie de la mise à jour qui vient d’aboutir est protégée par le repère d’avant la migration', () => {
        const r = (0, copies_avant_mise_a_jour_1.repereApresCopie)({ commit: 'P' }, 'V', COPIE);
        expect((0, copies_avant_mise_a_jour_1.copiesProtegees)(r, (0, copies_avant_mise_a_jour_1.repereApresMigration)(r, 'V'))).toEqual([COPIE]);
        expect((0, copies_avant_mise_a_jour_1.copiesProtegees)({ commit: 'P' }, { commit: 'V' })).toEqual([]);
    });
    it('arrêtée par la licence, la mise à jour dit l’état de la base selon qu’un essai l’a déjà touchée (audit final F193)', () => {
        expect((0, copies_avant_mise_a_jour_1.etatDeLaBaseAuRefus)({ action: 'COPIER', versionDeLaBase: 'P', copiePerdue: null })).toMatch(/la base n’a pas été modifiée\.$/);
        expect((0, copies_avant_mise_a_jour_1.etatDeLaBaseAuRefus)({ action: 'PREMIER_DEMARRAGE' })).toMatch(/la base n’a pas été modifiée\.$/);
        const reprise = (0, copies_avant_mise_a_jour_1.etatDeLaBaseAuRefus)({ action: 'REPRENDRE', copie: COPIE });
        expect(reprise).toContain(COPIE);
        expect(reprise).toContain('à moitié migrée');
        expect(reprise).toMatch(/^Mise à jour arrêtée avant les migrations · une migration précédente/);
    });
});
describe('copies avant mise à jour · la rotation (audit final F265)', () => {
    const nom = (jour) => (0, copies_avant_mise_a_jour_1.nomCopieAvantMiseAJour)(new Date(2026, 0, jour, 9, 0, 0), 'abc');
    const noms = [nom(1), nom(2), nom(3), nom(4), 'omegax-20260105-090000.dump', 'rapport.pdf'];
    it('garde les N plus récentes, ne touche qu’à sa série, et jamais à tout', () => {
        expect((0, copies_avant_mise_a_jour_1.copiesAvantMiseAJourARetirer)(noms, 2)).toEqual([nom(2), nom(1)]);
        expect((0, copies_avant_mise_a_jour_1.copiesAvantMiseAJourARetirer)(noms, 0)).toEqual([nom(3), nom(2), nom(1)]);
    });
    it('une copie protégée ne part jamais, même au-delà du nombre gardé', () => {
        expect((0, copies_avant_mise_a_jour_1.copiesAvantMiseAJourARetirer)(noms, 2, [nom(1)])).toEqual([nom(2)]);
    });
});
//# sourceMappingURL=copies-avant-mise-a-jour.spec.js.map