import {
  absencesPourLeCompteur,
  joursDeLAbsence,
  joursOuvrables,
  joursOuvrablesDuMois,
  motifRefusAbsence,
  motifRefusIndemniteCaisse,
  NATURES_ABSENCE,
  propositionDuMois,
  type AbsenceLue,
  type NatureAbsence,
} from './absences';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 1 · CE QUI CASSERAIT EN SILENCE · une
 * absence payée qui ne l'est pas (art. 93), des deux tiers servis au-delà des
 * six mois de l'art. 106, un congé de circonstance payé au-delà de quinze
 * jours (art. 146), une cause de suspension chiffrée alors que l'arrêté de
 * l'art. 58 n'est pas au corpus, une maladie de huit mois comptée comme
 * service entier (art. 141, al. 2).
 */

let n = 0;
const absence = (nature: NatureAbsence, du: string, au: string, p: Partial<AbsenceLue> = {}): AbsenceLue => ({
  id: `a-${(n += 1)}`,
  nature,
  du,
  au,
  demiJourneeDebut: false,
  demiJourneeFin: false,
  ...p,
});
const refus = (a: AbsenceLue, p: { evenement?: string | null; piece?: string | null } = {}, autres: AbsenceLue[] = []) =>
  motifRefusAbsence({ ...a, evenement: p.evenement ?? null, piece: p.piece ?? null }, autres);

describe('les jours d’une absence · jours ouvrables du Code, demi-journées', () => {
  it('du lundi au samedi, six jours ; une demi-journée au premier jour en retranche une moitié', () => {
    const j = joursDeLAbsence(absence('ABSENCE_NON_AUTORISEE', '2026-08-03', '2026-08-08'));
    expect('refus' in j ? null : joursOuvrables(j)).toBe(6);
    const d = joursDeLAbsence(absence('ABSENCE_NON_AUTORISEE', '2026-08-03', '2026-08-08', { demiJourneeDebut: true }));
    expect('refus' in d ? null : joursOuvrables(d)).toBe(5.5);
    const seul = joursDeLAbsence(absence('ABSENCE_NON_AUTORISEE', '2026-08-04', '2026-08-04', { demiJourneeDebut: true, demiJourneeFin: true }));
    expect('refus' in seul ? null : joursOuvrables(seul)).toBe(0.5);
  });

  it('un jour férié de l’absence n’est pas un jour ouvrable (30 juin 2026)', () => {
    const j = joursDeLAbsence(absence('ABSENCE_NON_AUTORISEE', '2026-06-29', '2026-07-04'));
    expect('refus' in j ? null : joursOuvrables(j)).toBe(5);
  });

  it('avant le 30 mars 2023, les fériés ne sont pas au corpus · refus nommé', () => {
    expect(joursDeLAbsence(absence('ABSENCE_NON_AUTORISEE', '2023-01-02', '2023-01-03'))).toEqual({ refus: expect.stringContaining('23-042') });
  });
});

describe('ce que le texte borne lui-même', () => {
  it('congé de circonstance · l’événement se déclare, ses jours ne se dépassent pas, il ne se fractionne pas en demi-journées', () => {
    const mariage = absence('CONGE_DE_CIRCONSTANCE', '2026-08-03', '2026-08-05');
    expect(refus(mariage)).toContain("l'événement se déclare");
    expect(refus(mariage, { evenement: 'MARIAGE_DU_TRAVAILLEUR' })).toContain('ouvre 2 jour(s)');
    expect(refus(absence('CONGE_DE_CIRCONSTANCE', '2026-08-03', '2026-08-04'), { evenement: 'MARIAGE_DU_TRAVAILLEUR' })).toBeNull();
    expect(refus(absence('CONGE_DE_CIRCONSTANCE', '2026-08-03', '2026-08-04', { demiJourneeFin: true }), { evenement: 'MARIAGE_DU_TRAVAILLEUR' })).toContain(
      'demi-journées',
    );
  });

  it('mise à pied · quinze jours au plus, deux par an, sur sa décision', () => {
    expect(refus(absence('MISE_A_PIED', '2026-08-03', '2026-08-18'), { piece: 'Décision n° 4' })).toContain('16 jours');
    expect(refus(absence('MISE_A_PIED', '2026-08-03', '2026-08-05'))).toContain('décision de mise à pied');
    const deux = [absence('MISE_A_PIED', '2026-02-02', '2026-02-04'), absence('MISE_A_PIED', '2026-05-04', '2026-05-06')];
    expect(refus(absence('MISE_A_PIED', '2026-08-03', '2026-08-05'), { piece: 'Décision n° 5' }, deux)).toContain('2 mesure(s)');
  });

  it('maternité · quatorze semaines au plus, en jours entiers ; maladie · certificat exigé', () => {
    expect(refus(absence('MATERNITE', '2026-03-02', '2026-06-08'), { piece: 'Certificat' })).toContain('quatorze semaines');
    expect(refus(absence('MATERNITE', '2026-03-02', '2026-06-07'), { piece: 'Certificat' })).toBeNull();
    expect(refus(absence('MALADIE_OU_ACCIDENT', '2026-03-02', '2026-03-04'))).toContain('certificat médical');
  });

  it('une journée n’a qu’une cause · deux absences ne se chevauchent pas', () => {
    const autre = absence('ABSENCE_NON_AUTORISEE', '2026-08-05', '2026-08-06');
    expect(refus(absence('MALADIE_OU_ACCIDENT', '2026-08-03', '2026-08-05'), { piece: 'Certificat' }, [autre])).toContain('chevauche');
  });
});

