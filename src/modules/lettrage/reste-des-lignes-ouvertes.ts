import { Logger } from '@nestjs/common';
import { Prisma, StatutEcriture } from '@prisma/client';
import { originesDesReports, type LigneReportee } from '../relances/date-origine-des-reports';
import { ECRITURE_D_A_NOUVEAU } from './paires-a-cheval';
import {
  LOT_GROUPES,
  SELECT_ORIGINE,
  originesDesLignes,
  restesParLImputationLegale,
  type GroupeAOrdonner,
  type LigneDeGroupe,
  type OrigineDeLigne,
} from './reconduction-lettrage';

/**
 * UNE LIGNE OUVERTE D'UN GROUPE DE LETTRAGE PÈSE CE QU'ELLE DOIT ENCORE
 * (simulation du logiciel complet du 2026-10-08, lot M, D2 et D3).
 *
 * Une facture de 3 480 000 réglée de 1 000 000, les deux lettrées en partiel,
 * restent ouvertes l'une et l'autre · lues ligne à ligne, la facture portait
 * 3 480 000 à son échéance et le règlement, sans échéance, − 1 000 000 hors de
 * toute colonne. La NOTE 7 rendait 9 280 000 « à un an au plus » pour un solde
 * de 8 280 000, le reste en « non ventilé » négatif, et la balance âgée rangeait
 * la facture entière dans sa tranche et le règlement en négatif dans la sienne.
 *
 * LE LETTRAGE DIT CE QUE LE RÈGLEMENT ÉTEINT · une somme lettrée avec une
 * facture la règle, et ce qui reste dû l'est sur ELLE, à son échéance. QUELLE
 * facture une somme éteint est une question d'IMPUTATION, que la loi tranche
 * (Code civil, Livre III, art. 151 à 154 ; décision par la loi du 2026-10-07,
 * point 4) · la part déclarée par le débiteur ou dite par la quittance qu'il a
 * acceptée d'abord (`imputerLesDeclarations`), puis l'ordre légal, les
 * factures échues à la date du paiement d'abord, puis la plus ancienne, au
 * prorata à date égale (`restesParLImputationLegale`, la lecture que le
 * Règlement des tiers DIT avant la pièce). L'ordre d'inscription des pièces
 * (`restesDesFactures`) rangeait au rappel une facture échue entière quand le
 * règlement avait éteint une facture plus ancienne non échue (second tour de
 * relecture, M1). Une ligne d'à-nouveau d'un groupe reconduit s'y lit à sa
 * pièce d'ORIGINE (date et ligne, `originesDesLignes`) · sans elle, deux
 * factures reportées le même premier jour s'ordonnaient par un identifiant
 * tiré au hasard (relecture TypeScript, bloquant 1). Celle d'un groupe posé à
 * la main en N+1 aussi, par la clé du report au détail (`originesDesANouveaux`,
 * paquet 1, B7) · sans elle, les deux factures s'éteignaient au prorata. Les factures sont les lignes du sens du
 * solde du groupe (débit pour une créance, crédit pour une dette) ; les autres
 * lignes du groupe ne pèsent plus rien, leur montant est dans le reste des
 * factures.
 *
 * Le groupe se lit sur les SEULES lignes reçues · l'appelant passe celles de
 * l'état (exercice, date d'arrêté), et un règlement postérieur n'y entre pas.
 * Un groupe ne se répartit que s'il est LU EN ENTIER (`poidsDesLignesLues`,
 * toutes ses lignes dans la borne de l'état) · un groupe à cheval sur
 * l'exercice précédent, dont la facture de N-1 n'est représentée que par son
 * à-nouveau hors du groupe, prenait le règlement pour la facture (relecture
 * « échecs silencieux », majeur 1) · il garde la lecture ligne à ligne,
 * comme la paire à cheval (`pairesACheval`). Une facture et son inscription
 * en négatif (même colonne, même montant, même échéance) s'annulent entre
 * elles avant toute imputation, jamais sur la plus ancienne (mineur 4). Un
 * groupe dont le reste ne se lit pas sûrement (négatif sans son origine,
 * reste négatif d'une facture en devise, restes qui ne rendent pas le solde)
 * garde la lecture ligne à ligne et il est NOMMÉ (`nonRepartis`) · son total
 * reste exact, et l'appelant le consigne. D'autres lectures du reste d'une
 * facture existent (`restesDesFactures` au Règlement des tiers, qui sert le
 * dû dans sa devise, `pairesACheval`, `resteDuALaDate`).
 */
