/**
 * L'APPAREIL RECONNU (audit de sécurité du 2026-11-19) · le serveur limite les
 * essais de connexion PAR ADRESSE E-MAIL, et l'appareil où la personne s'est
 * déjà connectée n'en est pas freiné · sans quoi dix essais d'un inconnu
 * toutes les dix minutes tiendraient le titulaire dehors. Le jeton, rendu par
 * la connexion réussie, se garde ICI, par adresse, et repart avec la
 * connexion suivante. Il n'ouvre rien · ni session, ni verrou, ni second
 * facteur. Un stockage absent ou plein (navigation privée) le perd, et la
 * connexion marche quand même · elle subit seulement la limite.
 */
const CLE = 'omegax:appareils';
/** Un poste partagé garde au plus dix adresses · la plus ancienne part. */
export const ADRESSES_GARDEES = 10;
/**
 * Quatre-vingt-dix jours, la durée de vie que le serveur donne au jeton
 * (`JOURS_JETON_APPAREIL`, limite-par-adresse.ts) · au-delà il ne vaut plus
 * rien, et le carnet l'oublie (relecture du 2026-11-20, E4).
 */
export const JOURS_GARDES = 90;
const MS_GARDES = JOURS_GARDES * 86_400_000;

type Carnet = Record<string, { jeton: string; le: number }>;

function lire(maintenant = Date.now()): Carnet {
  try {
    const brut = localStorage.getItem(CLE);
    const carnet = brut ? (JSON.parse(brut) as unknown) : {};
    if (!carnet || typeof carnet !== 'object') return {};
    // Une entrée de plus de quatre-vingt-dix jours, ou sans date lisible, est oubliée.
    return Object.fromEntries(
      Object.entries(carnet as Carnet).filter(([, e]) => typeof e?.le === 'number' && maintenant - e.le <= MS_GARDES),
    );
  } catch {
    return {};
  }
}

const cleDeLAdresse = (email: string) => email.trim().toLowerCase();

export function jetonDeLAppareil(email: string, maintenant = Date.now()): string | undefined {
  const entree = lire(maintenant)[cleDeLAdresse(email)];
  return typeof entree?.jeton === 'string' ? entree.jeton : undefined;
}

export function garderJetonDeLAppareil(email: string, jeton: string | undefined, maintenant = Date.now()): void {
  if (!jeton) return;
  try {
    const carnet = lire(maintenant);
    carnet[cleDeLAdresse(email)] = { jeton, le: maintenant };
    const gardees = Object.entries(carnet)
      .sort(([, a], [, b]) => b.le - a.le)
      .slice(0, ADRESSES_GARDEES);
    localStorage.setItem(CLE, JSON.stringify(Object.fromEntries(gardees)));
  } catch {
    // Stockage indisponible · la connexion suivante subira la limite, rien de plus.
  }
}
