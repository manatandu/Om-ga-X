import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { entreeLexique, type CleLexique, type EntreeLexique } from '../../lib/lexique';
import { useAuth } from '../../lib/auth';
import { ecouterEchap } from '../../lib/echap';

/**
 * BULLE D'AIDE « ? ». Un petit rond posé à côté d'une notion comptable ;
 * au survol ou au clic, il déplie la définition du référentiel du dossier.
 *
 * LE RÉFÉRENTIEL SE LIT ICI, ET NULLE PART AILLEURS. Douze fenêtres sont
 * communes aux deux référentiels ; tant que la bulle prenait `LEXIQUE[sujet]`
 * en dur, chacune servait la définition SYCEBNL à une entreprise. Le choix est
 * fait dans `entreeLexique`, une fois, plutôt que dans chaque appel · un écran
 * commun n'a rien à faire de plus que poser son sujet.
 *
 * Deux usages :
 *   <Aide sujet="fondsAffectes" />              · texte pris dans le lexique
 *   <Aide titre="…" texte="…" source="…" />     · texte propre à l'écran
 *
 * La bulle est rendue dans un portail sur <body> et positionnée en
 * coordonnées écran : sinon elle serait rognée par le premier parent en
 * `overflow: hidden` venu, et les fenêtres du logiciel en sont pleines
 * (listes défilantes, volets, panneaux de fiche).
 */
