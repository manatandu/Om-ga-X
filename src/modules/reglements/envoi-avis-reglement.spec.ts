import { BadRequestException } from '@nestjs/common';
import { StatutMessage } from '@prisma/client';
import { ORIGINE_AVIS_REGLEMENT } from '../courrier/courrier.service';
import { EnvoiAvisReglementService } from './envoi-avis-reglement.service';

/**
 * Ligne gl-saisie, fonction 35 · l'avis de règlement envoyé au tiers par la
 * messagerie. Le texte de l'avis imprimé, en file sans envoi tenté, une fois
 * par ligne de l'ordre ; un tiers sans adresse est nommé.
 */
describe('envoi des avis de règlement', () => {
  const avis = [
    { ligneId: 'l1', tiersId: 't1', beneficiaire: 'SARL Amani', montant: 100, montantDevise: null, modele: null, texte: 'Avis 1' },
    { ligneId: 'l2', tiersId: 't2', beneficiaire: 'SARL Bomoko', montant: 50, montantDevise: null, modele: null, texte: 'Avis 2' },
    { ligneId: 'l3', tiersId: 't3', beneficiaire: 'Ets Cito', montant: 70, montantDevise: null, modele: null, texte: 'Avis 3' },
  ];
  function service(options: { deja?: string[]; avis?: typeof avis } = {}) {
    const ecrits: unknown[][] = [];
    const tx = {
      $executeRaw: jest.fn(async () => 0),
      message: { findMany: jest.fn(async () => (options.deja ?? []).map((origineId) => ({ origineId }))) },
    };
    const prisma = {
      tiers: {
        findMany: jest.fn(async () => [
          { id: 't1', email: 'amani@example.cd', nom: 'SARL Amani' },
          { id: 't2', email: '  ', nom: 'SARL Bomoko' },
          { id: 't3', email: 'cito@example.cd', nom: 'Ets Cito' },
        ]),
      },
      tenant: { findUnique: jest.fn(async () => ({ nom: 'ONG Kin' })) },
      $transaction: jest.fn(async (f: (t: unknown) => unknown) => f(tx)),
    };
    const ordres = {
      avisReglement: jest.fn(async () => ({ ordre: { id: 'o1', numero: 12, date: new Date(), statut: 'IMPRIME', devise: null }, avis: options.avis ?? avis, lignesDeSalaires: 0 })),
    };
    const courrier = {
      ecrireEnFileSansTenter: jest.fn(async (_tx: unknown, _t: string, messages: unknown[]) => {
        ecrits.push(messages);
        return messages.map((_, i) => ({ id: `m${i}`, statut: StatutMessage.SANS_TRANSPORT, motif: null }));
      }),
    };
    return { svc: new EnvoiAvisReglementService(prisma as never, ordres as never, courrier as never), ecrits, tx, ordres };
  }

  it('écrit en file le texte de l’avis imprimé, sans envoi tenté, et nomme le tiers sans adresse', async () => {
    const { svc, ecrits, tx } = service();
    const b = await svc.envoyer('d1', 'u1', 'o1');
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0]).toEqual([
      expect.objectContaining({ destinataire: 'amani@example.cd', corps: 'Avis 1', origine: ORIGINE_AVIS_REGLEMENT, origineId: 'l1', createdBy: 'u1', sujet: 'Avis de règlement · ordre n° 12 · ONG Kin' }),
      expect.objectContaining({ destinataire: 'cito@example.cd', corps: 'Avis 3', origineId: 'l3' }),
    ]);
    expect(b.misesEnFile.map((m) => m.ligneId)).toEqual(['l1', 'l3']);
    expect(b.sansAdresse).toEqual([{ ligneId: 'l2', beneficiaire: 'SARL Bomoko' }]);
    // Le contrôle du déjà-envoyé et l'écriture se font sous le verrou du dossier.
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('un avis déjà en file ou parti ne se réécrit pas', async () => {
    const { svc, ecrits, tx } = service({ deja: ['l1', 'l3'] });
    const b = await svc.envoyer('d1', 'u1', 'o1');
    expect(ecrits).toEqual([]);
    expect(b.dejaEnvoyes.map((d) => d.ligneId)).toEqual(['l1', 'l3']);
    const where = (tx.message.findMany.mock.calls[0] as unknown as [{ where: { statut: { in: StatutMessage[] } } }])[0].where;
    expect(where.statut.in).not.toContain(StatutMessage.ABANDONNE);
  });

  it('un ordre sans tiers payé n’a pas d’avis à envoyer', async () => {
    await expect(service({ avis: [] }).svc.envoyer('d1', 'u1', 'o1')).rejects.toThrow(BadRequestException);
  });
});
