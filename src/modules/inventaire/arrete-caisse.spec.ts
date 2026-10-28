import { Prisma } from '@prisma/client';
import { comparaisonAuPlafond, especesDesCoupures, heureValide, mentionsDeLArrete, plafondEnVigueur } from './arrete-caisse';
import { ArretesCaisseService } from './arretes-caisse.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * ARRÊTÉ DE CAISSE PAR COUPURES (ligne microfina-m2, idée 5) · fiche du compte
 * 57 des deux plans. Ce qui casserait en silence · des espèces qui ne sont pas
 * la somme de leurs coupures, un plafond comparé dans une autre monnaie, un
 * plafond qui refuserait au lieu d'avertir.
 */
describe("l'arrêté de caisse · règles pures", () => {
  it('les coupures FONT les espèces, au centime entier', () => {
    expect(especesDesCoupures([{ valeurUnitaire: 5000, nombre: 3 }, { valeurUnitaire: 500, nombre: 7 }, { valeurUnitaire: 0.5, nombre: 3 }])).toEqual({ centimes: 1_850_150 });
    expect(especesDesCoupures([])).toEqual({ centimes: 0 });
  });

  it('refuse une valeur nulle, hors centime, un nombre fractionnaire et une valeur saisie deux fois', () => {
    expect(especesDesCoupures([{ valeurUnitaire: 0, nombre: 1 }])).toEqual({ motif: expect.stringMatching(/valeur faciale/) });
    expect(especesDesCoupures([{ valeurUnitaire: 0.005, nombre: 1 }])).toEqual({ motif: expect.stringMatching(/au centime/) });
    expect(especesDesCoupures([{ valeurUnitaire: 100, nombre: 1.5 }])).toEqual({ motif: expect.stringMatching(/entier/) });
    expect(especesDesCoupures([{ valeurUnitaire: 500, nombre: 1 }, { valeurUnitaire: 500, nombre: 2 }])).toEqual({ motif: expect.stringMatching(/deux fois/) });
  });

  it('le plafond en vigueur est la dernière version au plus tard le jour', () => {
    const v = [
      { dateEffet: '2026-01-01', montantCentimes: 100, deviseId: null },
      { dateEffet: '2026-06-01', montantCentimes: 200, deviseId: null },
    ];
    expect(plafondEnVigueur(v, '2025-12-31')).toBeNull();
    expect(plafondEnVigueur(v, '2026-05-31')?.montantCentimes).toBe(100);
    expect(plafondEnVigueur(v, '2026-06-01')?.montantCentimes).toBe(200);
  });

  it("le plafond se compare dans SON unité · jamais un dollar contre des francs, et c'est dit", () => {
    const fc = { dateEffet: '2026-01-01', montantCentimes: 50_000_000, deviseId: null };
    expect(comparaisonAuPlafond(60_000_000, null, fc)).toEqual({ plafondCentimes: 50_000_000, depasse: true, nonCompare: null });
    expect(comparaisonAuPlafond(50_000_000, null, fc).depasse).toBe(false);
    expect(comparaisonAuPlafond(60_000_000, 'usd', fc)).toEqual({ plafondCentimes: null, depasse: null, nonCompare: expect.stringMatching(/autre unité/) });
    expect(comparaisonAuPlafond(1, null, null)).toEqual({ plafondCentimes: null, depasse: null, nonCompare: null });
  });

  it("les mentions disent l'écart, la caisse créditrice, le brouillard et le plafond · aucune n'est un refus", () => {
    const m = mentionsDeLArrete({ soldeCentimes: -10_000, especesCentimes: 0, ecrituresAuBrouillard: 2, depassePlafond: false, plafondCentimes: 1, nonCompare: null });
    expect(m.join(' ')).toMatch(/Excédent de caisse de 100,00/);
    expect(m.join(' ')).toMatch(/présomption d’irrégularité/);
    expect(m.join(' ')).toMatch(/2 écriture\(s\) au brouillard/);
    const p = mentionsDeLArrete({ soldeCentimes: 100, especesCentimes: 100, ecrituresAuBrouillard: 0, depassePlafond: true, plafondCentimes: 50, nonCompare: null });
    expect(p).toEqual([expect.stringMatching(/Le solde de la caisse dépasse le plafond d'encaisse .* un avertissement, aucun texte n'en fixe/)]);
    expect(mentionsDeLArrete({ soldeCentimes: 100, especesCentimes: 100, ecrituresAuBrouillard: 0, depassePlafond: null, plafondCentimes: null, nonCompare: null })).toEqual([]);
  });

  it("l'heure se donne HH:MM", () => {
    expect(heureValide('08:30')).toBe('08:30');
    expect(heureValide('24:00')).toBeNull();
    expect(heureValide(undefined)).toBeNull();
  });
});

