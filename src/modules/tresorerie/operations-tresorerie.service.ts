import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ModeInteretsTresorerie,
  NatureActeTresorerie,
  Prisma,
  StatutEcriture,
  StatutExercice,
  StatutOperationTresorerie,
  TypeCompteDetailTotal,
  TypeJournal,
  TypeOperationTresorerie,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { avecRetrySerialisable } from '../../common/prisma-retry.util';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { journalDeBanqueEnFrancs } from './banque-en-francs';
import {
  RACINES,
  avertissementOperation,
  compteAvance,
  coursEnVigueur,
  interetsCalcules,
  joursEntre,
  motifRefusCompte,
  motifRefusCours,
  motifRefusInterets,
  motifRefusMiseEnPlace,
  motifRefusOperation,
  motifRefusRegularisation,
  motifRefusTauxReference,
  pieceEcheance,
  pieceMiseEnPlace,
  regularisationALaCloture,
  type LignePropose,
  type RoleCompte,
} from './operations-tresorerie';
import type { AnnulerActeTresorerieDto, ContrePasserDto, CoursTauxDto, EcheanceOperationDto, OperationTresorerieDto, RegulariserDto, TauxReferenceDto } from './operations-tresorerie.dto';

const PLAFOND_LISTE = 500;
const PLAFOND_COURS = 100;
const jour = (d: Date) => d.toISOString().slice(0, 10);
const aMinuit = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const n = (d: Prisma.Decimal | null | undefined) => (d === null || d === undefined ? null : Number(d));

const LIBELLES_ACTE: Record<NatureActeTresorerie, string> = {
  MISE_EN_PLACE: 'Mise en place',
  REGULARISATION: 'Régularisation à la clôture',
  CONTRE_PASSATION: "Contre-passation à l'ouverture",
  ECHEANCE: 'Échéance',
};
const LIBELLES_TYPE: Record<TypeOperationTresorerie, string> = { FINANCEMENT: 'Crédit de trésorerie', PLACEMENT: 'Dépôt à terme' };

const COMPTE = { select: { id: true, numero: true, intitule: true } } as const;
const ACTES = {
  orderBy: [{ date: 'asc' as const }, { createdAt: 'asc' as const }],
  select: {
    id: true,
    nature: true,
    date: true,
    exerciceId: true,
    montantInterets: true,
    interetsProposes: true,
    regularisationId: true,
    annuleLe: true,
    motifAnnulation: true,
    ecriture: { select: { id: true, numeroPiece: true, statut: true } },
    ecritureNegatif: { select: { id: true, numeroPiece: true, statut: true } },
  },
};
const INCLURE = {
  journalBanque: { select: { id: true, code: true, compteTresorerieId: true } },
  journalOd: { select: { id: true, code: true } },
  comptePrincipal: COMPTE,
  compteInterets: COMPTE,
  compteCourus: COMPTE,
  compteFrais: COMPTE,
  tauxReference: { select: { id: true, code: true, intitule: true } },
  coursRetenu: { select: { id: true, date: true, valeur: true, source: true } },
  actes: ACTES,
} as const;
type OperationLue = Prisma.OperationTresorerieGetPayload<{ include: typeof INCLURE }>;
type ExerciceLu = { id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice };

/** Le premier exercice NON clôturé qui commence après la date d'une régularisation · celui qui la contre-passe. */
function cibleDeLaContrePassation(exercices: readonly ExerciceLu[], dateRegularisation: Date): ExerciceLu | null {
  return [...exercices].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime()).find((e) => e.dateDebut.getTime() > dateRegularisation.getTime() && e.statut !== StatutExercice.CLOTURE) ?? null;
}
type ActeLu = OperationLue['actes'][number];

/**
 * FINANCEMENTS ET PLACEMENTS (ligne sage-l3, fonction 47, décision D16).
 * Règles dans `operations-tresorerie.ts` ; ici les lectures, les pièces et
 * les refus nommés. Chaque acte naît avec SA pièce (`creerAvec`), l'opération
 * est prise `FOR UPDATE` et ses actes vivants relus dans la transaction,
 * l'annulation va à rebours et s'inscrit en négatif (AUDCIF art. 20, al. 2),
 * exactement comme les actes d'un effet de commerce (fonction 39).
 */
