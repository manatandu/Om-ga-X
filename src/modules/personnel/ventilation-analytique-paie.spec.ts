import { propositionPaieDuMois, type BulletinAComptabiliser, type LigneDuMois } from './comptabilisation-paie';
import {
  enPointsDeBase,
  issueDeLaCause,
  motifRefusRepartition,
  ventilerLaPaie,
  versionDuMois,
  type BulletinVentile,
  type PlanConnu,
  type SectionConnue,
  type VersionRepartition,
} from './ventilation-analytique-paie';

/**
 * LIGNE SAGE-L5, FONCTION 88 · la ventilation analytique de la paie. Ce qui
 * casserait en silence · une section qui reçoit une part qu'elle n'a pas, une
 * ligne ventilée à côté de son montant (refusée à la saisie, ou pire, ventilée
 * en partie), un salarié sans répartition dont la part irait aux autres.
 */

const bulletin = (n: number, salarieId: string, salaireFc = 1_000_000): BulletinVentile => ({
  id: `b${n}`,
  numero: n,
  nomComplet: `SALARIE ${n}`,
  salarieId,
  statut: 'EMIS',
  ecritureId: null,
  netAPayerFc: Math.round((salaireFc + 400_000 - 150_000) * 100) / 100,
  entree: {
    elements: [
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: salaireFc },
      { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
    ],
  },
  calcul: {
    cotisations: {
      lignes: [
        { cle: 'cnss-pf', charge: 'EMPLOYEUR', montantFc: 65_000 },
        { cle: 'cnss-pension-employeur', charge: 'EMPLOYEUR', montantFc: 50_000 },
        { cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: 50_000 },
        { cle: 'cnss-rp', charge: 'EMPLOYEUR', montantFc: 15_001 },
        { cle: 'inpp', charge: 'EMPLOYEUR', montantFc: 35_000 },
        { cle: 'onem', charge: 'EMPLOYEUR', montantFc: 5_000 },
      ],
      abstentions: [],
    },
    retenue: { retenueFc: 100_000 },
    net: { netAPayerFc: Math.round((salaireFc + 400_000 - 150_000) * 100) / 100 },
  },
});

const PROJ: PlanConnu = { id: 'p-proj', code: 'PROJ', classesVentilees: '2,6,7,9', estActif: true };
const BAIL: PlanConnu = { id: 'p-bail', code: 'BAIL', classesVentilees: '6', estActif: true };
const section = (id: string, planId: string, extra: Partial<SectionConnue> = {}): SectionConnue => ({
  id,
  planId,
  code: id.toUpperCase(),
  estTotal: false,
  estActive: true,
  ...extra,
});
const SECTIONS: SectionConnue[] = [
  section('p1', 'p-proj'),
  section('p2', 'p-proj'),
  section('p3', 'p-proj'),
  section('rub', 'p-proj', { estTotal: true }),
  section('dormante', 'p-proj', { estActive: false }),
  section('b1', 'p-bail'),
];
const version = (id: string, salarieId: string, planId: string, moisEffet: string, lignes: [string, number][]): VersionRepartition => ({
  id,
  salarieId,
  planId,
  moisEffet,
  lignes: lignes.map(([sectionId, pourcentage]) => ({ sectionId, pourcentage })),
});

const proposer = (bulletins: BulletinVentile[]) => propositionPaieDuMois('2026-12', 'SYSCOHADA', bulletins);
const centimes = (n: number) => Math.round(n * 100);
const ligneDe = (lignes: readonly LigneDuMois[], compte: string) => lignes.findIndex((l) => l.compte === compte && !l.negatif);

