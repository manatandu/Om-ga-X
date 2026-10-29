/**
 * LES DÉCLARATIONS DES ARTICLES 216 ET 217 DU CODE DU TRAVAIL, MISES EN
 * FORMULAIRE (gel levé par Manasse le 2026-10-29, « Lève le gel pour les
 * déclarations d'embauche et de départ, d'ouverture et fermeture »).
 *
 * Sources lues · Code du travail, art. 216, 217 et 219 (loi n° 015/2002,
 * modifiée par la loi n° 16/010 du 15 juillet 2016) ; arrêtés ministériels
 * n° 006 et n° 008/CAB/PVPM/ETPS/2010 du 1er avril 2010, et leurs formulaires
 * annexés (J.O. RDC, première partie, n° 7, transcription dans
 * `docs/sources/arretes-005-006-008-2010-declarations-main-oeuvre.md`).
 *
 * LE DÉLAI EST CELUI DE LA LOI, PAS CELUI DE L'ARRÊTÉ · l'art. 217, réécrit
 * par la loi n° 16/010 du 15 juillet 2016, dit « dans les quinze jours » ;
 * l'arrêté n° 006 de 2010, pris sur l'ancienne rédaction, disait « dans les
 * quarante-huit heures de l'embauche ». La loi est postérieure et supérieure,
 * et l'art. 219 ne délègue au Ministre que « les modalités » et « les
 * dérogations » · les quinze jours priment (`declarationsDues`,
 * `regles-contrat-travail.ts`). Le formulaire, les quatre exemplaires et la
 * dérogation de l'art. 4 de l'arrêté (journaliers), qui sont des modalités et
 * une dérogation, restent. Pour l'ouverture et la fermeture, la loi et
 * l'arrêté n° 008 disent la même chose · « dans la quinzaine qui précède ».
 *
 * L'ARRÊTÉ DU 24 FÉVRIER 2023 PRIME SUR CEUX DE 2010 LÀ OÙ IL LES CONTREDIT
 * (arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du
 * 24 février 2023, pris sur les art. 216 à 219 · lu sur le scan fourni le
 * 2026-10-29, `docs/sources/arrete-087-2023-declarations.md` ; art. 10, « sont
 * abrogées toutes les dispositions antérieures contraires » ; art. 11, en
 * vigueur à la signature). Il change les SERVICES (art. 2 · à Kinshasa, la
 * Direction de l'Emploi du Secrétariat général de l'Emploi et du Travail et la
 * Direction provinciale de l'ONEM ; ailleurs, la Division provinciale de
 * l'Emploi et du Travail et la Direction provinciale de l'ONEM) et la
 * RÉPARTITION des quatre exemplaires (art. 4). Il ne dit aucun délai pour
 * l'embauche, le départ, l'ouverture ni la fermeture · la loi et l'arrêté n° 008
 * restent. Son modèle annexé n'est pas au scan reçu (trois pages) · OmegaX
 * remplit le formulaire de 2010, et le dit (`FORMULAIRE_2023_NON_LU`).
 *
 * OmegaX REMPLIT, il n'envoie rien · le formulaire se tire, se date, se signe
 * et se dépose. Un champ que le registre ne tient pas est rendu VIDE et
 * NOMMÉ parmi les manquants, jamais deviné. Le motif du mouvement se CHOISIT
 * (le motif de fin du contrat est un texte libre, qu'aucune règle ne range
 * parmi les cinq cases du formulaire).
 */

export const FONDEMENT_MOUVEMENT =
  "Code du travail, art. 217 (loi n° 16/010 du 15 juillet 2016) ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 1er, 2, 4 et 9 ; arrêté ministériel n° 006/CAB/PVPM/ETPS/2010 du 1er avril 2010, art. 4 et formulaire annexé, en ce qu'il n'est pas contraire";

export const PRIMAUTE_DELAI_LOI =
  "Délai de quinze jours de l'art. 217 du Code du travail, tel que réécrit par la loi n° 16/010 du 15 juillet 2016. L'arrêté n° 006/CAB/PVPM/ETPS/2010, pris sur l'ancienne rédaction, disait quarante-huit heures · la loi, postérieure et supérieure, prime. Le formulaire et la dérogation de l'arrêté restent ; services et exemplaires sont ceux de l'arrêté du 24 février 2023.";

export const ARRETE_2023 =
  'arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023';

