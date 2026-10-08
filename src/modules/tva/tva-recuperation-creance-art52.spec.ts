import { TauxTvaService } from './taux-tva.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LIGNE A7 BIS, PARTIE 2 · LA DÉCLARATION LIT LA RÉCUPÉRATION DE LA TVA D'UNE
 * CRÉANCE IRRÉCOUVRABLE (O.-L. n° 10/001, art. 52 ; décret n° 011/42, art.
 * 126 et 127).
 *
 *  · sa pièce est le DUPLICATA surchargé (art. 52 al. 3, art. 127 al. 2),
 *    exigé par le module · l'avoir n'est jamais compté « sans note de crédit » ;
 *  · son ANNULATION, une inscription en négatif (débit NÉGATIF du 443), se lit
 *    au signe près · ignorée, l'avoir annulé restait récupéré ;
 *  · la liquidation reprend AU DÉBIT une récupération devenue négative ;
 *  · la taxe d'une facture et sa base d'exigibilité se lisent par la règle de
 *    la déclaration (`taxeDesFactures`).
 */
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };

interface LigneFausse {
  date: string;
  debit?: number;
  credit?: number;
  recuperation?: boolean;
  /** Point D · la ligne 443 de la perte qui récupère la taxe (D 651 / D 443 / C compte d'origine). */
  perte?: boolean;
  piece?: number;
  corrige?: { numeroPiece: number; date: string };
  noteDeCredit?: boolean;
}

function service(lignes: LigneFausse[], derniere: { dateDebut: Date; dateFin: Date } | null = null) {
  const lu: { select?: any; where?: any } = {};
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    ecriture: { count: jest.fn().mockResolvedValue(0) },
    ligneEcriture: {
      findMany: jest.fn().mockImplementation(({ where, select }: { where: Record<string, unknown>; select?: any }) => {
        const compte = where.compte as { OR?: unknown } | undefined;
        if (!compte?.OR) return Promise.resolve([]);
        lu.select = select;
        lu.where = where;
        const demandeLaRecuperation = !!select?.ecriture?.select?.recuperationTvaCreance;
        const demandeLaPerte = !!select?.ecriture?.select?.mouvementCreanceDouteusePerte;
        return Promise.resolve(
          lignes.map((l, i) => ({
            id: `l${i}`,
            tauxTvaId: TAUX.id,
            compteId: 'c4431',
            compte: { numero: '44310000' },
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            ecriture: {
              date: new Date(l.date),
              lignes: [],
              facture: l.noteDeCredit ? { nature: 'NOTE_DE_CREDIT' } : null,
              recuperationTvaCreance: demandeLaRecuperation && l.recuperation ? { id: 'r1', annuleeLe: null } : null,
              mouvementCreanceDouteusePerte: demandeLaPerte && l.perte ? { id: 'mv-p' } : null,
              numeroPiece: select?.ecriture?.select?.numeroPiece ? (l.piece ?? null) : undefined,
              corrigeEcriture:
                select?.ecriture?.select?.corrigeEcriture && l.corrige ? { numeroPiece: l.corrige.numeroPiece, date: new Date(l.corrige.date) } : null,
            },
          })),
        );
      }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
    },
    factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    liquidationTva: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        const dateFin = where.dateFin as { lt?: Date } | undefined;
        if (dateFin?.lt === undefined || !derniere) return Promise.resolve(null);
        return Promise.resolve({ id: 'liq', ...derniere, net: 0, ecritureId: 'e-liq' });
      }),
    },
  } as unknown as PrismaService;
  return { service: new TauxTvaService(prisma, {} as EcritureService), lu };
}

const JANVIER = new Date('2027-01-01');
const FIN_JANVIER = new Date('2027-01-31T23:59:59.999Z');
const FEVRIER = new Date('2027-02-01');
const FIN_FEVRIER = new Date('2027-02-28T23:59:59.999Z');

