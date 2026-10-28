import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RoleUtilisateur, StatutEcriture } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import {
  LIBELLES_NATURE,
  auteurDuDernierContenu,
  empreinteDuContenu,
  etatDuVisa,
  motifRefusRetraitVisa,
  motifRefusVisaEcriture,
  motifRefusVisaFacture,
  natureDeLaPiece,
  nommerAuteur,
  visaPose,
} from './circuit-visa';
import { SELECT_CONTENU_VISE, SELECT_TRACES_VISA, contenuLu } from './circuit-visa-lecture';
import { estJournalDeSituation } from './ecritures-de-situation';

/** Une demande de visa · la pièce et l'empreinte du contenu que l'écran a montré (règle 5). */
export interface PieceAViser {
  id: string;
  empreinte: string;
}

/** Au plus deux cents pièces par geste · une page de brouillard, jamais une période entière d'un coup. */
export const PLAFOND_VISAS_PAR_GESTE = 200;

export const MOTIF_CIRCUIT_INACTIF =
  'Le circuit de visa n’est pas activé pour ce dossier · il se règle dans Paramètres du dossier, et sans lui une pièce se valide sans visa.';

/**
 * LE CIRCUIT DE VISA, ses gestes et sa fiche (`circuit-visa.ts`). Les règles
 * vivent dans le module pur · ce service lit, verrouille et écrit.
 */
