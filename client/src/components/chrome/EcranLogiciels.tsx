import type { SVGProps } from 'react';
import type { CleLogiciel, LogicielDef } from '../../lib/logiciels';
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
 * C'est un affichage : choisir un logiciel ne ferme aucune route, et l'écran
 * le dit dans la bulle de chaque tuile, pas en paragraphe.
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
  actif,
  onChoisir,
  onRetour,
}: {
  servis: readonly LogicielDef[];
  /** Le logiciel en cours · mis en avant, et rendu par « Retour ». */
  actif: string | null;
  onChoisir: (cle: CleLogiciel) => void;
  /** Présent seulement quand un logiciel valide est déjà choisi. */
  onRetour?: () => void;
}) {
  return (
    <section
      aria-label="Choix du logiciel"
      className="absolute inset-0 z-[9999] overflow-auto bg-[var(--fenetre)] p-4"
    >
      {servis.length === 0 ? (
        // « Aucun » ne se dit que sur une liste LUE · ici la liste est lue et
        // vide, et la phrase donne la seule issue (l'administrateur).
        <div role="status" className="max-w-[520px] border border-warning/30 bg-warning-soft px-4 py-3 text-[11.5px]">
          Aucun logiciel de ce dossier ne vous est attribué. L'administrateur peut vous en ouvrir dans Autorisations d'accès.
        </div>
      ) : (
        <div className="mx-auto max-w-[860px]">
          {onRetour && (
            <button
              type="button"
              onClick={onRetour}
              className="mb-3 rounded-full border border-border-dark bg-surface px-3 py-[3px] text-[11.5px] font-semibold hover:bg-chrome-alt"
            >
              Retour
            </button>
          )}
          <ul className="anim-cascade grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {servis.map((l) => {
              const Icone = ICONES[l.cle];
              const courant = l.cle === actif;
              return (
                <li key={l.cle} className="relative">
                  <button
                    type="button"
                    autoFocus={courant}
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
                    <Aide titre={l.libelle} texte={`${l.aide} Choisir un logiciel ne retire aucun droit : il ne fait que ranger les commandes qui vous concernent.`} source="Logiciels du dossier" />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
