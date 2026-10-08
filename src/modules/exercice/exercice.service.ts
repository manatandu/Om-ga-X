import { ecartsRealisesNonConstates, motifClotureEcartsNonConstates } from '../reglements/ecarts-non-constates';
import { estContigu, motifCreationNonContigue, motifSuivantNonContigu } from './exercice-contigu';
import { depreciationsOrphelines } from '../creances-douteuses/depreciations-orphelines';
import { motifClotureDepreciationsOrphelines } from '../creances-douteuses/creances-douteuses';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS,
  LECTEUR_BILAN_SYCEBNL_PROJETS,
  LECTEUR_BILAN_SYCEBNL_SMT,
  LECTEUR_BILAN_SYSCOHADA_NORMAL,
  LECTEUR_BILAN_SYSCOHADA_SMT,
  LECTEUR_VIREMENTS_GROUPE,
  type LecteurBilan,
  type LecteurVirementsGroupe,
} from '../../common/lecteurs-bilan';
import {
  destinationsDuVirement,
  appliquerVirementAuReport,
  ecartInexpliqueDuBilan,
  montantFr,
  virementResultatNonAffecte,
} from './virement-resultat-non-affecte';
import { PrismaService } from '../../common/prisma.service';
import {
  ClasseCompte,
  FormeJuridiqueSyscohada,
  RegimeLiquidation,
  GranulariteCloture,
  ModeReportANouveau,
  JeuEtatsFinanciersSycebnl,
  Prisma,
  Referentiel,
  StatutEcriture,
  StatutExercice,
  StatutImmobilisation,
  StatutLettrage,
  StatutRapprochement,
  SystemeComptableSyscohada,
  TypeJournal,
} from '@prisma/client';
import { CreerExerciceDto } from './dto/creer-exercice.dto';
import { ClorePartielleDto, CloreTotaleDto, ClorePeriodeDto } from './dto/cloture.dto';
import { ArreterComptesDto } from './dto/arrete-comptes.dto';
import { FicheR2Dto } from './dto/fiche-r2.dto';
import { jourSaisiOuEffacement } from '../tenant/date-effacable';
import { DatesPortefeuilleDto } from './dto/dates-portefeuille.dto';
import { FinLiquidationDto } from './dto/fin-liquidation.dto';
import { appliquerPortefeuilleEtat, inviterADeclarerPortefeuille, JalonServi, jourFr } from './portefeuille-etat';
import { FORMES_SOCIETES_COMMERCIALES } from '../tenant/mentions-societe';
import {
  cotisationsSpeciales,
  estExerciceDeLiquidation,
  exercicePorteurSecondeCotisation,
  formeEnLiquidation,
  impotAnnuelCedeAuxCotisations,
  jalonsLiquidation,
  estFinSansLiquidation,
  lendemainDe,
  sansLiquidation,
} from './liquidation-societe';
import { commissaireCouvreLExercice } from '../mandat-auditeur/duree-mandat';
import {
  ACTES_DE_LA_PERIODE,
  ACTES_QUI_SUIVENT_LEUR_ECRITURE,
  ActeDeLaPeriodeLu,
  ACTES_DATES_QUI_SUIVENT_LEUR_DATE,
  EtatAvantArret,
  finDOrigineDeLExerciceArrete,
  issueActeDeLaPeriode,
  motifActeQuiNePeutSuivre,
  motifActesDeLaPeriode,
  motifRefusArret,
} from './arret-dissolution';
import { lignesEnNegatif } from '../comptabilite/lignes-en-negatif';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { libelleReference, referencesVers } from '../../common/suppression/references';
import { JournalService } from '../journaux/journal.service';
import { avecRetrySerialisable } from '../../common/prisma-retry.util';
import { DERNIERE_VERIFICATION, dateJalon, DefinitionJalon, jalonsApplicables } from './planning-cloture';

/** Marque la place de la déclaration annuelle de l'IS que les cotisations spéciales prennent. */
const REMPLACEE_PAR_LES_COTISATIONS = Symbol('cotisations spéciales');
import { filtreBrouillardAValider } from '../comptabilite/centralisation-brouillard';
import { refuserSiExerciceBudgetaireClos } from '../analytique/exercice-budgetaire-clos';
import { echeanceDepassee, jourDeKinshasa } from '../../common/echeance';
import { reporterAuJourOuvrable } from '../retenues/jour-ouvrable';
import { premierJourNonCloture } from './report-periode-close';
import {
  apparierTenues,
  horsDuReport,
  budgetsAReporter,
  CompteRan,
  LigneCandidate,
  LigneLueRan,
  LigneOuverturePassee,
  LigneTenue,
  lignesReportANouveau,
  ligneAEcrire,
  rectificationDeLOuverture,
  ouvertureNulle,
  confrontationDeLOuverture,
  LigneRan,
  resultatDesComptesDeGestion,
  SommesRan,
  soldeDuCompte,
} from './report-a-nouveau';
import { estTenueParUnLettrage } from '../lettrage/ligne-lettree';
import {
  annonceDeReconduction,
  apparierAuReport,
  detailNonReconduit,
  groupesNonReconduits,
  groupesQueLaClotureReconduira,
  operationsDeLaCloture,
  resteLisible,
  type GroupeNonReconduit,
  messagesDeReconduction,
  parcourirGroupesPartiels,
  poserGroupeReconduit,
  resteDuGroupe,
  type GroupePartielLu,
  type IssueReconduction,
  type LigneDAccueil,
} from '../lettrage/reconduction-lettrage';
import { randomUUID } from 'crypto';
import { lignesFigees } from './gel-cloture';
import { poserGroupeSoldeDuModule, prochaineLettreDuCompte } from '../lettrage/lettrage.service';
import { LOT_LECTURE, lireParLots, pageApres } from '../../common/lecture-par-lots';
import { libelleExercice } from '../../common/libelle-exercice';
import { formeApplicable } from '../tenant/forme-applicable';
import { filtreOuverturePasseeAuPremierJour } from './ouverture-passee';

/**
 * Ce que le refus dit de la voie que le texte ouvre · AUDCIF art. 22, 4°. Le
 * report n'est jamais fait d'office : c'est le comptable qui le demande.
 */
const AIDE_REPORT_ART_22 =
  "Pour une opération de cette période arrivée après la clôture, l'AUDCIF (art. 22, 4°) veut qu'elle soit " +
  "enregistrée au premier jour de la période non encore clôturée, sa date de valeur étant mentionnée " +
  'distinctement · demandez le report au premier jour ouvert.';

const EPSILON = 0.005;

/**
 * Au centime · les sommes viennent de la base en décimaux exacts, mais leur
 * différence en nombre flottant ne l'est plus (1500,10 moins 1000,20). La
 * colonne est à deux décimales ; l'écriture porte ce que la base gardera.
 */
const auCentime = (x: number) => Math.round(x * 100) / 100;

/**
 * Les écritures que la clôture annuelle engendre entrent au livre-journal
 * VALIDÉES, au nom de celui qui clôture (audit final F4). Elles ne sont
 * saisies par personne : la clôture les calcule sur des soldes déjà validés.
 */
function validationParLaCloture(userId: string) {
  return { statut: StatutEcriture.VALIDEE, valideeAt: new Date(), valideeBy: userId };
}

/** « 2025 » pour un exercice civil, « 01/07/2025 au 31/12/2026 » sinon. */
function periodeLisible(e: { dateDebut: Date; dateFin: Date }): string {
  const d = e.dateDebut.toISOString().slice(0, 10);
  const f = e.dateFin.toISOString().slice(0, 10);
  if (d.slice(5) === '01-01' && f.slice(5) === '12-31' && d.slice(0, 4) === f.slice(0, 4)) return d.slice(0, 4);
  const fr = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}`;
  return `du ${fr(d)} au ${fr(f)}`;
}

/**
 * LE COMPTE 13 PORTE LES MÊMES NUMÉROS DANS LES DEUX PLANS, ET PAS LES MÊMES
 * INTITULÉS · c'est exactement le genre d'écart qui ne casse rien et qui
 * s'imprime au livre-journal.
 *
 *  · SYCEBNL, Partie 2 ch. 2 · 131 Excédent, 139 Déficit ;
 *  · AUDCIF, Titre VII § COMPTE 13 · 131 Résultat net : Bénéfice, 139
 *    Résultat net : Perte ; art. 29 · « le bénéfice net ou la perte nette de
 *    l'exercice ».
 *
 * Le vocabulaire suit le dossier jusque dans le libellé de la ligne de
 * clôture et dans le message d'erreur, qui annonçait « le plan de comptes
 * SYCEBNL de ce dossier » à une entreprise.
 */
export function libellesResultat(referentiel: Referentiel) {
  return referentiel === Referentiel.SYSCOHADA
    ? {
        excedent: 'Résultat net : bénéfice (131)',
        deficit: 'Résultat net : perte (139)',
        ligneExcedent: "Bénéfice net de l'exercice",
        ligneDeficit: "Perte nette de l'exercice",
        plan: 'SYSCOHADA',
      }
    : {
        excedent: "Excédent de l'exercice (131)",
        deficit: "Déficit de l'exercice (139)",
        ligneExcedent: "Excédent de l'exercice",
        ligneDeficit: "Déficit de l'exercice",
        plan: 'SYCEBNL',
      };
}


/**
 * DATES DE L'EXERCICE QUI SUIT CELUI QUI VIENT D'ÊTRE CLOS.
 *
 * Extraite du corps de la clôture pour être éprouvable seule : la version
 * précédente vivait au milieu d'une transaction de plusieurs centaines de
 * lignes, et son erreur d'un jour ne pouvait être vue que par un dossier réel
 * franchissant une année bissextile.
 *
 * L'art. 7 de l'AUDCIF, non exclu par l'art. 3 du SYCEBNL et repris mot pour
 * mot au glossaire de celui-ci, fait coïncider l'exercice avec l'année civile.
 * Le suivant part donc du lendemain de la clôture et va au 31 décembre de son
 * année · jamais d'une durée recopiée, qui dérive dès qu'une année compte
 * 366 jours.
 */
export function exerciceSuivantApres(dateFinClos: Date): { dateDebut: Date; dateFin: Date } {
  const dateDebut = new Date(dateFinClos);
  dateDebut.setUTCDate(dateDebut.getUTCDate() + 1);
  const dateFin = new Date(Date.UTC(dateDebut.getUTCFullYear(), 11, 31));
  return { dateDebut, dateFin };
}

/**
 * APRÈS UN EXERCICE ARRÊTÉ À LA DISSOLUTION, LE SUIVANT EST L'EXERCICE DE
 * LIQUIDATION (décision par la loi du 2026-10-07, point 2 ; AUDCIF art. 7
 * al. 4) · jamais une année civile créée d'office par la clôture ou le report
 * provisoire, qui occuperait la période de la liquidation et empêcherait de
 * créer l'exercice unique qu'elle forme. Le refus nomme le geste. L'associé
 * unique personne morale, hors procédure collective, n'a pas de liquidation
 * (AUSCGIE art. 201 al. 4) · rien n'est refusé.
 */
export function refuserSuivantCivilApresDissolution(
  exercice: { dateFin: Date },
  dossier: { dateDissolution: Date | null; regimeLiquidation?: string | null; associeUniquePersonneMorale?: boolean | null },
): void {
  const d = dossier.dateDissolution ?? null;
  if (!d || exercice.dateFin.getTime() !== d.getTime()) return;
  if (dossier.associeUniquePersonneMorale === true && dossier.regimeLiquidation !== 'PROCEDURE_COLLECTIVE') return;
  throw new BadRequestException(
    `Cet exercice s'arrête à la dissolution du ${jourFr(d)} · l'exercice suivant est l'exercice de liquidation, du ` +
      `${jourFr(lendemainDe(d))} à la clôture de la liquidation (AUDCIF art. 7 al. 4). Créez-le d'abord dans la ` +
      'fenêtre Exercices (« Exercice de liquidation ») · il reçoit le report à-nouveau.',
  );
}

/**
 * Cycle de vie de l'exercice (docs/plan-de-construction.md § 3.1), décrit
 * d'après le code (audit final F209) :
 * - trois clôtures (Partielle et Totale sur un journal, Période sur tous)
 *   qui verrouillent la saisie sans engendrer d'écriture · `clorePartielle`,
 *   `cloreTotale`, `clorePeriode`, et le verrou `refuserSiPeriodeClose`, joué
 *   par les contrôles d'entrée des pièces, la réimputation et la correction
 *   en négatif. La Totale et la Période figent en outre le lettrage et la
 *   ventilation (`gel-cloture.ts`), la Partielle non ;
 * - la clôture ANNUELLE (`cloturer`), qui solde les comptes de gestion (mode
 *   AUCUN) sur le 131 ou le 139 et passe le report à-nouveau définitif dans
 *   l'exercice suivant, selon le mode de chaque compte (Aucun, Solde, Détail),
 *   les deux écritures entrant validées ;
 * - le report à-nouveau PROVISOIRE (`genererANouveauxProvisoires`), même
 *   calcul (`report-a-nouveau.ts`), laissé au brouillard et remplacé à chaque
 *   relance comme à la clôture ;
 * - le planning de clôture, la date d'arrêté des comptes et le report des
 *   budgets sur l'exercice suivant.
 */
@Injectable()
export class ExerciceService {
  private readonly journal = new Logger(ExerciceService.name);

