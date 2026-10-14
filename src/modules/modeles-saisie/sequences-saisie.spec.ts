import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MOTIF_DIX_SEQUENCES, motifRefusIntituleSequence, premierRangLibre } from './sequences-saisie';
import { SequencesSaisieService } from './sequences-saisie.service';
import { ModeleSaisieService } from './modele-saisie.service';

/**
 * LES SÉQUENCES DE SAISIE (ligne sage-l1, fonction 19 · Sage, P_SEQUENCE) ·
 * dix au plus par dossier, un intitulé de 35 caractères au plus, le premier
 * rang libre ; une séquence qui range des modèles ne se retire pas.
 */
describe('séquences de saisie · les règles', () => {
  it('le premier rang libre de 1 à 10, et aucun au-delà de dix', () => {
    expect(premierRangLibre([])).toBe(1);
    expect(premierRangLibre([1, 2, 4])).toBe(3);
    expect(premierRangLibre([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeNull();
  });

  it('un intitulé non vide de 35 caractères au plus', () => {
    expect(motifRefusIntituleSequence('Achats')).toBeNull();
    expect(motifRefusIntituleSequence('   ')).toMatch(/obligatoire/);
    expect(motifRefusIntituleSequence('x'.repeat(35))).toBeNull();
    expect(motifRefusIntituleSequence('x'.repeat(36))).toMatch(/35 caractères au plus \(36 tapés\)/);
  });
});

describe('séquences de saisie · le service', () => {
  function monde(existantes: { id: string; numero: number; intitule: string }[] = [], modelesRanges = 0) {
    const sequences = [...existantes];
    const create = jest.fn(async ({ data }: { data: { numero: number; intitule: string } }) => {
      if (sequences.some((s) => s.intitule === data.intitule)) {
        throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
      }
      const s = { id: `s${data.numero}`, numero: data.numero, intitule: data.intitule };
      sequences.push(s);
      return s;
    });
    const tx = {
      $executeRaw: jest.fn(async () => 1),
      sequenceSaisie: { findMany: jest.fn(async () => sequences.map((s) => ({ numero: s.numero }))), create },
    };
    const p = {
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      sequenceSaisie: {
        findMany: jest.fn(async () => [...sequences].sort((a, b) => a.numero - b.numero)),
        findFirst: jest.fn(async ({ where }: { where: { id: string } }) => sequences.find((s) => s.id === where.id) ?? null),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: { intitule: string } }) => ({ ...sequences.find((s) => s.id === where.id), ...data })),
        delete: jest.fn(async () => ({})),
      },
      modeleSaisie: {
        groupBy: jest.fn(async () => (modelesRanges ? [{ sequenceSaisieId: existantes[0]?.id, _count: { _all: modelesRanges } }] : [])),
        count: jest.fn(async () => modelesRanges),
      },
    };
    return { svc: new SequencesSaisieService(p as never), p, tx, create };
  }

  it('crée au premier rang libre, sous le verrou du dossier, l’intitulé nettoyé', async () => {
    const { svc, tx } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }]);
    expect(await svc.creer('t1', 'u1', '  Ventes ')).toEqual({ id: 's2', numero: 2, intitule: 'Ventes' });
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('refuse une onzième séquence, un intitulé vide et un intitulé déjà pris, en le disant', async () => {
    const dix = Array.from({ length: 10 }, (_, i) => ({ id: `s${i + 1}`, numero: i + 1, intitule: `S${i + 1}` }));
    await expect(monde(dix).svc.creer('t1', 'u1', 'Onze')).rejects.toThrow(MOTIF_DIX_SEQUENCES);
    await expect(monde().svc.creer('t1', 'u1', ' ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(monde([{ id: 's1', numero: 1, intitule: 'Achats' }]).svc.creer('t1', 'u1', 'Achats')).rejects.toBeInstanceOf(ConflictException);
  });

  it('liste par rang avec le nombre de modèles rangés', async () => {
    const { svc } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }], 3);
    expect(await svc.lister('t1')).toEqual([{ id: 's1', numero: 1, intitule: 'Achats', nombreModeles: 3 }]);
  });

  it('ne retire pas une séquence qui range des modèles · le refus les compte', async () => {
    const { svc, p } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }], 2);
    await expect(svc.supprimer('t1', 's1')).rejects.toThrow(/« Achats » range 2 modèle\(s\) de saisie/);
    expect(p.sequenceSaisie.delete).not.toHaveBeenCalled();
    await expect(monde().svc.supprimer('t1', 'inconnue')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un modèle rangé entre le compte et la suppression · 409 nommé, jamais une erreur 500 (relecture m4)', async () => {
    const { svc, p } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }]);
    p.sequenceSaisie.delete.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('clé étrangère', { code: 'P2003', clientVersion: 'x' }),
    );
    // Le premier compte voit zéro, le recompte voit le modèle rangé entre-temps.
    p.modeleSaisie.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const refus = svc.supprimer('t1', 's1');
    await expect(refus).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.supprimer('t1', 's1')).resolves.toEqual({ supprime: true });
  });
});

describe('séquences de saisie · le modèle', () => {
  it('une séquence d’un autre dossier est refusée au modèle', async () => {
    const p = {
      sequenceSaisie: { findFirst: jest.fn(async () => null) },
      modeleSaisie: { findFirst: jest.fn(async () => ({ id: 'm1', tenantId: 't1' })), create: jest.fn(), update: jest.fn() },
    };
    const svc = new ModeleSaisieService(p as never);
    await expect(svc.modifier('t1', 'm1', { sequenceSaisieId: 'autre' })).rejects.toThrow(/Séquence de saisie introuvable/);
    expect(p.sequenceSaisie.findFirst).toHaveBeenCalledWith({ where: { id: 'autre', tenantId: 't1' }, select: { id: true } });
    expect(p.modeleSaisie.update).not.toHaveBeenCalled();
  });
});
