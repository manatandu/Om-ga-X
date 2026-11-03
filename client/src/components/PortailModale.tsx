import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ATTRIBUT_MODALE } from '../lib/echap';
import { rangApresTab, SELECTEUR_FOCALISABLE } from '../lib/piege-focus';

/**
 * UNE MODALE SE POSE SUR L'ÉCRAN, PAS DANS LA BARRE QUI L'A OUVERTE.
 *
 * Le défaut, mesuré au navigateur avant d'être corrigé : la calculette ouverte
 * depuis la barre de menus sortait de l'écran PAR LE HAUT, sommet à -105 px,
 * là où aucune barre de défilement ne va la chercher.
 *
 * `position: fixed` ne se résout pas toujours sur la fenêtre du navigateur.
 * Un ancêtre qui porte `filter`, `backdrop-filter`, `transform`, `perspective`
 * ou `contain: paint` devient le BLOC CONTENEUR de ses descendants fixes. La
 * barre de menus porte `backdrop-blur-md` (le verre dépoli du chrome, chantier
 * de la maquette Windows 11) : `inset-0` s'y résolvait donc sur une barre de
 * 26 px au lieu de l'écran, et `items-center` centrait une calculette de
 * 302 px sur ces 26 px · 138 px passaient au-dessus du bord.
 *
 * Le dossier connaissait déjà l'autre moitié de la règle · le commentaire de
 * MenuBar note que « backdrop-blur crée un contexte d'empilement sur cette
 * barre ». C'est le même mot-clef qui crée le bloc conteneur, et c'est cette
 * moitié-là qui manquait.
 *
 * CE QUI EST REFUSÉ ICI, ET POURQUOI · retirer le flou des barres corrigerait
 * le symptôme en défaisant un parti pris de maquette, et ne protégerait de
 * rien : le prochain `transform` posé sur un ancêtre rouvrirait le même trou,
 * en silence. Le portail rend la modale INDÉPENDANTE de l'endroit d'où elle
 * est appelée, ce qui est de toute façon ce qu'une modale veut dire.
 *
 * Le `<body>` plutôt qu'un noeud dédié : il ne porte aucune de ces propriétés,
 * et n'a pas à en porter · c'est la racine de la page.
 */
export function PortailModale({ children }: { children: React.ReactNode }) {
  const enveloppe = useRef<HTMLDivElement>(null);
  const identifiant = useId();
  // LE DÉCLENCHEUR SE LIT AU RENDU, avant que la modale ne mette le focus dans un
  // de ses champs (`autoFocus` joue au montage) · lu dans l'effet, il aurait
  // retenu ce champ-là, et la fermeture n'aurait rien rendu à personne.
  const [declencheur] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  // LE CLAVIER RESTE DANS LA MODALE (lot 3 du design, 2026-11-03). Trois gestes,
  // tous posés ici pour que les cinquante modales les aient sans y toucher ·
  //  (1) à l'ouverture, le focus entre dans la modale (si elle n'y a pas déjà
  //      mis un champ), et l'élément qui l'a ouverte est retenu ;
  //  (2) Tab et Maj+Tab BOUCLENT dans la modale, et un focus sorti y rentre ;
  //  (3) à la fermeture, le focus retourne à l'élément déclencheur, s'il est
  //      encore là, jamais sur le corps de la page.
  // Échap n'est pas touché (`lib/echap.ts`, `useGardeFermeture`). Deux modales
  // empilées : seule la plus haute pilote Tab.
  useEffect(() => {
    const racine = enveloppe.current;
    if (!racine) return;
    const focalisables = (): HTMLElement[] =>
      Array.from(racine.querySelectorAll<HTMLElement>(SELECTEUR_FOCALISABLE)).filter(
        (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
      );
    const boite = (): HTMLElement | null => racine.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');

    // aria-modal et aria-labelledby, là où la modale ne les a pas posés elle-même ·
    // le titre est le premier intitulé de la boîte. Ce qu'elle a déjà dit reste.
    const dialogue = boite();
    if (dialogue) {
      if (!dialogue.hasAttribute('aria-modal')) dialogue.setAttribute('aria-modal', 'true');
      if (!dialogue.hasAttribute('aria-labelledby') && !dialogue.hasAttribute('aria-label')) {
        const titre = dialogue.querySelector<HTMLElement>('h1, h2, h3, [data-titre-modale]');
        if (titre) {
          if (!titre.id) titre.id = `${identifiant}-titre`;
          dialogue.setAttribute('aria-labelledby', titre.id);
        }
      }
    }

    if (!racine.contains(document.activeElement)) {
      const premier = focalisables()[0];
      if (premier) premier.focus({ preventScroll: true });
      else {
        const cible = boite();
        if (cible) {
          if (!cible.hasAttribute('tabindex')) cible.setAttribute('tabindex', '-1');
          cible.focus({ preventScroll: true });
        }
      }
    }

    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      const modales = document.querySelectorAll(`[${ATTRIBUT_MODALE}]`);
      if (modales[modales.length - 1] !== racine) return;
      const liste = focalisables();
      const rang = liste.indexOf(document.activeElement as HTMLElement);
      const suite = rangApresTab(liste.length, rang, e.shiftKey);
      if (suite === null) return;
      e.preventDefault();
      if (suite === -2) boite()?.focus({ preventScroll: true });
      else liste[suite].focus({ preventScroll: true });
    };
    document.addEventListener('keydown', surTouche);

    return () => {
      document.removeEventListener('keydown', surTouche);
      // Le focus ne revient que s'il est perdu (sur le corps) ou resté dans la
      // modale qui part · une fermeture qui a déjà placé le focus ailleurs gagne.
      const actif = document.activeElement;
      const perdu = !actif || actif === document.body || racine.contains(actif);
      if (perdu && declencheur && declencheur.isConnected) declencheur.focus({ preventScroll: true });
    };
  }, [identifiant, declencheur]);

  // LE MARQUEUR DIT QU'UNE MODALE EST OUVERTE (audit final F177) · Échap ne
  // ferme plus la fenêtre qui est dessous, même quand la modale ne gère pas la
  // touche elle-même. `contents` · l'enveloppe n'a aucune boîte, le voile garde
  // sa mise en page.
  return createPortal(
    <div ref={enveloppe} {...{ [ATTRIBUT_MODALE]: '' }} style={{ display: 'contents' }}>
      {children}
    </div>,
    document.body,
  );
}