export interface LigneOuverte {
  id: string;
  debit: Prisma.Decimal | number;
  credit: Prisma.Decimal | number;
  lettrageId: string | null;
  dateEcheance: Date | null;
  deviseId: string | null;
  montantDevise: Prisma.Decimal | number | null;
  ecriture: { date: Date };
}

export interface PoidsDesLignes {
  /**
   * Le poids des lignes d'un groupe, signé débit moins crédit, en unités ·
   * seules les lignes dont le poids n'est pas leur montant y figurent (une
   * ligne hors groupe, ou seule de son groupe parmi les lignes reçues, se lit
   * à son montant).
   */
  poids: Map<string, number>;
  /** Les groupes dont les restes ne rendent pas le solde · lus ligne à ligne. */
  nonRepartis: string[];
  /**
   * Les groupes que l'état NOMME, chacun avec son motif (paquet 1, B5 ;
   * relecture « échecs silencieux », mineur 7) · ceux de `nonRepartis`.
   */
  motifs: Map<string, MotifGroupeNomme>;
}

/**
 * POURQUOI UN GROUPE EST NOMMÉ (relecture « échecs silencieux » du paquet 1,
 * mineur 7) · l'écran disait pour tous « écart de change non passé », faux
 * pour une facture en devise réglée en PARTIE · l'écart réalisé ne se passe
 * qu'au groupe SOLDÉ (AUDCIF art. 55 ; ligne A6, « Groupe soldé en devise et
 * non en francs · écart PROPOSÉ au lettrage »). Chaque groupe porte le sien.
 *
 *  · `NEGATIF_SANS_ORIGINE` · une inscription en négatif sans sa ligne
 *    d'origine parmi les lignes lues (ou avec plusieurs) ;
 *  · `IMPUTATION_DECLAREE_NON_LUE` · une part déclarée (art. 151 et 153)
 *    au-delà de la facture, ou dans un groupe en devise ;
 *  · `DEVISE_SOLDEE_ECART_NON_PASSE` · factures soldées dans leur devise et
 *    non en francs · l'écart réalisé n'est pas passé (art. 55) ;
 *  · `DEVISE_REGLEE_EN_PARTIE` · une facture en devise réglée en partie à un
 *    autre cours · son reste au coût historique ne rend pas le solde en
 *    francs, et rien n'est encore à passer ;
 *  · `RESTE_NON_REPARTI` · des restes qui ne rendent pas le solde, sans
 *    devise.
 */
export type MotifGroupeNomme =
  | 'NEGATIF_SANS_ORIGINE'
  | 'IMPUTATION_DECLAREE_NON_LUE'
  | 'DEVISE_SOLDEE_ECART_NON_PASSE'
  | 'DEVISE_REGLEE_EN_PARTIE'
  | 'RESTE_NON_REPARTI';

const journal = new Logger('RestesDesLignesOuvertes');

const centimes = (x: Prisma.Decimal | number | null) => Math.round(Number(x ?? 0) * 100);

/** Le montant d'une ligne, ou son poids quand son groupe le fixe. */
export function poidsOuMontant(p: PoidsDesLignes, l: { id: string; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number }): number {
  return p.poids.get(l.id) ?? (centimes(l.debit) - centimes(l.credit)) / 100;
}

/** Les lignes reçues par groupe, pour les seuls groupes qui en portent au moins deux. */
function groupesAPlusieurs<T extends LigneOuverte>(lignes: readonly T[]): Map<string, T[]> {
  const groupes = new Map<string, T[]>();
  for (const l of lignes) {
    if (!l.lettrageId) continue;
    const membres = groupes.get(l.lettrageId);
    if (membres) membres.push(l);
    else groupes.set(l.lettrageId, [l]);
  }
  for (const [id, membres] of groupes) if (membres.length < 2) groupes.delete(id);
  return groupes;
}

/**
 * Les lignes qu'une inscription en négatif annule, deux à deux · `null` quand
 * un négatif n'a pas son origine parmi les lignes, ou en a plusieurs.
 */
function annulerLesNegatifs(membres: readonly LigneOuverte[]): Set<string> | null {
  const annulees = new Set<string>();
  const memeEcheance = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
  for (const n of membres) {
    for (const colonne of ['debit', 'credit'] as const) {
      const montant = centimes(n[colonne]);
      if (montant >= 0) continue;
      const candidates = membres.filter(
        (o) => !annulees.has(o.id) && o.id !== n.id && centimes(o[colonne]) === -montant && memeEcheance(o.dateEcheance, n.dateEcheance),
      );
      // Une seule origine possible, sinon rien n'est deviné (second tour, m1).
      if (candidates.length !== 1) return null;
      const origine = candidates[0];
      annulees.add(n.id);
      annulees.add(origine.id);
    }
  }
  return annulees;
}

