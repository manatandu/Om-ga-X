import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { retirerLesLignesLibres } from '../comptabilite/lignes-libres';
import { NatureMouvementTitre, NatureValeurTitre, Prisma, StatutEcriture, StatutExercice, TypeCompteDetailTotal, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionDeSaisie } from '../../common/transaction-de-saisie';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { journalDeBanqueEnFrancs } from './banque-en-francs';
import { refuserSiDernierJourClos } from './cloture-du-dernier-jour';
import {
  COMPTE_DEPRECIATION,
  COMPTE_DOTATION,
  COMPTE_GAIN,
  COMPTE_PERTE,
  COMPTE_REPRISE,
  RACINES_EXCLUES,
  RACINES_FRAIS,
  RACINE_TITRES,
  coutDeLaCession,
  coutDetenu,
  depreciationNecessaire,
  lotsDetenus,
  motifRefusCompteFrais,
  motifRefusCompteTitre,
  motifRefusEvaluation,
  motifRefusMouvement,
  motifRefusTitre,
  natureAttendue,
  pieceAcquisition,
  pieceCession,
  pieceEcartDepreciation,
  quantiteDetenue,
  type LignePropose,
  type MouvementLu,
} from './titres-placement';
import type { AnnulerTitreDto, EvaluationTitreDto, MouvementTitreDto, TitrePlacementDto } from './titres-placement.dto';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';

const PLAFOND_LISTE = 500;
/** Un titre dont les mouvements dépassent ce nombre ne se rejoue pas en une lecture · le geste est refusé, jamais un P.E.P.S. amputé. */
const PLAFOND_MOUVEMENTS = 5000;
const jour = (d: Date) => d.toISOString().slice(0, 10);
const aMinuit = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const enCentimes = (x: number) => Math.round(x * 100);

const LIBELLES_NATURE: Record<NatureMouvementTitre, string> = { ACQUISITION: 'Acquisition', CESSION: 'Cession' };
const COMPTE = { select: { id: true, numero: true, intitule: true } } as const;
const PIECE = { select: { id: true, numeroPiece: true, statut: true } } as const;
const MOUVEMENTS = {
  orderBy: [{ date: 'asc' as const }, { createdAt: 'asc' as const }],
  take: PLAFOND_MOUVEMENTS + 1,
  select: {
    id: true,
    nature: true,
    date: true,
    exerciceId: true,
    quantite: true,
    prix: true,
    frais: true,
    reference: true,
    coutPrixSorti: true,
    coutFraisSorti: true,
    resultat: true,
    annuleLe: true,
    motifAnnulation: true,
    journal: { select: { id: true, code: true } },
    ecriture: PIECE,
    ecritureNegatif: PIECE,
  },
};
const EVALUATIONS = {
  orderBy: [{ date: 'asc' as const }, { createdAt: 'asc' as const }],
  select: {
    id: true,
    exerciceId: true,
    date: true,
    valeurUnitaire: true,
    nature: true,
    source: true,
    quantite: true,
    cout: true,
    depreciationNecessaire: true,
    depreciationEnPlace: true,
    annuleLe: true,
    motifAnnulation: true,
    ecriture: PIECE,
    ecritureNegatif: PIECE,
  },
};
const INCLURE = { compteTitre: COMPTE, compteFrais: COMPTE, mouvements: MOUVEMENTS, evaluations: EVALUATIONS } as const;
type TitreLu = Prisma.TitrePlacementGetPayload<{ include: typeof INCLURE }>;
type MouvementLuEnBase = TitreLu['mouvements'][number];
type EvaluationLue = TitreLu['evaluations'][number];

const enMouvementLu = (m: MouvementLuEnBase): MouvementLu => ({ nature: m.nature, quantite: Number(m.quantite), prix: Number(m.prix), frais: Number(m.frais) });

/**
 * TITRES DE PLACEMENT ET PARTS D'OPCVM (ligne sage-l3, fonction 47, décision
 * D16 · Sage, F_OPPLACEMENT). Règles dans `titres-placement.ts` ; ici les
 * lectures, les pièces et les refus nommés.
 *
 * TROIS GESTES, CHACUN SA PIÈCE · l'acquisition et la cession au journal de
 * banque (en francs), la revue de clôture au journal d'opérations diverses,
 * qui ne passe que l'ÉCART avec la dépréciation en place (AUDCIF Titre VIII
 * ch. 13 § 3.2 et § 4.2). Le P.E.P.S. se rejoue sur les mouvements VIVANTS
 * dans l'ordre de leur date · c'est pourquoi aucun mouvement ne s'antidate
 * (une acquisition glissée avant une cession changerait le coût que cette
 * cession a déjà passé), et aucun ne se date dans une période qu'une revue a
 * déjà lue (la dépréciation passée porterait sur une autre quantité). Tout
 * s'annule à rebours, motif exigé (AUDCIF art. 20, al. 2) · au brouillard la
 * pièce est retirée, validée elle s'inscrit en négatif.
 */
