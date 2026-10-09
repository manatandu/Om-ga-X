import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SensVirementFonds, StatutEcriture, StatutExercice } from '@prisma/client';
import { PLAN_COMPTES_SYSCOHADA } from '../comptes/compte-seed-syscohada';
import { PLAN_COMPTES_SYCEBNL } from '../comptes/compte-seed';
import { comptesDuPlanSubdivises, estCompteDePassage } from '../comptes/subdivisions-du-plan';
import { assurerComptesDePassage } from './comptes-de-passage';
import {
  COMPTE_DU_PLAN_585,
  COMPTES_DE_PASSAGE,
  lignesDuVirement,
  motifRefusVirement,
  sensDuVirement,
  type JournalDeTresorerie,
} from './virement-fonds';
import { VirementsFondsService } from './virements-fonds.service';

const banque = (id: string, numero: string, extra: Partial<JournalDeTresorerie> = {}): JournalDeTresorerie => ({
  id,
  code: id.toUpperCase(),
  type: 'TRESORERIE',
  estActif: true,
  compteTresorerie: { id: `c-${numero}`, numero, intitule: `Compte ${numero}` },
  ...extra,
});
const DEMANDE = { montant: 500_000, objet: 'Alimentation de la caisse', referencePiece: 'CHQ 0042', porteur: 'Kalala' };

describe('Le compte de passage est le 585, semé par les deux plans', () => {
  // AUDCIF Titre VII, compte 58 · 581 « Régies d'avance », 585 « Virements de
  // fonds » ; SYCEBNL Partie 2 ch. 3, compte 58, ni 581 ni régie. Les quatre
  // sous-comptes naissent sous un 58500000 que les DEUX semis portent.
  it.each([
    ['SYSCOHADA', PLAN_COMPTES_SYSCOHADA],
    ['SYCEBNL', PLAN_COMPTES_SYCEBNL],
  ])('%s sème le 58500000 « Virements de fonds »', (_r, plan) => {
    const c = (plan as Array<{ numero: string; intitule: string }>).find((x) => x.numero === COMPTE_DU_PLAN_585);
    expect(c?.intitule).toMatch(/Virements de fonds/i);
  });

  it('le 581 n’est jamais le compte de passage d’un virement', () => {
    const source = readFileSync(join(__dirname, 'virement-fonds.ts'), 'utf8');
    expect(source).toMatch(/COMPTE_DU_PLAN_585 = '58500000'/);
    expect(Object.values(COMPTES_DE_PASSAGE).map((c) => c.rang)).toEqual([1, 2, 3, 4]);
  });
});

describe('Le sens se lit sur les comptes des deux journaux', () => {
  it.each([
    ['52110000', '52120000', SensVirementFonds.BANQUE_BANQUE],
    ['52110000', '57110000', SensVirementFonds.BANQUE_CAISSE],
    ['57110000', '52110000', SensVirementFonds.CAISSE_BANQUE],
    ['57110000', '57120000', SensVirementFonds.CAISSE_CAISSE],
    // Un établissement financier (53) ou la monnaie électronique (55) se
    // virent comme une banque.
    ['53100000', '55100000', SensVirementFonds.BANQUE_BANQUE],
  ])('%s vers %s · %s', (o, d, sens) => {
    expect(sensDuVirement(o, d)).toBe(sens);
  });
});

