import { apparierAuxOrigines, datesOrigineDesReports, type LigneCandidate, type LigneReportee } from './date-origine-des-reports';

/**
 * UNE LIGNE REPORTÉE SANS ÉCHÉANCE GARDE LA DATE DE SA PIÈCE (simulation du
 * logiciel complet du 2026-10-08, constat REL-ANOUVEAU). Le client C1 doit
 * 1 300 000 depuis une facture du 1er mars 2026, sans échéance ; reportée au
 * 1er janvier 2027, la relance du 15 mars 2027 lisait une échéance au
 * 1er janvier 2027 et 73 jours de retard au lieu de 379.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const report = (id: string, debit: number, libelle: string): LigneReportee => ({
  id,
  compteId: 'c1',
  numeroCompte: '41110001',
  debit,
  credit: 0,
  libelle: `RAN détail 41110001 · ${libelle}`,
});

const origine = (id: string, debit: number, libelle: string, date: string, estReport = false): LigneCandidate => ({
  id,
  compteId: 'c1',
  numeroCompte: '41110001',
  debit,
  credit: 0,
  libelle,
  date: d(date),
  estReport,
});

describe('date d’origine des reports · l’appariement', () => {
  it('rattache le report à la facture de même compte, montant et libellé', () => {
    const r = apparierAuxOrigines([report('r1', 1_300_000, 'Facture FV-001')], [
      origine('o1', 1_300_000, 'Facture FV-001', '2026-03-01'),
      origine('o2', 400_000, 'Facture FV-002', '2026-05-10'),
    ]);
    expect(r.get('r1')?.date).toEqual(d('2026-03-01'));
  });

  it('des lignes identiques s’apparient dans l’ordre, la plus ancienne pièce d’abord', () => {
    const r = apparierAuxOrigines(
      [report('r2', 100_000, 'Cotisation'), report('r1', 100_000, 'Cotisation')],
      [origine('o2', 100_000, 'Cotisation', '2026-06-01'), origine('o1', 100_000, 'Cotisation', '2026-02-01')],
    );
    expect(r.get('r1')?.date).toEqual(d('2026-02-01'));
    expect(r.get('r2')?.date).toEqual(d('2026-06-01'));
  });

  it('un nombre différent des deux côtés ne rattache rien · aucune date n’est devinée', () => {
    const r = apparierAuxOrigines([report('r1', 100_000, 'Cotisation')], [
      origine('o1', 100_000, 'Cotisation', '2026-02-01'),
      origine('o2', 100_000, 'Cotisation', '2026-06-01'),
    ]);
    expect(r.size).toBe(0);
  });

  it('un montant différent au centime ne rattache rien', () => {
    expect(apparierAuxOrigines([report('r1', 1_300_000, 'Facture FV-001')], [origine('o1', 1_300_000.01, 'Facture FV-001', '2026-03-01')]).size).toBe(0);
  });
});

/**
 * La doublure HONORE la requête · `exercice.findFirst` filtre par `dateFin <`
 * et rend le plus récent ; `ligneEcriture.findMany` filtre par exercice,
 * compte et lettrage. Deux exercices précèdent 2027 · le report de 2026 vient
 * lui-même d'une facture de 2025, qu'il faut aller chercher.
 */
describe('date d’origine des reports · la lecture sur plusieurs exercices', () => {
  const exercices = [
    { id: 'e2025', dateDebut: d('2025-01-01'), dateFin: d('2025-12-31') },
    { id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') },
  ];
  const lignes = [
    // 2025 · la facture d'origine, et une autre déjà lettrée (jamais reportée).
    { exerciceId: 'e2025', id: 'f25', compteId: 'c1', debit: 500_000, credit: 0, libelle: 'Facture FV-2025-9', lettre: null, date: d('2025-11-20'), report: false },
    { exerciceId: 'e2025', id: 'f25b', compteId: 'c1', debit: 500_000, credit: 0, libelle: 'Facture FV-2025-9', lettre: 'AA', date: d('2025-02-01'), report: false },
    // 2026 · son report, et la facture de mars.
    { exerciceId: 'e2026', id: 'r26', compteId: 'c1', debit: 500_000, credit: 0, libelle: 'RAN détail 41110001 · Facture FV-2025-9', lettre: null, date: d('2026-01-01'), report: true },
    { exerciceId: 'e2026', id: 'f26', compteId: 'c1', debit: 1_300_000, credit: 0, libelle: 'Facture FV-001', lettre: null, date: d('2026-03-01'), report: false },
  ];
  const client = {
    exercice: {
      findFirst: async (a: { where: { dateFin: { lt: Date } } }) =>
        exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
    },
    ligneEcriture: {
      findMany: async (a: { where: { ecriture: { exerciceId: string }; compteId: { in: string[] }; lettre: null }; cursor?: unknown }) =>
        a.cursor
          ? []
          : lignes
              .filter((l) => l.exerciceId === a.where.ecriture.exerciceId && a.where.compteId.in.includes(l.compteId) && l.lettre === null)
              .map((l) => ({
                id: l.id,
                compteId: l.compteId,
                debit: l.debit,
                credit: l.credit,
                libelle: l.libelle,
                ecriture: { date: l.date, estGenereeParCloture: l.report, estANouveauProvisoire: false },
              })),
    },
  };

  it('remonte d’exercice en exercice jusqu’à la pièce, et rattache la facture de l’année', async () => {
    const dates = await datesOrigineDesReports(client as never, 't1', d('2027-01-01'), [
      { id: 'r27a', compteId: 'c1', numeroCompte: '41110001', debit: 1_300_000, credit: 0, libelle: 'RAN détail 41110001 · Facture FV-001' },
      {
        id: 'r27b',
        compteId: 'c1',
        numeroCompte: '41110001',
        debit: 500_000,
        credit: 0,
        libelle: 'RAN détail 41110001 · RAN détail 41110001 · Facture FV-2025-9',
      },
    ]);
    expect(dates.get('r27a')).toEqual(d('2026-03-01'));
    // La lettrée de février 2025, jamais reportée, n'est pas prise pour l'origine.
    expect(dates.get('r27b')).toEqual(d('2025-11-20'));
  });

  it('une ligne sans origine retrouvée n’a pas de date · la relance garde celle de l’écriture', async () => {
    const dates = await datesOrigineDesReports(client as never, 't1', d('2027-01-01'), [
      { id: 'r27c', compteId: 'c1', numeroCompte: '41110001', debit: 7_000, credit: 0, libelle: 'RAN détail 41110001 · Inconnue' },
    ]);
    expect(dates.has('r27c')).toBe(false);
  });
});

describe('date d’origine des reports · le branchement dans les relances', () => {
  // Le câblage se teste avec la règle (F4a) · la date de la pièce sert
  // l'échéance de repli, la pièce la plus ancienne (F169) et la ligne imprimée.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'relances.service.ts'), 'utf8') as string;
  it('l’échéance de repli, la pièce la plus ancienne et la ligne imprimée lisent la date d’origine', () => {
    expect(src).toMatch(/const datePiece = datesOrigine\.get\(l\.id\) \?\? l\.ecriture\.date;/);
    expect(src).toMatch(/const echeance = l\.dateEcheance \?\? datePiece;/);
    expect(src).toMatch(/piecePlusAncienne\.set\(l\.compte\.id, datePiece\)/);
    expect(src).toMatch(/date: datePiece\.toISOString\(\)\.slice\(0, 10\)/);
  });
});
