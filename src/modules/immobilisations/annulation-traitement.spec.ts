import {
  ActeDuBien,
  actesQuiEnDependent,
  etatDuPlanApres,
  motifRefusAnnulation,
  motifRefusMotifAnnulation,
  rendreEcartImpute,
  valeurResiduelleAvant,
} from './annulation-traitement';

/**
 * ANNULER UNE DOTATION OU UN TRAITEMENT (ligne sage-l4, fonction n° 67) ·
 * les règles pures. Ce qui casserait en silence · un traitement annulé alors
 * qu'un acte postérieur a lu son résultat (la dotation de N+1 calculée sur un
 * cumul que le journal ne porte plus), un écart de réévaluation rendu à la
 * mauvaise ligne, une révision annulée qui laisse la fiche sur la durée
 * révisée.
 */

const N = new Date('2026-12-31');
const N1 = new Date('2027-12-31');
const t = (s: string) => new Date(`2026-06-01T${s}:00Z`);
const acte = (p: Partial<ActeDuBien> & Pick<ActeDuBien, 'nature' | 'id'>): ActeDuBien => ({
  exerciceFin: N,
  creeLe: t('10:00'),
  libelle: p.id,
  ...p,
});

describe('les actes qui dépendent du traitement annulé', () => {
  it("la dotation de N+1 dépend de celle de N · on annule à partir du plus récent", () => {
    const dotN = acte({ nature: 'DOTATION', id: 'd1' });
    const dotN1 = acte({ nature: 'DOTATION', id: 'd2', exerciceFin: N1 });
    expect(actesQuiEnDependent(dotN, [dotN, dotN1]).map((a) => a.id)).toEqual(['d2']);
    expect(actesQuiEnDependent(dotN1, [dotN, dotN1])).toEqual([]);
  });

  it('la dépréciation de N, enregistrée après la dotation de N, la bloque ; la dotation de N ne dépend pas de la dépréciation de N', () => {
    const dot = acte({ nature: 'DOTATION', id: 'dot', creeLe: t('10:00') });
    const dep = acte({ nature: 'DEPRECIATION', id: 'dep', creeLe: t('11:00') });
    expect(actesQuiEnDependent(dot, [dot, dep]).map((a) => a.id)).toEqual(['dep']);
    // `passerDotation` ne lit que les dépréciations des exercices antérieurs.
    expect(actesQuiEnDependent(dep, [dot, dep])).toEqual([]);
    // La dotation de N+1, elle, relit la dépréciation de N (ré-étalement).
    const dotN1 = acte({ nature: 'DOTATION', id: 'dotN1', exerciceFin: N1 });
    expect(actesQuiEnDependent(dep, [dot, dep, dotN1]).map((a) => a.id)).toEqual(['dotN1']);
  });

  it("la révision de N précède la dotation de N · seule une révision d'un exercice postérieur dépend de la dotation", () => {
    const dot = acte({ nature: 'DOTATION', id: 'dot', creeLe: t('10:00') });
    const revMemeExercice = acte({ nature: 'REVISION_PLAN', id: 'rev', creeLe: t('11:00') });
    const revN1 = acte({ nature: 'REVISION_PLAN', id: 'revN1', exerciceFin: N1 });
    expect(actesQuiEnDependent(dot, [dot, revMemeExercice, revN1]).map((a) => a.id)).toEqual(['revN1']);
    // Et la révision est bloquée par la dotation qui l'a suivie.
    const rev = acte({ nature: 'REVISION_PLAN', id: 'rev', creeLe: t('09:00') });
    expect(actesQuiEnDependent(rev, [rev, dot]).map((a) => a.id)).toEqual(['dot']);
  });

  it('le dérogatoire de N dépend de la dotation de N ; la dotation de N+1 ne dépend pas du dérogatoire de N', () => {
    const dot = acte({ nature: 'DOTATION', id: 'dot', creeLe: t('10:00') });
    const der = acte({ nature: 'DEROGATOIRE', id: 'der', creeLe: t('11:00') });
    const dotN1 = acte({ nature: 'DOTATION', id: 'dotN1', exerciceFin: N1 });
    expect(actesQuiEnDependent(dot, [dot, der]).map((a) => a.id)).toEqual(['der']);
    expect(actesQuiEnDependent(der, [dot, der, dotN1])).toEqual([]);
  });

  it('une sortie dépend de tout ce qui la précède, sauf la reprise de subvention passée à la sortie, qui la suit', () => {
    const sortie = acte({ nature: 'SORTIE', id: 'bien', exerciceFin: N, creeLe: t('08:00') });
    const dot = acte({ nature: 'DOTATION', id: 'dot', creeLe: t('10:00') });
    expect(actesQuiEnDependent(dot, [dot, sortie]).map((a) => a.id)).toEqual(['bien']);
    const repriseALaSortie = acte({ nature: 'REPRISE_SUBVENTION', id: 'rs', repriseALaSortie: true });
    expect(actesQuiEnDependent({ ...repriseALaSortie }, [repriseALaSortie, sortie])).toEqual([]);
    const repriseOrdinaire = acte({ nature: 'REPRISE_SUBVENTION', id: 'ro' });
    expect(actesQuiEnDependent(repriseOrdinaire, [repriseOrdinaire, sortie]).map((a) => a.id)).toEqual(['bien']);
  });

  it('le solde du dérogatoire ne dépend que du dérogatoire suivant et de la sortie', () => {
    const solde = acte({ nature: 'DEROGATOIRE', id: 'solde', creeLe: t('10:00') });
    const dotN1 = acte({ nature: 'DOTATION', id: 'dotN1', exerciceFin: N1 });
    const sortie = acte({ nature: 'SORTIE', id: 'bien' });
    expect(actesQuiEnDependent({ ...solde, soldeDerogatoire: true }, [solde, dotN1, sortie]).map((a) => a.id)).toEqual(['bien']);
  });

  it("la réévaluation de N n'est pas bloquée par la dotation de N, qui la précède, mais par celle de N+1", () => {
    const reev = acte({ nature: 'REEVALUATION', id: 'reev', creeLe: t('12:00') });
    const dot = acte({ nature: 'DOTATION', id: 'dot', creeLe: t('10:00') });
    const dotN1 = acte({ nature: 'DOTATION', id: 'dotN1', exerciceFin: N1 });
    expect(actesQuiEnDependent(reev, [reev, dot])).toEqual([]);
    expect(actesQuiEnDependent(reev, [reev, dot, dotN1]).map((a) => a.id)).toEqual(['dotN1']);
  });
});

