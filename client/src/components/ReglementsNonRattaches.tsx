import { Aide } from './chrome/Aide';
import { montant } from '../lib/montants';
import type { ReglementNonRattache } from '../lib/types';

/**
 * LES RÈGLEMENTS FOURNISSEURS DONT LA NATURE NE SE LIT PAS (cas chiffrés de
 * la clôture, constats N3 et N4). Le serveur classe le règlement d'une dette
 * fournisseur sur la ligne de la facture qu'il solde, par son lettrage ; ce
 * qui ne se rattache pas reste en « Autres dépenses sur activités » et est
 * nommé ici avec son montant, jamais deviné.
 */
export function ReglementsNonRattaches({ reglements, poste }: { reglements?: ReglementNonRattache[]; poste: string }) {
  if (!reglements || reglements.length === 0) return null;
  return (
    <div className="border border-border bg-surface px-3.5 py-2.5 mb-2">
      <div className="text-[11.5px] font-bold mb-1 flex items-center gap-1.5">
        Règlements fournisseurs laissés en {poste}
        <Aide
          titre="Règlements fournisseurs non rattachés"
          texte="Le règlement d'une dette fournisseur prend la ligne de la facture qu'il règle, lue par son lettrage (la facture d'un exercice précédent par sa ligne d'à-nouveau). Non lettré, lettré avec plusieurs factures, ou sans facture retrouvée, il reste sur cette ligne. Lettrez-le avec sa facture pour qu'il rejoigne la bonne dépense."
          source="Comptabilité de trésorerie · le fait générateur est le décaissement"
        />
      </div>
      {reglements.map((r, i) => (
        <div key={`${r.numero}-${i}`} className="flex justify-between gap-2 text-[11.5px]">
          <span>
            {r.numero} · {r.motif}
          </span>
          <span className="font-mono shrink-0">{montant(r.montant)}</span>
        </div>
      ))}
    </div>
  );
}
