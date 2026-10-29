/**
 * LA DÉCISION DE RECOUVREMENT SUR UNE LIGNE (ligne gl-saisie, fonction 33 ·
 * Sage i7, « exclure des écritures du circuit de relance », « décaler la date
 * d'échéance »). Règles pures.
 *
 * DEUX GESTES, sur UNE ligne de facture, à côté de l'exclusion du TIERS
 * entier qui existait déjà (`Tiers.horsRelance`).
 *
 *  · EXCLURE LA LIGNE DE LA RELANCE · un litige sur une seule facture, un
 *    avoir promis, une facture contestée devant le client · les autres
 *    factures du même client se réclament toujours. Comme l'exclusion du
 *    tiers, ELLE PORTE SUR LE COURRIER, JAMAIS SUR LA CRÉANCE · la ligne reste
 *    à la balance âgée, aux notes, au lettrage, à l'échéancier ; la relance la
 *    MONTRE, dite exclue, sans la réclamer ni la compter dans le dû.
 *
 *  · DÉCALER L'ÉCHÉANCE · le délai accordé au débiteur. « Ce qui n'est dû
 *    qu'à terme ne peut être exigé avant l'échéance du terme » (Code civil,
 *    Livre III, art. 84) · la relance compte le retard depuis l'échéance
 *    ACCORDÉE et l'imprime. Le terme « est toujours présumé stipulé en faveur
 *    du débiteur » (art. 85) · un décalage RECULE l'échéance, il ne l'avance
 *    jamais, et une date antérieure ou égale à l'échéance de la pièce est
 *    refusée.
 *
 * LA LIGNE N'EST JAMAIS RÉÉCRITE. Une écriture validée est irréversible
 * (AUDCIF art. 22, 2° · « interdise toute suppression, addition ou
 * modification ultérieure ») · la décision vit dans sa propre table, à côté,
 * au journal d'audit, et seule la relance la lit. La balance âgée, les notes
 * par échéance et l'échéancier gardent l'échéance que la pièce porte · c'est
 * dit dans la bulle, et la limite est écrite ici plutôt que tue.
 *
 * SUR UNE LIGNE VALIDÉE SEULEMENT · une ligne du brouillard se remplace à
 * chaque modification de sa pièce, et sa décision partirait avec elle. Sur
 * une ligne de FACTURE d'un compte 40 ou 41 non lettrée · un règlement ne se
 * réclame pas, une ligne lettrée ne se réclame plus.
 *
 * LA DÉCISION SUIT LE REPORT. Après la clôture, la facture ouverte revient en
 * N+1 par une ligne d'à-nouveau, autre ligne ; la relance la rattache à sa
 * pièce d'origine (`originesDesReports`, la même clé que la date d'origine) et
 * lui applique la décision de l'origine. Une décision posée sur la ligne
 * reportée elle-même l'emporte.
 *
 * LIMITE ÉCRITE · un groupe de lettrage qui ne se répartit pas sûrement se
 * réclame pour son NET, porté par sa facture ouverte la plus ancienne (règle
 * des relances, paquet 1, M2) · la décision qui vaut est celle de CETTE
 * ligne, la seule que la relance montre et donc la seule que l'écran offre
 * de décider.
 */

export const MOTIF_MIN = 3;
export const MOTIF_MAX = 500;

/** Ce que la relance lit d'une décision. */
export interface DecisionLue {
  exclue: boolean;
  motifExclusion: string | null;
  echeanceAccordee: Date | null;
  motifEcheance: string | null;
}

export function motifRefusMotif(motif: string | null | undefined, geste: string): string | null {
  const m = (motif ?? '').trim();
  if (m.length < MOTIF_MIN) {
    return `${geste} exige un motif écrit (${MOTIF_MIN} caractères au moins) · au prochain examen, personne ne saurait le lever ni le maintenir.`;
  }
  if (m.length > MOTIF_MAX) return `Le motif tient en ${MOTIF_MAX} caractères au plus.`;
  return null;
}

/**
 * La ligne peut-elle porter une décision de recouvrement · `null` si oui.
 * Une facture d'un 40 ou d'un 41 (sens de la facture), validée, non lettrée.
 */
export function motifRefusLigne(l: {
  numero: string;
  debit: number;
  credit: number;
  statut: string;
  lettre: string | null;
}): string | null {
  const racine = l.numero.slice(0, 2);
  if (racine !== '40' && racine !== '41') {
    return `Le compte ${l.numero} n'est pas un compte de fournisseur ou de client · la relance ne le lit pas.`;
  }
  const sensFacture = racine === '41' ? l.debit > 0 : l.credit > 0;
  if (!sensFacture) return 'Cette ligne est un règlement ou un avoir · elle ne se réclame pas, aucune décision de relance ne s’y pose.';
  if (l.statut !== 'VALIDEE') {
    return 'La ligne est au brouillard · sa pièce se modifie encore et la remplace. Validez la pièce, puis posez la décision.';
  }
  if (l.lettre) return `La ligne est lettrée (${l.lettre}) · elle est soldée et ne se réclame plus.`;
  return null;
}

/**
 * Le décalage proposé · `null` s'il est admis. Il recule l'échéance de la
 * pièce (ou sa date, à défaut d'échéance), jamais ne l'avance (art. 85).
 */
export function motifRefusDecalage(accordee: Date, echeanceDeLaPiece: Date): string | null {
  if (Number.isNaN(accordee.getTime())) return "La date d'échéance accordée est illisible · AAAA-MM-JJ.";
  if (accordee.getTime() <= echeanceDeLaPiece.getTime()) {
    return (
      `L'échéance accordée doit être postérieure à celle de la pièce (${echeanceDeLaPiece.toISOString().slice(0, 10)}) · ` +
      'un décalage recule le terme, il ne l’avance pas (Code civil, Livre III, art. 85, le terme est présumé stipulé en faveur du débiteur).'
    );
  }
  return null;
}

/** La décision qui vaut pour une ligne lue · la sienne, sinon celle de sa pièce d'origine. */
export function decisionDeLaLigne(
  ligneId: string,
  origineId: string | undefined,
  decisions: Map<string, DecisionLue>,
): DecisionLue | null {
  return decisions.get(ligneId) ?? (origineId ? decisions.get(origineId) : undefined) ?? null;
}
