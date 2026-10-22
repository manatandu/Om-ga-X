import { NatureActeEffet, Referentiel, SensEffet, StatutEffet } from '@prisma/client';
import { estUnJour } from '../virements-fonds/virement-fonds';

/**
 * EFFETS DE COMMERCE (ligne sage-l3, fonction 39 · chez Sage, « Moyens de
 * paiement » · LCR à l'encaissement, mise en portefeuille, acceptation ; LCR
 * à décaisser, relevés de LCR à payer et bons à payer). Les règles tiennent
 * aux fiches de l'AUDCIF, Titre VII, lues mot pour mot le 2026-10-22 (décision
 * D13, `docs/comparaison-sage/reproduction/architecture.md`) ·
 *
 * Fiche du compte 41 · 412 « Clients, effets à recevoir en portefeuille »
 * (4121 à 4125), 415 « Clients, effets escomptés non échus », 413 « 4132
 * effets impayés » (« les chèques, effets à payer et autres valeurs revenus
 * impayés doivent être enregistrés au compte 413 »).
 * Fiche du compte 40 · 402 « Fournisseurs, effets à payer » (4021, 4022,
 * 4023) ; 4046 et 4047 (effets à payer sur immobilisations) ne sont pas
 * servis ici.
 * Fiche du compte 51 · 512 « effets à l'encaissement », ceux « transmis à la
 * banque » · « débité lors de la réception de l'effet, par le crédit des
 * comptes de tiers concernés », « crédité du montant des effets, pour solde,
 * par le débit des comptes de trésorerie » ; exclusions · effets à payer à
 * plus d'un an → 16, effets remis à l'escompte → 56.
 * Fiche du compte 56 · 564 « escompte de crédits de campagne », 565
 * « escompte de crédits ordinaires » · « la créance ne disparaît pas du
 * bilan » ; trois temps · (1) remise à l'escompte D 415 / C 412, (2)
 * décompte D 52 net + D 675 frais et intérêts / C 565 nominal, (3) après
 * l'échéance dénouée D 565 / C 415.
 * Fiche du compte 67 · 675 « escomptes des effets de commerce » · « après la
 * remise au banquier de l'effet à l'escompte, lors de la réception du
 * bordereau d'escompte, le montant indiqué sur le décompte bancaire au titre
 * des frais prélevés pour l'opération d'escompte » ; les commissions de
 * service vont au 631 (fiche du 63 · 6312 « frais sur effets »).
 *
 * UN NUMÉRO, DEUX PLANS · le SYCEBNL (Partie 2 ch. 3) n'ouvre NI 412 effets
 * (son 412 est « Clients-usagers »), NI 415, NI 511, NI 512, NI 564, NI 675 ;
 * il ouvre 402 (4021, 4023) et 565, et sa fiche du 56 ne décrit aucun
 * escompte. Au SYCEBNL seuls les EFFETS À PAYER sont servis (402) ; les
 * effets à recevoir et l'escompte sont SYSCOHADA seuls, refus nommé.
 *
 * TVA · décret n° 011/42, art. 57 · l'encaissement intervient « à la date
 * d'échéance de la traite, même si elle a été remise à l'escompte auprès d'un
 * établissement financier, en cas de paiement par effet de commerce » ;
 * art. 96 · « le droit à déduction prend naissance lorsque la taxe devient
 * exigible chez l'assujetti [...] le fournisseur ». L'acceptation D 412 /
 * C 411 (ou D 401 / C 402), lettrée avec la facture, porte donc l'ÉCHÉANCE
 * sur sa pièce (`Ecriture.dateEncaissementEffet`), que le moteur lit comme
 * date du règlement aux deux sens (`TauxTvaService.dateDuReglement`) · sans
 * elle, la taxe devenait exigible au jour de l'effet, ou restait en attente
 * pour toujours. L'impayé n'y change rien · la taxe reste exigible à
 * l'échéance (art. 57), et sa récupération passe par le duplicata de
 * l'art. 52 (créances douteuses), non branché sur le 4132 · limite écrite.
 *
 * Non reproduits (décision D11) · le bordereau groupé de LCR, les formats
 * CFONB et ETEBAC, le relevé de LCR à payer reçu de la banque.
 */

export const LIBELLES_SENS: Readonly<Record<SensEffet, string>> = {
  A_RECEVOIR: 'Effet à recevoir',
  A_PAYER: 'Effet à payer',
};

