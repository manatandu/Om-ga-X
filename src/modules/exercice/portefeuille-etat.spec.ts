import { BadRequestException } from '@nestjs/common';
import { Referentiel } from '@prisma/client';
import { appliquerPortefeuilleEtat, JalonServi } from './portefeuille-etat';
import { ExerciceService } from './exercice.service';
import { ExerciceController } from './exercice.controller';
import { REFERENTIELS_KEY } from '../../common/decorators/referentiels.decorator';

/**
 * ENTREPRISE DU PORTEFEUILLE DE L'ÉTAT · O.-L. n° 13/003, art. 112 et 113
 * (décision par la loi du 2026-10-04, point 1).
 */
const jalon = (etape: number, echeance: string): JalonServi => ({
  etape,
  libelle: `Jalon ${etape}`,
  detail: 'Détail.',
  nature: 'LEGALE',
  source: 'Source',
  sanction: null,
  debut: null,
  echeance: new Date(echeance),
  enRetard: false,
});
const iso = (d: Date | null) => (d === null ? null : d.toISOString().slice(0, 10));
const BASE = [jalon(17, '2027-05-15'), jalon(21, '2027-06-30'), jalon(24, '2027-07-31'), jalon(26, '2027-08-31')];
const AUJOURDHUI = new Date(Date.UTC(2027, 0, 10));

describe('Entreprise du portefeuille de l’État · O.-L. n° 13/003', () => {
  it('exercice clos au 31 décembre · assemblée au 31 mars (et non six mois), 45 jours avant · 14 février', () => {
    const r = appliquerPortefeuilleEtat(
      BASE,
      { dateFin: new Date(Date.UTC(2026, 11, 31)), dateAssembleeGenerale: null, dateDepotEtatsPortefeuille: null },
      AUJOURDHUI,
    );
    expect(iso(r.find((j) => j.etape === 21)!.echeance)).toBe('2027-03-31');
    expect(r.find((j) => j.etape === 21)!.source).toContain('art. 112');
    expect(iso(r.find((j) => j.etape === 17)!.echeance)).toBe('2027-02-14');
    // Les deux délais qui courent d'une date DÉCLARÉE ne sont pas calculés sans elle.
    const pv = r.find((j) => j.libelle.startsWith('Procès-verbal'))!;
    expect(pv.echeance).toBeNull();
    expect(pv.detail).toContain('déclarez la date de l’assemblée');
    const aff = r.find((j) => j.libelle.startsWith('Affectation des résultats'))!;
    expect(aff.echeance).toBeNull();
    // Le dépôt au RCCM n'est pas touché.
    expect(iso(r.find((j) => j.etape === 24)!.echeance)).toBe('2027-07-31');
  });

  it('année bissextile · 15 février ; dix jours calendaires de l’assemblée, soixante du dépôt', () => {
    const r = appliquerPortefeuilleEtat(
      BASE,
      {
        dateFin: new Date(Date.UTC(2027, 11, 31)),
        dateAssembleeGenerale: null,
        dateDepotEtatsPortefeuille: new Date(Date.UTC(2028, 2, 1)),
      },
      AUJOURDHUI,
    );
    expect(iso(r.find((j) => j.etape === 17)!.echeance)).toBe('2028-02-15');
    expect(iso(r.find((j) => j.libelle.startsWith('Affectation des résultats'))!.echeance)).toBe('2028-04-30');

    const avecAg = appliquerPortefeuilleEtat(
      BASE,
      {
        dateFin: new Date(Date.UTC(2026, 11, 31)),
        // Samedi 20 mars 2027 · dix jours calendaires, aucun report (le délai n'est pas fiscal).
        dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
        dateDepotEtatsPortefeuille: null,
      },
      new Date(Date.UTC(2027, 3, 1)),
    );
    const pv = avecAg.find((j) => j.libelle.startsWith('Procès-verbal'))!;
    expect(iso(pv.echeance)).toBe('2027-03-30');
    expect(pv.enRetard).toBe(true);
    // Les quarante-cinq jours se comptent alors depuis l'assemblée déclarée.
    expect(iso(avecAg.find((j) => j.etape === 17)!.echeance)).toBe('2027-02-03');
  });

  it('autre clôture · rien n’est calculé, et le jalon le dit ; les six mois restent', () => {
    const r = appliquerPortefeuilleEtat(
      BASE,
      { dateFin: new Date(Date.UTC(2027, 5, 30)), dateAssembleeGenerale: null, dateDepotEtatsPortefeuille: null },
      AUJOURDHUI,
    );
    expect(iso(r.find((j) => j.etape === 21)!.echeance)).toBe('2027-06-30');
    const dit = r.find((j) => j.libelle.startsWith('Assemblée générale · entreprise du portefeuille'))!;
    expect(dit.echeance).toBeNull();
    expect(dit.detail).toContain('Aucune échéance n’est calculée');
  });

  it('exercice clos avant le 27 février 2013 (art. 115) · planning inchangé', () => {
    const r = appliquerPortefeuilleEtat(
      BASE,
      { dateFin: new Date(Date.UTC(2012, 11, 31)), dateAssembleeGenerale: null, dateDepotEtatsPortefeuille: null },
      AUJOURDHUI,
    );
    expect(r).toBe(BASE);
  });

  it('la route des dates est cloisonnée au SYSCOHADA, et une date avant la clôture est refusée', async () => {
    expect(Reflect.getMetadata(REFERENTIELS_KEY, ExerciceController.prototype.declarerDatesPortefeuille)).toEqual([
      Referentiel.SYSCOHADA,
    ]);
    const prisma = {
      exercice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'e1', tenantId: 't1', dateFin: new Date(Date.UTC(2026, 11, 31)) }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const s = new ExerciceService(prisma as never, {} as never);
    await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2026-12-15' })).rejects.toThrow(
      BadRequestException,
    );
    await s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2027-03-20', dateDepotEtatsPortefeuille: null });
    expect(prisma.exercice.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { dateAssembleeGenerale: new Date('2027-03-20'), dateDepotEtatsPortefeuille: null },
    });
  });

  it('le planning ne l’applique que sur « oui » déclaré, au SYSCOHADA', async () => {
    const exercice = {
      id: 'e1',
      tenantId: 't1',
      dateDebut: new Date(Date.UTC(2026, 0, 1)),
      dateFin: new Date(Date.UTC(2026, 11, 31)),
      statut: 'OUVERT',
      dateAssembleeGenerale: null,
      dateDepotEtatsPortefeuille: null,
    };
    const planning = async (referentiel: Referentiel, entreprisePortefeuilleEtat: boolean | null) => {
      const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
        tenant: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            referentiel,
            formeJuridique: 'ASSOCIATION',
            formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
            droitEtranger: false,
            associeUniqueSas: null,
            entreprisePortefeuilleEtat,
          }),
        },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
        rapportActivite: { count: jest.fn().mockResolvedValue(0) },
        donation: { findMany: jest.fn().mockResolvedValue([]) },
      };
      return new ExerciceService(prisma as never, {} as never).planningCloture('t1', 'e1');
    };
    const pv = (p: { jalons: Array<{ libelle: string }> }) =>
      p.jalons.some((j) => j.libelle.startsWith('Procès-verbal à l’Administration des recettes non fiscales'));
    expect(pv(await planning(Referentiel.SYSCOHADA, true))).toBe(true);
    expect(pv(await planning(Referentiel.SYSCOHADA, null))).toBe(false);
    expect(pv(await planning(Referentiel.SYSCOHADA, false))).toBe(false);
    expect(pv(await planning(Referentiel.SYCEBNL, true))).toBe(false);
  });
});
