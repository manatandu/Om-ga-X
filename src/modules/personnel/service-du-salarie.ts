import type { Prisma } from '@prisma/client';

/**
 * LIGNE SAGE-L5 · le service du salarié chez le même employeur, lu sur ses
 * contrats · un seul calcul, servi au compteur des congés (fonction 79) et aux
 * absences (fonction 78, limite de six mois par année de service).
 */

export type ContratLu = {
  id: string;
  dateEntreeEnVigueur: Date;
  dateFin: Date | null;
  renouvelleDeId: string | null;
  remunerationBase: Prisma.Decimal | null;
  periodiciteRemuneration: string | null;
  deviseRemuneration: string | null;
};

type ContratDuService = Pick<ContratLu, 'id' | 'dateEntreeEnVigueur' | 'dateFin' | 'renouvelleDeId'>;

/**
 * LE SERVICE CHEZ LE MÊME EMPLOYEUR (art. 140, al. 3 ; art. 141) · les
 * contrats renouvelés (art. 41) ou qui se suivent sans un jour d'écart forment
 * un seul service ; un contrat repris après une interruption en ouvre un
 * autre. Convention d'OmegaX, dite à l'écran · le Code ne définit pas la
 * continuité de service, et l'« employeur substitué » ne se lit sur aucun
 * contrat.
 */
export function serviceEnCours<C extends ContratDuService>(contrats: readonly C[]): { origine: Date; fin: Date | null; contrats: C[] } | null {
  if (contrats.length === 0) return null;
  const tries = [...contrats].sort((a, b) => a.dateEntreeEnVigueur.getTime() - b.dateEntreeEnVigueur.getTime());
  let groupe: C[] = [tries[0]];
  for (const c of tries.slice(1)) {
    const precedent = groupe[groupe.length - 1];
    const lendemain = precedent.dateFin ? precedent.dateFin.getTime() + 86_400_000 : null;
    const continu = c.renouvelleDeId === precedent.id || lendemain === null || c.dateEntreeEnVigueur.getTime() <= lendemain;
    groupe = continu ? [...groupe, c] : [c];
  }
  const dernier = groupe[groupe.length - 1];
  const finOuverte = groupe.some((c) => c.dateFin === null);
  return { origine: groupe[0].dateEntreeEnVigueur, fin: finOuverte ? null : dernier.dateFin, contrats: groupe };
}
