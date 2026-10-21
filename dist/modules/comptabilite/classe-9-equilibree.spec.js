"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const classe_9_equilibree_1 = require("./classe-9-equilibree");
const ecriture_service_1 = require("./ecriture.service");
describe('classe 9 · l’équilibre des lignes 90 et 91 entre elles', () => {
    it('un bloc hors bilan équilibré passe, même à côté d’un bloc de bilan', () => {
        expect((0, classe_9_equilibree_1.ecartClasse9)([
            { numero: '90220000', debit: 1_000 },
            { numero: '91220000', credit: 1_000 },
            { numero: '52110000', debit: 400 },
            { numero: '16200000', credit: 400 },
        ])).toBe(0);
    });
    it('D 904 / C 571 est refusé · la contrepartie d’un 90 n’est jamais un compte de bilan', () => {
        const ecart = (0, classe_9_equilibree_1.ecartClasse9)([
            { numero: '90400000', debit: 500 },
            { numero: '57100000', credit: 500 },
        ]);
        expect(ecart).toBe(500);
        expect((0, classe_9_equilibree_1.motifRefusClasse9)(client_1.Referentiel.SYCEBNL, ecart)).toContain('ne doi[vent] pas impacter le bilan');
        expect((0, classe_9_equilibree_1.motifRefusClasse9)(client_1.Referentiel.SYSCOHADA, ecart)).toContain('911 à 914');
    });
    it('les comptes 92 à 99 (analytique) ne sont pas visés', () => {
        expect((0, classe_9_equilibree_1.ecartClasse9)([{ numero: '92100000', debit: 10 }, { numero: '60100000', credit: 10 }])).toBe(0);
    });
});
describe('classe 9 · le câblage dans les contrôles d’entrée', () => {
    function service() {
        const prisma = {
            exercice: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'ex',
                    statut: client_1.StatutExercice.OUVERT,
                    dateDebut: new Date('2026-01-01'),
                    dateFin: new Date('2026-12-31'),
                }),
            },
            compte: {
                findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.tenantId === 't' ? where.id.in.map((id) => ({ id, numero: id, typeCompte: client_1.TypeCompteDetailTotal.DETAIL })) : [])),
            },
            tenant: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 't' ? { referentiel: client_1.Referentiel.SYCEBNL } : null)),
            },
        };
        const journal = { trouver: jest.fn().mockResolvedValue({ id: 'j', code: 'OD', estActif: true }) };
        const exercice = { cloturesApplicables: jest.fn().mockResolvedValue([]), verifierEcritureAutorisee: jest.fn() };
        const analytique = { verifierVentilationObligatoire: jest.fn(), verifierSectionsVentilees: jest.fn() };
        return new ecriture_service_1.EcritureService(prisma, journal, exercice, analytique);
    }
    const piece = (lignes) => ({
        exerciceId: 'ex',
        journalId: 'j',
        date: new Date('2026-06-30'),
        lignes,
        exigerVentilationObligatoire: false,
    });
    it('refuse à l’entrée la pièce qui solde un 90 contre la caisse', async () => {
        await expect(service().controlesDEntree('t', piece([{ compteId: '90400000', debit: 500 }, { compteId: '57100000', credit: 500 }]))).rejects.toThrow(/comptes 90 et 91 ne s'équilibrent pas/);
    });
    it('laisse passer la pièce du Guide, 904 contre 914', async () => {
        await expect(service().controlesDEntree('t', piece([{ compteId: '90400000', debit: 500 }, { compteId: '91400000', credit: 500 }]))).resolves.toBeDefined();
    });
});
//# sourceMappingURL=classe-9-equilibree.spec.js.map