import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { avisRelectureManquee, gestePuisRelecture } from '../lib/geste-puis-relecture';
import { useAuth } from '../lib/auth';
import { useGardeFermeture } from '../lib/fenetres';
import { Aide } from '../components/chrome/Aide';
import {
  AIDE_JETONS_MODELE,
  LIBELLES_NATURE_MODELE,
  LONGUEUR_INTITULE_MODELE,
  LONGUEUR_TEXTE_MODELE,
  NATURES_MODELE,
  OU_SERT_LE_MODELE,
  PLAFOND_MODELES_IMPRESSION,
  TEXTE_DE_DEPART,
  type ModeleImpression,
  type NatureModeleImpression,
} from '../lib/modeles-impression';

/** Le modèle en cours d'écriture · `id` nul pour un nouveau. */
interface Brouillon {
  id: string | null;
  nature: NatureModeleImpression | '';
  intitule: string;
  texte: string;
}

/**
 * MODÈLES D'IMPRESSION DES TIERS (ligne sage-l2, fonction 27 · Sage, modèles
 * d'impression de la fiche du tiers, extrait, règlement, rappel) · Structure >
 * Paramètres de saisie. Le modèle HABILLE le document qu'OmegaX compose (le
 * jeton {document} marque sa place) ; il se choisit sur la fiche du tiers. La
 * structure appartient à l'administrateur (`@Roles` ADMIN_CABINET au serveur),
 * les autres la lisent. Le serveur juge le texte et l'écran dit son refus.
 */
