import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StatutBulletinPaie } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { PersonnelService } from './personnel.service';
import { AbsencesService } from './absences.service';
import { CongesService } from './conges.service';
import { contratCouvrantLeMois, moisValide, motifsRefusEmission, type SimulationEmissible } from './bulletin-paie';
import { corpsPropose, lireParametresPaie, motifsNonEmissible, type CorpsPropose } from './paie-en-lot';
import type { ParametresPaieDto } from './dto/paie-en-lot.dto';
import type { SimulationPaieDto } from './dto/personnel.dto';

/**
 * LA PAIE DU MOIS EN LOT · une proposition, jamais une émission. La paie
 * d'un mois se PROPOSE pour chaque salarié actif sous contrat, avec le
 * verdict du calcul que l'émission rejouera ; l'émission reste le geste
 * unitaire (`PersonnelService.emettreBulletin`), appelé bulletin par bulletin
 * pour les seuls bulletins cochés · même service, mêmes refus, et un refus
 * n'emporte pas les autres.
 *
 * UNE LECTURE BORNÉE QUI LE DIT (§ 8 bis) · deux cents salariés par lot, le
 * total compté par la base, `tronque` quand le lot en rend moins. Chaque
 * proposition rejoue la simulation, lue l'une après l'autre · en parallèle,
 * deux cents simulations prendraient le pool de connexions de tous les
 * cabinets.
 */
export const PLAFOND_LOT_PAIE = 200;
export const PLAFOND_SOLDES_CONGES = 500;

type ParametresLus = {
  paieNatureEmployeurInpp: string | null;
  paieRegimeSalarial: string | null;
  paieEffectifInpp: number | null;
  paieJoursPayes: number | null;
};

const SELECT_PARAMETRES = {
  paieNatureEmployeurInpp: true,
  paieRegimeSalarial: true,
  paieEffectifInpp: true,
  paieJoursPayes: true,
} as const;

