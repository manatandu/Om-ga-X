import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CongesService, allocationsAPorter } from './conges.service';
import { PrismaService } from '../../common/prisma.service';
import {
  congesDuMois,
  motifRefusAnnulationDuCongeRetranche,
  motifRefusSalairePleinPendantLeConge,
  propositionDuMois,
  raisonDeLaGardeMuette,
} from './absences';
import { confronterSalaireAuxConges, moisTouches, salaireDeLaSaisie } from './salaire-pendant-le-conge';

/**
 * RELECTURE DE LA LIGNE L5, SECOND TOUR.
 *
 * (B1) Le refus du salaire plein pendant le congé ne tenait que dans un ordre
 * de saisie · bulletin de septembre émis à 1 040 000, PUIS congé de
 * septembre posé avec son allocation au bulletin d'octobre · les jours du
 * congé payés deux fois, en silence. Et dans l'autre sens · septembre réduit
 * par la garde, puis le congé annulé · septembre restait amputé sans un mot.
 * « Pendant toute la durée du congé, le travailleur a droit à une allocation
 * égale à la rémunération » (Code du travail, art. 142) · un même jour ne se
 * paie qu'une fois (arrêté du 8 août 2008, mentions 6, 14 et 28).
 * (Point 1) La référence est la plus grande du salaire du contrat et du taux
 * journalier déclaré au congé × 26, et l'issue « contrat en vigueur » est dite.
 * (Point 2) La garde qui ne compare rien (journalier, sans monnaie, autre
 * monnaie) le DIT.
 * (Point 3) Même base que la proposition pour un mois couvert en entier.
 */

const SANS_MALADIE = new Set<string>();
const jour = (s: string) => new Date(`${s}T00:00:00Z`);

describe('point 3 · même base des deux côtés pour un mois couvert en entier', () => {
  // Décembre 2026 · 27 jours du lundi au samedi, dont le 25 décembre, férié
  // (ordonnance n° 23-042, art. 1er) · 26 jours ouvrables du Code, 27 jours
  // payables. Le congé couvre tout le mois · la proposition paie le férié à
  // plein (art. 93) sur une base de 27.
  const conges = congesDuMois([{ id: 'c-dec', du: '2026-12-01', au: '2026-12-31', joursVoyage: 0 }], '2026-12', SANS_MALADIE);
  const proposition = propositionDuMois({ jours: [], salaireMensuel: 1_040_000, moyenneMensuelleArticle66: null, conges, mois: '2026-12' });

  it('la proposition paie 1 040 000 ÷ 27 = 38 518,52 · le jour férié du congé', () => {
    expect(conges[0].auMoins).toBe(26);
    expect([proposition.baseDuMois, proposition.salaireDesJoursDus]).toEqual([27, 38_518.52]);
  });

  it('suivre la proposition passe la garde, un centime de plus ne passe pas', () => {
    const garde = (salaire: number) =>
      motifRefusSalairePleinPendantLeConge({ mois: '2026-12', conges, salaireDuBulletin: salaire, salaireMensuel: 1_040_000, devise: 'CDF' });
    expect(garde(proposition.salaireDesJoursDus as number)).toBeNull();
    const m = garde(38_518.53);
    expect(m).toContain('38518.52 CDF');
    expect(m).toContain('27 jours payables');
  });
});

describe('point 1 · la référence est la plus grande du contrat et du taux déclaré au congé × 26', () => {
  const aout = (remunerationJournaliere: number | null, deviseAllocation: string | null) =>
    congesDuMois([{ id: 'c-1', du: '2026-08-03', au: '2026-08-15', joursVoyage: 0 }], '2026-08', SANS_MALADIE).map((c) => ({
      ...c,
      remunerationJournaliere,
      deviseAllocation,
    }));
  const garde = (salaire: number, rj: number | null, devise: string | null) =>
    motifRefusSalairePleinPendantLeConge({ mois: '2026-08', conges: aout(rj, devise), salaireDuBulletin: salaire, salaireMensuel: 1_040_000, devise: 'CDF' });

  it('un taux déclaré de 50 000 (× 26 = 1 300 000) élève le plafond · 1 300 000 × 14 / 26 = 700 000', () => {
    expect(garde(700_000, 50_000, 'CDF')).toBeNull();
    const m = garde(700_000.01, 50_000, 'CDF');
    expect(m).toContain('700000.00 CDF');
    expect(m).toContain('rémunération journalière déclarée au congé × 26');
    expect(m).not.toContain('contrat en vigueur');
  });

  it('la référence du contrat nomme l’issue · saisir le contrat en vigueur', () => {
    const m = garde(1_040_000, 40_000, 'CDF');
    expect(m).toContain('560000.00 CDF');
    expect(m).toContain('salaire mensuel du contrat');
    expect(m).toContain("saisissez d'abord le contrat en vigueur");
  });

  it('un taux déclaré dans une autre monnaie n’élève rien', () => {
    expect(garde(700_000, 50_000, 'USD')).not.toBeNull();
  });
});

