import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NatureActeEffet, Prisma, SensEffet, StatutEcriture, StatutEffet, StatutExercice, TypeCompteDetailTotal, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { EcritureService } from '../comptabilite/ecriture.service';
import { LettrageService } from '../lettrage/lettrage.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { refuserSiLignesFigees } from '../exercice/gel-cloture';
import {
  LIBELLES_ACTE,
  LIBELLES_SENS,
  ROLES_COMPTE_EFFET,
  lignesAcceptation,
  lignesDecompte,
  lignesDenouement,
  lignesEncaissement,
  lignesImpaye,
  lignesPaiement,
  lignesRemiseEncaissement,
  lignesRemiseEscompte,
  motifRefusActe,
  motifRefusDecompte,
  motifRefusEffet,
  racineTiers,
  racinesDuRole,
  round2,
  statutApresActes,
  type EffetJuge,
  type LigneProposee,
  type RoleCompteEffet,
} from './effet-commerce';
import type {
  AccepterEffetDto,
  AnnulerActeDto,
  BonAPayerDto,
  DateActeDto,
  DecompteEffetDto,
  EncaisserEffetDto,
  EscompterEffetDto,
  ImpayeEffetDto,
  PayerEffetDto,
  RemettreEffetDto,
} from './effets.dto';

const PLAFOND_LISTE = 500;

/** Les statuts d'un effet qui attend encore un acte · listés quel que soit l'exercice choisi. */
const STATUTS_EN_COURS: StatutEffet[] = [StatutEffet.EN_PORTEFEUILLE, StatutEffet.REMIS_A_L_ENCAISSEMENT, StatutEffet.ESCOMPTE, StatutEffet.BON_A_PAYER];
const COMPTE_SELECT = { id: true, numero: true, intitule: true, typeCompte: true, estActif: true } as const;
const ACTES_INCLUDE = {
  orderBy: [{ date: 'asc' as const }, { createdAt: 'asc' as const }],
  select: {
    id: true,
    nature: true,
    date: true,
    montant: true,
    detail: true,
    annuleLe: true,
    motifAnnulation: true,
    compte: { select: { id: true, numero: true, intitule: true } },
    ecriture: { select: { id: true, numeroPiece: true, statut: true } },
    ecritureNegatif: { select: { id: true, numeroPiece: true, statut: true } },
  },
};

const jour = (d: Date) => d.toISOString().slice(0, 10);
const aMinuit = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type EffetLu = Prisma.EffetCommerceGetPayload<{ include: { compteTiers: { select: typeof COMPTE_SELECT }; compteEffet: { select: typeof COMPTE_SELECT }; actes: typeof ACTES_INCLUDE } }>;

/**
 * EFFETS DE COMMERCE (ligne sage-l3, fonction 39). Règles dans
 * `effet-commerce.ts` (fiches des comptes 40, 41, 51, 56, 63 et 67 de
 * l'AUDCIF) ; ici les lectures, les transactions et les refus nommés. Chaque
 * acte naît avec sa pièce (`creerAvec`), le statut est RELU dans la
 * transaction (`updateMany` filtré sur le statut attendu, sinon 409),
 * l'annulation va à rebours et s'inscrit en négatif (AUDCIF art. 20, al. 2).
 */
@Injectable()
export class EffetsService {
  private readonly journalServeur = new Logger(EffetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
    private readonly lettrage: LettrageService,
  ) {}

  // ----- Lectures -----------------------------------------------------------

  async lister(tenantId: string, exerciceId: string, sens: string | undefined, statut: string | undefined) {
    // `Object.keys` et non `in` · « constructor » passait la chaîne de
    // prototype et finissait en 500 chez Prisma (fonction 40, relecture m3).
    if (sens !== undefined && !Object.keys(SensEffet).includes(sens)) throw new BadRequestException('Le sens est A_RECEVOIR ou A_PAYER.');
    if (statut !== undefined && !Object.keys(StatutEffet).includes(statut)) throw new BadRequestException(`Le statut est l'un de ${Object.keys(StatutEffet).join(', ')}.`);
    // Le `tenantId` écrit DANS chaque appel · le balayage du cloisonnement lit
    // la borne sur l'appel, jamais dans une variable (cloisonnement.spec.ts).
    const filtre = { ...(sens ? { sens: sens as SensEffet } : {}), ...(statut ? { statut: statut as StatutEffet } : {}) };
    // UN EFFET EN COURS SE LISTE SANS BORNE D'EXERCICE (premier tour de
    // relecture, M1 · même règle que les valeurs à remettre de la fonction 40)
    // · un escompte de décembre se dénoue en janvier, et sous l'exercice N+1
    // la fenêtre disait « Aucun effet ». L'exercice choisi ne borne que les
    // effets arrivés à leur terme (encaissés, payés, impayés, annulés).
    const where = { ...filtre, OR: [{ statut: { in: STATUTS_EN_COURS } }, { exerciceId }] };
    const [effets, total] = await Promise.all([
      this.prisma.effetCommerce.findMany({
        where: { tenantId, ...where },
        orderBy: [{ dateEcheance: 'asc' }, { createdAt: 'asc' }],
        take: PLAFOND_LISTE,
        include: { compteTiers: { select: COMPTE_SELECT }, compteEffet: { select: COMPTE_SELECT }, actes: ACTES_INCLUDE },
      }),
      this.prisma.effetCommerce.count({ where: { tenantId, ...where } }),
    ]);
    return { effets: effets.map((e) => this.rendre(e)), total, tronque: total > effets.length };
  }

  async effet(tenantId: string, id: string) {
    const e = await this.prisma.effetCommerce.findFirst({
      where: { id, tenantId },
      include: { compteTiers: { select: COMPTE_SELECT }, compteEffet: { select: COMPTE_SELECT }, actes: ACTES_INCLUDE },
    });
    if (!e) throw new NotFoundException('Effet introuvable pour ce dossier.');
    return this.rendre(e);
  }

