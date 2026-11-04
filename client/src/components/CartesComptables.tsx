import type { ReactNode } from 'react';
import { montant, montantOuVide } from '../lib/montants';

/**
 * LES CARTES DU TÉLÉPHONE · ce que deviennent, sous 640 px, les lignes des trois
 * états à colonnes fixes (journal, grand livre, balance) de `JournalPage`.
 *
 * Reprise du design, lot 2. Sur 390 px, une grille de 840 à 1 154 px de colonnes
 * incompressibles défilait de côté sans le dire : « N° compte » coupé, Débit et
 * Crédit invisibles tant qu'on n'avait pas deviné le défilement. Chaque ligne
 * devient une CARTE qui porte les MÊMES données (rien n'est retiré, rien n'est
 * calculé ici) et les mêmes actions.
 *
 * Le bureau n'y est pour rien : la page choisit grille OU cartes par
 * `useSous640`, et une seule des deux est dans le DOM. Au-dessus de 640 px, la
 * grille est rendue exactement comme avant.
 *
 * Les montants gardent `font-mono tabular-nums whitespace-nowrap` · un montant
 * de treize chiffres entiers tient en 127 px à 11,5 px (voir GRILLE_BALANCE), il
 * ne se coupe jamais en deux lignes. Chaque cellule de montant a donc une largeur
 * d'au moins 127 px à 360 px d'écran : deux cellules par rangée, jamais trois.
 */

/**
 * Un montant de carte · jamais un libellé sans valeur : le zéro d'une colonne
 * vide sur la grille (« le zéro reste vide ») se lit « · » sur la carte, où la
 * colonne n'est pas là pour dire qu'elle est vide. Le formatage reste celui de
 * `lib/montants.ts`.
 */
const valeur = (v: number) => montantOuVide(v) || '·';

