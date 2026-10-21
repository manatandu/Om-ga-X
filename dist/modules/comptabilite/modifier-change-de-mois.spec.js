"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ecriture_service_1 = require("./ecriture.service");
const DETENTEURS = [
    'immobilisation', 'dotationAmortissement', 'depreciationImmobilisation', 'reclassementImmobilisation', 'reevaluation',
    'regularisation', 'echeanceAbonnement', 'liquidationTva', 'donation', 'affectationResultat', 'executionEngagement',
    'mouvementStock', 'bulletinPaie', 'amortissementDerogatoire', 'ligneOrdreVirement', 'consignation', 'ecartInventaire', 'clotureLocationAcquisition', 'repriseSubventionImmobilisation', 'reductionSubventionImmobilisation', 'revisionPlanAmortissement', 'coutEmpruntIncorpore', 'reevaluationBilan', 'repriseProvisionReevaluation', 'mouvementDemantelement', 'creanceDouteuse', 'ajustementCreanceDouteuse', 'mouvementCreanceDouteuse', 'recuperationTvaCreance', 'declarationDeviseANouveau', 'constatImpotResultat', 'virementFonds', 'paiementSalaires', 'annulationTraitementImmobilisation',
];
const exerciceOuvert = { statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function monde(numerotation, exercice = exerciceOuvert) {
    const journal = { id: 'j1', code: 'ACH', numerotation, estActif: true };
    const tx = {
        ligneEcriture: { deleteMany: jest.fn() },
        ecriture: { update: jest.fn().mockResolvedValue({ id: 'e1' }), findFirst: jest.fn().mockResolvedValue({ exerciceId: 'ex1' }) },
        pieceJointeEcriture: { count: jest.fn().mockResolvedValue(0) },
        exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
    };
    const prisma = {
        ecriture: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'e1',
                numeroPiece: 4,
                statut: 'BROUILLARD',
                date: new Date('2026-05-10'),
                journalId: 'j1',
                exerciceId: 'ex1',
                exercice,
                journal,
                lignes: [],
            }),
        },
        exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
        ...Object.fromEntries(DETENTEURS.map((m) => [m, { count: jest.fn().mockResolvedValue(0) }])),
        facture: { findFirst: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn().mockImplementation((f) => f(tx)),
    };
    const journaux = {
        trouver: jest.fn().mockResolvedValue(journal),
        prochainNumeroPiece: jest.fn().mockResolvedValue(7),
    };
    const svc = new ecriture_service_1.EcritureService(prisma, journaux, { verifierEcritureAutorisee: jest.fn() }, { verifierVentilationObligatoire: jest.fn() });
    return { svc, journaux, tx, journal };
}
describe('F58 · une pièce mensuelle déplacée prend le numéro de son nouveau mois', () => {
    it('passée de mai à juin, elle reçoit le numéro suivant de juin, dans la transaction', async () => {
        const { svc, journaux, tx, journal } = monde('MENSUELLE');
        await svc.modifier('t1', 'e1', { date: '2026-06-02' });
        expect(journaux.prochainNumeroPiece).toHaveBeenCalledWith('t1', journal, 'ex1', new Date('2026-06-02'), tx);
        expect(tx.ecriture.update.mock.calls[0][0].data).toMatchObject({ numeroPiece: 7, date: new Date('2026-06-02') });
    });
    it('dans le même mois, elle garde son numéro', async () => {
        const { svc, journaux, tx } = monde('MENSUELLE');
        await svc.modifier('t1', 'e1', { date: '2026-05-28' });
        expect(journaux.prochainNumeroPiece).not.toHaveBeenCalled();
        expect(tx.ecriture.update.mock.calls[0][0].data).not.toHaveProperty('numeroPiece');
    });
    it('le même mois d’une autre année n’est pas le même mois', async () => {
        const long = { statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2027-06-30') };
        const { svc, journaux, tx } = monde('MENSUELLE', long);
        await svc.modifier('t1', 'e1', { date: '2027-05-10' });
        expect(journaux.prochainNumeroPiece.mock.calls[0][3]).toEqual(new Date('2027-05-10'));
        expect(tx.ecriture.update.mock.calls[0][0].data).toMatchObject({ numeroPiece: 7 });
    });
    it('un journal numéroté sur l’exercice garde son numéro d’un mois à l’autre', async () => {
        const { svc, journaux, tx } = monde('CONTINUE_JOURNAL');
        await svc.modifier('t1', 'e1', { date: '2026-06-02' });
        expect(journaux.prochainNumeroPiece).not.toHaveBeenCalled();
        expect(tx.ecriture.update.mock.calls[0][0].data).not.toHaveProperty('numeroPiece');
    });
});
//# sourceMappingURL=modifier-change-de-mois.spec.js.map