import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Referentiel, StatutEcriture, StatutExercice, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import {
  DETENTEUR_ACQUISITION_IMMOBILISATION,
  DETENTEUR_DONATION,
  DETENTEUR_EXECUTION_ENGAGEMENT,
  EcritureService,
} from '../comptabilite/ecriture.service';
import { ImmobilisationService } from './immobilisation.service';
import { estCompteDeBien } from './compte-du-bien';
import { fondsDuCompte } from './reprise-subvention';
import { RACINE_DETTE_RESERVE_PROPRIETE } from './reserve-propriete';
import { LigneACreer, avertissementsLigneACreer, confirmationPremierJour, motifRefusLigneACreer } from './creation-depuis-ecritures';
import type { CreerDepuisEcritureDto } from './dto/creation-depuis-ecritures.dto';

const PLAFOND_LIGNES = 200;
/**
 * LES DÉTENTEURS QUI NE REFUSENT PAS LA FICHE · la fiche née d'une autre
 * ligne de la même pièce (jugée par `immobilisationsAcquisition`), et les
 * modules qui LISENT une pièce passée sans la produire · la donation du
 * registre des donateurs (un don en nature D 2 / C 14) et l'exécution d'un
 * engagement de dépense rattachent une écriture existante (relecture M5).
 * Refusée, la pièce n'avait plus d'issue · « Nouvelle immobilisation »
 * aurait passé une seconde écriture et doublé le brut au bilan.
 */
const DETENTEURS_QUI_NE_REFUSENT_PAS: ReadonlySet<string> = new Set([
  DETENTEUR_ACQUISITION_IMMOBILISATION,
  DETENTEUR_DONATION,
  DETENTEUR_EXECUTION_ENGAGEMENT,
]);
/** Les journaux d'où une pièce du premier jour est d'ordinaire une acquisition. */
const JOURNAUX_D_ACQUISITION: ReadonlySet<TypeJournal> = new Set([TypeJournal.ACHATS, TypeJournal.TRESORERIE]);
const n = (x: unknown) => Number(x ?? 0);
const jourIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * LES LIGNES AU DÉBIT D'UN COMPTE DE BIEN QU'AUCUNE FICHE NE PORTE · un seul
 * filtre pour la liste du n° 68 et la maintenance du n° 73. Une ligne est
 * portée par une fiche quand la fiche est NÉE d'elle (`immobilisationAcquise`)
 * ou quand l'écriture est une opération du module sur un bien · son
 * acquisition, sa mise en service, son reclassement, sa réévaluation,
 * l'incorporation de coûts d'emprunt, la provision pour démantèlement, et un
 * traitement annulé avec son négatif. Les clôtures et l'à-nouveau provisoire
 * n'en sont pas (le bien y est reporté, pas acquis).
 */
export function filtreLignesDeBienSansFiche(
  tenantId: string,
  referentiel: Referentiel,
  borne: { valideesDesExercicesOuverts?: boolean; exerciceId?: string },
): Prisma.LigneEcritureWhereInput {
  const racines = referentiel === Referentiel.SYCEBNL ? ['20', '21', '22', '23', '24'] : ['21', '22', '23', '24'];
  return {
    debit: { gt: 0 },
    immobilisationAcquise: null,
    compte: { tenantId, OR: racines.map((r) => ({ numero: { startsWith: r } })) },
    ecriture: {
      tenantId,
      // LE STATUT EST TOUJOURS POSÉ (intégration avec la ligne sage-l1) · une
      // écriture de SITUATION n'enregistre aucune opération (AUDCIF art. 19 ;
      // `ecritures-de-situation.ts`) · elle ne fait naître aucun bien, et la
      // maintenance, qui confronte le registre à la balance, ne la compte pas
      // plus que la balance.
      statut: borne.valideesDesExercicesOuverts ? StatutEcriture.VALIDEE : HORS_SITUATION.statut,
      ...(borne.exerciceId ? { exerciceId: borne.exerciceId } : {}),
      ...(borne.valideesDesExercicesOuverts ? { exercice: { statut: StatutExercice.OUVERT } } : {}),
      estGenereeParCloture: false,
      estANouveauProvisoire: false,
      // Relecture M2 · une écriture inscrite en négatif par sa correction ne
      // porte plus de bien (AUDCIF art. 20, al. 2) · la ligne exacte est celle
      // de la pièce qui la remplace.
      correction: null,
      // L'acquisition que le module a passée · une fiche née d'une écriture
      // déjà passée porte sa ligne, pas l'écriture entière.
      immobilisationsAcquisition: { none: { ligneAcquisitionId: null } },
      immobilisationMiseEnService: null,
      reclassementImmobilisation: null,
      reevaluationBilan: null,
      coutEmpruntIncorpore: null,
      mouvementDemantelement: null,
      annulationTraitementOrigine: null,
      annulationTraitementNegatif: null,
    },
  };
}