  /**
   * Le virement du résultat antérieur non affecté, calculé sur les comptes lus
   * (`virement-resultat-non-affecte.ts`) · même calcul pour la clôture, le
   * report provisoire et l'aperçu de l'ouverture suivante.
   */
  private async virementDuResultatNonAffecte(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    comptes: CompteRan[],
    dossier: { referentiel: Referentiel; formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null },
  ) {
    const entiteIndividuelle =
      dossier.formeJuridiqueSyscohada === FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE ||
      dossier.formeJuridiqueSyscohada === FormeJuridiqueSyscohada.ENTREPRENANT;
    const destination = destinationsDuVirement(dossier.referentiel, entiteIndividuelle);
    const numeros = [...new Set([destination.credit, destination.debit])];
    const plan = await client.compte.findMany({
      where: { tenantId, numero: { in: numeros } },
      select: { id: true, numero: true },
      orderBy: { numero: 'asc' },
    });
    try {
      return virementResultatNonAffecte(comptes, destination, (n) => plan.find((c) => c.numero === n)?.id);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
    // FACULTATIF · seule la clôture s'en sert, pour lire le bilan par le
    // service d'états du dossier sans importer son module (cycle, voir
    // `common/lecteurs-bilan.ts`). Les doublures des specs s'en passent.
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  /**
   * UN BILAN DÉSÉQUILIBRÉ NE SE CLÔTURE PAS (simulation sur vraie base du
   * 2026-10-08) · le bilan 2027 sortait à 165 828 000 contre 211 900 000, et
   * la clôture l'acceptait sans un mot. Le seul écart admis est la part du 13
   * que l'état ne lit pas et que la clôture vire au report à nouveau
   * (`ecartInexpliqueDuBilan`) · tout autre écart (compte non rattaché à un
   * poste, défaut de correspondance) refuse la clôture, montants nommés.
   *
   * LE 585 D'UN GROUPE SYCEBNL (G1, simulation complète du 2026-10-08,
   * décision de Manasse) · le siège et ses cellules passent leurs transferts
   * au 585 (canevas de trésorerie du groupe), et le bilan des associations ne
   * lit aucun 58 (BW ne lit que 52, 53, 55 et 57) · sans cette admission, un
   * groupe qui suit le guide ne clôturait plus aucun de ses dossiers. Fiche
   * SYCEBNL du compte 58 · « des comptes de passage utiles à la
   * comptabilisation d'opérations internes à l'entité », « soldés à la fin de
   * l'exercice » · le groupe est UNE entité en plusieurs dossiers, et c'est
   * sur elle que le 58 se solde, contrôle déjà tenu par la liasse du groupe
   * (somme nulle exigée, `liaisonNeutralisee`). L'écart admis est EXACTEMENT
   * le solde net du 585 du dossier, au sens inverse (un 585 débiteur manque à
   * l'actif) · tout autre écart, ou un 585 hors groupe, refuse comme avant,
   * et le message nomme alors le 585. ET LE 585 DU GROUPE EST SOLDÉ SUR LA
   * PÉRIODE (relecture du 2026-10-08) · admis sur la seule foi de la liasse,
   * un transfert passé d'un seul côté laissait clôturer les deux dossiers,
   * et la liasse du groupe restait refusée sans issue, ses exercices clos.
   * La clôture le lit sur tous les dossiers du groupe, validé, par le service
   * du groupe (`LECTEUR_VIREMENTS_GROUPE`), et nomme l'écart. Un transit
   * interne au dossier (banque vers caisse) tombe sous la même règle. Le
   * Système minimal de trésorerie lit le 585 à son bilan · l'admission ne le
   * vise pas, un écart égal par hasard n'y serait pas un virement.
   */
  private async refuserBilanDesequilibre(
    tenantId: string,
    exerciceId: string,
    dossier: {
      referentiel: Referentiel;
      systemeComptableSyscohada: SystemeComptableSyscohada | null;
      jeuEtatsFinanciersSycebnl: JeuEtatsFinanciersSycebnl | null;
      // REQUIS · facultatifs, un appelant qui ne les sélectionnerait pas
      // lirait tout dossier comme hors groupe sans un mot (relecture du typage).
      dossierMereId: string | null;
      _count: { cellules: number };
    },
    periode: { dateDebut: Date; dateFin: Date },
  ) {
    if (!this.moduleRef) return;
    const jeton =
      dossier.referentiel === Referentiel.SYSCOHADA
        ? dossier.systemeComptableSyscohada === SystemeComptableSyscohada.MINIMAL_TRESORERIE
          ? LECTEUR_BILAN_SYSCOHADA_SMT
          : LECTEUR_BILAN_SYSCOHADA_NORMAL
        : dossier.jeuEtatsFinanciersSycebnl === JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT
          ? LECTEUR_BILAN_SYCEBNL_PROJETS
          : dossier.jeuEtatsFinanciersSycebnl === JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE
            ? LECTEUR_BILAN_SYCEBNL_SMT
            : LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS;
    let lecteur: LecteurBilan;
    try {
      lecteur = this.moduleRef.get<LecteurBilan>(jeton, { strict: false });
    } catch (e) {
      // Consigné, jamais tu · un montage partiel (outil, banc) n'a pas les
      // modules d'états ; l'application complète les a toujours.
      this.journal.warn(`Contrôle d'équilibre du bilan non joué à la clôture · ${jeton} introuvable (${(e as Error).message})`);
      return;
    }
    const [bilan, treize] = await Promise.all([
      lecteur.bilan(tenantId, exerciceId),
      this.prisma.ligneEcriture.aggregate({
        where: {
          compte: { tenantId, numero: { startsWith: '13' } },
          ecriture: { tenantId, exerciceId, statut: StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false },
        },
        _sum: { debit: true, credit: true },
      }),
    ]);
    const resultat13 = Number(treize._sum.credit ?? 0) - Number(treize._sum.debit ?? 0);
    const ecart = ecartInexpliqueDuBilan(bilan, resultat13);
    if (ecart === null || Math.abs(ecart) <= EPSILON) return;
    // Lu seulement quand l'écart existe, et au SYCEBNL seul · le 585 du
    // SYSCOHADA n'est pas le compte de liaison d'un groupe (184 à 187).
    let solde585 = 0;
    if (dossier.referentiel === Referentiel.SYCEBNL) {
      const virements = await this.prisma.ligneEcriture.aggregate({
        where: {
          compte: { tenantId, numero: { startsWith: '585' } },
          ecriture: { tenantId, exerciceId, statut: StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false },
        },
        _sum: { debit: true, credit: true },
      });
      solde585 = Number(virements._sum.debit ?? 0) - Number(virements._sum.credit ?? 0);
    }
    const enGroupe = !!dossier.dossierMereId || dossier._count.cellules > 0;
    const smt = dossier.jeuEtatsFinanciersSycebnl === JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE;
    if (enGroupe && !smt && Math.abs(solde585) > EPSILON && Math.abs(ecart + solde585) <= EPSILON) {
      // L'écart EST le 585 du dossier · reste que le groupe l'ait soldé.
      let lecteurGroupe: LecteurVirementsGroupe;
      try {
        lecteurGroupe = this.moduleRef.get<LecteurVirementsGroupe>(LECTEUR_VIREMENTS_GROUPE, { strict: false });
      } catch (e) {
        // Sans lecteur, le solde du groupe n'est pas vérifiable · refus
        // nommé, jamais une admission présumée.
        throw new BadRequestException(
          `Le 585 du groupe n'a pas pu être lu (${(e as Error).message}) · la clôture qui l'admettrait est refusée.`,
        );
      }
      const groupe = await lecteurGroupe.virements585DuGroupe(tenantId, periode);
      if (Math.abs(groupe.solde) <= EPSILON) return;
      throw new BadRequestException(
        `Le 585 (virements de fonds) du groupe n'est pas soldé sur la période · écart de ${montantFr(Math.abs(groupe.solde))} ` +
          `${groupe.solde > 0 ? 'au débit' : 'au crédit'}, validé, tous dossiers du groupe confondus. Un transfert est passé d'un ` +
          "seul côté, ou sa contrepartie n'est pas encore validée · passez et validez-la dans l'autre dossier, puis clôturez " +
          "(fiche du compte 58, « soldés à la fin de l'exercice »)." +
          (groupe.dossiersSansExercice > 0
            ? ` ${groupe.dossiersSansExercice} dossier(s) du groupe n'ont pas d'exercice sur cette période · leur 585 n'est pas lu.`
            : ''),
      );
    }
    const part585 =
      Math.abs(solde585) > EPSILON
        ? ` Le 585 (virements de fonds) porte un solde ${solde585 > 0 ? 'débiteur' : 'créditeur'} de ` +
          `${montantFr(Math.abs(solde585))}, que le bilan ne lit pas · un virement interne se solde à la fin de ` +
          "l'exercice (fiche du compte 58)" +
          (enGroupe && !smt ? ", et seul un écart égal à ce solde est admis dans un dossier du groupe." : '.')
        : '';
    throw new BadRequestException(
      `Le bilan de l'exercice ne s'équilibre pas · actif ${montantFr(Number(bilan.totalActif))}, passif ` +
        `${montantFr(Number(bilan.totalPassif))}, écart de ${montantFr(Math.abs(ecart))} que le report à nouveau ` +
        "du résultat non affecté n'explique pas. Un compte n'est rattaché à aucun poste, ou un poste est mal lu · voyez les " +
        '« comptes non rattachés » du bilan, corrigez, puis clôturez (AUDCIF art. 34 ; SYCEBNL art. 16, 4)).' +
        part585,
    );
  }

  /** Crée l'exercice de l'année en cours à l'inscription du tenant (1er janvier → 31 décembre). */
  /**
   * `client` reçoit la transaction de `AuthService.register` quand l'exercice
   * naît avec le dossier · hors de ce cas il vaut `this.prisma`.
   */
  async creerExerciceCourant(tenantId: string, client: Prisma.TransactionClient = this.prisma) {
    const annee = new Date().getFullYear();
    return client.exercice.create({
      data: {
        tenantId,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
      },
    });
  }

  async lister(tenantId: string) {
    return this.prisma.exercice.findMany({ where: { tenantId }, orderBy: { dateDebut: 'desc' } });
  }

  /**
   * `client` reçoit la transaction de `AuthService.register` quand l'exercice
   * naît avec le dossier · hors de ce cas il vaut `this.prisma`.
   */
  async creer(tenantId: string, dto: CreerExerciceDto, client: Prisma.TransactionClient = this.prisma) {
    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);
    if (dateFin <= dateDebut) {
      throw new BadRequestException("La date de fin doit être postérieure à la date de début");
    }
    await this.validerArticle7(tenantId, dateDebut, dateFin, dto.liquidation === true, client);
    return client.exercice.create({ data: { tenantId, dateDebut, dateFin } });
  }

  /**
   * ARTICLE 7 · « L'EXERCICE COÏNCIDE AVEC L'ANNÉE CIVILE. »
   *
   * Le service acceptait n'importe quel couple de dates pourvu que la fin
   * suive le début. Un exercice du 15 mars au 20 août passait, et rien ensuite
   * ne pouvait le rattraper : l'en-tête obligatoire imprimait « Exercice clos
   * le 20-08 », le planning de clôture calculait ses échéances depuis cette
   * date, et la liasse entière reposait sur une période que le texte
   * n'autorise pas. Un garde-fou absent à la racine ne se voit nulle part en
   * aval, parce que tout en aval est cohérent avec la mauvaise racine.
   *
   * La règle est la même sous les deux référentiels, et ce n'est pas une
   * transposition : l'art. 7 n'est PAS dans la liste d'exclusion de l'art. 3
   * du SYCEBNL (art. 5, 8, 10 à 13, 17 al. 7-8, 18, 19 4e tiret, 21, 25 à 34,
   * 49, 69, 70, 71, 73 à 113), et le glossaire du SYCEBNL, Partie 1 ch. 1,
   * la réécrit mot pour mot à l'entrée EXERCICE.
   *
   * Trois cas, et un seul échappatoire :
   *  · exercice courant · du 1er janvier au 31 décembre, sans exception ;
   *  · PREMIER exercice débutant au premier semestre · il « est
   *    exceptionnellement inférieur à douze mois », donc il finit le
   *    31 décembre de la MÊME année ;
   *  · PREMIER exercice débutant au deuxième semestre · sa durée « PEUT être
   *    supérieure à douze mois », donc le 31 décembre de la même année ou de
   *    la suivante, au choix du cabinet ;
   *  · liquidation (al. 4) · seul cas hors année civile, déclaré explicitement.
   *
   * Dans tous les cas non liquidatifs, l'exercice finit un 31 décembre. C'est
   * l'invariant, et c'est lui que l'en-tête des états publie.
   */
  private async validerArticle7(
    tenantId: string,
    dateDebut: Date,
    dateFin: Date,
    liquidation: boolean,
    client: Prisma.TransactionClient,
  ) {
    //
    // LE DRAPEAU DE LIQUIDATION N'EXEMPTE QUE DE LA RÈGLE DU 31 DÉCEMBRE.
    //
    // L'art. 7 al. 4 ouvre UNE exception, et elle porte sur la DURÉE : « en
    // cas de cessation d'activité, pour quelque cause que ce soit, la durée
    // des opérations de liquidation est comptée pour un seul exercice, sous
    // réserve de l'établissement de situations annuelles provisoires ». Rien
    // dans cet alinéa ne permet à DEUX exercices de couvrir la même période,
    // et l'exercice unique ne dispense pas des situations annuelles, que la
    // situation intermédiaire des états permet de produire (passe O1a, D2).
    //
    // Le `return` était posé en tête et court-circuitait donc aussi le
    // contrôle d'unicité posé plus bas · c'est-à-dire l'un des quatre refus du
    // 2026-09-03 (CLAUDE.md § 10 bis), rouvert au moment précis où le dossier
    // est le plus fragile, la liquidation étant le seul cas où un exercice
    // long chevauche mécaniquement une année civile déjà ouverte.
    //
    // LE REFUS NE PORTE QUE SUR UN EXERCICE DÉJÀ CLÔTURÉ, et c'est délibéré.
    // Un exercice clos a sa liasse : un second exercice qui recouvrirait sa
    // période produirait deux jeux d'états sur les mêmes mois, et il n'existe
    // aucune raison légitime de le faire. Un exercice encore OUVERT, lui, est
    // le cas ordinaire de la cessation en cours d'année : l'exercice courant
    // devra être raccourci à la date de cessation, et OmegaX n'a aujourd'hui
    // aucune route pour le faire (aucun `update` sur `dateDebut`/`dateFin`).
    // Refuser là bloquerait la liquidation sans issue · ce cas est signalé au
    // relevé de manques et attend un arbitrage, il n'est pas tranché ici.
    if (liquidation) {
      // LA DISSOLUTION DÉCLARÉE FIXE L'EXERCICE DE LIQUIDATION (décision par
      // la loi du 2026-10-07, point 2) · il court du LENDEMAIN de la
      // dissolution à la clôture de la liquidation, sans plafond de durée
      // (AUDCIF art. 7 al. 4), et il est SEUL sur sa période · l'exercice qui
      // contient la dissolution s'arrête d'abord à cette date
      // (`arreterALaDissolution`), et l'unicité de la période (CLAUDE.md
      // § 10 bis) vaut alors entière, exercices ouverts compris.
      const tenant = await client.tenant.findUnique({
        where: { id: tenantId },
        select: { referentiel: true, formeJuridiqueSyscohada: true, dateDissolution: true },
      });
      const dissolution = tenant?.dateDissolution ?? null;
      if (dissolution) {
        const lendemain = lendemainDe(dissolution);
        if (dateDebut.getTime() !== lendemain.getTime()) {
          throw new BadRequestException(
            `L'exercice de liquidation court du lendemain de la dissolution, le ${jourFr(lendemain)}, à la clôture ` +
              'de la liquidation · la durée des opérations de liquidation est comptée pour un seul exercice (AUDCIF ' +
              'art. 7 al. 4).',
          );
        }
        const chevauche = await client.exercice.findFirst({
          where: { tenantId, dateDebut: { lte: dateFin }, dateFin: { gte: dateDebut } },
          orderBy: { dateDebut: 'asc' },
          select: { dateDebut: true, dateFin: true },
        });
        if (chevauche) {
          const contientDissolution =
            chevauche.dateDebut.getTime() <= dissolution.getTime() && chevauche.dateFin.getTime() >= dissolution.getTime();
          throw new BadRequestException(
            contientDissolution
              ? `L'exercice du ${jourFr(chevauche.dateDebut)} au ${jourFr(chevauche.dateFin)} couvre encore la période ` +
                  `qui suit la dissolution du ${jourFr(dissolution)} · arrêtez-le d'abord à cette date (fenêtre ` +
                  'Exercices), puis créez l’exercice de liquidation.'
              : `L'exercice du ${jourFr(chevauche.dateDebut)} au ${jourFr(chevauche.dateFin)} couvre déjà une partie ` +
                  'de cette période · une période n’est couverte que par un seul exercice, et la liquidation n’en ' +
                  'forme qu’un (AUDCIF art. 7 al. 4).',
          );
        }
        return;
      }
      // UNE SOCIÉTÉ OU UNE COOPÉRATIVE DÉCLARE SA DISSOLUTION D'ABORD · c'est
      // elle qui fixe le premier jour de la liquidation (AUSCGIE art. 204 ;
      // AUSCOOP art. 183).
      const forme = tenant?.formeJuridiqueSyscohada ?? null;
      if (
        tenant?.referentiel === Referentiel.SYSCOHADA &&
        forme !== null &&
        (FORMES_SOCIETES_COMMERCIALES.includes(forme) || forme === FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE)
      ) {
        throw new BadRequestException(
          'Déclarez d’abord la date de dissolution dans Paramètres du dossier · l’exercice de liquidation court du ' +
            'lendemain de la dissolution à la clôture de la liquidation (AUDCIF art. 7 al. 4).',
        );
      }
      // HORS DU PÉRIMÈTRE DE LA DÉCISION (liquidation d'une association ou
      // d'une ONG, loi n° 004/2001, non relue pour ce point) · le régime
      // d'avant demeure, seul l'exercice CLÔTURÉ étant opposé.
      const closDejaCouvert = await client.exercice.findFirst({
        where: {
          tenantId,
          statut: StatutExercice.CLOTURE,
          dateDebut: { lte: dateFin },
          dateFin: { gte: dateDebut },
        },
        select: { dateDebut: true, dateFin: true },
      });
      if (closDejaCouvert) {
        throw new BadRequestException(
          `Un exercice CLÔTURÉ couvre déjà cette période (${closDejaCouvert.dateDebut.toISOString().slice(0, 10)} ` +
            `au ${closDejaCouvert.dateFin.toISOString().slice(0, 10)}) · un exercice de liquidation échappe à la ` +
            "règle du 31 décembre (AUDCIF art. 7 al. 4), jamais à l'unicité de la période. Faites-le commencer " +
            "après la clôture du dernier exercice arrêté.",
        );
      }
      return;
    }

    // APRÈS LA DISSOLUTION, AUCUN EXERCICE CIVIL (constats 3 et 6 de la
    // relecture ; quatrième lot, point 1) · la liquidation forme UN exercice,
    // du lendemain de la dissolution à sa clôture (AUDCIF art. 7 al. 4), et la
    // personnalité morale ne subsiste « que pour les besoins de la liquidation
    // et jusqu'à la publication de la clôture de celle-ci » (AUSCGIE art. 205 ;
    // AUSCOOP art. 184) · un exercice civil ouvert après elle occuperait la
    // période de la liquidation, ou servirait planning, IS et acomptes à une
    // société éteinte. Sans liquidation (AUSCGIE art. 201 al. 4), le patrimoine
    // passe à l'associé · aucun exercice ne suit non plus.
    const dossierDissous = await client.tenant.findUnique({
      where: { id: tenantId },
      select: { referentiel: true, formeJuridiqueSyscohada: true, dateDissolution: true },
    });
    if (
      dossierDissous?.referentiel === Referentiel.SYSCOHADA &&
      dossierDissous.dateDissolution &&
      formeEnLiquidation(dossierDissous.formeJuridiqueSyscohada) &&
      dateDebut.getTime() > dossierDissous.dateDissolution.getTime()
    ) {
      throw new BadRequestException(
        `La société est dissoute le ${jourFr(dossierDissous.dateDissolution)} · la liquidation forme un seul exercice, du ` +
          `${jourFr(lendemainDe(dossierDissous.dateDissolution))} à sa clôture (AUDCIF art. 7 al. 4), et aucun exercice ` +
          'civil ne s’ouvre après. Créez l’exercice de liquidation (case « Exercice de liquidation »), ou reportez sa fin.',
      );
    }

    const finLe31Decembre = dateFin.getUTCMonth() === 11 && dateFin.getUTCDate() === 31;
    if (!finLe31Decembre) {
      throw new BadRequestException(
        "L'exercice coïncide avec l'année civile (AUDCIF art. 7, repris au glossaire SYCEBNL) : il se " +
          'termine un 31 décembre. Seul un exercice de liquidation y échappe, et il doit être déclaré ' +
          'comme tel.',
      );
    }

    // Premier exercice du dossier · c'est le seul qui puisse ne pas couvrir
    // l'année civile entière. Compté dans la transaction appelante, sans quoi
    // l'exercice créé avec le dossier se croirait le second.
    const premier = (await client.exercice.count({ where: { tenantId } })) === 0;
    const debutLe1erJanvier = dateDebut.getUTCMonth() === 0 && dateDebut.getUTCDate() === 1;

    // DEUX EXERCICES SUR LA MÊME ANNÉE CIVILE · l'art. 7 impose la durée, pas
    // l'unicité, et rien ne l'imposait ailleurs. Les deux passaient donc, et
    // le dossier se retrouvait avec deux exercices 2026 dans son sélecteur.
    // Aucun total n'est faux pour autant : les écritures se répartissent entre
    // les deux, chaque bilan boucle sur SON exercice, et il faut additionner
    // mentalement deux liasses pour voir que l'année est coupée en deux. Le
    // postulat de spécialisation suppose UN exercice par période (SYCEBNL
    // cadre conceptuel § 3.3.1.2.3), et le glossaire du SYCEBNL définit
    // l'exercice comme « la période couverte », au singulier.
    const anneeDejaOuverte = await client.exercice.findFirst({
      where: {
        tenantId,
        dateDebut: { lte: dateFin },
        dateFin: { gte: dateDebut },
      },
      select: { dateDebut: true, dateFin: true },
    });
    if (anneeDejaOuverte) {
      throw new BadRequestException(
        `Un exercice couvre déjà cette période (${anneeDejaOuverte.dateDebut.toISOString().slice(0, 10)} au ` +
          `${anneeDejaOuverte.dateFin.toISOString().slice(0, 10)}) · une période n'est couverte que par un seul ` +
          'exercice, sans quoi les écritures se répartiraient entre deux liasses qui bouclent chacune de son côté.',
      );
    }

    if (!premier) {
      // UN EXERCICE NOUVEAU TOUCHE UN EXERCICE DU DOSSIER (constat G3,
      // `exercice-contigu.ts`) · un trou entre deux années faisait reporter la
      // clôture dans l'exercice d'après le trou.
      const [precedent, suivant] = await Promise.all([
        client.exercice.findFirst({
          where: { tenantId, dateFin: { lt: dateDebut } },
          orderBy: { dateFin: 'desc' },
          select: { dateFin: true },
        }),
        client.exercice.findFirst({
          where: { tenantId, dateDebut: { gt: dateFin } },
          orderBy: { dateDebut: 'asc' },
          select: { dateDebut: true },
        }),
      ]);
      const motifTrou = motifCreationNonContigue(dateDebut, dateFin, precedent, suivant);
      if (motifTrou) throw new BadRequestException(motifTrou);
    }

    if (!premier) {
      if (!debutLe1erJanvier || dateDebut.getUTCFullYear() !== dateFin.getUTCFullYear()) {
        throw new BadRequestException(
          "Seul le PREMIER exercice d'un dossier peut s'écarter de l'année civile (AUDCIF art. 7). " +
            'Celui-ci doit courir du 1er janvier au 31 décembre de la même année.',
        );
      }
      return;
    }

    const premierSemestre = dateDebut.getUTCMonth() <= 5;
    const anneesEcart = dateFin.getUTCFullYear() - dateDebut.getUTCFullYear();
    if (premierSemestre && anneesEcart !== 0) {
      throw new BadRequestException(
        "Un premier exercice débutant au cours du premier semestre est exceptionnellement INFÉRIEUR à " +
          'douze mois (AUDCIF art. 7) : il se termine le 31 décembre de la même année.',
      );
    }
    if (!premierSemestre && anneesEcart > 1) {
      throw new BadRequestException(
        "Un premier exercice débutant au cours du deuxième semestre se termine le 31 décembre de la " +
          "même année ou de la suivante (AUDCIF art. 7) : sa durée peut dépasser douze mois, pas vingt-quatre.",
      );
    }
  }

  /**
   * Planning de clôture de l'exercice · les jalons de planning-cloture.ts
   * qui s'appliquent au dossier (`jalonsApplicables`, selon son référentiel,
   * sa forme et son droit ; aucun décompte écrit ici, il se périmait, audit
   * final F209), datés à partir de la date de clôture de CET exercice, les
   * échéances fiscales reportées au premier jour ouvrable, et augmentés de ce
   * qu'OmegaX sait observer tout seul.
   *
   * L'observation est le point : un planning statique est une affiche, un
   * planning qui sait qu'il reste douze écritures au brouillard est un outil.
   * Elle ne couvre que les jalons vérifiables en base ; les autres restent
   * des cases que le comptable coche dans sa tête, et le disent.
   *
   * LES JALONS N'ONT PAS TOUS LE MÊME DEGRÉ DE CERTITUDE, et l'annoncer en
   * bloc comme « antérieur au SYCEBNL et non revérifié » était faux pour la
   * moitié d'entre eux. Trois familles, chacune marquée par sa source dans
   * planning-cloture.ts :
   *
   *  · lus sur texte primaire · AUSCGIE art. 138, 140 et 269 ; AUDCIF art. 19,
   *    23, 24, 66, 69 à 72 ; loi n° 004/2001 ; SYCEBNL art. 14, 17 et 18 ;
   *    loi de procédures fiscales art. 12 à 15 ;
   *  · tirés du cours du CPCC de novembre 2020, antérieur au SYCEBNL, non
   *    revérifiés sur texte primaire · les dépôts congolais au CPCC et au
   *    Ministère de l'Économie nationale, et le calendrier interne du § 2.3 ;
   *  · sans date fixée par le texte · le rapport d'activité des ONG, que la
   *    loi dit « périodiquement ».
   *
   * Le logiciel ne calcule en revanche AUCUNE astreinte, dans aucun cas : les
   * arrêtés de 2010 et 2013 sont nommés, leurs taux ne sont pas repris, et un
   * taux non revérifié n'a rien à faire dans un logiciel de 2026. Voir
   * docs/organisation-comptable-cpcc.md § 6.
   */
  async planningCloture(tenantId: string, exerciceId: string) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    // LES JALONS DE LA FORME DE L'EXERCICE, PAS CELLE DU JOUR (AUSCGIE
    // art. 182 et 183, passe O1a, D3) · l'exercice au cours duquel la
    // transformation intervient est arrêté et approuvé selon la nouvelle forme,
    // les précédents gardent l'ancienne.
    const formeDeLExercice = formeApplicable(tenant, exercice.dateFin);

    const [enBrouillard, transcriptions, rapports, donations] = await Promise.all([
      // Le brouillard VALIDABLE · ni le report à-nouveau provisoire ni la
      // clôture d'un exercice clos, que personne ne peut valider (audit final
      // F77, règle de centralisation-brouillard.ts).
      this.prisma.ecriture.count({
        where: { tenantId, exerciceId, statut: StatutEcriture.BROUILLARD, ...filtreBrouillardAValider(exercice.statut) },
      }),
      this.prisma.transcriptionInventaire.count({ where: { tenantId, exerciceId } }),
      this.prisma.rapportActivite.count({ where: { tenantId, exerciceId } }),
      this.prisma.donation.findMany({
        where: {
          tenantId,
          annulee: false,
          dateOperation: { gte: exercice.dateDebut, lte: exercice.dateFin },
        },
        select: { signeeLe: true },
      }),
    ]);
    const donationsNonSignees = donations.filter((d) => d.signeeLe === null).length;

    const observations: Record<string, { libelle: string; satisfait: boolean }> = {
      BROUILLARD: {
        libelle:
          enBrouillard === 0
            ? 'Aucune écriture au brouillard'
            : `${enBrouillard} écriture(s) encore au brouillard, à valider avant la balance`,
        satisfait: enBrouillard === 0,
      },
      INVENTAIRE: {
        libelle:
          transcriptions === 0
            ? 'Aucune transcription au livre d’inventaire'
            : `${transcriptions} transcription(s) au livre d’inventaire`,
        satisfait: transcriptions > 0,
      },
      RAPPORT_ACTIVITE: {
        libelle: rapports === 0 ? 'Aucun rapport d’activité établi' : `${rapports} version(s) du rapport d’activité`,
        satisfait: rapports > 0,
      },
      DONATEURS: {
        libelle:
          donations.length === 0
            ? 'Aucune libéralité enregistrée sur l’exercice'
            : donationsNonSignees === 0
              ? `${donations.length} libéralité(s), toutes signées`
              : `${donations.length} libéralité(s) dont ${donationsNonSignees} non signée(s)`,
        // Un registre vide est un registre en règle : rien n'oblige une
        // association à recevoir des dons. Ce qui n'est pas en règle, c'est
        // une libéralité inscrite et non signée (art. 18).
        satisfait: donationsNonSignees === 0,
      },
      CLOTURE_ANNUELLE: {
        libelle:
          exercice.statut === StatutExercice.CLOTURE ? 'Exercice clôturé' : 'Exercice encore ouvert',
        satisfait: exercice.statut === StatutExercice.CLOTURE,
      },
    };

    // LE JOUR DE KINSHASA, PAS L'INSTANT (audit final F81) · un jalon n'est en
    // retard qu'au lendemain de son échéance.
    const aujourdHui = jourDeKinshasa(new Date());
    // ENTREPRISE DU PORTEFEUILLE DE L'ÉTAT · « toute société dans laquelle
    // l'État [...] détient la totalité des actions ou une participation » (loi
    // n° 08/010, art. 3) · servie sur la seule réponse « oui », aux cinq
    // sociétés commerciales de la forme de l'exercice, jamais ailleurs.
    const societe =
      tenant.referentiel === Referentiel.SYSCOHADA &&
      formeDeLExercice !== null &&
      FORMES_SOCIETES_COMMERCIALES.includes(formeDeLExercice);
    const portefeuille = societe ? tenant.entreprisePortefeuilleEtat : null;
    // La décision d'affectation enregistrée lève le jalon de l'art. 113.
    const affectation =
      portefeuille === true
        ? await this.prisma.affectationResultat.findFirst({
            where: { tenantId, exerciceId },
            select: { dateDecision: true },
          })
        : null;
    // UN COMMISSAIRE AUX COMPTES SE LIT SUR LA TABLE DES MANDATS (relecture
    // 2) · les quarante-cinq jours de l'art. 140 (SARL « le cas échéant ») et
    // de l'AUDCIF art. 71 (« s'ils existent ») le supposent. Même lecture que
    // le contrôle 28 · mandat couvrant l'exercice, ou mandat échu prorogé
    // sans refus exprès. Rien d'enregistré · `null`, jamais « aucun ».
    let commissaireDesigne: boolean | null = null;
    if (portefeuille === true) {
      // Un mandat terminé par anticipation est lu aussi · il couvre encore les
      // exercices clos avant sa fin (`commissaireCouvreLExercice`).
      const mandats = await this.prisma.mandatAuditeur.findMany({
        where: { tenantId },
        orderBy: { premierExercice: 'desc' },
        select: { premierExercice: true, nombreExercices: true, refusDeProrogation: true, finAnticipeeLe: true },
      });
      if (
        commissaireCouvreLExercice(
          mandats,
          exercice.dateFin.getUTCFullYear(),
          tenant.referentiel,
          formeDeLExercice,
          exercice.dateFin,
        )
      ) {
        commissaireDesigne = true;
      }
    }
    // LE BÉNÉFICE NET COMPTABLE d'une entreprise MINIÈRE du portefeuille
    // (arrêté du 10 décembre 2025, art. 2) · lu sur le livre-journal (écritures
    // VALIDÉES), classes 6 à 8, AVANT l'écriture qui solde les comptes de
    // gestion (CLAUDE.md, « un drapeau, deux sens ») · sans quoi un exercice
    // clos rendrait un résultat nul. Une somme, demandée à la base.
    const secteurMinier = portefeuille === true ? (tenant.portefeuilleSecteurMinier ?? null) : null;
    const quotePartEtat =
      tenant.quotePartEtatCapital === null || tenant.quotePartEtatCapital === undefined
        ? null
        : Number(tenant.quotePartEtatCapital);
    let resultatNet: number | null = null;
    let capitauxPropres: { capital: number; capitauxPropres: number; reportANouveau: number } | null = null;
    if (secteurMinier === true) {
      const livreJournal = { tenantId, exerciceId, statut: StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false };
      // Le solde créditeur (crédit moins débit) d'un ensemble de comptes.
      const solde = async (compte: Prisma.CompteWhereInput) => {
        const s = await this.prisma.ligneEcriture.aggregate({
          where: { compte: { tenantId, ...compte }, ecriture: livreJournal },
          _sum: { debit: true, credit: true },
        });
        return Math.round((Number(s._sum.credit ?? 0) - Number(s._sum.debit ?? 0)) * 100) / 100;
      };
      const parRacines = (racines: string[]): Prisma.CompteWhereInput => ({
        OR: racines.map((r) => ({ numero: { startsWith: r } })),
      });
      // LES CAPITAUX PROPRES DU BILAN (postes CA à CM, `correspondance-bilan-
      // syscohada.ts`) · capital 101 à 104 (CA), apporteurs non appelé 109
      // (CB, débiteur), primes 105, écarts de réévaluation 106, réserves 111
      // à 118, report à nouveau 12, subventions 14, provisions réglementées
      // 15, le 13 (résultat N-1 reporté à l'à-nouveau tant que son
      // affectation n'est pas validée · l'affectation passe au brouillard,
      // `AffectationService`) et le résultat de l'exercice (CJ). Lus avant
      // le solde des comptes de gestion · la ligne du 13 que la clôture pose
      // est dans cette écriture, déjà écartée par `livreJournal`. Sans le 13,
      // un bénéfice N-1 non affecté disparaissait et l'avertissement de
      // l'AUSCGIE art. 143 sortait à tort (relecture du 2026-10-07).
      const [resultat, capital, reportANouveau, autres] = await Promise.all([
        solde({ classe: { in: [ClasseCompte.CLASSE_6, ClasseCompte.CLASSE_7, ClasseCompte.CLASSE_8] } }),
        solde(parRacines(['101', '102', '103', '104'])),
        solde(parRacines(['12'])),
        solde(parRacines(['10', '11', '12', '13', '14', '15'])),
      ]);
      resultatNet = resultat;
      capitauxPropres = { capital, reportANouveau, capitauxPropres: Math.round((autres + resultat) * 100) / 100 };
    }
    // LIQUIDATION D'UNE SOCIÉTÉ COMMERCIALE (décision par la loi du
    // 2026-10-04, point 4) · ses jalons suivent ceux de l'exercice, sur les
    // seuls exercices qui finissent après la dissolution déclarée.
    const faitsLiquidation = {
      forme: formeDeLExercice,
      dateDissolution: tenant.dateDissolution,
      dateNominationLiquidateur: tenant.dateNominationLiquidateur,
      regimeLiquidation: tenant.regimeLiquidation,
      associeUniquePersonneMorale: tenant.associeUniquePersonneMorale,
      dateClotureLiquidation: tenant.dateClotureLiquidation,
      dateDeclarationCotisationActivite: tenant.dateDeclarationCotisationActivite,
      dateDeclarationCotisationLiquidation: tenant.dateDeclarationCotisationLiquidation,
    };
    const liquidation = jalonsLiquidation(faitsLiquidation, exercice, aujourdHui);
    // LES COTISATIONS SPÉCIALES REMPLACENT LA DÉCLARATION ANNUELLE de l'impôt
    // sur les sociétés (décisions par la loi du 2026-10-07, point 2, et
    // quatrième lot, point 4 · loi n° 23/053, art. 13 ; LPF art. 16, règle
    // spéciale sur l'art. 12) · aucune déclaration annuelle pour l'année de la
    // dissolution ni pour les suivantes. La seconde cotisation va à l'exercice
    // qui la porte, lu sur tous les exercices du dossier (constat 8).
    const exercicesDuDossier = tenant.dateDissolution
      ? await this.prisma.exercice.findMany({
          where: { tenantId },
          select: { id: true, dateDebut: true, dateFin: true, statut: true },
        })
      : [];
    const cotisations = cotisationsSpeciales(
      faitsLiquidation,
      { dateDebut: exercice.dateDebut, dateFin: exercice.dateFin, clos: exercice.statut === StatutExercice.CLOTURE },
      aujourdHui,
      tenant.dateDissolution
        ? { porteurSeconde: exercicePorteurSecondeCotisation(exercicesDuDossier, faitsLiquidation) === exercice.id }
        : {},
    );
    const impotAnnuelCede = impotAnnuelCedeAuxCotisations(faitsLiquidation, exercice);
    // La déclaration annuelle de l'IS cède sa place aux cotisations · un
    // dossier sans elle (forme non sociétaire) les reçoit en fin d'étape 15.
    const avecCotisations = (definitions: DefinitionJalon[]): Array<DefinitionJalon | typeof REMPLACEE_PAR_LES_COTISATIONS> => {
      if (!impotAnnuelCede && cotisations.length === 0) return definitions;
      const index = definitions.findIndex((d) => d.declarationAnnuelleImpotSocietes);
      if (index >= 0) return definitions.map((d, i) => (i === index ? REMPLACEE_PAR_LES_COTISATIONS : d));
      const apres = definitions.findIndex((d) => d.etape > 15);
      return apres < 0
        ? [...definitions, REMPLACEE_PAR_LES_COTISATIONS]
        : [...definitions.slice(0, apres), REMPLACEE_PAR_LES_COTISATIONS, ...definitions.slice(apres)];
    };
    // LES GESTES DE LA DISSOLUTION (quatrième lot, point 1 ; constats 2, 13 et
    // 15) · l'écran propose ce que le serveur admettra, par la MÊME règle
    // (`motifRefusArret`), et dit le refus quand l'arrêt est le geste attendu.
    let gestesDissolution: {
      date: Date;
      arretPropose: boolean;
      motifArret: string | null;
      annulationProposee: boolean;
      rattachementPropose: boolean;
      exerciceDeLiquidation: boolean;
      dateClotureLiquidation: Date | null;
      /** Actes de la période que l'arrêt retirera avec l'accord du cabinet (bloquant 1). */
      actesDeLaPeriodeARetirer: string[];
    } | null = null;
    if (tenant.dateDissolution) {
      const d = tenant.dateDissolution;
      const ouvert = exercice.statut === StatutExercice.OUVERT;
      const contient = exercice.dateDebut.getTime() <= d.getTime() && d.getTime() < exercice.dateFin.getTime();
      // Les actes que l'arrêt peut retirer ne refusent pas le bouton · l'écran
      // les nomme dans sa confirmation et porte l'accord (bloquant 1).
      const lu = contient
        ? (await lireEtatAvantArret(this.prisma, tenantId, exercice, { ...tenant, formeJuridiqueSyscohada: formeDeLExercice })).etat
        : null;
      const motifArret = lu ? motifRefusArret({ ...lu, actesDeLaPeriode: lu.actesDeLaPeriode.filter((a) => !a.retirable) }) : null;
      const actesDeLaPeriodeARetirer = lu ? lu.actesDeLaPeriode.filter((a) => a.retirable).map((a) => `${a.libelle} (${a.piece})`) : [];
      const avecLiquidation =
        formeEnLiquidation(formeDeLExercice) &&
        !sansLiquidation({ forme: formeDeLExercice, regimeLiquidation: tenant.regimeLiquidation, associeUniquePersonneMorale: tenant.associeUniquePersonneMorale });
      const lendemain = lendemainDe(d);
      gestesDissolution = {
        date: d,
        arretPropose: contient && ouvert && motifArret === null,
        motifArret: contient && ouvert ? motifArret : null,
        annulationProposee:
          ouvert && exercice.dateFin.getTime() === d.getTime() && !(d.getUTCMonth() === 11 && d.getUTCDate() === 31),
        rattachementPropose:
          avecLiquidation &&
          ouvert &&
          exercice.dateDebut.getTime() > lendemain.getTime() &&
          !exercicesDuDossier.some(
            (e) => e.id !== exercice.id && (e.dateFin.getTime() >= lendemain.getTime() || e.statut === StatutExercice.OUVERT),
          ),
        exerciceDeLiquidation: estExerciceDeLiquidation(exercice, d),
        dateClotureLiquidation: tenant.dateClotureLiquidation,
        actesDeLaPeriodeARetirer,
      };
    }
    const avecPortefeuille = (jalons: JalonServi[]) => [
      ...(portefeuille === true
        ? appliquerPortefeuilleEtat(
            jalons,
            {
              dateFin: exercice.dateFin,
              forme: formeDeLExercice!,
              commissaireDesigne,
              exerciceClos: exercice.statut === StatutExercice.CLOTURE,
              dateArreteComptes: exercice.dateArreteComptes,
              dateAssembleeGenerale: exercice.dateAssembleeGenerale,
              dateDepotEtatsPortefeuille: exercice.dateDepotEtatsPortefeuille,
              dateTransmissionPvPortefeuille: exercice.dateTransmissionPvPortefeuille,
              dateDecisionAffectation: affectation?.dateDecision ?? null,
              secteurMinier,
              quotePartEtat,
              sourceQuotePartEtat: tenant.sourceQuotePartEtat,
              resultatNet,
              dateDeclarationDividendeEtat: exercice.dateDeclarationDividendeEtat,
              dateNotePerceptionDividende: exercice.dateNotePerceptionDividende,
              datePaiementDividendeEtat: exercice.datePaiementDividendeEtat,
              dateDissolution: tenant.dateDissolution,
              capitauxPropres,
            },
            aujourdHui,
          )
        : societe && portefeuille === null
          ? inviterADeclarerPortefeuille(jalons)
          : jalons),
      ...liquidation,
    ];
    return {
      exerciceId: exercice.id,
      dateDebut: exercice.dateDebut,
      dateFin: exercice.dateFin,
      statut: exercice.statut,
      derniereVerification: DERNIERE_VERIFICATION,
      // Le planning n'est pas le même pour une ASBL, une ONG et une entreprise
      // commerciale : voir jalonsApplicables et son commentaire.
      formeJuridique: tenant.formeJuridique,
      formeJuridiqueSyscohada: formeDeLExercice,
      droitEtranger: tenant.droitEtranger,
      // O.-L. n° 13/003, art. 112 et 113 · fait déclaré du dossier et dates
      // déclarées de l'exercice (décision par la loi du 2026-10-04, point 1).
      entreprisePortefeuilleEtat: portefeuille,
      dateAssembleeGenerale: exercice.dateAssembleeGenerale,
      dateDepotEtatsPortefeuille: exercice.dateDepotEtatsPortefeuille,
      dateTransmissionPvPortefeuille: exercice.dateTransmissionPvPortefeuille,
      // Entreprise MINIÈRE du portefeuille (décision par la loi du 2026-10-07,
      // points 3 et 4) · faits du dossier et dates du dividende ; la quote-part
      // sert aussi la proposition de la case ZQ de la fiche R2.
      portefeuilleSecteurMinier: secteurMinier,
      quotePartEtatCapital: portefeuille === true ? quotePartEtat : null,
      dateDeclarationDividendeEtat: exercice.dateDeclarationDividendeEtat,
      dateNotePerceptionDividende: exercice.dateNotePerceptionDividende,
      datePaiementDividendeEtat: exercice.datePaiementDividendeEtat,
      // LA DISSOLUTION DÉCLARÉE (décision par la loi du 2026-10-07, point 2) ·
      // l'écran propose l'arrêt de l'exercice qui la contient et le report de
      // la fin de l'exercice de liquidation ; le serveur refuse tout le reste.
      dissolution: gestesDissolution,
      jalons: avecPortefeuille(avecCotisations(jalonsApplicables({
        referentiel: tenant.referentiel,
        formeJuridique: tenant.formeJuridique,
        formeJuridiqueSyscohada: formeDeLExercice,
        droitEtranger: tenant.droitEtranger,
        associeUniqueSas: tenant.associeUniqueSas,
      })).flatMap((j): JalonServi[] => {
        if (j === REMPLACEE_PAR_LES_COTISATIONS) return cotisations;
        // Une échéance FISCALE tombant un jour non ouvrable est reportée au
        // premier jour ouvrable qui suit (LPF art. 110 bis, al. 2), comme au
        // registre des retenues · les autres jalons n'ont aucun texte qui les
        // reporte (audit final F81).
        const brute = dateJalon(exercice.dateFin, j.echeance);
        const echeance = j.echeanceFiscale ? reporterAuJourOuvrable(brute) : brute;
        const observation = j.observation ? observations[j.observation] : undefined;
        return [{
          etape: j.etape,
          libelle: j.libelle,
          detail: j.detail,
          nature: j.nature,
          source: j.source,
          // Absent sur la plupart des jalons · seuls ceux dont l'OMISSION est
          // pénalement sanctionnée le portent, chacun citant l'article de SON
          // référentiel.
          sanction: j.sanction ?? null,
          debut: dateJalon(exercice.dateFin, j.debut),
          echeance,
          // « En retard » n'a de sens que pour un jalon non satisfait : une
          // étape faite reste faite, même après la date.
          enRetard: echeanceDepassee(echeance, aujourdHui) && !(observation?.satisfait ?? false),
          observation,
        }];
      })),
    };
  }


