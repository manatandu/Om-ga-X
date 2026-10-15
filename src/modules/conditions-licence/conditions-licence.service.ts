import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, StatutMessage, TypeFormuleAbonnement, TypeLicence } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { estSurSite } from '../../common/mode-installation';
import { CourrierService, ORIGINE_CONDITIONS_LICENCE } from '../courrier/courrier.service';
import { AbonnementAFacturer, FormulePrix } from '../plateforme/abonnements/facturation-abonnements';
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
  StatutAccuse,
  StatutMessageConnu,
  TypeLicenceConnue,
} from './acceptation-conditions';
import { accuseReceptionConditions } from './accuse-reception-conditions';
import { mentionsAArreter, VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';
import { empreinteEnVigueur } from './versions-publiees';

/**
 * LES UNIONS DU MODULE PARTAGÉ CONFRONTÉES AUX ENUMS DU SCHÉMA, dans les deux
 * sens (second tour de relecture, m-3) · un type de licence ou un statut de
 * message ajouté au schéma, ou retiré, fait tomber la compilation ici, au lieu
 * de passer pour une chaîne quelconque.
 */
const LICENCES = {
  ABONNEMENT: 'ABONNEMENT',
  PERPETUEL_SAAS: 'PERPETUEL_SAAS',
  PERPETUEL_ONPREMISE: 'PERPETUEL_ONPREMISE',
  PROPRIETAIRE: 'PROPRIETAIRE',
} as const satisfies Record<TypeLicence, TypeLicenceConnue> & Record<TypeLicenceConnue, TypeLicence>;
const STATUTS = {
  EN_ATTENTE: 'EN_ATTENTE',
  SANS_TRANSPORT: 'SANS_TRANSPORT',
  ENVOYE: 'ENVOYE',
  ECHEC: 'ECHEC',
  ABANDONNE: 'ABANDONNE',
} as const satisfies Record<StatutMessage, StatutMessageConnu> & Record<StatutMessageConnu, StatutMessage>;
const FORMULES = { FORMULE: 'FORMULE', OPTION: 'OPTION' } as const satisfies Record<TypeFormuleAbonnement, FormulePrix['type']>;

/** Le jour AAAA-MM-JJ d'une date · une date donnée rend toujours un jour. */
function jour(d: Date): string;
function jour(d: Date | null): string | null;
function jour(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

const nombre = (d: Prisma.Decimal | null): number | null => (d === null ? null : d.toNumber());

/** Ce qu'une formule ou une option sort de la base · jamais le tiers facturé. */
const SELECT_FORMULE = { code: true, libelle: true, type: true, prixMensuelUsd: true, prixAnnuelUsd: true } as const satisfies Prisma.FormuleAbonnementSelect;
type FormuleLue = Prisma.FormuleAbonnementGetPayload<{ select: typeof SELECT_FORMULE }>;

/** Lecture ou transaction · tout se lit par le même client, sous le verrou quand il y en a un. */
type ClientLecture = Pick<Prisma.TransactionClient, 'tenant' | 'abonnementCabinet' | 'message'>;

/**
 * La commande gardée avec l'acceptation, relue · une colonne JSON écrite par
 * ce service seul. Ce qui n'en a pas la forme est rendu `null`, jamais deviné.
 */
function commandeGardee(json: Prisma.JsonValue | null): DetailCommande | null {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return null;
  const c = json as Record<string, unknown>;
  if (typeof c.formule !== 'string' || typeof c.periodicite !== 'string' || !Array.isArray(c.options)) return null;
  return c as unknown as DetailCommande;
}

/**
 * L'ACCEPTATION DES CONDITIONS DE LICENCE PAR UN DOSSIER (ligne
 * pages-legales). Les règles sont dans `acceptation-conditions.ts` · ce
 * service lit, décide par elles, écrit, et accuse réception.
 *
 * L'ACTE S'ÉCRIT SUR LE DOSSIER, PAR UNE MISE À JOUR UNITAIRE · `Tenant` est
 * audité, et c'est son maillon qui garde l'historique (qui, quand, d'où, et la
 * commande acceptée), un `updateMany` n'y laissant que filtre et compte. TOUT
 * SE DÉCIDE SOUS LE VERROU CONSULTATIF DU DOSSIER (second tour, M-a) · le
 * contexte, la commande et l'acceptation déjà faite sont relus dans la
 * transaction qui écrit, si bien qu'un second clic attend le premier, et qu'un
 * prix changé entre la lecture de l'écran et le clic est vu et refusé.
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
  private async commande(client: ClientLecture, tenantId: string, dossierMereId: string | null): Promise<DetailCommande | null> {
    // Lu sur la clé du dossier (`cabinetId`), ou de son siège · un modèle
    // hors dossier (`MODELES_HORS_DOSSIER`), que la console de l'éditeur
    // tient. Seuls la formule, les options et les dates sortent · jamais le
    // tiers facturé, qui est une fiche du dossier de l'éditeur.
    const cabinetId = dossierMereId ?? tenantId;
    const a = await client.abonnementCabinet.findUnique({
      where: { cabinetId },
      select: {
        periodicite: true,
        debut: true,
        finEssai: true,
        actif: true,
        dossiersSupplementaires: true,
        formule: { select: SELECT_FORMULE },
        options: { select: { formule: { select: SELECT_FORMULE } } },
      },
    });
    if (!a) return null;
    const prix = (f: FormuleLue): FormulePrix => ({
      code: f.code,
      libelle: f.libelle,
      type: FORMULES[f.type],
      prixMensuelUsd: nombre(f.prixMensuelUsd),
      prixAnnuelUsd: nombre(f.prixAnnuelUsd),
    });
    const aFacturer: AbonnementAFacturer = {
      formule: prix(a.formule),
      options: a.options.map((o) => prix(o.formule)),
      dossiersSupplementaires: a.dossiersSupplementaires,
      periodicite: a.periodicite,
      debut: jour(a.debut),
      finEssai: jour(a.finEssai),
      actif: a.actif,
    };
    return detailCommande(aFacturer, dossierMereId !== null);
  }

  private async lire(
    client: ClientLecture,
    tenantId: string,
  ): Promise<{ acceptation: AcceptationEnregistree | null; contexte: ContexteAcceptation; nom: string }> {
    const t = await client.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nom: true,
        estDemonstration: true,
        dossierMereId: true,
        conditionsLicenceVersion: true,
        conditionsLicenceEmpreinte: true,
        conditionsLicenceAccepteesLe: true,
        conditionsLicenceAccepteesPar: true,
        conditionsLicenceCommande: true,
        licence: { select: { type: true } },
      },
    });
    if (!t) throw new NotFoundException('Dossier introuvable.');
    const acceptation: AcceptationEnregistree | null =
      t.conditionsLicenceVersion !== null && t.conditionsLicenceAccepteesLe !== null
        ? {
            version: t.conditionsLicenceVersion,
            empreinte: t.conditionsLicenceEmpreinte,
            le: t.conditionsLicenceAccepteesLe.toISOString(),
            par: t.conditionsLicenceAccepteesPar,
            commande: commandeGardee(t.conditionsLicenceCommande),
          }
        : null;
    const contexte: ContexteAcceptation = {
      mentions: mentionsAArreter(),
      typeLicence: t.licence ? LICENCES[t.licence.type] : null,
      estDemonstration: t.estDemonstration === true,
      surSite: estSurSite(),
      commande: await this.commande(client, tenantId, t.dossierMereId),
    };
    return { acceptation, contexte, nom: t.nom };
  }

  async etat(tenantId: string): Promise<EtatConditions> {
    const { acceptation, contexte } = await this.lire(this.prisma, tenantId);
    return etatConditions(acceptation, contexte, await this.dernierAccuse(this.prisma, tenantId, acceptation));
  }

  /**
   * Le dernier accusé mis en file DEPUIS l'acceptation enregistrée · un accusé
   * d'une acceptation antérieure ne vaut pas pour celle-ci. Lu dans la file
   * du dossier, sur son origine (`ORIGINE_CONDITIONS_LICENCE`).
   */
  private async dernierAccuse(client: ClientLecture, tenantId: string, acceptation: AcceptationEnregistree | null): Promise<AccuseEnFile | null> {
    if (!acceptation) return null;
    const m = await client.message.findFirst({
      where: { tenantId, origine: ORIGINE_CONDITIONS_LICENCE, origineId: tenantId, createdAt: { gte: new Date(acceptation.le) } },
      orderBy: { createdAt: 'desc' },
      select: { statut: true, createdAt: true },
    });
    return m ? { statut: STATUTS[m.statut], le: m.createdAt.toISOString() } : null;
  }

  /**
   * RENVOYER L'ACCUSÉ (relecture, mineur 5) · un accusé qui n'a jamais pu
   * entrer en file, ou que la file a abandonné, ne laissait aucune issue. Le
   * geste le remet en file, à l'adresse de l'auteur de l'acceptation, sous les
   * refus de `motifRefusRenvoiAccuse` (jamais un doublon). SOUS LE VERROU DU
   * DOSSIER, l'accusé relu et écrit dans la même transaction (second tour,
   * m-1) · deux clics ne mettent pas deux accusés en file. Écrit sans tentative
   * d'envoi (`ecrireEnFileSansTenter`) · il part à la prochaine reprise de la
   * file, ou attend une messagerie.
   */
  async renvoyerAccuse(
    tenantId: string,
    auteur: { userId: string; email: string },
  ): Promise<{ etat: EtatConditions; accuse: { statut: StatutAccuse } | null }> {
    const courrier = this.courrier;
    const r = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conditions-licence:${tenantId}`}))`;
      const { acceptation, contexte, nom } = await this.lire(tx, tenantId);
      const dernier = await this.dernierAccuse(tx, tenantId, acceptation);
      const refus = motifRefusRenvoiAccuse(acceptation, estAJour(acceptation), dernier);
      if (refus || !acceptation) throw new ConflictException(refus ?? 'Aucune acceptation à accuser.');
      if (!courrier) return { acceptation, contexte, accuse: null };
      try {
        const [ecrit] = await courrier.ecrireEnFileSansTenter(tx, tenantId, [
          {
            destinataire: acceptation.par ?? auteur.email,
            ...accuseReceptionConditions(acceptation, nom),
            origine: ORIGINE_CONDITIONS_LICENCE,
            origineId: tenantId,
            createdBy: auteur.userId,
          },
        ]);
        if (ecrit.statut === null) {
          this.consignerAccuseManque(tenantId, acceptation.version, ecrit.motif);
          return { acceptation, contexte, accuse: { statut: 'NON_MIS_EN_FILE' as const } };
        }
        return { acceptation, contexte, accuse: { statut: STATUTS[ecrit.statut] } };
      } catch (erreur) {
        this.consignerAccuseManque(tenantId, acceptation.version, erreur);
        return { acceptation, contexte, accuse: { statut: 'NON_MIS_EN_FILE' as const } };
      }
    });
    return {
      etat: etatConditions(r.acceptation, r.contexte, await this.dernierAccuse(this.prisma, tenantId, r.acceptation)),
      accuse: r.accuse,
    };
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
    empreinteCommandeLue: string,
  ): Promise<{ etat: EtatConditions; deja: boolean; accuse: { statut: StatutAccuse } | null }> {
    const resultat = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conditions-licence:${tenantId}`}))`;
      // Relu SOUS le verrou · le contexte qui décide est celui que la
      // transaction écrit (second tour, M-a).
      const { acceptation, contexte, nom } = await this.lire(tx, tenantId);
      // Déjà acceptée · même numéro ET même empreinte. Le numéro seul aurait
      // gardé l'acceptation d'un autre texte (relecture M2).
      if (acceptation && estAJour(acceptation)) return { deja: true, acceptation, contexte, nom };
      const refus = motifRefusAcceptation(versionLue, empreinteLue, empreinteCommandeLue, contexte);
      if (refus) throw new ConflictException(refus);
      const le = new Date();
      const empreinte = empreinteEnVigueur();
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          conditionsLicenceVersion: VERSION_CONDITIONS_LICENCE.numero,
          conditionsLicenceEmpreinte: empreinte,
          conditionsLicenceAccepteesLe: le,
          conditionsLicenceAccepteesPar: auteur.email,
          // La commande vérifiée et acceptée · gardée avec l'acte, au journal
          // d'audit avec lui, et recopiée dans l'accusé (art. 55).
          conditionsLicenceCommande: contexte.commande === null ? Prisma.DbNull : (contexte.commande as unknown as Prisma.InputJsonObject),
        },
      });
      const faite: AcceptationEnregistree = {
        version: VERSION_CONDITIONS_LICENCE.numero,
        empreinte,
        le: le.toISOString(),
        par: auteur.email,
        commande: contexte.commande,
      };
      return { deja: false, acceptation: faite, contexte, nom };
    });

    const accuse = resultat.deja ? null : await this.accuserReception(tenantId, auteur.email, auteur.userId, resultat.acceptation, resultat.nom);
    return {
      etat: etatConditions(resultat.acceptation, resultat.contexte, await this.dernierAccuse(this.prisma, tenantId, resultat.acceptation)),
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
  ): Promise<{ statut: StatutAccuse } | null> {
    if (!this.courrier) return null;
    try {
      const r = await this.courrier.mettreEnFile(tenantId, {
        destinataire,
        ...accuseReceptionConditions(acceptation, dossier),
        origine: ORIGINE_CONDITIONS_LICENCE,
        origineId: tenantId,
        createdBy,
      });
      return { statut: STATUTS[r.statut] };
    } catch (erreur) {
      this.consignerAccuseManque(tenantId, acceptation.version, erreur);
      return { statut: 'NON_MIS_EN_FILE' };
    }
  }

  /** Une ERREUR, et nommée · c'est l'accusé que la loi exige qui manque (art. 55, al. 2), et l'écran offre de le renvoyer. */
  private consignerAccuseManque(tenantId: string, version: number, cause: unknown): void {
    this.logger.error(
      `Accusé de réception des conditions non mis en file · dossier ${tenantId}, version ${version} · ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}
