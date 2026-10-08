import type { CampagneInventaire } from './types';

/**
 * LE BOUTON « CLORE LA CAMPAGNE » SUIT LES DEUX CHEMINS QUE LE SERVEUR ADMET
 * (`InventaireService.clore`, paquet 1, B10).
 *
 * (1) À l'ARBITRAGE, comme toujours · les fiches ont été rapprochées de la
 * balance, chaque écart reçoit sa décision (CPCC, étapes 4 et 5).
 *
 * (2) Au RECENSEMENT, une campagne qui ne compte QUE des caisses · aucune
 * fiche, au moins un procès-verbal de comptage. Le PV fait à lui seul le
 * comptage, la valorisation et la comparaison au solde du livre-journal ; il
 * n'y a rien à rapprocher, et le bouton manquait · la campagne restait au
 * recensement sans issue. Un PV qui porte un écart reste refusé par le
 * serveur, et le refus nomme son issue (porter le comptage sur une fiche de
 * la caisse, rapprocher, arbitrer) · le bouton le laisse dire plutôt que de
 * se cacher sans un mot.
 */
export function peutCloreLaCampagne(
  campagne: Pick<CampagneInventaire, 'statut' | 'fiches' | 'pvComptageCaisse'>,
): boolean {
  if (campagne.statut === 'ARBITRAGE') return true;
  if (campagne.statut !== 'RECENSEMENT') return false;
  // Les listes viennent de `consulter` · absentes, rien n'est su, et le
  // bouton ne promet pas une clôture que le serveur jugera sur ce qu'il lit.
  if (!campagne.fiches || !campagne.pvComptageCaisse) return false;
  return campagne.fiches.length === 0 && campagne.pvComptageCaisse.length > 0;
}
