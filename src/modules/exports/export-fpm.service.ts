import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Prisma, Referentiel, StatutEcriture } from '@prisma/client';
import type { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma.service';
import { exerciceDuDossierOuRefus } from '../../common/exercice-introuvable';
import { pageApres } from '../../common/lecture-par-lots';
import { libelleExercice } from '../../common/libelle-exercice';
import { EcritureService } from '../comptabilite/ecriture.service';
import { filtresDesTroisColonnes, filtresDesTroisColonnesDeLaPeriode } from '../comptabilite/balance-trois-colonnes';
import { jourDeKinshasa } from '../../common/echeance';
import { ecrituresDansLaPeriode, jourFr, libellePeriode, type PeriodeExtrait, type ReportALaVeille } from '../comptabilite/periode-extrait';
import type { ExtraitNumerote } from './extraits-periode/extraits-periode.service';
import { compteDeLaFamille, divisionnaireDeLaFamille, estFamilleTiers, type FamilleTiers, sousTitreFamille } from '../comptabilite/familles-tiers';
import { LOT_EXPORT, MAX_LIGNES_EXPORT, OPTIONS_CLASSEUR_EN_FLUX, confronterAuDecompte, type IdentiteEtat } from './classeur-en-flux';
import { ExportService } from './export.service';
import {
  COLONNES_BALANCE_FPM,
  COLONNES_GRAND_LIVRE_FPM,
  ENTETES_GRAND_LIVRE_FPM,
  entetesBalanceFpm,
  type FeuilleFpm,
  formuleLien,
  montantFpm,
  nomsDeFeuilles,
  poserFeuilleFpm,
  soldeEnDeuxColonnes,
} from './presentation-fpm';
import {
  arrondi,
  divisionsDeLaClasse9,
  ecartBalance,
  ecrireCorpsBalance,
  ecrireLigneDeCompte,
  ecrireTotal,
  estNulBalance,
  type LigneBalanceFpm,
  plageBalance,
  totauxBalance,
  type TotauxBalance,
} from './balance-fpm';

/**
 * LES BALANCES ET LES GRANDS LIVRES DANS LA PRÉSENTATION DU CABINET (ligne
 * FPM, 2026-10-04) · voir `presentation-fpm.ts` pour le relevé des modèles.
 *
 * DEUX DÉCISIONS DE MANASSE (2026-10-04).
 *  1. La balance exportée porte UNE FEUILLE PAR COMPTE MOUVEMENTÉ, le grand
 *     livre complet du compte · le numéro de la balance y mène, un lien
 *     « Retour à la balance » ramène à la ligne exacte. Même principe de la
 *     balance des tiers vers le grand livre de chaque tiers.
 *  2. Cette présentation est celle PAR DÉFAUT · le grand livre « à plat »
 *     (filtrable, avec son sommaire) reste servi en second choix.
 *
 * LES LIVRES NE SE TRONQUENT PAS (AUDCIF art. 22, 6° ; CLAUDE.md § 8 bis) ·
 * le volume (lignes de balance ET lignes de grand livre) se compte AVANT le
 * premier octet, et au-delà du plafond l'export se REFUSE en nommant le
 * chemin de rechange.
 *
 * LES COLONNES SUIVENT LA BALANCE DU DÉPÔT, jamais un second calcul
 * (`EcritureService.balance`, `balance-trois-colonnes.ts`) · « Mouvements au
 * <veille> » est la colonne du report à-nouveau (les écritures que la
 * clôture a posées en ouverture, brutes), « Mouvements » porte les écritures
 * de l'exercice ET celle qui solde les comptes de gestion d'un exercice clos
 * (audit final F5, comme l'export à six colonnes qu'elle remplace), « Soldes
 * cumulés » le solde net des trois. Le grand livre de chaque compte porte les
 * MÊMES lignes · sa somme rend sa ligne de balance, et le contrôle de fin de
 * livre le vérifie au lieu de le supposer.
 */

/** Le nom de la feuille qui porte la balance · réservé, aucun compte ne le prend. */
const FEUILLE_BALANCE = 'Balance';

/**
 * LA MENTION DU BROUILLARD, LIGNE À LIGNE (audit final F99) · un grand livre
 * qui mêle des pièces encore modifiables doit le dire là où on les lit (AUDCIF
 * art. 22, 2°). La présentation du cabinet n'a pas de colonne Statut · la
 * mention suit le libellé.
 */
const MENTION_BROUILLARD = ' · brouillard';

/** Ce qu'il faut savoir de l'exercice et du dossier pour poser un état. */
interface Contexte {
  identite: IdentiteEtat;
  referentiel: Referentiel;
  debut: Date;
  fin: Date;
  suffixe: string;
  /** La mention du brouillard sous le cartouche, ou rien quand tout est validé. */
  mention?: string;
  /** Le sous-titre de l'état · « Complète », ou l'extrait de la période. */
  sousTitre: string;
  /** La période de l'extrait (ligne export-periode) · absente, l'exercice entier. */
  periode?: PeriodeExtrait;
  /** Les bornes de l'exercice · un extrait les rappelle (condition 2). */
  exercice: { debut: Date; fin: Date };
}

/**
 * CE QUE L'APPELANT DONNE POUR UN EXTRAIT DE PÉRIODE (ligne export-periode) ·
 * la période, et de quoi prendre le numéro une fois les refus passés, juste
 * avant le premier octet (`ExtraitsPeriodeService.produire`).
 */
export interface DemandeDExtrait {
  periode: PeriodeExtrait;
  numeroter: () => Promise<ExtraitNumerote>;
}

/** Une ligne de grand livre, telle que la lecture par lots la rend. */
type LigneGrandLivre = Prisma.LigneEcritureGetPayload<{
  include: { compte: { select: { id: true; numero: true; intitule: true } }; ecriture: { include: { journal: { select: { code: true } } } } };
}>;

@Injectable()
export class ExportFpmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritureService: EcritureService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * LA TAILLE DE LOT, lisible et réglable par un test qui doit forcer
   * plusieurs tranches (curseur, `skip: 1`) sur un petit jeu d'essai. Le
   * plafond de volume est celui de tous les livres en flux
   * (`MAX_LIGNES_EXPORT`, `classeur-en-flux.ts`) · une balance qui porte le
   * grand livre de chaque compte EST un grand livre complet, plus sa feuille.
   */
  lotExport = LOT_EXPORT;

  // -------------------------------------------------------------------------
  // Lectures communes
  // -------------------------------------------------------------------------

  private async contexte(tenantId: string, exerciceId: string, periode?: PeriodeExtrait): Promise<Contexte> {
    const exercice = exerciceDuDossierOuRefus(
      await this.prisma.exercice.findFirst({
        where: { id: exerciceId, tenantId },
        select: { dateDebut: true, dateFin: true },
      }),
    );
    const [tenant, identite, auBrouillard] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
      this.exportService.identiteEtat(tenantId, { exerciceId }),
      // Le BROUILLARD seul · une écriture de situation n'est pas un brouillard
      // et n'entre pas au classeur (ligne sage-l1, fonction 12). Sur une
      // période, celui que l'extrait porte · daté au plus tard son dernier jour.
      this.prisma.ecriture.count({
        where: { tenantId, exerciceId, statut: StatutEcriture.BROUILLARD, ...(periode ? { date: { lt: periode.finExclue } } : {}) },
      }),
    ]);
    const jourIso = (d: Date) => d.toISOString().slice(0, 10);
    return {
      identite,
      referentiel: tenant.referentiel,
      debut: periode ? periode.du : exercice.dateDebut,
      fin: periode ? periode.au : exercice.dateFin,
      suffixe: `-${libelleExercice(exercice)}${periode ? `-du-${jourIso(periode.du)}-au-${jourIso(periode.au)}` : ''}`,
      sousTitre: periode ? `Extrait ${libellePeriode(periode)}` : 'Complète',
      periode,
      exercice: { debut: exercice.dateDebut, fin: exercice.dateFin },
      // LE BROUILLARD SE DIT EN TÊTE (second tour, relevé D) · la balance, comme
      // les livres, se lit brouillard compris (`EcritureService.balance`), et
      // une pièce encore modifiable n'est pas au livre-journal (AUDCIF art. 22,
      // 2°). Une balance qui la porte sans le dire se lirait comme définitive.
      mention:
        auBrouillard > 0
          ? `Brouillard compris · ${auBrouillard.toLocaleString('fr-FR')} écriture${auBrouillard > 1 ? 's' : ''} non validée${auBrouillard > 1 ? 's' : ''}`
          : undefined,
    };
  }

  /**
   * LE CONTEXTE D'UN EXTRAIT NUMÉROTÉ (ligne export-periode, conditions 2 et
   * 3) · le pied de chaque page porte le numéro et la période (AUDCIF art. 22,
   * 7°), la ligne 7 dit le numéro, la date d'établissement, et pour un grand
   * livre que le livre de l'exercice reste celui de l'exercice entier ; la
   * mention du brouillard suit.
   */
  private avecExtrait(ctx: Contexte, extrait: ExtraitNumerote, livre: boolean): Contexte {
    const numero = `Extrait n° ${extrait.numero}`;
    // Le jour de Kinshasa, comme la date de tirage de la ligne 6 · lu en temps
    // universel, l'extrait établi entre minuit et une heure portait la veille.
    const etabli = `établi le ${jourFr(jourDeKinshasa(extrait.etabliLe))}`;
    const exercice = libellePeriode({ du: ctx.exercice.debut, au: ctx.exercice.fin });
    const precision = livre ? ` · le grand livre de l'exercice est celui ${exercice}` : '';
    return {
      ...ctx,
      identite: { ...ctx.identite, periode: `${numero} · ${libellePeriode(extrait.periode)}` },
      mention: [`${numero} ${etabli}${precision}`, ctx.mention].filter(Boolean).join(' · '),
    };
  }

  /**
   * LE NUMÉRO D'UN EXTRAIT, PRIS AU DERNIER MOMENT · après les refus, avant le
   * premier octet. Sans extrait demandé, le contexte reste celui de l'exercice.
   */
  private async numeroterSiExtrait(ctx: Contexte, extrait: DemandeDExtrait | undefined, livre: boolean): Promise<Contexte> {
    if (!extrait) return ctx;
    return this.avecExtrait(ctx, await extrait.numeroter(), livre);
  }

  /** La balance du dépôt, mise dans les colonnes de la présentation. */
  private async balanceFpm(tenantId: string, exerciceId: string, periode?: PeriodeExtrait): Promise<LigneBalanceFpm[]> {
    // Sur une période, « Mouvements au <veille> » garde tout ce qui précède le
    // premier jour (`filtresDesTroisColonnesDeLaPeriode`, condition 1).
    const { lignes } = await this.ecritureService.balance(tenantId, exerciceId, true, undefined, periode ? { periode } : {});
    return lignes.map((l) => ({
      compteId: l.compteId,
      numero: l.numero,
      intitule: l.intitule,
      classe: l.classe,
      avantDebit: l.reportDebit,
      avantCredit: l.reportCredit,
      // L'écriture qui solde les comptes de gestion d'un exercice clos est un
      // mouvement DU JOURNAL de l'exercice, pas une ouverture (audit final F5).
      mouvementDebit: l.mouvementDebit + l.clotureDebit,
      mouvementCredit: l.mouvementCredit + l.clotureCredit,
      totalDebit: l.totalDebit,
      totalCredit: l.totalCredit,
    }));
  }

  /**
   * LE VOLUME, COMPTÉ AVANT LE PREMIER OCTET · une fois l'en-tête HTTP parti,
   * le refus ne peut plus devenir un 413. Les lignes de la feuille de balance
   * comptent avec celles des grands livres.
   */
  private async verifierVolume(
    tenantId: string,
    exerciceId: string,
    lignesDeBalance: number,
    compteIds: string[] | null,
    quoi: string,
    rechange: string,
    periode?: PeriodeExtrait,
  ): Promise<void> {
    // Sur une période, les lignes de la période · le report de chaque compte
    // en ajoute une par compte, comptées avec la balance.
    const lignesDeGrandLivre = await this.prisma.ligneEcriture.count({
      where: {
        ecriture: { tenantId, exerciceId, ...HORS_SITUATION, ...(periode ? { AND: [ecrituresDansLaPeriode(periode)] } : {}) },
        ...(compteIds ? { compteId: { in: compteIds } } : {}),
      },
    });
    const total = lignesDeBalance + lignesDeGrandLivre;
    if (total > MAX_LIGNES_EXPORT) {
      throw new PayloadTooLargeException(
        `${quoi} : ${total.toLocaleString('fr-FR')} lignes à exporter, au-delà de la limite de ` +
          `${MAX_LIGNES_EXPORT.toLocaleString('fr-FR')}. ${rechange}`,
      );
    }
  }

  /**
   * LE GRAND LIVRE LU PAR TRANCHES, compte par compte · l'ordre est TOTAL
   * (numéro, date, puis l'à-nouveau en tête de son jour et le solde des
   * comptes de gestion en queue du sien, pièce, identifiant), sans quoi deux
   * tirages du même exercice ne donneraient pas le même solde progressif.
   */
  private async parcourirGrandLivre(
    tenantId: string,
    exerciceId: string,
    compteIds: Set<string>,
    filtreComptes: string[] | null,
    traiter: (l: LigneGrandLivre) => Promise<void>,
    periode?: PeriodeExtrait,
  ): Promise<void> {
    // Sur une période, ses lignes seules · ce qui la précède est au report de
    // chaque compte (`reportsALaVeille`), par la règle de la balance.
    const dates = periode ? { AND: [ecrituresDansLaPeriode(periode)] } : {};
    // Le décompte du départ, sur le MÊME filtre · le curseur relu en base
    // s'arrête sans un mot sur une ligne retirée pendant la production, et le
    // livre lu se confronte à ce compte avant d'être clos (sage-l7, M6).
    const filtre = { ecriture: { tenantId, exerciceId, ...HORS_SITUATION, ...dates }, ...(filtreComptes ? { compteId: { in: filtreComptes } } : {}) };
    const comptees = await this.prisma.ligneEcriture.count({ where: filtre });
    let lues = 0;
    let curseur: string | undefined;
    for (;;) {
      const lot = await this.prisma.ligneEcriture.findMany({
        where: { ecriture: { tenantId, exerciceId, ...HORS_SITUATION, ...dates }, ...(filtreComptes ? { compteId: { in: filtreComptes } } : {}) },
        include: {
          compte: { select: { id: true, numero: true, intitule: true } },
          ecriture: { include: { journal: { select: { code: true } } } },
        },
        ...pageApres(curseur, this.lotExport),
        orderBy: [
          { compte: { numero: 'asc' } },
          { ecriture: { date: 'asc' } },
          { ecriture: { estSoldeDesComptesDeGestion: 'asc' } },
          { ecriture: { estGenereeParCloture: 'desc' } },
          { ecriture: { numeroPiece: 'asc' } },
          { id: 'asc' },
        ],
      });
      lues += lot.length;
      for (const l of lot) if (compteIds.has(l.compteId)) await traiter(l);
      if (lot.length < this.lotExport) break;
      curseur = lot[lot.length - 1].id;
    }
    confronterAuDecompte(lues, comptees, 'Grand livre');
  }

  /**
   * LE GRAND LIVRE COMPTE PAR COMPTE, DANS L'ORDRE DE LA BALANCE · `ouvrir`
   * est appelé pour chaque compte avant sa première ligne, avec son report à
   * la veille sur une période (ligne export-periode, condition 1). Un compte
   * qui n'a, dans la période, QUE son report s'ouvre aussi, à son rang · la
   * balance de la période le porte, et son lien vers sa feuille ne doit pas
   * mener nulle part. Les deux lectures sont rangées par la même base sur le
   * même numéro · une ligne qui arriverait sur un compte déjà refermé ne
   * s'écrit jamais sous un autre, elle arrête le livre.
   */
  private async parcourirParCompte(
    tenantId: string,
    exerciceId: string,
    comptes: ReadonlyArray<{ compteId: string; numero: string }>,
    filtreComptes: string[] | null,
    periode: PeriodeExtrait | undefined,
    ouvrir: (compte: { compteId: string; numero: string }, report: ReportALaVeille | null) => Promise<void>,
    ligne: (l: LigneGrandLivre) => Promise<void>,
  ): Promise<void> {
    const rang = new Map(comptes.map((c, i) => [c.compteId, i]));
    const reports = periode
      ? await this.ecritureService.reportsALaVeille({ tenantId, exerciceId, ...HORS_SITUATION }, periode, filtreComptes)
      : new Map<string, ReportALaVeille>();
    let suivant = 0;
    const ouvrirJusqua = async (i: number) => {
      for (; suivant <= i; suivant++) {
        const c = comptes[suivant];
        // Hors période, seuls les comptes qui ont des lignes s'ouvrent · comme
        // avant cette ligne de travail.
        if (periode || suivant === i) await ouvrir(c, reports.get(c.compteId) ?? null);
      }
    };
    await this.parcourirGrandLivre(
      tenantId,
      exerciceId,
      new Set(rang.keys()),
      filtreComptes,
      async (l) => {
        const i = rang.get(l.compteId)!;
        if (i < suivant - 1) throw new Error(`Grand livre · la ligne ${l.id} arrive après la fermeture de son compte ${l.compte.numero}.`);
        if (i >= suivant) await ouvrirJusqua(i);
        await ligne(l);
      },
      periode,
    );
    if (periode) await ouvrirJusqua(comptes.length - 1);
  }

  /** Les rattachements des comptes de tiers · un par compte (`compteId` unique). */
  private async rattachements(tenantId: string): Promise<Map<string, { code: string; nom: string }>> {
    const r = await this.prisma.tiersCompte.findMany({
      where: { tiers: { tenantId } },
      select: { compteId: true, tiers: { select: { code: true, nom: true } } },
    });
    return new Map(r.map((x) => [x.compteId, x.tiers]));
  }

  /**
   * L'INTITULÉ DU COLLECTIF À TROIS CHIFFRES, LU DANS LE PLAN DU DOSSIER ·
   * semé non complété (« 401 ») quand il a des subdivisions, complété
   * (« 40100000 ») quand il n'en a pas (CLAUDE.md § 7). Jamais un libellé
   * maison · à défaut, le numéro seul.
   */
  private async intitulesDesCollectifs(tenantId: string, racines: string[]): Promise<Map<string, string>> {
    if (racines.length === 0) return new Map();
    const candidats = racines.flatMap((r) => [r, r.padEnd(8, '0')]);
    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, numero: { in: candidats } },
      select: { numero: true, intitule: true },
    });
    const parNumero = new Map(comptes.map((c) => [c.numero, c.intitule]));
    return new Map(racines.map((r) => [r, parNumero.get(r) ?? parNumero.get(r.padEnd(8, '0')) ?? r]));
  }

  private ouvrirClasseur(sortie: Writable): ExcelJS.stream.xlsx.WorkbookWriter {
    const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, ...OPTIONS_CLASSEUR_EN_FLUX });
    classeur.creator = 'OmegaX';
    classeur.created = new Date();
    return classeur;
  }

  // -------------------------------------------------------------------------
  // Écriture d'une balance
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Le grand livre d'une feuille · blocs de compte, total, contrôle
  // -------------------------------------------------------------------------

  /**
   * LE RÉDACTEUR DE BLOCS · un bloc par compte (ou par tiers) · titre en gras,
   * lignes avec le solde progressif SIGNÉ du bloc, « Total du compte » (ou
   * « Total du tiers »). Il rend les totaux de chaque bloc et du livre, pour la
   * ligne de contrôle.
   */
  private redacteur(feuilleDe: () => FeuilleFpm, libelleTotal: string) {
    let bloc: { debit: number; credit: number; solde: number } | null = null;
    const livre = { debit: 0, credit: 0 };
    return {
      async ouvrir(numero: string, nom: string): Promise<void> {
        await feuilleDe().ajouter({ date: numero, libelle: nom }, { gras: true });
        bloc = { debit: 0, credit: 0, solde: 0 };
      },
      /**
       * LE REPORT À LA VEILLE (ligne export-periode, condition 1) · les sommes
       * BRUTES de ce qui précède la période, comme la colonne « Mouvements au
       * <veille> » de la balance · le solde progressif part de lui, et le
       * total du compte le compte, sans quoi le contrôle contre la balance de
       * la période tomberait.
       */
      async report(r: ReportALaVeille): Promise<void> {
        if (!bloc) throw new Error('Report de grand livre écrit hors de tout bloc');
        bloc.debit += r.debit;
        bloc.credit += r.credit;
        bloc.solde += r.debit - r.credit;
        await feuilleDe().ajouter({
          date: r.au,
          libelle: `Report au ${jourFr(r.au)}`,
          debit: montantFpm(r.debit),
          credit: montantFpm(r.credit),
          solde: montantFpm(bloc.solde),
        });
      },
      async ligne(l: LigneGrandLivre): Promise<void> {
        if (!bloc) throw new Error('Ligne de grand livre écrite hors de tout bloc');
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        bloc.debit += debit;
        bloc.credit += credit;
        bloc.solde += debit - credit;
        const libelle = (l.libelle ?? l.ecriture.libelle) + (l.ecriture.statut === 'VALIDEE' ? '' : MENTION_BROUILLARD);
        await feuilleDe().ajouter({
          date: l.ecriture.date,
          journal: l.ecriture.journal.code,
          piece: l.ecriture.numeroPiece === null ? '' : String(l.ecriture.numeroPiece),
          libelle,
          lettre: l.lettre ?? '',
          debit: montantFpm(debit),
          credit: montantFpm(credit),
          solde: montantFpm(bloc.solde),
        });
      },
      async fermer(): Promise<void> {
        if (!bloc) return;
        livre.debit += bloc.debit;
        livre.credit += bloc.credit;
        await feuilleDe().ajouter(
          {
            libelle: libelleTotal,
            debit: montantFpm(bloc.debit),
            credit: montantFpm(bloc.credit),
            solde: montantFpm(bloc.solde),
          },
          { gras: true },
        );
        bloc = null;
      },
      totaux: () => ({ debit: arrondi(livre.debit), credit: arrondi(livre.credit) }),
    };
  }

  /**
   * LA FIN D'UN GRAND LIVRE SUR UNE SEULE FEUILLE · « Totaux », puis le
   * contrôle contre la balance générale.
   */
  private async ecrireFinDeLivre(
    feuille: FeuilleFpm,
    livre: { debit: number; credit: number },
    balance: { debit: number; credit: number },
    precision: string,
  ): Promise<void> {
    await feuille.ajouter(
      {
        libelle: 'Totaux',
        debit: montantFpm(livre.debit),
        credit: montantFpm(livre.credit),
        solde: montantFpm(livre.debit - livre.credit),
      },
      { gras: true, filetHaut: true },
    );
    await this.ecrireControleLivre(feuille, livre, balance, precision);
  }

  /**
   * LE CONTRÔLE D'UN GRAND LIVRE · « Solde à la balance générale », lu sur une
   * AUTRE lecture que les lignes du livre, puis l'ÉCART. Un écart non nul se
   * DIT, chiffré et en gras · il ne se maquille pas, et « aucun » ne s'écrit
   * que sur un écart calculé et nul. Posé en bas du grand livre en une
   * feuille ET en bas de chaque feuille de compte (second tour, relevé B).
   */
  private async ecrireControleLivre(
    feuille: FeuilleFpm,
    livre: { debit: number; credit: number },
    balance: { debit: number; credit: number },
    precision: string,
  ): Promise<void> {
    const solde = (d: number, c: number) => montantFpm(d - c);
    await feuille.ajouter({
      libelle: 'Solde à la balance générale',
      debit: montantFpm(balance.debit),
      credit: montantFpm(balance.credit),
      solde: solde(balance.debit, balance.credit),
    });
    const ecart = { debit: arrondi(livre.debit - balance.debit), credit: arrondi(livre.credit - balance.credit) };
    const nul = ecart.debit === 0 && ecart.credit === 0;
    await feuille.ajouter(
      {
        libelle: nul ? 'Écart : aucun' : `Écart${precision}`,
        debit: montantFpm(ecart.debit),
        credit: montantFpm(ecart.credit),
        solde: solde(ecart.debit, ecart.credit),
      },
      { gras: !nul },
    );
  }

  // -------------------------------------------------------------------------
  // BALANCE GÉNÉRALE
  // -------------------------------------------------------------------------

  /**
   * LA BALANCE DES COMPTES · une feuille « Balance », puis une feuille par
   * compte mouvementé (son grand livre), sauf `avecGrandsLivres` faux · la
   * balance seule, chemin de rechange d'un dossier au-delà du plafond.
   *
   * Pas de sous-totaux par classe (présentation relevée). En fin de tableau,
   * trois lignes · « Totaux comptes de bilan » (classes 1 à 5), « Totaux
   * comptes de gestion » (6 à 8), « Totaux de la balance ». LA CLASSE 9 EN EST
   * HORS · au SYCEBNL elle porte les contributions volontaires en nature
   * « (mémoire, sans impact bilan/résultat) » (Partie 2 ch. 1, cadre
   * comptable) ; au SYSCOHADA ses 90 et 91 sont hors bilan et ses 92 à 99
   * analytiques (AUDCIF Titre VII ch. 1). Chacune de ses divisions mouvementées
   * a sa propre ligne de total, nommée par l'intitulé de la division lu dans le
   * plan du dossier (« Contributions volontaires en nature » au 91 du SYCEBNL,
   * « Engagements obtenus et engagements accordés » au 90 du SYSCOHADA) · un
   * numéro, deux sens, et aucun libellé écrit ici.
   */
  async balanceGeneraleEnFlux(
    tenantId: string,
    exerciceId: string,
    avecGrandsLivres: boolean,
    ouvrir: (nomFichier: string) => Writable,
    extrait?: DemandeDExtrait,
  ): Promise<{ lignes: number }> {
    const periode = extrait?.periode;
    const lu = await this.contexte(tenantId, exerciceId, periode);
    const lignes = await this.balanceFpm(tenantId, exerciceId, periode);
    if (avecGrandsLivres) {
      await this.verifierVolume(
        tenantId,
        exerciceId,
        // Sur une période, chaque feuille de compte porte aussi son report.
        lignes.length * (periode ? 2 : 1),
        null,
        'Balance avec le grand livre de chaque compte',
        "Exportez la balance seule (choix « Balance seule » à l'écran), puis le grand livre compte par compte.",
        periode,
      );
    }
    const intitulesDivisions = await this.intitulesDesDivisions(tenantId, divisionsDeLaClasse9(lignes));
    // Le numéro au dernier moment · tous les refus sont passés (ligne export-periode).
    const ctx = await this.numeroterSiExtrait(lu, extrait, avecGrandsLivres);

    const noms = avecGrandsLivres ? nomsDeFeuilles(lignes.map((l) => l.numero), [FEUILLE_BALANCE]) : [];
    const feuilleDe = new Map(lignes.map((l, i) => [l.compteId, noms[i]]));

    const sortie = ouvrir(`balance${ctx.suffixe}.xlsx`);
    const classeur = this.ouvrirClasseur(sortie);
    const feuille = poserFeuilleFpm(classeur, sortie, {
      nomFeuille: FEUILLE_BALANCE,
      titre: 'Balance des comptes',
      sousTitre: ctx.sousTitre,
      identite: ctx.identite,
      mention: ctx.mention,
      debut: ctx.debut,
      fin: ctx.fin,
      colonnes: COLONNES_BALANCE_FPM,
      entetes: entetesBalanceFpm(ctx.debut, 'Numéro de compte', 'Intitulé des comptes'),
      lignesEntete: 2,
    });

    const { ligneDuCompte } = await ecrireCorpsBalance(feuille, lignes, intitulesDivisions, feuilleDe);
    feuille.fermer();

    let lignesEcrites = lignes.length;
    if (avecGrandsLivres) {
      lignesEcrites += await this.feuillesParCompte(
        classeur,
        sortie,
        tenantId,
        exerciceId,
        ctx,
        lignes.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.intitule, totalDebit: l.totalDebit, totalCredit: l.totalCredit })),
        null,
        feuilleDe,
        ligneDuCompte,
        { titre: 'Grand-livre des comptes', sousTitre: ctx.sousTitre, totalBloc: 'Total du compte' },
      );
    }
    await classeur.commit();
    return { lignes: lignesEcrites };
  }

  /** L'intitulé de chaque division à deux chiffres, lu dans le plan du dossier. */
  private async intitulesDesDivisions(tenantId: string, divisions: string[]): Promise<Map<string, string>> {
    if (divisions.length === 0) return new Map();
    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, numero: { in: divisions } },
      select: { numero: true, intitule: true },
    });
    return new Map(comptes.map((c) => [c.numero, c.intitule]));
  }

  /**
   * UNE FEUILLE PAR COMPTE · le grand livre complet du compte, le lien
   * « Retour à la balance » en A1 vers SA ligne. Les feuilles s'ouvrent l'une
   * après l'autre au fil de la lecture triée par compte · en flux, une feuille
   * est commise avant que la suivante ne commence.
   */
  private async feuillesParCompte(
    classeur: ExcelJS.stream.xlsx.WorkbookWriter,
    sortie: Writable,
    tenantId: string,
    exerciceId: string,
    ctx: Contexte,
    comptes: Array<{ compteId: string; numero: string; nom: string; totalDebit: number; totalCredit: number }>,
    filtreComptes: string[] | null,
    feuilleDe: Map<string, string | undefined>,
    ligneDuCompte: Map<string, number>,
    textes: { titre: string; sousTitre: string; totalBloc: string },
  ): Promise<number> {
    const nomDe = new Map(comptes.map((c) => [c.compteId, c.nom]));
    const balanceDe = new Map(comptes.map((c) => [c.compteId, { debit: arrondi(c.totalDebit), credit: arrondi(c.totalCredit) }]));
    let courante: FeuilleFpm | null = null;
    let compteCourant: string | null = null;
    let redacteur: ReturnType<ExportFpmService['redacteur']> | null = null;
    let nb = 0;
    const fermer = async () => {
      if (redacteur && courante && compteCourant) {
        await redacteur.fermer();
        // La feuille se contrôle elle-même contre SA ligne de balance · le
        // lecteur qui n'ouvre qu'un compte voit que le livre la rend.
        await this.ecrireControleLivre(courante, redacteur.totaux(), balanceDe.get(compteCourant)!, '');
      }
      courante?.fermer();
    };
    await this.parcourirParCompte(
      tenantId,
      exerciceId,
      comptes,
      filtreComptes,
      ctx.periode,
      async (c, report) => {
        await fermer();
        compteCourant = c.compteId;
        const feuille = poserFeuilleFpm(classeur, sortie, {
          nomFeuille: feuilleDe.get(c.compteId) ?? c.numero,
          titre: textes.titre,
          sousTitre: textes.sousTitre,
          identite: ctx.identite,
          mention: ctx.mention,
          debut: ctx.debut,
          fin: ctx.fin,
          colonnes: COLONNES_GRAND_LIVRE_FPM,
          entetes: ENTETES_GRAND_LIVRE_FPM,
          lignesEntete: 1,
          retour: formuleLien(FEUILLE_BALANCE, `A${ligneDuCompte.get(c.compteId) ?? 1}`, 'Retour à la balance'),
        });
        courante = feuille;
        redacteur = this.redacteur(() => feuille, textes.totalBloc);
        await redacteur.ouvrir(c.numero, nomDe.get(c.compteId) ?? c.numero);
        if (report) {
          await redacteur.report(report);
          nb++;
        }
      },
      async (l) => {
        await redacteur!.ligne(l);
        nb++;
      },
    );
    await fermer();
    return nb;
  }

  // -------------------------------------------------------------------------
  // BALANCE DES TIERS
  // -------------------------------------------------------------------------

  /** Le périmètre d'une famille · lignes de balance, nom à imprimer, collectifs. */
  private async perimetreTiers(tenantId: string, exerciceId: string, famille: FamilleTiers) {
    const [lignes, rattaches] = await Promise.all([this.balanceFpm(tenantId, exerciceId), this.rattachements(tenantId)]);
    const retenues = lignes
      .filter((l) => compteDeLaFamille(famille, l.numero, rattaches.has(l.compteId)))
      .map((l) => {
        const tiers = rattaches.get(l.compteId);
        // UN COMPTE DE TIERS SANS TIERS NE SE TAIT PAS · il se nomme, c'est lui
        // qui échappera à la circularisation (règle de la balance auxiliaire).
        return { ...l, nom: tiers ? tiers.nom : `${l.intitule} · aucun tiers rattaché` };
      });
    const racines = [...new Set(retenues.map((l) => l.numero.slice(0, 3)))];
    return { retenues, racines };
  }

  /**
   * LE CONTRÔLE D'UNE FAMILLE SE LIT AILLEURS QUE LA FAMILLE (second tour,
   * relevé A) · comparer le total des comptes retenus au total des MÊMES
   * lignes de la même balance ne pourrait jamais rien montrer. La base somme
   * donc elle-même, par trois agrégats, toutes les lignes de l'exercice dont
   * le compte commence par le divisionnaire de la famille (40, 41, 42), tous
   * comptes compris, rattachés ou non, détail ou non · pour les autres tiers,
   * par les collectifs à trois chiffres qu'ils occupent, où un compte sans
   * tiers reste et fait l'écart. Mêmes trois colonnes que la balance
   * (`filtresDesTroisColonnes`), brouillard compris comme elle.
   */
  private async soldesDesCollectifs(
    tenantId: string,
    exerciceId: string,
    famille: FamilleTiers,
    racines: string[],
  ): Promise<TotauxBalance> {
    const prefixes = famille === 'AUTRES' ? racines : [divisionnaireDeLaFamille(famille)];
    if (prefixes.length === 0) return { avantDebit: 0, avantCredit: 0, mouvementDebit: 0, mouvementCredit: 0, solde: 0 };
    const filtres = filtresDesTroisColonnes({ tenantId, exerciceId });
    const compte = { OR: prefixes.map((p) => ({ numero: { startsWith: p } })) };
    // La colonne, jamais un filtre reçu · le filet des simulations
    // (`lectures-hors-situation.spec.ts`) lit ici `filtresDesTroisColonnes`.
    const somme = (colonne: 'reports' | 'mouvements' | 'clotures') =>
      this.prisma.ligneEcriture.aggregate({ where: { ecriture: filtres[colonne], compte }, _sum: { debit: true, credit: true } });
    const [r, m, c] = await Promise.all([somme('reports'), somme('mouvements'), somme('clotures')]);
    const n = (v: unknown) => Number(v ?? 0);
    const avantDebit = n(r._sum.debit);
    const avantCredit = n(r._sum.credit);
    const mouvementDebit = n(m._sum.debit) + n(c._sum.debit);
    const mouvementCredit = n(m._sum.credit) + n(c._sum.credit);
    return {
      avantDebit: arrondi(avantDebit),
      avantCredit: arrondi(avantCredit),
      mouvementDebit: arrondi(mouvementDebit),
      mouvementCredit: arrondi(mouvementCredit),
      solde: arrondi(avantDebit + mouvementDebit - avantCredit - mouvementCredit),
    };
  }

  /**
   * LA BALANCE DES TIERS · une famille par classeur. Une ligne par compte de
   * tiers (numéro, nom du tiers), un sous-total par collectif à trois
   * chiffres, « Total » suivi de l'intitulé du compte LU DANS LE PLAN DU
   * DOSSIER, puis « Total général », puis le contrôle « Solde à la balance
   * générale » et son écart. Une feuille par tiers mouvementé, son grand livre.
   */
  async balanceTiersEnFlux(
    tenantId: string,
    exerciceId: string,
    famille: FamilleTiers,
    avecGrandsLivres: boolean,
    ouvrir: (nomFichier: string) => Writable,
  ): Promise<{ lignes: number }> {
    const ctx = await this.contexte(tenantId, exerciceId);
    const { retenues, racines } = await this.perimetreTiers(tenantId, exerciceId, famille);
    const ids = retenues.map((l) => l.compteId);
    if (avecGrandsLivres) {
      await this.verifierVolume(
        tenantId,
        exerciceId,
        retenues.length + racines.length + 4,
        ids,
        'Balance des tiers avec le grand livre de chaque tiers',
        "Exportez la balance des tiers seule (choix « Balance seule » à l'écran), puis le grand-livre des tiers.",
      );
    }
    const intitules = await this.intitulesDesCollectifs(tenantId, racines);
    const noms = avecGrandsLivres ? nomsDeFeuilles(retenues.map((l) => l.numero), [FEUILLE_BALANCE]) : [];
    const feuilleDe = new Map(retenues.map((l, i) => [l.compteId, noms[i]]));
    const sousTitre = sousTitreFamille(famille, ctx.referentiel);

    const sortie = ouvrir(`balance-tiers-${famille.toLowerCase()}${ctx.suffixe}.xlsx`);
    const classeur = this.ouvrirClasseur(sortie);
    const feuille = poserFeuilleFpm(classeur, sortie, {
      nomFeuille: FEUILLE_BALANCE,
      titre: 'Balance des tiers',
      sousTitre,
      identite: ctx.identite,
      mention: ctx.mention,
      debut: ctx.debut,
      fin: ctx.fin,
      colonnes: COLONNES_BALANCE_FPM,
      entetes: entetesBalanceFpm(ctx.debut, 'Numéro de compte', 'Tiers'),
      lignesEntete: 2,
    });

    const ligneDuCompte = new Map<string, number>();
    const rangsSousTotaux: number[] = [];
    for (const racine of racines) {
      const groupe = retenues.filter((l) => l.numero.startsWith(racine));
      const rangs: number[] = [];
      for (const l of groupe) {
        const r = await ecrireLigneDeCompte(feuille, l, l.nom, feuilleDe.get(l.compteId));
        ligneDuCompte.set(l.compteId, r);
        rangs.push(r);
      }
      rangsSousTotaux.push(
        await ecrireTotal(
          feuille,
          `Total ${intitules.get(racine) ?? racine}`,
          totauxBalance(groupe),
          plageBalance(rangs[0], rangs[rangs.length - 1]),
        ),
      );
    }
    const tGeneral = totauxBalance(retenues);
    await ecrireTotal(feuille, 'Total général', tGeneral, (col) =>
      rangsSousTotaux.length === 0 ? '0' : rangsSousTotaux.map((r) => `${col}${r}`).join('+'),
    );
    const tBalance = await this.soldesDesCollectifs(tenantId, exerciceId, famille, racines);
    await this.ecrireControle(feuille, tBalance, ecartBalance(tGeneral, tBalance));
    feuille.fermer();

    let lignesEcrites = retenues.length;
    if (avecGrandsLivres) {
      lignesEcrites += await this.feuillesParCompte(
        classeur,
        sortie,
        tenantId,
        exerciceId,
        ctx,
        retenues.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.nom, totalDebit: l.totalDebit, totalCredit: l.totalCredit })),
        ids,
        feuilleDe,
        ligneDuCompte,
        { titre: 'Grand-livre des tiers', sousTitre, totalBloc: 'Total du tiers' },
      );
    }
    await classeur.commit();
    return { lignes: lignesEcrites };
  }

  /**
   * LA LIGNE DE CONTRÔLE D'UNE BALANCE DES TIERS · les collectifs tels que la
   * balance générale les porte, puis l'écart avec le total général. Un écart
   * non nul se DIT, chiffré, en gras ; « aucun » ne s'écrit que sur un écart
   * calculé et nul. Valeurs et non formules · la balance générale n'est pas
   * dans ce classeur.
   */
  private async ecrireControle(feuille: FeuilleFpm, balance: TotauxBalance, ecart: TotauxBalance): Promise<void> {
    const valeurs = (t: TotauxBalance) => {
      const s = soldeEnDeuxColonnes(t.solde);
      return {
        avantDebit: montantFpm(t.avantDebit),
        avantCredit: montantFpm(t.avantCredit),
        mouvementDebit: montantFpm(t.mouvementDebit),
        mouvementCredit: montantFpm(t.mouvementCredit),
        soldeDebit: s.debit,
        soldeCredit: s.credit,
      };
    };
    await feuille.ajouter({ intitule: 'Solde à la balance générale', ...valeurs(balance) }, { filetHaut: true });
    const nul = estNulBalance(ecart);
    // L'écart des colonnes de mouvements est une DIFFÉRENCE, signée · il peut
    // être négatif, et le format l'imprime avec son signe.
    await feuille.ajouter(
      {
        intitule: nul ? 'Écart : aucun' : 'Écart avec la balance générale',
        avantDebit: montantFpm(ecart.avantDebit),
        avantCredit: montantFpm(ecart.avantCredit),
        mouvementDebit: montantFpm(ecart.mouvementDebit),
        mouvementCredit: montantFpm(ecart.mouvementCredit),
        ...(() => {
          const s = soldeEnDeuxColonnes(ecart.solde);
          return { soldeDebit: s.debit, soldeCredit: s.credit };
        })(),
      },
      { gras: !nul },
    );
  }

  // -------------------------------------------------------------------------
  // GRANDS LIVRES SUR UNE FEUILLE
  // -------------------------------------------------------------------------

  /**
   * LE GRAND LIVRE DES COMPTES, présentation du cabinet · une feuille, un bloc
   * par compte mouvementé, « Total du compte », « TotauxBalance », contrôle contre la
   * balance générale.
   */
  async grandLivreEnFlux(
    tenantId: string,
    exerciceId: string,
    ouvrir: (nomFichier: string) => Writable,
    options: { extrait?: DemandeDExtrait; compteId?: string } = {},
  ): Promise<{ lignes: number }> {
    const periode = options.extrait?.periode;
    const lu = await this.contexte(tenantId, exerciceId, periode);
    const toutes = await this.balanceFpm(tenantId, exerciceId, periode);
    // LE GRAND LIVRE D'UN COMPTE (« Exporter ce compte ») · relu dans le
    // dossier, 404 nommé sinon ; sans mouvement jusqu'au dernier jour, rien à
    // remettre, et un extrait vide ne prend aucun numéro.
    const lignes = options.compteId ? toutes.filter((l) => l.compteId === options.compteId) : toutes;
    if (options.compteId && lignes.length === 0) {
      const compte = await this.prisma.compte.findFirst({ where: { id: options.compteId, tenantId }, select: { numero: true } });
      if (!compte) throw new NotFoundException('Compte introuvable dans ce dossier.');
      throw new BadRequestException(
        `Aucun mouvement sur le compte ${compte.numero} ${periode ? `jusqu'au ${jourFr(periode.au)}` : 'dans cet exercice'} · rien à exporter.`,
      );
    }
    const filtreComptes = options.compteId ? [options.compteId] : null;
    await this.verifierVolume(
      tenantId,
      exerciceId,
      periode ? lignes.length : 0,
      filtreComptes,
      'Grand livre',
      'Exportez la balance seule, puis le grand livre compte par compte.',
      periode,
    );
    const balance = {
      debit: arrondi(lignes.reduce((s, l) => s + l.totalDebit, 0)),
      credit: arrondi(lignes.reduce((s, l) => s + l.totalCredit, 0)),
    };
    // Le numéro au dernier moment · tous les refus sont passés (ligne export-periode).
    const ctx = await this.numeroterSiExtrait(lu, options.extrait, true);
    const seul = options.compteId ? lignes[0] : null;
    return this.grandLivreSurUneFeuille(
      tenantId,
      exerciceId,
      ctx,
      lignes.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.intitule })),
      filtreComptes,
      balance,
      {
        fichier: `grand-livre${seul ? `-${seul.numero}` : ''}${ctx.suffixe}.xlsx`,
        titre: 'Grand-livre des comptes',
        // Le compte seul de l'exercice entier ne se dit pas « Complète » ·
        // c'est le livre d'UN compte, jamais le grand livre de l'exercice.
        sousTitre: seul ? (ctx.periode ? `${ctx.sousTitre} · compte ${seul.numero}` : `Compte ${seul.numero} · exercice entier`) : ctx.sousTitre,
        totalBloc: 'Total du compte',
        precision: '',
      },
      ouvrir,
    );
  }

  /**
   * LE GRAND-LIVRE DES TIERS, une famille par classeur (n'existait pas) · un
   * bloc par compte de tiers, « Total du tiers », « TotauxBalance », contrôle contre
   * les collectifs de la balance générale.
   */
  async grandLivreTiersEnFlux(
    tenantId: string,
    exerciceId: string,
    famille: FamilleTiers,
    ouvrir: (nomFichier: string) => Writable,
  ): Promise<{ lignes: number }> {
    const ctx = await this.contexte(tenantId, exerciceId);
    const { retenues, racines } = await this.perimetreTiers(tenantId, exerciceId, famille);
    const ids = retenues.map((l) => l.compteId);
    await this.verifierVolume(
      tenantId,
      exerciceId,
      0,
      ids,
      'Grand-livre des tiers',
      'Exportez la balance des tiers seule, puis le grand livre tiers par tiers.',
    );
    const collectifs = await this.soldesDesCollectifs(tenantId, exerciceId, famille, racines);
    const balance = {
      debit: arrondi(collectifs.avantDebit + collectifs.mouvementDebit),
      credit: arrondi(collectifs.avantCredit + collectifs.mouvementCredit),
    };
    return this.grandLivreSurUneFeuille(
      tenantId,
      exerciceId,
      ctx,
      retenues.map((l) => ({ compteId: l.compteId, numero: l.numero, nom: l.nom })),
      ids,
      balance,
      {
        fichier: `grand-livre-tiers-${famille.toLowerCase()}${ctx.suffixe}.xlsx`,
        titre: 'Grand-livre des tiers',
        sousTitre: sousTitreFamille(famille, ctx.referentiel),
        totalBloc: 'Total du tiers',
        // Au-delà des 40, 41 et 42, l'écart vient des comptes des mêmes
        // collectifs qui ne sont rattachés à aucun tiers · la ligne le dit.
        precision: famille === 'AUTRES' ? ' (comptes des collectifs sans tiers rattaché)' : '',
      },
      ouvrir,
    );
  }

  private async grandLivreSurUneFeuille(
    tenantId: string,
    exerciceId: string,
    ctx: Contexte,
    comptes: Array<{ compteId: string; numero: string; nom: string }>,
    filtreComptes: string[] | null,
    balance: { debit: number; credit: number },
    textes: { fichier: string; titre: string; sousTitre: string; totalBloc: string; precision: string },
    ouvrir: (nomFichier: string) => Writable,
  ): Promise<{ lignes: number }> {
    const nomDe = new Map(comptes.map((c) => [c.compteId, c.nom]));
    const sortie = ouvrir(textes.fichier);
    const classeur = this.ouvrirClasseur(sortie);
    const feuille = poserFeuilleFpm(classeur, sortie, {
      nomFeuille: textes.titre,
      titre: textes.titre,
      sousTitre: textes.sousTitre,
      identite: ctx.identite,
      mention: ctx.mention,
      debut: ctx.debut,
      fin: ctx.fin,
      colonnes: COLONNES_GRAND_LIVRE_FPM,
      entetes: ENTETES_GRAND_LIVRE_FPM,
      lignesEntete: 1,
    });
    const redacteur = this.redacteur(() => feuille, textes.totalBloc);
    let compteCourant: string | null = null;
    let nb = 0;
    await this.parcourirParCompte(
      tenantId,
      exerciceId,
      comptes,
      filtreComptes,
      ctx.periode,
      async (c, report) => {
        if (compteCourant) await redacteur.fermer();
        compteCourant = c.compteId;
        await redacteur.ouvrir(c.numero, nomDe.get(c.compteId) ?? c.numero);
        if (report) {
          await redacteur.report(report);
          nb++;
        }
      },
      async (l) => {
        await redacteur.ligne(l);
        nb++;
      },
    );
    if (compteCourant) await redacteur.fermer();
    await this.ecrireFinDeLivre(feuille, redacteur.totaux(), balance, textes.precision);
    feuille.fermer();
    await classeur.commit();
    return { lignes: nb };
  }
}

/** La famille lue dans la requête · refus nommé, jamais un défaut deviné. */
export function familleOuRefus(brut: string | undefined): FamilleTiers {
  if (estFamilleTiers(brut)) return brut;
  throw new BadRequestException(
    'Type de tiers à préciser · FOURNISSEURS (40), CLIENTS (41), SALARIES (42) ou AUTRES (autres comptes de tiers de la classe 4). Un classeur porte une seule famille.',
  );
}
