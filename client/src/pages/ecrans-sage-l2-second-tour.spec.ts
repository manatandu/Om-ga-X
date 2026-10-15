import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » · convention du dépôt, `globals` fournit describe,
// it et expect.

/**
 * SECOND TOUR DE RELECTURE DE LA LIGNE SAGE-L2 · mineurs 12, 15 et 16. On
 * gèle une PRÉSENCE dans la source, ancrée sur une structure.
 */
const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

describe('second tour · lieux, seuil, modèles d’impression', () => {
  it('mineur 12 · les lieux · focus au formulaire, geste unique pendant l’envoi, relecture à part', () => {
    const volet = lire('components/VoletLieuxLivraison.tsx');
    expect(volet).toMatch(/if \(edite !== null\) premierChamp\.current\?\.focus/);
    expect(volet).toMatch(/if \(envoi\) return false;/);
    expect(volet).toMatch(/gestePuisRelecture\(geste, /);
    expect(volet).toMatch(/<button type="submit" disabled=\{envoi\}/);
  });

  it('mineur 15 · le seuil se préremplit au centime, absent comme nul', () => {
    expect(lire('pages/ParametresDossierPage.tsx')).toMatch(/value=\{seuilSaisi \?\? montantPourChamp\(params\.seuilEcartReglement\)\}/);
  });

  it('mineur 16 · un brouillon modifié ne s’écrase que sur demande, et le formulaire reçoit le focus', () => {
    const page = lire('pages/ModelesImpressionPage.tsx');
    expect(page).toMatch(/if \(modifie && !window\.confirm\(/);
    expect(page).toMatch(/onClick=\{\(\) => ouvrir\(\{ id: m\.id, /);
    expect(page).toMatch(/<form ref=\{formulaire\} onSubmit=\{enregistrer\}/);
  });
});
