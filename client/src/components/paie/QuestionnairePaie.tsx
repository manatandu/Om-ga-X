import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Aide } from '../chrome/Aide';
import { CHAMP_PAIE, ModalePaie } from './ModalePaie';
import {
  ecrituresDuQuestionnaire,
  motifReponse,
  QUESTIONS_PAIE,
  REPONSES_VIDES,
  type CleQuestion,
  type QuestionPaie,
  type ReponsesPaie,
} from '../../lib/questionnaire-paie';

/** Les champs de la simulation que le questionnaire lit et écrit · ceux qui existent déjà. */
export type ChampsSimulationQuestionnaire = Pick<
  ReponsesPaie,
  'natureInpp' | 'effectifInpp' | 'regimeSalarial' | 'classePro' | 'personnesACharge' | 'enfantsAllocations'
>;

interface Lu {
  dossier: { effectifPermanent: number; numeroAffiliationCnssEmployeur: string | null };
  salarie: null | {
    id: string;
    nomComplet: string;
    modePaiement: string | null;
    contrat: null | { id: string; classeProfessionnelle: number | null; deviseRemuneration: string | null };
  };
}

const OU: Record<QuestionPaie['cible'], string> = {
  DOSSIER: 'Paramètres du dossier',
  SALARIE: 'Fiche du salarié',
  CONTRAT: 'Contrat du salarié',
  SIMULATION: 'Simulation du mois',
};

/**
 * LIGNE SAGE-L5, FONCTION 85 · LE QUESTIONNAIRE SOCIÉTÉ ET SALARIÉ, en
 * assistant · une question par page, puis le récapitulatif de ce qui s'écrira
 * et où (`lib/questionnaire-paie.ts`). Chaque écriture passe par sa route, avec
 * ses droits · les paramètres du dossier par l'administrateur, la fiche et le
 * contrat par qui tient le registre ; la simulation reçoit ses champs.
 */
