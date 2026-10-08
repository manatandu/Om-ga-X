import { lireNombre, partsAEnvoyer, resteEnFrancs } from './declaration-devise-a-nouveau';
import { modeleImport } from './modele-import';

/**
 * LIGNE AU3 · ce que l'écran prépare avant de déclarer la devise d'un
 * à-nouveau, et le modèle de fichier d'import qui dit les colonnes de la
 * devise. Le serveur rejoue toutes les règles ; ici, seulement la lecture.
 */
describe('Déclaration de la devise d’un à-nouveau · l’écran', () => {
  it('lit les nombres au format francophone', () => {
    expect(lireNombre('3 200 000')).toBe(3_200_000);
    expect(lireNombre('2133,333333')).toBe(2133.333333);
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('abc')).toBeNull();
  });

  it('le cas AU3 · 1 500 USD pour 3 200 000, sans cours (déduit au serveur)', () => {
    const r = partsAEnvoyer([{ deviseId: 'd-usd', montantDevise: '1 500', cours: '', montant: '3 200 000' }], 3_200_000);
    expect(r).toEqual({ parts: [{ deviseId: 'd-usd', montantDevise: 1500, montant: 3_200_000 }] });
  });

  it('une part vide est ignorée · aucune part déclare la ligne en francs', () => {
    expect(partsAEnvoyer([{ deviseId: '', montantDevise: '', cours: '', montant: '' }], 100)).toEqual({ parts: [] });
  });

  it('arrête tôt une devise manquante, un montant illisible, des parts au-delà de la ligne', () => {
    expect(partsAEnvoyer([{ deviseId: '', montantDevise: '10', cours: '', montant: '10' }], 100)).toEqual({ motif: 'Part 1 · choisissez la devise.' });
    expect(partsAEnvoyer([{ deviseId: 'd', montantDevise: 'x', cours: '', montant: '10' }], 100)).toHaveProperty('motif');
    expect(partsAEnvoyer([{ deviseId: 'd', montantDevise: '10', cours: '', montant: '101' }], 100)).toHaveProperty('motif');
  });

  it('dit le reste en francs pendant la saisie, quel que soit le sens de la ligne', () => {
    expect(resteEnFrancs([{ deviseId: 'd', montantDevise: '1500', cours: '', montant: '3200000' }], -5_000_000)).toBe(1_800_000);
  });
});

describe('Modèle de fichier d’import · les colonnes de la devise (AU3)', () => {
  it('la balance porte Montant en devise, Devise et Cours, et un exemple en USD', () => {
    const [entete, ...lignes] = modeleImport('BALANCE').trim().split('\n');
    expect(entete.split(';')).toEqual([
      'Numéro de compte',
      'Intitulé',
      'Solde débiteur',
      'Solde créditeur',
      'Montant en devise',
      'Devise',
      'Cours',
    ]);
    expect(lignes.some((l) => l.includes(';1500;USD;'))).toBe(true);
    // Le modèle s'équilibre · un exemple qui ne bouclerait pas serait refusé à l'import.
    const solde = lignes.reduce((s, l) => {
      const c = l.split(';');
      return s + Number(c[2] || 0) - Number(c[3] || 0);
    }, 0);
    expect(solde).toBe(0);
  });

  it('les écritures portent aussi les trois colonnes', () => {
    expect(modeleImport('ECRITURES').split('\n')[0]).toMatch(/Montant en devise;Devise;Cours$/);
  });
});
