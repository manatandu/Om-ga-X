import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
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
    // Le JSON gardé se rejuge à la lecture · une ligne altérée hors d'OmegaX se
    // dit, jamais une erreur anonyme ni un total qui l'omet.
    const motifStocke = saisie ? motifRefusSaisie({ lignes: saisie.lignes, commentaire: saisie.commentaire }) : null;
    if (motifStocke) throw new ConflictException(`Le bilan social enregistré pour ${exercice} est illisible · ${motifStocke}`);
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

  /**
   * `lu` · l'instant d'enregistrement que l'écran a lu (null s'il n'a rien lu
   * d'enregistré). Une saisie faite sur une version dépassée est refusée en
   * 409 · sans lui, le second poste écrasait le premier sans un mot.
   */
  async enregistrer(tenantId: string, auteur: string, exercice: number, corps: unknown) {
    this.exerciceLisible(exercice);
    const motif = motifRefusSaisie(corps);
    if (motif) throw new BadRequestException(motif);
    const luBrut = (corps as { lu?: unknown }).lu;
    if (luBrut !== null && luBrut !== undefined && (typeof luBrut !== 'string' || Number.isNaN(Date.parse(luBrut)))) {
      throw new BadRequestException("L'instant de la version lue est illisible.");
    }
    const lu = typeof luBrut === 'string' ? new Date(luBrut) : null;
    const DEPASSEE = new ConflictException("Le bilan social de cet exercice a été enregistré entre-temps par un autre poste · relisez-le avant de l'enregistrer à nouveau.");
    const saisie = normaliserSaisie(corps as SaisieBilanSocial);
    const donnees = {
      lignes: saisie.lignes as unknown as Prisma.InputJsonValue,
      commentaire: saisie.commentaire,
      enregistrePar: auteur,
      enregistreLe: new Date(),
    };
    try {
      await transactionJournalisee(this.prisma, async (tx) => {
        // La ligne verrouillée le temps de juger sa version, puis retouchée par
        // une mise à jour unitaire (le journal d'audit garde avant et après).
        const [existant] = await tx.$queryRaw<{ id: string; enregistreLe: Date }[]>`
          SELECT id, "enregistreLe" FROM "bilans_sociaux" WHERE "tenantId" = ${tenantId} AND exercice = ${exercice} FOR UPDATE`;
        if (existant) {
          if (!lu || existant.enregistreLe.getTime() !== lu.getTime()) throw DEPASSEE;
          await tx.bilanSocial.update({ where: { id: existant.id }, data: donnees });
        } else {
          if (lu) throw DEPASSEE;
          await tx.bilanSocial.create({ data: { tenantId, exercice, ...donnees } });
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw DEPASSEE;
      }
      throw e;
    }
    return this.lire(tenantId, exercice);
  }
}
