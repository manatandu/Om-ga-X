import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filtrerQuestions, normaliserRecherche, QUESTIONS_FREQUENTES } from '../lib/questions-frequentes';
import { cibleDuLien } from '../lib/lien-page-legale';
import { mentionsAArreter, texteBrutDesConditions } from '../../../src/modules/conditions-licence/conditions-de-licence';

// Aucun import de « vitest » (globales) · convention du dépôt, le spec tourne
// aussi sous le jest de la racine.

/**
 * LES PAGES LÉGALES ET L'AIDE (ligne pages-legales, demande de Manasse du
 * 2026-10-15) · questions fréquentes, contrat de licence, politique de
 * confidentialité. Ce qui casserait en silence · une page publique passée
 * derrière le mot de passe, un lien d'ouverture perdu, une réponse de la FAQ
 * qui dirait un délai que le code ne tient plus, une promesse « bientôt ».
 */

const RACINE = join(__dirname, '..', '..');
const lire = (p: string) => readFileSync(join(RACINE, p), 'utf8');
const serveur = (p: string) => readFileSync(join(RACINE, '..', p), 'utf8');
const constante = (source: string, nom: string) => new RegExp(`export const ${nom} = ([^;\\n]+)`).exec(source)?.[1] ?? '';

const reponses = QUESTIONS_FREQUENTES.flatMap((r) => r.questions);
const reponse = (id: string) => (reponses.find((q) => q.id === id)?.reponse ?? []).join(' ');

describe('les pages publiques se lisent sans session', () => {
  it('leurs routes sont hors de la zone protégée', () => {
    const app = lire('src/App.tsx');
    const zone = app.indexOf('<ZoneProtegee>');
    for (const chemin of ['/confidentialite', '/contrat-de-licence', '/questions-frequentes']) {
      const i = app.indexOf(`path="${chemin}"`);
      expect([chemin, i > 0 && i < zone]).toEqual([chemin, true]);
    }
  });

  it('l’écran d’ouverture y renvoie, toutes les trois', () => {
    const auth = lire('src/pages/AuthPage.tsx');
    for (const lien of ['#/questions-frequentes', '#/contrat-de-licence', '#/confidentialite']) expect(auth).toContain(`href="${lien}"`);
  });

  it('le cadre public ramène à l’ouverture et permet d’imprimer (Code du numérique, art. 53, al. 1er)', () => {
    const cadre = lire('src/components/CadrePagePublique.tsx');
    expect(cadre).toContain('href="#/connexion"');
    expect(cadre).toContain('onClick={() => window.print()}');
  });
});

describe('le menu « ? » ouvre les trois pages en fenêtre, et À propos', () => {
  const shell = lire('src/components/chrome/AppShell.tsx');
  const registre = lire('src/lib/registre-fenetres.tsx');
  const fenetres = [
    { chemin: '/aide/questions-frequentes', titre: 'Questions fréquentes' },
    { chemin: '/aide/contrat-de-licence', titre: 'Contrat de licence' },
    { chemin: '/aide/confidentialite', titre: 'Politique de confidentialité' },
  ];

  it('chaque commande porte son chemin, que le balayage des tests navigateur lit', () => {
    for (const f of fenetres) expect(shell).toContain(`{ label: '${f.titre}', chemin: '${f.chemin}'`);
    const menu = shell.slice(shell.indexOf("titre: '?'"));
    expect(menu.indexOf('Questions fréquentes')).toBeLessThan(menu.indexOf('À propos d’OmegaX'));
  });

  it('chaque chemin est une fenêtre du registre, au titre de sa commande', () => {
    for (const f of fenetres) {
      const motif = `motif: /^${f.chemin.replace(/\//g, '\\/')}$/,\n    titre: '${f.titre}'`;
      expect([f.chemin, registre.includes(motif)]).toEqual([f.chemin, true]);
    }
  });
});

