import { heuresPourLeBulletin, LIGNE_HEURES_VIERGE } from './heures-majorees';

// Aucun import de « vitest » · convention du dépôt.

describe('les heures majorées qui partent au bulletin', () => {
  it('une ligne vide n’emporte rien ; une ligne complète part avec ses nombres ; une ligne commencée est dite', () => {
    const r = heuresPourLeBulletin([
      LIGNE_HEURES_VIERGE,
      { majorationId: 'm-1', heures: '10', tauxHoraire: '3 750' },
      { majorationId: 'm-2', heures: '2,5', tauxHoraire: '' },
    ]);
    expect(r.lignes).toEqual([{ majorationId: 'm-1', heures: 10, tauxHoraire: 3750 }]);
    expect(r.incompletes).toBe(1);
  });
});
