"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const empreinte_audit_1 = require("./empreinte-audit");
const champs_audites_1 = require("./champs-audites");
const journal_audit_service_1 = require("./journal-audit.service");
const journal_audit_controller_1 = require("./journal-audit.controller");
const extension_audit_1 = require("./extension-audit");
const contexte_audit_1 = require("./contexte-audit");
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const socle = () => ({
    rang: 1,
    tenantId: 'dossier-1',
    horodatage: new Date('2026-09-02T10:00:00.000Z'),
    acteurId: 'u-1',
    acteurEmail: 'comptable@cabinet.cd',
    adresseIp: '41.243.0.1',
    action: 'MODIFICATION',
    entite: 'Compte',
    entiteId: 'c-1',
    avant: { intitule: 'Caisse' },
    apres: { intitule: 'Caisse siège' },
    empreintePrecedente: empreinte_audit_1.EMPREINTE_ORIGINE,
});
describe('empreinte de la chaîne d’audit', () => {
    it('est stable quel que soit l’ordre des clés relues', () => {
        const a = (0, empreinte_audit_1.calculerEmpreinte)({ ...socle(), avant: { x: 1, y: 2 }, apres: null });
        const b = (0, empreinte_audit_1.calculerEmpreinte)({ ...socle(), avant: { y: 2, x: 1 }, apres: null });
        expect(a).toBe(b);
    });
    it('change dès qu’un seul champ journalisé change', () => {
        const reference = (0, empreinte_audit_1.calculerEmpreinte)(socle());
        const variantes = [
            { rang: 2 },
            { tenantId: 'dossier-2' },
            { horodatage: new Date('2026-09-02T10:00:00.001Z') },
            { acteurId: 'u-2' },
            { acteurEmail: 'autre@cabinet.cd' },
            { adresseIp: '41.243.0.2' },
            { action: 'SUPPRESSION' },
            { entite: 'Journal' },
            { entiteId: 'c-2' },
            { avant: { intitule: 'Banque' } },
            { apres: { intitule: 'Banque' } },
            { empreintePrecedente: 'autre' },
        ];
        for (const v of variantes) {
            const cle = Object.keys(v)[0];
            expect([cle, (0, empreinte_audit_1.calculerEmpreinte)({ ...socle(), ...v }) === reference]).toEqual([cle, false]);
        }
    });
    it('couvre l’adresse IP · ce qui n’est pas haché se retouche sans marque', () => {
        expect((0, empreinte_audit_1.calculerEmpreinte)({ ...socle(), adresseIp: null })).not.toBe((0, empreinte_audit_1.calculerEmpreinte)(socle()));
    });
});
describe('ce que le journal ne recopie jamais', () => {
    it('masque tout champ sensible, à toute profondeur', () => {
        const sortie = (0, champs_audites_1.masquer)({
            email: 'a@b.cd',
            motDePasse: '$2b$10$abcdef',
            profond: { ancienMotDePasseHash: 'x', jetonCsrf: 'y', role: 'ADMIN_CABINET' },
            liste: [{ apiKey: 'z' }],
        });
        expect(sortie.email).toBe('a@b.cd');
        expect(sortie.motDePasse).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(sortie.profond.ancienMotDePasseHash).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(sortie.profond.jetonCsrf).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(sortie.profond.role).toBe('ADMIN_CABINET');
        expect(sortie.liste[0].apiKey).toBe(champs_audites_1.MARQUEUR_MASQUE);
    });
    it('reconnaît les variantes d’écriture d’un champ sensible', () => {
        for (const nom of ['motDePasse', 'MotDePasseHash', 'password', 'jetonSession', 'refreshToken', 'jetonCsrf', 'DATABASE_URL'.replace('_', '')]) {
            expect([nom, (0, champs_audites_1.estChampSensible)(nom)]).toEqual([nom, true]);
        }
        for (const nom of ['email', 'intitule', 'numero', 'role']) {
            expect([nom, (0, champs_audites_1.estChampSensible)(nom)]).toEqual([nom, false]);
        }
    });
});
describe('périmètre journalisé', () => {
    it('couvre les accès, la configuration et les actes d’exercice', () => {
        for (const m of ['User', 'Tenant', 'Compte', 'Journal', 'Exercice', 'Cloture', 'Ecriture', 'TauxTva', 'AffectationResultat']) {
            expect([m, champs_audites_1.MODELES_AUDITES.has(m)]).toEqual([m, true]);
        }
    });
    it('exclut délibérément les lignes engendrées en masse', () => {
        for (const m of ['LigneEcriture', 'DotationAmortissement', 'VentilationAnalytique', 'CoursDevise', 'EcheanceAbonnement']) {
            expect([m, champs_audites_1.MODELES_AUDITES.has(m)]).toEqual([m, false]);
        }
    });
});
describe('vérification de la chaîne', () => {
    function chaineSaine(n) {
        const evenements = [];
        let precedente = empreinte_audit_1.EMPREINTE_ORIGINE;
        for (let rang = 1; rang <= n; rang++) {
            const e = {
                id: `e-${rang}`,
                rang,
                tenantId: 'dossier-1',
                horodatage: new Date(Date.UTC(2026, 8, 2, 10, rang)),
                acteurId: 'u-1',
                acteurEmail: 'comptable@cabinet.cd',
                adresseIp: '41.243.0.1',
                action: 'MODIFICATION',
                entite: 'Compte',
                entiteId: `c-${rang}`,
                avant: null,
                apres: { intitule: `libellé ${rang}` },
                empreintePrecedente: precedente,
                empreinte: '',
            };
            e.empreinte = (0, empreinte_audit_1.calculerEmpreinte)(e);
            precedente = e.empreinte;
            evenements.push(e);
        }
        return evenements;
    }
    const service = (evenements, taille = 5_000) => new journal_audit_service_1.JournalAuditService({
        evenementAudit: {
            findMany: jest.fn(({ where, take } = {}) => {
                const apres = where?.rang?.gt ?? 0;
                return Promise.resolve(evenements.filter((e) => e.rang > apres).slice(0, take ?? taille));
            }),
        },
    });
    it('rend la main même si la couche de données IGNORE le curseur', async () => {
        const chaine = chaineSaine(12);
        const aveugle = new journal_audit_service_1.JournalAuditService({
            evenementAudit: { findMany: jest.fn().mockResolvedValue(chaine) },
        });
        const verdict = await aveugle.verifier('dossier-1');
        expect(verdict.evenements).toBe(12);
    });
    it('lit la chaîne PAR LOTS, sans jamais tout charger', async () => {
        const chaine = chaineSaine(25);
        const appels = [];
        const svc = new journal_audit_service_1.JournalAuditService({
            evenementAudit: {
                findMany: jest.fn((args = {}) => {
                    appels.push(args);
                    const apres = args?.where?.rang?.gt ?? 0;
                    return Promise.resolve(chaine.filter((e) => e.rang > apres).slice(0, args?.take ?? 5_000));
                }),
            },
        });
        const verdict = await svc.verifier('dossier-1');
        expect(verdict.evenements).toBe(25);
        expect(appels.length).toBeGreaterThan(1);
        for (const a of appels) {
            expect(typeof a.take).toBe('number');
            expect(a.take).toBeLessThanOrEqual(5_000);
            expect(a.orderBy).toEqual({ rang: 'asc' });
        }
    });
    it('déclare intacte une chaîne non touchée', async () => {
        const verdict = await service(chaineSaine(5)).verifier('dossier-1');
        expect(verdict).toEqual({ evenements: 5, intacte: true, ruptures: [] });
    });
    it('voit une ligne RETOUCHÉE, et dit laquelle', async () => {
        const c = chaineSaine(5);
        c[2].acteurEmail = 'quelquun.dautre@cabinet.cd';
        const verdict = await service(c).verifier('dossier-1');
        expect(verdict.intacte).toBe(false);
        expect(verdict.ruptures).toContainEqual({ rang: 3, id: 'e-3', motif: 'EMPREINTE_INVALIDE' });
    });
    it('voit une ligne SUPPRIMÉE', async () => {
        const c = chaineSaine(5).filter((e) => e.rang !== 3);
        const verdict = await service(c).verifier('dossier-1');
        expect(verdict.intacte).toBe(false);
        expect(verdict.ruptures.map((r) => r.motif)).toContain('RANG_MANQUANT');
    });
    it('voit une ligne INSÉRÉE après coup', async () => {
        const c = chaineSaine(5);
        c[2] = { ...c[2], empreintePrecedente: 'inventé', empreinte: 'inventée' };
        const verdict = await service(c).verifier('dossier-1');
        expect(verdict.ruptures.map((r) => r.motif)).toContain('CHAINAGE_ROMPU');
    });
    it('ne signale QUE le point de rupture, pas toute la suite', async () => {
        const c = chaineSaine(6);
        c[1].entiteId = 'maquillé';
        const verdict = await service(c).verifier('dossier-1');
        expect(verdict.ruptures).toEqual([{ rang: 2, id: 'e-2', motif: 'EMPREINTE_INVALIDE' }]);
    });
});
describe('le journal se lit, il ne s’écrit pas', () => {
    it('n’expose aucune route d’écriture', () => {
        const methodes = Object.getOwnPropertyNames(journal_audit_controller_1.JournalAuditController.prototype).filter((m) => m !== 'constructor');
        expect(methodes.sort()).toEqual(['lister', 'objets', 'verifier']);
        const prototype = journal_audit_controller_1.JournalAuditController.prototype;
        for (const m of methodes) {
            expect([m, Reflect.getMetadata(constants_1.METHOD_METADATA, prototype[m])]).toEqual([m, common_1.RequestMethod.GET]);
        }
    });
});
describe('l’interception, telle qu’elle est branchée', () => {
    function baseFactice(precedent = null) {
        const maillons = [];
        const tx = {
            $queryRaw: jest.fn().mockRejectedValue(new Error("Raw query failed. Message: `Failed to deserialize column of type 'void'`")),
            $executeRaw: jest.fn().mockResolvedValue(1),
            evenementAudit: {
                findFirst: jest.fn().mockResolvedValue(precedent),
                create: jest.fn().mockImplementation(async ({ data }) => {
                    maillons.push(data);
                    return data;
                }),
            },
        };
        return {
            maillons,
            tx,
            client: {
                $transaction: jest.fn().mockImplementation(async (f) => f(tx)),
                compte: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', tenantId: 'd-1', intitule: 'Caisse' }) },
                user: { findFirst: jest.fn().mockResolvedValue({ id: 'u-9', tenantId: 'd-1', email: 'x@y.cd', motDePasse: '$2b$10$secret' }) },
            },
        };
    }
    it('écrit un maillon pour un modèle audité, avec l’état avant et après', async () => {
        const { client, maillons } = baseFactice();
        const resultat = await (0, contexte_audit_1.dansContexteAudit)({ acteurId: 'u-1', acteurEmail: 'chef@cabinet.cd', tenantId: 'd-1', adresseIp: '41.243.0.1' }, () => (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'Compte',
            operation: 'update',
            args: { where: { id: 'c-1' }, data: { intitule: 'Caisse siège' } },
            query: async () => ({ id: 'c-1', tenantId: 'd-1', intitule: 'Caisse siège' }),
        }));
        expect(resultat).toEqual({ id: 'c-1', tenantId: 'd-1', intitule: 'Caisse siège' });
        expect(maillons).toHaveLength(1);
        expect(maillons[0]).toMatchObject({
            tenantId: 'd-1',
            rang: 1,
            acteurId: 'u-1',
            acteurEmail: 'chef@cabinet.cd',
            adresseIp: '41.243.0.1',
            action: 'MODIFICATION',
            entite: 'Compte',
            entiteId: 'c-1',
            empreintePrecedente: empreinte_audit_1.EMPREINTE_ORIGINE,
        });
        expect(maillons[0].avant).toEqual({ id: 'c-1', tenantId: 'd-1', intitule: 'Caisse' });
        expect(maillons[0].apres).toEqual({ id: 'c-1', tenantId: 'd-1', intitule: 'Caisse siège' });
    });
    it('applique la liste d’exclusion DU MODÈLE écrit, pas d’un autre', async () => {
        const { client, maillons } = baseFactice();
        await (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'chef@cabinet.cd', tenantId: 'd-1' }, () => (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'User',
            operation: 'update',
            args: { where: { id: 'u-9' }, data: { estActif: false } },
            query: async () => ({
                id: 'u-9',
                tenantId: 'd-1',
                email: 'x@y.cd',
                motDePasse: '$2b$10$secret',
                estOperateurPlateforme: true,
                estActif: false,
            }),
        }));
        expect(maillons).toHaveLength(1);
        const apres = maillons[0].apres;
        expect(apres.estOperateurPlateforme).toBe('[masqué]');
        expect(apres.motDePasse).toBe('[masqué]');
        expect(apres.email).toBe('x@y.cd');
        expect(apres.estActif).toBe(false);
    });
    it('prend le verrou par `$executeRaw` · `$queryRaw` ne sait pas lire un `void`', async () => {
        const { client, tx, maillons } = baseFactice();
        await (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'Compte',
            operation: 'update',
            args: { where: { id: 'c-1' }, data: { intitule: 'Caisse siège' } },
            query: async () => ({ id: 'c-1', tenantId: 'd-1', intitule: 'Caisse siège' }),
        });
        expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        expect(tx.$queryRaw).not.toHaveBeenCalled();
        expect(maillons).toHaveLength(1);
    });
    it('n’écrit RIEN pour un modèle hors périmètre', async () => {
        const { client, maillons } = baseFactice();
        await (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'LigneEcriture',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'l-1' }),
        });
        expect(maillons).toHaveLength(0);
    });
    it('n’écrit RIEN pour une lecture', async () => {
        const { client, maillons } = baseFactice();
        await (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'Compte',
            operation: 'findMany',
            args: {},
            query: async () => [],
        });
        expect(maillons).toHaveLength(0);
    });
    it('ne recopie jamais le mot de passe, même en passant par l’interception', async () => {
        const { client, maillons } = baseFactice();
        await (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'User',
            operation: 'update',
            args: { where: { id: 'u-9' }, data: { motDePasse: 'nouveau' } },
            query: async () => ({ id: 'u-9', tenantId: 'd-1', email: 'x@y.cd', motDePasse: '$2b$10$nouveau' }),
        });
        expect(JSON.stringify(maillons[0])).not.toContain('$2b$10$');
        expect(maillons[0].avant.motDePasse).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(maillons[0].apres.motDePasse).toBe(champs_audites_1.MARQUEUR_MASQUE);
    });
    it('chaîne sur le maillon précédent du dossier', async () => {
        const { client, maillons } = baseFactice({ rang: 41, empreinte: 'empreinte-41' });
        await (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'Journal',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'j-1', tenantId: 'd-1' }),
        });
        expect(maillons[0]).toMatchObject({ rang: 42, empreintePrecedente: 'empreinte-41' });
    });
    it('note l’acte au nom du système quand il n’y a pas de requête', async () => {
        const { client, maillons } = baseFactice();
        await (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'Compte',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'c-2', tenantId: 'd-2' }),
        });
        expect(maillons[0]).toMatchObject({ acteurEmail: contexte_audit_1.ACTEUR_SYSTEME, acteurId: null, tenantId: 'd-2' });
    });
    it('ne fait PAS échouer une opération réussie si le journal ne s’écrit pas', async () => {
        const { client } = baseFactice();
        client.$transaction = jest.fn().mockRejectedValue(new Error('base injoignable'));
        const silence = jest.spyOn(common_1.Logger.prototype, 'error').mockImplementation(() => undefined);
        const resultat = await (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'Compte',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'c-3', tenantId: 'd-1' }),
        });
        expect(resultat).toEqual({ id: 'c-3', tenantId: 'd-1' });
        expect(silence).toHaveBeenCalled();
        silence.mockRestore();
    });
    it('résume une opération de masse au lieu d’inventer un identifiant', async () => {
        const { client, maillons } = baseFactice();
        await (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'chef@cabinet.cd', tenantId: 'd-1' }, () => (0, extension_audit_1.intercepterEcriture)(client, {
            model: 'Compte',
            operation: 'deleteMany',
            args: { where: { classe: 'CLASSE_9' } },
            query: async () => ({ count: 17 }),
        }));
        expect(maillons[0]).toMatchObject({ entiteId: null, action: 'SUPPRESSION', tenantId: 'd-1' });
        expect(maillons[0].apres).toEqual({ operation: 'deleteMany', filtre: { classe: 'CLASSE_9' }, resultat: { count: 17 } });
    });
});
describe('la création d’un dossier se journalise DANS sa transaction', () => {
    function transactionFactice(dernier) {
        const maillons = [];
        const tx = {
            $executeRaw: jest.fn().mockResolvedValue(1),
            $queryRaw: jest.fn().mockResolvedValue(dernier ? [dernier] : []),
            evenementAudit: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation(async ({ data }) => {
                    maillons.push(data);
                    return data;
                }),
            },
        };
        const base = { $transaction: jest.fn().mockRejectedValue(new Error('ne doit pas être appelée')) };
        return { tx, base, maillons };
    }
    it('écrit par le client de la transaction, jamais par la connexion à part', async () => {
        const { tx, base, maillons } = transactionFactice(null);
        await (0, contexte_audit_1.journaliserDansTransaction)(tx, () => (0, extension_audit_1.intercepterEcriture)(base, {
            model: 'User',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'u-1', tenantId: 'nouveau', email: 'a@b.cd' }),
        }));
        expect(base.$transaction).not.toHaveBeenCalled();
        expect(maillons).toHaveLength(1);
        expect(maillons[0]).toMatchObject({ tenantId: 'nouveau', rang: 1, entite: 'User' });
    });
    it('lit le maillon précédent en SQL brut, que le cloisonnement ne filtre pas', async () => {
        const { tx, base, maillons } = transactionFactice({ rang: 4, empreinte: 'e4' });
        await (0, contexte_audit_1.journaliserDansTransaction)(tx, () => (0, extension_audit_1.intercepterEcriture)(base, {
            model: 'Journal',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'j-1', tenantId: 'nouveau' }),
        }));
        expect(tx.$queryRaw).toHaveBeenCalled();
        expect(tx.evenementAudit.findFirst).not.toHaveBeenCalled();
        expect(maillons[0]).toMatchObject({ rang: 5, empreintePrecedente: 'e4' });
    });
    it('un maillon qui échoue dans la transaction fait échouer l’acte, en le disant', async () => {
        const { tx, base } = transactionFactice(null);
        tx.evenementAudit.create.mockRejectedValue(new Error('refus'));
        await expect((0, contexte_audit_1.journaliserDansTransaction)(tx, () => (0, extension_audit_1.intercepterEcriture)(base, {
            model: 'User',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'u-1', tenantId: 'nouveau' }),
        }))).rejects.toThrow(/Maillon d'audit NON écrit dans la transaction · User\.create/);
    });
    it('la création du dossier ouvre SA chaîne, pas celle de l’acteur', async () => {
        const { tx, base, maillons } = transactionFactice(null);
        await (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'operateur@vmg.cd', tenantId: 'editeur' }, () => (0, contexte_audit_1.journaliserDansTransaction)(tx, () => (0, extension_audit_1.intercepterEcriture)(base, {
            model: 'Tenant',
            operation: 'create',
            args: { data: {} },
            query: async () => ({ id: 'nouveau', nom: 'Cabinet' }),
        })));
        expect(maillons[0]).toMatchObject({ tenantId: 'nouveau', entite: 'Tenant', entiteId: 'nouveau' });
    });
    it('la création ET le semis s’exécutent au nom du dossier qui naît, pas de celui de la session', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../modules/auth/auth.service.ts'), 'utf8');
        const corps = source.slice(source.indexOf('async register('), source.indexOf('async login('));
        const tirage = corps.indexOf('const idDossier = randomUUID();');
        const bascule = corps.indexOf('dansContexteAudit({ ...(acteurCourant()');
        const creation = corps.indexOf('this.tenantService.creerTenant(');
        expect(tirage).toBeGreaterThan(-1);
        expect(bascule).toBeGreaterThan(tirage);
        expect(corps.slice(bascule, bascule + 140)).toMatch(/tenantId: idDossier \}/);
        expect(creation).toBeGreaterThan(bascule);
        expect(corps.slice(creation, creation + 80)).toMatch(/id: idDossier,/);
        for (const semis of ['seedPlan(', 'user.create('])
            expect(corps.indexOf(semis)).toBeGreaterThan(creation);
    });
    it('l’inscription pose la transaction au contexte du journal', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../modules/auth/auth.service.ts'), 'utf8');
        const corps = source.slice(source.indexOf('async register('), source.indexOf('async login('));
        expect(corps).toMatch(/await transactionJournalisee\(\s*this\.prisma,/);
    });
});
//# sourceMappingURL=journal-audit.spec.js.map