@Injectable()
export class CircuitVisaService {
  private readonly journalServeur = new Logger(CircuitVisaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * LE REFUS D'UNE PIÈCE N'EMPORTE PAS LE LOT (relecture du circuit, mineur) ·
   * chaque pièce a sa transaction, et ce qui a été visé ou retiré avant reste
   * fait. Seul le refus `Forbidden` était rangé · un 409, un 503 (pool saturé)
   * ou une panne au milieu du lot faisait tomber la requête entière, et
   * l'écran ne voyait jamais les visas déjà posés. Tout refus HTTP est rangé
   * avec son motif ; une panne est consignée au journal du serveur et dite
   * pour sa pièce.
   */
  private motifDeLEchec(tenantId: string, geste: string, err: unknown): string {
    if (err instanceof HttpException) return err.message;
    this.journalServeur.error(`${geste} du dossier ${tenantId} · une pièce n'a pas pu être traitée`, err instanceof Error ? err.stack : String(err));
    return 'Rien n’est fait sur cette pièce · l’incident est consigné au journal du serveur, relancez le geste.';
  }

  private async circuitActif(tenantId: string): Promise<void> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { circuitVisa: true } });
    if (!t) throw new NotFoundException('Dossier introuvable.');
    if (!t.circuitVisa) throw new BadRequestException(MOTIF_CIRCUIT_INACTIF);
  }

  /**
   * VISER DES ÉCRITURES · chaque pièce dans SA transaction, sous le verrou de
   * sa ligne, son contenu relu et son empreinte recalculée. LE REFUS ÉCARTE,
   * il ne jette pas (même parti que la validation) · une pièce que l'auteur ne
   * peut pas viser, ou qu'un autre a changée depuis la lecture, n'empêche pas
   * de viser les autres, et chacune revient nommée avec son motif. Un journal
   * hors du périmètre de saisie de l'utilisateur est refusé par le client
   * Prisma (`extension-perimetre-journaux.ts`) · le visa est un geste de
   * validation, il suit la même restriction, et le refus est rendu comme les
   * autres.
   */
  async viserEcritures(tenantId: string, utilisateurId: string, pieces: readonly PieceAViser[]) {
    if (pieces.length === 0) throw new BadRequestException('Aucune pièce à viser.');
    if (pieces.length > PLAFOND_VISAS_PAR_GESTE) {
      throw new BadRequestException(`Au plus ${PLAFOND_VISAS_PAR_GESTE} pièces par visa · visez la sélection en plusieurs fois.`);
    }
    if (new Set(pieces.map((p) => p.id)).size !== pieces.length) {
      throw new BadRequestException('Une pièce est demandée deux fois dans le même visa.');
    }
    await this.circuitActif(tenantId);

    const visees: string[] = [];
    const refusees: { id: string; piece: string; motif: string }[] = [];
    const avertissements: { id: string; piece: string; avertissement: string }[] = [];
    for (const p of pieces) {
      try {
        const r = await transactionJournalisee(this.prisma, async (tx) => {
          // Le verrou ne porte que sur le brouillard · une pièce validée ne se vise plus,
          // la lecture qui suit le dit.
          await tx.$queryRaw`SELECT "id" FROM "ecritures" WHERE "id" = ${p.id} AND "tenantId" = ${tenantId} AND "statut" = 'BROUILLARD' FOR UPDATE`;
          const e = await tx.ecriture.findFirst({
            where: { id: p.id, tenantId },
            select: {
              id: true,
              statut: true,
              estGenereeParCloture: true,
              estANouveauProvisoire: true,
              journal: { select: { code: true, type: true } },
              ...SELECT_TRACES_VISA,
              ...SELECT_CONTENU_VISE,
            },
          });
          if (!e) return { piece: '·', motif: 'Pièce introuvable pour ce dossier.', avertissement: null };
          const piece = `${e.journal.code} n° ${e.numeroPiece ?? '·'}`;
          const empreinte = empreinteDuContenu(contenuLu(e));
          const { motif, avertissement } = motifRefusVisaEcriture(
            { ...e, journalDeSituation: estJournalDeSituation(e.journal) },
            utilisateurId,
            p.empreinte,
            empreinte,
          );
          if (motif) return { piece, motif, avertissement: null };
          // Une mise à jour UNITAIRE, au journal d'audit · qui a visé, quand,
          // et l'empreinte de ce qui l'a été.
          await tx.ecriture.update({ where: { id: e.id }, data: visaPose(utilisateurId, new Date(), empreinte), select: { id: true } });
          return { piece, motif: null, avertissement };
        });
        if (r.motif) refusees.push({ id: p.id, piece: r.piece, motif: r.motif });
        else {
          visees.push(p.id);
          if (r.avertissement) avertissements.push({ id: p.id, piece: r.piece, avertissement: r.avertissement });
        }
      } catch (err) {
        refusees.push({ id: p.id, piece: '·', motif: this.motifDeLEchec(tenantId, 'Visa', err) });
      }
    }
    return { visees: visees.length, refusees, avertissements };
  }

  /**
   * RETIRER UN VISA · son auteur, ou l'administrateur du dossier, tant que la
   * pièce est au brouillard. Une mise à jour unitaire par pièce, au journal
   * d'audit (l'ancienne valeur y reste, art. 22, 6°).
   */
  async retirerVisas(tenantId: string, utilisateur: { userId: string; role: string }, ids: readonly string[]) {
    if (ids.length === 0) throw new BadRequestException('Aucune pièce désignée.');
    if (ids.length > PLAFOND_VISAS_PAR_GESTE) throw new BadRequestException(`Au plus ${PLAFOND_VISAS_PAR_GESTE} pièces par geste.`);
    const estAdministrateur = utilisateur.role === RoleUtilisateur.ADMIN_CABINET;
    const retires: string[] = [];
    const refusees: { id: string; piece: string; motif: string }[] = [];
    for (const id of new Set(ids)) {
      try {
        const r = await transactionJournalisee(this.prisma, async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "ecritures" WHERE "id" = ${id} AND "tenantId" = ${tenantId} AND "statut" = 'BROUILLARD' FOR UPDATE`;
          const e = await tx.ecriture.findFirst({
            where: { id, tenantId },
            select: { id: true, statut: true, numeroPiece: true, viseePar: true, viseeLe: true, viseeEmpreinte: true, journal: { select: { code: true } } },
          });
          if (!e) return { piece: '·', motif: 'Pièce introuvable pour ce dossier.' };
          const piece = `${e.journal.code} n° ${e.numeroPiece ?? '·'}`;
          const motif = motifRefusRetraitVisa(e, utilisateur.userId, estAdministrateur);
          if (motif) return { piece, motif };
          await tx.ecriture.update({
            where: { id: e.id },
            data: { viseePar: null, viseeLe: null, viseeEmpreinte: null },
            select: { id: true },
          });
          return { piece, motif: null };
        });
        if (r.motif) refusees.push({ id, piece: r.piece, motif: r.motif });
        else retires.push(id);
      } catch (err) {
        refusees.push({ id, piece: '·', motif: this.motifDeLEchec(tenantId, 'Retrait de visa', err) });
      }
    }
    return { retires: retires.length, refusees };
  }

  /**
   * VISER UNE FACTURE AVANT SA COMPTABILISATION (CPCC ch. 3, § 3.1.1). Le
   * verrou de la facture est pris dans la transaction · deux visas
   * concurrents ne s'écrasent pas, et un visa ne se pose pas sur une facture
   * comptabilisée entre-temps.
   */
  async viserFacture(tenantId: string, utilisateurId: string, factureId: string) {
    await this.circuitActif(tenantId);
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "factures" WHERE "id" = ${factureId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const f = await tx.facture.findFirst({
        where: { id: factureId, tenantId },
        select: {
          id: true,
          numeroSerie: true,
          saisiePar: true,
          viseePar: true,
          viseeLe: true,
          ecritureId: true,
          factureAbonnement: { select: { id: true } },
        },
      });
      if (!f) throw new NotFoundException('Facture introuvable pour ce dossier.');
      const { motif, avertissement } = motifRefusVisaFacture({ ...f, emiseParLeLogiciel: f.factureAbonnement !== null }, utilisateurId);
      if (motif) throw new BadRequestException(motif);
      const maintenant = new Date();
      await tx.facture.update({ where: { id: f.id }, data: { viseePar: utilisateurId, viseeLe: maintenant }, select: { id: true } });
      return { id: f.id, numeroSerie: f.numeroSerie, viseeLe: maintenant, avertissement };
    });
  }

  /**
   * LA FICHE D'IMPUTATION · une pièce, telle qu'elle s'imprime avec ses
   * auteurs (CPCC ch. 2, § 2.6.1 · « numéro de la pièce […] ; journal ; date
   * (date de valeur comptable) ; […] comptable ; […] numéro de compte, débit,
   * crédit ; libellé du compte principal ; paraphe, visa du chef comptable » ;
   * rubriques complémentaires « centre de frais, unité budgétaire »).
   * Microfina++ y porte « Saisie par » et « Approuvée par » (M p. 154) ·
   * OmegaX dit la saisie, le dernier contenu quand il diffère, le visa, la
   * validation et la dérogation nominative, l'auteur résolu en courriel (un
   * auditeur ne lit pas un identifiant), un utilisateur retiré nommé comme
   * tel, jamais une case vide.
   */
  async ficheImputation(tenantId: string, ecritureId: string) {
    const e = await this.prisma.ecriture.findFirst({
      where: { id: ecritureId, tenantId },
      select: {
        id: true,
        statut: true,
        createdAt: true,
        valideeBy: true,
        valideeAt: true,
        secondRegardNom: true,
        secondRegardMotif: true,
        estGenereeParCloture: true,
        exercice: { select: { dateDebut: true, dateFin: true } },
        journal: { select: { code: true, intitule: true, type: true } },
        facture: { select: { numeroSerie: true } },
        ...SELECT_TRACES_VISA,
        ...SELECT_CONTENU_VISE,
      },
    });
    if (!e) throw new NotFoundException('Écriture introuvable pour ce dossier.');
    const [comptes, sections] = await Promise.all([
      this.prisma.compte.findMany({
        where: { tenantId, id: { in: [...new Set(e.lignes.map((l) => l.compteId))] } },
        select: { id: true, numero: true, intitule: true },
      }),
      this.prisma.sectionAnalytique.findMany({
        where: { tenantId, id: { in: [...new Set(e.lignes.flatMap((l) => l.ventilations.map((v) => v.sectionId)))] } },
        select: { id: true, code: true, intitule: true },
      }),
    ]);
    const auteur = auteurDuDernierContenu(e);
    const ids = [e.createdBy, e.contenuPar, e.viseePar, e.valideeBy].filter((x): x is string => typeof x === 'string' && x !== '');
    const utilisateurs = await this.prisma.user.findMany({ where: { tenantId, id: { in: [...new Set(ids)] } }, select: { id: true, email: true } });
    const courriels = new Map(utilisateurs.map((u) => [u.id, u.email]));
    const compteDe = new Map(comptes.map((c) => [c.id, c]));
    const sectionDe = new Map(sections.map((s) => [s.id, s]));
    const empreinte = empreinteDuContenu(contenuLu(e));
    const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    const nature = natureDeLaPiece({
      journalType: e.journal.type,
      aUneFacture: e.facture !== null,
      numerosComptes: e.lignes.map((l) => compteDe.get(l.compteId)?.numero ?? ''),
    });
    return {
      id: e.id,
      statut: e.statut,
      journal: { code: e.journal.code, intitule: e.journal.intitule },
      numeroPiece: e.numeroPiece,
      date: jour(e.date),
      dateValeur: jour(e.dateValeur),
      libelle: e.libelle,
      reference: e.reference,
      nature,
      natureLibelle: LIBELLES_NATURE[nature],
      facture: e.facture?.numeroSerie ?? null,
      lignes: e.lignes.map((l) => ({
        compte: compteDe.get(l.compteId)?.numero ?? '·',
        intitule: compteDe.get(l.compteId)?.intitule ?? '·',
        libelle: l.libelle,
        debit: Number(l.debit),
        credit: Number(l.credit),
        echeance: jour(l.dateEcheance),
        sections: l.ventilations.map((v) => sectionDe.get(v.sectionId)?.code ?? '·'),
      })),
      saisie: { par: nommerAuteur(e.createdBy, courriels), le: e.createdAt },
      // Le dernier contenu, quand il n'est plus celui de la saisie.
      dernierContenu:
        e.contenuLe === null
          ? null
          : { par: auteur.connu ? nommerAuteur(auteur.id, courriels) : null, auteurConnu: auteur.connu, le: e.contenuLe },
      visa:
        e.viseePar === null
          ? null
          : {
              par: nommerAuteur(e.viseePar, courriels),
              le: e.viseeLe,
              // Un visa posé sur un contenu qui n'est plus le sien se dit · la
              // fiche n'affirme jamais une approbation qui ne couvre plus la pièce.
              surLeContenuPresent: e.statut !== StatutEcriture.BROUILLARD || etatDuVisa(e, empreinte) === 'VISEE',
            },
      validation: e.valideeAt === null ? null : { par: nommerAuteur(e.valideeBy, courriels), le: e.valideeAt },
      secondRegard: e.secondRegardNom ? { nom: e.secondRegardNom, motif: e.secondRegardMotif } : null,
    };
  }
}
