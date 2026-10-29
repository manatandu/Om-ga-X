import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutBulletinPaie } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { nommerUtilisateur } from '../tiers/visa-rib';
import {
  AVERTISSEMENT_PLAN_AUTEUR_INCONNU,
  MOTIF_VISA_PLAN_PAR_SON_AUTEUR,
  motifPlanNonPropose,
  motifRefusVisaPlan,
  planChange,
  planVise,
  saisieDuPlan,
} from './visa-plan-etalement';
import { AvanceSalaireDto, EtalementAvanceDto, FinSaisieArretDto, ModeleBulletinDto, ModifierRubriquePaieDto, RubriquePaieDto } from './dto/personnel.dto';
import { motifRefusModele, normaliserLignes } from './modeles-bulletin';
import { NATURES_DES_RUBRIQUES, motifRefusRubrique } from './rubriques-paie';
import {
  LITTERA_ARTICLE_112,
  compteDeLAvance,
  echeancierAvance,
  motifRefusAvance,
  motifRefusEtalement,
  retenueProposee,
  motifRefusFinSaisie,
  soldeAvance,
  type CategoriePret,
  type PlanEtalement,
  type TypeAvance,
} from './avances-salaire';

/**
 * LA BORNE DES TROIS LISTES DE CE SERVICE (audit final F259, § 8 bis) ·
 * rubriques, bulletins modèles et avances sont des listes de TRAVAIL. Elles
 * rendaient tout le dossier à chaque ouverture de l'onglet ; elles rendent
 * désormais une tranche, et disent quand elle ne couvre pas tout (`total`
 * compté par la base, `tronque`). Aucune n'est un document · les retenues
 * d'un bulletin relisent leur avance par son identifiant, jamais dans cette
 * liste.
 */
export const PLAFOND_LISTES_PAIE = 500;

/**
 * RUBRIQUES DU CABINET ET REGISTRE DES AVANCES · voir rubriques-paie.ts et
 * avances-salaire.ts pour les règles et leurs sources.
 */
@Injectable()
export class AvancesRubriquesService {
  constructor(private readonly prisma: PrismaService) {}

