import { BadRequestException } from '@nestjs/common';
import { MaintenanceImmobilisationsService } from './maintenance-immobilisations.service';

/**
 * LE CÂBLAGE DE LA RENUMÉROTATION ET DE LA MAINTENANCE (ligne sage-l4,
 * fonction n° 73). Ce que le service FAIT · le plan rejoué sous le verrou du
 * dossier, une mise à jour unitaire par fiche (journal d'audit), rien
 * d'écrit sur un refus ; le registre relu sur le tableau des amortissements,
 * la dotation pas encore passée jamais lue comme un écart.
 */

const jour = (s: string) => new Date(`${s}T00:00:00Z`);
const P = { prefixe: 'IMM-', premierNumero: 1, largeur: 4, ordre: 'ACQUISITION' as const, perimetre: 'EN_SERVICE' as const };

function fabrique(options: { fiches?: unknown[]; tableau?: unknown; balance?: unknown[]; sansFiche?: unknown[]; comptes?: unknown[] } = {}) {
  const fiches = options.fiches ?? [
    {
      id: 'a',
      designation: 'Camion',
      numeroInventaire: null,
      dateAcquisition: jour('2026-03-01'),
      createdAt: jour('2026-03-01'),
      statut: 'EN_SERVICE',
      compteImmobilisation: { numero: '24510000' },
      compteAmortissement: { numero: '28450000', intitule: 'Amortissements du matériel de transport' },
      reclassements: [],
    },
    {
      id: 'b',
      designation: 'Ordinateur',
      numeroInventaire: 'IMM-0001',
      dateAcquisition: jour('2026-01-10'),
      createdAt: jour('2026-01-10'),
      statut: 'EN_SERVICE',
      compteImmobilisation: { numero: '24410000' },
      compteAmortissement: { numero: '28440000', intitule: 'Amortissements du matériel de bureau' },
      reclassements: [],
    },
  ];
  const ordre: string[] = [];
  const prisma: Record<string, any> = {
    immobilisation: {
      findMany: jest.fn().mockResolvedValue(fiches),
      update: jest.fn(async () => {
        ordre.push('update');
        return {};
      }),
    },
    exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex-n', dateDebut: jour('2026-01-01'), dateFin: jour('2026-12-31') }) },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    ligneEcriture: { groupBy: jest.fn().mockResolvedValue(options.sansFiche ?? []) },
    compte: { findMany: jest.fn().mockResolvedValue(options.comptes ?? []) },
    $executeRaw: jest.fn(async () => {
      ordre.push('verrou');
      return 1;
    }),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const immobilisations = {
    tableauAmortissements: jest.fn().mockResolvedValue(
      options.tableau ?? {
        groupes: [
          {
            numero: '24510000',
            intitule: 'Matériel automobile',
            lignes: [{ id: 'a', designation: 'Camion', valeurBrute: 12_000_000, dotation: 2_250_000, cumulN: 2_250_000, dotationPassee: false, sortiLe: null }],
          },
          {
            numero: '24410000',
            intitule: 'Matériel de bureau',
            lignes: [{ id: 'b', designation: 'Ordinateur', valeurBrute: 3_000_000, dotation: 1_000_000, cumulN: 1_000_000, dotationPassee: true, sortiLe: null }],
          },
        ],
      },
    ),
  };
  const ecritures = {
    balance: jest.fn().mockResolvedValue({
      lignes: options.balance ?? [
        { numero: '24510000', intitule: 'Matériel automobile', solde: 12_800_000 },
        { numero: '24410000', intitule: 'Matériel de bureau', solde: 3_000_000 },
        { numero: '28440000', intitule: 'Amortissements du matériel de bureau', solde: -1_000_000 },
        { numero: '52110000', intitule: 'Banque', solde: -15_800_000 },
      ],
    }),
  };
  const service = new MaintenanceImmobilisationsService(prisma as never, immobilisations as never, ecritures as never);
  return { service, prisma, ordre, immobilisations, ecritures };
}

describe('la renumérotation', () => {
  it('l’aperçu ne touche rien et dit ce qui changerait', async () => {
    const { service, prisma } = fabrique();
    const r = await service.apercuRenumerotation('t-1', P);
    expect(r).toMatchObject({ nombre: 2, aChanger: 1, motifRefus: null, tronque: false });
    // L'ordinateur, acquis le premier, garde IMM-0001 · seul le camion change.
    expect(r.attributions).toEqual([{ id: 'a', designation: 'Camion', ancien: null, nouveau: 'IMM-0002' }]);
    expect(prisma.immobilisation.update).not.toHaveBeenCalled();
    expect(prisma.immobilisation.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't-1' });
  });

  it('rejoue le plan sous le verrou du dossier, puis une mise à jour unitaire par fiche', async () => {
    const { service, prisma, ordre } = fabrique();
    await expect(service.renumeroter('t-1', P)).resolves.toEqual({ renumerotes: 1, inchanges: 1 });
    expect(ordre).toEqual(['verrou', 'update']);
    expect(prisma.immobilisation.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { numeroInventaire: 'IMM-0002' } });
  });

  it('un refus n’écrit rien · collision avec un bien sorti', async () => {
    const { service, prisma } = fabrique({
      fiches: [
        { id: 'a', designation: 'Camion', numeroInventaire: null, dateAcquisition: jour('2026-03-01'), createdAt: jour('2026-03-01'), statut: 'EN_SERVICE', compteImmobilisation: { numero: '24510000' } },
        { id: 's', designation: 'Vieux camion', numeroInventaire: 'IMM-0001', dateAcquisition: jour('2020-01-01'), createdAt: jour('2020-01-01'), statut: 'CEDE', compteImmobilisation: { numero: '24510000' } },
      ],
    });
    await expect(service.renumeroter('t-1', P)).rejects.toThrow(/« Vieux camion »/);
    expect(prisma.immobilisation.update).not.toHaveBeenCalled();
  });

  it('des paramètres illisibles sont refusés avant toute lecture', async () => {
    const { service, prisma } = fabrique();
    await expect(service.renumeroter('t-1', { ...P, prefixe: 'é' })).rejects.toThrow(BadRequestException);
    expect(prisma.immobilisation.findMany).not.toHaveBeenCalled();
  });
});

