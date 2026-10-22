/**
 * FINANCEMENTS ET PLACEMENTS DE TRÉSORERIE (ligne sage-l3, fonction 47 ·
 * Sage 100, Structure des fichiers, F_TAUXREFERENCE, F_HISTOTAUXREFERENCE,
 * F_NATFINANCEMENT, F_NATPLACEMENT, F_OPFINANCEMENT, F_OPPLACEMENT ;
 * décision D16, architecture.md). Règles pures, sans base.
 *
 * DEUX OPÉRATIONS, CHACUNE SON COMPTE, LU AUX FICHES DES DEUX PLANS.
 * FINANCEMENT · le crédit de trésorerie, « concours qu'accordent les
 * établissements de crédit sur une durée de deux ans au plus » (fiche du
 * compte 56, 561, des deux plans), crédité du montant porté au compte par le
 * débit du 52, débité de son remboursement ; ses intérêts au 6745 « intérêts
 * bancaires et sur opérations de financement » (fiche du compte 67 des deux
 * plans), JAMAIS au 631 (« commissions et courtages bancaires,
 * rémunérations de services », exclus du 67), où vont les frais ; ses
 * intérêts courus au 566 (même fiche, subdivision des deux plans).
 * ANOMALIE DU TEXTE, écrite et non comblée · le commentaire du 561 dit
 * « deux ans au plus », l'exclusion du même compte renvoie au 16 (SYSCOHADA)
 * ou au 18 (SYCEBNL) « les prêts bancaires à plus d'un an » · OmegaX admet
 * deux ans au plus et AVERTIT au-delà d'un an, sans refuser.
 * PLACEMENT · le dépôt à terme, au 525 s'il se débloque « à tout moment »,
 * au 2784 si l'entité ne peut le débloquer « sur une durée supérieure à un
 * an » (fiche du compte 52 des deux plans) ; ses intérêts au 771 ou au 774
 * (fiche du compte 77, intérêts « de prêts et créances diverses » ou
 * « revenus de placement »), choisis par la nature ; ses intérêts courus au
 * 5267 « Banques, intérêts courus, produits à recevoir » (semis des deux
 * plans · le texte de l'AUDCIF transcrit dans la compétence porte 5265
 * « en devises », ANOMALIE entre texte et plan semé, le plan semé gouverne
 * les comptes ouvrables).
 *
 * L'INTÉRÊT SE DÉCLARE, LE CALCUL N'EST QU'UNE PROPOSITION · la pièce est le
 * décompte de la banque (AUDCIF art. 17, 3° ; art. 22, 7°). OmegaX propose
 * montant × taux × jours / base et dit l'écart avec le montant déclaré, sans
 * jamais l'imposer · la banque compte en dates de valeur et arrondit à sa
 * façon.
 *
 * LA CLÔTURE RATTACHE L'INTÉRÊT À SON EXERCICE (postulat de spécialisation
 * des exercices · SYCEBNL cadre conceptuel § 3.3.1.2.3, AUDCIF Titre I) ·
 * une opération à cheval sur la clôture porte, au dernier jour, la part
 * courue de ses intérêts post-comptés (566 ou 5267) ou la part non courue de
 * ses intérêts précomptés (476 « charges constatées d'avance », 477
 * « produits constatés d'avance », fiche du compte 47), au prorata des
 * JOURS, convention d'OmegaX écrite ; contre-passée à l'ouverture suivante
 * (fiches des comptes 40 et 41, « à l'ouverture de l'exercice, ces
 * écritures sont contre-passées »).
 */

import { estAuCentime } from '../virements-fonds/virement-fonds';

export const TYPES_OPERATION = ['FINANCEMENT', 'PLACEMENT'] as const;
export type TypeOperation = (typeof TYPES_OPERATION)[number];

export const MODES_INTERETS = ['POST_COMPTES', 'PRECOMPTES'] as const;
export type ModeInterets = (typeof MODES_INTERETS)[number];

