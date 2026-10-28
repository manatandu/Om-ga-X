import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';
import { ecouterEchap } from '../lib/echap';
import { etatEssai, libelleIssueRappel, dateDuJour, statutDuRappel, type EssaiEchu, type ResultatRappel } from '../lib/essais-echus';

interface Liste {
  essais: EssaiEchu[];
  /** Comptés par le serveur sur TOUS les dossiers concernés, pas sur la tranche affichée. */
  total: number;
  tronque: boolean;
  aRappeler: number;
  supprimables: number;
}

interface BilanRappels {
  resultats: ResultatRappel[];
  envoyes: number;
  enFile: number;
  echecs: number;
  /** Tous les dossiers dus ont été lus · ceux que la borne de l'appel n'a pas tentés. */
  restants: number;
  parAppel: number;
}

interface Suppression {
  supprime: boolean;
  tenantId: string;
  nombreUtilisateurs: number;
  nombreExercices: number;
  nombreEcritures: number;
  nombreLignesSupprimees: number;
}

/**
 * LES DOSSIERS D'ESSAI ÉCHUS, dans la console de l'éditeur · conservés cent
 * quatre-vingts jours après leur terme, rappel au moins trente jours avant,
 * puis supprimés PAR L'OPÉRATEUR, d'ici (décision de Manasse du 2026-10-17).
 *
 * La liste ne montre que des identifiants, des dates, un état et des nombres ·
 * l'éditeur ne voit jamais les informations d'un client. Le serveur juge tout : le
 * bouton « Supprimer » n'est proposé que pour un dossier lu supprimable, et le
 * serveur le REFUSE de toute façon si le calendrier a changé entre-temps.
 * Une liste part de `null` · « aucun dossier » ne se dit que sur une liste LUE.
 */
