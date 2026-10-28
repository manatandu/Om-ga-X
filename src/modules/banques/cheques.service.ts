import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EtatChequeEmis, NatureModeReglement, Prisma, StatutEcriture } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasaIso, jourValide } from '../../common/echeance';
import { ecartDeLaPiece, etatDuCheque, motifRefusChequier, motifRefusNumero, numeroImprime, prochainNumeroLibre } from './cheques';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { estTresorerieEnDevises } from '../virements-fonds/virement-fonds';
import { AnnulerChequeDto, AnnulerNumeroDto, CreerChequierDto, EmettreChequeDto, RattacherPieceChequeDto } from './dto/cheques.dto';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

/** Ce que les listes rendent à la fois · le reste se dit (§ 8 bis). */
const PLAFOND_CHEQUIERS = 200;
const PLAFOND_CHEQUES = 500;
const PLAFOND_PIECES = 100;

const jour = (d: Date) => d.toISOString().slice(0, 10);
const aMinuit = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// Un jour qui existe au calendrier (relecture m1) · `2026-13-45` levait en 500.
const valide = (iso: string) => jourValide(iso) !== null;
const enCentimes = (d: Prisma.Decimal | number) => Math.round(Number(d) * 100);
const fr = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * REGISTRE DES CHÈQUES ÉMIS (ligne microfina-m2, idée 9).
 *
 * Le chéquier est reçu sur un RIB du dossier ; chaque numéro sert une fois,
 * émis ou annulé. Le chèque émis se rattache à la PIÈCE DE LA BANQUE qui le
 * porte (règlement des tiers, ou saisie au journal de banque) · c'est par
 * elle que l'encaissement se LIT au rapprochement bancaire, jamais saisi.
 * Une pièce payée par un ORDRE DE VIREMENT n'est pas un chèque (le règlement
 * de la ligne est un virement), et le refus le dit.
 */
@Injectable()
export class ChequesService {
  constructor(private readonly prisma: PrismaService) {}

  private async rib(tenantId: string, ribId: string, db: Db) {
    const r = await db.ribBanque.findFirst({
      where: { id: ribId, tenantId },
      select: {
        id: true,
        abrege: true,
        devise: true,
        banque: { select: { intitule: true } },
        journal: { select: { id: true, code: true, compteTresorerieId: true, compteTresorerie: { select: { numero: true } } } },
      },
    });
    if (!r) throw new NotFoundException('Compte bancaire introuvable dans ce dossier.');
    return r;
  }

  private async carnet(tenantId: string, chequierId: string, db: Db) {
    const c = await db.chequier.findFirst({
      where: { id: chequierId, tenantId },
      select: {
        id: true,
        numeroDebut: true,
        numeroFin: true,
        largeur: true,
        dateReception: true,
        rib: { select: { id: true, abrege: true, devise: true, journal: { select: { id: true, code: true, compteTresorerieId: true, compteTresorerie: { select: { numero: true } } } } } },
      },
    });
    if (!c) throw new NotFoundException('Chéquier introuvable dans ce dossier.');
    return c;
  }