  /**
   * ARRÊTÉ DES COMPTES · la quatrième mention obligatoire de chaque page
   * publiée, et la seule que le dossier ne portait nulle part.
   *
   * AUDCIF, Titre IX ch. 1 § 2.4 · les états financiers « doivent comporter
   * obligatoirement » le nom de l'entité, LA DATE D'ARRÊTÉ et la période
   * couverte, et l'unité monétaire, « dans chacune des pages des états
   * financiers publiés ». L'article 23 la réclame en outre « dans toute
   * publication des états financiers », et il n'est PAS dans la liste
   * d'exclusion de l'art. 3 du SYCEBNL : la mention vaut des deux côtés.
   *
   * CE N'EST PAS LA CLÔTURE. Titre VIII ch. 31 § 1.3 · « l'arrêté par les
   * organes dirigeants, légalement responsables, ne peut être que postérieur
   * de plusieurs semaines, voire plusieurs mois, à la date de clôture ». D'où
   * le seul refus posé ici, celui d'une date antérieure à la clôture : arrêter
   * des comptes avant la fin de la période qu'ils couvrent n'a pas de sens.
   *
   * LE DÉLAI DE QUATRE MOIS N'EST PAS UN REFUS. Le § 1.3 le donne comme
   * limite, mais un dossier réel arrête parfois en retard, et bloquer la
   * saisie effacerait le retard au lieu de le montrer · c'est le jalon de
   * clôture et le contrôle qui le signalent, en laissant la date vraie.
   *
   * NULL EFFACE. Le § 1.6 prévoit expressément le nouvel arrêté : « si
   * certaines informations susceptibles de remettre profondément en cause les
   * états financiers n'étaient connues qu'après l'arrêté, il appartiendrait
   * aux dirigeants de procéder à un NOUVEL ARRÊTÉ des comptes modifiés ».
   */
  async arreterComptes(tenantId: string, exerciceId: string, dto: ArreterComptesDto) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const date = dto.dateArreteComptes ? new Date(dto.dateArreteComptes) : null;
    if (date && date < exercice.dateFin) {
      throw new BadRequestException(
        "La date d'arrêté des comptes ne peut pas précéder la clôture de l'exercice : les organes dirigeants " +
          'arrêtent des comptes déjà clos (AUDCIF, Titre VIII ch. 31 § 1.3).',
      );
    }
    return this.prisma.exercice.update({
      where: { id: exerciceId },
      data: { dateArreteComptes: date },
    });
  }

  /**
   * FICHE R2, cases ZN à ZS (AUDCIF Titre IX ch. 2) · faits DÉCLARÉS de
   * l'exercice, jamais déduits (décision par la loi du 2026-10-04, point 5).
   * La route est cloisonnée au SYSCOHADA (`@ReferentielsAutorises`).
   *
   * Un seul refus au-delà de la forme · une « première année d'exercice dans
   * le pays » POSTÉRIEURE à l'année de clôture de l'exercice déclaré, qui
   * dirait que l'entité n'exerçait pas encore pendant l'exercice qu'elle
   * présente (lecture d'OmegaX, le texte ne bornant pas la case).
   */
  async declarerFicheR2(tenantId: string, exerciceId: string, dto: FicheR2Dto) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    // LE SYSTÈME MINIMAL N'A PAS DE FICHE R2 · le Titre X n'en porte aucune, et
    // la liasse du S.M.T ne l'imprime pas · une case déclarée là n'irait nulle part.
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { systemeComptableSyscohada: true },
    });
    if (tenant.systemeComptableSyscohada === SystemeComptableSyscohada.MINIMAL_TRESORERIE) {
      throw new BadRequestException(
        'La fiche R2 (cases ZN à ZS) est celle du Système normal · le Système minimal de trésorerie n’en porte ' +
          'pas (AUDCIF, Titre X), et sa liasse ne l’imprime pas.',
      );
    }
    const annee = dto.premiereAnneeExercicePays;
    const anneeDeCloture = exercice.dateFin.getUTCFullYear();
    if (annee !== undefined && annee !== null && annee > anneeDeCloture) {
      throw new BadRequestException(
        `La première année d'exercice dans le pays (${annee}) ne peut pas suivre l'année où se clôt ` +
          `l'exercice déclaré (${anneeDeCloture}) · fiche R2, case ZP.`,
      );
    }
    const data: Prisma.ExerciceUpdateInput = {};
    if (dto.nombreEtablissementsPays !== undefined) data.nombreEtablissementsPays = dto.nombreEtablissementsPays;
    if (dto.nombreEtablissementsHorsPays !== undefined) {
      data.nombreEtablissementsHorsPays = dto.nombreEtablissementsHorsPays;
    }
    if (dto.premiereAnneeExercicePays !== undefined) data.premiereAnneeExercicePays = dto.premiereAnneeExercicePays;
    if (dto.controleEntreprise !== undefined) data.controleEntreprise = dto.controleEntreprise;
    return this.prisma.exercice.update({ where: { id: exercice.id }, data });
  }

  /**
   * ENTREPRISE DU PORTEFEUILLE DE L'ÉTAT · les deux dates qui font courir les
   * délais de l'O.-L. n° 13/003 (art. 112 · dix jours de l'assemblée ;
   * art. 113 · soixante jours du dépôt au ministère du Portefeuille). Elles
   * ne sont dans aucun livre · DÉCLARÉES, jamais supposées. Un champ absent
   * reste tel quel, `null` efface. Une date antérieure à la clôture est
   * refusée · l'assemblée statue sur un exercice clos, et ses états ne se
   * déposent qu'une fois arrêtés.
   */
  async declarerDatesPortefeuille(tenantId: string, exerciceId: string, dto: DatesPortefeuilleDto) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    // UN JOUR, LU PAR LA RÈGLE COMMUNE (`jourSaisiOuEffacement`) · « 2026-02-30 »
    // devenait le 2 mars, « 20270101 » un 500, et une heure avec fuseau
    // décalait le jour.
    const assemblee = jourSaisiOuEffacement(dto.dateAssembleeGenerale);
    const depot = jourSaisiOuEffacement(dto.dateDepotEtatsPortefeuille);
    const transmission = jourSaisiOuEffacement(dto.dateTransmissionPvPortefeuille);
    const declarationDividende = jourSaisiOuEffacement(dto.dateDeclarationDividendeEtat);
    const notePerception = jourSaisiOuEffacement(dto.dateNotePerceptionDividende);
    const paiementDividende = jourSaisiOuEffacement(dto.datePaiementDividendeEtat);
    // LE DIVIDENDE PRIORITAIRE NE VAUT QUE POUR UNE ENTREPRISE MINIÈRE DU
    // PORTEFEUILLE DÉCLARÉE (arrêté du 10 décembre 2025, art. 3) · ses dates
    // se refusent ailleurs, mais s'effacent toujours (un dossier qui cesse de
    // l'être n'est jamais enfermé avec elles).
    if (declarationDividende || notePerception || paiementDividende) {
      const dossier = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { entreprisePortefeuilleEtat: true, portefeuilleSecteurMinier: true },
      });
      if (dossier.entreprisePortefeuilleEtat !== true || dossier.portefeuilleSecteurMinier !== true) {
        throw new BadRequestException(
          'Le dividende prioritaire de l’État ne vise que les entreprises du portefeuille du secteur minier ' +
            '(arrêté interministériel du 10 décembre 2025, art. 3) · déclarez d’abord ces deux faits dans Paramètres du dossier.',
        );
      }
    }
    // UN DÉPÔT OU UNE COMMUNICATION À VENIR NE SE DÉCLARE PAS (relecture 2),
    // comme la nomination du liquidateur · un fait déclaré lève un jalon, et
    // un fait futur le lèverait avant d'avoir eu lieu. L'assemblée future,
    // elle, est admise · les délais comptés à rebours d'elle en ont besoin,
    // et le planning la dit « prévue » sans rien lever.
    const aujourdHui = jourDeKinshasa(new Date());
    for (const [date, quoi] of [
      [depot, 'Le dépôt des états financiers au ministère du Portefeuille'],
      [transmission, 'La communication du procès-verbal à l’Administration des recettes non fiscales'],
      [declarationDividende, 'La déclaration du dividende prioritaire'],
      [notePerception, 'La réception de la note de perception'],
      [paiementDividende, 'Le paiement du dividende prioritaire'],
    ] as const) {
      if (date && date > aujourdHui) {
        throw new BadRequestException(`${quoi} à venir ne se déclare pas · déclarez-le une fois intervenu.`);
      }
    }
    for (const [date, quoi] of [
      [assemblee, 'L’assemblée générale ordinaire statue sur les résultats d’un exercice clos'],
      [depot, 'Les états financiers se déposent une fois l’exercice clos'],
      [transmission, 'Le procès-verbal se communique après l’assemblée d’un exercice clos'],
    ] as const) {
      if (date && date < exercice.dateFin) {
        throw new BadRequestException(`${quoi} · la date ne peut pas précéder la clôture de l'exercice (O.-L. n° 13/003, art. 112 et 113).`);
      }
    }
    // Le dividende naît du « bénéfice net comptable » de l'exercice (art. 2) ·
    // ni sa déclaration, ni sa note de perception, ni son paiement ne
    // précèdent la clôture.
    for (const [date, quoi] of [
      [declarationDividende, 'La déclaration du dividende prioritaire'],
      [notePerception, 'La note de perception du dividende prioritaire'],
      [paiementDividende, 'Le paiement du dividende prioritaire'],
    ] as const) {
      if (date && date < exercice.dateFin) {
        throw new BadRequestException(
          `${quoi} porte sur le bénéfice net comptable de l’exercice · la date ne peut pas précéder sa clôture ` +
            '(arrêté interministériel du 10 décembre 2025, art. 2).',
        );
      }
    }
    const assembleeApres = assemblee === undefined ? exercice.dateAssembleeGenerale : assemblee;
    const transmissionApres = transmission === undefined ? exercice.dateTransmissionPvPortefeuille : transmission;
    if (assembleeApres && transmissionApres && transmissionApres < assembleeApres) {
      throw new BadRequestException(
        'Le procès-verbal se communique « dans les dix (10) jours qui suivent la tenue » de l’assemblée · sa date ne ' +
          'peut pas précéder celle de l’assemblée (O.-L. n° 13/003, art. 112).',
      );
    }
    const data: Prisma.ExerciceUpdateInput = {};
    if (assemblee !== undefined) data.dateAssembleeGenerale = assemblee;
    if (depot !== undefined) data.dateDepotEtatsPortefeuille = depot;
    if (transmission !== undefined) data.dateTransmissionPvPortefeuille = transmission;
    // L'ORDRE DES DATES (arrêté du 10 décembre 2025, art. 2) · le paiement
    // court de « la réception de la note de perception » et ne la précède
    // pas · lu sur l'état qui résultera de l'enregistrement, refus nommé.
    // UNE NOTE AVANT LA DÉCLARATION EST ADMISE · l'Administration des recettes
    // non fiscales peut taxer d'office le débiteur qui n'a pas déclaré dans le
    // délai (O.-L. n° 13/003, art. 29, « ordonnancement d'office », et art. 89)
    // · refuser cet ordre, que l'arrêté n'écrit pas, perdait le contrôle des
    // huit jours (relecture du 2026-10-07).
    const noteApres = notePerception === undefined ? (exercice.dateNotePerceptionDividende ?? null) : notePerception;
    const paiementApres =
      paiementDividende === undefined ? (exercice.datePaiementDividendeEtat ?? null) : paiementDividende;
    if (noteApres && paiementApres && paiementApres < noteApres) {
      throw new BadRequestException(
        `Le paiement du dividende (${jourFr(paiementApres)}) ne peut pas précéder la réception de la note de ` +
          `perception (${jourFr(noteApres)}) · il se fait « dans les huit jours de la réception de la note de ` +
          'perception » (arrêté interministériel du 10 décembre 2025, art. 2).',
      );
    }
    if (declarationDividende !== undefined) data.dateDeclarationDividendeEtat = declarationDividende;
    if (notePerception !== undefined) data.dateNotePerceptionDividende = notePerception;
    if (paiementDividende !== undefined) data.datePaiementDividendeEtat = paiementDividende;
    return this.prisma.exercice.update({ where: { id: exercice.id }, data });
  }

  /**
   * ARRÊTER L'EXERCICE À LA DATE DE DISSOLUTION (décisions par la loi du
   * 2026-10-07, point 2, et quatrième lot, point 1). La période du 1er janvier
   * à la dissolution est un exercice ARRÊTÉ à cette date · « Les contribuables
   * sont tenus d'arrêter chaque année leurs comptes à la date du 31 décembre,
   * sauf en cas de cession ou de cessation d'activité en cours d'année » (loi
   * n° 23/053, art. 12 al. 1), une cotisation spéciale se règle sur « les
   * résultats de la période pendant laquelle l'activité a été exercée »
   * (art. 13 al. 1), et son bilan est le « bilan avant liquidation » (AUDCIF
   * Titre VIII ch. 40 § 2.1). Le refus de toute fin autre qu'au 31 décembre
   * (`validerArticle7`) cède ici, et ici seulement, à la dissolution DÉCLARÉE.
   *
   * DANS UNE SEULE TRANSACTION (quatrième lot, point 1, `arret-dissolution.ts`)
   * · l'exercice de liquidation est créé du lendemain de la dissolution, ou
   * l'exercice qui suit déjà devient lui (constat 1 · ouvrir N+1 avant de
   * clôturer N est la règle, et OmegaX ne retire pas un exercice) ; chaque
   * écriture datée après la dissolution, au brouillard ou validée, y est
   * rattachée SANS QUE RIEN D'ELLE NE CHANGE (art. 22 · l'exercice n'est pas
   * une donnée protégée, la date l'est) ; les actes de module qui portent
   * l'exercice suivent leur écriture, les clôtures posées sur ces dates
   * suivent leurs dates (constat 11). Chaque mise à jour est unitaire, au
   * journal d'audit. Sérialisable · une écriture passée pendant l'arrêt
   * rejoue le geste ; `EcritureService` relit l'exercice dans sa propre
   * transaction (constat 10).
   */
  async arreterALaDissolution(
    tenantId: string,
    exerciceId: string,
    options: { retirerActesDeLaPeriode?: boolean; userId?: string } = {},
  ) {
    const dossier = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        dateDissolution: true,
        dateClotureLiquidation: true,
        regimeLiquidation: true,
        associeUniquePersonneMorale: true,
        formeJuridiqueSyscohada: true,
      },
    });
    await this.trouverExercice(tenantId, exerciceId);
    const operations = dossier.dateDissolution
      ? await this.prisma.ecriture.count({ where: { tenantId, exerciceId, date: { gt: dossier.dateDissolution } } })
      : 0;
    return avecRetrySerialisable(
      this.prisma,
      async (tx) => {
        const exercice = await tx.exercice.findFirstOrThrow({ where: { id: exerciceId, tenantId } });
        let etat = await lireEtatAvantArret(tx, tenantId, exercice, dossier);
        // LES ACTES DE LA PÉRIODE SE RETIRENT À LA DEMANDE, JAMAIS D'OFFICE
        // (bloquant 1) · avant la règle, qui relit ensuite l'état sans eux.
        // Une écriture négative datée après la dissolution suit sa date avec
        // celle qu'elle annule.
        let actesRetires: string[] = [];
        if (options.retirerActesDeLaPeriode && motifRefusArret({ ...etat.etat, actesDeLaPeriode: [] }) === null) {
          actesRetires = await this.retirerActesDeLaPeriode(tx, tenantId, options.userId ?? 'arret-dissolution', etat.actes);
          if (actesRetires.length) etat = await lireEtatAvantArret(tx, tenantId, exercice, dossier);
        }
        const motif = motifRefusArret(etat.etat);
        if (motif) throw new BadRequestException(motif);
        const dissolution = dossier.dateDissolution!;
        const relevesARevoir = await relevesUnitesOeuvre(tx, tenantId, [exercice.id, ...(etat.posterieurs.length === 1 ? [etat.posterieurs[0].id] : [])]);
        if (etat.etat.sansLiquidation) {
          // AUSCGIE art. 201 al. 4 · aucune liquidation, aucun exercice qui
          // suive (majeur 2) · un exercice postérieur VIDE est retiré, son
          // report provisoire avec lui (un exercice occupé a refusé plus haut).
          for (const p of etat.posterieurs) {
            await retirerANouveauProvisoire(tx, tenantId, p.id);
            await tx.exercice.delete({ where: { id: p.id } });
          }
          const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: dissolution } });
          return {
            exercice: arrete,
            exerciceDeLiquidation: null,
            exercicesRetires: etat.posterieurs.map((p) => periodeLisible(p)),
            ecrituresRattachees: 0,
            actesRattaches: 0,
            cloturesRattachees: 0,
            actesRetires,
            relevesARevoir,
          };
        }
        const lendemain = lendemainDe(dissolution);
        let liquidation: { id: string; dateDebut: Date; dateFin: Date };
        if (etat.posterieurs.length === 1) {
          // L'EXERCICE QUI SUIT DEVIENT L'EXERCICE DE LIQUIDATION (constat 1).
          // Son ouverture provisoire, calculée sur la fin d'avant, se retire
          // (la clôture de l'exercice arrêté la reposera au lendemain de la
          // dissolution) ; une ouverture passée par le cabinet au premier jour
          // ne se déplace pas d'office · nommée, avec son issue.
          const suivant = etat.posterieurs[0];
          const passee = await ouvertureDejaPassee(tx, tenantId, suivant);
          if (passee.ecritures.length > 0) {
            throw new BadRequestException(
              `L'exercice du ${jourFr(suivant.dateDebut)} au ${jourFr(suivant.dateFin)} devient l'exercice de liquidation, ` +
                `et son ouverture passée au ${jourFr(suivant.dateDebut)} (${piecesLisibles(passee.ecritures)}) ne serait plus ` +
                'celle de son premier jour · au brouillard, supprimez-la ; validée, inscrivez-la en négatif (AUDCIF art. 20, ' +
                'al. 2). La clôture de l’exercice arrêté reportera ensuite ses soldes au lendemain de la dissolution.',
            );
          }
          await retirerANouveauProvisoire(tx, tenantId, suivant.id);
          liquidation = await tx.exercice.update({ where: { id: suivant.id }, data: { dateDebut: lendemain } });
        } else {
          // Fin provisoire · la clôture déclarée, sinon la fin d'origine,
          // jamais avant la dernière écriture rattachée · elle se reporte
          // ensuite (`modifierFinDeLiquidation`).
          const derniere = etat.aDeplacer.length ? etat.aDeplacer[etat.aDeplacer.length - 1].date : null;
          let fin =
            dossier.dateClotureLiquidation && dossier.dateClotureLiquidation.getTime() > dissolution.getTime()
              ? dossier.dateClotureLiquidation
              : exercice.dateFin;
          if (derniere && derniere.getTime() > fin.getTime()) fin = derniere;
          liquidation = await tx.exercice.create({ data: { tenantId, dateDebut: lendemain, dateFin: fin } });
        }
        const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: dissolution } });
        const rattachement = await rattacherALExercice(tx, tenantId, {
          depuis: exercice.id,
          vers: liquidation.id,
          ecritures: etat.aDeplacer,
          clotures: { dateLimite: { gt: dissolution } },
          dates: { gt: dissolution },
        });
        return { exercice: arrete, exerciceDeLiquidation: liquidation, ...rattachement, actesRetires, relevesARevoir };
      },
      "Un autre geste a modifié l'exercice pendant l'arrêt · relancez-le.",
      { operations },
    );
  }

  /**
   * ANNULER L'ARRÊT (constat 2 de la relecture · une dissolution mal datée
   * enfermait le dossier, l'arrêt n'ayant pas d'issue). L'exercice arrêté
   * retrouve le 31 décembre de son année (AUDCIF art. 7 al. 2) ; les
   * écritures de l'exercice de liquidation datées jusque-là lui reviennent,
   * leurs actes et leurs clôtures avec elles, rien d'elles ne changeant
   * (quatrième lot, point 1). L'exercice de liquidation recommence au
   * 1er janvier suivant s'il va au-delà, et n'existe plus s'il ne le dépasse
   * pas · il ne porte alors plus rien, et toute autre référence le nomme au
   * refus. Les deux exercices doivent être ouverts.
   */
  async annulerArretDissolution(
    tenantId: string,
    exerciceId: string,
    options: { retirerActesDeLaPeriode?: boolean; userId?: string } = {},
  ) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const { dateDissolution: dissolution } = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { dateDissolution: true },
    });
    if (!dissolution || exercice.dateFin.getTime() !== dissolution.getTime()) {
      throw new BadRequestException('Cet exercice n’est pas arrêté à la date de dissolution déclarée · rien à annuler.');
    }
    const finOrigine = finDOrigineDeLExerciceArrete(dissolution);
    if (finOrigine.getTime() === dissolution.getTime()) {
      throw new BadRequestException('La dissolution tombe un 31 décembre · l’exercice finit à sa date ordinaire, rien à annuler.');
    }
    if (exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException('Cet exercice est clôturé · ses dates ne changent plus.');
    }
    const operations = await this.prisma.ecriture.count({
      where: { tenantId, exercice: { dateDebut: lendemainDe(dissolution) }, date: { lte: finOrigine } },
    });
    return avecRetrySerialisable(
      this.prisma,
      async (tx) => {
        const liquidation = await tx.exercice.findFirst({ where: { tenantId, dateDebut: lendemainDe(dissolution) } });
        const autre = await tx.exercice.findFirst({
          where: {
            tenantId,
            id: { notIn: [exercice.id, ...(liquidation ? [liquidation.id] : [])] },
            dateDebut: { lte: finOrigine },
            dateFin: { gt: dissolution },
          },
          select: { dateDebut: true, dateFin: true },
        });
        if (autre) {
          throw new BadRequestException(
            `L'exercice du ${jourFr(autre.dateDebut)} au ${jourFr(autre.dateFin)} couvre une partie de la période à rendre · ` +
              'une période n’est couverte que par un seul exercice.',
          );
        }
        // LES DEUX PÉRIODES CHANGENT (bloquant 1) · l'exercice arrêté retrouve
        // son année, l'exercice de liquidation la perd ou disparaît · leurs
        // actes calculés sur la période ne suivent pas, ils sont nommés.
        const actesRetires = await this.actesDeLaPeriodeLevesOuRefuses(
          tx,
          tenantId,
          [exercice, ...(liquidation ? [liquidation] : [])],
          options,
        );
        if (!liquidation) {
          const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: finOrigine } });
          return { exercice: arrete, exerciceDeLiquidation: null, ecrituresRattachees: 0, actesRattaches: 0, cloturesRattachees: 0, actesRetires };
        }
        if (liquidation.statut === StatutExercice.CLOTURE) {
          throw new BadRequestException('L’exercice de liquidation est clôturé · l’arrêt ne s’annule plus.');
        }
        const auDela = liquidation.dateFin.getTime() > finOrigine.getTime();
        const finCivileSuivante = new Date(Date.UTC(finOrigine.getUTCFullYear() + 1, 11, 31));
        if (auDela && liquidation.dateFin.getTime() !== finCivileSuivante.getTime()) {
          throw new BadRequestException(
            `L'exercice de liquidation finit le ${jourFr(liquidation.dateFin)} · rendu à l'année civile, il commencerait le ` +
              `${jourFr(lendemainDe(finOrigine))} et devrait finir le ${jourFr(finCivileSuivante)} (AUDCIF art. 7 al. 2). ` +
              'Portez d’abord sa fin à cette date, puis annulez l’arrêt.',
          );
        }
        const passee = await ouvertureDejaPassee(tx, tenantId, liquidation);
        if (passee.ecritures.length > 0) {
          throw new BadRequestException(
            `L'ouverture passée au ${jourFr(liquidation.dateDebut)} dans l'exercice de liquidation (${piecesLisibles(passee.ecritures)}) ` +
              'tomberait au milieu de l’exercice rendu · au brouillard, supprimez-la ; validée, inscrivez-la en négatif ' +
              '(AUDCIF art. 20, al. 2), puis annulez l’arrêt.',
          );
        }
        await retirerANouveauProvisoire(tx, tenantId, liquidation.id);
        const aRendre = await tx.ecriture.findMany({
          where: { tenantId, exerciceId: liquidation.id, date: { lte: finOrigine } },
          select: { id: true, date: true, numeroPiece: true, journal: { select: { code: true } } },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        });
        const arrete = await tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: finOrigine } });
        const rattachement = await rattacherALExercice(tx, tenantId, {
          depuis: liquidation.id,
          vers: exercice.id,
          ecritures: aRendre,
          clotures: { dateLimite: { lte: finOrigine } },
          dates: { lte: finOrigine },
        });
        if (auDela) {
          const suivant = await tx.exercice.update({ where: { id: liquidation.id }, data: { dateDebut: lendemainDe(finOrigine) } });
          return { exercice: arrete, exerciceDeLiquidation: null, exerciceSuivant: suivant, ...rattachement, actesRetires };
        }
        const references = await referencesVers(tx, 'Exercice', liquidation.id, tenantId);
        if (references.length > 0) {
          throw new BadRequestException(
            `L'exercice de liquidation ne porte plus aucune écriture mais reste utilisé (${references.map(libelleReference).join(', ')}) · ` +
              'retirez ces éléments, puis annulez l’arrêt.',
          );
        }
        await tx.exercice.delete({ where: { id: liquidation.id } });
        return { exercice: arrete, exerciceDeLiquidation: null, ...rattachement, actesRetires };
      },
      "Un autre geste a modifié l'exercice pendant l'annulation de l'arrêt · relancez-la.",
      { operations },
    );
  }

  /**
   * DONNER SON EXERCICE DE LIQUIDATION AU DOSSIER REPRIS (constat 13 · la
   * dissolution précède le premier exercice tenu dans OmegaX, et aucun chemin
   * ne lui donnait son exercice unique). L'exercice OUVERT qui suit la
   * dissolution, et lui seul, commence au lendemain de celle-ci (AUDCIF art. 7
   * al. 4) · aucune écriture ne bouge, sa date de début seule change. Refus
   * nommés · un exercice qui contient la dissolution (l'arrêt est le geste),
   * un autre exercice sur la période ou après lui (la liquidation n'en forme
   * qu'un), un exercice antérieur encore ouvert (sa clôture reporterait au
   * nouveau premier jour, à côté de l'ouverture déjà passée).
   */
  async rattacherALaLiquidation(
    tenantId: string,
    exerciceId: string,
    options: { retirerActesDeLaPeriode?: boolean; userId?: string } = {},
  ) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const dossier = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { dateDissolution: true, regimeLiquidation: true, associeUniquePersonneMorale: true, formeJuridiqueSyscohada: true },
    });
    const dissolution = dossier.dateDissolution;
    if (!dissolution || !formeEnLiquidation(dossier.formeJuridiqueSyscohada) || sansLiquidation({ forme: dossier.formeJuridiqueSyscohada, regimeLiquidation: dossier.regimeLiquidation, associeUniquePersonneMorale: dossier.associeUniquePersonneMorale })) {
      throw new BadRequestException(
        'Aucune liquidation n’est déclarée · déclarez la dissolution d’une société ou d’une coopérative dans Paramètres du dossier.',
      );
    }
    const lendemain = lendemainDe(dissolution);
    if (exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException('Cet exercice est clôturé · ses dates ne changent plus.');
    }
    if (exercice.dateDebut.getTime() <= lendemain.getTime()) {
      throw new BadRequestException(
        exercice.dateDebut.getTime() === lendemain.getTime()
          ? 'Cet exercice est déjà l’exercice de liquidation.'
          : `Cet exercice contient la dissolution du ${jourFr(dissolution)} · arrêtez-le à cette date (« Arrêter l’exercice »).`,
      );
    }
    return avecRetrySerialisable(
      this.prisma,
      async (tx) => {
        const autre = await tx.exercice.findFirst({
          where: { tenantId, id: { not: exercice.id }, OR: [{ dateFin: { gte: lendemain } }, { statut: StatutExercice.OUVERT }] },
          orderBy: { dateDebut: 'asc' },
          select: { dateDebut: true, dateFin: true, statut: true },
        });
        if (autre) {
          throw new BadRequestException(
            autre.dateFin.getTime() >= lendemain.getTime()
              ? `L'exercice du ${jourFr(autre.dateDebut)} au ${jourFr(autre.dateFin)} couvre aussi la période de la liquidation · ` +
                  'elle ne forme qu’un exercice (AUDCIF art. 7 al. 4).'
              : `L'exercice du ${jourFr(autre.dateDebut)} au ${jourFr(autre.dateFin)} est encore ouvert · clôturez-le d’abord, ` +
                  'sa clôture reportant ses soldes au premier jour de l’exercice qui suit.',
          );
        }
        // UNE OUVERTURE PASSÉE PAR LE CABINET NE SE DÉPLACE PAS D'OFFICE
        // (relecture du 2026-10-07, mineur 5) · même refus que l'arrêt, qui
        // fait de l'exercice suivant l'exercice de liquidation · au nouveau
        // premier jour, elle ne serait plus celle de son premier jour (AU2).
        const passee = await ouvertureDejaPassee(tx, tenantId, exercice);
        if (passee.ecritures.length > 0) {
          throw new BadRequestException(
            `L'ouverture passée au ${jourFr(exercice.dateDebut)} (${piecesLisibles(passee.ecritures)}) ne serait plus celle du ` +
              `premier jour de l'exercice de liquidation, le ${jourFr(lendemain)} · au brouillard, supprimez-la ; validée, ` +
              'inscrivez-la en négatif (AUDCIF art. 20, al. 2), puis repassez le bilan d’ouverture à cette date.',
          );
        }
        const actesRetires = await this.actesDeLaPeriodeLevesOuRefuses(tx, tenantId, [exercice], options);
        await retirerANouveauProvisoire(tx, tenantId, exercice.id);
        const rattache = await tx.exercice.update({ where: { id: exercice.id }, data: { dateDebut: lendemain } });
        return { ...rattache, actesRetires, relevesARevoir: await relevesUnitesOeuvre(tx, tenantId, [exercice.id]) };
      },
      "Un autre geste a modifié l'exercice · relancez-le.",
    );
  }

  /**
   * LA FIN DE L'EXERCICE DE LIQUIDATION (décision par la loi du 2026-10-07,
   * point 2) · il court jusqu'à la clôture de la liquidation, « quelle que
   * soit sa durée » (AUDCIF art. 7 al. 4), date que nul ne connaît à
   * l'ouverture. Sa fin se REPORTE ou s'AVANCE tant qu'il est ouvert · sans
   * ce geste, une liquidation plus longue que prévu enfermait le dossier
   * (aucune écriture possible au-delà, aucun autre exercice admis sur la
   * période). Mêmes refus que l'arrêt · ni chevauchement d'un autre
   * exercice, ni écriture au-delà de la nouvelle fin.
   */
  async modifierFinDeLiquidation(tenantId: string, exerciceId: string, dto: FinLiquidationDto) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const { dateDissolution } = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { dateDissolution: true },
    });
    if (!estExerciceDeLiquidation(exercice, dateDissolution)) {
      throw new BadRequestException(
        'Seul l’exercice de liquidation, ouvert le lendemain de la dissolution déclarée, voit sa fin reportée ou ' +
          'avancée · tout autre exercice coïncide avec l’année civile (AUDCIF art. 7).',
      );
    }
    if (exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException('Cet exercice est clôturé · ses dates ne changent plus.');
    }
    const fin = jourSaisiOuEffacement(dto.dateFin);
    if (!fin) throw new BadRequestException('La date de fin de l’exercice de liquidation est requise.');
    if (fin.getTime() < exercice.dateDebut.getTime()) {
      throw new BadRequestException(
        `La fin de l'exercice de liquidation ne peut pas précéder son début, le ${jourFr(exercice.dateDebut)}.`,
      );
    }
    return avecRetrySerialisable(this.prisma, async (tx) => {
      const chevauche = await tx.exercice.findFirst({
        where: { tenantId, id: { not: exercice.id }, dateDebut: { lte: fin }, dateFin: { gte: exercice.dateDebut } },
        select: { dateDebut: true, dateFin: true },
      });
      if (chevauche) {
        throw new BadRequestException(
          `L'exercice du ${jourFr(chevauche.dateDebut)} au ${jourFr(chevauche.dateFin)} couvre déjà une partie de ` +
            'cette période · une période n’est couverte que par un seul exercice.',
        );
      }
      const apres = await tx.ecriture.count({ where: { tenantId, exerciceId: exercice.id, date: { gt: fin } } });
      if (apres > 0) {
        throw new BadRequestException(
          `${apres} écriture(s) de l'exercice sont datées après le ${jourFr(fin)} · la fin ne peut pas les laisser ` +
            'hors de leur exercice.',
        );
      }
      return tx.exercice.update({ where: { id: exercice.id }, data: { dateFin: fin } });
    }, "Un autre geste a modifié l'exercice pendant le report de sa fin · relancez-le.");
  }

  private async trouverExercice(tenantId: string, exerciceId: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
    if (!exercice) {
      throw new NotFoundException('Exercice introuvable pour ce tenant');
    }
    return exercice;
  }

  // ---------------------------------------------------------------------
  // Clôtures (Partielle/Totale/Période) · verrouillage de saisie, réversible
  // uniquement pour la Partielle.
  // ---------------------------------------------------------------------

  async clorePartielle(tenantId: string, exerciceId: string, userId: string, dto: ClorePartielleDto) {
    await this.trouverExercice(tenantId, exerciceId);
    const journal = await this.journalService.trouver(tenantId, dto.journalId);
    return this.prisma.cloture.create({
      data: {
        tenantId,
        exerciceId,
        granularite: GranulariteCloture.PARTIELLE,
        journalId: journal.id,
        dateLimite: new Date(dto.dateLimite),
        annulable: true,
        createdBy: userId,
      },
    });
  }

  /**
   * CLÔTURE TOTALE · un journal jusqu'à une date. Le manuel Sage i7 l'illustre
   * par « Clôturer le journal ventes pour le mois de janvier » et « après la
   * clôture, on ne peut ni ajouter les écritures ni supprimer le journal des
   * ventes POUR LE MOIS DE JANVIER » : elle porte sur une période, pas sur la
   * vie entière du journal. Sans date, elle va jusqu'à la fin de l'exercice.
   */
  async cloreTotale(tenantId: string, exerciceId: string, userId: string, dto: CloreTotaleDto) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const journal = await this.journalService.trouver(tenantId, dto.journalId);
    const dateLimite = dto.dateLimite ? new Date(dto.dateLimite) : exercice.dateFin;
    if (dateLimite < exercice.dateDebut || dateLimite > exercice.dateFin) {
      throw new BadRequestException("La date de la clôture totale tombe hors de l'exercice.");
    }
    const dejaClos = await this.prisma.cloture.findFirst({
      where: {
        tenantId,
        journalId: journal.id,
        granularite: GranulariteCloture.TOTALE,
        annuleeAt: null,
        dateLimite: { gte: dateLimite },
      },
    });
    if (dejaClos) {
      throw new ConflictException(
        `Le journal ${journal.code} est déjà clôturé totalement jusqu'au ${dejaClos.dateLimite.toISOString().slice(0, 10)}`,
      );
    }
    return this.prisma.cloture.create({
      data: {
        tenantId,
        exerciceId,
        granularite: GranulariteCloture.TOTALE,
        journalId: journal.id,
        dateLimite,
        annulable: false,
        createdBy: userId,
      },
    });
  }

  /**
   * CLÔTURE DE PÉRIODE · tous les journaux jusqu'à une date, DÉFINITIVE. Elle
   * n'était bornée à rien (audit final F7) · une faute de frappe sur l'année
   * figeait la saisie, le lettrage et la ventilation du dossier entier, sans
   * retour possible. Même borne que la clôture totale : la date tombe dans
   * l'exercice pour lequel on la pose.
   */
  async clorePeriode(tenantId: string, exerciceId: string, userId: string, dto: ClorePeriodeDto) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const dateLimite = new Date(dto.dateLimite);
    if (dateLimite < exercice.dateDebut || dateLimite > exercice.dateFin) {
      throw new BadRequestException(
        "La date de la clôture de période tombe hors de l'exercice. Elle est définitive et fige tous les journaux · " +
          "posez-la depuis l'exercice qui contient cette date.",
      );
    }
    return this.prisma.cloture.create({
      data: {
        tenantId,
        exerciceId,
        granularite: GranulariteCloture.PERIODE,
        journalId: null,
        dateLimite,
        annulable: false,
        createdBy: userId,
      },
    });
  }

  async listerClotures(tenantId: string, exerciceId: string) {
    await this.trouverExercice(tenantId, exerciceId);
    return this.prisma.cloture.findMany({
      where: { tenantId, exerciceId },
      include: { journal: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async annulerCloture(tenantId: string, clotureId: string, userId: string) {
    const cloture = await this.prisma.cloture.findFirst({ where: { id: clotureId, tenantId } });
    if (!cloture) {
      throw new NotFoundException('Clôture introuvable pour ce tenant');
    }
    if (!cloture.annulable) {
      throw new ForbiddenException('Cette clôture est définitive et ne peut pas être annulée (Totale/Période)');
    }
    if (cloture.annuleeAt) {
      throw new ForbiddenException('Cette clôture est déjà annulée');
    }
    return this.prisma.cloture.update({
      where: { id: cloture.id },
      data: { annuleeAt: new Date(), annuleeBy: userId },
    });
  }

  /**
   * Premier jour non clôturé pour ce journal (AUDCIF art. 22, 4°) · voir
   * `report-periode-close.ts`. Toujours une date, jamais `null` : une clôture
   * TOTALE est bornée à sa date limite et se franchit comme les autres, et
   * c'est `date` elle-même quand rien ne la bloque. Le premier jour ouvert
   * peut tomber hors de l'exercice · c'est l'appelant qui refuse alors le
   * report (`EcritureService.controlesDEntree`), lui seul connaissant
   * l'exercice (audit final F209).
   */
  /**
   * Les actes de la période d'exercices dont la période change · retirés à
   * la demande (`retirerActesDeLaPeriode`), puis nommés au refus s'il en reste
   * (bloquant 1, `motifActesDeLaPeriode`). Rend ce qui a été retiré.
   */
  private async actesDeLaPeriodeLevesOuRefuses(
    tx: Prisma.TransactionClient,
    tenantId: string,
    exercices: Array<{ id: string; dateDebut: Date; dateFin: Date }>,
    options: { retirerActesDeLaPeriode?: boolean; userId?: string },
  ): Promise<string[]> {
    let actes = await lireActesDeLaPeriode(tx, tenantId, exercices);
    let retires: string[] = [];
    if (options.retirerActesDeLaPeriode && actes.some((a) => a.retirable)) {
      retires = await this.retirerActesDeLaPeriode(tx, tenantId, options.userId ?? 'arret-dissolution', actes);
      actes = await lireActesDeLaPeriode(tx, tenantId, exercices);
    }
    const motif = motifActesDeLaPeriode(actes);
    if (motif) throw new BadRequestException(motif);
    return retires;
  }

  /**
   * RETIRER LES ACTES DE LA PÉRIODE, à la demande du cabinet (relecture du
   * 2026-10-07, bloquant 1 · AUDCIF art. 59). Seuls ceux qu'aucun geste de
   * leur module n'annule et dont le bien n'est pas sorti (`retirable`) ·
   * l'acte part, et son écriture avec lui · AU BROUILLARD elle se supprime
   * (art. 22, 2°, rien n'est entré au livre-journal, relu dans la
   * transaction) ; VALIDÉE, elle s'inscrit en négatif, validée, à sa date ou
   * au premier jour non clôturé de son journal dans l'exercice (art. 20,
   * al. 2 ; art. 22, 4°), jamais lettrée ni pointée (`motifLignesTenues`).
   * Le cabinet refait ensuite l'acte sur chaque exercice, à sa période.
   */
  private async retirerActesDeLaPeriode(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    actes: ActeDeLaPeriodeLu[],
  ): Promise<string[]> {
    const delegues = tx as unknown as Record<string, { delete: (a: unknown) => Promise<unknown> }>;
    const faits: string[] = [];
    for (const a of actes.filter((x) => x.retirable)) {
      const origine = a.ecritureId
        ? await tx.ecriture.findFirst({
            where: { id: a.ecritureId, tenantId },
            include: { lignes: { include: { ventilations: true } }, journal: true, exercice: true, correction: { select: { id: true } } },
          })
        : null;
      if (origine && origine.statut !== StatutEcriture.BROUILLARD) {
        const tenues = motifLignesTenues(origine.lignes, `l'écriture ${a.piece}`, 'annuler');
        if (tenues) throw new BadRequestException(`${a.libelle} · ${tenues}`);
        if (origine.correction) {
          throw new BadRequestException(`L'écriture ${a.piece} de la ${a.libelle} est déjà inscrite en négatif · retirez l'acte de son module.`);
        }
      }
      await delegues[a.modele].delete({ where: { id: a.id } });
      if (!origine) {
        faits.push(`${a.libelle} (${a.piece}) retirée`);
        continue;
      }
      if (origine.statut === StatutEcriture.BROUILLARD) {
        await tx.ligneEcriture.deleteMany({ where: { ecritureId: origine.id, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
        const { count } = await tx.ecriture.deleteMany({ where: { id: origine.id, tenantId, statut: StatutEcriture.BROUILLARD } });
        if (count !== 1) {
          throw new ConflictException(`L'écriture ${a.piece} a été validée pendant le retrait · relancez le geste.`);
        }
        faits.push(`${a.libelle} (${a.piece}) retirée avec son écriture au brouillard`);
        continue;
      }
      let date = origine.date;
      let dateValeur: Date | null = null;
      const premier = await this.premierJourOuvert(tenantId, origine.journalId, date);
      if (premier.getTime() !== date.getTime()) {
        if (premier > origine.exercice.dateFin) {
          throw new BadRequestException(
            `Le journal ${origine.journal.code} est clôturé jusqu'à la fin de l'exercice · l'écriture ${a.piece} de la ${a.libelle} ` +
              'ne s’y inscrit plus en négatif (AUDCIF art. 22, 4°).',
          );
        }
        dateValeur = date;
        date = premier;
      }
      const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, origine.journal, origine.exerciceId, date, tx);
      const maintenant = new Date();
      const negatif = await tx.ecriture.create({
        data: {
          tenantId,
          exerciceId: origine.exerciceId,
          journalId: origine.journalId,
          numeroPiece,
          date,
          dateValeur,
          libelle: `Annulation (inscription en négatif) · ${origine.libelle}`.slice(0, 250),
          reference: origine.reference,
          createdBy: userId,
          corrigeEcritureId: origine.id,
          motifCorrection:
            'Arrêt de l’exercice à la dissolution · acte calculé sur la période de l’exercice, à refaire sur chaque exercice (AUDCIF art. 59).',
          statut: StatutEcriture.VALIDEE,
          valideeBy: userId,
          valideeAt: maintenant,
          lignes: { create: lignesEnNegatif(origine.lignes) },
        },
        select: { numeroPiece: true },
      });
      faits.push(`${a.libelle} (${a.piece}) annulée par inscription en négatif (${origine.journal.code} n° ${negatif.numeroPiece ?? '·'})`);
    }
    return faits;
  }

  async premierJourOuvert(tenantId: string, journalId: string, date: Date, db?: Prisma.TransactionClient): Promise<Date> {
    return premierJourNonCloture(await this.cloturesApplicables(tenantId, journalId, db), journalId, date);
  }

  /**
   * Lève une ForbiddenException si une clôture active (Partielle ou Totale
   * sur ce journal, Période sur tous) verrouille cette date. Appelé par les
   * contrôles d'entrée d'une pièce (`EcritureService.controlesDEntree`, sauf
   * pour un lot, qui lit `cloturesApplicables` une fois par journal et joue
   * `refuserSiPeriodeClose`), par la réimputation et par la correction en
   * négatif (audit final F209).
   */
  async verifierEcritureAutorisee(tenantId: string, journalId: string, date: Date) {
    refuserSiPeriodeClose(await this.cloturesApplicables(tenantId, journalId), journalId, date);
  }

  /**
   * Les clôtures qui peuvent verrouiller une saisie sur ce journal · les
   * siennes et celles de période, jamais les annulées. Lues UNE fois par
   * journal quand un lot de pièces se contrôle (import, audit final F2).
   */
  // `db` · la transaction de l'appelant, quand il en tient une (relecture du
  // point D, mineur 10 · une seconde connexion prise pendant une transaction
  // ouverte attendait la libération du pool).
  cloturesApplicables(tenantId: string, journalId: string, db?: Prisma.TransactionClient) {
    return (db ?? this.prisma).cloture.findMany({
      where: { tenantId, annuleeAt: null, OR: [{ journalId }, { journalId: null }] },
    });
  }

  /**
   * Compte 13 réel · "131" (solde créditeur) ou "139" (solde débiteur) · il
   * n'existe PAS de compte 130 générique dans le plan SYCEBNL, et le 130 du
   * plan SYSCOHADA (Résultat en instance d'affectation) n'est qu'une
   * possibilité offerte À LA RÉOUVERTURE, pas le compte de clôture. Le compte
   * est choisi par le signe une fois `deltaResultat` connu.
   *
   * Les deux textes énoncent le MÊME fonctionnement, et c'est pour cela que la
   * logique de clôture est commune : le compte 13 est crédité à la clôture par
   * le débit de la classe 7 et des comptes créditeurs de la classe 8, débité
   * par le crédit de la classe 6 et des comptes débiteurs de la classe 8
   * (SYCEBNL, Partie 2 ch. 3, § COMPTE 13 ; AUDCIF, Titre VII § COMPTE 13,
   * Fonctionnement). Seuls les INTITULÉS diffèrent · voir libellesResultat.
   *
   * ⚠️ Trouvé et corrigé lors de l'audit rétroactif "chaque brique ancrée aux
   * référentiels" (docs/plan-de-construction.md §2.6) : la clôture postait
   * jusqu'ici le résultat sur un compte "13000000" fictif, jamais présent
   * dans le plan de comptes officiel SYCEBNL · les vrais comptes 131/139,
   * pourtant déjà seedés (compte-seed.ts), n'étaient jamais utilisés.
   *
   * Ces comptes doivent exister (seedés à l'inscription) · s'ils manquent,
   * c'est une anomalie de configuration du dossier à signaler clairement,
   * pas à corriger silencieusement en recréant un compte hors nomenclature.
   */
  private async trouverCompteResultat(
    tenantId: string,
    tx: Prisma.TransactionClient,
    deficitaire: boolean,
    referentiel: Referentiel,
  ) {
    const mots = libellesResultat(referentiel);
    const numero = deficitaire ? '13900000' : '13100000';
    const intitule = deficitaire ? mots.deficit : mots.excedent;
    const compte = await tx.compte.findUnique({ where: { tenantId_numero: { tenantId, numero } } });
    if (!compte) {
      throw new BadRequestException(
        `Compte ${numero} (${intitule}) introuvable pour ce dossier · nécessaire pour clôturer l'exercice. Le plan de comptes ${mots.plan} de ce dossier semble incomplet ou avoir été modifié.`,
      );
    }
    return compte;
  }

  /**
   * Clôture ANNUELLE de l'exercice : solde les comptes en mode AUCUN (charges,
   * produits, et comptes créditeurs ou débiteurs de la classe 8 · même règle
   * que le fonctionnement officiel du compte 13, skill sycebnl) sur le compte
   * de résultat réel (131 Excédent ou 139 Déficit selon le signe), puis passe
   * le report à-nouveau dans l'exercice suivant (créé s'il n'existe pas
   * encore) selon le mode de chaque compte restant · au SOLDE, son solde, une
   * ligne par devise au cours moyen et le reste en francs ; au DÉTAIL, chaque
   * mouvement non lettré (`report-a-nouveau.ts`). Les deux écritures sont,
   * par construction (partie double), toujours équilibrées · un déséquilibre
   * ici signalerait un défaut du calcul, pas une donnée invalide, d'où
   * l'InternalServerErrorException plutôt qu'un simple rejet de saisie.
   *
   * LA CLÔTURE NE SOLDE PAS LE COMPTE 13, et c'est voulu : le résultat passe
   * au report à-nouveau (mode SOLDE, comme tout compte de bilan), et c'est
   * l'AFFECTATION, décidée par les organes compétents au cours de l'exercice
   * suivant, qui le solde dans celui-ci (`affectation/affectation.service.ts`,
   * contreparties de chaque référentiel dans `regles-affectation.ts`).
   *
   * EXCEPTION, TRANCHÉE PAR LA LOI (simulation sur vraie base du 2026-10-08) ·
   * ce commentaire disait jusque-là que, sans affectation, le résultat « reste
   * sur le 131 ou le 139 et s'y cumule d'exercice en exercice » (audit final
   * F209). C'était contraire aux deux textes · « En fin d'exercice, le
   * résultat de l'exercice précédent non affecté à un compte de réserves et
   * non distribué est viré au compte de report à nouveau » (AUDCIF Titre VII,
   * compte 13 ; même phrase à la fiche SYCEBNL du compte 13). La clôture de
   * N+1 vire donc au report à nouveau (au 103 pour une entité individuelle)
   * ce qui reste au 13 avant l'écriture qui solde les comptes de gestion,
   * dans une écriture de clôture liée, validée
   * (`virement-resultat-non-affecte.ts`) ; une affectation passée avant ne
   * laisse rien à virer. Le cumul faisait sortir le bilan de N+1
   * déséquilibré du résultat de N et rendait l'affectation de N impossible.
   *
   * Le compte 130 « Résultat en instance d'affectation » (1301 bénéfice, 1309
   * perte) existe au plan SYSCOHADA et pas au plan SYCEBNL. L'AUDCIF n'en
   * fait qu'une POSSIBILITÉ offerte à la réouverture des comptes, pas une
   * obligation : ni la clôture ni l'affectation ne l'utilisent
   * (`cloture-vocabulaire.spec.ts` le tient pour la clôture).
   */
  async cloturer(
    tenantId: string,
    exerciceId: string,
    userId: string,
    options: { ouvertureImportee?: ChoixOuvertureImportee; motifConservation?: string } = {},
  ) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    // Le référentiel ne change RIEN à la mécanique de clôture · les deux
    // textes énoncent le même fonctionnement du compte 13. Il commande les
    // seuls intitulés, qui s'impriment au livre-journal.
    const dossier = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        referentiel: true,
        dateDissolution: true,
        regimeLiquidation: true,
        associeUniquePersonneMorale: true,
        dateClotureLiquidation: true,
        formeJuridiqueSyscohada: true,
        systemeComptableSyscohada: true,
        jeuEtatsFinanciersSycebnl: true,
        // Le groupe (siège ou cellule) · le contrôle d'équilibre du bilan
        // admet le 585 des virements entre dossiers (`refuserBilanDesequilibre`).
        dossierMereId: true,
        _count: { select: { cellules: true } },
      },
    });
    const { referentiel } = dossier;
    const mots = libellesResultat(referentiel);
    if (exercice.statut === StatutExercice.CLOTURE) {
      throw new ForbiddenException('Cet exercice est déjà clôturé');
    }
    // L'EXERCICE DE LIQUIDATION SE CLÔTURE À LA CLÔTURE DE LA LIQUIDATION, ET
    // À ELLE SEULE (constat 7 · « la durée des opérations de liquidation est
    // comptée pour un seul exercice », AUDCIF art. 7 al. 4 ; une clôture au
    // 31 décembre « par habitude » en ferait deux). La date déclarée doit être
    // sa fin · les 31 décembre qu'il traverse sont des situations annuelles
    // provisoires, servies par la situation intermédiaire.
    const finDeLiquidation = estExerciceDeLiquidation(exercice, dossier.dateDissolution);
    // SANS LIQUIDATION, L'EXERCICE ARRÊTÉ EST LE DERNIER (majeur 2) · même
    // branche de fin, sans la clôture de liquidation à déclarer.
    const finSansLiquidation = estFinSansLiquidation(exercice, dossier);
    if (finDeLiquidation) {
      const cloture = dossier.dateClotureLiquidation;
      if (!cloture || cloture.getTime() !== exercice.dateFin.getTime()) {
        throw new BadRequestException(
          (cloture
            ? `La clôture de la liquidation est déclarée au ${jourFr(cloture)} et l'exercice de liquidation finit le ${jourFr(exercice.dateFin)} · `
            : `L'exercice de liquidation finit le ${jourFr(exercice.dateFin)} sans clôture de la liquidation déclarée · `) +
            'il ne se clôture qu’à la clôture de la liquidation (AUDCIF art. 7 al. 4), les 31 décembre qu’il traverse ' +
            'étant des situations annuelles provisoires. Déclarez la date de clôture dans Paramètres du dossier et ' +
            'portez la fin de l’exercice à cette date.',
        );
      }
    }

    // LES EXERCICES SE CLÔTURENT DANS L'ORDRE (audit final F6). Clore 2026
    // avant 2025 calculait le report vers 2027 sans les soldes de 2025, puis
    // la clôture de 2025 écrivait son report dans un 2026 déjà clos, que plus
    // rien ne rouvrait · correspondance bilan de clôture / bilan d'ouverture
    // rompue (AUDCIF art. 34, SYCEBNL art. 16, 4), balance bouclée partout.
    const [precedentOuvert, suivantClos] = await Promise.all([
      this.prisma.exercice.findFirst({
        where: { tenantId, dateFin: { lt: exercice.dateDebut }, statut: { not: StatutExercice.CLOTURE } },
        orderBy: { dateDebut: 'asc' },
        select: { dateDebut: true, dateFin: true },
      }),
      this.prisma.exercice.findFirst({
        where: { tenantId, dateDebut: { gt: exercice.dateFin }, statut: StatutExercice.CLOTURE },
        select: { dateDebut: true },
      }),
    ]);
    if (precedentOuvert) {
      throw new BadRequestException(
        `L'exercice ${periodeLisible(precedentOuvert)} n'est pas clôturé. Les exercices se clôturent dans l'ordre : ` +
          'son report à-nouveau fait le bilan d’ouverture de celui-ci.',
      );
    }
    if (suivantClos) {
      throw new BadRequestException(
        "Un exercice postérieur est déjà clôturé : le report à-nouveau de celui-ci ne pourrait plus y entrer.",
      );
    }

    // Rien ne doit rester en brouillard au moment de clôturer : la clôture
    // solde les comptes de gestion et génère le report à-nouveau à partir des
    // soldes du livre-journal. Une écriture restée en brouillard n'y figure
    // pas · elle serait purement et simplement perdue du résultat, et son
    // exercice serait clos avant qu'elle n'ait pu y entrer.
    const enBrouillard = await this.prisma.ecriture.count({
      where: { tenantId, exerciceId, statut: StatutEcriture.BROUILLARD },
    });
    if (enBrouillard > 0) {
      throw new BadRequestException(
        `${enBrouillard} écriture(s) sont encore en brouillard sur cet exercice. Validez-les ou supprimez-les avant ` +
          "de clôturer : la clôture ne lit que le livre-journal, et ce qui reste en brouillard serait perdu du résultat.",
      );
    }

    // L'ÉCART DE CHANGE RÉALISÉ SE CONSTATE DANS SON EXERCICE (décision D3 ·
    // AUDCIF art. 55) · un lettrage dénoué dans sa devise dont l'écart n'est
    // pas passé laisserait le tiers au bilan d'un reste en francs qui n'est
    // plus une créance ni une dette, et le résultat sans sa perte ou son gain.
    // Lu AVANT la transaction, tel que D3 l'a posé · le relire dedans touche
    // à la lecture du report (F185) et sort du périmètre d'A7 (relecture M2).
    const enSouffrance = motifClotureEcartsNonConstates(await ecartsRealisesNonConstates(this.prisma, { tenantId, exerciceId }));
    if (enSouffrance) throw new BadRequestException(enSouffrance);

    await this.refuserBilanDesequilibre(tenantId, exerciceId, dossier, exercice);

    // LE DÉLAI DE LA TRANSACTION SUIT LE NOMBRE DE LETTRAGES PARTIELS À
    // RECONDUIRE (relecture TypeScript, M2) · quelques allers-retours par
    // groupe ; sous le délai par défaut de Prisma (5 s), quelques centaines
    // de partiels faisaient tomber la clôture en 500 à chaque essai, et le
    // dossier restait ENFERMÉ. Comptés avant · ceux de cet exercice et ceux
    // de l'exercice précédent, qu'elle peut reconduire (majeur 4).
    const precedent = await this.prisma.exercice.findFirst({
      where: { tenantId, dateFin: { lt: exercice.dateDebut } },
      orderBy: { dateFin: 'desc' },
      select: { id: true },
    });
    const partielsALire = await this.prisma.lettrage.count({
      where: {
        tenantId,
        statut: StatutLettrage.PARTIEL,
        lignes: { some: { ecriture: { tenantId, exerciceId: { in: [exerciceId, ...(precedent ? [precedent.id] : [])] } } } },
      },
    });

    return avecRetrySerialisable(
      this.prisma,
      async (tx) => {
        // LA DÉPRÉCIATION D'UNE CRÉANCE SE REPREND À LA CLÔTURE (ligne A7,
        // relecture adverse B1 · fiche du compte 49) · une créance perdue ou
        // recouvrée sans revue de l'exercice laisserait au 491 une dépréciation
        // orpheline et le résultat minoré de sa reprise. RELUE DANS LA
        // TRANSACTION DE CLÔTURE (relecture « échecs silencieux », M2) · lue
        // avant, un geste passé entre la lecture et la clôture échappait au refus.
        const orphelines = motifClotureDepreciationsOrphelines(await depreciationsOrphelines(tx, { tenantId, exerciceId }));
        if (orphelines) throw new BadRequestException(orphelines);

        // Tout l'exercice · le brouillard vient d'être refusé plus haut. Les
        // comptes au SOLDE et de gestion sont lus en sommes, ceux au DÉTAIL
        // ligne à ligne (audit final F185, `lireComptesDuReport`).
        let comptes = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId }, referentiel);
        const solde = (c: CompteRan) => auCentime(soldeDuCompte(c));

        // Journal support des écritures générées · on réutilise le journal
        // général existant (code OD, "Opérations diverses") plutôt que
        // d'introduire un 6e type de journal pour ce seul usage.
        const journal =
          (await tx.journal.findFirst({ where: { tenantId, code: 'OD' } })) ??
          (await tx.journal.findFirst({ where: { tenantId, type: TypeJournal.GENERAL } }));
        if (!journal) {
          throw new BadRequestException(
            "Aucun journal de type Général disponible pour enregistrer les écritures de clôture (journal 'OD' attendu).",
          );
        }

        // --- 0. Le résultat de l'exercice précédent non affecté passe au report à nouveau ---
        // AUDCIF Titre VII, compte 13 ; SYCEBNL, fiche du compte 13 (voir
        // l'exception écrite à l'en-tête de cette méthode). Avant l'écriture
        // qui solde les comptes de gestion, rien de l'exercice clos n'est au
        // 13 · ce qui y reste est un résultat antérieur que l'affectation n'a
        // pas soldé. Écriture de clôture LIÉE (drapeau de clôture, distincte du
        // solde des comptes de gestion pour que les états la lisent), validée
        // (AUDCIF art. 22, 2°), passée AVANT ce solde · la relecture qui suit
        // la compte au report, une fois et une seule.
        const virement = await this.virementDuResultatNonAffecte(tx, tenantId, comptes, dossier);
        const messagesVirement: string[] = [];
        if (virement.lignes.length > 0) {
          const numeroPieceVirement = await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceId, exercice.dateFin, tx);
          await tx.ecriture.create({
            data: {
              tenantId,
              exerciceId,
              journalId: journal.id,
              numeroPiece: numeroPieceVirement,
              date: exercice.dateFin,
              libelle: `Résultat de l'exercice précédent non affecté viré au report à nouveau · exercice ${libelleExercice(exercice)}`,
              createdBy: userId,
              estGenereeParCloture: true,
              estSoldeDesComptesDeGestion: false,
              ...validationParLaCloture(userId),
              lignes: { create: virement.lignes },
            },
          });
          comptes = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId }, referentiel);
          if (virement.compteDestination) {
            messagesVirement.push(
              `Résultat de l'exercice précédent non affecté viré au report à nouveau · ${libelleDuSens(referentiel, virement.montant)} de ` +
                `${montantFr(Math.abs(virement.montant))} au compte ${virement.compteDestination} (${articleDuVirement(referentiel)}). ` +
                `AVERTISSEMENT · si l'assemblée en décide une autre affectation, elle reste à passer dans l'exercice suivant depuis le compte ` +
                `${virement.compteDestination}.`,
            );
          }
        }

        // --- 1. Solde des comptes en mode AUCUN (charges/produits) sur le résultat ---
        const comptesAucun = comptes.filter((c) => c.modeReportANouveau === ModeReportANouveau.AUCUN && Math.abs(solde(c)) > EPSILON);
        let totalDebitResultat = 0;
        let totalCreditResultat = 0;
        const lignesCloture: Array<{ compteId: string; debit: number; credit: number; libelle: string }> = [];
        for (const c of comptesAucun) {
          const s = solde(c);
          if (s > 0) {
            lignesCloture.push({ compteId: c.id, debit: 0, credit: s, libelle: `Clôture ${c.numero} · ${c.intitule}` });
            totalDebitResultat += s;
          } else {
            lignesCloture.push({ compteId: c.id, debit: -s, credit: 0, libelle: `Clôture ${c.numero} · ${c.intitule}` });
            totalCreditResultat += -s;
          }
        }

        let deltaResultat = 0;
        let compteResultatId: string | null = null;
        if (lignesCloture.length > 0) {
          // Signe connu AVANT de choisir le compte : débit > crédit sur les
          // comptes de gestion fermés = déficit (compte 139), sinon excédent
          // (compte 131) · voir le commentaire de trouverCompteResultat.
          // Ligne unique nette (pas debit ET credit à la fois sur la même
          // ligne comme l'ancien code le faisait) : plus proche d'une
          // écriture réelle, et évite de gonfler artificiellement les deux
          // colonnes du journal pour ce compte.
          deltaResultat = auCentime(totalDebitResultat - totalCreditResultat);
          // Résultat exactement nul (produits = charges) : ne rien pousser.
          // Une ligne debit: 0, credit: 0 est un mouvement fantôme · elle
          // apparaîtrait au grand livre mais pas à la balance (qui filtre les
          // comptes sans mouvement), et sa contrepartie serait calculée comme
          // si elle était au crédit. Un compte de résultat sans montant n'a
          // de toute façon rien à enregistrer.
          if (Math.abs(deltaResultat) > EPSILON) {
            const compteResultat = await this.trouverCompteResultat(tenantId, tx, deltaResultat > 0, referentiel);
            compteResultatId = compteResultat.id;
            lignesCloture.push({
              compteId: compteResultat.id,
              debit: deltaResultat > 0 ? deltaResultat : 0,
              credit: deltaResultat < 0 ? -deltaResultat : 0,
              libelle: deltaResultat > 0 ? mots.ligneDeficit : mots.ligneExcedent,
            });
          }

          const totalDebit = lignesCloture.reduce((s, l) => s + l.debit, 0);
          const totalCredit = lignesCloture.reduce((s, l) => s + l.credit, 0);
          if (Math.abs(totalDebit - totalCredit) > EPSILON) {
            throw new InternalServerErrorException("Écriture de clôture déséquilibrée · anomalie interne, clôture annulée.");
          }

          const numeroPiece = await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceId, exercice.dateFin, tx);
          await tx.ecriture.create({
            data: {
              tenantId,
              exerciceId,
              journalId: journal.id,
              numeroPiece,
              date: exercice.dateFin,
              libelle: `Clôture des charges/produits · exercice ${libelleExercice(exercice)}`,
              createdBy: userId,
              estGenereeParCloture: true,
              estSoldeDesComptesDeGestion: true,
              // ENTRE VALIDÉE (audit final F4). Calculée sur le seul
              // livre-journal, la clôture ayant refusé tout brouillard, elle
              // ne pouvait plus l'être ensuite : `valider` refuse un exercice
              // clos. Restée au brouillard, elle manquait au livre-journal,
              // et l'affectation, qui ne lit que lui, ne trouvait aucun
              // résultat à affecter.
              ...validationParLaCloture(userId),
              lignes: { create: lignesCloture },
            },
          });
        }

        // LA LIQUIDATION CLÔTURÉE N'A NI EXERCICE SUIVANT NI REPORT (constat 6)
        // · la personnalité morale « subsiste pour les besoins de la
        // liquidation et jusqu'à la publication de la clôture de celle-ci »
        // (AUSCGIE art. 205 ; AUSCOOP art. 184), et « après l'écriture du
        // règlement des associés, tous les comptes de la société sont soldés »
        // (AUDCIF Titre VIII ch. 40 § 2.2.2.3). Un compte encore soldé se DIT,
        // il ne s'efface pas · aucun exercice civil « fantôme » ne le reçoit.
        if (finDeLiquidation || finSansLiquidation) {
          const soldes = new Map<string, { numero: string; solde: number }>();
          for (const c of comptes) {
            if (c.modeReportANouveau === ModeReportANouveau.AUCUN) continue;
            soldes.set(c.id, { numero: c.numero, solde: solde(c) });
          }
          if (compteResultatId && Math.abs(deltaResultat) > EPSILON) {
            const r = soldes.get(compteResultatId);
            if (r) r.solde = auCentime(r.solde + deltaResultat);
            else soldes.set(compteResultatId, { numero: 'résultat', solde: deltaResultat });
          }
          const nonSoldes = [...soldes.values()].filter((c) => Math.abs(c.solde) > EPSILON).map((c) => c.numero).sort();
          const clos = await tx.exercice.update({ where: { id: exerciceId }, data: { statut: StatutExercice.CLOTURE } });
          const liste = `${nonSoldes.slice(0, 20).join(', ')}${nonSoldes.length > 20 ? '…' : ''}`;
          return {
            ...clos,
            virementResultatNonAffecte: virement.compteDestination
              ? { montant: virement.montant, compte: virement.compteDestination }
              : null,
            issueOuverture: [
              ...messagesVirement,
              finSansLiquidation
                ? `Dernier exercice de la société, dissoute sans liquidation le ${jourFr(exercice.dateFin)} · son patrimoine est transmis universellement à l'associé unique personne morale (AUSCGIE art. 201 al. 4) ; aucun exercice ne suit et aucun report à-nouveau n'est passé.` +
                  (nonSoldes.length
                    ? ` ${nonSoldes.length} compte(s) de bilan restent soldés (${liste}) · ils disent ce que la transmission du patrimoine n'a pas encore porté à l'associé, dans la comptabilité duquel ils se reprennent ; aucun texte lu ne fixe l'écriture de la transmission, que le cabinet passe lui-même.`
                    : ' Tous les comptes de bilan sont soldés.')
                : `Liquidation clôturée le ${jourFr(exercice.dateFin)} · aucun exercice ne suit et aucun report à-nouveau n'est passé (AUDCIF art. 7 al. 4 ; AUSCGIE art. 205).` +
                  (nonSoldes.length
                    ? ` ${nonSoldes.length} compte(s) de bilan restent soldés (${liste}) · après le règlement des associés, tous les comptes de la société sont soldés (AUDCIF Titre VIII ch. 40 § 2.2.2.3).`
                    : ' Tous les comptes de bilan sont soldés.'),
            ],
          };
        }

        // --- 2. Report à-nouveau dans l'exercice suivant, selon le mode de chaque compte ---
        let exerciceSuivant = await tx.exercice.findFirst({
          where: { tenantId, dateDebut: { gt: exercice.dateFin } },
          orderBy: { dateDebut: 'asc' },
        });
        // Le report va dans l'exercice qui commence le LENDEMAIN, jamais dans
        // celui d'après un trou (constat G3, `exercice-contigu.ts`).
        if (exerciceSuivant && !estContigu(exercice.dateFin, exerciceSuivant.dateDebut)) {
          throw new BadRequestException(motifSuivantNonContigu(exercice.dateFin, exerciceSuivant));
        }
        if (!exerciceSuivant) {
          refuserSuivantCivilApresDissolution(exercice, dossier);
          /*
            L'EXERCICE SUIVANT EST UNE ANNÉE CIVILE, PAS UNE DURÉE RECOPIÉE.
            La version précédente reportait la durée de l'exercice clos en
            millisecondes : dateFin = (dateFin + 1 jour) + (dateFin - dateDebut).
            Sur deux années de longueur égale le compte tombait juste, et il
            tombait faux dès qu'une année bissextile entrait dans le calcul.
            Clôture de 2023 · l'exercice 2024 se terminait le 30 décembre 2024,
            et une écriture du 31 décembre n'avait plus d'exercice où aller.
            Clôture de 2024 · l'exercice 2025 se terminait le 1er janvier 2026,
            et mordait sur l'exercice suivant. Rien ne le signalait : l'en-tête
            imprime la durée en mois entamés, qui restait douze dans les deux
            cas, et tout l'aval était cohérent avec la mauvaise date.

            L'art. 7 de l'AUDCIF, non exclu par l'art. 3 du SYCEBNL et repris
            mot pour mot au glossaire de celui-ci, ne laisse pas le choix :
            l'exercice coïncide avec l'année civile. Le suivant part donc du
            lendemain de la clôture et va au 31 décembre de son année.
          */
          const { dateDebut, dateFin } = exerciceSuivantApres(exercice.dateFin);
          exerciceSuivant = await tx.exercice.create({ data: { tenantId, dateDebut, dateFin } });
        }

        // Le calcul vit dans report-a-nouveau.ts, partagé avec le report
        // PROVISOIRE · les deux doivent rendre le même report sur le même livre.
        const report = lignesReportANouveau(
          comptes,
          compteResultatId ? { compteId: compteResultatId, montant: deltaResultat } : null,
        );

        // AU2 · UNE OUVERTURE DÉJÀ PASSÉE DANS N+1 (bilan importé) n'est
        // jamais doublée par le report · `issueDeLOuverture` dit ce qui passe.
        const dejaPassee = await ouvertureDejaPassee(tx, tenantId, exerciceSuivant);
        const issue = await issueDeLOuverture(tx, {
          tenantId,
          exerciceId,
          referentiel,
          report,
          dejaPassee,
          choix: options.ouvertureImportee ?? null,
          motifConservation: options.motifConservation ?? null,
        });
        const rectification = issue.rectification;
        const lignesRan = issue.lignes;
        const issueOuverture: string[] = [...issue.messages];

        // Le report provisoire éventuel s'efface devant le définitif, et lui
        // laisse son numéro de pièce · la séquence du journal reste continue.
        // Ce qui y était lettré ou pointé passe sur le définitif (AU1).
        const { numeroPiece: numeroProvisoire, tenues } = await retirerANouveauProvisoire(tx, tenantId, exerciceSuivant.id, {
          reporterLesTenues: true,
        });

        // LES LETTRAGES PARTIELS SE RECONDUISENT (ligne lettrage-cloture ·
        // AUDCIF art. 34, fiches des comptes 40 et 41, voir
        // `lettrage/reconduction-lettrage.ts`). Lus AVANT le report, pour
        // que chaque ligne d'à-nouveau qui reporte une de leurs lignes porte
        // un identifiant connu · la reconduction se pose ensuite sans
        // appariement, et jamais sur l'à-nouveau provisoire, retiré ci-dessus.
        const groupesPartiels: GroupePartielLu[] = [];
        await parcourirGroupesPartiels(tx, { tenantId, exerciceId }, async (lot) => {
          groupesPartiels.push(...lot);
        });
        // LES GROUPES DE L'EXERCICE PRÉCÉDENT JAMAIS RECONDUITS DANS CELUI-CI
        // (relecture « échecs silencieux », majeur 4 · dossier clôturé avant
        // la règle, reconduction délettrée) · lus tant que cet exercice est
        // encore ouvert. Leurs lignes d'à-nouveau toutes libres sont
        // reportées sous un identifiant connu et réunies dans l'exercice
        // suivant (`reconduireLesAnciens`) ; les autres sont NOMMÉS ici, la
        // clôture ne les suivant pas au-delà.
        const anciens = (await groupesNonReconduits(tx, { tenantId, exerciceSuivantId: exerciceId, plafond: Number.MAX_SAFE_INTEGER })).groupes;
        const lignesDesGroupes = new Set([
          ...groupesPartiels.flatMap((g) => g.lignes.map((l) => l.id)),
          ...anciens.filter((g) => g.etat === 'A_RECONDUIRE').flatMap((g) => g.accueil.flatMap((id) => (id ? [id] : []))),
        ]);
        const accueilDe = new Map<string, string>();
        const lignesAEcrire = lignesRan.map((l) => {
          if (!l.origineId || !lignesDesGroupes.has(l.origineId)) return ligneAEcrire(l);
          const id = randomUUID();
          accueilDe.set(l.origineId, id);
          return ligneAEcrire(l, id);
        });

        let lignesCreees: LigneCandidate[] = [];
        if (lignesRan.length > 0) {
          const totalDebit = lignesRan.reduce((s, l) => s + l.debit, 0);
          const totalCredit = lignesRan.reduce((s, l) => s + l.credit, 0);
          if (Math.abs(totalDebit - totalCredit) > EPSILON) {
            throw new InternalServerErrorException(
              "Report à-nouveau déséquilibré · anomalie interne (identité partie double violée), clôture annulée.",
            );
          }
          const numeroPieceRan =
            numeroProvisoire ??
            (await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceSuivant.id, exerciceSuivant.dateDebut, tx));
          const creee = await tx.ecriture.create({
            data: {
              tenantId,
              exerciceId: exerciceSuivant.id,
              journalId: journal.id,
              numeroPiece: numeroPieceRan,
              date: exerciceSuivant.dateDebut,
              libelle: rectification
                ? `Report à-nouveau · ouverture exercice ${libelleExercice(exerciceSuivant)} · rectifie ${piecesLisibles(dejaPassee.ecritures)}`.slice(0, 250)
                : `Report à-nouveau · ouverture exercice ${libelleExercice(exerciceSuivant)}`,
              createdBy: userId,
              estGenereeParCloture: true,
              // La rectification d'un import est une correction d'erreur ·
              // son motif s'écrit, comme celui de toute inscription en négatif.
              ...(rectification
                ? {
                    motifCorrection:
                      `Bilan d'ouverture importé (${piecesLisibles(dejaPassee.ecritures)}) différent du bilan de clôture · ` +
                      `${articleCorrespondance(referentiel)}, AUDCIF art. 20.`,
                  }
                : {}),
              // Validé comme l'écriture de solde, et pour la même raison · il
              // se calcule sur des soldes validés, et resté au brouillard il
              // manquerait au bilan d'ouverture de tous les états légaux.
              ...validationParLaCloture(userId),
              lignes: { create: lignesAEcrire },
            },
            select: { lignes: { select: { id: true, compteId: true, debit: true, credit: true, dateEcheance: true, deviseId: true, montantDevise: true } } },
          });
          lignesCreees = creee.lignes.map((l) => ({
            id: l.id,
            compteId: l.compteId,
            debit: Number(l.debit),
            credit: Number(l.credit),
            dateEcheance: l.dateEcheance,
            deviseId: l.deviseId,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
          }));
        }
        // R6 · chaque négatif lettré avec la ligne qu'il annule, quand les
        // règles du lettrage le permettent.
        if (rectification) {
          issueOuverture.push(...(await lettrerNegatifsAvecLeursOrigines(tx, tenantId, userId, rectification.negatifs, lignesCreees)));
        }
        // Les lignes inscrites en négatif ne reçoivent rien · seules les
        // lignes positives du report, puis les lignes libres de l'ouverture
        // sur les comptes qu'elle porte juste.
        const candidates: LigneCandidate[] = [
          ...lignesCreees.filter((l) => l.debit >= 0 && l.credit >= 0),
          ...dejaPassee.lignes
            .filter((l) => l.lettrageId === null && l.rapprochementId === null && !rectification?.comptesRectifies.includes(l.compteId))
            .map((l) => ({ id: l.id, compteId: l.compteId, debit: l.debit, credit: l.credit, dateEcheance: l.dateEcheance, deviseId: l.deviseId, montantDevise: l.montantDevise })),
        ];
        const reporte = await reporterLesTenues(tx, tenantId, exerciceSuivant.id, tenues, candidates);
        issueOuverture.push(...reporte.messages);

        // LA RECONDUCTION, après le report des tenues (AU1) · une ligne
        // d'à-nouveau qu'une tenue du provisoire a prise n'est plus libre, et
        // le groupe qui la voulait est NOMMÉ, jamais posé à moitié.
        const reconduction = await reconduireLesGroupesPartiels(tx, {
          tenantId,
          userId,
          groupes: groupesPartiels,
          accueilDe,
          // Une ouverture déjà passée qui fait foi sur un compte (AU2,
          // concordante ou conservée) · ses lignes libres reçoivent le groupe,
          // par appariement sûr ou pas du tout.
          ouvertureLibre: dejaPassee.lignes
            .filter((l) => l.lettrageId === null && l.rapprochementId === null && !rectification?.comptesRectifies.includes(l.compteId))
            .map((l) => ({
              id: l.id,
              compteId: l.compteId,
              debit: l.debit,
              credit: l.credit,
              dateEcheance: l.dateEcheance,
              deviseId: l.deviseId,
              montantDevise: l.montantDevise,
              libelle: l.libelle,
            })),
        });
        issueOuverture.push(...messagesDeReconduction(reconduction));
        issueOuverture.push(...(await reconduireLesAnciens(tx, { tenantId, userId, anciens, accueilDe })));

        const clos = await tx.exercice.update({
          where: { id: exerciceId },
          // La conservation déclarée s'écrit avec l'acte qui la fige · au
          // journal d'audit, comme la clôture elle-même.
          data: {
            statut: StatutExercice.CLOTURE,
            ...(reporte.defaits.length > 0 ? { defaitsParLaCloture: reporte.defaits } : {}),
            ...(issue.conservation
              ? { motifOuvertureSuivanteConservee: issue.conservation.motif, ecartsOuvertureSuivanteConservee: issue.conservation.ecarts }
              : {}),
          },
        });
        return {
          ...clos,
          issueOuverture: [...messagesVirement, ...issueOuverture],
          lettragesPartiels: {
            reconduits: reconduction.filter((r) => r.codeReconduit !== null).length,
            nonReconduits: reconduction.filter((r) => r.codeReconduit === null).length,
          },
          virementResultatNonAffecte: virement.compteDestination
            ? { montant: virement.montant, compte: virement.compteDestination }
            : null,
        };
      },
      "Trop d'opérations simultanées sur cet exercice · veuillez réessayer.",
      { operations: operationsDeLaCloture(partielsALire) },
    );
  }

  /**
   * AU2 · LA CONFRONTATION, en lecture seule · le report que la clôture
   * passerait (le même calcul, `lignesReportANouveau`, sur tout l'exercice)
   * contre l'ouverture déjà passée dans l'exercice suivant. Rend les comptes
   * qui diffèrent, et si une déclaration sera demandée (`declarationRequise`).
   */
  async confrontationOuvertureSuivante(tenantId: string, exerciceId: string) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const vide = {
      exerciceSuivant: null as { id: string; dateDebut: Date; dateFin: Date } | null,
      pieces: null as string | null,
      auBrouillard: false,
      ouvertureNulle: false,
      exerciceSansEcriture: false,
      ecarts: [] as EcartNomme[],
      total: 0,
      tronque: false,
      lignesTenues: [] as Array<{ numero: string; piece: string; debit: number; credit: number; lettree: boolean; pointee: boolean }>,
      declarationRequise: false,
      // Ce que la clôture reconduira (ligne lettrage-cloture) · l'aperçu dit
      // la même chose que la clôture, sans rien écrire.
      lettragesPartielsAReconduire: null as { total: number; groupes: Array<{ code: string; compte: string; reste: number }>; annonce: string | null } | null,
    };
    if (exercice.statut === StatutExercice.CLOTURE) return vide;
    const suivant = await this.prisma.exercice.findFirst({
      where: { tenantId, dateDebut: { gt: exercice.dateFin } },
      orderBy: { dateDebut: 'asc' },
      select: { id: true, dateDebut: true, dateFin: true },
    });
    // L'aperçu dit ce que la clôture fera · elle refuse un suivant non
    // contigu (constat G3), il n'annonce donc aucun report vers lui.
    if (!suivant || !estContigu(exercice.dateFin, suivant.dateDebut)) return vide;
    const tx = this.prisma as unknown as Prisma.TransactionClient;
    const dejaPassee = await ouvertureDejaPassee(tx, tenantId, suivant);
    {
      const r = await groupesQueLaClotureReconduira(this.prisma, { tenantId, exerciceId });
      vide.lettragesPartielsAReconduire = { ...r, annonce: annonceDeReconduction(r, { ouvertureDejaPassee: dejaPassee.ecritures.length > 0 }) };
    }
    const dossier = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { referentiel: true, formeJuridiqueSyscohada: true },
    });
    const { referentiel } = dossier;
    if (dejaPassee.ecritures.length === 0) return { ...vide, exerciceSuivant: suivant };
    const base = {
      ...vide,
      exerciceSuivant: suivant,
      pieces: piecesLisibles(dejaPassee.ecritures),
      auBrouillard: dejaPassee.ecritures.some((e) => e.statut === StatutEcriture.BROUILLARD),
    };
    if (ouvertureNulle(dejaPassee.lignes)) return { ...base, ouvertureNulle: true };
    const comptes = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId }, referentiel);
    const delta = resultatDesComptesDeGestion(comptes);
    const resultat =
      Math.abs(delta) > EPSILON ? { compteId: (await this.trouverCompteResultat(tenantId, tx, delta > 0, referentiel)).id, montant: delta } : null;
    // Le report que la clôture passerait · virement du résultat non affecté compris.
    const virement = await this.virementDuResultatNonAffecte(tx, tenantId, comptes, dossier);
    const report = appliquerVirementAuReport(lignesReportANouveau(comptes, resultat), virement.lignes);
    const { ecarts, tenues } = await confrontationNommee(tx, tenantId, report, dejaPassee);
    const ecrituresDeN = await this.prisma.ecriture.count({ where: { tenantId, exerciceId, estSoldeDesComptesDeGestion: false } });
    return {
      ...base,
      exerciceSansEcriture: ecrituresDeN === 0,
      // R9 · bornée, et le total se dit toujours.
      ecarts: ecarts.slice(0, PLAFOND_ECARTS_SERVIS),
      total: ecarts.length,
      tronque: ecarts.length > PLAFOND_ECARTS_SERVIS,
      lignesTenues: tenues.slice(0, PLAFOND_ECARTS_SERVIS),
      declarationRequise: ecarts.length > 0 && ecrituresDeN > 0,
    };
  }

  /**
   * À-NOUVEAUX PROVISOIRES · Sage i7, Traitement / Fin d'exercice / Nouvel
   * exercice « avec génération des reports » : « Le nouvel exercice peut être
   * ouvert dès la fin de l'année courante. Ainsi vous pourrez commencer la
   * saisie des écritures concernant la nouvelle année tout en continuant à
   * saisir sur l'année passée », et « à tout moment, il sera possible de
   * lancer, voir de relancer les reports à nouveaux ».
   *
   * QUATRE RÈGLES. (1) Le calcul est CELUI DE LA CLÔTURE (report-a-nouveau.ts),
   * sur le LIVRE-JOURNAL de l'exercice · ce qui reste au brouillard n'y entre
   * qu'à la relance suivant sa validation, et c'est rendu. (2) Le report reste
   * AU BROUILLARD et ne se valide jamais · relancé, il est remplacé, ce qu'une
   * écriture validée ne permet plus (AUDCIF art. 22, 2°). (3) Une relance est
   * refusée si une ligne du report a été lettrée ou pointée sur le nouvel
   * exercice · « cette correction sera effectuée uniquement sur des écritures
   * non lettrées » (Sage), et le remplacer effacerait ce lettrage sans le dire.
   * (4) La clôture le remplace par le report définitif, même numéro de pièce.
   */
  async genererANouveauxProvisoires(
    tenantId: string,
    exerciceId: string,
    userId: string,
    options: { reporterBudgets?: boolean } = {},
  ) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    if (exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException(
        "Cet exercice est clôturé · son report à-nouveau est DÉFINITIF et a été passé par la clôture.",
      );
    }
    const dossier = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { referentiel: true, dateDissolution: true, regimeLiquidation: true, associeUniquePersonneMorale: true, formeJuridiqueSyscohada: true },
    });
    const { referentiel } = dossier;
    // SANS LIQUIDATION, L'EXERCICE ARRÊTÉ N'A PAS D'EXERCICE SUIVANT (majeur 2).
    if (estFinSansLiquidation(exercice, dossier)) {
      throw new BadRequestException(
        'Cet exercice est le dernier de la société, dissoute sans liquidation · son patrimoine est transmis à l’associé ' +
          'unique personne morale (AUSCGIE art. 201 al. 4), aucun exercice ne suit et aucun report à-nouveau n’est dû.',
      );
    }
    // L'EXERCICE DE LIQUIDATION N'A PAS D'EXERCICE SUIVANT (constat 6) · la
    // société s'éteint à la clôture de la liquidation (AUSCGIE art. 205 ;
    // AUDCIF Titre VIII ch. 40 § 2.2.2.3, « tous les comptes de la société
    // sont soldés »).
    if (estExerciceDeLiquidation(exercice, dossier.dateDissolution)) {
      throw new BadRequestException(
        'L’exercice de liquidation n’a pas d’exercice suivant · la société s’éteint à la clôture de la liquidation, ' +
          'et aucun report à-nouveau n’est dû.',
      );
    }
    const brouillardNonRepris = await this.prisma.ecriture.count({
      where: { tenantId, exerciceId, statut: StatutEcriture.BROUILLARD },
    });
    const resultat = await avecRetrySerialisable(
      this.prisma,
      async (tx) => {
        // Le livre-journal seul · ce qui reste au brouillard est compté à
        // part (`brouillardNonRepris`), jamais lu. Même lecture que la clôture
        // (audit final F185, `lireComptesDuReport`).
        const ran = await lireComptesDuReport(tx, tenantId, { tenantId, exerciceId, statut: StatutEcriture.VALIDEE }, referentiel);
        const journal =
          (await tx.journal.findFirst({ where: { tenantId, code: 'OD' } })) ??
          (await tx.journal.findFirst({ where: { tenantId, type: TypeJournal.GENERAL } }));
        if (!journal) {
          throw new BadRequestException("Aucun journal de type Général disponible pour le report à-nouveau (journal 'OD' attendu).");
        }

        let exerciceSuivant = await tx.exercice.findFirst({
          where: { tenantId, dateDebut: { gt: exercice.dateFin } },
          orderBy: { dateDebut: 'asc' },
        });
        // Même règle que la clôture · jamais au-delà d'un trou (constat G3).
        if (exerciceSuivant && !estContigu(exercice.dateFin, exerciceSuivant.dateDebut)) {
          throw new BadRequestException(motifSuivantNonContigu(exercice.dateFin, exerciceSuivant));
        }
        if (!exerciceSuivant) {
          refuserSuivantCivilApresDissolution(exercice, dossier);
          // Même règle que la clôture · l'exercice suivant est une année civile.
          const { dateDebut, dateFin } = exerciceSuivantApres(exercice.dateFin);
          exerciceSuivant = await tx.exercice.create({ data: { tenantId, dateDebut, dateFin } });
        }
        if (exerciceSuivant.statut === StatutExercice.CLOTURE) {
          throw new BadRequestException("L'exercice suivant est clôturé · il ne reçoit plus de report.");
        }

        const delta = resultatDesComptesDeGestion(ran);
        let resultatCompte: { compteId: string; montant: number } | null = null;
        if (Math.abs(delta) > EPSILON) {
          const compte = await this.trouverCompteResultat(tenantId, tx, delta > 0, referentiel);
          resultatCompte = { compteId: compte.id, montant: delta };
        }
        // Le résultat antérieur non affecté va au report à nouveau, comme la
        // clôture le passera (`virement-resultat-non-affecte.ts`) · le
        // provisoire n'écrit rien dans l'exercice ouvert, il fond le virement
        // dans le report, pour rendre le même report que la clôture.
        const virement = await this.virementDuResultatNonAffecte(tx, tenantId, ran, dossier);
        const report = appliquerVirementAuReport(lignesReportANouveau(ran, resultatCompte), virement.lignes);
        // AU2 · une ouverture déjà passée (bilan importé, validé ou au
        // brouillard) n'est jamais doublée. Le provisoire ne passe RIEN · c'est
        // la clôture qui confronte l'import au bilan de clôture et fait
        // déclarer lequel fait foi (`issueDeLOuverture`) ; un provisoire qui
        // rectifierait d'avance effacerait l'ouverture d'un dossier dont
        // l'exercice précédent n'est tenu que pour les comparatifs.
        const dejaPassee = await ouvertureDejaPassee(tx, tenantId, exerciceSuivant);
        // Une ouverture nulle (import entièrement annulé) n'en est plus une (R10).
        const ecartsOuverture =
          dejaPassee.ecritures.length > 0 && !ouvertureNulle(dejaPassee.lignes) ? confrontationDeLOuverture(report, dejaPassee.lignes) : null;
        const lignes = ecartsOuverture ? [] : report;
        const debit = lignes.reduce((t, l) => t + l.debit, 0);
        const credit = lignes.reduce((t, l) => t + l.credit, 0);
        if (Math.abs(debit - credit) > EPSILON) {
          throw new InternalServerErrorException('Report à-nouveau provisoire déséquilibré · anomalie interne, rien n’a été passé.');
        }

        const { numeroPiece: numeroProvisoire } = await retirerANouveauProvisoire(tx, tenantId, exerciceSuivant.id);
        // LE PROVISOIRE DIT CE QUE LA CLÔTURE RECONDUIRA (ligne
        // lettrage-cloture) · il ne se lettre par aucun chemin (AU1), et ses
        // lignes ne reçoivent donc aucun groupe · la même lecture que la
        // clôture, annoncée.
        const aReconduire = await groupesQueLaClotureReconduira(tx, { tenantId, exerciceId });
        if (lignes.length > 0) {
          const numeroPiece =
            numeroProvisoire ??
            (await this.journalService.prochainNumeroPiece(tenantId, journal, exerciceSuivant.id, exerciceSuivant.dateDebut, tx));
          await tx.ecriture.create({
            data: {
              tenantId,
              exerciceId: exerciceSuivant.id,
              journalId: journal.id,
              numeroPiece,
              date: exerciceSuivant.dateDebut,
              libelle: `Report à-nouveau PROVISOIRE · ouverture exercice ${libelleExercice(exerciceSuivant)}`,
              createdBy: userId,
              estGenereeParCloture: true,
              estANouveauProvisoire: true,
              lignes: { create: lignes.map((l) => ligneAEcrire(l)) },
            },
          });
        }
        return {
          exerciceSuivantId: exerciceSuivant.id,
          lignes: lignes.length,
          resultat: delta,
          lettragesPartielsAReconduire: { ...aReconduire, annonce: annonceDeReconduction(aReconduire, { ouvertureDejaPassee: dejaPassee.ecritures.length > 0 }) },
          // Ce que le provisoire a fait d'une ouverture déjà passée · null sans elle.
          ouvertureDejaPassee: ecartsOuverture
            ? { pieces: piecesLisibles(dejaPassee.ecritures), comptesDivergents: ecartsOuverture.length }
            : null,
        };
      },
      "Trop d'opérations simultanées sur cet exercice · veuillez réessayer.",
    );

    const budgets = options.reporterBudgets ? await this.reporterBudgets(tenantId, exerciceId) : null;
    return { ...resultat, brouillardNonRepris, budgetsReportes: budgets?.reportes ?? null };
  }

  /**
   * REPORT DES BUDGETS sur l'exercice suivant (Sage i7) · voir
   * `budgetsAReporter` : rien n'est écrasé, aucune convention close n'est
   * dotée. L'exercice suivant doit exister · on ne le crée pas pour un budget.
   */
  async reporterBudgets(tenantId: string, exerciceId: string) {
    const exercice = await this.trouverExercice(tenantId, exerciceId);
    const suivant = await this.prisma.exercice.findFirst({
      where: { tenantId, dateDebut: { gt: exercice.dateFin } },
      orderBy: { dateDebut: 'asc' },
    });
    if (!suivant) throw new BadRequestException("L'exercice suivant n'existe pas encore · ouvrez-le avant d'y reporter les budgets.");
    if (!estContigu(exercice.dateFin, suivant.dateDebut)) {
      throw new BadRequestException(motifSuivantNonContigu(exercice.dateFin, suivant));
    }
    // Un budget ne se dépose pas sur un exercice clôturé (audit final F143).
    refuserSiExerciceBudgetaireClos(suivant.statut);
    const [budgets, dejaDotes, sections] = await Promise.all([
      this.prisma.budgetSection.findMany({ where: { exerciceId, section: { tenantId } } }),
      this.prisma.budgetSection.findMany({ where: { exerciceId: suivant.id, section: { tenantId } } }),
      this.prisma.sectionAnalytique.findMany({ where: { tenantId }, select: { id: true, dateFin: true } }),
    ]);
    const closes = new Set(sections.filter((x) => x.dateFin && x.dateFin < suivant.dateDebut).map((x) => x.id));
    const aReporter = budgetsAReporter(
      budgets.map((b) => ({ sectionId: b.sectionId, mois: b.mois, montant: Number(b.montant) })),
      dejaDotes,
      closes,
    );
    if (aReporter.length) {
      await this.prisma.budgetSection.createMany({
        data: aReporter.map((b) => ({ sectionId: b.sectionId, exerciceId: suivant.id, mois: b.mois, montant: b.montant })),
      });
    }
    return { reportes: aReporter.length, dejaDotes: dejaDotes.length, sectionsCloses: closes.size };
  }
}

