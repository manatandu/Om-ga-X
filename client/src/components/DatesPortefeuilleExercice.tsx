import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Aide } from './chrome/Aide';

/**
 * ENTREPRISE DU PORTEFEUILLE DE L'ÉTAT · les deux dates qui font courir les
 * délais de l'O.-L. n° 13/003 (art. 112 et 113 ; décision par la loi du
 * 2026-10-04, point 1). Déclarées, jamais supposées · sans elles, le
 * planning dit « Non calculée ». Montré sur la seule réponse « oui » du
 * dossier, que le serveur sert avec le planning.
 */
export function DatesPortefeuilleExercice({
  exerciceId,
  dateAssembleeGenerale,
  dateDepotEtatsPortefeuille,
  peutEcrire,
  apresEnregistrement,
}: {
  exerciceId: string;
  dateAssembleeGenerale: string | null;
  dateDepotEtatsPortefeuille: string | null;
  peutEcrire: boolean;
  apresEnregistrement: () => Promise<void> | void;
}) {
  const [assemblee, setAssemblee] = useState('');
  const [depot, setDepot] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Les champs suivent l'exercice et les dates servies.
  useEffect(() => {
    setAssemblee(dateAssembleeGenerale ? dateAssembleeGenerale.slice(0, 10) : '');
    setDepot(dateDepotEtatsPortefeuille ? dateDepotEtatsPortefeuille.slice(0, 10) : '');
    setErreur(null);
  }, [exerciceId, dateAssembleeGenerale, dateDepotEtatsPortefeuille]);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.post(`/exercices/${exerciceId}/dates-portefeuille`, {
        dateAssembleeGenerale: assemblee === '' ? null : assemblee,
        dateDepotEtatsPortefeuille: depot === '' ? null : depot,
      });
      await apresEnregistrement();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  const champ = 'mt-1 block border border-border-dark px-2 py-1 text-[11.5px]';
  return (
    <form onSubmit={enregistrer} className="mb-4 border border-border bg-surface px-4 py-3 max-w-[720px]">
      <div className="text-[11.5px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
        Assemblée et dépôt au ministère du Portefeuille
        <Aide
          titre="Entreprise du portefeuille de l’État"
          texte="L’assemblée générale ordinaire statuant sur l’exercice clos au 31 décembre se tient au plus tard le 31 mars, et son procès-verbal part à l’Administration des recettes non fiscales dans les dix jours. L’affectation des résultats intervient dans les soixante jours du dépôt des états financiers au ministère du Portefeuille. Ces deux dates ne sont dans aucun livre : déclarez-les pour que le planning calcule les échéances."
          source="Ordonnance-loi n° 13/003, art. 112 et 113"
        />
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Assemblée générale tenue le
          <input type="date" value={assemblee} disabled={!peutEcrire} onChange={(e) => setAssemblee(e.target.value)} className={champ} />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          États déposés au ministère le
          <input type="date" value={depot} disabled={!peutEcrire} onChange={(e) => setDepot(e.target.value)} className={champ} />
        </label>
        {peutEcrire && (
          <button type="submit" disabled={envoi} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50">
            {envoi ? '…' : 'Enregistrer'}
          </button>
        )}
      </div>
      {erreur && <div className="mt-2 text-[11.5px] text-danger">{erreur}</div>}
    </form>
  );
}
