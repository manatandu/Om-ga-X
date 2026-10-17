"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const tenant_service_1 = require("./tenant.service");
const service = (numeros, capture = {}) => new tenant_service_1.TenantService({
    tenant: {
        findUnique: async () => ({ id: 't1', longueurCompte: 8, referentiel: 'SYCEBNL' }),
        update: async ({ data }) => {
            capture.data = data;
            return { id: 't1' };
        },
    },
    compte: { findMany: async () => numeros.map((numero) => ({ numero })) },
    ecriture: { count: async () => 0 },
});
describe('Longueur des numéros de compte', () => {
    it('s’élargit · c’est le seul sens qui ne casse rien', async () => {
        const capture = {};
        await service(['41100000', '60410000'], capture).modifierLongueurCompte('t1', 10);
        expect(capture.data).toEqual({ longueurCompte: 10 });
    });
    it('REFUSE de descendre sous le plus long numéro déjà ouvert, et le NOMME', async () => {
        const capture = {};
        const s = service(['411', '41100000'], capture);
        await expect(s.modifierLongueurCompte('t1', 6)).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(s.modifierLongueurCompte('t1', 6)).rejects.toThrow('41100000');
        expect(capture.data).toBeUndefined();
    });
    it('le plancher se lit sur la LONGUEUR, pas sur l’ordre alphabétique', async () => {
        const capture = {};
        const s = service(['9', '41100000', '411'], capture);
        await expect(s.modifierLongueurCompte('t1', 7)).rejects.toBeInstanceOf(common_1.BadRequestException);
        await s.modifierLongueurCompte('t1', 8);
        expect(capture.data).toEqual({ longueurCompte: 8 });
    });
    it('accepte la longueur ÉGALE au plancher · c’est un plancher, pas une exclusion', async () => {
        const capture = {};
        await service(['41100000'], capture).modifierLongueurCompte('t1', 8);
        expect(capture.data).toEqual({ longueurCompte: 8 });
    });
    it('tient la plage de 3 à 13 · celle des logiciels de la place', async () => {
        const s = service([]);
        await expect(s.modifierLongueurCompte('t1', 2)).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(s.modifierLongueurCompte('t1', 14)).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(s.modifierLongueurCompte('t1', 8.5)).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('SERT le plancher avec les paramètres · l’écran ne le recalcule pas', async () => {
        const params = (await service(['411', '41100000']).parametres('t1'));
        expect(params.longueurCompteMinimale).toBe(8);
        expect(params.longueurCompteExemple).toBe('41100000');
    });
    it('l’écran désactive les longueurs impossibles avec ce chiffre-là', () => {
        const page = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../client/src/pages/ParametresDossierPage.tsx'), 'utf8');
        expect(page).toContain("api.patch<ParametresDossier>('/dossier/longueur-compte'");
        expect(page).toContain('disabled={n < params.longueurCompteMinimale}');
        expect(page).not.toContain("['Longueur des comptes', `${params.longueurCompte} caractères`]");
    });
    it('dit ce que la longueur NE FAIT PAS · le plan normalisé n’est pas renuméroté', () => {
        const page = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../client/src/pages/ParametresDossierPage.tsx'), 'utf8');
        expect(page).toContain('garde ses huit chiffres et n’est pas renuméroté');
    });
});
//# sourceMappingURL=longueur-compte.spec.js.map