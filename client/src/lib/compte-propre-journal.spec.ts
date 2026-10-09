// Aucun import de « vitest » (globales) · convention du dépôt.
import { corpsCompteDuJournal, type CompteDuJournalPropose } from './compte-propre-journal';

const PROPOSE: CompteDuJournalPropose = {
  numero: '52110003',
  racine: '5211',
  longueur: 8,
  compteDuPlan: { numero: '52110000', intitule: 'Banques locales' },
  motif: null,
};

describe('le compte d’un journal de trésorerie à la création', () => {
  it('ouvre le compte sous le compte du plan, sans envoyer la proposition gardée', () => {
    expect(
      corpsCompteDuJournal('OUVRIR', { sousId: 'b5211', numeroSaisi: '52110003', propose: PROPOSE, compteTresorerieId: '' }),
    ).toEqual({ ouvrirCompteSousId: 'b5211' });
  });

  it('envoie le numéro que le cabinet a remplacé', () => {
    expect(
      corpsCompteDuJournal('OUVRIR', { sousId: 'b5211', numeroSaisi: ' 52110025 ', propose: PROPOSE, compteTresorerieId: '' }),
    ).toEqual({ ouvrirCompteSousId: 'b5211', numeroCompte: '52110025' });
  });

  it('reprend le compte existant choisi, sans rien ouvrir', () => {
    expect(
      corpsCompteDuJournal('EXISTANT', { sousId: 'b5211', numeroSaisi: '52110025', propose: PROPOSE, compteTresorerieId: 'bq' }),
    ).toEqual({ compteTresorerieId: 'bq' });
  });
});
