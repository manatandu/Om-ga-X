"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const sante_controller_1 = require("./sante.controller");
describe('SanteController', () => {
    it('base joignable : ok', async () => {
        const c = new sante_controller_1.SanteController({ $queryRaw: async () => [{ '?column?': 1 }] });
        await expect(c.sante()).resolves.toEqual({ statut: 'ok' });
    });
    it('base injoignable : 503, jamais un faux « ok »', async () => {
        const c = new sante_controller_1.SanteController({
            $queryRaw: async () => {
                throw new Error('connexion perdue');
            },
        });
        await expect(c.sante()).rejects.toThrow(common_1.ServiceUnavailableException);
    });
});
//# sourceMappingURL=sante.controller.spec.js.map