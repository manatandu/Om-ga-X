import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClasseCompte, Prisma, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { moisEntre } from '../../common/mois-entre';
import { filtresDesTroisColonnes } from '../comptabilite/balance-trois-colonnes';
import { refuserSiExerciceBudgetaireClos } from './exercice-budgetaire-clos';
import { bornesDuMois } from './mois-de-l-exercice';
import {
  ligneDuBudget,
  moisDeLExercice,
  motifRefusCompteBudgetable,
  motifRefusMontantBudget,
  natureDuCompte,
  repartirSurLesMois,
  totauxDeLaNature,
  type LigneBudgetCompte,
} from './budget-compte';
import type { DoterBudgetCompteDto, ModifierBudgetCompteMoisDto } from './dto/budget-compte.dto';

/** Le doublon d'une clé unique, même enveloppé par la transaction. */
function estDoublon(e: unknown): boolean {
  for (let x: unknown = e, n = 0; x && n < 5; x = (x as { cause?: unknown }).cause, n++) {
    if (x instanceof Prisma.PrismaClientKnownRequestError && x.code === 'P2002') return true;
  }
  return false;
}

const CLASSES = [ClasseCompte.CLASSE_6, ClasseCompte.CLASSE_7];
const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * LIGNE ANALYTIQUE, FONCTION N° 51 · LES BUDGETS DES COMPTES GÉNÉRAUX. Les
 * règles sont dans `budget-compte.ts` ; ce service dote, retouche, retire, et
 * rend l'état réalisé / budget / N-1. Une STRUCTURE comme le budget des
 * sections · dotée par l'administrateur, lue par tous ; un exercice clôturé
 * ne change plus de budget (`refuserSiExerciceBudgetaireClos`, audit final
 * F143). Le budget ne touche à aucune écriture et n'entre dans aucun état
 * financier.
 */
