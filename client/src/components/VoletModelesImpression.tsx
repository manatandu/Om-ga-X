import { useAuth } from '../lib/auth';
import { Aide } from './chrome/Aide';
import type { Tiers } from '../lib/types';
import {
  LIBELLES_NATURE_MODELE,
  NATURES_MODELE,
  OU_SERT_LE_MODELE,
  ZONE_DU_TIERS,
  modelesDeLaNature,
  type ModeleImpression,
} from '../lib/modeles-impression';

type Zone = (typeof ZONE_DU_TIERS)[keyof typeof ZONE_DU_TIERS];

/**
 * Volet « Modèles d'impression » de la fiche d'un tiers (ligne sage-l2,
 * fonction 27 · Sage, volet de la fiche, F_COMPTETMODELE) · un modèle par
 * document, choisi parmi ceux de sa nature. Lu par tous ; choisi par
 * l'administrateur seul, comme le reste de la structure du tiers. Le serveur
 * refuse un modèle d'une autre nature ou d'un autre dossier, et l'écran dit
 * son refus (`onChanger` le rend à la fiche).
 *
 * LA LISTE EST LUE UNE FOIS PAR LA FENÊTRE (second tour de relecture, mineur
 * 13) · le volet la relisait à chaque tiers choisi ; non lue, un modèle choisi
 * se dit « modèle non lu », jamais « modèle introuvable ».
 */
export function VoletModelesImpression({
  tiers,
  modeles,
  erreur,
  onChanger,
}: {
  tiers: Tiers;
  /** Null tant que la fenêtre ne l'a pas lue · son échec vient avec `erreur`. */
  modeles: ModeleImpression[] | null;
  erreur: string | null;
  onChanger: (donnees: Partial<Record<Zone, string | null>>) => Promise<unknown>;
}) {
  const { estAdmin } = useAuth();
  const nomDuModele = (id: string | null | undefined) =>
    id ? (modeles ? (modeles.find((m) => m.id === id)?.intitule ?? 'modèle introuvable') : 'modèle non lu') : 'aucun';

  return (
    <div className="border-t border-border pt-2.5 mb-3">
      <div className="text-[11px] font-bold text-text-dim mb-1.5 flex items-center gap-1.5">
        Modèles d'impression
        <Aide
          titre="Modèles d'impression du tiers"
          texte={`Le modèle choisi habille le document que ce tiers reçoit, sans le remplacer. ${NATURES_MODELE.map((n) => `${LIBELLES_NATURE_MODELE[n]} · ${OU_SERT_LE_MODELE[n]}`).join(' ')} Sans modèle, le document part tel qu'OmegaX le compose. Les modèles se créent dans Structure, Paramètres de saisie, Modèles d'impression.`}
          source="Sage 100 i7, plan tiers · modèles d'impression"
        />
      </div>
      {erreur && (
        <div role="alert" className="text-[11px] text-danger mb-1.5">
          Modèles d'impression illisibles · {erreur}
        </div>
      )}
      <div className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 items-center text-[11.5px]">
        {NATURES_MODELE.map((n) => {
          const zone = ZONE_DU_TIERS[n];
          const choisi = tiers[zone] ?? null;
          const proposes = modeles ? modelesDeLaNature(modeles, n) : [];
          return (
            <div key={n} className="contents">
              <span className="text-text-dim text-right">{LIBELLES_NATURE_MODELE[n]} :</span>
              {estAdmin && modeles ? (
                <select
                  aria-label={`Modèle ${LIBELLES_NATURE_MODELE[n].toLowerCase()} du tiers`}
                  value={choisi ?? ''}
                  onChange={(e) => void onChanger({ [zone]: e.target.value || null })}
                  className="border border-border px-1.5 py-0.5 bg-surface min-w-0"
                >
                  <option value="">{proposes.length ? 'Aucun modèle' : "Aucun modèle de ce document dans le dossier"}</option>
                  {proposes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.intitule}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{modeles === null && !erreur ? 'Lecture…' : nomDuModele(choisi)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
