import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { CadrePagePublique, CorpsFenetreLegale } from '../components/CadrePagePublique';
import { filtrerQuestions, QUESTIONS_FREQUENTES } from '../lib/questions-frequentes';

/**
 * QUESTIONS FRÉQUENTES · les questions et leurs réponses vivent dans
 * `lib/questions-frequentes.ts`, où chaque réponse est confrontée au code.
 * La page les range par thème, comme la documentation d'Odoo et la FAQ de
 * Firefly III, avec un champ qui filtre les questions · les centres d'aide
 * des logiciels de gestion s'ouvrent sur une recherche.
 *
 * PUBLIQUE, comme la politique de confidentialité et le contrat · un visiteur
 * doit pouvoir lire « comment obtenir un accès » avant d'en avoir un.
 */

export function ContenuQuestionsFrequentes() {
  const [recherche, setRecherche] = useState('');
  // Accents, casse, apostrophes, traits d'union et ponctuation ne comptent
  // pas, et le titre de la rubrique se cherche aussi (second tour, M2).
  const rubriques = useMemo(() => filtrerQuestions(QUESTIONS_FREQUENTES, recherche), [recherche]);
  // Une réponse repliée ne s'imprime pas · à l'impression, tout s'ouvre. Le
  // rendu est forcé AVANT que le navigateur ne fige la page à imprimer
  // (second tour, mineur 1) · un état posé sans `flushSync` arrivait après
  // l'aperçu, et la FAQ s'imprimait repliée.
  const [impression, setImpression] = useState(false);
  useEffect(() => {
    const avant = () => flushSync(() => setImpression(true));
    const apres = () => setImpression(false);
    window.addEventListener('beforeprint', avant);
    window.addEventListener('afterprint', apres);
    return () => {
      window.removeEventListener('beforeprint', avant);
      window.removeEventListener('afterprint', apres);
    };
  }, []);
  const filtre = recherche.trim().length > 0 || impression;

  return (
    <div className="text-[11.5px] leading-relaxed">
      <div className="ecran-seul mb-3">
        <label className="flex items-center gap-2">
          <span className="text-text-dim">Rechercher</span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="flex-1 min-w-0 border border-border bg-surface px-2 py-1 text-[11.5px]"
          />
        </label>
      </div>
      {/* Région annoncée (second tour, mineur 7) · présente d'emblée, sans quoi un lecteur d'écran ne dit pas le résultat vide. */}
      <div role="status">{rubriques.length === 0 && <p className="text-text-dim">Aucune question ne contient ces mots.</p>}</div>
      {rubriques.map((r) => (
        <section key={r.id} id={`rubrique-${r.id}`} className="mb-3">
          <h2 className="text-[12px] font-bold mt-3 mb-1.5">{r.titre}</h2>
          {r.questions.map((q) => (
            <details key={q.id} id={q.id} open={filtre} className="border-b border-border py-1.5 eviter-coupure">
              <summary className="cursor-pointer font-semibold">{q.question}</summary>
              <div className="mt-1 pl-3">
                {q.reponse.map((p, i) => (
                  <p key={i} className="mb-1.5">
                    {p}
                  </p>
                ))}
              </div>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}

/** La page publique, hors de la zone protégée. */
export function QuestionsFrequentesPage() {
  return (
    <CadrePagePublique titre="Questions fréquentes sur OmegaX">
      <ContenuQuestionsFrequentes />
    </CadrePagePublique>
  );
}

/** La fenêtre du menu « ? ». */
export function QuestionsFrequentesFenetre() {
  return (
    <CorpsFenetreLegale>
      <ContenuQuestionsFrequentes />
    </CorpsFenetreLegale>
  );
}
