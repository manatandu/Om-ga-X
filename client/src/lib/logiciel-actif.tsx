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
  /**
   * Les logiciels que le DOSSIER sert, attribution mise à part, vus depuis la
   * session en cours · la modale d'attribution marque d'après eux les tuiles
   * qui ne serviraient à rien. `null` = inconnu (rendu hors du chrome), et
   * alors rien n'est marqué plutôt que tout.
   */
  servisParLeDossier: readonly string[] | null;
  /** L'écran des logiciels recouvre l'espace de travail · le démarrage guidé attend qu'il se ferme. */
  ecranOuvert: boolean;
}

const LogicielActifContexte = createContext<LogicielActif>({
  actif: null,
  changer: null,
  servisParLeDossier: null,
  ecranOuvert: false,
});

export const LogicielActifProvider = LogicielActifContexte.Provider;

export function useLogicielActif(): LogicielActif {
  return useContext(LogicielActifContexte);
}