/** Le rôle d'un compte dans une opération · chacun ses racines, mêmes aux deux plans (vérifiées dans les deux semis par le spec). */
export type RoleCompte = 'PRINCIPAL' | 'INTERETS' | 'COURUS' | 'FRAIS';

export const RACINES: Record<TypeOperation, Record<RoleCompte, readonly string[]>> = {
  FINANCEMENT: { PRINCIPAL: ['561'], INTERETS: ['6745'], COURUS: ['566'], FRAIS: ['631'] },
  PLACEMENT: { PRINCIPAL: ['525', '2784'], INTERETS: ['771', '774'], COURUS: ['5267'], FRAIS: ['631'] },
};

/** Les comptes d'une avance constatée · 476 pour une charge payée d'avance, 477 pour un produit perçu d'avance (fiche du compte 47). */
export const COMPTE_CHARGE_CONSTATEE_AVANCE = '47600000';
export const COMPTE_PRODUIT_CONSTATE_AVANCE = '47700000';

export function compteAdmis(type: TypeOperation, role: RoleCompte, numero: string): boolean {
  return RACINES[type][role].some((r) => numero.startsWith(r));
}

export function motifRefusCompte(type: TypeOperation, role: RoleCompte, numero: string | null): string | null {
  if (numero === null) return null;
  if (compteAdmis(type, role, numero)) return null;
  const nom = { PRINCIPAL: 'compte de l’opération', INTERETS: 'compte des intérêts', COURUS: 'compte des intérêts courus', FRAIS: 'compte des frais' }[role];
  return `Le ${nom} d'un ${type === 'FINANCEMENT' ? 'financement' : 'placement'} est sous ${RACINES[type][role].join(' ou ')} · ${numero} ne l'est pas.`;
}

const UN_JOUR = 86_400_000;
const estUnJour = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00.000Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
};
const jour = (v: string) => new Date(`${v}T00:00:00.000Z`);
export const joursEntre = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / UN_JOUR);
const centimes = (x: number) => Math.round(x * 100);

// ---- Taux de référence ---------------------------------------------------

export function motifRefusTauxReference(t: { code: string; intitule: string }): string | null {
  if (!/^[A-Z0-9]{1,10}$/.test((t.code ?? '').trim().toUpperCase())) return 'Le code du taux de référence · lettres et chiffres, dix au plus.';
  const i = (t.intitule ?? '').trim();
  if (i.length === 0 || [...i].length > 60) return "L'intitulé du taux de référence · de un à soixante caractères.";
  return null;
}

export function motifRefusCours(c: { date: string; valeur: number; source: string }): string | null {
  if (!estUnJour(c.date)) return 'La date du cours doit être un jour (AAAA-MM-JJ).';
  if (typeof c.valeur !== 'number' || !Number.isFinite(c.valeur) || c.valeur < -100 || c.valeur > 100) return 'Le cours est un taux annuel en pour cent, de -100 à 100.';
  if (Math.round(c.valeur * 1e6) / 1e6 !== c.valeur) return 'Le cours · six décimales au plus.';
  const s = typeof c.source === 'string' ? c.source.trim() : '';
  if (s.length === 0 || [...s].length > 200) return 'La source du cours est exigée (publication de la Banque centrale, avis de la banque) · deux cents caractères au plus.';
  return null;
}

/** Le cours en vigueur à une date · le plus récent sans la dépasser, ou rien (aucun ne se présume). */
export function coursEnVigueur<T extends { date: Date }>(cours: readonly T[], date: Date): T | null {
  let retenu: T | null = null;
  for (const c of cours) if (c.date.getTime() <= date.getTime() && (retenu === null || c.date.getTime() > retenu.date.getTime())) retenu = c;
  return retenu;
}

// ---- Opérations ----------------------------------------------------------

