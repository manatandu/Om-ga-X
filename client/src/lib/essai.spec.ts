import { describe, expect, it } from 'vitest';
import { corpsEssai, essaiOuvert, TYPES_ENTITE_ESSAI } from './essai';

describe('inscription avec essai · le corps envoyé', () => {
  it("une association prend le jeu des associations, un projet celui des projets", () => {
    expect(corpsEssai('ASSOCIATION', ' Xx ', ' a@b.cd ')).toEqual({
      nomEntite: 'Xx',
      email: 'a@b.cd',
      referentiel: 'SYCEBNL',
      jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
    });
    expect(corpsEssai('PROJET', 'P', 'a@b.cd').jeuEtatsFinanciersSycebnl).toBe('PROJETS_DEVELOPPEMENT');
  });
  it("une entreprise est au SYSCOHADA et n'envoie aucun jeu SYCEBNL", () => {
    const c = corpsEssai('ENTREPRISE', 'Société', 'a@b.cd');
    expect(c.referentiel).toBe('SYSCOHADA');
    expect('jeuEtatsFinanciersSycebnl' in c).toBe(false);
  });
  it('les trois types sont proposés', () => {
    expect(TYPES_ENTITE_ESSAI.map((t) => t.valeur)).toEqual(['ASSOCIATION', 'PROJET', 'ENTREPRISE']);
  });
});

describe("inscription avec essai · l'état de la porte", () => {
  it('seule une réponse lue ouverte offre le lien', () => {
    expect(essaiOuvert({ ouverte: true, joursEssai: 30 })).toBe(true);
    expect(essaiOuvert({ ouverte: false, joursEssai: 30 })).toBe(false);
    expect(essaiOuvert({ ouverte: true })).toBe(false);
    expect(essaiOuvert(null)).toBe(false);
    expect(essaiOuvert(undefined)).toBe(false);
  });
});
