import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutBulletinPaie } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { declarationCnss, dernierJourDuMois, moisLisible, type BulletinDeclare } from './declaration-cnss';
import { classeurDeclarationCnss } from './declaration-cnss-excel';

/**
 * Au plus autant de bulletins lus pour un mois · au-delà la déclaration est
 * REFUSÉE, jamais préparée sur une partie (un total amputé serait une
 * déclaration minorée sous un chiffre plausible, § 8 bis). Même borne que la
 * proposition du paiement des salaires.
 */
export const PLAFOND_BULLETINS_DECLARATION = 2_000;

/** Voir `declaration-cnss.ts` · ce service lit, le moteur prépare. */
@Injectable()
export class DeclarationCnssService {
  constructor(private readonly prisma: PrismaService) {}

  async preparer(tenantId: string, mois: string) {
    if (!moisLisible(mois)) throw new BadRequestException('Le mois de la déclaration se lit AAAA-MM.');
    const dernier = new Date(`${dernierJourDuMois(mois)}T00:00:00.000Z`);
    const [tenant, total, bulletins, travailleurs] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { nom: true, numeroAffiliationCnssEmployeur: true, adresse: true, ville: true },
      }),
      this.prisma.bulletinPaie.count({ where: { tenantId, moisDePaie: mois, statut: StatutBulletinPaie.EMIS } }),
      this.prisma.bulletinPaie.findMany({
        where: { tenantId, moisDePaie: mois, statut: StatutBulletinPaie.EMIS },
        orderBy: { numero: 'asc' },
        take: PLAFOND_BULLETINS_DECLARATION,
        select: {
          numero: true,
          nature: true,
          nomComplet: true,
          matricule: true,
          emploi: true,
          categorieProfessionnelle: true,
          numeroAffiliationCnss: true,
          totalVerseFc: true,
          entree: true,
          calcul: true,
        },
      }),
      // Point 8 de l'art. 23 · les travailleurs OCCUPÉS au dernier jour, lus
      // au registre (un contrat en vigueur ce jour-là), jamais au nombre de
      // bulletins · un travailleur sorti dans le mois a un bulletin et n'est
      // plus occupé au dernier jour.
      this.prisma.salarie.count({
        where: {
          tenantId,
          contrats: { some: { tenantId, dateEntreeEnVigueur: { lte: dernier }, OR: [{ dateFin: null }, { dateFin: { gte: dernier } }] } },
        },
      }),
    ]);
    if (total > PLAFOND_BULLETINS_DECLARATION) {
      throw new BadRequestException(
        `${total} bulletins émis pour ${mois} · au-delà de ${PLAFOND_BULLETINS_DECLARATION}, OmegaX ne prépare pas la déclaration plutôt que de la préparer sur une partie.`,
      );
    }
    const lus: BulletinDeclare[] = bulletins.map((b) => ({
      numero: b.numero,
      nature: b.nature,
      nomComplet: b.nomComplet,
      matricule: b.matricule,
      emploi: b.emploi,
      categorieProfessionnelle: b.categorieProfessionnelle,
      numeroAffiliationCnss: b.numeroAffiliationCnss,
      totalVerseFc: Number(b.totalVerseFc),
      entree: b.entree,
      calcul: b.calcul,
    }));
    return declarationCnss({ mois, employeur: tenant, bulletins: lus, travailleursAuDernierJour: travailleurs });
  }

  async excel(tenantId: string, mois: string) {
    const d = await this.preparer(tenantId, mois);
    if (d.aucunBulletin) throw new BadRequestException(d.aucunBulletin);
    const buffer = await classeurDeclarationCnss(d);
    return { buffer, nomFichier: `declaration-cnss-${mois}.xlsx` };
  }
}
