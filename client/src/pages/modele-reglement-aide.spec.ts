import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AUDIT FINAL F149 · la fenêtre dit que l'Équilibre se place en dernier, et que le modèle se simule.
 * UNE GARANTIE NÉGATIVE VIEILLIT (ligne sage-l2, fonction 3) · la saisie applique désormais le modèle
 * à la ligne de facture, et la bulle le dit au lieu de « aucune saisie ne l'applique encore ».
 */
const page = readFileSync(join(__dirname, 'TiersPage.tsx'), 'utf8');

describe('F149 · le simulateur d’échéancier dit sa règle', () => {
  it('l’aide du simulateur nomme l’Équilibre en dernier et la simulation', () => {
    // Le cadre porte son aide · on découpe la bulle par son titre, jusqu'à sa source.
    const i = page.indexOf('titre="Échéancier du modèle"');
    expect(i).toBeGreaterThan(0);
    const bulle = page.slice(i, page.indexOf('source=', i));
    expect(bulle).toContain("L'échéance Équilibre reçoit le reste : elle se place en dernier");
    expect(bulle).toContain("en saisie, la ligne de facture d'un tiers qui porte ce modèle reçoit le même échéancier");
  });
});