/**
 * CE QUE LE REPORT LIT D'UNE LIGNE AU DÉTAIL, ET RIEN DE PLUS (audit final
 * F185) · la clôture chargeait chaque ligne avec son écriture ENTIÈRE, dans
 * une transaction qui tient déjà tout l'exercice. `versLigneRan` le vérifie
 * au typage.
 */
const SELECT_LIGNE_RAN = {
  debit: true,
  credit: true,
  lettre: true,
  libelle: true,
  dateEcheance: true,
  deviseId: true,
  montantDevise: true,
  coursApplique: true,
  ecriture: { select: { libelle: true } },
} satisfies Prisma.LigneEcritureSelect;

/** Une ligne au DÉTAIL, au format du calcul partagé. */
function versLigneRan(l: {
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  lettre: string | null;
  libelle: string | null;
  dateEcheance: Date | null;
  // Exigés · un report qui oublierait la devise sortirait la position de la
  // réévaluation de l'exercice suivant (audit final F55).
  deviseId: string | null;
  montantDevise: Prisma.Decimal | null;
  coursApplique: Prisma.Decimal | null;
  ecriture: { libelle: string };
}): LigneLueRan {
  return {
    debit: Number(l.debit),
    credit: Number(l.credit),
    lettre: l.lettre,
    libelle: l.libelle ?? l.ecriture.libelle,
    dateEcheance: l.dateEcheance,
    deviseId: l.deviseId,
    montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
    coursApplique: l.coursApplique === null ? null : Number(l.coursApplique),
  };
}

