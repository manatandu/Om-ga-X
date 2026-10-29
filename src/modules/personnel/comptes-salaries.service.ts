import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { prochainNumeroIndividuel, racineCollectif } from '../tiers/collectifs-tiers';
import { compteDuRole } from './passation-paie';
import { MOTIF_OPTION_ABSENTE, TRANCHE_OUVERTURE_COMPTES, intituleDuCompteSalarie } from './compte-salarie';

/**
 * OUVRIR LE COMPTE INDIVIDUEL D'UN SALARIÉ, dans la transaction donnée · sous
 * le verrou de la numérotation des comptes de tiers (même racine possible,
 * même famille de geste). Rend le compte, ou celui déjà ouvert.
 */
export async function ouvrirCompteSalarie(tx: Prisma.TransactionClient, tenantId: string, salarieId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`panoplie:${tenantId}`}))`;
  const [tenant, salarie] = await Promise.all([
    tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true, longueurCompte: true } }),
    tx.salarie.findFirst({
      where: { id: salarieId, tenantId },
      select: { id: true, nom: true, postNom: true, prenoms: true, matricule: true, compteId: true, compte: { select: { id: true, numero: true } } },
    }),
  ]);
  if (!salarie) throw new NotFoundException('Salarié introuvable dans ce dossier.');
  if (salarie.compte) return { ouvert: false, compte: salarie.compte };
  const numeroCollectif = compteDuRole('REMUNERATIONS_DUES', tenant.referentiel as Referentiel);
  const collectif = await tx.compte.findFirst({ where: { tenantId, numero: numeroCollectif } });
  if (!collectif || !collectif.estActif || collectif.typeCompte !== TypeCompteDetailTotal.DETAIL) {
    throw new BadRequestException(`Le compte ${numeroCollectif} (Personnel, rémunérations dues) n'est pas ouvert en imputation dans ce dossier · ouvrez-le au plan comptable.`);
  }
  const racine = racineCollectif(numeroCollectif);
  const existants = await tx.compte.findMany({ where: { tenantId, numero: { startsWith: racine } }, select: { numero: true } });
  const numero = prochainNumeroIndividuel(racine, tenant.longueurCompte, [numeroCollectif, ...existants.map((c) => c.numero)]);
  if (!numero) {
    throw new ConflictException(
      `Plus aucun numéro libre sous le ${numeroCollectif} à ${tenant.longueurCompte} chiffres · allongez les numéros de compte (Paramètres du dossier).`,
    );
  }
  const compte = await tx.compte.create({
    data: {
      tenantId,
      numero,
      intitule: intituleDuCompteSalarie(salarie),
      classe: collectif.classe,
      typeCompte: collectif.typeCompte,
      modeReportANouveau: collectif.modeReportANouveau,
      lettrable: collectif.lettrable,
      collectifId: collectif.id,
    },
    select: { id: true, numero: true },
  });
  // Une écriture unitaire, au journal d'audit · le salarié a été relu SOUS le
  // verrou, un second geste concurrent l'a donc trouvé avec son compte.
  await tx.salarie.update({ where: { id: salarie.id, tenantId }, data: { compteId: compte.id } });
  return { ouvert: true, compte };
}

/**
 * LIGNE PAIE-SUITE, FONCTION 76 · les comptes individuels des salariés ·
 * l'option, l'ouverture d'un compte et celle du registre par tranches.
 */
@Injectable()
export class ComptesSalariesService {
  constructor(private readonly prisma: PrismaService) {}

  private async exigerOption(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { comptesIndividuelsSalaries: true } });
    if (!t) throw new NotFoundException('Dossier introuvable.');
    if (!t.comptesIndividuelsSalaries) throw new BadRequestException(MOTIF_OPTION_ABSENTE);
  }

  async ouvrir(tenantId: string, salarieId: string) {
    await this.exigerOption(tenantId);
    return transactionJournalisee(this.prisma, (tx) => ouvrirCompteSalarie(tx, tenantId, salarieId));
  }

  /**
   * TOUT LE REGISTRE, PAR TRANCHES DE CENT · chaque appel ouvre les comptes
   * des cent premiers salariés qui n'en ont pas, et dit combien restent ·
   * jamais une transaction sans fin sur un grand registre.
   */
  async ouvrirTous(tenantId: string) {
    await this.exigerOption(tenantId);
    const sans = await this.prisma.salarie.findMany({
      where: { tenantId, compteId: null },
      orderBy: [{ nom: 'asc' }, { id: 'asc' }],
      take: TRANCHE_OUVERTURE_COMPTES,
      select: { id: true },
    });
    const ouverts = await transactionJournalisee(this.prisma, async (tx) => {
      let n = 0;
      for (const s of sans) if ((await ouvrirCompteSalarie(tx, tenantId, s.id)).ouvert) n++;
      return n;
    });
    const restent = await this.prisma.salarie.count({ where: { tenantId, compteId: null } });
    return { ouverts, restent };
  }

  async etat(tenantId: string) {
    const [t, avec, sans] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { comptesIndividuelsSalaries: true } }),
      this.prisma.salarie.count({ where: { tenantId, compteId: { not: null } } }),
      this.prisma.salarie.count({ where: { tenantId, compteId: null } }),
    ]);
    if (!t) throw new NotFoundException('Dossier introuvable.');
    return { option: t.comptesIndividuelsSalaries, avecCompte: avec, sansCompte: sans };
  }
}
