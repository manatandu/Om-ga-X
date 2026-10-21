"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const exercice_service_1 = require("./exercice.service");
const exercice_contigu_1 = require("./exercice-contigu");
const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
describe('exercice contigu · la règle', () => {
    it('le suivant est contigu quand il commence le lendemain de la fin, années bissextiles comprises', () => {
        expect((0, exercice_contigu_1.estContigu)(d('2026-12-31'), d('2027-01-01'))).toBe(true);
        expect((0, exercice_contigu_1.estContigu)(d('2028-02-28'), d('2028-02-29'))).toBe(true);
        expect((0, exercice_contigu_1.estContigu)(d('2026-12-31'), d('2028-01-01'))).toBe(false);
    });
    it('une heure portée par la colonne ne compte pas', () => {
        expect((0, exercice_contigu_1.estContigu)(new Date('2026-12-31T23:59:59.999Z'), d('2027-01-01'))).toBe(true);
    });
    it('le refus d’un geste nomme le jour qui manque et l’issue', () => {
        const m = (0, exercice_contigu_1.motifSuivantNonContigu)(d('2026-12-31'), { dateDebut: d('2028-01-01') });
        expect(m).toContain('01/01/2027');
        expect(m).toContain('01/01/2028');
        expect(m).toContain('AUDCIF art. 34');
        expect(m).toContain('SYCEBNL art. 16, 4°');
        expect(m).toContain('créez d');
    });
    it('une création touche le précédent ou le suivant, sinon elle est refusée', () => {
        expect((0, exercice_contigu_1.motifCreationNonContigue)(d('2027-01-01'), d('2027-12-31'), { dateFin: d('2026-12-31') }, { dateDebut: d('2028-01-01') })).toBeNull();
        expect((0, exercice_contigu_1.motifCreationNonContigue)(d('2025-01-01'), d('2025-12-31'), null, { dateDebut: d('2026-01-01') })).toBeNull();
        expect((0, exercice_contigu_1.motifCreationNonContigue)(d('2028-01-01'), d('2028-12-31'), { dateFin: d('2026-12-31') }, null)).toContain('31/12/2026');
        expect((0, exercice_contigu_1.motifCreationNonContigue)(d('2024-01-01'), d('2024-12-31'), null, { dateDebut: d('2026-01-01') })).toContain('01/01/2026');
    });
});
function serviceAvec(existants) {
    const findFirst = async (args) => {
        const w = args?.where ?? {};
        let lignes = existants.filter((e) => (w.dateDebut?.lte === undefined || e.dateDebut <= w.dateDebut.lte) &&
            (w.dateDebut?.gt === undefined || e.dateDebut > w.dateDebut.gt) &&
            (w.dateFin?.gte === undefined || e.dateFin >= w.dateFin.gte) &&
            (w.dateFin?.lt === undefined || e.dateFin < w.dateFin.lt));
        if (args?.orderBy?.dateFin === 'desc')
            lignes = [...lignes].sort((a, b) => b.dateFin.getTime() - a.dateFin.getTime());
        if (args?.orderBy?.dateDebut === 'asc')
            lignes = [...lignes].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
        return lignes[0] ?? null;
    };
    return new exercice_service_1.ExerciceService({
        exercice: { count: async () => existants.length, findFirst, create: async (a) => a },
        tenant: { findUnique: async () => ({ referentiel: 'SYCEBNL', formeJuridiqueSyscohada: null, dateDissolution: null }) },
    }, {});
}
describe('exercice contigu · la création', () => {
    const an = (y) => ({ dateDebut: d(`${y}-01-01`), dateFin: d(`${y}-12-31`) });
    it('refuse 2028 quand le dossier finit en 2026 (le cas G3)', async () => {
        const promesse = serviceAvec([an(2026)]).creer('t1', { dateDebut: '2028-01-01', dateFin: '2028-12-31' });
        await expect(promesse).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(promesse).rejects.toThrow(/ne touche aucun exercice/);
    });
    it('accepte 2027 à la suite de 2026, et 2027 dans le trou d’un dossier né avant la règle', async () => {
        await expect(serviceAvec([an(2026)]).creer('t1', { dateDebut: '2027-01-01', dateFin: '2027-12-31' })).resolves.toBeDefined();
        await expect(serviceAvec([an(2026), an(2028)]).creer('t1', { dateDebut: '2027-01-01', dateFin: '2027-12-31' })).resolves.toBeDefined();
    });
    it('accepte une année ajoutée juste avant le premier exercice', async () => {
        await expect(serviceAvec([an(2026)]).creer('t1', { dateDebut: '2025-01-01', dateFin: '2025-12-31' })).resolves.toBeDefined();
    });
});
describe('exercice contigu · les gestes qui écrivent dans le suivant', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
    it('la clôture, le report provisoire, l’aperçu et les budgets gardent le suivant contigu', () => {
        const src = lire('exercice.service.ts');
        const lectures = src.split('dateDebut: { gt: exercice.dateFin }').length - 1;
        expect(lectures).toBeGreaterThanOrEqual(4);
        expect(src.match(/estContigu\(exercice\.dateFin, (exerciceSuivant|suivant)\.dateDebut\)/g)?.length).toBe(4);
    });
    it('l’affectation du résultat garde le suivant contigu', () => {
        const src = fs.readFileSync(path.join(__dirname, '../affectation/affectation.service.ts'), 'utf8');
        expect(src).toMatch(/estContigu\(exercice\.dateFin, suivant\.dateDebut\)/);
    });
});
//# sourceMappingURL=exercice-contigu.spec.js.map