"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const fs_1 = require("fs");
const path_1 = require("path");
const auth_service_1 = require("../auth/auth.service");
const auth_controller_1 = require("../auth/auth.controller");
const extension_cloisonnement_1 = require("../../common/cloisonnement/extension-cloisonnement");
const contexte_audit_1 = require("../../common/audit/contexte-audit");
const administrateur_installation_guard_1 = require("./administrateur-installation.guard");
const sur_site_controller_1 = require("./sur-site.controller");
const surSiteAsync = async (f) => {
    const avant = process.env.MODE_INSTALLATION;
    process.env.MODE_INSTALLATION = 'SUR_SITE';
    try {
        return await f();
    }
    finally {
        if (avant === undefined)
            delete process.env.MODE_INSTALLATION;
        else
            process.env.MODE_INSTALLATION = avant;
    }
};
const DOSSIERS = [
    { id: 'second', createdAt: new Date('2026-03-01T10:00:00Z') },
    { id: 'premier', createdAt: new Date('2026-01-15T09:00:00Z') },
];
function service(dossiers = DOSSIERS) {
    const brut = {
        tenant: {
            findFirst: async ({ orderBy }) => {
                const sens = orderBy[0]?.createdAt === 'asc' ? 1 : -1;
                const t = [...dossiers].sort((a, b) => sens * (a.createdAt.getTime() - b.createdAt.getTime()))[0];
                return t ? { id: t.id } : null;
            },
            count: async () => dossiers.length,
        },
    };
    const garde = (op) => (args) => (0, extension_cloisonnement_1.garderCloisonnement)(brut, {
        model: 'Tenant',
        operation: op,
        args,
        query: () => brut.tenant[op](args),
    });
    const prisma = { tenant: { findFirst: garde('findFirst'), count: garde('count') } };
    const deps = Array.from({ length: 9 }, () => ({}));
    return new auth_service_1.AuthService(prisma, ...deps);
}
const dansLeDossier = (tenantId, f) => (0, contexte_audit_1.dansContexteAudit)({ acteurId: 'u', acteurEmail: 'u@poste.cd', tenantId }, f);
describe('F44 · le dossier d’installation, lu à travers la vraie garde', () => {
    it('est le premier dossier créé sur le poste, quel que soit le dossier de la session', async () => {
        await expect(dansLeDossier('second', () => service().dossierDInstallation())).resolves.toBe('premier');
    });
    it('l’inscription publique n’attend que le premier dossier', async () => {
        await expect(dansLeDossier('second', () => service().premierDossierAttendu())).resolves.toBe(false);
        await expect(service([]).premierDossierAttendu()).resolves.toBe(true);
    });
});
describe('F44 · la garde des routes de l’installation', () => {
    const contexte = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const garde = () => new administrateur_installation_guard_1.AdministrateurInstallationGuard({ dossierDInstallation: async () => 'premier' });
    it('laisse passer l’administrateur du premier dossier', async () => {
        await expect(surSiteAsync(() => garde().canActivate(contexte({ role: 'ADMIN_CABINET', tenantId: 'premier' })))).resolves.toBe(true);
    });
    it('refuse l’administrateur d’un autre dossier · il obtiendrait la base de ses voisins', async () => {
        await expect(surSiteAsync(() => garde().canActivate(contexte({ role: 'ADMIN_CABINET', tenantId: 'second' })))).rejects.toThrow(/dossier d’installation/);
    });
    it('refuse un autre rôle du premier dossier, et hors installation sur site', async () => {
        await expect(surSiteAsync(() => garde().canActivate(contexte({ role: 'COMPTABLE', tenantId: 'premier' })))).rejects.toThrow(common_1.ForbiddenException);
        await expect(garde().canActivate(contexte({ role: 'ADMIN_CABINET', tenantId: 'premier' }))).rejects.toThrow(/pas une installation sur site/);
    });
    it('est posée sur les trois routes de sauvegarde et sur la création des dossiers suivants', () => {
        const p = sur_site_controller_1.SurSiteController.prototype;
        for (const route of ['lister', 'copieExterne', 'sauvegarder', 'creerDossier']) {
            const gardes = (Reflect.getMetadata(constants_1.GUARDS_METADATA, p[route]) ?? []);
            expect({ route, garde: gardes.includes(administrateur_installation_guard_1.AdministrateurInstallationGuard) }).toEqual({ route, garde: true });
        }
        for (const route of ['etat', 'deposer']) {
            expect(Reflect.getMetadata(constants_1.GUARDS_METADATA, p[route])).toBeUndefined();
        }
    });
});
describe('F44 · l’inscription publique sur site ne sert qu’au premier dossier', () => {
    const res = { cookie: () => undefined, clearCookie: () => undefined, req: { headers: {} } };
    const controleur = (premier) => {
        const register = jest.fn(async () => ({ accessToken: 'x', csrfToken: 'y' }));
        const c = new auth_controller_1.AuthController({ register, premierDossierAttendu: async () => premier }, { get: () => undefined });
        return { c, register };
    };
    it('un dossier existe · refusée, rien n’est créé', async () => {
        const { c, register } = controleur(false);
        await expect(surSiteAsync(() => c.register({}, res))).rejects.toThrow(/déjà son premier dossier/);
        expect(register).not.toHaveBeenCalled();
    });
    it('poste neuf · ouverte, sans lire INSCRIPTION_PUBLIQUE', async () => {
        const { c, register } = controleur(true);
        await surSiteAsync(() => c.register({}, res));
        expect(register).toHaveBeenCalledTimes(1);
    });
    it('en ligne, la règle d’INSCRIPTION_PUBLIQUE ne change pas', async () => {
        const { c, register } = controleur(true);
        await expect(c.register({}, res)).rejects.toThrow(/VMG Consulting/);
        expect(register).not.toHaveBeenCalled();
    });
});
describe('F44 · l’écran d’ouverture sait si le poste attend son premier dossier', () => {
    it('l’état public le dit, sur site seulement', async () => {
        const licence = { etat: () => ({ surSite: true, statut: 'VALIDE', motif: null, empreinte: 'e', dateVersion: null, contenu: null }) };
        const c = (premier) => new sur_site_controller_1.SurSiteController(licence, {}, { premierDossierAttendu: async () => premier });
        await expect(c(true).etat()).resolves.toMatchObject({ surSite: true, premierDossierAttendu: true });
        await expect(c(false).etat()).resolves.toMatchObject({ premierDossierAttendu: false });
        const enLigne = new sur_site_controller_1.SurSiteController({ etat: () => ({ surSite: false }) }, {}, {});
        await expect(enLigne.etat()).resolves.toEqual({ surSite: false });
    });
});
describe('F44 · un dossier suivant naît sans rendre la session de son administrateur', () => {
    it('la réponse ne porte que le nom et l’adresse, jamais un jeton', async () => {
        const c = new sur_site_controller_1.SurSiteController({}, {}, {
            register: async () => ({ tenant: { nom: 'Beta' }, accessToken: 'jeton-du-nouvel-admin', csrfToken: 'z' }),
        });
        const r = await surSiteAsync(() => c.creerDossier({ email: ' Admin@Beta.CD ' }));
        expect(r).toEqual({ dossier: 'Beta', email: 'admin@beta.cd' });
    });
});
describe('F44 · le paquet', () => {
    const lire = (f) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../..', f), 'utf8');
    it('l’installation n’ouvre plus l’inscription par la configuration, et la mise à jour la retire', () => {
        const init = lire('installation/windows/initialiser.ps1');
        expect(init).not.toMatch(/^\s*'INSCRIPTION_PUBLIQUE=true',?$/m);
        expect(init).toMatch(/-notmatch '\^\(DOSSIER_INTERFACE\|PG_BIN\|INSCRIPTION_PUBLIQUE\)='/);
    });
    it('l’outil de déchiffrement voyage avec le serveur et lit le module du serveur', () => {
        expect(lire('.github/workflows/paquet-sur-site.yml')).toContain('Copy-Item installation/dechiffrer-sauvegarde.cjs $S');
        expect(lire('installation/dechiffrer-sauvegarde.cjs')).toContain("require(path.join(__dirname, 'dist', 'modules', 'sur-site', 'chiffrement-sauvegarde.js'))");
    });
});
//# sourceMappingURL=installation-f44.spec.js.map