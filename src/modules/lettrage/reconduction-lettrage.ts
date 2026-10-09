import { ConflictException } from '@nestjs/common';
import { ModeReportANouveau, OrigineLettrage, Prisma, StatutExercice, StatutLettrage } from '@prisma/client';
import { LOT_LECTURE, lireParLots, pageApres } from '../../common/lecture-par-lots';
import { imputerPaiements, type DetteImputable, type PaiementImputable } from '../tva/imputation-paiements';
import { EcritureDuPremierJour, filtreOuverturePasseeAuPremierJour, lignesDeContrePassationDeclaree } from '../exercice/ouverture-passee';
import { ordreDeReglement } from '../reglements/ecart-change-realise';

/**
 * UN LETTRAGE PARTIEL TRAVERSE LA CLÔTURE (ligne lettrage-cloture, constat
 * MOYEN de la simulation du 2026-10-08, rejoué sur vraie base).
 *
 * Le report Détail reprend chaque mouvement OUVERT de N un à un
 * (`exercice/report-a-nouveau.ts`), et un groupe PARTIEL n'a pas de lettre ·
 * la facture de 34 800 000 et l'acompte de 20 000 000 qui la réglait en partie
 * arrivaient en N+1 SÉPARÉS et libres. Le Règlement des tiers lisait la ligne
 * d'à-nouveau de la facture due en ENTIER · 34 800 000 réglés pour
 * 14 800 000 dus, le compte du client créditeur de 20 000 000 sans qu'un mot
 * le dise. En devise, la borne protectrice du règlement (A6 bis, M6) ne
 * retranchait que des règlements reportés HORS lettrage.
 *
 * LA LOI · le bilan d'ouverture correspond au bilan de clôture (AUDCIF
 * art. 34, premier tiret ; SYCEBNL art. 16, 4), l'art. 34 de l'AUDCIF étant
 * exclu par l'art. 3 du SYCEBNL), et le compte du client est « crédité des
 * avances et acomptes ainsi que des règlements reçus des clients », celui du
 * fournisseur « débité des avances et acomptes versés aux fournisseurs ainsi
 * que des règlements effectués sur factures » (Titre VII, fiches des comptes
 * 41 et 40, aux deux plans). Ce que le client doit à l'ouverture de N+1 est
 * donc le RESTE de la facture, pas la facture · le report Détail le dit en
 * deux lignes, et c'est le lettrage qui les réunit. Une créance en devise
 * reste au coût historique (art. 54), réglée en partie dans sa devise (A6,
 * art. 55), et son reste se lit dans sa devise.
 *
 * DÉCISION (par la loi, AUDCIF art. 34 et fiches 40 et 41) · LA CLÔTURE
 * RECONDUIT LE GROUPE. Un groupe PARTIEL dont toutes les lignes sont dans N,
 * sur un compte reporté au Détail, est reposé en N+1 sur les lignes
 * d'à-nouveau qui reportent ses lignes · même composition, même reste en
 * francs et en devise, origine `CLOTURE`, lié au groupe de N
 * (`lettrageReconduitId`). Jamais sur l'à-nouveau PROVISOIRE, qui ne se lettre
 * par aucun chemin (AU1) · la clôture le remplace d'abord par le définitif.
 * Rien n'est inventé · une ligne que le report n'a pas reprise telle quelle
 * (ouverture importée concordante sans équivalent sûr, ligne déjà lettrée par
 * le report d'un lettrage du provisoire) laisse le groupe NON reconduit, et
 * c'est DIT, jamais un groupe amputé. Un groupe À CHEVAL de deux exercices
 * n'est pas reconduit · la règle (1) de `lettrages-a-cheval.ts` et la paire
 * (`paires-a-cheval.ts`) le lisent déjà.
 *
 * UN DOSSIER CLÔTURÉ AVANT LA RÈGLE n'est jamais retouché d'office · le
 * pré-lettrage PROPOSE la reconduction, que le comptable confirme, et ce qui
 * reste à relettrer est NOMMÉ (`groupesNonReconduits`), au contrôle et au
 * pré-lettrage du compte.
 */

/** Une ligne d'un groupe partiel, ou de sa reconduction. */
export interface LigneDeGroupe {
  id: string;
  debit: number;
  credit: number;
  deviseId: string | null;
  montantDevise: number | null;
  /**
   * La date de la pièce d'ORIGINE · pour une ligne d'à-nouveau d'un groupe
   * reconduit, celle de la ligne de N qu'elle reporte (`originesDesLignes`),
   * jamais le premier jour de N+1.
   */
  date: Date;
  /**
   * L'identifiant de la ligne d'ORIGINE (le sien pour une ligne de
   * l'exercice) · départage deux pièces du même jour comme le règlement les
   * a départagées en les inscrivant (`ordreDeReglement`, A6 bis, M4) · un
   * identifiant d'à-nouveau est tiré au hasard à chaque clôture.
   */
  cle?: string;
  /** L'échéance · « pareillement échues » de l'art. 154 (avertissement seul). */
  dateEcheance?: Date | null;
}

/** Le sens d'une facture · un client doit au débit, on doit au fournisseur au crédit. */
export type SensDesFactures = 'DEBIT' | 'CREDIT';

/** Ce qu'une facture d'un groupe partiel doit encore. */
export interface ResteDeFacture {
  /** Reste en francs, au centime · ce que le compte du tiers porte pour elle. */
  francs: number;
  /** Reste dans sa devise · `null` pour une ligne sans devise. */
  devise: number | null;
  /** Ce que les autres lignes du groupe en ont déjà réglé, en francs. */
  regle: number;
  /**
   * Une ligne de sens contraire SANS montant dans la devise de la facture
   * (acompte passé en francs seuls, avoir en francs, règlement dans une autre
   * devise, règlement dont la devise s'est annulée) en a réglé une part · ce
   * qu'elle en règle DANS SA DEVISE ne se déduit pas (A6, « jamais deviné » ;
   * AUDCIF art. 54 et 55) · le reste en devise est inconnu, et son règlement
   * en devise est refusé, issues nommées.
   */
  deviseIndeterminee: boolean;
}

const centimes = (x: number) => Math.round(x * 100);
const unites = (x: number) => x / 100;

/** Une somme de sens contraire, en centimes, signe compris · sa devise si elle en porte une. */
interface Paye {
  id: string;
  /** Clé d'ordre · l'identifiant de la ligne d'origine. */
  cle: string;
  date: Date;
  francs: number;
  deviseId: string | null;
  devise: number | null;
  /**
   * Une somme EN DEVISE dont la devise s'est entièrement annulée par une
   * inscription en négatif, et dont des francs restent · elle se lit en
   * francs, et ce qu'elle règle d'une facture en devise rend son reste en
   * devise inconnu (relecture TypeScript du second tour, mineur).
   */
  deviseAnnulee?: boolean;
}

