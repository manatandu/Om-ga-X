"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const fonctions_metier_1 = require("./fonctions-metier");
const jwt_auth_guard_1 = require("../../modules/auth/jwt-auth.guard");
const ecriture_controller_1 = require("../../modules/comptabilite/ecriture.controller");
const devises_controller_1 = require("../../modules/devises/devises.controller");
const acces_roles_cantonnes_decorator_1 = require("../decorators/acces-roles-cantonnes.decorator");
const lettrage_controller_1 = require("../../modules/lettrage/lettrage.controller");
const utilisateur_service_1 = require("../../modules/utilisateurs/utilisateur.service");
const RACINE = (0, path_1.join)(__dirname, '..', '..', 'modules');
function controleurs(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
        const chemin = (0, path_1.join)(dossier, nom);
        if ((0, fs_1.statSync)(chemin).isDirectory())
            return controleurs(chemin);
        return nom.endsWith('.controller.ts') ? [chemin] : [];
    });
}
function classesQuiEcrivent() {
    const sortie = new Map();
    for (const chemin of controleurs(RACINE)) {
        const source = (0, fs_1.readFileSync)(chemin, 'utf-8');
        const blocs = source.split(/@Controller\(/).slice(1);
        for (const bloc of blocs) {
            const classe = /export class (\w+)/.exec(bloc)?.[1];
            if (!classe)
                continue;
            const methodes = [...bloc.matchAll(/@(?:Post|Put|Patch|Delete)\([^)]*\)[\s\S]*?\n {2}(?:async )?(\w+)\(/g)].map((m) => m[1]);
            if (methodes.length)
                sortie.set(classe, methodes);
        }
    }
    return sortie;
}
describe('la table est fermée · chaque contrôleur qui écrit est rangé', () => {
    const classes = classesQuiEcrivent();
    it('le relevé trouve encore des contrôleurs · un garde-fou qui ne trouve rien ne vérifie rien', () => {
        expect(classes.size).toBeGreaterThan(40);
        expect(classes.get('EcritureController')).toEqual(expect.arrayContaining(['valider', 'creer']));
    });
    it('aucun contrôleur qui écrit n’est oublié', () => {
        const oublies = [...classes.keys()].filter((c) => !(c in fonctions_metier_1.FONCTION_PAR_CONTROLEUR) && !(c in fonctions_metier_1.CONTROLEURS_HORS_PROFIL));
        expect(oublies).toEqual([]);
    });
    it('aucune entrée de la table ne vise un contrôleur ou une méthode qui n’existe plus', () => {
        expect(Object.keys(fonctions_metier_1.FONCTION_PAR_CONTROLEUR).filter((c) => !classes.has(c))).toEqual([]);
        for (const cle of Object.keys(fonctions_metier_1.FONCTION_PAR_METHODE)) {
            const [classe, methode] = cle.split('.');
            expect([cle, classes.get(classe)?.includes(methode)]).toEqual([cle, true]);
        }
    });
    it('valider n’est pas saisir', () => {
        expect((0, fonctions_metier_1.fonctionDeRoute)('EcritureController', 'creer')).toBe(client_1.FonctionMetier.SAISIE);
        expect((0, fonctions_metier_1.fonctionDeRoute)('EcritureController', 'valider')).toBe(client_1.FonctionMetier.VALIDATION);
        expect((0, fonctions_metier_1.fonctionDeRoute)('EcritureController', 'validerJusqua')).toBe(client_1.FonctionMetier.VALIDATION);
    });
    it('la table du gestionnaire de paie ne vise que des routes qui existent ET qui lui sont ouvertes', () => {
        const proto = devises_controller_1.DevisesController.prototype;
        expect(Object.keys(fonctions_metier_1.FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE).length).toBeGreaterThan(0);
        for (const cle of Object.keys(fonctions_metier_1.FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE)) {
            const [classe, methode] = cle.split('.');
            expect([cle, classes.get(classe)?.includes(methode)]).toEqual([cle, true]);
            expect(classe).toBe('DevisesController');
            expect([cle, Reflect.getMetadata(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, proto[methode])]).toEqual([cle, { gestionnairePaie: true }]);
        }
    });
    it('coter l’USD du jour relève de la paie pour le gestionnaire, de la structure pour le comptable (audit final F247)', () => {
        expect((0, fonctions_metier_1.fonctionDeRoute)('DevisesController', 'poserCours', client_1.RoleUtilisateur.GESTIONNAIRE_PAIE)).toBe(client_1.FonctionMetier.PAIE);
        for (const role of [client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.AIDE_COMPTABLE, undefined]) {
            expect([role, (0, fonctions_metier_1.fonctionDeRoute)('DevisesController', 'poserCours', role)]).toEqual([role, client_1.FonctionMetier.STRUCTURE]);
        }
        expect((0, fonctions_metier_1.fonctionDeRoute)('DevisesController', 'creer', client_1.RoleUtilisateur.GESTIONNAIRE_PAIE)).toBe(client_1.FonctionMetier.STRUCTURE);
    });
});
describe('la règle', () => {
    const comptable = { role: client_1.RoleUtilisateur.COMPTABLE, restreindreFonctions: true, fonctionsAutorisees: [client_1.FonctionMetier.SAISIE] };
    it('refuse une écriture hors profil, en nommant la fonction', () => {
        expect((0, fonctions_metier_1.motifRefusFonction)(comptable, 'POST', client_1.FonctionMetier.VALIDATION)).toMatch(/Validation des écritures.*ne vous est pas ouverte/);
        expect((0, fonctions_metier_1.motifRefusFonction)(comptable, 'DELETE', client_1.FonctionMetier.LETTRAGE)).not.toBeNull();
    });
    it('laisse passer la fonction ouverte, toute lecture, et tout utilisateur non restreint', () => {
        expect((0, fonctions_metier_1.motifRefusFonction)(comptable, 'POST', client_1.FonctionMetier.SAISIE)).toBeNull();
        expect((0, fonctions_metier_1.motifRefusFonction)(comptable, 'GET', client_1.FonctionMetier.VALIDATION)).toBeNull();
        expect((0, fonctions_metier_1.motifRefusFonction)({ ...comptable, restreindreFonctions: false }, 'POST', client_1.FonctionMetier.VALIDATION)).toBeNull();
    });
    it('l’administrateur n’est jamais restreint, même si la base dit le contraire', () => {
        expect((0, fonctions_metier_1.motifRefusFonction)({ ...comptable, role: client_1.RoleUtilisateur.ADMIN_CABINET }, 'POST', client_1.FonctionMetier.VALIDATION)).toBeNull();
    });
});
describe('JwtAuthGuard applique le profil', () => {
    const garde = new jwt_auth_guard_1.JwtAuthGuard(new core_1.Reflector());
    const parent = Object.getPrototypeOf(jwt_auth_guard_1.JwtAuthGuard.prototype);
    const contexte = (user, methode, handler, classe) => ({
        switchToHttp: () => ({ getRequest: () => ({ user, method: methode }) }),
        getHandler: () => handler,
        getClass: () => classe,
    });
    beforeEach(() => jest.spyOn(parent, 'canActivate').mockResolvedValue(true));
    afterEach(() => jest.restoreAllMocks());
    const saisieSeule = { role: client_1.RoleUtilisateur.COMPTABLE, restreindreFonctions: true, fonctionsAutorisees: [client_1.FonctionMetier.SAISIE] };
    it('refuse la validation à un profil de saisie, laisse la saisie', async () => {
        await expect(garde.canActivate(contexte(saisieSeule, 'POST', ecriture_controller_1.EcritureController.prototype.valider, ecriture_controller_1.EcritureController))).rejects.toThrow(/Validation des écritures/);
        await expect(garde.canActivate(contexte(saisieSeule, 'POST', ecriture_controller_1.EcritureController.prototype.creer, ecriture_controller_1.EcritureController))).resolves.toBe(true);
    });
    it('le gestionnaire de paie au profil « Personnel et paie » cote l’USD du jour ; un comptable au même profil, non', async () => {
        const paieSeule = { restreindreFonctions: true, fonctionsAutorisees: [client_1.FonctionMetier.PAIE] };
        const coter = devises_controller_1.DevisesController.prototype.poserCours;
        await expect(garde.canActivate(contexte({ ...paieSeule, role: client_1.RoleUtilisateur.GESTIONNAIRE_PAIE }, 'POST', coter, devises_controller_1.DevisesController))).resolves.toBe(true);
        await expect(garde.canActivate(contexte({ ...paieSeule, role: client_1.RoleUtilisateur.COMPTABLE }, 'POST', coter, devises_controller_1.DevisesController))).rejects.toThrow(/Structure · plan comptable, journaux, taxes, devises/);
        await expect(garde.canActivate(contexte({ role: client_1.RoleUtilisateur.GESTIONNAIRE_PAIE, restreindreFonctions: true, fonctionsAutorisees: [client_1.FonctionMetier.STRUCTURE] }, 'POST', coter, devises_controller_1.DevisesController))).rejects.toThrow(/Personnel et paie/);
    });
    it('refuse le lettrage, mais laisse le consulter', async () => {
        const methodes = Object.getOwnPropertyNames(lettrage_controller_1.LettrageController.prototype).filter((m) => m !== 'constructor');
        const une = lettrage_controller_1.LettrageController.prototype[methodes[0]];
        await expect(garde.canActivate(contexte(saisieSeule, 'POST', une, lettrage_controller_1.LettrageController))).rejects.toThrow(/Lettrage/);
        await expect(garde.canActivate(contexte(saisieSeule, 'GET', une, lettrage_controller_1.LettrageController))).resolves.toBe(true);
    });
});
describe('la définition du profil', () => {
    function service(role) {
        const update = jest.fn(async (a) => a);
        const p = { user: { findFirst: jest.fn(async () => ({ id: 'u2', role })), update } };
        return { s: new utilisateur_service_1.UtilisateurService(p), update };
    }
    it('refuse de restreindre un administrateur, sans rien écrire', async () => {
        const { s, update } = service(client_1.RoleUtilisateur.ADMIN_CABINET);
        await expect(s.definirFonctions('t1', 'u2', { restreindre: true, fonctions: [] })).rejects.toThrow(/jamais restreint/);
        expect(update).not.toHaveBeenCalled();
    });
    it('pose le profil et FERME les sessions, pour qu’il prenne effet tout de suite', async () => {
        const { s, update } = service(client_1.RoleUtilisateur.COMPTABLE);
        await s.definirFonctions('t1', 'u2', { restreindre: true, fonctions: [client_1.FonctionMetier.SAISIE, client_1.FonctionMetier.SAISIE] });
        const data = update.mock.calls[0][0].data;
        expect(data).toMatchObject({ restreindreFonctions: true, fonctionsAutorisees: [client_1.FonctionMetier.SAISIE] });
        expect(data.sessionsInvalidesAvant).toBeInstanceOf(Date);
    });
    it('lever la restriction vide la liste', async () => {
        const { s, update } = service(client_1.RoleUtilisateur.COMPTABLE);
        await s.definirFonctions('t1', 'u2', { restreindre: false, fonctions: [client_1.FonctionMetier.SAISIE] });
        expect(update.mock.calls[0][0].data).toMatchObject({ restreindreFonctions: false, fonctionsAutorisees: [] });
    });
});
//# sourceMappingURL=fonctions-metier.spec.js.map