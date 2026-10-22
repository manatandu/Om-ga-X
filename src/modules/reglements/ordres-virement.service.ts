import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutOrdreVirement } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import {
  coordonneesImprimees,
  deviseDuDonneur,
  motifRefusAnnulation,
  motifRefusDeviseDonneur,
  motifRefusImpression,
  motifRefusLignesHorsDeviseDonneur,
  type LigneReglee,
} from '../tiers/ribs-tiers';
import { estVise, refusOrdreRibsNonVises } from '../tiers/visa-rib';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { jourDeKinshasa } from '../../common/echeance';
import { identiteSociete, mentionsEmetteur } from '../tenant/mentions-societe';
import { cadresDesTiers } from '../tiers/modeles-impression.service';
import { habiller } from '../tiers/modeles-impression';
import { CADRE_AVIS_PAR_DEFAUT, documentAvisReglement, motifRefusAvis } from './avis-reglement';

/**
 * Ce que l'ordre recopie · le donneur (le RIB du journal) et un bénéficiaire
 * par compte réglé (un tiers) ou par salarié payé (ligne sage-l5, fonction 75).
 * La clé est le compte réglé pour un tiers, le salarié pour un salaire.
 */
export interface PreparationOrdre {
  /**
   * `devise` · la monnaie dans laquelle la banque exécute l'ordre, lue sur le
   * RIB du journal (ligne sage-l3, fonction 37, décision D1) · `null` pour la
   * monnaie de tenue. Un ordre de SALAIRES est toujours en francs.
   */
  donneur: { banque: string; coordonnees: string; codeBic: string | null; devise: string | null };
  beneficiaires: Map<
    string,
    { tiersId: string | null; salarieId: string | null; beneficiaire: string; banque: string; coordonnees: string; codeBic: string | null }
  >;
}

