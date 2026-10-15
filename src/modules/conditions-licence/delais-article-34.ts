import { jourFerie } from '../retenues/jour-ouvrable';
import type { VersionPubliee } from './versions-publiees';

/**
 * LES DÉLAIS DE L'ART. 34 DU CODE DU NUMÉRIQUE (ordonnance-loi n° 23/10 du
 * 13 mars 2023) · « Le projet de modification [...] est communiqué [...] au
 * moins trente (30) jours ouvrables avant son entrée en vigueur », les
 * utilisateurs peuvent résilier sans pénalité « jusqu'à un délai de soixante
 * (60) jours ouvrables après l'entrée en vigueur de la modification », et
 * « La modification ne prend effet qu'à l'issue de ce délai de soixante (60)
 * jours ouvrables. » Le contrat le reprend à son article 15.
 *
 * LE CODE NE DÉFINIT PAS LE JOUR OUVRABLE (relu le 2026-10-15) · le samedi
 * est ouvrable au sens du Code du travail (art. 7, point 9), non au guichet
 * de l'Administration (décret n° 24/09). Le délai protège l'utilisateur ·
 * OmegaX retient la lecture qui le rend le PLUS LONG, du lundi au vendredi,
 * sans les dix jours fériés de l'ordonnance n° 23-042 (`jourFerie`), et le
 * jour de la communication comme celui de l'entrée en vigueur hors du compte.
 * Une règle de protection ne se tranche pas contre celui qu'elle protège
 * (CLAUDE.md, P5) · l'autre lecture ne raccourcit jamais ce délai-ci.
 */

const UN_JOUR_MS = 24 * 3600 * 1000;

function enDate(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`);
}

function enJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function estOuvrableProtecteur(d: Date): boolean {
  const j = d.getUTCDay();
  return j !== 0 && j !== 6 && jourFerie(d) === null;
}

/** Le N-ième jour ouvrable APRÈS `jour` (AAAA-MM-JJ), `jour` exclu. */
export function nIemeJourOuvrableApres(jour: string, n: number): string {
  let d = enDate(jour);
  let compte = 0;
  while (compte < n) {
    d = new Date(d.getTime() + UN_JOUR_MS);
    if (estOuvrableProtecteur(d)) compte += 1;
  }
  return enJour(d);
}

/**
 * Le premier jour où une version communiquée le `communiqueeLe` peut entrer en
 * vigueur · le lendemain du trentième jour ouvrable qui suit la communication,
 * trente jours ouvrables pleins s'étant écoulés entre les deux.
 */
export function entreeEnVigueurAuPlusTot(communiqueeLe: string): string {
  return enJour(new Date(enDate(nIemeJourOuvrableApres(communiqueeLe, 30)).getTime() + UN_JOUR_MS));
}

/** Le dernier jour de la faculté de résilier sans pénalité, et la veille de la prise d'effet. */
export function finDuDelaiDeResiliation(enVigueurLe: string): string {
  return nIemeJourOuvrableApres(enVigueurLe, 60);
}

/** Le jour où la modification prend effet · le lendemain du soixantième jour ouvrable après l'entrée en vigueur. */
export function priseDEffet(enVigueurLe: string): string {
  return enJour(new Date(enDate(finDuDelaiDeResiliation(enVigueurLe)).getTime() + UN_JOUR_MS));
}

/** Pourquoi une version publiée viole l'art. 34, ou `null`. La première version, offre initiale, n'est pas une modification. */
export function motifDelaiArticle34(v: Pick<VersionPubliee, 'numero' | 'communiqueeLe' | 'enVigueurLe'>): string | null {
  if (v.numero === 1) return v.communiqueeLe === null ? null : 'La première version est l’offre initiale · elle n’a pas de communication de l’art. 34.';
  if (v.communiqueeLe === null) {
    return `La version ${v.numero} modifie le contrat · la date de communication de son projet aux utilisateurs est exigée (Code du numérique, art. 34).`;
  }
  const auPlusTot = entreeEnVigueurAuPlusTot(v.communiqueeLe);
  if (v.enVigueurLe < auPlusTot) {
    return (
      `La version ${v.numero}, communiquée le ${v.communiqueeLe}, ne peut entrer en vigueur avant le ${auPlusTot} · ` +
      'trente jours ouvrables au moins (Code du numérique, art. 34).'
    );
  }
  return null;
}
