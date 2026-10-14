import {
  FicheANumeroter,
  ParametresRenumerotation,
  PLAFOND_RENUMEROTATION,
  motifRefusParametres,
  motifRefusPlan,
  numerosEnDouble,
  planDeRenumerotation,
  rapprocher,
} from './maintenance-immobilisations';

/**
 * RENUMÉROTATION ET MAINTENANCE DU REGISTRE (ligne sage-l4, fonction n° 73).
 * Ce qui casserait en silence · deux biens sous un même numéro (l'inventaire
 * physique ne les distingue plus), un bien SORTI renuméroté (la réimpression
 * d'un exercice clos ne dirait plus le document remis), un écart entre le
 * registre et la balance compté à l'envers, ou une dotation pas encore passée
 * lue comme un écart.
 */

const jour = (s: string) => new Date(`${s}T00:00:00Z`);
const fiche = (id: string, o: Partial<FicheANumeroter> = {}): FicheANumeroter => ({
  id,
  designation: `Bien ${id}`,
  numeroInventaire: null,
  dateAcquisition: jour('2026-01-01'),
  createdAt: jour('2026-01-01'),
  sortie: false,
  compteNumero: '24510000',
  ...o,
});
const p: ParametresRenumerotation = { prefixe: 'IMM-', premierNumero: 1, largeur: 4, ordre: 'ACQUISITION', perimetre: 'EN_SERVICE' };

describe('les paramètres', () => {
  it('lisent un préfixe court sans accent, un premier numéro et une largeur bornés', () => {
    expect(motifRefusParametres(p)).toBeNull();
    expect(motifRefusParametres({ ...p, prefixe: 'IMMO-É' })).toMatch(/sans accent/);
    expect(motifRefusParametres({ ...p, prefixe: 'X'.repeat(21) })).toMatch(/vingt caractères/);
    expect(motifRefusParametres({ ...p, largeur: 9 })).toMatch(/1 à 8/);
    expect(motifRefusParametres({ ...p, premierNumero: -1 })).toMatch(/entier/);
  });
});

