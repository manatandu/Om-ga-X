/**
 * LES GESTES QUI DÉPLACENT LE PREMIER JOUR D'UN EXERCICE (arrêt à la
 * dissolution, son annulation, rattachement à la liquidation) · le serveur
 * refuse ce qu'il ne fera pas sans l'accord du cabinet, et son refus porte un
 * MARQUEUR · l'écran le lit, demande l'accord avec le refus sous les yeux, et
 * relance avec le champ qui le porte. Jamais d'office, jamais sans le refus.
 *
 * Deux accords. Retirer les actes calculés sur la période (relecture du
 * 2026-10-07, bloquant 1 · AUDCIF art. 59). Confirmer qu'une ouverture du
 * premier jour, annulée par un négatif inscrit plus tard, n'a pas été
 * ressaisie (second tour de relecture du paquet 1, BLOQUANT 2 · AUDCIF
 * art. 20, al. 2 ; art. 34) · sans quoi le refus « inscrivez-la en négatif »
 * tenait encore une fois le négatif inscrit.
 */
export interface AccordDissolution {
  /** Le marqueur que le refus du serveur porte (repris mot pour mot). */
  marqueur: string;
  /** Le champ du corps qui porte l'accord. */
  champ: 'retirerActesDeLaPeriode' | 'ouvertureAnnuleeNonRessaisie';
  /** La question posée sous le refus. */
  question: string;
}

export const ACCORDS_DISSOLUTION: readonly AccordDissolution[] = [
  {
    marqueur: 'en acceptant de retirer les actes de la période',
    champ: 'retirerActesDeLaPeriode',
    question: 'Retirer ces actes et relancer ?',
  },
  {
    marqueur: 'en confirmant que l’ouverture annulée n’est pas ressaisie',
    champ: 'ouvertureAnnuleeNonRessaisie',
    question: "Confirmer que l'ouverture annulée n'a pas été ressaisie, et relancer ?",
  },
];

/**
 * Envoie le geste, et sur un refus qui porte un marqueur d'accord non encore
 * donné, demande l'accord (`confirmer`, le refus et la question) puis relance
 * avec ce champ · chaque accord une fois au plus. Un refus sans marqueur, ou
 * un accord refusé, remonte tel quel.
 */
export async function envoyerAvecAccords<T>(
  envoyer: (corps: Record<string, unknown>) => Promise<T>,
  corpsInitial: Record<string, unknown>,
  confirmer: (message: string) => boolean,
  messageDe: (err: unknown) => string | null,
): Promise<T> {
  const corps: Record<string, unknown> = { ...corpsInitial };
  for (;;) {
    try {
      return await envoyer(corps);
    } catch (err) {
      const message = messageDe(err);
      const accord = message === null ? undefined : ACCORDS_DISSOLUTION.find((a) => corps[a.champ] !== true && message.includes(a.marqueur));
      if (!accord || !confirmer(`${message}\n\n${accord.question}`)) throw err;
      corps[accord.champ] = true;
    }
  }
}
