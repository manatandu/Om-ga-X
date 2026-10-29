import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PortailModale } from './PortailModale';
import { Aide } from './chrome/Aide';
import { ecouterEchap } from '../lib/echap';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { compteUnique, motifAucunCompteRetenu, RETENUS } from '../lib/comptes-proposes';
import { avertissementEcartBareme, type NatureBaremeFiscal } from '../lib/bareme-fiscal';
import type { CompteDuBien, ContrepartieAdmise } from '../lib/compte-du-bien';
import type { Journal, LieuBien } from '../lib/types';
import {
  corpsCreationBien,
  ETAPES,
  etapesDe,
  lireMontant,
  manqueDeLEtape,
  saisieEnchainee,
  saisieVierge,
  type EtapeAssistant,
  type SaisieAssistant,
} from '../lib/assistant-bien';

const etiquette = 'text-[11.5px] font-semibold text-text-dim';
const champ = 'mt-1 w-full border border-border-dark px-2.5 py-1.5 text-[12px] font-normal';

/**
 * L'ASSISTANT DE CRÉATION D'UN BIEN (ligne sage-l4, fonction n° 18) · huit
 * étapes sur le corps du formulaire (`lib/assistant-bien.ts`), envoyé à
 * `POST /immobilisations` · aucune route ni règle à lui. Le refus du serveur
 * se dit au récapitulatif, d'où chaque étape se rouvre.
 */
