"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const bootstrap_1 = require("./bootstrap");
const mode_installation_1 = require("./common/mode-installation");
const nettoyage_telemetrie_1 = require("./common/telemetrie/nettoyage-telemetrie");
const telemetrie_serveur_1 = require("./common/telemetrie/telemetrie-serveur");
const interface_sur_site_1 = require("./modules/sur-site/interface-sur-site");
async function bootstrap() {
    new common_1.Logger('Telemetrie').log((0, nettoyage_telemetrie_1.messageRegime)('Sentry', (0, telemetrie_serveur_1.demarrerTelemetrieServeur)()));
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    if ((0, mode_installation_1.estSurSite)() && !(0, interface_sur_site_1.servirInterfaceSurSite)(app, process.env.DOSSIER_INTERFACE)) {
        new common_1.Logger('SurSite').warn('DOSSIER_INTERFACE absent ou sans index.html · l’interface n’est pas servie par ce poste.');
    }
    (0, bootstrap_1.configurerApplication)(app);
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//# sourceMappingURL=main.js.map