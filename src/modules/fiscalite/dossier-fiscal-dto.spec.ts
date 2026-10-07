import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreerRetraitementDto, ModifierDossierFiscalDto, MONTANT_FISCAL_MAX, ORIGINES_DEFICIT_MAX } from './dto/fiscalite.dto';

/**
 * LA PORTE DU DOSSIER FISCAL · ce qui passait en silence (mineurs de la ligne
 * IS-CAS). `null` sur une colonne NOT NULL passait `@IsOptional()` et
 * s'écrivait 0 par `arrondir(null)` ; un montant au-delà de Decimal(18, 2)
 * tombait en 500 à l'écriture ; une origine sans borne de taille était reçue
 * entière.
 */
async function messages(dto: object, corps: Record<string, unknown>): Promise<string[]> {
  const erreurs = await validate(plainToInstance(dto as never, corps) as object);
  return erreurs.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...(e.children ?? []).flatMap((c) => (c.children ?? []).flatMap((cc) => Object.values(cc.constraints ?? {}))),
  ]);
}

describe('Dossier fiscal · null n’efface pas une colonne NOT NULL (CLAUDE.md § 9)', () => {
  for (const champ of ['acomptesVerses', 'supplementsAdministration', 'supplementsPeriodeCreation']) {
    it(`${champ} · null refusé en 400 nommé, absent admis, 0 admis`, async () => {
      const refus = await messages(ModifierDossierFiscalDto, { [champ]: null });
      expect(refus.join(' ')).toContain("ne s'efface pas");
      expect(await messages(ModifierDossierFiscalDto, {})).toEqual([]);
      expect(await messages(ModifierDossierFiscalDto, { [champ]: 0 })).toEqual([]);
    });
  }

  it('les colonnes nullables gardent null comme effacement', async () => {
    expect(
      await messages(ModifierDossierFiscalDto, {
        deficitAnterieurSaisi: null,
        resultatPeriodeCreationSaisi: null,
        deficitAnterieurOrigines: null,
        natureActivite: null,
      }),
    ).toEqual([]);
  });
});

describe('Dossier fiscal · bornes hautes', () => {
  it('un montant au-delà de la borne compatible Decimal(18, 2) est refusé, nommé', async () => {
    for (const champ of ['acomptesVerses', 'supplementsAdministration', 'deficitAnterieurSaisi', 'supplementsPeriodeCreation', 'resultatPeriodeCreationSaisi']) {
      const refus = await messages(ModifierDossierFiscalDto, { [champ]: MONTANT_FISCAL_MAX + 1 });
      expect(`${champ}: ${refus.join(' ')}`).toContain('Montant hors des bornes');
      expect(await messages(ModifierDossierFiscalDto, { [champ]: MONTANT_FISCAL_MAX })).toEqual([]);
    }
    expect((await messages(ModifierDossierFiscalDto, { resultatPeriodeCreationSaisi: -MONTANT_FISCAL_MAX - 1 })).join(' ')).toContain(
      'Montant hors des bornes',
    );
    expect((await messages(CreerRetraitementDto, { code: 'X', montant: MONTANT_FISCAL_MAX + 1 })).join(' ')).toContain('Montant hors des bornes');
    // Decimal(18, 2) · seize chiffres avant la virgule, moins de 10^16.
    expect(MONTANT_FISCAL_MAX).toBeLessThan(1e16);
  });

  it('une part d’origine au-delà de la borne est refusée', async () => {
    const refus = await messages(ModifierDossierFiscalDto, {
      deficitAnterieurSaisi: 100,
      deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: MONTANT_FISCAL_MAX + 1 }],
    });
    expect(refus.join(' ')).toContain('Montant hors des bornes');
  });

  it(`l’origine du report tient en ${ORIGINES_DEFICIT_MAX} parts au plus`, async () => {
    const parts = (n: number) => Array.from({ length: n }, () => ({ dateFin: '2025-12-31', montant: 1 }));
    expect(
      (await messages(ModifierDossierFiscalDto, { deficitAnterieurSaisi: 21, deficitAnterieurOrigines: parts(ORIGINES_DEFICIT_MAX + 1) })).join(' '),
    ).toContain(`${ORIGINES_DEFICIT_MAX} parts au plus`);
    expect(await messages(ModifierDossierFiscalDto, { deficitAnterieurSaisi: 20, deficitAnterieurOrigines: parts(ORIGINES_DEFICIT_MAX) })).toEqual([]);
  });
});