  async listerRubriques(tenantId: string) {
    const [rubriques, total] = await Promise.all([
      this.prisma.rubriquePaie.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, take: PLAFOND_LISTES_PAIE }),
      this.prisma.rubriquePaie.count({ where: { tenantId } }),
    ]);
    return {
      rubriques,
      naturesPermises: NATURES_DES_RUBRIQUES,
      total,
      plafond: PLAFOND_LISTES_PAIE,
      tronque: total > rubriques.length,
    };
  }

  async creerRubrique(tenantId: string, dto: RubriquePaieDto) {
    const refus = motifRefusRubrique(dto);
    if (refus) throw new BadRequestException(refus);
    try {
      return await this.prisma.rubriquePaie.create({
        data: { tenantId, code: dto.code.trim().toUpperCase(), libelle: dto.libelle.trim(), nature: dto.nature, fondement: dto.fondement.trim() },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Le code ${dto.code.trim().toUpperCase()} est déjà pris dans ce dossier.`);
      }
      throw e;
    }
  }

  /**
   * LE CODE ET LA NATURE NE CHANGENT PAS · changer la nature d'une rubrique
   * changerait les assiettes et le compte de tous les bulletins à venir sans
   * que personne ne le voie sur un bulletin. Une autre nature, c'est une autre
   * rubrique. Les bulletins déjà émis ne bougent pas de toute façon · ils ont
   * figé la nature relue.
   */
  async modifierRubrique(tenantId: string, id: string, dto: ModifierRubriquePaieDto) {
    const r = await this.prisma.rubriquePaie.findFirst({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Rubrique introuvable dans ce dossier.');
    const refus = motifRefusRubrique({ code: r.code, nature: r.nature, libelle: dto.libelle ?? r.libelle, fondement: dto.fondement ?? r.fondement });
    if (refus) throw new BadRequestException(refus);
    return this.prisma.rubriquePaie.update({
      where: { id: r.id },
      data: {
        ...(dto.libelle !== undefined ? { libelle: dto.libelle.trim() } : {}),
        ...(dto.fondement !== undefined ? { fondement: dto.fondement.trim() } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });
  }

  // ---- Bulletins modèles (modeles-bulletin.ts) ------------------------

  async listerModeles(tenantId: string) {
    const [modeles, total] = await Promise.all([
      this.prisma.modeleBulletin.findMany({ where: { tenantId }, orderBy: { nom: 'asc' }, take: PLAFOND_LISTES_PAIE }),
      this.prisma.modeleBulletin.count({ where: { tenantId } }),
    ]);
    return { modeles, total, plafond: PLAFOND_LISTES_PAIE, tronque: total > modeles.length };
  }

  /** Les rubriques sont relues dans CE dossier · un id étranger n'existe pas. */
  async creerModele(tenantId: string, creePar: string, dto: ModeleBulletinDto) {
    const rubriques = await this.prisma.rubriquePaie.findMany({
      where: { tenantId },
      select: { id: true, nature: true, actif: true },
    });
    const refus = motifRefusModele(dto, rubriques);
    if (refus) throw new BadRequestException(refus);
    const nom = dto.nom.trim();
    try {
      return await this.prisma.modeleBulletin.create({
        data: {
          tenantId,
          nom,
          categorie: dto.categorie?.trim() || null,
          deviseStipulation: dto.deviseStipulation,
          lignes: normaliserLignes(dto.lignes, rubriques) as unknown as Prisma.InputJsonValue,
          creePar,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Un modèle nommé « ${nom} » existe déjà dans ce dossier.`);
      }
      throw e;
    }
  }

  async supprimerModele(tenantId: string, id: string) {
    const m = await this.prisma.modeleBulletin.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!m) throw new NotFoundException('Modèle introuvable dans ce dossier.');
    await this.prisma.modeleBulletin.delete({ where: { id: m.id } });
    return { supprime: true };
  }

  /**
   * Le registre, avec le SOLDE calculé et le compte que chaque retenue
   * crédite. Les plus récentes d'abord, l'identifiant départageant deux
   * avances du même jour pour que la frontière d'une tranche pleine ne change
   * pas d'un appel à l'autre.
   */
  async listerAvances(tenantId: string, utilisateurId: string, salarieId?: string, moisDePaie?: string) {
    const [avances, total, dossier] = await Promise.all([
      this.prisma.avanceSalaire.findMany({
        where: { tenantId, ...(salarieId ? { salarieId } : {}) },
        orderBy: [{ dateOctroi: 'desc' }, { id: 'desc' }],
        take: PLAFOND_LISTES_PAIE,
        include: {
          salarie: { select: { nom: true, postNom: true, prenoms: true, matricule: true } },
          retenues: { select: { montantFc: true, bulletin: { select: { numero: true, moisDePaie: true, statut: true } } } },
        },
      }),
      this.prisma.avanceSalaire.count({ where: { tenantId, ...(salarieId ? { salarieId } : {}) } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { visaPlansEtalement: true } }),
    ]);
    // Un dossier introuvable n'est pas « aucun visa exigé » · on ne présente rien.
    if (!dossier) throw new NotFoundException('Dossier introuvable.');
    const exige = dossier.visaPlansEtalement === true;
    // Les auteurs en courriel · un auditeur ne lit pas un identifiant.
    const ids = [...new Set(avances.flatMap((a) => [a.planSaisiPar, a.planVisePar]).filter((x): x is string => !!x))];
    const utilisateurs = ids.length
      ? await this.prisma.user.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, email: true }, take: ids.length })
      : [];
    const courriels = new Map(utilisateurs.map((u) => [u.id, u.email]));
    const lignes = avances.map((a) => {
      const retenues = a.retenues.map((r) => ({
        montantFc: Number(r.montantFc),
        numero: r.bulletin.numero,
        moisDePaie: r.bulletin.moisDePaie,
        bulletinAnnule: r.bulletin.statut !== StatutBulletinPaie.EMIS,
      }));
      return {
        id: a.id,
        salarieId: a.salarieId,
        salarie: [a.salarie.nom, a.salarie.postNom, a.salarie.prenoms].filter(Boolean).join(' '),
        matricule: a.salarie.matricule,
        type: a.type,
        categoriePret: a.categoriePret,
        littera: LITTERA_ARTICLE_112[a.type as TypeAvance],
        compte: compteDeLAvance(a.type as TypeAvance, (a.categoriePret as CategoriePret | null) ?? null),
        dateOctroi: a.dateOctroi,
        montantFc: Number(a.montantFc),
        retenueMensuelleFc: a.retenueMensuelleFc === null ? null : Number(a.retenueMensuelleFc),
        objet: a.objet,
        pieceJustificative: a.pieceJustificative,
        referenceActe: a.referenceActe,
        greffe: a.greffe,
        destinataire: a.destinataire,
        dateFin: a.dateFin,
        retenues,
        soldeFc: soldeAvance(Number(a.montantFc), retenues),
        ...etalementDeLAvanceVisee(a, soldeAvance(Number(a.montantFc), retenues), moisDePaie, exige),
        // Ligne paie-suite · le visa du plan, auteurs en courriel.
        visaPlan: a.premierMoisRetenue
          ? {
              exige,
              vise: planVise(a),
              visePar: nommerUtilisateur(a.planVisePar, courriels),
              viseLe: a.planViseLe,
              saisiPar: nommerUtilisateur(a.planSaisiPar, courriels),
              saisiLe: a.planSaisiLe,
              saisiParVous: a.planSaisiPar !== null && a.planSaisiPar === utilisateurId,
            }
          : null,
      };
    });
    return { avances: lignes, total, plafond: PLAFOND_LISTES_PAIE, tronque: total > lignes.length, visaPlansExige: exige };
  }

  /**
   * L'AVANCE S'INSCRIT, ELLE NE SE COMPTABILISE PAS ICI · son versement est
   * une écriture de trésorerie (D/4211 ou 272, C/52 ou 57, fiche du compte 42
   * des deux plans), que le cabinet passe au journal. Le registre en tient le
   * remboursement, bulletin après bulletin.
   */
  async creerAvance(tenantId: string, email: string, utilisateurId: string, salarieId: string, dto: AvanceSalaireDto) {
    const salarie = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true } });
    if (!salarie) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const refus = motifRefusAvance(dto) ?? motifRefusEtalement(dto);
    if (refus) throw new BadRequestException(refus);
    return this.prisma.avanceSalaire.create({
      data: {
        tenantId,
        salarieId,
        type: dto.type,
        categoriePret: dto.type === 'PRET' ? dto.categoriePret : null,
        dateOctroi: new Date(dto.dateOctroi),
        montantFc: dto.montantFc,
        retenueMensuelleFc: dto.retenueMensuelleFc ?? null,
        premierMoisRetenue: dto.premierMoisRetenue?.trim() || null,
        nombreEcheances: dto.premierMoisRetenue?.trim() ? (dto.nombreEcheances ?? null) : null,
        // Ligne paie-suite · un plan déclaré à la création est une saisie du plan (règle 2).
        ...saisieDuPlan(utilisateurId, new Date(), !!dto.premierMoisRetenue?.trim()),
        objet: dto.objet.trim(),
        pieceJustificative: dto.pieceJustificative.trim(),
        // La saisie-arrêt seule les porte · `motifRefusAvance` les refuse
        // ailleurs, si bien qu'aucune avance n'en reçoit un par mégarde.
        referenceActe: dto.type === 'SAISIE_ARRET' ? dto.referenceActe!.trim() : null,
        greffe: dto.type === 'SAISIE_ARRET' ? dto.greffe!.trim() : null,
        destinataire: dto.type === 'SAISIE_ARRET' ? dto.destinataire!.trim() : null,
        creePar: email,
      },
    });
  }

  /**
   * LA MAINLEVÉE D'UNE SAISIE-ARRÊT (AUPSRVE, art. 201, « notifiée à
   * l'employeur dans les huit jours ») · déclarée une fois, par une opération
   * unitaire qui laisse au journal d'audit l'état antérieur. Au-delà, aucun
   * bulletin ne retient plus rien sur elle (`motifRefusMoisSaisie`).
   */
  async terminerSaisie(tenantId: string, id: string, dto: FinSaisieArretDto) {
    const a = await this.prisma.avanceSalaire.findFirst({
      where: { id, tenantId },
      select: { id: true, type: true, dateOctroi: true, dateFin: true },
    });
    if (!a) throw new NotFoundException('Saisie introuvable dans ce dossier.');
    const dateFin = new Date(dto.dateFin);
    const refus = motifRefusFinSaisie({ type: a.type as TypeAvance, dateOctroi: a.dateOctroi, dateFin: a.dateFin }, dateFin);
    if (refus) throw new BadRequestException(refus);
    return this.prisma.avanceSalaire.update({ where: { id: a.id }, data: { dateFin } });
  }

  /**
   * LIGNE MICROFINA-M3, IDÉE 6 · DÉCLARER, CHANGER OU RETIRER LE PLAN
   * D'ÉTALEMENT d'une avance déjà inscrite. Le plan n'est qu'une PROPOSITION
   * (avances-salaire.ts) · il se change même après des retenues, qui restent
   * celles des bulletins émis, et il se juge sur le montant consenti, borné
   * à chaque mois par le solde. Une opération unitaire, que le journal
   * d'audit garde avec l'état antérieur.
   */
  async modifierEtalement(tenantId: string, utilisateurId: string, id: string, dto: EtalementAvanceDto) {
    const a = await this.prisma.avanceSalaire.findFirst({
      where: { id, tenantId },
      select: { id: true, type: true, montantFc: true, dateOctroi: true, retenueMensuelleFc: true, premierMoisRetenue: true, nombreEcheances: true },
    });
    if (!a) throw new NotFoundException('Avance introuvable dans ce dossier.');
    const premier = dto.premierMoisRetenue?.trim() || null;
    // La retenue mensuelle n'est touchée que si le corps la nomme · un plan
    // déclaré par sa durée la remet à null, faute de quoi les deux formes se
    // contrediraient (motifRefusEtalement).
    const retenue =
      dto.retenueMensuelleFc !== undefined
        ? dto.retenueMensuelleFc
        : dto.nombreEcheances != null
          ? null
          : a.retenueMensuelleFc === null
            ? null
            : Number(a.retenueMensuelleFc);
    const plan = {
      type: a.type as TypeAvance,
      montantFc: Number(a.montantFc),
      dateOctroi: a.dateOctroi,
      premierMoisRetenue: premier,
      nombreEcheances: premier ? (dto.nombreEcheances ?? null) : null,
      retenueMensuelleFc: retenue,
    };
    const refus =
      motifRefusEtalement(plan) ??
      (retenue !== null && Math.round(retenue * 100) > Math.round(Number(a.montantFc) * 100)
        ? 'La retenue mensuelle ne peut dépasser le montant consenti.'
        : null);
    if (refus) throw new BadRequestException(refus);
    // LIGNE PAIE-SUITE · UNE SAISIE DU PLAN FAIT TOMBER SON VISA (règle 2 de
    // `visa-plan-etalement.ts`) · seulement si le plan change, sans quoi un
    // second envoi identique effacerait un visa juste.
    const change = planChange(
      {
        premierMoisRetenue: a.premierMoisRetenue,
        nombreEcheances: a.nombreEcheances,
        retenueMensuelleFc: a.retenueMensuelleFc === null ? null : Number(a.retenueMensuelleFc),
      },
      { premierMoisRetenue: premier, nombreEcheances: plan.nombreEcheances, retenueMensuelleFc: retenue },
    );
    return this.prisma.avanceSalaire.update({
      where: { id: a.id },
      data: {
        premierMoisRetenue: premier,
        nombreEcheances: plan.nombreEcheances,
        retenueMensuelleFc: retenue,
        ...(change ? saisieDuPlan(utilisateurId, new Date(), premier !== null) : {}),
      },
    });
  }

  /**
   * LIGNE PAIE-SUITE · VISER LE PLAN D'ÉTALEMENT (`visa-plan-etalement.ts`) ·
   * relu sous le verrou de la ligne, dans la transaction · deux visas
   * simultanés ne passent pas tous les deux, et un plan changé entre la
   * lecture et le visa est refusé (409). L'auteur qui se vise reçoit un 403.
   */
  async viserPlan(tenantId: string, id: string, utilisateurId: string, saisiLeLu: string | null) {
    const vise = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "avances_salaire" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const a = await tx.avanceSalaire.findFirst({
        where: { id, tenantId },
        select: { id: true, premierMoisRetenue: true, planSaisiPar: true, planSaisiLe: true, planVisePar: true, planViseLe: true },
      });
      if (!a) throw new NotFoundException('Avance introuvable dans ce dossier.');
      const refus = motifRefusVisaPlan(a, utilisateurId, saisiLeLu);
      if (refus === MOTIF_VISA_PLAN_PAR_SON_AUTEUR) throw new ForbiddenException(refus);
      if (refus) throw new ConflictException(refus);
      return tx.avanceSalaire.update({
        where: { id: a.id },
        data: { planVisePar: utilisateurId, planViseLe: new Date() },
        select: { id: true, planSaisiPar: true, planViseLe: true },
      });
    });
    return { vise: true, viseLe: vise.planViseLe, avertissement: vise.planSaisiPar === null ? AVERTISSEMENT_PLAN_AUTEUR_INCONNU : null };
  }

  /** Une avance saisie par erreur se retire tant qu'aucun bulletin n'y a retenu · après, elle est l'histoire des bulletins. */
  async supprimerAvance(tenantId: string, id: string) {
    const a = await this.prisma.avanceSalaire.findFirst({ where: { id, tenantId }, include: { _count: { select: { retenues: true } } } });
    if (!a) throw new NotFoundException('Avance introuvable dans ce dossier.');
    if (a._count.retenues > 0) {
      throw new ConflictException(
        `Cette avance porte ${a._count.retenues} retenue(s) de bulletin · elle ne se supprime plus. Annulez les bulletins si les retenues sont fausses.`,
      );
    }
    await this.prisma.avanceSalaire.delete({ where: { id: a.id } });
    return { supprime: true };
  }
}

