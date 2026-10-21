"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const modeles_cloisonnes_1 = require("./modeles-cloisonnes");
const extension_cloisonnement_1 = require("./extension-cloisonnement");
const contexte_cloisonnement_1 = require("./contexte-cloisonnement");
const contexte_audit_1 = require("../audit/contexte-audit");
const RACINE = (0, node_path_1.join)(__dirname, '..', '..', '..');
describe('la liste des modèles cloisonnés suit le schéma', () => {
    it('ne diverge pas de prisma/schema.prisma', () => {
        const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
        const blocs = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
        const avec = blocs.filter(([, , corps]) => /^\s*tenantId\s/m.test(corps)).map(([, nom]) => nom);
        const sans = blocs.filter(([, , corps]) => !/^\s*tenantId\s/m.test(corps)).map(([, nom]) => nom);
        expect([...modeles_cloisonnes_1.MODELES_CLOISONNES].sort()).toEqual(avec.sort());
        expect([...modeles_cloisonnes_1.MODELES_PORTES_PAR_LEUR_PARENT].sort()).toEqual(sans.filter((n) => n !== 'Tenant' && !(n in modeles_cloisonnes_1.MODELES_HORS_DOSSIER)).sort());
        for (const n of Object.keys(modeles_cloisonnes_1.MODELES_HORS_DOSSIER))
            expect(sans).toContain(n);
    });
});
describe('reconnaissance d’un filtre borné', () => {
    it('voit la borne, y compris sous un AND, un OR ou une relation', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ tenantId: 'd-1' })).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ AND: [{ statut: 'X' }, { tenantId: 'd-1' }] })).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ OR: [{ tenantId: 'd-1' }, { tenantId: 'd-2' }] })).toBe(true);
        expect((0, extension_cloisonnement_1.filtreBorne)({ ecriture: { tenantId: 'd-1' } })).toBe(true);
    });
    it('ne prend pas un filtre par identifiant pour une borne', () => {
        expect((0, extension_cloisonnement_1.filtreBorne)({ id: 'c-1' })).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({ planId: 'p-1', type: 'DETAIL' })).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)(undefined)).toBe(false);
        expect((0, extension_cloisonnement_1.filtreBorne)({})).toBe(false);
    });
});
describe('la garde, règle par règle', () => {
    const base = (ligne = null) => ({
        compte: { findFirst: jest.fn().mockResolvedValue(ligne) },
        ligneEcriture: { findFirst: jest.fn() },
    });
    const dansDossier = (tenantId, f) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'x@y.cd', tenantId }, f);
    it('C · refuse une collection sans borne de dossier', async () => {
        await expect(dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'Compte',
            operation: 'findMany',
            args: { where: { classe: 'CLASSE_5' } },
            query: async () => [{ id: 'c-1' }],
        }))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
    });
    it('C · laisse passer une collection bornée', async () => {
        const r = await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'Compte',
            operation: 'findMany',
            args: { where: { tenantId: 'd-1', classe: 'CLASSE_5' } },
            query: async () => [{ id: 'c-1' }],
        }));
        expect(r).toEqual([{ id: 'c-1' }]);
    });
    it('A · rend INEXISTANTE une ligne d’un autre dossier, sans le dire', async () => {
        const r = await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'Compte',
            operation: 'findUnique',
            args: { where: { id: 'c-1' } },
            query: async () => ({ id: 'c-1', tenantId: 'd-2', numero: '52110000' }),
        }));
        expect(r).toBeNull();
    });
    it('A · rend la ligne du bon dossier', async () => {
        const r = await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'Compte',
            operation: 'findUnique',
            args: { where: { id: 'c-1' } },
            query: async () => ({ id: 'c-1', tenantId: 'd-1' }),
        }));
        expect(r).toEqual({ id: 'c-1', tenantId: 'd-1' });
    });
    it('A · ne coûte AUCUNE requête supplémentaire', async () => {
        const b = base();
        await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(b, {
            model: 'Compte',
            operation: 'findUnique',
            args: { where: { id: 'c-1' } },
            query: async () => ({ id: 'c-1', tenantId: 'd-1' }),
        }));
        expect(b.compte.findFirst).not.toHaveBeenCalled();
    });
    it('B · refuse d’écrire sur la ligne d’un autre dossier', async () => {
        await expect(dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(base({ tenantId: 'd-2' }), {
            model: 'Compte',
            operation: 'update',
            args: { where: { id: 'c-1' }, data: { intitule: 'volé' } },
            query: async () => {
                throw new Error("l'écriture n'aurait jamais dû être tentée");
            },
        }))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
    });
    it('B · laisse écrire sur la ligne de son dossier', async () => {
        const r = await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(base({ tenantId: 'd-1' }), {
            model: 'Compte',
            operation: 'update',
            args: { where: { id: 'c-1' }, data: { intitule: 'Caisse siège' } },
            query: async () => ({ id: 'c-1', tenantId: 'd-1', intitule: 'Caisse siège' }),
        }));
        expect(r).toMatchObject({ intitule: 'Caisse siège' });
    });
    it('B · ne relit pas quand le filtre porte déjà la borne', async () => {
        const b = base({ tenantId: 'd-1' });
        await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(b, {
            model: 'Compte',
            operation: 'update',
            args: { where: { id: 'c-1', tenantId: 'd-1' }, data: {} },
            query: async () => ({ id: 'c-1' }),
        }));
        expect(b.compte.findFirst).not.toHaveBeenCalled();
    });
    it('ne touche pas aux modèles qui ne portent pas de dossier', async () => {
        const r = await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'LigneEcriture',
            operation: 'findMany',
            args: { where: { compteId: 'c-1' } },
            query: async () => [{ id: 'l-1' }],
        }));
        expect(r).toEqual([{ id: 'l-1' }]);
    });
    it('la sortie déclarée passe, et elle seule', async () => {
        const requete = () => (0, extension_cloisonnement_1.garderCloisonnement)(base(), {
            model: 'User',
            operation: 'findUnique',
            args: { where: { email: 'x@y.cd' } },
            query: async () => ({ id: 'u-1', tenantId: 'd-2' }),
        });
        expect(await dansDossier('d-1', requete)).toBeNull();
        expect(await dansDossier('d-1', () => (0, contexte_cloisonnement_1.horsCloisonnement)('connexion', requete))).toMatchObject({ id: 'u-1' });
    });
});
describe('balayage du code · toute collection porte sa borne', () => {
    const COLLECTIONS = ['findMany', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy'];
    const BORNE_PAR_VARIABLE = new Set([
        'src/common/audit/journal-audit.service.ts:EvenementAudit.count',
        'src/common/audit/journal-audit.service.ts:EvenementAudit.findMany',
        'src/modules/comptabilite/ecriture.service.ts:Ecriture.findMany',
        'src/modules/comptes/compte.service.ts:Compte.findMany',
        'src/modules/registre-donateurs/donation.service.ts:Donation.findMany',
        'src/modules/tiers/tiers.service.ts:Tiers.findMany',
    ]);
    const SORTIES_DECLAREES = new Set([
        'src/modules/plateforme/plateforme.service.ts:User.updateMany',
        'src/modules/plateforme/plateforme.service.ts:Licence.updateMany',
    ]);
    function fichiers(dossier) {
        const sortie = [];
        for (const nom of (0, node_fs_1.readdirSync)((0, node_path_1.join)(RACINE, dossier))) {
            const relatif = `${dossier}/${nom}`;
            if ((0, node_fs_1.statSync)((0, node_path_1.join)(RACINE, relatif)).isDirectory())
                sortie.push(...fichiers(relatif));
            else if (nom.endsWith('.ts') && !nom.endsWith('.spec.ts'))
                sortie.push(relatif);
        }
        return sortie;
    }
    it('aucune collection non bornée hors des cas gelés', () => {
        const proprietes = new Map([...modeles_cloisonnes_1.MODELES_CLOISONNES].map((m) => [m.charAt(0).toLowerCase() + m.slice(1), m]));
        const violations = [];
        for (const fichier of fichiers('src')) {
            const texte = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, fichier), 'utf8');
            for (const m of texte.matchAll(/\b(?:this\.prisma|prisma|tx)\.(\w+)\.(\w+)\(/g)) {
                const modele = proprietes.get(m[1]);
                if (!modele || !COLLECTIONS.includes(m[2]))
                    continue;
                let profondeur = 0;
                let j = m.index + m[0].length - 1;
                const debut = j;
                while (j < texte.length) {
                    if (texte[j] === '(')
                        profondeur++;
                    else if (texte[j] === ')' && --profondeur === 0)
                        break;
                    j++;
                }
                if (texte.slice(debut, j + 1).includes('tenantId'))
                    continue;
                const cle = `${fichier}:${modele}.${m[2]}`;
                if (BORNE_PAR_VARIABLE.has(cle) || SORTIES_DECLAREES.has(cle))
                    continue;
                violations.push(`${cle} (ligne ${texte.slice(0, m.index).split('\n').length})`);
            }
        }
        expect(violations).toEqual([]);
    });
    it('la liste des sorties de cloisonnement reste courte et connue', () => {
        const utilisatrices = fichiers('src')
            .filter((f) => !f.startsWith('src/common/cloisonnement/'))
            .filter((f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, f), 'utf8').includes('horsCloisonnement('));
        expect(utilisatrices.sort()).toEqual([
            'src/modules/auth/auth.service.ts',
            'src/modules/groupe/groupe.service.ts',
            'src/modules/plateforme/plateforme.service.ts',
        ]);
    });
    it('la liste des utilisateurs du périmètre de groupe reste courte et connue', () => {
        const utilisatrices = fichiers('src')
            .filter((f) => !f.startsWith('src/common/cloisonnement/'))
            .filter((f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, f), 'utf8').includes('perimetreDeGroupe('));
        expect(utilisatrices.sort()).toEqual(['src/modules/groupe/groupe.service.ts']);
    });
    it('le client Prisma NU n’est nommé que par l’écrivain de maillon', () => {
        const utilisatrices = fichiers('src')
            .filter((f) => f !== 'src/common/prisma.service.ts')
            .filter((f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, f), 'utf8').includes('clientNu'));
        expect(utilisatrices.sort()).toEqual([
            'src/modules/auth/auth.service.ts',
            'src/modules/exports/restitution/restitution.service.ts',
        ]);
    });
});
describe('la garde · lecture sélective et création', () => {
    const dansDossier = (tenantId, f) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'x@y.cd', tenantId }, f);
    it('A · une lecture dont le select omet tenantId est vérifiée quand même', async () => {
        const query = jest.fn(async (args) => args.select.tenantId ? { id: 'c-9', montant: 5, tenantId: 'd-2' } : { id: 'c-9', montant: 5 });
        const r = await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)({}, {
            model: 'Compte',
            operation: 'findFirst',
            args: { where: { id: 'c-9' }, select: { id: true, montant: true } },
            query: query,
        }));
        expect(r).toBeNull();
    });
    it('A · la colonne ajoutée pour vérifier est retirée du résultat rendu', async () => {
        const query = jest.fn(async () => ({ id: 'c-1', tenantId: 'd-1' }));
        const r = await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)({}, {
            model: 'Compte',
            operation: 'findFirst',
            args: { where: { id: 'c-1' }, select: { id: true } },
            query: query,
        }));
        expect(r).toEqual({ id: 'c-1' });
    });
    it('D · une création dans un autre dossier lève, sous ses deux formes', async () => {
        const query = jest.fn(async () => ({}));
        for (const data of [{ tenantId: 'd-2', numero: '1' }, { tenant: { connect: { id: 'd-2' } }, numero: '1' }]) {
            await expect(dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)({}, { model: 'Compte', operation: 'create', args: { data }, query }))).rejects.toThrow(contexte_cloisonnement_1.CloisonnementViole);
        }
        await expect(dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)({}, {
            model: 'Compte',
            operation: 'createMany',
            args: { data: [{ tenantId: 'd-1' }, { tenantId: 'd-2' }] },
            query,
        }))).rejects.toThrow(contexte_cloisonnement_1.CloisonnementViole);
        expect(query).not.toHaveBeenCalled();
    });
    it('D · une création dans le dossier de la session passe', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await dansDossier('d-1', () => (0, extension_cloisonnement_1.garderCloisonnement)({}, { model: 'Compte', operation: 'create', args: { data: { tenantId: 'd-1' } }, query }));
        expect(query).toHaveBeenCalled();
    });
});
//# sourceMappingURL=cloisonnement.spec.js.map