"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const regles = require("./copies-avant-mise-a-jour");
const sauvegarde_sur_site_service_1 = require("./sauvegarde-sur-site.service");
const { analyserEnv, identiteVersion, moduleCompile, preparerMiseAJour, refusDeLaLicence } = require('../../../installation/demarrer.cjs');
describe('lanceur sur site', () => {
    it('lit la configuration écrite par PowerShell 5, marque d’ordre des octets comprise', () => {
        const v = analyserEnv('﻿DATABASE_URL=postgresql://a:b@127.0.0.1:5433/omegax\r\n# PORT=1\r\nPORT = 8080 \r\nX="entre guillemets"\n');
        expect(v.DATABASE_URL).toBe('postgresql://a:b@127.0.0.1:5433/omegax');
        expect(v.PORT).toBe('8080');
        expect(v.X).toBe('entre guillemets');
        expect(Object.keys(v)).toHaveLength(3);
    });
    it('identifie une version par son commit · deux paquets du même jour ne se confondent pas', () => {
        expect(identiteVersion({ date: '2026-09-26', commit: 'aaa' })).not.toBe(identiteVersion({ date: '2026-09-26', commit: 'bbb' }));
        expect(identiteVersion({ date: '2026-09-26' })).toBe('2026-09-26');
        expect(identiteVersion({})).toBeNull();
    });
});
describe('lanceur sur site · avant les migrations', () => {
    const racines = [];
    afterAll(() => racines.forEach((r) => (0, fs_1.rmSync)(r, { recursive: true, force: true })));
    function poste(repere = JSON.stringify({ commit: 'aaa111bbb222' })) {
        const racine = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), 'omegax-lanceur-'));
        racines.push(racine);
        const donnees = (0, path_1.join)(racine, 'donnees');
        const dossier = (0, path_1.join)(donnees, 'sauvegardes');
        (0, fs_1.mkdirSync)(donnees, { recursive: true });
        if (repere !== null)
            (0, fs_1.writeFileSync)((0, path_1.join)(donnees, 'derniere-version.json'), repere);
        const etat = { base: 'base saine en P', refus: null, gestes: [], date: new Date(2026, 8, 28, 10, 0, 0) };
        const preparer = (version, x = {}) => preparerMiseAJour({
            donnees,
            dossier,
            version,
            maintenant: etat.date,
            regles,
            garder: 2,
            journal: () => undefined,
            refusLicence: () => {
                etat.gestes.push('licence');
                return etat.refus;
            },
            copier: x.copier ??
                ((f) => {
                    etat.gestes.push('copie');
                    (0, fs_1.writeFileSync)(f, etat.base);
                }),
        });
        const copies = () => ((0, fs_1.existsSync)(dossier) ? (0, fs_1.readdirSync)(dossier).filter((n) => n.endsWith('.dump')) : []);
        const repere$ = () => JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(donnees, 'derniere-version.json'), 'utf8'));
        return { racine, donnees, dossier, etat, preparer, copies, repere$ };
    }
    it('F191 · après une migration échouée, le redémarrage de WinSW ne réécrit pas la copie saine', () => {
        const p = poste();
        const m = p.preparer('ccc333ddd444');
        expect(m.plan.action).toBe('COPIER');
        const [copie] = p.copies();
        expect((0, fs_1.readFileSync)((0, path_1.join)(p.dossier, copie), 'utf8')).toBe('base saine en P');
        p.etat.base = 'base à moitié migrée';
        p.etat.date = new Date(2026, 8, 28, 10, 0, 30);
        p.etat.gestes = [];
        expect(p.preparer('ccc333ddd444').plan.action).toBe('REPRENDRE');
        expect(p.etat.gestes).toEqual(['licence']);
        expect(p.copies()).toEqual([copie]);
        expect((0, fs_1.readFileSync)((0, path_1.join)(p.dossier, copie), 'utf8')).toBe('base saine en P');
    });
    it('F191 · un correctif livré après l’échec reprend la même copie, et la migration aboutie la clôt', () => {
        const p = poste();
        p.preparer('ccc333ddd444');
        const [copie] = p.copies();
        p.etat.base = 'base à moitié migrée';
        const m = p.preparer('eee555fff666');
        expect(m.plan).toEqual({ action: 'REPRENDRE', copie });
        m.apresMigration();
        expect(p.repere$()).toEqual({ commit: 'eee555fff666' });
        expect(p.copies()).toEqual([copie]);
    });
    it('F191 · la copie s’écrit sous un nom provisoire · interrompue, elle ne passe pas pour faite', () => {
        const p = poste();
        let vu = '';
        expect(() => p.preparer('ccc333ddd444', {
            copier: (f) => {
                vu = f;
                expect(f.endsWith('.partiel')).toBe(true);
                expect((0, fs_1.existsSync)(f.replace(/\.partiel$/, ''))).toBe(false);
                (0, fs_1.writeFileSync)(f, 'à moitié');
                throw new Error('pg_dump interrompu');
            },
        })).toThrow('pg_dump interrompu');
        expect((0, fs_1.existsSync)(vu)).toBe(false);
        expect(p.copies()).toEqual([]);
        expect(p.repere$()).toEqual({ commit: 'aaa111bbb222' });
        const reste = (0, path_1.join)(p.dossier, `${regles.nomCopieAvantMiseAJour(new Date(2026, 8, 27, 23, 0, 0), 'aaa111bbb222')}.partiel`);
        (0, fs_1.writeFileSync)(reste, 'reste d’une coupure');
        expect(p.preparer('ccc333ddd444').plan.action).toBe('COPIER');
        expect((0, fs_1.existsSync)(reste)).toBe(false);
        expect((0, fs_1.readdirSync)(p.dossier).filter((n) => n.endsWith('.partiel'))).toEqual([]);
        expect(p.copies()).toHaveLength(1);
    });
    it('F265 · le reste d’une copie interrompue part après une migration aboutie, même sans nouvelle copie', () => {
        const p = poste();
        (0, fs_1.mkdirSync)(p.dossier, { recursive: true });
        const reste = (0, path_1.join)(p.dossier, `${regles.nomCopieAvantMiseAJour(new Date(2026, 8, 27, 23, 0, 0), 'aaa111bbb222')}.partiel`);
        (0, fs_1.writeFileSync)(reste, 'reste d’une coupure');
        const m = p.preparer('aaa111bbb222');
        expect(m.plan.action).toBe('AUCUNE');
        m.apresMigration();
        expect((0, fs_1.existsSync)(reste)).toBe(false);
    });
    it('F191 · une copie déjà là n’est jamais écrasée, même sous le même nom', () => {
        const p = poste();
        (0, fs_1.mkdirSync)(p.dossier, { recursive: true });
        const nom = regles.nomCopieAvantMiseAJour(p.etat.date, 'aaa111bbb222');
        (0, fs_1.writeFileSync)((0, path_1.join)(p.dossier, nom), 'copie précédente');
        expect(() => p.preparer('ccc333ddd444')).toThrow(/jamais écrasée/);
        expect((0, fs_1.readFileSync)((0, path_1.join)(p.dossier, nom), 'utf8')).toBe('copie précédente');
    });
    it('F193 · une licence qui ne couvre pas la version arrête tout AVANT la copie et les migrations', () => {
        const p = poste();
        p.etat.refus = 'Version non couverte par la maintenance.';
        expect(() => p.preparer('ccc333ddd444')).toThrow('Mise à jour arrêtée avant la copie et les migrations · la base n’a pas été modifiée. Version non couverte par la maintenance.');
        expect(p.etat.gestes).toEqual(['licence']);
        expect(p.copies()).toEqual([]);
        expect(p.repere$()).toEqual({ commit: 'aaa111bbb222' });
    });
    it('F193 · arrêtée sur la reprise d’une migration échouée, la mise à jour ne dit pas la base intacte', () => {
        const p = poste();
        p.preparer('ccc333ddd444');
        const [copie] = p.copies();
        p.etat.base = 'base à moitié migrée';
        p.etat.refus = 'Version non couverte par la maintenance.';
        p.etat.gestes = [];
        let message = '';
        try {
            p.preparer('eee555fff666');
        }
        catch (e) {
            message = e.message;
        }
        expect(message).toBe(`${regles.etatDeLaBaseAuRefus({ action: 'REPRENDRE', copie })} Version non couverte par la maintenance.`);
        expect(message).toContain(copie);
        expect(message).toContain('à moitié migrée');
        expect(p.etat.gestes).toEqual(['licence']);
        expect(p.copies()).toEqual([copie]);
        expect((0, fs_1.readFileSync)((0, path_1.join)(p.dossier, copie), 'utf8')).toBe('base saine en P');
        expect(p.repere$()).toEqual({ commit: 'aaa111bbb222', enCours: { vers: 'ccc333ddd444', copie } });
    });
    it('F193 · la licence passe avant la copie, jamais sur un redémarrage de la version en place', () => {
        const p = poste();
        p.preparer('ccc333ddd444').apresMigration();
        expect(p.etat.gestes).toEqual(['licence', 'copie']);
        p.etat.gestes = [];
        p.etat.refus = 'refus';
        expect(p.preparer('ccc333ddd444').plan.action).toBe('AUCUNE');
        expect(p.etat.gestes).toEqual([]);
    });
    it('F193 · un poste neuf migre sans copie, après avoir demandé la licence', () => {
        const p = poste(null);
        const m = p.preparer('ccc333ddd444');
        expect(m.plan.action).toBe('PREMIER_DEMARRAGE');
        expect(p.etat.gestes).toEqual(['licence']);
        m.apresMigration();
        expect(p.repere$()).toEqual({ commit: 'ccc333ddd444' });
        expect(p.copies()).toEqual([]);
    });
    it('F265 · les copies sont listées par le service, tournées, et une copie non aboutie reste', () => {
        const p = poste();
        const versions = ['v1', 'v2', 'v3', 'v4'];
        const copiesFaites = [];
        versions.forEach((v, i) => {
            p.etat.date = new Date(2026, 8, 28, 10, i, 0);
            const avant = new Set(p.copies());
            const m = p.preparer(v);
            copiesFaites.push(p.copies().find((n) => !avant.has(n)));
            if (i === 1) {
                const retour = p.preparer('v1');
                expect(retour.plan.action).toBe('AUCUNE');
                retour.apresMigration();
            }
            else
                m.apresMigration();
        });
        expect(copiesFaites).toEqual(['aaa111bbb222', 'v1', 'v1', 'v3'].map((v, i) => regles.nomCopieAvantMiseAJour(new Date(2026, 8, 28, 10, i, 0), v)));
        expect(p.copies().sort()).toEqual([copiesFaites[1], copiesFaites[2], copiesFaites[3]].sort());
        const s = new sauvegarde_sur_site_service_1.SauvegardeSurSiteService({ MODE_INSTALLATION: 'SUR_SITE', DOSSIER_DONNEES: p.donnees });
        expect(s.lister().map((c) => c.nom)).toEqual([...p.copies()].sort().reverse());
    });
    it('F193 · la licence se lit sur le service COMPILÉ du paquet, avec le dossier du paquet', () => {
        const ici = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), 'omegax-paquet-'));
        racines.push(ici);
        expect(() => refusDeLaLicence(ici, {})).toThrow(/introuvable dans ce paquet/);
        (0, fs_1.mkdirSync)((0, path_1.join)(ici, 'dist', 'modules', 'sur-site'), { recursive: true });
        (0, fs_1.writeFileSync)((0, path_1.join)(ici, 'dist', 'modules', 'sur-site', 'licence-sur-site.service.js'), 'exports.LicenceSurSiteService = class { constructor(a, env, c, ici) { this.v = [a, env.X, c, ici]; } motifRefusMigration() { return JSON.stringify(this.v); } };');
        expect(JSON.parse(refusDeLaLicence(ici, { X: 'env du poste' }))).toEqual([null, 'env du poste', null, ici]);
        expect(moduleCompile(ici, 'modules/sur-site/licence-sur-site.service.js').LicenceSurSiteService).toBeDefined();
    });
    it('l’enchaînement du lanceur · licence et copie avant les migrations, repère après', () => {
        const src = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../installation/demarrer.cjs'), 'utf8');
        const corps = src.slice(src.indexOf('function principal()'), src.indexOf('if (require.main === module)'));
        const i = (s) => {
            expect(corps).toContain(s);
            return corps.indexOf(s);
        };
        expect(i('preparerMiseAJour({')).toBeLessThan(i("'migrate', 'deploy'"));
        expect(i("'migrate', 'deploy'")).toBeLessThan(i('miseAJour.apresMigration();'));
        expect(i('miseAJour.apresMigration();')).toBeLessThan(i('require(entree);'));
        expect(corps).toContain('refusLicence: () => refusDeLaLicence(ICI, process.env)');
        expect(corps).toContain("moduleCompile(ICI, 'modules/sur-site/copies-avant-mise-a-jour.js')");
        expect(corps).toContain("dossier: process.env.DOSSIER_SAUVEGARDES || path.join(process.env.DOSSIER_DONNEES, 'sauvegardes'),");
        expect(i("process.env.DOSSIER_DONNEES = process.env.DOSSIER_DONNEES || DONNEES;")).toBeLessThan(i('preparerMiseAJour({'));
    });
});
//# sourceMappingURL=lanceur-sur-site.spec.js.map