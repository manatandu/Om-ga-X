import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PersonnelService } from './personnel.service';
import { PrismaService } from '../../common/prisma.service';
import { congesDuMois, motifRefusSalairePleinPendantLeConge, propositionDuMois } from './absences';
import type { SimulationPaieDto } from './dto/personnel.dto';

/**
 * B1 DE LA RELECTURE (premier tour) · LES JOURS DE CONGÉ PAYÉS DEUX FOIS.
 *
 * Le bulletin d'août versait le salaire mensuel entier (1 040 000) ET
 * l'allocation de douze jours (480 000), soit 1 520 000 pour un mois qui en
 * vaut 1 040 000. « Pendant toute la durée du congé, le travailleur a droit à
 * une allocation égale à la rémunération » (Code du travail, art. 142) ·
 * l'allocation remplace le salaire de ces jours ; le livre de paie les range
 * dans des colonnes disjointes (arrêté du 8 août 2008, mentions 6, 14 et 28).
 */

const SANS_MALADIE = new Set<string>();
const conge = (p: Partial<{ id: string; du: string; au: string; joursVoyage: number }> = {}) => ({
  id: 'c-1',
  du: '2026-08-03',
  au: '2026-08-15',
  joursVoyage: 0,
  ...p,
});

describe('les jours de congé du mois (art. 142 ; mentions 6, 14 et 28)', () => {
  it('le congé du 3 au 15 août 2026 compte douze jours ouvrables du Code dans août', () => {
    const [c] = congesDuMois([conge()], '2026-08', SANS_MALADIE);
    expect([c.ouvrablesDuMois, c.joursDeConge, c.auMoins]).toEqual([12, 12, 12]);
  });

  it('le salaire des jours hors congé · 1 040 000 × 14 / 26 = 560 000, et 560 000 + 480 000 = 1 040 000 au bulletin', () => {
    const p = propositionDuMois({ jours: [], salaireMensuel: 1_040_000, moyenneMensuelleArticle66: null, conges: congesDuMois([conge()], '2026-08', SANS_MALADIE) });
    expect([p.joursDeConge, p.joursPayesAPlein, p.salaireDesJoursDus]).toEqual([12, 14, 560_000]);
    expect(p.salaireDesJoursDus! + 480_000).toBe(1_040_000);
    expect(p.explication).toContain('art. 142');
  });

  it('les jours de maladie du congé ne sont pas des jours de congé (art. 141, al. 4) · ils restent à l’absence', () => {
    const [c] = congesDuMois([conge()], '2026-08', new Set(['2026-08-10', '2026-08-11']));
    expect(c.joursDeConge).toBe(10);
  });

  it('un congé à cheval compte dans chaque mois SES jours, quel que soit le bulletin qui porte l’allocation', () => {
    const aCheval = conge({ du: '2026-08-24', au: '2026-09-05' });
    const [aout] = congesDuMois([aCheval], '2026-08', SANS_MALADIE);
    const [septembre] = congesDuMois([aCheval], '2026-09', SANS_MALADIE);
    // Août · 24 au 29 et 31 (le 30 est un dimanche) ; septembre · 1er au 5.
    expect([aout.joursDeConge, septembre.joursDeConge]).toEqual([7, 5]);
  });

  it('à cheval avec des jours de voyage, rien n’est proposé · le mois des jours de voyage n’est écrit nulle part', () => {
    const conges = congesDuMois([conge({ du: '2026-08-24', au: '2026-09-05', joursVoyage: 2 })], '2026-08', SANS_MALADIE);
    expect([conges[0].joursDeConge, conges[0].auMoins]).toEqual([null, 5]);
    const p = propositionDuMois({ jours: [], salaireMensuel: 1_040_000, moyenneMensuelleArticle66: null, conges });
    expect(p.salaireDesJoursDus).toBeNull();
    expect(p.motifs.join(' ')).toContain('jours de voyage');
  });

  it('les jours de voyage d’un congé du mois restent au salaire (art. 141, al. 3, lecture protectrice)', () => {
    const [c] = congesDuMois([conge({ joursVoyage: 2 })], '2026-08', SANS_MALADIE);
    expect(c.joursDeConge).toBe(10);
  });
});

