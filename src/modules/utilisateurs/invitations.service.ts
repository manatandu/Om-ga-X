import { ConflictException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { RoleUtilisateur, StatutInvitationDossier } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { normaliserCourriel } from '../../common/courriel';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { CourrierService, ORIGINE_INVITATION_DOSSIER } from '../courrier/courrier.service';
import { empreinteDuJeton } from '../auth/compte-de-connexion';
import { avisInvitation, echeanceInvitation, jetonInvitation, ModeDeCreation, modeDeCreation } from './invitations';

/** Ne dit pas à qui l'adresse appartient · le dossier voit déjà ses utilisateurs. */
export const MOTIF_ADRESSE_DU_DOSSIER = 'Cette adresse est déjà celle d’un utilisateur de ce dossier';

const SELECTION_INVITATION = { id: true, email: true, role: true, statut: true, expireLe: true, createdAt: true, decideLe: true } as const;

/** Convention d'OmegaX · les invitations de la liste du dossier, les plus récentes d'abord. */
const BORNE_INVITATIONS = 200;

/**
 * PLAFOND DES INVITATIONS EN ATTENTE PAR DOSSIER (second tour, mineur 7) ·
 * convention d'OmegaX. Chaque invitation envoie un courriel au nom du
 * dossier · sans plafond, un compte administrateur volé servait de relais
 * d'envoi. Cent couvre l'équipe d'un cabinet ; au-delà, annuler d'abord.
 */
export const PLAFOND_INVITATIONS_EN_ATTENTE = 100;
export const MOTIF_PLAFOND_INVITATIONS =
  `Déjà ${PLAFOND_INVITATIONS_EN_ATTENTE} invitations en attente dans ce dossier · annulez celles qui ne servent plus, puis recommencez.`;

/**
 * LES INVITATIONS DU DOSSIER, CÔTÉ DE SON ADMINISTRATEUR (`invitations.ts`) ·
 * dans le dossier de la session, sous le cloisonnement ordinaire. Ce service
 * ne lit JAMAIS si l'adresse a un compte ailleurs · il n'en a pas besoin, et
 * c'est ce qui rend la réponse identique dans les deux cas.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly courrier?: CourrierService,
  ) {}

  mode(): ModeDeCreation {
    return modeDeCreation(this.courrier?.etatDuTransport().configure === true);
  }

  async lister(tenantId: string) {
    const [invitations, total] = await Promise.all([
      this.prisma.invitationDossier.findMany({
        where: { tenantId },
        select: SELECTION_INVITATION,
        orderBy: { createdAt: 'desc' },
        take: BORNE_INVITATIONS,
      }),
      this.prisma.invitationDossier.count({ where: { tenantId } }),
    ]);
    return { mode: this.mode(), invitations, total, tronque: total > invitations.length };
  }

  async inviter(tenantId: string, parQui: string, adresse: string, role: RoleUtilisateur, maintenant = new Date()) {
    if (!this.courrier || this.mode() !== 'INVITATION') {
      throw new ServiceUnavailableException('La messagerie est requise pour ce geste · configurez-la, puis recommencez.');
    }
    const email = normaliserCourriel(adresse);
    await this.refuserSiDejaLaOuAuPlafond(tenantId, email, maintenant);
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { nom: true } });
    const jeton = jetonInvitation();
    const expireLe = echeanceInvitation(maintenant);
    const avis = avisInvitation({ entite: tenant?.nom ?? '', role, jeton, expireLe });
    // Le courriel d'abord · un envoi refusé ne laisse aucune invitation qu'on
    // croirait partie. Le jeton n'est écrit nulle part ailleurs qu'au message.
    await this.courrier.envoyerUnSecret(
      tenantId,
      { destinataire: email, sujet: avis.sujet, corps: avis.corps, origine: ORIGINE_INVITATION_DOSSIER, origineId: null, createdBy: parQui },
      avis.corpsGarde,
    );
    return transactionJournalisee(this.prisma, async (tx) => {
      // Une invitation en attente à la même adresse cède la place à la neuve.
      await tx.invitationDossier.updateMany({
        where: { tenantId, email, statut: StatutInvitationDossier.EN_ATTENTE },
        data: { statut: StatutInvitationDossier.ANNULEE, decideLe: maintenant },
      });
      return tx.invitationDossier.create({
        data: { tenantId, email, role, empreinteJeton: empreinteDuJeton(jeton), expireLe, creePar: parQui },
        select: SELECTION_INVITATION,
      });
    });
  }

  /**
   * SUR SITE, L'ADRESSE CONNUE SUR LE POSTE EST INVITÉE SANS COURRIEL (second
   * tour, MAJEUR 3) · l'administrateur ne rattache plus d'office · l'invitation
   * s'affiche à la prochaine connexion de la personne, qui l'accepte depuis sa
   * session, sans code (`acceptableSansCode`). Sur le poste d'un seul
   * organisme, la personne qui tient la session de ce compte est la personne.
   * Le jeton tiré au sort n'est envoyé nulle part · il ne sert qu'à
   * l'unicité de la colonne.
   */
  async inviterSurPlace(tenantId: string, parQui: string, adresse: string, role: RoleUtilisateur, maintenant = new Date()) {
    const email = normaliserCourriel(adresse);
    await this.refuserSiDejaLaOuAuPlafond(tenantId, email, maintenant);
    const invitation = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.invitationDossier.updateMany({
        where: { tenantId, email, statut: StatutInvitationDossier.EN_ATTENTE },
        data: { statut: StatutInvitationDossier.ANNULEE, decideLe: maintenant },
      });
      return tx.invitationDossier.create({
        data: {
          tenantId,
          email,
          role,
          empreinteJeton: empreinteDuJeton(jetonInvitation()),
          expireLe: echeanceInvitation(maintenant),
          creePar: parQui,
          acceptableSansCode: true,
        },
        select: SELECTION_INVITATION,
      });
    });
    return { invitation };
  }

  private async refuserSiDejaLaOuAuPlafond(tenantId: string, email: string, maintenant: Date) {
    const [deja, enAttente] = await Promise.all([
      this.prisma.user.findFirst({ where: { tenantId, email }, select: { id: true } }),
      this.prisma.invitationDossier.count({ where: { tenantId, statut: StatutInvitationDossier.EN_ATTENTE, expireLe: { gt: maintenant } } }),
    ]);
    if (deja) throw new ConflictException(MOTIF_ADRESSE_DU_DOSSIER);
    if (enAttente >= PLAFOND_INVITATIONS_EN_ATTENTE) throw new ConflictException(MOTIF_PLAFOND_INVITATIONS);
  }

  async annuler(tenantId: string, id: string, maintenant = new Date()) {
    const { count } = await this.prisma.invitationDossier.updateMany({
      where: { id, tenantId, statut: StatutInvitationDossier.EN_ATTENTE },
      data: { statut: StatutInvitationDossier.ANNULEE, decideLe: maintenant },
    });
    if (count !== 1) throw new NotFoundException('Invitation introuvable ou déjà décidée.');
    return { annulee: true };
  }
}
