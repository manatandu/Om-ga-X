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

type Carnet = Record<string, { jeton: string; le: number }>;

function lire(): Carnet {
  try {
    const brut = localStorage.getItem(CLE);
    const carnet = brut ? (JSON.parse(brut) as unknown) : {};
    return carnet && typeof carnet === 'object' ? (carnet as Carnet) : {};
  } catch {
    return {};
  }
}

const cleDeLAdresse = (email: string) => email.trim().toLowerCase();

export function jetonDeLAppareil(email: string): string | undefined {
  const entree = lire()[cleDeLAdresse(email)];
  return typeof entree?.jeton === 'string' ? entree.jeton : undefined;
}

export function garderJetonDeLAppareil(email: string, jeton: string | undefined, maintenant = Date.now()): void {
  if (!jeton) return;
  try {
    const carnet = lire();
    carnet[cleDeLAdresse(email)] = { jeton, le: maintenant };
    const gardees = Object.entries(carnet)
      .sort(([, a], [, b]) => b.le - a.le)
      .slice(0, ADRESSES_GARDEES);
    localStorage.setItem(CLE, JSON.stringify(Object.fromEntries(gardees)));
  } catch {
    // Stockage indisponible · la connexion suivante subira la limite, rien de plus.
  }
}
