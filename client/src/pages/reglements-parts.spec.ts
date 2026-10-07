// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * RÈGLEMENT DES TIERS · LES PARTS (relecture du 2026-10-07, mineurs écran et
 * M6). Gelé sur la STRUCTURE de la page · le corps de chaque fonction, jamais
 * une distance dans la source (CLAUDE.md § 10).
 */
const source = readFileSync(join(__dirname, 'ReglementsPage.tsx'), 'utf8');
const corps = (debut: string, fin = '\n  };\n') => {
  const i = source.indexOf(debut);
  expect(i).toBeGreaterThan(0);
  return source.slice(i, source.indexOf(fin, i));
};

describe('les parts d’un règlement fournisseur à l’écran', () => {
  it('une seule règle pour l’affichage, le total et l’envoi · partsServies et reglementEnFrancs', () => {
    const regle = corps('const reglementEnFrancs = (g: GroupeTiers) => {');
    expect(regle).toContain('partsServies({ sens, cochees: coches })');
    expect(regle).toContain('montantRegle(montants[g.compteId])');
    expect(corps('const total = aRegler.reduce(', '}, 0);')).toContain('reglementEnFrancs(g)');
    expect(corps('const enregistrer = async () => {')).toContain('const r = reglementEnFrancs(g);');
    // L'affichage du champ « Part » suit la même règle.
    expect(source).toContain('{peutEcrire && servies.servies && cochees.has(l.id)');
  });

  it('la part se confronte à son dû, la facture nommée, et le champ se dit en erreur', () => {
    expect(source).toContain('const motif = motifDePart(l, parts[l.id]);');
    expect(source).toContain('aria-label={`Part réglée de ${nomDeFacture(l)}`}');
    expect(source).toContain('aria-invalid={motif ? true : undefined}');
  });

  it('une part ne disparaît pas sans un mot quand une case se décoche', () => {
    expect(corps('const basculer = (g: GroupeTiers, id: string) => {')).toContain('reprendreLesParts({');
    expect(source).toContain('{constatsParts[g.compteId] && <div className="text-text-dim">{constatsParts[g.compteId]}</div>}');
  });

  it('le motif d’un tiers se dit sous lui ; le rappel d’un lot remet les parts à zéro', () => {
    expect(corps('const enregistrer = async () => {')).toContain('setMotifsTiers({ [g.compteId]: motif });');
    expect(corps('const rappeler = () => {')).toContain('setParts({});');
  });

  it('une réponse périmée est jetée par jeton', () => {
    const charger = corps('const charger = async () => {');
    expect(charger).toContain('const jeton = ++jetonLecture.current;');
    expect(charger).toContain('if (jeton !== jetonLecture.current) return;');
  });

  it('M6 · sans ordre de virement, la pièce qui notifie l’imputation est exigée et envoyée', () => {
    const enregistrer = corps('const enregistrer = async () => {');
    expect(enregistrer).toContain('motifPieceImputation({ avecParts: true, ordreVirement, pieceImputation: piecesImputation[g.compteId] })');
    expect(enregistrer).toContain('pieceImputation: piecesImputation[g.compteId].trim()');
  });

  it('l’aide cite le Code civil, Livre III, art. 151 à 154', () => {
    expect(source).toContain('Code civil, Livre III, art. 151 à 154');
  });
});
