"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const compte_seed_1 = require("../comptes/compte-seed");
const canevas_tresorerie_1 = require("./canevas-tresorerie");
const parNumero = new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c]));
describe('comptes du canevas et plan SYCEBNL semé', () => {
    const comptes = [
        ...canevas_tresorerie_1.RUBRIQUES_CANEVAS.map((r) => [r.libelle, r.compte]),
        ...Object.entries(canevas_tresorerie_1.TRESORERIES_CANEVAS).map(([l, t]) => [l, t.compte]),
    ];
    it.each(comptes)('%s · %s existe au semis, en compte de DÉTAIL', (_libelle, numero) => {
        const c = parNumero.get(numero);
        expect([numero, c ? 'semé' : 'absent']).toEqual([numero, 'semé']);
        expect([numero, c?.typeCompte ?? client_1.TypeCompteDetailTotal.DETAIL]).toEqual([numero, client_1.TypeCompteDetailTotal.DETAIL]);
    });
    it('une dépense vise une charge ou une immobilisation, une recette un produit, hors transferts', () => {
        for (const r of canevas_tresorerie_1.RUBRIQUES_CANEVAS) {
            if (r.compte.startsWith('58'))
                continue;
            const classe = r.compte[0];
            expect([r.libelle, r.sens === 'recette' ? classe === '7' : classe === '6' || classe === '2']).toEqual([r.libelle, true]);
        }
    });
});
//# sourceMappingURL=canevas-comptes-semes.spec.js.map