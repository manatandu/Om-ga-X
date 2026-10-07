/**
 * RÈGLEMENT DES TIERS À PARTIR DES ÉCHÉANCES · règles pures, sans Prisma.
 *
 * Sage i7 : « édition des ordres de paiement + enregistrement automatique des
 * règlements en comptabilité · regroupement possible de plusieurs factures
 * d'un même tiers sur un même règlement · règlement partiel possible » (skill
 * sage-i7, tiers.md).
 *
 * L'écriture est celle des deux textes, et elle SÉPARE les deux flux. Le guide
 * d'application SYSCOHADA (Partie 1 ch. 4 § 1) distingue le flux juridique (la
 * facture, déjà au 40 ou au 41) du flux financier (le règlement, classes 4 et
 * 5). Les fiches des comptes 40 et 41 le disent dans les mêmes mots au SYCEBNL :
 * le 40 est « débité [...] des règlements effectués sur factures ; par le
 * crédit : des comptes de trésorerie », le 41 « crédité [...] des règlements
 * reçus des adhérents et clients ; par le débit : des comptes de trésorerie ».
 * Le règlement ne touche donc JAMAIS une charge ni un produit · il solde un
 * tiers contre la trésorerie, et c'est tout.
 */

export type SensReglement = 'FOURNISSEUR' | 'CLIENT';

/**
 * CE QUI SE RÈGLE. Une DETTE fournisseur est une ligne CRÉDITRICE d'un 40, une
 * CRÉANCE client une ligne DÉBITRICE d'un 41. Quatre divisions en sont
 * exclues, de même sens dans les deux plans semés :
 *  · 408 « factures non parvenues » et 418 « produits à recevoir » · des
 *    estimations de clôture, contre-passées à l'ouverture ; les « payer »
 *    réglerait une facture que personne n'a encore reçue ;
 *  · 409 « fournisseurs débiteurs » et 419 « clients créditeurs » · des
 *    avances et acomptes, qui sont l'inverse d'une échéance.
 */
const DIVISIONS_EXCLUES = ['408', '409', '418', '419', '416'];

/**
 * A7 ter, mineur 1 · LE 416 NE SE RÈGLE PAS ICI · « Créances clients
 * litigieuses ou douteuses » au SYSCOHADA, « Créances adhérents,
 * clients-usagers litigieuses ou douteuses » au SYCEBNL (fiche du compte 41
 * des deux plans). La créance reclassée se suit dans « Créances douteuses ou
 * litigieuses » · son encaissement est le RECOUVREMENT du module (D trésorerie
 * / C 416), qui le compte dans le reste de la créance. Réglée ici, la ligne
 * sortait du 416 sans que le module le sache · reste faux, revue et clôture
 * lues sur une créance déjà encaissée.
 */
export const MOTIF_416_PAR_LE_MODULE =
  'se règle par « Recouvrement » dans « Créances douteuses ou litigieuses » · le module compte l’encaissement dans le reste de la créance.';

export function estEcheanceAReglerSur(numeroCompte: string, sens: SensReglement): boolean {
  const racine = sens === 'FOURNISSEUR' ? '40' : '41';
  if (!numeroCompte.startsWith(racine)) return false;
  return !DIVISIONS_EXCLUES.some((d) => numeroCompte.startsWith(d));
}

/** Le refus d'une ligne qui ne se règle pas ici · le 416 renvoie au module. */
export function motifHorsEcheance(numeroCompte: string): string {
  return numeroCompte.startsWith('416')
    ? `Le compte ${numeroCompte} (créance litigieuse ou douteuse) ${MOTIF_416_PAR_LE_MODULE}`
    : `Le compte ${numeroCompte} ne porte pas d'échéance à régler dans ce sens.`;
}

