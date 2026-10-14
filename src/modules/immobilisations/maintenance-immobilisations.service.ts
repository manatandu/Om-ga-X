import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Referentiel, StatutImmobilisation } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { exerciceDuDossierOuRefus } from '../../common/exercice-introuvable';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ImmobilisationService } from './immobilisation.service';
import { estCompteDeBien } from './compte-du-bien';
import { filtreLignesDeBienSansFiche } from './creation-depuis-ecritures.service';
import {
  FicheANumeroter,
  ParametresRenumerotation,
  motifRefusParametres,
  motifRefusPlan,
  numerosEnDouble,
  planDeRenumerotation,
  rapprocher,
} from './maintenance-immobilisations';

/** Au-delà, le dossier dépasse ce qu'un geste relit d'un coup · convention d'OmegaX, dite. */
const PLAFOND_FICHES = 50_000;
const PLAFOND_APERCU = 200;
const PLAFOND_NOMMES = 50;

type Db = Pick<PrismaService, 'immobilisation'>;

/**
 * RENUMÉROTATION ET MAINTENANCE DU REGISTRE (ligne sage-l4, fonction n° 73).
 * La renumérotation n'écrit que des numéros d'inventaire, une fiche à la fois
 * (journal d'audit), sous un verrou par dossier ; la maintenance lit et nomme.
 */
