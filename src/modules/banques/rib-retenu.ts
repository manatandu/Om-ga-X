import type { PrismaService } from '../../common/prisma.service';

/**
 * Ce qui RETIENT un RIB · conditions, autorisations, unions, et ses chéquiers
 * (ligne microfina-m2, idée 9 · les souches d'un carnet font pièce). Le RIB (et la
 * banque qui les porte) ne se retire pas tant qu'elles tiennent · refus nommé
 * AVANT la base, dont la clé RESTRICT ne rendrait qu'une erreur anonyme.
 */
export async function motifRibRetenu(
  prisma: Pick<PrismaService, 'conditionBancaire' | 'autorisationFinancement' | 'elementUnionComptesBancaires' | 'chequier'>,
  tenantId: string,
  ribIds: string[],
): Promise<string | null> {
  if (ribIds.length === 0) return null;
  const [conditions, autorisations, unions, carnetsServis, carnetsVierges] = await Promise.all([
    prisma.conditionBancaire.count({ where: { tenantId, ribId: { in: ribIds } } }),
    prisma.autorisationFinancement.count({ where: { tenantId, ribId: { in: ribIds } } }),
    prisma.elementUnionComptesBancaires.count({ where: { tenantId, ribId: { in: ribIds } } }),
    prisma.chequier.count({ where: { tenantId, ribId: { in: ribIds }, cheques: { some: {} } } }),
    prisma.chequier.count({ where: { tenantId, ribId: { in: ribIds }, cheques: { none: {} } } }),
  ]);
  // CHAQUE USAGE NOMME SON ÉCRAN, ET NE PROMET PAS UN RETRAIT IMPOSSIBLE
  // (relecture m10) · un carnet qui a servi ne se retire plus (ses souches
  // font pièce, CPCC, ch. 1 § 1.1.1), et le message renvoyait aux conditions
  // bancaires pour le retirer.
  const structures = [
    conditions > 0 ? `${conditions} version(s) de conditions bancaires` : null,
    autorisations > 0 ? `${autorisations} autorisation(s) de financement` : null,
    unions > 0 ? `${unions} appartenance(s) à une union de comptes` : null,
  ].filter((x): x is string => x !== null);
  const phrases: string[] = [];
  if (structures.length > 0) phrases.push(`il porte ${structures.join(', ')} · retirez-les d'abord (Structure › Paramètres de saisie › Conditions bancaires)`);
  if (carnetsVierges > 0) phrases.push(`il porte ${carnetsVierges} chéquier(s) qui n'ont pas servi · retirez-les (Traitement › Tiers et trésorerie › Chèques émis)`);
  if (carnetsServis > 0) {
    phrases.push(
      `il porte ${carnetsServis} chéquier(s) qui ont servi, dont les souches font pièce · ils ne se retirent plus, et ce RIB reste tel quel ; pour cesser de l'employer, mettez son journal de banque en sommeil (Structure › Journaux)`,
    );
  }
  if (phrases.length === 0) return null;
  return `Le RIB est retenu · ${phrases.join(' ; ')}.`;
}
