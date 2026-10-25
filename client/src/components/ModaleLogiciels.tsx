import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LOGICIELS } from '../lib/logiciels';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';

/**
 * LOGICIELS ATTRIBUÉS · l'administrateur coche les logiciels (tuiles) que
 * l'utilisateur voit après sa connexion. Décoché, tout est ouvert (les
 * utilisateurs existants ne changent pas). C'est un AFFICHAGE : le serveur
 * refuse ce que le rôle et les fonctions refusent, et rien de plus. Aucune
 * session n'est fermée · l'effet est immédiat à la prochaine lecture du
 * compte de l'intéressé.
 *
 * La liste proposée est celle de TOUS les logiciels, pas celle que le dossier
 * sert : un logiciel que le dossier ne sert pas n'apparaît de toute façon pas
 * à l'intéressé, et le cocher d'avance reste sans effet (module activé plus tard).
 */
export function ModaleLogiciels({
  utilisateurId,
  email,
  restreindre: restreindreInitial,
  logiciels: logicielsInitiaux,
  onFermer,
  onEnregistre,
}: {
  utilisateurId: string;
  email: string;
  restreindre: boolean;
  logiciels: string[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { estAdmin } = useAuth();
  const [restreindre, setRestreindre] = useState(restreindreInitial);
  const [cochees, setCochees] = useState<Set<string>>(new Set(logicielsInitiaux));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await api.put(`/utilisateurs/${utilisateurId}/logiciels`, { restreindre, logiciels: [...cochees] });
      onEnregistre();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={onFermer}>
        <div
          className="anim-modale w-[520px] max-w-full modale-bornee max-h-[calc(100dvh-2rem)] overflow-auto rounded-[4px] bg-surface border border-border-dark shadow-dominante text-[11.5px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3.5 h-[32px] border-b border-border">
            <span className="font-bold">Logiciels · {email}</span>
            <div className="flex items-center gap-2">
              <Aide
                titre="Logiciels attribués"
                texte="Choisit les logiciels (tuiles) que l'utilisateur voit après sa connexion : comptabilité, tiers et trésorerie, paie, révision, administration. Sa barre de menus se limite à ce qu'il choisit. C'est un affichage, pas un droit : les droits restent ceux de son rôle et de son profil de fonctions, et rien n'est refusé par le serveur sur ce fondement. Décoché, tous les logiciels que le dossier sert lui sont ouverts. Un administrateur n'est jamais restreint. L'effet est immédiat, aucune session n'est fermée."
                source="Règle d'OmegaX"
              />
              <button onClick={onFermer} aria-label="Fermer">
                ✕
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">{erreur}</div>}
            <label className="flex items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={restreindre} onChange={(e) => setRestreindre(e.target.checked)} />
              Restreindre aux logiciels cochés
            </label>
            <div className={restreindre ? '' : 'opacity-50'}>
              {LOGICIELS.map((l) => (
                <label key={l.cle} className="flex items-center gap-1.5 py-[2px]">
                  <input
                    type="checkbox"
                    disabled={!restreindre}
                    checked={cochees.has(l.cle)}
                    onChange={() =>
                      setCochees((prev) => {
                        const n = new Set(prev);
                        if (n.has(l.cle)) n.delete(l.cle);
                        else n.add(l.cle);
                        return n;
                      })
                    }
                  />
                  {l.libelle}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={enregistrer}
                disabled={!estAdmin || envoi}
                className="bg-sel text-white font-semibold px-4 py-1.5 disabled:opacity-40"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
