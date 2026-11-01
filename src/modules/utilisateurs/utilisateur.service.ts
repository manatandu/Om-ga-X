import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { normaliserCourriel } from '../../common/courriel';
import { motifRefusReinitialisationOperateur, secondFacteurLeveParReinitialisation } from '../auth/double-authentification';
import { DECOMPTE_REMIS_A_ZERO } from '../auth/verrouillage';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { FonctionMetier, Prisma, RoleUtilisateur } from '@prisma/client';
import { CreerUtilisateurDto, ModifierUtilisateurDto } from './dto/utilisateur.dto';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { LOGICIELS, ROLES_SANS_LOGICIELS } from './logiciels';
import {
  compteDeConnexionDe,
  comptesOuvrantDAutresDossiers,
  MOTIF_CONNEXION_TENUE_PAR_LA_PERSONNE,
  secondFacteurDesComptes,
  trouverCompteDeConnexion,
} from '../auth/compte-de-connexion';
import { estSurSite } from '../../common/mode-installation';
import {
  aDesAppartenances,
  avisReinitialisationParCourriel,
  ORIGINE_REINITIALISATION_PAR_COURRIEL,
  poserLeProvisoire,
  sousVerrouDuCompte,
} from '../auth/reinitialisation-du-compte';
import { motDePasseTireAuSort } from '../plateforme/reinitialisation-admin';
import type { CourrierService } from '../courrier/courrier.service';

export const MOTIF_MESSAGERIE_REQUISE = 'La messagerie est requise pour ce geste · configurez-la, puis recommencez.';

/** Sur site sans messagerie · l'administrateur de l'installation tient le poste et remet le provisoire lui-même. */
export const MOTIF_MESSAGERIE_REQUISE_SUR_SITE =
  "La messagerie est requise pour ce geste · configurez-la, ou demandez la réinitialisation à l'administrateur de l'installation.";

/** Ce qu'il faut à `creer` pour inviter une adresse connue sur le poste (sur site, sans courriel). */
export type InviterSurPlace = (email: string) => Promise<{ invitation: unknown }>;

const SALT_ROUNDS = 12;

// Champs exposés côté API · motDePasse (haché) n'en fait jamais partie.
// `doitChangerMotDePasse` et `verrouilleJusqua` y figurent : l'administrateur
// doit voir qui n'a pas encore posé son propre mot de passe, et qui est
// bloqué dehors · ce sont les deux questions qu'il pose en ouvrant l'écran.
const SELECTION = {
  id: true,
  email: true,
  role: true,
  estActif: true,
  doitChangerMotDePasse: true,
  verrouilleJusqua: true,
  doubleAuthActiveDepuis: true,
  createdAt: true,
  restreindreFonctions: true,
  fonctionsAutorisees: true,
  restreindreJournaux: true,
  journauxAutorises: true,
  restreindreLogiciels: true,
  logicielsAutorises: true,
} as const;

/** Ne dit pas à qui l'adresse appartient · même phrase à la lecture et à la base. */
export const MOTIF_ADRESSE_PRISE = 'Cette adresse est déjà celle d’un utilisateur de ce dossier';

/**
 * Se déconnecter soi-même par cette route couperait la session qui fait le
 * geste · « Mon compte » le fait sans perdre l'appareil en cours.
 */
export const MOTIF_DECONNEXION_DE_SOI =
  "Votre propre session ne se ferme pas d'ici · ouvrez Fichier > Mon compte, « Déconnecter mes autres appareils », qui garde " +
  "l'appareil en cours ouvert.";

export const MOTIF_DERNIER_ADMINISTRATEUR =
  "C'est le dernier administrateur actif du dossier · nommez d'abord un autre administrateur, sans quoi plus personne ne " +
  'pourrait gérer les comptes ni les paramètres du dossier.';

/** Le geste retire-t-il à ce compte, ACTIF et ADMINISTRATEUR, l'une des deux qualités ? */
export function retireUnAdministrateur(
  user: { role: RoleUtilisateur; estActif: boolean },
  dto: { role?: RoleUtilisateur; estActif?: boolean },
): boolean {
  if (user.role !== RoleUtilisateur.ADMIN_CABINET || !user.estActif) return false;
  return (dto.role !== undefined && dto.role !== RoleUtilisateur.ADMIN_CABINET) || dto.estActif === false;
}

