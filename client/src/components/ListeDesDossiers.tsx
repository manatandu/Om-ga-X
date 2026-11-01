import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  dateDuJour,
  DossierDeLaPersonne,
  exerciceLu,
  garderJetonInvitation,
  InvitationRecue,
  jetonInvitationGarde,
  LIBELLES_ACCES,
  LIBELLES_ROLES_DOSSIER,
  ListeDesDossiersDeLaPersonne,
} from '../lib/dossiers-personne';
import { entrerDansLeDossier } from '../lib/entree-dossier';

/**
 * LES DOSSIERS DE LA PERSONNE · une grille à la Sage (§ 9 ter), une ligne par
 * dossier · nom, référentiel, exercice ouvert le plus récent, rôle, accès. Un
 * clic, ou Entrée sur la ligne, entre dans le dossier. Partagée par l'écran
 * qui suit la connexion et par Fichier > Changer de dossier. Sous elle, les
 * invitations reçues, qui s'acceptent avec le code du courriel.
 *
 * Un échec de lecture se DIT (§ 9 ter, audit final F179) · une liste partie
 * de `null` ne dit jamais « aucun dossier » avant d'avoir été lue. Une liste
 * tronquée, ou un dossier qui ne se relit pas, se disent aussi.
 */
export function ListeDesDossiers({ autoFocus = false }: { autoFocus?: boolean }) {
  const { seDeconnecter } = useAuth();
  const [liste, setListe] = useState<ListeDesDossiersDeLaPersonne | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reconnecter, setReconnecter] = useState(false);
  const [entree, setEntree] = useState<string | null>(null);
  const premiere = useRef<HTMLTableRowElement | null>(null);

  const lire = () =>
    api.get<ListeDesDossiersDeLaPersonne>('/auth/mes-dossiers').then(
      (d) => setListe(d),
      (e) => setErreur(e instanceof ApiError ? e.message : 'Liste des dossiers illisible.'),
    );

  useEffect(() => {
    void lire();
  }, []);

  // Le clavier commence sur la première ligne, comme une liste de Sage.
  useEffect(() => {
    if (autoFocus && liste && liste.dossiers.length > 0) premiere.current?.focus({ preventScroll: true });
  }, [autoFocus, liste]);

  const entrer = async (d: DossierDeLaPersonne) => {
    if (entree) return;
    setErreur(null);
    setReconnecter(false);
    setEntree(d.dossierId);
    try {
      await entrerDansLeDossier(d.dossierId);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Entrée dans le dossier impossible.');
      // Les sessions de ce dossier ont été fermées · seule une reconnexion y rentre (m6).
      setReconnecter(e instanceof ApiError && e.status === 403);
      setEntree(null);
    }
  };

  const dossiers = liste?.dossiers ?? null;
  return (
    <div className="space-y-2">
      {erreur && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 flex items-center justify-between gap-2">
          <span>{erreur}</span>
          {reconnecter && (
            <button type="button" onClick={() => void seDeconnecter()} className="border border-border-dark bg-surface px-2 py-0.5 text-[11.5px] text-text">
              Se déconnecter
            </button>
          )}
        </div>
      )}
      {dossiers === null && !erreur && <div className="text-[11.5px] text-text-dim">Chargement…</div>}
      {dossiers !== null && dossiers.length === 0 && <div className="text-[11.5px] text-text-dim">Aucun dossier ne vous est ouvert.</div>}
      {dossiers !== null && dossiers.length > 0 && (
        <table className="w-full text-[11.5px] border border-border bg-surface border-collapse" aria-label="Mes dossiers">
          <thead>
            <tr className="bg-surface-alt text-left">
              <th className="px-2 py-1.5 font-semibold border-b border-border">Dossier</th>
              <th className="px-2 py-1.5 font-semibold border-b border-border">Référentiel</th>
              <th className="px-2 py-1.5 font-semibold border-b border-border">Exercice ouvert</th>
              <th className="px-2 py-1.5 font-semibold border-b border-border">Rôle</th>
              <th className="px-2 py-1.5 font-semibold border-b border-border">Accès</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((d, i) => (
              <tr
                key={d.dossierId}
                tabIndex={0}
                ref={i === 0 ? premiere : undefined}
                aria-current={d.courant ? 'true' : undefined}
                data-dossier={d.nom}
                onClick={() => void entrer(d)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void entrer(d);
                }}
                className="cursor-pointer border-b border-border hover:bg-sel-soft focus:bg-sel-soft focus:outline-hidden"
              >
                <td className="px-2 py-1.5 font-semibold">
                  {d.nom}
                  {d.courant && <span className="ml-1.5 font-normal text-text-dim">(en cours)</span>}
                  {entree === d.dossierId && <span className="ml-1.5 font-normal text-text-dim">Ouverture…</span>}
                </td>
                <td className="px-2 py-1.5">{d.referentiel}</td>
                <td className="px-2 py-1.5">{exerciceLu(d.exercice)}</td>
                <td className="px-2 py-1.5">{LIBELLES_ROLES_DOSSIER[d.role] ?? d.role}</td>
                <td className={`px-2 py-1.5 ${d.acces && d.acces !== 'NORMAL' ? 'text-warning' : ''}`} title={d.motifAcces ?? undefined}>
                  {d.acces ? LIBELLES_ACCES[d.acces] : 'Non lu'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {liste?.tronque && (
        <div className="text-[11.5px] text-warning">
          {liste.dossiers.length} dossiers montrés sur {liste.total}.
        </div>
      )}
      {liste && liste.introuvables > 0 && (
        <div className="text-[11.5px] text-warning">{liste.introuvables} dossier(s) ouvert(s) à votre nom ne se relisent pas.</div>
      )}
      <InvitationsRecues apresDecision={() => void lire()} />
    </div>
  );
}

/**
 * LES INVITATIONS REÇUES (ligne multi-dossiers) · une invitation s'accepte ou
 * se refuse avec le CODE reçu par courriel, que le lien du courriel garde
 * d'avance (`garderJetonInvitation`) · le compte seul n'y suffit pas.
 */
export function InvitationsRecues({ apresDecision }: { apresDecision: () => void }) {
  const [invitations, setInvitations] = useState<InvitationRecue[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [code, setCode] = useState(jetonInvitationGarde());
  const [envoi, setEnvoi] = useState(false);

  const lire = () =>
    api.get<InvitationRecue[]>('/auth/invitations').then(
      (l) => setInvitations(l),
      (e) => setErreur(e instanceof ApiError ? e.message : 'Invitations illisibles.'),
    );
  useEffect(() => {
    void lire();
  }, []);

  const decider = async (geste: 'accepter' | 'refuser') => {
    setErreur(null);
    setFait(null);
    setEnvoi(true);
    try {
      await api.post(`/auth/invitations/${geste}`, { jeton: code.trim() });
      garderJetonInvitation(null);
      setCode('');
      setFait(geste === 'accepter' ? 'Invitation acceptée · le dossier est dans votre liste.' : 'Invitation refusée.');
      await lire();
      apresDecision();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Décision impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  if (invitations === null && !erreur) return null;
  if (invitations !== null && invitations.length === 0 && !fait) return null;
  return (
    <div className="border border-border bg-surface p-2.5 space-y-2 text-[11.5px]" aria-label="Invitations reçues">
      <div className="font-semibold">Invitations reçues</div>
      {invitations && invitations.length > 0 && (
        <ul className="space-y-0.5">
          {invitations.map((i) => (
            <li key={i.id}>
              {i.dossier} · {LIBELLES_ROLES_DOSSIER[i.role] ?? i.role} · jusqu'au {dateDuJour(i.expireLe)}
            </li>
          ))}
        </ul>
      )}
      {invitations && invitations.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="code-invitation">Code reçu par courriel :</label>
          <input
            id="code-invitation"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border border-border-dark px-2 py-1 text-[12px] flex-1 min-w-[180px]"
            autoComplete="off"
          />
          <button type="button" disabled={envoi || code.trim().length < 20} onClick={() => void decider('accepter')} className="bg-sel text-white px-3 py-1 font-semibold disabled:opacity-50">
            Accepter
          </button>
          <button type="button" disabled={envoi || code.trim().length < 20} onClick={() => void decider('refuser')} className="border border-border-dark px-3 py-1 disabled:opacity-50">
            Refuser
          </button>
        </div>
      )}
      {fait && <div className="text-positive">{fait}</div>}
      {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">{erreur}</div>}
    </div>
  );
}
