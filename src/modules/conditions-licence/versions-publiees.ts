import { texteBrutDesConditions } from './conditions-de-licence';
import { sha256Hex } from './empreinte';
import { TEXTE_VERSION_1 } from './versions/version-1';

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

export const VERSIONS_PUBLIEES: readonly VersionPubliee[] = [
  {
    numero: 1,
    date: '2026-10-15',
    dateLisible: '15 octobre 2026',
    communiqueeLe: null,
    enVigueurLe: '2026-10-15',
    empreinte: '1a878fe68d79ec76fa40173395750ab68cbf8a1a581c91397e45b30815dac75d',
    texte: TEXTE_VERSION_1,
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
