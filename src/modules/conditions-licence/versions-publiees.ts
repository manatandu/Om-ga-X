import { texteBrutDesConditions } from './conditions-de-licence';
import { sha256Hex } from './empreinte';
import { TEXTE_VERSION_3 } from './versions/version-3';

/**
 * LES VERSIONS PUBLIÉES DES CONDITIONS DE LICENCE · numéro, date, empreinte
 * et TEXTE, archivés dans le code (relecture « échecs silencieux » de la ligne
 * pages-legales, M2). Rien ne liait un numéro à un texte · le générateur
 * (`conditions-de-licence.ts`) pouvait changer sous le même numéro, et une
 * version acceptée devenait illisible le jour où elle cessait d'être la
 * version en vigueur, alors que le contrat promet l'une et l'autre (articles
 * 15 et 18 ; Code du numérique, art. 53, 9°).
 *
 * TROIS RÈGLES, TENUES PAR `versions-publiees.spec.ts`.
 *  1. Le texte de chaque version est ARCHIVÉ MOT POUR MOT (`versions/`), et
 *     son empreinte est gelée dans le spec · une retouche sans version
 *     nouvelle le fait tomber.
 *  2. La version en vigueur est la DERNIÈRE de la liste, et le générateur
 *     rend exactement son texte archivé.
 *  3. Une version après la première est une MODIFICATION · art. 34, projet
 *     communiqué au moins trente jours ouvrables avant l'entrée en vigueur
 *     (`delais-article-34.ts`). Tant qu'une seule version existe, la bascule
 *     d'une version à la suivante (acceptation de N maintenue jusqu'à la prise
 *     d'effet de N+1, au terme des soixante jours ouvrables) n'est pas servie,
 *     et le spec refuse une seconde version tant qu'elle ne l'est pas.
 *
 * Pas de table · le texte vit dans le code, archivé à côté du générateur, et
 * se lit des deux côtés. L'acceptation garde le numéro ET l'empreinte du texte
 * accepté (`Tenant.conditionsLicenceEmpreinte`).
 */
export interface VersionPubliee {
  numero: number;
  /** AAAA-MM-JJ · la date de la version. */
  date: string;
  dateLisible: string;
  /**
   * Art. 34 · le jour où le projet de modification a été communiqué aux
   * utilisateurs, par écrit ou sur un support durable. `null` pour la première
   * version, qui est l'offre initiale et non une modification.
   */
  communiqueeLe: string | null;
  /** AAAA-MM-JJ · l'entrée en vigueur de la version. */
  enVigueurLe: string;
  /** SHA-256 du texte, en hexadécimal minuscule. */
  empreinte: string;
  texte: string;
}

/**
 * LES VERSIONS RETIRÉES · publiées puis retirées SANS avoir jamais pu être
 * acceptées. Leur texte n'est plus servi, seuls leur numéro, leur date et leur
 * empreinte restent, pour que la suite des numéros garde son sens et qu'un
 * numéro ne serve jamais deux textes.
 *
 * LA VERSION 1 (décision de Manasse du 2026-10-28, « retirer tout ce qui
 * concerne » l'ancien éditeur, tranchée par la loi) · son offre est restée
 * INCOMPLÈTE depuis sa publication (identité de l'éditeur, réclamations,
 * paiement « à arrêter »), si bien que le serveur en a toujours refusé
 * l'acceptation (`mentionsAArreter`, art. 54, al. 2). Aucun contrat ne s'est
 * formé sur elle · l'archivage de l'art. 53, 9° vise « le contrat » et
 * l'art. 34 « un contrat en cours ». La garder accessible ferait au
 * contraire durer une offre que son auteur ne tient plus (art. 53, al. 2,
 * « son auteur reste engagé par elle tant qu'elle est accessible »). Son
 * texte reste dans l'historique du dépôt.
 *
 * Une version ACCEPTABLE ne se retire jamais ainsi · elle se remplace par une
 * version nouvelle, aux délais de l'art. 34 (`versions-publiees.spec.ts`).
 */
export interface VersionRetiree {
  numero: number;
  date: string;
  empreinte: string;
  motif: string;
}

export const VERSIONS_RETIREES: readonly VersionRetiree[] = [
  {
    numero: 1,
    date: '2026-10-15',
    empreinte: '1a878fe68d79ec76fa40173395750ab68cbf8a1a581c91397e45b30815dac75d',
    motif: 'Offre restée incomplète, jamais acceptable · retirée le 2026-10-28 avec le nom de l’ancien éditeur.',
  },
  // LA VERSION 2 (décision de Manasse du 2026-10-29, « Nomme l'éditeur xxx ») ·
  // même raison que la version 1 · son offre est restée incomplète (art. 54,
  // al. 2), aucun contrat ne s'est formé sur elle, et le logiciel n'est pas sur
  // le marché. Son texte reste dans l'historique du dépôt.
  {
    numero: 2,
    date: '2026-10-28',
    empreinte: 'f980b6ce005f83bcc6610892deb519c9c8b154e6202f34ac0954e4bd33217f9e',
    motif: 'Offre restée incomplète, jamais acceptable · remplacée le 2026-10-29 par la version 3, qui nomme l’éditeur xxx.',
  },
];

export const VERSIONS_PUBLIEES: readonly VersionPubliee[] = [
  {
    numero: 3,
    date: '2026-10-29',
    dateLisible: '29 octobre 2026',
    // Aucune communication de l'art. 34 · elle ne suit que des versions
    // retirées, sur lesquelles aucun contrat ne s'est formé.
    communiqueeLe: null,
    enVigueurLe: '2026-10-29',
    empreinte: 'deae0898432fb16cc14b5b3328caf015c22030b1dac180a93d697940562a2bff',
    texte: TEXTE_VERSION_3,
  },
];

/** La version publiée de ce numéro, ou `null` · un numéro que l'archive ne connaît pas n'a pas de texte. */
export function versionPubliee(numero: number): VersionPubliee | null {
  return VERSIONS_PUBLIEES.find((v) => v.numero === numero) ?? null;
}

let empreinteMemorisee: string | null = null;

/**
 * L'empreinte du texte que CE code affiche et joint, CALCULÉE sur lui, jamais
 * recopiée de l'archive · le serveur et l'écran la comparent avant toute
 * acceptation (relecture M1), et deux constructions qui ne servent pas le
 * même texte ne s'accordent pas.
 */
export function empreinteEnVigueur(): string {
  if (empreinteMemorisee === null) empreinteMemorisee = sha256Hex(texteBrutDesConditions());
  return empreinteMemorisee;
}