/** Les services et les exemplaires de l'arrêté de 2023 (art. 2 et 4), qui remplacent ceux de 2010. */
export const DEPOT_ARRETE_2023 =
  "À déposer, en quatre exemplaires, à Kinshasa à la Direction de l'Emploi du Secrétariat général de l'Emploi et du Travail (deux exemplaires) et à la Direction provinciale de l'Office national de l'emploi (un exemplaire) ; dans les autres provinces, à la Division provinciale de l'Emploi et du Travail (deux exemplaires) et à la Direction provinciale de l'Office national de l'emploi (un exemplaire) ; le quatrième est conservé par le déclarant (" +
  ARRETE_2023 +
  ', art. 2 et 4). Infraction punie des peines de l\'art. 321 du Code du travail (art. 9).';

/**
 * LES REDEVANCES DE LA DÉCLARATION (arrêté du 24 février 2023, art. 7, qui
 * renvoie à l'arrêté interministériel n° 005/CAB/MIN/ETPS/06/2022 et
 * n° 048/CAB/MIN/FINANCES/2022 du 2 août 2022, J.O. RDC n° 18 du 15 septembre
 * 2022, col. 25 · lu sur la copie fournie le 2026-10-29,
 * `docs/sources/arrete-interministeriel-2022-taux-emploi.md`). Art. 1er, taux
 * « fixés en dollar américain (USD), payables en francs congolais au taux
 * officiel du jour » ; tableau, Inspection générale du travail (section 62),
 * A. Droits sur diverses prestations, rubriques de la « Demande de visa
 * d'inspection de travail » · 3. déclaration d'établissement 1 000 ; 6. bilan
 * social 200 ; 7. déclaration de mouvement des travailleurs 10 par
 * travailleur ; 8. déclaration annuelle de la situation de la main-d'œuvre
 * 500. OmegaX DIT le taux en dollars et ne le convertit pas · le cours du jour
 * est celui du paiement, et le cours tenu dans Devises est celui que le
 * cabinet saisit, pas forcément le taux officiel.
 */
export const ARRETE_TAUX_2022 =
  'arrêté interministériel n° 005/CAB/MIN/ETPS/06/2022 et n° 048/CAB/MIN/FINANCES/2022 du 2 août 2022';

function redevance(montant: string, rubrique: string): string {
  return `Redevance · ${montant}, payable en francs congolais au taux officiel du jour (${ARRETE_TAUX_2022}, art. 1er, section 62, « ${rubrique} » ; arrêté du 24 février 2023, art. 7).`;
}

export const REDEVANCE_MOUVEMENT = redevance('10 USD par travailleur déclaré', 'déclaration de mouvement des travailleurs');
export const REDEVANCE_ETABLISSEMENT = redevance('1 000 USD', "déclaration d'établissement");
export const REDEVANCE_SITUATION_ANNUELLE = redevance('500 USD', "déclaration annuelle de la situation de la main-d'œuvre");
export const REDEVANCE_BILAN_SOCIAL = redevance('200 USD', 'bilan social');

export const FORMULAIRE_2023_NON_LU =
  "Le formulaire officiel est celui annexé à l'arrêté du 24 février 2023, que les employeurs retirent à la Direction provinciale de l'ONEM (art. 4 et 5) · ce modèle n'a pas été lu, OmegaX remplit les rubriques du formulaire de 2010, à reporter sur celui de l'ONEM s'il diffère.";

export const EXEMPLAIRES_MOUVEMENT = DEPOT_ARRETE_2023;

export const DEROGATION_JOUR_LE_JOUR =
  "Ne fait pas l'objet d'une déclaration d'embauche ou de départ le travailleur engagé au jour le jour qui n'a pas accompli vingt-deux journées de travail sur une période de deux mois (arrêté n° 006, art. 4) · OmegaX ne compte pas ces journées, la dérogation se juge par le cabinet.";

/** Les cinq cases du motif, dans l'ordre et sous le numéro du formulaire annexé à l'arrêté n° 006. */
export const MOTIFS_MOUVEMENT = [
  { code: 'EMBAUCHE', rang: 1, libelle: 'Embauche', objet: 'ENGAGEMENT' },
  { code: 'EXPIRATION_NORMALE', rang: 2, libelle: 'Expiration normale du contrat', objet: 'DEPART' },
  { code: 'LICENCIEMENT', rang: 3, libelle: 'Licenciement', objet: 'DEPART' },
  { code: 'DEMISSION', rang: 4, libelle: 'Démission', objet: 'DEPART' },
  { code: 'DECES', rang: 5, libelle: 'Décès', objet: 'DEPART' },
] as const;

export type MotifMouvement = (typeof MOTIFS_MOUVEMENT)[number]['code'];

export interface ChampFormulaire {
  libelle: string;
  /** `null` · le registre ne le tient pas, et le champ est nommé parmi les manquants. */
  valeur: string | null;
}