/**
 * Second tour d'A7 ter, m-d · LE RÈGLEMENT SE BORNE AU SOLDE NET du compte d'un
 * client qui porte une créance reclassée en vigueur. La facture reclassée reste
 * ouverte au compte du client (le reclassement ne la lettre pas, règle d'A7),
 * mais sa valeur est au 416 · la régler ici en entier laissait le compte du
 * client créditeur de 1 160 000, le 416 à 1 160 000 et la dépréciation de
 * 400 000 sur une créance encaissée (scénario d, base réelle). Au-delà du solde
 * net, refus nommé, avec l'ISSUE RÉELLE (troisième passage, m3) · régler au
 * plus le solde net, chiffré ; un encaissement de la créance reclassée passe
 * par le « Recouvrement » du module, un autre (avance, trop-perçu) par une
 * pièce au journal. « Ne réglez que les autres factures » était faux quand la
 * facture choisie EN EST une, et que le net est entamé par un crédit non
 * affecté du compte (cas e2 · 200 000 non affectés, facture B de 500 000).
 */
export function motifReglementAuDelaDuNet(numeroCompte: string, compte416: string, dateReclassement: string, net: number, montant: number): string | null {
  const c = (x: number) => Math.round(x * 100) / 100;
  if (c(montant) <= c(net) + 0.005) return null;
  const plafond = Math.max(0, c(net)).toFixed(2);
  return (
    `Le compte ${numeroCompte} porte une créance reclassée au ${compte416} le ${dateReclassement} · son solde net n'est que de ` +
    `${plafond} (la créance reclassée est au ${compte416}), et un règlement de ${c(montant).toFixed(2)} le rendrait créditeur. ` +
    `Réglez ici au plus ${plafond}. Un encaissement de la créance reclassée se passe par « Recouvrement » dans « Créances ` +
    'douteuses ou litigieuses » ; un autre encaissement (avance, trop-perçu) se passe en pièce au journal.'
  );
}

/**
 * A7 ter, mineur 1 · L'AVERTISSEMENT DU RÈGLEMENT d'une facture dont le compte
 * porte une créance reclassée au 416 en vigueur · si ce règlement encaisse la
 * créance, il passe par le module. Réglée ici, dans la borne du solde net
 * (m-d), la facture reclassée se solde au compte du client pendant que le 416
 * garde la créance, et c'est une AUTRE facture du client qui paraît alors
 * impayée (troisième passage, m4 · le compte ne devient plus créditeur, m-d
 * l'empêche). Un avertissement, jamais un refus · une vente postérieure au
 * reclassement se règle ici comme une autre.
 */
export function avertissementCreanceReclassee(numeroCompte: string, compte416: string, dateReclassement: string): string {
  return (
    `Le compte ${numeroCompte} porte une créance reclassée au ${compte416} le ${dateReclassement} (« Créances douteuses ou ` +
    'litigieuses »). Si ce règlement encaisse cette créance, passez-le par « Recouvrement » dans ce module · réglée ici, la ' +
    `facture reclassée se solde au ${numeroCompte} pendant que le ${compte416} garde la créance, et une autre facture du client ` +
    'paraît impayée. Au brouillard, la pièce se supprime ; validée, elle s’annule par inscription en négatif.'
  );
}

/** Montant restant dû d'une ligne, positif, dans le sens de l'échéance. */
export function montantDu(ligne: { debit: number; credit: number }, sens: SensReglement): number {
  const brut = sens === 'FOURNISSEUR' ? ligne.credit - ligne.debit : ligne.debit - ligne.credit;
  return Math.round(brut * 100) / 100;
}

export interface LigneReglement {
  compteId: string;
  debit?: number;
  credit?: number;
  libelle: string;
}

/**
 * LES DEUX LIGNES DU RÈGLEMENT. Fournisseur · débit du 40, crédit de la
 * trésorerie. Client · débit de la trésorerie, crédit du 41. L'ordre suit la
 * règle du dépôt (débits puis crédits, voir client/src/lib/ordre-ecriture.ts).
 */
export function lignesDuReglement(params: {
  sens: SensReglement;
  compteTiersId: string;
  compteTresorerieId: string;
  montant: number;
  libelle: string;
}): LigneReglement[] {
  const { sens, compteTiersId, compteTresorerieId, montant, libelle } = params;
  return sens === 'FOURNISSEUR'
    ? [
        { compteId: compteTiersId, debit: montant, libelle },
        { compteId: compteTresorerieId, credit: montant, libelle },
      ]
    : [
        { compteId: compteTresorerieId, debit: montant, libelle },
        { compteId: compteTiersId, credit: montant, libelle },
      ];
}

