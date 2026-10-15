import { FORMULES_DU_CONTRAT } from '../../../src/modules/conditions-licence/conditions-de-licence';

/**
 * LA FOIRE AUX QUESTIONS D'OMEGAX (demande de Manasse du 2026-10-15).
 *
 * LA FORME SUIT DES LOGICIELS RÉELS, lus le 2026-10-15 · la documentation
 * d'Odoo (github.com/odoo/documentation, branche 18.0, « SMS Pricing and
 * FAQ » et « Odoo Online ») range ses questions par thème, la question en
 * gras à la première personne, la réponse qui commence par oui ou non ; la
 * FAQ de Firefly III (github.com/firefly-iii/docs, references/faq) groupe
 * « General », « Using », et traite les mêmes soucis que tout utilisateur a
 * un jour · mot de passe perdu, second facteur perdu, adresse changée. Les
 * centres d'aide de Sage, QuickBooks et Pennylane n'étaient pas joignables
 * depuis cet environnement (voir AVANCEMENT-pages-legales.md).
 *
 * CHAQUE RÉPONSE DIT CE QUE LE LOGICIEL FAIT, VÉRIFIÉ DANS LE CODE · une
 * réponse qui promettrait ce que le code ne tient pas serait pire qu'aucune
 * réponse (CLAUDE.md § 4, jamais de « bientôt disponible » faux). Les
 * chiffres repris du serveur (essai, délai de paiement, paliers du verrou,
 * durées de session, codes de secours) sont confrontés à leur source par
 * `questions-frequentes.spec.ts`.
 */

export interface QuestionFrequente {
  /** Ancre stable · `#q-…` dans la page. */
  id: string;
  question: string;
  reponse: string[];
}

export interface RubriqueFrequente {
  id: string;
  titre: string;
  questions: QuestionFrequente[];
}

const formules = FORMULES_DU_CONTRAT.filter((f) => ['ESSENTIEL', 'STANDARD', 'CABINET'].includes(f.code))
  .map((f) => `${f.libelle} (${f.contenu})`)
  .join(' ; ');
const options = FORMULES_DU_CONTRAT.filter((f) => !['ESSENTIEL', 'STANDARD', 'CABINET'].includes(f.code))
  .map((f) => `${f.libelle} (${f.contenu.charAt(0).toLowerCase()}${f.contenu.slice(1)})`)
  .join(' ; ');

