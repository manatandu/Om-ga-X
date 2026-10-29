import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ecouterEchap } from '../lib/echap';
import { montant } from '../lib/montants';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';
import { lignesDuModele, motifRefusModeleDepuisPiece, type LigneDeLaPiece } from '../lib/modele-depuis-piece';

const LIBELLE_FONCTION = { SAISIR: 'Saisir', CALCULER: 'Calculer', EQUILIBRER: 'Équilibrer' } as const;

/**
 * CRÉER UN MODÈLE DE SAISIE DEPUIS LA PIÈCE EN COURS (ligne gl-saisie,
 * fonction 15). La pièce tapée se range en modèle par la route des modèles,
 * qui garde ses règles · la pièce elle-même n'est ni enregistrée ni vidée.
 */
export function ModaleModeleDepuisPiece({
  lignes,
  intituleSuggere,
  journal,
  numeros,
  onCree,
  onFermer,
}: {
  lignes: LigneDeLaPiece[];
  intituleSuggere: string;
  journal: { id: string; code: string };
  /** Le numéro de chaque compte de la pièce, pour l'aperçu. */
  numeros: Record<string, string>;
  onCree: (intitule: string) => void;
  onFermer: () => void;
}) {
  const { peutEcrire } = useAuth();
  const [intitule, setIntitule] = useState(intituleSuggere.slice(0, 120));
  const [ceJournal, setCeJournal] = useState(true);
  const [garderLesMontants, setGarderLesMontants] = useState(false);
  const [derniereEquilibre, setDerniereEquilibre] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);
  useEffect(() => premierChamp.current?.focus({ preventScroll: true }), []);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  const envoiRef = useRef(false);
  useEffect(
    () =>
      ecouterEchap(() => {
        // La fermeture se tient pendant l'envoi · le modèle partirait sans que l'écran le dise.
        if (envoiRef.current) return true;
        fermerRef.current();
        return true;
      }),
    [],
  );
  const proposees = lignesDuModele(lignes, { garderLesMontants, derniereEquilibre });
  const motif = motifRefusModeleDepuisPiece(intitule, lignes);

  const creer = async () => {
    if (motif || envoi || !peutEcrire) return;
    setEnvoi(true);
    envoiRef.current = true;
    setErreur(null);
    try {
      await api.post('/modeles-saisie', {
        intitule: intitule.trim(),
        ...(ceJournal ? { journalId: journal.id } : {}),
        lignes: proposees,
      });
      onCree(intitule.trim());
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Le modèle n’a pas pu être créé.');
    } finally {
      setEnvoi(false);
      envoiRef.current = false;
    }
  };

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-modele-depuis-piece"
          onSubmit={(e) => {
            e.preventDefault();
            void creer();
          }}
          className="anim-modale w-full max-w-[640px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 border-b border-border">
            <span id="titre-modele-depuis-piece">Créer un modèle depuis la pièce</span>
            <div className="flex items-center gap-2">
              <Aide
                titre="Modèle depuis la pièce"
                texte="La pièce en cours devient un modèle de saisie, appelé ensuite par F4 ou la barre « Appeler un modèle ». Chaque ligne garde son compte, son sens et son libellé. Une ligne de taxe devient « Calculer » avec son taux ; la dernière ligne qui n’est pas une taxe peut « Équilibrer » la pièce ; les autres se « Saisissent », avec leur montant seulement si vous le figez (un loyer, un abonnement). La pièce en cours n’est ni enregistrée ni vidée."
                source="Sage 100 · créer un modèle depuis la saisie"
              />
              <button
                type="button"
                onClick={() => !envoi && onFermer()}
                aria-label="Fermer"
                className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c]"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <label className="flex items-center gap-2">
              <span className="w-[120px] shrink-0">Intitulé</span>
              <input
                ref={premierChamp}
                value={intitule}
                maxLength={120}
                onChange={(e) => setIntitule(e.target.value)}
                className="flex-1 border border-border-dark px-1.5 py-1"
              />
            </label>
            <fieldset className="flex flex-wrap items-center gap-4">
              <legend className="sr-only">Journaux du modèle</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={ceJournal} onChange={() => setCeJournal(true)} />
                Ce journal ({journal.code})
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={!ceJournal} onChange={() => setCeJournal(false)} />
                Tous les journaux
              </label>
            </fieldset>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={garderLesMontants} onChange={(e) => setGarderLesMontants(e.target.checked)} />
                Figer les montants
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={derniereEquilibre} onChange={(e) => setDerniereEquilibre(e.target.checked)} />
                La dernière ligne équilibre la pièce
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className="text-left">Compte</th>
                    <th className="text-left">Sens</th>
                    <th className="text-left">Fonction</th>
                    <th className="text-left">Libellé</th>
                    <th className="text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {proposees.map((l, i) => (
                    <tr key={i}>
                      <td className="font-mono">{numeros[l.compteId] ?? ''}</td>
                      <td>{l.sens === 'DEBIT' ? 'Débit' : 'Crédit'}</td>
                      <td>{LIBELLE_FONCTION[l.fonction]}</td>
                      <td className="truncate max-w-[200px]">{l.libelle ?? ''}</td>
                      <td className="text-right font-mono">{l.montant !== undefined ? montant(l.montant) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {motif && <div className="text-warning">{motif}</div>}
            {erreur && <div className="text-danger">{erreur}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onFermer}
                disabled={envoi}
                className="border border-border-dark bg-chrome hover:bg-chrome-alt px-3 py-1 disabled:opacity-45"
              >
                Annuler
              </button>
              <button type="submit" disabled={!!motif || envoi || !peutEcrire} className="bg-sel text-white px-4 py-1 font-semibold disabled:opacity-50">
                {envoi ? 'Création…' : 'Créer le modèle'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PortailModale>
  );
}
