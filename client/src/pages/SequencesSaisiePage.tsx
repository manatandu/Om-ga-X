import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';

/**
 * SÉQUENCES DE SAISIE (ligne sage-l1, fonction 19 · Sage 100, table
 * P_SEQUENCE) · Structure > Paramètres de saisie. Dix séquences nommées au
 * plus ; chaque modèle de saisie se range dans l'une (Modèles de saisie), et
 * la barre « Appeler un modèle » de la saisie propose les modèles d'une
 * séquence. Le serveur tient le rang, l'intitulé et le refus du retrait d'une
 * séquence qui range encore des modèles.
 */
interface SequenceSaisie {
  id: string;
  numero: number;
  intitule: string;
  nombreModeles: number;
}

/** Sage · SQ_Sequence01 à SQ_Sequence10, 35 caractères. */
const NOMBRE_MAX = 10;
const LONGUEUR_MAX = 35;

export function SequencesSaisiePage() {
  // Mêmes droits que les modèles de saisie (`@Roles` ADMIN_CABINET, COMPTABLE).
  const { peutEcrire } = useAuth();
  const [liste, setListe] = useState<SequenceSaisie[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [intitule, setIntitule] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    setListe(await api.get<SequenceSaisie[]>('/sequences-saisie'));
    setErreurLecture(null);
  };
  useEffect(() => {
    charger().catch((e) => {
      setListe(null);
      setErreurLecture(e instanceof ApiError ? e.message : "La liste des séquences n'a pas pu être lue.");
    });
  }, []);

  /** Rend vrai si le geste a abouti · un refus est affiché, et l'appelant rétablit ce qu'il montrait. */
  const agir = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setErreur(null);
    setEnvoi(true);
    try {
      await fn();
      await charger();
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Action impossible');
      return false;
    } finally {
      setEnvoi(false);
    }
  };

  const creer = (e: FormEvent) => {
    e.preventDefault();
    void agir(async () => {
      await api.post('/sequences-saisie', { intitule: intitule.trim() });
      setIntitule('');
    });
  };

  const complet = liste !== null && liste.length >= NOMBRE_MAX;

  return (
    <div className="p-2 max-w-[720px]">
      <div className="flex items-center justify-end mb-2">
        <Aide
          titre="Séquences de saisie"
          texte="Une séquence range des modèles de saisie sous un même nom (« Achats du mois », « Paie », « Clôture »). Chaque modèle se range dans une séquence depuis Modèles de saisie ; dans la saisie des journaux, la barre « Appeler un modèle » propose alors les modèles de la séquence choisie. Dix séquences au plus, de 35 caractères. Une séquence qui range encore des modèles ne se retire pas."
          source="Sage 100 · séquences de saisie (table P_SEQUENCE)"
        />
      </div>
      {erreur && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">{erreur}</div>}
      <table className="w-full text-[11.5px]">
        <thead>
          <tr>
            <th className="text-left w-[70px]">N°</th>
            <th className="text-left">Intitulé</th>
            <th className="text-right w-[110px]">Modèles rangés</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {liste?.map((q) => (
            <tr key={q.id}>
              <td className="font-semibold">{q.numero}</td>
              <td>
                {peutEcrire ? (
                  <input
                    // Remonté sur l'intitulé ENREGISTRÉ · un renommage accepté
                    // y paraît après relecture de la liste.
                    key={`${q.id}:${q.intitule}`}
                    aria-label={`Intitulé de la séquence ${q.numero}`}
                    defaultValue={q.intitule}
                    maxLength={LONGUEUR_MAX}
                    onBlur={(e) => {
                      const champ = e.currentTarget;
                      const v = champ.value.trim();
                      // UN RENOMMAGE REFUSÉ NE RESTE PAS AFFICHÉ (relecture
                      // m4) · le champ gardait l'intitulé refusé, qui se
                      // lisait comme enregistré. Vidé, il rend l'intitulé.
                      if (!v) {
                        champ.value = q.intitule;
                        return;
                      }
                      if (v === q.intitule) return;
                      void agir(() => api.patch(`/sequences-saisie/${q.id}`, { intitule: v })).then((fait) => {
                        if (!fait) champ.value = q.intitule;
                      });
                    }}
                    className="w-full border border-transparent hover:border-border px-1 py-0.5"
                  />
                ) : (
                  q.intitule
                )}
              </td>
              <td className="text-right">{q.nombreModeles}</td>
              <td className="text-right">
                {peutEcrire && (
                  <button
                    type="button"
                    disabled={envoi}
                    onClick={() => void agir(() => api.delete(`/sequences-saisie/${q.id}`))}
                    className="text-danger hover:underline disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                )}
              </td>
            </tr>
          ))}
          {erreurLecture ? (
            <tr>
              <td colSpan={4} className="text-danger">
                Liste des séquences illisible · {erreurLecture}
              </td>
            </tr>
          ) : liste === null ? (
            <tr>
              <td colSpan={4} className="italic text-text-dim">
                Chargement…
              </td>
            </tr>
          ) : (
            liste.length === 0 && (
              <tr>
                <td colSpan={4} className="italic text-text-dim">
                  Aucune séquence.
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      {peutEcrire && liste !== null && (
        <form onSubmit={creer} className="mt-2 flex gap-2 items-end">
          <input
            required
            aria-label="Intitulé de la nouvelle séquence"
            maxLength={LONGUEUR_MAX}
            value={intitule}
            disabled={complet}
            onChange={(e) => setIntitule(e.target.value)}
            placeholder={complet ? `Les ${NOMBRE_MAX} séquences sont créées` : 'Intitulé'}
            className="border border-border-dark px-2 py-1 text-[11.5px] flex-1 disabled:opacity-50"
          />
          <button type="submit" disabled={envoi || complet} className="bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold disabled:opacity-50">
            Ajouter
          </button>
        </form>
      )}
    </div>
  );
}
