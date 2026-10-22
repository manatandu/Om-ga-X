import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NatureRemise, Prisma, StatutEcriture, StatutExercice, StatutRemiseEnBanque, StatutValeurRecue, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { EcritureService } from '../comptabilite/ecriture.service';
import { LettrageService } from '../lettrage/lettrage.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { estUnJour } from '../virements-fonds/virement-fonds';
import {
  LIBELLES_NATURE,
  documentBordereau,
  lignesAvisCredit,
  lignesImpaye,
  lignesReception,
  lignesRemise,
  motifRefusAvisCredit,
  motifRefusImpaye,
  motifRefusModeleBordereau,
  motifRefusTypeRemise,
  motifRefusValeur,
  racineDuRole,
  racineImpaye,
  round2,
  type RoleCompteRemise,
} from './remise-en-banque';
import type { AnnulerRemiseDto, AvisCreditDto, CreerTypeRemiseDto, ImpayeDto, ModifierTypeRemiseDto, RecevoirValeurDto, RemettreDto } from './remises.dto';

/** Une liste bornée qui dit son total · jamais une collection sans borne (CLAUDE.md § 8 bis). */
const PLAFOND_LISTE = 500;
const ROLES: readonly RoleCompteRemise[] = ['RECEPTION', 'TRANSIT', 'COMMISSION', 'IMPAYE'];

const JOURNAL_SELECT = { id: true, code: true, type: true, estActif: true, compteTresorerie: { select: { id: true, numero: true } } } as const;
const COMPTE_SELECT = { id: true, numero: true, intitule: true, typeCompte: true, estActif: true } as const;
const TYPE_INCLUDE = {
  journalBanque: { select: JOURNAL_SELECT },
  journalOperations: { select: JOURNAL_SELECT },
  compteReception: { select: COMPTE_SELECT },
  compteTransit: { select: COMPTE_SELECT },
  compteCommission: { select: COMPTE_SELECT },
} as const;

const jour = (d: Date) => d.toISOString().slice(0, 10);
const aMinuit = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * REMISES EN BANQUE (ligne sage-l3, fonction 40). Règles dans
 * `remise-en-banque.ts` (fiche du compte 51 des deux plans) ; ici les
 * lectures, les transactions et les refus nommés. Chaque écriture naît avec
 * ce qui la tient (`creerAvec`), les annulations s'inscrivent en négatif
 * (AUDCIF art. 20, al. 2) et chaque état se relit dans sa transaction par un
 * `updateMany` filtré sur l'état attendu · un second geste concurrent reçoit
 * un 409 qui le dit.
 */
@Injectable()
export class RemisesService {
  private readonly journalServeur = new Logger(RemisesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
    private readonly lettrage: LettrageService,
  ) {}

  // ----- Types de remise (structure) --------------------------------------

  async typesDeRemise(tenantId: string) {
    const [types, total] = await Promise.all([
      this.prisma.typeRemise.findMany({ where: { tenantId }, include: TYPE_INCLUDE, orderBy: { code: 'asc' }, take: PLAFOND_LISTE }),
      this.prisma.typeRemise.count({ where: { tenantId } }),
    ]);
    return { types, total, tronque: total > types.length };
  }

  private async typeJuge(tenantId: string, dto: Pick<CreerTypeRemiseDto, 'journalBanqueId' | 'journalOperationsId' | 'compteReceptionId' | 'compteTransitId' | 'compteCommissionId'>) {
    const ids = [dto.compteReceptionId, dto.compteTransitId, dto.compteCommissionId].filter((x): x is string => !!x);
    const [journaux, comptes] = await Promise.all([
      this.prisma.journal.findMany({ where: { tenantId, id: { in: [dto.journalBanqueId, dto.journalOperationsId] } }, select: JOURNAL_SELECT }),
      this.prisma.compte.findMany({ where: { tenantId, id: { in: ids } }, select: COMPTE_SELECT }),
    ]);
    const j = (id: string) => journaux.find((x) => x.id === id) ?? null;
    const c = (id: string | undefined) => (id ? (comptes.find((x) => x.id === id) ?? null) : null);
    return { journalBanque: j(dto.journalBanqueId), journalOperations: j(dto.journalOperationsId), compteReception: c(dto.compteReceptionId), compteTransit: c(dto.compteTransitId), compteCommission: c(dto.compteCommissionId) };
  }

