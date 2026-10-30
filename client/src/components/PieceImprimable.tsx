import type { ReactNode } from 'react';
import type { MentionsRecopiees } from '../lib/mentions-piece';
import { montant } from '../lib/montants';

/**
 * LA PIÈCE REMISE AU CLIENT · facture de vente et devis émis par le dossier.
 *
 * L'en-tête vient de ce que la pièce a RECOPIÉ à sa date (AUSCGIE art. 17 ·
 * dénomination « précédée ou suivie immédiatement » de la forme, du capital,
 * du siège et du RCCM, sur tout document destiné aux tiers). Jamais du
 * dossier d'aujourd'hui · un capital augmenté ne réécrit pas la facture de
 * l'an dernier. Une pièce établie avant la recopie le DIT au lieu de
 * reprendre les mentions du jour.
 */
export function BlocEmetteur({
  mentions,
  nomRepli,
  complement,
}: {
  mentions: MentionsRecopiees | null;
  /** Le nom déjà recopié par la pièce (la facture le porte à part). */
  nomRepli: string;
  complement?: ReactNode;
}) {
  return (
    <div>
      <div className="font-bold uppercase">{mentions?.denomination ?? nomRepli}</div>
      {mentions?.ligne && <div>{mentions.ligne}</div>}
      {complement}
    </div>
  );
}

const fmt = (n: number | null | undefined) => montant(n, '');

export type LigneImprimee = {
  designation: string;
  quantite: number | null;
  prixUnitaire: number | null;
  montantHT: number | null;
  tauxApplique?: number | null;
  montantTva?: number | null;
  imposable?: boolean;
  /** La remise portée sur la pièce, en pour cent (ligne commercial-l8) · le montant HT en est déjà net. */
  remisePourcent?: number | null;
};

/** Le tableau des lignes · colonnes de TVA seulement quand la pièce en porte. */
export function TableauLignes({ lignes, avecTva }: { lignes: LigneImprimee[]; avecTva: boolean }) {
  const cellule = 'border border-black px-1.5 py-1';
  // LA REMISE FIGURE SUR LA PIÈCE dès qu'une ligne en porte · c'est sa mention
  // qui la sort de la base de la taxe (O.-L. n° 10/001, art. 29 ; décret
  // n° 011/42, art. 79).
  const avecRemise = lignes.some((l) => !!l.remisePourcent);
  return (
    <table className="w-full border-collapse mb-3">
      <thead>
        <tr>
          <th className={`${cellule} text-left`}>Désignation</th>
          <th className={`${cellule} text-right`}>Quantité</th>
          <th className={`${cellule} text-right`}>Prix unitaire HT</th>
          {avecRemise && <th className={`${cellule} text-right`}>Remise</th>}
          <th className={`${cellule} text-right`}>Montant HT</th>
          {avecTva && <th className={`${cellule} text-right`}>Taux TVA</th>}
          {avecTva && <th className={`${cellule} text-right`}>TVA</th>}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={i}>
            <td className={cellule}>{l.designation}</td>
            <td className={`${cellule} text-right`}>{l.quantite?.toLocaleString('fr-FR') ?? ''}</td>
            <td className={`${cellule} text-right`}>{fmt(l.prixUnitaire)}</td>
            {avecRemise && <td className={`${cellule} text-right`}>{l.remisePourcent ? `${l.remisePourcent.toLocaleString('fr-FR')} %` : ''}</td>}
            <td className={`${cellule} text-right`}>{fmt(l.montantHT)}</td>
            {avecTva && (
              <td className={`${cellule} text-right`}>
                {l.imposable === false ? 'exonéré' : l.tauxApplique === null || l.tauxApplique === undefined ? '' : `${l.tauxApplique} %`}
              </td>
            )}
            {avecTva && <td className={`${cellule} text-right`}>{fmt(l.montantTva)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const montantImprime = fmt;
