"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const champs_audites_1 = require("./champs-audites");
const libelles_objets_audites_1 = require("./libelles-objets-audites");
describe('objets du journal d’audit · le filtre couvre tout ce qui est journalisé', () => {
    it('chaque modèle journalisé a son libellé, et aucun libellé ne nomme un modèle non journalisé', () => {
        expect(Object.keys(libelles_objets_audites_1.LIBELLES_OBJETS_AUDITES).sort()).toEqual([...champs_audites_1.MODELES_AUDITES].sort());
    });
    it('la route rend tous les objets, chacun avec son libellé de comptable', () => {
        const objets = (0, libelles_objets_audites_1.objetsAudites)();
        expect(objets).toHaveLength(champs_audites_1.MODELES_AUDITES.size);
        expect(objets.filter((o) => /[a-z][A-Z]/.test(o.libelle))).toEqual([]);
        for (const cle of ['RibTiers', 'OrdreVirement', 'BulletinPaie', 'MandatAuditeur']) {
            expect(objets.find((o) => o.cle === cle)?.libelle).toBe(libelles_objets_audites_1.LIBELLES_OBJETS_AUDITES[cle]);
        }
    });
    it('la liste est rangée par libellé', () => {
        const libelles = (0, libelles_objets_audites_1.objetsAudites)().map((o) => o.libelle);
        expect(libelles).toEqual([...libelles].sort((a, b) => a.localeCompare(b, 'fr')));
    });
});
//# sourceMappingURL=libelles-objets-audites.spec.js.map