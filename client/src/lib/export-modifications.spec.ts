import {
  apercuVide,
  messageBrouillardHorsPortee,
  messageEnAttente,
  porteeDeLExport,
  garderLesPlusAnciens,
  poursuivreListe,
  resumeApercu,
  tailleLisible,
  type ApercuExport,
  type ExportServi,
} from './export-modifications';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

const vide: ApercuExport = {
  dernierNumero: null,
  nouvelles: 0,
  modifiees: 0,
  supprimees: 0,
  lignes: 0,
  enAttente: 0,
  plafondLignes: 200_000,
  brouillardModifieHorsPortee: 0,
  horsPlafond: null,
};

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

  it('un brouillard modifié hors de la portée se dit, rien quand il n’y en a pas (m8)', () => {
    expect(messageBrouillardHorsPortee(0)).toBeNull();
    expect(messageBrouillardHorsPortee(1)).toMatch(/^1 écriture envoyée au brouillard a changé depuis/);
    expect(messageBrouillardHorsPortee(3)).toMatch(/^3 écritures envoyées au brouillard ont changé depuis/);
  });

  it('un export ne disparaît pas quand la suite croise une relecture de la première page (second tour, 4)', () => {
    const e = (n: number) => ({ id: `e${n}`, numero: n }) as ExportServi;
    const lue = { exports: [e(5), e(4)], total: 5, tronque: true, plusAnciensAvant: 4 };
    // Un export n° 6 est produit · la première page relue finit au n° 5.
    const relue = garderLesPlusAnciens(lue, { exports: [e(6), e(5)], total: 6, tronque: true, plusAnciensAvant: 5 });
    expect([relue.exports.map((x) => x.numero), relue.plusAnciensAvant]).toEqual([[6, 5, 4], 4]);
    // La suite demandée avant la relecture (avant le n° 4) s'ajoute sans trou.
    const suite = { exports: [e(3), e(2), e(1)], total: 6, tronque: false, plusAnciensAvant: null };
    expect(poursuivreListe(relue, suite, 4).exports.map((x) => x.numero)).toEqual([6, 5, 4, 3, 2, 1]);
    // Une suite qui ne prolonge plus la liste lue est jetée · ajoutée, le n° 4 manquait.
    const remplacee = { exports: [e(6), e(5)], total: 6, tronque: true, plusAnciensAvant: 5 };
    expect(poursuivreListe(remplacee, suite, 4)).toBe(remplacee);
    expect(garderLesPlusAnciens(null, remplacee)).toBe(remplacee);
  });

  it('la page suivante s’ajoute sous les plus récents, sans doublon, et dit s’il en reste (m5)', () => {
    const e = (n: number) => ({ id: `e${n}`, numero: n }) as ExportServi;
    const premiere = { exports: [e(3), e(2)], total: 3, tronque: true, plusAnciensAvant: 2 };
    const suite = { exports: [e(2), e(1)], total: 3, tronque: false, plusAnciensAvant: null };
    const lue = poursuivreListe(premiere, suite, 2);
    expect(lue.exports.map((x) => x.numero)).toEqual([3, 2, 1]);
    expect([lue.tronque, lue.plusAnciensAvant]).toEqual([false, null]);
  });
});
