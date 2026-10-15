import * as reports from '../relances/date-origine-des-reports';
import { classerTransactions, transactionsDesLignes, type LigneReglee } from './transactions-art-59-bis';

/**
 * LA TRANSACTION DE L'ART. 59 BIS (ligne sage-l2) · ce que ces tests
 * empêchent · une facture de 1 160 000 découpée en deux échéances de
 * 580 000, ou reportée en N+1, payée en espèces sans un mot parce que chaque
 * ligne réglée reste sous le seuil.
 */
const ecriture = (x: Partial<LigneReglee['ecriture']> = {}) => ({ date: new Date('2026-12-10'), numeroPiece: 7, libelle: 'Facture', ...x });
const ligne = (id: string, ecritureId: string, credit: number, e = ecriture(), dateEcheance: Date | null = null): LigneReglee => ({
  id,
  ecritureId,
  compteId: 'c401',
  debit: 0,
  credit,
  libelle: 'Facture',
  dateEcheance,
  compte: { numero: '40110001' },
  ecriture: e,
});

function doublure(lignesDeLaBase: Array<{ id: string; ecritureId: string; compteId: string; debit: number; credit: number; ecriture: Record<string, unknown> }>) {
  return {
    exercice: { findFirst: jest.fn(async () => ({ dateDebut: new Date('2027-01-01') })) },
    ligneEcriture: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => lignesDeLaBase.filter((l) => where.id.in.includes(l.id))),
      groupBy: jest.fn(async ({ where }: { where: { ecritureId: { in: string[] } } }) => {
        const parCle = new Map<string, { ecritureId: string; compteId: string; _sum: { debit: number; credit: number } }>();
        for (const l of lignesDeLaBase.filter((x) => where.ecritureId.in.includes(x.ecritureId))) {
          const cle = `${l.ecritureId}:${l.compteId}`;
          const g = parCle.get(cle) ?? { ecritureId: l.ecritureId, compteId: l.compteId, _sum: { debit: 0, credit: 0 } };
          g._sum.debit += l.debit;
          g._sum.credit += l.credit;
          parCle.set(cle, g);
        }
        return [...parCle.values()];
      }),
    },
  };
}

afterEach(() => jest.restoreAllMocks());

