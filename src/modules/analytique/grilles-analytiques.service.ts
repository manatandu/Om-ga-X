import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { motifGrilleInapplicable, motifRefusGrille } from './grille-analytique';
import type { PoserGrilleAnalytiqueDto } from './dto/grille-analytique.dto';
import { motifCompteHorsSaisie } from './compte-de-saisie';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';

/**
 * Lecture bornée (§ 8 bis du règlement) · une grille par compte et par plan,
 * un dossier en tient quelques centaines. Au-delà, la liste le dit et la
 * saisie ne propose que les grilles lues, ce qu'elle dit aussi.
 */
export const PLAFOND_GRILLES_LUES = 5_000;

/** Le doublon d'une clé unique, même enveloppé par la transaction. */
function estErreurPrisma(e: unknown, code: string): boolean {
  for (let x: unknown = e, n = 0; x && n < 5; x = (x as { cause?: unknown }).cause, n++) {
    if (x instanceof Prisma.PrismaClientKnownRequestError && x.code === code) return true;
  }
  return false;
}
const estDoublon = (e: unknown) => estErreurPrisma(e, 'P2002');
/** La ligne visée n'existe plus · même enveloppée par la transaction. */
export const estDisparue = (e: unknown) => estErreurPrisma(e, 'P2025');

const chiffreDeClasse = (classe: string) => classe.replace('CLASSE_', '');

/**
 * LIGNE ANALYTIQUE, FONCTION N° 48 · LES GRILLES ANALYTIQUES DES COMPTES. Les
 * règles sont dans `grille-analytique.ts` ; ce service lit, pose et retire.
 * La grille est une STRUCTURE du dossier, comme le plan analytique · elle se
 * pose par l'administrateur, se lit par tous, et ne touche à aucune écriture.
 */