  async creerType(tenantId: string, userId: string, dto: CreerTypeRemiseDto) {
    const code = dto.code.trim().toUpperCase();
    const lus = await this.typeJuge(tenantId, dto);
    const motif = motifRefusTypeRemise({ code, intitule: dto.intitule, nature: dto.nature, modeleBordereau: dto.modeleBordereau ?? null, ...lus });
    if (motif) throw new BadRequestException(motif);
    try {
      return await this.prisma.typeRemise.create({
        data: {
          tenantId,
          code,
          intitule: dto.intitule.trim(),
          nature: dto.nature,
          journalBanqueId: dto.journalBanqueId,
          journalOperationsId: dto.journalOperationsId,
          compteReceptionId: dto.compteReceptionId,
          compteTransitId: dto.nature === NatureRemise.CHEQUES ? dto.compteTransitId! : null,
          compteCommissionId: dto.compteCommissionId ?? null,
          modeleBordereau: dto.modeleBordereau ?? null,
          createdBy: userId,
        },
        include: TYPE_INCLUDE,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(`Le code ${code} est déjà pris par un autre type de remise.`);
      throw e;
    }
  }

  /**
   * CE QUI SE RETOUCHE · intitulé, modèle, commission, activité. Nature,
   * journaux et comptes du 51 sont FIGÉS · les valeurs déjà reçues ont été
   * passées sur eux, et un type retouché ferait lire un 513 là où le
   * bordereau a crédité un autre compte. Un besoin nouveau est un type nouveau.
   */
  async modifierType(tenantId: string, id: string, dto: ModifierTypeRemiseDto) {
    const t = await this.prisma.typeRemise.findFirst({ where: { id, tenantId }, include: TYPE_INCLUDE });
    if (!t) throw new NotFoundException('Type de remise introuvable pour ce dossier.');
    const data: Prisma.TypeRemiseUpdateInput = {};
    if (dto.intitule !== undefined) {
      if (dto.intitule.trim().length < 3) throw new BadRequestException("L'intitulé du type de remise est de trois à soixante caractères.");
      data.intitule = dto.intitule.trim();
    }
    if (dto.modeleBordereau !== undefined) {
      const refus = motifRefusModeleBordereau(dto.modeleBordereau);
      if (refus) throw new BadRequestException(refus);
      data.modeleBordereau = dto.modeleBordereau;
    }
    if (dto.compteCommissionId !== undefined) {
      if (dto.compteCommissionId === null) data.compteCommission = { disconnect: true };
      else {
        const lus = await this.typeJuge(tenantId, { ...t, compteTransitId: t.compteTransitId ?? undefined, compteCommissionId: dto.compteCommissionId });
        const refus = motifRefusTypeRemise({ ...t, modeleBordereau: t.modeleBordereau, ...lus });
        if (refus) throw new BadRequestException(refus);
        data.compteCommission = { connect: { id: dto.compteCommissionId } };
      }
    }
    if (dto.estActif !== undefined) data.estActif = dto.estActif;
    return this.prisma.typeRemise.update({ where: { id: t.id, tenantId }, data, include: TYPE_INCLUDE });
  }

  /**
   * LES COMPTES D'UN RÔLE · sous la racine que la fiche du 51 (ou du 41 pour
   * l'impayé) prescrit, détail et actifs, personnalisés d'abord. Le serveur
   * refuse de toute façon un compte hors racine (`motifRefusTypeRemise`,
   * `motifRefusImpaye`) · la liste propose, elle ne juge pas.
   */
  async comptes(tenantId: string, role: string | undefined, nature: string | undefined, compteTiersId: string | undefined) {
    if (!ROLES.includes(role as RoleCompteRemise)) throw new BadRequestException(`Le rôle du compte est l'un de ${ROLES.join(', ')}.`);
    if (nature !== NatureRemise.CHEQUES && nature !== NatureRemise.CARTES) throw new BadRequestException('La nature est CHEQUES ou CARTES.');
    let racine = racineDuRole(role as RoleCompteRemise, nature);
    if (role === 'IMPAYE') {
      const [dossier, tiers] = await Promise.all([
        this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
        compteTiersId ? this.prisma.compte.findFirst({ where: { id: compteTiersId, tenantId }, select: { numero: true } }) : null,
      ]);
      if (compteTiersId && !tiers) throw new NotFoundException('Compte du tiers introuvable pour ce dossier.');
      racine = racineImpaye(dossier.referentiel, nature, tiers?.numero ?? '');
    }
    if (racine === null) return { racine: null, comptes: [], motif: "Une carte de crédit ne transite par aucun compte · elle reste au 515 jusqu'à l'avis de crédit." };
    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, typeCompte: TypeCompteDetailTotal.DETAIL, estActif: true, numero: { startsWith: racine } },
      select: { id: true, numero: true, intitule: true, estRetenu: true },
      orderBy: [{ estRetenu: 'desc' }, { numero: 'asc' }],
      take: 200,
    });
    // Une liste bornée dit son total (§ 8 bis, relecture m7).
    const total = await this.prisma.compte.count({ where: { tenantId, typeCompte: TypeCompteDetailTotal.DETAIL, estActif: true, numero: { startsWith: racine } } });
    return { racine, comptes, motif: null, total, tronque: total > comptes.length };
  }

  // ----- Valeurs reçues ----------------------------------------------------

  async valeurs(tenantId: string, exerciceId: string, statut: string | undefined) {
    // `Object.keys` et non `in` · « constructor » ou « toString » passaient la
    // chaîne de prototype et finissaient en 500 chez Prisma (relecture, m3).
    const filtre = statut && Object.keys(StatutValeurRecue).includes(statut) ? (statut as StatutValeurRecue) : undefined;
    if (statut && !filtre) throw new BadRequestException(`Le statut est l'un de ${Object.keys(StatutValeurRecue).join(', ')}.`);
    // Le `tenantId` écrit DANS chaque appel · le balayage du cloisonnement lit
    // la borne sur l'appel, jamais dans une variable (cloisonnement.spec.ts).
    const [valeurs, total] = await Promise.all([
      this.prisma.valeurRecue.findMany({
        where: { tenantId, exerciceId, ...(filtre ? { statut: filtre } : {}) },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: PLAFOND_LISTE,
        include: {
          typeRemise: { select: { id: true, code: true, intitule: true, nature: true } },
          compteTiers: { select: { numero: true, intitule: true } },
          ecritureReception: { select: { numeroPiece: true, statut: true } },
          ecritureImpaye: { select: { numeroPiece: true, statut: true } },
          remise: { select: { id: true, numero: true, statut: true } },
        },
      }),
      this.prisma.valeurRecue.count({ where: { tenantId, exerciceId, ...(filtre ? { statut: filtre } : {}) } }),
    ]);
    return { valeurs: valeurs.map((v) => ({ ...v, montant: Number(v.montant) })), total, tronque: total > valeurs.length };
  }

  /**
   * LES VALEURS À REMETTRE D'UN TYPE, SANS BORNE D'EXERCICE (relecture, M1) ·
   * un chèque reçu en décembre se remet en janvier, dans l'exercice suivant ;
   * listées par l'exercice courant, les valeurs de N n'apparaissaient plus en
   * N+1 et le 513 les gardait pour toujours. Chaque candidate dit son
   * exercice d'origine. Bornée, et la troncature dite.
   */
  async aRemettre(tenantId: string, typeRemiseId: string) {
    const type = await this.typeActif(tenantId, typeRemiseId);
    const [valeurs, total] = await Promise.all([
      this.prisma.valeurRecue.findMany({
        where: { tenantId, typeRemiseId: type.id, statut: StatutValeurRecue.RECUE, annuleLe: null, remiseId: null },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        take: PLAFOND_LISTE,
        include: {
          compteTiers: { select: { numero: true, intitule: true } },
          exercice: { select: { id: true, dateDebut: true, dateFin: true, statut: true } },
        },
      }),
      this.prisma.valeurRecue.count({ where: { tenantId, typeRemiseId: type.id, statut: StatutValeurRecue.RECUE, annuleLe: null, remiseId: null } }),
    ]);
    return {
      valeurs: valeurs.map((v) => ({ ...v, montant: Number(v.montant), exercice: { ...v.exercice, libelle: `${jour(v.exercice.dateDebut)} au ${jour(v.exercice.dateFin)}` } })),
      total,
      tronque: total > valeurs.length,
    };
  }

  private async typeActif(tenantId: string, id: string) {
    const t = await this.prisma.typeRemise.findFirst({ where: { id, tenantId }, include: TYPE_INCLUDE });
    if (!t) throw new NotFoundException('Type de remise introuvable pour ce dossier.');
    if (!t.estActif) throw new BadRequestException(`Le type de remise ${t.code} est en sommeil.`);
    return t;
  }

  /** L'exercice OUVERT qui couvre une date · l'avis de crédit et l'impayé se passent dans l'exercice de leur date. */
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

  /**
   * (1) LA RÉCEPTION · D 513 ou 515 / C tiers, au journal des opérations du
   * type, la valeur née dans la même transaction. Les lignes ouvertes du
   * tiers que le chèque règle se lettrent ensuite avec lui (partiel admis) ;
   * un lettrage refusé défait ce qui a été posé et retire la pièce ET la
   * valeur, l'erreur d'origine remonte toujours.
   */
  async recevoir(tenantId: string, userId: string, dto: RecevoirValeurDto) {
    const motif = motifRefusValeur(dto);
    if (motif) throw new BadRequestException(motif);
    const [type, tiers] = await Promise.all([
      this.typeActif(tenantId, dto.typeRemiseId),
      this.prisma.compte.findFirst({ where: { id: dto.compteTiersId, tenantId }, select: COMPTE_SELECT }),
    ]);
    if (!tiers) throw new NotFoundException('Compte du tiers introuvable pour ce dossier.');
    if (tiers.typeCompte !== TypeCompteDetailTotal.DETAIL || !tiers.numero.startsWith('4')) {
      throw new BadRequestException(`Le compte ${tiers.numero} n'est pas un compte de tiers d'imputation (classe 4) · la fiche du compte 51 crédite « les comptes de tiers concernés ».`);
    }
    if (!tiers.estActif) throw new BadRequestException(`Le compte ${tiers.numero} est en sommeil.`);
    await this.exerciceOuvert(tenantId, dto.exerciceId);
    const montant = round2(dto.montant as number);
    const reference = (dto.reference as string).trim();
    if (dto.ligneIds && dto.ligneIds.length > 0) {
      // PLUS QUE LE DÛ EST REFUSÉ AVANT LA PIÈCE (relecture, m5 · même règle
      // que le Règlement des tiers, § 6) · un chèque de 500 000 coché contre
      // une facture de 100 000 faisait un groupe partiel à solde négatif. La
      // borne est le montant BRUT des lignes choisies, sur le compte du tiers
      // seul ; une ligne déjà réglée en partie a un reste plus petit, que le
      // lettrage juge ensuite (reste négatif nommé à la balance âgée).
      const ids = [...new Set(dto.ligneIds)];
      const lignes = await this.prisma.ligneEcriture.findMany({
        where: { id: { in: ids }, compteId: tiers.id, ecriture: { tenantId } },
        select: { id: true, debit: true, credit: true },
      });
      if (lignes.length !== ids.length) throw new BadRequestException(`${ids.length - lignes.length} ligne(s) choisie(s) ne sont pas sur le compte ${tiers.numero} de ce dossier · rechargez la liste.`);
      const du = round2(lignes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0));
      if (montant > du + 0.005) {
        throw new BadRequestException(`Le montant reçu (${montant.toFixed(2)}) dépasse le dû des lignes choisies (${du.toFixed(2)}) · plus que le dû n'est pas un règlement, recevez le dû et passez le reste en avance (419).`);
      }
    }
    const date = dto.date as string;
    const libelle = `${type.nature === NatureRemise.CHEQUES ? 'Chèque' : 'Carte'} ${reference} · ${tiers.intitule}`.slice(0, 190);
    const r = await this.ecritures.creerAvec(
      tenantId,
      userId,
      {
        exerciceId: dto.exerciceId,
        journalId: type.journalOperationsId,
        date,
        libelle,
        reference: `${type.nature === NatureRemise.CHEQUES ? 'Chèque n°' : 'Transaction'} ${reference}`.slice(0, 190),
        lignes: lignesReception({ compteReceptionId: type.compteReceptionId, compteTiersId: tiers.id, montant, libelle }),
      },
      (tx, ecriture) =>
        tx.valeurRecue.create({
          data: {
            tenantId,
            exerciceId: dto.exerciceId,
            typeRemiseId: type.id,
            compteTiersId: tiers.id,
            date: aMinuit(date),
            montant: new Prisma.Decimal(montant),
            reference,
            banqueTiree: typeof dto.banqueTiree === 'string' && dto.banqueTiree.trim() ? dto.banqueTiree.trim() : null,
            titulaire: typeof dto.titulaire === 'string' && dto.titulaire.trim() ? dto.titulaire.trim() : null,
            ecritureReceptionId: ecriture.id,
            createdBy: userId,
          },
        }),
    );
    let lettre: string | null = null;
    if (dto.ligneIds && dto.ligneIds.length > 0) {
      const ligneTiers = r.ecriture.lignes.find((l) => l.compteId === tiers.id);
      if (!ligneTiers) throw new ConflictException('La ligne du tiers est introuvable dans la pièce de réception.');
      try {
        // `lettrerManuel` est UNE transaction · refusé, il n'a rien posé, et
        // il n'y a rien à délettrer (relecture, m1) ; seule la pièce et la
        // valeur se retirent.
        const l = await this.lettrage.lettrerManuel(tenantId, tiers.id, [...dto.ligneIds, ligneTiers.id], userId, { autoriserPartiel: true });
        lettre = l.lettre;
      } catch (e) {
        try {
          await this.ecritures.retirerCompensation(tenantId, r.ecriture.id, (tx) => tx.valeurRecue.deleteMany({ where: { id: r.suite.id, tenantId } }));
        } catch (nettoyage) {
          this.journalServeur.error(
            `Réception ${r.ecriture.id} du dossier ${tenantId} restée au brouillard · son retrait après l'échec du lettrage a échoué`,
            nettoyage instanceof Error ? nettoyage.stack : String(nettoyage),
          );
        }
        throw e;
      }
    }
    // UN CHÈQUE SAISI DEUX FOIS EST DIT (relecture, m10) · deux réceptions du
    // même numéro sous le même type faisaient deux D 513 ; une référence
    // peut se répéter d'une banque tirée à l'autre, aussi l'écran est averti,
    // jamais refusé.
    const doublons = await this.prisma.valeurRecue.count({ where: { tenantId, typeRemiseId: type.id, reference, annuleLe: null, id: { not: r.suite.id } } });
    const avertissement = doublons > 0 ? `${doublons} autre(s) valeur(s) de référence « ${reference} » existent déjà sous ce type de remise · vérifiez qu'il ne s'agit pas d'une double saisie.` : null;
    return { ...r.suite, montant: Number(r.suite.montant), lettre, avertissement };
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

  /**
   * AU BROUILLARD, RETIRÉE · relue dans la transaction (lettrage, pointage,
   * statut), une ligne et une seule ; VALIDÉE, inscrite en négatif. Rend
   * l'identifiant du négatif, ou null.
   */
  private async retirerOuContrePasser(tx: Prisma.TransactionClient, tenantId: string, userId: string, ecritureId: string, objet: string, geste: string, motif: string) {
    const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
    if (!e) throw new ConflictException(`La pièce ${objet} n'existe plus · relisez avant d'annuler.`);
    if (e.statut === StatutEcriture.BROUILLARD) {
      const relues = await tx.ligneEcriture.findMany({ where: { ecritureId, ecriture: { tenantId } }, select: { lettre: true, lettrageId: true, rapprochementId: true } });
      const tenue = motifLignesTenues(relues, `la pièce ${objet}`, geste);
      if (tenue) throw new BadRequestException(tenue);
      await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
      const r = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
      if (r.count !== 1) throw new ConflictException(`La pièce ${objet} a été validée pendant l'annulation · rien n'est retiré. Relancez · validée, elle s'inscrira en négatif.`);
      return null;
    }
    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, `${geste} · ${motif}`, tx);
    return negatif.id;
  }

  private motifJuge(dto: AnnulerRemiseDto): string {
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException("Le motif de l'annulation est exigé · trois caractères au moins.");
    return motif;
  }

  /** La réception s'annule tant que la valeur n'est pas remise · remise, c'est le bordereau qui s'annule d'abord. */
  async annulerReception(tenantId: string, userId: string, id: string, dto: AnnulerRemiseDto) {
    const v = await this.prisma.valeurRecue.findFirst({ where: { id, tenantId }, include: { remise: { select: { numero: true } } } });
    if (!v) throw new NotFoundException('Valeur introuvable pour ce dossier.');
    if (v.statut === StatutValeurRecue.ANNULEE) throw new ConflictException('Cette valeur est déjà annulée.');
    if (v.statut !== StatutValeurRecue.RECUE) {
      throw new BadRequestException(`Cette valeur est ${v.remise ? `remise (bordereau n° ${v.remise.numero})` : 'sortie du 51'} · annulez d'abord le bordereau${v.statut === StatutValeurRecue.IMPAYEE ? " et l'impayé" : ''}.`);
    }
    const motif = this.motifJuge(dto);
    if (v.ecritureReceptionId) {
      await this.pieceAnnulable(tenantId, v.ecritureReceptionId, 'de réception', 'annuler la réception', 'Délettrez la facture et le chèque, puis annulez.');
    }
    return transactionJournalisee(this.prisma, async (tx) => {
      const prise = await tx.valeurRecue.updateMany({ where: { id: v.id, tenantId, statut: StatutValeurRecue.RECUE, annuleLe: null }, data: { ecritureReceptionId: null } });
      if (prise.count !== 1) throw new ConflictException("Cette valeur n'est plus « reçue, non remise » · relisez-la avant de l'annuler.");
      const negatif = v.ecritureReceptionId ? await this.retirerOuContrePasser(tx, tenantId, userId, v.ecritureReceptionId, 'de réception', 'Annulation de la réception', motif) : null;
      return tx.valeurRecue.update({
        where: { id: v.id, tenantId },
        data: {
          statut: StatutValeurRecue.ANNULEE,
          annuleLe: new Date(),
          annulePar: userId,
          motifAnnulation: motif,
          // Validée, la pièce reste au journal avec son négatif, tous deux tenus.
          ecritureReceptionId: negatif ? v.ecritureReceptionId : null,
          ecritureNegatifReceptionId: negatif,
        },
      });
    });
  }

  // ----- Bordereaux ---------------------------------------------------------

  async remises(tenantId: string, exerciceId: string) {
    const [remises, total] = await Promise.all([
      this.prisma.remiseEnBanque.findMany({
        where: { tenantId, exerciceId },
        orderBy: [{ numero: 'desc' }],
        take: PLAFOND_LISTE,
        include: {
          typeRemise: { select: { id: true, code: true, intitule: true, nature: true } },
          journalBanque: { select: { code: true } },
          ecritureRemise: { select: { numeroPiece: true, statut: true } },
          ecritureCredit: { select: { numeroPiece: true, statut: true } },
          _count: { select: { valeurs: true } },
        },
      }),
      this.prisma.remiseEnBanque.count({ where: { tenantId, exerciceId } }),
    ]);
    return {
      remises: remises.map((r) => ({ ...r, total: Number(r.total), commission: r.commission === null ? null : Number(r.commission) })),
      total,
      tronque: total > remises.length,
    };
  }

  async remise(tenantId: string, id: string) {
    const r = await this.prisma.remiseEnBanque.findFirst({
      where: { id, tenantId },
      include: {
        typeRemise: { include: TYPE_INCLUDE },
        journalBanque: { select: { code: true, intitule: true } },
        ecritureRemise: { select: { numeroPiece: true, statut: true } },
        ecritureCredit: { select: { numeroPiece: true, statut: true } },
        valeurs: {
          orderBy: { date: 'asc' },
          include: { compteTiers: { select: { numero: true, intitule: true } }, ecritureImpaye: { select: { numeroPiece: true, statut: true } } },
        },
      },
    });
    if (!r) throw new NotFoundException('Remise introuvable pour ce dossier.');
    return { ...r, total: Number(r.total), commission: r.commission === null ? null : Number(r.commission), valeurs: r.valeurs.map((v) => ({ ...v, montant: Number(v.montant) })) };
  }

  /**
   * (2) LE BORDEREAU · les valeurs reçues du type, remises ce jour. Pour les
   * chèques, D 514 / C 513 au journal des opérations ; pour les cartes, aucune
   * écriture (elles restent au 515 jusqu'à l'avis). Le numéro est continu par
   * dossier, pris sous verrou, dans la transaction où les valeurs changent
   * d'état · deux bordereaux en même temps prenaient le même numéro.
   */
  async remettre(tenantId: string, userId: string, dto: RemettreDto) {
    // `estUnJour` fait l'aller-retour ISO · « 2026-02-30 » passait la regex
    // et `Date.parse`, et se rangeait au 2 mars (relecture, m4).
    if (!estUnJour(dto.date)) throw new BadRequestException('La date de la remise est un jour (AAAA-MM-JJ).');
    const type = await this.typeActif(tenantId, dto.typeRemiseId);
    const exercice = await this.exerciceOuvert(tenantId, dto.exerciceId);
    // LA DATE TOMBE DANS SON EXERCICE (§ 10 bis, relecture M3) · pour les
    // chèques, `creerAvec` le juge ; pour les cartes, sans écriture, rien ne le
    // jugeait, et une remise du 5 janvier se rattachait à N.
    if (dto.date < jour(exercice.dateDebut) || dto.date > jour(exercice.dateFin)) {
      throw new BadRequestException(`La date de la remise (${dto.date.split('-').reverse().join('/')}) est hors de l'exercice choisi (${jour(exercice.dateDebut).split('-').reverse().join('/')} au ${jour(exercice.dateFin).split('-').reverse().join('/')}).`);
    }
    const ids = [...new Set(dto.valeurIds)];
    const valeurs = await this.prisma.valeurRecue.findMany({
      where: { tenantId, id: { in: ids }, typeRemiseId: type.id, statut: StatutValeurRecue.RECUE, annuleLe: null, remiseId: null },
      select: { id: true, montant: true, reference: true, date: true, compteTiers: { select: { intitule: true } } },
    });
    if (valeurs.length !== ids.length) {
      throw new ConflictException(`${ids.length - valeurs.length} valeur(s) sur ${ids.length} ne sont pas « reçues, non remises » de ce type · rechargez la liste.`);
    }
    const tardive = valeurs.find((v) => jour(v.date) > dto.date);
    if (tardive) throw new BadRequestException(`La valeur ${tardive.reference} a été reçue le ${jour(tardive.date).split('-').reverse().join('/')}, après la date de la remise.`);
    // LE TOTAL DE LA FICHE EST CELUI DE L'ÉCRITURE · la somme des montants
    // ARRONDIS, comme `lignesRemise` · arrondir la somme brute donnait deux
    // totaux pour un même bordereau (spec du service).
    const total = round2(valeurs.reduce((s, v) => s + round2(Number(v.montant)), 0));
    const naissance = async (tx: Prisma.TransactionClient, ecritureRemiseId: string | null) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`remises:${tenantId}`}))`;
      const dernier = await tx.remiseEnBanque.aggregate({ where: { tenantId }, _max: { numero: true } });
      const numero = (dernier._max.numero ?? 0) + 1;
      const remise = await tx.remiseEnBanque.create({
        data: {
          tenantId,
          exerciceId: dto.exerciceId,
          typeRemiseId: type.id,
          journalBanqueId: type.journalBanqueId,
          numero,
          date: aMinuit(dto.date),
          total: new Prisma.Decimal(total),
          nombre: valeurs.length,
          ecritureRemiseId,
          createdBy: userId,
        },
      });
      const prises = await tx.valeurRecue.updateMany({
        where: { tenantId, id: { in: ids }, statut: StatutValeurRecue.RECUE, annuleLe: null, remiseId: null },
        data: { statut: StatutValeurRecue.REMISE, remiseId: remise.id },
      });
      if (prises.count !== ids.length) throw new ConflictException("Une valeur a changé d'état pendant la remise · rien n'est remis, rechargez la liste.");
      // La référence de la pièce porte le numéro du bordereau, connu ici
      // seulement · posée DANS la transaction (relecture, m2) · hors d'elle,
      // un échec laissait une remise née sans sa référence, et la reprise
      // tombait sur « ne sont pas reçues, non remises ».
      if (ecritureRemiseId) await tx.ecriture.update({ where: { id: ecritureRemiseId, tenantId }, data: { reference: `Bordereau de remise n° ${numero}` } });
      return remise;
    };
    const libelle = `Remise de ${LIBELLES_NATURE[type.nature].toLowerCase()} · ${type.journalBanque.code}`.slice(0, 190);
    if (type.nature === NatureRemise.CHEQUES) {
      const r = await this.ecritures.creerAvec(
        tenantId,
        userId,
        {
          exerciceId: dto.exerciceId,
          journalId: type.journalOperationsId,
          date: dto.date,
          libelle,
          reference: 'Bordereau de remise',
          lignes: lignesRemise({
            compteTransitId: type.compteTransitId!,
            compteReceptionId: type.compteReceptionId,
            valeurs: valeurs.map((v) => ({ montant: Number(v.montant), libelle: `Chèque ${v.reference} · ${v.compteTiers.intitule}`.slice(0, 190) })),
            libelle,
          }),
        },
        (tx, ecriture) => naissance(tx, ecriture.id),
      );
      return { ...r.suite, total: Number(r.suite.total) };
    }
    const remise = await transactionJournalisee(this.prisma, (tx) => naissance(tx, null));
    return { ...remise, total: Number(remise.total) };
  }

  /** L'IMPRESSION DU BORDEREAU · enregistrée au serveur avant la boîte (date, auteur, nombre), le document rendu en texte. */
  async impression(tenantId: string, userId: string, id: string) {
    const r = await this.remise(tenantId, id);
    if (r.statut === StatutRemiseEnBanque.ANNULEE) throw new BadRequestException(`Le bordereau n° ${r.numero} est annulé · il ne s'imprime pas.`);
    const dossier = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { nom: true } });
    const document = documentBordereau({
      dossier: dossier.nom,
      banque: `${r.journalBanque.code} · ${r.journalBanque.intitule}`,
      type: r.typeRemise.intitule,
      numero: r.numero,
      date: jour(r.date),
      nature: r.typeRemise.nature,
      lignes: r.valeurs.map((v) => ({ reference: v.reference, titulaire: v.titulaire ?? v.compteTiers.intitule, banqueTiree: v.banqueTiree, montant: v.montant })),
      total: r.total,
      modele: r.typeRemise.modeleBordereau,
    });
    // LA PREMIÈRE IMPRESSION SE POSE UNE FOIS (relecture, m6) · deux
    // impressions simultanées se disaient toutes deux « première » ; la
    // première est celle dont le `updateMany` filtré sur « jamais imprimée »
    // passe, l'autre est un duplicata.
    const premiere = await this.prisma.remiseEnBanque.updateMany({
      where: { id: r.id, tenantId, premiereImpressionLe: null },
      data: { nombreImpressions: { increment: 1 }, premiereImpressionLe: new Date(), premiereImpressionPar: userId },
    });
    if (premiere.count === 0) await this.prisma.remiseEnBanque.update({ where: { id: r.id, tenantId }, data: { nombreImpressions: { increment: 1 } } });
    const impression = await this.prisma.remiseEnBanque.findFirstOrThrow({ where: { id: r.id, tenantId }, select: { numero: true, nombreImpressions: true, premiereImpressionLe: true } });
    return { ...impression, document, duplicata: premiere.count === 0 };
  }

  /**
   * (3) L'AVIS DE CRÉDIT · D 52 du net, D 6315 de la commission, C 514 ou 515
   * pour solde, au journal de la banque de remise, référence de l'avis sur la
   * pièce (AUDCIF art. 17).
   */
  async avisCredit(tenantId: string, userId: string, id: string, dto: AvisCreditDto) {
    const r = await this.prisma.remiseEnBanque.findFirst({
      where: { id, tenantId },
      include: { typeRemise: { include: TYPE_INCLUDE }, valeurs: { select: { id: true, statut: true, reference: true } } },
    });
    if (!r) throw new NotFoundException('Remise introuvable pour ce dossier.');
    const type = r.typeRemise;
    // UN IMPAYÉ DÉCLARÉ AVANT LE CRÉDIT (relecture, BLOQUANT B1) · l'avis
    // créditait le TOTAL figé du bordereau quand une valeur en était déjà
    // sortie par D 413 / C 514 · le 52 surévalué de la valeur, le 514
    // créditeur d'autant, la balance bouclée. L'issue est nommée · annuler
    // l'impayé, passer l'avis, redéclarer l'impayé (la valeur créditée reprend
    // alors les fonds sur le 52, chemin ordinaire).
    const impayee = r.valeurs.find((v) => v.statut === StatutValeurRecue.IMPAYEE);
    if (impayee) {
      throw new BadRequestException(`La valeur ${impayee.reference} de cette remise est revenue impayée avant le crédit · annulez l'impayé, passez l'avis de crédit, puis redéclarez l'impayé (la banque reprend alors les fonds sur le 52).`);
    }
    const compteBanque = type.journalBanque.compteTresorerie;
    if (!compteBanque) throw new BadRequestException(`Le journal ${type.journalBanque.code} de la banque de remise ne porte plus de compte de trésorerie · rattachez-le dans Structure > Journaux.`);
    const aCrediter = r.valeurs.filter((v) => v.statut === StatutValeurRecue.REMISE).length;
    const motif = motifRefusAvisCredit({
      statut: r.statut,
      dateRemise: jour(r.date),
      total: Number(r.total),
      date: dto.date,
      commission: dto.commission,
      referenceAvis: dto.referenceAvis,
      compteCommissionId: type.compteCommissionId,
    });
    if (motif) throw new BadRequestException(motif);
    const date = dto.date as string;
    const commission = round2((dto.commission as number | undefined) ?? 0);
    const referenceAvis = (dto.referenceAvis as string).trim();
    const compteSoldeId = type.nature === NatureRemise.CHEQUES ? type.compteTransitId! : type.compteReceptionId;
    // L'AVIS SE PASSE DANS L'EXERCICE DE SA DATE · une remise de décembre est
    // créditée en janvier, le 514 passé par l'à-nouveau · refuser parce que
    // l'exercice de la remise est clos enfermait le cas le plus ordinaire.
    const exercice = await this.exerciceDeLaDate(tenantId, date, "de l'avis de crédit");
    const libelle = `Avis de crédit · remise n° ${r.numero} (${LIBELLES_NATURE[type.nature].toLowerCase()})`.slice(0, 190);
    const res = await this.ecritures.creerAvec(
      tenantId,
      userId,
      {
        exerciceId: exercice.id,
        journalId: type.journalBanqueId,
        date,
        libelle,
        reference: referenceAvis,
        lignes: lignesAvisCredit({
          compteBanqueId: compteBanque.id,
          compteCommissionId: type.compteCommissionId,
          compteSoldeId,
          total: Number(r.total),
          commission,
          libelle,
        }),
      },
      async (tx, ecriture) => {
        const prise = await tx.remiseEnBanque.updateMany({
          where: { id: r.id, tenantId, statut: StatutRemiseEnBanque.REMISE, annuleLe: null, ecritureCreditId: null },
          data: { statut: StatutRemiseEnBanque.CREDITEE, dateCredit: aMinuit(date), commission: new Prisma.Decimal(commission), referenceAvis, ecritureCreditId: ecriture.id },
        });
        if (prise.count !== 1) throw new ConflictException("Cette remise n'est plus en attente de crédit · relisez-la.");
        const creditees = await tx.valeurRecue.updateMany({ where: { tenantId, remiseId: r.id, statut: StatutValeurRecue.REMISE }, data: { statut: StatutValeurRecue.CREDITEE } });
        if (creditees.count !== aCrediter) throw new ConflictException("Une valeur de la remise a changé d'état pendant l'avis de crédit · rien n'est crédité, relisez la remise.");
        return tx.remiseEnBanque.findFirstOrThrow({ where: { id: r.id, tenantId }, select: { id: true, numero: true, statut: true, dateCredit: true, commission: true } });
      },
    );
    return { ...res.suite, commission: Number(res.suite.commission ?? 0), ecritureId: res.ecriture.id };
  }

  /** Le bordereau s'annule tant qu'il n'est pas crédité et qu'aucune de ses valeurs n'est revenue impayée. */
  async annulerRemise(tenantId: string, userId: string, id: string, dto: AnnulerRemiseDto) {
    const r = await this.prisma.remiseEnBanque.findFirst({ where: { id, tenantId }, include: { exercice: { select: { statut: true } }, valeurs: { select: { id: true, statut: true, reference: true } } } });
    if (!r) throw new NotFoundException('Remise introuvable pour ce dossier.');
    if (r.statut === StatutRemiseEnBanque.ANNULEE) throw new ConflictException('Cette remise est déjà annulée.');
    if (r.statut === StatutRemiseEnBanque.CREDITEE) throw new BadRequestException("Cette remise est créditée · annulez d'abord l'avis de crédit.");
    const impayee = r.valeurs.find((v) => v.statut === StatutValeurRecue.IMPAYEE);
    if (impayee) throw new BadRequestException(`La valeur ${impayee.reference} de cette remise est revenue impayée · annulez d'abord l'impayé.`);
    if (r.exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException("Cette remise appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).");
    const motif = this.motifJuge(dto);
    if (r.ecritureRemiseId) await this.pieceAnnulable(tenantId, r.ecritureRemiseId, 'du bordereau', 'annuler la remise');
    return transactionJournalisee(this.prisma, async (tx) => {
      const prise = await tx.remiseEnBanque.updateMany({ where: { id: r.id, tenantId, statut: StatutRemiseEnBanque.REMISE, annuleLe: null }, data: { ecritureRemiseId: null } });
      if (prise.count !== 1) throw new ConflictException("Cette remise n'est plus « remise à la banque » · relisez-la avant de l'annuler.");
      const negatif = r.ecritureRemiseId ? await this.retirerOuContrePasser(tx, tenantId, userId, r.ecritureRemiseId, 'du bordereau', 'Annulation de la remise', motif) : null;
      const rendues = await tx.valeurRecue.updateMany({
        where: { tenantId, remiseId: r.id, statut: StatutValeurRecue.REMISE },
        data: { statut: StatutValeurRecue.RECUE, remiseId: null },
      });
      if (rendues.count !== r.valeurs.length) throw new ConflictException("Une valeur de la remise a changé d'état pendant l'annulation · rien n'est annulé.");
      return tx.remiseEnBanque.update({
        where: { id: r.id, tenantId },
        data: { statut: StatutRemiseEnBanque.ANNULEE, annuleLe: new Date(), annulePar: userId, motifAnnulation: motif, ecritureRemiseId: negatif ? r.ecritureRemiseId : null, ecritureNegatifRemiseId: negatif, nombre: 0 },
      });
    });
  }

  /** L'avis de crédit s'annule tant qu'aucun impayé n'a repris les fonds sur la banque ; le 52 pointé au relevé refuse (issue · dépointer). */
  async annulerAvisCredit(tenantId: string, userId: string, id: string, dto: AnnulerRemiseDto) {
    const r = await this.prisma.remiseEnBanque.findFirst({ where: { id, tenantId }, include: { exercice: { select: { statut: true } }, valeurs: { select: { statut: true, reference: true } } } });
    if (!r) throw new NotFoundException('Remise introuvable pour ce dossier.');
    if (r.statut !== StatutRemiseEnBanque.CREDITEE || !r.ecritureCreditId) throw new BadRequestException("Cette remise n'est pas créditée · rien à annuler.");
    const impayee = r.valeurs.find((v) => v.statut === StatutValeurRecue.IMPAYEE);
    if (impayee) throw new BadRequestException(`La valeur ${impayee.reference} de cette remise est revenue impayée après le crédit · annulez d'abord l'impayé.`);
    // L'EXERCICE QUI COMPTE EST CELUI DE L'AVIS, PAS DU BORDEREAU (relecture,
    // BLOQUANT B2) · un bordereau de décembre crédité en janvier a son avis
    // dans N+1 ; jugé sur N clôturé, l'avis faux était enfermé (la pièce
    // retenue, le journal refusait aussi de la corriger). `pieceAnnulable`
    // lit l'exercice de la pièce de l'avis, la seule borne (art. 20, al. 3).
    const motif = this.motifJuge(dto);
    await this.pieceAnnulable(tenantId, r.ecritureCreditId, "de l'avis de crédit", "annuler l'avis de crédit", 'Dépointez la ligne au rapprochement, puis annulez.');
    const ecritureCreditId = r.ecritureCreditId;
    return transactionJournalisee(this.prisma, async (tx) => {
      const prise = await tx.remiseEnBanque.updateMany({ where: { id: r.id, tenantId, statut: StatutRemiseEnBanque.CREDITEE, ecritureCreditId }, data: { ecritureCreditId: null } });
      if (prise.count !== 1) throw new ConflictException("Cette remise n'est plus créditée · relisez-la avant d'annuler l'avis.");
      const negatif = await this.retirerOuContrePasser(tx, tenantId, userId, ecritureCreditId, "de l'avis de crédit", "Annulation de l'avis de crédit", motif);
      const rendues = await tx.valeurRecue.updateMany({ where: { tenantId, remiseId: r.id, statut: StatutValeurRecue.CREDITEE }, data: { statut: StatutValeurRecue.REMISE } });
      // Le compte des valeurs rendues est celui lu avant la transaction
      // (relecture, m7) · un impayé déclaré entre-temps en sortirait une.
      if (rendues.count !== r.valeurs.filter((v) => v.statut === StatutValeurRecue.CREDITEE).length) throw new ConflictException("Une valeur de la remise a changé d'état pendant l'annulation de l'avis · rien n'est annulé.");
      return tx.remiseEnBanque.update({
        where: { id: r.id, tenantId },
        data: { statut: StatutRemiseEnBanque.REMISE, dateCredit: null, commission: null, referenceAvis: null, ecritureCreditId: negatif ? ecritureCreditId : null, ecritureNegatifCreditId: negatif },
      });
    });
  }

  // ----- Impayés ------------------------------------------------------------

  /**
   * (4) L'IMPAYÉ · D 413x / C 514 ou 515 (valeur remise, non créditée) ou
   * C 52 (valeur créditée, la banque reprend les fonds), au journal des
   * opérations ou de la banque selon le cas. Le 413 est celui que la fiche
   * du compte 41 prescrit pour ce plan, cette nature et ce débiteur
   * (`racineImpaye`) ; le cabinet le choisit sous cette racine.
   */
  async impaye(tenantId: string, userId: string, valeurId: string, dto: ImpayeDto) {
    const v = await this.prisma.valeurRecue.findFirst({
      where: { id: valeurId, tenantId },
      include: { typeRemise: { include: TYPE_INCLUDE }, compteTiers: { select: { numero: true, intitule: true } }, remise: { select: { numero: true, statut: true, date: true, dateCredit: true } } },
    });
    if (!v) throw new NotFoundException('Valeur introuvable pour ce dossier.');
    const [dossier, compteImpaye] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
      this.prisma.compte.findFirst({ where: { id: dto.compteImpayeId, tenantId }, select: COMPTE_SELECT }),
    ]);
    const racine = racineImpaye(dossier.referentiel, v.typeRemise.nature, v.compteTiers.numero);
    const motif = motifRefusImpaye({
      statut: v.statut,
      dateValeur: jour(v.date),
      dateRemise: v.remise ? jour(v.remise.date) : null,
      dateCredit: v.remise?.dateCredit ? jour(v.remise.dateCredit) : null,
      date: dto.date,
      numeroImpaye: compteImpaye?.numero ?? null,
      racine,
    });
    if (motif) throw new BadRequestException(motif);
    const compteBanque = v.typeRemise.journalBanque.compteTresorerie;
    if (!compteBanque) throw new BadRequestException(`Le journal ${v.typeRemise.journalBanque.code} de la banque de remise ne porte plus de compte de trésorerie · rattachez-le dans Structure > Journaux.`);
    if (compteImpaye!.typeCompte !== TypeCompteDetailTotal.DETAIL || !compteImpaye!.estActif) throw new BadRequestException(`Le compte ${compteImpaye!.numero} n'est pas un compte d'imputation actif.`);
    const type = v.typeRemise;
    const credite = v.statut === StatutValeurRecue.CREDITEE;
    const compteCrediteId = credite ? compteBanque.id : type.nature === NatureRemise.CHEQUES ? type.compteTransitId! : type.compteReceptionId;
    const exercice = await this.exerciceDeLaDate(tenantId, dto.date as string, "de l'impayé");
    const libelle = `Impayé · ${type.nature === NatureRemise.CHEQUES ? 'chèque' : 'carte'} ${v.reference} · ${v.compteTiers.intitule}`.slice(0, 190);
    const res = await this.ecritures.creerAvec(
      tenantId,
      userId,
      {
        exerciceId: exercice.id,
        journalId: credite ? type.journalBanqueId : type.journalOperationsId,
        date: dto.date as string,
        libelle,
        reference: `Impayé ${v.reference}${v.remise ? ` · remise n° ${v.remise.numero}` : ''}`.slice(0, 190),
        lignes: lignesImpaye({ compteImpayeId: compteImpaye!.id, compteCrediteId, montant: Number(v.montant), libelle }),
      },
      async (tx, ecriture) => {
        const prise = await tx.valeurRecue.updateMany({
          where: { id: v.id, tenantId, statut: v.statut, annuleLe: null, ecritureImpayeId: null },
          data: { statut: StatutValeurRecue.IMPAYEE, dateImpaye: aMinuit(dto.date as string), ecritureImpayeId: ecriture.id },
        });
        if (prise.count !== 1) throw new ConflictException("Cette valeur a changé d'état · relisez-la avant de déclarer l'impayé.");
        return tx.valeurRecue.findFirstOrThrow({ where: { id: v.id, tenantId }, select: { id: true, statut: true, dateImpaye: true } });
      },
    );
    return { ...res.suite, ecritureId: res.ecriture.id, compteImpaye: compteImpaye!.numero };
  }

  /** L'impayé s'annule (art. 20, al. 2) · la valeur revient à l'état d'avant, remise ou créditée. */
  async annulerImpaye(tenantId: string, userId: string, valeurId: string, dto: AnnulerRemiseDto) {
    const v = await this.prisma.valeurRecue.findFirst({ where: { id: valeurId, tenantId }, include: { remise: { select: { statut: true } } } });
    if (!v) throw new NotFoundException('Valeur introuvable pour ce dossier.');
    if (v.statut !== StatutValeurRecue.IMPAYEE || !v.ecritureImpayeId) throw new BadRequestException("Cette valeur n'est pas revenue impayée · rien à annuler.");
    const motif = this.motifJuge(dto);
    await this.pieceAnnulable(tenantId, v.ecritureImpayeId, "de l'impayé", "annuler l'impayé", "Délettrez ou dépointez la ligne, puis annulez.");
    const ecritureImpayeId = v.ecritureImpayeId;
    const retour = v.remise?.statut === StatutRemiseEnBanque.CREDITEE ? StatutValeurRecue.CREDITEE : StatutValeurRecue.REMISE;
    return transactionJournalisee(this.prisma, async (tx) => {
      const prise = await tx.valeurRecue.updateMany({ where: { id: v.id, tenantId, statut: StatutValeurRecue.IMPAYEE, ecritureImpayeId }, data: { ecritureImpayeId: null } });
      if (prise.count !== 1) throw new ConflictException("Cette valeur n'est plus impayée · relisez-la.");
      const negatif = await this.retirerOuContrePasser(tx, tenantId, userId, ecritureImpayeId, "de l'impayé", "Annulation de l'impayé", motif);
      return tx.valeurRecue.update({
        where: { id: v.id, tenantId },
        data: { statut: retour, dateImpaye: null, ecritureImpayeId: negatif ? ecritureImpayeId : null, ecritureNegatifImpayeId: negatif },
      });
    });
  }
}
