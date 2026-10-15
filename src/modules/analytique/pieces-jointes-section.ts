import type { LecteurDesPieces, ObjetLu, RegleDesPieces } from '../../common/pieces-jointes/table-des-pieces';

/**
 * LE DOCUMENT D'UNE SECTION ANALYTIQUE (ligne sage-l6, fonction n° 22 ·
 * Sage, F_COMPTEAMEDIA). La convention de financement d'un projet, le budget
 * du bailleur, un rapport d'exécution.
 *
 * DÉCISION PAR LA LOI · la section n'est pas une écriture · son document
 * n'est pas la pièce justificative d'un enregistrement (AUDCIF art. 17, 3°,
 * qui vise les écritures), et aucun texte lu ne le fige · il se dépose et se
 * retire à tout moment, comme le document d'un tiers. Une section qui en
 * porte un ne se supprime pas sans le dire (`references.ts`) · le retirer
 * d'abord, ou mettre la section en sommeil. Une rubrique (section Total) en
 * reçoit aussi · le budget d'une rubrique se justifie comme celui d'une
 * feuille.
 */
async function lireSectionDesPieces(db: LecteurDesPieces, tenantId: string, sectionId: string): Promise<ObjetLu | null> {
  const s = await db.sectionAnalytique.findFirst({
    where: { id: sectionId, tenantId },
    select: { code: true, intitule: true, plan: { select: { code: true } } },
  });
  if (!s) return null;
  return { description: `${s.plan.code} · ${s.code} ${s.intitule}`, motifRefusDepot: null, motifRefusRetrait: null };
}

export const REGLE_PIECES_SECTION: RegleDesPieces = {
  objet: 'SECTION',
  designation: 'cette section',
  lireObjet: lireSectionDesPieces,
};
