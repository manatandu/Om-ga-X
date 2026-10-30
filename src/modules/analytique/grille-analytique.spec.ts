import { readFileSync } from 'fs';
import { join } from 'path';
import { motifGrilleInapplicable, motifRefusGrille, repartirSelonLaGrille, type SectionDeGrille } from './grille-analytique';

/**
 * Fonction n° 48 · ce qui casserait en silence · une répartition dont la
 * somme ne ferait pas la ligne (la saisie refuserait la pièce, ou pire, le
 * centime partirait sur une section au hasard), une grille à 99 % acceptée
 * (un pour cent de la charge porté par aucune section), une grille posée sur
 * un compte que le plan ne ventile pas, et une grille dont une section est
 * passée en sommeil qui se proposerait encore.
 */
type Cas = {
  nom: string;
  montant: number;
  lignes: { sectionId: string; code: string; pourcentage: number }[];
  attendu: { sectionId: string; montant: number }[] | null;
};
const { cas } = JSON.parse(readFileSync(join(__dirname, 'cas-grille-analytique.json'), 'utf8')) as { cas: Cas[] };

describe('répartition selon la grille · cas partagés avec l’écran', () => {
  it.each(cas.map((c) => [c.nom, c] as const))('%s', (_nom, c) => {
    const r = repartirSelonLaGrille(c.montant, c.lignes);
    expect(r).toEqual(c.attendu);
    if (r) expect(Math.round(r.reduce((t, p) => t + p.montant, 0) * 100)).toBe(Math.round(c.montant * 100));
  });
});

const PLAN = { id: 'p1', code: 'PROJ', classesVentilees: '2,6,7,9', estActif: true };
const COMPTE = { numero: '60400000', classe: '6', estTotal: false };
const SECTIONS: SectionDeGrille[] = [
  { id: 'a', planId: 'p1', code: 'P1', estTotal: false, estActive: true },
  { id: 'b', planId: 'p1', code: 'P2', estTotal: false, estActive: true },
  { id: 'r', planId: 'p1', code: 'P', estTotal: true, estActive: true },
  { id: 's', planId: 'p1', code: 'P9', estTotal: false, estActive: false },
  { id: 'x', planId: 'p2', code: 'B1', estTotal: false, estActive: true },
];

describe('refus d’une grille déclarée', () => {
  const refus = (lignes: { sectionId: string; pourcentage: number }[], extra: Partial<Parameters<typeof motifRefusGrille>[0]> = {}) =>
    motifRefusGrille({ plan: PLAN, compte: COMPTE, sections: SECTIONS, lignes, ...extra });

  it('admet une grille à 100 % sur des sections Détail actives du plan', () => {
    expect(refus([{ sectionId: 'a', pourcentage: 60 }, { sectionId: 'b', pourcentage: 40 }])).toBeNull();
  });

  it('refuse une grille qui ne fait pas 100 %', () => {
    expect(refus([{ sectionId: 'a', pourcentage: 60 }, { sectionId: 'b', pourcentage: 39 }])).toMatch(/99\.00 %/);
  });

  it('refuse une rubrique, une section en sommeil, une section d’un autre plan, un doublon', () => {
    expect(refus([{ sectionId: 'r', pourcentage: 100 }])).toMatch(/rubrique/);
    expect(refus([{ sectionId: 's', pourcentage: 100 }])).toMatch(/sommeil/);
    expect(refus([{ sectionId: 'x', pourcentage: 100 }])).toMatch(/n'appartient pas/);
    expect(refus([{ sectionId: 'a', pourcentage: 50 }, { sectionId: 'a', pourcentage: 50 }])).toMatch(/déjà/);
  });

  it('refuse plus de deux décimales et un pourcentage nul', () => {
    expect(refus([{ sectionId: 'a', pourcentage: 33.333 }, { sectionId: 'b', pourcentage: 66.667 }])).toMatch(/illisible/);
    expect(refus([{ sectionId: 'a', pourcentage: 0 }, { sectionId: 'b', pourcentage: 100 }])).toMatch(/strictement positif/);
  });

  it('refuse un compte que le plan ne ventile pas, un compte de regroupement, un plan en sommeil', () => {
    expect(refus([{ sectionId: 'a', pourcentage: 100 }], { compte: { numero: '52100000', classe: '5', estTotal: false } })).toMatch(
      /ne ventile pas la classe 5/,
    );
    expect(refus([{ sectionId: 'a', pourcentage: 100 }], { compte: { numero: '60', classe: '6', estTotal: true } })).toMatch(/regroupement/);
    expect(refus([{ sectionId: 'a', pourcentage: 100 }], { plan: { ...PLAN, estActif: false } })).toMatch(/sommeil/);
  });

  it('refuse une grille vide · on la retire', () => {
    expect(refus([])).toMatch(/retirez-la/);
  });
});

describe('une grille enregistrée qui ne s’applique plus se dit', () => {
  it('section passée en sommeil ou devenue rubrique, plan en sommeil', () => {
    const avec = (s: Partial<SectionDeGrille>) => [{ ...SECTIONS[0], ...s, pourcentage: 100 }];
    const compte = { ...COMPTE, estActif: true };
    expect(motifGrilleInapplicable({ plan: PLAN, compte, sections: avec({}) })).toBeNull();
    expect(motifGrilleInapplicable({ plan: PLAN, compte, sections: avec({ estActive: false }) })).toMatch(/sommeil/);
    expect(motifGrilleInapplicable({ plan: PLAN, compte, sections: avec({ estTotal: true }) })).toMatch(/rubrique/);
    expect(motifGrilleInapplicable({ plan: { ...PLAN, estActif: false }, compte, sections: avec({}) })).toMatch(/plan PROJ est en sommeil/);
  });

  it('le compte en sommeil ou devenu regroupement, la classe que le plan ne ventile plus', () => {
    const avec = [{ ...SECTIONS[0], pourcentage: 100 }];
    const compte = { ...COMPTE, estActif: true };
    expect(motifGrilleInapplicable({ plan: PLAN, compte: { ...compte, estActif: false }, sections: avec })).toMatch(/compte 60400000 est en sommeil/);
    expect(motifGrilleInapplicable({ plan: PLAN, compte: { ...compte, estTotal: true }, sections: avec })).toMatch(/regroupement/);
    expect(motifGrilleInapplicable({ plan: { ...PLAN, classesVentilees: '2,7' }, compte, sections: avec })).toMatch(/ne ventile pas la classe 6/);
  });
});