describe('la répartition déclarée', () => {
  const ok = (lignes: [string, number][], plan: PlanConnu | null = PROJ, moisEffet = '2026-12') =>
    motifRefusRepartition({ plan, sections: SECTIONS, lignes: lignes.map(([sectionId, pourcentage]) => ({ sectionId, pourcentage })), moisEffet });

  it('admet 60/40, un tiers chacun à deux décimales, et la répartition vide (le salarié quitte le plan)', () => {
    expect(ok([['p1', 60], ['p2', 40]])).toBeNull();
    expect(ok([['p1', 33.33], ['p2', 33.33], ['p3', 33.34]])).toBeNull();
    expect(ok([])).toBeNull();
  });

  it('refuse ce qui ne fait pas exactement 100 %, et le dit', () => {
    expect(ok([['p1', 60], ['p2', 39.99]])).toMatch(/font 99\.99 %/);
    expect(ok([['p1', 33.333], ['p2', 66.667]])).toMatch(/deux décimales au plus/);
  });

  it("refuse une rubrique (Total), une section en sommeil, une section d'un autre plan, une section répétée", () => {
    expect(ok([['rub', 100]])).toMatch(/rubrique \(section Total\)/);
    expect(ok([['dormante', 100]])).toMatch(/en sommeil/);
    expect(ok([['b1', 100]])).toMatch(/n'appartient pas au plan PROJ/);
    expect(ok([['p1', 50], ['p1', 50]])).toMatch(/déjà répartie/);
  });

  it('refuse un plan qui ne ventile pas les charges de personnel, ou en sommeil, et un mois illisible', () => {
    expect(ok([['p1', 100]], { ...PROJ, classesVentilees: '2,7' })).toMatch(/ne ventile pas la classe 6/);
    expect(ok([['p1', 100]], { ...PROJ, estActif: false })).toMatch(/en sommeil/);
    expect(ok([['p1', 100]], PROJ, '2026-13')).toMatch(/illisible/);
  });

  it('lit les points de base exacts, et rien au-delà de deux décimales', () => {
    expect(enPointsDeBase(60.25)).toBe(6025);
    expect(enPointsDeBase(33.34)).toBe(3334);
    expect(enPointsDeBase(10.005)).toBeNull();
  });
});

describe('la version en vigueur', () => {
  const versions = [
    version('v1', 's1', 'p-proj', '2026-01', [['p1', 100]]),
    version('v2', 's1', 'p-proj', '2026-07', [['p2', 100]]),
    version('v3', 's1', 'p-proj', '2027-01', [['p3', 100]]),
  ];
  it('est la plus récente dont le mois ne dépasse pas celui de la paie', () => {
    expect(versionDuMois(versions, 's1', 'p-proj', '2026-06')?.id).toBe('v1');
    expect(versionDuMois(versions, 's1', 'p-proj', '2026-12')?.id).toBe('v2');
    expect(versionDuMois(versions, 's1', 'p-proj', '2027-03')?.id).toBe('v3');
    expect(versionDuMois(versions, 's1', 'p-proj', '2025-12')).toBeNull();
    expect(versionDuMois(versions, 's2', 'p-proj', '2026-12')).toBeNull();
  });
});

describe("la ventilation de l'écriture de paie", () => {
  it('répartit la part de chaque bulletin selon la répartition de son salarié, et chaque plan égale la ligne au centime', () => {
    const bulletins = [bulletin(1, 's1'), bulletin(2, 's2')];
    const p = proposer(bulletins);
    const v = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ],
      sections: SECTIONS,
      versions: [version('a', 's1', 'p-proj', '2026-11', [['p1', 60], ['p2', 40]]), version('b', 's2', 'p-proj', '2026-12', [['p2', 100]])],
    });
    expect(v.nonVentilees).toEqual([]);
    const i = ligneDe(p.lignes, '66110000');
    expect(p.lignes[i].montantFc).toBe(2_000_000);
    expect(v.parLigne[i].map((x) => [x.sectionCode, x.montantFc])).toEqual([
      ['P1', 600_000],
      ['P2', 1_400_000],
    ]);
    // Chaque ligne de classe 6 · la somme du plan égale la ligne, au centime.
    p.lignes.forEach((l, k) => {
      if (l.compte.startsWith('6')) {
        expect(v.parLigne[k].reduce((n, x) => n + centimes(x.montantFc), 0)).toBe(centimes(l.montantFc));
      } else {
        expect(v.parLigne[k]).toEqual([]);
      }
    });
    // La ligne de TOTAL des charges patronales (D 6641) se ventile aussi, sur la part de chacun.
    const patronales = ligneDe(p.lignes, '66410000');
    expect(p.lignes[patronales].montantFc).toBe(2 * 130_001);
    expect(v.parLigne[patronales].map((x) => [x.sectionCode, x.montantFc])).toEqual([
      ['P1', 78_000.6],
      ['P2', 182_001.4],
    ]);
  });

  it('les centimes qui manquent vont au plus fort reste · un tiers chacun ne perd ni ne crée un centime', () => {
    const bulletins = [bulletin(1, 's1', 1_000_000.01)];
    const p = proposer(bulletins);
    const v = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ],
      sections: SECTIONS,
      versions: [version('a', 's1', 'p-proj', '2026-12', [['p1', 33.33], ['p2', 33.33], ['p3', 33.34]])],
    });
    const i = ligneDe(p.lignes, '66110000');
    expect(v.parLigne[i].map((x) => [x.sectionCode, x.montantFc])).toEqual([
      ['P1', 333_300],
      ['P2', 333_300],
      ['P3', 333_400.01],
    ]);
  });

  it("un salarié sans répartition laisse la ligne non ventilée, sans reporter sa part sur les autres, et le dit", () => {
    const bulletins = [bulletin(1, 's1'), bulletin(2, 's2')];
    const p = proposer(bulletins);
    const v = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ],
      sections: SECTIONS,
      versions: [version('a', 's1', 'p-proj', '2026-12', [['p1', 100]])],
    });
    const i = ligneDe(p.lignes, '66110000');
    expect(v.parLigne[i]).toEqual([]);
    expect(v.nonVentilees.find((n) => n.index === i)?.motif).toBe('sans répartition · SALARIE 2');
    expect(v.reserves.join(' ')).toMatch(/SALARIE 2 n'a \(n'ont\) aucune répartition en vigueur pour 2026-12/);
  });

  it("un plan sans aucune répartition de la paie le dit une fois, et un plan qui ne ventile pas la classe se tait", () => {
    const bulletins = [bulletin(1, 's1')];
    const p = proposer(bulletins);
    const v = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ, { ...BAIL, classesVentilees: '2' }],
      sections: SECTIONS,
      versions: [],
    });
    expect(v.reserves).toHaveLength(1);
    expect(v.reserves[0]).toMatch(/^Plan PROJ · aucune répartition de la paie n'y est déclarée/);
    expect(v.nonVentilees.every((n) => n.planCode === 'PROJ')).toBe(true);
  });

  it('deux plans se ventilent chacun en entier, indépendamment', () => {
    const bulletins = [bulletin(1, 's1')];
    const p = proposer(bulletins);
    const v = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ, BAIL],
      sections: SECTIONS,
      versions: [version('a', 's1', 'p-proj', '2026-12', [['p1', 100]]), version('b', 's1', 'p-bail', '2026-12', [['b1', 100]])],
    });
    const i = ligneDe(p.lignes, '66110000');
    expect(v.parLigne[i].map((x) => [x.planCode, x.sectionCode, x.montantFc])).toEqual([
      ['PROJ', 'P1', 1_000_000],
      ['BAIL', 'B1', 1_000_000],
    ]);
  });

  it("une répartition vide, ou une section passée en sommeil depuis, laisse la ligne non ventilée et nomme la cause", () => {
    const bulletins = [bulletin(1, 's1')];
    const p = proposer(bulletins);
    const i = ligneDe(p.lignes, '66110000');
    const vide = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ],
      sections: SECTIONS,
      versions: [version('a', 's1', 'p-proj', '2026-01', [['p1', 100]]), version('b', 's1', 'p-proj', '2026-10', [])],
    });
    expect(vide.parLigne[i]).toEqual([]);
    expect(vide.nonVentilees.find((n) => n.index === i)?.motif).toBe("SALARIE 1 n'est plus réparti sur ce plan depuis 2026-10");
    const sommeil = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ],
      sections: SECTIONS,
      versions: [version('a', 's1', 'p-proj', '2026-01', [['p1', 50], ['dormante', 50]])],
    });
    expect(sommeil.parLigne[i]).toEqual([]);
    expect(sommeil.reserves.join(' ')).toMatch(/DORMANTE/);
    // Une part illisible ne se lit pas comme zéro · la ligne part non ventilée.
    const illisible = ventilerLaPaie({
      mois: '2026-12',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins,
      plans: [PROJ],
      sections: SECTIONS,
      versions: [version('a', 's1', 'p-proj', '2026-01', [['p1', 49.995], ['p2', 50.005]])],
    });
    expect(illisible.parLigne[i]).toEqual([]);
    expect(illisible.nonVentilees.find((n) => n.index === i)?.motif).toMatch(/illisible/);
  });
});

