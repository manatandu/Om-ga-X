import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutLettrage, TypeJournal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { LettrageService } from '../lettrage/lettrage.service';
import { pairesACheval, type PairesACheval } from '../lettrage/paires-a-cheval';
import { refuserSiLignesFigees } from '../exercice/gel-cloture';
import { EnregistrerReglementsDto, PasserEcartChangeDto, type ReglementTiersDto } from './reglements.dto';
import { contrevaleurAdmise } from '../comptabilite/ligne-en-devise';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import {
  coursEtFrancsDuReglement,
  coutHistoriqueRegle,
  ecartSigne,
  libelleEcartRealise,
  motifRefusTresorerieEnDevise,
  lignesDuReglementEnDevise,
  lignesEcartDuGroupe,
  natureDuCompte,
  type FactureEnDevise,
  type Referentiel,
} from './ecart-change-realise';
import { compteDeLEcart, referentielDuDossier } from './compte-ecart-change';
import { lignesDeReevaluationSurLesTiers } from './lignes-de-reevaluation';
import { avertissementExtourneManquante, issueReevaluationDejaPassee, motifReglementDejaReevalue } from './reevaluation-et-ecart-realise';
import { OrdresVirementService, type LigneAOrdonner } from './ordres-virement.service';
import {
  avertissementImputationDuGroupe,
  echeancesDesGroupesPartiels,
  fileDuGroupeEnDevise,
  groupesDesLignes,
  motifDeuxGroupes,
  motifDeviseIndeterminee,
  motifLigneDuGroupe,
  motifRefusMontantDuGroupe,
  restesDuGroupe,
} from './lettrage-partiel';
import { resteDuGroupe, type ResteDeFacture } from '../lettrage/reconduction-lettrage';
import {
  avertissementCreanceReclassee,
  estEcheanceAReglerSur,
  motifHorsEcheance,
  motifReglementAuDelaDuNet,
  lignesDuReglement,
  lignesDuReglementImpute,
  libellesDesParts,
  imputationImprimee,
  montantDu,
  motifRefusImputationReglement,
  motifRefusMontant,
  type SensReglement,
} from './reglement-tiers';

/**
 * RÈGLEMENT DES TIERS · voir reglement-tiers.ts pour les règles et leurs
 * sources. Ce service lit les échéances ouvertes, passe UNE pièce de
 * trésorerie par tiers, et LETTRE aussitôt la facture et son règlement.
 *
 * Le lettrage est posé par la même action, et ce n'est pas une présomption
 * comme celle du lettrage automatique · le comptable a CHOISI les factures
 * qu'il paie, et le règlement a été calculé sur elles. D'où l'origine
 * MANUEL, qui dit qu'un humain a apparié ces lignes.
 */
@Injectable()
export class ReglementsService {
  private readonly journalServeur = new Logger(ReglementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
    private readonly lettrage: LettrageService,
    private readonly ordres: OrdresVirementService,
  ) {}

