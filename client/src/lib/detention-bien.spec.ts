import { dateLue, detentionsLisiblesPar } from './detention-bien';
import { ongletPermis } from './onglets-immobilisations';

describe('détenteur d’un bien · côté écran (ligne Microfina M4)', () => {
  it('le volet suit le serveur · ni l’aide-comptable ni le gestionnaire de paie', () => {
    expect(detentionsLisiblesPar('ADMIN_CABINET')).toBe(true);
    expect(detentionsLisiblesPar('COMPTABLE')).toBe(true);
    expect(detentionsLisiblesPar('LECTURE_SEULE')).toBe(true);
    expect(detentionsLisiblesPar('AIDE_COMPTABLE')).toBe(false);
    expect(detentionsLisiblesPar('GESTIONNAIRE_PAIE')).toBe(false);
    expect(detentionsLisiblesPar(undefined)).toBe(false);
  });

  it('un onglet Détenteurs mémorisé retombe sur Biens pour qui ne le lit pas', () => {
    expect(ongletPermis('detenteurs', true, false)).toBe('biens');
    expect(ongletPermis('detenteurs', false, true)).toBe('detenteurs');
  });

  it('une date absente se dit, jamais par un vide', () => {
    expect(dateLue('2026-03-01')).toBe('01/03/2026');
    expect(dateLue(null)).toBe('·');
  });
});
