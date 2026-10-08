import { ConflictException } from '@nestjs/common';
import { Referentiel, StatutEcriture, StatutExercice } from '@prisma/client';

/**
 * LIGNE AU3, relecture adverse (m6) · le SERVICE de la déclaration · le
 * contexte qu'il lit (B1, M1), l'héritage ligne à ligne (M2), la pièce de
 * correction (M3) et le lettrage du négatif. Les règles pures sont gelées par
 * `declaration-devise-a-nouveau.spec.ts` ; ici, ce que le service DEMANDE à la
 * base et ce qu'il écrit.
 */

jest.mock('../../common/audit/transaction-journalisee', () => ({
  transactionJournalisee: (prisma: { __tx: unknown }, fn: (tx: unknown) => unknown) => fn(prisma.__tx),
}));
jest.mock('../journaux/numerotation-piece', () => ({ prochainNumeroPiece: jest.fn().mockResolvedValue(42) }));
jest.mock('../exercice/gel-cloture', () => ({ lignesFigees: jest.fn().mockResolvedValue(new Map()) }));
jest.mock('../lettrage/lettrage.service', () => ({
  prochaineLettreDuCompte: jest.fn().mockResolvedValue(() => 'AB'),
  poserGroupeSoldeDuModule: jest.fn().mockResolvedValue('AB'),
}));

// eslint-disable-next-line import/first
import { DeclarationDeviseANouveauService } from './declaration-devise-a-nouveau.service';
// eslint-disable-next-line import/first
import { lignesFigees } from '../exercice/gel-cloture';
// eslint-disable-next-line import/first
import { poserGroupeSoldeDuModule } from '../lettrage/lettrage.service';

const N = { id: 'ex-n', statut: StatutExercice.CLOTURE, dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
const N1 = { id: 'ex-n1', statut: StatutExercice.OUVERT, dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31') };

function ligneLue(sur: Record<string, unknown> = {}, ecriture: Record<string, unknown> = {}) {
  return {
    id: 'l-import',
    compteId: 'c401',
    libelle: 'Fournisseur X',
    debit: 0,
    credit: 3_200_000,
    deviseId: null,
    lettre: null,
    lettrageId: null,
    rapprochementId: null,
    dateEcheance: null,
    ecritureId: 'e-import',
    _count: { ventilations: 0 },
    compte: { numero: '40110101', intitule: 'Fournisseur X' },
    ...sur,
    ecriture: {
      id: 'e-import',
      tenantId: 't',
      exerciceId: N1.id,
      journalId: 'j-od',
      date: N1.dateDebut,
      numeroPiece: 1,
      reference: 'IMPORT',
      statut: StatutEcriture.VALIDEE,
      estGenereeParCloture: true,
      estANouveauProvisoire: false,
      estSoldeDesComptesDeGestion: false,
      exercice: N1,
      ...ecriture,
    },
  };
}

interface Options {
  ligne?: ReturnType<typeof ligneLue>;
  reglement?: number;
  reevaluationPosterieure?: boolean;
  doubleRegard?: boolean;
}

function monter(o: Options = {}) {
  const ligne = o.ligne ?? ligneLue();
  const ecritureCreee = {
    id: 'e-corr',
    lignes: [
      { id: 'l-neg', debit: -0, credit: -3_200_000, deviseId: null },
      { id: 'l-usd', debit: 0, credit: 3_200_000, deviseId: 'd-usd' },
    ],
  };
  const tx = {
    ligneEcriture: { count: jest.fn().mockResolvedValue(1) },
    ecriture: { create: jest.fn().mockResolvedValue(ecritureCreee) },
    compte: { findFirst: jest.fn().mockResolvedValue({ id: 'c401' }) },
    declarationDeviseANouveau: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'd1', ...data })) },
  };
  const prisma = {
    __tx: tx,
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA, doubleRegardValidation: o.doubleRegard === true }),
    },
    devise: { findMany: jest.fn().mockResolvedValue([{ id: 'd-usd', code: 'USD' }]) },
    exercice: { findFirst: jest.fn().mockResolvedValue(null) },
    reevaluation: {
      findMany: jest.fn().mockResolvedValue([
        {
          ecritureEcartsId: 'e-ecarts',
          ecritureProvisionId: null,
          ecritureExtourneId: 'e-extourne',
          contrePassationDeclareeId: null,
          annulation: [{ ecritureId: 'e-ancien', negatifId: 'e-ancien-neg' }],
          annulationsContrePassation: null,
        },
      ]),
      findFirst: jest.fn().mockResolvedValue(
        o.reevaluationPosterieure
          ? { dateReevaluation: new Date('2029-12-31'), exercice: { id: 'ex-n2', dateDebut: new Date('2029-01-01'), dateFin: new Date('2029-12-31') } }
          : null,
      ),
    },
    declarationDeviseANouveau: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ ecritureCorrectionId: 'e-corr-autre' }]),
    },
    ligneEcriture: {
      findFirst: jest.fn().mockResolvedValue(ligne),
      aggregate: jest.fn().mockResolvedValue({ _sum: { debit: o.reglement ?? 0, credit: 0 } }),
      findMany: jest.fn().mockResolvedValue(
        o.reglement ? [{ debit: o.reglement, credit: 0, ecriture: { numeroPiece: 7, date: new Date('2028-03-15') } }] : [],
      ),
      count: jest.fn().mockResolvedValue(o.reglement ? 1 : 0),
    },
  };
  const ecritureService = {
    controlesDEntree: jest.fn().mockResolvedValue({ journal: { id: 'j-od' }, date: N1.dateDebut, dateValeur: null }),
  };
  const devises = { sousVerrouDuDossier: (_t: string, _g: string, f: () => unknown) => f() };
  const svc = new DeclarationDeviseANouveauService(prisma as never, ecritureService as never, devises as never);
  return { svc, prisma, tx };
}

