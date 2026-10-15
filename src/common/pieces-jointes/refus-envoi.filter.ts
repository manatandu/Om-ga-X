import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Les refus de multer, redits en français. Multer coupe la réception au-delà
 * de 5 Mo (« File too large ») · la limite est posée À LA RÉCEPTION pour
 * qu'un envoi de 500 Mo ne soit jamais tenu en mémoire. Ses autres refus
 * (fichier en trop, champ inattendu, envoi tronqué) sortent en 400 dans sa
 * langue ; ils sont traduits ici. Tout autre 400, dont ceux du service, déjà
 * en français, passe tel quel.
 */
export const REFUS_MULTER: Readonly<Record<string, string>> = {
  'Too many files': 'Une seule pièce à la fois.',
  'Unexpected field': 'Le fichier doit être envoyé dans le champ « fichier ».',
  'Too many fields': "Trop de champs dans l'envoi · seuls le fichier et le commentaire sont attendus.",
  'Too many parts': "Trop de champs dans l'envoi · seuls le fichier et le commentaire sont attendus.",
  'Field value too long': "Un champ de l'envoi est trop long.",
  'Field name too long': "Un champ de l'envoi est trop long.",
  'Field name missing': "L'envoi est mal formé.",
};

const ENVOI_MAL_FORME = /^(Multipart: |Malformed part header|Unexpected end of )/;

@Catch(PayloadTooLargeException, BadRequestException)
export class RefusEnvoi implements ExceptionFilter {
  catch(e: PayloadTooLargeException | BadRequestException, hote: ArgumentsHost) {
    const reponse = hote.switchToHttp().getResponse<Response>();
    if (e instanceof PayloadTooLargeException) {
      reponse
        .status(413)
        .json({ statusCode: 413, message: 'Le fichier dépasse 5 Mo · réduisez-le ou numérisez-le en plus basse définition.' });
      return;
    }
    const traduit =
      REFUS_MULTER[e.message] ?? (ENVOI_MAL_FORME.test(e.message) ? "L'envoi est mal formé ou interrompu · recommencez." : null);
    reponse.status(400).json(traduit ? { statusCode: 400, message: traduit } : e.getResponse());
  }
}

