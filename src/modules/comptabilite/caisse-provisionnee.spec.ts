import { readFileSync } from 'fs';
import { join } from 'path';
import { StatutExercice } from '@prisma/client';
import { motifCaisseNonProvisionnee, premierJourRefuse, uniteDuJugement } from './caisse-provisionnee';

/**
 * UNE CAISSE NE PAIE QUE CE QU'ELLE CONTIENT (fiche du compte 57 des deux
 * plans · « Le solde du compte caisse ne doit être que débiteur ou nul »).
 * Le jugement pur d'abord, puis la lecture sur une doublure qui honore ses
 * filtres (CLAUDE.md, F4b · « la doublure doit honorer la requête »).
 */

const jours = (paires: [string, number][]) => new Map(paires);

describe('premierJourRefuse · le jour où la pièce rend la caisse créditrice', () => {
  it('refuse une sortie au-delà du solde, au jour de la sortie', () => {
    const avant = jours([['2026-03-01', 100_000]]);
    const apres = jours([['2026-03-01', 100_000], ['2026-03-05', -150_000]]);
    expect(premierJourRefuse(0, avant, apres)).toEqual({ jour: '2026-03-05', avant: 100_000, apres: -50_000 });
  });

  it('admet une sortie qui vide la caisse au centime près', () => {
    const avant = jours([['2026-03-01', 100_000]]);
    const apres = jours([['2026-03-01', 100_000], ['2026-03-05', -100_000]]);
    expect(premierJourRefuse(0, avant, apres)).toBeNull();
  });

  it("compte le solde d'ouverture", () => {
    const apres = jours([['2026-01-10', -80_000]]);
    expect(premierJourRefuse(100_000, new Map(), apres)).toBeNull();
    expect(premierJourRefuse(50_000, new Map(), apres)?.apres).toBe(-30_000);
  });

  it("refuse une sortie antidatée qui rend créditeur un jour d'avant l'entrée qui la couvrirait", () => {
    // Entrée de 200 000 le 10, sortie de 150 000 datée du 5 · la caisse était vide le 5.
    const avant = jours([['2026-03-10', 200_000]]);
    const apres = jours([['2026-03-05', -150_000], ['2026-03-10', 200_000]]);
    expect(premierJourRefuse(0, avant, apres)?.jour).toBe('2026-03-05');
  });

  it("refuse une sortie qui en rend créditrice une autre déjà passée plus tard", () => {
    // 100 000 au 1er, sortie de 80 000 déjà passée le 20 ; une nouvelle de 50 000 le 10 laisse 50 000 le 10, mais -30 000 le 20.
    const avant = jours([['2026-03-01', 100_000], ['2026-03-20', -80_000]]);
    const apres = jours([['2026-03-01', 100_000], ['2026-03-10', -50_000], ['2026-03-20', -80_000]]);
    expect(premierJourRefuse(0, avant, apres)).toEqual({ jour: '2026-03-20', avant: 20_000, apres: -30_000 });
  });

  it("n'enferme pas un dossier dont la caisse est déjà créditrice · l'encaissement passe", () => {
    const avant = jours([['2026-03-01', -40_000]]);
    const apres = jours([['2026-03-01', -40_000], ['2026-03-02', 10_000]]);
    expect(premierJourRefuse(0, avant, apres)).toBeNull();
  });

  it('refuse une sortie de plus sur une caisse déjà créditrice', () => {
    const avant = jours([['2026-03-01', -40_000]]);
    const apres = jours([['2026-03-01', -40_000], ['2026-03-02', -5_000]]);
    expect(premierJourRefuse(0, avant, apres)?.apres).toBe(-45_000);
  });

  it("ne lit pas un écart d'arrondi sous le centime comme un solde créditeur", () => {
    const apres = jours([['2026-03-01', 0.1 + 0.2], ['2026-03-02', -0.3]]);
    expect(premierJourRefuse(0, new Map(), apres)).toBeNull();
  });
});

describe('uniteDuJugement · une caisse tenue en devise se juge dans sa devise', () => {
  const ligne = (deviseId: string | null, montantDevise: number | null, deChange = false) => ({
    jour: '2026-03-01',
    debit: 1,
    credit: 0,
    deviseId,
    montantDevise,
    deChange,
  });

  it('une seule devise, montants portés · la devise', () => {
    expect(uniteDuJugement([ligne('usd', 100), ligne('usd', 50)])).toEqual({ devise: 'usd' });
  });

  it('les écritures de change sans devise ne la font pas quitter', () => {
    expect(uniteDuJugement([ligne('usd', 100), ligne(null, null, true)])).toEqual({ devise: 'usd' });
  });

  it('une ligne en francs hors change · les francs', () => {
    expect(uniteDuJugement([ligne('usd', 100), ligne(null, null)])).toEqual({ devise: null });
  });

  it('deux devises, ou un montant en devise absent · les francs', () => {
    expect(uniteDuJugement([ligne('usd', 100), ligne('eur', 100)])).toEqual({ devise: null });
    expect(uniteDuJugement([ligne('usd', null)])).toEqual({ devise: null });
  });
});

