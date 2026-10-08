import { poidsDesLignesOuvertes, type LigneOuverte } from './reste-des-lignes-ouvertes';
import { EcritureService } from '../comptabilite/ecriture.service';
import { NoteAnnexeService } from '../notes-annexes/note-annexe.service';
import type { PrismaService } from '../../common/prisma.service';

/**
 * UNE FACTURE RÉGLÉE EN PARTIE PÈSE SON RESTE (simulation du logiciel complet
 * du 2026-10-08, lot M). La SARL C1 doit 3 480 000 (facture de septembre,
 * échéance au 05/10/2026), en a payé 1 000 000 en octobre, les deux lignes
 * lettrées en partiel · la NOTE 7 rendait 9 280 000 « à un an au plus » pour un
 * solde de 8 280 000, et la balance âgée 3 480 000 en septembre et − 1 000 000
 * en octobre. Attendu · 2 480 000 à l'échéance de la facture, rien ailleurs.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const ligne = (
  id: string,
  debit: number,
  credit: number,
  date: string,
  lettrageId: string | null,
  echeance: string | null = null,
): LigneOuverte => ({
  id,
  debit,
  credit,
  lettrageId,
  dateEcheance: echeance ? d(echeance) : null,
  deviseId: null,
  montantDevise: null,
  ecriture: { date: d(date) },
});

describe('poids des lignes ouvertes · la règle', () => {
  it('une créance réglée en partie pèse son reste, le règlement plus rien', () => {
    const p = poidsDesLignesOuvertes([
      ligne('f', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05'),
      ligne('r', 0, 1_000_000, '2026-10-10', 'g'),
    ]);
    expect(p.get('f')).toBe(2_480_000);
    expect(p.get('r')).toBe(0);
  });

  it('une dette réglée en partie garde son sens créditeur', () => {
    const p = poidsDesLignesOuvertes([
      ligne('f', 0, 2_320_000, '2026-09-05', 'g', '2026-10-05'),
      ligne('r', 500_000, 0, '2026-09-20', 'g'),
    ]);
    expect(p.get('f')).toBe(-1_820_000);
    expect(p.get('r')).toBe(0);
  });

  it('plusieurs factures · le règlement éteint la plus ancienne d’abord', () => {
    const p = poidsDesLignesOuvertes([
      ligne('b', 2_000_000, 0, '2026-03-01', 'g', '2026-04-01'),
      ligne('a', 1_000_000, 0, '2026-01-10', 'g', '2026-02-10'),
      ligne('r', 0, 1_500_000, '2026-05-01', 'g'),
    ]);
    expect(p.get('a')).toBe(0);
    expect(p.get('b')).toBe(1_500_000);
    expect(p.get('r')).toBe(0);
  });

  it('une ligne hors groupe, ou seule de son groupe, se lit à son montant · elle n’est pas dans la table', () => {
    const p = poidsDesLignesOuvertes([ligne('x', 700, 0, '2026-01-01', null), ligne('y', 0, 300, '2026-01-02', 'seul')]);
    expect(p.size).toBe(0);
  });

  it('un groupe dont les lignes reçues se compensent ne pèse rien', () => {
    const p = poidsDesLignesOuvertes([ligne('f', 900, 0, '2026-01-01', 'g'), ligne('r', 0, 900, '2026-02-01', 'g')]);
    expect(p.get('f')).toBe(0);
    expect(p.get('r')).toBe(0);
  });
});

describe('poids des lignes ouvertes · la balance âgée', () => {
  /**
   * L'association U1 doit 2 000 000 reportés de 2025 (à-nouveau sans
   * échéance), et en a payé 800 000 en mars 2026, lettrés en partiel avec le
   * report · 1 200 000 « avant le 01/01/2026 », rien en mars.
   */
  it('le reste d’un report réglé en partie reste antérieur à l’exercice', async () => {
    const lignes = [
      {
        ...ligne('ran', 2_000_000, 0, '2026-01-01', 'g'),
        compte: { id: 'c411', numero: '41110001', intitule: 'U1' },
        ecriture: { date: d('2026-01-01'), estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
      },
      {
        ...ligne('reg', 0, 800_000, '2026-03-15', 'g'),
        compte: { id: 'c411', numero: '41110001', intitule: 'U1' },
        ecriture: { date: d('2026-03-15'), estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
      },
    ];
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }) },
      ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
      tiersCompte: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const r = await new EcritureService(prisma, {} as never, {} as never, {} as never).balanceAgee('t', {
      exerciceId: 'ex',
      dateReference: '2026-05-31',
      type: 'CLIENTS_41',
    });
    expect(r.debiteurs).toHaveLength(1);
    expect(r.debiteurs[0].solde).toBe(1_200_000);
    expect(r.debiteurs[0].montants[0]).toBe(1_200_000);
    expect(r.debiteurs[0].montants.slice(1).every((m) => m === 0)).toBe(true);
  });
});

describe('poids des lignes ouvertes · les notes par échéance', () => {
  /**
   * La doublure honore le curseur (premier lot, puis rien) · `chargerEcheances`
   * lit par lots, et garde les lignes lettrées jusqu'à la fin de la lecture.
   */
  it('la colonne « à un an au plus » vaut le solde, le non ventilé rien', async () => {
    const lignes = [
      { ...ligne('f', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05'), compte: { numero: '41110001' } },
      { ...ligne('r', 0, 1_000_000, '2026-10-10', 'g'), compte: { numero: '41110001' } },
      { ...ligne('h', 5_800_000, 0, '2026-11-02', null, '2026-12-02'), compte: { numero: '41110001' } },
    ];
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }) },
      ligneEcriture: {
        findMany: jest.fn((a: { cursor?: unknown }) => Promise.resolve(a.cursor ? [] : lignes)),
      },
    } as unknown as PrismaService;
    const service = new NoteAnnexeService({} as never, {} as never, prisma, {} as never, {} as never);
    const echeances = await (service as unknown as {
      chargerEcheances: (t: string, e: string) => Promise<Map<string, { unAn: number; deuxAns: number; plusDeDeuxAns: number; nonVentile: number }>>;
    }).chargerEcheances('t', 'ex');
    expect(echeances.get('41110001')).toEqual({ unAn: 8_280_000, deuxAns: 0, plusDeDeuxAns: 0, nonVentile: 0 });
  });
});
