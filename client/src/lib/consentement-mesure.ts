/**
 * LE CONSENTEMENT À LA MESURE DE L'INTERFACE · ce qui ouvre Sentry et PostHog
 * dans le navigateur.
 *
 * DÉCISION PAR LA LOI (2026-10-17) · le Code du numérique (ordonnance-loi
 * n° 23/10 du 13 mars 2023) ne connaît que DEUX fondements à un traitement de
 * données personnelles, art. 192 · « la personne concernée a consenti au
 * traitement » ou « le traitement est nécessaire à l'exécution d'une
 * obligation légale ». Le navigateur qui écrit à Sentry et à PostHog leur
 * montre son adresse réseau, une donnée personnelle, et aucune loi n'oblige
 * VMG Consulting à mesurer la fréquentation de son interface · reste le
 * consentement. D'où trois règles.
 *
 *  · RIEN NE PART AVANT LA RÉPONSE · le choix vaut `null` tant que la
 *    personne n'a pas répondu, et `null` n'est pas un accord.
 *  · RETIRER EST AUSSI SIMPLE QUE DONNER (art. 196, al. 3) · le même bandeau
 *    se rouvre par « Préférences relatives aux témoins », en bas de l'écran
 *    d'ouverture, des pages publiques et de la politique.
 *  · LE CHOIX GARDE SA DATE ET LA VERSION DE LA POLITIQUE (art. 196, al. 1er,
 *    le responsable « est en mesure de démontrer » le consentement) · il vit
 *    dans le stockage local de CET appareil, que VMG Consulting ne lit pas.
 *    Limite écrite · la preuve reste sur l'appareil de la personne.
 *
 * Les erreurs du SERVEUR ne passent pas par ici · elles partent de Cloud Run,
 * nettoyées, sans l'adresse de la personne (src/common/telemetrie/).
 */

export type ChoixMesure = 'accepte' | 'refuse';

export interface ConsentementMesure {
  choix: ChoixMesure;
  /** Instant du choix, ISO 8601. */
  le: string;
  /** Date de mise à jour de la politique lue au moment du choix. */
  politique: string;
}

export const CLE_CONSENTEMENT_MESURE = 'omegax.consentement-mesure';

/** Événement de la fenêtre qui rouvre le bandeau (préférences). */
export const EVENEMENT_PREFERENCES_MESURE = 'omegax:preferences-mesure';

/** Lu, jamais deviné · une valeur illisible vaut une question non posée. */
export function lireConsentement(stockage: () => Pick<Storage, 'getItem'>): ConsentementMesure | null {
  try {
    const brut = stockage().getItem(CLE_CONSENTEMENT_MESURE);
    if (!brut) return null;
    const v = JSON.parse(brut) as Partial<ConsentementMesure>;
    if ((v.choix !== 'accepte' && v.choix !== 'refuse') || typeof v.le !== 'string' || typeof v.politique !== 'string') return null;
    return { choix: v.choix, le: v.le, politique: v.politique };
  } catch {
    // Fenêtre privée, stockage bloqué · la question se repose, rien ne part.
    return null;
  }
}

/** Écrit le choix · rend faux si le stockage le refuse (le choix ne vaut alors que pour cette page). */
export function enregistrerConsentement(
  stockage: () => Pick<Storage, 'setItem'>,
  choix: ChoixMesure,
  politique: string,
  maintenant: Date,
): boolean {
  try {
    const valeur: ConsentementMesure = { choix, le: maintenant.toISOString(), politique };
    stockage().setItem(CLE_CONSENTEMENT_MESURE, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

/** La mesure ne démarre que sur un accord LU · `null` et le refus valent non. */
export function mesureAutorisee(consentement: ConsentementMesure | null): boolean {
  return consentement?.choix === 'accepte';
}

/** Le bandeau se montre quand la mesure existe sur cette construction et que personne n'a encore répondu. */
export function bandeauAMontrer(mesureDisponible: boolean, consentement: ConsentementMesure | null): boolean {
  return mesureDisponible && consentement === null;
}
