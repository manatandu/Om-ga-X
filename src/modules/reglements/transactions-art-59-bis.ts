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
 * la clé du report au détail (`originesDesReports`, la règle des relances) ;
 * non retrouvée, ou remontant à un bilan d'ouverture, elle se lit seule, et
 * rien n'est inventé.
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
  montant: number;
}

type Lecteur = Pick<Prisma.TransactionClient, 'exercice' | 'ligneEcriture'>;

export async function transactionsDesLignes(
  prisma: Lecteur,
  p: { tenantId: string; exerciceId: string; lignes: readonly LigneReglee[] },
): Promise<Map<string, TransactionReglee>> {
  const { tenantId } = p;
  const reportees = p.lignes.filter((l) => estDAnouveau(l.ecriture));
  const origineDe = new Map<string, { ecritureId: string; compteId: string; numeroPiece: number | null; libelle: string }>();
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
              ecriture: { select: { numeroPiece: true, libelle: true, estANouveauProvisoire: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
            },
          })
        : [];
      const parId = new Map(lues.map((o) => [o.id, o]));
      for (const [reportId, o] of origines) {
        const origine = parId.get(o.id);
        // L'origine qui est elle-même un à-nouveau (premier exercice tenu)
        // n'est pas une facture · la ligne se lit seule.
        if (!origine || estDAnouveau(origine.ecriture)) continue;
        origineDe.set(reportId, {
          ecritureId: origine.ecritureId,
          compteId: origine.compteId,
          numeroPiece: origine.ecriture.numeroPiece,
          libelle: origine.ecriture.libelle,
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
  const totalDeLaPiece = new Map(
    sommes.map((x) => [`${x.ecritureId}:${x.compteId}`, Math.abs(Number(x._sum.debit ?? 0) - Number(x._sum.credit ?? 0))]),
  );
  const resultat = new Map<string, TransactionReglee>();
  for (const l of p.lignes) {
    const ligneSeule = Math.abs(Number(l.debit) - Number(l.credit));
    const o = origineDe.get(l.id);
    const cle = o ? `${o.ecritureId}:${o.compteId}` : estDAnouveau(l.ecriture) ? l.id : `${l.ecritureId}:${l.compteId}`;
    const piece = o ?? l.ecriture;
    resultat.set(l.id, {
      cle,
      reference: piece.numeroPiece ? `pièce ${piece.numeroPiece}` : piece.libelle || 'facture',
      montant: Math.max(ligneSeule, totalDeLaPiece.get(cle) ?? 0),
    });
  }
  return resultat;
}
