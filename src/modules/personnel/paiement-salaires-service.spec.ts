import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaiementSalairesService } from './paiement-salaires.service';
import { PersonnelService } from './personnel.service';
import { OrdresVirementService } from '../reglements/ordres-virement.service';
import { PrismaService } from '../../common/prisma.service';
import type { EcritureService } from '../comptabilite/ecriture.service';

/**
 * RELECTURE DE LA LIGNE L5 (premier tour) · PAYER LES SALAIRES.
 *
 * (M4) Un salaire payé hors du module (D 422 / C trésorerie à la main) se
 * proposait encore « à payer » · le 422 est confronté à ce qui se propose.
 * (M5) Un bulletin payé puis annulé sans bulletin émis qui le remplace
 * laissait un versement que rien ne nommait.
 * (Mineur 6) Ce qui est déjà versé se lisait sur 8 000 lignes au plus, sans
 * le dire · la somme se demande à la base, groupée.
 * (Mineur 7) Un ordre de virement en francs partait vers un RIB de salarié
 * tenu en dollars.
 */

const bulletin = (p: Record<string, unknown>) => ({
  id: 'b-1',
  numero: 1,
  nature: 'MOIS',
  statut: 'EMIS',
  salarieId: 's-1',
  nomComplet: 'KABONGO Jean',
  netAPayerFc: new Prisma.Decimal(900_000),
  ecritureId: 'e-paie',
  remisLe: null,
  salarie: { modePaiement: 'ESPECES', ribs: [] },
  ...p,
});

const EXERCICE_2025 = { id: 'x-2025', dateDebut: new Date('2025-01-01T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z') };
const EXERCICE_2026 = { id: 'x-2026', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };

function service(p: {
  bulletins: unknown[];
  groupes?: unknown[];
  versements?: unknown[];
  solde422?: { debit: number; credit: number };
  exercicePassation?: typeof EXERCICE_2026;
  suivants?: (typeof EXERCICE_2026)[];
  aggregate?: jest.Mock;
}) {
  const groupBy = jest.fn().mockResolvedValue(p.groupes ?? []);
  const prisma = {
    bulletinPaie: { findMany: jest.fn().mockResolvedValue(p.bulletins) },
    lignePaiementSalaire: { groupBy, findMany: jest.fn().mockResolvedValue(p.versements ?? []) },
    paiementSalaires: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    journal: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    ecriture: { findMany: jest.fn().mockResolvedValue([{ exercice: p.exercicePassation ?? EXERCICE_2026 }]) },
    exercice: { findMany: jest.fn().mockResolvedValue(p.suivants ?? []) },
    ligneEcriture: {
      aggregate:
        p.aggregate ??
        jest.fn().mockResolvedValue({
          _sum: { debit: new Prisma.Decimal(p.solde422?.debit ?? 0), credit: new Prisma.Decimal(p.solde422?.credit ?? 900_000) },
        }),
    },
  } as unknown as PrismaService;
  return { svc: new PaiementSalairesService(prisma, { verifierCaisseProvisionnee: jest.fn() } as unknown as EcritureService, {} as OrdresVirementService), groupBy, prisma };
}

describe('M4 · le 422 confronté à ce qui se propose sur des bulletins passés au journal', () => {
  it('le 422 porte 900 000, 900 000 se proposent · rien à dire', async () => {
    const { svc } = service({ bulletins: [bulletin({})] });
    const p = await svc.proposition('t', '2026-08');
    expect(p.confrontation422).toMatchObject({ solde: 900_000, totalPasse: 900_000, avertissement: null });
  });

  it('payé à la main (D 422 de 900 000) · le 422 est soldé, et la proposition le dit avant de payer une seconde fois', async () => {
    const { svc } = service({ bulletins: [bulletin({})], solde422: { debit: 900_000, credit: 900_000 } });
    const p = await svc.proposition('t', '2026-08');
    expect(p.aPayer).toHaveLength(1);
    expect(p.confrontation422?.avertissement).toMatch(/ne porte plus que 0\.00 .* payé hors de ce module/);
  });
});

