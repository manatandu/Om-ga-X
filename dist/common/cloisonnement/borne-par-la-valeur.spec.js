"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const extension_cloisonnement_1 = require("./extension-cloisonnement");
const contexte_cloisonnement_1 = require("./contexte-cloisonnement");
const contexte_audit_1 = require("../audit/contexte-audit");
const D = 'd-1';
const AUTRE = 'd-2';
describe('filtreBorne · l’égalité, et non la présence', () => {
    it('refuse un tenantId qui n’est pas celui de la session', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: AUTRE }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: D }, D)).toBe(true);
    });
    it('refuse les formes qui portent un tenantId sans borner', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { not: null } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { not: AUTRE } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { notIn: [AUTRE] } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ NOT: { tenantId: D } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { not: null } })).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: AUTRE })).toBe(true);
    });
    it('n’interprète que `equals` et `in`, et refuse le reste plutôt que de deviner', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { equals: D } }, D)).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { in: [D] } }, D)).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { in: [D, AUTRE] } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { in: [] } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: { equals: D, mode: 'insensitive' } }, D)).toBe(false);
    });
    it('exige que TOUTES les branches d’un OR bornent', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ OR: [{ tenantId: D }, {}] }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ OR: [{ tenantId: D }, { tenantId: AUTRE }] }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ OR: [{ tenantId: D }, { tenantId: D, statut: 'X' }] }, D)).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ OR: [] }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ AND: [{ statut: 'X' }, { tenantId: D }] }, D)).toBe(true);
    });
    it('suit la borne à travers une relation, valeur comprise', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ ecriture: { tenantId: D } }, D)).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ ecriture: { tenantId: AUTRE } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ lignes: { some: { tenantId: D } } }, D)).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ lignes: { none: { tenantId: D } } }, D)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ lignes: { every: { tenantId: D } } }, D)).toBe(false);
    });
});
describe('la garde · un tenantId étranger ne la désactive plus', () => {
    const base = (ligne = null) => ({ compte: { findFirst: jest.fn().mockResolvedValue(ligne) } });
    const dansDossier = (tenantId, f) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'x@y.cd', tenantId }, f);
    it('C · refuse une collection bornée sur un AUTRE dossier', async () => {
        await expect(dansDossier(D, () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'Compte',
            operation: 'findMany',
            args: { where: { tenantId: AUTRE } },
            query: async () => [{ id: 'c-1', tenantId: AUTRE }],
        }))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
    });
    it('B · relit et refuse au lieu de court-circuiter sur le filtre', async () => {
        const b = base({ tenantId: AUTRE });
        await expect(dansDossier(D, () => (0, extension_cloisonnement_1.garderCloisonnement)(b, {
            model: 'Compte',
            operation: 'update',
            args: { where: { id: 'c-1', tenantId: AUTRE }, data: { intitule: 'X' } },
            query: async () => ({ id: 'c-1' }),
        }))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
        expect(b.compte.findFirst).toHaveBeenCalledTimes(1);
    });
    it('A · vérifie encore la ligne quand le filtre porte un dossier étranger', async () => {
        const r = await dansDossier(D, () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'Compte',
            operation: 'findFirst',
            args: { where: { tenantId: AUTRE, numero: '52110000' } },
            query: async () => ({ id: 'c-1', tenantId: AUTRE }),
        }));
        expect(r).toBeNull();
    });
});
describe('le périmètre du siège · une sortie mesurée, pas une sortie', () => {
    const base = () => ({ compte: { findFirst: jest.fn() } });
    const dansDossier = (tenantId, f) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'x@y.cd', tenantId }, f);
    const lire = (dossierLu) => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
        model: 'Compte',
        operation: 'findMany',
        args: { where: { tenantId: dossierLu } },
        query: async () => [{ id: 'c-1', tenantId: dossierLu }],
    });
    it('laisse le siège lire une cellule DÉCLARÉE', async () => {
        const r = await dansDossier(D, () => (0, contexte_cloisonnement_1.perimetreDeGroupe)([D, 'cellule-a'], () => lire('cellule-a')));
        expect(r).toEqual([{ id: 'c-1', tenantId: 'cellule-a' }]);
    });
    it('refuse un dossier ABSENT de la déclaration', async () => {
        await expect(dansDossier(D, () => (0, contexte_cloisonnement_1.perimetreDeGroupe)([D, 'cellule-a'], () => lire(AUTRE)))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
        await expect(dansDossier(D, () => (0, contexte_cloisonnement_1.horsCloisonnement)('console', () => lire(AUTRE)))).resolves.toEqual([{ id: 'c-1', tenantId: AUTRE }]);
    });
    it('n’ouvre pas la porte à un filtre non borné', async () => {
        await expect(dansDossier(D, () => (0, contexte_cloisonnement_1.perimetreDeGroupe)([D, 'cellule-a'], () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'Compte',
            operation: 'findMany',
            args: { where: { classe: 'CLASSE_5' } },
            query: async () => [],
        })))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
    });
    it('se referme à la sortie de la portée', async () => {
        await expect(dansDossier(D, async () => {
            await (0, contexte_cloisonnement_1.perimetreDeGroupe)([D, 'cellule-a'], () => lire('cellule-a'));
            return lire('cellule-a');
        })).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
    });
    it('une portée imbriquée AJOUTE au périmètre, elle ne le remplace pas', async () => {
        const r = await dansDossier(D, () => (0, contexte_cloisonnement_1.perimetreDeGroupe)([D, 'cellule-a'], () => (0, contexte_cloisonnement_1.perimetreDeGroupe)(['combinaison'], async () => [
            await lire('cellule-a'),
            await lire('combinaison'),
        ])));
        expect(r).toHaveLength(2);
    });
});
describe('le siège déclare son périmètre pour chaque méthode qui franchit', () => {
    it('aucune méthode publique de GroupeService ne lit une cellule sans le dire', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', '..', 'modules', 'groupe', 'groupe.service.ts'), 'utf8');
        const publiques = [...source.matchAll(/^ {2}async (\w+)\(/gm)].map(([, nom]) => nom);
        const sansFranchissement = ['cellules', 'creerCellule'];
        const groupeEntier = ['virements585DuGroupe'];
        for (const nom of groupeEntier) {
            const corps = source.slice(source.indexOf(`  async ${nom}(`)).split('\n  }\n')[0];
            expect(corps).toContain('const mere = dossier?.dossierMereId ?? tenantId;');
            expect(corps).toContain('where: { id: tenantId }, select: { dossierMereId: true }');
            expect(corps).toContain('perimetreDeGroupe(membres,');
            expect(corps).toContain('this.prisma.ligneEcriture.aggregate(');
            expect(corps).not.toContain('findMany({\n          where: { compte');
        }
        for (const nom of publiques) {
            if (sansFranchissement.includes(nom) || groupeEntier.includes(nom))
                continue;
            const facade = source.slice(source.indexOf(`  async ${nom}(`)).split('\n  }\n')[0];
            expect(facade).toContain('this.dansLeGroupe(tenantId,');
            expect(facade).toContain(`this.${nom}DuGroupe(`);
        }
        expect(publiques.filter((n) => !sansFranchissement.includes(n) && !groupeEntier.includes(n))).toHaveLength(7);
        expect(source).toContain("perimetreDeGroupe([resultat.tenant.id]");
    });
});
//# sourceMappingURL=borne-par-la-valeur.spec.js.map