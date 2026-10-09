import { ModuleOptionnel, TypeLicence } from '@prisma/client';
import { MODULES_OPTIONNELS, modulesServis } from './modules-optionnels';

/**
 * Décision de Manasse du 2026-10-09 · le dossier de l'éditeur a toutes les
 * fonctionnalités, quels que soient les modules cochés ; un client garde les
 * siens.
 */
describe('modules servis', () => {
  it('le dossier de l’éditeur reçoit tous les modules, même aucun coché', () => {
    expect(modulesServis([], TypeLicence.PROPRIETAIRE)).toEqual([...MODULES_OPTIONNELS]);
    expect(modulesServis(null, TypeLicence.PROPRIETAIRE)).toEqual([...MODULES_OPTIONNELS]);
  });

  it('un dossier client garde ce qu’il a coché, rien de plus', () => {
    expect(modulesServis([ModuleOptionnel.PAIE], TypeLicence.ABONNEMENT)).toEqual([ModuleOptionnel.PAIE]);
    expect(modulesServis([], TypeLicence.ABONNEMENT)).toEqual([]);
    expect(modulesServis([ModuleOptionnel.IFRS], null)).toEqual([ModuleOptionnel.IFRS]);
  });
});
