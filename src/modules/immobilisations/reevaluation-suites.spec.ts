import { readFileSync } from 'fs';
import { join } from 'path';
import { correspond } from '../etats-financiers/etats-financiers.communs';
import { NOTES_SYSCOHADA_1 } from '../etats-financiers-syscohada/correspondance-notes-syscohada-1';
import { NOTES_ASSOCIATIONS } from '../notes-annexes/correspondance-notes-associations';
import { PLAN_COMPTES_SYSCOHADA as SEMIS_SYSCOHADA } from '../comptes/compte-seed-syscohada';
import { PLAN_COMPTES_SYCEBNL as SEMIS_SYCEBNL } from '../comptes/compte-seed';
import {
  RACINES_RESERVE_NON_DISTRIBUABLE,
  COMPTE_RESERVE_SYCEBNL,
  lignesSortDeLEcart,
  motifRefusCompteReserve,
  posteDuBien,
  sortDesEcarts,
  supplementDeLaDotation,
  vueDeLExercice,
  type LigneEcartDuBien,
} from './reevaluation-suites';

/**
 * LIGNE A15 · les suites d'une réévaluation, règles pures. Chaque montant est
 * calculé à la main dans le test, jamais relu du code qu'il éprouve.
 */
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ligne = (o: Partial<LigneEcartDuBien>): LigneEcartDuBien => ({
  id: 'l1',
  compteEcart: '10610000',
  ecart: 0,
  provisionReprise: 0,
  ecartImpute: 0,
  ecartTransfere: 0,
  ...o,
});

describe('supplementDeLaDotation · ch. 28 § 4.2.2, annuités multipliées par k', () => {
  it('l’exemple du texte · 150 au lieu de 100 (k = 1,5), supplément 50', () => {
    expect(supplementDeLaDotation(150, [1.5])).toBe(50);
  });
  it('k′ = 1,4 · dotation 140, supplément 40', () => {
    expect(supplementDeLaDotation(140, [1.4])).toBe(40);
  });
  it('deux réévaluations se chaînent · D × (1 − 1/∏k′), jamais la somme (Canon du séminaire, 175 500 · 25 500)', () => {
    expect(supplementDeLaDotation(175_500, [1.03, 1.17 / 1.03])).toBe(25_500);
  });
  it('aucune réévaluation antérieure · rien (la dotation de l’exercice de réévaluation se passe avant elle)', () => {
    expect(supplementDeLaDotation(100, [])).toBe(0);
    expect(supplementDeLaDotation(0, [1.5])).toBe(0);
  });
});