export interface OperationSaisie {
  type: TypeOperation;
  dateMiseEnPlace: string;
  dateEcheance: string;
  montant: number;
  /** Le numéro du contrat ou du dépôt, recopié en référence des pièces. */
  reference: string;
  /** Taux fixe annuel en pour cent · ou un taux de référence plus une marge. */
  tauxFixe?: number | null;
  tauxReferenceId?: string | null;
  marge?: number | null;
  baseCalcul: number;
  modeInterets: ModeInterets;
  /** Frais et commissions au 631, sans ligne de taxe · la banque qui facture la taxe se passe à la main. */
  frais?: number | null;
  /** PLACEMENT seul · le dépôt se débloque-t-il à tout moment ? */
  deblocableAToutMoment?: boolean | null;
  referenceConvention: string;
  dateConvention: string;
}

// AU CENTIME par la règle du virement de fonds (`estAuCentime`) · comparer
// x × 100 à son arrondi refusait 75 000,01, dont le produit par cent n'est pas
// un flottant exact (vu sur vraie base, premier rejeu de la fonction 47).
const auCentime = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 1e15 && estAuCentime(x);

export function motifRefusOperation(o: OperationSaisie, comptePrincipal: string): string | null {
  if (!TYPES_OPERATION.includes(o.type)) return "Le type de l'opération · financement ou placement.";
  const reference = typeof o.reference === 'string' ? o.reference.trim() : '';
  if (reference.length === 0 || [...reference].length > 60) return "La référence de l'opération (numéro du contrat ou du dépôt) est exigée · soixante caractères au plus.";
  if (!estUnJour(o.dateMiseEnPlace)) return 'La date de mise en place doit être un jour (AAAA-MM-JJ).';
  if (!estUnJour(o.dateEcheance)) return "La date d'échéance doit être un jour (AAAA-MM-JJ).";
  if (o.dateEcheance <= o.dateMiseEnPlace) return "L'échéance suit la mise en place d'au moins un jour.";
  if (!auCentime(o.montant) || o.montant <= 0) return "Le montant de l'opération est strictement positif, au centime.";
  const fixe = o.tauxFixe !== null && o.tauxFixe !== undefined;
  const reference2 = typeof o.tauxReferenceId === 'string' && o.tauxReferenceId !== '';
  if (fixe === reference2) return "L'opération porte un taux fixe OU un taux de référence plus une marge, l'un des deux.";
  if (fixe && (typeof o.tauxFixe !== 'number' || !Number.isFinite(o.tauxFixe) || o.tauxFixe < 0 || o.tauxFixe > 100)) return 'Le taux fixe · un taux annuel en pour cent, de 0 à 100.';
  // Une marge oubliée n'est pas une marge nulle · le taux serait figé au taux de référence nu pour toute la vie de l'opération (null n'est pas zéro).
  // Six décimales au plus, comme les cours · la base arrondit en silence au-delà (DECIMAL(9,6)), et le taux
  // stocké différait de celui des intérêts proposés figés dans la même transaction.
  if (fixe && typeof o.tauxFixe === 'number' && Math.round(o.tauxFixe * 1e6) / 1e6 !== o.tauxFixe) return 'Le taux fixe · six décimales au plus.';
  if (reference2 && typeof o.marge === 'number' && Math.round(o.marge * 1e6) / 1e6 !== o.marge) return 'La marge · six décimales au plus.';
  if (reference2 && (o.marge === null || o.marge === undefined)) return "La marge est exigée avec un taux de référence · tapez 0 s'il n'y en a pas.";
  if (reference2 && o.marge != null && (typeof o.marge !== 'number' || !Number.isFinite(o.marge) || Math.abs(o.marge) > 100)) return 'La marge · en points de pour cent, de -100 à 100.';
  if (o.baseCalcul !== 360 && o.baseCalcul !== 365) return 'La base de calcul des intérêts est de 360 ou de 365 jours.';
  if (!MODES_INTERETS.includes(o.modeInterets)) return 'Les intérêts sont post-comptés ou précomptés.';
  if (o.frais != null && (!auCentime(o.frais) || o.frais < 0)) return 'Les frais · un montant positif ou nul, au centime.';
  const ref = typeof o.referenceConvention === 'string' ? o.referenceConvention.trim() : '';
  if (ref.length === 0 || [...ref].length > 100) return 'La référence de la convention (ou du contrat) avec la banque est exigée · cent caractères au plus.';
  if (!estUnJour(o.dateConvention)) return 'La date de la convention doit être un jour (AAAA-MM-JJ).';
  if (o.dateConvention > o.dateMiseEnPlace) return "La convention précède la mise en place, ou la date le même jour · une opération ne se met pas en place avant d'être convenue.";
  if (o.type === 'FINANCEMENT') {
    // Fiche du compte 56 · « deux ans au plus » ; au-delà, un emprunt (16 ou 18), hors de ce module.
    if (jour(o.dateEcheance).getTime() > deuxAnsApres(o.dateMiseEnPlace).getTime()) {
      return "Un crédit de trésorerie dure deux ans au plus (fiche du compte 56) · au-delà, c'est un emprunt (16 au SYSCOHADA, 18 au SYCEBNL), qui se passe hors de ce module.";
    }
    if (o.deblocableAToutMoment != null) return 'Le déblocage à tout moment ne se dit que d’un placement.';
  } else {
    if (typeof o.deblocableAToutMoment !== 'boolean') return 'Le placement dit si le dépôt se débloque à tout moment.';
    // Fiche du compte 52 · 525 débloquable à tout moment ; 2784 si l'entité ne peut le débloquer sur plus d'un an.
    const plusDUnAn = jour(o.dateEcheance).getTime() > unAnApres(o.dateMiseEnPlace).getTime();
    const attendu = !o.deblocableAToutMoment && plusDUnAn ? '2784' : '525';
    if (!comptePrincipal.startsWith(attendu)) {
      return attendu === '2784'
        ? "Un dépôt qui ne se débloque pas avant plus d'un an va au 2784 « Banques, dépôts à terme » (fiche du compte 52), pas au 525."
        : 'Un dépôt qui se débloque à tout moment, ou dans l’année, va au 525 « Banques, dépôt à terme » (fiche du compte 52).';
    }
  }
  return null;
}

