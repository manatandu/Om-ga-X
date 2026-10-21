"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const questionnaire_paie_service_1 = require("./questionnaire-paie.service");
const contrat = (id, debut, fin, devise) => ({
    id,
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: new Date(`${debut}T00:00:00.000Z`),
    dateFin: fin ? new Date(`${fin}T00:00:00.000Z`) : null,
    classeProfessionnelle: 5,
    periodiciteRemuneration: 'MOIS',
    deviseRemuneration: devise,
});
function monter(salarie) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ effectifPermanent: 0, numeroAffiliationCnssEmployeur: null }) },
        salarie: { findFirst: jest.fn().mockResolvedValue(salarie) },
    };
    return { service: new questionnaire_paie_service_1.QuestionnairePaieService(prisma), prisma };
}
describe('le questionnaire de paie, lu', () => {
    const salarie = {
        id: 's1',
        nom: 'KASONGO',
        prenoms: 'Jean',
        numeroAffiliationCnss: null,
        modePaiement: null,
        contrats: [contrat('c2', '2026-07-01', null, null), contrat('c1', '2025-01-01', '2026-06-30', 'CDF')],
    };
    it('rend le dossier tel quel · zéro et null ne sont pas complétés', async () => {
        const { service } = monter(salarie);
        expect((await service.lire('t1', undefined, undefined)).dossier).toEqual({ effectifPermanent: 0, numeroAffiliationCnssEmployeur: null });
    });
    it('prend le contrat qui couvre le mois, et lit le salarié dans le dossier de la session', async () => {
        const { service, prisma } = monter(salarie);
        expect((await service.lire('t1', 's1', '2026-03')).salarie?.contrat?.id).toBe('c1');
        expect((await service.lire('t1', 's1', '2026-10')).salarie?.contrat).toMatchObject({ id: 'c2', deviseRemuneration: null });
        expect((await service.lire('t1', 's1', '2024-10')).salarie?.contrat).toBeNull();
        expect(prisma.salarie.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1', tenantId: 't1' } }));
    });
    it('refuse un mois illisible et un salarié introuvable', async () => {
        await expect(monter(salarie).service.lire('t1', 's1', '2026-13')).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(monter(null).service.lire('t1', 'autre', '2026-10')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
});
//# sourceMappingURL=questionnaire-paie.spec.js.map