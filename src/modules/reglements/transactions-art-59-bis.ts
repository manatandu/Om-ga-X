import { Prisma } from '@prisma/client';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { originesDesReports } from '../relances/date-origine-des-reports';

/**
 * LA TRANSACTION QUE RÈGLE UNE LIGNE (ligne sage-l2, fonctions 1 et 3) · ce
 * que l'art. 59 bis de l'O.-L. n° 10/001 mesure (« toute transaction [...]
 * d'un montant d'au moins 1.000.000,00 de Francs congolais »).
 *
 * LA TRANSACTION EST LA FACTURE ENTIÈRE, jamais l'échéance ni le reste dû ·
 * une facture découpée en échéances par le modèle de règlement du tiers
 * porte plusieurs lignes au compte du tiers, chacune sous le seuil ; elle se
 * lit sur sa PIÈCE (ses lignes au même compte). Une ligne d'À-NOUVEAU
 * (facture de N réglée en N+1) se lit sur SA pièce d'origine, retrouvée par
 * la clé du report au détail (`originesDesReports`, la règle des relances).
 *
 * RIEN N'EST AFFIRMÉ QUE LA PIÈCE NE DIT PAS (relecture « échecs silencieux »
 * de la ligne sage-l2, M3) · deux lectures fabriquaient une transaction ·
 *  · l'à-nouveau dont la facture d'origine n'est pas retrouvée (bilan
 *    d'ouverture importé à une ligne par compte, report au solde, origine
 *    elle-même un à-nouveau) était lu comme UNE facture de son montant · il
 *    peut en réunir plusieurs. Il sort NON JUGÉ (`origineRetrouvee: false`),
 *    nommé comme tel, jamais compté pour une transaction ;
 *  · la pièce qui porte plusieurs lignes au compte était lue comme UNE
 *    facture de leur somme · ce peut être les échéances d'une facture (le
 *    modèle de règlement du tiers la découpe), ou plusieurs factures saisies
 *    ensemble. Le montant de la LIGNE (une facture, ou l'une de ses
 *    échéances, présomption d'OmegaX) se juge seul ; le total de la pièce,
 *    dans le sens de la facture, n'est servi que pour un avis SOUS CONDITION
 *    (« si ses lignes au compte sont les échéances d'une même facture »).
 */

/** Une écriture d'à-nouveau · le report provisoire, ou celui de la clôture hors solde des comptes de gestion. */
export function estDAnouveau(e: { estANouveauProvisoire?: boolean; estGenereeParCloture?: boolean; estSoldeDesComptesDeGestion?: boolean }): boolean {
  return e.estANouveauProvisoire === true || (e.estGenereeParCloture === true && e.estSoldeDesComptesDeGestion !== true);
}

export interface LigneReglee {
  id: string;
  ecritureId: string;
  compteId: string;
  debit: Prisma.Decimal | number;
  credit: Prisma.Decimal | number;
  libelle: string | null;
  dateEcheance: Date | null;
  compte: { numero: string };
  ecriture: {
    date: Date;
    numeroPiece: number | null;
    libelle: string;
    estANouveauProvisoire?: boolean;
    estGenereeParCloture?: boolean;
    estSoldeDesComptesDeGestion?: boolean;
  };
}

export interface TransactionReglee {
  /** La pièce et le compte · deux échéances d'une même facture partagent la clé. */
  cle: string;
  reference: string;
  /** La ligne de la facture (la ligne réglée, ou sa ligne d'origine en N) · une facture, ou l'une de ses échéances. */
  ligne: number;
  /** Les lignes de la pièce au compte, dans le sens de la facture · plus que `ligne` quand la pièce en porte d'autres. */
  piece: number;
  /** Faux pour l'à-nouveau dont la facture d'origine n'est pas retrouvée · aucune transaction n'est affirmée. */
  origineRetrouvee: boolean;
}

/** Une facture nommée par l'avis de l'art. 59 bis. */
export interface FactureNommee {
  reference: string;
  montant: number;
}

/**
 * LE CLASSEMENT DES TRANSACTIONS D'UN RÈGLEMENT, une fois par clé · une
 * facture réglée par deux de ses échéances se nomme une fois.
 *  · `jugees` · la ligne seule (une facture ou l'une de ses échéances) ;
 *  · `sousCondition` · la ligne sous le seuil, la pièce au-delà par ses autres
 *    lignes au compte · avis « si ses lignes sont les échéances d'une même
 *    facture » ;
 *  · `nonJugees` · l'à-nouveau sans facture d'origine retrouvée, nommé avec le
 *    montant réglé, seuil non jugé.
 */
export function classerTransactions(
  transactions: Iterable<TransactionReglee>,
  seuil: number,
): { jugees: FactureNommee[]; sousCondition: FactureNommee[]; nonJugees: FactureNommee[] } {
  const parCle = new Map<string, TransactionReglee>();
  for (const t of transactions) {
    const deja = parCle.get(t.cle);
    parCle.set(t.cle, deja ? { ...deja, ligne: Math.max(deja.ligne, t.ligne), piece: Math.max(deja.piece, t.piece) } : t);
  }
  const auCentime = (x: number) => Math.round(x * 100);
  const jugees: FactureNommee[] = [];
  const sousCondition: FactureNommee[] = [];
  const nonJugees: FactureNommee[] = [];
  for (const t of parCle.values()) {
    if (!t.origineRetrouvee) nonJugees.push({ reference: t.reference, montant: t.ligne });
    else if (auCentime(t.ligne) >= auCentime(seuil)) jugees.push({ reference: t.reference, montant: t.ligne });
    else if (auCentime(t.piece) > auCentime(t.ligne)) sousCondition.push({ reference: t.reference, montant: t.piece });
    else jugees.push({ reference: t.reference, montant: t.ligne });
  }
  return { jugees, sousCondition, nonJugees };
}

