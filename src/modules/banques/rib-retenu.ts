import type { PrismaService } from '../../common/prisma.service';

/**
 * Ce qui RETIENT un RIB · conditions, autorisations et unions. Le RIB (et la
 * banque qui les porte) ne se retire pas tant qu'elles tiennent · refus nommé
 * AVANT la base, dont la clé RESTRICT ne rendrait qu'une erreur anonyme.
 */
export async function motifRibRetenu(
  prisma: Pick<PrismaService, 'conditionBancaire' | 'autorisationFinancement' | 'elementUnionComptesBancaires'>,
  tenantId: string,
  ribIds: string[],
): Promise<string | null> {
  if (ribIds.length === 0) return null;
  const [conditions, autorisations, unions] = await Promise.all([
    prisma.conditionBancaire.count({ where: { tenantId, ribId: { in: ribIds } } }),
    prisma.autorisationFinancement.count({ where: { tenantId, ribId: { in: ribIds } } }),
    prisma.elementUnionComptesBancaires.count({ where: { tenantId, ribId: { in: ribIds } } }),
  ]);
  const usages = [
    conditions > 0 ? `${conditions} version(s) de conditions bancaires` : null,
    autorisations > 0 ? `${autorisations} autorisation(s) de financement` : null,
    unions > 0 ? `${unions} appartenance(s) à une union de comptes` : null,
  ].filter((x): x is string => x !== null);
  if (usages.length === 0) return null;
  return `Le RIB porte ${usages.join(', ')} · retirez-les d'abord (Structure › Paramètres de saisie › Conditions bancaires).`;
}