describe('A7 bis, partie 2 · la déclaration et la récupération de l’art. 52', () => {
  it('la requête demande la récupération de la créance · le duplicata justifie l’avoir, jamais compté sans note de crédit', async () => {
    const { service: s, lu } = service([{ date: '2027-01-20', debit: 80_000, recuperation: true }]);
    const d = await s.declaration('t1', JANVIER, FIN_JANVIER);
    expect(lu.select.ecriture.select.recuperationTvaCreance).toEqual({ select: { id: true, annuleeLe: true } });
    // Constatée en janvier, imputée le mois suivant (décret art. 126).
    expect(d.avoirsCollecteConstates).toBe(80_000);
    expect(d.recuperationArt52).toBe(0);
    expect(d.avoirsSansNoteDeCredit).toBe(0);
  });

  it('point D · la perte qui récupère la taxe (D 6511 / D 4431 / C 4111) est un avoir justifié par son duplicata, inscrit le mois suivant', async () => {
    // Exemple de référence · 160 000 de TVA sur 1 160 000, perte de janvier.
    const { service: s, lu } = service([{ date: '2027-01-20', debit: 160_000, perte: true }]);
    const d = await s.declaration('t1', JANVIER, FIN_JANVIER);
    expect(lu.select.ecriture.select.mouvementCreanceDouteusePerte).toEqual({ select: { id: true } });
    expect(d.avoirsCollecteConstates).toBe(160_000);
    expect(d.avoirsSansNoteDeCredit).toBe(0);
    // Règle 2 · la ligne 443 SANS TAUX (taxe à l'encaissement annulée) n'est jamais lue · la requête ne prend que les lignes à un taux.
    expect(lu.where.tauxTvaId).toEqual({ in: [TAUX.id] });
    // Février, après la liquidation de janvier · 160 000 en déduction (décret art. 126).
    const { service: s2 } = service([{ date: '2027-01-20', debit: 160_000, perte: true }], { dateDebut: JANVIER, dateFin: FIN_JANVIER });
    const f = await s2.declaration('t1', FEVRIER, FIN_FEVRIER);
    expect(f.recuperationArt52).toBe(160_000);
    expect(f.avoirsSansNoteDeCredit).toBe(0);
  });

  it('février, après la liquidation de janvier · la récupération est inscrite en déduction', async () => {
    const { service: s } = service([{ date: '2027-01-20', debit: 80_000, recuperation: true }], { dateDebut: JANVIER, dateFin: FIN_JANVIER });
    const d = await s.declaration('t1', FEVRIER, FIN_FEVRIER);
    expect(d.recuperationArt52).toBe(80_000);
    expect(d.netAvantImputation).toBe(-80_000);
  });

  it('LE NÉGATIF D’UN AVOIR SE LIT · dans la même période, l’avoir annulé ne reste pas constaté', async () => {
    const { service: s } = service([
      { date: '2027-01-15', debit: 80_000, recuperation: true },
      { date: '2027-01-15', debit: -80_000 },
    ]);
    const d = await s.declaration('t1', JANVIER, FIN_JANVIER);
    expect(d.avoirsCollecteConstates).toBe(0);
    expect(d.avoirsSansNoteDeCredit).toBe(0);
  });

  it('un négatif posé après la période qui a imputé l’avoir rend une récupération NÉGATIVE, reprise au débit', async () => {
    // Avoir de janvier imputé en février ; son négatif, daté de février, est
    // repris en mars (après la liquidation de février).
    const { service: s } = service(
      [
        { date: '2027-01-15', debit: 80_000, recuperation: true },
        { date: '2027-02-10', debit: -80_000 },
      ],
      { dateDebut: FEVRIER, dateFin: FIN_FEVRIER },
    );
    const d = await s.declaration('t1', new Date('2027-03-01'), new Date('2027-03-31T23:59:59.999Z'));
    expect(d.recuperationArt52).toBe(-80_000);
    expect(d.netAvantImputation).toBe(80_000);
  });

  it('la liquidation reprend au débit du 443 une récupération négative, et s’équilibre', () => {
    const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'taux-tva.service.ts'), 'utf8') as string;
    const corps = source.slice(source.indexOf('async comptabiliserLiquidation('), source.indexOf('private async liquidationChevauchante('));
    expect(corps).toContain('if (Math.abs(pc.recuperation) > EPSILON)');
    expect(corps).toContain("{ compteId, debit: -montant, credit: 0, libelle: 'Reprise d’une récupération de TVA annulée (art. 52)' }");
    expect(corps).toContain('Math.abs(recuperationArt52) <= EPSILON');
  });
});

