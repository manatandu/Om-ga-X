/**
 * L'IMPUTATION DES PAIEMENTS · Code civil congolais, Livre III (décret du
 * 30 juillet 1888), Titre I, « § 3 De l'imputation des payements », lu le
 * 2026-10-07 (décision par la loi du même jour, point 4,
 * `docs/decisions-par-la-loi-2026-10-07-bis.md`).
 *
 *   Art. 151 · « Le débiteur de plusieurs dettes a le droit de déclarer,
 *   lorsqu'il paye, quelle dette il entend acquitter. »
 *   Art. 153 · « Lorsque le débiteur de diverses dettes a accepté une
 *   quittance par laquelle le créancier a imputé ce qu'il a reçu sur l'une de
 *   ces dettes spécialement, le débiteur ne peut plus demander l'imputation
 *   sur une dette différente [...] »
 *   Art. 154 · « Lorsque la quittance ne porte aucune imputation, le payement
 *   doit être imputé sur la dette que le débiteur avait pour lors le plus
 *   d'intérêt d'acquitter entre celles qui sont pareillement échues, sinon sur
 *   la dette échue, quoique moins onéreuse que celles qui ne le sont point.
 *   Si les dettes sont d'égale nature, l'imputation se fait sur la plus
 *   ancienne : toutes choses égales, elle se fait proportionnellement. »
 *
 * POURQUOI ELLE DATE LA TVA · l'O.-L. n° 10/001, art. 25, 2°, rend la taxe
 * d'une prestation exigible « au moment de l'encaissement du prix », et le
 * décret n° 011/42, art. 57, définit l'encaissement comme la perception des
 * sommes « du fait de la réalisation de l'opération » · la taxe rendue
 * exigible est celle de l'opération dont la somme paie le prix. Les textes de
 * la TVA ne disent pas quelle dette une somme paie ; le droit commun le dit,
 * et rien ne l'écarte (aucun Acte uniforme ne porte de règle contraire).
 * Côté achats, le dossier est le débiteur · son imputation est celle qu'il
 * déclare en payant, et la déduction suit l'exigibilité chez le prestataire
 * (art. 37 al. 1 ; décret art. 96).
 *
 * L'ORDRE, TEL QUE CE MODULE LE LIT.
 *  1. L'imputation DÉCLARÉE (art. 151, ou la quittance acceptée de l'art. 153)
 *     prime · elle se saisit par paiement, avec sa pièce
 *     (`ImputationPaiement`). Un LETTRAGE posé par le cabinet du créancier
 *     n'est ni l'une ni l'autre · il dit quelles pièces se répondent, pas
 *     quelle dette une somme paie.
 *  2. Sinon, l'imputation LÉGALE (art. 154) · d'abord les dettes ÉCHUES à la
 *     date du paiement (une dette sans échéance l'est dès sa facture), puis
 *     celles qui ne le sont pas ; entre dettes de même situation, la PLUS
 *     ANCIENNE par la date de la facture ; à date égale, au PRORATA.
 *  3. OmegaX ne lit sur une facture ni intérêt, ni pénalité, ni sûreté · il
 *     les tient pour d'ÉGALE NATURE (« le plus d'intérêt d'acquitter » n'est
 *     pas lu), et la déclaration le dit.
 *
 * DEUX LECTURES D'OMEGAX, DITES. (a) « La plus ancienne » n'est pas définie ·
 * la dette née la première (date de la facture) ; l'autre lecture (échéance
 * la plus ancienne) est gardée en réserve, les deux coïncidant pour des
 * factures à même délai de paiement. (b) Un paiement antérieur à toutes les
 * dettes ouvertes (acompte versé avant la facture) s'impute sur la première
 * qui naît · l'art. 25, 2° rend la taxe d'un acompte exigible à sa
 * perception, et la date de la taxe reste celle du paiement.
 *
 * FONCTION PURE · aucune lecture de base, aucun arrondi autre que le centime.
 */

const EPSILON = 0.005;
const c = (n: number) => Math.round(n * 100) / 100;

export type FondementImputation = 'DECLAREE' | 'LEGALE';

export interface DetteImputable {
  id: string;
  /** Date de la facture · « la plus ancienne » (art. 154). */
  dateFacture: Date;
  /** Échéance de la dette · `null`, échue dès sa facture. */
  dateEcheance: Date | null;
  montant: number;
}

export interface PaiementImputable {
  id: string;
  date: Date;
  montant: number;
}

export interface ImputationDeclaree {
  paiementId: string;
  detteId: string;
  montant: number;
}

