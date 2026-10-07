import { StatutEcriture } from '@prisma/client';
import { LOT_LECTURE, lireParLots, pageApres } from '../../common/lecture-par-lots';
import type { Lecteur } from './reglements-de-tresorerie';

/**
 * LA DETTE DE N-1 RÉGLÉE EN N EST UN DÉCAISSEMENT DE N (cas chiffrés de la
 * clôture, constat B3, 2026-10-07).
 *
 * Le tableau d'exécution budgétaire classe chaque dépense écriture par
 * écriture · payée, DÉCAISSÉE ; passée en compte fournisseur encore dû à la
 * clôture, ENGAGÉE. La facture de N-1 due au 31 décembre est donc engagée en
 * N-1, et son règlement de N, qui n'a pas de ventilation, n'était compté
 * nulle part · « Décaissement (2) = mouvement débit balance N des comptes de
 * charges […] + (solde créditeur N-1 du compte 40 sauf 409 − solde créditeur
 * N du compte 40 sauf 409) » (SYCEBNL, guide d'application, Application 22,
 * règle (c)). La dette de N-1 qui ne l'est plus à la clôture de N est un
 * décaissement de N ; celle qui l'est encore, un engagement de N (règle (d),
 * « solde créditeur balance N des comptes fournisseurs »). C10 · ligne B1,
 * décaissement 1 000 000 au lieu de 1 500 000, crédit disponible +200 000 au
 * lieu de −300 000 · le dépassement était masqué.
 *
 * LA LIGNE SE SUIT EN N par ce qui l'a soldée · lettrée dans un groupe qui
 * se referme au plus tard à la clôture de N (règlement de N lettré avec la
 * facture même), elle est réglée ; sinon par SA ligne d'à-nouveau, reconnue
 * à son compte, ses montants, son échéance et son libellé, que le report
 * recopie (« RAN détail <compte> · <libellé> », `report-a-nouveau.ts`, même
 * appariement que `paires-a-cheval.ts`), ouverte ou non à la clôture de N.
 * RIEN N'EST DEVINÉ · aucune ligne d'à-nouveau (report au SOLDE, exercice
 * précédent non clôturé), ou plusieurs identiques · la dépense est NOMMÉE,
 * comptée ni en décaissement ni en engagement.
 *
 * SEUL LE RESTE DÛ SE SUIT (relecture du 2026-10-07, bloquant 1) · une
 * facture de 1 000 000 réglée de 400 000 en N-1 (lettrage PARTIEL, les deux
 * lignes reportées) passait en ENTIER en décaissement de N. La règle (c) ne
 * porte en N que la baisse du « solde créditeur » du 40 · le reste dû à la
 * clôture de N-1 (600 000), moins le reste dû à la clôture de N. Le reste se
 * lit sur le groupe de la ligne, à la date · la ligne, moins ce que ses
 * règlements du groupe ont soldé. Un groupe qui réunit PLUSIEURS factures ne
 * dit pas laquelle un règlement a payé (Code civil, Livre III, art. 151 à
 * 154, que ce tableau ne rejoue pas) · la dépense est NOMMÉE.
 */

/**
 * La suite en N d'une ligne fournisseur de N-1 · ce qui en a été décaissé en
 * N, ce qui en reste dû à la clôture de N (engagé), en unités de dette
 * (crédit moins débit) ; ou introuvable.
 */
export type SuiteEnN = { decaisseEnN: number; engageEnN: number } | 'INCONNUE';

/** Une ligne fournisseur de N-1, ouverte à sa clôture. */
export interface DetteDeNMoins1 {
  id: string;
  compteId: string;
  numero: string;
  debit: unknown;
  credit: unknown;
  dateEcheance: Date | null;
  /** Le groupe de lettrage de la ligne, partiel ou soldé. */
  lettrageId: string | null;
  /** Le libellé que le report recopie · celui de la ligne, sinon celui de l'écriture. */
  libelle: string;
}

const centimes = (x: unknown) => Math.round(Number(x ?? 0) * 100);
const cle = (compteId: string, debit: unknown, credit: unknown, echeance: Date | null, libelle: string | null) =>
  `${compteId}|${centimes(debit)}|${centimes(credit)}|${echeance ? echeance.getTime() : ''}|${libelle ?? ''}`;
const UN_JOUR = 86_400_000;

/**
 * LE RESTE DÛ D'UNE LIGNE À UNE DATE, en centimes · la ligne entière hors de
 * tout groupe ; dans un groupe, le solde créditeur des lignes du groupe
 * datées au plus tard ce jour, borné par la ligne. `null` quand le groupe
 * porte une autre ligne créditrice (deux factures · l'imputation des
 * règlements n'est pas lue ici).
 */