describe('point 2 · la garde qui ne compare rien le dit', () => {
  const contrat = (p: Partial<{ remunerationBase: number | null; periodiciteRemuneration: string | null; deviseRemuneration: string | null }>) => ({
    remunerationBase: 1_040_000,
    periodiciteRemuneration: 'MOIS',
    deviseRemuneration: 'CDF',
    ...p,
  });

  it('journalier, sans monnaie, autre monnaie · chacun sa raison ; au mois dans la monnaie · elle compare', () => {
    expect(raisonDeLaGardeMuette(contrat({ periodiciteRemuneration: 'JOUR' }), 'CDF')).toBe('le contrat est payé à la journée, pas au mois');
    expect(raisonDeLaGardeMuette(contrat({ deviseRemuneration: null }), 'CDF')).toBe("la monnaie de la rémunération n'est pas renseignée au contrat");
    expect(raisonDeLaGardeMuette(contrat({ deviseRemuneration: 'USD' }), 'CDF')).toBe('le contrat est stipulé en USD, le bulletin en CDF');
    expect(raisonDeLaGardeMuette(contrat({ remunerationBase: null }), 'CDF')).toBe("la rémunération n'est pas renseignée au contrat");
    expect(raisonDeLaGardeMuette(contrat({}), 'CDF')).toBeNull();
  });

  it('à l’émission d’un bulletin journalier d’un mois de congé · aucun refus, un avertissement qui nomme le congé et la raison', async () => {
    const prisma = {
      congeSalarie: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c-1',
            du: jour('2026-08-03'),
            au: jour('2026-08-15'),
            joursVoyage: 0,
            moisDePaie: '2026-08',
            remunerationJournaliere: null,
            deviseAllocation: null,
            bulletin: null,
          },
        ]),
      },
      absenceSalarie: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const r = await confronterSalaireAuxConges(prisma, 't', 's-1', {
      mois: '2026-08',
      salaire: 1_040_000,
      devise: 'CDF',
      contrat: { remunerationBase: new Prisma.Decimal(40_000), periodiciteRemuneration: 'JOUR', deviseRemuneration: 'CDF' },
    });
    expect(r.refus).toBeNull();
    expect(r.avertissement).toMatch(/Le bulletin de 2026-08 n'est pas confronté aux 12 jour\(s\) de congé de ce mois \(congé du 2026-08-03 au 2026-08-15\) · le contrat est payé à la journée, pas au mois\..*art\. 142/);
  });
});

