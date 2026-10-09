import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LivreDePaieDto, MOTIF_MONTANT_AU_CENTIME, SimulationPaieDto } from './dto/personnel.dto';

/**
 * PASSE D2 · deux portes du corps de requête.
 *  · la majoration des risques professionnels se déclare au niveau NOTIFIÉ,
 *    50 ou 100 (arrêté n° 140/2018, art. 22 et 24), jamais un booléen qui
 *    doublait toujours ;
 *  · les rangs du livre de paie sont ceux de l'arrêté de 2008 (1 à 33).
 */
const erreursSur = async <T extends object>(cls: new () => T, corps: object, champ: string) =>
  (await validate(plainToInstance(cls, corps))).filter((e) => e.property === champ);

describe('Passe D2 · les portes du corps de requête', () => {
  const simulation = { moisDePaie: '2026-03', elements: [] };

  it('la majoration des risques professionnels n’admet que 50 ou 100', async () => {
    for (const ok of [50, 100]) {
      expect(await erreursSur(SimulationPaieDto, { ...simulation, majorationRisquesProfessionnelsPourCent: ok }, 'majorationRisquesProfessionnelsPourCent')).toEqual([]);
    }
    for (const ko of [25, 150, true]) {
      expect(
        (await erreursSur(SimulationPaieDto, { ...simulation, majorationRisquesProfessionnelsPourCent: ko }, 'majorationRisquesProfessionnelsPourCent')).length,
      ).toBe(1);
    }
  });

  it('constat 3 · le montant d’un élément de paie est au centime, comme les autres montants de la paie', async () => {
    // Premier tour de relecture du paquet 1 · 50 000,005 FC d'allocations
    // rendait une part imposable de −0,01 FC après l'arrondi du plafond.
    const element = (montantFc: number) => ({ nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc });
    const refus = async (montantFc: number) =>
      (await validate(plainToInstance(SimulationPaieDto, { ...simulation, elements: [element(montantFc)] }))).filter(
        (e) => e.property === 'elements',
      );
    expect(await refus(50_000.01)).toEqual([]);
    expect(await refus(50_000)).toEqual([]);
    expect((await refus(50_000.005)).length).toBe(1);
    // Le refus se dit en français, nommé.
    const [elements] = await refus(50_000.005);
    const messages = JSON.stringify(elements.children);
    expect(messages).toContain(MOTIF_MONTANT_AU_CENTIME);
  });

  it('les rangs du livre de paie sont bornés à 1 et 33', async () => {
    expect(await erreursSur(LivreDePaieDto, { mentionsPortees: [1, 33] }, 'mentionsPortees')).toEqual([]);
    expect((await erreursSur(LivreDePaieDto, { mentionsPortees: [34] }, 'mentionsPortees')).length).toBe(1);
    expect((await erreursSur(LivreDePaieDto, { mentionsPortees: [0] }, 'mentionsPortees')).length).toBe(1);
  });
});
