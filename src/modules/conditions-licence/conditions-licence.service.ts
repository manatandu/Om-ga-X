import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { estSurSite } from '../../common/mode-installation';
import { CourrierService, ORIGINE_CONDITIONS_LICENCE } from '../courrier/courrier.service';
import { AbonnementAFacturer } from '../plateforme/abonnements/facturation-abonnements';
import {
  AccuseEnFile,
  AcceptationEnregistree,
  ContexteAcceptation,
  DetailCommande,
  detailCommande,
  estAJour,
  etatConditions,
  EtatConditions,
  motifRefusAcceptation,
  motifRefusRenvoiAccuse,
} from './acceptation-conditions';
import { accuseReceptionConditions } from './accuse-reception-conditions';
import { mentionsAArreter, VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';
import { empreinteEnVigueur } from './versions-publiees';

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const nombre = (d: { toString(): string } | null) => (d === null ? null : Number(d.toString()));

/**
 * L'ACCEPTATION DES CONDITIONS DE LICENCE PAR UN DOSSIER (ligne
 * pages-legales). Les règles sont dans `acceptation-conditions.ts` · ce
 * service lit, décide par elles, écrit, et accuse réception.
 *
 * L'ACTE S'ÉCRIT SUR LE DOSSIER, PAR UNE MISE À JOUR UNITAIRE · `Tenant` est
 * audité, et c'est son maillon qui garde l'historique (qui, quand, d'où), un
 * `updateMany` n'y laissant que filtre et compte. Le verrou consultatif de
 * transaction, pris par dossier, fait qu'un second clic attend le premier et
 * lit l'acceptation qu'il vient d'écrire · jamais deux dates pour une version.
 */
@Injectable()
export class ConditionsLicenceService {
  private readonly logger = new Logger(ConditionsLicenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly courrier?: CourrierService,
  ) {}

  /**
   * L'abonnement du dossier, au format du moteur de facturation · `null` sans
   * abonnement. UNE CELLULE N'A PAS D'ABONNEMENT À ELLE · sa licence est celle
   * de son siège (`licenceDeCellule`), et c'est l'abonnement du siège qu'elle
   * lit (relecture M4) · lire le sien la laissait toujours sans prix.
   */
  private async commande(tenantId: string, dossierMereId: string | null): Promise<DetailCommande | null> {
    // Lu sur la clé du dossier (`cabinetId`), ou de son siège · un modèle
    // hors dossier (`MODELES_HORS_DOSSIER`), que la console de l'éditeur
    // tient. Seuls la formule, les options et les dates sortent · jamais le
    // tiers facturé, qui est une fiche du dossier de l'éditeur.
    const cabinetId = dossierMereId ?? tenantId;
    const a = await this.prisma.abonnementCabinet.findUnique({
      where: { cabinetId },
      select: {
        periodicite: true,
        debut: true,
        finEssai: true,
        actif: true,
        dossiersSupplementaires: true,
        formule: { select: { code: true, libelle: true, type: true, prixMensuelUsd: true, prixAnnuelUsd: true } },
        options: { select: { formule: { select: { code: true, libelle: true, type: true, prixMensuelUsd: true, prixAnnuelUsd: true } } } },
      },
    });
    if (!a) return null;
    const prix = (f: { code: string; libelle: string; type: string; prixMensuelUsd: unknown; prixAnnuelUsd: unknown }) => ({
      code: f.code,
      libelle: f.libelle,
      type: f.type as 'FORMULE' | 'OPTION',
      prixMensuelUsd: nombre(f.prixMensuelUsd as { toString(): string } | null),
      prixAnnuelUsd: nombre(f.prixAnnuelUsd as { toString(): string } | null),
    });
    const aFacturer: AbonnementAFacturer = {
      formule: prix(a.formule),
      options: a.options.map((o) => prix(o.formule)),
      dossiersSupplementaires: a.dossiersSupplementaires,
      periodicite: a.periodicite,
      debut: jour(a.debut)!,
      finEssai: jour(a.finEssai),
      actif: a.actif,
    };
    return detailCommande(aFacturer, dossierMereId !== null);
  }

  private async lire(tenantId: string): Promise<{ acceptation: AcceptationEnregistree | null; contexte: ContexteAcceptation; nom: string }> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nom: true,
        estDemonstration: true,
        dossierMereId: true,
        conditionsLicenceVersion: true,
        conditionsLicenceEmpreinte: true,
        conditionsLicenceAccepteesLe: true,
        conditionsLicenceAccepteesPar: true,
        licence: { select: { type: true } },
      },
    });
    if (!t) throw new NotFoundException('Dossier introuvable.');
    const acceptation =
      t.conditionsLicenceVersion !== null && t.conditionsLicenceAccepteesLe !== null
        ? {
            version: t.conditionsLicenceVersion,
            empreinte: t.conditionsLicenceEmpreinte,
            le: t.conditionsLicenceAccepteesLe.toISOString(),
            par: t.conditionsLicenceAccepteesPar,
          }
        : null;
    const contexte: ContexteAcceptation = {
      mentions: mentionsAArreter(),
      typeLicence: t.licence?.type ?? null,
      estDemonstration: t.estDemonstration === true,
      surSite: estSurSite(),
      commande: await this.commande(tenantId, t.dossierMereId),
    };
    return { acceptation, contexte, nom: t.nom };
  }

  async etat(tenantId: string): Promise<EtatConditions> {
    const { acceptation, contexte } = await this.lire(tenantId);
    return etatConditions(acceptation, contexte, await this.dernierAccuse(tenantId, acceptation));
  }

  /**
   * Le dernier accusé mis en file DEPUIS l'acceptation enregistrée · un accusé
   * d'une acceptation antérieure ne vaut pas pour celle-ci. Lu dans la file
   * du dossier, sur son origine (`ORIGINE_CONDITIONS_LICENCE`).
   */
  private async dernierAccuse(tenantId: string, acceptation: AcceptationEnregistree | null): Promise<AccuseEnFile | null> {
    if (!acceptation) return null;
    const m = await this.prisma.message.findFirst({
      where: { tenantId, origine: ORIGINE_CONDITIONS_LICENCE, origineId: tenantId, createdAt: { gte: new Date(acceptation.le) } },
      orderBy: { createdAt: 'desc' },
      select: { statut: true, createdAt: true },
    });
    return m ? { statut: m.statut, le: m.createdAt.toISOString() } : null;
  }

  /**
   * RENVOYER L'ACCUSÉ (relecture, mineur 5) · un accusé qui n'a pas pu être
   * mis en file, ou que la messagerie a rejeté, ne laissait aucune issue. Le
   * geste le remet en file, à l'adresse de l'auteur de l'acceptation, sous
   * les refus de `motifRefusRenvoiAccuse` (jamais un doublon).
   */
  async renvoyerAccuse(tenantId: string, auteur: { userId: string; email: string }): Promise<{ etat: EtatConditions; accuse: { statut: string } | null }> {
    const { acceptation, contexte, nom } = await this.lire(tenantId);
    const dernier = await this.dernierAccuse(tenantId, acceptation);
    const refus = motifRefusRenvoiAccuse(acceptation, estAJour(acceptation), dernier);
    if (refus || !acceptation) throw new ConflictException(refus ?? 'Aucune acceptation à accuser.');
    const accuse = await this.accuserReception(tenantId, acceptation.par ?? auteur.email, auteur.userId, acceptation, nom);
    return { etat: etatConditions(acceptation, contexte, await this.dernierAccuse(tenantId, acceptation)), accuse };
  }

  /**
   * Accepter la version en vigueur au nom du dossier. Déjà acceptée, rien
   * n'est réécrit · l'acceptation d'origine, sa date et son auteur, sont
   * rendus tels quels (`deja: true`).
   */
  async accepter(
    tenantId: string,
    auteur: { userId: string; email: string },
    versionLue: number,
    empreinteLue: string,
  ): Promise<{ etat: EtatConditions; deja: boolean; accuse: { statut: string } | null }> {
    const avant = await this.lire(tenantId);
    const refus = motifRefusAcceptation(versionLue, empreinteLue, avant.contexte);
    if (refus) throw new ConflictException(refus);

    const resultat = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conditions-licence:${tenantId}`}))`;
      const t = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          conditionsLicenceVersion: true,
          conditionsLicenceEmpreinte: true,
          conditionsLicenceAccepteesLe: true,
          conditionsLicenceAccepteesPar: true,
        },
      });
      if (!t) throw new NotFoundException('Dossier introuvable.');
      const empreinte = empreinteEnVigueur();
      // Déjà acceptée · même numéro ET même empreinte. Le numéro seul aurait
      // gardé l'acceptation d'un autre texte (relecture M2).
      if (t.conditionsLicenceVersion === VERSION_CONDITIONS_LICENCE.numero && t.conditionsLicenceEmpreinte === empreinte && t.conditionsLicenceAccepteesLe) {
        return {
          deja: true,
          acceptation: {
            version: t.conditionsLicenceVersion,
            empreinte: t.conditionsLicenceEmpreinte,
            le: t.conditionsLicenceAccepteesLe.toISOString(),
            par: t.conditionsLicenceAccepteesPar,
          },
        };
      }
      const le = new Date();
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          conditionsLicenceVersion: VERSION_CONDITIONS_LICENCE.numero,
          conditionsLicenceEmpreinte: empreinte,
          conditionsLicenceAccepteesLe: le,
          conditionsLicenceAccepteesPar: auteur.email,
        },
      });
      return {
        deja: false,
        acceptation: { version: VERSION_CONDITIONS_LICENCE.numero, empreinte, le: le.toISOString(), par: auteur.email },
      };
    });

    const accuse = resultat.deja ? null : await this.accuserReception(tenantId, auteur.email, auteur.userId, resultat.acceptation, avant.nom);
    return {
      etat: etatConditions(resultat.acceptation, avant.contexte, await this.dernierAccuse(tenantId, resultat.acceptation)),
      deja: resultat.deja,
      accuse,
    };
  }

  /**
   * L'ACCUSÉ DE RÉCEPTION ET LA COPIE DU CONTRAT (art. 55, al. 2 ; art. 56,
   * al. 1er), mis en file APRÈS l'acte. Un échec de mise en file ne le défait
   * JAMAIS · l'acceptation est faite, l'écran l'a déjà accusée, c'est un
   * courriel qui manque. Consigné en erreur au journal du serveur, rendu à
   * l'écran pour qu'il ne se dise pas « envoyé », et renvoyable
   * (`renvoyerAccuse`).
   */
  private async accuserReception(
    tenantId: string,
    destinataire: string,
    createdBy: string,
    acceptation: AcceptationEnregistree,
    dossier: string,
  ): Promise<{ statut: string } | null> {
    if (!this.courrier) return null;
    try {
      const r = await this.courrier.mettreEnFile(tenantId, {
        destinataire,
        ...accuseReceptionConditions(acceptation, dossier),
        origine: ORIGINE_CONDITIONS_LICENCE,
        origineId: tenantId,
        createdBy,
      });
      return { statut: r.statut };
    } catch (erreur) {
      // Une ERREUR, et nommée · c'est l'accusé que la loi exige qui manque
      // (art. 55, al. 2), et l'écran offre de le renvoyer.
      this.logger.error(
        `Accusé de réception des conditions non mis en file · dossier ${tenantId}, version ${acceptation.version} · ${erreur instanceof Error ? erreur.message : String(erreur)}`,
      );
      return { statut: 'NON_MIS_EN_FILE' };
    }
  }
}
