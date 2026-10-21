"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const rapprochement_controller_1 = require("./rapprochement.controller");
const rapprochement_dto_1 = require("./dto/rapprochement.dto");
const releve_bancaire_1 = require("./releve-bancaire");
const PIPE_GLOBAL = new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const lire = (requete) => PIPE_GLOBAL.transform(requete, { type: 'query', metatype: rapprochement_dto_1.PropositionsRapprochementDto });
describe('la fenêtre de dates des propositions (B9)', () => {
    it('absente, elle passe le pipe global et laisse le défaut au service', async () => {
        const dto = await lire({});
        expect(dto.fenetreJours).toBeUndefined();
        expect(releve_bancaire_1.FENETRE_JOURS_DEFAUT).toBe(15);
    });
    it('lisible, elle devient un entier', async () => {
        expect((await lire({ fenetreJours: '15' })).fenetreJours).toBe(15);
        expect((await lire({ fenetreJours: '0' })).fenetreJours).toBe(0);
        expect((await lire({ fenetreJours: String(releve_bancaire_1.FENETRE_JOURS_MAX) })).fenetreJours).toBe(releve_bancaire_1.FENETRE_JOURS_MAX);
    });
    it('illisible, un 400 qui NOMME la fenêtre', async () => {
        for (const valeur of ['abc', '1e2', '0x10', '-1', '', '12.5']) {
            const refus = await lire({ fenetreJours: valeur }).catch((e) => e);
            expect(refus).toBeInstanceOf(common_1.BadRequestException);
            expect(JSON.stringify(refus.getResponse())).toMatch(/Fenêtre de dates/);
        }
    });
    it('au-delà de la plage de l’écran, refusée · la date bornée sortait du calendrier (500)', async () => {
        const refus = await lire({ fenetreJours: String(releve_bancaire_1.FENETRE_JOURS_MAX + 1) }).catch((e) => e);
        expect(refus).toBeInstanceOf(common_1.BadRequestException);
        const tresGrande = await lire({ fenetreJours: '99999999999' }).catch((e) => e);
        expect(tresGrande).toBeInstanceOf(common_1.BadRequestException);
    });
    it('un paramètre répété est refusé, jamais lu en partie', async () => {
        const refus = await lire({ fenetreJours: ['10', '20'] }).catch((e) => e);
        expect(refus).toBeInstanceOf(common_1.BadRequestException);
    });
    it('la route lit la requête par ce DTO, et non par un ParseIntPipe', () => {
        const types = Reflect.getMetadata('design:paramtypes', rapprochement_controller_1.RapprochementController.prototype, 'proposer');
        expect(types).toContain(rapprochement_dto_1.PropositionsRapprochementDto);
        const args = Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, rapprochement_controller_1.RapprochementController, 'proposer');
        const pipes = Object.values(args).flatMap((a) => a.pipes ?? []);
        expect(pipes.some((p) => p.constructor?.name === 'ParseIntPipe')).toBe(false);
    });
});
//# sourceMappingURL=fenetre-propositions.spec.js.map