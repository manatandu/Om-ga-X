import { ConflictException } from '@nestjs/common';
import type { StatutOrdreVirement } from '@prisma/client';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { jourImprime } from '../tiers/modeles-impression';

/**
 * L'AVIS DE RÈGLEMENT (ligne sage-l2, fonction 27 · Sage, « lettre de
 * règlement », modèle « Règlement » de la fiche du tiers). Règles pures.
 *
 * L'avis dit au bénéficiaire d'un ordre de virement ce qui lui est viré, et,
 * quand le dossier l'a déclarée, quelles factures ce paiement acquitte · « Le
 * débiteur de plusieurs dettes a le droit de déclarer, lorsqu'il paye, quelle
 * dette il entend acquitter » (Code civil, Livre III, art. 151). La ligne de
 * l'ordre la porte déjà, recopiée (`imputationDeclaree`, relecture M6) ; l'avis
 * la transmet telle quelle, sans la refaire.
 *
 * LE DOCUMENT PORTE SA SIGNATURE · `{entite}` des relances, le nom du dossier
 * et les mentions de sa correspondance (AUDCG art. 59, AUSCGIE art. 17). Le
 * modèle du tiers HABILLE l'avis (`tiers/modeles-impression.ts`), il ne peut
 * pas en retirer la signature.
 */

/**
 * Le cadre d'un tiers qui n'a pas de modèle d'avis · destinataire, date,
 * objet. Convention d'OmegaX, que le modèle du tiers remplace.
 */
export const CADRE_AVIS_PAR_DEFAUT = '{tiers}\n{adresse}\n\nLe {date}\n\nObjet : avis de règlement\n\n{document}';

/**
 * UN AVIS SUIT UN ORDRE REMIS · annulé, l'ordre ne paie personne ; en attente
 * d'impression, il n'est pas encore parti, et l'avis annoncerait un virement
 * que la banque n'a pas reçu. Règle d'OmegaX (Sage tient le règlement pour
 * effectif après l'impression de sa lettre).
 */
export function motifRefusAvis(statut: StatutOrdreVirement): string | null {
  if (statut === 'ANNULE') return "L'ordre est annulé · il ne paie personne, aucun avis de règlement ne part.";
  if (statut === 'A_IMPRIMER') {
    return "L'ordre n'est pas encore imprimé · l'avis annoncerait un virement que la banque n'a pas reçu. Imprimez l'ordre d'abord.";
  }
  return null;
}

const montantImprime = (x: number) =>
  (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Le corps de l'avis d'une ligne de l'ordre, signé de l'entité. */
export function documentAvisReglement(
  ligne: { montant: number; banque: string; reference: string | null; imputationDeclaree: string | null; montantDevise?: number | null },
  ordre: { numero: number; date: Date; devise?: string | null },
  entite: string,
): string {
  // UN ORDRE EN DEVISE (n° 37, ligne sage-l3) dit au bénéficiaire la somme
  // que la banque vire DANS CETTE MONNAIE, et sa contrevaleur en francs au
  // livre (AUDCIF art. 17, 1°) · la seule contrevaleur ferait croire à un
  // virement en francs.
  const devise = ordre.devise ?? null;
  // Une ligne d'un ordre en devise SANS montant en devise est un état que
  // `creerDans` refuse d'écrire · s'il se présentait (reprise de données),
  // imprimer la contrevaleur en francs ferait croire à un virement en francs.
  // On refuse, NOMMÉ (409, comme une référence retirée · jamais une panne
  // 500 qui alerterait Sentry sans dire à l'écran ce qui manque), plutôt que
  // d'imprimer faux (relecture « échecs silencieux », second tour).
  if (devise !== null && !(typeof ligne.montantDevise === 'number' && Number.isFinite(ligne.montantDevise))) {
    throw new ConflictException(
      `L'ordre n° ${ordre.numero} est en ${devise} et sa ligne vers ${ligne.banque} ne porte pas de montant en devise · aucun avis n'est établi, relisez l'ordre.`,
    );
  }
  const somme =
    devise !== null
      ? `${montantImprime(ligne.montantDevise as number)} ${devise} (contrevaleur comptable ${montantImprime(ligne.montant)} ${MONNAIE_DE_TENUE})`
      : `${montantImprime(ligne.montant)} ${MONNAIE_DE_TENUE}`;
  return [
    'Madame, Monsieur,',
    '',
    `Notre ordre de virement n° ${ordre.numero} du ${jourImprime(ordre.date)} porte en votre faveur la somme de ` +
      `${somme}, au crédit de votre compte ouvert auprès de ${ligne.banque}.`,
    ...(ligne.reference ? [`Référence du paiement : ${ligne.reference}.`] : []),
    ...(ligne.imputationDeclaree ? [`${ligne.imputationDeclaree}.`] : []),
    '',
    'Nous vous prions d’agréer, Madame, Monsieur, nos salutations distinguées.',
    '',
    entite,
  ].join('\n');
}
