"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifReferenceRetiree = motifReferenceRetiree;
exports.conflitSiReferenceRetiree = conflitSiReferenceRetiree;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function motifReferenceRetiree(champ) {
    const nom = champ.includes('modeleImpression')
        ? "Le modèle d'impression choisi"
        : champ.includes('modeleReglement')
            ? 'Le modèle de règlement choisi'
            : champ.includes('modeReglement')
                ? 'Le mode de règlement choisi'
                : champ.includes('journal')
                    ? 'Le journal choisi'
                    : champ.includes('celluleGroupe')
                        ? 'Le dossier du groupe choisi'
                        : 'Un élément choisi';
    return `${nom} vient d'être retiré par une autre saisie · relisez la fiche et choisissez-en un autre.`;
}
function conflitSiReferenceRetiree(e) {
    if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        return new common_1.ConflictException(motifReferenceRetiree(String(e.meta?.field_name ?? '')));
    }
    return e;
}
//# sourceMappingURL=reference-retiree.js.map