/** Ce que la lecture d'une ligne candidate ramène · une seule forme pour la liste et la création. */
const SELECTION_LIGNE = {
  id: true,
  debit: true,
  credit: true,
  libelle: true,
  compteId: true,
  compte: { select: { numero: true, intitule: true } },
  immobilisationAcquise: { select: { designation: true } },
  ecriture: {
    select: {
      id: true,
      statut: true,
      date: true,
      numeroPiece: true,
      libelle: true,
      journalId: true,
      exerciceId: true,
      estGenereeParCloture: true,
      estANouveauProvisoire: true,
      journal: { select: { code: true, type: true } },
      exercice: { select: { statut: true, dateDebut: true, dateFin: true } },
      correction: { select: { numeroPiece: true } },
      immobilisationsAcquisition: { select: { designation: true, ligneAcquisitionId: true }, take: 50 },
      lignes: { select: { debit: true, credit: true, compte: { select: { numero: true } } }, take: 200 },
    },
  },
} satisfies Prisma.LigneEcritureSelect;

type LigneLue = Prisma.LigneEcritureGetPayload<{ select: typeof SELECTION_LIGNE }>;

/**
 * CRÉER LES BIENS À PARTIR DES ÉCRITURES DÉJÀ PASSÉES (ligne sage-l4,
 * fonction n° 68) · la liste des lignes d'acquisition qu'aucune fiche ne
 * porte, et la fiche née d'une ligne choisie, par la création ordinaire
 * (`ImmobilisationService.creer`, mêmes contrôles) sans écriture nouvelle.
 */