  private rendre(e: EffetLu) {
    return {
      ...e,
      montant: Number(e.montant),
      libelleSens: LIBELLES_SENS[e.sens],
      actes: e.actes.map((a) => ({ ...a, montant: Number(a.montant), libelle: LIBELLES_ACTE[a.nature] })),
    };
  }

  /** Les comptes d'un rôle sous les racines que les fiches prescrivent · un numéro, deux plans. */
  async comptes(tenantId: string, role: string | undefined, sens: string | undefined) {
    if (sens !== SensEffet.A_RECEVOIR && sens !== SensEffet.A_PAYER) throw new BadRequestException('Le sens est A_RECEVOIR ou A_PAYER.');
    if (role !== 'TIERS' && !ROLES_COMPTE_EFFET.includes(role as RoleCompteEffet)) {
      throw new BadRequestException(`Le rôle du compte est l'un de TIERS, ${ROLES_COMPTE_EFFET.join(', ')}.`);
    }
    const dossier = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    // Le rôle TIERS suit le refus du portefeuille · au SYCEBNL, l'effet à
    // recevoir n'existe pas, et servir les 411 (adhérents) à un geste que
    // l'acceptation refuse ensuite serait un choix pour rien (premier tour, m6).
    const porte = racinesDuRole(dossier.referentiel, 'PORTEFEUILLE', sens);
    const r = porte.racines === null ? porte : role === 'TIERS' ? { racines: [racineTiers(sens)], motif: null } : racinesDuRole(dossier.referentiel, role as RoleCompteEffet, sens);
    if (r.racines === null) return { racines: null, comptes: [], motif: r.motif, total: 0, tronque: false };
    // Un COLLECTIF qui porte des comptes individuels n'est pas offert au rôle
    // TIERS (premier tour, M2) · la saisie le refuse, et l'acceptation solde le
    // compte du tiers qui a facturé, jamais son collectif.
    const sousLesRacines = {
      typeCompte: TypeCompteDetailTotal.DETAIL,
      estActif: true,
      OR: r.racines.map((racine) => ({ numero: { startsWith: racine } })),
      ...(role === 'TIERS' ? { individuels: { none: { tenantId } } } : {}),
    };
    const [comptes, total] = await Promise.all([
      this.prisma.compte.findMany({ where: { tenantId, ...sousLesRacines }, select: { id: true, numero: true, intitule: true, estRetenu: true }, orderBy: [{ estRetenu: 'desc' }, { numero: 'asc' }], take: 200 }),
      this.prisma.compte.count({ where: { tenantId, ...sousLesRacines } }),
    ]);
    return { racines: r.racines, comptes, motif: null, total, tronque: total > comptes.length };
  }

  // ----- Acceptation --------------------------------------------------------