export interface EmployeurDeclare {
  nom: string;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  activite: string | null;
  numeroAffiliationCnssEmployeur: string | null;
}

export interface ContratDeclare {
  type: 'DUREE_DETERMINEE' | 'DUREE_INDETERMINEE' | 'JOUR_LE_JOUR' | 'APPRENTISSAGE';
  dateEntreeEnVigueur: Date;
  dateFin: Date | null;
  natureTravail: string | null;
  categorieProfessionnelle: string | null;
  classeProfessionnelle: number | null;
  periodiciteRemuneration: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE' | null;
  remunerationBase: number | null;
  deviseRemuneration: string | null;
}

export interface SalarieDeclare {
  nom: string;
  postNom: string | null;
  prenoms: string | null;
  sexe: 'MASCULIN' | 'FEMININ';
  dateNaissance: Date | null;
  millesimeNaissance: number | null;
  lieuNaissance: string | null;
  nationalite: string | null;
  numeroAffiliationCnss: string | null;
  nomConjoint: string | null;
  nombreEnfants: number;
  /** Lu sur la nationalité, même règle que l'effectif (`effectif-registre.ts`) · null sans nationalité. */
  etranger: boolean | null;
}

const jour = (d: Date) => d.toISOString().slice(0, 10);
const ou = (...v: (string | null | undefined)[]) => v.map((x) => (x ?? '').trim()).filter(Boolean).join(', ') || null;

/**
 * Le motif choisi doit correspondre à l'objet · une embauche n'est pas un
 * départ, et un départ sans date de fin au registre ne se déclare pas
 * (l'art. 217, al. 2 exige « la date du départ de l'entreprise »).
 */
export function motifRefusMouvement(motif: string, contrat: { dateFin: Date | null }): string | null {
  const m = MOTIFS_MOUVEMENT.find((x) => x.code === motif);
  if (!m) return 'Motif inconnu · choisissez une des cinq cases du formulaire (embauche, expiration normale du contrat, licenciement, démission, décès).';
  if (m.objet === 'DEPART' && !contrat.dateFin) {
    return "Ce contrat n'a pas de date de fin au registre · enregistrez d'abord la fin du contrat, la déclaration de départ mentionne la date du départ (art. 217, al. 2).";
  }
  return null;
}

/**
 * Le formulaire « Déclaration de mouvement du travailleur » de l'arrêté
 * n° 006, rempli depuis le registre. Les sections suivent le modèle annexé.
 */
export function formulaireMouvement(e: EmployeurDeclare, s: SalarieDeclare, c: ContratDeclare, motif: MotifMouvement) {
  const m = MOTIFS_MOUVEMENT.find((x) => x.code === motif)!;
  const naissance = s.dateNaissance ? jour(s.dateNaissance) : s.millesimeNaissance ? String(s.millesimeNaissance) : null;
  const classification = ou(c.categorieProfessionnelle, c.classeProfessionnelle ? `classe ${c.classeProfessionnelle} (décret n° 25/22)` : null);
  const salaire =
    c.remunerationBase === null || !c.periodiciteRemuneration
      ? null
      : `${c.remunerationBase.toFixed(2)} ${c.deviseRemuneration ?? ''} ${
          { JOUR: 'par jour', SEMAINE: 'par semaine', MOIS: 'par mois', ANNEE: 'par an' }[c.periodiciteRemuneration]
        }`.replace(/  +/g, ' ');
  const contrat =
    c.type === 'DUREE_DETERMINEE'
      ? 'à durée déterminée'
      : c.type === 'DUREE_INDETERMINEE'
        ? 'à durée indéterminée'
        : c.type === 'JOUR_LE_JOUR'
          ? 'engagement au jour le jour'
          : "contrat d'apprentissage";
  const famille = ou(s.nomConjoint ? `conjoint · ${s.nomConjoint}` : null, `${s.nombreEnfants} enfant(s) à charge au registre`);

  const employeur: ChampFormulaire[] = [
    { libelle: 'Nom ou raison sociale', valeur: e.nom },
    { libelle: 'Adresse', valeur: ou(e.adresse, e.ville) },
    { libelle: 'B.P.', valeur: null },
    { libelle: 'Téléphone', valeur: e.telephone },
    { libelle: 'Activité principale', valeur: e.activite },
    { libelle: 'N° INSS (CNSS)', valeur: e.numeroAffiliationCnssEmployeur },
  ];
  const travailleur: ChampFormulaire[] = [
    { libelle: 'Nom et prénoms', valeur: ou(s.nom, s.postNom, s.prenoms) },
    { libelle: 'Date et lieu de naissance', valeur: ou(naissance, s.lieuNaissance) },
    { libelle: 'Nationalité', valeur: s.nationalite },
    { libelle: 'Sexe', valeur: s.sexe === 'MASCULIN' ? 'masculin' : 'féminin' },
    { libelle: 'Emploi', valeur: c.natureTravail },
    { libelle: 'Classification', valeur: classification },
    { libelle: 'Salaire', valeur: salaire },
    { libelle: 'Contrat', valeur: contrat },
    // La carte de travail ne vise que l'étranger · rien n'est réclamé à un national.
    ...(s.etranger === false ? [] : [{ libelle: 'Carte de travail, délivrée le', valeur: null }]),
    { libelle: "N° d'immatriculation à l'INSS (CNSS)", valeur: s.numeroAffiliationCnss },
    // L'état civil (célibataire, marié, divorcé, séparé, veuf) n'est pas une
    // colonne du registre · il se coche à la main, la ligne dit ce qui est su.
    { libelle: 'Situation de famille', valeur: famille },
  ];
  const date = m.objet === 'ENGAGEMENT' ? c.dateEntreeEnVigueur : c.dateFin!;
  const manquants = [...employeur, ...travailleur].filter((x) => x.valeur === null).map((x) => x.libelle);
  // Un montant sans sa monnaie n'est pas un salaire lisible (P1b) · nommé.
  if (salaire !== null && !c.deviseRemuneration) manquants.push('Monnaie du salaire (non renseignée au contrat)');
  manquants.push('Situation de famille · état civil à cocher (non tenu au registre)');
  return {
    employeur,
    travailleur,
    motif: { code: m.code, rang: m.rang, libelle: m.libelle, le: jour(date) },
    // La section 4 (offre d'emploi) ne se remplit qu'à une cessation de travail.
    offreAPreciser: m.objet === 'DEPART',
    manquants,
  };
}

