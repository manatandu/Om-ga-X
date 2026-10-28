import { createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cibleDuLien, type CheminPagePublique } from '../lib/lien-page-legale';
import { LienPreferencesMesure } from './BandeauConsentementMesure';

/**
 * LES PAGES PUBLIQUES D'OMEGAX · politique de confidentialité, contrat de
 * licence, questions fréquentes. Atteignables SANS CONNEXION, depuis l'écran
 * d'ouverture (App.tsx, hors de la zone protégée), et dans l'espace de
 * travail par le menu « ? », où la même page s'ouvre en fenêtre.
 *
 * DEUX CADRES, UN CONTENU · la page publique porte son titre (`<h1>`), la
 * fenêtre non · sa barre de titre le porte déjà (CLAUDE.md § 9 ter, « aucun
 * titre de page »). Le contenu est le même composant des deux côtés, sans
 * quoi les deux versions d'un texte opposable finiraient par différer.
 *
 * LE CONTRAT SE CONSERVE ET SE REPRODUIT (Code du numérique, ordonnance-loi
 * n° 23/10 du 13 mars 2023, art. 53, al. 1er · les conditions sont mises à
 * disposition « de manière à permettre leur analyse, leur conservation et
 * leur reproduction ») · d'où le bouton d'impression de la page publique ;
 * dans l'espace de travail, Fichier > Imprimer la fenêtre fait de même.
 */

/** Les trois pages, dans l'ordre du menu « ? » · une seule liste pour l'écran d'ouverture et les pieds de page. */
export const PAGES_PUBLIQUES = [
  { chemin: '/questions-frequentes', libelle: 'Questions fréquentes' },
  { chemin: '/contrat-de-licence', libelle: 'Contrat de licence' },
  { chemin: '/confidentialite', libelle: 'Politique de confidentialité' },
] as const satisfies readonly { chemin: CheminPagePublique; libelle: string }[];

export function CadrePagePublique({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: ReactNode }) {
  const autres = PAGES_PUBLIQUES.filter((p) => p.libelle !== titre && !titre.startsWith(p.libelle));
  return (
    <div className="cadre-public">
      <header className="cadre-public-entete ecran-seul">
        <a href="/vitrine/" aria-label="OmegaX, page d’accueil du site">
          <img src="/logo-omegax-blanc.svg" alt="OmegaX" width="130" height="26" />
        </a>
        <nav aria-label="Pages d’information">
          {autres.map((p) => (
            <a key={p.chemin} href={`#${p.chemin}`}>
              {p.libelle}
            </a>
          ))}
        </nav>
        <a href="#/connexion" className="cadre-public-bouton">
          Se connecter
        </a>
      </header>
      <div className="cadre-public-tete">
        <div className="cadre-public-colonne">
          <h1>{titre}</h1>
          {sousTitre && <p>{sousTitre}</p>}
        </div>
      </div>
      <main className="cadre-public-colonne cadre-public-corps">
        {children}
        <div className="ecran-seul cadre-public-pied-page">
          <a href="#/connexion" className="text-sel underline">
            Retour à l’ouverture du fichier comptable
          </a>
          <LienPreferencesMesure className="text-sel underline" />
          <button type="button" onClick={() => window.print()} className="ml-auto text-sel underline">
            Imprimer
          </button>
        </div>
      </main>
      <footer className="cadre-public-pied ecran-seul">
        <p>© {new Date().getFullYear()} OmegaX</p>
        <nav aria-label="Informations légales">
          {PAGES_PUBLIQUES.map((p) => (
            <a key={p.chemin} href={`#${p.chemin}`}>
              {p.libelle}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

/**
 * Le contenu est-il rendu dans une fenêtre de l'espace de travail ? Posé par
 * `CorpsFenetreLegale`, faux partout ailleurs · la page publique n'a pas
 * d'espace de travail à garder.
 */
const EnFenetreLegale = createContext(false);

/**
 * Un lien d'une page légale vers une autre, qui reste dans l'espace de travail
 * quand il y est (second tour de relecture, M1 · `lib/lien-page-legale.ts`).
 */
export function LienPageLegale({ chemin, children }: { chemin: CheminPagePublique; children: ReactNode }) {
  const enFenetre = useContext(EnFenetreLegale);
  const navigate = useNavigate();
  const cible = cibleDuLien(chemin, enFenetre);
  const route = cible.routeInterne;
  return (
    <a
      href={cible.href}
      onClick={
        route === null
          ? undefined
          : (e) => {
              e.preventDefault();
              navigate(route);
            }
      }
      className="text-sel underline"
    >
      {children}
    </a>
  );
}

/** Le corps d'une page légale dans une fenêtre de l'espace de travail. */
export function CorpsFenetreLegale({ sousTitre, children }: { sousTitre?: string; children: ReactNode }) {
  return (
    <EnFenetreLegale.Provider value={true}>
      <div className="p-3 max-w-[820px]">
        {sousTitre && <p className="text-[11px] text-text-dim mb-3">{sousTitre}</p>}
        {children}
      </div>
    </EnFenetreLegale.Provider>
  );
}
