import { readFileSync } from 'fs';
import { join } from 'path';
import { adresseGrandLivre, adresseOrigine, celluleDuComposant, horsDesEtats, soldeLuParLesEtats } from './origine-montant';

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
    // Un composant s'ouvre par la cellule qu'il désigne, jamais par celle du total.
    expect(fenetre).toContain('celluleDuComposant(cellule, c)');
  });

  it("un composant d'un total de note ouvre SA ligne, jamais le total · la boucle de la relecture du 2026-11-01", () => {
    const total = { etat: 'note' as const, ref: '18A', colonne: 'N' as const, ligne: 7 };
    expect(celluleDuComposant(total, { ref: '18A', libelle: 'Intérêts courus', signe: 1, montant: 10, ligne: 2 })).toEqual({
      ...total,
      ligne: 2,
    });
    // Sans rang servi, ou dit non ouvrable, il ne s'ouvre pas.
    expect(celluleDuComposant(total, { ref: '18A', libelle: 'X', signe: 1, montant: 0 })).toBeNull();
    expect(celluleDuComposant(total, { ref: '18A', libelle: 'X', signe: 1, montant: null, nonOuvrable: 'ambiguë' })).toBeNull();
    // Un poste d'état s'ouvre par son code ; RQP nul, retiré de l'état, ne s'ouvre pas.
    const xe = { etat: 'compte-de-resultat' as const, ref: 'XE', colonne: 'N1' as const };
    expect(celluleDuComposant(xe, { ref: 'XD', libelle: 'EBE', signe: 1, montant: 5 })).toEqual({ ...xe, ref: 'XD' });
    expect(celluleDuComposant(xe, { ref: 'RQP', libelle: 'QP', signe: 1, montant: 0, nonOuvrable: 'retiré' })).toBeNull();
  });

  it('le grand livre se borne à la situation, et dit le solde des seules lignes que les états lisent', () => {
    expect(adresseGrandLivre('c1', 'e1', '2026-06-30')).toBe('/ecritures/grand-livre/c1?exerciceId=e1&au=2026-06-30');
    expect(adresseGrandLivre('c1', 'e1')).toBe('/ecritures/grand-livre/c1?exerciceId=e1');
    expect(horsDesEtats({ statut: 'VALIDEE', aNouveauProvisoire: true })).toBe('À-nouveau provisoire');
    expect(
      soldeLuParLesEtats([
        { debit: 100, credit: 0, statut: 'VALIDEE' },
        { debit: 0, credit: 30.1, statut: 'VALIDEE' },
        { debit: 500, credit: 0, statut: 'BROUILLARD' },
        { debit: 70, credit: 0, statut: 'VALIDEE', aNouveauProvisoire: true },
        { debit: 0, credit: 69.9, statut: 'VALIDEE', soldeDesComptesDeGestion: true },
      ]),
    ).toBe(69.9);
  });
});
