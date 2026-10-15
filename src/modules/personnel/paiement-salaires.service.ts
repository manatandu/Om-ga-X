import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModePaiementSalaire, Prisma, StatutEcriture, StatutExercice, StatutOrdreVirement, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { avecStatut } from '../comptabilite/ecritures-de-situation';
import { OrdresVirementService, type LigneAOrdonner } from '../reglements/ordres-virement.service';
import { coordonneesImprimees } from '../tiers/ribs-tiers';
import { compteDuRole } from './passation-paie';
import { filtreOuverturePasseeAuPremierJour } from '../exercice/ouverture-passee';
import {
  MODES_PAIEMENT,
  billetageDuPaiement,
  echeanceArticle99,
  motifRefusCoupures,
  motifRefusJournalDuPaiement,
  motifRefusReferencesCheques,
  resteAPayer,
  type BilletageDuPaiement,
} from './paiement-salaires';
import { AnnulationPaiementSalairesDto, PaiementSalairesDto } from './dto/paiement-salaires.dto';

/** Au plus autant de bulletins lus pour un mois · au-delà, la proposition le dit. */
export const PLAFOND_BULLETINS_DU_MOIS = 2_000;
/** Au plus autant de paiements d'un mois montrés · les plus récents d'abord. */
export const PLAFOND_PAIEMENTS_DU_MOIS = 200;

const nombre = (d: Prisma.Decimal | number) => Number(d);
const centimes = (n: number) => Math.round(n * 100);
const estUnMois = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/** Le doublon d'une clé unique, même enveloppé par la transaction. */
function estDoublon(e: unknown): boolean {
  for (let x: unknown = e, n = 0; x && n < 5; x = (x as { cause?: unknown }).cause, n++) {
    if (x instanceof Prisma.PrismaClientKnownRequestError && x.code === 'P2002') return true;
  }
  return false;
}

/**
 * LIGNE SAGE-L5, FONCTION 75 · PAYER LES SALAIRES DU MOIS depuis les
 * bulletins émis. Les règles sont dans `paiement-salaires.ts` ; ce service
 * lit, rejoue et passe.
 *
 * UNE ÉCRITURE PAR PAIEMENT, AGRÉGÉE · D 422 / C trésorerie du total, sans le
 * nom ni le net de chacun · le journal se lit par tout le dossier,
 * l'aide-comptable compris, à qui le personnel est fermé
 * (roles-cantonnes.ts). Le détail par salarié est sur la fiche du paiement et
 * sur l'ordre de virement, que l'aide-comptable ne lit pas.
 */
