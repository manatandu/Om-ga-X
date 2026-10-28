import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutEcriture, StatutExercice, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasaIso, jourValide } from '../../common/echeance';
import { RACINE_CAISSE, soldeDeCaisseAuJour } from '../comptabilite/caisse-provisionnee';
import { comparaisonAuPlafond, especesDesCoupures, heureValide, mentionsDeLArrete, plafondEnVigueur } from './arrete-caisse';
import { AnnulerArreteCaisseDto, CreerPlafondEncaisseDto, EtablirArreteCaisseDto } from './dto/arrete-caisse.dto';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

/** Ce que les listes rendent à la fois · le reste se dit (§ 8 bis). */
const PLAFOND_CAISSES = 200;
const PLAFOND_ARRETES = 500;

const jour = (d: Date) => d.toISOString().slice(0, 10);
const aMinuit = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const enCentimes = (d: Prisma.Decimal | number) => Math.round(Number(d) * 100);
const decimal = (c: number) => new Prisma.Decimal(c).div(100);
// Un jour qui existe au calendrier (relecture m1) · `2026-13-45` levait en 500.
const valide = (iso: string) => jourValide(iso) !== null;

/**
 * ARRÊTÉ DE CAISSE QUOTIDIEN ET PLAFOND D'ENCAISSE (ligne microfina-m2, idée 5).
 *
 * Le procès-verbal de comptage d'inventaire compte la caisse pour la clôture
 * (CPCC § VI ; AUDCIF art. 42) ; l'arrêté la compte AU JOUR, par coupures,
 * contre le solde de tout ce qui est saisi (fiche du compte 57 · « bordereaux
 * de situation journalière »). Il FIGE ce qu'il a lu, ne passe aucune
 * écriture, et dit ses écarts. Le plafond d'encaisse, convention du dossier,
 * avertit.
 */
@Injectable()
export class ArretesCaisseService {
  constructor(private readonly prisma: PrismaService) {}

  /** La caisse · un compte 57 d'imputation du dossier, et lui seul (fiche du compte 57). */
  private async caisse(tenantId: string, compteId: string, db: Db) {
    const c = await db.compte.findFirst({ where: { id: compteId, tenantId }, select: { id: true, numero: true, intitule: true, typeCompte: true } });
    if (!c) throw new NotFoundException('Caisse introuvable dans ce dossier.');
    if (!c.numero.startsWith(RACINE_CAISSE) || c.typeCompte !== TypeCompteDetailTotal.DETAIL) {
      throw new BadRequestException(`Le compte ${c.numero} n'est pas une caisse · l'arrêté de caisse porte sur un compte 57 d'imputation.`);
    }
    return c;
  }

  /** L'exercice du dossier qui contient le jour · aucun, refus nommé. */
  private async exerciceDuJour(tenantId: string, iso: string, db: Db) {
    const e = await db.exercice.findFirst({
      where: { tenantId, dateDebut: { lte: aMinuit(iso) }, dateFin: { gte: aMinuit(iso) } },
      select: { id: true, dateDebut: true, statut: true },
    });
    if (!e) throw new BadRequestException(`Aucun exercice du dossier ne couvre le ${iso.split('-').reverse().join('/')}.`);
    return e;
  }

  /** Ce que l'arrêté lirait · solde, unité, brouillard, plafond. Lecture seule. */
  private async lecture(tenantId: string, compteId: string, iso: string, db: Db) {
    const caisse = await this.caisse(tenantId, compteId, db);
    const exercice = await this.exerciceDuJour(tenantId, iso, db);
    const { devise, soldeCentimes, exercicesRemontes } = await soldeDeCaisseAuJour(db as Tx, tenantId, compteId, exercice, iso);
    const auBrouillard = (where: Prisma.EcritureWhereInput) =>
      db.ecriture.count({ where: { tenantId, statut: StatutEcriture.BROUILLARD, estANouveauProvisoire: false, lignes: { some: { compteId } }, ...where } });
    const [brouillardDuJour, brouillardAnterieur, versions, deviseLue] = await Promise.all([
      auBrouillard({ exerciceId: exercice.id, date: { lte: aMinuit(iso) } }),
      // LE BROUILLARD QUE LE SOLDE REMONTE SE COMPTE AUSSI (relecture m4) ·
      // l'exercice antérieur non clôturé entre dans le solde en entier.
      exercicesRemontes.length ? auBrouillard({ exerciceId: { in: exercicesRemontes } }) : Promise.resolve(0),
      db.plafondEncaisse.findMany({ where: { tenantId, compteId }, select: { dateEffet: true, montant: true, deviseId: true } }),
      devise ? db.devise.findFirst({ where: { id: devise, tenantId }, select: { code: true } }) : Promise.resolve(null),
    ]);
    const plafond = plafondEnVigueur(
      versions.map((v) => ({ dateEffet: jour(v.dateEffet), montantCentimes: enCentimes(v.montant), deviseId: v.deviseId })),
      iso,
    );
    return { caisse, exercice, devise, codeDevise: deviseLue?.code ?? null, soldeCentimes, brouillard: brouillardDuJour + brouillardAnterieur, brouillardAnterieur, plafond };
  }

