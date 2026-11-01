import { readFileSync } from 'fs';
import { join } from 'path';
import { adresseOrigine, horsDesEtats } from './origine-montant';

/**
 * D'OÙ VIENT CE CHIFFRE (ligne origine-des-montants) · ce qui casserait en
 * silence côté écran · une cellule qui ne s'ouvre plus (le zoom disparaît
 * sans erreur), une adresse qui perd sa colonne (le Brut s'ouvrirait sur le
 * Net), ou un écran qui recalculerait l'origine au lieu de la lire.
 */
describe('origine-montant', () => {
  it("l'adresse d'un état porte l'état, le poste, la colonne et la situation", () => {
    const a = adresseOrigine({ type: 'etats', base: '/etats-financiers-syscohada', arreteAu: '2026-06-30' }, 'ex1', {
      etat: 'bilan',
      ref: 'AJ',
      colonne: 'BRUT',
    });
    expect(a).toBe('/etats-financiers-syscohada/origine?exerciceId=ex1&ref=AJ&colonne=BRUT&etat=bilan&arreteAu=2026-06-30');
  });

  it("l'adresse d'une note porte son code, sa ligne et son sous-tableau", () => {
    const a = adresseOrigine({ type: 'notes', base: '/notes-annexes/origine', jeu: 'ASSOCIATIONS' }, 'ex1', {
      etat: 'note',
      ref: '5A',
      colonne: 'N',
      ligne: 3,
    });
    expect(a).toBe('/notes-annexes/origine?exerciceId=ex1&ref=5A&colonne=N&ligne=3&jeu=ASSOCIATIONS');
  });

  it('le brouillard et le solde des comptes de gestion sont dits hors des états', () => {
    expect(horsDesEtats({ statut: 'BROUILLARD' })).toBe('Brouillard');
    expect(horsDesEtats({ statut: 'VALIDEE', soldeDesComptesDeGestion: true })).toBe('Solde de gestion');
    expect(horsDesEtats({ statut: 'VALIDEE' })).toBeNull();
  });

  it('les deux écrans d’états ouvrent chaque montant par la même cellule, et la fenêtre ne recalcule rien', () => {
    for (const page of ['EtatsFinanciersPage.tsx', 'EtatsFinanciersSyscohadaPage.tsx']) {
      const src = readFileSync(join(__dirname, '../pages', page), 'utf8');
      for (const etat of ['bilan', 'compte-de-resultat', 'tableau-flux-tresorerie']) {
        expect(src).toContain(`cellule('${etat}'`);
      }
      for (const colonne of ['N', 'N1', 'BRUT', 'AMORTISSEMENT']) expect(src).toContain(`'${colonne}')}`);
      expect(src).toContain('<FenetreOrigineMontant');
    }
    const fenetre = readFileSync(join(__dirname, '../components/OrigineMontant.tsx'), 'utf8');
    // Le total et l'écart sont LUS sur la réponse du serveur.
    expect(fenetre).toContain('origine.total');
    expect(fenetre).toContain('origine.ecart');
  });
});
