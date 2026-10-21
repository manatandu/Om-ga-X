"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const personnel_service_1 = require("./personnel.service");
function service(versions) {
    const prisma = {
        versionBaremePaie: {
            findFirst: jest.fn(async (args) => {
                const w = args.where;
                const l = versions
                    .filter((v) => v.tenantId === w.tenantId && v.bareme === w.bareme && v.aPartirDu < w.aPartirDu.lt)
                    .sort((a, b) => (a.aPartirDu < b.aPartirDu ? 1 : -1))[0];
                return l
                    ? { bareme: l.bareme, aPartirDu: l.aPartirDu, reference: 'Arrêté d’essai n° 1/2027', valeurs: { smigJournalierFc: l.smig } }
                    : null;
            }),
        },
    };
    return new personnel_service_1.PersonnelService(prisma);
}
const DTO = {
    anneesAnciennete: 1,
    moisNonCouvertsParUnConge: 12,
    initiative: 'EMPLOYEUR',
    motif: 'LICENCIEMENT',
    typeContrat: 'DUREE_INDETERMINEE',
    enfantsBeneficiairesAllocations: 1,
    joursAllocationsFamiliales: 10,
};
describe('le service du décompte final', () => {
    it('refuse une démission posée à l’initiative de l’employeur', async () => {
        await expect(service([]).decompteFinal('t1', { ...DTO, motif: 'DEMISSION' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('lit la colonne 19 de la grille du mois de cessation', async () => {
        const v = await service([]).decompteFinal('t1', { ...DTO, moisDeCessation: '2026-03' });
        expect(v.horsBrut[0].montantFc).toBeCloseTo(10 * 796.3, 6);
    });
    it('prend la version du cabinet du dossier, et celle-là seule', async () => {
        const versions = [
            { tenantId: 't1', bareme: 'SMIG', aPartirDu: '2027-01-01', smig: 27_000 },
            { tenantId: 't2', bareme: 'SMIG', aPartirDu: '2027-01-01', smig: 99_000 },
        ];
        const v = await service(versions).decompteFinal('t1', { ...DTO, moisDeCessation: '2027-02' });
        expect(v.horsBrut[0].montantFc).toBeCloseTo(10 * 1000, 6);
    });
    it('laisse les allocations indéterminées sans mois de cessation', async () => {
        const v = await service([]).decompteFinal('t1', DTO);
        expect(v.horsBrut[0].montantFc).toBeNull();
    });
});
//# sourceMappingURL=decompte-final-service.spec.js.map