@Injectable()
export class PaiementSalairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
    private readonly ordres: OrdresVirementService,
  ) {}

  /**
   * Les lignes NON ANNULÉES des paiements du mois · ce qui a déjà été versé,
   * par bulletin et par salarié. MINEUR 6 DE LA RELECTURE · la somme se
   * demande à la base, groupée par bulletin (§ 8 bis) · la lecture bornée à
   * 8 000 lignes, sans le dire, aurait laissé un versement hors du compte et
   * proposé de payer deux fois.
   */
  private async dejaPayes(tenantId: string, mois: string) {
    const groupes = await this.prisma.lignePaiementSalaire.groupBy({
      by: ['bulletinId', 'salarieId'],
      where: { tenantId, annuleLe: null, paiement: { moisDePaie: mois } },
      _sum: { montant: true },
    });
    const parBulletin = new Map<string, number>();
    const parSalarie = new Map<string, { bulletinId: string; montant: number }[]>();
    for (const g of groupes) {
      const montant = nombre(g._sum.montant ?? 0);
      parBulletin.set(g.bulletinId, (parBulletin.get(g.bulletinId) ?? 0) + montant);
      parSalarie.set(g.salarieId, [...(parSalarie.get(g.salarieId) ?? []), { bulletinId: g.bulletinId, montant }]);
    }
    /** Ce qu'un AUTRE bulletin du même salarié et du même mois a déjà versé (bulletin annulé et réémis). */
    const autres = (salarieId: string, bulletinId: string) =>
      (parSalarie.get(salarieId) ?? []).filter((x) => x.bulletinId !== bulletinId).reduce((n, x) => n + centimes(x.montant), 0) / 100;
    return { parBulletin, autres };
  }

  /**
   * LA PROPOSITION DU MOIS · les bulletins émis non encore payés, ce qui
   * reste à payer sur chacun, le mode convenu et le RIB principal de chaque
   * salarié, les journaux qui peuvent payer, les paiements déjà passés, et le
   * billetage des espèces sur les coupures données (sinon celles du dernier
   * paiement en espèces du dossier, sinon aucun).
   */
  async proposition(tenantId: string, mois: string, coupuresDemandees?: number[]) {
    if (!estUnMois(mois)) throw new BadRequestException('Le mois de paie se lit AAAA-MM.');
    if (coupuresDemandees && coupuresDemandees.length) {
      const refus = motifRefusCoupures(coupuresDemandees);
      if (refus) throw new BadRequestException(refus);
    }
    const [bulletins, deja, paiements, journaux, dernierEnEspeces] = await Promise.all([
      this.prisma.bulletinPaie.findMany({
        where: { tenantId, moisDePaie: mois },
        orderBy: { numero: 'asc' },
        take: PLAFOND_BULLETINS_DU_MOIS + 1,
        select: {
          id: true,
          numero: true,
          nature: true,
          statut: true,
          salarieId: true,
          nomComplet: true,
          netAPayerFc: true,
          ecritureId: true,
          remisLe: true,
          salarie: { select: { modePaiement: true, ribs: { where: { tenantId, estPrincipal: true }, take: 1 } } },
        },
      }),
      this.dejaPayes(tenantId, mois),
      this.prisma.paiementSalaires.findMany({
        where: { tenantId, moisDePaie: mois },
        orderBy: { createdAt: 'desc' },
        take: PLAFOND_PAIEMENTS_DU_MOIS,
        include: {
          journal: { select: { code: true } },
          ordreVirement: { select: { numero: true, statut: true } },
          ecriture: { select: { statut: true, numeroPiece: true } },
          lignes: { select: { bulletinId: true, nomComplet: true, montant: true, reference: true }, orderBy: { nomComplet: 'asc' } },
        },
      }),
      this.prisma.journal.findMany({
        where: { tenantId, type: 'TRESORERIE', estActif: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, intitule: true, compteTresorerie: { select: { numero: true } }, ribsBanque: { select: { devise: true }, take: 1 } },
      }),
      this.prisma.paiementSalaires.findFirst({
        where: { tenantId, mode: ModePaiementSalaire.ESPECES, billetage: { not: Prisma.DbNull } },
        orderBy: { createdAt: 'desc' },
        select: { billetage: true },
      }),
    ]);
    const tronque = bulletins.length > PLAFOND_BULLETINS_DU_MOIS;
    const lus = bulletins.slice(0, PLAFOND_BULLETINS_DU_MOIS);

    const aPayer = [];
    const tropPayes = [];
    for (const b of lus) {
      if (b.statut !== 'EMIS' || nombre(b.netAPayerFc) <= 0 || deja.parBulletin.has(b.id)) continue;
      const dejaPayeAutres = deja.autres(b.salarieId, b.id);
      const r = resteAPayer({ id: b.id, salarieId: b.salarieId, netAPayer: nombre(b.netAPayerFc), dejaPayeAutres });
      if (r.tropPaye > 0) {
        tropPayes.push({ bulletinId: b.id, numero: b.numero, salarieId: b.salarieId, nomComplet: b.nomComplet, netAPayer: nombre(b.netAPayerFc), dejaPaye: dejaPayeAutres, excedent: r.tropPaye });
        continue;
      }
      if (r.montant <= 0) continue;
      const rib = b.salarie.ribs[0] ?? null;
      aPayer.push({
        bulletinId: b.id,
        numero: b.numero,
        nature: b.nature,
        salarieId: b.salarieId,
        nomComplet: b.nomComplet,
        netAPayer: nombre(b.netAPayerFc),
        dejaPayeAutres,
        montant: r.montant,
        mode: b.salarie.modePaiement,
        rib: rib ? `${rib.banque} · ${coordonneesImprimees(rib)}` : null,
        passeAuJournal: b.ecritureId !== null,
        remisLe: b.remisLe,
      });
    }

    // M5 DE LA RELECTURE · UN BULLETIN PAYÉ PUIS ANNULÉ, SANS BULLETIN ÉMIS DU
    // MÊME SALARIÉ CE MOIS · son versement reste au journal (D 422 / C
    // trésorerie) et rien ne le nommait. Réémis, le bulletin suivant
    // l'absorbe (`dejaPayeAutres`) ; sans lui, il est dit ici, avec sa pièce.
    const emisParSalarie = new Set(lus.filter((b) => b.statut === 'EMIS').map((b) => b.salarieId));
    const annulesPayes = lus.filter((b) => b.statut !== 'EMIS' && deja.parBulletin.has(b.id) && !emisParSalarie.has(b.salarieId));
    const versementsSansBulletin = annulesPayes.length
      ? await this.versementsDesBulletins(
          tenantId,
          annulesPayes.map((b) => ({ id: b.id, numero: b.numero, nomComplet: b.nomComplet })),
        )
      : [];

    // M4 DE LA RELECTURE · LE 422 CONFRONTÉ À CE QUI SE PROPOSE · un salaire
    // payé hors de ce module (D 422 / C trésorerie saisi à la main) restait
    // « à payer ». Le module ne voit que ses propres paiements ; le 422 voit
    // tout. Ce que la proposition offre pour des bulletins PASSÉS au journal
    // ne peut dépasser ce que le 422 porte encore (fiche du compte 42 des deux
    // plans · crédité des rémunérations dues, débité de leur paiement).
    // Condition nécessaire, pas suffisante · elle avertit, sans refuser.
    const passes = aPayer.filter((l) => l.passeAuJournal);
    const confrontation422 = await this.confronterAu422(
      tenantId,
      passes.reduce((n, l) => n + centimes(l.montant), 0) / 100,
      lus.filter((b) => b.ecritureId !== null && passes.some((l) => l.bulletinId === b.id)).map((b) => b.ecritureId as string),
    );

    const coupuresProposees = ((dernierEnEspeces?.billetage as unknown as BilletageDuPaiement | null)?.coupures ?? []).map(Number);
    const coupures = coupuresDemandees && coupuresDemandees.length ? coupuresDemandees : coupuresProposees;
    const enEspeces = aPayer.filter((l) => l.mode === ModePaiementSalaire.ESPECES);
    const billetage = coupures.length && enEspeces.length ? billetageDuPaiement(enEspeces, coupures) : null;

    return {
      mois,
      echeanceArticle99: echeanceArticle99(mois),
      aPayer,
      tropPayes,
      versementsSansBulletin,
      confrontation422,
      tronque,
      paiements: paiements.map((p) => ({
        id: p.id,
        mode: p.mode,
        date: p.date,
        journal: p.journal.code,
        total: nombre(p.total),
        piecePassee: p.piecePassee,
        statutEcriture: p.ecriture?.statut ?? null,
        ordreVirement: p.ordreVirement ? { numero: p.ordreVirement.numero, statut: p.ordreVirement.statut } : null,
        billetage: p.billetage as unknown as BilletageDuPaiement | null,
        annuleLe: p.annuleLe,
        motifAnnulation: p.motifAnnulation,
        ecritureNegatif: p.ecritureNegatifId !== null,
        lignes: p.lignes.map((l) => ({ ...l, montant: nombre(l.montant) })),
      })),
      journaux: journaux.map((j) => ({
        id: j.id,
        code: j.code,
        intitule: j.intitule,
        compte: j.compteTresorerie?.numero ?? null,
        caisse: (j.compteTresorerie?.numero ?? '').startsWith('57'),
        devise: j.ribsBanque[0]?.devise ?? null,
      })),
      coupuresProposees,
      billetage,
    };
  }

  /**
   * Les versements non annulés de bulletins donnés, avec leur pièce · ce que
   * le journal porte pour eux.
   */
  async versementsDesBulletins(tenantId: string, bulletins: readonly { id: string; numero: number; nomComplet: string }[]) {
    const lignes = await this.prisma.lignePaiementSalaire.findMany({
      where: { tenantId, annuleLe: null, bulletinId: { in: bulletins.map((b) => b.id) } },
      orderBy: { paiement: { date: 'asc' } },
      // Un bulletin se paie au plus en quelques fois · la borne est dite.
      take: 500,
      select: { bulletinId: true, montant: true, paiement: { select: { date: true, piecePassee: true } } },
    });
    return bulletins.map((b) => {
      const siens = lignes.filter((l) => l.bulletinId === b.id);
      return {
        bulletinId: b.id,
        numero: b.numero,
        nomComplet: b.nomComplet,
        montant: siens.reduce((n, l) => n + centimes(nombre(l.montant)), 0) / 100,
        pieces: siens.map((l) => ({ date: l.paiement.date, piece: l.paiement.piecePassee })),
      };
    });
  }

  /**
   * LE 422 TEL QUE LES LIVRES LE PORTENT, lu depuis l'exercice de la
   * PASSATION · second tour, point 5. Lu sur l'exercice du jour, il disait
   * chaque janvier « payé hors de ce module » d'une paie de décembre, tant
   * que N+1 n'avait pas son à-nouveau. L'exercice de l'écriture de paie se lit
   * en entier (ouverture comprise), chaque exercice suivant sans sa position
   * d'ouverture (à-nouveau provisoire, report de clôture, bilan d'ouverture ·
   * `filtreOuverturePasseeAuPremierJour`), qui ne fait que reporter le solde
   * déjà compté ; un paiement saisi d'avance dans N+1 y est donc vu. Lignes de
   * tous statuts (le paiement saisi à la main est souvent au brouillard).
   * `null` sans écriture ni compte lisible · jamais un zéro.
   */
  private async confronterAu422(tenantId: string, totalPasse: number, ecritureIds: readonly string[]) {
    if (totalPasse <= 0 || ecritureIds.length === 0) return null;
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
    if (!tenant) return null;
    const ids = [...new Set(ecritureIds)];
    const ecritures = await this.prisma.ecriture.findMany({
      where: { tenantId, id: { in: ids } },
      take: ids.length,
      select: { exercice: { select: { id: true, dateDebut: true, dateFin: true } } },
    });
    if (ecritures.length === 0) return null;
    const passation = ecritures.map((e) => e.exercice).sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())[0];
    const suivants = await this.prisma.exercice.findMany({
      where: { tenantId, dateDebut: { gt: passation.dateDebut } },
      orderBy: { dateDebut: 'asc' },
      // Un dossier n'a jamais vingt exercices ouverts au-delà de celui d'une
      // paie encore à payer · la borne est dite.
      take: 20,
      select: { id: true, dateDebut: true, dateFin: true },
    });
    const racine = compteDuRole('REMUNERATIONS_DUES', tenant.referentiel).replace(/0+$/, '');
    const solde = async (ecriture: Prisma.EcritureWhereInput) => {
      const s = await this.prisma.ligneEcriture.aggregate({
        // Une écriture de SITUATION n'enregistre aucune opération (ligne
        // sage-l1, AUDCIF art. 19) · une simulation de paiement ne solde pas le
        // 422 que les livres portent.
        where: { compte: { tenantId, numero: { startsWith: racine } }, ecriture: avecStatut(ecriture) },
        _sum: { debit: true, credit: true },
      });
      return centimes(nombre(s._sum.credit ?? 0)) - centimes(nombre(s._sum.debit ?? 0));
    };
    let soldeCentimes = await solde({ tenantId, exerciceId: passation.id });
    for (const f of suivants) {
      soldeCentimes += (await solde({ tenantId, exerciceId: f.id, estANouveauProvisoire: false })) - (await solde(filtreOuverturePasseeAuPremierJour(tenantId, f)));
    }
    const soldeLu = soldeCentimes / 100;
    const ecart = (centimes(totalPasse) - soldeCentimes) / 100;
    const dernier = suivants.length ? suivants[suivants.length - 1] : passation;
    return {
      compte: racine,
      solde: soldeLu,
      totalPasse,
      exercice: { debut: passation.dateDebut, fin: dernier.dateFin },
      avertissement:
        ecart > 0
          ? `Le ${racine} (Personnel, rémunérations dues) ne porte plus que ${soldeLu.toFixed(2)} de rémunérations dues, quand ${totalPasse.toFixed(2)} sont proposés à payer sur des bulletins passés au journal · un salaire a pu être payé hors de ce module (débit du ${racine} saisi à la main). Vérifiez le grand livre du ${racine} avant de payer ; le module ne voit que ses propres paiements.`
          : null,
    };
  }

  /**
   * PAYER · tout se juge AVANT la pièce (mois, journal, bulletins, mode de
   * chaque salarié, chèques, coupures, compte 422, RIB de l'ordre), puis la
   * pièce, l'ordre de virement et la fiche naissent dans UNE transaction
   * (`creerAvec`) · un arrêt entre deux laisserait un salaire versé sans la
   * fiche qui empêche de le verser deux fois.
   */
  async payer(tenantId: string, userId: string, email: string, mois: string, dto: PaiementSalairesDto) {
    if (!estUnMois(mois)) throw new BadRequestException('Le mois de paie se lit AAAA-MM.');
    const mode = dto.mode;
    const ids = [...new Set(dto.bulletinIds)];
    if (ids.length !== dto.bulletinIds.length) throw new BadRequestException('Un bulletin est donné deux fois.');

    const [tenant, journal, bulletins, deja] = await Promise.all([
      this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } }),
      this.prisma.journal.findFirst({
        where: { id: dto.journalId, tenantId },
        select: {
          id: true,
          code: true,
          type: true,
          estActif: true,
          compteTresorerie: { select: { id: true, numero: true } },
          ribsBanque: { select: { devise: true }, take: 1 },
        },
      }),
      this.prisma.bulletinPaie.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, numero: true, moisDePaie: true, statut: true, salarieId: true, nomComplet: true, netAPayerFc: true, salarie: { select: { modePaiement: true } } },
      }),
      this.dejaPayes(tenantId, mois),
    ]);
    if (!tenant) throw new NotFoundException('Dossier introuvable.');
    const refusJournal = motifRefusJournalDuPaiement(mode, journal, journal?.ribsBanque[0]?.devise ?? null);
    if (refusJournal) throw new BadRequestException(refusJournal);

    const lignes: { bulletinId: string; numero: number; salarieId: string; nomComplet: string; montant: number }[] = [];
    const refus: string[] = [];
    for (const id of ids) {
      const b = bulletins.find((x) => x.id === id);
      if (!b) {
        refus.push(`bulletin ${id} introuvable dans ce dossier`);
        continue;
      }
      const nom = `n° ${b.numero} · ${b.nomComplet}`;
      if (b.moisDePaie !== mois) refus.push(`${nom} est du mois ${b.moisDePaie}`);
      else if (b.statut !== 'EMIS') refus.push(`${nom} est annulé`);
      else if (deja.parBulletin.has(b.id)) refus.push(`${nom} est déjà payé`);
      else if (b.salarie.modePaiement !== mode) {
        refus.push(
          b.salarie.modePaiement
            ? `${nom} se paie par ${MODES_PAIEMENT[b.salarie.modePaiement].libelle.toLowerCase()} (mode convenu)`
            : `${nom} · son mode de paiement n'est pas encore dit (Registre du personnel)`,
        );
      } else {
        const r = resteAPayer({ id: b.id, salarieId: b.salarieId, netAPayer: nombre(b.netAPayerFc), dejaPayeAutres: deja.autres(b.salarieId, b.id) });
        if (r.tropPaye > 0) refus.push(`${nom} · un bulletin annulé du mois a déjà versé ${r.tropPaye} de plus que ce net`);
        else if (r.montant <= 0) refus.push(`${nom} · rien ne reste à payer`);
        else lignes.push({ bulletinId: b.id, numero: b.numero, salarieId: b.salarieId, nomComplet: b.nomComplet, montant: r.montant });
      }
    }
    if (refus.length) throw new BadRequestException(`Paiement refusé · ${refus.join(' ; ')}.`);

    // Chèque · un numéro par salarié, deux salariés jamais le même chèque.
    const reference = (bulletinId: string) => dto.references?.find((r) => r.bulletinId === bulletinId)?.reference?.trim() || null;
    if (mode === ModePaiementSalaire.CHEQUE) {
      const refusCheques = motifRefusReferencesCheques(lignes.map((l) => ({ nomComplet: l.nomComplet, reference: reference(l.bulletinId) })));
      if (refusCheques) throw new BadRequestException(refusCheques);
    }
    // Espèces · le billetage sur les coupures déclarées, figé avec le paiement.
    let billetage: BilletageDuPaiement | null = null;
    if (mode === ModePaiementSalaire.ESPECES && dto.coupures && dto.coupures.length) {
      const refusCoupures = motifRefusCoupures(dto.coupures);
      if (refusCoupures) throw new BadRequestException(refusCoupures);
      billetage = billetageDuPaiement(lignes, dto.coupures);
    }

    // Le 422 · lu dans les deux plans (passation-paie.ts), ouvert en imputation.
    const numero422 = compteDuRole('REMUNERATIONS_DUES', tenant.referentiel);
    const compte422 = await this.prisma.compte.findFirst({ where: { tenantId, numero: numero422 }, select: { id: true, typeCompte: true } });
    if (!compte422 || compte422.typeCompte !== TypeCompteDetailTotal.DETAIL) {
      throw new BadRequestException(`Le compte ${numero422} (Personnel, rémunérations dues) n'est pas ouvert en imputation dans ce dossier · ouvrez-le au plan comptable.`);
    }
    // Virement · le RIB du journal et le RIB principal de chaque salarié, AVANT la pièce.
    const preparation =
      mode === ModePaiementSalaire.VIREMENT
        ? await this.ordres.preparerSalaries(tenantId, journal!.id, lignes.map((l) => ({ id: l.salarieId, nomComplet: l.nomComplet })))
        : null;

    const total = lignes.reduce((n, l) => n + centimes(l.montant), 0) / 100;
    const libelle = (dto.libelle?.trim() || `Salaires ${mois} · ${MODES_PAIEMENT[mode].libelle.toLowerCase()}`).slice(0, 190);
    const referencePiece =
      mode === ModePaiementSalaire.CHEQUE
        ? `Chèques n° ${lignes.map((l) => reference(l.bulletinId)).join(', ')}`.slice(0, 190)
        : `Paiement des salaires ${mois} · ${lignes.length} salarié(s)`;
    try {
      const r = await this.ecritures.creerAvec(
        tenantId,
        userId,
        {
          exerciceId: dto.exerciceId,
          journalId: journal!.id,
          date: dto.date,
          libelle,
          reference: referencePiece,
          lignes: [
            { compteId: compte422.id, libelle, debit: total, credit: 0 },
            { compteId: journal!.compteTresorerie!.id, libelle, debit: 0, credit: total },
          ],
        },
        async (tx, ecriture) => {
          const e = await tx.ecriture.findFirst({ where: { id: ecriture.id, tenantId }, select: { numeroPiece: true } });
          const piece = `${journal!.code} n° ${e?.numeroPiece ?? '·'}`;
          const ordre = preparation
            ? await this.ordres.creerDans(
                tx,
                tenantId,
                email,
                journal!.id,
                dto.date,
                preparation,
                lignes.map(
                  (l): LigneAOrdonner => ({ salarieId: l.salarieId, montant: l.montant, reference: `Salaire ${mois}`, ecritureId: ecriture.id, pieceReglement: piece }),
                ),
              )
            : null;
          return tx.paiementSalaires.create({
            data: {
              tenantId,
              moisDePaie: mois,
              mode,
              exerciceId: dto.exerciceId,
              journalId: journal!.id,
              date: new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`),
              total: new Prisma.Decimal(total),
              ecritureId: ecriture.id,
              piecePassee: piece,
              ordreVirementId: ordre?.id ?? null,
              billetage: billetage ? (billetage as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
              creePar: userId,
              lignes: {
                create: lignes.map((l) => ({
                  tenantId,
                  bulletinId: l.bulletinId,
                  salarieId: l.salarieId,
                  nomComplet: l.nomComplet,
                  montant: new Prisma.Decimal(l.montant),
                  reference: reference(l.bulletinId),
                })),
              },
            },
            select: { id: true, total: true, piecePassee: true, ordreVirement: { select: { numero: true } } },
          });
        },
      );
      return { ...r.suite, total: nombre(r.suite.total), billetage };
    } catch (e) {
      if (estDoublon(e)) {
        throw new ConflictException(`Un des bulletins a été payé entre-temps · rien n'est enregistré, relisez la proposition de ${mois}.`);
      }
      throw e;
    }
  }

  /**
   * ANNULER UN PAIEMENT (AUDCIF art. 20, al. 2) · l'ordre de virement qu'il a
   * fait naître est annulé avec lui, sa pièce au brouillard retirée, validée
   * inscrite en négatif ; la fiche est MARQUÉE, jamais supprimée, et ses
   * lignes libèrent les bulletins. Refus · déjà annulé, exercice clôturé,
   * ligne lettrée ou pointée (le pointage affirme la concordance avec un
   * relevé, qu'une annulation dans le dos du rapprochement démentirait).
   */
  async annuler(tenantId: string, userId: string, email: string, id: string, dto: AnnulationPaiementSalairesDto) {
    const p = await this.prisma.paiementSalaires.findFirst({
      where: { id, tenantId },
      include: { exercice: { select: { statut: true } }, ordreVirement: { select: { id: true, statut: true } } },
    });
    if (!p) throw new NotFoundException('Paiement introuvable pour ce dossier.');
    if (p.annuleLe) throw new ConflictException('Ce paiement est déjà annulé.');
    if (p.exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException("Ce paiement appartient à un exercice clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).");
    }
    const ecriture = p.ecritureId
      ? await this.prisma.ecriture.findFirst({
          where: { id: p.ecritureId, tenantId },
          select: { id: true, numeroPiece: true, statut: true, lignes: { select: { lettre: true, lettrageId: true, rapprochementId: true } } },
        })
      : null;
    if (ecriture) {
      const tenue = motifLignesTenues(ecriture.lignes, `la pièce n° ${ecriture.numeroPiece ?? '·'}`, 'annuler le paiement');
      if (tenue) throw new BadRequestException(tenue);
    }
    const motif = dto.motif.trim();
    const maintenant = new Date();
    return transactionJournalisee(this.prisma, async (tx) => {
      if (p.ordreVirement && p.ordreVirement.statut !== StatutOrdreVirement.ANNULE) {
        await this.ordres.annulerDans(tx, tenantId, p.ordreVirement.id, email, `Paiement des salaires annulé · ${motif}`);
      }
      // Le lien se défait d'abord · une pièce que la fiche retient ne se retire pas.
      await tx.paiementSalaires.update({ where: { id: p.id }, data: { ecritureId: null } });
      let negatifId: string | null = null;
      if (p.ecritureId) {
        const e = await tx.ecriture.findFirst({ where: { id: p.ecritureId, tenantId }, select: { statut: true } });
        if (!e) throw new ConflictException("La pièce du paiement n'existe plus · relisez le paiement avant de l'annuler.");
        if (e.statut === StatutEcriture.BROUILLARD) {
          await tx.ligneEcriture.deleteMany({ where: { ecritureId: p.ecritureId, ecriture: { tenantId, statut: StatutEcriture.BROUILLARD } } });
          const r = await tx.ecriture.deleteMany({ where: { id: p.ecritureId, tenantId, statut: StatutEcriture.BROUILLARD } });
          if (r.count !== 1) {
            throw new ConflictException(
              "La pièce du paiement a été validée pendant l'annulation · rien n'est retiré. Relancez l'annulation · validée, elle s'inscrira en négatif.",
            );
          }
        } else {
          const negatif = await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, p.ecritureId, `Annulation du paiement des salaires · ${motif}`, tx);
          negatifId = negatif.id;
        }
      }
      await tx.lignePaiementSalaire.updateMany({ where: { tenantId, paiementId: p.id }, data: { annuleLe: maintenant } });
      return tx.paiementSalaires.update({
        where: { id: p.id },
        data: {
          annuleLe: maintenant,
          annulePar: userId,
          motifAnnulation: motif,
          // Validée, la pièce reste au journal avec son négatif, et la fiche
          // retient les deux · retirée seule, le négatif resterait orphelin.
          ecritureId: negatifId ? p.ecritureId : null,
          ecritureNegatifId: negatifId,
        },
        select: { id: true, annuleLe: true, ecritureNegatifId: true },
      });
    });
  }
}
