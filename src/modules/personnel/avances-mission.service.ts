import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutBulletinPaie, StatutEcriture, StatutExercice, TypeCompteDetailTotal, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { retirerLesLignesLibres } from '../comptabilite/lignes-libres';
import { HORS_SITUATION, avecStatut } from '../comptabilite/ecritures-de-situation';
import { estTresorerieEnDevises } from '../virements-fonds/virement-fonds';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';
import { compteDuRole } from './passation-paie';
import { totauxMission } from './missions-salarie';
import {
  LIBELLE_ISSUE,
  issueDeLaRegularisation,
  issueTouchantLaTresorerie,
  lignesDeLaRegularisation,
  motifRefusAvanceMission,
  motifRefusRegularisation,
  motifRefusRepartitionMission,
  partsParSection,
  type LigneRegularisation,
} from './avance-mission';
import { AnnulationAvanceMissionDto, AvanceMissionDto, RegularisationMissionDto, RepartitionMissionDto } from './dto/avance-mission.dto';

const jourUtc = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
const nombre = (d: Prisma.Decimal | number) => Number(d);

/**
 * LIGNE PAIE-DECLARATIONS, POINT 3 · l'avance de mission, sa régularisation,
 * et la répartition des frais par projet. Les règles et leurs textes sont
 * dans `avance-mission.ts` ; ce service lit, rejoue et passe.
 *
 * TOUT SE JUGE AVANT LA PIÈCE, puis la pièce et la fiche naissent dans UNE
 * transaction (`EcritureService.creerAvec`), sous le verrou de la mission
 * (le même ordre que l'émission d'un bulletin et les gestes sur ses frais,
 * `missions.service.ts`) · un arrêt entre deux laisserait une avance versée
 * sans la fiche qui en retient la pièce. Une caisse ne sort que ce qu'elle
 * contient (fiche du compte 57, `jugerLaCaisse`).
 */