  /** L'aperçu · ce que l'arrêté figerait maintenant, et l'arrêté du jour s'il existe. */
  async apercu(tenantId: string, compteId: string, iso: string) {
    if (!valide(iso)) throw new BadRequestException('Le jour se donne au format AAAA-MM-JJ.');
    const l = await this.lecture(tenantId, compteId, iso, this.prisma);
    const existant = await this.prisma.arreteCaisse.findFirst({ where: { tenantId, compteId, jour: aMinuit(iso), annuleLe: null }, select: { id: true } });
    const precedent = await this.prisma.arreteCaisse.findFirst({
      where: { tenantId, compteId, annuleLe: null, jour: { lt: aMinuit(iso) } },
      orderBy: { jour: 'desc' },
      select: { jour: true, coupures: { select: { valeurUnitaire: true }, orderBy: { valeurUnitaire: 'desc' } } },
    });
    const cmp = comparaisonAuPlafond(l.soldeCentimes, l.devise, l.plafond);
    return {
      caisse: { id: l.caisse.id, numero: l.caisse.numero, intitule: l.caisse.intitule },
      jour: iso,
      exerciceClos: l.exercice.statut === StatutExercice.CLOTURE,
      unite: l.devise,
      codeUnite: l.codeDevise,
      soldeTheorique: l.soldeCentimes / 100,
      ecrituresAuBrouillard: l.brouillard,
      brouillardExercicesAnterieurs: l.brouillardAnterieur,
      plafond: cmp.plafondCentimes === null ? null : cmp.plafondCentimes / 100,
      soldeAuDelaDuPlafond: cmp.depasse,
      plafondNonCompare: cmp.nonCompare,
      arreteExistantId: existant?.id ?? null,
      // Les valeurs faciales du dernier arrêté de la caisse, pour la grille ·
      // aucune table des coupures n'est écrite de mémoire.
      coupuresProposees: (precedent?.coupures ?? []).map((c) => Number(c.valeurUnitaire)),
    };
  }

