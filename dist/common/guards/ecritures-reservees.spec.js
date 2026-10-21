"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("./roles.guard");
const facturation_controller_1 = require("../../modules/facturation/facturation.controller");
const provisions_controller_1 = require("../../modules/provisions/provisions.controller");
const CONTROLEURS_EXEMPTES = {
    'auth/auth.controller.ts': {
        motif: "Authentification · connexion, déconnexion et changement de mot de passe concernent l'utilisateur " +
            'lui-même, quel que soit son rôle.',
    },
    'plateforme/plateforme.controller.ts': {
        motif: "Console de l'opérateur · protégée par un garde propre, qui ne dépend pas du rôle dans un dossier.",
        exige: 'OperateurPlateformeGuard',
    },
};
const ROUTES_DE_CALCUL = {
    "devises/devises.controller.ts @Post('reevaluation/calcul')": "Calcule la réévaluation sans l'enregistrer · l'enregistrement est `@Post('reevaluation')`, réservé.",
    "operations-specifiques/operation-specifique.controller.ts @Post('proposition')": "Propose les lignes d'une opération · l'application est `@Post('application')`, réservée.",
    "regularisation/regularisation.controller.ts @Post('simuler')": 'Simule une régularisation · sa création est `@Post()`, réservée.',
    "tiers/tiers.controller.ts @Post(':id/calculer')": "Calcule les échéances d'un modèle de règlement, sans rien enregistrer.",
};
const RACINE = (0, path_1.join)(__dirname, '..', '..', 'modules');
function controleurs(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
        const chemin = (0, path_1.join)(dossier, nom);
        if ((0, fs_1.statSync)(chemin).isDirectory())
            return controleurs(chemin);
        return nom.endsWith('.controller.ts') ? [chemin] : [];
    });
}
function routesOuvertes() {
    const ouvertes = [];
    for (const chemin of controleurs(RACINE)) {
        const fichier = (0, path_1.relative)(RACINE, chemin).split('\\').join('/');
        const lignes = (0, fs_1.readFileSync)(chemin, 'utf-8').split('\n');
        const debutClasse = lignes.findIndex((l) => /^\s*export class/.test(l));
        if (debutClasse < 0)
            continue;
        const rolesSurLaClasse = lignes.slice(0, debutClasse).some((l) => l.includes('@Roles('));
        lignes.forEach((ligne, i) => {
            const m = ligne.match(/^\s*(@(?:Post|Put|Patch|Delete)\(.*\))\s*$/);
            if (!m)
                return;
            let debut = i;
            while (debut > 0 && !/^\s*}\s*$/.test(lignes[debut - 1]) && !/^\s*export class/.test(lignes[debut - 1]))
                debut--;
            let fin = i;
            while (fin < lignes.length && !/^\s*(async\s+)?[a-zA-Z_]\w*\s*\(/.test(lignes[fin]))
                fin++;
            const bloc = lignes.slice(debut, fin + 1).join('\n');
            if (!rolesSurLaClasse && !bloc.includes('@Roles('))
                ouvertes.push({ fichier, route: m[1] });
        });
    }
    return ouvertes;
}
const ROUTES_PUBLIQUES = {
    "sur-site/sur-site.controller.ts @Post('licence')": "Dépôt du fichier de licence d'une installation sur site · à la première installation, aucun compte n'existe encore. " +
        'Le fichier ne vaut que signé par VMG et pour ce poste, et une licence plus ancienne ne remplace jamais une plus récente.',
};
describe('Routes d’écriture · réservées à un rôle', () => {
    const ouvertes = routesOuvertes();
    it('le balayage trouve bien des contrôleurs et des routes (un balayage vide ne prouverait rien)', () => {
        expect(controleurs(RACINE).length).toBeGreaterThan(40);
    });
    it('aucune route POST, PUT, PATCH ou DELETE n’est ouverte à la lecture seule sans motif écrit', () => {
        const sansMotif = ouvertes
            .filter((r) => !CONTROLEURS_EXEMPTES[r.fichier])
            .filter((r) => !ROUTES_DE_CALCUL[`${r.fichier} ${r.route}`])
            .filter((r) => !ROUTES_PUBLIQUES[`${r.fichier} ${r.route}`])
            .map((r) => `${r.fichier} ${r.route}`);
        expect(sansMotif).toEqual([]);
    });
    it('chaque exemption vise une route qui existe encore · une exemption orpheline masquerait la suivante', () => {
        for (const cle of [...Object.keys(ROUTES_DE_CALCUL), ...Object.keys(ROUTES_PUBLIQUES)]) {
            expect(ouvertes.map((r) => `${r.fichier} ${r.route}`)).toContain(cle);
        }
    });
    it('un contrôleur exempté porte bien le garde qui justifie son exemption', () => {
        for (const [fichier, { exige }] of Object.entries(CONTROLEURS_EXEMPTES)) {
            const source = (0, fs_1.readFileSync)((0, path_1.join)(RACINE, fichier), 'utf-8');
            if (exige)
                expect(source).toMatch(new RegExp(`@UseGuards\\([^)]*${exige}`));
        }
    });
});
describe('RolesGuard · une route d’écriture refuse la lecture seule', () => {
    const garde = new roles_guard_1.RolesGuard(new core_1.Reflector());
    const contexte = (classe, methode, role) => ({
        getHandler: () => methode,
        getClass: () => classe,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    });
    const cas = [
        ['facture · enregistrer', facturation_controller_1.FacturationController, facturation_controller_1.FacturationController.prototype.enregistrer],
        ['facture · note de crédit', facturation_controller_1.FacturationController, facturation_controller_1.FacturationController.prototype.emettreNoteDeCredit],
        ['facture · supprimer', facturation_controller_1.FacturationController, facturation_controller_1.FacturationController.prototype.supprimer],
        ['provision · supprimer', provisions_controller_1.ProvisionsController, provisions_controller_1.ProvisionsController.prototype.supprimer],
    ];
    it.each(cas)('%s · LECTURE_SEULE est refusée', (_nom, classe, methode) => {
        expect(() => garde.canActivate(contexte(classe, methode, client_1.RoleUtilisateur.LECTURE_SEULE))).toThrow(common_1.ForbiddenException);
    });
    it.each(cas)('%s · COMPTABLE passe', (_nom, classe, methode) => {
        expect(garde.canActivate(contexte(classe, methode, client_1.RoleUtilisateur.COMPTABLE))).toBe(true);
    });
    it('la consultation reste ouverte à la lecture seule · le correctif ne ferme pas la lecture', () => {
        expect(garde.canActivate(contexte(facturation_controller_1.FacturationController, facturation_controller_1.FacturationController.prototype.lister, client_1.RoleUtilisateur.LECTURE_SEULE))).toBe(true);
    });
});
//# sourceMappingURL=ecritures-reservees.spec.js.map