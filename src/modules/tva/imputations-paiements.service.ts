import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutEcriture, StatutExercice } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { DeclarerImputationDto, RetirerImputationDto } from './dto/imputation-paiement.dto';
import {
  imputerPaiements,
  motifGroupeLuEnBloc,
  motifPaiementExerciceClos,
  motifRefusDeclaration,
  motifReportDePaiement,
  type LigneDeTiersLue,
} from './imputation-paiements';
import { SELECT_LIGNE_D_ORIGINE, TauxTvaService, type LigneDOrigine } from './taux-tva.service';

/** Un groupe de lettrage plus long ne se lit pas ici · dit, jamais coupé en silence (§ 8 bis). */
export const PLAFOND_LIGNES_GROUPE_IMPUTATION = 500;

/** Une déclaration active par paiement, deux cents factures au plus (`DeclarerImputationDto`). */
const FACTURES_PAR_DECLARATION = 200;

const n = (x: unknown) => Number(x ?? 0);
const c = (x: number) => Math.round(x * 100) / 100;
const EPSILON = 0.005;
const jour = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const jjmmaaaa = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
const lendemain = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
const finDuJour = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

/**
 * Une ligne de groupe · les colonnes de la lecture PARTAGÉE avec le moteur de
 * la TVA (`SELECT_LIGNE_D_ORIGINE`), avoirs comptés (relecture du 2026-10-07,
 * second tour, M-b).
 */
type LigneDeGroupe = LigneDOrigine;

/** Le groupe d'un paiement, lu comme le moteur le lit (`lireLeGroupe`). */
type GroupeLu =
  | { tronque: true }
  | {
      tronque: false;
      /** Les lignes du groupe de lettrage, telles qu'en base. */
      brutes: LigneDeGroupe[];
      /** Le groupe lu · reports remplacés ou retirés, inscriptions en négatif neutralisées. */
      lignes: LigneDeGroupe[];
      motifEnBloc: string | null;
      /** Report d'une facture → la facture qu'il reporte. */
      reportsVers: ReadonlyMap<string, string>;
      /** Report d'un paiement retiré → le paiement d'origine. */
      paiementsReportes: ReadonlyMap<string, string>;
    };

/** Ce qu'un geste sur une période liquidée a déplacé, dit au geste (M3). */
export type EffetSurLiquidation = {
  du: string;
  au: string;
  premierJourLibre: string;
  /** Taxe portée au premier jour non liquidé par le geste · `null`, non calculée (motif dit). */
  collecte: number | null;
  deductible: number | null;
  message: string;
};

/**
 * L'IMPUTATION DÉCLARÉE D'UN PAIEMENT (Code civil, Livre III, art. 151 et 153 ;
 * décision par la loi du 2026-10-07, point 4). Elle se saisit par paiement,
 * avec sa pièce, au journal d'audit (`ImputationPaiement` est audité) · elle
 * PRIME sur l'imputation légale de l'art. 154 dans le moteur de la TVA à
 * l'encaissement. Elle ne touche à aucune écriture ni à aucun lettrage · elle
 * dit seulement quelle dette la somme paie. Un mois liquidé reste ce qu'il a
 * déclaré (`tvaEncaissementFigee`) · l'écart qu'elle crée se reporte au premier
 * jour non liquidé, par la même mémoire que tout règlement lettré après coup,
 * et le geste le DIT avec le montant (relecture du 2026-10-07, M3).
 */
