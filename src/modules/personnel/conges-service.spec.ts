import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CongesService } from './conges.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * RELECTURE DE LA LIGNE L5 (premier tour) · POSER UN CONGÉ.
 *
 * (M2) Un congé posé sur une absence déjà déclarée passait · un même jour
 * avait deux causes, et le bulletin payait l'allocation d'un jour d'absence
 * non autorisée. Seule la maladie coexiste avec un congé (Code du travail,
 * art. 141, al. 4).
 * (Mineur 5) Un congé posé à une date ANTÉRIEURE à un congé déjà posé
 * passait sur le solde entier, comme si l'autre n'existait pas.
 * (Mineur 7) Le compteur lu sans date l'était au jour UTC du serveur, la
 * veille à Kinshasa entre 23 h et minuit UTC.
 */

const MOIS_PAYES = [
  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
];
const CONTRAT = {
  id: 'k-1',
  dateEntreeEnVigueur: new Date('2025-06-01T00:00:00Z'),
  dateFin: null,
  renouvelleDeId: null,
  remunerationBase: new Prisma.Decimal(1_040_000),
  periodiciteRemuneration: 'MOIS',
  deviseRemuneration: 'CDF',
};
const congeDeSeptembre = {
  id: 'c-sept',
  tenantId: 't',
  salarieId: 's-1',
  du: new Date('2026-09-01T00:00:00Z'),
  au: new Date('2026-09-11T00:00:00Z'),
  joursVoyage: 0,
  moisDePaie: '2026-08',
  deviseAllocation: null,
  remunerationJournaliere: null,
  moyenneMensuelleArticle142: null,
  auDelaDuSolde: false,
  motifAuDelaDuSolde: null,
  annuleLe: null,
  motifAnnulation: null,
  bulletin: null,
};

function service(p: { conges?: unknown[]; absences?: unknown[]; joursSaisis?: unknown[] } = {}) {
  const create = jest.fn().mockResolvedValue({ id: 'c-neuf' });
  const prisma = {
    salarie: {
      findFirst: jest.fn().mockResolvedValue({
        id: 's-1',
        nom: 'KABONGO',
        dateNaissance: new Date('1990-04-12T00:00:00Z'),
        millesimeNaissance: null,
        contrats: [CONTRAT],
      }),
    },
    bulletinPaie: {
      findMany: jest.fn().mockResolvedValue(MOIS_PAYES.map((m, i) => ({ id: `b-${i}`, numero: i + 1, moisDePaie: m, nature: 'MOIS' }))),
    },
    repriseCongesSalarie: { findFirst: jest.fn().mockResolvedValue(null) },
    congeSalarie: { findMany: jest.fn().mockResolvedValue(p.conges ?? []), create },
    jourFeuilleTemps: { findMany: jest.fn().mockResolvedValue(p.joursSaisis ?? []) },
    absenceSalarie: { findMany: jest.fn().mockResolvedValue(p.absences ?? []) },
    contratTravail: { findMany: jest.fn().mockResolvedValue([CONTRAT]) },
  } as unknown as PrismaService;
  return { svc: new CongesService(prisma), create };
}

const aout = { du: '2026-08-03', au: '2026-08-06', moisDePaie: '2026-08' };
const absence = (nature: string, du: string, au: string) => ({
  id: `a-${nature}`,
  nature,
  du: new Date(`${du}T00:00:00Z`),
  au: new Date(`${au}T00:00:00Z`),
  demiJourneeDebut: false,
  demiJourneeFin: false,
});

describe('M2 · un congé ne se pose pas sur une absence, sauf la maladie (art. 141, al. 4)', () => {
  it('refuse le congé qui chevauche une absence non autorisée, absence et article nommés', async () => {
    const { svc, create } = service({ absences: [absence('ABSENCE_NON_AUTORISEE', '2026-08-05', '2026-08-05')] });
    const echec = svc.creerConge('t', 'u@x.cd', 's-1', aout);
    await expect(echec).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.creerConge('t', 'u@x.cd', 's-1', aout)).rejects.toThrow(/absence du 2026-08-05.*un jour n'a qu'une cause.*art\. 141, al\. 4/);
    expect(create).not.toHaveBeenCalled();
  });

  it('admet le congé que traverse une maladie · ses jours ne comptent pas comme jours de congé', async () => {
    const { svc, create } = service({ absences: [absence('MALADIE_OU_ACCIDENT', '2026-08-05', '2026-08-05')] });
    await svc.creerConge('t', 'u@x.cd', 's-1', aout);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('mineur 5 · le solde au départ compte les congés déjà posés plus tard', () => {
  it('sans autre congé, quatre jours passent sur les douze nés au 1er juin 2026', async () => {
    const { svc, create } = service();
    await svc.creerConge('t', 'u@x.cd', 's-1', aout);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('UN JOUR N’A QU’UNE CAUSE · le congé posé sur des jours qui portent des heures les nomme, sans les retirer', async () => {
    const { svc, create } = service({ joursSaisis: [{ jour: new Date('2026-08-04T00:00:00Z'), heures: 8 }] });
    const r = (await svc.creerConge('t', 'u@x.cd', 's-1', aout)) as { avertissements: string[] };
    expect(create).toHaveBeenCalledTimes(1);
    expect(r.avertissements.join(' ')).toMatch(/2026-08-04 \(8 h\).*ne sont plus comptées/);
  });

  it('avec dix jours déjà posés en septembre, il n’en reste que deux · quatre sont refusés, le congé de septembre nommé', async () => {
    const { svc, create } = service({ conges: [congeDeSeptembre] });
    await expect(svc.creerConge('t', 'u@x.cd', 's-1', aout)).rejects.toThrow(/solde des droits nés au 2026-08-03 est de 2, compte tenu du congé déjà posé du 2026-09-01 au 2026-09-11/);
    expect(create).not.toHaveBeenCalled();
    await svc.creerConge('t', 'u@x.cd', 's-1', { ...aout, au: '2026-08-04' });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('mineur 7 · le compteur sans date se lit au jour de Kinshasa', () => {
  afterEach(() => jest.useRealTimers());

  it('à 23 h 30 UTC le 2 août, il est déjà le 3 août à Kinshasa', async () => {
    jest.useFakeTimers({ now: new Date('2026-08-02T23:30:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const { svc } = service();
    const r = await svc.compteur('t', 's-1');
    expect(r.aLa).toBe('2026-08-03');
  });
});
