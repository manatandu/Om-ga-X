/**
 * IMPRIMER UN FORMULAIRE SEUL · un onglet qui porte plusieurs blocs (la
 * déclaration annuelle à côté des déclarations de mouvement et
 * d'établissement) envoyait la page entière au papier. Le temps de
 * l'impression, le corps porte `imprime-formulaire` et seul l'élément marqué
 * `formulaire-imprime` reste visible (`index.css`), retiré sur `afterprint`
 * comme la fiche d'imputation.
 */
export const CLASSE_IMPRESSION_FORMULAIRE = 'imprime-formulaire';
export const CLASSE_FORMULAIRE_IMPRIME = 'formulaire-imprime';

export function imprimerLeFormulaire() {
  document.body.classList.add(CLASSE_IMPRESSION_FORMULAIRE);
  const retirer = () => {
    document.body.classList.remove(CLASSE_IMPRESSION_FORMULAIRE);
    window.removeEventListener('afterprint', retirer);
  };
  window.addEventListener('afterprint', retirer);
  window.print();
}
