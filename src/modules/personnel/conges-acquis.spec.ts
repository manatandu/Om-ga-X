import {
  compteurConges,
  dernierJourOuvrableAvant,
  joursDuConge,
  moinsDeDixHuitAnsAu,
  motifRefusReprise,
  type CompteurConges,
  type FaitsDuCompteur,
} from './conges-acquis';
import { allocationDeConge, congeLegal, trancheDAnciennete } from './decompte-final';

/**
 * LIGNE SAGE-L5, FONCTION 79 · les congés acquis chaque mois. Chaque montant
 * attendu est calculé à la main depuis le Code du travail (art. 140 et 141)
 * et la décision T6 · aucun ne sort du moteur qu'il éprouve.
 */

const moisPayes = (du: string, au: string): string[] => {
  const sortie: string[] = [];
  let [a, m] = du.split('-').map(Number);
  const [af, mf] = au.split('-').map(Number);
  while (a < af || (a === af && m <= mf)) {
    sortie.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m === 13) {
      m = 1;
      a += 1;
    }
  }
  return sortie;
};

const base = (f: Partial<FaitsDuCompteur>): FaitsDuCompteur => ({
  origine: '2026-01-01',
  fin: null,
  dateNaissance: '1990-06-15',
  millesimeNaissance: null,
  moisPayes: [],
  joursHorsService: [],
  reprise: null,
  conges: [],
  aLa: '2026-10-14',
  ...f,
});

const ok = (r: CompteurConges | { refus: string }): CompteurConges => {
  if ('refus' in r) throw new Error(r.refus);
  return r;
};

