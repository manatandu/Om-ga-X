import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EcritureService } from './ecriture.service';
import { filtresDesTroisColonnes, filtresDesTroisColonnesDeLaPeriode } from './balance-trois-colonnes';
import { libellePeriode, periodeDeLExtrait, periodeServie, veilleDe } from './periode-extrait';

/**
 * LA BALANCE ET LE GRAND LIVRE SUR UNE PÉRIODE (ligne export-periode, gel levé
 * par Manasse le 2026-10-16). Ce qui casserait en silence · une ligne comptée
 * dans deux colonnes ou dans aucune (la balance boucle quand même sur ses
 * totaux), un report perdu (le solde de départ disparaît, condition 1), une
 * simulation lue, un extrait qui ne se lirait plus contre la balance de
 * l'exercice.
 */

const EXERCICE = { dateDebut: new Date('2026-01-01T00:00:00.000Z'), dateFin: new Date('2026-12-31T00:00:00.000Z') };

describe('la période demandée · bornée à l’exercice, sinon l’exercice entier', () => {
  it('sans date, l’exercice entier · aucun extrait', () => {
    expect(periodeDeLExtrait(EXERCICE, {})).toBeNull();
    expect(periodeDeLExtrait(EXERCICE, { du: '', au: '' })).toBeNull();
  });

  it('une période égale à l’exercice n’est pas un extrait', () => {
    expect(periodeDeLExtrait(EXERCICE, { du: '2026-01-01', au: '2026-12-31' })).toBeNull();
  });

  it('une borne manquante prend celle de l’exercice, et la fin s’exclut au lendemain', () => {
    const p = periodeDeLExtrait(EXERCICE, { du: '2026-04-01' })!;
    expect(p.du.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(p.au.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    expect(p.finExclue.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(periodeServie(p)).toEqual({ du: '2026-04-01', au: '2026-12-31' });
    expect(libellePeriode(p)).toBe('du 01/04/2026 au 31/12/2026');
    expect(veilleDe(p.du).toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });

  it('À CHEVAL SUR DEUX EXERCICES, REFUSÉE ET NOMMÉE (condition 4)', () => {
    expect(() => periodeDeLExtrait(EXERCICE, { du: '2025-12-01', au: '2026-03-31' })).toThrow(/l'à-nouveau du second/);
    expect(() => periodeDeLExtrait(EXERCICE, { du: '2026-11-01', au: '2027-01-31' })).toThrow(BadRequestException);
  });

  it('une date illisible est refusée, jamais lue comme l’exercice entier', () => {
    expect(() => periodeDeLExtrait(EXERCICE, { du: '2026-02-30' })).toThrow(/AAAA-MM-JJ/);
    expect(() => periodeDeLExtrait(EXERCICE, { du: '2026-06-30', au: '2026-04-01' })).toThrow(/dépasse sa date de fin/);
  });
});

// ---------------------------------------------------------------------------
// Un évaluateur des filtres Prisma employés · égalité, `not`, `lt`, `gte`,
// `lte`, `in`, `AND`, `OR`. Ce qu'il ne sait pas lire fait tomber le test.
// ---------------------------------------------------------------------------

type EcritureEssai = {
  tenantId: string;
  exerciceId: string;
  statut: string;
  date: Date;
  estGenereeParCloture: boolean;
  estSoldeDesComptesDeGestion: boolean;
};

function valeurRepond(v: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
    return v instanceof Date && condition instanceof Date ? v.getTime() === condition.getTime() : v === condition;
  }
  for (const [op, attendu] of Object.entries(condition as Record<string, unknown>)) {
    if (op === 'not') {
      if (valeurRepond(v, attendu)) return false;
    } else if (op === 'in') {
      if (!(attendu as unknown[]).includes(v)) return false;
    } else if (op === 'lt' || op === 'lte' || op === 'gte') {
      const a = (v as Date).getTime();
      const b = (attendu as Date).getTime();
      if (op === 'lt' && !(a < b)) return false;
      if (op === 'lte' && !(a <= b)) return false;
      if (op === 'gte' && !(a >= b)) return false;
    } else {
      throw new Error(`Opérateur non lu par la doublure · ${op}`);
    }
  }
  return true;
}

function repond(e: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  for (const [cle, condition] of Object.entries(where)) {
    if (condition === undefined) continue;
    if (cle === 'AND') {
      const liste = Array.isArray(condition) ? condition : [condition];
      if (!liste.every((c) => repond(e, c as Record<string, unknown>))) return false;
    } else if (cle === 'OR') {
      if (!(condition as Record<string, unknown>[]).some((c) => repond(e, c))) return false;
    } else if (!valeurRepond(e[cle], condition)) {
      return false;
    }
  }
  return true;
}

const jour = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ecr = (date: string, o: Partial<EcritureEssai> = {}): EcritureEssai => ({
  tenantId: 't1',
  exerciceId: 'ex',
  statut: 'VALIDEE',
  date: jour(date),
  estGenereeParCloture: false,
  estSoldeDesComptesDeGestion: false,
  ...o,
});

/** Le jeu d'essai · tout ce que la clôture et la saisie posent dans un exercice. */
const ECRITURES: Record<string, EcritureEssai> = {
  aNouveau: ecr('2026-01-01', { estGenereeParCloture: true }),
  janvier: ecr('2026-01-15'),
  finMars: ecr('2026-03-31', { statut: 'BROUILLARD' }),
  premierJour: ecr('2026-04-01'),
  dernierJour: ecr('2026-06-30'),
  apres: ecr('2026-07-01'),
  // Un dossier repris en cours d'année · son bilan d'ouverture porte le drapeau du report.
  repriseMai: ecr('2026-05-10', { estGenereeParCloture: true }),
  virementResultat: ecr('2026-12-31', { estGenereeParCloture: true }),
  soldeGestion: ecr('2026-12-31', { estGenereeParCloture: true, estSoldeDesComptesDeGestion: true }),
  simulation: ecr('2026-04-15', { statut: 'SITUATION' }),
};

describe('les trois colonnes d’une période · chaque ligne dans une colonne, et une seule', () => {
  const base: Prisma.EcritureWhereInput = { tenantId: 't1', exerciceId: 'ex' };
  const colonnesDe = (f: ReturnType<typeof filtresDesTroisColonnes>) => (e: EcritureEssai) =>
    (['reports', 'mouvements', 'clotures'] as const).filter((c) => repond(e as never, f[c] as never));

  it('du 1er avril au 30 juin · le report garde à-nouveau, janvier à mars et la reprise ; la période ses jours ; rien après', () => {
    const periode = periodeDeLExtrait(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })!;
    const de = colonnesDe(filtresDesTroisColonnesDeLaPeriode(base, periode) as never);
    expect(Object.fromEntries(Object.entries(ECRITURES).map(([k, e]) => [k, de(e)]))).toEqual({
      aNouveau: ['reports'],
      janvier: ['reports'],
      finMars: ['reports'],
      premierJour: ['mouvements'],
      dernierJour: ['mouvements'],
      apres: [],
      repriseMai: ['reports'],
      virementResultat: [],
      soldeGestion: [],
      simulation: [],
    });
  });

  it('jusqu’à la fin de l’exercice · le solde des comptes de gestion tombe dans sa colonne', () => {
    const periode = periodeDeLExtrait(EXERCICE, { du: '2026-04-01' })!;
    const de = colonnesDe(filtresDesTroisColonnesDeLaPeriode(base, periode) as never);
    expect(de(ECRITURES.soldeGestion)).toEqual(['clotures']);
    expect(de(ECRITURES.virementResultat)).toEqual(['reports']);
    expect(de(ECRITURES.apres)).toEqual(['mouvements']);
  });

  it('UNE PÉRIODE ÉGALE À L’EXERCICE REND LA BALANCE DE L’EXERCICE, ligne pour ligne', () => {
    const exercice = colonnesDe(filtresDesTroisColonnes(base) as never);
    const entier = colonnesDe(
      filtresDesTroisColonnesDeLaPeriode(base, { du: jour('2026-01-01'), finExclue: jour('2027-01-01') }) as never,
    );
    for (const e of Object.values(ECRITURES)) expect(entier(e)).toEqual(exercice(e));
  });

  it('le livre-journal seul, quand l’appelant le demande · le brouillard n’entre dans aucune colonne', () => {
    const periode = periodeDeLExtrait(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })!;
    const de = colonnesDe(filtresDesTroisColonnesDeLaPeriode({ ...base, statut: 'VALIDEE' }, periode) as never);
    expect(de(ECRITURES.finMars)).toEqual([]);
    expect(de(ECRITURES.janvier)).toEqual(['reports']);
  });
});

// ---------------------------------------------------------------------------
// Le grand livre de l'écran sur une période · le report à la veille.
// ---------------------------------------------------------------------------

type LigneEssai = { id: string; compteId: string; numero: string; debit: number; credit: number; ecriture: EcritureEssai };
const COMPTES: Record<string, { id: string; numero: string; intitule: string }> = {
  banque: { id: 'banque', numero: '52110000', intitule: 'Banque' },
  dotation: { id: 'dotation', numero: '10100000', intitule: 'Dotation' },
  achats: { id: 'achats', numero: '60110000', intitule: 'Achats' },
  caisse: { id: 'caisse', numero: '57110000', intitule: 'Caisse' },
};
const l = (id: string, compte: string, debit: number, credit: number, ecriture: EcritureEssai): LigneEssai => ({
  id,
  compteId: compte,
  numero: COMPTES[compte].numero,
  debit,
  credit,
  ecriture,
});
const LIGNES: LigneEssai[] = [
  l('an1', 'banque', 1000, 0, ECRITURES.aNouveau),
  l('an2', 'dotation', 0, 1000, ECRITURES.aNouveau),
  l('j1', 'achats', 200, 0, ECRITURES.janvier),
  l('j2', 'banque', 0, 200, ECRITURES.janvier),
  // La caisse n'a QUE des lignes d'avant la période · son report seul.
  l('m1', 'caisse', 50, 0, ECRITURES.finMars),
  l('m2', 'banque', 0, 50, ECRITURES.finMars),
  l('p1', 'achats', 300, 0, ECRITURES.premierJour),
  l('p2', 'banque', 0, 300, ECRITURES.premierJour),
  l('a1', 'achats', 999, 0, ECRITURES.apres),
  l('a2', 'banque', 0, 999, ECRITURES.apres),
  l('s1', 'achats', 7, 0, ECRITURES.simulation),
  l('s2', 'banque', 0, 7, ECRITURES.simulation),
];

function serviceAvec(lignes: LigneEssai[]) {
  const enLigne = (x: LigneEssai) => ({
    id: x.id,
    ecritureId: `e-${x.ecriture.date.toISOString()}`,
    compteId: x.compteId,
    libelle: null,
    lettre: null,
    debit: new Prisma.Decimal(x.debit),
    credit: new Prisma.Decimal(x.credit),
    compte: COMPTES[x.compteId],
    ecriture: { ...x.ecriture, libelle: 'Essai', reference: null, numeroPiece: 1, journal: { code: 'OD' } },
  });
  const choisies = (where: Record<string, unknown>) =>
    lignes.filter((x) => {
      const filtreCompte = where.compteId as string | { in: string[] } | undefined;
      if (typeof filtreCompte === 'string' && x.compteId !== filtreCompte) return false;
      if (filtreCompte && typeof filtreCompte === 'object' && !filtreCompte.in.includes(x.compteId)) return false;
      const ecriture = { ...(where.ecriture as Record<string, unknown>) };
      // `lignes: { some }` · la lecture des contreparties, sans effet ici.
      delete ecriture.lignes;
      return repond(x.ecriture as never, ecriture);
    });
  const prisma = {
    compte: {
      findFirst: jest.fn(async ({ where }: any) => COMPTES[where.id] ?? null),
      findMany: jest.fn(async ({ where }: any) => where.id.in.map((id: string) => COMPTES[id]).filter(Boolean)),
    },
    ligneEcriture: {
      count: jest.fn(async ({ where }: any) => choisies(where).length),
      findMany: jest.fn(async ({ where }: any) => choisies(where).map(enLigne)),
      groupBy: jest.fn(async ({ where }: any) => {
        const parCompte = new Map<string, { debit: number; credit: number }>();
        for (const x of choisies(where)) {
          const a = parCompte.get(x.compteId) ?? { debit: 0, credit: 0 };
          a.debit += x.debit;
          a.credit += x.credit;
          parCompte.set(x.compteId, a);
        }
        return [...parCompte].map(([compteId, s]) => ({ compteId, _sum: s }));
      }),
    },
  };
  return new EcritureService(prisma as never, {} as never, {} as never, {} as never);
}

describe('le grand livre de l’écran sur une période · le solde de départ ne se perd jamais', () => {
  const periode = periodeDeLExtrait(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })!;

  it('chaque compte ouvre sur son report à la veille, brut, et le solde progressif part de lui', async () => {
    const livre = await serviceAvec(LIGNES).grandLivreComplet('t1', 'ex', periode);
    const banque = livre.find((s) => s.compte.id === 'banque')!;
    expect(banque.report).toEqual({ au: jour('2026-03-31'), debit: 1000, credit: 250 });
    expect(banque.lignes.map((x) => [x.id, x.soldeProgressif])).toEqual([['p2', 450]]);
    expect(banque.soldeFinal).toBe(450);
    // Les totaux de la section sont ceux de la PÉRIODE · le report est à part.
    expect([banque.totalDebit, banque.totalCredit]).toEqual([0, 300]);
  });

  it('un compte qui n’a que son report garde sa section, à son rang · jamais une simulation, jamais l’après', async () => {
    const livre = await serviceAvec(LIGNES).grandLivreComplet('t1', 'ex', periode);
    expect(livre.map((s) => s.compte.numero)).toEqual(['10100000', '52110000', '57110000', '60110000']);
    const caisse = livre.find((s) => s.compte.id === 'caisse')!;
    expect(caisse.lignes).toEqual([]);
    expect(caisse.soldeFinal).toBe(50);
    const achats = livre.find((s) => s.compte.id === 'achats')!;
    expect(achats.lignes.map((x) => x.id)).toEqual(['p1']);
    expect(achats.soldeFinal).toBe(500);
  });

  it('le grand livre d’un compte porte aussi son report', async () => {
    const r = await serviceAvec(LIGNES).grandLivre('t1', 'banque', 'ex', undefined, periode);
    expect(r.report).toEqual({ au: jour('2026-03-31'), debit: 1000, credit: 250 });
    expect(r.soldeFinal).toBe(450);
  });

  it('sans période, le livre de l’exercice ne change pas · aucun report, toutes les lignes', async () => {
    const livre = await serviceAvec(LIGNES).grandLivreComplet('t1', 'ex');
    expect(livre.every((s) => !('report' in s))).toBe(true);
    expect(livre.find((s) => s.compte.id === 'achats')!.lignes.map((x) => x.id)).toEqual(['j1', 'p1', 'a1']);
  });
});
