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
