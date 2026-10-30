import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { champsReprisHorsFormulaire, nonReprisEnClair, reprisEnClair, type CopieDuTiers } from './duplication-tiers';

// Aucun import de « vitest » · convention du dépôt.

/**
 * LA COPIE D'UN TIERS À L'ÉCRAN (ligne sage-l2, fonction 32) · un champ repris
 * perdu en route (la qualité, les coordonnées) passerait inaperçu : le
 * formulaire n'a pas de case pour lui.
 */
describe('la copie d’un tiers', () => {
  const copie: CopieDuTiers = {
    origine: 'FRS-01',
    corps: { type: 'FOURNISSEUR', code: '', nom: 'Source', qualite: 'Société', ville: 'Goma', modeReglementId: 'vir', validationAutomatiqueEcheances: true },
    nonRepris: [
      { champ: 'Code', motif: 'unique dans le dossier · à saisir' },
      { champ: 'Numéro Impôt', motif: 'identifiant propre à chaque contribuable' },
    ],
  };

  it('les champs sans case du formulaire partent tels quels', () => {
    expect(champsReprisHorsFormulaire(copie)).toEqual({ qualite: 'Société', ville: 'Goma', validationAutomatiqueEcheances: true });
  });

  it('les modèles d’impression repris partent avec la création (fonction 27)', () => {
    expect(champsReprisHorsFormulaire({ ...copie, corps: { ...copie.corps, modeleImpressionRappelId: 'r1' } })).toEqual(
      expect.objectContaining({ modeleImpressionRappelId: 'r1' }),
    );
  });

  // SECOND TOUR DE RELECTURE, mineur 10 · l'échéancier d'office et les
  // modèles d'impression partaient sans être nommés dans « Repris de ».
  it('ce qui est repris se dit en entier, échéancier d’office et modèles d’impression compris', () => {
    expect(reprisEnClair({ ...copie, corps: { ...copie.corps, validationAutomatiqueEcheances: undefined } })).toBe('nom, qualité, coordonnées et règlement');
    expect(reprisEnClair({ ...copie, corps: { ...copie.corps, modeleImpressionExtraitId: 'x' } })).toBe(
      'nom, qualité, coordonnées, règlement, échéancier appliqué d’office et modèles d’impression',
    );
  });

  // Ligne restes-l8-immos · le représentant et la devise partent avec la création, et se disent.
  it('le représentant et la devise habituelle partent avec la création et se disent repris', () => {
    const avec = { ...copie, corps: { ...copie.corps, validationAutomatiqueEcheances: undefined, representantId: 'col1', deviseId: 'usd' } };
    expect(champsReprisHorsFormulaire(avec)).toEqual(expect.objectContaining({ representantId: 'col1', deviseId: 'usd' }));
    expect(reprisEnClair(avec)).toBe('nom, qualité, coordonnées, règlement, représentant et devise habituelle');
  });

  it('ce qui n’est pas repris se dit, avec son motif', () => {
    expect(nonReprisEnClair(copie)).toBe('Code (unique dans le dossier · à saisir) ; Numéro Impôt (identifiant propre à chaque contribuable)');
  });

  it('la forme de la copie est celle du serveur', () => {
    const serveur = readFileSync(join(__dirname, '../../../src/modules/tiers/duplication-tiers.ts'), 'utf8');
    for (const champ of ['qualite?: string;', 'contact?: string;', 'modeReglementId?: string;', 'validationAutomatiqueEcheances?: true;', 'modeleImpressionRappelId?: string;', 'representantId?: string;', 'deviseId?: string;', "code: '';"]) {
      expect(serveur).toContain(champ);
    }
  });
});
