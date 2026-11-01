import { Prisma, Referentiel, RoleUtilisateur, StatutExercice, User } from '@prisma/client';
import { horsCloisonnement } from '../../common/cloisonnement/contexte-cloisonnement';
import type { PrismaService } from '../../common/prisma.service';

/**
 * UNE PERSONNE, PLUSIEURS DOSSIERS (ligne multi-dossiers, décision de Manasse
 * du 2026-10-30, D9, gel levé le 2026-11-01).
 *
 * Chaque APPARTENANCE d'une personne à un dossier est une ligne `User` DE CE
 * DOSSIER · rôle, profil de fonctions, journaux autorisés, logiciels
 * attribués, actif et révocation des sessions y restent, et tout ce qui, dans
 * le dossier, lit ses utilisateurs (liste, dernier administrateur, auteur des
 * écritures, présence, messagerie) les voit sans changer d'une ligne. Ce qui
 * est COMMUN à la personne · adresse de connexion, mot de passe, second
 * facteur, verrou, mot de passe provisoire · vit sur SA PREMIÈRE ligne, le
 * COMPTE DE CONNEXION (`compteDeConnexionId` nul). Une appartenance ajoutée
 * dans un autre dossier pointe ce compte.
 *
 * CE FICHIER EST LA SEULE SORTIE DE CLOISONNEMENT DE LA LIGNE, et chaque
 * fonction la borne à UNE personne, désignée par une ligne que la session
 * possède déjà (son `sub`) ou par l'adresse que la connexion présente. Rien
 * n'y est reçu d'un appelant qui désignerait un autre dossier que ceux de la
 * personne · le changement de dossier ne cherche que parmi SES appartenances.
 * Le spec du cloisonnement gèle la présence de ce fichier dans la liste des
 * sorties.
 */

