import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

/**
 * /deverrouiller?jeton=… · LE LIEN DE DÉVERROUILLAGE reçu par courriel (audit
 * de sécurité du 2026-11-19, `src/modules/auth/deverrouillage.ts`). Sans
 * session · le compte est fermé. Le lien rouvre le compte, puis l'écran
 * ramène à la connexion avec l'avis. Registre de l'application (§ 9 bis),
 * aucun paragraphe explicatif.
 */
export const AVIS_COMPTE_ROUVERT = 'Votre compte est rouvert · connectez-vous avec votre mot de passe.';

export function DeverrouillagePage() {
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton') ?? '';
  const navigate = useNavigate();
  const [erreur, setErreur] = useState<string | null>(null);
  // Une seule demande · le mode strict de React rejoue l'effet, et le second
  // appel trouverait le jeton déjà consommé.
  const parti = useRef(false);

  useEffect(() => {
    if (!jeton || parti.current) return;
    parti.current = true;
    api
      .post('/auth/deverrouiller', { jeton })
      .then(() => navigate('/connexion', { replace: true, state: { avis: AVIS_COMPTE_ROUVERT } }))
      .catch((e: unknown) => setErreur(e instanceof ApiError ? e.message : 'Le serveur ne répond pas · réessayez dans un instant.'));
  }, [jeton, navigate]);

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <div className="anim-modale w-full max-w-[460px] bg-surface border border-border-dark shadow-flottante text-[11.5px]">
        <div className="h-[32px] flex items-center px-2.5 border-b border-border">Déverrouillage du compte</div>
        <div className="p-4 space-y-3">
          {!jeton && <div className="text-danger">Lien incomplet · ouvrez le lien reçu par courriel.</div>}
          {jeton && !erreur && <div role="status">Déverrouillage en cours…</div>}
          {erreur && (
            <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">
              {erreur}
            </div>
          )}
          {(erreur || !jeton) && (
            <Link to="/connexion" className="text-sel underline">
              Connexion
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
