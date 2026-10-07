import { classeObservation, estNonCalcule, libelleEcheance, lignesJalonsAccueil } from './jalons-planning';
import type { JalonCloture } from './types';

// Aucun import de « vitest » (globales) · convention du dépôt.

const jalon = (j: Partial<JalonCloture> & { libelle: string }): JalonCloture => ({
  etape: 1,
  detail: '',
  nature: 'LEGALE',
  source: '',
  debut: null,
  echeance: null,
  enRetard: false,
  sanction: null,
  ...j,
});

const AUJOURDHUI = Date.UTC(2027, 2, 1);

describe('jalons du planning · une échéance non calculée n’est jamais favorable (relecture 1, point 2)', () => {
  it('trois sens d’une échéance nulle · non calculée, aucun délai au texte, levée', () => {
    const nonCalcule = jalon({ libelle: 'Procès-verbal à l’Administration des recettes non fiscales' });
    const sansDelai = jalon({ libelle: 'Bilan avant liquidation', sansDelai: true });
    const leve = jalon({ libelle: 'Dissolution sans liquidation', observation: { libelle: 'Aucune', satisfait: true } });
    expect(estNonCalcule(nonCalcule)).toBe(true);
    expect(estNonCalcule(sansDelai)).toBe(false);
    expect(estNonCalcule(leve)).toBe(false);
    expect(libelleEcheance(nonCalcule)).toBe('Non calculée');
    expect(libelleEcheance(sansDelai)).toBe('Aucun délai');
    expect(libelleEcheance(leve)).toBe('Sans échéance');
    // Une observation NON satisfaite ne lève rien.
    expect(estNonCalcule(jalon({ libelle: 'x', observation: { libelle: 'Manque', satisfait: false } }))).toBe(true);
  });

  it('aucun retard mais une échéance non calculée · jamais vert, et le jalon est nommé', () => {
    const l = lignesJalonsAccueil(
      [
        jalon({ libelle: 'Arrêté des comptes', echeance: '2027-04-30T00:00:00.000Z' }),
        jalon({ libelle: 'Procès-verbal à l’Administration des recettes non fiscales' }),
        jalon({ libelle: 'Affectation des résultats' }),
      ],
      AUJOURDHUI,
    );
    expect(l.retard.bon).toBe(false);
    expect(l.retard.valeur).toBe('Non calculée · Procès-verbal à l’Administration des recettes non fiscales (et 1 autre(s))');
    // La prochaine échéance datée se dit, mais pas en vert tant qu'il manque une date.
    expect(l.prochaine.valeur).toContain('Arrêté des comptes');
    expect(l.prochaine.bon).toBe(false);
  });

  it('seule une échéance non calculée · « prochaine échéance » la dit, jamais « Rien à venir »', () => {
    const l = lignesJalonsAccueil([jalon({ libelle: 'Régime de la liquidation à déclarer' })], AUJOURDHUI);
    expect(l.prochaine).toEqual({ valeur: 'Non calculée · Régime de la liquidation à déclarer', bon: false });
  });

  it('jalons sans délai au texte ou levés · le vert reste possible', () => {
    const l = lignesJalonsAccueil(
      [
        jalon({ libelle: 'Bilan avant liquidation', sansDelai: true }),
        jalon({ libelle: 'Dissolution sans liquidation', observation: { libelle: 'Aucune', satisfait: true } }),
      ],
      AUJOURDHUI,
    );
    expect(l.retard).toEqual({ valeur: 'Aucun jalon en retard', bon: true });
    expect(l.prochaine).toEqual({ valeur: 'Rien à venir', bon: true });
  });

  it('un retard prime et se dit avec son nombre', () => {
    const l = lignesJalonsAccueil(
      [jalon({ libelle: 'Dépôt de la liasse', echeance: '2027-02-15T00:00:00.000Z', enRetard: true }), jalon({ libelle: 'PV' })],
      AUJOURDHUI,
    );
    expect(l.retard).toEqual({ valeur: '1 en retard · Dépôt de la liasse', bon: false });
  });

  it('un jalon EN ATTENTE (dépôt impossible pendant l’exercice, commissaire non enregistré) n’est pas une échéance non calculée', () => {
    const attente = jalon({ libelle: 'Affectation des résultats', enAttente: 'En attente du dépôt' });
    expect(estNonCalcule(attente)).toBe(false);
    expect(libelleEcheance(attente)).toBe('En attente du dépôt');
    expect(lignesJalonsAccueil([attente], AUJOURDHUI).retard).toEqual({ valeur: 'Aucun jalon en retard', bon: true });
  });

  it('un fait déclaré hors délai s’affiche en ambre, jamais en vert muet', () => {
    expect(classeObservation({ satisfait: true })).toBe('text-positive');
    expect(classeObservation({ satisfait: true, horsDelai: true })).toBe('text-warning');
    expect(classeObservation({ satisfait: false })).toBe('text-danger');
  });
});
