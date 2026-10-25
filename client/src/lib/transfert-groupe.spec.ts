import { journalPropose, liaisonProposee, receveursPossibles, type DossierDuContexte } from './transfert-groupe';

const dossier = (p: Partial<DossierDuContexte>): DossierDuContexte => ({
  id: 'x',
  nom: 'X',
  siege: false,
  exercicesOuverts: [],
  journaux: [],
  comptesLiaison: [],
  ...p,
});

describe('transfert d’un bien dans le groupe · les choix proposés à l’écran', () => {
  const siege = dossier({ id: 'S', siege: true });
  const c1 = dossier({ id: 'C1' });
  const c2 = dossier({ id: 'C2' });

  it('le siège cède à chaque cellule, une cellule ne cède qu’au siège', () => {
    expect(receveursPossibles([siege, c1, c2], 'S').map((d) => d.id)).toEqual(['C1', 'C2']);
    expect(receveursPossibles([siege, c1, c2], 'C1').map((d) => d.id)).toEqual(['S']);
    expect(receveursPossibles([siege, c1, c2], 'inconnu')).toEqual([]);
  });

  it('un journal n’est proposé que s’il est seul ou nommé OD · jamais deviné', () => {
    expect(journalPropose(dossier({ journaux: [{ id: 'j1', code: 'OD2', intitule: '' }] }))).toBe('j1');
    expect(journalPropose(dossier({ journaux: [{ id: 'j1', code: 'OD2', intitule: '' }, { id: 'j2', code: 'OD', intitule: '' }] }))).toBe('j2');
    expect(journalPropose(dossier({ journaux: [{ id: 'j1', code: 'A', intitule: '' }, { id: 'j2', code: 'B', intitule: '' }] }))).toBe('');
  });

  it('un compte de liaison n’est proposé que s’il est seul', () => {
    expect(liaisonProposee(dossier({ comptesLiaison: [{ id: 'k', numero: '18500000', intitule: '' }] }))).toBe('k');
    expect(
      liaisonProposee(dossier({ comptesLiaison: [{ id: 'a', numero: '18400000', intitule: '' }, { id: 'b', numero: '18500000', intitule: '' }] })),
    ).toBe('');
  });
});
