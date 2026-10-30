import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { LIBELLES_ROLES, ROLES_COLLABORATEUR, nomCollaborateur, type Collaborateur, type RoleCollaborateur } from '../lib/gestion-commerciale';

const message = (e: unknown, defaut: string) => (e instanceof ApiError ? e.message : defaut);
type Liste = { total: number; tronque: boolean; collaborateurs: Collaborateur[] };
const AUCUN_ROLE = Object.fromEntries(ROLES_COLLABORATEUR.map((r) => [r, false])) as Record<RoleCollaborateur, boolean>;

/**
 * COLLABORATEURS (ligne commercial-l8, fonction 91) · Structure > Gestion
 * commerciale. Une structure de l'administrateur · les rôles nomment qui suit
 * un tiers, ils ne donnent aucun droit dans OmegaX. Les refus sont ceux du
 * serveur, affichés tels quels.
 */
export function CollaborateursPage() {
  const { estAdmin } = useAuth();
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [fonction, setFonction] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Record<RoleCollaborateur, boolean>>(AUCUN_ROLE);

  const relire = useCallback(
    () =>
      api.get<Liste>('/commercial/collaborateurs').then(
        (r) => {
          setListe(r);
          setErreurLecture(null);
        },
        (e) => setErreurLecture(message(e, 'Les collaborateurs n’ont pas pu être lus.')),
      ),
    [],
  );
  useEffect(() => {
    void relire();
  }, [relire]);

  const agir = async (fn: () => Promise<unknown>) => {
    setErreur(null);
    setEnvoi(true);
    try {
      await fn();
      await relire();
      return true;
    } catch (e) {
      setErreur(message(e, 'Le serveur n’a pas répondu.'));
      return false;
    } finally {
      setEnvoi(false);
    }
  };

  const creer = (e: FormEvent) => {
    e.preventDefault();
    void agir(() =>
      api.post('/commercial/collaborateurs', {
        nom: nom.trim(),
        ...(prenom.trim() ? { prenom: prenom.trim() } : {}),
        ...(fonction.trim() ? { fonction: fonction.trim() } : {}),
        ...(telephone.trim() ? { telephone: telephone.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...roles,
      }),
    ).then((ok) => {
      if (!ok) return;
      setNom('');
      setPrenom('');
      setFonction('');
      setTelephone('');
      setEmail('');
      setRoles(AUCUN_ROLE);
    });
  };

  return (
    <div className="p-2 max-w-[1100px] text-[11.5px]">
      <div className="flex items-center mb-2">
        <div className="flex-1" />
        <Aide
          titre="Collaborateurs"
          texte="Les personnes qui suivent les tiers du dossier, avec leurs rôles · vendeur, caissier, acheteur, contrôleur, financier, chargé de recouvrement. Un client ou un adhérent reçoit pour représentant un vendeur, un fournisseur un acheteur (Plan des tiers). Un collaborateur n’est pas un utilisateur · ses rôles ne donnent aucun droit dans le logiciel. Un rôle ne se retire pas, et un collaborateur ne se met pas en sommeil, tant qu’il représente des tiers qui l’exigent."
          source="Sage 100 · collaborateurs (F_COLLABORATEUR)"
        />
      </div>
      {erreurLecture && <div className="text-danger mb-2">{erreurLecture}</div>}
      {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">{erreur}</div>}
      {estAdmin && (
        <form onSubmit={creer} className="border border-border bg-surface p-2 mb-2 grid grid-cols-2 md:grid-cols-5 gap-2">
          <label className="flex flex-col">
            Nom
            <input required maxLength={35} value={nom} onChange={(e) => setNom(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <label className="flex flex-col">
            Prénom
            <input maxLength={35} value={prenom} onChange={(e) => setPrenom(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <label className="flex flex-col">
            Fonction
            <input maxLength={35} value={fonction} onChange={(e) => setFonction(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <label className="flex flex-col">
            Téléphone
            <input maxLength={30} value={telephone} onChange={(e) => setTelephone(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <label className="flex flex-col">
            Courriel
            <input type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <fieldset className="md:col-span-4 flex flex-wrap gap-3 items-center">
            <legend className="sr-only">Rôles</legend>
            {ROLES_COLLABORATEUR.map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input type="checkbox" checked={roles[r]} onChange={(e) => setRoles({ ...roles, [r]: e.target.checked })} />
                {LIBELLES_ROLES[r]}
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end">
            <button type="submit" disabled={envoi} className="bg-sel text-white px-4 py-1 rounded-full disabled:opacity-50">
              Créer
            </button>
          </div>
        </form>
      )}
      {liste === null && !erreurLecture && <div className="text-text-dim">Lecture des collaborateurs…</div>}
      {liste && (
        <>
          {liste.tronque && <div className="text-warning mb-1">{liste.collaborateurs.length} collaborateurs montrés sur {liste.total}.</div>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="text-left">Nom</th>
                  <th className="text-left w-[140px]">Fonction</th>
                  {ROLES_COLLABORATEUR.map((r) => (
                    <th key={r} className="text-center w-[80px]">
                      {LIBELLES_ROLES[r]}
                    </th>
                  ))}
                  <th className="text-right w-[70px]">Tiers</th>
                  <th className="text-center w-[50px]">Actif</th>
                  <th className="w-[90px]" />
                </tr>
              </thead>
              <tbody>
                {liste.collaborateurs.length === 0 && (
                  <tr>
                    <td colSpan={ROLES_COLLABORATEUR.length + 5} className="text-text-dim">
                      Aucun collaborateur dans ce dossier.
                    </td>
                  </tr>
                )}
                {liste.collaborateurs.map((c) => (
                  <tr key={c.id} className={c.actif ? '' : 'text-text-dim'}>
                    <td>
                      {nomCollaborateur(c)}
                      {(c.telephone || c.email) && <span className="block text-text-dim">{[c.telephone, c.email].filter(Boolean).join(' · ')}</span>}
                    </td>
                    <td>{c.fonction ?? '·'}</td>
                    {ROLES_COLLABORATEUR.map((r) => (
                      <td key={r} className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${LIBELLES_ROLES[r]} · ${nomCollaborateur(c)}`}
                          checked={c[r]}
                          disabled={!estAdmin || envoi}
                          onChange={(e) => void agir(() => api.patch(`/commercial/collaborateurs/${c.id}`, { [r]: e.target.checked }))}
                        />
                      </td>
                    ))}
                    <td className="text-right">{c.tiersRepresentes}</td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`${nomCollaborateur(c)} actif`}
                        checked={c.actif}
                        disabled={!estAdmin || envoi}
                        onChange={(e) => void agir(() => api.patch(`/commercial/collaborateurs/${c.id}`, { actif: e.target.checked }))}
                      />
                    </td>
                    <td className="text-right">
                      {estAdmin && (
                        <button
                          type="button"
                          disabled={envoi}
                          onClick={() => void agir(() => api.delete(`/commercial/collaborateurs/${c.id}`))}
                          className="border border-border-dark bg-chrome hover:bg-chrome-alt px-2 py-0.5 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
