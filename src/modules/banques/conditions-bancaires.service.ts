import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutExercice } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasa } from '../../common/echeance';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { filtreOuverturePasseeAuPremierJour } from '../exercice/ouverture-passee';
import {
  MOTIF_SANS_HORS_BILAN_SYCEBNL,
  autorisationEnCours,
  conditionsEnVigueur,
  inscriptionHorsBilan,
  monnaieDuRib,
  motifRefusAutorisation,
  motifRefusConditions,
  motifRefusUnion,
  normaliserCodeUnion,
  positionUnion,
  seLitSurLeCompteBancaire,
  situationAutorisation,
  type AutorisationSaisie,
  type ConditionsSaisies,
  type NatureAutorisation,
  type PalierDecouvert,
  type UnionSaisie,
} from './conditions-bancaires';

/** Les RIB d'un dossier · quelques comptes en pratique, la borne dit le reste (§ 8 bis). */
export const LIMITE_RIBS = 200;
/** Versions de conditions et autorisations lues avec les RIB · bornées, et la borne se dit. */
export const LIMITE_DECLARATIONS = 2000;
export const LIMITE_UNIONS = 200;

const jour = (v: string) => new Date(`${v}T00:00:00.000Z`);
const jourIso = (d: Date) => d.toISOString().slice(0, 10);

/** Un solde lu, ou la raison pour laquelle il ne l'est pas · jamais un zéro présumé. */
export interface SoldeLu {
  solde: number | null;
  motif: string | null;
}

/**
 * CONDITIONS BANCAIRES, AUTORISATIONS DE FINANCEMENT, UNIONS DE COMPTES
 * (ligne sage-l3, fonction 46 · décision D15). Règles dans
 * `conditions-bancaires.ts`. Rien n'est passé au journal · les conditions
 * sont recopiées de la convention, l'autorisation est un engagement hors
 * bilan dont l'inscription est PROPOSÉE (SYSCOHADA), l'union une vue.
 */
