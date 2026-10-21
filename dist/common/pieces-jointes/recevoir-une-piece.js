"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecevoirUnePiece = RecevoirUnePiece;
exports.servirLaPiece = servirLaPiece;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const pieces_jointes_1 = require("./pieces-jointes");
const refus_envoi_filter_1 = require("./refus-envoi.filter");
function RecevoirUnePiece() {
    return (0, common_1.applyDecorators)((0, common_1.UseFilters)(refus_envoi_filter_1.RefusEnvoi), (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('fichier', { limits: { fileSize: pieces_jointes_1.TAILLE_MAX_DOCUMENT, files: 1, fields: 4 } })));
}
function servirLaPiece(res, piece) {
    res.set((0, pieces_jointes_1.entetesTelechargement)(piece));
    res.send(Buffer.from(piece.contenu));
}
//# sourceMappingURL=recevoir-une-piece.js.map