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
  const t = texte.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return { valeur: null };
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(t)) return { erreur: `« ${texte.trim()} » n'est pas un montant (deux décimales au plus).` };
  return { valeur: t };
}

/** La saisie envoyée · une ligne illisible arrête l'envoi, nommée. */
export type SaisieEnvoyee = { lignes: { numero: number; nombre: number | null; budgete: string | null; realise: string | null; devise: MonnaieBilan | null }[]; commentaire: string | null };

export function saisieAEnvoyer(lignes: LigneEditee[], commentaire: string): { erreur: string } | { corps: SaisieEnvoyee } {
  const sortie: SaisieEnvoyee['lignes'] = [];
  for (const l of lignes) {
    const b = lireMontantSaisi(l.budgete);
    const r = lireMontantSaisi(l.realise);
    if ('erreur' in b) return { erreur: `Ligne ${l.numero} · ${b.erreur}` };
    if ('erreur' in r) return { erreur: `Ligne ${l.numero} · ${r.erreur}` };
    const n = l.nombre.trim();
    if (n !== '' && !/^\d{1,8}$/.test(n)) return { erreur: `Ligne ${l.numero} · le nombre se lit en entier positif.` };
    if (n === '' && b.valeur === null && r.valeur === null) continue;
    sortie.push({ numero: l.numero, nombre: n === '' ? null : Number(n), budgete: b.valeur, realise: r.valeur, devise: l.devise || null });
  }
  return { corps: { lignes: sortie, commentaire: commentaire.trim() || null } };
}
