import type { GroupesLusLigneALigne } from '../lib/types';
import { montant as montantTotal, montantOuVide as montant } from '../lib/montants';

/**
 * LE TABLEAU DE LA BALANCE ÂGÉE, LISIBLE COMME UN TABLEAU (paquet 1, B4).
 *
 * La grille est faite de blocs posés en colonnes par le CSS · à l'œil, un
 * tableau ; pour un lecteur d'écran, une suite de textes sans en-têtes, où
 * « 1 200 000,00 » ne dit ni de quel tiers ni de quelle période il est le
 * montant. Les rôles ARIA du motif « table » (WAI-ARIA 1.2 · `table`,
 * `rowgroup`, `row`, `columnheader`, `rowheader`, `cell`) rendent la
 * structure sans toucher au rendu · deux rangées d'en-têtes (l'âge, puis la
 * période), une rangée par tiers dont la première cellule est l'en-tête de
 * rangée, les intercalaires et les totaux en rangées, chaque intercalaire
 * d'une seule cellule qui couvre toutes les colonnes (`aria-colspan`).
 * `components/TableauBalanceAgee.spec.tsx` relit le rendu et l'exige.
 */

export interface TrancheAgee {
  cle: string;
  libellePeriode: string;
  libelleAge: string;
}

export interface LigneAgee {
  cle: string;
  libelle: string;
  codeTiers: string;
  numero: string;
  montants: number[];
  solde: number;
}

export interface BalanceAgee {
  dateReference: string;
  debutExercice: string;
  type: string;
  tranches: TrancheAgee[];
  /** Ventilés · solde débiteur dans le sens normal du périmètre. */
  debiteurs: LigneAgee[];
  /** Ventilés · solde créditeur dans le sens normal (dette fournisseur, sociale, fiscale). */
  crediteurs: LigneAgee[];
  /** Non ventilés · sens contraire au périmètre. */
  sensInverse: LigneAgee[];
  /**
   * Solde nul · des pièces ouvertes qui se compensent (paquet 1, B3), en
   * aucun sens, sans tranches et hors de tout total · à lettrer.
   */
  soldesNuls: LigneAgee[];
  /** Groupes de lettrage lus ligne à ligne (paquet 1, B5). */
  groupesLusLigneALigne?: GroupesLusLigneALigne;
  totaux: {
    parTranche: number[];
    parTrancheCrediteurs: number[];
    debiteurs: number;
    crediteurs: number;
    sensInverse: number;
    net: number;
  };
  /**
   * CE QUE L'ANTÉRIORITÉ VEUT DIRE DANS CE PÉRIMÈTRE. Sur un 40 ou un 41,
   * une ligne ancienne est un délai de règlement dépassé ; sur un compte de
   * personnel, d'organismes sociaux ou d'État, il n'y a aucun crédit
   * commercial et un solde à la clôture est la situation normale. Le même
   * tableau se lirait de travers sans cette phrase.
   */
  lecture: string;
  libellePerimetre: string;
}

