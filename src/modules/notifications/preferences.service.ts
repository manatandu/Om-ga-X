import { Injectable, NotFoundException } from '@nestjs/common';
import { LangueInterface, TailleTexte, TypeNotification } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CONSERVATION_LUES_JOURS, LIBELLE_TYPE_NOTIFICATION, TAILLE_LISTE_NOTIFICATIONS } from './notifications';

/** Les préférences quand le titulaire n'en a posé aucune. */
export const PREFERENCES_PAR_DEFAUT = {
  langue: LangueInterface.FR,
  tailleTexte: TailleTexte.NORMALE,
  notificationsCoupees: [] as TypeNotification[],
};

/**
 * LES PRÉFÉRENCES ET LES NOTIFICATIONS DE CHACUN (ligne dossier-l9, fonctions
 * 96 et 100). Chacun ne lit et ne règle que les siennes · aucune route ne
 * nomme un autre utilisateur.
 */
@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async lire(tenantId: string, userId: string) {
    const p = await this.prisma.preferenceUtilisateur.findFirst({
      where: { tenantId, userId },
      select: { langue: true, tailleTexte: true, notificationsCoupees: true },
    });
    return {
      ...(p ?? PREFERENCES_PAR_DEFAUT),
      types: Object.values(TypeNotification).map((type) => ({ type, libelle: LIBELLE_TYPE_NOTIFICATION[type] })),
    };
  }

  /** Règle ses préférences · ce qui n'est pas envoyé ne change pas. */
  async regler(
    tenantId: string,
    userId: string,
    dto: { langue?: LangueInterface; tailleTexte?: TailleTexte; notificationsCoupees?: TypeNotification[] },
  ) {
    const donnees = {
      ...(dto.langue !== undefined ? { langue: dto.langue } : {}),
      ...(dto.tailleTexte !== undefined ? { tailleTexte: dto.tailleTexte } : {}),
      ...(dto.notificationsCoupees !== undefined ? { notificationsCoupees: [...new Set(dto.notificationsCoupees)] } : {}),
    };
    const existante = await this.prisma.preferenceUtilisateur.findFirst({ where: { tenantId, userId }, select: { id: true } });
    if (existante) {
      await this.prisma.preferenceUtilisateur.update({ where: { id: existante.id, tenantId }, data: donnees });
    } else {
      try {
        await this.prisma.preferenceUtilisateur.create({ data: { tenantId, userId, ...donnees } });
      } catch (e) {
        // Deux réglages simultanés du même titulaire · le second se pose sur la ligne née du premier.
        if ((e as { code?: unknown })?.code !== 'P2002') throw e;
        await this.prisma.preferenceUtilisateur.updateMany({ where: { tenantId, userId }, data: donnees });
      }
    }
    return this.lire(tenantId, userId);
  }

  /** Ses notifications · les plus récentes d'abord, bornées et dites ; les lues trop anciennes se retirent. */
  async notifications(tenantId: string, userId: string, maintenant = new Date()) {
    await this.prisma.notificationUtilisateur.deleteMany({
      where: { tenantId, destinataireId: userId, lueLe: { lt: new Date(maintenant.getTime() - CONSERVATION_LUES_JOURS * 24 * 3600 * 1000) } },
    });
    const [liste, total, nonLues] = await Promise.all([
      this.prisma.notificationUtilisateur.findMany({
        where: { tenantId, destinataireId: userId },
        orderBy: { creeeLe: 'desc' },
        take: TAILLE_LISTE_NOTIFICATIONS,
        select: { id: true, type: true, titre: true, lien: true, creeeLe: true, lueLe: true },
      }),
      this.prisma.notificationUtilisateur.count({ where: { tenantId, destinataireId: userId } }),
      this.prisma.notificationUtilisateur.count({ where: { tenantId, destinataireId: userId, lueLe: null } }),
    ]);
    return { notifications: liste, total, nonLues, tronque: total > liste.length };
  }

  async nonLues(tenantId: string, userId: string) {
    return { nonLues: await this.prisma.notificationUtilisateur.count({ where: { tenantId, destinataireId: userId, lueLe: null } }) };
  }

  async marquerLue(tenantId: string, userId: string, id: string) {
    const n = await this.prisma.notificationUtilisateur.count({ where: { tenantId, destinataireId: userId, id } });
    if (n === 0) throw new NotFoundException('Notification introuvable.');
    await this.prisma.notificationUtilisateur.updateMany({ where: { tenantId, destinataireId: userId, id, lueLe: null }, data: { lueLe: new Date() } });
    return { lue: true };
  }

  async toutLu(tenantId: string, userId: string) {
    const fait = await this.prisma.notificationUtilisateur.updateMany({ where: { tenantId, destinataireId: userId, lueLe: null }, data: { lueLe: new Date() } });
    return { lues: fait.count };
  }
}
