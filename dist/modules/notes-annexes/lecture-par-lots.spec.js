"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const note_annexe_service_1 = require("./note-annexe.service");
function sourcePaginee(nombre, taille) {
    const donnees = Array.from({ length: nombre }, (_, i) => ({ id: `l-${String(i).padStart(6, '0')}`, valeur: 1 }));
    let appels = 0;
    return {
        donnees,
        get appels() {
            return appels;
        },
        charger: async (curseur) => {
            appels++;
            const depart = curseur ? donnees.findIndex((d) => d.id === curseur) + 1 : 0;
            return donnees.slice(depart, depart + taille);
        },
    };
}
describe('lecture par lots', () => {
    it('visite chaque élément UNE fois, jamais deux', async () => {
        const source = sourcePaginee(2503, 100);
        const vus = [];
        await (0, note_annexe_service_1.lireParLots)(source.charger, (e) => vus.push(e.id), 100);
        expect(vus).toHaveLength(2503);
        expect(new Set(vus).size).toBe(2503);
        expect(vus).toEqual(source.donnees.map((d) => d.id));
    });
    it('la somme lue égale la somme réelle', async () => {
        const source = sourcePaginee(10_000, 5000);
        let total = 0;
        await (0, note_annexe_service_1.lireParLots)(source.charger, (e) => (total += e.valeur), 5000);
        expect(total).toBe(10_000);
    });
    it('s’arrête sur un lot INCOMPLET, sans requête pour rien', async () => {
        const source = sourcePaginee(250, 100);
        await (0, note_annexe_service_1.lireParLots)(source.charger, () => undefined, 100);
        expect(source.appels).toBe(3);
    });
    it('un dernier lot PLEIN demande bien la tranche suivante', async () => {
        const source = sourcePaginee(200, 100);
        const vus = [];
        await (0, note_annexe_service_1.lireParLots)(source.charger, (e) => vus.push(e.id), 100);
        expect(vus).toHaveLength(200);
        expect(source.appels).toBe(3);
    });
    it('une collection vide ne coûte qu’une requête', async () => {
        const source = sourcePaginee(0, 100);
        await (0, note_annexe_service_1.lireParLots)(source.charger, () => undefined, 100);
        expect(source.appels).toBe(1);
    });
});
describe('les deux lectures lourdes passent bien par les lots', () => {
    const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'note-annexe.service.ts'), 'utf8');
    it('la ventilation par nature et les échéances sont paginées', () => {
        const parLots = source.match(/this\.parLots\(/g) ?? [];
        expect(parLots).toHaveLength(2);
    });
    it('chaque requête paginée porte `skip: 1` avec son curseur', () => {
        const curseurs = source.match(/cursor: \{ id: curseur \}, skip: 1/g) ?? [];
        expect(curseurs).toHaveLength(2);
    });
    it('chaque requête paginée est ORDONNÉE · un curseur sans ordre ne veut rien dire', () => {
        const ordres = source.match(/orderBy: \{ id: 'asc' \},\s*\n\s*take: NoteAnnexeService\.LOT_LECTURE/g) ?? [];
        expect(ordres).toHaveLength(2);
    });
    it('le lot reste d’une taille qui tient dans un conteneur', () => {
        expect(note_annexe_service_1.LOT_LECTURE).toBeLessThanOrEqual(10_000);
        expect(note_annexe_service_1.LOT_LECTURE).toBeGreaterThanOrEqual(500);
    });
});
//# sourceMappingURL=lecture-par-lots.spec.js.map