describe('la proposition du mois · un salaire au mois de 520 000', () => {
  it('l’absence non autorisée retranche 1/26 par jour ouvrable (art. 93) · 520 000 × 24 / 26 = 480 000', () => {
    const jours = joursOuvrablesDuMois([absence('ABSENCE_NON_AUTORISEE', '2026-08-04', '2026-08-05')], '2026-08');
    const p = propositionDuMois({ jours, salaireMensuel: 520_000, moyenneMensuelleArticle66: null });
    expect([p.joursNonDus, p.joursPayesAPlein, p.salaireDesJoursDus, p.indemniteDeuxTiers]).toEqual([2, 24, 480_000, 0]);
  });

  it('la maladie rend ses deux tiers sur le salaire et la moyenne de l’art. 66 (art. 105) · sans moyenne, rien ne se chiffre', () => {
    const jours = joursOuvrablesDuMois(
      [absence('ABSENCE_NON_AUTORISEE', '2026-08-04', '2026-08-05'), absence('MALADIE_OU_ACCIDENT', '2026-08-10', '2026-08-12')],
      '2026-08',
    );
    const p = propositionDuMois({ jours, salaireMensuel: 520_000, moyenneMensuelleArticle66: 0 });
    expect([p.joursDeuxTiers, p.salaireDesJoursDus, p.indemniteDeuxTiers]).toEqual([3, 420_000, 40_000]);
    const avecMoyenne = propositionDuMois({ jours, salaireMensuel: 520_000, moyenneMensuelleArticle66: 78_000 });
    expect(avecMoyenne.indemniteDeuxTiers).toBe(46_000);
    const sansMoyenne = propositionDuMois({ jours, salaireMensuel: 520_000, moyenneMensuelleArticle66: null });
    expect(sansMoyenne.indemniteDeuxTiers).toBeNull();
    expect(sansMoyenne.motifs.join(' ')).toContain('art. 66');
  });

  it('une cause dont l’arrêté de l’art. 58 manque ne se chiffre pas, ni le reste du mois', () => {
    const jours = joursOuvrablesDuMois([absence('MISE_A_PIED', '2026-08-04', '2026-08-05')], '2026-08');
    const p = propositionDuMois({ jours, salaireMensuel: 520_000, moyenneMensuelleArticle66: 0 });
    expect([p.joursNonTranches, p.salaireDesJoursDus, p.joursPayesAPlein]).toEqual([2, null, null]);
    expect(NATURES_ABSENCE.MISE_A_PIED.regime).toBe('ARRETE_ABSENT');
  });

  it('un contrat qui n’est pas au mois ne reçoit aucune proposition', () => {
    const jours = joursOuvrablesDuMois([absence('ABSENCE_NON_AUTORISEE', '2026-08-04', '2026-08-04')], '2026-08');
    expect(propositionDuMois({ jours, salaireMensuel: null, moyenneMensuelleArticle66: 0 }).salaireDesJoursDus).toBeNull();
  });

  it('le congé de circonstance n’est payé que jusqu’à quinze jours ouvrables par an (art. 146)', () => {
    const quatre = [
      absence('CONGE_DE_CIRCONSTANCE', '2026-02-02', '2026-02-05'),
      absence('CONGE_DE_CIRCONSTANCE', '2026-03-02', '2026-03-05'),
      absence('CONGE_DE_CIRCONSTANCE', '2026-04-13', '2026-04-16'),
      absence('CONGE_DE_CIRCONSTANCE', '2026-08-03', '2026-08-06'),
    ];
    const aout = joursOuvrablesDuMois(quatre, '2026-08');
    expect(aout.map((j) => j.regime)).toEqual(['DUE', 'DUE', 'DUE', 'NON_DUE']);
  });

  it('l’accident du travail n’est aux deux tiers que les six premiers mois (art. 106) · au-delà, rien n’est dû par l’employeur', () => {
    const at = [absence('ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', '2026-01-05', '2026-08-31')];
    expect(new Set(joursOuvrablesDuMois(at, '2026-06').map((j) => j.regime))).toEqual(new Set(['DEUX_TIERS']));
    const juillet = joursOuvrablesDuMois(at, '2026-07');
    expect(juillet.find((j) => j.jour === '2026-07-04')?.regime).toBe('DEUX_TIERS');
    expect(juillet.find((j) => j.jour === '2026-07-06')?.regime).toBe('NON_DUE');
  });
});

