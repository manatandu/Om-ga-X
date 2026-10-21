"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const path_1 = require("path");
const licence_service_1 = require("../licence/licence.service");
const licence_signee_1 = require("./licence-signee");
const licence_sur_site_service_1 = require("./licence-sur-site.service");
const { privateKey, publicKey } = (0, crypto_1.generateKeyPairSync)('ed25519');
const PRIVE = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIQUE = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const ID = 'machine-guid-du-poste';
const DONNEES = '/dev/null/omegax-donnees-factices';
const VERSION = '/app';
function poste(jour = '2026-10-01') {
    const fichiers = new Map([[(0, path_1.join)(VERSION, 'version-sur-site.json'), JSON.stringify({ date: '2026-09-26', commit: 'abc' })]]);
    const p = { jour };
    const acces = {
        identifiantSysteme: () => ID,
        lire: (c) => fichiers.get(c) ?? null,
        ecrire: (c, v) => void fichiers.set(c, v),
        aujourdhui: () => p.jour,
    };
    return { acces, fichiers, p };
}
const contenu = (x = {}) => ({
    format: licence_signee_1.FORMAT_LICENCE,
    numero: 'OMX-2026-0001',
    titulaire: 'ASBL Test',
    empreinteMachine: (0, licence_signee_1.empreinteDe)(ID),
    emiseLe: '2026-09-26',
    finMaintenance: '2027-09-26',
    expiration: null,
    dossiersMax: 2,
    ...x,
});
const fichier = (x = {}) => JSON.stringify((0, licence_signee_1.signerLicence)(contenu(x), PRIVE));
const SUR_SITE = { MODE_INSTALLATION: 'SUR_SITE', DOSSIER_DONNEES: DONNEES };
const service = (pp = poste(), env = SUR_SITE) => new licence_sur_site_service_1.LicenceSurSiteService(pp.acces, env, PUBLIQUE, VERSION);
describe('LicenceSurSiteService', () => {
    it('en ligne, il ne fait rien · et ne refuse rien au nom d’un fichier', () => {
        const s = service(poste(), {});
        expect(s.etat().surSite).toBe(false);
        expect(() => s.verifierPlafondDossiers(500)).not.toThrow();
        expect(() => s.deposer(fichier())).toThrow(common_1.BadRequestException);
    });
    it('sans fichier, l’installation est fermée et montre son empreinte', () => {
        const s = service();
        expect(s.etat()).toMatchObject({ surSite: true, statut: 'ABSENTE', empreinte: (0, licence_signee_1.empreinteDe)(ID) });
        expect(s.autorisation().autorise).toBe(false);
    });
    it('le dépôt d’une licence valide l’écrit et ouvre l’installation', () => {
        const pp = poste();
        const s = service(pp);
        expect(s.deposer(fichier()).statut).toBe('VALIDE');
        expect(pp.fichiers.get((0, path_1.join)(DONNEES, 'licence.omegax'))).toBe(fichier());
        expect(s.autorisation()).toEqual({ autorise: true });
        expect(service(pp).etat().statut).toBe('VALIDE');
    });
    it('un fichier refusé n’est jamais écrit · la licence en place reste', () => {
        const pp = poste();
        const s = service(pp);
        s.deposer(fichier());
        expect(() => s.deposer(fichier({ empreinteMachine: (0, licence_signee_1.empreinteDe)('autre') }))).toThrow(/autre poste/);
        expect(pp.fichiers.get((0, path_1.join)(DONNEES, 'licence.omegax'))).toBe(fichier());
    });
    it('une licence plus ancienne ne remplace pas une plus récente', () => {
        const s = service();
        s.deposer(fichier({ numero: 'OMX-2026-0009', emiseLe: '2026-09-28' }));
        expect(() => s.deposer(fichier({ numero: 'OMX-2026-0001', emiseLe: '2026-09-26' }))).toThrow(/plus récente/);
        expect(s.deposer(fichier({ numero: 'OMX-2026-0010', emiseLe: '2026-09-29' })).contenu?.numero).toBe('OMX-2026-0010');
    });
    it('la borne d’horloge avance, et un recul du calendrier ferme l’installation', () => {
        const pp = poste('2026-10-05');
        const s = service(pp);
        s.deposer(fichier());
        expect(JSON.parse(pp.fichiers.get((0, path_1.join)(DONNEES, 'horloge.json')))).toEqual({ max: '2026-10-05' });
        pp.p.jour = '2026-10-01';
        expect(s.actualiser().statut).toBe('HORLOGE_RECULEE');
        expect(JSON.parse(pp.fichiers.get((0, path_1.join)(DONNEES, 'horloge.json')))).toEqual({ max: '2026-10-05' });
        pp.p.jour = '2026-10-06';
        expect(s.actualiser().statut).toBe('VALIDE');
    });
    it('le plafond de dossiers de la licence tient · et sans licence valide, aucun dossier ne naît', () => {
        const s = service();
        expect(() => s.verifierPlafondDossiers(0)).toThrow(/Aucune licence/);
        s.deposer(fichier({ dossiersMax: 2 }));
        expect(() => s.verifierPlafondDossiers(1)).not.toThrow();
        expect(() => s.verifierPlafondDossiers(2)).toThrow(/couvre 2 dossier/);
    });
    it('audit final F193 · le lanceur lit le refus sur le service, avec le chemin où déposer la licence', () => {
        const pp = poste();
        pp.fichiers.set((0, path_1.join)(VERSION, 'version-sur-site.json'), JSON.stringify({ date: '2027-10-01', commit: 'def' }));
        pp.fichiers.set((0, path_1.join)(DONNEES, 'licence.omegax'), fichier());
        const m = service(pp).motifRefusMigration();
        expect(m).toMatch(/^Cette version a été publiée le 2027-10-01/);
        expect(m).toContain('2027-09-26');
        expect(m).toContain((0, path_1.join)(DONNEES, 'licence.omegax'));
        pp.fichiers.set((0, path_1.join)(VERSION, 'version-sur-site.json'), JSON.stringify({ date: '2027-09-26', commit: 'def' }));
        expect(service(pp).motifRefusMigration()).toBeNull();
        expect(service(poste()).motifRefusMigration()).toBeNull();
        const enLigne = poste();
        enLigne.fichiers.set((0, path_1.join)(DONNEES, 'licence.omegax'), fichier({ finMaintenance: '2026-09-26' }));
        enLigne.fichiers.set((0, path_1.join)(VERSION, 'version-sur-site.json'), JSON.stringify({ date: '2027-10-01', commit: 'def' }));
        expect(service(enLigne, {}).motifRefusMigration()).toBeNull();
    });
    it('la date de version vient du fichier du paquet, jamais de l’horloge · absente, l’installation est fermée', () => {
        const pp = poste();
        pp.fichiers.delete((0, path_1.join)(VERSION, 'version-sur-site.json'));
        const s = service(pp);
        expect(() => s.deposer(fichier())).toThrow(/date de cette version est inconnue/);
    });
});
describe('LicenceService · sur site, le fichier décide pour tous les dossiers', () => {
    const ligne = (p) => ({ id: 'l', tenantId: 't', type: client_1.TypeLicence.ABONNEMENT, statut: client_1.StatutLicence.ACTIVE, dateDebut: new Date(), dateExpiration: null, dernierHeartbeatAt: null, joursGraceHorsLigne: 7, ...p });
    it('sans fichier valide, même une ligne PROPRIETAIRE ne passe pas', () => {
        const l = new licence_service_1.LicenceService({}, service());
        expect(l.evaluerLicence(ligne({ type: client_1.TypeLicence.PROPRIETAIRE })).autorise).toBe(false);
    });
    it('avec un fichier valide, la ligne du dossier ne compte plus · ni son échéance, ni son absence', () => {
        const s = service();
        s.deposer(fichier());
        const l = new licence_service_1.LicenceService({}, s);
        expect(l.evaluerLicence(ligne({ dateExpiration: new Date('2020-01-01') })).autorise).toBe(true);
        expect(l.evaluerLicence(null).autorise).toBe(true);
    });
    it('en ligne, les règles de toujours · le service sur site n’y change rien', () => {
        const l = new licence_service_1.LicenceService({}, service(poste(), {}));
        expect(l.evaluerLicence(ligne({ dateExpiration: new Date('2020-01-01') })).motif).toBe('Abonnement expiré');
        expect(l.evaluerLicence(ligne({ type: client_1.TypeLicence.PROPRIETAIRE, statut: client_1.StatutLicence.SUSPENDUE })).autorise).toBe(true);
    });
});
//# sourceMappingURL=licence-sur-site.service.spec.js.map