export const LIBELLES_STATUT: Readonly<Record<StatutEffet, string>> = {
  EN_PORTEFEUILLE: 'En portefeuille',
  REMIS_A_L_ENCAISSEMENT: "Remis à l'encaissement",
  ESCOMPTE: 'Escompté',
  ENCAISSE: 'Encaissé',
  IMPAYE: 'Impayé',
  BON_A_PAYER: 'Bon à payer',
  PAYE: 'Payé',
  ANNULE: 'Annulé',
};

export const LIBELLES_ACTE: Readonly<Record<NatureActeEffet, string>> = {
  ACCEPTATION: 'Acceptation',
  REMISE_ENCAISSEMENT: "Remise à l'encaissement",
  REMISE_ESCOMPTE: "Remise à l'escompte",
  DECOMPTE_ESCOMPTE: "Décompte d'escompte",
  ENCAISSEMENT: 'Encaissement',
  DENOUEMENT_ESCOMPTE: "Dénouement de l'escompte",
  IMPAYE: 'Impayé',
  BON_A_PAYER: 'Bon à payer',
  PAIEMENT: 'Paiement',
};

export type RoleCompteEffet = 'PORTEFEUILLE' | 'ENCAISSEMENT' | 'ESCOMPTE_NON_ECHU' | 'CREDIT_ESCOMPTE' | 'FRAIS_ESCOMPTE' | 'COMMISSION' | 'IMPAYE';
export const ROLES_COMPTE_EFFET: readonly RoleCompteEffet[] = ['PORTEFEUILLE', 'ENCAISSEMENT', 'ESCOMPTE_NON_ECHU', 'CREDIT_ESCOMPTE', 'FRAIS_ESCOMPTE', 'COMMISSION', 'IMPAYE'];

/** Les racines du SYSCOHADA, fiche par fiche (AUDCIF Titre VII · 40, 41, 51, 56, 63, 67). */
const RACINES_SYSCOHADA: Readonly<Record<RoleCompteEffet, readonly string[]>> = {
  PORTEFEUILLE: ['412'],
  ENCAISSEMENT: ['512'],
  ESCOMPTE_NON_ECHU: ['415'],
  CREDIT_ESCOMPTE: ['564', '565'],
  FRAIS_ESCOMPTE: ['675'],
  COMMISSION: ['6312'],
  IMPAYE: ['4132'],
};

export const MOTIF_SYCEBNL_A_RECEVOIR =
  "Le plan SYCEBNL n'ouvre pas les effets à recevoir · son 412 est « Clients-usagers », il n'a ni 415, ni 511, ni 512, ni 564, ni 675, et sa fiche du compte 56 ne décrit aucun escompte (Partie 2 ch. 3). Seuls les effets À PAYER (402) sont servis à une entité à but non lucratif.";

/** Le compte de tiers que l'acceptation solde · le client (411) ou le fournisseur (401). */
export function racineTiers(sens: SensEffet): string {
  return sens === SensEffet.A_RECEVOIR ? '411' : '401';
}

/**
 * Les racines admises pour un rôle · un numéro, deux plans. `null` avec son
 * motif quand le plan du dossier n'ouvre pas le compte · jamais une table
 * servie à l'autre référentiel.
 */
