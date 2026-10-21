"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ribs_tiers_1 = require("./ribs-tiers");
const ribs_tiers_service_1 = require("./ribs-tiers.service");
describe('RIB des tiers · ce qui permet de payer', () => {
    it('refuse un RIB sans banque, ou sans aucun numéro de compte', () => {
        expect((0, ribs_tiers_1.motifRefusRibTiers)({ banque: '', numeroCompte: '123' })).toMatch(/banque/);
        expect((0, ribs_tiers_1.motifRefusRibTiers)({ banque: 'Rawbank', iban: '', numeroCompte: '  ' })).toMatch(/ni numéro de compte/);
        expect((0, ribs_tiers_1.motifRefusRibTiers)({ banque: 'Rawbank', numeroCompte: '00012' })).toBeNull();
    });
    it("contrôle l'IBAN par sa clé ISO 13616, et seulement lui", () => {
        expect((0, ribs_tiers_1.motifRefusRibTiers)({ banque: 'B', iban: 'GB82 WEST 1234 5698 7654 32' })).toBeNull();
        expect((0, ribs_tiers_1.motifRefusRibTiers)({ banque: 'B', iban: 'GB83WEST12345698765432' })).toMatch(/IBAN invalide/);
        expect((0, ribs_tiers_1.motifRefusRibTiers)({ banque: 'B', codeBanque: 'x', numeroCompte: '??' })).toBeNull();
    });
    it("imprime l'IBAN par groupes de quatre, sinon le RIB national dans l'ordre de la fiche", () => {
        expect((0, ribs_tiers_1.coordonneesImprimees)({ iban: 'gb82west12345698765432', numeroCompte: '9' })).toBe('IBAN GB82 WEST 1234 5698 7654 32');
        expect((0, ribs_tiers_1.coordonneesImprimees)({ codeBanque: '00011', codeGuichet: '01000', numeroCompte: '1234567', cle: '42' })).toBe('00011 01000 1234567 42');
    });
});
describe("ordre de virement · le donneur d'ordre en monnaie de tenue", () => {
    it('admet le franc et un RIB sans devise, refuse toute autre monnaie', () => {
        expect((0, ribs_tiers_1.motifRefusDeviseDonneur)(null, 'BQ')).toBeNull();
        expect((0, ribs_tiers_1.motifRefusDeviseDonneur)('cdf', 'BQ')).toBeNull();
        expect((0, ribs_tiers_1.motifRefusDeviseDonneur)('USD', 'BQ')).toMatch(/USD.*CDF/);
    });
});
describe("ordre de virement · l'état « en attente d'impression »", () => {
    it('un ordre annulé ne se réimprime pas', () => {
        expect((0, ribs_tiers_1.motifRefusImpression)('A_IMPRIMER')).toBeNull();
        expect((0, ribs_tiers_1.motifRefusImpression)('IMPRIME')).toBeNull();
        expect((0, ribs_tiers_1.motifRefusImpression)('ANNULE')).not.toBeNull();
    });
    it("l'annulation exige un motif, et ne se fait qu'une fois", () => {
        expect((0, ribs_tiers_1.motifRefusAnnulation)('IMPRIME', '  ')).toMatch(/motif/);
        expect((0, ribs_tiers_1.motifRefusAnnulation)('ANNULE', 'rejet banque')).toMatch(/déjà annulé/);
        expect((0, ribs_tiers_1.motifRefusAnnulation)('IMPRIME', 'rejet banque')).toBeNull();
    });
});
describe('RibsTiersService · un seul principal par tiers', () => {
    function monter(existants) {
        const appels = [];
        const tx = {
            ribTiers: {
                updateMany: jest.fn(async () => {
                    appels.push('retire');
                    return { count: 1 };
                }),
                create: jest.fn(async ({ data }) => {
                    appels.push('cree');
                    return data;
                }),
            },
        };
        const prisma = {
            tiers: { findFirst: jest.fn(async () => ({ id: 'ti' })) },
            ribTiers: { count: jest.fn(async () => existants) },
            $transaction: jest.fn((fn) => fn(tx)),
        };
        return { service: new ribs_tiers_service_1.RibsTiersService(prisma), tx, appels };
    }
    it("le premier RIB d'un tiers est principal d'office", async () => {
        const { service } = monter(0);
        const r = (await service.creer('t', 'ti', { banque: 'Rawbank', numeroCompte: '1' }));
        expect(r.estPrincipal).toBe(true);
    });
    it("un second RIB n'est principal que s'il est coché, et retire alors la marque au précédent, AVANT de créer", async () => {
        const sans = monter(1);
        expect((await sans.service.creer('t', 'ti', { banque: 'B', numeroCompte: '2' })).estPrincipal).toBe(false);
        expect(sans.tx.ribTiers.updateMany).not.toHaveBeenCalled();
        const avec = monter(1);
        await avec.service.creer('t', 'ti', { banque: 'B', numeroCompte: '2', estPrincipal: true });
        expect(avec.tx.ribTiers.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'ti' }, data: { estPrincipal: false } });
        expect(avec.appels).toEqual(['retire', 'cree']);
    });
    it("normalise l'IBAN avant de le ranger, et refuse un RIB qui ne permet pas de payer", async () => {
        const { service } = monter(0);
        const r = (await service.creer('t', 'ti', { banque: 'B', iban: 'gb82 west 1234 5698 7654 32' }));
        expect(r.iban).toBe('GB82WEST12345698765432');
        await expect(service.creer('t', 'ti', { banque: 'B' })).rejects.toThrow(/ni numéro de compte/);
    });
});
describe('suppression du tiers · ses RIB partent avec lui, un ordre de virement le retient', () => {
    function monter(comptes) {
        let dansTransaction = false;
        const deleteMany = jest.fn(() => ({ dansTransaction }));
        const delegue = (nom) => ({
            count: jest.fn(async () => comptes[nom] ?? 0),
            deleteMany: nom === 'ribTiers' ? deleteMany : jest.fn(() => nom),
            delete: jest.fn(() => nom),
        });
        const prisma = new Proxy({
            tiers: { findFirst: jest.fn(async () => ({ id: 'ti', code: 'F001', comptesRattaches: [] })), delete: jest.fn(() => ({ dansTransaction })) },
            $transaction: jest.fn(async (fn) => {
                dansTransaction = true;
                try {
                    return await fn(prisma);
                }
                finally {
                    dansTransaction = false;
                }
            }),
        }, { get: (cible, nom) => (nom in cible ? cible[nom] : (cible[nom] = delegue(nom))) });
        const { TiersService } = require('./tiers.service');
        return { service: new TiersService(prisma), deleteMany, prisma };
    }
    it('un tiers qui porte des RIB se supprime, et ses RIB sont retirés dans la même transaction', async () => {
        const { service, deleteMany, prisma } = monter({ ribTiers: 2 });
        await expect(service.supprimer('t', 'ti')).resolves.toEqual({ supprime: true });
        expect(deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'ti' } });
        expect(deleteMany.mock.results[0].value).toEqual({ dansTransaction: true });
        const supprimerTiers = prisma.tiers.delete;
        expect(supprimerTiers.mock.results[0].value).toEqual({ dansTransaction: true });
        expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(supprimerTiers.mock.invocationCallOrder[0]);
    });
    it("un tiers payé par un ordre de virement ne se supprime pas", async () => {
        const { service } = monter({ ligneOrdreVirement: 1 });
        await expect(service.supprimer('t', 'ti')).rejects.toThrow(/ordres de virement/);
    });
});
//# sourceMappingURL=ribs-tiers.spec.js.map