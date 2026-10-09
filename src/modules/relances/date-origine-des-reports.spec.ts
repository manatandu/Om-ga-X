import { apparierAuxOrigines, datesOrigineDesReports, originesDesReports, type LigneCandidate, type LigneReportee } from './date-origine-des-reports';

/**
 * UNE LIGNE REPORTÉE SANS ÉCHÉANCE GARDE LA DATE DE SA PIÈCE (simulation du
 * logiciel complet du 2026-10-08, constat REL-ANOUVEAU). Le client C1 doit
 * 1 300 000 depuis une facture du 1er mars 2026, sans échéance ; reportée au
 * 1er janvier 2027, la relance du 15 mars 2027 lisait une échéance au
 * 1er janvier 2027 et 73 jours de retard au lieu de 379.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const report = (id: string, debit: number, libelle: string, date = '2027-01-01'): LigneReportee => ({
  id,
  compteId: 'c1',
  numeroCompte: '41110001',
  debit,
  credit: 0,
  libelle: `RAN détail 41110001 · ${libelle}`,
  date: d(date),
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
      { id: 'r27a', compteId: 'c1', numeroCompte: '41110001', debit: 1_300_000, credit: 0, libelle: 'RAN détail 41110001 · Facture FV-001', date: d('2027-01-01') },
      {
        id: 'r27b',
        compteId: 'c1',
        numeroCompte: '41110001',
        debit: 500_000,
        credit: 0,
        libelle: 'RAN détail 41110001 · RAN détail 41110001 · Facture FV-2025-9',
        date: d('2027-01-01'),
      },
    ]);
    expect(dates.get('r27a')).toEqual(d('2026-03-01'));
    // La lettrée de février 2025, jamais reportée, n'est pas prise pour l'origine.
    expect(dates.get('r27b')).toEqual(d('2025-11-20'));
  });

  it('une ligne sans origine retrouvée n’a pas de date · la relance garde celle de l’écriture', async () => {
    const dates = await datesOrigineDesReports(client as never, 't1', d('2027-01-01'), [
      { id: 'r27c', compteId: 'c1', numeroCompte: '41110001', debit: 7_000, credit: 0, libelle: 'RAN détail 41110001 · Inconnue', date: d('2027-01-01') },
    ]);
    expect(dates.has('r27c')).toBe(false);
  });
});

/**
 * PAQUET 1, B7 · LA MÊME ORIGINE ORDONNE L'IMPUTATION D'UN GROUPE D'À-NOUVEAUX.
 * Le report au détail recopie l'échéance (`report-a-nouveau.ts`) · elle entre
 * dans la clé, et deux factures de même montant et de même libellé ne
 * s'échangent plus par l'ordre de leurs identifiants. Le libellé de
 * l'origine est celui que le report recopie (`lireComptesDuReport`) · celui
 * de la ligne, sinon celui de l'écriture.
 */
describe('date d’origine des reports · l’échéance et le libellé recopiés (paquet 1, B7)', () => {
  const avecEcheance = <T extends LigneReportee>(l: T, echeance: string | null): T => ({ ...l, dateEcheance: echeance ? d(echeance) : null });

  it('même montant, même libellé · chaque report rejoint l’origine de SON échéance, quel que soit l’ordre des identifiants', () => {
    const r = apparierAuxOrigines(
      [avecEcheance(report('ra', 600_000, 'Vente marchandises'), '2026-08-31'), avecEcheance(report('rb', 600_000, 'Vente marchandises'), '2026-02-28')],
      [
        avecEcheance(origine('fev', 600_000, 'Vente marchandises', '2026-02-01'), '2026-02-28'),
        avecEcheance(origine('aou', 600_000, 'Vente marchandises', '2026-08-01'), '2026-08-31'),
      ],
    );
    expect(r.get('ra')?.id).toBe('aou');
    expect(r.get('rb')?.id).toBe('fev');
  });

  it('un report sans échéance ne prend pas une origine qui en porte une · le report l’aurait recopiée', () => {
    const r = apparierAuxOrigines([report('r1', 100_000, 'Cotisation')], [
      origine('sans', 100_000, 'Cotisation', '2026-02-01'),
      avecEcheance(origine('avec', 100_000, 'Cotisation', '2026-06-01'), '2026-06-30'),
    ]);
    expect(r.get('r1')?.id).toBe('sans');
  });

  const exercices = [{ id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }];
  const client = (lignes: Array<{ id: string; debit: number; libelle: string | null; libelleEcriture: string; date: Date; echeance: Date | null }>) => ({
    exercice: {
      findFirst: async (a: { where: { dateFin: { lt: Date } } }) =>
        exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
    },
    ligneEcriture: {
      findMany: async (a: { where: { ecriture: { exerciceId: string } }; cursor?: unknown }) =>
        a.cursor || a.where.ecriture.exerciceId !== 'e2026'
          ? []
          : lignes.map((l) => ({
              id: l.id,
              compteId: 'c1',
              debit: l.debit,
              credit: 0,
              libelle: l.libelle,
              dateEcheance: l.echeance,
              ecriture: { date: l.date, libelle: l.libelleEcriture, estGenereeParCloture: false, estANouveauProvisoire: false },
            })),
    },
  });

  it('une ligne sans libellé se retrouve par celui de son écriture, que le report a recopié', async () => {
    const { origines, introuvables } = await originesDesReports(
      client([{ id: 'f9', debit: 250_000, libelle: null, libelleEcriture: 'Facture FV-009', date: d('2026-04-02'), echeance: d('2026-05-02') }]) as never,
      't1',
      d('2027-01-01'),
      [avecEcheance(report('r9', 250_000, 'Facture FV-009'), '2026-05-02')],
    );
    expect(origines.get('r9')).toEqual({ date: d('2026-04-02'), id: 'f9' });
    expect(introuvables).toEqual([]);
  });

  it('une ligne dont l’exercice précédent ne porte aucune origine sûre est rendue introuvable', async () => {
    const { origines, introuvables } = await originesDesReports(
      client([{ id: 'f9', debit: 250_000, libelle: 'Facture FV-009', libelleEcriture: 'Pièce', date: d('2026-04-02'), echeance: null }]) as never,
      't1',
      d('2027-01-01'),
      [report('r-inconnu', 7_000, 'Inconnue')],
    );
    expect(origines.size).toBe(0);
    expect(introuvables).toEqual(['r-inconnu']);
  });

});

