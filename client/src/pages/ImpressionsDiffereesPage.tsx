import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { libelleExercice } from '../lib/libelle-exercice';
import type { Journal } from '../lib/types';
import { Aide } from '../components/chrome/Aide';
import { SelectionsEnregistrees } from '../components/SelectionsEnregistrees';
import { tailleLisible } from '../lib/export-modifications';
import {
  LIBELLES_NATURE,
  criteresDeLaDemande,
  libelleEtat,
  productionEnCours,
  resteAProduire,
  type ImpressionServie,
  type ListeImpressions,
  type NatureImpression,
} from '../lib/impressions-differees';

/**
 * IMPRESSIONS DIFFÉRÉES · Fichier > Impressions différées (ligne sage-l7,
 * fonction 59 ; décision L7-2, AUDCIF art. 22, 6° et 7°).
 *
 * Une édition demandée MAINTENANT, produite ensuite par le serveur, retrouvée
 * PLUS TARD dans cette liste · le journal, le grand livre ou la balance, par
 * le moteur de leur export et sous son plafond. La demande prend un numéro ;
 * un refus ou une panne la rend « Échouée », motif dit, jamais un fichier
 * partiel. La production se fait dans une requête du serveur, que la fenêtre
 * relance tant qu'une demande attend · fermer la fenêtre n'annule rien, la
 * production attendra la prochaine ouverture.
 *
 * Demander est une lecture des livres, ouverte à tous les rôles qui les
 * exportent ; retirer un fichier rangé est réservé à qui écrit (`peutEcrire`).
 */

function messageDe(e: unknown, defaut: string): string {
  return e instanceof ApiError ? e.message : defaut;
}

