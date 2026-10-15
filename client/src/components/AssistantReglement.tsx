import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PortailModale } from './PortailModale';
import { Aide } from './chrome/Aide';
import { ecouterEchap } from '../lib/echap';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { jourFr } from '../lib/jour-fr';
import { montantPourChamp } from '../lib/creances-douteuses';
import { lireMontant } from '../lib/assistant-bien';
import { journalProposeParLeMode, libelleMode, type ModeReglement } from '../lib/modes-reglement';
import type { Journal } from '../lib/types';
import {
  corpsReglement,
  duDesFactures,
  ETAPES_REGLEMENT,
  manqueDeLEtape,
  nomDuTiers,
  saisieEnchainee,
  saisieVierge,
  type EtapeReglement,
  type SaisieReglement,
  type TiersARegler,
} from '../lib/assistant-reglement';

const etiquette = 'text-[11.5px] font-semibold text-text-dim';
const champ = 'mt-1 w-full border border-border-dark px-2.5 py-1.5 text-[12px] font-normal';

interface ReponseReglement {
  reglements: { compte: string; montant: number; partiel: boolean; lettre: string }[];
  ordre: { id: string; numero: number } | null;
  avertissements?: string[];
}

/**
 * L'ASSISTANT DE RÈGLEMENT (ligne sage-l2, fonction n° 18, part règlement) ·
 * six étapes sur le corps du formulaire Règlement des tiers
 * (`lib/assistant-reglement.ts`), envoyé à `POST /reglements` · aucune route
 * ni règle à lui. Le refus du serveur se dit au récapitulatif, d'où chaque
 * étape se rouvre ; ses avertissements (art. 59 bis, imputation légale) se
 * disent une fois le règlement passé.
 */
