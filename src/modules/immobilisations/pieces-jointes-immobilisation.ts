import type { LecteurDesPieces, ObjetLu, RegleDesPieces } from '../../common/pieces-jointes/table-des-pieces';

/**
 * LE DOCUMENT DE LA FICHE D'UN BIEN (ligne sage-l6, fonction n° 22 · Sage
 * Immobilisations, « documents attachés et bloc-notes de la fiche »). Facture,
 * acte, photo, garantie, procès-verbal de réception.
 *
 * DÉCISION PAR LA LOI · la fiche n'est pas une écriture · la pièce qui
 * JUSTIFIE l'acquisition (AUDCIF art. 17, 3° ; art. 22, 7°) se joint à
 * l'écriture d'acquisition, où elle se conserve dix ans (art. 24) et ne se
 * retire plus une fois l'écriture validée. Le document de la fiche est un
 * classement du registre · il se dépose et se retire à tout moment, à tout
 * état du bien, sorti compris. Une fiche qui en porte un ne se supprime pas
 * sans le dire (`motifRefusSuppression`, usages lus dans le schéma).
 */
async function lireBienDesPieces(db: LecteurDesPieces, tenantId: string, immobilisationId: string): Promise<ObjetLu | null> {
  const b = await db.immobilisation.findFirst({
    where: { id: immobilisationId, tenantId },
    select: { designation: true, numeroInventaire: true },
  });
  if (!b) return null;
  return {
    description: b.numeroInventaire ? `${b.numeroInventaire} · ${b.designation}` : b.designation,
    motifRefusDepot: null,
    motifRefusRetrait: null,
  };
}

export const REGLE_PIECES_IMMOBILISATION: RegleDesPieces = {
  objet: 'IMMOBILISATION',
  designation: 'cette immobilisation',
  lireObjet: lireBienDesPieces,
};