describe('congés acquis chaque mois · art. 140 et 141 du Code du travail', () => {
  it("un mois de service révolu et payé donne un jour, un mois en cours rien encore", () => {
    // Entrée le 1er janvier, lecture le 14 octobre · janvier à septembre sont
    // révolus (neuf mois), octobre est en cours. Bulletins de janvier à
    // septembre émis.
    const c = ok(compteurConges(base({ moisPayes: moisPayes('2026-01', '2026-09') })));
    expect(c.periodes).toHaveLength(1);
    expect(c.periodes[0].etat).toBe('EN_COURS');
    expect(c.periodes[0].moisAcquis).toBe(9);
    expect(c.periodes[0].joursDeBase).toBe(9);
    // Aucun droit n'est né avant l'expiration de l'année (art. 140, al. 3).
    expect(c.droitsNes).toBe(0);
    expect(c.enCours).toBe(9);
    expect(c.solde).toBe(0);
  });

  it("le mois de service se compte de date à date · entré le 15, douze mois et non onze", () => {
    // Entrée le 15 mars 2025, lecture le 20 mars 2026 · la période du
    // 15 mars 2025 au 14 mars 2026 est révolue, ses douze mois sont payés
    // (bulletins de mars 2025 à mars 2026). Douze jours, nés le 15 mars 2026.
    const c = ok(
      compteurConges(
        base({ origine: '2025-03-15', aLa: '2026-03-20', moisPayes: moisPayes('2025-03', '2026-03') }),
      ),
    );
    expect(c.periodes[0]).toMatchObject({ du: '2025-03-15', au: '2026-03-14', etat: 'NEE', moisAcquis: 12, joursAcquis: 12 });
    expect(c.droitsNes).toBe(12);
  });

  it('un mois civil sans bulletin laisse le mois de service non acquis, et le dit', () => {
    const payes = moisPayes('2026-01', '2026-09').filter((m) => m !== '2026-04');
    const c = ok(compteurConges(base({ moisPayes: payes })));
    const avril = c.periodes[0].mois.find((m) => m.du === '2026-04-01');
    expect(avril?.statut).toBe('SANS_BULLETIN');
    expect(avril?.motif).toContain('2026-04');
    expect(c.periodes[0].moisAcquis).toBe(8);
    expect(c.signaux.some((s) => s.includes('sans bulletin'))).toBe(true);
  });

  it("le travailleur de moins de dix-huit ans acquiert un jour et demi par mois", () => {
    // Né le 1er juillet 2009 · dix-huit ans le 1er juillet 2027.
    const c = ok(compteurConges(base({ dateNaissance: '2009-07-01', moisPayes: moisPayes('2026-01', '2026-09') })));
    expect(c.periodes[0].joursDeBase).toBe(13.5);
  });

  it("l'âge que le registre ne dit pas rend le mois non chiffré, jamais un jour présumé", () => {
    // Millésime 2008 · en 2026, dix-huit ans dans l'année, sans savoir quand.
    const c = ok(
      compteurConges(base({ dateNaissance: null, millesimeNaissance: 2008, moisPayes: moisPayes('2026-01', '2026-09') })),
    );
    expect(c.periodes[0].joursDeBase).toBeNull();
    expect(c.enCours).toBeNull();
    expect(moinsDeDixHuitAnsAu(new Date('2026-05-01T00:00:00Z'), null, 2008)).toBeNull();
    expect(moinsDeDixHuitAnsAu(new Date('2026-05-01T00:00:00Z'), null, 1990)).toBe(false);
    expect(moinsDeDixHuitAnsAu(new Date('2026-05-01T00:00:00Z'), null, 2010)).toBe(true);
  });

  it("la tranche d'ancienneté naît avec la cinquième année, entière (décision T6)", () => {
    // Entré le 1er janvier 2021, tout payé jusqu'en septembre 2026, lecture le
    // 14 octobre 2026. Périodes 2021 à 2025 révolues · la cinquième (2025)
    // atteint cinq ans à son terme · 12 + 1. La sixième (2026) est en cours,
    // cinq années révolues · tranche entière dès un mois (T6) · 9 + 1.
    const c = ok(compteurConges(base({ origine: '2021-01-01', moisPayes: moisPayes('2021-01', '2026-09') })));
    expect(c.periodes.map((p) => p.joursAcquis)).toEqual([12, 12, 12, 12, 13, 10]);
    expect(c.droitsNes).toBe(61);
    expect(c.enCours).toBe(10);
    // Le même moteur que le décompte final · congeLegal d'une année révolue à
    // cinq ans d'ancienneté donne aussi 13.
    expect(congeLegal({ moisNonCouvertsParUnConge: 12, moinsDeDixHuitAns: false, anneesAnciennete: 5 }).joursOuvrables).toBe(13);
    expect(trancheDAnciennete(4.9)).toBe(0);
    expect(trancheDAnciennete(10)).toBe(2);
  });

  it('un jour hors service rend le mois non entier, avec son motif', () => {
    const c = ok(
      compteurConges(
        base({
          moisPayes: moisPayes('2026-01', '2026-09'),
          joursHorsService: [{ du: '2026-05-12', au: '2026-05-13', motif: 'Mise à pied disciplinaire' }],
        }),
      ),
    );
    const mai = c.periodes[0].mois.find((m) => m.du === '2026-05-01');
    expect(mai?.statut).toBe('NON_ENTIER');
    expect(mai?.motif).toContain('Mise à pied');
    expect(c.periodes[0].moisAcquis).toBe(8);
  });

  it('les congés pris se retranchent des droits nés, et le solde négatif dit l’anticipation', () => {
    const c = ok(
      compteurConges(
        base({
          origine: '2025-01-01',
          moisPayes: moisPayes('2025-01', '2026-09'),
          conges: [{ id: 'c1', du: '2026-02-02', jours: 14 }],
        }),
      ),
    );
    expect(c.droitsNes).toBe(12);
    expect(c.pris).toBe(14);
    expect(c.solde).toBe(-2);
  });

  it('les droits nés non pris six mois après leur naissance sont signalés (art. 140, al. 4)', () => {
    const c = ok(compteurConges(base({ origine: '2025-01-01', moisPayes: moisPayes('2025-01', '2026-09') })));
    // Nés le 1er janvier 2026, non pris au 14 octobre 2026.
    expect(c.signaux.some((s) => s.includes('article 140, alinéa 4') && s.includes('2026-01-01'))).toBe(true);
    // Pris en entier, rien à signaler.
    const pris = ok(
      compteurConges(
        base({ origine: '2025-01-01', moisPayes: moisPayes('2025-01', '2026-09'), conges: [{ id: 'c', du: '2026-03-02', jours: 12 }] }),
      ),
    );
    expect(pris.signaux.some((s) => s.includes('article 140, alinéa 4'))).toBe(false);
  });

  it('la reprise déclarée couvre ce qui précède sa date, les bulletins font le reste', () => {
    // Entré le 1er janvier 2020, repris au 30 juin 2026 · 7 jours nés non
    // pris, 6 mois accomplis dans la période en cours (janvier à juin, le
    // mois de juin finissant le jour même de la reprise). Bulletins de
    // juillet à septembre. Période 2026 · 6 mois déclarés + juillet, août,
    // septembre = 9 mois ; tranche à six années révolues · floor(6 / 5) = 1.
    const c = ok(
      compteurConges(
        base({
          origine: '2020-01-01',
          reprise: { arreteAu: '2026-06-30', joursNesNonPris: 7, moisEnCoursAccomplis: 6 },
          moisPayes: moisPayes('2026-07', '2026-09'),
          conges: [{ id: 'avant', du: '2026-03-02', jours: 3 }],
        }),
      ),
    );
    const enCours = c.periodes.find((p) => p.etat === 'EN_COURS');
    expect(enCours?.moisAcquis).toBe(9);
    expect(enCours?.joursAcquis).toBe(10);
    expect(c.droitsNes).toBe(7);
    // Le congé de mars précède la reprise · il est dans les 7 déclarés.
    expect(c.pris).toBe(0);
    expect(c.congesAvantReprise).toEqual(['avant']);
    expect(c.periodes.filter((p) => p.etat === 'REPRISE')).toHaveLength(6);
  });

  it('la reprise se refuse quand elle déclare plus de mois que la période n’en a vu', () => {
    expect(
      motifRefusReprise({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4, moisEnCoursAccomplis: 5, source: 'registre' }),
    ).toContain('3 mois');
    expect(
      motifRefusReprise({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4, moisEnCoursAccomplis: 3, source: 'registre' }),
    ).toBeNull();
    expect(
      motifRefusReprise({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4.25, moisEnCoursAccomplis: 3, source: 'registre' }),
    ).toContain('demi-jours');
    expect(motifRefusReprise({ origine: '2020-01-01', arreteAu: '2026-03-31', joursNesNonPris: 4, moisEnCoursAccomplis: 3, source: ' ' })).toContain(
      'source',
    );
  });

  it('la fin du service ferme la dernière période · les mois au-delà ne comptent pas', () => {
    const c = ok(compteurConges(base({ fin: '2026-06-15', moisPayes: moisPayes('2026-01', '2026-06') })));
    expect(c.periodes[0].etat).toBe('FIN_DE_SERVICE');
    expect(c.periodes[0].moisAcquis).toBe(5);
    expect(c.periodes[0].mois.find((m) => m.du === '2026-06-01')?.statut).toBe('HORS_CONTRAT');
  });
});

