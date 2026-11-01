import type { RapportControles } from './controles.service';

/**
 * LA SYNTHÈSE DES CONTRÔLES · ce que l'accueil montre, et rien de plus
 * (ligne commercial-site, relecture du 2026-11-01).
 *
 * L'accueil est monté pour toute tuile. Il lisait le rapport COMPLET
 * (`GET /controles`), dont les occurrences portent comptes, tiers, pièces et
 * montants · ouvert à toute tuile, il donnait à un utilisateur « Paie » ce que
 * le serveur lui refuse partout ailleurs. La synthèse ne rend que des
 * COMPTEURS et l'intitulé de la première anomalie qui n'est pas une
 * information (un libellé de règle, jamais une donnée du dossier) · le
 * rapport complet reste à la Comptabilité et à la Révision.
 */
export interface SyntheseControles {
  exerciceId: string;
  genereLe: string;
  totaux: { bloquants: number; avertissements: number; informations: number };
  premiereAnomalie: { code: string; gravite: string; libelle: string } | null;
}

export function syntheseDuRapport(r: RapportControles): SyntheseControles {
  const premiere = r.anomalies.find((a) => a.gravite !== 'INFORMATION') ?? null;
  return {
    exerciceId: r.exerciceId,
    genereLe: r.genereLe,
    totaux: { ...r.totaux },
    premiereAnomalie: premiere ? { code: premiere.code, gravite: premiere.gravite, libelle: premiere.libelle } : null,
  };
}
