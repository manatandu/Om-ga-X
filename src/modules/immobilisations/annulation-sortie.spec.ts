import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { complementDUneSortieAncienne, FaitsSortie, lirePassesEcart, motifRefusAnnulationSortie } from './annulation-sortie';
import { motifRefusAnnulation, ISSUE_ANNULER_SORTIE_UNITES } from './annulation-traitement';

/**
 * Ligne restes-immos-budgets, point 3 · ce qui casserait en silence dans
 * l'annulation d'une sortie · une sortie d'un exercice clôturé corrigée en
 * négatif (art. 20, al. 3), une dotation ordinaire retirée pour un complément,
 * un écart de réévaluation rendu sans ses parts, une sortie annulée sous un
 * acte qui l'a lue, et une sortie posée sans ce que son annulation doit relire.
 */
const ouverte: FaitsSortie = {
  sortie: true,
  transfertGroupe: false,
  echange: false,
  renouvelePar: null,
  exerciceClos: false,
  complementIndistinct: false,
  ecartSansParts: false,
  repriseLotIndistincte: false,
  lotSorti: false,
  refusEcriture: null,
  posterieurs: [],
};

describe('annulation d’une sortie · les refus, dans l’ordre', () => {
  it('une sortie d’un exercice ouvert, sans rien après elle, s’annule', () => {
    expect(motifRefusAnnulationSortie(ouverte)).toBeNull();
  });

  it('un bien en service n’a pas de sortie à annuler', () => {
    expect(motifRefusAnnulationSortie({ ...ouverte, sortie: false })).toMatch(/pas sorti/);
  });

  it('exercice clôturé · l’erreur relève du report à nouveau (AUDCIF art. 20, al. 3)', () => {
    const m = motifRefusAnnulationSortie({ ...ouverte, exerciceClos: true });
    expect(m).toMatch(/al\. 3/);
    expect(m).toMatch(/report à nouveau/);
  });

  it('transfert dans le groupe, échange et renouvellement renvoient chacun à son geste', () => {
    expect(motifRefusAnnulationSortie({ ...ouverte, transfertGroupe: true })).toMatch(/Transferts de biens/);
    expect(motifRefusAnnulationSortie({ ...ouverte, echange: true })).toMatch(/échange/);
    expect(motifRefusAnnulationSortie({ ...ouverte, renouvelePar: 'Ascenseur neuf' })).toMatch(/Ascenseur neuf/);
  });

  it('un acte postérieur est nommé avec son issue, ou la correction à la main', () => {
    const avecIssue = motifRefusAnnulationSortie({ ...ouverte, posterieurs: [{ libelle: 'la dotation de 2026', issue: 'annulez-le d’abord depuis l’onglet Traitements de la fiche' }] });
    expect(avecIssue).toMatch(/la dotation de 2026/);
    expect(avecIssue).toMatch(/Traitements/);
    const sansIssue = motifRefusAnnulationSortie({ ...ouverte, posterieurs: [{ libelle: 'le reclassement du 01/07/2026', issue: null }] });
    expect(sansIssue).toMatch(/art\. 20, al\. 2/);
  });

  it('une ligne lettrée ou une écriture tenue ailleurs arrête l’annulation, avec son motif', () => {
    expect(motifRefusAnnulationSortie({ ...ouverte, refusEcriture: 'L’écriture n° 12 est lettrée.' })).toBe('L’écriture n° 12 est lettrée.');
  });

  it('une sortie d’avant la ligne · écart sans parts, complément ou reprise indistincts, rien deviné', () => {
    expect(motifRefusAnnulationSortie({ ...ouverte, ecartSansParts: true })).toMatch(/réévaluation/);
    expect(motifRefusAnnulationSortie({ ...ouverte, complementIndistinct: true })).toMatch(/complémentaire/);
    expect(motifRefusAnnulationSortie({ ...ouverte, repriseLotIndistincte: true })).toMatch(/reprise/);
  });
});

