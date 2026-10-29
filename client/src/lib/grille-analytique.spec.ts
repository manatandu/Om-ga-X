// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SECTION_GRILLE,
  grilleProposee,
  repartirSelonLaGrille,
  ventilationsDeLaLigne,
  type GrilleAnalytiqueLue,
} from './grille-analytique';

/**
 * Fonction n° 48 · LA RÈGLE DE L'ÉCRAN EST CELLE DU SERVEUR · les cas sont
 * LUS dans `src/modules/analytique/cas-grille-analytique.json`, que le spec du
 * serveur rejoue aussi. Une répartition recopiée qui divergerait ferait
 * refuser la pièce par le serveur, ou poserait le centime ailleurs.
 */
type Cas = {
  nom: string;
  montant: number;
  lignes: { sectionId: string; code: string; pourcentage: number }[];
  attendu: { sectionId: string; montant: number }[] | null;
};
const { cas } = JSON.parse(
  readFileSync(join(__dirname, '../../../src/modules/analytique/cas-grille-analytique.json'), 'utf8'),
) as { cas: Cas[] };

describe('grille analytique à l’écran · miroir du serveur', () => {
  it('rejoue au moins six cas', () => {
    expect(cas.length).toBeGreaterThanOrEqual(6);
  });
  for (const c of cas) {
    it(c.nom, () => {
      expect(repartirSelonLaGrille(c.montant, c.lignes)).toEqual(c.attendu);
    });
  }
});

const GRILLE: GrilleAnalytiqueLue = {
  id: 'g1',
  compte: { id: 'c604', numero: '60400000', intitule: 'Achats' },
  plan: { id: 'p1', code: 'PROJ', intitule: 'Projets' },
  lignes: [
    { sectionId: 'a', code: 'P1', pourcentage: 60 },
    { sectionId: 'b', code: 'P2', pourcentage: 40 },
  ],
  inapplicable: null,
  modifieeLe: '2026-10-29T00:00:00.000Z',
};

describe('ventilations d’une ligne de la pièce', () => {
  const code = () => 'PROJ';

  it('une grille inapplicable ne se propose pas', () => {
    expect(grilleProposee([GRILLE], 'c604', 'p1')).toBe(GRILLE);
    expect(grilleProposee([{ ...GRILLE, inapplicable: 'section en sommeil' }], 'c604', 'p1')).toBeNull();
    expect(grilleProposee(null, 'c604', 'p1')).toBeNull();
  });

  it('la marque « Grille » répartit la ligne au crédit comme au débit, sur SON montant', () => {
    const credit = ventilationsDeLaLigne(
      { compteId: 'c604', numero: '60400000', debit: 0, credit: 250, sections: { p1: SECTION_GRILLE } },
      [GRILLE],
      code,
    );
    expect(credit).toEqual({ ventilations: [{ sectionId: 'a', credit: 150 }, { sectionId: 'b', credit: 100 }] });
  });

  it('une section choisie porte toute la ligne', () => {
    expect(
      ventilationsDeLaLigne({ compteId: 'c604', numero: '60400000', debit: 80, credit: 0, sections: { p1: 'a' } }, [GRILLE], code),
    ).toEqual({ ventilations: [{ sectionId: 'a', debit: 80, credit: undefined }] });
  });

  it('une grille disparue ou un montant nul refusent l’envoi en le disant', () => {
    const sans = ventilationsDeLaLigne(
      { compteId: 'c604', numero: '60400000', debit: 80, credit: 0, sections: { p1: SECTION_GRILLE } },
      [],
      code,
    );
    expect('erreur' in sans && sans.erreur).toMatch(/ne se propose plus/);
    const nul = ventilationsDeLaLigne(
      { compteId: 'c604', numero: '60400000', debit: 0, credit: 0, sections: { p1: SECTION_GRILLE } },
      [GRILLE],
      code,
    );
    expect('erreur' in nul && nul.erreur).toMatch(/montant positif/);
  });

  it('une part nulle ne fait pas de ventilation, la somme reste la ligne', () => {
    const r = ventilationsDeLaLigne(
      {
        compteId: 'c604',
        numero: '60400000',
        debit: 0.01,
        credit: 0,
        sections: { p1: SECTION_GRILLE },
      },
      [{ ...GRILLE, lignes: [{ sectionId: 'a', code: 'P1', pourcentage: 50 }, { sectionId: 'b', code: 'P2', pourcentage: 50 }] }],
      code,
    );
    expect(r).toEqual({ ventilations: [{ sectionId: 'a', debit: 0.01 }] });
  });
});
