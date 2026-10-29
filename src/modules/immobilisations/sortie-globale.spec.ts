import { BadRequestException, ConflictException } from '@nestjs/common';
import { ImmobilisationService } from './immobilisation.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { messageRefusDuLot, motifRefusLot } from './sortie-globale';
import { TypeSortie } from './dto/immobilisation.dto';

/**
 * LA SORTIE GLOBALE (ligne immos, fonction n° 69). Ce qui casserait en
 * silence · un lot à moitié sorti (trois biens sortis, le quatrième refusé,
 * et le procès-verbal de mise au rebut ne correspond plus au registre) ; un
 * bien qui sortirait deux fois ; un prix de cession absent lu comme zéro.
 */

describe('les règles du lot', () => {
  it('deux biens au moins, deux cents au plus, aucun en double', () => {
    expect(motifRefusLot(['a'], 'MISE_HORS_SERVICE', [undefined])).toMatch(/au moins deux/);
    expect(motifRefusLot(['a', 'a'], 'MISE_HORS_SERVICE', [undefined, undefined])).toMatch(/deux fois/);
    expect(motifRefusLot(Array.from({ length: 201 }, (_, i) => `b${i}`), 'MISE_HORS_SERVICE', [])).toMatch(/au plus 200/);
    expect(motifRefusLot(['a', 'b'], 'MISE_HORS_SERVICE', [undefined, undefined])).toBeNull();
  });

  it('une cession porte le prix de chaque bien ; une mise hors service n’en porte aucun', () => {
    expect(motifRefusLot(['a', 'b'], 'CESSION', [100, undefined])).toMatch(/1 bien\(s\) du lot sans prix/);
    expect(motifRefusLot(['a', 'b'], 'CESSION', [100, 0])).toBeNull();
    expect(motifRefusLot(['a', 'b'], 'MISE_HORS_SERVICE', [100, undefined])).toMatch(/ne porte pas de prix/);
  });

  it('les refus se nomment ensemble, vingt au plus, le total dit', () => {
    const refus = Array.from({ length: 22 }, (_, i) => ({ designation: `Bien ${i}`, motif: 'déjà sorti' }));
    const m = messageRefusDuLot(refus, 30);
    expect(m).toMatch(/^Aucun bien n’est sorti · 22 des 30 biens du lot sont refusés \(et 2 autre\(s\)\)/);
    expect(m).toContain('« Bien 19 »');
    expect(m).not.toContain('« Bien 20 »');
  });
});

function service() {
  const prisma = {
    immobilisation: { findFirst: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve({ designation: `Bien ${where.id}` })) },
    ligneReevaluationBilan: { update: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;
  const svc = new ImmobilisationService(prisma, {} as EcritureService);
  return { svc, prisma };
}

const DTO = {
  type: TypeSortie.MISE_HORS_SERVICE,
  dateSortie: '2026-06-30',
  exerciceId: 'ex',
  journalId: 'j',
  natureSortie: 'MISE_AU_REBUT' as const,
  referencePieceSortie: ' PV-12 ',
  datePieceSortie: '2026-06-30',
  biens: [{ immobilisationId: 'a' }, { immobilisationId: 'b' }, { immobilisationId: 'c' }],
};

const simulee = (id: string, complement = 0, passes: unknown[] = []) => ({
  simulee: true as const,
  id,
  designation: `Bien ${id}`,
  cumulAvantComplement: 0,
  montantComplement: complement,
  cumulDepreciation: 0,
  valeurComptableNette: 100,
  repriseDepreciation: null,
  passesEcart: passes,
});

describe('la sortie globale, tout ou rien', () => {
  it('chaque bien est jugé avant le premier geste · un refus arrête le lot, les refus nommés ensemble, rien n’est sorti', async () => {
    const { svc } = service();
    jest.spyOn(svc, 'simulerSortie').mockImplementation(async (_t, id) => {
      if (id === 'a') return simulee('a') as never;
      throw new BadRequestException(id === 'b' ? 'Cette immobilisation est déjà sortie' : 'La date de sortie doit se situer dans l’exercice indiqué');
    });
    const sortir = jest.spyOn(svc, 'sortir');
    await expect(svc.sortirPlusieurs('t', 'u', DTO as never)).rejects.toThrow(/2 des 3 biens du lot sont refusés.*« Bien b » · Cette immobilisation est déjà sortie.*« Bien c »/);
    expect(sortir).not.toHaveBeenCalled();
  });

  it('une sortie qui tombe en route défait celles qui l’ont précédée, écritures, complément et écart compris', async () => {
    const { svc, prisma } = service();
    jest.spyOn(svc, 'simulerSortie').mockImplementation(async (_t, id) =>
      simulee(id, id === 'a' ? 50 : 0, id === 'a' ? [{ ligneId: 'l1', traitement: 'RESERVE', montant: 10 }] : []) as never,
    );
    jest.spyOn(svc, 'sortir').mockImplementation(async (_t, _u, id) => {
      if (id === 'c') throw new ConflictException('Cette immobilisation vient déjà d’être sortie par une autre opération');
      return {
        id,
        designation: `Bien ${id}`,
        ecritureSortieId: `s-${id}`,
        ecritureProduitCessionId: null,
        ecritureSortieEcartReevaluationId: id === 'a' ? 'ecart-a' : null,
        dotations: id === 'a' ? [{ id: 'dot-a', exerciceId: 'ex', ecritureId: 'comp-a' }] : [],
      } as never;
    });
    const defaire = jest.spyOn(svc as unknown as { defaireSortie: (...a: unknown[]) => Promise<void> }, 'defaireSortie').mockResolvedValue();
    await expect(svc.sortirPlusieurs('t', 'u', DTO as never)).rejects.toBeInstanceOf(ConflictException);
    // Dans l'ordre inverse · b, puis a, avec le complément, la sortie et l'écart de a.
    expect(defaire.mock.calls.map((c) => [c[1], c[3], c[4]])).toEqual([
      ['b', ['s-b'], null],
      ['a', ['comp-a', 's-a', 'ecart-a'], 'dot-a'],
    ]);
    expect((prisma.ligneReevaluationBilan.update as jest.Mock).mock.calls[0][0]).toEqual({ where: { id: 'l1' }, data: { ecartTransfere: { decrement: 10 } } });
  });

  it('chaque bien sort sous la pièce commune, une écriture par bien', async () => {
    const { svc } = service();
    jest.spyOn(svc, 'simulerSortie').mockImplementation(async (_t, id) => simulee(id) as never);
    const sortir = jest
      .spyOn(svc, 'sortir')
      .mockImplementation(async (_t, _u, id) => ({ id, designation: `Bien ${id}`, ecritureSortieId: `s-${id}`, dotations: [] }) as never);
    const r = await svc.sortirPlusieurs('t', 'u', DTO as never);
    expect(r).toMatchObject({ nombre: 3, reference: 'PV-12' });
    expect(sortir.mock.calls.map((c) => [c[2], c[3].referencePieceSortie, c[3].prixCession])).toEqual([
      ['a', ' PV-12 ', undefined],
      ['b', ' PV-12 ', undefined],
      ['c', ' PV-12 ', undefined],
    ]);
  });
});
