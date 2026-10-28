import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleApercu, journalPropose, liaisonProposee, receveurPreselectionne, receveursPossibles, type DossierDuContexte } from './transfert-groupe';

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

  it('une cellule qui cède a un seul receveur, le siège · présélectionné à chaque changement de cédant', () => {
    expect(receveurPreselectionne([siege, c1, c2], 'C1')).toBe('S');
    expect(receveurPreselectionne([siege, c1, c2], 'C2')).toBe('S');
    expect(receveurPreselectionne([siege, c1, c2], 'S')).toBe('');
    expect(receveurPreselectionne([siege, c1], 'S')).toBe('C1');
  });

  it('la clé d’un aperçu change avec le moindre champ · une réponse périmée se reconnaît', () => {
    const a = { date: '2027-06-15', immobilisationId: 'b1' };
    expect(cleApercu(a)).toBe(cleApercu({ immobilisationId: 'b1', date: '2027-06-15' }));
    expect(cleApercu(a)).not.toBe(cleApercu({ ...a, date: '2027-06-16' }));
  });
});

describe('transfert d’un bien dans le groupe · l’écran (gelé)', () => {
  const ecran = readFileSync(join(__dirname, '..', 'components', 'groupe', 'TransfertsBiensGroupe.tsx'), 'utf8');

  it('l’aperçu jette une réponse périmée, désactive le bouton pendant sa lecture et s’annonce', () => {
    expect(ecran).toContain('if (cleEnvoyee !== cleCourante.current) return;');
    expect(ecran).toContain('envoi={envoi || enApercu}');
    expect(ecran).toContain('role="status"');
  });

  it('la date de la liste se lit sur la chaîne AAAA-MM-JJ, jamais par new Date (fuseau)', () => {
    expect(ecran).toContain('jourFr(t.date)');
    expect(ecran).not.toContain('new Date(t.date)');
  });

  it('le changement de cédant présélectionne le receveur unique', () => {
    expect(ecran).toContain('setReceveurId(receveurPreselectionne(contexte.dossiers, e.target.value))');
  });
});

