import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * UN REFUS DE RECHARGEMENT RETIRE L'ANCIEN ÉTAT (second tour du paquet 1,
 * ligne B, mineur 5). La balance âgée, l'échéancier et les états des deux
 * SMT gardaient le tableau de la date, du périmètre ou de l'exercice d'avant à
 * côté du message de refus · il se lisait comme celui qu'on venait de
 * choisir. On gèle ce que fait le gestionnaire d'échec · il vide l'état qu'il
 * visait, puis dit le refus.
 */
const lire = (fichier: string) => readFileSync(join(__dirname, fichier), 'utf8');

/** Le corps du gestionnaire d'échec qui suit la lecture de `route`. */
function gestionnaireDEchec(source: string, route: string): string {
  const i = source.indexOf(route);
  expect(i, `lecture ${route} introuvable`).toBeGreaterThan(-1);
  const suite = source.slice(i);
  const fin = suite.indexOf('return () =>');
  return suite.slice(0, fin > -1 ? fin : undefined);
}

describe('un refus de rechargement retire l’ancien état (ligne B, mineur 5)', () => {
  it('balance âgée', () => {
    expect(gestionnaireDEchec(lire('BalanceAgeePage.tsx'), '/ecritures/balance-agee?')).toMatch(/setDonnees\(null\)[\s\S]*setErreur/);
  });

  it('échéancier', () => {
    expect(gestionnaireDEchec(lire('EcheancierPage.tsx'), '/ecritures/echeancier?')).toMatch(/setEtat\(null\)[\s\S]*setErreur/);
  });

  it.each(['EtatsSmtPage.tsx', 'EtatsSmtSyscohadaPage.tsx'])('%s · chaque état vidé par son propre refus', (fichier) => {
    const source = lire(fichier);
    for (const setter of ['setBilan', 'setCr', 'setNotes', 'setEligibilite']) {
      expect(source).toContain(`echec(() => ${setter}(null))`);
    }
    expect(source).toMatch(/const echec = \(vider: \(\) => void\) => \(e: Error\) => \{[\s\S]*?vider\(\);[\s\S]*?setErreur\(e\.message\)/);
  });
});