/** Le compte de connexion d'une ligne · l'id qu'elle pointe, ou le sien. */
export function idDuCompteDeConnexion(ligne: { id: string; compteDeConnexionId?: string | null }): string {
  return ligne.compteDeConnexionId ?? ligne.id;
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

/** La connexion · l'adresse désigne un compte de connexion, ou rien. */
export function trouverCompteDeConnexion(
  prisma: PrismaService,
  adresse: string,
  raison = 'connexion · le dossier n’est pas encore connu',
): Promise<User | null> {
  return horsCloisonnement(raison, () =>
    prisma.user.findUnique({ where: { courrielDeConnexion: adresse } }),
  );
}

export interface Appartenance {
  id: string;
  tenantId: string;
  role: RoleUtilisateur;
  estActif: boolean;
  sessionsInvalidesAvant: Date | null;
  createdAt: Date;
}

const SELECTION_APPARTENANCE = {
  id: true,
  tenantId: true,
  role: true,
  estActif: true,
  sessionsInvalidesAvant: true,
  createdAt: true,
} as const;

/**
 * Les appartenances de la personne, compte de connexion compris, les plus
 * anciennes d'abord · la session de connexion s'ouvre sur la première active.
 */
export function appartenancesDeLaPersonne(prisma: PrismaService, compteId: string): Promise<Appartenance[]> {
  return horsCloisonnement('appartenances · les dossiers de la seule personne qui se connecte', () =>
    prisma.user.findMany({
      where: { OR: [{ id: compteId }, { compteDeConnexionId: compteId }] },
      select: SELECTION_APPARTENANCE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  );
}

/** La session s'ouvre sur le compte de connexion s'il est actif, sinon sur la plus ancienne appartenance active. */
export function appartenanceDeConnexion(compteId: string, appartenances: readonly Appartenance[]): Appartenance | null {
  const actives = appartenances.filter((a) => a.estActif);
  return actives.find((a) => a.id === compteId) ?? actives[0] ?? null;
}

/** L'appartenance ACTIVE de la personne dans un dossier qu'elle désigne, ou rien. */
export async function appartenanceDansLeDossier(
  prisma: PrismaService,
  compteId: string,
  dossierId: string,
): Promise<Appartenance | null> {
  const lignes = await appartenancesDeLaPersonne(prisma, compteId);
  return lignes.find((l) => l.tenantId === dossierId && l.estActif) ?? null;
}

export interface DossierDeLaPersonne {
  dossierId: string;
  nom: string;
  referentiel: Referentiel;
  role: RoleUtilisateur;
  /** L'exercice OUVERT le plus récent · `null` quand aucun ne l'est. */
  exercice: { dateDebut: Date; dateFin: Date } | null;
  /** Le dossier de la session en cours. */
  courant: boolean;
}

/**
 * « L'ACCUEIL DU CABINET SUR SES DOSSIERS » · la liste des dossiers de la
 * personne, et d'elle seule · nom, référentiel, exercice ouvert le plus
 * récent et rôle. Une appartenance désactivée n'y paraît pas · le dossier
 * n'est plus le sien.
 */
export async function dossiersDeLaPersonne(
  prisma: PrismaService,
  compteId: string,
  dossierCourant: string,
): Promise<DossierDeLaPersonne[]> {
  const actives = (await appartenancesDeLaPersonne(prisma, compteId)).filter((a) => a.estActif);
  if (actives.length === 0) return [];
  const ids = actives.map((a) => a.tenantId);
  const [dossiers, exercices] = await horsCloisonnement('appartenances · nom et exercice des seuls dossiers de la personne', () =>
    Promise.all([
      prisma.tenant.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true, referentiel: true } }),
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
  return actives
    .filter((a) => parId.has(a.tenantId))
    .map((a) => ({
      dossierId: a.tenantId,
      nom: parId.get(a.tenantId)!.nom,
      referentiel: parId.get(a.tenantId)!.referentiel,
      role: a.role,
      exercice: exercice.get(a.tenantId) ?? null,
      courant: a.tenantId === dossierCourant,
    }))
    .sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
}

/** La personne a-t-elle plus d'un dossier actif ? Lu par `/auth/me`. */
export async function aPlusieursDossiers(prisma: PrismaService, compteId: string): Promise<boolean> {
  const n = await horsCloisonnement('appartenances · combien de dossiers a la personne de la session', () =>
    prisma.user.count({ where: { OR: [{ id: compteId }, { compteDeConnexionId: compteId }], estActif: true } }),
  );
  return n > 1;
}

/**
 * L'ADRESSE DE CONNEXION SE RECOPIE SUR LES APPARTENANCES · chaque dossier
 * affiche l'adresse de ses utilisateurs (liste, « Saisie par »), et une
 * adresse changée par son titulaire doit s'y lire. Dans la transaction du
 * changement · une adresse déjà utilisateur d'un de ces dossiers fait tomber
 * l'ensemble sur la contrainte d'unicité, et rien n'est changé.
 */
export function recopierLAdresse(tx: Prisma.TransactionClient, compteId: string, adresse: string) {
  return horsCloisonnement('appartenances · l’adresse changée par son titulaire, recopiée dans ses dossiers', () =>
    tx.user.updateMany({ where: { compteDeConnexionId: compteId }, data: { email: adresse } }),
  );
}

/**
 * LE DOSSIER D'ACCUEIL DE L'APPARTENANCE RATTACHÉE · la ligne naît dans le
 * dossier de la session et pointe le compte de connexion, qui vit dans un
 * autre · la garde des clés étrangères refuserait le lien, d'où la sortie,
 * bornée à la création de CETTE ligne dans CE dossier.
 */
export function creerAppartenance(
  prisma: PrismaService,
  donnees: { tenantId: string; email: string; motDePasse: string; role: RoleUtilisateur; compteDeConnexionId: string },
  select: Prisma.UserSelect,
) {
  return horsCloisonnement('appartenances · une personne rattachée au dossier de la session', () =>
    prisma.user.create({ data: { ...donnees, doitChangerMotDePasse: true }, select }),
  );
}

/**
 * Le compte de connexion n'est-il pas une appartenance ailleurs, et porte-t-il
 * des appartenances hors du dossier donné ? Lu par la suppression des essais
 * échus · un compte de connexion qui ouvre d'autres dossiers ne part pas avec
 * le sien (la clé `RESTRICT` le refuserait d'ailleurs).
 */
export function comptesQuiOuvrentDAutresDossiers(prisma: PrismaService, dossierId: string): Promise<number> {
  return horsCloisonnement('appartenances · comptes du dossier rattachés ailleurs', () =>
    prisma.user.count({ where: { compteDeConnexion: { tenantId: dossierId }, NOT: { tenantId: dossierId } } }),
  );
}