/**
 * UNE LIGNE INSCRITE EN NÉGATIF (art. 20, al. 2) RETIRE CE QU'ELLE ANNULE ·
 * dans sa monnaie, sur les sommes les plus récentes d'abord. Lue comme une
 * facture (relecture « échecs silencieux », mineur 11), le règlement annulé
 * devenait une dette nouvelle. Une somme en devise dont la devise tombe à
 * zéro et dont des francs restent garde ses francs, lus sans devise
 * (`deviseAnnulee`) · ils divisaient par zéro et se perdaient sans un mot.
 */
function netterLesNegatifs(payes: Paye[]): Paye[] {
  const parMonnaie = new Map<string, Paye[]>();
  for (const x of payes) parMonnaie.set(x.deviseId ?? '', [...(parMonnaie.get(x.deviseId ?? '') ?? []), x]);
  const nets: Paye[] = [];
  for (const lot of parMonnaie.values()) {
    const positifs = lot.filter((x) => x.francs > 0).map((x) => ({ ...x })).sort(ordreDeReglementDesSommes);
    let francs = lot.filter((x) => x.francs < 0).reduce((t, x) => t - x.francs, 0);
    let devise = lot.filter((x) => x.francs < 0).reduce((t, x) => t + (x.devise ?? 0), 0);
    for (let i = positifs.length - 1; i >= 0 && (francs > 0 || devise > 0); i--) {
      const pf = Math.min(positifs[i].francs, francs);
      positifs[i].francs -= pf;
      francs -= pf;
      if (positifs[i].devise !== null) {
        const pd = Math.min(positifs[i].devise!, devise);
        positifs[i].devise = positifs[i].devise! - pd;
        devise -= pd;
      }
    }
    for (const x of positifs) {
      if (x.devise !== null && x.devise <= 0 && x.francs > 0) nets.push({ ...x, deviseId: null, devise: null, deviseAnnulee: true });
      else if (x.francs > 0 || (x.devise ?? 0) > 0) nets.push(x);
    }
  }
  return nets;
}

/** Les sommes dans l'ordre où elles ont été inscrites · leur date, puis leur ligne d'origine. */
function ordreDeReglementDesSommes(a: Paye, b: Paye): number {
  return ordreDeReglement({ id: a.cle, date: a.date }, { id: b.cle, date: b.date });
}

/** Les factures et les sommes d'un groupe, lues dans le sens du règlement. */
function lireLeGroupe(lignes: LigneDeGroupe[], sens: SensDesFactures) {
  const colonneFacture = (l: LigneDeGroupe) => centimes(sens === 'DEBIT' ? l.debit : l.credit);
  const colonneReglement = (l: LigneDeGroupe) => centimes(sens === 'DEBIT' ? l.credit : l.debit);
  const deviseDe = (l: LigneDeGroupe) => (l.deviseId !== null && l.montantDevise !== null && l.montantDevise !== 0 ? centimes(Math.abs(l.montantDevise)) : null);
  const cle = (l: LigneDeGroupe) => ({ id: l.cle ?? l.id, date: l.date });
  const factures = lignes.filter((l) => colonneFacture(l) > 0).sort((a, b) => ordreDeReglement(cle(a), cle(b)));
  // Ce que chaque autre ligne paie · la colonne du règlement, et une facture
  // inscrite en négatif ; un montant en devise stocké sans signe suit celui
  // des francs (`lignesEnNegatif`).
  const payes = netterLesNegatifs(
    lignes.flatMap((l): Paye[] => {
      const francs = colonneReglement(l) + Math.max(0, -colonneFacture(l));
      if (francs === 0) return [];
      const d = deviseDe(l);
      return [{ id: l.id, cle: l.cle ?? l.id, date: l.date, francs, deviseId: d === null ? null : l.deviseId, devise: d }];
    }),
  ).sort(ordreDeReglementDesSommes);
  return { factures, payes, colonneFacture, deviseDe };
}

/**
 * LE RESTE DE CHAQUE FACTURE D'UN GROUPE PARTIEL · CE QUE LE COMPTE DU TIERS
 * PORTE RÉELLEMENT POUR ELLE (relecture TypeScript du second tour, majeur).
 *
 * UNE RÈGLE, CELLE DE L'INSCRIPTION · le Règlement des tiers inscrit chaque
 * règlement en devise au coût historique des factures qu'il éteint, les plus
 * anciennes d'abord (`ordreDeReglement` · date de la pièce, puis sa ligne ;
 * `coutHistoriqueRegle`, A6) · le reste se relit dans CE même ordre, somme
 * par somme dans l'ordre de leurs dates, et chaque somme rend au compte les
 * francs qu'elle y a RÉELLEMENT inscrits · chaque facture qu'elle épuise
 * reprend ses francs restants, la dernière qu'elle atteint reçoit le reste de
 * la somme. Le total des restes est ainsi le solde du groupe au centime, et
 * chaque facture porte ce que l'inscription lui a donné · lu par l'art. 154,
 * une facture plus ancienne non échue passait après une plus récente échue,
 * et le règlement du solde de 1 500 USD était refusé pour 150 000 francs
 * qu'aucun compte ne portait (cas (c) de la relecture). Un ancien règlement
 * inscrit au payé (D4 d'A6) laisse sur la facture qu'il épuise un reste en
 * francs sans devise · c'est le réalisé jamais passé, que l'écart proposé au
 * groupe soldé dans sa devise reprend (`propositionEcartChange`).
 *
 * L'ART. 154 NE DATE QUE LA TVA · la déclaration impute les sommes par la loi
 * (Code civil, Livre III, art. 151 à 154), et le règlement DIT, avant la
 * pièce, quand cette imputation s'écarte de la facture choisie
 * (`restesParLImputationLegale`, `avertissementImputationDuGroupe`).
 *
 * UNE FACTURE EN DEVISE S'ÉTEINT DANS SA DEVISE · seules les sommes qui
 * portent un montant dans CETTE devise la règlent dans sa devise (AUDCIF
 * art. 54 et 55) ; des USD ne règlent jamais une facture en EUR. Ce qu'une
 * somme ne règle pas dans sa devise (surplus) et les sommes en FRANCS SEULS
 * s'imputent ensuite EN FRANCS, dans le même ordre · une facture en devise qui
 * en reçoit une part voit son reste en devise INDÉTERMINÉ, jamais déduit
 * (relecture « échecs silencieux », bloquant 1).
 */
