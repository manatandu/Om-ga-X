"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const collectifs_tiers_1 = require("./collectifs-tiers");
const tiers_service_1 = require("./tiers.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
describe('les collectifs existent dans le plan semé, sous l’intitulé qui les justifie', () => {
    const semis = {
        [client_1.Referentiel.SYCEBNL]: (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../comptes/compte-seed.ts'), 'utf8'),
        [client_1.Referentiel.SYSCOHADA]: (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../comptes/compte-seed-syscohada.ts'), 'utf8'),
    };
    const intitules = {
        [client_1.Referentiel.SYCEBNL]: { FOURNISSEUR: 'Fournisseurs', ADHERENT: 'Adhérents', CLIENT: 'Clients-usagers' },
        [client_1.Referentiel.SYSCOHADA]: { FOURNISSEUR: 'Fournisseurs', CLIENT: 'Clients' },
    };
    for (const ref of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        for (const [type, numero] of Object.entries(collectifs_tiers_1.COLLECTIFS_TIERS[ref])) {
            it(`${ref} · ${type} → ${numero}`, () => {
                const intitule = intitules[ref][type];
                expect(semis[ref]).toMatch(new RegExp(`'${numero}',\\s*'${intitule}'`));
            });
        }
    }
    it('aucun collectif pour un salarié ou un tiers « autre », ni d’adhérent au SYSCOHADA', () => {
        for (const ref of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            expect((0, collectifs_tiers_1.numeroCollectif)(ref, client_1.TypeTiers.SALARIE)).toBeNull();
            expect((0, collectifs_tiers_1.numeroCollectif)(ref, client_1.TypeTiers.AUTRE)).toBeNull();
        }
        expect((0, collectifs_tiers_1.numeroCollectif)(client_1.Referentiel.SYSCOHADA, client_1.TypeTiers.ADHERENT)).toBeNull();
        expect((0, collectifs_tiers_1.numeroCollectif)(client_1.Referentiel.SYSCOHADA, client_1.TypeTiers.CLIENT)).toBe('41110000');
        expect((0, collectifs_tiers_1.numeroCollectif)(client_1.Referentiel.SYCEBNL, client_1.TypeTiers.CLIENT)).toBe('41200000');
    });
});
describe('numéro du compte individuel', () => {
    it('racine sans les zéros de complément', () => {
        expect((0, collectifs_tiers_1.racineCollectif)('40110000')).toBe('4011');
        expect((0, collectifs_tiers_1.racineCollectif)('41100000')).toBe('411');
    });
    it('prend le premier numéro libre, jamais celui du collectif, à la longueur du dossier', () => {
        expect((0, collectifs_tiers_1.prochainNumeroIndividuel)('4011', 8, ['40110000'])).toBe('40110001');
        expect((0, collectifs_tiers_1.prochainNumeroIndividuel)('4011', 8, ['40110000', '40110001', '40110003'])).toBe('40110002');
        expect((0, collectifs_tiers_1.prochainNumeroIndividuel)('411', 10, ['41100000'])).toBe('4110000001');
    });
    it('rend null quand la racine ne laisse aucune place', () => {
        expect((0, collectifs_tiers_1.prochainNumeroIndividuel)('4011', 4, [])).toBeNull();
        const pleins = Array.from({ length: 9 }, (_, i) => `4011${i + 1}`);
        expect((0, collectifs_tiers_1.prochainNumeroIndividuel)('4011', 5, pleins)).toBeNull();
    });
});
describe('balance générale regroupée par collectif', () => {
    const l = (compteId, numero, debit, credit) => ({
        compteId,
        numero,
        intitule: numero,
        totalDebit: debit,
        totalCredit: credit,
        reportDebit: 0,
        reportCredit: 0,
        mouvementDebit: debit,
        mouvementCredit: credit,
        solde: debit - credit,
    });
    const collectif = { id: 'c4011', numero: '40110000', intitule: 'Fournisseurs' };
    it('fond les individuels sur leur collectif, avec ou sans ligne propre du collectif, et laisse les totaux intacts', () => {
        const lignes = [l('i1', '40110001', 0, 300), l('c4011', '40110000', 50, 0), l('i2', '40110002', 100, 500), l('b', '52100000', 650, 0)];
        const r = (0, collectifs_tiers_1.regrouperSurCollectifs)(lignes, new Map([['i1', collectif], ['i2', collectif]]));
        expect(r.map((x) => x.numero)).toEqual(['40110000', '52100000']);
        expect(r[0]).toMatchObject({ compteId: 'c4011', totalDebit: 150, totalCredit: 800, solde: -650, regroupe: 2, intitule: 'Fournisseurs' });
        const somme = (t) => t.reduce((s, x) => s + x.totalDebit - x.totalCredit, 0);
        expect(somme(r)).toBe(lignes.reduce((s, x) => s + x.solde, 0));
    });
    it('un compte sans collectif reste sur sa ligne', () => {
        const r = (0, collectifs_tiers_1.regrouperSurCollectifs)([l('x', '40120000', 10, 0)], new Map());
        expect(r).toEqual([expect.objectContaining({ numero: '40120000', regroupe: 0 })]);
    });
    it('le service lit le lien du schéma, et rend les totaux de la balance compte par compte', async () => {
        const balance = { lignes: [l('i1', '40110001', 0, 300)], totaux: { debit: 0, credit: 300 } };
        const findMany = jest.fn().mockResolvedValue([{ id: 'i1', collectif }]);
        const r = await ecriture_service_1.EcritureService.prototype.balanceRegroupeeParCollectif.call({ balance: jest.fn().mockResolvedValue(balance), prisma: { compte: { findMany } } }, 't1', 'ex');
        expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', collectifId: { not: null } });
        expect(r.lignes[0]).toMatchObject({ numero: '40110000', regroupe: 1 });
        expect(r.totaux).toBe(balance.totaux);
    });
});
describe('création du tiers et de son compte', () => {
    function monter(referentiel, comptes, dejaRattaches = [], tiersLu = { id: 'ti9', type: client_1.TypeTiers.AUTRE, nom: 'Divers', code: 'D' }) {
        const crees = [];
        const rattaches = [];
        const retires = [];
        const verrous = [];
        const p = {
            $executeRaw: async (_gabarit, cle) => {
                verrous.push(cle);
                return 1;
            },
            tenant: { findUniqueOrThrow: async () => ({ referentiel, longueurCompte: 8 }) },
            tiers: {
                findUnique: async () => null,
                findFirst: async () => tiersLu,
                create: async ({ data }) => ({ id: 'ti1', ...data }),
            },
            compte: {
                findFirst: async ({ where }) => {
                    if (where.tenantId !== 't1')
                        throw new Error(`compte.findFirst hors du dossier : ${where.tenantId}`);
                    const c = comptes.find((x) => x.numero === where.numero);
                    return c ? { classe: 'CLASSE_4', typeCompte: 'DETAIL', modeReportANouveau: 'DETAIL', lettrable: true, estActif: true, ...c } : null;
                },
                findMany: async ({ where }) => {
                    if (where.tenantId !== 't1')
                        throw new Error(`compte.findMany hors du dossier : ${where.tenantId}`);
                    return comptes.filter((c) => c.numero.startsWith(where.numero.startsWith));
                },
                create: async ({ data }) => {
                    crees.push(data);
                    comptes.push({ id: `nouveau-${crees.length}`, numero: data.numero });
                    return { id: 'nouveau', ...data };
                },
            },
            tiersCompte: {
                findFirst: async () => null,
                findUnique: async () => null,
                findMany: async () => dejaRattaches,
                create: async ({ data }) => {
                    rattaches.push(data);
                    return data;
                },
                update: async ({ where, data }) => {
                    if (data.estPrincipal === false)
                        retires.push(where.id);
                    return { id: where.id, ...data };
                },
            },
        };
        p.$transaction = (f) => f(p);
        return { service: new tiers_service_1.TiersService(p), crees, rattaches, retires, verrous };
    }
    it('un fournisseur SYSCOHADA naît avec son compte sous le 4011, principal, rattaché au collectif', async () => {
        const { service, crees, rattaches } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4011', numero: '40110000' },
            { id: 'x', numero: '40110001' },
        ]);
        const t = await service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F1', nom: 'Soco' });
        expect(crees[0]).toMatchObject({ numero: '40110002', intitule: 'Soco', collectifId: 'c4011', lettrable: true, modeReportANouveau: 'DETAIL' });
        expect(rattaches[0]).toMatchObject({ tiersId: 'ti1', estPrincipal: true });
        expect(t.compteIndividuel).toEqual({ id: 'nouveau', numero: '40110002', collectif: '40110000' });
    });
    it('un client SYCEBNL va au 412 Clients-usagers, pas au 411', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYCEBNL, [{ id: 'c412', numero: '41200000' }]);
        await service.creer('t1', { type: client_1.TypeTiers.CLIENT, code: 'C1', nom: 'Usager' });
        expect(crees[0]).toMatchObject({ numero: '41200001', collectifId: 'c412' });
    });
    it('sans case cochée, ou pour un type sans collectif, le tiers naît sans compte', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYSCOHADA, [{ id: 'c4011', numero: '40110000' }]);
        expect((await service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F2', nom: 'X', creerCompteIndividuel: false })).compteIndividuel).toBeNull();
        expect((await service.creer('t1', { type: client_1.TypeTiers.AUTRE, code: 'A1', nom: 'Y' })).compteIndividuel).toBeNull();
        expect(crees).toHaveLength(0);
    });
    it('demandé après coup pour un type sans collectif, il est refusé en le disant', async () => {
        const { service } = monter(client_1.Referentiel.SYSCOHADA, []);
        await expect(service.completerPanoplie('t1', 'ti9')).rejects.toThrow(/pas de compte collectif proposé/);
    });
    it('un fournisseur naît avec sa panoplie, chaque compte au même rang que le principal', async () => {
        const { service, crees, rattaches } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4011', numero: '40110000' },
            { id: 'x', numero: '40110001' },
            { id: 'c4081', numero: '40810000' },
            { id: 'c4091', numero: '40910000' },
        ]);
        const t = await service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F1', nom: 'Soco' });
        expect(crees.map((c) => [c.numero, c.intitule, c.collectifId])).toEqual([
            ['40110002', 'Soco', 'c4011'],
            ['40810002', 'Soco · factures non parvenues', 'c4081'],
            ['40910002', 'Soco · avances et acomptes versés', 'c4091'],
        ]);
        expect(rattaches.map((r) => r.estPrincipal)).toEqual([true, false, false]);
        expect(t.panoplie?.crees.map((c) => c.role)).toEqual(['PRINCIPAL', 'FACTURES_NON_PARVENUES', 'AVANCES_VERSEES']);
    });
    it('un rang déjà pris cède au premier numéro libre, et un collectif absent est nommé sans bloquer la création', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4111', numero: '41110000' },
            { id: 'c4181', numero: '41810000' },
            { id: 'pris', numero: '41810001' },
            { id: 'c4191', numero: '41910000' },
            { id: 'c4161', numero: '41610000', estActif: false },
            { id: 'c4162', numero: '41620000' },
        ]);
        const t = await service.creer('t1', { type: client_1.TypeTiers.CLIENT, code: 'C1', nom: 'Acme' });
        expect(crees.map((c) => c.numero)).toEqual(['41110001', '41810002', '41910001', '41620001']);
        expect(t.panoplie?.impossibles).toEqual([expect.objectContaining({ collectif: '41610000' })]);
    });
    it('un numéro choisi ouvre le principal sous ce numéro, et la panoplie prend son rang', async () => {
        const { service, crees, rattaches } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4011', numero: '40110000' },
            { id: 'x', numero: '40110001' },
            { id: 'c4081', numero: '40810000' },
            { id: 'c4091', numero: '40910000' },
        ]);
        const t = await service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F1', nom: 'Soco', numeroCompte: '40110250' });
        expect(crees.map((c) => [c.numero, c.collectifId])).toEqual([
            ['40110250', 'c4011'],
            ['40810250', 'c4081'],
            ['40910250', 'c4091'],
        ]);
        expect(rattaches.map((r) => r.estPrincipal)).toEqual([true, false, false]);
        expect(t.compteIndividuel).toEqual({ id: 'nouveau', numero: '40110250', collectif: '40110000' });
        expect(Object.keys(t)).not.toContain('numeroCompte');
    });
    it('un client SYCEBNL choisit son numéro sous le 412, et ses sous-comptes à racine plus longue prennent le même rang', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYCEBNL, [
            { id: 'c412', numero: '41200000' },
            { id: 'c4182', numero: '41820000' },
            { id: 'c4192', numero: '41920000' },
            { id: 'c4162', numero: '41620000' },
        ]);
        await service.creer('t1', { type: client_1.TypeTiers.CLIENT, code: 'C1', nom: 'Usager', numeroCompte: '41200037' });
        expect(crees.map((c) => c.numero)).toEqual(['41200037', '41820037', '41920037', '41620037']);
    });
    it('un rang trop long pour la racine d’un sous-compte cède au premier libre, et c’est dit', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYCEBNL, [
            { id: 'c412', numero: '41200000' },
            { id: 'c4182', numero: '41820000' },
            { id: 'c4192', numero: '41920000' },
            { id: 'c4162', numero: '41620000' },
        ]);
        const t = await service.creer('t1', { type: client_1.TypeTiers.CLIENT, code: 'C1', nom: 'Usager', numeroCompte: '41212345' });
        expect(crees.map((c) => c.numero)).toEqual(['41212345', '41820001', '41920001', '41620001']);
        expect(t.panoplie?.horsRang.map((h) => h.numero)).toEqual(['41820001', '41920001', '41620001']);
    });
    it('un numéro ouvert à la main sans tiers est refusé, et le refus nomme l’issue du rattachement', async () => {
        const { service } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4011', numero: '40110000' },
            { id: 'repris', numero: '40110250' },
        ]);
        await expect(service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F1', nom: 'Soco', numeroCompte: '40110250' })).rejects.toThrow(/existe déjà dans ce dossier .* rattachez-lui ce compte comme principal/);
    });
    it('un numéro choisi déjà ouvert est refusé en le disant, rien n’est créé', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4011', numero: '40110000' },
            { id: 'x', numero: '40110001' },
        ]);
        await expect(service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F1', nom: 'Soco', numeroCompte: '40110001' })).rejects.toThrow(/Le compte 40110001 existe déjà dans ce dossier/);
        expect(crees).toHaveLength(0);
    });
    it('un numéro choisi hors des règles, sans compte à ouvrir, ou pour un type sans collectif est refusé', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYSCOHADA, [{ id: 'c4011', numero: '40110000' }]);
        const creer = (dto) => service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F1', nom: 'Soco', ...dto });
        await expect(creer({ numeroCompte: '4011SOCO' })).rejects.toThrow(/que des chiffres/);
        await expect(creer({ numeroCompte: '41110001' })).rejects.toThrow(/ne commence pas par 4011/);
        await expect(creer({ numeroCompte: '401100012' })).rejects.toThrow(/compte 9 chiffres/);
        await expect(creer({ numeroCompte: '40110000' })).rejects.toThrow(/ne se distingue pas du collectif/);
        await expect(creer({ numeroCompte: '40110005', creerCompteIndividuel: false })).rejects.toThrow(/Ouvrir ses comptes/);
        await expect(service.creer('t1', { type: client_1.TypeTiers.AUTRE, code: 'A1', nom: 'Y', numeroCompte: '47110001' })).rejects.toThrow(/pas de compte collectif proposé/);
        expect(crees).toHaveLength(0);
    });
    it('un numéro choisi sous un collectif absent ou en sommeil refuse la création, jamais un tiers sans son compte', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4011', numero: '40110000', estActif: false },
            { id: 'c4081', numero: '40810000' },
            { id: 'c4091', numero: '40910000' },
        ]);
        await expect(service.creer('t1', { type: client_1.TypeTiers.FOURNISSEUR, code: 'F1', nom: 'Soco', numeroCompte: '40110005' })).rejects.toThrow(/40110000 n'existe pas ou est en sommeil/);
        expect(crees).toHaveLength(0);
    });
    it('le numéro proposé est le premier libre sous le collectif, celui que la création prendrait sans choix', async () => {
        const { service } = monter(client_1.Referentiel.SYSCOHADA, [
            { id: 'c4111', numero: '41110000' },
            { id: 'x', numero: '41110001' },
            { id: 'y', numero: '41110003' },
        ]);
        expect(await service.numeroPropose('t1', client_1.TypeTiers.CLIENT)).toEqual({
            numero: '41110002',
            collectif: '41110000',
            longueur: 8,
            motif: null,
        });
        expect(await service.numeroPropose('t1', client_1.TypeTiers.SALARIE)).toMatchObject({ numero: null, motif: /pas de compte collectif/ });
        await expect(service.numeroPropose('t1', client_1.TypeTiers.ADHERENT)).rejects.toThrow(/utilisez le type « client »/);
    });
    it('sans collectif ouvert, rien n’est proposé, et le motif le dit', async () => {
        const { service } = monter(client_1.Referentiel.SYSCOHADA, [{ id: 'c4011', numero: '40110000', estActif: false }]);
        expect(await service.numeroPropose('t1', client_1.TypeTiers.FOURNISSEUR)).toMatchObject({
            numero: null,
            collectif: '40110000',
            motif: /n'existe pas ou est en sommeil/,
        });
    });
    it('un adhérent SYCEBNL reçoit ses appels de fonds au 4181 et ses cotisations douteuses au 4161', async () => {
        const { service, crees } = monter(client_1.Referentiel.SYCEBNL, [
            { id: 'c411', numero: '41100000' },
            { id: 'c4181', numero: '41810000' },
            { id: 'c4191', numero: '41910000' },
            { id: 'c4161', numero: '41610000' },
        ]);
        await service.creer('t1', { type: client_1.TypeTiers.ADHERENT, code: 'A1', nom: 'Membre' });
        expect(crees.map((c) => [c.numero, c.intitule])).toEqual([
            ['41100001', 'Membre'],
            ['41810001', 'Membre · appels de fonds à établir'],
            ['41910001', 'Membre · avances reçues'],
            ['41610001', 'Membre · cotisations litigieuses ou douteuses'],
        ]);
    });
    it('compléter ne recrée rien de ce que le tiers a, et s’aligne sur son principal', async () => {
        const client = { id: 'ti5', type: client_1.TypeTiers.CLIENT, nom: 'Usager', code: 'U5' };
        const { service, crees, rattaches } = monter(client_1.Referentiel.SYCEBNL, [
            { id: 'c412', numero: '41200000' },
            { id: 'u', numero: '41200007' },
            { id: 'c4182', numero: '41820000' },
            { id: 'c4192', numero: '41920000' },
            { id: 'c4162', numero: '41620000' },
        ], [
            { estPrincipal: true, compte: { numero: '41200007' } },
            { estPrincipal: false, compte: { numero: '41920003' } },
        ], client);
        const r = await service.completerPanoplie('t1', 'ti5');
        expect(crees.map((c) => c.numero)).toEqual(['41820007', '41620007']);
        expect(rattaches.every((x) => x.estPrincipal === false)).toBe(true);
        expect(r.dejaPresents).toBe(2);
    });
    it('un principal posé sur le collectif commun n’est pas un compte du tiers · il reçoit le sien, sous verrou du dossier', async () => {
        const client = { id: 'ti7', type: client_1.TypeTiers.CLIENT, nom: 'Ancien', code: 'A7' };
        const { service, crees, rattaches, retires, verrous } = monter(client_1.Referentiel.SYSCOHADA, [{ id: 'c4111', numero: '41110000' }], [{ id: 'tc-collectif', estPrincipal: true, compte: { numero: '41110000' } }], client);
        const r = await service.completerPanoplie('t1', 'ti7');
        expect(crees[0]).toMatchObject({ numero: '41110001', collectifId: 'c4111' });
        expect(rattaches[0]).toMatchObject({ estPrincipal: true });
        expect(retires).toEqual(['tc-collectif']);
        expect(r.principal?.numero).toBe('41110001');
        expect(verrous).toEqual(['panoplie:t1']);
    });
    it('compléter le dossier lit la tranche APRÈS le curseur, tiers actifs seuls, et nomme le tiers qui échoue sans arrêter les autres', async () => {
        const requetes = [];
        let appel = 0;
        const p = {
            tiers: {
                findMany: async (q) => {
                    requetes.push(q);
                    return [
                        { id: 'ta', type: client_1.TypeTiers.FOURNISSEUR, nom: 'A', code: 'A' },
                        { id: 'tb', type: client_1.TypeTiers.FOURNISSEUR, nom: 'B', code: 'B' },
                    ];
                },
            },
        };
        p.$transaction = async (f) => {
            appel += 1;
            if (appel === 1)
                throw new Error('panne');
            return f(p);
        };
        const service = new tiers_service_1.TiersService(p);
        service.poserPanoplie = async () => ({
            principal: null,
            crees: [{ role: 'PRINCIPAL', numero: '40110002', collectif: '40110000' }],
            dejaPresents: 0,
            impossibles: [],
            horsRang: [{ collectif: '40810000', numero: '40810003' }],
        });
        const r = await service.completerPanoplies('t1', 'curseur');
        expect(requetes[0]).toMatchObject({
            where: { tenantId: 't1', estActif: true, id: { gt: 'curseur' } },
            orderBy: { id: 'asc' },
        });
        expect(requetes[0]).not.toHaveProperty('cursor');
        expect(r.comptesCrees).toBe(1);
        expect(r.impossibles).toEqual([{ tiers: 'A', collectif: '', motif: expect.stringMatching(/relancez/) }]);
        expect(r.horsRang).toEqual([{ tiers: expect.any(String), numero: '40810003' }]);
    });
    it('compléter un tiers dont aucun compte ne peut naître le refuse en le disant', async () => {
        const fournisseur = { id: 'ti6', type: client_1.TypeTiers.FOURNISSEUR, nom: 'F', code: 'F6' };
        const { service } = monter(client_1.Referentiel.SYSCOHADA, [], [], fournisseur);
        await expect(service.completerPanoplie('t1', 'ti6')).rejects.toThrow(/40110000 n'existe pas ou est en sommeil/);
    });
});
describe('la panoplie existe dans le plan semé, sous l’intitulé qui la justifie', () => {
    const semis = {
        [client_1.Referentiel.SYCEBNL]: (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../comptes/compte-seed.ts'), 'utf8'),
        [client_1.Referentiel.SYSCOHADA]: (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../comptes/compte-seed-syscohada.ts'), 'utf8'),
    };
    const attendus = {
        [client_1.Referentiel.SYSCOHADA]: {
            '40110000': 'Fournisseurs',
            '40810000': 'Fournisseurs',
            '40910000': 'Fournisseurs - Avances et acomptes versés',
            '41110000': 'Clients',
            '41810000': 'Clients, factures à établir',
            '41910000': 'Clients, avances et acomptes reçus',
            '41610000': 'Créances litigieuses',
            '41620000': 'Créances douteuses',
        },
        [client_1.Referentiel.SYCEBNL]: {
            '40110000': 'Fournisseurs',
            '40810000': 'Fournisseurs, factures non parvenues',
            '40910000': 'Fournisseurs débiteurs · avances et acomptes versés',
            '41100000': 'Adhérents',
            '41810000': 'Adhérents, appels de fonds à établir',
            '41910000': 'Adhérents, avances reçues',
            '41610000': 'Créances · cotisations litigieuses ou douteuses',
            '41200000': 'Clients-usagers',
            '41820000': 'Clients-usagers, factures à établir',
            '41920000': 'Clients-usagers, avances et acomptes reçus',
            '41620000': 'Créances · adhérents, clients-usagers litigieuses ou douteuses',
        },
    };
    for (const ref of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${ref} · chaque collectif de la panoplie est semé, et la table n'en cite aucun autre`, () => {
            const cites = new Set(Object.values(collectifs_tiers_1.PANOPLIES_TIERS[ref]).flatMap((p) => (p ?? []).map((r) => r.collectif)));
            expect([...cites].sort()).toEqual(Object.keys(attendus[ref]).sort());
            for (const [numero, intitule] of Object.entries(attendus[ref])) {
                expect(semis[ref]).toMatch(new RegExp(`'${numero}',\\s*'${intitule}'`));
            }
        });
    }
    it('le principal est le premier rôle de chaque panoplie, et c’est le collectif du type', () => {
        for (const ref of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            for (const [type, panoplie] of Object.entries(collectifs_tiers_1.PANOPLIES_TIERS[ref])) {
                expect(panoplie?.[0]).toMatchObject({ role: 'PRINCIPAL', collectif: collectifs_tiers_1.COLLECTIFS_TIERS[ref][type] });
            }
        }
    });
});
describe('numéro au même rang que le principal', () => {
    it('prend le rang s’il est libre, sinon le premier numéro libre', () => {
        expect((0, collectifs_tiers_1.numeroIndividuelAligne)('4181', 8, 5, ['41810000'])).toBe('41810005');
        expect((0, collectifs_tiers_1.numeroIndividuelAligne)('4181', 8, 5, ['41810000', '41810005'])).toBe('41810001');
        expect((0, collectifs_tiers_1.numeroIndividuelAligne)('4181', 8, null, ['41810000'])).toBe('41810001');
    });
    it('lit le rang par la valeur, quelle que soit la largeur de la racine', () => {
        expect((0, collectifs_tiers_1.rangSousRacine)('41100012', '411')).toBe(12);
        expect((0, collectifs_tiers_1.numeroIndividuelAligne)('4181', 8, 12, [])).toBe('41810012');
        expect((0, collectifs_tiers_1.rangSousRacine)('41100000', '411')).toBeNull();
        expect((0, collectifs_tiers_1.rangSousRacine)('47110003', '411')).toBeNull();
    });
});
describe('le numéro choisi pour le compte principal', () => {
    it('admis · des chiffres, sous la racine, à la longueur du dossier, distinct du collectif', () => {
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('40110250', '40110000', 8, client_1.Referentiel.SYSCOHADA)).toBeNull();
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('4120000001', '41200000', 10, client_1.Referentiel.SYCEBNL)).toBeNull();
    });
    it('chaque refus cite le texte de SON référentiel, jamais celui de l’autre', () => {
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('4011AB01', '40110000', 8, client_1.Referentiel.SYSCOHADA)).toMatch(/AUDCIF art\. 18 et Titre VII/);
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('412AB001', '41200000', 8, client_1.Referentiel.SYCEBNL)).toMatch(/SYCEBNL, Partie 2 ch\. 2, section 1/);
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('412AB001', '41200000', 8, client_1.Referentiel.SYCEBNL)).not.toMatch(/AUDCIF/);
    });
    it('refusé · hors racine, mauvaise longueur, zéros seuls après la racine', () => {
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('41110001', '40110000', 8, client_1.Referentiel.SYSCOHADA)).toMatch(/ne commence pas par 4011/);
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('4011001', '40110000', 8, client_1.Referentiel.SYSCOHADA)).toMatch(/compte 7 chiffres/);
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('4011000000', '40110000', 10, client_1.Referentiel.SYSCOHADA)).toMatch(/ne se distingue pas/);
        expect((0, collectifs_tiers_1.motifRefusNumeroChoisi)('', '40110000', 8, client_1.Referentiel.SYSCOHADA)).toMatch(/que des chiffres/);
    });
});
//# sourceMappingURL=collectifs-tiers.spec.js.map