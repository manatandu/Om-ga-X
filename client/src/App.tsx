import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, HashRouter, Routes, useLocation } from 'react-router-dom';
import { pageVue } from './lib/telemetrie';
import { AuthProvider, useAuth } from './lib/auth';
import { ExerciceProvider } from './lib/exercice';
import { FenetresProvider } from './lib/fenetres';
import { AppShell } from './components/chrome/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EssaiPage } from './pages/EssaiPage';
import { ChangerMotDePassePage } from './pages/ChangerMotDePassePage';

// LES PAGES PUBLIQUES SE CHARGENT À LA DEMANDE (second tour de relecture,
// mineur 8) · le contrat, la politique et la FAQ pèsent leur texte entier, et
// l'écran d'ouverture n'a pas à les charger pour qui ne les ouvre pas, comme
// les fenêtres de l'espace de travail (`registre-fenetres.tsx`).
const ConfidentialitePage = lazy(() => import('./pages/ConfidentialitePage').then((m) => ({ default: m.ConfidentialitePage })));
const ContratLicencePage = lazy(() => import('./pages/ContratLicencePage').then((m) => ({ default: m.ContratLicencePage })));
const QuestionsFrequentesPage = lazy(() => import('./pages/QuestionsFrequentesPage').then((m) => ({ default: m.QuestionsFrequentesPage })));

/** L'attente d'une page publique chargée à la demande · dite, jamais un écran vide. */
function PagePublique({ children }: { children: JSX.Element }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[12px] text-text-dim">Chargement…</div>}>
      {children}
    </Suspense>
  );
}

function ZoneProtegee({ children }: { children: JSX.Element }) {
  const { chargement, connecte, utilisateur } = useAuth();
  if (chargement) {
    return <div className="min-h-screen flex items-center justify-center text-[12px] text-text-dim">Chargement…</div>;
  }
  if (!connecte) return <Navigate to="/connexion" replace />;
  // Mot de passe provisoire (remis par la console VMG, le siège d'un groupe
  // ou l'admin du dossier) : l'écran de changement s'impose À LA PLACE de
  // l'espace de travail, il n'y a rien d'autre à voir avant.
  if (utilisateur?.doitChangerMotDePasse) return <ChangerMotDePassePage />;
  return children;
}

function Routage() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      {/* L'essai en libre-service · la page se lit fermée tant que le serveur ne la dit pas ouverte. */}
      <Route path="/essai" element={<EssaiPage />} />
      {/*
        HORS de la zone protégée, et c'est tout l'objet de cette route : une
        politique de confidentialité derrière un mot de passe n'est pas une
        politique publiée, et aucun magasin d'applications ne l'accepte.
      */}
      <Route path="/confidentialite" element={<PagePublique><ConfidentialitePage /></PagePublique>} />
      {/*
        Même raison pour le contrat de licence (Code du numérique, art. 53,
        al. 1er · les conditions « mises à la disposition de la clientèle »)
        et pour les questions fréquentes, qu'un visiteur lit avant d'avoir un
        accès. Dans l'espace de travail, le menu « ? » les ouvre en fenêtre,
        sous /aide/… (registre-fenetres.tsx).
      */}
      <Route path="/contrat-de-licence" element={<PagePublique><ContratLicencePage /></PagePublique>} />
      <Route path="/questions-frequentes" element={<PagePublique><QuestionsFrequentesPage /></PagePublique>} />
      <Route
        path="/"
        element={
          <ZoneProtegee>
            <ExerciceProvider>
              <FenetresProvider>
                <AppShell />
              </FenetresProvider>
            </ExerciceProvider>
          </ZoneProtegee>
        }
      >
        {/*
          Les routes filles ne rendent plus rien : depuis le passage à
          l'espace de travail multi-fenêtres, c'est `AppShell` qui monte les
          fenêtres, à partir du registre (`lib/registre-fenetres.tsx`). Ce
          `path="*"` reste néanmoins nécessaire · sans lui, `navigate('/comptes')`
          ne correspondrait à aucune route, React Router avertirait, et
          l'adresse ne serait plus une adresse. La liste des écrans, elle, est
          tenue à UN SEUL endroit désormais : le registre.
        */}
        <Route index element={null} />
        <Route path="*" element={null} />
      </Route>
    </Routes>
  );
}

/**
 * PAGES VUES · une par changement de route (HashRouter, `#/comptes/…`), le
 * chemin seul, normalisé par lib/telemetrie.ts. Le rôle et le référentiel
 * sont lus au moment de la vue · les mettre en dépendance doublerait la
 * vue à l'arrivée de la session.
 */
function SuiviDesPages() {
  const { pathname } = useLocation();
  const { utilisateur } = useAuth();
  useEffect(() => {
    pageVue(pathname, utilisateur?.role, utilisateur?.tenant.referentiel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <SuiviDesPages />
        <Routage />
      </AuthProvider>
    </HashRouter>
  );
}
