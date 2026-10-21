/**
 * VISA D'UN RIB PAR UN SECOND UTILISATEUR · ce que l'écran lit du serveur
 * (`tiers/visa-rib.ts`). Aucune règle ici · qui peut viser, ce qui fait
 * tomber le visa et le refus de l'ordre de virement sont jugés au serveur ;
 * l'écran ne fait que montrer l'état et renvoyer l'instant qu'il a montré.
 */

export interface VisaRibLu {
  /** L'option du dossier · l'ordre de virement exige-t-il ce visa ? */
  exige: boolean;
  vise: boolean;
  visePar: string | null;
  viseLe: string | null;
  saisiPar: string | null;
  saisiLe: string | null;
  /** L'utilisateur de la session a saisi ces coordonnées en dernier. */
  saisiParVous: boolean;
}

const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

/** L'état du visa en une ligne · « Visé par … le … », ou « Non visé ». */
export function etatDuVisa(v: VisaRibLu): string {
  if (v.vise) {
    const vise = `Visé par ${v.visePar ?? 'un utilisateur'}${v.viseLe ? ` le ${jour(v.viseLe)}` : ''}`;
    // Saisi avant la règle · le visa ne garantit pas un second regard, et la ligne le garde dit.
    return v.saisiPar ? vise : `${vise} · auteur de la saisie inconnu`;
  }
  return v.exige ? 'Non visé · exigé pour les virements' : 'Non visé';
}

/** Qui a saisi les coordonnées, pour l'infobulle · « auteur inconnu » pour un RIB d'avant la règle. */
export function auteurDeLaSaisie(v: VisaRibLu): string {
  if (!v.saisiPar) return "Coordonnées saisies avant le visa des RIB · auteur inconnu d'OmegaX";
  return `Coordonnées saisies par ${v.saisiPar}${v.saisiLe ? ` le ${jour(v.saisiLe)}` : ''}`;
}

/** Le bouton « Viser » ne s'offre qu'à qui peut valider, sur un RIB non visé qu'il n'a pas saisi. */
export function peutViser(v: VisaRibLu | undefined, peutValider: boolean): boolean {
  return v !== undefined && peutValider && !v.vise && !v.saisiParVous;
}

/** Le corps du visa · l'instant de la saisie montrée, que le serveur confronte à la base (409 sinon). */
export function corpsDuVisa(v: VisaRibLu): { saisiLeLu: string | null } {
  return { saisiLeLu: v.saisiLe };
}

/**
 * La source citée dans la bulle, selon le référentiel du dossier · l'art. 69 de
 * l'AUDCIF est exclu par l'art. 3 du SYCEBNL, et les deux chemins ne se servent
 * jamais l'un pour l'autre (CLAUDE.md, § 10 ter).
 */
export function sourceDuVisa(referentiel: string | undefined): string {
  if (referentiel === 'SYCEBNL') return "Option d'OmegaX · aucun texte ne l'impose (SYCEBNL art. 16, 2))";
  if (referentiel === 'SYSCOHADA') return "Option d'OmegaX · aucun texte ne l'impose (AUDCIF art. 69)";
  return "Option d'OmegaX · aucun texte ne l'impose";
}
