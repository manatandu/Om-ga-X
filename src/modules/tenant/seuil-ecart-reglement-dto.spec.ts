import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ModifierSeuilEcartReglementDto, SEUIL_ECART_REGLEMENT_MAX } from './dto/parametres-dossier.dto';

/**
 * LE SEUIL DE L'ÉCART DE RÈGLEMENT À LA PORTE (ligne sage-l2, second tour de
 * relecture, m4) · la colonne est en DECIMAL(18,2), et un seuil au-delà
 * tombait en 500 à l'écriture, sans mot. La borne se dit en 400 nommé ;
 * `null` retire le seuil.
 */
async function messages(corps: Record<string, unknown>): Promise<string[]> {
  const erreurs = await validate(plainToInstance(ModifierSeuilEcartReglementDto, corps) as object);
  return erreurs.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('ModifierSeuilEcartReglementDto · la borne de la colonne', () => {
  it('au plus la borne, au centime · au-delà, refusé en le disant', async () => {
    expect(await messages({ seuilEcartReglement: SEUIL_ECART_REGLEMENT_MAX })).toEqual([]);
    expect(await messages({ seuilEcartReglement: 500.25 })).toEqual([]);
    const refus = await messages({ seuilEcartReglement: SEUIL_ECART_REGLEMENT_MAX + 1 });
    expect(refus.join(' ')).toContain("Le seuil de l'écart de règlement est au plus");
  });

  it('la borne tient dans DECIMAL(18,2) · seize chiffres avant la virgule au plus', () => {
    expect(String(SEUIL_ECART_REGLEMENT_MAX).length).toBeLessThanOrEqual(16);
    expect(Number.isSafeInteger(SEUIL_ECART_REGLEMENT_MAX)).toBe(true);
  });

  it('null retire le seuil · aucune borne ne le refuse', async () => {
    expect(await messages({ seuilEcartReglement: null })).toEqual([]);
  });
});