export function Aide(
  props: ({ sujet: CleLexique } | EntreeLexique) & { className?: string },
) {
  const { utilisateur } = useAuth();
  const entree: EntreeLexique =
    'sujet' in props ? entreeLexique(props.sujet, utilisateur?.tenant.referentiel) : props;
  const [ouvert, setOuvert] = useState(false);
  // Épinglée = ouverte au clic. Elle ne se referme alors plus au passage de
  // la souris, seulement au second clic, à Échap ou au clic à l'extérieur ·
  // c'est ce qui permet de lire tranquillement une définition longue.
  const [epinglee, setEpinglee] = useState(false);
  const idBulle = useId();
  // Vrai le temps de rendre le focus au « ? » après Échap depuis la bulle · son
  // `onFocus` rouvrirait sinon la bulle qu'on vient de fermer.
  const retourSansOuvrir = useRef(false);
  const ancre = useRef<HTMLButtonElement>(null);
  const bulle = useRef<HTMLDivElement>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const annulerFermeture = useCallback(() => {
    if (minuterie.current) {
      clearTimeout(minuterie.current);
      minuterie.current = null;
    }
  }, []);

  // Fermeture différée : la bulle est détachée de l'ancre de quelques pixels,
  // et sans ce délai le simple trajet de la souris du « ? » vers le texte la
  // ferait disparaître avant qu'on ait pu la lire.
  const fermerBientot = useCallback(() => {
    annulerFermeture();
    minuterie.current = setTimeout(() => {
      setEpinglee((e) => {
        if (!e) setOuvert(false);
        return e;
      });
    }, 220);
  }, [annulerFermeture]);

  useEffect(() => annulerFermeture, [annulerFermeture]);

  useLayoutEffect(() => {
    if (!ouvert || !ancre.current) return;
    const r = ancre.current.getBoundingClientRect();
    const largeur = 320;
    // On garde la bulle dans la fenêtre : à gauche de l'ancre si elle
    // déborderait à droite, au-dessus si elle déborderait en bas.
    const left = Math.min(Math.max(8, r.left - 8), window.innerWidth - largeur - 8);
    const hauteurEstimee = bulle.current?.offsetHeight ?? 150;
    const dessous = r.bottom + 8;
    const top = dessous + hauteurEstimee > window.innerHeight - 8 ? Math.max(8, r.top - hauteurEstimee - 8) : dessous;
    setPos({ top, left });
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    // Échap referme la bulle, et la bulle seule (audit final F177).
    const cesserEchap = ecouterEchap(() => {
      // Échap depuis la bulle · le focus revient au « ? », il ne se perd pas.
      if (bulle.current?.contains(document.activeElement)) {
        retourSansOuvrir.current = true;
        ancre.current?.focus({ preventScroll: true });
        retourSansOuvrir.current = false;
      }
      setOuvert(false);
      setEpinglee(false);
      return true;
    });
    const surClic = (e: MouseEvent) => {
      if (!ancre.current?.contains(e.target as Node) && !bulle.current?.contains(e.target as Node)) {
        setOuvert(false);
        setEpinglee(false);
      }
    };
    // `true` : on ferme aussi sur un défilement dans un volet interne, dont
    // l'événement ne remonte pas jusqu'à window sans capture.
    const surDefilement = () => {
      setOuvert(false);
      setEpinglee(false);
    };

    document.addEventListener('mousedown', surClic);
    window.addEventListener('scroll', surDefilement, true);
    return () => {
      cesserEchap();
      document.removeEventListener('mousedown', surClic);
      window.removeEventListener('scroll', surDefilement, true);
    };
  }, [ouvert]);

  return (
    <>
      <button
        ref={ancre}
        type="button"
        aria-label={`Aide : ${entree.titre}`}
        aria-expanded={ouvert}
        // LE LIEN ENTRE LE CONTRÔLE ET LA BULLE (lot 3 du design) · la définition
        // est lue avec le bouton par un lecteur d'écran, tant que la bulle est
        // ouverte (elle s'ouvre au focus, comme au survol).
        aria-describedby={ouvert && pos ? idBulle : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          annulerFermeture();
          if (epinglee) {
            setEpinglee(false);
            setOuvert(false);
          } else {
            setEpinglee(true);
            setOuvert(true);
          }
        }}
        onMouseEnter={() => {
          annulerFermeture();
          setOuvert(true);
        }}
        onMouseLeave={fermerBientot}
        onFocus={() => {
          // Le focus qui revient du bulle (Maj+Tab) annule la fermeture armée par
          // le blur de la bulle, sinon elle se refermait sous le focus.
          annulerFermeture();
          if (!retourSansOuvrir.current) setOuvert(true);
        }}
        onBlur={fermerBientot}
        // Flèche bas · le clavier va lire (et faire défiler) une définition longue ;
        // Tab, lui, n'est pas détourné.
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && ouvert && bulle.current) {
            e.preventDefault();
            bulle.current.focus({ preventScroll: true });
          }
        }}
        className={`cible-tactile relative inline-flex items-center justify-center w-[15px] h-[15px] rounded-full border text-[11px] font-bold leading-none align-middle transition-colors shrink-0 ${
          ouvert
            ? 'bg-sel text-white border-sel'
            : 'bg-transparent text-text-dim border-border-dark hover:bg-sel-soft hover:text-sel hover:border-sel'
        } ${props.className ?? ''}`}
      >
        ?
      </button>

      {ouvert &&
        pos &&
        createPortal(
          <div
            ref={bulle}
            id={idBulle}
            // UNE RÉGION ÉTIQUETÉE, non un `tooltip` · une infobulle ne reçoit pas le
            // focus ; celle-ci le reçoit (lecture et défilement au clavier), c'est donc
            // une zone de contenu nommée, non modale, que le « ? » décrit.
            role="region"
            aria-label={entree.titre}
            // ATTEIGNABLE AU CLAVIER · une définition longue défile, et une zone
            // qui défile doit pouvoir recevoir le focus pour être lue au clavier.
            // Le focus qui passe du « ? » à la bulle ne la ferme pas.
            tabIndex={0}
            onFocus={annulerFermeture}
            onBlur={fermerBientot}
            onMouseEnter={annulerFermeture}
            onMouseLeave={fermerBientot}
            style={{ top: pos.top, left: pos.left, width: 320, maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto' }}
            className="fixed z-60 bg-surface border border-border shadow-flottante rounded-[4px] p-3.5 anim-menu focus-visible:outline-2 focus-visible:outline-(--sel)"
          >
            <div className="text-[11.5px] font-bold text-text mb-1.5">{entree.titre}</div>
            <p className="text-[11.5px] leading-[1.55] text-text-dim">{entree.texte}</p>
            <div className="mt-2.5 pt-2 border-t border-border text-[11px] text-text-dim">{entree.source}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