  /**
   * UN CARNET SUR UN COMPTE EN DEVISE EST REFUSÉ (relecture M2) · le chèque se
   * comparait aux FRANCS que la pièce porte au crédit de la banque, et un
   * chèque de 1 000 dollars ne retrouvait jamais sa pièce de 2 850 000 francs
   * (ou pire, une pièce de 1 000 francs passait pour lui). La monnaie d'un
   * chèque et le montant en devise des lignes (F49) ne sont pas encore tenus
   * par le registre · le refus, même règle que le virement de fonds et les
   * financements (`banque-en-francs.ts`) · RIB en devise, racine du plan « en
   * devises », ou ligne en devise déjà passée au compte de la banque.
   */
  private async motifCompteEnDevise(
    tenantId: string,
    rib: { abrege: string; devise: string | null; journal: { compteTresorerieId: string | null; compteTresorerie: { numero: string } | null } | null },
    db: Db,
  ): Promise<string | null> {
    const deviseRib = (rib.devise ?? '').trim().toUpperCase();
    const compte = rib.journal?.compteTresorerie ?? null;
    const compteId = rib.journal?.compteTresorerieId ?? null;
    const [dossier, ligneEnDevise] = await Promise.all([
      db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
      compteId
        ? db.ligneEcriture.findFirst({ where: { compteId, deviseId: { not: null }, ecriture: { tenantId, ...HORS_SITUATION } }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    const enDevise = (deviseRib !== '' && deviseRib !== MONNAIE_DE_TENUE) || (compte !== null && estTresorerieEnDevises(compte.numero, dossier.referentiel)) || ligneEnDevise !== null;
    if (!enDevise) return null;
    return (
      `Le compte bancaire ${rib.abrege} est tenu en devise${deviseRib && deviseRib !== MONNAIE_DE_TENUE ? ` (${deviseRib})` : ''} · le registre des chèques ne compare encore ` +
      "un chèque qu'aux francs de sa pièce. Tenez les chèques de ce compte hors du registre ; sa pièce se passe au journal de la banque, avec son montant en devise et son cours."
    );
  }

  // --- Chéquiers ------------------------------------------------------------

  async listerChequiers(tenantId: string) {
    const [carnets, total] = await Promise.all([
      this.prisma.chequier.findMany({
        where: { tenantId },
        orderBy: [{ dateReception: 'desc' }, { numeroDebut: 'desc' }],
        take: PLAFOND_CHEQUIERS,
        include: {
          rib: { select: { id: true, abrege: true, banque: { select: { intitule: true } } } },
          cheques: { select: { numero: true, etat: true } },
        },
      }),
      this.prisma.chequier.count({ where: { tenantId } }),
    ]);
    return {
      chequiers: carnets.map((c) => {
        const utilises = c.cheques.map((x) => x.numero);
        return {
          id: c.id,
          rib: c.rib,
          numeroDebut: c.numeroDebut,
          numeroFin: c.numeroFin,
          debutImprime: numeroImprime(c.numeroDebut, c.largeur),
          finImprime: numeroImprime(c.numeroFin, c.largeur),
          largeur: c.largeur,
          barre: c.barre,
          dateReception: jour(c.dateReception),
          commentaire: c.commentaire,
          emis: c.cheques.filter((x) => x.etat === EtatChequeEmis.EMIS).length,
          annules: c.cheques.filter((x) => x.etat === EtatChequeEmis.ANNULE).length,
          disponibles: c.numeroFin - c.numeroDebut + 1 - utilises.length,
          prochainLibre: prochainNumeroLibre(c, utilises),
        };
      }),
      total,
      tronque: total > carnets.length,
    };
  }

  async creerChequier(tenantId: string, userId: string, dto: CreerChequierDto) {
    if (!valide(dto.dateReception)) throw new BadRequestException('La date de réception se donne au format AAAA-MM-JJ.');
    if (dto.dateReception > jourDeKinshasaIso(new Date())) throw new BadRequestException("Un chéquier ne se reçoit pas dans l'avenir.");
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chequiers:${tenantId}`}))`;
      const rib = await this.rib(tenantId, dto.ribId, tx);
      const devise = await this.motifCompteEnDevise(tenantId, rib, tx);
      if (devise) throw new BadRequestException(devise);
      const autres = await tx.chequier.findMany({ where: { tenantId, ribId: rib.id }, select: { numeroDebut: true, numeroFin: true } });
      const motif = motifRefusChequier(dto.numeroDebut, dto.numeroFin, dto.largeur, autres);
      if (motif) throw new BadRequestException(motif);
      return tx.chequier.create({
        data: {
          tenantId,
          ribId: rib.id,
          numeroDebut: dto.numeroDebut,
          numeroFin: dto.numeroFin,
          largeur: dto.largeur,
          barre: dto.barre ?? true,
          dateReception: aMinuit(dto.dateReception),
          commentaire: dto.commentaire?.trim() || null,
          createdBy: userId,
        },
        select: { id: true },
      });
    });
  }

  /** Un carnet saisi par erreur se retire tant qu'aucun numéro n'a servi. */
  async supprimerChequier(tenantId: string, id: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chequiers:${tenantId}`}))`;
      const c = await tx.chequier.findFirst({ where: { id, tenantId }, select: { id: true, _count: { select: { cheques: true } } } });
      if (!c) throw new NotFoundException('Chéquier introuvable dans ce dossier.');
      if (c._count.cheques > 0) throw new BadRequestException(`Ce carnet a servi (${c._count.cheques} numéro(s)) · il ne se retire plus, ses souches font pièce (CPCC, ch. 1 § 1.1.1).`);
      await tx.chequier.delete({ where: { id } });
      return { supprime: true };
    });
  }

