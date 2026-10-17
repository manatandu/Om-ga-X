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
exports.SauvegardeSurSiteService = void 0;
exports.parametresConnexion = parametresConnexion;
exports.nomSauvegarde = nomSauvegarde;
exports.copiesARetirer = copiesARetirer;
exports.copiesEnClairARetirer = copiesEnClairARetirer;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
const mode_installation_1 = require("../../common/mode-installation");
const chiffrement_sauvegarde_1 = require("./chiffrement-sauvegarde");
const copies_avant_mise_a_jour_1 = require("./copies-avant-mise-a-jour");
const executer = (0, util_1.promisify)(child_process_1.execFile);
function parametresConnexion(url) {
    if (!url)
        return null;
    try {
        const u = new URL(url);
        if (!/^postgres(ql)?:$/.test(u.protocol))
            return null;
        const base = decodeURIComponent(u.pathname.replace(/^\//, ''));
        if (!base)
            return null;
        return {
            PGHOST: u.hostname,
            PGPORT: u.port || '5432',
            PGUSER: decodeURIComponent(u.username),
            PGPASSWORD: decodeURIComponent(u.password),
            PGDATABASE: base,
        };
    }
    catch {
        return null;
    }
}
const MOTIF_NOM = /^omegax-(\d{8}-\d{6})\.dump$/;
const MOTIF_NOM_CHIFFRE = /^omegax-(\d{8}-\d{6})\.dump\.chiffre$/;
const MOTIF_NOM_PROVISOIRE = /^omegax-(\d{8}-\d{6})\.dump\.partiel$/;
function nomSauvegarde(d) {
    return `omegax-${(0, copies_avant_mise_a_jour_1.horodatageCopie)(d)}.dump`;
}
function copiesARetirer(noms, garder, motif = MOTIF_NOM) {
    const nos = noms.filter((n) => motif.test(n)).sort().reverse();
    return nos.slice(Math.max(1, garder));
}
function copiesEnClairARetirer(noms) {
    return noms.filter((n) => MOTIF_NOM.test(n));
}
let SauvegardeSurSiteService = class SauvegardeSurSiteService {
    constructor(env = process.env) {
        this.env = env;
        this.log = new common_1.Logger('SauvegardeSurSite');
        this.enCours = null;
        this.minuterie = null;
        this.surSite = (0, mode_installation_1.estSurSite)(env);
        const donnees = env.DOSSIER_DONNEES || (0, path_1.join)(process.cwd(), 'donnees');
        this.fichierCopieExterne = (0, path_1.join)(donnees, 'sauvegarde-externe.json');
        this.fichierRepere = (0, path_1.join)(donnees, 'derniere-version.json');
        this.dossier = env.DOSSIER_SAUVEGARDES || (0, path_1.join)(donnees, 'sauvegardes');
        const g = Number.parseInt(env.SAUVEGARDES_A_GARDER ?? '', 10);
        this.garder = Number.isInteger(g) && g > 0 ? g : 30;
        this.garderAvantMiseAJour = (0, copies_avant_mise_a_jour_1.avantMiseAJourAGarder)(env);
        const exe = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
        this.pgDump = env.PG_BIN ? (0, path_1.join)(env.PG_BIN, exe) : exe;
    }
    onModuleInit() {
        if (!this.surSite)
            return;
        const tenter = () => {
            this.recopierSiAbsente()
                .then(() => this.siNecessaire())
                .catch((e) => this.log.error(`Sauvegarde automatique échouée · ${e.message}`));
        };
        setTimeout(tenter, 2 * 60 * 1000).unref();
        this.minuterie = setInterval(tenter, 60 * 60 * 1000);
        this.minuterie.unref();
    }
    onModuleDestroy() {
        if (this.minuterie)
            clearInterval(this.minuterie);
    }
    lister() {
        return this.copies((n) => MOTIF_NOM.test(n) || copies_avant_mise_a_jour_1.MOTIF_AVANT_MISE_A_JOUR.test(n));
    }
    copies(retenir) {
        let noms = [];
        try {
            noms = (0, fs_1.readdirSync)(this.dossier);
        }
        catch {
            return [];
        }
        return noms
            .filter(retenir)
            .sort()
            .reverse()
            .map((nom) => {
            const s = (0, fs_1.statSync)((0, path_1.join)(this.dossier, nom));
            return { nom, taille: s.size, date: s.mtime.toISOString() };
        });
    }
    async siNecessaire(maintenant = new Date()) {
        const derniere = this.copies((n) => MOTIF_NOM.test(n))[0];
        if (derniere && maintenant.getTime() - new Date(derniere.date).getTime() < 24 * 60 * 60 * 1000)
            return null;
        return this.lancer();
    }
    lancer() {
        if (!this.surSite)
            return Promise.reject(new common_1.BadRequestException('Ce serveur n’est pas une installation sur site · ses sauvegardes sont celles de la plateforme.'));
        if (!this.enCours) {
            this.enCours = this.executer().finally(() => {
                this.enCours = null;
            });
        }
        return this.enCours;
    }
    async executer() {
        const pg = parametresConnexion(this.env.DATABASE_URL);
        if (!pg)
            throw new common_1.BadRequestException('La chaîne de connexion à la base est illisible · la sauvegarde ne peut pas partir.');
        (0, fs_1.mkdirSync)(this.dossier, { recursive: true });
        for (const n of (0, fs_1.readdirSync)(this.dossier).filter((x) => MOTIF_NOM_PROVISOIRE.test(x))) {
            try {
                (0, fs_1.unlinkSync)((0, path_1.join)(this.dossier, n));
            }
            catch {
            }
        }
        const nom = nomSauvegarde(new Date());
        const chemin = (0, path_1.join)(this.dossier, nom);
        const provisoire = `${chemin}${copies_avant_mise_a_jour_1.SUFFIXE_PROVISOIRE}`;
        try {
            await executer(this.pgDump, ['--format=custom', '--no-owner', '--file', provisoire], {
                env: { ...process.env, ...pg },
                timeout: 30 * 60 * 1000,
                windowsHide: true,
            });
        }
        catch (e) {
            try {
                (0, fs_1.unlinkSync)(provisoire);
            }
            catch {
            }
            throw new common_1.BadRequestException(`La sauvegarde a échoué · ${e.stderr?.trim() || e.message}`);
        }
        (0, fs_1.renameSync)(provisoire, chemin);
        for (const n of copiesARetirer((0, fs_1.readdirSync)(this.dossier), this.garder)) {
            try {
                (0, fs_1.unlinkSync)((0, path_1.join)(this.dossier, n));
            }
            catch (e) {
                this.log.warn(`Ancienne copie non retirée (${n}) · ${e.message}`);
            }
        }
        await this.recopier(nom);
        const s = (0, fs_1.statSync)(chemin);
        this.log.log(`Sauvegarde écrite · ${nom} (${s.size} octets)`);
        return { nom, taille: s.size, date: s.mtime.toISOString() };
    }
    copiesAvantMiseAJourProtegees() {
        try {
            const r = (0, copies_avant_mise_a_jour_1.lireRepere)((0, fs_1.existsSync)(this.fichierRepere) ? (0, fs_1.readFileSync)(this.fichierRepere, 'utf8') : null);
            return r ? (0, copies_avant_mise_a_jour_1.copiesProtegees)(r, r) : [];
        }
        catch {
            return [];
        }
    }
    copieExterne() {
        const { sel: _sel, cle, ...etat } = this.reglageExterne();
        return { ...etat, chiffree: !!cle };
    }
    reglageExterne() {
        const vide = { dossier: null, derniere: null, le: null, erreur: null };
        try {
            return (0, fs_1.existsSync)(this.fichierCopieExterne) ? { ...vide, ...JSON.parse((0, fs_1.readFileSync)(this.fichierCopieExterne, 'utf8')) } : vide;
        }
        catch {
            return { ...vide, erreur: 'Réglage de la copie externe illisible · désignez à nouveau le dossier.' };
        }
    }
    noterCopieExterne(e) {
        (0, fs_1.mkdirSync)((0, path_1.join)(this.fichierCopieExterne, '..'), { recursive: true });
        (0, fs_1.writeFileSync)(this.fichierCopieExterne, JSON.stringify(e));
    }
    async definirCopieExterne(dossier, phrase) {
        if (!this.surSite)
            throw new common_1.BadRequestException('Ce serveur n’est pas une installation sur site.');
        if (dossier === null || !dossier.trim()) {
            if ((0, fs_1.existsSync)(this.fichierCopieExterne))
                (0, fs_1.unlinkSync)(this.fichierCopieExterne);
            return this.copieExterne();
        }
        const refusPhrase = (0, chiffrement_sauvegarde_1.motifRefusPhrase)(phrase);
        if (refusPhrase)
            throw new common_1.BadRequestException(refusPhrase);
        const d = dossier.trim();
        if (!(0, path_1.isAbsolute)(d))
            throw new common_1.BadRequestException('Indiquez un chemin complet (par exemple E:\\SauvegardesOmegaX ou \\\\SERVEUR\\partage).');
        if (!(0, fs_1.existsSync)(d) || !(0, fs_1.statSync)(d).isDirectory())
            throw new common_1.BadRequestException(`Le dossier ${d} est introuvable · branchez le disque ou vérifiez le partage.`);
        if (d.replace(/[\\/]+$/, '').toLowerCase() === this.dossier.replace(/[\\/]+$/, '').toLowerCase()) {
            throw new common_1.BadRequestException('C’est le dossier des sauvegardes locales · la copie externe doit être ailleurs.');
        }
        const essai = (0, path_1.join)(d, `.omegax-essai-${process.pid}`);
        try {
            (0, fs_1.writeFileSync)(essai, 'essai');
            (0, fs_1.unlinkSync)(essai);
        }
        catch (e) {
            throw new common_1.BadRequestException(`Écriture impossible dans ${d} · ${e.message}`);
        }
        const sel = (0, chiffrement_sauvegarde_1.nouveauSel)();
        const cle = (0, chiffrement_sauvegarde_1.deriverCle)(phrase, sel);
        this.noterCopieExterne({ dossier: d, derniere: null, le: null, erreur: null, sel: sel.toString('base64'), cle: cle.toString('base64') });
        const derniere = this.lister()[0];
        if (derniere)
            await this.recopier(derniere.nom);
        return this.copieExterne();
    }
    async recopierSiAbsente() {
        const etat = this.reglageExterne();
        if (!etat.dossier)
            return;
        const derniere = this.lister()[0];
        if (!derniere || (0, fs_1.existsSync)((0, path_1.join)(etat.dossier, `${derniere.nom}.chiffre`)))
            return;
        await this.recopier(derniere.nom);
    }
    async recopier(nom) {
        const etat = this.reglageExterne();
        if (!etat.dossier)
            return;
        const horodatage = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
        if (!etat.cle || !etat.sel) {
            this.noterCopieExterne({
                ...etat,
                erreur: `${horodatage()} · copie externe non chiffrée refusée · désignez à nouveau le dossier avec une phrase de chiffrement.`,
            });
            return;
        }
        try {
            await (0, chiffrement_sauvegarde_1.chiffrerFichier)((0, path_1.join)(this.dossier, nom), (0, path_1.join)(etat.dossier, `${nom}.chiffre`), Buffer.from(etat.cle, 'base64'), Buffer.from(etat.sel, 'base64'));
            const presents = (0, fs_1.readdirSync)(etat.dossier);
            for (const n of [
                ...copiesARetirer(presents, this.garder, MOTIF_NOM_CHIFFRE),
                ...(0, copies_avant_mise_a_jour_1.copiesAvantMiseAJourARetirer)(presents, this.garderAvantMiseAJour, this.copiesAvantMiseAJourProtegees().map((n) => `${n}.chiffre`), copies_avant_mise_a_jour_1.MOTIF_AVANT_MISE_A_JOUR_CHIFFRE),
                ...copiesEnClairARetirer(presents),
            ]) {
                try {
                    (0, fs_1.unlinkSync)((0, path_1.join)(etat.dossier, n));
                }
                catch {
                }
            }
            this.noterCopieExterne({ ...etat, derniere: nom, le: new Date().toISOString(), erreur: null });
        }
        catch (e) {
            this.log.error(`Copie externe échouée (${etat.dossier}) · ${e.message}`);
            this.noterCopieExterne({ ...etat, erreur: `${horodatage()} · ${e.message}` });
        }
    }
};
exports.SauvegardeSurSiteService = SauvegardeSurSiteService;
exports.SauvegardeSurSiteService = SauvegardeSurSiteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], SauvegardeSurSiteService);
//# sourceMappingURL=sauvegarde-sur-site.service.js.map