import { PassThrough, type Writable } from 'stream';

/**
 * UN FICHIER PRODUIT POUR ÊTRE GARDÉ, PAS POUR PARTIR · l'export des
 * modifications et l'impression différée (ligne sage-l7) écrivent le même
 * classeur en flux que les exports directs, mais dans la mémoire du serveur,
 * pour le ranger en base et le servir plus tard.
 *
 * TOUT OU RIEN · le fichier n'est rendu qu'une fois l'écriture TERMINÉE et le
 * tuyau fermé ; une panne en route rejette, et les morceaux déjà écrits sont
 * jetés avec le tuyau · jamais un livre à moitié écrit rangé comme s'il était
 * complet (AUDCIF art. 22, 6° ; CLAUDE.md § 8 bis). Le plafond de volume, lui,
 * est celui des exports directs · le moteur appelé refuse avant le premier
 * octet, et ce refus remonte tel quel.
 *
 * `ouvrir` reçoit le nom que le moteur donne au fichier, comme le contrôleur
 * le reçoit pour l'en-tête du téléchargement.
 */
export async function produireEnMemoire(
  ecrire: (ouvrir: (nomFichier: string) => Writable) => Promise<unknown>,
): Promise<{ nomFichier: string; contenu: Buffer }> {
  const sortie = new PassThrough();
  const morceaux: Buffer[] = [];
  sortie.on('data', (morceau: Buffer) => morceaux.push(morceau));
  const fermee = new Promise<void>((resoudre, rejeter) => {
    sortie.on('end', () => resoudre());
    sortie.on('error', rejeter);
  });
  // DÈS SA NAISSANCE, LA FERMETURE A UN GESTIONNAIRE (relecture TypeScript,
  // mineur 2) · le tuyau peut tomber PENDANT que le moteur écrit encore, et
  // la promesse rejetée sans gestionnaire jusqu'au retour du moteur était un
  // rejet non traité, qui fait tomber le processus sous Node 22. Le
  // gestionnaire vide n'avale rien · `await fermee`, plus bas, relit le rejet.
  fermee.catch(() => {});
  let nomFichier: string | null = null;
  try {
    await ecrire((nom) => {
      nomFichier = nom;
      return sortie;
    });
  } catch (erreur) {
    sortie.destroy();
    throw erreur;
  }
  // Le moteur ferme le tuyau en terminant le classeur (`commit`) ; un moteur
  // qui rend la main SANS l'avoir fermé n'a pas fini son fichier · le fermer
  // ici rangeait une archive inachevée comme un livre complet (relecture m1).
  if (!sortie.writableEnded) {
    sortie.destroy();
    throw new Error("Le moteur d'export a rendu la main sans terminer son fichier · rien n'est rangé.");
  }
  await fermee;
  if (nomFichier === null) {
    throw new Error("Le moteur d'export n'a ouvert aucun fichier · rien n'a été produit.");
  }
  return { nomFichier, contenu: Buffer.concat(morceaux) };
}
