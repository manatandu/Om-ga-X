"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const exercice_service_1 = require("./exercice.service");
const exercice_controller_1 = require("./exercice.controller");
const fiche_r2_dto_1 = require("./dto/fiche-r2.dto");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
describe('Fiche R2 · cases ZN à ZS déclarées sur l’exercice', () => {
    const exercice = { id: 'e1', tenantId: 't1', dateFin: new Date(Date.UTC(2026, 11, 31)) };
    function service(systemeComptableSyscohada = 'NORMAL') {
        const prisma = {
            exercice: {
                findFirst: jest.fn().mockResolvedValue(exercice),
                update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...exercice, ...data })),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ systemeComptableSyscohada }) },
        };
        return { s: new exercice_service_1.ExerciceService(prisma, {}), prisma };
    }
    it('la route est refusée au serveur hors SYSCOHADA · masquer sans refuser laisse la route ouverte', () => {
        const meta = Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, exercice_controller_1.ExerciceController.prototype.declarerFicheR2);
        expect(meta).toEqual([client_1.Referentiel.SYSCOHADA]);
    });
    it('un champ absent est laissé tel quel, null efface · jamais zéro par défaut', async () => {
        const { s, prisma } = service();
        await s.declarerFicheR2('t1', 'e1', { nombreEtablissementsPays: 3, controleEntreprise: null });
        expect(prisma.exercice.update).toHaveBeenCalledWith({
            where: { id: 'e1' },
            data: { nombreEtablissementsPays: 3, controleEntreprise: null },
        });
    });
    it('au Système minimal de trésorerie, refusée au serveur avec son motif · la liasse du S.M.T ne porte pas de fiche R2', async () => {
        const { s, prisma } = service('MINIMAL_TRESORERIE');
        await expect(s.declarerFicheR2('t1', 'e1', { nombreEtablissementsPays: 1 })).rejects.toThrow('Système minimal de trésorerie');
        expect(prisma.exercice.update).not.toHaveBeenCalled();
    });
    it('ZP postérieure à l’année de clôture est refusée, nommée', async () => {
        const { s, prisma } = service();
        await expect(s.declarerFicheR2('t1', 'e1', { premiereAnneeExercicePays: 2027 })).rejects.toThrow(common_1.BadRequestException);
        expect(prisma.exercice.update).not.toHaveBeenCalled();
        await s.declarerFicheR2('t1', 'e1', { premiereAnneeExercicePays: 2026 });
        expect(prisma.exercice.update).toHaveBeenCalled();
    });
    it('le DTO refuse un nombre négatif, une année hors quatre chiffres, un contrôle inconnu', async () => {
        const erreurs = async (o) => (await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(fiche_r2_dto_1.FicheR2Dto, o))).map((e) => e.property);
        expect(await erreurs({ nombreEtablissementsPays: -1 })).toEqual(['nombreEtablissementsPays']);
        expect(await erreurs({ premiereAnneeExercicePays: 98 })).toEqual(['premiereAnneeExercicePays']);
        expect(await erreurs({ controleEntreprise: 'MIXTE' })).toEqual(['controleEntreprise']);
        expect(await erreurs({ nombreEtablissementsHorsPays: null, controleEntreprise: 'PUBLIC' })).toEqual([]);
    });
});
//# sourceMappingURL=fiche-r2.spec.js.map