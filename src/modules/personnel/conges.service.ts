import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NatureBulletinPaie, Prisma, StatutBulletinPaie } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { avertissementHeuresSaisies, joursQuiPortentDesHeures } from './feuilles-temps.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { MULTIPLICATEURS_ARTICLE_7 } from './bareme-smig';
import { moisValide } from './bulletin-paie';
import { entreeDuBulletin } from './comptabilisation-paie';
import {
  compteurConges,
  dernierJourOuvrableAvant,
  jourUtc,
  joursDuConge,
  motifRefusReprise,
  type FaitsDuCompteur,
  type JourIso,
} from './conges-acquis';
import { allocationDeConge } from './decompte-final';
import type { Referentiel } from './passation-paie';
import { AllocationCongeDto, CongeSalarieDto, RepriseCongesDto } from './dto/conges.dto';
import { serviceEnCours, type ContratLu } from './service-du-salarie';
import { absencesDuSalarie, lireAbsencesPourConges, type LecteurAbsences } from './absences-lecture';
import { NATURES_ABSENCE } from './absences';
import { jourDeKinshasaIso } from '../../common/echeance';
import { bulletinsQuiRetranchentLeConge, confronterLesBulletinsEmis } from './salaire-pendant-le-conge';

export { serviceEnCours, lireAbsencesPourConges };
export type { LecteurAbsences };

/**
 * LIGNE SAGE-L5, FONCTION 79 · le compteur des congés acquis chaque mois, la
 * reprise et les congés pris. Les règles sont dans `conges-acquis.ts`, le
 * calcul de l'allocation dans `decompte-final.ts` (`allocationDeConge`, le
 * même que l'indemnité compensatoire de l'art. 144) · ce service lit, rejoue
 * et enregistre.
 */

type Db = PrismaService | Prisma.TransactionClient;

/** Les bulletins d'un salarié · un par mois au plus, cinquante ans de service tiennent dedans. */
const PLAFOND_BULLETINS_SALARIE = 1_000;
/** Les congés d'un salarié · bien au-delà de ce qu'une carrière en pose. */
export const PLAFOND_CONGES_SALARIE = 500;

/** Les natures de l'art. 142, al. 2 · « commissions, primes, sommes versées pour prestations supplémentaires et participation au bénéfice ». */
const NATURES_DE_LA_MOYENNE_142 = new Set(['COMMISSION', 'PRIME', 'PRESTATION_SUPPLEMENTAIRE', 'PARTICIPATION_AUX_BENEFICES']);

export const NATURE_ALLOCATION_CONGE = 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE';

const iso = (d: Date): JourIso => d.toISOString().slice(0, 10);
const nombre = (d: Prisma.Decimal | null): number | null => (d === null ? null : Number(d));
const moisPrecedent = (mois: string, n: number) => {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - n, 1));
  return iso(d).slice(0, 7);
};

/**
 * LE TAUX JOURNALIER PROPOSÉ, jamais substitué · la rémunération convenue
 * ramenée au jour par les multiplicateurs du décret n° 25/22, art. 7 (6, 26,
 * 312), par analogie, comme le décompte final (`REGLE_MOYENNE_AU_JOUR`).
 */
export function tauxJournalierPropose(contrat: Pick<ContratLu, 'remunerationBase' | 'periodiciteRemuneration' | 'deviseRemuneration'> | null):
  | { valeur: number; devise: string; explication: string }
  | { valeur: null; motif: string } {
  if (!contrat) return { valeur: null, motif: 'Aucun contrat ne couvre la date du départ.' };
  if (contrat.remunerationBase === null) return { valeur: null, motif: 'Le contrat ne porte pas de rémunération convenue.' };
  if (!contrat.periodiciteRemuneration) return { valeur: null, motif: "La périodicité de la rémunération n'est pas renseignée au contrat." };
  if (!contrat.deviseRemuneration) return { valeur: null, motif: "La monnaie de la rémunération n'est pas renseignée au contrat." };
  const base = Number(contrat.remunerationBase);
  const diviseur =
    contrat.periodiciteRemuneration === 'JOUR'
      ? 1
      : MULTIPLICATEURS_ARTICLE_7[contrat.periodiciteRemuneration as 'SEMAINE' | 'MOIS' | 'ANNEE'];
  const valeur = Math.round((base / diviseur) * 100) / 100;
  return {
    valeur,
    devise: contrat.deviseRemuneration,
    explication:
      diviseur === 1
        ? 'Rémunération journalière du contrat.'
        : `Rémunération du contrat ramenée au jour par ${diviseur} (décret n° 25/22, art. 7, par analogie).`,
  };
}

