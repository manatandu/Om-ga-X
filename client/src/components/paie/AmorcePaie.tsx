import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { modulesAvecLaPaie, paieAActiver } from '../../lib/amorce-paie';
import type { ModuleOptionnel } from '../../lib/profil-dossier';
import { Aide } from '../chrome/Aide';

/**
 * Voir `lib/amorce-paie.ts`. L'administrateur active ; les autres lisent que
 * c'est à lui de le faire (la route est réservée à l'administrateur).
 */
export function AmorcePaie({
  modulesActives,
  onActive,
}: {
  modulesActives: readonly ModuleOptionnel[] | null | undefined;
  onActive?: (m: ModuleOptionnel[]) => void;
}) {
  const { estAdmin, rafraichir } = useAuth();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!paieAActiver(modulesActives)) return null;
  const activer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      // Les modules RELUS au serveur juste avant · la liste de l'écran peut
      // dater, et la route remplace la liste entière · sans relecture, un
      // module qu'un autre administrateur vient d'activer serait retiré.
      const moi = await api.get<{ tenant?: { modulesActives?: ModuleOptionnel[] | null } }>('/auth/me');
      const actuels = moi.tenant?.modulesActives;
      if (!Array.isArray(actuels)) throw new Error('Les modules du dossier ne se lisent pas · rien n’est changé.');
      const p = await api.patch<{ modulesActives: ModuleOptionnel[] }>('/dossier/modules', {
        modulesActives: modulesAvecLaPaie(actuels),
      });
      onActive?.(p.modulesActives);
      await rafraichir();
    } catch (e) {
      setErreur(e instanceof ApiError || e instanceof Error ? e.message : 'Activation impossible');
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div role="status" className="border border-border bg-surface-alt px-3 py-1.5 mb-2 text-[11.5px] max-w-[1240px] flex items-center gap-2 flex-wrap">
      <span>La paie n’est pas activée pour ce dossier.</span>
      <Aide
        titre="Activer la Paie"
        texte="La paie est un module du dossier. Activée, elle met au menu le registre du personnel, les bulletins et leurs déclarations. Désactiver un module ne supprime rien."
        source="Organisation d’OmegaX · aucun texte ne la régit"
      />
      {estAdmin ? (
        <button type="button" disabled={envoi} onClick={activer} className="bg-sel text-white rounded-full px-2.5 py-[3px] text-[11px] disabled:opacity-60">
          Activer la Paie
        </button>
      ) : (
        <span className="text-text-dim">L’administrateur du dossier peut l’activer.</span>
      )}
      {erreur && <span className="text-danger">{erreur}</span>}
    </div>
  );
}