export function ModelesImpressionPage() {
  const { estAdmin } = useAuth();
  const [liste, setListe] = useState<ModeleImpression[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // La relecture manquée après un geste réussi, dite à part (relecture m6).
  const [avisRelecture, setAvisRelecture] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  // LE BROUILLON TEL QU'OUVERT, et le formulaire qui reçoit le focus (second
  // tour de relecture, mineur 16) · « Modifier » sur un autre modèle écrasait
  // en silence un texte en cours.
  const [brouillonOuvert, setBrouillonOuvert] = useState<Brouillon | null>(null);
  const [ouvertures, setOuvertures] = useState(0);
  const formulaire = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (ouvertures > 0) formulaire.current?.querySelector<HTMLElement>('select, input, textarea')?.focus({ preventScroll: true });
  }, [ouvertures]);
  /** Ouvre un brouillon · un texte en cours modifié ne se perd que sur demande. */
  const ouvrir = (nouveau: Brouillon) => {
    const modifie = brouillon !== null && JSON.stringify(brouillon) !== JSON.stringify(brouillonOuvert);
    if (modifie && !window.confirm("Le modèle en cours n'est pas enregistré · l'abandonner pour celui-ci ?")) return;
    setErreur(null);
    setBrouillon(nouveau);
    setBrouillonOuvert(nouveau);
    setOuvertures((n) => n + 1);
  };
  const [lu, setLu] = useState<string | null>(null);
  // Un modèle en cours d'écriture ne se perd pas à la fermeture de la fenêtre.
  useGardeFermeture(brouillon ? "Le modèle d'impression en cours n'est pas enregistré." : null);

  const charger = async () => {
    setListe(await api.get<ModeleImpression[]>('/modeles-impression'));
    setErreurLecture(null);
  };
  useEffect(() => {
    charger().catch((e) => {
      setListe(null);
      setErreurLecture(e instanceof ApiError ? e.message : "La liste des modèles d'impression n'a pas pu être lue.");
    });
  }, []);

  /**
   * Rend vrai si le geste a abouti · un refus est affiché, le brouillon
   * reste. La relecture qui suit a SON issue (relecture m6) · manquée, le
   * geste reste fait, dit fait, et la liste est dite non relue.
   */
  const agir = async (fn: () => Promise<unknown>, reussite: string): Promise<boolean> => {
    setErreur(null);
    setInfo(null);
    setAvisRelecture(null);
    setEnvoi(true);
    try {
      const issue = await gestePuisRelecture(fn, charger, (e) => (e instanceof ApiError ? e.message : null));
      if (issue.erreurGeste) setErreur(issue.erreurGeste);
      if (issue.fait) setInfo(reussite);
      if (issue.erreurRelecture) setAvisRelecture(avisRelectureManquee("la liste des modèles d'impression", issue.erreurRelecture));
      return issue.fait;
    } finally {
      setEnvoi(false);
    }
  };

  const enregistrer = (e: FormEvent) => {
    e.preventDefault();
    if (!brouillon) return;
    if (!brouillon.nature) {
      setErreur('Choisissez le document que le modèle habille.');
      return;
    }
    const { id, nature, intitule, texte } = brouillon;
    void agir(
      () => (id ? api.patch(`/modeles-impression/${id}`, { intitule, texte }) : api.post('/modeles-impression', { nature, intitule, texte })),
      id ? 'Modèle enregistré.' : 'Modèle créé.',
    ).then((fait) => {
      if (fait) setBrouillon(null);
    });
  };

  const supprimer = (m: ModeleImpression) => {
    if (!window.confirm(`Supprimer le modèle « ${m.intitule} » ? Cette suppression est définitive.`)) return;
    void agir(() => api.delete(`/modeles-impression/${m.id}`), 'Modèle supprimé.').then((fait) => {
      if (fait && brouillon?.id === m.id) setBrouillon(null);
    });
  };

  const complet = liste !== null && liste.length >= PLAFOND_MODELES_IMPRESSION;
  const modeleLu = liste?.find((m) => m.id === lu) ?? null;

  return (
    <div className="p-2 max-w-[1040px]">
      <div className="flex items-center justify-end gap-2 mb-2">
        {estAdmin && liste !== null && (
          <button
            type="button"
            disabled={envoi || complet}
            onClick={() => ouvrir({ id: null, nature: '', intitule: '', texte: TEXTE_DE_DEPART })}
            className="bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold disabled:opacity-50"
          >
            Nouveau modèle
          </button>
        )}
        <Aide
          titre="Modèles d'impression"
          texte={`Un modèle habille un document qu'OmegaX compose pour un tiers, sans jamais le remplacer · le jeton {document} marque la place du document, et le reste du texte s'imprime autour (service destinataire, référence de contrat, formule). ${NATURES_MODELE.map((n) => `${LIBELLES_NATURE_MODELE[n]} · ${OU_SERT_LE_MODELE[n]}`).join(' ')} Le modèle se choisit sur la fiche du tiers ; un tiers sans modèle reçoit le document tel qu'OmegaX le compose. Une lettre déjà émise garde son texte. Cent modèles au plus ; un modèle choisi par un tiers ne se supprime pas.`}
          source="Sage 100 i7, plan tiers · modèles d'impression (F_COMPTETMODELE)"
        />
      </div>
      {erreur && <div role="alert" className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">{erreur}</div>}
      {info && <div className="text-[11.5px] text-positive bg-positive-soft border border-positive/30 px-3 py-1.5 mb-2">{info}</div>}
      {avisRelecture && <div role="status" className="text-[11.5px] text-warning bg-warning-soft border border-warning/30 px-3 py-1.5 mb-2">{avisRelecture}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] min-w-[560px]">
          <thead>
            <tr>
              <th className="text-left w-[150px]">Document</th>
              <th className="text-left">Intitulé</th>
              <th className="text-right w-[70px]">Tiers</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {liste?.map((m) => (
              <tr key={m.id}>
                <td>{LIBELLES_NATURE_MODELE[m.nature]}</td>
                <td className="font-semibold">{m.intitule}</td>
                <td className="text-right">{m.nombreTiers}</td>
                <td className="text-right whitespace-nowrap">
                  {estAdmin ? (
                    <>
                      <button
                        type="button"
                        aria-label={`Modifier le modèle ${m.intitule}`}
                        disabled={envoi}
                        onClick={() => ouvrir({ id: m.id, nature: m.nature, intitule: m.intitule, texte: m.texte })}
                        className="text-sel hover:underline disabled:opacity-50"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        aria-label={`Supprimer le modèle ${m.intitule}`}
                        disabled={envoi}
                        onClick={() => supprimer(m)}
                        className="ml-3 text-danger hover:underline disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setLu(lu === m.id ? null : m.id)} className="text-sel hover:underline">
                      {lu === m.id ? 'Fermer' : 'Lire'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {erreurLecture ? (
              <tr>
                <td colSpan={4} className="text-danger">
                  Liste des modèles d'impression illisible · {erreurLecture}
                </td>
              </tr>
            ) : liste === null ? (
              <tr>
                <td colSpan={4} className="italic text-text-dim">
                  Chargement…
                </td>
              </tr>
            ) : (
              liste.length === 0 && (
                <tr>
                  <td colSpan={4} className="italic text-text-dim">
                    Aucun modèle d'impression.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {modeleLu && (
        <pre className="mt-2 border border-border bg-surface px-3 py-2 text-[11.5px] whitespace-pre-wrap font-sans">{modeleLu.texte}</pre>
      )}

      {estAdmin && brouillon && (
        <form ref={formulaire} onSubmit={enregistrer} className="mt-3 border border-border bg-surface px-3 py-2.5 flex flex-col gap-2 text-[11.5px]">
          <div className="text-[11px] font-bold text-text-dim">{brouillon.id ? 'Modèle' : 'Nouveau modèle'}</div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Document</span>
              {brouillon.id ? (
                <span className="py-1">{brouillon.nature ? LIBELLES_NATURE_MODELE[brouillon.nature] : ''}</span>
              ) : (
                <select
                  required
                  aria-label="Document du modèle"
                  value={brouillon.nature}
                  onChange={(e) => setBrouillon({ ...brouillon, nature: e.target.value as NatureModeleImpression })}
                  className="border border-border-dark px-2 py-1 bg-surface"
                >
                  <option value="">·</option>
                  {NATURES_MODELE.map((n) => (
                    <option key={n} value={n}>
                      {LIBELLES_NATURE_MODELE[n]}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex flex-col gap-0.5 flex-1 min-w-[180px]">
              <span className="text-text-dim">Intitulé</span>
              <input
                required
                aria-label="Intitulé du modèle"
                maxLength={LONGUEUR_INTITULE_MODELE}
                value={brouillon.intitule}
                onChange={(e) => setBrouillon({ ...brouillon, intitule: e.target.value })}
                className="border border-border-dark px-2 py-1"
              />
            </label>
          </div>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim flex items-center gap-1">
              Texte
              <Aide titre="Jetons du modèle" texte={AIDE_JETONS_MODELE} source="OmegaX" />
            </span>
            <textarea
              required
              aria-label="Texte du modèle"
              rows={10}
              maxLength={LONGUEUR_TEXTE_MODELE}
              value={brouillon.texte}
              onChange={(e) => setBrouillon({ ...brouillon, texte: e.target.value })}
              className="border border-border-dark px-2 py-1 font-sans leading-normal"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBrouillon(null)} className="text-text-dim hover:underline">
              Annuler
            </button>
            <button type="submit" disabled={envoi} className="bg-sel text-white px-3.5 py-1 font-semibold disabled:opacity-50">
              Enregistrer le modèle
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
