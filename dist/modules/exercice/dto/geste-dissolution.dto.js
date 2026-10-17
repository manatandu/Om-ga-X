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
exports.GesteDissolutionDto = void 0;
const class_validator_1 = require("class-validator");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
class GesteDissolutionDto {
}
exports.GesteDissolutionDto = GesteDissolutionDto;
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('retirerActesDeLaPeriode vaut true ou false · omettez le champ pour ne rien retirer.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GesteDissolutionDto.prototype, "retirerActesDeLaPeriode", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('ouvertureAnnuleeNonRessaisie vaut true ou false · omettez le champ pour ne rien confirmer.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GesteDissolutionDto.prototype, "ouvertureAnnuleeNonRessaisie", void 0);
//# sourceMappingURL=geste-dissolution.dto.js.map