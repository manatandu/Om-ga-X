/**
 * LIGNE SAGE-L4, N° 73 · LE TRANSFERT D'UN BIEN ENTRE DEUX DOSSIERS DU GROUPE.
 * Règles pures.
 *
 * SYSCOHADA SEUL. AUDCIF, Titre VII, fiche du compte 18 · « Le compte de
 * liaison des établissements et succursales est un compte de bilan ouvert au
 * nom de l'établissement. Il fonctionne comme un compte courant : toutes les
 * opérations réalisées entre le siège et l'établissement y sont enregistrées
 * comme s'il s'agissait d'un tiers. [...] Les opérations entre le siège et
 * l'établissement sont enregistrées de manière symétrique, dans la même
 * période comptable et sur la base des mêmes pièces justificatives : les
 * comptes de liaison sont égaux et de sens contraire dans les deux
 * comptabilités. » Et · « Celle des comptes 184 à 187 est réservée aux
 * opérations entre établissements d'une même entité. »
 *
 * « COMME S'IL S'AGISSAIT D'UN TIERS » RÉGIT LA TENUE DU COMPTE, JAMAIS LA
 * VALEUR. La phrase dit comment le compte de liaison FONCTIONNE · en compte
 * courant, chaque opération y laissant une créance ou une dette envers l'autre
 * comptabilité, comme envers un tiers. Elle ne fait pas du transfert une vente
 * · le siège et l'établissement sont UNE entité, et rien ne s'échange avec un
 * tiers. La valeur suit donc l'art. 35 (coût historique) et l'art. 36, dont le
 * coût d'acquisition ne vise que les biens « achetés à des tiers » · le bien
 * passe à sa VALEUR D'ENTRÉE, avec ses AMORTISSEMENTS et ses DÉPRÉCIATIONS
 * cumulés, son plan inchangé. Aucune écriture au 81 ni au 82 · une plus-value
 * interne gonflerait le résultat de l'un et l'actif de l'autre, et la liasse
 * du groupe, où les 184 à 187 sortent de l'agrégat (CLAUDE.md § 6, module
 * groupe), porterait un résultat qu'aucun tiers n'a payé.
 *
 * LE SIÈGE EST TOUJOURS D'UN CÔTÉ. La fiche ouvre « au siège, un compte de
 * liaison au nom de chaque établissement [...] et, dans l'établissement [...]
 * un compte réfléchi au nom du siège » · elle ne décrit aucun compte entre deux
 * établissements. Un bien qui va d'une cellule à une autre passe donc par deux
 * transferts, de la cellule au siège puis du siège à l'autre cellule, sans quoi
 * les comptes de liaison du siège ne refléteraient plus ceux des cellules.
 *
 * LE MOIS DU TRANSFERT EST DOTÉ CHEZ CELUI QUI CÈDE · comme à toute sortie (le
 * mois de la sortie compris, `ImmobilisationService.calculerDotation`) ; chez
 * celui qui reçoit, la dotation de l'exercice d'entrée court du mois qui suit.
 * Lecture d'OmegaX pour un transfert en cours de mois, aucun texte lu ne la
 * tranchant · elle partage l'annuité entre les deux dossiers sans compter un
 * mois deux fois.
 *
 * AU SYCEBNL · REFUS NOMMÉ. Son compte 18 porte les emprunts et dettes
 * assimilées, sans compte de liaison, et la fiche de son compte 58 ne vise que
 * la trésorerie (« un débit à porter dans un compte support d'un journal
 * auxiliaire [...] par le crédit : des comptes de trésorerie »). La question
 * (n'admettre que les fonds par le 58, ou admettre le bien par le 588 au-delà
 * de la lettre) est posée à Manasse (`docs/suivi-reprises.md`).
 */

const EPSILON = 0.005;

/** Les racines des comptes de liaison qu'un bien peut mouvementer · le 186 et le 187 portent les charges et les produits. */
export const RACINES_LIAISON_BIEN = ['184', '185'] as const;