const USD = { ligneId: 'l-import', parts: [{ deviseId: 'd-usd', montantDevise: 1500, montant: 3_200_000 }], source: 'Facture F-1 du fournisseur' };

describe('Déclaration de la devise d’un à-nouveau · le service (AU3, relecture adverse)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('B1 · un règlement de 2 150 000 FC non lettré sur le 401 refuse la déclaration, nommé · la base lit la colonne du règlement', async () => {
    const { svc, prisma } = monter({ reglement: 2_150_000 });
    const essai = svc.declarer('t', 'u', USD);
    await expect(essai).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.declarer('t', 'u', USD)).rejects.toThrow(/pièce 7 du 2028-03-15, 2150000/);
    const where = prisma.ligneEcriture.aggregate.mock.calls[0][0].where;
    expect(where).toMatchObject({ compteId: 'c401', deviseId: null, lettrageId: null, id: { not: 'l-import' } });
    // Ni les écritures de réévaluation (et leurs négatifs), ni les corrections
    // d'autres déclarations ne sont des règlements.
    expect(where.ecriture.id.notIn).toEqual(expect.arrayContaining(['e-ecarts', 'e-extourne', 'e-ancien', 'e-ancien-neg', 'e-corr-autre']));
    // Un import · seules les écritures ordinaires postérieures, jamais les autres à-nouveaux.
    expect(where.ecriture.OR).toEqual([{ estGenereeParCloture: false, date: { gte: N1.dateDebut } }]);
    // Une dette se règle au débit · le listage ne lit que cette colonne.
    expect(prisma.ligneEcriture.findMany.mock.calls[0][0].where.AND[1]).toEqual({ debit: { gt: 0 } });
  });

  it('B1 · un REPORT lit aussi les autres lignes reportées du même exercice (un règlement de N y revient en francs)', async () => {
    const { svc, prisma } = monter({ ligne: ligneLue({ libelle: 'RAN détail 40110101 · Fournisseur X' }, { reference: null }) });
    await svc.declarer('t', 'u', USD);
    const or = prisma.ligneEcriture.aggregate.mock.calls[0][0].where.ecriture.OR;
    expect(or[1]).toEqual({ estGenereeParCloture: true, exerciceId: N1.id, NOT: { reference: 'IMPORT' } });
  });

  it('M1 · une réévaluation d’un exercice POSTÉRIEUR refuse · la base lit tout exercice qui commence au plus tôt avec celui de la ligne', async () => {
    const { svc, prisma } = monter({ reevaluationPosterieure: true });
    await expect(svc.declarer('t', 'u', USD)).rejects.toThrow(/le report de cette ligne en francs/);
    expect(prisma.reevaluation.findFirst.mock.calls[0][0].where).toMatchObject({
      annuleeLe: null,
      dateReevaluation: { gte: N1.dateDebut },
      exercice: { dateDebut: { gte: N1.dateDebut } },
    });
  });

  it('M3 · la pièce de correction n’est PAS une écriture de clôture · validée, négatif lettré avec l’origine', async () => {
    const { svc, tx } = monter();
    const r = await svc.declarer('t', 'u', USD);
    const data = tx.ecriture.create.mock.calls[0][0].data;
    expect(data.estGenereeParCloture).toBeUndefined();
    expect(data).toMatchObject({ statut: StatutEcriture.VALIDEE, valideeBy: 'u', createdBy: 'u', reference: 'DECLARATION-DEVISE' });
    // L'inscription en négatif, puis la part exacte en USD.
    expect(data.lignes.create).toEqual([
      expect.objectContaining({ compteId: 'c401', debit: -0, credit: -3_200_000 }),
      expect.objectContaining({ compteId: 'c401', debit: 0, credit: 3_200_000, deviseId: 'd-usd', montantDevise: 1500 }),
    ]);
    expect(lignesFigees).toHaveBeenCalledWith(tx, 't', ['l-import', 'l-neg']);
    expect(poserGroupeSoldeDuModule).toHaveBeenCalledWith(tx, expect.objectContaining({ ligneIds: ['l-import', 'l-neg'], code: 'AB' }));
    expect(tx.declarationDeviseANouveau.create.mock.calls[0][0].data).toMatchObject({
      mode: 'CORRECTION',
      ecritureCorrectionId: 'e-corr',
      lignesResultantes: ['l-neg', 'l-usd'],
    });
    expect(r.messages.join(' ')).toMatch(/lettrée \(AB\)/);
  });

  it('M3 · sous le DOUBLE REGARD, la pièce reste au brouillard pour un autre validateur, et c’est dit', async () => {
    const { svc, tx } = monter({ doubleRegard: true });
    const r = await svc.declarer('t', 'u', USD);
    const data = tx.ecriture.create.mock.calls[0][0].data;
    expect(data.statut).toBe(StatutEcriture.BROUILLARD);
    expect(data.valideeBy).toBeUndefined();
    expect(r.messages.join(' ')).toMatch(/Double regard actif/);
  });

  it('M2 · le négatif resté ouvert (période figée) et l’origine, reportés en N+1, ne se redéclarent jamais', async () => {
    const reportOrigine = ligneLue({ id: 'r-o', libelle: 'RAN détail 40110101 · Fournisseur X' }, { reference: null });
    const { svc, prisma } = monter({ ligne: reportOrigine });
    prisma.exercice.findFirst.mockResolvedValue({ id: N.id, dateDebut: N.dateDebut, dateFin: N.dateFin });
    prisma.declarationDeviseANouveau.findMany.mockImplementation(({ where }: { where: { exerciceId?: string } }) =>
      Promise.resolve(where.exerciceId === N.id ? [{ ligneOrigineId: 'o1', lignesResultantes: ['l-neg', 'l-usd'] }] : []),
    );
    prisma.ligneEcriture.findMany.mockImplementation(({ where }: { where: { id?: { in?: string[] } } }) =>
      Promise.resolve(
        where.id?.in
          ? [
              { id: 'o1', compteId: 'c401', debit: 0, credit: 3_200_000, libelle: 'Fournisseur X', dateEcheance: null },
              { id: 'l-neg', compteId: 'c401', debit: 0, credit: -3_200_000, libelle: 'Fournisseur X', dateEcheance: null },
            ]
          : [],
      ),
    );
    await expect(svc.declarer('t', 'u', USD)).rejects.toThrow(/reporte une ligne de l'exercice précédent dont la devise a déjà été déclarée/);
    // Le report du négatif, de même.
    const reportNegatif = ligneLue({ id: 'r-n', libelle: 'RAN détail 40110101 · Fournisseur X', credit: -3_200_000 }, { reference: null });
    prisma.ligneEcriture.findFirst.mockResolvedValue(reportNegatif);
    await expect(svc.declarer('t', 'u', USD)).rejects.toThrow(/déjà été déclarée/);
  });

  it('une période figée · le négatif n’est pas lettré, et c’est dit', async () => {
    (lignesFigees as jest.Mock).mockResolvedValueOnce(new Map([['l-import', { date: N1.dateDebut, motif: 'clôture' }]]));
    const { svc } = monter();
    const r = await svc.declarer('t', 'u', USD);
    expect(poserGroupeSoldeDuModule).not.toHaveBeenCalled();
    expect(r.messages.join(' ')).toMatch(/non lettrées/);
  });
});

