import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EtatSurSite } from '../lib/sur-site';
import { CadrePagePublique, CorpsFenetreLegale, LienPageLegale } from '../components/CadrePagePublique';
import { LienPreferencesMesure } from '../components/BandeauConsentementMesure';

/**
 * POLITIQUE DE CONFIDENTIALITÉ · atteignable SANS CONNEXION.
 *
 * C'est le premier des trois prérequis communs à tous les magasins
 * d'applications : chacun exige une adresse publique, ouverte, qui dise quelles
 * données sont traitées et où elles sont hébergées. Une politique derrière un
 * mot de passe n'est pas une politique publiée.
 *
 * TOUT CE QUI EST ÉCRIT ICI EST VÉRIFIABLE DANS LE DÉPÔT · l'hébergeur de la
 * base, la région du service, les durées, les traceurs. Une politique qui
 * décrirait un traitement que le logiciel ne fait pas serait pire qu'aucune
 * politique : elle serait fausse, et opposable.
 *
 * DEUX POINTS APPELLENT UNE DÉCISION DE VMG CONSULTING et sont dits comme tels
 * dans le texte plutôt que remplis d'office · l'adresse postale du responsable
 * de traitement, et l'adresse de contact pour l'exercice des droits. Inventer
 * un contact ferait passer un document juridique pour complet alors qu'il
 * dirigerait les demandes vers le vide.
 */

// Mise à jour du 15 octobre 2026 (ligne pages-legales) · la console de
// l'éditeur (session longue admise, redemandée après huit heures), le
// stockage local du navigateur, l'accès de VMG Consulting aux données et la
// règle de modification. Une politique modifiée change sa date, comme le
// font celles de 37signals (« Whenever we make a significant change to our
// policies, we will refresh the date at the top of this page »).
export { DATE_DE_MISE_A_JOUR } from '../lib/date-politique-confidentialite';
import { DATE_DE_MISE_A_JOUR } from '../lib/date-politique-confidentialite';

// Mise à jour du 17 octobre 2026 · présentation sur le modèle des politiques
// des grands éditeurs (demande de Manasse, d'après celle de Cloudflare) ·
// engagement en tête, sommaire, champ d'application, fondement de chaque
// traitement, témoins, mineurs, délais de réponse et coordonnées en fin de
// page. Le fond reste celui du logiciel, rien n'est repris d'un autre texte.

/**
 * LE SOMMAIRE · un bouton par section, qui fait défiler jusqu'à elle. Jamais
 * un lien `#ancre` · sous HashRouter, le dièse est la route, et l'ancre
 * ramènerait à l'écran d'ouverture. L'ordre et les intitulés sont ceux des
 * `<Titre>` ci-dessous, ce que `confidentialite-code-numerique.spec.ts` relit.
 */
export const SECTIONS_POLITIQUE = [
  { id: 'champ', titre: 'À qui s’applique cette politique' },
  { id: 'donnees', titre: 'Ce que le logiciel traite' },
  { id: 'fondements', titre: 'Pourquoi, et sur quel fondement' },
  { id: 'temoins', titre: 'Témoins et stockage local' },
  { id: 'ne-fait-pas', titre: 'Ce que le logiciel ne fait pas' },
  { id: 'hebergement', titre: 'Où vos données sont hébergées' },
  { id: 'conservation', titre: 'Combien de temps elles sont conservées' },
  { id: 'protection', titre: 'Comment elles sont protégées' },
  { id: 'violation', titre: 'Si vos données étaient exposées' },
  { id: 'droits', titre: 'Vos droits' },
  { id: 'mineurs', titre: 'Les mineurs' },
  { id: 'modifications', titre: 'Modifications' },
  { id: 'contact', titre: 'Nous contacter' },
] as const;

type IdSection = (typeof SECTIONS_POLITIQUE)[number]['id'];

const ancre = (id: IdSection) => `politique-${id}`;

function Titre({ id, children }: { id: IdSection; children: React.ReactNode }) {
  return (
    <h2 id={ancre(id)} tabIndex={-1} className="text-[12px] font-bold mt-5 mb-1.5 scroll-mt-4 outline-none">
      {children}
    </h2>
  );
}