describe('relecture M3 · la reprise en négatif se ventile comme la pièce d’origine', () => {
  const VERSIONS = [version('a', 's1', 'p-proj', '2026-01', [['p1', 60], ['p2', 40]]), version('b', 's2', 'p-proj', '2026-01', [['p3', 100]])];
  /** L'écriture d'origine telle qu'au journal · ses lignes et, si demandé, la ventilation que la passation lui a donnée. */
  const origineDe = (passes: BulletinVentile[], ventilee: boolean) => {
    const p = propositionPaieDuMois('2026-11', 'SYSCOHADA', passes);
    const v = ventilerLaPaie({ mois: '2026-11', referentiel: 'SYSCOHADA', lignes: p.lignes, bulletins: passes, plans: [PROJ], sections: SECTIONS, versions: VERSIONS });
    return {
      ecritureId: 'e-origine',
      numeroPiece: '4',
      lignes: p.lignes.map((l, k) => ({
        compte: l.compte,
        intitule: l.intitule,
        debit: l.sens === 'DEBIT' ? l.montantFc : 0,
        credit: l.sens === 'CREDIT' ? l.montantFc : 0,
        ventilations: ventilee ? v.parLigne[k].map((x) => ({ planId: x.planId, sectionId: x.sectionId, montant: x.montantFc })) : [],
      })),
    };
  };
  const ventiler = (p: ReturnType<typeof propositionPaieDuMois>, passes: BulletinVentile[], tous: BulletinVentile[]) =>
    ventilerLaPaie({
      mois: '2026-11',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins: passes,
      plans: [PROJ],
      sections: SECTIONS,
      versions: VERSIONS,
      reprises: p.reprises.map((r) => ({
        mode: r.mode,
        origine: tous.find((b) => b.id === r.bulletinIds[0])!.origine!,
        bulletins: tous.filter((b) => r.bulletinIds.includes(b.id)),
        portes: tous.filter((b) => b.ecritureId === r.ecritureId),
      })),
    });

  it('RECOPIÉE (la pièce ne portait que lui) · chaque ligne reçoit, en négatif, la ventilation de sa ligne d’origine', () => {
    const origine = origineDe([bulletin(9, 's1')], true);
    const annule: BulletinVentile = { ...bulletin(9, 's1'), statut: 'ANNULE', ecritureId: 'e-origine', origine };
    const reemis = bulletin(10, 's1', 1_020_000);
    const p = propositionPaieDuMois('2026-11', 'SYSCOHADA', [annule, reemis]);
    expect(p.reprises.map((r) => r.mode)).toEqual(['EXACTE']);
    const v = ventiler(p, [reemis], [annule, reemis]);
    const k = p.lignes.findIndex((l) => l.bloc === 'REPRISE_EN_NEGATIF' && l.compte === '66110000');
    expect(v.parLigne[k].map((x) => [x.sectionCode, x.montantFc])).toEqual([['P1', -600_000], ['P2', -400_000]]);
    // Chaque ligne de classe 6 se ventile en entier, au centime, aucune ne part sans.
    for (const [index, l] of p.lignes.entries()) {
      if (!l.compte.startsWith('6')) continue;
      expect(centimes(v.parLigne[index].reduce((n, x) => n + x.montantFc, 0))).toBe(centimes(l.montantFc));
    }
    expect(v.nonVentilees).toEqual([]);
  });

  it('RECOPIÉE, pièce d’origine non ventilée · la cause vraie et l’issue qui la lève, jamais « déclarez la répartition »', () => {
    const origine = origineDe([bulletin(9, 's1')], false);
    const annule: BulletinVentile = { ...bulletin(9, 's1'), statut: 'ANNULE', ecritureId: 'e-origine', origine };
    const reemis = bulletin(10, 's1', 1_020_000);
    const p = propositionPaieDuMois('2026-11', 'SYSCOHADA', [annule, reemis]);
    const v = ventiler(p, [reemis], [annule, reemis]);
    const causes = new Set(v.nonVentilees.map((n) => n.cause));
    expect(causes).toEqual(new Set(['ORIGINE_NON_VENTILEE']));
    expect(v.nonVentilees[0].motif).toContain("pièce d'origine n° 4");
    expect(v.reserves.join(' ')).toContain("Ventilez d'abord la pièce d'origine");
    expect(issueDeLaCause('ORIGINE_NON_VENTILEE')).toContain("levez l'obligation de ventilation du plan");
  });

  it('REJOUÉE (la pièce portait deux salariés sur deux projets) · la part de l’annulé se reprend sur SES sections, jamais au prorata', () => {
    const passes = [bulletin(9, 's1'), bulletin(11, 's2')].map((b) => ({ ...b, ecritureId: 'e-origine' }));
    const origine = origineDe([bulletin(9, 's1'), bulletin(11, 's2')], true);
    const annule: BulletinVentile = { ...passes[0], statut: 'ANNULE', origine };
    const autre: BulletinVentile = { ...passes[1], origine: null };
    const reemis = bulletin(10, 's1', 1_020_000);
    const p = propositionPaieDuMois('2026-11', 'SYSCOHADA', [annule, autre, reemis]);
    expect(p.refus).toEqual([]);
    expect(p.reprises.map((r) => r.mode)).toEqual(['REJEU']);
    const v = ventiler(p, [reemis], [{ ...annule }, autre, reemis]);
    const k = p.lignes.findIndex((l) => l.negatif && l.compte === '66110000');
    // Le salarié 1 était à 60/40 sur P1 et P2 · P3, le projet du salarié 2, n'est pas touché.
    expect(v.parLigne[k].map((x) => [x.sectionCode, x.montantFc])).toEqual([['P1', -600_000], ['P2', -400_000]]);
    expect(v.nonVentilees).toEqual([]);
  });

  it('REJOUÉE, répartition changée depuis la pièce d’origine · rien ne se devine, la cause est dite', () => {
    const passes = [bulletin(9, 's1'), bulletin(11, 's2')].map((b) => ({ ...b, ecritureId: 'e-origine' }));
    const origine = origineDe([bulletin(9, 's1'), bulletin(11, 's2')], true);
    const annule: BulletinVentile = { ...passes[0], statut: 'ANNULE', origine };
    const reemis = bulletin(10, 's1', 1_020_000);
    const p = propositionPaieDuMois('2026-11', 'SYSCOHADA', [annule, passes[1], reemis]);
    const v = ventilerLaPaie({
      mois: '2026-11',
      referentiel: 'SYSCOHADA',
      lignes: p.lignes,
      bulletins: [reemis],
      plans: [PROJ],
      sections: SECTIONS,
      // Le salarié 1 passe à 100 % sur P1 à partir de novembre · la pièce d'origine ne se refait plus.
      versions: [...VERSIONS, version('c', 's1', 'p-proj', '2026-11', [['p1', 100]])],
      reprises: [{ mode: 'REJEU', origine, bulletins: [annule], portes: [annule, passes[1]] }],
    });
    const k = p.lignes.findIndex((l) => l.negatif && l.compte === '66110000');
    expect(v.parLigne[k]).toEqual([]);
    expect(v.nonVentilees.find((n) => n.index === k)?.cause).toBe('ORIGINE_NON_RECONSTITUEE');
  });
});
