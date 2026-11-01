import { useEffect } from 'react';
import { ecouterEchap } from '../lib/echap';
import { ListeDesDossiers } from './ListeDesDossiers';
import { PortailModale } from './PortailModale';

/**
 * FICHIER > CHANGER DE DOSSIER (ligne multi-dossiers) · la même liste que
 * l'écran qui suit la connexion. Entrer dans un autre dossier recharge
 * l'interface sur son accueil · les fenêtres de ce dossier-ci se ferment avec
 * la page, rien de chargé pour lui n'est resservi sous le nom de l'autre.
 */
export function ModaleChangerDossier({ onFermer }: { onFermer: () => void }) {
  useEffect(
    () =>
      ecouterEchap(() => {
        onFermer();
        return true;
      }),
    [onFermer],
  );
  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={onFermer}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Changer de dossier"
          className="anim-modale w-[640px] modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[4px] bg-surface border border-border-dark shadow-dominante text-[11.5px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3.5 h-[32px] border-b border-border">
            <span className="font-bold">Changer de dossier</span>
            <button type="button" onClick={onFermer} aria-label="Fermer">
              ✕
            </button>
          </div>
          <div className="p-3">
            <ListeDesDossiers autoFocus />
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
