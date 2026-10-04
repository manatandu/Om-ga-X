import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TauxTvaService } from './taux-tva.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LIGNE TVA 24-26 · LES HYPOTHÈSES DE DATE SONT NOMMÉES, JAMAIS TUES.
 *
 * La reconfrontation du moteur aux art. 24 à 26 de l'O.-L. n° 10/001 et aux
 * art. 51 à 63 du décret n° 011/42 (2026-10-04) a relevé sept hypothèses que
 * la déclaration ne disait pas. Chacune est corrigée ou NOMMÉE dans la
 * mention servie par le serveur · ce spec gèle ce que la déclaration DIT, et
 * l'issue de l'acompte (lettré avec son encaissement, la taxe prend sa date).
 */

const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };
const jour = (d: string) => new Date(`${d}T00:00:00.000Z`);
const mois = (m: string) => {
  const debut = jour(`${m}-01`);
  return [debut, new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 0))] as const;
};

type Contrepartie = { numero: string; classe: string; debit: number; credit: number; lettrage?: unknown };

function ligneTva(p: { id: string; date: string; compteTva: string; collecte: boolean; tva: number; contreparties: Contrepartie[] }) {
  return {
    id: p.id,
    tauxTvaId: TAUX.id,
    compteId: p.collecte ? 'c443' : 'c445',
    compte: { numero: p.compteTva },
    debit: p.collecte ? 0 : p.tva,
    credit: p.collecte ? p.tva : 0,
    ecriture: {
      id: p.id,
      date: jour(p.date),
      createdAt: jour(p.date),
      libelle: `Facture ${p.id}`,
      facture: null,
      lignes: p.contreparties.map((c, i) => ({
        id: `${p.id}-${i}`,
        debit: c.debit,
        credit: c.credit,
        compteId: `c-${c.numero}`,
        deviseId: null,
        montantDevise: null,
        dateEcheance: null,
        libelle: null,
        compte: { numero: c.numero, classe: c.classe, tiersCompte: null },
        lettrage: c.lettrage ?? null,
      })),
    },
  };
}

