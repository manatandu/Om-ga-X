import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » · convention du dépôt.

/**
 * LA LISTE DES COMPTES DE LA SAISIE NE SE FERME PAS SOUS LE FOCUS (intégration
 * de la ligne sage-l2) · la sortie du champ « n° ou F4 » ferme la liste après
 * 150 ms ; une ligne validée vite rendait le focus au champ AVANT que ce délai
 * ne tombe, la liste se fermait sous lui, et Entrée ne choisissait plus le
 * compte tapé en entier. Le test lit l'élément par sa structure · le champ qui
 * porte `ref={compteRef}`, découpé jusqu'à la fin de sa balise.
 */
describe('saisie · la fermeture différée de la liste des comptes', () => {
  const page = readFileSync(join(__dirname, 'SaisiePage.tsx'), 'utf8');
  const debut = page.indexOf('ref={compteRef}');
  const champ = page.slice(debut, page.indexOf('/>', debut));

  it('le champ du compte est trouvé', () => {
    expect(debut).toBeGreaterThan(0);
    expect(champ).toContain('placeholder="n° ou F4"');
  });

  it('la sortie du champ garde sa minuterie, le retour du focus la défait', () => {
    const onBlur = champ.slice(champ.indexOf('onBlur='), champ.indexOf('placeholder='));
    expect(onBlur).toContain('fermetureListeComptes.current = window.setTimeout(');
    const onFocus = champ.slice(champ.indexOf('onFocus='), champ.indexOf('onKeyDown='));
    expect(onFocus).toContain('window.clearTimeout(fermetureListeComptes.current)');
    expect(onFocus).toContain('setPickerOuvert(true)');
  });
});
