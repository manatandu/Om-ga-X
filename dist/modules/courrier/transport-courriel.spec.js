"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transport_courriel_1 = require("./transport-courriel");
const COMPLET = {
    SMTP_HOST: 'smtp.vmg-consulting.cd',
    SMTP_PORT: '587',
    SMTP_USER: 'omegax@vmg-consulting.cd',
    SMTP_PASS: 'secret-de-boite-aux-lettres',
    COURRIER_EXPEDITEUR: 'omegax@vmg-consulting.cd',
};
class TransportEprouve extends transport_courriel_1.TransportCourriel {
    constructor(env) {
        super();
        this.env = env;
    }
    environnement() {
        return this.env;
    }
}
describe('transport SMTP · tout ou rien', () => {
    it('une configuration complète se lit, et le port 587 reste en STARTTLS', () => {
        expect((0, transport_courriel_1.manquesDuTransport)(COMPLET)).toEqual([]);
        expect((0, transport_courriel_1.lireConfigurationSmtp)(COMPLET)).toEqual({
            hote: 'smtp.vmg-consulting.cd',
            port: 587,
            securise: false,
            identifiant: 'omegax@vmg-consulting.cd',
            motDePasse: 'secret-de-boite-aux-lettres',
            expediteur: 'omegax@vmg-consulting.cd',
        });
    });
    it.each(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'COURRIER_EXPEDITEUR'])('sans %s, il n’y a PAS de transport à moitié posé', (variable) => {
        const env = { ...COMPLET };
        delete env[variable];
        expect((0, transport_courriel_1.lireConfigurationSmtp)(env)).toBeNull();
        expect((0, transport_courriel_1.manquesDuTransport)(env).map((m) => m.variable)).toEqual([variable]);
    });
    it('une variable présente mais VIDE vaut absente', () => {
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_PASS: '   ' })).toBeNull();
    });
    it('le port n’est jamais DEVINÉ', () => {
        const env = { ...COMPLET };
        delete env.SMTP_PORT;
        expect((0, transport_courriel_1.lireConfigurationSmtp)(env)).toBeNull();
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_PORT: 'quatre-cent-soixante-cinq' })).toBeNull();
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_PORT: '0' })).toBeNull();
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_PORT: '70000' })).toBeNull();
    });
    it('SMTP_SECURE absent se DÉDUIT du port, illisible se REFUSE', () => {
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_PORT: '465' })?.securise).toBe(true);
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_PORT: '587' })?.securise).toBe(false);
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_SECURE: 'true' })?.securise).toBe(true);
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_SECURE: 'FALSE' })?.securise).toBe(false);
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, SMTP_SECURE: 'oui' })).toBeNull();
        expect((0, transport_courriel_1.manquesDuTransport)({ ...COMPLET, SMTP_SECURE: 'oui' })[0].variable).toBe('SMTP_SECURE');
    });
    it('un expéditeur inutilisable est refusé une fois, pas à chaque message', () => {
        expect((0, transport_courriel_1.lireConfigurationSmtp)({ ...COMPLET, COURRIER_EXPEDITEUR: 'omegax-chez-vmg' })).toBeNull();
        expect((0, transport_courriel_1.manquesDuTransport)({ ...COMPLET, COURRIER_EXPEDITEUR: 'omegax-chez-vmg' })[0].raison).toContain('expéditeur');
    });
    it('l’état rendu à l’écran ne porte AUCUNE valeur de variable', () => {
        const etat = new TransportEprouve(COMPLET).etat();
        expect(etat.configure).toBe(true);
        expect(JSON.stringify(etat)).not.toContain('secret-de-boite-aux-lettres');
        expect(JSON.stringify(etat)).not.toContain('smtp.vmg-consulting.cd');
        expect(etat.expediteur).toBe('omegax@vmg-consulting.cd');
    });
    it('sans rien dans l’environnement, l’état DIT ce qui manque', () => {
        const etat = new TransportEprouve({}).etat();
        expect(etat.configure).toBe(false);
        expect(etat.expediteur).toBeNull();
        expect(etat.manques.map((m) => m.variable)).toEqual([
            'SMTP_HOST',
            'SMTP_PORT',
            'SMTP_USER',
            'SMTP_PASS',
            'COURRIER_EXPEDITEUR',
        ]);
    });
    it('l’environnement est relu à CHAQUE appel, jamais capté au démarrage', () => {
        const env = {};
        const transport = new TransportEprouve(env);
        expect(transport.etat().configure).toBe(false);
        Object.assign(env, COMPLET);
        expect(transport.etat().configure).toBe(true);
    });
    it('une erreur trop longue est coupée EN LE DISANT', () => {
        expect((0, transport_courriel_1.texteDErreur)(new Error('550 boîte inconnue'))).toBe('Error · 550 boîte inconnue');
        const coupee = (0, transport_courriel_1.texteDErreur)(new Error('x'.repeat(5_000)));
        expect(coupee).toContain('(erreur tronquée à 1000 caractères)');
        expect((0, transport_courriel_1.texteDErreur)({ code: 'ECONNRESET' })).toBe('Erreur sans message rendue par le transport');
    });
});
describe('la pièce jointe part avec le message', () => {
    const monte = () => {
        const sendMail = jest.fn(async () => ({}));
        const t = new TransportEprouve(COMPLET);
        t.transporteurPour = () => ({ sendMail });
        return { t, sendMail };
    };
    it('un fichier de licence est joint en texte, sous son nom', async () => {
        const { t, sendMail } = monte();
        await t.envoyer({ destinataire: 'a@b.cd', sujet: 's', corps: 'c', pieceJointe: { nom: 'licence-OMX-2026-0001.omegax', texte: '{"x":1}' } });
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ attachments: [{ filename: 'licence-OMX-2026-0001.omegax', content: '{"x":1}', contentType: 'text/plain; charset=utf-8' }] }));
    });
    it('sans pièce, aucune pièce jointe annoncée', async () => {
        const { t, sendMail } = monte();
        await t.envoyer({ destinataire: 'a@b.cd', sujet: 's', corps: 'c', pieceJointe: null });
        expect(sendMail.mock.calls[0]).toEqual([expect.not.objectContaining({ attachments: expect.anything() })]);
    });
});
//# sourceMappingURL=transport-courriel.spec.js.map