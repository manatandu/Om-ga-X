import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Aide } from '../components/chrome/Aide';
import { messageOuDefaut } from '../lib/message-refus';
import { useLangue } from '../lib/langue';
import { LANGUES_INTERFACE, type LangueInterface } from '../lib/traduction';
import type { Preferences, TypeNotification } from '../lib/preferences';

/**
 * PRÉFÉRENCES · Fichier > Préférences (ligne dossier-l9, fonctions 96 et
 * 100). Les siennes seules · la langue du cadre et les notifications que
 * chacun coupe. Elles suivent le titulaire d'un poste à l'autre (tenues par
 * le serveur), et ne touchent ni le dossier ni les autres utilisateurs.
 */
export function PreferencesPage() {
  const { appliquer } = useLangue();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      setPrefs(await api.get<Preferences>('/preferences'));
    } catch (e) {
      setErreur(messageOuDefaut(e, "Vos préférences n'ont pas pu être lues."));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function regler(corps: { langue?: LangueInterface; notificationsCoupees?: TypeNotification[] }) {
    setEnvoi(true);
    setErreur(null);
    setFait(null);
    try {
      const p = await api.put<Preferences>('/preferences', corps);
      setPrefs(p);
      appliquer(p.langue);
      setFait('Préférences enregistrées.');
    } catch (e) {
      setErreur(messageOuDefaut(e, "Vos préférences n'ont pas pu être enregistrées."));
    } finally {
      setEnvoi(false);
    }
  }

  const basculer = (type: TypeNotification) => {
    if (!prefs) return;
    const coupees = prefs.notificationsCoupees.includes(type) ? prefs.notificationsCoupees.filter((t) => t !== type) : [...prefs.notificationsCoupees, type];
    void regler({ notificationsCoupees: coupees });
  };

  return (
    <div className="p-2 max-w-[720px] text-[11.5px] flex flex-col gap-2.5">
      {erreur && (
        <p role="alert" className="text-danger">
          {erreur}{' '}
          {!prefs && (
            <button type="button" onClick={() => void charger()} className="underline">
              Réessayer
            </button>
          )}
        </p>
      )}
      {fait && (
        <p role="status" className="text-success">
          {fait}
        </p>
      )}
      {!prefs && !erreur && <p className="text-text-dim">Chargement…</p>}
      {prefs && (
        <>
          {/* Le choix ne se montre que s'il y a un choix · le serveur dit les
              langues qu'il propose, et n'en admet pas d'autre. */}
          {prefs.languesProposees.length > 1 && (
            <fieldset className="border border-border bg-surface px-3.5 py-2.5 flex flex-col gap-1.5" disabled={envoi}>
              <legend className="font-bold px-1 flex items-center gap-2">
                Langue de l’interface
                <Aide
                  titre="Langue de l’interface"
                  texte="La langue choisie s'applique au cadre du logiciel · barre de menus, boutons des fenêtres, barre d'état. La comptabilité se tient en français · le plan de comptes, les libellés, les pièces, les livres, les états financiers et les messages du logiciel restent en français, quelle que soit la langue choisie."
                  source="Loi n° 23/053, art. 141, 1° ; AUDCIF art. 17, 1° ; Constitution, art. 1er."
                />
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {LANGUES_INTERFACE.filter((l) => prefs.languesProposees.includes(l.code)).map((l) => (
                  <label key={l.code} className="inline-flex items-center gap-1.5" lang={l.code === 'EN' ? 'en' : 'fr'}>
                    <input type="radio" name="langue" checked={prefs.langue === l.code} onChange={() => void regler({ langue: l.code })} />
                    {l.libelle}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="border border-border bg-surface px-3.5 py-2.5 flex flex-col gap-1.5" disabled={envoi}>
            <legend className="font-bold px-1 flex items-center gap-2">
              Notifications
              <Aide
                titre="Notifications"
                texte="Une notification dit dans le logiciel un événement du dossier qui vous concerne · un message reçu, des écritures reçues d'un autre dossier à valider, un exercice clôturé. Rien ne part hors du logiciel. Décochez un événement pour ne plus en être notifié · le réglage est le vôtre seul. Une notification lue se retire quatre-vingt-dix jours après sa lecture."
                source="Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), art. 193, 3°."
              />
            </legend>
            {prefs.types.map((t) => (
              <label key={t.type} className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={!prefs.notificationsCoupees.includes(t.type)} onChange={() => basculer(t.type)} />
                {t.libelle}
              </label>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}
