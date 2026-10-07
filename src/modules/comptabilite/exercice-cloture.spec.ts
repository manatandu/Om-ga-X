import { ForbiddenException } from '@nestjs/common';
import { Referentiel, StatutExercice } from '@prisma/client';
import { EcritureService } from './ecriture.service';
import { motifExerciceCloture } from './exercice-cloture';

/**
 * Constat N6 des cas chiffrés de la clôture (2026-10-07) · le refus d'un
 * exercice clôturé nomme l'issue, par référentiel, jamais l'un servi à
 * l'autre.
 */
describe("Refus d'un exercice clôturé · l'issue nommée", () => {
  it('nomme le compte de résultat de l’exercice suivant et les deux exceptions, au SYSCOHADA', () => {
    const m = motifExerciceCloture(Referentiel.SYSCOHADA);
    expect(m).toContain("exercice clôturé");
    expect(m).toContain("dans l'exercice ouvert suivant, par son compte de résultat");
    expect(m).toContain("correction d'une erreur significative");
    expect(m).toContain('AUDCIF, Titre V');
    expect(m).not.toContain('SYCEBNL');
  });

  it('cite le cadre conceptuel du SYCEBNL, jamais l’AUDCIF, au SYCEBNL', () => {
    const m = motifExerciceCloture(Referentiel.SYCEBNL);
    expect(m).toContain('SYCEBNL, cadre conceptuel § 3.3.1.2.4');
    expect(m).not.toContain('AUDCIF');
  });

  it('le contrôle d’entrée sert ce motif, lu sur le référentiel du dossier', async () => {
    const prisma: any = {
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', tenantId: 't1', statut: StatutExercice.CLOTURE }) },
      tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYCEBNL }) },
    };
    const service = Object.create(EcritureService.prototype) as EcritureService;
    (service as any).prisma = prisma;
    const appel = service.controlesDEntree('t1', { exerciceId: 'e1' } as any, prisma);
    await expect(appel).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.controlesDEntree('t1', { exerciceId: 'e1' } as any, prisma)).rejects.toThrow(
      motifExerciceCloture(Referentiel.SYCEBNL),
    );
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({ where: { id: 't1' }, select: { referentiel: true } });
  });
});
