import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SensVirementFonds, StatutEcriture, StatutExercice, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { assurerComptesDePassage } from './comptes-de-passage';
import { empreinteDocument, identifierType, motifRefusDocument, nettoyerNomFichier, decoderNomMultipart } from '../tiers/documents-tiers';
import {
  COMPTES_DE_PASSAGE,
  LIBELLES_NATURE_PIECE,
  LIBELLES_SENS,
  lignesDuVirement,
  motifRefusVirement,
  sensDuVirement,
  type JournalDeTresorerie,
} from './virement-fonds';
import type { AnnulerVirementDto, CreerVirementDto } from './virements-fonds.dto';

/** Une liste bornée qui dit son total · jamais une collection sans borne (CLAUDE.md § 8 bis). */
const PLAFOND_LISTE = 500;

@Injectable()
export class VirementsFondsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
  ) {}

  private async journaux(tenantId: string, ids: string[]): Promise<JournalDeTresorerie[]> {
    return this.prisma.journal.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, code: true, type: true, estActif: true, compteTresorerie: { select: { id: true, numero: true, intitule: true } } },
    });
  }

  /**
   * L'ÉCRAN · les journaux de trésorerie du dossier (le sens s'en déduit), les
   * quatre comptes de passage tels qu'ils sont tenus, et les virements de
   * l'exercice, les plus récents d'abord, bornés · le total le dit.
   */
  async lister(tenantId: string, exerciceId: string) {
    const [journaux, liens, virements, total] = await Promise.all([
      this.prisma.journal.findMany({
        where: { tenantId, type: TypeJournal.TRESORERIE, estActif: true, compteTresorerieId: { not: null } },
        select: { id: true, code: true, intitule: true, compteTresorerie: { select: { id: true, numero: true, intitule: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.compteVirementFonds.findMany({
        where: { tenantId },
        select: { sens: true, compte: { select: { numero: true, intitule: true } } },
      }),
      this.prisma.virementFonds.findMany({
        where: { tenantId, exerciceId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: PLAFOND_LISTE,
        include: {
          journalOrigine: { select: { code: true } },
          journalDestination: { select: { code: true } },
          ecritureOrigine: { select: { numeroPiece: true, statut: true } },
          ecritureDestination: { select: { numeroPiece: true, statut: true } },
          pieces: { select: { id: true, nomFichier: true, taille: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.virementFonds.count({ where: { tenantId, exerciceId } }),
    ]);
    return {
      journaux: journaux.map((j) => ({ ...j, caisse: j.compteTresorerie ? j.compteTresorerie.numero.startsWith('57') : false })),
      comptesDePassage: (Object.keys(COMPTES_DE_PASSAGE) as SensVirementFonds[]).map((sens) => ({
        sens,
        libelle: LIBELLES_SENS[sens],
        compte: liens.find((l) => l.sens === sens)?.compte ?? null,
      })),
      virements: virements.map((v) => ({ ...v, montant: Number(v.montant) })),
      total,
      tronque: total > virements.length,
    };
  }

  /**
   * UN VIREMENT · tout se juge AVANT la première pièce (journaux, comptes,
   * devise, pièce, porteur), puis les deux pièces et la fiche naissent dans
   * UNE transaction (`creerPlusieursAvec`) · un arrêt entre deux laisserait le
   * 585 à moitié passé, non soldé à la clôture.
   */
  async creer(tenantId: string, userId: string, dto: CreerVirementDto) {
    const lus = await this.journaux(tenantId, [dto.journalOrigineId, dto.journalDestinationId]);
    const origine = lus.find((j) => j.id === dto.journalOrigineId) ?? null;
    const destination = lus.find((j) => j.id === dto.journalDestinationId) ?? null;
    const motif = motifRefusVirement(origine, destination, {
      montant: dto.montant,
      objet: dto.objet,
      referencePiece: dto.referencePiece,
      porteur: dto.porteur,
    });
    if (motif) throw new BadRequestException(motif);
    // UN VIREMENT SE FAIT EN FRANCS · une banque tenue en devise porte ses
    // lignes avec leur montant en devise et leur cours (F49), qu'une pièce en
    // francs perdrait, et la conversion des disponibilités à la clôture (AUDCIF
    // art. 57) ne la trouverait plus. Le change se passe à la main.
    const ribs = await this.prisma.ribBanque.findMany({
      where: { tenantId, journalId: { in: [origine!.id, destination!.id] }, devise: { not: null } },
      select: { devise: true, journal: { select: { code: true } } },
    });
    const enDevise = ribs.find((r) => (r.devise ?? '').toUpperCase() !== MONNAIE_DE_TENUE);
    if (enDevise) {
      throw new BadRequestException(
        `Le journal ${enDevise.journal?.code ?? '·'} est tenu en ${enDevise.devise} · un virement de fonds se passe en francs. ` +
          'Passez ce virement à la main, avec le montant en devise et le cours de chaque ligne.',
      );
    }
    const sens = sensDuVirement(origine!.compteTresorerie!.numero, destination!.compteTresorerie!.numero);
    const passage = (await transactionJournalisee(this.prisma, (tx) => assurerComptesDePassage(tx, tenantId)))[sens];
    const reference = `${LIBELLES_NATURE_PIECE[dto.naturePiece]} ${dto.referencePiece.trim()}`.slice(0, 190);
    const libelle = `Virement de fonds ${LIBELLES_SENS[sens]} · ${dto.objet.trim()}`.slice(0, 190);
    const lignes = lignesDuVirement({
      compteOrigineId: origine!.compteTresorerie!.id,
      compteDestinationId: destination!.compteTresorerie!.id,
      comptePassageId: passage.id,
      montant: dto.montant,
      libelle,
    });
    const piece = (journalId: string, l: typeof lignes.origine) => ({
      exerciceId: dto.exerciceId,
      journalId,
      date: dto.date,
      libelle,
      reference,
      lignes: l,
    });
    const r = await this.ecritures.creerPlusieursAvec(
      tenantId,
      userId,
      [piece(origine!.id, lignes.origine), piece(destination!.id, lignes.destination)],
      async (tx, [eo, ed]) => {
        const numeros = await tx.ecriture.findMany({ where: { id: { in: [eo.id, ed.id] }, tenantId }, select: { id: true, numeroPiece: true } });
        const numero = (id: string) => numeros.find((n) => n.id === id)?.numeroPiece ?? '·';
        return tx.virementFonds.create({
          data: {
            tenantId,
            exerciceId: dto.exerciceId,
            date: new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`),
            montant: new Prisma.Decimal(dto.montant),
            sens,
            journalOrigineId: origine!.id,
            journalDestinationId: destination!.id,
            naturePiece: dto.naturePiece,
            referencePiece: dto.referencePiece.trim(),
            datePiece: new Date(`${dto.datePiece.slice(0, 10)}T00:00:00.000Z`),
            objet: dto.objet.trim(),
            porteur: dto.porteur?.trim() || null,
            observations: dto.observations?.trim() || null,
            ecritureOrigineId: eo.id,
            ecritureDestinationId: ed.id,
            piecesPassees: `${origine!.code} n° ${numero(eo.id)} · ${destination!.code} n° ${numero(ed.id)}`,
            createdBy: userId,
          },
        });
      },
    );
    return { ...r.suite, montant: Number(r.suite.montant), comptePassage: passage };
  }

  /**
   * ANNULER UN VIREMENT (AUDCIF art. 20, al. 2) · ses deux pièces ensemble ·
   * au brouillard retirées, validées inscrites en négatif, la fiche MARQUÉE
   * annulée, jamais supprimée. Refus · déjà annulé, exercice clôturé, ligne
   * lettrée ou pointée (le pointage affirme la concordance avec un relevé).
   */
  async annuler(tenantId: string, userId: string, id: string, dto: AnnulerVirementDto) {
    const v = await this.prisma.virementFonds.findFirst({
      where: { id, tenantId },
      include: { exercice: { select: { statut: true } } },
    });
    if (!v) throw new NotFoundException('Virement introuvable pour ce dossier.');
    if (v.annuleLe) throw new ConflictException('Ce virement est déjà annulé.');
    if (v.exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException("Ce virement appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).");
    }
    const ids = [v.ecritureOrigineId, v.ecritureDestinationId].filter((x): x is string => !!x);
    const ecritures = await this.prisma.ecriture.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true, numeroPiece: true, statut: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
    });
    for (const e of ecritures) {
      const tenue = motifLignesTenues(e.lignes, `la pièce n° ${e.numeroPiece ?? '·'}`, 'annuler le virement');
      if (tenue) throw new BadRequestException(tenue);
    }
    const motif = dto.motif.trim();
    return transactionJournalisee(this.prisma, async (tx) => {
      // Les liens se défont d'abord · une pièce que la fiche retient ne se
      // retire pas, et la fiche ne garde que ses numéros (`piecesPassees`).
      await tx.virementFonds.update({ where: { id: v.id }, data: { ecritureOrigineId: null, ecritureDestinationId: null } });
      const negatifs: Record<'origine' | 'destination', string | null> = { origine: null, destination: null };
      for (const [cote, ecritureId] of [
        ['origine', v.ecritureOrigineId],
        ['destination', v.ecritureDestinationId],
      ] as const) {
        if (!ecritureId) continue;
        const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
        if (!e) throw new ConflictException("Une pièce du virement n'existe plus · relisez le virement avant de l'annuler.");
        if (e.statut === StatutEcriture.BROUILLARD) {
          await tx.ligneEcriture.deleteMany({ where: { ecritureId, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
          const r = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
          if (r.count !== 1) {
            throw new ConflictException(
              "Une pièce du virement a été validée pendant l'annulation · rien n'est retiré. Relancez l'annulation · validée, elle s'inscrira en négatif.",
            );
          }
        } else {
          const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, `Annulation du virement · ${motif}`, tx);
          negatifs[cote] = negatif.id;
        }
      }
      return tx.virementFonds.update({
        where: { id: v.id },
        data: {
          annuleLe: new Date(),
          annulePar: userId,
          motifAnnulation: motif,
          // Une pièce validée reste au journal, que le virement retient avec
          // son négatif · la retirer laisserait le négatif seul.
          ecritureOrigineId: negatifs.origine ? v.ecritureOrigineId : null,
          ecritureDestinationId: negatifs.destination ? v.ecritureDestinationId : null,
          ecritureNegatifOrigineId: negatifs.origine,
          ecritureNegatifDestinationId: negatifs.destination,
        },
      });
    });
  }

  /** PIÈCE JOINTE · le scan de la pièce justificative, contrôlé comme un document de tiers. */
  async deposerPiece(tenantId: string, virementId: string, fichier: { originalname: string; buffer: Buffer } | undefined, email: string) {
    const v = await this.prisma.virementFonds.findFirst({ where: { id: virementId, tenantId }, select: { id: true } });
    if (!v) throw new NotFoundException('Virement introuvable pour ce dossier.');
    if (!fichier) throw new BadRequestException('Aucun fichier reçu · joignez le scan de la pièce.');
    const nom = nettoyerNomFichier(decoderNomMultipart(fichier.originalname));
    const refus = motifRefusDocument({ nom, contenu: fichier.buffer });
    if (refus) throw new BadRequestException(refus);
    const type = identifierType(fichier.buffer, nom);
    if ('refus' in type) throw new BadRequestException(type.refus);
    try {
      return await this.prisma.pieceVirementFonds.create({
        data: {
          tenantId,
          virementId: v.id,
          nomFichier: nom,
          typeMime: type.typeMime,
          taille: fichier.buffer.length,
          empreinte: empreinteDocument(fichier.buffer),
          contenu: fichier.buffer,
          deposePar: email,
        },
        select: { id: true, nomFichier: true, taille: true, createdAt: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Cette pièce est déjà jointe à ce virement.');
      }
      throw e;
    }
  }

  async telechargerPiece(tenantId: string, id: string) {
    const p = await this.prisma.pieceVirementFonds.findFirst({
      where: { id, tenantId },
      select: { nomFichier: true, typeMime: true, contenu: true },
    });
    if (!p) throw new NotFoundException('Pièce introuvable pour ce dossier.');
    return p;
  }
}