@Injectable()
export class OperationsTresorerieService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
  ) {}

  // ----- Taux de référence (structure) --------------------------------------

  async taux(tenantId: string) {
    const [taux, total] = await Promise.all([
      this.prisma.tauxReference.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
        take: PLAFOND_LISTE,
        select: {
          id: true,
          code: true,
          intitule: true,
          cours: { orderBy: { date: 'desc' }, take: PLAFOND_COURS, select: { id: true, date: true, valeur: true, source: true } },
          _count: { select: { cours: true, operations: true } },
        },
      }),
      this.prisma.tauxReference.count({ where: { tenantId } }),
    ]);
    return {
      taux: taux.map((t) => ({
        id: t.id,
        code: t.code,
        intitule: t.intitule,
        cours: t.cours.map((c) => ({ ...c, valeur: Number(c.valeur) })),
        coursTotal: t._count.cours,
        coursTronques: t._count.cours > t.cours.length,
        operations: t._count.operations,
      })),
      total,
      tronque: total > taux.length,
    };
  }

  async creerTaux(tenantId: string, dto: TauxReferenceDto) {
    const motif = motifRefusTauxReference({ code: String(dto.code ?? ''), intitule: String(dto.intitule ?? '') });
    if (motif) throw new BadRequestException(motif);
    const code = String(dto.code).trim().toUpperCase();
    try {
      return await this.prisma.tauxReference.create({ data: { tenantId, code, intitule: String(dto.intitule).trim() }, select: { id: true, code: true, intitule: true } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(`Le code ${code} est déjà pris par un autre taux de référence de ce dossier.`);
      throw e;
    }
  }

  async retirerTaux(tenantId: string, id: string) {
    const t = await this.prisma.tauxReference.findFirst({ where: { id, tenantId }, select: { id: true, code: true, _count: { select: { operations: true } } } });
    if (!t) throw new NotFoundException('Taux de référence introuvable pour ce dossier.');
    if (t._count.operations > 0) throw new ConflictException(`Le taux ${t.code} porte ${t._count.operations} opération(s) · il ne se retire pas, son historique justifie leurs intérêts.`);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        await tx.coursTauxReference.deleteMany({ where: { tenantId, tauxReferenceId: t.id } });
        const r = await tx.tauxReference.deleteMany({ where: { id: t.id, tenantId } });
        if (r.count !== 1) throw new ConflictException(`Le taux ${t.code} a changé pendant le retrait · relisez la liste.`);
        return { id: t.id, retire: true };
      });
    } catch (e) {
      // Une opération née entre le décompte et le retrait le retient (RESTRICT) · 409 nommé, jamais un 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw new ConflictException(`Le taux ${t.code} vient d'être retenu par une opération · il ne se retire plus.`);
      throw e;
    }
  }

  async ajouterCours(tenantId: string, userId: string, tauxId: string, dto: CoursTauxDto) {
    const motif = motifRefusCours({ date: dto.date as string, valeur: dto.valeur as number, source: dto.source as string });
    if (motif) throw new BadRequestException(motif);
    const t = await this.prisma.tauxReference.findFirst({ where: { id: tauxId, tenantId }, select: { id: true, code: true } });
    if (!t) throw new NotFoundException('Taux de référence introuvable pour ce dossier.');
    try {
      const c = await this.prisma.coursTauxReference.create({
        data: { tenantId, tauxReferenceId: t.id, date: aMinuit(dto.date as string), valeur: new Prisma.Decimal(dto.valeur as number), source: (dto.source as string).trim(), createdBy: userId },
        select: { id: true, date: true, valeur: true, source: true },
      });
      return { ...c, valeur: Number(c.valeur) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Le taux ${t.code} porte déjà un cours au ${dto.date as string} · un cours déclaré ne se réécrit pas, retirez-le d'abord s'il n'a servi à aucune opération.`);
      }
      throw e;
    }
  }

  async retirerCours(tenantId: string, tauxId: string, coursId: string) {
    const c = await this.prisma.coursTauxReference.findFirst({ where: { id: coursId, tenantId, tauxReferenceId: tauxId }, select: { id: true, date: true, _count: { select: { operations: true } } } });
    if (!c) throw new NotFoundException('Cours introuvable pour ce taux.');
    if (c._count.operations > 0) throw new ConflictException(`Le cours du ${jour(c.date)} a fixé le taux de ${c._count.operations} opération(s) · il ne se retire pas.`);
    try {
      const r = await this.prisma.coursTauxReference.deleteMany({ where: { id: c.id, tenantId } });
      if (r.count !== 1) throw new ConflictException('Ce cours a changé pendant le retrait · relisez la liste.');
    } catch (e) {
      // Une opération née entre la lecture et le retrait le retient (RESTRICT) · 409 nommé, jamais un 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw new ConflictException(`Le cours du ${jour(c.date)} vient d'être retenu par une opération · il ne se retire plus.`);
      throw e;
    }
    return { id: c.id, retire: true };
  }

  // ----- Comptes --------------------------------------------------------------

  /** Les comptes d'un rôle sous les racines des fiches · liste `texte` (listes-de-comptes.ts). */
  async comptes(tenantId: string, type: string | undefined, role: string | undefined, numero?: string) {
    if (type !== TypeOperationTresorerie.FINANCEMENT && type !== TypeOperationTresorerie.PLACEMENT) throw new BadRequestException('Le type est FINANCEMENT ou PLACEMENT.');
    const roles: RoleCompte[] = ['PRINCIPAL', 'INTERETS', 'COURUS', 'FRAIS'];
    if (!roles.includes(role as RoleCompte)) throw new BadRequestException(`Le rôle du compte est l'un de ${roles.join(', ')}.`);
    if (numero !== undefined && numero !== '' && !/^\d{1,13}$/.test(numero)) throw new BadRequestException('Le début de numéro se tape en chiffres (treize au plus).');
    const racines = RACINES[type][role as RoleCompte];
    const where = {
      typeCompte: TypeCompteDetailTotal.DETAIL,
      estActif: true,
      OR: racines.map((r) => ({ numero: { startsWith: r } })),
      ...(numero ? { numero: { startsWith: numero } } : {}),
    };
    const [comptes, total] = await Promise.all([
      this.prisma.compte.findMany({ where: { tenantId, ...where }, select: { id: true, numero: true, intitule: true, estRetenu: true }, orderBy: [{ estRetenu: 'desc' }, { numero: 'asc' }], take: 200 }),
      this.prisma.compte.count({ where: { tenantId, ...where } }),
    ]);
    return { racines, comptes, motif: null, total, tronque: total > comptes.length };
  }

  // ----- Lectures -------------------------------------------------------------

  /**
   * LES OPÉRATIONS DE L'EXERCICE · celles en cours quel que soit l'exercice
   * (un dépôt de décembre échoit en janvier), et celles qui ont un acte ou une
   * date dans l'exercice. Chacune dit ce qui reste à faire DANS cet exercice ·
   * la régularisation de sa clôture, la contre-passation de celle du
   * précédent, chiffrées par le serveur (jamais recalculées à l'écran).
   */
  async lister(tenantId: string, exerciceId: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true, dateFin: true, statut: true } });
    if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    const dansLExercice = { gte: exercice.dateDebut, lte: exercice.dateFin };
    const where: Prisma.OperationTresorerieWhereInput = {
      OR: [{ statut: StatutOperationTresorerie.EN_COURS }, { dateMiseEnPlace: dansLExercice }, { dateEcheance: dansLExercice }, { actes: { some: { tenantId, exerciceId: exercice.id } } }],
    };
    const [operations, total] = await Promise.all([
      this.prisma.operationTresorerie.findMany({ where: { tenantId, ...where }, orderBy: [{ dateEcheance: 'asc' }, { createdAt: 'asc' }], take: PLAFOND_LISTE, include: INCLURE }),
      this.prisma.operationTresorerie.count({ where: { tenantId, ...where } }),
    ]);
    const exercices = await this.exercicesDuDossier(tenantId);
    return {
      exercice: { id: exercice.id, dateDebut: jour(exercice.dateDebut), dateFin: jour(exercice.dateFin), statut: exercice.statut },
      operations: operations.map((o) => this.rendre(o, exercice, exercices)),
      total,
      tronque: total > operations.length,
    };
  }

  async operation(tenantId: string, id: string) {
    const o = await this.prisma.operationTresorerie.findFirst({ where: { id, tenantId }, include: INCLURE });
    if (!o) throw new NotFoundException('Opération introuvable pour ce dossier.');
    return this.rendre(o, null, []);
  }

  private rendre(o: OperationLue, exercice: { id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice } | null, exercices: ExerciceLu[]) {
    const vivants = o.actes.filter((a) => !a.annuleLe);
    const interets = this.interetsDeReference(o, vivants);
    let regularisationProposee: { date: string; montant: number; compte: string } | null = null;
    let contrePassationProposee: { regularisationId: string; date: string; montant: number } | null = null;
    if (exercice && o.statut === StatutOperationTresorerie.EN_COURS && exercice.statut !== StatutExercice.CLOTURE) {
      const dejaRegularisee = vivants.some((a) => a.nature === NatureActeTresorerie.REGULARISATION && a.exerciceId === exercice.id);
      const r = regularisationALaCloture({ type: o.type, modeInterets: o.modeInterets, dateMiseEnPlace: o.dateMiseEnPlace, dateEcheance: o.dateEcheance }, interets, exercice.dateFin);
      if (!dejaRegularisee && r) {
        regularisationProposee = {
          date: jour(exercice.dateFin),
          montant: r.montant,
          compte: o.modeInterets === ModeInteretsTresorerie.POST_COMPTES ? (o.compteCourus?.numero ?? '·') : compteAvance(o.type),
        };
      }
      {
        const aContrePasser = this.regularisationSansContrePassation(vivants);
        if (aContrePasser && cibleDeLaContrePassation(exercices, aContrePasser.date)?.id === exercice.id) {
          contrePassationProposee = { regularisationId: aContrePasser.id, date: jour(exercice.dateDebut), montant: Number(aContrePasser.montantInterets) };
        }
      }
    }
    return {
      id: o.id,
      type: o.type,
      libelleType: LIBELLES_TYPE[o.type],
      reference: o.reference,
      statut: o.statut,
      journalBanque: o.journalBanque,
      journalOd: o.journalOd,
      comptePrincipal: o.comptePrincipal,
      compteInterets: o.compteInterets,
      compteCourus: o.compteCourus,
      compteFrais: o.compteFrais,
      dateMiseEnPlace: jour(o.dateMiseEnPlace),
      dateEcheance: jour(o.dateEcheance),
      montant: Number(o.montant),
      tauxFixe: n(o.tauxFixe),
      tauxReference: o.tauxReference,
      marge: n(o.marge),
      coursRetenu: o.coursRetenu ? { ...o.coursRetenu, date: jour(o.coursRetenu.date), valeur: Number(o.coursRetenu.valeur) } : null,
      tauxApplique: Number(o.tauxApplique),
      baseCalcul: o.baseCalcul,
      modeInterets: o.modeInterets,
      frais: n(o.frais),
      deblocableAToutMoment: o.deblocableAToutMoment,
      referenceConvention: o.referenceConvention,
      dateConvention: jour(o.dateConvention),
      interetsProposes: interetsCalcules(Number(o.montant), Number(o.tauxApplique), joursEntre(o.dateMiseEnPlace, o.dateEcheance), o.baseCalcul),
      avertissement: avertissementOperation({ type: o.type, dateMiseEnPlace: jour(o.dateMiseEnPlace), dateEcheance: jour(o.dateEcheance) }),
      regularisationProposee,
      contrePassationProposee,
      actes: o.actes.map((a) => ({ ...a, date: jour(a.date), montantInterets: Number(a.montantInterets), interetsProposes: n(a.interetsProposes), libelle: LIBELLES_ACTE[a.nature] })),
    };
  }

  /**
   * LES INTÉRÊTS SUR LESQUELS SE PROPOSE LA RÉGULARISATION · précomptés, ceux
   * DÉCLARÉS à la mise en place (le décompte de la banque) ; post-comptés, ceux
   * que les conditions donnent, la banque ne les ayant pas encore décomptés.
   */
  private interetsDeReference(o: OperationLue, vivants: ActeLu[]) {
    if (o.modeInterets === ModeInteretsTresorerie.PRECOMPTES) {
      const mise = vivants.find((a) => a.nature === NatureActeTresorerie.MISE_EN_PLACE);
      return mise ? Number(mise.montantInterets) : 0;
    }
    return interetsCalcules(Number(o.montant), Number(o.tauxApplique), joursEntre(o.dateMiseEnPlace, o.dateEcheance), o.baseCalcul);
  }

  /** La régularisation vivante qu'aucune contre-passation vivante ne reprend, ou rien. */
  private regularisationSansContrePassation(vivants: ActeLu[]) {
    return (
      vivants.find(
        (a) => a.nature === NatureActeTresorerie.REGULARISATION && Number(a.montantInterets) !== 0 && !vivants.some((c) => c.nature === NatureActeTresorerie.CONTRE_PASSATION && c.regularisationId === a.id),
      ) ?? null
    );
  }

  // ----- Mise en place --------------------------------------------------------

  /**
   * L'OPÉRATION NAÎT AVEC SA MISE EN PLACE · déclarée, jugée, puis passée en
   * une transaction au journal de banque (D 52 / C 561 pour un financement,
   * D 525 ou 2784 / C 52 pour un placement, intérêts précomptés et frais sur
   * leurs lignes). Le taux appliqué est FIGÉ · fixe, ou le cours en vigueur à
   * la date de mise en place plus la marge, jamais présumé.
   */
  async creer(tenantId: string, userId: string, dto: OperationTresorerieDto) {
    const [principal, interets, courus, frais] = await Promise.all([
      this.compteLu(tenantId, dto.comptePrincipalId),
      this.compteLu(tenantId, dto.compteInteretsId),
      dto.compteCourusId ? this.compteLu(tenantId, dto.compteCourusId) : Promise.resolve(null),
      dto.compteFraisId ? this.compteLu(tenantId, dto.compteFraisId) : Promise.resolve(null),
    ]);
    const saisie = {
      type: dto.type,
      reference: dto.reference as string,
      dateMiseEnPlace: dto.dateMiseEnPlace as string,
      dateEcheance: dto.dateEcheance as string,
      montant: dto.montant as number,
      tauxFixe: dto.tauxFixe as number | null | undefined,
      tauxReferenceId: dto.tauxReferenceId ?? null,
      marge: dto.marge as number | null | undefined,
      baseCalcul: dto.baseCalcul as number,
      modeInterets: dto.modeInterets,
      frais: (dto.frais as number | null | undefined) ?? null,
      deblocableAToutMoment: dto.deblocableAToutMoment as boolean | null | undefined,
      referenceConvention: dto.referenceConvention as string,
      dateConvention: dto.dateConvention as string,
    };
    const motif = motifRefusOperation(saisie, principal.numero);
    if (motif) throw new BadRequestException(motif);
    for (const [role, compte] of [['PRINCIPAL', principal], ['INTERETS', interets], ['COURUS', courus], ['FRAIS', frais]] as const) {
      const m = motifRefusCompte(dto.type, role, compte?.numero ?? null);
      if (m) throw new BadRequestException(m);
    }
    // Les intérêts courus se régularisent à la clôture · le compte est exigé dès la mise en place des post-comptés (sans lui, la clôture serait sans issue).
    if (dto.modeInterets === ModeInteretsTresorerie.POST_COMPTES && !courus) {
      throw new BadRequestException(`Des intérêts post-comptés courent d'une clôture à l'autre · choisissez le compte des intérêts courus (${RACINES[dto.type].COURUS.join(' ou ')}).`);
    }
    const montantFrais = saisie.frais ?? 0;
    if (montantFrais > 0 && !frais) throw new BadRequestException(`Des frais sont déclarés · choisissez leur compte (${RACINES[dto.type].FRAIS.join(' ou ')}).`);
    const precomptes = dto.modeInterets === ModeInteretsTresorerie.PRECOMPTES ? dto.interetsPrecomptes : 0;
    if (dto.modeInterets === ModeInteretsTresorerie.PRECOMPTES) {
      const m = motifRefusInterets(precomptes, 'précomptés');
      if (m) throw new BadRequestException(m);
    } else if (dto.interetsPrecomptes !== undefined && dto.interetsPrecomptes !== null) {
      throw new BadRequestException("Des intérêts post-comptés se déclarent à l'échéance, pas à la mise en place.");
    }
    const mMise = motifRefusMiseEnPlace({ type: dto.type, montant: saisie.montant, modeInterets: dto.modeInterets, frais: montantFrais }, precomptes as number);
    if (mMise) throw new BadRequestException(mMise);
    const banque = await this.banque(tenantId, dto.journalBanqueId);
    const od = await this.journalOd(tenantId, dto.journalOdId);
    // Le taux · fixe, ou le cours en vigueur à la date de mise en place (jamais un cours postérieur, jamais présumé).
    let coursRetenu: { id: string; valeur: number } | null = null;
    let tauxApplique: number;
    if (saisie.tauxReferenceId) {
      const t = await this.prisma.tauxReference.findFirst({
        where: { id: saisie.tauxReferenceId, tenantId },
        select: { code: true, cours: { where: { date: { lte: aMinuit(saisie.dateMiseEnPlace) } }, orderBy: { date: 'desc' }, take: 1, select: { id: true, date: true, valeur: true } } },
      });
      if (!t) throw new NotFoundException('Taux de référence introuvable pour ce dossier.');
      const c = coursEnVigueur(t.cours, aMinuit(saisie.dateMiseEnPlace));
      if (!c) throw new BadRequestException(`Le taux ${t.code} n'a aucun cours déclaré au ${saisie.dateMiseEnPlace} ou avant · déclarez-le avec sa source, puis mettez l'opération en place.`);
      coursRetenu = { id: c.id, valeur: Number(c.valeur) };
      tauxApplique = Math.round((coursRetenu.valeur + (saisie.marge ?? 0)) * 1e6) / 1e6;
    } else {
      tauxApplique = saisie.tauxFixe as number;
    }
    if (tauxApplique < 0) throw new BadRequestException(`Le taux appliqué (cours plus marge) est négatif (${tauxApplique}) · vérifiez la marge.`);
    const exercice = await this.exerciceDeLaDate(tenantId, saisie.dateMiseEnPlace, 'de la mise en place');
    const proposes = interetsCalcules(saisie.montant, tauxApplique, joursEntre(aMinuit(saisie.dateMiseEnPlace), aMinuit(saisie.dateEcheance)), saisie.baseCalcul);
    const comptesDuRole = { PRINCIPAL: principal.id, INTERETS: interets.id, COURUS: courus?.id ?? null, FRAIS: frais?.id ?? null, BANQUE: banque.compteTresorerie.id, AVANCE: null };
    const reference = saisie.reference.trim();
    const libelle = `${LIBELLES_TYPE[dto.type]} ${reference} · mise en place`.slice(0, 190);
    const lignes = this.lignes(pieceMiseEnPlace({ type: dto.type, montant: saisie.montant, modeInterets: dto.modeInterets, frais: montantFrais }, precomptes as number), comptesDuRole, libelle);
    const r = await this.retenuOuConflit(() => this.ecritures.creerAvec(
      tenantId,
      userId,
      { exerciceId: exercice.id, journalId: banque.id, date: saisie.dateMiseEnPlace, libelle, reference: `${reference} · ${saisie.referenceConvention.trim()}`.slice(0, 190), lignes },
      async (tx, ecriture) =>
        tx.operationTresorerie.create({
          data: {
            tenantId,
            type: dto.type,
            reference,
            journalBanqueId: banque.id,
            journalOdId: od.id,
            comptePrincipalId: principal.id,
            compteInteretsId: interets.id,
            compteCourusId: courus?.id ?? null,
            compteFraisId: frais?.id ?? null,
            dateMiseEnPlace: aMinuit(saisie.dateMiseEnPlace),
            dateEcheance: aMinuit(saisie.dateEcheance),
            montant: new Prisma.Decimal(saisie.montant),
            tauxFixe: saisie.tauxReferenceId ? null : new Prisma.Decimal(tauxApplique),
            tauxReferenceId: saisie.tauxReferenceId,
            marge: saisie.tauxReferenceId ? new Prisma.Decimal(saisie.marge ?? 0) : null,
            coursRetenuId: coursRetenu?.id ?? null,
            tauxApplique: new Prisma.Decimal(tauxApplique),
            baseCalcul: saisie.baseCalcul,
            modeInterets: dto.modeInterets,
            frais: saisie.frais === null ? null : new Prisma.Decimal(saisie.frais),
            deblocableAToutMoment: dto.type === TypeOperationTresorerie.PLACEMENT ? (saisie.deblocableAToutMoment as boolean) : null,
            referenceConvention: saisie.referenceConvention.trim(),
            dateConvention: aMinuit(saisie.dateConvention),
            createdBy: userId,
            actes: {
              create: {
                tenantId,
                nature: NatureActeTresorerie.MISE_EN_PLACE,
                date: aMinuit(saisie.dateMiseEnPlace),
                exerciceId: exercice.id,
                montantInterets: new Prisma.Decimal(precomptes as number),
                interetsProposes: dto.modeInterets === ModeInteretsTresorerie.PRECOMPTES ? new Prisma.Decimal(proposes) : null,
                ecritureId: ecriture.id,
                createdBy: userId,
              },
            },
          },
          select: { id: true },
        }),
    ));
    return { ...(await this.operation(tenantId, r.suite.id)), ecritureId: r.ecriture.id };
  }

  // ----- Régularisation et contre-passation ----------------------------------

  /**
   * LA RÉGULARISATION À LA CLÔTURE (postulat de spécialisation des exercices)
   * · au dernier jour de l'exercice, au journal d'opérations diverses, le
   * montant DÉCLARÉ par le cabinet (proposé au prorata des jours) · courus au
   * 566 ou au 5267 pour des post-comptés, constatés d'avance au 476 ou au 477
   * pour des précomptés. Une par exercice ; la précédente doit être
   * contre-passée d'abord (sinon la même part serait rattachée deux fois).
   */
  async regulariser(tenantId: string, userId: string, id: string, dto: RegulariserDto) {
    const o = await this.operationVivante(tenantId, id);
    const exercice = await this.exerciceOuvert(tenantId, dto.exerciceId);
    // Encore en cours à la clôture, fût-ce passé son terme (remboursement réel plus tard) · ses intérêts courus se rattachent (B2).
    if (exercice.dateFin.getTime() < o.dateMiseEnPlace.getTime()) {
      throw new BadRequestException(`L'opération ${o.reference} est mise en place après la clôture du ${jour(exercice.dateFin)} · rien à rattacher à cet exercice.`);
    }
    const vivants = o.actes.filter((a) => !a.annuleLe);
    if (vivants.some((a) => a.nature === NatureActeTresorerie.REGULARISATION && a.exerciceId === exercice.id)) {
      throw new ConflictException(`L'opération ${o.reference} est déjà régularisée à la clôture du ${jour(exercice.dateFin)} · annulez la régularisation pour la refaire.`);
    }
    const pendante = this.regularisationSansContrePassation(vivants);
    if (pendante) {
      throw new BadRequestException(`La régularisation du ${jour(pendante.date)} n'est pas contre-passée · contre-passez-la à l'ouverture de l'exercice suivant avant d'en passer une nouvelle.`);
    }
    const precomptes = Number(vivants.find((a) => a.nature === NatureActeTresorerie.MISE_EN_PLACE)?.montantInterets ?? 0);
    const motif = motifRefusRegularisation(dto.montant, o.modeInterets, precomptes);
    if (motif) throw new BadRequestException(motif);
    const montant = dto.montant as number;
    const proposeeNulle = Math.round(montant * 100) === 0;
    const proposee = regularisationALaCloture({ type: o.type, modeInterets: o.modeInterets, dateMiseEnPlace: o.dateMiseEnPlace, dateEcheance: o.dateEcheance }, this.interetsDeReference(o, vivants), exercice.dateFin);
    // ZÉRO DÉCLARÉ · l'acte est gardé, sans pièce (rien à inscrire), et l'échéance le lit comme régularisé.
    if (proposeeNulle) return this.passerActeSansPiece(tenantId, userId, o, { nature: NatureActeTresorerie.REGULARISATION, date: exercice.dateFin, exerciceId: exercice.id, proposes: proposee?.montant ?? null });
    const avance = o.modeInterets === ModeInteretsTresorerie.PRECOMPTES ? await this.compteDAvance(tenantId, o.type) : null;
    if (o.modeInterets === ModeInteretsTresorerie.POST_COMPTES && !o.compteCourus) {
      throw new BadRequestException(`L'opération ${o.reference} n'a pas de compte d'intérêts courus · elle ne se régularise pas ici.`);
    }
    const libelle = `${LIBELLES_TYPE[o.type]} ${o.reference} · intérêts ${o.modeInterets === ModeInteretsTresorerie.POST_COMPTES ? 'courus' : "constatés d'avance"}`.slice(0, 190);
    const lignes = this.lignes(
      this.lignesRegularisation(o.type, o.modeInterets, montant),
      { PRINCIPAL: o.comptePrincipal.id, INTERETS: o.compteInterets.id, COURUS: o.compteCourus?.id ?? null, FRAIS: o.compteFrais?.id ?? null, BANQUE: null, AVANCE: avance?.id ?? null },
      libelle,
    );
    return this.passerActe(tenantId, userId, o, {
      nature: NatureActeTresorerie.REGULARISATION,
      date: jour(exercice.dateFin),
      exerciceId: exercice.id,
      journalId: o.journalOd.id,
      montant,
      proposes: proposee?.montant ?? null,
      regularisationId: null,
      libelle,
      lignes,
    });
  }

  /**
   * LA CONTRE-PASSATION À L'OUVERTURE (fiches des comptes 40 et 41, « à
   * l'ouverture de l'exercice, ces écritures sont contre-passées ») · au
   * premier jour de l'exercice qui suit la régularisation, l'inverse exact de
   * SES lignes, relues sur sa pièce (jamais recalculées).
   */
  async contrePasser(tenantId: string, userId: string, id: string, dto: ContrePasserDto) {
    const o = await this.operationVivante(tenantId, id);
    const vivants = o.actes.filter((a) => !a.annuleLe);
    const reg = vivants.find((a) => a.id === dto.regularisationId && a.nature === NatureActeTresorerie.REGULARISATION);
    if (!reg) throw new NotFoundException("Régularisation vivante introuvable sur cette opération · relisez-la.");
    if (vivants.some((a) => a.nature === NatureActeTresorerie.CONTRE_PASSATION && a.regularisationId === reg.id)) {
      throw new ConflictException(`La régularisation du ${jour(reg.date)} est déjà contre-passée.`);
    }
    if (!reg.ecriture) {
      // Une régularisation déclarée à zéro n'a pas de pièce · rien à contre-passer, l'acte est seulement constaté.
      if (Number(reg.montantInterets) === 0) {
        const cible = cibleDeLaContrePassation(await this.exercicesDuDossier(tenantId), reg.date);
        if (!cible) throw new BadRequestException(`Aucun exercice ouvert ne suit le ${jour(reg.date)} · ouvrez l'exercice suivant, puis contre-passez.`);
        return this.passerActeSansPiece(tenantId, userId, o, { nature: NatureActeTresorerie.CONTRE_PASSATION, date: cible.dateDebut, exerciceId: cible.id, proposes: null, regularisationId: reg.id });
      }
      throw new ConflictException(`La pièce de la régularisation du ${jour(reg.date)} n'existe plus · relisez l'opération.`);
    }
    // LA CIBLE · l'ouverture de l'exercice qui suit ; s'il a été clôturé sans elle, le premier exercice encore
    // ouvert après (la charge ou le produit omis transite par l'exercice en cours, AUDCIF art. 34 ; SYCEBNL cadre
    // conceptuel § 3.3.1.2.4) · sans quoi l'opération restait enfermée, ni contre-passable ni échue (B1).
    const suivant = cibleDeLaContrePassation(await this.exercicesDuDossier(tenantId), reg.date);
    if (!suivant) throw new BadRequestException(`Aucun exercice ouvert ne suit le ${jour(reg.date)} · ouvrez l'exercice suivant, puis contre-passez.`);
    const origine = await this.prisma.ligneEcriture.findMany({ where: { ecritureId: reg.ecriture.id, ecriture: { tenantId } }, select: { compteId: true, debit: true, credit: true, libelle: true } });
    const libelle = `${LIBELLES_TYPE[o.type]} ${o.reference} · contre-passation`.slice(0, 190);
    const lignes = origine.map((l) => ({ compteId: l.compteId, libelle, debit: Number(l.credit), credit: Number(l.debit) }));
    return this.passerActe(tenantId, userId, o, {
      nature: NatureActeTresorerie.CONTRE_PASSATION,
      date: jour(suivant.dateDebut),
      exerciceId: suivant.id,
      journalId: o.journalOd.id,
      montant: Number(reg.montantInterets),
      proposes: null,
      regularisationId: reg.id,
      libelle,
      lignes,
    });
  }

  // ----- Échéance ---------------------------------------------------------------

  /**
   * L'ÉCHÉANCE · le principal remboursé ou rendu, au journal de banque, avec
   * les intérêts post-comptés DÉCLARÉS (le décompte de la banque fait foi ;
   * la proposition et l'écart sont dits). Refusée tant qu'une régularisation
   * n'est pas contre-passée · la part rattachée à N serait comptée deux fois.
   * Datée au plus tôt le lendemain de la mise en place (un remboursement
   * anticipé se déclare à sa date réelle).
   */
  async echeance(tenantId: string, userId: string, id: string, dto: EcheanceOperationDto) {
    const o = await this.operationVivante(tenantId, id);
    const vivants = o.actes.filter((a) => !a.annuleLe);
    const date = dto.date as string;
    // Un vrai jour · « 2026-02-30 » se lisait 2 mars et l'acte se datait autrement que sa pièce.
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) throw new BadRequestException("La date de l'échéance doit être un jour (AAAA-MM-JJ).");
    if (aMinuit(date).getTime() <= o.dateMiseEnPlace.getTime()) throw new BadRequestException("L'échéance suit la mise en place d'au moins un jour.");
    const dernier = vivants[vivants.length - 1];
    if (dernier && aMinuit(date).getTime() < dernier.date.getTime()) throw new BadRequestException(`L'échéance ne précède pas le dernier acte (${LIBELLES_ACTE[dernier.nature]} du ${jour(dernier.date)}).`);
    const pendante = this.regularisationSansContrePassation(vivants);
    if (pendante) {
      throw new BadRequestException(
        `La régularisation du ${jour(pendante.date)} n'est pas contre-passée · contre-passez-la à l'ouverture de l'exercice suivant, ou annulez-la si l'échéance tombe dans son exercice, puis passez l'échéance.`,
      );
    }
    // UNE CLÔTURE OUVERTE TRAVERSÉE SANS RÉGULARISATION (postulat de
    // spécialisation des exercices) · l'échéance de N+1 passée avant la
    // régularisation de N porterait en N+1, sans un mot, les intérêts courus
    // de N. Un exercice CLÔTURÉ ne bloque pas · rien ne s'y passe plus, et la
    // charge omise transite par l'exercice en cours (AUDCIF art. 34 ; SYCEBNL
    // cadre conceptuel § 3.3.1.2.4).
    const traverses = await this.prisma.exercice.findMany({
      where: { tenantId, statut: { not: StatutExercice.CLOTURE }, dateFin: { gte: o.dateMiseEnPlace, lt: aMinuit(date) } },
      orderBy: { dateFin: 'asc' },
      select: { id: true, dateFin: true },
    });
    for (const ex of traverses) {
      const part = regularisationALaCloture({ type: o.type, modeInterets: o.modeInterets, dateMiseEnPlace: o.dateMiseEnPlace, dateEcheance: o.dateEcheance }, this.interetsDeReference(o, vivants), ex.dateFin);
      if (part && !vivants.some((a) => a.nature === NatureActeTresorerie.REGULARISATION && a.exerciceId === ex.id)) {
        throw new BadRequestException(
          `La clôture du ${jour(ex.dateFin)} n'a pas rattaché ses intérêts (${part.montant.toFixed(2)} proposés) · régularisez-la, contre-passez à l'ouverture suivante, puis passez l'échéance.`,
        );
      }
    }
    let interets = 0;
    if (o.modeInterets === ModeInteretsTresorerie.POST_COMPTES) {
      const m = motifRefusInterets(dto.interets, "de l'échéance");
      if (m) throw new BadRequestException(m);
      interets = dto.interets as number;
    } else if (dto.interets !== undefined && dto.interets !== null && dto.interets !== 0) {
      throw new BadRequestException("Les intérêts précomptés sont passés à la mise en place · l'échéance ne rend que le principal.");
    }
    const banque = await this.banque(tenantId, o.journalBanque.id);
    const exercice = await this.exerciceDeLaDate(tenantId, date, "de l'échéance");
    const proposes = interetsCalcules(Number(o.montant), Number(o.tauxApplique), joursEntre(o.dateMiseEnPlace, aMinuit(date)), o.baseCalcul);
    const libelle = `${LIBELLES_TYPE[o.type]} ${o.reference} · échéance`.slice(0, 190);
    const lignes = this.lignes(
      pieceEcheance({ type: o.type, montant: Number(o.montant), modeInterets: o.modeInterets }, interets),
      { PRINCIPAL: o.comptePrincipal.id, INTERETS: o.compteInterets.id, COURUS: null, FRAIS: null, BANQUE: banque.compteTresorerie.id, AVANCE: null },
      libelle,
    );
    return this.passerActe(tenantId, userId, o, {
      nature: NatureActeTresorerie.ECHEANCE,
      date,
      exerciceId: exercice.id,
      journalId: banque.id,
      montant: interets,
      proposes: o.modeInterets === ModeInteretsTresorerie.POST_COMPTES ? proposes : null,
      regularisationId: null,
      libelle,
      lignes,
      statut: StatutOperationTresorerie.ECHUE,
    });
  }

  // ----- Annulation -------------------------------------------------------------

  /**
   * L'ANNULATION VA À REBOURS · le dernier acte vivant seul ; au brouillard
   * sa pièce est retirée, validée elle est inscrite en NÉGATIF et reste liée
   * (AUDCIF art. 20, al. 2). La mise en place annulée laisse l'opération
   * ANNULÉE, l'échéance annulée la rend EN COURS.
   */
  async annulerActe(tenantId: string, userId: string, id: string, acteId: string, dto: AnnulerActeTresorerieDto) {
    const motif = (typeof dto.motif === 'string' ? dto.motif : '').trim();
    if (motif.length < 3 || motif.length > 500) throw new BadRequestException("Le motif de l'annulation est exigé · de trois à cinq cents caractères.");
    const o = await this.prisma.operationTresorerie.findFirst({ where: { id, tenantId }, include: INCLURE });
    if (!o) throw new NotFoundException('Opération introuvable pour ce dossier.');
    const acte = o.actes.find((a) => a.id === acteId);
    if (!acte) throw new NotFoundException('Acte introuvable sur cette opération.');
    if (acte.annuleLe) throw new ConflictException(`L'acte « ${LIBELLES_ACTE[acte.nature]} » est déjà annulé.`);
    const vivants = o.actes.filter((a) => !a.annuleLe);
    const dernier = vivants[vivants.length - 1];
    if (dernier.id !== acte.id) {
      throw new BadRequestException(`L'annulation va à rebours · annulez d'abord « ${LIBELLES_ACTE[dernier.nature]} » du ${jour(dernier.date)}, puis « ${LIBELLES_ACTE[acte.nature]} ».`);
    }
    if (acte.ecriture) await this.pieceAnnulable(tenantId, acte.ecriture.id, `de l'acte « ${LIBELLES_ACTE[acte.nature]} »`);
    const restants = vivants.filter((a) => a.id !== acte.id);
    const statut = !restants.some((a) => a.nature === NatureActeTresorerie.MISE_EN_PLACE)
      ? StatutOperationTresorerie.ANNULEE
      : restants.some((a) => a.nature === NatureActeTresorerie.ECHEANCE)
        ? StatutOperationTresorerie.ECHUE
        : StatutOperationTresorerie.EN_COURS;
    const ecritureId = acte.ecriture?.id ?? null;
    // EN ISOLATION SÉRIALISABLE, comme les actes que `creerAvec` passe · en lecture validée, un acte passé en même
    // temps sur un instantané antérieur ne voyait pas cette annulation (relecture du 2026-10-22, B1).
    return avecRetrySerialisable(this.prisma, async (tx) => {
      await this.verrouillerEtRelire(tx, tenantId, o);
      // MARQUÉ PAR UNE MISE À JOUR UNITAIRE · le motif entre au journal d'audit (AUDCIF art. 22, 5° et 6°).
      await this.prendre(
        () => tx.acteOperationTresorerie.update({ where: { id: acte.id, tenantId, annuleLe: null }, data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: motif }, select: { id: true } }),
        "Cet acte n'est plus annulable · relisez l'opération.",
      );
      const negatif = ecritureId ? await this.retirerOuContrePasser(tx, tenantId, userId, acte.id, ecritureId, `de l'acte « ${LIBELLES_ACTE[acte.nature]} »`, `Annulation · ${LIBELLES_ACTE[acte.nature]} de ${o.reference}`, motif) : null;
      await tx.acteOperationTresorerie.update({ where: { id: acte.id, tenantId }, data: { ecritureId: negatif ? ecritureId : null, ecritureNegatifId: negatif } });
      await this.prendre(
        () => tx.operationTresorerie.update({ where: { id: o.id, tenantId, statut: o.statut }, data: { statut }, select: { id: true } }),
        "Cette opération a changé d'état pendant l'annulation · rien n'est annulé, relisez-la.",
      );
      return { operationId: o.id, acteId: acte.id, statut, traitement: negatif ? 'INSCRITE_EN_NEGATIF' : ecritureId ? 'SUPPRIMEE' : 'SANS_PIECE', ecritureNegatifId: negatif };
    }, "Un autre geste est passé sur cette opération pendant l'annulation · relisez-la avant de recommencer.");
  }

  // ----- Aides ------------------------------------------------------------------

  private lignesRegularisation(type: TypeOperationTresorerie, mode: ModeInteretsTresorerie, part: number): LignePropose[] {
    const l = (role: LignePropose['role'], debit: number, credit: number): LignePropose => ({ role, debit, credit });
    if (type === TypeOperationTresorerie.FINANCEMENT) {
      return mode === ModeInteretsTresorerie.POST_COMPTES ? [l('INTERETS', part, 0), l('COURUS', 0, part)] : [l('AVANCE', part, 0), l('INTERETS', 0, part)];
    }
    return mode === ModeInteretsTresorerie.POST_COMPTES ? [l('COURUS', part, 0), l('INTERETS', 0, part)] : [l('INTERETS', part, 0), l('AVANCE', 0, part)];
  }

  /** Les lignes proposées, rôle par rôle, sur les comptes de l'opération · un rôle sans compte est une erreur du module, jamais une ligne perdue. */
  private lignes(proposees: LignePropose[], comptes: Record<LignePropose['role'], string | null>, libelle: string) {
    return proposees.map((p) => {
      const compteId = comptes[p.role];
      if (!compteId) throw new ConflictException(`Le rôle ${p.role} n'a pas de compte sur cette opération · rien n'est passé.`);
      return { compteId, libelle, debit: p.debit, credit: p.credit };
    });
  }

  private async passerActe(
    tenantId: string,
    userId: string,
    o: OperationLue,
    a: {
      nature: NatureActeTresorerie;
      date: string;
      exerciceId: string;
      journalId: string;
      montant: number;
      proposes: number | null;
      regularisationId: string | null;
      libelle: string;
      lignes: { compteId: string; libelle: string; debit: number; credit: number }[];
      statut?: StatutOperationTresorerie;
    },
  ) {
    const res = await this.ecritures.creerAvec(
      tenantId,
      userId,
      { exerciceId: a.exerciceId, journalId: a.journalId, date: a.date, libelle: a.libelle, reference: `${o.reference} · ${LIBELLES_ACTE[a.nature]}`.slice(0, 190), lignes: a.lignes },
      async (tx, ecriture) => {
        await this.verrouillerEtRelire(tx, tenantId, o);
        if (a.statut && a.statut !== o.statut) {
          await this.prendre(
            () => tx.operationTresorerie.update({ where: { id: o.id, tenantId, statut: o.statut }, data: { statut: a.statut }, select: { id: true } }),
            `Cette opération n'est plus « ${o.statut} » · relisez-la avant d'y porter un acte.`,
          );
        }
        return tx.acteOperationTresorerie.create({
          data: {
            tenantId,
            operationId: o.id,
            nature: a.nature,
            date: aMinuit(a.date),
            exerciceId: a.exerciceId,
            montantInterets: new Prisma.Decimal(a.montant),
            interetsProposes: a.proposes === null ? null : new Prisma.Decimal(a.proposes),
            regularisationId: a.regularisationId,
            ecritureId: ecriture.id,
            createdBy: userId,
          },
          select: { id: true },
        });
      },
    );
    return { ...(await this.operation(tenantId, o.id)), acteId: res.suite.id, ecritureId: res.ecriture.id };
  }

  /** Les exercices du dossier · une poignée (un par an), bornée par prudence. */
  private exercicesDuDossier(tenantId: string): Promise<ExerciceLu[]> {
    return this.prisma.exercice.findMany({ where: { tenantId }, orderBy: { dateDebut: 'asc' }, take: 200, select: { id: true, dateDebut: true, dateFin: true, statut: true } });
  }

  /** Un acte déclaré à zéro · constaté, sans pièce, sous le même verrou que les autres. */
  private async passerActeSansPiece(
    tenantId: string,
    userId: string,
    o: OperationLue,
    a: { nature: NatureActeTresorerie; date: Date; exerciceId: string; proposes: number | null; regularisationId?: string },
  ) {
    const acte = await avecRetrySerialisable(this.prisma, async (tx) => {
      await this.verrouillerEtRelire(tx, tenantId, o);
      return tx.acteOperationTresorerie.create({
        data: {
          tenantId,
          operationId: o.id,
          nature: a.nature,
          date: a.date,
          exerciceId: a.exerciceId,
          montantInterets: new Prisma.Decimal(0),
          interetsProposes: a.proposes === null ? null : new Prisma.Decimal(a.proposes),
          regularisationId: a.regularisationId ?? null,
          createdBy: userId,
        },
        select: { id: true },
      });
    }, "Un autre geste est passé sur cette opération · relisez-la avant de recommencer.");
    return { ...(await this.operation(tenantId, o.id)), acteId: acte.id, ecritureId: null };
  }

  private async operationVivante(tenantId: string, id: string) {
    const o = await this.prisma.operationTresorerie.findFirst({ where: { id, tenantId }, include: INCLURE });
    if (!o) throw new NotFoundException('Opération introuvable pour ce dossier.');
    if (o.statut !== StatutOperationTresorerie.EN_COURS) throw new BadRequestException(`L'opération ${o.reference} est ${o.statut === StatutOperationTresorerie.ECHUE ? 'échue' : 'annulée'} · aucun acte ne s'y porte plus.`);
    return o;
  }

  private async compteLu(tenantId: string, id: string) {
    const c = await this.prisma.compte.findFirst({ where: { id, tenantId }, select: { id: true, numero: true, intitule: true, typeCompte: true, estActif: true } });
    if (!c) throw new NotFoundException('Compte introuvable pour ce dossier.');
    if (c.typeCompte !== TypeCompteDetailTotal.DETAIL) throw new BadRequestException(`Le compte ${c.numero} est un compte de regroupement · choisissez un compte d'imputation.`);
    if (!c.estActif) throw new BadRequestException(`Le compte ${c.numero} est en sommeil.`);
    return c;
  }

  /** Le 476 ou le 477 du plan du dossier · un compte d'imputation actif, jamais deviné. */
  private async compteDAvance(tenantId: string, type: TypeOperationTresorerie) {
    const numero = compteAvance(type);
    const c = await this.prisma.compte.findFirst({ where: { tenantId, numero }, select: { id: true, numero: true, typeCompte: true, estActif: true } });
    if (!c || c.typeCompte !== TypeCompteDetailTotal.DETAIL) {
      throw new BadRequestException(`Le compte ${numero} (fiche du compte 47) n'est pas un compte d'imputation de ce dossier · rétablissez-le dans le Plan comptable, puis régularisez.`);
    }
    if (!c.estActif) throw new BadRequestException(`Le compte ${numero} est en sommeil · réactivez-le, puis régularisez.`);
    return c;
  }

  /** Un journal de banque en francs (`banque-en-francs.ts`, règle commune aux titres de placement). */
  private banque(tenantId: string, journalId: string) {
    return journalDeBanqueEnFrancs(this.prisma, tenantId, journalId, 'un crédit de trésorerie ou un dépôt à terme');
  }

  private async journalOd(tenantId: string, journalId: string) {
    const j = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true, code: true, type: true, estActif: true } });
    if (!j) throw new NotFoundException("Journal d'opérations diverses introuvable pour ce dossier.");
    if (j.type !== TypeJournal.GENERAL) throw new BadRequestException(`Le journal ${j.code} n'est pas un journal d'opérations diverses · la régularisation à la clôture ne touche aucune trésorerie.`);
    if (!j.estActif) throw new BadRequestException(`Le journal ${j.code} est en sommeil.`);
    return j;
  }

  /** Un cours ou un taux retiré entre la lecture et l'écriture (clé étrangère) · 409 nommé, jamais un 500. */
  private async retenuOuConflit<T>(geste: () => Promise<T>): Promise<T> {
    try {
      return await geste();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw new ConflictException('Le cours ou le taux de référence retenu vient d’être retiré · relisez les taux, puis recommencez.');
      throw e;
    }
  }

  private async prendre<T>(geste: () => Promise<T>, conflit: string): Promise<T> {
    try {
      return await geste();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new ConflictException(conflit);
      throw e;
    }
  }

  /** La ligne de l'opération prise `FOR UPDATE`, puis ses actes vivants relus · changés depuis la lecture qui a jugé le geste, 409. */
  private async verrouillerEtRelire(tx: Prisma.TransactionClient, tenantId: string, o: OperationLue) {
    const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "operations_tresorerie" WHERE id = ${o.id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    if (verrou.length !== 1) throw new ConflictException("Cette opération n'existe plus · relisez la liste.");
    const relus = (await tx.acteOperationTresorerie.findMany({ where: { tenantId, operationId: o.id, annuleLe: null }, select: { id: true } })).map((a) => a.id).sort();
    const lus = o.actes.filter((a) => !a.annuleLe).map((a) => a.id).sort();
    if (lus.length !== relus.length || lus.some((id, i) => id !== relus[i])) {
      throw new ConflictException("Les actes de cette opération ont changé pendant le geste (un autre geste vient de passer) · relisez-la avant de recommencer.");
    }
  }

  private async exerciceDeLaDate(tenantId: string, date: string, objet: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { tenantId, dateDebut: { lte: aMinuit(date) }, dateFin: { gte: aMinuit(date) } }, select: { id: true, statut: true } });
    if (!exercice) throw new BadRequestException(`Aucun exercice du dossier ne couvre la date ${objet}.`);
    if (exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(`L'exercice de la date ${objet} est clôturé · rien ne s'y passe (AUDCIF art. 20, al. 3).`);
    return exercice;
  }

  private async exerciceOuvert(tenantId: string, id: string) {
    const e = await this.prisma.exercice.findFirst({ where: { id, tenantId }, select: { id: true, statut: true, dateDebut: true, dateFin: true } });
    if (!e) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    if (e.statut === StatutExercice.CLOTURE) throw new BadRequestException("Cet exercice est clôturé · rien ne s'y passe (AUDCIF art. 20, al. 3).");
    return e;
  }

  private async pieceAnnulable(tenantId: string, ecritureId: string, objet: string) {
    const e = await this.prisma.ecriture.findFirst({
      where: { id: ecritureId, tenantId },
      select: { id: true, numeroPiece: true, exercice: { select: { statut: true } }, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
    });
    if (!e) throw new ConflictException(`La pièce ${objet} n'existe plus · relisez avant d'annuler.`);
    if (e.exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(`La pièce ${objet} appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).`);
    const tenue = motifLignesTenues(e.lignes, `la pièce ${objet} (n° ${e.numeroPiece ?? '·'})`, "annuler l'acte");
    if (tenue) throw new BadRequestException(tenue);
  }

  private async retirerOuContrePasser(tx: Prisma.TransactionClient, tenantId: string, userId: string, acteId: string, ecritureId: string, objet: string, geste: string, motif: string) {
    const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
    if (!e) throw new ConflictException(`La pièce ${objet} n'existe plus · relisez avant d'annuler.`);
    if (e.statut === StatutEcriture.BROUILLARD) {
      const relues = await tx.ligneEcriture.findMany({ where: { ecritureId, ecriture: { tenantId } }, select: { lettre: true, lettrageId: true, rapprochementId: true } });
      const tenue = motifLignesTenues(relues, `la pièce ${objet}`, geste);
      if (tenue) throw new BadRequestException(tenue);
      // L'acte RETIENT sa pièce (RESTRICT) · le lien se dénoue AVANT le retrait, sinon la base refuse la suppression.
      await tx.acteOperationTresorerie.update({ where: { id: acteId, tenantId }, data: { ecritureId: null } });
      await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
      const r = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
      if (r.count !== 1) throw new ConflictException(`La pièce ${objet} a été validée pendant l'annulation · rien n'est retiré. Relancez · validée, elle s'inscrira en négatif.`);
      return null;
    }
    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, `${geste} · ${motif}`, tx);
    return negatif.id;
  }
}
