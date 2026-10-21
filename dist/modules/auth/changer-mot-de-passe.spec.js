"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const auth_service_1 = require("./auth.service");
describe('AuthService · changement de mot de passe', () => {
    const service = (capture, motDePasseStocke) => new auth_service_1.AuthService({
        user: {
            findUnique: async () => ({ id: 'u1', motDePasse: motDePasseStocke }),
            update: async ({ data }) => {
                capture.data = data;
                return {};
            },
        },
    }, { sign: () => 'jeton-neuf' }, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    it('refuse sans le mot de passe actuel correct, et ne touche à rien', async () => {
        const capture = {};
        const hash = await bcrypt.hash('bon-mot-de-passe', 4);
        await expect(service(capture, hash).changerMotDePasse('u1', 'mauvais', 'nouveau-tres-long')).rejects.toThrow(common_1.UnauthorizedException);
        expect(capture.data).toBeUndefined();
    });
    it('hache le nouveau mot de passe et efface le drapeau de première connexion', async () => {
        const capture = {};
        const hash = await bcrypt.hash('bon-mot-de-passe', 4);
        await service(capture, hash).changerMotDePasse('u1', 'bon-mot-de-passe', 'nouveau-tres-long');
        expect(capture.data.doitChangerMotDePasse).toBe(false);
        expect(capture.data.motDePasse).not.toBe('nouveau-tres-long');
        expect(await bcrypt.compare('nouveau-tres-long', capture.data.motDePasse)).toBe(true);
    });
    it('RÉVOQUE les sessions ouvertes · un mot de passe change souvent parce qu’il a fuité', async () => {
        const capture = {};
        const hash = await bcrypt.hash('bon-mot-de-passe', 4);
        const resultat = await service(capture, hash).changerMotDePasse('u1', 'bon-mot-de-passe', 'nouveau-tres-long');
        expect(capture.data.sessionsInvalidesAvant).toBeInstanceOf(Date);
        expect(capture.data.tentativesEchouees).toBe(0);
        expect(capture.data.verrouilleJusqua).toBeNull();
        expect(capture.data.dernierEchecLe).toBeNull();
        expect(resultat).toMatchObject({ change: true, accessToken: 'jeton-neuf' });
    });
});
//# sourceMappingURL=changer-mot-de-passe.spec.js.map