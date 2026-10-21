"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const correspondance_retenues_1 = require("./correspondance-retenues");
const semis = (f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'comptes', f), 'utf8');
const detailsDe = (source, racine) => [...source.matchAll(/'(43[12]\d{5})'/g)].map((m) => m[1]).filter((n) => racine.test(n));
const nature = (cle) => correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === cle);
const naturesDe = (numero) => correspondance_retenues_1.NATURES_RETENUES.filter((n) => (0, correspondance_retenues_1.compteRelevantDe)(numero, n)).map((n) => n.cle);
describe('F115 · la CNSS du registre des retenues, lue sur les deux plans semés', () => {
    const syscohada = semis('compte-seed-syscohada.ts');
    const sycebnl = semis('compte-seed.ts');
    it('chaque compte de détail du 431 et du 432 relève d’une nature et d’une seule', () => {
        for (const source of [syscohada, sycebnl]) {
            const comptes = detailsDe(source, /^43[12]/);
            expect(comptes.length).toBeGreaterThan(3);
            for (const n of comptes)
                expect(naturesDe(n)).toHaveLength(1);
        }
    });
    it('la retraite obligatoire est CNSS dans les deux plans · 4313 et 4321', () => {
        expect(syscohada).toContain("'43130000', 'Caisse de retraite obligatoire'");
        expect(sycebnl).toContain("'43210000', 'Caisses de retraite · obligatoire'");
        expect((0, correspondance_retenues_1.compteRelevantDe)('43130000', nature('cnss'))).toBe(true);
        expect((0, correspondance_retenues_1.compteRelevantDe)('43210000', nature('cnss'))).toBe(true);
    });
    it('les retraites complémentaires et facultatives ne sont pas la CNSS', () => {
        expect(syscohada).toContain("'43200000', 'Caisses de retraite complémentaire'");
        expect(syscohada).toContain("'43140000', 'Caisse de retraite facultative'");
        expect(sycebnl).toContain("'43220000', 'Caisses de retraite · complémentaire'");
        for (const n of ['43200000', '43140000', '43220000', '43280000']) {
            expect(naturesDe(n)).toEqual(['autresOrganismesSociaux']);
        }
    });
});
//# sourceMappingURL=cnss-comptes-semes.spec.js.map