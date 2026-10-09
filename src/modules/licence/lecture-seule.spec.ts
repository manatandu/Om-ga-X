import { ForbiddenException } from '@nestjs/common';
import { StatutLicence, TypeLicence } from '@prisma/client';
import { LicenceGuard } from './licence.guard';
import { LicenceService } from './licence.service';

/**
 * Décision de Manasse du 2026-10-09 · un abonnement échu met le dossier en
 * LECTURE SEULE (consulter, imprimer) ; une licence suspendue reste fermée.
 */
describe('LicenceGuard · abonnement échu en lecture seule', () => {
  const service = new LicenceService({} as never);
  const garde = new LicenceGuard(service);
  const hier = new Date(Date.now() - 86_400_000);
  const licence = (statut: StatutLicence) => ({
    id: 'l1',
    tenantId: 'd1',
    type: TypeLicence.ABONNEMENT,
    statut,
    dateDebut: new Date('2026-01-01'),
    dateExpiration: hier,
    dernierHeartbeatAt: null,
    joursGraceHorsLigne: 7,
  });
  const contexte = (method: string, statut: StatutLicence = StatutLicence.ACTIVE) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method, user: { tenantId: 'd1', licence: licence(statut) } }) }),
    }) as never;

  it('une lecture passe', async () => {
    await expect(garde.canActivate(contexte('GET'))).resolves.toBe(true);
  });

  it('une écriture est refusée, et le refus dit la lecture seule', async () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      await expect(garde.canActivate(contexte(m))).rejects.toThrow(/lecture seule/);
    }
  });

  it('une licence suspendue reste fermée, même en lecture', async () => {
    await expect(garde.canActivate(contexte('GET', StatutLicence.SUSPENDUE))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