/** Ce que le compteur lit en base · un salarié, borné au dossier. */
async function lireFaits(db: Db, tenantId: string, salarieId: string, lireAbsences: LecteurAbsences) {
  const salarie = await db.salarie.findFirst({
    where: { id: salarieId, tenantId },
    select: {
      id: true,
      nom: true,
      dateNaissance: true,
      millesimeNaissance: true,
      contrats: {
        select: {
          id: true,
          dateEntreeEnVigueur: true,
          dateFin: true,
          renouvelleDeId: true,
          remunerationBase: true,
          periodiciteRemuneration: true,
          deviseRemuneration: true,
        },
      },
    },
  });
  if (!salarie) throw new NotFoundException('Salarié introuvable dans ce dossier.');
  const [bulletins, reprise, conges, absences] = await Promise.all([
    db.bulletinPaie.findMany({
      where: { tenantId, salarieId, statut: StatutBulletinPaie.EMIS },
      select: { id: true, numero: true, moisDePaie: true, nature: true },
      orderBy: { moisDePaie: 'asc' },
      take: PLAFOND_BULLETINS_SALARIE,
    }),
    db.repriseCongesSalarie.findFirst({ where: { tenantId, salarieId } }),
    db.congeSalarie.findMany({
      where: { tenantId, salarieId },
      orderBy: { du: 'asc' },
      take: PLAFOND_CONGES_SALARIE,
      include: { bulletin: { select: { id: true, numero: true, statut: true, moisDePaie: true } } },
    }),
    lireAbsences(db, tenantId, salarieId),
  ]);
  return { salarie, bulletins, reprise, conges, absences };
}

type FaitsLus = Awaited<ReturnType<typeof lireFaits>>;

/** Les jours comptés d'un congé, maladie et voyage retranchés. */
function joursDe(c: { du: Date; au: Date; joursVoyage: number }, joursMaladie: Set<JourIso>) {
  return joursDuConge({ du: iso(c.du), au: iso(c.au), joursVoyage: c.joursVoyage, joursMaladie });
}

function faitsDuCompteur(f: FaitsLus, aLa: JourIso, sauf?: string): FaitsDuCompteur | { refus: string } {
  const service = serviceEnCours(f.salarie.contrats);
  if (!service) return { refus: "Aucun contrat n'est enregistré pour ce salarié · le service ne se compte pas sans lui." };
  const conges: { id: string; du: JourIso; jours: number }[] = [];
  for (const c of f.conges) {
    if (c.annuleLe || c.id === sauf) continue;
    const j = joursDe(c, f.absences.joursMaladie);
    if ('refus' in j) return { refus: `Congé du ${iso(c.du)} · ${j.refus}` };
    conges.push({ id: c.id, du: iso(c.du), jours: j.jours });
  }
  return {
    origine: iso(service.origine),
    fin: service.fin ? iso(service.fin) : null,
    dateNaissance: f.salarie.dateNaissance ? iso(f.salarie.dateNaissance) : null,
    millesimeNaissance: f.salarie.millesimeNaissance,
    moisPayes: f.bulletins.map((b) => b.moisDePaie),
    joursHorsService: f.absences.joursHorsService,
    reprise: f.reprise
      ? {
          arreteAu: iso(f.reprise.arreteAu),
          joursNesNonPris: Number(f.reprise.joursNesNonPris),
          moisEnCoursAccomplis: f.reprise.moisEnCoursAccomplis,
        }
      : null,
    conges,
    aLa,
  };
}

/**
 * L'ALLOCATION D'UN CONGÉ, rejouée · le moteur de l'art. 142, sur les jours
 * comptés et les éléments déclarés au congé, dans sa monnaie.
 */