export interface PartImputee {
  paiementId: string;
  date: Date;
  montant: number;
  fondement: FondementImputation;
}

export interface ResultatImputation {
  /** Ce que chaque dette a reçu, paiement par paiement, dans l'ordre des dates. */
  parDette: Map<string, PartImputee[]>;
  /** Ce qu'aucune dette ouverte ne pouvait recevoir (trop-perçu). */
  nonImpute: Array<{ paiementId: string; montant: number }>;
  /** Une imputation déclarée qui dépassait le reste de sa dette ou du paiement · ramenée, et dite. */
  declareesRamenees: Array<{ paiementId: string; detteId: string; declare: number; retenu: number }>;
}

/** La dette est-elle échue au jour du paiement ? Sans échéance, dès sa facture. */
export function estEchue(dette: DetteImputable, au: Date): boolean {
  const echeance = dette.dateEcheance ?? dette.dateFacture;
  return echeance.getTime() <= au.getTime();
}

/**
 * Répartit `montant` sur les dettes candidates dans l'ordre de l'art. 154 ·
 * échues d'abord, puis la plus ancienne, et au prorata à date égale. Rend ce
 * qui n'a pu être imputé.
 */
function imputerLegalement(
  montant: number,
  candidates: DetteImputable[],
  reste: Map<string, number>,
  date: Date,
  ajouter: (detteId: string, part: number) => void,
): number {
  let disponible = c(montant);
  const ouvertes = candidates.filter((d) => (reste.get(d.id) ?? 0) > EPSILON);
  // Les dettes nées au plus tard le jour du paiement d'abord ; une avance ne
  // va aux dettes nées après qu'à défaut (lecture (b)).
  const nees = ouvertes.filter((d) => d.dateFacture.getTime() <= date.getTime());
  const aNaitre = ouvertes.filter((d) => d.dateFacture.getTime() > date.getTime());
  const rang = (d: DetteImputable) => (estEchue(d, date) ? 0 : 1);
  const paliers: DetteImputable[][] = [];
  for (const lot of [nees, aNaitre]) {
    const tries = [...lot].sort(
      (a, b) => rang(a) - rang(b) || a.dateFacture.getTime() - b.dateFacture.getTime() || a.id.localeCompare(b.id),
    );
    for (const d of tries) {
      const dernier = paliers[paliers.length - 1];
      const tete = dernier?.[0];
      if (tete && lot.includes(tete) && rang(tete) === rang(d) && tete.dateFacture.getTime() === d.dateFacture.getTime()) {
        dernier.push(d);
      } else paliers.push([d]);
    }
  }
  for (const palier of paliers) {
    if (disponible <= EPSILON) break;
    const dus = palier.map((d) => reste.get(d.id) ?? 0);
    const total = dus.reduce((t, x) => t + x, 0);
    if (total <= EPSILON) continue;
    if (disponible >= total - EPSILON) {
      palier.forEach((d, i) => ajouter(d.id, dus[i]));
      disponible = c(disponible - total);
      continue;
    }
    // TOUTES CHOSES ÉGALES, PROPORTIONNELLEMENT · au centime, le reste à la
    // plus lourde, pour que la somme rendue vaille le paiement exactement.
    let cumul = 0;
    let plusLourde = 0;
    const parts = dus.map((du, i) => {
      if (du > dus[plusLourde]) plusLourde = i;
      const p = c((disponible * du) / total);
      cumul = c(cumul + p);
      return p;
    });
    parts[plusLourde] = c(parts[plusLourde] + disponible - cumul);
    palier.forEach((d, i) => {
      if (parts[i] > EPSILON) ajouter(d.id, Math.min(parts[i], dus[i]));
    });
    disponible = 0;
  }
  return disponible;
}

/** Une ligne de tiers lue pour une déclaration · le paiement ou une facture. */
export interface LigneDeTiersLue {
  id: string;
  compteId: string;
  numero: string;
  /** Débit moins crédit · le sens dit la facture ou le paiement. */
  sens: number;
  validee: boolean;
  lettrageId: string | null;
  /** Date de l'écriture · celle du paiement, pour la date de la pièce (M3). */
  date?: Date | null;
  /** Ligne d'une écriture d'à-nouveau (report de clôture ou provisoire) · un report n'est pas un paiement. */
  aNouveau?: boolean;
  /** L'écriture appartient à un exercice clôturé. */
  exerciceClos?: boolean;
}

/** Une date lue au JOUR (UTC), comme le sont les dates comptables. */
const jourDe = (d: Date) => d.toISOString().slice(0, 10);
const jjmmaaaa = (d: Date) => jourDe(d).split('-').reverse().join('/');