/**
 * LE MONTANT RÉGLÉ se borne au dû. Moins, c'est un règlement PARTIEL, que Sage
 * prévoit et que le lettrage partiel porte déjà (CPCC). Plus, ce n'est plus un
 * règlement de ces factures · l'excédent est une avance (409) ou un trop-perçu
 * (419), une autre opération avec un autre compte, qui ne se glisse pas dans
 * celle-ci. Zéro ou négatif ne règle rien.
 */
export function motifRefusMontant(montant: number, du: number): string | null {
  if (!(montant > 0)) return 'Le montant réglé doit être positif.';
  if (Math.round(montant * 100) > Math.round(du * 100)) {
    return (
      `Le montant réglé (${montant.toFixed(2)}) dépasse le dû des factures choisies (${du.toFixed(2)}) · ` +
      "l'excédent est une avance ou un trop-perçu, à comptabiliser à part."
    );
  }
  return null;
}

/**
 * L'IMPUTATION QUE LE DOSSIER DÉCLARE EN PAYANT SON FOURNISSEUR (Code civil,
 * Livre III, art. 151 ; décision par la loi du 2026-10-07, point 4, jumeau
 * 3). « Le débiteur de plusieurs dettes a le droit de déclarer, lorsqu'il
 * paye, quelle dette il entend acquitter » · côté achats, le dossier est ce
 * débiteur, et la part qu'il désigne pour chaque facture date la déduction de
 * sa TVA (décret n° 011/42, art. 96, la taxe devenant exigible chez le
 * prestataire à l'encaissement). La pièce porte alors UNE ligne au tiers par
 * facture, lettrée avec elle seule · chaque groupe ne réunit qu'une facture
 * et la somme qui la paie, et le moteur de la TVA la date sans imputer.
 *
 * Côté client, l'imputation est celle du CLIENT (art. 151) ou de la quittance
 * qu'il a acceptée (art. 153), jamais celle du cabinet qui encaisse · elle se
 * déclare, sa pièce à l'appui (`POST /imputations-paiements`). En devise, le
 * règlement porte une seule ligne au tiers et son écart réalisé · les
 * factures se règlent alors une à une. Une ligne réglée en partie par un
 * lettrage à cheval se règle seule.
 */
