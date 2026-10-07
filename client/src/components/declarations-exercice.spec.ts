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

/** Les propriétés d'un élément JSX, de sa balise ouvrante à sa fermeture « /> ». */
function proprietesDe(source: string, balise: string): string {
  const debut = source.indexOf(balise);
  expect(debut).toBeGreaterThan(-1);
  return source.slice(debut, source.indexOf('/>', debut));
}

/**
 * La garde d'un champ de date `{garde && date('Libellé', …)}` · lue dans
 * l'expression JSX qui l'enferme (son accolade ouvrante), jamais à une
 * distance de caractères.
 */
function gardeDuChamp(source: string, libelle: string): string {
  const appel = source.indexOf(`date('${libelle}'`);
  expect(appel).toBeGreaterThan(-1);
  const expression = source.slice(source.lastIndexOf('{', appel) + 1, appel);
  return expression.replace(/&&\s*$/, '').trim();
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
    expect(proprietesDe(exercice, '<DatesPortefeuilleExercice')).toContain('planning.entreprisePortefeuilleEtat === true');
    expect(gardeDuChamp(dates, 'États déposés au ministère le')).toBe('portefeuille');
    expect(gardeDuChamp(dates, 'Procès-verbal communiqué le')).toBe('portefeuille');
  });

  it('les deux formulaires lisent le droit de l’administrateur dans la session, comme l’arrêté des comptes', () => {
    for (const source of [ficheR2, dates]) {
      expect(source).toContain('const { estAdmin: peutDeclarer } = useAuth();');
      expect(source).not.toMatch(/peutEcrire/);
    }
    const fiche = exercice.slice(exercice.indexOf('<FicheR2Exercice'), exercice.indexOf('/>', exercice.indexOf('<FicheR2Exercice')));
    expect(fiche).toContain('exercice={exercice}');
    expect(fiche).toContain('apresEnregistrement={rechargerExercices}');
  });

  it('une réponse d’un exercice quitté ou d’un envoi dépassé ne s’affiche pas · l’exercice visé est comparé (relecture 2)', () => {
    for (const source of [ficheR2, dates]) {
      const envoi = corps(source, 'enregistrer');
      expect(envoi).toContain('const moi = ++envoiCourant.current;');
      expect(envoi).toContain('const valable = () => moi === envoiCourant.current && exerciceAffiche.current === pour;');
      expect(envoi).toMatch(/if \(valable\(\)\) setInfo\(/);
      expect(envoi).toMatch(/if \(valable\(\)\) setErreur\(/);
    }
    const lecture = corps(exercice, 'charger');
    expect(lecture).toContain('if (exerciceVise.current !== exerciceId) return;');
    expect(lecture).toContain('const jeton = ++jetonCharger.current;');
    expect(lecture.match(/if \(jeton !== jetonCharger\.current \|\| exerciceVise\.current !== pour\) return;/g)).toHaveLength(2);
    // Le planning d'un autre exercice ne reste pas affiché.
    expect(exercice).toContain('setPlanning(null);');
  });

  it('les notes · même garde de l’exercice, dans les deux écrans', () => {
    for (const page of ['pages/NotesAnnexesPage.tsx', 'pages/NotesAnnexesSyscohadaPage.tsx']) {
      const source = lire(page);
      expect(source).toContain('const exerciceVise = useRef<string | null>(null);');
      expect(source).toMatch(/if \(mien === jeton\.current && exerciceVise\.current === pour\) setResultat\(r\);/);
      expect(source).toContain('setResultat(null);');
      expect(source).toContain('exerciceId: exerciceCourant.id, enCours');
    }
  });

  it('le planning montre en ambre un fait déclaré hors délai, et dit un jalon en attente', () => {
    expect(exercice).toContain('<span className={classeObservation(j.observation)}>');
    expect(exercice).toContain('libelleEcheance(j)');
  });

  it('en lecture, une case vide se dit « Non renseignée »', () => {
    expect(ficheR2).toContain("const vide = peutDeclarer ? undefined : 'Non renseignée';");
    expect(dates).toContain("iso === '' ? 'Non renseignée'");
  });
});

/**
 * DÉCISIONS PAR LA LOI DU 2026-10-07 · dissolution (point 2), dividende
 * prioritaire (point 3), fiche R2 (point 4) · ce que l'écran FAIT, lu dans le
 * corps des fonctions.
 */
