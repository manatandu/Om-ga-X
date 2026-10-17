"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const immobilisation_service_1 = require("../immobilisations/immobilisation.service");
const comptes_proposes_1 = require("./comptes-proposes");
const SRC = (0, path_1.join)(__dirname, '..', '..');
function fichiers(dossier) {
    return (0, fs_1.readdirSync)(dossier, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? fichiers((0, path_1.join)(dossier, e.name)) : [(0, path_1.join)(dossier, e.name)]);
}
function routesGet() {
    const routes = [];
    for (const f of fichiers(SRC).filter((x) => x.endsWith('.controller.ts'))) {
        const src = (0, fs_1.readFileSync)(f, 'utf8');
        const prefixe = /@Controller\(\s*'([^']*)'/.exec(src)?.[1] ?? '';
        const decorateurs = [...src.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)/g)];
        decorateurs.forEach((d, i) => {
            if (d[1] !== 'Get')
                return;
            const fin = i + 1 < decorateurs.length ? decorateurs[i + 1].index : src.length;
            routes.push({
                chemin: '/' + [prefixe, d[2] ?? ''].filter(Boolean).join('/'),
                gestionnaire: src.slice(d.index, fin),
                fichier: f,
            });
        });
    }
    return routes;
}
describe('comptes proposés · la règle', () => {
    const COMPTES = [
        { id: 'c521', numero: '52110000', estRetenu: false },
        { id: 'c601', numero: '60100000', estRetenu: false },
        { id: 'c411', numero: '41110000', estRetenu: true },
        { id: 'c622', numero: '62200000', estRetenu: false },
    ];
    const REFERENCES = {
        journal: [{ compteTresorerieId: 'c521' }],
        ligneEcriture: [{ compteId: 'c601' }],
        compte: [{ collectifId: 'c622' }],
    };
    const appels = [];
    const prisma = new Proxy({}, {
        get(_c, nom) {
            return {
                groupBy: async ({ where, by }) => {
                    const champ = by[0];
                    appels.push(`${nom}.${champ}`);
                    const lignes = (REFERENCES[nom] ?? []).filter((l) => l[champ] && where[champ].in.includes(l[champ]));
                    return [...new Map(lignes.map((l) => [l[champ], { [champ]: l[champ] }])).values()];
                },
            };
        },
    });
    it('rend les retenus et les utilisés, compte les écartés, garde l’ordre reçu', async () => {
        const r = await (0, comptes_proposes_1.comptesProposes)(prisma, 't1', COMPTES);
        expect(r.proposes.map((c) => c.numero)).toEqual(['52110000', '60100000', '41110000']);
        expect(r.ecartes).toBe(1);
    });
    it('le lien d’un individuel vers son collectif n’est pas un usage du collectif', async () => {
        appels.length = 0;
        await (0, comptes_proposes_1.comptesProposes)(prisma, 't1', COMPTES);
        expect(appels).not.toContain('compte.collectifId');
        expect(appels).toContain('ligneEcriture.compteId');
    });
    it('un compte retenu ne coûte aucune lecture', async () => {
        appels.length = 0;
        const r = await (0, comptes_proposes_1.comptesProposes)(prisma, 't1', [{ id: 'c411', numero: '41110000', estRetenu: true }]);
        expect(r.proposes).toHaveLength(1);
        expect(appels).toEqual([]);
    });
});
function corpsMethode(src, nom) {
    const m = new RegExp(`\\n\\s*(?:(?:public|private|protected)\\s+)?(?:async\\s+)?${nom}\\s*(?:<[^>]*>)?\\(`).exec(src);
    if (!m)
        return null;
    let k = m.index + m[0].length - 1;
    for (let p = 0; k < src.length; k++) {
        if (src[k] === '(')
            p++;
        else if (src[k] === ')' && --p === 0)
            break;
    }
    const debut = src.indexOf('{', k);
    if (debut < 0)
        return null;
    let j = debut;
    for (let p = 0; j < src.length; j++) {
        if (src[j] === '{')
            p++;
        else if (src[j] === '}' && --p === 0)
            break;
    }
    return src.slice(debut, j + 1);
}
function sourcesDuModule(controleur) {
    const dossier = (0, path_1.dirname)(controleur);
    return fichiers(dossier).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
}
function routeLitDesComptes(r) {
    const methodes = [...r.gestionnaire.matchAll(/this\.\w+\.(\w+)\(/g)].map((x) => x[1]);
    const sources = sourcesDuModule(r.fichier).map((f) => (0, fs_1.readFileSync)(f, 'utf8'));
    return methodes.some((nom) => sources.some((src) => /\.compte\.findMany\(/.test(corpsMethode(src, nom) ?? '')));
}
describe('comptes proposés · la liste des routes, source unique', () => {
    const routes = routesGet();
    it('chaque route nommée existe dans un contrôleur', () => {
        const chemins = new Set(routes.map((r) => r.chemin));
        for (const chemin of [...Object.keys(comptes_proposes_1.LISTES_DE_COMPTES), ...Object.keys(comptes_proposes_1.ROUTES_QUI_NE_SONT_PAS_DES_LISTES)]) {
            expect({ chemin, existe: chemins.has(chemin) }).toEqual({ chemin, existe: true });
        }
    });
    it('toute route GET qui nomme un compte ou une contrepartie est rangée · liste de choix ou motif écrit', () => {
        const rangees = new Set([...Object.keys(comptes_proposes_1.LISTES_DE_COMPTES), ...Object.keys(comptes_proposes_1.ROUTES_QUI_NE_SONT_PAS_DES_LISTES)]);
        const oubliees = routes.filter((r) => /compte|contrepartie/i.test(r.chemin) && !rangees.has(r.chemin)).map((r) => r.chemin);
        expect(oubliees).toEqual([]);
    });
    it('toute route GET dont le service lit des comptes est rangée, quel que soit son nom', () => {
        const rangees = new Set([...Object.keys(comptes_proposes_1.LISTES_DE_COMPTES), ...Object.keys(comptes_proposes_1.ROUTES_QUI_NE_SONT_PAS_DES_LISTES)]);
        const lisant = routes.filter((r) => routeLitDesComptes(r));
        expect(lisant.length).toBeGreaterThan(10);
        expect(lisant.map((r) => r.chemin)).toEqual(expect.arrayContaining(['/comptes', '/immobilisations/subventions-rattachees/octrois']));
        expect(lisant.filter((r) => !rangees.has(r.chemin)).map((r) => r.chemin)).toEqual([]);
    });
    it('une route au régime « retenus » lit le paramètre et passe par la règle commune', () => {
        for (const [chemin, regime] of Object.entries(comptes_proposes_1.LISTES_DE_COMPTES)) {
            if (regime.regime !== 'retenus')
                continue;
            const route = routes.find((r) => r.chemin === chemin);
            expect({ chemin, lit: route.gestionnaire.includes(`@Query('${comptes_proposes_1.PARAMETRE_RETENUS}')`) }).toEqual({ chemin, lit: true });
        }
        const service = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../immobilisations/immobilisation.service.ts'), 'utf8');
        expect(service.match(/comptesProposes\(this\.prisma/g)?.length).toBe(3);
        expect(service).not.toContain('identifiantsUtilises(');
        const compte = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'compte.service.ts'), 'utf8');
        expect(compte).toContain('comptesUtilises(this.prisma');
        expect(compte).not.toContain('identifiantsUtilises(');
    });
    it('la table des routes est un module sans import · le spec de l’écran la charge sans Prisma', () => {
        const src = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'listes-de-comptes.ts'), 'utf8');
        expect(src).not.toMatch(/^\s*import\s/m);
        expect(src).not.toMatch(/\brequire\(/);
        const ecran = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../client/src/lib/comptes-retenus-ecrans.spec.ts'), 'utf8');
        expect(ecran).toContain("from '../../../src/modules/comptes/listes-de-comptes'");
    });
    it('une liste fermée par un texte porte le texte qui la ferme', () => {
        for (const [chemin, regime] of Object.entries(comptes_proposes_1.LISTES_DE_COMPTES)) {
            if (regime.regime === 'texte')
                expect({ chemin, motif: regime.motif.length > 40 }).toEqual({ chemin, motif: true });
        }
    });
});
function serviceImmo(plan, references, jeu = 'PROJETS_DEVELOPPEMENT') {
    const prisma = new Proxy({
        tenant: {
            findUniqueOrThrow: async () => ({ referentiel: 'SYCEBNL', systemeComptableSyscohada: null, jeuEtatsFinanciersSycebnl: jeu }),
            findUnique: async () => ({ referentiel: 'SYCEBNL' }),
        },
        compte: {
            findMany: async ({ where, select }) => {
                if (where.collectifId)
                    return [];
                if (where.typeCompte === 'TOTAL')
                    return [];
                const racines = where.OR?.map((o) => o.numero.startsWith);
                return plan
                    .filter((c) => !('estActif' in where) || c.estActif === where.estActif)
                    .filter((c) => !racines || racines.some((r) => String(c.numero).startsWith(r)))
                    .map((c) => Object.fromEntries(Object.keys(select).map((k) => [k, c[k]])));
            },
            findFirst: async ({ where }) => plan.find((c) => c.id === where.id) ?? null,
        },
    }, {
        get(cible, nom) {
            if (nom in cible)
                return cible[nom];
            return {
                groupBy: async ({ where, by }) => {
                    const champ = by[0];
                    const lignes = (references[nom] ?? []).filter((l) => l[champ] && where[champ].in.includes(l[champ]));
                    return [...new Map(lignes.map((l) => [l[champ], { [champ]: l[champ] }])).values()];
                },
            };
        },
    });
    return new immobilisation_service_1.ImmobilisationService(prisma, {});
}
describe('comptes proposés · les listes des immobilisations', () => {
    it('fonds de fin de projet · le non retenu non utilisé est écarté, et la liste vide dit « retenez-le »', async () => {
        const plan = [
            { id: 'a', numero: '16200000', intitule: 'Bailleurs', estActif: true, estRetenu: false },
            { id: 'b', numero: '16300000', intitule: 'État', estActif: true, estRetenu: false },
        ];
        const tout = await serviceImmo(plan, {}).comptesFondsProjet('t1');
        expect(tout.comptes).toHaveLength(2);
        const choix = await serviceImmo(plan, {}).comptesFondsProjet('t1', true);
        expect(choix.comptes).toEqual([]);
        expect(choix.nonRetenus).toBe(2);
        expect(choix.motifVide).toContain('personnalisez');
        expect(choix.motifVide).toContain('Plan comptable');
        const utilise = await serviceImmo(plan, { ligneEcriture: [{ compteId: 'b' }] }).comptesFondsProjet('t1', true);
        expect(utilise.comptes.map((c) => c.numero)).toEqual(['16300000']);
        expect(utilise.motifVide).toBeNull();
    });
    it('comptes du bien · seuls les retenus ou utilisés sont proposés, le 28 et le 68 se lisent dans tout le plan', async () => {
        const plan = [
            { id: 'v', numero: '24510000', intitule: 'Matériel de transport', estActif: true, estRetenu: true },
            { id: 'm', numero: '24410000', intitule: 'Mobilier', estActif: true, estRetenu: false },
            { id: 'a', numero: '28451000', intitule: 'Amortissements du matériel de transport', estActif: true, estRetenu: false },
            { id: 'd', numero: '68120000', intitule: 'Dotations', estActif: true, estRetenu: false },
        ];
        const choix = await serviceImmo(plan, {}).comptesDuBien('t1', true);
        expect(choix.map((c) => c.numero)).toEqual(['24510000']);
        expect(choix[0].compteAmortissement?.numero).toBe('28451000');
        const tout = await serviceImmo(plan, {}).comptesDuBien('t1');
        expect(tout.map((c) => c.numero).sort()).toEqual(['24410000', '24510000']);
    });
    it('contreparties d’une acquisition · la liste fermée de la fiche, puis la règle des comptes retenus', async () => {
        const plan = [
            { id: 'v', numero: '24510000', intitule: 'Matériel de transport', estActif: true, estRetenu: true },
            { id: 'q', numero: '52110000', intitule: 'Banque', estActif: true, estRetenu: false },
            { id: 'k', numero: '57100000', intitule: 'Caisse', estActif: true, estRetenu: true },
            { id: 'f', numero: '48120000', intitule: 'Fournisseurs d’investissements', estActif: true, estRetenu: false },
        ];
        const references = { journal: [{ compteTresorerieId: 'q' }] };
        const tout = await serviceImmo(plan, references).contrepartiesAcquisition('t1', { compteImmobilisationId: 'v' });
        const choix = await serviceImmo(plan, references).contrepartiesAcquisition('t1', { compteImmobilisationId: 'v' }, null, true);
        expect(tout.map((c) => c.numero)).toContain('48120000');
        expect(choix.map((c) => c.numero)).not.toContain('48120000');
        expect(choix.map((c) => c.numero)).toEqual(expect.arrayContaining(['52110000', '57100000']));
        expect(choix.every((c) => !('estRetenu' in c))).toBe(true);
    });
});
//# sourceMappingURL=comptes-proposes.spec.js.map