function Sommaire() {
  return (
    <nav aria-label="Sommaire de la politique" className="ecran-seul border border-border px-3 py-2 mb-3">
      <p className="text-[11px] font-semibold text-text-dim mb-1">Sommaire</p>
      <ol className="text-[11.5px] leading-relaxed list-decimal pl-5 sm:columns-2">
        {SECTIONS_POLITIQUE.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                const titre = document.getElementById(ancre(s.id));
                titre?.scrollIntoView({ block: 'start' });
                // Le focus suit · au clavier, Tab entre dans la section choisie.
                titre?.focus({ preventScroll: true });
              }}
              className="text-sel underline text-left"
            >
              {s.titre}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] leading-relaxed mb-2">{children}</p>;
}

/**
 * LA PAGE PUBLIQUE · hors de la zone protégée (App.tsx), avec son titre, sa
 * date et le retour à l'ouverture du fichier comptable.
 */
export function ConfidentialitePage() {
  return (
    <CadrePagePublique titre="Politique de confidentialité d’OmegaX" sousTitre={`Dernière mise à jour · ${DATE_DE_MISE_A_JOUR}`}>
      <ContenuConfidentialite />
    </CadrePagePublique>
  );
}

/** La même politique dans une fenêtre de l'espace de travail (menu « ? ») · la barre de titre porte le titre. */
export function ConfidentialiteFenetre() {
  return (
    <CorpsFenetreLegale sousTitre={`Dernière mise à jour · ${DATE_DE_MISE_A_JOUR}`}>
      <ContenuConfidentialite />
    </CorpsFenetreLegale>
  );
}