export function AssistantReglement({
  journaux,
  modes,
  exerciceId,
  finExercice,
  ordresServis,
  onFermer,
  onRegle,
}: {
  journaux: Journal[];
  modes: ModeReglement[] | null;
  exerciceId: string;
  finExercice: string;
  ordresServis: boolean;
  onFermer: () => void;
  onRegle: (message: string) => void;
}) {
  const { peutEcrire } = useAuth();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [s, setS] = useState<SaisieReglement>(() => ({ ...saisieVierge(aujourdhui), journalId: journaux.length === 1 ? journaux[0].id : '' }));
  const [etape, setEtape] = useState<EtapeReglement>('sens');
  const [tiers, setTiers] = useState<TiersARegler[] | null>(null);
  // Un échec de lecture n'est pas une liste vide · « rien à régler » serait la
  // réponse favorable à une question que l'écran n'a pas pu poser.
  const [echecTiers, setEchecTiers] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [regle, setRegle] = useState<{ texte: string; avertissements: string[] } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Relire les factures ouvertes · après un règlement, celles du tiers réglé ont changé.
  const [relecture, setRelecture] = useState(0);
  const fermer = useRef<HTMLButtonElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const reglerBouton = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoi) onFermer();
        return true;
      }),
    [onFermer, envoi],
  );
  // LE FOCUS SUIT L'ÉTAPE, comme dans l'assistant de création d'un bien.
  useEffect(() => {
    const cible =
      etape === 'recapitulatif' && !regle
        ? reglerBouton.current
        : corps.current?.querySelector<HTMLElement>(
            regle ? 'button[data-enchainer]' : 'input[type=radio]:checked, input:not([disabled]):not([type=radio]), select:not([disabled])',
          );
    (cible ?? fermer.current)?.focus({ preventScroll: true });
  }, [etape, regle]);

  // Les factures ouvertes du sens, jusqu'à la fin de l'exercice · la liste du
  // formulaire. Une réponse périmée (sens changé entre-temps) est jetée.
  useEffect(() => {
    let vivant = true;
    setTiers(null);
    setEchecTiers(null);
    api.get<TiersARegler[]>(`/reglements/echeances?exerciceId=${exerciceId}&sens=${s.sens}&jusquau=${finExercice}`).then(
      (g) => {
        if (!vivant) return;
        const aRegler = g.filter((x) => x.lignes.length > 0);
        setTiers(aRegler);
        if (aRegler.length === 1) setS((x) => (x.compteId ? x : { ...x, compteId: aRegler[0].compteId }));
      },
      (e: Error) => {
        if (vivant) setEchecTiers(e instanceof ApiError ? e.message : 'Les factures ouvertes n’ont pas pu être lues.');
      },
    );
    return () => {
      vivant = false;
    };
  }, [exerciceId, finExercice, s.sens, relecture]);

  const poser = <K extends keyof SaisieReglement>(cle: K, valeur: SaisieReglement[K]) => setS((x) => ({ ...x, [cle]: valeur }));
  const choisi = (tiers ?? []).find((t) => t.compteId === s.compteId) ?? null;
  const du = duDesFactures(choisi, s.ligneIds);
  const rang = Math.max(0, ETAPES_REGLEMENT.findIndex((e) => e.cle === etape));
  const manque = manqueDeLEtape(etape, s, choisi);
  const journal = journaux.find((j) => j.id === s.journalId) ?? null;
  const mode = (modes ?? []).find((m) => m.id === s.modeReglementId) ?? null;
  const allerA = (suivante: EtapeReglement) => {
    // Le montant se préremplit au dû des factures choisies · vide, jamais zéro.
    if (suivante === 'montant' && !s.montant.trim()) poser('montant', montantPourChamp(du));
    setEtape(suivante);
  };
  const avancer = () => {
    if (!manque && etape !== 'recapitulatif') allerA(ETAPES_REGLEMENT[rang + 1].cle);
  };
  // ENTRÉE AVANCE sur un champ ; un bouton garde son Entrée, et le
  // récapitulatif ne règle qu'au bouton.
  const surTouche = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    const balise = (e.target as HTMLElement).tagName;
    if (balise !== 'INPUT' && balise !== 'SELECT') return;
    e.preventDefault();
    avancer();
  };

  const regler = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<ReponseReglement>('/reglements', corpsReglement(s, exerciceId, ordresServis));
      const passe = r.reglements[0];
      const texte =
        `Règlement de ${montant(passe?.montant ?? lireMontant(s.montant))} passé au brouillard et lettré` +
        (passe?.partiel ? ' (partiel, lettrage partiel)' : '') +
        (r.ordre ? ` · ordre de virement n° ${r.ordre.numero} préparé, en attente d'impression.` : '.');
      setRegle({ texte, avertissements: r.avertissements ?? [] });
      onRegle(`${choisi ? nomDuTiers(choisi) : 'Tiers'} · ${texte}`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Le règlement n’a pas pu être passé.');
    } finally {
      setEnvoi(false);
    }
  };

  const recap: [string, string][] = [
    ['Sens', s.sens === 'FOURNISSEUR' ? 'Fournisseur à payer' : 'Client ou adhérent à encaisser'],
    ['Date', s.date ? jourFr(s.date) : '·'],
    ['Journal', journal ? `${journal.code} · ${journal.intitule}` : '·'],
    ['Mode de règlement', mode ? libelleMode(mode) : 'Non précisé'],
    ...(s.sens === 'FOURNISSEUR' && ordresServis ? ([['Ordre de virement', s.ordreVirement ? 'Préparé' : 'Non']] as [string, string][]) : []),
    ['Tiers', choisi ? nomDuTiers(choisi) : '·'],
    ['Factures', `${s.ligneIds.length} · dû ${montant(du)}`],
    ['Montant réglé', montant(lireMontant(s.montant))],
    ['Référence', s.reference.trim() || '·'],
  ];

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={() => !envoi && onFermer()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Assistant de règlement"
          className="anim-modale w-[680px] max-w-full max-h-full overflow-auto rounded-[4px] bg-surface border border-border-dark shadow-dominante"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3.5 h-[32px] bg-surface text-text border-b border-border">
            <span className="text-[11.5px] font-semibold flex items-center gap-1.5">
              Assistant de règlement
              <Aide
                titre="Assistant de règlement"
                texte="Le règlement d'un tiers, une étape à la fois · le même règlement que le formulaire, les mêmes contrôles, une pièce au journal de trésorerie, la facture lettrée aussitôt. Un tiers à la fois et en francs · une facture en devise, les parts déclarées de chaque facture, l'escompte, l'écart de règlement et les lots de virements se règlent par le formulaire complet. « Régler un autre tiers » repart de l'étape du tiers en gardant sens, date, journal, mode et ordre de virement."
                source="Définition d’OmegaX (Sage, mode assistant)"
              />
            </span>
            <button
              ref={fermer}
              type="button"
              aria-label="Fermer"
              onClick={() => !envoi && onFermer()}
              className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-danger text-[12px]"
            >
              ✕
            </button>
          </div>
          <ol className="flex flex-wrap gap-1 px-3.5 pt-2 text-[11px]" aria-label="Étapes">
            {ETAPES_REGLEMENT.map((e, i) => (
              <li key={e.cle}>
                <button
                  type="button"
                  aria-current={e.cle === etape ? 'step' : undefined}
                  // On revient sur une étape franchie, on n'en saute aucune.
                  disabled={i > rang || !!regle}
                  onClick={() => setEtape(e.cle)}
                  className={`px-2 py-[2px] rounded-[3px] border ${e.cle === etape ? 'bg-sel text-white border-sel' : 'border-border'} disabled:opacity-50`}
                >
                  {i + 1}. {e.libelle}
                </button>
              </li>
            ))}
          </ol>

          <div ref={corps} className="p-3.5 text-[11.5px]" onKeyDown={surTouche}>
            {regle ? (
              <div>
                <div className="text-positive mb-2">{regle.texte}</div>
                {regle.avertissements.map((a) => (
                  <div key={a} className="text-warning mb-1">
                    {a}
                  </div>
                ))}
                <div className="flex gap-2 justify-end mt-3">
                  <button type="button" onClick={onFermer} className="px-3 py-[3px] border border-border-dark rounded-[3px]">
                    Terminer
                  </button>
                  <button
                    type="button"
                    data-enchainer
                    onClick={() => {
                      setS((x) => saisieEnchainee(x));
                      setRegle(null);
                      setErreur(null);
                      setEtape('tiers');
                      // Les factures du tiers réglé ont changé · la liste se relit.
                      setRelecture((n) => n + 1);
                    }}
                    className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold"
                  >
                    Régler un autre tiers
                  </button>
                </div>
              </div>
            ) : (
              <>
                {etape === 'sens' && (
                  <fieldset className="grid gap-2">
                    <legend className={etiquette}>Sens du règlement</legend>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="sens"
                        checked={s.sens === 'FOURNISSEUR'}
                        onChange={() => setS((x) => ({ ...saisieEnchainee(x), sens: 'FOURNISSEUR' }))}
                      />
                      Fournisseur à payer
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="sens"
                        checked={s.sens === 'CLIENT'}
                        onChange={() => setS((x) => ({ ...saisieEnchainee(x), sens: 'CLIENT', ordreVirement: false }))}
                      />
                      Client ou adhérent à encaisser
                    </label>
                  </fieldset>
                )}
                {etape === 'tresorerie' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={etiquette}>
                      Date du règlement
                      <input type="date" value={s.date} max={finExercice} onChange={(e) => poser('date', e.target.value)} className={champ} />
                    </label>
                    <label className={etiquette}>
                      Journal de trésorerie
                      <select value={s.journalId} onChange={(e) => poser('journalId', e.target.value)} className={champ}>
                        <option value="">Choisir…</option>
                        {journaux.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.code} · {j.intitule}
                          </option>
                        ))}
                      </select>
                      {journaux.length === 0 && <span className="block font-normal text-warning">Aucun journal de trésorerie actif avec son compte · créez-le dans Codes journaux.</span>}
                    </label>
                    <label className={etiquette}>
                      Mode de règlement
                      <select
                        value={s.modeReglementId}
                        onChange={(e) => {
                          const id = e.target.value;
                          // Le journal que le mode propose se présélectionne, s'il est offert.
                          const propose = journalProposeParLeMode(modes?.find((m) => m.id === id), journaux);
                          setS((x) => ({ ...x, modeReglementId: id, ...(propose ? { journalId: propose } : {}) }));
                        }}
                        className={champ}
                      >
                        <option value="">Non précisé</option>
                        {(modes ?? []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {libelleMode(m)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {s.sens === 'FOURNISSEUR' && ordresServis && (
                      <label className={`${etiquette} flex items-center gap-1.5 self-end pb-1.5`}>
                        <input type="checkbox" checked={s.ordreVirement} onChange={(e) => poser('ordreVirement', e.target.checked)} />
                        Préparer un ordre de virement
                      </label>
                    )}
                  </div>
                )}
                {etape === 'tiers' && (
                  <label className={etiquette}>
                    Tiers à régler
                    <select value={s.compteId} onChange={(e) => setS((x) => ({ ...x, compteId: e.target.value, ligneIds: [], montant: '' }))} className={champ}>
                      <option value="">Choisir…</option>
                      {(tiers ?? []).map((t) => (
                        <option key={t.compteId} value={t.compteId}>
                          {nomDuTiers(t)} · {t.lignes.length} facture{t.lignes.length > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                    {tiers === null && !echecTiers && <span className="block font-normal text-text-dim">Chargement…</span>}
                    {echecTiers && <span className="block font-normal text-danger">{echecTiers}</span>}
                    {tiers !== null && tiers.length === 0 && (
                      <span className="block font-normal text-text-dim">
                        Aucune facture ouverte {s.sens === 'FOURNISSEUR' ? 'chez un fournisseur' : 'chez un client ou un adhérent'} sur cet exercice.
                      </span>
                    )}
                  </label>
                )}
                {etape === 'factures' && choisi && (
                  <fieldset className="grid gap-1">
                    <legend className={etiquette}>Factures de {nomDuTiers(choisi)}</legend>
                    {choisi.lignes.map((l) => (
                      <label key={l.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Facture ${l.libelle}`}
                          checked={s.ligneIds.includes(l.id)}
                          onChange={(e) =>
                            setS((x) => ({
                              ...x,
                              ligneIds: e.target.checked ? [...x.ligneIds, l.id] : x.ligneIds.filter((id) => id !== l.id),
                              // Le choix change le dû · le montant se repréremplit à l'étape suivante.
                              montant: '',
                            }))
                          }
                        />
                        <span className="w-[80px]">{jourFr(l.echeance)}</span>
                        <span className="flex-1 truncate">{l.libelle}</span>
                        <span>
                          {montant(l.montant)}
                          {l.deviseCode ? ` (${l.deviseCode})` : ''}
                        </span>
                      </label>
                    ))}
                    <div className="text-right font-semibold">Dû · {montant(du)}</div>
                  </fieldset>
                )}
                {etape === 'montant' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={etiquette}>
                      Montant réglé
                      <input inputMode="decimal" value={s.montant} onChange={(e) => poser('montant', e.target.value)} className={champ} />
                      <span className="block font-normal text-text-dim">Dû · {montant(du)}</span>
                    </label>
                    <label className={etiquette}>
                      Référence
                      <input value={s.reference} maxLength={60} onChange={(e) => poser('reference', e.target.value)} className={champ} />
                    </label>
                  </div>
                )}
                {etape === 'recapitulatif' && (
                  <table className="w-full">
                    <tbody>
                      {recap.map(([libelle, valeur]) => (
                        <tr key={libelle}>
                          <td className="py-[2px] text-text-dim w-[40%]">{libelle}</td>
                          <td className="py-[2px]">{valeur}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {manque && <div className="mt-2 text-text-dim">{manque}</div>}
                {erreur && <div role="alert" className="mt-2 text-danger">{erreur}</div>}
                <div className="mt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    disabled={rang === 0 || envoi}
                    onClick={() => setEtape(ETAPES_REGLEMENT[rang - 1].cle)}
                    className="px-3 py-[3px] border border-border-dark rounded-[3px] disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  {etape !== 'recapitulatif' ? (
                    <button
                      type="button"
                      disabled={!!manque}
                      onClick={avancer}
                      className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  ) : (
                    peutEcrire && (
                      <button ref={reglerBouton} type="button" disabled={envoi} onClick={() => void regler()} className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold disabled:opacity-50">
                        {envoi ? 'Règlement…' : 'Passer le règlement'}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