describe('la maintenance', () => {
  it('rapproche le registre de la balance, la dotation non passée dite à part, les lignes sans fiche nommées', async () => {
    const { service } = fabrique({
      sansFiche: [{ compteId: 'c-2451', _count: { _all: 1 }, _sum: { debit: 800_000 } }],
      comptes: [{ id: 'c-2451', numero: '24510000' }],
    });
    const r = await service.maintenance('t-1', 'ex-n');
    expect(r.comptesBien).toEqual([
      { numero: '24410000', intitule: 'Matériel de bureau', registre: 3_000_000, balance: 3_000_000, ecart: 0, lignesSansFiche: { nombre: 0, montant: 0 } },
      { numero: '24510000', intitule: 'Matériel automobile', registre: 12_000_000, balance: 12_800_000, ecart: 800_000, lignesSansFiche: { nombre: 1, montant: 800_000 } },
    ]);
    // La dotation du camion n'est pas passée · elle n'est ni au registre ni à
    // la balance, et se dit à part, jamais comme un écart.
    expect(r.comptesAmortissement).toEqual([{ numero: '28440000', intitule: 'Amortissements du matériel de bureau', registre: 1_000_000, balance: 1_000_000, ecart: 0 }]);
    expect(r.dotationsAPasser).toEqual({ nombre: 1, montant: 2_250_000 });
    expect(r.biensEnServiceSansNumero).toBe(1);
  });

  it('un bien sorti dans l’exercice a quitté ses comptes · il n’entre pas au registre', async () => {
    const { service } = fabrique({
      tableau: {
        groupes: [
          {
            numero: '24510000',
            intitule: 'Matériel automobile',
            lignes: [{ id: 'a', designation: 'Camion', valeurBrute: 12_000_000, dotation: 0, cumulN: 0, dotationPassee: true, sortiLe: '2026-06-30' }],
          },
        ],
      },
      balance: [],
    });
    const r = await service.maintenance('t-1', 'ex-n');
    expect(r.comptesBien).toEqual([]);
  });

  it('nomme les numéros en double et le bien reclassé après la clôture', async () => {
    const commun = { dateAcquisition: jour('2026-01-01'), createdAt: jour('2026-01-01'), statut: 'EN_SERVICE', compteImmobilisation: { numero: '24510000' } };
    const amort = { compteAmortissement: { numero: '28450000', intitule: 'x' } };
    const { service } = fabrique({
      fiches: [
        { id: 'a', designation: 'Camion', numeroInventaire: 'V-01', ...commun, ...amort, reclassements: [{ dateReclassement: jour('2027-02-01'), ancienCompteImmobilisation: { numero: '24520000' } }] },
        { id: 'b', designation: 'Moto', numeroInventaire: 'V-01', ...commun, ...amort, reclassements: [] },
      ],
    });
    const r = await service.maintenance('t-1', 'ex-n');
    expect(r.numerosEnDouble).toEqual([{ numero: 'V-01', fiches: [{ id: 'a', designation: 'Camion' }, { id: 'b', designation: 'Moto' }] }]);
    expect(r.reclassesApresLaCloture).toEqual([{ designation: 'Camion', date: '2027-02-01', ancienCompte: '24520000', compteActuel: '24510000' }]);
  });
});