  // --- Chèques ---------------------------------------------------------------

  /**
   * LA PIÈCE QUI PAIE PAR CE CHÈQUE · une écriture du JOURNAL DE LA BANQUE du
   * carnet, qui crédite son compte du montant du chèque, au centime ; ni de
   * situation ni à-nouveau provisoire ; pas payée par un ordre de virement ;
   * sans ligne de banque réglée par un autre mode que le chèque.
   */
  private async motifRefusPiece(
    tenantId: string,
    carnet: { rib: { journal: { id: string; code: string; compteTresorerieId: string | null } | null } },
    ecritureId: string,
    montantCentimes: number,
    db: Db,
  ): Promise<{ motif: string } | { decrite: string; date: string }> {
    const journal = carnet.rib.journal;
    if (!journal || !journal.compteTresorerieId) {
      return { motif: "Le compte bancaire du carnet n'est rattaché à aucun journal de banque · rattachez-le (Structure > Banques) pour lier ses chèques aux pièces." };
    }
    const e = await db.ecriture.findFirst({
      where: { id: ecritureId, tenantId, statut: { in: [StatutEcriture.BROUILLARD, StatutEcriture.VALIDEE] } },
      select: {
        id: true,
        journalId: true,
        numeroPiece: true,
        date: true,
        libelle: true,
        estANouveauProvisoire: true,
        _count: { select: { lignesOrdreVirement: true } },
        correction: { select: { id: true } },
        lignes: { where: { compteId: journal.compteTresorerieId }, select: { debit: true, credit: true, modeReglement: { select: { nature: true } } } },
      },
    });
    if (!e) return { motif: 'Pièce introuvable dans ce dossier (ou écriture de situation).' };
    if (e.estANouveauProvisoire) return { motif: "L'à-nouveau provisoire ne paie aucun chèque." };
    if (e.correction) return { motif: 'Cette pièce est corrigée par son négatif · annulée au journal, elle ne paie plus rien.' };
    if (e.journalId !== journal.id) return { motif: `La pièce n'est pas au journal ${journal.code} de ce compte bancaire.` };
    if (e._count.lignesOrdreVirement > 0) return { motif: 'Cette pièce est payée par un ordre de virement · un virement n’est pas un chèque.' };
    const autreMode = e.lignes.find((l) => l.modeReglement && l.modeReglement.nature !== NatureModeReglement.CHEQUE);
    if (autreMode) return { motif: `La pièce est réglée par un autre mode que le chèque (${autreMode.modeReglement?.nature}).` };
    const credit = e.lignes.reduce((s, l) => s + enCentimes(l.credit) - enCentimes(l.debit), 0);
    if (credit !== montantCentimes) {
      return { motif: `La pièce crédite la banque de ${fr(credit)} et le chèque porte ${fr(montantCentimes)} · un chèque paie une pièce de son montant exact.` };
    }
    return { decrite: `${journal.code} · pièce ${e.numeroPiece ?? '·'} du ${jour(e.date).split('-').reverse().join('/')} · ${e.libelle}`.slice(0, 200), date: jour(e.date) };
  }