/**
 * UN EXERCICE CLÔTURÉ NE SE RETOUCHE PAS (relecture du 2026-10-07, M3, puis
 * second tour, M-a) · ses déclarations de TVA sont arrêtées sur l'imputation
 * que portaient ses paiements. Le même motif refuse de DÉCLARER et de RETIRER
 * · la porte qui admettait l'un et refusait l'autre faisait d'une déclaration
 * posée par erreur sur un paiement de N clôturé un acte sans retour.
 */
export function motifPaiementExerciceClos(date: Date | null | undefined): string {
  return (
    `Le paiement du ${date ? jjmmaaaa(date) : '?'} appartient à un exercice clôturé · son imputation ne se déclare ` +
    'ni ne se retire plus (ses déclarations de TVA sont arrêtées sur l’imputation qu’il portait).'
  );
}

/**
 * UN REPORT D'À-NOUVEAU N'EST PAS UN PAIEMENT (relecture du 2026-10-07,
 * second tour, B-1). La somme a été payée une fois, dans l'exercice de la
 * pièce d'origine · c'est là que le débiteur a déclaré, « lorsqu'il paye »,
 * quelle dette il acquittait (Code civil, Livre III, art. 151). Déclarée sur
 * le report, elle se lirait une seconde fois. La déclaration est donc
 * REFUSÉE, avec le paiement d'origine nommé quand la lecture du groupe le
 * retrouve · jamais renvoyée d'office sur lui, qui peut appartenir à un
 * exercice clôturé (`motifPaiementExerciceClos`).
 */
export function motifReportDePaiement(origine: string | null): string {
  return (
    'La ligne désignée comme paiement est le report à nouveau d’un paiement d’un exercice précédent' +
    (origine ? ` (${origine})` : '') +
    ' · ce n’est pas un paiement. Le débiteur déclare quelle dette il acquitte « lorsqu’il paye » (Code civil, Livre III, ' +
    'art. 151) · déclarez l’imputation sur le paiement d’origine, dans son exercice. Si cet exercice est clôturé, ' +
    'l’imputation qu’il portait reste celle de ses déclarations de TVA, et l’imputation légale s’applique au reste (art. 154).'
  );
}

/**
 * LE GROUPE QUE LE MOTEUR DE LA TVA LIT EN BLOC NE REÇOIT AUCUNE DÉCLARATION
 * (relecture du 2026-10-07, second tour, M-b) · la porte l'admettait, la
 * fenêtre la montrait, et le moteur l'écartait sans un mot. Le motif est
 * celui que la lecture partagée rend (`TauxTvaService.lectureDuGroupe`).
 */
export function motifGroupeLuEnBloc(motif: string): string {
  return (
    `Le moteur de la TVA lit ce groupe en bloc (${motif}) · aucune imputation n’y est lue, et une déclaration n’y serait ` +
    'pas retenue. Lettrez à part ce qui l’empêche de se décomposer (un avoir avec sa seule facture, par exemple), puis ' +
    'déclarez l’imputation.'
  );
}

/**
 * LA DÉCLARATION D'UNE IMPUTATION SE REFUSE PAR UN MOTIF NOMMÉ (décision par
 * la loi du 2026-10-07, point 4). Elle porte sur un paiement VALIDÉ au compte
 * d'un tiers (AUDCIF art. 22, 2°), et sur des factures du MÊME compte, de sens
 * opposé, réunies avec lui dans un même groupe de lettrage · c'est là que le
 * moteur de la TVA la lit. Aucune part au-delà de ce qui reste de la facture
 * (déclarations actives d'autres paiements déduites), aucun total au-delà du
 * paiement. Une déclaration active se retire avant d'être refaite.
 */
