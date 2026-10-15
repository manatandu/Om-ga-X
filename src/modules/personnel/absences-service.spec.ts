import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AbsencesService } from './absences.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * RELECTURE L5, MINEUR 3 · UNE INDEMNITÉ DE LA CAISSE PAR ARRÊT ET PAR MOIS,
 * TENUE PAR LA BASE. La lecture préalable laissait passer deux déclarations
 * simultanées ; l'index unique (arrêt, mois, non annulée) les heurte, et le
 * conflit se dit en français, jamais en 500.
 */
describe('mineur 3 · l’index unique de l’indemnité de la Caisse', () => {
  it('une seconde déclaration simultanée rencontre l’index · 409 nommé', async () => {
    const conflit = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5' });
    const prisma = { $transaction: jest.fn().mockRejectedValue(conflit) } as unknown as PrismaService;
    const svc = new AbsencesService(prisma);
    const dto = { mois: '2026-08', montant: 20_000, traitement: 'DEDUITE' as const, piece: 'Bordereau CNSS 118' };
    await expect(svc.declarerIndemniteCaisse('t', 'u@x.cd', 'a-1', dto)).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.declarerIndemniteCaisse('t', 'u@x.cd', 'a-1', dto)).rejects.toThrow(/déjà déclarée sur cet arrêt pour ce mois/);
  });

  it('le schéma déclare l’index sur l’arrêt, le mois et l’annulation', () => {
    const { readFileSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
    const schema = readFileSync(`${__dirname}/../../../prisma/schema.prisma`, 'utf8');
    const bloc = /model IndemniteCaisseAbsence \{([\s\S]*?)\n\}/.exec(schema)![1];
    expect(bloc).toContain('@@unique([absenceId, mois, annuleLe])');
  });
});