export function restesDesFactures(lignes: LigneDeGroupe[], sens: SensDesFactures): Map<string, ResteDeFacture> {
  const { factures, payes, colonneFacture, deviseDe } = lireLeGroupe(lignes, sens);
  const etat = new Map(
    factures.map((f) => [f.id, { entier: colonneFacture(f), francs: colonneFacture(f), deviseId: deviseDe(f) === null ? null : f.deviseId, devise: deviseDe(f), indeterminee: false }]),
  );
  const ordre = factures.map((f) => etat.get(f.id)!);

  // 1. LES SOMMES EN DEVISE · chacune épuise les factures de sa devise dans
  // l'ordre d'inscription, et y laisse les francs qu'elle porte.
  const enFrancs: Paye[] = [];
  for (const x of payes) {
    if (x.deviseId === null || x.devise === null || x.devise <= 0) continue;
    let resteDevise = x.devise;
    const portions: Array<{ e: (typeof ordre)[number]; devise: number }> = [];
    for (const e of ordre) {
      if (resteDevise <= 0) break;
      if (e.deviseId !== x.deviseId || e.devise === null || e.devise <= 0) continue;
      const pris = Math.min(resteDevise, e.devise);
      portions.push({ e, devise: pris });
      resteDevise -= pris;
    }
    // Le surplus dans sa devise passe en francs, au prorata des francs de la
    // somme · jamais le réalisé de ce qu'elle a réglé.
    const francsAuxFactures = resteDevise > 0 ? Math.round((x.francs * (x.devise - resteDevise)) / x.devise) : x.francs;
    if (x.francs - francsAuxFactures > 0) enFrancs.push({ ...x, francs: x.francs - francsAuxFactures, deviseId: null, devise: null });
    let aRepartir = francsAuxFactures;
    portions.forEach(({ e, devise }, i) => {
      // Avant la dernière, chaque facture est épuisée dans sa devise (l'ordre
      // le veut) · elle reprend ses francs restants.
      const part = i < portions.length - 1 ? e.francs : aRepartir;
      e.francs -= part;
      aRepartir -= part;
      e.devise = e.devise! - devise;
    });
  }
  // 2. EN FRANCS · les sommes sans devise et le surplus des autres, sur ce
  // qui reste dû en francs, dans le même ordre d'inscription.
  for (const x of payes) if (x.deviseId === null) enFrancs.push(x);
  for (const x of enFrancs.sort(ordreDeReglementDesSommes)) {
    let reste = x.francs;
    for (const e of ordre) {
      if (reste <= 0) break;
      if (e.francs <= 0) continue;
      const pris = Math.min(reste, e.francs);
      e.francs -= pris;
      reste -= pris;
      if (e.deviseId !== null) e.indeterminee = true;
    }
  }
  const restes = new Map<string, ResteDeFacture>();
  for (const f of factures) {
    const e = etat.get(f.id)!;
    restes.set(f.id, {
      francs: unites(e.francs),
      devise: e.devise === null ? null : unites(e.devise),
      regle: unites(e.entier - e.francs),
      deviseIndeterminee: e.indeterminee,
    });
  }
  return restes;
}

/** Ce que l'imputation légale (art. 154) laisse dû à chaque facture · en francs, et dans sa devise. */
export interface ResteSelonLaLoi {
  francs: number;
  devise: number | null;
}

/**
 * L'IMPUTATION LÉGALE DES SOMMES D'UN GROUPE (Code civil, Livre III, art. 154
 * · les factures échues d'abord, puis la plus ancienne, au PRORATA à date
 * égale ; `imputerPaiements`, la fonction de la déclaration de TVA). Elle ne
 * fait pas le reste servi (`restesDesFactures`) · elle sert à DIRE, avant la
 * pièce, où la déclaration de TVA imputera le règlement quand ce n'est pas
 * sur la facture choisie (`avertissementImputationDuGroupe`). Les sommes en
 * devise s'imputent dans leur devise sur les factures de cette devise, le
 * reste en francs, comme au reste servi.
 */
export function restesParLImputationLegale(lignes: LigneDeGroupe[], sens: SensDesFactures): Map<string, ResteSelonLaLoi> {
  const { factures, payes, colonneFacture, deviseDe } = lireLeGroupe(lignes, sens);
  const etat = new Map(factures.map((f) => [f.id, { francs: colonneFacture(f), deviseId: deviseDe(f) === null ? null : f.deviseId, devise: deviseDe(f) }]));
  const dette = (f: LigneDeGroupe, montant: number): DetteImputable => ({ id: f.id, dateFacture: f.date, dateEcheance: f.dateEcheance ?? null, montant: unites(montant) });
  const enFrancs: PaiementImputable[] = [];
  for (const deviseId of new Set(payes.flatMap((x) => (x.deviseId === null ? [] : [x.deviseId])))) {
    const sommes = payes.filter((x) => x.deviseId === deviseId && (x.devise ?? 0) > 0);
    const siennes = factures.filter((f) => etat.get(f.id)!.deviseId === deviseId);
    const r = imputerPaiements(
      siennes.map((f) => dette(f, etat.get(f.id)!.devise!)),
      sommes.map((x) => ({ id: x.id, date: x.date, montant: unites(x.devise!) })),
    );
    for (const f of siennes) {
      const e = etat.get(f.id)!;
      const pris = centimes((r.parDette.get(f.id) ?? []).reduce((t, x) => t + x.montant, 0));
      if (pris <= 0) continue;
      e.francs = Math.max(0, e.francs - Math.round((colonneFacture(f) * pris) / deviseDe(f)!));
      e.devise = Math.max(0, e.devise! - pris);
    }
    for (const n of r.nonImpute) {
      const x = sommes.find((s) => s.id === n.paiementId)!;
      const francs = Math.round((x.francs * centimes(n.montant)) / x.devise!);
      if (francs > 0) enFrancs.push({ id: x.id, date: x.date, montant: unites(francs) });
    }
  }
  for (const x of payes) if (x.deviseId === null) enFrancs.push({ id: x.id, date: x.date, montant: unites(x.francs) });
  if (enFrancs.length > 0) {
    const ouvertes = factures.filter((f) => etat.get(f.id)!.francs > 0);
    const r = imputerPaiements(
      ouvertes.map((f) => dette(f, etat.get(f.id)!.francs)),
      enFrancs,
    );
    for (const f of ouvertes) {
      const e = etat.get(f.id)!;
      e.francs = Math.max(0, e.francs - centimes((r.parDette.get(f.id) ?? []).reduce((t, x) => t + x.montant, 0)));
    }
  }
  return new Map(factures.map((f) => [f.id, { francs: unites(etat.get(f.id)!.francs), devise: etat.get(f.id)!.devise === null ? null : unites(etat.get(f.id)!.devise!) }]));
}

/** Une ligne lue d'un groupe partiel, avec ce qu'il faut pour la retrouver au report. */
export interface LigneLueDuGroupe {
  id: string;
  compteId: string;
  debit: Prisma.Decimal | number;
  credit: Prisma.Decimal | number;
  dateEcheance: Date | null;
  deviseId: string | null;
  montantDevise: Prisma.Decimal | number | null;
  libelle: string | null;
  ecriture: { exerciceId: string; date: Date; libelle: string };
}