@Injectable()
export class PaieEnLotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personnel: PersonnelService,
    private readonly absences: AbsencesService,
    private readonly conges: CongesService,
  ) {}

  private async parametresLus(tenantId: string): Promise<ParametresLus> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: SELECT_PARAMETRES });
    // Un dossier introuvable n'est pas « rien de déclaré ».
    if (!t) throw new NotFoundException('Dossier introuvable.');
    return t;
  }

  /** Les paramètres de paie déclarés · `null` = pas encore dit. */
  async lireParametres(tenantId: string) {
    return lireParametresPaie(await this.parametresLus(tenantId));
  }

  /**
   * DÉCLARER les paramètres · `undefined` laisse la valeur, `null` l'efface
   * (« pas encore dit »). Une mise à jour UNITAIRE du dossier, que le journal
   * d'audit garde colonne par colonne (`Tenant` est audité).
   */
  async modifierParametres(tenantId: string, dto: ParametresPaieDto) {
    const data: Record<string, string | number | null> = {};
    if (dto.natureEmployeurInpp !== undefined) data.paieNatureEmployeurInpp = dto.natureEmployeurInpp;
    if (dto.regimeSalarial !== undefined) data.paieRegimeSalarial = dto.regimeSalarial;
    if (dto.effectifInpp !== undefined) data.paieEffectifInpp = dto.effectifInpp;
    if (dto.joursPayes !== undefined) data.paieJoursPayes = dto.joursPayes;
    if (Object.keys(data).length === 0) throw new BadRequestException('Aucun paramètre de paie à déclarer.');
    const t = await this.prisma.tenant.update({ where: { id: tenantId }, data, select: SELECT_PARAMETRES });
    return lireParametresPaie(t);
  }

  /** Le corps proposé d'UN salarié pour UN mois · servi à la simulation unitaire comme au lot. */
  async propositionDuSalarie(tenantId: string, salarieId: string, mois: string) {
    if (!moisValide(mois)) throw new BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
    const salarie = await this.prisma.salarie.findFirst({
      where: { id: salarieId, tenantId },
      select: { id: true, contrats: { select: SELECT_CONTRAT } },
    });
    if (!salarie) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const contrat = contratCouvrantLeMois(salarie.contrats, mois);
    if (!contrat) {
      return { corps: { moisDePaie: mois, elements: [] } as CorpsPropose, manques: [`Aucun contrat en cours en ${mois}.`], salaireRepris: false };
    }
    const parametres = lireParametresPaie(await this.parametresLus(tenantId));
    return this.proposer(tenantId, salarieId, mois, contrat, parametres);
  }

  private async proposer(
    tenantId: string,
    salarieId: string,
    mois: string,
    contrat: ContratLu,
    parametres: ReturnType<typeof lireParametresPaie>,
  ) {
    const absences = await this.absences.duMois(tenantId, salarieId, mois);
    const conges = await this.conges.congesDuMois(tenantId, salarieId, mois);
    return corpsPropose({
      moisDePaie: mois,
      parametres,
      contrat: {
        classeProfessionnelle: contrat.classeProfessionnelle,
        deviseRemuneration: contrat.deviseRemuneration,
        periodiciteRemuneration: contrat.periodiciteRemuneration,
        remunerationBase: contrat.remunerationBase === null ? null : Number(contrat.remunerationBase),
      },
      absences: absences.proposition,
      conges: conges.map((c) => ({
        id: c.id,
        devise: c.allocation.devise ?? null,
        montant: c.allocation.montant ?? null,
        portePar: c.portePar,
      })),
    });
  }

  /**
   * LA PROPOSITION DU MOIS · salarié par salarié, le corps proposé, ce qui
   * manque, et le verdict de la simulation. Un salarié qui a déjà un
   * bulletin actif ce mois est DIT et écarté ; un salarié dont la simulation
   * refuse est dit avec son motif, jamais tu.
   */
  async proposerLeMois(tenantId: string, mois: string, maintenant: Date = new Date()) {
    if (!moisValide(mois)) throw new BadRequestException('Mois de paie illisible · la forme attendue est AAAA-MM.');
    const parametres = lireParametresPaie(await this.parametresLus(tenantId));
    const [salaries, totalActifs, actifsDuMois] = await Promise.all([
      this.prisma.salarie.findMany({
        where: { tenantId, actif: true },
        orderBy: [{ nom: 'asc' }, { postNom: 'asc' }, { id: 'asc' }],
        // Un de plus que le plafond · c'est lui qui dit la troncature.
        take: PLAFOND_LOT_PAIE + 1,
        select: {
          id: true,
          nom: true,
          postNom: true,
          prenoms: true,
          matricule: true,
          contrats: { select: SELECT_CONTRAT },
        },
      }),
      this.prisma.salarie.count({ where: { tenantId, actif: true } }),
      // Les bulletins ACTIFS du mois, toutes natures · un décompte final
      // remplace le bulletin du dernier mois (décision du 2026-10-02).
      this.prisma.bulletinPaie.findMany({
        where: { tenantId, moisDePaie: mois, statut: StatutBulletinPaie.EMIS },
        select: { salarieId: true, numero: true, nature: true },
        take: 5000,
      }),
    ]);
    const tronque = salaries.length > PLAFOND_LOT_PAIE;
    const lus = salaries.slice(0, PLAFOND_LOT_PAIE);
    const dejaEmis = new Map(actifsDuMois.map((b) => [b.salarieId, b]));

    const lignes = [];
    let sansContrat = 0;
    for (const s of lus) {
      const contrat = contratCouvrantLeMois(s.contrats, mois);
      if (!contrat) {
        sansContrat++;
        continue;
      }
      const nomComplet = [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
      const base = { salarieId: s.id, nomComplet, matricule: s.matricule };
      const emis = dejaEmis.get(s.id);
      if (emis) {
        lignes.push({
          ...base,
          etat: 'DEJA_EMIS' as const,
          bulletinNumero: emis.numero,
          motif: `Bulletin n° ${emis.numero} déjà émis pour ${mois} · écarté du lot.`,
        });
        continue;
      }
      try {
        const p = await this.proposer(tenantId, s.id, mois, contrat, parametres);
        let simulation: SimulationEmissible & Record<string, unknown>;
        try {
          simulation = (await this.personnel.simulerPaie(tenantId, s.id, p.corps as unknown as SimulationPaieDto, maintenant)) as unknown as SimulationEmissible & Record<string, unknown>;
        } catch (e) {
          lignes.push({ ...base, etat: 'REFUSE' as const, corps: p.corps, manques: p.manques, salaireRepris: p.salaireRepris, motifs: [messageDe(e)] });
          continue;
        }
        const motifs = motifsNonEmissible(p.corps, motifsRefusEmission(simulation));
        lignes.push({
          ...base,
          etat: motifs.length ? ('NON_EMISSIBLE' as const) : ('EMISSIBLE' as const),
          corps: p.corps,
          manques: p.manques,
          salaireRepris: p.salaireRepris,
          motifs,
          verdict: {
            totalVerseFc: simulation.net.totalVerseFc,
            cotisationsTravailleurFc: simulation.cotisations.totalTravailleurFc,
            cotisationsEmployeurFc: simulation.cotisations.totalEmployeurFc,
            irppFc: simulation.retenue === null ? null : simulation.retenue.retenueFc,
            netAPayerFc: simulation.net.netAPayerFc,
            conversion: (simulation.conversion as { cours: number; dateCours: string } | null) ?? null,
          },
          personnesAChargeProposees: (simulation.propositionPersonnesACharge as number | null) ?? null,
          avertissements: (simulation.avertissementsRetenuesPlanifiees as string[] | undefined) ?? [],
        });
      } catch (e) {
        // Une panne d'UN salarié (lecture des absences, des congés) n'emporte
        // pas les autres · elle se dit sur sa ligne.
        lignes.push({ ...base, etat: 'REFUSE' as const, motifs: [messageDe(e)] });
      }
    }
    return {
      mois,
      parametres,
      lignes,
      totalActifs,
      sansContrat,
      tronque,
      plafond: PLAFOND_LOT_PAIE,
    };
  }

  /**
   * L'ÉTAT DES SOLDES DE CONGÉS · le compteur de chaque salarié actif à une
   * date (`CongesService.compteur`, `conges-acquis.ts`), sans rien recalculer
   * ici. Un compteur qui refuse (âge inconnu, reprise incohérente) se dit sur
   * sa ligne ; un solde non chiffré reste `null`, jamais zéro.
   */
  async soldesConges(tenantId: string, aLaBrut?: string) {
    // La date se juge UNE fois, avant toute lecture · un refus de date n'est
    // pas le refus d'un salarié.
    if (aLaBrut !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(aLaBrut) || Number.isNaN(Date.parse(`${aLaBrut}T00:00:00Z`)))) {
      throw new BadRequestException('La date de lecture du compteur se lit AAAA-MM-JJ.');
    }
    const [salaries, total] = await Promise.all([
      this.prisma.salarie.findMany({
        where: { tenantId, actif: true },
        orderBy: [{ nom: 'asc' }, { postNom: 'asc' }, { id: 'asc' }],
        take: PLAFOND_SOLDES_CONGES,
        select: { id: true, nom: true, postNom: true, prenoms: true, matricule: true },
      }),
      this.prisma.salarie.count({ where: { tenantId, actif: true } }),
    ]);
    let aLa: string | null = null;
    const lignes = [];
    for (const s of salaries) {
      const base = { salarieId: s.id, nomComplet: [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' '), matricule: s.matricule };
      try {
        const c = await this.conges.compteur(tenantId, s.id, aLaBrut);
        aLa = c.aLa;
        if ('refus' in c.compteur) {
          lignes.push({ ...base, refus: c.compteur.refus as string, droitsNes: null, pris: null, solde: null, enCours: null, signaux: [] as string[] });
        } else {
          lignes.push({
            ...base,
            refus: null,
            droitsNes: c.compteur.droitsNes,
            pris: c.compteur.pris,
            solde: c.compteur.solde,
            enCours: c.compteur.enCours,
            signaux: [...c.compteur.signaux],
          });
        }
      } catch (e) {
        lignes.push({ ...base, refus: messageDe(e), droitsNes: null, pris: null, solde: null, enCours: null, signaux: [] as string[] });
      }
    }
    return { aLa, lignes, total, tronque: total > salaries.length, plafond: PLAFOND_SOLDES_CONGES };
  }
}

