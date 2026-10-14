/**
 * LA LETTRE DE LETTRAGE CHOISIE À LA MAIN (ligne sage-l1, fonction 16 ·
 * Sage 100 i7, manuel 3, Interrogation et lettrage, « changer la prochaine
 * lettre »). Le programme propose la lettre qui suit la plus haute du compte
 * (A, B, ..., Z, AA, ...) ; le comptable peut en choisir une autre pour le
 * lettrage manuel qu'il pose. Aucun texte ne régit le repère du lettrage · le
 * CPCC (ch. 6) n'exige qu'« un seul repère » par groupe, et c'est la seule
 * règle tenue ici · une lettre déjà employée sur le compte réunirait deux
 * groupes sous un même repère, elle est refusée en la nommant (la base le
 * refuserait aussi, `@@unique([compteId, code])`, mais sans dire pourquoi).
 *
 * LA FORME · des lettres seules, comme la suite que le programme écrit
 * (`indexVersLettre`), jamais un chiffre ni un signe · une lettre « 1 » ou
 * « A-2 » ne se lirait plus dans la suite, et la lettre suivante calculée
 * deviendrait fausse. Quatre lettres au plus · la suite automatique n'en
 * atteint une quatrième qu'au-delà de 18 278 groupes sur un même compte.
 * Saisie en minuscules, elle est rangée en MAJUSCULES · la minuscule est
 * l'AFFICHAGE d'un groupe partiel (convention du CPCC, compte 585), jamais
 * un code distinct.
 */
export const FORMAT_LETTRE_CHOISIE = /^[A-Za-z]{1,4}$/;

export const MOTIF_FORMAT_LETTRE =
  'La lettre de lettrage se compose d’une à quatre lettres, sans chiffre, accent ni signe (A, B, ..., Z, AA, ...).';

/** La lettre telle qu'elle se range · majuscules, sans espaces autour. */
export function normaliserLettre(lettre: string): string {
  return lettre.trim().toUpperCase();
}

/** Vrai si la lettre a la forme admise (après normalisation). */
export function lettreBienFormee(lettre: string): boolean {
  return FORMAT_LETTRE_CHOISIE.test(lettre.trim());
}

/**
 * LE REFUS NOMMÉ d'une lettre déjà employée sur le compte · il dit le compte,
 * le groupe qui la porte (soldé ou partiel), et la lettre que le programme
 * propose, qui est toujours libre.
 */
export function motifLettreDejaEmployee(p: {
  lettre: string;
  compteNumero: string;
  statutGroupe: 'SOLDE' | 'PARTIEL' | null;
  lettreProposee: string;
}): string {
  const groupe =
    p.statutGroupe === 'SOLDE'
      ? 'par un lettrage soldé'
      : p.statutGroupe === 'PARTIEL'
        ? `par un lettrage partiel (affiché « ${p.lettre.toLowerCase()} »)`
        : 'sur des lignes déjà lettrées';
  return (
    `La lettre « ${p.lettre} » est déjà employée sur le compte ${p.compteNumero} ${groupe} · un repère ne réunit qu'un ` +
    `seul groupe. Choisissez une autre lettre, ou laissez la lettre proposée (« ${p.lettreProposee} »).`
  );
}
