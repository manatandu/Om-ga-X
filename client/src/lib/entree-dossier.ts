import { api, setCsrf } from './api';
import { marquerDossierChoisi } from './dossiers-personne';
import { adopterDossierDeLEcran } from './dossier-de-l-ecran';

/**
 * Entrer dans un dossier. Le serveur pose la session neuve en cookie et rend
 * son jeton CSRF ; l'interface REPART d'une page neuve sur l'accueil · tout ce
 * qui a été chargé pour l'autre dossier (exercices, plan, fenêtres ouvertes,
 * caches) part avec la page, au lieu d'être resservi sous le nom du nouveau.
 */
export async function entrerDansLeDossier(
  dossierId: string,
  recharger: () => void = () => {
    window.location.hash = '#/';
    window.location.reload();
  },
): Promise<void> {
  const r = await api.post<{ change: boolean; csrfToken?: string }>('/auth/changer-dossier', { dossierId });
  // Adopté AVANT le jeton · le jeton neuf écrit dans le stockage partagé
  // réveille les autres onglets, qui doivent y lire le dossier neuf.
  adopterDossierDeLEcran(dossierId);
  if (r.csrfToken) setCsrf(r.csrfToken);
  marquerDossierChoisi();
  recharger();
}
