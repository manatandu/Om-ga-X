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
exports.DemanderImpressionDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class DemanderImpressionDto {
}
exports.DemanderImpressionDto = DemanderImpressionDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureImpressionDifferee, { message: 'Livre inconnu · JOURNAL, GRAND_LIVRE ou BALANCE.' }),
    __metadata("design:type", String)
], DemanderImpressionDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsObject)({ message: 'Les critères de l’édition sont exigés.' }),
    __metadata("design:type", Object)
], DemanderImpressionDto.prototype, "criteres", void 0);
//# sourceMappingURL=demander-impression.dto.js.map