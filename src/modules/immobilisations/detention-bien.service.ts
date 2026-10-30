import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NatureRecuDetention, Prisma, StatutImmobilisation } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasa } from '../../common/echeance';
import {
  acteAAnnuler,
  bienDecrit,
  contratEnCoursA,
  type DetentionLue,
  iso,
  jourDepuisIso,
  motifRefusLiberation,
  motifRefusMotifAnnulation,
  motifRefusRemise,
  motifRefusSignature,
  nomDuSalarie,
  numeroSuivant,
  PLAFOND_DETENTIONS_LUES,
  texteDuRecu,
} from './detention-bien';
import type { AnnulationActeDetentionDto, LiberationBienDto, RemiseBienDto, SignatureRecuDto } from './dto/detention-bien.dto';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';

type Tx = Prisma.TransactionClient;

const SELECT_SALARIE = { id: true, nom: true, postNom: true, prenoms: true, matricule: true } as const;
const SELECT_RECU = {
  id: true,
  numero: true,
  nature: true,
  dateActe: true,
  signataires: true,
  dateSignature: true,
  signatureDeclareeLe: true,
  signatureDeclareePar: true,
  annuleLe: true,
  annulePar: true,
  motifAnnulation: true,
} as const;
const SELECT_DETENTION = {
  id: true,
  immobilisationId: true,
  bienDecrit: true,
  dateDebut: true,
  dateFin: true,
  observation: true,
  annuleeLe: true,
  annuleePar: true,
  motifAnnulation: true,
  // Les dates des contrats seules, pour dire un détenteur sans contrat en
  // cours (relecture m3) · jamais servies, ni rémunération ni contrat.
  salarie: { select: { ...SELECT_SALARIE, contrats: { select: { dateEntreeEnVigueur: true, dateFin: true } } } },
  lieu: { select: { id: true, code: true, intitule: true } },
  immobilisation: { select: { id: true, designation: true, numeroInventaire: true, statut: true, dateSortie: true } },
  recuDebut: { select: SELECT_RECU },
  recuFin: { select: SELECT_RECU },
} as const;

type DetentionServie = Prisma.DetentionBienGetPayload<{ select: typeof SELECT_DETENTION }>;

function servirRecu(r: DetentionServie['recuDebut'] | null) {
  if (!r) return null;
  return {
    id: r.id,
    numero: r.numero,
    nature: r.nature,
    dateActe: iso(r.dateActe),
    signature: r.signatureDeclareeLe
      ? { signataires: r.signataires, date: r.dateSignature ? iso(r.dateSignature) : null, declareeLe: r.signatureDeclareeLe.toISOString(), declareePar: r.signatureDeclareePar }
      : null,
    annulation: r.annuleLe ? { le: r.annuleLe.toISOString(), par: r.annulePar, motif: r.motifAnnulation } : null,
  };
}

function servir(d: DetentionServie, aujourdhui: Date) {
  const vivante = d.annuleeLe === null;
  const ouverte = vivante && d.dateFin === null;
  const sortie = d.immobilisation?.dateSortie ? jourSeul(d.immobilisation.dateSortie) : null;
  return {
    id: d.id,
    // La fiche peut avoir été retirée après l'annulation · le bien se dit
    // alors par sa description figée à la remise.
    bien: d.immobilisation
      ? { id: d.immobilisation.id, designation: d.immobilisation.designation, numeroInventaire: d.immobilisation.numeroInventaire }
      : { id: null, designation: d.bienDecrit, numeroInventaire: null },
    salarie: { id: d.salarie.id, nom: nomDuSalarie(d.salarie) },
    lieu: d.lieu,
    dateDebut: iso(d.dateDebut),
    dateFin: d.dateFin ? iso(d.dateFin) : null,
    observation: d.observation,
    annulation: d.annuleeLe ? { le: d.annuleeLe.toISOString(), par: d.annuleePar, motif: d.motifAnnulation } : null,
    // Le bien est sorti alors qu'il était encore détenu · dit, jamais
    // libéré d'office (la date du retour se déclare).
    bienSortiPendantLaDetention: ouverte && !!d.immobilisation && d.immobilisation.statut !== StatutImmobilisation.EN_SERVICE,
    // RELECTURE m2 · une sortie DATÉE AVANT la remise (cession antidatée,
    // rebut saisi après coup) · NOMMÉE, jamais refusée à la sortie, qui est
    // un acte comptable daté par sa pièce ; l'issue est d'annuler la
    // détention, ou de corriger la sortie.
    bienSortiAvantLaRemise: vivante && !!sortie && sortie.getTime() < d.dateDebut.getTime(),
    // RELECTURE m3 · le détenteur d'un bien encore en main n'a plus de
    // contrat en cours aujourd'hui (départ, fin du contrat) · dit, le bien
    // se libère ou se transfère.
    detenteurSansContratEnCours: ouverte && !contratEnCoursA(d.salarie.contrats, aujourdhui),
    dateSortieDuBien: sortie ? iso(sortie) : null,
    recuRemise: servirRecu(d.recuDebut),
    recuFin: servirRecu(d.recuFin),
  };
}

