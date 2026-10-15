import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from './chrome/Aide';
import { criteresRappeles, type EditionSelection, type ListeSelections, type SelectionServie } from '../lib/selections-edition';

/**
 * LES SÉLECTIONS ENREGISTRÉES D'UNE ÉDITION (ligne sage-l7, fonction 59) · les
 * critères de l'écran gardés sous un nom, au DOSSIER (décision de la ligne,
 * `selections-edition.ts` au serveur), et rappelés d'un choix. Rappeler est
 * une lecture ; enregistrer, remplacer et supprimer suivent `peutEcrire`,
 * comme le serveur (lecture seule refusée).
 *
 * L'écran passe ses critères tels qu'ils sont et reçoit ceux de la sélection
 * au rappel · il les pose sur ses valeurs VIDES, si bien qu'un critère absent
 * de la sélection revient à « aucun », jamais à ce qui était tapé avant.
 */
export function SelectionsEnregistrees({
  edition,
  criteres,
  onRappel,
}: {
  edition: EditionSelection;
  criteres: Record<string, unknown>;
  onRappel: (criteres: Record<string, string | boolean>) => void;
}) {
  const { peutEcrire } = useAuth();
  const [liste, setListe] = useState<ListeSelections | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [choisie, setChoisie] = useState('');
  const [nom, setNom] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      setListe(await api.get<ListeSelections>(`/selections-edition?edition=${edition}`));
      setErreurLecture(null);
    } catch (e) {
      setErreurLecture(e instanceof ApiError ? e.message : "Les sélections enregistrées n'ont pas pu être lues.");
    }
  }, [edition]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  function rappeler(id: string) {
    setChoisie(id);
    setErreur(null);
    setInfo(null);
    const s = liste?.selections.find((x) => x.id === id);
    if (!s) return;
    const { criteres: rappeles, avertissement } = criteresRappeles(s);
    if (avertissement) setInfo(avertissement);
    onRappel(rappeles);
  }

  const homonyme: SelectionServie | undefined = nom !== null ? liste?.selections.find((s) => s.nom === nom.trim()) : undefined;

  async function enregistrer() {
    if (nom === null) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      if (homonyme) {
        await api.put(`/selections-edition/${homonyme.id}`, { criteres });
        setInfo(`Sélection « ${homonyme.nom} » remplacée.`);
        setChoisie(homonyme.id);
      } else {
        const creee = await api.post<{ id: string; nom: string }>('/selections-edition', { edition, nom: nom.trim(), criteres });
        setInfo(`Sélection « ${creee.nom} » enregistrée.`);
        setChoisie(creee.id);
      }
      setNom(null);
      await recharger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "La sélection n'a pas pu être enregistrée.");
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer() {
    const s = liste?.selections.find((x) => x.id === choisie);
    if (!s) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.delete(`/selections-edition/${s.id}`);
      setInfo(`Sélection « ${s.nom} » supprimée.`);
      setChoisie('');
      await recharger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "La sélection n'a pas pu être supprimée.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-text-dim">Sélection enregistrée</span>
          <select
            value={choisie}
            onChange={(e) => rappeler(e.target.value)}
            disabled={!liste || liste.selections.length === 0}
            className="border border-border bg-surface px-2 py-1 text-[11.5px] min-w-[180px]"
          >
            <option value="">{liste === null ? 'Lecture…' : liste.selections.length === 0 ? 'Aucune sélection' : 'Choisir…'}</option>
            {liste?.selections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </label>
        {peutEcrire && nom === null && (
          <button
            type="button"
            onClick={() => setNom(liste?.selections.find((s) => s.id === choisie)?.nom ?? '')}
            className="border border-border bg-surface px-3 py-1.5 text-[11.5px] font-bold hover:bg-chrome"
          >
            Enregistrer la sélection…
          </button>
        )}
        {peutEcrire && nom === null && choisie && (
          <button
            type="button"
            onClick={() => void supprimer()}
            disabled={envoi}
            className="border border-border bg-surface px-3 py-1.5 text-[11.5px] font-bold text-danger hover:bg-chrome disabled:opacity-40"
          >
            Supprimer la sélection
          </button>
        )}
        {peutEcrire && nom !== null && (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-text-dim">Nom de la sélection</span>
              <input
                autoFocus
                value={nom}
                maxLength={60}
                onChange={(e) => setNom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nom.trim()) void enregistrer();
                }}
                className="border border-border bg-surface px-2 py-1 text-[11.5px] min-w-[200px]"
              />
            </label>
            <button
              type="button"
              onClick={() => void enregistrer()}
              disabled={envoi || !nom.trim()}
              className="bg-sel text-white px-3 py-1.5 text-[11.5px] font-bold disabled:opacity-40"
            >
              {homonyme ? `Remplacer « ${homonyme.nom} »` : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => setNom(null)}
              disabled={envoi}
              className="border border-border bg-surface px-3 py-1.5 text-[11.5px] font-bold hover:bg-chrome"
            >
              Annuler
            </button>
          </>
        )}
        <Aide
          titre="Sélections enregistrées"
          texte="Les critères de l'écran gardés sous un nom, puis rappelés d'un choix. Elles sont gardées au dossier, partagées par ses utilisateurs et sur tous les postes · une sélection nomme des objets du dossier (un journal, des dates). Elles ne gardent pas l'exercice · une sélection se rappelle sur l'exercice choisi. Un journal retiré depuis l'enregistrement est signalé au rappel."
          source="OmegaX"
        />
      </div>
      {erreurLecture && (
        <p role="alert" className="text-[11.5px] text-danger">
          {erreurLecture}
        </p>
      )}
      {liste?.tronque && (
        <p className="text-[11.5px] text-warning">
          Les {liste.selections.length} premières sélections sur {liste.total} sont proposées.
        </p>
      )}
      {erreur && (
        <p role="alert" className="text-[11.5px] text-danger">
          {erreur}
        </p>
      )}
      {info && (
        <p role="status" className="text-[11.5px] text-text-dim">
          {info}
        </p>
      )}
    </div>
  );
}
