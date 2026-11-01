import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  issueDeLaRegularisation,
  lignesDeLaRegularisation,
  motifRefusAvanceMission,
  motifRefusRegularisation,
  motifRefusRepartitionMission,
  partsParSection,
} from './avance-mission';
import { compteDuRole } from './passation-paie';
import { totauxAuBulletin } from './missions.service';

/**
 * LIGNE PAIE-DECLARATIONS, POINT 3 · l'avance de mission, sa régularisation,
 * la répartition par projet. Ce qui casserait en silence · une écriture
 * déséquilibrée, des frais remboursés deux fois (bulletin ET avance), une
 * section qui reçoit une part inventée.
 */
const MISSION = { numero: 7, dateDepart: '2026-03-02', dateRetour: '2026-03-06', annuleLe: null, porteeParBulletin: null };

const equilibree = (l: { debit: number; credit: number }[]) =>
  Math.round(l.reduce((t, x) => t + Math.round(x.debit * 100) - Math.round(x.credit * 100), 0));

describe("l'avance de mission", () => {
  it('décision par la loi · l’avance au 4213 (frais avancés), le trop-versé retenu au 4211, aux deux plans', () => {
    expect(compteDuRole('FRAIS_AVANCES_AU_PERSONNEL', 'SYSCOHADA')).toBe('42130000');
    expect(compteDuRole('FRAIS_AVANCES_AU_PERSONNEL', 'SYCEBNL')).toBe('42130000');
    expect(compteDuRole('AVANCES_AU_PERSONNEL', 'SYSCOHADA')).toBe('42110000');
    expect(compteDuRole('AVANCES_AU_PERSONNEL', 'SYCEBNL')).toBe('42110000');
    const semis = ['compte-seed.ts', 'compte-seed-syscohada.ts'].map((f) => readFileSync(join(__dirname, '../comptes', f), 'utf8'));
    for (const s of semis) expect(s).toContain("'42130000'");
    expect(compteDuRole('MISSIONS', 'SYCEBNL')).toBe('63840000');
  });

  it('refuse sans pièce, au-delà du retour, sur une mission déjà avancée ou portée par un bulletin', () => {
    const base = { mission: MISSION, montantFc: 300_000, date: '2026-03-01', pieceJustificative: 'Reçu 12', avanceExistante: false };
    expect(motifRefusAvanceMission(base)).toBeNull();
    expect(motifRefusAvanceMission({ ...base, pieceJustificative: ' ' })).toContain('AUDCIF art. 17, 3°');
    expect(motifRefusAvanceMission({ ...base, date: '2026-03-07' })).toContain('retour prévu');
    expect(motifRefusAvanceMission({ ...base, avanceExistante: true })).toContain('une seule avance');
    expect(motifRefusAvanceMission({ ...base, mission: { ...MISSION, porteeParBulletin: 12 } })).toContain('bulletin émis n° 12');
    expect(motifRefusAvanceMission({ ...base, montantFc: 10.005 })).toContain('au centime');
  });
});

