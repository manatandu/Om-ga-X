"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
function fiche(dotations) {
    return {
        id: 'i1',
        designation: 'Camion',
        statut: 'EN_SERVICE',
        valeurOrigine: 12_000_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 4,
        dateMiseEnService: new Date('2025-01-01'),
        amortissementAnterieur: 0,
        compteDotationId: 'cd',
        compteAmortissementId: 'ca',
        compteImmobilisation: { numero: '24510000' },
        dotations: dotations.map((d) => ({ ...d, exerciceId: `ex-${d.id}` })),
        depreciations: [],
    };
}
function fabrique(relue) {
    const lue = fiche([{ id: 'dN', montant: 3_000_000 }]);
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValueOnce(lue).mockResolvedValueOnce(relue),
        },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({ id: 'exN1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
        },
        dotationAmortissement: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'dN1', montant: 3_000_000 }),
        },
        ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        ecriture: { delete: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn((f) => f(prisma));
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    const ecritures = { creer: jest.fn().mockResolvedValue({ id: 'e-dot' }) };
    return { svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), prisma: prisma };
}
describe('la dotation relit la fiche sous son verrou', () => {
    it('la fiche inchangée · la dotation s’enregistre, après le verrou de la ligne du bien', async () => {
        const { svc, prisma } = fabrique(fiche([{ id: 'dN', montant: 3_000_000 }]));
        await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN1', journalId: 'j1' });
        expect(prisma.dotationAmortissement.create).toHaveBeenCalledTimes(1);
        const sql = prisma.$queryRaw.mock.calls[0][0].join('?');
        expect(sql).toMatch(/FROM "immobilisations" WHERE id = \? AND "tenantId" = \? FOR UPDATE/);
    });
    it('la dotation de N annulée entre le calcul et l’enregistrement · 409, rien au journal', async () => {
        const { svc, prisma } = fabrique(fiche([]));
        await expect(svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN1', journalId: 'j1' })).rejects.toThrow(common_1.ConflictException);
        expect(prisma.dotationAmortissement.create).not.toHaveBeenCalled();
        expect(prisma.ecriture.delete).toHaveBeenCalledWith({ where: { id: 'e-dot' } });
    });
});
//# sourceMappingURL=verrou-de-la-fiche.spec.js.map