export async function resteDuALaDate(
  db: Lecteur,
  tenantId: string,
  ligne: { id: string; debit: unknown; credit: unknown; lettrageId: string | null },
  date: Date,
): Promise<number | null> {
  const propre = centimes(ligne.credit) - centimes(ligne.debit);
  if (!ligne.lettrageId) return Math.max(0, propre);
  const groupe = (await db.ligneEcriture.findMany({
    where: { lettrageId: ligne.lettrageId, ecriture: { tenantId, date: { lt: new Date(date.getTime() + UN_JOUR) } } },
    select: { id: true, debit: true, credit: true },
  })) as Array<{ id: string; debit: unknown; credit: unknown }>;
  let solde = 0;
  for (const l of groupe) {
    const net = centimes(l.credit) - centimes(l.debit);
    if (net > 0 && l.id !== ligne.id) return null;
    solde += net;
  }
  return Math.max(0, Math.min(propre, solde));
}

/** Le groupe de la ligne se poursuit-il après la date (règlement de N lettré avec la facture même) ? */
async function groupePoursuiviApres(db: Lecteur, tenantId: string, lettrageId: string, date: Date): Promise<boolean> {
  const apres = (await db.ligneEcriture.findMany({
    where: { lettrageId, ecriture: { tenantId, date: { gt: date } } },
    select: { id: true },
    take: 1,
  })) as unknown[];
  return apres.length > 0;
}

/**
 * La suite en N de chaque ligne fournisseur de N-1 ouverte à la clôture de
 * N-1 · ce qui en est décaissé en N, ce qui en reste engagé, ou introuvable.
 */
export async function suiteEnNDesDettes(
  db: Lecteur,
  tenantId: string,
  precedent: { id: string; dateFin: Date },
  exercice: { id: string; dateFin: Date },
  dettes: DetteDeNMoins1[],
): Promise<Map<string, SuiteEnN>> {
  const suite = new Map<string, SuiteEnN>();
  if (dettes.length === 0) return suite;
  const enUnites = (r1: number, r2: number): SuiteEnN => {
    const fin = Math.min(r1, r2);
    return { decaisseEnN: (r1 - fin) / 100, engageEnN: fin / 100 };
  };

  // 1. Le reste dû à la clôture de N-1 · seul lui se suit en N. Un groupe
  //    poursuivi par une ligne de N (règlement lettré avec la facture même)
  //    donne aussi le reste à la clôture de N.
  const reste1 = new Map<string, number>();
  const aSuivre: DetteDeNMoins1[] = [];
  for (const d of dettes) {
    const r1 = await resteDuALaDate(db, tenantId, d, precedent.dateFin);
    if (r1 === null) {
      suite.set(d.id, 'INCONNUE');
      continue;
    }
    if (r1 === 0) {
      suite.set(d.id, { decaisseEnN: 0, engageEnN: 0 });
      continue;
    }
    if (d.lettrageId && (await groupePoursuiviApres(db, tenantId, d.lettrageId, precedent.dateFin))) {
      const r2 = await resteDuALaDate(db, tenantId, d, exercice.dateFin);
      suite.set(d.id, r2 === null ? 'INCONNUE' : enUnites(r1, r2));
      continue;
    }
    reste1.set(d.id, r1);
    aSuivre.push(d);
  }
  if (aSuivre.length === 0) return suite;

  // 2. Les lignes d'à-nouveau de N sur ces comptes, indexées comme le report
  //    les écrit. Le report provisoire n'est pas validé et ne se lettre pas ·
  //    il ne dit rien de la suite.
  const comptes = [...new Set(aSuivre.map((d) => d.compteId))];
  type LigneAN = { id: string; debit: unknown; credit: unknown; lettrageId: string | null };
  const index = new Map<string, LigneAN[]>();
  await lireParLots(
    (curseur) =>
      db.ligneEcriture.findMany({
        where: {
          compteId: { in: comptes },
          ecriture: {
            tenantId,
            exerciceId: exercice.id,
            statut: StatutEcriture.VALIDEE,
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: false,
          },
        },
        select: { id: true, compteId: true, debit: true, credit: true, dateEcheance: true, libelle: true, lettrageId: true },
        ...pageApres(curseur, LOT_LECTURE),
      }) as Promise<
        Array<{ id: string; compteId: string; debit: unknown; credit: unknown; dateEcheance: Date | null; libelle: string | null; lettrageId: string | null }>
      >,
    (l) => {
      const k = cle(l.compteId, l.debit, l.credit, l.dateEcheance, l.libelle);
      index.set(k, [...(index.get(k) ?? []), l]);
    },
  );

  // 3. Une seule ligne d'à-nouveau par dette, sinon rien n'est deviné ; son
  //    reste dû à la clôture de N est l'engagement de N, la baisse depuis la
  //    clôture de N-1 le décaissement de N.
  for (const d of aSuivre) {
    const candidates = index.get(cle(d.compteId, d.debit, d.credit, d.dateEcheance, `RAN détail ${d.numero} · ${d.libelle}`)) ?? [];
    if (candidates.length !== 1) {
      suite.set(d.id, 'INCONNUE');
      continue;
    }
    const r2 = await resteDuALaDate(db, tenantId, candidates[0], exercice.dateFin);
    suite.set(d.id, r2 === null ? 'INCONNUE' : enUnites(reste1.get(d.id)!, r2));
  }
  return suite;
}
