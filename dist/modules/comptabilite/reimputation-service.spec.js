"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
function ligne(id, statut, extra = {}) {
    return {
        id,
        ecritureId: `e-${id}`,
        compteId: 'c601',
        compte: { numero: '60110000' },
        libelle: 'Achat',
        debit: 1000,
        credit: 0,
        lettre: null,
        rapprochementId: null,
        tauxTvaId: null,
        dateEcheance: null,
        dateVersement: null,
        ventilations: [{ sectionId: 's1', planId: 'p1', debit: 1000, credit: 0 }],
        ecriture: {
            id: `e-${id}`,
            statut,
            exerciceId: 'ex',
            journalId: 'j',
            journal: { code: 'ACH' },
            date: new Date('2026-03-15'),
            libelle: 'Facture FA-1',
            reference: 'FA-1',
            estGenereeParCloture: false,
            exercice: { statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
            immobilisationsAcquisition: [],
            immobilisationSortie: null,
            dotationAmortissement: null,
        },
        ...extra,
    };
}
const MODELES_DETENTEURS = [
    'immobilisation', 'dotationAmortissement', 'depreciationImmobilisation', 'reclassementImmobilisation', 'reevaluation', 'regularisation',
    'echeanceAbonnement', 'liquidationTva', 'donation', 'affectationResultat', 'executionEngagement',
    'mouvementStock', 'bulletinPaie', 'amortissementDerogatoire', 'ligneOrdreVirement', 'consignation',
    'ecartInventaire', 'clotureLocationAcquisition', 'repriseSubventionImmobilisation', 'reductionSubventionImmobilisation', 'revisionPlanAmortissement', 'coutEmpruntIncorpore', 'reevaluationBilan', 'repriseProvisionReevaluation', 'mouvementDemantelement', 'creanceDouteuse', 'ajustementCreanceDouteuse', 'mouvementCreanceDouteuse', 'recuperationTvaCreance', 'declarationDeviseANouveau', 'constatImpotResultat', 'virementFonds', 'paiementSalaires', 'annulationTraitementImmobilisation',
];
function service(lignes, options = {}) {
    const tx = {
        ligneEcriture: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        ecriture: { create: jest.fn().mockResolvedValue({ numeroPiece: 7 }) },
    };
    const prisma = {
        compte: {
            findFirst: jest.fn().mockResolvedValue({ id: 'c604', numero: '60410000', typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        $transaction: jest.fn((fn) => fn(tx)),
        ...Object.fromEntries(MODELES_DETENTEURS.map((m) => [m, { count: jest.fn().mockResolvedValue(options.tenus?.[m] ?? 0) }])),
    };
    const journal = { prochainNumeroPiece: jest.fn().mockResolvedValue(7) };
    const exercice = {
        verifierEcritureAutorisee: jest.fn().mockImplementation(async (_t, journalId, date) => options.verrou?.(journalId, date)),
    };
    const s = new ecriture_service_1.EcritureService(prisma, journal, exercice, {});
    return { s, tx, prisma, exercice };
}
describe('Réimputation · le service', () => {
    it('change le compte au brouillard, et passe négatif + exact pour une ligne validée, analytique comprise', async () => {
        const { s, tx } = service([ligne('b', client_1.StatutEcriture.BROUILLARD), ligne('v', client_1.StatutEcriture.VALIDEE)]);
        const r = await s.reimputer('t', 'u', { ligneIds: ['b', 'v'], compteCibleId: 'c604', date: '2026-06-30', motif: 'Mauvais compte' });
        expect(tx.ligneEcriture.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['b'] } }, data: { compteId: 'c604' } });
        expect(tx.ligneEcriture.updateMany).toHaveBeenCalledTimes(1);
        const data = tx.ecriture.create.mock.calls[0][0].data;
        expect(data.motifCorrection).toBe('Mauvais compte');
        expect(data.journalId).toBe('j');
        const [neg, exact] = data.lignes.create;
        expect(neg).toMatchObject({ compteId: 'c601', debit: -1000 });
        expect(exact).toMatchObject({ compteId: 'c604', debit: 1000 });
        expect(neg.ventilations.create[0]).toMatchObject({ sectionId: 's1', debit: -1000 });
        expect(exact.ventilations.create[0]).toMatchObject({ sectionId: 's1', debit: 1000 });
        expect(r).toEqual({ auBrouillard: 1, validees: 1, ecrituresPassees: [{ numeroPiece: 7, journal: 'ACH' }] });
    });
    it('une pièce VALIDÉE avant la règle dans un journal de situation · refus nommé avec l’issue, rien d’écrit (ligne sage-l1, relecture m5)', async () => {
        const v = ligne('v', client_1.StatutEcriture.VALIDEE);
        v.ecriture.journal = { code: 'SIT', type: 'SITUATION' };
        const { s, tx } = service([ligne('b', client_1.StatutEcriture.BROUILLARD), v]);
        await expect(s.reimputer('t', 'u', { ligneIds: ['b', 'v'], compteCibleId: 'c604', date: '2026-06-30', motif: 'Mauvais compte' })).rejects.toThrow(/SIT n° · a été validée dans un journal de situation.*journal ordinaire/);
        expect(tx.ligneEcriture.updateMany).not.toHaveBeenCalled();
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
    it('recopie la devise sur l’inscription en négatif et sur l’enregistrement exact', async () => {
        const { s, tx } = service([
            ligne('v', client_1.StatutEcriture.VALIDEE, { deviseId: 'usd', montantDevise: 1000, coursApplique: 2800 }),
        ]);
        await s.reimputer('t', 'u', { ligneIds: ['v'], compteCibleId: 'c604', date: '2026-06-30', motif: 'Mauvais compte' });
        const [neg, exact] = tx.ecriture.create.mock.calls[0][0].data.lignes.create;
        expect([neg, exact].map((l) => [l.deviseId, l.montantDevise, l.coursApplique])).toEqual([
            ['usd', 1000, 2800],
            ['usd', 1000, 2800],
        ]);
    });
    it('pose un délai de transaction à la mesure des lignes réimputées', async () => {
        const { s, prisma } = service([ligne('v', client_1.StatutEcriture.VALIDEE), ligne('w', client_1.StatutEcriture.VALIDEE)]);
        await s.reimputer('t', 'u', { ligneIds: ['v', 'w'], compteCibleId: 'c604', date: '2026-06-30', motif: 'Mauvais compte' });
        const options = prisma.$transaction.mock.calls[0][1];
        expect(options?.timeout ?? 0).toBeGreaterThan(5_000);
    });
    it('refuse une ligne d’un lettrage partiel, et n’écrit rien', async () => {
        const { s, tx } = service([ligne('v', client_1.StatutEcriture.VALIDEE, { lettrageId: 'g1' })]);
        await expect(s.reimputer('t', 'u', { ligneIds: ['v'], compteCibleId: 'c604', motif: 'x' })).rejects.toThrow(/lettrée \(lettrage partiel\)/);
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
    it("n'écrit RIEN si une seule ligne est refusée", async () => {
        const { s, tx } = service([ligne('b', client_1.StatutEcriture.BROUILLARD), ligne('v', client_1.StatutEcriture.VALIDEE, { lettre: 'AA' })]);
        await expect(s.reimputer('t', 'u', { ligneIds: ['b', 'v'], compteCibleId: 'c604', motif: 'x' })).rejects.toThrow(/lettrée/);
        expect(tx.ligneEcriture.updateMany).not.toHaveBeenCalled();
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
    it.each([client_1.StatutEcriture.BROUILLARD, client_1.StatutEcriture.VALIDEE])("refuse une ligne %s dont l'écriture est tenue par un module, et n'écrit rien", async (statut) => {
        const { s, tx, prisma } = service([ligne('x', statut)], { tenus: { liquidationTva: 1 } });
        await expect(s.reimputer('t', 'u', { ligneIds: ['x'], compteCibleId: 'c604', date: '2026-06-30', motif: 'x' })).rejects.toThrow(/liquidation de TVA · elle ne se réimpute pas/);
        expect(tx.ligneEcriture.updateMany).not.toHaveBeenCalled();
        expect(tx.ecriture.create).not.toHaveBeenCalled();
        expect(prisma.liquidationTva.count).toHaveBeenCalledWith({
            where: { tenantId: 't', ecritureId: { in: ['e-x'] } },
        });
    });
    it('refuse une ligne au brouillard datée dans une période close, et n\'écrit rien', async () => {
        const { s, tx, exercice } = service([ligne('b', client_1.StatutEcriture.BROUILLARD)], {
            verrou: (_j, date) => {
                if (date <= new Date('2026-03-31'))
                    throw new Error('période close');
            },
        });
        await expect(s.reimputer('t', 'u', { ligneIds: ['b'], compteCibleId: 'c604', motif: 'x' })).rejects.toThrow(/période close/);
        expect(exercice.verifierEcritureAutorisee).toHaveBeenCalledWith('t', 'j', new Date('2026-03-15'));
        expect(tx.ligneEcriture.updateMany).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=reimputation-service.spec.js.map