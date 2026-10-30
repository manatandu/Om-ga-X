import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { messageOuDefaut } from '../lib/message-refus';
import { etatDeLaSession, LIBELLE_ROLE_COURT, type ListeConnectes } from '../lib/messagerie';

/**
 * UTILISATEURS CONNECTÉS · Fichier > Utilisateurs connectés (ligne dossier-l9,
 * fonction 95 ; Sage, liste des utilisateurs du fichier). À l'administrateur
 * du dossier seul, comme son contrôleur · les sessions vues dans les huit
 * dernières heures, jamais un jeton. « Déconnecter » ferme toutes les
 * sessions de l'utilisateur, par la route des autorisations d'accès.
 */

function dateHeure(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function UtilisateursConnectesPage() {
  const { utilisateur, estAdmin } = useAuth();
  const [liste, setListe] = useState<ListeConnectes | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      setListe(await api.get<ListeConnectes>('/utilisateurs-connectes'));
      setMaintenant(new Date());
    } catch (e) {
      setErreur(messageOuDefaut(e, "La liste des utilisateurs connectés n'a pas pu être lue."));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function deconnecter(userId: string, email: string) {
    if (!window.confirm(`Fermer toutes les sessions de ${email} ? Il devra se reconnecter avec son mot de passe.`)) return;
    setFait(null);
    setErreur(null);
    try {
      await api.post(`/utilisateurs/${userId}/deconnecter`, {});
      setFait(`Sessions de ${email} fermées.`);
      void charger();
    } catch (e) {
      setErreur(messageOuDefaut(e, 'Déconnexion impossible.'));
    }
  }

  return (
    <div className="p-2 max-w-[1040px] text-[11.5px] flex flex-col gap-2.5">
      <section className="border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 px-3.5 pt-2.5 pb-1.5">
          <h2 className="text-[11.5px] font-bold">Sessions du dossier</h2>
          {liste && (
            <span className="text-text-dim">
              {liste.connectees} connecté{liste.connectees > 1 ? 's' : ''} sur {liste.total} session{liste.total > 1 ? 's' : ''}
            </span>
          )}
          <button type="button" onClick={() => void charger()} className="border border-border px-2 py-0.5 hover:bg-sel-soft">
            Actualiser
          </button>
          <Aide
            titre="Utilisateurs connectés"
            texte={`Une session est « connectée » quand elle a servi dans le dernier quart d'heure ; la liste montre les sessions vues dans les ${liste?.fenetreHeures ?? 8} dernières heures, ni fermées ni révoquées. Rien n'y désigne la session elle-même · ni jeton, ni adresse, ni empreinte du navigateur, un appareil résumé seulement. Une présence se retire trente et un jours après sa dernière activité. « Déconnecter » ferme toutes les sessions de l'utilisateur, comme dans les autorisations d'accès.`}
            source="Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), art. 193, 3° ; art. 194."
          />
        </div>
        {erreur && (
          <p role="alert" className="px-3.5 pb-2.5 text-danger">
            {erreur}
          </p>
        )}
        {fait && (
          <p role="status" className="px-3.5 pb-2.5 text-success">
            {fait}
          </p>
        )}
        {!liste && !erreur && <p className="px-3.5 pb-2.5 text-text-dim">Chargement…</p>}
        {liste && liste.sessions.length === 0 && <p className="px-3.5 pb-2.5 text-text-dim">Aucune session vue dans les dernières heures.</p>}
        {liste?.tronque && (
          <p className="px-3.5 pb-1.5 text-warning">
            Les {liste.sessions.length} sessions les plus récentes sont affichées.
          </p>
        )}
        {liste && liste.sessions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Utilisateur</th>
                  <th className="text-left px-2 py-1">Rôle</th>
                  <th className="text-left px-2 py-1">Appareil</th>
                  <th className="text-left px-2 py-1">Ouverte le</th>
                  <th className="text-left px-2 py-1">Dernière activité</th>
                  <th className="text-left px-2 py-1">État</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {liste.sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-2 py-1">{s.email}</td>
                    <td className="px-2 py-1">{LIBELLE_ROLE_COURT[s.role]}</td>
                    <td className="px-2 py-1">
                      {s.appareil ?? 'Non dit'}
                      {s.sessionLongue && <span className="text-text-dim"> · rester connecté</span>}
                    </td>
                    <td className="px-2 py-1">{dateHeure(s.ouverteLe)}</td>
                    <td className="px-2 py-1">{dateHeure(s.derniereActiviteLe)}</td>
                    <td className={`px-2 py-1 ${s.connectee ? 'text-success font-semibold' : 'text-text-dim'}`}>{etatDeLaSession(s, maintenant)}</td>
                    <td className="px-2 py-1 text-right">
                      {estAdmin && s.userId !== utilisateur?.id && (
                        <button type="button" onClick={() => void deconnecter(s.userId, s.email)} className="border border-border px-2 py-0.5 hover:bg-sel-soft">
                          Déconnecter
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