function allocationDuConge(
  c: { du: Date; au: Date; joursVoyage: number; deviseAllocation: string | null; remunerationJournaliere: Prisma.Decimal | null; moyenneMensuelleArticle142: Prisma.Decimal | null },
  joursMaladie: Set<JourIso>,
) {
  const j = joursDe(c, joursMaladie);
  if ('refus' in j) return { jours: null, montant: null, tauxJournalier: null, devise: c.deviseAllocation, motif: j.refus };
  const a = allocationDeConge({
    jours: j.jours,
    remunerationJournaliereFc: nombre(c.remunerationJournaliere),
    moyenneMensuelleArticle142Fc: nombre(c.moyenneMensuelleArticle142),
  });
  const motif = a.motif ?? (c.deviseAllocation ? null : "La monnaie de la rémunération n'est pas déclarée au congé.");
  return {
    jours: j.jours,
    ouvrables: j.ouvrables,
    maladie: j.maladie,
    montant: motif ? null : a.montantFc === null ? null : Math.round(a.montantFc * 100) / 100,
    tauxJournalier: a.tauxJournalierFc,
    devise: c.deviseAllocation,
    motif,
  };
}

/** Le congé porté par un bulletin ACTIF · annulé, le bulletin libère le congé. */
const porteurActif = (c: { bulletin: { statut: StatutBulletinPaie } | null }) => c.bulletin?.statut === StatutBulletinPaie.EMIS;

/** Une allocation portée par un bulletin · ce que l'élément de paie fige, et ce que l'émission lie. */
export type AllocationPortee = {
  readonly congeId: string;
  readonly du: JourIso;
  readonly au: JourIso;
  readonly jours: number;
  readonly tauxJournalier: number;
  readonly devise: 'CDF' | 'USD';
  readonly montant: number;
};

/**
 * LES ALLOCATIONS QU'UN BULLETIN PORTE, rejouées au serveur · le client ne
 * nomme que les congés, jamais un montant. Chacun doit être du salarié payé,
 * non annulé, rattaché au mois du bulletin, chiffré, libre de tout bulletin
 * actif, et dans la monnaie de la saisie.
 */
export async function allocationsAPorter(
  db: Db,
  tenantId: string,
  salarieId: string,
  moisDePaie: string,
  congeIds: readonly string[],
  deviseStipulation: 'CDF' | 'USD',
  lireAbsences: LecteurAbsences = lireAbsencesPourConges,
): Promise<AllocationPortee[]> {
  if (new Set(congeIds).size !== congeIds.length) throw new BadRequestException('Un même congé figure deux fois dans les allocations.');
  const conges = await db.congeSalarie.findMany({
    where: { tenantId, id: { in: [...congeIds] } },
    include: { bulletin: { select: { numero: true, statut: true } } },
  });
  const absences = await lireAbsences(db, tenantId, salarieId);
  const portees: AllocationPortee[] = [];
  for (const id of congeIds) {
    const c = conges.find((x) => x.id === id);
    if (!c || c.salarieId !== salarieId) throw new BadRequestException("Congé introuvable pour ce salarié · un bulletin ne porte que les congés du salarié payé.");
    const quand = `Congé du ${iso(c.du)} au ${iso(c.au)}`;
    if (c.annuleLe) throw new BadRequestException(`${quand} · annulé, il ne se paie pas.`);
    if (c.moisDePaie !== moisDePaie) {
      throw new BadRequestException(`${quand} · son allocation est rattachée au bulletin de ${c.moisDePaie}, pas à celui de ${moisDePaie}.`);
    }
    if (porteurActif(c)) throw new BadRequestException(`${quand} · son allocation est déjà portée par le bulletin n° ${c.bulletin!.numero}.`);
    const a = allocationDuConge(c, absences.joursMaladie);
    if (a.montant === null || a.jours === null || a.tauxJournalier === null) {
      throw new BadRequestException(`${quand} · allocation non chiffrée · ${a.motif ?? 'élément manquant'}`);
    }
    if (a.devise !== deviseStipulation) {
      throw new BadRequestException(`${quand} · l'allocation est en ${a.devise}, le bulletin en ${deviseStipulation} · une seule monnaie par bulletin.`);
    }
    // B1, SECOND TOUR · LES AUTRES MOIS DU CONGÉ. Un bulletin déjà émis d'un
    // mois que le congé touche (septembre, quand l'allocation du congé du 10
    // au 25 septembre part au bulletin d'octobre) a pu payer ces jours au
    // salaire · l'allocation les paierait une seconde fois (Code du travail,
    // art. 142). Relu sur sa saisie figée et son contrat ; le mois du bulletin
    // qui porte, l'émission le juge elle-même.
    const autres = await confronterLesBulletinsEmis(
      db,
      tenantId,
      salarieId,
      {
        id: c.id,
        du: iso(c.du),
        au: iso(c.au),
        joursVoyage: c.joursVoyage,
        remunerationJournaliere: nombre(c.remunerationJournaliere),
        deviseAllocation: c.deviseAllocation,
      },
      {
        saufMois: moisDePaie,
        issue: (numero, mois) =>
          `annulez le bulletin n° ${numero} et réémettez le bulletin de ${mois} en reprenant la proposition « Absences et congés du mois », puis portez l'allocation au bulletin de ${moisDePaie}.`,
      },
    );
    if (autres.refus.length) throw new BadRequestException(`${quand} · ${autres.refus.join(' ')}`);
    portees.push({ congeId: c.id, du: iso(c.du), au: iso(c.au), jours: a.jours, tauxJournalier: a.tauxJournalier, devise: a.devise as 'CDF' | 'USD', montant: a.montant });
  }
  return portees;
}

