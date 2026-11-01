import { HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

/**
 * LE PLAFOND GLOBAL · `@Throttle` compte PAR INSTANCE et par adresse
 * (docs/connexions-et-plafonds.md, § 7) · des adresses nombreuses, ou quatre
 * instances, passeraient au travers. Ce plafond se lit EN BASE, sur la file du
 * dossier de l'éditeur · au plus tant de demandes par heure glissante, toutes
 * adresses et toutes instances confondues. Convention d'OmegaX, aucun texte ne
 * la fixe · soixante demandes par heure dépassent de loin ce qu'une page de
 * présentation reçoit, et bornent ce qu'un robot peut déverser dans la boîte
 * des opérateurs. Deux demandes simultanées au bord du plafond peuvent le
 * dépasser d'une · le compte n'est pas pris sous verrou, et c'est voulu (un
 * verrou par demande publique serait une porte ouverte au refus de service).
 */
export const DEMANDES_PAR_HEURE_AU_PLUS = 60;

export const MOTIF_PLAFOND_GLOBAL =
  "Trop de demandes ont été reçues dans l'heure · réessayez plus tard. Rien n'a été enregistré.";

export const MOTIF_NON_ENREGISTREE =
  "La demande n'a pas pu être enregistrée pour le moment. Rien n'a été gardé · réessayez plus tard.";

/** Ce que la page dit après l'envoi · aucun délai promis, aucune adresse rendue. */
export const REPONSE_DEMANDE_RECUE =
  "Votre demande est enregistrée pour l'équipe d'OmegaX, qui vous répondra à l'adresse électronique indiquée.";

/** Ce que la console de l'éditeur dit des demandes · des nombres, jamais un nom ni une adresse. */
export interface EtatDemandesConsole {
  /** En file, en échec ou écrites sans messagerie · la reprise les tente. */
  nonEnvoyees: number;
  /** Abandonnées après le dernier essai · la reprise ne les tente plus, la fenêtre du courrier les montre. */
  abandonnees: number;
}

const NON_ENVOYEES: StatutMessage[] = [StatutMessage.EN_ATTENTE, StatutMessage.ECHEC, StatutMessage.SANS_TRANSPORT];

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

    // LE CHAMP PIÈGE REMPLI · la réponse ordinaire, rien d'écrit (voir le DTO).
    if (dto.site && dto.site.trim().length > 0) {
      this.logger.log('Demande d’information écartée · champ piège rempli.');
      return { recue: true, message: REPONSE_DEMANDE_RECUE };
    }
    // Une demande fait un message par opérateur · le plafond compte des demandes.
    const recentes = await horsCloisonnement("page publique · plafond global des demandes d'information de l'heure", () =>
      this.prisma.message.count({
        where: {
          tenantId: editeur.tenantId,
          origine: ORIGINE_DEMANDE_INFORMATION,
          createdAt: { gte: new Date(recueLe.getTime() - 3_600_000) },
        },
      }),
    );
    if (recentes >= DEMANDES_PAR_HEURE_AU_PLUS * destinataires.length) {
      this.logger.warn('Demande d’information refusée · plafond global de l’heure atteint.');
      throw new HttpException(MOTIF_PLAFOND_GLOBAL, HttpStatus.TOO_MANY_REQUESTS);
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
    // UN MESSAGE NON PARTI SE VOIT · aucun ordonnanceur ne reprend la file, et
    // une demande restée en ÉCHEC n'arriverait jamais sans que personne le
    // sache. Il est dit en avertissement ici, et compté dans la console de
    // l'éditeur avec le geste qui le reprend (`etatPourLaConsole`, `reprendre`).
    const nonPartis = statuts.filter((s) => s !== StatutMessage.ENVOYE).length;
    const resume = `Demande d’information mise en file · ${statuts.join(', ')}${refuses ? ` · ${refuses} destinataire(s) refusé(s)` : ''}`;
    if (nonPartis > 0) this.logger.warn(`${resume} · ${nonPartis} message(s) non parti(s), à reprendre depuis la console de l’éditeur.`);
    else this.logger.log(resume);
    return { recue: true, message: REPONSE_DEMANDE_RECUE };
  }

  /**
   * POUR LA CONSOLE · les demandes du dossier de l'opérateur qui ne sont pas
   * parties. Les opérateurs ne sont promus que dans le dossier de l'éditeur
   * (`PlateformeService.onModuleInit`), où naissent les demandes · la lecture
   * reste bornée au dossier de la session, sans sortie de cloisonnement.
   */
  async etatPourLaConsole(tenantId: string): Promise<EtatDemandesConsole> {
    const [nonEnvoyees, abandonnees] = await Promise.all([
      this.prisma.message.count({ where: { tenantId, origine: ORIGINE_DEMANDE_INFORMATION, statut: { in: NON_ENVOYEES } } }),
      this.prisma.message.count({ where: { tenantId, origine: ORIGINE_DEMANDE_INFORMATION, statut: StatutMessage.ABANDONNE } }),
    ]);
    return { nonEnvoyees, abandonnees };
  }

  /** Le geste de la console · reprend les seules demandes d'information, par la reprise commune de la file. */
  reprendre(tenantId: string) {
    return this.courrier.reprendre(tenantId, undefined, [ORIGINE_DEMANDE_INFORMATION]);
  }
}