describe('second tour, point 5 · le 422 se lit depuis l’exercice de la passation, jamais celui du jour', () => {
  // La paie de décembre 2025 est passée dans 2025 et se paie en janvier 2026.
  // 2026 porte l'à-nouveau du 422 (900 000), qui ne fait que reporter le
  // solde déjà compté dans 2025.
  const sommes = (p: { tout2025: [number, number]; tout2026: [number, number]; ouverture2026: [number, number] }) =>
    jest.fn().mockImplementation(({ where }: { where: { ecriture: Record<string, unknown> } }) => {
      const e = where.ecriture;
      const [debit, credit] = 'AND' in e ? p.ouverture2026 : e.exerciceId === 'x-2025' ? p.tout2025 : p.tout2026;
      return Promise.resolve({ _sum: { debit: new Prisma.Decimal(debit), credit: new Prisma.Decimal(credit) } });
    });

  it('décembre payé en janvier, à-nouveau passé · le 422 porte 900 000, rien à dire', async () => {
    const aggregate = sommes({ tout2025: [0, 900_000], tout2026: [0, 900_000], ouverture2026: [0, 900_000] });
    const { svc } = service({ bulletins: [bulletin({})], exercicePassation: EXERCICE_2025, suivants: [EXERCICE_2026], aggregate });
    const p = await svc.proposition('t', '2025-12');
    expect(p.confrontation422).toMatchObject({ solde: 900_000, totalPasse: 900_000, avertissement: null });
  });

  it('janvier sans à-nouveau encore (N non clôturé) · le 422 de la passation porte 900 000, aucun faux « payé hors module »', async () => {
    const aggregate = sommes({ tout2025: [0, 900_000], tout2026: [0, 0], ouverture2026: [0, 0] });
    const { svc } = service({ bulletins: [bulletin({})], exercicePassation: EXERCICE_2025, suivants: [EXERCICE_2026], aggregate });
    const p = await svc.proposition('t', '2025-12');
    expect(p.confrontation422?.avertissement).toBeNull();
    expect(p.confrontation422?.solde).toBe(900_000);
  });

  it('payé à la main en janvier (D 422 hors de l’ouverture) · le 422 est soldé, et c’est dit', async () => {
    const aggregate = sommes({ tout2025: [0, 900_000], tout2026: [900_000, 900_000], ouverture2026: [0, 900_000] });
    const { svc } = service({ bulletins: [bulletin({})], exercicePassation: EXERCICE_2025, suivants: [EXERCICE_2026], aggregate });
    const p = await svc.proposition('t', '2025-12');
    expect(p.confrontation422?.avertissement).toMatch(/ne porte plus que 0\.00 .* payé hors de ce module/);
  });
});

