import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActionAudit, ModeAmortissement, NumerotationPiece, Prisma, StatutEcriture, StatutExercice, StatutImmobilisation } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { referencesVers } from '../../common/suppression/references';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { ImmobilisationService } from './immobilisation.service';
import { natureDuBareme } from './bareme-fiscal';
import type { CreerImmobilisationDto } from './dto/immobilisation.dto';
import type { ModifierImmobilisationDto } from './dto/fiche-immobilisation.dto';
import {
  EtatDeLaFiche,
  champsAEffetDemandes,
  exerciceClosQuiPorteLaFiche,
  motifRefusModificationAEffet,
  motifRefusSuppression,
  propositionDeDuplication,
} from './fiche-immobilisation';

type Db = Prisma.TransactionClient | PrismaService;
const jourIso = (d: Date) => d.toISOString().slice(0, 10);
const n = (x: unknown) => Number(x ?? 0);

/**
 * MODIFIER, SUPPRIMER OU DUPLIQUER LA FICHE D'UN BIEN (ligne sage-l4,
 * fonction n° 66, décision D7) · les règles vivent dans
 * `fiche-immobilisation.ts`, les contrôles d'une fiche dans
 * `ImmobilisationService.preparerFiche`, les mêmes qu'à la création.
 */
@Injectable()
export class FicheImmobilisationService {
  private readonly journal = new Logger(FicheImmobilisationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly immobilisations: ImmobilisationService,
    private readonly ecritures: EcritureService,
  ) {}

  /** Ce que la fiche porte et ce qu'elle admet · servi à l'écran, qui ne recalcule rien. */
  async etat(tenantId: string, id: string) {
    const lu = await this.lire(this.prisma, tenantId, id);
    const motifEffet = motifRefusModificationAEffet(lu.etat);
    const motifSuppression = motifRefusSuppression(lu.etat);
    const f = lu.fiche;
    return {
      valeurs: {
        designation: f.designation,
        numeroInventaire: f.numeroInventaire,
        natureFiscaleCle: f.natureFiscaleCle,
        compteImmobilisationId: f.compteImmobilisationId,
        compteContrepartieId: lu.contrepartieId,
        dateAcquisition: jourIso(f.dateAcquisition),
        dateMiseEnService: f.dateMiseEnService ? jourIso(f.dateMiseEnService) : null,
        valeurOrigine: n(f.valeurOrigine),
        valeurResiduelle: n(f.valeurResiduelle),
        dureeAmortissementAns: f.dureeAmortissementAns,
        modeAmortissement: f.modeAmortissement,
        unitesOeuvrePrevues: f.unitesOeuvrePrevues === null ? null : n(f.unitesOeuvrePrevues),
        uniteOeuvreLibelle: f.uniteOeuvreLibelle,
        amortissementAnterieur: n(f.amortissementAnterieur),
        repris: !f.ecritureAcquisitionId,
      },
      neeDUneEcriturePassee: lu.etat.neeDUneEcriturePassee,
      acquisition: lu.acquisition
        ? { numeroPiece: lu.acquisition.numeroPiece, statut: lu.acquisition.statut, journalId: lu.acquisition.journalId }
        : null,
      modificationAEffet: { ouverte: motifEffet === null, motif: motifEffet },
      suppression: { ouverte: motifSuppression === null, motif: motifSuppression },
    };
  }