  async emettre(tenantId: string, userId: string, dto: EmettreChequeDto) {
    if (!valide(dto.dateEmission)) throw new BadRequestException("La date d'émission se donne au format AAAA-MM-JJ.");
    if (dto.dateEmission > jourDeKinshasaIso(new Date())) throw new BadRequestException("Un chèque ne s'émet pas dans l'avenir · un chèque postdaté reste daté du jour où il est tiré.");
    const beneficiaire = dto.beneficiaire.trim();
    if (!beneficiaire) throw new BadRequestException('Le bénéficiaire du chèque est exigé.');
    const c = Math.round(dto.montant * 100);
    if (!Number.isFinite(dto.montant) || dto.montant <= 0 || c / 100 !== dto.montant) throw new BadRequestException('Le montant du chèque est positif, au centime.');
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cheques:${tenantId}`}))`;
      const carnet = await this.carnet(tenantId, dto.chequierId, tx);
      const devise = await this.motifCompteEnDevise(tenantId, carnet.rib, tx);
      if (devise) throw new BadRequestException(devise);
      const motifNumero = motifRefusNumero(dto.numero, carnet);
      if (motifNumero) throw new BadRequestException(motifNumero);
      if (dto.dateEmission < jour(carnet.dateReception)) throw new BadRequestException('Le chèque est daté avant la réception du carnet.');
      const pris = await tx.chequeEmis.findFirst({ where: { tenantId, chequierId: carnet.id, numero: dto.numero }, select: { etat: true } });
      if (pris) throw new ConflictException(`Le chèque ${numeroImprime(dto.numero, carnet.largeur)} a déjà servi (${pris.etat === EtatChequeEmis.EMIS ? 'émis' : 'annulé'}) · un numéro ne sert qu'une fois.`);
      const avertissements: string[] = [];
      let pieceDecrite: string | null = null;
      if (dto.ecritureId) {
        const r = await this.motifRefusPiece(tenantId, carnet, dto.ecritureId, c, tx);
        if ('motif' in r) throw new BadRequestException(r.motif);
        const dejaLiee = await tx.chequeEmis.findFirst({ where: { tenantId, ecritureId: dto.ecritureId }, select: { numero: true } });
        if (dejaLiee) throw new ConflictException(`Cette pièce est déjà payée par le chèque n° ${dejaLiee.numero}.`);
        pieceDecrite = r.decrite;
        if (r.date !== dto.dateEmission) {
          avertissements.push("La pièce n'est pas datée du jour d'émission · le chèque s'enregistre « dès l'émission » (Guide SYSCOHADA, Partie 1 ch. 4 § 2.2).");
        }
      }
      const cree = await tx.chequeEmis.create({
        data: {
          tenantId,
          chequierId: carnet.id,
          numero: dto.numero,
          etat: EtatChequeEmis.EMIS,
          dateEmission: aMinuit(dto.dateEmission),
          beneficiaire,
          montant: new Prisma.Decimal(dto.montant),
          ecritureId: dto.ecritureId ?? null,
          pieceDecrite,
          createdBy: userId,
        },
        select: { id: true },
      });
      return { id: cree.id, avertissements };
    });
  }

  /** Lier (ou relier) la pièce d'un chèque émis sans elle · même contrôle qu'à l'émission. */
  async rattacherPiece(tenantId: string, id: string, dto: RattacherPieceChequeDto) {
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cheques:${tenantId}`}))`;
      const ch = await tx.chequeEmis.findFirst({ where: { id, tenantId }, select: { id: true, etat: true, montant: true, ecritureId: true, chequierId: true } });
      if (!ch) throw new NotFoundException('Chèque introuvable dans ce dossier.');
      if (ch.etat !== EtatChequeEmis.EMIS || ch.montant === null) throw new BadRequestException('Un chèque annulé ne paie rien.');
      if (ch.ecritureId) throw new ConflictException('Ce chèque porte déjà sa pièce.');
      const carnet = await this.carnet(tenantId, ch.chequierId, tx);
      const devise = await this.motifCompteEnDevise(tenantId, carnet.rib, tx);
      if (devise) throw new BadRequestException(devise);
      const r = await this.motifRefusPiece(tenantId, carnet, dto.ecritureId, enCentimes(ch.montant), tx);
      if ('motif' in r) throw new BadRequestException(r.motif);
      const dejaLiee = await tx.chequeEmis.findFirst({ where: { tenantId, ecritureId: dto.ecritureId }, select: { numero: true } });
      if (dejaLiee) throw new ConflictException(`Cette pièce est déjà payée par le chèque n° ${dejaLiee.numero}.`);
      await tx.chequeEmis.update({ where: { id }, data: { ecritureId: dto.ecritureId, pieceDecrite: r.decrite } });
      return { rattache: true };
    });
  }

  /**
   * ANNULER UN CHÈQUE ÉMIS · refusé une fois encaissé (la banque l'a payé, le
   * relevé en fait foi). Sa pièce est DÉLIÉE, sa description gardée · la
   * pièce elle-même reste au journal, et c'est dit (au brouillard elle se
   * retire, validée elle s'inscrit en négatif · AUDCIF art. 20, al. 2).
   */
  async annuler(tenantId: string, userId: string, id: string, dto: AnnulerChequeDto) {
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException("Le motif d'annulation est exigé.");
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cheques:${tenantId}`}))`;
      const ch = await tx.chequeEmis.findFirst({
        where: { id, tenantId },
        select: { id: true, etat: true, ecritureId: true, pieceDecrite: true, chequier: { select: { rib: { select: { journal: { select: { compteTresorerieId: true } } } } } } },
      });
      if (!ch) throw new NotFoundException('Chèque introuvable dans ce dossier.');
      if (ch.etat === EtatChequeEmis.ANNULE) throw new ConflictException('Ce chèque est déjà annulé.');
      const compte = ch.chequier.rib.journal?.compteTresorerieId ?? null;
      // UNE PIÈCE CORRIGÉE PAR SON NÉGATIF N'EST PAS UN CHÈQUE PAYÉ (relecture
      // M3) · l'original et le négatif se pointent ensemble, leur somme nulle,
      // et le pointage ne dit plus que la banque a débité · l'annulation reste
      // ouverte (`etatDuCheque`, PIÈCE ANNULÉE).
      const corrigee = ch.ecritureId ? await tx.ecriture.count({ where: { tenantId, corrigeEcritureId: ch.ecritureId, ...HORS_SITUATION } }) : 0;
      if (ch.ecritureId && compte && corrigee === 0) {
        const pointees = await tx.ligneEcriture.count({ where: { ecritureId: ch.ecritureId, compteId: compte, rapprochementId: { not: null } } });
        if (pointees > 0) throw new BadRequestException('Ce chèque est pointé au rapprochement face au relevé · la banque l’a payé, il ne s’annule plus.');
      }
      // UNE PIÈCE CORRIGÉE RESTE LIÉE · elle ne paie plus rien (refusée à tout
      // autre chèque, `motifRefusPiece`) et le lien dit, au total en
      // circulation à une date passée (relecture m9), que le chèque était déjà
      // annulé au journal ce jour-là. Une pièce encore vivante, elle, se délie,
      // pour être retirée ou inscrite en négatif.
      await tx.chequeEmis.update({
        where: { id },
        data: { etat: EtatChequeEmis.ANNULE, ecritureId: corrigee > 0 ? ch.ecritureId : null, annuleLe: new Date(), annulePar: userId, motifAnnulation: motif },
      });
      return {
        annule: true,
        avertissements: !ch.ecritureId
          ? []
          : corrigee > 0
            ? [`La pièce ${ch.pieceDecrite ?? ''} est déjà inscrite en négatif au journal · rien à y reprendre.`]
            : [`La pièce ${ch.pieceDecrite ?? ''} reste au journal · retirez-la au brouillard, ou inscrivez-la en négatif si elle est validée (AUDCIF art. 20, al. 2).`],
      };
    });
  }

  /** Annuler un numéro qui n'a jamais été émis · feuillet gâché, perdu, chèque refait. */
  async annulerNumero(tenantId: string, userId: string, dto: AnnulerNumeroDto) {
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException("Le motif d'annulation est exigé.");
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cheques:${tenantId}`}))`;
      const carnet = await this.carnet(tenantId, dto.chequierId, tx);
      const m = motifRefusNumero(dto.numero, carnet);
      if (m) throw new BadRequestException(m);
      const pris = await tx.chequeEmis.findFirst({ where: { tenantId, chequierId: carnet.id, numero: dto.numero }, select: { id: true } });
      if (pris) throw new ConflictException('Ce numéro a déjà servi · annulez le chèque lui-même.');
      return tx.chequeEmis.create({
        data: { tenantId, chequierId: carnet.id, numero: dto.numero, etat: EtatChequeEmis.ANNULE, annuleLe: new Date(), annulePar: userId, motifAnnulation: motif, createdBy: userId },
        select: { id: true },
      });
    });
  }

  /**
   * LE REGISTRE · chaque numéro servi et son état LU. Le total EN CIRCULATION
   * est pris sur tout le registre, pas sur la tranche affichée · c'est la
   * somme que la régularisation de fin de période doit retrouver (Guide
   * SYSCOHADA, Partie 1 ch. 4 § 2.2).
   *
   * À UNE DATE D'ARRÊTÉ (relecture m9, `au`) · le total se relit tel qu'il
   * était ce jour-là · émis au plus tard ce jour, ni annulé ni encaissé avant
   * la fin du jour. Encaissé se lit sur la DATE DU RELEVÉ du rapprochement qui
   * a pointé la ligne (convention d'OmegaX · la pièce ne date pas le débit de
   * la banque, le relevé si), annulé sur l'instant de l'annulation au jour de
   * Kinshasa, la pièce corrigée sur la date de son négatif. Sans date, l'état
   * d'aujourd'hui.
   */
  async lister(tenantId: string, chequierId?: string, au?: string) {
    if (au !== undefined && !valide(au)) throw new BadRequestException("La date d'arrêté se donne au jour (AAAA-MM-JJ).");
    const filtre: Prisma.ChequeEmisWhereInput = chequierId ? { chequierId } : {};
    const [cheques, total] = await Promise.all([
      this.prisma.chequeEmis.findMany({
        where: { tenantId, ...filtre },
        orderBy: [{ dateEmission: { sort: 'desc', nulls: 'last' } }, { numero: 'desc' }],
        take: PLAFOND_CHEQUES,
        include: {
          chequier: { select: { largeur: true, rib: { select: { abrege: true, journal: { select: { id: true, compteTresorerieId: true } } } } } },
          ecriture: { select: { id: true, statut: true, journalId: true, correction: { select: { id: true } } } },
        },
      }),
      this.prisma.chequeEmis.count({ where: { tenantId, ...filtre } }),
    ]);
    // UNE lecture pour toute la tranche · les lignes de banque des pièces
    // reliées, jamais une requête par chèque (cinq cents allers-retours).
    // Une pièce reliée est au brouillard ou validée (la porte de
    // `motifRefusPiece`), jamais une situation · le statut est écrit quand même.
    const pieces = [...new Set(cheques.map((ch) => ch.ecritureId).filter((x): x is string => x !== null))];
    const lignesDesPieces = pieces.length
      ? await this.prisma.ligneEcriture.findMany({
          where: { ecritureId: { in: pieces }, ecriture: { tenantId, statut: { in: [StatutEcriture.BROUILLARD, StatutEcriture.VALIDEE] } } },
          select: { ecritureId: true, compteId: true, debit: true, credit: true, rapprochementId: true, ligneReleve: { select: { date: true } }, rapprochement: { select: { dateReleve: true } } },
        })
      : [];
    const lus = [];
    for (const ch of cheques) {
      const compte = ch.chequier.rib.journal?.compteTresorerieId ?? null;
      let lignesBanque = 0;
      let lignesPointees = 0;
      let encaisseLe: string | null = null;
      let ecartPiece: string | null = null;
      if (ch.ecritureId && compte) {
        const lignes = lignesDesPieces.filter((l) => l.ecritureId === ch.ecritureId && l.compteId === compte);
        lignesBanque = lignes.length;
        lignesPointees = lignes.filter((l) => l.rapprochementId).length;
        const d = lignes.map((l) => l.ligneReleve?.date ?? l.rapprochement?.dateReleve).find((x) => x);
        encaisseLe = d ? jour(d) : null;
        // LA PIÈCE EST REJUGÉE À CHAQUE LECTURE (relecture M4) · retouchée au
        // brouillard depuis le lien, elle peut ne plus payer ce chèque.
        if (ch.ecriture && ch.montant !== null) {
          ecartPiece = ecartDeLaPiece({
            journalAttenduId: ch.chequier.rib.journal?.id ?? null,
            journalId: ch.ecriture.journalId,
            creditCentimes: lignes.reduce((t, l) => t + enCentimes(l.credit) - enCentimes(l.debit), 0),
            montantCentimes: enCentimes(ch.montant),
          });
        }
      }
      const pieceCorrigee = Boolean(ch.ecriture?.correction);
      const etatLu = etatDuCheque({ etat: ch.etat, aUnePiece: Boolean(ch.ecritureId), pieceCorrigee, lignesBanque, lignesPointees });
      lus.push({
        id: ch.id,
        chequierId: ch.chequierId,
        compte: ch.chequier.rib.abrege,
        numero: ch.numero,
        numeroImprime: numeroImprime(ch.numero, ch.chequier.largeur),
        etat: etatLu,
        dateEmission: ch.dateEmission ? jour(ch.dateEmission) : null,
        beneficiaire: ch.beneficiaire,
        montant: ch.montant === null ? null : Number(ch.montant),
        pieceDecrite: ch.pieceDecrite,
        pieceAuBrouillard: ch.ecriture?.statut === StatutEcriture.BROUILLARD,
        // UNE PIÈCE RETIRÉE DU JOURNAL SE DIT · la liaison tombe avec elle
        // (SET NULL), la description reste ; sans ce drapeau, l'écran la
        // montrait comme la pièce qui paie encore le chèque.
        pieceRetiree: ch.etat === EtatChequeEmis.EMIS && ch.ecritureId === null && ch.pieceDecrite !== null,
        ecartPiece: etatLu === 'PIECE_ANNULEE' ? null : ecartPiece,
        encaisseLe: etatLu === 'ENCAISSE' ? encaisseLe : null,
        motifAnnulation: ch.motifAnnulation,
      });
    }
    // EN CIRCULATION, SUR TOUT LE REGISTRE · la règle d'`etatDuCheque`,
    // écrite en filtre. Une somme par COMPTE DE BANQUE, ses carnets ensemble ·
    // jamais une requête par carnet (un dossier ancien en compte des dizaines).
    const carnets = await this.prisma.chequier.findMany({
      where: { tenantId, ...(chequierId ? { id: chequierId } : {}) },
      select: { id: true, rib: { select: { journal: { select: { compteTresorerieId: true } } } } },
    });
    const parCompte = new Map<string | null, string[]>();
    for (const c of carnets) {
      const compte = c.rib.journal?.compteTresorerieId ?? null;
      parCompte.set(compte, [...(parCompte.get(compte) ?? []), c.id]);
    }
    let nombreCirculation = 0;
    let centimesCirculation = 0;
    for (const [compte, ids] of parCompte) {
      const a = await this.prisma.chequeEmis.aggregate({
        where: { tenantId, chequierId: { in: ids }, ...filtreEnCirculation(compte, au) },
        _sum: { montant: true },
        _count: { _all: true },
      });
      nombreCirculation += a._count._all;
      centimesCirculation += enCentimes(a._sum.montant ?? 0);
    }
    return {
      cheques: lus,
      total,
      tronque: total > cheques.length,
      enCirculation: { nombre: nombreCirculation, montant: centimesCirculation / 100, au: au ?? null },
    };
  }

  /** Les pièces qu'un chèque de ce carnet peut payer · journal de la banque, crédit, aucun chèque lié, aucun ordre de virement. */
  async piecesProposees(tenantId: string, chequierId: string, recherche?: string) {
    const carnet = await this.carnet(tenantId, chequierId, this.prisma);
    const journal = carnet.rib.journal;
    if (!journal?.compteTresorerieId) return { pieces: [], total: 0, tronque: false, motif: "Le compte bancaire du carnet n'est rattaché à aucun journal de banque." };
    const texte = recherche?.trim();
    const where: Prisma.EcritureWhereInput = {
      journalId: journal.id,
      statut: { in: [StatutEcriture.BROUILLARD, StatutEcriture.VALIDEE] },
      estANouveauProvisoire: false,
      chequeEmis: { is: null },
      lignesOrdreVirement: { none: {} },
      lignes: { some: { compteId: journal.compteTresorerieId, credit: { gt: 0 } } },
      ...(texte ? { libelle: { contains: texte, mode: 'insensitive' as const } } : {}),
    };
    const [pieces, total] = await Promise.all([
      this.prisma.ecriture.findMany({
        where: { tenantId, ...where },
        orderBy: [{ date: 'desc' }],
        take: PLAFOND_PIECES,
        select: { id: true, date: true, numeroPiece: true, libelle: true, statut: true, lignes: { where: { compteId: journal.compteTresorerieId }, select: { debit: true, credit: true } } },
      }),
      this.prisma.ecriture.count({ where: { tenantId, ...where } }),
    ]);
    return {
      pieces: pieces.map((p) => ({
        id: p.id,
        date: jour(p.date),
        numeroPiece: p.numeroPiece,
        libelle: p.libelle,
        statut: p.statut,
        montant: p.lignes.reduce((s, l) => s + enCentimes(l.credit) - enCentimes(l.debit), 0) / 100,
      })),
      total,
      tronque: total > pieces.length,
      motif: null,
    };
  }
}

