import { Injectable, NotFoundException } from '@nestjs/common';
import { LOT_ECRITURES, lireParLots, pageApres } from '../../common/lecture-par-lots';
import { NumerotationPiece, StatutEcriture, StatutExercice, TypeCompteDetailTotal } from '@prisma/client';
import { ClotureActive } from '../exercice/gel-cloture';
import { grilleJournauxSaisie, moisDeLExercice } from './etat-journaux-saisie';
import { journauxDeLaSequenceDuFichier } from './numerotation-piece';
import { PrismaService } from '../../common/prisma.service';
import {
  EXPLICATION_PERIMETRE,
  compterManquants,
  perimetreDeLaSequence,
  trousDeLaSequence,
  trousHorsNumerosRattaches,
} from './sequence-pieces';

/**
 * DEUX ÉTATS DE RELECTURE D'EXERCICE · palmarès des comptes, analyse des
 * journaux.
 *
 * Ils viennent du catalogue Sage, qui les NOMME et rien de plus · ni colonnes,
 * ni tri, ni périmètre. Leur définition est donc celle d'OmegaX, et l'écran le
 * dit : leur attribuer une maquette Sage que la source ne porte pas serait la
 * même faute que la « découpe par cycle » jadis prêtée au CPCC. Aucun texte
 * comptable ne les régit non plus · ce ne sont pas des états financiers, ils ne
 * se déposent nulle part, ils servent à relire un exercice.
 *
 * Chaque colonne est donc tirée de ce que le logiciel calcule déjà, et chaque
 * choix de lecture est écrit sur place.
 */

export interface LignePalmares {
  compteId: string;
  numero: string;
  intitule: string;
  classe: string;
  /** Débit + crédit des mouvements de la période, report à-nouveau EXCLU. */
  mouvement: number;
  debit: number;
  credit: number;
  solde: number;
  nombreLignes: number;
  /** Part du mouvement total du périmètre, en pourcentage. */
  part: number;
  /** Part cumulée depuis le premier du classement · la lecture de Pareto. */
  partCumulee: number;
}

export interface LigneAnalyseJournal {
  journalId: string;
  code: string;
  intitule: string;
  type: string;
  numerotation: NumerotationPiece;
  nombreEcritures: number;
  nombreLignes: number;
  debit: number;
  credit: number;
  /** Écritures encore au brouillard · c'est là que le travail n'est pas fini. */
  enBrouillard: number;
  /** Écritures posées par la clôture · personne ne les a saisies. */
  deCloture: number;
  premiereDate: string | null;
  derniereDate: string | null;
  sequence: {
    perimetre: string;
    explication: string;
    /** `null` quand le périmètre est AUCUN ou DOSSIER_EXERCICE · voir l'explication. */
    manquants: number | null;
    trous: Array<{ de: number; a: number }>;
    /**
     * Numéros absents de la séquence parce qu'ils sont dans l'exercice JUMEAU
     * de l'arrêt à la dissolution (exercice arrêté et exercice de liquidation)
     * · nommés, jamais comptés comme manquants.
     */
    rattachesALArret?: { nombre: number; explication: string };
  };
}

