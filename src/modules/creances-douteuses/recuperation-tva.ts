import { imputerPaiements } from '../tva/imputation-paiements';
import { centimes, PieceJustificative } from './creances-douteuses';

/**
 * LA RÉCUPÉRATION DE LA TVA D'UNE CRÉANCE IRRÉCOUVRABLE (ligne A7 bis, partie 2).
 *
 * Les textes, lus dans la compilation DGI au 19/07/2026 (compétence
 * `fiscalite-rdc`, `code-general-2026/references/`) ·
 *
 *  · O.-L. n° 10/001, art. 52, al. 1 · « La taxe sur la valeur ajoutée
 *    ACQUITTÉE à l'occasion des ventes ou des services qui sont par la suite
 *    résiliés, annulés ou RESTENT IMPAYÉS peut être récupérée par voie
 *    d'imputation sur l'impôt dû pour les opérations faites
 *    ultérieurement. » ;
 *  · art. 52, al. 3 · « Pour les opérations impayées, lorsque la créance est
 *    RÉELLEMENT ET DÉFINITIVEMENT IRRÉCOUVRABLE, la rectification de la
 *    facture consiste en l'envoi d'un DUPLICATA de la facture initiale [...]
 *    surchargées de la mention du montant de la facture demeurée impayée au
 *    prix hors taxe [...] et pour le montant de la taxe [...] correspondante » ;
 *  · décret n° 011/42, art. 126 · « inscrite dans les déductions afférentes à
 *    la déclaration du ou des mois suivants celui de la constatation [...] de
 *    non-paiement, dans les conditions prévues pour exercer le droit à
 *    déduction » ;
 *  · décret n° 011/42, art. 127, al. 2 · la mention « FACTURE DEMEUREE
 *    IMPAYEE POUR LA SOMME DE ..., PRIX HORS TVA ET POUR LA SOMME DE ..., TVA
 *    CORRESPONDANTE QUI NE PEUT FAIRE L'OBJET D'UNE DEDUCTION » ; al. 3 · « La
 *    preuve de la créance irrécouvrable incombe à l'assujetti. »
 *
 * LA NOTE DE CRÉDIT N'EST PAS LA PIÈCE D'UN IMPAYÉ · l'art. 52 al. 2 et
 * l'art. 127 al. 1 la réservent aux opérations ANNULÉES OU RÉSILIÉES (c'est
 * le I3 (1) de CLAUDE.md, servi par la facturation) ; l'impayé se rectifie par
 * le duplicata surchargé, exigé ici facture par facture.
 *
 * Fonctions pures · le service lit, décide par elles, puis écrit.
 */

/** La mention que l'art. 127, al. 2 du décret n° 011/42 fait surcharger sur le duplicata, montants compris. */
export function mentionDuplicata(ht: number, tva: number): string {
  const f = (x: number) => centimes(x).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    `FACTURE DEMEUREE IMPAYEE POUR LA SOMME DE ${f(ht)}, PRIX HORS TVA ET POUR LA SOMME DE ${f(tva)}, ` +
    'TVA CORRESPONDANTE QUI NE PEUT FAIRE L’OBJET D’UNE DEDUCTION'
  );
}

/** Une facture désignée par la créance (`FactureCreanceDouteuse`), et la taxe de sa pièce. */
export interface FactureDeLaCreance {
  designationId: string;
  ligneEcritureId: string;
  /** La part TTC que la créance reprend de la facture. */
  montant: number;
  dateFacture: Date;
  dateEcheance: Date | null;
  libelle: string;
  numeroPiece: number | null;
  /** La taxe de la pièce de la facture · `null` quand l'écriture n'est pas lue (non validée). */
  taxe: {
    ttc: number;
    lignesTva: Array<{ ligneId: string; compteId: string; numero: string; tauxTvaId: string; tva: number; base: 'DATE_ECRITURE' | 'ENCAISSEMENT' }>;
  } | null;
}

export interface TaxeRecuperable {
  compteId: string;
  numero: string;
  tauxTvaId: string;
  tva: number;
}

