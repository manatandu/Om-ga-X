import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  bornesDeLaPeriode,
  cleDeLecture,
  estUnExtrait,
  extraitImprimable,
  lueePour,
  motifPeriodeSaisie,
  PERIODE_EXERCICE,
  periodePourLExercice,
  requetePeriode,
  sectionVisible,
  titreExtrait,
  veille,
} from './periode-extrait';

/**
 * LA PÉRIODE À L'ÉCRAN (ligne export-periode) · la même règle que le serveur
 * (`periodeDeLExtrait`) · une période qui couvre l'exercice n'est pas un
 * extrait, et un extrait se dit toujours (condition 2).
 */
const EXERCICE = { dateDebut: '2026-01-01T00:00:00.000Z', dateFin: '2026-12-31T00:00:00.000Z' };

describe('la période de la balance et du grand livre', () => {
  it('sans borne, ou bornée à l’exercice entier, ce n’est pas un extrait', () => {
    expect(estUnExtrait(EXERCICE, { du: '', au: '' })).toBe(false);
    expect(estUnExtrait(EXERCICE, { du: '2026-01-01', au: '2026-12-31' })).toBe(false);
    expect(estUnExtrait(EXERCICE, { du: '2026-04-01', au: '' })).toBe(true);
  });

  it('une borne vide prend celle de l’exercice, et le titre dit l’extrait', () => {
    expect(bornesDeLaPeriode(EXERCICE, { du: '', au: '2026-06-30' })).toEqual({ du: '2026-01-01', au: '2026-06-30' });
    expect(titreExtrait(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })).toBe('Extrait du 01/04/2026 au 30/06/2026');
    expect(veille('2026-04-01')).toBe('2026-03-31');
    expect(veille('2026-01-01')).toBe('2025-12-31');
  });

  it('l’adresse ne porte que les bornes posées', () => {
    expect(requetePeriode({ du: '', au: '' })).toBe('');
    expect(requetePeriode({ du: '2026-04-01', au: '2026-06-30' })).toBe('&du=2026-04-01&au=2026-06-30');
  });

  it('hors de l’exercice ou à l’envers, refusée avant l’envoi', () => {
    expect(motifPeriodeSaisie(EXERCICE, { du: '2025-12-01', au: '' })).toMatch(/tenir dans l'exercice/);
    expect(motifPeriodeSaisie(EXERCICE, { du: '2026-06-30', au: '2026-04-01' })).toMatch(/dépasse sa date de fin/);
    expect(motifPeriodeSaisie(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })).toBeNull();
  });
});

describe('ce que l’écran montre et imprime · lu pour la période affichée, jamais une autre', () => {
  const avril = { du: '2026-04-01', au: '2026-06-30' };

  it('une donnée lue pour une autre période, un autre réglage ou un autre exercice n’est pas montrée', () => {
    const lue = { cle: cleDeLecture('ex1', PERIODE_EXERCICE, false), donnees: ['balance de l’exercice'] };
    expect(lueePour(lue, cleDeLecture('ex1', PERIODE_EXERCICE, false))).toEqual(['balance de l’exercice']);
    expect(lueePour(lue, cleDeLecture('ex1', avril, false))).toBeNull();
    expect(lueePour(lue, cleDeLecture('ex1', PERIODE_EXERCICE, true))).toBeNull();
    expect(lueePour(lue, cleDeLecture('ex2', PERIODE_EXERCICE, false))).toBeNull();
    expect(lueePour(null, cleDeLecture('ex1', avril, false))).toBeNull();
  });

  it('la période appliquée à un exercice se lit comme l’exercice entier dans un autre', () => {
    expect(periodePourLExercice({ exerciceId: 'ex1', ...avril }, 'ex1')).toEqual(avril);
    expect(periodePourLExercice({ exerciceId: 'ex1', ...avril }, 'ex2')).toEqual(PERIODE_EXERCICE);
    expect(periodePourLExercice({ exerciceId: null, ...avril }, undefined)).toEqual(PERIODE_EXERCICE);
  });

  it('UN COMPTE QUI N’A QUE SON REPORT RESTE MONTRÉ · son solde de départ n’est jamais « aucun report »', () => {
    expect(sectionVisible({ lignes: [], report: { au: '2026-03-31', debit: 2_500_000, credit: 0 } })).toBe(true);
    expect(sectionVisible({ lignes: [{}] })).toBe(true);
    expect(sectionVisible({ lignes: [], report: null })).toBe(false);
    expect(sectionVisible({ lignes: [] })).toBe(false);
  });

  it('L’EXTRAIT NE S’IMPRIME QUE SUR CE QUI EST LU · ni pendant le chargement, ni après un échec', () => {
    const base = { extrait: true, onglet: 'balance', balanceLue: true, grandLivreLu: false, refusGrandLivre: false, sectionSeuleLue: false };
    expect(extraitImprimable(base)).toBe(true);
    expect(extraitImprimable({ ...base, balanceLue: false })).toBe(false);
    expect(extraitImprimable({ ...base, extrait: false })).toBe(false);
    expect(extraitImprimable({ ...base, onglet: 'grand-livre' })).toBe(false);
    expect(extraitImprimable({ ...base, onglet: 'grand-livre', grandLivreLu: true })).toBe(true);
    expect(extraitImprimable({ ...base, onglet: 'grand-livre', refusGrandLivre: true })).toBe(false);
    expect(extraitImprimable({ ...base, onglet: 'grand-livre', refusGrandLivre: true, sectionSeuleLue: true })).toBe(true);
    expect(extraitImprimable({ ...base, onglet: 'journal' })).toBe(false);
  });

  it('la fenêtre du journal s’en sert · aucune balance ni section gardée d’une demande à l’autre', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'JournalPage.tsx'), 'utf8');
    // Les trois lectures se rangent avec leur clé, et se vident en tête de lecture.
    expect(page).toContain('setBalanceLue({ cle, donnees: r.lignes })');
    expect(page).toContain('setGrandLivreLu({ cle, donnees: r })');
    expect(page).toContain('setSectionSeuleLue({ cle, donnees:');
    expect(page).toContain('setBalanceLue(null);');
    expect(page).toContain('const balance = lueePour(balanceLue, cleBalance);');
    expect(page).toContain('const grandLivre = lueePour(grandLivreLu, cleGrandLivre);');
    expect(page).toContain('const sectionSeule = lueePour(sectionSeuleLue, cleSectionSeule);');
    // L'impression passe par la règle, et la section seule par `sectionVisible`.
    expect(page).toContain('const imprimable = extraitImprimable({');
    expect(page).toContain('disabled={impressionExtraitEnCours || !imprimable}');
    // La section seule passe par `sectionVisible`, au tri des sections comme au message vide ·
    // le corps de `sectionsAffichees` est découpé, jamais lu à distance.
    const debut = page.indexOf('const sectionsAffichees = useMemo(');
    const corps = page.slice(debut, page.indexOf('[grandLivre, compteGrandLivreId, refusGrandLivre, sectionSeule]', debut));
    expect(debut).toBeGreaterThan(-1);
    expect(corps).toContain('sectionSeule && sectionVisible(sectionSeule)');
    expect(page).toContain('(sectionSeule && !sectionVisible(sectionSeule))');
    // L'écran relu après l'enregistrement · un numéro ne s'imprime pas sur un autre écran.
    expect(page).toContain('if (ecranCourant.current !== ecranDemande) {');
  });
});
