// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import {
  attentesSurLaPiece,
  enfiler,
  fenetresPresentes,
  lignesAEcheancierDecale,
  motifEcheanciersDecales,
  signatureDecalage,
  centimesSaisis,
  decouperLigne,
  echeancesNonNulles,
  echeancesSaisissables,
  etatDeLaLigneAttendue,
  motifEcheanciersEnAttente,
  motifEcheancesSaisies,
  porteUneEcheance,
} from './echeance-saisie';

/**
 * LA LIGNE DÉCOUPÉE PAR L'ÉCHÉANCIER (ligne sage-l2, fonction 3) · ce que ces
 * tests empêchent · une pièce qui ne s'équilibre plus parce que les
 * échéances retouchées ne refont pas la ligne au centime, une échéance à zéro
 * devenue ligne vide, une facture au crédit découpée au débit.
 */
describe('la zone de l’échéance', () => {
  it('ne s’ouvre que sur un compte de tiers', () => {
    expect(porteUneEcheance('40110001')).toBe(true);
    expect(porteUneEcheance('60110000')).toBe(false);
    expect(porteUneEcheance(null)).toBe(false);
  });
});

describe('les échéances retouchées', () => {
  const e = (montant: string, dateEcheance = '2027-01-09', modeReglementId = '') => ({ montant, dateEcheance, modeReglementId });

  it('un montant tapé avec espaces et virgule se lit au centime', () => {
    expect(centimesSaisis('580 000,50')).toBe(58_000_050);
    expect(centimesSaisis('12.345')).toBeNull();
    expect(centimesSaisis('abc')).toBeNull();
  });

  it('refont la ligne au centime, sinon l’écart est dit', () => {
    expect(motifEcheancesSaisies([e('580000'), e('580000')], 1_160_000)).toBeNull();
    expect(motifEcheancesSaisies([e('580000'), e('579999.99')], 1_160_000)).toContain('écart de 0,01');
  });

  it('une échéance à zéro, illisible ou sans date est refusée', () => {
    expect(motifEcheancesSaisies([e('0'), e('1160000')], 1_160_000)).toContain('positif');
    expect(motifEcheancesSaisies([e('x')], 1_160_000)).toContain('illisible');
    expect(motifEcheancesSaisies([e('1160000', '')], 1_160_000)).toContain('date');
  });

  it('une ligne par échéance, au sens de la ligne d’origine, chacune sa date et son mode', () => {
    const ligne = { compteId: 'c', libelle: 'Facture', debit: 0, credit: 1_160_000, cle: 'k' };
    const r = decouperLigne(ligne, [e('580000', '2027-01-09', 'mVir'), e('580000', '2027-02-08')], (id) => (id === 'mVir' ? 'VIR' : undefined));
    expect(r).toEqual([
      { compteId: 'c', libelle: 'Facture', debit: 0, credit: 580_000, cle: 'k', dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' },
      { compteId: 'c', libelle: 'Facture', debit: 0, credit: 580_000, cle: 'k-2', dateEcheance: '2027-02-08', modeReglementId: undefined, modeCode: undefined },
    ]);
  });

  it('le mode choisi à la main sur la ligne prime sur celui du modèle', () => {
    const ech = [{ ordre: 1, montant: 100, dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' }];
    expect(echeancesSaisissables(ech, { id: 'mChq', code: 'CHQ' })[0]).toEqual(expect.objectContaining({ modeReglementId: 'mChq', modeCode: 'CHQ' }));
    expect(echeancesSaisissables(ech, undefined)[0]).toEqual({ montant: '100.00', dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' });
  });

  // RELECTURE « ÉCHECS SILENCIEUX », m3 · la liste des modes non lue faisait
  // dire « Non précisé » d'une échéance qui partait avec le mode du modèle.
  it('le mode servi garde son code, et le découpage le reprend quand la liste n’est pas lue', () => {
    const ech = [{ ordre: 1, montant: 100, dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' }];
    const [saisie] = echeancesSaisissables(ech, undefined);
    const [ligne] = decouperLigne({ debit: 0, credit: 100, cle: 'k' }, [saisie], () => undefined);
    expect(ligne).toEqual(expect.objectContaining({ modeReglementId: 'mVir', modeCode: 'VIR' }));
  });
});

describe('l’échéancier attendu (relecture « échecs silencieux », M1 et m1)', () => {
  it('écarte les échéances nulles · un 100 % suivi d’un Équilibre ne fait qu’une échéance', () => {
    const ech = [
      { ordre: 1, montant: 1_160_000, dateEcheance: '2027-01-09', modeReglementId: null, modeCode: null },
      { ordre: 2, montant: 0, dateEcheance: '2027-02-08', modeReglementId: null, modeCode: null },
    ];
    expect(echeancesNonNulles(ech)).toEqual([ech[0]]);
  });

  it('la ligne attendue · absente (retirée, pièce abandonnée), changée (montant, sens), ou intacte', () => {
    const attendue = { cle: 'l3', montant: 1_160_000, sens: 'CREDIT' as const };
    expect(etatDeLaLigneAttendue([], attendue)).toBe('ABSENTE');
    expect(etatDeLaLigneAttendue([{ cle: 'l2', debit: 0, credit: 1_160_000 }], attendue)).toBe('ABSENTE');
    expect(etatDeLaLigneAttendue([{ cle: 'l3', debit: 1_160_000, credit: 0 }], attendue)).toBe('CHANGEE');
    expect(etatDeLaLigneAttendue([{ cle: 'l3', debit: 0, credit: 1_000_000 }], attendue)).toBe('CHANGEE');
    expect(etatDeLaLigneAttendue([{ cle: 'l3', debit: 0, credit: 1_160_000 }], attendue)).toBe('INTACTE');
  });

  it('la pièce ne part pas tant qu’un échéancier est attendu, ni qu’un découpage reste à décider', () => {
    expect(motifEcheanciersEnAttente(0)).toBeNull();
    expect(motifEcheanciersEnAttente(1)).toMatch(/en cours de lecture/);
    expect(motifEcheanciersEnAttente(0, 1)).toMatch(/Une ligne attend son découpage/);
    expect(motifEcheanciersEnAttente(0, 2)).toMatch(/^2 lignes attendent/);
  });
});

describe('second tour de relecture · l’attente, la file et la date (M1, M2, mineur 3)', () => {
  it('une clé attendue ne retient la pièce que si sa ligne y est encore', () => {
    expect(attentesSurLaPiece(['l1', 'l2', 'l2'], [{ cle: 'l2' }, { cle: 'l3' }])).toBe(1);
    expect(attentesSurLaPiece(['l1'], [])).toBe(0);
  });

  const f = (cle: string, compte: string) => ({ cle, compte, libelle: 'F', montant: 100, modele: 'M', initiales: [], du: '2026-03-01' });
  it('une seconde réponse s’ajoute à la file, sans écraser la fenêtre de la première ligne', () => {
    const file = enfiler(enfiler([], f('A', '40110001')), f('B', '40110002'));
    expect(file.map((x) => x.cle)).toEqual(['A', 'B']);
    // Une nouvelle réponse pour A remplace la sienne, et elle seule.
    expect(enfiler(file, { ...f('A', '40110001'), montant: 200 }).map((x) => [x.cle, x.montant])).toEqual([
      ['B', 100],
      ['A', 200],
    ]);
    expect(fenetresPresentes(file, [{ cle: 'B' }]).map((x) => x.cle)).toEqual(['B']);
  });

  it('nomme les lignes dont l’échéancier vient d’une autre date, ou n’a pas été calculé', () => {
    const lignes = [
      { numero: '40110001', echeancierDu: '2026-03-01' },
      { numero: '40110002', echeancierDu: '2026-03-15' },
      { numero: '40110003', echeancierNonCalcule: true },
      { numero: '60110000' },
    ];
    const decales = lignesAEcheancierDecale(lignes, '2026-03-15');
    expect(decales).toEqual([
      { numero: '40110001', du: '2026-03-01' },
      { numero: '40110003', du: null },
    ]);
    expect(motifEcheanciersDecales(decales, '2026-03-15')).toBe(
      'Échéancier du tiers à revoir · la pièce est datée du 15/03/2026 · 40110001 (calculé au 01/03/2026), 40110003 (non calculé). ' +
        'Retirez et ressaisissez ces lignes pour le recalculer, ou enregistrez-les avec ces échéances.',
    );
    expect(motifEcheanciersDecales([], '2026-03-15')).toBeNull();
    expect(signatureDecalage(decales, '2026-03-15')).not.toBe(signatureDecalage(decales, '2026-03-16'));
  });
});

// LE CÂBLAGE DANS LA FENÊTRE DE SAISIE (relecture « échecs silencieux » de la
// ligne sage-l2) · la règle pure est juste, encore faut-il que la saisie
// l'appelle. Le corps de la fonction se découpe par ses bornes, jamais par une
// distance ; on gèle une PRÉSENCE.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('câblage de l’échéancier dans la saisie', () => {
  const src = readFileSync(join(__dirname, '..', 'pages', 'SaisiePage.tsx'), 'utf8');
  const debut = src.indexOf('const appliquerEcheancier = async');
  const fin = src.indexOf('const appliquerDecoupage = ', debut);
  const corps = src.slice(debut, fin);

  it('M1 · l’échéancier attendu se compte PAR LIGNE, et sa réponse ne vaut que pour une ligne encore là, intacte', () => {
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    expect(corps).toMatch(/setClesEnLecture\(\(c\) => \[\.\.\.c, l\.cle\]\)/);
    expect(corps).toMatch(/finally \{\s*setClesEnLecture\(/);
    expect(corps).toMatch(/etatDeLaLigneAttendue\(lignesRef\.current, l\)/);
    expect(corps).toMatch(/if \(etat === 'ABSENTE'\) return;/);
    expect(src).toMatch(/const echeanciersEnAttente = attentesSurLaPiece\(clesEnLecture, lignes\)/);
  });

  it('M1 et mineur 2 · les fenêtres attendues font une FILE, annoncée, jamais ouverte d’office, chacune avec SA clé', () => {
    expect(corps).toMatch(/setFileEcheances\(\(file\) => enfiler\(file, /);
    expect(corps).not.toMatch(/setFenetreOuverte\(true\)/);
    expect(src).toMatch(/Ouvrir les échéances/);
    expect(src).toMatch(/<FenetreEcheances\s+key=\{fenetresAttendues\[0\]\.cle\}/);
  });

  it('M1 · la pièce ne part pas tant qu’un échéancier est attendu ou qu’un découpage reste à décider', () => {
    expect(src).toMatch(/disabled=\{envoi \|\| !equilibree \|\| echeanciersEnAttente > 0 \|\| fenetresAttendues\.length > 0\}/);
    expect(src).toMatch(/motifEcheanciersEnAttente\(echeanciersEnAttente, fenetresAttendues\.length\)/);
  });

  it('M2 · sans date, l’échéancier n’est pas calculé et c’est dit ; la date venue, il se calcule ; décalé, il se nomme', () => {
    expect(corps).toMatch(/échéancier non calculé · indiquez d'abord la date de la pièce/);
    expect(corps).toMatch(/echeancierDu: du/);
    expect(src).toMatch(/\}, \[dateCourante\]\);/);
    expect(src).toMatch(/const decales = lignesAEcheancierDecale\(lignes, datee\.date\)/);
    expect(src).toMatch(/Enregistrer avec ces échéances/);
  });

  it('mineur 4 · le mode habituel ne va qu’à la ligne d’une facture, se joint au motif, et se retire', () => {
    expect(corps).toMatch(/const mode = r\.applicable && !l\.modeTape \? r\.modeHabituel : null;/);
    expect(corps).toMatch(/dites\.join\(' · '\)/);
    expect(src).toMatch(/Retirer le mode \{modeDOffice\.code\}/);
  });

  it('mineur 5 · la proposition de TVA vise sa ligne par sa clé', () => {
    expect(src).toMatch(/const ligneHt = lignes\.find\(\(x\) => x\.cle === propositionTva\.cle\);/);
  });

  it('mineur 16 · Entrée valide la ligne depuis l’échéance et le mode', () => {
    for (const etiquette of ['aria-label="Échéance de la ligne"', 'aria-label="Mode de règlement de la ligne"']) {
      const i = src.indexOf(etiquette);
      const champ = src.slice(i, src.indexOf('className=', i));
      expect([etiquette, /validerLigne\(\)/.test(champ)]).toEqual([etiquette, true]);
    }
  });

  it('m1 · les échéances nulles sont écartées, et le chemin d’office passe par la règle de la fenêtre', () => {
    expect(corps).toMatch(/echeancesNonNulles\(r\.echeances\)/);
    expect(corps).toMatch(/motifEcheancesSaisies\(initiales, l\.montant\)/);
  });

  it('m2 · la copie par Ctrl+D reçoit son propre repère', () => {
    expect(src).toMatch(/\{ \.\.\.derniere, \.\.\.SANS_DEVISE, debit: 0, credit: 0, cle, sections:/);
  });

  it('m3 et m4 · la fenêtre reçoit la liste lue et son échec, et sa fermeture se dit', () => {
    expect(src).toMatch(/modes=\{modesLus\}\s*erreurModes=\{erreurModes\}/);
    expect(src).toMatch(/ligne gardée entière, sans échéance/);
  });
});