export const MOTIF_REFUS_SYCEBNL =
  "Le transfert d'un bien entre deux dossiers du groupe n'est servi qu'au SYSCOHADA (AUDCIF, Titre VII, fiche du compte 18 · " +
  'comptes de liaison 184 à 187). Au SYCEBNL, le compte 18 porte des emprunts et la fiche du compte 58 ne vise que la ' +
  "trésorerie (« par le crédit : des comptes de trésorerie », Partie 2 ch. 3) · aucun texte lu n'y fait passer un bien. " +
  'La question est posée à VMG Consulting.';

/** Le premier jour du mois qui suit l'entrée · le mois du transfert a été doté chez celui qui cède. */
export function debutDeDetention(dateEntreeGroupe: Date | null | undefined): Date | null {
  if (!dateEntreeGroupe) return null;
  return new Date(Date.UTC(dateEntreeGroupe.getUTCFullYear(), dateEntreeGroupe.getUTCMonth() + 1, 1));
}

/**
 * LES DÉPRÉCIATIONS QUI COMPTENT POUR LA DOTATION D'UN EXERCICE · celles des
 * exercices antérieurs, et celle qui a suivi le bien à son entrée par
 * transfert · constituée avant l'entrée, elle ré-étale le plan dès l'exercice
 * d'entrée (AUDCIF Titre VIII ch. 12 § 2.4.1), comme elle le faisait chez
 * celui qui cède. Lue sur l'exercice seul, elle n'aurait compté qu'à
 * l'exercice suivant, et la première dotation chez celui qui reçoit aurait
 * amorti ce qui était déjà déprécié.
 */
export function estDepreciationAnterieure(
  d: { sens: string; nature?: string | null; exercice: { dateFin: Date } },
  exercice: { dateFin: Date },
): boolean {
  if (d.nature === 'TRANSFERT_GROUPE' && d.sens === 'DOTATION') return true;
  return d.exercice.dateFin < exercice.dateFin;
}

export type FaitsDuBien = {
  statut: string;
  dateAcquisition: Date;
  dateMiseEnService: Date | null;
  compteEnCours: boolean;
  composantDe: boolean;
  composantsEnService: number;
  degressifFiscal: boolean;
  reevaluations: number;
  subventionsNonSoldees: number;
  detteAleatoireNonSoldee: boolean;
  demantelement: boolean;
  locationAcquisition: boolean;
  unitesOeuvreDeprecie: boolean;
  dotationDeLExercicePassee: boolean;
  dateEntreeGroupe: Date | null;
};

