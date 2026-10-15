import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { referencesVers, refuserSiReferences } from '../../common/suppression/references';
import { MODES_USUELS, PLAFOND_MODES_REGLEMENT, motifRefusIdentiteMode } from './modes-reglement';
import { CreerModeReglementDto, ModifierModeReglementDto } from './modes-reglement.dto';

type LecteurModes = Pick<PrismaService, 'modeReglement'>;

/**
 * LE MODE DÉSIGNÉ PAR UNE AUTRE STRUCTURE (fiche du tiers, échéance d'un
 * modèle, ligne d'écriture, règlement) · du dossier, sinon introuvable ; en
 * sommeil, refusé (un mode mis en sommeil n'est plus proposé, et il ne se
 * pose plus). La clé étrangère ne vérifie que l'existence de l'identifiant,
 * jamais son dossier · sans ce contrôle, un appel direct rattacherait le mode
 * d'un autre cabinet.
 */
export async function modeDuDossier(prisma: LecteurModes, tenantId: string, id: string) {
  const mode = await prisma.modeReglement.findFirst({
    where: { id, tenantId },
    select: { id: true, code: true, intitule: true, nature: true, estActif: true, journalId: true },
  });
  if (!mode) throw new NotFoundException('Mode de règlement introuvable pour ce dossier.');
  if (!mode.estActif) {
    throw new BadRequestException(
      `Le mode de règlement ${mode.code} (${mode.intitule}) est en sommeil · réactivez-le dans Modes de règlement, ou choisissez-en un autre.`,
    );
  }
  return mode;
}

/** Les modes de règlement du dossier (ligne sage-l2, fonction 1) · règles dans `modes-reglement.ts`. */
@Injectable()
export class ModesReglementService {
  constructor(private readonly prisma: PrismaService) {}

