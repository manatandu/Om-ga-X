import { FormeJuridiqueSyscohada, RegimeLiquidation } from '@prisma/client';
import { echeanceDepassee } from '../../common/echeance';
import type { JalonServi } from './portefeuille-etat';

/**
 * LA LIQUIDATION D'UNE SOCIÉTÉ COMMERCIALE AU PLANNING DE CLÔTURE (décision
 * par la loi du 2026-10-04, point 4, `docs/decisions-par-la-loi-2026-10-04.md`).
 *
 * LA CONTRADICTION APPARENTE SE RÉSOUT PAR L'ART. 7 AL. 2 DE L'AUDCIF · « En
 * cas de cessation d'activité [...] la durée des opérations de liquidation est
 * comptée pour un seul exercice, sous réserve de l'établissement de
 * situations annuelles provisoires » (al. 4) ne vise que la DURÉE ; l'exercice
 * « coïncide avec l'année civile » (al. 2), sans dérogation pour la
 * liquidation. Les situations annuelles, que l'AUSCGIE art. 232 appelle
 * « états financiers de synthèse annuels » dans les cas de l'art. 223,
 * s'arrêtent donc à la CLÔTURE de chaque exercice · aucun « anniversaire » de
 * la dissolution n'est calculé.
 *
 * CHAPITRE 1 (AUSCGIE art. 203 à 222), toute liquidation de société
 * commerciale sauf procédure collective (art. 203 al. 2) · bilan avant
 * liquidation à la dissolution (AUDCIF Titre VIII ch. 40 § 2.1), publication
 * de la nomination dans le mois (art. 266), clôture dans les trois ans de la
 * dissolution (art. 216), comptes définitifs, assemblée de clôture et dépôt
 * au RCCM (art. 217 et 219), radiation dans le mois de la publication de la
 * clôture (art. 220).
 * CHAPITRE 2 (art. 224 à 241) « exclusivement » dans les deux cas de
 * l'art. 223 · rapport dans les six mois de la nomination (art. 228), états
 * annuels et rapport écrit dans les trois mois de chaque clôture (art. 232),
 * assemblée dans les six mois, à défaut rapport déposé au RCCM (art. 233).
 *
 * Rien n'est déduit · la dissolution, la nomination et le régime sont
 * DÉCLARÉS ; sans la date qui fait courir un délai, l'échéance est `null`
 * (« Non calculée »). Le sort de la période du 1er janvier à la dissolution
 * (exercice clos à cette date, ou simple bilan avant liquidation) n'est pas
 * tranché par le corpus et n'est pas décidé ici.
 */

const FORMES_SOCIETES_COMMERCIALES: FormeJuridiqueSyscohada[] = [
  FormeJuridiqueSyscohada.SOCIETE_ANONYME,
  FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
  FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
  FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
  FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
];

/** Étape du planning qui porte la liquidation · après l'affectation (26). */
export const ETAPE_LIQUIDATION = 27;

/** Ajoute n mois DATE À DATE, ramené au dernier jour du mois d'arrivée. */
function plusMois(d: Date, n: number): Date {
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(d.getUTCDate(), dernier)));
}

const dansLExercice = (d: Date, e: { dateDebut: Date; dateFin: Date }) =>
  d.getTime() >= e.dateDebut.getTime() && d.getTime() <= e.dateFin.getTime();

