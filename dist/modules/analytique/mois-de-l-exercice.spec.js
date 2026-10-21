"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const mois_de_l_exercice_1 = require("./mois-de-l-exercice");
const SCRIPT = `
  const { bornesDuMois } = require('./src/modules/analytique/mois-de-l-exercice');
  const civil = bornesDuMois(new Date(Date.UTC(2026, 0, 1)), 1);
  const decale = bornesDuMois(new Date(Date.UTC(2026, 6, 1)), 3);
  console.log(JSON.stringify({
    janvierDebut: civil.debut.toISOString(),
    janvierFin: civil.fin.toISOString(),
    marsDebut: decale.debut.toISOString(),
    marsFin: decale.fin.toISOString(),
  }));
`;
describe('bornesDuMois · le mois choisi, en UTC', () => {
    it('le mois qui précède l’ouverture tombe l’année suivante, fin au dernier jour 23 h 59 min 59 s', () => {
        const { debut, fin } = (0, mois_de_l_exercice_1.bornesDuMois)(new Date(Date.UTC(2026, 6, 1)), 2);
        expect(debut.toISOString()).toBe('2027-02-01T00:00:00.000Z');
        expect(fin.toISOString()).toBe('2027-02-28T23:59:59.000Z');
    });
    for (const tz of ['Africa/Kinshasa', 'America/Bogota', 'Asia/Tokyo']) {
        it(`${tz} · une écriture datée du 1er janvier à minuit UTC est dans janvier`, () => {
            const sortie = (0, node_child_process_1.execFileSync)((0, node_path_1.join)(__dirname, '../../../node_modules/.bin/ts-node'), ['-T', '-O', '{"module":"commonjs"}', '-e', SCRIPT], { cwd: (0, node_path_1.join)(__dirname, '../../..'), env: { ...process.env, TZ: tz }, encoding: 'utf8' });
            expect(JSON.parse(sortie)).toEqual({
                janvierDebut: '2026-01-01T00:00:00.000Z',
                janvierFin: '2026-01-31T23:59:59.000Z',
                marsDebut: '2027-03-01T00:00:00.000Z',
                marsFin: '2027-03-31T23:59:59.000Z',
            });
        }, 60_000);
    }
    it('l’état budgétaire appelle cette règle et ne recompose plus le mois à l’heure locale', () => {
        const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'etats-analytiques.service.ts'), 'utf8');
        expect(service).toContain('({ debut, fin } = bornesDuMois(exercice.dateDebut, params.mois));');
    });
});
//# sourceMappingURL=mois-de-l-exercice.spec.js.map