describe('le motif du refus', () => {
  it("refuse dans un exercice clôturé, en citant l'art. 20", () => {
    const m = motifRefusAnnulation({ exerciceClos: true, dependants: [] });
    expect(m).toMatch(/clôturé/);
    expect(m).toMatch(/AUDCIF art\. 20/);
  });

  it("nomme l'acte postérieur et dit d'annuler à partir du plus récent", () => {
    const m = motifRefusAnnulation({
      exerciceClos: false,
      dependants: [acte({ nature: 'DOTATION', id: 'x', exerciceFin: N1, libelle: "la dotation de l'exercice clos le 2027-12-31" })],
    });
    expect(m).toMatch(/dotation de l'exercice clos le 2027-12-31/);
    expect(m).toMatch(/Annulez d’abord le plus récent/);
  });

  it("dit qu'une sortie ne s'annule pas dans OmegaX, au lieu de promettre une issue", () => {
    const m = motifRefusAnnulation({
      exerciceClos: false,
      dependants: [acte({ nature: 'SORTIE', id: 'b', libelle: 'la sortie du bien le 2026-09-30' })],
    });
    expect(m).toMatch(/ne s’annule pas dans OmegaX/);
    expect(m).not.toMatch(/Annulez d’abord/);
  });

  it('refuse le transfert de mise en service et la révision posée par une réévaluation', () => {
    expect(motifRefusAnnulation({ exerciceClos: false, transfertMiseEnService: true, dependants: [] })).toMatch(/mise en service/);
    expect(motifRefusAnnulation({ exerciceClos: false, revisionDeReevaluation: true, dependants: [] })).toMatch(/avec la réévaluation/);
  });

  it('laisse passer un traitement sans acte postérieur, dans un exercice ouvert', () => {
    expect(motifRefusAnnulation({ exerciceClos: false, dependants: [] })).toBeNull();
  });

  it('exige un motif de trois à cinq cents caractères', () => {
    expect(motifRefusMotifAnnulation('  ')).toMatch(/motif/);
    expect(motifRefusMotifAnnulation('ok')).toMatch(/trois/);
    expect(motifRefusMotifAnnulation('Erreur de durée')).toBeNull();
    expect(motifRefusMotifAnnulation('x'.repeat(501))).toMatch(/cinq cents/);
  });
});

describe("l'écart de réévaluation rendu par la dépréciation annulée", () => {
  it('rend à la dernière ligne entamée d’abord, au centime', () => {
    // Deux réévaluations · la première pleine (6 000), la seconde entamée de 1 500.
    const lignes = [
      { id: 'a', ecartImpute: 6000 },
      { id: 'b', ecartImpute: 1500 },
    ];
    expect(rendreEcartImpute(lignes, 2000)).toEqual([
      { id: 'b', montant: 1500 },
      { id: 'a', montant: 500 },
    ]);
  });

  it("rend null si les lignes ne portent plus de quoi rendre · rien ne se rend en silence", () => {
    expect(rendreEcartImpute([{ id: 'a', ecartImpute: 100 }], 100.01)).toBeNull();
  });
});

describe("l'état du plan après l'annulation d'une révision", () => {
  const ouverture = new Date('2027-01-01');
  it('revient à la révision prospective précédente, ou à nul sans elle', () => {
    expect(etatDuPlanApres([])).toEqual({ dateEffetRevisionPlan: null, dureeResiduelleRevisee: null });
    expect(
      etatDuPlanApres([{ id: 'p', nature: 'PROSPECTIVE', dureeApresAns: 3, creeLe: t('10:00'), ouvertureExercice: ouverture, ouvertureSuivante: null }]),
    ).toEqual({ dateEffetRevisionPlan: ouverture, dureeResiduelleRevisee: 3 });
  });

  it("une rétroactive postérieure remet l'état à nul ; une réévaluation en méthode 2 prend effet à l'ouverture suivante", () => {
    const suivante = new Date('2027-01-01');
    expect(
      etatDuPlanApres([
        { id: 'p', nature: 'PROSPECTIVE', dureeApresAns: 3, creeLe: t('10:00'), ouvertureExercice: new Date('2026-01-01'), ouvertureSuivante: null },
        { id: 'r', nature: 'RETROACTIVE', dureeApresAns: 8, creeLe: t('11:00'), ouvertureExercice: new Date('2026-01-01'), ouvertureSuivante: null },
      ]),
    ).toEqual({ dateEffetRevisionPlan: null, dureeResiduelleRevisee: null });
    expect(
      etatDuPlanApres([
        { id: 'm2', nature: 'PROSPECTIVE', dureeApresAns: 4, creeLe: t('10:00'), ouvertureExercice: new Date('2026-01-01'), ouvertureSuivante: suivante },
      ]),
    ).toEqual({ dateEffetRevisionPlan: suivante, dureeResiduelleRevisee: 4 });
  });
});

describe("la valeur résiduelle d'avant la réévaluation", () => {
  it('se lit sur la ligne quand elle y est gardée', () => {
    expect(valeurResiduelleAvant(1000, 1400)).toBe(1000);
  });
  it("se déduit seulement quand elle est nulle (k' × 0 = 0), sinon null", () => {
    expect(valeurResiduelleAvant(null, 0)).toBe(0);
    expect(valeurResiduelleAvant(null, 1400)).toBeNull();
  });
});
