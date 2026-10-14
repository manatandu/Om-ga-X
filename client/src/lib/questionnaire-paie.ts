/**
 * LIGNE SAGE-L5, FONCTION 85 · LE QUESTIONNAIRE SOCIÉTÉ ET SALARIÉ.
 *
 * Un assistant qui POSE les questions dont la paie a besoin et ÉCRIT les
 * champs qui existent déjà · les paramètres du dossier (effectif permanent,
 * numéro d'affiliation de l'employeur), la fiche du salarié (mode de paiement
 * convenu), son contrat (monnaie de la rémunération, qui se complète une fois),
 * et les champs de la simulation du mois (nature de l'employeur pour l'INPP,
 * effectif, régime de la retenue, classe, personnes à charge, enfants
 * bénéficiaires des allocations), que le bulletin émis fige.
 *
 * TROIS RÈGLES. (1) Aucune règle et aucune valeur par défaut · une question
 * sans réponse reste « pas encore dit », et la proposition (l'effectif du
 * registre, la classe du contrat) ne s'écrit qu'au clic. (2) Seul ce qui
 * CHANGE s'écrit, par la route qui le tient, avec ses droits. (3) Une valeur
 * déjà enregistrée n'est jamais effacée par le questionnaire · « pas encore
 * dit » laissé sur elle la garde, et l'écran le dit ; les champs de la
 * simulation, eux, ne sont qu'une saisie du mois et se vident.
 */

export type CibleQuestion = 'DOSSIER' | 'SALARIE' | 'CONTRAT' | 'SIMULATION';

export type CleQuestion =
  | 'natureInpp'
  | 'effectifInpp'
  | 'effectifPermanent'
  | 'numeroAffiliationCnssEmployeur'
  | 'regimeSalarial'
  | 'modePaiement'
  | 'deviseRemuneration'
  | 'classePro'
  | 'personnesACharge'
  | 'enfantsAllocations';

export interface QuestionPaie {
  cle: CleQuestion;
  partie: 'SOCIETE' | 'SALARIE';
  libelle: string;
  cible: CibleQuestion;
  /** Choix fermés · absent, la réponse est un nombre ou un texte. */
  choix?: readonly { valeur: string; libelle: string }[];
  saisie?: 'ENTIER' | 'TEXTE';
  aide: string;
  source: string;
}

