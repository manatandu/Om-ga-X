import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreerTiersDto, NumeroProposeDto } from './tiers.dto';

/**
 * LE NUMÉRO CHOISI ET LE TYPE DE LA PROPOSITION, À TRAVERS LE PIPE DE
 * PRODUCTION · c'est lui qui rend le 400 ; un refus qui n'arriverait qu'au
 * service laisserait passer `null` ou une chaîne vide jusqu'à un message
 * absurde. Les options sont celles du pipe global (facultatif-non-nul.spec.ts
 * les relit dans bootstrap.ts).
 */
const OPTIONS_DU_PIPE_GLOBAL = { whitelist: true, forbidNonWhitelisted: true, transform: true } as const;

async function refus(metatype: new () => object, valeur: Record<string, unknown>, type: 'body' | 'query' = 'body') {
  try {
    await new ValidationPipe(OPTIONS_DU_PIPE_GLOBAL).transform(valeur, { type, metatype, data: undefined });
    return null;
  } catch (e) {
    if (e instanceof BadRequestException) return JSON.stringify(e.getResponse());
    throw e;
  }
}

const tiers = { type: 'CLIENT', code: 'C1', nom: 'Acme' };

describe('le numéro de compte choisi à la création, au pipe', () => {
  it('absent ou fait de chiffres, il passe · le service juge le reste', async () => {
    expect(await refus(CreerTiersDto, tiers)).toBeNull();
    expect(await refus(CreerTiersDto, { ...tiers, numeroCompte: '41110250' })).toBeNull();
  });

  it('null, vide ou trop long, il est refusé en le disant', async () => {
    expect(await refus(CreerTiersDto, { ...tiers, numeroCompte: null })).toMatch(/omettez le champ/);
    expect(await refus(CreerTiersDto, { ...tiers, numeroCompte: '' })).toMatch(/ne peut pas être vide/);
    expect(await refus(CreerTiersDto, { ...tiers, numeroCompte: '4'.repeat(14) })).toMatch(/au plus 13 chiffres/);
    expect(await refus(CreerTiersDto, { ...tiers, numeroCompte: 41110250 })).toMatch(/suite de chiffres/);
  });
});

describe('le type de la proposition, au pipe', () => {
  it('un type connu passe, un type absent ou inconnu est refusé', async () => {
    expect(await refus(NumeroProposeDto, { type: 'FOURNISSEUR' }, 'query')).toBeNull();
    expect(await refus(NumeroProposeDto, {}, 'query')).toMatch(/Type de tiers inconnu/);
    expect(await refus(NumeroProposeDto, { type: 'BANQUE' }, 'query')).toMatch(/Type de tiers inconnu/);
  });
});