/** Une paire Débit / Crédit · deux cellules, chacune son libellé à gauche et son montant à droite. */
export function PaireDebitCredit({
  debit,
  credit,
  gras = false,
}: {
  debit: number;
  credit: number;
  gras?: boolean;
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${gras ? 'font-bold' : ''}`}>
      <div className="flex items-baseline justify-between gap-1 min-w-0">
        <span className="text-[10.5px] font-normal text-text-dim">Débit</span>
        <span className="font-mono text-[11px] tabular-nums whitespace-nowrap">{valeur(debit)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-1 min-w-0">
        <span className="text-[10.5px] font-normal text-text-dim">Crédit</span>
        <span className="font-mono text-[11px] tabular-nums whitespace-nowrap">{valeur(credit)}</span>
      </div>
    </div>
  );
}

/** Un bloc nommé d'une carte de balance (ouverture, mouvements, clôture). */
function BlocBalance({ titre, debit, credit }: { titre: string; debit: number; credit: number }) {
  return (
    <div className="mt-1">
      <div className="text-[10.5px] text-text-dim">{titre}</div>
      <PaireDebitCredit debit={debit} credit={credit} />
    </div>
  );
}

export interface DonneesCarteBalance {
  numero: string;
  intitule: string;
  /** Mention après l'intitulé, quand la ligne fond des comptes de tiers. */
  mention: string | null;
  ouverture: { debit: number; credit: number };
  mouvements: { debit: number; credit: number };
  cloture: { debit: number; credit: number };
}

/**
 * Une ligne de la balance · le compte et son intitulé en tête, puis les trois
 * couples de la balance à six colonnes, dans leur ordre de lecture. L'ACTION du
 * double-clic de la grille (ouvrir le grand livre du compte) est un BOUTON
 * « Grand livre », au toucher qui n'a pas de double-clic.
 */
export function CarteCompteBalance({
  donnees,
  titres,
  onGrandLivre,
}: {
  donnees: DonneesCarteBalance;
  titres: { ouverture: string; mouvements: string; cloture: string };
  /** Absent pour une ligne regroupée sur son collectif · elle n'a pas de grand livre à elle. */
  onGrandLivre?: () => void;
}) {
  return (
    <li className="px-3 py-2 border-b border-border/50 text-[11.5px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono font-semibold">{donnees.numero}</span>
          <div className="break-words">
            {donnees.intitule}
            {donnees.mention ? <span className="text-text-dim"> · {donnees.mention}</span> : null}
          </div>
        </div>
        {onGrandLivre && (
          <button
            type="button"
            onClick={onGrandLivre}
            title="Ouvrir le grand livre du compte"
            className="shrink-0 rounded-[3px] border border-border bg-surface px-2.5 min-h-11 text-[11.5px] font-semibold text-sel"
          >
            Grand livre
          </button>
        )}
      </div>
      <BlocBalance titre={titres.ouverture} {...donnees.ouverture} />
      <BlocBalance titre={titres.mouvements} {...donnees.mouvements} />
      <BlocBalance titre={titres.cloture} {...donnees.cloture} />
    </li>
  );
}

/** Le pied de la balance, au format des cartes. */
export function CarteTotauxBalance({
  titres,
  ouverture,
  mouvements,
  cloture,
  balanceEntiere = false,
}: {
  titres: { ouverture: string; mouvements: string; cloture: string };
  ouverture: { debit: number; credit: number };
  mouvements: { debit: number; credit: number };
  cloture: { debit: number; credit: number };
  /** Un filtre est actif · les totaux restent ceux de la balance entière, et le disent. */
  balanceEntiere?: boolean;
}) {
  return (
    <li className="px-3 py-2 bg-surface-alt border-t border-border-dark text-[11.5px] font-bold">
      <div className="text-[11px] text-text-dim">Totaux généraux{balanceEntiere ? ' (balance entière)' : ''}</div>
      <BlocBalance titre={titres.ouverture} {...ouverture} />
      <BlocBalance titre={titres.mouvements} {...mouvements} />
      <BlocBalance titre={titres.cloture} {...cloture} />
    </li>
  );
}

export interface DonneesCarteGrandLivre {
  date: string;
  journal: string;
  piece: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
  lettre: string | null;
  contrepartie: string;
}

/** Une ligne du grand livre · date, journal, pièce et lettre en tête, libellé, Débit et Crédit, solde progressif, contrepartie. */
export function CarteLigneGrandLivre({ donnees }: { donnees: DonneesCarteGrandLivre }) {
  return (
    <li className="px-3.5 py-2 border-b border-border/50 text-[11.5px]">
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono text-text-dim">
        <span>{donnees.date}</span>
        <span>{donnees.journal}</span>
        <span>pièce {donnees.piece}</span>
        {donnees.lettre ? <span>lettre {donnees.lettre}</span> : null}
      </div>
      <div className="break-words">{donnees.libelle}</div>
      <PaireDebitCredit debit={donnees.debit} credit={donnees.credit} />
      <div className="flex items-baseline justify-between gap-1 font-semibold">
        <span className="text-[10.5px] font-normal text-text-dim">Solde progr.</span>
        <span className="font-mono text-[11px] tabular-nums whitespace-nowrap">{montant(donnees.solde)}</span>
      </div>
      <div className="font-mono text-[10.5px] text-text-dim break-words">Contrepartie {donnees.contrepartie}</div>
    </li>
  );
}

/** Une ligne de repère d'un grand livre (report, total) · des `<li>`, sous le `<ul>` de la section, comme la balance. : un libellé et ses montants. */
export function CarteRepereGrandLivre({
  titre,
  debit,
  credit,
  solde,
  italique = false,
  enfant,
}: {
  titre: string;
  debit: number;
  credit: number;
  solde: number | null;
  italique?: boolean;
  enfant?: ReactNode;
}) {
  return (
    <li className={`px-3.5 py-2 border-b border-border/50 text-[11.5px] ${italique ? 'italic' : 'bg-surface-alt font-bold border-border-dark'}`}>
      <div className="text-[11px] text-text-dim">{titre}</div>
      <PaireDebitCredit debit={debit} credit={credit} />
      {solde !== null && (
        <div className="flex items-baseline justify-between gap-1 font-semibold">
          <span className="text-[10.5px] font-normal text-text-dim">Solde</span>
          <span className="font-mono text-[11px] tabular-nums whitespace-nowrap">{montant(solde)}</span>
        </div>
      )}
      {enfant}
    </li>
  );
}