describe('dissolution, dividende prioritaire et fiche R2 à l’écran', () => {
  it('l’arrêt et la fin de liquidation · routes du serveur, gestes de l’administrateur, réponse d’un exercice quitté jetée', () => {
    const arret = corps(exercice, 'arreterALaDissolution');
    expect(arret).toContain('`/exercices/${pour}/arreter-a-la-dissolution`');
    expect(arret).toContain('if (valable()) setErreur(');
    const fin = corps(exercice, 'reporterFinLiquidation');
    expect(fin).toContain('`/exercices/${pour}/fin-de-liquidation`, { dateFin: fin }');
    expect(fin).toContain('if (valable()) setErreur(');
    expect(exercice).toContain('{estAdmin && planning.dissolution.arretPropose && (');
    expect(exercice).toContain("{estAdmin && planning.dissolution.exerciceDeLiquidation && exercice.statut === 'OUVERT' && (");
  });

  it('la bulle de la dissolution dit l’impôt totalisé, l’arrêt qui déplace les écritures sans les changer, et la fin des acomptes', () => {
    const debut = exercice.indexOf('titre="Dissolution et liquidation"');
    const aide = exercice.slice(debut, exercice.indexOf('/>', debut));
    // Quatrième lot, point 2 · le calcul est fait, la bulle ne le renvoie plus au cabinet.
    expect(aide).toContain('se calcule une fois sur le total des deux résultats, moins la première cotisation et les acomptes');
    expect(aide).toContain('sans rien changer d’elles (ni date, ni numéro, ni lignes)');
    expect(aide).toContain('aucun acompte après l’échéance de la dernière cotisation');
    expect(aide).toContain('Loi n° 23/053, art. 11, 12 et 13 · LPF, art. 16, 57 bis et 110 bis');
  });

  it('quatrième lot · annuler l’arrêt et rattacher un exercice repris, routes du serveur, motif du refus montré, clés de jalon uniques', () => {
    const geste = corps(exercice, 'gesteDissolution');
    expect(geste).toContain('`/exercices/${pour}/${route}`');
    expect(geste).toContain('if (valable()) setErreur(');
    expect(exercice).toContain("'annuler-arret-dissolution',");
    expect(exercice).toContain("'rattacher-a-la-liquidation',");
    expect(exercice).toContain('{estAdmin && planning.dissolution.annulationProposee && (');
    expect(exercice).toContain('{estAdmin && planning.dissolution.rattachementPropose && (');
    // Constat 15 · le refus que le serveur opposerait se lit avant le clic.
    expect(exercice).toContain('{planning.dissolution.motifArret}');
    // Constat 14 · plusieurs situations annuelles partagent étape et libellé.
    expect(exercice).toContain('key={`${j.etape}-${j.libelle}-${j.debut ?? \'\'}`}');
  });

  it('impôt de l’année de la dissolution · montants servis par le serveur, écrits par lib/montants, l’excédent dit en rouge', () => {
    const fiscalite = lire('pages/FiscalitePage.tsx');
    const debut = fiscalite.indexOf('{resultat.bilansSuccessifs?.totalisation && (');
    expect(debut).toBeGreaterThan(-1);
    const bloc = fiscalite.slice(debut, fiscalite.indexOf('</table>', debut));
    for (const champ of ['totalisation.total', 'totalisation.impotTotal', 'premiereCotisation', 'totalisation.acomptesImputes', 'totalisation.secondeCotisation']) {
      expect(bloc).toContain(champ);
    }
    expect(bloc).toContain('{nombre(valeur)}');
    expect(bloc).toContain('totalisation.excedent > 0.005');
    expect(fiscalite).toContain('{resultat.bilansSuccessifs.motif}');
  });

  it('les dates du dividende ne partent qu’avec l’entreprise minière déclarée', () => {
    expect(dates).toContain('const dividende = portefeuille && secteurMinier;');
    for (const libelle of ['Dividende déclaré le', 'Note de perception reçue le', 'Dividende payé le']) {
      expect(gardeDuChamp(dates, libelle)).toBe('dividende');
    }
    const envoi = corps(dates, 'enregistrer');
    const bloc = envoi.slice(envoi.indexOf('...(dividende'));
    for (const champ of ['dateDeclarationDividendeEtat', 'dateNotePerceptionDividende', 'datePaiementDividendeEtat']) {
      expect(bloc).toContain(champ);
    }
    expect(proprietesDe(exercice, '<DatesPortefeuilleExercice')).toContain('planning.portefeuilleSecteurMinier === true');
  });

  it('le montant d’un jalon se dit dans la ligne du jalon, en rouge seulement quand il n’est pas calculé', () => {
    const ligne = exercice.slice(exercice.indexOf('planning.jalons.map((j) =>'), exercice.indexOf('</tbody>'));
    expect(ligne).toContain('libelleMontant(j)');
    expect(ligne).toContain("montantNonCalcule(j) ? 'text-danger' : ''");
    // L'en-tête compte les montants non calculés à côté des échéances.
    const entete = exercice.slice(exercice.indexOf('PLANNING DE CLÔTURE ·'), exercice.indexOf('</span>', exercice.indexOf('PLANNING DE CLÔTURE ·')));
    expect(entete).toContain('montantNonCalcule');
  });

  it('fiche R2 · ZN compte le siège, ZQ à ZS lus par l’art. 78, contrôle public PROPOSÉ (un clic remplit la case et y met le focus)', () => {
    expect(ficheR2).toContain('Le siège compte : il est considéré lui-même comme un établissement.');
    expect(ficheR2).toContain('source="AUDCIF art. 78 · loi n° 08/010, art. 3"');
    // Le libellé du bouton, dernier emploi du texte (le premier est un commentaire).
    const bouton = ficheR2.lastIndexOf('Reprendre la proposition');
    // La garde du bloc · l'expression JSX qui s'ouvre sur « {peutDeclarer ».
    const garde = ficheR2.slice(ficheR2.lastIndexOf('{peutDeclarer', bouton), ficheR2.indexOf('&& (', ficheR2.lastIndexOf('{peutDeclarer', bouton)));
    expect(garde).toContain("controle === ''");
    expect(garde).toContain('quotePartEtatCapital > 50');
    const geste = ficheR2.slice(ficheR2.lastIndexOf('onClick={() => {', bouton), bouton);
    expect(geste).toContain("setControle('PUBLIC');");
    expect(geste).toContain('caseControle.current?.focus();');
    expect(proprietesDe(ficheR2, '<select')).toContain('ref={caseControle}');
  });
});
