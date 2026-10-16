/**
 * Le texte d'une version des conditions de licence, en fichier · conservation
 * et reproduction (Code du numérique, art. 53, al. 1er), le même nom que la
 * pièce jointe de l'accusé de réception (`nomPieceJointeConditions`). Une
 * version ancienne se télécharge depuis l'archive des versions publiées,
 * jamais reconstituée.
 */
export function telechargerTexteDeVersion(numero: number, texte: string) {
  const blob = new Blob([texte], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `conditions-de-licence-omegax-version-${numero}.txt`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