  /** Trente au plus (P_REGLEMENT de Sage) · la borne de la table est celle de la liste. */
  async lister(tenantId: string) {
    const modes = await this.prisma.modeReglement.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
      take: PLAFOND_MODES_REGLEMENT,
      select: {
        id: true,
        code: true,
        intitule: true,
        nature: true,
        codeInterbancaire: true,
        journalId: true,
        estActif: true,
        journal: { select: { code: true, intitule: true } },
      },
    });
    return modes;
  }

  async creer(tenantId: string, userId: string, dto: CreerModeReglementDto) {
    const motif = motifRefusIdentiteMode(dto.code, dto.intitule);
    if (motif) throw new BadRequestException(motif);
    if (dto.journalId) await this.verifierJournal(tenantId, dto.journalId);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        // Le plafond se compte sous un verrou du dossier · deux créations
        // simultanées liraient sinon chacune vingt-neuf modes.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`modes-reglement:${tenantId}`}))`;
        const nombre = await tx.modeReglement.count({ where: { tenantId } });
        if (nombre >= PLAFOND_MODES_REGLEMENT) {
          throw new BadRequestException(
            `Le dossier tient déjà ${PLAFOND_MODES_REGLEMENT} modes de règlement, le nombre que Sage admet · mettez en sommeil ou supprimez un mode inutile.`,
          );
        }
        return tx.modeReglement.create({
          data: {
            tenantId,
            code: dto.code.trim().toUpperCase(),
            intitule: dto.intitule.trim(),
            nature: dto.nature,
            codeInterbancaire: dto.codeInterbancaire?.trim() || null,
            journalId: dto.journalId ?? null,
            createdBy: userId,
          },
        });
      });
    } catch (e) {
      throw this.dejaPris(e, dto.code, dto.intitule);
    }
  }

  /**
   * LES MODES USUELS, d'un geste (espèces, chèque, virement, carte bancaire,
   * monnaie électronique) · ceux dont le code ou l'intitulé est déjà pris ne
   * sont pas recréés, et le compte rendu le dit. Rien n'est créé à la
   * lecture · une lecture n'écrit jamais.
   */
  async creerUsuels(tenantId: string, userId: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`modes-reglement:${tenantId}`}))`;
      const existants = await tx.modeReglement.findMany({ where: { tenantId }, select: { code: true, intitule: true } });
      const codes = new Set(existants.map((m) => m.code));
      const intitules = new Set(existants.map((m) => m.intitule.toLowerCase()));
      const crees: string[] = [];
      const dejaPresents: string[] = [];
      let place = PLAFOND_MODES_REGLEMENT - existants.length;
      for (const u of MODES_USUELS) {
        if (codes.has(u.code) || intitules.has(u.intitule.toLowerCase())) {
          dejaPresents.push(u.intitule);
          continue;
        }
        if (place <= 0) {
          dejaPresents.push(`${u.intitule} (plafond de ${PLAFOND_MODES_REGLEMENT} modes atteint)`);
          continue;
        }
        await tx.modeReglement.create({ data: { tenantId, code: u.code, intitule: u.intitule, nature: u.nature, createdBy: userId } });
        crees.push(u.intitule);
        place--;
      }
      return { crees, dejaPresents };
    });
  }

  async modifier(tenantId: string, id: string, dto: ModifierModeReglementDto) {
    const existant = await this.prisma.modeReglement.findFirst({ where: { id, tenantId }, select: { id: true, code: true } });
    if (!existant) throw new NotFoundException('Mode de règlement introuvable pour ce dossier.');
    if (dto.intitule !== undefined) {
      const motif = motifRefusIdentiteMode(existant.code, dto.intitule);
      if (motif) throw new BadRequestException(motif);
    }
    if (dto.journalId) await this.verifierJournal(tenantId, dto.journalId);
    try {
      return await this.prisma.modeReglement.update({
        where: { id },
        data: {
          ...(dto.intitule !== undefined ? { intitule: dto.intitule.trim() } : {}),
          ...(dto.nature !== undefined ? { nature: dto.nature } : {}),
          ...(dto.codeInterbancaire !== undefined ? { codeInterbancaire: dto.codeInterbancaire?.trim() || null } : {}),
          ...(dto.journalId !== undefined ? { journalId: dto.journalId } : {}),
          ...(dto.estActif !== undefined ? { estActif: dto.estActif } : {}),
        },
      });
    } catch (e) {
      throw this.dejaPris(e, existant.code, dto.intitule ?? '');
    }
  }

  /**
   * Retiré seulement s'il n'est porté par rien · tiers, échéance d'un modèle,
   * ligne d'écriture (relations lues dans le schéma, `references.ts`). Le
   * refus nomme chaque usage et renvoie à la mise en sommeil.
   */
  async supprimer(tenantId: string, id: string) {
    const existant = await this.prisma.modeReglement.findFirst({ where: { id, tenantId }, select: { id: true, code: true } });
    if (!existant) throw new NotFoundException('Mode de règlement introuvable pour ce dossier.');
    refuserSiReferences(`Le mode de règlement ${existant.code}`, await referencesVers(this.prisma, 'ModeReglement', id, tenantId));
    try {
      await this.prisma.modeReglement.delete({ where: { id } });
    } catch (e) {
      // PORTÉ ENTRE LE COMPTE ET LA SUPPRESSION · la clé étrangère refuse
      // (P2003), et le refus se dit comme le premier, recompté.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        refuserSiReferences(`Le mode de règlement ${existant.code}`, await referencesVers(this.prisma, 'ModeReglement', id, tenantId));
        throw new ConflictException(`Le mode de règlement ${existant.code} vient d’être employé · mettez-le en sommeil.`);
      }
      throw e;
    }
    return { supprime: true };
  }

  /** Le journal proposé est un journal de TRÉSORERIE du dossier · un règlement ne se passe nulle part ailleurs. */
  private async verifierJournal(tenantId: string, journalId: string) {
    const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { code: true, type: true } });
    if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    if (journal.type !== TypeJournal.TRESORERIE) {
      throw new BadRequestException(
        `Le journal ${journal.code} n'est pas un journal de trésorerie · un mode de règlement ne propose qu'un journal de banque ou de caisse.`,
      );
    }
  }

  /** Deux modes de même code ou de même intitulé rendraient la liste indéchiffrable · la base refuse, le refus se dit. */
  private dejaPris(e: unknown, code: string, intitule: string): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const cible = JSON.stringify(e.meta?.target ?? '');
      return new ConflictException(
        cible.includes('intitule')
          ? `Un mode de règlement « ${intitule.trim()} » existe déjà dans ce dossier.`
          : `Le code ${code.trim().toUpperCase()} est déjà celui d'un mode de règlement de ce dossier.`,
      );
    }
    return e;
  }
}
