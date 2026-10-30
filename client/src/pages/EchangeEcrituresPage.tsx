import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { issueIncertaine, messageOuDefaut } from '../lib/message-refus';
import {
  LIBELLE_ETAT_RECUE,
  lireEnBase64,
  resumeReception,
  type CompteRenduReception,
  type EtatEcritureRecue,
  type ListeReceptions,
  type ListeRecues,
} from '../lib/echange-ecritures';

/**
 * ÉCHANGER DES ÉCRITURES · Fichier > Échanger des écritures (ligne
 * dossier-l9, fonction 102 ; Sage, écritures échangées avec l'expert-comptable).
 *
 * Le dossier relit l'export des modifications d'un AUTRE dossier OmegaX ·
 * chaque écriture y naît, y est remplacée ou retirée AU BROUILLARD par son
 * identifiant d'origine, jamais deux fois, et jugée par les règles de l'import
 * des écritures. L'aperçu dit le sort de chaque pièce avant toute écriture.
 * Recevoir et détacher sont des actes du comptable (`peutValider`, comme
 * `@ReserveAuComptable` au serveur) ; les listes se lisent par tous.
 */

function dateHeure(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function CompteRendu({ r }: { r: CompteRenduReception }) {
  return (
    <div className={`border px-3 py-2 flex flex-col gap-1.5 ${r.simulation ? 'border-border' : 'border-success/30 bg-success-soft'}`} role="status">
      <p>
        <span className="font-semibold">
          {r.simulation ? 'Aperçu' : 'Reçu'} · envoi n° {r.numeroExport} de « {r.dossierSource} »
        </span>{' '}
        · {resumeReception(r)}
      </p>
      {r.avertissements.map((a) => (
        <p key={a} className="text-warning">
          {a}
        </p>
      ))}
      {r.pieces.length > 0 && (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 w-[220px]">Pièce de l'envoi</th>
              <th className="text-left px-2 py-1">Sort</th>
            </tr>
          </thead>
          <tbody>
            {r.pieces.map((p, i) => (
              <tr key={`${p.piece}-${i}`}>
                <td className="px-2 py-1">{p.piece}</td>
                <td className={`px-2 py-1 ${p.refus ? 'text-danger' : ''}`}>{p.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {r.tronque && (
        <p className="text-warning">
          {r.pieces.length} pièces nommées sur {r.piecesTotal} · le compte rendu complet est gardé avec la réception.
        </p>
      )}
    </div>
  );
}

export function EchangeEcrituresPage() {
  const { peutValider } = useAuth();
  const [fichier, setFichier] = useState<{ nom: string; base64: string } | null>(null);
  const [apercu, setApercu] = useState<CompteRenduReception | null>(null);
  const [resultat, setResultat] = useState<CompteRenduReception | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [liste, setListe] = useState<ListeReceptions | null>(null);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const [etat, setEtat] = useState<EtatEcritureRecue | ''>('TENUE');
  const [recues, setRecues] = useState<ListeRecues | null>(null);
  const [erreurRecues, setErreurRecues] = useState<string | null>(null);
  const [erreurDetacher, setErreurDetacher] = useState<string | null>(null);
  // Une réponse périmée (filtre changé avant la réponse) est jetée.
  const jetonRecues = useRef(0);

  const chargerListe = useCallback(async () => {
    setErreurListe(null);
    try {
      setListe(await api.get<ListeReceptions>('/echanges-ecritures'));
    } catch (e) {
      setErreurListe(messageOuDefaut(e, "La liste des réceptions n'a pas pu être lue."));
    }
  }, []);

  const chargerRecues = useCallback(async (filtre: EtatEcritureRecue | '') => {
    const mien = ++jetonRecues.current;
    setRecues(null);
    setErreurRecues(null);
    try {
      const r = await api.get<ListeRecues>(`/echanges-ecritures/recues${filtre ? `?etat=${filtre}` : ''}`);
      if (mien === jetonRecues.current) setRecues(r);
    } catch (e) {
      if (mien === jetonRecues.current) setErreurRecues(messageOuDefaut(e, "Les écritures reçues n'ont pas pu être lues."));
    }
  }, []);

  useEffect(() => {
    void chargerListe();
  }, [chargerListe]);
  useEffect(() => {
    void chargerRecues(etat);
  }, [etat, chargerRecues]);

  async function choisir(f: File | undefined) {
    setApercu(null);
    setResultat(null);
    setErreur(null);
    if (!f) {
      setFichier(null);
      return;
    }
    try {
      setFichier({ nom: f.name, base64: await lireEnBase64(f) });
    } catch (e) {
      setFichier(null);
      setErreur(messageOuDefaut(e, "Le fichier n'a pas pu être lu."));
    }
  }

  async function lancer(simulation: boolean) {
    if (!fichier) return;
    setEnvoi(true);
    setErreur(null);
    if (!simulation) setResultat(null);
    try {
      const r = await api.post<CompteRenduReception>(simulation ? '/echanges-ecritures/apercu' : '/echanges-ecritures', {
        nomFichier: fichier.nom,
        contenuBase64: fichier.base64,
      });
      if (simulation) setApercu(r);
      else {
        setResultat(r);
        setApercu(null);
      }
    } catch (e) {
      const m = messageOuDefaut(e, simulation ? "L'aperçu n'a pas abouti." : "La réception n'a pas abouti.");
      // Une panne du réseau ne dit pas si la réception a eu lieu · la liste le dira.
      setErreur(!simulation && issueIncertaine(e) ? `${m} · la réception a pu avoir lieu, vérifiez la liste avant de relancer.` : m);
    } finally {
      setEnvoi(false);
      if (!simulation) {
        void chargerListe();
        void chargerRecues(etat);
      }
    }
  }

  async function detacher(id: string) {
    setErreurDetacher(null);
    try {
      await api.post(`/echanges-ecritures/recues/${id}/detacher`, {});
      void chargerRecues(etat);
    } catch (e) {
      setErreurDetacher(messageOuDefaut(e, "L'écriture n'a pas pu être détachée."));
    }
  }

  return (
    <div className="p-2 max-w-[1040px] text-[11.5px] flex flex-col gap-2.5">
      <section className="border border-border bg-surface px-3.5 py-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[11.5px] font-bold">Recevoir un envoi</h2>
          <Aide
            titre="Échange d'écritures"
            texte="Le fichier est l'export des modifications d'un autre dossier OmegaX (Fichier > Exporter les modifications, chez l'expéditeur). Chaque écriture y est reconnue par son identifiant d'origine · jamais reçue, elle naît au brouillard ; reçue et changée chez l'expéditeur, elle est remplacée au brouillard ; retirée chez lui, elle est retirée ici. Une écriture déjà reçue ne se crée jamais deux fois, et un envoi plus ancien ne remplace pas un contenu plus récent. Chaque écriture est jugée comme l'import des écritures la juge (compte, journal, exercice ouvert, équilibre, contrôles de la saisie) · une pièce refusée est nommée sans emporter les autres. Ce dossier valide lui-même ce qu'il reçoit · une écriture validée ici ne se remplace plus, sa correction passe par une inscription en négatif. « Détacher » reprend une écriture reçue à son compte · les envois suivants ne la touchent plus. Ni l'analytique, ni le lettrage, ni les pièces jointes ne voyagent, et une écriture reçue ne repart pas par l'export de ce dossier. Le même fichier ne se relit pas deux fois."
            source="AUDCIF art. 20, al. 2 ; art. 22, 1°, 2° et 7°."
          />
        </div>
        {peutValider ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label="Fichier de l'envoi"
                disabled={envoi}
                onChange={(e) => void choisir(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => void lancer(true)}
                disabled={!fichier || envoi}
                className="border border-border px-3 py-1.5 hover:bg-sel-soft disabled:opacity-40"
              >
                Aperçu
              </button>
              <button
                type="button"
                onClick={() => void lancer(false)}
                disabled={!fichier || envoi || !apercu}
                title={!apercu ? "Lancez d'abord l'aperçu" : undefined}
                className="bg-sel text-white font-semibold px-3 py-1.5 disabled:opacity-40"
              >
                {envoi ? 'Réception en cours…' : 'Recevoir'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-text-dim">Seul le comptable ou l'administrateur reçoit un envoi.</p>
        )}
        {erreur && (
          <p role="alert" className="border border-danger/30 bg-danger-soft px-3 py-2">
            {erreur}
          </p>
        )}
        {apercu && <CompteRendu r={apercu} />}
        {resultat && <CompteRendu r={resultat} />}
      </section>

      <section className="border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 px-3.5 pt-2.5 pb-1.5">
          <h2 className="text-[11.5px] font-bold">Écritures reçues</h2>
          <label className="inline-flex items-center gap-1.5">
            État
            <select value={etat} onChange={(e) => setEtat(e.target.value as EtatEcritureRecue | '')} className="border border-border px-1 py-0.5">
              <option value="TENUE">{LIBELLE_ETAT_RECUE.TENUE}</option>
              <option value="DETACHEE">{LIBELLE_ETAT_RECUE.DETACHEE}</option>
              <option value="RETIREE_PAR_LA_SOURCE">{LIBELLE_ETAT_RECUE.RETIREE_PAR_LA_SOURCE}</option>
              <option value="">Toutes</option>
            </select>
          </label>
        </div>
        {erreurRecues && (
          <p role="alert" className="px-3.5 pb-2.5 text-danger">
            {erreurRecues}
          </p>
        )}
        {erreurDetacher && (
          <p role="alert" className="px-3.5 pb-2.5 text-danger">
            {erreurDetacher}
          </p>
        )}
        {!recues && !erreurRecues && <p className="px-3.5 pb-2.5 text-text-dim">Chargement…</p>}
        {recues && recues.recues.length === 0 && <p className="px-3.5 pb-2.5 text-text-dim">Aucune écriture reçue dans cet état.</p>}
        {recues?.tronque && (
          <p className="px-3.5 pb-1.5 text-warning">
            Les {recues.recues.length} plus récentes sur {recues.total} sont affichées.
          </p>
        )}
        {recues && recues.recues.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Reçue le</th>
                  <th className="text-left px-2 py-1">Journal</th>
                  <th className="text-right px-2 py-1">Pièce</th>
                  <th className="text-left px-2 py-1">Date</th>
                  <th className="text-left px-2 py-1">Libellé</th>
                  <th className="text-left px-2 py-1">Statut</th>
                  <th className="text-left px-2 py-1">État</th>
                  <th className="text-right px-2 py-1">Envoi n°</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {recues.recues.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1">{dateHeure(r.recueLe)}</td>
                    <td className="px-2 py-1">{r.ecriture?.journal.code ?? '·'}</td>
                    <td className="px-2 py-1 text-right">{r.ecriture?.numeroPiece ?? '·'}</td>
                    <td className="px-2 py-1">{r.ecriture ? new Date(r.ecriture.date).toLocaleDateString('fr-FR') : '·'}</td>
                    <td className="px-2 py-1">{r.ecriture?.libelle ?? (r.etat === 'DETACHEE' ? 'Détachée, à lire au journal' : '·')}</td>
                    <td className="px-2 py-1">{r.ecriture ? (r.ecriture.statut === 'VALIDEE' ? 'Validée' : 'Brouillard') : '·'}</td>
                    <td className="px-2 py-1">{LIBELLE_ETAT_RECUE[r.etat]}</td>
                    <td className="px-2 py-1 text-right">{r.numeroExportSource}</td>
                    <td className="px-2 py-1 text-right">
                      {peutValider && r.etat === 'TENUE' && r.ecritureId && (
                        <button type="button" onClick={() => void detacher(r.id)} className="border border-border px-2 py-0.5 hover:bg-sel-soft">
                          Détacher
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-border bg-surface">
        <h2 className="text-[11.5px] font-bold px-3.5 pt-2.5 pb-1.5">Envois reçus</h2>
        {erreurListe && (
          <p role="alert" className="px-3.5 pb-2.5 text-danger">
            {erreurListe}
          </p>
        )}
        {!liste && !erreurListe && <p className="px-3.5 pb-2.5 text-text-dim">Chargement…</p>}
        {liste && liste.receptions.length === 0 && <p className="px-3.5 pb-2.5 text-text-dim">Aucun envoi reçu.</p>}
        {liste?.tronque && (
          <p className="px-3.5 pb-1.5 text-warning">
            Les {liste.receptions.length} réceptions les plus récentes sur {liste.total} sont affichées.
          </p>
        )}
        {liste && liste.receptions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Reçu le</th>
                  <th className="text-left px-2 py-1">Par</th>
                  <th className="text-left px-2 py-1">Dossier expéditeur</th>
                  <th className="text-right px-2 py-1">Envoi n°</th>
                  <th className="text-right px-2 py-1">Créées</th>
                  <th className="text-right px-2 py-1">Remplacées</th>
                  <th className="text-right px-2 py-1">Retirées</th>
                  <th className="text-right px-2 py-1">Refusées</th>
                  <th className="text-left px-2 py-1">État</th>
                </tr>
              </thead>
              <tbody>
                {liste.receptions.map((r) => (
                  <tr key={r.id} title={`${r.nomFichier} · empreinte ${r.empreinteFichier}`}>
                    <td className="px-2 py-1">{dateHeure(r.recuLe)}</td>
                    <td className="px-2 py-1">{r.recuPar}</td>
                    <td className="px-2 py-1">{r.dossierSource}</td>
                    <td className="px-2 py-1 text-right">{r.numeroExportSource}</td>
                    <td className="px-2 py-1 text-right">{r.nombreCreees}</td>
                    <td className="px-2 py-1 text-right">{r.nombreModifiees}</td>
                    <td className="px-2 py-1 text-right">{r.nombreRetirees}</td>
                    <td className={`px-2 py-1 text-right ${r.nombreRefusees > 0 ? 'text-danger' : ''}`}>{r.nombreRefusees}</td>
                    <td className="px-2 py-1">{r.etat === 'TERMINEE' ? 'Terminée' : 'Interrompue, à reprendre'}</td>
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