/** Un groupe partiel d'un exercice, lu avec toutes ses lignes. */
export interface GroupePartielLu {
  id: string;
  code: string;
  compteId: string;
  ecartChange: Prisma.Decimal | number | null;
  compte: { numero: string; intitule: string };
  lignes: LigneLueDuGroupe[];
}

const SELECT_GROUPE = {
  id: true,
  code: true,
  compteId: true,
  ecartChange: true,
  compte: { select: { numero: true, intitule: true } },
  lignes: {
    select: {
      id: true,
      compteId: true,
      debit: true,
      credit: true,
      dateEcheance: true,
      deviseId: true,
      montantDevise: true,
      libelle: true,
      ecriture: { select: { exerciceId: true, date: true, libelle: true } },
    },
  },
} satisfies Prisma.LettrageSelect;

/** Tranche de groupes lus à la fois · un groupe porte quelques lignes. */
export const LOT_GROUPES = 500;

/**
 * Allers-retours d'une reconduction · lecture des lignes d'accueil, code,
 * création, pose, plus la part des lectures par tranches (relecture
 * TypeScript, M2) · convention d'OmegaX, comptée large.
 */
export const OPERATIONS_PAR_GROUPE_RECONDUIT = 8;
/** La part fixe de la clôture elle-même (report, solde, tenues, AU2). */
export const OPERATIONS_DE_BASE_CLOTURE = 40;

/** Les opérations annoncées au délai de la transaction de clôture (`delaiSelonVolume`). */
export function operationsDeLaCloture(groupesPartiels: number): number {
  return OPERATIONS_DE_BASE_CLOTURE + Math.max(0, groupesPartiels) * OPERATIONS_PAR_GROUPE_RECONDUIT;
}

type LecteurDeGroupes = { lettrage: { findMany: (args: Prisma.LettrageFindManyArgs) => Promise<unknown[]> } };

/**
 * LES GROUPES PARTIELS QUI SE RECONDUISENT · statut PARTIEL, compte reporté
 * au Détail, une ligne au moins dans l'exercice, et AUCUNE ailleurs (un groupe
 * à cheval relève de la paire). Lus par tranches, chacune traitée avant la
 * suivante · la clôture écrit entre deux.
 */
export async function parcourirGroupesPartiels(
  db: unknown,
  p: { tenantId: string; exerciceId: string; compteId?: string },
  traiter: (groupes: GroupePartielLu[]) => Promise<void>,
): Promise<void> {
  const lecteur = db as LecteurDeGroupes;
  let curseur: string | undefined;
  for (;;) {
    const lot = (await lecteur.lettrage.findMany({
      where: {
        tenantId: p.tenantId,
        statut: StatutLettrage.PARTIEL,
        ...(p.compteId ? { compteId: p.compteId } : {}),
        compte: { modeReportANouveau: ModeReportANouveau.DETAIL },
        lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: p.exerciceId } } },
        NOT: { lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: { not: p.exerciceId } } } } },
      },
      select: SELECT_GROUPE,
      ...pageApres(curseur, LOT_GROUPES),
    })) as GroupePartielLu[];
    // La doublure, comme une base qui aurait vu le groupe s'étendre entre
    // deux tranches · le filtre se rejoue sur les lignes rendues.
    const entiers = lot.filter((g) => g.lignes.length > 0 && g.lignes.every((l) => l.ecriture.exerciceId === p.exerciceId));
    if (entiers.length > 0) await traiter(entiers);
    if (lot.length < LOT_GROUPES) return;
    curseur = lot[lot.length - 1].id;
  }
}

const nombre = (x: Prisma.Decimal | number | null) => (x === null ? 0 : Number(x));
const auCentime = (x: number) => Math.round(x * 100) / 100;

/** Le reste du groupe, débit moins crédit, au centime. */
export function resteDuGroupe(g: { lignes: Array<{ debit: Prisma.Decimal | number; credit: Prisma.Decimal | number }> }): number {
  return auCentime(g.lignes.reduce((t, l) => t + nombre(l.debit) - nombre(l.credit), 0));
}

/** Une ligne qui peut recevoir une ligne du groupe · d'à-nouveau, encore libre. */
export interface LigneDAccueil {
  id: string;
  compteId: string;
  debit: number;
  credit: number;
  dateEcheance: Date | null;
  deviseId: string | null;
  montantDevise: number | null;
  libelle: string | null;
}

/** Le libellé que le report Détail donne à la ligne qu'il reprend (`lignesReportANouveau`). */
export function libelleDuReport(compteNumero: string, l: { libelle: string | null; ecriture: { libelle: string } }): string {
  return `RAN détail ${compteNumero} · ${l.libelle ?? l.ecriture.libelle}`;
}

/**
 * LA LIGNE D'À-NOUVEAU QUI REPORTE CHAQUE LIGNE DU GROUPE, quand aucun
 * identifiant ne les relie (ouverture importée concordante, dossier clôturé
 * avant la règle). Même compte, mêmes montants, même devise et même montant
 * en devise, toujours ; puis, parmi celles-là, la même échéance ET le libellé
 * du report, sinon la même échéance seule, et seulement quand UNE candidate
 * et une seule répond · jamais une devinette (deux factures de même montant à
 * des échéances différentes, la mauvaise fausserait la balance âgée et la TVA
 * de la facture, que `traduireLesReports` relie par ce libellé). Chaque
 * candidate sert une fois · `dejaPrises` porte celles que d'AUTRES groupes
 * ont déjà reçues (relecture TypeScript du second tour · deux groupes de N
 * revendiquaient la même ligne d'ouverture), et n'est jamais modifié ici.
 * Rend, pour chaque ligne, l'identifiant de sa ligne d'accueil, ou null.
 */
