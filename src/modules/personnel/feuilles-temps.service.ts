import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutBulletinPaie } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { moisValide } from './bulletin-paie';
import { natureDuJour } from './jours-du-code-du-travail';
import {
  COMPTEURS_DU_DOSSIER_AU_PLUS,
  bornesDeLecture,
  compterLaSemaine,
  enCentiemes,
  finDeService,
  heuresAProposer,
  iso,
  joursEntre,
  jourUtc,
  lundiDe,
  moisDePaiementDeLaSemaine,
  motifRefusCompteur,
  motifRefusHeuresDuJour,
  motifRefusPeriode,
  semainesPayeesAuMois,
  sousContrat,
  type JourConnu,
  type NatureMajorationHeures,
} from './feuilles-temps';
import { CompteurHeuresDto, FeuilleTempsDto, JoursFeuilleTempsDto } from './dto/feuilles-temps.dto';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · les feuilles de temps du salarié et les
 * compteurs libres d'heures. Les règles sont dans `feuilles-temps.ts` ; ce
 * service lit, rejoue et enregistre. Les heures proposées au bulletin le sont
 * à l'onglet Simulation, jamais substituées · le taux horaire et la
 * majoration restent déclarés (`heures-majorees.ts`).
 */

type Db = PrismaService | Prisma.TransactionClient;

/** Les feuilles d'un salarié · bien au-delà de ce qu'une carrière en compte au mois. */
const PLAFOND_FEUILLES_SALARIE = 600;
/** Les feuilles qui peuvent couvrir la lecture d'un mois de paie (six semaines au plus). */
const PLAFOND_FEUILLES_DU_MOIS = 60;
/** Les jours lus pour un mois de paie · six semaines, plusieurs feuilles. */
const PLAFOND_JOURS_DU_MOIS = 400;
const PLAFOND_CONTRATS = 500;
const PLAFOND_ABSENCES = 2_000;

const plusJours = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

type ContratLu = { dateEntreeEnVigueur: Date; dateFin: Date | null };

