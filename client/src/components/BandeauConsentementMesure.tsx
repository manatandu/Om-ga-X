import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  bandeauAMontrer,
  CLE_CONSENTEMENT_MESURE,
  enregistrerConsentement,
  EVENEMENT_PREFERENCES_MESURE,
  lireConsentement,
  mesureAutorisee,
  type ChoixMesure,
} from '../lib/consentement-mesure';
import { arreterTelemetrieInterface, demarrerTelemetrieInterface, mesureDisponible, pageVue, telemetrieDemarree } from '../lib/telemetrie';
import { DATE_DE_MISE_A_JOUR } from '../lib/date-politique-confidentialite';

/**
 * LE BANDEAU DE CONSENTEMENT · la question posée avant toute mesure de
 * l'interface (`lib/consentement-mesure.ts`, Code du numérique, art. 192 et
 * 196). Deux boutons de même poids · refuser coûte autant qu'accepter, et
 * rien ne part tant que la personne n'a pas répondu.
 *
 * Il ne se montre que si cette construction porte une clé de mesure, hors
 * installation sur site · sans service de mesure, il n'y a rien à consentir,
 * et la question serait une fausse alerte. « Préférences relatives aux
 * témoins » le rouvre, avec le choix en cours.
 */
export function BandeauConsentementMesure() {
  const disponible = mesureDisponible();
  const [ouvert, setOuvert] = useState(() => bandeauAMontrer(disponible, lireConsentement(() => window.localStorage), DATE_DE_MISE_A_JOUR));
  const { pathname } = useLocation();
  const { utilisateur } = useAuth();
  const premier = useRef<HTMLButtonElement>(null);
  const hauteur = useRef<HTMLDivElement>(null);
  // Le focus ne va au bandeau que s'il est ROUVERT par les préférences · à
  // l'ouverture de l'écran, il volerait le champ de courriel, et une touche
  // Espace ou Entrée refuserait à l'insu de la personne (relecture, M1).
  const rouvertParPreference = useRef(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const rouvrir = () => {
      rouvertParPreference.current = true;
      setErreur(null);
      setOuvert(true);
    };
    // Un choix fait dans un autre onglet (les textes s'ouvrent dans un nouvel
    // onglet) ferme ce bandeau ; un retrait y arrête les SDK de celui-ci.
    const autreOnglet = (e: StorageEvent) => {
      if (e.key !== CLE_CONSENTEMENT_MESURE) return;
      const c = lireConsentement(() => window.localStorage);
      if (c && c.politique === DATE_DE_MISE_A_JOUR) setOuvert(false);
      if (mesureAutorisee(c, DATE_DE_MISE_A_JOUR)) demarrerTelemetrieInterface('accord');
      else if (telemetrieDemarree()) arreterTelemetrieInterface();
    };
    window.addEventListener(EVENEMENT_PREFERENCES_MESURE, rouvrir);
    window.addEventListener('storage', autreOnglet);
    return () => {
      window.removeEventListener(EVENEMENT_PREFERENCES_MESURE, rouvrir);
      window.removeEventListener('storage', autreOnglet);
    };
  }, []);

  useEffect(() => {
    if (ouvert && rouvertParPreference.current) premier.current?.focus({ preventScroll: true });
    rouvertParPreference.current = false;
  }, [ouvert]);

  // Le bandeau ne recouvre pas le bas de la page (bouton de connexion, liens,
  // barre des fenêtres) · la page gagne sa hauteur en marge basse tant qu'il
  // est ouvert (relecture, m5).
  useEffect(() => {
    if (!ouvert || !hauteur.current) return;
    const avant = document.body.style.paddingBottom;
    const poser = () => {
      if (hauteur.current) document.body.style.paddingBottom = `${hauteur.current.offsetHeight}px`;
    };
    poser();
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(poser);
    obs?.observe(hauteur.current);
    return () => {
      obs?.disconnect();
      document.body.style.paddingBottom = avant;
    };
  }, [ouvert]);

  if (!ouvert) return null;

  const choisir = (choix: ChoixMesure) => {
    const dejaDemarree = telemetrieDemarree();
    const enregistre = enregistrerConsentement(() => window.localStorage, choix, DATE_DE_MISE_A_JOUR, new Date());
    if (choix === 'refuse') {
      // Le refus vaut AUSSITÔT, écrit ou non · les SDK s'arrêtent sur place.
      arreterTelemetrieInterface();
    } else {
      demarrerTelemetrieInterface(enregistre ? 'accord' : 'accordNonEnregistre');
      // La page en cours n'a pas été comptée · elle l'est maintenant, une fois
      // (pas une seconde fois quand on réaccepte, relecture, m3).
      if (!dejaDemarree && telemetrieDemarree()) pageVue(pathname, utilisateur?.role, utilisateur?.tenant.referentiel);
    }
    if (!enregistre) {
      // Le choix n'a pas pu s'écrire · il ne vaut que pour cette page, et le
      // dire vaut mieux qu'un bandeau qui revient sans explication.
      setErreur('Votre choix n’a pas pu être enregistré sur cet appareil · il vaut pour cette page seulement.');
      return;
    }
    setOuvert(false);
  };

  const consentement = lireConsentement(() => window.localStorage);
  return (
    <div
      ref={hauteur}
      role="region"
      aria-label="Préférences relatives aux témoins"
      className="ecran-seul fixed bottom-0 inset-x-0 z-60 border-t border-border bg-surface shadow-dominante"
    >
      <div className="mx-auto max-w-[920px] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-[11.5px]">
        <p className="flex-1 leading-relaxed">
          OmegaX peut mesurer la fréquentation de ses écrans et signaler ses erreurs techniques, sans votre nom ni le contenu de vos dossiers.
          Rien ne part sans votre accord, et vous pouvez changer d’avis à tout moment.{' '}
          <a href="#/confidentialite" target="_blank" rel="noopener" className="text-sel underline">
            Politique de confidentialité
          </a>
          {erreur && (
            <span role="alert" className="block text-danger mt-1">
              {erreur}
            </span>
          )}
          {consentement && (
            <span className="text-text-dim"> · Choix actuel : {consentement.choix === 'accepte' ? 'accepté' : 'refusé'}.</span>
          )}
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            ref={premier}
            type="button"
            onClick={() => choisir('refuse')}
            className="px-4 py-1.5 rounded-full border border-border bg-surface font-semibold hover:bg-(--a-50)"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => choisir('accepte')}
            className="px-4 py-1.5 rounded-full border border-border bg-surface font-semibold hover:bg-(--a-50)"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}

/** Le lien qui rouvre le bandeau · absent quand cette construction ne mesure rien. */
export function LienPreferencesMesure({ className = 'underline' }: { className?: string }) {
  if (!mesureDisponible()) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(EVENEMENT_PREFERENCES_MESURE))} className={className}>
      Préférences relatives aux témoins
    </button>
  );
}
