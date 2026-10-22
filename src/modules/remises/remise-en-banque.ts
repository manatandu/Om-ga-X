import { NatureRemise, Referentiel, StatutRemiseEnBanque, StatutValeurRecue, TypeCompteDetailTotal, TypeJournal } from '@prisma/client';
import { estUnJour } from '../virements-fonds/virement-fonds';

/**
 * REMISES DE CHÈQUES ET DE CARTES (ligne sage-l3, fonction 40 · chez Sage,
 * « Moyens de paiement », remise en deux temps · le bordereau, puis
 * l'avis). Les règles tiennent à la fiche du COMPTE 51 des deux plans, lue
 * mot pour mot (AUDCIF Titre VII · SYCEBNL Partie 2 ch. 3, compte 51) ·
 *
 * « Les chèques à encaisser [513] sont les chèques que l'entité a reçus de
 * ses clients et qu'elle n'a pas encore transmis en banque. Les chèques à
 * l'encaissement [514] sont les chèques transmis à la banque qui n'ont pas
 * encore été crédités par cette dernière. Les cartes de crédit à encaisser
 * [515] enregistrent les paiements effectués par cartes de crédit jusqu'à
 * l'avis de crédit de la banque. Les commissions prélevées par la banque
 * pour de tels paiements sont enregistrées en services bancaires. »
 *
 * « Débité lors de la réception [du chèque], par le crédit des comptes de
 * tiers concernés. Crédité [...], pour solde, par le débit des comptes de
 * trésorerie concernés. » Éléments de contrôle · « chèques ; bordereaux de
 * remise de chèques ; relevés de banque ».
 *
 * « En cours d'exercice, les entités ne sont pas tenues d'utiliser le
 * compte 51. Par contre, à la clôture de l'exercice, il est obligatoire
 * d'inscrire au débit du compte 51 [...] le montant des chèques non encore
 * remis en banque ». Le module tient donc le 51 en permanence, ce qui rend
 * la clôture juste sans écriture d'inventaire.
 *
 * QUATRE TEMPS, QUATRE ÉCRITURES · (1) la RÉCEPTION, D 513 (chèque) ou 515
 * (carte) / C tiers ; (2) le BORDEREAU, D 514 / C 513 pour les chèques
 * transmis · une carte n'a pas de transit, son bordereau groupe seulement ;
 * (3) l'AVIS DE CRÉDIT, D 52 (net) et D 6315 (commission, « commissions sur
 * cartes de crédit », fiche du compte 63 des deux plans, sous 631 « Frais
 * bancaires ») / C 514 ou 515 pour solde ; (4) l'IMPAYÉ, « les chèques,
 * effets à payer et autres valeurs revenus impayés doivent être enregistrés
 * au compte 413 pour un meilleur suivi des incidents de paiements » (fiche
 * du compte 41 des deux plans) · D 413x / C 514 ou 515 (valeur remise) ou
 * C 52 (valeur déjà créditée, la banque reprend les fonds). UN NUMÉRO, DEUX
 * SENS au 413 · le SYSCOHADA subdivise par NATURE (4131 chèques, 4132
 * effets, 4133 cartes de crédit, 4138 autres), le SYCEBNL par DÉBITEUR ET
 * nature (4131 adhérents chèques, 4132 clients-usagers chèques, 4133
 * adhérents autres valeurs, 4138 clients-usagers autres valeurs) · jamais une
 * table servie à l'autre plan (`racineImpaye`).
 *
 * Ni l'effet de commerce (511, 512 · fonction 39, module `effets/`), ni
 * l'escompte (56) ne passent ici · la fiche les exclut nommément.
 */

export const LIBELLES_NATURE: Readonly<Record<NatureRemise, string>> = {
  CHEQUES: 'Chèques',
  CARTES: 'Cartes de crédit',
};

export const LIBELLES_STATUT_VALEUR: Readonly<Record<StatutValeurRecue, string>> = {
  RECUE: 'Reçue, non remise',
  REMISE: 'Remise en banque',
  CREDITEE: 'Créditée',
  IMPAYEE: 'Revenue impayée',
  ANNULEE: 'Annulée',
};

export const LIBELLES_STATUT_REMISE: Readonly<Record<StatutRemiseEnBanque, string>> = {
  REMISE: 'Remise à la banque',
  CREDITEE: 'Créditée',
  ANNULEE: 'Annulée',
};