/** Une part déclarée d'un paiement · la facture qu'il acquitte, et combien. */
export interface PartDeclaree {
  ligneFactureId: string;
  montant: number;
}

/**
 * L'IMPUTATION DÉCLARÉE PRIME (Code civil, Livre III, art. 151 et 153 ;
 * relecture sur vraie base de la simulation du 2026-10-08) · un paiement dont
 * le débiteur a déclaré, ou la quittance acceptée a dit, la facture qu'il
 * acquitte l'éteint pour la part déclarée, quel que soit l'ordre
 * d'inscription · le client C2 qui a imputé 672 800 sur sa facture du 6 mai et
 * 487 200 sur celle du 5 mai doit encore celle du 5 mai, et sa relance en
 * compte le retard. Ce qu'un paiement ne déclare pas suit la règle commune. Les
 * lignes rendues portent le reste de chaque facture et de chaque paiement ·
 * `null` quand le groupe porte une devise (la déclaration est en francs) ou
 * qu'une part dépasse ce qu'elle impute.
 */
function imputerLesDeclarations(
  lues: LigneDeGroupe[],
  sens: 'DEBIT' | 'CREDIT',
  declarations: ReadonlyMap<string, ReadonlyArray<PartDeclaree>>,
): LigneDeGroupe[] | null {
  const declares = lues.filter((l) => declarations.has(l.id));
  if (declares.length === 0) return lues;
  if (lues.some((l) => l.deviseId !== null)) return null;
  const colonneFacture = (l: LigneDeGroupe) => centimes(sens === 'DEBIT' ? l.debit : l.credit);
  const colonneReglement = (l: LigneDeGroupe) => centimes(sens === 'DEBIT' ? l.credit : l.debit);
  const restes = new Map(lues.filter((l) => colonneFacture(l) > 0).map((l) => [l.id, colonneFacture(l)]));
  const residuels = new Map<string, number>();
  for (const p of declares) {
    let impute = 0;
    for (const part of declarations.get(p.id)!) {
      const reste = restes.get(part.ligneFactureId);
      if (reste === undefined) continue;
      const pris = centimes(part.montant);
      if (pris > reste) return null;
      restes.set(part.ligneFactureId, reste - pris);
      impute += pris;
    }
    const residuel = colonneReglement(p) - impute;
    if (residuel < 0) return null;
    residuels.set(p.id, residuel);
  }
  const enUnites = (c: number) => c / 100;
  return lues.flatMap((l): LigneDeGroupe[] => {
    if (restes.has(l.id)) {
      const reste = restes.get(l.id)!;
      return reste > 0 ? [{ ...l, debit: sens === 'DEBIT' ? enUnites(reste) : 0, credit: sens === 'CREDIT' ? enUnites(reste) : 0 }] : [];
    }
    if (residuels.has(l.id)) {
      const residuel = residuels.get(l.id)!;
      return residuel > 0 ? [{ ...l, debit: sens === 'DEBIT' ? 0 : enUnites(residuel), credit: sens === 'DEBIT' ? enUnites(residuel) : 0 }] : [];
    }
    return [l];
  });
}

/**
 * Le poids des lignes, les origines des lignes d'à-nouveau données · les
 * groupes `exclus` (lus en partie) gardent la lecture ligne à ligne, et les
 * parts déclarées des paiements priment (`imputerLesDeclarations`).
 */
