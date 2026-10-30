import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MethodeArrondi, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { referencesVers, refuserSiReferences } from '../../common/suppression/references';
import { motifRefusIntitule, motifRefusPas } from './arrondi';
import { LIBELLES_ROLES, ROLES_COLLABORATEUR, motifRefusNomCollaborateur, roleExigePour, type RoleCollaborateur } from './collaborateurs';
import { CollaborateurDto, ModeArrondiDto, ModifierCollaborateurDto, ModifierModeArrondiDto } from './dto/structures.dto';

/** Les modes d'arrondi et les collaborateurs d'un dossier · quelques dizaines en pratique, la borne se dit (§ 8 bis). */
export const PLAFOND_STRUCTURES_COMMERCIALES = 500;

const vueMode = (m: { id: string; intitule: string; methode: MethodeArrondi; pas: Prisma.Decimal; actif: boolean }) => ({ ...m, pas: Number(m.pas) });

/**
 * MODES D'ARRONDI (fonction 94) ET COLLABORATEURS (fonction 91) · deux
 * structures de la gestion commerciale, sans écriture. Les règles sont dans
 * `arrondi.ts` et `collaborateurs.ts`.
 */
@Injectable()
export class StructuresCommercialesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- arrondis

  async listerModes(tenantId: string) {
    const [modes, total] = await Promise.all([
      this.prisma.modeArrondi.findMany({ where: { tenantId }, orderBy: { intitule: 'asc' }, take: PLAFOND_STRUCTURES_COMMERCIALES, select: { id: true, intitule: true, methode: true, pas: true, actif: true } }),
      this.prisma.modeArrondi.count({ where: { tenantId } }),
    ]);
    return { total, tronque: total > modes.length, modes: modes.map(vueMode) };
  }

  private conflitIntitule(e: unknown, intitule: string) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException(`Un mode d’arrondi s’intitule déjà « ${intitule} » dans ce dossier.`);
    }
    return e;
  }

  async creerMode(tenantId: string, userId: string, dto: ModeArrondiDto) {
    const m = motifRefusIntitule(dto.intitule) ?? motifRefusPas(dto.pas);
    if (m) throw new BadRequestException(m);
    const intitule = dto.intitule.trim();
    try {
      const r = await this.prisma.modeArrondi.create({
        data: { tenantId, intitule, methode: dto.methode, pas: new Prisma.Decimal(dto.pas), createdBy: userId },
        select: { id: true, intitule: true, methode: true, pas: true, actif: true },
      });
      return vueMode(r);
    } catch (e) {
      throw this.conflitIntitule(e, intitule);
    }
  }

  async modifierMode(tenantId: string, id: string, dto: ModifierModeArrondiDto) {
    const actuel = await this.prisma.modeArrondi.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!actuel) throw new NotFoundException('Mode d’arrondi introuvable dans ce dossier.');
    const m = (dto.intitule === undefined ? null : motifRefusIntitule(dto.intitule)) ?? (dto.pas === undefined ? null : motifRefusPas(dto.pas));
    if (m) throw new BadRequestException(m);
    const intitule = dto.intitule?.trim();
    try {
      const r = await this.prisma.modeArrondi.update({
        where: { id },
        data: {
          ...(intitule === undefined ? {} : { intitule }),
          ...(dto.methode === undefined ? {} : { methode: dto.methode }),
          ...(dto.pas === undefined ? {} : { pas: new Prisma.Decimal(dto.pas) }),
          ...(dto.actif === undefined ? {} : { actif: dto.actif }),
        },
        select: { id: true, intitule: true, methode: true, pas: true, actif: true },
      });
      // UN MODE MIS EN SOMMEIL QUE DES ARTICLES PORTENT SE DIT (relecture
      // indépendante, mineur 4) · leurs prix se proposeront au centime.
      const portes = dto.actif === false ? await this.prisma.articleCommercial.count({ where: { tenantId, modeArrondiId: id } }) : 0;
      return {
        ...vueMode(r),
        avertissement: portes ? `${portes} article(s) portent ce mode · tant qu’il est en sommeil, leur prix net se propose au centime.` : null,
      };
    } catch (e) {
      throw this.conflitIntitule(e, intitule ?? '');
    }
  }

  async supprimerMode(tenantId: string, id: string) {
    const m = await this.prisma.modeArrondi.findFirst({ where: { id, tenantId }, select: { intitule: true } });
    if (!m) throw new NotFoundException('Mode d’arrondi introuvable dans ce dossier.');
    refuserSiReferences(`Le mode d’arrondi « ${m.intitule} »`, await referencesVers(this.prisma, 'ModeArrondi', id, tenantId));
    await this.prisma.modeArrondi.delete({ where: { id } });
    return { supprime: true };
  }

  // ----------------------------------------------------------- collaborateurs

  async listerCollaborateurs(tenantId: string) {
    const [collaborateurs, total] = await Promise.all([
      this.prisma.collaborateur.findMany({
        where: { tenantId },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        take: PLAFOND_STRUCTURES_COMMERCIALES,
        select: {
          id: true, nom: true, prenom: true, fonction: true, telephone: true, email: true,
          vendeur: true, caissier: true, acheteur: true, controleur: true, financier: true, recouvrement: true, actif: true,
          _count: { select: { tiersRepresentes: true } },
        },
      }),
      this.prisma.collaborateur.count({ where: { tenantId } }),
    ]);
    return {
      total,
      tronque: total > collaborateurs.length,
      collaborateurs: collaborateurs.map(({ _count, ...c }) => ({ ...c, tiersRepresentes: _count.tiersRepresentes })),
    };
  }

  private static texte(v: string | null | undefined) {
    if (v === undefined) return undefined;
    const t = v?.trim();
    return t ? t : null;
  }

  async creerCollaborateur(tenantId: string, userId: string, dto: CollaborateurDto) {
    const m = motifRefusNomCollaborateur(dto.nom);
    if (m) throw new BadRequestException(m);
    const roles = Object.fromEntries(ROLES_COLLABORATEUR.map((r) => [r, dto[r] ?? false])) as Record<RoleCollaborateur, boolean>;
    return this.prisma.collaborateur.create({
      data: {
        tenantId,
        nom: dto.nom.trim(),
        prenom: StructuresCommercialesService.texte(dto.prenom) ?? null,
        fonction: StructuresCommercialesService.texte(dto.fonction) ?? null,
        telephone: StructuresCommercialesService.texte(dto.telephone) ?? null,
        email: StructuresCommercialesService.texte(dto.email) ?? null,
        ...roles,
        createdBy: userId,
      },
    });
  }

  /**
   * UN RÔLE OU UNE MISE EN SOMMEIL QUI LAISSERAIT UN TIERS SANS REPRÉSENTANT
   * VALABLE EST REFUSÉ, avec le nombre de tiers et l'issue · sans quoi la fiche
   * du client nommerait un vendeur qui ne vend plus, et personne ne le verrait.
   */
  async modifierCollaborateur(tenantId: string, id: string, dto: ModifierCollaborateurDto) {
    const actuel = await this.prisma.collaborateur.findFirst({ where: { id, tenantId } });
    if (!actuel) throw new NotFoundException('Collaborateur introuvable dans ce dossier.');
    if (dto.nom !== undefined) {
      const m = motifRefusNomCollaborateur(dto.nom);
      if (m) throw new BadRequestException(m);
    }
    const retires = ROLES_COLLABORATEUR.filter((r) => actuel[r] && dto[r] === false);
    const misEnSommeil = actuel.actif && dto.actif === false;
    if (retires.length || misEnSommeil) {
      // Compté par type en base, jamais une liste rapatriée (§ 8 bis, mineur 7).
      const parType = await this.prisma.tiers.groupBy({ by: ['type'], where: { tenantId, representantId: id }, _count: { _all: true } });
      const touches = parType
        .filter((t) => {
          const role = roleExigePour(t.type);
          return misEnSommeil || (role !== null && retires.includes(role));
        })
        .reduce((n, t) => n + t._count._all, 0);
      if (touches) {
        const quoi = misEnSommeil ? 'mis en sommeil' : `privé du rôle de ${retires.map((r) => LIBELLES_ROLES[r]).join(' et ')}`;
        throw new ConflictException(
          `Ce collaborateur représente ${touches} tiers qui exigent ce rôle · il ne peut être ${quoi} tant qu’il les représente. Changez d’abord leur représentant dans Plan des tiers.`,
        );
      }
    }
    const roles = Object.fromEntries(ROLES_COLLABORATEUR.filter((r) => dto[r] !== undefined).map((r) => [r, dto[r]]));
    return this.prisma.collaborateur.update({
      where: { id },
      data: {
        ...(dto.nom === undefined ? {} : { nom: dto.nom.trim() }),
        ...(dto.prenom === undefined ? {} : { prenom: StructuresCommercialesService.texte(dto.prenom) }),
        ...(dto.fonction === undefined ? {} : { fonction: StructuresCommercialesService.texte(dto.fonction) }),
        ...(dto.telephone === undefined ? {} : { telephone: StructuresCommercialesService.texte(dto.telephone) }),
        ...(dto.email === undefined ? {} : { email: StructuresCommercialesService.texte(dto.email) }),
        ...roles,
        ...(dto.actif === undefined ? {} : { actif: dto.actif }),
      },
    });
  }

  async supprimerCollaborateur(tenantId: string, id: string) {
    const c = await this.prisma.collaborateur.findFirst({ where: { id, tenantId }, select: { nom: true, prenom: true } });
    if (!c) throw new NotFoundException('Collaborateur introuvable dans ce dossier.');
    refuserSiReferences(`Le collaborateur ${[c.prenom, c.nom].filter(Boolean).join(' ')}`, await referencesVers(this.prisma, 'Collaborateur', id, tenantId));
    await this.prisma.collaborateur.delete({ where: { id } });
    return { supprime: true };
  }
}