@Injectable()
export class UtilisateurService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * LA LISTE DU DOSSIER · une personne dont la connexion se tient ailleurs
   * (ligne rattachée, ou compte que d'autres dossiers pointent) porte
   * `connexionTenueParLaPersonne` · ni réinitialisation ni déverrouillage ne
   * lui sont offerts (relecture de sécurité, C1, E2). Pour une ligne
   * rattachée, le verrou et le second facteur de la LIGNE ne sont pas les
   * siens · le second facteur est lu sur son compte de connexion (F3), le
   * verrou n'est pas servi (`null`, « tenu par le compte de connexion »).
   */
  async lister(tenantId: string) {
    const lignes = await this.prisma.user.findMany({
      where: { tenantId },
      select: { ...SELECTION, compteDeConnexionId: true },
      orderBy: { createdAt: 'asc' },
    });
    const rattachees = lignes.filter((l) => l.compteDeConnexionId).map((l) => l.compteDeConnexionId as string);
    const [secondFacteur, ouvrantAilleurs] = await Promise.all([
      secondFacteurDesComptes(this.prisma, rattachees),
      comptesOuvrantDAutresDossiers(this.prisma, lignes.filter((l) => !l.compteDeConnexionId).map((l) => l.id)),
    ]);
    return lignes.map(({ compteDeConnexionId, ...l }) =>
      compteDeConnexionId
        ? { ...l, verrouilleJusqua: null, doubleAuthActiveDepuis: secondFacteur.get(compteDeConnexionId) ?? null, connexionTenueParLaPersonne: true }
        : { ...l, connexionTenueParLaPersonne: ouvrantAilleurs.has(l.id) },
    );
  }

  /**
   * UN GESTE D'ADMINISTRATEUR SUR LA CONNEXION, SOUS LE VERROU DU COMPTE (C1,
   * E2 ; second tour, mineur 4) · une ligne rattachée est refusée d'emblée (son
   * lien ne change jamais, le déclencheur le fige) ; sur un compte, le décompte
   * des appartenances et l'écriture se font sous le même verrou que
   * l'acceptation d'une invitation, qui ne glisse plus entre les deux.
   */
  private async surLaConnexionDuDossierSeul<T>(
    user: { id: string; tenantId: string; compteDeConnexionId: string | null },
    geste: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (user.compteDeConnexionId) throw new ForbiddenException(MOTIF_CONNEXION_TENUE_PAR_LA_PERSONNE);
    return sousVerrouDuCompte(this.prisma, user, 'utilisateurs · un geste d’administrateur sur un compte, sous son verrou', async (tx) => {
      if (await aDesAppartenances(tx, user.id)) throw new ForbiddenException(MOTIF_CONNEXION_TENUE_PAR_LA_PERSONNE);
      return geste(tx);
    });
  }

  /**
   * « RÉINITIALISER PAR COURRIEL » (second tour, BLOQUANT 1,
   * `auth/reinitialisation-du-compte.ts`) · ouvert à l'administrateur de
   * N'IMPORTE LEQUEL des dossiers de la personne, et à une personne d'un seul
   * dossier aussi. Le mot de passe est tiré au sort, part à la SEULE adresse
   * du compte, n'est rendu à personne · l'administrateur ne tient rien de
   * plus qu'avant (C1 reste fermé). Le second facteur ne tombe pas. Le
   * courriel part d'abord · un envoi refusé ne laisse aucun compte fermé sur
   * un mot de passe que personne n'a reçu. Le geste s'écrit au journal du
   * dossier de l'acteur (la ligne de la personne y voit ses sessions
   * fermées) ; dans le dossier du compte, sous la personne elle-même.
   */
  async reinitialiserParCourriel(tenantId: string, userId: string, parQui: string, courrier: CourrierService | undefined, surSite = estSurSite()) {
    const ligne = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!ligne) throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    const compte = await compteDeConnexionDe(this.prisma, ligne);
    if (!compte) throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    const refusOperateur = motifRefusReinitialisationOperateur(compte);
    if (refusOperateur) throw new ForbiddenException(refusOperateur);
    if (!courrier || !courrier.etatDuTransport().configure) {
      throw new ServiceUnavailableException(surSite ? MOTIF_MESSAGERIE_REQUISE_SUR_SITE : MOTIF_MESSAGERIE_REQUISE);
    }
    const mot = motDePasseTireAuSort();
    const avis = avisReinitialisationParCourriel(mot, false);
    await courrier.envoyerUnSecret(
      tenantId,
      { destinataire: compte.email, sujet: avis.sujet, corps: avis.corps, origine: ORIGINE_REINITIALISATION_PAR_COURRIEL, origineId: ligne.id, createdBy: parQui },
      avis.corpsGarde,
    );
    const hache = await bcrypt.hash(mot, SALT_ROUNDS);
    const maintenant = new Date();
    await sousVerrouDuCompte(this.prisma, compte, 'utilisateurs · mot de passe tiré au sort, remis au seul titulaire du compte', async (tx) => {
      await poserLeProvisoire(tx, compte, hache, false, maintenant);
      // Dans le dossier de l'acteur, la trace du geste · les sessions de la
      // ligne s'y ferment, sous son nom à lui.
      if (ligne.id !== compte.id) await tx.user.update({ where: { id: ligne.id }, data: { sessionsInvalidesAvant: maintenant } });
    });
    return { reinitialise: true, parCourriel: true, email: ligne.email };
  }

  /**
   * LA CRÉATION DIRECTE (`invitations.ts`, `modeDeCreation`) · sur site, et en
   * ligne sans messagerie. En ligne AVEC messagerie, toute création passe par
   * l'invitation (`InvitationsService.inviter`) et cette méthode n'est pas
   * appelée. Une adresse déjà compte de connexion ailleurs n'est JAMAIS
   * rattachée par l'administrateur (second tour, MAJEUR 3) · sur site, elle
   * est INVITÉE sans courriel (`inviterSurPlace`) et l'acceptera depuis sa
   * session ; en ligne, refus « messagerie requise ». Le mot de passe saisi
   * par l'administrateur n'est haché que pour un compte qui naît.
   */
  async creer(tenantId: string, dto: CreerUtilisateurDto, surSite = estSurSite(), inviterSurPlace?: InviterSurPlace) {
    dto = { ...dto, email: normaliserCourriel(dto.email) };
    const inviter = () => {
      if (!surSite || !inviterSurPlace) throw new ServiceUnavailableException(MOTIF_MESSAGERIE_REQUISE);
      return inviterSurPlace(dto.email);
    };
    const raison = 'utilisateurs · une adresse déjà compte de connexion ailleurs';
    const compte = await trouverCompteDeConnexion(this.prisma, dto.email, raison);
    try {
      if (compte && compte.tenantId !== tenantId) return await inviter();
      if (!dto.motDePasse) throw new BadRequestException('Le mot de passe provisoire est requis.');
      const motDePasseHache = await bcrypt.hash(dto.motDePasse, SALT_ROUNDS);
      return await this.prisma.user.create({
        // doitChangerMotDePasse : le mot de passe a été choisi par l'ADMIN du
        // dossier, pas par le titulaire · celui-ci le remplace à sa première
        // connexion, ce qui clôt la période où l'admin pouvait ouvrir le
        // dossier à sa place (voir schema.prisma, User).
        data: { tenantId, email: dto.email, motDePasse: motDePasseHache, role: dto.role, doitChangerMotDePasse: true },
        select: SELECTION,
      });
    } catch (e) {
      // Depuis la ligne multi-dossiers, l'adresse n'est unique que dans le
      // dossier (`@@unique([tenantId, email])`) · seul un utilisateur de CE
      // dossier rend ce refus, que l'administrateur voit déjà dans sa liste
      // (audit final F158 pour le rattrapage de la contrainte en 409).
      if ((e as { code?: string })?.code === 'P2002') {
        // LA COURSE (relecture, m5) · le compte est né ailleurs entre la
        // lecture et la création · la contrainte se relit, et le bon motif suit.
        const apres = await trouverCompteDeConnexion(this.prisma, dto.email, raison);
        if (apres && apres.tenantId !== tenantId) return inviter();
        throw new ConflictException(MOTIF_ADRESSE_PRISE);
      }
      throw e;
    }
  }

  /**
   * PROFIL DE FONCTIONS (point 15, common/fonctions/fonctions-metier.ts) ·
   * restreint ce que le rôle permet d'écrire. Refusé sur un administrateur,
   * que le profil ne restreint jamais · l'accepter laisserait croire à une
   * restriction qui ne s'applique pas. Les sessions sont fermées, comme pour
   * un changement de rôle : la restriction prend effet tout de suite.
   */
  async definirFonctions(tenantId: string, userId: string, dto: { restreindre: boolean; fonctions: FonctionMetier[] }) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    if (user.role === RoleUtilisateur.ADMIN_CABINET && dto.restreindre) {
      throw new BadRequestException(
        "Un administrateur n'est jamais restreint · c'est lui qui ouvre et ferme les fonctions des autres. Changez d'abord son rôle.",
      );
    }
    const inconnue = dto.fonctions.find((f) => !Object.values(FonctionMetier).includes(f));
    if (inconnue) throw new BadRequestException(`Fonction inconnue : ${inconnue}`);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        restreindreFonctions: dto.restreindre,
        fonctionsAutorisees: dto.restreindre ? [...new Set(dto.fonctions)] : [],
        sessionsInvalidesAvant: new Date(),
      },
      select: SELECTION,
    });
  }

  /**
   * JOURNAUX AUTORISÉS (priorité 5, common/perimetre/extension-perimetre-journaux.ts) ·
   * restreint la SAISIE aux journaux cochés. Mêmes refus que le profil de
   * fonctions · jamais un administrateur, et un journal d'un autre dossier
   * n'entre pas dans la liste. Une restriction sans aucun journal est
   * permise · c'est un utilisateur qui consulte sans saisir, et c'est dit.
   */
  async definirJournaux(tenantId: string, userId: string, dto: { restreindre: boolean; journaux: string[] }) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    if (user.role === RoleUtilisateur.ADMIN_CABINET && dto.restreindre) {
      throw new BadRequestException(
        "Un administrateur n'est jamais restreint · c'est lui qui ouvre et ferme les journaux des autres. Changez d'abord son rôle.",
      );
    }
    const ids = [...new Set(dto.journaux)];
    if (dto.restreindre && ids.length) {
      const trouves = await this.prisma.journal.count({ where: { tenantId, id: { in: ids } } });
      if (trouves !== ids.length) throw new BadRequestException('Un des journaux cochés n’appartient pas à ce dossier.');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        restreindreJournaux: dto.restreindre,
        journauxAutorises: dto.restreindre ? ids : [],
        sessionsInvalidesAvant: new Date(),
      },
      select: SELECTION,
    });
  }

  /**
   * LOGICIELS ATTRIBUÉS (écran de tuiles, `logiciels.ts`) · ce que
   * l'utilisateur voit après sa connexion. Mêmes refus que les deux
   * restrictions voisines · jamais un administrateur (il ouvre et ferme les
   * tuiles des autres), cloisonné par dossier. UNE DIFFÉRENCE VOULUE · aucune
   * session n'est fermée (`sessionsInvalidesAvant` intact) · c'est un
   * affichage, pas un droit, et l'effet vaut à la prochaine lecture de
   * /auth/me par l'intéressé (ouverture, rechargement, retour sur son onglet).
   * Une restriction sans aucune tuile est refusée · l'utilisateur n'aurait
   * aucune porte ; pour ne rien lui laisser saisir, c'est le rôle.
   *
   * CE QUE LE SERVEUR NE JUGE PAS · qu'une tuile cochée soit SERVIE par le
   * dossier. Ce jugement se lit sur le menu filtré du client (référentiel,
   * profil, modules, rôle) ; le recopier ici ferait deux règles qui divergent.
   * La modale le dit tuile par tuile, et l'écran nomme ce qui est attribué
   * sans être servi.
   */
  async definirLogiciels(tenantId: string, userId: string, dto: { restreindre: boolean; logiciels?: string[] }) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    if (user.role === RoleUtilisateur.ADMIN_CABINET && dto.restreindre) {
      throw new BadRequestException(
        "Un administrateur n'est jamais restreint · c'est lui qui attribue les logiciels des autres. Changez d'abord son rôle.",
      );
    }
    if (user.role === RoleUtilisateur.GESTIONNAIRE_PAIE && dto.restreindre) {
      throw new BadRequestException(
        "Le gestionnaire de paie a son propre menu, réduit au personnel et aux cours de devises · une attribution de logiciels n'y changerait rien.",
      );
    }
    const demandes = dto.logiciels ?? [];
    const connus: readonly string[] = LOGICIELS;
    const inconnu = demandes.find((l) => !connus.includes(l));
    if (inconnu) throw new BadRequestException(`Logiciel inconnu : ${inconnu}`);
    const choisis = [...new Set(demandes)];
    if (dto.restreindre && choisis.length === 0) {
      throw new BadRequestException(
        'Cochez au moins un logiciel · un utilisateur sans aucun logiciel ne pourrait rien ouvrir. Pour ne rien lui laisser saisir, changez son rôle.',
      );
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        restreindreLogiciels: dto.restreindre,
        logicielsAutorises: dto.restreindre ? choisis : [],
        // L'ATTRIBUTION EST UN DROIT DEPUIS QUE LE SERVEUR LA REFUSE (ligne
        // commercial-site) · elle ferme les sessions comme le profil de
        // fonctions, pour que l'écran ouvert relise ses tuiles au lieu de
        // tomber sur des refus. L'administrateur n'est jamais restreint · lever
        // une attribution qui ne le touche pas ne le met pas dehors.
        ...(user.role === RoleUtilisateur.ADMIN_CABINET ? {} : { sessionsInvalidesAvant: new Date() }),
      },
      select: SELECTION,
    });
  }

  async modifier(tenantId: string, userId: string, utilisateurCourantId: string, dto: ModifierUtilisateurDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    }
    if (userId === utilisateurCourantId && dto.estActif === false) {
      throw new BadRequestException('Impossible de désactiver son propre compte');
    }
    const ecrire = (client: Pick<PrismaService, 'user'>) =>
      client.user.update({
        where: { id: userId },
        data: {
          ...dto,
          // DÉSACTIVER, C'EST METTRE DEHORS TOUT DE SUITE. JwtStrategy relit
          // déjà `estActif` à chaque requête, mais un changement de RÔLE, lui,
          // ne fermait rien : rétrograder un ADMIN_CABINET le laissait agir en
          // administrateur jusqu'à l'expiration de son jeton, soit huit heures.
          ...(dto.estActif === false || dto.role !== undefined ? { sessionsInvalidesAvant: new Date() } : {}),
          // UNE ATTRIBUTION DE LOGICIELS NE SURVIT PAS À UN RÔLE QUI NE LA SUIT
          // PAS · promu administrateur (ou passé gestionnaire de paie), le
          // compte garderait sinon sa liste en base, et la retrouverait en
          // silence le jour où il redeviendrait comptable.
          ...(dto.role !== undefined && ROLES_SANS_LOGICIELS.includes(dto.role)
            ? { restreindreLogiciels: false, logicielsAutorises: [] }
            : {}),
        },
        select: SELECTION,
      });
    if (!retireUnAdministrateur(user, dto)) return ecrire(this.prisma);

    // LE DERNIER ADMINISTRATEUR ACTIF NE SE RETIRE PAS (audit final F157).
    // Rétrogradé ou désactivé, il laissait un dossier que plus personne ne
    // peut administrer · la console ne rattrape pas ce cas, sa
    // réinitialisation ne visant que les administrateurs, et il ne se
    // réglait plus que par SQL en production. Le décompte et l'écriture se
    // font sous un verrou PAR DOSSIER, pris dans la transaction · deux
    // administrateurs qui se rétrogradent l'un l'autre au même instant
    // compteraient chacun l'autre, et les deux gestes passeraient.
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`administrateurs:${tenantId}`}))`;
      const autres = await tx.user.count({
        where: { tenantId, role: RoleUtilisateur.ADMIN_CABINET, estActif: true, id: { not: userId } },
      });
      if (autres === 0) throw new BadRequestException(MOTIF_DERNIER_ADMINISTRATEUR);
      return ecrire(tx);
    });
  }

  /**
   * RÉINITIALISATION PAR L'ADMINISTRATEUR DU DOSSIER.
   *
   * Sans elle, un oubli de mot de passe se réglait par un UPDATE SQL en
   * production · c'est-à-dire par une connexion directe à la base de tous les
   * cabinets, faite à la main, sans trace autre que celle du serveur SQL.
   *
   * Trois effets, indissociables :
   *  · le mot de passe devient PROVISOIRE (`doitChangerMotDePasse`), puisqu'il
   *    a transité par l'administrateur · le titulaire doit le remplacer avant
   *    de travailler, et le serveur le refuse désormais (MotDePasseAChangerGuard) ;
   *  · les sessions du compte sont FERMÉES · si le mot de passe est
   *    réinitialisé, c'est souvent qu'il a été perdu, et « perdu » peut
   *    vouloir dire « trouvé par quelqu'un d'autre » ;
   *  · le verrou de force brute tombe · c'est aussi la sortie de secours d'un
   *    comptable bloqué dehors.
   *
   * Le geste est journalisé par le journal d'audit (le modèle User y figure),
   * mot de passe masqué · un administrateur qui réinitialise le compte d'un
   * collaborateur laisse donc une trace que la chaîne d'empreintes protège.
   */
  async reinitialiserMotDePasse(tenantId: string, userId: string, motDePasseProvisoire: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    }
    const refusOperateur = motifRefusReinitialisationOperateur(user);
    if (refusOperateur) throw new ForbiddenException(refusOperateur);
    const motDePasse = await bcrypt.hash(motDePasseProvisoire, SALT_ROUNDS);
    await this.surLaConnexionDuDossierSeul(user, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          motDePasse,
          doitChangerMotDePasse: true,
          sessionsInvalidesAvant: new Date(),
          ...DECOMPTE_REMIS_A_ZERO,
          ...secondFacteurLeveParReinitialisation(user),
        },
      }),
    );
    return { reinitialise: true, email: user.email };
  }

  /**
   * DÉCONNECTER UN UTILISATEUR (2026-10-21, gel levé par Manasse · « la 2e
   * possibilité. Fais le proprement », fonction vue dans le manuel de
   * Microfina++, p. 18). L'administrateur ferme TOUTES les sessions d'un
   * collaborateur, et rien d'autre · ni mot de passe, ni rôle, ni verrou, ni
   * second facteur. C'est le geste du poste resté ouvert ou de l'appareil dont
   * on doute · la réinitialisation ferait remettre un mot de passe provisoire
   * pour rien, la désactivation fermerait aussi la porte. Le titulaire se
   * reconnecte avec son propre mot de passe.
   *
   * Même colonne que les autres révocations (`sessionsInvalidesAvant`, relue
   * à chaque requête par `JwtStrategy`, qui rend alors la session perdue
   * nommée), mais posée à la SECONDE SUIVANTE · la comparaison tronque à la
   * seconde (jwt.strategy.ts), ce qui protège le titulaire de son propre
   * geste ; ici l'auteur n'est pas le titulaire, et un jeton signé dans la
   * seconde même du clic survivait alors que l'écran disait « fermées ». Le
   * coût · une reconnexion dans cette même seconde est refusée, et se refait.
   * Le modèle User est au journal d'audit · qui a déconnecté qui, et quand, y
   * est écrit.
   *
   * Le compte doit être du dossier (404 sinon, comme les autres gestes). Un
   * compte désactivé n'a déjà plus de session (`estActif` relu à chaque
   * requête) · le geste reste admis, il ne change rien de faux.
   */
  async deconnecter(tenantId: string, userId: string, utilisateurCourantId: string) {
    if (userId === utilisateurCourantId) throw new BadRequestException(MOTIF_DECONNEXION_DE_SOI);
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    }
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { sessionsInvalidesAvant: new Date(Math.ceil(Date.now() / 1000) * 1000) },
        select: SELECTION,
      });
    } catch (err) {
      // Compte retiré entre la lecture et l'écriture · le même 404 nommé,
      // jamais une erreur 500 de Prisma.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Utilisateur introuvable pour ce tenant');
      }
      throw err;
    }
  }

  /**
   * Lève le verrou de force brute sans toucher au mot de passe · le cas du
   * comptable qui a mal tapé cinq fois et se souvient très bien du sien.
   */
  async deverrouiller(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable pour ce tenant');
    }
    return this.surLaConnexionDuDossierSeul(user, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: DECOMPTE_REMIS_A_ZERO,
        select: SELECTION,
      }),
    );
  }
}
