import { remunerationDuDelai } from './remuneration-du-delai';
import { decompteFinal, joursOuvrablesDeTroisMois, type ParametresDecompte } from './decompte-final';

/**
 * RELECTURE B1 (2026-10-07) · T9 AU MOIS, LE DÉBUT DU DÉLAI.
 *
 * Les « mois entiers » d'un salaire mensuel se comptaient depuis le premier
 * jour PAYABLE de la fenêtre. Le délai court « à dater du lendemain de la
 * notification » (Code du travail, art. 64, al. 1) · notifié un samedi, il
 * commence un dimanche, et partir du lundi décalait chaque mois d'un jour, au
 * détriment du travailleur. Les mois se comptent désormais depuis le premier
 * jour CIVIL de la fenêtre. Specs du relecteur, repris dans le dépôt.
 */
const M = 1_040_000;

const auMois = (du: string, joursOuvrables: number, de = 0, auExclu: string | null = null, moyenne = 0) => {
  const r = remunerationDuDelai({
    delai: { du, auExclu },
    joursOuvrables,
    de,
    a: joursOuvrables,
    journaliereFc: null,
    mensuelleFc: M,
    moyenneMensuelleFc: moyenne,
  });
  if ('refus' in r) throw new Error(r.refus);
  return r;
};

/** Délégué syndical de trois ans, au mois · le plancher de trois mois de l'art. 258, de date à date. */
const DELEGUE: ParametresDecompte = {
  anneesAnciennete: 3,
  delegueSyndical: true,
  moisNonCouvertsParUnConge: 10,
  moinsDeDixHuitAns: false,
  initiative: 'EMPLOYEUR',
  motif: 'LICENCIEMENT',
  typeContrat: 'DUREE_INDETERMINEE',
  executionPreavis: 'DISPENSE_PAR_EMPLOYEUR',
  dateNotification: '2026-05-02',
  remunerationJournaliereFc: 40_000,
  remunerationMensuelleFc: M,
  moyenneMensuelleArticle66Fc: 52_000,
  moyenneMensuelleArticle142Fc: 52_000,
  avantagesPendantPreavisFc: 0,
  arrieresFc: 0,
  gratificationFc: 0,
  enfantsBeneficiairesAllocations: 0,
};
const preavisDe = (p: ParametresDecompte) => decompteFinal(p).rubriques.find((r) => r.cle === 'preavis')!;

describe('B1 · les mois entiers se comptent du lendemain de la notification, dimanche compris', () => {
  it('délégué notifié le samedi 2 mai 2026 · trois mois du 3 mai au 3 août exclu, 3 × 1 092 000 = 3 276 000 (et non 3 234 000)', () => {
    expect(joursOuvrablesDeTroisMois('2026-05-02')).toMatchObject({ du: '2026-05-03', auExclu: '2026-08-03' });
    const samedi = preavisDe(DELEGUE);
    expect(samedi.montantFc).toBe(3_276_000);
    // Notifié le dimanche 3 mai · délai du lundi 4 mai, même somme.
    expect(preavisDe({ ...DELEGUE, dateNotification: '2026-05-03' }).montantFc).toBe(3_276_000);
  });

  it('le même délai au calcul brut · trois mois entiers, aucun jour de mois entamé', () => {
    const trois = joursOuvrablesDeTroisMois('2026-05-02');
    if (!('jours' in trois)) throw new Error('délai non placé');
    const r = auMois(trois.du, trois.jours, 0, trois.auExclu);
    expect(r.moisEntiers).toBe(3);
    expect(r.joursDuMoisEntame).toBe(0);
    expect(r.montantFc).toBe(3 * M);
  });

  it('63 jours ouvrables courant du dimanche 3 mai 2026 · deux mois du 3 mai au 2 juillet, 13 jours du 3 au 17 juillet, 2 600 000 (et non 2 560 000)', () => {
    const dimanche = auMois('2026-05-03', 63);
    expect(dimanche.au).toBe('2026-07-17');
    expect(dimanche.moisEntiers).toBe(2);
    expect(dimanche.joursDuMoisEntame).toBe(13);
    expect(dimanche.montantFc).toBe(2_600_000);
    // Courant du lundi 4 mai · deux mois du 4 mai au 3 juillet, 12 jours du 4 au 17 juillet.
    const lundi = auMois('2026-05-04', 63);
    expect(lundi.moisEntiers).toBe(2);
    expect(lundi.joursDuMoisEntame).toBe(12);
    expect(lundi.montantFc).toBe(2_560_000);
  });

  it('une fenêtre en cours de délai part du lendemain du dernier jour ouvrable écoulé · le samedi 9 mai écoulé, les mois partent du dimanche 10', () => {
    // Délai du 5 mai 2026, 63 jours ouvrables jusqu'au 18 juillet ; cinq
    // écoulés (5 au 9 mai). Deux mois du 10 mai au 9 juillet, puis 10, 11 et
    // 13 au 18 juillet · 8 jours, 2 400 000 (partir du lundi 11 rendait
    // 7 jours, 2 360 000).
    const r = auMois('2026-05-05', 63, 5);
    expect(r.du).toBe('2026-05-11');
    expect(r.au).toBe('2026-07-18');
    expect(r.moisEntiers).toBe(2);
    expect(r.joursDuMoisEntame).toBe(8);
    expect(r.montantFc).toBe(2_400_000);
  });
});
