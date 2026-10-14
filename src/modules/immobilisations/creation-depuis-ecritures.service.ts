import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Referentiel, StatutEcriture, StatutExercice } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ImmobilisationService } from './immobilisation.service';
import { estCompteDeBien } from './compte-du-bien';
import { fondsDuCompte } from './reprise-subvention';
import { RACINE_DETTE_RESERVE_PROPRIETE } from './reserve-propriete';
import { LigneACreer, motifRefusLigneACreer } from './creation-depuis-ecritures';
import type { CreerDepuisEcritureDto } from './dto/creation-depuis-ecritures.dto';

const PLAFOND_LIGNES = 200;
/** Le libellé que `detenteursDe` donne à la fiche dont l'écriture est l'acquisition. */
const DETENTEUR_ACQUISITION = 'une immobilisation (acquisition)';
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
      ...(borne.exerciceId ? { exerciceId: borne.exerciceId } : {}),
      ...(borne.valideesDesExercicesOuverts ? { statut: StatutEcriture.VALIDEE, exercice: { statut: StatutExercice.OUVERT } } : {}),
      estGenereeParCloture: false,
      estANouveauProvisoire: false,
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
      journal: { select: { code: true } },
      exercice: { select: { statut: true, dateFin: true } },
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
    const tenues = await this.tenuesParUnAutreModule(tenantId, lues.map((l) => l.ecriture.id));
    return {
      total,
      tronque: total > lues.length,
      lignes: lues.map((l) => {
        const motifRefus = motifRefusLigneACreer(this.jugement(referentiel, l, tenues.get(l.ecriture.id) ?? []));
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
    const autres = (await this.ecritures.detenteursDeLEcriture(tenantId, l.ecriture.id)).filter((d) => d !== DETENTEUR_ACQUISITION);
    const motif = motifRefusLigneACreer(this.jugement(referentiel, l, autres));
    if (motif) throw new BadRequestException(motif);

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
      const autres = (await this.ecritures.detenteursDesEcritures(tenantId, lot)).filter((d) => d !== DETENTEUR_ACQUISITION);
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

  private jugement(referentiel: Referentiel, l: LigneLue, autresModules: string[]): LigneACreer {
    const duModule = l.ecriture.immobilisationsAcquisition.find((i) => i.ligneAcquisitionId === null);
    const ref = referentiel === Referentiel.SYCEBNL ? 'SYCEBNL' : 'SYSCOHADA';
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
    };
  }

  private async referentiel(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    return t.referentiel;
  }
}