describe('ce que les absences font au compteur des congés (art. 141, al. 2 et 4)', () => {
  it('l’absence non autorisée est hors service, la maladie compte et se retranche d’un congé', () => {
    const r = absencesPourLeCompteur(
      [absence('ABSENCE_NON_AUTORISEE', '2026-03-03', '2026-03-03'), absence('MALADIE_OU_ACCIDENT', '2026-04-06', '2026-04-08')],
      '2026-01-01',
    );
    expect(r.joursHorsService).toEqual([{ du: '2026-03-03', au: '2026-03-03', motif: expect.stringContaining('Absence non autorisée') }]);
    expect([...r.joursMaladie]).toEqual(['2026-04-06', '2026-04-07', '2026-04-08']);
  });

  it('l’incapacité compte à concurrence de six mois par année de service · au-delà, hors service ; l’accident du travail sans limite', () => {
    const r = absencesPourLeCompteur([absence('MALADIE_OU_ACCIDENT', '2026-01-05', '2026-08-31')], '2026-01-01');
    expect(r.joursHorsService).toEqual([{ du: '2026-07-05', au: '2026-08-31', motif: expect.stringContaining('six mois') }]);
    const at = absencesPourLeCompteur([absence('ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', '2026-01-05', '2026-08-31')], '2026-01-01');
    expect(at.joursHorsService).toEqual([]);
  });
});

describe('étape 3 · les indemnités journalières de la Caisse sur un arrêt', () => {
  const ij = (p: Partial<Parameters<typeof motifRefusIndemniteCaisse>[0]> = {}) =>
    motifRefusIndemniteCaisse({
      nature: 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE',
      du: '2026-08-03',
      au: '2026-09-30',
      mois: '2026-08',
      montant: 25_000,
      traitement: 'DEDUITE',
      piece: 'Bordereau CNSS n° 12',
      dejaDeclareCeMois: false,
      ...p,
    });

  it('chaque traitement a son texte · la maladie n’en ouvre aucun, la déduction est à l’accident du travail, la subrogation partielle à la maternité', () => {
    expect(ij()).toBeNull();
    expect(ij({ nature: 'MALADIE_OU_ACCIDENT' })).toContain('aucune indemnité journalière de la Caisse');
    expect(ij({ nature: 'MATERNITE' })).toContain('art. 106, al. 2');
    expect(ij({ traitement: 'SUBROGATION_PARTIELLE' })).toContain('art. 139, al. 3');
    expect(ij({ nature: 'MATERNITE', traitement: 'SUBROGATION_PARTIELLE' })).toBeNull();
    expect(ij({ mois: '2026-10' })).toContain("hors de l'arrêt");
    expect(ij({ piece: '' })).toContain('pièce');
    expect(ij({ dejaDeclareCeMois: true })).toContain('déjà déclarée');
  });

  it('déduite (art. 106, al. 2), elle réduit l’indemnité de SON arrêt, jamais au-delà · 60 000 − 25 000', () => {
    const at = absence('ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', '2026-08-10', '2026-08-12');
    const jours = joursOuvrablesDuMois([at], '2026-08');
    const p = propositionDuMois({ jours, salaireMensuel: 780_000, moyenneMensuelleArticle66: 0, deductionsParAbsence: new Map([[at.id, 25_000]]) });
    expect([p.indemniteDeuxTiers, p.deductionsCaisse]).toEqual([35_000, 25_000]);
    const trop = propositionDuMois({ jours, salaireMensuel: 780_000, moyenneMensuelleArticle66: 0, deductionsParAbsence: new Map([[at.id, 100_000]]) });
    expect([trop.indemniteDeuxTiers, trop.deductionsCaisse]).toEqual([0, 60_000]);
  });

  it('sous subrogation totale, les jours de l’arrêt sont payés à plein et l’indemnité est à recevoir de la Caisse', () => {
    const maternite = absence('MATERNITE', '2026-08-03', '2026-08-08');
    const jours = joursOuvrablesDuMois([maternite], '2026-08', new Set([maternite.id]));
    expect(new Set(jours.map((j) => j.regime))).toEqual(new Set(['DUE']));
    const p = propositionDuMois({ jours, salaireMensuel: 780_000, moyenneMensuelleArticle66: null, aRecevoirDeLaCaisse: 180_000 });
    expect([p.salaireDesJoursDus, p.indemniteDeuxTiers, p.aRecevoirDeLaCaisse]).toEqual([780_000, 0, 180_000]);
  });
});
