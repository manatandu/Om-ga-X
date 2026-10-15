import { useEffect, useRef, useState } from 'react';
import { ecouterEchap } from '../lib/echap';
import { montant as fmt } from '../lib/montants';
import { libelleMode, type ModeReglement } from '../lib/modes-reglement';
import { motifEcheancesSaisies, type EcheanceSaisie } from '../lib/echeance-saisie';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';

/**
 * LA FENÊTRE DES ÉCHÉANCES (ligne sage-l2, fonction 3 · Sage, « fenêtre
 * multi-échéance »). Le modèle de règlement du tiers découpe la ligne de sa
 * facture ; la fenêtre présente le découpage proposé, chaque montant, date et
 * mode retouchables. « Appliquer » remplace la ligne par une ligne par
 * échéance, au centime ; « Garder une seule ligne » la laisse telle quelle,
 * sans échéance. Rien ne part au serveur avant l'enregistrement de la pièce.
 */
export function FenetreEcheances({
  compte,
  libelle,
  montantLigne,
  modele,
  initiales,
  modes,
  onAppliquer,
  onFermer,
}: {
  compte: string;
  libelle: string;
  montantLigne: number;
  modele: string;
  initiales: EcheanceSaisie[];
  modes: ModeReglement[];
  onAppliquer: (echeances: EcheanceSaisie[]) => void;
  onFermer: () => void;
}) {
  const [echeances, setEcheances] = useState<EcheanceSaisie[]>(initiales);
  const premierChamp = useRef<HTMLInputElement>(null);
  useEffect(() => premierChamp.current?.focus({ preventScroll: true }), []);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  useEffect(
    () =>
      ecouterEchap(() => {
        fermerRef.current();
        return true;
      }),
    [],
  );

  const motif = motifEcheancesSaisies(echeances, montantLigne);
  const changer = (i: number, champ: keyof EcheanceSaisie, valeur: string) =>
    setEcheances((prev) => prev.map((e, j) => (j === i ? { ...e, [champ]: valeur } : e)));
  const proposes = modes.filter((m) => m.estActif || echeances.some((e) => e.modeReglementId === m.id));

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-fenetre-echeances"
          onSubmit={(e) => {
            e.preventDefault();
            if (!motif) onAppliquer(echeances);
          }}
          className="anim-modale w-full max-w-[640px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 border-b border-border">
            <span id="titre-fenetre-echeances">Échéances de la ligne</span>
            <div className="flex items-center gap-2">
              <Aide
                titre="Échéances de la ligne"
                texte="Le modèle de règlement du tiers découpe la ligne de sa facture en échéances. Chaque échéance devient une ligne du même compte, au même libellé et au même sens, avec sa date et son mode · la balance âgée, l'échéancier et les relances les lisent une à une. Les montants retouchés doivent refaire la ligne au centime. « Garder une seule ligne » laisse la ligne entière, sans échéance. Sur la fiche du tiers, « Échéancier appliqué d'office » découpe sans présenter cette fenêtre."
                source="Sage 100 · fenêtre multi-échéance, validation automatique des règlements"
              />
              <button
                type="button"
                onClick={onFermer}
                aria-label="Fermer"
                className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c]"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="text-text-dim">
              {compte} · {libelle} · {fmt(montantLigne)} · modèle « {modele} »
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr>
                    <th className="text-left w-[40px]">N°</th>
                    <th className="text-right w-[150px]">Montant</th>
                    <th className="text-left w-[150px]">Échéance</th>
                    <th className="text-left">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {echeances.map((e, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <input
                          ref={i === 0 ? premierChamp : undefined}
                          aria-label={`Montant de l'échéance ${i + 1}`}
                          inputMode="decimal"
                          value={e.montant}
                          onChange={(x) => changer(i, 'montant', x.target.value)}
                          className="w-full border border-border-dark px-1.5 py-0.5 text-right"
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          aria-label={`Date de l'échéance ${i + 1}`}
                          value={e.dateEcheance}
                          onChange={(x) => changer(i, 'dateEcheance', x.target.value)}
                          className="w-full border border-border-dark px-1.5 py-0.5 font-mono"
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`Mode de l'échéance ${i + 1}`}
                          value={e.modeReglementId}
                          onChange={(x) => changer(i, 'modeReglementId', x.target.value)}
                          className="w-full border border-border-dark px-1.5 py-0.5 bg-surface"
                        >
                          <option value="">Non précisé</option>
                          {proposes.map((m) => (
                            <option key={m.id} value={m.id}>
                              {libelleMode(m)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {motif && (
              <p role="status" className="text-warning">
                {motif}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onFermer} className="border border-border-dark bg-chrome hover:bg-chrome-alt px-4 py-1.5">
                Garder une seule ligne
              </button>
              <button type="submit" disabled={!!motif} className="bg-sel text-white px-4 py-1.5 font-semibold disabled:opacity-50">
                Appliquer les échéances
              </button>
            </div>
          </div>
        </form>
      </div>
    </PortailModale>
  );
}