export function poidsDesLignesOuvertes(
  lignes: readonly LigneOuverte[],
  origines: ReadonlyMap<string, OrigineDeLigne> = new Map(),
  exclus: ReadonlySet<string> = new Set(),
  declarations: ReadonlyMap<string, ReadonlyArray<PartDeclaree>> = new Map(),
): PoidsDesLignes {
  const poids = new Map<string, number>();
  const nonRepartis: string[] = [];
  const motifs = new Map<string, MotifGroupeNomme>();
  const nommerLeGroupe = (lettrageId: string, motif: MotifGroupeNomme) => {
    nonRepartis.push(lettrageId);
    motifs.set(lettrageId, motif);
  };
  for (const [lettrageId, membres] of groupesAPlusieurs(lignes)) {
    // Lu en partie · la lecture ligne à ligne est celle de l'état, sans
    // réserve (la paire à cheval a sa propre lecture là où elle compte).
    if (exclus.has(lettrageId)) continue;
    const net = membres.reduce((t, l) => t + centimes(l.debit) - centimes(l.credit), 0);
    if (net === 0) {
      for (const l of membres) poids.set(l.id, 0);
      continue;
    }
    // UNE INSCRIPTION EN NÉGATIF ANNULE SA LIGNE D'ORIGINE (AUDCIF art. 20,
    // al. 2) · elle s'apparie à la ligne de même colonne, de montant opposé et
    // de même échéance, et les deux ne pèsent plus rien. Un négatif sans son
    // origine parmi les lignes lues ne se répartit pas.
    const annulees = annulerLesNegatifs(membres);
    if (annulees === null) {
      nommerLeGroupe(lettrageId, 'NEGATIF_SANS_ORIGINE');
      continue;
    }
    for (const id of annulees) poids.set(id, 0);
    const restantes = membres.filter((l) => !annulees.has(l.id));
    if (restantes.length < 2) {
      // Une ligne seule garde son montant · la table ne la porte pas.
      continue;
    }
    const sens = net > 0 ? 'DEBIT' : 'CREDIT';
    const lues = restantes.map(
      (l): LigneDeGroupe => ({
        id: l.id,
        cle: origines.get(l.id)?.id ?? l.id,
        debit: Number(l.debit),
        credit: Number(l.credit),
        deviseId: l.deviseId,
        montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        date: origines.get(l.id)?.date ?? l.ecriture.date,
        dateEcheance: l.dateEcheance,
      }),
    );
    const imputees = imputerLesDeclarations(lues, sens, declarations);
    if (imputees === null) {
      for (const id of annulees) poids.delete(id);
      nommerLeGroupe(lettrageId, 'IMPUTATION_DECLAREE_NON_LUE');
      continue;
    }
    const restes = restesParLImputationLegale(imputees, sens);
    const totalRestes = [...restes.values()].reduce((t, r) => t + centimes(r.francs), 0);
    // Un reste négatif · une facture en devise dont l'écart réalisé n'est pas
    // passé (le règlement la solde au-delà de ses francs) · lu ligne à ligne,
    // jamais une créance négative dans une colonne (mineur 3).
    if (totalRestes !== Math.abs(net) || [...restes.values()].some((r) => r.francs < 0)) {
      for (const id of annulees) poids.delete(id);
      nommerLeGroupe(lettrageId, motifDuReste(restes));
      continue;
    }
    const signe = sens === 'DEBIT' ? 1 : -1;
    for (const l of restantes) {
      const reste = restes.get(l.id);
      poids.set(l.id, reste ? signe * reste.francs : 0);
    }
  }
  return { poids, nonRepartis, motifs };
}

/**
 * Le motif d'un groupe dont les restes ne rendent pas le solde · une facture
 * en devise encore ouverte DANS SA DEVISE est réglée en partie ; toutes
 * soldées dans leur devise, c'est l'écart réalisé qui manque ; sans facture
 * en devise, un reste non réparti.
 */
function motifDuReste(restes: ReadonlyMap<string, { francs: number; devise: number | null }>): MotifGroupeNomme {
  // Les restes ne portent une devise que pour une FACTURE en devise.
  const enDevise = [...restes.values()].filter((r) => r.devise !== null);
  if (enDevise.length === 0) return 'RESTE_NON_REPARTI';
  return enDevise.some((r) => (r.devise ?? 0) > 0) ? 'DEVISE_REGLEE_EN_PARTIE' : 'DEVISE_SOLDEE_ECART_NON_PASSE';
}

type LecteurDeGroupes = { lettrage: { findMany: (args: Prisma.LettrageFindManyArgs) => Promise<unknown[]> } };

/**
 * LES GROUPES LUS LIGNE À LIGNE, SERVIS (paquet 1, B5). Un groupe dont le reste
 * ne se répartit pas sûrement entre ses factures (`nonRepartis`) garde la
 * lecture ligne à ligne · le total de l'état reste exact, mais la répartition
 * par échéance de CE groupe ne l'est plus (la facture à son échéance, le
 * règlement sans échéance ou dans la sienne). Consigné au seul journal du
 * serveur, le lecteur de l'état ne le voyait pas · chaque état qui le lit le
 * SERT, borné (`PLAFOND_GROUPES_NOMMES`, le total dit), et l'écran le dit en
 * une ligne. Jamais un zéro · un état sans groupe lu ligne à ligne sert
 * `total: 0`, et c'est une lecture faite, pas une absence.
 */
export const PLAFOND_GROUPES_NOMMES = 20;

