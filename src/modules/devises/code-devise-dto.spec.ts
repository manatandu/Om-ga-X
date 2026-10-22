import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreerDeviseDto } from './dto/devises.dto';

/**
 * LE CODE D'UNE DEVISE À LA PORTE (ligne sage-l3, n° 37, second tour de
 * relecture) · trois caractères ne font pas trois LETTRES. « US » suivi d'un
 * blanc passait la longueur, et le code rangé n'était plus retrouvé par les
 * lectures qui comparent en majuscules (la devise du RIB du donneur d'ordre,
 * celle des lignes réglées). Le refus se dit en 400 nommé ; la casse, elle,
 * est libre, le service range en majuscules.
 */
async function messages(corps: Record<string, unknown>): Promise<string[]> {
  const erreurs = await validate(plainToInstance(CreerDeviseDto, corps) as object);
  return erreurs.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreerDeviseDto · le code est un code ISO à trois lettres', () => {
  it('trois lettres, en toute casse', async () => {
    expect(await messages({ code: 'USD', intitule: 'Dollar' })).toEqual([]);
    expect(await messages({ code: 'eur', intitule: 'Euro' })).toEqual([]);
  });

  it('un blanc, un chiffre ou une quatrième lettre sont refusés en le disant', async () => {
    for (const code of ['US ', ' US', 'US1', 'USDD', 'U', '']) {
      const refus = await messages({ code, intitule: 'x' });
      expect(refus.join(' ')).toContain('code ISO à trois lettres');
    }
  });
});