export function motifRefusImputationReglement(e: {
  sens: SensReglement;
  parts: ReadonlyArray<{ ligneId: string; montant: number }>;
  /** Le dû de chaque facture choisie, par identifiant de ligne. */
  dus: ReadonlyMap<string, number>;
  /** Le montant réglé (le dû entier quand il n'est pas saisi). */
  montant: number;
  enDevise: boolean;
  reduite: boolean;
  /** L'ordre de virement de ce règlement est préparé · il imprime l'imputation (M6). */
  ordreVirement: boolean;
  /** La pièce qui a notifié l'imputation au fournisseur, sans ordre de virement (M6). */
  pieceImputation?: string | null;
}): string | null {
  const c = (x: number) => Math.round(x * 100) / 100;
  if (e.sens === 'CLIENT') {
    return (
      'Côté client, l’imputation est celle que le client déclare en payant (Code civil, Livre III, art. 151) ou celle de la ' +
      'quittance qu’il a acceptée (art. 153), jamais celle du cabinet qui encaisse · déclarez-la, sa pièce à l’appui, une fois ' +
      'le règlement validé (imputation déclarée d’un paiement).'
    );
  }
  if (e.enDevise) {
    return 'Un règlement en devise porte une seule ligne au tiers avec son écart réalisé · réglez ces factures une à une pour désigner la part de chacune.';
  }
  if (e.reduite) {
    return 'Une ligne d’à-nouveau réglée en partie par un lettrage à cheval se règle seule · retirez-la de ce règlement pour désigner les parts des autres.';
  }
  const vues = new Set<string>();
  let total = 0;
  for (const p of e.parts) {
    if (vues.has(p.ligneId)) return 'Une même facture reçoit deux parts.';
    vues.add(p.ligneId);
    const du = e.dus.get(p.ligneId);
    if (du === undefined) return 'Une part désigne une facture qui n’est pas choisie dans ce règlement.';
    if (!(p.montant > 0)) return 'Une part réglée est un montant strictement positif · retirez la facture si elle n’est pas payée.';
    if (c(p.montant) > c(du)) return `Une part (${c(p.montant).toFixed(2)}) dépasse le dû de sa facture (${c(du).toFixed(2)}).`;
    total = c(total + p.montant);
  }
  for (const id of e.dus.keys()) {
    if (!vues.has(id)) return 'Une facture choisie ne reçoit aucune part · donnez sa part, ou retirez-la du règlement.';
  }
  if (Math.round(total * 100) !== Math.round(e.montant * 100)) {
    return `La somme des parts (${total.toFixed(2)}) diffère du montant réglé (${c(e.montant).toFixed(2)}).`;
  }
  // L'IMPUTATION SE DÉCLARE AU CRÉANCIER, « LORSQU'IL PAYE » (art. 151 ;
  // relecture du 2026-10-07, M6) · l'ordre de virement l'imprime, sinon une
  // pièce qui la lui a notifiée est exigée. Une imputation que le fournisseur
  // n'a jamais reçue ne l'engage pas, et la déduction ne s'y fonde pas.
  if (!e.ordreVirement && (e.pieceImputation ?? '').trim().length < 3) {
    return (
      'L’imputation que le dossier déclare se fait au fournisseur lorsqu’il paye (Code civil, Livre III, art. 151) · ' +
      'préparez l’ordre de virement, qui imprime chaque facture et sa part, ou donnez la référence de la pièce qui la ' +
      'lui a notifiée (lettre, courriel, bordereau).'
    );
  }
  return null;
}

/**
 * L'IMPUTATION, TELLE QUE L'ORDRE DE VIREMENT L'IMPRIME (M6) · chaque
 * facture (sa référence) et sa part, dans l'ordre des parts.
 */
export function imputationImprimee(parts: ReadonlyArray<{ reference: string; montant: number }>): string {
  const fmt = (x: number) =>
    (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Factures payées · ${parts.map((p) => `${p.reference} : ${fmt(p.montant)}`).join(' ; ')}`;
}

/**
 * Le libellé de la ligne du tiers qui paie CHAQUE facture · la base et la
 * référence de la facture, rendu UNIQUE dans la pièce (une ligne retrouvée
 * par son libellé, jamais par son rang, que la lecture ne garantit pas).
 */
export function libellesDesParts(base: string, factures: ReadonlyArray<{ id: string; reference: string }>): Map<string, string> {
  const rendus = new Map<string, string>();
  const pris = new Set<string>();
  for (const f of factures) {
    const tete = `${base.slice(0, 140)} · ${f.reference.slice(0, 36)}`;
    let libelle = tete;
    for (let n = 2; pris.has(libelle); n++) libelle = `${tete} (${n})`;
    pris.add(libelle);
    rendus.set(f.id, libelle);
  }
  return rendus;
}

/**
 * LES LIGNES DU RÈGLEMENT IMPUTÉ · fournisseur seulement · un débit du 40 par
 * facture, à sa part, puis le crédit de la trésorerie pour le total.
 */
export function lignesDuReglementImpute(params: {
  compteTiersId: string;
  compteTresorerieId: string;
  parts: ReadonlyArray<{ montant: number; libelle: string }>;
  libelle: string;
}): LigneReglement[] {
  const total = Math.round(params.parts.reduce((t, p) => t + p.montant, 0) * 100) / 100;
  return [
    ...params.parts.map((p) => ({ compteId: params.compteTiersId, debit: Math.round(p.montant * 100) / 100, libelle: p.libelle })),
    { compteId: params.compteTresorerieId, credit: total, libelle: params.libelle },
  ];
}
