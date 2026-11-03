import { useEffect, useState } from 'react';

/**
 * UNE MÉDIA-REQUÊTE SUIVIE EN DIRECT · la fenêtre du navigateur peut changer
 * de taille (rotation d'un téléphone, redimensionnement) pendant qu'un écran
 * est ouvert, et le mode doit suivre. Une seule écriture pour la barre de
 * menus, les fenêtres et les tableaux : le capteur de largeur ne se copie pas.
 *
 * Sans `matchMedia` (jsdom), la requête vaut faux · d'où la lecture de la
 * largeur par UNE SEULE source, `useSous640` (faux sans `matchMedia`, donc le
 * bureau) et son contraire pour la barre de menus : aucun écran n'a une moitié
 * en bureau et l'autre en téléphone. Un vieux Safari (avant 14) n'a que
 * `addListener`, d'où le repli.
 */
export function useMedia(requete: string): boolean {
  const lire = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(requete).matches;
  const [vrai, setVrai] = useState(lire);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(requete);
    const suivre = () => setVrai(mq.matches);
    suivre();
    if (mq.addEventListener) mq.addEventListener('change', suivre);
    else mq.addListener?.(suivre);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', suivre);
      else mq.removeListener?.(suivre);
    };
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