describe('les petites lectures', () => {
  it('le salaire d’une saisie figée · franc par défaut, dollars lus en dollars, illisible rendu null', () => {
    expect(salaireDeLaSaisie({ elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', montantFc: 680_000 }, { nature: 'PRIME', montantFc: 5 }] })).toEqual({
      salaire: 680_000,
      devise: 'CDF',
    });
    expect(salaireDeLaSaisie({ deviseStipulation: 'USD', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', montantUsd: 400 }] })).toEqual({ salaire: 400, devise: 'USD' });
    expect(salaireDeLaSaisie({ deviseStipulation: 'EUR', elements: [] })).toBeNull();
    expect(salaireDeLaSaisie(null)).toBeNull();
  });

  it('les mois qu’un congé touche, année franchie comprise', () => {
    expect(moisTouches('2026-12-21', '2027-01-08')).toEqual(['2026-12', '2027-01']);
    expect(moisTouches('2026-09-10', '2026-09-19')).toEqual(['2026-09']);
  });
});

// ---------------------------------------------------------------------------
// B1 · les deux ordres de saisie, aux trois portes du congé.
// ---------------------------------------------------------------------------

const MOIS_PAYES = [
  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
];
const CONTRAT = {
  id: 'k-1',
  dateEntreeEnVigueur: jour('2025-06-01'),
  dateFin: null,
  renouvelleDeId: null,
  remunerationBase: new Prisma.Decimal(1_040_000),
  periodiciteRemuneration: 'MOIS',
  deviseRemuneration: 'CDF',
};
type BulletinFige = { id: string; numero: number; moisDePaie: string; salaire: number; contrat?: Partial<typeof CONTRAT> };
type CongeEnBase = {
  id: string;
  du: Date;
  au: Date;
  moisDePaie: string;
  annuleLe: Date | null;
  bulletin: { numero: number; statut: string; moisDePaie?: string } | null;
};

/**
 * Une base qui HONORE les requêtes (statut, mois, identifiants, chevauchement
 * des dates) · ce qui dépend de ce qu'une requête ramène se teste sur elle.
 */
function base(p: { emis: BulletinFige[]; conges?: CongeEnBase[] }) {
  const conges = (p.conges ?? []).map((c) => ({
    tenantId: 't',
    salarieId: 's-1',
    joursVoyage: 0,
    deviseAllocation: 'CDF',
    remunerationJournaliere: new Prisma.Decimal(40_000),
    moyenneMensuelleArticle142: new Prisma.Decimal(0),
    auDelaDuSolde: false,
    motifAuDelaDuSolde: null,
    motifAnnulation: null,
    ...c,
  }));
  const anciens = MOIS_PAYES.map((m, i) => ({ id: `b-${i}`, numero: i + 1, moisDePaie: m, nature: 'MOIS' }));
  const figes = p.emis.map((b) => ({
    id: b.id,
    numero: b.numero,
    moisDePaie: b.moisDePaie,
    nature: 'MOIS',
    entree: { deviseStipulation: 'CDF', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: b.salaire }] },
    contrat: { remunerationBase: CONTRAT.remunerationBase, periodiciteRemuneration: 'MOIS', deviseRemuneration: 'CDF', ...b.contrat },
  }));
  const create = jest.fn().mockResolvedValue({ id: 'c-neuf' });
  const update = jest.fn().mockResolvedValue({});
  const prisma: Record<string, unknown> = {
    salarie: {
      findFirst: jest.fn().mockResolvedValue({ id: 's-1', nom: 'KABONGO', dateNaissance: jour('1990-04-12'), millesimeNaissance: null, contrats: [CONTRAT] }),
    },
    bulletinPaie: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { statut?: string; moisDePaie?: { in: string[] } } }) => {
        if (where.moisDePaie?.in) return Promise.resolve(figes.filter((b) => where.moisDePaie!.in.includes(b.moisDePaie)));
        return Promise.resolve([...anciens, ...figes]);
      }),
    },
    repriseCongesSalarie: { findFirst: jest.fn().mockResolvedValue(null) },
    congeSalarie: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id?: { in: string[] }; annuleLe?: null; du?: { lte: Date }; au?: { gte: Date } } }) => {
        let r = conges;
        if (where.id?.in) r = r.filter((c) => where.id!.in.includes(c.id));
        if (where.annuleLe === null) r = r.filter((c) => c.annuleLe === null);
        if (where.du?.lte) r = r.filter((c) => c.du.getTime() <= where.du!.lte.getTime());
        if (where.au?.gte) r = r.filter((c) => c.au.getTime() >= where.au!.gte.getTime());
        return Promise.resolve(r);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(conges.find((c) => c.id === where.id) ?? null)),
      create,
      update,
    },
    absenceSalarie: { findMany: jest.fn().mockResolvedValue([]) },
    contratTravail: { findMany: jest.fn().mockResolvedValue([CONTRAT]) },
  };
  prisma.$transaction = (fn: (tx: unknown) => unknown) => fn(prisma);
  return { prisma: prisma as unknown as PrismaService, create, update };
}

// Congé du jeudi 10 au samedi 19 septembre 2026 · neuf jours ouvrables du Code
// (le dimanche 13 exclu) · le salaire des jours hors congé est au plus
// 1 040 000 × 17 / 26 = 680 000.
const septembre = { du: '2026-09-10', au: '2026-09-19', moisDePaie: '2026-10', deviseAllocation: 'CDF' as const, remunerationJournaliere: 40_000, moyenneMensuelleArticle142: 0 };
const congeDeSeptembre = (bulletin: CongeEnBase['bulletin'] = null): CongeEnBase => ({
  id: 'c-sept',
  du: jour('2026-09-10'),
  au: jour('2026-09-19'),
  moisDePaie: '2026-10',
  annuleLe: null,
  bulletin,
});

describe('B1 · le congé posé APRÈS le bulletin émis d’un mois qu’il touche', () => {
  it('septembre émis à 1 040 000, puis le congé de septembre · refusé, bulletin, plafond et issue nommés', async () => {
    const { prisma, create } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000 }] });
    const echec = new CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre);
    await expect(echec).rejects.toBeInstanceOf(BadRequestException);
    await expect(new CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre)).rejects.toThrow(
      /Congé non posé · Le bulletin n° 16 de 2026-09, déjà émis, paie 1040000\.00 CDF de salaire alors que 9 jour\(s\).*680000\.00 CDF.*annulez le bulletin n° 16, posez le congé, puis réémettez le bulletin de 2026-09/,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('septembre émis au salaire des jours hors congé (680 000) · le congé se pose, rien à dire', async () => {
    const { prisma, create } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 680_000 }] });
    const r = await new CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre);
    expect(create).toHaveBeenCalledTimes(1);
    expect(r.avertissements).toEqual([]);
  });

  it('septembre émis sur un contrat à la journée · le congé se pose, et la garde dit qu’elle ne compare rien', async () => {
    const { prisma, create } = base({
      emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000, contrat: { periodiciteRemuneration: 'JOUR' } }],
    });
    const r = await new CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre);
    expect(create).toHaveBeenCalledTimes(1);
    expect(r.avertissements).toEqual([expect.stringMatching(/Le bulletin n° 16 de 2026-09 n'est pas confronté.*payé à la journée/)]);
  });
});

