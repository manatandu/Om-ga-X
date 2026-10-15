import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import {
  apercuVide,
  messageEnAttente,
  porteeDeLExport,
  resumeApercu,
  tailleLisible,
  type ApercuExport,
  type ExportServi,
  type ListeExports,
  type ModeExportEcritures,
} from '../lib/export-modifications';

/**
 * EXPORT DES SEULES MODIFICATIONS · Fichier > Exporter les modifications
 * (ligne sage-l7, fonction 99 ; Sage, M8-38, p. 51 et 52).
 *
 * Ce qui a changé depuis le dernier export part dans un fichier NUMÉROTÉ et
 * DATÉ (AUDCIF art. 22, 7°), que l'import des écritures d'OmegaX relit · les
 * écritures nouvelles, celles du brouillard modifiées depuis leur envoi, et
 * les retraits, nommés à part. Le serveur tient le registre de ce qui est
 * parti et GARDE le fichier · un téléchargement interrompu ne perd rien, il
 * se reprend depuis la liste. L'écran ne recompte rien.
 *
 * Produire un export prend un numéro et marque des écritures comme parties ·
 * c'est un acte du comptable (`peutValider`, comme `@ReserveAuComptable` au
 * serveur). La liste et les fichiers se lisent par tous.
 */

function messageDe(e: unknown, defaut: string): string {
  return e instanceof ApiError ? e.message : defaut;
}