describe('M5 · un bulletin payé puis annulé, sans bulletin émis qui le remplace, est nommé avec sa pièce', () => {
  it('nommé à la proposition, avec le montant versé et la pièce', async () => {
    const { svc } = service({
      bulletins: [bulletin({ statut: 'ANNULE' })],
      groupes: [{ bulletinId: 'b-1', salarieId: 's-1', _sum: { montant: new Prisma.Decimal(900_000) } }],
      versements: [{ bulletinId: 'b-1', montant: new Prisma.Decimal(900_000), paiement: { date: new Date('2026-08-31T00:00:00Z'), piecePassee: 'CA n° 7' } }],
    });
    const p = await svc.proposition('t', '2026-08');
    expect(p.versementsSansBulletin).toEqual([
      { bulletinId: 'b-1', numero: 1, nomComplet: 'KABONGO Jean', montant: 900_000, pieces: [{ date: new Date('2026-08-31T00:00:00Z'), piece: 'CA n° 7' }] },
    ]);
  });

  it('réémis, le bulletin du mois absorbe le versement · rien n’est nommé', async () => {
    const { svc } = service({
      bulletins: [bulletin({ statut: 'ANNULE' }), bulletin({ id: 'b-2', numero: 2, netAPayerFc: new Prisma.Decimal(950_000) })],
      groupes: [{ bulletinId: 'b-1', salarieId: 's-1', _sum: { montant: new Prisma.Decimal(900_000) } }],
    });
    const p = await svc.proposition('t', '2026-08');
    expect(p.versementsSansBulletin).toEqual([]);
    expect(p.aPayer.map((l) => l.montant)).toEqual([50_000]);
  });

  it('le bulletin annulé relu dit qu’il a été payé, et sa pièce', async () => {
    const prisma = {
      bulletinPaie: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: { statut?: string } }) =>
          Promise.resolve(
            where.statut === 'EMIS'
              ? null
              : {
                  id: 'b-1',
                  statut: 'ANNULE',
                  nature: 'MOIS',
                  salarieId: 's-1',
                  moisDePaie: '2026-08',
                  totalVerseFc: 0,
                  assietteSocialeFc: 0,
                  cotisationsTravailleurFc: 0,
                  cotisationsEmployeurFc: 0,
                  irppFc: 0,
                  netAPayerFc: 900_000,
                },
          ),
        ),
      },
      lignePaiementSalaire: {
        findMany: jest.fn().mockResolvedValue([{ montant: new Prisma.Decimal(900_000), paiement: { date: new Date('2026-08-31T00:00:00Z'), piecePassee: 'CA n° 7' } }]),
      },
    } as unknown as PrismaService;
    const b = await new PersonnelService(prisma).lireBulletin('t', 'b-1');
    expect(b.versements?.avertissement).toMatch(/payé \(900000\.00, pièce CA n° 7 du 2026-08-31\), et aucun bulletin émis du mois ne le remplace/);
  });
});

describe('mineur 6 · ce qui est déjà versé se somme en base, sans borne muette', () => {
  it('lit les versements par regroupement, jamais par une lecture bornée à 8 000 lignes', async () => {
    const { svc, groupBy } = service({
      bulletins: [bulletin({})],
      groupes: [{ bulletinId: 'b-1', salarieId: 's-1', _sum: { montant: new Prisma.Decimal(900_000) } }],
    });
    const p = await svc.proposition('t', '2026-08');
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ['bulletinId', 'salarieId'], _sum: { montant: true } }));
    expect(groupBy.mock.calls[0][0]).not.toHaveProperty('take');
    expect(p.aPayer).toEqual([]);
  });
});

describe('mineur 7 · un ordre de virement en francs ne part pas vers un RIB en dollars', () => {
  it('refuse, salarié et monnaie nommés, avec les deux issues', async () => {
    const prisma = {
      ribBanque: {
        findFirst: jest.fn().mockResolvedValue({
          devise: 'CDF',
          abrege: 'RAW',
          iban: null,
          numeroCompte: '0001',
          codeBanque: null,
          codeGuichet: null,
          cle: null,
          codeBic: null,
          banque: { intitule: 'Rawbank' },
          journal: { code: 'BQ' },
        }),
      },
      tenant: { findUnique: jest.fn().mockResolvedValue({ visaRibs: false }) },
      ribSalarie: {
        findMany: jest.fn().mockResolvedValue([
          { salarieId: 's-1', estPrincipal: true, devise: 'USD', titulaire: null, banque: 'Equity', iban: null, numeroCompte: '99', codeBanque: null, codeGuichet: null, cle: null, codeBic: null },
        ]),
      },
    } as unknown as PrismaService;
    const ordres = new OrdresVirementService(prisma);
    const echec = ordres.preparerSalaries('t', 'j-bq', [{ id: 's-1', nomComplet: 'KABONGO Jean' }]);
    await expect(echec).rejects.toBeInstanceOf(BadRequestException);
    await expect(ordres.preparerSalaries('t', 'j-bq', [{ id: 's-1', nomComplet: 'KABONGO Jean' }])).rejects.toThrow(
      /KABONGO Jean \(USD\).*Désignez un RIB principal en CDF.*autre mode/,
    );
  });
});