/**
 * LA LECTURE DU REPORT, UNE FOIS POUR LA CLÔTURE ET LE PROVISOIRE (audit final
 * F185). Les deux lisaient toutes les lignes de l'exercice, compte par compte,
 * y compris celles des comptes au SOLDE et de gestion, dont le calcul ne garde
 * que des sommes · un dossier chargé montait l'exercice entier en mémoire dans
 * une transaction sérialisable.
 *
 *  · AU SOLDE ET EN GESTION, LA BASE REND LES SOMMES. Débit et crédit de
 *    chaque compte ; et ses lignes en devise, par devise et par SENS · le sens
 *    se lit sur CHAQUE ligne (débit supérieur ou égal au crédit), par une
 *    référence de champ, parce que le montant en devise est gardé sans signe
 *    et qu'une ligne inscrite en négatif le retranche. Une ligne n'y est en
 *    devise que si elle nomme sa devise ET porte un montant en devise non nul,
 *    la définition de `sommesDesLignes`.
 *  · AU DÉTAIL, LES LIGNES, par tranches (`lireParLots`) · chaque mouvement
 *    non lettré est reporté un à un. Les lettrées restent en base, puisque le
 *    report les écarte ; une lettre vide n'y vaut pas lettre, comme au calcul.
 *    CHAQUE EXERCICE SE LIT POUR LUI-MÊME (A6 bis, premier tour, règle 1 de
 *    `lettrage/lettrages-a-cheval.ts`) · une ligne lettrée par un groupe qui
 *    touche un AUTRE exercice se lit comme NON lettrée · sa lettre dit
 *    qu'elle se solde avec une ligne d'ailleurs, pas dans cet exercice.
 *    L'écarter laissait le report déséquilibré (la clôture tombait en 500),
 *    et le refus qui l'avait remplacé enfermait le dossier dès que le groupe
 *    était figé. Lue ainsi, la ligne est reportée et le report s'équilibre,
 *    figé ou non, sans rien délettrer.
 *
 * Le report rendu est le même, au centime, que celui de la lecture ligne à
 * ligne (`report-a-nouveau-agrege.spec.ts` confronte les deux sur un même
 * jeu). `ecriture` porte le périmètre de l'appelant · l'exercice entier à la
 * clôture, le livre-journal seul au provisoire · et nomme toujours l'exercice
 * lu, contre lequel un groupe « touche un autre exercice ».
 */