export function apparierAuReport(
  lignes: Array<LigneLueDuGroupe & { compteNumero: string }>,
  candidates: LigneDAccueil[],
  dejaPrises: ReadonlySet<string> = new Set(),
): (string | null)[] {
  const prises = new Set<string>(dejaPrises);
  // Les candidates indexées par compte (relecture TypeScript, m5) · chaque
  // passe ne parcourt que celles du compte de la ligne.
  const parCompte = new Map<string, LigneDAccueil[]>();
  for (const c of candidates) parCompte.set(c.compteId, [...(parCompte.get(c.compteId) ?? []), c]);
  const memesMontants = (l: (typeof lignes)[number], c: LigneDAccueil) =>
    c.compteId === l.compteId &&
    centimes(c.debit) === centimes(nombre(l.debit)) &&
    centimes(c.credit) === centimes(nombre(l.credit)) &&
    (c.deviseId ?? null) === (l.deviseId ?? null) &&
    centimes(c.montantDevise ?? 0) === centimes(nombre(l.montantDevise));
  const memeEcheance = (l: (typeof lignes)[number], c: LigneDAccueil) => (c.dateEcheance?.getTime() ?? null) === (l.dateEcheance?.getTime() ?? null);
  const resultat: (string | null)[] = lignes.map(() => null);
  const passes: Array<(l: (typeof lignes)[number], c: LigneDAccueil) => boolean> = [
    (l, c) => memesMontants(l, c) && memeEcheance(l, c) && c.libelle === libelleDuReport(l.compteNumero, l),
    (l, c) => memesMontants(l, c) && memeEcheance(l, c),
  ];
  for (const passe of passes) {
    lignes.forEach((l, i) => {
      if (resultat[i] !== null) return;
      const possibles = (parCompte.get(l.compteId) ?? []).filter((c) => !prises.has(c.id) && passe(l, c));
      // Une autre ligne encore sans accueil qui convoite la même candidate ·
      // l'appariement serait une devinette, rien n'est pris.
      const rivales = lignes.filter((u, j) => j !== i && resultat[j] === null && possibles.some((c) => passe(u, c)));
      if (possibles.length === 1 && rivales.length === 0) {
        prises.add(possibles[0].id);
        resultat[i] = possibles[0].id;
      }
    });
  }
  return resultat;
}

/** Un groupe lu pour retrouver la date d'origine de ses lignes. */
export interface GroupeAOrdonner {
  id: string;
  lettrageReconduitId?: string | null;
  compte: { numero: string };
  lignes: LigneLueDuGroupe[];
}

export const SELECT_ORIGINE = {
  id: true,
  lettrageReconduitId: true,
  compte: { select: { numero: true } },
  lignes: {
    select: {
      id: true,
      compteId: true,
      debit: true,
      credit: true,
      dateEcheance: true,
      deviseId: true,
      montantDevise: true,
      libelle: true,
      ecriture: { select: { exerciceId: true, date: true, libelle: true } },
    },
  },
} satisfies Prisma.LettrageSelect;

/** Profondeur de la chaîne des reconductions relue · un groupe ne traverse pas plus de clôtures sans être réglé. */
const PROFONDEUR_ORIGINE = 10;

/** La pièce d'origine d'une ligne · sa date et l'identifiant de sa ligne. */
export interface OrigineDeLigne {
  date: Date;
  id: string;
}

/**
 * L'ORIGINE DES LIGNES D'UN GROUPE RECONDUIT (relecture « échecs
 * silencieux », majeur 2 ; relecture TypeScript du second tour, majeur). Les
 * lignes d'à-nouveau sont toutes datées du premier jour de N+1 et leurs
 * identifiants sont tirés au hasard · l'ordre d'inscription des règlements
 * (`ordreDeReglement`) se lit sur la pièce d'ORIGINE, sa date puis sa ligne.
 * Le groupe reconduit nomme son groupe de N (`lettrageReconduitId`) · ses
 * lignes s'y apparient par `apparierAuReport` (montants, devise, échéance,
 * libellé du report, une seule candidate), de proche en proche quand le
 * groupe de N était lui-même reconduit. Une ligne non retrouvée garde sa
 * date et son identifiant. Rien n'est écrit.
 */
export async function originesDesLignes(db: unknown, tenantId: string, groupes: GroupeAOrdonner[]): Promise<Map<string, OrigineDeLigne>> {
  const lecteur = db as LecteurDeGroupes;
  const origines = new Map<string, OrigineDeLigne>();
  // Chaque niveau · un groupe, et pour chacune de ses lignes la ligne du
  // groupe de départ qu'elle représente.
  let niveau = groupes
    .filter((g) => g.lettrageReconduitId)
    .map((g) => ({ groupe: g, pour: new Map(g.lignes.map((l) => [l.id, l.id])) }));
  for (let k = 0; k < PROFONDEUR_ORIGINE && niveau.length > 0; k++) {
    const groupesN = (await lecteur.lettrage.findMany({
      where: { tenantId, id: { in: [...new Set(niveau.map((n) => n.groupe.lettrageReconduitId!))] } },
      select: SELECT_ORIGINE,
    })) as Array<GroupeAOrdonner & { lettrageReconduitId: string | null }>;
    const suivant: typeof niveau = [];
    for (const { groupe, pour } of niveau) {
      const o = groupesN.find((x) => x.id === groupe.lettrageReconduitId);
      if (!o) continue;
      const accueil = apparierAuReport(
        o.lignes.map((l) => ({ ...l, compteNumero: o.compte.numero })),
        groupe.lignes.map((l) => ({
          id: l.id,
          compteId: l.compteId,
          debit: nombre(l.debit),
          credit: nombre(l.credit),
          dateEcheance: l.dateEcheance,
          deviseId: l.deviseId,
          montantDevise: l.montantDevise === null ? null : nombre(l.montantDevise),
          libelle: l.libelle,
        })),
      );
      const pourO = new Map<string, string>();
      o.lignes.forEach((l, i) => {
        const depart = accueil[i] ? pour.get(accueil[i]!) : undefined;
        if (!depart) return;
        origines.set(depart, { date: l.ecriture.date, id: l.id });
        pourO.set(l.id, depart);
      });
      if (o.lettrageReconduitId && pourO.size > 0) suivant.push({ groupe: o, pour: pourO });
    }
    niveau = suivant;
  }
  return origines;
}

/** La date d'origine seule (`originesDesLignes`). */
export async function datesDOrigine(db: unknown, tenantId: string, groupes: GroupeAOrdonner[]): Promise<Map<string, Date>> {
  return new Map([...(await originesDesLignes(db, tenantId, groupes))].map(([id, o]) => [id, o.date]));
}

/** Ce que la reconduction a fait d'un groupe. */
export interface IssueReconduction {
  groupeN: { id: string; code: string; compte: string; reste: number };
  /** Le code du groupe posé en N+1, ou null quand le groupe n'a pas été reconduit. */
  codeReconduit: string | null;
  /** Pourquoi il ne l'a pas été. */
  motif: string | null;
}

type Ecrivain = Pick<Prisma.TransactionClient, 'lettrage' | 'ligneEcriture'>;

/**
 * POSE UN GROUPE RECONDUIT sur des lignes d'accueil vérifiées, dans la
 * transaction de l'appelant · relues LIBRES au moment d'écrire (comme
 * `creerGroupe`), sinon rien n'est posé et le motif le dit. Le réalisé de
 * change gardé par le groupe de N le suit (`ecartChange`, information
 * seulement, que rien ne passe) · soldé en N+1, il dira le réalisé TOTAL de
 * l'opération (`LettrageService.ecartCumule`).
 */