describe('sortDesEcarts · ch. 28 § 6, fiche du compte 15, loi n° 23/053 art. 132 et 133 (A15 bis)', () => {
  it('106 · le solde (écart moins pertes imputées et déjà transféré) va à la réserve, aux deux référentiels', () => {
    const lignes = [ligne({ id: 'a', compteEcart: '10610000', ecart: 50_000_000, ecartImpute: 2_000_000 })];
    expect(sortDesEcarts({ lignes })).toEqual([{ ligneId: 'a', compteEcart: '10610000', montant: 48_000_000, traitement: 'RESERVE' }]);
  });
  it('SYCEBNL, association · 106 de 10 000 000 (1061, sans droit de reprise) transféré en entier', () => {
    const lignes = [ligne({ id: 'c', compteEcart: '10611000', ecart: 10_000_000 })];
    expect(sortDesEcarts({ lignes })).toEqual([{ ligneId: 'c', compteEcart: '10611000', montant: 10_000_000, traitement: 'RESERVE' }]);
    // Le 1062 « avec droit de reprise » suit la même règle · aucun texte du SYCEBNL n'en dit autre chose.
    expect(sortDesEcarts({ lignes: [ligne({ id: 'd', compteEcart: '10621000', ecart: 3_000 })] })[0].traitement).toBe('RESERVE');
  });
  it('154 · mise au rebut après une année de reprise · 18 000 000 − 2 000 000 = 16 000 000 au 861, à toute sortie', () => {
    const lignes = [ligne({ id: 'b', compteEcart: '15400000', ecart: 18_000_000, provisionReprise: 2_000_000 })];
    expect(sortDesEcarts({ lignes })).toEqual([{ ligneId: 'b', compteEcart: '15400000', montant: 16_000_000, traitement: 'REPRISE_861' }]);
    expect(lignesSortDeLEcart(sortDesEcarts({ lignes }))).toEqual({ reserve: [], reprise: 16_000_000 });
  });
  it('plus aucun « non passé » · ni motif ni traitement de ce nom dans la source', () => {
    const source = readFileSync(join(__dirname, 'reevaluation-suites.ts'), 'utf8');
    expect(source).toMatch(/export type TraitementALaSortie = 'RESERVE' \| 'REPRISE_861';/);
  });
  it('un écart déjà soldé, ou une ligne sans écart, ne sort rien', () => {
    expect(
      sortDesEcarts({
        lignes: [
          ligne({ id: 'a', compteEcart: '10610000', ecart: 100, ecartTransfere: 100 }),
          ligne({ id: 'b', compteEcart: '15400000', ecart: 100, provisionReprise: 100 }),
          ligne({ id: 'c', compteEcart: null, ecart: 0 }),
        ],
      }),
    ).toEqual([]);
  });
  it('les lignes de l’écriture · une paire par compte du 106, la reprise d’un seul tenant', () => {
    const sorts = sortDesEcarts({
      lignes: [
        ligne({ id: 'a', compteEcart: '10610000', ecart: 100 }),
        ligne({ id: 'b', compteEcart: '10610000', ecart: 50 }),
        ligne({ id: 'c', compteEcart: '10620000', ecart: 7 }),
        ligne({ id: 'd', compteEcart: '15400000', ecart: 30, provisionReprise: 10 }),
      ],
    });
    expect(lignesSortDeLEcart(sorts)).toEqual({
      reserve: [
        { compteEcart: '10610000', montant: 150 },
        { compteEcart: '10620000', montant: 7 },
      ],
      reprise: 20,
    });
  });
});

describe('la réserve · fiche du compte 11 de chaque plan', () => {
  it('SYSCOHADA · 111, 112 et 1138 admises ; 1131 à 1134 (objet propre), 118 (réserves libres) et un autre compte refusés ; l’absence est nommée', () => {
    expect(motifRefusCompteReserve('11100000')).toBeNull();
    expect(motifRefusCompteReserve('11200000')).toBeNull();
    expect(motifRefusCompteReserve('11380000')).toBeNull();
    // Seconde relecture A15 · les 1131 à 1134 ont chacun leur objet (fiche du compte 11).
    for (const n of ['11310000', '11320000', '11330000', '11340000']) {
      expect(motifRefusCompteReserve(n)).toMatch(/a son propre objet.*va au 1138/);
    }
    expect(motifRefusCompteReserve('11810000')).toMatch(/118, qui porte les réserves libres/);
    expect(motifRefusCompteReserve('12100000')).toMatch(/n’est pas une réserve non distribuable/);
    expect(motifRefusCompteReserve(null)).toMatch(/Choisissez la réserve non distribuable/);
  });
  it('SYCEBNL · le 118 imposé (décision du 2026-10-04) · rien de choisi admis, tout autre compte refusé, le 112 compris', () => {
    expect(COMPTE_RESERVE_SYCEBNL).toBe('11800000');
    expect(motifRefusCompteReserve(null, 'SYCEBNL')).toBeNull();
    expect(motifRefusCompteReserve('11800000', 'SYCEBNL')).toBeNull();
    expect(motifRefusCompteReserve('11200000', 'SYCEBNL')).toMatch(/ne peut pas recevoir l’écart.*11800000 Autres réserves, imposé/);
    expect(motifRefusCompteReserve('12100000', 'SYCEBNL')).toMatch(/ne choisissez aucune réserve/);
  });
  it('chaque racine est ouverte au plan SYSCOHADA semé, sous l’intitulé que la fiche lui donne', () => {
    const intitules: Record<string, RegExp> = { '111': /Réserve légale/, '112': /Réserves statutaires/, '1138': /Autres réserves réglementées/ };
    for (const r of RACINES_RESERVE_NON_DISTRIBUABLE) {
      const c = SEMIS_SYSCOHADA.find((x) => x.numero === r || x.numero === r.padEnd(8, '0'));
      expect({ r, intitule: c?.intitule ?? null }).toEqual({ r, intitule: expect.stringMatching(intitules[r]) });
    }
    // Le 118 est bien celui des réserves LIBRES (« Réserves facultatives »).
    expect(SEMIS_SYSCOHADA.find((x) => x.numero === '11810000')?.intitule).toMatch(/facultatives/);
  });
  it('le 118 du SYCEBNL est semé en compte de détail, sans subdivision, sous « Autres réserves » ; ni 111 ni 113 au plan', () => {
    expect(SEMIS_SYCEBNL.find((x) => x.numero === COMPTE_RESERVE_SYCEBNL)?.intitule).toBe('Autres réserves');
    expect(SEMIS_SYCEBNL.filter((x) => x.numero.startsWith('118')).map((x) => x.numero)).toEqual([COMPTE_RESERVE_SYCEBNL]);
    expect(SEMIS_SYCEBNL.some((x) => x.numero.startsWith('111') || x.numero.startsWith('113'))).toBe(false);
  });
  it('le 861 et le 154 sont ouverts aux deux semis (la reprise à la sortie)', () => {
    for (const semis of [SEMIS_SYSCOHADA, SEMIS_SYCEBNL]) {
      expect(semis.some((c) => c.numero === '86100000')).toBe(true);
      expect(semis.some((c) => c.numero === '15400000')).toBe(true);
    }
  });
});