  /**
   * ÉCHÉANCES OUVERTES de l'exercice, dues au plus tard à `jusquau`. Une
   * ligne sans échéance est due à sa date d'écriture, la même lecture que
   * l'échéancier et la balance âgée. Seules les lignes JAMAIS lettrées sont
   * rendues · un groupe partiel se complète depuis l'interrogation et
   * lettrage, qui connaît son reste à solder.
   *
   * L'À-NOUVEAU PROVISOIRE EST ÉCARTÉ, ET C'EST DIT (A6 bis, second tour,
   * m6) · le régler le lettrerait, et la clôture de l'exercice précédent
   * refuse de remplacer un à-nouveau provisoire lettré (« délettrez-les »,
   * `ExerciceService`). Chaque compte dit combien de ses lignes sont
   * écartées (`aNouveauProvisoireEcartees`), même sans autre échéance ·
   * attendre la clôture, ou saisir le règlement au journal de trésorerie et
   * le lettrer ensuite avec la ligne d'à-nouveau définitif.
   *
   * LA PAIRE À CHEVAL SE COMPENSE (A6 bis, second tour, m1) · la ligne
   * d'à-nouveau qui reporte une facture lettrée avec un règlement de cet
   * exercice n'est plus due, ou ne l'est plus que de son reste
   * (`lettrage/paires-a-cheval.ts`) · sans quoi la facture se payait deux
   * fois. La ligne réglée en partie dit le groupe qui la règle.
   */
  async echeances(tenantId: string, exerciceId: string, sens: SensReglement, jusquau?: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
    if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier.');
    const limite = jusquau ? new Date(jusquau) : null;
    const include = {
        ecriture: {
          select: {
            date: true,
            libelle: true,
            reference: true,
            numeroPiece: true,
            estANouveauProvisoire: true,
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: true,
            journal: { select: { code: true } },
          },
        },
        compte: { select: { id: true, numero: true, intitule: true, tiersCompte: { select: { tiers: { select: { nom: true, code: true } } } } } },
        devise: { select: { code: true } },
    } satisfies Prisma.LigneEcritureInclude;
    // Les factures du même jour se rangent par leur identifiant de ligne ·
    // l'ordre que le règlement en devise suit pour éteindre les plus
    // anciennes d'abord (`ordreDeReglement`, A6 bis, M4), et l'écran avec.
    const ordre = [{ compteId: 'asc' as const }, { ecriture: { date: 'asc' as const } }, { id: 'asc' as const }];
    const libres = await this.prisma.ligneEcriture.findMany({
      where: {
        ecriture: { tenantId, exerciceId },
        lettrageId: null,
        compte: { tenantId, numero: { startsWith: sens === 'FOURNISSEUR' ? '40' : '41' } },
        ...(sens === 'FOURNISSEUR' ? { credit: { gt: 0 } } : { debit: { gt: 0 } }),
      },
      include,
      orderBy: ordre,
    });
    // LES FACTURES D'UN LETTRAGE PARTIEL, POUR LEUR RESTE (ligne
    // lettrage-cloture) · l'acompte réuni avec elle en N, ou reconduit avec
    // elle par la clôture, en a déjà réglé une part (fiches des comptes 40 et
    // 41) · servie entière, elle se payait deux fois.
    const partielles = await echeancesDesGroupesPartiels(this.prisma, { tenantId, exerciceId, sens });
    const resteDeLaLigne = new Map(partielles.map((x) => [x.ligneId, x]));
    const lignesPartielles = partielles.length
      ? await this.prisma.ligneEcriture.findMany({ where: { id: { in: partielles.map((x) => x.ligneId) }, ecriture: { tenantId, exerciceId } }, include, orderBy: ordre })
      : [];
    const lignes = [...libres, ...lignesPartielles].sort(
      (a, b) => (a.compteId < b.compteId ? -1 : a.compteId > b.compteId ? 1 : 0) || a.ecriture.date.getTime() - b.ecriture.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

    const dueAvant = (l: (typeof lignes)[number]) => !limite || (l.dateEcheance ?? l.ecriture.date).getTime() <= limite.getTime();
    // Lue seulement quand une ligne d'à-nouveau est due · sans elle, aucune paire.
    const paires: PairesACheval | null = lignes.some((l) => estDAnouveau(l.ecriture))
      ? await pairesACheval(this.prisma, { tenantId, exercice, compte: { numero: { startsWith: sens === 'FOURNISSEUR' ? '40' : '41' } } })
      : null;
    // L'ÉCART D'UNE RÉÉVALUATION n'est pas une facture (A6 ter) · sa ligne sur
    // le compte du tiers, dans l'exercice ou reportée à l'à-nouveau, est
    // reconnue par la liaison de la réévaluation et ne se règle pas.
    const ecartsDeReevaluation = await lignesDeReevaluationSurLesTiers(this.prisma, {
      tenantId,
      exercice,
      compteIds: [...new Set(lignes.filter((l) => l.deviseId === null).map((l) => l.compteId))],
    });
    const aRegler = lignes.filter(
      (l) => estEcheanceAReglerSur(l.compte.numero, sens) && !paires?.absorbees.has(l.id) && !ecartsDeReevaluation.has(l.id),
    );
    const ecartees = new Map<string, number>();
    for (const l of aRegler) {
      if (l.ecriture.estANouveauProvisoire === true && dueAvant(l)) ecartees.set(l.compteId, (ecartees.get(l.compteId) ?? 0) + 1);
    }
    const retenues = aRegler
      .filter((l) => l.ecriture.estANouveauProvisoire !== true)
      .map((l) => {
        const partielle = resteDeLaLigne.get(l.id);
        const due = ligneDue(l, paires, partielle ? new Map([[l.id, { sens, reste: partielle.reste }]]) : null);
        const entiere = montantDu({ debit: Number(l.debit), credit: Number(l.credit) }, sens);
        const montant = montantDu({ debit: Number(due.debit), credit: Number(due.credit) }, sens);
        const reste = paires?.reste.get(l.id);
        return {
          id: l.id,
          compteId: l.compteId,
          echeance: l.dateEcheance ?? l.ecriture.date,
          date: l.ecriture.date,
          journalCode: l.ecriture.journal.code,
          numeroPiece: l.ecriture.numeroPiece,
          reference: l.ecriture.reference,
          libelle: l.libelle ?? l.ecriture.libelle,
          montant,
          // La facture en devise se règle dans sa devise (ligne A6) · l'écran
          // demande alors le montant en devise et le cours du jour.
          deviseId: l.deviseId ?? null,
          deviseCode: l.devise?.code ?? null,
          // Bloquant 1 · un reste en devise indéterminé ne se sert pas · la
          // facture reste nommée, son règlement en devise est refusé.
          montantDevise:
            partielle?.reste.deviseIndeterminee || due.montantDevise === null || due.montantDevise === undefined ? null : Number(due.montantDevise),
          coursApplique: l.coursApplique === null || l.coursApplique === undefined ? null : Number(l.coursApplique),
          // Réglée en partie par un lettrage à cheval (m1) · le groupe et ce qu'il a réglé.
          regleParLettrageACheval: reste ? { groupe: reste.groupe, montant: Math.round((entiere - montant) * 100) / 100 } : null,
          // Réglée en partie dans son lettrage partiel (ligne lettrage-cloture) · le groupe et ce qu'il a réglé.
          regleParLettragePartiel: partielle
            ? {
                groupe: partielle.groupe.code.toLowerCase(),
                montant: partielle.reste.regle,
                ...(partielle.reste.deviseIndeterminee ? { deviseIndeterminee: true } : {}),
              }
            : null,
        };
      })
      .filter((l) => l.montant > 0 && (!limite || l.echeance.getTime() <= limite.getTime()));

    // A7 ter, mineur 1 · le compte d'une créance reclassée en vigueur se dit
    // AVANT le règlement · « Recouvrement » dans le module, s'il s'agit d'elle.
    const reclassees =
      sens === 'CLIENT' ? await this.creancesReclasseesDesComptes(tenantId, [...new Set(aRegler.map((l) => l.compteId))]) : [];
    type Groupe = {
      compteId: string;
      numero: string;
      intitule: string;
      tiers: string | null;
      creanceReclassee: { compte416: string; date: string } | null;
      lignes: typeof retenues;
      /** Lignes d'à-nouveau PROVISOIRE écartées (m6) · attendre la clôture de l'exercice précédent. */
      aNouveauProvisoireEcartees: number;
    };
    const parCompte = new Map<string, Groupe>();
    const groupeDe = (c: (typeof lignes)[number]['compte']) => {
      if (!parCompte.has(c.id)) {
        const r = reclassees.find((x) => x.compteId === c.id);
        parCompte.set(c.id, {
          compteId: c.id,
          numero: c.numero,
          intitule: c.intitule,
          tiers: c.tiersCompte ? `${c.tiersCompte.tiers.code} · ${c.tiersCompte.tiers.nom}` : null,
          creanceReclassee: r ? { compte416: r.compte416, date: r.date } : null,
          lignes: [],
          aNouveauProvisoireEcartees: ecartees.get(c.id) ?? 0,
        });
      }
      return parCompte.get(c.id)!;
    };
    // Même ordre que la lecture · le compte d'une ligne écartée a sa place,
    // même sans autre échéance.
    const parId = new Map(retenues.map((x) => [x.id, x]));
    for (const l of aRegler) {
      const retenue = parId.get(l.id);
      if (retenue) groupeDe(l.compte).lignes.push(retenue);
      else if (ecartees.has(l.compteId)) groupeDe(l.compte);
    }
    return [...parCompte.values()];
  }

  /**
   * Les comptes clients qui portent une créance reclassée au 416 EN VIGUEUR
   * (non annulée), la plus récente par compte · lus par l'index du compte
   * d'origine (migration 20270125000000).
   */
  private async creancesReclasseesDesComptes(tenantId: string, comptes: string[]) {
    if (comptes.length === 0) return [];
    const creances = await this.prisma.creanceDouteuse.findMany({
      // M9 · une créance corrigée par le résultat n'est plus au 416 · rien ne
      // s'y recouvre, et le compte du client se règle comme les autres.
      where: { tenantId, annuleeLe: null, corrigeeParResultatLe: null, compteCreanceId: { in: comptes } },
      select: { compteCreanceId: true, dateReclassement: true, compte416: { select: { numero: true } } },
      orderBy: { dateReclassement: 'desc' },
    });
    const vus = new Set<string>();
    const rendues: Array<{ compteId: string; compte416: string; date: string }> = [];
    for (const c of creances) {
      if (vus.has(c.compteCreanceId)) continue;
      vus.add(c.compteCreanceId);
      rendues.push({ compteId: c.compteCreanceId, compte416: c.compte416.numero, date: c.dateReclassement.toISOString().slice(0, 10) });
    }
    return rendues;
  }

  /**
   * ENREGISTRE les règlements · une pièce par tiers, au journal de trésorerie
   * choisi, puis le lettrage. Tout est VÉRIFIÉ avant la première écriture ·
   * un lot de dix règlements ne doit pas s'arrêter au sixième en laissant
   * cinq pièces passées et cinq non.
   */
  async enregistrer(tenantId: string, userId: string, dto: EnregistrerReglementsDto, email: string = userId) {
    const journal = await this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId } });
    if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    if (journal.type !== TypeJournal.TRESORERIE || !journal.compteTresorerieId) {
      throw new BadRequestException(
        `Le journal ${journal.code} n'est pas un journal de trésorerie rattaché à un compte de banque ou de caisse · ` +
          'un règlement se passe au journal du moyen de paiement.',
      );
    }
    const compteTresorerieId = journal.compteTresorerieId;

    const idsComptes = dto.reglements.map((r) => r.compteId);
    if (new Set(idsComptes).size !== idsComptes.length) {
      throw new BadRequestException('Un même tiers figure deux fois · ses factures se règlent en une seule pièce.');
    }
    const toutesLignes = dto.reglements.flatMap((r) => r.ligneIds);
    if (new Set(toutesLignes).size !== toutesLignes.length) {
      throw new BadRequestException('Une même facture figure dans deux règlements.');
    }

    const lignes = await this.prisma.ligneEcriture.findMany({
      where: { id: { in: toutesLignes }, ecriture: { tenantId } },
      include: {
        compte: {
          select: { numero: true, intitule: true, lettrable: true, tiersCompte: { select: { tiers: { select: { nom: true } } } } },
        },
        ecriture: {
          select: {
            exerciceId: true,
            date: true,
            estANouveauProvisoire: true,
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: true,
            // La référence de la facture sur la ligne qui la paie, quand le
            // dossier désigne la part de chacune (jumeau 3 du point 4).
            numeroPiece: true,
            libelle: true,
          },
        },
      },
    });
    if (lignes.length !== toutesLignes.length) {
      throw new NotFoundException('Une ou plusieurs factures sont introuvables.');
    }

    // LA PAIRE À CHEVAL (A6 bis, second tour, m1) · une ligne d'à-nouveau que
    // le règlement d'un lettrage à cheval éteint n'est plus due, ou ne l'est
    // plus que de son reste · relue ici, jamais reçue de l'écran.
    let paires: PairesACheval | null = null;
    if (lignes.some((l) => estDAnouveau(l.ecriture))) {
      const exercice = await this.prisma.exercice.findFirst({ where: { id: dto.exerciceId, tenantId }, select: { id: true, dateDebut: true } });
      if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier.');
      paires = await pairesACheval(this.prisma, { tenantId, exercice, compte: { id: { in: idsComptes } } });
    }
    const avertissementsPaires: string[] = [];
    // LES LETTRAGES PARTIELS DES FACTURES CHOISIES (ligne lettrage-cloture) ·
    // lus avec toutes leurs lignes, avant la première pièce.
    const { groupes, origines } = await groupesDesLignes(this.prisma, tenantId, lignes.flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])));

    const plan = dto.reglements.map((r) => {
      const lues = lignes.filter((l) => r.ligneIds.includes(l.id));
      // UNE FACTURE D'UN LETTRAGE PARTIEL SE RÈGLE POUR SON RESTE, et le
      // règlement complète son groupe (ligne lettrage-cloture · fiches des
      // comptes 40 et 41). Groupe soldé, à cheval ou verrouillé · refus nommé.
      for (const l of lues) {
        if (!l.lettrageId) continue;
        const motif = motifLigneDuGroupe(l.compte.numero, groupes.get(l.lettrageId), dto.exerciceId);
        if (motif) throw new BadRequestException(motif);
      }
      const sesGroupes = [...new Set(lues.flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])))].map((id) => groupes.get(id)!);
      const deux = motifDeuxGroupes(lues[0]?.compte.numero ?? '', sesGroupes.map((g) => g.code));
      if (deux) throw new BadRequestException(deux);
      const groupe = sesGroupes[0] ?? null;
      const partiels = new Map<string, { sens: SensReglement; reste: ResteDeFacture }>();
      if (groupe) {
        const restes = restesDuGroupe(groupe, dto.sens, origines);
        for (const l of lues) {
          if (l.lettrageId !== groupe.id) continue;
          const reste = restes.get(l.id) ?? { francs: 0, devise: null, regle: 0, deviseIndeterminee: false };
          // Bloquant 1 · le reste en devise d'une facture qu'un acompte en
          // francs a réglée en partie ne se déduit pas · refusé, issues nommées.
          if (reste.deviseIndeterminee) throw new BadRequestException(motifDeviseIndeterminee(l.compte.numero, groupe.code));
          // Mineur m6 · éteinte dans sa devise, un reste en francs n'est pas
          // un avoir · c'est un réalisé non passé (AUDCIF art. 55).
          if (reste.devise !== null && reste.devise <= 0 && reste.francs > 0) {
            throw new BadRequestException(
              `${l.compte.numero} · la facture choisie est réglée en entier dans sa devise par le lettrage partiel ${groupe.code.toLowerCase()} · ` +
                `il en reste ${reste.francs.toFixed(2)} en francs, un écart de change réalisé non passé (AUDCIF art. 55). Passez l’écart depuis ` +
                'Interrogation et lettrage, rien ne se règle ici.',
            );
          }
          partiels.set(l.id, { sens: dto.sens, reste });
        }
      }
      for (const l of lues) {
        if (paires?.absorbees.has(l.id)) {
          throw new BadRequestException(
            `${l.compte.numero} · la ligne d'à-nouveau choisie est déjà réglée par le lettrage ${paires.groupeDe.get(l.id) ?? ''} ` +
              "à cheval de deux exercices · sa facture d'origine y est lettrée avec un règlement de cet exercice. Elle n'est plus due ; " +
              "ne la lettrez avec aucun autre règlement.",
          );
        }
        const reste = paires?.reste.get(l.id);
        if (reste) {
          avertissementsPaires.push(
            `${l.compte.numero} · la ligne d'à-nouveau du ${l.ecriture.date.toISOString().slice(0, 10)} est réglée en partie par le lettrage ` +
              `${reste.groupe} à cheval de deux exercices · seul son reste est dû, et son lettrage avec ce règlement restera partiel de ce que ` +
              'le groupe a réglé.',
          );
        }
      }
      // Les montants DUS · le reste d'une ligne réglée en partie par une paire.
      const siennes = lues.map((l) => ({ ...l, ...ligneDue(l, paires, partiels) }));
      for (const l of siennes) {
        if (l.compteId !== r.compteId) {
          throw new BadRequestException('Toutes les factures d\'un règlement doivent être sur le compte du tiers réglé.');
        }
        if (!estEcheanceAReglerSur(l.compte.numero, dto.sens)) {
          throw new BadRequestException(motifHorsEcheance(l.compte.numero));
        }
        // LE LETTRAGE SE VÉRIFIE AVEC LE RESTE (audit final F56) · refusé
        // après la pièce, il laissait un règlement passé et des factures
        // encore dues, qu'un second clic payait deux fois.
        if (!l.compte.lettrable) {
          throw new BadRequestException(
            `Le compte ${l.compte.numero} n'est pas déclaré lettrable · le règlement lettre ses factures. ` +
              'Ouvrez-le au lettrage depuis le plan comptable avant de régler.',
          );
        }
        if (l.ecriture.exerciceId !== dto.exerciceId) {
          throw new BadRequestException('Les factures réglées doivent appartenir à l\'exercice du règlement.');
        }
        // L'À-NOUVEAU PROVISOIRE NE SE RÈGLE PAS ICI (second tour, m6) · lettré,
        // il ferait refuser la clôture de l'exercice précédent.
        if (l.ecriture.estANouveauProvisoire === true) {
          throw new BadRequestException(motifANouveauProvisoire(l.compte.numero));
        }
      }
      const du = Math.round(siennes.reduce((s, l) => s + montantDu({ debit: Number(l.debit), credit: Number(l.credit) }, dto.sens), 0) * 100) / 100;
      if (!(du > 0)) {
        throw new BadRequestException(`Rien n'est dû sur les factures choisies du compte ${siennes[0].compte.numero}.`);
      }
      return {
        r,
        compte: siennes[0].compte,
        siennes,
        du,
        reduite: lues.some((l) => paires?.reste.has(l.id) === true),
        groupe: groupe
          ? {
              id: groupe.id,
              code: groupe.code,
              lu: groupe,
              lignes: groupe.lignes.map((l) => l.id),
              // Le solde enregistré · `completer` le relit et refuse s'il a changé (mineur 8).
              solde: resteDuGroupe(groupe),
              regle: Math.round([...partiels.values()].reduce((t, x) => t + x.reste.regle, 0) * 100) / 100,
              // Majeur 3 · le dû en devise de TOUTES les factures choisies,
              // celles du groupe pour leur reste, les autres entières · la
              // borne ne vise pas le seul groupe.
              duDevise: Math.round(siennes.reduce((t, l) => t + Number(l.montantDevise ?? 0), 0) * 100) / 100,
            }
          : null,
      };
    });

    // LES RÈGLEMENTS EN DEVISE (ligne A6) se préparent ICI, avec le reste ·
    // cours, dû en devise et compte d'écart sont vérifiés avant la première
    // pièce, comme tout le lot.
    let referentiel: Referentiel | null = null;
    const prepares: Array<{
      r: ReglementTiersDto;
      compte: (typeof plan)[number]['compte'];
      du: number;
      montant: number;
      enDevise: ReglementEnDevise | null;
      reduite: boolean;
      /** Les parts désignées par le dossier (jumeau 3 du point 4), une ligne au tiers chacune. */
      parts: Array<{ ligneId: string; montant: number; du: number; libelle: string; reference: string }> | null;
      /** Le lettrage partiel que le règlement complète (ligne lettrage-cloture). */
      groupe: (typeof plan)[number]['groupe'];
    }> = [];
    const avertissementsImputation: string[] = [];
    for (const p of plan) {
      const numero = p.compte.numero;
      const dus = new Map(p.siennes.map((l) => [l.id, montantDu({ debit: Number(l.debit), credit: Number(l.credit) }, dto.sens)]));
      const enDeviseP = p.siennes.some((l) => (l.deviseId ?? null) !== null);
      // L'IMPUTATION DU RÈGLEMENT (Code civil, Livre III, art. 151 à 154) ·
      // désignée par le dossier qui paie son fournisseur, sinon légale.
      if (p.r.imputation !== undefined && p.groupe) {
        // Le groupe partiel impute déjà ses acomptes et règlements (art. 154) ·
        // une part désignée ouvrirait un second groupe sur la même facture.
        throw new BadRequestException(
          `${numero} · une facture du lettrage partiel ${p.groupe.code.toLowerCase()} se règle seule, sans part désignée · son reste suit ` +
            'l’imputation du groupe. Retirez-la de ce règlement pour désigner les parts des autres.',
        );
      }
      if (p.r.imputation !== undefined) {
        const motif = motifRefusImputationReglement({
          sens: dto.sens,
          parts: p.r.imputation,
          dus,
          montant: enDeviseP ? 0 : p.r.montant === undefined ? p.du : p.r.montant,
          enDevise: enDeviseP,
          reduite: p.reduite,
          ordreVirement: dto.ordreVirement === true,
          pieceImputation: p.r.pieceImputation ?? null,
        });
        if (motif) throw new BadRequestException(`${numero} · ${motif}`);
      } else if (p.r.pieceImputation !== undefined) {
        throw new BadRequestException(`${numero} · la pièce de l’imputation n’a d’objet qu’avec la part désignée de chaque facture.`);
      }
      if (!enDeviseP) {
        if (p.r.montantDevise !== undefined || p.r.coursReglement !== undefined || p.r.compteEcartChangeId !== undefined) {
          throw new BadRequestException(
            `${numero} · les factures choisies sont en francs · ni montant en devise, ni cours, ni compte d'écart de change.`,
          );
        }
        // `undefined` seul vaut « le dû entier » · un `null` venu d'un appelant
        // qui aurait sauté le DTO tombe sous le refus du montant (A6 bis, B1).
        const montant = p.r.montant === undefined ? p.du : p.r.montant;
        // Au-delà du reste d'un lettrage partiel, le refus NOMME le groupe et
        // ce qu'il a déjà réglé (ligne lettrage-cloture, attendu (2)).
        const auDelaDuReste = p.groupe ? motifRefusMontantDuGroupe(numero, montant, p.du, p.groupe.code, p.groupe.regle) : null;
        if (auDelaDuReste) throw new BadRequestException(auDelaDuReste);
        if (p.groupe) {
          const avertissement = avertissementImputationDuGroupe({
            numero,
            groupe: p.groupe.lu,
            origines,
            sens: dto.sens,
            choisies: p.r.ligneIds,
            date: new Date(dto.date),
            montant,
            deviseId: null,
          });
          if (avertissement) avertissementsImputation.push(avertissement);
        }
        const refus = motifRefusMontant(montant, p.du);
        if (refus) throw new BadRequestException(`${numero} · ${refus}`);
        let parts: (typeof prepares)[number]['parts'] = null;
        if (p.r.imputation !== undefined) {
          const libelles = libellesDesParts(
            `Règlement ${p.compte.tiersCompte?.tiers.nom ?? p.compte.intitule}`,
            p.r.imputation.map((x) => {
              const l = p.siennes.find((s) => s.id === x.ligneId)!;
              return { id: x.ligneId, reference: l.ecriture.numeroPiece ? `pièce ${l.ecriture.numeroPiece}` : l.ecriture.libelle || 'facture' };
            }),
          );
          const referenceDe = (id: string) => {
            const l = p.siennes.find((s) => s.id === id)!;
            return l.ecriture.numeroPiece ? `pièce ${l.ecriture.numeroPiece}` : l.ecriture.libelle || 'facture';
          };
          parts = p.r.imputation.map((x) => ({
            ligneId: x.ligneId,
            montant: x.montant,
            du: dus.get(x.ligneId)!,
            libelle: libelles.get(x.ligneId)!,
            reference: referenceDe(x.ligneId),
          }));
        } else if (p.siennes.length > 1 && Math.round(montant * 100) < Math.round(p.du * 100)) {
          // UN RÈGLEMENT PARTIEL DE PLUSIEURS FACTURES SANS PARTS · l'art. 154
          // l'impute (la plus ancienne d'abord) · DIT, jamais tu.
          avertissementsImputation.push(
            dto.sens === 'FOURNISSEUR'
              ? `${numero} · règlement partiel de ${p.siennes.length} factures sans part désignée · la déduction de leur TVA suit ` +
                  'l’imputation légale (Code civil, Livre III, art. 154 · les échues d’abord, la plus ancienne, au prorata à date ' +
                  'égale). Désignez la part de chaque facture pour la fixer (art. 151).'
              : `${numero} · règlement partiel de ${p.siennes.length} factures · la TVA exigible suit l’imputation déclarée par le ` +
                  'client (art. 151) ou la quittance qu’il a acceptée (art. 153), à déclarer avec sa pièce une fois le règlement ' +
                  'validé, sinon l’imputation légale (art. 154 · les échues d’abord, la plus ancienne, au prorata à date égale).',
          );
        }
        prepares.push({ r: p.r, compte: p.compte, du: p.du, montant, enDevise: null, reduite: p.reduite, parts, groupe: p.groupe });
        continue;
      }
      // EN DEVISE, le reste se lit dans la devise (art. 54 et 55) · le refus
      // nomme le groupe avant le calcul du règlement.
      if (p.groupe && p.r.montantDevise !== undefined) {
        const auDelaDuReste = motifRefusMontantDuGroupe(numero, p.r.montantDevise, p.groupe.duDevise, p.groupe.code, p.groupe.regle, true);
        if (auDelaDuReste) throw new BadRequestException(auDelaDuReste);
      }
      if (p.groupe) {
        const deviseId = p.siennes.find((l) => l.deviseId)?.deviseId ?? null;
        const avertissement = deviseId
          ? avertissementImputationDuGroupe({
              numero,
              groupe: p.groupe.lu,
              origines,
              sens: dto.sens,
              choisies: p.r.ligneIds,
              date: new Date(dto.date),
              montant: p.r.montantDevise ?? p.groupe.duDevise,
              deviseId,
            })
          : null;
        if (avertissement) avertissementsImputation.push(avertissement);
      }
      // LE COÛT HISTORIQUE D'UN RÈGLEMENT QUI COMPLÈTE UN GROUPE se calcule
      // sur les factures du groupe dans l'ordre d'inscription, plus les
      // factures choisies hors de lui (relecture TypeScript du second tour,
      // majeur) · le reste relu ensuite retrouve ainsi, facture par facture,
      // ce que la pièce a inscrit. Une facture de cette devise au reste
      // inconnu dans le groupe refuse le règlement, issues nommées.
      let fileDuCout: FactureEnDevise[] | null = null;
      if (p.groupe) {
        const deviseDuReglement = p.siennes.find((l) => l.deviseId)?.deviseId ?? null;
        const file = deviseDuReglement ? fileDuGroupeEnDevise(p.groupe.lu, dto.sens, origines, deviseDuReglement) : [];
        if (file === null) throw new BadRequestException(motifDeviseIndeterminee(numero, p.groupe.code));
        const horsDuGroupe = p.siennes
          .filter((l) => !p.groupe!.lignes.includes(l.id))
          .map((l) => ({
            id: l.id,
            francs: montantDu({ debit: Number(l.debit), credit: Number(l.credit) }, dto.sens),
            montantDevise: Number(l.montantDevise),
            date: l.ecriture.date,
          }));
        fileDuCout = [...file, ...horsDuGroupe];
      }
      if (referentiel === null) referentiel = await referentielDuDossier(this.prisma, tenantId);
      const enDevise = await this.preparerEnDevise(
        tenantId,
        dto.exerciceId,
        referentiel,
        dto.sens,
        p.r,
        numero,
        p.siennes,
        [...(paires?.absorbees ?? [])],
        fileDuCout,
      );
      prepares.push({ r: p.r, compte: p.compte, du: p.du, montant: enDevise.francsPayes, enDevise, reduite: p.reduite, parts: null, groupe: p.groupe });
    }

    // LA DEVISE DU MOYEN DE PAIEMENT (ligne A6) · déclarée, jamais prise sur
    // la facture, et confrontée au lot et au RIB du journal avant la
    // première pièce (`motifRefusTresorerieEnDevise`). TOUJOURS confrontée
    // (A6 bis, B3) · un lot tout en francs n'y échappait pas moins à la
    // règle quand le RIB du journal est tenu en devise.
    {
      const idsDevises = [
        ...new Set([...prepares.flatMap((x) => (x.enDevise ? [x.enDevise.deviseId] : [])), ...(dto.deviseTresorerieId ? [dto.deviseTresorerieId] : [])]),
      ];
      const devisesLues = idsDevises.length
        ? await this.prisma.devise.findMany({ where: { tenantId, id: { in: idsDevises } }, select: { id: true, code: true } })
        : [];
      const code = (id: string) => devisesLues.find((d) => d.id === id)?.code ?? '?';
      if (dto.deviseTresorerieId !== undefined && !devisesLues.some((d) => d.id === dto.deviseTresorerieId)) {
        throw new NotFoundException('Devise du moyen de paiement introuvable pour ce dossier.');
      }
      if (dto.deviseTresorerieId !== undefined && dto.tresorerieEnDevise !== true) {
        throw new BadRequestException('Une devise de moyen de paiement ne se déclare qu’avec « Moyen de paiement en devise ».');
      }
      const rib = await this.prisma.ribBanque.findFirst({ where: { tenantId, journalId: journal.id }, select: { devise: true } });
      const motif = motifRefusTresorerieEnDevise({
        tresorerieEnDevise: dto.tresorerieEnDevise === true,
        devisesDuLot: prepares.map((x) => (x.enDevise ? { id: x.enDevise.deviseId, code: code(x.enDevise.deviseId) } : null)),
        deviseTresorerie: dto.deviseTresorerieId ? { id: dto.deviseTresorerieId, code: code(dto.deviseTresorerieId) } : null,
        deviseRib: rib?.devise ?? null,
        monnaieDeTenue: MONNAIE_DE_TENUE,
        journalCode: journal.code,
      });
      if (motif) throw new BadRequestException(motif);
    }

    // UNE FACTURE DÉJÀ RÉÉVALUÉE NE SE RÈGLE PAS EN PASSANT SON RÉALISÉ
    // (relecture adverse, bloquant 1) · la réévaluation de l'exercice qui l'a
    // lue a porté son écart au 478 et en provision ; le 656 du règlement
    // recompterait la perte. Refus avant la première pièce.
    const avertissements: string[] = [...avertissementsPaires, ...avertissementsImputation];
    // A7 ter, mineur 1 · le compte d'une créance reclassée en vigueur se dit ·
    // son encaissement est le « Recouvrement » du module. Second tour, m-d ·
    // le règlement se BORNE au solde net du compte (toutes ses lignes de
    // l'exercice), refus nommé au-delà, avant la première pièce.
    for (const c of dto.sens === 'CLIENT' ? await this.creancesReclasseesDesComptes(tenantId, idsComptes) : []) {
      const x = prepares.find((p) => p.r.compteId === c.compteId);
      if (!x) continue;
      const s = await this.prisma.ligneEcriture.aggregate({
        where: { compteId: c.compteId, ecriture: { tenantId, exerciceId: dto.exerciceId } },
        _sum: { debit: true, credit: true },
      });
      const net = Number(s._sum.debit ?? 0) - Number(s._sum.credit ?? 0);
      const refus = motifReglementAuDelaDuNet(x.compte.numero, c.compte416, c.date, net, x.montant);
      if (refus) throw new BadRequestException(refus);
      avertissements.push(avertissementCreanceReclassee(x.compte.numero, c.compte416, c.date));
    }
    for (const x of prepares) {
      if (!x.enDevise) continue;
      if (x.enDevise.avertissement) avertissements.push(x.enDevise.avertissement);
      const motif = await motifReglementDejaReevalue(this.prisma, {
        tenantId,
        exerciceId: dto.exerciceId,
        compteId: x.r.compteId,
        compteNumero: x.compte.numero,
        ligneIds: x.r.ligneIds,
      });
      if (motif) throw new ConflictException(motif);
      const avertissement = await avertissementExtourneManquante(this.prisma, {
        tenantId,
        exerciceId: dto.exerciceId,
        compteId: x.r.compteId,
        compteNumero: x.compte.numero,
        ligneIds: x.r.ligneIds,
      });
      if (avertissement) avertissements.push(avertissement);
    }

    // Le lettrage vient APRÈS la pièce · une facture figée par une clôture
    // (exercice/gel-cloture.ts) le ferait refuser une fois la pièce passée.
    // Vérifiée ici, avec le reste, avant la première écriture.
    // Un lettrage partiel complété l'est sur toutes ses lignes · elles se
    // vérifient avec les factures (ligne lettrage-cloture).
    await refuserSiLignesFigees(this.prisma, tenantId, [...new Set([...toutesLignes, ...prepares.flatMap((x) => x.groupe?.lignes ?? [])])], 'régler');

    // L'ORDRE DE VIREMENT se prépare ICI, avec le reste · un tiers sans RIB
    // découvert après la cinquième pièce laisserait cinq règlements passés
    // sans l'ordre qui devait les exécuter. Un virement PAIE un fournisseur ·
    // l'encaissement d'un client ne s'ordonne pas à sa banque.
    let preparation = null;
    if (dto.ordreVirement) {
      if (dto.sens !== 'FOURNISSEUR') {
        throw new BadRequestException("Un ordre de virement paie un fournisseur · l'encaissement d'un client ne s'ordonne pas.");
      }
      preparation = await this.ordres.preparer(tenantId, dto.journalId, idsComptes);
    }

    const resultats = [];
    const aOrdonner: LigneAOrdonner[] = [];
    for (const { r, compte, du, montant, enDevise, reduite, parts, groupe } of prepares) {
      const libelle = `Règlement ${compte.tiersCompte?.tiers.nom ?? compte.intitule}`.slice(0, 190);
      const ecriture = await this.ecritures.creer(tenantId, userId, {
        exerciceId: dto.exerciceId,
        journalId: dto.journalId,
        date: dto.date,
        libelle,
        // La pièce qui a notifié l'imputation au fournisseur (M6) suit la
        // référence du règlement, et se lit sur la pièce comptable.
        reference: [r.reference, parts && r.pieceImputation ? `imputation notifiée · ${r.pieceImputation.trim()}` : null].filter(Boolean).join(' · ') || undefined,
        lignes: enDevise
          ? lignesDuReglementEnDevise({
              sens: dto.sens,
              compteTiersId: r.compteId,
              compteTresorerieId,
              compteEcartId: enDevise.compteEcartId,
              historique: enDevise.historique,
              francsPayes: enDevise.francsPayes,
              deviseId: enDevise.deviseId,
              montantDevise: enDevise.montantDevise,
              coursReglement: enDevise.coursReglement,
              tresorerieEnDevise: dto.tresorerieEnDevise === true,
              libelle,
            })
          : parts
            ? lignesDuReglementImpute({ compteTiersId: r.compteId, compteTresorerieId, parts, libelle })
            : lignesDuReglement({ sens: dto.sens, compteTiersId: r.compteId, compteTresorerieId, montant, libelle }),
      });
      if (parts) {
        // UNE FACTURE, UNE LIGNE QUI LA PAIE, UN GROUPE · l'imputation
        // désignée par le dossier (art. 151) devient le lettrage même, et le
        // moteur de la TVA date chaque déduction sans imputer. Un lettrage
        // refusé défait les groupes déjà posés et retire la pièce (F56).
        const poses: string[] = [];
        try {
          for (const part of parts) {
            const ligneTiersPart = ecriture.lignes.find((l) => l.compteId === r.compteId && l.libelle === part.libelle);
            if (!ligneTiersPart) throw new ConflictException(`La ligne du règlement de « ${part.libelle} » est introuvable dans sa pièce.`);
            const l = await this.lettrage.lettrerManuel(tenantId, r.compteId, [part.ligneId, ligneTiersPart.id], userId, {
              autoriserPartiel: Math.round(part.montant * 100) < Math.round(part.du * 100),
            });
            poses.push(l.lettre);
          }
        } catch (e) {
          // Le nettoyage manqué est CONSIGNÉ avec l'identifiant de la pièce, et
          // l'erreur d'origine remonte toujours · jamais l'une pour l'autre.
          try {
            for (const code of poses) await this.lettrage.delettrer(tenantId, r.compteId, code);
            await this.ecritures.retirerCompensation(tenantId, ecriture.id);
          } catch (nettoyage) {
            this.journalServeur.error(
              `Règlement ${ecriture.id} du dossier ${tenantId} resté au brouillard avec ${poses.length} lettrage(s) · son retrait après l'échec du lettrage a échoué`,
              nettoyage instanceof Error ? nettoyage.stack : String(nettoyage),
            );
          }
          throw e;
        }
        resultats.push({ compte: compte.numero, ecritureId: ecriture.id, montant, partiel: Math.round(montant * 100) < Math.round(du * 100), lettre: poses.join(', ') });
        aOrdonner.push({
          compteId: r.compteId,
          montant,
          reference: r.reference || null,
          ecritureId: ecriture.id,
          pieceReglement: [journal.code, ecriture.numeroPiece].filter((v) => v !== null && v !== undefined).join(' '),
          // L'ordre IMPRIME l'imputation déclarée (art. 151, M6).
          imputationDeclaree: imputationImprimee(parts),
        });
        continue;
      }
      const ligneTiers = ecriture.lignes.find((l) => l.compteId === r.compteId)!;
      if (groupe) {
        // LE RÈGLEMENT COMPLÈTE LE LETTRAGE PARTIEL (ligne lettrage-cloture) ·
        // les autres factures choisies et la ligne du tiers y entrent, et le
        // groupe passe SOLDÉ quand le reste est réglé. En devise, le réalisé
        // du règlement s'ajoute à celui que le groupe garde (A6, `ecartCumule`).
        let complete: Awaited<ReturnType<LettrageService['completer']>>;
        try {
          complete = await this.lettrage.completer(tenantId, groupe.id, [...r.ligneIds.filter((id) => !groupe.lignes.includes(id)), ligneTiers.id], {
            ...(enDevise ? { ecartChangeRealise: enDevise.ecart } : {}),
            // M1 · le reste lu ici se relit dans la transaction du lettrage ·
            // dans sa DEVISE pour un règlement en devise (relecture TypeScript
            // du second tour, bloquant 1), l'écart en francs restant à l'écart
            // proposé au groupe soldé dans sa devise.
            borne: {
              soldeAttendu: groupe.solde,
              sensDesFactures: dto.sens === 'CLIENT' ? 'DEBIT' : 'CREDIT',
              deviseId: enDevise ? enDevise.deviseId : null,
            },
          });
        } catch (e) {
          // Mineur 9 · un retrait manqué est CONSIGNÉ, et l'erreur d'origine
          // remonte (même règle que la voie des parts).
          try {
            await this.ecritures.retirerCompensation(tenantId, ecriture.id);
          } catch (nettoyage) {
            this.journalServeur.error(
              `Règlement ${ecriture.id} du dossier ${tenantId} resté au brouillard · le lettrage partiel ${groupe.code} n'a pas été complété et son retrait a échoué`,
              nettoyage instanceof Error ? nettoyage.stack : String(nettoyage),
            );
          }
          throw e;
        }
        resultats.push({
          compte: compte.numero,
          ecritureId: ecriture.id,
          montant,
          partiel: complete.statut !== StatutLettrage.SOLDE,
          lettre: complete.lettre,
          ...(enDevise ? { montantDevise: enDevise.montantDevise, ecartChange: enDevise.ecart } : {}),
        });
        aOrdonner.push({
          compteId: r.compteId,
          montant,
          reference: r.reference || null,
          ecritureId: ecriture.id,
          pieceReglement: [journal.code, ecriture.numeroPiece].filter((v) => v !== null && v !== undefined).join(' '),
        });
        continue;
      }
      // En devise, le partiel se lit DANS LA DEVISE · la contrevaleur payée au
      // cours du jour peut dépasser le dû en francs sans solder la facture.
      // Une ligne d'à-nouveau réglée en partie par une paire garde son montant
      // entier · son lettrage avec ce règlement reste partiel (m1).
      const partiel = (enDevise ? enDevise.partiel : Math.round(montant * 100) < Math.round(du * 100)) || reduite;
      // Un lettrage refusé malgré tout (une facture lettrée entre-temps par un
      // autre clic) retire la pièce qu'il devait accompagner · jamais un
      // règlement sans le lettrage qui dit ce qu'il a payé (audit final F56).
      let lettre: Awaited<ReturnType<LettrageService['lettrerManuel']>>;
      try {
        lettre = await this.lettrage.lettrerManuel(tenantId, r.compteId, [...r.ligneIds, ligneTiers.id], userId, {
          autoriserPartiel: partiel,
          // Le tiers est soldé au coût historique · l'écart réalisé est sur
          // sa propre ligne, hors du compte du tiers, et le groupe le garde,
          // partiel compris · le solde passé ensuite s'y AJOUTE, et le groupe
          // soldé porte le réalisé TOTAL (42 000 + 123 200 au séminaire).
          ...(enDevise ? { ecartChangeRealise: enDevise.ecart } : {}),
        });
      } catch (e) {
        await this.ecritures.retirerCompensation(tenantId, ecriture.id);
        throw e;
      }
      resultats.push({
        compte: compte.numero,
        ecritureId: ecriture.id,
        montant,
        partiel,
        lettre: lettre.lettre,
        ...(enDevise ? { montantDevise: enDevise.montantDevise, ecartChange: enDevise.ecart } : {}),
      });
      aOrdonner.push({
        compteId: r.compteId,
        montant,
        reference: r.reference || null,
        ecritureId: ecriture.id,
        pieceReglement: [journal.code, ecriture.numeroPiece].filter((v) => v !== null && v !== undefined).join(' '),
      });
    }
    const ordre = preparation
      ? await this.ordres.creer(tenantId, email, dto.journalId, dto.date, preparation, aOrdonner)
      : null;
    return { reglements: resultats, ordre, avertissements };
  }

  /**
   * UN RÈGLEMENT EN DEVISE, vérifié et chiffré avant toute pièce (ligne A6,
   * règles dans ecart-change-realise.ts). Une seule devise, des factures
   * toutes en devise et toutes dans le sens de l'échéance, le cours du jour
   * du règlement fourni, jamais plus que le dû DANS LA DEVISE.
   */
  private async preparerEnDevise(
    tenantId: string,
    exerciceId: string,
    referentiel: Referentiel,
    sens: SensReglement,
    r: ReglementTiersDto,
    numero: string,
    siennes: Array<{
      id: string;
      debit: unknown;
      credit: unknown;
      deviseId?: string | null;
      montantDevise?: unknown;
      ecriture: { date?: Date; estANouveauProvisoire?: boolean; estGenereeParCloture?: boolean; estSoldeDesComptesDeGestion?: boolean };
    }>,
    // Les lignes qu'une paire à cheval éteint (m1) · ni dues, ni reportées.
    eteintes: string[] = [],
    // Les factures sur lesquelles se calcule le coût historique · celles du
    // lettrage partiel que le règlement complète, dans l'ordre d'inscription
    // (`fileDuGroupeEnDevise`) ; à défaut, les factures choisies.
    fileDuCout: FactureEnDevise[] | null = null,
  ): Promise<ReglementEnDevise> {
    if (siennes.some((l) => (l.deviseId ?? null) === null)) {
      throw new BadRequestException(
        `${numero} · des factures en francs et des factures en devise ne se règlent pas dans la même pièce · réglez-les séparément.`,
      );
    }
    const devises = new Set(siennes.map((l) => l.deviseId));
    if (devises.size !== 1) {
      throw new BadRequestException(`${numero} · les factures choisies sont en plusieurs devises · une pièce par devise.`);
    }
    const factures = siennes.map((l) => ({
      id: l.id,
      francs: montantDu({ debit: Number(l.debit), credit: Number(l.credit) }, sens),
      montantDevise: Number(l.montantDevise),
      date: l.ecriture.date ?? new Date(0),
    }));
    if (factures.some((f) => !(f.francs > 0) || !(f.montantDevise > 0))) {
      throw new BadRequestException(
        `${numero} · un avoir en devise ne se règle pas ici · lettrez-le avec sa facture depuis Interrogation et lettrage.`,
      );
    }
    // DES FRANCS SANS LEUR DEVISE NE DISENT PAS CE QUI EST RÉGLÉ (relecture
    // adverse, mineur 2) · le dû entier en devise serait présumé, et un
    // acompte en francs solderait la facture avec un gain absurde.
    if (r.montant !== undefined && r.montantDevise === undefined) {
      throw new BadRequestException(
        `${numero} · le montant payé en francs ne dit pas ce qu'il règle d'une facture en devise · saisissez aussi le montant réglé en devise.`,
      );
    }
    const duDevise = Math.round(factures.reduce((s, f) => s + f.montantDevise, 0) * 100) / 100;
    const montantDevise = r.montantDevise === undefined ? duDevise : r.montantDevise;
    if (Math.round(montantDevise * 100) > Math.round(duDevise * 100)) {
      throw new BadRequestException(
        `${numero} · le montant réglé (${montantDevise.toFixed(2)}) dépasse le dû en devise des factures choisies ` +
          `(${duDevise.toFixed(2)}) · l'excédent est une avance ou un trop-perçu, à comptabiliser à part.`,
      );
    }
    // LE RESTE DÛ D'UNE FACTURE REPORTÉE, ACOMPTES DE N COMPRIS (A6 bis,
    // M6, vérifié) · un lettrage PARTIEL de N passe au report Détail ligne à
    // ligne, la facture ENTIÈRE d'un côté, le règlement partiel de l'autre
    // (`exercice/report-a-nouveau.ts`, aucune des deux n'a de lettre) · en
    // N+1 la ligne d'à-nouveau de la facture ressortait due en entier, et
    // 1 160 USD se payaient sur 560 dus (le tiers soldé à tort, l'écart
    // réalisé calculé sur 600 USD déjà réglés). AUCUN LIEN ne relie la ligne
    // d'à-nouveau à sa facture d'origine · la borne est PROTECTRICE et ne
    // vise que les lignes CHOISIES qui sont elles-mêmes des à-nouveaux, contre
    // LEUR part du dû · les règlements, acomptes et avoirs reportés par
    // l'à-nouveau dans la devise, hors de tout groupe, s'en retranchent. Une
    // facture de l'exercice n'en est jamais bornée (premier tour de
    // relecture). La colonne du RÈGLEMENT les dit (débit pour un fournisseur,
    // crédit pour un client), signe compris · une ligne inscrite en négatif
    // (art. 20) annule celle qu'elle contre-passe, et le montant en devise
    // est stocké SANS signe (`lignesEnNegatif`).
    //
    // RIEN D'AUTRE NE BORNE (premier tour) · un règlement, un acompte ou un
    // avoir non lettré passé DANS l'exercice ne dit pas à quelle facture il
    // revient, et le compte du fournisseur est aussi « débité des avances et
    // acomptes versés » (fiche du compte 40) · la borne au reste dû du compte
    // refusait de régler une facture à côté d'une avance ou d'un avoir qui ne
    // la concernait pas. Le règlement se borne au dû des factures choisies
    // dans LEUR devise (plus haut), l'avoir se lettre à part.
    const deviseId = [...devises][0]!;
    const duReporte = Math.round(siennes.filter((l) => estDAnouveau(l.ecriture)).reduce((t, l) => t + Number(l.montantDevise), 0) * 100) / 100;
    let avertissement: string | null = null;
    if (duReporte > 0) {
      const aNouveauNonLettre = {
        compteId: r.compteId,
        id: { notIn: [...r.ligneIds, ...eteintes] },
        lettrageId: null,
        ecriture: {
          tenantId,
          exerciceId,
          OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }],
        },
      } satisfies Prisma.LigneEcritureWhereInput;
      const reportees = { ...aNouveauNonLettre, deviseId } satisfies Prisma.LigneEcritureWhereInput;
      // Les règlements reportés SANS DEVISE (A6 bis, second tour, m4) · un
      // règlement d'avant la tenue en devise (avant A6) n'a que des francs, et
      // la borne, qui compte dans la devise, ne peut pas dire ce qu'il règle.
      // L'ÉCART D'UNE RÉÉVALUATION REPORTÉ (A6 ter, m-2) n'est pas un
      // règlement · il porte sur le compte du tiers sans devise et passe au
      // report ; reconnu par la liaison de la réévaluation, il sort de ces francs.
      const exerciceLu = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true } });
      const ecartsReportes = exerciceLu
        ? await lignesDeReevaluationSurLesTiers(this.prisma, { tenantId, exercice: exerciceLu, compteIds: [r.compteId] })
        : new Set<string>();
      const enFrancs = {
        ...aNouveauNonLettre,
        id: { notIn: [...r.ligneIds, ...eteintes, ...ecartsReportes] },
        deviseId: null,
      } satisfies Prisma.LigneEcritureWhereInput;
      const colonne = (signe: 'gt' | 'lt') => (sens === 'FOURNISSEUR' ? { debit: { [signe]: 0 } } : { credit: { [signe]: 0 } });
      const colonneFrancs = sens === 'FOURNISSEUR' ? ('debit' as const) : ('credit' as const);
      const [positives, negatives, francsPositifs, francsNegatifs] = await Promise.all([
        this.prisma.ligneEcriture.aggregate({ where: { ...reportees, ...colonne('gt') }, _sum: { montantDevise: true } }),
        this.prisma.ligneEcriture.aggregate({ where: { ...reportees, ...colonne('lt') }, _sum: { montantDevise: true } }),
        this.prisma.ligneEcriture.aggregate({ where: { ...enFrancs, ...colonne('gt') }, _sum: { [colonneFrancs]: true } }),
        this.prisma.ligneEcriture.aggregate({ where: { ...enFrancs, ...colonne('lt') }, _sum: { [colonneFrancs]: true } }),
      ]);
      const reglesAuReport = Math.round((Number(positives._sum.montantDevise ?? 0) - Number(negatives._sum.montantDevise ?? 0)) * 100) / 100;
      const sommeFrancs = (a: { _sum: Record<string, unknown> }) => Number(a._sum[colonneFrancs] ?? 0);
      const reglesEnFrancs = Math.round((sommeFrancs(francsPositifs) + sommeFrancs(francsNegatifs)) * 100) / 100;
      const resteReporte = Math.max(0, Math.round((duReporte - Math.max(0, reglesAuReport)) * 100) / 100);
      const plafond = Math.round((duDevise - duReporte + resteReporte) * 100) / 100;
      if (Math.round(montantDevise * 100) > Math.round(plafond * 100)) {
        // L'ISSUE QUI RESTE EST NOMMÉE (second tour, m5) · régler le reste
        // ici, ou saisir le règlement au journal de trésorerie et le lettrer
        // à la main avec la facture qu'il solde.
        throw new BadRequestException(
          `${numero} · ${reglesAuReport.toFixed(2)} dans la devise des factures choisies sont déjà réglés au report à-nouveau de ce compte, ` +
            "hors de tout lettrage · le report Détail reprend ENTIÈRE une facture payée en partie l'exercice précédent, et son règlement à part. " +
            // L'ORDRE DES ISSUES (A6 ter, m-3) · le lettrage d'abord · un
            // règlement reporté qui revient à une autre facture, lu avant
            // « réglez au plus », ferait payer moins que le dû de la bonne.
            "Si ces règlements reportés reviennent à une autre facture que celles choisies, lettrez-les d'abord avec leur facture " +
            `(Interrogation et lettrage). Sinon, les lignes d'à-nouveau choisies ne doivent plus que ${resteReporte.toFixed(2)} · ` +
            `réglez au plus ${plafond.toFixed(2)}, puis complétez le lettrage de la facture avec ces lignes d'à-nouveau (Interrogation et lettrage). ` +
            "Pour payer autrement, saisissez le règlement au journal de trésorerie, puis lettrez-le à la main " +
            "avec la facture qu'il solde (Interrogation et lettrage).",
        );
      }
      if (reglesEnFrancs > 0) {
        avertissement =
          `${numero} · ${reglesEnFrancs.toFixed(2)} en francs, sans devise, sont reportés à l'à-nouveau de ce compte hors de tout lettrage ` +
          "(un règlement d'avant la tenue en devise) · ils peuvent régler une part des factures en devise choisies, que la borne du reste dû " +
          "ne lit pas. Vérifiez le reste dû au fournisseur ou au client avant de payer, et lettrez ce règlement avec sa facture.";
      }
    }
    // Le débit RÉEL saisi en francs prime, le cours s'en déduit · même règle
    // que toute ligne en devise (comptabilite/ligne-en-devise.ts).
    const lu = coursEtFrancsDuReglement({
      montantDevise,
      cours: r.coursReglement,
      francs: r.montant,
      tolerance: contrevaleurAdmise,
    });
    if ('motif' in lu) throw new BadRequestException(`${numero} · ${lu.motif}`);
    const francsPayes = lu.francs;
    const historique = coutHistoriqueRegle(fileDuCout ?? factures, montantDevise);
    const ecart = ecartSigne(sens, historique, francsPayes);
    const compteEcart =
      ecart === 0
        ? null
        : await compteDeLEcart(this.prisma, {
            tenantId,
            referentiel,
            nature: natureDuCompte(numero, referentiel),
            ecart: ecart > 0 ? 'PERTE' : 'GAIN',
            choisiId: r.compteEcartChangeId,
          });
    return {
      deviseId,
      montantDevise,
      coursReglement: lu.cours,
      francsPayes,
      historique,
      ecart,
      compteEcartId: compteEcart?.id ?? null,
      partiel: Math.round(montantDevise * 100) < Math.round(duDevise * 100),
      avertissement,
    };
  }

  /**
   * PASSER L'ÉCART DE CHANGE d'un lettrage soldé dans sa devise et non en
   * francs (ligne A6) · la proposition est REJOUÉE ici depuis le groupe,
   * jamais reçue du client, puis la ligne du tiers complète le lettrage, qui
   * passe SOLDE. Rien n'est posté sans ce geste · le lettrage PROPOSE
   * (`LettrageService.propositionEcartChange`), le comptable confirme.
   *
   * UN GROUPE FIGÉ REÇOIT SON ÉCART (A6 bis, second tour, B2) · le groupe
   * qu'une clôture de période, de journal ou d'exercice a figé, à cheval de
   * deux exercices ou non, ne se complétait plus, et l'écriture manuelle que
   * le contrôle prescrivait ne pouvait pas y entrer · l'avertissement ne
   * s'éteignait jamais, et dans l'exercice suivant l'à-nouveau et le
   * règlement d'un groupe resté partiel entraient dans la position
   * réévaluée, le réalisé provisionné une seconde fois (AUDCIF art. 55 · le
   * gel est une convention de Sage i7, l'article ne connaît que la date du
   * règlement). La ligne du tiers de l'écart complète le groupe sous la
   * tolérance nommée de `completer` (`groupeTolere`) · elle seule doit être
   * libre, aucune ligne figée n'est déplacée. Le dénouement daté dans une
   * période close s'enregistre, sur demande, au premier jour non clôturé,
   * sa date de valeur gardée (art. 22, 4°, `reporterAuPremierJourOuvert`).
   */
  async passerEcartChange(tenantId: string, userId: string, dto: PasserEcartChangeDto) {
    const proposition = await this.lettrage.propositionEcartChange(tenantId, dto.lettrageId);
    if (proposition.ecart === null || proposition.ecart === 0) {
      throw new BadRequestException(proposition.motif ?? "Ce lettrage n'a aucun écart de change à passer.");
    }
    // LA DATE ET L'EXERCICE DU DÉNOUEMENT (ch. 22 § 2.3, « à la date
    // d'encaissement ou de règlement ») · l'écart appartient à l'exercice où
    // la position s'est dénouée, et ne se constate pas avant elle. Passé
    // ailleurs, le résultat d'un exercice porterait la perte d'un autre.
    if (dto.exerciceId !== proposition.exerciceId) {
      throw new BadRequestException(
        `L'écart de change de ce lettrage s'est réalisé dans l'exercice de son dernier règlement · passez-le dans cet exercice (AUDCIF, Titre VIII ch. 22 § 2.3).`,
      );
    }
    const dateDenouement = new Date(proposition.date!).toISOString().slice(0, 10);
    if (dto.date.slice(0, 10) < dateDenouement) {
      throw new BadRequestException(
        `L'écart de change se constate à la date du règlement qui dénoue la position, le ${dateDenouement}, ou après · ` +
          `pas le ${dto.date.slice(0, 10)} (AUDCIF, Titre VIII ch. 22 § 2.3).`,
      );
    }
    const journal = await this.prisma.journal.findFirst({ where: { id: dto.journalId, tenantId } });
    if (!journal) throw new NotFoundException('Journal introuvable pour ce dossier.');
    if (journal.type === TypeJournal.TRESORERIE) {
      throw new BadRequestException(
        `Le journal ${journal.code} est un journal de trésorerie · l'écart de change réalisé ne mouvemente aucune trésorerie, ` +
          "il se passe au journal des opérations diverses.",
      );
    }
    const referentiel = await referentielDuDossier(this.prisma, tenantId);
    const compteEcart = await compteDeLEcart(this.prisma, {
      tenantId,
      referentiel,
      nature: natureDuCompte(proposition.compteNumero, referentiel),
      ecart: proposition.ecart > 0 ? 'PERTE' : 'GAIN',
      choisiId: dto.compteEcartChangeId,
    });
    // PAS DEUX FOIS LA MÊME PERTE (relecture adverse B1) · une réévaluation
    // qui a déjà lu ces lignes les a portées au 478 ou 479 et en provision.
    // Refus seulement si la réévaluation concorde avec le groupe LU ;
    // inexplicable, l'écart passe avec un avertissement, jamais un faux 409.
    const dejaReevalue = await issueReevaluationDejaPassee(this.prisma, {
      tenantId,
      exerciceId: proposition.exerciceId!,
      compteId: proposition.compteId,
      compteNumero: proposition.compteNumero,
      lettrageId: dto.lettrageId,
    });
    if (dejaReevalue && 'refus' in dejaReevalue) throw new ConflictException(dejaReevalue.refus);
    // L'à-nouveau du groupe, si la réévaluation de l'exercice précédent n'a
    // pas été contre-passée (cinquième relecture, M-C) · un avertissement.
    const lignesDuGroupe = await this.prisma.ligneEcriture.findMany({
      where: { lettrageId: dto.lettrageId, ecriture: { tenantId } },
      select: { id: true },
    });
    const extourne = await avertissementExtourneManquante(this.prisma, {
      tenantId,
      exerciceId: proposition.exerciceId!,
      compteId: proposition.compteId,
      compteNumero: proposition.compteNumero,
      ligneIds: lignesDuGroupe.map((l) => l.id),
    });
    const avertissement =
      [dejaReevalue && 'avertissement' in dejaReevalue ? dejaReevalue.avertissement : null, extourne].filter((x): x is string => x !== null).join(' ') ||
      null;
    const libelle = `${libelleEcartRealise(proposition.ecart)} · ${proposition.compteNumero} ${proposition.code}`;
    const ecriture = await this.ecritures.creer(tenantId, userId, {
      exerciceId: dto.exerciceId,
      journalId: dto.journalId,
      date: dto.date,
      libelle,
      ...(dto.reporterAuPremierJourOuvert === true ? { reporterAuPremierJourOuvert: true } : {}),
      lignes: lignesEcartDuGroupe({
        compteTiersId: proposition.compteId,
        compteEcartId: compteEcart.id,
        ecart: proposition.ecart,
        libelle,
      }),
    });
    const ligneTiers = ecriture.lignes.find((l) => l.compteId === proposition.compteId)!;
    let lettre: Awaited<ReturnType<LettrageService['completer']>>;
    try {
      lettre = await this.lettrage.completer(tenantId, dto.lettrageId, [ligneTiers.id], { groupeTolere: dto.lettrageId });
    } catch (e) {
      await this.ecritures.retirerCompensation(tenantId, ecriture.id);
      throw e;
    }
    // L'ÉCART SOLDE LE GROUPE, OU IL N'EST PAS PASSÉ · un groupe resté
    // partiel (une ligne ajoutée ou retirée entre la proposition et le clic)
    // garderait un écart passé sur une position qui n'est plus celle mesurée.
    if (lettre.statut !== StatutLettrage.SOLDE) {
      // Le groupe reprend son reste SANS la ligne retirée, dans la même
      // transaction que le retrait de la pièce.
      await this.ecritures.retirerCompensation(tenantId, ecriture.id, async (tx) => {
        await tx.ligneEcriture.updateMany({ where: { ecritureId: ecriture.id }, data: { lettrageId: null } });
        const restes = await tx.ligneEcriture.findMany({ where: { lettrageId: dto.lettrageId }, select: { debit: true, credit: true } });
        const reste = Math.round(restes.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0) * 100) / 100;
        await tx.lettrage.updateMany({ where: { id: dto.lettrageId, tenantId }, data: { solde: reste } });
      });
      throw new ConflictException(
        `Le lettrage ${proposition.code} n'est pas soldé par cet écart (reste ${Number(lettre.solde).toFixed(2)}) · ` +
          "il a changé depuis la proposition. Relisez l'écart proposé.",
      );
    }
    return {
      ecritureId: ecriture.id,
      ecart: proposition.ecart,
      compte: compteEcart.numero,
      lettre: lettre.lettre,
      statut: lettre.statut,
      // Reportée au premier jour non clôturé (art. 22, 4°) · la date posée
      // et la date de valeur, que l'écran dit.
      date: ecriture.date,
      dateValeur: ecriture.dateValeur ?? null,
      avertissement,
    };
  }
}

