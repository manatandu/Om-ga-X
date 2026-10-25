import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StatutRapprochement } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MaintenanceImmobilisationsService } from '../immobilisations/maintenance-immobilisations.service';
import { ProvisionsService } from '../provisions/provisions.service';
import { CreancesDouteusesService } from '../creances-douteuses/creances-douteuses.service';
import { EtatsAnalytiquesService } from '../analytique/etats-analytiques.service';
import { RapprochementService } from '../rapprochement/rapprochement.service';
import { famille, ligne, nonCalculee, synthese, type FamilleConcordance } from './concordance';

/** Au plus cinquante comptes de banque lus · un dossier n'en tient jamais autant, et le dépassement se dit. */
export const PLAFOND_BANQUES = 50;

/** Un montant en francs, au centime, quelle que soit sa forme (`Decimal` relu, chaîne, nombre). */
const nombre = (v: unknown): number => Math.round(Number(v) * 100) / 100;

type Entete = Pick<FamilleConcordance, 'cle' | 'libelle' | 'source' | 'ecran' | 'chemin'>;

const IMMOBILISATIONS: Entete = {
  cle: 'IMMOBILISATIONS',
  libelle: 'Immobilisations · valeurs brutes',
  source: 'Registre des biens en place à la clôture (tableau des amortissements)',
  ecran: 'Immobilisations, onglet Maintenance',
  chemin: '/immobilisations',
};
const AMORTISSEMENTS: Entete = {
  cle: 'AMORTISSEMENTS',
  libelle: 'Immobilisations · amortissements',
  source: 'Cumul comptabilisé des biens en place (dotations passées)',
  ecran: 'Immobilisations, onglet Maintenance',
  chemin: '/immobilisations',
};
const PROVISIONS: Entete = {
  cle: 'PROVISIONS',
  libelle: 'Provisions pour risques et charges',
  source: 'Registre des provisions comptabilisées, montant à la clôture',
  ecran: 'Registre des provisions pour risques et charges',
  chemin: '/provisions',
};
const CREANCES_DOUTEUSES: Entete = {
  cle: 'CREANCES_DOUTEUSES',
  libelle: 'Créances douteuses ou litigieuses',
  source: 'Reste reclassé et dépréciation en place du module',
  ecran: 'Créances douteuses ou litigieuses',
  chemin: '/creances-douteuses',
};
const ANALYTIQUE: Entete = {
  cle: 'ANALYTIQUE',
  libelle: 'Comptabilité analytique',
  source: 'Cumuls ventilés de chaque plan face aux mouvements généraux des classes qu’il ventile',
  ecran: 'États analytiques et budgétaires, onglet Contrôle',
  chemin: '/etats-analytiques',
};
const BANQUES: Entete = {
  cle: 'BANQUES',
  libelle: 'Banques · dernier relevé rapproché',
  source: 'Solde du relevé face au solde comptable pointé, dernier rapprochement de chaque compte',
  ecran: 'Rapprochement bancaire',
  chemin: '/rapprochement',
};
const STOCKS: Entete = {
  cle: 'STOCKS',
  libelle: 'Stocks · magasin',
  source: 'Fiches de stock du magasin',
  ecran: 'Magasin et fiches de stock',
  chemin: '/magasin',
};
const PAIE: Entete = {
  cle: 'PAIE',
  libelle: 'Paie · rémunérations dues',
  source: 'Bulletins passés au journal face au 422',
  ecran: 'Paiement des salaires (Paie du mois)',
  chemin: '/personnel',
};
const TIERS: Entete = {
  cle: 'TIERS',
  libelle: 'Tiers · balance auxiliaire',
  source: 'Comptes individuels des tiers',
  ecran: 'Balance auxiliaire',
  chemin: '/balance-auxiliaire',
};

/**
 * LA CONCORDANCE · chaque famille relue par la confrontation que son module
 * tient (`concordance.ts`). Chaque lecture est isolée · un refus du module
 * (exercice illisible, registre au-delà de sa borne) rend la famille « non
 * calculée » avec le motif du module ; une panne imprévue aussi, CONSIGNÉE au
 * journal du serveur, jamais avalée, et jamais lue comme une concordance.
 */
@Injectable()
export class ConcordanceService {
  private readonly journalServeur = new Logger(ConcordanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly immobilisations: MaintenanceImmobilisationsService,
    private readonly provisions: ProvisionsService,
    private readonly creances: CreancesDouteusesService,
    private readonly analytique: EtatsAnalytiquesService,
    private readonly rapprochements: RapprochementService,
  ) {}

