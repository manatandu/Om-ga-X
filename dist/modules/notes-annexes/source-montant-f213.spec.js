"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const note_annexe_service_1 = require("./note-annexe.service");
describe('rubriques de notes · le solde, et lui seul (audit final F213)', () => {
    it('le type d’une rubrique n’accepte plus de source de montant', () => {
        const rubrique = {
            libelle: 'Achats',
            comptes: ['60'],
            source: 'MOUVEMENT_DEBIT',
        };
        expect(rubrique.libelle).toBe('Achats');
    });
    it('le montant d’une rubrique est le solde de ses comptes, report compris', async () => {
        const lignes = [
            {
                compteId: 'id-52110000',
                numero: '52110000',
                intitule: 'Banque',
                classe: client_1.ClasseCompte.CLASSE_5,
                typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                reportDebit: 300_000,
                reportCredit: 0,
                mouvementDebit: 600_000,
                mouvementCredit: 415_000,
                totalDebit: 900_000,
                totalCredit: 415_000,
                solde: 485_000,
            },
        ];
        const ecriture = {
            balance: jest.fn(() => Promise.resolve({ lignes, totaux: { debit: 900_000, credit: 415_000 } })),
            virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
            mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
            mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
        };
        const exercice = {
            lister: jest.fn().mockResolvedValue([{ id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z') }]),
        };
        const prisma = {
            rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
            depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
            provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
            saisieNote: { findMany: jest.fn().mockResolvedValue([]) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateFin: new Date('2026-12-31T00:00:00Z') }) },
            ecriture: { findMany: jest.fn().mockResolvedValue([]) },
            ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        };
        const budget = {
            executionBudgetaire: jest.fn().mockRejectedValue(new etats_financiers_projet_budget_service_1.AucunPlanABudgetsException('aucun plan à budgets')),
        };
        const service = new note_annexe_service_1.NoteAnnexeService(ecriture, exercice, prisma, budget, new etats_financiers_service_1.EtatsFinanciersService(ecriture, exercice));
        const { notes } = await service.notesAssociations('t', 'e1');
        const banques = notes
            .find((n) => n.code === '13')
            .lignes.find((l) => l.libelle === 'Banques locales' && l.montantN > 0);
        expect(banques.montantN).toBe(485_000);
        expect(banques.comptes).toEqual([{ numero: '52110000', intitule: 'Banque', montant: 485_000 }]);
    });
});
//# sourceMappingURL=source-montant-f213.spec.js.map