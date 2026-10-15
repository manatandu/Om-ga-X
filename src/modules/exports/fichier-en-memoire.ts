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
  // qui rendrait la main sans l'avoir fermé laisserait un fichier inachevé ·
  // on le ferme ici, et l'archive incomplète se lirait comme illisible.
  if (!sortie.writableEnded) sortie.end();
  await fermee;
  if (nomFichier === null) {
    throw new Error("Le moteur d'export n'a ouvert aucun fichier · rien n'a été produit.");
  }
  return { nomFichier, contenu: Buffer.concat(morceaux) };
}
