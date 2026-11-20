import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { rouvrirLeCompte } from '../lib/deverrouillage';

/**
 * /deverrouiller?jeton=… · LE LIEN DE DÉVERROUILLAGE reçu par courriel (audit
 * de sécurité du 2026-11-19, `src/modules/auth/deverrouillage.ts`). Sans
 * session · le compte est fermé. RIEN NE PART AU CHARGEMENT (relecture du
 * 2026-11-20, E1) · un aperçu de lien ou un antivirus de messagerie aurait
 * consommé le jeton ; le bouton « Rouvrir mon compte » envoie la demande, un
 * échec se dit et le bouton reste là, et la demande s'abandonne si la
 * personne quitte la page. Registre de l'application (§ 9 bis), aucun
 * paragraphe explicatif.
 */
export const AVIS_COMPTE_ROUVERT = 'Votre compte est rouvert · connectez-vous avec votre mot de passe.';

export function DeverrouillagePage() {
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton') ?? '';
  const navigate = useNavigate();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const enCours = useRef<AbortController | null>(null);

  // La page quittée, la demande en route s'abandonne.
  useEffect(() => () => enCours.current?.abort(), []);

  const rouvrir = async () => {
    if (!jeton || envoi) return;
    const controle = new AbortController();
    enCours.current = controle;
    setErreur(null);
    setEnvoi(true);
    const issue = await rouvrirLeCompte(jeton, (chemin, corps, signal) => api.post(chemin, corps, { signal }), controle.signal);
    if (issue.etat === 'ABANDONNE') return;
    setEnvoi(false);
    if (issue.etat === 'ROUVERT') navigate('/connexion', { replace: true, state: { avis: AVIS_COMPTE_ROUVERT } });
    else setErreur(issue.message);
  };

  return (
    <main className="min-h-svh flex items-center justify-center p-4">
      <div className="anim-modale w-full max-w-[460px] bg-surface border border-border-dark shadow-flottante text-[11.5px]">
        <h1 className="h-[32px] flex items-center px-2.5 border-b border-border text-[11.5px] font-normal">Déverrouillage du compte</h1>
        <div className="p-4 space-y-3">
          {!jeton && <div className="text-danger">Lien incomplet · ouvrez le lien reçu par courriel.</div>}
          {erreur && (
            <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">
              {erreur}
            </div>
          )}
          {jeton && (
            <button
              type="button"
              onClick={() => void rouvrir()}
              disabled={envoi}
              aria-busy={envoi}
              className="bg-sel text-white rounded-full px-4 py-1.5 text-[12px] disabled:opacity-60"
            >
              {envoi ? 'Réouverture…' : 'Rouvrir mon compte'}
            </button>
          )}
          <div>
            <Link to="/connexion" className="text-sel underline">
              Connexion
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