@Injectable()
export class ImputationsPaiementsService {
  private readonly journalServeur = new Logger('ImputationsPaiements');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tva: TauxTvaService,
  ) {}

  private async lignesDeTiers(client: Prisma.TransactionClient | PrismaService, tenantId: string, ids: string[]) {
    const lignes = await client.ligneEcriture.findMany({
      where: { id: { in: ids }, ecriture: { tenantId } },
      select: {
        id: true,
        compteId: true,
        debit: true,
        credit: true,
        lettrageId: true,
        compte: { select: { numero: true } },
        ecriture: {
          select: {
            statut: true,
            date: true,
            numeroPiece: true,
            estGenereeParCloture: true,
            estANouveauProvisoire: true,
            exercice: { select: { statut: true } },
          },
        },
      },
      take: ids.length,
    });
    return new Map<string, LigneDeTiersLue & { exerciceClos: boolean; aNouveau: boolean; numeroPiece: number | null }>(
      lignes.map((l) => [
        l.id,
        {
          id: l.id,
          compteId: l.compteId,
          numero: l.compte.numero,
          sens: c(n(l.debit) - n(l.credit)),
          validee: l.ecriture.statut === StatutEcriture.VALIDEE,
          lettrageId: l.lettrageId,
          date: l.ecriture.date ?? null,
          aNouveau: !!(l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire),
          exerciceClos: l.ecriture.exercice?.statut === StatutExercice.CLOTURE,
          numeroPiece: l.ecriture.numeroPiece ?? null,
        },
      ]),
    );
  }

  /** Les lignes d'un groupe de lettrage, bornées · `null` au-delà de la borne. */
  private async lignesDuGroupe(client: Prisma.TransactionClient | PrismaService, tenantId: string, lettrageId: string) {
    const lues = (await client.ligneEcriture.findMany({
      where: { lettrageId, ecriture: { tenantId } },
      select: SELECT_LIGNE_D_ORIGINE,
      orderBy: { id: 'asc' },
      take: PLAFOND_LIGNES_GROUPE_IMPUTATION + 1,
    })) as unknown as LigneDeGroupe[];
    return lues.length > PLAFOND_LIGNES_GROUPE_IMPUTATION ? null : lues;
  }

  /**
   * LE GROUPE D'UN PAIEMENT, LU COMME LE MOTEUR DE LA TVA LE LIT (relecture du
   * 2026-10-07, second tour, B-2 · une seule lecture du groupe). La porte
   * lisait les lignes BRUTES · les reports d'à-nouveau, datés du 1er janvier,
   * passaient pour des factures nées le même jour, l'art. 154 les payait au
   * prorata, et une imputation juste était refusée (P1 payait S pour le
   * moteur, mais aussi X pour la porte). Toute la chaîne des reports
   * (`traduireLesReports`), puis les inscriptions en négatif et le motif qui
   * fait lire le groupe en bloc (`lectureDuGroupe`) · les mêmes fonctions que
   * la déclaration de TVA.
   */
  private async lireLeGroupe(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    lettrageId: string,
    sensFacture: number,
  ): Promise<GroupeLu> {
    const brutes = await this.lignesDuGroupe(client, tenantId, lettrageId);
    if (!brutes) return { tronque: true };
    const traduit = await this.tva.traduireLesReports(tenantId, { id: lettrageId, statut: 'PARTIEL', solde: 0, lignes: brutes }, sensFacture);
    const lu = TauxTvaService.lectureDuGroupe(traduit, sensFacture);
    return {
      tronque: false,
      brutes,
      lignes: lu.lignes,
      motifEnBloc: lu.motifEnBloc,
      reportsVers: traduit.reportsVers ?? new Map(),
      paiementsReportes: traduit.paiementsReportes ?? new Map(),
    };
  }

  /**
   * CE QUE CHAQUE FACTURE DU GROUPE A DÉJÀ REÇU D'AUTRES PAIEMENTS, vu du
   * paiement qui déclare (relecture du 2026-10-07, mineur et M4). Le moteur
   * impute les paiements dans l'ordre de leurs dates (`imputerPaiements`) ·
   * les paiements ANTÉRIEURS ont déjà payé, par leur déclaration ou par
   * l'art. 154, et les déclarations actives des paiements POSTÉRIEURS seraient
   * ramenées si celle-ci les débordait. Seuls comptent les paiements du
   * GROUPE LU (`lireLeGroupe`, la chaîne des reports comprise) · une
   * déclaration d'un paiement sorti du groupe (délettré depuis) ne lit plus
   * rien dans le moteur, et ne retient donc rien ici. Rendu par FACTURE
   * (la pièce d'origine d'un report) · une déclaration posée sur un report
   * vise la facture qu'il reporte. Chaque paiement qui consomme est nommé
   * (pièce, date).
   */
  private async dejaRecuParFacture(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    reglement: { id: string; sens: number },
    lecture: { lignes: LigneDeGroupe[]; reportsVers: ReadonlyMap<string, string> },
  ): Promise<Map<string, { montant: number; par: string[] }>> {
    const sensFacture = reglement.sens > 0 ? -1 : 1;
    const sensDe = (l: LigneDeGroupe) => n(l.debit) - n(l.credit);
    const versLaFacture = (id: string) => lecture.reportsVers.get(id) ?? id;
    const retenues = lecture.lignes;
    const dettes = retenues
      .filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 === sensFacture > 0)
      .map((l) => ({ id: l.id, dateFacture: l.ecriture.date, dateEcheance: l.dateEcheance, montant: Math.abs(sensDe(l)) }));
    const paiements = retenues
      .filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 !== sensFacture > 0)
      .map((l) => ({ id: l.id, date: l.ecriture.date, montant: Math.abs(sensDe(l)), nom: `pièce ${l.ecriture.numeroPiece ?? 'sans numéro'} du ${jjmmaaaa(l.ecriture.date)}` }));
    // L'ordre du moteur · la date, puis l'identifiant.
    const ordre = [...paiements].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    const rang = ordre.findIndex((p) => p.id === reglement.id);
    const anterieurs = rang < 0 ? [] : ordre.slice(0, rang);
    const posterieurs = rang < 0 ? ordre.filter((p) => p.id !== reglement.id) : ordre.slice(rang + 1);
    const autres = [...anterieurs, ...posterieurs].map((p) => p.id);
    const declarees = autres.length
      ? await client.imputationPaiement.findMany({
          where: { tenantId, retireeLe: null, ligneReglementId: { in: autres } },
          select: { ligneReglementId: true, ligneFactureId: true, montant: true },
          orderBy: { id: 'asc' },
          take: autres.length * FACTURES_PAR_DECLARATION,
        })
      : [];
    const nomDe = new Map(paiements.map((p) => [p.id, p.nom]));
    const rendu = new Map<string, { montant: number; par: string[] }>();
    const ajouter = (factureId: string, montant: number, paiementId: string) => {
      if (montant <= EPSILON) return;
      const x = rendu.get(factureId) ?? { montant: 0, par: [] };
      x.montant = c(x.montant + montant);
      const nom = nomDe.get(paiementId);
      if (nom && !x.par.includes(nom)) x.par.push(nom);
      rendu.set(factureId, x);
    };
    const idsAnterieurs = new Set(anterieurs.map((p) => p.id));
    const imputation = imputerPaiements(
      dettes,
      anterieurs,
      declarees
        .filter((d) => idsAnterieurs.has(d.ligneReglementId))
        .map((d) => ({ paiementId: d.ligneReglementId, detteId: versLaFacture(d.ligneFactureId), montant: n(d.montant) })),
    );
    for (const [detteId, parts] of imputation.parDette) for (const p of parts) ajouter(detteId, p.montant, p.paiementId);
    const idsPosterieurs = new Set(posterieurs.map((p) => p.id));
    for (const d of declarees) if (idsPosterieurs.has(d.ligneReglementId)) ajouter(versLaFacture(d.ligneFactureId), n(d.montant), d.ligneReglementId);
    return rendu;
  }

  /**
   * LES VERROUS D'UN GESTE, dans un ordre FIXE · le paiement, ses factures et
   * son groupe (relecture du 2026-10-07, M4). Deux gestes qui touchent une
   * même facture passent l'un après l'autre · trié, l'ordre ne se croise
   * jamais entre deux transactions.
   */
  private async verrouiller(tx: Prisma.TransactionClient, tenantId: string, cles: string[]) {
    for (const cle of [...new Set(cles)].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`imputation-paiement:${tenantId}:${cle}`}))`;
    }
  }

  /** La période liquidée qui couvre une date, et le premier jour non liquidé qui la suit. */
  private async periodeLiquidee(tenantId: string, date: Date) {
    const couvrante = (d: Date) =>
      this.prisma.liquidationTva.findFirst({
        where: { tenantId, dateDebut: { lte: d }, dateFin: { gte: d } },
        select: { dateDebut: true, dateFin: true },
        orderBy: { dateDebut: 'asc' },
      });
    const liquidee = await couvrante(date);
    if (!liquidee) return null;
    // Le premier jour libre · comme `repartirEncaissement`, de liquidation en
    // liquidation contiguë. La borne ne coupe rien d'utile (vingt ans de mois).
    let libre = lendemain(liquidee.dateFin);
    for (let i = 0; i < 240; i++) {
      const suivante = await couvrante(libre);
      if (!suivante) break;
      libre = lendemain(suivante.dateFin);
    }
    return { du: liquidee.dateDebut, au: liquidee.dateFin, premierJourLibre: libre };
  }

  /** La taxe portée au premier jour libre, lue par le moteur même. */
  private async taxeDuJour(tenantId: string, d: Date) {
    const lue = await this.tva.declaration(tenantId, d, finDuJour(d));
    return { collecte: n(lue.totalCollecte), deductible: n(lue.totalDeductible) };
  }

  /**
   * LE GESTE QUI TOUCHE UN MOIS LIQUIDÉ LE DIT, AVEC LE MONTANT (relecture du
   * 2026-10-07, M3). Ce que la liquidation a déclaré reste déclaré
   * (`tvaEncaissementFigee`) ; la taxe que le geste déplace est portée au
   * premier jour non liquidé (`repartirEncaissement`) · le moteur est lu
   * avant et après le geste sur ce seul jour, et l'écart est rendu. Un calcul
   * qui échoue ne défait jamais le geste · il est consigné, et le message le
   * dit (« non calculée »), jamais un zéro.
   */
  private async avecEffetSurLiquidation<T>(tenantId: string, datePaiement: Date | null, geste: () => Promise<T>): Promise<{ resultat: T; liquidation: EffetSurLiquidation | null }> {
    const periode = datePaiement ? await this.periodeLiquidee(tenantId, datePaiement) : null;
    if (!periode) return { resultat: await geste(), liquidation: null };
    let avant: { collecte: number; deductible: number } | null = null;
    let motif: string | null = null;
    try {
      avant = await this.taxeDuJour(tenantId, periode.premierJourLibre);
    } catch (e) {
      motif = e instanceof Error ? e.message : String(e);
      this.journalServeur.error(`Taxe du premier jour libre non lue avant le geste (dossier ${tenantId}) · ${motif}`);
    }
    const resultat = await geste();
    let apres: { collecte: number; deductible: number } | null = null;
    if (avant) {
      try {
        apres = await this.taxeDuJour(tenantId, periode.premierJourLibre);
      } catch (e) {
        motif = e instanceof Error ? e.message : String(e);
        this.journalServeur.error(`Taxe du premier jour libre non lue après le geste (dossier ${tenantId}) · ${motif}`);
      }
    }
    const collecte = avant && apres ? c(apres.collecte - avant.collecte) : null;
    const deductible = avant && apres ? c(apres.deductible - avant.deductible) : null;
    const fc = (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(2)} CDF`;
    const message =
      `Le paiement du ${jjmmaaaa(datePaiement!)} tombe dans la période liquidée du ${jjmmaaaa(periode.du)} au ${jjmmaaaa(periode.au)} · ` +
      'ce que cette liquidation a déclaré reste déclaré. La taxe que ce geste déplace est portée au premier jour non liquidé, le ' +
      `${jjmmaaaa(periode.premierJourLibre)} · ` +
      (collecte === null || deductible === null
        ? `montant non calculé (${motif ?? 'lecture impossible'}), à relire sur la déclaration de cette période.`
        : `collecte ${fc(collecte)}, déduction ${fc(deductible)} (lus sur la déclaration de ce jour, avant et après le geste) ; ` +
          'un trop-déclaré s’impute sur les encaissements suivants de la même facture.');
    return {
      resultat,
      liquidation: {
        du: jour(periode.du)!,
        au: jour(periode.au)!,
        premierJourLibre: jour(periode.premierJourLibre)!,
        collecte,
        deductible,
        message,
      },
    };
  }

  async declarer(tenantId: string, userId: string, dto: DeclarerImputationDto) {
    const idsFactures = dto.factures.map((f) => f.ligneFactureId);
    const pieceDate = new Date(`${dto.pieceDate.slice(0, 10)}T00:00:00.000Z`);
    // LA VÉRIFICATION RELIT TOUT CE QU'ELLE JUGE (M4) · lignes, groupe et
    // déclarations, par le client qu'on lui passe · hors transaction pour
    // refuser vite, puis dans la transaction, sous les verrous, avant d'écrire.
    const verifier = async (client: Prisma.TransactionClient | PrismaService) => {
      const lues = await this.lignesDeTiers(client, tenantId, [dto.ligneReglementId, ...idsFactures]);
      const reglement = lues.get(dto.ligneReglementId) ?? null;
      let dejaRecu = new Map<string, { montant: number; par: string[] }>();
      let versLaFacture: ReadonlyMap<string, string> = new Map();
      let motifEnBloc: string | null = null;
      let origineDuReport: string | null = null;
      // Le groupe se lit pour un paiement lettré, dans le sens d'un paiement ·
      // le reste est refusé par la règle, sur la ligne seule.
      if (reglement?.lettrageId && Math.abs(reglement.sens) > EPSILON) {
        const lecture = await this.lireLeGroupe(client, tenantId, reglement.lettrageId, reglement.sens > 0 ? -1 : 1);
        if (lecture.tronque) {
          return {
            motif: `Le groupe de lettrage du paiement dépasse ${PLAFOND_LIGNES_GROUPE_IMPUTATION} lignes · il ne se lit pas ici, et aucune imputation n’y est déclarée.`,
            reglement,
          };
        }
        motifEnBloc = lecture.motifEnBloc;
        const origine = lecture.paiementsReportes.get(reglement.id);
        const o = origine ? lecture.lignes.find((x) => x.id === origine) : undefined;
        if (o) origineDuReport = `pièce ${o.ecriture.numeroPiece ?? 'sans numéro'} du ${jjmmaaaa(o.ecriture.date)}`;
        if (!motifEnBloc && !reglement.aNouveau && !reglement.exerciceClos) {
          dejaRecu = await this.dejaRecuParFacture(client, tenantId, reglement, lecture);
          versLaFacture = lecture.reportsVers;
        }
      }
      const actives = await client.imputationPaiement.count({ where: { tenantId, retireeLe: null, ligneReglementId: dto.ligneReglementId } });
      const motif = motifRefusDeclaration({
        reglement,
        factures: dto.factures.map((f) => ({
          ligne: lues.get(f.ligneFactureId) ?? null,
          idDemande: f.ligneFactureId,
          montant: f.montant,
          dejaDeclare: dejaRecu.get(versLaFacture.get(f.ligneFactureId) ?? f.ligneFactureId)?.montant ?? 0,
          consommePar: dejaRecu.get(versLaFacture.get(f.ligneFactureId) ?? f.ligneFactureId)?.par,
        })),
        dejaActive: actives > 0,
        pieceReference: dto.pieceReference,
        fondement: dto.fondement,
        pieceDate,
        preuveAcceptation: dto.preuveAcceptation ?? null,
        origineDuReport,
        motifEnBloc,
      });
      return { motif, reglement };
    };
    const premier = await verifier(this.prisma);
    if (premier.motif) throw new BadRequestException(premier.motif);
    const { resultat, liquidation } = await this.avecEffetSurLiquidation(tenantId, premier.reglement?.date ?? null, () =>
      transactionJournalisee(this.prisma, async (tx) => {
        // DEUX DÉCLARATIONS QUI TOUCHENT UN MÊME PAIEMENT, UNE MÊME FACTURE OU
        // UN MÊME GROUPE NE PASSENT PAS ENSEMBLE · verrous dans la transaction
        // courte qui écrit, puis la vérification rejouée sur ce qu'elle relit.
        await this.verrouiller(tx, tenantId, [
          `paiement:${dto.ligneReglementId}`,
          ...idsFactures.map((id) => `facture:${id}`),
          ...(premier.reglement?.lettrageId ? [`groupe:${premier.reglement.lettrageId}`] : []),
        ]);
        const encore = await verifier(tx);
        if (encore.motif) throw new ConflictException(encore.motif);
        const crees = [];
        for (const f of dto.factures) {
          // Une ligne par facture, chacune par un `create` unitaire · le journal
          // d'audit garde chaque part, jamais une opération de masse.
          crees.push(
            await tx.imputationPaiement.create({
              data: {
                tenantId,
                ligneReglementId: dto.ligneReglementId,
                ligneFactureId: f.ligneFactureId,
                montant: c(f.montant),
                fondement: dto.fondement,
                pieceReference: dto.pieceReference.trim(),
                pieceDate,
                preuveAcceptation: dto.fondement === 'QUITTANCE_ACCEPTEE' ? dto.preuveAcceptation!.trim() : null,
                createdBy: userId,
              },
            }),
          );
        }
        return crees.map((x) => ({ ...x, montant: n(x.montant) }));
      }),
    );
    return { imputations: resultat, liquidation };
  }

  async retirer(tenantId: string, userId: string, ligneReglementId: string, dto: RetirerImputationDto) {
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException('Le motif du retrait est exigé, de 3 à 500 caractères.');
    const paiement = (await this.lignesDeTiers(this.prisma, tenantId, [ligneReglementId])).get(ligneReglementId);
    if (!paiement) throw new NotFoundException('Le paiement désigné est introuvable dans ce dossier.');
    // UN EXERCICE CLÔTURÉ NE SE RETOUCHE PAS (relecture du 2026-10-07, M3) ·
    // ses déclarations de TVA sont arrêtées sur l'imputation qu'il portait.
    if (paiement.exerciceClos) throw new ConflictException(motifPaiementExerciceClos(paiement.date));
    const lire = (client: Prisma.TransactionClient | PrismaService) =>
      client.imputationPaiement.findMany({
        where: { tenantId, retireeLe: null, ligneReglementId },
        select: { id: true, ligneFactureId: true },
        orderBy: { id: 'asc' },
        take: FACTURES_PAR_DECLARATION + 1,
      });
    const avantVerrou = await lire(this.prisma);
    if (avantVerrou.length === 0) throw new NotFoundException('Aucune imputation déclarée active pour ce paiement.');
    const le = new Date();
    const { resultat, liquidation } = await this.avecEffetSurLiquidation(tenantId, paiement.date ?? null, () =>
      transactionJournalisee(this.prisma, async (tx) => {
        await this.verrouiller(tx, tenantId, [`paiement:${ligneReglementId}`, ...avantVerrou.map((a) => `facture:${a.ligneFactureId}`)]);
        // RELUES SOUS LE VERROU (M4) · une part retirée entre-temps ne se
        // retire pas deux fois, et rien de retiré n'est compté.
        const actives = await lire(tx);
        if (actives.length === 0) throw new ConflictException('L’imputation déclarée de ce paiement a été retirée entre-temps · rien n’est retiré.');
        // Un `update` UNITAIRE par part · le journal d'audit garde le motif de
        // chacune, là où un `updateMany` ne laisserait que le filtre et le compte.
        for (const a of actives) {
          await tx.imputationPaiement.update({
            where: { id: a.id },
            data: { retireeLe: le, retireePar: userId, motifRetrait: motif },
          });
        }
        return actives.length;
      }),
    );
    return { retirees: resultat, liquidation };
  }

  /**
   * LE GROUPE D'UN PAIEMENT, LU POUR L'ÉCRAN, TEL QUE LE MOTEUR LE RETIENT
   * (relecture du 2026-10-07, mineur, puis second tour) · la lecture de la
   * porte et du moteur (`lireLeGroupe` · toute la chaîne des reports, les
   * inscriptions en négatif retirées avec ce qu'elles annulent, le groupe lu
   * en bloc dit), les imputations déclarées actives, et l'imputation retenue
   * (déclarée, sinon légale, art. 154) · servie, jamais recalculée à l'écran.
   * `ligneADesigner` est la ligne du groupe que la déclaration désigne (le
   * report pour une facture de N) ; `motifNonDesignable` dit pourquoi un
   * paiement ne se déclare pas d'ici.
   */
  async groupe(tenantId: string, ligneId: string) {
    const ligne = await this.prisma.ligneEcriture.findFirst({
      where: { id: ligneId, ecriture: { tenantId } },
      select: { id: true, lettrageId: true, compte: { select: { numero: true, intitule: true } }, lettrage: { select: { statut: true } } },
    });
    if (!ligne) throw new NotFoundException('Ligne introuvable dans ce dossier.');
    const vide = { lettrageId: ligne.lettrageId, compte: ligne.compte, factures: [], paiements: [], nonImpute: [], tronque: false, declareesTronquees: false };
    // LE SENS DE LA FACTURE SE LIT À LA NATURE DU COMPTE · débit au client
    // (41), crédit au fournisseur (40). Ailleurs, l'imputation ne se déclare
    // pas (`motifRefusDeclaration`), et l'écran le dit.
    const auClient = ligne.compte.numero.startsWith('41');
    if (!auClient && !ligne.compte.numero.startsWith('40')) {
      return { ...vide, nonServi: `Le compte ${ligne.compte.numero} n’est ni un compte client (41) ni un compte fournisseur (40) · l’imputation d’un paiement ne s’y déclare pas.` };
    }
    if (!ligne.lettrageId) return { ...vide, nonServi: 'La ligne n’est lettrée avec rien · une imputation se lit dans le groupe qui réunit le paiement et ses factures.' };
    const sensFacture = auClient ? 1 : -1;
    // LA LECTURE DU MOTEUR, LA MÊME QUE LA PORTE (second tour, B-2 et M-b) ·
    // la chaîne des reports, les inscriptions en négatif, et le groupe lu en
    // bloc dit, jamais montré avec une imputation que le moteur écarterait.
    const lecture = await this.lireLeGroupe(this.prisma, tenantId, ligne.lettrageId, sensFacture);
    if (lecture.tronque) return { ...vide, tronque: true, nonServi: `Le groupe dépasse ${PLAFOND_LIGNES_GROUPE_IMPUTATION} lignes · il ne se lit pas ici.` };
    if (lecture.motifEnBloc) return { ...vide, nonServi: motifGroupeLuEnBloc(lecture.motifEnBloc) };
    const sensDe = (l: LigneDeGroupe) => n(l.debit) - n(l.credit);
    const lignes = lecture.lignes;
    const factures = lignes.filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 === sensFacture > 0);
    const paiements = lignes.filter((l) => Math.abs(sensDe(l)) > EPSILON && sensDe(l) > 0 !== sensFacture > 0);
    const dansLeGroupe = (l: LigneDeGroupe) => l.lettrageId === ligne.lettrageId;
    // La ligne de CE groupe qui porte chaque facture · elle-même, ou son
    // report quand le report est lettré ici (un report d'un autre groupe de
    // la chaîne ne se désigne pas d'ici).
    const ligneADesigner = new Map<string, string>();
    const idsDuGroupe = new Set(lecture.brutes.map((x) => x.id));
    for (const [report, origine] of lecture.reportsVers) if (idsDuGroupe.has(report)) ligneADesigner.set(origine, report);
    // L'exercice de chaque paiement · un exercice clôturé ne se retouche pas (M-a).
    const etats = await this.lignesDeTiers(this.prisma, tenantId, paiements.map((p) => p.id));
    const plafondDeclarees = Math.max(1, paiements.length) * FACTURES_PAR_DECLARATION;
    const declareesLues = paiements.length
      ? await this.prisma.imputationPaiement.findMany({
          where: { tenantId, retireeLe: null, ligneReglementId: { in: paiements.map((p) => p.id) } },
          select: {
            id: true,
            ligneReglementId: true,
            ligneFactureId: true,
            montant: true,
            fondement: true,
            pieceReference: true,
            pieceDate: true,
            preuveAcceptation: true,
          },
          orderBy: { id: 'asc' },
          take: plafondDeclarees + 1,
        })
      : [];
    const declareesTronquees = declareesLues.length > plafondDeclarees;
    const declarees = declareesLues.slice(0, plafondDeclarees);
    const resultat = imputerPaiements(
      factures.map((f) => ({ id: f.id, dateFacture: f.ecriture.date, dateEcheance: f.dateEcheance, montant: Math.abs(sensDe(f)) })),
      paiements.map((p) => ({ id: p.id, date: p.ecriture.date, montant: Math.abs(sensDe(p)) })),
      declarees.map((d) => ({ paiementId: d.ligneReglementId, detteId: lecture.reportsVers.get(d.ligneFactureId) ?? d.ligneFactureId, montant: n(d.montant) })),
    );
    /*
      POURQUOI UN PAIEMENT NE SE DÉCLARE PAS D'ICI · dit par le serveur, par la
      règle de la porte · un report d'à-nouveau n'est pas un paiement (art. 151),
      un paiement d'un exercice clôturé ne se retouche plus (M-a), un paiement
      d'un autre groupe de la chaîne se déclare depuis son groupe.
    */
    const motifNonDesignable = (p: LigneDeGroupe): string | null => {
      if (p.ecriture.estGenereeParCloture || p.ecriture.estANouveauProvisoire) return motifReportDePaiement(null);
      if (!dansLeGroupe(p)) return 'Paiement d’un autre groupe de lettrage, lu avec ce groupe par la chaîne des reports · il se déclare depuis son groupe.';
      if (etats.get(p.id)?.exerciceClos) return motifPaiementExerciceClos(p.ecriture.date);
      return null;
    };
    return {
      lettrageId: ligne.lettrageId,
      compte: ligne.compte,
      tronque: false,
      declareesTronquees,
      factures: factures.map((f) => {
        const designee = ligneADesigner.get(f.id) ?? (dansLeGroupe(f) ? f.id : null);
        return {
          id: f.id,
          // La ligne que la déclaration désigne · `null`, facture d'un autre
          // groupe de la chaîne, qui ne se désigne pas d'ici.
          ligneADesigner: designee,
          reportee: ligneADesigner.has(f.id),
          libelle: f.ecriture.estGenereeParCloture || f.ecriture.estANouveauProvisoire ? f.libelle || f.ecriture.libelle : f.ecriture.libelle,
          piece: f.ecriture.numeroPiece ?? null,
          date: jour(f.ecriture.date),
          echeance: jour(f.dateEcheance),
          montant: c(Math.abs(sensDe(f))),
          imputations: (resultat.parDette.get(f.id) ?? []).map((x) => ({ paiementId: x.paiementId, date: jour(x.date), montant: x.montant, fondement: x.fondement })),
        };
      }),
      paiements: paiements.map((p) => {
        const motif = motifNonDesignable(p);
        return {
          id: p.id,
          designable: motif === null,
          ...(motif ? { motifNonDesignable: motif } : {}),
          libelle: p.ecriture.libelle,
          piece: p.ecriture.numeroPiece ?? null,
          date: jour(p.ecriture.date),
          montant: c(Math.abs(sensDe(p))),
          validee: p.ecriture.statut === StatutEcriture.VALIDEE,
          declarees: declarees
            .filter((d) => d.ligneReglementId === p.id)
            .map((d) => ({ ...d, montant: n(d.montant), pieceDate: jour(d.pieceDate) })),
        };
      }),
      nonImpute: resultat.nonImpute,
    };
  }
}