function prisma(lignes: unknown[], regime = 'LIVRAISONS') {
  return {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: regime, referentiel: 'SYSCOHADA' }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    ecriture: { count: jest.fn().mockResolvedValue(0) },
    ligneEcriture: {
      findMany: jest.fn(({ where }: { where: { compteId?: { in?: string[] } } }) => Promise.resolve(where.compteId?.in ? [] : lignes)),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    evenementAudit: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

const declarer = (lignes: unknown[], m: string) => new TauxTvaService(prisma(lignes), {} as EcritureService).declaration('t1', ...mois(m));

describe('TU 2 · l’acompte sur prestation imputé sur une avance non lettrée', () => {
  const sansLettrage = ligneTva({
    id: 'P',
    date: '2026-05-10',
    compteTva: '44320000',
    collecte: true,
    tva: 160_000,
    contreparties: [
      { numero: '41910000', classe: 'CLASSE_4', debit: 1_160_000, credit: 0 },
      { numero: '70610000', classe: 'CLASSE_7', debit: 0, credit: 1_000_000 },
    ],
  });

  it('non lettrée · la taxe est datée de la facture, et l’acompte est NOMMÉ avec sa facture, sa date et son montant', async () => {
    const d = await declarer([sansLettrage], '2026-05');
    expect(d.totalCollecte).toBe(160_000);
    expect(d.mentionExigibilite).toContain('ACOMPTE IMPUTÉ SANS SA DATE · 160');
    expect(d.mentionExigibilite).toContain('« Facture P » du 10/05/2026');
    expect(d.mentionExigibilite).toContain('lettrer la ligne d’avance de la facture avec l’encaissement de l’acompte');
  });

  it('lettrée avec l’encaissement du 15 mars · la taxe est exigible en MARS (art. 25, 2°), rien n’est nommé en mai', async () => {
    const groupe = {
      id: 'G419',
      statut: 'SOLDE',
      solde: 0,
      soldeAt: null,
      createdAt: jour('2026-05-10'),
      lignes: [
        { debit: 0, credit: 1_160_000, ecriture: { id: 'ACOMPTE', date: jour('2026-03-15'), createdAt: jour('2026-03-15'), _count: { lignes: 0 } } },
        { debit: 1_160_000, credit: 0, ecriture: { id: 'P', date: jour('2026-05-10'), createdAt: jour('2026-05-10'), _count: { lignes: 0 } } },
      ],
    };
    const lettree = ligneTva({
      id: 'P',
      date: '2026-05-10',
      compteTva: '44320000',
      collecte: true,
      tva: 160_000,
      contreparties: [
        { numero: '41910000', classe: 'CLASSE_4', debit: 1_160_000, credit: 0, lettrage: groupe },
        { numero: '70610000', classe: 'CLASSE_7', debit: 0, credit: 1_000_000 },
      ],
    });
    expect((await declarer([lettree], '2026-03')).totalCollecte).toBe(160_000);
    const mai = await declarer([lettree], '2026-05');
    expect(mai.totalCollecte).toBe(0);
    expect(mai.mentionExigibilite).not.toContain('ACOMPTE IMPUTÉ SANS SA DATE');
  });
});

describe('TU 1, 4, 5 · les dates que le texte vise et qu’aucune pièce ne porte', () => {
  it('TU 1 · une vente de biens est datée à sa facture, et la déclaration le dit avec le montant', async () => {
    const vente = ligneTva({
      id: 'B',
      date: '2026-04-03',
      compteTva: '44310000',
      collecte: true,
      tva: 160_000,
      contreparties: [
        { numero: '41110000', classe: 'CLASSE_4', debit: 1_160_000, credit: 0 },
        { numero: '70110000', classe: 'CLASSE_7', debit: 0, credit: 1_000_000 },
      ],
    });
    const d = await declarer([vente], '2026-04');
    expect(d.totalCollecte).toBe(160_000);
    expect(d.mentionExigibilite).toContain('LIVRAISON DATÉE À SA FACTURE · 160');
    expect(d.mentionExigibilite).toContain('art. 24, 1°');
  });

  it('TU 4 · la livraison à soi-même (72, 4434) est datée à son écriture, première utilisation nommée (art. 24, 8°)', async () => {
    const soiMeme = ligneTva({
      id: 'S',
      date: '2026-06-30',
      compteTva: '44340000',
      collecte: true,
      tva: 80_000,
      contreparties: [
        { numero: '24410000', classe: 'CLASSE_2', debit: 580_000, credit: 0 },
        { numero: '72100000', classe: 'CLASSE_7', debit: 0, credit: 500_000 },
      ],
    });
    const d = await declarer([soiMeme], '2026-06');
    expect(d.mentionExigibilite).toContain('LIVRAISON À SOI-MÊME DATÉE À SON ÉCRITURE · 80');
    expect(d.mentionExigibilite).toContain('« la première utilisation ou la première mise en service »');
    expect(d.mentionExigibilite).not.toContain('LIVRAISON DATÉE À SA FACTURE');
  });

  it('TU 5 · la location-vente (6234) est une livraison, datée à chaque écriture, et la déclaration le dit', async () => {
    const lv = ligneTva({
      id: 'L',
      date: '2026-07-31',
      compteTva: '44520000',
      collecte: false,
      tva: 16_000,
      contreparties: [
        { numero: '62340000', classe: 'CLASSE_6', debit: 100_000, credit: 0 },
        { numero: '40110000', classe: 'CLASSE_4', debit: 0, credit: 116_000 },
      ],
    });
    const d = await declarer([lv], '2026-07');
    expect(d.totalDeductible).toBe(16_000);
    expect(d.mentionExigibilite).toContain('LOCATION-VENTE DATÉE À CHAQUE ÉCRITURE · 16');
    expect(d.mentionExigibilite).toContain('art. 25, 7°');
  });
});

describe('TU 3 et 6 · les réserves générales de la mention', () => {
  it('chèque, virement et affacturage (décret art. 57), conditions suspensive et résolutoire (art. 53 et 54)', async () => {
    const d = await declarer([], '2026-08');
    expect(d.mentionExigibilite).toContain('REMISE du chèque');
    expect(d.mentionExigibilite).toContain('CRÉDIT DU COMPTE DU FOURNISSEUR');
    expect(d.mentionExigibilite).toContain('affacturage');
    expect(d.mentionExigibilite).toContain('« au moment de la réalisation de cette condition »');
    expect(d.mentionExigibilite).toContain('« dès la conclusion du contrat »');
  });
});

describe('Vocabulaire · la base de date dit ce qu’elle lit (art. 24, 25 et 26)', () => {
  const source = readFileSync(join(__dirname, 'taux-tva.service.ts'), 'utf8');

  it('la base s’appelle DATE_ECRITURE, et son commentaire distingue fait générateur et exigibilité', () => {
    expect(source).toContain("base: 'DATE_ECRITURE' | 'ENCAISSEMENT'");
    expect(source).toContain('`DATE_ECRITURE` couvre trois cas');
    expect(source).toContain('NÉE et pas encore EXIGIBLE');
  });

  it('la mention générale dit que la taxe d’une prestation naît à l’exécution (art. 24, 2°)', async () => {
    const d = await declarer([], '2026-08');
    expect(d.mentionExigibilite).toContain('dont la taxe naît à l’exécution (art. 24, 2°)');
  });
});