function dateHeure(iso: string | null): string {
  if (!iso) return '·';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Relecture de la liste pendant qu'une production tourne · convention d'OmegaX. */
const INTERVALLE_RELECTURE_MS = 4_000;

export function ImpressionsDiffereesPage() {
  const { peutEcrire } = useAuth();
  const { exerciceCourant } = useExercice();
  const [nature, setNature] = useState<NatureImpression>('GRAND_LIVRE');
  const [journalId, setJournalId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [inclureBrouillard, setInclureBrouillard] = useState(true);
  const [format, setFormat] = useState<'fpm' | 'plat'>('fpm');
  const [grandsLivres, setGrandsLivres] = useState(true);
  const [journaux, setJournaux] = useState<Journal[] | null>(null);
  const [erreurJournaux, setErreurJournaux] = useState<string | null>(null);
  const [liste, setListe] = useState<ListeImpressions | null>(null);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const enTraitement = useRef(false);
  const monte = useRef(true);

  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const recharger = useCallback(async (): Promise<ListeImpressions | null> => {
    try {
      const l = await api.get<ListeImpressions>('/impressions-differees');
      if (monte.current) {
        setListe(l);
        setErreurListe(null);
      }
      return l;
    } catch (e) {
      if (monte.current) setErreurListe(messageDe(e, "La liste des impressions n'a pas pu être lue."));
      return null;
    }
  }, []);

  /**
   * Fait produire ce qui attend, une demande par appel, jusqu'à ce qu'il n'y
   * ait plus rien · une seule boucle à la fois. Le serveur n'en produit qu'une
   * à la fois par dossier, et dit ce qui attend encore.
   */
  const faireProduire = useCallback(async () => {
    if (enTraitement.current) return;
    enTraitement.current = true;
    try {
      for (let i = 0; i < 20; i++) {
        const r = await api.post<{ traitee: ImpressionServie | null; enAttente: number }>('/impressions-differees/traiter');
        await recharger();
        if (!r.traitee || r.enAttente === 0) break;
      }
    } catch (e) {
      if (monte.current) setErreur(messageDe(e, "La production n'a pas pu être lancée."));
    } finally {
      enTraitement.current = false;
    }
  }, [recharger]);

  useEffect(() => {
    void (async () => {
      const l = await recharger();
      if (l && resteAProduire(l)) void faireProduire();
    })();
  }, [recharger, faireProduire]);

  // Tant qu'une production tourne (peut-être lancée par un autre poste), la
  // liste se relit · l'état passe de « En cours » à « Prête » sans geste.
  const tourne = liste ? productionEnCours(liste) : false;
  useEffect(() => {
    if (!tourne) return;
    const minuterie = setInterval(() => void recharger(), INTERVALLE_RELECTURE_MS);
    return () => clearInterval(minuterie);
  }, [tourne, recharger]);

  useEffect(() => {
    if (nature !== 'JOURNAL' || journaux !== null) return;
    api.get<Journal[]>('/journaux').then(
      (j) => monte.current && setJournaux(j.filter((x) => x.type !== 'SITUATION')),
      (e) => monte.current && setErreurJournaux(messageDe(e, "La liste des journaux n'a pas pu être lue.")),
    );
  }, [nature, journaux]);

  async function demander() {
    if (!exerciceCourant) return;
    setEnvoi(true);
    setErreur(null);
    setMessage(null);
    try {
      const d = await api.post<ImpressionServie>('/impressions-differees', {
        nature,
        criteres: criteresDeLaDemande(nature, {
          exerciceId: exerciceCourant.id,
          journalId,
          dateDebut,
          dateFin,
          inclureBrouillard,
          format,
          grandsLivres,
        }),
      });
      setMessage(`Impression n° ${d.numero} demandée · elle se retrouve ci-dessous dès qu'elle est prête.`);
      await recharger();
      void faireProduire();
    } catch (e) {
      setErreur(messageDe(e, "La demande n'a pas pu être enregistrée."));
    } finally {
      setEnvoi(false);
    }
  }

  async function telecharger(i: ImpressionServie) {
    setErreur(null);
    try {
      await api.telecharger(`/impressions-differees/${i.id}/fichier`, i.nomFichier ?? `impression-${i.numero}.xlsx`);
    } catch (e) {
      setErreur(`Le fichier de l'impression n° ${i.numero} n'a pas pu être téléchargé · ${messageDe(e, 'échec du téléchargement')}`);
    }
  }

  async function retirerFichier(i: ImpressionServie) {
    setErreur(null);
    try {
      await api.post(`/impressions-differees/${i.id}/retirer-fichier`);
      await recharger();
    } catch (e) {
      setErreur(messageDe(e, "Le fichier n'a pas pu être retiré."));
    }
  }

  return (
    <div className="p-2 max-w-[1040px] text-[11.5px] flex flex-col gap-2.5">
      <section className="border border-border bg-surface px-3.5 py-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[11.5px] font-bold">Nouvelle demande</h2>
          <Aide
            titre="Impression différée"
            texte="L'édition est demandée maintenant et produite ensuite par le serveur, par le même moteur que l'export du livre et sous le même plafond de lignes. Chaque demande prend un numéro de la suite du dossier et garde sa date de demande et sa date de production. Au-delà du plafond, ou sur une panne, la demande est « Échouée » avec son motif · aucun fichier partiel n'est rangé. Fermer la fenêtre n'annule rien · la production reprend à la prochaine ouverture. Le journal entier produit s'enregistre comme imprimé. Retirer un fichier libère la place du dossier · la demande, son numéro et l'empreinte du fichier restent."
            source="AUDCIF art. 22, 6° et 7°."
          />
        </div>
        {!exerciceCourant ? (
          <p className="text-text-dim">Aucun exercice choisi · ouvrez ou choisissez un exercice d'abord.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Édition</span>
              <select value={nature} onChange={(e) => setNature(e.target.value as NatureImpression)} className="border border-border px-2 py-[2px]">
                {(Object.keys(LIBELLES_NATURE) as NatureImpression[]).map((n) => (
                  <option key={n} value={n}>
                    {LIBELLES_NATURE[n]}
                  </option>
                ))}
              </select>
            </label>
            <span className="flex flex-col gap-0.5">
              <span className="text-text-dim">Exercice</span>
              <span className="py-[2px]">{libelleExercice(exerciceCourant)}</span>
            </span>
            {nature === 'JOURNAL' && (
              <>
                <label className="flex flex-col gap-0.5">
                  <span className="text-text-dim">Journal</span>
                  <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className="border border-border px-2 py-[2px]">
                    <option value="">Tous les journaux</option>
                    {(journaux ?? []).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.code} · {j.intitule}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-text-dim">Du</span>
                  <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="border border-border px-2 py-[1px]" />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-text-dim">Au</span>
                  <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="border border-border px-2 py-[1px]" />
                </label>
                <label className="inline-flex items-center gap-1.5 pb-[3px]">
                  <input type="checkbox" checked={inclureBrouillard} onChange={(e) => setInclureBrouillard(e.target.checked)} />
                  Brouillard compris
                </label>
              </>
            )}
            {nature === 'GRAND_LIVRE' && (
              <label className="flex flex-col gap-0.5">
                <span className="text-text-dim">Présentation</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as 'fpm' | 'plat')} className="border border-border px-2 py-[2px]">
                  <option value="fpm">Présentation du cabinet</option>
                  <option value="plat">Livre à plat</option>
                </select>
              </label>
            )}
            {nature === 'BALANCE' && (
              <label className="inline-flex items-center gap-1.5 pb-[3px]">
                <input type="checkbox" checked={grandsLivres} onChange={(e) => setGrandsLivres(e.target.checked)} />
                Avec les grands livres
              </label>
            )}
            <SelectionsEnregistrees
              edition="IMPRESSION_DIFFEREE"
              criteres={{ nature, journalId, dateDebut, dateFin, inclureBrouillard, format, grandsLivres }}
              onRappel={(c) => {
                // Posés sur les valeurs par défaut du formulaire · un critère
                // absent de la sélection revient à son défaut.
                setNature((c.nature as NatureImpression | undefined) ?? 'GRAND_LIVRE');
                setJournalId(typeof c.journalId === 'string' ? c.journalId : '');
                setDateDebut(typeof c.dateDebut === 'string' ? c.dateDebut : '');
                setDateFin(typeof c.dateFin === 'string' ? c.dateFin : '');
                setInclureBrouillard(c.inclureBrouillard !== false);
                setFormat(c.format === 'plat' ? 'plat' : 'fpm');
                setGrandsLivres(c.grandsLivres !== false);
              }}
            />
            <button
              type="button"
              onClick={() => void demander()}
              disabled={envoi}
              className="ml-auto bg-sel text-white font-semibold px-3 py-1.5 disabled:opacity-40"
            >
              {envoi ? 'Demande…' : "Demander l'impression"}
            </button>
          </div>
        )}
        {erreurJournaux && nature === 'JOURNAL' && (
          <p role="alert" className="text-danger">
            {erreurJournaux}
          </p>
        )}
        {message && (
          <p role="status" className="border border-success/30 bg-success-soft px-3 py-2">
            {message}
          </p>
        )}
        {erreur && (
          <p role="alert" className="border border-danger/30 bg-danger-soft px-3 py-2">
            {erreur}
          </p>
        )}
      </section>

      <section className="border border-border bg-surface">
        <h2 className="text-[11.5px] font-bold px-3.5 pt-2.5 pb-1.5">Impressions demandées</h2>
        {erreurListe && (
          <p role="alert" className="px-3.5 pb-2.5 text-danger">
            {erreurListe}
          </p>
        )}
        {!liste && !erreurListe && <p className="px-3.5 pb-2.5 text-text-dim">Chargement…</p>}
        {liste && liste.impressions.length === 0 && <p className="px-3.5 pb-2.5 text-text-dim">Aucune impression demandée.</p>}
        {liste?.tronque && (
          <p className="px-3.5 pb-1.5 text-warning">
            Les {liste.impressions.length} impressions les plus récentes sur {liste.total} sont affichées.
          </p>
        )}
        {liste && liste.impressions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="text-right px-2 py-1 w-[52px]">N°</th>
                  <th className="text-left px-2 py-1">Demandée le</th>
                  <th className="text-left px-2 py-1">Par</th>
                  <th className="text-left px-2 py-1">Édition</th>
                  <th className="text-left px-2 py-1">État</th>
                  <th className="text-left px-2 py-1">Produite le</th>
                  <th className="text-left px-2 py-1">Fichier</th>
                </tr>
              </thead>
              <tbody>
                {liste.impressions.map((i) => (
                  <tr key={i.id}>
                    <td className="px-2 py-1 text-right">{i.numero}</td>
                    <td className="px-2 py-1">{dateHeure(i.demandeLe)}</td>
                    <td className="px-2 py-1">{i.demandePar}</td>
                    <td className="px-2 py-1">{i.libelle}</td>
                    <td className={`px-2 py-1 ${i.etat === 'ECHOUEE' || i.interrompue ? 'text-danger' : i.etat === 'PRETE' ? '' : 'text-warning'}`}>
                      {libelleEtat(i)}
                      {i.motifEchec && <div className="text-text-dim">{i.motifEchec}</div>}
                    </td>
                    <td className="px-2 py-1">{dateHeure(i.produitLe)}</td>
                    <td className="px-2 py-1">
                      {i.etat === 'PRETE' && !i.fichierRetireLe && (
                        <span className="flex flex-wrap gap-2.5">
                          <button
                            type="button"
                            onClick={() => void telecharger(i)}
                            className="text-sel hover:underline"
                            aria-label={`Télécharger l'impression n° ${i.numero}`}
                            title={i.empreinte ? `Empreinte SHA-256 · ${i.empreinte}` : undefined}
                          >
                            Télécharger
                          </button>
                          {i.taille !== null && <span className="text-text-dim">{tailleLisible(i.taille)}</span>}
                          {peutEcrire && (
                            <button
                              type="button"
                              onClick={() => void retirerFichier(i)}
                              className="text-danger hover:underline"
                              aria-label={`Retirer le fichier de l'impression n° ${i.numero}`}
                            >
                              Retirer le fichier
                            </button>
                          )}
                        </span>
                      )}
                      {i.fichierRetireLe && <span className="text-text-dim">Retiré le {dateHeure(i.fichierRetireLe)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