function jourSeul(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Les détentions vivantes ouvertes dont le détenteur n'a plus de contrat en cours ce jour. */
function filtreSansContrat(tenantId: string, jour: Date): Prisma.DetentionBienWhereInput {
  return {
    tenantId,
    annuleeLe: null,
    dateFin: null,
    salarie: { contrats: { none: { dateEntreeEnVigueur: { lte: jour }, OR: [{ dateFin: null }, { dateFin: { gte: jour } }] } } },
  };
}

/**
 * Les détentions vivantes dont le bien est sorti AVANT la remise · Prisma ne
 * compare pas deux colonnes, la base compte. Borne du dossier écrite.
 */
export async function compterSortiesAvantLaRemise(db: Pick<Prisma.TransactionClient, '$queryRaw'>, tenantId: string): Promise<number> {
  const r = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM "detentions_biens" d
    JOIN "immobilisations" i ON i.id = d."immobilisationId" AND i."tenantId" = d."tenantId"
    WHERE d."tenantId" = ${tenantId} AND d."annuleeLe" IS NULL AND i."dateSortie" IS NOT NULL
      AND (i."dateSortie" AT TIME ZONE 'UTC')::date < d."dateDebut"`;
  return Number(r[0]?.n ?? 0);
}

/** Les détentions vivantes ouvertes dont le détenteur n'a plus de contrat en cours ce jour. */
export async function compterDetenteursSansContrat(db: Pick<Prisma.TransactionClient, 'detentionBien'>, tenantId: string, jour: Date): Promise<number> {
  return db.detentionBien.count({ where: { ...filtreSansContrat(tenantId, jour), tenantId } });
}

/**
 * LIGNE MICROFINA M4 · le détenteur d'un bien · les règles sont dans
 * `detention-bien.ts`. Aucune écriture comptable ; trois actes (affecter,
 * transférer, libérer), chacun son reçu numéroté, et la signature déclarée.
 */
@Injectable()
export class DetentionBienService {
  constructor(private readonly prisma: PrismaService) {}

  /** L'historique d'un bien, du plus récent au plus ancien · borné, et le dit. */
  async historique(tenantId: string, immobilisationId: string) {
    const bien = await this.prisma.immobilisation.findFirst({
      where: { id: immobilisationId, tenantId },
      select: { id: true, designation: true, numeroInventaire: true, statut: true },
    });
    if (!bien) throw new NotFoundException('Immobilisation introuvable');
    // L'historique garde les détentions ANNULÉES, marquées · c'est la trace
    // de l'erreur corrigée. L'état (en cours, acte à annuler) ne lit que les
    // vivantes, par la base, quelle que soit la borne de la liste.
    const where = { tenantId, immobilisationId };
    const aujourdhui = jourDeKinshasa(new Date());
    const [lignes, total, enCours, plusRecente] = await Promise.all([
      this.prisma.detentionBien.findMany({ where: { ...where, tenantId }, orderBy: [{ dateDebut: 'desc' }, { createdAt: 'desc' }], take: PLAFOND_DETENTIONS_LUES, select: SELECT_DETENTION }),
      this.prisma.detentionBien.count({ where: { ...where, tenantId } }),
      this.prisma.detentionBien.findFirst({ where: { ...where, tenantId, annuleeLe: null, dateFin: null }, select: SELECT_DETENTION }),
      this.plusRecenteVivante(this.prisma, tenantId, immobilisationId),
    ]);
    const acte = plusRecente ? acteAAnnuler(plusRecente, plusRecente) : null;
    return {
      bien: { ...bien, sorti: bien.statut !== StatutImmobilisation.EN_SERVICE },
      enCours: enCours ? servir(enCours, aujourdhui) : null,
      // Le SEUL acte qui s'annule, à rebours · l'écran n'offre l'annulation
      // que sur lui, le serveur la rejuge.
      acteAnnulable:
        plusRecente && acte && typeof acte !== 'string'
          ? {
              detentionId: plusRecente.id,
              recuId: acte.recuId,
              genre: acte.genre,
              numero: (acte.genre === 'LIBERATION' ? plusRecente.recuFin?.numero : plusRecente.recuDebut.numero) ?? null,
            }
          : null,
      detentions: lignes.map((l) => servir(l, aujourdhui)),
      total,
      tronque: total > lignes.length,
    };
  }

  /**
   * LE SUIVI SUR UNE PÉRIODE · qui détenait quoi entre deux dates (bornes
   * comprises), filtré au besoin par salarié ou par bien. Une détention qui
   * déborde la période est rendue entière, ses dates réelles dites.
   */
  async suivi(tenantId: string, q: { du?: string; au?: string; salarieId?: string; immobilisationId?: string }) {
    const du = jourDepuisIso(q.du);
    const au = jourDepuisIso(q.au);
    if (!du || !au) throw new BadRequestException('Les bornes de la période se lisent AAAA-MM-JJ (du, au).');
    if (du.getTime() > au.getTime()) throw new BadRequestException('Le début de la période suit sa fin.');
    // Les détentions ANNULÉES sortent du suivi · elles ne disent pas qui a
    // eu le bien en main (relecture B1).
    const where: Prisma.DetentionBienWhereInput = {
      tenantId,
      annuleeLe: null,
      dateDebut: { lte: au },
      OR: [{ dateFin: null }, { dateFin: { gte: du } }],
      ...(q.salarieId ? { salarieId: q.salarieId } : {}),
      ...(q.immobilisationId ? { immobilisationId: q.immobilisationId } : {}),
    };
    const aujourdhui = jourDeKinshasa(new Date());
    const [lignes, total, ouvertesSurBienSorti, sansContrat, sortiesAvantRemise] = await Promise.all([
      this.prisma.detentionBien.findMany({
        where: { ...where, tenantId },
        orderBy: [{ dateDebut: 'asc' }, { createdAt: 'asc' }],
        take: PLAFOND_DETENTIONS_LUES,
        select: SELECT_DETENTION,
      }),
      this.prisma.detentionBien.count({ where: { ...where, tenantId } }),
      this.prisma.detentionBien.count({ where: { tenantId, annuleeLe: null, dateFin: null, immobilisation: { statut: { not: StatutImmobilisation.EN_SERVICE } } } }),
      compterDetenteursSansContrat(this.prisma, tenantId, aujourdhui),
      compterSortiesAvantLaRemise(this.prisma, tenantId),
    ]);
    return {
      du: iso(du),
      au: iso(au),
      detentions: lignes.map((l) => servir(l, aujourdhui)),
      total,
      tronque: total > lignes.length,
      detentionsOuvertesSurBienSorti: ouvertesSurBienSorti,
      // Sur tout le dossier, à la date du jour, pas sur la période.
      detenteursSansContratEnCours: sansContrat,
      biensSortisAvantLaRemise: sortiesAvantRemise,
    };
  }

  /**
   * Les salariés à qui le bien peut être remis ce jour · contrat en cours à
   * la date. Rien d'autre que l'identité · ni rémunération ni contrat.
   */
  async salariesAffectables(tenantId: string, date?: string) {
    const jour = jourDepuisIso(date);
    if (!jour) throw new BadRequestException('La date se lit AAAA-MM-JJ.');
    const where: Prisma.SalarieWhereInput = {
      tenantId,
      contrats: { some: { dateEntreeEnVigueur: { lte: jour }, OR: [{ dateFin: null }, { dateFin: { gte: jour } }] } },
    };
    const [lignes, total] = await Promise.all([
      this.prisma.salarie.findMany({ where: { ...where, tenantId }, orderBy: [{ nom: 'asc' }, { id: 'asc' }], take: PLAFOND_DETENTIONS_LUES, select: SELECT_SALARIE }),
      this.prisma.salarie.count({ where: { ...where, tenantId } }),
    ]);
    return { salaries: lignes.map((s) => ({ id: s.id, nom: nomDuSalarie(s) })), total, tronque: total > lignes.length };
  }

  async affecter(tenantId: string, auteur: { userId: string; email: string }, immobilisationId: string, dto: RemiseBienDto) {
    return this.remettre(tenantId, auteur, immobilisationId, dto, 'AFFECTATION');
  }

  async transferer(tenantId: string, auteur: { userId: string; email: string }, immobilisationId: string, dto: RemiseBienDto) {
    return this.remettre(tenantId, auteur, immobilisationId, dto, 'TRANSFERT');
  }

  /**
   * Affecter ou transférer · sous le verrou de la fiche du bien (deux remises
   * simultanées ne s'ouvrent jamais l'une sur l'autre), puis du dossier pour
   * le numéro du reçu. Tout se relit DANS la transaction.
   */
  private async remettre(
    tenantId: string,
    auteur: { userId: string; email: string },
    immobilisationId: string,
    dto: RemiseBienDto,
    nature: 'AFFECTATION' | 'TRANSFERT',
  ) {
    const jour = jourDepuisIso(dto.date);
    if (!jour) throw new BadRequestException('La date de la remise se lit AAAA-MM-JJ.');
    const id = await transactionJournalisee(this.prisma, async (tx) => {
      const bien = await this.bienSousVerrou(tx, tenantId, immobilisationId);
      const salarie = await tx.salarie.findFirst({
        where: { id: dto.salarieId, tenantId },
        select: { ...SELECT_SALARIE, contrats: { select: { dateEntreeEnVigueur: true, dateFin: true } } },
      });
      if (!salarie) throw new NotFoundException('Salarié introuvable');
      const lieu = dto.lieuId
        ? await tx.lieuBien.findFirst({ where: { id: dto.lieuId, tenantId }, select: { id: true, code: true, intitule: true } })
        : null;
      if (dto.lieuId && !lieu) throw new NotFoundException('Lieu introuvable');
      const { lues, enCours } = await this.detentionsDuBien(tx, tenantId, immobilisationId);
      const nom = nomDuSalarie(salarie);
      const motif = motifRefusRemise({
        bien,
        jour,
        aujourdhui: jourDeKinshasa(new Date()),
        detentions: lues,
        nature,
        contratsDuDetenteur: salarie.contrats,
        nomDuDetenteur: nom,
        memeDetenteurQueLEnCours: !!enCours && enCours.salarieId === salarie.id,
      });
      if (motif) throw new BadRequestException(motif);

      const recu = await this.creerRecu(tx, tenantId, auteur.email, {
        nature: nature as NatureRecuDetention,
        jour,
        bien,
        immobilisationId,
        remisA: nom,
        rendPar: enCours ? enCours.detenteur : null,
        lieu: lieu ? `${lieu.code} · ${lieu.intitule}` : null,
        observation: dto.observation ?? null,
      });
      if (nature === 'TRANSFERT' && enCours) {
        // Mise à jour UNITAIRE · le journal d'audit garde l'état d'avant.
        await tx.detentionBien.update({ where: { id: enCours.id }, data: { dateFin: jour, recuFinId: recu.id } });
      }
      const creee = await tx.detentionBien.create({
        data: {
          tenantId,
          immobilisationId,
          bienDecrit: bienDecrit(bien),
          salarieId: salarie.id,
          lieuId: lieu?.id ?? null,
          dateDebut: jour,
          observation: dto.observation?.trim() || null,
          recuDebutId: recu.id,
          createdBy: auteur.userId,
        },
        select: { id: true },
      });
      // LE LIEU DIT DEVIENT LE LIEU DU BIEN (comme « Déplacer », sans effet
      // comptable) · sans quoi la fiche dirait un lieu, la détention un autre.
      if (lieu && bien.lieuId !== lieu.id) {
        await tx.immobilisation.update({ where: { id: immobilisationId }, data: { lieuId: lieu.id } });
      }
      return creee.id;
    });
    return this.uneDetention(tenantId, id);
  }

  /** Le bien rendu à l'entité · la détention en cours se termine, avec son reçu. */
  async liberer(tenantId: string, auteur: { userId: string; email: string }, immobilisationId: string, dto: LiberationBienDto) {
    const jour = jourDepuisIso(dto.date);
    if (!jour) throw new BadRequestException('La date du retour se lit AAAA-MM-JJ.');
    const id = await transactionJournalisee(this.prisma, async (tx) => {
      const bien = await this.bienSousVerrou(tx, tenantId, immobilisationId);
      const { enCours } = await this.detentionsDuBien(tx, tenantId, immobilisationId);
      const motif = motifRefusLiberation({ enCours, jour, aujourdhui: jourDeKinshasa(new Date()) });
      if (motif || !enCours) throw new BadRequestException(motif ?? "Le bien n'est détenu par personne.");
      const recu = await this.creerRecu(tx, tenantId, auteur.email, {
        nature: NatureRecuDetention.LIBERATION,
        jour,
        bien,
        immobilisationId,
        remisA: null,
        rendPar: enCours.detenteur,
        lieu: null,
        observation: dto.observation ?? null,
      });
      await tx.detentionBien.update({ where: { id: enCours.id }, data: { dateFin: jour, recuFinId: recu.id } });
      return enCours.id;
    });
    return this.uneDetention(tenantId, id);
  }

  /** Le reçu à imprimer · son texte figé, et sa signature si elle est déclarée. */
  async recu(tenantId: string, recuId: string) {
    const r = await this.prisma.recuDetentionBien.findFirst({
      where: { id: recuId, tenantId },
      select: { ...SELECT_RECU, texte: true, etabliLe: true, etabliPar: true, immobilisationId: true },
    });
    if (!r) throw new NotFoundException('Reçu introuvable');
    return {
      ...servirRecu(r),
      immobilisationId: r.immobilisationId,
      texte: r.texte,
      etabliLe: r.etabliLe.toISOString(),
      etabliPar: r.etabliPar,
    };
  }

  /**
   * LA SIGNATURE SE DÉCLARE · qui a signé et quel jour, une fois. Jamais
   * présumée · un reçu sans déclaration reste « non signé ». La ligne est
   * prise `FOR UPDATE` · deux déclarations simultanées, une seule passe.
   */
  async declarerSignature(tenantId: string, auteur: { email: string }, recuId: string, dto: SignatureRecuDto) {
    const jour = jourDepuisIso(dto.date);
    await transactionJournalisee(this.prisma, async (tx) => {
      await prendreLeVerrouDuDossierBorne(tx, tenantId);
      const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "recus_detention_biens" WHERE id = ${recuId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      if (verrou.length !== 1) throw new NotFoundException('Reçu introuvable');
      const r = await tx.recuDetentionBien.findFirst({ where: { id: recuId, tenantId }, select: { dateActe: true, signatureDeclareeLe: true, annuleLe: true } });
      if (!r) throw new NotFoundException('Reçu introuvable');
      if (r.annuleLe) throw new ConflictException("L'acte de ce reçu est annulé · sa signature ne se déclare plus.");
      const motif = motifRefusSignature({
        dejaDeclaree: r.signatureDeclareeLe !== null,
        signataires: dto.signataires,
        jour,
        dateActe: r.dateActe,
        aujourdhui: jourDeKinshasa(new Date()),
      });
      if (motif) {
        if (r.signatureDeclareeLe) throw new ConflictException(motif);
        throw new BadRequestException(motif);
      }
      await tx.recuDetentionBien.update({
        where: { id: recuId },
        data: { signataires: dto.signataires.trim(), dateSignature: jour, signatureDeclareeLe: new Date(), signatureDeclareePar: auteur.email },
      });
    });
    return this.recu(tenantId, recuId);
  }

  /**
   * ANNULER LE DERNIER ACTE VIVANT DU BIEN (relecture B1) · à rebours, motif
   * exigé, sous le verrou de la fiche. La remise annulée MARQUE la détention
   * (jamais supprimée) et son reçu ; un transfert annulé rouvre la détention
   * qu'il avait terminée ; une libération annulée rouvre la sienne. Le reçu
   * garde son numéro, la suite n'a pas de trou. `recuId` est celui que
   * l'écran a MONTRÉ · un acte passé entre-temps refuse (409), jamais un
   * autre acte annulé à la place.
   *
   * Le lieu que la remise avait donné au bien n'est PAS rendu · l'ancien
   * lieu n'est gardé nulle part, et « Déplacer » le corrige (dit à l'écran).
   */
  async annuler(tenantId: string, auteur: { email: string }, detentionId: string, dto: AnnulationActeDetentionDto) {
    const refus = motifRefusMotifAnnulation(dto.motif);
    if (refus) throw new BadRequestException(refus);
    const motif = dto.motif.trim();
    const visee = await this.prisma.detentionBien.findFirst({ where: { id: detentionId, tenantId }, select: { immobilisationId: true, annuleeLe: true } });
    if (!visee) throw new NotFoundException('Détention introuvable');
    if (visee.annuleeLe) throw new ConflictException('Cette détention est déjà annulée.');
    if (!visee.immobilisationId) throw new ConflictException('Le bien de cette détention n’existe plus · elle ne s’annule pas.');
    const immobilisationId = visee.immobilisationId;
    await transactionJournalisee(this.prisma, async (tx) => {
      await this.bienSousVerrou(tx, tenantId, immobilisationId);
      const d = await tx.detentionBien.findFirst({
        where: { id: detentionId, tenantId },
        select: { id: true, annuleeLe: true, dateFin: true, recuDebut: { select: { id: true, nature: true } }, recuFin: { select: { id: true, nature: true } } },
      });
      if (!d) throw new NotFoundException('Détention introuvable');
      if (d.annuleeLe) throw new ConflictException('Cette détention est déjà annulée.');
      const plusRecente = await this.plusRecenteVivante(tx, tenantId, immobilisationId);
      const acte = acteAAnnuler(d, plusRecente);
      if (typeof acte === 'string') throw new BadRequestException(acte);
      if (acte.recuId !== dto.recuId) {
        throw new ConflictException("Le dernier acte de ce bien a changé depuis l'affichage · rechargez le volet Détenteur, rien n'est annulé.");
      }
      const maintenant = new Date();
      const marque = { annuleLe: maintenant, annulePar: auteur.email, motifAnnulation: motif };
      // Mises à jour UNITAIRES · le journal d'audit garde l'état d'avant de
      // chaque ligne. L'ordre compte pour l'index unique partiel · la
      // détention annulée sort de « l'ouverte vivante » AVANT que la
      // précédente ne se rouvre.
      if (acte.genre === 'REMISE') {
        await tx.detentionBien.update({ where: { id: d.id }, data: { annuleeLe: maintenant, annuleePar: auteur.email, motifAnnulation: motif } });
        await tx.recuDetentionBien.update({ where: { id: acte.recuId }, data: marque });
        if (acte.nature === 'TRANSFERT') {
          const precedente = await tx.detentionBien.findFirst({ where: { tenantId, recuFinId: acte.recuId, annuleeLe: null }, select: { id: true } });
          if (!precedente) throw new ConflictException('La détention que ce transfert a terminée est introuvable · le registre est incohérent, rien n’est annulé.');
          await tx.detentionBien.update({ where: { id: precedente.id }, data: { dateFin: null, recuFinId: null } });
        }
      } else {
        await tx.recuDetentionBien.update({ where: { id: acte.recuId }, data: marque });
        await tx.detentionBien.update({ where: { id: d.id }, data: { dateFin: null, recuFinId: null } });
      }
    });
    return this.historique(tenantId, immobilisationId);
  }

  /** La détention VIVANTE la plus récente du bien (dates, puis ordre de saisie) · c'est elle qui porte le dernier acte. */
  private async plusRecenteVivante(db: Pick<Tx, 'detentionBien'>, tenantId: string, immobilisationId: string) {
    const d = await db.detentionBien.findFirst({
      where: { tenantId, immobilisationId, annuleeLe: null },
      orderBy: [{ dateDebut: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        salarie: { select: SELECT_SALARIE },
        recuDebut: { select: { id: true, nature: true, numero: true } },
        recuFin: { select: { id: true, nature: true, numero: true } },
      },
    });
    return d ? { ...d, detenteur: nomDuSalarie(d.salarie) } : null;
  }

  private async uneDetention(tenantId: string, id: string) {
    const d = await this.prisma.detentionBien.findFirst({ where: { id, tenantId }, select: SELECT_DETENTION });
    if (!d) throw new NotFoundException('Détention introuvable');
    return servir(d, jourDeKinshasa(new Date()));
  }

  private async bienSousVerrou(tx: Tx, tenantId: string, immobilisationId: string) {
    await prendreLeVerrouDuDossierBorne(tx, tenantId);
    const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "immobilisations" WHERE id = ${immobilisationId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    if (verrou.length !== 1) throw new NotFoundException('Immobilisation introuvable');
    const bien = await tx.immobilisation.findFirst({
      where: { id: immobilisationId, tenantId },
      select: { designation: true, numeroInventaire: true, statut: true, dateAcquisition: true, dateEntreeGroupe: true, dateSortie: true, lieuId: true },
    });
    if (!bien) throw new NotFoundException('Immobilisation introuvable');
    return bien;
  }

  /**
   * Toutes les détentions VIVANTES du bien, pour juger l'ordre des dates ·
   * une seule compte (la plus tardive) et celle en cours, lues par la base ;
   * le reste n'est pas rapatrié. Une détention annulée ne borne plus rien.
   */
  private async detentionsDuBien(tx: Tx, tenantId: string, immobilisationId: string) {
    const [enCoursBrut, plusTardiveFin, plusTardifDebut] = await Promise.all([
      tx.detentionBien.findMany({ where: { tenantId, immobilisationId, dateFin: null, annuleeLe: null }, select: { id: true, salarieId: true, dateDebut: true, salarie: { select: SELECT_SALARIE } }, take: 2 }),
      tx.detentionBien.findFirst({ where: { tenantId, immobilisationId, dateFin: { not: null }, annuleeLe: null }, orderBy: { dateFin: 'desc' }, select: { dateDebut: true, dateFin: true, salarie: { select: SELECT_SALARIE } } }),
      tx.detentionBien.findFirst({ where: { tenantId, immobilisationId, annuleeLe: null }, orderBy: { dateDebut: 'desc' }, select: { dateDebut: true, dateFin: true, salarie: { select: SELECT_SALARIE } } }),
    ]);
    // Deux détentions en cours ne peuvent naître que d'une base retouchée à
    // la main · on refuse plutôt que d'en choisir une.
    if (enCoursBrut.length > 1) {
      throw new ConflictException('Le bien a deux détentions en cours · le registre des détenteurs est incohérent, aucun acte ne passe.');
    }
    const e = enCoursBrut[0] ?? null;
    const lues: DetentionLue[] = [];
    if (e) lues.push({ dateDebut: e.dateDebut, dateFin: null, detenteur: nomDuSalarie(e.salarie) });
    for (const d of [plusTardiveFin, plusTardifDebut]) {
      if (d) lues.push({ dateDebut: d.dateDebut, dateFin: d.dateFin, detenteur: nomDuSalarie(d.salarie) });
    }
    const enCours = e ? { id: e.id, salarieId: e.salarieId, dateDebut: e.dateDebut, dateFin: null, detenteur: nomDuSalarie(e.salarie) } : null;
    return { lues, enCours };
  }

  /**
   * Le reçu, numéroté dans la suite du DOSSIER sous un verrou du dossier ·
   * deux actes simultanés ne prennent jamais le même numéro, et la clé
   * unique (dossier, numéro) le tient en base.
   */
  private async creerRecu(
    tx: Tx,
    tenantId: string,
    etabliPar: string,
    p: {
      nature: NatureRecuDetention;
      jour: Date;
      bien: { designation: string; numeroInventaire: string | null };
      immobilisationId: string;
      remisA: string | null;
      rendPar: string | null;
      lieu: string | null;
      observation: string | null;
    },
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`recus-detention:${tenantId}`}))`;
    const [dernier, dossier] = await Promise.all([
      tx.recuDetentionBien.aggregate({ where: { tenantId }, _max: { numero: true } }),
      tx.tenant.findUnique({ where: { id: tenantId }, select: { nom: true } }),
    ]);
    const numero = numeroSuivant(dernier._max.numero);
    const texte = texteDuRecu({
      numero,
      nature: p.nature,
      jour: p.jour,
      dossier: dossier?.nom ?? '',
      bien: p.bien,
      remisA: p.remisA,
      rendPar: p.rendPar,
      lieu: p.lieu,
      observation: p.observation,
    });
    return tx.recuDetentionBien.create({
      data: { tenantId, numero, nature: p.nature, dateActe: p.jour, immobilisationId: p.immobilisationId, texte, etabliPar },
      select: { id: true, numero: true },
    });
  }
}