@Injectable()
export class GrillesAnalytiquesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Toutes les grilles du dossier, chacune avec ce qui l'empêche aujourd'hui
   * de se proposer (`inapplicable`) · la saisie ne propose qu'une grille dont
   * le motif est nul, et l'écran des grilles dit les autres.
   */
  async lister(tenantId: string) {
    const [grilles, total] = await Promise.all([
      this.prisma.grilleAnalytique.findMany({
        where: { tenantId },
        orderBy: [{ compte: { numero: 'asc' } }, { plan: { code: 'asc' } }],
        take: PLAFOND_GRILLES_LUES,
        include: {
          compte: { select: { id: true, numero: true, intitule: true, classe: true, typeCompte: true, estActif: true } },
          plan: { select: { id: true, code: true, intitule: true, classesVentilees: true, estActif: true } },
          lignes: {
            orderBy: { rang: 'asc' },
            include: { section: { select: { id: true, planId: true, code: true, intitule: true, type: true, estActive: true } } },
          },
        },
      }),
      this.prisma.grilleAnalytique.count({ where: { tenantId } }),
    ]);
    return {
      grilles: grilles.map((g) => {
        const lignes = g.lignes.map((l) => ({
          sectionId: l.sectionId,
          code: l.section.code,
          intitule: l.section.intitule,
          pourcentage: Number(l.pourcentage),
        }));
        return {
          id: g.id,
          compte: { id: g.compte.id, numero: g.compte.numero, intitule: g.compte.intitule },
          plan: { id: g.plan.id, code: g.plan.code, intitule: g.plan.intitule },
          lignes,
          inapplicable: motifGrilleInapplicable({
            plan: g.plan,
            compte: {
              numero: g.compte.numero,
              classe: chiffreDeClasse(g.compte.classe),
              estTotal: g.compte.typeCompte === TypeCompteDetailTotal.TOTAL,
              estActif: g.compte.estActif,
            },
            sections: g.lignes.map((l) => ({
              id: l.section.id,
              planId: l.section.planId,
              code: l.section.code,
              estTotal: l.section.type === TypeCompteDetailTotal.TOTAL,
              estActive: l.section.estActive,
              pourcentage: Number(l.pourcentage),
            })),
          }),
          modifieeLe: g.updatedAt.toISOString(),
        };
      }),
      total,
      tronque: total > grilles.length,
    };
  }

  /**
   * Pose la grille d'un compte sur un plan, ou remplace celle qui y est. Tout
   * se juge AVANT d'écrire, sur la grille entière ; le remplacement retire
   * l'ancienne et crée la nouvelle dans UNE transaction, sous le verrou de la
   * ligne existante · deux poses concurrentes du même couple ne laissent
   * jamais deux grilles ni des lignes mêlées (la seconde reçoit un 409).
   */
  async poser(tenantId: string, userId: string, dto: PoserGrilleAnalytiqueDto) {
    const [compte, plan, sections] = await Promise.all([
      this.prisma.compte.findFirst({
        where: { id: dto.compteId, tenantId },
        select: { id: true, numero: true, classe: true, typeCompte: true, estActif: true },
      }),
      this.prisma.planAnalytique.findFirst({
        where: { id: dto.planId, tenantId },
        select: { id: true, code: true, classesVentilees: true, estActif: true },
      }),
      this.prisma.sectionAnalytique.findMany({
        where: { tenantId, id: { in: [...new Set(dto.lignes.map((l) => l.sectionId))] } },
        select: { id: true, planId: true, code: true, type: true, estActive: true },
      }),
    ]);
    const refus = motifRefusGrille({
      plan,
      compte: compte
        ? { numero: compte.numero, classe: chiffreDeClasse(compte.classe), estTotal: compte.typeCompte === TypeCompteDetailTotal.TOTAL }
        : null,
      sections: sections.map((s) => ({
        id: s.id,
        planId: s.planId,
        code: s.code,
        estTotal: s.type === TypeCompteDetailTotal.TOTAL,
        estActive: s.estActive,
      })),
      lignes: dto.lignes,
    });
    if (refus) throw new BadRequestException(refus);
    const horsSaisie = compte ? await motifCompteHorsSaisie(this.prisma, tenantId, compte, 'la grille') : null;
    if (horsSaisie) throw new BadRequestException(horsSaisie);

    try {
      await transactionJournalisee(this.prisma, async (tx) => {
        await prendreLeVerrouDuDossierBorne(tx, tenantId);
        const [avant] = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "grilles_analytiques"
          WHERE "tenantId" = ${tenantId} AND "compteId" = ${dto.compteId} AND "planId" = ${dto.planId}
          FOR UPDATE`;
        // La grille d'avant est retirée en entier, par une suppression
        // UNITAIRE (le journal d'audit en garde l'image, un `deleteMany` n'y
        // laisserait que son filtre), puis la nouvelle naît avec ses lignes ·
        // jamais une ligne retouchée seule.
        if (avant) await tx.grilleAnalytique.delete({ where: { id: avant.id } });
        await tx.grilleAnalytique.create({
          data: {
            tenantId,
            compteId: dto.compteId,
            planId: dto.planId,
            creePar: userId,
            lignes: {
              create: dto.lignes.map((l, rang) => ({
                tenantId,
                sectionId: l.sectionId,
                pourcentage: new Prisma.Decimal(l.pourcentage.toFixed(2)),
                rang,
              })),
            },
          },
        });
      });
    } catch (e) {
      if (estDoublon(e)) {
        throw new ConflictException('Une autre grille vient d’être posée sur ce compte et ce plan · relisez-la avant de la remplacer.');
      }
      throw e;
    }
    return this.lister(tenantId);
  }

  /** Retire la grille · rien d'autre ne bouge, aucune ventilation passée n'en dépendait. */
  async retirer(tenantId: string, grilleId: string) {
    const grille = await this.prisma.grilleAnalytique.findFirst({ where: { id: grilleId, tenantId }, select: { id: true } });
    if (!grille) throw new NotFoundException('Grille analytique introuvable dans ce dossier.');
    try {
      // Suppression UNITAIRE · le journal d'audit garde l'image de la grille.
      await transactionJournalisee(this.prisma, (tx) => tx.grilleAnalytique.delete({ where: { id: grille.id } }));
    } catch (e) {
      // Retirée ou remplacée entre la lecture et la suppression · dit, jamais une erreur technique.
      if (estDisparue(e)) {
        throw new ConflictException('La grille vient d’être retirée ou remplacée · relisez la liste.');
      }
      throw e;
    }
    return { retire: true };
  }
}
