import { useEffect, useState } from 'react';

/**
 * UNE MÉDIA-REQUÊTE SUIVIE EN DIRECT · la fenêtre du navigateur peut changer
 * de taille (rotation d'un téléphone, redimensionnement) pendant qu'un écran
 * est ouvert, et le mode doit suivre. Une seule écriture pour la barre de
 * menus, les fenêtres et les tableaux : le capteur de largeur ne se copie pas.
 *
 * Sans `matchMedia` (jsdom), la requête vaut faux.
 */
export function useMedia(requete: string): boolean {
  const lire = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(requete).matches;
  const [vrai, setVrai] = useState(lire);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(requete);
    const suivre = () => setVrai(mq.matches);
    suivre();
    mq.addEventListener?.('change', suivre);
    return () => mq.removeEventListener?.('change', suivre);
  }, [requete]);
  return vrai;
}

/**
 * SOUS 640 px DE LARGEUR · le seuil de `sm` de Tailwind (40 rem), de l'autre
 * côté : la barre de menus passe au volant à `min-width: 640px`, les fenêtres
 * quittent le plein écran au même seuil. Une seule borne pour tout le chrome,
 * sans quoi un écran de 640 px aurait une moitié en bureau et l'autre en
 * téléphone. Écrite en négation du `min-width` pour ne laisser aucun pixel
 * fractionnaire entre les deux.
 */
export const SOUS_640 = 'not all and (min-width: 640px)';

/** Le hook des deux : vrai quand la largeur du viewport est inférieure à 640 px. */
export const useSous640 = () => useMedia(SOUS_640);