/** Pourquoi ce bien ne se transfère pas, ou null · chaque refus dit son issue. */
export function motifRefusBien(b: FaitsDuBien, date: Date): string | null {
  if (b.statut !== 'EN_SERVICE') return 'Le bien est déjà sorti · il ne se transfère plus.';
  if (b.compteEnCours) {
    return "Le bien est en cours (2x9) · il se transfère une fois achevé et mis en service à son compte définitif, la dépense en cours restant celle du dossier qui l'engage.";
  }
  if (b.composantDe) {
    return "Le bien est un composant d'une immobilisation principale (AUDCIF Titre VIII ch. 4) · il suit son principal, il ne se transfère pas seul.";
  }
  if (b.composantsEnService > 0) {
    return `Le bien porte ${b.composantsEnService} composant(s) en service · le transfert d'un principal et de ses composants ensemble n'est pas servi ; chacun a son plan propre.`;
  }
  if (b.degressifFiscal) {
    return "Le bien suit le plan fiscal dégressif et porte un dérogatoire au 151 (fiche du compte 68 ; loi n° 23/053, art. 31 à 35) · la provision réglementée et son plan fiscal ne suivent pas le bien. Reprenez le dérogatoire (« Reprendre le solde ») avant le transfert.";
  }
  if (b.reevaluations > 0) {
    return "Le bien a été réévalué (AUDCIF Titre VIII ch. 28) · l'écart au 106 ou la provision spéciale au 154 restent dans le dossier qui l'a réévalué et se reprennent avec le bien · le transfert d'un bien réévalué n'est pas servi.";
  }
  if (b.subventionsNonSoldees > 0) {
    return "Une subvention d'investissement est rattachée au bien et se reprend au rythme de son amortissement (fiche du compte 14) · elle reste dans le dossier qui l'a reçue, le transfert n'est pas servi tant qu'elle n'est pas soldée.";
  }
  if (b.detteAleatoireNonSoldee) return "Le bien porte une dette à prix aléatoire non soldée (rente, redevances) · elle reste au dossier qui l'a contractée ; soldez-la d'abord.";
  if (b.demantelement) return "Le bien porte un composant de démantèlement actualisé (AUDCIF Titre VIII ch. 6) · la provision reste au dossier qui l'a constituée ; le transfert n'est pas servi.";
  if (b.locationAcquisition) return "Le bien est tenu par un contrat de location-acquisition · la dette reste au dossier qui l'a signée ; le transfert n'est pas servi.";
  if (b.unitesOeuvreDeprecie) {
    return "Le bien s'amortit aux unités d'œuvre et porte une dépréciation · le ré-étalement se compte sur les unités consommées, que les relevés du dossier qui cède portent seuls ; le transfert n'est pas servi.";
  }
  if (b.dotationDeLExercicePassee) {
    return "La dotation de l'exercice du transfert est déjà passée sur ce bien · l'annuité se partage entre les deux dossiers au mois du transfert. Annulez d'abord cette dotation (onglet Traitements de la fiche), puis transférez.";
  }
  if (date.getTime() < b.dateAcquisition.getTime()) return "Le transfert ne précède pas l'acquisition du bien.";
  if (b.dateMiseEnService && date.getTime() < b.dateMiseEnService.getTime()) return 'Le transfert ne précède pas la mise en service du bien.';
  if (b.dateEntreeGroupe && date.getTime() <= b.dateEntreeGroupe.getTime()) {
    return `Le bien est entré dans ce dossier le ${b.dateEntreeGroupe.toISOString().slice(0, 10)} · un nouveau transfert lui est postérieur.`;
  }
  return null;
}

export type DossierDuGroupe = { id: string; dossierMereId: string | null; referentiel: string; systemeComptableSyscohada: string | null };

/** Pourquoi ces deux dossiers ne se transfèrent pas un bien, ou null. */
export function motifRefusDossiers(p: { siegeId: string; cedant: DossierDuGroupe | null; receveur: DossierDuGroupe | null }): string | null {
  const { cedant, receveur } = p;
  if (!cedant || !receveur) return "Les deux dossiers doivent être du groupe de ce siège · un dossier hors du groupe ne reçoit ni ne cède de bien par les comptes de liaison.";
  if (cedant.id === receveur.id) return 'Le bien reste dans le même dossier · choisissez le dossier qui le reçoit.';
  const dansLeGroupe = (d: DossierDuGroupe) => d.id === p.siegeId || d.dossierMereId === p.siegeId;
  if (!dansLeGroupe(cedant) || !dansLeGroupe(receveur)) {
    return "Les deux dossiers doivent être du groupe de ce siège · un dossier hors du groupe ne reçoit ni ne cède de bien par les comptes de liaison.";
  }
  if (cedant.id !== p.siegeId && receveur.id !== p.siegeId) {
    return "La fiche du compte 18 relie le siège à chaque établissement, jamais deux établissements entre eux · le bien passe d'abord au siège, puis du siège à l'autre cellule (deux transferts).";
  }
  if (cedant.referentiel !== receveur.referentiel) return 'Les deux dossiers ne tiennent pas le même référentiel · le bien ne passe pas de l’un à l’autre.';
  if (cedant.referentiel !== 'SYSCOHADA') return MOTIF_REFUS_SYCEBNL;
  if (cedant.systemeComptableSyscohada !== receveur.systemeComptableSyscohada) {
    return "Les deux dossiers ne tiennent pas le même système (normal ou minimal de trésorerie) · l'entité n'en a qu'un (AUDCIF art. 11 et 13).";
  }
  return null;
}

