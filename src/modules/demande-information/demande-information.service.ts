import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatutMessage, TypeLicence } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { horsCloisonnement } from '../../common/cloisonnement/contexte-cloisonnement';
import { estSurSite } from '../../common/mode-installation';
import { CourrierService } from '../courrier/courrier.service';
import { DemandeInformationDto } from './demande-information.dto';
import { ORIGINE_DEMANDE_INFORMATION, composerDemande, destinatairesDesDemandes } from './demande-information';

export const MOTIF_SANS_MESSAGERIE =
  "L'envoi des demandes n'est pas disponible pour le moment · aucune messagerie n'est configurée. Rien n'a été enregistré.";

export const MOTIF_NON_ENREGISTREE =
  "La demande n'a pas pu être enregistrée pour le moment. Rien n'a été gardé · réessayez plus tard.";

/** Ce que la page dit après l'envoi · aucun délai promis, aucune adresse rendue. */
export const REPONSE_DEMANDE_RECUE =
  "Votre demande est enregistrée pour l'équipe d'OmegaX, qui vous répondra à l'adresse électronique indiquée.";

@Injectable()
export class DemandeInformationService {
  private readonly logger = new Logger(DemandeInformationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly courrier: CourrierService,
  ) {}

  /**
   * TOUT SE VÉRIFIE AVANT LA PREMIÈRE ÉCRITURE · messagerie configurée,
   * destinataires, dossier de l'éditeur. Sans l'un d'eux, 503 et rien d'écrit ·
   * un message mis en file sans transport n'arriverait jamais, et la page
   * dirait « enregistrée » d'une demande que personne ne lira.
   */
  async transmettre(dto: DemandeInformationDto, recueLe: Date = new Date()): Promise<{ recue: true; message: string }> {
    // Sur site, la page publique n'est pas servie · le poste d'un client
    // n'est pas une adresse de l'éditeur.
    if (estSurSite()) throw new NotFoundException('Les demandes passent par la page en ligne d’OmegaX.');
    const destinataires = destinatairesDesDemandes(this.config.get<string>('OPERATEURS_PLATEFORME'));
    if (!this.courrier.etatDuTransport().configure || destinataires.length === 0) {
      if (destinataires.length === 0) this.logger.warn('Demande d’information refusée · OPERATEURS_PLATEFORME est vide.');
      throw new ServiceUnavailableException(MOTIF_SANS_MESSAGERIE);
    }
    const editeur = await horsCloisonnement("page publique · la demande d'information va dans le dossier de l'éditeur", () =>
      this.prisma.licence.findFirst({ where: { type: TypeLicence.PROPRIETAIRE }, select: { tenantId: true } }),
    );
    if (!editeur) {
      this.logger.warn('Demande d’information refusée · aucun dossier d’éditeur désigné.');
      throw new ServiceUnavailableException(MOTIF_SANS_MESSAGERIE);
    }

    const { sujet, corps } = composerDemande(dto, recueLe);
    const statuts: StatutMessage[] = [];
    let refuses = 0;
    for (const destinataire of destinataires) {
      // Chaque message est écrit PUIS tenté (`mettreEnFile`) · un envoi qui
      // échoue reste en file et sera repris, il n'est pas perdu.
      try {
        const r = await horsCloisonnement("page publique · la demande d'information mise en file pour les opérateurs", () =>
          this.courrier.mettreEnFile(editeur.tenantId, { destinataire, sujet, corps, origine: ORIGINE_DEMANDE_INFORMATION }),
        );
        statuts.push(r.statut);
      } catch (erreur) {
        // UN REFUS DE LA FILE NE REMONTE JAMAIS TEL QUEL AU VISITEUR · il cite
        // l'adresse refusée, celle d'un opérateur (une faute dans
        // OPERATEURS_PLATEFORME). Le journal du serveur dit le refus, sans
        // l'adresse ; la page reçoit le 503 commun.
        refuses += 1;
        this.logger.error(
          `Demande d’information · un destinataire refusé par la file (${erreur instanceof Error ? erreur.constructor.name : 'erreur'}) · vérifier OPERATEURS_PLATEFORME.`,
        );
      }
    }
    if (statuts.length === 0) throw new ServiceUnavailableException(MOTIF_NON_ENREGISTREE);
    // Le journal du serveur dit des statuts, jamais une adresse ni un nom.
    this.logger.log(`Demande d’information mise en file · ${statuts.join(', ')}${refuses ? ` · ${refuses} destinataire(s) refusé(s)` : ''}`);
    return { recue: true, message: REPONSE_DEMANDE_RECUE };
  }
}