@Injectable()
export class FeuillesTempsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Les compteurs libres d'heures.

  async listerCompteurs(tenantId: string) {
    const compteurs = await this.prisma.compteurHeures.findMany({
      where: { tenantId },
      orderBy: [{ actif: 'desc' }, { code: 'asc' }],
      take: COMPTEURS_DU_DOSSIER_AU_PLUS + 1,
      select: { id: true, code: true, libelle: true, actif: true, desactiveLe: true, creePar: true },
    });
    return { compteurs: compteurs.slice(0, COMPTEURS_DU_DOSSIER_AU_PLUS), tronque: compteurs.length > COMPTEURS_DU_DOSSIER_AU_PLUS };
  }

  async creerCompteur(tenantId: string, userEmail: string, dto: CompteurHeuresDto) {
    const code = dto.code.trim().toUpperCase();
    const refus = motifRefusCompteur({ code, libelle: dto.libelle });
    if (refus) throw new BadRequestException(refus);
    const nombre = await this.prisma.compteurHeures.count({ where: { tenantId } });
    if (nombre >= COMPTEURS_DU_DOSSIER_AU_PLUS) {
      throw new BadRequestException(`Un dossier tient au plus ${COMPTEURS_DU_DOSSIER_AU_PLUS} compteurs libres · désactivez-en un plutôt que d'en créer un nouveau.`);
    }
    try {
      return await this.prisma.compteurHeures.create({
        data: { tenantId, code, libelle: dto.libelle.trim(), creePar: userEmail },
        select: { id: true },
      });
    } catch (e) {
      // L'index unique (dossier, code) tient ce qu'aucune lecture préalable ne
      // tient entre deux créations simultanées.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Le code « ${code} » est déjà pris dans ce dossier.`);
      }
      throw e;
    }
  }

  /** Désactiver · jamais supprimé, les feuilles qui l'ont alimenté le nomment encore. */
  async desactiverCompteur(tenantId: string, userEmail: string, id: string) {
    const c = await this.prisma.compteurHeures.findFirst({ where: { id, tenantId }, select: { id: true, actif: true } });
    if (!c) throw new NotFoundException('Compteur introuvable dans ce dossier.');
    if (!c.actif) throw new BadRequestException('Ce compteur est déjà désactivé.');
    await this.prisma.compteurHeures.update({ where: { id: c.id }, data: { actif: false, desactiveLe: new Date(), desactivePar: userEmail } });
    return { desactive: true };
  }

  // ---------------------------------------------------------------------
  // Les feuilles.

  /** Les feuilles d'un salarié, annulées comprises, avec leurs totaux. */
  async lister(tenantId: string, salarieId: string) {
    await this.salarie(tenantId, salarieId);
    const [feuilles, total] = await Promise.all([
      this.prisma.feuilleTemps.findMany({
        where: { tenantId, salarieId },
        orderBy: { du: 'desc' },
        take: PLAFOND_FEUILLES_SALARIE,
        include: { jours: { select: { heures: true, heuresNuit: true }, take: 31 } },
      }),
      this.prisma.feuilleTemps.count({ where: { tenantId, salarieId } }),
    ]);
    return {
      feuilles: feuilles.map((f) => ({
        id: f.id,
        du: iso(f.du),
        au: iso(f.au),
        observation: f.observation,
        heures: f.jours.reduce((n, j) => n + enCentiemes(Number(j.heures)), 0) / 100,
        heuresNuit: f.jours.reduce((n, j) => n + enCentiemes(Number(j.heuresNuit)), 0) / 100,
        annuleLe: f.annuleLe,
        motifAnnulation: f.motifAnnulation,
        creePar: f.creePar,
      })),
      total,
      tronque: total > feuilles.length,
    };
  }

  /** Ouvrir une feuille · une période sans chevauchement, que couvre au moins un jour de contrat. */
  async creer(tenantId: string, userEmail: string, salarieId: string, dto: FeuilleTempsDto) {
    const refus = motifRefusPeriode(dto.du, dto.au);
    if (refus) throw new BadRequestException(refus);
    const du = jourUtc(dto.du.slice(0, 10))!;
    const au = jourUtc(dto.au.slice(0, 10))!;
    const { contrats } = await this.salarie(tenantId, salarieId);
    if (!joursEntre(du, au).some((j) => sousContrat(jourUtc(j)!, contrats))) {
      throw new BadRequestException("Aucun contrat ne couvre un jour de la période · une feuille de temps se tient sur le service du salarié.");
    }
    return transactionJournalisee(this.prisma, async (tx) => {
      // DEUX FEUILLES NE SE CHEVAUCHENT PAS · le verrou du salarié tient ce
      // qu'une lecture préalable ne tient pas entre deux créations simultanées,
      // qui liraient toutes deux une période libre.
      await tx.$queryRaw`SELECT id FROM "salaries" WHERE id = ${salarieId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const chevauche = await tx.feuilleTemps.findFirst({
        where: { tenantId, salarieId, annuleLe: null, du: { lte: au }, au: { gte: du } },
        select: { du: true, au: true },
      });
      if (chevauche) {
        throw new ConflictException(`La période chevauche la feuille du ${iso(chevauche.du)} au ${iso(chevauche.au)} · un jour ne se saisit que sur une feuille.`);
      }
      return tx.feuilleTemps.create({
        data: { tenantId, salarieId, du, au, observation: dto.observation?.trim() || null, creePar: userEmail },
        select: { id: true },
      });
    });
  }

  /** Une feuille et ses jours, chaque jour dit (nature, contrat, absence, congé, bulletin émis). */
  async detail(tenantId: string, feuilleId: string) {
    const f = await this.prisma.feuilleTemps.findFirst({
      where: { id: feuilleId, tenantId },
      include: {
        jours: {
          orderBy: { jour: 'asc' },
          take: 31,
          include: { heuresCompteurs: { select: { compteurId: true, heures: true }, take: COMPTEURS_DU_DOSSIER_AU_PLUS } },
        },
      },
    });
    if (!f) throw new NotFoundException('Feuille de temps introuvable dans ce dossier.');
    const { contrats } = await this.salarie(tenantId, f.salarieId);
    const occupations = await this.occupations(this.prisma, tenantId, f.salarieId, f.du, f.au);
    const fin = finDeService(contrats);
    const verrous = await this.bulletinsEmisDesJours(this.prisma, tenantId, f.salarieId, joursEntre(f.du, f.au), fin);
    const parJour = new Map(f.jours.map((j) => [iso(j.jour), j]));
    return {
      id: f.id,
      salarieId: f.salarieId,
      du: iso(f.du),
      au: iso(f.au),
      observation: f.observation,
      annuleLe: f.annuleLe,
      motifAnnulation: f.motifAnnulation,
      jours: joursEntre(f.du, f.au).map((j) => {
        const d = jourUtc(j)!;
        const lu = parJour.get(j);
        return {
          jour: j,
          nature: natureDuJour(d),
          samedi: d.getUTCDay() === 6,
          sousContrat: sousContrat(d, contrats),
          occupation: occupations.get(j) ?? null,
          bulletinEmis: verrous.get(j) ?? null,
          moisDePaiement: moisDePaiementDeLaSemaine(lundiDe(d), fin),
          heures: lu ? Number(lu.heures) : 0,
          heuresNuit: lu ? Number(lu.heuresNuit) : 0,
          compteurs: (lu?.heuresCompteurs ?? []).map((c) => ({ compteurId: c.compteurId, heures: Number(c.heures) })),
        };
      }),
    };
  }

  /**
   * SAISIR LES HEURES DES JOURS · ce qui change est écrit, par identifiant,
   * jamais supprimé ; ce qui ne change pas n'est pas réécrit (le journal
   * d'audit ne dit que les vrais gestes). Tout se vérifie avant la première
   * écriture, sous le verrou de la feuille.
   */
  async enregistrerJours(tenantId: string, userEmail: string, feuilleId: string, dto: JoursFeuilleTempsDto) {
    const vus = new Set<string>();
    for (const j of dto.jours) {
      if (vus.has(j.jour)) throw new BadRequestException(`Le ${j.jour} figure deux fois dans la saisie.`);
      vus.add(j.jour);
      const refus = motifRefusHeuresDuJour({ jour: j.jour, heures: j.heures, heuresNuit: j.heuresNuit ?? 0 });
      if (refus) throw new BadRequestException(refus);
      const comptes = new Set<string>();
      for (const c of j.compteurs ?? []) {
        if (comptes.has(c.compteurId)) throw new BadRequestException(`${j.jour} · un même compteur figure deux fois.`);
        comptes.add(c.compteurId);
        if (Math.abs(enCentiemes(c.heures) - c.heures * 100) > 1e-6) throw new BadRequestException(`${j.jour} · les heures d'un compteur se saisissent au centième d'heure.`);
      }
    }
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "feuilles_temps" WHERE id = ${feuilleId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const f = await tx.feuilleTemps.findFirst({
        where: { id: feuilleId, tenantId },
        include: {
          jours: { take: 31, include: { heuresCompteurs: { select: { id: true, compteurId: true, heures: true }, take: COMPTEURS_DU_DOSSIER_AU_PLUS } } },
        },
      });
      if (!f) throw new NotFoundException('Feuille de temps introuvable dans ce dossier.');
      if (f.annuleLe) throw new BadRequestException('Cette feuille est annulée · ouvrez-en une nouvelle pour la période.');
      const { contrats } = await this.salarie(tenantId, f.salarieId, tx);
      const fin = finDeService(contrats);
      const occupations = await this.occupations(tx, tenantId, f.salarieId, f.du, f.au);
      const verrous = await this.bulletinsEmisDesJours(tx, tenantId, f.salarieId, dto.jours.map((j) => j.jour), fin);
      const compteurIds = [...new Set(dto.jours.flatMap((j) => (j.compteurs ?? []).map((c) => c.compteurId)))];
      const compteurs = compteurIds.length
        ? await tx.compteurHeures.findMany({ where: { tenantId, id: { in: compteurIds } }, select: { id: true, code: true, actif: true } })
        : [];
      const existants = new Map(f.jours.map((j) => [iso(j.jour), j]));

      // TOUT SE VÉRIFIE AVANT LA PREMIÈRE ÉCRITURE.
      const ecritures: Array<() => Promise<unknown>> = [];
      for (const j of dto.jours) {
        const d = jourUtc(j.jour);
        if (!d || d.getTime() < f.du.getTime() || d.getTime() > f.au.getTime()) {
          throw new BadRequestException(`Le ${j.jour} est hors de la feuille du ${iso(f.du)} au ${iso(f.au)}.`);
        }
        const nuit = j.heuresNuit ?? 0;
        const avant = existants.get(j.jour);
        const heuresChangent =
          enCentiemes(avant ? Number(avant.heures) : 0) !== enCentiemes(j.heures) || enCentiemes(avant ? Number(avant.heuresNuit) : 0) !== enCentiemes(nuit);
        if (heuresChangent && j.heures > 0) {
          if (!sousContrat(d, contrats)) throw new BadRequestException(`Le ${j.jour} n'est couvert par aucun contrat · aucune heure ne s'y saisit.`);
          const occ = occupations.get(j.jour);
          if (occ) {
            throw new BadRequestException(
              `Le ${j.jour} porte ${occ} · un jour n'a qu'une cause, l'absence ou le congé s'annule d'abord si le salarié a travaillé.`,
            );
          }
        }
        // LE BULLETIN ÉMIS GARDE SES HEURES · la semaine de ce jour se paie à
        // un mois dont le bulletin est émis (art. 103 · décompte remis,
        // indélébile, arrêté du 8 août 2008, art. 4) ; changer la feuille
        // derrière lui ferait dire au registre autre chose que la paie.
        const verrou = verrous.get(j.jour);
        if (heuresChangent && verrou) {
          throw new BadRequestException(
            `Le ${j.jour} se paie au bulletin n° ${verrou.numero} de ${verrou.mois}, déjà émis · annulez le bulletin pour corriger la feuille, puis réémettez-le.`,
          );
        }
        for (const c of j.compteurs ?? []) {
          const lu = compteurs.find((x) => x.id === c.compteurId);
          if (!lu) throw new BadRequestException('Compteur introuvable dans ce dossier.');
          const deja = avant?.heuresCompteurs.find((x) => x.compteurId === c.compteurId);
          const change = enCentiemes(deja ? Number(deja.heures) : 0) !== enCentiemes(c.heures);
          if (change && !lu.actif && c.heures > 0) throw new BadRequestException(`Le compteur ${lu.code} est désactivé · il ne reçoit plus d'heures.`);
        }

        let jourId = avant?.id ?? null;
        if (heuresChangent || (!avant && (j.compteurs ?? []).some((c) => c.heures > 0))) {
          if (avant) {
            ecritures.push(() =>
              tx.jourFeuilleTemps.update({
                where: { id: avant.id },
                data: { heures: new Prisma.Decimal(j.heures), heuresNuit: new Prisma.Decimal(nuit), modifiePar: userEmail, modifieLe: new Date() },
              }),
            );
          } else {
            ecritures.push(async () => {
              const cree = await tx.jourFeuilleTemps.create({
                data: { tenantId, feuilleId: f.id, jour: d, heures: new Prisma.Decimal(j.heures), heuresNuit: new Prisma.Decimal(nuit), modifiePar: userEmail },
                select: { id: true },
              });
              jourId = cree.id;
            });
          }
        }
        for (const c of j.compteurs ?? []) {
          const deja = avant?.heuresCompteurs.find((x) => x.compteurId === c.compteurId);
          if (deja) {
            if (enCentiemes(Number(deja.heures)) !== enCentiemes(c.heures)) {
              ecritures.push(() => tx.heuresCompteurJour.update({ where: { id: deja.id }, data: { heures: new Prisma.Decimal(c.heures) } }));
            }
          } else if (c.heures > 0) {
            ecritures.push(() =>
              tx.heuresCompteurJour.create({ data: { tenantId, jourId: jourId!, compteurId: c.compteurId, heures: new Prisma.Decimal(c.heures) } }),
            );
          }
        }
      }
      for (const e of ecritures) await e();
      return { enregistre: true, gestes: ecritures.length };
    });
  }

  /** Annuler une feuille · jamais supprimée, marquée avec son motif (journal d'audit). */
  async annuler(tenantId: string, userEmail: string, id: string, motif: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "feuilles_temps" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const f = await tx.feuilleTemps.findFirst({
        where: { id, tenantId },
        include: { jours: { where: { heures: { gt: 0 } }, select: { jour: true }, take: 31 } },
      });
      if (!f) throw new NotFoundException('Feuille de temps introuvable dans ce dossier.');
      if (f.annuleLe) throw new BadRequestException('Cette feuille est déjà annulée.');
      const { contrats } = await this.salarie(tenantId, f.salarieId, tx);
      const verrous = await this.bulletinsEmisDesJours(tx, tenantId, f.salarieId, f.jours.map((j) => iso(j.jour)), finDeService(contrats));
      const premier = [...verrous.values()][0];
      if (premier) {
        throw new BadRequestException(
          `Des heures de la feuille se paient au bulletin n° ${premier.numero} de ${premier.mois}, déjà émis · annulez le bulletin d'abord.`,
        );
      }
      await tx.feuilleTemps.update({ where: { id: f.id }, data: { annuleLe: new Date(), annulePar: userEmail, motifAnnulation: motif.trim() } });
      return { annule: true };
    });
  }

  /**
   * LES HEURES D'UN MOIS DE PAIE ET LA PROPOSITION DU BULLETIN · servies à
   * l'onglet Simulation. Proposées, jamais substituées · la majoration, le
   * taux horaire et les heures se reprennent au clic, se corrigent, se
   * retirent.
   */
  async duMois(tenantId: string, salarieId: string, mois: string) {
    if (!moisValide(mois)) throw new BadRequestException('Le mois de paie se lit AAAA-MM.');
    const { contrats } = await this.salarie(tenantId, salarieId);
    const fin = finDeService(contrats);
    const bornes = bornesDeLecture(mois, fin);
    const [a, m] = mois.split('-').map(Number);
    const premierDuMois = new Date(Date.UTC(a, m - 1, 1));
    const dernierDuMois = new Date(Date.UTC(a, m, 0));

    const semaines = [];
    if (bornes) {
      const feuilles = await this.prisma.feuilleTemps.findMany({
        where: { tenantId, salarieId, annuleLe: null, du: { lte: bornes.au }, au: { gte: bornes.du } },
        select: { id: true, du: true, au: true },
        take: PLAFOND_FEUILLES_DU_MOIS,
      });
      const jours = feuilles.length
        ? await this.prisma.jourFeuilleTemps.findMany({
            where: { tenantId, feuilleId: { in: feuilles.map((f) => f.id) }, jour: { gte: bornes.du, lte: bornes.au } },
            select: { jour: true, heures: true, heuresNuit: true },
            take: PLAFOND_JOURS_DU_MOIS,
          })
        : [];
      const saisis = new Map(jours.map((j) => [iso(j.jour), { heures: Number(j.heures), heuresNuit: Number(j.heuresNuit) }]));
      for (const lundi of semainesPayeesAuMois(mois, fin)) {
        const lus: Record<string, JourConnu> = {};
        for (let k = 0; k < 7; k += 1) {
          const d = plusJours(lundi, k);
          const j = iso(d);
          // Hors contrat · connu, à zéro (aucune heure n'y est admise) ; le
          // tableau n'en porte pas la clé.
          if (!sousContrat(d, contrats)) continue;
          const couvert = feuilles.some((f) => f.du.getTime() <= d.getTime() && f.au.getTime() >= d.getTime());
          lus[j] = couvert ? (saisis.get(j) ?? { heures: 0, heuresNuit: 0 }) : null;
        }
        semaines.push(compterLaSemaine({ lundi: iso(lundi), dimanche: iso(plusJours(lundi, 6)), jours: lus }));
      }
    }
    const { totaux, lignes } = heuresAProposer(semaines);

    // LA MAJORATION SE PRÉSÉLECTIONNE QUAND ELLE EST SEULE · active, en
    // vigueur au dernier jour du mois, de la nature des heures. Plusieurs, le
    // cabinet choisit ; aucune, il la déclare d'abord (onglet Barèmes).
    const majorations = await this.prisma.majorationHeures.findMany({
      where: { tenantId, actif: true, dateEffet: { lte: dernierDuMois } },
      select: { id: true, nature: true, libelle: true },
      take: 200,
    });
    const candidates = (nature: NatureMajorationHeures) => majorations.filter((x) => x.nature === nature);

    const [compteurs, cumuls, bulletin] = await Promise.all([
      this.prisma.compteurHeures.findMany({ where: { tenantId }, select: { id: true, code: true, libelle: true, actif: true }, take: COMPTEURS_DU_DOSSIER_AU_PLUS }),
      this.prisma.heuresCompteurJour.groupBy({
        by: ['compteurId'],
        where: { tenantId, jour: { jour: { gte: premierDuMois, lte: dernierDuMois }, feuille: { salarieId, annuleLe: null } } },
        _sum: { heures: true },
      }),
      this.prisma.bulletinPaie.findFirst({
        where: { tenantId, salarieId, moisDePaie: mois, statut: StatutBulletinPaie.EMIS },
        select: { numero: true },
      }),
    ]);

    return {
      mois,
      finDeService: fin ? iso(fin) : null,
      semaines,
      totaux,
      lignes: lignes.map((l) => {
        const c = candidates(l.nature);
        return { ...l, majorationId: c.length === 1 ? c[0].id : null, majorations: c.length };
      }),
      // Les compteurs libres du MOIS CIVIL · sans effet sur la paie.
      compteurs: cumuls
        .map((x) => {
          const c = compteurs.find((y) => y.id === x.compteurId);
          return { compteurId: x.compteurId, code: c?.code ?? '', libelle: c?.libelle ?? '', heures: Number(x._sum.heures ?? 0) };
        })
        .filter((x) => x.heures > 0)
        .sort((x, y) => x.code.localeCompare(y.code)),
      bulletinEmis: bulletin ? { numero: bulletin.numero } : null,
    };
  }

  // ---------------------------------------------------------------------

  /** Ce qui occupe un jour · une absence ou un congé non annulés (« un jour n'a qu'une cause »). */
  private async occupations(db: Db, tenantId: string, salarieId: string, du: Date, au: Date): Promise<Map<string, string>> {
    const [absences, conges] = await Promise.all([
      db.absenceSalarie.findMany({
        where: { tenantId, salarieId, annuleLe: null, du: { lte: au }, au: { gte: du } },
        select: { du: true, au: true, demiJourneeDebut: true, demiJourneeFin: true },
        take: PLAFOND_ABSENCES,
      }),
      db.congeSalarie.findMany({
        where: { tenantId, salarieId, annuleLe: null, du: { lte: au }, au: { gte: du } },
        select: { du: true, au: true },
        take: PLAFOND_ABSENCES,
      }),
    ]);
    const sortie = new Map<string, string>();
    for (const a of absences) {
      for (const j of joursEntre(a.du, a.au)) {
        // Une demi-journée au premier ou au dernier jour laisse l'autre moitié
        // travaillée · le jour reste saisissable.
        if ((j === iso(a.du) && a.demiJourneeDebut) || (j === iso(a.au) && a.demiJourneeFin)) continue;
        sortie.set(j, `une absence déclarée du ${iso(a.du)} au ${iso(a.au)}`);
      }
    }
    for (const c of conges) for (const j of joursEntre(c.du, c.au)) sortie.set(j, `un congé du ${iso(c.du)} au ${iso(c.au)}`);
    return sortie;
  }

  /** Les jours dont la semaine se paie à un mois au bulletin déjà émis. */
  private async bulletinsEmisDesJours(
    db: Db,
    tenantId: string,
    salarieId: string,
    jours: readonly string[],
    fin: Date | null,
  ): Promise<Map<string, { numero: number; mois: string }>> {
    const moisDe = new Map(jours.map((j) => [j, moisDePaiementDeLaSemaine(lundiDe(jourUtc(j)!), fin)]));
    const moisLus = [...new Set(moisDe.values())];
    if (moisLus.length === 0) return new Map();
    const bulletins = await db.bulletinPaie.findMany({
      where: { tenantId, salarieId, statut: StatutBulletinPaie.EMIS, moisDePaie: { in: moisLus } },
      select: { numero: true, moisDePaie: true },
      take: 50,
    });
    const sortie = new Map<string, { numero: number; mois: string }>();
    for (const [j, mois] of moisDe) {
      const b = bulletins.find((x) => x.moisDePaie === mois);
      if (b) sortie.set(j, { numero: b.numero, mois });
    }
    return sortie;
  }

  private async salarie(tenantId: string, salarieId: string, db: Db = this.prisma): Promise<{ id: string; contrats: ContratLu[] }> {
    const s = await db.salarie.findFirst({
      where: { id: salarieId, tenantId },
      select: { id: true, contrats: { select: { dateEntreeEnVigueur: true, dateFin: true }, take: PLAFOND_CONTRATS } },
    });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    return s;
  }
}