/**
 * Le plan d'étalement d'une ligne du registre et, pour un mois de paie
 * demandé, la retenue qu'il propose · rien quand l'avance n'a pas de plan.
 */
export function etalementDeLAvance(
  a: { montantFc: Prisma.Decimal | number; premierMoisRetenue: string | null; nombreEcheances: number | null; retenueMensuelleFc: Prisma.Decimal | number | null },
  soldeFc: number,
  moisDePaie?: string,
): {
  plan: { premierMois: string; nombreEcheances: number | null; retenueMensuelleFc: number | null; echeancier: { mois: string; montantFc: number }[] } | null;
  proposition: ReturnType<typeof retenueProposee> | null;
} {
  if (!a.premierMoisRetenue) return { plan: null, proposition: null };
  const plan: PlanEtalement = {
    montantFc: Number(a.montantFc),
    premierMois: a.premierMoisRetenue,
    nombreEcheances: a.nombreEcheances,
    retenueMensuelleFc: a.retenueMensuelleFc === null ? null : Number(a.retenueMensuelleFc),
  };
  return {
    plan: {
      premierMois: plan.premierMois,
      nombreEcheances: plan.nombreEcheances,
      retenueMensuelleFc: plan.retenueMensuelleFc,
      echeancier: echeancierAvance(plan),
    },
    proposition: moisDePaie ? retenueProposee(plan, moisDePaie, soldeFc) : null,
  };
}

/**
 * LIGNE PAIE-SUITE · le plan et sa proposition, la proposition RETIRÉE quand
 * le dossier exige le visa des plans et que celui-ci manque · la phrase dit
 * pourquoi (`motifPlanNonPropose`), jamais un « soldé » en silence.
 */
export function etalementDeLAvanceVisee(
  a: Parameters<typeof etalementDeLAvance>[0] & { planVisePar: string | null; planViseLe: Date | null },
  soldeFc: number,
  moisDePaie: string | undefined,
  exige: boolean,
): ReturnType<typeof etalementDeLAvance> & { planNonPropose: string | null } {
  const e = etalementDeLAvance(a, soldeFc, moisDePaie);
  if (!e.plan) return { ...e, planNonPropose: null };
  const motif = motifPlanNonPropose(exige, a, 'Plan non visé');
  return motif ? { ...e, proposition: null, planNonPropose: motif } : { ...e, planNonPropose: null };
}
