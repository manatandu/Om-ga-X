import { FormEvent, useEffect, useRef } from 'react';
import { ApiError } from '../lib/api';
import { ecouterEchap } from '../lib/echap';
import { PortailModale } from './PortailModale';

/**
 * LE CADRE DES MODALES DE LA FENÊTRE FINANCEMENTS ET PLACEMENTS (ligne
 * sage-l3, fonction 47) · partagé par les opérations de trésorerie et les
 * titres de placement, porté dans le `<body>` (`PortailModale`), hauteur
 * bornée (`modale-bornee`), fermé par Échap sauf pendant l'envoi.
 */
export function useFermetureParEchap(onFermer: () => void, envoi: boolean) {
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  const envoiRef = useRef(envoi);
  envoiRef.current = envoi;
  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoiRef.current) fermerRef.current();
        return true;
      }),
    [],
  );
}

/** Un refus du serveur se dit tel quel ; une réponse perdue dit que le geste a pu passer. */
export const messageDuRefus = (err: unknown, defaut: string) =>
  err instanceof ApiError && err.status < 500 ? err.message : `${defaut} · réponse perdue, le geste a pu passer. Relisez la liste avant de le refaire.`;

export function CadreModale(p: {
  id: string;
  titre: string;
  onFermer: () => void;
  envoi: boolean;
  onSubmit?: (e: FormEvent) => void;
  enfants: React.ReactNode;
  pied: React.ReactNode;
  focus?: React.RefObject<HTMLDivElement>;
  large?: boolean;
}) {
  const Conteneur = p.onSubmit ? 'form' : 'div';
  return (
    <PortailModale>
      <div className="anim-voile ecran-seul fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <Conteneur
          ref={p.focus as React.RefObject<HTMLDivElement & HTMLFormElement> | undefined}
          tabIndex={p.focus ? -1 : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby={p.id}
          onSubmit={p.onSubmit}
          className={`anim-modale w-full ${p.large ? 'max-w-[860px]' : 'max-w-[560px]'} bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]`}
        >
          <div className="h-[32px] flex items-center px-2.5 border-b border-border">
            <span id={p.id}>{p.titre}</span>
          </div>
          <div className="p-3 space-y-2">{p.enfants}</div>
          <div className="flex justify-end gap-2 px-3 pb-3">
            <button type="button" onClick={p.onFermer} disabled={p.envoi} className="px-3 py-1 border border-border">
              Fermer
            </button>
            {p.pied}
          </div>
        </Conteneur>
      </div>
    </PortailModale>
  );
}