@Injectable()
export class CreationDepuisEcrituresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly immobilisations: ImmobilisationService,
    private readonly ecritures: EcritureService,
  ) {}

  /**
   * Les lignes au débit d'un compte de bien, VALIDÉES, d'un exercice ouvert,
   * qu'aucune fiche ne porte · les plus récentes d'abord, bornées, le total et
   * `tronque` le disent (§ 8 bis). Chaque ligne dit si elle peut faire naître
   * un bien, et sinon pourquoi.
   */
  async lignes(tenantId: string) {
    const referentiel = await this.referentiel(tenantId);
    const where = filtreLignesDeBienSansFiche(tenantId, referentiel, { valideesDesExercicesOuverts: true });
    const [lues, total] = await Promise.all([
      this.prisma.ligneEcriture.findMany({
        where,
        select: SELECTION_LIGNE,
        orderBy: [{ ecriture: { date: 'desc' } }, { id: 'asc' }],
        take: PLAFOND_LIGNES,
      }),
      this.prisma.ligneEcriture.count({ where }),
    ]);
    const [tenues, negatifs] = await Promise.all([
      this.tenuesParUnAutreModule(tenantId, lues.map((l) => l.ecriture.id)),
      this.negatifsAilleurs(tenantId, lues),
    ]);
    return {
      total,
      tronque: total > lues.length,
      lignes: lues.map((l) => {
        const jugee = this.jugement(referentiel, l, tenues.get(l.ecriture.id) ?? [], negatifs);
        const motifRefus = motifRefusLigneACreer(jugee);
        return {
          ligneId: l.id,
          ecritureId: l.ecriture.id,
          numeroPiece: l.ecriture.numeroPiece,
          journal: l.ecriture.journal.code,
          date: jourIso(l.ecriture.date),
          libelle: l.libelle || l.ecriture.libelle,
          compte: { numero: l.compte.numero, intitule: l.compte.intitule },
          montant: n(l.debit),
          motifRefus,
          avertissements: motifRefus ? [] : avertissementsLigneACreer(jugee),
          confirmationRequise: motifRefus ? null : confirmationPremierJour(jugee),
        };
      }),
    };
  }

  /** La fiche née de la ligne · aucune écriture n'est passée, celle de la ligne est retenue. */
  async creer(tenantId: string, userId: string, dto: CreerDepuisEcritureDto) {
    const referentiel = await this.referentiel(tenantId);
    const l = await this.prisma.ligneEcriture.findFirst({ where: { id: dto.ligneId, ecriture: { tenantId } }, select: SELECTION_LIGNE });
    if (!l) throw new NotFoundException('Ligne introuvable dans ce dossier.');
    // Tous les modules qui tiennent l'écriture, lus par la liste même du refus
    // de suppression · jamais une copie (`detenteursDe`).
    const autres = (await this.ecritures.detenteursDeLEcriture(tenantId, l.ecriture.id)).filter((d) => !DETENTEURS_QUI_NE_REFUSENT_PAS.has(d));
    const jugee = this.jugement(referentiel, l, autres, await this.negatifsAilleurs(tenantId, [l]));
    const motif = motifRefusLigneACreer(jugee);
    if (motif) throw new BadRequestException(motif);
    const aConfirmer = confirmationPremierJour(jugee);
    if (aConfirmer && dto.confirmerPremierJour !== true) throw new BadRequestException(aConfirmer);

    const reserve = l.ecriture.lignes.some((x) => n(x.credit) > 0 && x.compte.numero.startsWith(RACINE_DETTE_RESERVE_PROPRIETE));
    try {
      return await this.immobilisations.creer(
        tenantId,
        userId,
        {
          compteImmobilisationId: l.compteId,
          designation: (dto.designation?.trim() || l.libelle || l.ecriture.libelle).slice(0, 500),
          numeroInventaire: dto.numeroInventaire?.trim() || undefined,
          lieuId: dto.lieuId,
          dateAcquisition: jourIso(l.ecriture.date),
          // Jamais posée d'office (AUDCIF art. 45, « en état de fonctionner ») ·
          // absente, le bien n'est pas encore en service, comme à la création ;
          // l'écran PROPOSE la date de la pièce, que le cabinet confirme.
          dateMiseEnService: dto.dateMiseEnService ?? undefined,
          natureFiscaleCle: dto.natureFiscaleCle ?? undefined,
          valeurOrigine: n(l.debit),
          valeurResiduelle: dto.valeurResiduelle,
          dureeAmortissementAns: dto.dureeAmortissementAns,
          modeAmortissement: dto.modeAmortissement,
          unitesOeuvrePrevues: dto.unitesOeuvrePrevues,
          uniteOeuvreLibelle: dto.uniteOeuvreLibelle,
          exerciceId: l.ecriture.exerciceId,
          journalId: l.ecriture.journalId,
          // La clause se déduit d'une dette au 4816 de la pièce, comme à la création.
          ...(reserve ? { reserveDePropriete: true } : {}),
        },
        { ecritureExistante: { ecritureId: l.ecriture.id, ligneId: l.id } },
      );
    } catch (err) {
      // Deux gestes sur la même ligne · l'unicité de la ligne tranche.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Cette ligne vient de faire naître une fiche · une ligne, un bien.');
      }
      throw err;
    }
  }

  /**
   * Les écritures de la page qu'un AUTRE module tient (donation, abonnement,
   * engagement, écart d'inventaire…), avec ses libellés · la liste même du
   * refus de suppression (`detenteursDe`), jamais une copie. Elle se lit sur un
   * lot ; la page est donc partagée par moitiés tant qu'un lot répond, si bien
   * qu'une page sans écriture tenue coûte une seule lecture.
   */
  private async tenuesParUnAutreModule(tenantId: string, ecritureIds: string[]): Promise<Map<string, string[]>> {
    const tenues = new Map<string, string[]>();
    const explorer = async (lot: string[]): Promise<void> => {
      if (lot.length === 0) return;
      const autres = (await this.ecritures.detenteursDesEcritures(tenantId, lot)).filter((d) => !DETENTEURS_QUI_NE_REFUSENT_PAS.has(d));
      if (autres.length === 0) return;
      if (lot.length === 1) {
        tenues.set(lot[0], autres);
        return;
      }
      const milieu = Math.ceil(lot.length / 2);
      await explorer(lot.slice(0, milieu));
      await explorer(lot.slice(milieu));
    };
    await explorer([...new Set(ecritureIds)]);
    return tenues;
  }

  /**
   * LE MÊME MONTANT INSCRIT EN NÉGATIF À CE COMPTE PAR UNE AUTRE PIÈCE
   * (relecture M2) · une réimputation ou une écriture en négatif saisie à la
   * main, validée, d'un exercice ouvert, qui n'est ni une correction liée (son
   * origine est déjà écartée) ni elle-même corrigée. Une seule lecture pour la
   * page, bornée · la clé est le compte et le montant au centime.
   */
  private async negatifsAilleurs(tenantId: string, lignes: readonly LigneLue[]): Promise<Map<string, { ecritureId: string; numeroPiece: number | null }[]>> {
    const comptes = [...new Set(lignes.map((l) => l.compteId))];
    const parCle = new Map<string, { ecritureId: string; numeroPiece: number | null }[]>();
    if (comptes.length === 0) return parCle;
    const negatifs = await this.prisma.ligneEcriture.findMany({
      where: {
        compteId: { in: comptes },
        debit: { lt: 0 },
        ecriture: {
          tenantId,
          statut: StatutEcriture.VALIDEE,
          exercice: { statut: StatutExercice.OUVERT },
          corrigeEcritureId: null,
          correction: null,
        },
      },
      select: { compteId: true, debit: true, ecriture: { select: { id: true, numeroPiece: true } } },
      take: 2000,
    });
    for (const x of negatifs) {
      const cle = `${x.compteId}|${Math.round(-n(x.debit) * 100)}`;
      parCle.set(cle, [...(parCle.get(cle) ?? []), { ecritureId: x.ecriture.id, numeroPiece: x.ecriture.numeroPiece }]);
    }
    return parCle;
  }

  private jugement(
    referentiel: Referentiel,
    l: LigneLue,
    autresModules: string[],
    negatifs: Map<string, { ecritureId: string; numeroPiece: number | null }[]>,
  ): LigneACreer {
    const duModule = l.ecriture.immobilisationsAcquisition.find((i) => i.ligneAcquisitionId === null);
    const ref = referentiel === Referentiel.SYCEBNL ? 'SYCEBNL' : 'SYSCOHADA';
    const ailleurs = (negatifs.get(`${l.compteId}|${Math.round(n(l.debit) * 100)}`) ?? []).find((x) => x.ecritureId !== l.ecriture.id);
    const premierJour = jourIso(l.ecriture.date) === jourIso(l.ecriture.exercice.dateDebut);
    return {
      referentiel,
      statutEcriture: l.ecriture.statut,
      exerciceClos: l.ecriture.exercice.statut === StatutExercice.CLOTURE,
      estANouveau: l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire,
      debit: n(l.debit),
      numeroCompte: l.compte.numero,
      dejaRattacheeA: l.immobilisationAcquise?.designation ?? null,
      acquisitionDuModule: duModule?.designation ?? null,
      autresModules,
      lignesDeBien: l.ecriture.lignes.filter((x) => n(x.debit) > 0 && estCompteDeBien(referentiel, x.compte.numero)).length,
      fondsAuCredit: [
        ...new Set(l.ecriture.lignes.filter((x) => n(x.credit) > 0 && !!fondsDuCompte(ref, x.compte.numero)).map((x) => x.compte.numero)),
      ],
      corrigeeParLaPiece: l.ecriture.correction ? String(l.ecriture.correction.numeroPiece ?? '·') : null,
      credits: [...new Set(l.ecriture.lignes.filter((x) => n(x.credit) > 0).map((x) => x.compte.numero))],
      negatifSurUnCompteDeBien: l.ecriture.lignes.some(
        (x) => (n(x.debit) < 0 || n(x.credit) < 0) && estCompteDeBien(referentiel, x.compte.numero),
      ),
      premierJourHorsAchats: premierJour && !JOURNAUX_D_ACQUISITION.has(l.ecriture.journal.type) ? l.ecriture.journal.code : null,
      memeMontantEnNegatifAilleurs: ailleurs ? String(ailleurs.numeroPiece ?? '·') : null,
    };
  }

  private async referentiel(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    return t.referentiel;
  }
}
