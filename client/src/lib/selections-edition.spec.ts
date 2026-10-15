import { criteresRappeles } from './selections-edition';

// Pas d'import de « vitest » · convention du dépôt.

describe('sélections enregistrées · le rappel', () => {
  it('rappelle les critères tels qu’ils ont été gardés', () => {
    expect(criteresRappeles({ nom: 'OD', criteres: { journalId: 'j', dateDebut: '2026-01-01' }, journalIntrouvable: false })).toEqual({
      criteres: { journalId: 'j', dateDebut: '2026-01-01' },
      avertissement: null,
    });
  });

  it('un journal retiré n’est pas rappelé, et c’est dit', () => {
    expect(criteresRappeles({ nom: 'OD', criteres: { journalId: 'j', inclureBrouillard: false }, journalIntrouvable: true })).toEqual({
      criteres: { inclureBrouillard: false },
      avertissement: "Le journal de la sélection « OD » n'existe plus · la sélection est rappelée sur tous les journaux.",
    });
  });
});
