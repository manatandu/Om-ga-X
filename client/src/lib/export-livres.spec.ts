// Pas d'import de « vitest » · convention du dépôt (voir calcul.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  adresseGrandLivreDuCompte,
  cheminBalance,
  cheminBalanceTiers,
  cheminGrandLivre,
  cheminGrandLivreTiers,
  compteDeLAdresse,
  familleExportee,
  famillesDeLaBalanceTous,
  sectionDuCompteSeul,
} from './export-livres';

/**
 * LES ADRESSES DES EXPORTS DE LIVRES (ligne FPM) · la présentation du cabinet
 * et les feuilles par compte sont le DÉFAUT, aucun paramètre ne part tant que
 * l'utilisateur n'a pas choisi l'autre voie.
 */
describe('exports des balances et grands livres', () => {
  it('le grand livre sort dans la présentation du cabinet sans paramètre, à plat sur demande', () => {
    expect(cheminGrandLivre('ex', 'fpm')).toBe('/exports/grand-livre?exerciceId=ex');
    expect(cheminGrandLivre('ex', 'plat')).toBe('/exports/grand-livre?exerciceId=ex&format=plat');
  });

  it('la balance porte les feuilles par compte, sauf balance seule', () => {
    expect(cheminBalance('ex', false)).toBe('/exports/balance?exerciceId=ex');
    expect(cheminBalance('ex', true)).toBe('/exports/balance?exerciceId=ex&grandsLivres=non');
    expect(cheminBalanceTiers('ex', 'SALARIES', false)).toBe('/exports/balance-auxiliaire?exerciceId=ex&type=SALARIES');
    expect(cheminGrandLivreTiers('ex', 'AUTRES')).toBe('/exports/grand-livre-tiers?exerciceId=ex&type=AUTRES');
  });

  it('le double-clic d’une balance des tiers ouvre le grand livre filtré sur le compte, que l’adresse rend', () => {
    const adresse = adresseGrandLivreDuCompte('c-401');
    expect(adresse).toMatch(/^\/journal\?onglet=grand-livre&compte=c-401&ouverture=[0-9a-z]+-\d+$/);
    expect(compteDeLAdresse(adresse)).toBe('c-401');
    // UN SECOND DOUBLE-CLIC SUR LE MÊME TIERS CHANGE L'ADRESSE · la fenêtre
    // ne relit le compte qu'à un changement d'adresse (second tour, relevé E).
    const seconde = adresseGrandLivreDuCompte('c-401');
    expect(seconde).not.toBe(adresse);
    expect(compteDeLAdresse(seconde)).toBe('c-401');
    expect(compteDeLAdresse('/journal?onglet=balance')).toBeNull();
    expect(compteDeLAdresse(undefined)).toBeNull();
  });

  it('sur « Tous », la famille exportée est choisie, présélectionnée quand la balance n’en porte qu’une', () => {
    expect(famillesDeLaBalanceTous(['40110001', '41110002'])).toEqual(['FOURNISSEURS', 'CLIENTS']);
    expect(famillesDeLaBalanceTous(['41110002'])).toEqual(['CLIENTS']);
    expect(famillesDeLaBalanceTous([])).toEqual([]);
    // Une seule famille · présélectionnée.
    expect(familleExportee('TOUS', null, ['CLIENTS'])).toBe('CLIENTS');
    // Deux · rien n'est deviné tant que le cabinet n'a pas choisi.
    expect(familleExportee('TOUS', null, ['FOURNISSEURS', 'CLIENTS'])).toBeNull();
    expect(familleExportee('TOUS', 'FOURNISSEURS', ['FOURNISSEURS', 'CLIENTS'])).toBe('FOURNISSEURS');
    // Un choix qui n'est plus porté par la balance ne s'exporte pas.
    expect(familleExportee('TOUS', 'FOURNISSEURS', ['CLIENTS'])).toBe('CLIENTS');
    expect(familleExportee('TOUS', 'FOURNISSEURS', [])).toBeNull();
    // Hors « Tous », le type affiché.
    expect(familleExportee('SALARIES', 'CLIENTS', [])).toBe('SALARIES');
  });

  it('le grand livre d’un seul compte prend la forme d’une section, totaux refaits au centime', () => {
    const section = sectionDuCompteSeul({
      compte: { id: 'c', numero: '52110000', intitule: 'Banque', autre: 1 } as never,
      lignes: [
        { debit: 0.1, credit: 0 },
        { debit: 0.2, credit: 0 },
        { debit: 0, credit: 100.05 },
      ],
      soldeFinal: -99.75,
    });
    expect(section.compte).toEqual({ id: 'c', numero: '52110000', intitule: 'Banque' });
    expect(section.totalDebit).toBe(0.3);
    expect(section.totalCredit).toBe(100.05);
    expect(section.soldeFinal).toBe(-99.75);
  });

  it('le grand livre complet refusé à l’écran passe au grand livre du compte double-cliqué', () => {
    const journal = readFileSync(join(__dirname, '..', 'pages', 'JournalPage.tsx'), 'utf8');
    // Le refus de volume (400) ne s'affiche pas en panne · il ouvre la voie du compte seul.
    expect(journal).toContain('e instanceof ApiError && e.status === 400) setRefusGrandLivre(e.message)');
    // La route bornée d'UN compte, lue seulement sur ce refus et pour le compte choisi.
    expect(journal).toContain('!refusGrandLivre || !compteGrandLivreId) return;');
    expect(journal).toContain('`/ecritures/grand-livre/${encodeURIComponent(compteGrandLivreId)}?exerciceId=${exerciceCourant.id}`');
    expect(journal).toContain('setSectionSeule(sectionDuCompteSeul(r))');
  });

  it('les écrans appellent ces adresses, jamais une adresse recopiée', () => {
    const journal = readFileSync(join(__dirname, '..', 'pages', 'JournalPage.tsx'), 'utf8');
    const tiers = readFileSync(join(__dirname, '..', 'pages', 'BalanceAuxiliairePage.tsx'), 'utf8');
    expect(journal).toContain('cheminBalance(exerciceCourant.id, balanceSeule)');
    expect(journal).toContain('cheminGrandLivre(exerciceCourant.id, formatGrandLivre)');
    expect(journal).toContain('onDoubleClick');
    expect(tiers).toContain('cheminBalanceTiers(exerciceCourant.id, famille, balanceSeule)');
    expect(tiers).toContain('navigate(adresseGrandLivreDuCompte(c.compteId))');
  });
});
