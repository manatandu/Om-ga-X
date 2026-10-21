"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conventionInterditeCompteCourant = conventionInterditeCompteCourant;
const client_1 = require("@prisma/client");
function conventionInterditeCompteCourant(forme) {
    switch (forme) {
        case client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
            return ('Dans une SARL, si le titulaire du compte est un gérant ou un associé personne physique, ou son conjoint, ' +
                'ascendant, descendant ou une personne interposée, l’emprunt et le découvert en compte courant sont ' +
                'interdits à peine de nullité (AUSCGIE art. 356) · une convention de prêt ne le régularise pas. ' +
                'L’article ne vise pas l’associé personne morale.');
        case client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME:
            return ('Dans une société anonyme, si le titulaire du compte est un administrateur, le directeur général, un ' +
                'directeur général adjoint, l’administrateur général ou son adjoint, ou leur conjoint, ascendant, ' +
                'descendant ou une personne interposée, l’emprunt et le découvert en compte courant sont interdits à ' +
                'peine de nullité (AUSCGIE art. 450 et 507), sauf pour un établissement bancaire ou financier et des ' +
                'opérations courantes à conditions normales. L’art. 450 ne vise pas l’administrateur personne morale.');
        case client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE:
            return ('Dans une SAS, si le titulaire du compte est le président ou un dirigeant, ou son conjoint, ascendant, ' +
                'descendant ou une personne interposée, l’emprunt et le découvert en compte courant sont interdits à ' +
                'peine de nullité (AUSCGIE art. 853-16) · l’article ne vise pas les personnes morales dirigeantes.');
        default:
            return null;
    }
}
//# sourceMappingURL=conventions-interdites.js.map