describe('Ce qui reste à déclarer · l’héritage ligne à ligne (M2)', () => {
  function monterListe(reportsN1: Array<ReturnType<typeof ligneLue>>, sansLibelle = false) {
    const importN = ligneLue(
      { id: 'o1', ...(sansLibelle ? { libelle: null } : {}) },
      { exerciceId: N.id, date: N.dateDebut, exercice: N, libelle: "Bilan d'ouverture · bilan-2026.csv" },
    );
    const prisma = {
      devise: { findMany: jest.fn().mockResolvedValue([{ id: 'd-usd', code: 'USD' }]) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA }) },
      exercice: { findMany: jest.fn().mockResolvedValue([N, N1]), findFirst: jest.fn().mockResolvedValue(null) },
      declarationDeviseANouveau: { findMany: jest.fn().mockResolvedValue([]) },
      reevaluation: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      ligneEcriture: {
        findMany: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(where.ecriture?.exerciceId === N.id ? [importN] : where.ecriture?.exerciceId === N1.id ? reportsN1 : []),
        ),
        aggregate: jest.fn().mockResolvedValue({ _sum: { debit: 0, credit: 0 } }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const svc = new DeclarationDeviseANouveauService(prisma as never, {} as never, {} as never);
    return svc.restantADeclarer('t');
  }
  const report = (id: string, libelle: string, credit: number) =>
    ligneLue({ id, libelle, credit }, { reference: null, exerciceId: N1.id });

  it('seul le report de la ligne importée hérite · la facture en francs reportée sur le même compte n’entre pas', async () => {
    const r = await monterListe([
      report('r1', 'RAN détail 40110101 · Fournisseur X', 3_200_000),
      report('r2', 'RAN détail 40110101 · Facture F-9', 1_000_000),
    ]);
    expect(r.lignes.map((l) => [l.ligneId, l.origine, l.motifRefus])).toEqual([['r1', 'REPORT', null]]);
    expect(r.nonRetrouvees).toEqual([]);
  });

  it('une ligne importée SANS libellé · le report recopie celui de l’écriture, et l’appariement le suit (rejeu sur vraie base)', async () => {
    const r = await monterListe([report('r1', "RAN détail 40110101 · Bilan d'ouverture · bilan-2026.csv", 3_200_000)], true);
    expect(r.lignes.map((l) => l.ligneId)).toEqual(['r1']);
    expect(r.nonRetrouvees).toEqual([]);
  });

  it('un report au SOLDE · rien n’hérite, la ligne importée est NOMMÉE', async () => {
    const r = await monterListe([report('r1', 'Report à-nouveau 40110101 · Fournisseurs', 4_200_000)]);
    expect(r.lignes).toEqual([]);
    expect(r.nonRetrouvees).toEqual([
      { exercice: '2027', exerciceSuivant: '2028', compteNumero: '40110101', montant: -3_200_000, motif: 'NON_RETROUVE' },
    ]);
  });
});
