"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const interface_sur_site_1 = require("./modules/sur-site/interface-sur-site");
const nettoyage_telemetrie_1 = require("./common/telemetrie/nettoyage-telemetrie");
const RACINE = (0, path_1.join)(__dirname, '..');
const lire = (chemin) => (0, fs_1.readFileSync)((0, path_1.join)(RACINE, chemin), 'utf8');
function sansCommentaires(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}
function fichiersTs(dossier) {
    const trouves = [];
    for (const nom of (0, fs_1.readdirSync)(dossier)) {
        const chemin = (0, path_1.join)(dossier, nom);
        if ((0, fs_1.statSync)(chemin).isDirectory())
            trouves.push(...fichiersTs(chemin));
        else if (nom.endsWith('.ts') && !nom.endsWith('.spec.ts'))
            trouves.push(chemin);
    }
    return trouves;
}
describe('le paquet porte le nom du logiciel', () => {
    const paquet = JSON.parse(lire('package.json'));
    const verrou = JSON.parse(lire('package-lock.json'));
    it('il s’appelle OmegaX, et le verrou le dit aux deux endroits où npm l’écrit', () => {
        expect(paquet.name).toBe('omegax');
        expect(verrou.name).toBe(paquet.name);
        expect(verrou.packages[''].name).toBe(paquet.name);
    });
    it('sa description nomme les deux référentiels qu’il sert', () => {
        expect(paquet.description).toContain('SYCEBNL');
        expect(paquet.description).toContain('SYSCOHADA');
    });
});
describe('la politique de sécurité du site ne s’ouvre qu’à sa propre origine', () => {
    const csp = JSON.parse(lire('client/firebase.json')).hosting.headers
        .flatMap((r) => r.headers)
        .find((h) => h.key === 'Content-Security-Policy').value;
    it('connect-src vaut self et les deux hôtes UE de la télémétrie, rien d’autre · l’API est servie sous /api depuis le 2026-09-26', () => {
        const connexion = csp
            .split(';')
            .map((d) => d.trim())
            .filter((d) => d.startsWith('connect-src'));
        expect(connexion).toEqual([`connect-src 'self' ${nettoyage_telemetrie_1.HOTES_TELEMETRIE_UE.join(' ')}`]);
        expect(nettoyage_telemetrie_1.HOTES_TELEMETRIE_UE).toEqual(['https://*.ingest.de.sentry.io', 'https://eu.i.posthog.com']);
    });
    it('elle est celle de l’interface servie sur site, la télémétrie en plus · le poste n’ouvre aucun hôte extérieur', () => {
        expect(csp).toBe(interface_sur_site_1.POLITIQUE_INTERFACE.replace("connect-src 'self';", `connect-src 'self' ${nettoyage_telemetrie_1.HOTES_TELEMETRIE_UE.join(' ')};`));
        expect(interface_sur_site_1.POLITIQUE_INTERFACE).toContain("connect-src 'self';");
    });
});
describe('le modèle de variables d’environnement ne présente que ce que le code lit', () => {
    const lu = [...fichiersTs((0, path_1.join)(RACINE, 'src')).map((f) => (0, fs_1.readFileSync)(f, 'utf8')), lire('prisma/schema.prisma')]
        .map(sansCommentaires)
        .join('\n');
    const declarees = lire('.env.example')
        .split('\n')
        .map((l) => l.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
        .filter((v) => !!v);
    it('le modèle déclare encore des variables · sinon ce test ne vérifie rien', () => {
        expect(declarees).toEqual(expect.arrayContaining(['DATABASE_URL', 'JWT_SECRET', 'SMTP_HOST']));
    });
    it('chaque variable déclarée est lue hors commentaire par le serveur ou le schéma', () => {
        const jamaisLues = declarees.filter((v) => !new RegExp(`\\b${v}\\b`).test(lu));
        expect(jamaisLues).toEqual([]);
    });
    it('une variable citée dans un commentaire ne compte pas comme lue', () => {
        const lecture = sansCommentaires("/** VAR_A */\nconst x = 'https://a'; // VAR_B\nconst y = process.env.VAR_C;");
        expect(lecture).not.toMatch(/VAR_A|VAR_B/);
        expect(lecture).toContain('process.env.VAR_C');
        expect(lecture).toContain("'https://a'");
    });
});
describe('les renvois vers la fiche d’installation nomment une section qui existe', () => {
    it('la clé publique renvoie à un titre de docs/installation-sur-site.md', () => {
        const source = lire('src/modules/sur-site/cle-publique-editeur.ts').replace(/\n\s*\*\s?/g, ' ');
        const fiche = lire('docs/installation-sur-site.md');
        const renvois = [...source.matchAll(/docs\/installation-sur-site\.md, § (\d+) « ([^»]+?) »/g)];
        expect(renvois.length).toBeGreaterThan(0);
        for (const [, numero, titre] of renvois) {
            expect(fiche).toMatch(new RegExp(`^## ${numero}\\. ${titre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
        }
    });
});
describe('les scripts de scripts/ prennent leurs chemins en argument (audit final F263)', () => {
    const scripts = (0, fs_1.readdirSync)((0, path_1.join)(RACINE, 'scripts')).filter((n) => n.endsWith('.py'));
    it('le recensement trouve les scripts des citations · sinon ce test ne vérifie rien', () => {
        expect(scripts).toEqual(expect.arrayContaining(['index-citations-lot-b.py', 'rapprocher-citations.py']));
    });
    it('aucun ne porte un chemin absolu de poste dans son code', () => {
        const fautifs = scripts.filter((nom) => {
            const code = lire(`scripts/${nom}`)
                .replace(/"""[\s\S]*?"""/g, '')
                .replace(/#.*$/gm, '');
            return /['"]\/(?:tmp|root|home)\//.test(code);
        });
        expect(fautifs).toEqual([]);
    });
});
describe('bootstrap.ts · chaque commentaire de documentation précède sa déclaration', () => {
    const source = lire('src/bootstrap.ts');
    it('aucun commentaire de documentation n’en suit un autre sans déclaration entre les deux', () => {
        expect(source).not.toMatch(/\*\/\s*\/\*\*/);
    });
    it('configurerApplication porte le sien, retirerPrefixeApi aussi', () => {
        const avant = (declaration) => {
            const i = source.indexOf(declaration);
            return source.slice(source.lastIndexOf('\n/**', i), i);
        };
        expect(avant('export function configurerApplication')).toContain('Configuration commune de l');
        expect(avant('export function retirerPrefixeApi')).toContain("L'API SOUS L'ADRESSE DU SITE");
    });
});
//# sourceMappingURL=configuration-a-jour.spec.js.map