async function lireComptesDuReport(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ecriture: Prisma.EcritureWhereInput & { tenantId: string; exerciceId: string },
  // Constat N5 des cas chiffrés de la clôture · au SYCEBNL, les
  // contributions volontaires en nature (90, 91) ne se reportent jamais
  // (`horsDuReport`), quel que soit le mode du compte.
  referentiel: 'SYSCOHADA' | 'SYCEBNL',
): Promise<CompteRan[]> {
  // « Non nul » en deux bornes strictes plutôt qu'un NOT · une comparaison
  // à NULL n'est ni vraie ni fausse en SQL, et c'est ce que `gt` et `lt`
  // écartent sans ambiguïté, comme `!montantDevise` au calcul.
  const enDevise = {
    ecriture,
    deviseId: { not: null },
    OR: [{ montantDevise: { gt: 0 } }, { montantDevise: { lt: 0 } }],
  } satisfies Prisma.LigneEcritureWhereInput;
  const credit = tx.ligneEcriture.fields.credit;
  const [plan, totaux, positifs, negatifs] = await Promise.all([
    tx.compte.findMany({
      where: { tenantId },
      select: { id: true, numero: true, intitule: true, modeReportANouveau: true },
      orderBy: { numero: 'asc' },
    }),
    tx.ligneEcriture.groupBy({ by: ['compteId'], where: { ecriture }, _sum: { debit: true, credit: true } }),
    tx.ligneEcriture.groupBy({
      by: ['compteId', 'deviseId'],
      where: { ...enDevise, debit: { gte: credit } },
      _sum: { debit: true, credit: true, montantDevise: true },
    }),
    tx.ligneEcriture.groupBy({
      by: ['compteId', 'deviseId'],
      where: { ...enDevise, debit: { lt: credit } },
      _sum: { debit: true, credit: true, montantDevise: true },
    }),
  ]);

  const nombre = (x: Prisma.Decimal | null) => (x === null ? 0 : Number(x));
  const sommes = new Map<string, SommesRan>();
  const sommesDe = (compteId: string) => {
    const s = sommes.get(compteId) ?? { debit: 0, credit: 0, enDevise: [] };
    sommes.set(compteId, s);
    return s;
  };
  for (const t of totaux) {
    const s = sommesDe(t.compteId);
    s.debit = nombre(t._sum.debit);
    s.credit = nombre(t._sum.credit);
  }
  for (const [groupes, sens] of [
    [positifs, 1],
    [negatifs, -1],
  ] as const) {
    for (const g of groupes) {
      if (!g.deviseId) continue;
      sommesDe(g.compteId).enDevise.push({
        deviseId: g.deviseId,
        sens,
        debit: nombre(g._sum.debit),
        credit: nombre(g._sum.credit),
        montantDevise: nombre(g._sum.montantDevise),
      });
    }
  }

  const lignes = new Map<string, LigneLueRan[]>();
  await lireParLots(
    (curseur) =>
      tx.ligneEcriture.findMany({
        where: {
          ecriture,
          compte: { modeReportANouveau: ModeReportANouveau.DETAIL },
          OR: [
            { lettre: null },
            { lettre: '' },
            // Lettrée par un groupe qui touche un autre exercice · se lit non lettrée.
            { lettrage: { lignes: { some: { ecriture: { tenantId: ecriture.tenantId, exerciceId: { not: ecriture.exerciceId } } } } } },
          ],
        },
        select: { id: true, compteId: true, ...SELECT_LIGNE_RAN },
        ...pageApres(curseur, LOT_LECTURE),
      }),
    (l) => {
      const duCompte = lignes.get(l.compteId) ?? [];
      // Toute ligne rendue ici est reportée · la lettre d'un groupe à cheval
      // ne vaut pas pour le report de son exercice (règle 1).
      duCompte.push({ ...versLigneRan(l), id: l.id, lettre: null });
      lignes.set(l.compteId, duCompte);
    },
    LOT_LECTURE,
  );

  return plan.filter((c) => !horsDuReport(c.numero, referentiel)).map((c) =>
    c.modeReportANouveau === ModeReportANouveau.DETAIL
      ? { ...c, lignes: lignes.get(c.id) ?? [] }
      : { ...c, sommes: sommes.get(c.id) ?? { debit: 0, credit: 0, enDevise: [] } },
  );
}

