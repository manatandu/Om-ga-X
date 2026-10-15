import { EditionModele, SautEdition } from '@prisma/client';

/**
 * LES MODÈLES D'ÉDITION (ligne sage-l7, fonction 59 ; décision L7-1) · règles
 * pures.
 *
 * CE QUI SE PERSONNALISE · les ÉDITIONS DE TRAVAIL seules (plan comptable,
 * plan des tiers, plan analytique), dont le périmètre se dit toujours. JAMAIS
 * un état financier · l'entreprise qui produit ses états par l'outil
 * informatique doit « reproduire à l'identique la contexture des imprimés
 * normalisés » et « ne créer aucune rubrique » (AUDCIF Titre IX ch. 2,
 * conditions de recevabilité) ; SYCEBNL Partie 4 ch. 1 § 1.4 et art. 16, 6°.
 * JAMAIS un livre obligatoire · tenus « sans blanc ni altération d'aucune
 * sorte » (AUDCIF art. 20, al. 1), leurs données restituées avec « l'origine,
 * le contenu et l'imputation » (art. 22, 1°) · un saut de ligne y serait un
 * blanc, une colonne retirée une donnée perdue.
 *
 * LES COLONNES QUI IDENTIFIENT LA LIGNE NE SE RETIRENT PAS · une liste de
 * comptes sans numéro ne désigne plus rien. Un modèle ne garde que les
 * colonnes FACULTATIVES, rangées dans l'ordre de l'édition · la contexture de
 * la liste ne change pas, des colonnes s'y taisent.
 *
 * LE SAUT SÉPARE LES GROUPES de l'édition · la classe du compte, le type du
 * tiers, la rubrique analytique · par une ligne blanche, ou par une page.
 *
 * Le catalogue est tenu en MIROIR à l'écran (`client/src/lib/modeles-edition.ts`),
 * que le spec relit · une colonne de l'un sans l'autre fait tomber le test.
 */

export interface ColonneModele {
  cle: string;
  identifiante: boolean;
}

export const COLONNES_PAR_EDITION: Record<EditionModele, ColonneModele[]> = {
  PLAN_COMPTABLE: [
    { cle: 'numero', identifiante: true },
    { cle: 'intitule', identifiante: true },
    { cle: 'type', identifiante: false },
    { cle: 'nature', identifiante: false },
    { cle: 'report', identifiante: false },
    { cle: 'lettrable', identifiante: false },
    { cle: 'etat', identifiante: false },
  ],
  PLAN_TIERS: [
    { cle: 'code', identifiante: true },
    { cle: 'nom', identifiante: true },
    { cle: 'type', identifiante: false },
    { cle: 'comptePrincipal', identifiante: false },
    { cle: 'ville', identifiante: false },
    { cle: 'telephone', identifiante: false },
    { cle: 'numeroImpot', identifiante: false },
    { cle: 'etat', identifiante: false },
  ],
  PLAN_ANALYTIQUE: [
    { cle: 'code', identifiante: true },
    { cle: 'intitule', identifiante: true },
    { cle: 'type', identifiante: false },
    { cle: 'bailleur', identifiante: false },
    { cle: 'debut', identifiante: false },
    { cle: 'fin', identifiante: false },
    { cle: 'etat', identifiante: false },
  ],
};

export const LONGUEUR_MAX_NOM_MODELE = 60;
/** Le modèle intégré · jamais rangé, son nom n'est pas à prendre. */
export const NOM_STANDARD = 'Standard';
/** Au-delà, la liste d'une édition se tronque et le dit (CLAUDE.md § 8 bis). */
export const PLAFOND_MODELES = 100;

/**
 * Le modèle relu · nom borné, colonnes facultatives connues de SON édition,
 * sans doublon, rangées dans l'ordre de l'édition ; une colonne
 * identifiante envoyée est acceptée et ne se range pas (elle s'imprime
 * toujours).
 */
export function modeleOuMotif(
  edition: EditionModele,
  brut: { nom?: unknown; colonnes?: unknown; saut?: unknown },
  avecNom = true,
): { nom: string; colonnes: string[]; saut: SautEdition } | { motif: string } {
  let nom = '';
  if (avecNom) {
    nom = typeof brut.nom === 'string' ? brut.nom.trim() : '';
    if (!nom) return { motif: 'Le nom du modèle est exigé.' };
    if (nom.length > LONGUEUR_MAX_NOM_MODELE) return { motif: `Le nom du modèle tient en ${LONGUEUR_MAX_NOM_MODELE} caractères au plus.` };
    if (nom.toLocaleLowerCase('fr') === NOM_STANDARD.toLocaleLowerCase('fr')) {
      return { motif: `« ${NOM_STANDARD} » est le modèle intégré · choisissez un autre nom.` };
    }
  }
  if (!Array.isArray(brut.colonnes) || brut.colonnes.some((c) => typeof c !== 'string')) {
    return { motif: 'Les colonnes du modèle sont illisibles.' };
  }
  const catalogue = COLONNES_PAR_EDITION[edition];
  const connues = new Map(catalogue.map((c) => [c.cle, c]));
  const demandees = new Set<string>();
  for (const cle of brut.colonnes as string[]) {
    const c = connues.get(cle);
    if (!c) return { motif: `Colonne inconnue pour cette édition · « ${cle} ».` };
    if (demandees.has(cle)) return { motif: `Colonne en double · « ${cle} ».` };
    demandees.add(cle);
  }
  const saut = brut.saut ?? SautEdition.AUCUN;
  if (!(Object.values(SautEdition) as unknown[]).includes(saut)) return { motif: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' };
  return {
    nom,
    colonnes: catalogue.filter((c) => !c.identifiante && demandees.has(c.cle)).map((c) => c.cle),
    saut: saut as SautEdition,
  };
}