describe('le plan de renumérotation', () => {
  it('suit la date d’acquisition, puis la saisie · stable pour deux biens du même jour', () => {
    const fiches = [
      fiche('c', { dateAcquisition: jour('2026-03-01') }),
      fiche('b', { createdAt: jour('2026-01-05') }),
      fiche('a', { createdAt: jour('2026-01-02') }),
    ];
    const plan = planDeRenumerotation(fiches, p);
    expect(plan.attributions.map((x) => [x.id, x.nouveau])).toEqual([
      ['a', 'IMM-0001'],
      ['b', 'IMM-0002'],
      ['c', 'IMM-0003'],
    ]);
  });

  it('par compte, le compte d’abord', () => {
    const fiches = [fiche('a', { compteNumero: '24510000' }), fiche('b', { compteNumero: '24410000', dateAcquisition: jour('2026-06-01') })];
    expect(planDeRenumerotation(fiches, { ...p, ordre: 'COMPTE' }).attributions.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('un bien sorti garde son numéro, et ce numéro compte pour l’unicité', () => {
    const fiches = [fiche('a'), fiche('s', { sortie: true, numeroInventaire: 'IMM-0001' })];
    const plan = planDeRenumerotation(fiches, p);
    expect(plan.attributions.map((x) => x.id)).toEqual(['a']);
    expect(plan.collisions).toEqual([{ numero: 'IMM-0001', designation: 'Bien s' }]);
    expect(motifRefusPlan(plan, p)).toMatch(/1 numéro\(s\) nouveau\(x\) déjà porté\(s\) par un bien hors du périmètre · IMM-0001 \(« Bien s »\)/);
    expect(motifRefusPlan(planDeRenumerotation(fiches, { ...p, premierNumero: 2 }), p)).toBeNull();
  });

  it('« sans numéro » ne touche que les biens sans numéro, et respecte les numéros gardés', () => {
    const fiches = [fiche('a', { numeroInventaire: 'IMM-0001' }), fiche('b'), fiche('c', { numeroInventaire: '  ' })];
    const plan = planDeRenumerotation(fiches, { ...p, perimetre: 'SANS_NUMERO', premierNumero: 2 });
    expect(plan.attributions.map((x) => [x.id, x.nouveau])).toEqual([
      ['b', 'IMM-0002'],
      ['c', 'IMM-0003'],
    ]);
    const heurte = planDeRenumerotation(fiches, { ...p, perimetre: 'SANS_NUMERO' });
    expect(heurte.collisions.map((c) => c.numero)).toEqual(['IMM-0001']);
  });

  it('une fiche qui porte déjà son numéro n’est pas réécrite · aucune trace inutile au journal d’audit', () => {
    const plan = planDeRenumerotation([fiche('a', { numeroInventaire: 'IMM-0001' }), fiche('b', { dateAcquisition: jour('2026-02-01') })], p);
    expect(plan.nombre).toBe(2);
    expect(plan.attributions.map((x) => x.id)).toEqual(['b']);
  });

  it('refuse une largeur trop courte, un périmètre vide, un geste trop grand', () => {
    const fiches = Array.from({ length: 12 }, (_, i) => fiche(`f${String(i).padStart(2, '0')}`));
    expect(motifRefusPlan(planDeRenumerotation(fiches, { ...p, largeur: 1 }), { ...p, largeur: 1 })).toMatch(/largeur de 1 chiffres ne suffit pas · le dernier numéro serait IMM-12/);
    expect(motifRefusPlan(planDeRenumerotation([], p), p)).toMatch(/Aucun bien en service/);
    const grand = { attributions: [], collisions: [], nombre: PLAFOND_RENUMEROTATION + 1 };
    expect(motifRefusPlan(grand, p)).toMatch(/au plus/);
  });
});

describe('la maintenance', () => {
  it('nomme les numéros portés par plusieurs biens, sans rien corriger', () => {
    const doubles = numerosEnDouble([
      { id: 'a', designation: 'Camion', numeroInventaire: 'V-01' },
      { id: 'b', designation: 'Moto', numeroInventaire: ' V-01 ' },
      { id: 'c', designation: 'Car', numeroInventaire: 'V-02' },
      { id: 'd', designation: 'Sans numéro', numeroInventaire: null },
    ]);
    expect(doubles).toEqual([{ numero: 'V-01', fiches: [{ id: 'a', designation: 'Camion' }, { id: 'b', designation: 'Moto' }] }]);
  });

  it('rapproche registre et balance au centime, l’écart au sens de la balance, un compte d’un seul côté compris', () => {
    const lignes = rapprocher(
      new Map([
        ['24510000', { intitule: 'Matériel automobile', montant: 12_000_000 }],
        ['24410000', { intitule: 'Matériel de bureau', montant: 3_000_000.004 }],
      ]),
      new Map([
        ['24510000', { intitule: 'Matériel automobile', solde: 15_000_000 }],
        ['24410000', { intitule: 'Matériel de bureau', solde: 3_000_000 }],
        ['24420000', { intitule: 'Matériel informatique', solde: 500_000 }],
      ]),
    );
    expect(lignes).toEqual([
      { numero: '24410000', intitule: 'Matériel de bureau', registre: 3_000_000, balance: 3_000_000, ecart: 0 },
      { numero: '24420000', intitule: 'Matériel informatique', registre: 0, balance: 500_000, ecart: 500_000 },
      { numero: '24510000', intitule: 'Matériel automobile', registre: 12_000_000, balance: 15_000_000, ecart: 3_000_000 },
    ]);
  });

  it('un compte à zéro des deux côtés n’est pas servi', () => {
    expect(rapprocher(new Map([['24510000', { intitule: 'x', montant: 0 }]]), new Map())).toEqual([]);
  });
});