@Injectable()
export class BudgetsComptesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Le compte et l'exercice d'une dotation, jugés · les mêmes refus pour doter, retoucher et retirer. */
  private async compteEtExercice(tenantId: string, compteId: string, exerciceId: string) {
    const [compte, exercice] = await Promise.all([
      this.prisma.compte.findFirst({
        where: { id: compteId, tenantId },
        select: { id: true, numero: true, intitule: true, classe: true, typeCompte: true },
      }),
      this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } }),
    ]);
    if (!compte) throw new NotFoundException('Compte introuvable dans ce dossier.');
    const refus = motifRefusCompteBudgetable({
      numero: compte.numero,
      classe: compte.classe,
      estTotal: compte.typeCompte === TypeCompteDetailTotal.TOTAL,
    });
    if (refus) throw new BadRequestException(refus);
    if (!exercice) throw new NotFoundException('Exercice introuvable dans ce dossier.');
    return { compte, exercice, mois: moisDeLExercice(exercice.dateDebut, exercice.dateFin), exerciceLong: moisEntre(exercice.dateDebut, exercice.dateFin) > 12 };
  }

  /** Sérialise les gestes sur le budget d'un même compte · la ligne du compte, sous verrou. */
  private async verrouillerCompte(tx: Prisma.TransactionClient, tenantId: string, compteId: string) {
    await tx.$queryRaw`SELECT "id" FROM "comptes" WHERE "id" = ${compteId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  }

  private conflit(e: unknown): never {
    if (estDoublon(e)) {
      throw new ConflictException('Le budget de ce compte vient d’être modifié par un autre geste · relisez-le.');
    }
    throw e;
  }

  async budget(tenantId: string, compteId: string, exerciceId: string) {
    const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId }, select: { id: true } });
    if (!compte) throw new NotFoundException('Compte introuvable dans ce dossier.');
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true } });
    if (!exercice) throw new NotFoundException('Exercice introuvable dans ce dossier.');
    const lignes = await this.prisma.budgetCompte.findMany({
      where: { tenantId, compteId, exerciceId },
      orderBy: { mois: 'asc' },
    });
    const annuelle = lignes.find((l) => l.mois === null);
    return {
      // `null` · le compte n'est pas doté · jamais un zéro qui se lirait « budgété à zéro ».
      annuel: annuelle ? Number(annuelle.montant) : null,
      mensuel: lignes.filter((l) => l.mois !== null).map((l) => ({ mois: l.mois as number, montant: Number(l.montant) })),
    };
  }

  /**
   * Dote un compte pour un exercice, répartie sur ses mois au centime, le
   * reliquat sur le dernier. Remplace la dotation qui y était. Sur un
   * exercice de plus de douze mois, l'annuel seul (audit final F39).
   */
  async doter(tenantId: string, compteId: string, dto: DoterBudgetCompteDto) {
    const refusMontant = motifRefusMontantBudget(dto.montantAnnuel);
    if (refusMontant) throw new BadRequestException(refusMontant);
    const { exercice, mois, exerciceLong } = await this.compteEtExercice(tenantId, compteId, dto.exerciceId);
    refuserSiExerciceBudgetaireClos(exercice.statut);
    const parts = repartirSurLesMois(dto.montantAnnuel, mois.length);
    try {
      await transactionJournalisee(this.prisma, async (tx) => {
        await this.verrouillerCompte(tx, tenantId, compteId);
        await tx.budgetCompte.deleteMany({ where: { tenantId, compteId, exerciceId: exercice.id } });
        await tx.budgetCompte.create({
          data: { tenantId, compteId, exerciceId: exercice.id, mois: null, montant: new Prisma.Decimal(dto.montantAnnuel.toFixed(2)) },
        });
        if (exerciceLong) return;
        await tx.budgetCompte.createMany({
          data: mois.map((m, i) => ({
            tenantId,
            compteId,
            exerciceId: exercice.id,
            mois: m,
            montant: new Prisma.Decimal(parts[i].toFixed(2)),
          })),
        });
      });
    } catch (e) {
      this.conflit(e);
    }
    return this.budget(tenantId, compteId, exercice.id);
  }

  /** Retouche d'un mois · l'annuel suit la somme des mois, dans la même transaction. */
  async modifierMois(tenantId: string, compteId: string, dto: ModifierBudgetCompteMoisDto) {
    const refusMontant = motifRefusMontantBudget(dto.montant);
    if (refusMontant) throw new BadRequestException(refusMontant);
    const { exercice, mois, exerciceLong } = await this.compteEtExercice(tenantId, compteId, dto.exerciceId);
    refuserSiExerciceBudgetaireClos(exercice.statut);
    if (exerciceLong) {
      throw new BadRequestException(
        "Sur un exercice de plus de douze mois, un même mois revient deux fois : le budget reste annuel et ne se retouche pas au mois (AUDCIF art. 7).",
      );
    }
    if (!mois.includes(dto.mois)) throw new BadRequestException(`Le mois ${dto.mois} n'est pas dans l'exercice.`);
    try {
      await transactionJournalisee(this.prisma, async (tx) => {
        await this.verrouillerCompte(tx, tenantId, compteId);
        const existants = await tx.budgetCompte.findMany({ where: { tenantId, compteId, exerciceId: exercice.id } });
        if (existants.length === 0) {
          throw new BadRequestException("Le compte n'est pas doté sur cet exercice · dotez d'abord l'année, puis retouchez un mois.");
        }
        const duMois = existants.find((b) => b.mois === dto.mois);
        if (duMois) {
          await tx.budgetCompte.update({ where: { id: duMois.id }, data: { montant: new Prisma.Decimal(dto.montant.toFixed(2)) } });
        } else {
          await tx.budgetCompte.create({
            data: { tenantId, compteId, exerciceId: exercice.id, mois: dto.mois, montant: new Prisma.Decimal(dto.montant.toFixed(2)) },
          });
        }
        // L'annuel est la somme des mois, en centimes · jamais une addition flottante.
        const centimes =
          existants.filter((b) => b.mois !== null && b.mois !== dto.mois).reduce((t, b) => t + Math.round(Number(b.montant) * 100), 0) +
          Math.round(dto.montant * 100);
        const annuelle = existants.find((b) => b.mois === null);
        const total = new Prisma.Decimal((centimes / 100).toFixed(2));
        if (annuelle) await tx.budgetCompte.update({ where: { id: annuelle.id }, data: { montant: total } });
        else await tx.budgetCompte.create({ data: { tenantId, compteId, exerciceId: exercice.id, mois: null, montant: total } });
      });
    } catch (e) {
      this.conflit(e);
    }
    return this.budget(tenantId, compteId, exercice.id);
  }

  /** Retire le budget du compte sur l'exercice · ses mouvements deviennent « hors budget ». */
  async retirer(tenantId: string, compteId: string, exerciceId: string) {
    const { exercice } = await this.compteEtExercice(tenantId, compteId, exerciceId);
    refuserSiExerciceBudgetaireClos(exercice.statut);
    const retire = await transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerCompte(tx, tenantId, compteId);
      return tx.budgetCompte.deleteMany({ where: { tenantId, compteId, exerciceId: exercice.id } });
    });
    return { retire: retire.count > 0 };
  }

  /**
   * L'ÉTAT · budget, réalisé et réalisé de l'exercice précédent, par compte,
   * sur l'exercice ou l'un de ses mois. Un compte y paraît s'il est doté ou
   * mouvementé, en N ou en N-1 ; sans budget, il est « hors budget ».
   */
  async etat(tenantId: string, params: { exerciceId: string; mois?: number }) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: params.exerciceId, tenantId } });
    if (!exercice) throw new NotFoundException('Exercice introuvable dans ce dossier.');
    let du = exercice.dateDebut;
    let au = exercice.dateFin;
    if (params.mois !== undefined) {
      if (moisEntre(exercice.dateDebut, exercice.dateFin) > 12) {
        throw new BadRequestException(
          "Sur un exercice de plus de douze mois, un même mois revient deux fois : le budget y est annuel, choisissez l'exercice entier.",
        );
      }
      if (!moisDeLExercice(exercice.dateDebut, exercice.dateFin).includes(params.mois)) {
        throw new BadRequestException(`Le mois ${params.mois} n'est pas dans l'exercice.`);
      }
      ({ debut: du, fin: au } = bornesDuMois(exercice.dateDebut, params.mois));
    }

    // L'EXERCICE PRÉCÉDENT est celui du dossier qui finit le plus tard avant
    // l'ouverture de celui-ci · lu de la même façon, au même mois de
    // calendrier quand un mois est choisi.
    const precedent = await this.prisma.exercice.findFirst({
      where: { tenantId, dateFin: { lt: exercice.dateDebut } },
      orderBy: { dateFin: 'desc' },
    });
    let n1: { du: Date; au: Date } | null = null;
    let motifN1: string | null = null;
    if (!precedent) {
      motifN1 = "Le dossier n'a pas d'exercice précédent.";
    } else if (params.mois === undefined) {
      n1 = { du: precedent.dateDebut, au: precedent.dateFin };
    } else if (moisEntre(precedent.dateDebut, precedent.dateFin) > 12) {
      motifN1 = "L'exercice précédent dure plus de douze mois · le même mois y revient deux fois, il n'est pas lu.";
    } else if (!moisDeLExercice(precedent.dateDebut, precedent.dateFin).includes(params.mois)) {
      motifN1 = "L'exercice précédent ne couvre pas ce mois.";
    } else {
      const b = bornesDuMois(precedent.dateDebut, params.mois);
      n1 = { du: b.debut, au: b.fin };
    }

    const realiseSur = (exerciceId: string, fenetre: { du: Date; au: Date }) => {
      // Les mouvements de l'exercice · ni l'écriture qui solde les comptes de
      // gestion (audit final F4), ni une écriture de situation, brouillard compris.
      const filtres = filtresDesTroisColonnes({ tenantId, exerciceId, date: { gte: fenetre.du, lte: fenetre.au } });
      return this.prisma.ligneEcriture.groupBy({
        by: ['compteId'],
        where: { ecriture: filtres.mouvements, compte: { tenantId, classe: { in: CLASSES } } },
        _sum: { debit: true, credit: true },
      });
    };

    const [budgets, realises, realisesN1] = await Promise.all([
      this.prisma.budgetCompte.findMany({ where: { tenantId, exerciceId: exercice.id, mois: params.mois ?? null } }),
      realiseSur(exercice.id, { du, au }),
      precedent && n1 ? realiseSur(precedent.id, n1) : Promise.resolve(null),
    ]);
    const ids = new Set<string>([...budgets.map((b) => b.compteId), ...realises.map((r) => r.compteId), ...(realisesN1 ?? []).map((r) => r.compteId)]);
    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, id: { in: [...ids] } },
      select: { id: true, numero: true, intitule: true, classe: true },
      orderBy: { numero: 'asc' },
    });
    const budgetDe = new Map(budgets.map((b) => [b.compteId, Number(b.montant)]));
    const sommes = (lus: typeof realises | null) =>
      new Map((lus ?? []).map((r) => [r.compteId, { debit: Number(r._sum.debit ?? 0), credit: Number(r._sum.credit ?? 0) }]));
    const n = sommes(realises);
    const p = sommes(realisesN1);

    const lignes: LigneBudgetCompte[] = [];
    for (const c of comptes) {
      const nature = natureDuCompte(c.classe);
      if (!nature) continue;
      const sens = (s?: { debit: number; credit: number }) => (s ? (nature === 'CHARGE' ? s.debit - s.credit : s.credit - s.debit) : 0);
      lignes.push(
        ligneDuBudget({
          compteId: c.id,
          numero: c.numero,
          intitule: c.intitule,
          nature,
          budget: budgetDe.has(c.id) ? (budgetDe.get(c.id) as number) : null,
          realise: sens(n.get(c.id)),
          realiseN1: realisesN1 === null ? null : sens(p.get(c.id)),
        }),
      );
    }
    const charges = totauxDeLaNature(lignes, 'CHARGE');
    const produits = totauxDeLaNature(lignes, 'PRODUIT');
    const ecartResultat = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 100) / 100);
    return {
      exercice: { id: exercice.id, dateDebut: jour(exercice.dateDebut), dateFin: jour(exercice.dateFin), statut: exercice.statut },
      periode: { du: jour(du), au: jour(au), mois: params.mois ?? null },
      exercicePrecedent: precedent && n1 ? { id: precedent.id, du: jour(n1.du), au: jour(n1.au) } : null,
      motifN1,
      lignes,
      totaux: {
        charges,
        produits,
        // Le résultat des activités ordinaires, produits moins charges.
        resultat: {
          budget: ecartResultat(produits.budget, charges.budget),
          realise: ecartResultat(produits.realise, charges.realise),
          realiseN1: ecartResultat(produits.realiseN1, charges.realiseN1),
        },
      },
    };
  }
}
