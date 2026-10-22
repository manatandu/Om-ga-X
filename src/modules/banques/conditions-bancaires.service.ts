import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Referentiel, StatutExercice } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasa } from '../../common/echeance';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { filtreOuverturePasseeAuPremierJour } from '../exercice/ouverture-passee';
import { estTresorerieEnDevises } from '../virements-fonds/virement-fonds';
import {
  MOTIF_SANS_HORS_BILAN_SYCEBNL,
  MOTIF_SITUATION_SUR_LE_TOTAL,
  motifFormeUnion,
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
  situationSurLeTotal,
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

/** Exercices précédents remontés au plus pour lire un solde · au-delà, le solde n'est pas servi (premier tour, m9). */
const REMONTEE_MAX = 20;
/** Soldes lus en même temps · chaque lecture tient quelques requêtes, le pool en sert dix (CLAUDE.md § 5). */
const LECTURES_SIMULTANEES = 4;

const jour = (v: string) => new Date(`${v}T00:00:00.000Z`);
const MOTIF_AUTORISATIONS_TRONQUEES = 'Liste des autorisations tronquée · une autorisation qui manque au total fausserait la situation, non calculée.';
const lendemain = (d: Date) => new Date(d.getTime() + 86_400_000);
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
      select: { id: true, abrege: true },
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
   *
   * LE JOUR SE LIT EN ENTIER (premier tour, constat M1) · `Ecriture.date` est
   * un instant, et une correction ou une réimputation horodatée l'après-midi
   * échappait à « au plus tard minuit » · la borne est le LENDEMAIN exclu.
   * Un exercice précédent se lit sur tout son livre (son `exerciceId` le
   * borne), jamais jusqu'à minuit de son dernier jour.
   *
   * UN COMPTE EN DEVISE NE SE LIT PAS EN FRANCS (premier tour, M3) · par les
   * trois signes du virement de fonds · la devise du RIB, la racine que le
   * plan sème « en devises » (`estTresorerieEnDevises`), une ligne en devise
   * déjà passée au compte. Sa contrevaleur au cours historique, confrontée à
   * une autorisation étiquetée en francs, rendait une utilisation fausse.
   */
  async soldeDuRib(
    tenantId: string,
    referentiel: Referentiel,
    rib: { devise: string | null; journal: { compteTresorerieId: string | null; compteTresorerie?: { numero: string } | null } | null },
    date: Date,
  ): Promise<SoldeLu> {
    const compteId = rib.journal?.compteTresorerieId ?? null;
    if (!compteId) return { solde: null, motif: 'RIB sans journal de banque · aucun compte à lire.' };
    if (monnaieDuRib(rib.devise) !== null) return { solde: null, motif: `Compte en ${monnaieDuRib(rib.devise)} · la situation en devise n'est pas encore lue.` };
    const numero = rib.journal?.compteTresorerie?.numero ?? null;
    if (numero && estTresorerieEnDevises(numero, referentiel)) {
      return { solde: null, motif: `Le compte ${numero} est tenu en devise · la situation en devise n'est pas encore lue.` };
    }
    const ligneEnDevise = await this.prisma.ligneEcriture.findFirst({
      where: { compteId, deviseId: { not: null }, ecriture: { tenantId, ...HORS_SITUATION } },
      select: { id: true },
    });
    if (ligneEnDevise) return { solde: null, motif: `${numero ? `Le compte ${numero}` : 'Le compte du RIB'} porte des lignes en devise · la situation en devise n'est pas encore lue.` };
    const exercice = await this.prisma.exercice.findFirst({
      where: { tenantId, dateDebut: { lte: date }, dateFin: { gte: date } },
      select: { id: true, dateDebut: true },
    });
    if (!exercice) return { solde: null, motif: `Aucun exercice ne couvre le ${date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.` };
    let centimes = await this.centimesDe(tenantId, compteId, exercice.id, lendemain(date));
    let courant = exercice;
    for (let rang = 0; ; rang++) {
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
      if (rang >= REMONTEE_MAX) {
        return { solde: null, motif: `Plus de ${REMONTEE_MAX} exercices ouverts se suivent sans ouverture qui porte ce compte · clôturez-en ou passez un bilan d'ouverture.` };
      }
      centimes += await this.centimesDe(tenantId, compteId, precedent.id, null);
      courant = precedent;
    }
    return { solde: centimes / 100, motif: null };
  }

  /** Les centimes du compte sur un exercice, dates strictement avant `avant` (aucune borne · tout le livre de l'exercice). Calcul en décimal exact. */
  private async centimesDe(tenantId: string, compteId: string, exerciceId: string, avant: Date | null): Promise<number> {
    const s = await this.prisma.ligneEcriture.aggregate({
      // Une ligne n'a pas de tenantId · la borne du dossier passe par son écriture.
      where: {
        compteId,
        ecriture: { tenantId, exerciceId, ...(avant ? { date: { lt: avant } } : {}), estANouveauProvisoire: false, ...HORS_SITUATION },
      },
      _sum: { debit: true, credit: true },
    });
    const debit = new Prisma.Decimal(s._sum?.debit ?? 0);
    const credit = new Prisma.Decimal(s._sum?.credit ?? 0);
    return debit.minus(credit).times(100).toDecimalPlaces(0).toNumber();
  }

  /** Tout ce que la fonction porte, avec la situation de chaque autorisation et la position de chaque union À LA DATE. */
  async lister(tenantId: string, au?: string) {
    const date = au ? jour(au) : jourDeKinshasa(new Date());
    const [dossier, ribs, totalRibs, unions, totalUnions] = await Promise.all([
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
      this.prisma.unionComptesBancaires.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
        take: LIMITE_UNIONS,
        include: { elements: { where: { tenantId }, orderBy: { rang: 'asc' }, take: LIMITE_RIBS, select: { ribId: true, rang: true } } },
      }),
      this.prisma.unionComptesBancaires.count({ where: { tenantId } }),
    ]);
    // LES DÉCLARATIONS DES SEULS RIB SERVIS, LES PLUS RÉCENTES D'ABORD
    // (premier tour, m6 et 11) · triées par date croissante sur tout le
    // dossier, la borne coupait les versions les plus récentes, donc celles
    // en vigueur, et une ancienne se disait « en vigueur ». Le total se compte,
    // et la troncature ne se dit que s'il dépasse ce qui est servi.
    const ribIds = ribs.map((r) => r.id);
    const [conditions, totalConditions, autorisations, totalAutorisations] = await Promise.all([
      this.prisma.conditionBancaire.findMany({
        where: { tenantId, ribId: { in: ribIds } },
        orderBy: [{ dateEffet: 'desc' }, { id: 'asc' }],
        take: LIMITE_DECLARATIONS,
      }),
      this.prisma.conditionBancaire.count({ where: { tenantId, ribId: { in: ribIds } } }),
      this.prisma.autorisationFinancement.findMany({
        where: { tenantId, ribId: { in: ribIds } },
        orderBy: [{ dateDebut: 'desc' }, { id: 'asc' }],
        take: LIMITE_DECLARATIONS,
      }),
      this.prisma.autorisationFinancement.count({ where: { tenantId, ribId: { in: ribIds } } }),
    ]);
    // Les soldes à lire · ceux des RIB qui portent une autorisation lisible en
    // cours et ceux des membres d'une union, lus par petits paquets (le pool).
    const aLire = new Set<string>();
    for (const a of autorisations) {
      if (autorisationEnCours(a, date) && seLitSurLeCompteBancaire(a.nature as NatureAutorisation)) aLire.add(a.ribId);
    }
    for (const u of unions) for (const e of u.elements) aLire.add(e.ribId);
    const soldes = new Map<string, SoldeLu>();
    const file = [...aLire];
    for (let i = 0; i < file.length; i += LECTURES_SIMULTANEES) {
      const paquet = file.slice(i, i + LECTURES_SIMULTANEES);
      const lus = await Promise.all(
        paquet.map((ribId) => {
          const rib = ribs.find((r) => r.id === ribId);
          return rib ? this.soldeDuRib(tenantId, dossier.referentiel, rib, date) : Promise.resolve({ solde: null, motif: 'RIB au-delà de la liste servie.' });
        }),
      );
      paquet.forEach((ribId, k) => soldes.set(ribId, lus[k]));
    }
    // LE TOTAL SE FAIT PAR COMPTE, PAS PAR RIB (second tour, m1 et m2) · un
    // dossier hérité peut tenir le même 52 sous deux journaux, donc deux RIB ;
    // leurs autorisations se lisent sur le même solde, et confrontées chacune
    // au solde entier elles fabriquaient deux dépassements.
    const compteDuRib = new Map(ribs.map((r) => [r.id, r.journal?.compteTresorerieId ?? `rib:${r.id}`]));
    const lisiblesDuCompte = new Map<string, typeof autorisations>();
    for (const a of autorisations) {
      if (!autorisationEnCours(a, date) || !seLitSurLeCompteBancaire(a.nature as NatureAutorisation)) continue;
      const cle = compteDuRib.get(a.ribId) ?? `rib:${a.ribId}`;
      lisiblesDuCompte.set(cle, [...(lisiblesDuCompte.get(cle) ?? []), a]);
    }
    // UNE LISTE TRONQUÉE NE SERT AUCUNE SITUATION (second tour, m3 et m4) · une
    // autorisation coupée par la borne manquerait au total, et l'autre se
    // dirait seule, juste, quand elle ne l'est pas.
    const autorisationsTronquees = totalAutorisations > autorisations.length;
    const servisRibs = [];
    for (const r of ribs) {
      const versions = conditions.filter((c) => c.ribId === r.id).sort((a, b) => a.dateEffet.getTime() - b.dateEffet.getTime());
      const enVigueur = conditionsEnVigueur(versions, date);
      const lu = soldes.get(r.id) ?? null;
      const siennes = autorisations.filter((x) => x.ribId === r.id).sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
      const lisiblesEnCours = lisiblesDuCompte.get(compteDuRib.get(r.id) ?? `rib:${r.id}`) ?? [];
      const surLeTotal = lisiblesEnCours.length > 1;
      const sesAutorisations = siennes.map((a) => {
        const nature = a.nature as NatureAutorisation;
        const enCours = autorisationEnCours(a, date);
        const lisible = seLitSurLeCompteBancaire(nature);
        const situation = enCours && lisible && !surLeTotal && !autorisationsTronquees ? situationAutorisation({ nature, montant: Number(a.montant) }, lu?.solde ?? null) : null;
        return {
          ...a,
          montant: Number(a.montant),
          enCours,
          situation,
          motifSituation: !enCours
            ? 'Autorisation hors de sa période à cette date.'
            : autorisationsTronquees
              ? MOTIF_AUTORISATIONS_TRONQUEES
              : !lisible
              ? 'Utilisation lue sur les opérations de financement (fonction 47), non sur le compte bancaire.'
              : surLeTotal
                ? MOTIF_SITUATION_SUR_LE_TOTAL
                : (lu?.motif ?? null),
          // L'INSCRIPTION HORS BILAN NE VISE QU'UN ENGAGEMENT QUI COURT
          // (premier tour, m7 et m2) · la fiche du compte 9011 parle de « la
          // partie non utilisée des crédits » · une autorisation échue n'en a plus.
          horsBilan: enCours ? inscriptionHorsBilan(dossier.referentiel, a.irrevocable) : null,
        };
      });
      const situationTotale = surLeTotal
        ? {
            ...situationSurLeTotal(lisiblesEnCours.map((a) => Number(a.montant)), autorisationsTronquees ? null : (lu?.solde ?? null)),
            motif: autorisationsTronquees ? MOTIF_AUTORISATIONS_TRONQUEES : (lu?.motif ?? null),
            nombre: lisiblesEnCours.length,
            // Des autorisations d'autres RIB sur le même compte entrent au total · il le dit.
            autresRib: [...new Set(lisiblesEnCours.filter((a) => a.ribId !== r.id).map((a) => ribs.find((x) => x.id === a.ribId)?.abrege ?? '·'))],
          }
        : null;
      const conditionsTronquees = totalConditions > conditions.length;
      servisRibs.push({
        id: r.id,
        abrege: r.abrege,
        banque: r.banque.intitule,
        devise: monnaieDuRib(r.devise),
        journal: r.journal?.code ?? null,
        compte: r.journal?.compteTresorerie?.numero ?? null,
        // Une liste tronquée ne dit pas quelle version est en vigueur · elle
        // pourrait être parmi celles qui manquent.
        conditions: versions.map((c) => ({ ...c, ...nombres(c), enVigueur: !conditionsTronquees && c.id === enVigueur?.id })),
        autorisations: sesAutorisations,
        situationTotale,
      });
    }
    const servisUnions = unions.map((u) => {
      const membres = u.elements.map((e) => {
        const rib = ribs.find((r) => r.id === e.ribId);
        const lu = soldes.get(e.ribId) ?? { solde: null, motif: 'RIB au-delà de la liste servie.' };
        return { ribId: e.ribId, abrege: rib?.abrege ?? '(RIB au-delà de la liste)', solde: lu.solde, motif: lu.motif, compteId: rib?.journal?.compteTresorerieId ?? null };
      });
      return {
        id: u.id,
        code: u.code,
        intitule: u.intitule,
        fusionEchelles: u.fusionEchelles,
        membres: membres.map(({ compteId: _c, ...m }) => m),
        position: positionUnion(membres),
      };
    });
    return {
      date: jourIso(date),
      referentiel: dossier.referentiel,
      motifSansHorsBilan: dossier.referentiel === 'SYSCOHADA' ? null : MOTIF_SANS_HORS_BILAN_SYCEBNL,
      ribs: servisRibs,
      ribsTronques: totalRibs > ribs.length,
      totalRibs,
      declarationsTronquees: totalConditions > conditions.length || totalAutorisations > autorisations.length,
      totalConditions,
      totalAutorisations,
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
      ribRetireEntreTemps(e);
      throw e;
    }
  }

  async retirerConditions(tenantId: string, id: string) {
    const c = await this.prisma.conditionBancaire.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!c) throw new NotFoundException('Conditions introuvables pour ce dossier.');
    await this.prisma.conditionBancaire.delete({ where: { id, tenantId } }).catch(dejaRetire('Ces conditions ont déjà été retirées.'));
    return { retire: true };
  }

  // ---- Autorisations ---------------------------------------------------

  async declarerAutorisation(tenantId: string, userId: string, ribId: string, dto: AutorisationSaisie & { commentaire?: string | null }) {
    const motif = motifRefusAutorisation(dto);
    if (motif) throw new BadRequestException(motif);
    await this.ribDuDossier(tenantId, ribId);
    return this.prisma.autorisationFinancement
      .create({
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
      })
      .catch((e: unknown) => {
        ribRetireEntreTemps(e);
        throw e;
      });
  }

  async retirerAutorisation(tenantId: string, id: string) {
    const a = await this.prisma.autorisationFinancement.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!a) throw new NotFoundException('Autorisation introuvable pour ce dossier.');
    await this.prisma.autorisationFinancement.delete({ where: { id, tenantId } }).catch(dejaRetire('Cette autorisation a déjà été retirée.'));
    return { retire: true };
  }

  // ---- Unions ----------------------------------------------------------

  private async jugerUnion(tenantId: string, dto: UnionSaisie) {
    // La forme avant la base (premier tour, M3) · rien d'illisible n'atteint la requête.
    const forme = motifFormeUnion(dto);
    if (forme) throw new BadRequestException(forme);
    const [dossier, ribs] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
      this.prisma.ribBanque.findMany({
        where: { tenantId, id: { in: [...new Set(dto.ribIds)] } },
        select: { id: true, abrege: true, devise: true, journal: { select: { compteTresorerieId: true, compteTresorerie: { select: { numero: true } } } } },
        take: LIMITE_RIBS,
      }),
    ]);
    const comptes = ribs.map((r) => r.journal?.compteTresorerieId).filter((c): c is string => typeof c === 'string');
    // Agrégé par la base (second tour, M2) · `distinct` se fait en JavaScript
    // sous Prisma 5 et rapatriait chaque ligne en devise de ces comptes.
    const enDevise = comptes.length === 0 ? [] : await this.prisma.ligneEcriture.groupBy({
      by: ['compteId'],
      where: { compteId: { in: comptes }, deviseId: { not: null }, ecriture: { tenantId, ...HORS_SITUATION } },
    });
    const motif = motifRefusUnion(
      dto,
      ribs.map((r) => ({
        id: r.id,
        abrege: r.abrege,
        devise: r.devise,
        compteId: r.journal?.compteTresorerieId ?? null,
        compteEnDevise:
          (r.journal?.compteTresorerie?.numero ? estTresorerieEnDevises(r.journal.compteTresorerie.numero, dossier.referentiel) : false) ||
          enDevise.some((l) => l.compteId === r.journal?.compteTresorerieId),
      })),
    );
    if (motif) throw new BadRequestException(motif);
  }

  /** Un conflit d'unicité ne se dit « code déjà pris » que s'il porte sur le code (premier tour, m5) · deux modifications concurrentes tombent sur le rang. */
  private conflitDeCode(e: unknown, code: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const cible = JSON.stringify(e.meta?.target ?? '');
      if (cible.includes('code')) throw new ConflictException(`Une union de code ${code} existe déjà dans ce dossier.`);
      throw new ConflictException("L'union vient d'être modifiée par un autre geste · relisez-la, puis recommencez.");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new NotFoundException("L'union vient d'être supprimée ou modifiée par un autre geste · relisez la liste.");
    }
    ribRetireEntreTemps(e);
    throw e;
  }

  async creerUnion(tenantId: string, dto: UnionSaisie & { fusionEchelles?: boolean }) {
    await this.jugerUnion(tenantId, dto);
    const code = normaliserCodeUnion(dto.code);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        const union = await tx.unionComptesBancaires.create({
          data: { tenantId, code, intitule: dto.intitule.trim(), fusionEchelles: dto.fusionEchelles ?? false },
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
          // Absent, le réglage ne change pas (premier tour, m7) · une modification de la composition ne remet plus la fusion à faux.
          data: { code, intitule: dto.intitule.trim(), ...(dto.fusionEchelles === undefined ? {} : { fusionEchelles: dto.fusionEchelles }) },
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
    }).catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new NotFoundException("L'union a déjà été supprimée.");
      throw e;
    });
    return { supprime: true };
  }
}

/** Une clé étrangère refusée à l'écriture · le RIB a été retiré entre le contrôle et l'écriture (premier tour, m5). */
function ribRetireEntreTemps(e: unknown): void {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
    throw new ConflictException("Le RIB vient d'être retiré par un autre geste · relisez la liste des banques.");
  }
}

/** Une ligne déjà retirée entre la lecture et la suppression · un 404 nommé, jamais une erreur anonyme. */
function dejaRetire(message: string) {
  return (e: unknown): never => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new NotFoundException(message);
    throw e;
  };
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

// `motifRibRetenu` vit dans `rib-retenu.ts` (lu aussi par les journaux, sans import circulaire).
export { motifRibRetenu } from './rib-retenu';
