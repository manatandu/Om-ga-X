import { BadRequestException } from '@nestjs/common';
import { propositionPaieDuMois, type BulletinAComptabiliser, type OrigineDuBulletin } from './comptabilisation-paie';
import { compteDuPaiement, intituleDuCompteSalarie } from './compte-salarie';
import { ouvrirCompteSalarie } from './comptes-salaries.service';

/**
 * LIGNE PAIE-SUITE, FONCTION 76 · LE COMPTE INDIVIDUEL DU SALARIÉ SOUS LE 422.
 * Chaque test porte un défaut qui laisserait l'écriture équilibrée et la
 * balance générale bouclée · un net inscrit au collectif et payé sur le compte
 * du salarié, une reprise sur le mauvais 422, un compte ouvert deux fois.
 */

const bulletin = (numero: number, over: Partial<BulletinAComptabiliser> = {}): BulletinAComptabiliser => ({
  id: `b${numero}`,
  numero,
  nomComplet: `SALARIE ${numero}`,
  statut: 'EMIS',
  ecritureId: null,
  netAPayerFc: 1_250_000,
  entree: {
    elements: [
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
      { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
    ],
  },
  calcul: {
    cotisations: {
      lignes: [
        { cle: 'cnss-pf', charge: 'EMPLOYEUR', montantFc: 65_000 },
        { cle: 'cnss-pension-employeur', charge: 'EMPLOYEUR', montantFc: 50_000 },
        { cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: 50_000 },
        { cle: 'cnss-rp', charge: 'EMPLOYEUR', montantFc: 15_000 },
        { cle: 'inpp', charge: 'EMPLOYEUR', montantFc: 35_000 },
        { cle: 'onem', charge: 'EMPLOYEUR', montantFc: 5_000 },
      ],
      abstentions: [],
    },
    retenue: { retenueFc: 100_000 },
    net: { netAPayerFc: 1_250_000 },
  },
  ...over,
});

const KABONGO = { numero: '42200001', intitule: 'KABONGO Jean · rémunérations dues' };

/** Mouvement net de chaque compte, débit positif. */
const net = (p: ReturnType<typeof propositionPaieDuMois>) => {
  const m = new Map<string, number>();
  for (const l of p.lignes) m.set(l.compte, Math.round(((m.get(l.compte) ?? 0) + (l.sens === 'DEBIT' ? l.montantFc : -l.montantFc)) * 100) / 100);
  return m;
};

const origineDe = (ecritureId: string, lignes: ReturnType<typeof propositionPaieDuMois>['lignes']): OrigineDuBulletin => ({
  ecritureId,
  numeroPiece: '7',
  lignes: lignes.map((l) => ({
    compte: l.compte,
    intitule: l.intitule,
    debit: l.sens === 'DEBIT' ? l.montantFc : 0,
    credit: l.sens === 'CREDIT' ? l.montantFc : 0,
  })),
});

describe('la passation · le 422 éclaté par compte', () => {
  const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1, { compte422: KABONGO }), bulletin(2)]);

  it('crédite le brut et débite les retenues sur le compte du salarié, le reste au collectif', () => {
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    const brut = p.lignes.filter((l) => l.bloc === 'BRUT' && l.sens === 'CREDIT');
    expect(brut.map((l) => [l.compte, l.montantFc, l.bulletinIds])).toEqual([
      ['42200000', 1_400_000, ['b2']],
      ['42200001', 1_400_000, ['b1']],
    ]);
    // Le net de chacun reste dû sur SON compte.
    expect(net(p).get('42200001')).toBe(-1_250_000);
    expect(net(p).get('42200000')).toBe(-1_250_000);
  });

  it('le solde du 422 lit le collectif ET les comptes nés sous lui', () => {
    expect(p.solde422Fc).toBe(2_500_000);
    expect(p.sommeDesNetsFc).toBe(2_500_000);
  });

  it('sans compte individuel, une seule ligne au collectif, comme avant', () => {
    const q = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1), bulletin(2)]);
    const brut = q.lignes.filter((l) => l.bloc === 'BRUT' && l.sens === 'CREDIT');
    expect(brut.map((l) => [l.compte, l.montantFc, l.bulletinIds])).toEqual([['42200000', 2_800_000, undefined]]);
  });
});

