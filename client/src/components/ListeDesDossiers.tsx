import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { DossierDeLaPersonne, exerciceLu, LIBELLES_ROLES_DOSSIER } from '../lib/dossiers-personne';
import { entrerDansLeDossier } from '../lib/entree-dossier';

/**
 * LES DOSSIERS DE LA PERSONNE · une grille à la Sage (§ 9 ter), une ligne par
 * dossier · nom, référentiel, exercice ouvert le plus récent, rôle. Un clic, ou
 * Entrée sur la ligne, entre dans le dossier. Partagée par l'écran qui suit la
 * connexion et par Fichier > Changer de dossier.
 *
 * Un échec de lecture se DIT (§ 9 ter, audit final F179) · une liste partie
 * de `null` ne dit jamais « aucun dossier » avant d'avoir été lue.
 */
export function ListeDesDossiers({ autoFocus = false }: { autoFocus?: boolean }) {
  const [dossiers, setDossiers] = useState<DossierDeLaPersonne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [entree, setEntree] = useState<string | null>(null);
  const premiere = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    let vivant = true;
    api.get<DossierDeLaPersonne[]>('/auth/mes-dossiers').then(
      (d) => vivant && setDossiers(d),
      (e) => vivant && setErreur(e instanceof ApiError ? e.message : 'Liste des dossiers illisible.'),
    );
    return () => {
      vivant = false;
    };
  }, []);

  // Le clavier commence sur la première ligne, comme une liste de Sage.
  useEffect(() => {
    if (autoFocus && dossiers && dossiers.length > 0) premiere.current?.focus({ preventScroll: true });
  }, [autoFocus, dossiers]);

  const entrer = async (d: DossierDeLaPersonne) => {
    if (entree) return;
    setErreur(null);
    setEntree(d.dossierId);
    try {
      await entrerDansLeDossier(d.dossierId);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Entrée dans le dossier impossible.');
      setEntree(null);
    }
  };

  return (
    <div className="space-y-2">
      {erreur && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">{erreur}</div>}
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