export async function poserGroupeReconduit(
  tx: Ecrivain,
  p: {
    tenantId: string;
    groupe: Pick<GroupePartielLu, 'id' | 'code' | 'compteId' | 'ecartChange'>;
    accueil: string[];
    userId: string;
    code: string;
  },
): Promise<{ code: string | null; motif: string | null }> {
  const lues = await tx.ligneEcriture.findMany({
    where: { id: { in: p.accueil }, compteId: p.groupe.compteId, lettrageId: null, ecriture: { tenantId: p.tenantId, estANouveauProvisoire: false } },
    select: { id: true, debit: true, credit: true },
    orderBy: { id: 'asc' },
  });
  if (lues.length !== new Set(p.accueil).size) {
    return { code: null, motif: "une de ses lignes d'à-nouveau est déjà lettrée, ou n'est plus une ligne d'à-nouveau définitif" };
  }
  const solde = auCentime(lues.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0));
  const groupe = await tx.lettrage.create({
    data: {
      tenantId: p.tenantId,
      compteId: p.groupe.compteId,
      code: p.code,
      statut: Math.abs(solde) < 0.005 ? StatutLettrage.SOLDE : StatutLettrage.PARTIEL,
      solde: Math.abs(solde) < 0.005 ? 0 : solde,
      origine: OrigineLettrage.CLOTURE,
      createdBy: p.userId,
      soldeAt: Math.abs(solde) < 0.005 ? new Date() : null,
      ecartChange: p.groupe.ecartChange === null ? null : Number(p.groupe.ecartChange),
      lettrageReconduitId: p.groupe.id,
    },
    select: { id: true, statut: true },
  });
  const { count } = await tx.ligneEcriture.updateMany({
    where: { id: { in: p.accueil }, lettrageId: null, ecriture: { tenantId: p.tenantId } },
    data: { lettrageId: groupe.id, lettre: groupe.statut === StatutLettrage.SOLDE ? p.code : null },
  });
  if (count !== lues.length) {
    // Prise entre la lecture et l'écriture · la transaction de l'appelant
    // échoue entière, rien n'est posé à moitié, et le refus est NOMMÉ (409,
    // relectures du 2026-10-08, mineur 10 et m2 · une `Error` nue rendait un
    // 500 sans un mot).
    throw new ConflictException(
      `Reconduction du lettrage ${p.groupe.code.toLowerCase()} · une de ses lignes d'à-nouveau a été lettrée entre la lecture et l'écriture · ` +
        'rien n’est posé. Relancez le geste.',
    );
  }
  return { code: p.code, motif: null };
}

/** Le reste d'un groupe, écrit pour le message · « débit » ou « crédit ». */
export function resteLisible(reste: number): string {
  const montant = Math.abs(reste).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ');
  return `${montant} ${reste >= 0 ? 'au débit' : 'au crédit'}`;
}

/**
 * LE MESSAGE DE LA CLÔTURE · ce qui a été reconduit (borné, le total dit) et
 * ce qui ne l'a pas été, groupe par groupe, avec l'issue.
 */
export function messagesDeReconduction(issues: IssueReconduction[], plafond = 20): string[] {
  const messages: string[] = [];
  const reconduits = issues.filter((i) => i.codeReconduit !== null);
  const nonReconduits = issues.filter((i) => i.codeReconduit === null);
  if (reconduits.length > 0) {
    messages.push(
      `${reconduits.length} lettrage(s) partiel(s) reconduit(s) sur les lignes d'à-nouveau de l'exercice suivant · le tiers y doit son reste, ` +
        "pas la facture entière (AUDCIF art. 34 ; fiches des comptes 40 et 41) · " +
        reconduits
          .slice(0, plafond)
          .map((i) => `compte ${i.groupeN.compte}, ${i.groupeN.code.toLowerCase()} → ${i.codeReconduit!.toLowerCase()} (reste ${resteLisible(i.groupeN.reste)})`)
          .join(' ; ') +
        (reconduits.length > plafond ? ` ; et ${reconduits.length - plafond} autre(s)` : '') +
        '.',
    );
  }
  for (const i of nonReconduits.slice(0, plafond)) {
    messages.push(
      `Lettrage partiel ${i.groupeN.code.toLowerCase()} du compte ${i.groupeN.compte} (reste ${resteLisible(i.groupeN.reste)}) NON reconduit · ${i.motif} · ` +
        "ses lignes sont reportées une à une. Reconduisez-le depuis le pré-lettrage du compte dans l'exercice suivant, ou lettrez-le à la main, " +
        'avant de régler la facture · sans lui, la facture se lit due en entier.',
    );
  }
  if (nonReconduits.length > plafond) {
    messages.push(`Et ${nonReconduits.length - plafond} autre(s) lettrage(s) partiel(s) non reconduit(s), nommés au pré-lettrage et aux contrôles.`);
  }
  return messages;
}

/**
 * LES GROUPES PARTIELS QUE LA CLÔTURE RECONDUIRA (report provisoire, aperçu
 * de l'ouverture suivante) · la même lecture que la clôture, comptée, une
 * tranche décrite. Dit la même chose qu'elle, sans rien écrire.
 */
export async function groupesQueLaClotureReconduira(
  db: unknown,
  p: { tenantId: string; exerciceId: string },
  plafond = 20,
): Promise<{ total: number; groupes: Array<{ code: string; compte: string; reste: number }> }> {
  const groupes: Array<{ code: string; compte: string; reste: number }> = [];
  let total = 0;
  await parcourirGroupesPartiels(db, p, async (lot) => {
    for (const g of lot) {
      total++;
      if (groupes.length < plafond) groupes.push({ code: g.code.toLowerCase(), compte: g.compte.numero, reste: resteDuGroupe(g) });
    }
  });
  return { total, groupes };
}

/** L'annonce servie par le report provisoire et l'aperçu · null quand rien ne se reconduit. */
export function annonceDeReconduction(
  r: { total: number; groupes: Array<{ code: string; compte: string; reste: number }> },
  options: { ouvertureDejaPassee?: boolean } = {},
): string | null {
  if (r.total === 0) return null;
  // Une ouverture déjà passée dans l'exercice suivant (AU2) · la clôture ne
  // reporte rien sur les comptes où elle fait foi, et ne reconduit que sur
  // ses lignes qui s'apparient sûrement · l'annonce ne promet pas plus
  // (relectures du 2026-10-08, mineurs 6 et m7).
  const comment = options.ouvertureDejaPassee
    ? "seront reconduits par la clôture sur les lignes d'à-nouveau qu'elle écrit, ou sur celles de l'ouverture déjà passée quand elles " +
      "s'apparient sûrement (mêmes montants, devise et échéance) · sinon nommés à la clôture, à relettrer"
    : "seront reconduits par la clôture sur leurs lignes d'à-nouveau définitif";
  return (
    `${r.total} lettrage(s) partiel(s) de cet exercice ${comment} · ` +
    "le report provisoire ne se lettre pas, et la clôture le remplace (AUDCIF art. 34 ; fiches des comptes 40 et 41) · " +
    r.groupes.map((g) => `compte ${g.compte}, ${g.code} (reste ${resteLisible(g.reste)})`).join(' ; ') +
    (r.total > r.groupes.length ? ` ; et ${r.total - r.groupes.length} autre(s)` : '') +
    '.'
  );
}

