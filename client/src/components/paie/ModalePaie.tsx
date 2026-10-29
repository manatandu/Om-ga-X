import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { PortailModale } from '../PortailModale';
import { ecouterEchap } from '../../lib/echap';

/**
 * LA MODALE DES ÉCRANS DE PAIE DE LA LIGNE SAGE-L5 · portée dans le `<body>`
 * (`PortailModale`), hauteur bornée (`modale-bornee`), Échap à la couche la
 * plus haute (`ecouterEchap`), mise au point sur le premier champ sans faire
 * défiler, fermeture tenue pendant l'envoi · les règles du dépôt pour toute
 * modale, écrites une fois ici pour les écrans de la ligne.
 */
export function ModalePaie(p: {
  titre: string;
  envoi: boolean;
  onFermer: () => void;
  onValider: () => void;
  erreur?: string | null;
  children: ReactNode;
  pied: ReactNode;
}) {
  const formulaire = useRef<HTMLFormElement>(null);
  const { envoi, onFermer } = p;

  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoi) onFermer();
        return true;
      }),
    [envoi, onFermer],
  );

  useEffect(() => {
    formulaire.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')?.focus({ preventScroll: true });
  }, []);

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    if (!envoi) p.onValider();
  };

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <form
          ref={formulaire}
          role="dialog"
          aria-modal="true"
          aria-label={p.titre}
          onSubmit={soumettre}
          className="anim-modale w-full max-w-[600px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 bg-surface text-text border-b border-border text-[11.5px]">
            <span className="truncate">{p.titre}</span>
            <button
              type="button"
              aria-label="Fermer"
              disabled={envoi}
              onClick={onFermer}
              className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c]"
            >
              ✕
            </button>
          </div>
          <div className="p-4 flex flex-col gap-2.5 text-[11.5px]">
            {p.erreur && (
              <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">
                {p.erreur}
              </div>
            )}
            {p.children}
            <div className="flex flex-wrap justify-end gap-2 pt-1">{p.pied}</div>
          </div>
        </form>
      </div>
    </PortailModale>
  );
}

/** Une ligne libellé et champ, empilée sur un écran étroit. */
export function ChampPaie({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="sm:w-[190px] shrink-0 text-text-dim">{libelle}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </label>
  );
}

export const CHAMP_PAIE = 'border border-border bg-surface px-1.5 py-1 text-[11.5px] w-full focus:outline-hidden focus:border-accent';

/**
 * L'ENVOI D'UNE MODALE · un seul envoi à la fois, le refus du serveur dit tel
 * quel dans la modale, qui ne se ferme qu'une fois le geste fait.
 */
export function useEnvoiPaie(onFait: () => void) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoyer = async (fn: () => Promise<unknown>) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await fn();
      setEnvoi(false);
      onFait();
    } catch (e) {
      setEnvoi(false);
      setErreur(e instanceof ApiError ? e.message : 'Opération refusée.');
    }
  };
  return { envoi, erreur, setErreur, envoyer };
}

/** Fermer et valider, au pied d'une modale. */
export function BoutonsPaie({ envoi, onFermer, valider }: { envoi: boolean; onFermer: () => void; valider: string }) {
  return (
    <>
      <button type="button" className="border border-border px-3 py-1" disabled={envoi} onClick={onFermer}>
        Fermer
      </button>
      <button type="submit" className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-50" disabled={envoi}>
        {envoi ? 'Envoi…' : valider}
      </button>
    </>
  );
}