export function QuestionnairePaie(p: {
  salarieId: string | null;
  mois: string;
  simulation: ChampsSimulationQuestionnaire;
  onSimulation: (valeurs: Partial<ChampsSimulationQuestionnaire>) => void;
  onFermer: () => void;
}) {
  const { estAdmin, peutEcrire } = useAuth();
  const [lu, setLu] = useState<Lu | null>(null);
  const [effectifRegistre, setEffectifRegistre] = useState<number | null>(null);
  const [erreurLecture, setErreurLecture] = useState('');
  const [reponses, setReponses] = useState<ReponsesPaie>(REPONSES_VIDES);
  const [page, setPage] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [compteRendu, setCompteRendu] = useState<{ ok: string[]; refus: string[] } | null>(null);
  const jeton = useRef(0);
  const { salarieId, mois } = p;
  // La simulation est lue À L'OUVERTURE · la relire ensuite écraserait les réponses en cours.
  const simulation = useRef(p.simulation).current;

  useEffect(() => {
    const moi = ++jeton.current;
    const parametres = new URLSearchParams({ ...(salarieId ? { salarieId } : {}), ...(mois ? { mois } : {}) }).toString();
    Promise.all([
      api.get<Lu>(`/personnel/questionnaire-paie${parametres ? `?${parametres}` : ''}`),
      // La proposition du registre · un échec la tait, il ne bloque pas le questionnaire.
      api.get<{ effectif: number }>('/personnel/effectif').then(
        (e) => e.effectif,
        () => null,
      ),
    ]).then(
      ([l, eff]) => {
        if (moi !== jeton.current) return;
        setLu(l);
        setEffectifRegistre(eff);
        setReponses({
          ...REPONSES_VIDES,
          ...simulation,
          effectifPermanent: String(l.dossier.effectifPermanent),
          numeroAffiliationCnssEmployeur: l.dossier.numeroAffiliationCnssEmployeur ?? '',
          modePaiement: l.salarie?.modePaiement ?? '',
          deviseRemuneration: l.salarie?.contrat?.deviseRemuneration ?? '',
        });
      },
      (e: ApiError) => {
        if (moi === jeton.current) setErreurLecture(e.message);
      },
    );
  }, [salarieId, mois, simulation]);

  const initial: ReponsesPaie | null = useMemo(
    () =>
      lu && {
        ...REPONSES_VIDES,
        ...simulation,
        effectifPermanent: String(lu.dossier.effectifPermanent),
        numeroAffiliationCnssEmployeur: lu.dossier.numeroAffiliationCnssEmployeur ?? '',
        modePaiement: lu.salarie?.modePaiement ?? '',
        deviseRemuneration: lu.salarie?.contrat?.deviseRemuneration ?? '',
      },
    [lu, simulation],
  );

  // Les questions du salarié ne se posent que pour un salarié choisi.
  const questions = QUESTIONS_PAIE.filter((q) => q.partie === 'SOCIETE' || !!lu?.salarie);
  const modifiable = (q: QuestionPaie): string | null => {
    if (q.cible === 'DOSSIER' && !estAdmin) return "Réponse de l'administrateur, dans les paramètres du dossier.";
    if ((q.cible === 'SALARIE' || q.cible === 'CONTRAT') && !peutEcrire) return 'Lecture seule.';
    if (q.cle === 'deviseRemuneration') {
      if (!lu?.salarie?.contrat) return 'Aucun contrat ne couvre ce mois · la monnaie se déclare avec le contrat, au registre.';
      if (lu.salarie.contrat.deviseRemuneration) return 'Déjà déclarée · elle ne se change plus.';
    }
    return null;
  };
  const surLeRecapitulatif = page >= questions.length;
  const q = surLeRecapitulatif ? null : questions[page];
  const motif = q ? motifReponse(q, reponses[q.cle]) : null;
  const ecritures = initial ? ecrituresDuQuestionnaire(initial, reponses, questions) : null;

  const poser = (cle: CleQuestion, valeur: string) => setReponses((r) => ({ ...r, [cle]: valeur }));

  const enregistrer = async () => {
    if (!ecritures || !lu) return;
    setEnvoi(true);
    const ok: string[] = [];
    const refus: string[] = [];
    // Chaque écriture par sa route · un refus n'emporte pas les autres, et se dit.
    const geste = async (nom: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        ok.push(nom);
      } catch (e) {
        refus.push(`${nom} · ${e instanceof ApiError ? e.message : 'refusé'}`);
      }
    };
    if (ecritures.dossier) await geste('Paramètres du dossier', () => api.patch('/dossier/regime', ecritures.dossier));
    if (ecritures.modePaiement && lu.salarie) {
      const id = lu.salarie.id;
      await geste('Mode de paiement', () => api.post(`/personnel/salaries/${id}/mode-paiement`, { modePaiement: ecritures.modePaiement }));
    }
    if (ecritures.deviseRemuneration && lu.salarie?.contrat) {
      const id = lu.salarie.contrat.id;
      await geste('Monnaie du contrat', () =>
        api.post(`/personnel/contrats/${id}/devise-remuneration`, { deviseRemuneration: ecritures.deviseRemuneration }),
      );
    }
    if (Object.keys(ecritures.simulation).length > 0) {
      p.onSimulation(ecritures.simulation);
      ok.push('Simulation du mois');
    }
    setEnvoi(false);
    setCompteRendu({ ok, refus });
  };

  const suivant = () => {
    if (motif) return;
    if (surLeRecapitulatif) void enregistrer();
    else setPage((n) => n + 1);
  };

  const affiche = (question: QuestionPaie, valeur: string) =>
    valeur.trim() === '' ? 'Pas encore dit' : (question.choix?.find((c) => c.valeur === valeur)?.libelle ?? valeur);

  return (
    <ModalePaie
      titre="Questionnaire de paie"
      envoi={envoi}
      erreur={erreurLecture || null}
      onFermer={p.onFermer}
      onValider={suivant}
      pied={
        compteRendu ? (
          <button type="button" className="border border-border px-3 py-1" onClick={p.onFermer}>
            Fermer
          </button>
        ) : (
          <>
            <button type="button" className="border border-border px-3 py-1" disabled={envoi} onClick={p.onFermer}>
              Fermer
            </button>
            <button type="button" className="border border-border px-3 py-1" disabled={envoi || page === 0} onClick={() => setPage((n) => n - 1)}>
              Précédent
            </button>
            <button type="submit" className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-50" disabled={envoi || !lu || !!motif}>
              {surLeRecapitulatif ? (envoi ? 'Envoi…' : 'Enregistrer les réponses') : 'Suivant'}
            </button>
          </>
        )
      }
    >
      {!lu && !erreurLecture && <div className="text-text-dim">Chargement…</div>}
      {lu && !lu.salarie && page === 0 && (
        <div className="text-text-dim">Choisissez le salarié dans la simulation pour répondre aussi aux questions qui le concernent.</div>
      )}
      {lu && q && (
        <>
          <div className="text-text-dim">
            {q.partie === 'SOCIETE' ? 'Société' : `Salarié · ${lu.salarie?.nomComplet ?? ''}`} · question {page + 1} sur {questions.length}
          </div>
          <div className="font-semibold flex items-center gap-1.5">
            {q.libelle}
            <Aide titre={q.libelle} texte={q.aide} source={q.source} />
          </div>
          <div className="text-text-dim">
            Dit aujourd'hui · {affiche(q, initial ? initial[q.cle] : '')} · s'écrit dans · {OU[q.cible]}
          </div>
          {modifiable(q) ? (
            <div className="text-text-dim">{modifiable(q)}</div>
          ) : q.choix ? (
            <select aria-label={q.libelle} value={reponses[q.cle]} onChange={(e) => poser(q.cle, e.target.value)} className={CHAMP_PAIE}>
              <option value="">Pas encore dit</option>
              {q.choix.map((c) => (
                <option key={c.valeur} value={c.valeur}>
                  {c.libelle}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={q.libelle}
              value={reponses[q.cle]}
              onChange={(e) => poser(q.cle, e.target.value)}
              placeholder="Pas encore dit"
              inputMode={q.saisie === 'ENTIER' ? 'numeric' : undefined}
              className={CHAMP_PAIE}
            />
          )}
          {motif && (
            <div role="alert" className="text-danger">
              {motif}
            </div>
          )}
          {/* Les PROPOSITIONS · écrites au seul clic, jamais d'office. */}
          {q.cle === 'effectifInpp' && (
            <div className="flex flex-wrap gap-2">
              {effectifRegistre !== null && effectifRegistre > 0 && (
                <button type="button" className="border border-border px-2.5 py-1" onClick={() => poser('effectifInpp', String(effectifRegistre))}>
                  Reprendre l'effectif du registre ({effectifRegistre})
                </button>
              )}
              {lu.dossier.effectifPermanent > 0 && (
                <button
                  type="button"
                  className="border border-border px-2.5 py-1"
                  onClick={() => poser('effectifInpp', String(lu.dossier.effectifPermanent))}
                >
                  Reprendre l'effectif permanent du dossier ({lu.dossier.effectifPermanent})
                </button>
              )}
            </div>
          )}
          {q.cle === 'classePro' && lu.salarie?.contrat?.classeProfessionnelle && (
            <button
              type="button"
              className="border border-border px-2.5 py-1 self-start"
              onClick={() => poser('classePro', String(lu.salarie!.contrat!.classeProfessionnelle))}
            >
              Reprendre la classe du contrat ({lu.salarie.contrat.classeProfessionnelle})
            </button>
          )}
        </>
      )}
      {lu && surLeRecapitulatif && ecritures && !compteRendu && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Question</th>
                <th className="text-left px-2 py-1">Réponse</th>
                <th className="text-left px-2 py-1">Écriture</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((x) => {
                const change = initial && initial[x.cle].trim() !== reponses[x.cle].trim();
                const gardee = ecritures.gardees.includes(x.cle);
                return (
                  <tr key={x.cle}>
                    <td className="px-2 py-1">{x.libelle}</td>
                    <td className="px-2 py-1">{affiche(x, gardee && initial ? initial[x.cle] : reponses[x.cle])}</td>
                    <td className="px-2 py-1">{gardee ? 'Gardée · une valeur enregistrée ne s’efface pas ici' : change ? OU[x.cible] : 'Inchangée'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {compteRendu && (
        <div className="flex flex-col gap-1">
          {compteRendu.ok.length > 0 && <div>Écrit · {compteRendu.ok.join(', ')}.</div>}
          {compteRendu.ok.length === 0 && compteRendu.refus.length === 0 && <div>Rien n'a changé · aucune écriture.</div>}
          {compteRendu.refus.map((r) => (
            <div key={r} role="alert" className="text-danger">
              {r}
            </div>
          ))}
        </div>
      )}
    </ModalePaie>
  );
}