  /** Une famille lue à part · son échec la rend non calculée, avec son motif. */
  private async isolee(
    tenantId: string,
    entetes: readonly Entete[],
    lire: () => Promise<FamilleConcordance[]>,
  ): Promise<FamilleConcordance[]> {
    try {
      return await lire();
    } catch (err) {
      if (err instanceof HttpException) {
        // Le refus du module est une réponse · il se dit tel quel.
        return entetes.map((e) => nonCalculee(e, `Le module refuse cette lecture · ${err.message}`));
      }
      this.journalServeur.error(
        `Concordance du dossier ${tenantId} · lecture de ${entetes.map((e) => e.cle).join(', ')} impossible`,
        err instanceof Error ? err.stack : String(err),
      );
      return entetes.map((e) => nonCalculee(e, 'Lecture impossible · l’incident est consigné au journal du serveur.'));
    }
  }

  async concordance(tenantId: string, exerciceId: string) {
    const exercice = await this.prisma.exercice.findFirst({
      where: { id: exerciceId, tenantId },
      select: { id: true, dateDebut: true, dateFin: true, statut: true },
    });
    if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier.');

    const [immobilisations, provisions, creances, analytique, banques] = await Promise.all([
      this.isolee(tenantId, [IMMOBILISATIONS, AMORTISSEMENTS], () => this.familleImmobilisations(tenantId, exerciceId)),
      this.isolee(tenantId, [PROVISIONS], () => this.familleProvisions(tenantId, exerciceId)),
      this.isolee(tenantId, [CREANCES_DOUTEUSES], () => this.familleCreances(tenantId, exerciceId)),
      this.isolee(tenantId, [ANALYTIQUE], () => this.familleAnalytique(tenantId, exerciceId)),
      this.isolee(tenantId, [BANQUES], () => this.familleBanques(tenantId)),
    ]);

    const familles: FamilleConcordance[] = [
      ...immobilisations,
      ...provisions,
      ...creances,
      ...analytique,
      ...banques,
      // CE QU'AUCUN MODULE NE CONFRONTE ICI se dit · une famille tue se lirait
      // comme une famille qui concorde.
      nonCalculee(
        STOCKS,
        'Le magasin confronte ses fiches au comptage physique (boni et mali d’inventaire), pas au solde des comptes de stock · aucune confrontation n’est tenue à relire.',
      ),
      nonCalculee(
        PAIE,
        'La confrontation du 422 se lit mois par mois, à la proposition du paiement des salaires · elle n’a pas de lecture sur l’exercice entier.',
      ),
      {
        ...TIERS,
        etat: 'SANS_OBJET',
        motif:
          'La balance auxiliaire et le compte collectif lisent les mêmes lignes d’écriture · ils concordent par construction, il n’y a pas de second livre à confronter.',
        lignes: [],
        mentions: [],
      },
    ];
    return {
      exercice: {
        id: exercice.id,
        dateDebut: exercice.dateDebut.toISOString().slice(0, 10),
        dateFin: exercice.dateFin.toISOString().slice(0, 10),
        statut: exercice.statut,
      },
      familles,
      synthese: synthese(familles),
    };
  }

  /** Le registre des biens face à la balance, compte par compte (`maintenance-immobilisations.service.ts`). */
  private async familleImmobilisations(tenantId: string, exerciceId: string): Promise<FamilleConcordance[]> {
    const m = await this.immobilisations.maintenance(tenantId, exerciceId);
    const mentions: string[] = [];
    if (m.dotationsAPasser.nombre > 0) {
      mentions.push(
        `${m.dotationsAPasser.nombre} bien(s) portent une dotation calculée non passée (${m.dotationsAPasser.montant.toFixed(2)}) · elle n’est pas lue comme un écart.`,
      );
    }
    const sansFiche = m.comptesBien.filter((l) => l.lignesSansFiche.nombre > 0);
    if (sansFiche.length > 0) {
      mentions.push(`${sansFiche.length} compte(s) portent des acquisitions passées au journal sans fiche de bien (${sansFiche.map((l) => l.numero).join(', ')}).`);
    }
    if (m.reclassesApresLaClotureTotal > 0) mentions.push(`${m.reclassesApresLaClotureTotal} bien(s) reclassé(s) après la clôture.`);
    return [
      famille(IMMOBILISATIONS, m.comptesBien.map((l) => ligne(l.numero, l.intitule, l.registre, l.balance)), mentions, 'Aucun bien ni compte de bien mouvementé.'),
      famille(AMORTISSEMENTS, m.comptesAmortissement.map((l) => ligne(l.numero, l.intitule, l.registre, l.balance)), [], 'Aucun amortissement à confronter.'),
    ];
  }

  /** Le registre des provisions comptabilisées face au solde de leurs comptes (§ 5.3 du ch. 18). */
  private async familleProvisions(tenantId: string, exerciceId: string): Promise<FamilleConcordance[]> {
    const t = await this.provisions.tableauDeVariation(tenantId, exerciceId);
    const mentions =
      t.passifsEventuels.length > 0 ? [`${t.passifsEventuels.length} passif(s) éventuel(s) · ils ne sont dans aucun compte, et ne se confrontent pas.`] : [];
    return [
      famille(
        PROVISIONS,
        t.rapprochement.map((r) => ligne(r.numero, '', r.montantRegistre, r.soldeComptable)),
        mentions,
        'Aucune provision comptabilisée au registre.',
      ),
    ];
  }

