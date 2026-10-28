import type { Prisma } from '@prisma/client';

type Db = Pick<Prisma.TransactionClient, 'detentionBien' | 'recuDetentionBien'>;

/**
 * LIGNE MICROFINA M4 · CE QUE LES DÉTENTIONS RETIENNENT D'UNE FICHE
 * (relecture B1). Une seule lecture pour la suppression de la fiche et pour
 * l'annulation d'un transfert dans le groupe · sans elle, l'une compterait
 * les détentions annulées et l'autre non, et le refus ne dirait pas la même
 * chose aux deux portes.
 *
 * Seuls les actes VIVANTS retiennent la fiche · une détention annulée et ses
 * reçus annulés ne disent plus que le bien a été en main, ils gardent la
 * trace d'une erreur corrigée. Un reçu vivant sans détention vivante ne
 * devrait pas exister · compté quand même, le doute retient.
 */
export async function detentionsQuiRetiennentLaFiche(db: Db, tenantId: string, immobilisationId: string) {
  const [detentions, recus] = await Promise.all([
    db.detentionBien.count({ where: { tenantId, immobilisationId, annuleeLe: null } }),
    db.recuDetentionBien.count({ where: { tenantId, immobilisationId, annuleLe: null } }),
  ]);
  return { detentions, recus, total: detentions + recus };
}

/**
 * La fiche part · ses détentions ANNULÉES et ses reçus annulés restent au
 * registre, détachés d'elle (le bien est décrit par `bienDecrit` et par le
 * texte figé du reçu). Jamais supprimés · la suite des reçus n'a pas de trou,
 * et la détention annulée n'est « jamais supprimée ». Une mise à jour
 * UNITAIRE par ligne · au journal d'audit, un `updateMany` ne laisserait que
 * son filtre et son compte. Appelée seulement après
 * `detentionsQuiRetiennentLaFiche` à zéro, dans la même transaction.
 */
export async function detacherLesDetentionsAnnulees(db: Db, tenantId: string, immobilisationId: string) {
  const [detentions, recus] = await Promise.all([
    db.detentionBien.findMany({ where: { tenantId, immobilisationId, annuleeLe: { not: null } }, select: { id: true }, take: 1_000 }),
    db.recuDetentionBien.findMany({ where: { tenantId, immobilisationId, annuleLe: { not: null } }, select: { id: true }, take: 2_000 }),
  ]);
  for (const d of detentions) await db.detentionBien.update({ where: { id: d.id }, data: { immobilisationId: null } });
  for (const r of recus) await db.recuDetentionBien.update({ where: { id: r.id }, data: { immobilisationId: null } });
  return { detentions: detentions.length, recus: recus.length };
}