/** Ce que le règlement en devise a vérifié et chiffré avant la pièce. */
interface ReglementEnDevise {
  deviseId: string;
  montantDevise: number;
  coursReglement: number;
  francsPayes: number;
  historique: number;
  /** Signé · positif pour une perte, négatif pour un gain. */
  ecart: number;
  compteEcartId: string | null;
  partiel: boolean;
  /** Un avertissement qui n'arrête rien (second tour, m4). */
  avertissement: string | null;
}

/**
 * Le refus d'une ligne d'à-nouveau PROVISOIRE au règlement des tiers (A6 bis,
 * second tour, m6) · lettrée, elle empêcherait de remplacer l'à-nouveau à la
 * clôture de l'exercice précédent, qui refuse un report provisoire lettré.
 */
export function motifANouveauProvisoire(numero: string): string {
  return (
    `${numero} · la ligne d'à-nouveau choisie est PROVISOIRE, l'exercice précédent n'étant pas clôturé · lettrée par ce règlement, ` +
    "elle ferait refuser la clôture de cet exercice, qui remplace l'à-nouveau provisoire. Attendez sa clôture, ou saisissez le règlement " +
    "au journal de trésorerie et lettrez-le avec la ligne d'à-nouveau définitif une fois l'exercice clôturé."
  );
}

