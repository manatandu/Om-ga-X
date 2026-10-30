import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Aide } from '../components/chrome/Aide';
import { messageOuDefaut } from '../lib/message-refus';
import { EVENEMENT_NOTIFICATIONS, type ListeNotifications, type NotificationLue } from '../lib/preferences';

/**
 * NOTIFICATIONS · Fichier > Notifications (ligne dossier-l9, fonction 100).
 * Les siennes seules, les plus récentes d'abord, la tranche dite.
 */
function dateHeure(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [liste, setListe] = useState<ListeNotifications | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      setListe(await api.get<ListeNotifications>('/notifications'));
    } catch (e) {
      setErreur(messageOuDefaut(e, "Vos notifications n'ont pas pu être lues."));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function ouvrir(n: NotificationLue) {
    setErreur(null);
    try {
      if (!n.lueLe) await api.post(`/notifications/${n.id}/lue`, {});
      window.dispatchEvent(new Event(EVENEMENT_NOTIFICATIONS));
      if (n.lien) navigate(n.lien);
      else void charger();
    } catch (e) {
      setErreur(messageOuDefaut(e, "La notification n'a pas pu être marquée lue."));
    }
  }

  async function toutLu() {
    setErreur(null);
    try {
      await api.post('/notifications/tout-lu', {});
      window.dispatchEvent(new Event(EVENEMENT_NOTIFICATIONS));
      void charger();
    } catch (e) {
      setErreur(messageOuDefaut(e, "Les notifications n'ont pas pu être marquées lues."));
    }
  }

  return (
    <div className="p-2 max-w-[1040px] text-[11.5px] flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {liste && (
          <span className="text-text-dim">
            {liste.nonLues} non lue{liste.nonLues > 1 ? 's' : ''} sur {liste.total}
            {liste.tronque && ` · les ${liste.notifications.length} plus récentes affichées`}
          </span>
        )}
        <button type="button" onClick={() => void charger()} className="border border-border px-2 py-0.5 hover:bg-sel-soft">
          Actualiser
        </button>
        <button
          type="button"
          disabled={!liste || liste.nonLues === 0}
          onClick={() => void toutLu()}
          className="border border-border px-2 py-0.5 hover:enabled:bg-sel-soft disabled:opacity-40"
        >
          Tout marquer lu
        </button>
        <Aide
          titre="Notifications"
          texte="Les événements du dossier qui vous concernent, dits dans le logiciel seul. Ouvrir une notification la marque lue et ouvre la fenêtre où l'événement se lit. Les événements notifiés se règlent dans Fichier > Préférences. Une notification lue se retire quatre-vingt-dix jours après sa lecture."
          source="Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), art. 193, 3°."
        />
      </div>
      {erreur && (
        <p role="alert" className="text-danger">
          {erreur}
        </p>
      )}
      {!liste && !erreur && <p className="text-text-dim">Chargement…</p>}
      {liste && liste.notifications.length === 0 && <p className="text-text-dim">Aucune notification.</p>}
      {liste && liste.notifications.length > 0 && (
        <table className="w-full bg-surface">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">Reçue le</th>
              <th className="text-left px-2 py-1">Notification</th>
            </tr>
          </thead>
          <tbody>
            {liste.notifications.map((n) => (
              <tr key={n.id} className="border-t border-border">
                <td className="px-2 py-1 whitespace-nowrap">{dateHeure(n.creeeLe)}</td>
                <td className="px-2 py-1">
                  <button type="button" onClick={() => void ouvrir(n)} className={`text-left hover:underline ${n.lueLe ? 'text-text-dim' : 'font-semibold'}`}>
                    {n.titre}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
