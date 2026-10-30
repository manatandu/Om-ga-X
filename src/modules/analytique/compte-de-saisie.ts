import { TypeCompteDetailTotal } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import { estCompteDePassage, racineDuCompteSeme, racinesSousLeCompteSeme } from '../comptes/subdivisions-du-plan';

/**
 * LIGNE ANALYTIQUE (relecture du 2026-10-30) · UNE GRILLE OU UN BUDGET NE SE
 * POSE QUE SUR UN COMPTE QUE LA SAISIE ADMET.
 *
 * Un compte en sommeil ne reçoit plus de ligne, et un compte du plan que le
 * dossier a SUBDIVISÉ (un compte d'imputation actif ouvert sous sa racine)
 * est refusé à la saisie (`EcritureService.verifierComptesCollectifs`,
 * `comptes/subdivisions-du-plan.ts`) · les écritures vont à ses sous-comptes.
 * Une grille posée sur lui ne se proposerait jamais ; un budget posé sur lui
 * resterait à zéro de réalisé pendant que le sous-compte, qui reçoit les
 * charges, sortait « hors budget » · un budget faux à l'état, sans aucun refus.
 * La même lecture que la saisie (racine officielle, sous-comptes semés plus
 * profonds écartés, comptes de passage ouverts), et le motif nomme le
 * sous-compte à doter.
 */
export async function motifCompteHorsSaisie(
  prisma: PrismaService,
  tenantId: string,
  compte: { id: string; numero: string; estActif: boolean },
  geste: string,
): Promise<string | null> {
  if (!compte.estActif) {
    return `Le compte ${compte.numero} est en sommeil · il ne reçoit plus d'écriture, ${geste} ne s'y pose pas.`;
  }
  const dossier = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
  if (!dossier) return 'Dossier introuvable.';
  const racine = racineDuCompteSeme(dossier.referentiel, compte.numero);
  if (racine === null || estCompteDePassage(compte.numero)) return null;
  const sousComptes = await prisma.compte.findMany({
    where: {
      tenantId,
      typeCompte: TypeCompteDetailTotal.DETAIL,
      estActif: true,
      numero: { startsWith: racine, not: compte.numero },
      NOT: racinesSousLeCompteSeme(dossier.referentiel, compte.numero).map((r) => ({ numero: { startsWith: r } })),
    },
    select: { numero: true },
    orderBy: { numero: 'asc' },
    take: 3,
  });
  if (sousComptes.length === 0) return null;
  return (
    `Le compte ${compte.numero} est subdivisé dans ce dossier · la saisie va à ses sous-comptes ` +
    `(${sousComptes.map((s) => s.numero).join(', ')}${sousComptes.length === 3 ? '…' : ''}), ${geste} se pose sur l'un d'eux.`
  );
}
