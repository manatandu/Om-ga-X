import { Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { PLAN_COMPTES_SYCEBNL } from './compte-seed';
import { PLAN_COMPTES_SYSCOHADA } from './compte-seed-syscohada';

/**
 * LE PLAN NORMALISÉ ET CE QUE LE DOSSIER OUVRE SOUS LUI (décision de Manasse
 * du 2026-10-09 · « les écritures n'admettraient que les comptes personnalisés
 * du dossier »). Un cabinet qui ouvre 52110001 « BCDC » et 52110002 « Rawbank »
 * sous le 52110000 semé ne doit plus pouvoir saisir au 52110000 · une remise
 * passée au compte commun n'appartient à aucune banque, et le rapprochement,
 * la circularisation et le contrôle des comptes de banque ne la voient pas,
 * sans qu'aucun total ne bouge.
 *
 * Sage tient la règle par le type du compte · le parent devient un compte
 * TOTAL, que la saisie refuse (skill `sage-i7`, comptabilite-generale.md).
 * OmegaX ne peut pas la tenir ainsi · le plan est semé à huit chiffres
 * (§ 7 de CLAUDE.md), et le 52110001 ne commence pas par 52110000. La règle
 * se lit donc par RACINE · le numéro officiel du compte semé (5211), dont le
 * compte du dossier est une subdivision quand il commence par lui.
 *
 * LA RACINE D'UN COMPTE SEMÉ N'EST PAS SON NUMÉRO DÉPOUILLÉ DE SES ZÉROS · le
 * 49000000 SYSCOHADA est le compte 490 « Dépréciations des comptes
 * fournisseurs », sous le TOTAL 49 ; dépouillé, il deviendrait 49 et prendrait
 * pour siens le 4911 et le 4991 de tout le monde. La racine est le plus court
 * préfixe, au moins aussi long que le numéro dépouillé, qui n'est pas un TOTAL
 * semé · un même numéro ne peut être à la fois total et compte d'imputation.
 * Huit comptes au SYCEBNL (280, 350, 490, 590, 680, 870, 900, 910), deux au
 * SYSCOHADA (490, 590), gelés par le spec.
 *
 * Rien ici ne lit la base · le module ne dit que ce que le plan SEMÉ du
 * référentiel dit, numéro par numéro.
 */

type LignePlan = { numero: string; typeCompte?: TypeCompteDetailTotal };

type Racines = {
  /** Numéro semé d'un compte d'imputation → sa racine officielle. */
  racineDuDetail: Map<string, string>;
  /** Toutes les racines semées · un total est sa propre racine. */
  racines: { racine: string; numero: string; detail: boolean }[];
  /** Tous les numéros semés, totaux compris. */
  semes: Set<string>;
};

const CACHE = new Map<Referentiel, Racines>();

function planDu(referentiel: Referentiel): LignePlan[] {
  return referentiel === Referentiel.SYSCOHADA ? PLAN_COMPTES_SYSCOHADA : PLAN_COMPTES_SYCEBNL;
}

function racinesDu(referentiel: Referentiel): Racines {
  const deja = CACHE.get(referentiel);
  if (deja) return deja;
  const plan = planDu(referentiel);
  const totaux = new Set(plan.filter((c) => c.typeCompte === TypeCompteDetailTotal.TOTAL).map((c) => c.numero));
  const racineDuDetail = new Map<string, string>();
  const racines: Racines['racines'] = [];
  for (const c of plan) {
    if (c.typeCompte === TypeCompteDetailTotal.TOTAL) {
      racines.push({ racine: c.numero, numero: c.numero, detail: false });
      continue;
    }
    const depouille = c.numero.replace(/0+$/, '');
    let longueur = Math.max(depouille.length, 2);
    while (longueur < c.numero.length && totaux.has(c.numero.slice(0, longueur))) longueur += 1;
    const racine = c.numero.slice(0, longueur);
    racineDuDetail.set(c.numero, racine);
    racines.push({ racine, numero: c.numero, detail: true });
  }
  // La plus longue racine d'abord · le parent d'un numéro est la PREMIÈRE
  // racine qui le préfixe.
  racines.sort((a, b) => b.racine.length - a.racine.length || a.racine.localeCompare(b.racine));
  const resultat = { racineDuDetail, racines, semes: new Set(plan.map((c) => c.numero)) };
  CACHE.set(referentiel, resultat);
  return resultat;
}

/** Le numéro appartient-il au plan semé du référentiel, total ou détail ? */
export function estCompteSeme(referentiel: Referentiel, numero: string): boolean {
  return racinesDu(referentiel).semes.has(numero);
}

/**
 * Racine officielle d'un compte d'imputation SEMÉ, ou null si le numéro n'en
 * est pas un (compte du dossier, total, autre référentiel).
 */
export function racineDuCompteSeme(referentiel: Referentiel, numero: string): string | null {
  return racinesDu(referentiel).racineDuDetail.get(numero) ?? null;
}

/**
 * Le compte semé dont un numéro du DOSSIER est la subdivision · le compte
 * semé à la plus longue racine qui le préfixe, s'il est un compte
 * d'imputation. Null pour un numéro semé, pour un numéro rangé sous un TOTAL
 * (52120000 sous 521 n'est la subdivision d'aucun compte d'imputation), et
 * pour un numéro hors de toute racine.
 */
export function compteSemeSubdivise(referentiel: Referentiel, numero: string): string | null {
  const { racines, semes } = racinesDu(referentiel);
  if (semes.has(numero)) return null;
  const parent = racines.find((r) => numero.startsWith(r.racine));
  return parent && parent.detail ? parent.numero : null;
}

/**
 * Les racines semées PLUS PROFONDES que celle d'un compte d'imputation et qui
 * commencent par elle · un numéro qui commence par l'une d'elles relève d'un
 * autre compte semé. Trois comptes d'imputation du SYCEBNL en ont, tels que
 * le plan les écrit (Partie 2 ch. 2) · 4478 (44781 à 44785), 831 (8311,
 * 8315) et 841 (8411, 8412, 8415) ; le 83110001 du dossier relève du 8311,
 * jamais du 831. Aucun au SYSCOHADA. Gelés par le spec.
 */
export function racinesSousLeCompteSeme(referentiel: Referentiel, numero: string): string[] {
  const racine = racineDuCompteSeme(referentiel, numero);
  if (racine === null) return [];
  return racinesDu(referentiel)
    .racines.filter((r) => r.numero !== numero && r.racine.length > racine.length && r.racine.startsWith(racine))
    .map((r) => r.racine);
}

/**
 * Les comptes d'imputation SEMÉS dont le numéro commence par un préfixe · la
 * classe 5 pour le compte propre d'un journal de banque ou de caisse.
 */
export function comptesDImputationSemes(referentiel: Referentiel, prefixe: string): string[] {
  return [...racinesDu(referentiel).racineDuDetail.keys()].filter((n) => n.startsWith(prefixe)).sort();
}

/**
 * LE NUMÉRO QU'UN SOUS-COMPTE PRENDRAIT sous un compte d'imputation semé ·
 * le premier libre sous sa racine, à la longueur du dossier (52110000 →
 * 52110001), jamais un numéro semé, ni un numéro rangé sous une racine semée
 * plus profonde (le 8311 du SYCEBNL relève du 8311, pas du 831). Null quand
 * le numéro n'est pas un compte d'imputation semé, ou quand plus rien n'est
 * libre à cette longueur. Le numéro n'est PAS réservé · la création le
 * rejuge (unicité en base).
 */
export function sousComptePropose(
  referentiel: Referentiel,
  numeroSeme: string,
  longueur: number,
  existants: Iterable<string>,
): string | null {
  const racine = racineDuCompteSeme(referentiel, numeroSeme);
  if (racine === null) return null;
  const largeur = longueur - racine.length;
  if (largeur < 1) return null;
  const { semes } = racinesDu(referentiel);
  const plusProfondes = racinesSousLeCompteSeme(referentiel, numeroSeme);
  const pris = new Set(existants);
  const max = 10 ** largeur - 1;
  for (let i = 1; i <= max; i++) {
    const numero = racine + String(i).padStart(largeur, '0');
    if (pris.has(numero) || semes.has(numero)) continue;
    if (plusProfondes.some((r) => numero.startsWith(r))) continue;
    return numero;
  }
  return null;
}

/** Tous les numéros semés du référentiel, totaux compris · le plan officiel tel que le dossier l'a reçu. */
export function numerosSemes(referentiel: Referentiel): string[] {
  return [...racinesDu(referentiel).semes];
}

/**
 * LES COMPTES DE PASSAGE (585 « Virements de fonds », 588 « Autres virements
 * internes ») ne tombent jamais sous la règle du compte subdivisé · « comptes
 * de passage », « soldés au terme de leur utilisation » (AUDCIF Titre VII et
 * SYCEBNL Partie 2 ch. 3, compte 58), ils ne gardent aucun solde qu'un
 * sous-compte devrait porter à sa place. Le virement de fonds ouvre ses quatre
 * comptes sous le 585 (virements-fonds/) · sans l'exemption, le 58500000 se
 * fermait à la saisie, et avec lui les transferts du siège et des cellules
 * d'un groupe SYCEBNL qui y passent (groupe/canevas-tresorerie.ts).
 */
export function estCompteDePassage(numero: string): boolean {
  return numero.startsWith('585') || numero.startsWith('588');
}

/**
 * LES COMPTES DU PLAN QUE LE DOSSIER SUBDIVISE · même règle que la saisie
 * (`EcritureService.verifierComptesCollectifs`), lue sur la liste du dossier ·
 * le compte semé sous la racine duquel le dossier a ouvert un compte
 * d'imputation ACTIF. Le Plan comptable le dit, pour qu'un compte que la
 * saisie refuse ne s'y présente pas comme admis.
 */
export function comptesDuPlanSubdivises(
  referentiel: Referentiel,
  comptes: readonly { numero: string; typeCompte: TypeCompteDetailTotal | string; estActif: boolean }[],
): Set<string> {
  const subdivises = new Set<string>();
  for (const c of comptes) {
    if (c.typeCompte !== TypeCompteDetailTotal.DETAIL || !c.estActif) continue;
    const parent = compteSemeSubdivise(referentiel, c.numero);
    if (parent && !estCompteDePassage(parent)) subdivises.add(parent);
  }
  return subdivises;
}