export function motifRefusDeclaration(e: {
  reglement: LigneDeTiersLue | null;
  /**
   * `dejaDeclare` · ce que la facture a DÉJÀ reçu d'autres paiements de son
   * groupe · les paiements antérieurs, imputés par leur déclaration ou par
   * l'art. 154, et les déclarations actives des paiements postérieurs
   * (relecture du 2026-10-07, mineur et M4) ; `consommePar` les nomme.
   */
  factures: Array<{ ligne: LigneDeTiersLue | null; idDemande: string; montant: number; dejaDeclare: number; consommePar?: string[] }>;
  dejaActive: boolean;
  pieceReference: string;
  fondement: 'DECLARATION_DU_DEBITEUR' | 'QUITTANCE_ACCEPTEE';
  pieceDate: Date | null;
  preuveAcceptation?: string | null;
  /** Le paiement d'origine d'un report, nommé (pièce, date) quand la lecture du groupe le retrouve. */
  origineDuReport?: string | null;
  /** Le motif qui fait lire le groupe en bloc (`TauxTvaService.lectureDuGroupe`) · `null`, le groupe s'impute. */
  motifEnBloc?: string | null;
}): string | null {
  const r = e.reglement;
  if (!r) return 'Le paiement désigné est introuvable dans ce dossier.';
  if (!r.validee) return 'Le paiement est au brouillard · seule une écriture validée (livre-journal) se déclare (AUDCIF art. 22, 2°).';
  // Le client (41) et le fournisseur (40) seuls · c'est sur eux que la TVA à
  // l'encaissement lit ses factures et ses règlements. Le sens dit le
  // paiement · un crédit au client, un débit au fournisseur.
  const auClient = r.numero.startsWith('41');
  if (!auClient && !r.numero.startsWith('40')) {
    return `Le compte ${r.numero} n’est ni un compte client (41) ni un compte fournisseur (40) · l’imputation d’un paiement se déclare sur le compte du tiers qui paie ou qui est payé.`;
  }
  if (Math.abs(r.sens) <= EPSILON || (auClient ? r.sens > 0 : r.sens < 0)) {
    return `La ligne désignée comme paiement est ${auClient ? 'au débit du client' : 'au crédit du fournisseur'} · c’est le sens d’une facture, pas d’un règlement.`;
  }
  if (r.aNouveau) return motifReportDePaiement(e.origineDuReport ?? null);
  if (r.exerciceClos) return motifPaiementExerciceClos(r.date);
  if (!r.lettrageId) {
    return (
      'Le paiement n’est lettré avec aucune facture · une imputation déclarée se lit dans le groupe de lettrage qui réunit le ' +
      'paiement et ses factures. Lettrez-les d’abord (Interrogation et lettrage), puis déclarez l’imputation.'
    );
  }
  if (e.motifEnBloc) return motifGroupeLuEnBloc(e.motifEnBloc);
  if (e.dejaActive) {
    return 'Une imputation est déjà déclarée pour ce paiement · retirez-la (motif exigé) avant d’en déclarer une autre.';
  }
  if (e.pieceReference.trim().length < 3) {
    return 'La pièce est exigée (ordre de virement ou lettre qui cite la facture, quittance acceptée) · une déclaration sans pièce ne se vérifie pas.';
  }
  // LA PIÈCE EST DATÉE, ET SA DATE DIT SI ELLE PEUT FONDER L'IMPUTATION
  // (relecture du 2026-10-07, M3).
  if (!e.pieceDate || Number.isNaN(e.pieceDate.getTime())) {
    return 'La date de la pièce est exigée · la déclaration du débiteur se fait lorsqu’il paye (Code civil, Livre III, art. 151), la quittance constate ce que le créancier a reçu (art. 153).';
  }
  const datePaiement = r.date ?? null;
  if (e.fondement === 'DECLARATION_DU_DEBITEUR' && datePaiement && jourDe(e.pieceDate) > jourDe(datePaiement)) {
    return (
      `La pièce du ${jjmmaaaa(e.pieceDate)} est postérieure au paiement du ${jjmmaaaa(datePaiement)} · le débiteur déclare ` +
      'quelle dette il acquitte « lorsqu’il paye » (Code civil, Livre III, art. 151), pas après. Une imputation faite ensuite ' +
      'par le créancier sur sa quittance, et acceptée par le débiteur, se déclare comme quittance acceptée (art. 153), avec la ' +
      'preuve de l’acceptation ; sinon l’imputation légale s’applique (art. 154).'
    );
  }
  if (e.fondement === 'QUITTANCE_ACCEPTEE') {
    if (datePaiement && jourDe(e.pieceDate) < jourDe(datePaiement)) {
      return (
        `La quittance du ${jjmmaaaa(e.pieceDate)} est antérieure au paiement du ${jjmmaaaa(datePaiement)} · elle constate ce ` +
        'que le créancier « a reçu » (Code civil, Livre III, art. 153), elle ne le précède pas.'
      );
    }
    if ((e.preuveAcceptation ?? '').trim().length < 3) {
      return (
        'La preuve de l’acceptation est exigée · l’art. 153 ne lie le débiteur qu’à la quittance qu’il « a acceptée » ' +
        '(contreseing, lettre ou courriel du débiteur, avec sa référence).'
      );
    }
  }
  const vues = new Set<string>();
  let total = 0;
  for (const f of e.factures) {
    if (vues.has(f.idDemande)) return 'Une même facture figure deux fois dans la déclaration.';
    vues.add(f.idDemande);
    const l = f.ligne;
    if (!l) return 'Une facture désignée est introuvable dans ce dossier.';
    if (l.id === r.id) return 'Le paiement ne s’impute pas sur lui-même.';
    if (l.compteId !== r.compteId) return `La facture désignée est au compte ${l.numero}, le paiement au compte ${r.numero} · un paiement ne paie que les dettes de son tiers.`;
    if (!l.validee) return `Une facture désignée (compte ${l.numero}) est au brouillard · seule une écriture validée se déclare.`;
    if (Math.abs(l.sens) <= EPSILON || l.sens > 0 === r.sens > 0) {
      return 'Une ligne désignée est dans le sens du paiement · ce n’est pas une dette qu’il paie.';
    }
    if (l.lettrageId !== r.lettrageId) {
      return 'Une facture désignée n’est pas dans le groupe de lettrage du paiement · lettrez-la avec lui, ou retirez-la de la déclaration.';
    }
    const reste = c(Math.abs(l.sens) - f.dejaDeclare);
    if (!(f.montant > 0) || c(f.montant) > reste + EPSILON) {
      const qui = (f.consommePar ?? []).length > 0 ? ` (${f.consommePar!.join(' ; ')})` : '';
      return (
        `La part imputée (${c(f.montant).toFixed(2)}) dépasse ce qui reste de la facture (${Math.max(0, reste).toFixed(2)}` +
        (f.dejaDeclare > EPSILON ? `, après ${c(f.dejaDeclare).toFixed(2)} déjà imputés ou déclarés sur d’autres paiements${qui}` : '') +
        ').'
      );
    }
    total = c(total + f.montant);
  }
  if (total > Math.abs(r.sens) + EPSILON) {
    return `Les parts déclarées (${total.toFixed(2)}) dépassent le paiement (${c(Math.abs(r.sens)).toFixed(2)}).`;
  }
  return null;
}