export interface GroupesLusLigneALigne {
  /** Tous les groupes lus ligne à ligne par l'état. */
  total: number;
  /**
   * Les premiers, par compte puis code (le code tel que le lettrage
   * l'affiche), chacun avec son motif (mineur 7).
   */
  groupes: Array<{ code: string; compte: string; motif: MotifGroupeNomme }>;
  /** Vrai quand `groupes` n'en nomme qu'une partie. */
  tronque: boolean;
}

interface GroupeNomme {
  id: string;
  code: string;
  compteId: string;
  compte: string;
  motif: MotifGroupeNomme;
}

/** Les groupes nommés, lus par tranches · un groupe d'un autre dossier n'est pas rendu. */
async function lireGroupesNommes(db: unknown, tenantId: string, motifs: ReadonlyMap<string, MotifGroupeNomme>): Promise<GroupeNomme[]> {
  const lus: GroupeNomme[] = [];
  const uniques = [...motifs.keys()];
  for (let i = 0; i < uniques.length; i += LOT_GROUPES) {
    const tranche = (await (db as LecteurDeGroupes).lettrage.findMany({
      where: { tenantId, id: { in: uniques.slice(i, i + LOT_GROUPES) } },
      select: { id: true, code: true, compteId: true, compte: { select: { numero: true } } },
    })) as Array<{ id: string; code: string; compteId: string; compte: { numero: string } }>;
    for (const g of tranche) lus.push({ id: g.id, code: g.code.toLowerCase(), compteId: g.compteId, compte: g.compte.numero, motif: motifs.get(g.id)! });
  }
  return lus.sort((a, b) => a.compte.localeCompare(b.compte) || a.code.localeCompare(b.code));
}

function nommer(groupes: readonly GroupeNomme[], total: number): GroupesLusLigneALigne {
  return {
    total,
    groupes: groupes.slice(0, PLAFOND_GROUPES_NOMMES).map((g) => ({ code: g.code, compte: g.compte, motif: g.motif })),
    tronque: total > PLAFOND_GROUPES_NOMMES,
  };
}

/**
 * Les groupes nommés d'un état, servis avec leur motif · `total` est le
 * nombre de groupes reçus.
 */
export async function groupesLusLigneALigne(
  db: unknown,
  tenantId: string,
  motifs: ReadonlyMap<string, MotifGroupeNomme>,
): Promise<GroupesLusLigneALigne> {
  if (motifs.size === 0) return { total: 0, groupes: [], tronque: false };
  return nommer(await lireGroupesNommes(db, tenantId, motifs), motifs.size);
}

/** Les mêmes, compte par compte (relances · une position par compte). */
export async function groupesLusLigneALigneParCompte(
  db: unknown,
  tenantId: string,
  motifs: ReadonlyMap<string, MotifGroupeNomme>,
): Promise<Map<string, GroupesLusLigneALigne>> {
  const parCompte = new Map<string, GroupeNomme[]>();
  for (const g of await lireGroupesNommes(db, tenantId, motifs)) parCompte.set(g.compteId, [...(parCompte.get(g.compteId) ?? []), g]);
  return new Map([...parCompte].map(([compteId, groupes]) => [compteId, nommer(groupes, groupes.length)]));
}
type LecteurDeDeclarations = { imputationPaiement: { findMany: (args: Prisma.ImputationPaiementFindManyArgs) => Promise<unknown[]> } };

/**
 * La borne de l'état · un groupe n'est lu en entier que si TOUTES ses lignes
 * qu'elle admet (datées au plus tard de `dateMax`, du `statut` demandé) sont
 * parmi les lignes reçues. Sans date, toutes les lignes du groupe comptent.
 */
export interface BorneDeLEtat {
  dateMax?: Date;
  statut?: StatutEcriture;
}

/**
 * Le poids des lignes lues · les groupes lus en partie exclus, les origines
 * des lignes d'à-nouveau des groupes RECONDUITS relues (un groupe de N+1 nomme
 * celui de N qu'il reconduit), puis celles des autres lignes d'à-nouveau des
 * groupes (`originesDesANouveaux`), le tout par tranches · rien n'est lu quand
 * aucun groupe n'en porte deux lignes.
 */