/**
 * LA RECONDUCTION DES LETTRAGES PARTIELS dans la transaction de clôture
 * (ligne lettrage-cloture, voir `lettrage/reconduction-lettrage.ts`). Chaque
 * groupe reçoit ses lignes d'à-nouveau · par l'identifiant posé au report
 * (`accueilDe`), sinon, sur un compte où l'ouverture déjà passée fait foi
 * (AU2), par un appariement sûr (`apparierAuReport`). Une ligne sans accueil,
 * ou prise entre-temps, laisse le groupe NON reconduit, et l'issue le dit.
 */
async function reconduireLesGroupesPartiels(
  tx: Prisma.TransactionClient,
  p: {
    tenantId: string;
    userId: string;
    groupes: GroupePartielLu[];
    accueilDe: Map<string, string>;
    ouvertureLibre: LigneDAccueil[];
  },
): Promise<IssueReconduction[]> {
  const issues: IssueReconduction[] = [];
  const codes = new Map<string, () => string>();
  const prises = new Set<string>();
  for (const g of p.groupes) {
    let accueil: (string | null)[] = g.lignes.map((l) => p.accueilDe.get(l.id) ?? null);
    if (accueil.every((a) => a === null)) {
      accueil = apparierAuReport(
        g.lignes.map((l) => ({ ...l, compteNumero: g.compte.numero })),
        p.ouvertureLibre.filter((c) => !prises.has(c.id)),
      );
    }
    const groupeN = { id: g.id, code: g.code, compte: g.compte.numero, reste: resteDuGroupe(g) };
    if (accueil.some((a) => a === null)) {
      issues.push({
        groupeN,
        codeReconduit: null,
        motif: "une de ses lignes n'a pas de ligne d'à-nouveau qui la reporte telle quelle (ouverture passée à part, sans équivalent sûr)",
      });
      continue;
    }
    accueil.forEach((a) => prises.add(a!));
    if (!codes.has(g.compteId)) codes.set(g.compteId, await prochaineLettreDuCompte(tx, p.tenantId, g.compteId));
    const pose = await poserGroupeReconduit(tx, {
      tenantId: p.tenantId,
      groupe: g,
      accueil: accueil as string[],
      userId: p.userId,
      code: codes.get(g.compteId)!(),
    });
    issues.push({ groupeN, codeReconduit: pose.code, motif: pose.motif });
  }
  return issues;
}

/**
 * LES GROUPES DE N-1 JAMAIS RECONDUITS EN N, À LA CLÔTURE DE N (relecture
 * « échecs silencieux », majeur 4). Sans elle, ils n'étaient nommés que tant
 * que N restait ouvert · la clôture de N passait sans un mot, et en N+1 la
 * facture se lisait due en entier. Un groupe dont les lignes d'à-nouveau de N
 * étaient toutes libres (`A_RECONDUIRE`) suit · leurs reports en N+1 portent
 * l'identifiant posé au report (`accueilDe`), et le groupe s'y repose, lié au
 * groupe de N-1 · rien n'est apparié au hasard. Les autres (lignes lettrées
 * ailleurs, introuvables) sont NOMMÉS dans l'issue de la clôture, avec ce
 * qu'il faut faire · la clôture ne les suit pas au-delà, faute d'un lien sûr.
 */
async function reconduireLesAnciens(
  tx: Prisma.TransactionClient,
  p: { tenantId: string; userId: string; anciens: GroupeNonReconduit[]; accueilDe: Map<string, string> },
): Promise<string[]> {
  const messages: string[] = [];
  let codes: (() => string) | null = null;
  let compteDesCodes: string | null = null;
  for (const g of p.anciens) {
    const tete =
      `Lettrage partiel ${g.code} de l'exercice ouvert le ${g.exerciceDebut.toISOString().slice(0, 10)} (compte ${g.compteNumero}, ` +
      `reste ${resteLisible(g.reste)}), jamais reconduit dans l'exercice qui se clôture`;
    const accueil = g.etat === 'A_RECONDUIRE' ? g.accueil.map((id) => (id ? (p.accueilDe.get(id) ?? null) : null)) : [];
    if (g.etat !== 'A_RECONDUIRE' || accueil.some((a) => a === null)) {
      messages.push(
        `${tete} · ${detailNonReconduit(g)} · la clôture ne le suit pas dans l'exercice suivant · relettrez-y ses lignes à la main ` +
          'avant de régler la facture, qui s’y lirait due en entier.',
      );
      continue;
    }
    if (compteDesCodes !== g.compteId) {
      codes = await prochaineLettreDuCompte(tx, p.tenantId, g.compteId);
      compteDesCodes = g.compteId;
    }
    const pose = await poserGroupeReconduit(tx, {
      tenantId: p.tenantId,
      groupe: { id: g.lettrageId, code: g.code.toUpperCase(), compteId: g.compteId, ecartChange: g.ecartChange },
      accueil: accueil as string[],
      userId: p.userId,
      code: codes!(),
    });
    messages.push(
      pose.code
        ? `${tete} · ses lignes d'à-nouveau sont reportées et réunies par cette clôture dans l'exercice suivant (lettrage ${pose.code.toLowerCase()}).`
        : `${tete} · ${pose.motif} · relettrez ses lignes à la main dans l'exercice suivant avant de régler la facture.`,
    );
  }
  return messages;
}

/**
 * Retire le report PROVISOIRE d'un exercice et rend son numéro de pièce, pour
 * que le report suivant le reprenne.
 *
 * À LA RELANCE (`reporterLesTenues` faux), il refuse s'il a été lettré ou
 * pointé · le remplacer par un autre provisoire effacerait ce travail sans le
 * dire, et « cette correction sera effectuée uniquement sur des écritures non
 * lettrées » (Sage i7). La relance n'est jamais nécessaire · la clôture, elle,
 * l'est.
 *
 * À LA CLÔTURE (`reporterLesTenues` vrai, AU1), il ne refuse plus · il rend
 * les lignes lettrées ou pointées, que la clôture reporte sur la ligne
 * définitive qui les remplace (`reporterLesTenues`). Le refus enfermait N dès
 * qu'une clôture de période de N+1 avait figé le lettrage · délettrage refusé
 * (ligne figée), clôture refusée (« délettrez-les »), et l'art. 22, 3°
 * impose cette clôture de période au moins chaque trimestre.
 */
async function retirerANouveauProvisoire(
  tx: Prisma.TransactionClient,
  tenantId: string,
  exerciceId: string,
  options: { reporterLesTenues?: boolean } = {},
): Promise<{ numeroPiece: number | null; tenues: LigneTenue[] }> {
  const provisoire = await tx.ecriture.findFirst({
    where: { tenantId, exerciceId, estANouveauProvisoire: true },
    include: {
      lignes: {
        select: {
          id: true,
          compteId: true,
          debit: true,
          credit: true,
          dateEcheance: true,
          deviseId: true,
          montantDevise: true,
          lettre: true,
          lettrageId: true,
          rapprochementId: true,
          ligneReleveId: true,
        },
      },
    },
  });
  if (!provisoire) return { numeroPiece: null, tenues: [] };
  // Soldé OU partiel (audit final F50, lettrage/ligne-lettree.ts).
  const tenues = provisoire.lignes.filter((l) => estTenueParUnLettrage(l) || l.rapprochementId);
  if (tenues.length > 0 && !options.reporterLesTenues) {
    throw new BadRequestException(
      "Des lignes du report à-nouveau provisoire ont été lettrées ou pointées sur le nouvel exercice · délettrez-les " +
        "(ou dépointez-les) avant de relancer le report. Le remplacer effacerait ce travail sans le dire. " +
        "La clôture de l'exercice précédent, elle, reporte ce lettrage sur l'à-nouveau définitif.",
    );
  }
  // Le gel se lit AVANT le retrait (R5) · une ligne pointée sans équivalent
  // ne se dépointe plus si une clôture la fige.
  const figees = tenues.length > 0 ? await lignesFigees(tx, tenantId, tenues.map((l) => l.id)) : new Map();
  await tx.ligneEcriture.deleteMany({ where: { ecritureId: provisoire.id } });
  await tx.ecriture.delete({ where: { id: provisoire.id } });
  return {
    numeroPiece: provisoire.numeroPiece,
    tenues: tenues.map((l) => ({
      figee: figees.has(l.id),
      compteId: l.compteId,
      debit: Number(l.debit),
      credit: Number(l.credit),
      dateEcheance: l.dateEcheance,
      deviseId: l.deviseId,
      montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
      lettre: l.lettre,
      lettrageId: l.lettrageId,
      rapprochementId: l.rapprochementId,
      ligneReleveId: l.ligneReleveId,
    })),
  };
}

/**
 * AU1 · LE LETTRAGE ET LE POINTAGE DU PROVISOIRE PASSENT SUR LE DÉFINITIF
 * (`apparierTenues`). Candidates · les lignes du report définitif qui vient
 * d'être passé, puis les lignes LIBRES de l'ouverture déjà passée sur un
 * compte qu'elle porte juste (AU2 · un compte concordant ne reçoit aucune
 * ligne du report, et c'est sa ligne d'ouverture qui fait foi).
 *
 * UNE TENUE SANS ÉQUIVALENT SÛR (le livre de N a changé depuis le provisoire,
 * ou l'appariement serait une devinette, R3) · son lettrage ou son pointage
 * est DÉFAIT (second tour, décision du coordinateur sur R4 et R5). Le
 * laisser partiel, ou refuser la clôture, enfermait N ou laissait un
 * règlement rattaché à rien. C'est permis · le gel du lettrage par une
 * clôture de période est une lecture d'OmegaX (les manuels Sage ne disent
 * non modifiables que les JOURNAUX), l'AUDCIF art. 22, 2° rend irréversibles
 * les ÉCRITURES validées et non le lettrage, et la ligne provisoire n'a jamais
 * été au livre-journal. Le délettrage ne vise QUE le groupe qui portait la
 * ligne disparue, se fait dans la transaction de clôture, est écrit sur
 * l'exercice (`defaitsParLaCloture`, journal d'audit, avec son motif) comme
 * la suppression du groupe, et les lignes défaites sont marquées « à
 * relettrer » (`aRelettrerDepuis`) · le pré-lettrage PROPOSE leur relettrage,
 * jamais posé d'office, et la déclaration de TVA les NOMME tant qu'elles ne
 * le sont pas. Un pointage défait · la ligne quitte son rapprochement, nommée.
 */
async function reporterLesTenues(
  tx: Prisma.TransactionClient,
  tenantId: string,
  exerciceSuivantId: string,
  tenues: LigneTenue[],
  candidates: LigneCandidate[],
): Promise<{ messages: string[]; defaits: Prisma.InputJsonValue[] }> {
  if (tenues.length === 0) return { messages: [], defaits: [] };
  const messages: string[] = [];
  const defaits: Prisma.InputJsonValue[] = [];
  const cibles = apparierTenues(tenues, candidates);
  const orphelins = new Map<string, LigneTenue[]>();
  const pointees = tenues.filter((t, i) => cibles[i] === null && t.rapprochementId);
  const rapprochements = pointees.length
    ? await tx.rapprochementBancaire.findMany({
        where: { tenantId, id: { in: pointees.map((t) => t.rapprochementId!) } },
        select: { id: true, statut: true, dateReleve: true, compte: { select: { numero: true } } },
      })
    : [];
  const rapprochement = new Map(rapprochements.map((r) => [r.id, r]));
  const MOTIF = "ligne d'à-nouveau provisoire remplacée par la clôture sans équivalent sûr dans le report définitif";
  for (let i = 0; i < tenues.length; i++) {
    const t = tenues[i];
    const cible = cibles[i];
    if (cible) {
      await tx.ligneEcriture.update({
        where: { id: cible },
        data: { lettre: t.lettre, lettrageId: t.lettrageId, rapprochementId: t.rapprochementId, ligneReleveId: t.ligneReleveId },
      });
      continue;
    }
    if (t.rapprochementId) {
      const r = rapprochement.get(t.rapprochementId);
      const releve = r ? ` du relevé du ${r.dateReleve.toISOString().slice(0, 10)}` : '';
      defaits.push({ type: 'POINTAGE', compte: r?.compte.numero ?? null, releve: r?.dateReleve.toISOString().slice(0, 10) ?? null, montant: t.debit - t.credit, motif: MOTIF });
      messages.push(
        `Pointage défait · la ligne d'à-nouveau provisoire (${montantLisible(t)}) quitte le rapprochement${releve}` +
          `${r?.statut === StatutRapprochement.CLOTURE ? ' (clos)' : ''}, sans équivalent sûr dans le report définitif · pointez la ligne d'à-nouveau définitif s'il y a lieu.`,
      );
    }
    if (t.lettrageId) orphelins.set(t.lettrageId, [...(orphelins.get(t.lettrageId) ?? []), t]);
  }
  if (cibles.some((c) => c !== null)) {
    messages.push(
      `${cibles.filter((c) => c !== null).length} ligne(s) lettrée(s) ou pointée(s) du report provisoire ont été reportées sur l'à-nouveau définitif, ` +
        'au même montant · leurs lettrages sont inchangés.',
    );
  }
  const maintenant = new Date();
  for (const [lettrageId, lignes] of orphelins) {
    const groupe = await tx.lettrage.findFirst({
      where: { id: lettrageId, tenantId },
      select: { code: true, compteId: true, compte: { select: { numero: true, intitule: true } } },
    });
    const restantes = await tx.ligneEcriture.findMany({
      where: { lettrageId, ecriture: { tenantId } },
      select: { id: true, debit: true, credit: true, deviseId: true, montantDevise: true, ecriture: { select: { date: true } } },
    });
    await tx.ligneEcriture.updateMany({
      where: { lettrageId, ecriture: { tenantId } },
      data: { lettre: null, lettrageId: null, aRelettrerDepuis: maintenant },
    });
    // Supprimé comme le fait `LettrageService.delettrer` · au journal d'audit.
    if (groupe) await tx.lettrage.delete({ where: { id: lettrageId } });
    const decrites = restantes.map((l) => ({ date: l.ecriture.date.toISOString().slice(0, 10), montant: auCentime(Number(l.debit) - Number(l.credit)) }));
    defaits.push({ type: 'LETTRAGE', compte: groupe?.compte.numero ?? null, groupe: groupe?.code ?? null, ligneProvisoire: lignes[0].debit - lignes[0].credit, lignes: decrites, motif: MOTIF });
    // Le relettrage se PROPOSE · une ligne de même montant et même devise,
    // de sens contraire, encore libre dans l'exercice suivant.
    let candidatesRelettrage = 0;
    for (const l of restantes) {
      const d = Number(l.debit);
      const c = Number(l.credit);
      candidatesRelettrage += await tx.ligneEcriture.count({
        where: {
          compteId: groupe?.compteId,
          lettrageId: null,
          id: { notIn: restantes.map((x) => x.id) },
          debit: c,
          credit: d,
          deviseId: l.deviseId,
          ecriture: { tenantId, exerciceId: exerciceSuivantId, estANouveauProvisoire: false },
        },
      });
    }
    messages.push(
      `Lettrage ${groupe?.code ?? ''} DÉLETTRÉ par la clôture · compte ${groupe?.compte.numero ?? ''} ${groupe?.compte.intitule ?? ''}, ` +
        decrites.map((l) => `${l.montant < 0 ? 'paiement' : 'ligne'} du ${l.date} (${Math.abs(l.montant).toFixed(2)})`).join(', ') +
        ` · sa ligne d'à-nouveau provisoire (${montantLisible(lignes[0])}) n'a pas d'équivalent sûr dans le report définitif. À relettrer · ` +
        (candidatesRelettrage > 0
          ? `${candidatesRelettrage} ligne(s) de même montant proposée(s) au pré-lettrage, à confirmer.`
          : 'aucune ligne de même montant dans l’exercice suivant, lettrez-le à la main quand sa facture sera connue.'),
    );
  }
  return { messages, defaits };
}

function montantLisible(t: { debit: number; credit: number }): string {
  return t.debit > 0 ? `débit ${t.debit.toFixed(2)}` : `crédit ${t.credit.toFixed(2)}`;
}

/** Plafonds de lecture de l'ouverture déjà passée (R9) · au-delà, refus nommé, jamais une confrontation amputée. */
const PLAFOND_LIGNES_OUVERTURE = 50_000;
/** Positions divergentes servies à l'écran et gardées sur l'exercice · le total se dit toujours. */
const PLAFOND_ECARTS_SERVIS = 200;

/** Une ligne de l'ouverture déjà passée, avec ce qu'il faut pour la nommer et la lettrer. */
interface LigneDOuverture extends LigneOuverturePassee {
  id: string;
  numero: string;
  piece: string;
  lettrageId: string | null;
  rapprochementId: string | null;
}

/**
 * AU2 · LA POSITION D'OUVERTURE DÉJÀ PASSÉE DANS N+1 (second tour, R1).
 *
 * PÉRIMÈTRE RETENU · toute écriture de N+1 DATÉE du premier jour, ou dont la
 * DATE DE VALEUR est le premier jour (un négatif reporté au premier jour
 * ouvert, AUDCIF art. 22, 4°), passée en À-NOUVEAU ou au journal d'OPÉRATIONS
 * DIVERSES (bilan importé, ressaisie à la main par OD), ou qui corrige l'une
 * d'elles (négatif lié), JAMAIS une écriture d'un journal d'achats, de ventes
 * ou de trésorerie (une opération de l'exercice), SAUF · le report provisoire
 * d'OmegaX (que la clôture remplace), l'écriture de solde des comptes de
 * gestion, et toute écriture qui touche un compte de GESTION (classes 6 à 8).
 *
 * POURQUOI LE PREMIER JOUR ET PAS LA SEULE FAMILLE DE L'À-NOUVEAU · l'art. 34
 * compare des BILANS, la position à l'ouverture, et une ressaisie de
 * l'ouverture par OD au premier jour en fait partie autant que l'import · lue
 * par la seule famille (`estGenereeParCloture` et son négatif lié), elle
 * échappait à la confrontation, et RECTIFIER doublait l'ouverture sans rien
 * dire (import 600 000, négatif lié, OD 300 000 · report 300 000 ajouté).
 * POURQUOI SANS LES COMPTES DE GESTION · « un bilan ne contient aucun compte
 * de gestion » (la règle de l'import, `ImportService`, sur le même art. 34) ·
 * une écriture du premier jour qui touche un 6, un 7 ou un 8 est une
 * opération de l'exercice, pas une ouverture. POURQUOI SANS LES JOURNAUX
 * D'ACHATS, DE VENTES ET DE TRÉSORERIE · l'art. 34 compare des BILANS
 * d'ouverture, et un bilan d'ouverture ne se passe jamais par eux · une
 * opération de banque du 1er janvier n'est ni comptée ni inscrite en
 * négatif. LIMITE ÉCRITE · une OD ordinaire datée du premier jour, sur des
 * comptes de bilan, se lit comme une ouverture · l'aperçu la nomme, et la
 * redater au lendemain la sort du périmètre.
 */