export function racinesDuRole(referentiel: Referentiel, role: RoleCompteEffet, sens: SensEffet): { racines: readonly string[]; motif: null } | { racines: null; motif: string } {
  if (role === 'PORTEFEUILLE') {
    if (sens === SensEffet.A_PAYER) return { racines: ['402'], motif: null };
    if (referentiel === Referentiel.SYCEBNL) return { racines: null, motif: MOTIF_SYCEBNL_A_RECEVOIR };
    return { racines: RACINES_SYSCOHADA.PORTEFEUILLE, motif: null };
  }
  if (sens === SensEffet.A_PAYER) {
    return { racines: null, motif: "Un effet à payer n'a ni remise, ni escompte, ni impayé dans OmegaX · il se paie (D 402 / C 52) à son échéance." };
  }
  if (referentiel === Referentiel.SYCEBNL) return { racines: null, motif: MOTIF_SYCEBNL_A_RECEVOIR };
  return { racines: RACINES_SYSCOHADA[role], motif: null };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface EffetPropose {
  montant?: unknown;
  reference?: unknown;
  tire?: unknown;
  dateCreation?: unknown;
  dateEcheance?: unknown;
}

/** Un effet se juge entier avant toute pièce · montant au centime, référence, deux jours dans l'ordre. */
export function motifRefusEffet(e: EffetPropose): string | null {
  if (typeof e.montant !== 'number' || !Number.isFinite(e.montant) || e.montant <= 0) return "Le montant de l'effet est un nombre positif.";
  if (Math.abs(Math.round(e.montant * 100) - e.montant * 100) > 1e-6) return "Le montant de l'effet se saisit au centime près.";
  if (typeof e.reference !== 'string' || e.reference.trim().length === 0 || e.reference.trim().length > 60) {
    return "La référence de l'effet (numéro de la traite ou du billet) est de un à soixante caractères.";
  }
  if (e.tire !== undefined && e.tire !== null && (typeof e.tire !== 'string' || e.tire.length > 120)) return 'Le tiré ou le tireur est un texte de cent vingt caractères au plus.';
  if (typeof e.dateCreation !== 'string' || !estUnJour(e.dateCreation)) return "La date de création de l'effet est un jour (AAAA-MM-JJ).";
  if (typeof e.dateEcheance !== 'string' || !estUnJour(e.dateEcheance)) return "L'échéance de l'effet est un jour (AAAA-MM-JJ).";
  if (e.dateEcheance < e.dateCreation) return "L'échéance de l'effet n'est pas antérieure à sa création.";
  return null;
}

/** Les actes qu'un statut admet, par sens · la liste FERMÉE des transitions. */
export const ACTES_ADMIS: Readonly<Record<SensEffet, Readonly<Partial<Record<StatutEffet, readonly NatureActeEffet[]>>>>> = {
  A_RECEVOIR: {
    EN_PORTEFEUILLE: [NatureActeEffet.REMISE_ENCAISSEMENT, NatureActeEffet.REMISE_ESCOMPTE, NatureActeEffet.IMPAYE],
    REMIS_A_L_ENCAISSEMENT: [NatureActeEffet.ENCAISSEMENT, NatureActeEffet.IMPAYE],
    ESCOMPTE: [NatureActeEffet.DECOMPTE_ESCOMPTE, NatureActeEffet.DENOUEMENT_ESCOMPTE, NatureActeEffet.IMPAYE],
  },
  A_PAYER: {
    EN_PORTEFEUILLE: [NatureActeEffet.BON_A_PAYER, NatureActeEffet.PAIEMENT],
    BON_A_PAYER: [NatureActeEffet.PAIEMENT],
  },
};

/**
 * Le statut que les actes NON ANNULÉS résument, rejoué à chaque geste et à
 * chaque annulation (l'annulation va à rebours, le dernier acte d'abord).
 */
export function statutApresActes(sens: SensEffet, natures: readonly NatureActeEffet[]): StatutEffet {
  if (!natures.includes(NatureActeEffet.ACCEPTATION)) return StatutEffet.ANNULE;
  if (natures.includes(NatureActeEffet.IMPAYE)) return StatutEffet.IMPAYE;
  if (sens === SensEffet.A_PAYER) {
    if (natures.includes(NatureActeEffet.PAIEMENT)) return StatutEffet.PAYE;
    if (natures.includes(NatureActeEffet.BON_A_PAYER)) return StatutEffet.BON_A_PAYER;
    return StatutEffet.EN_PORTEFEUILLE;
  }
  if (natures.includes(NatureActeEffet.ENCAISSEMENT) || natures.includes(NatureActeEffet.DENOUEMENT_ESCOMPTE)) return StatutEffet.ENCAISSE;
  if (natures.includes(NatureActeEffet.REMISE_ESCOMPTE)) return StatutEffet.ESCOMPTE;
  if (natures.includes(NatureActeEffet.REMISE_ENCAISSEMENT)) return StatutEffet.REMIS_A_L_ENCAISSEMENT;
  return StatutEffet.EN_PORTEFEUILLE;
}

export interface ActeJuge {
  nature: NatureActeEffet;
  date: string;
}

export interface EffetJuge {
  sens: SensEffet;
  statut: StatutEffet;
  dateCreation: string;
  dateEcheance: string;
  /** Les natures des actes non annulés, dans l'ordre des dates. */
  actes: readonly ActeJuge[];
}

/** Un acte se juge contre le statut, la date du précédent et l'échéance · refus nommé, jamais un geste juste refusé sans issue. */
export function motifRefusActe(effet: EffetJuge, acte: { nature: NatureActeEffet; date: unknown }): string | null {
  if (typeof acte.date !== 'string' || !estUnJour(acte.date)) return `La date de l'acte « ${LIBELLES_ACTE[acte.nature]} » est un jour (AAAA-MM-JJ).`;
  const admis = ACTES_ADMIS[effet.sens][effet.statut] ?? [];
  if (!admis.includes(acte.nature)) {
    return `Un effet « ${LIBELLES_STATUT[effet.statut]} » n'admet pas « ${LIBELLES_ACTE[acte.nature]} »${admis.length ? ` · il admet ${admis.map((a) => LIBELLES_ACTE[a].toLowerCase()).join(', ')}` : ''}.`;
  }
  if (acte.nature === NatureActeEffet.DECOMPTE_ESCOMPTE && effet.actes.some((a) => a.nature === NatureActeEffet.DECOMPTE_ESCOMPTE)) {
    return "Le décompte d'escompte de cet effet est déjà passé · annulez-le avant d'en passer un autre.";
  }
  if (acte.nature === NatureActeEffet.DENOUEMENT_ESCOMPTE) {
    if (!effet.actes.some((a) => a.nature === NatureActeEffet.DECOMPTE_ESCOMPTE)) {
      return "L'escompte se dénoue après son décompte (fiche du compte 56 · D 565 / C 415 « après l'échéance ») · passez d'abord le décompte de la banque.";
    }
    if (acte.date < effet.dateEcheance) return `L'escompte se dénoue à l'échéance de l'effet au plus tôt (${effet.dateEcheance}, fiche du compte 56 · « après l'échéance »).`;
  }
  const dernier = effet.actes.length ? effet.actes[effet.actes.length - 1] : null;
  if (dernier && acte.date < dernier.date) {
    return `L'acte « ${LIBELLES_ACTE[acte.nature]} » ne se date pas avant le précédent (« ${LIBELLES_ACTE[dernier.nature]} » du ${dernier.date}).`;
  }
  return null;
}

export interface LigneProposee {
  compteId: string;
  libelle: string;
  debit: number;
  credit: number;
}

const d = (compteId: string, libelle: string, montant: number): LigneProposee => ({ compteId, libelle, debit: round2(montant), credit: 0 });
const c = (compteId: string, libelle: string, montant: number): LigneProposee => ({ compteId, libelle, debit: 0, credit: round2(montant) });

/** L'acceptation · D 412 / C 411 (fiche du 41 · le 412 « débité lors de l'acceptation ») ou D 401 / C 402 (fiche du 40). */
export function lignesAcceptation(e: { sens: SensEffet; compteEffetId: string; compteTiersId: string; montant: number; libelle: string }): LigneProposee[] {
  return e.sens === SensEffet.A_RECEVOIR
    ? [d(e.compteEffetId, e.libelle, e.montant), c(e.compteTiersId, e.libelle, e.montant)]
    : [d(e.compteTiersId, e.libelle, e.montant), c(e.compteEffetId, e.libelle, e.montant)];
}

/** La remise à l'encaissement · D 512 / C 412 (fiche du 51, « par le crédit des comptes de tiers concernés »). */
export function lignesRemiseEncaissement(e: { compteEncaissementId: string; compteEffetId: string; montant: number; libelle: string }): LigneProposee[] {
  return [d(e.compteEncaissementId, e.libelle, e.montant), c(e.compteEffetId, e.libelle, e.montant)];
}

/** La remise à l'escompte · D 415 / C 412 (fiche du 56, premier temps). */
export function lignesRemiseEscompte(e: { compteEscompteNonEchuId: string; compteEffetId: string; montant: number; libelle: string }): LigneProposee[] {
  return [d(e.compteEscompteNonEchuId, e.libelle, e.montant), c(e.compteEffetId, e.libelle, e.montant)];
}

/**
 * Le décompte de la banque · D 52 du net, D 675 des frais et intérêts
 * d'escompte (fiche du 67), D 6312 de la commission de service (fiche du
 * 63), C 565 du nominal (fiche du 56, second temps). Le net est ce qui
 * reste · un décompte dont frais et commission dépassent le nominal est
 * refusé avant toute ligne.
 */
export function lignesDecompte(e: {
  compteBanqueId: string;
  compteFraisId: string | null;
  compteCommissionId: string | null;
  compteCreditEscompteId: string;
  montant: number;
  frais: number;
  commission: number;
  libelle: string;
}): LigneProposee[] {
  const net = round2(e.montant - e.frais - e.commission);
  const lignes: LigneProposee[] = [d(e.compteBanqueId, e.libelle, net)];
  if (e.frais > 0 && e.compteFraisId) lignes.push(d(e.compteFraisId, `${e.libelle} · frais et intérêts d'escompte`, e.frais));
  if (e.commission > 0 && e.compteCommissionId) lignes.push(d(e.compteCommissionId, `${e.libelle} · commission`, e.commission));
  lignes.push(c(e.compteCreditEscompteId, e.libelle, e.montant));
  return lignes;
}

/** L'encaissement · D 52 du net, D 6312 de la commission / C 512 pour solde (fiche du 51). */
export function lignesEncaissement(e: { compteBanqueId: string; compteCommissionId: string | null; compteEncaissementId: string; montant: number; commission: number; libelle: string }): LigneProposee[] {
  const net = round2(e.montant - e.commission);
  const lignes: LigneProposee[] = [d(e.compteBanqueId, e.libelle, net)];
  if (e.commission > 0 && e.compteCommissionId) lignes.push(d(e.compteCommissionId, `${e.libelle} · commission`, e.commission));
  lignes.push(c(e.compteEncaissementId, e.libelle, e.montant));
  return lignes;
}

/** Le dénouement après l'échéance · D 565 / C 415 (fiche du 56, troisième temps). */
export function lignesDenouement(e: { compteCreditEscompteId: string; compteEscompteNonEchuId: string; montant: number; libelle: string }): LigneProposee[] {
  return [d(e.compteCreditEscompteId, e.libelle, e.montant), c(e.compteEscompteNonEchuId, e.libelle, e.montant)];
}

/**
 * L'impayé · D 4132 (fiche du 41) / C le compte où l'effet se trouve (412 en
 * portefeuille, 512 remis, 415 escompté) ; escompté et décompté, la banque
 * reprend les fonds · D 565 / C 52 du nominal, dans la même pièce.
 */
export function lignesImpaye(e: {
  compteImpayeId: string;
  compteCrediteId: string;
  montant: number;
  libelle: string;
  repriseBanque: { compteCreditEscompteId: string; compteBanqueId: string } | null;
}): LigneProposee[] {
  const lignes: LigneProposee[] = [d(e.compteImpayeId, e.libelle, e.montant), c(e.compteCrediteId, e.libelle, e.montant)];
  if (e.repriseBanque) {
    lignes.push(d(e.repriseBanque.compteCreditEscompteId, `${e.libelle} · reprise du décompte`, e.montant), c(e.repriseBanque.compteBanqueId, `${e.libelle} · reprise du décompte`, e.montant));
  }
  return lignes;
}

/** Le paiement d'un effet à payer · D 402 / C 52 (fiche du 40, « débité des règlements »). */
export function lignesPaiement(e: { compteEffetId: string; compteBanqueId: string; montant: number; libelle: string }): LigneProposee[] {
  return [d(e.compteEffetId, e.libelle, e.montant), c(e.compteBanqueId, e.libelle, e.montant)];
}

/** Frais, commission et référence d'une pièce de banque se jugent ensemble · au centime, jamais au-delà du nominal. */
export function motifRefusDecompte(e: { montant: number; frais: unknown; commission: unknown; referencePiece: unknown; compteFraisId: string | null; compteCommissionId: string | null }): string | null {
  for (const [valeur, nom, compte] of [
    [e.frais, 'Les frais et intérêts d\'escompte', e.compteFraisId],
    [e.commission, 'La commission', e.compteCommissionId],
  ] as const) {
    if (valeur === undefined || valeur === null) continue;
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < 0) return `${nom} sont un nombre positif ou nul.`;
    if (Math.abs(Math.round(valeur * 100) - valeur * 100) > 1e-6) return `${nom} se saisissent au centime près.`;
    if (valeur > 0 && !compte) return `${nom} exigent leur compte (675 pour les frais d'escompte, 6312 pour la commission).`;
  }
  const frais = typeof e.frais === 'number' ? e.frais : 0;
  const commission = typeof e.commission === 'number' ? e.commission : 0;
  if (round2(frais + commission) >= e.montant) return `Frais et commission (${round2(frais + commission).toFixed(2)}) atteignent le nominal de l'effet (${e.montant.toFixed(2)}) · rien ne serait crédité.`;
  if (typeof e.referencePiece !== 'string' || e.referencePiece.trim().length === 0 || e.referencePiece.trim().length > 60) {
    return 'La référence de la pièce de la banque (décompte, avis, relevé) est de un à soixante caractères (AUDCIF art. 17).';
  }
  return null;
}