export async function poidsDesLignesLues(
  db: unknown,
  tenantId: string,
  lignes: readonly LigneOuverte[],
  borne: BorneDeLEtat,
  etat: string,
): Promise<PoidsDesLignes> {
  const groupes = groupesAPlusieurs(lignes);
  const ids = [...groupes.keys()];
  const origines = new Map<string, OrigineDeLigne>();
  const exclus = new Set<string>();
  const sansOrigine: string[] = [];
  for (let i = 0; i < ids.length; i += LOT_GROUPES) {
    const tranche = ids.slice(i, i + LOT_GROUPES);
    const [comptes, reconduits] = await Promise.all([
      (db as LecteurDeLignes).ligneEcriture.groupBy({
        by: ['lettrageId'],
        where: {
          lettrageId: { in: tranche },
          ecriture: {
            tenantId,
            ...(borne.dateMax ? { date: { lte: borne.dateMax } } : {}),
            ...(borne.statut ? { statut: borne.statut } : {}),
          },
        },
        _count: { _all: true },
      }),
      (db as LecteurDeGroupes).lettrage.findMany({
        where: { tenantId, id: { in: tranche }, lettrageReconduitId: { not: null } },
        select: SELECT_ORIGINE,
      }) as Promise<GroupeAOrdonner[]>,
    ]);
    const dansLaBorne = new Map(comptes.map((c) => [c.lettrageId, c._count._all]));
    for (const id of tranche) if (dansLaBorne.get(id) !== groupes.get(id)!.length) exclus.add(id);
    if (reconduits.length > 0) for (const [id, o] of await originesDesLignes(db, tenantId, reconduits)) origines.set(id, o);
    const lus = tranche.filter((id) => !exclus.has(id)).map((id) => [id, groupes.get(id)!] as const);
    for (const id of await originesDesANouveaux(db, tenantId, lus, origines)) sansOrigine.push(id);
  }
  // Les parts déclarées des paiements des groupes (art. 151 et 153), non
  // retirées, par tranches des lignes.
  const declarations = new Map<string, PartDeclaree[]>();
  const lignesDesGroupes = [...groupes.values()].flat().map((l) => l.id);
  for (let i = 0; i < lignesDesGroupes.length; i += LOT_GROUPES) {
    const parts = (await (db as LecteurDeDeclarations).imputationPaiement.findMany({
      where: { tenantId, retireeLe: null, ligneReglementId: { in: lignesDesGroupes.slice(i, i + LOT_GROUPES) } },
      select: { ligneReglementId: true, ligneFactureId: true, montant: true },
    })) as Array<{ ligneReglementId: string; ligneFactureId: string; montant: Prisma.Decimal | number }>;
    for (const d of parts) {
      const liste = declarations.get(d.ligneReglementId) ?? [];
      liste.push({ ligneFactureId: d.ligneFactureId, montant: Number(d.montant) });
      declarations.set(d.ligneReglementId, liste);
    }
  }
  const p = poidsDesLignesOuvertes(lignes, origines, exclus, declarations);
  // CONSIGNÉ, JAMAIS TU · un groupe qui garde la lecture ligne à ligne
  // laisse son règlement hors des colonnes, comme avant la règle ; le total
  // de l'état reste exact, et le journal du serveur nomme les groupes.
  if (p.nonRepartis.length > 0) {
    journal.warn(
      `${etat} · ${p.nonRepartis.length} groupe(s) de lettrage lu(s) ligne à ligne, leur reste ne se répartissant pas ` +
        `sûrement entre leurs factures (négatif sans son origine, reste négatif en devise, part déclarée au-delà de la facture, ` +
        `imputation déclarée dans un groupe en devise) · ${p.nonRepartis.slice(0, 20).join(', ')}` +
        (p.nonRepartis.length > 20 ? ' …' : ''),
    );
  }
  if (sansOrigine.length > 0) {
    journal.warn(
      `${etat} · ${sansOrigine.length} groupe(s) de lettrage à plusieurs factures dont une ligne d'à-nouveau n'a pas retrouvé ` +
        `sa pièce d'origine (aucune origine sûre à la clé du report, ou pièce antérieure au premier exercice tenu) · ` +
        `leurs lignes d'à-nouveau s'imputent à la date du report (Code civil, Livre III, art. 154, lu sur cette date) · ` +
        `${sansOrigine.slice(0, 20).join(', ')}` +
        (sansOrigine.length > 20 ? ' …' : ''),
    );
  }
  return p;
}

type LecteurDesANouveaux = {
  ligneEcriture: { findMany: (args: Prisma.LigneEcritureFindManyArgs) => Promise<unknown[]> };
};

interface LigneDAnouveauLue {
  id: string;
  compteId: string;
  debit: Prisma.Decimal | number;
  credit: Prisma.Decimal | number;
  libelle: string | null;
  dateEcheance: Date | null;
  compte?: { numero: string } | null;
  ecriture?: { date: Date; estANouveauProvisoire?: boolean; estGenereeParCloture?: boolean; estSoldeDesComptesDeGestion?: boolean } | null;
}