export interface FactureChiffree {
  designationId: string;
  ligneEcritureId: string;
  libelle: string;
  numeroPiece: number | null;
  dateFacture: string;
  /** La part désignée. */
  designe: number;
  /** Ce que les recouvrements lui ont imputé (Code civil, Livre III, art. 154). */
  recouvre: number;
  /** L'impayé TTC · la part désignée moins ses recouvrements. */
  impayeTtc: number;
  /** L'impayé hors taxe et la taxe correspondante, tels que le duplicata les porte. */
  impayeHt: number;
  tvaCorrespondante: number;
  /** La taxe ACQUITTÉE sur l'impayé, récupérable, ligne de TVA par ligne de TVA. */
  recuperable: TaxeRecuperable[];
  tvaRecuperable: number;
  /** Pourquoi rien n'est récupérable, ou pas tout · dit, jamais deviné. */
  motifs: string[];
  mention: string;
}

export const MOTIF_TAXE_A_L_ENCAISSEMENT =
  'taxe exigible à l’encaissement (O.-L. n° 10/001, art. 25, 2°) · l’impayé n’a jamais été encaissé, sa taxe jamais acquittée, rien à récupérer';
export const MOTIF_FACTURE_SANS_TVA = 'la pièce de la facture ne porte aucune ligne de TVA collectée lisible (compte 443 à un taux)';
export const MOTIF_FACTURE_NON_LUE = 'la pièce de la facture n’est pas lue (non validée) · sa taxe ne se chiffre pas';
export const MOTIF_FACTURE_PAYEE = 'les recouvrements ont payé la facture en entier · aucun impayé';

/**
 * CHIFFRE CHAQUE FACTURE DÉSIGNÉE · l'impayé est la part désignée moins ce
 * que les recouvrements lui imputent, par la MÊME imputation que la
 * déclaration de TVA (`TauxTvaService.declaration`) · la part désignée de
 * chaque recouvrement (recouvré × désigné / reclassé), imputée entre les
 * factures par l'art. 154 du Code civil, Livre III (la plus ancienne d'abord,
 * au prorata à date égale). La taxe correspondante se lit au rapport de la
 * pièce (taxe de la ligne / TTC de la facture) ; seule celle d'une ligne datée
 * à la facture est ACQUITTÉE, donc récupérable (art. 52, al. 1).
 */
export function chiffrerFactures(p: {
  reclasse: number;
  factures: readonly FactureDeLaCreance[];
  recouvrements: ReadonlyArray<{ date: Date; montant: number }>;
}): FactureChiffree[] {
  if (p.factures.length === 0) return [];
  const designe = Math.min(
    p.reclasse,
    p.factures.reduce((t, f) => t + f.montant, 0),
  );
  const imputation =
    p.reclasse > 0.005
      ? imputerPaiements(
          p.factures.map((f) => ({ id: f.designationId, dateFacture: f.dateFacture, dateEcheance: f.dateEcheance, montant: f.montant })),
          p.recouvrements.map((m, i) => ({ id: `recouvrement-${i}`, date: m.date, montant: centimes((m.montant * designe) / p.reclasse) })),
        )
      : null;
  return p.factures.map((f) => {
    const recouvre = centimes((imputation?.parDette.get(f.designationId) ?? []).reduce((t, x) => t + x.montant, 0));
    const impayeTtc = Math.max(0, centimes(f.montant - recouvre));
    const motifs: string[] = [];
    let tvaCorrespondante = 0;
    const recuperable: TaxeRecuperable[] = [];
    if (!f.taxe) motifs.push(MOTIF_FACTURE_NON_LUE);
    else if (f.taxe.lignesTva.length === 0 || f.taxe.ttc <= 0.005) motifs.push(MOTIF_FACTURE_SANS_TVA);
    else {
      let aLEncaissement = false;
      for (const l of f.taxe.lignesTva) {
        const part = centimes((impayeTtc * l.tva) / f.taxe.ttc);
        tvaCorrespondante = centimes(tvaCorrespondante + part);
        if (l.base === 'ENCAISSEMENT') {
          aLEncaissement = true;
          continue;
        }
        if (part > 0.005) recuperable.push({ compteId: l.compteId, numero: l.numero, tauxTvaId: l.tauxTvaId, tva: part });
      }
      if (aLEncaissement && impayeTtc > 0.005) motifs.push(MOTIF_TAXE_A_L_ENCAISSEMENT);
    }
    if (impayeTtc <= 0.005) motifs.push(MOTIF_FACTURE_PAYEE);
    const impayeHt = centimes(impayeTtc - tvaCorrespondante);
    const tvaRecuperable = centimes(recuperable.reduce((t, r) => t + r.tva, 0));
    return {
      designationId: f.designationId,
      ligneEcritureId: f.ligneEcritureId,
      libelle: f.libelle,
      numeroPiece: f.numeroPiece,
      dateFacture: f.dateFacture.toISOString().slice(0, 10),
      designe: centimes(f.montant),
      recouvre,
      impayeTtc,
      impayeHt,
      tvaCorrespondante,
      recuperable,
      tvaRecuperable,
      motifs,
      mention: mentionDuplicata(impayeHt, tvaCorrespondante),
    };
  });
}

