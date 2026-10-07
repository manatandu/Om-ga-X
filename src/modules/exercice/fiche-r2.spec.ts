import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Referentiel } from '@prisma/client';
import { ExerciceService } from './exercice.service';
import { ExerciceController } from './exercice.controller';
import { FicheR2Dto } from './dto/fiche-r2.dto';
import { REFERENTIELS_KEY } from '../../common/decorators/referentiels.decorator';

/**
 * FICHE R2, cases ZN à ZS (AUDCIF Titre IX ch. 2 ; décision par la loi du
 * 2026-10-04, point 5) · faits DÉCLARÉS par exercice, SYSCOHADA seul.
 */
describe('Fiche R2 · cases ZN à ZS déclarées sur l’exercice', () => {
  const exercice = { id: 'e1', tenantId: 't1', dateFin: new Date(Date.UTC(2026, 11, 31)) };

  function service() {
    const prisma = {
      exercice: {
        findFirst: jest.fn().mockResolvedValue(exercice),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...exercice, ...data })),
      },
    };
    return { s: new ExerciceService(prisma as never, {} as never), prisma };
  }

  it('la route est refusée au serveur hors SYSCOHADA · masquer sans refuser laisse la route ouverte', () => {
    const meta = Reflect.getMetadata(REFERENTIELS_KEY, ExerciceController.prototype.declarerFicheR2);
    expect(meta).toEqual([Referentiel.SYSCOHADA]);
  });

  it('un champ absent est laissé tel quel, null efface · jamais zéro par défaut', async () => {
    const { s, prisma } = service();
    await s.declarerFicheR2('t1', 'e1', { nombreEtablissementsPays: 3, controleEntreprise: null });
    expect(prisma.exercice.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { nombreEtablissementsPays: 3, controleEntreprise: null },
    });
  });

  it('ZP postérieure à l’année de clôture est refusée, nommée', async () => {
    const { s, prisma } = service();
    await expect(s.declarerFicheR2('t1', 'e1', { premiereAnneeExercicePays: 2027 })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.exercice.update).not.toHaveBeenCalled();
    await s.declarerFicheR2('t1', 'e1', { premiereAnneeExercicePays: 2026 });
    expect(prisma.exercice.update).toHaveBeenCalled();
  });

  it('le DTO refuse un nombre négatif, une année hors quatre chiffres, un contrôle inconnu', async () => {
    const erreurs = async (o: object) => (await validate(plainToInstance(FicheR2Dto, o))).map((e) => e.property);
    expect(await erreurs({ nombreEtablissementsPays: -1 })).toEqual(['nombreEtablissementsPays']);
    expect(await erreurs({ premiereAnneeExercicePays: 98 })).toEqual(['premiereAnneeExercicePays']);
    expect(await erreurs({ controleEntreprise: 'MIXTE' })).toEqual(['controleEntreprise']);
    expect(await erreurs({ nombreEtablissementsHorsPays: null, controleEntreprise: 'PUBLIC' })).toEqual([]);
  });
});