/**
 * L'ORIGINE DES LIGNES D'À-NOUVEAU D'UN GROUPE POSÉ EN N+1 (paquet 1, B7).
 * Un groupe lettré à la main sur des lignes d'à-nouveau, sans groupe de N
 * qu'il reconduise, n'a pas de `lettrageReconduitId` · ses lignes d'à-nouveau
 * portaient toutes la date du report, et l'imputation de l'art. 154 (« sur la
 * plus ancienne », puis « proportionnellement ») éteignait deux factures de
 * mars et de septembre au PRORATA. Chaque ligne d'à-nouveau qu'aucune
 * reconduction ne date retrouve sa pièce d'origine par la clé du report au
 * détail (`originesDesReports`, la règle des relances), de proche en proche.
 *
 * TOUT OU RIEN, PAR GROUPE · un groupe dont une ligne d'à-nouveau n'a pas
 * retrouvé son origine garde la date du report pour TOUTES · la seule
 * origine manquante, laissée au 1er janvier, passerait pour la plus récente
 * et la facture la plus ancienne resterait due. Le groupe est rendu
 * (`sansOrigine`) et consigné, jamais tu. Les lignes que la reconduction a
 * datées gardent leur origine. Les lignes relues sont filtrées EN MÉMOIRE
 * (identifiant demandé, écriture d'à-nouveau) · une lecture qui rendrait
 * plus que demandé n'invente aucun report.
 */