export function AssistantCreationBien({
  comptesBien,
  journaux,
  lieux,
  bareme,
  exerciceId,
  finExercice,
  unitesServies,
  syscohada,
  onFermer,
  onCree,
}: {
  comptesBien: CompteDuBien[] | null;
  journaux: Journal[];
  lieux: LieuBien[];
  bareme: NatureBaremeFiscal[];
  exerciceId: string | undefined;
  finExercice: string | undefined;
  unitesServies: boolean;
  syscohada: boolean;
  onFermer: () => void;
  onCree: (message: string) => void;
}) {
  const { peutEcrire } = useAuth();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [s, setS] = useState<SaisieAssistant>(() => saisieVierge(aujourdhui));
  const [etape, setEtape] = useState<EtapeAssistant>('designation');
  const [contreparties, setContreparties] = useState<ContrepartieAdmise[] | null>(null);
  // Un échec de lecture n'est pas une liste vide · « aucun financement admis »
  // serait la réponse favorable à une question que l'écran n'a pas pu poser.
  const [echecContreparties, setEchecContreparties] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cree, setCree] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const fermer = useRef<HTMLButtonElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const creerBouton = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoi) onFermer();
        return true;
      }),
    [onFermer, envoi],
  );
  // LE FOCUS SUIT L'ÉTAPE · le premier champ de chaque étape (la case
  // cochée d'un choix), « Créer le bien » au récapitulatif, « Créer un autre
  // bien » une fois créé · sans quoi le clavier restait sur un champ disparu
  // et Entrée ne menait nulle part. À défaut, la croix de fermeture.
  useEffect(() => {
    const cible =
      etape === 'recapitulatif' && !cree
        ? creerBouton.current
        : corps.current?.querySelector<HTMLElement>(
            cree ? 'button[data-enchainer]' : 'input[type=radio]:checked, input:not([disabled]):not([type=radio]), select:not([disabled])',
          );
    (cible ?? fermer.current)?.focus({ preventScroll: true });
  }, [etape, cree]);
  // Un seul compte de bien personnalisé se présélectionne.
  useEffect(() => {
    if (!s.compteImmobilisationId && comptesBien) {
      const unique = compteUnique(comptesBien);
      if (unique) setS((x) => ({ ...x, compteImmobilisationId: unique }));
    }
  }, [comptesBien, s.compteImmobilisationId]);
  // Le financement admis dépend du compte du bien · la liste du formulaire.
  useEffect(() => {
    setContreparties(null);
    setEchecContreparties(null);
    if (!s.compteImmobilisationId) return;
    let vivant = true;
    api
      .get<ContrepartieAdmise[]>(`/immobilisations/contreparties-acquisition?compteImmobilisationId=${s.compteImmobilisationId}&${RETENUS}`)
      .then(
        (c) => {
          if (!vivant) return;
          setContreparties(c);
          if (c.length === 1) setS((x) => (x.compteContrepartieId ? x : { ...x, compteContrepartieId: c[0].id }));
        },
        (e: Error) => {
          if (!vivant) return;
          setEchecContreparties(e instanceof ApiError ? e.message : 'Les financements admis n’ont pas pu être lus.');
        },
      );
    return () => {
      vivant = false;
    };
  }, [s.compteImmobilisationId]);

  const poser = <K extends keyof SaisieAssistant>(cle: K, valeur: SaisieAssistant[K]) => setS((x) => ({ ...x, [cle]: valeur }));
  const etapes = etapesDe(s);
  const rang = Math.max(0, etapes.indexOf(etape));
  const manque = manqueDeLEtape(etape, s);
  const compte = (comptesBien ?? []).find((c) => c.id === s.compteImmobilisationId) ?? null;
  const natures = bareme.filter((n) => !compte || !n.comptes || n.comptes.length === 0 || n.comptes.includes(compte.numero));
  const nature = bareme.find((n) => n.cle === s.natureFiscaleCle) ?? null;
  const ecartBareme = avertissementEcartBareme(s.dureeAmortissementAns ? Number(s.dureeAmortissementAns) : null, nature, finExercice);
  const contrepartie = (contreparties ?? []).find((c) => c.id === s.compteContrepartieId) ?? null;
  const journal = journaux.find((j) => j.id === s.journalId) ?? null;
  const lieu = lieux.find((l) => l.id === s.lieuId) ?? null;
  const avancer = () => {
    if (!manque && etape !== 'recapitulatif') setEtape(etapes[rang + 1]);
  };
  // ENTRÉE AVANCE, comme dans l'assistant de Sage · sur un champ seulement ;
  // un bouton garde son Entrée (« Précédent », « Créer le bien »), et le
  // récapitulatif ne crée qu'au bouton, jamais par une touche tapée ailleurs.
  const surTouche = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    const balise = (e.target as HTMLElement).tagName;
    if (balise !== 'INPUT' && balise !== 'SELECT') return;
    e.preventDefault();
    avancer();
  };

  const creer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await api.post('/immobilisations', corpsCreationBien(s, exerciceId));
      setCree(s.designation.trim());
      onCree(`Bien « ${s.designation.trim()} » créé par l’assistant.`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Le bien n’a pas pu être créé.');
    } finally {
      setEnvoi(false);
    }
  };

  const recap: [string, string][] = [
    ['Désignation', s.designation.trim()],
    ['N° inventaire', s.numeroInventaire.trim() || '·'],
    ['N° de série', s.numeroSerie.trim() || '·'],
    ['Lieu', lieu ? `${lieu.code} · ${lieu.intitule}` : '·'],
    ['Compte', compte ? `${compte.numero} · ${compte.intitule}` : '·'],
    ['Nature au barème', nature ? `${nature.designation} (${nature.dureeAns} ans)` : '·'],
    ['Origine', s.repris ? 'Repris au bilan d’ouverture' : 'Acquis dans l’exercice'],
    ['Acquisition', s.dateAcquisition ? new Date(s.dateAcquisition).toLocaleDateString('fr-FR') : '·'],
    ['Mise en service', s.pasEncoreEnService ? 'Pas encore' : s.dateMiseEnService ? new Date(s.dateMiseEnService).toLocaleDateString('fr-FR') : '·'],
    ['Valeur d’origine', montant(lireMontant(s.valeurOrigine))],
    ['Valeur résiduelle', montant(lireMontant(s.valeurResiduelle))],
    ...(s.repris
      ? ([['Amortissement déjà pratiqué', montant(lireMontant(s.amortissementAnterieur) ?? 0)]] as [string, string][])
      : ([
          ['Financement', contrepartie ? `${contrepartie.numero} · ${contrepartie.intitule}` : '·'],
          ['Journal', journal ? `${journal.code} · ${journal.intitule}` : '·'],
        ] as [string, string][])),
    ['Durée', s.dureeAmortissementAns ? `${s.dureeAmortissementAns} ans` : 'Celle de la famille'],
    ['Mode', s.modeAmortissement === 'UNITES_DOEUVRE' ? `Unités d’œuvre (${s.unitesOeuvrePrevues} ${s.uniteOeuvreLibelle})` : s.modeAmortissement === 'DEGRESSIF' ? 'Dégressif' : 'Linéaire'],
    ['Réserve de propriété', s.reserveDePropriete ? 'Déclarée' : 'Non déclarée'],
  ];

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={() => !envoi && onFermer()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Assistant de création d’un bien"
          className="anim-modale w-[720px] max-w-full max-h-full overflow-auto rounded-[4px] bg-surface border border-border-dark shadow-dominante"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3.5 h-[32px] bg-surface text-text border-b border-border">
            <span className="text-[11.5px] font-semibold flex items-center gap-1.5">
              Assistant de création d’un bien
              <Aide
                titre="Assistant de création d'un bien"
                texte="Les étapes du formulaire « Nouvelle immobilisation », une à la fois, pour une fiche ordinaire · la même création, les mêmes contrôles. Un composant, une location-acquisition, un incorporel à durée non limitée, des frais de développement ou un bien inscrit en cours se créent par le formulaire complet. « Créer un autre bien » repart de la première étape en gardant compte, nature, lieu, dates, financement et plan · désignation, numéro et valeurs sont vidés."
                source="Définition d’OmegaX (Sage, assistant de création d'un bien)"
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
            {etapes.map((cle, i) => (
              <li key={cle}>
                <button
                  type="button"
                  aria-current={cle === etape ? 'step' : undefined}
                  // On revient sur une étape franchie, on n'en saute aucune.
                  disabled={i > rang || !!cree}
                  onClick={() => setEtape(cle)}
                  className={`px-2 py-[2px] rounded-[3px] border ${cle === etape ? 'bg-sel text-white border-sel' : 'border-border'} disabled:opacity-50`}
                >
                  {i + 1}. {ETAPES.find((e) => e.cle === cle)!.libelle}
                </button>
              </li>
            ))}
          </ol>

          <div ref={corps} className="p-3.5 text-[11.5px]" onKeyDown={surTouche}>
            {cree ? (
              <div>
                <div className="text-positive mb-3">Bien « {cree} » créé.</div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={onFermer} className="px-3 py-[3px] border border-border-dark rounded-[3px]">
                    Terminer
                  </button>
                  <button
                    type="button"
                    data-enchainer
                    onClick={() => {
                      setS((x) => saisieEnchainee(x));
                      setCree(null);
                      setErreur(null);
                      setEtape('designation');
                    }}
                    className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold"
                  >
                    Créer un autre bien
                  </button>
                </div>
              </div>
            ) : (
              <>
                {etape === 'designation' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`${etiquette} sm:col-span-2`}>
                      Désignation
                      <input value={s.designation} onChange={(e) => poser('designation', e.target.value)} className={champ} />
                    </label>
                    <label className={etiquette}>
                      N° inventaire
                      <input value={s.numeroInventaire} onChange={(e) => poser('numeroInventaire', e.target.value)} className={champ} />
                    </label>
                    <label className={etiquette}>
                      N° de série
                      <input value={s.numeroSerie} maxLength={100} onChange={(e) => poser('numeroSerie', e.target.value)} className={champ} />
                    </label>
                    <label className={etiquette}>
                      Lieu
                      <select value={s.lieuId} onChange={(e) => poser('lieuId', e.target.value)} className={champ}>
                        <option value="">Non renseigné</option>
                        {lieux.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} · {l.intitule}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {etape === 'compte' && (
                  <div className="grid grid-cols-1 gap-3">
                    <label className={etiquette}>
                      Compte du bien
                      <select value={s.compteImmobilisationId} onChange={(e) => setS((x) => ({ ...x, compteImmobilisationId: e.target.value, compteContrepartieId: '' }))} className={champ}>
                        <option value="">Choisir…</option>
                        {(comptesBien ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.numero} · {c.intitule}
                          </option>
                        ))}
                      </select>
                      {comptesBien === null && <span className="block font-normal text-text-dim">Chargement…</span>}
                      {motifAucunCompteRetenu(comptesBien, 'de bien') && <span className="block font-normal text-warning">{motifAucunCompteRetenu(comptesBien, 'de bien')}</span>}
                      {compte?.motifNonAmortissable && <span className="block font-normal text-text-dim">{compte.motifNonAmortissable}</span>}
                      {compte?.motifComptes && <span className="block font-normal text-warning">{compte.motifComptes}</span>}
                    </label>
                    <label className={etiquette}>
                      Nature au barème fiscal
                      <select value={s.natureFiscaleCle} onChange={(e) => poser('natureFiscaleCle', e.target.value)} className={champ}>
                        <option value="">Non renseignée</option>
                        {natures.map((n) => (
                          <option key={n.cle} value={n.cle}>
                            {n.designation} · {n.dureeAns} ans
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {etape === 'origine' && (
                  <fieldset className="grid gap-2">
                    <legend className={etiquette}>Origine du bien</legend>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="origine" checked={!s.repris} onChange={() => poser('repris', false)} />
                      Acquis dans l’exercice · l’écriture d’acquisition est passée
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="origine" checked={s.repris} onChange={() => poser('repris', true)} />
                      Repris au bilan d’ouverture · aucune écriture
                    </label>
                  </fieldset>
                )}
                {etape === 'dates' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={etiquette}>
                      Date d’acquisition
                      <input type="date" value={s.dateAcquisition} onChange={(e) => poser('dateAcquisition', e.target.value)} className={champ} />
                    </label>
                    <label className={etiquette}>
                      Mise en service
                      <input type="date" value={s.dateMiseEnService} disabled={s.pasEncoreEnService} onChange={(e) => poser('dateMiseEnService', e.target.value)} className={champ} />
                    </label>
                    <label className={`${etiquette} flex items-center gap-1.5 self-end pb-1.5`}>
                      <input type="checkbox" checked={s.pasEncoreEnService} onChange={(e) => poser('pasEncoreEnService', e.target.checked)} />
                      Pas encore mis en service
                    </label>
                  </div>
                )}
                {etape === 'valeur' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={etiquette}>
                      Valeur d’origine
                      <input inputMode="decimal" value={s.valeurOrigine} onChange={(e) => poser('valeurOrigine', e.target.value)} className={champ} />
                    </label>
                    <label className={etiquette}>
                      Valeur résiduelle
                      <input inputMode="decimal" value={s.valeurResiduelle} onChange={(e) => poser('valeurResiduelle', e.target.value)} className={champ} />
                    </label>
                    {s.repris && (
                      <label className={etiquette}>
                        Amortissement déjà pratiqué
                        <input inputMode="decimal" value={s.amortissementAnterieur} onChange={(e) => poser('amortissementAnterieur', e.target.value)} className={champ} />
                      </label>
                    )}
                  </div>
                )}
                {etape === 'financement' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={etiquette}>
                      Financement
                      <select value={s.compteContrepartieId} onChange={(e) => poser('compteContrepartieId', e.target.value)} className={champ}>
                        <option value="">Choisir…</option>
                        {(contreparties ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.numero} · {c.intitule}
                            {c.libelleMode ? ` (${c.libelleMode})` : ''}
                          </option>
                        ))}
                      </select>
                      {contreparties === null && !echecContreparties && <span className="block font-normal text-text-dim">Chargement…</span>}
                      {echecContreparties && <span className="block font-normal text-danger">{echecContreparties}</span>}
                      {motifAucunCompteRetenu(contreparties, 'de financement admis pour ce bien') && (
                        <span className="block font-normal text-warning">{motifAucunCompteRetenu(contreparties, 'de financement admis pour ce bien')}</span>
                      )}
                    </label>
                    <label className={etiquette}>
                      Journal
                      <select value={s.journalId} onChange={(e) => poser('journalId', e.target.value)} className={champ}>
                        <option value="">Choisir…</option>
                        {journaux
                          .filter((j) => j.estActif)
                          .map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.code} · {j.intitule}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}
                {etape === 'plan' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={etiquette}>
                      Durée (ans)
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={s.dureeAmortissementAns}
                        placeholder={nature ? String(nature.dureeAns) : 'Celle de la famille'}
                        onChange={(e) => poser('dureeAmortissementAns', e.target.value)}
                        className={champ}
                      />
                    </label>
                    {unitesServies && (
                      <label className={etiquette}>
                        Mode d’amortissement
                        <select value={s.modeAmortissement} onChange={(e) => poser('modeAmortissement', e.target.value as SaisieAssistant['modeAmortissement'])} className={champ}>
                          <option value="LINEAIRE">Linéaire</option>
                          <option value="UNITES_DOEUVRE">Unités d’œuvre</option>
                          {!syscohada && <option value="DEGRESSIF">Dégressif</option>}
                        </select>
                      </label>
                    )}
                    <label className={`${etiquette} flex items-center gap-1.5 self-end pb-1.5`}>
                      <input type="checkbox" checked={s.reserveDePropriete} onChange={(e) => poser('reserveDePropriete', e.target.checked)} />
                      Réserve de propriété
                    </label>
                    {s.modeAmortissement === 'UNITES_DOEUVRE' && (
                      <>
                        <label className={etiquette}>
                          Total d’unités prévues
                          <input type="number" min={1} value={s.unitesOeuvrePrevues} onChange={(e) => poser('unitesOeuvrePrevues', e.target.value)} className={champ} />
                        </label>
                        <label className={etiquette}>
                          Unité (km, heures, pièces…)
                          <input value={s.uniteOeuvreLibelle} onChange={(e) => poser('uniteOeuvreLibelle', e.target.value)} className={champ} />
                        </label>
                      </>
                    )}
                    {ecartBareme && <div className="sm:col-span-3 text-warning">{ecartBareme}</div>}
                  </div>
                )}
                {etape === 'recapitulatif' && (
                  <table className="w-full">
                    <tbody>
                      {recap.map(([libelle, valeur]) => (
                        <tr key={libelle}>
                          <td className="py-[2px] text-text-dim w-[45%]">{libelle}</td>
                          <td className="py-[2px]">{valeur}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {manque && <div className="mt-2 text-text-dim">{manque}</div>}
                {erreur && <div className="mt-2 text-danger">{erreur}</div>}
                <div className="mt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    disabled={rang === 0 || envoi}
                    onClick={() => setEtape(etapes[rang - 1])}
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
                      <button ref={creerBouton} type="button" disabled={envoi} onClick={() => void creer()} className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold disabled:opacity-50">
                        {envoi ? 'Création…' : 'Créer le bien'}
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
