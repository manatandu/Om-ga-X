"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortieMotDePasseProvisoire = exports.CLE_SORTIE_MOT_DE_PASSE = void 0;
const common_1 = require("@nestjs/common");
exports.CLE_SORTIE_MOT_DE_PASSE = 'sortie-mot-de-passe-provisoire';
const SortieMotDePasseProvisoire = () => (0, common_1.SetMetadata)(exports.CLE_SORTIE_MOT_DE_PASSE, true);
exports.SortieMotDePasseProvisoire = SortieMotDePasseProvisoire;
//# sourceMappingURL=sortie-mot-de-passe.decorator.js.map