  /**
   * L'ACCEPTATION · D 412 / C 411 (fiche du 41) ou D 401 / C 402 (fiche du
   * 40), au journal d'opérations choisi, l'effet et son premier acte nés dans
   * la même transaction ; l'ÉCHÉANCE est posée sur la pièce pour la TVA
   * (décret n° 011/42, art. 57 et 96 · `Ecriture.dateEncaissementEffet`). Les
   * lignes ouvertes du tiers que l'effet règle se lettrent ensuite avec lui
   * (partiel admis) ; un lettrage refusé retire la pièce, l'acte et l'effet,
   * l'erreur d'origine remonte toujours.
   */
  async accepter(tenantId: string, userId: string, dto: AccepterEffetDto) {
    const motif = motifRefusEffet(dto);
    if (motif) throw new BadRequestException(motif);
    const [dossier, journal, tiers, compteEffet] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
      this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId }, select: { id: true, code: true, type: true, estActif: true } }),
      this.prisma.compte.findFirst({ where: { id: dto.compteTiersId, tenantId }, select: COMPTE_SELECT }),
      this.prisma.compte.findFirst({ where: { id: dto.compteEffetId, tenantId }, select: COMPTE_SELECT }),
    ]);
    if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    if (journal.type !== TypeJournal.GENERAL) throw new BadRequestException(`Le journal ${journal.code} n'est pas un journal d'opérations diverses · l'acceptation d'un effet ne touche aucune trésorerie.`);
    if (!journal.estActif) throw new BadRequestException(`Le journal ${journal.code} est en sommeil.`);
    if (!tiers) throw new NotFoundException('Compte du tiers introuvable pour ce dossier.');
    if (!compteEffet) throw new NotFoundException("Compte de l'effet introuvable pour ce dossier.");
    const portefeuille = racinesDuRole(dossier.referentiel, 'PORTEFEUILLE', dto.sens);
    if (portefeuille.racines === null) throw new BadRequestException(portefeuille.motif);
    if (compteEffet.typeCompte !== TypeCompteDetailTotal.DETAIL || !portefeuille.racines.some((r) => compteEffet.numero.startsWith(r))) {
      throw new BadRequestException(
        `Le compte ${compteEffet.numero} n'est pas un compte de portefeuille d'effets (${portefeuille.racines.join(' ou ')}, fiche du compte ${dto.sens === SensEffet.A_RECEVOIR ? '41 · 412 « effets à recevoir en portefeuille »' : '40 · 402 « effets à payer »'}).`,
      );
    }
    if (!compteEffet.estActif) throw new BadRequestException(`Le compte ${compteEffet.numero} est en sommeil.`);
    const racine = racineTiers(dto.sens);
    if (tiers.typeCompte !== TypeCompteDetailTotal.DETAIL || !tiers.numero.startsWith(racine)) {
      throw new BadRequestException(`Le compte ${tiers.numero} n'est pas un compte ${dto.sens === SensEffet.A_RECEVOIR ? 'client (411)' : 'fournisseur (401)'} d'imputation · l'acceptation solde le tiers qui a facturé.`);
    }
    if (!tiers.estActif) throw new BadRequestException(`Le compte ${tiers.numero} est en sommeil.`);
    if (await this.prisma.compte.count({ where: { tenantId, collectifId: tiers.id } })) {
      throw new BadRequestException(`Le compte ${tiers.numero} est un collectif qui porte des comptes de tiers · choisissez le compte individuel du tiers qui a facturé.`);
    }
    const exercice = await this.exerciceOuvert(tenantId, dto.exerciceId);
    const dateCreation = dto.dateCreation as string;
    const dateEcheance = dto.dateEcheance as string;
    if (dateCreation < jour(exercice.dateDebut) || dateCreation > jour(exercice.dateFin)) throw new BadRequestException("La date de création de l'effet tombe dans son exercice.");
    const montant = round2(dto.montant as number);
    const reference = (dto.reference as string).trim();
    const ids = [...new Set(dto.ligneIds ?? [])];
    const reglees = ids.length > 0 ? await this.verifierLignesReglees(tenantId, tiers, ids, montant, dto.sens, dateCreation) : null;
    const libelle = `${LIBELLES_SENS[dto.sens]} ${reference} · ${tiers.intitule}`.slice(0, 190);
    const r = await this.ecritures.creerAvec(
      tenantId,
      userId,
      {
        exerciceId: exercice.id,
        journalId: journal.id,
        date: dateCreation,
        libelle,
        reference: `Effet ${reference} · échéance ${dateEcheance}`.slice(0, 190),
        lignes: lignesAcceptation({ sens: dto.sens, compteEffetId: compteEffet.id, compteTiersId: tiers.id, montant, libelle }),
      },
      async (tx, ecriture) => {
        // L'ÉCHÉANCE SUR LA PIÈCE · c'est elle que le moteur de la TVA lit
        // comme date du règlement (`dateDuReglement`), aux deux sens.
        const posee = await tx.ecriture.updateMany({ where: { id: ecriture.id, tenantId }, data: { dateEncaissementEffet: aMinuit(dateEcheance) } });
        if (posee.count !== 1) throw new ConflictException("La pièce d'acceptation n'a pas reçu l'échéance de l'effet · rien n'est enregistré.");
        return tx.effetCommerce.create({
          data: {
            tenantId,
            exerciceId: exercice.id,
            sens: dto.sens,
            journalId: journal.id,
            compteTiersId: tiers.id,
            compteEffetId: compteEffet.id,
            montant: new Prisma.Decimal(montant),
            reference,
            tire: typeof dto.tire === 'string' && dto.tire.trim() ? dto.tire.trim() : null,
            dateCreation: aMinuit(dateCreation),
            dateEcheance: aMinuit(dateEcheance),
            createdBy: userId,
            actes: {
              create: {
                tenantId,
                nature: NatureActeEffet.ACCEPTATION,
                date: aMinuit(dateCreation),
                compteId: compteEffet.id,
                montant: new Prisma.Decimal(montant),
                ecritureId: ecriture.id,
                createdBy: userId,
              },
            },
          },
          select: { id: true },
        });
      },
    );
    let lettre: string | null = null;
    if (ids.length > 0) {
      try {
        // La ligne du tiers se cherche DANS le `try` (premier tour, m4) · absente,
        // la pièce et l'effet sont retirés comme sur un lettrage refusé.
        const ligneTiers = r.ecriture.lignes.find((l) => l.compteId === tiers.id);
        if (!ligneTiers) throw new ConflictException("La ligne du tiers est introuvable dans la pièce d'acceptation.");
        // `lettrerManuel` est UNE transaction · refusé, il n'a rien posé.
        const l = await this.lettrage.lettrerManuel(tenantId, tiers.id, [...ids, ligneTiers.id], userId, { autoriserPartiel: true });
        lettre = l.lettre;
      } catch (e) {
        try {
          await this.ecritures.retirerCompensation(tenantId, r.ecriture.id, async (tx) => {
            await tx.acteEffet.deleteMany({ where: { effetId: r.suite.id, tenantId } });
            await tx.effetCommerce.deleteMany({ where: { id: r.suite.id, tenantId } });
          });
        } catch (nettoyage) {
          this.journalServeur.error(
            `Acceptation ${r.ecriture.id} du dossier ${tenantId} restée au brouillard · son retrait après l'échec du lettrage a échoué`,
            nettoyage instanceof Error ? nettoyage.stack : String(nettoyage),
          );
        }
        // Le refus dit que l'effet n'est pas né · la pièce a été retirée, le numéro de pièce consommé.
        throw e instanceof BadRequestException || e instanceof ConflictException
          ? new BadRequestException(`L'effet n'a pas été accepté · ${(e.getResponse() as { message?: string }).message ?? e.message}`)
          : e;
      }
    }
    const effet = await this.effet(tenantId, r.suite.id);
    return { ...effet, lettre, lignesAuBrouillard: reglees?.auBrouillard ?? 0 };
  }

  /**
   * PLUS QUE LE DÛ EST REFUSÉ AVANT LA PIÈCE (même règle que le Règlement
   * des tiers et la réception d'un chèque) · une ligne déjà lettrée, pointée,
   * de situation ou d'à-nouveau provisoire aussi, nommée.
   */
  private async verifierLignesReglees(tenantId: string, tiers: { id: string; numero: string }, ids: string[], montant: number, sens: SensEffet, dateCreation: string) {
    const lignes = await this.prisma.ligneEcriture.findMany({
      where: { id: { in: ids }, compteId: tiers.id, ecriture: { tenantId } },
      select: { id: true, debit: true, credit: true, lettrageId: true, rapprochementId: true, ecriture: { select: { statut: true, estANouveauProvisoire: true, numeroPiece: true, date: true } } },
    });
    if (lignes.length !== ids.length) throw new BadRequestException(`${ids.length - lignes.length} ligne(s) choisie(s) ne sont pas sur le compte ${tiers.numero} de ce dossier · rechargez la liste.`);
    const tenue = lignes.find((l) => l.lettrageId || l.rapprochementId || l.ecriture.estANouveauProvisoire || l.ecriture.statut === StatutEcriture.SITUATION);
    if (tenue) {
      const piece = `La ligne de la pièce n° ${tenue.ecriture.numeroPiece ?? '·'}`;
      if (tenue.lettrageId) throw new BadRequestException(`${piece} appartient déjà à un lettrage · délettrez-le ou complétez-le, puis acceptez l'effet.`);
      if (tenue.rapprochementId) throw new BadRequestException(`${piece} est pointée au rapprochement bancaire · dépointez-la d'abord.`);
      if (tenue.ecriture.estANouveauProvisoire) throw new BadRequestException(`${piece} est un à-nouveau provisoire, qui ne se lettre pas · clôturez l'exercice précédent ou passez un bilan d'ouverture.`);
      throw new BadRequestException(`${piece} est une écriture de situation, qui ne se lettre pas.`);
    }
    // L'effet règle une facture ANTÉRIEURE (premier tour, m5) · datée après
    // l'acceptation, elle ferait un paiement avant sa dette, que l'imputation
    // de l'art. 154 lirait de travers.
    const posterieure = lignes.find((l) => jour(l.ecriture.date) > dateCreation);
    if (posterieure) {
      throw new BadRequestException(`La pièce n° ${posterieure.ecriture.numeroPiece ?? '·'} est datée du ${jour(posterieure.ecriture.date)}, après l'acceptation du ${dateCreation} · un effet règle une facture antérieure.`);
    }
    // Une ligne figée par une clôture de période ne se lettre pas · jugée AVANT la pièce.
    await refuserSiLignesFigees(this.prisma, tenantId, ids, "accepter l'effet");
    // Le dû se lit dans le sens du tiers · débiteur chez le client, créditeur chez le fournisseur.
    const du = round2(lignes.reduce((t, l) => t + (sens === SensEffet.A_RECEVOIR ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit)), 0));
    if (montant > du + 0.005) {
      throw new BadRequestException(`Le nominal de l'effet (${montant.toFixed(2)}) dépasse le dû des lignes choisies (${du.toFixed(2)}) · plus que le dû n'est pas un règlement.`);
    }
    return { auBrouillard: lignes.filter((l) => l.ecriture.statut === StatutEcriture.BROUILLARD).length };
  }

  // ----- Les actes ----------------------------------------------------------

  async remettre(tenantId: string, userId: string, id: string, dto: RemettreEffetDto) {
    const e = await this.effetVivant(tenantId, id);
    const compte = await this.compteDuRole(tenantId, e, 'ENCAISSEMENT', dto.compteEncaissementId);
    const date = this.dateJugee(e, NatureActeEffet.REMISE_ENCAISSEMENT, dto.date);
    const libelle = `Remise à l'encaissement · effet ${e.reference}`.slice(0, 190);
    return this.passerActe(tenantId, userId, e, {
      nature: NatureActeEffet.REMISE_ENCAISSEMENT,
      date,
      journalId: e.journalId,
      compteId: compte.id,
      reference: `Effet ${e.reference}`,
      libelle,
      lignes: lignesRemiseEncaissement({ compteEncaissementId: compte.id, compteEffetId: e.compteEffetId, montant: Number(e.montant), libelle }),
    });
  }

  async escompter(tenantId: string, userId: string, id: string, dto: EscompterEffetDto) {
    const e = await this.effetVivant(tenantId, id);
    const compte = await this.compteDuRole(tenantId, e, 'ESCOMPTE_NON_ECHU', dto.compteEscompteNonEchuId);
    const date = this.dateJugee(e, NatureActeEffet.REMISE_ESCOMPTE, dto.date);
    const libelle = `Remise à l'escompte · effet ${e.reference}`.slice(0, 190);
    return this.passerActe(tenantId, userId, e, {
      nature: NatureActeEffet.REMISE_ESCOMPTE,
      date,
      journalId: e.journalId,
      compteId: compte.id,
      reference: `Effet ${e.reference}`,
      libelle,
      lignes: lignesRemiseEscompte({ compteEscompteNonEchuId: compte.id, compteEffetId: e.compteEffetId, montant: Number(e.montant), libelle }),
    });
  }

  async decompte(tenantId: string, userId: string, id: string, dto: DecompteEffetDto) {
    const e = await this.effetVivant(tenantId, id);
    const date = this.dateJugee(e, NatureActeEffet.DECOMPTE_ESCOMPTE, dto.date);
    const banque = await this.banque(tenantId, dto.journalBanqueId);
    const [credit, frais, commission] = await Promise.all([
      this.compteDuRole(tenantId, e, 'CREDIT_ESCOMPTE', dto.compteCreditEscompteId),
      dto.compteFraisId ? this.compteDuRole(tenantId, e, 'FRAIS_ESCOMPTE', dto.compteFraisId) : null,
      dto.compteCommissionId ? this.compteDuRole(tenantId, e, 'COMMISSION', dto.compteCommissionId) : null,
    ]);
    const montant = Number(e.montant);
    const motif = motifRefusDecompte({ montant, frais: dto.frais, commission: dto.commission, referencePiece: dto.referencePiece, compteFraisId: frais?.id ?? null, compteCommissionId: commission?.id ?? null });
    if (motif) throw new BadRequestException(motif);
    const fraisM = round2((dto.frais as number | undefined) ?? 0);
    const commissionM = round2((dto.commission as number | undefined) ?? 0);
    const referencePiece = (dto.referencePiece as string).trim();
    const libelle = `Décompte d'escompte · effet ${e.reference}`.slice(0, 190);
    return this.passerActe(tenantId, userId, e, {
      nature: NatureActeEffet.DECOMPTE_ESCOMPTE,
      date,
      journalId: banque.id,
      compteId: credit.id,
      reference: referencePiece,
      libelle,
      detail: { frais: fraisM, commission: commissionM, net: round2(montant - fraisM - commissionM), referencePiece, compteBanqueId: banque.compteTresorerie.id, journalBanqueId: banque.id },
      lignes: lignesDecompte({
        compteBanqueId: banque.compteTresorerie.id,
        compteFraisId: frais?.id ?? null,
        compteCommissionId: commission?.id ?? null,
        compteCreditEscompteId: credit.id,
        montant,
        frais: fraisM,
        commission: commissionM,
        libelle,
      }),
    });
  }

  async encaisser(tenantId: string, userId: string, id: string, dto: EncaisserEffetDto) {
    const e = await this.effetVivant(tenantId, id);
    const date = this.dateJugee(e, NatureActeEffet.ENCAISSEMENT, dto.date);
    const banque = await this.banque(tenantId, dto.journalBanqueId);
    const commission = dto.compteCommissionId ? await this.compteDuRole(tenantId, e, 'COMMISSION', dto.compteCommissionId) : null;
    const remise = this.acteVivant(e, NatureActeEffet.REMISE_ENCAISSEMENT);
    if (!remise?.compte) throw new ConflictException("La remise à l'encaissement de cet effet ne porte plus son compte · relisez l'effet.");
    const montant = Number(e.montant);
    const motif = motifRefusDecompte({ montant, frais: 0, commission: dto.commission, referencePiece: dto.referencePiece, compteFraisId: null, compteCommissionId: commission?.id ?? null });
    if (motif) throw new BadRequestException(motif);
    const commissionM = round2((dto.commission as number | undefined) ?? 0);
    const referencePiece = (dto.referencePiece as string).trim();
    const libelle = `Encaissement · effet ${e.reference}`.slice(0, 190);
    return this.passerActe(tenantId, userId, e, {
      nature: NatureActeEffet.ENCAISSEMENT,
      date,
      journalId: banque.id,
      compteId: banque.compteTresorerie.id,
      reference: referencePiece,
      libelle,
      detail: { commission: commissionM, net: round2(montant - commissionM), referencePiece },
      lignes: lignesEncaissement({ compteBanqueId: banque.compteTresorerie.id, compteCommissionId: commission?.id ?? null, compteEncaissementId: remise.compte.id, montant, commission: commissionM, libelle }),
    });
  }

  async denouer(tenantId: string, userId: string, id: string, dto: DateActeDto) {
    const e = await this.effetVivant(tenantId, id);
    const date = this.dateJugee(e, NatureActeEffet.DENOUEMENT_ESCOMPTE, dto.date);
    const escompte = this.acteVivant(e, NatureActeEffet.REMISE_ESCOMPTE);
    const decompte = this.acteVivant(e, NatureActeEffet.DECOMPTE_ESCOMPTE);
    if (!escompte?.compte || !decompte?.compte) throw new ConflictException("La remise à l'escompte ou son décompte ne portent plus leur compte · relisez l'effet.");
    const libelle = `Dénouement de l'escompte · effet ${e.reference}`.slice(0, 190);
    return this.passerActe(tenantId, userId, e, {
      nature: NatureActeEffet.DENOUEMENT_ESCOMPTE,
      date,
      journalId: e.journalId,
      compteId: decompte.compte.id,
      reference: `Effet ${e.reference} · échéance ${jour(e.dateEcheance)}`,
      libelle,
      lignes: lignesDenouement({ compteCreditEscompteId: decompte.compte.id, compteEscompteNonEchuId: escompte.compte.id, montant: Number(e.montant), libelle }),
    });
  }

  /**
   * L'IMPAYÉ · D 4132 / C le compte où l'effet se trouve ; escompté ET
   * décompté, la banque reprend le nominal (D 565 / C 52) dans la même
   * pièce, au journal de la banque du décompte · la pièce porte alors les
   * quatre lignes, et son annulation les défait ensemble.
   */
  async impaye(tenantId: string, userId: string, id: string, dto: ImpayeEffetDto) {
    const e = await this.effetVivant(tenantId, id);
    const date = this.dateJugee(e, NatureActeEffet.IMPAYE, dto.date);
    const compteImpaye = await this.compteDuRole(tenantId, e, 'IMPAYE', dto.compteImpayeId);
    let compteCrediteId = e.compteEffetId;
    let repriseBanque: { compteCreditEscompteId: string; compteBanqueId: string } | null = null;
    let journalId = e.journalId;
    if (e.statut === StatutEffet.REMIS_A_L_ENCAISSEMENT) {
      const remise = this.acteVivant(e, NatureActeEffet.REMISE_ENCAISSEMENT);
      if (!remise?.compte) throw new ConflictException("La remise à l'encaissement de cet effet ne porte plus son compte · relisez l'effet.");
      compteCrediteId = remise.compte.id;
    } else if (e.statut === StatutEffet.ESCOMPTE) {
      const escompte = this.acteVivant(e, NatureActeEffet.REMISE_ESCOMPTE);
      if (!escompte?.compte) throw new ConflictException("La remise à l'escompte de cet effet ne porte plus son compte · relisez l'effet.");
      compteCrediteId = escompte.compte.id;
      const decompte = this.acteVivant(e, NatureActeEffet.DECOMPTE_ESCOMPTE);
      if (decompte) {
        const detail = (decompte.detail ?? {}) as { compteBanqueId?: unknown; journalBanqueId?: unknown };
        if (!decompte.compte || typeof detail.compteBanqueId !== 'string' || typeof detail.journalBanqueId !== 'string') {
          throw new ConflictException("Le décompte de cet effet ne dit plus sa banque · annulez-le, puis déclarez l'impayé.");
        }
        // Le journal figé au décompte est RELU (premier tour, m10) · mis en
        // sommeil depuis, le refus dit l'issue. Le compte crédité reste celui
        // qui a reçu le net, figé · c'est lui que la banque reprend.
        try {
          await this.banque(tenantId, detail.journalBanqueId);
        } catch (err) {
          const message = err instanceof BadRequestException || err instanceof NotFoundException ? (err.getResponse() as { message?: string }).message ?? err.message : String(err);
          throw new BadRequestException(`La banque du décompte ne peut plus reprendre les fonds · ${message} Annulez le décompte, repassez-le sur la banque qui reprend, puis déclarez l'impayé.`);
        }
        repriseBanque = { compteCreditEscompteId: decompte.compte.id, compteBanqueId: detail.compteBanqueId };
        journalId = detail.journalBanqueId;
      }
    }
    const libelle = `Impayé · effet ${e.reference}`.slice(0, 190);
    return this.passerActe(tenantId, userId, e, {
      nature: NatureActeEffet.IMPAYE,
      date,
      journalId,
      compteId: compteImpaye.id,
      reference: `Effet ${e.reference} impayé`,
      libelle,
      detail: repriseBanque ? { repriseBanque: true } : undefined,
      lignes: lignesImpaye({ compteImpayeId: compteImpaye.id, compteCrediteId, montant: Number(e.montant), libelle, repriseBanque }),
    });
  }

  /** Le bon à payer · aucune pièce, la date et la référence du relevé de la banque gardées sur l'acte. */
  async bonAPayer(tenantId: string, userId: string, id: string, dto: BonAPayerDto) {
    const e = await this.effetVivant(tenantId, id);
    const date = this.dateJugee(e, NatureActeEffet.BON_A_PAYER, dto.date);
    // Sans pièce, mais daté dans un exercice OUVERT (premier tour, m6) · un
    // bon daté d'une année fausse enfermait le paiement derrière lui.
    await this.exerciceDeLaDate(tenantId, date, "de l'acte « Bon à payer »");
    const reference = typeof dto.referencePiece === 'string' ? dto.referencePiece.trim() : '';
    if (dto.referencePiece !== undefined && reference.length === 0) throw new BadRequestException('La référence du bon à payer est vide · omettez-la, ou écrivez-la.');
    const statut = statutApresActes(e.sens, [...this.naturesVivantes(e), NatureActeEffet.BON_A_PAYER]);
    const acte = await transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerEtRelire(tx, tenantId, e);
      const prise = await tx.effetCommerce.updateMany({ where: { id: e.id, tenantId, statut: e.statut }, data: { statut } });
      if (prise.count !== 1) throw new ConflictException(`Cet effet n'est plus « ${e.statut} » · relisez-le avant d'y porter un acte.`);
      return tx.acteEffet.create({
        data: { tenantId, effetId: e.id, nature: NatureActeEffet.BON_A_PAYER, date: aMinuit(date), montant: e.montant, detail: reference ? { referencePiece: reference } : undefined, createdBy: userId },
        select: { id: true },
      });
    });
    return { ...(await this.effet(tenantId, e.id)), acteId: acte.id };
  }

  async payer(tenantId: string, userId: string, id: string, dto: PayerEffetDto) {
    const e = await this.effetVivant(tenantId, id);
    const date = this.dateJugee(e, NatureActeEffet.PAIEMENT, dto.date);
    const banque = await this.banque(tenantId, dto.journalBanqueId);
    if (typeof dto.referencePiece !== 'string' || dto.referencePiece.trim().length === 0 || dto.referencePiece.trim().length > 60) {
      throw new BadRequestException('La référence de la pièce de la banque (avis de débit, relevé) est de un à soixante caractères (AUDCIF art. 17).');
    }
    const libelle = `Paiement · effet ${e.reference}`.slice(0, 190);
    return this.passerActe(tenantId, userId, e, {
      nature: NatureActeEffet.PAIEMENT,
      date,
      journalId: banque.id,
      compteId: banque.compteTresorerie.id,
      reference: dto.referencePiece.trim(),
      libelle,
      lignes: lignesPaiement({ compteEffetId: e.compteEffetId, compteBanqueId: banque.compteTresorerie.id, montant: Number(e.montant), libelle }),
    });
  }

  /**
   * UN ACTE, UNE PIÈCE, DANS L'EXERCICE DE SA DATE (une remise de décembre
   * s'encaisse en janvier, le 512 passé par l'à-nouveau) · le statut de
   * l'effet est relu DANS la transaction par un `updateMany` filtré sur le
   * statut lu avant · un second geste concurrent reçoit un 409 qui le dit.
   */
  private async passerActe(
    tenantId: string,
    userId: string,
    e: EffetLu,
    a: { nature: NatureActeEffet; date: string; journalId: string; compteId: string; reference: string; libelle: string; detail?: Prisma.InputJsonValue; lignes: LigneProposee[] },
  ) {
    const exercice = await this.exerciceDeLaDate(tenantId, a.date, `de l'acte « ${LIBELLES_ACTE[a.nature]} »`);
    const statut = statutApresActes(e.sens, [...this.naturesVivantes(e), a.nature]);
    const res = await this.ecritures.creerAvec(
      tenantId,
      userId,
      { exerciceId: exercice.id, journalId: a.journalId, date: a.date, libelle: a.libelle, reference: a.reference.slice(0, 190), lignes: a.lignes },
      async (tx, ecriture) => {
        await this.verrouillerEtRelire(tx, tenantId, e);
        const prise = await tx.effetCommerce.updateMany({ where: { id: e.id, tenantId, statut: e.statut }, data: { statut } });
        if (prise.count !== 1) throw new ConflictException(`Cet effet n'est plus « ${e.statut} » · relisez-le avant d'y porter un acte.`);
        return tx.acteEffet.create({
          data: { tenantId, effetId: e.id, nature: a.nature, date: aMinuit(a.date), compteId: a.compteId, montant: e.montant, detail: a.detail, ecritureId: ecriture.id, createdBy: userId },
          select: { id: true },
        });
      },
    );
    return { ...(await this.effet(tenantId, e.id)), acteId: res.suite.id, ecritureId: res.ecriture.id };
  }

  // ----- Annulation ---------------------------------------------------------

  /**
   * L'ANNULATION VA À REBOURS · le dernier acte non annulé seul s'annule,
   * nommé sinon ; au brouillard sa pièce est retirée (relue dans la
   * transaction, une ligne et une seule), validée elle est inscrite en
   * NÉGATIF (AUDCIF art. 20, al. 2) et reste liée au geste ; le statut est
   * rejoué sur les actes qui restent, l'acceptation annulée laisse l'effet
   * ANNULÉ.
   */
  async annulerActe(tenantId: string, userId: string, id: string, acteId: string, dto: AnnulerActeDto) {
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException("Le motif de l'annulation est exigé · trois caractères au moins.");
    const e = await this.prisma.effetCommerce.findFirst({
      where: { id, tenantId },
      include: { compteTiers: { select: COMPTE_SELECT }, compteEffet: { select: COMPTE_SELECT }, actes: ACTES_INCLUDE },
    });
    if (!e) throw new NotFoundException('Effet introuvable pour ce dossier.');
    const acte = e.actes.find((a) => a.id === acteId);
    if (!acte) throw new NotFoundException('Acte introuvable sur cet effet.');
    if (acte.annuleLe) throw new ConflictException(`L'acte « ${LIBELLES_ACTE[acte.nature]} » est déjà annulé.`);
    const vivants = e.actes.filter((a) => !a.annuleLe);
    const dernier = vivants[vivants.length - 1];
    if (dernier.id !== acte.id) {
      throw new BadRequestException(`L'annulation va à rebours · annulez d'abord « ${LIBELLES_ACTE[dernier.nature]} » du ${jour(dernier.date)}, puis « ${LIBELLES_ACTE[acte.nature]} ».`);
    }
    if (acte.ecriture) {
      await this.pieceAnnulable(
        tenantId,
        acte.ecriture.id,
        `de l'acte « ${LIBELLES_ACTE[acte.nature]} »`,
        `annuler l'acte`,
        acte.nature === NatureActeEffet.ACCEPTATION ? "Délettrez la facture et l'effet, puis annulez." : '',
      );
    }
    const statut = statutApresActes(e.sens, vivants.filter((a) => a.id !== acte.id).map((a) => a.nature));
    const ecritureId = acte.ecriture?.id ?? null;
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerEtRelire(tx, tenantId, e);
      const prise = await tx.acteEffet.updateMany({ where: { id: acte.id, tenantId, effetId: e.id, annuleLe: null }, data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: motif } });
      if (prise.count !== 1) throw new ConflictException("Cet acte n'est plus annulable · relisez l'effet.");
      const negatif = ecritureId ? await this.retirerOuContrePasser(tx, tenantId, userId, acte.id, ecritureId, `de l'acte « ${LIBELLES_ACTE[acte.nature]} »`, `Annulation · ${LIBELLES_ACTE[acte.nature]} de l'effet ${e.reference}`, motif) : null;
      // Validée, la pièce reste au journal avec son négatif, tous deux tenus (détenteurs) ; retirée, le lien part avec elle.
      await tx.acteEffet.update({ where: { id: acte.id, tenantId }, data: { ecritureId: negatif ? ecritureId : null, ecritureNegatifId: negatif } });
      const effet = await tx.effetCommerce.updateMany({ where: { id: e.id, tenantId, statut: e.statut }, data: { statut } });
      if (effet.count !== 1) throw new ConflictException("Cet effet a changé d'état pendant l'annulation · rien n'est annulé, relisez-le.");
      return { effetId: e.id, acteId: acte.id, statut, traitement: negatif ? 'INSCRITE_EN_NEGATIF' : ecritureId ? 'SUPPRIMEE' : 'SANS_PIECE', ecritureNegatifId: negatif };
    });
  }

  // ----- Aides --------------------------------------------------------------

  private async effetVivant(tenantId: string, id: string) {
    const e = await this.prisma.effetCommerce.findFirst({
      where: { id, tenantId },
      include: { compteTiers: { select: COMPTE_SELECT }, compteEffet: { select: COMPTE_SELECT }, actes: ACTES_INCLUDE },
    });
    if (!e) throw new NotFoundException('Effet introuvable pour ce dossier.');
    if (e.statut === StatutEffet.ANNULE) throw new BadRequestException("Cet effet est annulé · aucun acte ne s'y porte plus.");
    return e;
  }

  private naturesVivantes(e: EffetLu) {
    return e.actes.filter((a) => !a.annuleLe).map((a) => a.nature);
  }

  private acteVivant(e: EffetLu, nature: NatureActeEffet) {
    return e.actes.find((a) => !a.annuleLe && a.nature === nature) ?? null;
  }

  /** La date de l'acte jugée contre le statut, le précédent et l'échéance (`motifRefusActe`). */
  private dateJugee(e: EffetLu, nature: NatureActeEffet, date: unknown): string {
    const juge: EffetJuge = {
      sens: e.sens,
      statut: e.statut,
      dateCreation: jour(e.dateCreation),
      dateEcheance: jour(e.dateEcheance),
      actes: e.actes.filter((a) => !a.annuleLe).map((a) => ({ nature: a.nature, date: jour(a.date) })),
    };
    const motif = motifRefusActe(juge, { nature, date });
    if (motif) throw new BadRequestException(motif);
    return date as string;
  }

  /** Le compte d'un rôle, sous la racine que la fiche prescrit pour ce plan · tout autre compte est refusé en le nommant. */
  private async compteDuRole(tenantId: string, e: EffetLu, role: RoleCompteEffet, compteId: string) {
    const dossier = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    const r = racinesDuRole(dossier.referentiel, role, e.sens);
    if (r.racines === null) throw new BadRequestException(r.motif);
    const compte = await this.prisma.compte.findFirst({ where: { id: compteId, tenantId }, select: COMPTE_SELECT });
    if (!compte) throw new NotFoundException(`Compte introuvable pour ce dossier (rôle ${role}).`);
    if (compte.typeCompte !== TypeCompteDetailTotal.DETAIL || !r.racines.some((racine) => compte.numero.startsWith(racine))) {
      throw new BadRequestException(`Le compte ${compte.numero} n'est pas sous la racine ${r.racines.join(' ou ')} que la fiche prescrit pour ce rôle (${role}).`);
    }
    if (!compte.estActif) throw new BadRequestException(`Le compte ${compte.numero} est en sommeil.`);
    return compte;
  }

  /** Un journal de banque actif qui porte son compte de trésorerie · la pièce de la banque y passe. */
  private async banque(tenantId: string, journalId: string) {
    const j = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true, code: true, type: true, estActif: true, compteTresorerie: { select: { id: true, numero: true } } } });
    if (!j) throw new NotFoundException('Journal de banque introuvable pour ce dossier.');
    if (j.type !== TypeJournal.TRESORERIE || !j.compteTresorerie) throw new BadRequestException(`Le journal ${j.code} n'est pas un journal de trésorerie qui porte son compte.`);
    // LA BANQUE SEULE (premier tour, M2) · un effet de commerce est domicilié en
    // banque (fiches des comptes 51 et 56 · le banquier encaisse, escompte,
    // reprend) ; sur une caisse, le paiement échappait à « une caisse ne paie
    // que ce qu'elle contient ». Payé en espèces, l'effet se saisit au journal.
    if (!j.compteTresorerie.numero.startsWith('52')) {
      throw new BadRequestException(`Le journal ${j.code} ne porte pas un compte de banque (52) · les actes d'un effet de commerce passent par la banque qui le domicilie.`);
    }
    if (!j.estActif) throw new BadRequestException(`Le journal ${j.code} est en sommeil.`);
    return { ...j, compteTresorerie: j.compteTresorerie };
  }

  /**
   * LE VERROU DE L'EFFET, ET SES ACTES RELUS (premier tour, M1 · relecture
   * adverse). Le `updateMany` filtré sur le statut lu ne voyait pas le geste
   * concurrent qui GARDE le statut · deux décomptes du même escompte passaient
   * tous deux (52 et 565 doublés, balance bouclée), et une annulation croisée
   * avec un décompte laissait un décompte vivant sur un effet « en
   * portefeuille ». La ligne de l'effet est prise `FOR UPDATE` en tête de la
   * transaction (le second geste attend le premier), puis les actes vivants
   * sont relus et confrontés à la lecture qui a jugé le geste · changés, 409.
   */
  private async verrouillerEtRelire(tx: Prisma.TransactionClient, tenantId: string, e: EffetLu) {
    await tx.$queryRaw`SELECT id FROM "effets_de_commerce" WHERE id = ${e.id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    const vivants = await tx.acteEffet.findMany({ where: { tenantId, effetId: e.id, annuleLe: null }, select: { id: true } });
    const lus = e.actes.filter((a) => !a.annuleLe).map((a) => a.id).sort();
    const relus = vivants.map((a) => a.id).sort();
    if (lus.length !== relus.length || lus.some((id, i) => id !== relus[i])) {
      throw new ConflictException("Les actes de cet effet ont changé pendant le geste (un autre geste vient de passer) · relisez l'effet avant de recommencer.");
    }
  }

  private async exerciceDeLaDate(tenantId: string, date: string, objet: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { tenantId, dateDebut: { lte: aMinuit(date) }, dateFin: { gte: aMinuit(date) } }, select: { id: true, statut: true } });
    if (!exercice) throw new BadRequestException(`Aucun exercice du dossier ne couvre la date ${objet}.`);
    if (exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(`L'exercice de la date ${objet} est clôturé · datez-le dans l'exercice en cours (AUDCIF art. 20, al. 3).`);
    return exercice;
  }

  private async exerciceOuvert(tenantId: string, id: string) {
    const e = await this.prisma.exercice.findFirst({ where: { id, tenantId }, select: { id: true, statut: true, dateDebut: true, dateFin: true } });
    if (!e) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    if (e.statut === StatutExercice.CLOTURE) throw new BadRequestException("Cet exercice est clôturé · rien ne s'y passe (AUDCIF art. 20, al. 3).");
    return e;
  }

  private async pieceAnnulable(tenantId: string, ecritureId: string, objet: string, geste: string, issue = '') {
    const e = await this.prisma.ecriture.findFirst({
      where: { id: ecritureId, tenantId },
      select: { id: true, numeroPiece: true, statut: true, exercice: { select: { statut: true } }, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
    });
    if (!e) throw new ConflictException(`La pièce ${objet} n'existe plus · relisez avant d'annuler.`);
    if (e.exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException(`La pièce ${objet} appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).`);
    }
    const tenue = motifLignesTenues(e.lignes, `la pièce ${objet} (n° ${e.numeroPiece ?? '·'})`, geste, issue);
    if (tenue) throw new BadRequestException(tenue);
    return e;
  }

  /** Au brouillard, retirée (relue dans la transaction, une ligne et une seule) ; validée, inscrite en négatif. Rend l'identifiant du négatif, ou null. */
  private async retirerOuContrePasser(tx: Prisma.TransactionClient, tenantId: string, userId: string, acteId: string, ecritureId: string, objet: string, geste: string, motif: string) {
    const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
    if (!e) throw new ConflictException(`La pièce ${objet} n'existe plus · relisez avant d'annuler.`);
    if (e.statut === StatutEcriture.BROUILLARD) {
      const relues = await tx.ligneEcriture.findMany({ where: { ecritureId, ecriture: { tenantId } }, select: { lettre: true, lettrageId: true, rapprochementId: true } });
      const tenue = motifLignesTenues(relues, `la pièce ${objet}`, geste);
      if (tenue) throw new BadRequestException(tenue);
      // L'acte RETIENT sa pièce (clé étrangère RESTRICT, `detenteurs-ecriture.ts`) · le lien se dénoue AVANT le retrait,
      // sinon la base refuse la suppression (vu sur vraie base, la doublure n'ayant aucune clé étrangère).
      await tx.acteEffet.update({ where: { id: acteId, tenantId }, data: { ecritureId: null } });
      await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
      const r = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
      if (r.count !== 1) throw new ConflictException(`La pièce ${objet} a été validée pendant l'annulation · rien n'est retiré. Relancez · validée, elle s'inscrira en négatif.`);
      return null;
    }
    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, `${geste} · ${motif}`, tx);
    return negatif.id;
  }
}