export function jalonsLiquidation(
  faits: {
    forme: FormeJuridiqueSyscohada | null;
    dateDissolution: Date | null;
    dateNominationLiquidateur: Date | null;
    regimeLiquidation: RegimeLiquidation | null;
  },
  exercice: { dateDebut: Date; dateFin: Date },
  aujourdHui: Date,
): JalonServi[] {
  const dissolution = faits.dateDissolution;
  if (!dissolution || !faits.forme || !FORMES_SOCIETES_COMMERCIALES.includes(faits.forme)) return [];
  // Les exercices d'AVANT la dissolution ne sont pas en liquidation.
  if (exercice.dateFin.getTime() < dissolution.getTime()) return [];

  const jalon = (j: Omit<JalonServi, 'etape' | 'sanction' | 'enRetard'>): JalonServi => ({
    etape: ETAPE_LIQUIDATION,
    sanction: null,
    ...j,
    enRetard: j.echeance !== null && echeanceDepassee(j.echeance, aujourdHui),
  });

  if (faits.regimeLiquidation === RegimeLiquidation.PROCEDURE_COLLECTIVE) {
    return [
      jalon({
        libelle: 'Liquidation dans une procédure collective',
        detail:
          'La liquidation intervient dans le cadre de l’Acte uniforme portant organisation des procédures ' +
          'collectives d’apurement du passif · les dispositions générales de la liquidation des sociétés ne ' +
          's’appliquent pas, et aucun jalon n’est calculé ici.',
        nature: 'LEGALE',
        source: 'AUSCGIE, art. 203 al. 2',
        debut: dissolution,
        echeance: null,
      }),
    ];
  }

  const jalons: JalonServi[] = [];
  const nomination = faits.dateNominationLiquidateur;
  const exerciceDeDissolution = dansLExercice(dissolution, exercice);

  if (exerciceDeDissolution) {
    jalons.push(
      jalon({
        libelle: 'Bilan avant liquidation',
        detail:
          'Au début de la liquidation · inventaire du patrimoine, solde des amortissements et des provisions ' +
          'existants, établissement du bilan avant liquidation à la date de dissolution. La continuité ' +
          'd’exploitation n’étant plus assurée, l’évaluation des biens est reconsidérée (AUDCIF art. 39). Les ' +
          'opérations de liquidation passent aux comptes 837 et 847, leur résultat au 1374, le capital à ' +
          'rembourser aux associés au 4619. Les actes et documents destinés aux tiers portent la mention ' +
          '« société en liquidation » et le nom du ou des liquidateurs (AUSCGIE art. 204).',
        nature: 'LEGALE',
        source: 'AUDCIF, Titre VIII ch. 40 § 2.1 et § 2.2 ; art. 39 ; AUSCGIE, art. 204',
        debut: dissolution,
        echeance: dissolution,
      }),
    );
  }
  if (nomination ? dansLExercice(nomination, exercice) : exerciceDeDissolution) {
    const publication = nomination ? plusMois(nomination, 1) : null;
    jalons.push(
      jalon({
        libelle: 'Publication de la nomination du liquidateur',
        detail:
          'L’acte de nomination du ou des liquidateurs, quelle que soit sa forme, est publié dans un journal ' +
          'habilité à recevoir les annonces légales dans le délai d’un mois à compter de la nomination. ' +
          (nomination
            ? 'Délai compté depuis la nomination déclarée.'
            : 'Échéance non calculée · déclarez la date de nomination dans Paramètres du dossier.'),
        nature: 'LEGALE',
        source: 'AUSCGIE, art. 266 ; non-publication sanctionnée pénalement (art. 902)',
        debut: nomination,
        echeance: publication,
      }),
    );
  }
  const cloture = plusMois(dissolution, 36);
  jalons.push(
    jalon({
      libelle: 'Clôture de la liquidation',
      detail:
        'La clôture intervient dans les trois ans de la dissolution. En fin de liquidation, les associés statuent ' +
        'sur les comptes définitifs, le quitus et la décharge du liquidateur, et constatent la clôture ; les ' +
        'comptes définitifs sont déposés au registre du commerce et du crédit mobilier avec cette décision. Le ' +
        'liquidateur demande la radiation dans le mois de la publication de la clôture · délai non calculé, ' +
        'la date de cette publication n’étant pas déclarée.',
      nature: 'LEGALE',
      source: 'AUSCGIE, art. 216, 217, 219 et 220',
      debut: dissolution,
      echeance: cloture,
    }),
  );

  const chapitre2 =
    faits.regimeLiquidation === RegimeLiquidation.ARTICLE_223_1 ||
    faits.regimeLiquidation === RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE;
  if (chapitre2) {
    if (nomination ? dansLExercice(nomination, exercice) : exerciceDeDissolution) {
      const rapport = nomination ? plusMois(nomination, 6) : null;
      jalons.push(
        jalon({
          libelle: 'Rapport du liquidateur à l’assemblée des associés',
          detail:
            'Dans les six mois de sa nomination, le liquidateur convoque l’assemblée des associés et lui fait ' +
            'rapport sur l’actif et le passif, la poursuite des opérations et le délai pour les terminer · délai ' +
            'portable à douze mois par décision de justice. ' +
            (nomination ? '' : 'Échéance non calculée · déclarez la date de nomination.'),
          nature: 'LEGALE',
          source: 'AUSCGIE, art. 223 et 228',
          debut: nomination,
          echeance: rapport,
        }),
      );
    }
    jalons.push(
      jalon({
        libelle: 'États financiers annuels et rapport écrit du liquidateur',
        detail:
          'Dans les trois mois de la clôture de l’exercice, le liquidateur établit les états financiers de ' +
          'synthèse annuels au vu de l’inventaire, et un rapport écrit rendant compte des opérations de la ' +
          'liquidation au cours de l’exercice écoulé.',
        nature: 'LEGALE',
        source: 'AUSCGIE, art. 223 et 232 ; AUDCIF, art. 7 al. 2 et 4',
        debut: exercice.dateFin,
        echeance: plusMois(exercice.dateFin, 3),
      }),
      jalon({
        libelle: 'Assemblée des associés sur les états annuels de liquidation',
        detail:
          'Sauf dispense de la juridiction compétente, le liquidateur convoque l’assemblée des associés au moins ' +
          'une fois par an et dans les six mois de la clôture de l’exercice · elle statue sur les états financiers ' +
          'annuels et renouvelle, le cas échéant, le mandat du commissaire aux comptes, qui reste en fonctions. ' +
          'Si l’assemblée n’est pas réunie, le rapport écrit du liquidateur est déposé au registre du commerce et ' +
          'du crédit mobilier.',
        nature: 'LEGALE',
        source: 'AUSCGIE, art. 225 et 233',
        debut: exercice.dateFin,
        echeance: plusMois(exercice.dateFin, 6),
      }),
    );
  } else {
    jalons.push(
      jalon({
        libelle: 'Situation annuelle provisoire de liquidation',
        detail:
          'La durée des opérations de liquidation compte pour un seul exercice, sous réserve de situations ' +
          'annuelles provisoires · l’exercice coïncidant avec l’année civile, elles s’arrêtent à la clôture de ' +
          'chaque exercice (situation intermédiaire du logiciel). ' +
          (faits.regimeLiquidation === null
            ? 'Régime de la liquidation non déclaré · les états annuels et l’assemblée des articles 232 et 233 ' +
              'ne sont servis que dans les cas de l’article 223.'
            : 'Liquidation amiable selon les statuts · les articles 224 à 241 ne s’appliquent pas.'),
        nature: 'LEGALE',
        source: 'AUDCIF, art. 7 al. 2 et 4 ; AUSCGIE, art. 223',
        debut: exercice.dateFin,
        echeance: exercice.dateFin,
      }),
    );
  }
  return jalons;
}