/** Le libellé de l'élément de paie · il dit les dates et les jours (mentions 14 à 16 du livre de paie). */
export const libelleAllocation = (a: AllocationPortee) => `Allocation de congé du ${a.du} au ${a.au} · ${a.jours} jour(s) ouvrable(s)`;

/**
 * LIER LES CONGÉS AU BULLETIN ÉMIS, dans la transaction de l'émission et sous
 * son verrou · relus ici, un par un, par une mise à jour UNITAIRE (journal
 * d'audit). Un congé porté entre-temps refuse l'émission entière.
 */
export async function lierCongesAuBulletin(tx: Prisma.TransactionClient, tenantId: string, bulletinId: string, portees: readonly AllocationPortee[]) {
  for (const a of portees) {
    const c = await tx.congeSalarie.findFirst({
      where: { id: a.congeId, tenantId },
      select: { id: true, annuleLe: true, bulletin: { select: { numero: true, statut: true } } },
    });
    if (!c || c.annuleLe) throw new ConflictException(`Congé du ${a.du} annulé pendant l'émission · rien n'est émis.`);
    if (porteurActif(c)) throw new ConflictException(`Congé du ${a.du} porté entre-temps par le bulletin n° ${c.bulletin!.numero} · rien n'est émis.`);
    await tx.congeSalarie.update({ where: { id: c.id }, data: { bulletinId } });
  }
}

@Injectable()
export class CongesService {
  /** Le lecteur des absences de la fonction 78 · un seul, servi aussi à l'émission du bulletin. */
  private readonly lireAbsences: LecteurAbsences = lireAbsencesPourConges;

  constructor(private readonly prisma: PrismaService) {}

  /** Le compteur, les congés et les propositions d'un salarié à une date. */
  async compteur(tenantId: string, salarieId: string, aLaBrut?: string) {
    // Le jour du compteur est celui de Kinshasa (UTC+1), jamais celui de
    // l'horloge UTC du serveur · entre 23 h et minuit UTC, le compteur
    // aurait été lu la veille (relecture L5, mineur 7 ; `common/echeance.ts`).
    const aLa = aLaBrut ? aLaBrut.slice(0, 10) : jourDeKinshasaIso(new Date());
    if (!jourUtc(aLa)) throw new BadRequestException('La date de lecture du compteur se lit AAAA-MM-JJ.');
    const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
    const faits = faitsDuCompteur(f, aLa);
    const compteur = 'refus' in faits ? faits : compteurConges(faits);
    const conges = f.conges.map((c) => {
      const a = allocationDuConge(c, f.absences.joursMaladie);
      return {
        id: c.id,
        du: iso(c.du),
        au: iso(c.au),
        joursVoyage: c.joursVoyage,
        moisDePaie: c.moisDePaie,
        deviseAllocation: c.deviseAllocation,
        remunerationJournaliere: nombre(c.remunerationJournaliere),
        moyenneMensuelleArticle142: nombre(c.moyenneMensuelleArticle142),
        auDelaDuSolde: c.auDelaDuSolde,
        motifAuDelaDuSolde: c.motifAuDelaDuSolde,
        annuleLe: c.annuleLe,
        motifAnnulation: c.motifAnnulation,
        bulletin: c.bulletin ? { numero: c.bulletin.numero, statut: c.bulletin.statut, moisDePaie: c.bulletin.moisDePaie } : null,
        paiementAuPlusTard: dernierJourOuvrableAvant(iso(c.du)),
        allocation: a,
      };
    });
    return {
      aLa,
      compteur,
      reprise: f.reprise
        ? {
            arreteAu: iso(f.reprise.arreteAu),
            joursNesNonPris: Number(f.reprise.joursNesNonPris),
            moisEnCoursAccomplis: f.reprise.moisEnCoursAccomplis,
            source: f.reprise.source,
            declarePar: f.reprise.declarePar,
          }
        : null,
      conges,
      tronque: f.conges.length >= PLAFOND_CONGES_SALARIE,
    };
  }

