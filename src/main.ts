import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurerApplication } from './bootstrap';
import { estSurSite } from './common/mode-installation';
import { messageRegime } from './common/telemetrie/nettoyage-telemetrie';
import { demarrerTelemetrieServeur } from './common/telemetrie/telemetrie-serveur';
import { servirInterfaceSurSite } from './modules/sur-site/interface-sur-site';

/**
 * Serveur · développement local et toute cible qui héberge un processus long
 * (Cloud Run, un conteneur, le poste d'un client sur site). Écoute sur
 * `process.env.PORT`.
 */
async function bootstrap() {
  // TÉLÉMÉTRIE D'ABORD · une panne pendant le montage des modules doit déjà
  // pouvoir partir. Une seule ligne, le RÉGIME, jamais la clé
  // (common/telemetrie/telemetrie-serveur.ts).
  new Logger('Telemetrie').log(messageRegime('Sentry', demarrerTelemetrieServeur()));
  const app = await NestFactory.create(AppModule);
  // Sur site, l'interface est servie AVANT la configuration commune · voir
  // interface-sur-site.ts pour la raison (la politique de sécurité de l'API).
  if (estSurSite() && !servirInterfaceSurSite(app, process.env.DOSSIER_INTERFACE)) {
    new Logger('SurSite').warn('DOSSIER_INTERFACE absent ou sans index.html · l’interface n’est pas servie par ce poste.');
  }
  configurerApplication(app);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
