import { Suspense, memo, useCallback, useEffect, useRef } from 'react';
import type { FenetreOuverte } from '../../lib/fenetres';
import { FenetreCourante, useFenetresActions } from '../../lib/fenetres';
import { echapPourLaFenetre } from '../../lib/echap';
import { CURSEUR_BORD, estLeBoutonPrincipal, geometrieRedimensionnee, suivreGeste, type BordFenetre } from '../../lib/redimensionnement-fenetre';
import { rendreFenetre } from '../../lib/registre-fenetres';
import { LimiteErreur } from './LimiteErreur';
import { LignesSquelette } from './Squelette';

/**
 * CADRE DE FENÊTRE · la fenêtre MDI de Sage 100 i7 : une barre de titre
 * sombre quand la fenêtre est active, grise quand elle ne l'est pas, et à
 * droite les trois boutons `_ ▢ ✕` (réduire, agrandir/restaurer, fermer).
 *
 * Ce qui vient de Sage, et pourquoi :
 *  · double-clic sur la barre de titre = agrandir/restaurer. C'est le geste
 *    Windows, celui que la main fait sans y penser ;
 *  · la fenêtre se déplace par sa barre de titre, et seulement par elle ·
 *    la déplacer par son contenu rendrait toute sélection de texte pénible ;
 *  · chaque bord et chaque coin redimensionne la fenêtre, le curseur de
 *    Windows le dit (décision de Manasse du 2026-10-15, « Tous les bords »,
 *    `lib/redimensionnement-fenetre.ts`) · tirer le bord gauche ou haut
 *    déplace aussi la fenêtre, le bord opposé restant fixe ;
 *  · un clic n'importe où dans la fenêtre la ramène au premier plan.
 *
 * Le déplacement et le redimensionnement passent par la CAPTURE DE POINTEUR
 * plutôt que par des écouteurs sur `window` : le navigateur continue alors
 * de livrer les événements même si le curseur sort de la fenêtre ou passe
 * au-dessus d'un cadre voisin · sans quoi la fenêtre « décroche » dès qu'on
 * bouge vite, défaut classique des implémentations naïves.
 */

/** 32 px · la barre de titre d'une application Windows 11. */
const HAUTEUR_TITRE = 32;
const MARGE_MIN_VISIBLE = 90; // px de barre de titre toujours attrapables
const LARGEUR_MIN = 380;
const HAUTEUR_MIN = 220;
/**
 * Marge conservée autour d'une fenêtre AGRANDIE.
 *
 * Une fenêtre agrandie collée aux bords se soudait visuellement à la barre
 * d'outils : sa barre de titre sombre, pleine largeur et sans bordure,
 * ressemblait à une seconde barre de l'application, pas au haut d'une
 * fenêtre. On ne voyait plus où le logiciel s'arrête et où la fenêtre
 * commence. La marge (avec le coin arrondi et l'ombre qu'elle rend visibles)
 * fait que la fenêtre s'ARRÊTE, nettement, sous la rangée d'icônes · c'est
 * ce que montre Sage, dont la fenêtre agrandie reste une fenêtre.
 */
const MARGE_AGRANDIE = 8;

/**
 * Les huit zones de redimensionnement · bandes le long des bords, carrés de
 * 10 px aux coins, posés APRÈS les bandes pour les recouvrir (un coin attrapé
 * doit étirer les deux axes). Le coin bas droit garde sa marque visible, les
 * autres zones ne se voient qu'au curseur, comme sous Windows.
 *
 * Les bandes droite et basse sont posées SUR LA BORDURE (`-right-px`,
 * `-bottom-px`, 4 px dont 3 utiles sous le cadre) · plus larges, elles
 * prenaient la moitié du pouce des barres de défilement du contenu (barre
 * de 10 px, pouce visible de 3 px centré à 5 px du bord, `index.css`), et
 * viser le pouce d'un grand livre étirait la fenêtre une fois sur deux.
 *
 * Sous 640 px, seul le coin bas droit reste · une fenêtre y tient déjà
 * toute la largeur (`LARGEUR_MIN` dépasse l'espace), et des bandes de 5 px
 * en `touch-action: none` aux bords de l'écran avalaient les glissés du
 * doigt sans rien changer.
 */
