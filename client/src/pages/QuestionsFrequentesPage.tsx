import { useEffect, useMemo, useState } from 'react';
import { CadrePagePublique, CorpsFenetreLegale } from '../components/CadrePagePublique';
import { QUESTIONS_FREQUENTES } from '../lib/questions-frequentes';

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

/** Les accents et la casse ne comptent pas · « echeance » trouve « échéance ». */
function normaliser(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function ContenuQuestionsFrequentes() {
  const [recherche, setRecherche] = useState('');
  const rubriques = useMemo(() => {
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
    if (mots.length === 0) return QUESTIONS_FREQUENTES;
    return QUESTIONS_FREQUENTES.map((r) => ({
      ...r,
      questions: r.questions.filter((q) => {
        const texte = normaliser(`${q.question} ${q.reponse.join(' ')}`);
        return mots.every((m) => texte.includes(m));
      }),
    })).filter((r) => r.questions.length > 0);
  }, [recherche]);
  // Une réponse repliée ne s'imprime pas · à l'impression, tout s'ouvre.
  const [impression, setImpression] = useState(false);
  useEffect(() => {
    const avant = () => setImpression(true);
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
      {rubriques.length === 0 && <p className="text-text-dim">Aucune question ne contient ces mots.</p>}
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
