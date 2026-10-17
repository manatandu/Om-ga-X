"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenceSurSiteService = exports.ACCES_POSTE_PAR_DEFAUT = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const mode_installation_1 = require("../../common/mode-installation");
const cle_publique_editeur_1 = require("./cle-publique-editeur");
const licence_signee_1 = require("./licence-signee");
function identifiantSystemeParDefaut() {
    try {
        if (process.platform === 'win32') {
            const sortie = (0, child_process_1.execFileSync)('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true });
            const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(sortie);
            return m ? m[1] : null;
        }
        for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
            if ((0, fs_1.existsSync)(f)) {
                const v = (0, fs_1.readFileSync)(f, 'utf8').trim();
                if (v)
                    return v;
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
function jourLocal(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
exports.ACCES_POSTE_PAR_DEFAUT = {
    identifiantSysteme: identifiantSystemeParDefaut,
    lire: (chemin) => ((0, fs_1.existsSync)(chemin) ? (0, fs_1.readFileSync)(chemin, 'utf8') : null),
    ecrire: (chemin, contenu) => {
        (0, fs_1.mkdirSync)((0, path_1.dirname)(chemin), { recursive: true });
        const provisoire = `${chemin}.tmp`;
        (0, fs_1.writeFileSync)(provisoire, contenu, 'utf8');
        (0, fs_1.renameSync)(provisoire, chemin);
    },
    aujourdhui: () => jourLocal(),
};
let LicenceSurSiteService = class LicenceSurSiteService {
    constructor(acces = exports.ACCES_POSTE_PAR_DEFAUT, env = process.env, clePublique = cle_publique_editeur_1.CLE_PUBLIQUE_EDITEUR, dossierVersion = process.cwd()) {
        this.acces = acces;
        this.clePublique = clePublique;
        this.dossierVersion = dossierVersion;
        this.log = new common_1.Logger('LicenceSurSite');
        this.minuterie = null;
        this.surSite = (0, mode_installation_1.estSurSite)(env);
        this.dossierDonnees = env.DOSSIER_DONNEES || (0, path_1.join)(process.cwd(), 'donnees');
        this.etatCourant = { surSite: this.surSite, empreinte: null, dateVersion: null, statut: 'ABSENTE', motif: null, contenu: null };
        if (this.surSite)
            this.actualiser();
    }
    onModuleInit() {
        if (!this.surSite)
            return;
        this.minuterie = setInterval(() => this.actualiser(), 60 * 60 * 1000);
        this.minuterie.unref();
    }
    onModuleDestroy() {
        if (this.minuterie)
            clearInterval(this.minuterie);
    }
    get cheminLicence() {
        return (0, path_1.join)(this.dossierDonnees, 'licence.omegax');
    }
    get cheminHorloge() {
        return (0, path_1.join)(this.dossierDonnees, 'horloge.json');
    }
    dateVersion() {
        const brut = this.acces.lire((0, path_1.join)(this.dossierVersion, 'version-sur-site.json'));
        if (!brut)
            return null;
        try {
            const d = JSON.parse(brut).date;
            return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
        }
        catch {
            return null;
        }
    }
    horlogeMax() {
        const brut = this.acces.lire(this.cheminHorloge);
        if (!brut)
            return null;
        try {
            const d = JSON.parse(brut).max;
            return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
        }
        catch {
            return null;
        }
    }
    verifier(texte) {
        const id = this.acces.identifiantSysteme();
        const empreinte = id ? (0, licence_signee_1.empreinteDe)(id) : null;
        const dateVersion = this.dateVersion();
        if (!empreinte) {
            return {
                surSite: true,
                empreinte: null,
                dateVersion,
                statut: 'AUTRE_MACHINE',
                motif: 'L’identifiant de ce poste est illisible · la licence ne peut pas y être rattachée. Contactez VMG Consulting.',
                contenu: null,
            };
        }
        const v = (0, licence_signee_1.verifierLicence)(texte, {
            clePubliquePem: this.clePublique,
            empreinte,
            aujourdhui: this.acces.aujourdhui(),
            horlogeMax: this.horlogeMax(),
            dateVersion,
        });
        return { ...v, surSite: true, empreinte, dateVersion };
    }
    actualiser() {
        if (!this.surSite)
            return this.etatCourant;
        this.etatCourant = this.verifier(this.acces.lire(this.cheminLicence));
        const aujourdhui = this.acces.aujourdhui();
        const max = this.horlogeMax();
        if (this.etatCourant.statut !== 'HORLOGE_RECULEE' && (!max || aujourdhui > max)) {
            try {
                this.acces.ecrire(this.cheminHorloge, JSON.stringify({ max: aujourdhui }));
            }
            catch (e) {
                this.log.warn(`Borne d’horloge non écrite · ${e.message}`);
            }
        }
        if (this.etatCourant.statut !== 'VALIDE')
            this.log.warn(`Licence sur site · ${this.etatCourant.statut}`);
        return this.etatCourant;
    }
    etat() {
        return this.etatCourant;
    }
    motifRefusMigration() {
        if (!this.surSite)
            return null;
        const m = (0, licence_signee_1.motifRefusMigration)(this.etatCourant, this.etatCourant.dateVersion);
        if (!m)
            return null;
        return `${m} Une licence renouvelée se dépose dans ${this.cheminLicence}, puis le service OmegaX se redémarre.`;
    }
    autorisation() {
        const e = this.etatCourant;
        return e.statut === 'VALIDE' ? { autorise: true } : { autorise: false, motif: e.motif ?? `Licence sur site · ${e.statut}` };
    }
    deposer(texte) {
        if (!this.surSite)
            throw new common_1.BadRequestException('Ce serveur n’est pas une installation sur site.');
        const candidat = this.verifier(texte);
        if (candidat.statut !== 'VALIDE') {
            throw new common_1.BadRequestException(candidat.motif ?? `Licence refusée · ${candidat.statut}`);
        }
        const actuel = this.etatCourant;
        if (actuel.statut === 'VALIDE' && actuel.contenu && candidat.contenu.emiseLe < actuel.contenu.emiseLe) {
            throw new common_1.BadRequestException(`La licence n° ${actuel.contenu.numero}, émise le ${actuel.contenu.emiseLe}, est plus récente que celle déposée (n° ${candidat.contenu.numero}, émise le ${candidat.contenu.emiseLe}).`);
        }
        this.acces.ecrire(this.cheminLicence, texte);
        return this.actualiser();
    }
    verifierPlafondDossiers(nombreActuel) {
        if (!this.surSite)
            return;
        const e = this.etatCourant;
        if (e.statut !== 'VALIDE')
            throw new common_1.BadRequestException(e.motif ?? `Licence sur site · ${e.statut}`);
        const max = e.contenu.dossiersMax;
        if (nombreActuel >= max) {
            throw new common_1.BadRequestException(`La licence n° ${e.contenu.numero} couvre ${max} dossier(s), et ${nombreActuel} sont déjà ouverts sur cette installation.`);
        }
    }
};
exports.LicenceSurSiteService = LicenceSurSiteService;
exports.LicenceSurSiteService = LicenceSurSiteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object, Object, Object, String])
], LicenceSurSiteService);
//# sourceMappingURL=licence-sur-site.service.js.map