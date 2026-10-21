"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const EXERCICE = { id: 'ex', statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function monter(options = {}) {
    let marqueur = {
        id: 'liq1',
        ecritureId: 'ecr1',
        dateDebut: new Date('2026-03-01'),
        dateFin: new Date('2026-03-31'),
    };
    const zero = () => ({ count: jest.fn().mockResolvedValue(0) });
    const ordre = [];
    const prisma = {
        ecriture: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ecr1', tenantId: 't1', statut: 'BROUILLARD', exercice: EXERCICE, lignes: [], journal: {}, date: new Date('2026-03-31'),
            }),
            delete: jest.fn().mockImplementation(async () => ordre.push('ecriture')),
            deleteMany: jest.fn().mockImplementation(async () => {
                ordre.push('ecriture');
                return { count: 1 };
            }),
        },
        ligneEcriture: { deleteMany: jest.fn().mockImplementation(async () => ordre.push('lignes')) },
        $queryRaw: jest.fn().mockResolvedValue([]),
        pieceJointeEcriture: zero(),
        liquidationTva: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockImplementation(async ({ where } = {}) => where?.dateDebut?.gt ? (options.posterieure && options.posterieure.dateDebut > where.dateDebut.gt ? options.posterieure : null) : marqueur),
            count: jest.fn().mockImplementation(async () => (marqueur ? 1 : 0)),
            delete: jest.fn().mockImplementation(async () => {
                ordre.push('marqueur');
                marqueur = null;
            }),
        },
        immobilisation: zero(),
        dotationAmortissement: zero(),
        depreciationImmobilisation: zero(),
        reclassementImmobilisation: zero(),
        reevaluation: zero(),
        regularisation: zero(),
        echeanceAbonnement: zero(),
        donation: { count: jest.fn().mockResolvedValue(options.autreDetenteur ? 1 : 0) },
        affectationResultat: zero(),
        executionEngagement: zero(),
        mouvementStock: zero(),
        ecartInventaire: zero(),
        clotureLocationAcquisition: zero(),
        repriseSubventionImmobilisation: zero(),
        reductionSubventionImmobilisation: zero(),
        revisionPlanAmortissement: zero(),
        coutEmpruntIncorpore: zero(),
        reevaluationBilan: zero(),
        repriseProvisionReevaluation: zero(),
        mouvementDemantelement: zero(),
        annulationTraitementImmobilisation: zero(),
        creanceDouteuse: zero(),
        ajustementCreanceDouteuse: zero(),
        mouvementCreanceDouteuse: zero(),
        recuperationTvaCreance: zero(),
        virementFonds: zero(),
        paiementSalaires: zero(),
        declarationDeviseANouveau: zero(),
        constatImpotResultat: zero(),
        consignation: zero(),
        bulletinPaie: zero(),
        ligneOrdreVirement: zero(),
        amortissementDerogatoire: zero(),
    };
    prisma.$transaction = jest.fn().mockImplementation((f) => f(prisma));
    const ecritures = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
    const tva = new taux_tva_service_1.TauxTvaService(prisma, ecritures);
    return { tva, ordre, marqueurRestant: () => marqueur };
}
describe('annulation d’une liquidation de TVA', () => {
    it('aboutit · le marqueur, puis les lignes, puis la tête, dans une transaction', async () => {
        const m = monter();
        await expect(m.tva.annulerLiquidation('t1', 'liq1')).resolves.toMatchObject({ supprime: true });
        expect(m.marqueurRestant()).toBeNull();
        expect(m.ordre).toEqual(['marqueur', 'lignes', 'ecriture']);
    });
    it('un AUTRE module qui tient l’écriture refuse encore · seul le détenteur nommé est libéré', async () => {
        const m = monter({ autreDetenteur: true });
        await expect(m.tva.annulerLiquidation('t1', 'liq1')).rejects.toThrow(/une donation/);
        expect(m.marqueurRestant()).not.toBeNull();
        expect(m.ordre).toEqual([]);
    });
    it('une liquidation POSTÉRIEURE existe · refus nommé, rien ne part', async () => {
        const m = monter({ posterieure: { dateDebut: new Date('2026-04-01'), dateFin: new Date('2026-04-30') } });
        await expect(m.tva.annulerLiquidation('t1', 'liq1')).rejects.toThrow(/2026-04-01 au 2026-04-30 est postérieure · annulez d'abord la plus récente/);
        expect(m.marqueurRestant()).not.toBeNull();
        expect(m.ordre).toEqual([]);
    });
    it('second tour, mineur a · la plus récente a son écriture VALIDÉE · le refus dit l’issue réelle', async () => {
        const m = monter({ posterieure: { dateDebut: new Date('2026-04-01'), dateFin: new Date('2026-04-30'), ecriture: { statut: 'VALIDEE' } } });
        await expect(m.tva.annulerLiquidation('t1', 'liq1')).rejects.toThrow(/son écriture est validée · elle ne s’annule plus.*première période non liquidée/);
        expect(m.ordre).toEqual([]);
    });
});
//# sourceMappingURL=annulation-liquidation.spec.js.map