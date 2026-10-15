import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pas d'import de « vitest » · convention du dépôt (le jest de la racine
// ramasse aussi client/src, describe/it/expect arrivent par les globales).

/**
 * IMPRESSIONS DIFFÉRÉES · la relance du traitement (relecture des écrans,
 * second tour, 1 et 2). La règle de décision est pure et tenue par
 * `lib/impressions-differees.spec.ts` (`doitFaireProduire`) ; ici, que la
 * fenêtre la suive, et que sa boucle meure avec elle. Les tests se lisent sur
 * le CORPS de chaque fonction, jamais sur une distance dans la source.
 */

const page = readFileSync(join(__dirname, 'ImpressionsDiffereesPage.tsx'), 'utf8');

/** Le corps d'un `useCallback` déclaré à deux espaces, jusqu'à sa liste de dépendances. */
function rappel(nom: string): string {
  const debut = page.indexOf(`  const ${nom} = useCallback(`);
  expect([nom, debut >= 0]).toEqual([nom, true]);
  return page.slice(debut, page.indexOf('\n  }, [', debut));
}

/** Le corps d'une fonction déclarée à deux espaces, jusqu'à sa fermeture. */
function fonction(nom: string): string {
  const debut = page.indexOf(`  function ${nom}(`) >= 0 ? page.indexOf(`  function ${nom}(`) : page.indexOf(`  async function ${nom}(`);
  expect([nom, debut >= 0]).toEqual([nom, true]);
  return page.slice(debut, page.indexOf('\n  }\n', debut));
}

/** Le rappel de la minuterie de relecture, du `setInterval` à sa fermeture. */
function minuterie(): string {
  const debut = page.indexOf('setInterval(');
  expect(debut >= 0).toBe(true);
  return page.slice(debut, page.indexOf('}, INTERVALLE_RELECTURE_MS)', debut));
}

describe('impressions différées · la relance suit la règle et meurt avec la fenêtre', () => {
  it('la boucle de production s’arrête au démontage, la minuterie ne relance rien sur une fenêtre fermée (2)', () => {
    expect(rappel('faireProduire')).toMatch(/for \(let i = 0; i < \d+ && monte\.current; i\+\+\)/);
    const tick = minuterie();
    expect(tick).toMatch(/if \(!monte\.current\) return;[\s\S]*await recharger\(\)/);
    expect(tick).toMatch(/monte\.current && l && doitFaireProduire\(l, suspendueRef\.current\)/);
  });

  it('la relance ne part que par la règle · jamais une production qui tourne, jamais après un refus nommé (1)', () => {
    // Chaque relance automatique (ouverture, minuterie) passe par la règle,
    // jamais par « il reste à produire » seul.
    const relances = [...page.matchAll(/if \((.*)\) void faireProduire\(\)/g)].map((m) => m[1]);
    expect(relances.length).toBe(2);
    for (const condition of relances) expect(condition).toMatch(/doitFaireProduire\(l, suspendueRef\.current\)/);
    // Un refus nommé suspend ; un geste (demander, relancer) lève la suspension.
    expect(rappel('faireProduire')).toMatch(/else if \(monte\.current\) \{[\s\S]*suspendre\(true\)/);
    expect(fonction('demander')).toMatch(/suspendre\(false\);\s*void faireProduire\(\)/);
    expect(fonction('relancerLaProduction')).toMatch(/suspendre\(false\);\s*void faireProduire\(\)/);
  });

  it('« tourne » se lit sur la première page relue, jamais sur les pages plus anciennes gardées (1)', () => {
    expect(page).toMatch(/const tourne = premiere \? productionEnCours\(premiere\) : false;/);
    expect(rappel('recharger')).toMatch(/setPremiere\(l\)/);
  });

  it('le journal rappelé hors de la liste a son option, et l’erreur des journaux tombe au succès (6)', () => {
    expect(page).toMatch(/const journalHorsListe = optionJournalHorsListe\(journalId, journaux\);/);
    expect(page).toMatch(/<option value="">Tous les journaux<\/option>\s*\{journalHorsListe && <option value=\{journalId\}>\{journalHorsListe\}<\/option>\}/);
    // L'appel `.then(` entier, jusqu'à sa fermeture à quatre espaces.
    const debut = page.indexOf("api.get<Journal[]>('/journaux').then(");
    const lecture = page.slice(debut, page.indexOf('\n    );', debut));
    expect(lecture).toMatch(/setJournaux\([\s\S]*setErreurJournaux\(null\)/);
  });

  it('l’aide dit ce que la fermeture laisse faire, et ce qui attend la prochaine ouverture (2)', () => {
    expect(page).toContain('la production commencée se termine au serveur, et les demandes en attente reprennent à la prochaine ouverture');
  });
});