function dateHeure(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ExportModificationsPage() {
  const { peutValider } = useAuth();
  const [brouillard, setBrouillard] = useState(false);
  const [apercu, setApercu] = useState<ApercuExport | null>(null);
  const [erreurApercu, setErreurApercu] = useState<string | null>(null);
  const [liste, setListe] = useState<ListeExports | null>(null);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmerComplet, setConfirmerComplet] = useState(false);
  const [resultat, setResultat] = useState<ExportServi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurTelechargement, setErreurTelechargement] = useState<string | null>(null);
  // Une réponse périmée (case cochée puis décochée avant la réponse) est
  // jetée · sans quoi l'aperçu du brouillard s'afficherait sous la case vide.
  const jetonApercu = useRef(0);

  const chargerApercu = useCallback(async (avecBrouillard: boolean) => {
    const mien = ++jetonApercu.current;
    setApercu(null);
    setErreurApercu(null);
    try {
      const a = await api.get<ApercuExport>(`/exports-ecritures/apercu?inclureBrouillard=${avecBrouillard}`);
      if (mien === jetonApercu.current) setApercu(a);
    } catch (e) {
      if (mien === jetonApercu.current) setErreurApercu(messageDe(e, "L'aperçu du prochain export n'a pas pu être lu."));
    }
  }, []);

  const chargerListe = useCallback(async () => {
    setErreurListe(null);
    try {
      setListe(await api.get<ListeExports>('/exports-ecritures'));
    } catch (e) {
      setErreurListe(messageDe(e, "La liste des exports n'a pas pu être lue."));
    }
  }, []);

  useEffect(() => {
    void chargerApercu(brouillard);
  }, [brouillard, chargerApercu]);

  useEffect(() => {
    void chargerListe();
  }, [chargerListe]);

  async function exporter(mode: ModeExportEcritures) {
    setEnvoi(true);
    setErreur(null);
    setErreurTelechargement(null);
    setResultat(null);
    try {
      const r = await api.post<ExportServi>('/exports-ecritures', { mode, inclureBrouillard: brouillard });
      setResultat(r);
      setConfirmerComplet(false);
      // L'export est ENREGISTRÉ dès cette réponse · un téléchargement manqué
      // ne le défait pas, il se reprend depuis la liste, et c'est dit.
      try {
        await api.telecharger(`/exports-ecritures/${r.id}/fichier`, r.nomFichier);
      } catch (e) {
        setErreurTelechargement(
          `L'export n° ${r.numero} est enregistré, mais son fichier n'a pas pu être téléchargé (${messageDe(e, 'échec du téléchargement')}) · il se reprend depuis la liste.`,
        );
      }
      void chargerListe();
      void chargerApercu(brouillard);
    } catch (e) {
      setErreur(messageDe(e, "L'export n'a pas abouti."));
    } finally {
      setEnvoi(false);
    }
  }

  async function retelecharger(e: ExportServi) {
    setErreurTelechargement(null);
    try {
      await api.telecharger(`/exports-ecritures/${e.id}/fichier`, e.nomFichier);
    } catch (err) {
      setErreurTelechargement(`Le fichier de l'export n° ${e.numero} n'a pas pu être téléchargé · ${messageDe(err, 'échec du téléchargement')}`);
    }
  }

  const attente = apercu ? messageEnAttente(apercu.enAttente) : null;

  return (
    <div className="p-2 max-w-[1040px] text-[11.5px] flex flex-col gap-2.5">
      <section className="border border-border bg-surface px-3.5 py-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[11.5px] font-bold">Prochain export</h2>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={brouillard}
              disabled={envoi}
              onChange={(e) => setBrouillard(e.target.checked)}
            />
            Brouillard compris
          </label>
          <Aide
            titre="Export des seules modifications"
            texte="Part ce qui a changé depuis l'export précédent · les écritures jamais envoyées, celles du brouillard modifiées depuis leur envoi (elles repartent entières, marquées « remplace l'envoi n° k »), et celles du brouillard retirées depuis, nommées sur la feuille « Supprimées ». Une écriture validée ne change plus · envoyée validée, elle ne repart pas, et sa correction en négatif part comme une écriture nouvelle. Le lettrage et le pointage ne sont pas des modifications. Chaque export porte un numéro continu, sa date, son auteur et l'empreinte de son fichier, que le serveur garde. Au-delà du plafond de lignes, l'export part par lots et dit ce qui attend. Le journal de situation et l'à-nouveau provisoire ne partent jamais."
            source="AUDCIF art. 20, al. 2 ; art. 22, 1°, 2° et 7°."
          />
        </div>

        {erreurApercu && (
          <p role="alert" className="text-danger">
            {erreurApercu}
          </p>
        )}
        {!apercu && !erreurApercu && <p className="text-text-dim">Lecture de ce qui a changé…</p>}
        {apercu && (
          <>
            <p>
              <span className="font-semibold">
                {apercu.dernierNumero === null ? 'Premier export' : `Depuis l'export n° ${apercu.dernierNumero}`}
              </span>{' '}
              · {resumeApercu(apercu)}
            </p>
            {attente && <p className="text-warning">{attente}</p>}
          </>
        )}

        {peutValider ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void exporter('MODIFICATIONS')}
              disabled={envoi || !apercu || apercuVide(apercu)}
              className="bg-sel text-white font-semibold px-3 py-1.5 disabled:opacity-40"
            >
              {envoi && !confirmerComplet ? 'Export en cours…' : 'Exporter les modifications'}
            </button>
            {!confirmerComplet && (
              <button
                type="button"
                onClick={() => setConfirmerComplet(true)}
                disabled={envoi}
                className="border border-border px-3 py-1.5 hover:bg-sel-soft disabled:opacity-40"
              >
                Export complet…
              </button>
            )}
          </div>
        ) : (
          <p className="text-text-dim">Seul le comptable ou l'administrateur produit un export.</p>
        )}

        {peutValider && confirmerComplet && (
          <div className="border border-warning/40 bg-warning-soft px-3 py-2 flex flex-col gap-2">
            <p>
              L'export complet renvoie toutes les écritures{brouillard ? ', brouillard compris' : ' du livre-journal'} sous un
              nouveau numéro, et devient le point de départ des exports suivants.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void exporter('COMPLET')}
                disabled={envoi}
                className="bg-sel text-white font-semibold px-3 py-1.5 disabled:opacity-40"
              >
                {envoi ? 'Export en cours…' : "Confirmer l'export complet"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmerComplet(false)}
                disabled={envoi}
                className="border border-border px-3 py-1.5 hover:bg-sel-soft disabled:opacity-40"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {erreur && (
          <p role="alert" className="border border-danger/30 bg-danger-soft px-3 py-2">
            {erreur}
          </p>
        )}
        {resultat && (
          <p role="status" className="border border-success/30 bg-success-soft px-3 py-2">
            Export n° {resultat.numero} produit · {resultat.nombreEcritures.toLocaleString('fr-FR')} écriture
            {resultat.nombreEcritures > 1 ? 's' : ''}, {resultat.nombreSupprimees.toLocaleString('fr-FR')} retrait
            {resultat.nombreSupprimees > 1 ? 's' : ''}, {resultat.nombreLignes.toLocaleString('fr-FR')} ligne
            {resultat.nombreLignes > 1 ? 's' : ''} · empreinte <span className="break-all">{resultat.empreinte}</span>
          </p>
        )}
        {erreurTelechargement && (
          <p role="alert" className="text-danger">
            {erreurTelechargement}
          </p>
        )}
      </section>

      <section className="border border-border bg-surface">
        <h2 className="text-[11.5px] font-bold px-3.5 pt-2.5 pb-1.5">Exports produits</h2>
        {erreurListe && (
          <p role="alert" className="px-3.5 pb-2.5 text-danger">
            {erreurListe}
          </p>
        )}
        {!liste && !erreurListe && <p className="px-3.5 pb-2.5 text-text-dim">Chargement…</p>}
        {liste && liste.exports.length === 0 && <p className="px-3.5 pb-2.5 text-text-dim">Aucun export.</p>}
        {liste?.tronque && (
          <p className="px-3.5 pb-1.5 text-warning">
            Les {liste.exports.length} exports les plus récents sur {liste.total} sont affichés.
          </p>
        )}
        {liste && liste.exports.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr>
                  <th className="text-right px-2 py-1 w-[52px]">N°</th>
                  <th className="text-left px-2 py-1">Produit le</th>
                  <th className="text-left px-2 py-1">Par</th>
                  <th className="text-left px-2 py-1">Portée</th>
                  <th className="text-right px-2 py-1">Écritures</th>
                  <th className="text-right px-2 py-1">Nouvelles</th>
                  <th className="text-right px-2 py-1">Modifiées</th>
                  <th className="text-right px-2 py-1">Retraits</th>
                  <th className="text-right px-2 py-1">Lignes</th>
                  <th className="text-right px-2 py-1">En attente</th>
                  <th className="text-left px-2 py-1">Fichier</th>
                </tr>
              </thead>
              <tbody>
                {liste.exports.map((e) => (
                  <tr key={e.id}>
                    <td className="px-2 py-1 text-right">{e.numero}</td>
                    <td className="px-2 py-1">{dateHeure(e.produitAt)}</td>
                    <td className="px-2 py-1">{e.produitPar}</td>
                    <td className="px-2 py-1">
                      {porteeDeLExport(e)}
                      {e.inclureBrouillard && <div className="text-text-dim">Brouillard compris</div>}
                    </td>
                    <td className="px-2 py-1 text-right">{e.nombreEcritures.toLocaleString('fr-FR')}</td>
                    <td className="px-2 py-1 text-right">{e.nombreNouvelles.toLocaleString('fr-FR')}</td>
                    <td className="px-2 py-1 text-right">{e.nombreModifiees.toLocaleString('fr-FR')}</td>
                    <td className="px-2 py-1 text-right">{e.nombreSupprimees.toLocaleString('fr-FR')}</td>
                    <td className="px-2 py-1 text-right">{e.nombreLignes.toLocaleString('fr-FR')}</td>
                    <td className={`px-2 py-1 text-right ${e.nombreEnAttente > 0 ? 'text-warning' : ''}`}>
                      {e.nombreEnAttente.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => void retelecharger(e)}
                        className="text-sel hover:underline"
                        aria-label={`Télécharger l'export n° ${e.numero}`}
                        title={`Empreinte SHA-256 · ${e.empreinte}`}
                      >
                        Télécharger
                      </button>
                      <span className="text-text-dim"> · {tailleLisible(e.taille)}</span>
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
