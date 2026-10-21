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
exports.RemplacerSelectionEditionDto = exports.CreerSelectionEditionDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class CreerSelectionEditionDto {
}
exports.CreerSelectionEditionDto = CreerSelectionEditionDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.EditionSelection, { message: 'Édition inconnue · JOURNAL ou IMPRESSION_DIFFEREE.' }),
    __metadata("design:type", String)
], CreerSelectionEditionDto.prototype, "edition", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'Le nom de la sélection est exigé.' }),
    __metadata("design:type", String)
], CreerSelectionEditionDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsObject)({ message: 'Les critères de la sélection sont exigés.' }),
    __metadata("design:type", Object)
], CreerSelectionEditionDto.prototype, "criteres", void 0);
class RemplacerSelectionEditionDto {
}
exports.RemplacerSelectionEditionDto = RemplacerSelectionEditionDto;
__decorate([
    (0, class_validator_1.IsObject)({ message: 'Les critères de la sélection sont exigés.' }),
    __metadata("design:type", Object)
], RemplacerSelectionEditionDto.prototype, "criteres", void 0);
//# sourceMappingURL=selection-edition.dto.js.map