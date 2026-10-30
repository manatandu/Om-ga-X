import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { retirerLesLignesLibres } from '../comptabilite/lignes-libres';
import {
  NatureDerogatoire,
  NatureMouvementDepreciation,
  NatureRevisionPlan,
  NatureTraitementImmobilisation,
  Prisma,
  StatutEcriture,
  StatutExercice,
  StatutImmobilisation,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import {
  ActeDuBien,
  actesQuiEnDependent,
  etatDuPlanApres,
  ISSUE_ANNULER_SORTIE,
  ISSUE_ANNULER_SORTIE_UNITES,
  ISSUE_TRANSFERT_GROUPE,
  motifRefusAnnulation,
  motifRefusMotifAnnulation,
  NatureTraitement,
  rendreEcartImpute,
  RevisionLue,
  valeurResiduelleAvant,
} from './annulation-traitement';
import { AnnulerTraitementDto } from './dto/annulation-traitement.dto';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';

type Db = Prisma.TransactionClient | PrismaService;
const n = (d: unknown) => Number(d ?? 0);
const centimes = (x: number) => Math.round(x * 100) / 100;
// Le jour d'une date d'exercice (minuit UTC), à la française · « 31/12/2026 ».
const jour = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
const LIBELLE_NATURE: Record<NatureTraitement, string> = {
  DOTATION: 'dotation aux amortissements',
  DEPRECIATION: 'dépréciation',
  REVISION_PLAN: 'révision du plan',
  DEROGATOIRE: 'amortissement dérogatoire',
  REEVALUATION: 'réévaluation des immobilisations',
  REPRISE_SUBVENTION: 'reprise de subvention',
  REPRISE_PROVISION_REEVALUATION: 'reprise de la provision spéciale',
};
/** La plus longue liste d'actes qu'un écran ou un refus relit pour un bien · un bien en porte quelques dizaines. */
const PLAFOND_ACTES = 2000;
/** L'historique des annulations servi à l'écran · le total et `tronque` le disent au-delà. */
const PLAFOND_HISTORIQUE = 200;

/** Ce que l'annulation lit d'un traitement, quelle que soit sa table. */
interface Cible {
  nature: NatureTraitement;
  acteId: string;
  /** Le bien de l'acte d'annulation · nul pour une opération qui en porte plusieurs. */
  immobilisationId: string | null;
  /** Les biens que l'acte a touchés · leurs actes postérieurs se relisent tous. */
  biens: string[];
  exercice: { id: string; dateFin: Date; statut: StatutExercice };
  creeLe: Date;
  montant: number | null;
  ecritureId: string | null;
  libelle: string;
  /** L'enregistrement tel qu'il est, gardé par l'acte d'annulation. */
  acte: Record<string, unknown>;
  soldeDerogatoire?: boolean;
  repriseALaSortie?: boolean;
  transfertMiseEnService?: boolean;
  transfertGroupe?: boolean;
  /** Ligne immos, n° 65 · la reprise de dépréciation des unités sorties d'un lot. */
  cessionPartielle?: boolean;
  revisionDeReevaluation?: boolean;
}

/**
 * ANNULER UNE DOTATION OU UN TRAITEMENT D'IMMOBILISATION · voir
 * `annulation-traitement.ts` pour le texte et le modèle. Ce service lit, sous
 * une transaction, le traitement, les actes postérieurs des biens qu'il a
 * touchés et l'état de son écriture, puis · au brouillard la retire, validée
 * l'inscrit en négatif (`inscrireEnNegatifPourAnnulation`) · rétablit sur la
 * fiche ce que le traitement y avait changé, garde l'acte d'annulation et
 * retire l'enregistrement de sa table.
 */
@Injectable()
export class AnnulationTraitementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lecture · les traitements d'un bien, et ce qui empêche de les annuler
  // ---------------------------------------------------------------------------

  /**
   * LES TRAITEMENTS D'UN BIEN, les plus récents d'abord, chacun avec son
   * écriture et le motif qui en refuse l'annulation (ou `null`). Le motif est
   * celui que l'annulation rendrait · une seule règle, `motifRefusAnnulation`,
   * pour l'écran et pour le geste.
   */
  async traitementsDuBien(tenantId: string, immobilisationId: string) {
    const bien = await this.prisma.immobilisation.findFirst({ where: { id: immobilisationId, tenantId }, select: { id: true } });
    if (!bien) throw new NotFoundException('Immobilisation introuvable pour ce dossier.');
    const cibles = await this.ciblesDuBien(this.prisma, tenantId, immobilisationId);
    // UNE LECTURE PAR ENSEMBLE DE BIENS ET UNE POUR LES ÉCRITURES (relecture
    // de la ligne, performance) · les traitements d'un bien portent presque
    // tous ce seul bien, et chaque traitement relisait ses actes et son
    // écriture · une vingtaine de requêtes par ligne de l'onglet.
    const actesParBiens = new Map<string, Promise<ActeDuBien[]>>();
    const actesDe = (biens: string[]) => {
      const cle = [...biens].sort().join('|');
      if (!actesParBiens.has(cle)) actesParBiens.set(cle, this.actesDesBiens(this.prisma, tenantId, biens));
      return actesParBiens.get(cle)!;
    };
    const idsEcritures = [...new Set(cibles.map((c) => c.ecritureId).filter((x): x is string => !!x))];
    const ecritures = new Map(
      (idsEcritures.length === 0
        ? []
        : await this.prisma.ecriture.findMany({
            where: { tenantId, id: { in: idsEcritures } },
            select: { id: true, numeroPiece: true, statut: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
          })
      ).map((e) => [e.id, e]),
    );
    const resultat = [];
    for (const c of cibles) {
      const actes = await actesDe(c.biens);
      const ecriture = c.ecritureId ? (ecritures.get(c.ecritureId) ?? null) : null;
      const motif =
        this.motifPour(c, actes) ??
        (ecriture && ecriture.statut !== StatutEcriture.BROUILLARD
          ? motifLignesTenues(ecriture.lignes, `l'écriture n° ${ecriture.numeroPiece ?? '·'}`, 'annuler', ', puis annulez le traitement')
          : null);
      resultat.push({
        nature: c.nature,
        acteId: c.acteId,
        libelle: c.libelle,
        exercice: { id: c.exercice.id, dateFin: c.exercice.dateFin, statut: c.exercice.statut },
        enregistreLe: c.creeLe,
        montant: c.montant,
        ecriture: ecriture ? { id: ecriture.id, numeroPiece: ecriture.numeroPiece, statut: ecriture.statut } : null,
        portePlusieursBiens: c.immobilisationId === null,
        motifRefus: motif,
      });
    }
    resultat.sort((a, b) => b.exercice.dateFin.getTime() - a.exercice.dateFin.getTime() || b.enregistreLe.getTime() - a.enregistreLe.getTime());
    return { traitements: resultat };
  }

  /**
   * L'HISTORIQUE DES ANNULATIONS, les plus récentes d'abord · d'un bien (avec
   * les opérations à plusieurs biens qui le nommaient) ou du dossier. Borné,
   * le total et `tronque` le disent (§ 8 bis).
   */
  async annulations(tenantId: string, immobilisationId?: string) {
    const filtre: Prisma.AnnulationTraitementImmobilisationWhereInput = immobilisationId
      ? {
          OR: [
            { immobilisationId },
            // L'opération à plusieurs biens garde la liste de ses biens dans son acte.
            { immobilisationId: null, acte: { path: ['biens'], array_contains: [immobilisationId] } },
          ],
        }
      : {};
    const [lignes, total] = await Promise.all([
      this.prisma.annulationTraitementImmobilisation.findMany({
        where: { tenantId, ...filtre },
        orderBy: { annuleeLe: 'desc' },
        take: PLAFOND_HISTORIQUE,
        include: {
          immobilisation: { select: { id: true, designation: true } },
          exercice: { select: { id: true, dateFin: true } },
          ecritureNegatif: { select: { id: true, numeroPiece: true, date: true } },
        },
      }),
      this.prisma.annulationTraitementImmobilisation.count({ where: { tenantId, ...filtre } }),
    ]);
    return {
      total,
      tronque: total > lignes.length,
      annulations: lignes.map((a) => ({
        id: a.id,
        nature: a.nature,
        libelle: (a.acte as { libelle?: string } | null)?.libelle ?? LIBELLE_NATURE[a.nature as NatureTraitement],
        immobilisation: a.immobilisation,
        exercice: a.exercice,
        montant: a.montant === null ? null : n(a.montant),
        motif: a.motif,
        traitement: a.traitement,
        numeroPieceOrigine: a.numeroPieceOrigine,
        negatif: a.ecritureNegatif,
        annuleeLe: a.annuleeLe,
        annuleePar: a.annuleePar,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Le geste
  // ---------------------------------------------------------------------------

  async annuler(tenantId: string, userId: string, dto: AnnulerTraitementDto) {
    const refusMotif = motifRefusMotifAnnulation(dto.motif);
    if (refusMotif) throw new BadRequestException(refusMotif);
    const motif = dto.motif.trim();
    // Lu une première fois hors de la transaction pour refuser tôt, avec le
    // même motif que l'écran ; relu dedans, où tout se décide.
    const avant = await this.cible(this.prisma, tenantId, dto.nature, dto.acteId);
    const refus = this.motifPour(avant, await this.actesDesBiens(this.prisma, tenantId, avant.biens));
    if (refus) throw new BadRequestException(refus);

    return transactionJournalisee(this.prisma, async (tx) => {
      const c = await this.cible(tx, tenantId, dto.nature, dto.acteId);
      // LE VERROU DES FICHES (relecture de la ligne sage-l4) · le même que
      // prend `passerDotation` avant d'enregistrer · une dotation calculée
      // pendant l'annulation se relit après elle, et l'acte suivant qu'elle
      // aurait posé est vu ici avant de juger.
      if (c.biens.length > 0) {
        const ids = [...c.biens].sort();
        await prendreLeVerrouDuDossierBorne(tx, tenantId);
        await tx.$queryRaw`SELECT id FROM "immobilisations" WHERE "tenantId" = ${tenantId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      }
      const refusDansTx = this.motifPour(c, await this.actesDesBiens(tx, tenantId, c.biens));
      if (refusDansTx) throw new BadRequestException(refusDansTx);

      // L'ÉCRITURE · relue DANS la transaction (statut et lettrage), comme
      // l'annulation d'une revue de créance douteuse (M1) · validée
      // entre-temps, elle s'inscrit en négatif au lieu d'être supprimée.
      let traitement: 'SUPPRIMEE' | 'INSCRITE_EN_NEGATIF' | 'SANS_ECRITURE' = 'SANS_ECRITURE';
      let numeroPieceOrigine: number | null = null;
      let negatif: { id: string; numeroPiece: number | null; date: Date } | null = null;
      if (c.ecritureId) {
        const e = await tx.ecriture.findFirst({
          where: { id: c.ecritureId, tenantId },
          select: { id: true, statut: true, numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
        });
        if (!e) throw new ConflictException("L'écriture de ce traitement n'existe plus · relisez la fiche du bien avant d'annuler.");
        numeroPieceOrigine = e.numeroPiece;
        const tenues = motifLignesTenues(e.lignes, `l'écriture n° ${e.numeroPiece ?? '·'}`, 'annuler', ', puis annulez le traitement');
        if (tenues) throw new BadRequestException(tenues);
        if (e.statut === StatutEcriture.BROUILLARD) {
          traitement = 'SUPPRIMEE';
        } else {
          traitement = 'INSCRITE_EN_NEGATIF';
          negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
        }
      }

      // CE QUE LE TRAITEMENT AVAIT CHANGÉ HORS DE SA TABLE, rétabli.
      const retabli = await this.retablir(tx, tenantId, c);

      await tx.annulationTraitementImmobilisation.create({
        data: {
          tenantId,
          nature: c.nature as NatureTraitementImmobilisation,
          immobilisationId: c.immobilisationId,
          exerciceId: c.exercice.id,
          acteId: c.acteId,
          acte: { ...c.acte, libelle: c.libelle, biens: c.biens, retabli } as Prisma.InputJsonValue,
          montant: c.montant,
          motif,
          traitement,
          numeroPieceOrigine,
          ecritureOrigineId: traitement === 'INSCRITE_EN_NEGATIF' ? c.ecritureId : null,
          ecritureNegatifId: negatif?.id ?? null,
          annuleePar: userId,
        },
      });

      await this.retirerLActe(tx, tenantId, c);

      if (traitement === 'SUPPRIMEE' && c.ecritureId) {
        // Une et une seule, ENCORE au brouillard, sinon rien ne part (409).
        await retirerLesLignesLibres(tx, tenantId, c.ecritureId, { statut: StatutEcriture.BROUILLARD }, { laisserNommerLEcriture: true });
        const r = await tx.ecriture.deleteMany({ where: { id: c.ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
        if (r.count !== 1) {
          throw new ConflictException(
            "L'écriture a été validée ou retirée pendant l'annulation · rien n'est supprimé. Relancez l'annulation · validée, elle " +
              "s'inscrira en négatif (AUDCIF art. 20, al. 2).",
          );
        }
      }
      return {
        annule: true,
        nature: c.nature,
        traitement,
        numeroPieceOrigine,
        negatif: negatif ? { id: negatif.id, numeroPiece: negatif.numeroPiece, date: jour(negatif.date) } : null,
        retabli,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Les règles appliquées à une cible
  // ---------------------------------------------------------------------------

  private motifPour(c: Cible, actes: ActeDuBien[]): string | null {
    const dependants = actesQuiEnDependent(
      {
        nature: c.nature,
        id: c.acteId,
        exerciceFin: c.exercice.dateFin,
        creeLe: c.creeLe,
        libelle: c.libelle,
        soldeDerogatoire: c.soldeDerogatoire,
        repriseALaSortie: c.repriseALaSortie,
      },
      // La révision qu'une réévaluation a posée part avec elle · elle n'en
      // dépend pas, elle en fait partie.
      c.nature === 'REEVALUATION' ? actes.filter((a) => !(a.nature === 'REVISION_PLAN' && (c.acte.revisionsPosees as string[] | undefined)?.includes(a.id))) : actes,
    );
    return motifRefusAnnulation({
      exerciceClos: c.exercice.statut === StatutExercice.CLOTURE,
      transfertMiseEnService: c.transfertMiseEnService,
      transfertGroupe: c.transfertGroupe,
      cessionPartielle: c.cessionPartielle,
      revisionDeReevaluation: c.revisionDeReevaluation,
      dependants,
    });
  }

  // ---------------------------------------------------------------------------
  // Lecture d'une cible, par nature
  // ---------------------------------------------------------------------------

  private async cible(db: Db, tenantId: string, nature: NatureTraitement, acteId: string): Promise<Cible> {
    const introuvable = () =>
      new NotFoundException(`Ce traitement (${LIBELLE_NATURE[nature]}) n'existe pas dans ce dossier, ou il a déjà été annulé.`);
    switch (nature) {
      case 'DOTATION': {
        const d = await db.dotationAmortissement.findFirst({
          where: { id: acteId, immobilisation: { tenantId } },
          include: { exercice: true, immobilisation: { select: { designation: true } } },
        });
        if (!d) throw introuvable();
        // La dotation complémentaire d'un transfert dans le groupe porte la
        // pièce du transfert · l'annuler seule retirerait la pièce de sortie
        // du bien, et la liaison du siège resterait sans son reflet.
        const duTransfert = d.ecritureId
          ? !!(await db.transfertImmobilisationGroupe.findFirst({ where: { tenantId, ecritureId: d.ecritureId }, select: { id: true } }))
          : false;
        return {
          nature,
          acteId,
          immobilisationId: d.immobilisationId,
          biens: [d.immobilisationId],
          exercice: d.exercice,
          creeLe: d.createdAt,
          montant: n(d.montant),
          ecritureId: d.ecritureId,
          transfertGroupe: duTransfert,
          libelle: `Dotation de l'exercice clos le ${jour(d.exercice.dateFin)}`,
          acte: { id: d.id, immobilisationId: d.immobilisationId, exerciceId: d.exerciceId, montant: n(d.montant), ecritureId: d.ecritureId, createdAt: d.createdAt },
        };
      }
      case 'DEPRECIATION': {
        const d = await db.depreciationImmobilisation.findFirst({
          where: { id: acteId, immobilisation: { tenantId } },
          include: { exercice: true },
        });
        if (!d) throw introuvable();
        return {
          nature,
          acteId,
          immobilisationId: d.immobilisationId,
          biens: [d.immobilisationId],
          exercice: d.exercice,
          creeLe: d.createdAt,
          montant: n(d.montant),
          ecritureId: d.ecritureId,
          libelle: `${d.sens === 'DOTATION' ? 'Dépréciation' : 'Reprise de dépréciation'} de l'exercice clos le ${jour(d.exercice.dateFin)}`,
          transfertMiseEnService:
            d.nature === NatureMouvementDepreciation.TRANSFERT_REPRISE || d.nature === NatureMouvementDepreciation.TRANSFERT_DOTATION,
          transfertGroupe: d.nature === NatureMouvementDepreciation.TRANSFERT_GROUPE,
          cessionPartielle: d.nature === NatureMouvementDepreciation.CESSION_PARTIELLE,
          acte: {
            id: d.id,
            immobilisationId: d.immobilisationId,
            exerciceId: d.exerciceId,
            sens: d.sens,
            nature: d.nature,
            montant: n(d.montant),
            montantImputeEcart: n(d.montantImputeEcart),
            compteDepreciationId: d.compteDepreciationId,
            compteContrepartieId: d.compteContrepartieId,
            indice: d.indice,
            ecritureId: d.ecritureId,
            createdAt: d.createdAt,
            createdBy: d.createdBy,
          },
        };
      }
      case 'REVISION_PLAN': {
        const r = await db.revisionPlanAmortissement.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
        if (!r) throw introuvable();
        const deReevaluation = posteeParUneReevaluation(r);
        return {
          nature,
          acteId,
          immobilisationId: r.immobilisationId,
          biens: [r.immobilisationId],
          exercice: r.exercice,
          creeLe: r.createdAt,
          montant: r.montantReprise === null ? null : n(r.montantReprise),
          ecritureId: r.ecritureId,
          libelle: `Révision ${r.nature === NatureRevisionPlan.PROSPECTIVE ? 'prospective' : 'rétroactive'} du plan du ${jour(r.dateDecision)}`,
          revisionDeReevaluation: deReevaluation,
          acte: {
            id: r.id,
            immobilisationId: r.immobilisationId,
            exerciceId: r.exerciceId,
            nature: r.nature,
            dateDecision: r.dateDecision,
            dureeAvantAns: r.dureeAvantAns,
            dureeApresAns: r.dureeApresAns,
            motif: r.motif,
            montantReprise: r.montantReprise === null ? null : n(r.montantReprise),
            ecritureId: r.ecritureId,
            createdAt: r.createdAt,
            createdBy: r.createdBy,
          },
        };
      }
      case 'DEROGATOIRE': {
        const d = await db.amortissementDerogatoire.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
        if (!d) throw introuvable();
        const solde = d.nature === NatureDerogatoire.SOLDE_SORTIE;
        return {
          nature,
          acteId,
          immobilisationId: d.immobilisationId,
          biens: [d.immobilisationId],
          exercice: d.exercice,
          creeLe: d.createdAt,
          montant: centimes(n(d.dotation) - n(d.reprise)),
          ecritureId: d.ecritureId,
          libelle: solde
            ? `Reprise du solde du dérogatoire, exercice clos le ${jour(d.exercice.dateFin)}`
            : `Dérogatoire de l'exercice clos le ${jour(d.exercice.dateFin)}`,
          soldeDerogatoire: solde,
          acte: {
            id: d.id,
            immobilisationId: d.immobilisationId,
            exerciceId: d.exerciceId,
            nature: d.nature,
            annuiteFiscale: n(d.annuiteFiscale),
            dotationComptable: n(d.dotationComptable),
            dotation: n(d.dotation),
            reprise: n(d.reprise),
            excedentAReintegrer: n(d.excedentAReintegrer),
            ecritureId: d.ecritureId,
            createdAt: d.createdAt,
          },
        };
      }
      case 'REEVALUATION': {
        const r = await db.reevaluationBilan.findFirst({
          where: { id: acteId, tenantId },
          include: { exercice: true, lignes: { take: PLAFOND_ACTES } },
        });
        if (!r) throw introuvable();
        const revisionsPosees = await this.revisionsPoseesPar(db, tenantId, r);
        return {
          nature,
          acteId,
          immobilisationId: null,
          // Les seuls biens que l'opération a changés (écart positif, la même
          // borne que le rétablissement) · un bien recensé sans écart (terrain
          // à k' = 1, bien amorti) ne la bloque pas par ses actes suivants.
          biens: [...new Set(r.lignes.filter((l) => n(l.ecart) > 0.004).map((l) => l.immobilisationId))],
          exercice: r.exercice,
          creeLe: r.createdAt,
          montant: n(r.totalEcart),
          ecritureId: r.ecritureId,
          libelle: `Réévaluation ${r.type === 'LEGALE' ? 'légale' : 'libre'} du ${jour(r.dateReevaluation)}`,
          acte: {
            id: r.id,
            exerciceId: r.exerciceId,
            type: r.type,
            methodeLibre: r.methodeLibre,
            neutraliteFiscale: r.neutraliteFiscale,
            dateReevaluation: r.dateReevaluation,
            decision: r.decision,
            traitementFiscal: r.traitementFiscal,
            methodeEvaluation: r.methodeEvaluation,
            categories: r.categories,
            totalEcart: n(r.totalEcart),
            ecritureId: r.ecritureId,
            createdAt: r.createdAt,
            createdBy: r.createdBy,
            revisionsPosees,
            lignes: r.lignes.map((l) => ({
              id: l.id,
              immobilisationId: l.immobilisationId,
              categorie: l.categorie,
              coefficient: l.coefficient === null ? null : n(l.coefficient),
              valeurActuelle: l.valeurActuelle === null ? null : n(l.valeurActuelle),
              coefficientRetenu: n(l.coefficientRetenu),
              brutAvant: n(l.brutAvant),
              amortissementsAvant: n(l.amortissementsAvant),
              valeurNetteAvant: n(l.valeurNetteAvant),
              brutApres: n(l.brutApres),
              amortissementsApres: n(l.amortissementsApres),
              valeurReevaluee: n(l.valeurReevaluee),
              ecart: n(l.ecart),
              compteEcart: l.compteEcart,
              droitDeReprise: l.droitDeReprise,
              motifNonReevalue: l.motifNonReevalue,
              provisionReprise: n(l.provisionReprise),
              ecartImpute: n(l.ecartImpute),
              ecartTransfere: n(l.ecartTransfere),
              valeurResiduelleAvant: l.valeurResiduelleAvant === null ? null : n(l.valeurResiduelleAvant),
            })),
          },
        };
      }
      case 'REPRISE_SUBVENTION': {
        const r = await db.repriseSubventionImmobilisation.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
        if (!r) throw introuvable();
        return {
          nature,
          acteId,
          immobilisationId: r.immobilisationId,
          biens: [r.immobilisationId],
          exercice: r.exercice,
          creeLe: r.createdAt,
          montant: n(r.montant),
          ecritureId: r.ecritureId,
          libelle: `Reprise de subvention${r.nature === 'SORTIE' ? ' à la sortie' : ''}, exercice clos le ${jour(r.exercice.dateFin)}`,
          repriseALaSortie: r.nature === 'SORTIE',
          acte: { id: r.id, immobilisationId: r.immobilisationId, exerciceId: r.exerciceId, nature: r.nature, montant: n(r.montant), ecritureId: r.ecritureId, createdAt: r.createdAt, createdBy: r.createdBy },
        };
      }
      case 'REPRISE_PROVISION_REEVALUATION': {
        const r = await db.repriseProvisionReevaluation.findFirst({ where: { id: acteId, tenantId }, include: { exercice: true } });
        if (!r) throw introuvable();
        const detail = lireDetailReprise(r.detail);
        return {
          nature,
          acteId,
          immobilisationId: null,
          biens: [...new Set(detail.map((x) => x.immobilisationId))],
          exercice: r.exercice,
          creeLe: r.createdAt,
          montant: n(r.montant),
          ecritureId: r.ecritureId,
          libelle: `Reprise de la provision spéciale, exercice clos le ${jour(r.exercice.dateFin)}`,
          acte: { id: r.id, exerciceId: r.exerciceId, montant: n(r.montant), detail: r.detail, ecritureId: r.ecritureId, createdAt: r.createdAt, createdBy: r.createdBy },
        };
      }
    }
  }

  /** Les cibles d'un bien, toutes natures confondues. */
  private async ciblesDuBien(db: Db, tenantId: string, id: string): Promise<Cible[]> {
    const [dotations, depreciations, revisions, derogatoires, lignesReev, reprises, reprisesProvision] = await Promise.all([
      db.dotationAmortissement.findMany({ where: { immobilisationId: id, immobilisation: { tenantId } }, select: { id: true }, take: PLAFOND_ACTES }),
      db.depreciationImmobilisation.findMany({ where: { immobilisationId: id, immobilisation: { tenantId } }, select: { id: true }, take: PLAFOND_ACTES }),
      db.revisionPlanAmortissement.findMany({ where: { tenantId, immobilisationId: id }, select: { id: true }, take: PLAFOND_ACTES }),
      db.amortissementDerogatoire.findMany({ where: { tenantId, immobilisationId: id }, select: { id: true }, take: PLAFOND_ACTES }),
      db.ligneReevaluationBilan.findMany({ where: { tenantId, immobilisationId: id }, select: { reevaluationId: true }, take: PLAFOND_ACTES }),
      db.repriseSubventionImmobilisation.findMany({ where: { tenantId, immobilisationId: id }, select: { id: true }, take: PLAFOND_ACTES }),
      db.repriseProvisionReevaluation.findMany({ where: { tenantId }, select: { id: true, detail: true }, take: PLAFOND_ACTES }),
    ]);
    const demandes: Array<[NatureTraitement, string]> = [
      ...dotations.map((x) => ['DOTATION', x.id] as [NatureTraitement, string]),
      ...depreciations.map((x) => ['DEPRECIATION', x.id] as [NatureTraitement, string]),
      ...revisions.map((x) => ['REVISION_PLAN', x.id] as [NatureTraitement, string]),
      ...derogatoires.map((x) => ['DEROGATOIRE', x.id] as [NatureTraitement, string]),
      ...[...new Set(lignesReev.map((l) => l.reevaluationId))].map((r) => ['REEVALUATION', r] as [NatureTraitement, string]),
      ...reprises.map((x) => ['REPRISE_SUBVENTION', x.id] as [NatureTraitement, string]),
      ...reprisesProvision
        .filter((r) => lireDetailReprise(r.detail).some((d) => d.immobilisationId === id))
        .map((x) => ['REPRISE_PROVISION_REEVALUATION', x.id] as [NatureTraitement, string]),
    ];
    const cibles: Cible[] = [];
    for (const [nature, acteId] of demandes) cibles.push(await this.cible(db, tenantId, nature, acteId));
    return cibles;
  }

  /**
   * TOUS LES ACTES DES BIENS · les traitements et les gestes qui ne
   * s'annulent pas, chacun daté par la fin de son exercice et l'instant de
   * son enregistrement. Le refus les relit pour dire lequel dépend de la
   * cible (`actesQuiEnDependent`).
   */
  /**
   * Les actes des biens, lus aussi par l'annulation d'une sortie (ligne
   * restes-immos-budgets, point 3) · une seule lecture de ce qui a suivi.
   */
  async actesDesBiens(db: Db, tenantId: string, ids: string[]): Promise<ActeDuBien[]> {
    if (ids.length === 0) return [];
    const ex = { select: { dateFin: true } };
    const [biens, dotations, depreciations, revisions, derogatoires, lignesReev, reprises, reprisesProvision, reductions, reclassements, parties, exercices, fractions] =
      await Promise.all([
        db.immobilisation.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, designation: true, statut: true, dateSortie: true } }),
        db.dotationAmortissement.findMany({ where: { immobilisationId: { in: ids }, immobilisation: { tenantId } }, select: { id: true, immobilisationId: true, createdAt: true, exercice: ex }, take: PLAFOND_ACTES }),
        db.depreciationImmobilisation.findMany({ where: { immobilisationId: { in: ids }, immobilisation: { tenantId } }, select: { id: true, immobilisationId: true, createdAt: true, nature: true, exercice: ex }, take: PLAFOND_ACTES }),
        db.revisionPlanAmortissement.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { id: true, immobilisationId: true, createdAt: true, dateDecision: true, exercice: ex }, take: PLAFOND_ACTES }),
        db.amortissementDerogatoire.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { id: true, immobilisationId: true, createdAt: true, nature: true, exercice: ex }, take: PLAFOND_ACTES }),
        db.ligneReevaluationBilan.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { immobilisationId: true, reevaluation: { select: { id: true, createdAt: true, dateReevaluation: true, exercice: ex } } }, take: PLAFOND_ACTES }),
        db.repriseSubventionImmobilisation.findMany({ where: { tenantId, immobilisationId: { in: ids } }, select: { id: true, immobilisationId: true, createdAt: true, nature: true, exercice: ex }, take: PLAFOND_ACTES }),
        db.repriseProvisionReevaluation.findMany({ where: { tenantId }, select: { id: true, createdAt: true, detail: true, exercice: ex }, take: PLAFOND_ACTES }),
        db.reductionSubventionImmobilisation.findMany({ where: { tenantId, subvention: { immobilisationId: { in: ids } } }, select: { id: true, createdAt: true, subvention: { select: { immobilisationId: true } }, exercice: ex }, take: PLAFOND_ACTES }),
        db.reclassementImmobilisation.findMany({ where: { immobilisationId: { in: ids }, immobilisation: { tenantId } }, select: { id: true, immobilisationId: true, createdAt: true, dateReclassement: true, exercice: ex }, take: PLAFOND_ACTES }),
        // Lot 8 · la partie d'une structure détachée par un remplacement
        // imprévu · ses amortissements ont été pris au prorata du cumul.
        db.immobilisation.findMany({
          where: { tenantId, immobilisationPrincipaleId: { in: ids }, methodeEstimationPartie: { not: null } },
          select: { id: true, immobilisationPrincipaleId: true, createdAt: true, dateAcquisition: true },
          take: PLAFOND_ACTES,
        }),
        db.exercice.findMany({ where: { tenantId }, select: { dateDebut: true, dateFin: true }, take: PLAFOND_ACTES }),
        db.immobilisation.findMany({
          where: { tenantId, fractionDeId: { in: ids } },
          select: { id: true, fractionDeId: true, createdAt: true, dateSortie: true },
          take: PLAFOND_ACTES,
        }),
      ]);
    const nom = new Map(biens.map((b) => [b.id, b.designation]));
    // Ligne sage-l4, n° 73 · un bien sorti par un transfert dans le groupe se
    // reprend en annulant le transfert, depuis le siège · le refus le dit.
    const sortis = biens.filter((b) => b.statut !== StatutImmobilisation.EN_SERVICE).map((b) => b.id);
    const transferes = new Set(
      sortis.length === 0
        ? []
        : (
            await db.transfertImmobilisationGroupe.findMany({
              where: { tenantId, immobilisationId: { in: sortis }, sens: 'SORTIE', annuleLe: null },
              select: { immobilisationId: true },
              take: PLAFOND_ACTES,
            })
          ).map((t) => t.immobilisationId),
    );
    const finALaDate = (d: Date) => exercices.find((e) => e.dateDebut <= d && e.dateFin >= d)?.dateFin ?? d;
    const actes: ActeDuBien[] = [
      ...dotations.map((d) => ({ nature: 'DOTATION' as const, id: d.id, exerciceFin: d.exercice.dateFin, creeLe: d.createdAt, libelle: `la dotation de l'exercice clos le ${jour(d.exercice.dateFin)}`, bien: nom.get(d.immobilisationId) })),
      ...depreciations.map((d) => ({
        nature:
          d.nature === NatureMouvementDepreciation.CLOTURE
            ? ('DEPRECIATION' as const)
            : d.nature === NatureMouvementDepreciation.CESSION_PARTIELLE
              ? ('CESSION_PARTIELLE' as const)
              : ('TRANSFERT_DEPRECIATION' as const),
        id: d.id,
        exerciceFin: d.exercice.dateFin,
        creeLe: d.createdAt,
        libelle:
          d.nature === NatureMouvementDepreciation.CLOTURE
            ? `la dépréciation de l'exercice clos le ${jour(d.exercice.dateFin)}`
            : d.nature === NatureMouvementDepreciation.TRANSFERT_GROUPE
              ? // Ligne sage-l4, n° 73 · la dépréciation qui a suivi le bien,
                // défaite seulement avec le transfert (fenêtre Groupe).
                'la dépréciation reçue avec le bien par le transfert dans le groupe'
              : d.nature === NatureMouvementDepreciation.CESSION_PARTIELLE
                ? `la sortie d'une partie des unités du lot (exercice clos le ${jour(d.exercice.dateFin)})`
                : 'le transfert de la dépréciation à la mise en service',
        bien: nom.get(d.immobilisationId),
        ...(d.nature === NatureMouvementDepreciation.TRANSFERT_GROUPE ? { issue: ISSUE_TRANSFERT_GROUPE } : {}),
      })),
      ...revisions.map((r) => ({ nature: 'REVISION_PLAN' as const, id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `la révision du plan du ${jour(r.dateDecision)}`, bien: nom.get(r.immobilisationId) })),
      ...derogatoires.map((d) => ({
        nature: d.nature === NatureDerogatoire.SOLDE_SORTIE ? ('DEROGATOIRE_SOLDE' as const) : ('DEROGATOIRE' as const),
        id: d.id,
        exerciceFin: d.exercice.dateFin,
        creeLe: d.createdAt,
        libelle:
          d.nature === NatureDerogatoire.SOLDE_SORTIE
            ? `la reprise du solde du dérogatoire (exercice clos le ${jour(d.exercice.dateFin)})`
            : `le dérogatoire de l'exercice clos le ${jour(d.exercice.dateFin)}`,
        bien: nom.get(d.immobilisationId),
      })),
      ...[...new Map(lignesReev.map((l) => [l.reevaluation.id, l])).values()].map((l) => ({
        nature: 'REEVALUATION' as const,
        id: l.reevaluation.id,
        exerciceFin: l.reevaluation.exercice.dateFin,
        creeLe: l.reevaluation.createdAt,
        libelle: `la réévaluation du ${jour(l.reevaluation.dateReevaluation)}`,
      })),
      ...reprises.map((r) => ({
        nature: 'REPRISE_SUBVENTION' as const,
        id: r.id,
        exerciceFin: r.exercice.dateFin,
        creeLe: r.createdAt,
        libelle: `la reprise de subvention de l'exercice clos le ${jour(r.exercice.dateFin)}`,
        bien: nom.get(r.immobilisationId),
        repriseALaSortie: r.nature === 'SORTIE',
      })),
      ...reprisesProvision
        .filter((r) => lireDetailReprise(r.detail).some((d) => ids.includes(d.immobilisationId)))
        .map((r) => ({ nature: 'REPRISE_PROVISION_REEVALUATION' as const, id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `la reprise de la provision spéciale de l'exercice clos le ${jour(r.exercice.dateFin)}` })),
      ...reductions.map((r) => ({ nature: 'REDUCTION_SUBVENTION' as const, id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `la réduction de la subvention de l'exercice clos le ${jour(r.exercice.dateFin)}`, bien: nom.get(r.subvention.immobilisationId) })),
      ...reclassements.map((r) => ({ nature: 'RECLASSEMENT' as const, id: r.id, exerciceFin: r.exercice.dateFin, creeLe: r.createdAt, libelle: `le reclassement du ${jour(r.dateReclassement)}`, bien: nom.get(r.immobilisationId) })),
      ...parties.map((p) => ({
        nature: 'REMPLACEMENT_IMPREVU' as const,
        id: p.id,
        exerciceFin: finALaDate(p.dateAcquisition),
        creeLe: p.createdAt,
        libelle: 'le remplacement imprévu d’une partie de la structure',
        bien: p.immobilisationPrincipaleId ? nom.get(p.immobilisationPrincipaleId) : undefined,
      })),
      // Ligne immos, n° 65 · les unités sorties d'un lot ont pris leur part
      // de son cumul · tout traitement antérieur du lot en dépend.
      ...fractions.map((f) => ({
        nature: 'CESSION_PARTIELLE' as const,
        id: f.id,
        exerciceFin: f.dateSortie ? finALaDate(f.dateSortie) : finALaDate(f.createdAt),
        creeLe: f.createdAt,
        libelle: `la sortie d'une partie des unités du lot${f.dateSortie ? ` le ${jour(f.dateSortie)}` : ''}`,
        bien: f.fractionDeId ? nom.get(f.fractionDeId) : undefined,
        // Point 3 de la ligne restes-immos-budgets · elle s'annule, depuis la fiche des unités.
        issue: ISSUE_ANNULER_SORTIE_UNITES,
      })),
      ...biens
        .filter((b) => b.statut !== StatutImmobilisation.EN_SERVICE)
        .map((b) => ({
          nature: 'SORTIE' as const,
          id: b.id,
          exerciceFin: b.dateSortie ? finALaDate(b.dateSortie) : new Date(8.64e15),
          creeLe: b.dateSortie ?? new Date(8.64e15),
          libelle: transferes.has(b.id)
            ? `le transfert du bien dans le groupe${b.dateSortie ? ` le ${jour(b.dateSortie)}` : ''}`
            : `la sortie du bien${b.dateSortie ? ` le ${jour(b.dateSortie)}` : ''}`,
          bien: b.designation,
          ...(transferes.has(b.id) ? { issue: ISSUE_TRANSFERT_GROUPE } : { issue: ISSUE_ANNULER_SORTIE }),
        })),
    ];
    return actes;
  }

  // ---------------------------------------------------------------------------
  // Ce qui se rétablit, et ce qui se retire
  // ---------------------------------------------------------------------------

  /**
   * CE QUE LE TRAITEMENT AVAIT CHANGÉ HORS DE SA TABLE · rétabli, et rendu
   * pour être gardé avec l'acte d'annulation. Une dotation, un dérogatoire,
   * une reprise de subvention ne touchent qu'à leur ligne ; la dépréciation
   * a consommé l'écart de réévaluation (ch. 12 § 2.5), la révision et la
   * réévaluation ont changé la fiche, la reprise de la provision spéciale
   * ses lignes de réévaluation.
   */
  private async retablir(tx: Prisma.TransactionClient, tenantId: string, c: Cible): Promise<Record<string, unknown>> {
    switch (c.nature) {
      case 'DOTATION':
      case 'DEROGATOIRE':
      case 'REPRISE_SUBVENTION':
        return {};
      case 'DEPRECIATION': {
        const impute = n(c.acte.montantImputeEcart);
        if (impute <= 0.004) return {};
        // Les lignes dans l'ordre où la dépréciation les a entamées
        // (`enregistrerDepreciation`, la plus ancienne réévaluation d'abord).
        const lignes = await tx.ligneReevaluationBilan.findMany({
          where: { tenantId, immobilisationId: c.immobilisationId!, ecart: { gt: 0 } },
          select: { id: true, ecartImpute: true, compteEcart: true },
          orderBy: { reevaluation: { dateReevaluation: 'asc' } },
          take: PLAFOND_ACTES,
        });
        const rendu = rendreEcartImpute(lignes.map((l) => ({ id: l.id, ecartImpute: n(l.ecartImpute) })), impute);
        if (!rendu) {
          throw new ConflictException(
            `La dépréciation avait imputé ${impute.toFixed(2)} sur l'écart de réévaluation du bien (AUDCIF Titre VIII ch. 12 § 2.5), ` +
              "et les lignes de réévaluation ne portent plus de quoi le rendre au centime · l'état a changé depuis. Rien n'est annulé.",
          );
        }
        for (const r of rendu) {
          await tx.ligneReevaluationBilan.update({ where: { id: r.id }, data: { ecartImpute: { decrement: r.montant } } });
        }
        return { ecartImputeRendu: rendu };
      }
      case 'REVISION_PLAN': {
        const bien = await tx.immobilisation.findFirst({
          where: { id: c.immobilisationId!, tenantId },
          select: { id: true, dureeAmortissementAns: true, reprisesAmortissement: true, dateEffetRevisionPlan: true, dureeResiduelleRevisee: true },
        });
        if (!bien) throw new ConflictException("Le bien de cette révision n'existe plus.");
        const restantes = await this.revisionsLues(tx, tenantId, c.immobilisationId!, c.acteId);
        const etat = etatDuPlanApres(restantes);
        const reprise = c.acte.nature === 'RETROACTIVE' ? n(c.acte.montantReprise) : 0;
        await tx.immobilisation.update({
          where: { id: bien.id },
          data: {
            dureeAmortissementAns: c.acte.dureeAvantAns as number,
            dateEffetRevisionPlan: etat.dateEffetRevisionPlan,
            dureeResiduelleRevisee: etat.dureeResiduelleRevisee,
            ...(reprise > 0 ? { reprisesAmortissement: { decrement: reprise } } : {}),
          },
        });
        return {
          avant: {
            dureeAmortissementAns: bien.dureeAmortissementAns,
            reprisesAmortissement: n(bien.reprisesAmortissement),
            dateEffetRevisionPlan: bien.dateEffetRevisionPlan,
            dureeResiduelleRevisee: bien.dureeResiduelleRevisee,
          },
          apres: { dureeAmortissementAns: c.acte.dureeAvantAns, ...etat, repriseRetranchee: reprise },
        };
      }
      case 'REPRISE_PROVISION_REEVALUATION': {
        const detail = lireDetailReprise(c.acte.detail);
        for (const d of detail) {
          if (!(d.montant > 0)) continue;
          const l = await tx.ligneReevaluationBilan.findFirst({ where: { id: d.ligneId, tenantId }, select: { id: true, provisionReprise: true } });
          if (!l || n(l.provisionReprise) + 0.004 < d.montant) {
            throw new ConflictException(
              "Une ligne de réévaluation que la reprise avait soldée ne porte plus sa reprise · l'état a changé depuis (sortie du bien, " +
                "autre reprise). Rien n'est annulé.",
            );
          }
          await tx.ligneReevaluationBilan.update({ where: { id: l.id }, data: { provisionReprise: { decrement: d.montant } } });
        }
        return { provisionRendue: detail.map((d) => ({ ligneId: d.ligneId, montant: d.montant })) };
      }
      case 'REEVALUATION': {
        const lignes = (c.acte.lignes as Array<Record<string, unknown>>) ?? [];
        const retablis: Array<Record<string, unknown>> = [];
        for (const l of lignes) {
          if (!(n(l.ecart) > 0.004)) continue;
          const bien = await tx.immobilisation.findFirst({
            where: { id: l.immobilisationId as string, tenantId },
            select: { id: true, designation: true, valeurOrigine: true, valeurResiduelle: true, amortissementsReevaluation: true },
          });
          if (!bien) throw new ConflictException('Un bien de cette réévaluation n’existe plus · rien n’est annulé.');
          if (Math.abs(n(bien.valeurOrigine) - n(l.brutApres)) > 0.004) {
            throw new ConflictException(
              `La valeur d'origine de « ${bien.designation} » (${n(bien.valeurOrigine).toFixed(2)}) n'est plus celle que la réévaluation ` +
                `a posée (${n(l.brutApres).toFixed(2)}) · la fiche a changé depuis, rien n'est annulé.`,
            );
          }
          const vr = valeurResiduelleAvant(l.valeurResiduelleAvant === null ? null : n(l.valeurResiduelleAvant), n(bien.valeurResiduelle));
          if (vr === null) {
            throw new BadRequestException(
              `« ${bien.designation} » porte une valeur résiduelle (${n(bien.valeurResiduelle).toFixed(2)}) multipliée par le coefficient ` +
                "de cette réévaluation (décision D-41), et la valeur d'avant n'a pas été gardée · elle ne se retrouve pas au centime par une " +
                "division. L'annulation ne rétablirait pas la fiche · rien n'est annulé. Corrigez par une écriture en négatif saisie par le " +
                'cabinet, avec son motif (AUDCIF art. 20, al. 2).',
            );
          }
          const delta = centimes(n(l.amortissementsApres) - n(l.amortissementsAvant));
          await tx.immobilisation.update({
            where: { id: bien.id },
            data: {
              valeurOrigine: n(l.brutAvant),
              valeurResiduelle: vr,
              amortissementsReevaluation: { decrement: delta },
            },
          });
          retablis.push({ immobilisationId: bien.id, valeurOrigine: n(l.brutAvant), valeurResiduelle: vr, amortissementsRetranches: delta });
        }
        // La révision prospective posée par la méthode 2 part avec
        // l'opération · l'état du plan revient à la révision qui la précède.
        const posees = (c.acte.revisionsPosees as string[] | undefined) ?? [];
        const plans: Array<Record<string, unknown>> = [];
        for (const revisionId of posees) {
          const r = await tx.revisionPlanAmortissement.findFirst({ where: { id: revisionId, tenantId }, select: { id: true, immobilisationId: true } });
          if (!r) continue;
          await tx.revisionPlanAmortissement.deleteMany({ where: { id: r.id, tenantId } });
          const etat = etatDuPlanApres(await this.revisionsLues(tx, tenantId, r.immobilisationId, null));
          await tx.immobilisation.update({ where: { id: r.immobilisationId }, data: etat });
          plans.push({ immobilisationId: r.immobilisationId, revisionRetiree: r.id, ...etat });
        }
        return { fichesRetablies: retablis, plans };
      }
    }
  }

  /** L'enregistrement quitte sa table · une ligne et une seule, sinon un autre geste l'a pris (409). */
  private async retirerLActe(tx: Prisma.TransactionClient, tenantId: string, c: Cible) {
    let count = 0;
    switch (c.nature) {
      case 'DOTATION':
        count = (await tx.dotationAmortissement.deleteMany({ where: { id: c.acteId, immobilisation: { tenantId } } })).count;
        break;
      case 'DEPRECIATION':
        count = (await tx.depreciationImmobilisation.deleteMany({ where: { id: c.acteId, immobilisation: { tenantId } } })).count;
        break;
      case 'REVISION_PLAN':
        count = (await tx.revisionPlanAmortissement.deleteMany({ where: { id: c.acteId, tenantId } })).count;
        break;
      case 'DEROGATOIRE':
        count = (await tx.amortissementDerogatoire.deleteMany({ where: { id: c.acteId, tenantId } })).count;
        break;
      case 'REPRISE_SUBVENTION':
        count = (await tx.repriseSubventionImmobilisation.deleteMany({ where: { id: c.acteId, tenantId } })).count;
        break;
      case 'REPRISE_PROVISION_REEVALUATION':
        count = (await tx.repriseProvisionReevaluation.deleteMany({ where: { id: c.acteId, tenantId } })).count;
        break;
      case 'REEVALUATION':
        await tx.ligneReevaluationBilan.deleteMany({ where: { reevaluationId: c.acteId, tenantId } });
        count = (await tx.reevaluationBilan.deleteMany({ where: { id: c.acteId, tenantId } })).count;
        break;
    }
    if (count !== 1) throw new ConflictException('Ce traitement a été annulé ou retiré pendant le geste · rien n’est annulé deux fois.');
  }

  // ---------------------------------------------------------------------------
  // Les révisions et la réévaluation qui les pose
  // ---------------------------------------------------------------------------

  /** Les révisions d'un bien telles que l'état du plan les relit, une exceptée. */
  private async revisionsLues(db: Db, tenantId: string, immobilisationId: string, sauf: string | null): Promise<RevisionLue[]> {
    const revisions = await db.revisionPlanAmortissement.findMany({
      where: { tenantId, immobilisationId, ...(sauf ? { id: { not: sauf } } : {}) },
      include: { exercice: { select: { dateDebut: true, dateFin: true } } },
      take: PLAFOND_ACTES,
    });
    const lues: RevisionLue[] = [];
    for (const r of revisions) {
      const deReevaluation = posteeParUneReevaluation(r);
      lues.push({
        id: r.id,
        nature: r.nature,
        dureeApresAns: r.dureeApresAns,
        creeLe: r.createdAt,
        ouvertureExercice: r.exercice.dateDebut,
        // Même calcul que la réévaluation (`ouvertureSuivante`).
        ouvertureSuivante: deReevaluation ? new Date(r.exercice.dateFin.getTime() + 24 * 3600 * 1000) : null,
      });
    }
    return lues;
  }

  private async revisionsPoseesPar(db: Db, tenantId: string, reev: { id: string }): Promise<string[]> {
    const revisions = await db.revisionPlanAmortissement.findMany({
      where: { tenantId, reevaluationBilanId: reev.id },
      select: { id: true },
      take: PLAFOND_ACTES,
    });
    return revisions.map((r) => r.id);
  }
}

/**
 * LA RÉVISION QU'UNE RÉÉVALUATION LIBRE (MÉTHODE 2) A POSÉE · reconnue par sa
 * LIAISON (`reevaluationBilanId`, posée par `reevaluation-bilan.service.ts`
 * et, pour les révisions d'avant, par la migration
 * `20270174020000_revision_posee_par_reevaluation`), jamais par sa date ·
 * relecture M3, une révision prospective du cabinet datée de la même clôture
 * passait pour celle de la réévaluation et partait avec elle sans acte.
 */
export function posteeParUneReevaluation(r: { reevaluationBilanId: string | null }): boolean {
  return r.reevaluationBilanId !== null;
}

/** Le détail d'une reprise de la provision spéciale, tel que la reprise l'a figé. */
function lireDetailReprise(detail: unknown): Array<{ ligneId: string; immobilisationId: string; montant: number }> {
  if (!Array.isArray(detail)) return [];
  return detail
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d) => ({ ligneId: String(d.ligneId ?? ''), immobilisationId: String(d.immobilisationId ?? ''), montant: n(d.montant) }))
    .filter((d) => d.ligneId && d.immobilisationId);
}
