import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { TypeNotification } from '@prisma/client';
import { motifRefusEnvoi, TAILLE_BOITE } from './messagerie';
import { notifierSansEchec } from '../notifications/notifications';
import { CONSERVATION_JOURS, DELAI_CONNECTE_MS, estConnectee, sessionEncoreOuverte } from './presence';

/** Au-delà de ce délai sans activité, une session ne se montre plus · convention d'OmegaX. */
const FENETRE_PRESENCE_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class MessagerieService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // UTILISATEURS CONNECTÉS
  // -------------------------------------------------------------------------

  /**
   * LES SESSIONS DU DOSSIER VUES DANS LES HUIT DERNIÈRES HEURES · connectées
   * (activité depuis moins d'un quart d'heure) ou inactives, jamais une
   * session fermée ni révoquée. Ce qui a dépassé sa durée de conservation est
   * retiré d'abord (art. 193, 3°). Jamais l'empreinte ni le jeton.
   */
  async utilisateursConnectes(tenantId: string, maintenant = new Date()) {
    await this.prisma.presenceSession.deleteMany({
      where: { tenantId, derniereActiviteLe: { lt: new Date(maintenant.getTime() - CONSERVATION_JOURS * 24 * 3600 * 1000) } },
    });
    const lues = await this.prisma.presenceSession.findMany({
      where: { tenantId, fermeeLe: null, derniereActiviteLe: { gte: new Date(maintenant.getTime() - FENETRE_PRESENCE_MS) } },
      orderBy: { derniereActiviteLe: 'desc' },
      take: 500,
      select: {
        id: true,
        empreinteSession: true,
        ouverteLe: true,
        authentifieeLe: true,
        derniereActiviteLe: true,
        fermeeLe: true,
        sessionLongue: true,
        appareil: true,
        user: { select: { id: true, email: true, role: true, estActif: true, sessionsInvalidesAvant: true, sessionsFermees: true } },
      },
    });
    const ouvertes = lues.filter((p) => sessionEncoreOuverte(p, maintenant));
    const sessions = ouvertes.slice(0, 200).map((p) => ({
      id: p.id,
      userId: p.user.id,
      email: p.user.email,
      role: p.user.role,
      ouverteLe: p.ouverteLe,
      derniereActiviteLe: p.derniereActiviteLe,
      sessionLongue: p.sessionLongue,
      appareil: p.appareil,
      connectee: estConnectee(p.derniereActiviteLe, maintenant),
    }));
    return {
      sessions,
      total: ouvertes.length,
      tronque: ouvertes.length > sessions.length || lues.length === 500,
      connectees: sessions.filter((s) => s.connectee).length,
      delaiConnecteMinutes: DELAI_CONNECTE_MS / 60000,
      fenetreHeures: FENETRE_PRESENCE_MS / 3600000,
    };
  }

  // -------------------------------------------------------------------------
  // MESSAGERIE
  // -------------------------------------------------------------------------

  /** Les utilisateurs ACTIFS du dossier à qui écrire · soi-même excepté. */
  async destinataires(tenantId: string, userId: string) {
    const lus = await this.prisma.user.findMany({
      where: { tenantId, estActif: true, id: { not: userId } },
      orderBy: { email: 'asc' },
      take: 500,
      select: { id: true, email: true, role: true },
    });
    return { destinataires: lus, tronque: lus.length === 500 };
  }

  async envoyer(tenantId: string, userId: string, dto: { objet: string; corps: string; destinataireIds: string[]; repondAId?: string }) {
    const motif = motifRefusEnvoi(dto, userId);
    if (motif) throw new BadRequestException(motif);
    const ids = [...new Set(dto.destinataireIds)];
    // LE MÊME DOSSIER, RELU · un identifiant d'un autre dossier, ou d'un compte
    // désactivé, refuse l'envoi entier, sans dire lequel existe ailleurs.
    const actifs = await this.prisma.user.count({ where: { tenantId, estActif: true, id: { in: ids } } });
    if (actifs !== ids.length) {
      throw new BadRequestException("Un destinataire n'est pas un utilisateur actif de ce dossier · relisez la liste.");
    }
    if (dto.repondAId && !(await this.lisible(tenantId, userId, dto.repondAId))) {
      throw new NotFoundException('Message introuvable pour ce dossier.');
    }
    const message = await transactionJournalisee(this.prisma, (tx) =>
      tx.messageInterne.create({
        data: {
          tenantId,
          expediteurId: userId,
          objet: dto.objet.trim(),
          corps: dto.corps,
          repondAId: dto.repondAId ?? null,
          destinataires: { create: ids.map((destinataireId) => ({ tenantId, destinataireId })) },
        },
        select: { id: true, envoyeLe: true },
      }),
    );
    // LA NOTIFICATION (fonction 100) · aux destinataires seuls, après l'envoi,
    // jamais levée · l'objet se dit à qui le lit de toute façon.
    await notifierSansEchec(
      this.prisma,
      tenantId,
      TypeNotification.MESSAGE_RECU,
      async () => {
        const expediteur = await this.prisma.user.findFirst({ where: { tenantId, id: userId }, select: { email: true } });
        return { titre: `Message de ${expediteur?.email ?? 'un utilisateur du dossier'} · ${dto.objet.trim()}`, lien: '/messages' };
      },
      { userIds: ids, sauf: userId },
    );
    return { ...message, destinataires: ids.length };
  }

  /** La boîte de réception · les plus récents d'abord, bornée et dite. */
  async recus(tenantId: string, userId: string) {
    const [lignes, total, nonLus] = await Promise.all([
      this.prisma.destinataireMessage.findMany({
        where: { tenantId, destinataireId: userId, retireLe: null },
        orderBy: { message: { envoyeLe: 'desc' } },
        take: TAILLE_BOITE,
        select: {
          luLe: true,
          message: { select: { id: true, objet: true, envoyeLe: true, expediteur: { select: { email: true } } } },
        },
      }),
      this.prisma.destinataireMessage.count({ where: { tenantId, destinataireId: userId, retireLe: null } }),
      this.prisma.destinataireMessage.count({ where: { tenantId, destinataireId: userId, retireLe: null, luLe: null } }),
    ]);
    return {
      messages: lignes.map((l) => ({ id: l.message.id, objet: l.message.objet, envoyeLe: l.message.envoyeLe, de: l.message.expediteur.email, lu: l.luLe !== null })),
      total,
      nonLus,
      tronque: total > lignes.length,
    };
  }

  /** Les envoyés · les plus récents d'abord, bornés et dits. */
  async envoyes(tenantId: string, userId: string) {
    const [lignes, total] = await Promise.all([
      this.prisma.messageInterne.findMany({
        where: { tenantId, expediteurId: userId, retireParExpediteurLe: null },
        orderBy: { envoyeLe: 'desc' },
        take: TAILLE_BOITE,
        select: {
          id: true,
          objet: true,
          envoyeLe: true,
          destinataires: { select: { luLe: true, destinataire: { select: { email: true } } } },
        },
      }),
      this.prisma.messageInterne.count({ where: { tenantId, expediteurId: userId, retireParExpediteurLe: null } }),
    ]);
    return {
      messages: lignes.map((m) => ({
        id: m.id,
        objet: m.objet,
        envoyeLe: m.envoyeLe,
        a: m.destinataires.map((d) => d.destinataire.email),
        lusPar: m.destinataires.filter((d) => d.luLe !== null).length,
      })),
      total,
      tronque: total > lignes.length,
    };
  }

  /** Le nombre de messages non lus · la cloche et la barre d'état le lisent. */
  async nonLus(tenantId: string, userId: string) {
    return { nonLus: await this.prisma.destinataireMessage.count({ where: { tenantId, destinataireId: userId, retireLe: null, luLe: null } }) };
  }

  /** Un message, à son expéditeur ou à un destinataire qui ne l'a pas retiré · à nul autre. */
  async lire(tenantId: string, userId: string, id: string) {
    const m = await this.prisma.messageInterne.findFirst({
      where: {
        tenantId,
        id,
        OR: [
          { expediteurId: userId, retireParExpediteurLe: null },
          { destinataires: { some: { destinataireId: userId, retireLe: null } } },
        ],
      },
      select: {
        id: true,
        objet: true,
        corps: true,
        envoyeLe: true,
        expediteurId: true,
        expediteur: { select: { email: true } },
        repondA: { select: { id: true, objet: true } },
        destinataires: { select: { destinataireId: true, luLe: true, destinataire: { select: { email: true } } } },
      },
    });
    if (!m) throw new NotFoundException('Message introuvable pour ce dossier.');
    const estExpediteur = m.expediteurId === userId;
    return {
      id: m.id,
      objet: m.objet,
      corps: m.corps,
      envoyeLe: m.envoyeLe,
      de: m.expediteur.email,
      deId: m.expediteurId,
      a: m.destinataires.map((d) => ({ email: d.destinataire.email, id: d.destinataireId, ...(estExpediteur ? { lu: d.luLe !== null } : {}) })),
      repondA: m.repondA,
      estExpediteur,
    };
  }

  /** Marque lu, pour le destinataire seul · deux gestes n'en font qu'un. */
  async marquerLu(tenantId: string, userId: string, id: string) {
    const fait = await this.prisma.destinataireMessage.updateMany({
      where: { tenantId, messageId: id, destinataireId: userId, retireLe: null, luLe: null },
      data: { luLe: new Date() },
    });
    return { marque: fait.count === 1 };
  }

  /**
   * RETIRER DE SA BOÎTE · chacun la sienne. Un message que l'expéditeur et
   * tous ses destinataires ont retiré se supprime · plus rien ne le retient.
   */
  async retirer(tenantId: string, userId: string, id: string) {
    if (!(await this.lisible(tenantId, userId, id))) throw new NotFoundException('Message introuvable pour ce dossier.');
    const maintenant = new Date();
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.destinataireMessage.updateMany({
        where: { tenantId, messageId: id, destinataireId: userId, retireLe: null },
        data: { retireLe: maintenant },
      });
      const parExpediteur = await tx.messageInterne.updateMany({
        where: { tenantId, id, expediteurId: userId, retireParExpediteurLe: null },
        data: { retireParExpediteurLe: maintenant },
      });
      const restant = await tx.messageInterne.findFirst({
        where: { tenantId, id },
        select: { retireParExpediteurLe: true, destinataires: { where: { retireLe: null }, select: { id: true } } },
      });
      let supprime = false;
      if (restant && restant.retireParExpediteurLe !== null && restant.destinataires.length === 0) {
        await tx.messageInterne.delete({ where: { id, tenantId } });
        supprime = true;
      }
      return { retire: true, supprime, commeExpediteur: parExpediteur.count === 1 };
    });
  }

  private async lisible(tenantId: string, userId: string, id: string): Promise<boolean> {
    const n = await this.prisma.messageInterne.count({
      where: {
        tenantId,
        id,
        OR: [
          { expediteurId: userId, retireParExpediteurLe: null },
          { destinataires: { some: { destinataireId: userId, retireLe: null } } },
        ],
      },
    });
    return n > 0;
  }
}