const POIGNEES: { bord: BordFenetre; place: string }[] = [
  { bord: 'n', place: 'hidden sm:block top-0 left-2.5 right-2.5 h-[5px]' },
  { bord: 's', place: 'hidden sm:block -bottom-px left-2.5 right-2.5 h-[4px]' },
  { bord: 'o', place: 'hidden sm:block left-0 top-2.5 bottom-2.5 w-[5px]' },
  { bord: 'e', place: 'hidden sm:block -right-px top-2.5 bottom-2.5 w-[4px]' },
  { bord: 'no', place: 'hidden sm:block top-0 left-0 w-2.5 h-2.5' },
  { bord: 'ne', place: 'hidden sm:block top-0 right-0 w-2.5 h-2.5' },
  { bord: 'so', place: 'hidden sm:block bottom-0 left-0 w-2.5 h-2.5' },
  { bord: 'se', place: 'bottom-0 right-0 w-4 h-4' },
];

/**
 * memo · pendant un déplacement/redimensionnement, chaque pointermove met à
 * jour le cadre d'UNE fenêtre dans le contexte : sans memo, TOUTES les
 * fenêtres ouvertes re-rendaient à chaque mouvement de souris (props
 * inchangées pour elles · l'objet `fenetre` garde la même référence).
 */
export const Fenetre = memo(FenetreInterne);