  /** Le module des créances douteuses face au 416 et au 491 de ses créances (A7, rapprochement du module). */
  private async familleCreances(tenantId: string, exerciceId: string): Promise<FamilleConcordance[]> {
    const l = await this.creances.lister(tenantId, exerciceId);
    if (l.total === 0) return [famille(CREANCES_DOUTEUSES, [], [], 'Aucune créance reclassée au plus tard à la clôture.')];
    const r = l.rapprochement;
    const mentions: string[] = [];
    if (r.provisoire) {
      mentions.push(
        r.reportProvisoire
          ? 'Soldes lus sur la clôture reconstituée de l’exercice précédent (le report provisoire n’est pas lu) · provisoires.'
          : 'Soldes lus sur la clôture reconstituée de l’exercice précédent · provisoires tant que l’à-nouveau n’est pas passé.',
      );
    }
    if (r.horsModule491 !== 0) mentions.push(`Dont ${r.horsModule491.toFixed(2)} passés au 491 hors du module, dans l’exercice.`);
    return [
      famille(
        CREANCES_DOUTEUSES,
        [ligne('416', 'Créances reclassées · reste', r.resteModule, r.solde416), ligne('491', 'Dépréciation en place', r.depreciationModule, r.solde491)],
        mentions,
      ),
    ];
  }

  /** Les cumuls analytiques de chaque plan face aux mouvements généraux qu'il ventile. */
  private async familleAnalytique(tenantId: string, exerciceId: string): Promise<FamilleConcordance[]> {
    const plans = await this.analytique.controleCumuls(tenantId, { exerciceId });
    const lignes = plans.flatMap((p) => [
      ligne(`${p.planCode} · débits`, p.planIntitule, p.mouvementsAnalytiquesDebit, p.mouvementsGenerauxDebit),
      ligne(`${p.planCode} · crédits`, p.planIntitule, p.mouvementsAnalytiquesCredit, p.mouvementsGenerauxCredit),
    ]);
    const mentions = plans
      .filter((p) => p.nombreSansRepartition > 0)
      .map((p) => `Plan ${p.planCode} · ${p.nombreSansRepartition} ligne(s) d’une classe ventilée sans répartition.`);
    return [famille(ANALYTIQUE, lignes, mentions, 'Aucun plan analytique actif.')];
  }

  /**
   * LE DERNIER RAPPROCHEMENT DE CHAQUE BANQUE · le solde du relevé face au solde
   * comptable pointé, calculé par le module (`RapprochementService.obtenir`),
   * jamais ici. Un compte sans rapprochement n'est pas « concordant » · il se
   * dit non rapproché.
   */
  private async familleBanques(tenantId: string): Promise<FamilleConcordance[]> {
    const derniers = await this.prisma.rapprochementBancaire.findMany({
      where: { tenantId, statut: { in: [StatutRapprochement.EN_COURS, StatutRapprochement.CLOTURE] } },
      orderBy: [{ compteId: 'asc' }, { dateReleve: 'desc' }, { createdAt: 'desc' }],
      distinct: ['compteId'],
      take: PLAFOND_BANQUES + 1,
      select: { id: true, statut: true, dateReleve: true, compte: { select: { numero: true, intitule: true } } },
    });
    const tronque = derniers.length > PLAFOND_BANQUES;
    const lignes = [];
    for (const r of derniers.slice(0, PLAFOND_BANQUES)) {
      const detail = await this.rapprochements.obtenir(tenantId, r.id);
      const releve = nombre(detail.rapprochement.soldeReleve);
      const pointe = detail.soldePointe === null ? null : nombre(detail.soldePointe);
      lignes.push(
        ligne(
          r.compte.numero,
          `${r.compte.intitule} · relevé du ${r.dateReleve.toISOString().slice(0, 10)}${r.statut === StatutRapprochement.EN_COURS ? ' (en cours)' : ''}`,
          releve,
          pointe,
        ),
      );
    }
    const mentions: string[] = [];
    if (tronque) mentions.push(`Plus de ${PLAFOND_BANQUES} comptes rapprochés · les premiers seulement sont lus.`);
    if (lignes.some((l) => l.comptabilite === null)) {
      mentions.push('Un premier rapprochement sans solde de départ déclaré n’a pas de solde pointé · déclarez-le dans le rapprochement.');
    }
    return [famille(BANQUES, lignes, mentions, 'Aucun rapprochement bancaire tenu dans OmegaX.')];
  }
}