/** Une écriture d'à-nouveau · le report provisoire, ou celui de la clôture hors solde des comptes de gestion. */
function estDAnouveau(e: { estANouveauProvisoire?: boolean; estGenereeParCloture?: boolean; estSoldeDesComptesDeGestion?: boolean }): boolean {
  return e.estANouveauProvisoire === true || (e.estGenereeParCloture === true && e.estSoldeDesComptesDeGestion !== true);
}

/**
 * Les montants DUS d'une ligne · ceux de la ligne, ou le reste qu'une paire à
 * cheval lui laisse (`lettrage/paires-a-cheval.ts`, A6 bis, second tour, m1).
 */
function ligneDue<L extends { id: string; debit: unknown; credit: unknown; montantDevise?: unknown }>(
  l: L,
  paires: PairesACheval | null,
  // Le reste d'une facture d'un lettrage partiel (ligne lettrage-cloture) ·
  // positif, dans le sens du règlement.
  partiels: Map<string, { sens: SensReglement; reste: ResteDeFacture }> | null = null,
): { debit: unknown; credit: unknown; montantDevise: unknown } {
  const partiel = partiels?.get(l.id);
  if (partiel) {
    return {
      debit: partiel.sens === 'CLIENT' ? partiel.reste.francs : 0,
      credit: partiel.sens === 'FOURNISSEUR' ? partiel.reste.francs : 0,
      montantDevise: partiel.reste.devise ?? l.montantDevise ?? null,
    };
  }
  const reste = paires?.reste.get(l.id);
  if (!reste) return { debit: l.debit, credit: l.credit, montantDevise: l.montantDevise ?? null };
  return {
    debit: reste.francs > 0 ? reste.francs : 0,
    credit: reste.francs < 0 ? -reste.francs : 0,
    montantDevise: reste.devise ?? l.montantDevise ?? null,
  };
}
