import { apercuVide, messageEnAttente, porteeDeLExport, resumeApercu, tailleLisible, type ApercuExport } from './export-modifications';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

const vide: ApercuExport = { dernierNumero: null, nouvelles: 0, modifiees: 0, supprimees: 0, lignes: 0, enAttente: 0, plafondLignes: 200_000 };

describe('export des seules modifications · ce que la fenêtre en dit', () => {
  it('la portée reprend les mots de la feuille « Export » du fichier', () => {
    expect(porteeDeLExport({ mode: 'MODIFICATIONS', numero: 1 })).toBe('Premier export');
    expect(porteeDeLExport({ mode: 'MODIFICATIONS', numero: 4 })).toBe("Modifications depuis l'export n° 3");
    expect(porteeDeLExport({ mode: 'COMPLET', numero: 1 })).toBe('Export complet');
    expect(porteeDeLExport({ mode: 'COMPLET', numero: 7 })).toBe('Export complet');
  });

  it("un retrait seul suffit à faire partir un export · il se dit à la receveuse", () => {
    expect(apercuVide(vide)).toBe(true);
    expect(apercuVide({ ...vide, supprimees: 1 })).toBe(false);
    expect(apercuVide({ ...vide, modifiees: 1, lignes: 2 })).toBe(false);
  });

  it('rien à exporter se dit selon qu’un export a déjà eu lieu', () => {
    expect(resumeApercu(vide)).toBe('Aucune écriture à exporter.');
    expect(resumeApercu({ ...vide, dernierNumero: 2 })).toBe("Aucune modification depuis l'export n° 2.");
  });

  it('le résumé compte les trois mouvements et les lignes', () => {
    expect(resumeApercu({ ...vide, dernierNumero: 1, nouvelles: 2, modifiees: 1, supprimees: 0, lignes: 6 })).toBe(
      '2 nouvelles, 1 modifiée, 0 supprimée · 6 lignes',
    );
  });

  it('ce qui attend le lot suivant est dit, rien quand rien n’attend', () => {
    expect(messageEnAttente(0)).toBeNull();
    expect(messageEnAttente(1)).toBe("1 écriture attend le lot suivant · relancez l'export après celui-ci.");
    expect(messageEnAttente(3)).toBe("3 écritures attendent le lot suivant · relancez l'export après celui-ci.");
  });

  it('la taille du fichier se lit en octets, kilo-octets ou mégaoctets', () => {
    expect(tailleLisible(800)).toBe('800 o');
    expect(tailleLisible(2049)).toBe('3 Ko');
    expect(tailleLisible(3 * 1024 * 1024)).toBe('3 Mo');
  });
});
