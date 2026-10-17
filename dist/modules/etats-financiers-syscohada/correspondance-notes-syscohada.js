"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOMBRE_NOTES_SYSCOHADA = exports.NOTES_SYSCOHADA = void 0;
exports.numeroDeTeteNoteSyscohada = numeroDeTeteNoteSyscohada;
exports.notesSyscohadaDuCode = notesSyscohadaDuCode;
const correspondance_notes_syscohada_1_1 = require("./correspondance-notes-syscohada-1");
const correspondance_notes_syscohada_2_1 = require("./correspondance-notes-syscohada-2");
const correspondance_notes_syscohada_3_1 = require("./correspondance-notes-syscohada-3");
exports.NOTES_SYSCOHADA = [...correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1, ...correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2, ...correspondance_notes_syscohada_3_1.NOTES_SYSCOHADA_3];
exports.NOMBRE_NOTES_SYSCOHADA = 36;
function numeroDeTeteNoteSyscohada(code) {
    const m = /^(\d+)/.exec(code.trim());
    if (!m)
        throw new Error(`code de note SYSCOHADA sans numéro de tête : « ${code} »`);
    return Number(m[1]);
}
function notesSyscohadaDuCode(code) {
    return exports.NOTES_SYSCOHADA.filter((n) => n.code === code);
}
//# sourceMappingURL=correspondance-notes-syscohada.js.map