/**
 * LES INTÉRÊTS DÉCLARÉS · le décompte de la banque fait foi (AUDCIF art. 17,
 * 3°). Précomptés, ils se déclarent à la mise en place et la banque nette du
 * financement doit rester positive (on ne reçoit pas moins que rien) ;
 * post-comptés, ils se déclarent à l'échéance. Un montant nul est admis (prêt
 * sans intérêt), jamais négatif.
 */
export function motifRefusInterets(interets: unknown, objet: string): string | null {
  if (!auCentime(interets) || interets < 0) return `Les intérêts ${objet} · un montant positif ou nul, au centime, celui du décompte de la banque.`;
  return null;
}

export function motifRefusMiseEnPlace(o: { type: TypeOperation; montant: number; modeInterets: ModeInterets; frais: number }, interetsPrecomptes: number): string | null {
  const pre = o.modeInterets === 'PRECOMPTES' ? interetsPrecomptes : 0;
  if (o.type === 'FINANCEMENT' && centimes(o.montant) - centimes(pre) - centimes(o.frais) <= 0) {
    return 'Les intérêts précomptés et les frais dépassent le crédit · la banque ne porterait rien au compte. Vérifiez le décompte.';
  }
  if (o.type === 'PLACEMENT' && centimes(pre) > centimes(o.montant)) {
    return 'Les intérêts précomptés dépassent le dépôt · vérifiez le décompte de la banque.';
  }
  return null;
}

/**
 * LA RÉGULARISATION DÉCLARÉE · le montant que le cabinet rattache à
 * l'exercice, proposé au prorata des jours (convention d'OmegaX). Précomptés,
 * il ne dépasse jamais les intérêts déjà passés à la mise en place (on ne
 * constate pas d'avance plus que ce qui a été payé ou reçu).
 */
