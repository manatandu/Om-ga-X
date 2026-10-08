import { Logger } from '@nestjs/common';
import { Prisma, StatutEcriture } from '@prisma/client';
import {
  LOT_GROUPES,
  SELECT_ORIGINE,
  originesDesLignes,
  restesDesFactures,
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
 * facture la règle, et ce qui reste dû l'est sur ELLE, à son échéance. Le
 * reste de chaque facture se lit par la règle du Règlement des tiers et de la
 * clôture (`restesDesFactures`, les plus anciennes d'abord, chaque somme dans
 * l'ordre de son inscription) · une ligne d'à-nouveau d'un groupe reconduit
 * s'y lit à sa pièce d'ORIGINE (date et ligne, `originesDesLignes`), comme au
 * Règlement des tiers (`lignesDuGroupe`) · sans elle, deux factures reportées
 * le même premier jour s'ordonnaient par un identifiant tiré au hasard
 * (relecture TypeScript, bloquant 1). Les factures sont les lignes du sens du
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
 * facture existent (`pairesACheval`, `resteDuALaDate`) · celle-ci est celle
 * du Règlement des tiers.
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
}

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
 * un négatif n'a pas son origine parmi les lignes.
 */
function annulerLesNegatifs(membres: readonly LigneOuverte[]): Set<string> | null {
  const annulees = new Set<string>();
  const memeEcheance = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
  for (const n of membres) {
    for (const colonne of ['debit', 'credit'] as const) {
      const montant = centimes(n[colonne]);
      if (montant >= 0) continue;
      const origine = membres.find(
        (o) => !annulees.has(o.id) && o.id !== n.id && centimes(o[colonne]) === -montant && memeEcheance(o.dateEcheance, n.dateEcheance),
      );
      if (!origine) return null;
      annulees.add(n.id);
      annulees.add(origine.id);
    }
  }
  return annulees;
}

/**
 * Le poids des lignes, les origines des lignes d'à-nouveau données · les
 * groupes `exclus` (lus en partie) gardent la lecture ligne à ligne.
 */
export function poidsDesLignesOuvertes(
  lignes: readonly LigneOuverte[],
  origines: ReadonlyMap<string, OrigineDeLigne> = new Map(),
  exclus: ReadonlySet<string> = new Set(),
): PoidsDesLignes {
  const poids = new Map<string, number>();
  const nonRepartis: string[] = [];
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
      nonRepartis.push(lettrageId);
      continue;
    }
    for (const id of annulees) poids.set(id, 0);
    const restantes = membres.filter((l) => !annulees.has(l.id));
    if (restantes.length < 2) {
      // Une ligne seule garde son montant · la table ne la porte pas.
      continue;
    }
    const sens = net > 0 ? 'DEBIT' : 'CREDIT';
    const restes = restesDesFactures(
      restantes.map(
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
      ),
      sens,
    );
    const totalRestes = [...restes.values()].reduce((t, r) => t + centimes(r.francs), 0);
    // Un reste négatif · une facture en devise dont l'écart réalisé n'est pas
    // passé (le règlement la solde au-delà de ses francs) · lu ligne à ligne,
    // jamais une créance négative dans une colonne (mineur 3).
    if (totalRestes !== Math.abs(net) || [...restes.values()].some((r) => r.francs < 0)) {
      for (const id of annulees) poids.delete(id);
      nonRepartis.push(lettrageId);
      continue;
    }
    const signe = sens === 'DEBIT' ? 1 : -1;
    for (const l of restantes) {
      const reste = restes.get(l.id);
      poids.set(l.id, reste ? signe * reste.francs : 0);
    }
  }
  return { poids, nonRepartis };
}

type LecteurDeGroupes = { lettrage: { findMany: (args: Prisma.LettrageFindManyArgs) => Promise<unknown[]> } };

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
 * celui de N qu'il reconduit), le tout par tranches · rien n'est lu quand
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
  }
  const p = poidsDesLignesOuvertes(lignes, origines, exclus);
  // CONSIGNÉ, JAMAIS TU · un groupe qui garde la lecture ligne à ligne
  // laisse son règlement hors des colonnes, comme avant la règle ; le total
  // de l'état reste exact, et le journal du serveur nomme les groupes.
  if (p.nonRepartis.length > 0) {
    journal.warn(
      `${etat} · ${p.nonRepartis.length} groupe(s) de lettrage lu(s) ligne à ligne, leur reste ne se répartissant pas ` +
        `sûrement entre leurs factures (négatif sans son origine, reste négatif en devise) · ${p.nonRepartis.slice(0, 20).join(', ')}` +
        (p.nonRepartis.length > 20 ? ' …' : ''),
    );
  }
  return p;
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
 * plusieurs sont relues, par tranches.
 */
export async function ecartsDesGroupesParEcheance(
  db: unknown,
  tenantId: string,
  ouvertes: Prisma.LigneEcritureWhereInput,
  dateFin: Date,
  etat: string,
): Promise<Map<string, { nonEchu: number; echu: number }>> {
  const ecarts = new Map<string, { nonEchu: number; echu: number }>();
  const ids = [...(await groupesLusAPlusieurs(db, ouvertes))];
  if (ids.length === 0) return ecarts;
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
  return ecarts;
}
