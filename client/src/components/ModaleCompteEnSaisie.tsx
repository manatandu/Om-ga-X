import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ecouterEchap } from '../lib/echap';
import type { Compte } from '../lib/types';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';

/** Ce que le serveur dit du numéro tapé · le compte du plan qu'il subdiviserait, ou le motif qui le refuse. */
export interface PropositionCompteEnSaisie {
  numero: string;
  intitule: string;
  compteDuPlan: { numero: string; intitule: string } | null;
  motif: string | null;
}

/**
 * CRÉER UN COMPTE PENDANT LA SAISIE (ligne sage-l1, fonction 14 · option du
 * dossier). Le numéro tapé dans la grille, inconnu du plan du dossier, devient
 * un sous-compte du compte d'imputation du plan qu'il subdivise · le serveur
 * le juge (`compte-en-saisie.ts`) avant d'afficher la boîte et le rejuge à la
 * création ; son refus s'affiche tel quel, rien n'est décidé ici. Le compte
 * créé est personnalisé, et la grille le prend aussitôt.
 */
export function ModaleCompteEnSaisie({
  numeroTape,
  onFermer,
  onCree,
}: {
  numeroTape: string;
  onFermer: () => void;
  onCree: (compte: Compte) => Promise<void> | void;
}) {
  // La saisie est réservée à qui peut écrire · la boîte ne s'ouvre que pour
  // lui, et ne crée rien sans lui (le serveur tient le rôle et l'option).
  const { peutEcrire } = useAuth();
  const [numero, setNumero] = useState(numeroTape);
  const [intitule, setIntitule] = useState('');
  // null = pas encore lue ; une lecture échouée se dit, jamais lue comme un accord.
  const [proposition, setProposition] = useState<PropositionCompteEnSaisie | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const premierChamp = useRef<HTMLInputElement>(null);

  // Le numéro se rejuge à chaque frappe · une réponse périmée (numéro changé
  // depuis) est jetée.
  useEffect(() => {
    const n = numero.trim();
    let actif = true;
    setProposition(null);
    setErreurLecture(null);
    if (!/^\d{3,13}$/.test(n)) return;
    api.get<PropositionCompteEnSaisie>(`/comptes/en-saisie/proposition?numero=${encodeURIComponent(n)}`).then(
      (r) => {
        if (!actif) return;
        setProposition(r);
        // Ce que le comptable a déjà tapé n'est jamais écrasé.
        setIntitule((tape) => tape || r.intitule);
      },
      (e) => {
        if (actif) setErreurLecture(e instanceof ApiError ? e.message : 'Lecture du compte du plan impossible');
      },
    );
    return () => {
      actif = false;
    };
  }, [numero]);

  useEffect(() => premierChamp.current?.focus({ preventScroll: true }), []);
  // Échap ferme, sauf pendant l'envoi · un seul abonnement, l'état lu par références.
  const envoiRef = useRef(envoi);
  envoiRef.current = envoi;
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoiRef.current) fermerRef.current();
        return true;
      }),
    [],
  );

  const numeroLisible = /^\d{3,13}$/.test(numero.trim());
  const formulaireValide = peutEcrire && !envoi && numeroLisible && proposition !== null && proposition.motif === null && intitule.trim() !== '';

  const creer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const compte = await api.post<Compte>('/comptes/en-saisie', { numero: numero.trim(), intitule: intitule.trim() });
      await onCree(compte);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Création du compte impossible');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-compte-en-saisie"
          onSubmit={(e) => {
            e.preventDefault();
            if (formulaireValide) void creer();
          }}
          className="anim-modale w-full max-w-[480px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 border-b border-border">
            <span id="titre-compte-en-saisie">Nouveau compte</span>
            <div className="flex items-center gap-2">
              <Aide
                titre="Compte créé pendant la saisie"
                texte="Le numéro tapé ouvre un sous-compte du compte d'imputation du plan qu'il subdivise · il en reprend les réglages (lettrage, report, taxe par défaut), naît personnalisé et se saisit aussitôt. Ouvert, il subdivise le compte du plan, qui ne se saisit plus directement. Le compte d'un tiers naît avec sa fiche (Structure > Plan tiers), jamais ici."
                source="AUDCIF art. 18, al. 3 ; SYCEBNL Partie 2 ch. 2, section 1 · règle d'organisation d'OmegaX"
              />
              <button
                type="button"
                onClick={onFermer}
                disabled={envoi}
                aria-label="Fermer"
                className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c] disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-[90px_1fr] items-center gap-x-3 gap-y-2">
              <label htmlFor="numero-compte-en-saisie" className="text-right">Numéro :</label>
              <input
                id="numero-compte-en-saisie"
                ref={premierChamp}
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                aria-describedby="motif-compte-en-saisie"
                className="border border-border-dark px-2.5 py-1.5 text-[12px]"
              />
              <label htmlFor="intitule-compte-en-saisie" className="text-right">Intitulé :</label>
              <input
                id="intitule-compte-en-saisie"
                value={intitule}
                onChange={(e) => setIntitule(e.target.value)}
                className="border border-border-dark px-2.5 py-1.5 text-[12px]"
              />
              <span className="text-right text-text-dim">Sous-compte de :</span>
              <span className="px-2.5 py-1.5">
                {proposition?.compteDuPlan
                  ? `${proposition.compteDuPlan.numero} ${proposition.compteDuPlan.intitule}`
                  : numeroLisible && proposition === null && !erreurLecture
                    ? 'Lecture…'
                    : '·'}
              </span>
              <p id="motif-compte-en-saisie" role="status" className="col-span-2 text-warning">
                {!numeroLisible ? 'Le numéro se compose de 3 à 13 chiffres.' : (erreurLecture ?? proposition?.motif ?? '')}
              </p>
            </div>

            {erreur && (
              <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-1.5">
                {erreur}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onFermer}
                disabled={envoi}
                className="border border-border-dark bg-chrome hover:bg-chrome-alt px-4 py-1.5 disabled:opacity-50"
              >
                Annuler
              </button>
              <button type="submit" disabled={!formulaireValide} className="bg-sel text-white px-4 py-1.5 font-semibold disabled:opacity-50">
                {envoi ? 'Enregistrement…' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PortailModale>
  );
}
