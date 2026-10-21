"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
const exercice_cloture_1 = require("./exercice-cloture");
describe("Refus d'un exercice clôturé · l'issue nommée", () => {
    it('nomme le compte de résultat de l’exercice suivant et les deux exceptions, au SYSCOHADA', () => {
        const m = (0, exercice_cloture_1.motifExerciceCloture)(client_1.Referentiel.SYSCOHADA);
        expect(m).toContain("exercice clôturé");
        expect(m).toContain("dans l'exercice ouvert suivant, par son compte de résultat");
        expect(m).toContain("correction d'une erreur significative");
        expect(m).toContain('AUDCIF, Titre V');
        expect(m).not.toContain('SYCEBNL');
    });
    it('cite le cadre conceptuel du SYCEBNL, jamais l’AUDCIF, au SYCEBNL', () => {
        const m = (0, exercice_cloture_1.motifExerciceCloture)(client_1.Referentiel.SYCEBNL);
        expect(m).toContain('SYCEBNL, cadre conceptuel § 3.3.1.2.4');
        expect(m).not.toContain('AUDCIF');
    });
    it('le contrôle d’entrée sert ce motif, lu sur le référentiel du dossier', async () => {
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', tenantId: 't1', statut: client_1.StatutExercice.CLOTURE }) },
            tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYCEBNL }) },
        };
        const service = Object.create(ecriture_service_1.EcritureService.prototype);
        service.prisma = prisma;
        const appel = service.controlesDEntree('t1', { exerciceId: 'e1' }, prisma);
        await expect(appel).rejects.toBeInstanceOf(common_1.ForbiddenException);
        await expect(service.controlesDEntree('t1', { exerciceId: 'e1' }, prisma)).rejects.toThrow((0, exercice_cloture_1.motifExerciceCloture)(client_1.Referentiel.SYCEBNL));
        expect(prisma.tenant.findFirst).toHaveBeenCalledWith({ where: { id: 't1' }, select: { referentiel: true } });
    });
});
//# sourceMappingURL=exercice-cloture.spec.js.map