describe('B1 · l’allocation portée par un AUTRE mois que celui d’un bulletin déjà émis', () => {
  const porter = (prisma: PrismaService) => allocationsAPorter(prisma, 't', 's-1', '2026-10', ['c-sept'], 'CDF');

  it('septembre à 1 040 000, l’allocation du congé de septembre au bulletin d’octobre · refusée', async () => {
    const { prisma } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000 }], conges: [congeDeSeptembre()] });
    await expect(porter(prisma)).rejects.toThrow(
      /Congé du 2026-09-10 au 2026-09-19 · Le bulletin n° 16 de 2026-09, déjà émis, paie 1040000\.00 CDF.*annulez le bulletin n° 16 et réémettez le bulletin de 2026-09.*portez l'allocation au bulletin de 2026-10/,
    );
  });

  it('septembre retranché · l’allocation se porte, 9 jours à 40 000', async () => {
    const { prisma } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 680_000 }], conges: [congeDeSeptembre()] });
    const [a] = await porter(prisma);
    expect([a.jours, a.montant]).toEqual([9, 360_000]);
  });

  it('le mois du bulletin qui porte n’est pas jugé ici · l’émission le juge', async () => {
    const { prisma } = base({ emis: [{ id: 'b-oct', numero: 17, moisDePaie: '2026-10', salaire: 1_040_000 }], conges: [congeDeSeptembre()] });
    await expect(porter(prisma)).resolves.toHaveLength(1);
  });
});

describe('B1 · le congé ANNULÉ après qu’un bulletin émis a retranché ses jours', () => {
  it('septembre réduit à 680 000, l’allocation jamais portée · l’annulation du congé est refusée, l’issue nommée', async () => {
    const { prisma, update } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 680_000 }], conges: [congeDeSeptembre()] });
    await expect(new CongesService(prisma).annulerConge('t', 'u@x.cd', 'c-sept', 'pas pris')).rejects.toThrow(
      /Congé non annulé · Le bulletin n° 16 de 2026-09, émis, paie 680000\.00 CDF.*il retranche les 9 jour\(s\) de ce congé.*annulez d'abord le bulletin n° 16, puis le congé, et réémettez le bulletin de 2026-09/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('un bulletin émis au salaire plein (d’avant la règle) n’a rien retranché · l’annulation passe', async () => {
    const { prisma, update } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000 }], conges: [congeDeSeptembre()] });
    const r = await new CongesService(prisma).annulerConge('t', 'u@x.cd', 'c-sept', 'pas pris');
    expect(update).toHaveBeenCalledTimes(1);
    expect(r.avertissements).toEqual([]);
  });

  it('à cheval · porteur de septembre annulé, octobre réduit · l’annulation est refusée sur le bulletin d’octobre', async () => {
    const aCheval: CongeEnBase = {
      id: 'c-cheval',
      du: jour('2026-09-28'),
      au: jour('2026-10-03'),
      moisDePaie: '2026-09',
      annuleLe: null,
      bulletin: { numero: 16, statut: 'ANNULE' },
    };
    // Octobre · le 1er, le 2 et le 3 (jeudi à samedi) sont au congé · 1 040 000 × 23 / 26 = 920 000.
    const { prisma, update } = base({ emis: [{ id: 'b-oct', numero: 18, moisDePaie: '2026-10', salaire: 920_000 }], conges: [aCheval] });
    await expect(new CongesService(prisma).annulerConge('t', 'u@x.cd', 'c-cheval', 'pas pris')).rejects.toThrow(
      /Le bulletin n° 18 de 2026-10, émis, paie 920000\.00 CDF.*les 3 jour\(s\) de ce congé en 2026-10/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('la règle pure · retranché au plafond exactement, et un centime au-dessus n’a pas retranché', () => {
    const [c] = congesDuMois([{ id: 'c-sept', du: '2026-09-10', au: '2026-09-19', joursVoyage: 0 }], '2026-09', SANS_MALADIE);
    const motif = (salaire: number) =>
      motifRefusAnnulationDuCongeRetranche({ mois: '2026-09', numero: 16, conge: c, salaireDuBulletin: salaire, salaireMensuel: 1_040_000, devise: 'CDF' });
    expect(motif(680_000)).not.toBeNull();
    expect(motif(680_000.01)).toBeNull();
  });
});
