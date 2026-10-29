import { useEffect, useRef, type SVGProps } from 'react';
import type { CleLogiciel, LogicielDef } from '../../lib/logiciels';
import { ATTRIBUT_COUCHE_ECRAN, ecouterEchap } from '../../lib/echap';
import { Aide } from './Aide';
import {
  IconBalance,
  IconBanque,
  IconComptes,
  IconDashboard,
  IconEtats,
  IconGrille,
  IconImmo,
  IconLock,
  IconUsers,
} from './icons';

/**
 * L'ÉCRAN DES LOGICIELS · ce que l'utilisateur voit après sa connexion, et
 * qu'il rappelle depuis le bouton « Logiciels » du chrome. Une tuile par
 * logiciel que le dossier lui sert (`logicielsServis`) ; choisir une tuile
 * restreint la barre de menus à ses commandes.
 *
 * REGISTRE DE SAGE (§ 9 ter) : cartes à filet, aucun titre de page, aucune
 * phrase explicative · l'explication d'une tuile est dans sa bulle « ? ».
 * Aucune couleur d'accent hors de la charte (le survol suit `sel`).
 *
 * C'est un affichage : choisir un logiciel ne ferme aucune route, et la bulle
 * de chaque tuile le dit, pas un paragraphe.
 *
 * COUCHE SUR L'ESPACE DE TRAVAIL · des fenêtres peuvent être ouvertes dessous.
 * Elles sont `inert` (AppShell), le marqueur `ATTRIBUT_COUCHE_ECRAN` empêche
 * Échap de fermer la fenêtre cachée, et Échap ici revient au logiciel en cours.
 */
const ICONES: Record<CleLogiciel, (p: SVGProps<SVGSVGElement>) => JSX.Element> = {
  COMPTABILITE: IconComptes,
  TIERS_TRESORERIE: IconBanque,
  IMMOBILISATIONS: IconImmo,
  PAIE: IconUsers,
  REVISION_AUDIT: IconBalance,
  GESTION_COMMERCIALE: IconGrille,
  GROUPE_CONSOLIDATION: IconDashboard,
  IFRS: IconEtats,
  ADMINISTRATION: IconLock,
};

export function EcranLogiciels({
  servis,
  nonServis,
  retires,
  actif,
  onChoisir,
  onRetour,
}: {
  servis: readonly LogicielDef[];
  /** Attribués par l'administrateur mais que ce dossier ne sert pas · NOMMÉS. */
  nonServis: readonly LogicielDef[];
  /** Clés attribuées d'un logiciel retiré depuis · nommées, jamais comptées. */
  retires: readonly string[];
  /** Le logiciel en cours · mis en avant, et rendu par « Retour ». */
  actif: string | null;
  onChoisir: (cle: CleLogiciel) => void;
  /** Présent seulement quand un logiciel valide est déjà choisi. */
  onRetour?: () => void;
}) {
  // Échap revient au logiciel en cours, s'il y en a un · la touche est alors
  // prise. Sans logiciel choisi, elle ne fait rien, et le marqueur de couche
  // empêche qu'elle ferme la fenêtre cachée dessous (`echapPourLaFenetre`).
  const retour = useRef(onRetour);
  retour.current = onRetour;
  useEffect(
    () =>
      ecouterEchap(() => {
        if (!retour.current) return false;
        retour.current();
        return true;
      }),
    [],
  );

  const nonOuverts = [...nonServis.map((l) => l.libelle), ...retires.map((c) => `${c} (logiciel retiré)`)];
  return (
    <section
      aria-label="Choix du logiciel"
      {...{ [ATTRIBUT_COUCHE_ECRAN]: '' }}
      // Au-dessus des fenêtres, qui vivent dans leur propre contexte
      // d'empilement (AppShell) · leur rang ne peut jamais passer devant.
      className="absolute inset-0 z-10 overflow-auto bg-(--fenetre) p-4"
    >
      <div className="mx-auto max-w-[860px]">
        {servis.length === 0 && (
          // « Aucun » ne se dit que sur une liste LUE, et jamais à la place de
          // ce qui a bien été attribué · les logiciels attribués mais non
          // servis sont nommés juste dessous, avec la même issue.
          <div role="status" className="mb-3 max-w-[560px] border border-warning/30 bg-warning-soft px-4 py-3 text-[11.5px]">
            {nonOuverts.length === 0
              ? "Aucun logiciel de ce dossier ne vous est attribué. L'administrateur peut vous en ouvrir dans Autorisations d'accès."
              : "Aucun des logiciels qui vous sont attribués n'est servi par ce dossier. Adressez-vous à l'administrateur du dossier."}
          </div>
        )}
        {nonOuverts.length > 0 && (
          <div role="status" className="mb-3 max-w-[560px] text-[11.5px] text-text-dim">
            Attribués sans être servis par ce dossier : {nonOuverts.join(', ')}.
          </div>
        )}
        {servis.length > 0 && onRetour && (
          <button
            type="button"
            onClick={onRetour}
            className="mb-3 rounded-full border border-border-dark bg-surface px-3 py-[3px] text-[11.5px] font-semibold hover:bg-chrome-alt"
          >
            Retour
          </button>
        )}
        {servis.length > 0 && (
          <ul className="anim-cascade grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {servis.map((l, i) => {
              const Icone = ICONES[l.cle];
              const courant = l.cle === actif;
              return (
                <li key={l.cle} className="relative">
                  <button
                    type="button"
                    // Le focus va au logiciel en cours, sinon au premier · le
                    // clavier part de l'écran, jamais de la fenêtre cachée.
                    autoFocus={courant || (!actif && i === 0)}
                    aria-current={courant ? 'true' : undefined}
                    onClick={() => onChoisir(l.cle)}
                    className={`flex w-full items-center gap-3 rounded-[8px] border bg-surface px-4 py-4 pr-9 text-left text-[13px] font-semibold text-text shadow-posee hover:border-sel/40 ${
                      courant ? 'border-sel' : 'border-border'
                    }`}
                  >
                    <Icone width={22} height={22} className="shrink-0 text-sel" />
                    <span className="truncate">{l.libelle}</span>
                  </button>
                  {/* La bulle est une AUTRE commande, posée à côté du bouton · un bouton dans un bouton n'est pas valide. */}
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Aide
                      titre={l.libelle}
                      texte={`${l.aide} Choisir un logiciel ne retire aucun droit : il ne fait que ranger les commandes qui vous concernent.`}
                      source="Logiciels du dossier"
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
