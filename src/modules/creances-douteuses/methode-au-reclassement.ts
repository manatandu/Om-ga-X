import type { Prisma } from '@prisma/client';
import {
  EtatDeLaMethodeLu,
  MethodeAuReclassement,
  MethodeCotisationsDeclaree,
  methodeAuReclassement,
  methodeLueDansLeJournal,
} from './creances-douteuses';

type Lecteur = Pick<Prisma.TransactionClient, 'evenementAudit'>;

/**
 * LA MÉTHODE DES COTISATIONS AU JOUR DU RECLASSEMENT, LUE (relecture du
 * 2026-10-07, M8) · la règle est dans `methodeAuReclassement` ; ici, la
 * lecture du journal d'audit du dossier, partagée par le module et par le
 * contrôle `CREANCE_ADHERENT_RECLASSEE_SOUS_ENCAISSEMENT`, pour que le geste
 * refusé et le signalement disent la même méthode.
 *
 * Trois lectures bornées, jamais le journal entier · le premier maillon du
 * dossier (le journal commence-t-il avant le geste ?), le dernier maillon de
 * la FICHE DU DOSSIER au plus tard à l'instant du geste, et le premier
 * maillon postérieur. `Tenant.methodeCotisations` ne s'écrit que par une mise
 * à jour unitaire (`TenantService.modifierMethodeCotisations`), dont le
 * maillon porte l'état avant et après.
 */
export async function lireMethodeAuReclassement(
  prisma: Lecteur,
  p: {
    tenantId: string;
    figee: 'APPEL' | 'ENCAISSEMENT' | 'NON_DECLAREE' | null | undefined;
    geste: Date;
    actuelle: MethodeCotisationsDeclaree;
  },
): Promise<MethodeAuReclassement> {
  const figee = p.figee ?? null;
  if (figee !== null) return methodeAuReclassement({ figee, geste: p.geste, actuelle: p.actuelle, journal: null });
  const fiche = { tenantId: p.tenantId, entite: 'Tenant', entiteId: p.tenantId };
  const choix = { horodatage: true, avant: true, apres: true } as const;
  const [premier, dernierAvant, premierApres] = await Promise.all([
    prisma.evenementAudit.findFirst({ where: { tenantId: p.tenantId }, orderBy: { rang: 'asc' }, select: { horodatage: true } }),
    prisma.evenementAudit.findFirst({ where: { ...fiche, horodatage: { lte: p.geste } }, orderBy: { rang: 'desc' }, select: choix }),
    prisma.evenementAudit.findFirst({ where: { ...fiche, horodatage: { gt: p.geste } }, orderBy: { rang: 'asc' }, select: choix }),
  ]);
  const etat = (e: { horodatage: Date; avant: unknown; apres: unknown } | null): EtatDeLaMethodeLu | null =>
    e ? { le: e.horodatage, avant: methodeLueDansLeJournal(e.avant), apres: methodeLueDansLeJournal(e.apres) } : null;
  return methodeAuReclassement({
    figee: null,
    geste: p.geste,
    actuelle: p.actuelle,
    journal: { debut: premier?.horodatage ?? null, dernierAvant: etat(dernierAvant), premierApres: etat(premierApres) },
  });
}