/** L'état d'un groupe partiel d'un exercice clôturé que rien n'a reconduit. */
export type EtatNonReconduit =
  /** Ses lignes d'à-nouveau sont toutes libres · la reconduction se propose. */
  | 'A_RECONDUIRE'
  /** Une au moins est lettrée ailleurs · à relettrer à la main, nommé. */
  | 'LETTREES_AILLEURS'
  /** Une au moins n'a pas d'équivalent sûr au report · nommé. */
  | 'INTROUVABLES';

export interface GroupeNonReconduit {
  lettrageId: string;
  code: string;
  compteId: string;
  compteNumero: string;
  reste: number;
  /** L'exercice d'où il vient et celui où il aurait dû arriver. */
  exerciceDebut: Date;
  exerciceSuivantDebut: Date;
  etat: EtatNonReconduit;
  /** Les lignes d'à-nouveau qui le reçoivent, dans l'ordre de ses lignes · complètes pour A_RECONDUIRE. */
  accueil: (string | null)[];
  /** Les groupes de N+1 qui tiennent déjà ses lignes d'à-nouveau (LETTREES_AILLEURS). */
  lettresAilleurs: string[];
  /** Le réalisé de change gardé par le groupe (A6) · il suit sa reconduction. */
  ecartChange: number | null;
}

/** Plafond des groupes non reconduits nommés · le total se dit toujours. */
export const PLAFOND_NON_RECONDUITS = 200;

type LecteurNonReconduits = {
  exercice: { findMany: (args: Prisma.ExerciceFindManyArgs) => Promise<Array<{ id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice }>> };
  lettrage: { findMany: (args: Prisma.LettrageFindManyArgs) => Promise<unknown[]> };
  ligneEcriture: { findMany: (args: Prisma.LigneEcritureFindManyArgs) => Promise<unknown[]> };
};

/**
 * CE QUI RESTE À RELETTRER · les groupes partiels d'un exercice CLÔTURÉ, tout
 * entiers dans lui, au Détail, qu'aucun groupe de l'exercice qui le suit
 * immédiatement ne reconduit (dossier clôturé avant la règle, ou reconduction
 * délettrée depuis). Pour chacun, ses lignes d'à-nouveau (`apparierAuReport`)
 * et leur état. Un groupe dont toutes les lignes d'à-nouveau sont déjà dans UN
 * même groupe de N+1 (le comptable l'a relettré à la main) est reconduit de
 * fait · il n'est pas nommé. Rien n'est écrit.
 */