/**
 * RELECTURE « ÉCHECS SILENCIEUX » DU PAQUET 1, M1 · LE PREMIER EXERCICE TENU.
 * Rejoué sur vraie base (scénario paquet1-b, M1) · 2026, premier exercice,
 * ouvert par un bilan importé (F0, 1 000 000) ; F1, 1 000 000 du 01/03/2026 ;
 * leurs deux reports lettrés à la main en 2027 avec un règlement de
 * 1 000 000. La chaîne de F0 s'arrêtait sur la ligne importée (elle-même un
 * à-nouveau, sans exercice précédent) · ni origine ni introuvable, le groupe
 * tombait au prorata, 500 000 réclamés sur chacune.
 */
describe('date d’origine des reports · le premier exercice tenu (relecture, M1)', () => {
  const exercices = [{ id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }];
  const lignes2026 = [
    // La ligne du bilan d'ouverture importé · un à-nouveau, sans libellé de
    // ligne (l'import n'en porte pas), daté de la reprise.
    { id: 'imp', debit: 1_000_000, libelle: null, libelleEcriture: 'Bilan d’ouverture · ouverture.csv', date: d('2026-01-01'), report: true },
    { id: 'f1', debit: 1_000_000, libelle: 'Facture FV-1', libelleEcriture: 'Facture FV-1', date: d('2026-03-01'), report: false },
  ];
  const client = {
    exercice: {
      findFirst: async (a: { where: { dateFin: { lt: Date } } }) =>
        exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
    },
    ligneEcriture: {
      findMany: async (a: { where: { ecriture: { exerciceId: string } }; cursor?: unknown }) =>
        a.cursor || a.where.ecriture.exerciceId !== 'e2026'
          ? []
          : lignes2026.map((l) => ({
              id: l.id,
              compteId: 'c1',
              debit: l.debit,
              credit: 0,
              libelle: l.libelle,
              dateEcheance: null,
              ecriture: { date: l.date, libelle: l.libelleEcriture, estGenereeParCloture: l.report, estANouveauProvisoire: false },
            })),
    },
  };

  it('le report de la ligne importée remonte à elle, et elle EST l’origine, à la date de son écriture', async () => {
    const { origines, introuvables } = await originesDesReports(client as never, 't1', d('2027-01-01'), [
      report('r-imp', 1_000_000, 'Bilan d’ouverture · ouverture.csv'),
      report('r-f1', 1_000_000, 'Facture FV-1'),
    ]);
    expect(origines.get('r-imp')).toEqual({ date: d('2026-01-01'), id: 'imp' });
    expect(origines.get('r-f1')).toEqual({ date: d('2026-03-01'), id: 'f1' });
    expect(introuvables).toEqual([]);
  });

  it('dans le premier exercice lui-même, la ligne d’ouverture est sa propre origine', async () => {
    const { origines, introuvables } = await originesDesReports(client as never, 't1', d('2026-01-01'), [
      { id: 'imp', compteId: 'c1', numeroCompte: '41110001', debit: 1_000_000, credit: 0, libelle: null, date: d('2026-01-01') },
    ]);
    expect(origines.get('imp')).toEqual({ date: d('2026-01-01'), id: 'imp' });
    expect(introuvables).toEqual([]);
  });

  it('une ligne d’à-nouveau d’un exercice qui A un précédent se cherche dans ce précédent, et introuvable elle est rendue', async () => {
    // 2027 a un précédent (2026) · une ligne qui n'y a pas de pièce sûre n'est
    // pas prise pour sa propre origine.
    const { origines, introuvables } = await originesDesReports(client as never, 't1', d('2027-01-01'), [report('r-x', 5_000, 'Inconnue')]);
    expect(origines.size).toBe(0);
    expect(introuvables).toEqual(['r-x']);
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
