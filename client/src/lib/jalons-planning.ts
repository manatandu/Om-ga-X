import type { JalonCloture } from './types';
import { montant } from './montants';

/**
 * LES JALONS DU PLANNING DE CLÔTURE, LUS PAR L'ÉCRAN (relecture 1 des
 * décisions par la loi du 2026-10-04, point 2).
 *
 * Une échéance `null` a TROIS sens, que le serveur sépare et que l'écran ne
 * doit jamais confondre :
 * - NON CALCULÉE · la date déclarée qui fait courir le délai manque
 *   (assemblée, dépôt, nomination, régime) · c'est un MANQUE, jamais une
 *   bonne nouvelle ;
 * - AUCUN DÉLAI AU TEXTE (`sansDelai`) · le texte impose le travail sans
 *   fixer de délai (bilan avant liquidation, situation annuelle provisoire) ;
 * - LEVÉ · un fait déclaré satisfait le jalon (observation satisfaite) ;
 * - EN ATTENTE (`enAttente`) · le fait qui fait courir le délai ne peut pas
 *   encore exister (le dépôt pendant l'exercice), ou le délai suppose un
 *   commissaire aux comptes qu'aucun mandat ne montre (relecture 2).
 *
 * Lire une échéance non calculée comme « rien en retard » donnait au tableau
 * de bord un vert qu'aucune donnée ne fondait · le cabinet ne voyait pas
 * qu'il lui restait une date à déclarer.
 */

/** Le jalon attend une date déclarée pour être calculé. */
export function estNonCalcule(j: JalonCloture): boolean {
  return j.echeance === null && !j.sansDelai && !j.enAttente && !(j.observation?.satisfait ?? false);
}

/** Ce que la colonne « Échéance » écrit d'un jalon. */
export function libelleEcheance(j: JalonCloture): string {
  if (j.echeance !== null) return new Date(j.echeance).toLocaleDateString('fr-FR');
  if (j.sansDelai) return 'Aucun délai';
  if (j.enAttente) return j.enAttente;
  if (j.observation?.satisfait) return 'Sans échéance';
  return 'Non calculée';
}

/**
 * Le MONTANT d'un jalon qui en porte un (dividende prioritaire) · `null` sur
 * les autres. Quatre lectures, jamais confondues · EN ATTENTE du résultat
 * (exercice ouvert, résultat nul ou négatif), NON CALCULÉ (quote-part de
 * l'État non déclarée), PROVISOIRE (exercice ouvert), arrêté · et un zéro servi
 * est une RÉPONSE (aucun bénéfice), jamais un manque.
 */
export function libelleMontant(j: JalonCloture): string | null {
  if (j.montant === undefined) return null;
  if (j.montantEnAttente) return 'Montant en attente du résultat';
  if (j.montant === null) return 'Montant non calculé';
  return `${j.montantProvisoire ? 'Montant provisoire' : 'Montant'} · ${montant(j.montant)}`;
}

/**
 * Un montant NON CALCULÉ est un manque du dossier (la quote-part de l'État
 * n'est pas déclarée), compté comme une échéance non calculée · ni le montant
 * qui attend le résultat, ni celui d'un jalon en attente ou levé. Sans lui,
 * l'accueil disait vert alors que la quote-part manquait.
 */
export function montantNonCalcule(j: JalonCloture): boolean {
  return j.montant === null && !j.enAttente && !(j.observation?.satisfait ?? false);
}

type JalonDate = JalonCloture & { echeance: string };
const aUneEcheance = (j: JalonCloture): j is JalonDate => j.echeance !== null;

export interface LigneAccueil {
  valeur: string;
  bon: boolean;
}

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const nonCalculeesDites = (nonCalcules: JalonCloture[]) =>
  `Non calculée · ${nonCalcules[0].libelle}${nonCalcules.length > 1 ? ` (et ${nonCalcules.length - 1} autre(s))` : ''}`;
const montantsDits = (montants: JalonCloture[]) =>
  `Montant non calculé · ${montants[0].libelle}${montants.length > 1 ? ` (et ${montants.length - 1} autre(s))` : ''}`;

/**
 * Les deux lignes du tableau de bord. `jalons` vaut null tant que le planning
 * n'est pas lu · « Non déterminé », jamais favorable (audit final F254). Une
 * échéance non calculée n'est jamais « la prochaine » (elle n'a pas de date)
 * et n'est jamais verte.
 */
export function lignesJalonsAccueil(
  jalons: JalonCloture[] | null,
  aujourdHui: number,
): { retard: LigneAccueil; prochaine: LigneAccueil } {
  if (jalons === null) {
    return { retard: { valeur: 'Non déterminé', bon: false }, prochaine: { valeur: 'Non déterminé', bon: false } };
  }
  const enRetard = jalons.filter((j) => j.enRetard);
  const nonCalcules = jalons.filter(estNonCalcule);
  const montants = jalons.filter(montantNonCalcule);
  const retard: LigneAccueil =
    enRetard.length > 0
      ? { valeur: `${enRetard.length} en retard · ${enRetard[0].libelle}`, bon: false }
      : nonCalcules.length > 0
        ? { valeur: nonCalculeesDites(nonCalcules), bon: false }
        : montants.length > 0
          ? { valeur: montantsDits(montants), bon: false }
          : { valeur: 'Aucun jalon en retard', bon: true };
  const prochain = jalons.filter(aUneEcheance).find((j) => !j.enRetard && new Date(j.echeance).getTime() >= aujourdHui) ?? null;
  const prochaine: LigneAccueil = prochain
    ? { valeur: `${dateCourte(prochain.echeance)} · ${prochain.libelle}`, bon: nonCalcules.length === 0 && montants.length === 0 }
    : nonCalcules.length > 0
      ? { valeur: nonCalculeesDites(nonCalcules), bon: false }
      : montants.length > 0
        ? { valeur: montantsDits(montants), bon: false }
        : { valeur: 'Rien à venir', bon: true };
  return { retard, prochaine };
}

/** La couleur de l'observation · ambre pour un fait déclaré HORS DÉLAI, jamais un vert muet. */
export function classeObservation(o: { satisfait: boolean; horsDelai?: true }): string {
  if (!o.satisfait) return 'text-danger';
  return o.horsDelai ? 'text-warning' : 'text-positive';
}
