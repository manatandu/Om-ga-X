/**
 * LE GRAND LIVRE SANS LES ÉCRITURES LETTRÉES (ligne gl-saisie, fonction 56 ·
 * Sage i7, « avec ou sans les écritures lettrées »). Une VUE de travail du
 * livre déjà servi, pour réviser ce qui reste ouvert sur un compte de tiers.
 *
 * CE N'EST PLUS LE GRAND LIVRE, et l'écran le dit · le livre obligatoire porte
 * « les différents mouvements de l'exercice » (AUDCIF art. 19), tous. Les
 * TOTAUX DU COMPTE restent ceux du livre entier, et le solde progressif reste
 * le vrai solde à la date de chaque ligne · seules les lignes LETTRÉES (groupe
 * soldé, `lettre` servie) disparaissent de la liste, leur nombre et leurs
 * montants dits sous le compte. Une ligne d'un lettrage PARTIEL reste · elle
 * est encore ouverte pour son reste. Un compte dont toutes les lignes sont
 * lettrées, sans report, sort de la liste, et leur nombre se dit.
 */
export interface LigneDuLivre {
  lettre: string | null;
  debit: number;
  credit: number;
}

export interface SectionMasquee<S> {
  section: S;
  cachees: number;
  debitCache: number;
  creditCache: number;
}

export function masquerLesLettrees<L extends LigneDuLivre, S extends { lignes: L[]; report?: unknown }>(
  sections: S[],
): { sections: SectionMasquee<S>[]; comptesEntierementLettres: number } {
  const rendues: SectionMasquee<S>[] = [];
  let comptesEntierementLettres = 0;
  for (const s of sections) {
    const gardees = s.lignes.filter((l) => !l.lettre);
    const lettrees = s.lignes.filter((l) => !!l.lettre);
    if (gardees.length === 0 && lettrees.length > 0 && !s.report) {
      comptesEntierementLettres++;
      continue;
    }
    rendues.push({
      section: { ...s, lignes: gardees },
      cachees: lettrees.length,
      debitCache: Math.round(lettrees.reduce((n, l) => n + l.debit, 0) * 100) / 100,
      creditCache: Math.round(lettrees.reduce((n, l) => n + l.credit, 0) * 100) / 100,
    });
  }
  return { sections: rendues, comptesEntierementLettres };
}