async function originesDesANouveaux(
  db: unknown,
  tenantId: string,
  groupes: ReadonlyArray<readonly [string, readonly LigneOuverte[]]>,
  origines: Map<string, OrigineDeLigne>,
): Promise<string[]> {
  const demandees = new Set(groupes.flatMap(([, membres]) => membres.map((l) => l.id)).filter((id) => !origines.has(id)));
  if (demandees.size === 0) return [];
  const lues = (await (db as LecteurDesANouveaux).ligneEcriture.findMany({
    where: { id: { in: [...demandees] }, ecriture: { tenantId, OR: ECRITURE_D_A_NOUVEAU } },
    select: {
      id: true,
      compteId: true,
      debit: true,
      credit: true,
      libelle: true,
      dateEcheance: true,
      compte: { select: { numero: true } },
      ecriture: { select: { date: true, estANouveauProvisoire: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
    },
  })) as LigneDAnouveauLue[];
  const estANouveau = (l: LigneDAnouveauLue) =>
    l.ecriture?.estANouveauProvisoire === true || (l.ecriture?.estGenereeParCloture === true && l.ecriture.estSoldeDesComptesDeGestion !== true);
  const reports = lues.filter((l) => demandees.has(l.id) && estANouveau(l) && l.compte && l.ecriture);
  if (reports.length === 0) return [];
  // Par date de report · chaque date nomme l'exercice qui la précède.
  const parDate = new Map<number, LigneDAnouveauLue[]>();
  for (const l of reports) parDate.set(l.ecriture!.date.getTime(), [...(parDate.get(l.ecriture!.date.getTime()) ?? []), l]);
  const trouvees = new Map<string, OrigineDeLigne>();
  for (const [date, lignes] of parDate) {
    const { origines: o } = await originesDesReports(
      db as Parameters<typeof originesDesReports>[0],
      tenantId,
      new Date(date),
      lignes.map(
        (l): LigneReportee => ({
          id: l.id,
          compteId: l.compteId,
          numeroCompte: l.compte!.numero,
          debit: Number(l.debit),
          credit: Number(l.credit),
          libelle: l.libelle,
          dateEcheance: l.dateEcheance,
        }),
      ),
    );
    for (const [id, origine] of o) trouvees.set(id, origine);
  }
  // Le groupe de chaque ligne est celui des lignes REÇUES, jamais celui que
  // la lecture rendrait.
  const groupeDe = new Map(groupes.flatMap(([lettrageId, membres]) => membres.map((l) => [l.id, lettrageId] as const)));
  const reportsParGroupe = new Map<string, string[]>();
  for (const l of reports) {
    const lettrageId = groupeDe.get(l.id)!;
    reportsParGroupe.set(lettrageId, [...(reportsParGroupe.get(lettrageId) ?? []), l.id]);
  }
  const membresDe = new Map(groupes);
  const sansOrigine: string[] = [];
  for (const [lettrageId, ids] of reportsParGroupe) {
    if (ids.every((id) => trouvees.has(id))) {
      for (const id of ids) origines.set(id, trouvees.get(id)!);
      continue;
    }
    // Rien n'est à départager quand le groupe ne porte qu'une facture (ou se
    // solde) · l'imputation n'a pas de choix, la date n'y change rien.
    const membres = membresDe.get(lettrageId) ?? [];
    const net = membres.reduce((t, l) => t + centimes(l.debit) - centimes(l.credit), 0);
    const factures = membres.filter((l) => (net > 0 ? centimes(l.debit) > 0 : centimes(l.credit) > 0));
    if (net !== 0 && factures.length > 1) sansOrigine.push(lettrageId);
  }
  return sansOrigine;
}

type LecteurDeLignes = {
  ligneEcriture: {
    groupBy: (args: {
      by: ['lettrageId'];
      where: Prisma.LigneEcritureWhereInput;
      _count: { _all: true };
    }) => Promise<Array<{ lettrageId: string | null; _count: { _all: number } }>>;
  };
};

/**
 * Les groupes dont le filtre de l'état lit au moins DEUX lignes · seules
 * celles-là se gardent en mémoire le temps d'une lecture par lots (§ 8 bis ;
 * relecture TypeScript, majeur 2) · une facture de N lettrée avec un
 * règlement de N+1 est seule de son groupe dans l'exercice, et se range au
 * fil des lots.
 */
export async function groupesLusAPlusieurs(db: unknown, where: Prisma.LigneEcritureWhereInput): Promise<Set<string>> {
  const lus = await (db as LecteurDeLignes).ligneEcriture.groupBy({
    by: ['lettrageId'],
    where: { AND: [where, { lettrageId: { not: null } }] },
    _count: { _all: true },
  });
  const ids = new Set<string>();
  for (const g of lus) if (g.lettrageId && g._count._all > 1) ids.add(g.lettrageId);
  return ids;
}

type LecteurDeLignesLettrees = {
  ligneEcriture: {
    findMany: (args: Prisma.LigneEcritureFindManyArgs) => Promise<unknown[]>;
  };
};

/**
 * CE QUE LE RESTE CHANGE AUX PARTS ÉCHUE ET NON ÉCHUE d'une note qui les
 * demande à la base par compte (`groupBy`, NOTE 3 des deux SMT · relecture
 * « échecs silencieux », majeur 8) · pour chaque ligne d'un groupe qui pèse
 * autre chose que son montant, l'écart est porté à la part de SON échéance
 * (après la clôture, non échue ; au plus tard la clôture, échue). Une ligne
 * sans échéance n'est dans aucune part · son écart reste dans le reste du
 * compte, que la note dit sous son nom. Les sommes demandées à la base ne
 * changent pas · seules les lignes des groupes que la lecture porte à
 * plusieurs sont relues, par tranches. Les groupes lus ligne à ligne sont
 * rendus avec leur motif (`nommes`), que la note sert (paquet 1, B5).
 */
export async function ecartsDesGroupesParEcheance(
  db: unknown,
  tenantId: string,
  ouvertes: Prisma.LigneEcritureWhereInput,
  dateFin: Date,
  etat: string,
): Promise<{ ecarts: Map<string, { nonEchu: number; echu: number }>; nommes: Map<string, MotifGroupeNomme> }> {
  const ecarts = new Map<string, { nonEchu: number; echu: number }>();
  const ids = [...(await groupesLusAPlusieurs(db, ouvertes))];
  if (ids.length === 0) return { ecarts, nommes: new Map() };
  const lues: Array<LigneOuverte & { compteId: string }> = [];
  for (let i = 0; i < ids.length; i += LOT_GROUPES) {
    lues.push(
      ...((await (db as LecteurDeLignesLettrees).ligneEcriture.findMany({
        where: { AND: [ouvertes, { lettrageId: { in: ids.slice(i, i + LOT_GROUPES) } }] },
        select: {
          id: true,
          compteId: true,
          debit: true,
          credit: true,
          lettrageId: true,
          dateEcheance: true,
          deviseId: true,
          montantDevise: true,
          ecriture: { select: { date: true } },
        },
      })) as Array<LigneOuverte & { compteId: string }>),
    );
  }
  const p = await poidsDesLignesLues(db, tenantId, lues, { dateMax: dateFin, statut: StatutEcriture.VALIDEE }, etat);
  for (const l of lues) {
    if (!l.dateEcheance) continue;
    const poids = p.poids.get(l.id);
    if (poids === undefined) continue;
    const ecart = (centimes(poids) - (centimes(l.debit) - centimes(l.credit))) / 100;
    if (ecart === 0) continue;
    const e = ecarts.get(l.compteId) ?? { nonEchu: 0, echu: 0 };
    if (l.dateEcheance > dateFin) e.nonEchu += ecart;
    else e.echu += ecart;
    ecarts.set(l.compteId, e);
  }
  return { ecarts, nommes: p.motifs };
}