  /**
   * LES PROPOSITIONS POUR UN CONGÉ QUI PART À UNE DATE · le taux journalier du
   * contrat et la moyenne des douze mois de l'art. 142, al. 2, lue sur les
   * bulletins émis. Proposées, jamais substituées · la moyenne ne se propose
   * que sur DOUZE bulletins, sans quoi un mois payé hors d'OmegaX serait lu
   * comme un mois sans prime.
   */
  async propositions(tenantId: string, salarieId: string, duBrut: string) {
    const du = jourUtc(duBrut.slice(0, 10));
    if (!du) throw new BadRequestException('La date du départ se lit AAAA-MM-JJ.');
    const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
    const contrat =
      f.salarie.contrats
        .filter((c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= du.getTime()))
        .sort((a, b) => b.dateEntreeEnVigueur.getTime() - a.dateEntreeEnVigueur.getTime())[0] ?? null;
    const taux = tauxJournalierPropose(contrat);
    const moisDepart = iso(du).slice(0, 7);
    const douze = new Set(Array.from({ length: 12 }, (_, i) => moisPrecedent(moisDepart, i + 1)));
    let moyenne: { valeur: number; explication: string } | { valeur: null; motif: string };
    if (contrat?.deviseRemuneration && contrat.deviseRemuneration !== 'CDF') {
      moyenne = { valeur: null, motif: 'Le contrat est stipulé hors franc · la moyenne se déclare dans sa monnaie.' };
    } else {
      const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
      const bulletins = await this.prisma.bulletinPaie.findMany({
        where: { tenantId, salarieId, statut: StatutBulletinPaie.EMIS, nature: NatureBulletinPaie.MOIS, moisDePaie: { in: [...douze] } },
        select: { id: true, numero: true, nomComplet: true, statut: true, ecritureId: true, netAPayerFc: true, entree: true, calcul: true, moisDePaie: true },
        take: 12,
      });
      if (bulletins.length < 12) {
        moyenne = {
          valeur: null,
          motif: `${bulletins.length} bulletin(s) émis sur les douze mois précédant le départ · la moyenne de l'article 142, alinéa 2 se déclare.`,
        };
      } else {
        let total = 0;
        for (const b of bulletins) {
          const e = entreeDuBulletin(
            { ...b, statut: 'EMIS', netAPayerFc: Number(b.netAPayerFc) },
            tenant.referentiel as Referentiel,
          );
          if (!e) {
            total = Number.NaN;
            break;
          }
          total += e.elements.filter((x) => NATURES_DE_LA_MOYENNE_142.has(x.nature)).reduce((s, x) => s + x.montantFc, 0);
        }
        moyenne = Number.isNaN(total)
          ? { valeur: null, motif: 'Un bulletin des douze mois est illisible · la moyenne se déclare.' }
          : {
              valeur: Math.round((total / 12) * 100) / 100,
              explication:
                'Commissions, primes, prestations supplémentaires et participation des douze bulletins précédant le départ, divisées par douze.',
            };
      }
    }
    return { du: iso(du), tauxJournalier: taux, moyenneMensuelleArticle142: moyenne, paiementAuPlusTard: dernierJourOuvrableAvant(iso(du)) };
  }

  /** Déclarer ou corriger la reprise · une par salarié, au journal d'audit. */
  async declarerReprise(tenantId: string, userEmail: string, salarieId: string, dto: RepriseCongesDto) {
    const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
    const service = serviceEnCours(f.salarie.contrats);
    if (!service) throw new BadRequestException("Aucun contrat n'est enregistré pour ce salarié · la reprise se compte depuis son entrée en service.");
    const arreteAu = dto.arreteAu.slice(0, 10);
    const refus = motifRefusReprise({
      origine: iso(service.origine),
      arreteAu,
      joursNesNonPris: dto.joursNesNonPris,
      moisEnCoursAccomplis: dto.moisEnCoursAccomplis,
      source: dto.source,
    });
    if (refus) throw new BadRequestException(refus);
    const donnees = {
      arreteAu: new Date(`${arreteAu}T00:00:00.000Z`),
      joursNesNonPris: new Prisma.Decimal(dto.joursNesNonPris),
      moisEnCoursAccomplis: dto.moisEnCoursAccomplis,
      source: dto.source.trim(),
      declarePar: userEmail,
    };
    // Retouchée par son identifiant, jamais par un `upsert` sur la clé
    // composée · le journal d'audit garde la valeur remplacée.
    if (f.reprise) {
      await this.prisma.repriseCongesSalarie.update({ where: { id: f.reprise.id }, data: donnees });
    } else {
      await this.prisma.repriseCongesSalarie.create({ data: { tenantId, salarieId, ...donnees } });
    }
    return this.compteur(tenantId, salarieId);
  }