export async function groupesNonReconduits(
  db: unknown,
  p: { tenantId: string; compteId?: string; exerciceSuivantId?: string; plafond?: number },
): Promise<{ groupes: GroupeNonReconduit[]; total: number; tronque: boolean }> {
  const plafond = p.plafond ?? PLAFOND_NON_RECONDUITS;
  const lecteur = db as LecteurNonReconduits;
  const exercices = (await lecteur.exercice.findMany({
    where: { tenantId: p.tenantId },
    select: { id: true, dateDebut: true, dateFin: true, statut: true },
    orderBy: { dateDebut: 'asc' },
  })) as Array<{ id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice }>;
  const resultat: GroupeNonReconduit[] = [];
  let total = 0;
  for (let i = 0; i + 1 < exercices.length; i++) {
    const n = exercices[i];
    const suivant = exercices[i + 1];
    // Seul le couple (N clôturé, N+1 OUVERT) se lit · les lignes d'à-nouveau
    // d'un N+1 clôturé ne se lettrent plus, et leur report en N+2 ne se
    // relit pas ici (relevé de la ligne, écrit dans la fiche).
    if (n.statut !== StatutExercice.CLOTURE || suivant.statut === StatutExercice.CLOTURE) continue;
    if (p.exerciceSuivantId && suivant.id !== p.exerciceSuivantId) continue;
    await parcourirGroupesPartiels(lecteur, { tenantId: p.tenantId, exerciceId: n.id, compteId: p.compteId }, async (lot) => {
      const sansReconduction = (await lecteur.lettrage.findMany({
        where: { tenantId: p.tenantId, lettrageReconduitId: { in: lot.map((g) => g.id) } },
        select: { lettrageReconduitId: true },
      })) as Array<{ lettrageReconduitId: string | null }>;
      const reconduits = new Set(sansReconduction.map((r) => r.lettrageReconduitId));
      const aExaminer = lot.filter((g) => !reconduits.has(g.id));
      if (aExaminer.length === 0) return;
      const comptes = [...new Set(aExaminer.map((g) => g.compteId))];
      // Les lignes d'à-nouveau DÉFINITIF des seuls comptes examinés, lues par
      // tranches · le report de clôture (jamais le provisoire, AU1) ET les
      // lignes de l'OUVERTURE DÉJÀ PASSÉE (bilan importé, AU2), que la
      // clôture apparie aussi (relecture TypeScript, M3) · sans elles, un
      // groupe que la clôture n'avait pu reconduire sur une ouverture
      // concordante n'était plus nommé nulle part, et la facture se servait
      // entière.
      const ouverture = filtreOuverturePasseeAuPremierJour(p.tenantId, suivant);
      type Candidate = {
        id: string;
        ecritureId: string;
        ecriture: { reevaluationContrePassationDeclaree: EcritureDuPremierJour['reevaluationContrePassationDeclaree'] } | null;
        compteId: string;
        debit: Prisma.Decimal | number;
        credit: Prisma.Decimal | number;
        dateEcheance: Date | null;
        deviseId: string | null;
        montantDevise: Prisma.Decimal | number | null;
        libelle: string | null;
        lettrageId: string | null;
        lettre: string | null;
        lettrage: { code: string; lettrageReconduitId: string | null } | null;
      };
      const candidates: Candidate[] = [];
      await lireParLots(
        (curseur) =>
          lecteur.ligneEcriture.findMany({
            where: {
              compteId: { in: comptes },
              ecriture: {
                tenantId: p.tenantId,
                exerciceId: suivant.id,
                estANouveauProvisoire: false,
                estSoldeDesComptesDeGestion: false,
                OR: [{ estGenereeParCloture: true }, { AND: ouverture.AND, lignes: ouverture.lignes }],
                // UNE LIGNE ANNULÉE N'ACCUEILLE RIEN (relecture du paquet 1,
                // B2) · une OD d'ouverture corrigée par son négatif (AUDCIF
                // art. 20, al. 2 · tout écrivain de `corrigeEcritureId`
                // l'inscrit ENTIÈRE en négatif) n'est plus une position, et
                // le négatif, qui entre dans le périmètre quelle que soit sa
                // date, n'en est pas une non plus. Candidate, l'OD annulée
                // rivalisait avec la ligne du report qui la remplace · le
                // groupe passait pour introuvable, ou se reconduisait sur une
                // ligne que son négatif annule.
                correction: { is: null },
                corrigeEcritureId: null,
              },
            },
            select: {
              id: true,
              ecritureId: true,
              // La contre-passation faite à la main et DÉCLARÉE (A5 bis) ·
              // ses lignes de l'écart ne sont pas une ouverture (ci-dessous).
              ecriture: {
                select: {
                  reevaluationContrePassationDeclaree: {
                    select: {
                      annuleeLe: true,
                      ecritureEcarts: { select: { lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } } },
                    },
                  },
                },
              },
              compteId: true,
              debit: true,
              credit: true,
              dateEcheance: true,
              deviseId: true,
              montantDevise: true,
              libelle: true,
              lettrageId: true,
              lettre: true,
              lettrage: { select: { code: true, lettrageReconduitId: true } },
            },
            ...pageApres(curseur, LOT_LECTURE),
          }) as Promise<Candidate[]>,
        (c) => candidates.push(c),
      );
      // UNE CONTRE-PASSATION DÉCLARÉE N'ACCUEILLE RIEN (relecture du paquet 1,
      // m4) · ses lignes sur les comptes de l'écart de conversion (le compte
      // du tiers compris) inversent la réévaluation de N, elles ne reportent
      // aucune pièce d'un groupe · la clôture les écarte de l'ouverture où
      // elle reconduit (`ouvertureDejaPassee`), ce qui reste à relettrer les
      // écarte de même, par la même lecture (`lignesDeContrePassationDeclaree`).
      // Candidates, elles rivalisaient avec la ligne d'une ouverture importée
      // de même montant (groupe dit introuvable), ou accueillaient seules un
      // groupe sur une ligne qui n'en reporte aucune. La contre-passation du
      // MODULE est déjà hors du périmètre (`HORS_CONTRE_PASSATION_DU_MODULE`).
      const declarees = new Map<string, EcritureDuPremierJour>();
      for (const c of candidates) {
        const d = c.ecriture?.reevaluationContrePassationDeclaree;
        if (d) declarees.set(c.ecritureId, { id: c.ecritureId, reevaluationContrePassationDeclaree: d });
      }
      const horsOuverture = lignesDeContrePassationDeclaree([...declarees.values()]);
      if (horsOuverture.size > 0) {
        const retenues = candidates.filter((c) => !horsOuverture.get(c.ecritureId)?.has(c.compteId));
        candidates.length = 0;
        candidates.push(...retenues);
      }
      const accueils: LigneDAccueil[] = candidates.map((c) => ({
        id: c.id,
        compteId: c.compteId,
        debit: nombre(c.debit),
        credit: nombre(c.credit),
        dateEcheance: c.dateEcheance,
        deviseId: c.deviseId,
        montantDevise: c.montantDevise === null ? null : nombre(c.montantDevise),
        libelle: c.libelle,
      }));
      const parId = new Map(candidates.map((c) => [c.id, c]));
      // UNE LIGNE D'À-NOUVEAU N'ACCUEILLE QU'UN GROUPE (relecture TypeScript
      // du second tour) · appariés chacun de leur côté, deux groupes de N
      // revendiquaient la même ligne d'ouverture passée en OD · tous deux « à
      // reconduire », le second passait pour relettré de fait une fois le
      // premier reconduit, ou faisait refuser la reconduction. Les lignes
      // prises sont PARTAGÉES · celles d'une reconduction posée d'abord,
      // puis celles des groupes appariés en entier, dans l'ordre de lecture ;
      // un groupe qui n'en trouve plus de libre est INTROUVABLE, nommé.
      const prises = new Set(candidates.filter((c) => c.lettrage?.lettrageReconduitId).map((c) => c.id));
      for (const g of aExaminer) {
        const accueil = apparierAuReport(
          g.lignes.map((l) => ({ ...l, compteNumero: g.compte.numero })),
          accueils,
          prises,
        );
        const tenues = accueil.map((id) => (id ? parId.get(id)! : null));
        const groupesTenant = new Set(tenues.flatMap((t) => (t?.lettrageId ? [t.lettrageId] : [])));
        if (accueil.every((id) => id !== null)) accueil.forEach((id) => prises.add(id!));
        // Relettré à la main, toutes ses lignes d'à-nouveau dans UN même
        // groupe · reconduit de fait, rien à dire.
        if (tenues.every((t) => t !== null && t.lettrageId !== null) && groupesTenant.size === 1) continue;
        const etat: EtatNonReconduit = accueil.some((id) => id === null)
          ? 'INTROUVABLES'
          : tenues.some((t) => t?.lettrageId)
            ? 'LETTREES_AILLEURS'
            : 'A_RECONDUIRE';
        total++;
        if (resultat.length >= plafond) continue;
        resultat.push({
          lettrageId: g.id,
          code: g.code.toLowerCase(),
          compteId: g.compteId,
          compteNumero: g.compte.numero,
          reste: resteDuGroupe(g),
          exerciceDebut: n.dateDebut,
          exerciceSuivantDebut: suivant.dateDebut,
          etat,
          accueil,
          lettresAilleurs: [
            ...new Set(tenues.flatMap((t) => (t?.lettrageId ? [t.lettre ?? (t.lettrage?.code ?? '').toLowerCase()] : []))),
          ],
          ecartChange: g.ecartChange === null ? null : Number(g.ecartChange),
        });
      }
    });
  }
  return { groupes: resultat, total, tronque: total > resultat.length };
}

/** Ce que le contrôle et le pré-lettrage disent d'un groupe non reconduit. */
export function detailNonReconduit(g: GroupeNonReconduit): string {
  const origine = `lettrage partiel ${g.code} de l'exercice ouvert le ${g.exerciceDebut.toISOString().slice(0, 10)}, reste ${resteLisible(g.reste)}`;
  switch (g.etat) {
    case 'A_RECONDUIRE':
      return `${origine} · ses lignes d'à-nouveau sont libres, et la facture s'y lit due en entier · reconduisez-le au pré-lettrage du compte (« Reconduire »).`;
    case 'LETTREES_AILLEURS':
      return (
        `${origine} · ses lignes d'à-nouveau sont déjà lettrées ailleurs (${g.lettresAilleurs.join(', ')}) · vérifiez que le règlement passé ne dépasse pas ` +
        'le reste dû, et lettrez-les à la main · rien n\'est délettré d\'office.'
      );
    case 'INTROUVABLES':
      return `${origine} · une de ses lignes n'a pas d'équivalent sûr au report de l'exercice suivant · lettrez-la à la main avec ce qu'elle règle.`;
  }
}
