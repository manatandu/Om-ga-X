import { BadRequestException } from '@nestjs/common';
import { ClasseCompte, Prisma, SensVirementFonds, TypeCompteDetailTotal } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import { sousComptePropose } from '../comptes/subdivisions-du-plan';
import { COMPTE_DU_PLAN_585, COMPTES_DE_PASSAGE } from './virement-fonds';

type Client = PrismaService | Prisma.TransactionClient;

/**
 * LES QUATRE COMPTES DE PASSAGE D'UN DOSSIER, assurés · semés à la création du
 * dossier (`AuthService.register`), migrés pour les autres, et ouverts ici au
 * premier virement s'il en manque (numéro déjà pris par le cabinet à la
 * migration, lien retiré). Sous le 58500000 que les deux plans sèment, au rang
 * du sens quand il est libre, sinon au premier numéro libre sous la racine ·
 * personnalisés, avec le lettrage et le report du 58500000 (un sous-compte
 * fonctionne comme son compte du plan). Un dossier sans 58500000 n'en reçoit
 * aucun, et le refus le dit.
 */
export async function assurerComptesDePassage(
  client: Client,
  tenantId: string,
): Promise<Record<SensVirementFonds, { id: string; numero: string; intitule: string }>> {
  const liens = await client.compteVirementFonds.findMany({
    where: { tenantId },
    select: { sens: true, compte: { select: { id: true, numero: true, intitule: true } } },
  });
  const tenus = new Map(liens.map((l) => [l.sens, l.compte]));
  const manquants = (Object.keys(COMPTES_DE_PASSAGE) as SensVirementFonds[]).filter((s) => !tenus.has(s));
  if (manquants.length > 0) {
    const [dossier, parent] = await Promise.all([
      client.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true, longueurCompte: true } }),
      client.compte.findUnique({
        where: { tenantId_numero: { tenantId, numero: COMPTE_DU_PLAN_585 } },
        select: { lettrable: true, modeReportANouveau: true },
      }),
    ]);
    if (!parent) {
      throw new BadRequestException(
        `Le compte ${COMPTE_DU_PLAN_585} « Virements de fonds » manque au plan de ce dossier · ouvrez-le dans Plan comptable, ` +
          'les comptes de passage des virements naissent sous lui.',
      );
    }
    for (const sens of manquants) {
      const existants = (
        await client.compte.findMany({ where: { tenantId, numero: { startsWith: '585' } }, select: { numero: true } })
      ).map((c) => c.numero);
      const auRang = `5850000${COMPTES_DE_PASSAGE[sens].rang}`;
      const numero = existants.includes(auRang)
        ? sousComptePropose(dossier.referentiel, COMPTE_DU_PLAN_585, Math.max(8, dossier.longueurCompte), existants)
        : auRang;
      if (!numero) {
        throw new BadRequestException(
          `Plus aucun numéro libre sous le ${COMPTE_DU_PLAN_585} · allongez les numéros de compte (Structure > Paramètres du dossier).`,
        );
      }
      const compte = await client.compte.create({
        data: {
          tenantId,
          numero,
          intitule: COMPTES_DE_PASSAGE[sens].intitule,
          classe: ClasseCompte.CLASSE_5,
          typeCompte: TypeCompteDetailTotal.DETAIL,
          estRetenu: true,
          lettrable: parent.lettrable,
          modeReportANouveau: parent.modeReportANouveau,
        },
        select: { id: true, numero: true, intitule: true },
      });
      await client.compteVirementFonds.create({ data: { tenantId, sens, compteId: compte.id } });
      tenus.set(sens, compte);
    }
  }
  return Object.fromEntries([...tenus.entries()]) as Record<SensVirementFonds, { id: string; numero: string; intitule: string }>;
}
