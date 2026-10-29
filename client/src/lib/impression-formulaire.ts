/**
 * IMPRIMER UN FORMULAIRE SEUL · un onglet qui porte plusieurs blocs (la
 * déclaration annuelle, le bilan social, les déclarations de mouvement et
 * d'établissement) envoyait la page entière au papier. Le temps de
 * l'impression, une COPIE du seul formulaire visé est posée sous `<body>`
 * (`#impression-isolee`) et le corps porte `imprime-formulaire`, qui retire
 * tout le reste (`index.css`), comme la fiche d'imputation · masquer par la
 * visibilité gardait la place du reste et sortait des pages blanches. La
 * copie et la marque se retirent sur `afterprint`.
 */
export const CLASSE_IMPRESSION_FORMULAIRE = 'imprime-formulaire';
export const ID_IMPRESSION_ISOLEE = 'impression-isolee';

export function imprimerLeFormulaire(idElement: string) {
  const cible = document.getElementById(idElement);
  if (!cible) {
    // Rien à isoler · la page s'imprime telle qu'elle est plutôt que pas du tout.
    window.print();
    return;
  }
  document.getElementById(ID_IMPRESSION_ISOLEE)?.remove();
  const copie = document.createElement('div');
  copie.id = ID_IMPRESSION_ISOLEE;
  const clone = cible.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  copie.appendChild(clone);
  document.body.appendChild(copie);
  document.body.classList.add(CLASSE_IMPRESSION_FORMULAIRE);
  const retirer = () => {
    document.body.classList.remove(CLASSE_IMPRESSION_FORMULAIRE);
    copie.remove();
    window.removeEventListener('afterprint', retirer);
  };
  window.addEventListener('afterprint', retirer);
  window.print();
}
