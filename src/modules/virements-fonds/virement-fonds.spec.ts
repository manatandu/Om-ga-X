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
  RACINES_TRESORERIE_EN_DEVISES,
  estAuCentime,
  estTresorerieEnDevises,
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
const DEMANDE = {
  montant: 500_000,
  objet: 'Alimentation de la caisse',
  sortie: { reference: 'CHQ 0042', date: '2026-03-14' },
  entree: { reference: 'PC 118', date: '2026-03-14' },
  porteur: 'Kalala',
};

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
  it('exige l’objet et la référence de la pièce de CHAQUE opération (AUDCIF art. 17, 5°)', () => {
    expect(motifRefusVirement(o, d, { ...DEMANDE, objet: '  ' })).toMatch(/objet/);
    expect(motifRefusVirement(o, d, { ...DEMANDE, sortie: { ...DEMANDE.sortie, reference: '' } })).toMatch(/pièce de la sortie.*art\. 17, 5°/);
    expect(motifRefusVirement(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, reference: ' ' } })).toMatch(/pièce de l'entrée.*art\. 17, 5°/);
  });
  it('l’entrée suit la sortie, le même jour ou après, jamais avant (AUDCIF art. 16, al. 2)', () => {
    expect(motifRefusVirement(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, date: '2026-03-16' } })).toBeNull();
    expect(motifRefusVirement(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, date: '2026-03-13' } })).toMatch(/entrée des fonds est datée avant leur sortie.*art\. 16, al\. 2/);
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
  function monter(
    journaux: JournalDeTresorerie[],
    ribs: Array<{ devise: string | null; journal: { code: string } }> = [],
    opts: { referentiel?: 'SYSCOHADA' | 'SYCEBNL'; compteEnDevise?: string } = {},
  ) {
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
      exercice: { findFirst: async () => ({ dateDebut: new Date('2026-01-01T00:00:00.000Z'), dateFin: new Date('2026-12-31T00:00:00.000Z') }) },
      ribBanque: { findMany: async () => ribs },
      tenant: { findUniqueOrThrow: async () => ({ referentiel: opts.referentiel ?? 'SYSCOHADA' }) },
      ligneEcriture: { findMany: async () => (opts.compteEnDevise ? [{ compteId: opts.compteEnDevise }] : []) },
      compteVirementFonds: { findMany: async () => passages },
      $executeRaw: async () => 0,
      $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
    };
    return { service: new VirementsFondsService(prisma as never, { creerPlusieursAvec } as never), creerPlusieursAvec };
  }
  const dto = {
    exerciceId: 'x1',
    journalOrigineId: 'ca',
    journalDestinationId: 'bq',
    montant: 1_200_000,
    sortie: { nature: 'BON_CAISSE' as const, reference: ' BC-77 ', date: '2026-03-14' },
    entree: { nature: 'BORDEREAU_VERSEMENT' as const, reference: ' BV-118 ', date: '2026-03-16' },
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
    expect(r).toMatchObject({ sens: 'CAISSE_BANQUE', piecesPassees: 'CA n° 7 · BQ n° 3', porteur: 'Mbuyi', montant: 1_200_000 });
  });

  it('chaque écriture porte la référence et la date de SA pièce, la fiche garde les deux (demande du 2026-10-16)', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
    const r = (await service.creer('t1', 'u1', dto as never)) as Record<string, unknown>;
    const [, , pieces] = creerPlusieursAvec.mock.calls[0] as unknown as [string, string, Array<{ date: string; reference: string; libelle: string }>];
    expect(pieces.map((p) => [p.date, p.reference])).toEqual([
      ['2026-03-14', 'Bon de caisse BC-77'],
      ['2026-03-16', 'Bordereau de versement BV-118'],
    ]);
    // Le sens et le compte de passage ne chargent plus le libellé.
    expect(pieces[0].libelle).toBe('Virement de fonds · Versement de la recette');
    expect(r).toMatchObject({ naturePiece: 'BON_CAISSE', referencePiece: 'BC-77', naturePieceEntree: 'BORDEREAU_VERSEMENT', referencePieceEntree: 'BV-118' });
    expect([r.date, r.datePiece, r.datePieceEntree].map((d) => (d as Date).toISOString().slice(0, 10))).toEqual(['2026-03-14', '2026-03-14', '2026-03-16']);
  });

  it('refuse AVANT toute pièce une opération datée hors de l’exercice · le 585 se solde à la fin de l’exercice', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
    await expect(service.creer('t1', 'u1', { ...dto, sortie: { ...dto.sortie, date: '2026-12-31' }, entree: { ...dto.entree, date: '2027-01-02' } } as never)).rejects.toThrow(
      /entrée des fonds \(02\/01\/2027\) tombe hors de l'exercice.*compte 58/,
    );
    expect(creerPlusieursAvec).not.toHaveBeenCalled();
  });

  it('refuse AVANT toute pièce une entrée datée avant la sortie', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
    await expect(service.creer('t1', 'u1', { ...dto, entree: { ...dto.entree, date: '2026-03-10' } } as never)).rejects.toThrow(/datée avant leur sortie/);
    expect(creerPlusieursAvec).not.toHaveBeenCalled();
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

  it('refuse une caisse en devises, qui ne porte jamais de RIB (relecture B1)', async () => {
    const syscohada = monter([banque('ca', '57120001'), banque('bq', '52110000')]);
    await expect(syscohada.service.creer('t1', 'u1', dto as never)).rejects.toThrow(/57120001 du journal CA est tenu en devise.*art\. 57.*à la main/);
    expect(syscohada.creerPlusieursAvec).not.toHaveBeenCalled();
    const sycebnl = monter([banque('ca', '57200001'), banque('bq', '52110000')], [], { referentiel: 'SYCEBNL' });
    await expect(sycebnl.service.creer('t1', 'u1', dto as never)).rejects.toThrow(/57200001/);
  });

  it('refuse un compte qui porte déjà une ligne en devise, hors de toute racine « en devises »', async () => {
    const m = monter([banque('ca', '57110000'), banque('bq', '52110000')], [], { compteEnDevise: 'c-52110000' });
    await expect(m.service.creer('t1', 'u1', dto as never)).rejects.toThrow(/52110000 du journal BQ est tenu en devise/);
    expect(m.creerPlusieursAvec).not.toHaveBeenCalled();
  });

  it('une sortie et une entrée du même jour donnent deux écritures à ce jour, la fiche aussi (relecture m5)', async () => {
    const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
    const r = await service.creer('t1', 'u1', { ...dto, entree: { ...dto.entree, date: '2026-03-14' } } as never);
    const [, , pieces] = creerPlusieursAvec.mock.calls[0] as unknown as [string, string, Array<{ date: string }>];
    expect(pieces.map((p) => p.date)).toEqual(['2026-03-14', '2026-03-14']);
    expect((r as { date: Date }).date.toISOString().slice(0, 10)).toBe('2026-03-14');
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
    lettreEnCours?: string;
    dejaPrise?: boolean;
  }) {
    const updates: Array<Record<string, unknown>> = [];
    const supprimes: string[] = [];
    const inscrireEnNegatifPourAnnulation = jest.fn(async (_t: string, _u: string, id: string) => ({ id: `neg-${id}` }));
    const prisma: Record<string, unknown> = {
      virementFonds: {
        findFirst: async () => ({
          id: 'v1',
          annuleLe: opts.annuleLe ?? null,
          piecesPassees: 'BQ n° 12 · CA n° 7',
          ecritureOrigineId: 'e1',
          ecritureDestinationId: 'e2',
          exercice: { statut: opts.exercice ?? StatutExercice.OUVERT },
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return { id: 'v1', ...data };
        },
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return { count: opts.dejaPrise ? 0 : 1 };
        },
      },
      ecriture: {
        findMany: async () =>
          ['e1', 'e2'].map((id) => ({ id, numeroPiece: id, statut: opts.statuts[id], lignes: [{ lettre: opts.lettre ?? null, lettrageId: opts.lettre ? 'g1' : null, rapprochementId: null }] })),
        findFirst: async ({ where }: { where: { id: string } }) => ({ statut: opts.statuts[where.id], numeroPiece: `N-${where.id}` }),
        deleteMany: async ({ where }: { where: { id: string } }) => {
          supprimes.push(where.id);
          return { count: opts.supprimees ?? 1 };
        },
      },
      ligneEcriture: {
        deleteMany: async () => ({ count: 2 }),
        // Relues DANS la transaction · un lettrage posé entre la lecture et
        // la suppression (relecture M1).
        findMany: async () => [{ lettre: opts.lettreEnCours ?? null, lettrageId: opts.lettreEnCours ? 'g2' : null, rapprochementId: null }],
      },
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

  it('un lettrage posé pendant l’annulation sur une pièce au brouillard refuse, rien n’est retiré (relecture M1)', async () => {
    const m = monter({ statuts: { e1: StatutEcriture.BROUILLARD, e2: StatutEcriture.BROUILLARD }, lettreEnCours: 'AB' });
    await expect(m.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' })).rejects.toThrow(/lettrées/);
    expect(m.supprimes).toEqual([]);
  });

  it('une seconde annulation concurrente dit « déjà annulé » (relecture m1)', async () => {
    const m = monter({ statuts: { e1: StatutEcriture.BROUILLARD, e2: StatutEcriture.BROUILLARD }, dejaPrise: true });
    await expect(m.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' })).rejects.toThrow(/déjà annulé/);
    expect(m.supprimes).toEqual([]);
  });

  it('un motif fait d’espaces est refusé (relecture m2)', async () => {
    const m = monter({ statuts: { e1: StatutEcriture.BROUILLARD, e2: StatutEcriture.BROUILLARD } });
    await expect(m.service.annuler('t1', 'u1', 'v1', { motif: '     ' })).rejects.toThrow(/motif/);
  });

  it('la trace dit ce qui est arrivé aux pièces · retirées, ou inscrites en négatif avec leurs numéros (relecture m4)', async () => {
    const brouillard = monter({ statuts: { e1: StatutEcriture.BROUILLARD, e2: StatutEcriture.BROUILLARD } });
    await brouillard.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' });
    expect(brouillard.updates.at(-1)!.piecesPassees).toBe('BQ n° 12 · CA n° 7 · retirées du brouillard, numéros libérés');
    const validees = monter({ statuts: { e1: StatutEcriture.VALIDEE, e2: StatutEcriture.VALIDEE } });
    await validees.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' });
    expect(validees.updates.at(-1)!.piecesPassees).toBe('BQ n° 12 · CA n° 7 · inscrites en négatif (n° N-neg-e1, n° N-neg-e2)');
  });
});

describe('VirementsFondsService.deposerPiece', () => {
  const PDF = Buffer.from('%PDF-1.4\n% e2e\n%%EOF\n', 'latin1');
  function monter() {
    const crees: Array<Record<string, unknown>> = [];
    const prisma = {
      virementFonds: { findFirst: async () => ({ id: 'v1' }) },
      pieceVirementFonds: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          crees.push(data);
          return { id: 'p1', operation: data.operation, nomFichier: data.nomFichier, taille: data.taille };
        },
      },
    };
    return { service: new VirementsFondsService(prisma as never, {} as never), crees };
  }

  it('un scan se joint à UNE opération, nommée', async () => {
    const m = monter();
    await m.service.deposerPiece('t1', 'v1', 'ENTREE', { originalname: 'bordereau.pdf', buffer: PDF }, 'a@b.cd');
    expect(m.crees[0]).toMatchObject({ virementId: 'v1', operation: 'ENTREE', nomFichier: 'bordereau.pdf' });
  });

  it('sans opération, ou avec une autre, le refus le dit et rien n’est déposé', async () => {
    const m = monter();
    for (const operation of [undefined, 'VIREMENT']) {
      await expect(m.service.deposerPiece('t1', 'v1', operation, { originalname: 'b.pdf', buffer: PDF }, 'a@b.cd')).rejects.toThrow(/sortie des fonds \(SORTIE\) ou leur entrée \(ENTREE\)/);
    }
    expect(m.crees).toEqual([]);
  });
});

describe('La trésorerie en devises se lit dans le plan de chaque référentiel', () => {
  it('chaque racine est semée par son plan sous un intitulé « devise »', () => {
    for (const [ref, plan] of [
      ['SYSCOHADA', PLAN_COMPTES_SYSCOHADA],
      ['SYCEBNL', PLAN_COMPTES_SYCEBNL],
    ] as const) {
      for (const racine of RACINES_TRESORERIE_EN_DEVISES[ref]) {
        const seme = (plan as Array<{ numero: string; intitule: string }>).find((c) => c.numero === racine.padEnd(8, "0"));
        expect({ ref, racine, intitule: seme?.intitule }).toEqual({ ref, racine, intitule: expect.stringMatching(/devise/i) });
      }
    }
  });

  it('un numéro, deux sens · le 5712 est une caisse en devises au SYSCOHADA seulement', () => {
    expect(estTresorerieEnDevises('57120001', 'SYSCOHADA')).toBe(true);
    expect(estTresorerieEnDevises('57120001', 'SYCEBNL')).toBe(false);
    expect(estTresorerieEnDevises('57200003', 'SYCEBNL')).toBe(true);
    expect(estTresorerieEnDevises('52110000', 'SYSCOHADA')).toBe(false);
  });
});

describe('Le centime se juge sans seuil (relecture M1)', () => {
  it('admet les montants justes au-delà de cent millions, refuse le millième', () => {
    expect(estAuCentime(136_620_326.98)).toBe(true);
    expect(estAuCentime(999_999_999.99)).toBe(true);
    expect(estAuCentime(1000.555)).toBe(false);
    expect(motifRefusVirement(banque('a', '52110000'), banque('b', '52120000'), { ...DEMANDE, montant: 136_620_326.98 })).toBeNull();
  });
});