const SELECT_CONTRAT = {
  id: true,
  dateEntreeEnVigueur: true,
  dateFin: true,
  classeProfessionnelle: true,
  deviseRemuneration: true,
  periodiciteRemuneration: true,
  remunerationBase: true,
} as const;

type ContratLu = {
  id: string;
  dateEntreeEnVigueur: Date;
  dateFin: Date | null;
  classeProfessionnelle: number | null;
  deviseRemuneration: string | null;
  periodiciteRemuneration: string | null;
  remunerationBase: { toString(): string } | number | null;
};

/** Le message d'un refus, tel que l'émission unitaire le rendrait · jamais avalé. */
export function messageDe(e: unknown): string {
  if (e instanceof HttpException) {
    const r = e.getResponse();
    if (typeof r === 'string') return r;
    const m = (r as { message?: unknown; motifs?: unknown }).message;
    const motifs = (r as { motifs?: unknown }).motifs;
    const texte = Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : e.message;
    return Array.isArray(motifs) && motifs.length ? `${texte} · ${motifs.join(' · ')}` : texte;
  }
  // Une panne n'est pas un refus · consignée au journal du serveur, dite sur
  // la ligne sans le texte technique (qui peut citer une donnée).
  JOURNAL.error(`Paie en lot · panne sur une ligne · ${e instanceof Error ? e.message : String(e)}`);
  return 'Erreur du serveur à la lecture de ce salarié · ouvrez-le dans la Simulation, ou réessayez.';
}

const JOURNAL = new Logger('PaieEnLot');
