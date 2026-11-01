import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { garderJetonInvitation, oublierLeDossierChoisi } from '../lib/dossiers-personne';

/**
 * /invitation?jeton=… · LE LIEN D'UNE INVITATION REÇUE PAR COURRIEL (ligne
 * multi-dossiers). Connectée, la personne accepte ou refuse · le jeton ET sa
 * session. Sans session · « J'ai déjà un compte » la mène à la connexion, le
 * jeton gardé pour la liste de ses dossiers ; sinon elle choisit son mot de
 * passe, et le compte naît dans le dossier qui l'a invitée. Registre de
 * l'application (§ 9 bis), aucun paragraphe explicatif.
 */
export function InvitationPage() {
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton') ?? '';
  const { connecte, utilisateur } = useAuth();
  const navigate = useNavigate();
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const decider = async (geste: 'accepter' | 'refuser') => {
    setErreur(null);
    setEnvoi(true);
    try {
      await api.post(`/auth/invitations/${geste}`, { jeton });
      garderJetonInvitation(null);
      if (geste === 'accepter') {
        // La liste des dossiers se remontre, le nouveau y figure.
        oublierLeDossierChoisi();
        window.location.hash = '#/';
        window.location.reload();
      } else setFait('Invitation refusée.');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Décision impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  const creerCompte = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe diffèrent.');
      return;
    }
    setEnvoi(true);
    try {
      const r = await api.post<{ email: string }>('/auth/invitations/creer-compte', { jeton, motDePasse });
      setFait(`Compte créé pour ${r.email} · connectez-vous.`);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Création impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  const allerALaConnexion = () => {
    garderJetonInvitation(jeton);
    navigate('/connexion');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="anim-modale w-full max-w-[460px] bg-surface border border-border-dark shadow-flottante text-[11.5px]">
        <div className="h-[32px] flex items-center px-2.5 border-b border-border">Invitation à un dossier</div>
        <div className="p-4 space-y-3">
          {!jeton && <div className="text-danger">Lien incomplet · ouvrez le lien reçu par courriel.</div>}
          {fait && (
            <div className="text-positive">
              {fait}{' '}
              {!connecte && (
                <Link to="/connexion" className="text-sel underline">
                  Connexion
                </Link>
              )}
            </div>
          )}
          {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">{erreur}</div>}
          {jeton && !fait && connecte && (
            <div className="space-y-2">
              <div className="text-text-dim">{utilisateur?.email}</div>
              <div className="flex gap-2">
                <button type="button" disabled={envoi} onClick={() => void decider('accepter')} className="bg-sel text-white px-4 py-1.5 font-semibold disabled:opacity-50">
                  Accepter l'invitation
                </button>
                <button type="button" disabled={envoi} onClick={() => void decider('refuser')} className="border border-border-dark px-4 py-1.5 disabled:opacity-50">
                  Refuser
                </button>
              </div>
            </div>
          )}
          {jeton && !fait && !connecte && (
            <>
              <button type="button" onClick={allerALaConnexion} className="border border-border-dark px-4 py-1.5">
                J'ai déjà un compte · me connecter
              </button>
              <form onSubmit={creerCompte} className="grid grid-cols-[170px_1fr] items-center gap-x-3 gap-y-2.5">
                <label htmlFor="mdp-invitation" className="text-right">Votre mot de passe :</label>
                <input
                  id="mdp-invitation"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className="border border-border-dark px-2.5 py-1.5 text-[12px]"
                />
                <label htmlFor="mdp-invitation-2" className="text-right">Confirmation :</label>
                <input
                  id="mdp-invitation-2"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="border border-border-dark px-2.5 py-1.5 text-[12px]"
                />
                <span />
                <button type="submit" disabled={envoi} className="bg-sel text-white px-4 py-1.5 font-semibold disabled:opacity-50 w-fit">
                  Créer mon compte
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
