import { useAuth } from '../lib/auth';
import { ListeDesDossiers } from '../components/ListeDesDossiers';

/**
 * L'ACCUEIL DU CABINET SUR SES DOSSIERS (ligne multi-dossiers, 2026-11-01) ·
 * après la connexion d'une personne qui tient plusieurs dossiers, la liste de
 * SES dossiers s'impose avant l'écran des logiciels (ZoneProtegee, App.tsx).
 * Registre de l'application (charte § 9 bis) · un cadre, sa barre de titre,
 * la grille, aucun ornement ni paragraphe explicatif.
 */
export function ChoixDossierPage() {
  const { utilisateur, seDeconnecter } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="anim-modale w-full max-w-[640px] bg-surface border border-border-dark shadow-flottante">
        <div className="h-[32px] flex items-center justify-between px-2.5 bg-surface text-text border-b border-border text-[11.5px]">
          <span>Mes dossiers</span>
          <span className="text-text-dim">{utilisateur?.email}</span>
        </div>
        <div className="p-4">
          <ListeDesDossiers autoFocus />
          <div className="flex justify-start mt-3">
            <button type="button" onClick={seDeconnecter} className="text-[11.5px] text-text-dim hover:text-text">
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
