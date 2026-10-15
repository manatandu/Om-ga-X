import { UseFilters, UseInterceptors, applyDecorators } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TAILLE_MAX_DOCUMENT, entetesTelechargement } from './pieces-jointes';
import { RefusEnvoi } from './refus-envoi.filter';

/**
 * LA RÉCEPTION D'UNE PIÈCE, posée UNE fois pour tous les objets (ligne
 * sage-l6, fonction n° 22).
 *
 * Sans `dest` ni `storage`, multer garde le fichier EN MÉMOIRE (`buffer`) ·
 * rien n'est écrit sur le disque du conteneur, qui n'est pas persistant. La
 * limite de 5 Mo est posée À LA RÉCEPTION, pour qu'un envoi de 500 Mo ne soit
 * jamais tenu en mémoire ; ses refus sont redits en français (413 pour la
 * taille) par `RefusEnvoi`.
 */
export function RecevoirUnePiece() {
  return applyDecorators(
    UseFilters(RefusEnvoi),
    UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_DOCUMENT, files: 1, fields: 4 } })),
  );
}

/**
 * LE TÉLÉCHARGEMENT · `attachment` et `nosniff`, jamais affichée dans la page
 * de l'application (`entetesTelechargement`).
 */
export function servirLaPiece(res: Response, piece: { nomFichier: string; typeMime: string; contenu: Uint8Array }) {
  res.set(entetesTelechargement(piece));
  res.send(Buffer.from(piece.contenu));
}
