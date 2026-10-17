"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const licence_signee_1 = require("./licence-signee");
const paire = () => {
    const { privateKey, publicKey } = (0, crypto_1.generateKeyPairSync)('ed25519');
    return { prive: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), public: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
};
const VMG = paire();
const PIRATE = paire();
const POSTE = (0, licence_signee_1.empreinteDe)('3f1c2b7a-0000-4b5e-9a1d-poste-du-client');
const CONTENU = {
    format: licence_signee_1.FORMAT_LICENCE,
    numero: 'OMX-2026-0001',
    titulaire: 'ASBL Lumière du Kasaï',
    empreinteMachine: POSTE,
    emiseLe: '2026-09-26',
    finMaintenance: '2027-09-26',
    expiration: null,
    dossiersMax: 3,
};
const texte = (c = CONTENU, cle = VMG.prive) => JSON.stringify((0, licence_signee_1.signerLicence)(c, cle));
const ctx = (p = {}) => ({
    clePubliquePem: VMG.public,
    empreinte: POSTE,
    aujourdhui: '2026-10-01',
    horlogeMax: '2026-09-30',
    dateVersion: '2026-09-26',
    ...p,
});
describe('licence sur site · signée par VMG, vérifiée sans internet', () => {
    it('une licence authentique, pour ce poste, dans ses dates, vaut', () => {
        const v = (0, licence_signee_1.verifierLicence)(texte(), ctx());
        expect(v).toMatchObject({ statut: 'VALIDE', motif: null });
        expect(v.contenu).toEqual(CONTENU);
    });
    it('modifier une seule valeur du fichier casse la signature · le plafond de dossiers comme la date', () => {
        const f = JSON.parse(texte());
        f.contenu.dossiersMax = 50;
        expect((0, licence_signee_1.verifierLicence)(JSON.stringify(f), ctx()).statut).toBe('SIGNATURE_INVALIDE');
        const g = JSON.parse(texte());
        g.contenu.finMaintenance = '2099-12-31';
        expect((0, licence_signee_1.verifierLicence)(JSON.stringify(g), ctx()).statut).toBe('SIGNATURE_INVALIDE');
    });
    it('une licence signée par une AUTRE clé ne vaut pas · on ne se signe pas sa licence', () => {
        expect((0, licence_signee_1.verifierLicence)(texte(CONTENU, PIRATE.prive), ctx()).statut).toBe('SIGNATURE_INVALIDE');
    });
    it('l’ordre des clés du fichier ne compte pas · un fichier réécrit par un éditeur reste authentique', () => {
        const f = JSON.parse(texte());
        const inverse = Object.fromEntries(Object.entries(f.contenu).reverse());
        expect((0, licence_signee_1.verifierLicence)(JSON.stringify({ signature: f.signature, contenu: inverse }), ctx()).statut).toBe('VALIDE');
    });
    it('copiée sur un autre poste, elle ne vaut rien · mais dit à qui elle appartient', () => {
        const v = (0, licence_signee_1.verifierLicence)(texte(), ctx({ empreinte: (0, licence_signee_1.empreinteDe)('autre-poste') }));
        expect(v.statut).toBe('AUTRE_MACHINE');
        expect(v.contenu?.numero).toBe('OMX-2026-0001');
    });
    it('l’horloge remontée de plus d’un jour est dénoncée ; un jour de dérive est toléré', () => {
        expect((0, licence_signee_1.verifierLicence)(texte(), ctx({ aujourdhui: '2026-09-28', horlogeMax: '2026-09-30' })).statut).toBe('HORLOGE_RECULEE');
        expect((0, licence_signee_1.verifierLicence)(texte(), ctx({ aujourdhui: '2026-09-29', horlogeMax: '2026-09-30' })).statut).toBe('VALIDE');
    });
    it('une licence à expiration vaut jusqu’à son dernier jour inclus', () => {
        const c = { ...CONTENU, expiration: '2026-10-31' };
        expect((0, licence_signee_1.verifierLicence)(texte(c), ctx({ aujourdhui: '2026-10-31' })).statut).toBe('VALIDE');
        expect((0, licence_signee_1.verifierLicence)(texte(c), ctx({ aujourdhui: '2026-11-01', horlogeMax: '2026-10-31' })).statut).toBe('EXPIREE');
    });
    it('la maintenance borne les VERSIONS, pas l’usage · une version publiée après sa fin ne tourne pas', () => {
        expect((0, licence_signee_1.verifierLicence)(texte(), ctx({ dateVersion: '2027-09-26' })).statut).toBe('VALIDE');
        const v = (0, licence_signee_1.verifierLicence)(texte(), ctx({ dateVersion: '2027-09-27' }));
        expect(v.statut).toBe('VERSION_NON_COUVERTE');
        expect(v.motif).toContain('2027-09-26');
        expect((0, licence_signee_1.verifierLicence)(texte(), ctx({ aujourdhui: '2031-01-01', horlogeMax: '2031-01-01' })).statut).toBe('VALIDE');
    });
    it('sans date de version, la couverture ne se vérifie pas · refus plutôt que présomption', () => {
        expect((0, licence_signee_1.verifierLicence)(texte(), ctx({ dateVersion: null })).statut).toBe('VERSION_INCONNUE');
    });
    it('sans clé publique dans le code, rien ne vaut · et sans fichier, on le dit', () => {
        expect((0, licence_signee_1.verifierLicence)(texte(), ctx({ clePubliquePem: null })).statut).toBe('CLE_EDITEUR_ABSENTE');
        expect((0, licence_signee_1.verifierLicence)(null, ctx()).statut).toBe('ABSENTE');
        expect((0, licence_signee_1.verifierLicence)('pas du json', ctx()).statut).toBe('ILLISIBLE');
    });
    it('un contenu irrecevable ne se signe pas', () => {
        expect(() => (0, licence_signee_1.signerLicence)({ ...CONTENU, dossiersMax: 0 }, VMG.prive)).toThrow(/dossiers/);
        expect((0, licence_signee_1.motifRefusContenu)({ ...CONTENU, empreinteMachine: 'abc' })).toMatch(/empreinte/);
        expect((0, licence_signee_1.motifRefusContenu)({ ...CONTENU, finMaintenance: '2026-01-01' })).toMatch(/fin de maintenance antérieure/);
        expect((0, licence_signee_1.motifRefusContenu)({ ...CONTENU, expiration: '2026-01-01' })).toMatch(/expiration antérieure/);
        expect((0, licence_signee_1.motifRefusContenu)(CONTENU)).toBeNull();
    });
    it('l’empreinte est propre à OmegaX, stable, et insensible à la casse de l’identifiant', () => {
        expect((0, licence_signee_1.empreinteDe)('ABC-def')).toBe((0, licence_signee_1.empreinteDe)(' abc-DEF '));
        expect((0, licence_signee_1.empreinteDe)('abc')).toMatch(/^[0-9a-f]{64}$/);
        expect((0, licence_signee_1.serialiser)(CONTENU)).not.toContain('{');
    });
});
describe('audit final F193 · la licence devant les migrations d’une nouvelle version', () => {
    const refus = (p = {}, c = CONTENU, t = texte(c)) => {
        const x = ctx(p);
        return (0, licence_signee_1.motifRefusMigration)((0, licence_signee_1.verifierLicence)(t, x), x.dateVersion);
    };
    it('une version hors maintenance est refusée AVANT la migration, avec le motif du serveur', () => {
        const m = refus({ dateVersion: '2027-09-27' });
        expect(m).toBe((0, licence_signee_1.verifierLicence)(texte(), ctx({ dateVersion: '2027-09-27' })).motif);
        expect(m).toContain('2027-09-26');
    });
    it('le dernier jour de maintenance couvre encore la version · et une licence valide ne refuse rien', () => {
        expect(refus({ dateVersion: '2027-09-26' })).toBeNull();
        expect(refus()).toBeNull();
    });
    it('la fin de maintenance se lit même quand le verdict s’arrête plus haut (expirée, horloge reculée)', () => {
        const expiree = { ...CONTENU, expiration: '2026-10-31' };
        expect((0, licence_signee_1.verifierLicence)(texte(expiree), ctx({ aujourdhui: '2026-11-01', horlogeMax: '2026-10-31', dateVersion: '2027-09-27' })).statut).toBe('EXPIREE');
        expect(refus({ aujourdhui: '2026-11-01', horlogeMax: '2026-10-31', dateVersion: '2027-09-27' }, expiree)).toContain('2027-09-26');
        expect(refus({ aujourdhui: '2026-11-01', horlogeMax: '2026-10-31', dateVersion: '2026-10-15' }, expiree)).toBeNull();
        expect(refus({ aujourdhui: '2026-09-01', horlogeMax: '2026-09-30', dateVersion: '2027-09-27' })).toContain('2027-09-26');
    });
    it('une version dont la date est inconnue n’est pas couverte · la migration attend', () => {
        expect(refus({ dateVersion: null })).toMatch(/date de cette version est inconnue/);
    });
    it('un poste sans licence lisible, ou avec la licence d’un autre poste, migre · c’est le chemin vers une licence', () => {
        expect(refus({ dateVersion: '2027-09-27' }, CONTENU, null)).toBeNull();
        expect(refus({ dateVersion: '2027-09-27' }, CONTENU, 'pas du json')).toBeNull();
        expect(refus({ dateVersion: '2027-09-27' }, CONTENU, texte(CONTENU, PIRATE.prive))).toBeNull();
        expect(refus({ dateVersion: '2027-09-27', clePubliquePem: null })).toBeNull();
        expect(refus({ dateVersion: '2027-09-27', empreinte: (0, licence_signee_1.empreinteDe)('autre-poste') })).toBeNull();
    });
});
//# sourceMappingURL=licence-signee.spec.js.map