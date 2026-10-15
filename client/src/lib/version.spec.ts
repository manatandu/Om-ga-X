import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { identiteConstruction, ligneLangue, ligneMiseEnProduction, ligneVersion } from './version';

// Aucun import de « vitest » (globales) · convention du dépôt.

/** AUDIT FINAL F180 · « À propos » annonçait « Version de développement » en production. */
describe('l’identité de la construction', () => {
  it('dit la version, la révision, la date, et la date du paquet sur site', () => {
    expect(ligneVersion({ version: '0.0.1', commit: '9422276', construitLe: '2026-09-27' }, '2026-09-26')).toBe(
      'Version 0.0.1 · révision 9422276 · construite le 2026-09-27 · paquet sur site du 2026-09-26.',
    );
  });

  it('ce qui manque se dit, rien n’est inventé', () => {
    expect(ligneVersion({ version: null, commit: null, construitLe: null })).toBe(
      'Version non renseignée · révision non renseignée (construction locale).',
    );
  });

  it('ne lève pas quand le lanceur ne définit pas les constantes', () => {
    expect(() => identiteConstruction()).not.toThrow();
  });

  it('la construction pose les trois constantes, et la boîte les affiche', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'vite.config.ts'), 'utf8');
    expect(config).toContain('__OMEGAX_VERSION__: JSON.stringify(process.env.npm_package_version ?? null)');
    expect(config).toContain('__OMEGAX_COMMIT__: JSON.stringify(process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : null)');
    const apropos = readFileSync(join(__dirname, '..', 'components', 'chrome', 'AProposModale.tsx'), 'utf8');
    expect(apropos).toContain('{ligneVersion(identiteConstruction(), datePaquet)}');
    expect(apropos).toContain(".then((e) => vivant && e.surSite && setDatePaquet(e.dateVersion ?? null))");
  });
});

/**
 * MISE EN PRODUCTION ET LANGUE (ligne pages-legales, demande de Manasse du
 * 2026-10-15). La mise en production n'est dite que si la publication l'a
 * posée · une date de construction locale prise pour une mise en production
 * serait une date inventée.
 */
describe('la mise en production et la langue', () => {
  it('dit la publication qui a déployé l’interface, avec son numéro', () => {
    expect(ligneMiseEnProduction({ version: '0.0.1', commit: 'abc1234', construitLe: '2026-10-15', miseEnProduction: { le: '2026-10-15', publication: '812' } })).toBe(
      'Mise en production de l’interface · le 2026-10-15, publication n° 812.',
    );
  });

  it('sans publication, la dit non renseignée · jamais la date de construction à sa place', () => {
    const l = ligneMiseEnProduction({ version: '0.0.1', commit: null, construitLe: '2026-10-15', miseEnProduction: null });
    expect(l).toBe('Mise en production · non renseignée (construction hors de la chaîne de publication en ligne).');
    expect(l).not.toContain('2026-10-15');
    expect(ligneMiseEnProduction({ version: null, commit: null, construitLe: null })).toContain('non renseignée');
  });

  it('dit le français, seule langue', () => {
    expect(ligneLangue()).toBe('Langue de l’interface · français, seule langue disponible.');
  });

  it('seul le workflow qui construit ET déploie l’interface pose la mise en production', () => {
    const racine = join(__dirname, '..', '..', '..');
    const config = readFileSync(join(__dirname, '..', '..', 'vite.config.ts'), 'utf8');
    expect(config).toContain("process.env.OMEGAX_MISE_EN_PRODUCTION === 'oui'");
    expect(config).toContain('publication: process.env.GITHUB_RUN_NUMBER ?? null');
    const publication = readFileSync(join(racine, '.github/workflows/firebase-hosting-merge.yml'), 'utf8');
    expect(publication).toContain("OMEGAX_MISE_EN_PRODUCTION: 'oui'");
    // L'aperçu d'une demande de tirage et le paquet sur site ne la posent pas.
    for (const f of ['firebase-hosting-pull-request.yml', 'paquet-sur-site.yml', 'tests-navigateur.yml']) {
      expect([f, readFileSync(join(racine, '.github/workflows', f), 'utf8').includes('OMEGAX_MISE_EN_PRODUCTION')]).toEqual([f, false]);
    }
  });

  it('la date de mise en production est le jour de Kinshasa, jamais le jour UTC (relecture, mineur 7)', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'vite.config.ts'), 'utf8');
    expect(config).toContain("{ timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }");
    // Un seul instant, lu au jour de Kinshasa, pour la construction ET la mise
    // en production (second tour, mineur 4) · jamais deux horloges.
    expect(config).toContain('const CONSTRUCTION = jourDeKinshasa(new Date());');
    expect(config).toContain('__OMEGAX_CONSTRUIT_LE__: JSON.stringify(CONSTRUCTION),');
    expect(config).toContain('? { le: CONSTRUCTION, publication:');
    // Le format retenu rend AAAA-MM-JJ, et une publication à 23 h 30 UTC est
    // du lendemain à Kinshasa (UTC+1).
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' });
    expect(f.format(new Date('2026-10-15T23:30:00Z'))).toBe('2026-10-16');
    expect(f.format(new Date('2026-10-15T12:00:00Z'))).toBe('2026-10-15');
  });

  it('la boîte À propos affiche les deux lignes', () => {
    const apropos = readFileSync(join(__dirname, '..', 'components', 'chrome', 'AProposModale.tsx'), 'utf8');
    expect(apropos).toContain('{ligneMiseEnProduction(identiteConstruction())}');
    expect(apropos).toContain('{ligneLangue()}');
  });
});
