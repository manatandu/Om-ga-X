import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { estSurSite } from '../../common/mode-installation';
import { CourrierService, ORIGINE_CONDITIONS_LICENCE } from '../courrier/courrier.service';
import { AbonnementAFacturer } from '../plateforme/abonnements/facturation-abonnements';
import {
  AcceptationEnregistree,
  ContexteAcceptation,
  DetailCommande,
  detailCommande,
  etatConditions,
  EtatConditions,
  motifRefusAcceptation,
} from './acceptation-conditions';
import { accuseReceptionConditions } from './accuse-reception-conditions';
import { mentionsAArreter, VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';

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

  /** L'abonnement du dossier, au format du moteur de facturation · `null` sans abonnement. */
  private async commande(tenantId: string): Promise<DetailCommande | null> {
    // Lu par le dossier lui-même, sur SA clé (`cabinetId`) · un modèle hors
    // dossier (`MODELES_HORS_DOSSIER`), que la console de l'éditeur tient. Seuls
    // la formule, les options et les dates sortent · jamais le tiers facturé,
    // qui est une fiche du dossier de l'éditeur.
    const a = await this.prisma.abonnementCabinet.findUnique({
      where: { cabinetId: tenantId },
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
    return detailCommande(aFacturer);
  }

  private async lire(tenantId: string): Promise<{ acceptation: AcceptationEnregistree | null; contexte: ContexteAcceptation; nom: string }> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nom: true,
        estDemonstration: true,
        conditionsLicenceVersion: true,
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
            le: t.conditionsLicenceAccepteesLe.toISOString(),
            par: t.conditionsLicenceAccepteesPar ?? '',
          }
        : null;
    const contexte: ContexteAcceptation = {
      mentions: mentionsAArreter(),
      typeLicence: t.licence?.type ?? null,
      estDemonstration: t.estDemonstration === true,
      surSite: estSurSite(),
      commande: await this.commande(tenantId),
    };
    return { acceptation, contexte, nom: t.nom };
  }

  async etat(tenantId: string): Promise<EtatConditions> {
    const { acceptation, contexte } = await this.lire(tenantId);
    return etatConditions(acceptation, contexte);
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
  ): Promise<{ etat: EtatConditions; deja: boolean; accuse: { statut: string } | null }> {
    const avant = await this.lire(tenantId);
    const refus = motifRefusAcceptation(versionLue, avant.contexte);
    if (refus) throw new ConflictException(refus);

    const resultat = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conditions-licence:${tenantId}`}))`;
      const t = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { conditionsLicenceVersion: true, conditionsLicenceAccepteesLe: true, conditionsLicenceAccepteesPar: true },
      });
      if (!t) throw new NotFoundException('Dossier introuvable.');
      if (t.conditionsLicenceVersion === VERSION_CONDITIONS_LICENCE.numero && t.conditionsLicenceAccepteesLe) {
        return {
          deja: true,
          acceptation: { version: t.conditionsLicenceVersion, le: t.conditionsLicenceAccepteesLe.toISOString(), par: t.conditionsLicenceAccepteesPar ?? '' },
        };
      }
      const le = new Date();
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          conditionsLicenceVersion: VERSION_CONDITIONS_LICENCE.numero,
          conditionsLicenceAccepteesLe: le,
          conditionsLicenceAccepteesPar: auteur.email,
        },
      });
      return { deja: false, acceptation: { version: VERSION_CONDITIONS_LICENCE.numero, le: le.toISOString(), par: auteur.email } };
    });

    const accuse = resultat.deja ? null : await this.accuserReception(tenantId, auteur, resultat.acceptation, avant.nom);
    return { etat: etatConditions(resultat.acceptation, avant.contexte), deja: resultat.deja, accuse };
  }

  /**
   * L'ACCUSÉ DE RÉCEPTION ET LA COPIE DU CONTRAT (art. 55, al. 2 ; art. 56,
   * al. 1er), mis en file APRÈS l'acte. Un échec de mise en file ne le défait
   * JAMAIS · l'acceptation est faite, l'écran l'a déjà accusée, c'est un
   * courriel qui manque. Consigné au journal du serveur, et rendu à l'écran
   * pour qu'il ne se dise pas « envoyé ».
   */
  private async accuserReception(
    tenantId: string,
    auteur: { userId: string; email: string },
    acceptation: AcceptationEnregistree,
    dossier: string,
  ): Promise<{ statut: string } | null> {
    if (!this.courrier) return null;
    try {
      const r = await this.courrier.mettreEnFile(tenantId, {
        destinataire: auteur.email,
        ...accuseReceptionConditions(acceptation, dossier),
        origine: ORIGINE_CONDITIONS_LICENCE,
        origineId: tenantId,
        createdBy: auteur.userId,
      });
      return { statut: r.statut };
    } catch (erreur) {
      this.logger.warn(`Accusé de réception des conditions non mis en file · ${erreur instanceof Error ? erreur.message : String(erreur)}`);
      return { statut: 'NON_MIS_EN_FILE' };
    }
  }
}