@Injectable()
export class AvancesMissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
  ) {}

  /** Le compte d'un rôle de la table de passation, ouvert en imputation dans le dossier. */
  private async compteDuRoleOuvert(tenantId: string, role: 'MISSIONS' | 'AVANCES_AU_PERSONNEL') {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
    if (!t) throw new NotFoundException('Dossier introuvable.');
    const numero = compteDuRole(role, t.referentiel);
    const compte = await this.prisma.compte.findFirst({ where: { tenantId, numero }, select: { id: true, typeCompte: true, intitule: true } });
    if (!compte || compte.typeCompte !== TypeCompteDetailTotal.DETAIL) {
      throw new BadRequestException(`Le compte ${numero} n'est pas ouvert en imputation dans ce dossier · ouvrez-le au plan comptable.`);
    }
    return { id: compte.id, numero };
  }

  /**
   * Le journal de la pièce · de TRÉSORERIE quand de l'argent passe (avance,
   * complément, trop-versé rendu), en francs (la paie et ses frais sont en
   * francs · même règle que le virement de fonds) ; sinon un journal qui n'est
   * ni de trésorerie ni de situation (la pièce n'a pas de ligne de trésorerie,
   * et une simulation n'enregistre rien).
   */
  private async journal(tenantId: string, journalId: string, tresorerie: boolean) {
    const j = await this.prisma.journal.findFirst({
      where: { id: journalId, tenantId },
      select: { id: true, code: true, type: true, estActif: true, compteTresorerie: { select: { id: true, numero: true } }, ribsBanque: { select: { devise: true }, take: 1 } },
    });
    if (!j) throw new NotFoundException('Journal introuvable pour ce dossier.');
    if (!j.estActif) throw new BadRequestException(`Le journal ${j.code} est en sommeil.`);
    if (!tresorerie) {
      if (j.type === TypeJournal.TRESORERIE || j.type === TypeJournal.SITUATION) {
        throw new BadRequestException(
          `Le journal ${j.code} est ${j.type === TypeJournal.SITUATION ? 'de situation' : 'de trésorerie'} · cette régularisation ne fait passer aucun argent, passez-la au journal des opérations diverses.`,
        );
      }
      return { ...j, compteTresorerie: null };
    }
    if (j.type !== TypeJournal.TRESORERIE || !j.compteTresorerie) {
      throw new BadRequestException(`Le journal ${j.code} n'est pas un journal de banque ou de caisse qui porte son compte · de l'argent passe (fiche du compte 42).`);
    }
    const [dossier, ligneEnDevise] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true } }),
      this.prisma.ligneEcriture.findFirst({ where: { compteId: j.compteTresorerie.id, deviseId: { not: null }, ecriture: { tenantId, ...HORS_SITUATION } }, select: { id: true } }),
    ]);
    const devise = (j.ribsBanque[0]?.devise ?? '').trim().toUpperCase();
    if ((devise !== '' && devise !== MONNAIE_DE_TENUE) || estTresorerieEnDevises(j.compteTresorerie.numero, dossier.referentiel) || ligneEnDevise) {
      throw new BadRequestException(
        `Le compte ${j.compteTresorerie.numero} du journal ${j.code} est tenu en devise · l'avance de mission se passe en ${MONNAIE_DE_TENUE}. Passez-la à la main avec le montant en devise et le cours.`,
      );
    }
    return { ...j, compteTresorerie: j.compteTresorerie };
  }

  private async mission(tenantId: string, missionId: string) {
    const m = await this.prisma.missionSalarie.findFirst({
      where: { id: missionId, tenantId },
      include: {
        salarie: { select: { nom: true, postNom: true, prenoms: true } },
        frais: { select: { element: true, qualification: true, montantFc: true } },
        bulletin: { select: { statut: true, numero: true } },
        avances: { where: { annuleLe: null }, include: { regularisations: { where: { annuleLe: null } } }, take: 1 },
        repartitions: { include: { section: { select: { code: true, type: true, estActive: true } }, plan: { select: { code: true, estActif: true } } }, take: 200 },
      },
    });
    if (!m) throw new NotFoundException('Mission introuvable dans ce dossier.');
    return m;
  }

  // ── L'AVANCE ──────────────────────────────────────────────────────────

  async verser(tenantId: string, userId: string, email: string, missionId: string, dto: AvanceMissionDto) {
    const m = await this.mission(tenantId, missionId);
    const refus = motifRefusAvanceMission({
      mission: {
        numero: m.numero,
        dateDepart: m.dateDepart,
        dateRetour: m.dateRetour,
        annuleLe: m.annuleLe,
        porteeParBulletin: m.bulletin && m.bulletin.statut === StatutBulletinPaie.EMIS ? m.bulletin.numero : null,
      },
      montantFc: dto.montantFc,
      date: dto.date.slice(0, 10),
      pieceJustificative: dto.pieceJustificative,
      avanceExistante: m.avances.length > 0,
    });
    if (refus) throw new BadRequestException(refus);
    const [journal, compte4211] = await Promise.all([this.journal(tenantId, dto.journalId, true), this.compteDuRoleOuvert(tenantId, 'AVANCES_AU_PERSONNEL')]);
    const nom = [m.salarie.nom, m.salarie.postNom, m.salarie.prenoms].filter(Boolean).join(' ');
    const libelle = `Avance sur mission n° ${m.numero} · ${nom}`.slice(0, 190);
    const montant = Math.round(dto.montantFc * 100) / 100;
    // Une caisse ne paie que ce qu'elle contient · refus tôt, rejugé dans la transaction.
    await this.ecritures.verifierCaisseProvisionnee(tenantId, dto.exerciceId, [
      { date: dto.date, lignes: [{ compteId: journal.compteTresorerie!.id, debit: 0, credit: montant }] },
    ]);
    const r = await this.ecritures.creerAvec(
      tenantId,
      userId,
      {
        exerciceId: dto.exerciceId,
        journalId: journal.id,
        date: dto.date,
        libelle,
        reference: dto.pieceJustificative.trim().slice(0, 190),
        lignes: [
          { compteId: compte4211.id, libelle, debit: montant, credit: 0 },
          { compteId: journal.compteTresorerie!.id, libelle, debit: 0, credit: montant },
        ],
      },
      async (tx, ecriture) => {
        // Sous le verrou de la mission, l'état relu · une avance versée entre-temps, ou un bulletin émis, refuse.
        await prendreLeVerrouDuDossierBorne(tx, tenantId);
        await tx.$queryRaw`SELECT id FROM "missions_salarie" WHERE id = ${m.id} AND "tenantId" = ${tenantId} FOR UPDATE`;
        const relue = await tx.missionSalarie.findFirst({
          where: { id: m.id, tenantId },
          select: { annuleLe: true, bulletin: { select: { statut: true, numero: true } }, _count: { select: { avances: { where: { annuleLe: null } } } } },
        });
        if (!relue || relue.annuleLe || relue._count.avances > 0 || (relue.bulletin && relue.bulletin.statut === StatutBulletinPaie.EMIS)) {
          throw new ConflictException(`La mission n° ${m.numero} a changé pendant le versement (avance, bulletin ou annulation) · rien n'est passé, relisez-la.`);
        }
        const e = await tx.ecriture.findFirst({ where: avecStatut({ id: ecriture.id, tenantId }), select: { numeroPiece: true } });
        return tx.avanceMission.create({
          data: {
            tenantId,
            missionId: m.id,
            exerciceId: dto.exerciceId,
            journalId: journal.id,
            date: jourUtc(dto.date),
            montantFc: new Prisma.Decimal(montant),
            pieceJustificative: dto.pieceJustificative.trim(),
            ecritureId: ecriture.id,
            piecePassee: `${journal.code} n° ${e?.numeroPiece ?? '·'}`.slice(0, 60),
            creePar: email,
          },
          select: { id: true, piecePassee: true },
        });
      },
      { jugerLaCaisse: true },
    );
    return { ...r.suite, montantFc: montant };
  }

  /**
   * ANNULER L'AVANCE (AUDCIF art. 20, al. 2) · sa pièce au brouillard
   * retirée, validée inscrite en négatif ; la fiche est MARQUÉE, jamais
   * supprimée. Refus · régularisation non annulée (on annule à partir du plus
   * récent), mission portée par un bulletin émis (ses frais justifiés n'y sont
   * pas, l'avance annulée les laisserait sans remboursement), exercice
   * clôturé, ligne lettrée ou pointée.
   */
  async annulerAvance(tenantId: string, userId: string, avanceId: string, dto: AnnulationAvanceMissionDto) {
    const a = await this.prisma.avanceMission.findFirst({
      where: { id: avanceId, tenantId },
      include: {
        exercice: { select: { statut: true } },
        mission: { select: { id: true, numero: true, bulletin: { select: { statut: true, numero: true } } } },
        regularisations: { where: { annuleLe: null }, select: { id: true }, take: 1 },
      },
    });
    if (!a) throw new NotFoundException('Avance introuvable dans ce dossier.');
    if (a.annuleLe) throw new ConflictException('Cette avance est déjà annulée.');
    if (a.regularisations.length > 0) throw new ConflictException("Cette avance est régularisée · annulez d'abord la régularisation.");
    if (a.mission.bulletin && a.mission.bulletin.statut === StatutBulletinPaie.EMIS) {
      throw new ConflictException(
        `La mission n° ${a.mission.numero} est portée par le bulletin émis n° ${a.mission.bulletin.numero}, qui n'a pas remboursé ses frais justifiés (l'avance les impute) · annulez le bulletin d'abord, il les reprendra à l'émission suivante.`,
      );
    }
    if (a.exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException("Cette avance appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).");
    }
    await this.refuserSiTenue(tenantId, a.ecritureId, "annuler l'avance");
    const motif = dto.motif.trim();
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerMission(tx, tenantId, a.mission.id);
      const relue = await tx.avanceMission.findFirst({ where: { id: a.id, tenantId }, select: { annuleLe: true, _count: { select: { regularisations: { where: { annuleLe: null } } } } } });
      if (!relue || relue.annuleLe || relue._count.regularisations > 0) throw new ConflictException("L'avance a changé pendant l'annulation · relisez-la.");
      const negatifId = await this.retirerOuNegatif(tx, tenantId, userId, a.ecritureId, `Annulation de l'avance sur mission n° ${a.mission.numero} · ${motif}`, (data) =>
        tx.avanceMission.update({ where: { id: a.id }, data }),
      );
      return tx.avanceMission.update({
        where: { id: a.id },
        data: { annuleLe: new Date(), annulePar: userId, motifAnnulation: motif, ecritureId: negatifId ? a.ecritureId : null, ecritureNegatifId: negatifId },
        select: { id: true, annuleLe: true, ecritureNegatifId: true },
      });
    });
  }

  // ── LA RÉGULARISATION ─────────────────────────────────────────────────

  /** Ce que la régularisation passerait · les montants rejoués par le serveur, rien n'est écrit. */
  async proposition(tenantId: string, avanceId: string) {
    const a = await this.prisma.avanceMission.findFirst({ where: { id: avanceId, tenantId }, select: { missionId: true, montantFc: true, annuleLe: true } });
    if (!a || a.annuleLe) throw new NotFoundException('Avance introuvable ou annulée dans ce dossier.');
    const m = await this.mission(tenantId, a.missionId);
    const justifie = totauxMission(m.frais.map((f) => ({ element: f.element, qualification: f.qualification, montantFc: nombre(f.montantFc) }))).justifieFc;
    const avance = nombre(a.montantFc);
    const issue = issueDeLaRegularisation(justifie, avance, null);
    return {
      justifieFc: justifie,
      avanceFc: avance,
      issue: 'refus' in issue ? null : issue.issue,
      ecartFc: 'refus' in issue ? Math.round((avance - justifie) * 100) / 100 : issue.ecartFc,
      tropVerseAChoisir: 'refus' in issue,
    };
  }

  async regulariser(tenantId: string, userId: string, email: string, avanceId: string, dto: RegularisationMissionDto) {
    const a = await this.prisma.avanceMission.findFirst({
      where: { id: avanceId, tenantId },
      select: { id: true, missionId: true, montantFc: true, date: true, annuleLe: true, _count: { select: { regularisations: { where: { annuleLe: null } } } } },
    });
    if (!a || a.annuleLe) throw new NotFoundException('Avance introuvable ou annulée dans ce dossier.');
    const m = await this.mission(tenantId, a.missionId);
    const refus = motifRefusRegularisation({
      mission: { numero: m.numero, accomplieLe: m.accomplieLe, annuleLe: m.annuleLe },
      date: dto.date.slice(0, 10),
      pieceJustificative: dto.pieceJustificative,
      regularisationExistante: a._count.regularisations > 0,
      dateAvance: a.date,
    });
    if (refus) throw new BadRequestException(refus);
    const fraisLus = m.frais.map((f) => ({ element: f.element, qualification: f.qualification, montantFc: nombre(f.montantFc) }));
    const justifie = totauxMission(fraisLus).justifieFc;
    const avance = nombre(a.montantFc);
    const issue = issueDeLaRegularisation(justifie, avance, dto.tropVerse ?? null);
    if ('refus' in issue) throw new BadRequestException(issue.refus);
    if (dto.tropVerse && issue.issue !== 'TROP_VERSE_RENDU' && issue.issue !== 'TROP_VERSE_RETENU') {
      throw new BadRequestException(`Les frais justifiés (${justifie.toFixed(2)} FC) épuisent l'avance · il n'y a pas de trop-versé à rendre ni à retenir.`);
    }
    const lignes = lignesDeLaRegularisation(justifie, avance, issue.issue);
    const tresorerie = issueTouchantLaTresorerie(issue.issue);
    const [journal, c6384, c4211, ventilations] = await Promise.all([
      this.journal(tenantId, dto.journalId, tresorerie),
      this.compteDuRoleOuvert(tenantId, 'MISSIONS'),
      this.compteDuRoleOuvert(tenantId, 'AVANCES_AU_PERSONNEL'),
      this.ventilationsDuMontant(m, justifie),
    ]);
    const nom = [m.salarie.nom, m.salarie.postNom, m.salarie.prenoms].filter(Boolean).join(' ');
    const libelle = `Régularisation de l'avance sur mission n° ${m.numero} · ${nom}`.slice(0, 190);
    const compteDe = (l: LigneRegularisation) => (l.role === 'MISSIONS' ? c6384.id : l.role === 'AVANCES_AU_PERSONNEL' ? c4211.id : journal.compteTresorerie!.id);
    const lignesEcriture = lignes.map((l) => ({
      compteId: compteDe(l),
      libelle,
      debit: l.debit,
      credit: l.credit,
      ...(l.role === 'MISSIONS' && ventilations.length > 0 ? { ventilations: ventilations.map((v) => ({ sectionId: v.sectionId, debit: v.montantFc, credit: 0 })) } : {}),
    }));
    const ligneTresorerie = lignes.find((l) => l.role === 'TRESORERIE');
    if (ligneTresorerie && ligneTresorerie.credit > 0) {
      await this.ecritures.verifierCaisseProvisionnee(tenantId, dto.exerciceId, [
        { date: dto.date, lignes: [{ compteId: journal.compteTresorerie!.id, debit: 0, credit: ligneTresorerie.credit }] },
      ]);
    }

    const creerFiche = async (tx: Prisma.TransactionClient, ecriture: { id: string } | null) => {
      await this.verrouillerMission(tx, tenantId, m.id);
      // Relue sous le verrou · un frais changé, une seconde régularisation ou une avance annulée entre-temps refuse.
      const relue = await tx.avanceMission.findFirst({
        where: { id: a.id, tenantId },
        select: { annuleLe: true, _count: { select: { regularisations: { where: { annuleLe: null } } } }, mission: { select: { frais: { select: { element: true, qualification: true, montantFc: true } } } } },
      });
      const justifieRelu = relue ? totauxMission(relue.mission.frais.map((f) => ({ element: f.element, qualification: f.qualification, montantFc: nombre(f.montantFc) }))).justifieFc : null;
      if (!relue || relue.annuleLe || relue._count.regularisations > 0 || justifieRelu === null || Math.round(justifieRelu * 100) !== Math.round(justifie * 100)) {
        throw new ConflictException(`La mission n° ${m.numero} a changé pendant la régularisation (frais, avance ou régularisation) · rien n'est passé, relisez-la.`);
      }
      const piece = ecriture ? await tx.ecriture.findFirst({ where: avecStatut({ id: ecriture.id, tenantId }), select: { numeroPiece: true } }) : null;
      // Le trop-versé retenu sur la paie · une avance du registre (art. 112, c), au 4211.
      const avanceSalaire =
        issue.issue === 'TROP_VERSE_RETENU'
          ? await tx.avanceSalaire.create({
              data: {
                tenantId,
                salarieId: m.salarieId,
                type: 'AVANCE',
                dateOctroi: jourUtc(dto.date),
                montantFc: new Prisma.Decimal(issue.ecartFc),
                objet: `Trop-versé de l'avance sur mission n° ${m.numero}`.slice(0, 200),
                pieceJustificative: dto.pieceJustificative.trim(),
                creePar: email,
              },
              select: { id: true },
            })
          : null;
      return tx.regularisationMission.create({
        data: {
          tenantId,
          avanceId: a.id,
          exerciceId: dto.exerciceId,
          journalId: journal.id,
          date: jourUtc(dto.date),
          justifieFc: new Prisma.Decimal(justifie),
          avanceFc: new Prisma.Decimal(avance),
          ecartFc: new Prisma.Decimal(issue.ecartFc),
          issue: issue.issue,
          pieceJustificative: dto.pieceJustificative.trim(),
          ecritureId: ecriture?.id ?? null,
          piecePassee: ecriture ? `${journal.code} n° ${piece?.numeroPiece ?? '·'}`.slice(0, 60) : null,
          avanceSalaireId: avanceSalaire?.id ?? null,
          creePar: email,
        },
        select: { id: true, issue: true, piecePassee: true, avanceSalaireId: true },
      });
    };

    const fiche =
      lignesEcriture.length === 0
        ? await transactionJournalisee(this.prisma, (tx) => creerFiche(tx, null))
        : (
            await this.ecritures.creerAvec(
              tenantId,
              userId,
              { exerciceId: dto.exerciceId, journalId: journal.id, date: dto.date, libelle, reference: dto.pieceJustificative.trim().slice(0, 190), lignes: lignesEcriture },
              (tx, ecriture) => creerFiche(tx, ecriture),
              { jugerLaCaisse: true },
            )
          ).suite;
    return { ...fiche, libelleIssue: LIBELLE_ISSUE[fiche.issue], justifieFc: justifie, avanceFc: avance, ecartFc: issue.ecartFc, ventilee: ventilations.length > 0 };
  }

  /**
   * ANNULER LA RÉGULARISATION (AUDCIF art. 20, al. 2) · pièce retirée au
   * brouillard, validée inscrite en négatif ; l'avance du registre née d'un
   * trop-versé retenu est retirée avec elle, et refusée si un bulletin l'a
   * déjà retenue (annuler les bulletins d'abord, `supprimerAvance`).
   */
  async annulerRegularisation(tenantId: string, userId: string, regularisationId: string, dto: AnnulationAvanceMissionDto) {
    const r = await this.prisma.regularisationMission.findFirst({
      where: { id: regularisationId, tenantId },
      include: {
        exercice: { select: { statut: true } },
        avance: { select: { missionId: true, mission: { select: { numero: true } } } },
        avanceSalaire: { select: { id: true, _count: { select: { retenues: true } } } },
      },
    });
    if (!r) throw new NotFoundException('Régularisation introuvable dans ce dossier.');
    if (r.annuleLe) throw new ConflictException('Cette régularisation est déjà annulée.');
    if (r.exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException("Cette régularisation appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).");
    }
    if (r.avanceSalaire && r.avanceSalaire._count.retenues > 0) {
      throw new ConflictException(
        `Le trop-versé de la mission n° ${r.avance.mission.numero} a déjà été retenu par ${r.avanceSalaire._count.retenues} bulletin(s) · annulez ces bulletins avant la régularisation.`,
      );
    }
    await this.refuserSiTenue(tenantId, r.ecritureId, 'annuler la régularisation');
    const motif = dto.motif.trim();
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerMission(tx, tenantId, r.avance.missionId);
      const relue = await tx.regularisationMission.findFirst({ where: { id: r.id, tenantId }, select: { annuleLe: true } });
      if (!relue || relue.annuleLe) throw new ConflictException('La régularisation a changé pendant l’annulation · relisez-la.');
      const negatifId = await this.retirerOuNegatif(tx, tenantId, userId, r.ecritureId, `Annulation de la régularisation de la mission n° ${r.avance.mission.numero} · ${motif}`, (data) =>
        tx.regularisationMission.update({ where: { id: r.id }, data }),
      );
      if (r.avanceSalaire) {
        // Relue sous le verrou · une retenue posée entre-temps refuse.
        const retenues = await tx.retenueAvanceBulletin.count({ where: { tenantId, avanceId: r.avanceSalaire.id } });
        if (retenues > 0) throw new ConflictException("Un bulletin a retenu le trop-versé pendant l'annulation · rien n'est annulé.");
      }
      const fiche = await tx.regularisationMission.update({
        where: { id: r.id },
        data: {
          annuleLe: new Date(),
          annulePar: userId,
          motifAnnulation: motif,
          ecritureId: negatifId ? r.ecritureId : null,
          ecritureNegatifId: negatifId,
          avanceSalaireId: null,
        },
        select: { id: true, annuleLe: true, ecritureNegatifId: true },
      });
      if (r.avanceSalaire) await tx.avanceSalaire.deleteMany({ where: { id: r.avanceSalaire.id, tenantId } });
      return fiche;
    });
  }

  // ── LA RÉPARTITION PAR PROJET ─────────────────────────────────────────

  /**
   * POSER LA RÉPARTITION D'UN PLAN · elle remplace celle du plan (une liste
   * vide la retire). Refusée quand l'avance est régularisée · la pièce passée
   * porte déjà sa ventilation, une répartition changée après ne la suivrait pas.
   */
  async poserRepartition(tenantId: string, missionId: string, planId: string, dto: RepartitionMissionDto) {
    const [plan, sections] = await Promise.all([
      this.prisma.planAnalytique.findFirst({ where: { id: planId, tenantId }, select: { id: true, code: true, classesVentilees: true, estActif: true } }),
      this.prisma.sectionAnalytique.findMany({
        where: { tenantId, planId, id: { in: dto.lignes.map((l) => l.sectionId) } },
        select: { id: true, planId: true, code: true, type: true, estActive: true },
        take: dto.lignes.length,
      }),
    ]);
    const refus = motifRefusRepartitionMission({
      plan,
      sections: sections.map((s) => ({ id: s.id, planId: s.planId, code: s.code, estTotal: s.type === TypeCompteDetailTotal.TOTAL, estActive: s.estActive })),
      lignes: dto.lignes,
    });
    if (refus) throw new BadRequestException(refus);
    await transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerMission(tx, tenantId, missionId);
      const m = await tx.missionSalarie.findFirst({
        where: { id: missionId, tenantId },
        select: { id: true, numero: true, annuleLe: true, avances: { where: { annuleLe: null }, select: { _count: { select: { regularisations: { where: { annuleLe: null } } } } }, take: 1 } },
      });
      if (!m) throw new NotFoundException('Mission introuvable dans ce dossier.');
      if (m.annuleLe) throw new ConflictException(`La mission n° ${m.numero} est annulée.`);
      if (m.avances.some((a) => a._count.regularisations > 0)) {
        throw new ConflictException(`L'avance de la mission n° ${m.numero} est régularisée · sa pièce porte déjà la ventilation. Annulez la régularisation pour la changer.`);
      }
      await tx.repartitionMission.deleteMany({ where: { tenantId, missionId: m.id, planId } });
      if (dto.lignes.length > 0) {
        await tx.repartitionMission.createMany({
          data: dto.lignes.map((l) => ({ tenantId, missionId: m.id, planId, sectionId: l.sectionId, pourcentage: new Prisma.Decimal(l.pourcentage) })),
        });
      }
    });
    return this.lireRepartitions(tenantId, missionId);
  }

  async lireRepartitions(tenantId: string, missionId: string) {
    const lignes = await this.prisma.repartitionMission.findMany({
      where: { tenantId, missionId },
      orderBy: [{ planId: 'asc' }, { sectionId: 'asc' }],
      take: 200,
      include: { plan: { select: { code: true } }, section: { select: { code: true, intitule: true } } },
    });
    return lignes.map((l) => ({ planId: l.planId, planCode: l.plan.code, sectionId: l.sectionId, sectionCode: l.section.code, intitule: l.section.intitule, pourcentage: nombre(l.pourcentage) }));
  }

  /**
   * La ventilation du 6384, plan par plan · une répartition dont une section
   * est passée en sommeil, ou un plan en sommeil, REFUSE (jamais une part
   * reportée en silence sur les autres sections) ; aucune répartition, rien.
   */
  private async ventilationsDuMontant(m: Awaited<ReturnType<AvancesMissionService['mission']>>, montantFc: number) {
    if (!(montantFc > 0) || m.repartitions.length === 0) return [];
    const parPlan = new Map<string, typeof m.repartitions>();
    for (const r of m.repartitions) parPlan.set(r.planId, [...(parPlan.get(r.planId) ?? []), r]);
    const rendues: { sectionId: string; montantFc: number }[] = [];
    for (const lignes of parPlan.values()) {
      const plan = lignes[0].plan;
      if (!plan.estActif) throw new BadRequestException(`Le plan ${plan.code} de la répartition de la mission est en sommeil · retirez sa répartition ou réactivez-le.`);
      const horsUsage = lignes.find((l) => !l.section.estActive || l.section.type !== TypeCompteDetailTotal.DETAIL);
      if (horsUsage) {
        throw new BadRequestException(`La section ${horsUsage.section.code} de la répartition de la mission n'est plus une section Détail active · corrigez la répartition du plan ${plan.code}.`);
      }
      rendues.push(...partsParSection(montantFc, lignes.map((l) => ({ sectionId: l.sectionId, code: l.section.code, pourcentage: nombre(l.pourcentage) }))));
    }
    return rendues.filter((v) => v.montantFc > 0);
  }

  // ── OUTILS ────────────────────────────────────────────────────────────

  private async verrouillerMission(tx: Prisma.TransactionClient, tenantId: string, missionId: string) {
    await prendreLeVerrouDuDossierBorne(tx, tenantId);
    await tx.$queryRaw`SELECT id FROM "missions_salarie" WHERE id = ${missionId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  }

  /** Une ligne lettrée ou pointée affirme un rapprochement · le geste se refuse avant la transaction. */
  private async refuserSiTenue(tenantId: string, ecritureId: string | null, geste: string) {
    if (!ecritureId) return;
    const e = await this.prisma.ecriture.findFirst({
      where: avecStatut({ id: ecritureId, tenantId }),
      select: { numeroPiece: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
    });
    if (!e) return;
    const tenue = motifLignesTenues(e.lignes, `la pièce n° ${e.numeroPiece ?? '·'}`, geste);
    if (tenue) throw new BadRequestException(tenue);
  }

  /**
   * La pièce au brouillard est retirée (le lien dénoué d'abord · la fiche la
   * retient), validée elle s'inscrit en négatif · le statut est RELU dans la
   * transaction, et une pièce validée entre-temps fait relancer le geste.
   * Rend l'identifiant du négatif, ou null.
   */
  private async retirerOuNegatif(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    ecritureId: string | null,
    motif: string,
    delier: (data: { ecritureId: null }) => Promise<unknown>,
  ): Promise<string | null> {
    if (!ecritureId) return null;
    const e = await tx.ecriture.findFirst({ where: avecStatut({ id: ecritureId, tenantId }), select: { statut: true } });
    if (!e) throw new ConflictException("La pièce n'existe plus · relisez la fiche avant de l'annuler.");
    if (e.statut === StatutEcriture.BROUILLARD) {
      await delier({ ecritureId: null });
      await retirerLesLignesLibres(tx, tenantId, ecritureId, { statut: StatutEcriture.BROUILLARD }, { laisserNommerLEcriture: true });
      const sup = await tx.ecriture.deleteMany({ where: { id: ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
      if (sup.count !== 1) {
        throw new ConflictException("La pièce a été validée pendant l'annulation · rien n'est retiré. Relancez l'annulation · validée, elle s'inscrira en négatif.");
      }
      return null;
    }
    const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, ecritureId, motif, tx);
    return negatif.id;
  }
}