describe('un lien entre pages légales reste dans l’espace de travail quand il y est (second tour, M1)', () => {
  it('dans une fenêtre, il ouvre la fenêtre de l’autre page · sur la page publique, la page publique', () => {
    expect(cibleDuLien('/contrat-de-licence', true)).toEqual({ href: '#/aide/contrat-de-licence', routeInterne: '/aide/contrat-de-licence' });
    expect(cibleDuLien('/contrat-de-licence', false)).toEqual({ href: '#/contrat-de-licence', routeInterne: null });
  });

  it('la fenêtre pose le contexte, et le lien y navigue sans quitter la zone protégée', () => {
    const cadre = lire('src/components/CadrePagePublique.tsx');
    const corps = cadre.slice(cadre.indexOf('export function CorpsFenetreLegale'));
    expect(corps).toContain('<EnFenetreLegale.Provider value={true}>');
    const lien = cadre.slice(cadre.indexOf('export function LienPageLegale'), cadre.indexOf('export function CorpsFenetreLegale'));
    expect(lien).toContain('const enFenetre = useContext(EnFenetreLegale);');
    expect(lien).toContain('e.preventDefault();');
    expect(lien).toContain('navigate(route);');
  });

  it('aucun contenu légal n’écrit un lien brut vers une page publique · il passe par LienPageLegale', () => {
    for (const fichier of ['src/pages/ConfidentialitePage.tsx', 'src/pages/ContratLicencePage.tsx', 'src/pages/QuestionsFrequentesPage.tsx', 'src/components/AcceptationConditionsLicence.tsx']) {
      expect([fichier, /href="#\//.test(lire(fichier))]).toEqual([fichier, false]);
    }
    expect(lire('src/pages/ConfidentialitePage.tsx')).toContain('<LienPageLegale chemin="/contrat-de-licence">');
  });
});

describe('la recherche dans les questions fréquentes (second tour, M2)', () => {
  const trouve = (recherche: string) => filtrerQuestions(QUESTIONS_FREQUENTES, recherche).flatMap((r) => r.questions.map((q) => q.id));

  it('l’apostrophe droite, le trait d’union et la ponctuation se lisent comme une espace, des deux côtés', () => {
    expect(normaliserRecherche('Qu’est-ce qu\'OmegaX ?')).toBe('qu est ce qu omegax');
    expect(normaliserRecherche('double-authentification')).toBe('double authentification');
    for (const recherche of ['l\'essai', 'qu\'est-ce', 'double-authentification', 'l’essai', 'SECURITE']) {
      expect([recherche, trouve(recherche).length > 0]).toEqual([recherche, true]);
    }
  });

  it('le titre de la rubrique se cherche aussi', () => {
    const rubrique = QUESTIONS_FREQUENTES.find((r) => r.titre === 'Abonnement et licence')!;
    // Un mot du seul titre rend toutes les questions de la rubrique.
    const mot = 'licence';
    const retenues = filtrerQuestions(QUESTIONS_FREQUENTES, `${mot} abonnement`).find((r) => r.id === rubrique.id);
    expect(retenues?.questions.length).toBe(rubrique.questions.length);
  });

  it('une recherche vide rend tout, une recherche sans réponse rien', () => {
    expect(filtrerQuestions(QUESTIONS_FREQUENTES, '  ')).toEqual(QUESTIONS_FREQUENTES);
    expect(filtrerQuestions(QUESTIONS_FREQUENTES, 'zzzqqq')).toEqual([]);
  });

  it('la page filtre par cette fonction, s’imprime dépliée et annonce le résultat vide (mineurs 1 et 7)', () => {
    const page = lire('src/pages/QuestionsFrequentesPage.tsx');
    expect(page).toContain('filtrerQuestions(QUESTIONS_FREQUENTES, recherche)');
    expect(page).toContain('const avant = () => flushSync(() => setImpression(true));');
    expect(page).toMatch(/<div role="status">\{rubriques\.length === 0 && <p[^>]*>Aucune question ne contient ces mots\.<\/p>\}<\/div>/);
  });
});

describe('la foire aux questions dit ce que le code fait', () => {
  it('chaque question a une ancre unique, chaque rubrique aussi', () => {
    const ids = reponses.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rubriques = QUESTIONS_FREQUENTES.map((r) => r.id);
    expect(new Set(rubriques).size).toBe(rubriques.length);
    expect(reponses.length).toBeGreaterThan(25);
  });

  it('l’essai et le délai de paiement sont ceux du moteur de facturation', () => {
    const f = serveur('src/modules/plateforme/abonnements/facturation-abonnements.ts');
    expect(constante(f, 'JOURS_ESSAI')).toBe('30');
    expect(constante(f, 'DELAI_PAIEMENT_JOURS')).toBe('15');
    expect(reponse('q-essai')).toContain('Trente jours, gratuits.');
    expect(reponse('q-echeance')).toContain('quinze jours après la fin de l’essai');
  });

  it('le verrou de connexion est celui de verrouillage.ts', () => {
    const v = serveur('src/modules/auth/verrouillage.ts');
    expect(constante(v, 'SEUIL_VERROUILLAGE')).toBe('5');
    expect(constante(v, 'PALIERS_VERROU_MINUTES')).toBe('[1, 5, 15, 30, 60] as const');
    expect(constante(v, 'DELAI_OUBLI_ECHECS_HEURES')).toBe('12');
    expect(reponse('q-verrou')).toContain('Après cinq essais manqués');
    expect(reponse('q-verrou')).toContain('une minute, puis cinq, quinze, trente et soixante minutes');
    expect(reponse('q-verrou')).toContain('douze heures après le dernier échec');
  });

  it('le second facteur est celui de double-authentification.ts', () => {
    const d = serveur('src/modules/auth/double-authentification.ts');
    expect(constante(d, 'CHIFFRES')).toBe('6');
    expect(constante(d, 'PAS_SECONDES')).toBe('30');
    expect(constante(d, 'NOMBRE_CODES_SECOURS')).toBe('8');
    expect(reponse('q-double-authentification')).toContain('un code de six chiffres renouvelé toutes les trente secondes');
    expect(reponse('q-double-authentification')).toContain('Huit codes de secours');
  });

  it('les durées de session sont celles de session-longue.ts', () => {
    const s = serveur('src/modules/auth/session-longue.ts');
    expect(constante(s, 'DUREE_MAXIMALE_SESSION_LONGUE_S')).toBe('30 * SECONDES_PAR_JOUR');
    expect(constante(s, 'DUREE_INACTIVITE_SESSION_LONGUE_S')).toBe('7 * SECONDES_PAR_JOUR');
    expect(reponse('q-rester-connecte')).toContain('trente jours au plus, et se ferme après sept jours sans utilisation');
    // Huit heures est la valeur PAR DÉFAUT de JWT_EXPIRES_IN, que la production
    // reçoit d'un secret · la FAQ le dit (relecture, mineur 12).
    expect(serveur('src/modules/auth/auth.module.ts')).toContain("config.get<string>('JWT_EXPIRES_IN', '8h')");
    expect(reponse('q-rester-connecte')).toContain('au terme de la durée de session du service, huit heures par défaut');
  });

  it('la grille des formules vient du contrat, qui la confronte à la console', () => {
    expect(reponse('q-formules')).toContain('Essentiel (1 dossier, 2 utilisateurs · tenue, états financiers, notes)');
  });

  it('dit la pratique de l’éditeur sur les données, comme la politique de confidentialité, jamais une impossibilité', () => {
    // Relecture B1 · la FAQ répondait « Non. » à « l'éditeur voit-il mes données ? »
    // alors que la sauvegarde de chaque nuit lit toute la base et la
    // restaure pour contrôle. La réponse dit ce que l'éditeur fait et nomme ses
    // accès, les mêmes que la politique.
    const r = reponse('q-editeur-voit');
    expect(r.startsWith('L’éditeur d’OmegaX ne consulte pas le contenu de vos dossiers.')).toBe(true);
    expect(r).toContain('la sauvegarde chiffrée de chaque nuit, dont il détient la clé');
    expect(r).toContain('la restauration de contrôle automatique');
    expect(r).toContain('requêtes de maintenance');
    const politique = lire('src/pages/ConfidentialitePage.tsx').replace(/\s+/g, ' ');
    expect(politique).toContain('à la restauration de contrôle automatique qui l’éprouve et ne rend que des décomptes');
  });

  it('dit la lecture seule telle que la garde la tient, et la restitution avec ses réserves (relecture, mineurs 4 et 10)', () => {
    expect(reponse('q-echeance')).toContain('aucune saisie, aucune modification ni aucune impression numérotée du journal n’y est plus admise');
    expect(reponse('q-echeance')).toContain('sous les cinq réserves qu’elle écrit elle-même');
    expect(reponse('q-recuperer')).toContain('Le manifeste écrit cinq réserves');
    expect(lire('src/pages/ConfidentialitePage.tsx').replace(/\s+/g, ' ')).toContain('sous les cinq réserves qu’elle écrit elle-même');
  });

  it('dit les chemins et les droits tels que l’interface les tient (relecture, mineurs 1, 2, 3, 9)', () => {
    const shell = lire('src/components/chrome/AppShell.tsx');
    const cloture = shell.slice(shell.indexOf("titre: 'Clôture'"));
    expect(cloture.slice(0, cloture.indexOf('],'))).toContain(`label: "Fin d'exercice…", chemin: '/exercice'`);
    expect(reponse('q-cloture')).toContain('Par la commande Fin d’exercice… du menu Traitement > Clôture.');
    // Le bouton Personnaliser n'est offert qu'à l'administrateur.
    const plan = lire('src/pages/PlanComptesPage.tsx');
    const bouton = plan.slice(0, plan.indexOf('setPersonnaliserOuvert(true);'));
    expect(bouton.slice(bouton.lastIndexOf('{estAdmin'))).toMatch(/^\{estAdmin && selection\.duPlan/);
    expect(reponse('q-compte-refuse')).toContain('le bouton Personnaliser de sa fiche, qui lui est réservé');
    // L'impression · la fenêtre active, sans boutons, et une structure à plat (index.css).
    const css = lire('src/index.css');
    expect(css).toContain('.fenetre-inactive {');
    expect(css).toContain('.avec-edition > *:not(.impression-seul) {');
    expect(reponse('q-imprimer')).toContain('Ce qui s’imprime est la fenêtre active, mise en page pour le papier');
    // Le journal d'audit · réservé à l'administrateur, et ce qu'il couvre.
    expect(serveur('src/common/audit/journal-audit.controller.ts')).toContain('@Roles(RoleUtilisateur.ADMIN_CABINET)');
    expect(reponse('q-qui-a-fait')).toContain('garde les actes qui touchent aux accès, à la configuration du dossier et aux actes d’exercice');
    expect(reponse('q-qui-a-fait')).toContain('Il ne recopie pas chaque ligne d’écriture.');
  });

  it('nomme le spec qui confronte la FAQ au code (relecture, mineur 11)', () => {
    expect(lire('src/lib/questions-frequentes.ts')).toContain('`client/src/pages/pages-legales.spec.ts`');
  });

  it('dit le français, seul, et ne promet aucune autre langue', () => {
    expect(reponse('q-langue')).toContain('En français seulement.');
    expect(reponse('q-langue')).toContain('aucune autre langue n’est proposée');
  });

  it('dit les coordonnées de l’éditeur à arrêter tant que le contrat les dit à arrêter', () => {
    // Le jour où l'éditeur les arrête dans le contrat, la réponse se
    // réécrit avec elles · ce test tombe pour qu'on n'oublie pas.
    expect(mentionsAArreter().length > 0).toBe(reponse('q-joindre').includes('doivent être arrêtés par l’éditeur'));
  });

  it('aucune réponse n’annonce une fonction à venir (CLAUDE.md § 4)', () => {
    for (const q of reponses) expect([q.id, /bient[ôo]t|prochainement|à venir/i.test(q.reponse.join(' '))]).toEqual([q.id, false]);
  });
});

describe('le contrat de licence se lit sur la page tel que le serveur le joint', () => {
  it('la page le rend depuis le module partagé, sans second texte', () => {
    const page = lire('src/pages/ContratLicencePage.tsx');
    expect(page).toContain("from '../../../src/modules/conditions-licence/conditions-de-licence'");
    expect(page).toContain('articlesDesConditions().map(');
    expect(page).toContain('texteBrutDesConditions()');
  });

  it('la fenêtre porte l’acceptation, la page publique non', () => {
    const page = lire('src/pages/ContratLicencePage.tsx');
    const publique = page.slice(page.indexOf('export function ContratLicencePage'), page.indexOf('export function ContratLicenceFenetre'));
    const fenetre = page.slice(page.indexOf('export function ContratLicenceFenetre'));
    expect(publique).not.toContain('<AcceptationConditionsLicence />');
    expect(fenetre).toContain('<AcceptationConditionsLicence />');
  });

  it('l’acceptation envoie le numéro et l’empreinte du texte AFFICHÉ, jamais ceux que le serveur rend (relecture M1)', () => {
    // Le défaut gelé ici jusqu'à la relecture · `version: etat.version.numero`
    // renvoyait au serveur sa propre version, et une page restée ouverte sur
    // un autre texte l'acceptait quand même.
    const bloc = lire('src/components/AcceptationConditionsLicence.tsx');
    expect(bloc).toContain('const VERSION_AFFICHEE = VERSION_CONDITIONS_LICENCE.numero;');
    expect(bloc).toContain('const EMPREINTE_AFFICHEE = empreinteEnVigueur();');
    // L'OBJET de l'appel, découpé par sa structure (CLAUDE.md § 10, second
    // tour, mineur 9) · jamais une distance en caractères.
    const debut = bloc.indexOf("'/conditions-licence/acceptation', {");
    expect(debut).toBeGreaterThan(0);
    const envoi = bloc.slice(debut, bloc.indexOf('});', debut));
    expect(envoi).toContain('version: VERSION_AFFICHEE,');
    expect(envoi).toContain('empreinte: EMPREINTE_AFFICHEE,');
    expect(envoi).toContain('lu: true,');
    // L'abonnement AFFICHÉ, celui que le serveur confronte sous le verrou (second tour, M-a).
    expect(envoi).toContain('empreinteCommande: empreinteCommande(etat.commande),');
  });

  it('une acceptation refusée relit l’état et décoche la case · on revoit le prix avant de reprendre (second tour, mineur 3)', () => {
    const bloc = lire('src/components/AcceptationConditionsLicence.tsx');
    const accepter = bloc.slice(bloc.indexOf('async function accepter()'), bloc.indexOf('async function renvoyerAccuse()'));
    const refus = accepter.slice(accepter.indexOf('} catch (e) {'), accepter.indexOf('} finally {'));
    expect(refus).toContain('setLu(false);');
    expect(refus).toContain('relire();');
    const renvoi = bloc.slice(bloc.indexOf('async function renvoyerAccuse()'));
    expect(renvoi.slice(renvoi.indexOf('} catch (e) {'), renvoi.indexOf('} finally {'))).toContain('relire();');
  });

  it('l’accusé reçoit le focus quand il paraît (second tour, mineur 7)', () => {
    const bloc = lire('src/components/AcceptationConditionsLicence.tsx');
    expect(bloc).toContain('if (accuse) refAccuse.current?.focus();');
    expect(bloc).toContain('<div ref={refAccuse} tabIndex={-1} role="status"');
  });

  it('l’abonnement s’affiche en tableau à en-têtes, dates en toutes lettres (second tour, mineur 5)', () => {
    const bloc = lire('src/components/AcceptationConditionsLicence.tsx');
    for (const titre of ['Désignation', 'Quantité', 'Prix unitaire']) expect(bloc).toMatch(new RegExp(`<th scope="col"[^>]*>${titre}</th>`));
    expect(bloc).toContain('dateEnLettres(etat.commande.debut)');
    expect(bloc).toContain('dateEnLettres(etat.commande.finEssai)');
  });

  it('un texte qui n’est pas celui du service n’offre pas l’acceptation, et demande de recharger la page', () => {
    const bloc = lire('src/components/AcceptationConditionsLicence.tsx');
    expect(bloc).toContain('const ecart = etat ? ecartDeTexte(etat.version, { numero: VERSION_AFFICHEE, empreinte: EMPREINTE_AFFICHEE }) : null;');
    expect(bloc).toContain("const texteAJour = ecart === 'A_JOUR';");
    expect(bloc).toContain('{etat.aAccepter && estAdmin && texteAJour && (');
    expect(bloc).toContain('phraseEcartDeTexte(ecart, etat.version.numero, VERSION_AFFICHEE, estAdmin)');
    expect(bloc).toContain('onClick={() => window.location.reload()}');
    // Une page plus récente que le service ne recharge pas, elle relit (second tour, m-2).
    expect(bloc).toContain("{ecart === 'SERVICE_EN_RETARD' ? (");
    expect(bloc).toContain('onClick={relire}');
  });

  it('l’accusé dit ce que devient le courriel · sans messagerie, il ne part pas (relecture, mineurs 5 et 14)', () => {
    const bloc = lire('src/components/AcceptationConditionsLicence.tsx');
    // Les phrases sont dans `lib/acceptation-conditions-ecran.ts`, éprouvées par son spec.
    expect(bloc).toContain('phraseAccuse(statutAccuse, estAdmin)');
    expect(bloc).toContain("'/conditions-licence/accuse'");
    expect(bloc).toContain('{estAdmin && etat.renvoiAccusePossible && (');
    // Un auteur absent ne s'affiche jamais comme une case vide (mineur 6).
    expect(bloc).toContain('{etat.acceptation.par ?? AUTEUR_NON_ENREGISTRE}');
  });

  it('les versions antérieures se lisent dans l’archive des versions publiées (relecture M2)', () => {
    const page = lire('src/pages/ContratLicencePage.tsx');
    expect(page).toContain('VERSIONS_PUBLIEES.filter((v) => v.numero !== VERSION_CONDITIONS_LICENCE.numero)');
    expect(page).toContain('telechargerTexteDeVersion(v.numero, v.texte)');
  });

  it('le rappel de l’espace de travail ne ferme rien · une ligne, pour l’administrateur, servie par le serveur', () => {
    const bandeau = lire('src/components/chrome/BandeauConditions.tsx');
    expect(bandeau).toMatch(/\.get<EtatConditions>\('\/conditions-licence'\)/);
    expect(bandeau).toContain('if (!estAdmin || !tenantId)');
    expect(bandeau).toContain('if (!aAccepter) return null;');
    // Un échec de lecture se dit en une ligne, jamais masqué (relecture, mineur 13).
    expect(bandeau).toContain('setEchec(true);');
    expect(bandeau).toContain('L’état de l’acceptation des conditions de licence n’a pas pu être lu.');
  });

  it('le rappel se lit en entier à l’étroit, jamais tronqué avant sa fin (second tour, mineur 2)', () => {
    const bandeau = lire('src/components/chrome/BandeauConditions.tsx');
    expect(bandeau).toContain('<span className="min-w-0">L’état de l’acceptation des conditions de licence n’a pas pu être lu.</span>');
    expect(bandeau).toContain('<span className="min-w-0">Les conditions de licence en vigueur n’ont pas encore été acceptées pour ce dossier.</span>');
  });

  it('les trois pages publiques se chargent à la demande, l’attente dite (second tour, mineur 8)', () => {
    const app = lire('src/App.tsx');
    for (const [composant, fichier] of [
      ['ConfidentialitePage', 'ConfidentialitePage'],
      ['ContratLicencePage', 'ContratLicencePage'],
      ['QuestionsFrequentesPage', 'QuestionsFrequentesPage'],
    ]) {
      expect(app).toContain(`const ${composant} = lazy(() => import('./pages/${fichier}')`);
      expect(app).toContain(`element={<PagePublique><${composant} /></PagePublique>}`);
    }
    expect(app).toContain('<Suspense fallback=');
  });

  it('« À propos » est une boîte de dialogue · Échap la ferme, le focus va à « Fermer » (second tour, mineur 10)', () => {
    const apropos = lire('src/components/chrome/AProposModale.tsx');
    expect(apropos).toContain('role="dialog"');
    expect(apropos).toContain('aria-labelledby="apropos-titre"');
    expect(apropos).toContain('return ecouterEchap(() => {');
    expect(apropos).toContain('refFermer.current?.focus({ preventScroll: true });');
    expect(apropos).toContain('<button ref={refFermer} onClick={onFermer}');
  });

  it('le texte brut porte la version et la langue', () => {
    expect(texteBrutDesConditions().split('\n')[1]).toMatch(/^Version \d+ du .+ · langue du contrat · français$/);
  });
});
