import { detacherLesDetentionsAnnulees, detentionsQuiRetiennentLaFiche } from './detentions-de-la-fiche';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NatureMouvementDepreciation, Prisma, SensDepreciation, SensTransfertGroupe, StatutEcriture, StatutExercice, StatutImmobilisation, TypeJournal } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { prendreLeVerrouDuDossier } from '../../common/audit/extension-audit';
import { perimetreDeGroupe } from '../../common/cloisonnement/contexte-cloisonnement';
import { acteurCourant } from '../../common/audit/contexte-audit';
import { journalHorsPerimetre } from '../../common/perimetre/extension-perimetre-journaux';
import { libelleReference, referencesVers } from '../../common/suppression/references';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { prochainNumeroPiece } from '../journaux/numerotation-piece';
import { ImmobilisationService } from './immobilisation.service';
import {
  RACINES_LIAISON_BIEN,
  montantsDuTransfert,
  motifRefusBien,
  motifRefusCompteLiaison,
  motifRefusDossiers,
  piecesDuTransfert,
  type DossierDuGroupe,
  type MontantsDuTransfert,
} from './transfert-groupe';
import { TransfertGroupeDto } from './dto/transfert-groupe.dto';

/**
 * LIGNE SAGE-L4, N° 73 · LE TRANSFERT D'UN BIEN ENTRE DEUX DOSSIERS DU GROUPE,
 * demandé depuis le SIÈGE · seul dossier qui voit ses cellules (une cellule
 * ne voit jamais ses sœurs, ni la mère, `GroupeService`). Les règles sont dans
 * `transfert-groupe.ts`. Les deux pièces, les deux fiches et les deux côtés du
 * transfert naissent dans UNE transaction, sous le verrou des deux dossiers ·
 * un côté sans l'autre laisserait des comptes de liaison qui ne sont plus
 * égaux et de sens contraire (AUDCIF, Titre VII, fiche du compte 18).
 *
 * LA LECTURE HORS DU DOSSIER DE LA SESSION passe par `perimetreDeGroupe`,
 * construit ICI à partir du seul dossier de la session · jamais reçu d'un
 * appelant, sans quoi un client nommerait ses propres voisins.
 */

type Db = PrismaService | Prisma.TransactionClient;
const EPSILON = 0.005;
const jour = (d: Date) => d.toISOString().slice(0, 10);
const enDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Les transferts lus à l'écran · bien au-delà de ce qu'un groupe en passe. */
const PLAFOND_TRANSFERTS = 400;
const PLAFOND_BIENS = 500;

type Preparation = {
  groupe: string[];
  cedant: DossierDuGroupe & { nom: string };
  receveur: DossierDuGroupe & { nom: string };
  date: Date;
  datePiece: Date;
  referencePiece: string;
  exerciceCedant: { id: string; dateDebut: Date; dateFin: Date };
  exerciceReceveur: { id: string; dateDebut: Date; dateFin: Date };
  immo: Awaited<ReturnType<ImmobilisationService['situationAuTransfert']>>['immo'];
  montants: MontantsDuTransfert;
  journalCedant: { id: string; numerotation: Prisma.JournalGetPayload<object>['numerotation']; type: TypeJournal };
  journalReceveur: { id: string; numerotation: Prisma.JournalGetPayload<object>['numerotation']; type: TypeJournal };
  liaisonCedant: { id: string; numero: string };
  liaisonReceveur: { id: string; numero: string };
  comptesReceveur: { bien: string; amortissement: string; dotation: string; depreciation: string | null; contrepartieDepreciation: string | null };
  familleReceveurId: string;
  depreciationCedantId: string | null;
  numeroInventaireLibre: boolean;
  pieces: ReturnType<typeof piecesDuTransfert>;
};