  async etablir(tenantId: string, userId: string, dto: EtablirArreteCaisseDto) {
    if (!valide(dto.jour)) throw new BadRequestException('Le jour se donne au format AAAA-MM-JJ.');
    if (dto.jour > jourDeKinshasaIso(new Date())) throw new BadRequestException("Un arrêté de caisse ne se date pas dans l'avenir · on arrête ce qu'on a compté.");
    if (dto.heure !== undefined && dto.heure !== null && heureValide(dto.heure) === null) throw new BadRequestException("L'heure se donne au format HH:MM.");
    const especes = especesDesCoupures(dto.coupures);
    if ('motif' in especes) throw new BadRequestException(especes.motif);
    const caissier = dto.caissier.trim();
    if (!caissier) throw new BadRequestException("Le nom de celui qui a compté est exigé · un arrêté sans signataire n'atteste rien.");

    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`arretes-caisse:${tenantId}:${dto.compteId}`}))`;
      const l = await this.lecture(tenantId, dto.compteId, dto.jour, tx);
      if (l.exercice.statut === StatutExercice.CLOTURE) {
        throw new BadRequestException(
          "L'exercice du jour est clôturé · une caisse comptée pour la clôture relève du procès-verbal de comptage de l'inventaire (Traitement > Inventaire physique).",
        );
      }
      // L'UNITÉ DE L'APERÇU EST REJOUÉE (comme le PV, ligne A10) · une ligne en
      // devise saisie entre l'aperçu et l'envoi changerait l'unité du solde,
      // et les coupures comptées dans l'autre unité se compareraient de travers.
      if ((dto.uniteAttendue ?? null) !== (l.devise ?? null)) {
        throw new ConflictException("L'unité de la caisse a changé depuis l'aperçu · rechargez l'arrêté avant de l'établir.");
      }
      const existant = await tx.arreteCaisse.findFirst({ where: { tenantId, compteId: dto.compteId, jour: aMinuit(dto.jour), annuleLe: null }, select: { id: true } });
      if (existant) throw new ConflictException('Cette caisse a déjà son arrêté pour ce jour · annulez-le avec son motif pour en établir un autre.');
      // Le SOLDE se compare au plafond, comme à l'aperçu (relecture m5).
      const cmp = comparaisonAuPlafond(l.soldeCentimes, l.devise, l.plafond);
      const arrete = await tx.arreteCaisse.create({
        data: {
          tenantId,
          exerciceId: l.exercice.id,
          compteId: dto.compteId,
          jour: aMinuit(dto.jour),
          heure: dto.heure ?? null,
          deviseId: l.devise,
          soldeTheorique: decimal(l.soldeCentimes),
          ecrituresAuBrouillard: l.brouillard,
          brouillardExercicesAnterieurs: l.brouillardAnterieur,
          especesComptees: decimal(especes.centimes),
          ecart: decimal(especes.centimes - l.soldeCentimes),
          plafondFige: cmp.plafondCentimes === null ? null : decimal(cmp.plafondCentimes),
          plafondNonCompare: cmp.nonCompare,
          caissier,
          controlePar: dto.controlePar?.trim() || null,
          observations: dto.observations?.trim() || null,
          etabliPar: userId,
        },
      });
      for (const c of dto.coupures) {
        await tx.coupureArreteCaisse.create({ data: { tenantId, arreteId: arrete.id, valeurUnitaire: new Prisma.Decimal(c.valeurUnitaire), nombre: c.nombre } });
      }
      return {
        id: arrete.id,
        mentions: mentionsDeLArrete({
          soldeCentimes: l.soldeCentimes,
          especesCentimes: especes.centimes,
          ecrituresAuBrouillard: l.brouillard,
          brouillardExercicesAnterieurs: l.brouillardAnterieur,
          depassePlafond: cmp.depasse,
          plafondCentimes: cmp.plafondCentimes,
          nonCompare: cmp.nonCompare,
        }),
      };
    });
  }

  /** Les arrêtés, les plus récents d'abord · tranche dite. */
  async lister(tenantId: string, compteId?: string) {
    const filtre: Prisma.ArreteCaisseWhereInput = compteId ? { compteId } : {};
    const [arretes, total] = await Promise.all([
      this.prisma.arreteCaisse.findMany({
        where: { tenantId, ...filtre },
        orderBy: [{ jour: 'desc' }, { etabliLe: 'desc' }],
        take: PLAFOND_ARRETES,
        include: {
          compte: { select: { numero: true, intitule: true } },
          devise: { select: { code: true } },
          coupures: { orderBy: { valeurUnitaire: 'desc' }, select: { valeurUnitaire: true, nombre: true } },
        },
      }),
      this.prisma.arreteCaisse.count({ where: { tenantId, ...filtre } }),
    ]);
    return {
      arretes: arretes.map((a) => ({
        id: a.id,
        caisse: a.compte,
        jour: jour(a.jour),
        heure: a.heure,
        unite: a.devise?.code ?? null,
        soldeTheorique: Number(a.soldeTheorique),
        ecrituresAuBrouillard: a.ecrituresAuBrouillard,
        brouillardExercicesAnterieurs: a.brouillardExercicesAnterieurs,
        especesComptees: Number(a.especesComptees),
        ecart: Number(a.ecart),
        plafond: a.plafondFige === null ? null : Number(a.plafondFige),
        caissier: a.caissier,
        controlePar: a.controlePar,
        observations: a.observations,
        etabliLe: a.etabliLe,
        annuleLe: a.annuleLe,
        motifAnnulation: a.motifAnnulation,
        coupures: a.coupures.map((c) => ({ valeurUnitaire: Number(c.valeurUnitaire), nombre: c.nombre })),
        mentions: a.annuleLe
          ? []
          : mentionsDeLArrete({
              soldeCentimes: enCentimes(a.soldeTheorique),
              especesCentimes: enCentimes(a.especesComptees),
              ecrituresAuBrouillard: a.ecrituresAuBrouillard,
              brouillardExercicesAnterieurs: a.brouillardExercicesAnterieurs,
              depassePlafond: a.plafondFige === null ? null : enCentimes(a.soldeTheorique) > enCentimes(a.plafondFige),
              plafondCentimes: a.plafondFige === null ? null : enCentimes(a.plafondFige),
              nonCompare: a.plafondNonCompare,
            }),
      })),
      total,
      tronque: total > arretes.length,
    };
  }

  /** Un arrêté faux s'ANNULE avec son motif · il reste au registre, jamais supprimé. */
  async annuler(tenantId: string, userId: string, id: string, dto: AnnulerArreteCaisseDto) {
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException("Le motif d'annulation est exigé.");
    return transactionJournalisee(this.prisma, async (tx) => {
      const lu = await tx.arreteCaisse.findFirst({ where: { id, tenantId }, select: { compteId: true } });
      if (!lu) throw new NotFoundException('Arrêté introuvable dans ce dossier.');
      // SOUS LE VERROU DE LA CAISSE, RELU APRÈS LUI (relecture m6) · le même que
      // l'établissement · une annulation et un nouvel arrêté du même jour ne
      // se croisent pas, et deux annulations ne passent pas toutes deux.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`arretes-caisse:${tenantId}:${lu.compteId}`}))`;
      const a = await tx.arreteCaisse.findFirst({ where: { id, tenantId }, select: { id: true, annuleLe: true, exercice: { select: { statut: true } } } });
      if (!a) throw new NotFoundException('Arrêté introuvable dans ce dossier.');
      if (a.annuleLe) throw new ConflictException('Cet arrêté est déjà annulé.');
      // UN EXERCICE CLÔTURÉ NE BOUGE PLUS (relecture m6) · l'arrêté y est une
      // pièce de contrôle de la caisse de cet exercice (fiche du compte 57,
      // « bordereaux de situation journalière »), conservée telle qu'arrêtée.
      if (a.exercice.statut === StatutExercice.CLOTURE) {
        throw new BadRequestException("L'exercice de cet arrêté est clôturé · l'arrêté reste tel qu'il a été établi, pièce de contrôle de la caisse de cet exercice.");
      }
      await tx.arreteCaisse.update({ where: { id }, data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: motif } });
      return { annule: true };
    });
  }

  /**
   * LA SITUATION DES CAISSES AU JOUR · solde, plafond en vigueur, dernier
   * arrêté. Les caisses du plan (57 d'imputation), mouvementées ou non.
   */
  async situation(tenantId: string, iso: string) {
    if (!valide(iso)) throw new BadRequestException('Le jour se donne au format AAAA-MM-JJ.');
    const where: Prisma.CompteWhereInput = { numero: { startsWith: RACINE_CAISSE }, typeCompte: TypeCompteDetailTotal.DETAIL, estActif: true };
    const [caisses, total] = await Promise.all([
      this.prisma.compte.findMany({ where: { tenantId, ...where }, orderBy: { numero: 'asc' }, take: PLAFOND_CAISSES, select: { id: true, numero: true, intitule: true } }),
      this.prisma.compte.count({ where: { tenantId, ...where } }),
    ]);
    const exercice = await this.prisma.exercice.findFirst({
      where: { tenantId, dateDebut: { lte: aMinuit(iso) }, dateFin: { gte: aMinuit(iso) } },
      select: { id: true, dateDebut: true },
    });
    // PLAFONDS ET DERNIERS ARRÊTÉS LUS EN UNE FOIS pour la tranche (relecture
    // m8) · jamais deux requêtes par caisse. Le SOLDE, lui, reste lu caisse par
    // caisse · c'est la lecture du refus de la caisse créditrice
    // (`soldeDeCaisseAuJour`, ouverture remontée compte par compte), qu'une
    // seconde écriture groupée ferait diverger d'elle.
    const ids = caisses.map((c) => c.id);
    const [toutesVersions, derniers] = ids.length
      ? await Promise.all([
          this.prisma.plafondEncaisse.findMany({ where: { tenantId, compteId: { in: ids } }, select: { compteId: true, dateEffet: true, montant: true, deviseId: true } }),
          this.prisma.arreteCaisse.findMany({
            where: { tenantId, compteId: { in: ids }, annuleLe: null },
            orderBy: [{ compteId: 'asc' }, { jour: 'desc' }],
            distinct: ['compteId'],
            select: { compteId: true, jour: true, ecart: true },
          }),
        ])
      : [[], []];
    const lignes = [];
    for (const c of caisses) {
      const versions = toutesVersions.filter((v) => v.compteId === c.id);
      const dernier = derniers.find((d) => d.compteId === c.id) ?? null;
      // SANS EXERCICE, AUCUN SOLDE · « non calculé », jamais zéro.
      const lu = exercice ? await soldeDeCaisseAuJour(this.prisma as unknown as Tx, tenantId, c.id, exercice, iso) : null;
      const plafond = plafondEnVigueur(versions.map((v) => ({ dateEffet: jour(v.dateEffet), montantCentimes: enCentimes(v.montant), deviseId: v.deviseId })), iso);
      const cmp = lu ? comparaisonAuPlafond(lu.soldeCentimes, lu.devise, plafond) : { plafondCentimes: null, depasse: null, nonCompare: null };
      lignes.push({
        caisse: c,
        solde: lu ? lu.soldeCentimes / 100 : null,
        unite: lu?.devise ?? null,
        plafond: cmp.plafondCentimes === null ? null : cmp.plafondCentimes / 100,
        auDelaDuPlafond: cmp.depasse,
        plafondNonCompare: cmp.nonCompare,
        dernierArrete: dernier ? { jour: jour(dernier.jour), ecart: Number(dernier.ecart) } : null,
      });
    }
    return { jour: iso, exerciceTrouve: Boolean(exercice), caisses: lignes, total, tronque: total > caisses.length };
  }

  // --- Plafond d'encaisse (structure du dossier) ----------------------------

  async listerPlafonds(tenantId: string, compteId: string) {
    await this.caisse(tenantId, compteId, this.prisma);
    const versions = await this.prisma.plafondEncaisse.findMany({
      where: { tenantId, compteId },
      orderBy: { dateEffet: 'desc' },
      take: PLAFOND_ARRETES,
      include: { devise: { select: { code: true } } },
    });
    return versions.map((v) => ({ id: v.id, dateEffet: jour(v.dateEffet), montant: Number(v.montant), unite: v.devise?.code ?? null, motif: v.motif }));
  }

  async creerPlafond(tenantId: string, userId: string, dto: CreerPlafondEncaisseDto) {
    if (!valide(dto.dateEffet)) throw new BadRequestException("La date d'effet se donne au format AAAA-MM-JJ.");
    if (!Number.isFinite(dto.montant) || dto.montant <= 0 || Math.round(dto.montant * 100) / 100 !== dto.montant) {
      throw new BadRequestException('Le plafond est un montant positif, au centime.');
    }
    const motif = dto.motif.trim();
    if (motif.length < 3) throw new BadRequestException("Le motif est exigé · la décision interne qui fixe le plafond (aucun texte n'en fixe).");
    await this.caisse(tenantId, dto.compteId, this.prisma);
    if (dto.deviseId) {
      const d = await this.prisma.devise.findFirst({ where: { id: dto.deviseId, tenantId }, select: { id: true } });
      if (!d) throw new NotFoundException('Devise introuvable dans ce dossier.');
    }
    // SOUS LE VERROU DE LA CAISSE, ET LA CLÉ UNIQUE TRADUITE (relecture m7) ·
    // deux envois du même plafond passaient tous deux la lecture, et le
    // second tombait sur la clé en 500 anonyme.
    const DOUBLON = 'Cette caisse a déjà un plafond à cette date d’effet · retirez-le ou choisissez une autre date.';
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`arretes-caisse:${tenantId}:${dto.compteId}`}))`;
        const doublon = await tx.plafondEncaisse.findFirst({ where: { tenantId, compteId: dto.compteId, dateEffet: aMinuit(dto.dateEffet) }, select: { id: true } });
        if (doublon) throw new ConflictException(DOUBLON);
        return tx.plafondEncaisse.create({
          data: { tenantId, compteId: dto.compteId, dateEffet: aMinuit(dto.dateEffet), montant: new Prisma.Decimal(dto.montant), deviseId: dto.deviseId ?? null, motif, createdBy: userId },
          select: { id: true },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(DOUBLON);
      throw e;
    }
  }

  /** Un plafond se retire · les arrêtés ont recopié celui qu'ils ont lu, rien ne se dénoue. */
  async retirerPlafond(tenantId: string, id: string) {
    // Sous le verrou de la caisse et relu après lui (relecture m7) · deux
    // retraits du même plafond ne font plus un 500 sur la ligne déjà partie.
    return transactionJournalisee(this.prisma, async (tx) => {
      const lu = await tx.plafondEncaisse.findFirst({ where: { id, tenantId }, select: { compteId: true } });
      if (!lu) throw new NotFoundException('Plafond introuvable dans ce dossier.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`arretes-caisse:${tenantId}:${lu.compteId}`}))`;
      const v = await tx.plafondEncaisse.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!v) throw new ConflictException('Ce plafond vient d’être retiré · rechargez la liste.');
      await tx.plafondEncaisse.delete({ where: { id } });
      return { retire: true };
    });
  }
}
