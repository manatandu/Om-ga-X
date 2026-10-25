import { createContext, useContext } from 'react';

/**
 * LE LOGICIEL CHOISI, pour les écrans qui montrent des raccourcis hors de la
 * barre de menus (l'accueil). `actif` nul = aucune restriction (aucun
 * logiciel choisi, ou rendu hors du chrome) · l'accueil garde alors tout ce
 * que le menu lui sert. Même règle que la barre : un affichage, jamais un
 * droit. `changer` rappelle l'écran des logiciels ; absent quand le dossier
 * n'en sert qu'un, ou que l'utilisateur n'a pas de choix à faire.
 */
export interface LogicielActif {
  actif: string | null;
  changer: (() => void) | null;
}

const LogicielActifContexte = createContext<LogicielActif>({ actif: null, changer: null });

export const LogicielActifProvider = LogicielActifContexte.Provider;

export function useLogicielActif(): LogicielActif {
  return useContext(LogicielActifContexte);
}