@Injectable()
export class ConditionsBancairesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ribDuDossier(tenantId: string, ribId: string) {
    const rib = await this.prisma.ribBanque.findFirst({
      where: { id: ribId, tenantId },
      select: { id: true, abrege: true, devise: true, journal: { select: { compteTresorerieId: true } } },
    });
    if (!rib) throw new NotFoundException('RIB introuvable pour ce dossier · relisez la liste des banques.');
    return rib;
  }

  /**
   * LE SOLDE DU COMPTE D'UN RIB À UNE DATE, vu de l'entité (débit moins
   * crédit) · lu sur l'exercice qui contient la date, lignes datées au plus
   * tard ce jour, brouillard compris, ni simulation ni à-nouveau provisoire
   * (A7 ter, B1). Sans ouverture qui porte ce compte, les exercices
   * précédents non clôturés s'ajoutent (même remontée que la caisse
   * provisionnée) · sinon le premier jour de N+1 se lirait sur un compte vide.
   * Un compte en devise ne se lit pas en francs contre une autorisation en
   * devise · non lu, et dit.
   */
  async soldeDuRib(tenantId: string, rib: { devise: string | null; journal: { compteTresorerieId: string | null } | null }, date: Date): Promise<SoldeLu> {
    const compteId = rib.journal?.compteTresorerieId ?? null;
    if (!compteId) return { solde: null, motif: 'RIB sans journal de banque · aucun compte à lire.' };
    if (monnaieDuRib(rib.devise) !== null) return { solde: null, motif: `Compte en ${monnaieDuRib(rib.devise)} · la situation en devise n'est pas encore lue.` };
    const exercice = await this.prisma.exercice.findFirst({
      where: { tenantId, dateDebut: { lte: date }, dateFin: { gte: date } },
      select: { id: true, dateDebut: true },
    });
    if (!exercice) return { solde: null, motif: `Aucun exercice ne couvre le ${date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.` };
    let centimes = await this.centimesDe(tenantId, compteId, exercice.id, date);
    let courant = exercice;
    for (let rang = 0; rang < 20; rang++) {
      const ouverture = await this.prisma.ecriture.count({
        where: { AND: [filtreOuverturePasseeAuPremierJour(tenantId, courant), { lignes: { some: { compteId } } }] },
      });
      if (ouverture > 0) break;
      const precedent = await this.prisma.exercice.findFirst({
        where: { tenantId, dateFin: { lt: courant.dateDebut } },
        orderBy: { dateFin: 'desc' },
        select: { id: true, dateDebut: true, dateFin: true, statut: true },
      });
      if (!precedent || precedent.statut === StatutExercice.CLOTURE) break;
      centimes += await this.centimesDe(tenantId, compteId, precedent.id, precedent.dateFin);
      courant = precedent;
    }
    return { solde: centimes / 100, motif: null };
  }

  private async centimesDe(tenantId: string, compteId: string, exerciceId: string, jusquAu: Date): Promise<number> {
    const s = await this.prisma.ligneEcriture.aggregate({
      // Une ligne n'a pas de tenantId · la borne du dossier passe par son écriture.
      where: {
        compteId,
        ecriture: { tenantId, exerciceId, date: { lte: jusquAu }, estANouveauProvisoire: false, ...HORS_SITUATION },
      },
      _sum: { debit: true, credit: true },
    });
    return Math.round(Number(s._sum?.debit ?? 0) * 100) - Math.round(Number(s._sum?.credit ?? 0) * 100);
  }

  /** Tout ce que la fonction porte, avec la situation de chaque autorisation et la position de chaque union À LA DATE. */
  async lister(tenantId: string, au?: string) {
    const date = au ? jour(au) : jourDeKinshasa(new Date());
    const [dossier, ribs, totalRibs, conditions, autorisations, unions, totalUnions] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
      this.prisma.ribBanque.findMany({
        where: { tenantId },
        orderBy: { abrege: 'asc' },
        take: LIMITE_RIBS,
        select: {
          id: true,
          abrege: true,
          devise: true,
          banque: { select: { intitule: true } },
          journal: { select: { code: true, compteTresorerieId: true, compteTresorerie: { select: { numero: true } } } },
        },
      }),
      this.prisma.ribBanque.count({ where: { tenantId } }),
      this.prisma.conditionBancaire.findMany({ where: { tenantId }, orderBy: [{ ribId: 'asc' }, { dateEffet: 'asc' }], take: LIMITE_DECLARATIONS }),
      this.prisma.autorisationFinancement.findMany({ where: { tenantId }, orderBy: [{ ribId: 'asc' }, { dateDebut: 'asc' }, { id: 'asc' }], take: LIMITE_DECLARATIONS }),
      this.prisma.unionComptesBancaires.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
        take: LIMITE_UNIONS,
        include: { elements: { where: { tenantId }, orderBy: { rang: 'asc' }, select: { ribId: true, rang: true } } },
      }),
      this.prisma.unionComptesBancaires.count({ where: { tenantId } }),
    ]);
    const soldes = new Map<string, SoldeLu>();
    const soldeDe = async (ribId: string) => {
      if (!soldes.has(ribId)) {
        const rib = ribs.find((r) => r.id === ribId);
        soldes.set(ribId, rib ? await this.soldeDuRib(tenantId, rib, date) : { solde: null, motif: 'RIB au-delà de la liste servie.' });
      }
      return soldes.get(ribId)!;
    };
    const servisRibs = [];
    for (const r of ribs) {
      const versions = conditions.filter((c) => c.ribId === r.id);
      const enVigueur = conditionsEnVigueur(versions, date);
      const sesAutorisations = [];
      for (const a of autorisations.filter((x) => x.ribId === r.id)) {
        const nature = a.nature as NatureAutorisation;
        const enCours = autorisationEnCours(a, date);
        const lu = enCours && seLitSurLeCompteBancaire(nature) ? await soldeDe(r.id) : null;
        const situation = enCours ? situationAutorisation({ nature, montant: Number(a.montant) }, lu?.solde ?? null) : null;
        sesAutorisations.push({
          ...a,
          montant: Number(a.montant),
          enCours,
          situation,
          motifSituation: !enCours
            ? 'Autorisation hors de sa période à cette date.'
            : !seLitSurLeCompteBancaire(nature)
              ? 'Utilisation lue sur les opérations de financement (fonction 47), non sur le compte bancaire.'
              : (lu?.motif ?? null),
          horsBilan: inscriptionHorsBilan(dossier.referentiel, a.irrevocable),
        });
      }
      servisRibs.push({
        id: r.id,
        abrege: r.abrege,
        banque: r.banque.intitule,
        devise: monnaieDuRib(r.devise),
        journal: r.journal?.code ?? null,
        compte: r.journal?.compteTresorerie?.numero ?? null,
        conditions: versions.map((c) => ({ ...c, ...nombres(c), enVigueur: c.id === enVigueur?.id })),
        autorisations: sesAutorisations,
      });
    }
    const servisUnions = [];
    for (const u of unions) {
      const membres = [];
      for (const e of u.elements) {
        const rib = ribs.find((r) => r.id === e.ribId);
        const lu = await soldeDe(e.ribId);
        membres.push({ ribId: e.ribId, abrege: rib?.abrege ?? '(RIB au-delà de la liste)', solde: lu.solde, motif: lu.motif });
      }
      servisUnions.push({
        id: u.id,
        code: u.code,
        intitule: u.intitule,
        fusionEchelles: u.fusionEchelles,
        membres,
        position: positionUnion(membres.map((m) => ({ abrege: m.abrege, solde: m.solde }))),
      });
    }
    return {
      date: jourIso(date),
      referentiel: dossier.referentiel,
      motifSansHorsBilan: dossier.referentiel === 'SYSCOHADA' ? null : MOTIF_SANS_HORS_BILAN_SYCEBNL,
      ribs: servisRibs,
      ribsTronques: totalRibs > ribs.length,
      totalRibs,
      declarationsTronquees: conditions.length >= LIMITE_DECLARATIONS || autorisations.length >= LIMITE_DECLARATIONS,
      unions: servisUnions,
      unionsTronquees: totalUnions > unions.length,
    };
  }

  // ---- Conditions ------------------------------------------------------

  async declarerConditions(tenantId: string, userId: string, ribId: string, dto: ConditionsSaisies & { commentaire?: string | null }) {
    const motif = motifRefusConditions(dto);
    if (motif) throw new BadRequestException(motif);
    const rib = await this.ribDuDossier(tenantId, ribId);
    const paliers: PalierDecouvert[] = (dto.paliers ?? []).map((p) => ({ plafond: p.plafond, taux: p.taux }));
    try {
      return await this.prisma.conditionBancaire.create({
        data: {
          tenantId,
          ribId,
          dateEffet: jour(dto.dateEffet),
          typePalier: paliers.length > 0 ? (dto.typePalier ?? null) : null,
          paliers: paliers as unknown as Prisma.InputJsonValue,
          tauxInteretsCrediteurs: dto.tauxInteretsCrediteurs ?? null,
          tauxCommissionMouvement: dto.tauxCommissionMouvement ?? null,
          tauxCommissionPlusFortDecouvert: dto.tauxCommissionPlusFortDecouvert ?? null,
          fraisTenueCompte: dto.fraisTenueCompte ?? null,
          periodiciteFrais: dto.periodiciteFrais ?? null,
          baseCalcul: dto.baseCalcul ?? null,
          referenceConvention: dto.referenceConvention.trim(),
          dateConvention: jour(dto.dateConvention),
          commentaire: dto.commentaire?.trim() || null,
          createdBy: userId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `Le RIB ${rib.abrege} porte déjà des conditions à effet du ${jour(dto.dateEffet).toLocaleDateString('fr-FR', { timeZone: 'UTC' })} · une correction est une version nouvelle, à une autre date, ou le retrait de celle-ci.`,
        );
      }
      throw e;
    }
  }

  async retirerConditions(tenantId: string, id: string) {
    const c = await this.prisma.conditionBancaire.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!c) throw new NotFoundException('Conditions introuvables pour ce dossier.');
    await this.prisma.conditionBancaire.delete({ where: { id, tenantId } });
    return { retire: true };
  }

  // ---- Autorisations ---------------------------------------------------

  async declarerAutorisation(tenantId: string, userId: string, ribId: string, dto: AutorisationSaisie & { commentaire?: string | null }) {
    const motif = motifRefusAutorisation(dto);
    if (motif) throw new BadRequestException(motif);
    await this.ribDuDossier(tenantId, ribId);
    return this.prisma.autorisationFinancement.create({
      data: {
        tenantId,
        ribId,
        nature: dto.nature,
        montant: dto.montant,
        dateDebut: jour(dto.dateDebut),
        dateFin: dto.dateFin ? jour(dto.dateFin) : null,
        irrevocable: dto.irrevocable,
        referenceConvention: dto.referenceConvention.trim(),
        dateConvention: jour(dto.dateConvention),
        commentaire: dto.commentaire?.trim() || null,
        createdBy: userId,
      },
    });
  }

  async retirerAutorisation(tenantId: string, id: string) {
    const a = await this.prisma.autorisationFinancement.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!a) throw new NotFoundException('Autorisation introuvable pour ce dossier.');
    await this.prisma.autorisationFinancement.delete({ where: { id, tenantId } });
    return { retire: true };
  }

  // ---- Unions ----------------------------------------------------------

  private async jugerUnion(tenantId: string, dto: UnionSaisie) {
    const ribs = await this.prisma.ribBanque.findMany({
      where: { tenantId, id: { in: [...new Set(dto.ribIds ?? [])] } },
      select: { id: true, abrege: true, devise: true },
      take: LIMITE_RIBS,
    });
    const motif = motifRefusUnion(dto, ribs);
    if (motif) throw new BadRequestException(motif);
  }

  private conflitDeCode(e: unknown, code: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException(`Une union de code ${code} existe déjà dans ce dossier.`);
    }
    throw e;
  }

  async creerUnion(tenantId: string, dto: UnionSaisie & { fusionEchelles?: boolean }) {
    await this.jugerUnion(tenantId, dto);
    const code = normaliserCodeUnion(dto.code);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        const union = await tx.unionComptesBancaires.create({
          data: { tenantId, code, intitule: dto.intitule.trim(), fusionEchelles: dto.fusionEchelles === true },
        });
        for (const [rang, ribId] of dto.ribIds.entries()) {
          await tx.elementUnionComptesBancaires.create({ data: { tenantId, unionId: union.id, ribId, rang: rang + 1 } });
        }
        return union;
      });
    } catch (e) {
      this.conflitDeCode(e, code);
    }
  }

  /** La composition se REMPLACE en entier, dans une transaction · chaque élément retiré par une suppression unitaire (journal d'audit). */
  async modifierUnion(tenantId: string, id: string, dto: UnionSaisie & { fusionEchelles?: boolean }) {
    const existante = await this.prisma.unionComptesBancaires.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existante) throw new NotFoundException('Union introuvable pour ce dossier.');
    await this.jugerUnion(tenantId, dto);
    const code = normaliserCodeUnion(dto.code);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        const anciens = await tx.elementUnionComptesBancaires.findMany({ where: { tenantId, unionId: id }, select: { id: true }, take: LIMITE_RIBS });
        for (const a of anciens) await tx.elementUnionComptesBancaires.delete({ where: { id: a.id, tenantId } });
        const union = await tx.unionComptesBancaires.update({
          where: { id, tenantId },
          data: { code, intitule: dto.intitule.trim(), fusionEchelles: dto.fusionEchelles === true },
        });
        for (const [rang, ribId] of dto.ribIds.entries()) {
          await tx.elementUnionComptesBancaires.create({ data: { tenantId, unionId: id, ribId, rang: rang + 1 } });
        }
        return union;
      });
    } catch (e) {
      this.conflitDeCode(e, code);
    }
  }

  async supprimerUnion(tenantId: string, id: string) {
    const existante = await this.prisma.unionComptesBancaires.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existante) throw new NotFoundException('Union introuvable pour ce dossier.');
    await transactionJournalisee(this.prisma, async (tx) => {
      const elements = await tx.elementUnionComptesBancaires.findMany({ where: { tenantId, unionId: id }, select: { id: true }, take: LIMITE_RIBS });
      for (const e of elements) await tx.elementUnionComptesBancaires.delete({ where: { id: e.id, tenantId } });
      await tx.unionComptesBancaires.delete({ where: { id, tenantId } });
    });
    return { supprime: true };
  }
}

