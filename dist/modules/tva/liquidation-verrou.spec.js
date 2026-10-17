"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = {
    id: 'tx16',
    code: 'TVA16',
    intitule: 'TVA 16 %',
    taux: 16,
    compteCollecteId: 'c443',
    compteDeductibleId: 'c445',
};
function ligneTva(date, tva) {
    return {
        id: `l-${date}`,
        compteId: 'c443',
        tauxTvaId: TAUX.id,
        compte: { numero: '44310000' },
        debit: 0,
        credit: tva,
        ecriture: { date: new Date(date), lignes: [] },
    };
}
function harnais(options = {}) {
    const existante = options.liquidationExistante
        ? {
            id: 'liq1',
            dateDebut: new Date(options.liquidationExistante.dateDebut),
            dateFin: new Date(options.liquidationExistante.dateFin),
            net: 1_000,
            ecritureId: 'ecr1',
            ecriture: { id: 'ecr1', libelle: 'Liquidation TVA · période existante', date: new Date() },
        }
        : null;
    const findFirst = jest.fn().mockImplementation(({ where }) => {
        if (where.dateFin?.lt) {
            if (!existante)
                return Promise.resolve(null);
            return Promise.resolve(existante.dateFin < where.dateFin.lt ? existante : null);
        }
        if (!existante)
            return Promise.resolve(null);
        const debutDemande = where.dateFin.gte;
        const finDemande = where.dateDebut.lte;
        const chevauche = existante.dateDebut <= finDemande && existante.dateFin >= debutDemande;
        return Promise.resolve(chevauche ? existante : null);
    });
    const create = jest.fn().mockResolvedValue({ id: 'liq2' });
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS' }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ligneEcriture: {
            findMany: jest
                .fn()
                .mockResolvedValue([ligneTva('2026-01-15', 160_000), ligneTva('2026-02-10', 96_000)]),
            aggregate: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.ecriture?.statut === 'BROUILLARD'
                ? { _sum: { credit: 0, debit: 0 } }
                : { _sum: { credit: 160_000, debit: 0 } })),
            groupBy: jest
                .fn()
                .mockResolvedValue([{ compteId: 'c443', _sum: { debit: 0, credit: 160_000 } }]),
        },
        compte: {
            findMany: jest.fn().mockResolvedValue([{ id: 'c443' }]),
            findFirst: jest.fn(({ where }) => Promise.resolve({ id: `c-${where.numero}`, numero: where.numero })),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od', code: 'OD' }) },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst, create, findMany: jest.fn().mockResolvedValue([]) },
        ecriture: { delete: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    };
    const ecritureService = {
        creer: jest.fn().mockResolvedValue({ id: 'ecr-new', numeroPiece: 12 }),
        supprimer: jest.fn().mockResolvedValue({}),
        retirerCompensation: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new taux_tva_service_1.TauxTvaService(prisma, ecritureService), prisma, create, ecritureService };
}
const JANVIER = { dateDebut: '2026-01-01', dateFin: '2026-01-31' };
describe('verrou anti-double-liquidation de la TVA', () => {
    it('refuse de liquider deux fois exactement la même période', async () => {
        const { service } = harnais({ liquidationExistante: JANVIER });
        await expect(service.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex', ...JANVIER })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse une période INCLUSE dans une période déjà liquidée', async () => {
        const { service } = harnais({
            liquidationExistante: { dateDebut: '2026-01-01', dateFin: '2026-03-31' },
        });
        await expect(service.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex', ...JANVIER })).rejects.toThrow(/liquidation couvre déjà/i);
    });
    it('refuse une période INCLUANT une période déjà liquidée', async () => {
        const { service } = harnais({ liquidationExistante: JANVIER });
        await expect(service.comptabiliserLiquidation('t1', 'u1', {
            exerciceId: 'ex',
            dateDebut: '2026-01-01',
            dateFin: '2026-03-31',
        })).rejects.toThrow(/liquidation couvre déjà/i);
    });
    it('refuse une période À CHEVAL sur une période déjà liquidée', async () => {
        const { service } = harnais({
            liquidationExistante: { dateDebut: '2026-01-01', dateFin: '2026-02-15' },
        });
        await expect(service.comptabiliserLiquidation('t1', 'u1', {
            exerciceId: 'ex',
            dateDebut: '2026-02-01',
            dateFin: '2026-02-28',
        })).rejects.toThrow(/liquidation couvre déjà/i);
    });
    it('laisse passer une période DISJOINTE, et pose la trace', async () => {
        const { service, create } = harnais({ liquidationExistante: JANVIER });
        const r = await service.comptabiliserLiquidation('t1', 'u1', {
            exerciceId: 'ex',
            dateDebut: '2026-02-01',
            dateFin: '2026-02-28',
        });
        expect(r.ecriture.id).toBe('ecr-new');
        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][0].data.ecritureId).toBe('ecr-new');
    });
    it('reprend l’écriture si la trace échoue · sinon le trou se rouvre en silence', async () => {
        const { service, create, ecritureService } = harnais();
        create.mockRejectedValueOnce(new Error('contrainte'));
        await expect(service.comptabiliserLiquidation('t1', 'u1', { exerciceId: 'ex', ...JANVIER })).rejects.toThrow('contrainte');
        expect(ecritureService.retirerCompensation).toHaveBeenCalledWith('t1', 'ecr-new');
    });
    it('annonce l’état de liquidation DANS la déclaration', async () => {
        const { service } = harnais({ liquidationExistante: JANVIER });
        const d = await service.declaration('t1', new Date('2026-01-01'), new Date('2026-01-31'));
        expect(d.liquidation.faite).toBe(true);
        if (d.liquidation.faite)
            expect(d.liquidation.memePeriode).toBe(true);
        const libre = harnais();
        const d2 = await libre.service.declaration('t1', new Date('2026-01-01'), new Date('2026-01-31'));
        expect(d2.liquidation.faite).toBe(false);
    });
    it('distingue une liquidation qui RECOUVRE la période sans lui correspondre', async () => {
        const { service } = harnais({
            liquidationExistante: { dateDebut: '2026-01-01', dateFin: '2026-03-31' },
        });
        const d = await service.declaration('t1', new Date('2026-01-01'), new Date('2026-01-31'));
        expect(d.liquidation.faite).toBe(true);
        if (d.liquidation.faite)
            expect(d.liquidation.memePeriode).toBe(false);
    });
    it('annule une liquidation en supprimant son écriture · le verrou a une marche arrière', async () => {
        const { service, prisma, ecritureService } = harnais();
        prisma.liquidationTva.findFirst.mockResolvedValueOnce({
            id: 'liq1',
            ecritureId: 'ecr1',
        });
        const r = await service.annulerLiquidation('t1', 'liq1');
        expect(ecritureService.supprimer).toHaveBeenCalledWith('t1', 'ecr1', expect.objectContaining({ detenteur: 'une liquidation de TVA' }));
        expect(r.supprime).toBe(true);
    });
});
//# sourceMappingURL=liquidation-verrou.spec.js.map