export function motifRefusRegularisation(montant: unknown, modeInterets: ModeInterets, interetsPrecomptes: number): string | null {
  // ZÉRO EST UNE RÉPONSE · des intérêts réellement nuls se déclarent à 0 (l'acte est gardé sans pièce), sans quoi
  // l'échéance restait refusée ou la seule issue falsifiait un montant (relecture du 2026-10-22, M1).
  if (!auCentime(montant) || montant < 0) return 'La régularisation · un montant positif ou nul, au centime.';
  if (modeInterets === 'PRECOMPTES' && centimes(montant) > centimes(interetsPrecomptes)) {
    return `La part constatée d'avance ne dépasse pas les intérêts précomptés passés à la mise en place (${interetsPrecomptes.toFixed(2)}).`;
  }
  return null;
}

/** L'avertissement de l'anomalie du texte · un crédit de trésorerie de plus d'un an. */
export function avertissementOperation(o: Pick<OperationSaisie, 'type' | 'dateMiseEnPlace' | 'dateEcheance'>): string | null {
  if (o.type !== 'FINANCEMENT') return null;
  if (jour(o.dateEcheance).getTime() <= unAnApres(o.dateMiseEnPlace).getTime()) return null;
  return "Crédit de trésorerie de plus d'un an · le commentaire du compte 561 admet deux ans au plus, son exclusion renvoie au 16 (ou au 18) « les prêts bancaires à plus d'un an » · le texte se contredit, vérifiez la nature du concours.";
}

function unAnApres(v: string): Date {
  const d = jour(v);
  return new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
}
function deuxAnsApres(v: string): Date {
  const d = jour(v);
  return new Date(Date.UTC(d.getUTCFullYear() + 2, d.getUTCMonth(), d.getUTCDate()));
}

/** Les intérêts que les conditions donnent · montant × taux × jours / (base × 100), au centime. Une PROPOSITION. */
export function interetsCalcules(montant: number, tauxAnnuel: number, jours: number, base: number): number {
  return Math.round((montant * tauxAnnuel * jours) / base) / 100;
}

export interface LignePropose {
  role: RoleCompte | 'BANQUE' | 'AVANCE';
  debit: number;
  credit: number;
}

const ligne = (role: LignePropose['role'], debit: number, credit: number): LignePropose => ({ role, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100 });
const garder = (lignes: LignePropose[]) => lignes.filter((l) => centimes(l.debit) !== 0 || centimes(l.credit) !== 0);

/**
 * LA PIÈCE DE MISE EN PLACE, au journal de banque · FINANCEMENT D 52 (net) /
 * D 6745 (intérêts précomptés) / D 631 (frais) / C 561 ; PLACEMENT D 525
 * (ou 2784) / D 631 (frais) / C 52 / C 77 (intérêts précomptés).
 */
export function pieceMiseEnPlace(o: { type: TypeOperation; montant: number; modeInterets: ModeInterets; frais: number }, interets: number): LignePropose[] {
  const pre = o.modeInterets === 'PRECOMPTES' ? interets : 0;
  if (o.type === 'FINANCEMENT') {
    return garder([ligne('BANQUE', o.montant - pre - o.frais, 0), ligne('INTERETS', pre, 0), ligne('FRAIS', o.frais, 0), ligne('PRINCIPAL', 0, o.montant)]);
  }
  return garder([ligne('PRINCIPAL', o.montant, 0), ligne('FRAIS', o.frais, 0), ligne('BANQUE', 0, o.montant + o.frais - pre), ligne('INTERETS', 0, pre)]);
}