describe('la reprise en négatif · sur le 422 où le bulletin a été passé', () => {
  const lignesPassees = (compte422: typeof KABONGO | null) =>
    propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1, { compte422 })]).lignes;

  it('passé sur son compte · repris sur son compte', () => {
    const annule = bulletin(1, { statut: 'ANNULE', ecritureId: 'e1', origine: origineDe('e1', lignesPassees(KABONGO)), compte422: KABONGO });
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [annule]);
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    expect(net(p).get('42200001')).toBe(1_250_000);
    expect(net(p).has('42200000')).toBe(false);
  });

  it('passé au collectif avant l’ouverture de son compte · repris au collectif', () => {
    const annule = bulletin(1, { statut: 'ANNULE', ecritureId: 'e1', origine: origineDe('e1', lignesPassees(null)), compte422: KABONGO });
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [annule]);
    expect(net(p).get('42200000')).toBe(1_250_000);
    expect(net(p).has('42200001')).toBe(false);
  });

  it('pièce commune (un salarié sur son compte, l’autre au collectif) · rejouée, seul le bulletin annulé est repris', () => {
    const commune = origineDe('e1', propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1, { compte422: KABONGO }), bulletin(2)]).lignes);
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [
      bulletin(1, { statut: 'ANNULE', ecritureId: 'e1', origine: commune, compte422: KABONGO }),
      bulletin(2, { ecritureId: 'e1' }),
    ]);
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    expect(net(p).get('42200001')).toBe(1_250_000);
    expect(net(p).has('42200000')).toBe(false);
  });
});

describe('le paiement · le compte où le net a été inscrit', () => {
  it.each([
    [{ compteIndividuelId: null, passe: true, passeSurSonCompte: false, option: true }, 'COLLECTIF'],
    [{ compteIndividuelId: 'c1', passe: true, passeSurSonCompte: true, option: false }, 'INDIVIDUEL'],
    // Passé avant l'ouverture du compte · payé là où le net a été inscrit.
    [{ compteIndividuelId: 'c1', passe: true, passeSurSonCompte: false, option: true }, 'COLLECTIF'],
    [{ compteIndividuelId: 'c1', passe: false, passeSurSonCompte: false, option: true }, 'INDIVIDUEL'],
    [{ compteIndividuelId: 'c1', passe: false, passeSurSonCompte: false, option: false }, 'COLLECTIF'],
  ] as const)('%o · %s', (b, attendu) => {
    expect(compteDuPaiement(b)).toBe(attendu);
  });
});

describe("l'ouverture du compte", () => {
  const monter = (p: { salarie?: Record<string, unknown> | null; collectif?: Record<string, unknown> | null; existants?: string[] } = {}) => {
    const cree: Record<string, unknown>[] = [];
    const maj: Record<string, unknown>[] = [];
    const tx = {
      $executeRaw: jest.fn(),
      tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA', longueurCompte: 8 })) },
      salarie: {
        findFirst: jest.fn(async () =>
          p.salarie === undefined ? { id: 's1', nom: 'KABONGO', postNom: null, prenoms: 'Jean', matricule: '001', compteId: null, compte: null } : p.salarie,
        ),
        update: jest.fn(async (a: Record<string, unknown>) => (maj.push(a), {})),
      },
      compte: {
        findFirst: jest.fn(async () =>
          p.collectif === undefined
            ? { id: 'c422', numero: '42200000', estActif: true, typeCompte: 'DETAIL', classe: 4, modeReportANouveau: 'DETAIL', lettrable: true }
            : p.collectif,
        ),
        findMany: jest.fn(async () => (p.existants ?? ['42200000']).map((numero) => ({ numero }))),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => (cree.push(data), { id: 'nouveau', numero: data.numero })),
      },
    };
    return { tx, cree, maj };
  };

  it('naît au premier numéro libre sous le 422, lié au collectif, au nom du salarié, sous le verrou', async () => {
    const { tx, cree, maj } = monter({ existants: ['42200000', '42200001'] });
    const r = await ouvrirCompteSalarie(tx as never, 't', 's1');
    expect(r).toEqual({ ouvert: true, compte: { id: 'nouveau', numero: '42200002' } });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(cree[0]).toMatchObject({ tenantId: 't', numero: '42200002', collectifId: 'c422', intitule: 'KABONGO Jean (001) · rémunérations dues' });
    expect(maj[0]).toEqual({ where: { id: 's1', tenantId: 't' }, data: { compteId: 'nouveau' } });
  });

  it('un compte déjà ouvert n’en ouvre pas un second', async () => {
    const { tx, cree } = monter({ salarie: { id: 's1', nom: 'K', postNom: null, prenoms: null, matricule: null, compteId: 'c1', compte: { id: 'c1', numero: '42200001' } } });
    expect(await ouvrirCompteSalarie(tx as never, 't', 's1')).toEqual({ ouvert: false, compte: { id: 'c1', numero: '42200001' } });
    expect(cree).toEqual([]);
  });

  it('un 422 non ouvert en imputation refuse, en le nommant', async () => {
    const { tx } = monter({ collectif: null });
    await expect(ouvrirCompteSalarie(tx as never, 't', 's1')).rejects.toThrow(BadRequestException);
    await expect(ouvrirCompteSalarie(tx as never, 't', 's1')).rejects.toThrow(/42200000/);
  });

  it('l’intitulé porte le nom et le matricule', () => {
    expect(intituleDuCompteSalarie({ nom: 'MUKENDI', postNom: 'WA', prenoms: 'Paul', matricule: null })).toBe('MUKENDI WA Paul · rémunérations dues');
  });
});
