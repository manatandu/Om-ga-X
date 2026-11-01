import { Body, Controller, HttpCode, Post, Req, UnsupportedMediaTypeException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { DemandeInformationDto } from './demande-information.dto';
import { DemandeInformationService } from './demande-information.service';

export const MOTIF_DEMANDE_EN_JSON =
  'La demande se transmet en JSON (Content-Type: application/json) · un formulaire posté depuis un autre site est refusé.';

/**
 * PORTE PUBLIQUE, SANS SESSION · le formulaire de demande de la page de
 * présentation (`client/public/vitrine/`). Aucune garde d'authentification ·
 * rien de ce dossier ni d'aucun autre n'est lu ni rendu, seule la demande
 * part, mise en file pour les opérateurs de la plateforme.
 */
@Controller('demandes')
export class DemandeInformationController {
  constructor(private readonly demandes: DemandeInformationService) {}

  // Cinq demandes par heure et par adresse IP · un visiteur en écrit une ou
  // deux, un script qui inonderait la boîte des opérateurs est coupé.
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post('information')
  @HttpCode(200)
  transmettre(@Body() dto: DemandeInformationDto, @Req() req?: Request) {
    // EN JSON SEULEMENT, comme la connexion · un formulaire d'un autre site
    // poste sans contrôle préalable ; un corps JSON exige le contrôle CORS,
    // que la liste des origines admises refuse. La page publique envoie du JSON.
    if (typeof req?.is === 'function' && !req.is('application/json')) throw new UnsupportedMediaTypeException(MOTIF_DEMANDE_EN_JSON);
    return this.demandes.transmettre(dto);
  }
}
