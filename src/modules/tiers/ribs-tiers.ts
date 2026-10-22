import { ibanValide, normaliserIban } from '../banques/banques';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';

/**
 * COORDONNÉES BANCAIRES DES TIERS ET ORDRE DE VIREMENT (priorité 1 de la
 * comparaison avec les autres produits Sage, docs/comparaison-sage-i7-omegax.md).
 *
 * Ce que la compétence `sage-i7` porte, et rien de plus : des « RIB/IBAN/BIC
 * par tiers » (Moyens de Paiement), « l'édition des ordres de paiement », et
 * « le règlement n'est effectif qu'après impression · état "en attente
 * d'impression" ». Ni la maquette de l'ordre, ni ses mentions, ni les formats
 * d'échange (SEPA, ETEBAC) ne sont décrits · la définition est donc celle
 * d'OmegaX, et l'écran le dit. Les formats d'échange ne sont PAS servis ·
 * aucune banque congolaise n'en publie la norme dans le corpus lu.
 *
 * UN SEUL CONTRÔLE DE FORMAT, comme pour les RIB du dossier (banques.ts) ·
 * l'IBAN, norme publiée (ISO 13616). Les formats nationaux se conservent sans
 * se vérifier.
 */

export interface CoordonneesRib {
  banque?: string | null;
  titulaire?: string | null;
  codeBanque?: string | null;
  codeGuichet?: string | null;
  numeroCompte?: string | null;
  cle?: string | null;
  iban?: string | null;
  codeBic?: string | null;
  devise?: string | null;
}

const vide = (v: string | null | undefined) => !v || !v.trim();

/**
 * Un RIB de tiers est refusé s'il ne permet PAS DE PAYER · sans banque, ou
 * sans aucun numéro de compte (ni IBAN ni numéro national). Un RIB incomplet
 * enregistré serait recopié sur un ordre que la banque rejettera, après que
 * la pièce de règlement a été passée.
 */
export function motifRefusRibTiers(rib: CoordonneesRib): string | null {
  if (vide(rib.banque)) return "La banque du tiers est obligatoire · l'ordre de virement la nomme.";
  if (vide(rib.iban) && vide(rib.numeroCompte)) {
    return "Un RIB sans IBAN ni numéro de compte ne permet pas de payer · renseignez l'un des deux.";
  }
  if (!vide(rib.iban) && !ibanValide(rib.iban!)) {
    return "IBAN invalide · la clé de contrôle (ISO 13616, modulo 97) ne correspond pas. Vérifiez la saisie.";
  }
  return null;
}

/**
 * Les coordonnées telles qu'elles s'impriment sur l'ordre · l'IBAN s'il
 * existe (il contient le reste), sinon le RIB national dans l'ordre de la
 * fiche Sage (code banque, code guichet, numéro de compte, clé).
 */
export function coordonneesImprimees(rib: CoordonneesRib): string {
  if (!vide(rib.iban)) {
    const iban = normaliserIban(rib.iban!);
    return `IBAN ${iban.replace(/(.{4})/g, '$1 ').trim()}`;
  }
  return [rib.codeBanque, rib.codeGuichet, rib.numeroCompte, rib.cle]
    .filter((v) => !vide(v))
    .map((v) => v!.trim())
    .join(' ');
}

/**
 * LA MONNAIE DU DONNEUR D'ORDRE (ligne sage-l3, fonction 37, décision D1 de
 * `docs/comparaison-sage/reproduction/architecture.md`). Loi n° 23/053,
 * art. 141, 1° · « Cette comptabilité est exprimée en Franc congolais » · le
 * texte vise la COMPTABILITÉ, pas la monnaie du compte bancaire. Les pièces
 * de règlement restent tenues en francs ; l'ordre, lui, demande à la banque
 * de débiter le compte dans SA monnaie · un RIB tenu en dollars exécute des
 * dollars, et c'est le montant en devise de chaque ligne (F49) que l'ordre
 * porte, la contrevaleur en francs restant pour mémoire. Un RIB sans devise
 * est lu dans la monnaie de tenue · c'est ce qu'un compte congolais saisi
 * sans précision est le plus souvent, et le refuser bloquerait chaque dossier
 * qui n'a pas rempli le champ. Rend `null` pour la monnaie de tenue.
 */
export function deviseDuDonneur(devise: string | null | undefined): string | null {
  if (vide(devise)) return null;
  const code = devise!.trim().toUpperCase();
  return code === MONNAIE_DE_TENUE ? null : code;
}