export interface LigneAOrdonner {
  /** Le compte réglé (Règlement des tiers) · ou `salarieId` pour un salaire. */
  compteId?: string;
  salarieId?: string;
  /** La contrevaleur en francs de la pièce de règlement, toujours servie. */
  montant: number;
  /**
   * Le montant que la banque exécute quand le donneur est tenu en devise
   * (ligne sage-l3, fonction 37) · celui de la ligne en devise de la pièce
   * (F49). `null` ou absent pour un règlement en francs.
   */
  montantDevise?: number | null;
  /** La monnaie du règlement de la ligne (code ISO), `null` ou absent en francs. */
  devise?: string | null;
  reference: string | null;
  ecritureId: string;
  pieceReglement: string;
  /** Les factures et la part de chacune, quand le dossier les désigne (art. 151, M6). */
  imputationDeclaree?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Le nombre d'ordres qu'un onglet montre, les plus récents d'abord (audit final F207) · au-delà, la tranche se dit. */
export const PLAFOND_ORDRES_LISTES = 500;

/**
 * ORDRES DE VIREMENT · voir tiers/ribs-tiers.ts pour les règles et ce que la
 * source en dit. L'ordre naît de la fenêtre Règlement des tiers, en même temps
 * que ses pièces, et ne se crée pas ailleurs · un ordre sans pièce de
 * règlement ferait payer une dette que le livre dit encore due.
 */
@Injectable()
export class OrdresVirementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TOUT CE QUE L'ORDRE EXIGE SE VÉRIFIE AVANT LA PREMIÈRE PIÈCE · le RIB du
   * journal (le compte à débiter), sa devise, et le RIB PRINCIPAL de chaque
   * tiers. Un refus découvert après coup laisserait des pièces de règlement
   * passées sans l'ordre qui devait les exécuter.
   */
  async preparer(tenantId: string, journalId: string, compteIds: string[]): Promise<PreparationOrdre> {
    const donneur = await this.donneurDuJournal(tenantId, journalId, 'TIERS');

    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, id: { in: compteIds } },
      select: {
        id: true,
        numero: true,
        tiersCompte: { select: { tiers: { select: { id: true, code: true, nom: true, ribs: { where: { tenantId, estPrincipal: true }, orderBy: { createdAt: 'asc' } } } } } },
      },
    });
    const exigeVisa = await this.exigeLeVisa(tenantId);
    const beneficiaires: PreparationOrdre['beneficiaires'] = new Map();
    const manques: string[] = [];
    const nonVises: string[] = [];
    for (const id of compteIds) {
      const c = comptes.find((x) => x.id === id);
      const tiers = c?.tiersCompte?.tiers;
      if (!c || !tiers) {
        manques.push(`le compte ${c?.numero ?? id} n'est rattaché à aucun tiers`);
        continue;
      }
      const principal = tiers.ribs[0];
      if (!principal) {
        manques.push(`${tiers.code} · ${tiers.nom} n'a pas de RIB principal`);
        continue;
      }
      if (exigeVisa && !estVise(principal)) {
        nonVises.push(`${tiers.code} · ${tiers.nom}`);
        continue;
      }
      beneficiaires.set(id, {
        tiersId: tiers.id,
        salarieId: null,
        beneficiaire: principal.titulaire ?? tiers.nom,
        banque: principal.banque,
        coordonnees: coordonneesImprimees(principal),
        codeBic: principal.codeBic,
      });
    }
    if (manques.length) {
      throw new BadRequestException(
        `Ordre de virement impossible · ${manques.join(' ; ')}. Renseignez les coordonnées bancaires dans la fiche du tiers, ou décochez l'ordre de virement.`,
      );
    }
    if (nonVises.length) {
      throw new BadRequestException(refusOrdreRibsNonVises(nonVises, 'la fiche du tiers, volet Coordonnées bancaires'));
    }
    return { donneur, beneficiaires };
  }

  /**
   * LE MÊME ORDRE POUR DES SALAIRES (ligne sage-l5, fonction 75) · aucun
   * second module · le donneur se lit comme pour un tiers, et chaque salarié
   * doit avoir son RIB PRINCIPAL (Registre du personnel), sinon refus qui
   * nomme les salariés, AVANT la pièce de paiement.
   */
  async preparerSalaries(tenantId: string, journalId: string, salaries: readonly { id: string; nomComplet: string }[]): Promise<PreparationOrdre> {
    const donneur = await this.donneurDuJournal(tenantId, journalId, 'SALAIRES');
    const ribs = await this.prisma.ribSalarie.findMany({
      where: { tenantId, estPrincipal: true, salarieId: { in: salaries.map((s) => s.id) } },
      // Même ordre que l'écran (le premier principal créé) · deux principaux
      // nés d'une course ne laissent pas l'ordre juger un autre RIB que celui montré.
      orderBy: { createdAt: 'asc' },
    });
    const exigeVisa = await this.exigeLeVisa(tenantId);
    const beneficiaires: PreparationOrdre['beneficiaires'] = new Map();
    const manques: string[] = [];
    const enDevise: string[] = [];
    const nonVises: string[] = [];
    for (const s of salaries) {
      const principal = ribs.find((r) => r.salarieId === s.id);
      if (!principal) {
        manques.push(s.nomComplet);
        continue;
      }
      // RELECTURE L5, MINEUR 7 · L'ORDRE DES SALAIRES EST EN FRANCS, monnaie
      // de tenue, comme le compte du donneur (`motifRefusDeviseDonneur`) ·
      // vers un compte tenu dans une autre monnaie, la banque convertirait
      // au cours qu'elle choisit, que le bulletin ne dit pas. Une monnaie non
      // renseignée est lue en francs, comme le RIB du journal.
      const devise = (principal.devise ?? '').trim().toUpperCase();
      if (devise && devise !== MONNAIE_DE_TENUE) {
        enDevise.push(`${s.nomComplet} (${devise})`);
        continue;
      }
      if (exigeVisa && !estVise(principal)) {
        nonVises.push(s.nomComplet);
        continue;
      }
      beneficiaires.set(s.id, {
        tiersId: null,
        salarieId: s.id,
        beneficiaire: principal.titulaire ?? s.nomComplet,
        banque: principal.banque,
        coordonnees: coordonneesImprimees(principal),
        codeBic: principal.codeBic,
      });
    }
    if (manques.length) {
      throw new BadRequestException(
        `Ordre de virement impossible · aucun RIB principal pour ${manques.join(', ')}. Renseignez les coordonnées bancaires dans le Registre du personnel (administrateur), ou payez ces salariés par un autre mode.`,
      );
    }
    if (enDevise.length) {
      throw new BadRequestException(
        `Ordre de virement impossible · le RIB principal de ${enDevise.join(', ')} est tenu hors de la monnaie de tenue, quand l'ordre des salaires est en ${MONNAIE_DE_TENUE} · la banque convertirait à un cours que le bulletin ne dit pas. Désignez un RIB principal en ${MONNAIE_DE_TENUE} (Registre du personnel, administrateur), ou payez ces salariés par un autre mode.`,
      );
    }
    if (nonVises.length) {
      throw new BadRequestException(refusOrdreRibsNonVises(nonVises, 'le Registre du personnel, volet Paiement'));
    }
    return { donneur, beneficiaires };
  }

  /**
   * L'OPTION « VISA DES RIB » DU DOSSIER (`tiers/visa-rib.ts`, règle 5) · lue
   * avec l'ordre, jamais présumée · un dossier qui ne l'a pas cochée garde ses
   * virements tels qu'avant.
   */
  private async exigeLeVisa(tenantId: string): Promise<boolean> {
    const dossier = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { visaRibs: true } });
    // Un contrôle contre le détournement se ferme par défaut · un dossier
    // introuvable n'est pas un dossier qui n'exige rien.
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    return dossier.visaRibs === true;
  }

  /**
   * CHAQUE LIGNE EST PAYÉE DANS LA MONNAIE DU DONNEUR (ligne sage-l3, fonction
   * 37) · vérifié par l'appelant AVANT la première pièce, sur ce qu'il sait du
   * lot (la devise de chaque règlement), jamais après coup. Refus nommé.
   */
  refuserLignesHorsDevise(preparation: PreparationOrdre, journalCode: string, lignes: readonly LigneReglee[]): void {
    const motif = motifRefusLignesHorsDeviseDonneur({
      deviseDonneur: preparation.donneur.devise,
      journalCode,
      monnaieDeTenue: MONNAIE_DE_TENUE,
      lignes,
    });
    if (motif) throw new BadRequestException(motif);
  }

  /**
   * Le compte à débiter · le RIB du journal, avec ses coordonnées et sa
   * monnaie. Pour des TIERS, un RIB en devise fait un ordre en devise
   * (décision D1) ; pour des SALAIRES, le franc seul (`motifRefusDeviseDonneur`).
   */
  private async donneurDuJournal(tenantId: string, journalId: string, pour: 'TIERS' | 'SALAIRES'): Promise<PreparationOrdre['donneur']> {
    const rib = await this.prisma.ribBanque.findFirst({
      where: { tenantId, journalId },
      include: { banque: { select: { intitule: true } }, journal: { select: { code: true } } },
    });
    if (!rib) {
      const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId }, select: { code: true } });
      throw new BadRequestException(
        `Aucun RIB n'est rattaché au journal ${journal?.code ?? ''} (Structure > Banques) · l'ordre de virement n'aurait pas de compte à débiter.`,
      );
    }
    if (pour === 'SALAIRES') {
      const refusDevise = motifRefusDeviseDonneur(rib.devise, rib.journal?.code ?? '');
      if (refusDevise) throw new BadRequestException(refusDevise);
    }
    const donneur = {
      banque: rib.banque.intitule,
      coordonnees: coordonneesImprimees({ ...rib, banque: rib.banque.intitule }),
      codeBic: rib.codeBic,
      devise: pour === 'SALAIRES' ? null : deviseDuDonneur(rib.devise),
    };
    if (!donneur.coordonnees) {
      throw new BadRequestException(`Le RIB ${rib.abrege} ne porte ni IBAN ni numéro de compte · complétez-le dans Structure > Banques.`);
    }
    return donneur;
  }

  /**
   * CRÉE L'ORDRE sur les pièces déjà passées. Numérotation CONTINUE par
   * dossier, jamais réutilisée, ordres annulés compris · deux créations
   * simultanées prennent le même « dernier numéro », l'index unique refuse la
   * seconde, et elle est rejouée sur le suivant.
   */
  async creer(tenantId: string, email: string, journalId: string, date: string, preparation: PreparationOrdre, lignes: LigneAOrdonner[]) {
    const creer = () => transactionJournalisee(this.prisma, (tx) => this.creerDans(tx, tenantId, email, journalId, date, preparation, lignes));
    for (let essai = 0; ; essai++) {
      try {
        return await creer();
      } catch (e) {
        if (essai < 2 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
  }

  /**
   * L'ORDRE DANS UNE TRANSACTION DÉJÀ OUVERTE · le paiement des salaires
   * (ligne sage-l5) le fait naître avec sa pièce et sa fiche, dans la même
   * transaction sérialisable, qui rejoue tout sur un conflit. Une seule
   * écriture de l'ordre, que `creer` appelle aussi.
   */
  async creerDans(
    tx: Prisma.TransactionClient,
    tenantId: string,
    email: string,
    journalId: string,
    date: string,
    preparation: PreparationOrdre,
    lignes: LigneAOrdonner[],
  ) {
    const total = round2(lignes.reduce((s, l) => s + l.montant, 0));
    // L'ORDRE EN DEVISE PORTE LE MONTANT QUE LA BANQUE EXÉCUTE (fonction 37) ·
    // chaque ligne doit alors porter sa devise, celle du donneur, et son
    // montant en devise. Une ligne qui en manque est une faute de l'appelant
    // (la règle ligne à ligne passe avant la première pièce) · l'ordre ne
    // naît pas plutôt que de faire exécuter une contrevaleur en francs par un
    // compte en dollars.
    const devise = preparation.donneur.devise;
    for (const l of lignes) {
      if ((l.devise ?? null) !== devise || (devise !== null && !(typeof l.montantDevise === 'number' && Number.isFinite(l.montantDevise)))) {
        throw new BadRequestException(
          `La ligne ${l.compteId ?? l.salarieId ?? ''} n'est pas réglée dans la monnaie du donneur (${devise ?? MONNAIE_DE_TENUE}) · l'ordre n'est pas créé.`,
        );
      }
    }
    const totalDevise = devise === null ? null : round2(lignes.reduce((s, l) => s + (l.montantDevise ?? 0), 0));
    const dernier = await tx.ordreVirement.aggregate({ where: { tenantId }, _max: { numero: true } });
    return tx.ordreVirement.create({
      data: {
        tenantId,
        numero: (dernier._max.numero ?? 0) + 1,
        date: new Date(date),
        journalId,
        donneurBanque: preparation.donneur.banque,
        donneurCoordonnees: preparation.donneur.coordonnees,
        donneurBic: preparation.donneur.codeBic,
        total,
        devise,
        totalDevise,
        creePar: email,
        lignes: {
          create: lignes.map((l) => {
            const cle = l.salarieId ?? l.compteId ?? '';
            const b = preparation.beneficiaires.get(cle);
            // Une ligne sans bénéficiaire préparé est une faute de l'appelant ·
            // l'ordre ne naît pas plutôt que de payer un inconnu.
            if (!b) throw new BadRequestException(`Bénéficiaire non préparé pour la ligne ${cle} · l'ordre n'est pas créé.`);
            return {
              tenantId,
              tiersId: b.tiersId,
              salarieId: b.salarieId,
              beneficiaire: b.beneficiaire,
              banque: b.banque,
              coordonnees: b.coordonnees,
              codeBic: b.codeBic,
              montant: round2(l.montant),
              montantDevise: devise === null ? null : round2(l.montantDevise ?? 0),
              reference: l.reference,
              pieceReglement: l.pieceReglement,
              imputationDeclaree: l.imputationDeclaree ?? null,
              ecritureId: l.ecritureId,
            };
          }),
        },
      },
      select: { id: true, numero: true, total: true, devise: true, totalDevise: true },
    });
  }

  /**
   * UNE TRANCHE QUI SE DIT (audit final F207) · la liste s'arrêtait aux
   * `PLAFOND_ORDRES_LISTES` plus récents sans le dire, et les plus anciens
   * disparaissaient de l'onglet, un ordre resté en attente d'impression
   * compris. Le total et le nombre d'ordres en attente se demandent à la
   * base, sur le dossier entier · c'est ce qui permet à l'écran de dire
   * qu'un ordre à imprimer n'est pas dans la tranche montrée.
   *
   * LE FILTRE PAR ÉTAT DIT SON PÉRIMÈTRE (audit final F207, le reste). La
   * liste et son `total` se lisent sur le MÊME filtre · un total pris sur le
   * dossier entier à côté d'une liste filtrée rendrait `tronque` vrai sur une
   * liste complète, et l'écran annoncerait une tranche qui n'existe pas. Le
   * filtre est RENDU (`statut`, `null` sans filtre), pour que la phrase qui dit
   * la tranche nomme l'état qu'elle compte. Les ordres à imprimer, eux, restent
   * comptés sur le dossier entier · filtré sur « Imprimé », l'écran doit encore
   * dire qu'un ordre attend son impression hors de la liste affichée. Un état
   * inconnu est refusé ici comme au DTO, jamais ignoré · ignoré, il rendrait
   * la liste entière sous un filtre que l'utilisateur croit posé.
   */
  async lister(tenantId: string, statut?: StatutOrdreVirement, personnelOuvert = true) {
    if (statut !== undefined && !Object.values(StatutOrdreVirement).includes(statut)) {
      throw new BadRequestException(
        `État d'ordre de virement inconnu : ${String(statut)}. États admis : ${Object.values(StatutOrdreVirement).join(', ')}.`,
      );
    }
    // Le dossier s'écrit en clair dans chaque requête · la garde qui relit le
    // code (`cloisonnement.spec.ts`) ne suit pas un filtre posé dans une
    // variable.
    const parEtat = statut === undefined ? {} : { statut };
    // LES ORDRES DE SALAIRES NE SE MONTRENT PAS À QUI LE PERSONNEL EST FERMÉ
    // (ligne sage-l5, fonction 75 · roles-cantonnes.ts, « le personnel lui est
    // fermé en entier, lecture comprise ») · un ordre de paie nomme chaque
    // salarié et son net. Exclus de la liste ET des décomptes, pour que
    // l'aide-comptable ne lise pas non plus leur nombre en creux.
    const horsPaie = personnelOuvert ? {} : { lignes: { none: { salarieId: { not: null } } } };
    const [ordres, total, enAttenteImpression] = await Promise.all([
      this.prisma.ordreVirement.findMany({
        where: { tenantId, ...parEtat, ...horsPaie },
        orderBy: { numero: 'desc' },
        take: PLAFOND_ORDRES_LISTES,
        include: { journal: { select: { code: true, intitule: true } }, _count: { select: { lignes: true } } },
      }),
      this.prisma.ordreVirement.count({ where: { tenantId, ...parEtat, ...horsPaie } }),
      this.prisma.ordreVirement.count({ where: { tenantId, statut: StatutOrdreVirement.A_IMPRIMER, ...horsPaie } }),
    ]);
    return { ordres, total, tronque: total > ordres.length, enAttenteImpression, statut: statut ?? null };
  }

  async detail(tenantId: string, id: string, personnelOuvert = true) {
    const ordre = await this.prisma.ordreVirement.findFirst({
      where: { id, tenantId },
      include: {
        journal: { select: { code: true, intitule: true } },
        lignes: { orderBy: { beneficiaire: 'asc' } },
      },
    });
    if (!ordre) throw new NotFoundException('Ordre de virement introuvable pour ce dossier.');
    if (!personnelOuvert && ordre.lignes.some((l) => l.salarieId !== null)) {
      throw new ForbiddenException("Cet ordre de virement paie des salaires · le personnel n'est pas ouvert à votre rôle.");
    }
    return ordre;
  }

  /**
   * L'IMPRESSION EST ENREGISTRÉE AU SERVEUR, jamais déduite de l'écran · la
   * PREMIÈRE fait passer l'ordre d'« en attente d'impression » à « imprimé »
   * et en garde la date et l'auteur ; les suivantes ne changent que le
   * compteur, ce qui dit qu'un duplicata existe.
   */
  async imprimer(tenantId: string, id: string, email: string, personnelOuvert = true) {
    const ordre = await this.detail(tenantId, id, personnelOuvert);
    const refus = motifRefusImpression(ordre.statut);
    if (refus) throw new BadRequestException(refus);
    const premiere = ordre.statut === StatutOrdreVirement.A_IMPRIMER;
    await this.prisma.ordreVirement.update({
      where: { id: ordre.id },
      data: {
        nombreImpressions: { increment: 1 },
        ...(premiere ? { statut: StatutOrdreVirement.IMPRIME, premiereImpressionLe: new Date(), premiereImpressionPar: email } : {}),
      },
    });
    return this.detail(tenantId, id);
  }

  /**
   * LES AVIS DE RÈGLEMENT D'UN ORDRE (ligne sage-l2, fonction 27) · un par
   * ligne qui paie un TIERS, habillé du modèle « avis de règlement » de sa
   * fiche, sinon du cadre par défaut (`avis-reglement.ts`). Rien n'est écrit ·
   * l'avis se compose à la lecture, sur ce que l'ordre a recopié. Une ligne
   * qui paie un salaire n'a pas d'avis · le décompte de l'art. 103 du Code du
   * travail est le bulletin, et le nombre de ces lignes est dit.
   */
  async avisReglement(tenantId: string, id: string, personnelOuvert = true) {
    const ordre = await this.detail(tenantId, id, personnelOuvert);
    const refus = motifRefusAvis(ordre.statut);
    if (refus) throw new BadRequestException(refus);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const jour = jourDeKinshasa(new Date());
    // La signature d'une correspondance (AUDCG art. 59 ; AUSCGIE art. 17),
    // comme celle des relances · le nom du dossier et ses mentions.
    const entite = [tenant?.nom ?? '', tenant ? mentionsEmetteur(identiteSociete(tenant), jour).ligne : null].filter((x) => x).join('\n');
    const lignesTiers = ordre.lignes.filter((l): l is typeof l & { tiersId: string } => l.tiersId !== null);
    const cadres = await cadresDesTiers(
      this.prisma,
      tenantId,
      lignesTiers.map((l) => l.tiersId),
      'REGLEMENT',
      { entite, jour },
      CADRE_AVIS_PAR_DEFAUT,
    );
    return {
      ordre: { id: ordre.id, numero: ordre.numero, date: ordre.date, statut: ordre.statut },
      avis: lignesTiers.map((l) => {
        const cadre = cadres.get(l.tiersId) ?? null;
        const document = documentAvisReglement(
          {
            montant: Number(l.montant),
            banque: l.banque,
            reference: l.reference,
            imputationDeclaree: l.imputationDeclaree,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
          },
          { numero: ordre.numero, date: ordre.date, devise: ordre.devise },
          entite,
        );
        return { ligneId: l.id, beneficiaire: l.beneficiaire, montant: Number(l.montant), modele: cadre?.modele ?? null, texte: habiller(cadre, document) };
      }),
      lignesDeSalaires: ordre.lignes.length - lignesTiers.length,
    };
  }

  /**
   * L'ANNULATION LIBÈRE LES PIÈCES, ELLE NE LES DÉFAIT PAS · le règlement
   * reste au journal, et c'est au comptable de le supprimer ou de le garder
   * (un chèque peut remplacer le virement). La référence de la pièce reste sur
   * l'ordre · un ordre annulé doit encore dire ce qu'il devait exécuter.
   */
  async annuler(tenantId: string, id: string, email: string, motif: string, personnelOuvert = true) {
    const ordre = await this.detail(tenantId, id, personnelOuvert);
    const refus = motifRefusAnnulation(ordre.statut, motif);
    if (refus) throw new BadRequestException(refus);
    await transactionJournalisee(this.prisma, (tx) => this.annulerDans(tx, tenantId, ordre.id, email, motif));
    return this.detail(tenantId, id, personnelOuvert);
  }

  /**
   * L'ANNULATION DANS UNE TRANSACTION DÉJÀ OUVERTE · le paiement des salaires
   * annulé emporte son ordre dans la même transaction (ligne sage-l5). Une
   * seule écriture de l'annulation, que `annuler` appelle aussi.
   */
  async annulerDans(tx: Prisma.TransactionClient, tenantId: string, ordreId: string, email: string, motif: string) {
    await tx.ligneOrdreVirement.updateMany({ where: { tenantId, ordreId }, data: { ecritureId: null } });
    await tx.ordreVirement.update({
      where: { id: ordreId },
      data: { statut: StatutOrdreVirement.ANNULE, annuleLe: new Date(), annulePar: email, motifAnnulation: motif.trim() },
    });
  }
}