/*
  LE DÉLAI DE LA RÉCUPÉRATION · DÉCISION PAR LA LOI DU 2026-10-08 (ligne
  tva-decisions, point C ; consigne de Manasse, « réfère-toi à la loi »).

  Les textes, lus en entier dans la compilation DGI au 19/07/2026 (compétence
  `fiscalite-rdc`, `code-general-2026/references/`) ·
   · O.-L. n° 10/001, art. 37 · « Le droit à déduction prend naissance lorsque
     la taxe devient exigible chez l'assujetti. / Le droit à déduction est
     exercé jusqu'au 31 décembre de l'année qui suit celle au cours de laquelle
     la taxe est devenue exigible. » (repris par le décret n° 011/42, art. 96) ;
   · décret n° 011/42, art. 126 · la taxe des ventes « qui [...] restent
     impayées [...] est inscrite dans les déductions afférentes à la
     déclaration du ou des mois suivants celui de la CONSTATATION [...] de
     non-paiement, dans les conditions prévues pour exercer le droit à
     déduction » ;
   · O.-L. n° 10/001, art. 52, al. 3, et décret, art. 127, al. 2 et 3 · la
     créance « réellement et définitivement irrécouvrable », la rectification
     par l'envoi du duplicata surchargé, la preuve à la charge de l'assujetti.

  (1) LE DÉLAI COURT DE LA CONSTATATION DU NON-PAIEMENT · c'est le fait que
  l'art. 126 nomme, et il tient la place de l'exigibilité de l'art. 37, al. 1
  (« dans les conditions prévues pour exercer le droit à déduction »). OmegaX
  la constate par la PERTE validée (D 651 / C 416, fiche du compte 65), qui
  dit la créance irrécouvrable ; la DERNIÈRE, parce que la récupération ne
  s'ouvre qu'à la créance éteinte (art. 52, al. 3, « définitivement ») · un
  délai compté de la première perte pourrait expirer avant que le droit ne
  puisse s'exercer. Ni l'irrécouvrabilité comme fait distinct (elle n'a pas
  d'autre date que la perte qui la constate), ni l'ENVOI DU DUPLICATA · c'est
  la forme de la rectification, la condition du droit et non sa naissance,
  comme la facture de l'art. 38 pour la déduction, dont la réception ne
  déplace pas le délai (lecture de la ligne A21, `TauxTvaService.declaration`).

  (2) LE DÉLAI SE JUGE À LA DÉCLARATION QUI INSCRIT LA RÉCUPÉRATION · le droit
  est « exercé » (art. 37, al. 2) par son inscription « dans les déductions
  afférentes à la déclaration » (art. 126), et la déclaration de TVA est
  MENSUELLE (décret n° 011/42, art. 102, « pour le mois »). Le moteur lit la
  déchéance de la déduction par la PÉRIODE de la déclaration (une déclaration
  dont la période finit au plus tard le 31 décembre de l'année qui suit) ·
  la même lecture vaut ici, une règle pour un texte. Or OmegaX inscrit la
  récupération dans la déclaration du mois qui SUIT son écriture (lue comme un
  avoir sur vente constaté, art. 126). L'écriture se date donc au plus tard le
  30 NOVEMBRE de l'année qui suit la constatation · datée en décembre, elle
  serait inscrite dans la déclaration de janvier, hors du délai. Ni la date
  de l'écriture prise seule (elle laissait passer décembre), ni la date du
  GESTE (le jour où le comptable clique ne change pas la période qui inscrit
  la récupération · c'est la date de l'écriture qui la fixe, et le refus d'une
  date dans une période liquidée la garde).
*/

