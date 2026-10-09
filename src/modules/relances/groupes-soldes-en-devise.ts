import type { Prisma } from '@prisma/client';
import { ecartDuGroupe, libelleEcartRealise } from '../reglements/ecart-change-realise';

/**
 * UNE FACTURE SOLDÉE DANS SA DEVISE NE SE RÉCLAME PLUS (paquet 1, B6).
 *
 * Une facture de 1 000 USD inscrite à 2 800 000, réglée de 1 000 USD au cours
 * de 2 900 (2 900 000), lettrée en partiel avec son règlement · le client ne
 * doit plus rien de cette facture, et la différence en francs est un écart de
 * change RÉALISÉ que l'entité constate (AUDCIF art. 55, « À la date de
 * règlement des créances et dettes, les pertes et gains de change à cette
 * date sont constatés par rapport à leur coût historique » ; ligne A6 · le
 * lettrage le propose, « Passer l'écart » le passe). Tant qu'il ne l'est pas,
 * le groupe ne se répartit pas entre ses lignes (`poidsDesLignesOuvertes`, le
 * reste en francs n'est celui d'aucune facture) et la relance le lisait ligne
 * à ligne · la facture réclamée et le règlement retranché d'une autre dette,
 * soit un gain déduit de ce que le client doit encore, ou une PERTE de change
 * qui lui était réclamée.
 *
 * Le groupe retenu ici · TOUTES ses lignes lues (lu en entier, aucune ligne
 * dans un autre exercice ou déjà hors de la lecture), TOUTES en une seule
 * devise, soldées dans cette devise, non soldées en francs. Une ligne en
 * francs seuls dans le groupe (une autre facture, un acompte sans devise) le
 * laisse à la règle commune · son reste en francs ne serait plus le seul
 * écart. Rien n'est passé ni retranché du compte · la relance ne réclame pas
 * ces lignes, et nomme l'écart à passer.
 */

/** Un groupe soldé dans sa devise, dont l'écart réalisé n'est pas passé. */
export interface EcartChangeNonPasse {
  lettrageId: string;
  /** Le code du groupe, tel que le lettrage l'affiche (partiel, en minuscules). */
  code: string;
  compteId: string;
  /** Signé comme `ecartDuGroupe` · positif pour une perte, négatif pour un gain. */
  ecart: number;
  libelle: string;
}

/** Une ligne lue par la relance · ce que la règle en regarde. */
export interface LigneLueDuGroupe {
  id: string;
  lettrageId: string | null;
  debit: Prisma.Decimal | number;
  credit: Prisma.Decimal | number;
  deviseId: string | null;
  montantDevise: Prisma.Decimal | number | null;
}

type LecteurDeGroupes = {
  lettrage: { findMany: (args: Prisma.LettrageFindManyArgs) => Promise<unknown[]> };
};

const centimes = (x: Prisma.Decimal | number | null) => Math.round(Number(x ?? 0) * 100);

/** Le libellé dit à l'écran · le gain ou la perte, son montant, et le geste qui le passe. */
export function libelleEcartNonPasse(ecart: number): string {
  const montant = Math.abs(ecart).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, ' ');
  return `${libelleEcartRealise(ecart)} de ${montant} non passé · facture soldée dans sa devise, rien n'est réclamé ; passer l'écart au lettrage du compte (AUDCIF art. 55)`;
}

/**
 * Les groupes des lignes lues dont la règle se juge sur les seules lignes ·
 * deux lignes au moins, toutes en une même devise, soldées en devise et non
 * en francs. Pur.
 */
export function candidatsSoldesEnDevise(lues: readonly LigneLueDuGroupe[]): Map<string, { lignes: number; ecart: number }> {
  const groupes = new Map<string, LigneLueDuGroupe[]>();
  for (const l of lues) if (l.lettrageId) groupes.set(l.lettrageId, [...(groupes.get(l.lettrageId) ?? []), l]);
  const candidats = new Map<string, { lignes: number; ecart: number }>();
  for (const [id, membres] of groupes) {
    if (membres.length < 2) continue;
    if (!membres.every((l) => l.deviseId !== null && l.montantDevise !== null)) continue;
    const r = ecartDuGroupe(
      membres.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
        deviseId: l.deviseId,
        montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
      })),
    );
    if (!r) continue;
    const ecart = membres.reduce((t, l) => t + centimes(l.debit) - centimes(l.credit), 0);
    if (ecart === 0) continue;
    candidats.set(id, { lignes: membres.length, ecart: ecart / 100 });
  }
  return candidats;
}

/**
 * Les groupes soldés dans leur devise parmi les lignes lues, chacun LU EN
 * ENTIER (le nombre de ses lignes en base, tous exercices, égale celui des
 * lignes lues), avec son code et son compte. Rien n'est lu quand aucun
 * candidat ne se présente.
 */
export async function groupesSoldesEnDevise(
  db: unknown,
  tenantId: string,
  lues: readonly LigneLueDuGroupe[],
): Promise<Map<string, EcartChangeNonPasse>> {
  const candidats = candidatsSoldesEnDevise(lues);
  const resultat = new Map<string, EcartChangeNonPasse>();
  if (candidats.size === 0) return resultat;
  const groupes = (await (db as LecteurDeGroupes).lettrage.findMany({
    where: { tenantId, id: { in: [...candidats.keys()] } },
    select: { id: true, code: true, compteId: true, _count: { select: { lignes: true } } },
  })) as Array<{ id: string; code: string; compteId: string; _count: { lignes: number } }>;
  for (const g of groupes) {
    const c = candidats.get(g.id);
    // Lu en partie (une ligne dans un autre exercice, ou hors de la lecture) ·
    // la règle commune, comme le reste des groupes.
    if (!c || g._count.lignes !== c.lignes) continue;
    resultat.set(g.id, { lettrageId: g.id, code: g.code.toLowerCase(), compteId: g.compteId, ecart: c.ecart, libelle: libelleEcartNonPasse(c.ecart) });
  }
  return resultat;
}