describe('Les refus qui ne lisent rien', () => {
  const o = banque('bq', '52110000');
  const d = banque('ca', '57110000');

  it('admet un virement complet', () => {
    expect(motifRefusVirement(o, d, DEMANDE)).toBeNull();
  });
  it('refuse un journal qui n’est pas de trésorerie', () => {
    expect(motifRefusVirement(o, banque('ac', '40110000', { type: 'ACHAT' }), DEMANDE)).toMatch(/n'est pas un journal de banque ou de caisse/);
  });
  it('refuse un journal en sommeil ou sans compte', () => {
    expect(motifRefusVirement(o, { ...d, estActif: false }, DEMANDE)).toMatch(/en sommeil/);
    expect(motifRefusVirement(o, { ...d, compteTresorerie: null }, DEMANDE)).toMatch(/n'a pas de compte de trésorerie/);
  });
  it('refuse le même journal, ou deux journaux sur le même compte', () => {
    expect(motifRefusVirement(o, o, DEMANDE)).toMatch(/sont le même/);
    expect(motifRefusVirement(o, { ...d, compteTresorerie: o.compteTresorerie }, DEMANDE)).toMatch(/même compte 52110000/);
  });
  it('refuse un montant nul, négatif ou au-delà du centime', () => {
    expect(motifRefusVirement(o, d, { ...DEMANDE, montant: 0 })).toMatch(/positif/);
    expect(motifRefusVirement(o, d, { ...DEMANDE, montant: -1 })).toMatch(/positif/);
    expect(motifRefusVirement(o, d, { ...DEMANDE, montant: 10.005 })).toMatch(/centime/);
    expect(motifRefusVirement(o, d, { ...DEMANDE, montant: 10.05 })).toBeNull();
  });
  it('exige l’objet et la référence de la pièce (AUDCIF art. 17, 5°)', () => {
    expect(motifRefusVirement(o, d, { ...DEMANDE, objet: '  ' })).toMatch(/objet/);
    expect(motifRefusVirement(o, d, { ...DEMANDE, referencePiece: '' })).toMatch(/art\. 17, 5°/);
  });
  it('exige le porteur dès qu’une caisse est en jeu, jamais entre deux banques', () => {
    expect(motifRefusVirement(o, d, { ...DEMANDE, porteur: '' })).toMatch(/porteur/);
    expect(motifRefusVirement(d, o, { ...DEMANDE, porteur: undefined })).toMatch(/porteur/);
    expect(motifRefusVirement(o, banque('bq2', '52120000'), { ...DEMANDE, porteur: undefined })).toBeNull();
  });
});

describe('Les deux pièces soldent le 585', () => {
  it('origine D 585 / C sa trésorerie, destination D sa trésorerie / C 585', () => {
    const l = lignesDuVirement({ compteOrigineId: 'o', compteDestinationId: 'd', comptePassageId: 'p', montant: 750, libelle: 'x' });
    expect(l.origine).toEqual([
      { compteId: 'p', debit: 750, credit: 0, libelle: 'x' },
      { compteId: 'o', debit: 0, credit: 750, libelle: 'x' },
    ]);
    expect(l.destination).toEqual([
      { compteId: 'd', debit: 750, credit: 0, libelle: 'x' },
      { compteId: 'p', debit: 0, credit: 750, libelle: 'x' },
    ]);
    const solde585 = [...l.origine, ...l.destination].filter((x) => x.compteId === 'p').reduce((s, x) => s + x.debit - x.credit, 0);
    expect(solde585).toBe(0);
  });
});

describe('Les comptes de passage restent ouverts à la saisie', () => {
  it('585 et 588 sont des comptes de passage, le 581 non', () => {
    expect(estCompteDePassage('58500001')).toBe(true);
    expect(estCompteDePassage('58800000')).toBe(true);
    expect(estCompteDePassage('58100000')).toBe(false);
  });
  it('le 58500000 subdivisé par les virements n’est pas dit « subdivisé »', () => {
    const subdivises = comptesDuPlanSubdivises('SYSCOHADA', [
      { numero: '58500001', typeCompte: 'DETAIL', estActif: true },
      { numero: '52110001', typeCompte: 'DETAIL', estActif: true },
    ]);
    expect(subdivises.has('58500000')).toBe(false);
    expect(subdivises.has('52110000')).toBe(true);
  });
});

describe('assurerComptesDePassage', () => {
  function client(existants: string[], liens: Array<{ sens: SensVirementFonds; compte: { id: string; numero: string; intitule: string } }> = [], avec585 = true) {
    const crees: Array<{ numero: string; estRetenu: boolean; lettrable: boolean }> = [];
    const relies: Array<{ sens: string; compteId: string }> = [];
    return {
      crees,
      relies,
      tx: {
        compteVirementFonds: {
          findMany: async () => liens,
          create: async ({ data }: { data: { sens: string; compteId: string } }) => void relies.push(data),
        },
        tenant: { findUniqueOrThrow: async () => ({ referentiel: 'SYSCOHADA', longueurCompte: 8 }) },
        compte: {
          findUnique: async () => (avec585 ? { lettrable: false, modeReportANouveau: 'SOLDE' } : null),
          findMany: async () => [...existants, ...crees.map((c) => c.numero)].map((numero) => ({ numero })),
          create: async ({ data }: { data: { numero: string; intitule: string; estRetenu: boolean; lettrable: boolean } }) => {
            crees.push(data);
            return { id: `id-${data.numero}`, numero: data.numero, intitule: data.intitule };
          },
        },
      },
    };
  }

  it('ouvre les quatre au rang de leur sens, personnalisés, aux réglages du 58500000', async () => {
    const c = client(['58500000']);
    const r = await assurerComptesDePassage(c.tx as never, 't1');
    expect(c.crees.map((x) => x.numero)).toEqual(['58500001', '58500002', '58500003', '58500004']);
    expect(c.crees.every((x) => x.estRetenu && x.lettrable === false)).toBe(true);
    expect(r.CAISSE_BANQUE.numero).toBe('58500003');
    expect(c.relies).toHaveLength(4);
  });

  it('un rang déjà pris par le cabinet passe au premier numéro libre, sans rien écraser', async () => {
    const c = client(['58500000', '58500002']);
    await assurerComptesDePassage(c.tx as never, 't1');
    expect(c.crees.map((x) => x.numero)).toEqual(['58500001', '58500003', '58500004', '58500005']);
  });

  it('ne recrée rien de ce que le dossier tient déjà', async () => {
    const liens = (Object.keys(COMPTES_DE_PASSAGE) as SensVirementFonds[]).map((sens, i) => ({
      sens,
      compte: { id: `p${i}`, numero: `5850000${i + 1}`, intitule: 'x' },
    }));
    const c = client(['58500000'], liens);
    const r = await assurerComptesDePassage(c.tx as never, 't1');
    expect(c.crees).toEqual([]);
    expect(r.BANQUE_BANQUE.id).toBe('p0');
  });

  it('sans 58500000 au plan, refuse en le nommant', async () => {
    const c = client([], [], false);
    await expect(assurerComptesDePassage(c.tx as never, 't1')).rejects.toThrow(/58500000 « Virements de fonds » manque/);
  });
});

describe('VirementsFondsService.creer', () => {
  const passages = (Object.keys(COMPTES_DE_PASSAGE) as SensVirementFonds[]).map((sens, i) => ({
    sens,
    compte: { id: `p-${sens}`, numero: `5850000${i + 1}`, intitule: 'x' },
  }));
  function monter(journaux: JournalDeTresorerie[], ribs: Array<{ devise: string | null; journal: { code: string } }> = []) {
    const creerPlusieursAvec = jest.fn(async (_t: string, _u: string, dtos: unknown[], suite: (tx: unknown, e: unknown[]) => unknown) => {
      const tx = {
        ecriture: { findMany: async () => [{ id: 'e1', numeroPiece: '7' }, { id: 'e2', numeroPiece: '3' }] },
        virementFonds: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'v1', ...data })) },
      };
      const r = await suite(tx, [{ id: 'e1' }, { id: 'e2' }]);
      return { ecritures: dtos, suite: r };
    });
    const prisma = {
      journal: { findMany: async () => journaux },
      ribBanque: { findMany: async () => ribs },
      compteVirementFonds: { findMany: async () => passages },
      $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
    };
    return { service: new VirementsFondsService(prisma as never, { creerPlusieursAvec } as never), creerPlusieursAvec };
  }
  const dto = {
    exerciceId: 'x1',
    journalOrigineId: 'ca',
    journalDestinationId: 'bq',
    date: '2026-03-14',
    montant: 1_200_000,
    naturePiece: 'BORDEREAU_VERSEMENT' as const,
    referencePiece: ' BV-118 ',
    datePiece: '2026-03-14',
    objet: 'Versement de la recette',
    porteur: 'Mbuyi',
  };

  it('caisse vers banque · deux pièces au 58500003, la fiche porte les deux numéros', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
    const r = await service.creer('t1', 'u1', dto as never);
    const [, , pieces] = creerPlusieursAvec.mock.calls[0] as unknown as [string, string, Array<{ journalId: string; reference: string; lignes: Array<{ compteId: string; debit: number; credit: number }> }>];
    expect(pieces.map((p) => p.journalId)).toEqual(['ca', 'bq']);
    expect(pieces[0].lignes).toEqual([
      expect.objectContaining({ compteId: 'p-CAISSE_BANQUE', debit: 1_200_000, credit: 0 }),
      expect.objectContaining({ compteId: 'c-57110000', debit: 0, credit: 1_200_000 }),
    ]);
    expect(pieces[1].lignes).toEqual([
      expect.objectContaining({ compteId: 'c-52110000', debit: 1_200_000, credit: 0 }),
      expect.objectContaining({ compteId: 'p-CAISSE_BANQUE', debit: 0, credit: 1_200_000 }),
    ]);
    expect(pieces[0].reference).toBe('Bordereau de versement BV-118');
    expect(r).toMatchObject({ sens: 'CAISSE_BANQUE', referencePiece: 'BV-118', piecesPassees: 'CA n° 7 · BQ n° 3', porteur: 'Mbuyi', montant: 1_200_000 });
  });

  it('refuse AVANT toute pièce un journal qui n’est pas de trésorerie', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '40110000', { type: 'ACHAT' })]);
    await expect(service.creer('t1', 'u1', dto as never)).rejects.toThrow(BadRequestException);
    expect(creerPlusieursAvec).not.toHaveBeenCalled();
  });

  it('refuse un journal dont le RIB est en devise, et dit le geste de rechange', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')], [{ devise: 'USD', journal: { code: 'BQ' } }]);
    await expect(service.creer('t1', 'u1', dto as never)).rejects.toThrow(/BQ est tenu en USD.*à la main/);
    expect(creerPlusieursAvec).not.toHaveBeenCalled();
  });

  it('un RIB au franc ne gêne rien', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')], [{ devise: 'cdf', journal: { code: 'BQ' } }]);
    await service.creer('t1', 'u1', dto as never);
    expect(creerPlusieursAvec).toHaveBeenCalledTimes(1);
  });
});

