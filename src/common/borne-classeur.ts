import { BadRequestException } from '@nestjs/common';
import { inflateRawSync } from 'zlib';

/**
 * UN CLASSEUR IMPORTÉ EST BORNÉ DÉCOMPRESSÉ, PAS SEULEMENT COMPRESSÉ (audit de
 * sécurité du 2026-10-25, piste 8).
 *
 * Un .xlsx est une archive zip. La seule borne était celle du corps de la
 * requête (12 Mo encodés), sur la forme COMPRESSÉE · ExcelJS décompressait
 * ensuite tout le classeur dans le tas du processus, partagé par tous les
 * cabinets (460 Mio, `docs/capacite-mesuree.md`). Une « bombe » de quelques
 * mégaoctets qui se déplie en gigaoctets faisait tomber l'instance pour tout
 * le monde.
 *
 * Les tailles écrites dans l'archive ne se croient pas · un fichier forgé peut
 * annoncer peu et déplier beaucoup, et la bibliothèque de lecture ne compare
 * qu'après avoir tout déplié. Chaque entrée est donc DÉPLIÉE ICI, sous un
 * plafond que zlib tient lui-même (`maxOutputLength`), avant qu'ExcelJS ne
 * voie le fichier. Le plafond est une convention d'OmegaX · un grand livre de
 * deux cent mille lignes (`MAX_LIGNES_EXPORT`) tient en une soixantaine de
 * mégaoctets dépliés.
 */
export const PLAFOND_CLASSEUR_DEPLIE_OCTETS = 150 * 1024 * 1024;
export const PLAFOND_ENTREES_CLASSEUR = 5_000;

const MOTIF_ILLISIBLE = "Le classeur est illisible (archive .xlsx endommagée) · enregistrez-le de nouveau depuis le tableur.";
export const MOTIF_CLASSEUR_TROP_GRAND =
  `Le classeur dépasse ${PLAFOND_CLASSEUR_DEPLIE_OCTETS / (1024 * 1024)} Mo une fois décompressé · scindez-le, ou importez-le en CSV.`;

/** Lève si le classeur, déplié, dépasse les plafonds ou n'est pas une archive lisible. */
export function verifierClasseurBorne(contenu: Buffer, plafondOctets = PLAFOND_CLASSEUR_DEPLIE_OCTETS): void {
  // Fin du répertoire central · signature PK\x05\x06, cherchée depuis la fin
  // (un commentaire d'archive peut la suivre, au plus 65 535 octets).
  let fin = -1;
  for (let i = contenu.length - 22; i >= Math.max(0, contenu.length - 22 - 65_535); i--) {
    if (contenu.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new BadRequestException(MOTIF_ILLISIBLE);
  const entrees = contenu.readUInt16LE(fin + 10);
  const debutRepertoire = contenu.readUInt32LE(fin + 16);
  // Une archive zip64 (plus de 65 535 entrées ou de 4 Go) n'est pas un
  // classeur qu'un cabinet importe.
  if (entrees === 0xffff || debutRepertoire === 0xffffffff) throw new BadRequestException(MOTIF_CLASSEUR_TROP_GRAND);
  if (entrees > PLAFOND_ENTREES_CLASSEUR) throw new BadRequestException(MOTIF_CLASSEUR_TROP_GRAND);

  let reste = plafondOctets;
  let p = debutRepertoire;
  for (let n = 0; n < entrees; n++) {
    if (p + 46 > contenu.length || contenu.readUInt32LE(p) !== 0x02014b50) throw new BadRequestException(MOTIF_ILLISIBLE);
    const methode = contenu.readUInt16LE(p + 10);
    const tailleCompressee = contenu.readUInt32LE(p + 20);
    const longueurNom = contenu.readUInt16LE(p + 28);
    const longueurExtra = contenu.readUInt16LE(p + 30);
    const longueurCommentaire = contenu.readUInt16LE(p + 32);
    const local = contenu.readUInt32LE(p + 42);
    p += 46 + longueurNom + longueurExtra + longueurCommentaire;

    if (local + 30 > contenu.length || contenu.readUInt32LE(local) !== 0x04034b50) throw new BadRequestException(MOTIF_ILLISIBLE);
    const donnees = local + 30 + contenu.readUInt16LE(local + 26) + contenu.readUInt16LE(local + 28);
    if (donnees + tailleCompressee > contenu.length) throw new BadRequestException(MOTIF_ILLISIBLE);
    const brut = contenu.subarray(donnees, donnees + tailleCompressee);

    let deplie: number;
    if (methode === 0) {
      deplie = brut.length;
    } else if (methode === 8) {
      try {
        // La valeur dépliée est jetée aussitôt · seule sa longueur compte.
        deplie = inflateRawSync(brut, { maxOutputLength: reste + 1 }).length;
      } catch (e) {
        if ((e as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') throw new BadRequestException(MOTIF_CLASSEUR_TROP_GRAND);
        throw new BadRequestException(MOTIF_ILLISIBLE);
      }
    } else {
      throw new BadRequestException(MOTIF_ILLISIBLE);
    }
    reste -= deplie;
    if (reste < 0) throw new BadRequestException(MOTIF_CLASSEUR_TROP_GRAND);
  }
}
