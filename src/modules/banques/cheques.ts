/**
 * REGISTRE DES CHÈQUES ÉMIS · règles pures (ligne microfina-m2, idée 9).
 *
 * CPCC, ch. 1 § 1.1.1 · les « souches ou talons de chéquiers » sont des
 * pièces justificatives d'origine interne. Guide SYSCOHADA, Partie 1 ch. 4
 * § 2.2 · le débiteur enregistre le chèque « dès l'émission » (prudence), et
 * la tolérance d'un enregistrement à l'avis de débit exige que la
 * régularisation de fin de période « tienne compte des chèques en
 * circulation ». Le chéquier lui-même n'est régi par aucun texte lu · plage,
 * largeur et refus ci-dessous sont des CONVENTIONS D'OMEGAX.
 */

/** Un numéro tel qu'imprimé sur le feuillet · « 0042 » sur quatre chiffres. */
export function numeroImprime(numero: number, largeur: number): string {
  return String(numero).padStart(largeur, '0');
}

/**
 * LE CARNET · une plage croissante, positive, que la largeur imprimée peut
 * porter, et qui ne chevauche aucun autre carnet du MÊME compte (deux carnets
 * qui se recouvrent donneraient deux chèques sous un même numéro).
 */
export function motifRefusChequier(
  debut: number,
  fin: number,
  largeur: number,
  autres: readonly { numeroDebut: number; numeroFin: number }[],
): string | null {
  if (!Number.isInteger(debut) || !Number.isInteger(fin) || debut <= 0) return 'Les numéros du carnet sont des entiers positifs.';
  if (fin < debut) return 'Le dernier numéro du carnet précède le premier.';
  if (fin > 2_147_483_647) return 'Le dernier numéro dépasse ce que le registre sait tenir.';
  if (!Number.isInteger(largeur) || largeur < 1 || largeur > 12) return 'La largeur imprimée se donne en chiffres, de 1 à 12.';
  if (String(fin).length > largeur) return `Le numéro ${fin} ne tient pas sur ${largeur} chiffres.`;
  const chevauche = autres.find((a) => debut <= a.numeroFin && a.numeroDebut <= fin);
  if (chevauche) return `La plage chevauche le carnet ${chevauche.numeroDebut} à ${chevauche.numeroFin} de ce compte · un numéro ne sert qu'une fois.`;
  return null;
}

/** Le numéro dans la plage du carnet. */
export function motifRefusNumero(numero: number, carnet: { numeroDebut: number; numeroFin: number }): string | null {
  if (!Number.isInteger(numero) || numero < carnet.numeroDebut || numero > carnet.numeroFin) {
    return `Le numéro ${numero} n'est pas dans le carnet (${carnet.numeroDebut} à ${carnet.numeroFin}).`;
  }
  return null;
}

/** Le premier numéro du carnet qui n'a pas servi, ou null s'il est épuisé · parcourt les seuls numéros servis, jamais la plage. */
export function prochainNumeroLibre(carnet: { numeroDebut: number; numeroFin: number }, utilises: readonly number[]): number | null {
  let candidat = carnet.numeroDebut;
  for (const u of [...new Set(utilises)].sort((a, b) => a - b)) {
    if (u < candidat) continue;
    if (u > candidat) break;
    candidat += 1;
  }
  return candidat <= carnet.numeroFin ? candidat : null;
}

export type EtatLu = 'EMIS_SANS_PIECE' | 'EN_CIRCULATION' | 'ENCAISSE' | 'PIECE_ANNULEE' | 'ANNULE';

/**
 * L'ÉTAT D'UN CHÈQUE SE LIT, IL NE SE SAISIT PAS · annulé s'il l'est ; émis
 * sans pièce tant qu'aucune pièce de la banque ne le porte ; PIÈCE ANNULÉE
 * quand la pièce est corrigée par son négatif lié (relecture M3 · AUDCIF
 * art. 20, al. 2) ; ENCAISSÉ quand toutes les lignes de la pièce au compte de
 * la banque sont pointées au rapprochement face au relevé ; sinon EN
 * CIRCULATION (le chèque est parti, la banque ne l'a pas encore débité).
 *
 * LA PIÈCE CORRIGÉE PASSE AVANT LE POINTAGE · l'original et son négatif se
 * pointent ensemble au rapprochement (leur somme est nulle, aucune ligne du
 * relevé ne leur répond), et les lire « encaissé » faisait d'un chèque dont
 * la pièce est annulée au journal un chèque payé par la banque, que plus rien
 * ne laissait annuler.
 */
export function etatDuCheque(c: {
  etat: 'EMIS' | 'ANNULE';
  aUnePiece: boolean;
  pieceCorrigee?: boolean;
  lignesBanque: number;
  lignesPointees: number;
}): EtatLu {
  if (c.etat === 'ANNULE') return 'ANNULE';
  if (!c.aUnePiece) return 'EMIS_SANS_PIECE';
  if (c.pieceCorrigee) return 'PIECE_ANNULEE';
  return c.lignesBanque > 0 && c.lignesPointees === c.lignesBanque ? 'ENCAISSE' : 'EN_CIRCULATION';
}

/**
 * LA PIÈCE RELIÉE, REJUGÉE AU REGISTRE (relecture M4) · une pièce du
 * brouillard se retouche après le lien (montant, journal, compte), et rien ne
 * la rejugeait · le registre montrait payé par une pièce de 80 000 un chèque
 * de 100 000. Rend l'écart à dire, ou null.
 */
export function ecartDeLaPiece(p: { journalAttenduId: string | null; journalId: string; creditCentimes: number; montantCentimes: number }): string | null {
  if (p.journalAttenduId !== null && p.journalId !== p.journalAttenduId) {
    return "La pièce n'est plus au journal de ce compte bancaire depuis son rattachement · reliez le chèque à la bonne pièce.";
  }
  if (p.creditCentimes !== p.montantCentimes) {
    return `La pièce crédite désormais la banque de ${fr(p.creditCentimes)} pour un chèque de ${fr(p.montantCentimes)} · retouchée depuis son rattachement, elle ne paie plus ce chèque au centime.`;
  }
  return null;
}

function fr(c: number) {
  return (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