  /**
   * POSER UN CONGÉ. Les jours se comptent (art. 141, al. 3 et 4) ; au-delà
   * des droits nés à la date du départ, le congé ne passe que DIT, avec son
   * motif (art. 140, al. 3 · le droit naît à l'expiration de l'année).
   */
  async creerConge(tenantId: string, userEmail: string, salarieId: string, dto: CongeSalarieDto) {
    if (!moisValide(dto.moisDePaie)) throw new BadRequestException('Le mois de paie se lit AAAA-MM.');
    const du = jourUtc(dto.du.slice(0, 10));
    const au = jourUtc(dto.au.slice(0, 10));
    if (!du || !au) throw new BadRequestException('Les dates du congé se lisent AAAA-MM-JJ.');
    const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
    const couvre = f.salarie.contrats.some(
      (c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= au.getTime()),
    );
    if (!couvre) throw new BadRequestException("Aucun contrat ne couvre le congé du début à la fin · un congé s'exécute pendant le contrat.");
    const chevauche = f.conges.find((c) => !c.annuleLe && c.du.getTime() <= au.getTime() && c.au.getTime() >= du.getTime());
    if (chevauche) throw new BadRequestException(`Le congé chevauche celui du ${iso(chevauche.du)} au ${iso(chevauche.au)}.`);
    // M2 DE LA RELECTURE · UN JOUR N'A QU'UNE CAUSE, dans les deux sens. Le
    // congé ne se pose pas sur une absence déjà déclarée, sauf la maladie,
    // dont les jours « ne sont pas comptés comme jours de congé » (Code du
    // travail, art. 141, al. 4) · c'est le seul cas où le texte fait
    // coexister les deux. Jumeau du refus de `AbsencesService.creer`.
    const absences = await absencesDuSalarie(this.prisma, tenantId, salarieId);
    const absenceChevauchee = absences.find((a) => !NATURES_ABSENCE[a.nature].maladie && a.du <= iso(au) && a.au >= iso(du));
    if (absenceChevauchee) {
      throw new BadRequestException(
        `Le congé chevauche l'absence du ${absenceChevauchee.du} au ${absenceChevauchee.au} (${NATURES_ABSENCE[absenceChevauchee.nature].libelle}) · un jour n'a qu'une cause, et seule la maladie survenue pendant un congé s'y déclare (Code du travail, art. 141, al. 4). Annulez ou corrigez l'absence, ou posez le congé hors de ses jours.`,
      );
    }
    const jours = joursDuConge({ du: iso(du), au: iso(au), joursVoyage: dto.joursVoyage ?? 0, joursMaladie: f.absences.joursMaladie });
    if ('refus' in jours) throw new BadRequestException(jours.refus);
    if (jours.jours <= 0) throw new BadRequestException("Le congé ne compte aucun jour ouvrable · rien ne s'en retranche.");
    this.verifierAllocation(dto, f.salarie.contrats, du);

    // LE SOLDE AU DÉPART · droits nés à la date du départ, moins les autres
    // congés posés avant lui. MINEUR 5 DE LA RELECTURE · un congé posé à une
    // date ANTÉRIEURE à des congés déjà posés consomme aussi les droits dont
    // ceux-ci vivaient · chaque congé postérieur garde sa marge (solde à son
    // départ, congés antérieurs compris, moins ses propres jours), et le
    // nouveau congé ne la dépasse pas. Sans quoi deux congés passaient chacun
    // sur un solde qui ne comptait pas l'autre.
    const soldeA = (t: Date): number | null => {
      const faits = faitsDuCompteur({ ...f, conges: f.conges.filter((c) => c.du.getTime() < t.getTime()) }, iso(t));
      const compteur = 'refus' in faits ? null : compteurConges(faits);
      return compteur && !('refus' in compteur) ? compteur.solde : null;
    };
    let solde = soldeA(du);
    let borneePar: { du: Date; au: Date } | null = null;
    const posterieurs = f.conges.filter((c) => !c.annuleLe && c.du.getTime() > au.getTime()).sort((x, y) => x.du.getTime() - y.du.getTime());
    for (const c of posterieurs) {
      if (solde === null) break;
      const j = joursDe(c, f.absences.joursMaladie);
      const soldeDuPosterieur = soldeA(c.du);
      const marge = soldeDuPosterieur === null || 'refus' in j ? null : soldeDuPosterieur - j.jours;
      if (marge === null) {
        solde = null;
        borneePar = c;
      } else if (marge < solde) {
        solde = marge;
        borneePar = c;
      }
    }
    const auDela = solde === null || jours.jours > solde;
    if (auDela && dto.auDelaDuSolde !== true) {
      const posterieur = borneePar ? `, compte tenu du congé déjà posé du ${iso(borneePar.du)} au ${iso(borneePar.au)}` : '';
      throw new BadRequestException(
        solde === null
          ? `Le solde des congés nés au ${iso(du)} n'est pas chiffré${posterieur} · cochez « Au-delà du solde » et dites pourquoi pour poser ce congé.`
          : `Le congé compte ${jours.jours} jour(s) et le solde des droits nés au ${iso(du)} est de ${Math.max(0, solde)}${posterieur} · le droit naît à l'expiration de l'année de services (article 140, alinéa 3). Cochez « Au-delà du solde » et dites pourquoi pour le poser quand même.`,
      );
    }
    if (dto.auDelaDuSolde && (dto.motifAuDelaDuSolde ?? '').trim().length < 3) {
      throw new BadRequestException('Un congé au-delà du solde se pose avec son motif.');
    }
    // B1, SECOND TOUR · LE CONGÉ POSÉ APRÈS UN BULLETIN ÉMIS. Chaque bulletin
    // déjà émis d'un mois que le congé touche est relu sur sa saisie figée ·
    // s'il paie le salaire des jours que l'allocation paiera (art. 142), le
    // congé est refusé, avec le bulletin et l'issue (annuler, poser, réémettre).
    const surLesBulletins = await confronterLesBulletinsEmis(
      this.prisma,
      tenantId,
      salarieId,
      {
        du: iso(du),
        au: iso(au),
        joursVoyage: dto.joursVoyage ?? 0,
        remunerationJournaliere: dto.remunerationJournaliere ?? null,
        deviseAllocation: dto.deviseAllocation ?? null,
      },
      {
        issue: (numero, mois) =>
          `annulez le bulletin n° ${numero}, posez le congé, puis réémettez le bulletin de ${mois} en reprenant la proposition « Absences et congés du mois ».`,
      },
    );
    if (surLesBulletins.refus.length) throw new BadRequestException(`Congé non posé · ${surLesBulletins.refus.join(' ')}`);
    const cree = await this.prisma.congeSalarie.create({
      data: {
        tenantId,
        salarieId,
        du,
        au,
        joursVoyage: dto.joursVoyage ?? 0,
        moisDePaie: dto.moisDePaie,
        deviseAllocation: dto.deviseAllocation ?? null,
        remunerationJournaliere: dto.remunerationJournaliere ?? null,
        moyenneMensuelleArticle142: dto.moyenneMensuelleArticle142 ?? null,
        auDelaDuSolde: auDela && dto.auDelaDuSolde === true,
        motifAuDelaDuSolde: auDela && dto.auDelaDuSolde ? dto.motifAuDelaDuSolde!.trim() : null,
        creePar: userEmail,
      },
      select: { id: true },
    });
    const avertissementHeures = avertissementHeuresSaisies(await joursQuiPortentDesHeures(this.prisma, tenantId, salarieId, { du, au }), 'congé');
    return {
      id: cree.id,
      jours: jours.jours,
      ...(await this.compteur(tenantId, salarieId)),
      // Second tour, point 2 · un bulletin que rien ne confronte au congé est
      // dit ; les heures déjà saisies sur ses jours aussi (`joursQuiPortentDesHeures`).
      avertissements: [...surLesBulletins.avertissements, ...(avertissementHeures ? [avertissementHeures] : [])],
    };
  }