/** Le dernier jour où le droit s'exerce · 31 décembre de l'année qui suit la constatation (art. 37 al. 2, par le renvoi de l'art. 126). */
export function finDuDroit(derniereConstatation: Date): Date {
  return new Date(Date.UTC(derniereConstatation.getUTCFullYear() + 1, 11, 31));
}

/**
 * La dernière date d'ÉCRITURE de la récupération · le 30 novembre de l'année
 * qui suit la constatation, pour que la déclaration du mois suivant, qui
 * l'inscrit, soit celle de décembre (décision par la loi du 2026-10-08,
 * point C, ci-dessus).
 */
export function derniereDateEcriture(derniereConstatation: Date): Date {
  return new Date(Date.UTC(derniereConstatation.getUTCFullYear() + 1, 10, 30));
}

export interface DuplicataSaisi {
  designationId: string;
  reference: string | null | undefined;
  dateEnvoi: string | null | undefined;
}

export interface EntreeRecuperation {
  creanceAnnulee: boolean;
  creanceCorrigee: boolean;
  /** Le reste au 416 après TOUS les mouvements non annulés. */
  resteFinal: number;
  /** Les pertes non annulées · date, statut de leur écriture, compte débité. */
  pertes: ReadonlyArray<{ date: Date; validee: boolean; numeroPiece: number | null; compteId: string | null }>;
  /** Les désignations actives. */
  designationsActives: number;
  /** Les factures chiffrées, par désignation. */
  chiffrees: readonly FactureChiffree[];
  /** Les désignations déjà portées par une récupération non annulée. */
  dejaRecuperees: ReadonlySet<string>;
  duplicatas: readonly DuplicataSaisi[];
  motif: string | null | undefined;
  pieces: readonly PieceJustificative[];
  date: Date;
  exerciceOuvert: boolean;
  dateDansExercice: boolean;
  journalGeneral: boolean;
  /** La fin de la dernière période de TVA liquidée, s'il y en a une. */
  finDerniereLiquidation: Date | null;
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * LES REFUS, dans l'ordre où le cabinet peut les lever. Chacun dit son texte
 * et son issue. `null` · la récupération passe.
 */
export function motifRefusRecuperation(e: EntreeRecuperation): string | null {
  if (e.creanceAnnulee) return 'Ce reclassement est annulé · aucune récupération ne s’y rattache.';
  if (e.creanceCorrigee) return 'Cette créance a été corrigée par le résultat et sortie du module · la récupération ne s’y rattache plus.';
  if (e.pertes.length === 0) {
    return (
      'Aucune perte n’est constatée sur cette créance · la taxe ne se récupère que sur une créance qui « reste impayée » et dont le ' +
      'non-paiement est constaté (O.-L. n° 10/001, art. 52 ; décret n° 011/42, art. 126). Passez d’abord la perte.'
    );
  }
  if (Math.abs(e.resteFinal) > 0.005) {
    return (
      `La créance n’est pas éteinte · il reste ${centimes(e.resteFinal).toFixed(2)} au 416 après ses mouvements. La récupération ` +
      'n’est ouverte qu’à une créance « réellement et définitivement irrécouvrable » (art. 52, al. 3) · passez la perte du reste, ' +
      'ou le recouvrement, avant de récupérer la taxe.'
    );
  }
  const auBrouillard = e.pertes.find((p) => !p.validee);
  if (auBrouillard) {
    return (
      `La perte du ${jour(auBrouillard.date)} (pièce n° ${auBrouillard.numeroPiece ?? '·'}) est au brouillard · la constatation du ` +
      'non-paiement est celle du livre-journal (décret n° 011/42, art. 126). Validez-la d’abord.'
    );
  }
  const comptes = new Set(e.pertes.map((p) => p.compteId));
  if (comptes.size !== 1 || comptes.has(null)) {
    return (
      'Les pertes de cette créance ne sont pas portées à un seul compte 651 · la récupération crédite le compte de la perte, et rien ' +
      'ne dit lequel. Annulez la perte passée au mauvais compte et repassez-la au même compte que les autres.'
    );
  }
  if (e.designationsActives === 0) {
    return (
      'Aucune facture n’est désignée pour cette créance · la taxe se récupère facture par facture (duplicata de la facture ' +
      'initiale, art. 52, al. 3) et OmegaX ne la devine jamais. Désignez d’abord les factures (« Désigner les factures »).'
    );
  }
  if (e.duplicatas.length === 0) {
    return 'Choisissez au moins une facture dont le duplicata surchargé a été envoyé au client (art. 52, al. 3 ; décret n° 011/42, art. 127, al. 2).';
  }
  const vus = new Set<string>();
  for (const d of e.duplicatas) {
    const f = e.chiffrees.find((x) => x.designationId === d.designationId);
    if (!f) return 'Une facture choisie n’est pas une désignation active de cette créance · relisez la créance.';
    const qui = `Facture « ${f.libelle} » du ${f.dateFacture}`;
    if (vus.has(d.designationId)) return `${qui} · choisie deux fois.`;
    vus.add(d.designationId);
    if (e.dejaRecuperees.has(d.designationId)) {
      return `${qui} · sa taxe est déjà récupérée par une récupération non annulée · annulez-la d’abord pour la refaire.`;
    }
    if (!(d.reference ?? '').trim()) {
      return (
        `${qui} · la référence du duplicata envoyé au client est exigée · « la rectification de la facture consiste en l’envoi ` +
        'd’un duplicata de la facture initiale » (art. 52, al. 3).'
      );
    }
    if (!d.dateEnvoi) return `${qui} · la date d’envoi du duplicata est exigée (art. 52, al. 3).`;
    const envoi = new Date(d.dateEnvoi.slice(0, 10));
    if (Number.isNaN(envoi.getTime())) return `${qui} · la date d’envoi du duplicata est illisible.`;
    if (envoi.getTime() > e.date.getTime()) {
      return `${qui} · le duplicata est daté du ${jour(envoi)}, après la récupération du ${jour(e.date)} · la récupération suit l’envoi (art. 52, al. 3).`;
    }
    if (envoi.getTime() < new Date(f.dateFacture).getTime()) return `${qui} · le duplicata ne peut pas précéder la facture.`;
    if (f.impayeTtc <= 0.005) return `${qui} · ${MOTIF_FACTURE_PAYEE}.`;
  }
  const total = centimes(e.chiffrees.filter((f) => vus.has(f.designationId)).reduce((t, f) => t + f.tvaRecuperable, 0));
  if (total <= 0.005) {
    const motifs = [...new Set(e.chiffrees.filter((f) => vus.has(f.designationId)).flatMap((f) => f.motifs))];
    return `Aucune taxe acquittée sur l’impayé des factures choisies (art. 52, al. 1) · ${motifs.join(' ; ') || 'rien à récupérer'}.`;
  }
  const m = (e.motif ?? '').trim();
  if (!m) return 'Le motif est exigé · il dit pourquoi la créance est réellement et définitivement irrécouvrable (art. 52, al. 3).';
  if (e.pieces.length === 0) {
    return (
      'Au moins une pièce prouvant l’irrécouvrabilité est exigée (nature et référence) · « la preuve de la créance irrécouvrable ' +
      'incombe à l’assujetti » (décret n° 011/42, art. 127, al. 3).'
    );
  }
  if (!e.exerciceOuvert) return 'L’exercice choisi est clôturé · la récupération s’écrit dans un exercice ouvert.';
  if (!e.dateDansExercice) return 'La date de la récupération sort de l’exercice choisi.';
  if (!e.journalGeneral) return 'Le journal doit être un journal d’opérations diverses (type Général), comme celui de la perte.';
  const derniere = e.pertes.reduce((d, p) => (p.date.getTime() > d.getTime() ? p.date : d), e.pertes[0].date);
  if (e.date.getTime() < derniere.getTime()) {
    return `La récupération ne précède pas la constatation du non-paiement · la dernière perte est du ${jour(derniere)} (décret n° 011/42, art. 126).`;
  }
  const fin = finDuDroit(derniere);
  const limite = derniereDateEcriture(derniere);
  if (e.date.getTime() > limite.getTime()) {
    return (
      `Le droit à récupération s’exerce jusqu’au ${jour(fin)} · « dans les conditions prévues pour exercer le droit à déduction » ` +
      '(décret n° 011/42, art. 126), soit « jusqu’au 31 décembre de l’année qui suit » (O.-L. n° 10/001, art. 37, al. 2), ' +
      `compté de la constatation du non-paiement, la perte du ${jour(derniere)}. La récupération s’inscrit dans la déclaration ` +
      `du mois qui suit son écriture (art. 126) · datée après le ${jour(limite)}, elle tomberait dans une déclaration ` +
      `de ${fin.getUTCFullYear() + 1}, hors du délai. Datez-la au plus tard le ${jour(limite)} si cette période n’est pas liquidée ; ` +
      'sinon la taxe est acquise au Trésor.'
    );
  }
  if (e.finDerniereLiquidation && e.date.getTime() <= e.finDerniereLiquidation.getTime()) {
    return (
      `La TVA est liquidée jusqu’au ${jour(e.finDerniereLiquidation)} · une récupération datée dans ou avant une période liquidée ` +
      'ne serait reprise par aucune déclaration, et la liquidation figée ne change pas. Datez-la après cette date.'
    );
  }
  return null;
}

export const MOTIF_ANNULATION_RECUPERATION_MIN = 3;
export const MOTIF_ANNULATION_RECUPERATION_MAX = 500;

/** L'annulation d'une récupération (AUDCIF art. 20, al. 2). */
export function motifRefusAnnulationRecuperation(p: {
  dejaAnnulee: string | null;
  exerciceClos: boolean;
  /** La fin de la dernière liquidation de TVA, si elle couvre la date de la récupération ou la suit. */
  liquidationCouvrante: string | null;
  /**
   * Relecture, MAJEUR 2 · le premier jour non clôturé du journal quand une
   * clôture de période (ou du journal) couvre la date de la récupération ·
   * le négatif y serait daté (AUDCIF art. 22, 4°) et la reprise glisserait
   * d'une période de déclaration. `null` · rien ne la couvre.
   */
  periodeClose: string | null;
  motif: string | null | undefined;
}): string | null {
  if (p.dejaAnnulee) return `Cette récupération est déjà annulée, le ${p.dejaAnnulee}.`;
  if (p.exerciceClos) {
    return "L'exercice de cette récupération est clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3), hors de ce geste.";
  }
  if (p.liquidationCouvrante) {
    return (
      `La TVA est liquidée jusqu’au ${p.liquidationCouvrante}, au-delà de la date de la récupération · elle a été inscrite en ` +
      'déduction d’une déclaration figée. Une reprise se déclare à la main, avec la déclaration en cours.'
    );
  }
  if (p.periodeClose) {
    return (
      `Une clôture de période couvre la date de la récupération · son négatif serait inscrit au ${p.periodeClose}, premier ` +
      'jour non clôturé (AUDCIF art. 22, 4°), et la reprise de la taxe glisserait d’une période de déclaration (décret ' +
      'n° 011/42, art. 126). Une clôture PARTIELLE du journal s’annule (fenêtre Exercices), puis l’annulation passe ; une ' +
      'clôture de période ou totale est définitive · la reprise se déclare alors à la main avec la déclaration en cours, et ' +
      'la récupération reste en place.'
    );
  }
  const m = (p.motif ?? '').trim();
  if (m.length < MOTIF_ANNULATION_RECUPERATION_MIN || m.length > MOTIF_ANNULATION_RECUPERATION_MAX) {
    return `Le motif de l'annulation est exigé, de ${MOTIF_ANNULATION_RECUPERATION_MIN} à ${MOTIF_ANNULATION_RECUPERATION_MAX} caractères (AUDCIF art. 20, al. 2).`;
  }
  return null;
}

/** Le refus des gestes qui changeraient l'impayé d'une créance dont la taxe est récupérée. */
export function motifRecuperationEnPlace(geste: string, nombre: number): string | null {
  if (nombre === 0) return null;
  return (
    `Une récupération de TVA (art. 52) non annulée porte sur cette créance · ${geste} changerait l’impayé que ses duplicatas ` +
    'déclarent. Annulez d’abord la récupération.'
  );
}