@Injectable()
export class TransfertGroupeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly immobilisations: ImmobilisationService,
    private readonly ecritures: EcritureService,
  ) {}

  /** Le siège et ses cellules · refus nommé si la session n'est pas un siège. */
  private async groupeDuSiege(
    tenantId: string,
    db: Db = this.prisma,
  ): Promise<{ siege: { id: string; referentiel: string }; membres: Array<DossierDuGroupe & { nom: string }> }> {
    const siege = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nom: true, dossierMereId: true, referentiel: true, systemeComptableSyscohada: true },
    });
    if (!siege) throw new NotFoundException('Dossier introuvable.');
    if (siege.dossierMereId !== null) {
      throw new BadRequestException("Le transfert d'un bien dans le groupe se demande depuis le siège · c'est lui qui tient les deux comptabilités en vue.");
    }
    const cellules = await db.tenant.findMany({
      where: { dossierMereId: tenantId },
      select: { id: true, nom: true, dossierMereId: true, referentiel: true, systemeComptableSyscohada: true },
      orderBy: { nom: 'asc' },
      take: 1_000,
    });
    if (cellules.length === 0) throw new BadRequestException("Ce dossier n'a aucune cellule · le transfert d'un bien se fait entre le siège et une de ses cellules.");
    return { siege, membres: [siege, ...cellules] };
  }

  /** Les dossiers du groupe, leurs exercices ouverts, leurs journaux d'opérations diverses et leurs comptes de liaison 184 et 185. */
  async contexte(tenantId: string) {
    const { siege, membres } = await this.groupeDuSiege(tenantId);
    const ids = membres.map((m) => m.id);
    return perimetreDeGroupe(ids, async () => {
      const [exercices, journaux, comptes] = await Promise.all([
        this.prisma.exercice.findMany({
          where: { tenantId: { in: ids }, statut: { not: StatutExercice.CLOTURE } },
          select: { id: true, tenantId: true, dateDebut: true, dateFin: true },
          orderBy: { dateDebut: 'asc' },
          take: 2_000,
        }),
        this.prisma.journal.findMany({
          where: { tenantId: { in: ids }, type: TypeJournal.GENERAL, estActif: true },
          select: { id: true, tenantId: true, code: true, intitule: true },
          orderBy: { code: 'asc' },
          take: 2_000,
        }),
        this.prisma.compte.findMany({
          where: { tenantId: { in: ids }, typeCompte: 'DETAIL', estActif: true, OR: RACINES_LIAISON_BIEN.map((r) => ({ numero: { startsWith: r } })) },
          select: { id: true, tenantId: true, numero: true, intitule: true },
          orderBy: { numero: 'asc' },
          take: 2_000,
        }),
      ]);
      return {
        siegeId: siege.id,
        referentiel: siege.referentiel,
        dossiers: membres.map((m) => ({
          id: m.id,
          nom: m.nom,
          siege: m.id === siege.id,
          exercicesOuverts: exercices.filter((e) => e.tenantId === m.id).map((e) => ({ id: e.id, dateDebut: jour(e.dateDebut), dateFin: jour(e.dateFin) })),
          journaux: journaux.filter((j) => j.tenantId === m.id).map((j) => ({ id: j.id, code: j.code, intitule: j.intitule })),
          comptesLiaison: comptes.filter((c) => c.tenantId === m.id).map((c) => ({ id: c.id, numero: c.numero, intitule: c.intitule })),
        })),
      };
    });
  }

  /** Les biens en service d'un dossier du groupe, à choisir. */
  async biens(tenantId: string, dossierId: string) {
    const { membres } = await this.groupeDuSiege(tenantId);
    if (!membres.some((m) => m.id === dossierId)) throw new NotFoundException("Ce dossier n'est pas du groupe de ce siège.");
    return perimetreDeGroupe(
      membres.map((m) => m.id),
      async () => {
        const biens = await this.prisma.immobilisation.findMany({
          where: { tenantId: dossierId, statut: StatutImmobilisation.EN_SERVICE },
          select: { id: true, designation: true, numeroInventaire: true, valeurOrigine: true, dateAcquisition: true, compteImmobilisation: { select: { numero: true } } },
          orderBy: [{ compteImmobilisation: { numero: 'asc' } }, { designation: 'asc' }],
          take: PLAFOND_BIENS + 1,
        });
        return {
          biens: biens.slice(0, PLAFOND_BIENS).map((b) => ({
            id: b.id,
            designation: b.designation,
            numeroInventaire: b.numeroInventaire,
            compte: b.compteImmobilisation.numero,
            valeurOrigine: Number(b.valeurOrigine),
            dateAcquisition: jour(b.dateAcquisition),
          })),
          tronque: biens.length > PLAFOND_BIENS,
        };
      },
    );
  }

  /** L'aperçu · ce qui passerait, ou le premier refus, sans rien écrire. */
  async apercu(tenantId: string, dto: TransfertGroupeDto) {
    const p = await this.preparer(tenantId, dto);
    return {
      designation: p.immo.designation,
      dossierCedant: p.cedant.nom,
      dossierReceveur: p.receveur.nom,
      date: jour(p.date),
      montants: p.montants,
      liaisonCedant: p.liaisonCedant.numero,
      liaisonReceveur: p.liaisonReceveur.numero,
    };
  }

  /**
   * TOUT CE QUI PEUT REFUSER, AVANT LA PREMIÈRE ÉCRITURE · le bien et ses
   * faits, les deux dossiers, les deux exercices ouverts, les deux journaux,
   * les deux comptes de liaison, les comptes du bien dans le dossier qui le
   * reçoit, et les contrôles d'entrée des deux pièces (périodes closes,
   * comptes Total, journal en sommeil).
   */
  private async preparer(tenantId: string, dto: TransfertGroupeDto, db: Db = this.prisma): Promise<Preparation> {
    const { siege, membres } = await this.groupeDuSiege(tenantId, db);
    const groupe = membres.map((m) => m.id);
    const trouve = (id: string) => membres.find((m) => m.id === id) ?? null;
    const cedant = trouve(dto.dossierCedantId);
    const receveur = trouve(dto.dossierReceveurId);
    const refusDossiers = motifRefusDossiers({ siegeId: siege.id, cedant, receveur });
    if (refusDossiers) throw new BadRequestException(refusDossiers);
    const date = enDate(dto.date);
    const datePiece = enDate(dto.datePiece);
    if (Number.isNaN(date.getTime()) || jour(date) !== dto.date) throw new BadRequestException('La date du transfert se lit AAAA-MM-JJ.');
    if (Number.isNaN(datePiece.getTime()) || jour(datePiece) !== dto.datePiece) throw new BadRequestException('La date de la pièce se lit AAAA-MM-JJ.');
    if (datePiece.getTime() > date.getTime()) throw new BadRequestException("La pièce du transfert ne se date pas après le transfert qu'elle justifie.");
    const referencePiece = dto.referencePiece.trim();
    if (!referencePiece) throw new BadRequestException('La pièce du transfert se nomme (AUDCIF art. 17, 3° et 5°) · elle est la même dans les deux comptabilités.');

    return perimetreDeGroupe(groupe, async () => {
      const exerciceDe = async (dossierId: string, nom: string) => {
        const e = await db.exercice.findFirst({
          where: { tenantId: dossierId, dateDebut: { lte: date }, dateFin: { gte: date } },
          select: { id: true, dateDebut: true, dateFin: true, statut: true },
        });
        if (!e) throw new BadRequestException(`Aucun exercice de « ${nom} » ne contient le ${dto.date} · ouvrez-le d'abord.`);
        if (e.statut === StatutExercice.CLOTURE) {
          throw new BadRequestException(`L'exercice de « ${nom} » qui contient le ${dto.date} est clôturé · « dans la même période comptable » (fiche du compte 18), les deux exercices sont ouverts.`);
        }
        return e;
      };
      const exerciceCedant = await exerciceDe(cedant!.id, cedant!.nom);
      const exerciceReceveur = await exerciceDe(receveur!.id, receveur!.nom);

      const s = await this.immobilisations.situationAuTransfert(cedant!.id, dto.immobilisationId, exerciceCedant, date, db);
      const refusBien = motifRefusBien(s.faits, date);
      if (refusBien) throw new BadRequestException(refusBien);

      const journalDe = async (dossierId: string, id: string, nom: string) => {
        const j = await db.journal.findFirst({
          where: { id, tenantId: dossierId },
          select: { id: true, numerotation: true, type: true, estActif: true, code: true },
        });
        if (!j) throw new BadRequestException(`Journal introuvable dans « ${nom} ».`);
        if (j.type !== TypeJournal.GENERAL || !j.estActif) throw new BadRequestException(`Le journal ${j.code} de « ${nom} » n'est pas un journal d'opérations diverses actif.`);
        return j;
      };
      const journalCedant = await journalDe(cedant!.id, dto.journalCedantId, cedant!.nom);
      const journalReceveur = await journalDe(receveur!.id, dto.journalReceveurId, receveur!.nom);
      // LES JOURNAUX AUTORISÉS DE CELUI QUI TRANSFÈRE · la garde du client
      // Prisma refuserait l'écriture plus tard, en 403, après que l'aperçu
      // a tout admis. Le refus est dit ici, journal nommé, à l'aperçu comme
      // au transfert (extension-perimetre-journaux.ts, même règle).
      const autorises = acteurCourant()?.journauxAutorises;
      for (const [j, nom] of [[journalCedant, cedant!.nom], [journalReceveur, receveur!.nom]] as const) {
        if (journalHorsPerimetre(j.id, autorises)) {
          throw new ForbiddenException(
            `Le journal ${j.code} de « ${nom} » n'est pas dans votre périmètre de saisie · l'administrateur a restreint vos écritures aux journaux cochés dans la fenêtre Utilisateurs. Le transfert passe une pièce dans chacun des deux journaux.`,
          );
        }
      }

      const liaisonDe = async (dossierId: string, id: string, cote: 'cède' | 'reçoit') => {
        const c = await db.compte.findFirst({ where: { id, tenantId: dossierId }, select: { id: true, numero: true, typeCompte: true, estActif: true } });
        const refus = motifRefusCompteLiaison(c, cote);
        if (refus) throw new BadRequestException(refus);
        return c!;
      };
      const liaisonCedant = await liaisonDe(cedant!.id, dto.compteLiaisonCedantId, 'cède');
      const liaisonReceveur = await liaisonDe(receveur!.id, dto.compteLiaisonReceveurId, 'reçoit');

      // LES COMPTES DU BIEN DANS LE DOSSIER QUI LE REÇOIT · le même numéro, un
      // compte de détail actif. Le même référentiel et le même plan semé les
      // portent d'ordinaire ; un sous-compte ouvert chez l'un seul est nommé.
      const numeros = [
        s.immo.compteImmobilisation.numero,
        ...(await db.compte.findMany({
          where: { tenantId: cedant!.id, id: { in: [s.immo.compteAmortissementId, s.immo.compteDotationId] } },
          select: { id: true, numero: true },
        })).map((c) => c.numero),
      ];
      const numeroAmortissement = (await db.compte.findFirst({ where: { tenantId: cedant!.id, id: s.immo.compteAmortissementId }, select: { numero: true } }))!.numero;
      const numeroDotation = (await db.compte.findFirst({ where: { tenantId: cedant!.id, id: s.immo.compteDotationId }, select: { numero: true } }))!.numero;
      const avecDepreciation = s.depreciations > EPSILON;
      if (avecDepreciation && (!s.porteur?.numeroDepreciation || !s.porteur.numeroContrepartieDotation)) {
        throw new BadRequestException("La dépréciation du bien n'a pas de compte 29 lisible dans le dossier qui le cède · corrigez-la d'abord.");
      }
      const cherches = [...new Set([...numeros, ...(avecDepreciation ? [s.porteur!.numeroDepreciation!, s.porteur!.numeroContrepartieDotation!] : [])])];
      const comptesReceveur = await db.compte.findMany({
        where: { tenantId: receveur!.id, numero: { in: cherches } },
        select: { id: true, numero: true, typeCompte: true, estActif: true },
      });
      const compteReceveur = (numero: string) => {
        const c = comptesReceveur.find((x) => x.numero === numero);
        if (!c || c.typeCompte !== 'DETAIL' || !c.estActif) {
          throw new BadRequestException(`Le compte ${numero} n'est pas ouvert, en détail et actif, dans « ${receveur!.nom} » · ouvrez-le avant le transfert, le bien y garde ses comptes.`);
        }
        return c.id;
      };
      const comptes = {
        bien: compteReceveur(s.immo.compteImmobilisation.numero),
        amortissement: compteReceveur(numeroAmortissement),
        dotation: compteReceveur(numeroDotation),
        depreciation: avecDepreciation ? compteReceveur(s.porteur!.numeroDepreciation!) : null,
        // LE NIVEAU DE LA DOTATION D'ORIGINE SUIT LE BIEN (691 ou 853, ligne
        // A22 bis) · c'est lui qui choisira la reprise à la sortie (79 ou 863,
        // fiche du compte 79). Le mouvement d'entrée est passé par le compte de
        // liaison, jamais par ce compte · il n'en garde que le niveau.
        contrepartieDepreciation: avecDepreciation ? compteReceveur(s.porteur!.numeroContrepartieDotation!) : null,
      };
      const famille =
        (await db.familleImmobilisation.findFirst({ where: { tenantId: receveur!.id, code: s.immo.famille.code }, select: { id: true } })) ??
        (await db.familleImmobilisation.findFirst({ where: { tenantId: receveur!.id, compteImmobilisationId: comptes.bien }, select: { id: true } }));
      if (!famille) {
        throw new BadRequestException(`Aucune famille de biens du compte ${s.immo.compteImmobilisation.numero} dans « ${receveur!.nom} » · créez-la avant le transfert.`);
      }
      const numeroInventaireLibre =
        !!s.immo.numeroInventaire &&
        !(await db.immobilisation.findFirst({ where: { tenantId: receveur!.id, numeroInventaire: s.immo.numeroInventaire }, select: { id: true } }));

      const montants = montantsDuTransfert({
        valeurOrigine: Number(s.immo.valeurOrigine),
        cumulAmortiAvant: s.cumulAmortiAvant,
        complement: s.complement,
        depreciations: s.depreciations,
      });
      if (montants.valeurNette < -EPSILON) throw new BadRequestException('La valeur nette du bien est négative · ses amortissements ou ses dépréciations dépassent sa valeur d’entrée.');
      const pieces = piecesDuTransfert(
        montants,
        {
          bien: s.immo.compteImmobilisationId,
          amortissement: s.immo.compteAmortissementId,
          dotation: s.immo.compteDotationId,
          depreciation: avecDepreciation ? s.porteur!.compteDepreciationId : null,
          liaison: liaisonCedant.id,
        },
        { bien: comptes.bien, amortissement: comptes.amortissement, dotation: comptes.dotation, depreciation: comptes.depreciation, liaison: liaisonReceveur.id },
      );
      // Les contrôles d'entrée de la saisie, rejoués pour chaque pièce dans
      // son dossier · période close, compte Total, journal en sommeil. Aucune
      // section analytique n'est portée · la dotation complémentaire suit le
      // bien, que le dossier qui cède ventile s'il le veut.
      await this.ecritures.controlesDEntree(cedant!.id, { exerciceId: exerciceCedant.id, journalId: journalCedant.id, date, lignes: pieces.cedant, exigerVentilationObligatoire: false }, db);
      await this.ecritures.controlesDEntree(receveur!.id, { exerciceId: exerciceReceveur.id, journalId: journalReceveur.id, date, lignes: pieces.receveur, exigerVentilationObligatoire: false }, db);

      return {
        groupe,
        cedant: cedant!,
        receveur: receveur!,
        date,
        datePiece,
        referencePiece,
        exerciceCedant,
        exerciceReceveur,
        immo: s.immo,
        montants,
        journalCedant,
        journalReceveur,
        liaisonCedant,
        liaisonReceveur,
        comptesReceveur: comptes,
        familleReceveurId: famille.id,
        depreciationCedantId: avecDepreciation ? s.porteur!.compteDepreciationId : null,
        numeroInventaireLibre,
        pieces,
      };
    });
  }

  /** TRANSFÉRER · les deux pièces, les deux fiches, les deux côtés, ensemble. */
  async transferer(tenantId: string, userId: string, userEmail: string, dto: TransfertGroupeDto) {
    // Une première lecture hors transaction · elle refuse vite, et elle donne
    // les deux dossiers à verrouiller. Elle ne fait jamais foi · tout est
    // rejoué sous les verrous.
    const avant = await this.preparer(tenantId, dto);
    const transfertId = randomUUID();
    return perimetreDeGroupe(avant.groupe, () =>
      transactionJournalisee(this.prisma, async (tx) => {
        // Les deux dossiers, dans un ordre FIXE · deux transferts croisés
        // s'attendraient sinon l'un l'autre.
        for (const d of [avant.cedant.id, avant.receveur.id].sort()) await prendreLeVerrouDuDossier(tx, d);
        await tx.$queryRaw`SELECT id FROM "immobilisations" WHERE id = ${avant.immo.id} AND "tenantId" = ${avant.cedant.id} FOR UPDATE`;
        // LA PRÉPARATION REJOUÉE SOUS VERROU · exercices et statuts, situation
        // du bien (dotations et dépréciations de tous les exercices, B1),
        // comptes, contrôles d'entrée. Une dotation, une dépréciation, une
        // clôture ou une sortie passées entre l'aperçu et l'écriture refusent
        // ici par leur motif ; des montants qui ont bougé sans refus rendent
        // un 409 · on ne passe jamais autre chose que ce qui a été lu.
        const p = await this.preparer(tenantId, dto, tx);
        if (JSON.stringify(p.montants) !== JSON.stringify(avant.montants) || JSON.stringify(p.pieces) !== JSON.stringify(avant.pieces)) {
          throw new ConflictException("Le bien a changé pendant la préparation du transfert (montants ou comptes) · relancez l'aperçu, puis transférez.");
        }
        const libelle = `Transfert dans le groupe · ${p.immo.designation}`.slice(0, 250);
        const i = p.immo;

        const creerPiece = async (dossierId: string, journal: Preparation['journalCedant'], exerciceId: string, lignes: Array<{ compteId: string; debit: number; credit: number }>) => {
          const numeroPiece = await prochainNumeroPiece(tx, dossierId, journal, exerciceId, p.date);
          return tx.ecriture.create({
            data: {
              tenantId: dossierId,
              exerciceId,
              journalId: journal.id,
              numeroPiece,
              date: p.date,
              libelle,
              reference: p.referencePiece,
              // LE DOUBLE REGARD NE VOIT QUE L'IDENTITÉ (CLAUDE.md § 10 ter,
              // point aveugle) · la pièce née dans la cellule porte un
              // utilisateur du SIÈGE, si bien que, l'option activée, tout
              // utilisateur de la cellule la valide sans qu'aucun n'en soit
              // l'auteur · personne dans la cellule ne l'a pourtant relue. Le
              // logiciel ne contrôle pas l'indépendance.
              createdBy: userId,
              lignes: { create: lignes.map((l) => ({ compteId: l.compteId, libelle, debit: l.debit, credit: l.credit })) },
            },
            select: { id: true, numeroPiece: true },
          });
        };
        const pieceCedant = await creerPiece(p.cedant.id, p.journalCedant, p.exerciceCedant.id, p.pieces.cedant);
        const pieceReceveur = await creerPiece(p.receveur.id, p.journalReceveur, p.exerciceReceveur.id, p.pieces.receveur);

        // CHEZ CELUI QUI CÈDE · le bien sort, sans 81 · la pièce du transfert
        // est sa pièce de sortie, retenue par la fiche.
        const sortie = await tx.immobilisation.updateMany({
          where: { id: i.id, tenantId: p.cedant.id, statut: StatutImmobilisation.EN_SERVICE },
          data: { statut: StatutImmobilisation.MISE_HORS_SERVICE, dateSortie: p.date, ecritureSortieId: pieceCedant.id, referencePieceSortie: p.referencePiece, datePieceSortie: p.datePiece },
        });
        if (sortie.count !== 1) throw new ConflictException("Le bien vient d'être sorti par une autre opération.");
        if (p.montants.complementDotation > EPSILON) {
          await tx.dotationAmortissement.create({
            data: { immobilisationId: i.id, exerciceId: p.exerciceCedant.id, montant: p.montants.complementDotation, ecritureId: pieceCedant.id },
          });
        }
        if (p.montants.depreciations > EPSILON) {
          await tx.depreciationImmobilisation.create({
            data: {
              immobilisationId: i.id,
              exerciceId: p.exerciceCedant.id,
              sens: SensDepreciation.REPRISE,
              montant: p.montants.depreciations,
              compteDepreciationId: p.depreciationCedantId!,
              compteContrepartieId: p.liaisonCedant.id,
              indice: `Transfert dans le groupe vers « ${p.receveur.nom} » · pièce ${p.referencePiece}`.slice(0, 500),
              ecritureId: pieceCedant.id,
              createdBy: userId,
              nature: NatureMouvementDepreciation.TRANSFERT_GROUPE,
            },
          });
        }

        // CHEZ CELUI QUI REÇOIT · la fiche naît avec la valeur d'entrée, le
        // cumul qui suit le bien et le plan inchangé ; la pièce du transfert
        // est sa pièce d'entrée, retenue par la fiche.
        const fiche = await tx.immobilisation.create({
          data: {
            tenantId: p.receveur.id,
            familleId: p.familleReceveurId,
            designation: i.designation,
            numeroInventaire: p.numeroInventaireLibre ? i.numeroInventaire : null,
            compteImmobilisationId: p.comptesReceveur.bien,
            compteAmortissementId: p.comptesReceveur.amortissement,
            compteDotationId: p.comptesReceveur.dotation,
            dateAcquisition: i.dateAcquisition,
            dateMiseEnService: i.dateMiseEnService,
            dateEntreeGroupe: p.date,
            natureFiscaleCle: i.natureFiscaleCle,
            valeurOrigine: i.valeurOrigine,
            valeurResiduelle: i.valeurResiduelle,
            dureeAmortissementAns: i.dureeAmortissementAns,
            modeAmortissement: i.modeAmortissement,
            unitesOeuvrePrevues: i.unitesOeuvrePrevues,
            uniteOeuvreLibelle: i.uniteOeuvreLibelle,
            // Tout ce qui a été amorti suit le bien en un chiffre · les
            // dotations de celui qui cède, son cumul hors dotations et la
            // dotation complémentaire du transfert.
            amortissementAnterieur: p.montants.amortissements,
            dureeNonLimitee: i.dureeNonLimitee,
            justificationDureeNonLimitee: i.justificationDureeNonLimitee,
            dateDebutAmortissement: i.dateDebutAmortissement,
            motifDureeLimitee: i.motifDureeLimitee,
            testDepreciationBascule: i.testDepreciationBascule,
            fondementDureeDixAns: i.fondementDureeDixAns,
            dateEffetRevisionPlan: i.dateEffetRevisionPlan,
            dureeResiduelleRevisee: i.dureeResiduelleRevisee,
            criteresFraisDeveloppement: i.criteresFraisDeveloppement ?? undefined,
            dateReunionCriteresDeveloppement: i.dateReunionCriteresDeveloppement,
            reserveDePropriete: i.reserveDePropriete,
            reserveProprieteLeveeLe: i.reserveProprieteLeveeLe,
            ecritureAcquisitionId: pieceReceveur.id,
            createdBy: userId,
          },
          select: { id: true },
        });
        if (p.montants.depreciations > EPSILON) {
          await tx.depreciationImmobilisation.create({
            data: {
              immobilisationId: fiche.id,
              exerciceId: p.exerciceReceveur.id,
              sens: SensDepreciation.DOTATION,
              montant: p.montants.depreciations,
              compteDepreciationId: p.comptesReceveur.depreciation!,
              compteContrepartieId: p.comptesReceveur.contrepartieDepreciation!,
              indice: `Dépréciation reçue avec le bien de « ${p.cedant.nom} » · pièce ${p.referencePiece}`.slice(0, 500),
              ecritureId: pieceReceveur.id,
              createdBy: userId,
              nature: NatureMouvementDepreciation.TRANSFERT_GROUPE,
            },
          });
        }
        const commun = {
          transfertId,
          designation: i.designation.slice(0, 300),
          dateTransfert: p.date,
          referencePiece: p.referencePiece,
          datePiece: p.datePiece,
          valeurOrigine: p.montants.valeurOrigine,
          amortissements: p.montants.amortissements,
          complementDotation: p.montants.complementDotation,
          depreciations: p.montants.depreciations,
          valeurNette: p.montants.valeurNette,
          creePar: userEmail,
        };
        await tx.transfertImmobilisationGroupe.create({
          data: { ...commun, tenantId: p.cedant.id, sens: SensTransfertGroupe.SORTIE, dossierContrepartieId: p.receveur.id, immobilisationId: i.id, ecritureId: pieceCedant.id, compteLiaisonId: p.liaisonCedant.id },
        });
        await tx.transfertImmobilisationGroupe.create({
          data: { ...commun, tenantId: p.receveur.id, sens: SensTransfertGroupe.ENTREE, dossierContrepartieId: p.cedant.id, immobilisationId: fiche.id, ecritureId: pieceReceveur.id, compteLiaisonId: p.liaisonReceveur.id },
        });
        return {
          transfertId,
          montants: p.montants,
          pieceCedant: pieceCedant.numeroPiece,
          pieceReceveur: pieceReceveur.numeroPiece,
          immobilisationReceveurId: fiche.id,
        };
      }),
    );
  }

  /** Les transferts du groupe, un par transfert, les plus récents d'abord. */
  async lister(tenantId: string) {
    const { membres } = await this.groupeDuSiege(tenantId);
    const ids = membres.map((m) => m.id);
    const nom = new Map(membres.map((m) => [m.id, m.nom]));
    return perimetreDeGroupe(ids, async () => {
      const [lignes, total] = await Promise.all([
        this.prisma.transfertImmobilisationGroupe.findMany({
          where: { tenantId: { in: ids }, sens: SensTransfertGroupe.SORTIE },
          orderBy: [{ dateTransfert: 'desc' }, { createdAt: 'desc' }],
          take: PLAFOND_TRANSFERTS,
        }),
        this.prisma.transfertImmobilisationGroupe.count({ where: { tenantId: { in: ids }, sens: SensTransfertGroupe.SORTIE } }),
      ]);
      return {
        transferts: lignes.map((l) => ({
          transfertId: l.transfertId,
          designation: l.designation,
          dossierCedant: nom.get(l.tenantId) ?? '',
          dossierReceveur: nom.get(l.dossierContrepartieId) ?? '',
          date: jour(l.dateTransfert),
          referencePiece: l.referencePiece,
          valeurOrigine: Number(l.valeurOrigine),
          amortissements: Number(l.amortissements),
          depreciations: Number(l.depreciations),
          valeurNette: Number(l.valeurNette),
          annuleLe: l.annuleLe,
          motifAnnulation: l.motifAnnulation,
        })),
        total,
        tronque: total > lignes.length,
      };
    });
  }

  /**
   * ANNULER UN TRANSFERT · les deux côtés ensemble, avec son motif (AUDCIF
   * art. 20, al. 2) · au brouillard la pièce est retirée (art. 22, 2°),
   * validée elle est inscrite en négatif. La fiche née chez celui qui reçoit
   * est retirée (le bien n'y est jamais entré), celle de celui qui cède
   * reprend son service, ses mouvements du transfert retirés. Refusé dès que
   * le dossier qui a reçu le bien l'a traité (dotation, dépréciation, sortie,
   * nouveau transfert) · on annule à partir du plus récent.
   */
  async annuler(tenantId: string, userId: string, userEmail: string, transfertId: string, motif: string) {
    const { membres } = await this.groupeDuSiege(tenantId);
    const ids = membres.map((m) => m.id);
    return perimetreDeGroupe(ids, async () => {
      const cotes = await this.prisma.transfertImmobilisationGroupe.findMany({ where: { tenantId: { in: ids }, transfertId }, take: 2 });
      const sortie = cotes.find((c) => c.sens === SensTransfertGroupe.SORTIE);
      const entree = cotes.find((c) => c.sens === SensTransfertGroupe.ENTREE);
      if (!sortie || !entree) throw new NotFoundException('Transfert introuvable dans ce groupe.');
      if (sortie.annuleLe || entree.annuleLe) throw new BadRequestException('Ce transfert est déjà annulé.');
      if (!entree.immobilisationId || !sortie.immobilisationId || !sortie.ecritureId || !entree.ecritureId) {
        throw new BadRequestException('Ce transfert ne porte plus ses deux fiches et ses deux pièces · il ne se défait plus ici.');
      }
      const motifPropre = motif.trim();

      return transactionJournalisee(this.prisma, async (tx) => {
        for (const d of [sortie.tenantId, entree.tenantId].sort()) await prendreLeVerrouDuDossier(tx, d);
        // LA FICHE REÇUE SOUS VERROU, PUIS TOUT CE QUI REFUSE · relu dans la
        // transaction, une dotation, une pièce jointe ou un lettrage posés
        // entre la lecture et l'écriture refusent par leur motif, jamais par
        // un 500 sur la clé RESTRICT au retrait de la fiche.
        await tx.$queryRaw`SELECT id FROM "immobilisations" WHERE id = ${entree.immobilisationId} AND "tenantId" = ${entree.tenantId} FOR UPDATE`;
        const fiche = await tx.immobilisation.findFirst({
          where: { id: entree.immobilisationId!, tenantId: entree.tenantId },
          select: { id: true, statut: true },
        });
        if (!fiche) throw new NotFoundException('La fiche du bien reçu est introuvable.');
        if (fiche.statut !== StatutImmobilisation.EN_SERVICE) {
          // Re-transféré, il est sorti par un AUTRE transfert · celui-là
          // s'annule d'abord, depuis la même fenêtre.
          const suivant = await tx.transfertImmobilisationGroupe.findFirst({
            where: { tenantId: entree.tenantId, immobilisationId: fiche.id, sens: SensTransfertGroupe.SORTIE, annuleLe: null },
            select: { dateTransfert: true, referencePiece: true },
          });
          if (suivant) {
            throw new BadRequestException(
              `Le bien a été transféré de nouveau depuis le dossier qui l'a reçu (le ${jour(suivant.dateTransfert)}, pièce ${suivant.referencePiece}) · annulez d'abord le transfert suivant, puis celui-ci.`,
            );
          }
          throw new BadRequestException('Le bien est sorti du dossier qui l’a reçu · annulez d’abord cette sortie.');
        }
        // LE DOSSIER QUI A REÇU N'A RIEN FAIT DU BIEN · sinon ces actes ont été
        // calculés sur un bien qui n'y serait plus. Un traitement passé PUIS
        // ANNULÉ ne compte pas · son historique (`AnnulationTraitementImmobilisation`)
        // garde l'acte en entier dans `acte` et se détache de la fiche avant
        // qu'elle parte (colonne nullable, prévue pour un acte sans bien).
        // Ligne Microfina M4, relecture B1 · les détentions se jugent à part ·
        // une détention VIVANTE chez celui qui a reçu le bien refuse, avec son
        // issue ; une détention ANNULÉE et ses reçus annulés ne retiennent
        // rien, ils partent détachés de la fiche (jamais supprimés).
        const refs = await referencesVers(tx, 'Immobilisation', fiche.id, entree.tenantId, [
          'TransfertImmobilisationGroupe.immobilisationId',
          'AnnulationTraitementImmobilisation.immobilisationId',
          'DetentionBien.immobilisationId',
          'RecuDetentionBien.immobilisationId',
        ]);
        const detentions = await detentionsQuiRetiennentLaFiche(tx, entree.tenantId, fiche.id);
        if (detentions.total > 0) {
          throw new BadRequestException(
            `Le dossier qui a reçu le bien l'a remis à un salarié (${detentions.detentions} détention(s) en vigueur, ` +
              `${detentions.recus} reçu(s)) · annulez d'abord ces actes depuis le volet Détenteur de sa fiche, du plus récent au ` +
              'plus ancien, puis le transfert.',
          );
        }
        const heritees = await tx.depreciationImmobilisation.count({ where: { immobilisationId: fiche.id, nature: NatureMouvementDepreciation.TRANSFERT_GROUPE, immobilisation: { tenantId: entree.tenantId } } });
        const usages = refs.filter((r) => !(r.modele === 'DepreciationImmobilisation' && r.nombre === heritees) && r.modele !== 'PieceJointeImmobilisation');
        if (usages.length > 0) {
          throw new BadRequestException(
            `Le dossier qui a reçu le bien l'a déjà traité (${usages.map(libelleReference).join(', ')}) · annulez d'abord ces actes, du plus récent au plus ancien, puis le transfert.`,
          );
        }
        const documents = refs.find((r) => r.modele === 'PieceJointeImmobilisation');
        if (documents) throw new BadRequestException(`La fiche du bien reçu porte ${documents.nombre} document(s) joint(s) · retirez-les d'abord.`);

        const pieces = await tx.ecriture.findMany({
          where: { id: { in: [sortie.ecritureId!, entree.ecritureId!] }, tenantId: { in: [sortie.tenantId, entree.tenantId] }, statut: { not: StatutEcriture.SITUATION } },
          select: { id: true, tenantId: true, statut: true, numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
        });
        for (const e of pieces) {
          const tenues = motifLignesTenues(e.lignes, `la pièce n° ${e.numeroPiece ?? '·'} du transfert`, 'annuler le transfert');
          if (tenues) throw new BadRequestException(tenues);
        }
        // Une mise à jour UNITAIRE par acte d'historique · au journal d'audit,
        // un `updateMany` ne laisserait que son filtre et son compte.
        const historique = await tx.annulationTraitementImmobilisation.findMany({ where: { tenantId: entree.tenantId, immobilisationId: fiche.id }, select: { id: true }, take: 1_000 });
        for (const h of historique) await tx.annulationTraitementImmobilisation.update({ where: { id: h.id }, data: { immobilisationId: null } });
        await detacherLesDetentionsAnnulees(tx, entree.tenantId, fiche.id);

        const maintenant = new Date();
        const negatifs = new Map<string, string>();
        // Les validées d'abord · l'inscription en négatif refuse un exercice
        // clôturé avant que rien ne soit retiré.
        for (const c of [sortie, entree]) {
          const e = await tx.ecriture.findFirst({ where: { id: c.ecritureId!, tenantId: c.tenantId, statut: { not: StatutEcriture.SITUATION } }, select: { statut: true } });
          if (e?.statut === StatutEcriture.VALIDEE) {
            const n = await this.ecritures.inscrireEnNegatifPourAnnulation(c.tenantId, userId, c.ecritureId!, `Annulation du transfert dans le groupe · ${motifPropre}`, tx);
            negatifs.set(c.id, n.id);
          }
        }
        // Les mouvements du transfert, qui retiennent ses pièces.
        await tx.dotationAmortissement.deleteMany({ where: { immobilisationId: sortie.immobilisationId!, ecritureId: sortie.ecritureId!, immobilisation: { tenantId: sortie.tenantId } } });
        await tx.depreciationImmobilisation.deleteMany({
          where: { ecritureId: { in: [sortie.ecritureId!, entree.ecritureId!] }, nature: NatureMouvementDepreciation.TRANSFERT_GROUPE, immobilisation: { tenantId: { in: [sortie.tenantId, entree.tenantId] } } },
        });
        // Celui qui cède reprend le bien.
        await tx.immobilisation.update({
          where: { id: sortie.immobilisationId! },
          data: { statut: StatutImmobilisation.EN_SERVICE, dateSortie: null, ecritureSortieId: null, referencePieceSortie: null, datePieceSortie: null },
        });
        // Les deux côtés marqués, la fiche née détachée puis retirée.
        for (const c of [sortie, entree]) {
          const retiree = !negatifs.has(c.id);
          await tx.transfertImmobilisationGroupe.update({
            where: { id: c.id },
            data: {
              annuleLe: maintenant,
              annulePar: userEmail,
              motifAnnulation: motifPropre,
              ecritureNegatifId: negatifs.get(c.id) ?? null,
              ...(retiree ? { ecritureId: null } : {}),
              ...(c.sens === SensTransfertGroupe.ENTREE ? { immobilisationId: null } : {}),
            },
          });
        }
        await tx.immobilisation.delete({ where: { id: entree.immobilisationId! } });
        // Les pièces du brouillard retirées · relues sur leur statut DANS la
        // transaction, une et une seule, sinon la pièce a été validée entre
        // temps et l'annulation se relance.
        for (const c of [sortie, entree]) {
          if (negatifs.has(c.id)) continue;
          await tx.ligneEcriture.deleteMany({ where: { ecritureId: c.ecritureId!, ecriture: { tenantId: c.tenantId, statut: StatutEcriture.BROUILLARD } } });
          const r = await tx.ecriture.deleteMany({ where: { id: c.ecritureId!, tenantId: c.tenantId, statut: StatutEcriture.BROUILLARD } });
          if (r.count !== 1) throw new ConflictException('Une pièce du transfert a changé de statut pendant l’annulation · relancez-la.');
        }
        return { annule: true, negatifs: negatifs.size };
      });
    });
  }
}
