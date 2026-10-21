"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classeDuNumero = classeDuNumero;
function classeDuNumero(numero) {
    const chiffre = numero.trim()[0];
    if (!chiffre || !/[1-9]/.test(chiffre))
        return null;
    return `CLASSE_${chiffre}`;
}
//# sourceMappingURL=classe-du-numero.js.map