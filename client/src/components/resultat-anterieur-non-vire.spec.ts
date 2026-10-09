import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { montant } from '../lib/montants';
import { TITRE_AVIS_COLONNE_N1, phraseAvisColonneN1, phraseAvisExercice } from '../lib/resultat-anterieur-non-vire';

/**
 * PAQUET 1, A1 (reproduit sur vraie base le 2026-10-08) · l'exercice qui suit
 * un exercice clôturé sans le virement du résultat non affecté reprend son
 * poste du résultat tel quel en colonne N-1. Le serveur le sert
 * (`resultatAnterieurNonVireN1`) · l'écran le DIT, colonne nommée, montant
 * écrit par `lib/montants.ts`, motif dans la bulle. Avant, rien ne s'affichait.
 * Les specs client ne chargent pas React (`specs-sans-react.spec.ts`) · le
 * texte affiché se lit sur ses phrases, et le composant sur sa source.
 */
const composant = readFileSync(join(__dirname, 'ResultatAnterieurNonVire.tsx'), 'utf8');

describe('avis du résultat antérieur non viré · la colonne N-1', () => {
  it('la phrase de la colonne N-1 nomme la colonne, le poste et le montant', () => {
    const phrase = phraseAvisColonneN1({ montant: 1_000_000, poste: 'CJ', motif: '' });
    expect(phrase).toBe(
      `En colonne N-1, le poste CJ inclut ${montant(1_000_000)} de résultat antérieur, resté au compte 13 à la clôture de l'exercice précédent.`,
    );
    expect(TITRE_AVIS_COLONNE_N1).toBe('Colonne N-1 · résultat antérieur non viré');
  });

  it('celle de l’exercice est inchangée, et ne nomme aucune colonne', () => {
    expect(phraseAvisExercice({ montant: -46_072_000, poste: 'CH', motif: '' })).toBe(
      `Le poste CH inclut ${montant(-46_072_000)} de résultat de l'exercice précédent, resté au compte 13 à la clôture.`,
    );
  });

  it('le composant rend chaque avis servi · titre, phrase, et le motif du serveur dans la bulle', () => {
    expect(composant).toContain('if (!avis && !avisN1) return null;');
    expect(composant).toMatch(/\{avisN1 && \([\s\S]*\{TITRE_AVIS_COLONNE_N1\}[\s\S]*texte=\{avisN1\.motif\}[\s\S]*\{phraseAvisColonneN1\(avisN1\)\}/);
    expect(composant).toMatch(/\{avis && \([\s\S]*texte=\{avis\.motif\}[\s\S]*\{phraseAvisExercice\(avis\)\}/);
  });

  it('les cinq écrans de bilan passent l’avis de la colonne N-1', () => {
    const pages = ['EtatsFinanciersPage.tsx', 'EtatsFinanciersSyscohadaPage.tsx', 'EtatsSmtPage.tsx', 'EtatsSmtSyscohadaPage.tsx'];
    const appels = pages.flatMap((p) =>
      readFileSync(join(__dirname, '..', 'pages', p), 'utf8').match(/<AvisResultatAnterieurNonVire [^>]*\/>/g) ?? [],
    );
    // Associations et projets dans EtatsFinanciersPage, puis SYSCOHADA normal et les deux SMT.
    expect(appels).toHaveLength(5);
    for (const a of appels) expect(a).toMatch(/avisN1=\{\w+\.resultatAnterieurNonVireN1\}/);
  });
});
