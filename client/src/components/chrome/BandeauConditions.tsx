import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EtatConditions } from '../../../../src/modules/conditions-licence/acceptation-conditions';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

/**
 * LES CONDITIONS DE LICENCE À ACCEPTER · une ligne sous la barre de menus,
 * pour l'administrateur du dossier seul, et seulement quand le serveur dit
 * l'acceptation ouverte et pas encore faite (`aAccepter`).
 *
 * UN RAPPEL, JAMAIS UNE PORTE · un utilisateur qui respecte ses conditions
 * « ne subit pas d'interruption de fourniture des services » (Code du
 * numérique, ordonnance-loi n° 23/10 du 13 mars 2023, art. 30, al. 3) ·
 * la ligne ne ferme rien et ne masque rien. UN ÉCHEC DE LECTURE SE DIT, en
 * une ligne (relecture, mineur 13) · masqué, il passait pour « rien à
 * accepter », la réponse favorable à la question que la ligne pose.
 */
export function BandeauConditions() {
  const { estAdmin, utilisateur } = useAuth();
  const navigate = useNavigate();
  const [aAccepter, setAAccepter] = useState(false);
  const [echec, setEchec] = useState(false);
  const tenantId = utilisateur?.tenant.id;

  useEffect(() => {
    if (!estAdmin || !tenantId) {
      setAAccepter(false);
      setEchec(false);
      return;
    }
    let vivant = true;
    const lire = () =>
      api
        .get<EtatConditions>('/conditions-licence')
        .then((e) => {
          if (!vivant) return;
          setAAccepter(e.aAccepter);
          setEchec(false);
        })
        .catch(() => {
          if (!vivant) return;
          setAAccepter(false);
          setEchec(true);
        });
    lire();
    window.addEventListener('omegax:conditions-acceptees', lire);
    return () => {
      vivant = false;
      window.removeEventListener('omegax:conditions-acceptees', lire);
    };
  }, [estAdmin, tenantId]);

  if (echec) {
    return (
      <div role="note" className="shrink-0 min-w-0 flex items-center justify-center gap-2 px-3 py-[3px] bg-sel-soft text-text border-b border-sel/30 text-[11.5px]">
        <span className="truncate">L’état de l’acceptation des conditions de licence n’a pas pu être lu.</span>
        <button type="button" onClick={() => navigate('/aide/contrat-de-licence')} className="shrink-0 text-sel underline font-semibold">
          Ouvrir le contrat
        </button>
      </div>
    );
  }
  if (!aAccepter) return null;
  return (
    <div role="note" className="shrink-0 min-w-0 flex items-center justify-center gap-2 px-3 py-[3px] bg-sel-soft text-text border-b border-sel/30 text-[11.5px]">
      <span className="truncate">Les conditions de licence en vigueur n’ont pas encore été acceptées pour ce dossier.</span>
      <button type="button" onClick={() => navigate('/aide/contrat-de-licence')} className="shrink-0 text-sel underline font-semibold">
        Lire et accepter
      </button>
    </div>
  );
}