  /** Les éléments de l'allocation · dans la monnaie du contrat, quand il la porte. */
  private verifierAllocation(dto: AllocationCongeDto, contrats: readonly ContratLu[], du: Date) {
    const montantDeclare = dto.remunerationJournaliere !== undefined || dto.moyenneMensuelleArticle142 !== undefined;
    if (montantDeclare && !dto.deviseAllocation) throw new BadRequestException("Un montant de l'allocation se déclare avec sa monnaie.");
    const contrat = contrats
      .filter((c) => c.dateEntreeEnVigueur.getTime() <= du.getTime() && (!c.dateFin || c.dateFin.getTime() >= du.getTime()))
      .sort((a, b) => b.dateEntreeEnVigueur.getTime() - a.dateEntreeEnVigueur.getTime())[0];
    if (dto.deviseAllocation && contrat?.deviseRemuneration && contrat.deviseRemuneration !== dto.deviseAllocation) {
      throw new BadRequestException(`La rémunération du contrat est stipulée en ${contrat.deviseRemuneration} · l'allocation se déclare dans la même monnaie.`);
    }
  }

  /** Compléter ou corriger ce qui fonde l'allocation, tant qu'aucun bulletin actif ne la porte. */
  async modifierAllocation(tenantId: string, id: string, dto: AllocationCongeDto) {
    const c = await this.prisma.congeSalarie.findFirst({
      where: { id, tenantId },
      include: { bulletin: { select: { numero: true, statut: true } }, salarie: { select: { contrats: true } } },
    });
    if (!c) throw new NotFoundException('Congé introuvable dans ce dossier.');
    if (c.annuleLe) throw new BadRequestException('Ce congé est annulé.');
    if (porteurActif(c)) {
      throw new BadRequestException(`L'allocation est portée par le bulletin n° ${c.bulletin!.numero} · annulez d'abord le bulletin pour la corriger.`);
    }
    this.verifierAllocation(dto, c.salarie.contrats, c.du);
    await this.prisma.congeSalarie.update({
      where: { id: c.id },
      data: {
        deviseAllocation: dto.deviseAllocation ?? null,
        remunerationJournaliere: dto.remunerationJournaliere ?? null,
        moyenneMensuelleArticle142: dto.moyenneMensuelleArticle142 ?? null,
      },
    });
    return this.compteur(tenantId, c.salarieId);
  }