describe("relecture · l'arrêté de caisse", () => {
  function faux(table: Record<string, unknown>) {
    const prisma: Record<string, unknown> = { $executeRaw: jest.fn().mockResolvedValue(1), ...table };
    prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
    return new ArretesCaisseService(prisma as unknown as PrismaService);
  }

  it("m4 · le brouillard d'un exercice antérieur que le solde remonte se dit", () => {
    const m = mentionsDeLArrete({ soldeCentimes: 100, especesCentimes: 100, ecrituresAuBrouillard: 3, brouillardExercicesAnterieurs: 2, depassePlafond: null, plafondCentimes: null, nonCompare: null });
    expect(m.join(' ')).toMatch(/Dont 2 d'un exercice antérieur non clôturé/);
  });

  it("m5 · la liste relit le dépassement sur le SOLDE, comme l'aperçu et l'arrêté", async () => {
    const service = faux({
      arreteCaisse: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1', compte: { numero: '57110000', intitule: 'Caisse' }, devise: null, jour: new Date('2026-03-02'), heure: null,
            soldeTheorique: new Prisma.Decimal(600), ecrituresAuBrouillard: 0, brouillardExercicesAnterieurs: 0,
            especesComptees: new Prisma.Decimal(400), ecart: new Prisma.Decimal(-200), plafondFige: new Prisma.Decimal(500), plafondNonCompare: null,
            caissier: 'K', controlePar: null, observations: null, etabliLe: new Date(), annuleLe: null, motifAnnulation: null, coupures: [],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    });
    const r = await service.lister('t1');
    expect(r.arretes[0].mentions.join(' ')).toMatch(/Le solde de la caisse dépasse le plafond/);
  });

  it("m6 · l'annulation est refusée dans un exercice clôturé, et prise sous le verrou de la caisse", async () => {
    const update = jest.fn();
    const executeRaw = jest.fn().mockResolvedValue(1);
    const service = faux({
      $executeRaw: executeRaw,
      arreteCaisse: {
        findFirst: jest.fn().mockResolvedValueOnce({ compteId: 'k57' }).mockResolvedValueOnce({ id: 'a1', annuleLe: null, exercice: { statut: 'CLOTURE' } }),
        update,
      },
    });
    await expect(service.annuler('t1', 'u1', 'a1', { motif: 'Compté de travers' })).rejects.toThrow(/clôturé/);
    expect(executeRaw).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('m7 · un plafond en double rend un 409 nommé, même quand la clé unique tranche la course', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
    const service = faux({
      compte: { findFirst: jest.fn().mockResolvedValue({ id: 'k57', numero: '57110000', intitule: 'Caisse', typeCompte: 'DETAIL' }) },
      plafondEncaisse: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockRejectedValue(p2002) },
    });
    await expect(service.creerPlafond('t1', 'u1', { compteId: 'k57', dateEffet: '2026-01-01', montant: 500_000, motif: 'Décision du bureau' })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/déjà un plafond à cette date/),
    });
  });

  it('m7 · un plafond retiré deux fois rend un 409, jamais un 500', async () => {
    const service = faux({
      plafondEncaisse: { findFirst: jest.fn().mockResolvedValueOnce({ compteId: 'k57' }).mockResolvedValueOnce(null), delete: jest.fn() },
    });
    await expect(service.retirerPlafond('t1', 'p1')).rejects.toMatchObject({ status: 409 });
  });

  it("m1 · un jour qui n'existe pas est refusé en 400, jamais en 500", async () => {
    const service = faux({});
    await expect(service.apercu('t1', 'k57', '2026-13-45')).rejects.toThrow(/AAAA-MM-JJ/);
    await expect(service.situation('t1', '2026-02-31')).rejects.toThrow(/AAAA-MM-JJ/);
  });
});
