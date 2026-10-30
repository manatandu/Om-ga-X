import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ModuleOptionnel } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { modulesServis } from '../tenant/modules-optionnels';

/** Le refus, servi aussi à l'écran · il dit où le module s'active. */
export const MOTIF_MODULE_NON_ACTIVE =
  'La gestion commerciale n’est pas activée pour ce dossier · l’administrateur l’active dans Structure > Paramètres du dossier, onglet des modules. Ce qui a été saisi reste lisible.';

/**
 * LA GESTION COMMERCIALE SE REFUSE AUSSI PAR LE SERVEUR (ligne commercial-l8).
 *
 * `tenant/modules-optionnels.ts` pose que masquer un module n'est pas le
 * refuser, et que ses données restent · c'est vrai des modules d'avant, dont
 * la route reste ouverte. Pour la gestion commerciale, demandée avec ses
 * articles, ses tarifs et ses pièces, le menu masqué ET le refus du serveur
 * vont ensemble · une pièce de livraison saisie dans un dossier qui n'a pas
 * activé le module mouvementerait un magasin que personne ne regarde.
 *
 * LE REFUS NE PORTE QUE SUR CE QUI ÉCRIT · une lecture passe toujours, si bien
 * que désactiver le module ne cache rien de ce qui a été fait, et le
 * réactiver le rend tel quel (règle 1 de `modules-optionnels.ts`). Le dossier
 * de l'éditeur voit tout (`modulesServis`).
 *
 * S'applique après `JwtAuthGuard` (`request.user` doit exister), comme
 * `ReferentielGuard`, jamais en garde globale (roles-cantonnes.spec.ts).
 */
@Injectable()
export class GestionCommercialeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ method: string; user?: { tenantId?: string } }>();
    if (request.method === 'GET' || request.method === 'HEAD') return true;
    const tenantId = request.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Dossier non résolu.');
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { modulesActives: true, licence: { select: { type: true } } },
    });
    if (!t || !modulesServis(t.modulesActives, t.licence?.type).includes(ModuleOptionnel.GESTION_COMMERCIALE)) {
      throw new ForbiddenException(MOTIF_MODULE_NON_ACTIVE);
    }
    return true;
  }
}
