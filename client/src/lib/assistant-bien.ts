/**
 * L'ASSISTANT DE CRÉATION D'UN BIEN (ligne sage-l4, fonction n° 18 · Sage,
 * création d'un bien en huit étapes) · les étapes, ce que chacune exige, et
 * le corps envoyé, hors du composant pour se tester.
 *
 * L'ASSISTANT N'A PAS SA ROUTE · il envoie `POST /immobilisations` avec le
 * corps du formulaire, que le serveur juge par les mêmes contrôles
 * (`preparerFiche`). Une étape ne fait que dire ce qui MANQUE pour avancer ;
 * tout refus de fond reste celui du serveur, servi au récapitulatif.
 *
 * Les cas qui demandent plus qu'une fiche ordinaire (composant d'un bien,
 * location-acquisition, incorporel à durée non limitée, frais de
 * développement, bien inscrit en cours) restent au formulaire complet · un
 * assistant qui les servirait à moitié cacherait les préalables que le
 * formulaire, lui, pose.
 */

export type EtapeAssistant = 'designation' | 'compte' | 'origine' | 'dates' | 'valeur' | 'financement' | 'plan' | 'recapitulatif';

export const ETAPES: readonly { cle: EtapeAssistant; libelle: string }[] = [
  { cle: 'designation', libelle: 'Désignation' },
  { cle: 'compte', libelle: 'Compte' },
  { cle: 'origine', libelle: 'Origine' },
  { cle: 'dates', libelle: 'Dates' },
  { cle: 'valeur', libelle: 'Valeur' },
  { cle: 'financement', libelle: 'Financement' },
  { cle: 'plan', libelle: 'Amortissement' },
  { cle: 'recapitulatif', libelle: 'Récapitulatif' },
];

export interface SaisieAssistant {
  designation: string;
  numeroInventaire: string;
  lieuId: string;
  compteImmobilisationId: string;
  natureFiscaleCle: string;
  /** Repris au bilan d'ouverture · aucune écriture, un amortissement déjà pratiqué. */
  repris: boolean;
  dateAcquisition: string;
  pasEncoreEnService: boolean;
  dateMiseEnService: string;
  valeurOrigine: string;
  valeurResiduelle: string;
  amortissementAnterieur: string;
  compteContrepartieId: string;
  journalId: string;
  dureeAmortissementAns: string;
  modeAmortissement: 'LINEAIRE' | 'UNITES_DOEUVRE' | 'DEGRESSIF';
  unitesOeuvrePrevues: string;
  uniteOeuvreLibelle: string;
  reserveDePropriete: boolean;
}

export function saisieVierge(aujourdhui: string): SaisieAssistant {
  return {
    designation: '',
    numeroInventaire: '',
    lieuId: '',
    compteImmobilisationId: '',
    natureFiscaleCle: '',
    repris: false,
    dateAcquisition: aujourdhui,
    pasEncoreEnService: false,
    dateMiseEnService: aujourdhui,
    valeurOrigine: '',
    valeurResiduelle: '',
    amortissementAnterieur: '',
    compteContrepartieId: '',
    journalId: '',
    dureeAmortissementAns: '',
    modeAmortissement: 'LINEAIRE',
    unitesOeuvrePrevues: '',
    uniteOeuvreLibelle: '',
    reserveDePropriete: false,
  };
}

/** Les étapes que la saisie parcourt · un bien repris n'a pas de financement, il n'a pas d'écriture. */
export function etapesDe(s: Pick<SaisieAssistant, 'repris'>): EtapeAssistant[] {
  return ETAPES.map((e) => e.cle).filter((cle) => !(cle === 'financement' && s.repris));
}

/**
 * UN MONTANT TAPÉ AVEC SES ESPACES SE LIT · « 8 000 000 » ou « 1 200 000,50 »,
 * tels que `lib/montants.ts` les écrit (espace, espace insécable U+00A0,
 * espace fine insécable U+202F), rendaient `NaN` · l'étape refusait d'avancer
 * sur un montant juste, ou le corps partait faux. Vide · null, jamais zéro.
 */
export function lireMontant(x: string): number | null {
  const net = x.replace(/[\s\u00a0\u202f]/g, '');
  return net === '' ? null : Number(net.replace(',', '.'));
}
const positif = (x: string) => {
  const n = lireMontant(x);
  return n !== null && Number.isFinite(n) && n > 0;
};
const positifOuNul = (x: string) => {
  const n = lireMontant(x);
  return n !== null && Number.isFinite(n) && n >= 0;
};

