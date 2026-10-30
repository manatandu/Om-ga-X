import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { traduire, type LangueInterface } from './traduction';
import type { Preferences } from './preferences';

/**
 * LA LANGUE DU CADRE, pour toute la session (ligne dossier-l9, fonction 96).
 * Lue sur les préférences du titulaire, tenues par le serveur · elles le
 * suivent d'un poste à l'autre. Tant qu'elles ne sont pas lues, ou si leur
 * lecture échoue, le français · c'est la langue de l'application, jamais un
 * repli trompeur (voir traduction.ts).
 */
interface ContexteLangue {
  langue: LangueInterface;
  tr: (texte: string) => string;
  /** Après un réglage enregistré par la fenêtre des préférences. */
  appliquer: (langue: LangueInterface) => void;
}

const Contexte = createContext<ContexteLangue>({
  langue: 'FR',
  tr: (t) => t,
  appliquer: () => undefined,
});

export function LangueProvider({ children }: { children: ReactNode }) {
  const { utilisateur } = useAuth();
  const [langue, setLangue] = useState<LangueInterface>('FR');
  const id = utilisateur?.id ?? null;

  useEffect(() => {
    setLangue('FR');
    if (!id) return;
    let vivant = true;
    api.get<Preferences>('/preferences').then(
      (p) => vivant && setLangue(p.langue === 'EN' && p.languesProposees.includes('EN') ? 'EN' : 'FR'),
      // Silence VOULU · le cadre reste en français, la langue de l'application ;
      // la fenêtre des préférences, elle, dit l'échec de sa lecture.
      () => undefined,
    );
    return () => {
      vivant = false;
    };
  }, [id]);

  const tr = useCallback((texte: string) => traduire(texte, langue), [langue]);
  const valeur = useMemo(() => ({ langue, tr, appliquer: setLangue }), [langue, tr]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useLangue(): ContexteLangue {
  return useContext(Contexte);
}
