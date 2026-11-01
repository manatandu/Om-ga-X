import { api, setCsrf } from './api';
import { marquerDossierChoisi } from './dossiers-personne';

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
  if (r.csrfToken) setCsrf(r.csrfToken);
  marquerDossierChoisi();
  recharger();
}