export function ContenuConfidentialite() {
  // DEUX INSTALLATIONS, DEUX RÉPONSES (audit final F176) · sur le poste d'un
  // client, aucune donnée ne part chez Neon, Cloud Run ni Firebase, et la page
  // servie par ce poste le disait pourtant. `GET /sur-site/etat` est public ·
  // en ligne il répond `surSite: false`, et une panne laisse le texte en ligne.
  const [surSite, setSurSite] = useState(false);
  useEffect(() => {
    let vivant = true;
    api
      .get<EtatSurSite>('/sur-site/etat')
      .then((e) => vivant && setSurSite(e.surSite))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  return (
    <>
        <P>
          OmegaX est un logiciel de comptabilité destiné aux associations sans but lucratif, aux organisations non
          gouvernementales et aux entreprises de la République démocratique du Congo. Il est édité et exploité par le
          cabinet <strong>VMG Consulting</strong>, qui est le responsable du traitement des données décrites
          ci-dessous.
        </P>

        <div className="border-l-4 border-[var(--a-700)] bg-[var(--a-50)] px-3 py-2 mb-3">
          <p className="text-[11.5px] font-bold mb-1">Notre engagement</p>
          <p className="text-[11.5px] leading-relaxed">
            Vos dossiers comptables vous appartiennent. Nous ne vendons ni ne louons aucune donnée, nous n’en faisons
            aucun usage publicitaire, et nous ne consultons pas le contenu de vos dossiers. Nous ne communiquons vos
            données qu’aux prestataires désignés à la section 6, pour vous rendre le service, ou sur réquisition
            judiciaire. Cette page dit ce que le logiciel fait réellement · chaque affirmation y est vérifiable dans
            son code.
          </p>
        </div>

        <Sommaire />

        <Titre id="champ">1. À qui s’applique cette politique</Titre>
        <P>Elle vise six catégories de personnes :</P>
        <ul className="text-[11.5px] leading-relaxed mb-2 list-disc pl-5">
          <li>
            <strong>Les visiteurs</strong> des pages publiques d’OmegaX · écran d’ouverture, page de présentation,
            questions fréquentes, contrat de licence et la présente politique.
          </li>
          <li>
            <strong>Les personnes qui demandent un essai gratuit</strong> par le formulaire d’essai.
          </li>
          <li>
            <strong>Les utilisateurs</strong> des dossiers · comptables, aides-comptables, gestionnaires de paie,
            administrateurs et lecteurs, qu’ils appartiennent à un cabinet ou à l’entité tenue.
          </li>
          <li>
            <strong>Les cabinets et entités clientes</strong>, signataires du contrat de licence.
          </li>
          <li>
            <strong>Les personnes dont les données figurent dans un dossier</strong> · salariés, fournisseurs,
            clients, membres, donateurs. Pour elles, c’est l’entité qui tient le dossier qui est responsable du
            traitement ; VMG Consulting n’agit que pour son compte (section 2).
          </li>
          <li>
            <strong>Les opérateurs de la console</strong> de VMG Consulting.
          </li>
        </ul>

        <Titre id="donnees">2. Ce que le logiciel traite</Titre>
        <P>
          OmegaX traite deux catégories de données, et deux seulement.
        </P>
        <P>
          <strong>Les données de vos dossiers comptables</strong> · plan de comptes, journaux, écritures, tiers,
          immobilisations, budgets, états financiers et pièces que vous y saisissez. Elles vous appartiennent. Elles
          peuvent contenir des données personnelles si vous en saisissez (nom d’un fournisseur, d’un membre, d’un
          salarié) : dans ce cas, c’est votre entité qui en est responsable, et VMG Consulting n’agit que comme
          sous-traitant, pour votre compte et sur vos instructions.
        </P>
        <P>
          <strong>Les données de compte et de traçabilité</strong> · l’adresse de courriel et le rôle de chaque
          utilisateur, l’empreinte chiffrée de son mot de passe (jamais le mot de passe lui-même) et, si la double
          authentification est activée, le secret de l’application d’authentification et l’empreinte des codes de
          secours. S’y ajoute le journal d’audit, qui enregistre qui a fait quoi et quand dans le dossier, chaque
          connexion réussie, et l’<strong>adresse réseau (adresse IP)</strong> d’où chaque acte a été fait. Ce
          journal n’est pas une option : les textes comptables applicables (Acte uniforme relatif au droit
          comptable, art. 22) imposent que l’origine et l’imputation de chaque écriture puissent être restituées, et
          le Code du numérique (article 219, 14°) veut que l’on puisse constater après coup qui a eu accès aux
          données personnelles, et quand.
        </P>
        <P>
          <strong>La demande d’essai</strong> · le type de l’entité, son nom et l’adresse de courriel donnée. Ils
          servent à ouvrir le dossier d’essai et à envoyer à cette adresse, et à elle seule, le mot de passe
          provisoire. L’adresse réseau d’où part la demande sert à limiter leur nombre · le serveur d’application ne l’inscrit
          dans aucune table ; son limiteur en garde une empreinte en mémoire tant que le service tourne. Comme pour
          toute requête, l’hébergeur (Google Cloud Run) inscrit l’adresse dans ses journaux techniques.{' '}
          <em>
            La durée de conservation de ces journaux doit être arrêtée par VMG Consulting et portée ici avant toute
            publication de cette page sur un magasin d’applications.
          </em>
        </P>

        <Titre id="fondements">3. Pourquoi, et sur quel fondement</Titre>
        <P>
          Le Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023) n’admet que deux fondements à un traitement
          de données personnelles · le <strong>consentement</strong> de la personne concernée, ou une{' '}
          <strong>obligation légale</strong> du responsable du traitement (article 192). Voici lequel porte chaque
          traitement d’OmegaX.
        </P>
        <div className="overflow-x-auto mb-2">
          <table className="text-[11.5px] w-full">
            <thead>
              <tr>
                <th className="text-left">Traitement</th>
                <th className="text-left">Pourquoi</th>
                <th className="text-left">Fondement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Données de vos dossiers</td>
                <td>Tenir votre comptabilité</td>
                <td>Celui que votre entité, responsable, retient ; VMG Consulting agit sur ses instructions (article 229)</td>
              </tr>
              <tr>
                <td>Journal d’audit, adresse IP de chaque acte</td>
                <td>Restituer l’origine de chaque écriture, constater qui a eu accès aux données</td>
                <td>Obligation légale · Acte uniforme relatif au droit comptable, art. 22 ; Code du numérique, article 219, 14°</td>
              </tr>
              <tr>
                <td>Sauvegarde de la base</td>
                <td>Pouvoir restaurer vos dossiers</td>
                <td>Obligation légale · Code du numérique, articles 219, 15° et 221</td>
              </tr>
              <tr>
                <td>Compte utilisateur et connexion</td>
                <td>Vous identifier et protéger l’accès</td>
                <td>Consentement, donné en ouvrant votre compte ou en acceptant l’accès que votre administrateur vous ouvre</td>
              </tr>
              <tr>
                <td>Demande d’essai</td>
                <td>Ouvrir le dossier d’essai et vous remettre l’accès</td>
                <td>Consentement, donné en envoyant le formulaire</td>
              </tr>
              <tr>
                <td>Mesure de fréquentation et erreurs de l’interface</td>
                <td>Savoir quels écrans servent, corriger les pannes</td>
                <td>Consentement, demandé avant tout envoi et retirable à tout moment (section 4)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          Sans adresse de courriel, aucun compte ne peut être ouvert ni aucun accès remis ; la demande d’essai exige en
          outre le type et le nom de l’entité (article 220, 7°). Refuser la mesure de fréquentation ne change rien au fonctionnement du
          logiciel.
        </P>

        <Titre id="temoins">4. Témoins et stockage local</Titre>
        <P>
          OmegaX ne dépose <strong>aucun traceur publicitaire</strong>.
          {surSite
            ? ' Sur cette installation, il ne mesure pas la fréquentation et ne signale aucune erreur à un service extérieur.'
            : ' Il peut mesurer la fréquentation de son interface, sans votre nom ni le contenu de vos dossiers, et signaler ses erreurs techniques (section 6), seulement si vous l’acceptez · la question vous est posée par un bandeau avant tout envoi. Avec votre accord, le navigateur garde dans son stockage local un identifiant tiré au hasard, sans lien avec votre compte ni avec votre dossier.'}{' '}
          Le seul témoin de connexion déposé est celui de votre session : il est strictement nécessaire au
          fonctionnement du logiciel, et il n’est pas lisible par le code de la page. Sans l’option « Rester
          connecté sur cet appareil », il se ferme avec le navigateur, et la session prend fin au plus tard au terme
          de la durée de session du service, huit heures par défaut, après la connexion. Avec cette option, la session dure trente jours au plus depuis la connexion,
          et se ferme après sept jours sans utilisation. La console de l’éditeur redemande le mot de passe et le code
          huit heures après la dernière connexion complète.
        </P>
        <P>
          Votre navigateur garde aussi, dans son stockage local et sur cet appareil seulement, la liste des cinq
          dossiers ouverts le plus récemment (nom du dossier, adresse de connexion, date), qui préremplit l’adresse
          à l’ouverture, le jeton qui protège vos envois contre la falsification de requête, et vos préférences
          d’affichage (exercice choisi, favoris de l’accueil, onglets). Rien de cela n’est transmis à un tiers ;
          effacer les données de ce site dans le navigateur le supprime.
        </P>
        {!surSite && (
          <P>
            Votre réponse au bandeau est gardée dans ce même stockage local, avec sa date. Pour la changer, utilisez{' '}
            <LienPreferencesMesure className="text-sel underline" />, en bas de cette page et de l’écran d’ouverture ·
            retirer votre accord est aussi simple que de le donner (article 196).
          </P>
        )}

        <Titre id="ne-fait-pas">5. Ce que le logiciel ne fait pas</Titre>
        <P>
          Vos données comptables ne sont <strong>ni revendues, ni cédées, ni exploitées à d’autres fins</strong> que
          de vous rendre le service. Elles ne servent pas à entraîner de modèle statistique. Aucune décision
          automatisée n’est prise à votre sujet.
        </P>
        <P>
          OmegaX ne fait <strong>aucune prospection</strong> · vos données ne servent ni à vous adresser de la
          publicité, ni à en adresser à vos tiers, et ne sont communiquées à aucun partenaire commercial.
        </P>

        <Titre id="hebergement">6. Où vos données sont hébergées</Titre>
        {surSite ? (
          <>
            <P>
              Cette installation d’OmegaX est <strong>installée sur un ordinateur de votre entité</strong>. La base de
              données, le serveur d’application et l’interface y tournent tous les trois : vos dossiers comptables
              restent sur cet ordinateur et ne sont confiés à aucun hébergeur. VMG Consulting n’y a pas accès.
            </P>
            <P>
              Un courriel ne part du logiciel (relance, avis d’accès) que si votre entité a configuré une messagerie
              sur ce poste · le prestataire qu’elle a choisi reçoit alors l’adresse du destinataire et le texte du
              courrier.
            </P>
            <P>
              <strong>Aucune erreur technique ni aucune page vue ne quitte cette installation</strong> : les services
              de mesure utilisés par la version en ligne (Sentry, PostHog) n’y sont pas activés.
            </P>
          </>
        ) : (
          <>
            <P>
              Sept prestataires interviennent, chacun pour une part précise :
            </P>
            <ul className="text-[11.5px] leading-relaxed mb-2 list-disc pl-5">
              <li>
                <strong>Neon</strong> héberge la base de données PostgreSQL qui contient vos dossiers comptables.
              </li>
              <li>
                <strong>Google Cloud Run</strong>, dans la région <strong>us-east1</strong> (Caroline du Sud, États-Unis
                d’Amérique), exécute le serveur d’application qui lit et écrit dans cette base.
              </li>
              <li>
                <strong>Firebase Hosting</strong> sert l’interface, c’est à dire les pages et les scripts que votre
                navigateur affiche, et relaie vos requêtes vers le serveur. Aucune donnée comptable n’y est stockée.
              </li>
              <li>
                <strong>GitHub</strong> (service GitHub Actions) produit chaque nuit la sauvegarde de la base et la
                conserve, chiffrée (section 7). Une copie de ce fichier chiffré est déposée chaque nuit dans{' '}
                <strong>Google Cloud Storage</strong>, dans la région <strong>europe-west1</strong> (Belgique).
              </li>
              <li>
                <strong>Le prestataire de messagerie</strong> (SMTP) retenu par VMG Consulting reçoit l’adresse du
                destinataire et le texte des courriers que le logiciel envoie à votre demande · relances, factures,
                licences, avis d’accès. <em>Son nom doit être arrêté par VMG Consulting et porté ici avant toute
                publication de cette page sur un magasin d’applications.</em>
              </li>
              <li>
                <strong>Sentry</strong>, dans sa région de données de l’<strong>Union européenne</strong>, reçoit les
                erreurs techniques du serveur et, avec votre accord seulement (section 4), de l’interface · le type de l’erreur, l’endroit du code où elle est
                survenue, l’écran ou la route en cause, le navigateur et sa version. S’y ajoutent le fil des
                dernières requêtes réduit à leur méthode, leur adresse sans identifiants ni paramètres et leur
                statut, les écrans ouverts juste avant, et la version publiée du logiciel.
              </li>
              <li>
                <strong>PostHog</strong>, dans sa région de données de l’<strong>Union européenne</strong>, reçoit les
                pages vues de l’interface, sans votre nom ni le contenu de vos dossiers et avec votre accord seulement (section 4) · l’écran ouvert, le rôle de l’utilisateur (comptable,
                administrateur…), le référentiel du dossier (SYCEBNL ou SYSCOHADA), le navigateur et la taille de
                l’écran. S’y ajoutent le système d’exploitation, le fuseau horaire, le type d’appareil, l’adresse du
                site et des identifiants de session tirés au hasard ; aucune localisation n’est déduite de l’adresse
                réseau.
              </li>
            </ul>
            <P>
              Ni Sentry ni PostHog ne reçoivent <strong>jamais</strong> de donnée de vos dossiers : aucun montant,
              aucun nom, aucune adresse de courriel, aucun contenu saisi, aucun libellé, aucun numéro de pièce, aucun
              témoin de connexion. Les identifiants et les nombres sont retirés des adresses des écrans avant l’envoi,
              les messages d’erreur sont réduits à leur forme, et aucun enregistrement de votre session n’est fait.
              Comme toute connexion, ces deux services voient passer l’adresse réseau qui leur écrit.{' '}
              <em>
                Le réglage qui leur interdit de la conserver doit être activé par VMG Consulting dans chacun des deux
                services avant toute publication de cette page sur un magasin d’applications.
              </em>
            </P>
            <P>
              Vos données sont donc <strong>hébergées hors de la République démocratique du Congo</strong>. Ce point
              est énoncé ici parce qu’il vous appartient de le connaître et, le cas échéant, de vérifier qu’il est
              compatible avec les engagements pris envers vos propres bailleurs de fonds.
            </P>
            <P>
              Le Code du numérique congolais (ordonnance-loi n° 23/10 du 13 mars 2023) pose à son article 201 que les
              données personnelles sont stockées ou hébergées en République démocratique du Congo, et qu’un transfert
              vers un État tiers suppose l’autorisation préalable de l’Autorité de protection des données ; son
              article 202 énumère les cas où un tel transfert reste possible. <strong>La base juridique du transfert
              opéré ici est en cours de qualification.</strong> Pour les données personnelles de vos dossiers, dont
              votre entité est responsable, le transfert relève de ses instructions, VMG Consulting agissant pour son
              compte (article 229).
            </P>
          </>
        )}

        <Titre id="conservation">7. Combien de temps elles sont conservées</Titre>
        {surSite ? (
          <P>
            Vos dossiers comptables restent sur cet ordinateur aussi longtemps que votre entité les y garde, et la
            durée légale de conservation des documents comptables s’impose à elle : les états financiers et les
            pièces qui les justifient doivent rester présentables après la clôture.
          </P>
        ) : (
          <P>
            Vos dossiers comptables sont conservés pendant toute la durée de votre abonnement, puis pendant la durée
            légale de conservation des documents comptables. Ce n’est pas un choix commercial : les états financiers
            et les pièces qui les justifient doivent rester présentables après la clôture.
          </P>
        )}
        <P>
          Les <strong>données de compte et le journal d’audit</strong> ne sont soumis à aucune purge. Un compte
          utilisateur se désactive, il ne se supprime pas ; le journal, dont chaque événement porte l’empreinte du
          précédent, garde le courriel et l’adresse IP de l’auteur de chaque acte tant que le dossier existe.
          {!surSite && (
            <em>
              {' '}
              Leur durée de conservation doit être arrêtée par VMG Consulting et portée ici avant toute publication
              de cette page sur un magasin d’applications.
            </em>
          )}
        </P>
        {surSite ? (
          <P>
            Une <strong>sauvegarde</strong> de la base est produite chaque jour sur cet ordinateur, et les trente plus
            récentes sont gardées, sauf réglage différent de votre installation. Une copie peut en être déposée hors
            du poste, <strong>chiffrée</strong> par une phrase secrète que choisit l’administrateur de l’installation ·
            sans elle, la copie ne se relit pas, et VMG Consulting ne la détient pas.
          </P>
        ) : (
          <P>
            Une <strong>sauvegarde chiffrée</strong> de la base est produite chaque nuit. Elle est chiffrée avant de
            quitter le serveur qui la produit, et VMG Consulting est seul à détenir la clé qui permet de la lire. Le
            fichier est conservé quatre-vingt-dix jours par GitHub ; sa copie déposée dans Google Cloud Storage
            (europe-west1) n’a pas de durée fixée par le logiciel.{' '}
            <em>
              La durée de conservation de cette copie doit être arrêtée par VMG Consulting et portée ici avant toute
              publication de cette page sur un magasin d’applications.
            </em>
          </P>
        )}
        {!surSite && (
          <P>
            Un <strong>dossier d’essai</strong> arrivé à son terme passe en lecture seule · ses données restent
            consultables, rien ne s’y écrit plus.{' '}
            <em>
              La durée au-delà de laquelle un dossier d’essai non souscrit est supprimé doit être arrêtée par VMG
              Consulting et portée ici avant toute publication de cette page sur un magasin d’applications.
            </em>
          </P>
        )}

        <Titre id="protection">8. Comment elles sont protégées</Titre>
        {surSite ? (
          <P>
            Sur cette installation, les échanges entre les postes du bureau et l’ordinateur qui porte OmegaX passent
            en <strong>http, sur le réseau local</strong> de votre entité : OmegaX ne les chiffre pas. Le service
            n’est ouvert qu’aux réseaux privés et de domaine par la règle de pare-feu posée à l’installation.
          </P>
        ) : (
          <P>
            Les échanges entre votre navigateur et le service sont <strong>chiffrés en transit (HTTPS)</strong>{' '}
            jusqu’au relais Firebase Hosting, qui les transmet au serveur d’application. Ce n’est pas un chiffrement
            de bout en bout : le relais les déchiffre pour les acheminer.
          </P>
        )}
        <P>
          Chaque dossier est cloisonné
          des autres au niveau de chaque requête du serveur : une requête qui ne porte pas la borne de votre dossier
          est refusée par le logiciel, elle n’est pas corrigée en silence. Les mots de passe ne sont jamais stockés en
          clair. Les tentatives de connexion répétées sont ralenties, et une session est révoquée dès qu’un mot de
          passe change, qu’un accès est retiré ou qu’un rôle est modifié.
        </P>
        <P>
          <strong>VMG Consulting ne consulte pas le contenu de vos dossiers.</strong> Ses accès techniques à la
          base se limitent à la sauvegarde chiffrée de chaque nuit, dont elle détient la clé, à la restauration de
          contrôle automatique qui l’éprouve et ne rend que des décomptes et le contrôle de l’équilibre des
          écritures, et aux requêtes de maintenance, qui ne rendent que des identifiants et des nombres, jamais un
          montant, un compte, un objet ni un motif. Sa console d’exploitation ne montre d’un dossier que sa fiche
          commerciale et sa licence ; une correction de dossier se fait par vous, dans votre dossier. Le mot de
          passe provisoire d’un administrateur, tiré au sort par le serveur, part à sa seule adresse électronique.
          Le fournisseur de services numériques reste tenu à la confidentialité des données qu’il traite, sauf
          réquisition judiciaire (Code du numérique, article 37).
        </P>

        <Titre id="violation">9. Si vos données étaient exposées</Titre>
        {surSite ? (
          <P>
            Sur cette installation, VMG Consulting n’a accès à aucune donnée. L’article 244 du Code du numérique met
            la notification d’une violation, <strong>sans délai</strong>, à l’Autorité de protection des données et
            aux personnes concernées, à la charge du responsable du traitement · votre entité, pour les données
            qu’elle tient sur cet ordinateur.
          </P>
        ) : (
          <>
            <P>
              L’article 244 du Code du numérique distingue deux obligations. Pour les{' '}
              <strong>données de compte et de traçabilité</strong>, dont VMG Consulting est responsable, nous
              notifierons <strong>sans délai</strong>, à l’Autorité de protection des données et à vous-même, toute
              violation les ayant affectées (alinéa 1er).
            </P>
            <P>
              Pour les <strong>données personnelles de vos dossiers</strong>, dont votre entité est responsable, VMG
              Consulting, sous-traitant, vous avertira <strong>sans délai</strong> de toute atteinte à leur sécurité
              (alinéa 2) · il revient alors à votre entité de notifier l’Autorité et les personnes concernées
              (alinéa 1er). Dans les deux cas, nous vous dirons ce qui a été atteint, quand, et ce que nous avons
              fait, plutôt que de vous adresser une formule.
            </P>
          </>
        )}

        <Titre id="droits">10. Vos droits</Titre>
        <P>
          Vous pouvez demander à consulter, corriger, exporter ou supprimer les données qui vous concernent. L’export
          de vos dossiers est d’ailleurs prévu dans le logiciel : les états financiers, la liasse complète et les
          livres obligatoires s’exportent au format tableur sans avoir à nous le demander, et
          <strong> Fichier &gt; Restituer le dossier complet</strong> en produit une archive, table par table, en un
          seul fichier, sous les cinq réserves qu’elle écrit elle-même (elle ne remplace notamment pas la
          conservation des pièces justificatives).
        </P>
        <P>
          L’effacement cède devant une obligation légale qui impose de conserver les données (article 216) ; son
          articulation avec la conservation des documents comptables et du journal d’audit est en cours de
          qualification. Vous pouvez aussi définir les modalités de la gestion de vos données personnelles après
          votre mort (article 208), et vous avez le droit d’introduire une réclamation auprès de l’autorité chargée
          de la protection des données à caractère personnel et de former un recours juridictionnel (articles 220
          et 239).
        </P>
        <P>
          Le traitement que VMG Consulting fait des données de vos dossiers pour le compte de votre entité est réglé
          par l’article 9 du <LienPageLegale chemin="/contrat-de-licence">contrat de licence</LienPageLegale>,
          comme le veut l’article 229 du Code du numérique.
        </P>
        <P>
          Pour toute autre demande, écrivez à VMG Consulting à l’adresse{' '}
          <a href="mailto:admin@vmgconsulting.net" className="text-sel underline">
            admin@vmgconsulting.net
          </a>{' '}
          (adresse arrêtée par VMG Consulting le 17 octobre 2026). <em>L’adresse postale du cabinet doit être arrêtée
          par VMG Consulting et portée ici avant toute publication de cette page sur un magasin d’applications.</em>{' '}
          Elle n’est pas inscrite d’office : une adresse inventée dirigerait vos demandes vers le vide.
        </P>
        <P>
          <strong>Délais.</strong> Nous vous disons la suite donnée à votre demande dans les{' '}
          <strong>trente jours</strong> de sa réception (articles 213, 214 et 239). L’article 239 permet de prolonger
          ce délai de soixante jours au plus quand la demande est complexe ; nous vous le dirions alors, avec le motif,
          dans les trente premiers jours. La copie de vos données vous est remise au plus tard soixante jours après la
          demande (article 210). La réponse est gratuite (article 240) ; nous pouvons vous demander de quoi confirmer
          votre identité (article 241).
        </P>

        <Titre id="mineurs">11. Les mineurs</Titre>
        <P>
          OmegaX est un logiciel professionnel, destiné aux entités et à leurs comptables · il n’est pas proposé aux
          mineurs, et nous n’ouvrons pas de compte à un mineur en connaissance de cause. Un dossier peut néanmoins
          contenir des données relatives à un mineur, par exemple les enfants à charge d’un salarié au registre du
          personnel · elles sont traitées pour le compte de l’entité, qui en est responsable. L’article 247 du Code du
          numérique soumet au consentement du titulaire de la responsabilité parentale le traitement des données d’un
          mineur à qui un service est offert directement, ce qui n’est pas le cas d’OmegaX.
        </P>

        <Titre id="modifications">12. Modifications</Titre>
        <P>
          Cette politique peut évoluer avec le logiciel, et la date de sa dernière mise à jour figure en tête de
          page. Elle fait partie de l’offre de VMG Consulting (Code du numérique, article 53, 10°) · une modification
          de ce qu’elle engage suit l’article 15 du contrat de licence, c’est-à-dire l’article 34 du Code du
          numérique · projet communiqué au moins trente jours ouvrables avant son entrée en vigueur.
        </P>

        <Titre id="contact">13. Nous contacter</Titre>
        <div className="border border-border px-3 py-2 mb-2 text-[11.5px] leading-relaxed">
          <p className="font-bold">VMG Consulting</p>
          <p>Responsable du traitement des données de compte et de traçabilité</p>
          <p className="mt-1">
            Courriel ·{' '}
            <a href="mailto:admin@vmgconsulting.net" className="text-sel underline">
              admin@vmgconsulting.net
            </a>
          </p>
          <p>
            <em>Adresse postale · à arrêter par VMG Consulting (section 10).</em>
          </p>
        </div>
        <P>
          Si notre réponse ne vous satisfait pas, vous pouvez saisir l’Autorité de protection des données (article
          239).
        </P>
    </>
  );
}
