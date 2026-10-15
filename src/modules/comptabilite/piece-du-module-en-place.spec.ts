import { ConflictException } from '@nestjs/common';
import { NumerotationPiece, StatutEcriture } from '@prisma/client';
import { EcritureService } from './ecriture.service';

/**
 * LA RETOUCHE EN PLACE NE DOUBLE JAMAIS L'ACQUISITION (second tour de relecture
 * de la ligne sage-l4) · une validation concurrente passée entre la lecture de
 * la pièce et le retrait de ses lignes laissait ces lignes (filtre sur le
 * brouillard) et ajoutait les nouvelles · une pièce validée portait l'acquisition
 * deux fois, sans aucun refus.
 */
describe('EcritureService.modifierPieceDuModule', () => {
  function monter(retirees: number) {
    const ajouts: unknown[] = [];
    const tx = {
      ecriture: {
        findFirst: async () => ({
          id: 'e1',
          statut: StatutEcriture.BROUILLARD,
          exerciceId: 'x1',
          journalId: 'j1',
          date: new Date('2026-03-10T00:00:00.000Z'),
          journal: { numerotation: NumerotationPiece.CONTINUE_JOURNAL },
        }),
        update: async (a: unknown) => {
          ajouts.push(a);
          return { id: 'e1' };
        },
      },
      exercice: {
        findFirst: async () => ({
          dateDebut: new Date('2026-01-01T00:00:00.000Z'),
          dateFin: new Date('2026-12-31T00:00:00.000Z'),
          statut: 'OUVERT',
        }),
      },
      ligneEcriture: { deleteMany: async () => ({ count: retirees }) },
    };
    const s = new EcritureService({} as never, {} as never, {} as never, {} as never);
    jest.spyOn(s, 'controlesDEntree').mockResolvedValue({ date: new Date('2026-03-10T00:00:00.000Z'), sectionsParId: new Map() } as never);
    return { s, tx, ajouts };
  }
  const dto = { date: '2026-03-10', lignes: [] };

  it('validée entre-temps · aucune ligne retirée, 409 et rien ajouté', async () => {
    const m = monter(0);
    await expect(m.s.modifierPieceDuModule(m.tx as never, 't1', 'e1', dto)).rejects.toThrow(ConflictException);
    expect(m.ajouts).toEqual([]);
  });

  it('au brouillard · les lignes sont remplacées', async () => {
    const m = monter(2);
    await expect(m.s.modifierPieceDuModule(m.tx as never, 't1', 'e1', dto)).resolves.toBe(true);
    expect(m.ajouts).toHaveLength(1);
  });
});
