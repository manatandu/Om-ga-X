import { createHash } from 'crypto';
import { Prisma, Referentiel, RoleUtilisateur, StatutExercice, StatutInvitationDossier, User } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { horsCloisonnement } from '../../common/cloisonnement/contexte-cloisonnement';
import { acteurCourant, ActeurAudit, dansContexteAudit } from '../../common/audit/contexte-audit';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import type { PrismaService } from '../../common/prisma.service';
import { LicenceService } from '../licence/licence.service';

/**
 * UNE PERSONNE, PLUSIEURS DOSSIERS (ligne multi-dossiers, décision de Manasse
 * du 2026-10-30, D9, gel levé le 2026-11-01).
 *
 * Chaque APPARTENANCE d'une personne à un dossier est une ligne `User` DE CE
 * DOSSIER · rôle, profil de fonctions, journaux autorisés, logiciels
 * attribués, actif et révocation des sessions DU dossier y restent, et tout ce
 * qui, dans le dossier, lit ses utilisateurs (liste, dernier administrateur,
 * auteur des écritures, présence, messagerie) les voit sans changer d'une
 * ligne. Ce qui est COMMUN à la personne · adresse de connexion, mot de passe,
 * second facteur, verrou, mot de passe provisoire, révocation de la personne
 * (`sessionsDuCompteInvalidesAvant`) · vit sur SA PREMIÈRE ligne, le COMPTE
 * DE CONNEXION (`compteDeConnexionId` nul). Une appartenance ajoutée dans un
 * autre dossier pointe ce compte, et elle ne naît QUE de l'acceptation, par la
 * personne, d'une invitation reçue à son adresse (`utilisateurs/invitations.ts`).
 *
 * CE FICHIER EST LA SEULE SORTIE DE CLOISONNEMENT DE LA LIGNE, et chaque
 * fonction la borne à UNE personne, désignée par une ligne que la session
 * possède déjà (son `sub`), par l'adresse que la connexion présente, ou par un
 * jeton d'invitation reçu à cette adresse. Rien n'y est reçu d'un appelant qui
 * désignerait un autre dossier que ceux de la personne. Le spec du
 * cloisonnement gèle la présence de ce fichier dans la liste des sorties.
 */

/** Le compte de connexion d'une ligne · l'id qu'elle pointe, ou le sien. */
export function idDuCompteDeConnexion(ligne: { id: string; compteDeConnexionId?: string | null }): string {
  return ligne.compteDeConnexionId ?? ligne.id;
}

/**
 * L'ACTEUR D'UN ACTE SUR LE COMPTE DE CONNEXION · la personne elle-même, dans
 * le dossier où vit son compte. Un acte posé depuis un autre de ses dossiers
 * s'inscrit ainsi dans la chaîne du dossier d'origine sous un acteur que ce
 * dossier connaît, jamais sous l'identifiant d'une ligne d'un autre dossier
 * (qui y dirait l'existence de ce dossier-là).
 */
export function acteurDuCompte(compte: { id: string; email: string; tenantId: string }): ActeurAudit {
  return { acteurId: compte.id, acteurEmail: compte.email, tenantId: compte.tenantId, adresseIp: acteurCourant()?.adresseIp };
}

/**
 * La ligne qui porte le mot de passe, le second facteur et le verrou de la
 * personne qui tient la session. Une ligne qui est son propre compte se rend
 * telle quelle, sans requête · le chemin d'un utilisateur d'un seul dossier
 * ne change pas.
 */
export async function compteDeConnexionDe(prisma: PrismaService, ligne: User): Promise<User | null> {
  if (!ligne.compteDeConnexionId) return ligne;
  const id = ligne.compteDeConnexionId;
  return horsCloisonnement('compte de connexion · la personne de la session, dans son dossier d’origine', () =>
    prisma.user.findUnique({ where: { id } }),
  );
}

/** L'adresse désigne un compte de connexion, ou rien. */
export function trouverCompteDeConnexion(
  prisma: PrismaService,
  adresse: string,
  raison = 'connexion · le dossier n’est pas encore connu',
): Promise<User | null> {
  return horsCloisonnement(raison, () => prisma.user.findUnique({ where: { courrielDeConnexion: adresse } }));
}