/** Les rôles de compte d'un type de remise, et la racine que la fiche du 51 leur donne. */
export type RoleCompteRemise = 'RECEPTION' | 'TRANSIT' | 'COMMISSION' | 'IMPAYE';

export const RACINE_RECEPTION: Readonly<Record<NatureRemise, string>> = { CHEQUES: '513', CARTES: '515' };
/** Seuls les chèques transitent par le 514 · une carte reste au 515 jusqu'à l'avis. */
export const RACINE_TRANSIT = '514';
/** « Services bancaires » · 631 des deux plans, 6315 pour les cartes. */
export const RACINE_COMMISSION = '631';
export const COMPTE_COMMISSION_CARTES = '6315';
/** Les comptes de trésorerie que l'avis de crédit débite · banques et établissements financiers. */
export const RACINES_BANQUE_DE_REMISE: readonly string[] = ['52', '53'];

/**
 * La racine du compte d'impayé · fiche du compte 41 des deux plans. Un tiers
 * qui n'est ni adhérent (411) ni client-usager (412) au SYCEBNL laisse le
 * choix sous le 413 entier.
 */
export function racineImpaye(referentiel: Referentiel, nature: NatureRemise, numeroTiers: string): string {
  if (referentiel === Referentiel.SYSCOHADA) return nature === NatureRemise.CHEQUES ? '4131' : '4133';
  const adherent = numeroTiers.startsWith('411');
  const clientUsager = numeroTiers.startsWith('412');
  if (!adherent && !clientUsager) return '413';
  if (nature === NatureRemise.CHEQUES) return adherent ? '4131' : '4132';
  return adherent ? '4133' : '4138';
}

export function racineDuRole(role: RoleCompteRemise, nature: NatureRemise): string | null {
  switch (role) {
    case 'RECEPTION':
      return RACINE_RECEPTION[nature];
    case 'TRANSIT':
      return nature === NatureRemise.CHEQUES ? RACINE_TRANSIT : null;
    case 'COMMISSION':
      return RACINE_COMMISSION;
    case 'IMPAYE':
      return '413';
  }
}

export interface CompteJuge {
  numero: string;
  typeCompte: TypeCompteDetailTotal;
  estActif: boolean;
}

export interface JournalJuge {
  type: TypeJournal;
  estActif: boolean;
  compteTresorerie: { numero: string } | null;
}

export interface TypeRemiseJuge {
  code: string;
  intitule: string;
  nature: NatureRemise;
  journalBanque: JournalJuge | null;
  journalOperations: JournalJuge | null;
  compteReception: CompteJuge | null;
  compteTransit: CompteJuge | null;
  compteCommission: CompteJuge | null;
  modeleBordereau: string | null;
}

const CODE_TYPE = /^[A-Z0-9]{1,10}$/;

function compteSousRacine(c: CompteJuge | null, racine: string, role: string): string | null {
  if (!c) return `Le compte ${role} est introuvable dans ce dossier.`;
  if (c.typeCompte !== TypeCompteDetailTotal.DETAIL) return `Le compte ${role} (${c.numero}) est un compte TOTAL · choisissez un compte d'imputation.`;
  if (!c.estActif) return `Le compte ${role} (${c.numero}) est en sommeil.`;
  if (!c.numero.startsWith(racine)) return `Le compte ${role} (${c.numero}) n'est pas sous le ${racine} que la fiche du compte 51 prescrit.`;
  return null;
}

