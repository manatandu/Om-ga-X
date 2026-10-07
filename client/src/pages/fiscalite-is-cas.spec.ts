import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CAS CHIFFRÉS IS · ce que l'écran de l'impôt doit dire (mineurs des deux
 * relectures de la ligne IS-CAS). Lecture de la SOURCE, comme
 * `restitution-fiscale.spec.ts` · aucun import de `vitest`, les globales
 * suffisent aux deux lanceurs.
 */
const page = () => readFileSync(join(__dirname, 'FiscalitePage.tsx'), 'utf8');

describe('Impôt · report déclaré sans origine', () => {
  it('la borne de prudence est dite jouer dans les exercices SUIVANTS, pas dans celui de la saisie', () => {
    const s = page();
    expect(s).toContain('Origine non déclarée · report borné par prudence dans les exercices suivants');
    expect(s).toContain('dans les exercices suivants, OmegaX le borne par prudence');
  });
});

describe('Impôt · saisies de la période de création et des suppléments', () => {
  it('un montant illisible au blur se dit, il n’est plus ignoré', () => {
    const s = page();
    for (const quoi of ['Bénéfice fiscal de la période', 'Suppléments établis par l’Administration', 'Suppléments sur l’impôt de la période']) {
      expect(s).toContain(`montantIllisible('${quoi}`);
    }
    expect(s).toMatch(/const montantIllisible = \(quoi: string\) =>\s*setErreur\(/);
  });

  it('report, origine et bénéfice de la période sont désactivés sur un exercice clôturé', () => {
    const s = page();
    expect(s).toContain("statut === 'CLOTURE'");
    expect(s.match(/disabled=\{envoi \|\| exerciceClos\}/g)?.length).toBe(2);
    expect(s).toContain('envoi={envoi || exerciceClos}');
  });

  it('le bandeau « Calcul provisoire » dit aussi l’effet du brouillard sur le chiffre d’affaires', () => {
    const s = page();
    const debut = s.indexOf('Calcul provisoire ·');
    const bandeau = s.slice(debut, s.indexOf('</div>', debut));
    expect(bandeau).toContain('resultat.brouillard.effetSurChiffreAffaires !== 0');
    expect(bandeau).toContain('sur le chiffre d’affaires');
  });
});

describe('Impôt · changement d’exercice pendant un chargement (second tour de relecture)', () => {
  // Structure, jamais distance : on découpe le corps de chaque fonction.
  const corps = (s: string, debut: string) => {
    const i = s.indexOf(debut);
    return s.slice(i, s.indexOf('\n  };', i));
  };

  it('une réponse d’un autre exercice que celui attendu est jetée', () => {
    const c = corps(page(), 'const charger = (id: string) =>');
    expect(c).toContain('exerciceAttendu.current = id;');
    expect(c.match(/if \(exerciceAttendu\.current === id\)/g)?.length).toBe(2);
  });

  it('le dossier s’enregistre sur l’exercice AFFICHÉ, et seulement s’il est encore celui du sélecteur', () => {
    const c = corps(page(), 'const modifierDossier = async');
    expect(c).toContain('const cible = resultat?.exerciceId;');
    expect(c).toContain('if (!cible || cible !== exerciceId) return;');
    expect(c).toContain('`/fiscalite/exercices/${cible}/dossier`');
  });

  it('un déficit antérieur illisible au blur se dit', () => {
    expect(page()).toContain("montantIllisible('Déficits antérieurs, nombre positif attendu')");
  });
});
