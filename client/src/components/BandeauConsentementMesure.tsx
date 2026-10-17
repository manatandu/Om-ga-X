import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  bandeauAMontrer,
  enregistrerConsentement,
  EVENEMENT_PREFERENCES_MESURE,
  lireConsentement,
  type ChoixMesure,
} from '../lib/consentement-mesure';
import { demarrerTelemetrieInterface, mesureDisponible, pageVue, telemetrieDemarree } from '../lib/telemetrie';
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
  const [ouvert, setOuvert] = useState(() => bandeauAMontrer(disponible, lireConsentement(() => window.localStorage)));
  const { pathname } = useLocation();
  const { utilisateur } = useAuth();
  const premier = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const rouvrir = () => setOuvert(true);
    window.addEventListener(EVENEMENT_PREFERENCES_MESURE, rouvrir);
    return () => window.removeEventListener(EVENEMENT_PREFERENCES_MESURE, rouvrir);
  }, []);

  useEffect(() => {
    if (ouvert) premier.current?.focus({ preventScroll: true });
  }, [ouvert]);

  if (!ouvert) return null;

  const choisir = (choix: ChoixMesure) => {
    enregistrerConsentement(() => window.localStorage, choix, DATE_DE_MISE_A_JOUR, new Date());
    setOuvert(false);
    if (choix === 'accepte') {
      demarrerTelemetrieInterface();
      // La page en cours n'a pas été comptée · elle l'est maintenant, une fois.
      pageVue(pathname, utilisateur?.role, utilisateur?.tenant.referentiel);
    } else if (telemetrieDemarree()) {
      // Un SDK démarré ne s'arrête sûrement qu'en rechargeant la page.
      window.location.reload();
    }
  };

  const consentement = lireConsentement(() => window.localStorage);
  return (
    <div
      role="region"
      aria-label="Préférences relatives aux témoins"
      className="ecran-seul fixed bottom-0 inset-x-0 z-[60] border-t border-border bg-surface shadow-dominante"
    >
      <div className="mx-auto max-w-[920px] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-[11.5px]">
        <p className="flex-1 leading-relaxed">
          OmegaX peut mesurer la fréquentation de ses écrans, de façon anonyme, et signaler ses erreurs techniques.
          Rien ne part sans votre accord, et vous pouvez changer d’avis à tout moment.{' '}
          <a href="#/confidentialite" target="_blank" rel="noopener" className="text-sel underline">
            Politique de confidentialité
          </a>
          {consentement && (
            <span className="text-text-dim"> · Choix actuel : {consentement.choix === 'accepte' ? 'accepté' : 'refusé'}.</span>
          )}
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            ref={premier}
            type="button"
            onClick={() => choisir('refuse')}
            className="px-4 py-1.5 rounded-full border border-border bg-surface font-semibold hover:bg-[var(--a-50)]"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => choisir('accepte')}
            className="px-4 py-1.5 rounded-full border border-border bg-surface font-semibold hover:bg-[var(--a-50)]"
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
