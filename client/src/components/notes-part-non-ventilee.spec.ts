import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { montant } from '../lib/montants';
import {
  TITRE_PART_NON_VENTILEE,
  aidePartNonVentilee,
  phraseEcartCloture,
  phraseNatureNonVentilee,
  phrasePartNonVentilee,
} from '../lib/part-non-ventilee';

/**
 * PAQUET 1, A10 (reproduit sur vraie base le 2026-10-09) · la note 7 d'un
 * dossier SYSCOHADA servait 1 400 000 de clients, 1 000 000 « à un an au
 * plus » et une part non ventilée de 400 000 (`echeanceNonVentilee`, la
 * facture saisie sans échéance) ; l'écran des notes ne la disait nulle part,
 * et les colonnes d'échéance s'y lisaient complètes. Les specs client ne
 * chargent pas React (`specs-sans-react.spec.ts`) · la phrase se teste dans
 * son module, le composant sur sa source.
 */
const rendu = readFileSync(join(__dirname, 'NotesAnnexesRendu.tsx'), 'utf8');

describe('A10 · la part non ventilée par échéance', () => {
  it('la ligne qui laisse une part de côté la dit, montant écrit par lib/montants', () => {
    expect(phrasePartNonVentilee({ echeanceNonVentilee: 400_000 })).toBe(
      `Part non ventilée par échéance : ${montant(400_000)} · rangée dans aucune colonne d'échéance.`,
    );
    expect(TITRE_PART_NON_VENTILEE).toBe('Part non ventilée par échéance');
  });

  it('rien n’est dit d’une ligne entièrement ventilée, ni d’un reste sous le demi-centime', () => {
    expect(phrasePartNonVentilee({})).toBeNull();
    expect(phrasePartNonVentilee({ echeanceNonVentilee: 0 })).toBeNull();
    expect(phrasePartNonVentilee({ echeanceNonVentilee: 0.004 })).toBeNull();
  });

  it('une part NÉGATIVE se dit avec son signe, et la bulle dit qu’elle n’est ni due ni recouvrable', () => {
    expect(phrasePartNonVentilee({ echeanceNonVentilee: -150_000 })).toContain(montant(-150_000));
    const aide = aidePartNonVentilee({ echeanceNonVentilee: -150_000 });
    expect(aide).toMatch(/négative/i);
    expect(aide).toMatch(/Lettrer/);
    // La bulle d'une part positive renvoie à la date d'échéance des lignes.
    expect(aidePartNonVentilee({ echeanceNonVentilee: 400_000 })).toMatch(/date d’échéance/);
  });

  it('la ligne du tableau rend la part servie, sa bulle à côté', () => {
    const debut = rendu.indexOf('function LigneTableauNote(');
    const fin = rendu.indexOf('export function BlocTableauNote(');
    expect(debut).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(debut);
    const corps = rendu.slice(debut, fin);
    expect(corps).toMatch(/const partNonVentilee = phrasePartNonVentilee\(ligne\);/);
    expect(corps).toMatch(
      /\{partNonVentilee && \([\s\S]*\{partNonVentilee\}[\s\S]*<Aide titre=\{TITRE_PART_NON_VENTILEE\} texte=\{aidePartNonVentilee\(ligne\)\}/,
    );
  });
});

describe('le jumeau par nature · mouvements de provision hors des trois natures', () => {
  it('se dit avec ses montants, et se tait quand il est nul', () => {
    expect(phraseNatureNonVentilee({ natureNonVentilee: { augmentation: 250_000, diminution: 0 } })).toBe(
      `Mouvements non ventilés par nature : augmentations ${montant(250_000)} · rangés dans aucune colonne de nature.`,
    );
    expect(phraseNatureNonVentilee({})).toBeNull();
    expect(phraseNatureNonVentilee({ natureNonVentilee: { augmentation: 0, diminution: 0.001 } })).toBeNull();
  });

  it('la ligne du tableau le rend', () => {
    const debut = rendu.indexOf('function LigneTableauNote(');
    const fin = rendu.indexOf('export function BlocTableauNote(');
    const corps = rendu.slice(debut, fin);
    expect(corps).toMatch(/const natureNonVentilee = phraseNatureNonVentilee\(ligne\);/);
    expect(corps).toMatch(/\{natureNonVentilee && \([\s\S]*\{natureNonVentilee\}/);
  });
});

/**
 * SECOND TOUR DU PAQUET 1, LIGNE A, VOISIN A10 · l'écart de clôture et la
 * nature non ventilée, servis par le serveur, ne se lisaient pas à l'écran.
 */
describe('écart de clôture et nature non ventilée, dits sous la ligne', () => {
  it('l’écart de clôture se dit, jamais sous le demi-centime', () => {
    expect(phraseEcartCloture({ ecartCloture: 250_000 })).toBe(
      `Écart de clôture : ${montant(250_000)} · la clôture recalculée ne rend pas le solde de la balance.`,
    );
    expect(phraseEcartCloture({ ecartCloture: 0.004 })).toBeNull();
    expect(phraseEcartCloture({})).toBeNull();
  });

  it('le rendu les affiche sous la ligne', () => {
    const source = readFileSync(join(__dirname, 'NotesAnnexesRendu.tsx'), 'utf8');
    expect(source).toMatch(/const ecartCloture = phraseEcartCloture\(ligne\)/);
    expect(source).toMatch(/\{ecartCloture && \([\s\S]*\{ecartCloture\}/);
  });
});