@Injectable()
export class TitresPlacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
  ) {}

  // ----- Comptes --------------------------------------------------------------

  /** Les comptes d'un rôle sous le 50 · liste `texte` (listes-de-comptes.ts), refus de la règle appliqué à chaque ligne. */
  async comptes(tenantId: string, role: string | undefined, numero?: string) {
    if (role !== 'TITRE' && role !== 'FRAIS') throw new BadRequestException('Le rôle du compte est TITRE ou FRAIS.');
    if (numero !== undefined && numero !== '' && !/^\d{1,13}$/.test(numero)) throw new BadRequestException('Le début de numéro se tape en chiffres (treize au plus).');
    const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    const racines = role === 'TITRE' ? [RACINE_TITRES] : [...RACINES_FRAIS];
    // LES RACINES REFUSÉES SORTENT EN BASE · filtrées après coup, le total comptait les 506, 5021 et comptes de
    // frais que la liste ne montrait jamais, et « tronqué » se disait d'une liste complète (relecture du 2026-10-22).
    const exclues = role === 'TITRE' ? [...RACINES_EXCLUES[referentiel], ...RACINES_FRAIS] : [];
    const where: Prisma.CompteWhereInput = {
      typeCompte: TypeCompteDetailTotal.DETAIL,
      estActif: true,
      OR: racines.map((r) => ({ numero: { startsWith: r } })),
      AND: [...(numero ? [{ numero: { startsWith: numero } }] : []), ...exclues.map((r) => ({ NOT: { numero: { startsWith: r } } }))],
    };
    const [lus, total] = await Promise.all([
      this.prisma.compte.findMany({ where: { tenantId, ...where }, select: { id: true, numero: true, intitule: true, estRetenu: true }, orderBy: [{ estRetenu: 'desc' }, { numero: 'asc' }], take: 200 }),
      this.prisma.compte.count({ where: { tenantId, ...where } }),
    ]);
    // La règle pure reste le juge · un écart entre elle et le filtre en base serait un défaut du module, jamais un compte offert à tort.
    const comptes = lus.filter((c) => (role === 'TITRE' ? motifRefusCompteTitre(c.numero, referentiel) : motifRefusCompteFrais(c.numero)) === null);
    return { racines, comptes, motif: null, total, tronque: total > lus.length };
  }

  // ----- Titres (structure) ---------------------------------------------------

  async creerTitre(tenantId: string, userId: string, dto: TitrePlacementDto) {
    const motif = motifRefusTitre({ code: dto.code, intitule: dto.intitule });
    if (motif) throw new BadRequestException(motif);
    if (typeof dto.cote !== 'boolean') throw new BadRequestException('Dites si le titre est coté · il s’évalue au cours moyen du dernier mois s’il l’est, à sa valeur probable de négociation sinon (§ 3.2).');
    const { referentiel } = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } });
    const compteTitre = await this.compteLu(tenantId, dto.compteTitreId);
    const mTitre = motifRefusCompteTitre(compteTitre.numero, referentiel);
    if (mTitre) throw new BadRequestException(mTitre);
    let compteFraisId: string | null = null;
    if (dto.compteFraisId) {
      const compteFrais = await this.compteLu(tenantId, dto.compteFraisId);
      const mFrais = motifRefusCompteFrais(compteFrais.numero);
      if (mFrais) throw new BadRequestException(mFrais);
      // Les frais d'un titre vont au sous-compte de SA division (5016 pour le 501, 5026 pour le 502, 5036 pour le 503 · § 2.3.2).
      if (compteFrais.numero.slice(0, 3) !== compteTitre.numero.slice(0, 3)) {
        throw new BadRequestException(`Les frais d'un titre du ${compteTitre.numero.slice(0, 3)} vont au sous-compte de frais de cette division (${compteTitre.numero.slice(0, 3)}6), pas au ${compteFrais.numero}.`);
      }
      compteFraisId = compteFrais.id;
    }
    const code = String(dto.code).trim().toUpperCase();
    try {
      return await this.prisma.titrePlacement.create({
        data: { tenantId, code, intitule: String(dto.intitule).trim(), compteTitreId: compteTitre.id, compteFraisId, cote: dto.cote, createdBy: userId },
        select: { id: true, code: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(`Le code ${code} est déjà pris par un titre de ce dossier.`);
      throw e;
    }
  }

  /** Un titre sans aucun mouvement ni revue se retire (erreur de saisie) · sinon il reste, son histoire avec lui. */
  async retirerTitre(tenantId: string, id: string) {
    const t = await this.prisma.titrePlacement.findFirst({ where: { id, tenantId }, select: { id: true, code: true, _count: { select: { mouvements: true, evaluations: true } } } });
    if (!t) throw new NotFoundException('Titre introuvable pour ce dossier.');
    if (t._count.mouvements + t._count.evaluations > 0) throw new ConflictException(`Le titre ${t.code} porte ${t._count.mouvements} mouvement(s) et ${t._count.evaluations} revue(s), annulés compris · il ne se retire pas.`);
    try {
      const r = await this.prisma.titrePlacement.deleteMany({ where: { id: t.id, tenantId } });
      if (r.count !== 1) throw new ConflictException('Ce titre a changé pendant le retrait · relisez la liste.');
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw new ConflictException(`Le titre ${t.code} vient de recevoir un mouvement · il ne se retire plus.`);
      throw e;
    }
    return { id: t.id, retire: true };
  }

  // ----- Lectures -------------------------------------------------------------

  /**
   * LES TITRES DU DOSSIER, VUS DEPUIS L'EXERCICE · la position à sa clôture
   * (parts et coût au P.E.P.S. des mouvements vivants datés au plus tard ce
   * jour-là), la dépréciation en place, et la revue proposée tant que
   * l'exercice est ouvert et non revu.
   */
  async lister(tenantId: string, exerciceId: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true, dateFin: true, statut: true } });
    if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    const [titres, total] = await Promise.all([
      this.prisma.titrePlacement.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, take: PLAFOND_LISTE, include: INCLURE }),
      this.prisma.titrePlacement.count({ where: { tenantId } }),
    ]);
    return {
      exercice: { id: exercice.id, dateDebut: jour(exercice.dateDebut), dateFin: jour(exercice.dateFin), statut: exercice.statut },
      titres: titres.map((t) => this.rendre(t, exercice)),
      total,
      tronque: total > titres.length,
    };
  }

  private rendre(t: TitreLu, exercice: { id: string; dateDebut: Date; dateFin: Date; statut: StatutExercice }) {
    const tronque = t.mouvements.length > PLAFOND_MOUVEMENTS;
    const vivants = t.mouvements.filter((m) => !m.annuleLe);
    const aLaCloture = vivants.filter((m) => m.date.getTime() <= exercice.dateFin.getTime()).map(enMouvementLu);
    const revueVivante = t.evaluations.find((e) => !e.annuleLe && e.exerciceId === exercice.id) ?? null;
    const enPlace = this.enPlaceAvant(t.evaluations, exercice.dateDebut);
    const quantite = tronque ? null : quantiteDetenue(aLaCloture);
    const cout = tronque ? null : coutDetenu(aLaCloture);
    const revueProposee =
      !tronque && !revueVivante && exercice.statut !== StatutExercice.CLOTURE && ((quantite ?? 0) > 0 || enCentimes(enPlace) !== 0)
        ? { date: jour(exercice.dateFin), nature: natureAttendue(t.cote), quantite, cout, depreciationEnPlace: enPlace }
        : null;
    return {
      id: t.id,
      code: t.code,
      intitule: t.intitule,
      cote: t.cote,
      compteTitre: t.compteTitre,
      compteFrais: t.compteFrais,
      position: { date: jour(exercice.dateFin), quantite, cout, depreciationEnPlace: revueVivante ? Number(revueVivante.depreciationNecessaire) : enPlace, calculee: !tronque },
      revueProposee,
      mouvements: t.mouvements.slice(0, PLAFOND_MOUVEMENTS).map((m) => ({
        ...m,
        date: jour(m.date),
        quantite: Number(m.quantite),
        prix: Number(m.prix),
        frais: Number(m.frais),
        coutPrixSorti: m.coutPrixSorti === null ? null : Number(m.coutPrixSorti),
        coutFraisSorti: m.coutFraisSorti === null ? null : Number(m.coutFraisSorti),
        resultat: m.resultat === null ? null : Number(m.resultat),
        libelle: LIBELLES_NATURE[m.nature],
      })),
      mouvementsTronques: tronque,
      evaluations: t.evaluations.map((e) => ({
        ...e,
        date: jour(e.date),
        valeurUnitaire: Number(e.valeurUnitaire),
        quantite: Number(e.quantite),
        cout: Number(e.cout),
        depreciationNecessaire: Number(e.depreciationNecessaire),
        depreciationEnPlace: Number(e.depreciationEnPlace),
      })),
    };
  }

  /**
   * LA DÉPRÉCIATION EN PLACE avant un exercice · celle que la dernière revue
   * vivante d'un exercice antérieur a portée (chaque revue amène le 590 du
   * titre à sa dépréciation nécessaire), zéro sans revue. Jamais le solde du
   * 590, qui porte tous les titres et d'autres dépréciations.
   */
  private enPlaceAvant(evaluations: readonly EvaluationLue[], debut: Date) {
    const avant = evaluations.filter((e) => !e.annuleLe && e.date.getTime() < debut.getTime());
    return avant.length === 0 ? 0 : Number(avant[avant.length - 1].depreciationNecessaire);
  }

  // ----- Acquisition et cession ------------------------------------------------

  /** L'ACQUISITION · D 50 (prix), D 50x6 (frais) / C 52, au journal de banque en francs. */
  async acquerir(tenantId: string, userId: string, titreId: string, dto: MouvementTitreDto) {
    return this.mouvement(tenantId, userId, titreId, dto, NatureMouvementTitre.ACQUISITION);
  }

  /** LA CESSION · le coût sorti au P.E.P.S., l'écart au 777 ou au 6771 (§ 4.2). */
  async ceder(tenantId: string, userId: string, titreId: string, dto: MouvementTitreDto) {
    return this.mouvement(tenantId, userId, titreId, dto, NatureMouvementTitre.CESSION);
  }

  private async mouvement(tenantId: string, userId: string, titreId: string, dto: MouvementTitreDto, nature: NatureMouvementTitre) {
    const objet = nature === NatureMouvementTitre.ACQUISITION ? 'acquisition' : 'cession';
    const saisie = { date: dto.date, quantite: dto.quantite, prix: dto.prix, frais: dto.frais ?? 0, reference: dto.reference };
    const motif = motifRefusMouvement(saisie, objet);
    if (motif) throw new BadRequestException(motif);
    const date = saisie.date as string;
    const quantite = saisie.quantite as number;
    const prix = saisie.prix as number;
    const frais = (saisie.frais as number | null) ?? 0;
    const reference = String(saisie.reference).trim();
    const t = await this.titreLu(tenantId, titreId);
    const vivants = t.mouvements.filter((m) => !m.annuleLe);
    // AUCUN ANTIDATAGE · le P.E.P.S. se rejoue dans l'ordre des dates, et une cession passée a déjà sorti son coût.
    const dernier = vivants[vivants.length - 1];
    if (dernier && aMinuit(date).getTime() < dernier.date.getTime()) {
      throw new BadRequestException(`Le dernier mouvement du titre ${t.code} est du ${jour(dernier.date)} · un mouvement ne se date pas avant lui (le coût des cessions au P.E.P.S. en serait changé). Annulez les mouvements postérieurs, à rebours, si l'ordre est faux.`);
    }
    const revueLue = this.revueQuiLitLaDate(t, aMinuit(date));
    if (revueLue) {
      throw new BadRequestException(`La revue de clôture du ${jour(revueLue.date)} a lu la position du titre ${t.code} à cette date · un mouvement ne s'y date plus. Annulez la revue, passez le mouvement, puis refaites-la.`);
    }
    const exercice = await this.exerciceDeLaDate(tenantId, date, `de l'${objet}`);
    const banque = await journalDeBanqueEnFrancs(this.prisma, tenantId, String(dto.journalBanqueId ?? ''), `une ${objet} de titres de placement`);
    let lignes: LignePropose[];
    let cout: { prix: number; frais: number } | null = null;
    let resultat: number | null = null;
    if (nature === NatureMouvementTitre.ACQUISITION) {
      lignes = pieceAcquisition(prix, frais);
    } else {
      const detenu = quantiteDetenue(vivants.map(enMouvementLu));
      if (Math.round(quantite * 1e6) > Math.round(detenu * 1e6)) {
        throw new BadRequestException(`Le titre ${t.code} compte ${detenu} part(s) · une cession de ${quantite} part(s) en sortirait plus qu'il n'en est détenu.`);
      }
      cout = coutDeLaCession(vivants.map(enMouvementLu), quantite);
      const p = pieceCession(prix, frais, cout);
      lignes = p.lignes;
      resultat = p.resultat;
    }
    const comptes = await this.comptesDesRoles(tenantId, t, lignes, { BANQUE: banque.compteTresorerie.id });
    const libelle = `${LIBELLES_NATURE[nature]} ${quantite} ${t.code} · ${t.intitule}`.slice(0, 190);
    const r = await this.ecritures.creerAvec(
      tenantId,
      userId,
      { exerciceId: exercice.id, journalId: banque.id, date, libelle, reference: reference.slice(0, 190), lignes: this.lignes(lignes, comptes, libelle) },
      async (tx, ecriture) => {
        await this.verrouillerEtRelire(tx, tenantId, t);
        return tx.mouvementTitre.create({
          data: {
            tenantId,
            titreId: t.id,
            nature,
            date: aMinuit(date),
            exerciceId: exercice.id,
            journalId: banque.id,
            quantite: new Prisma.Decimal(quantite),
            prix: new Prisma.Decimal(prix),
            frais: new Prisma.Decimal(frais),
            reference,
            coutPrixSorti: cout ? new Prisma.Decimal(cout.prix) : null,
            coutFraisSorti: cout ? new Prisma.Decimal(cout.frais) : null,
            resultat: resultat === null ? null : new Prisma.Decimal(resultat),
            ecritureId: ecriture.id,
            createdBy: userId,
          },
          select: { id: true },
        });
      },
    );
    return { titreId: t.id, mouvementId: r.suite.id, ecritureId: r.ecriture.id, resultat };
  }

  // ----- Revue de clôture -----------------------------------------------------

  /**
   * LA REVUE DE CLÔTURE · la valeur d'inventaire déclarée avec sa source, à la
   * date de clôture et à elle seule ; la dépréciation nécessaire, la moins-
   * value du titre (jamais compensée par une plus-value, § 3.2), et seul
   * l'ÉCART avec la dépréciation en place se passe (D 6795 / C 590, ou
   * D 590 / C 7795). Écart nul, la revue est gardée sans pièce. DANS L'ORDRE ·
   * une revue ne se passe pas tant qu'un exercice antérieur ENCORE OUVERT qui
   * détenait le titre n'est pas revu (N+1 avant N doterait deux fois la même
   * moins-value), ni après une revue plus récente.
   */
  async evaluer(tenantId: string, userId: string, titreId: string, dto: EvaluationTitreDto) {
    const motif = motifRefusEvaluation({ valeurUnitaire: dto.valeurUnitaire, nature: dto.nature, source: dto.source });
    if (motif) throw new BadRequestException(motif);
    const t = await this.titreLu(tenantId, titreId);
    const nature = dto.nature as NatureValeurTitre;
    if (nature !== natureAttendue(t.cote)) {
      throw new BadRequestException(t.cote ? `Le titre ${t.code} est coté · il s'évalue au cours moyen du dernier mois avant la clôture (AUDCIF Titre VIII ch. 13 § 3.2).` : `Le titre ${t.code} n'est pas coté · il s'évalue à sa valeur probable de négociation (AUDCIF Titre VIII ch. 13 § 3.2).`);
    }
    const exercice = await this.exerciceOuvert(tenantId, String(dto.exerciceId ?? ''));
    const posterieure = t.evaluations.find((e) => !e.annuleLe && e.date.getTime() > exercice.dateFin.getTime());
    if (posterieure) throw new BadRequestException(`Le titre ${t.code} a déjà une revue au ${jour(posterieure.date)} · on revoit dans l'ordre. Annulez-la, revoyez cet exercice, puis refaites-la.`);
    await this.anterieursRevus(tenantId, t, exercice.dateDebut);
    const vivants = t.mouvements.filter((m) => !m.annuleLe && m.date.getTime() <= exercice.dateFin.getTime()).map(enMouvementLu);
    const quantite = quantiteDetenue(vivants);
    const cout = coutDetenu(vivants);
    const enPlace = this.enPlaceAvant(t.evaluations, exercice.dateDebut);
    if (quantite === 0 && enCentimes(enPlace) === 0) throw new BadRequestException(`Le titre ${t.code} n'est pas détenu à la clôture et ne porte aucune dépréciation · il n'y a rien à revoir.`);
    const valeurUnitaire = dto.valeurUnitaire as number;
    const necessaire = depreciationNecessaire(cout, quantite, valeurUnitaire);
    const lignes = pieceEcartDepreciation(necessaire, enPlace);
    const od = await this.journalOd(tenantId, String(dto.journalOdId ?? ''));
    const donnees = {
      tenantId,
      titreId: t.id,
      exerciceId: exercice.id,
      date: exercice.dateFin,
      valeurUnitaire: new Prisma.Decimal(valeurUnitaire),
      nature,
      source: String(dto.source).trim(),
      quantite: new Prisma.Decimal(quantite),
      cout: new Prisma.Decimal(cout),
      depreciationNecessaire: new Prisma.Decimal(necessaire),
      depreciationEnPlace: new Prisma.Decimal(enPlace),
      journalId: od.id,
      createdBy: userId,
    };
    const conflit = (e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return new ConflictException(`Le titre ${t.code} est déjà revu pour cet exercice · relisez la liste.`);
      return e;
    };
    await refuserSiDernierJourClos(this.prisma, tenantId, od.id, exercice.dateFin, 'la revue');
    if (lignes.length === 0) {
      try {
        // SOUS LE VERROU DU DOSSIER, comme la revue à pièce que `creerAvec` passe (relecture du 2026-10-22, B1 ·
        // ligne saisie-serialisable) · la ligne du titre prise, tout se relit après les gestes validés.
        const e = await transactionDeSaisie(this.prisma, tenantId, async (tx) => {
          await this.verrouillerEtRelire(tx, tenantId, t);
          return tx.evaluationTitre.create({ data: donnees, select: { id: true } });
        }, 'Un autre geste est passé sur ce titre pendant la revue · relisez-le avant de recommencer.');
        return { titreId: t.id, evaluationId: e.id, ecritureId: null, depreciationNecessaire: necessaire, depreciationEnPlace: enPlace, ecart: 0 };
      } catch (e) {
        throw conflit(e);
      }
    }
    const comptes = await this.comptesDesRoles(tenantId, t, lignes, {});
    const libelle = `Revue de clôture · ${t.code} · ${t.intitule}`.slice(0, 190);
    try {
      const r = await this.ecritures.creerAvec(
        tenantId,
        userId,
        { exerciceId: exercice.id, journalId: od.id, date: jour(exercice.dateFin), libelle, reference: String(dto.source).trim().slice(0, 190), lignes: this.lignes(lignes, comptes, libelle) },
        async (tx, ecriture) => {
          await this.verrouillerEtRelire(tx, tenantId, t);
          return tx.evaluationTitre.create({ data: { ...donnees, ecritureId: ecriture.id }, select: { id: true } });
        },
      );
      return { titreId: t.id, evaluationId: r.suite.id, ecritureId: r.ecriture.id, depreciationNecessaire: necessaire, depreciationEnPlace: enPlace, ecart: Math.round((necessaire - enPlace) * 100) / 100 };
    } catch (e) {
      throw conflit(e);
    }
  }

  /** Un exercice antérieur encore ouvert, à la clôture duquel le titre était détenu ou déprécié, doit être revu d'abord. */
  private async anterieursRevus(tenantId: string, t: TitreLu, debut: Date) {
    const ouverts = await this.prisma.exercice.findMany({ where: { tenantId, statut: { not: StatutExercice.CLOTURE }, dateFin: { lt: debut } }, orderBy: { dateFin: 'asc' }, select: { id: true, dateDebut: true, dateFin: true } });
    for (const e of ouverts) {
      if (t.evaluations.some((v) => !v.annuleLe && v.exerciceId === e.id)) continue;
      const detenus = quantiteDetenue(t.mouvements.filter((m) => !m.annuleLe && m.date.getTime() <= e.dateFin.getTime()).map(enMouvementLu));
      if (detenus > 0 || enCentimes(this.enPlaceAvant(t.evaluations, e.dateDebut)) !== 0) {
        throw new BadRequestException(`L'exercice clos au ${jour(e.dateFin)} est encore ouvert et le titre ${t.code} y était détenu · revoyez-le d'abord (on revoit dans l'ordre, sans quoi la même moins-value serait dotée deux fois).`);
      }
    }
  }

  // ----- Annulations ----------------------------------------------------------

  /** UN MOUVEMENT S'ANNULE À REBOURS · le dernier vivant du titre seul, et jamais celui qu'une revue a lu. */
  async annulerMouvement(tenantId: string, userId: string, titreId: string, mouvementId: string, dto: AnnulerTitreDto) {
    const motif = this.motif(dto);
    const t = await this.titreLu(tenantId, titreId);
    const vivants = t.mouvements.filter((m) => !m.annuleLe);
    const m = t.mouvements.find((x) => x.id === mouvementId);
    if (!m) throw new NotFoundException('Mouvement introuvable pour ce titre.');
    if (m.annuleLe) throw new ConflictException('Ce mouvement est déjà annulé.');
    if (vivants[vivants.length - 1]?.id !== m.id) throw new BadRequestException(`Les mouvements du titre ${t.code} s'annulent à rebours · annulez d'abord le plus récent (le coût des cessions postérieures repose sur celui-ci).`);
    const revue = this.revueQuiLitLaDate(t, m.date);
    if (revue) throw new BadRequestException(`La revue de clôture du ${jour(revue.date)} a lu ce mouvement · annulez-la d'abord.`);
    if (m.ecriture) await this.pieceAnnulable(tenantId, m.ecriture.id, `du mouvement du ${jour(m.date)}`);
    const ecritureId = m.ecriture?.id ?? null;
    // SOUS LE VERROU DU DOSSIER, comme les gestes que `creerAvec` passe (`transactionDeSaisie`) · un geste passé en
    // même temps attend l'autre puis relit, aucun ne juge sur un instantané antérieur (relecture du 2026-10-22, B1).
    return transactionDeSaisie(this.prisma, tenantId, async (tx) => {
      await this.verrouillerEtRelire(tx, tenantId, t);
      await this.prendre(
        () => tx.mouvementTitre.update({ where: { id: m.id, tenantId, annuleLe: null }, data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: motif }, select: { id: true } }),
        "Ce mouvement n'est plus annulable · relisez le titre.",
      );
      const negatif = ecritureId
        ? await this.retirerOuContrePasser(tx, tenantId, userId, ecritureId, `du mouvement du ${jour(m.date)}`, `Annulation · ${LIBELLES_NATURE[m.nature]} de ${t.code}`, motif, () => tx.mouvementTitre.update({ where: { id: m.id, tenantId }, data: { ecritureId: null } }))
        : null;
      await tx.mouvementTitre.update({ where: { id: m.id, tenantId }, data: { ecritureId: negatif ? ecritureId : null, ecritureNegatifId: negatif } });
      return { titreId: t.id, mouvementId: m.id, traitement: negatif ? 'INSCRITE_EN_NEGATIF' : ecritureId ? 'SUPPRIMEE' : 'SANS_PIECE', ecritureNegatifId: negatif };
    }, "Un autre geste est passé sur ce titre pendant l'annulation · relisez-le avant de recommencer.");
  }

  /** UNE REVUE S'ANNULE À REBOURS · la plus récente vivante du titre seule (la suivante a lu sa dépréciation comme en place). */
  async annulerEvaluation(tenantId: string, userId: string, titreId: string, evaluationId: string, dto: AnnulerTitreDto) {
    const motif = this.motif(dto);
    const t = await this.titreLu(tenantId, titreId);
    const e = t.evaluations.find((x) => x.id === evaluationId);
    if (!e) throw new NotFoundException('Revue introuvable pour ce titre.');
    if (e.annuleLe) throw new ConflictException('Cette revue est déjà annulée.');
    const vivantes = t.evaluations.filter((x) => !x.annuleLe);
    if (vivantes[vivantes.length - 1]?.id !== e.id) throw new BadRequestException(`Les revues du titre ${t.code} s'annulent à rebours · annulez d'abord la plus récente, qui a lu celle-ci comme dépréciation en place.`);
    const exercice = await this.prisma.exercice.findFirst({ where: { id: e.exerciceId, tenantId }, select: { statut: true } });
    if (!exercice || exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException("L'exercice de cette revue est clôturé · elle ne s'annule plus (AUDCIF art. 20, al. 3).");
    if (e.ecriture) await this.pieceAnnulable(tenantId, e.ecriture.id, `de la revue du ${jour(e.date)}`);
    const ecritureId = e.ecriture?.id ?? null;
    // SOUS LE VERROU DU DOSSIER, comme les gestes que `creerAvec` passe (`transactionDeSaisie`) · un geste passé en
    // même temps attend l'autre puis relit, aucun ne juge sur un instantané antérieur (relecture du 2026-10-22, B1).
    return transactionDeSaisie(this.prisma, tenantId, async (tx) => {
      await this.verrouillerEtRelire(tx, tenantId, t);
      await this.prendre(
        () => tx.evaluationTitre.update({ where: { id: e.id, tenantId, annuleLe: null }, data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: motif }, select: { id: true } }),
        "Cette revue n'est plus annulable · relisez le titre.",
      );
      const negatif = ecritureId
        ? await this.retirerOuContrePasser(tx, tenantId, userId, ecritureId, `de la revue du ${jour(e.date)}`, `Annulation · revue de clôture de ${t.code}`, motif, () => tx.evaluationTitre.update({ where: { id: e.id, tenantId }, data: { ecritureId: null } }))
        : null;
      await tx.evaluationTitre.update({ where: { id: e.id, tenantId }, data: { ecritureId: negatif ? ecritureId : null, ecritureNegatifId: negatif } });
      return { titreId: t.id, evaluationId: e.id, traitement: negatif ? 'INSCRITE_EN_NEGATIF' : ecritureId ? 'SUPPRIMEE' : 'SANS_PIECE', ecritureNegatifId: negatif };
    }, "Un autre geste est passé sur ce titre pendant l'annulation · relisez-le avant de recommencer.");
  }

  // ----- Aides ------------------------------------------------------------------

  private motif(dto: AnnulerTitreDto) {
    const m = typeof dto.motif === 'string' ? dto.motif.trim() : '';
    if (m.length < 3 || [...m].length > 500) throw new BadRequestException("Le motif de l'annulation est exigé · de trois à cinq cents caractères (AUDCIF art. 20, al. 2).");
    return m;
  }

  /** La revue vivante dont la date de clôture est au plus tôt la date donnée · elle a lu la position à cette date. */
  private revueQuiLitLaDate(t: TitreLu, date: Date) {
    return t.evaluations.find((e) => !e.annuleLe && e.date.getTime() >= date.getTime()) ?? null;
  }

  private async titreLu(tenantId: string, id: string) {
    const t = await this.prisma.titrePlacement.findFirst({ where: { id, tenantId }, include: INCLURE });
    if (!t) throw new NotFoundException('Titre introuvable pour ce dossier.');
    if (t.mouvements.length > PLAFOND_MOUVEMENTS) throw new ConflictException(`Le titre ${t.code} compte plus de ${PLAFOND_MOUVEMENTS} mouvements · son coût au P.E.P.S. ne se rejoue pas en une lecture. Ouvrez un titre nouveau pour la suite.`);
    return t;
  }

  /**
   * LES COMPTES DE CHAQUE RÔLE · titre et frais sur la fiche (sans compte de
   * frais, les frais vont au compte du titre), les autres pris dans le plan
   * du dossier par leur numéro (590, 6795, 7795, 777, 6771), comptes
   * d'imputation actifs, jamais devinés.
   */
  private async comptesDesRoles(tenantId: string, t: TitreLu, lignes: LignePropose[], fixes: Partial<Record<LignePropose['role'], string>>) {
    const numeros: Partial<Record<LignePropose['role'], string>> = { DEPRECIATION: COMPTE_DEPRECIATION, DOTATION: COMPTE_DOTATION, REPRISE: COMPTE_REPRISE, GAIN: COMPTE_GAIN, PERTE: COMPTE_PERTE };
    const roles = new Set(lignes.map((l) => l.role));
    const comptes: Partial<Record<LignePropose['role'], string>> = { ...fixes, TITRE: t.compteTitre.id, FRAIS: t.compteFrais?.id ?? t.compteTitre.id };
    for (const role of roles) {
      if (comptes[role]) continue;
      const numero = numeros[role];
      if (!numero) throw new ConflictException(`Le rôle ${role} n'a pas de compte · rien n'est passé.`);
      const c = await this.prisma.compte.findFirst({ where: { tenantId, numero }, select: { id: true, typeCompte: true, estActif: true } });
      if (!c || c.typeCompte !== TypeCompteDetailTotal.DETAIL) throw new BadRequestException(`Le compte ${numero} (AUDCIF Titre VIII ch. 13 § 4.2) n'est pas un compte d'imputation de ce dossier · rétablissez-le dans le Plan comptable, puis recommencez.`);
      if (!c.estActif) throw new BadRequestException(`Le compte ${numero} est en sommeil · réactivez-le, puis recommencez.`);
      comptes[role] = c.id;
    }
    return comptes;
  }

  private lignes(proposees: LignePropose[], comptes: Partial<Record<LignePropose['role'], string>>, libelle: string) {
    return proposees.map((p) => {
      const compteId = comptes[p.role];
      if (!compteId) throw new ConflictException(`Le rôle ${p.role} n'a pas de compte sur ce titre · rien n'est passé.`);
      return { compteId, libelle, debit: p.debit, credit: p.credit };
    });
  }

  private async compteLu(tenantId: string, id: string | undefined) {
    if (!id) throw new BadRequestException('Le compte est exigé.');
    const c = await this.prisma.compte.findFirst({ where: { id, tenantId }, select: { id: true, numero: true, typeCompte: true, estActif: true } });
    if (!c) throw new NotFoundException('Compte introuvable pour ce dossier.');
    if (c.typeCompte !== TypeCompteDetailTotal.DETAIL) throw new BadRequestException(`Le compte ${c.numero} est un compte de regroupement · choisissez un compte d'imputation.`);
    if (!c.estActif) throw new BadRequestException(`Le compte ${c.numero} est en sommeil.`);
    return c;
  }

  private async journalOd(tenantId: string, journalId: string) {
    const j = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { id: true, code: true, type: true, estActif: true } });
    if (!j) throw new NotFoundException("Journal d'opérations diverses introuvable pour ce dossier.");
    if (j.type !== TypeJournal.GENERAL) throw new BadRequestException(`Le journal ${j.code} n'est pas un journal d'opérations diverses · la revue de clôture ne touche aucune trésorerie.`);
    if (!j.estActif) throw new BadRequestException(`Le journal ${j.code} est en sommeil.`);
    return j;
  }

  private async exerciceDeLaDate(tenantId: string, date: string, objet: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { tenantId, dateDebut: { lte: aMinuit(date) }, dateFin: { gte: aMinuit(date) } }, select: { id: true, statut: true } });
    if (!exercice) throw new BadRequestException(`Aucun exercice du dossier ne couvre la date ${objet}.`);
    if (exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(`L'exercice de la date ${objet} est clôturé · rien ne s'y passe (AUDCIF art. 20, al. 3).`);
    return exercice;
  }

  private async exerciceOuvert(tenantId: string, id: string) {
    const e = await this.prisma.exercice.findFirst({ where: { id, tenantId }, select: { id: true, statut: true, dateDebut: true, dateFin: true } });
    if (!e) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    if (e.statut === StatutExercice.CLOTURE) throw new BadRequestException("Cet exercice est clôturé · rien ne s'y passe (AUDCIF art. 20, al. 3).");
    return e;
  }

  private async prendre<T>(geste: () => Promise<T>, conflit: string): Promise<T> {
    try {
      return await geste();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new ConflictException(conflit);
      throw e;
    }
  }

  /** La ligne du titre prise `FOR UPDATE`, puis ses mouvements et revues vivants relus · changés depuis la lecture qui a jugé le geste, 409. */
  private async verrouillerEtRelire(tx: Prisma.TransactionClient, tenantId: string, t: TitreLu) {
    await prendreLeVerrouDuDossierBorne(tx, tenantId);
    const pris = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "titres_placement" WHERE id = ${t.id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    if (pris.length !== 1) throw new ConflictException(`Le titre ${t.code} n'existe plus · relisez la liste avant de recommencer.`);
    const [mouvements, evaluations] = await Promise.all([
      tx.mouvementTitre.findMany({ where: { tenantId, titreId: t.id, annuleLe: null }, select: { id: true } }),
      tx.evaluationTitre.findMany({ where: { tenantId, titreId: t.id, annuleLe: null }, select: { id: true } }),
    ]);
    const memes = (lus: string[], relus: string[]) => lus.length === relus.length && [...lus].sort().every((id, i) => id === [...relus].sort()[i]);
    if (
      !memes(t.mouvements.filter((m) => !m.annuleLe).map((m) => m.id), mouvements.map((m) => m.id)) ||
      !memes(t.evaluations.filter((e) => !e.annuleLe).map((e) => e.id), evaluations.map((e) => e.id))
    ) {
      throw new ConflictException('Les mouvements ou les revues de ce titre ont changé pendant le geste (un autre geste vient de passer) · relisez-le avant de recommencer.');
    }
  }

  private async pieceAnnulable(tenantId: string, ecritureId: string, objet: string) {
    const e = await this.prisma.ecriture.findFirst({
      where: { id: ecritureId, tenantId },
      select: { id: true, numeroPiece: true, exercice: { select: { statut: true } }, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
    });
    if (!e) throw new ConflictException(`La pièce ${objet} n'existe plus · relisez avant d'annuler.`);
    if (e.exercice.statut === StatutExercice.CLOTURE) throw new BadRequestException(`La pièce ${objet} appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).`);
    const tenue = motifLignesTenues(e.lignes, `la pièce ${objet} (n° ${e.numeroPiece ?? '·'})`, 'annuler');
    if (tenue) throw new BadRequestException(tenue);
  }

  private async retirerOuContrePasser(tx: Prisma.TransactionClient, tenantId: string, userId: string, ecritureId: string, objet: string, geste: string, motif: string, denouer: () => Promise<unknown>) {
    const e = await tx.ecriture.findFirst({ where: { id: ecritureId, tenantId }, select: { statut: true } });
    if (!e) throw new ConflictException(`La pièce ${objet} n'existe plus · relisez avant d'annuler.`);
    if (e.statut === StatutEcriture.BROUILLARD) {
      const relues = await tx.ligneEcriture.findMany({ where: { ecritureId, ecriture: { tenantId } }, select: { lettre: true, lettrageId: true, rapprochementId: true } });
      const tenue = motifLignesTenues(relues, `la pièce ${objet}`, geste);
      if (tenue) throw new BadRequestException(tenue);
      // L'acte RETIENT sa pièce (RESTRICT) · le lien se dénoue AVANT le retrait, sinon la base refuse la suppression.
      await denouer();
      await retirerLesLignesLibres(tx, tenantId, ecritureId, { statut: StatutEcriture.BROUILLARD }, { laisserNommerLEcriture: true });
      const r = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
      if (r.count !== 1) throw new ConflictException(`La pièce ${objet} a été validée pendant l'annulation · rien n'est retiré. Relancez · validée, elle s'inscrira en négatif.`);
      return null;
    }
    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, `${geste} · ${motif}`, tx);
    return negatif.id;
  }
}