/**
 * LA CONNEXION D'UNE PERSONNE QUI A DES APPARTENANCES AILLEURS NE SE TIENT
 * QUE PAR ELLE (relecture de sécurité du 2026-11-01, C1, E2) · une ligne
 * rattachée, ou un compte de connexion que d'autres dossiers pointent.
 * Réinitialiser, déverrouiller, lever le second facteur depuis un dossier
 * revenait sinon à prendre la main sur ses accès aux dossiers d'un autre
 * client (l'administrateur choisit le mot de passe, se connecte, change de
 * dossier). Lu sans dire lesquels ni combien.
 */
export async function connexionTenueParLaPersonne(prisma: PrismaService, ligne: { id: string; compteDeConnexionId?: string | null }): Promise<boolean> {
  if (ligne.compteDeConnexionId) return true;
  const id = ligne.id;
  const n = await horsCloisonnement('appartenances · le compte a-t-il des appartenances ailleurs', () =>
    prisma.user.count({ where: { compteDeConnexionId: id } }),
  );
  return n > 0;
}

export const MOTIF_CONNEXION_TENUE_PAR_LA_PERSONNE =
  "Ce compte donne accès à d'autres dossiers · la personne gère elle-même son mot de passe, son verrou et son second " +
  'facteur. Vous pouvez la désactiver ou la déconnecter dans votre dossier.';

export interface Appartenance {
  id: string;
  tenantId: string;
  role: RoleUtilisateur;
  estActif: boolean;
  sessionsInvalidesAvant: Date | null;
  compteDeConnexionId: string | null;
  createdAt: Date;
}

const SELECTION_APPARTENANCE = {
  id: true,
  tenantId: true,
  role: true,
  estActif: true,
  sessionsInvalidesAvant: true,
  compteDeConnexionId: true,
  createdAt: true,
} as const;

/** Convention d'OmegaX · au-delà, la liste se dit tronquée (§ 8 bis). */
export const BORNE_APPARTENANCES = 200;

const appartenanceDe = (compteId: string): Prisma.UserWhereInput => ({ OR: [{ id: compteId }, { compteDeConnexionId: compteId }] });

/**
 * Les appartenances de la personne, compte de connexion compris, les plus
 * anciennes d'abord, bornées · la session de connexion s'ouvre sur la
 * première active. `total` dit le compte entier.
 */
export async function appartenancesDeLaPersonne(
  prisma: PrismaService,
  compteId: string,
): Promise<{ lignes: Appartenance[]; total: number }> {
  return horsCloisonnement('appartenances · les dossiers de la seule personne qui se connecte', async () => {
    const [lignes, total] = await Promise.all([
      prisma.user.findMany({
        where: appartenanceDe(compteId),
        select: SELECTION_APPARTENANCE,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: BORNE_APPARTENANCES,
      }),
      prisma.user.count({ where: { ...appartenanceDe(compteId), estActif: true } }),
    ]);
    return { lignes, total };
  });
}

/** La session s'ouvre sur le compte de connexion s'il est actif, sinon sur la plus ancienne appartenance active. */
export function appartenanceDeConnexion(compteId: string, appartenances: readonly Appartenance[]): Appartenance | null {
  const actives = appartenances.filter((a) => a.estActif);
  return actives.find((a) => a.id === compteId) ?? actives[0] ?? null;
}

/** L'appartenance ACTIVE de la personne dans un dossier qu'elle désigne, ou rien · lue par le dossier, sans borne. */
export function appartenanceDansLeDossier(prisma: PrismaService, compteId: string, dossierId: string): Promise<Appartenance | null> {
  return horsCloisonnement('appartenances · la personne dans un de SES dossiers', () =>
    prisma.user.findFirst({ where: { tenantId: dossierId, estActif: true, ...appartenanceDe(compteId) }, select: SELECTION_APPARTENANCE }),
  );
}

export type AccesDuDossier = 'NORMAL' | 'LECTURE_SEULE' | 'FERME';

export interface DossierDeLaPersonne {
  dossierId: string;
  nom: string;
  referentiel: Referentiel;
  role: RoleUtilisateur;
  /** L'exercice OUVERT le plus récent · `null` quand aucun ne l'est. */
  exercice: { dateDebut: Date; dateFin: Date } | null;
  /** Le dossier de la session en cours. */
  courant: boolean;
  /** La licence du dossier · lecture seule (abonnement échu), fermée (suspendue, ou aucune). */
  acces: AccesDuDossier;
  /** Le motif de la licence, quand l'accès n'est pas normal. */
  motifAcces: string | null;
}

