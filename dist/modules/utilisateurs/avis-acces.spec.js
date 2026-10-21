"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const courrier_service_1 = require("../courrier/courrier.service");
const avis_acces_service_1 = require("./avis-acces.service");
const utilisateur_controller_1 = require("./utilisateur.controller");
const DOSSIER = 'd-1';
const ADMIN = 'u-admin';
const PROVISOIRE = 'mot-de-passe-provisoire-tres-long';
function service(mettreEnFile = jest.fn(async () => ({
    id: 'm-1',
    statut: client_1.StatutMessage.SANS_TRANSPORT,
    erreur: null,
}))) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ nom: 'ONG Kin' }) },
    };
    const avis = new avis_acces_service_1.AvisAccesService(prisma, { mettreEnFile });
    return { avis, mettreEnFile };
}
describe('le mot de passe provisoire ne voyage pas dans la file', () => {
    const textes = [
        (0, avis_acces_service_1.avisCompteCree)({ entite: 'ONG Kin', email: 'comptable@ong-kin.cd', role: client_1.RoleUtilisateur.COMPTABLE }),
        (0, avis_acces_service_1.avisReinitialisation)({ entite: 'ONG Kin', email: 'comptable@ong-kin.cd' }),
    ];
    it('ne figure ni dans l’objet ni dans le corps d’aucun avis', () => {
        for (const texte of textes) {
            expect(texte.corps).not.toContain(PROVISOIRE);
            expect(texte.sujet).not.toContain(PROVISOIRE);
            expect(texte.corps).not.toMatch(/\{motDePasse|\{mot-de-passe/);
        }
    });
    it('dit d’où le mot de passe vient, puisqu’il n’est pas là', () => {
        for (const texte of textes) {
            expect(texte.corps).toContain('ne figure pas dans ce message');
            expect(texte.corps).toContain('provisoire');
        }
    });
    it('nomme le rôle comme la fenêtre le nomme', () => {
        const texte = (0, avis_acces_service_1.avisCompteCree)({ entite: 'ONG Kin', email: 'a@b.cd', role: client_1.RoleUtilisateur.ADMIN_CABINET });
        expect(texte.corps).toContain('« Administrateur »');
        expect(texte.corps).not.toContain('ADMIN_CABINET');
    });
    it('la réinitialisation explique la fermeture des sessions et ouvre un recours', () => {
        const texte = (0, avis_acces_service_1.avisReinitialisation)({ entite: 'ONG Kin', email: 'a@b.cd' });
        expect(texte.corps).toContain('sessions');
        expect(texte.corps).toContain("Si vous n'avez pas demandé cette réinitialisation");
    });
});
describe('l’avis entre dans la file, borné au dossier', () => {
    it('porte le dossier, l’adresse du compte, l’origine et la pièce', async () => {
        const { avis, mettreEnFile } = service();
        const remis = await avis.annoncerCompteCree(DOSSIER, {
            userId: 'u-9',
            email: 'comptable@ong-kin.cd',
            role: client_1.RoleUtilisateur.COMPTABLE,
            parQui: ADMIN,
        });
        const [dossier, message] = mettreEnFile.mock.calls[0];
        expect(dossier).toBe(DOSSIER);
        expect(message).toMatchObject({
            destinataire: 'comptable@ong-kin.cd',
            origine: courrier_service_1.ORIGINE_MOT_DE_PASSE_TEMPORAIRE,
            origineId: 'u-9',
            createdBy: ADMIN,
        });
        expect(remis).toMatchObject({ avise: true, statut: client_1.StatutMessage.SANS_TRANSPORT, motif: null });
    });
    it('nomme le dossier · un collaborateur peut en avoir plusieurs', async () => {
        const { avis, mettreEnFile } = service();
        await avis.annoncerReinitialisation(DOSSIER, { userId: 'u-9', email: 'a@b.cd', parQui: ADMIN });
        expect(mettreEnFile.mock.calls[0][1].sujet).toContain('ONG Kin');
    });
});
describe('l’avis n’est jamais une condition de l’accès', () => {
    const fileQuiRefuse = () => jest.fn(async () => {
        throw new common_1.BadRequestException('Adresse de destinataire inutilisable · « comptable@intranet ».');
    });
    it('le compte est créé, et la réponse dit que le titulaire n’a pas été averti', async () => {
        const { avis } = service(fileQuiRefuse());
        const utilisateurs = {
            creer: jest.fn(async () => ({
                id: 'u-9',
                email: 'comptable@intranet',
                role: client_1.RoleUtilisateur.COMPTABLE,
            })),
        };
        const controleur = new utilisateur_controller_1.UtilisateurController(utilisateurs, avis);
        const reponse = await controleur.creer({ userId: ADMIN, tenantId: DOSSIER }, { email: 'comptable@intranet', motDePasse: PROVISOIRE, role: client_1.RoleUtilisateur.COMPTABLE });
        expect(reponse).toMatchObject({ id: 'u-9', email: 'comptable@intranet' });
        expect(reponse.avis).toMatchObject({ avise: false, statut: null });
        expect(reponse.avis.motif).toContain("n'a pas pu être averti");
    });
    it('la réinitialisation aboutit même quand l’avis ne part pas', async () => {
        const { avis } = service(fileQuiRefuse());
        const utilisateurs = {
            reinitialiserMotDePasse: jest.fn(async () => ({ reinitialise: true, email: 'comptable@intranet' })),
        };
        const controleur = new utilisateur_controller_1.UtilisateurController(utilisateurs, avis);
        const reponse = await controleur.reinitialiserMotDePasse({ userId: ADMIN, tenantId: DOSSIER }, 'u-9', { motDePasseProvisoire: PROVISOIRE });
        expect(reponse).toMatchObject({ reinitialise: true, email: 'comptable@intranet' });
        expect(reponse.avis.avise).toBe(false);
    });
});
//# sourceMappingURL=avis-acces.spec.js.map