export function EssaisEchusConsole() {
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiRappels, setEnvoiRappels] = useState(false);
  const [bilan, setBilan] = useState<BilanRappels | null>(null);
  const [erreurRappels, setErreurRappels] = useState<string | null>(null);
  const [cible, setCible] = useState<EssaiEchu | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [fait, setFait] = useState<Suppression | null>(null);
  // Une réponse arrivée après une autre plus récente est jetée (jeton de lecture).
  const jeton = useRef(0);

  const charger = async () => {
    const mien = ++jeton.current;
    try {
      const r = await api.get<Liste>('/plateforme/essais-echus');
      if (mien !== jeton.current) return;
      setListe(r);
      setErreur(null);
    } catch (err) {
      if (mien !== jeton.current) return;
      // Un échec de lecture se DIT, et la liste précédente n'est pas rendue pour la liste à jour.
      setListe(null);
      setErreur(err instanceof ApiError ? err.message : 'Impossible de lire les dossiers d’essai échus.');
    }
  };

  useEffect(() => {
    void charger();
  }, []);

  // Échap ferme la boîte de suppression, sauf pendant l'envoi.
  useEffect(() => {
    if (!cible) return undefined;
    return ecouterEchap(() => {
      if (suppressionEnCours) return true;
      setCible(null);
      return true;
    });
  }, [cible, suppressionEnCours]);

  // Le nombre de rappels dus est celui du SERVEUR, sur tous les dossiers · la
  // tranche affichée n'en montre qu'une partie, et un rappel dû au-delà d'elle
  // doit rester envoyable.
  const aRappeler = liste?.aRappeler ?? 0;

  const envoyerRappels = async () => {
    setEnvoiRappels(true);
    setErreurRappels(null);
    setBilan(null);
    try {
      setBilan(await api.post<BilanRappels>('/plateforme/essais-echus/rappels', {}));
    } catch (err) {
      setErreurRappels(err instanceof ApiError ? err.message : 'L’envoi des rappels a échoué.');
    } finally {
      setEnvoiRappels(false);
      await charger();
    }
  };

  const ouvrirSuppression = (e: EssaiEchu) => {
    setCible(e);
    setConfirmation('');
    setErreurSuppression(null);
  };

  const supprimer = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!cible || confirmation.trim() !== cible.tenantId) return;
    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      const r = await api.post<Suppression>(`/plateforme/essais-echus/${cible.tenantId}/supprimer`, { confirmation: confirmation.trim() });
      setFait(r);
      setCible(null);
      await charger();
    } catch (err) {
      setErreurSuppression(err instanceof ApiError ? err.message : 'La suppression a échoué.');
    } finally {
      setSuppressionEnCours(false);
    }
  };

  return (
    <section className="border border-border bg-surface px-3.5 py-2.5 mt-3 text-[11.5px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-bold">Dossiers d’essai échus</h2>
        <div className="flex items-center gap-2">
          <Aide
            titre="Dossiers d’essai échus"
            texte={
              'Un dossier d’essai non souscrit reste consultable et exportable, en lecture seule, cent quatre-vingts jours après son terme, puis il est supprimé. ' +
              'Le rappel part à l’administrateur du dossier au moins trente jours avant, avec la voie d’exportation (Fichier > Restituer le dossier complet). ' +
              'La suppression est un geste de l’opérateur, jamais automatique : elle exige de retaper l’identifiant, et le serveur relit tout le calendrier avant de supprimer. ' +
              'Elle est irréversible ; les sauvegardes chiffrées de la nuit gardent une trace du dossier jusqu’à leur propre terme. ' +
              'Cette liste ne montre ni nom, ni adresse, ni donnée du client.'
            }
            source="Décision du 2026-10-17"
          />
          <button
            type="button"
            onClick={() => void envoyerRappels()}
            disabled={envoiRappels || liste === null || aRappeler === 0}
            className="bg-sel text-white px-3 py-1.5 font-semibold disabled:opacity-50"
          >
            {envoiRappels ? 'Envoi…' : `Envoyer les rappels${liste && aRappeler > 0 ? ` (${aRappeler})` : ''}`}
          </button>
        </div>
      </div>

      {erreur && (
        <p role="alert" className="border border-danger/30 bg-danger-soft px-3 py-2 mb-2">
          {erreur}
        </p>
      )}
      {erreurRappels && (
        <p role="alert" className="border border-danger/30 bg-danger-soft px-3 py-2 mb-2">
          {erreurRappels}
        </p>
      )}
      {bilan && (
        <div role="status" className="border border-border bg-surface-alt px-3 py-2 mb-2">
          <p className="font-semibold">
            {bilan.resultats.length === 0
              ? 'Aucun rappel à envoyer.'
              : `Rappels · ${bilan.envoyes} partis, ${bilan.enFile} en file, ${bilan.echecs} en échec.`}
          </p>
          {bilan.restants > 0 && (
            <p className="mt-1 text-danger">
              {bilan.restants} rappel(s) restent dus · {bilan.parAppel} partent par demande, cliquez de nouveau sur « Envoyer les rappels ».
            </p>
          )}
          {bilan.resultats.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {bilan.resultats.map((r) => (
                <li key={r.tenantId} className={r.issue === 'ECHEC' || r.issue === 'SANS_ADMINISTRATEUR' ? 'text-danger' : ''}>
                  <span className="font-mono">{r.tenantId}</span> · {libelleIssueRappel(r.issue)}
                  {r.detail ? ` · ${r.detail}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {fait && (
        <p role="status" className="border border-border bg-surface-alt px-3 py-2 mb-2">
          Dossier <span className="font-mono">{fait.tenantId}</span> supprimé · {fait.nombreUtilisateurs} utilisateur(s), {fait.nombreExercices} exercice(s),{' '}
          {fait.nombreEcritures} écriture(s), {fait.nombreLignesSupprimees} lignes en tout.
        </p>
      )}
      {liste?.tronque && (
        <p className="border border-warning/30 bg-warning-soft px-3 py-1.5 mb-2">
          {liste.essais.length} dossiers affichés sur {liste.total}, les plus anciennes échéances d’abord · {liste.aRappeler} rappel(s) dû(s) et{' '}
          {liste.supprimables} dossier(s) supprimable(s) en tout.
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[2.2fr_130px_90px_90px_90px_130px_50px_50px_60px_110px] gap-2 px-2 py-1.5 bg-chrome border-b border-border text-[11px] font-bold text-text-dim">
            <span>Dossier</span>
            <span>État</span>
            <span>Terme</span>
            <span>Conservé jusqu’au</span>
            <span>Supprimable dès</span>
            <span>Rappel</span>
            <span className="text-right">Util.</span>
            <span className="text-right">Exerc.</span>
            <span className="text-right">Écrit.</span>
            <span />
          </div>
          {liste === null && !erreur && <div className="p-3 text-text-dim">Chargement…</div>}
          {liste?.essais.length === 0 && <div className="p-3 text-text-dim">Aucun dossier d’essai échu.</div>}
          {liste?.essais.map((e) => {
            const etat = etatEssai(e.etat);
            const rappel = statutDuRappel(e);
            return (
              <div key={e.tenantId} className="grid grid-cols-[2.2fr_130px_90px_90px_90px_130px_50px_50px_60px_110px] gap-2 items-center px-2 py-1.5 border-b border-border last:border-b-0">
                <span className="font-mono text-[11px] break-all select-all">{e.tenantId}</span>
                <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 w-fit ${etat.classe}`}>{etat.libelle}</span>
                <span className="tabular-nums">{dateDuJour(e.termeLe)}</span>
                <span className="tabular-nums">{dateDuJour(e.conserveJusquAu)}</span>
                <span className="tabular-nums">{dateDuJour(e.supprimableLe)}</span>
                <span className={rappel.alerte ? 'text-danger' : ''} title={rappel.detail ?? undefined}>
                  {rappel.libelle}
                </span>
                <span className="text-right tabular-nums">{e.nombreUtilisateurs}</span>
                <span className="text-right tabular-nums">{e.nombreExercices}</span>
                <span className="text-right tabular-nums">{e.nombreEcritures}</span>
                <span className="flex justify-end">
                  {e.etat === 'SUPPRIMABLE' && (
                    <button type="button" onClick={() => ouvrirSuppression(e)} className="border border-danger/50 text-danger px-2.5 py-1 font-semibold">
                      Supprimer
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {cible && (
        <PortailModale>
          <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
            <form
              onSubmit={supprimer}
              role="dialog"
              aria-modal="true"
              aria-label="Supprimer un dossier d’essai"
              className="anim-modale w-full max-w-[460px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
            >
              <div className="h-[32px] flex items-center justify-between px-2.5 bg-surface text-text border-b border-border text-[11.5px]">
                <span>Supprimer le dossier d’essai</span>
                <button
                  type="button"
                  onClick={() => !suppressionEnCours && setCible(null)}
                  aria-label="Fermer"
                  className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c]"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <p>
                  {cible.nombreUtilisateurs} utilisateur(s), {cible.nombreExercices} exercice(s), {cible.nombreEcritures} écriture(s). Irréversible.
                </p>
                <label className="flex flex-col gap-1">
                  <span>
                    Retapez l’identifiant : <span className="font-mono select-all">{cible.tenantId}</span>
                  </span>
                  <input
                    value={confirmation}
                    onChange={(ev) => setConfirmation(ev.target.value)}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Identifiant du dossier"
                    className="border border-border-dark px-2.5 py-1.5 font-mono text-[11.5px]"
                  />
                </label>
                {erreurSuppression && (
                  <p role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">
                    {erreurSuppression}
                  </p>
                )}
              </div>
              <div className="px-3.5 py-2 bg-surface-alt border-t border-border flex justify-end gap-2">
                <button type="button" onClick={() => setCible(null)} disabled={suppressionEnCours} className="border border-border-dark px-3 py-1">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={suppressionEnCours || confirmation.trim() !== cible.tenantId}
                  className="border border-danger bg-danger text-white px-3 py-1 font-semibold disabled:opacity-50"
                >
                  {suppressionEnCours ? 'Suppression…' : 'Supprimer définitivement'}
                </button>
              </div>
            </form>
          </div>
        </PortailModale>
      )}
    </section>
  );
}