@Injectable()
export class MaintenanceImmobilisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly immobilisations: ImmobilisationService,
    private readonly ecritures: EcritureService,
  ) {}

  /** Ce que la renumérotation ferait · rien n'est écrit. */
  async apercuRenumerotation(tenantId: string, p: ParametresRenumerotation) {
    const refus = motifRefusParametres(p);
    if (refus) throw new BadRequestException(refus);
    const plan = planDeRenumerotation(await this.fichesANumeroter(this.prisma, tenantId), p);
    return {
      nombre: plan.nombre,
      aChanger: plan.attributions.length,
      attributions: plan.attributions.slice(0, PLAFOND_APERCU),
      tronque: plan.attributions.length > PLAFOND_APERCU,
      motifRefus: motifRefusPlan(plan, p),
    };
  }

  /**
   * La renumérotation · le plan est REJOUÉ sous le verrou du dossier, jamais
   * reçu de l'écran (un bien créé entre l'aperçu et la confirmation prend sa
   * place dans la suite). Une mise à jour UNITAIRE par fiche · le journal
   * d'audit garde l'ancien numéro de chacune.
   */
  async renumeroter(tenantId: string, p: ParametresRenumerotation) {
    const refus = motifRefusParametres(p);
    if (refus) throw new BadRequestException(refus);
    return transactionJournalisee(
      this.prisma,
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`renumerotation-immobilisations:${tenantId}`}))`;
        const plan = planDeRenumerotation(await this.fichesANumeroter(tx, tenantId), p);
        const motif = motifRefusPlan(plan, p);
        if (motif) throw new BadRequestException(motif);
        for (const a of plan.attributions) {
          await tx.immobilisation.update({ where: { id: a.id }, data: { numeroInventaire: a.nouveau } });
        }
        return { renumerotes: plan.attributions.length, inchanges: plan.nombre - plan.attributions.length };
      },
      // Une mise à jour journalisée par fiche, au plus `PLAFOND_RENUMEROTATION`.
      { timeout: 120_000 },
    );
  }

  /**
   * LA MAINTENANCE · le registre face à la balance, à la clôture de
   * l'exercice. Le registre est relu par le tableau des amortissements (le
   * même calcul que l'état et la dotation), jamais recalculé ici ; la balance
   * est celle de l'exercice, brouillard compris, comme les fiches qui
   * comptent aussi les acquisitions au brouillard.
   */
  async maintenance(tenantId: string, exerciceId: string) {
    const exercice = exerciceDuDossierOuRefus(
      await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true, dateFin: true } }),
    );
    const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    const [tableau, balance, fiches, sansFiche] = await Promise.all([
      this.immobilisations.tableauAmortissements(tenantId, exerciceId),
      this.ecritures.balance(tenantId, exerciceId),
      this.prisma.immobilisation.findMany({
        where: { tenantId },
        select: {
          id: true,
          designation: true,
          numeroInventaire: true,
          statut: true,
          compteAmortissement: { select: { numero: true, intitule: true } },
          // Un bien reclassé APRÈS la clôture figure au tableau sous son compte
          // actuel · nommé, son ancien compte dit.
          reclassements: {
            where: { dateReclassement: { gt: exercice.dateFin } },
            orderBy: { dateReclassement: 'asc' },
            take: 1,
            select: { dateReclassement: true, ancienCompteImmobilisation: { select: { numero: true } } },
          },
        },
        take: PLAFOND_FICHES + 1,
      }),
      this.prisma.ligneEcriture.groupBy({
        by: ['compteId'],
        where: filtreLignesDeBienSansFiche(tenantId, referentiel, { exerciceId }),
        _count: { _all: true },
        _sum: { debit: true },
      }),
    ]);
    if (fiches.length > PLAFOND_FICHES) {
      throw new BadRequestException(`Plus de ${PLAFOND_FICHES} fiches · la maintenance ne les relit pas d'un coup.`);
    }
    const parId = new Map(fiches.map((f) => [f.id, f]));

    // LE REGISTRE · les biens en place à la clôture (un bien sorti dans
    // l'exercice a quitté ses comptes par sa sortie). L'amortissement ne
    // compte que la dotation PASSÉE · celle que le tableau calcule sans
    // qu'elle soit au journal est dite à part, jamais lue comme un écart.
    const brut = new Map<string, { intitule: string; montant: number }>();
    const amortissement = new Map<string, { intitule: string; montant: number }>();
    let dotationsAPasser = 0;
    let biensAPasser = 0;
    const reclasses: { designation: string; date: string; ancienCompte: string; compteActuel: string }[] = [];
    for (const g of tableau.groupes) {
      for (const l of g.lignes) {
        if (l.sortiLe) continue;
        const ajouter = (m: Map<string, { intitule: string; montant: number }>, numero: string, intitule: string, montant: number) => {
          const v = m.get(numero) ?? { intitule, montant: 0 };
          v.montant += montant;
          m.set(numero, v);
        };
        ajouter(brut, g.numero, g.intitule, l.valeurBrute);
        const fiche = parId.get(l.id);
        const dotationPassee = l.dotationPassee ? l.dotation : 0;
        if (!l.dotationPassee && l.dotation > 0) {
          dotationsAPasser += l.dotation;
          biensAPasser += 1;
        }
        if (fiche) ajouter(amortissement, fiche.compteAmortissement.numero, fiche.compteAmortissement.intitule, l.cumulN - l.dotation + dotationPassee);
        const r = fiche?.reclassements[0];
        if (r) {
          reclasses.push({ designation: l.designation, date: r.dateReclassement.toISOString().slice(0, 10), ancienCompte: r.ancienCompteImmobilisation.numero, compteActuel: g.numero });
        }
      }
    }

    // LA BALANCE, dans le sens normal de chaque compte · débiteur pour le bien,
    // créditeur pour l'amortissement.
    const soldesBien = new Map<string, { intitule: string; solde: number }>();
    const soldesAmortissement = new Map<string, { intitule: string; solde: number }>();
    const comptesAmortissement = new Set([...amortissement.keys()]);
    for (const l of balance.lignes) {
      if (estCompteDeBien(referentiel as Referentiel, l.numero)) soldesBien.set(l.numero, { intitule: l.intitule, solde: l.solde });
      else if (l.numero.startsWith('28') || comptesAmortissement.has(l.numero)) {
        soldesAmortissement.set(l.numero, { intitule: l.intitule, solde: -l.solde });
      }
    }

    const numerosSansFiche = await this.prisma.compte.findMany({
      where: { tenantId, id: { in: sansFiche.map((s) => s.compteId) } },
      select: { id: true, numero: true },
    });
    const numeroDe = new Map(numerosSansFiche.map((c) => [c.id, c.numero]));
    const lignesSansFiche = new Map<string, { nombre: number; montant: number }>();
    for (const s of sansFiche) {
      const numero = numeroDe.get(s.compteId);
      if (!numero) continue;
      lignesSansFiche.set(numero, { nombre: s._count._all, montant: Number(s._sum.debit ?? 0) });
    }

    const doubles = numerosEnDouble(fiches);
    const enService = fiches.filter((f) => f.statut === StatutImmobilisation.EN_SERVICE);
    return {
      exercice: { id: exercice.id, dateFin: exercice.dateFin.toISOString().slice(0, 10) },
      comptesBien: rapprocher(brut, soldesBien).map((l) => ({
        ...l,
        lignesSansFiche: lignesSansFiche.get(l.numero) ?? { nombre: 0, montant: 0 },
      })),
      comptesAmortissement: rapprocher(amortissement, soldesAmortissement),
      dotationsAPasser: { nombre: biensAPasser, montant: Math.round(dotationsAPasser * 100) / 100 },
      reclassesApresLaCloture: reclasses.slice(0, PLAFOND_NOMMES),
      reclassesApresLaClotureTotal: reclasses.length,
      numerosEnDouble: doubles.slice(0, PLAFOND_NOMMES),
      numerosEnDoubleTotal: doubles.length,
      biensEnServiceSansNumero: enService.filter((f) => !(f.numeroInventaire ?? '').trim()).length,
    };
  }

  /** Toutes les fiches du dossier, ce que la renumérotation en lit · bornées, et le dépassement refusé. */
  private async fichesANumeroter(db: Db | Prisma.TransactionClient, tenantId: string): Promise<FicheANumeroter[]> {
    const lues = await db.immobilisation.findMany({
      where: { tenantId },
      select: {
        id: true,
        designation: true,
        numeroInventaire: true,
        dateAcquisition: true,
        createdAt: true,
        statut: true,
        compteImmobilisation: { select: { numero: true } },
      },
      take: PLAFOND_FICHES + 1,
    });
    if (lues.length > PLAFOND_FICHES) {
      throw new BadRequestException(`Plus de ${PLAFOND_FICHES} fiches · la renumérotation ne les relit pas d'un coup.`);
    }
    return lues.map((f) => ({
      id: f.id,
      designation: f.designation,
      numeroInventaire: f.numeroInventaire,
      dateAcquisition: f.dateAcquisition,
      createdAt: f.createdAt,
      sortie: f.statut !== StatutImmobilisation.EN_SERVICE,
      compteNumero: f.compteImmobilisation.numero,
    }));
  }
}