describe('posteDuBien · la rubrique de la note des immobilisations brutes du jeu', () => {
  const rubriques3A = NOTES_SYSCOHADA_1.find((n) => n.code === '3A')!.rubriques;
  const rubriques5B = NOTES_ASSOCIATIONS.find((n) => n.code === '5B')!.rubriques;
  it('SYSCOHADA · un bâtiment industriel, un immeuble de placement, un terrain, des titres', () => {
    expect(posteDuBien('23110000', rubriques3A, correspond)).toBe('Bâtiments hors immeuble de placement');
    expect(posteDuBien('23150000', rubriques3A, correspond)).toBe('Bâtiments - immeuble de placement');
    expect(posteDuBien('22300000', rubriques3A, correspond)).toBe('Terrains hors immeuble de placement');
    expect(posteDuBien('26100000', rubriques3A, correspond)).toBe('Titres de participation');
  });
  it('SYCEBNL · le matériel de transport', () => {
    expect(posteDuBien('24500000', rubriques5B, correspond)).toBe('Matériel de transport');
  });
  it('un compte qu’aucune rubrique ne lit garde son numéro, jamais rangé ailleurs', () => {
    expect(posteDuBien('99999999', rubriques3A, correspond)).toMatch(/Compte 99999999/);
  });
});

describe('vueDeLExercice · le bien tel qu’il était à l’exercice lu', () => {
  // Application 99 · bâtiment 300 000 000, 50 000 000 amortis, k = 1,2 au 31/12/N ·
  // brut 360 000 000, cumul 60 000 000.
  const portee = {
    dateReevaluation: D('2026-12-31'),
    coefficientRetenu: 1.2,
    brutAvant: 300_000_000,
    brutApres: 360_000_000,
    amortissementsAvant: 50_000_000,
    amortissementsApres: 60_000_000,
  };
  it('exercice de la réévaluation · la hausse du cumul est de l’exercice (passée à sa clôture), rien d’antérieur', () => {
    expect(vueDeLExercice([portee], { dateDebut: D('2026-01-01'), dateFin: D('2026-12-31') })).toEqual({
      produitAnterieur: 1,
      produitPosterieur: 1,
      ajustementCumulExercice: 10_000_000,
      cumulPosterieur: 0,
      brutPosterieur: 0,
    });
  });
  it('exercice suivant · la réévaluation multiplie l’annuité (k = 1,2), plus d’ajustement', () => {
    expect(vueDeLExercice([portee], { dateDebut: D('2027-01-01'), dateFin: D('2027-12-31') })).toMatchObject({
      produitAnterieur: 1.2,
      ajustementCumulExercice: 0,
    });
  });
  it('exercice antérieur relu après coup · la réévaluation postérieure est retranchée du brut et du cumul', () => {
    expect(vueDeLExercice([portee], { dateDebut: D('2025-01-01'), dateFin: D('2025-12-31') })).toEqual({
      produitAnterieur: 1,
      produitPosterieur: 1.2,
      ajustementCumulExercice: 0,
      cumulPosterieur: 10_000_000,
      brutPosterieur: 60_000_000,
    });
  });
});
