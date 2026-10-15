/**
 * REDIMENSIONNER UNE FENÊTRE PAR N'IMPORTE QUEL BORD OU COIN (décision de
 * Manasse du 2026-10-15, « Tous les bords » · « comme sous Windows, et plus
 * seulement le coin en bas à droite »).
 *
 * Le calcul vit ici, hors du composant, pour se tester sans monter d'écran.
 * Deux règles qu'un essai à la main ne voit pas :
 *  · tirer un bord GAUCHE ou HAUT déplace aussi la fenêtre · le bord opposé
 *    reste fixe, sinon la fenêtre « glisse » sous la souris au lieu de
 *    s'étirer ;
 *  · la fenêtre ne sort jamais de l'espace de travail, et c'est le bord TIRÉ
 *    qui s'arrête au bord de l'espace. Laisser filer la largeur obligeait le
 *    rendu (`clamp` de la position dans `Fenetre.tsx`) à repousser toute la
 *    fenêtre, et le bord opposé bougeait sous la main.
 */

export type BordFenetre = 'n' | 's' | 'e' | 'o' | 'ne' | 'no' | 'se' | 'so';

export interface GeometrieFenetre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface LimitesFenetre {
  largeurMin: number;
  hauteurMin: number;
  largeurEspace: number;
  hauteurEspace: number;
}

/**
 * Marges de l'espace de travail, les MÊMES que le rendu d'une fenêtre
 * restaurée (`Fenetre.tsx` · `left: clamp(8px, …, 100% - 8px - largeur)`,
 * `top: clamp(0px, …, 100% - 8px - hauteur)`). Différentes, le bord tiré
 * s'arrêterait ailleurs que là où le rendu le pose.
 */
export const MARGES_ESPACE = { gauche: 8, haut: 0, droite: 8, bas: 8 } as const;

/** `v` ramené dans [lo, hi] ; si l'espace est plus petit que le minimum, le minimum l'emporte. */
function borne(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

/**
 * La géométrie d'une fenêtre après un geste de redimensionnement.
 *
 * `depart` est la géométrie RENDUE au moment du `pointerdown` (jamais la
 * géométrie stockée, que le rendu a pu borner) ; `dx` et `dy` sont les
 * déplacements du pointeur depuis ce moment.
 */
export function geometrieRedimensionnee(
  depart: GeometrieFenetre,
  bord: BordFenetre,
  dx: number,
  dy: number,
  limites: LimitesFenetre,
): GeometrieFenetre {
  let { x, y, largeur, hauteur } = depart;
  const droite = depart.x + depart.largeur;
  const bas = depart.y + depart.hauteur;

  if (bord.includes('e')) {
    largeur = borne(depart.largeur + dx, limites.largeurMin, limites.largeurEspace - MARGES_ESPACE.droite - depart.x);
  } else if (bord.includes('o')) {
    // Le bord droit reste où il est · seul le gauche suit la souris.
    x = borne(depart.x + dx, MARGES_ESPACE.gauche, droite - limites.largeurMin);
    largeur = droite - x;
  }

  if (bord.includes('s')) {
    hauteur = borne(depart.hauteur + dy, limites.hauteurMin, limites.hauteurEspace - MARGES_ESPACE.bas - depart.y);
  } else if (bord.includes('n')) {
    // Le bord bas reste où il est · seul le haut suit la souris.
    y = borne(depart.y + dy, MARGES_ESPACE.haut, bas - limites.hauteurMin);
    hauteur = bas - y;
  }

  return { x, y, largeur, hauteur };
}

/** Le curseur que Windows montre sur chaque bord et chaque coin. */
export const CURSEUR_BORD: Record<BordFenetre, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  o: 'ew-resize',
  ne: 'nesw-resize',
  so: 'nesw-resize',
  no: 'nwse-resize',
  se: 'nwse-resize',
};

/**
 * Seul le bouton principal démarre un geste de souris. Un clic droit sur un
 * bord démarrait un redimensionnement, et le menu contextuel avalait parfois
 * le `pointerup` qui devait le finir. Le doigt et le stylet n'ont pas de
 * bouton à filtrer.
 */
export function estLeBoutonPrincipal(typePointeur: string, bouton: number): boolean {
  return typePointeur !== 'mouse' || bouton === 0;
}

/** L'élément qui a capturé le pointeur, réduit à ce que le geste lui demande. */
export interface CibleDeGeste extends EventTarget {
  hasPointerCapture?(idPointeur: number): boolean;
  releasePointerCapture?(idPointeur: number): void;
}

/**
 * Suit un geste jusqu'à sa fin, quelle qu'elle soit.
 *
 * Un `pointercancel` (geste système au bord de l'écran, second doigt, boîte
 * de dialogue du système) n'est suivi d'AUCUN `pointerup` (norme Pointer
 * Events) · n'écouter que `pointerup` laissait `surMouvement` attaché, et la
 * souris qui survolait ensuite le bord rejouait l'ancien geste, la fenêtre se
 * redimensionnant sous un simple survol. `lostpointercapture`, émis après
 * `pointerup` comme après `pointercancel`, ferme tous les cas.
 *
 * Rend la fonction qui termine le geste, pour un appelant qui voudrait
 * l'arrêter lui-même.
 */
export function suivreGeste(
  cible: CibleDeGeste,
  idPointeur: number,
  surMouvement: (ev: PointerEvent) => void,
): () => void {
  const mouvement = surMouvement as unknown as EventListener;
  const finir = () => {
    cible.removeEventListener('pointermove', mouvement);
    cible.removeEventListener('pointerup', relacher);
    cible.removeEventListener('pointercancel', finir);
    cible.removeEventListener('lostpointercapture', finir);
  };
  const relacher = () => {
    if (cible.hasPointerCapture?.(idPointeur)) cible.releasePointerCapture?.(idPointeur);
    finir();
  };
  cible.addEventListener('pointermove', mouvement);
  cible.addEventListener('pointerup', relacher);
  cible.addEventListener('pointercancel', finir);
  cible.addEventListener('lostpointercapture', finir);
  return finir;
}
