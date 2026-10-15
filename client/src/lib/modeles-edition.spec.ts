import { appliquerModele, COLONNES_EDITION } from './modeles-edition';
import { editionAnalytique, editionPlan, editionTiers } from './editions-structures';
import type { Compte, SectionAnalytique, Tiers } from './types';

// Pas d'import de « vitest » · convention du dépôt.

const compte = (numero: string): Compte =>
  ({
    id: numero,
    numero,
    intitule: `Compte ${numero}`,
    typeCompte: 'DETAIL',
    nature: null,
    modeReportANouveau: 'SOLDE',
    lettrable: false,
    estActif: true,
  }) as unknown as Compte;

const tiers = (code: string, type: Tiers['type']): Tiers =>
  ({ id: code, code, nom: `Tiers ${code}`, type, comptesRattaches: [], ville: null, telephone: null, numeroImpot: null, estActif: true }) as unknown as Tiers;

describe('modèles d’édition · la liste imprimée sous un modèle', () => {
  it('le modèle standard rend la liste telle quelle, en un bloc', () => {
    const e = editionPlan([compte('52110000'), compte('40110000')]);
    const m = appliquerModele(e, null, COLONNES_EDITION.PLAN_COMPTABLE);
    expect(m.colonnes).toEqual(e.colonnes);
    expect(m.blocs).toEqual([{ titre: null, lignes: e.lignes }]);
  });

  it('les colonnes facultatives non gardées se taisent ; celles qui identifient restent, dans l’ordre de l’édition', () => {
    const e = editionPlan([compte('40110000')]);
    const m = appliquerModele(e, { colonnes: ['etat', 'nature'], saut: 'AUCUN' }, COLONNES_EDITION.PLAN_COMPTABLE);
    expect(m.colonnes).toEqual(['N° de compte', 'Intitulé', 'Nature', 'État']);
    expect(m.blocs[0].lignes[0]).toEqual(['40110000', 'Compte 40110000', '', 'Actif']);
  });

  it('un saut range par classe, sans perdre ni doubler une ligne', () => {
    const e = editionPlan([compte('52110000'), compte('40110000'), compte('41110000'), compte('10100000')]);
    const m = appliquerModele(e, { colonnes: [], saut: 'PAGE' }, COLONNES_EDITION.PLAN_COMPTABLE);
    expect(m.blocs.map((b) => [b.titre, b.lignes.map((l) => l[0])])).toEqual([
      ['Classe 1', ['10100000']],
      ['Classe 4', ['40110000', '41110000']],
      ['Classe 5', ['52110000']],
    ]);
    expect(m.blocs.flatMap((b) => b.lignes)).toHaveLength(e.lignes.length);
  });

  it('les tiers se rangent par type, dans l’ordre de la fiche, chaque groupe gardant l’ordre des codes', () => {
    const e = editionTiers([tiers('F02', 'FOURNISSEUR'), tiers('C01', 'CLIENT'), tiers('F01', 'FOURNISSEUR')]);
    const m = appliquerModele(e, { colonnes: [], saut: 'LIGNE' }, COLONNES_EDITION.PLAN_TIERS);
    expect(m.blocs.map((b) => [b.titre, b.lignes.map((l) => l[0])])).toEqual([
      ['Client', ['C01']],
      ['Fournisseur', ['F01', 'F02']],
    ]);
  });

  it('le plan analytique se range par rubrique, la ligne sans rubrique en dernier', () => {
    const s = (code: string, type: 'DETAIL' | 'TOTAL'): SectionAnalytique =>
      ({ id: code, planId: 'p', code, intitule: `Section ${code}`, type, bailleur: null, bailleurId: null, dateDebut: null, dateFin: null, estActive: true }) as SectionAnalytique;
    const e = editionAnalytique({ code: 'PRJ', intitule: 'Projets' }, [s('9', 'DETAIL'), s('11', 'DETAIL'), s('1', 'TOTAL'), s('12', 'DETAIL')]);
    const m = appliquerModele(e, { colonnes: [], saut: 'LIGNE' }, COLONNES_EDITION.PLAN_ANALYTIQUE);
    expect(m.blocs.map((b) => [b.titre, b.lignes.map((l) => l[0])])).toEqual([
      ['PRJ · Rubrique 1 · Section 1', ['1', '11', '12']],
      ['Hors rubrique', ['9']],
    ]);
  });

  it('chaque édition personnalisable porte ses clés et ses groupes, une colonne par entrée du catalogue', () => {
    for (const [e, cat] of [
      [editionPlan([compte('40110000')]), COLONNES_EDITION.PLAN_COMPTABLE],
      [editionTiers([tiers('F01', 'FOURNISSEUR')]), COLONNES_EDITION.PLAN_TIERS],
      [editionAnalytique(null, []), COLONNES_EDITION.PLAN_ANALYTIQUE],
    ] as const) {
      expect(e.cles).toEqual(cat.map((c) => c.cle));
      expect(e.colonnes).toEqual(cat.map((c) => c.libelle));
      expect(e.groupes).toHaveLength(e.lignes.length);
    }
  });
});