/** Les décimaux de la base, rendus en nombres. */
function nombres(c: {
  tauxInteretsCrediteurs: Prisma.Decimal | null;
  tauxCommissionMouvement: Prisma.Decimal | null;
  tauxCommissionPlusFortDecouvert: Prisma.Decimal | null;
  fraisTenueCompte: Prisma.Decimal | null;
}) {
  const n = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));
  return {
    tauxInteretsCrediteurs: n(c.tauxInteretsCrediteurs),
    tauxCommissionMouvement: n(c.tauxCommissionMouvement),
    tauxCommissionPlusFortDecouvert: n(c.tauxCommissionPlusFortDecouvert),
    fraisTenueCompte: n(c.fraisTenueCompte),
  };
}

/**
 * Ce qui RETIENT un RIB · conditions, autorisations et unions. Le RIB (et la
 * banque qui les porte) ne se retire pas tant qu'elles tiennent · refus nommé
 * AVANT la base, dont la clé RESTRICT ne rendrait qu'une erreur anonyme.
 */
export async function motifRibRetenu(
  prisma: Pick<PrismaService, 'conditionBancaire' | 'autorisationFinancement' | 'elementUnionComptesBancaires'>,
  tenantId: string,
  ribIds: string[],
): Promise<string | null> {
  if (ribIds.length === 0) return null;
  const [conditions, autorisations, unions] = await Promise.all([
    prisma.conditionBancaire.count({ where: { tenantId, ribId: { in: ribIds } } }),
    prisma.autorisationFinancement.count({ where: { tenantId, ribId: { in: ribIds } } }),
    prisma.elementUnionComptesBancaires.count({ where: { tenantId, ribId: { in: ribIds } } }),
  ]);
  const usages = [
    conditions > 0 ? `${conditions} version(s) de conditions bancaires` : null,
    autorisations > 0 ? `${autorisations} autorisation(s) de financement` : null,
    unions > 0 ? `${unions} appartenance(s) à une union de comptes` : null,
  ].filter((x): x is string => x !== null);
  if (usages.length === 0) return null;
  return `Le RIB porte ${usages.join(', ')} · retirez-les d'abord (Structure › Paramètres de saisie › Banques).`;
}