/** Une doublure minimale qui honore les filtres que le module pose. */
function doublure(opts: {
  comptes: { id: string; numero: string; intitule: string }[];
  exercices: { id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice; ouverture?: boolean }[];
  lignes: { id: string; compteId: string; exerciceId: string; ecritureId: string; date: string; debit: number; credit: number; statut?: string; deviseId?: string | null; montantDevise?: number | null }[];
}) {
  return {
    compte: {
      findMany: jest.fn(async ({ where }: any) =>
        opts.comptes.filter(
          (c) =>
            (!where.id?.in || where.id.in.includes(c.id)) &&
            (!where.numero?.startsWith || c.numero.startsWith(where.numero.startsWith)) &&
            (!where.lignesEcriture || opts.lignes.some((l) => l.compteId === c.id && l.ecritureId === where.lignesEcriture.some.ecritureId)),
        ),
      ),
    },
    exercice: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id) return opts.exercices.find((e) => e.id === where.id) ?? null;
        const avant = opts.exercices.filter((e) => e.dateFin < where.dateFin.lt).sort((a, b) => +b.dateFin - +a.dateFin);
        return avant[0] ?? null;
      }),
    },
    ecriture: {
      count: jest.fn(async ({ where }: any) => {
        const ex = opts.exercices.find((e) => e.id === where.exerciceId);
        if (where.estANouveauProvisoire === true) return 0;
        return ex?.ouverture ? 1 : 0;
      }),
    },
    devise: { findFirst: jest.fn(async () => ({ code: 'USD' })) },
    ligneEcriture: {
      findMany: jest.fn(async ({ where, cursor }: any) => {
        if (cursor) return [];
        return opts.lignes
          .filter((l) => l.compteId === where.compteId && l.exerciceId === where.ecriture.exerciceId && !(where.ecriture.statut?.not === 'SITUATION' && l.statut === 'SITUATION'))
          .map((l) => ({
            id: l.id,
            debit: l.debit,
            credit: l.credit,
            deviseId: l.deviseId ?? null,
            montantDevise: l.montantDevise ?? null,
            ecritureId: l.ecritureId,
            ecriture: { date: new Date(`${l.date}T00:00:00.000Z`), reevaluationEcarts: null, reevaluationExtourne: null, reevaluationContrePassationDeclaree: null, corrigeEcriture: null },
          }));
      }),
    },
  } as any;
}

