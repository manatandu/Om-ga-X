"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const serveur = require("./routage-tva");
const client = require((0, node_path_1.join)(__dirname, '../../../client/src/lib/tva-syscohada'));
const { estTauxZero: estTauxZeroClient } = require((0, node_path_1.join)(__dirname, '../../../client/src/lib/tva-saisie'));
const numeros = (f) => [...(0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'comptes', f), 'utf8').matchAll(/'([267]\d{7})'/g)].map((m) => m[1]);
describe('F116 · le routage des comptes de TVA est le même au serveur et à la saisie', () => {
    const plan = new Set(['44310000', '44320000', '44330000', '44510000', '44520000', '44530000', '44540000']);
    for (const [referentiel, fichier] of [
        ['SYSCOHADA', 'compte-seed-syscohada.ts'],
        ['SYCEBNL', 'compte-seed.ts'],
    ]) {
        it(`${referentiel} · chaque compte de gestion, dans les deux sens`, () => {
            const liste = numeros(fichier);
            expect(liste.length).toBeGreaterThan(100);
            for (const n of liste) {
                for (const sens of ['recette', 'depense']) {
                    expect(serveur.compteTvaPourContrepartie(referentiel, sens, n, plan)).toBe(client.compteTvaPourContrepartie(referentiel, sens, n, plan));
                }
            }
        });
    }
    it('les sous-comptes de taxe semés retenus sont exactement ceux que le routage impose, et semés au SYSCOHADA', () => {
        const routes = new Set();
        for (const n of numeros('compte-seed-syscohada.ts')) {
            for (const r of [serveur.compteTvaCollectee(n), serveur.compteTvaRecuperable(n)])
                if (r)
                    routes.add(r);
        }
        expect([...routes].sort()).toEqual([...serveur.COMPTES_DE_TAXE_ROUTES_SYSCOHADA].sort());
        const semis = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'comptes', 'compte-seed-syscohada.ts'), 'utf8');
        for (const n of serveur.COMPTES_DE_TAXE_ROUTES_SYSCOHADA)
            expect(semis).toContain(`'${n}'`);
        const migration = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../prisma/migrations/20270164000000_comptes_personnalises/migration.sql'), 'utf8');
        expect(migration).toContain(serveur.COMPTES_DE_TAXE_ROUTES_SYSCOHADA.map((n) => `'${n}'`).join(', '));
    });
    it('le taux zéro se lit pareil', () => {
        for (const t of ['0', '0.00', '16', '8', '0.000001']) {
            expect(serveur.estTauxZero(t)).toBe(estTauxZeroClient({ taux: t }));
        }
    });
});
//# sourceMappingURL=routage-tva-parite.spec.js.map