"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt = require("bcryptjs");
require("reflect-metadata");
const auth_controller_1 = require("./auth.controller");
const sortie_mot_de_passe_decorator_1 = require("../../common/decorators/sortie-mot-de-passe.decorator");
const auth_service_1 = require("./auth.service");
function service(user, echec) {
    const update = jest.fn(async () => {
        if (echec)
            throw echec;
        return {};
    });
    const s = new auth_service_1.AuthService({ user: { findUnique: async () => user, update } }, { sign: () => 'jeton' }, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    return { s, update };
}
describe('changer son adresse de connexion', () => {
    let hash;
    beforeAll(async () => {
        hash = await bcrypt.hash('le-bon', 4);
    });
    const utilisateur = () => ({ id: 'u1', email: 'admin@vmgconsulting.cd', motDePasse: hash });
    it('exige le mot de passe actuel, sans rien écrire sinon', async () => {
        const { s, update } = service(utilisateur());
        await expect(s.changerAdresse('u1', 'faux', 'admin@vmgconsulting.net')).rejects.toThrow(/mot de passe actuel est incorrect/);
        expect(update).not.toHaveBeenCalled();
    });
    it('change l’adresse, ferme les sessions et en repose une neuve', async () => {
        const { s, update } = service(utilisateur());
        const r = await s.changerAdresse('u1', 'le-bon', '  admin@vmgconsulting.net ');
        const appel = update.mock.calls[0][0];
        expect(appel.where).toEqual({ id: 'u1' });
        expect(appel.data.email).toBe('admin@vmgconsulting.net');
        expect(appel.data.sessionsInvalidesAvant).toBeInstanceOf(Date);
        expect(r).toMatchObject({ adresse: 'admin@vmgconsulting.net', accessToken: 'jeton' });
        expect(Object.keys(appel.data).sort()).toEqual(['email', 'sessionsInvalidesAvant']);
    });
    it('une adresse déjà prise est refusée sans dire à qui elle appartient', async () => {
        const { s } = service(utilisateur(), { code: 'P2002' });
        await expect(s.changerAdresse('u1', 'le-bon', 'autre@exemple.cd')).rejects.toThrow('Cette adresse est déjà utilisée par un autre compte.');
    });
    it('refuse l’adresse actuelle', async () => {
        const { s } = service(utilisateur());
        await expect(s.changerAdresse('u1', 'le-bon', 'admin@vmgconsulting.cd')).rejects.toThrow(/déjà votre adresse/);
    });
    it('la route n’est PAS une sortie de mot de passe provisoire · on lit la métadonnée, pas le texte', () => {
        const lire = (m) => Reflect.getMetadata(sortie_mot_de_passe_decorator_1.CLE_SORTIE_MOT_DE_PASSE, m);
        expect(lire(auth_controller_1.AuthController.prototype.changerMotDePasse)).toBe(true);
        expect(lire(auth_controller_1.AuthController.prototype.changerAdresse)).toBeUndefined();
    });
});
//# sourceMappingURL=changer-adresse.spec.js.map