/**
 * « L'ACCUEIL DU CABINET SUR SES DOSSIERS » · la liste des dossiers de la
 * personne, et d'elle seule · nom, référentiel, exercice ouvert le plus
 * récent, rôle et état de la licence. Une appartenance désactivée n'y paraît
 * pas · le dossier n'est plus le sien. Bornée, et elle le dit ; un dossier
 * dont la ligne ne se relit pas est COMPTÉ (`introuvables`), jamais tu.
 */
export async function dossiersDeLaPersonne(
  prisma: PrismaService,
  compteId: string,
  dossierCourant: string,
  juge: Pick<LicenceService, 'evaluerLicence'>,
): Promise<{ dossiers: DossierDeLaPersonne[]; total: number; tronque: boolean; introuvables: number }> {
  const { lignes, total } = await appartenancesDeLaPersonne(prisma, compteId);
  const actives = lignes.filter((a) => a.estActif);
  if (actives.length === 0) return { dossiers: [], total, tronque: false, introuvables: 0 };
  const ids = actives.map((a) => a.tenantId);
  const [dossiers, exercices] = await horsCloisonnement('appartenances · nom, exercice et licence des seuls dossiers de la personne', () =>
    Promise.all([
      prisma.tenant.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true, referentiel: true, licence: true } }),
      prisma.exercice.findMany({
        where: { tenantId: { in: ids }, statut: StatutExercice.OUVERT },
        select: { tenantId: true, dateDebut: true, dateFin: true },
        orderBy: { dateDebut: 'desc' },
      }),
    ]),
  );
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const exercice = new Map<string, { dateDebut: Date; dateFin: Date }>();
  for (const e of exercices) if (!exercice.has(e.tenantId)) exercice.set(e.tenantId, { dateDebut: e.dateDebut, dateFin: e.dateFin });
  const servis = actives
    .filter((a) => parId.has(a.tenantId))
    .map((a) => {
      const d = parId.get(a.tenantId)!;
      const l = juge.evaluerLicence(d.licence);
      const acces: AccesDuDossier = l.autorise ? 'NORMAL' : l.lectureSeule ? 'LECTURE_SEULE' : 'FERME';
      return {
        dossierId: a.tenantId,
        nom: d.nom,
        referentiel: d.referentiel,
        role: a.role,
        exercice: exercice.get(a.tenantId) ?? null,
        courant: a.tenantId === dossierCourant,
        acces,
        motifAcces: acces === 'NORMAL' ? null : (l.motif ?? null),
      };
    })
    .sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
  return { dossiers: servis, total, tronque: total > actives.length, introuvables: actives.length - servis.length };
}

/** La personne a-t-elle plus d'un dossier actif ? Lu par `/auth/me`. */
export async function aPlusieursDossiers(prisma: PrismaService, compteId: string): Promise<boolean> {
  const n = await horsCloisonnement('appartenances · combien de dossiers a la personne de la session', () =>
    prisma.user.count({ where: { ...appartenanceDe(compteId), estActif: true } }),
  );
  return n > 1;
}

/**
 * L'ADRESSE DE CONNEXION SE RECOPIE SUR LES APPARTENANCES · chaque dossier
 * affiche l'adresse de ses utilisateurs (liste, « Saisie par »). Une mise à
 * jour UNITAIRE par appartenance (relecture « échecs silencieux », M2) ·
 * chacune s'inscrit dans la chaîne de SON dossier, sous l'acteur qu'est la
 * personne dans ce dossier, et aucune chaîne ne lit combien la personne en a
 * ailleurs. Dans la transaction du changement · une adresse déjà utilisatrice
 * d'un de ces dossiers fait tomber l'ensemble sur la contrainte d'unicité.
 */
export async function recopierLAdresse(tx: Prisma.TransactionClient, compteId: string, adresse: string): Promise<void> {
  const lignes = await horsCloisonnement('appartenances · les lignes à qui recopier l’adresse changée par son titulaire', () =>
    tx.user.findMany({ where: { compteDeConnexionId: compteId }, select: { id: true, tenantId: true }, take: BORNE_APPARTENANCES + 1 }),
  );
  if (lignes.length > BORNE_APPARTENANCES) {
    throw new ConflictException(`Plus de ${BORNE_APPARTENANCES} dossiers à mettre à jour · l'adresse n'a pas été changée.`);
  }
  for (const l of lignes) {
    await horsCloisonnement('appartenances · l’adresse changée par son titulaire, recopiée dans un de ses dossiers', () =>
      dansContexteAudit({ acteurId: l.id, acteurEmail: adresse, tenantId: l.tenantId, adresseIp: acteurCourant()?.adresseIp }, async () =>
        tx.user.update({ where: { id: l.id }, data: { email: adresse } }),
      ),
    );
  }
}