/** Un compte de liaison qui porte un bien · Détail, actif, sous le 184 ou le 185. */
export function motifRefusCompteLiaison(c: { numero: string; typeCompte: string; estActif: boolean } | null, cote: 'cède' | 'reçoit'): string | null {
  if (!c) return `Choisissez le compte de liaison du dossier qui ${cote} le bien.`;
  if (!RACINES_LIAISON_BIEN.some((r) => c.numero.startsWith(r))) {
    return `Le compte ${c.numero} n'est pas un compte permanent de liaison (184 ou 185, fiche du compte 18) · le 186 et le 187 portent les charges et les produits, jamais un bien.`;
  }
  if (c.typeCompte !== 'DETAIL') return `Le compte ${c.numero} est un compte de regroupement · choisissez un compte de détail.`;
  if (!c.estActif) return `Le compte ${c.numero} est en sommeil.`;
  return null;
}

export type MontantsDuTransfert = {
  valeurOrigine: number;
  /** Le cumul des amortissements qui suit le bien, dotation complémentaire comprise. */
  amortissements: number;
  complementDotation: number;
  depreciations: number;
  valeurNette: number;
};

export function montantsDuTransfert(p: { valeurOrigine: number; cumulAmortiAvant: number; complement: number; depreciations: number }): MontantsDuTransfert {
  const c = (x: number) => Math.round(x * 100) / 100;
  const amortissements = c(p.cumulAmortiAvant + p.complement);
  return {
    valeurOrigine: c(p.valeurOrigine),
    amortissements,
    complementDotation: c(p.complement),
    depreciations: c(p.depreciations),
    valeurNette: c(p.valeurOrigine - amortissements - p.depreciations),
  };
}

export type ComptesDuCote = { bien: string; amortissement: string; depreciation: string | null; liaison: string; dotation: string };
type Ligne = { compteId: string; debit: number; credit: number };

/**
 * LES DEUX PIÈCES, SYMÉTRIQUES · chez celui qui cède, la dotation complémentaire
 * (D 68 / C 28), puis le bien qui sort à sa valeur d'entrée (C 2x), ses
 * amortissements (D 28) et sa dépréciation (D 29), le solde au compte de
 * liaison (D 18x) ; chez celui qui reçoit, l'inverse (D 2x, C 28, C 29, C 18x).
 * Le 18x de l'un et le 18x de l'autre portent la même valeur nette, de sens
 * contraire · la fiche du compte 18 le veut.
 */
export function piecesDuTransfert(m: MontantsDuTransfert, cedant: ComptesDuCote, receveur: ComptesDuCote): { cedant: Ligne[]; receveur: Ligne[] } {
  const garder = (l: Ligne[]) => l.filter((x) => x.debit > EPSILON || x.credit > EPSILON);
  if (m.depreciations > EPSILON && (!cedant.depreciation || !receveur.depreciation)) {
    throw new Error('Une dépréciation suit le bien sans compte 29 désigné des deux côtés.');
  }
  if (m.valeurNette < -EPSILON) throw new Error('La valeur nette du bien transféré est négative.');
  return {
    cedant: garder([
      { compteId: cedant.dotation, debit: m.complementDotation, credit: 0 },
      { compteId: cedant.amortissement, debit: 0, credit: m.complementDotation },
      { compteId: cedant.amortissement, debit: m.amortissements, credit: 0 },
      ...(cedant.depreciation ? [{ compteId: cedant.depreciation, debit: m.depreciations, credit: 0 }] : []),
      { compteId: cedant.liaison, debit: m.valeurNette, credit: 0 },
      { compteId: cedant.bien, debit: 0, credit: m.valeurOrigine },
    ]),
    receveur: garder([
      { compteId: receveur.bien, debit: m.valeurOrigine, credit: 0 },
      { compteId: receveur.amortissement, debit: 0, credit: m.amortissements },
      ...(receveur.depreciation ? [{ compteId: receveur.depreciation, debit: 0, credit: m.depreciations }] : []),
      { compteId: receveur.liaison, debit: 0, credit: m.valeurNette },
    ]),
  };
}
