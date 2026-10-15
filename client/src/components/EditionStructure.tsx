import type { Edition } from '../lib/editions-structures';
import { appliquerModele, type ColonneEdition, type ModeleServi } from '../lib/modeles-edition';

/**
 * L'édition d'une liste de structure · invisible à l'écran, seule imprimée
 * (voir `.avec-edition` dans index.css). Le périmètre est dit en tête, pour
 * qu'une liste filtrée ne se lise jamais comme la liste entière.
 *
 * SOUS UN MODÈLE (ligne sage-l7, fonction 59 ; décision L7-1) · les colonnes
 * facultatives non gardées se taisent, et les groupes (classe, type de tiers,
 * rubrique) se séparent par une ligne blanche ou par une page · chaque page
 * reprend l'en-tête des colonnes. Aucune ligne n'est retirée.
 */
export function EditionStructure({
  edition,
  perimetre,
  modele = null,
  catalogue = [],
}: {
  edition: Edition;
  perimetre: string;
  modele?: Pick<ModeleServi, 'nom' | 'colonnes' | 'saut'> | null;
  catalogue?: ColonneEdition[];
}) {
  const mise = appliquerModele(edition, modele, catalogue);
  const entete = (
    <thead>
      <tr>
        {mise.colonnes.map((c) => (
          <th key={c} className="text-left">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
  const lignes = (l: string[][], prefixe: string) =>
    l.map((ligne, i) => (
      <tr key={`${prefixe}-${i}`}>
        {ligne.map((v, j) => (
          <td key={j}>{v}</td>
        ))}
      </tr>
    ));
  const titreBloc = (titre: string | null, cle: string) =>
    titre ? (
      <tr key={`${cle}-titre`} className="edition-titre-groupe">
        <td colSpan={mise.colonnes.length} className="font-semibold pt-1">
          {titre}
        </td>
      </tr>
    ) : null;
  return (
    <div className="impression-seul edition-structure">
      <div className="text-[11px] mb-2 font-semibold">
        {perimetre}
        {modele ? ` · modèle « ${modele.nom} »` : ''}
      </div>
      {mise.saut === 'PAGE' ? (
        mise.blocs.map((b, k) => (
          <table key={k} className={`w-full text-[10.5px] ${k > 0 ? 'edition-saut-page' : ''}`}>
            {entete}
            <tbody>
              {titreBloc(b.titre, `b${k}`)}
              {lignes(b.lignes, `b${k}`)}
            </tbody>
          </table>
        ))
      ) : (
        <table className="w-full text-[10.5px]">
          {entete}
          <tbody>
            {mise.blocs.flatMap((b, k) => [
              ...(k > 0 && mise.saut === 'LIGNE'
                ? [
                    <tr key={`b${k}-blanc`} className="edition-ligne-blanche">
                      <td colSpan={mise.colonnes.length}>&nbsp;</td>
                    </tr>,
                  ]
                : []),
              titreBloc(b.titre, `b${k}`),
              ...lignes(b.lignes, `b${k}`),
            ])}
          </tbody>
        </table>
      )}
    </div>
  );
}
