"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacultatifNonNul = FacultatifNonNul;
const class_validator_1 = require("class-validator");
function FacultatifNonNul(motif) {
    return (cible, cle) => {
        (0, class_validator_1.ValidateIf)((_objet, valeur) => valeur !== undefined)(cible, cle);
        (0, class_validator_1.IsDefined)({ message: motif })(cible, cle);
    };
}
//# sourceMappingURL=facultatif-non-nul.js.map