export function TableauBalanceAgee({ donnees }: { donnees: BalanceAgee }) {
  // La grille suit le NOMBRE de tranches renvoyé · il varie avec la longueur
  // de l'exercice (un exercice de moins de cinq mois n'a pas de bloc « reste
  // de l'exercice »), et le figer casserait l'alignement en silence.
  const nbTranches = donnees.tranches.length;
  const nbColonnes = nbTranches + 2;
  const grille = {
    display: 'grid',
    gridTemplateColumns: `minmax(220px,1fr) repeat(${nbTranches + 1}, 116px)`,
    gap: '10px',
  } as const;

  // `soldeNul` · le solde s'écrit « 0,00 » · vide, il se lirait comme une
  // absence de solde, alors que c'est la réponse.
  const ligne = (l: LigneAgee, ventile: boolean, soldeNul = false) => (
    <div
      key={l.cle}
      role="row"
      style={grille}
      className="px-3.5 py-[4px] items-center border-b border-border/50 text-[11.5px]"
    >
      <span role="rowheader" className="truncate" title={l.libelle}>
        {l.libelle}
      </span>
      {donnees.tranches.map((t, i) => (
        <span key={t.cle} role="cell" className="font-mono text-right">
          {ventile ? montant(l.montants[i] ?? 0) : ''}
        </span>
      ))}
      <span role="cell" className="font-mono text-right font-semibold">
        {soldeNul ? montantTotal(0) : montant(l.solde)}
      </span>
    </div>
  );

  // Une rangée d'une seule cellule, qui couvre toutes les colonnes.
  const rangeePleine = (texte: string, className: string) => (
    <div role="row" className={className}>
      <span role="cell" aria-colspan={nbColonnes}>
        {texte}
      </span>
    </div>
  );

  const intercalaire = (titre: string) =>
    rangeePleine(titre, 'px-3.5 py-1 text-[10.5px] italic text-text-dim bg-surface-alt border-y border-border/60');

  // Une ligne de total par population · `parTranche` nul pour les soldes en
  // sens inverse, qui n'ont pas de tranches à additionner. Un total nul se
  // dit « 0,00 » · vide, il se lirait comme une absence.
  const ligneTotal = (libelle: string, parTranche: number[] | null, total: number) => (
    <div
      role="row"
      style={grille}
      className="px-3.5 py-1.5 bg-surface-alt border-t border-border-dark text-[11.5px] font-bold"
    >
      <span role="rowheader">{libelle}</span>
      {donnees.tranches.map((t, i) => (
        <span key={t.cle} role="cell" className="font-mono text-right">
          {parTranche ? montant(parTranche[i] ?? 0) : ''}
        </span>
      ))}
      <span role="cell" className="font-mono text-right">
        {montantTotal(total)}
      </span>
    </div>
  );

  const vide =
    donnees.debiteurs.length === 0 &&
    donnees.crediteurs.length === 0 &&
    donnees.sensInverse.length === 0 &&
    donnees.soldesNuls.length === 0;

  return (
    <div role="table" aria-label={`Balance âgée · ${donnees.libellePerimetre}`} aria-colcount={nbColonnes}>
      <div role="rowgroup">
        <div role="row" style={grille} className="px-3.5 pt-1.5 text-[10.5px] italic text-text-dim border-b border-border/40">
          {/* L'âge, au-dessus de la période · la colonne des tiers et celle du
              solde n'en ont pas. */}
          <span role="columnheader" />
          {donnees.tranches.map((t) => (
            <span key={t.cle} role="columnheader" className="text-right">
              {t.libelleAge}
            </span>
          ))}
          <span role="columnheader" />
        </div>
        <div
          role="row"
          style={grille}
          className="px-3.5 py-1.5 bg-surface-alt text-[11px] font-bold text-text-dim border-b border-border-dark"
        >
          <span role="columnheader">TIERS</span>
          {donnees.tranches.map((t) => (
            <span key={t.cle} role="columnheader" className="text-right">
              {t.libellePeriode}
            </span>
          ))}
          <span role="columnheader" className="text-right">
            SOLDE
          </span>
        </div>
      </div>

      <div role="rowgroup">
        {vide &&
          rangeePleine('Aucune échéance non lettrée sur les comptes de tiers de cet exercice.', 'px-3.5 py-4 text-[11.5px] text-text-dim')}

        {donnees.debiteurs.length > 0 && (
          <>
            {(donnees.crediteurs.length > 0 || donnees.sensInverse.length > 0 || donnees.soldesNuls.length > 0) &&
              intercalaire('Soldes débiteurs')}
            {donnees.debiteurs.map((l) => ligne(l, true))}
            {ligneTotal('Total débiteurs', donnees.totaux.parTranche, donnees.totaux.debiteurs)}
          </>
        )}

        {donnees.crediteurs.length > 0 && (
          <>
            {intercalaire('Soldes créditeurs')}
            {donnees.crediteurs.map((l) => ligne(l, true))}
            {ligneTotal('Total créditeurs', donnees.totaux.parTrancheCrediteurs, donnees.totaux.crediteurs)}
          </>
        )}

        {donnees.sensInverse.length > 0 && (
          <>
            {intercalaire('Soldes en sens inverse · non ventilés par antériorité')}
            {donnees.sensInverse.map((l) => ligne(l, false))}
            {ligneTotal('Total soldes en sens inverse', null, donnees.totaux.sensInverse)}
          </>
        )}

        {/* Paquet 1, B3 · un solde nul n'est en aucun sens · à part, sans
            total, le net n'en bouge pas. */}
        {donnees.soldesNuls.length > 0 && (
          <>
            {intercalaire('Soldes nuls · pièces ouvertes qui se compensent, à lettrer')}
            {donnees.soldesNuls.map((l) => ligne(l, false, true))}
          </>
        )}

        {!vide && (
          <div
            role="row"
            style={grille}
            className="px-3.5 py-1.5 bg-surface-alt border-t border-border-dark text-[11.5px] font-bold"
          >
            <span role="rowheader">Solde net</span>
            {donnees.tranches.map((t) => (
              <span key={t.cle} role="cell" />
            ))}
            <span role="cell" className="font-mono text-right">
              {montantTotal(donnees.totaux.net)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
