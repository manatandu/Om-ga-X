/**
 * LE BILAN SOCIAL À L'ÉCRAN · la lecture d'un montant tapé et la saisie
 * envoyée au serveur, qui la juge en entier (`bilan-social.ts` du serveur).
 * Rien ne se calcule ici · solde et total sont servis.
 */
export type MonnaieBilan = 'CDF' | 'USD';

export interface LigneEditee {
  numero: number;
  nombre: string;
  budgete: string;
  realise: string;
  devise: MonnaieBilan | '';
}

/**
 * Un montant tapé · espaces de milliers retirés, la virgule lue comme point
 * décimal. Vide = null ; illisible = `{ erreur }`, jamais un zéro.
 */
export function lireMontantSaisi(texte: string): { valeur: string | null } | { erreur: string } {
  const brut = texte.replace(/[\s\u00a0\u202f]/g, '');
  // « 500.000 » · un point des milliers ou trois décimales ? Ambigu, refusé et
  // dit, comme dans les conditions bancaires (`lireNombre`).
  if (/^\d{1,3}(\.\d{3})+$/.test(brut)) return { erreur: `« ${texte.trim()} » est ambigu · écrivez les milliers avec des espaces et les décimales avec une virgule.` };
  const t = brut.replace(',', '.');
  if (t === '') return { valeur: null };
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(t)) return { erreur: `« ${texte.trim()} » n'est pas un montant (deux décimales au plus).` };
  return { valeur: t };
}

/** La saisie envoyée · une ligne illisible arrête l'envoi, nommée. */
export type SaisieEnvoyee = { lignes: { numero: number; nombre: number | null; budgete: string | null; realise: string | null; devise: MonnaieBilan | null }[]; commentaire: string | null };

export function saisieAEnvoyer(lignes: LigneEditee[], commentaire: string, lu: string | null): { erreur: string } | { corps: SaisieEnvoyee & { lu: string | null } } {
  const sortie: SaisieEnvoyee['lignes'] = [];
  for (const l of lignes) {
    const b = lireMontantSaisi(l.budgete);
    const r = lireMontantSaisi(l.realise);
    if ('erreur' in b) return { erreur: `Ligne ${l.numero} · ${b.erreur}` };
    if ('erreur' in r) return { erreur: `Ligne ${l.numero} · ${r.erreur}` };
    const n = l.nombre.trim();
    if (n !== '' && !/^\d{1,8}$/.test(n)) return { erreur: `Ligne ${l.numero} · le nombre se lit en entier positif.` };
    if (n === '' && b.valeur === null && r.valeur === null) continue;
    if ((b.valeur !== null || r.valeur !== null) && !l.devise) return { erreur: `Ligne ${l.numero} · un montant exige sa monnaie (CDF ou USD).` };
    sortie.push({ numero: l.numero, nombre: n === '' ? null : Number(n), budgete: b.valeur, realise: r.valeur, devise: l.devise || null });
  }
  return { corps: { lignes: sortie, commentaire: commentaire.trim() || null, lu } };
}
