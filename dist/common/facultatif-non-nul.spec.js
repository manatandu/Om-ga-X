"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("./facultatif-non-nul");
const OPTIONS_DU_PIPE_GLOBAL = { whitelist: true, forbidNonWhitelisted: true, transform: true };
async function refusDuPipe(metatype, corps) {
    const pipe = new common_1.ValidationPipe(OPTIONS_DU_PIPE_GLOBAL);
    try {
        await pipe.transform(corps, { type: 'body', metatype, data: undefined });
        return null;
    }
    catch (e) {
        if (e instanceof common_1.BadRequestException)
            return e;
        throw e;
    }
}
function motifsDu(refus) {
    if (!refus)
        return [];
    const reponse = refus.getResponse();
    return Array.isArray(reponse.message) ? reponse.message : [String(reponse.message)];
}
const MOTIF = 'La coche se répond par true ou false, jamais par null.';
const MOTIF_DATE = 'La date ne s’efface pas par null · une chaîne vide l’efface.';
class Banc {
}
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)(MOTIF),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], Banc.prototype, "coche", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)(MOTIF_DATE),
    (0, class_validator_1.ValidateIf)((o) => o.date !== ''),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], Banc.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Banc.prototype, "libre", void 0);
describe('FacultatifNonNul · à travers le pipe global', () => {
    it('les options du banc sont celles du pipe global de bootstrap.ts', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'bootstrap.ts'), 'utf8');
        expect(source).toContain('app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))');
    });
    it('absent = inchangé · le champ se laisse omettre', async () => {
        expect(await refusDuPipe(Banc, {})).toBeNull();
    });
    it('null est refusé en 400, avec le motif nommé', async () => {
        const refus = await refusDuPipe(Banc, { coche: null });
        expect(refus).not.toBeNull();
        expect(refus.getStatus()).toBe(400);
        expect(motifsDu(refus)).toContain(MOTIF);
    });
    it('une valeur présente reste validée comme avant', async () => {
        expect(await refusDuPipe(Banc, { coche: false })).toBeNull();
        expect(motifsDu(await refusDuPipe(Banc, { coche: 'oui' }))).not.toHaveLength(0);
    });
    it('la chaîne vide d’une date effaçable passe encore, null non', async () => {
        expect(await refusDuPipe(Banc, { date: '' })).toBeNull();
        expect(await refusDuPipe(Banc, { date: '2027-08-31' })).toBeNull();
        expect(motifsDu(await refusDuPipe(Banc, { date: null }))).toContain(MOTIF_DATE);
    });
    it('témoin · `@IsOptional` laisse passer null, et c’est ce que le décorateur ferme', async () => {
        expect(await refusDuPipe(Banc, { libre: null })).toBeNull();
    });
});
//# sourceMappingURL=facultatif-non-nul.spec.js.map