/** Tout se juge AVANT l'écriture du type · chaque refus nomme le champ et l'issue. */
export function motifRefusTypeRemise(t: TypeRemiseJuge): string | null {
  if (!CODE_TYPE.test(t.code)) return 'Le code du type de remise est de un à dix caractères, lettres majuscules ou chiffres.';
  if (t.intitule.trim().length < 3 || t.intitule.trim().length > 60) return "L'intitulé du type de remise est de trois à soixante caractères.";
  if (!t.journalBanque) return 'Le journal de la banque de remise est introuvable dans ce dossier.';
  if (t.journalBanque.type !== TypeJournal.TRESORERIE || !t.journalBanque.compteTresorerie) {
    return 'La banque de remise est un journal de TRÉSORERIE qui porte son compte · elle reçoit l’avis de crédit.';
  }
  if (!t.journalBanque.estActif) return 'Le journal de la banque de remise est en sommeil.';
  if (!RACINES_BANQUE_DE_REMISE.some((r) => t.journalBanque!.compteTresorerie!.numero.startsWith(r))) {
    return `Le compte ${t.journalBanque.compteTresorerie.numero} de la banque de remise n'est ni une banque (52) ni un établissement financier (53) · une caisse ne reçoit pas de remise.`;
  }
  if (!t.journalOperations) return "Le journal des opérations de remise est introuvable dans ce dossier.";
  if (t.journalOperations.type !== TypeJournal.GENERAL) {
    return "Les réceptions et les bordereaux passent dans un journal d'OPÉRATIONS DIVERSES (type général) · ni achats, ni ventes, ni trésorerie, ni situation.";
  }
  if (!t.journalOperations.estActif) return "Le journal des opérations de remise est en sommeil.";
  const reception = compteSousRacine(t.compteReception, RACINE_RECEPTION[t.nature], 'de réception');
  if (reception) return reception;
  if (t.nature === NatureRemise.CHEQUES) {
    const transit = compteSousRacine(t.compteTransit, RACINE_TRANSIT, "de transit (chèques à l'encaissement)");
    if (transit) return transit;
  } else if (t.compteTransit) {
    return "Une carte de crédit ne transite par aucun 514 · elle reste au 515 jusqu'à l'avis de crédit (fiche du compte 51). Retirez le compte de transit.";
  }
  if (t.compteCommission) {
    const commission = compteSousRacine(t.compteCommission, RACINE_COMMISSION, 'de commission');
    if (commission) return commission;
  }
  return motifRefusModeleBordereau(t.modeleBordereau);
}

/**
 * LE MODÈLE DU BORDEREAU · un texte à jetons, choisi à l'impression chez
 * Sage, posé ici sur le type. Même règle que les modèles d'impression des
 * tiers · tout ce qui est entre accolades sans être un jeton admis est
 * refusé, et `{lignes}` (le détail des valeurs) est exigé une fois.
 */
export const JETONS_BORDEREAU: ReadonlyArray<{ jeton: string; sens: string }> = [
  { jeton: '{dossier}', sens: 'nom du dossier' },
  { jeton: '{banque}', sens: 'journal de la banque de remise' },
  { jeton: '{type}', sens: 'intitulé du type de remise' },
  { jeton: '{numero}', sens: 'numéro du bordereau' },
  { jeton: '{date}', sens: 'date de la remise (jj/mm/aaaa)' },
  { jeton: '{nature}', sens: 'chèques ou cartes de crédit' },
  { jeton: '{nombre}', sens: 'nombre de valeurs remises' },
  { jeton: '{total}', sens: 'total de la remise' },
  { jeton: '{lignes}', sens: 'une ligne par valeur (référence, tireur, banque, montant)' },
];
export const LONGUEUR_MODELE_BORDEREAU = 4000;

export function motifRefusModeleBordereau(texte: string | null | undefined): string | null {
  if (texte === null || texte === undefined) return null;
  if (texte.length > LONGUEUR_MODELE_BORDEREAU) return `Le modèle du bordereau dépasse ${LONGUEUR_MODELE_BORDEREAU} caractères.`;
  const admis = new Set(JETONS_BORDEREAU.map((j) => j.jeton));
  const inconnus = [...texte.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).filter((j) => !admis.has(j));
  if (inconnus.length > 0) {
    return `Le modèle du bordereau porte ${inconnus.length > 1 ? 'des jetons inconnus' : 'un jeton inconnu'} · ${[...new Set(inconnus)].join(', ')}. Jetons admis · ${[...admis].join(', ')}.`;
  }
  const occurrences = texte.split('{lignes}').length - 1;
  if (occurrences !== 1) return 'Le modèle du bordereau porte le jeton {lignes} une fois, et une seule · c’est lui qui reçoit le détail des valeurs.';
  return null;
}

export interface LigneBordereau {
  reference: string;
  titulaire: string | null;
  banqueTiree: string | null;
  montant: number;
}

export interface DonneesBordereau {
  dossier: string;
  banque: string;
  type: string;
  numero: number;
  /** AAAA-MM-JJ */
  date: string;
  nature: NatureRemise;
  lignes: LigneBordereau[];
  total: number;
  modele: string | null;
}

const fr = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const montantTexte = (m: number) => fr.format(m).replace(/ | /g, ' ');
const dateTexte = (iso: string) => iso.split('-').reverse().join('/');

