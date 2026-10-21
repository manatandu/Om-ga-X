"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const avances_rubriques_service_1 = require("./avances-rubriques.service");
const modeles_bulletin_1 = require("./modeles-bulletin");
const RUBRIQUES = [
    { id: 'r-prime', nature: 'PRIME', actif: true },
    { id: 'r-vieille', nature: 'PRIME', actif: false },
];
const ligne = (l = {}) => ({ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', ...l });
describe('motifRefusModele', () => {
    it('accepte un modèle sans montant, et un modèle avec montants', () => {
        expect((0, modeles_bulletin_1.motifRefusModele)({ nom: 'Employé', deviseStipulation: 'CDF', lignes: [ligne()] }, RUBRIQUES)).toBeNull();
        expect((0, modeles_bulletin_1.motifRefusModele)({ nom: 'Cadre', deviseStipulation: 'USD', lignes: [ligne({ montant: 1250.5 })] }, RUBRIQUES)).toBeNull();
    });
    it.each([
        [{ nom: ' ', deviseStipulation: 'CDF', lignes: [ligne()] }, /nom du modèle/],
        [{ nom: 'X', deviseStipulation: 'EUR', lignes: [ligne()] }, /CDF ou USD/],
        [{ nom: 'X', deviseStipulation: 'CDF', lignes: [] }, /au moins un élément/],
        [{ nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ libelle: '' })] }, /libellé/],
        [{ nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ nature: 'INVENTEE' })] }, /nature inconnue/],
        [{ nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ montant: -1 })] }, /positif/],
        [{ nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ montant: 1.234 })] }, /deux décimales/],
        [{ nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ rubriqueId: 'ailleurs' })] }, /rubrique introuvable/],
        [{ nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ rubriqueId: 'r-vieille' })] }, /désactivée/],
    ])('refuse %j', (m, motif) => {
        expect((0, modeles_bulletin_1.motifRefusModele)(m, RUBRIQUES)).toMatch(motif);
    });
    it.each([19.99, 1.1, 1234.1, 0.07, 1_000_000.01, 5e21])('accepte %p, qui a deux décimales au plus', (montant) => {
        expect((0, modeles_bulletin_1.motifRefusModele)({ nom: 'X', deviseStipulation: 'USD', lignes: [ligne({ montant })] }, RUBRIQUES)).toBeNull();
    });
    it.each([0.001, 19.999, 1e-7])('refuse %p, qui en a plus de deux', (montant) => {
        expect((0, modeles_bulletin_1.motifRefusModele)({ nom: 'X', deviseStipulation: 'USD', lignes: [ligne({ montant })] }, RUBRIQUES)).toMatch(/deux décimales/);
    });
    it('borne le nombre d’éléments', () => {
        const lignes = Array.from({ length: modeles_bulletin_1.MAX_LIGNES_MODELE + 1 }, () => ligne());
        expect((0, modeles_bulletin_1.motifRefusModele)({ nom: 'X', deviseStipulation: 'CDF', lignes }, RUBRIQUES)).toMatch(/au plus/);
    });
    it('accepte les cinq exclusions de l’article 7 comme éléments du catalogue', () => {
        expect((0, modeles_bulletin_1.motifRefusModele)({ nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ nature: 'INDEMNITE_DE_TRANSPORT', libelle: 'Transport' })] }, RUBRIQUES)).toBeNull();
    });
});
describe('normaliserLignes · la rubrique décide de la nature', () => {
    it('remplace la nature envoyée par celle de la rubrique', () => {
        const [l] = (0, modeles_bulletin_1.normaliserLignes)([ligne({ nature: 'INDEMNITE_DE_TRANSPORT', rubriqueId: 'r-prime', libelle: ' Prime ' })], RUBRIQUES);
        expect(l).toEqual({ nature: 'PRIME', libelle: 'Prime', rubriqueId: 'r-prime', montant: null });
    });
});
describe('le service lit les rubriques de CE dossier', () => {
    it('refuse une rubrique d’un autre dossier, et n’écrit rien', async () => {
        const create = jest.fn();
        const findMany = jest.fn().mockResolvedValue([]);
        const s = new avances_rubriques_service_1.AvancesRubriquesService({ rubriquePaie: { findMany }, modeleBulletin: { create } });
        await expect(s.creerModele('t1', 'a@b.cd', { nom: 'X', deviseStipulation: 'CDF', lignes: [ligne({ rubriqueId: 'r-prime' })] })).rejects.toThrow(/rubrique introuvable/);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' } }));
        expect(create).not.toHaveBeenCalled();
    });
    it('enregistre les lignes normalisées', async () => {
        const create = jest.fn().mockImplementation(async ({ data }) => data);
        const s = new avances_rubriques_service_1.AvancesRubriquesService({
            rubriquePaie: { findMany: jest.fn().mockResolvedValue(RUBRIQUES) },
            modeleBulletin: { create },
        });
        await s.creerModele('t1', 'a@b.cd', { nom: ' Employé ', deviseStipulation: 'CDF', lignes: [ligne({ nature: 'COMMISSION', rubriqueId: 'r-prime' })] });
        expect(create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', nom: 'Employé', lignes: [{ nature: 'PRIME', rubriqueId: 'r-prime' }] });
    });
});
//# sourceMappingURL=modeles-bulletin.spec.js.map