describe('A7 bis, partie 2 · la taxe des factures par la règle de la déclaration', () => {
  function serviceTaxe(contrepartie: string, compteTva: string, liquidationSansFige = false) {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA', regimeExigibiliteTva: 'LIVRAISONS', dateAutorisationDebitsTva: null }) },
      ecriture: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e1',
            date: new Date('2026-02-10'),
            lignes: [
              { id: 'l1', compteId: 'k', debit: 1_160_000, credit: 0, tauxTvaId: null, compte: { numero: '41110101', classe: 'CLASSE_4' } },
              { id: 'l2', compteId: 'p', debit: 0, credit: 1_000_000, tauxTvaId: null, compte: { numero: contrepartie, classe: 'CLASSE_7' } },
              { id: 'l3', compteId: 't', debit: 0, credit: 160_000, tauxTvaId: 'tx16', compte: { numero: compteTva, classe: 'CLASSE_4' } },
            ],
          },
        ]),
      },
      liquidationTva: { findFirst: jest.fn().mockResolvedValue(liquidationSansFige ? { id: 'ancienne' } : null) },
    } as unknown as PrismaService;
    return new TauxTvaService(prisma, {} as EcritureService);
  }

  it('une vente de marchandises (701) est datée à la facture · sa taxe est acquittée', async () => {
    const { factures, ancienMoteur } = await serviceTaxe('70110000', '44310000').taxeDesFactures('t1', ['e1']);
    expect(factures.get('e1')).toEqual({
      ttc: 1_160_000,
      lignesTva: [{ ligneId: 'l3', compteId: 't', numero: '44310000', tauxTvaId: 'tx16', tva: 160_000, base: 'DATE_ECRITURE', nature: 'BIENS' }],
    });
    expect(ancienMoteur).toBe(false);
  });

  it('une prestation (706) est datée à l’encaissement (art. 25, 2°), et une liquidation sans figé est signalée', async () => {
    const { factures, ancienMoteur } = await serviceTaxe('70610000', '44320000', true).taxeDesFactures('t1', ['e1']);
    expect(factures.get('e1')?.lignesTva[0]).toMatchObject({ base: 'ENCAISSEMENT', nature: 'SERVICES' });
    expect(ancienMoteur).toBe(true);
  });
});

describe('A7 bis, partie 2, relecture MAJEUR 1 · la correction d’un avoir HORS module se lit, et se DIT', () => {
  const FEV = new Date('2026-02-01');
  const FIN_FEV = new Date('2026-02-28T23:59:59.999Z');
  const MARS = new Date('2026-03-01');
  const FIN_MARS = new Date('2026-03-31T23:59:59.999Z');
  const AVRIL = new Date('2026-04-01');
  const FIN_AVRIL = new Date('2026-04-30T23:59:59.999Z');
  // Avoir sur vente du 10 février (note de crédit, pièce 7), corrigé au journal
  // par inscription en négatif le 15 mars (pièce 12), hors module.
  const lignes: LigneFausse[] = [
    { date: '2026-01-20', credit: 160_000, piece: 3 },
    { date: '2026-02-10', debit: 80_000, piece: 7, noteDeCredit: true },
    { date: '2026-03-15', debit: -80_000, piece: 12, corrige: { numeroPiece: 7, date: '2026-02-10' } },
  ];

  it('la période liquidée de février ne bouge pas · l’avoir y reste constaté, aucune reprise n’y pèse', async () => {
    const { service: s } = service(lignes, { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-01-31T23:59:59.999Z') });
    const d = await s.declaration('t1', FEV, FIN_FEV);
    expect(d.avoirsCollecteConstates).toBe(80_000);
    expect(d.reprisesAvoirsCorriges).toEqual([]);
    expect(d.reprisesAvoirsCorrigesTotal).toBe(0);
  });

  it('mars · l’avoir de février est déduit, son négatif constaté, et la reprise NOMMÉE (pièce, avoir corrigé, montant)', async () => {
    const { service: s, lu } = service(lignes, { dateDebut: FEV, dateFin: FIN_FEV });
    const d = await s.declaration('t1', MARS, FIN_MARS);
    expect(lu.select.ecriture.select.numeroPiece).toBe(true);
    expect(lu.select.ecriture.select.corrigeEcriture).toEqual({ select: { numeroPiece: true, date: true, valideeAt: true, createdAt: true } });
    expect(d.recuperationArt52).toBe(80_000);
    expect(d.avoirsCollecteConstates).toBe(-80_000);
    expect(d.reprisesAvoirsCorriges).toEqual([
      { piece: 12, date: '2026-03-15', avoirCorrige: { piece: 7, date: '2026-02-10' }, montant: 80_000, pese: 'CONSTATEE_ICI' },
    ]);
    expect(d.mentionExigibilite).toContain('REPRISE D’AVOIRS CORRIGÉS · 1 inscription(s) en négatif');
    // Un négatif annule · jamais compté « sans note de crédit ».
    expect(d.avoirsSansNoteDeCredit).toBe(0);
  });

  it('avril, après la liquidation de mars · la récupération NÉGATIVE est reprise, et la phrase le dit', async () => {
    const { service: s } = service(lignes, { dateDebut: MARS, dateFin: FIN_MARS });
    const d = await s.declaration('t1', AVRIL, FIN_AVRIL);
    expect(d.recuperationArt52).toBe(-80_000);
    expect(d.netAvantImputation).toBe(80_000);
    expect(d.reprisesAvoirsCorriges.map((r) => r.pese)).toEqual(['DEDUCTION_REPRISE_ICI']);
    expect(d.mentionExigibilite).toContain('RÉCUPÉRATION NÉGATIVE');
    expect(d.mentionExigibilite).toContain('REPRISE D’AVOIRS CORRIGÉS');
  });
});
