/**
 * CRÉER LES BIENS DEPUIS LES ÉCRITURES (ligne sage-l4, fonction n° 68) · la
 * saisie de l'écran et le corps envoyé, hors du composant pour se tester.
 * Le serveur lit compte, valeur et date sur la ligne · l'écran n'envoie que
 * ce que l'écriture ne dit pas.
 */

/** Une ligne servie par `GET /immobilisations/ecritures-a-transformer`. */
export interface LigneATransformer {
  ligneId: string;
  ecritureId: string;
  numeroPiece: number | null;
  journal: string;
  date: string;
  libelle: string;
  compte: { numero: string; intitule: string };
  montant: number;
  motifRefus: string | null;
  /** Ce qui ne refuse pas mais se dit (contrepartie non admise, même montant en négatif ailleurs). */
  avertissements: string[];
  /** Pièce du premier jour hors achats · le serveur exige la confirmation d'une acquisition de ce jour. */
  confirmationRequise: string | null;
}

export interface SaisieDepuisLigne {
  designation: string;
  numeroInventaire: string;
  dateMiseEnService: string;
  pasEncoreEnService: boolean;
  dureeAmortissementAns: string;
  modeAmortissement: '' | 'LINEAIRE' | 'UNITES_DOEUVRE' | 'DEGRESSIF';
  unitesOeuvrePrevues: string;
  uniteOeuvreLibelle: string;
  /** Cochée par le cabinet seulement · jamais d'office (relecture M2). */
  confirmerPremierJour: boolean;
}

/**
 * La saisie proposée · la désignation reprend le libellé, la mise en service
 * PROPOSE la date de la pièce, visible et modifiable (le serveur ne la pose
 * jamais d'office, AUDCIF art. 45).
 */
export function saisieDepuisLigne(l: LigneATransformer): SaisieDepuisLigne {
  return {
    designation: l.libelle,
    numeroInventaire: '',
    dateMiseEnService: l.date,
    pasEncoreEnService: false,
    dureeAmortissementAns: '',
    modeAmortissement: '',
    unitesOeuvrePrevues: '',
    uniteOeuvreLibelle: '',
    confirmerPremierJour: false,
  };
}

/** Le corps de `POST /immobilisations/depuis-ecriture` · un champ vide n'est pas envoyé, il ne vaut jamais zéro. */
export function corpsDepuisEcriture(ligneId: string, s: SaisieDepuisLigne) {
  const unites = s.modeAmortissement === 'UNITES_DOEUVRE';
  return {
    ligneId,
    designation: s.designation.trim(),
    ...(s.numeroInventaire.trim() ? { numeroInventaire: s.numeroInventaire.trim() } : {}),
    // Cochée, ou vide · le bien n'est pas encore en service, la date se pose plus tard.
    dateMiseEnService: s.pasEncoreEnService || !s.dateMiseEnService ? null : s.dateMiseEnService,
    ...(s.dureeAmortissementAns.trim() ? { dureeAmortissementAns: Number(s.dureeAmortissementAns) } : {}),
    ...(s.modeAmortissement ? { modeAmortissement: s.modeAmortissement } : {}),
    ...(unites && s.unitesOeuvrePrevues.trim() ? { unitesOeuvrePrevues: Number(s.unitesOeuvrePrevues) } : {}),
    ...(unites && s.uniteOeuvreLibelle.trim() ? { uniteOeuvreLibelle: s.uniteOeuvreLibelle.trim() } : {}),
    ...(s.confirmerPremierJour ? { confirmerPremierJour: true } : {}),
  };
}