describe('VirementsFondsService.annuler', () => {
  function monter(opts: {
    statuts: Record<string, StatutEcriture>;
    exercice?: StatutExercice;
    annuleLe?: Date | null;
    lettre?: string | null;
    supprimees?: number;
  }) {
    const updates: Array<Record<string, unknown>> = [];
    const supprimes: string[] = [];
    const inscrireEnNegatifPourAnnulation = jest.fn(async (_t: string, _u: string, id: string) => ({ id: `neg-${id}` }));
    const prisma: Record<string, unknown> = {
      virementFonds: {
        findFirst: async () => ({
          id: 'v1',
          annuleLe: opts.annuleLe ?? null,
          ecritureOrigineId: 'e1',
          ecritureDestinationId: 'e2',
          exercice: { statut: opts.exercice ?? StatutExercice.OUVERT },
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return { id: 'v1', ...data };
        },
      },
      ecriture: {
        findMany: async () =>
          ['e1', 'e2'].map((id) => ({ id, numeroPiece: id, statut: opts.statuts[id], lignes: [{ lettre: opts.lettre ?? null, lettrageId: opts.lettre ? 'g1' : null, rapprochementId: null }] })),
        findFirst: async ({ where }: { where: { id: string } }) => ({ statut: opts.statuts[where.id] }),
        deleteMany: async ({ where }: { where: { id: string } }) => {
          supprimes.push(where.id);
          return { count: opts.supprimees ?? 1 };
        },
      },
      ligneEcriture: { deleteMany: async () => ({ count: 2 }) },
    };
    prisma.$transaction = async (fn: (tx: unknown) => unknown) => fn(prisma);
    const service = new VirementsFondsService(prisma as never, { inscrireEnNegatifPourAnnulation } as never);
    return { service, updates, supprimes, inscrireEnNegatifPourAnnulation };
  }

  it('au brouillard · les deux pièces retirées, la fiche marquée annulée, jamais supprimée', async () => {
    const m = monter({ statuts: { e1: StatutEcriture.BROUILLARD, e2: StatutEcriture.BROUILLARD } });
    await m.service.annuler('t1', 'u1', 'v1', { motif: ' Doublon ' });
    expect(m.supprimes).toEqual(['e1', 'e2']);
    expect(m.inscrireEnNegatifPourAnnulation).not.toHaveBeenCalled();
    expect(m.updates.at(-1)).toMatchObject({ annulePar: 'u1', motifAnnulation: 'Doublon', ecritureOrigineId: null, ecritureDestinationId: null });
  });

  it('validées · chacune inscrite en négatif (AUDCIF art. 20, al. 2), la fiche retient pièce et négatif', async () => {
    const m = monter({ statuts: { e1: StatutEcriture.VALIDEE, e2: StatutEcriture.VALIDEE } });
    await m.service.annuler('t1', 'u1', 'v1', { motif: 'Erreur de caisse' });
    expect(m.supprimes).toEqual([]);
    expect(m.inscrireEnNegatifPourAnnulation.mock.calls.map((c) => c[2])).toEqual(['e1', 'e2']);
    expect(m.updates.at(-1)).toMatchObject({
      ecritureOrigineId: 'e1',
      ecritureDestinationId: 'e2',
      ecritureNegatifOrigineId: 'neg-e1',
      ecritureNegatifDestinationId: 'neg-e2',
    });
  });

  it('une pièce validée entre-temps · rien ne passe, 409 qui dit de relancer', async () => {
    const m = monter({ statuts: { e1: StatutEcriture.BROUILLARD, e2: StatutEcriture.BROUILLARD }, supprimees: 0 });
    await expect(m.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' })).rejects.toThrow(/validée pendant l'annulation/);
  });

  it('refuse une ligne lettrée, un exercice clôturé, un virement déjà annulé', async () => {
    await expect(
      monter({ statuts: { e1: StatutEcriture.VALIDEE, e2: StatutEcriture.VALIDEE }, lettre: 'AA' }).service.annuler('t1', 'u1', 'v1', { motif: 'x y z' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      monter({ statuts: {}, exercice: StatutExercice.CLOTURE }).service.annuler('t1', 'u1', 'v1', { motif: 'x y z' }),
    ).rejects.toThrow(/clôturé/);
    await expect(
      monter({ statuts: {}, annuleLe: new Date() }).service.annuler('t1', 'u1', 'v1', { motif: 'x y z' }),
    ).rejects.toThrow(ConflictException);
  });
});