describe('jours d’un congé · art. 141, al. 3 et 4', () => {
  it('compte les jours ouvrables du Code, samedi compris, dimanche et fériés exclus', () => {
    // Du lundi 3 août au samedi 15 août 2026 · aucun férié (le 1er août est un
    // samedi, hors période) · 12 jours ouvrables.
    expect(joursDuConge({ du: '2026-08-03', au: '2026-08-15', joursVoyage: 0, joursMaladie: new Set() })).toEqual({
      jours: 12,
      ouvrables: 12,
      maladie: 0,
    });
    // Du 29 juin au 4 juillet 2026 · le 30 juin est férié · 5 ouvrables.
    expect(joursDuConge({ du: '2026-06-29', au: '2026-07-04', joursVoyage: 0, joursMaladie: new Set() })).toMatchObject({ jours: 5 });
  });

  it('retranche les jours de maladie et les jours de voyage déclarés', () => {
    expect(
      joursDuConge({ du: '2026-08-03', au: '2026-08-15', joursVoyage: 2, joursMaladie: new Set(['2026-08-05', '2026-08-06']) }),
    ).toEqual({ jours: 8, ouvrables: 10, maladie: 2 });
  });

  it('refuse plus de jours de voyage que de jours ouvrables', () => {
    expect(joursDuConge({ du: '2026-08-03', au: '2026-08-04', joursVoyage: 3, joursMaladie: new Set() })).toHaveProperty('refus');
  });

  it("l'allocation se paie au plus tard le dernier jour ouvrable avant le départ (art. 145)", () => {
    // Départ le lundi 3 août 2026 · le samedi 1er août est férié, le
    // dimanche 2 aussi exclu · vendredi 31 juillet.
    expect(dernierJourOuvrableAvant('2026-08-03')).toBe('2026-07-31');
  });
});

describe("l'allocation de l'art. 142 · un seul moteur avec le décompte final", () => {
  it('jours × (taux journalier + moyenne mensuelle / 26)', () => {
    // 12 jours, 20 000 FC par jour, moyenne de 52 000 FC par mois · 12 ×
    // (20 000 + 2 000) = 264 000.
    expect(allocationDeConge({ jours: 12, remunerationJournaliereFc: 20_000, moyenneMensuelleArticle142Fc: 52_000 })).toEqual({
      montantFc: 264_000,
      tauxJournalierFc: 22_000,
      motif: null,
    });
  });

  it('rend null avec son motif, jamais zéro, quand un élément manque', () => {
    expect(allocationDeConge({ jours: 12, remunerationJournaliereFc: null, moyenneMensuelleArticle142Fc: 0 }).montantFc).toBeNull();
    expect(allocationDeConge({ jours: 12, remunerationJournaliereFc: 20_000, moyenneMensuelleArticle142Fc: null }).motif).toContain(
      'zéro est une réponse',
    );
  });
});
