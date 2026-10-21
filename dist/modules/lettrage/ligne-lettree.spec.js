"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const reimputation_1 = require("../comptabilite/reimputation");
const ligne_lettree_1 = require("./ligne-lettree");
describe('F50 · la règle', () => {
    it('une ligne d’un groupe partiel est tenue, comme une ligne soldée', () => {
        expect((0, ligne_lettree_1.estTenueParUnLettrage)({ lettre: null, lettrageId: 'g1' })).toBe(true);
        expect((0, ligne_lettree_1.estTenueParUnLettrage)({ lettre: 'A', lettrageId: 'g1' })).toBe(true);
        expect((0, ligne_lettree_1.estTenueParUnLettrage)({ lettre: null, lettrageId: null })).toBe(false);
        expect((0, ligne_lettree_1.estTenueParUnLettrage)({ lettre: null })).toBe(false);
        expect((0, ligne_lettree_1.designationLettrage)({ lettre: null, lettrageId: 'g1' })).toBe('lettrage partiel');
        expect((0, ligne_lettree_1.designationLettrage)({ lettre: 'AB', lettrageId: 'g1' })).toBe('AB');
    });
});
const exerciceOuvert = { statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const lignesPartielles = [
    { id: 'l1', compteId: 'c401', debit: new client_1.Prisma.Decimal(0), credit: new client_1.Prisma.Decimal(1000), lettre: null, lettrageId: 'g1', rapprochementId: null, ventilations: [] },
    { id: 'l2', compteId: 'c601', debit: new client_1.Prisma.Decimal(1000), credit: new client_1.Prisma.Decimal(0), lettre: null, lettrageId: null, rapprochementId: null, ventilations: [] },
];
function service(statut) {
    const ecriture = {
        id: 'e1',
        tenantId: 't1',
        numeroPiece: 12,
        statut,
        date: new Date('2026-05-10'),
        journalId: 'j1',
        exerciceId: 'ex',
        exercice: exerciceOuvert,
        journal: { id: 'j1', code: 'ACH' },
        libelle: 'Facture',
        reference: null,
        estGenereeParCloture: false,
        corrigeEcritureId: null,
        correction: null,
        immobilisationsAcquisition: [],
        immobilisationSortie: null,
        dotationAmortissement: null,
        lignes: lignesPartielles,
    };
    const tx = {
        ecriture: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
        ligneEcriture: { deleteMany: jest.fn() },
    };
    const prisma = new Proxy({
        ecriture: { findFirst: jest.fn().mockResolvedValue(ecriture), delete: jest.fn(), deleteMany: jest.fn() },
        $transaction: jest.fn((f) => f(tx)),
    }, { get: (cible, cle) => cible[cle] ?? { count: jest.fn().mockResolvedValue(0) } });
    const journal = { trouver: jest.fn(), prochainNumeroPiece: jest.fn().mockResolvedValue(13) };
    const exercice = { verifierEcritureAutorisee: jest.fn().mockResolvedValue(undefined) };
    const s = new ecriture_service_1.EcritureService(prisma, journal, exercice, {});
    return { s, tx, prisma };
}
describe('F50 · les quatre gestes refusent une ligne d’un groupe partiel', () => {
    it('modifier', async () => {
        const { s, tx } = service(client_1.StatutEcriture.BROUILLARD);
        await expect(s.modifier('t1', 'e1', { libelle: 'x' })).rejects.toThrow(/lettrée \(lettrage partiel\)/);
        expect(tx.ecriture.update).not.toHaveBeenCalled();
    });
    it('supprimer', async () => {
        const { s, tx, prisma } = service(client_1.StatutEcriture.BROUILLARD);
        await expect(s.supprimer('t1', 'e1')).rejects.toThrow(/lettrée \(lettrage partiel\)/);
        expect(tx.ecriture.delete).not.toHaveBeenCalled();
        expect(prisma.ecriture.delete).not.toHaveBeenCalled();
    });
    it('corriger par inscription en négatif', async () => {
        const { s, tx } = service(client_1.StatutEcriture.VALIDEE);
        await expect(s.corrigerParInscriptionEnNegatif('t1', 'u', 'e1', { motif: 'erreur' })).rejects.toThrow(/1 ligne\(s\) de cette écriture sont lettrées \(lettrage partiel\)/);
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
    it('réimputer', () => {
        const ligne = {
            id: 'l1',
            compteId: 'c401',
            compteNumero: '40110000',
            debit: 0,
            credit: 1000,
            lettre: null,
            lettrageId: 'g1',
            rapprochementId: null,
            tauxTvaId: null,
            statut: 'VALIDEE',
            exerciceClos: false,
            estGenereeParCloture: false,
            tenueParImmobilisation: false,
        };
        expect((0, reimputation_1.motifRefusLigne)(ligne, 'c408')).toMatch(/est lettrée \(lettrage partiel\)/);
        expect((0, reimputation_1.motifRefusLigne)({ ...ligne, lettrageId: null }, 'c408')).toBeNull();
    });
});
//# sourceMappingURL=ligne-lettree.spec.js.map