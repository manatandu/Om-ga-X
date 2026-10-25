// Aucun import de « vitest » · convention du dépôt (les specs du client tournent aussi sous Jest).
import { lignesPourLaSimulation, lireHeures, natureAffichee } from './feuilles-temps';
import { heuresPourLeBulletin } from './heures-majorees';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · la reprise des heures des feuilles de
 * temps à la simulation ne remplace jamais ce que le cabinet a tapé, ne
 * devine jamais le taux horaire, et une heure tapée à la française se lit.
 */
describe('la reprise des heures à la simulation', () => {
  const proposees = [
    { nature: 'HEURES_SUPPLEMENTAIRES' as const, libelle: 'Heures supplémentaires', heures: 5.5, minimum: false, samedi: false, majorationId: 'm-hs', majorations: 1 },
    { nature: 'TRAVAIL_DE_NUIT' as const, libelle: 'Heures de nuit', heures: 2, minimum: false, samedi: false, majorationId: null, majorations: 2 },
  ];

  it('ajoute aux lignes tapées, jette les lignes vides, laisse le taux horaire à taper', () => {
    const deja = [
      { majorationId: 'm-x', heures: '3', tauxHoraire: '1500' },
      { majorationId: '', heures: '', tauxHoraire: '' },
    ];
    expect(lignesPourLaSimulation(proposees, deja)).toEqual([
      { majorationId: 'm-x', heures: '3', tauxHoraire: '1500' },
      { majorationId: 'm-hs', heures: '5,5', tauxHoraire: '' },
      { majorationId: '', heures: '2', tauxHoraire: '' },
    ]);
  });

  it('une ligne reprise sans taux horaire ne part pas au serveur · elle est dite incomplète', () => {
    const r = heuresPourLeBulletin(lignesPourLaSimulation(proposees, []));
    expect(r.lignes).toEqual([]);
    expect(r.incompletes).toBe(2);
  });
});

describe('la saisie d’une heure', () => {
  it('lit la virgule, le point et les espaces ; une case vide vaut zéro ; un texte illisible est refusé', () => {
    expect(lireHeures('7,5')).toBe(7.5);
    expect(lireHeures(' 8.25 ')).toBe(8.25);
    expect(lireHeures('')).toBe(0);
    expect(lireHeures('huit')).toBeNull();
    expect(lireHeures('-2')).toBeNull();
  });

  it('nomme le dimanche, le férié et le samedi, rien pour un jour ouvrable', () => {
    expect(natureAffichee({ nature: 'DIMANCHE', samedi: false })).toBe('Dimanche');
    expect(natureAffichee({ nature: 'FERIE', samedi: false })).toBe('Férié');
    expect(natureAffichee({ nature: 'OUVRABLE', samedi: true })).toBe('Samedi');
    expect(natureAffichee({ nature: 'OUVRABLE', samedi: false })).toBe('');
  });
});
