/**
 * LA FICHE D'UN BIEN · ce que l'écran envoie à `PATCH /immobilisations/:id`
 * (ligne sage-l4, fonction n° 66). Seuls les champs CHANGÉS partent · un
 * champ renvoyé tel quel serait lu par le serveur comme une modification à
 * effet, et refusé sur une fiche dont l'écriture est validée alors que le
 * cabinet n'a changé que la désignation.
 *
 * AUCUN IMPORT DE REACT (specs-sans-react.spec.ts).
 */

export interface ValeursFiche {
  designation: string;
  numeroInventaire: string | null;
  natureFiscaleCle: string | null;
  /** Ligne immos, n° 71. */
  numeroSerie: string | null;
  compteImmobilisationId: string;
  compteContrepartieId: string | null;
  dateAcquisition: string;
  dateMiseEnService: string | null;
  valeurOrigine: number;
  valeurResiduelle: number;
  dureeAmortissementAns: number;
  modeAmortissement: string;
  unitesOeuvrePrevues: number | null;
  uniteOeuvreLibelle: string | null;
  amortissementAnterieur: number;
  repris: boolean;
}

/** La saisie de l'écran · des chaînes, comme les champs. */
export type SaisieFiche = Record<
  | 'designation'
  | 'numeroInventaire'
  | 'natureFiscaleCle'
  | 'numeroSerie'
  | 'compteImmobilisationId'
  | 'compteContrepartieId'
  | 'dateAcquisition'
  | 'dateMiseEnService'
  | 'valeurOrigine'
  | 'valeurResiduelle'
  | 'dureeAmortissementAns'
  | 'modeAmortissement'
  | 'unitesOeuvrePrevues'
  | 'uniteOeuvreLibelle'
  | 'amortissementAnterieur',
  string
>;

export function saisieDepuis(v: ValeursFiche): SaisieFiche {
  return {
    designation: v.designation,
    numeroInventaire: v.numeroInventaire ?? '',
    natureFiscaleCle: v.natureFiscaleCle ?? '',
    numeroSerie: v.numeroSerie ?? '',
    compteImmobilisationId: v.compteImmobilisationId,
    compteContrepartieId: v.compteContrepartieId ?? '',
    dateAcquisition: v.dateAcquisition,
    dateMiseEnService: v.dateMiseEnService ?? '',
    valeurOrigine: String(v.valeurOrigine),
    valeurResiduelle: String(v.valeurResiduelle),
    dureeAmortissementAns: String(v.dureeAmortissementAns),
    modeAmortissement: v.modeAmortissement,
    unitesOeuvrePrevues: v.unitesOeuvrePrevues === null ? '' : String(v.unitesOeuvrePrevues),
    uniteOeuvreLibelle: v.uniteOeuvreLibelle ?? '',
    amortissementAnterieur: String(v.amortissementAnterieur),
  };
}

/** Un nombre saisi, virgule décimale admise · null s'il ne se lit pas (jamais zéro par défaut). */
function nombre(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

/**
 * Le corps de la modification · les seuls champs qui diffèrent de la fiche
 * lue. Un nombre illisible est rendu dans `illisibles`, jamais envoyé ni lu
 * comme zéro.
 */
export function corpsModification(v: ValeursFiche, s: SaisieFiche): { corps: Record<string, unknown>; illisibles: string[] } {
  const corps: Record<string, unknown> = {};
  const illisibles: string[] = [];
  const texte = (cle: 'designation', valeur: string) => {
    if (valeur.trim() !== v[cle]) corps[cle] = valeur.trim();
  };
  texte('designation', s.designation);
  const effacable = (cle: 'numeroInventaire' | 'natureFiscaleCle' | 'numeroSerie' | 'dateMiseEnService', valeur: string) => {
    const lu = valeur.trim() || null;
    if (lu !== (v[cle] ?? null)) corps[cle] = lu;
  };
  effacable('numeroInventaire', s.numeroInventaire);
  effacable('natureFiscaleCle', s.natureFiscaleCle);
  effacable('numeroSerie', s.numeroSerie);
  effacable('dateMiseEnService', s.dateMiseEnService);
  for (const cle of ['compteImmobilisationId', 'dateAcquisition', 'modeAmortissement'] as const) {
    if (s[cle] && s[cle] !== v[cle]) corps[cle] = s[cle];
  }
  if (!v.repris && s.compteContrepartieId && s.compteContrepartieId !== v.compteContrepartieId) {
    corps.compteContrepartieId = s.compteContrepartieId;
  }
  if (s.uniteOeuvreLibelle.trim() && s.uniteOeuvreLibelle.trim() !== (v.uniteOeuvreLibelle ?? '')) {
    corps.uniteOeuvreLibelle = s.uniteOeuvreLibelle.trim();
  }
  const champsNombre = [
    ['valeurOrigine', 'Valeur d’origine'],
    ['valeurResiduelle', 'Valeur résiduelle'],
    ['dureeAmortissementAns', 'Durée'],
    ['unitesOeuvrePrevues', 'Unités prévues'],
    ['amortissementAnterieur', 'Amortissement déjà pratiqué'],
  ] as const;
  for (const [cle, libelle] of champsNombre) {
    if (s[cle].trim() === '' && v[cle] === null) continue;
    const x = nombre(s[cle]);
    if (x === null) {
      illisibles.push(libelle);
      continue;
    }
    if (Math.round(x * 100) !== Math.round(Number(v[cle] ?? 0) * 100) || v[cle] === null) corps[cle] = x;
  }
  return { corps, illisibles };
}
