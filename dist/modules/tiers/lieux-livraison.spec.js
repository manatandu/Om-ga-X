"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lieux_livraison_1 = require("./lieux-livraison");
const lieux_livraison_service_1 = require("./lieux-livraison.service");
describe('les règles du lieu', () => {
    it('un client seulement', () => {
        expect((0, lieux_livraison_1.motifRefusTypeLieu)('CLIENT')).toBeNull();
        for (const t of ['FOURNISSEUR', 'SALARIE', 'AUTRE', 'ADHERENT'])
            expect((0, lieux_livraison_1.motifRefusTypeLieu)(t)).toMatch(/se rattache à un client/);
    });
    it('un intitulé rangé, exigé, borné, unique chez le client sans égard à la casse', () => {
        expect((0, lieux_livraison_1.intituleDuLieu)('  Entrepôt   Limete ')).toBe('Entrepôt Limete');
        expect((0, lieux_livraison_1.motifRefusIntitule)('', [], null)).toMatch(/obligatoire/);
        expect((0, lieux_livraison_1.motifRefusIntitule)('x'.repeat(lieux_livraison_1.LONGUEUR_INTITULE_LIEU + 1), [], null)).toMatch(/au plus 35/);
        const autres = [{ id: 'a', intitule: 'Entrepôt' }];
        expect((0, lieux_livraison_1.motifRefusIntitule)('ENTREPÔT', autres, null)).toMatch(/déjà un lieu « Entrepôt »/);
        expect((0, lieux_livraison_1.motifRefusIntitule)('Entrepôt', autres, 'a')).toBeNull();
    });
    it('le premier lieu actif est principal d’office, jamais un lieu en sommeil', () => {
        expect((0, lieux_livraison_1.principalApres)({ demande: undefined, actuel: false, actifApres: true, autresLieuxActifs: 0 })).toEqual({ estPrincipal: true });
        expect((0, lieux_livraison_1.principalApres)({ demande: undefined, actuel: false, actifApres: true, autresLieuxActifs: 1 })).toEqual({ estPrincipal: false });
        expect((0, lieux_livraison_1.principalApres)({ demande: true, actuel: false, actifApres: false, autresLieuxActifs: 0 })).toEqual({ motif: expect.stringMatching(/en sommeil/) });
        expect((0, lieux_livraison_1.principalApres)({ demande: undefined, actuel: true, actifApres: false, autresLieuxActifs: 2 })).toEqual({ estPrincipal: false });
        expect((0, lieux_livraison_1.principalApres)({ demande: undefined, actuel: true, actifApres: true, autresLieuxActifs: 2 })).toEqual({ estPrincipal: true });
    });
    it('à la fusion, un intitulé déjà pris prend le code du doublon, dans la colonne', () => {
        expect((0, lieux_livraison_1.intituleRenomme)('Entrepôt', 'CLI-02')).toBe('Entrepôt · CLI-02');
        const long = (0, lieux_livraison_1.intituleRenomme)('x'.repeat(35), 'CLI-0002');
        expect(long).toHaveLength(lieux_livraison_1.LONGUEUR_INTITULE_LIEU);
        expect(long.endsWith(' · CLI-0002')).toBe(true);
    });
    it('à la fusion, un nom renommé déjà pris chez l’un ou l’autre client prend un rang (second tour, m5)', () => {
        const r = (0, lieux_livraison_1.renommagesALaFusion)(['Entrepôt', 'ENTREPÔT · CLI-02'], [
            { id: 'l1', intitule: 'entrepôt' },
            { id: 'l2', intitule: 'Siège' },
        ], 'CLI-02');
        expect([...r]).toEqual([['l1', 'entrepôt · CLI-02-2']]);
        const r2 = (0, lieux_livraison_1.renommagesALaFusion)(['Dépôt'], [
            { id: 'a', intitule: 'Dépôt' },
            { id: 'b', intitule: 'Dépôt · CLI-02' },
        ], 'CLI-02');
        expect(r2.get('a')).toBe('Dépôt · CLI-02-2');
        expect(r2.has('b')).toBe(false);
        const r3 = (0, lieux_livraison_1.renommagesALaFusion)(['Quai'], [{ id: 'x', intitule: 'Quai' }, { id: 'y', intitule: 'QUAI' }], 'D');
        expect(new Set([...r3.values()].map((n) => n.toLocaleLowerCase('fr'))).size).toBe(2);
    });
});
describe('le service · la marque principale posée dans la transaction', () => {
    function monter(type, existants) {
        const ordre = [];
        const retenus = (w) => existants.filter((l) => w.tenantId === 't' &&
            (l.tiersId ?? 'k') === (w.tiersId ?? l.tiersId ?? 'k') &&
            (w.NOT ? l.id !== w.NOT.id : true) &&
            (w.estActif === undefined || l.estActif === w.estActif) &&
            (w.intitule ? l.intitule.toLowerCase() === w.intitule.equals.toLowerCase() : true));
        const tx = {
            $executeRaw: jest.fn(async () => {
                ordre.push('verrou');
                return 1;
            }),
            lieuLivraison: {
                findMany: jest.fn(async ({ where }) => {
                    ordre.push('lit');
                    return retenus(where);
                }),
                count: jest.fn(async ({ where }) => retenus(where).length),
                findFirst: jest.fn(async ({ where }) => {
                    const l = existants.find((x) => x.id === where.id);
                    return l && where.tenantId === 't' ? { estPrincipal: false, tiersId: 'k', ...l } : null;
                }),
                updateMany: jest.fn(async () => {
                    ordre.push('retire');
                    return { count: 1 };
                }),
                create: jest.fn(async ({ data }) => {
                    ordre.push('cree');
                    return data;
                }),
                update: jest.fn(async ({ data }) => {
                    ordre.push('modifie');
                    return data;
                }),
            },
        };
        const prisma = {
            tiers: { findFirst: jest.fn(async ({ where }) => (where.tenantId === 't' ? { id: 'k', type } : null)) },
            lieuLivraison: {
                findMany: jest.fn(async () => existants),
                findFirst: jest.fn(async ({ where }) => {
                    const l = existants.find((x) => x.id === where.id);
                    return l && where.tenantId === 't' ? { estPrincipal: false, tiersId: 'k', ...l } : null;
                }),
            },
            $transaction: jest.fn((fn) => fn(tx)),
        };
        return { service: new lieux_livraison_service_1.LieuxLivraisonService(prisma), tx, ordre, prisma };
    }
    it('refuse un lieu chez un fournisseur, AVANT toute écriture', async () => {
        const { service, ordre } = monter('FOURNISSEUR', []);
        await expect(service.creer('t', 'k', { intitule: 'Dépôt' })).rejects.toThrow(/se rattache à un client/);
        expect(ordre).toEqual([]);
    });
    it('le premier lieu est principal, retire la marque des autres AVANT de créer ; les coordonnées vides s’effacent', async () => {
        const { service, ordre } = monter('CLIENT', []);
        const r = (await service.creer('t', 'k', { intitule: ' Siège ', ville: '  ', adresse: ' Av. du Port 4 ' }));
        expect(r).toEqual(expect.objectContaining({ intitule: 'Siège', estPrincipal: true, estActif: true, ville: null, adresse: 'Av. du Port 4', tenantId: 't', tiersId: 'k' }));
        expect(ordre).toEqual(['verrou', 'lit', 'retire', 'cree']);
    });
    it('un second lieu n’est pas principal sans le demander', async () => {
        const { service, ordre } = monter('CLIENT', [{ id: 'a', intitule: 'Siège', estActif: true }]);
        const r = (await service.creer('t', 'k', { intitule: 'Entrepôt' }));
        expect(r.estPrincipal).toBe(false);
        expect(ordre).toEqual(['verrou', 'lit', 'cree']);
    });
    it('l’unicité se juge par une requête ciblée, au-delà de toute tranche, sous le verrou du client', async () => {
        const lieux = Array.from({ length: 250 }, (_, i) => ({ id: `l${i}`, intitule: `Dépôt ${i}`, estActif: true }));
        const { service, tx, ordre } = monter('CLIENT', lieux);
        await expect(service.creer('t', 'k', { intitule: 'DÉPÔT 240' })).rejects.toThrow(/déjà un lieu « Dépôt 240 »/);
        expect(tx.lieuLivraison.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 't', tiersId: 'k', intitule: { equals: 'DÉPÔT 240', mode: 'insensitive' } }) }));
        expect(ordre).toEqual(['verrou', 'lit']);
    });
    it('la marque principale se juge sur les lieux actifs COMPTÉS dans la transaction', async () => {
        const lieux = Array.from({ length: 250 }, (_, i) => ({ id: `l${i}`, intitule: `Dépôt ${i}`, estActif: i !== 249 }));
        const { service } = monter('CLIENT', lieux);
        const r = (await service.creer('t', 'k', { intitule: 'Nouveau' }));
        expect(r.estPrincipal).toBe(false);
    });
    it('rendre principal un lieu retire la marque des autres ; le mettre en sommeil la lui retire', async () => {
        const lieux = [
            { id: 'a', intitule: 'Siège', estActif: true, estPrincipal: true },
            { id: 'b', intitule: 'Entrepôt', estActif: true },
        ];
        const deux = monter('CLIENT', lieux);
        await deux.service.modifier('t', 'b', { intitule: 'Entrepôt', estPrincipal: true });
        expect(deux.tx.lieuLivraison.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'k' }, data: { estPrincipal: false } });
        expect(deux.ordre).toEqual(['verrou', 'lit', 'retire', 'modifie']);
        const sommeil = monter('CLIENT', lieux);
        const r = (await sommeil.service.modifier('t', 'a', { intitule: 'Siège', estActif: false }));
        expect(r).toEqual(expect.objectContaining({ estActif: false, estPrincipal: false }));
    });
    it('un lieu d’un autre dossier est introuvable', async () => {
        const { service } = monter('CLIENT', [{ id: 'a', intitule: 'Siège', estActif: true }]);
        await expect(service.modifier('autre', 'a', { intitule: 'Siège' })).rejects.toThrow(/introuvable/);
    });
});
//# sourceMappingURL=lieux-livraison.spec.js.map