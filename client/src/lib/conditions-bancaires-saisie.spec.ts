// Aucun import de « vitest » · convention du dépôt (le serveur rejoue aussi ces tests sous Jest).
import { corpsAutorisation, corpsConditions, lireNombre } from './conditions-bancaires-saisie';

/**
 * Le test qui aurait attrapé le constat M1 du premier tour (fonction 46) ·
 * « 2,5 % » partait en NaN, donc en `null`, et la convention s'enregistrait
 * sans le taux tapé. Vide est absent, illisible est refusé avec son nom.
 */
describe('Saisie des conditions bancaires · illisible n’est jamais absent', () => {
  it('lit les espaces, la virgule et le pour cent, et refuse le reste', () => {
    expect(lireNombre('2,5 %')).toEqual({ valeur: 2.5 });
    expect(lireNombre('1 000 000')).toEqual({ valeur: 1_000_000 });
    expect(lireNombre('  ')).toEqual({ vide: true });
    expect(lireNombre(undefined)).toEqual({ vide: true });
    expect(lireNombre('1.000,5')).toEqual({ illisible: true });
    expect(lireNombre('douze')).toEqual({ illisible: true });
    expect(lireNombre('12%%')).toEqual({ illisible: true });
  });

  it('un taux illisible refuse l’envoi en le nommant, jamais une convention sans lui', () => {
    expect(corpsConditions({ tauxInteretsCrediteurs: 'deux' })).toEqual({ refus: 'Intérêts créditeurs · illisible.' });
    expect(corpsConditions({ fraisTenueCompte: '15 000 FC' })).toEqual({ refus: 'Frais de tenue de compte · illisible.' });
    const ok = corpsConditions({ tauxInteretsCrediteurs: '2,5 %', dateEffet: '2026-01-01' });
    expect('corps' in ok && ok.corps.tauxInteretsCrediteurs).toBe(2.5);
  });

  it('un palier illisible ou incomplet ne disparaît pas · il se nomme', () => {
    expect(corpsConditions({ plafond1: '1 000 000 FC', taux1: '14 %' })).toEqual({ refus: 'Palier 1, plafond · illisible.' });
    expect(corpsConditions({ plafond2: '500 000' })).toEqual({ refus: 'Palier 2 · le taux est exigé.' });
    expect(corpsConditions({ taux3: '12' })).toEqual({ refus: 'Palier 3 · le plafond est exigé.' });
    const ok = corpsConditions({ plafond1: '1 000 000', taux1: '12', typePalier: 'SEUIL' });
    expect('corps' in ok && ok.corps.paliers).toEqual([{ plafond: 1_000_000, taux: 12 }]);
    expect('corps' in ok && ok.corps.typePalier).toBe('SEUIL');
  });

  it('le montant d’une autorisation est exigé et lisible', () => {
    expect(corpsAutorisation({})).toEqual({ refus: 'Le montant autorisé est exigé.' });
    expect(corpsAutorisation({ montant: '1.000.000' })).toEqual({ refus: 'Montant autorisé · illisible.' });
    const ok = corpsAutorisation({ montant: '500 000', irrevocable: 'oui' });
    expect('corps' in ok && ok.corps).toMatchObject({ montant: 500_000, irrevocable: true, nature: 'DECOUVERT' });
  });
});