describe('le salaire plein et l’allocation pour les mêmes jours se refusent à l’émission', () => {
  const conges = congesDuMois([conge()], '2026-08', SANS_MALADIE);
  const refus = (salaireDuBulletin: number) =>
    motifRefusSalairePleinPendantLeConge({ mois: '2026-08', conges, salaireDuBulletin, salaireMensuel: 1_040_000, devise: 'CDF' });

  it('1 040 000 de salaire avec douze jours de congé · refusé, le plafond et l’article nommés', () => {
    const m = refus(1_040_000);
    expect(m).toContain('560000.00 CDF');
    expect(m).toContain('art. 142');
    expect(m).toContain('mentions 6, 14 et 28');
  });

  it('560 000 passe, et un centime de plus ne passe pas', () => {
    expect(refus(560_000)).toBeNull();
    expect(refus(560_000.01)).not.toBeNull();
  });

  it('sans salaire au mois du contrat, ou sans congé dans le mois, rien n’est opposé', () => {
    expect(motifRefusSalairePleinPendantLeConge({ mois: '2026-08', conges, salaireDuBulletin: 2_000_000, salaireMensuel: null, devise: 'CDF' })).toBeNull();
    expect(motifRefusSalairePleinPendantLeConge({ mois: '2026-08', conges: [], salaireDuBulletin: 2_000_000, salaireMensuel: 1_040_000, devise: 'CDF' })).toBeNull();
  });

  it('à cheval avec voyage, seul le certain s’oppose · cinq jours au moins en août', () => {
    const incertains = congesDuMois([conge({ du: '2026-08-24', au: '2026-09-05', joursVoyage: 2 })], '2026-08', SANS_MALADIE);
    const plafond = (1_040_000 * 21) / 26;
    expect(motifRefusSalairePleinPendantLeConge({ mois: '2026-08', conges: incertains, salaireDuBulletin: plafond, salaireMensuel: 1_040_000, devise: 'CDF' })).toBeNull();
    expect(motifRefusSalairePleinPendantLeConge({ mois: '2026-08', conges: incertains, salaireDuBulletin: 1_040_000, salaireMensuel: 1_040_000, devise: 'CDF' })).not.toBeNull();
  });
});

describe('l’émission du bulletin refuse avant toute simulation', () => {
  it('bulletin d’août à 1 040 000 + allocation de douze jours · « Bulletin non émis », art. 142', async () => {
    const ligneConge = {
      id: 'c-1',
      tenantId: 't',
      salarieId: 's-1',
      du: new Date('2026-08-03T00:00:00Z'),
      au: new Date('2026-08-15T00:00:00Z'),
      joursVoyage: 0,
      moisDePaie: '2026-08',
      deviseAllocation: 'CDF',
      remunerationJournaliere: new Prisma.Decimal(40_000),
      moyenneMensuelleArticle142: new Prisma.Decimal(0),
      annuleLe: null,
      bulletin: null,
    };
    const prisma = {
      salarie: {
        findFirst: jest.fn().mockResolvedValue({
          id: 's-1',
          nom: 'KABONGO',
          postNom: null,
          prenoms: 'Jean',
          matricule: null,
          numeroAffiliationCnss: null,
          contrats: [
            {
              id: 'k-1',
              dateEntreeEnVigueur: new Date('2025-06-01T00:00:00Z'),
              dateFin: null,
              natureTravail: null,
              categorieProfessionnelle: null,
              remunerationBase: new Prisma.Decimal(1_040_000),
              periodiciteRemuneration: 'MOIS',
              deviseRemuneration: 'CDF',
            },
          ],
        }),
      },
      congeSalarie: { findMany: jest.fn().mockResolvedValue([ligneConge]) },
      rubriquePaie: { findMany: jest.fn().mockResolvedValue([]) },
      absenceSalarie: { findMany: jest.fn().mockResolvedValue([]) },
      contratTravail: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const svc = new PersonnelService(prisma);
    const simuler = jest.spyOn(svc, 'simulerPaie');
    const dto = {
      moisDePaie: '2026-08',
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_040_000 }],
      allocationsConge: [{ congeId: 'c-1' }],
    } as SimulationPaieDto;
    const echec = svc.emettreBulletin('t', 'u', 's-1', dto);
    await expect(echec).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.emettreBulletin('t', 'u', 's-1', dto)).rejects.toThrow(/Bulletin non émis · .*art\. 142/);
    expect(simuler).not.toHaveBeenCalled();
  });
});
