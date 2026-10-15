import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

/**
 * LES GESTES DESTRUCTEURS DE LA LIGNE SAGE-L7 (relecture des écrans, second
 * tour, 7, 8 et 10) · retirer le fichier d'une impression, supprimer une
 * sélection ou un modèle d'édition partagés par le dossier se CONFIRMENT en
 * ligne, et le bouton qui envoie se grise pendant l'envoi. Lu sur la source ·
 * l'appel destructeur ne vit que dans la branche de confirmation, et son
 * bouton porte `disabled`.
 */

const CLIENT = join(__dirname, '..');
const lire = (p: string) => readFileSync(join(CLIENT, p), 'utf8');

/** La branche « confirmation » d'un ternaire JSX · de `{etat} ? (` à son `) : (`. */
function brancheConfirmation(source: string, condition: string): string {
  const debut = source.indexOf(`(${condition} ? (`);
  expect([condition, debut >= 0]).toEqual([condition, true]);
  return source.slice(debut, source.indexOf(') : (', debut));
}

/** Le bouton qui porte un appel · de son `<button` à son `</button>`. */
function boutonDe(source: string, appel: string): string {
  const i = source.indexOf(appel);
  return source.slice(source.lastIndexOf('<button', i), source.indexOf('</button>', i));
}

const CAS = [
  { fichier: 'components/ChoixModeleEdition.tsx', condition: 'confirmerSuppression', appel: 'onClick={() => void supprimer()}' },
  { fichier: 'components/SelectionsEnregistrees.tsx', condition: 'confirmerSuppression', appel: 'onClick={() => void supprimer()}' },
  { fichier: 'pages/ImpressionsDiffereesPage.tsx', condition: 'aRetirer === i.id', appel: 'onClick={() => void retirerFichier(i)}' },
];

describe('gestes destructeurs de sage-l7 · confirmés en ligne, grisés pendant l’envoi (7)', () => {
  it.each(CAS)('$fichier · l’appel ne vit que dans la confirmation, son bouton se grise', ({ fichier, condition, appel }) => {
    const source = lire(fichier);
    expect(source.split(appel).length - 1).toBe(1);
    expect(brancheConfirmation(source, condition)).toContain(appel);
    expect(boutonDe(source, appel)).toMatch(/disabled=\{(envoi|retraitEnCours !== null)\}/);
  });
});

describe('sélections enregistrées · un envoi à la fois, une lecture échouée dite (8, 10)', () => {
  const source = lire('components/SelectionsEnregistrees.tsx');

  it('Entrée pressée pendant l’envoi ne double pas l’enregistrement (8)', () => {
    const debut = source.indexOf('  async function enregistrer() {');
    const corps = source.slice(debut, source.indexOf('\n  }\n', debut));
    expect(corps).toMatch(/^ {2}async function enregistrer\(\) \{\s*(\/\/[^\n]*\n\s*)*if \(envoi\) return;/);
  });

  it('une lecture échouée n’est pas « Lecture… » sans fin (10)', () => {
    expect(source).toContain("liste === null ? (erreurLecture ? 'Non lues' : 'Lecture…')");
  });
});
