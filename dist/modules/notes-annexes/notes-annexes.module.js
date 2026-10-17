"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotesAnnexesModule = void 0;
const common_1 = require("@nestjs/common");
const note_annexe_service_1 = require("./note-annexe.service");
const note_annexe_controller_1 = require("./note-annexe.controller");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const exercice_module_1 = require("../exercice/exercice.module");
const etats_financiers_module_1 = require("../etats-financiers/etats-financiers.module");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let NotesAnnexesModule = class NotesAnnexesModule {
};
exports.NotesAnnexesModule = NotesAnnexesModule;
exports.NotesAnnexesModule = NotesAnnexesModule = __decorate([
    (0, common_1.Module)({
        imports: [comptabilite_module_1.ComptabiliteModule, exercice_module_1.ExerciceModule, licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, etats_financiers_module_1.EtatsFinanciersModule],
        controllers: [note_annexe_controller_1.NoteAnnexeController],
        providers: [note_annexe_service_1.NoteAnnexeService],
        exports: [note_annexe_service_1.NoteAnnexeService],
    })
], NotesAnnexesModule);
//# sourceMappingURL=notes-annexes.module.js.map