  /**
   * LA MODIFICATION · les champs libres par une mise à jour unitaire (journal
   * d'audit, avant et après) ; les champs à effet par les contrôles de la
   * création, puis l'écriture d'acquisition au brouillard REMPLACÉE par
   * l'écriture que la fiche modifiée appelle · sinon le journal porterait
   * l'ancienne valeur et la fiche la nouvelle, la balance bouclée des deux
   * côtés.
   */
  async modifier(tenantId: string, userId: string, id: string, dto: ModifierImmobilisationDto) {
    const lu = await this.lire(this.prisma, tenantId, id);
    const f = lu.fiche;
    const libres: Prisma.ImmobilisationUpdateInput = {};
    if (dto.designation !== undefined) libres.designation = dto.designation.trim();
    if (dto.numeroInventaire !== undefined) libres.numeroInventaire = dto.numeroInventaire?.trim() || null;
    if (dto.natureFiscaleCle !== undefined) libres.natureFiscaleCle = dto.natureFiscaleCle?.trim() || null;

    const aEffet = champsAEffetDemandes(dto);
    if (aEffet.length === 0) {
      if (Object.keys(libres).length === 0) throw new BadRequestException('Rien à modifier · indiquez au moins un champ.');
      // La nature se vérifie au barème, comme à la création · une clé inconnue
      // ne se relirait plus à l'écran (même lecture que `preparerFiche`).
      const nature = libres.natureFiscaleCle as string | null | undefined;
      if (nature && !natureDuBareme(nature)) {
        throw new BadRequestException(`Nature « ${nature} » absente du barème de l'arrêté n° 013/CAB/MIN/FINANCES/2025 (art. 2).`);
      }
      await this.prisma.immobilisation.update({ where: { id: f.id }, data: libres });
      return this.etat(tenantId, id);
    }

    const motif = motifRefusModificationAEffet(lu.etat);
    if (motif) throw new BadRequestException(motif);

    const repris = !f.ecritureAcquisitionId;
    const dateAcquisition = dto.dateAcquisition ?? jourIso(f.dateAcquisition);
    const exerciceId = await this.exercicePourLaFiche(tenantId, dateAcquisition, repris, lu.acquisition?.exerciceId ?? null);
    const fusion: CreerImmobilisationDto = {
      compteImmobilisationId: dto.compteImmobilisationId ?? f.compteImmobilisationId,
      designation: (libres.designation as string | undefined) ?? f.designation,
      numeroInventaire: (dto.numeroInventaire !== undefined ? dto.numeroInventaire?.trim() || undefined : f.numeroInventaire) ?? undefined,
      lieuId: f.lieuId ?? undefined,
      dateAcquisition,
      dateMiseEnService:
        dto.dateMiseEnService !== undefined ? dto.dateMiseEnService : f.dateMiseEnService ? jourIso(f.dateMiseEnService) : null,
      compteEnCoursId: f.compteEnCoursId ?? undefined,
      natureFiscaleCle: dto.natureFiscaleCle !== undefined ? dto.natureFiscaleCle : f.natureFiscaleCle,
      valeurOrigine: dto.valeurOrigine ?? n(f.valeurOrigine),
      valeurResiduelle: dto.valeurResiduelle ?? n(f.valeurResiduelle),
      dureeAmortissementAns: dto.dureeAmortissementAns ?? f.dureeAmortissementAns,
      modeAmortissement: dto.modeAmortissement ?? f.modeAmortissement,
      unitesOeuvrePrevues: dto.unitesOeuvrePrevues ?? (f.unitesOeuvrePrevues === null ? undefined : n(f.unitesOeuvrePrevues)),
      uniteOeuvreLibelle: dto.uniteOeuvreLibelle ?? f.uniteOeuvreLibelle ?? undefined,
      amortissementAnterieur: dto.amortissementAnterieur ?? n(f.amortissementAnterieur),
      repris: repris || undefined,
      compteContrepartieId: repris ? undefined : (dto.compteContrepartieId ?? lu.contrepartieId ?? undefined),
      exerciceId,
      journalId: repris ? undefined : (lu.acquisition?.journalId ?? undefined),
      immobilisationPrincipaleId: f.immobilisationPrincipaleId ?? undefined,
      typeComposant: f.typeComposant ?? undefined,
      justificationDecomposition: f.justificationDecomposition ?? undefined,
      // Le dernier renouvellement a été déclaré à la création si la valeur
      // résiduelle d'un composant n'était pas nulle (AUDCIF ch. 4 § 3.3) · une
      // valeur résiduelle posée après coup reste soumise à la déclaration.
      dernierRenouvellement: f.immobilisationPrincipaleId && n(f.valeurResiduelle) > 0 ? true : undefined,
      dureeNonLimitee: f.dureeNonLimitee || undefined,
      justificationDureeNonLimitee: f.justificationDureeNonLimitee ?? undefined,
      fondementDureeDixAns: f.fondementDureeDixAns ?? undefined,
      reserveDePropriete: f.reserveDePropriete,
      criteresFraisDeveloppement: (f.criteresFraisDeveloppement as CreerImmobilisationDto['criteresFraisDeveloppement']) ?? undefined,
      dateReunionCriteresDeveloppement: f.dateReunionCriteresDeveloppement ? jourIso(f.dateReunionCriteresDeveloppement) : undefined,
      coutFuturDemantelement: f.coutFuturDemantelement === null ? undefined : n(f.coutFuturDemantelement),
      tauxActualisationDemantelementPourcent:
        f.tauxActualisationDemantelementPourcent === null ? undefined : n(f.tauxActualisationDemantelementPourcent),
    };
    // LES CONTRÔLES DE LA CRÉATION, tels quels · aucune règle n'est réécrite ici.
    const p = await this.immobilisations.preparerFiche(tenantId, fusion, { composantRemplaceId: f.composantRemplaceId ?? undefined });

    const libelleAcquisition = lu.acquisition?.libelle ?? `Acquisition · ${fusion.designation}`.slice(0, 190);
    const lignesAcquisition = [
      { compteId: p.compteEnCours?.id ?? p.famille.compteImmobilisationId, debit: fusion.valeurOrigine, credit: 0 },
      { compteId: fusion.compteContrepartieId!, debit: 0, credit: fusion.valeurOrigine },
    ];
    // LA PIÈCE DU BROUILLARD SE RETOUCHE EN PLACE (relecture de la ligne) ·
    // elle garde son numéro, et la séquence du journal n'a pas de trou. Elle
    // ne se remplace que si elle change d'exercice, ou de mois dans un journal
    // numéroté par mois · la neuve naît alors d'abord, au brouillard, comme à
    // la création, l'ancienne ne part qu'avec la mise à jour de la fiche, et
    // un échec retire la neuve.
    const enPlace =
      !!lu.acquisition &&
      exerciceId === lu.acquisition.exerciceId &&
      !(lu.acquisition.journal.numerotation === NumerotationPiece.MENSUELLE && fusion.dateAcquisition.slice(0, 7) !== jourIso(lu.acquisition.date).slice(0, 7));
    const nouvelle =
      repris || enPlace
        ? null
        : await this.ecritures.creer(tenantId, userId, {
            exerciceId,
            journalId: fusion.journalId!,
            date: fusion.dateAcquisition,
            libelle: libelleAcquisition,
            lignes: lignesAcquisition,
          });
    try {
      await transactionJournalisee(this.prisma, async (tx) => {
        // Relue dans la transaction · un traitement passé entre-temps refuse.
        const relu = await this.lire(tx, tenantId, id);
        const encore = motifRefusModificationAEffet(relu.etat);
        if (encore) throw new ConflictException(`La fiche a changé pendant la modification · ${encore}`);
        await tx.immobilisation.update({
          where: { id: f.id },
          data: {
            designation: fusion.designation,
            numeroInventaire: fusion.numeroInventaire ?? null,
            natureFiscaleCle: p.natureFiscaleCle,
            famille: { connect: { id: p.famille.id } },
            compteImmobilisation: { connect: { id: p.famille.compteImmobilisationId } },
            compteAmortissement: { connect: { id: p.famille.compteAmortissementId } },
            compteDotation: { connect: { id: p.famille.compteDotationId } },
            dateAcquisition: p.dateAcquisition,
            dateMiseEnService: p.dateMiseEnService,
            valeurOrigine: fusion.valeurOrigine,
            valeurResiduelle: fusion.valeurResiduelle ?? 0,
            dureeAmortissementAns: fusion.dureeAmortissementAns ?? p.famille.dureeAmortissementAns,
            amortissementAnterieur: fusion.amortissementAnterieur ?? 0,
            modeAmortissement: p.mode,
            unitesOeuvrePrevues: p.mode === ModeAmortissement.UNITES_DOEUVRE ? fusion.unitesOeuvrePrevues : null,
            uniteOeuvreLibelle: p.mode === ModeAmortissement.UNITES_DOEUVRE ? (fusion.uniteOeuvreLibelle?.trim() ?? null) : null,
            reserveDePropriete: p.reserveDePropriete,
            ...(nouvelle ? { ecritureAcquisition: { connect: { id: nouvelle.id } } } : {}),
          },
        });
        if (enPlace && relu.acquisition) {
          const fait = await this.ecritures.modifierPieceDuModule(tx, tenantId, relu.acquisition.id, {
            date: fusion.dateAcquisition,
            libelle: libelleAcquisition,
            lignes: lignesAcquisition,
          });
          if (!fait) throw new ConflictException("La pièce d'acquisition a changé pendant la modification · relancez-la.");
        } else if (relu.acquisition) {
          // Une et une seule, ENCORE au brouillard, sinon rien ne part (409).
          await tx.ligneEcriture.deleteMany({
            where: { ecritureId: relu.acquisition.id, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } },
          });
          const r = await tx.ecriture.deleteMany({ where: { id: relu.acquisition.id, tenantId, statut: StatutEcriture.BROUILLARD } });
          if (r.count !== 1) {
            throw new ConflictException("L'écriture d'acquisition a été validée ou retirée pendant la modification · rien n'est modifié.");
          }
        }
      });
    } catch (err) {
      if (nouvelle) await this.retirerEcritureOrpheline(tenantId, nouvelle.id);
      throw err;
    }
    return this.etat(tenantId, id);
  }

  /**
   * LA SUPPRESSION · seulement sans écriture retenue (D7). La fiche part avec
   * son écriture d'acquisition au brouillard, et avec les annulations de
   * traitements qui ne retiennent plus aucune écriture, dans une transaction.
   */
  async supprimer(tenantId: string, id: string) {
    await transactionJournalisee(this.prisma, async (tx) => {
      const lu = await this.lire(tx, tenantId, id);
      const motif = motifRefusSuppression(lu.etat);
      if (motif) throw new BadRequestException(motif);
      // UNE À UNE, PAR IDENTIFIANT (relecture de la ligne) · le journal d'audit
      // ne garde la pré-image que d'une suppression unitaire ; un `deleteMany`
      // n'y laisserait que filtre et compte.
      const annulations = await tx.annulationTraitementImmobilisation.findMany({
        where: { tenantId, immobilisationId: id, ecritureOrigineId: null, ecritureNegatifId: null },
        select: { id: true },
        take: 1000,
      });
      for (const a of annulations) await tx.annulationTraitementImmobilisation.delete({ where: { id: a.id } });
      try {
        await tx.immobilisation.delete({ where: { id } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new ConflictException('La fiche a été retirée par un autre geste.');
        }
        throw err;
      }
      // Née d'une écriture déjà passée (n° 68), la fiche part seule · l'écriture
      // était au journal avant elle et y reste, sa ligne revient à la liste.
      if (lu.acquisition && !lu.etat.neeDUneEcriturePassee) {
        await tx.ligneEcriture.deleteMany({ where: { ecritureId: lu.acquisition.id, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
        const e = await tx.ecriture.deleteMany({ where: { id: lu.acquisition.id, tenantId, statut: StatutEcriture.BROUILLARD } });
        if (e.count !== 1) {
          throw new ConflictException("L'écriture d'acquisition a été validée pendant la suppression · la fiche est gardée.");
        }
      }
    });
    return { supprime: true };
  }

  /** La copie proposée par « Dupliquer » · rien n'est écrit, la création la confirme. */
  async duplication(tenantId: string, id: string) {
    const f = await this.prisma.immobilisation.findFirst({ where: { id, tenantId } });
    if (!f) throw new NotFoundException('Immobilisation introuvable');
    return propositionDeDuplication({
      designation: f.designation,
      compteImmobilisationId: f.compteImmobilisationId,
      natureFiscaleCle: f.natureFiscaleCle,
      lieuId: f.lieuId,
      valeurOrigine: n(f.valeurOrigine),
      valeurResiduelle: n(f.valeurResiduelle),
      dureeAmortissementAns: f.dureeAmortissementAns,
      modeAmortissement: f.modeAmortissement,
      unitesOeuvrePrevues: f.unitesOeuvrePrevues === null ? null : n(f.unitesOeuvrePrevues),
      uniteOeuvreLibelle: f.uniteOeuvreLibelle,
    });
  }

  /** La fiche, son écriture d'acquisition et l'état qui juge les deux gestes. */
  private async lire(db: Db, tenantId: string, id: string) {
    const fiche = await db.immobilisation.findFirst({ where: { id, tenantId } });
    if (!fiche) throw new NotFoundException('Immobilisation introuvable');
    const acquisition = fiche.ecritureAcquisitionId
      ? await db.ecriture.findFirst({
          where: { id: fiche.ecritureAcquisitionId, tenantId },
          select: {
            id: true,
            statut: true,
            numeroPiece: true,
            journalId: true,
            exerciceId: true,
            libelle: true,
            date: true,
            journal: { select: { numerotation: true } },
            exercice: { select: { statut: true } },
            lignes: { select: { compteId: true, debit: true, credit: true, lettre: true, lettrageId: true, rapprochementId: true } },
          },
        })
      : null;
    // Les usages du bien, lus dans le schéma · une table ajoutée demain qui
    // pointe une fiche la retiendra sans que personne ait à y penser.
    const refs = await referencesVers(db, 'Immobilisation', id, tenantId);
    // Les documents joints (ligne sage-l6, fonction n° 22) ne sont pas des
    // traitements · ils ne figent ni la valeur, ni le compte, ni les dates ;
    // ils ne retiennent que la suppression (`motifRefusSuppression`).
    const usages = refs.filter((r) => r.modele !== 'AnnulationTraitementImmobilisation' && r.modele !== 'PieceJointeImmobilisation');
    const documents = refs.filter((r) => r.modele === 'PieceJointeImmobilisation').reduce((s, r) => s + r.nombre, 0);
    const annulationsRetenant = await db.annulationTraitementImmobilisation.count({
      where: { tenantId, immobilisationId: id, OR: [{ ecritureOrigineId: { not: null } }, { ecritureNegatifId: { not: null } }] },
    });
    const credits = acquisition?.lignes.filter((l) => n(l.credit) > 0) ?? [];
    const contrepartieId = credits.length === 1 ? credits[0].compteId : null;
    const autresEcritures = [
      fiche.ecritureMiseEnServiceId ? "l'écriture de mise en service" : null,
      fiche.ecritureSortieId ? "l'écriture de sortie" : null,
      fiche.ecritureProduitCessionId ? 'le produit de cession' : null,
      fiche.ecritureSoldeDetteAleatoireId ? 'le solde de la dette aléatoire' : null,
      fiche.ecritureSortieEcartReevaluationId ? "le transfert de l'écart de réévaluation" : null,
    ].filter((x): x is string => !!x);
    const neeDUneEcriturePassee = !!fiche.ligneAcquisitionId;
    // Relecture M4 · le premier exercice CLÔTURÉ qui finit au plus tôt à la
    // date d'acquisition, et dont la clôture a suivi la fiche, a porté le
    // bien à ses états, écriture d'acquisition ou non (un bien repris n'en a
    // pas) · la règle est `exerciceClosQuiPorteLaFiche`.
    const closQuiLaPorte = await this.exerciceClosQuiLaPorte(db, tenantId, fiche);
    const origineParticuliere = neeDUneEcriturePassee
      ? "d'une écriture déjà passée au journal"
      : fiche.natureAcquisitionAleatoire
      ? "d'une acquisition à prix aléatoire (rente viagère ou redevances)"
      : fiche.modaliteVentilation
        ? "de la ventilation d'un prix global"
        : acquisition && (acquisition.lignes.length !== 2 || !contrepartieId)
          ? "d'une écriture d'acquisition à plusieurs contreparties (legs, location-acquisition ou opération du module)"
          : null;
    const etat: EtatDeLaFiche = {
      sortie: fiche.statut !== StatutImmobilisation.EN_SERVICE,
      autresEcritures,
      acquisition: acquisition
        ? {
            validee: acquisition.statut !== StatutEcriture.BROUILLARD,
            numeroPiece: acquisition.numeroPiece,
            nombreLignes: acquisition.lignes.length,
            exerciceClos: acquisition.exercice.statut === StatutExercice.CLOTURE,
          }
        : null,
      motifLignesTenues: acquisition
        ? motifLignesTenues(acquisition.lignes, "l'écriture d'acquisition", 'modifier ou supprimer la fiche')
        : null,
      origineParticuliere,
      neeDUneEcriturePassee,
      usages,
      annulationsRetenant,
      exerciceClosQuiLaPorte: closQuiLaPorte ? closQuiLaPorte.toISOString().slice(0, 10) : null,
      documents,
      renouvelle: fiche.composantRemplaceId
        ? ((await db.immobilisation.findFirst({ where: { id: fiche.composantRemplaceId, tenantId }, select: { designation: true } }))?.designation ?? '·')
        : null,
    };
    return { fiche, acquisition, contrepartieId, etat };
  }

  /**
   * Les exercices clôturés qui finissent au plus tôt à la date d'acquisition,
   * et le moment de leur clôture lu au journal d'audit · deux lectures
   * bornées, jamais le journal entier. Un maillon de clôture est celui qui
   * fait passer l'exercice à CLOTURE (création déjà close, ou modification
   * dont l'état d'avant ne l'était pas) · une retouche d'un exercice déjà
   * clos (date d'arrêté) n'en est pas une.
   */
  private async exerciceClosQuiLaPorte(db: Db, tenantId: string, fiche: { dateAcquisition: Date; createdAt: Date }): Promise<Date | null> {
    const clos = await db.exercice.findMany({
      where: { tenantId, statut: StatutExercice.CLOTURE, dateFin: { gte: fiche.dateAcquisition } },
      orderBy: { dateFin: 'asc' },
      select: { id: true, dateFin: true },
      take: 50,
    });
    if (clos.length === 0) return null;
    const [maillons, premier] = await Promise.all([
      db.evenementAudit.findMany({
        where: {
          tenantId,
          entite: 'Exercice',
          entiteId: { in: clos.map((e) => e.id) },
          action: { in: [ActionAudit.CREATION, ActionAudit.MODIFICATION] },
          apres: { path: ['statut'], equals: StatutExercice.CLOTURE },
        },
        orderBy: { rang: 'desc' },
        select: { entiteId: true, horodatage: true, action: true, avant: true },
        take: 500,
      }),
      db.evenementAudit.findFirst({ where: { tenantId }, orderBy: { rang: 'asc' }, select: { horodatage: true } }),
    ]);
    const etaitClos = (avant: unknown) => !!avant && typeof avant === 'object' && (avant as { statut?: unknown }).statut === StatutExercice.CLOTURE;
    const clotures = maillons.filter((m) => m.action === ActionAudit.CREATION || !etaitClos(m.avant));
    return exerciceClosQuiPorteLaFiche({
      ficheCreeeLe: fiche.createdAt,
      debutDuJournal: premier?.horodatage ?? null,
      clos: clos.map((e) => ({ dateFin: e.dateFin, clotures: clotures.filter((m) => m.entiteId === e.id).map((m) => m.horodatage) })),
    });
  }

  /**
   * L'exercice de l'écriture d'acquisition · celui qui contient la date
   * (ouvert), ou, pour un bien repris, le premier qui s'ouvre après elle
   * (le bien est au bilan d'ouverture de celui-là, comme à la création).
   */
  private async exercicePourLaFiche(tenantId: string, dateAcquisition: string, repris: boolean, actuel: string | null) {
    const d = new Date(dateAcquisition);
    if (repris) {
      const ex = await this.prisma.exercice.findFirst({
        where: { tenantId, dateDebut: { gt: d } },
        orderBy: { dateDebut: 'asc' },
        select: { id: true },
      });
      if (!ex) throw new BadRequestException("Un bien repris est acquis avant l'ouverture d'un exercice du dossier · aucun ne s'ouvre après cette date.");
      return ex.id;
    }
    const ex = await this.prisma.exercice.findFirst({
      where: { tenantId, dateDebut: { lte: d }, dateFin: { gte: d } },
      select: { id: true, statut: true },
    });
    if (!ex) throw new BadRequestException(`Aucun exercice du dossier ne couvre le ${dateAcquisition}.`);
    if (ex.statut === StatutExercice.CLOTURE && ex.id !== actuel) {
      throw new BadRequestException(`L'exercice qui couvre le ${dateAcquisition} est clôturé · l'acquisition ne s'y porte plus.`);
    }
    return ex.id;
  }

  /** La nouvelle écriture d'un geste qui a échoué ne reste pas au journal · un retrait manqué est dit avec son identifiant. */
  private async retirerEcritureOrpheline(tenantId: string, ecritureId: string) {
    try {
      await this.prisma.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
      await this.prisma.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
    } catch (e) {
      this.journal.error(`Modification d'une fiche · écriture ${ecritureId} à retirer à la main du brouillard · ${String(e)}`);
    }
  }
}

