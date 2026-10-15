/**
 * ÉCHÉANCE ET MODE DE RÈGLEMENT D'UNE LIGNE DE SAISIE (ligne sage-l2,
 * fonctions 1 et 3). Ce sont des exceptions de la ligne, comme la date de
 * versement · la zone ne s'ouvre que sur un compte de TIERS (classe 4), où
 * l'échéance range la créance ou la dette dans la balance âgée, l'échéancier,
 * les relances et les notes par échéance. Sur un compte de charge ou de
 * trésorerie, une échéance n'a pas d'objet.
 */
export function porteUneEcheance(numero: string | null | undefined): boolean {
  return !!numero && numero.startsWith('4');
}