/**
 * LE FILTRE « EN CIRCULATION » d'un compte de banque (relecture m9) · sans
 * date, l'état d'aujourd'hui (émis, pièce non corrigée, une ligne de banque
 * non pointée, ou aucune pièce) ; à une date `au`, l'état de ce jour-là ·
 * émis au plus tard ce jour, annulé après lui ou pas du tout, pièce corrigée
 * après lui ou pas du tout, une ligne non pointée par un relevé daté au plus
 * tard ce jour. Exporté pour son test (la règle s'écrit ici, une fois).
 */
export function filtreEnCirculation(compte: string | null, au?: string): Prisma.ChequeEmisWhereInput {
  if (au === undefined) {
    const pieceNonCorrigee: Prisma.EcritureWhereInput = { correction: { is: null } };
    return {
      etat: EtatChequeEmis.EMIS,
      OR: compte
        ? [
            { ecritureId: null },
            { ecriture: { is: { ...pieceNonCorrigee, lignes: { some: { compteId: compte, rapprochementId: null } } } } },
            { ecriture: { is: { ...pieceNonCorrigee, lignes: { none: { compteId: compte } } } } },
          ]
        : [{ ecritureId: null }, { ecriture: { is: pieceNonCorrigee } }],
    };
  }
  const jourAu = aMinuit(au);
  // La fin du jour à Kinshasa (UTC+1) · 23 h UTC, comme `jourDeKinshasa`.
  const finDuJour = new Date(`${au}T23:00:00.000Z`);
  const pieceEnCirculation: Prisma.EcritureWhereInput = {
    AND: [
      { OR: [{ correction: { is: null } }, { correction: { is: { date: { gt: jourAu } } } }] },
      compte
        ? {
            OR: [
              { lignes: { some: { compteId: compte, OR: [{ rapprochementId: null }, { rapprochement: { is: { dateReleve: { gt: jourAu } } } }] } } },
              { lignes: { none: { compteId: compte } } },
            ],
          }
        : {},
    ],
  };
  return {
    dateEmission: { lte: jourAu },
    AND: [
      { OR: [{ etat: EtatChequeEmis.EMIS }, { etat: EtatChequeEmis.ANNULE, annuleLe: { gte: finDuJour } }] },
      { OR: [{ ecritureId: null }, { ecriture: { is: pieceEnCirculation } }] },
    ],
  };
}