export const QUESTIONS_FREQUENTES: RubriqueFrequente[] = [
  {
    id: 'logiciel',
    titre: 'Le logiciel',
    questions: [
      {
        id: 'q-omegax',
        question: 'Qu’est-ce qu’OmegaX ?',
        reponse: [
          'Un logiciel de comptabilité pour les entités de la République démocratique du Congo, édité par VMG Consulting. Il tient chaque dossier dans l’un des deux référentiels de l’OHADA et en produit les livres, la balance, les états financiers et les notes annexes.',
        ],
      },
      {
        id: 'q-referentiels',
        question: 'Quels référentiels et quels systèmes sont pris en charge ?',
        reponse: [
          'Le SYCEBNL, pour les associations, organisations non gouvernementales, ordres professionnels et projets de développement, avec ses trois jeux d’états · associations et ordres professionnels, projets de développement, système minimal de trésorerie.',
          'Le SYSCOHADA révisé, pour les entreprises, en système normal ou en système minimal de trésorerie. Le référentiel se choisit à la création du dossier.',
        ],
      },
      {
        id: 'q-langue',
        question: 'Dans quelle langue OmegaX est-il disponible ?',
        reponse: [
          'En français seulement. L’interface, les états, les courriels et le contrat de licence sont rédigés en français, et aucune autre langue n’est proposée. La comptabilité elle-même se tient en français (loi n° 23/053, art. 141, 1°).',
        ],
      },
      {
        id: 'q-monnaie',
        question: 'Puis-je tenir mon dossier en dollars ?',
        reponse: [
          'Non. La comptabilité est exprimée en francs congolais (loi n° 23/053, art. 141, 1° ; AUDCIF, art. 17, 1°), et la monnaie de tenue ne se choisit pas.',
          'Une monnaie fonctionnelle peut être déclarée dans Paramètres du dossier · elle sert à un second jeu de documents de gestion, à côté du jeu légal et sans valeur légale. Une ligne en devise se saisit avec son montant en devise et son cours.',
        ],
      },
      {
        id: 'q-sans-internet',
        question: 'OmegaX fonctionne-t-il sans Internet ?',
        reponse: [
          'La version en ligne demande une connexion. L’installation sur site tourne sur un ordinateur Windows de l’entité, pour les postes de son réseau local, et sa licence se vérifie sans Internet.',
        ],
      },
    ],
  },
  {
    id: 'connexion',
    titre: 'Connexion et compte',
    questions: [
      {
        id: 'q-acces',
        question: 'Comment obtenir un accès ?',
        reponse: [
          'En ligne, un dossier s’ouvre avec VMG Consulting, qui le crée avec son administrateur ; l’inscription libre n’est pas ouverte. L’administrateur ajoute ensuite les autres utilisateurs et leur rôle dans Fichier > Autorisations d’accès.',
          'Sur une installation sur site, le premier dossier se crée depuis l’écran d’ouverture du poste neuf.',
        ],
      },
      {
        id: 'q-mot-de-passe-oublie',
        question: 'J’ai oublié mon mot de passe.',
        reponse: [
          'L’administrateur de votre dossier le réinitialise dans Fichier > Autorisations d’accès. Vous recevez un mot de passe provisoire, à changer à la première connexion · rien d’autre ne s’ouvre avant.',
          'Si c’est l’administrateur du dossier qui l’a oublié, VMG Consulting le réinitialise · le mot de passe provisoire, tiré au sort, part directement à son adresse électronique, et la réinitialisation est refusée tant qu’aucune messagerie n’est configurée.',
        ],
      },
      {
        id: 'q-verrou',
        question: 'Ma connexion est refusée après plusieurs essais.',
        reponse: [
          'Après cinq essais manqués, la connexion est refusée pendant un délai qui croît à chaque nouvel échec · une minute, puis cinq, quinze, trente et soixante minutes. Le message est le même qu’en cas de mot de passe faux.',
          'Le décompte s’efface à la première connexion réussie, douze heures après le dernier échec, ou quand l’administrateur du dossier déverrouille le compte dans Fichier > Autorisations d’accès.',
        ],
      },
      {
        id: 'q-double-authentification',
        question: 'Comment activer la double authentification ?',
        reponse: [
          'Dans Fichier > Mon compte, avec votre mot de passe et une application d’authentification, qui donne un code de six chiffres renouvelé toutes les trente secondes. Huit codes de secours vous sont montrés une seule fois · gardez-les hors de l’ordinateur.',
          'Elle est offerte à tous les utilisateurs, et exigée pour la console de VMG Consulting.',
        ],
      },
      {
        id: 'q-telephone-perdu',
        question: 'J’ai perdu le téléphone qui donne mes codes.',
        reponse: [
          'Entrez l’un de vos codes de secours à la place du code ; chacun ne sert qu’une fois. Sans code de secours, l’administrateur du dossier réinitialise votre mot de passe, ce qui retire aussi la double authentification ; vous la réactivez ensuite.',
        ],
      },
      {
        id: 'q-rester-connecte',
        question: 'Que fait la case « Rester connecté sur cet appareil » ?',
        reponse: [
          'Décochée, la session se ferme avec le navigateur, et au plus tard huit heures après la connexion. Cochée, elle reste ouverte sur cet appareil trente jours au plus, et se ferme après sept jours sans utilisation. Ne la cochez pas sur un poste partagé.',
        ],
      },
      {
        id: 'q-autres-appareils',
        question: 'Comment fermer ma session sur un autre appareil ?',
        reponse: [
          'Dans Fichier > Mon compte, Déconnecter mes autres appareils, avec votre mot de passe · les sessions ouvertes ailleurs se ferment, celle-ci reste ouverte. Changer de mot de passe ou d’adresse ferme aussi les autres sessions.',
        ],
      },
      {
        id: 'q-adresse',
        question: 'Comment changer mon adresse de connexion ?',
        reponse: ['Dans Fichier > Mon compte, Changer mon adresse de connexion, avec votre mot de passe actuel.'],
      },
    ],
  },
  {
    id: 'tenue',
    titre: 'Tenue du dossier',
    questions: [
      {
        id: 'q-compte-refuse',
        question: 'Pourquoi un compte du plan est-il refusé à la saisie ?',
        reponse: [
          'Seuls les comptes personnalisés du dossier se saisissent. Ouvrez le compte dans Structure > Plan comptable et utilisez le bouton Personnaliser de sa fiche · adoptez-le tel quel, ou ouvrez un sous-compte sous lui. Un compte qu’une écriture automatique, un journal, un tiers ou un taux de taxe utilise est personnalisé d’office.',
        ],
      },
      {
        id: 'q-ecriture-validee',
        question: 'Puis-je modifier une écriture validée ?',
        reponse: [
          'Non. La validation fait entrer l’écriture au livre-journal, et l’irréversibilité des traitements interdit toute modification ultérieure (AUDCIF, art. 22, 2°). Une erreur découverte sur l’exercice se corrige par inscription en négatif des éléments erronés, puis l’enregistrement exact (art. 20) · l’écriture erronée reste au journal, marquée annulée.',
          'Tant qu’elle est au brouillard, une pièce se modifie librement ; lettrée ou pointée, elle se délettre ou se dépointe d’abord.',
        ],
      },
      {
        id: 'q-deux-exercices',
        question: 'Pourquoi deux exercices sont-ils ouverts ?',
        reponse: [
          'C’est normal · les états financiers s’arrêtent au plus tard dans les quatre mois qui suivent la clôture (AUDCIF, art. 23), et l’exercice suivant se tient pendant ce temps. Le sélecteur de la barre d’état choisit l’exercice de travail, et le retient pour ce dossier sur ce poste.',
          'Tant que l’exercice précédent n’est pas clôturé, les à-nouveaux du suivant sont provisoires · calculés sur le livre-journal, jamais validés, ils sont remplacés à la clôture.',
        ],
      },
      {
        id: 'q-cloture',
        question: 'Comment clôturer un exercice ?',
        reponse: [
          'Par Traitement > Fin d’exercice. Les exercices se clôturent dans l’ordre, du plus ancien au plus récent. La clôture solde les comptes de gestion et passe le report à nouveau, deux écritures qui entrent validées au livre-journal ; ce qui empêche encore de clôturer est nommé à l’écran.',
        ],
      },
      {
        id: 'q-import',
        question: 'Comment reprendre les données d’un autre logiciel ?',
        reponse: [
          'Par Fichier > Importer des données, réservé à l’administrateur du dossier · un plan de comptes, une balance ou des écritures, depuis un fichier CSV ou un classeur .xlsx.',
        ],
      },
      {
        id: 'q-imprimer',
        question: 'Comment imprimer ou produire un fichier PDF ?',
        reponse: [
          'Fichier > Imprimer la fenêtre ouvre la boîte d’impression du navigateur, où « Enregistrer au format PDF » produit le fichier · ce qui s’imprime est exactement ce qui est à l’écran. Les états financiers, la liasse, le journal, le grand livre et la balance s’exportent aussi au format tableur.',
        ],
      },
    ],
  },
  {
    id: 'abonnement',
    titre: 'Abonnement et licence',
    questions: [
      {
        id: 'q-formules',
        question: 'Quelles formules existent ?',
        reponse: [
          `Trois formules · ${formules}. Et des options · ${options}.`,
          'Les prix sont fixés en dollars des États-Unis, au mois ou à l’année, et communiqués par écrit avant la souscription.',
        ],
      },
      {
        id: 'q-essai',
        question: 'Combien de temps dure l’essai ?',
        reponse: [
          'Trente jours, gratuits. Tout mois qui commence avant la fin de l’essai n’est pas facturé, et aucune période n’est facturée au prorata.',
        ],
      },
      {
        id: 'q-facture',
        question: 'Comment l’abonnement est-il facturé ?',
        reponse: [
          'Une facture par période, mensuelle ou annuelle, établie en francs congolais au cours du dollar du jour de la facture. Un abonnement annuel se facture au premier mois facturable, puis tous les douze mois.',
        ],
      },
      {
        id: 'q-echeance',
        question: 'Que se passe-t-il si l’abonnement n’est pas réglé ?',
        reponse: [
          'Le client dispose de quinze jours après la fin de l’essai, puis après la fin de chaque période payée. Passé ce délai sans paiement constaté, le dossier passe en lecture seule · il se consulte, s’imprime et s’exporte, mais rien ne s’y enregistre plus. Le paiement constaté rouvre l’écriture aussitôt.',
          'La copie intégrale du dossier reste disponible en lecture seule.',
        ],
      },
      {
        id: 'q-licence-sur-site',
        question: 'Comment fonctionne la licence d’une installation sur site ?',
        reponse: [
          'C’est un fichier signé par VMG Consulting, vérifié sans Internet. Il nomme le titulaire, l’empreinte du poste serveur, le nombre de dossiers que l’installation peut ouvrir, la date de fin de maintenance et, s’il y a lieu, la date d’expiration. Copié sur un autre poste, il ne vaut rien.',
          'La fin de maintenance borne les versions · la version installée continue de tourner, mais une version publiée après cette date refuse de démarrer. Sans date d’expiration, la licence est perpétuelle.',
        ],
      },
      {
        id: 'q-mise-a-jour-sur-site',
        question: 'Comment mettre à jour une installation sur site ?',
        reponse: [
          'En installant le nouveau programme d’installation Windows remis par VMG Consulting. Avant de transformer la base, l’installation en prend une copie, gardée sur le poste ; si la licence ne couvre pas la nouvelle version, la mise à jour est refusée avant toute transformation.',
        ],
      },
      {
        id: 'q-contrat',
        question: 'Où lire le contrat de licence ?',
        reponse: [
          'Dans le menu « ? », Contrat de licence, et sur la page publique liée depuis l’écran d’ouverture. L’administrateur du dossier y accepte les conditions au nom de l’entité, quand l’acceptation en ligne est ouverte.',
        ],
      },
    ],
  },
  {
    id: 'donnees',
    titre: 'Données et sécurité',
    questions: [
      {
        id: 'q-hebergement',
        question: 'Où mes données sont-elles hébergées ?',
        reponse: [
          'En ligne, hors de la République démocratique du Congo, chez les prestataires que nomme la politique de confidentialité. Sur une installation sur site, sur l’ordinateur de l’entité.',
        ],
      },
      {
        id: 'q-vmg-voit',
        question: 'VMG Consulting voit-il les données de mon dossier ?',
        reponse: [
          'VMG Consulting ne consulte pas le contenu de vos dossiers. Ses accès techniques à la base se limitent à la sauvegarde chiffrée de chaque nuit, dont elle détient la clé, à la restauration de contrôle automatique qui l’éprouve et ne rend que des décomptes, et aux requêtes de maintenance, qui ne rendent que des identifiants et des nombres. Sa console ne montre d’un dossier que sa fiche commerciale et sa licence.',
          'Sur une installation sur site, la base reste sur l’ordinateur de l’entité, et VMG Consulting n’y a pas accès.',
        ],
      },
      {
        id: 'q-sauvegardes',
        question: 'Mes données sont-elles sauvegardées ?',
        reponse: [
          'En ligne, la base est sauvegardée chaque nuit, chiffrée avant de quitter le serveur, et la sauvegarde est éprouvée par une restauration de contrôle.',
          'Sur une installation sur site, une copie est prise chaque jour sur le poste, et les trente plus récentes sont gardées, sauf réglage différent ; une copie peut en être déposée hors du poste, chiffrée par une phrase secrète que choisit l’administrateur de l’installation.',
        ],
      },
      {
        id: 'q-recuperer',
        question: 'Comment récupérer toutes mes données ?',
        reponse: [
          'L’administrateur du dossier en obtient une copie intégrale par Fichier > Restituer le dossier complet · une archive ZIP d’un fichier CSV par table, avec un manifeste et un relevé de contrôle. Chaque utilisateur exporte aussi les états et les livres.',
          'Les livres et les pièces justificatives se conservent dix ans (AUDCIF, art. 24) · l’archive ne remplace pas cette conservation.',
        ],
      },
      {
        id: 'q-qui-a-fait',
        question: 'Comment savoir qui a fait quoi dans le dossier ?',
        reponse: [
          'Le journal d’audit, ouvert à l’administrateur dans Fichier > Journal d’audit, garde chaque acte avec son auteur, sa date et l’adresse réseau d’où il a été fait ; chaque événement porte l’empreinte du précédent, ce qui rend une retouche visible.',
        ],
      },
    ],
  },
  {
    id: 'assistance',
    titre: 'Assistance',
    questions: [
      {
        id: 'q-version',
        question: 'Quelle version d’OmegaX est-ce que j’utilise ?',
        reponse: [
          'Le menu « ? », À propos d’OmegaX, donne la version, la révision, la date de construction et de mise en production, et la langue de l’interface. Ce qui n’est pas connu y est dit, jamais remplacé.',
        ],
      },
      {
        id: 'q-joindre',
        question: 'Comment joindre VMG Consulting ?',
        reponse: [
          'L’adresse et le téléphone de l’assistance et des réclamations doivent être arrêtés par VMG Consulting et portés ici · ils ne sont pas inscrits d’office, une adresse inventée dirigerait vos demandes vers le vide.',
        ],
      },
    ],
  },
];
