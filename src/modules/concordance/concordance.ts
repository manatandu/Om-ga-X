/**
 * LA CONCORDANCE DES MODULES AVEC LA COMPTABILITÉ (ligne microfina-m1,
 * idée 12 · Microfina++, « contrôle des comptes » gestion / comptabilité,
 * M p. 136, 162, 163).
 *
 * UN ÉCRAN, EN LECTURE SEULE, QUI RELIT CE QUE LES MODULES CONFRONTENT DÉJÀ ·
 * il ne recalcule aucune confrontation, il appelle celle que chaque module
 * tient (le registre des biens face à la balance, le registre des provisions
 * face à ses comptes, les créances douteuses face au 416 et au 491, les cumuls
 * analytiques face aux mouvements généraux, le dernier relevé de chaque
 * banque face à son solde pointé). Il ne corrige rien · un écart se règle
 * dans son module, que la ligne nomme.
 *
 * PAR LA LOI · aucun texte n'impose un tel écran. Il sert le contrôle que
 * l'AUDCIF art. 69 laisse à l'entité (SYSCOHADA) et que le SYCEBNL demande
 * par son art. 16, 2) (« un contrôle interne fiable »), et l'inventaire de
 * l'art. 42 (« le recensement et l'évaluation de ses biens, créances et
 * dettes »), non écarté par l'art. 3 du SYCEBNL · convention d'OmegaX pour
 * la forme.
 *
 * TROIS ÉTATS, ET « NON CALCULÉ » N'EST JAMAIS UN ZÉRO (CLAUDE.md § 9 ter) ·
 * une confrontation que le module refuse (exercice illisible, registre trop
 * long, plan absent), ou qu'aucun module ne tient, se dit avec son motif.
 * Lu comme « concorde », un refus serait la réponse favorable à la question
 * que l'écran pose.
 */

export type EtatConcordance = 'CONCORDE' | 'ECART' | 'NON_CALCULE' | 'SANS_OBJET';

/** Une ligne confrontée · le montant du module et celui de la comptabilité, dans le même sens. */
export interface LigneConcordance {
  /** Le compte, ou ce que le module confronte (un plan analytique, une banque). */
  reference: string;
  intitule: string;
  module: number | null;
  comptabilite: number | null;
  /** Comptabilité moins module · `null` dès que l'un des deux manque. */
  ecart: number | null;
}

export interface FamilleConcordance {
  cle: string;
  libelle: string;
  /** Ce que la colonne « module » lit, et l'écran où l'écart se règle. */
  source: string;
  ecran: string;
  /** Le chemin de l'écran dans le logiciel, pour l'ouvrir d'un clic. */
  chemin: string;
  etat: EtatConcordance;
  /** Le motif d'un « non calculé » ou d'un « sans objet ». */
  motif: string | null;
  lignes: LigneConcordance[];
  /** Ce que le module dit à côté de ses nombres · rien n'est recalculé ici. */
  mentions: string[];
}

const centimes = (n: number) => Math.round(n * 100);

/** Une ligne, l'écart pris au centime · un des deux montants absent, l'écart l'est aussi. */
export function ligne(reference: string, intitule: string, module: number | null, comptabilite: number | null): LigneConcordance {
  const ecart = module === null || comptabilite === null ? null : (centimes(comptabilite) - centimes(module)) / 100;
  return { reference, intitule, module, comptabilite, ecart };
}

/**
 * L'état d'une famille, lu sur ses lignes · une seule ligne non calculée suffit
 * à ne rien affirmer de la famille ; sans ligne, rien à confronter.
 */
export function etatDesLignes(lignes: readonly LigneConcordance[]): EtatConcordance {
  if (lignes.length === 0) return 'SANS_OBJET';
  if (lignes.some((l) => l.ecart === null)) return 'NON_CALCULE';
  return lignes.some((l) => l.ecart !== 0) ? 'ECART' : 'CONCORDE';
}

/** Une famille calculée · son état se lit sur ses lignes, le motif d'une famille vide est dit. */
export function famille(
  entete: Pick<FamilleConcordance, 'cle' | 'libelle' | 'source' | 'ecran' | 'chemin'>,
  lignes: LigneConcordance[],
  mentions: string[] = [],
  motifSansLigne = 'Rien à confronter sur cet exercice.',
): FamilleConcordance {
  const etat = etatDesLignes(lignes);
  return {
    ...entete,
    etat,
    motif: etat === 'SANS_OBJET' ? motifSansLigne : etat === 'NON_CALCULE' ? 'Une ligne au moins n’a pas pu être confrontée · voir les montants absents.' : null,
    lignes,
    mentions,
  };
}

/** Une famille que le module refuse de confronter, ou qu'aucun module ne tient · son motif dit. */
export function nonCalculee(entete: Pick<FamilleConcordance, 'cle' | 'libelle' | 'source' | 'ecran' | 'chemin'>, motif: string): FamilleConcordance {
  return { ...entete, etat: 'NON_CALCULE', motif, lignes: [], mentions: [] };
}

/** La synthèse · une famille non calculée ne se compte jamais parmi celles qui concordent. */
export function synthese(familles: readonly FamilleConcordance[]) {
  const compter = (e: EtatConcordance) => familles.filter((f) => f.etat === e).length;
  return {
    concordent: compter('CONCORDE'),
    ecarts: compter('ECART'),
    nonCalculees: compter('NON_CALCULE'),
    sansObjet: compter('SANS_OBJET'),
  };
}
