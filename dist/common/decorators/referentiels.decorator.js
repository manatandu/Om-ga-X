"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferentielsAutorises = exports.REFERENTIELS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REFERENTIELS_KEY = 'referentiels';
const ReferentielsAutorises = (...referentiels) => (0, common_1.SetMetadata)(exports.REFERENTIELS_KEY, referentiels);
exports.ReferentielsAutorises = ReferentielsAutorises;
//# sourceMappingURL=referentiels.decorator.js.map