  /** Annuler un congé · jamais supprimé, marqué avec son motif. Porté par un bulletin actif, refusé. */
  async annulerConge(tenantId: string, userEmail: string, id: string, motif: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      const c = await tx.congeSalarie.findFirst({ where: { id, tenantId }, include: { bulletin: { select: { numero: true, statut: true } } } });
      if (!c) throw new NotFoundException('Congé introuvable dans ce dossier.');
      if (c.annuleLe) throw new BadRequestException('Ce congé est déjà annulé.');
      if (porteurActif(c)) {
        throw new BadRequestException(
          `L'allocation de ce congé est portée par le bulletin n° ${c.bulletin!.numero} · annulez d'abord le bulletin, puis le congé.`,
        );
      }
      // B1, SECOND TOUR · le bulletin émis d'un mois que le congé touche a
      // retranché ses jours du salaire (la garde l'y oblige) · annulé seul, le
      // congé laisserait ces jours sans salaire ni allocation, en silence.
      const retranches = await bulletinsQuiRetranchentLeConge(tx, tenantId, c.salarieId, {
        id: c.id,
        du: iso(c.du),
        au: iso(c.au),
        joursVoyage: c.joursVoyage,
      });
      if (retranches.refus.length) throw new BadRequestException(`Congé non annulé · ${retranches.refus.join(' ')}`);
      await tx.congeSalarie.update({ where: { id: c.id }, data: { annuleLe: new Date(), annulePar: userEmail, motifAnnulation: motif.trim() } });
      return { annule: true, salarieId: c.salarieId, avertissements: retranches.avertissements };
    });
  }

  /** Les congés dont le bulletin de ce mois peut porter l'allocation · servis à la simulation. */
  async congesDuMois(tenantId: string, salarieId: string, mois: string) {
    if (!moisValide(mois)) throw new BadRequestException('Le mois de paie se lit AAAA-MM.');
    const f = await lireFaits(this.prisma, tenantId, salarieId, this.lireAbsences);
    return f.conges
      .filter((c) => !c.annuleLe && c.moisDePaie === mois)
      .map((c) => ({
        id: c.id,
        du: iso(c.du),
        au: iso(c.au),
        portePar: porteurActif(c) ? c.bulletin!.numero : null,
        allocation: allocationDuConge(c, f.absences.joursMaladie),
      }));
  }
}