@Injectable()
export class AnalyseJournauxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PALMARÈS DES COMPTES · quels comptes pèsent le plus sur l'exercice.
   *
   * TROIS DÉCISIONS DE LECTURE, ET CHACUNE CHANGE LE CLASSEMENT.
   *
   * 1. LA MESURE EST LE MOUVEMENT, PAS LE SOLDE. Un compte de trésorerie qui a
   *    encaissé et décaissé quatre cents fois finit souvent près de zéro : classé
   *    au solde, il disparaît du palmarès, alors que c'est exactement le compte
   *    qu'un réviseur veut voir. Le solde reste affiché, il ne classe pas.
   * 2. LE REPORT À-NOUVEAU EST EXCLU. Il n'est pas une activité de l'exercice ·
   *    l'inclure ferait remonter en tête les comptes de bilan les plus lourds
   *    du dossier, année après année, indépendamment de ce qui s'y est passé.
   * 3. LES CLASSES SONT MÊLÉES, ET C'EST DIT. Un 52 et un 60 ne se comparent
   *    pas vraiment · la colonne CLASSE est donc toujours affichée, et le
   *    périmètre se restreint à une classe quand on le demande. Ranger en
   *    silence un stock et un flux dans le même classement serait une
   *    comparaison que rien ne fonde.
   *
   * LA PART CUMULÉE EST LE VRAI OUTIL. Elle répond à « combien de comptes
   * portent 80 % du mouvement » · c'est par eux que commence une revue, et
   * c'est la seule chose qu'un classement brut ne donne pas.
   */
  async palmaresComptes(
    tenantId: string,
    params: { exerciceId: string; classe?: string; limite?: number; inclureBrouillard?: boolean },
  ): Promise<{ lignes: LignePalmares[]; total: { mouvement: number; comptes: number }; tronque: boolean }> {
    const limite = Math.min(Math.max(params.limite ?? 25, 1), 200);

    const [comptes, groupes] = await Promise.all([
      this.prisma.compte.findMany({
        where: {
          tenantId,
          typeCompte: { not: TypeCompteDetailTotal.TOTAL },
          ...(params.classe ? { numero: { startsWith: params.classe } } : {}),
        },
        select: { id: true, numero: true, intitule: true, classe: true },
      }),
      this.prisma.ligneEcriture.groupBy({
        by: ['compteId'],
        where: {
          ecriture: {
            tenantId,
            exerciceId: params.exerciceId,
            // Le report à-nouveau n'est pas une activité de l'exercice (règle 2).
            estGenereeParCloture: false,
            ...(params.inclureBrouillard ? {} : { statut: StatutEcriture.VALIDEE }),
          },
        },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      }),
    ]);

    const parCompte = new Map(comptes.map((c) => [c.id, c]));
    const brutes = groupes
      .filter((g) => parCompte.has(g.compteId))
      .map((g) => {
        const c = parCompte.get(g.compteId)!;
        const debit = Number(g._sum.debit ?? 0);
        const credit = Number(g._sum.credit ?? 0);
        return {
          compteId: c.id,
          numero: c.numero,
          intitule: c.intitule,
          classe: String(c.classe),
          mouvement: debit + credit,
          debit,
          credit,
          solde: debit - credit,
          nombreLignes: g._count._all,
        };
      })
      .filter((l) => l.mouvement > 0.005)
      .sort((a, b) => b.mouvement - a.mouvement || a.numero.localeCompare(b.numero));

    // Le total porte sur le PÉRIMÈTRE ENTIER, pas sur la tranche affichée ·
    // sinon la part cumulée atteindrait 100 % au dernier rang montré et
    // laisserait croire que le palmarès couvre tout le dossier.
    const mouvementTotal = brutes.reduce((t, l) => t + l.mouvement, 0);

    let cumul = 0;
    const lignes = brutes.slice(0, limite).map((l) => {
      const part = mouvementTotal > 0.005 ? (l.mouvement / mouvementTotal) * 100 : 0;
      cumul += part;
      return { ...l, part, partCumulee: cumul };
    });

    return {
      lignes,
      total: { mouvement: mouvementTotal, comptes: brutes.length },
      tronque: brutes.length > lignes.length,
    };
  }

  /**
   * ANALYSE DES JOURNAUX · ce que chaque journal porte, et ce qui manque à sa
   * séquence.
   *
   * LE VOLUME SEUL N'APPREND RIEN. « Le journal des achats porte 1 200 pièces »
   * ne se compare à rien et ne décide de rien. Ce que cet état ajoute est ce
   * qu'un réviseur cherche vraiment :
   *
   *  · CE QUI RESTE AU BROUILLARD, journal par journal · c'est là que le
   *    travail n'est pas fini, et l'AUDCIF art. 22, 2° veut la validation faite
   *    « au terme de chaque période qui ne peut excéder un mois » ;
   *  · CE QUE LA CLÔTURE A POSÉ, séparé de la saisie · personne n'a saisi un
   *    report à-nouveau, et le mêler au travail du comptable fausse toute
   *    lecture de volume ;
   *  · LES TROUS DE LA SÉQUENCE DES NUMÉROS DE PIÈCE, sur le périmètre que le
   *    MODE de numérotation du journal impose (voir `sequence-pieces.ts`) ·
   *    c'est le seul contrôle d'intégrité de cet état, et le seul endroit où il
   *    pouvait fabriquer des anomalies.
   *
   * AUCUN CONTRÔLE D'ÉQUILIBRE PAR JOURNAL n'est rendu, et l'absence est
   * délibérée : chaque écriture est équilibrée et appartient à un seul journal,
   * donc débit = crédit y est vrai PAR CONSTRUCTION. Une colonne toujours verte
   * n'apprend rien et apprend surtout à ne plus lire les colonnes.
   */
  async analyseJournaux(
    tenantId: string,
    params: { exerciceId: string },
  ): Promise<{
    lignes: LigneAnalyseJournal[];
    sequenceDuDossier: {
      applicable: boolean;
      explication: string;
      manquants: number;
      trous: Array<{ de: number; a: number }>;
      rattachesALArret?: { nombre: number; explication: string };
    };
  }> {
    const journaux = await this.prisma.journal.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });

    // PAR TRANCHES (audit final F185) · toutes les écritures de l'exercice,
    // avec leurs lignes, passaient d'un bloc en mémoire. Chaque journal ne
    // garde plus que ses cumuls et ses numéros de pièce, seule matière de la
    // séquence.
    type Cumul = {
      nombre: number;
      lignes: number;
      debit: number;
      credit: number;
      enBrouillard: number;
      deCloture: number;
      premiere: Date | null;
      derniere: Date | null;
      numeros: number[];
      numerosParMois: Map<string, number[]>;
    };
    const parJournal = new Map<string, Cumul>();
    await lireParLots(
      (curseur) =>
        this.prisma.ecriture.findMany({
          where: { tenantId, exerciceId: params.exerciceId },
          select: {
            id: true,
            journalId: true,
            date: true,
            numeroPiece: true,
            statut: true,
            estGenereeParCloture: true,
            lignes: { select: { debit: true, credit: true } },
          },
          ...pageApres(curseur, LOT_ECRITURES),
        }),
      (e) => {
        let c = parJournal.get(e.journalId);
        if (!c) {
          c = {
            nombre: 0,
            lignes: 0,
            debit: 0,
            credit: 0,
            enBrouillard: 0,
            deCloture: 0,
            premiere: null,
            derniere: null,
            numeros: [],
            numerosParMois: new Map(),
          };
          parJournal.set(e.journalId, c);
        }
        c.nombre++;
        c.lignes += e.lignes.length;
        for (const l of e.lignes) {
          c.debit += Number(l.debit);
          c.credit += Number(l.credit);
        }
        if (e.statut !== StatutEcriture.VALIDEE) c.enBrouillard++;
        if (e.estGenereeParCloture) c.deCloture++;
        if (!c.premiere || e.date < c.premiere) c.premiere = e.date;
        if (!c.derniere || e.date > c.derniere) c.derniere = e.date;
        if (e.numeroPiece !== null) {
          c.numeros.push(e.numeroPiece);
          const cle = `${e.date.getUTCFullYear()}-${e.date.getUTCMonth()}`;
          const duMois = c.numerosParMois.get(cle) ?? [];
          duMois.push(e.numeroPiece);
          c.numerosParMois.set(cle, duMois);
        }
      },
      LOT_ECRITURES,
    );

    // L'EXERCICE JUMEAU DE L'ARRÊT À LA DISSOLUTION (quatrième lot, point 1) ·
    // l'exercice arrêté et l'exercice de liquidation se partagent une séquence,
    // les écritures datées après la dissolution ayant suivi leur date avec
    // leur numéro. Ses numéros, journal par journal et mois par mois, sont lus
    // pour nommer ceux qui manquent ici.
    const jumeau = await this.exerciceJumeauDeLArret(tenantId, params.exerciceId);
    const ailleurs = new Map<string, { numeros: Set<number>; parMois: Map<string, Set<number>> }>();
    if (jumeau) {
      await lireParLots(
        (curseur) =>
          this.prisma.ecriture.findMany({
            where: { tenantId, exerciceId: jumeau.id, numeroPiece: { not: null } },
            select: { id: true, journalId: true, date: true, numeroPiece: true },
            ...pageApres(curseur, LOT_ECRITURES),
          }),
        (e) => {
          const a = ailleurs.get(e.journalId) ?? { numeros: new Set<number>(), parMois: new Map<string, Set<number>>() };
          a.numeros.add(e.numeroPiece!);
          const cle = `${e.date.getUTCFullYear()}-${e.date.getUTCMonth()}`;
          const m = a.parMois.get(cle) ?? new Set<number>();
          m.add(e.numeroPiece!);
          a.parMois.set(cle, m);
          ailleurs.set(e.journalId, a);
        },
        LOT_ECRITURES,
      );
    }
    const explicationArret = jumeau
      ? `Numéros portés par l'exercice ${jumeau.role === 'LIQUIDATION' ? 'de liquidation' : 'arrêté à la dissolution'} du ${jumeau.dateDebut.toISOString().slice(0, 10)} au ${jumeau.dateFin.toISOString().slice(0, 10)} · les écritures datées après la dissolution y ont suivi leur date avec leur numéro (AUDCIF art. 22 et 59 ; décision par la loi du 2026-10-07, quatrième lot, point 1). Ce ne sont pas des pièces supprimées.`
      : '';

    const lignes: LigneAnalyseJournal[] = journaux.map((j) => {
      const c = parJournal.get(j.id);
      const perimetre = perimetreDeLaSequence(j.numerotation);
      let rattaches = 0;

      // La séquence n'est cherchée QUE sur le périmètre où elle est continue.
      // Sur DOSSIER_EXERCICE elle se lit tous journaux confondus, plus bas ;
      // sur AUCUN il n'y a rien à lire.
      let trous: Array<{ de: number; a: number }> = [];
      let manquants: number | null = null;
      if (perimetre === 'JOURNAL_EXERCICE') {
        const lus = trousHorsNumerosRattaches(trousDeLaSequence(c?.numeros ?? []), ailleurs.get(j.id)?.numeros ?? []);
        trous = lus.trous;
        rattaches = lus.rattaches;
        manquants = compterManquants(trous);
      } else if (perimetre === 'JOURNAL_MOIS') {
        // Mois par mois, et jamais sur l'exercice · la séquence repart de 1 à
        // chaque mois civil, si bien que les numéros d'un mois BOUCHERAIENT les
        // manques d'un autre. Lue à l'année, elle ne crie pas à tort · elle se
        // tait à tort, et c'est le sens d'erreur qu'aucun écran ne rattrape.
        for (const [mois, numeros] of (c?.numerosParMois ?? new Map<string, number[]>()).entries()) {
          const lus = trousHorsNumerosRattaches(trousDeLaSequence(numeros), ailleurs.get(j.id)?.parMois.get(mois) ?? []);
          trous.push(...lus.trous);
          rattaches += lus.rattaches;
        }
        manquants = compterManquants(trous);
      }

      const jour = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

      return {
        journalId: j.id,
        code: j.code,
        intitule: j.intitule,
        type: String(j.type),
        numerotation: j.numerotation,
        nombreEcritures: c?.nombre ?? 0,
        nombreLignes: c?.lignes ?? 0,
        debit: c?.debit ?? 0,
        credit: c?.credit ?? 0,
        enBrouillard: c?.enBrouillard ?? 0,
        deCloture: c?.deCloture ?? 0,
        premiereDate: jour(c?.premiere),
        derniereDate: jour(c?.derniere),
        sequence: {
          perimetre,
          explication: EXPLICATION_PERIMETRE[perimetre],
          manquants,
          trous,
          ...(rattaches > 0 ? { rattachesALArret: { nombre: rattaches, explication: explicationArret } } : {}),
        },
      };
    });

    // LA SÉQUENCE DU DOSSIER · elle n'existe que si au moins un journal est en
    // numérotation CONTINUE_FICHIER, et elle porte alors sur les écritures de
    // CES journaux seulement · y mêler celles d'un journal à numérotation
    // mensuelle ferait entrer des numéros repartis de 1 et rendrait la
    // séquence du dossier illisible.
    const journauxFichier = journauxDeLaSequenceDuFichier(journaux);
    const numerosDossier = journauxFichier.flatMap((j) => parJournal.get(j.id)?.numeros ?? []);
    const lusDossier = trousHorsNumerosRattaches(
      journauxFichier.length > 0 ? trousDeLaSequence(numerosDossier) : [],
      journauxFichier.flatMap((j) => [...(ailleurs.get(j.id)?.numeros ?? [])]),
    );
    const trousDossier = lusDossier.trous;

    return {
      lignes,
      sequenceDuDossier: {
        applicable: journauxFichier.length > 0,
        explication:
          journauxFichier.length > 0
            ? `Numérotation continue sur le fichier pour ${journauxFichier.map((j) => j.code).join(', ')} : la séquence court sur ces journaux ensemble, et c'est le seul niveau où ses trous ont un sens.`
            : "Aucun journal de ce dossier n'est en numérotation continue sur le fichier : il n'y a pas de séquence au niveau du dossier.",
        manquants: compterManquants(trousDossier),
        trous: trousDossier,
        ...(lusDossier.rattaches > 0 ? { rattachesALArret: { nombre: lusDossier.rattaches, explication: explicationArret } } : {}),
      },
    };
  }

  /**
   * L'exercice jumeau de l'arrêt à la dissolution, ou `null` · pour l'exercice
   * arrêté (fin à la dissolution), celui de liquidation (début au lendemain),
   * et réciproquement.
   */
  private async exerciceJumeauDeLArret(tenantId: string, exerciceId: string) {
    const [exercice, dossier] = await Promise.all([
      this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { dateDebut: true, dateFin: true } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { dateDissolution: true } }),
    ]);
    const d = dossier?.dateDissolution ?? null;
    if (!exercice || !d) return null;
    const lendemain = new Date(d.getTime() + 86_400_000);
    if (exercice.dateFin.getTime() === d.getTime()) {
      const l = await this.prisma.exercice.findFirst({ where: { tenantId, dateDebut: lendemain }, select: { id: true, dateDebut: true, dateFin: true } });
      return l ? { ...l, role: 'LIQUIDATION' as const } : null;
    }
    if (exercice.dateDebut.getTime() === lendemain.getTime()) {
      const a = await this.prisma.exercice.findFirst({ where: { tenantId, dateFin: d }, select: { id: true, dateDebut: true, dateFin: true } });
      return a ? { ...a, role: 'ARRETE' as const } : null;
    }
    return null;
  }

  /**
   * FENÊTRE DES JOURNAUX DE SAISIE · la grille journal × mois de Sage, avec
   * l'état de chaque case (`etat-journaux-saisie.ts`). Le comptage passe par
   * un regroupement par jour · jamais une écriture rapatriée une à une, la
   * grille reste bornée par le nombre de journaux et de jours de l'exercice
   * (§ 8 bis).
   */
  async grilleSaisie(tenantId: string, exerciceId: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
    if (!exercice) throw new NotFoundException('Exercice introuvable');
    const [journaux, comptages, clotures] = await Promise.all([
      this.prisma.journal.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, intitule: true, type: true, estActif: true },
      }),
      this.prisma.ecriture.groupBy({
        by: ['journalId', 'date', 'statut', 'estANouveauProvisoire'],
        where: { tenantId, exerciceId },
        _count: { _all: true },
      }),
      this.prisma.cloture.findMany({
        where: { tenantId, annuleeAt: null },
        select: { granularite: true, journalId: true, dateLimite: true },
      }) as Promise<ClotureActive[]>,
    ]);
    const mois = moisDeLExercice(exercice.dateDebut, exercice.dateFin);
    const grille = grilleJournauxSaisie(
      journaux,
      mois,
      comptages.map((c) => ({
        journalId: c.journalId,
        date: c.date,
        statut: c.statut,
        estANouveauProvisoire: c.estANouveauProvisoire,
        nombre: c._count._all,
      })),
      clotures,
      exercice.statut === StatutExercice.CLOTURE,
    );
    return {
      mois: mois.map((m) => m.debut.slice(0, 7)),
      journaux: journaux.map((j, i) => ({ ...j, cases: grille[i].cases })),
    };
  }
}
