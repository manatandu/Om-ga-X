/**
 * LES POSTES DU TABLEAU DES FLUX LAISSÉS VIDES (paquet 1, A7).
 *
 * Le serveur laisse vides les postes qu'il ne peut pas lire · une ouverture
 * passée en OD au premier jour, sans exercice précédent ni report, n'est lue
 * ni comme flux ni comme ouverture (SYCEBNL art. 16, 4) ; AUDCIF art. 34). Il
 * les sert à 0 et les nomme (`postesVides`, `postesNonCalculables`) · l'écran
 * les écrit « · », jamais « 0,00 », qui se lirait comme un montant constaté.
 */

/** Le montant qu'une ligne du tableau écrit · aucun pour un poste vide. */
export function montantDuPosteDeFlux(ref: string, montant: number, vides: readonly string[] | undefined): number | undefined {
  return vides?.includes(ref) ? undefined : montant;
}

/**
 * Les postes laissés vides, regroupés par motif · un même motif (l'ouverture
 * passée en OD) vide une vingtaine de postes, et se dit une fois, ses postes
 * nommés, dans l'ordre du tableau.
 */
export function postesParMotif(postes: ReadonlyArray<{ ref: string; raison: string }> | undefined): Array<{ refs: string[]; raison: string }> {
  const groupes: Array<{ refs: string[]; raison: string }> = [];
  for (const p of postes ?? []) {
    const groupe = groupes.find((g) => g.raison === p.raison);
    if (groupe) groupe.refs.push(p.ref);
    else groupes.push({ refs: [p.ref], raison: p.raison });
  }
  return groupes;
}
