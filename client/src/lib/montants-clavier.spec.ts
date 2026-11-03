import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LOT 3 DU DESIGN · UN CHAMP DE MONTANT OU DE COURS OUVRE LE CLAVIER NUMÉRIQUE
 * (`inputMode="decimal"`), jamais `type="number"` (qui refuse les espaces et la
 * virgule que `lib/montants.ts` écrit), et jamais sur un texte libre.
 *
 * Le relevé lit chaque balise `<input` (accolades et chaînes équilibrées, un `>`
 * de flèche ne la clôt pas) et nomme celles dont le nom ressemble à un montant
 * sans clavier numérique. Deux listes FERMÉES, chacune avec son motif ·
 *  · SIGNÉS : un montant qui peut être négatif (« Débit + / crédit − ») reste au
 *    clavier complet, le pavé décimal d'iOS n'a pas de signe moins ;
 *  · LIBRES : un texte dont le nom contient le mot sans être un nombre.
 */
const SRC = join(__dirname, '..');
const MOT = /montant|cours|taux|prix|solde|valeur|debit|credit|débit|crédit|somme|amount|seuil|plafond|capital|budget|\bfc\b/i;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((f) => {
    const p = join(dossier, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : fichiers(p);
    return p.endsWith('.tsx') && !p.endsWith('.spec.tsx') ? [p] : [];
  });
}

function finDeBalise(s: string, debut: number): number {
  let profondeur = 0;
  let guillemet: string | null = null;
  for (let i = debut; i < s.length; i++) {
    const c = s[i];
    if (guillemet) {
      if (c === guillemet && s[i - 1] !== '\\') guillemet = null;
    } else if (c === '"' || c === "'" || c === '`') guillemet = c;
    else if (c === '{') profondeur++;
    else if (c === '}') profondeur--;
    else if (c === '>' && profondeur === 0) return i;
  }
  return -1;
}

/** `fichier :: extrait de la balise` → motif. */
const SIGNES: Record<string, string> = {
  'components/EtatsIfrsConsolides.tsx :: placeholder="Débit + / crédit −"': 'montant signé',
  'components/FluxTresorerieIfrs.tsx :: placeholder="Hausse + / baisse −"': 'montant signé',
  'components/VariationCapitauxPropresIfrs.tsx :: placeholder="Hausse + / baisse −"': 'montant signé',
  'pages/EtatsIfrsPage.tsx :: placeholder="Débit + / crédit −"': 'montant signé',
  'components/EtatsIfrsConsolides.tsx :: value={retr.pC}': 'effet sur les capitaux propres, signé',
  'pages/CumulConsolidation.tsx :: value={ecartForm.montant}': 'écart, signé',
  'pages/CumulConsolidation.tsx :: name="cpEntree"': 'capitaux propres, signés',
  'pages/CumulConsolidation.tsx :: name="cpHist"': 'capitaux propres, signés',
  'pages/SimulationsBudgetairesPage.tsx :: aria-label="Taux par ligne"': 'variations, négatives permises (« 62 = -1 »)',
};
const LIBRES = [
  'placeholder="Élément géré comme capital"',
  'aria-label="Source du taux"',
  'aria-label="Source',
  'value={prixDeReprise}',
  'aria-label={`Intitulé du mode',
  'aria-label="Intitulé du nouveau mode"',
  // Cellule de note annexe en saisie · texte ou nombre selon la rubrique, mixte.
  'saisie.enregistrer(',
  '// NON contrôlé',
  'aria-label="Libellé',
  'aria-label="N°',
  'maxLength={500}',
  'maxLength={300}',
  'one-time-code',
  'list="libelles-predefinis"',
  'numeroAffiliationCnss',
  'sourceSeuil',
  'defaultValue={x.f?.sourceTauxImpot',
  'placeholder="déc',
  'list="qualites-tiers"',
  'type={champ.cle',
  'type={date',
];

describe('champs de montant · clavier numérique', () => {
  const relevees: { fichier: string; balise: string }[] = [];
  for (const chemin of fichiers(SRC)) {
    const s = readFileSync(chemin, 'utf8');
    for (const m of s.matchAll(/<input\b/g)) {
      const fin = finDeBalise(s, m.index! + 6);
      const balise = s.slice(m.index!, fin + 1);
      if (/inputMode|type="(number|date|checkbox|radio|password|file|email|time|month|hidden|search)"/.test(balise)) continue;
      const sansClasse = balise.replace(/className=(\{`[^`]*`\}|"[^"]*"|\{[^}]*\})/g, '');
      if (MOT.test(sansClasse)) relevees.push({ fichier: chemin.slice(SRC.length + 1), balise: sansClasse.replace(/\s+/g, ' ') });
    }
  }

  it('tout champ de montant ou de cours a inputMode, sauf les listes fermées', () => {
    const sansClavier = relevees.filter(
      (r) =>
        !Object.keys(SIGNES).some((k) => r.fichier === k.split(' :: ')[0] && r.balise.includes(k.split(' :: ')[1])) &&
        !LIBRES.some((l) => r.balise.includes(l)),
    );
    expect(sansClavier.map((r) => `${r.fichier} :: ${r.balise.slice(0, 120)}`)).toEqual([]);
  });

  it('les exceptions signées existent encore (la liste ne ment pas)', () => {
    for (const k of Object.keys(SIGNES)) {
      const [fichier, extrait] = k.split(' :: ');
      expect(relevees.some((r) => r.fichier === fichier && r.balise.includes(extrait)), k).toBe(true);
    }
  });

  it('un montant tapé ne passe jamais par type="number" dans la saisie des écritures', () => {
    const saisie = readFileSync(join(SRC, 'pages/SaisiePage.tsx'), 'utf8');
    expect(saisie).toContain('inputMode="decimal"');
  });
});