describe('la transaction d’une ligne réglée', () => {
  it('deux échéances d’une même facture · la pièce entière, une seule clé', async () => {
    const base = [
      { id: 'a', ecritureId: 'eF', compteId: 'c401', debit: 0, credit: 580_000, ecriture: {} },
      { id: 'b', ecritureId: 'eF', compteId: 'c401', debit: 0, credit: 580_000, ecriture: {} },
      { id: 'x', ecritureId: 'eF', compteId: 'c601', debit: 1_160_000, credit: 0, ecriture: {} },
    ];
    const r = await transactionsDesLignes(doublure(base) as never, {
      tenantId: 't',
      exerciceId: 'N',
      lignes: [ligne('a', 'eF', 580_000), ligne('b', 'eF', 580_000)],
    });
    // La ligne se juge seule, la pièce n'est servie que pour l'avis sous
    // condition · rien ne dit que ses deux lignes sont UNE facture (M3).
    expect(r.get('a')).toEqual({ cle: 'eF:c401', reference: 'pièce 7', ligne: 580_000, piece: 1_160_000, origineRetrouvee: true });
    expect(r.get('b')?.cle).toBe('eF:c401');
  });

  it('une ligne d’à-nouveau · lue sur SA pièce d’origine en N', async () => {
    const report = ecriture({ date: new Date('2027-01-01'), numeroPiece: 1, libelle: 'À-nouveaux', estGenereeParCloture: true, estSoldeDesComptesDeGestion: false });
    jest.spyOn(reports, 'originesDesReports').mockResolvedValue({ origines: new Map([['an1', { id: 'o1', date: new Date('2026-12-10') }]]), introuvables: [] });
    const base = [
      { id: 'o1', ecritureId: 'eN', compteId: 'c401', debit: 0, credit: 580_000, ecriture: { numeroPiece: 12, libelle: 'Facture N' } },
      { id: 'o2', ecritureId: 'eN', compteId: 'c401', debit: 0, credit: 580_000, ecriture: { numeroPiece: 12, libelle: 'Facture N' } },
    ];
    const r = await transactionsDesLignes(doublure(base) as never, {
      tenantId: 't',
      exerciceId: 'N1',
      lignes: [ligne('an1', 'eAN', 580_000, report, new Date('2027-02-08'))],
    });
    expect(r.get('an1')).toEqual({ cle: 'eN:c401', reference: 'pièce 12', ligne: 580_000, piece: 1_160_000, origineRetrouvee: true });
  });

  // RELECTURE « ÉCHECS SILENCIEUX », M3 · un bilan d'ouverture importé à une
  // ligne par compte (ou un report au solde) réunit plusieurs factures · lue
  // comme UNE transaction de son montant, la ligne de 3 000 000 faisait dire
  // « est une transaction d'au moins 1 000 000 » d'un compte qui n'en porte
  // peut-être aucune.
  it('une ligne d’à-nouveau sans origine retrouvée · NON JUGÉE, aucune transaction affirmée', async () => {
    const report = ecriture({ numeroPiece: 1, estGenereeParCloture: true });
    jest.spyOn(reports, 'originesDesReports').mockResolvedValue({ origines: new Map(), introuvables: ['an1'] });
    const r = await transactionsDesLignes(doublure([]) as never, {
      tenantId: 't',
      exerciceId: 'N1',
      lignes: [ligne('an1', 'eAN', 3_000_000, report)],
    });
    expect(r.get('an1')).toEqual({ cle: 'an1', reference: 'pièce 1', ligne: 3_000_000, piece: 3_000_000, origineRetrouvee: false });
    expect(classerTransactions(r.values(), 1_000_000)).toEqual({
      jugees: [],
      sousCondition: [],
      nonJugees: [{ reference: 'pièce 1', montant: 3_000_000 }],
    });
  });

  it('une origine qui est elle-même un à-nouveau (bilan d’ouverture du premier exercice) · non jugée aussi', async () => {
    const report = ecriture({ numeroPiece: 1, estGenereeParCloture: true });
    jest.spyOn(reports, 'originesDesReports').mockResolvedValue({ origines: new Map([['an1', { id: 'o1', date: new Date('2026-01-01') }]]), introuvables: [] });
    const base = [
      { id: 'o1', ecritureId: 'eBO', compteId: 'c401', debit: 0, credit: 3_000_000, ecriture: { numeroPiece: 1, libelle: 'Bilan d’ouverture', estGenereeParCloture: true } },
    ];
    const r = await transactionsDesLignes(doublure(base) as never, {
      tenantId: 't',
      exerciceId: 'N1',
      lignes: [ligne('an1', 'eAN', 3_000_000, report)],
    });
    expect(r.get('an1')?.origineRetrouvee).toBe(false);
  });

  it('la facture se lit dans SON sens · un avoir passé dans la même pièce ne la réduit pas', async () => {
    const base = [
      { id: 'a', ecritureId: 'eF', compteId: 'c401', debit: 0, credit: 1_200_000, ecriture: {} },
      { id: 'av', ecritureId: 'eF', compteId: 'c401', debit: 300_000, credit: 0, ecriture: {} },
    ];
    const r = await transactionsDesLignes(doublure(base) as never, { tenantId: 't', exerciceId: 'N', lignes: [ligne('a', 'eF', 1_200_000)] });
    expect(r.get('a')).toEqual(expect.objectContaining({ ligne: 1_200_000, piece: 1_200_000 }));
  });
});

describe('le classement des transactions d’un règlement (M3)', () => {
  const t = (cle: string, ligne: number, piece: number, origineRetrouvee = true) => ({ cle, reference: `pièce ${cle}`, ligne, piece, origineRetrouvee });

  it('la ligne au seuil est jugée seule ; sous le seuil, la pièce ne compte que SOUS CONDITION', () => {
    const c = classerTransactions([t('7', 1_500_000, 1_500_000), t('8', 600_000, 1_200_000), t('9', 400_000, 400_000)], 1_000_000);
    expect(c.jugees).toEqual([
      { reference: 'pièce 7', montant: 1_500_000 },
      { reference: 'pièce 9', montant: 400_000 },
    ]);
    expect(c.sousCondition).toEqual([{ reference: 'pièce 8', montant: 1_200_000 }]);
    expect(c.nonJugees).toEqual([]);
  });

  it('deux échéances d’une même pièce · une seule clé, nommée une fois', () => {
    const c = classerTransactions([t('8', 600_000, 1_200_000), t('8', 600_000, 1_200_000)], 1_000_000);
    expect(c.sousCondition).toHaveLength(1);
  });

  it('une échéance au seuil l’emporte sur la condition de sa pièce', () => {
    const c = classerTransactions([t('8', 1_100_000, 1_500_000), t('8', 400_000, 1_500_000)], 1_000_000);
    expect(c.jugees).toEqual([{ reference: 'pièce 8', montant: 1_100_000 }]);
    expect(c.sousCondition).toEqual([]);
  });
});