/**
 * IMPUTE LES PAIEMENTS SUR LES DETTES, paiement par paiement dans l'ordre de
 * leurs dates (puis de leur identifiant, pour un ordre stable) · d'abord ce
 * qui est DÉCLARÉ pour ce paiement, borné par le reste de chaque dette et du
 * paiement, puis le reste du paiement par l'art. 154.
 */
export function imputerPaiements(
  dettes: readonly DetteImputable[],
  paiements: readonly PaiementImputable[],
  declarees: readonly ImputationDeclaree[] = [],
): ResultatImputation {
  const reste = new Map(dettes.map((d) => [d.id, c(d.montant)]));
  const parDette = new Map<string, PartImputee[]>(dettes.map((d) => [d.id, []]));
  const nonImpute: Array<{ paiementId: string; montant: number }> = [];
  const declareesRamenees: ResultatImputation['declareesRamenees'] = [];
  const ordre = [...paiements].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  for (const p of ordre) {
    let disponible = c(p.montant);
    const poser = (detteId: string, part: number, fondement: FondementImputation) => {
      const x = c(part);
      if (x <= EPSILON) return;
      reste.set(detteId, c((reste.get(detteId) ?? 0) - x));
      parDette.get(detteId)!.push({ paiementId: p.id, date: p.date, montant: x, fondement });
    };
    for (const d of declarees.filter((x) => x.paiementId === p.id)) {
      // Une facture déclarée qui n'est plus dans le groupe (délettrée depuis)
      // ne reçoit rien · la déclaration est DITE non retenue, jamais oubliée.
      if (!reste.has(d.detteId)) {
        declareesRamenees.push({ paiementId: p.id, detteId: d.detteId, declare: c(d.montant), retenu: 0 });
        continue;
      }
      const retenu = c(Math.max(0, Math.min(d.montant, reste.get(d.detteId)!, disponible)));
      if (Math.abs(retenu - c(d.montant)) > EPSILON) {
        declareesRamenees.push({ paiementId: p.id, detteId: d.detteId, declare: c(d.montant), retenu });
      }
      poser(d.detteId, retenu, 'DECLAREE');
      disponible = c(disponible - retenu);
    }
    if (disponible <= EPSILON) continue;
    const restant = imputerLegalement(disponible, [...dettes], reste, p.date, (id, part) => poser(id, part, 'LEGALE'));
    if (restant > EPSILON) nonImpute.push({ paiementId: p.id, montant: c(restant) });
  }
  return { parDette, nonImpute, declareesRamenees };
}
