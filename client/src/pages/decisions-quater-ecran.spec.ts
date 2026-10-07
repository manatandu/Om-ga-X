import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * COMPTE 54 ET COUVERTURE (décision par la loi du 2026-10-07, quatrième lot,
 * point 8) · le serveur ne réévalue plus le 54, et ne connaît aucune
 * couverture. En attendant la ligne « couverture de change », la bulle de la
 * réévaluation et l'option de position globale DISENT ce qui se traite à la
 * main (AUDCIF art. 58-3 et 58-4 ; Titre VIII ch. 22 § 2.2.3).
 */
const page = readFileSync(join(__dirname, 'DevisesPage.tsx'), 'utf8');

describe('Devises · le 54 et la couverture dits à l’écran', () => {
  it('la bulle de la réévaluation dit le 54 hors conversion et la position couverte traitée à la main', () => {
    const debut = page.indexOf('titre="Réévaluation à la clôture"');
    expect(debut).toBeGreaterThan(-1);
    const aide = page.slice(debut, page.indexOf('/>', debut));
    expect(aide).toContain('Un instrument de trésorerie (54) n\'est jamais converti au cours de clôture');
    expect(aide).toContain('la provision ne porte que sur le risque non couvert');
    expect(aide).toContain('58-1 à 58-4');
  });

  it('l’option de position globale dit que couverture et part couverte en sortent', () => {
    const debut = page.indexOf('title="AUDCIF art. 58 · la dotation est limitée');
    expect(debut).toBeGreaterThan(-1);
    const label = page.slice(debut, page.indexOf('Position globale de change', debut));
    expect(label).toContain('Les opérations de couverture et la part couverte des éléments couverts sont exclues de cette position');
  });
});

/**
 * NOTE 28 ET NOTE 5F (quatrième lot, point 9) · la phrase du transfert de
 * dépréciation est SERVIE par le serveur, et l'écran l'affiche telle quelle
 * sous le commentaire officiel, jamais recalculée.
 */
describe('Notes annexes · la réponse servie au commentaire officiel', () => {
  const rendu = readFileSync(join(__dirname, '../components/NotesAnnexesRendu.tsx'), 'utf8');
  it('chaque phrase de commentaireServi s’affiche, et ouvre le bloc des commentaires à elle seule', () => {
    expect(rendu).toContain('(note.commentaireServi?.length ?? 0) > 0');
    expect(rendu).toContain('{note.commentaireServi?.map((phrase) => (');
  });
});
