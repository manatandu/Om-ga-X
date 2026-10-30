import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * UNE LIGNE NE SE RETIRE NI NE SE DÉPLACE QUE LIBRE, JUGÉE DANS LA TRANSACTION
 * QUI LA TOUCHE (relecture de la ligne lettrage-verrou, 2026-10-29, M3).
 *
 * Supprimer, modifier ou réimputer une écriture vérifiait son lettrage et son
 * pointage HORS de sa transaction (`trouverEnBrouillard`, contrôles de la
 * réimputation), puis retirait ou déplaçait les lignes sans filtre · un
 * lettrage validé entre les deux laissait un groupe amputé de sa ligne ou
 * réparti sur deux comptes, son solde stocké faux, statut SOLDÉ menteur, sans
 * un mot. Le filtre est posé SUR LA LIGNE MÊME, et le nombre relu · un lettrage
 * validé avant l'image est vu par le filtre ; en lecture validée, PostgreSQL
 * attend le verrou de la ligne que pose un lettrage en cours, puis réévalue la
 * condition sur sa version à jour (`scripts/rejouer-retrait-contre-lettrage.cjs`).
 */
export const FILTRE_LIGNE_LIBRE = { lettrageId: null, lettre: null, rapprochementId: null } as const;

export const MOTIF_LIGNE_TENUE_ENTRE_TEMPS =
  "Une ligne de cette écriture a été lettrée, pointée ou validée pendant le geste · rien n'est modifié. " +
  'Rechargez · délettrez ou dépointez la ligne avant de recommencer.';

/**
 * Retire les lignes d'une écriture, toutes libres, ou rien.
 *
 * `laisserNommerLEcriture` · pour l'appelant qui retire ensuite l'écriture
 * sous le même filtre et nomme lui-même son changement (« validée pendant
 * l'annulation, relancez, elle s'inscrira en négatif ») · quand plus aucune
 * ligne ne répond au filtre de l'écriture, rien n'est retiré et rien n'est
 * refusé ici, l'appelant le dit (ligne saisie-serialisable, relecture,
 * point 2). Une ligne lettrée ou pointée refuse toujours.
 */
export async function retirerLesLignesLibres(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ecritureId: string,
  filtreEcriture: Prisma.EcritureWhereInput = {},
  options: { laisserNommerLEcriture?: boolean } = {},
): Promise<void> {
  const attendues = await tx.ligneEcriture.count({ where: { ecritureId, ecriture: { tenantId } } });
  const { count } = await tx.ligneEcriture.deleteMany({
    where: { ecritureId, ecriture: { tenantId, ...filtreEcriture }, ...FILTRE_LIGNE_LIBRE },
  });
  if (count === attendues) return;
  if (options.laisserNommerLEcriture && count === 0) {
    const sousLeFiltre = await tx.ligneEcriture.count({ where: { ecritureId, ecriture: { tenantId, ...filtreEcriture } } });
    if (sousLeFiltre === 0) return;
  }
  throw new ConflictException(MOTIF_LIGNE_TENUE_ENTRE_TEMPS);
}

/**
 * Les lignes VALIDÉES d'une réimputation ne s'écrivent pas (elles se
 * corrigent par inscription en négatif dans une écriture nouvelle) · rien ne
 * ferait donc tomber la transaction si l'une d'elles était lettrée pendant
 * elle. Elles se RÉÉCRIVENT sans changer de valeur, sous le filtre des lignes
 * libres et VALIDÉES (les seules qu'on lui passe), nombre relu · une ligne tenue entre-temps manque au compte. La
 * réimputation tourne en lecture validée sous le verrou du dossier
 * (`transactionDeSaisie`) · une ligne qu'un lettrage ou un pointage tient
 * encore se fait attendre, puis la condition se relit sur sa version à jour.
 * En requête brute · aucune valeur ne change, il n'y a rien à journaliser.
 */
export async function retenirLesLignesLibres(tx: Prisma.TransactionClient, tenantId: string, ligneIds: string[]): Promise<void> {
  if (ligneIds.length === 0) return;
  const tenues = await tx.$executeRaw`
    UPDATE "lignes_ecriture" l SET "id" = l."id"
    FROM "ecritures" e
    WHERE e."id" = l."ecritureId" AND e."tenantId" = ${tenantId}
      AND e."statut" = 'VALIDEE'::"StatutEcriture"
      AND l."id" = ANY(${ligneIds}::text[])
      AND l."lettrageId" IS NULL AND l."lettre" IS NULL AND l."rapprochementId" IS NULL`;
  if (tenues !== new Set(ligneIds).size) throw new ConflictException(MOTIF_LIGNE_TENUE_ENTRE_TEMPS);
}
