import { journauxDeLaRegularisation, type JournalMin } from './avance-mission';

// Aucun import de « vitest » · convention du dépôt.

const J = (id: string, type: string, estActif = true): JournalMin => ({ id, code: id, intitule: id, type, estActif });
const TOUS = [J('BQ', 'TRESORERIE'), J('CA', 'TRESORERIE'), J('OD', 'GENERAL'), J('SIT', 'SITUATION'), J('ACH', 'ACHATS'), J('OLD', 'GENERAL', false)];

describe('journaux proposés à la régularisation (ligne paie-declarations)', () => {
  it('de trésorerie quand de l’argent passe, sinon ni trésorerie ni situation', () => {
    expect(journauxDeLaRegularisation(TOUS, 'COMPLEMENT_PAYE').map((j) => j.id)).toEqual(['BQ', 'CA']);
    expect(journauxDeLaRegularisation(TOUS, 'TROP_VERSE_RENDU').map((j) => j.id)).toEqual(['BQ', 'CA']);
    expect(journauxDeLaRegularisation(TOUS, 'SOLDEE').map((j) => j.id)).toEqual(['OD', 'ACH']);
    expect(journauxDeLaRegularisation(TOUS, 'TROP_VERSE_RETENU').map((j) => j.id)).toEqual(['OD', 'ACH']);
  });

  it('aucun journal tant que le sort du trop-versé n’est pas dit, ni avant lecture', () => {
    expect(journauxDeLaRegularisation(TOUS, null)).toEqual([]);
    expect(journauxDeLaRegularisation(null, 'SOLDEE')).toEqual([]);
  });
});