/**
 * L'APPARTENANCE NAÎT DANS LE DOSSIER QUI A INVITÉ et pointe le compte de
 * connexion, qui vit dans un autre · la garde des clés étrangères refuserait
 * le lien, d'où la sortie, bornée à la création de CETTE ligne dans CE
 * dossier. Le mot de passe de la ligne est une empreinte tirée au sort, jamais
 * lue · la personne garde le sien.
 */
export function creerAppartenance(
  client: Pick<PrismaService, 'user'> | Prisma.TransactionClient,
  donnees: { tenantId: string; email: string; motDePasse: string; role: RoleUtilisateur; compteDeConnexionId: string },
  select: Prisma.UserSelect,
) {
  return horsCloisonnement('appartenances · une personne rattachée au dossier, par son consentement', () =>
    client.user.create({ data: { ...donnees, doitChangerMotDePasse: false }, select }),
  );
}

/**
 * Le second facteur des comptes de connexion des lignes rattachées d'un
 * dossier (relecture de sécurité, F3) · lu pour la liste du dossier, rien de
 * plus que la date d'activation.
 */
export async function secondFacteurDesComptes(prisma: PrismaService, ids: readonly string[]): Promise<Map<string, Date | null>> {
  if (ids.length === 0) return new Map();
  const comptes = await horsCloisonnement('appartenances · le second facteur du compte des personnes rattachées au dossier', () =>
    prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, doubleAuthActiveDepuis: true } }),
  );
  return new Map(comptes.map((c) => [c.id, c.doubleAuthActiveDepuis]));
}

/** Parmi des comptes de connexion d'un dossier, ceux que d'autres dossiers pointent · rien de plus que leur id. */
export async function comptesOuvrantDAutresDossiers(prisma: PrismaService, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const lus = await horsCloisonnement('appartenances · les comptes du dossier qui ouvrent aussi d’autres dossiers', () =>
    prisma.user.groupBy({ by: ['compteDeConnexionId'], where: { compteDeConnexionId: { in: [...ids] } } }),
  );
  return new Set(lus.map((l) => l.compteDeConnexionId).filter((x): x is string => !!x));
}

// ── INVITATIONS, CÔTÉ DE LA PERSONNE ───────────────────────────────────────

export const empreinteDuJeton = (jeton: string) => createHash('sha256').update(jeton, 'utf8').digest('hex');

export interface InvitationRecue {
  id: string;
  dossier: string;
  role: RoleUtilisateur;
  expireLe: Date;
}

