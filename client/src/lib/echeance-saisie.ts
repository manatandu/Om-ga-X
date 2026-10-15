import { montant } from './montants';

/**
 * ÉCHÉANCE ET MODE DE RÈGLEMENT D'UNE LIGNE DE SAISIE (ligne sage-l2,
 * fonctions 1 et 3). Ce sont des exceptions de la ligne, comme la date de
 * versement · la zone ne s'ouvre que sur un compte de TIERS (classe 4), où
 * l'échéance range la créance ou la dette dans la balance âgée, l'échéancier,
 * les relances et les notes par échéance. Sur un compte de charge ou de
 * trésorerie, une échéance n'a pas d'objet.
 *
 * L'ÉCHÉANCIER DU MODÈLE DE RÈGLEMENT se calcule au SERVEUR
 * (`GET /tiers/echeancier-de-ligne/:compteId`, `echeancier-modele.ts`), qui
 * dit aussi quelle ligne le reçoit · l'écran n'en refait aucun calcul. Il ne
 * fait ici que découper la ligne selon les échéances retenues, au centime.
 */
export function porteUneEcheance(numero: string | null | undefined): boolean {
  return !!numero && numero.startsWith('4');
}

/** Ce que le serveur rend pour la ligne d'une facture. */
export interface EcheancierDeLigne {
  tiers: { id: string; code: string; nom: string } | null;
  modele: { id: string; intitule: string } | null;
  validationAutomatique: boolean;
  modeHabituel: { id: string; code: string } | null;
  /** La ligne reçoit-elle l'échéancier d'un modèle (facture sur un 40 ou un 41) · le tiers mis à part. */
  applicable: boolean;
  echeances: EcheanceDeLigne[];
  motif: string | null;
}

export interface EcheanceDeLigne {
  ordre: number;
  montant: number;
  dateEcheance: string;
  modeReglementId: string | null;
  modeCode: string | null;
}

/** Une échéance retouchée dans la fenêtre · le montant tel que tapé, lu au centime. */
export interface EcheanceSaisie {
  montant: string;
  dateEcheance: string;
  modeReglementId: string;
}

/** Un montant tapé avec ses espaces et sa virgule, en centimes entiers ; illisible, null. */
export function centimesSaisis(texte: string): number | null {
  const propre = texte.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  return Math.round(Number(propre) * 100);
}

/**
 * LES ÉCHÉANCES RETOUCHÉES REFONT LA LIGNE, au centime · sinon la pièce
 * découpée ne s'équilibrerait plus, ou une échéance à zéro ferait une ligne
 * vide. Null quand tout tient.
 */
export function motifEcheancesSaisies(echeances: readonly EcheanceSaisie[], montantLigne: number): string | null {
  if (echeances.length === 0) return 'Aucune échéance.';
  let total = 0;
  for (const [i, e] of echeances.entries()) {
    const c = centimesSaisis(e.montant);
    if (c === null) return `Échéance ${i + 1} · montant illisible.`;
    if (c <= 0) return `Échéance ${i + 1} · le montant doit être positif.`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dateEcheance)) return `Échéance ${i + 1} · la date est attendue.`;
    total += c;
  }
  const attendu = Math.round(montantLigne * 100);
  if (total !== attendu) {
    return `Les échéances font ${montant(total / 100)} pour une ligne de ${montant(montantLigne)} · écart de ${montant((attendu - total) / 100)}.`;
  }
  return null;
}

interface LigneDecoupable {
  debit: number;
  credit: number;
  dateEcheance?: string;
  modeReglementId?: string;
  modeCode?: string;
  cle?: string;
}

/**
 * UNE LIGNE PAR ÉCHÉANCE · même compte, même libellé, même sens, chacune son
 * montant, sa date et son mode (Sage, « fenêtre multi-échéance »). La ligne
 * d'origine garde sa clé sur la première ; les suivantes en reçoivent une à
 * elles. Les échéances doivent avoir passé `motifEcheancesSaisies`.
 */
export function decouperLigne<L extends LigneDecoupable>(
  ligne: L,
  echeances: readonly EcheanceSaisie[],
  codeDuMode: (id: string) => string | undefined,
): L[] {
  const auDebit = ligne.debit > 0;
  return echeances.map((e, i) => {
    const montant = (centimesSaisis(e.montant) ?? 0) / 100;
    return {
      ...ligne,
      cle: i === 0 ? ligne.cle : `${ligne.cle ?? 'l'}-${i + 1}`,
      debit: auDebit ? montant : 0,
      credit: auDebit ? 0 : montant,
      dateEcheance: e.dateEcheance,
      modeReglementId: e.modeReglementId || undefined,
      modeCode: e.modeReglementId ? codeDuMode(e.modeReglementId) : undefined,
    };
  });
}

/** Les échéances du serveur, rendues saisissables dans la fenêtre. */
export function echeancesSaisissables(echeances: readonly EcheanceDeLigne[], modeDejaChoisi: string | undefined): EcheanceSaisie[] {
  return echeances.map((e) => ({
    montant: e.montant.toFixed(2),
    dateEcheance: e.dateEcheance,
    // Le mode choisi à la main sur la ligne prime sur celui du modèle.
    modeReglementId: modeDejaChoisi ?? e.modeReglementId ?? '',
  }));
}