type Lecteur = Pick<Prisma.TransactionClient, 'exercice' | 'ligneEcriture'>;

export async function transactionsDesLignes(
  prisma: Lecteur,
  p: { tenantId: string; exerciceId: string; lignes: readonly LigneReglee[] },
): Promise<Map<string, TransactionReglee>> {
  const { tenantId } = p;
  const reportees = p.lignes.filter((l) => estDAnouveau(l.ecriture));
  const origineDe = new Map<
    string,
    { ecritureId: string; compteId: string; numeroPiece: number | null; libelle: string; debit: number; credit: number }
  >();
  if (reportees.length) {
    const exercice = await prisma.exercice.findFirst({ where: { id: p.exerciceId, tenantId }, select: { dateDebut: true } });
    if (exercice) {
      const { origines } = await originesDesReports(
        prisma,
        tenantId,
        exercice.dateDebut,
        reportees.map((l) => ({
          id: l.id,
          compteId: l.compteId,
          numeroCompte: l.compte.numero,
          debit: Number(l.debit),
          credit: Number(l.credit),
          libelle: l.libelle,
          dateEcheance: l.dateEcheance,
          date: l.ecriture.date,
          provisoire: l.ecriture.estANouveauProvisoire === true,
        })),
      );
      const ids = [...new Set([...origines.values()].map((o) => o.id))];
      const lues = ids.length
        ? await prisma.ligneEcriture.findMany({
            where: { id: { in: ids }, ecriture: { tenantId, ...HORS_SITUATION } },
            select: {
              id: true,
              ecritureId: true,
              compteId: true,
              debit: true,
              credit: true,
              ecriture: { select: { numeroPiece: true, libelle: true, estANouveauProvisoire: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
            },
          })
        : [];
      const parId = new Map(lues.map((o) => [o.id, o]));
      for (const [reportId, o] of origines) {
        const origine = parId.get(o.id);
        // L'origine qui est elle-même un à-nouveau (premier exercice tenu)
        // n'est pas une facture · la ligne sort non jugée.
        if (!origine || estDAnouveau(origine.ecriture)) continue;
        origineDe.set(reportId, {
          ecritureId: origine.ecritureId,
          compteId: origine.compteId,
          numeroPiece: origine.ecriture.numeroPiece,
          libelle: origine.ecriture.libelle,
          debit: Number(origine.debit),
          credit: Number(origine.credit),
        });
      }
    }
  }
  const pieces = [
    ...new Set([...p.lignes.filter((l) => !estDAnouveau(l.ecriture)).map((l) => l.ecritureId), ...[...origineDe.values()].map((o) => o.ecritureId)]),
  ];
  const sommes = pieces.length
    ? await prisma.ligneEcriture.groupBy({
        by: ['ecritureId', 'compteId'],
        where: { ecritureId: { in: pieces }, ecriture: { tenantId, ...HORS_SITUATION } },
        _sum: { debit: true, credit: true },
      })
    : [];
  // Les lignes de la pièce au compte, PAR SENS · la facture se lit dans le
  // sien, jamais nette d'un règlement ou d'un avoir passé dans la même pièce.
  const sensDeLaPiece = new Map(
    sommes.map((x) => [`${x.ecritureId}:${x.compteId}`, { debit: Number(x._sum.debit ?? 0), credit: Number(x._sum.credit ?? 0) }]),
  );
  const resultat = new Map<string, TransactionReglee>();
  for (const l of p.lignes) {
    const o = origineDe.get(l.id);
    const reference = (x: { numeroPiece: number | null; libelle: string }) =>
      x.numeroPiece ? `pièce ${x.numeroPiece}` : x.libelle || 'facture';
    if (!o && estDAnouveau(l.ecriture)) {
      // NON JUGÉE · la facture que ce report porte n'est pas retrouvée.
      const reste = Math.abs(Number(l.debit) - Number(l.credit));
      resultat.set(l.id, { cle: l.id, reference: reference(l.ecriture), ligne: reste, piece: reste, origineRetrouvee: false });
      continue;
    }
    const facture = o ?? { debit: Number(l.debit), credit: Number(l.credit) };
    const ligne = Math.abs(facture.debit - facture.credit);
    const cle = o ? `${o.ecritureId}:${o.compteId}` : `${l.ecritureId}:${l.compteId}`;
    const sommesDuSens = sensDeLaPiece.get(cle);
    const piece = sommesDuSens ? (facture.credit > facture.debit ? sommesDuSens.credit : sommesDuSens.debit) : ligne;
    resultat.set(l.id, { cle, reference: reference(o ?? l.ecriture), ligne, piece: Math.max(piece, ligne), origineRetrouvee: true });
  }
  return resultat;
}