/** Les invitations en attente adressées à la personne · nom du dossier, rôle, échéance. */
export async function invitationsRecues(prisma: PrismaService, adresse: string, maintenant = new Date()): Promise<InvitationRecue[]> {
  const lues = await horsCloisonnement('invitations · celles adressées à la personne de la session', () =>
    prisma.invitationDossier.findMany({
      where: { email: adresse, statut: StatutInvitationDossier.EN_ATTENTE, expireLe: { gt: maintenant } },
      select: { id: true, role: true, expireLe: true, tenant: { select: { nom: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  );
  return lues.map((i) => ({ id: i.id, dossier: i.tenant.nom, role: i.role, expireLe: i.expireLe }));
}

export const MOTIF_INVITATION_INVALIDE = 'Invitation introuvable, déjà utilisée ou échue · demandez-en une nouvelle.';

/** L'invitation que le jeton désigne, encore valable, ou un 404 qui ne dit pas pourquoi. */
async function invitationValable(prisma: PrismaService | Prisma.TransactionClient, jeton: string, maintenant: Date) {
  const empreinte = empreinteDuJeton(jeton);
  const inv = await horsCloisonnement('invitations · celle que désigne un jeton reçu par courriel', () =>
    prisma.invitationDossier.findUnique({ where: { empreinteJeton: empreinte } }),
  );
  if (!inv || inv.statut !== StatutInvitationDossier.EN_ATTENTE || inv.expireLe <= maintenant) throw new NotFoundException(MOTIF_INVITATION_INVALIDE);
  return inv;
}

/** Une seule décision par invitation · la ligne passe d'« en attente » à son issue, ou rien. */
async function decider(tx: Prisma.TransactionClient, id: string, statut: StatutInvitationDossier, maintenant: Date) {
  const { count } = await tx.invitationDossier.updateMany({
    where: { id, statut: StatutInvitationDossier.EN_ATTENTE },
    data: { statut, decideLe: maintenant },
  });
  if (count !== 1) throw new ConflictException(MOTIF_INVITATION_INVALIDE);
}

/**
 * ACCEPTER, CONNECTÉ · le jeton (reçu à la seule adresse de la personne) ET la
 * session dont le compte de connexion porte cette adresse. Le jeton ferme la
 * porte à qui tiendrait le compte sans tenir la boîte (compte créé d'avance
 * par un tiers sous l'adresse d'un autre) ; la session, à qui tiendrait la
 * boîte sans le compte. L'appartenance naît au journal d'audit du dossier qui
 * a invité, sous l'adresse de la personne.
 */
export async function accepterInvitation(
  prisma: PrismaService,
  compte: { id: string; email: string; tenantId: string },
  jeton: string,
  motDePasseTire: string,
  select: Prisma.UserSelect,
  maintenant = new Date(),
): Promise<{ dossierId: string }> {
  const inv = await invitationValable(prisma, jeton, maintenant);
  if (inv.email !== compte.email) throw new NotFoundException(MOTIF_INVITATION_INVALIDE);
  return horsCloisonnement('invitations · acceptation par la personne invitée', () =>
    dansContexteAudit({ acteurEmail: compte.email, tenantId: inv.tenantId, adresseIp: acteurCourant()?.adresseIp }, () =>
      transactionJournalisee(prisma, async (tx) => {
        await decider(tx, inv.id, StatutInvitationDossier.ACCEPTEE, maintenant);
        const deja = await tx.user.findFirst({ where: { tenantId: inv.tenantId, email: inv.email }, select: { id: true } });
        if (!deja) {
          await creerAppartenance(tx, { tenantId: inv.tenantId, email: inv.email, motDePasse: motDePasseTire, role: inv.role, compteDeConnexionId: compte.id }, select);
        }
        return { dossierId: inv.tenantId };
      }),
    ),
  );
}

/** REFUSER · même preuve que l'acceptation · un tiers qui tiendrait le compte sans la boîte ne refuse rien. */
export async function refuserInvitation(prisma: PrismaService, compte: { email: string }, jeton: string, maintenant = new Date()): Promise<void> {
  const inv = await invitationValable(prisma, jeton, maintenant);
  if (inv.email !== compte.email) throw new NotFoundException(MOTIF_INVITATION_INVALIDE);
  await horsCloisonnement('invitations · refus par la personne invitée', () =>
    dansContexteAudit({ acteurEmail: compte.email, tenantId: inv.tenantId }, () =>
      transactionJournalisee(prisma, (tx) => decider(tx, inv.id, StatutInvitationDossier.REFUSEE, maintenant)),
    ),
  );
}

export const MOTIF_COMPTE_DEJA_EXISTANT =
  'Cette adresse a déjà un compte OmegaX · connectez-vous, puis acceptez l’invitation depuis la liste de vos dossiers avec ce même lien.';

/**
 * UNE ADRESSE NEUVE ACCEPTE EN CHOISISSANT SON MOT DE PASSE · le compte naît
 * dans le dossier qui a invité, avec le rôle de l'invitation, son mot de passe
 * choisi par la personne (aucun mot de passe provisoire n'a transité). Si
 * l'adresse a un compte depuis, le refus le dit au seul porteur du jeton,
 * c'est-à-dire à la personne.
 */
export async function creerCompteParInvitation(
  prisma: PrismaService,
  jeton: string,
  motDePasseHache: string,
  maintenant = new Date(),
): Promise<{ dossierId: string; email: string }> {
  const inv = await invitationValable(prisma, jeton, maintenant);
  if (await trouverCompteDeConnexion(prisma, inv.email, 'invitations · une adresse neuve n’a pas de compte')) {
    throw new ConflictException(MOTIF_COMPTE_DEJA_EXISTANT);
  }
  try {
    return await horsCloisonnement('invitations · compte créé par la personne invitée', () =>
      dansContexteAudit({ acteurEmail: inv.email, tenantId: inv.tenantId }, () =>
        transactionJournalisee(prisma, async (tx) => {
          await decider(tx, inv.id, StatutInvitationDossier.ACCEPTEE, maintenant);
          await tx.user.create({ data: { tenantId: inv.tenantId, email: inv.email, motDePasse: motDePasseHache, role: inv.role } });
          return { dossierId: inv.tenantId, email: inv.email };
        }),
      ),
    );
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') throw new ConflictException(MOTIF_COMPTE_DEJA_EXISTANT);
    throw e;
  }
}
