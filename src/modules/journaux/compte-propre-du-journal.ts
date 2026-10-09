import { Referentiel } from '@prisma/client';
import { compteSemeSubdivise } from '../comptes/subdivisions-du-plan';
import { rangSousRacine } from '../tiers/collectifs-tiers';

/**
 * LE COMPTE PROPRE D'UN JOURNAL DE BANQUE OU DE CAISSE, OUVERT AVEC LUI
 * (décision de Manasse du 2026-10-09, point 2 de la note « numéros
 * personnalisés » · « chaque journal de banque ou de caisse rattaché à son
 * compte personnalisé »). Le cabinet choisit le compte du plan sous lequel
 * l'ouvrir (52110000 Banques locales, 57100000 Caisse…), OmegaX propose le
 * premier numéro libre sous sa racine, le cabinet le garde ou le remplace.
 *
 * Quatre règles, les mêmes que le numéro choisi d'un tiers
 * (`motifRefusNumeroChoisi`), chacune avec sa raison.
 *  · DES CHIFFRES SEULS · la codification des comptes est décimale (AUDCIF
 *    art. 18 et Titre VII ; SYCEBNL, Partie 2 ch. 2, section 1).
 *  · SOUS LA RACINE DU COMPTE DU PLAN · « Le numéro d'un compte
 *    divisionnaire commence toujours par celui du compte principal ou
 *    sous-compte dont il est une subdivision » (AUDCIF, Titre VII) ; le
 *    SYCEBNL complète son plan « en respectant l'arborescence » (même
 *    section). Et sous ce compte-là, pas sous un sous-compte semé plus
 *    profond (le 8311 sous le 831 du SYCEBNL), sans quoi la saisie le
 *    rangerait sous un autre compte que celui choisi.
 *  · DISTINCT DU COMPTE DU PLAN · des zéros seuls après la racine le redonnent.
 *  · À LA LONGUEUR DU DOSSIER (`Tenant.longueurCompte`), convention d'OmegaX.
 *
 * Rend le motif du refus, ou null. L'unicité se juge à la création, par la
 * contrainte de la base, refus nommé.
 */
export function motifRefusNumeroDuJournal(
  numero: string,
  compteDuPlan: string,
  racine: string,
  longueur: number,
  referentiel: Referentiel,
): string | null {
  if (!/^\d+$/.test(numero)) {
    const source =
      referentiel === Referentiel.SYCEBNL ? 'SYCEBNL, Partie 2 ch. 2, section 1' : 'AUDCIF art. 18 et Titre VII';
    return `Le numéro de compte « ${numero} » ne doit porter que des chiffres · la codification des comptes est décimale (${source}).`;
  }
  if (!numero.startsWith(racine)) {
    return (
      `Le numéro ${numero} ne commence pas par ${racine}, numéro du compte ${compteDuPlan} du plan · le compte ` +
      "d'une banque ou d'une caisse en est une subdivision."
    );
  }
  if (numero.length !== longueur) {
    return (
      `Le numéro ${numero} compte ${numero.length} chiffres, et les comptes de ce dossier en comptent ${longueur} ` +
      '(Structure > Paramètres du dossier).'
    );
  }
  if (rangSousRacine(numero, racine) === null) {
    return `Le numéro ${numero} ne se distingue pas du compte ${compteDuPlan} du plan · ajoutez un rang après ${racine}.`;
  }
  const parent = compteSemeSubdivise(referentiel, numero);
  if (parent !== compteDuPlan) {
    return parent
      ? `Le numéro ${numero} se range sous le compte ${parent} du plan, pas sous le ${compteDuPlan} choisi.`
      : `Le numéro ${numero} est celui d'un compte du plan · choisissez un rang qui n'en est pas un.`;
  }
  return null;
}

/**
 * LE COMPTE D'UNE BANQUE OU D'UNE CAISSE · un journal de trésorerie porte
 * le compte où ses fonds se tiennent, jamais un autre compte de la classe 5
 * (relectures du 2026-10-09 · le 59000000 était offert, et un journal de
 * banque ouvert dessous passait ses remises au compte des dépréciations,
 * le bilan faux et la balance bouclée). Lu aux fiches des comptes de la
 * classe 5 des deux plans (AUDCIF, Titre VII ; SYCEBNL, Partie 2 ch. 3,
 * section 5), où les quatre divisions des fonds portent le même numéro ·
 * 52 Banques, 53 Établissements financiers et assimilés (chèques postaux ou
 * banques postales, Trésor), 55 Instruments de monnaie électronique, 57
 * Caisse. Au SYSCOHADA seul, le 581 Régies d'avance (« fonds gérés par les
 * régisseurs ») et le 582 Accréditifs (« couvrir ses besoins de
 * trésorerie ») · le 58 du SYCEBNL n'ouvre que les virements internes, un
 * numéro, deux sens.
 *
 * Rend le motif du refus, ou null.
 */
export function motifRefusCompteDeTresorerie(numero: string, referentiel: Referentiel): string | null {
  const ecarte = ECARTES.find((e) => numero.startsWith(e.prefixe) && (!e.referentiel || e.referentiel === referentiel));
  if (ecarte) return `Le compte ${numero} ne peut pas porter un journal de banque ou de caisse · ${ecarte.raison}`;
  const divisions = referentiel === Referentiel.SYSCOHADA ? [...DIVISIONS_DES_FONDS, '581', '582'] : DIVISIONS_DES_FONDS;
  if (divisions.some((d) => numero.startsWith(d))) return null;
  return (
    `Le compte ${numero} n'est pas un compte de banque ou de caisse · un journal de trésorerie porte un compte des ` +
    `divisions ${referentiel === Referentiel.SYSCOHADA ? '52, 53, 55, 57, 581 ou 582' : '52, 53, 55 ou 57'}.`
  );
}

const DIVISIONS_DES_FONDS = ['52', '53', '55', '57'];

/** Les comptes de la classe 5 qui ne tiennent pas de fonds, chacun avec la phrase de sa fiche. */
const ECARTES: { prefixe: string; referentiel?: Referentiel; raison: string }[] = [
  { prefixe: '526', raison: 'il porte les intérêts courus de la banque, charges à payer ou produits à recevoir (fiche du compte 52).' },
  { prefixe: '536', raison: "il porte les intérêts courus de l'établissement financier (fiche du compte 53)." },
  { prefixe: '50', raison: 'il porte des titres de placement (fiche du compte 50).' },
  { prefixe: '51', raison: 'il porte des valeurs à encaisser, que la banque n\'a pas encore créditées (fiche du compte 51).' },
  { prefixe: '54', referentiel: Referentiel.SYSCOHADA, raison: 'il porte des instruments de trésorerie (fiche du compte 54).' },
  {
    prefixe: '56',
    raison: 'il porte un crédit de trésorerie ou un escompte, constaté « par le débit du compte 52 » (fiche du compte 56).',
  },
  {
    prefixe: '585',
    raison: 'les virements internes sont des « comptes de passage », soldés au terme de leur utilisation (fiche du compte 58).',
  },
  {
    prefixe: '588',
    raison: 'les virements internes sont des « comptes de passage », soldés au terme de leur utilisation (fiche du compte 58).',
  },
  { prefixe: '59', raison: 'il porte des dépréciations et provisions (fiche du compte 59).' },
];
