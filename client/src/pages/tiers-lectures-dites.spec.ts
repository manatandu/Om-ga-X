import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » · convention du dépôt, `globals` fournit describe,
// it et expect.

/**
 * SECOND TOUR DE RELECTURE DE LA LIGNE SAGE-L2 · la fiche du tiers dit ses
 * échecs de lecture et rétablit ce qu'un refus n'a pas changé. On gèle une
 * PRÉSENCE dans la source, ancrée sur une structure.
 */
const page = readFileSync(join(__dirname, 'TiersPage.tsx'), 'utf8');
const volet = readFileSync(join(__dirname, '..', 'components', 'VoletModelesImpression.tsx'), 'utf8');

describe('la fiche du tiers dit ses échecs de lecture', () => {
  it('M3 · les modèles de règlement partent de null, avec leur erreur, et le sélecteur attend la liste lue', () => {
    expect(page).toMatch(/useState<ModeleReglement\[\] \| null>\(null\)/);
    expect(page).toMatch(/\{estAdmin && modeles \? \(\s*<select\s+aria-label="Modèle de règlement du tiers"/);
    expect(page).toMatch(/Modèles de règlement illisibles · \{erreurModeles\}/);
  });

  it('mineur 8 · le mode d’une échéance de modèle dit l’échec de lecture des modes', () => {
    const debut = page.indexOf('aria-label="Mode de l\'échéance"');
    const fin = page.indexOf('</label>', debut);
    expect(page.slice(debut, fin)).toMatch(/Modes de règlement illisibles · \{erreurModes\}/);
  });

  it('mineur 9 · une qualité refusée revient à celle de la fiche', () => {
    expect(page).toMatch(/enregistrerChamp\(tiersSelectionne, \{ qualite: valeur \}\)\.then\(\(fait\) => \{\s*if \(!fait\) champ\.value = avant;/);
  });

  it('mineur 11 · le formulaire d’échéance tient à l’étroit', () => {
    expect(page).toMatch(/onSubmit=\{onAjouterEcheance\} className="grid grid-cols-2 sm:grid-cols-7/);
  });

  it('mineur 13 · les modèles d’impression sont lus une fois par la fenêtre ; non lus, « modèle non lu »', () => {
    expect(page).toMatch(/modeles=\{modelesImpression\}\s*erreur=\{erreurModelesImpression\}/);
    expect(volet).toMatch(/modeles: ModeleImpression\[\] \| null;/);
    expect(volet).toMatch(/'modèle non lu'/);
  });
});