async function ouvertureDejaPassee(tx: Prisma.TransactionClient, tenantId: string, exercice: { id: string; dateDebut: Date }) {
  const filtre = filtreOuverturePasseeAuPremierJour(tenantId, exercice);
  const nombre = await tx.ligneEcriture.count({ where: { ecriture: filtre } });
  if (nombre > PLAFOND_LIGNES_OUVERTURE) {
    throw new BadRequestException(
      `Les écritures du premier jour de l'exercice suivant portent ${nombre.toLocaleString('fr-FR')} lignes, au-delà de ce que la clôture ` +
        `confronte en une fois (${PLAFOND_LIGNES_OUVERTURE.toLocaleString('fr-FR')}). Une confrontation amputée dirait concordant ce qui ne l'est pas · ` +
        'passez le bilan d’ouverture en mode Solde sur les comptes de tiers, ou contactez l’éditeur.',
    );
  }
  if (nombre === 0) return { ecritures: [] as Array<{ id: string; numeroPiece: number | null; statut: StatutEcriture; journal: { code: string } }>, lignes: [] as LigneDOuverture[] };
  const ecritures = await tx.ecriture.findMany({
    where: { ...filtre, tenantId },
    select: { id: true, numeroPiece: true, statut: true, journal: { select: { code: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: PLAFOND_LIGNES_OUVERTURE,
  });
  const pieceDe = new Map(ecritures.map((e) => [e.id, `${e.journal.code} n° ${e.numeroPiece ?? '·'}`]));
  const lignes: LigneDOuverture[] = [];
  await lireParLots(
    (curseur) =>
      tx.ligneEcriture.findMany({
        where: { ecriture: filtre },
        select: {
          id: true,
          ecritureId: true,
          compteId: true,
          compte: { select: { numero: true } },
          debit: true,
          credit: true,
          libelle: true,
          dateEcheance: true,
          deviseId: true,
          montantDevise: true,
          coursApplique: true,
          lettrageId: true,
          rapprochementId: true,
        },
        ...pageApres(curseur, LOT_LECTURE),
      }),
    (l) => {
      lignes.push({
        id: l.id,
        compteId: l.compteId,
        numero: l.compte.numero,
        piece: pieceDe.get(l.ecritureId) ?? '·',
        debit: Number(l.debit),
        credit: Number(l.credit),
        libelle: l.libelle,
        dateEcheance: l.dateEcheance,
        deviseId: l.deviseId,
        montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        coursApplique: l.coursApplique === null ? null : Number(l.coursApplique),
        lettrageId: l.lettrageId,
        rapprochementId: l.rapprochementId,
      });
    },
    LOT_LECTURE,
  );
  return { ecritures, lignes };
}

/** « pièce OD n° 1 » · ce qui désigne les écritures déjà passées dans un message, cinq au plus. */
function piecesLisibles(ecritures: Array<{ numeroPiece: number | null; journal: { code: string } }>): string {
  const noms = ecritures.slice(0, 5).map((e) => `${e.journal.code} n° ${e.numeroPiece ?? '·'}`);
  return noms.join(', ') + (ecritures.length > 5 ? ` et ${ecritures.length - 5} autre(s)` : '');
}

/** L'article qui fait correspondre les deux bilans, selon le référentiel · l'art. 34 de l'AUDCIF est exclu par l'art. 3 du SYCEBNL, qui porte la règle à son art. 16, 4). */
/** Le sens du résultat viré, dans le vocabulaire du référentiel (excédent et déficit au SYCEBNL). */
function libelleDuSens(referentiel: Referentiel, montant: number): string {
  if (referentiel === Referentiel.SYCEBNL) return montant >= 0 ? 'excédent' : 'déficit';
  return montant >= 0 ? 'bénéfice' : 'perte';
}

/** Le texte du virement du résultat non affecté, dans le chemin du dossier. */
function articleDuVirement(referentiel: Referentiel): string {
  return referentiel === Referentiel.SYCEBNL
    ? 'SYCEBNL, Partie 2 ch. 3, compte 13'
    : 'AUDCIF, Titre VII, compte 13';
}

function articleCorrespondance(referentiel: Referentiel): string {
  return referentiel === Referentiel.SYCEBNL ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
}

/** Ce que le cabinet déclare d'une ouverture déjà passée qui diffère du bilan de clôture (AU2). */
export type ChoixOuvertureImportee = 'RECTIFIER' | 'CONSERVER';

type OuvertureDejaPassee = Awaited<ReturnType<typeof ouvertureDejaPassee>>;

/** Une position divergente, nommée pour l'écran, le message et l'exercice. */
export interface EcartNomme {
  compteId: string;
  numero: string | null;
  intitule: string | null;
  devise: string | null;
  cloture: number;
  ouverture: number;
  clotureDevise: number | null;
  ouvertureDevise: number | null;
}

/**
 * LA CONFRONTATION NOMMÉE · positions divergentes (`confrontationDeLOuverture`,
 * par compte ET par devise, R2), avec numéro, intitulé et code de devise, et
 * les lignes que RECTIFIER inscrirait en négatif alors qu'elles sont lettrées
 * ou pointées (R6) · elles restent lettrées ou pointées, rien n'est refusé.
 */
async function confrontationNommee(tx: Prisma.TransactionClient, tenantId: string, report: LigneRan[], dejaPassee: OuvertureDejaPassee) {
  const ecarts = confrontationDeLOuverture(report, dejaPassee.lignes);
  const comptesIds = [...new Set(ecarts.map((e) => e.compteId))];
  const devisesIds = [...new Set(ecarts.map((e) => e.deviseId).filter((d): d is string => d !== null))];
  const [comptes, devises] = await Promise.all([
    comptesIds.length ? tx.compte.findMany({ where: { tenantId, id: { in: comptesIds } }, select: { id: true, numero: true, intitule: true } }) : [],
    devisesIds.length ? tx.devise.findMany({ where: { tenantId, id: { in: devisesIds } }, select: { id: true, code: true } }) : [],
  ]);
  const compte = new Map(comptes.map((c) => [c.id, c]));
  const devise = new Map(devises.map((d) => [d.id, d.code]));
  const nommes: EcartNomme[] = ecarts.map((e) => ({
    compteId: e.compteId,
    numero: compte.get(e.compteId)?.numero ?? null,
    intitule: compte.get(e.compteId)?.intitule ?? null,
    devise: e.deviseId ? (devise.get(e.deviseId) ?? null) : null,
    cloture: e.cloture,
    ouverture: e.ouverture,
    clotureDevise: e.clotureDevise,
    ouvertureDevise: e.ouvertureDevise,
  }));
  const rectifies = new Set(comptesIds);
  const tenues = dejaPassee.lignes
    .filter((l) => rectifies.has(l.compteId) && (l.lettrageId !== null || l.rapprochementId !== null))
    .map((l) => ({ numero: l.numero, piece: l.piece, debit: l.debit, credit: l.credit, lettree: l.lettrageId !== null, pointee: l.rapprochementId !== null }));
  return { ecarts: nommes, tenues };
}

function positionLisible(e: EcartNomme): string {
  const enDevise = e.devise ? ` en ${e.devise} (clôture ${(e.clotureDevise ?? 0).toFixed(2)}, ouverture ${(e.ouvertureDevise ?? 0).toFixed(2)})` : '';
  return `${e.numero ?? '?'}${e.devise ? '' : ''} (clôture ${e.cloture.toFixed(2)}, ouverture ${e.ouverture.toFixed(2)})${enDevise}`;
}

function listeLisible<T>(items: T[], lire: (x: T) => string, n = 5): string {
  return items.slice(0, n).map(lire).join(', ') + (items.length > n ? ` et ${items.length - n} autre(s)` : '');
}

/**
 * AU2 · CE QUE LA CLÔTURE FAIT D'UNE OUVERTURE DÉJÀ PASSÉE DANS N+1.
 *
 * L'art. 34 de l'AUDCIF (au SYCEBNL, son art. 16, 4)) veut l'ouverture de N+1
 * égale à la clôture de N. Quand N+1 porte déjà une position d'ouverture
 * (`ouvertureDejaPassee`) ·
 *
 *  · une de ses écritures AU BROUILLARD, refus · elle n'est pas au
 *    livre-journal (art. 22, 2°) et pourrait encore disparaître · la valider
 *    (ou, si c'est une opération ordinaire, la supprimer ou la redater) ;
 *  · NULLE sur toutes ses positions (un import entièrement annulé), elle
 *    n'est plus une ouverture · le report entier passe (R10) ;
 *  · CONCORDANTE par compte et par devise · rien n'est ajouté ;
 *  · DIVERGENTE, et N ne porte aucune écriture · l'import fait foi ;
 *  · DIVERGENTE, et N a des écritures · OmegaX ne sait pas lequel des deux
 *    bilans est faux, le cabinet le DÉCLARE. RECTIFIER · l'ouverture est
 *    inscrite en négatif sur les comptes divergents et le report exact est
 *    passé (AUDCIF art. 20, al. 2, `rectificationDeLOuverture`). CONSERVER ·
 *    N n'est tenu ici que pour les comparatifs, rien n'est passé, le MOTIF et
 *    les positions s'écrivent sur l'exercice (journal d'audit), et le
 *    contrôle de l'exercice suivant le rappelle (R8). Sans déclaration, refus
 *    nommé · les deux gestes restent ouverts.
 */
async function issueDeLOuverture(
  tx: Prisma.TransactionClient,
  p: {
    tenantId: string;
    exerciceId: string;
    referentiel: Referentiel;
    report: LigneRan[];
    dejaPassee: OuvertureDejaPassee;
    choix: ChoixOuvertureImportee | null;
    motifConservation: string | null;
  },
): Promise<{
  lignes: LigneRan[];
  rectification: ReturnType<typeof rectificationDeLOuverture> | null;
  messages: string[];
  conservation: { motif: string; ecarts: Prisma.InputJsonValue } | null;
}> {
  const { dejaPassee, referentiel } = p;
  const rien = { rectification: null, conservation: null };
  if (dejaPassee.ecritures.length === 0) return { ...rien, lignes: p.report, messages: [] };
  const pieces = piecesLisibles(dejaPassee.ecritures);
  const article = articleCorrespondance(referentiel);
  const auBrouillard = dejaPassee.ecritures.filter((e) => e.statut === StatutEcriture.BROUILLARD);
  if (auBrouillard.length > 0) {
    throw new BadRequestException(
      `L'exercice suivant porte au premier jour des écritures au brouillard (${piecesLisibles(auBrouillard)}) · une ouverture qui n'est pas ` +
        `le report d'OmegaX. Le bilan d'ouverture correspond au bilan de clôture de l'exercice précédent (${article}), et la clôture ` +
        "doit le confronter à ce qui est au livre-journal. Validez-les (fenêtre Brouillard), ou, s'il s'agit d'opérations de l'exercice, " +
        'supprimez-les ou redatez-les au lendemain, puis clôturez.',
    );
  }
  if (ouvertureNulle(dejaPassee.lignes)) {
    return {
      ...rien,
      lignes: p.report,
      messages: [`Les écritures du premier jour de l'exercice suivant (${pieces}) se soldent à zéro sur chaque compte · le report entier est passé.`],
    };
  }
  const { ecarts, tenues } = await confrontationNommee(tx, p.tenantId, p.report, dejaPassee);
  if (ecarts.length === 0) {
    return {
      ...rien,
      lignes: [],
      messages: [`L'ouverture déjà passée dans l'exercice suivant (${pieces}) correspond au bilan de clôture, par compte et par devise · aucun report n'est ajouté.`],
    };
  }
  const ecrituresDeN = await tx.ecriture.count({ where: { tenantId: p.tenantId, exerciceId: p.exerciceId, estSoldeDesComptesDeGestion: false } });
  if (ecrituresDeN === 0) {
    return {
      ...rien,
      lignes: [],
      messages: [`Cet exercice ne porte aucune écriture · il n'a rien à reporter, et l'ouverture déjà passée dans l'exercice suivant (${pieces}) fait foi.`],
    };
  }
  const detail = listeLisible(ecarts, positionLisible);
  if (p.choix === 'RECTIFIER') {
    const rectification = rectificationDeLOuverture(p.report, dejaPassee.lignes);
    const messages = [
      `L'ouverture déjà passée dans l'exercice suivant (${pieces}) différait du bilan de clôture sur ${ecarts.length} position(s) · ` +
        `ses lignes y sont inscrites en négatif et le report exact est passé (${article} ; AUDCIF art. 20). Les autres comptes gardent leur ouverture.`,
    ];
    if (tenues.length > 0) {
      messages.push(
        `Lignes inscrites en négatif alors qu'elles sont lettrées ou pointées (elles le restent, leur négatif reste ouvert) · ` +
          listeLisible(tenues, (t) => `${t.numero} ${t.piece} ${montantLisible(t)}${t.lettree ? ', lettrée' : ''}${t.pointee ? ', pointée' : ''}`) +
          '.',
      );
    }
    return { rectification, lignes: rectification.lignes, messages, conservation: null };
  }
  if (p.choix === 'CONSERVER') {
    const motif = (p.motifConservation ?? '').trim();
    if (motif.length < 3 || motif.length > 500) {
      throw new BadRequestException(
        "Conserver l'ouverture déjà passée exige un motif écrit (3 à 500 caractères) · il dit pourquoi les livres légaux de cet " +
          "exercice ne sont pas ceux d'OmegaX, et il reste au journal d'audit.",
      );
    }
    const ecartsGardes = {
      total: ecarts.length,
      tronque: ecarts.length > PLAFOND_ECARTS_SERVIS,
      ecarts: ecarts.slice(0, PLAFOND_ECARTS_SERVIS).map(({ compteId: _c, ...e }) => e),
    };
    return {
      rectification: null,
      lignes: [],
      messages: [
        `L'ouverture déjà passée dans l'exercice suivant (${pieces}) est conservée, déclarée faire foi · elle diffère du bilan de clôture ` +
          `d'OmegaX sur ${ecarts.length} position(s) (${detail}), aucun report n'est passé, et le contrôle de l'exercice suivant le rappellera.`,
      ],
      conservation: { motif, ecarts: ecartsGardes as unknown as Prisma.InputJsonValue },
    };
  }
  throw new BadRequestException(
    `L'exercice suivant porte déjà une ouverture (${pieces}) qui diffère du bilan de clôture de cet exercice sur ${ecarts.length} ` +
      `position(s) · ${detail}. Les deux doivent correspondre (${article}), et OmegaX ne sait pas lequel est faux. Déclarez-le · ` +
      "« Rectifier l'import » si les livres de cet exercice sont tenus dans OmegaX (l'ouverture est inscrite en négatif là où elle diffère, " +
      "puis le report exact est passé, AUDCIF art. 20), ou « Conserver l'import » avec son motif si cet exercice n'y est tenu que pour " +
      'les comparatifs (rien n’est passé).',
  );
}

/**
 * R6 · CHAQUE NÉGATIF LETTRÉ AVEC LA LIGNE QU'IL ANNULE, dans un groupe du
 * module (origine `MODULE`, soldé, la paire se soldant par construction) ·
 * sans lui, l'import et son négatif restaient ouverts au détail du tiers, à la
 * balance âgée et au report suivant. Seulement si les règles du lettrage le
 * permettent · compte lettrable, ligne d'origine libre (une ligne déjà lettrée
 * ou pointée reste où elle est, son négatif reste ouvert, et c'est nommé),
 * aucune des deux figée par une clôture.
 */
async function lettrerNegatifsAvecLeursOrigines(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  negatifs: { rang: number; origine: LigneOuverturePassee }[],
  lignesCreees: Array<{ id: string; compteId: string; debit: number; credit: number }>,
): Promise<string[]> {
  const origines = negatifs.map((n) => n.origine as LigneDOuverture).filter((o) => o.id && o.lettrageId === null && o.rapprochementId === null);
  if (origines.length === 0) return [];
  const lettrables = new Set(
    (await tx.compte.findMany({ where: { tenantId, id: { in: [...new Set(origines.map((o) => o.compteId))] }, lettrable: true }, select: { id: true } })).map((c) => c.id),
  );
  const prises = new Set<string>();
  const paires: { compteId: string; ids: [string, string] }[] = [];
  for (const o of origines) {
    if (!lettrables.has(o.compteId)) continue;
    const n = lignesCreees.find(
      (l) => !prises.has(l.id) && l.compteId === o.compteId && Math.abs(l.debit + o.debit) <= EPSILON && Math.abs(l.credit + o.credit) <= EPSILON,
    );
    if (!n) continue;
    prises.add(n.id);
    paires.push({ compteId: o.compteId, ids: [o.id, n.id] });
  }
  const figees = await lignesFigees(tx, tenantId, paires.flatMap((p) => p.ids));
  const libres = paires.filter((p) => !p.ids.some((id) => figees.has(id)));
  const codeSuivant = new Map<string, () => string>();
  let posees = 0;
  for (const p of libres) {
    if (!codeSuivant.has(p.compteId)) codeSuivant.set(p.compteId, await prochaineLettreDuCompte(tx, tenantId, p.compteId));
    if (await poserGroupeSoldeDuModule(tx, { tenantId, compteId: p.compteId, ligneIds: p.ids, userId, code: codeSuivant.get(p.compteId)!() })) posees++;
  }
  const messages: string[] = [];
  if (posees > 0) messages.push(`${posees} ligne(s) d'ouverture lettrée(s) avec leur inscription en négatif.`);
  if (paires.length > libres.length) {
    messages.push(`${paires.length - libres.length} paire(s) ligne d'ouverture et négatif non lettrée(s) · une clôture fige le premier jour.`);
  }
  return messages;
}

/**
 * LE VERROU DE SAISIE · une écriture datée d'une période close ne passe pas.
 * Règle pure, pour que la saisie à l'unité et le contrôle d'un lot (import,
 * audit final F2) la jouent à l'identique.
 */
export function refuserSiPeriodeClose(
  clotures: Array<{ granularite: GranulariteCloture; journalId: string | null; dateLimite: Date }>,
  journalId: string,
  date: Date,
) {
  for (const c of clotures) {
    // Bornée à sa date limite · une clôture totale de janvier (ou de 2026)
    // ne ferme pas février (ou 2027) du même journal.
    if (c.granularite === GranulariteCloture.TOTALE && c.journalId === journalId && date <= c.dateLimite) {
      throw new ForbiddenException(
        `Ce journal est clôturé totalement jusqu'au ${c.dateLimite.toISOString().slice(0, 10)} · aucune écriture n'y est plus possible à cette date. ` +
          AIDE_REPORT_ART_22,
      );
    }
    if (c.granularite === GranulariteCloture.PARTIELLE && c.journalId === journalId && date <= c.dateLimite) {
      throw new ForbiddenException(
        `Ce journal est clôturé partiellement jusqu'au ${c.dateLimite.toISOString().slice(0, 10)} · aucune écriture ne peut plus y être datée à cette période ou avant. ` +
          AIDE_REPORT_ART_22,
      );
    }
    if (c.granularite === GranulariteCloture.PERIODE && date <= c.dateLimite) {
      throw new ForbiddenException(
        `La période jusqu'au ${c.dateLimite.toISOString().slice(0, 10)} est clôturée pour tous les journaux. ` +
          AIDE_REPORT_ART_22,
      );
    }
  }
}

/**
 * Ce que l'arrêt lit avant d'écrire · les exercices qui suivent, les
 * écritures datées après la dissolution, et le fait qui décide s'il y a une
 * liquidation. Lu DANS la transaction sérialisable de l'arrêt, et par le
 * planning pour proposer (ou non) le bouton (constat 15).
 */
async function lireEtatAvantArret(
  client: Prisma.TransactionClient,
  tenantId: string,
  exercice: { id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice },
  dossier: {
    dateDissolution: Date | null;
    regimeLiquidation: RegimeLiquidation | null;
    associeUniquePersonneMorale: boolean | null;
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
  },
) {
  const dissolution = dossier.dateDissolution;
  const sans = sansLiquidation({
    forme: dossier.formeJuridiqueSyscohada,
    regimeLiquidation: dossier.regimeLiquidation,
    associeUniquePersonneMorale: dossier.associeUniquePersonneMorale,
  });
  const [posterieurs, aDeplacer] = await Promise.all([
    client.exercice.findMany({
      where: { tenantId, dateDebut: { gt: exercice.dateFin } },
      orderBy: { dateDebut: 'asc' },
      select: { id: true, dateDebut: true, dateFin: true, statut: true },
    }),
    dissolution
      ? client.ecriture.findMany({
          where: { tenantId, exerciceId: exercice.id, date: { gt: dissolution } },
          select: { id: true, date: true, numeroPiece: true, journal: { select: { code: true } } },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        })
      : Promise.resolve([] as Array<{ id: string; date: Date; numeroPiece: number | null; journal: { code: string } }>),
  ]);
  // LES EXERCICES DONT LA PÉRIODE CHANGE · celui qu'on arrête, et celui qui
  // le suit quand il devient l'exercice de liquidation (son début recule au
  // lendemain de la dissolution). Sans liquidation, l'exercice qui suit
  // n'existe plus (majeur 2) · il ne porte aucun acte à refaire, il se nomme.
  const changent = [exercice, ...(!sans && posterieurs.length === 1 ? [posterieurs[0]] : [])];
  const actes = await lireActesDeLaPeriode(client, tenantId, changent);
  const occupations = sans ? await Promise.all(posterieurs.map((p) => usagesDeLExercice(client, tenantId, p.id))) : [];
  const etat: EtatAvantArret = {
    exercice: { dateDebut: exercice.dateDebut, dateFin: exercice.dateFin, clos: exercice.statut === StatutExercice.CLOTURE },
    dissolution,
    posterieurs: posterieurs.map((p, i) => ({
      dateDebut: p.dateDebut,
      dateFin: p.dateFin,
      clos: p.statut === StatutExercice.CLOTURE,
      usages: occupations[i] ?? null,
    })),
    sansLiquidation: sans,
    ecrituresApres: aDeplacer.length,
    actesDeLaPeriode: actes,
  };
  return { etat, posterieurs, aDeplacer, actes };
}

/**
 * CE QUI OCCUPE UN EXERCICE, hors son report à-nouveau PROVISOIRE (qui se
 * retire et se recalcule) · lu dans le schéma (`referencesVers`), jamais une
 * liste écrite à la main. `null` s'il ne porte rien · il peut alors
 * disparaître sans rien emporter.
 */
async function usagesDeLExercice(client: Prisma.TransactionClient, tenantId: string, exerciceId: string): Promise<string | null> {
  const [references, provisoires] = await Promise.all([
    referencesVers(client, 'Exercice', exerciceId, tenantId),
    client.ecriture.count({ where: { tenantId, exerciceId, estANouveauProvisoire: true } }),
  ]);
  const reelles = references
    .map((r) => (r.modele === 'Ecriture' && r.champ === 'exerciceId' ? { ...r, nombre: r.nombre - provisoires } : r))
    .filter((r) => r.nombre > 0);
  return reelles.length ? reelles.map(libelleReference).join(', ') : null;
}

/**
 * LES RELEVÉS D'UNITÉS D'ŒUVRE À REVOIR (mineur 3) · un relevé n'a pas de
 * date, il porte les unités consommées sur la période de son exercice. Il ne
 * suit rien et ne refuse rien (sa saisie se refait, `saisirConsommation`) ·
 * il est NOMMÉ au résultat du geste, la dotation qui le lit étant, elle,
 * refusée tant qu'elle existe (`ACTES_DE_LA_PERIODE`).
 */
async function relevesUnitesOeuvre(client: Prisma.TransactionClient, tenantId: string, exerciceIds: string[]): Promise<string[]> {
  const releves = await client.consommationUniteOeuvre.findMany({
    where: { tenantId, exerciceId: { in: exerciceIds } },
    select: { unitesConsommees: true, immobilisation: { select: { designation: true } }, exercice: { select: { dateDebut: true, dateFin: true } } },
    orderBy: { id: 'asc' },
    take: 200,
  });
  return releves.map(
    (r) =>
      `${r.immobilisation.designation} · ${Number(r.unitesConsommees)} unités relevées sur l'exercice ${periodeLisible(r.exercice)}, ` +
      'à ressaisir pour sa période nouvelle',
  );
}

/**
 * LES ACTES DONT LE MONTANT DÉPEND DE LA PÉRIODE (relecture du 2026-10-07,
 * bloquant 1, `ACTES_DE_LA_PERIODE`) · lus sur les exercices dont la période
 * change, chacun nommé avec sa pièce, son exercice et son issue.
 */
async function lireActesDeLaPeriode(
  client: Prisma.TransactionClient,
  tenantId: string,
  exercices: Array<{ id: string; dateDebut: Date; dateFin: Date }>,
): Promise<ActeDeLaPeriodeLu[]> {
  const delegues = client as unknown as Record<string, { findMany: (a: unknown) => Promise<Array<Record<string, unknown> & { id: string }>> }>;
  const periodes = new Map(exercices.map((e) => [e.id, periodeLisible(e)]));
  const ids = exercices.map((e) => e.id);
  const lus: Array<{ acte: (typeof ACTES_DE_LA_PERIODE)[number]; ligne: Record<string, unknown> & { id: string } }> = [];
  for (const acte of ACTES_DE_LA_PERIODE) {
    const borne = acte.parLeBien ? { immobilisation: { tenantId } } : { tenantId };
    const lignes = await delegues[acte.modele].findMany({
      where: { ...borne, exerciceId: { in: ids }, ...(acte.actif ?? {}) },
      orderBy: { id: 'asc' },
    });
    for (const ligne of lignes) lus.push({ acte, ligne });
  }
  if (lus.length === 0) return [];
  const ecritureIds = [...new Set(lus.map((l) => l.ligne[l.acte.colonne]).filter((v): v is string => typeof v === 'string'))];
  const bienIds = [...new Set(lus.map((l) => l.ligne.immobilisationId).filter((v): v is string => typeof v === 'string'))];
  const [ecritures, biens] = await Promise.all([
    ecritureIds.length
      ? client.ecriture.findMany({
          where: { tenantId, id: { in: ecritureIds } },
          select: { id: true, statut: true, numeroPiece: true, journal: { select: { code: true } } },
        })
      : Promise.resolve([] as Array<{ id: string; statut: StatutEcriture; numeroPiece: number | null; journal: { code: string } }>),
    bienIds.length
      ? client.immobilisation.findMany({ where: { tenantId, id: { in: bienIds } }, select: { id: true, statut: true } })
      : Promise.resolve([] as Array<{ id: string; statut: StatutImmobilisation }>),
  ]);
  const parEcriture = new Map(ecritures.map((e) => [e.id, e]));
  const sortis = new Set(biens.filter((b) => b.statut !== StatutImmobilisation.EN_SERVICE).map((b) => b.id));
  return lus.map(({ acte, ligne }) => {
    const ecritureId = typeof ligne[acte.colonne] === 'string' ? (ligne[acte.colonne] as string) : null;
    const e = ecritureId ? parEcriture.get(ecritureId) : undefined;
    const bienSorti = typeof ligne.immobilisationId === 'string' && sortis.has(ligne.immobilisationId);
    const auBrouillard = !e || e.statut === StatutEcriture.BROUILLARD;
    return {
      modele: acte.modele,
      id: ligne.id,
      libelle: acte.libelle,
      piece: e ? `${e.journal.code} n° ${e.numeroPiece ?? '·'}` : 'sans écriture',
      periode: periodes.get(String(ligne.exerciceId)) ?? '·',
      retirable: !!acte.retirable && !bienSorti,
      ecritureId,
      issue: issueActeDeLaPeriode(acte, { auBrouillard, bienSorti }),
    };
  });
}

/**
 * RATTACHER À UN AUTRE EXERCICE · les écritures nommées, les actes de module
 * qui portent l'exercice et suivent leur écriture (`ACTES_QUI_SUIVENT_LEUR_ECRITURE`),
 * les clôtures de journal et de période posées sur ces dates (constat 11).
 * Rien d'autre ne change · ni date, ni numéro de pièce, ni lignes, ni statut,
 * ni auteurs (quatrième lot, point 1). Mises à jour UNITAIRES, au journal
 * d'audit · la liste des écritures rattachées s'y lit pièce par pièce.
 */
async function rattacherALExercice(
  tx: Prisma.TransactionClient,
  tenantId: string,
  r: {
    depuis: string;
    vers: string;
    ecritures: Array<{ id: string; numeroPiece: number | null; journal: { code: string } }>;
    clotures: Prisma.ClotureWhereInput;
    /** Les dates qui passent d'un exercice à l'autre (actes datés sans écriture). */
    dates: Prisma.DateTimeFilter;
  },
): Promise<{ ecrituresRattachees: number; actesRattaches: number; cloturesRattachees: number }> {
  for (const e of r.ecritures) {
    await tx.ecriture.update({ where: { id: e.id }, data: { exerciceId: r.vers } });
  }
  const piece = new Map(r.ecritures.map((e) => [e.id, `${e.journal.code} n° ${e.numeroPiece ?? '·'}`]));
  const ids = r.ecritures.map((e) => e.id);
  let actes = 0;
  const client = tx as unknown as Record<
    string,
    {
      findMany: (a: unknown) => Promise<Array<Record<string, unknown> & { id: string }>>;
      findFirst: (a: unknown) => Promise<{ id: string } | null>;
      update: (a: unknown) => Promise<unknown>;
    }
  >;
  // Par tranches de mille identifiants · une liste sans borne dépasserait le
  // nombre de paramètres d'une requête.
  for (let i = 0; i < ids.length; i += 1000) {
    const tranche = ids.slice(i, i + 1000);
    for (const acte of ACTES_QUI_SUIVENT_LEUR_ECRITURE) {
      const delegue = client[acte.modele];
      const borne = acte.parLeBien ? { immobilisation: { tenantId } } : { tenantId };
      const lignes = await delegue.findMany({ where: { ...borne, exerciceId: r.depuis, [acte.colonne]: { in: tranche } } });
      for (const ligne of lignes) {
        if (acte.unicite) {
          const deja = await delegue.findFirst({
            where: { ...borne, exerciceId: r.vers, ...Object.fromEntries(acte.unicite.map((c) => [c, ligne[c]])) },
            select: { id: true },
          });
          if (deja) {
            throw new BadRequestException(motifActeQuiNePeutSuivre(acte, piece.get(String(ligne[acte.colonne])) ?? '·'));
          }
        }
        await delegue.update({ where: { id: ligne.id }, data: { exerciceId: r.vers } });
        actes++;
      }
    }
  }
  // LES ACTES DATÉS SANS ÉCRITURE suivent leur date (mineur 3,
  // `ACTES_DATES_QUI_SUIVENT_LEUR_DATE`) · même borne de dates que les
  // écritures, mises à jour unitaires.
  for (const acte of ACTES_DATES_QUI_SUIVENT_LEUR_DATE) {
    const delegue = client[acte.modele];
    const lignes = await delegue.findMany({ where: { tenantId, exerciceId: r.depuis, [acte.colonne]: r.dates } });
    for (const ligne of lignes) {
      if (acte.unicite) {
        const deja = await delegue.findFirst({
          where: { tenantId, exerciceId: r.vers, ...Object.fromEntries(acte.unicite.map((c) => [c, ligne[c]])) },
          select: { id: true },
        });
        if (deja) {
          throw new BadRequestException(
            `L'${acte.libelle} « ${String(ligne.reference ?? '·')} » du ${jourFr(ligne[acte.colonne] as Date)} doit suivre sa ` +
              'date dans l’autre exercice, qui en porte déjà un sous la même référence · renommez l’un des deux, puis relancez.',
          );
        }
      }
      await delegue.update({ where: { id: ligne.id }, data: { exerciceId: r.vers } });
      actes++;
    }
  }
  const clotures = await tx.cloture.findMany({
    where: { tenantId, exerciceId: r.depuis, ...r.clotures },
    select: { id: true },
  });
  for (const c of clotures) {
    await tx.cloture.update({ where: { id: c.id }, data: { exerciceId: r.vers } });
  }
  return { ecrituresRattachees: r.ecritures.length, actesRattaches: actes, cloturesRattachees: clotures.length };
}