function FenetreInterne({ fenetre, active }: { fenetre: FenetreOuverte; active: boolean }) {
  const { activer, fermer, reduire, basculerAgrandissement, deplacer } = useFenetresActions();
  const refCadre = useRef<HTMLDivElement>(null);

  const agrandie = fenetre.etat === 'agrandie';

  /**
   * Un geste = un point de départ figé (position du pointeur ET du cadre au
   * moment du `pointerdown`), puis des deltas. Lire la position courante du
   * cadre à chaque `pointermove` ferait dériver la fenêtre, chaque image
   * cumulant l'erreur de la précédente.
   */
  const demarrerGeste = useCallback(
    (e: React.PointerEvent, mode: 'deplacer' | BordFenetre) => {
      // Le bouton principal seul · un clic droit sur un bord démarrait un
      // geste dont le menu contextuel avalait parfois le `pointerup`.
      if (!estLeBoutonPrincipal(e.pointerType, e.button)) return;
      if (agrandie && mode === 'deplacer') return; // une fenêtre plein écran ne se déplace pas
      e.preventDefault();
      const cible = e.currentTarget as HTMLElement;
      cible.setPointerCapture(e.pointerId);
      const departX = e.clientX;
      const departY = e.clientY;
      const depart = { ...fenetre.cadre };
      // Le redimensionnement part de la géométrie RENDUE, pas de la stockée ·
      // le rendu borne taille et position à l'espace de travail, et partir
      // d'un cadre plus grand que ce qu'on voit faisait sauter la fenêtre au
      // premier mouvement.
      const el = refCadre.current;
      const departRendu = el
        ? { x: el.offsetLeft, y: el.offsetTop, largeur: el.offsetWidth, hauteur: el.offsetHeight }
        : depart;
      const espace = el?.parentElement;
      const largeurEspace = espace?.clientWidth ?? window.innerWidth;
      const hauteurEspace = espace?.clientHeight ?? window.innerHeight;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - departX;
        const dy = ev.clientY - departY;
        if (mode === 'deplacer') {
          deplacer(fenetre.cle, {
            // On borne la position pour qu'il reste TOUJOURS de quoi
            // rattraper la fenêtre : poussée hors de l'espace de travail,
            // elle deviendrait inatteignable à la souris.
            x: Math.min(Math.max(depart.x + dx, MARGE_MIN_VISIBLE - depart.largeur), largeurEspace - MARGE_MIN_VISIBLE),
            y: Math.min(Math.max(depart.y + dy, 0), hauteurEspace - HAUTEUR_TITRE),
          });
        } else {
          deplacer(
            fenetre.cle,
            geometrieRedimensionnee(departRendu, mode, dx, dy, {
              largeurMin: LARGEUR_MIN,
              hauteurMin: HAUTEUR_MIN,
              largeurEspace,
              hauteurEspace,
            }),
          );
        }
      };
      // La fin du geste est GARANTIE · un `pointercancel` (geste système au
      // bord de l'écran, second doigt) n'est suivi d'aucun `pointerup`, et
      // l'écouteur restait attaché · la souris qui survolait ensuite le bord
      // rejouait l'ancien geste. Voir `suivreGeste`.
      suivreGeste(cible, e.pointerId, onMove);
    },
    [agrandie, deplacer, fenetre.cadre, fenetre.cle],
  );

  // Échap ferme la fenêtre ACTIVE · réflexe Windows, et seule façon de
  // refermer au clavier une fenêtre ouverte par mégarde. Seulement une touche
  // que ni un menu, ni une bulle, ni une modale n'a prise (audit final F177) ·
  // voir `lib/echap.ts`. La fermeture passe par la garde de la fenêtre.
  useEffect(() => {
    if (!active) return;
    const onTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      // Jamais pendant une saisie : Échap y sert à annuler le champ.
      const dansUnChamp =
        cible instanceof HTMLElement &&
        (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.tagName === 'SELECT' || cible.isContentEditable);
      if (echapPourLaFenetre(e) && !dansUnChamp) fermer(fenetre.cle);
    };
    document.addEventListener('keydown', onTouche);
    return () => document.removeEventListener('keydown', onTouche);
  }, [active, fermer, fenetre.cle]);

  if (fenetre.etat === 'reduite') return null;

  const style: React.CSSProperties = agrandie
    ? { inset: MARGE_AGRANDIE, zIndex: fenetre.ordre }
    : (() => {
        // Le gabarit par défaut (940×560) peut dépasser un petit espace de
        // travail : le cadre est borné à la TAILLE de l'espace (jamais à ce
        // qui reste à droite de sa position · garer une fenêtre contre un
        // bord, geste MDI voulu, ne doit pas la rétrécir).
        const largeur = `min(${fenetre.cadre.largeur}px, calc(100% - 16px))`;
        // Hauteur bornée par les MÊMES marges que la position (0 en haut,
        // 8 en bas, `MARGES_ESPACE`) · bornée à 16, une fenêtre tirée par le
        // haut jusqu'au bord remontait son bas de 8 px.
        const hauteur = `min(${fenetre.cadre.hauteur}px, calc(100% - 8px))`;
        return {
          // La POSITION doit être bornée elle aussi, et pas seulement la
          // taille. À 360 px, une fenêtre restaurée gardait son `x` de
          // bureau : rétrécie à la largeur de l'espace mais posée à 48 px du
          // bord, elle sortait de l'écran par la droite · ses boutons
          // Réduire / Agrandir / Fermer devenaient inatteignables, sans
          // aucun moyen de la rattraper puisqu'on ne peut pas la saisir par
          // une barre de titre qu'on ne voit pas.
          //
          // `clamp(a, v, b)` vaut `max(a, min(v, b))` par définition : si
          // l'espace est si étroit que la borne haute passe sous 8 px, le
          // cadre se cale à 8 px au lieu de produire une valeur absurde.
          left: `clamp(8px, ${fenetre.cadre.x}px, calc(100% - 8px - ${largeur}))`,
          top: `clamp(0px, ${fenetre.cadre.y}px, calc(100% - 8px - ${hauteur}))`,
          width: largeur,
          height: hauteur,
          zIndex: fenetre.ordre,
        };
      })();

  return (
    <div
      ref={refCadre}
      onPointerDown={() => !active && activer(fenetre.cle)}
      style={style}
      // UNE FENÊTRE INACTIVE NE S'IMPRIME PAS · sans cela, « Imprimer » sortait
      // aussi toutes les fenêtres ouvertes derrière celle qu'on regardait.
      className={`${fenetre.enFermeture ? 'anim-fenetre-sortie pointer-events-none' : 'anim-fenetre'} absolute flex flex-col overflow-hidden rounded-[4px] border bg-surface ${active ? '' : 'fenetre-inactive'} ${
        active ? 'border-border-dark shadow-dominante' : 'border-border shadow-posee'
      }`}
    >
      {/* --- Barre de titre ------------------------------------------------ */}
      <div
        onPointerDown={(e) => demarrerGeste(e, 'deplacer')}
        onDoubleClick={() => basculerAgrandissement(fenetre.cle)}
        // `touch-action: none` · sans lui, le doigt qui tire la barre fait
        // défiler la page et le navigateur annule le geste.
        style={{ height: HAUTEUR_TITRE, touchAction: 'none' }}
        /*
          BARRE DE TITRE CLAIRE, À LA WINDOWS 11 (2026-09-23). Elle était un
          bandeau bleu nuit, celui de Sage et de Windows 7 · c'est ce qui
          faisait dire « le design est un peu vieux ». Windows 11 distingue la
          fenêtre active autrement : son titre et ses boutons sont en encre
          pleine, ceux des autres fenêtres s'éteignent, et son ombre est plus
          profonde. La distinction demeure, elle change seulement de forme.
        */
        className={`shrink-0 flex items-center justify-between gap-2 pl-3.5 select-none border-b border-border transition-colors duration-150 ${
          agrandie ? '' : 'cursor-move'
        } ${active ? 'bg-(--bandeau) text-white' : 'bg-chrome text-text-dim'}`}
      >
        <span className="truncate text-[12px] font-semibold">{fenetre.titre}</span>
        <span className="flex items-stretch self-stretch shrink-0">
          <BoutonTitre
            actif={active}
            titre="Réduire"
            onClick={() => reduire(fenetre.cle)}
            dessin={<rect x="3.5" y="8" width="9" height="1.4" rx="0.7" />}
          />
          <BoutonTitre
            actif={active}
            titre={agrandie ? 'Restaurer' : 'Agrandir'}
            onClick={() => basculerAgrandissement(fenetre.cle)}
            dessin={
              agrandie ? (
                <>
                  <rect x="3" y="5.4" width="7.2" height="7.2" rx="1.2" fill="none" strokeWidth="1.3" stroke="currentColor" />
                  <path d="M5.6 5.4V4.2A1.2 1.2 0 0 1 6.8 3h5.4A1.2 1.2 0 0 1 13.4 4.2v5.4a1.2 1.2 0 0 1-1.2 1.2H11" fill="none" strokeWidth="1.3" stroke="currentColor" />
                </>
              ) : (
                <rect x="3.4" y="3.4" width="9.2" height="9.2" rx="1.3" fill="none" strokeWidth="1.3" stroke="currentColor" />
              )
            }
          />
          <BoutonTitre
            actif={active}
            titre="Fermer"
            danger
            onClick={() => fermer(fenetre.cle)}
            dessin={
              <path d="M4 4l8 8M12 4l-8 8" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" />
            }
          />
        </span>
      </div>

      {/* --- Contenu -------------------------------------------------------- */}
      <div className="flex-1 min-h-0 overflow-auto bg-(--fenetre)">
        <LimiteErreur titreFenetre={fenetre.titre}>
          {/* La clé porte le compteur d'Actualiser : l'incrémenter remonte le
              contenu, qui recharge ses données · le F5 de Sage.
              Les pages sont chargées à la demande (registre-fenetres, lazy) :
              le temps du transfert de son module, la fenêtre montre la forme
              des lignes à venir (squelette) et dit « Chargement… » au lecteur
              d'écran seul · un mot gris au milieu du vide ne dit pas quoi. */}
          <FenetreCourante.Provider value={fenetre.cle}>
            <Suspense
              key={fenetre.version}
              fallback={
                <div className="p-3" aria-busy="true">
                  <LignesSquelette lignes={4} />
                  <div className="sr-only">Chargement…</div>
                </div>
              }
            >
              {rendreFenetre(fenetre.adresse)}
            </Suspense>
          </FenetreCourante.Provider>
        </LimiteErreur>
      </div>

      {/* --- Bords et coins de redimensionnement ---------------------------- */}
      {!agrandie &&
        POIGNEES.map(({ bord, place }) => (
          <div
            key={bord}
            aria-hidden="true"
            onPointerDown={(e) => demarrerGeste(e, bord)}
            // `touch-action: none` · sans lui, le doigt fait défiler la page
            // au lieu d'étirer la fenêtre.
            style={{ cursor: CURSEUR_BORD[bord], touchAction: 'none' }}
            // Au-dessus des en-têtes collantes du contenu (z-10), qui
            // couvraient sinon la bande gauche et la bande droite.
            className={`absolute z-25 ${place}`}
          >
            {bord === 'se' && (
              <svg viewBox="0 0 16 16" className="w-full h-full text-border-dark">
                <path d="M15 7L7 15M15 11l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              </svg>
            )}
          </div>
        ))}
    </div>
  );
}

function BoutonTitre({
  titre,
  onClick,
  dessin,
  actif,
  danger = false,
}: {
  titre: string;
  onClick: () => void;
  dessin: React.ReactNode;
  actif: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      // `stopPropagation` sur le pointeur : sans lui, appuyer sur « Fermer »
      // amorcerait aussi le déplacement de la fenêtre par sa barre de titre.
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={onClick}
      // 46 px de large sur toute la hauteur de la barre, sans arrondi : les
      // boutons de légende de Windows 11. Fermer vire au rouge système au
      // survol, les deux autres à un gris léger.
      className={`flex items-center justify-center w-[46px] transition-colors duration-100 ${
        danger ? 'hover:bg-[#c42b1c] hover:text-white' : actif ? 'hover:bg-white/10' : 'hover:bg-chrome-alt'
      } ${actif ? 'text-white' : 'text-text-dim'}`}
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
        {dessin}
      </svg>
    </button>
  );
}
