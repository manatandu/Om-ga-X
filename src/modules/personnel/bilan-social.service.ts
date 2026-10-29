import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import {
  datesDuBilanSocial,
  formulaireBilanSocial,
  motifRefusSaisie,
  normaliserSaisie,
  type SaisieBilanSocial,
} from './bilan-social';
import { LIBELLE_FORME } from './situation-main-oeuvre';

/**
 * LE BILAN SOCIAL DE L'ONEM, PAR EXERCICE (`bilan-social.ts`) · la saisie du
 * cabinet, l'identification et la proposition de la ligne 10 lues dans le
 * dossier. Une ligne par dossier et par exercice, retouchée par son
 * identifiant, au journal d'audit.
 */
@Injectable()
export class BilanSocialService {
  constructor(private readonly prisma: PrismaService) {}

  private exerciceLisible(exercice: number) {
    if (!Number.isInteger(exercice) || exercice < 2000 || exercice > 2100) throw new BadRequestException("L'exercice se lit sur quatre chiffres.");
  }

  async lire(tenantId: string, exercice: number) {
    this.exerciceLisible(exercice);
    const dates = datesDuBilanSocial(exercice);
    const auFin = new Date(`${dates.au}T00:00:00.000Z`);
    const [t, effectifActif, bulletins, saisie] = await Promise.all([
      this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { nom: true, numeroAffiliationCnssEmployeur: true, activite: true, referentiel: true, formeJuridique: true, formeJuridiqueSyscohada: true },
      }),
      // L'« effectif actif » · les salariés en vigueur au dernier jour de l'exercice, comptés une fois.
      this.prisma.salarie.count({
        where: { tenantId, contrats: { some: { tenantId, dateEntreeEnVigueur: { lte: auFin }, OR: [{ dateFin: null }, { dateFin: { gte: auFin } }] } } },
      }),
      // La proposition de la ligne 10 · une somme demandée à la base, bulletins émis non annulés de l'année.
      this.prisma.bulletinPaie.aggregate({
        where: { tenantId, statut: 'EMIS', moisDePaie: { startsWith: `${exercice}-` } },
        _sum: { totalVerseFc: true },
        _count: { _all: true },
      }),
      this.prisma.bilanSocial.findFirst({ where: { tenantId, exercice } }),
    ]);
    if (!t) throw new NotFoundException('Dossier introuvable.');
    const forme = t.referentiel === 'SYSCOHADA' ? t.formeJuridiqueSyscohada : t.formeJuridique;
    const total = bulletins._sum.totalVerseFc;
    return formulaireBilanSocial({
      exercice,
      identite: {
        nom: t.nom,
        numeroAffiliationCnssEmployeur: (t.numeroAffiliationCnssEmployeur ?? '').trim() || null,
        activite: (t.activite ?? '').trim() || null,
        formeJuridique: forme ? (LIBELLE_FORME[forme] ?? null) : null,
      },
      effectifActif,
      remunerationsProposees: bulletins._count._all > 0 && total !== null ? total.toFixed(2) : null,
      saisie: saisie ? { lignes: saisie.lignes as unknown as SaisieBilanSocial['lignes'], commentaire: saisie.commentaire } : null,
      enregistreLe: saisie ? saisie.enregistreLe.toISOString() : null,
      enregistrePar: saisie?.enregistrePar ?? null,
    });
  }

  async enregistrer(tenantId: string, auteur: string, exercice: number, corps: unknown) {
    this.exerciceLisible(exercice);
    const motif = motifRefusSaisie(corps);
    if (motif) throw new BadRequestException(motif);
    const saisie = normaliserSaisie(corps as SaisieBilanSocial);
    const donnees = {
      lignes: saisie.lignes as unknown as Prisma.InputJsonValue,
      commentaire: saisie.commentaire,
      enregistrePar: auteur,
      enregistreLe: new Date(),
    };
    try {
      const existant = await this.prisma.bilanSocial.findFirst({ where: { tenantId, exercice }, select: { id: true } });
      if (existant) await this.prisma.bilanSocial.update({ where: { id: existant.id }, data: donnees });
      else await this.prisma.bilanSocial.create({ data: { tenantId, exercice, ...donnees } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException("Le bilan social de cet exercice vient d'être enregistré par un autre poste · relisez-le avant de l'enregistrer à nouveau.");
      }
      throw e;
    }
    return this.lire(tenantId, exercice);
  }
}