/**
 * LE PAIEMENT DES SALAIRES RESTE EN FRANCS (ligne sage-l5, relecture L5,
 * mineur 7) · le bulletin dit un net en francs, et un ordre en devise ferait
 * convertir la banque au cours qu'elle choisit, que le bulletin ne dit pas.
 * Seul l'ordre des SALAIRES garde ce refus · l'ordre des tiers suit
 * `deviseDuDonneur` et la règle ligne à ligne ci-dessous.
 */
export function motifRefusDeviseDonneur(devise: string | null | undefined, journalCode: string): string | null {
  const code = deviseDuDonneur(devise);
  if (code === null) return null;
  return (
    `Le RIB du journal ${journalCode} est tenu en ${code} · les salaires sont payés en ${MONNAIE_DE_TENUE}, ` +
    "monnaie de tenue. L'ordre de paiement des salaires ne s'émet que sur un compte en " +
    `${MONNAIE_DE_TENUE}.`
  );
}

/** Une ligne de règlement telle que l'ordre la juge · le compte réglé et la monnaie dans laquelle il est payé (`null` · francs). */
export interface LigneReglee {
  compte: string;
  devise: string | null;
}

/**
 * CHAQUE LIGNE DE L'ORDRE EST PAYÉE DANS LA MONNAIE DU DONNEUR, vérifié AVANT
 * la première pièce. Un RIB en dollars qui exécuterait une ligne réglée en
 * francs, ou un RIB en francs à qui l'on demanderait des dollars, remettrait à
 * la banque un montant dans une monnaie que le compte ne porte pas · la banque
 * convertirait au cours qu'elle choisit, que la pièce ne dit pas, et le 52 ne
 * porterait pas la position que la clôture doit convertir (AUDCIF art. 57).
 * Le refus nomme chaque ligne et son issue ; `null` si toutes concordent.
 */
export function motifRefusLignesHorsDeviseDonneur(p: {
  deviseDonneur: string | null;
  journalCode: string;
  monnaieDeTenue: string;
  lignes: readonly LigneReglee[];
}): string | null {
  const donneur = p.deviseDonneur ?? p.monnaieDeTenue;
  const horsDevise = p.lignes.filter((l) => (l.devise ?? p.monnaieDeTenue) !== donneur);
  if (horsDevise.length === 0) return null;
  const nommees = horsDevise.map((l) => `${l.compte} (réglé en ${l.devise ?? p.monnaieDeTenue})`).join(', ');
  if (p.deviseDonneur === null) {
    return (
      `Le RIB du journal ${p.journalCode} est lu en ${p.monnaieDeTenue} (aucune devise renseignée) et ${horsDevise.length > 1 ? 'des lignes sont réglées' : 'une ligne est réglée'} ` +
      `dans une autre monnaie · ${nommees}. Renseignez la devise du RIB (Structure > Banques) si le compte est tenu dans cette monnaie, ` +
      "ou réglez ces factures depuis le journal d'un compte tenu dans leur monnaie."
    );
  }
  return (
    `Le RIB du journal ${p.journalCode} est tenu en ${donneur} et ${horsDevise.length > 1 ? 'des lignes sont réglées' : 'une ligne est réglée'} ` +
    `dans une autre monnaie · ${nommees}. Un ordre de virement n'exécute que la monnaie du compte débité · réglez ces factures ` +
    `en ${donneur} (« Moyen de paiement en devise »), ou depuis le journal d'un compte tenu dans leur monnaie.`
  );
}

/**
 * L'ÉTAT D'UN ORDRE, et ce qu'il permet. « Le règlement n'est effectif
 * qu'après impression » (Sage) · A_IMPRIMER est l'état « en attente
 * d'impression », la première impression le fait passer à IMPRIME et en
 * garde la date et l'auteur. Une réimpression ne change rien que le compteur ·
 * c'est la PREMIÈRE qui a remis l'ordre à la banque. Un ordre annulé ne
 * s'imprime plus, et ne s'annule pas deux fois.
 */
export type StatutOrdre = 'A_IMPRIMER' | 'IMPRIME' | 'ANNULE';

export function motifRefusImpression(statut: StatutOrdre): string | null {
  return statut === 'ANNULE' ? "L'ordre est annulé · il ne se réimprime pas." : null;
}

export function motifRefusAnnulation(statut: StatutOrdre, motif: string | null | undefined): string | null {
  if (statut === 'ANNULE') return "L'ordre est déjà annulé.";
  if (vide(motif)) return "Le motif d'annulation est obligatoire · un ordre remis à la banque et retiré doit laisser sa raison.";
  return null;
}