export const QUESTIONS_PAIE: readonly QuestionPaie[] = [
  {
    cle: 'natureInpp',
    partie: 'SOCIETE',
    libelle: "Nature de l'employeur pour la cotisation INPP",
    cible: 'SIMULATION',
    choix: [
      { valeur: 'PRIVE', libelle: 'Privé' },
      { valeur: 'PUBLIC', libelle: 'Public' },
    ],
    aide: "Le taux de la cotisation INPP dépend de la nature de l'employeur, puis, pour le privé seulement, de la tranche d'effectif. Il ne se déduit pas de la forme juridique · sans réponse, l'INPP n'est pas calculé, et la simulation le dit.",
    source: 'Arrêté interministériel n° 002/CAB/MET/2025',
  },
  {
    cle: 'effectifInpp',
    partie: 'SOCIETE',
    libelle: "Effectif de l'employeur (tranche INPP, privé)",
    cible: 'SIMULATION',
    saisie: 'ENTIER',
    aide: "L'effectif choisit la tranche du taux INPP d'un employeur privé. Le registre du personnel le PROPOSE · il ne s'écrit qu'au clic.",
    source: 'Arrêté interministériel n° 002/CAB/MET/2025',
  },
  {
    cle: 'effectifPermanent',
    partie: 'SOCIETE',
    libelle: 'Effectif permanent du dossier',
    cible: 'DOSSIER',
    saisie: 'ENTIER',
    aide: "L'effectif permanent du dossier sert aux notes annexes et aux seuils · il se tient dans les paramètres du dossier, par l'administrateur. Zéro est une réponse.",
    source: 'Paramètres du dossier · notes 27B et 29B',
  },
  {
    cle: 'numeroAffiliationCnssEmployeur',
    partie: 'SOCIETE',
    libelle: "Numéro d'affiliation de l'employeur à la CNSS",
    cible: 'DOSSIER',
    saisie: 'TEXTE',
    aide: "Deuxième énonciation obligatoire de tout contrat écrit, du côté de l'employeur · tant qu'il manque, aucun contrat du dossier n'est complet. Tenu par l'administrateur dans les paramètres du dossier.",
    source: 'Code du travail, art. 212, point 2',
  },
  {
    cle: 'regimeSalarial',
    partie: 'SALARIE',
    libelle: 'Régime de la retenue sur la rémunération',
    cible: 'SIMULATION',
    choix: [
      { valeur: 'BAREME_ARTICLE_118', libelle: "Barème progressif de l'IRPP" },
      { valeur: 'FORFAIT_PERSONNEL_DOMESTIQUE', libelle: 'Personnel domestique (forfait)' },
      { valeur: 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE', libelle: 'Salarié de micro-entreprise (forfait)' },
    ],
    aide: "Le forfait libératoire vise le personnel domestique et le salarié d'une micro-entreprise. Non déclaré, la simulation retient le barème ET le dit.",
    source: 'Loi n° 23/053, art. 118 et 121',
  },
  {
    cle: 'modePaiement',
    partie: 'SALARIE',
    libelle: 'Mode de paiement convenu',
    cible: 'SALARIE',
    choix: [
      { valeur: 'VIREMENT', libelle: 'Virement' },
      { valeur: 'CHEQUE', libelle: 'Chèque' },
      { valeur: 'ESPECES', libelle: 'Espèces' },
    ],
    aide: "Le salaire se paie « au temps et au lieu convenus » · tant que le mode n'est pas dit, le salarié n'entre dans aucun paiement des salaires.",
    source: 'Code du travail, art. 98, al. 2',
  },
  {
    cle: 'deviseRemuneration',
    partie: 'SALARIE',
    libelle: 'Monnaie de la rémunération du contrat',
    cible: 'CONTRAT',
    choix: [
      { valeur: 'CDF', libelle: 'Franc congolais (CDF)' },
      { valeur: 'USD', libelle: 'Dollar américain (USD)' },
    ],
    aide: "Un montant convenu exige sa monnaie · absente, elle se complète une fois et ne se change plus ensuite. Sans elle, le contrôle du minimum de la classe s'abstient.",
    source: 'Code du travail, art. 89 · audit final F226',
  },
  {
    cle: 'classePro',
    partie: 'SALARIE',
    libelle: 'Classe professionnelle (1 à 17)',
    cible: 'SIMULATION',
    saisie: 'ENTIER',
    aide: 'La classe vient de la grille du décret · elle fixe le minimum de la catégorie que la quotité saisissable protège. Le contrat la PROPOSE quand il la porte.',
    source: 'Décret n° 25/22, art. 4 · Code du travail, art. 114',
  },
  {
    cle: 'personnesACharge',
    partie: 'SALARIE',
    libelle: 'Personnes à charge (au 1er janvier)',
    cible: 'SIMULATION',
    saisie: 'ENTIER',
    aide: "Les personnes à charge réduisent l'impôt · elles s'apprécient au 1er janvier, et la simulation les propose sans les substituer.",
    source: 'Loi n° 23/053, art. 124 et 125',
  },
  {
    cle: 'enfantsAllocations',
    partie: 'SALARIE',
    libelle: 'Enfants bénéficiaires des allocations familiales',
    cible: 'SIMULATION',
    saisie: 'ENTIER',
    aide: "Les enfants bénéficiaires ne sont pas les personnes à charge · le droit s'interrompt enfant par enfant.",
    source: 'Arrêté n° 137/2018, art. 5, 6 et 8',
  },
];

/** Les réponses, une chaîne par question · vide = « pas encore dit ». */
export type ReponsesPaie = Record<CleQuestion, string>;

export const REPONSES_VIDES: ReponsesPaie = {
  natureInpp: '',
  effectifInpp: '',
  effectifPermanent: '',
  numeroAffiliationCnssEmployeur: '',
  regimeSalarial: '',
  modePaiement: '',
  deviseRemuneration: '',
  classePro: '',
  personnesACharge: '',
  enfantsAllocations: '',
};

/** Le refus d'une réponse, ou `null` · aucune n'est complétée ni arrondie. */
export function motifReponse(q: QuestionPaie, valeur: string): string | null {
  const v = valeur.trim();
  if (v === '') return null;
  if (q.choix) return q.choix.some((c) => c.valeur === v) ? null : 'Réponse hors des choix proposés.';
  if (q.saisie === 'ENTIER') {
    if (!/^\d+$/.test(v)) return 'Un nombre entier est attendu.';
    const n = Number(v);
    if (q.cle === 'classePro' && (n < 1 || n > 17)) return 'La grille du décret compte dix-sept classes (1 à 17).';
    if (q.cle === 'effectifInpp' && n < 1) return "Un effectif d'employeur compte au moins une personne.";
    return null;
  }
  return v.length > 60 ? 'Soixante caractères au plus.' : null;
}

/** Ce que le questionnaire écrirait, par route · seul ce qui change, jamais un effacement d'une valeur enregistrée. */
export interface EcrituresQuestionnaire {
  dossier: { effectifPermanent?: number; numeroAffiliationCnssEmployeur?: string } | null;
  modePaiement: string | null;
  deviseRemuneration: string | null;
  simulation: Partial<Record<'natureInpp' | 'effectifInpp' | 'regimeSalarial' | 'classePro' | 'personnesACharge' | 'enfantsAllocations', string>>;
  /** Les valeurs enregistrées laissées en « pas encore dit » · gardées, et dites. */
  gardees: CleQuestion[];
}

export function ecrituresDuQuestionnaire(initial: ReponsesPaie, reponses: ReponsesPaie, questions: readonly QuestionPaie[]): EcrituresQuestionnaire {
  const e: EcrituresQuestionnaire = { dossier: null, modePaiement: null, deviseRemuneration: null, simulation: {}, gardees: [] };
  for (const q of questions) {
    const avant = initial[q.cle].trim();
    const apres = reponses[q.cle].trim();
    if (apres === avant) continue;
    if (q.cible === 'SIMULATION') {
      (e.simulation as Record<string, string>)[q.cle] = apres;
      continue;
    }
    if (apres === '') {
      e.gardees.push(q.cle);
      continue;
    }
    if (q.cible === 'DOSSIER') {
      e.dossier = {
        ...(e.dossier ?? {}),
        ...(q.cle === 'effectifPermanent' ? { effectifPermanent: Number(apres) } : { numeroAffiliationCnssEmployeur: apres }),
      };
    } else if (q.cible === 'SALARIE') {
      e.modePaiement = apres;
    } else if (q.cible === 'CONTRAT') {
      e.deviseRemuneration = apres;
    }
  }
  return e;
}
