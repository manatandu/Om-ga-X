import type { Edition } from './editions-structures';

/**
 * LES MODÈLES D'ÉDITION (ligne sage-l7, fonction 59 ; décision L7-1) · ce que
 * l'écran fait d'un modèle, tenu par son spec.
 *
 * Les éditions de TRAVAIL seules se personnalisent (plan comptable, plan des
 * tiers, plan analytique) · jamais un état financier, dont la contexture se
 * reproduit à l'identique, ni un livre obligatoire, tenu sans blanc (AUDCIF
 * Titre IX ch. 2 ; art. 20, al. 1 ; art. 22, 1°). Les colonnes qui
 * identifient la ligne ne se retirent jamais ; les autres se taisent, dans
 * l'ordre de l'édition ; le saut sépare les groupes par une ligne blanche ou
 * par une page.
 *
 * LE CATALOGUE EST TENU EN MIROIR du serveur
 * (`src/modules/exports/modeles-edition/modeles-edition.ts`), dont le spec
 * relit ce fichier · une colonne de l'un sans l'autre fait tomber le test.
 */

export type EditionModele = 'PLAN_COMPTABLE' | 'PLAN_TIERS' | 'PLAN_ANALYTIQUE';
export type SautEdition = 'AUCUN' | 'LIGNE' | 'PAGE';

export interface ColonneEdition {
  cle: string;
  libelle: string;
  identifiante: boolean;
}

export const COLONNES_EDITION: Record<EditionModele, ColonneEdition[]> = {
  PLAN_COMPTABLE: [
    { cle: 'numero', libelle: 'N° de compte', identifiante: true },
    { cle: 'intitule', libelle: 'Intitulé', identifiante: true },
    { cle: 'type', libelle: 'Type', identifiante: false },
    { cle: 'nature', libelle: 'Nature', identifiante: false },
    { cle: 'report', libelle: 'Report à-nouveau', identifiante: false },
    { cle: 'lettrable', libelle: 'Lettrable', identifiante: false },
    { cle: 'etat', libelle: 'État', identifiante: false },
  ],
  PLAN_TIERS: [
    { cle: 'code', libelle: 'Code', identifiante: true },
    { cle: 'nom', libelle: 'Nom', identifiante: true },
    { cle: 'qualite', libelle: 'Qualité', identifiante: false },
    { cle: 'type', libelle: 'Type', identifiante: false },
    { cle: 'comptePrincipal', libelle: 'Compte principal', identifiante: false },
    { cle: 'ville', libelle: 'Ville', identifiante: false },
    { cle: 'telephone', libelle: 'Téléphone', identifiante: false },
    { cle: 'numeroImpot', libelle: 'N° impôt', identifiante: false },
    { cle: 'etat', libelle: 'État', identifiante: false },
  ],
  PLAN_ANALYTIQUE: [
    { cle: 'code', libelle: 'Code', identifiante: true },
    { cle: 'intitule', libelle: 'Intitulé', identifiante: true },
    { cle: 'type', libelle: 'Type', identifiante: false },
    { cle: 'bailleur', libelle: 'Bailleur', identifiante: false },
    { cle: 'debut', libelle: 'Début', identifiante: false },
    { cle: 'fin', libelle: 'Fin', identifiante: false },
    { cle: 'etat', libelle: 'État', identifiante: false },
  ],
};

/** Ce que le saut sépare, édition par édition. */
export const GROUPE_EDITION: Record<EditionModele, string> = {
  PLAN_COMPTABLE: 'classe',
  PLAN_TIERS: 'type de tiers',
  PLAN_ANALYTIQUE: 'rubrique',
};

export const LIBELLES_SAUT: Record<SautEdition, string> = {
  AUCUN: 'Aucun saut',
  LIGNE: 'Une ligne blanche',
  PAGE: 'Une nouvelle page',
};

export interface ModeleServi {
  id: string;
  edition: EditionModele;
  nom: string;
  colonnes: string[];
  saut: SautEdition;
}

export interface ListeModeles {
  modeles: ModeleServi[];
  total: number;
  tronque: boolean;
}

/**
 * La liste avec le modèle que le serveur vient de rendre · remplacé s'il y
 * était, ajouté sinon. Sert quand la relecture tombe après un enregistrement
 * réussi (relecture m9) · le choix affiché garde son modèle.
 */
export function avecLeModele(liste: ListeModeles | null, modele: ModeleServi): ListeModeles {
  if (!liste) return { modeles: [modele], total: 1, tronque: false };
  const present = liste.modeles.some((m) => m.id === modele.id);
  return {
    ...liste,
    modeles: present ? liste.modeles.map((m) => (m.id === modele.id ? modele : m)) : [...liste.modeles, modele],
    total: present ? liste.total : liste.total + 1,
  };
}

export interface BlocEdition {
  titre: string | null;
  lignes: string[][];
}

export interface EditionMiseEnForme {
  colonnes: string[];
  blocs: BlocEdition[];
  saut: SautEdition;
}

/**
 * L'édition sous un modèle · le modèle standard (null) rend la liste telle
 * qu'elle est, en un seul bloc. Sous un modèle, les colonnes facultatives non
 * gardées se taisent ; avec un saut, les lignes se rangent par groupe (tri
 * STABLE sur la clé du groupe, l'ordre de la liste gardé dedans), un bloc
 * titré par groupe. Aucune ligne n'est retirée · le nombre de lignes reste
 * celui que le périmètre annonce.
 */
export function appliquerModele(
  edition: Edition,
  modele: Pick<ModeleServi, 'colonnes' | 'saut'> | null,
  catalogue: ColonneEdition[],
): EditionMiseEnForme {
  if (!modele || !edition.cles) return { colonnes: edition.colonnes, blocs: [{ titre: null, lignes: edition.lignes }], saut: 'AUCUN' };
  const gardees = catalogue.filter((c) => c.identifiante || modele.colonnes.includes(c.cle)).map((c) => c.cle);
  const indices = gardees.map((cle) => edition.cles!.indexOf(cle)).filter((i) => i >= 0);
  const colonnes = indices.map((i) => edition.colonnes[i]);
  const projeter = (ligne: string[]) => indices.map((i) => ligne[i]);
  if (modele.saut === 'AUCUN' || !edition.groupes) {
    return { colonnes, blocs: [{ titre: null, lignes: edition.lignes.map(projeter) }], saut: modele.saut };
  }
  const rangees = edition.lignes
    .map((ligne, rang) => ({ ligne, rang, groupe: edition.groupes![rang] }))
    .sort((a, b) => (a.groupe.cle < b.groupe.cle ? -1 : a.groupe.cle > b.groupe.cle ? 1 : a.rang - b.rang));
  const blocs: BlocEdition[] = [];
  let cleCourante: string | null = null;
  for (const r of rangees) {
    // Le groupe se reconnaît à sa CLÉ · deux groupes peuvent porter le même titre.
    if (blocs.length > 0 && r.groupe.cle === cleCourante) blocs[blocs.length - 1].lignes.push(projeter(r.ligne));
    else blocs.push({ titre: r.groupe.titre, lignes: [projeter(r.ligne)] });
    cleCourante = r.groupe.cle;
  }
  return { colonnes, blocs, saut: modele.saut };
}