/** Ce qui manque pour quitter l'étape, ou null · jamais une règle de fond, que le serveur tient. */
export function manqueDeLEtape(etape: EtapeAssistant, s: SaisieAssistant): string | null {
  switch (etape) {
    case 'designation':
      return s.designation.trim() ? null : 'Indiquez la désignation du bien.';
    case 'compte':
      return s.compteImmobilisationId ? null : 'Choisissez le compte du bien.';
    case 'origine':
      return null;
    case 'dates':
      if (!s.dateAcquisition) return "Indiquez la date d'acquisition.";
      if (!s.pasEncoreEnService && !s.dateMiseEnService) return 'Indiquez la date de mise en service, ou cochez « Pas encore mis en service ».';
      return null;
    case 'valeur':
      if (!positif(s.valeurOrigine)) return "Indiquez la valeur d'origine, positive.";
      if (s.valeurResiduelle.trim() && !positifOuNul(s.valeurResiduelle)) return 'La valeur résiduelle est un montant positif ou nul.';
      if (s.repris && s.amortissementAnterieur.trim() && !positifOuNul(s.amortissementAnterieur)) return 'L’amortissement déjà pratiqué est un montant positif ou nul.';
      return null;
    case 'financement':
      if (s.repris) return null;
      return s.compteContrepartieId && s.journalId ? null : 'Choisissez le financement et le journal de l’écriture d’acquisition.';
    case 'plan':
      if (s.modeAmortissement === 'UNITES_DOEUVRE' && (!positif(s.unitesOeuvrePrevues) || !s.uniteOeuvreLibelle.trim())) {
        return "Indiquez le total d'unités prévues et leur unité.";
      }
      if (s.dureeAmortissementAns.trim() && !(Number.isInteger(Number(s.dureeAmortissementAns)) && Number(s.dureeAmortissementAns) > 0)) {
        return 'La durée est un nombre entier d’années.';
      }
      return null;
    case 'recapitulatif':
      return null;
  }
}

/**
 * Le corps de `POST /immobilisations`, celui du formulaire · un champ vide
 * n'est pas envoyé (il ne vaut jamais zéro), la date de mise en service ne
 * part que pour un bien en service.
 */
export function corpsCreationBien(s: SaisieAssistant, exerciceId: string | undefined) {
  const unites = s.modeAmortissement === 'UNITES_DOEUVRE';
  return {
    compteImmobilisationId: s.compteImmobilisationId,
    designation: s.designation.trim(),
    ...(s.numeroInventaire.trim() ? { numeroInventaire: s.numeroInventaire.trim() } : {}),
    ...(s.lieuId ? { lieuId: s.lieuId } : {}),
    ...(s.natureFiscaleCle ? { natureFiscaleCle: s.natureFiscaleCle } : {}),
    dateAcquisition: s.dateAcquisition,
    ...(s.pasEncoreEnService ? {} : { dateMiseEnService: s.dateMiseEnService }),
    valeurOrigine: lireMontant(s.valeurOrigine),
    ...(s.valeurResiduelle.trim() ? { valeurResiduelle: lireMontant(s.valeurResiduelle) } : {}),
    ...(s.dureeAmortissementAns.trim() ? { dureeAmortissementAns: Number(s.dureeAmortissementAns) } : {}),
    modeAmortissement: s.modeAmortissement,
    ...(unites ? { unitesOeuvrePrevues: lireMontant(s.unitesOeuvrePrevues), uniteOeuvreLibelle: s.uniteOeuvreLibelle.trim() } : {}),
    ...(s.repris
      ? { repris: true, amortissementAnterieur: s.amortissementAnterieur.trim() ? lireMontant(s.amortissementAnterieur) : 0 }
      : { compteContrepartieId: s.compteContrepartieId, journalId: s.journalId }),
    // Cochée, la clause est déclarée ; décochée, le serveur la déduit d'une dette au 4816.
    ...(s.reserveDePropriete ? { reserveDePropriete: true } : {}),
    exerciceId,
  };
}

/**
 * LA CRÉATION ENCHAÎNÉE · « créer un autre bien » repart de la première
 * étape avec ce qui se répète d'une série (compte, nature, lieu, dates,
 * financement, plan), et vide ce qui est propre au bien (désignation,
 * numéro, valeur). Convention d'OmegaX, dite dans l'aide.
 */
export function saisieEnchainee(s: SaisieAssistant): SaisieAssistant {
  return { ...s, designation: '', numeroInventaire: '', valeurOrigine: '', valeurResiduelle: '', amortissementAnterieur: '' };
}
