"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extension_cloisonnement_1 = require("./extension-cloisonnement");
const contexte_cloisonnement_1 = require("./contexte-cloisonnement");
const contexte_audit_1 = require("../audit/contexte-audit");
const D = 'd-1';
const AUTRE = 'd-2';
const dansDossier = (tenantId, f) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'x@y.cd', tenantId }, f);
const base = () => ({ compte: { findFirst: jest.fn().mockResolvedValue({ tenantId: D }) } });
const ecrire = (operation, args, query = jest.fn(async () => ({ id: 'c-1' }))) => (0, extension_cloisonnement_1.garderCloisonnement)(base(), { model: 'Compte', operation, args, query });
describe('F240 · la ligne obtenue, et pas seulement la ligne visée', () => {
    it('update · un filtre borné ne laisse plus passer un tenantId étranger dans data', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await expect(dansDossier(D, () => ecrire('update', { where: { id: 'c-1', tenantId: D }, data: { tenantId: AUTRE } }, query))).rejects.toThrow(/Mise à jour refusée · Compte\.update ferait passer la ligne dans un autre dossier/);
        expect(query).not.toHaveBeenCalled();
    });
    it('update · la relecture qui rend le bon dossier ne suffit plus non plus', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await expect(dansDossier(D, () => ecrire('update', { where: { id: 'c-1' }, data: { intitule: 'X', tenantId: AUTRE } }, query))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
        expect(query).not.toHaveBeenCalled();
    });
    it('updateMany · une collection bornée ne se déverse pas chez un autre', async () => {
        const query = jest.fn(async () => ({ count: 40 }));
        await expect(dansDossier(D, () => ecrire('updateMany', { where: { tenantId: D }, data: { tenantId: AUTRE } }, query))).rejects.toThrow(/Compte\.updateMany ferait passer la ligne/);
        expect(query).not.toHaveBeenCalled();
    });
    it('upsert · le bloc `update` est lu comme le bloc `create`', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await expect(dansDossier(D, () => ecrire('upsert', { where: { id: 'c-1', tenantId: D }, create: { tenantId: D, numero: '1' }, update: { tenantId: AUTRE } }, query))).rejects.toThrow(/Compte\.upsert ferait passer la ligne/);
        expect(query).not.toHaveBeenCalled();
    });
    it('lit les formes qui nomment un dossier · `set` et `tenant.connect.id`', async () => {
        for (const data of [
            { tenantId: { set: AUTRE } },
            { tenant: { connect: { id: AUTRE } } },
            { tenant: { connect: { id: AUTRE, dossierCombinaisonId: 'x' } } },
        ]) {
            await expect(dansDossier(D, () => ecrire('update', { where: { id: 'c-1', tenantId: D }, data }))).rejects.toThrow(/ferait passer la ligne dans un autre dossier/);
        }
    });
    it('`null` est une cible · il sortirait la ligne de tout dossier', async () => {
        for (const data of [{ tenantId: null }, { tenantId: { set: null } }]) {
            await expect(dansDossier(D, () => ecrire('update', { where: { id: 'c-1', tenantId: D }, data }))).rejects.toThrow(/ferait passer la ligne dans un autre dossier/);
        }
    });
    it('refuse, sans deviner, une forme qui change le dossier sans le nommer', async () => {
        for (const data of [
            { tenant: { connect: { dossierCombinaisonId: 'x' } } },
            { tenant: { create: { raisonSociale: 'Écran' } } },
            { tenant: { connectOrCreate: { where: { id: AUTRE }, create: {} } } },
            { tenant: { disconnect: true } },
            { tenantId: { set: AUTRE, mode: 'insensitive' } },
            { tenant: 'd-2' },
        ]) {
            await expect(dansDossier(D, () => ecrire('update', { where: { id: 'c-1', tenantId: D }, data }))).rejects.toThrow(/sous une forme que la garde ne sait pas lire/);
        }
    });
});
describe('F240 · ce qui passait doit passer encore', () => {
    it('le tenantId de la session, posé dans data, passe · SimulationsService.modifier le fait', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await dansDossier(D, () => ecrire('update', { where: { id: 'c-1' }, data: { intitule: 'Caisse', tenantId: D } }, query));
        expect(query).toHaveBeenCalled();
    });
    it('une mise à jour qui ne touche pas au dossier passe, `update: {}` des semis compris', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await dansDossier(D, () => ecrire('update', { where: { id: 'c-1', tenantId: D }, data: { intitule: 'X' } }, query));
        await dansDossier(D, () => ecrire('upsert', { where: { id: 'c-1', tenantId: D }, create: { tenantId: D }, update: {} }, query));
        expect(query).toHaveBeenCalledTimes(2);
    });
    it('`tenant: { update }` ne déplace rien · il modifie le dossier déjà vérifié', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await dansDossier(D, () => ecrire('update', { where: { id: 'c-1', tenantId: D }, data: { tenant: { update: { nom: 'X' } } } }, query));
        expect(query).toHaveBeenCalled();
    });
    it('le périmètre du siège admet ses cellules déclarées, et elles seules', async () => {
        const query = jest.fn(async () => ({ count: 1 }));
        await dansDossier(D, () => (0, contexte_cloisonnement_1.perimetreDeGroupe)([D, 'cellule-a'], () => ecrire('updateMany', { where: { tenantId: D }, data: { tenantId: 'cellule-a' } }, query)));
        expect(query).toHaveBeenCalledTimes(1);
        await expect(dansDossier(D, () => (0, contexte_cloisonnement_1.perimetreDeGroupe)([D, 'cellule-a'], () => ecrire('updateMany', { where: { tenantId: D }, data: { tenantId: AUTRE } }, query)))).rejects.toBeInstanceOf(contexte_cloisonnement_1.CloisonnementViole);
        expect(query).toHaveBeenCalledTimes(1);
    });
    it('la sortie déclarée garde son comportement · elle ne regarde rien', async () => {
        const query = jest.fn(async () => ({ id: 'c-1' }));
        await dansDossier(D, () => (0, contexte_cloisonnement_1.horsCloisonnement)('console', () => ecrire('update', { where: { id: 'c-1' }, data: { tenantId: AUTRE } }, query)));
        expect(query).toHaveBeenCalled();
    });
});
//# sourceMappingURL=deplacement-par-mise-a-jour.spec.js.map