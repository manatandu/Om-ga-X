/**
 * L'AFFECTATION SOLDE LE RÉSULTAT LÀ OÙ IL EST (paquet 1, point A6 ;
 * décision de Manasse du 2026-10-09).
 *
 * AUDCIF, Titre VII, compte 13 · « À la réouverture des comptes de l'exercice
 * suivant, les entités ont la possibilité d'utiliser un compte spécial
 * "Résultat en instance d'affectation" (130) » ; « l'affectation du résultat
 * d'un exercice est décidée par les organes compétents au cours de l'exercice
 * suivant ; le compte 13 est donc soldé lors de la comptabilisation de cette
 * affectation ». Compte 11 · crédité « par le débit du 131 (Résultat net :
 * Bénéfice) ou du 1301 ».
 *
 * L'affectation débitait toujours le 131 (ou créditait le 139). Un résultat
 * que le cabinet a viré au 130 à la réouverture (D 131 / C 1301) y restait ·
 * le 131 passait en négatif, le 130 gardait le résultat, et celui-ci comptait
 * deux fois aux capitaux propres jusqu'au virement de secours de la clôture
 * (`exercice/virement-resultat-non-affecte.ts`), qui le portait alors au
 * report à nouveau par-dessus l'affectation déjà passée.
 *
 * La part portée au 1301 (bénéfice, solde CRÉDITEUR) ou au 1309 (perte,
 * solde DÉBITEUR) dans l'exercice d'accueil se solde d'abord, bornée au
 * montant à affecter ; le reste se solde sur le 131 ou le 139, comme avant.
 * Le solde se lit brouillard compris · l'écriture d'affectation y entre
 * elle-même au brouillard, et le virement au 130 peut l'être encore. Un
 * solde du mauvais sens n'est jamais pris. Le SYCEBNL n'ouvre pas de 130
 * (plan semé · 131 et 139 seuls) · aucune part, rien ne change.
 */

/** Une ligne de balance de l'exercice d'accueil (solde = débit moins crédit). */
export interface LigneDuResultat {
  compteId: string;
  numero: string;
  solde: number;
}

/** Ce que l'affectation solde au 130, compte par compte, et ce qui reste pour le 131 ou le 139. */
export interface PartsDuResultat {
  parts: Array<{ compteId: string; numero: string; montant: number }>;
  reste: number;
}

export function partsAuResultatEnInstance(
  lignes: readonly LigneDuResultat[],
  estBenefice: boolean,
  montant: number,
): PartsDuResultat {
  const racine = estBenefice ? '1301' : '1309';
  const parts: PartsDuResultat['parts'] = [];
  // En centimes entiers · un reste de 0,000001 ne doit pas appeler une ligne
  // au 131 pour rien.
  let reste = Math.round(montant * 100);
  const candidates = lignes.filter((l) => l.numero.startsWith(racine)).sort((a, b) => a.numero.localeCompare(b.numero));
  for (const l of candidates) {
    if (reste <= 0) break;
    const disponible = Math.round((estBenefice ? -l.solde : l.solde) * 100);
    if (disponible <= 0) continue;
    const pris = Math.min(disponible, reste);
    parts.push({ compteId: l.compteId, numero: l.numero, montant: pris / 100 });
    reste -= pris;
  }
  return { parts, reste: reste / 100 };
}