export const MODELE_BORDEREAU_PAR_DEFAUT =
  '{dossier}\nBORDEREAU DE REMISE N° {numero} · {nature}\nBanque de remise · {banque} · {type}\nDate · {date}\n\n{lignes}\n\n{nombre} valeur(s) · total {total}';

/**
 * LE BORDEREAU IMPRIMÉ · le modèle du type, sinon la présentation par
 * défaut ; le détail des valeurs est écrit par le serveur, jamais par le
 * modèle (il ne porte qu'un jeton).
 */
export function documentBordereau(d: DonneesBordereau): string {
  const lignes = d.lignes
    .map((l) => [l.reference, l.titulaire ?? '', l.banqueTiree ?? '', montantTexte(l.montant)].join(' · '))
    .join('\n');
  const modele = d.modele ?? MODELE_BORDEREAU_PAR_DEFAUT;
  return modele
    .replace(/\{dossier\}/g, d.dossier)
    .replace(/\{banque\}/g, d.banque)
    .replace(/\{type\}/g, d.type)
    .replace(/\{numero\}/g, String(d.numero))
    .replace(/\{date\}/g, dateTexte(d.date))
    .replace(/\{nature\}/g, LIBELLES_NATURE[d.nature])
    .replace(/\{nombre\}/g, String(d.lignes.length))
    .replace(/\{total\}/g, montantTexte(d.total))
    .replace(/\{lignes\}/g, lignes);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ValeurProposee {
  montant?: unknown;
  reference?: unknown;
  date?: unknown;
  banqueTiree?: unknown;
  titulaire?: unknown;
}

/** Une valeur reçue se juge entière avant toute pièce · montant au centime, référence, jour. */
export function motifRefusValeur(v: ValeurProposee): string | null {
  if (typeof v.montant !== 'number' || !Number.isFinite(v.montant) || v.montant <= 0) return 'Le montant de la valeur est un nombre positif.';
  if (Math.round(v.montant * 100) !== v.montant * 100 && Math.abs(Math.round(v.montant * 100) - v.montant * 100) > 1e-6) {
    return 'Le montant de la valeur se saisit au centime près.';
  }
  if (typeof v.reference !== 'string' || v.reference.trim().length === 0 || v.reference.trim().length > 60) {
    return 'La référence de la valeur (numéro du chèque, référence de la transaction) est de un à soixante caractères.';
  }
  if (typeof v.date !== 'string' || !estUnJour(v.date)) return 'La date de réception est un jour (AAAA-MM-JJ).';
  for (const [champ, nom] of [
    [v.banqueTiree, 'La banque tirée'],
    [v.titulaire, 'Le titulaire'],
  ] as const) {
    if (champ !== undefined && champ !== null && (typeof champ !== 'string' || champ.length > 120)) return `${nom} est un texte de cent vingt caractères au plus.`;
  }
  return null;
}

export interface LigneProposee {
  compteId: string;
  libelle: string;
  debit: number;
  credit: number;
}

/** (1) La réception · D 513 ou 515 / C tiers (fiche du compte 51, « par le crédit des comptes de tiers concernés »). */
export function lignesReception(e: { compteReceptionId: string; compteTiersId: string; montant: number; libelle: string }): LigneProposee[] {
  const m = round2(e.montant);
  return [
    { compteId: e.compteReceptionId, libelle: e.libelle, debit: m, credit: 0 },
    { compteId: e.compteTiersId, libelle: e.libelle, debit: 0, credit: m },
  ];
}

/** (2) Le bordereau des chèques · D 514 / C 513, une ligne au 513 par chèque (le lettrage du 513 reste possible), le 514 pour le total. */
export function lignesRemise(e: { compteTransitId: string; compteReceptionId: string; valeurs: Array<{ montant: number; libelle: string }>; libelle: string }): LigneProposee[] {
  const total = round2(e.valeurs.reduce((s, v) => s + round2(v.montant), 0));
  return [
    { compteId: e.compteTransitId, libelle: e.libelle, debit: total, credit: 0 },
    ...e.valeurs.map((v) => ({ compteId: e.compteReceptionId, libelle: v.libelle, debit: 0, credit: round2(v.montant) })),
  ];
}

/**
 * (3) L'avis de crédit · D 52 du net, D 6315 de la commission, C 514 (chèques)
 * ou 515 (cartes) du total « pour solde ». Une commission sans compte de
 * commission sur le type est refusée en amont (`motifRefusAvisCredit`).
 */
export function lignesAvisCredit(e: {
  compteBanqueId: string;
  compteCommissionId: string | null;
  compteSoldeId: string;
  total: number;
  commission: number;
  libelle: string;
}): LigneProposee[] {
  const total = round2(e.total);
  const commission = round2(e.commission);
  const lignes: LigneProposee[] = [{ compteId: e.compteBanqueId, libelle: e.libelle, debit: round2(total - commission), credit: 0 }];
  if (commission > 0 && e.compteCommissionId) lignes.push({ compteId: e.compteCommissionId, libelle: `${e.libelle} · commission`, debit: commission, credit: 0 });
  lignes.push({ compteId: e.compteSoldeId, libelle: e.libelle, debit: 0, credit: total });
  return lignes;
}

/** (4) L'impayé · D 413x / C 514, 515 ou 52 selon que la valeur attendait son crédit ou l'avait reçu. */
export function lignesImpaye(e: { compteImpayeId: string; compteCrediteId: string; montant: number; libelle: string }): LigneProposee[] {
  const m = round2(e.montant);
  return [
    { compteId: e.compteImpayeId, libelle: e.libelle, debit: m, credit: 0 },
    { compteId: e.compteCrediteId, libelle: e.libelle, debit: 0, credit: m },
  ];
}

export function motifRefusAvisCredit(e: {
  statut: StatutRemiseEnBanque;
  dateRemise: string;
  total: number;
  date: unknown;
  commission: unknown;
  referenceAvis: unknown;
  compteCommissionId: string | null;
}): string | null {
  if (e.statut === StatutRemiseEnBanque.CREDITEE) return 'Cette remise est déjà créditée.';
  if (e.statut === StatutRemiseEnBanque.ANNULEE) return 'Cette remise est annulée · rien ne se crédite.';
  if (typeof e.date !== 'string' || !estUnJour(e.date)) return "La date de l'avis de crédit est un jour (AAAA-MM-JJ).";
  if (e.date < e.dateRemise) return `L'avis de crédit (${dateTexte(e.date)}) ne précède pas la remise (${dateTexte(e.dateRemise)}).`;
  if (typeof e.referenceAvis !== 'string' || e.referenceAvis.trim().length === 0 || e.referenceAvis.trim().length > 100) {
    return "La référence de l'avis de crédit (relevé, avis) est de un à cent caractères · c'est la pièce qui justifie l'écriture (AUDCIF art. 17).";
  }
  const commission = e.commission === undefined || e.commission === null ? 0 : e.commission;
  if (typeof commission !== 'number' || !Number.isFinite(commission) || commission < 0) return 'La commission est un montant positif ou nul.';
  if (Math.abs(Math.round(commission * 100) - commission * 100) > 1e-6) return 'La commission se saisit au centime près.';
  if (commission >= e.total && commission > 0) return `La commission (${montantTexte(commission)}) ne peut pas atteindre le total remis (${montantTexte(e.total)}).`;
  if (commission > 0 && !e.compteCommissionId) {
    return 'Ce type de remise n’a pas de compte de commission · ajoutez-le au type (631, « services bancaires », fiche du compte 51) ou passez un avis sans commission.';
  }
  return null;
}

export function motifRefusImpaye(e: { statut: StatutValeurRecue; dateValeur: string; date: unknown; numeroImpaye: string | null; racine: string }): string | null {
  if (e.statut === StatutValeurRecue.RECUE) return "Une valeur non encore remise ne revient pas impayée · retirez-la plutôt (annulation de la réception).";
  if (e.statut === StatutValeurRecue.IMPAYEE) return 'Cette valeur est déjà revenue impayée.';
  if (e.statut === StatutValeurRecue.ANNULEE) return 'Cette valeur est annulée.';
  if (typeof e.date !== 'string' || !estUnJour(e.date)) return "La date de l'impayé est un jour (AAAA-MM-JJ).";
  if (e.date < e.dateValeur) return `L'impayé (${dateTexte(e.date)}) ne précède pas la réception (${dateTexte(e.dateValeur)}).`;
  if (!e.numeroImpaye) return `Le compte d'impayé est introuvable dans ce dossier · il se choisit sous le ${e.racine} (fiche du compte 41).`;
  if (!e.numeroImpaye.startsWith(e.racine)) {
    return `Le compte d'impayé (${e.numeroImpaye}) n'est pas sous le ${e.racine} que la fiche du compte 41 prescrit pour cette valeur et ce tiers.`;
  }
  return null;
}