/** LA PIÈCE D'ÉCHÉANCE, au journal de banque · le principal remboursé ou rendu, avec les intérêts post-comptés. */
export function pieceEcheance(o: { type: TypeOperation; montant: number; modeInterets: ModeInterets }, interets: number): LignePropose[] {
  const post = o.modeInterets === 'POST_COMPTES' ? interets : 0;
  if (o.type === 'FINANCEMENT') return garder([ligne('PRINCIPAL', o.montant, 0), ligne('INTERETS', post, 0), ligne('BANQUE', 0, o.montant + post)]);
  return garder([ligne('BANQUE', o.montant + post, 0), ligne('PRINCIPAL', 0, o.montant), ligne('INTERETS', 0, post)]);
}

/**
 * LA RÉGULARISATION À LA CLÔTURE d'une opération à cheval · `null` si la
 * clôture n'est pas strictement entre la mise en place et l'échéance.
 * Post-comptés · la part COURUE (jours écoulés jusqu'à la clôture comprise).
 * Précomptés · la part NON COURUE (jours après la clôture), en avance.
 */
export function regularisationALaCloture(
  o: { type: TypeOperation; modeInterets: ModeInterets; dateMiseEnPlace: Date; dateEcheance: Date },
  interets: number,
  cloture: Date,
): { montant: number; lignes: LignePropose[] } | null {
  if (cloture.getTime() < o.dateMiseEnPlace.getTime()) return null;
  // UNE OPÉRATION ENCORE EN COURS PASSÉ SON TERME (remboursement réel après la date du contrat, à travers une
  // clôture) · tout l'intérêt du contrat a couru à la clôture, et rien n'est plus d'avance. Sans cette branche,
  // l'intérêt de N tombait en N+1 sans un mot (relecture du 2026-10-22, B2).
  if (cloture.getTime() >= o.dateEcheance.getTime()) {
    if (o.modeInterets !== 'POST_COMPTES') return null;
    const tout = Math.round(interets * 100) / 100;
    if (centimes(tout) === 0) return null;
    return { montant: tout, lignes: o.type === 'FINANCEMENT' ? [ligne('INTERETS', tout, 0), ligne('COURUS', 0, tout)] : [ligne('COURUS', tout, 0), ligne('INTERETS', 0, tout)] };
  }
  const total = joursEntre(o.dateMiseEnPlace, o.dateEcheance);
  // La clôture est le dernier jour couru · un dépôt du 1er au 31 décembre court 30 jours au 31 (la date de mise en place n'est pas un jour d'intérêt couru en plus).
  const ecoules = joursEntre(o.dateMiseEnPlace, cloture);
  const part = o.modeInterets === 'POST_COMPTES' ? Math.round((interets * 100 * ecoules) / total) / 100 : Math.round((interets * 100 * (total - ecoules)) / total) / 100;
  if (centimes(part) === 0) return null;
  let lignes: LignePropose[];
  if (o.type === 'FINANCEMENT') {
    lignes = o.modeInterets === 'POST_COMPTES' ? [ligne('INTERETS', part, 0), ligne('COURUS', 0, part)] : [ligne('AVANCE', part, 0), ligne('INTERETS', 0, part)];
  } else {
    lignes = o.modeInterets === 'POST_COMPTES' ? [ligne('COURUS', part, 0), ligne('INTERETS', 0, part)] : [ligne('INTERETS', part, 0), ligne('AVANCE', 0, part)];
  }
  return { montant: part, lignes };
}

/** La contre-passation à l'ouverture · l'inverse exact, ligne à ligne. */
export function contrePassation(lignes: readonly LignePropose[]): LignePropose[] {
  return lignes.map((l) => ({ role: l.role, debit: l.credit, credit: l.debit }));
}

/** Le compte d'avance d'une opération · 476 pour un financement (charge payée d'avance), 477 pour un placement (produit perçu d'avance). */
export const compteAvance = (type: TypeOperation) => (type === 'FINANCEMENT' ? COMPTE_CHARGE_CONSTATEE_AVANCE : COMPTE_PRODUIT_CONSTATE_AVANCE);