/** Les cases de la nature de la déclaration d'établissement, comme le formulaire de l'arrêté n° 008. */
export const NATURES_ETABLISSEMENT = [
  { code: 'TRANSITOIRE', libelle: 'Déclaration à titre transitoire' },
  { code: 'OUVERTURE', libelle: 'Ouverture' },
  { code: 'FERMETURE', libelle: 'Fermeture' },
  { code: 'REOUVERTURE', libelle: 'Réouverture' },
  { code: 'CHANGEMENT', libelle: 'Changement divers' },
] as const;

export type NatureEtablissement = (typeof NATURES_ETABLISSEMENT)[number]['code'];

export const FONDEMENT_ETABLISSEMENT =
  "Code du travail, art. 216 (loi n° 16/010 du 15 juillet 2016) ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 1er, 2, 4 et 9 ; arrêté ministériel n° 008/CAB/PVPM/ETPS/2010 du 1er avril 2010, art. 1er et 2 et formulaire annexé, en ce qu'il n'est pas contraire";

export const EXEMPLAIRES_ETABLISSEMENT = DEPOT_ARRETE_2023;

/**
 * « DANS LA QUINZAINE QUI PRÉCÈDE l'ouverture ou la fermeture » (art. 216 ;
 * arrêté n° 008, art. 1er), et une modification « dans le même délai »
 * (art. 2). Lecture d'OmegaX · les quinze jours qui précèdent l'événement, du
 * quinzième jour avant au jour d'avant, tous deux compris. Un délai FRANC
 * n'est pas écrit · le jour de l'événement n'est pas « qui précède ».
 */
export function fenetreDeclarationEtablissement(dateEvenement: string): { du: string; au: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEvenement)) return null;
  const d = new Date(`${dateEvenement}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || jour(d) !== dateEvenement) return null;
  const MS = 86_400_000;
  return { du: jour(new Date(d.getTime() - 15 * MS)), au: jour(new Date(d.getTime() - MS)) };
}

export function formulaireEtablissement(e: EmployeurDeclare) {
  const declarant: ChampFormulaire[] = [
    { libelle: 'Nom ou raison sociale', valeur: e.nom },
    { libelle: 'Adresse, B.P., téléphone', valeur: ou(e.adresse, e.ville, e.telephone) },
    { libelle: 'Activité principale', valeur: e.activite },
    { libelle: 'N° INSS (CNSS)', valeur: e.numeroAffiliationCnssEmployeur },
  ];
  const manquants = declarant.filter((x) => x.valeur === null).map((x) => x.libelle);
  // La forme (propriété individuelle, société, service public, paraétatique,
  // libérale, association sans but lucratif, syndicat, établissement de
  // bienfaisance) se coche · aucune table ne range la forme juridique du
  // dossier parmi ces cases sans les forcer.
  manquants.push('Forme du déclarant · à cocher sur le formulaire');
  return { declarant, manquants };
}
