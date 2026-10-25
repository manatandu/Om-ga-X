import { comparaisonAuPlafond, especesDesCoupures, heureValide, mentionsDeLArrete, plafondEnVigueur } from './arrete-caisse';

/**
 * ARRÊTÉ DE CAISSE PAR COUPURES (ligne microfina-m2, idée 5) · fiche du compte
 * 57 des deux plans. Ce qui casserait en silence · des espèces qui ne sont pas
 * la somme de leurs coupures, un plafond comparé dans une autre monnaie, un
 * plafond qui refuserait au lieu d'avertir.
 */
describe("l'arrêté de caisse · règles pures", () => {
  it('les coupures FONT les espèces, au centime entier', () => {
    expect(especesDesCoupures([{ valeurUnitaire: 5000, nombre: 3 }, { valeurUnitaire: 500, nombre: 7 }, { valeurUnitaire: 0.5, nombre: 3 }])).toEqual({ centimes: 1_850_150 });
    expect(especesDesCoupures([])).toEqual({ centimes: 0 });
  });

  it('refuse une valeur nulle, hors centime, un nombre fractionnaire et une valeur saisie deux fois', () => {
    expect(especesDesCoupures([{ valeurUnitaire: 0, nombre: 1 }])).toEqual({ motif: expect.stringMatching(/valeur faciale/) });
    expect(especesDesCoupures([{ valeurUnitaire: 0.005, nombre: 1 }])).toEqual({ motif: expect.stringMatching(/au centime/) });
    expect(especesDesCoupures([{ valeurUnitaire: 100, nombre: 1.5 }])).toEqual({ motif: expect.stringMatching(/entier/) });
    expect(especesDesCoupures([{ valeurUnitaire: 500, nombre: 1 }, { valeurUnitaire: 500, nombre: 2 }])).toEqual({ motif: expect.stringMatching(/deux fois/) });
  });

  it('le plafond en vigueur est la dernière version au plus tard le jour', () => {
    const v = [
      { dateEffet: '2026-01-01', montantCentimes: 100, deviseId: null },
      { dateEffet: '2026-06-01', montantCentimes: 200, deviseId: null },
    ];
    expect(plafondEnVigueur(v, '2025-12-31')).toBeNull();
    expect(plafondEnVigueur(v, '2026-05-31')?.montantCentimes).toBe(100);
    expect(plafondEnVigueur(v, '2026-06-01')?.montantCentimes).toBe(200);
  });

  it("le plafond se compare dans SON unité · jamais un dollar contre des francs, et c'est dit", () => {
    const fc = { dateEffet: '2026-01-01', montantCentimes: 50_000_000, deviseId: null };
    expect(comparaisonAuPlafond(60_000_000, null, fc)).toEqual({ plafondCentimes: 50_000_000, depasse: true, nonCompare: null });
    expect(comparaisonAuPlafond(50_000_000, null, fc).depasse).toBe(false);
    expect(comparaisonAuPlafond(60_000_000, 'usd', fc)).toEqual({ plafondCentimes: null, depasse: null, nonCompare: expect.stringMatching(/autre unité/) });
    expect(comparaisonAuPlafond(1, null, null)).toEqual({ plafondCentimes: null, depasse: null, nonCompare: null });
  });

  it("les mentions disent l'écart, la caisse créditrice, le brouillard et le plafond · aucune n'est un refus", () => {
    const m = mentionsDeLArrete({ soldeCentimes: -10_000, especesCentimes: 0, ecrituresAuBrouillard: 2, depassePlafond: false, plafondCentimes: 1, nonCompare: null });
    expect(m.join(' ')).toMatch(/Excédent de caisse de 100,00/);
    expect(m.join(' ')).toMatch(/présomption d’irrégularité/);
    expect(m.join(' ')).toMatch(/2 écriture\(s\) au brouillard/);
    const p = mentionsDeLArrete({ soldeCentimes: 100, especesCentimes: 100, ecrituresAuBrouillard: 0, depassePlafond: true, plafondCentimes: 50, nonCompare: null });
    expect(p).toEqual([expect.stringMatching(/dépassent le plafond d'encaisse .* un avertissement, aucun texte n'en fixe/)]);
    expect(mentionsDeLArrete({ soldeCentimes: 100, especesCentimes: 100, ecrituresAuBrouillard: 0, depassePlafond: null, plafondCentimes: null, nonCompare: null })).toEqual([]);
  });

  it("l'heure se donne HH:MM", () => {
    expect(heureValide('08:30')).toBe('08:30');
    expect(heureValide('24:00')).toBeNull();
    expect(heureValide(undefined)).toBeNull();
  });
});