describe('le complément d’une sortie d’avant la ligne', () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  it('datée du jour de la sortie, en cours d’exercice · c’est le complément', () => {
    expect(complementDUneSortieAncienne({ ficheDesUnites: false, dateSortie: d('2026-09-30'), finExercice: d('2026-12-31'), dotationsDeLExercice: [{ id: 'x', dateEcriture: d('2026-09-30') }] })).toEqual({ dotationId: 'x', indistinct: false });
  });
  it('datée d’un autre jour · une dotation ordinaire passée avant, jamais retirée', () => {
    expect(complementDUneSortieAncienne({ ficheDesUnites: false, dateSortie: d('2026-09-30'), finExercice: d('2026-12-31'), dotationsDeLExercice: [{ id: 'x', dateEcriture: d('2026-12-31') }] })).toEqual({ dotationId: null, indistinct: false });
  });
  it('sortie au jour de la clôture · les deux se confondent, indistinct', () => {
    expect(complementDUneSortieAncienne({ ficheDesUnites: false, dateSortie: d('2026-12-31'), finExercice: d('2026-12-31'), dotationsDeLExercice: [{ id: 'x', dateEcriture: d('2026-12-31') }] }).indistinct).toBe(true);
  });
  it('la fiche des unités d’un lot n’a d’autre dotation que son complément', () => {
    expect(complementDUneSortieAncienne({ ficheDesUnites: true, dateSortie: d('2026-12-31'), finExercice: d('2026-12-31'), dotationsDeLExercice: [{ id: 'u', dateEcriture: d('2026-12-31') }] })).toEqual({ dotationId: 'u', indistinct: false });
  });
});

describe('les parts de réévaluation gardées par la sortie', () => {
  it('nulles sur une sortie d’avant la ligne, une liste (vide comprise) sur toute sortie depuis', () => {
    expect(lirePassesEcart(null)).toBeNull();
    expect(lirePassesEcart([])).toEqual([]);
    expect(lirePassesEcart([{ ligneId: 'l1', traitement: 'RESERVE', montant: '1500.5' }])).toEqual([{ ligneId: 'l1', traitement: 'RESERVE', montant: 1500.5 }]);
  });

  it('la sortie pose la liaison du complément et TOUJOURS la liste des parts, et la défaite les lâche avant les écritures', () => {
    const source = readFileSync(join(__dirname, 'immobilisation.service.ts'), 'utf8');
    expect(source).toMatch(/ecritureComplementSortieId: ecritureComplementId,\n\s+passesEcartSortie: sortEcart\.passes\.map/);
    const defaire = source.slice(source.indexOf('private async defaireSortie('));
    const corps = defaire.slice(0, defaire.indexOf('\n  }\n'));
    expect(corps.indexOf('ecritureComplementSortieId: null')).toBeGreaterThan(-1);
    expect(corps.indexOf('immobilisation.updateMany')).toBeLessThan(corps.indexOf('annulerEcritureOrpheline'));
  });
});

describe('l’onglet Traitements renvoie désormais à l’annulation de la sortie', () => {
  it('la reprise d’une sortie partielle part avec la sortie des unités', () => {
    expect(motifRefusAnnulation({ exerciceClos: false, cessionPartielle: true, dependants: [] })).toMatch(/Annuler la sortie/);
  });
  it('un traitement lu par une sortie d’unités nomme l’issue', () => {
    const m = motifRefusAnnulation({
      exerciceClos: false,
      dependants: [{ nature: 'CESSION_PARTIELLE', id: 'f', exerciceFin: new Date(), creeLe: new Date(), libelle: 'la sortie d’une partie des unités du lot', issue: ISSUE_ANNULER_SORTIE_UNITES }],
    });
    expect(m).toContain(ISSUE_ANNULER_SORTIE_UNITES);
  });
});
