import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationVirementFonds, Prisma, SensVirementFonds, StatutEcriture, StatutExercice, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { assurerComptesDePassage } from './comptes-de-passage';
import { empreinteDocument, identifierType, motifRefusDocument, nettoyerNomFichier, decoderNomMultipart } from '../tiers/documents-tiers';
import {
  COMPTES_DE_PASSAGE,
  LIBELLES_NATURE_PIECE,
  LIBELLES_SENS,
  aLOperation,
  deLOperation,
  estTresorerieEnDevises,
  estUneCaisse,
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
          pieces: { select: { id: true, operation: true, nomFichier: true, taille: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.virementFonds.count({ where: { tenantId, exerciceId } }),
    ]);
    return {
      journaux: journaux.map((j) => ({ ...j, caisse: j.compteTresorerie ? estUneCaisse(j.compteTresorerie.numero) : false })),
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
   * devise, pièces, dates, porteur), puis les deux écritures et la fiche
   * naissent dans UNE transaction (`creerPlusieursAvec`) · un arrêt entre deux
   * laisserait le 585 à moitié passé, non soldé à la clôture. La sortie est
   * datée par sa pièce, l'entrée par la sienne (AUDCIF art. 16, al. 2).
   */
  async creer(tenantId: string, userId: string, dto: CreerVirementDto) {
    const lus = await this.journaux(tenantId, [dto.journalOrigineId, dto.journalDestinationId]);
    const origine = lus.find((j) => j.id === dto.journalOrigineId) ?? null;
    const destination = lus.find((j) => j.id === dto.journalDestinationId) ?? null;
    // UNE DATE, LE JOUR SEUL · le même pour l'écriture, la pièce et la fiche.
    const sortie = { ...dto.sortie, reference: dto.sortie.reference.trim(), date: dto.sortie.date.slice(0, 10) };
    const entree = { ...dto.entree, reference: dto.entree.reference.trim(), date: dto.entree.date.slice(0, 10) };
    const motif = motifRefusVirement(origine, destination, {
      montant: dto.montant,
      objet: dto.objet,
      sortie,
      entree,
      porteur: dto.porteur,
    });
    if (motif) throw new BadRequestException(motif);
    // LES DEUX OPÉRATIONS DANS L'EXERCICE · le compte de passage attend
    // l'entrée entre les deux dates, et il est « soldé à la fin de
    // l'exercice » (fiche du compte 58 des deux plans). Une entrée sur
    // l'exercice suivant le laisserait ouvert à la clôture.
    const exercice = await this.prisma.exercice.findFirst({
      where: { id: dto.exerciceId, tenantId },
      select: { dateDebut: true, dateFin: true },
    });
    if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    const [debut, fin] = [exercice.dateDebut.toISOString().slice(0, 10), exercice.dateFin.toISOString().slice(0, 10)];
    for (const [piece, operation] of [
      [sortie, OperationVirementFonds.SORTIE],
      [entree, OperationVirementFonds.ENTREE],
    ] as const) {
      if (piece.date < debut || piece.date > fin) {
        throw new BadRequestException(
          `La date ${deLOperation(operation)} (${piece.date.split('-').reverse().join('/')}) tombe hors de l'exercice · ` +
            "le compte de passage se solde à la fin de l'exercice (fiche du compte 58). " +
            "Une entrée qui tombe sur l'exercice suivant se passe à la main.",
        );
      }
    }
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
    // UNE CAISSE NE PORTE AUCUN RIB · sa devise se lit sur le compte, rangé par
    // le plan sous une racine « en devises », ou porteur d'une ligne en devise.
    const dossier = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    const comptes = [origine!, destination!].map((j) => ({ code: j.code, ...j.compteTresorerie! }));
    // Une SIMULATION en devise ne dit rien du compte (ligne sage-l1, second
    // tour, c) · une écriture de situation n'enregistre aucune opération
    // (`ecritures-de-situation.ts`), et lue ici elle faisait refuser le
    // virement d'une caisse en francs.
    const lignesEnDevise = await this.prisma.ligneEcriture.findMany({
      where: { compteId: { in: comptes.map((c) => c.id) }, deviseId: { not: null }, ecriture: { tenantId, ...HORS_SITUATION } },
      select: { compteId: true },
      distinct: ['compteId'],
    });
    const enDevises = comptes.find(
      (c) => estTresorerieEnDevises(c.numero, dossier.referentiel) || lignesEnDevise.some((l) => l.compteId === c.id),
    );
    if (enDevises) {
      throw new BadRequestException(
        `Le compte ${enDevises.numero} du journal ${enDevises.code} est tenu en devise · un virement de fonds se passe en francs, ` +
          'et la conversion des disponibilités à la clôture (AUDCIF art. 57) ne lit que les lignes en devise. ' +
          'Passez ce virement à la main, avec le montant en devise et le cours de chaque ligne.',
      );
    }
    const sens = sensDuVirement(origine!.compteTresorerie!.numero, destination!.compteTresorerie!.numero);
    const passage = (
      await transactionJournalisee(this.prisma, async (tx) => {
        // DEUX PREMIERS VIREMENTS EN MÊME TEMPS calculaient le même numéro, et
        // le second tombait en 500 sur la clé unique.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`comptes-de-passage:${tenantId}`}))`;
        return assurerComptesDePassage(tx, tenantId);
      })
    )[sens];
    // CHAQUE ÉCRITURE PORTE LA RÉFÉRENCE DE SA PIÈCE (AUDCIF art. 17, 5°).
    const reference = (p: typeof sortie) => `${LIBELLES_NATURE_PIECE[p.nature]} ${p.reference}`.slice(0, 190);
    const libelle = `Virement de fonds · ${dto.objet.trim()}`.slice(0, 190);
    const lignes = lignesDuVirement({
      compteOrigineId: origine!.compteTresorerie!.id,
      compteDestinationId: destination!.compteTresorerie!.id,
      comptePassageId: passage.id,
      montant: dto.montant,
      libelle,
    });
    const ecriture = (journalId: string, p: typeof sortie, l: typeof lignes.origine) => ({
      exerciceId: dto.exerciceId,
      journalId,
      date: p.date,
      libelle,
      reference: reference(p),
      lignes: l,
    });
    const r = await this.ecritures.creerPlusieursAvec(
      tenantId,
      userId,
      [ecriture(origine!.id, sortie, lignes.origine), ecriture(destination!.id, entree, lignes.destination)],
      async (tx, [eo, ed]) => {
        const numeros = await tx.ecriture.findMany({ where: { id: { in: [eo.id, ed.id] }, tenantId }, select: { id: true, numeroPiece: true } });
        const numero = (id: string) => numeros.find((n) => n.id === id)?.numeroPiece ?? '·';
        return tx.virementFonds.create({
          data: {
            tenantId,
            exerciceId: dto.exerciceId,
            date: new Date(`${sortie.date}T00:00:00.000Z`),
            montant: new Prisma.Decimal(dto.montant),
            sens,
            journalOrigineId: origine!.id,
            journalDestinationId: destination!.id,
            naturePiece: sortie.nature,
            referencePiece: sortie.reference,
            datePiece: new Date(`${sortie.date}T00:00:00.000Z`),
            naturePieceEntree: entree.nature,
            referencePieceEntree: entree.reference,
            datePieceEntree: new Date(`${entree.date}T00:00:00.000Z`),
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
    if (motif.length < 3) throw new BadRequestException("Le motif de l'annulation est exigé · trois caractères au moins.");
    return transactionJournalisee(this.prisma, async (tx) => {
      // Les liens se défont d'abord · une pièce que la fiche retient ne se
      // retire pas, et la fiche ne garde que ses numéros (`piecesPassees`).
      // UNE SEULE ANNULATION · le second geste concurrent attend le verrou de
      // ligne puis ne trouve plus de fiche en vigueur, et le dit.
      const prise = await tx.virementFonds.updateMany({
        where: { id: v.id, tenantId, annuleLe: null },
        data: { ecritureOrigineId: null, ecritureDestinationId: null },
      });
      if (prise.count !== 1) throw new ConflictException('Ce virement est déjà annulé.');
      const negatifs: Record<'origine' | 'destination', string | null> = { origine: null, destination: null };
      const numerosNegatifs: string[] = [];
      for (const [cote, ecritureId] of [
        ['origine', v.ecritureOrigineId],
        ['destination', v.ecritureDestinationId],
      ] as const) {
        if (!ecritureId) continue;
        const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
        if (!e) throw new ConflictException("Une pièce du virement n'existe plus · relisez le virement avant de l'annuler.");
        if (e.statut === StatutEcriture.BROUILLARD) {
          // RELU DANS LA TRANSACTION · une ligne au brouillard se lettre ou se
          // pointe ; lue avant, elle laissait un groupe amputé.
          const relues = await tx.ligneEcriture.findMany({
            where: { ecritureId, ecriture: { tenantId } },
            select: { lettre: true, lettrageId: true, rapprochementId: true },
          });
          const tenue = motifLignesTenues(relues, 'une pièce du virement', 'annuler le virement');
          if (tenue) throw new BadRequestException(tenue);
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
          const lu = await tx.ecriture.findFirst({ where: { id: negatif.id, tenantId }, select: { numeroPiece: true } });
          numerosNegatifs.push(`n° ${lu?.numeroPiece ?? '·'}`);
        }
      }
      return tx.virementFonds.update({
        where: { id: v.id, tenantId },
        data: {
          annuleLe: new Date(),
          annulePar: userId,
          motifAnnulation: motif,
          // LA TRACE DIT CE QUI EST ARRIVÉ AUX PIÈCES · un numéro retiré du
          // brouillard est redonné à la pièce suivante (numérotation tirée du
          // maximum), et la fiche le désignait encore.
          piecesPassees: `${v.piecesPassees ?? ''} · ${
            numerosNegatifs.length === 0
              ? 'retirées du brouillard, numéros libérés'
              : numerosNegatifs.length === 1 && ids.length === 2
                ? `une retirée du brouillard, une inscrite en négatif (${numerosNegatifs[0]})`
                : `inscrites en négatif (${numerosNegatifs.join(', ')})`
          }`.slice(0, 190),
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

  /**
   * PIÈCE JOINTE · le scan de la pièce d'UNE opération, la sortie ou l'entrée,
   * contrôlé comme un document de tiers. Le même document peut appuyer les
   * deux côtés · il se joint alors à chacun.
   */
  async deposerPiece(
    tenantId: string,
    virementId: string,
    operation: string | undefined,
    fichier: { originalname: string; buffer: Buffer } | undefined,
    email: string,
  ) {
    if (operation !== OperationVirementFonds.SORTIE && operation !== OperationVirementFonds.ENTREE) {
      throw new BadRequestException("Dites à quelle opération se joint la pièce · la sortie des fonds (SORTIE) ou leur entrée (ENTREE).");
    }
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
          operation,
          nomFichier: nom,
          typeMime: type.typeMime,
          taille: fichier.buffer.length,
          empreinte: empreinteDocument(fichier.buffer),
          contenu: fichier.buffer,
          deposePar: email,
        },
        select: { id: true, operation: true, nomFichier: true, taille: true, createdAt: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Cette pièce est déjà jointe ${aLOperation(operation)}.`);
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