describe('la régularisation au retour', () => {
  it('trois issues imposées par les montants, le trop-versé au choix du cabinet', () => {
    expect(issueDeLaRegularisation(300_000, 300_000, null)).toEqual({ issue: 'SOLDEE', ecartFc: 0 });
    expect(issueDeLaRegularisation(350_000.5, 300_000, null)).toEqual({ issue: 'COMPLEMENT_PAYE', ecartFc: 50_000.5 });
    const sansChoix = issueDeLaRegularisation(200_000, 300_000, null);
    expect('refus' in sansChoix && sansChoix.refus).toContain('art. 112, c');
    expect(issueDeLaRegularisation(200_000, 300_000, 'RENDU')).toEqual({ issue: 'TROP_VERSE_RENDU', ecartFc: 100_000 });
    expect(issueDeLaRegularisation(200_000, 300_000, 'RETENU')).toEqual({ issue: 'TROP_VERSE_RETENU', ecartFc: 100_000 });
  });

  it('chaque écriture est équilibrée au centime et SOLDE le 4213 dans les quatre issues, montants calculés à la main', () => {
    // Soldée · D 6384 300 000 / C 4213 300 000.
    const soldee = lignesDeLaRegularisation(300_000, 300_000, 'SOLDEE');
    expect(soldee).toEqual([
      { role: 'MISSIONS', debit: 300_000, credit: 0 },
      { role: 'FRAIS_AVANCES_AU_PERSONNEL', debit: 0, credit: 300_000 },
    ]);
    // Complément · D 6384 350 000,50 / C trésorerie 50 000,50 / C 4213 300 000.
    const complement = lignesDeLaRegularisation(350_000.5, 300_000, 'COMPLEMENT_PAYE');
    expect(complement).toEqual([
      { role: 'MISSIONS', debit: 350_000.5, credit: 0 },
      { role: 'TRESORERIE', debit: 0, credit: 50_000.5 },
      { role: 'FRAIS_AVANCES_AU_PERSONNEL', debit: 0, credit: 300_000 },
    ]);
    // Rendu · D 6384 200 000 / D trésorerie 100 000 / C 4213 300 000.
    const rendu = lignesDeLaRegularisation(200_000, 300_000, 'TROP_VERSE_RENDU');
    expect(rendu).toContainEqual({ role: 'TRESORERIE', debit: 100_000, credit: 0 });
    // Retenu · le trop-versé RECLASSÉ au 4211 (avance sur rémunération), le 4213 soldé.
    const retenu = lignesDeLaRegularisation(200_000, 300_000, 'TROP_VERSE_RETENU');
    expect(retenu).toEqual([
      { role: 'MISSIONS', debit: 200_000, credit: 0 },
      { role: 'AVANCES_AU_PERSONNEL', debit: 100_000, credit: 0 },
      { role: 'FRAIS_AVANCES_AU_PERSONNEL', debit: 0, credit: 300_000 },
    ]);
    // Aucun frais justifié, tout retenu · le reclassement entier, D 4211 / C 4213.
    const toutRetenu = lignesDeLaRegularisation(0, 300_000, 'TROP_VERSE_RETENU');
    expect(toutRetenu).toEqual([
      { role: 'AVANCES_AU_PERSONNEL', debit: 300_000, credit: 0 },
      { role: 'FRAIS_AVANCES_AU_PERSONNEL', debit: 0, credit: 300_000 },
    ]);
    for (const l of [soldee, complement, rendu, retenu, toutRetenu]) {
      expect(equilibree(l)).toBe(0);
      expect(l.filter((x) => x.role === 'FRAIS_AVANCES_AU_PERSONNEL').reduce((t, x) => t + x.credit - x.debit, 0)).toBe(300_000);
    }
  });

  it('suit la fin de mission constatée, jamais avant l’avance, pièce exigée', () => {
    const base = { mission: { numero: 7, accomplieLe: '2026-03-06', annuleLe: null }, date: '2026-03-08', pieceJustificative: 'Décompte', regularisationExistante: false, dateAvance: '2026-03-01' };
    expect(motifRefusRegularisation(base)).toBeNull();
    expect(motifRefusRegularisation({ ...base, mission: { ...base.mission, accomplieLe: null } })).toContain("n'est pas constatée");
    expect(motifRefusRegularisation({ ...base, date: '2026-02-28' })).toContain("ne peut précéder l'avance");
    expect(motifRefusRegularisation({ ...base, regularisationExistante: true })).toContain('déjà régularisée');
  });

  it('une mission avancée ne porte plus ses frais justifiés au bulletin, le forfait imposable y reste', () => {
    const frais = [
      { element: 'HEBERGEMENT' as const, qualification: 'JUSTIFIE' as const, montantFc: 120_000 },
      { element: 'DIVERS' as const, qualification: 'FORFAIT' as const, montantFc: 30_000 },
    ];
    expect(totauxAuBulletin(frais, false)).toMatchObject({ justifieFc: 120_000, forfaitFc: 30_000 });
    expect(totauxAuBulletin(frais, true)).toMatchObject({ justifieFc: 0, forfaitFc: 30_000 });
  });

  it("l'émission relit la même règle que la simulation (le justifié retiré d'une mission avancée)", () => {
    const source = readFileSync(join(__dirname, 'missions.service.ts'), 'utf8');
    expect(source.match(/totauxAuBulletin\(lireFrais\(m\.frais\), m\.avances\.length > 0\)/g)).toHaveLength(2);
  });
});

describe('la répartition des frais par projet', () => {
  const plan = { id: 'p1', code: 'PROJ', classesVentilees: '2,6,7,9', estActif: true };
  const sections = [
    { id: 's1', planId: 'p1', code: 'P01', estTotal: false, estActive: true },
    { id: 's2', planId: 'p1', code: 'P02', estTotal: false, estActive: true },
    { id: 's3', planId: 'p1', code: 'P0', estTotal: true, estActive: true },
    { id: 's4', planId: 'p1', code: 'P03', estTotal: false, estActive: false },
  ];
  it('pourcentages qui font 100, sections Détail actives, plan qui ventile la classe 6', () => {
    expect(motifRefusRepartitionMission({ plan, sections, lignes: [{ sectionId: 's1', pourcentage: 60 }, { sectionId: 's2', pourcentage: 40 }] })).toBeNull();
    expect(motifRefusRepartitionMission({ plan, sections, lignes: [{ sectionId: 's1', pourcentage: 60 }] })).toContain('exactement 100 %');
    expect(motifRefusRepartitionMission({ plan, sections, lignes: [{ sectionId: 's3', pourcentage: 100 }] })).toContain('section Total');
    expect(motifRefusRepartitionMission({ plan, sections, lignes: [{ sectionId: 's4', pourcentage: 100 }] })).toContain('en sommeil');
    expect(motifRefusRepartitionMission({ plan: { ...plan, classesVentilees: '2,7' }, sections, lignes: [] })).toContain('6384');
    // Vide · la répartition du plan se retire.
    expect(motifRefusRepartitionMission({ plan, sections, lignes: [] })).toBeNull();
  });

  it('au centime par le plus fort reste · la somme refait le montant, aucune part inventée', () => {
    // 100 000,01 à 1/3, 1/3, 1/3 (33,33 + 33,33 + 33,34).
    const parts = partsParSection(100_000.01, [
      { sectionId: 'a', code: 'A', pourcentage: 33.33 },
      { sectionId: 'b', code: 'B', pourcentage: 33.33 },
      { sectionId: 'c', code: 'C', pourcentage: 33.34 },
    ]);
    expect(Math.round(parts.reduce((t, p) => t + p.montantFc * 100, 0))).toBe(10_000_001);
    // Bases 33 330, 33 330, 33 340 · le centime manquant va au plus fort reste, C.
    expect(parts.find((p) => p.sectionId === 'c')!.montantFc).toBe(33_340.01);
    // 60 / 40 de 350 000,50 · 210 000,30 et 140 000,20.
    expect(partsParSection(350_000.5, [{ sectionId: 'a', code: 'A', pourcentage: 60 }, { sectionId: 'b', code: 'B', pourcentage: 40 }])).toEqual([
      { sectionId: 'a', montantFc: 210_000.3 },
      { sectionId: 'b', montantFc: 140_000.2 },
    ]);
  });
});