const N = { id: 'n', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z'), statut: StatutExercice.OUVERT };
const N1 = { id: 'n1', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z'), statut: StatutExercice.OUVERT };
const CAISSE = { id: 'caisse', numero: '57110000', intitule: 'Caisse siège' };
const BANQUE = { id: 'banque', numero: '52110000', intitule: 'Banque' };

describe('motifCaisseNonProvisionnee · la lecture du solde', () => {
  it('refuse une sortie de caisse au-delà du solde, et nomme la caisse, le jour et le manque', async () => {
    const prisma = doublure({
      comptes: [CAISSE, BANQUE],
      exercices: [N],
      lignes: [{ id: 'l1', compteId: 'caisse', exerciceId: 'n', ecritureId: 'e1', date: '2026-02-01', debit: 100_000, credit: 0 }],
    });
    const motif = await motifCaisseNonProvisionnee(prisma, 't', 'n', [
      { date: '2026-02-10', lignes: [{ compteId: 'caisse', credit: 150_000 }, { compteId: 'x', debit: 150_000 }] },
    ]);
    expect(motif).toContain('57110000 Caisse siège');
    expect(motif).toContain('10/02/2026');
    expect(motif).toMatch(/il manque 50[\s  ]000,00/);
    expect(motif).toContain('fiche du compte 57');
  });

  it('laisse passer une banque, même créditrice · un découvert', async () => {
    const prisma = doublure({ comptes: [CAISSE, BANQUE], exercices: [N], lignes: [] });
    expect(await motifCaisseNonProvisionnee(prisma, 't', 'n', [{ date: '2026-02-10', lignes: [{ compteId: 'banque', credit: 1_000_000 }] }])).toBeNull();
  });

  it('ignore une simulation · elle ne fait sortir aucun billet', async () => {
    const prisma = doublure({
      comptes: [CAISSE],
      exercices: [N],
      lignes: [{ id: 'l1', compteId: 'caisse', exerciceId: 'n', ecritureId: 'e1', date: '2026-02-01', debit: 500_000, credit: 0, statut: 'SITUATION' }],
    });
    expect(await motifCaisseNonProvisionnee(prisma, 't', 'n', [{ date: '2026-02-10', lignes: [{ compteId: 'caisse', credit: 100 }] }])).not.toBeNull();
  });

  it("à la modification, la pièce remplacée sort du solde d'après", async () => {
    // L'ancienne version de la pièce sortait 30 000 ; la nouvelle en sort 120 000 sur 100 000 reçus.
    const prisma = doublure({
      comptes: [CAISSE],
      exercices: [N],
      lignes: [
        { id: 'l1', compteId: 'caisse', exerciceId: 'n', ecritureId: 'e1', date: '2026-02-01', debit: 100_000, credit: 0 },
        { id: 'l2', compteId: 'caisse', exerciceId: 'n', ecritureId: 'e2', date: '2026-02-10', debit: 0, credit: 30_000 },
      ],
    });
    expect(await motifCaisseNonProvisionnee(prisma, 't', 'n', [{ date: '2026-02-10', lignes: [{ compteId: 'caisse', credit: 90_000 }] }], 'e2')).toBeNull();
    expect(await motifCaisseNonProvisionnee(prisma, 't', 'n', [{ date: '2026-02-10', lignes: [{ compteId: 'caisse', credit: 120_000 }] }], 'e2')).toContain('il manque');
  });

  it("sans ouverture dans l'exercice, lit la caisse de l'exercice précédent encore ouvert", async () => {
    const prisma = doublure({
      comptes: [CAISSE],
      exercices: [N, N1],
      lignes: [{ id: 'l1', compteId: 'caisse', exerciceId: 'n', ecritureId: 'e1', date: '2026-06-01', debit: 300_000, credit: 0 }],
    });
    expect(await motifCaisseNonProvisionnee(prisma, 't', 'n1', [{ date: '2027-01-05', lignes: [{ compteId: 'caisse', credit: 200_000 }] }])).toBeNull();
  });

  it("avec une ouverture dans l'exercice, ne relit pas le précédent · elle porte déjà la caisse", async () => {
    const prisma = doublure({
      comptes: [CAISSE],
      exercices: [N, { ...N1, ouverture: true }],
      lignes: [{ id: 'l1', compteId: 'caisse', exerciceId: 'n', ecritureId: 'e1', date: '2026-06-01', debit: 300_000, credit: 0 }],
    });
    expect(await motifCaisseNonProvisionnee(prisma, 't', 'n1', [{ date: '2027-01-05', lignes: [{ compteId: 'caisse', credit: 200_000 }] }])).not.toBeNull();
  });

  it('juge une caisse en dollars dans sa devise · le cours ne la rend pas créditrice', async () => {
    // 100 USD reçus à 2 800 (280 000 FC), 100 USD payés à 2 900 (290 000 FC) · vide, pas créditrice.
    const prisma = doublure({
      comptes: [CAISSE],
      exercices: [N],
      lignes: [{ id: 'l1', compteId: 'caisse', exerciceId: 'n', ecritureId: 'e1', date: '2026-02-01', debit: 280_000, credit: 0, deviseId: 'usd', montantDevise: 100 }],
    });
    const payer = (usd: number) =>
      motifCaisseNonProvisionnee(prisma, 't', 'n', [{ date: '2026-02-10', lignes: [{ compteId: 'caisse', credit: usd * 2900, deviseId: 'usd', montantDevise: usd }] }]);
    expect(await payer(100)).toBeNull();
    expect(await payer(101)).toContain('USD');
  });
});

describe('les portes qui paient', () => {
  const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

  it('la saisie et la modification du brouillard se jugent au contrôleur', () => {
    const source = lire('comptabilite/ecriture.controller.ts');
    expect(source).toContain('verifierCaisseProvisionneeEnSaisie(user.tenantId, dto)');
    expect(source).toContain('verifierCaisseProvisionneeEnModification(user.tenantId, id, dto)');
  });

  it('règlement des tiers, virement de fonds et paiement des salaires se jugent avant leur première pièce', () => {
    const reglements = lire('reglements/reglements.service.ts');
    expect(reglements.indexOf('verifierCaisseProvisionneeEnSaisie')).toBeGreaterThan(-1);
    expect(reglements.indexOf('verifierCaisseProvisionneeEnSaisie')).toBeLessThan(reglements.indexOf('const ecriture = await this.ecritures.creer('));
    const virements = lire('virements-fonds/virements-fonds.service.ts');
    expect(virements.indexOf('this.ecritures.verifierCaisseProvisionnee(')).toBeGreaterThan(-1);
    expect(virements.indexOf('this.ecritures.verifierCaisseProvisionnee(')).toBeLessThan(virements.indexOf('this.ecritures.creerPlusieursAvec('));
    const salaires = lire('personnel/paiement-salaires.service.ts');
    expect(salaires.indexOf('this.ecritures.verifierCaisseProvisionnee(')).toBeGreaterThan(-1);
    expect(salaires.indexOf('this.ecritures.verifierCaisseProvisionnee(')).toBeLessThan(salaires.indexOf('this.ecritures.creerAvec('));
  });
});
