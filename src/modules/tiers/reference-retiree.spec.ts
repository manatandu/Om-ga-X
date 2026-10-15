import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { conflitSiReferenceRetiree, motifReferenceRetiree } from './reference-retiree';
import { TiersService } from './tiers.service';

/**
 * LA RÉFÉRENCE RETIRÉE ENTRE LE CONTRÔLE ET L'ÉCRITURE (ligne sage-l2, second
 * tour de relecture, m7) · la clé étrangère refusait en P2003 et la réponse
 * était une erreur 500 sans mot. Le refus se dit, en 409, nommé par la
 * référence en cause.
 */
const p2003 = (champ: string) =>
  new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x', meta: { field_name: champ } });

describe('conflitSiReferenceRetiree', () => {
  it('une clé étrangère refusée devient un 409 qui nomme la référence', () => {
    const e = conflitSiReferenceRetiree(p2003('tiers_modeReglementId_fkey (index)'));
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as ConflictException).message).toBe(
      "Le mode de règlement choisi vient d'être retiré par une autre saisie · relisez la fiche et choisissez-en un autre.",
    );
    expect(motifReferenceRetiree('tiers_modeleImpressionRappelId_fkey')).toMatch(/^Le modèle d'impression choisi/);
    expect(motifReferenceRetiree('echeances_reglement_modeleReglementId_fkey')).toMatch(/^Le modèle de règlement choisi/);
    expect(motifReferenceRetiree('inconnu')).toMatch(/^Un élément choisi/);
  });

  it('toute autre erreur repart telle', () => {
    const autre = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    expect(conflitSiReferenceRetiree(autre)).toBe(autre);
    const brute = new Error('panne');
    expect(conflitSiReferenceRetiree(brute)).toBe(brute);
  });
});

describe('TiersService · le mode retiré pendant la retouche de la fiche', () => {
  it('la retouche du tiers rend un 409 nommé, jamais une erreur 500', async () => {
    const prisma = {
      tiers: {
        findFirst: jest.fn().mockResolvedValue({ id: 't1', tenantId: 't', type: 'FOURNISSEUR', code: 'F1', nom: 'Fournisseur' }),
        update: jest.fn().mockRejectedValue(p2003('tiers_modeReglementId_fkey (index)')),
      },
      modeReglement: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1', tenantId: 't', code: 'VIR', nature: 'VIREMENT', estActif: true }),
      },
    };
    const service = new TiersService(prisma as never);
    const refus = service.modifier('t', 't1', { modeReglementId: 'm1' } as never);
    await expect(refus).rejects.toBeInstanceOf(ConflictException);
    await expect(refus).rejects.toThrow('Le mode de règlement choisi vient');
  });
});
