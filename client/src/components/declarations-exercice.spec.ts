import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » (globales) · convention du dépôt.

/**
 * FICHE R2 ET DATES DE L'ASSEMBLÉE · relecture 1 des décisions par la loi du
 * 2026-10-04. Ce qui se gèle est ce que le code FAIT, lu dans le corps des
 * fonctions et non à une distance de caractères.
 */
const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');
const exercice = lire('pages/ExercicePage.tsx');
const ficheR2 = lire('components/FicheR2Exercice.tsx');
const dates = lire('components/DatesPortefeuilleExercice.tsx');

/** Le corps d'une fonction fléchée `const nom = async (…) => { … };`. */
function corps(source: string, nom: string): string {
  const debut = source.indexOf(`const ${nom} = async`);
  expect(debut).toBeGreaterThan(-1);
  const ouvre = source.indexOf('{', source.indexOf('=>', debut));
  let profondeur = 0;
  for (let i = ouvre; i < source.length; i++) {
    if (source[i] === '{') profondeur++;
    if (source[i] === '}' && --profondeur === 0) return source.slice(ouvre, i + 1);
  }
  throw new Error(`corps de ${nom} introuvable`);
}

describe('fiche R2 et dates de l’assemblée à l’écran', () => {
  it('la fiche R2 n’est pas montrée au Système minimal de trésorerie, dont la liasse n’en porte pas', () => {
    const appel = exercice.indexOf('<FicheR2Exercice');
    const garde = exercice.slice(exercice.lastIndexOf('{exercice &&', appel), appel);
    expect(garde).toContain("utilisateur?.tenant.referentiel === 'SYSCOHADA'");
    expect(garde).toContain("utilisateur.tenant.systemeComptableSyscohada !== 'MINIMAL_TRESORERIE'");
  });

  it('l’assemblée se déclare pour toute société commerciale, dépôt et procès-verbal pour le seul portefeuille', () => {
    const appel = exercice.indexOf('<DatesPortefeuilleExercice');
    const garde = exercice.slice(exercice.lastIndexOf('{exercice &&', appel), appel);
    expect(garde).toContain('estSocieteCommerciale(planning.formeJuridiqueSyscohada)');
    expect(exercice).toContain('portefeuille={planning.entreprisePortefeuilleEtat === true}');
    expect(dates).toContain("{portefeuille && date('États déposés au ministère le', depot, setDepot)}");
    expect(dates).toContain("{portefeuille && date('Procès-verbal communiqué le', transmission, setTransmission)}");
  });

  it('les deux formulaires lisent le droit de l’administrateur dans la session, comme l’arrêté des comptes', () => {
    for (const source of [ficheR2, dates]) {
      expect(source).toContain('const { estAdmin: peutDeclarer } = useAuth();');
      expect(source).not.toMatch(/peutEcrire/);
    }
    expect(exercice).toMatch(/<FicheR2Exercice exercice=\{exercice\} apresEnregistrement=\{rechargerExercices\} \/>/);
  });

  it('une réponse d’un exercice quitté ou d’un envoi dépassé ne s’affiche pas', () => {
    for (const source of [ficheR2, dates]) {
      const envoi = corps(source, 'enregistrer');
      expect(envoi).toContain('const moi = ++envoiCourant.current;');
      expect(envoi).toMatch(/if \(moi === envoiCourant\.current\) setInfo\(/);
      expect(envoi).toMatch(/if \(moi === envoiCourant\.current\) setErreur\(/);
    }
    const lecture = corps(exercice, 'charger');
    expect(lecture).toContain('const jeton = ++jetonCharger.current;');
    expect(lecture.match(/if \(jeton !== jetonCharger\.current\) return;/g)).toHaveLength(2);
  });

  it('en lecture, une case vide se dit « Non renseignée »', () => {
    expect(ficheR2).toContain("const vide = peutDeclarer ? undefined : 'Non renseignée';");
    expect(dates).toContain("iso === '' ? 'Non renseignée'");
  });
});
