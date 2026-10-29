import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { libelleListeBornee } from '../../lib/liste-bornee-personnel';
import { montant as fc } from '../../lib/montants';
import { lireNombre } from '../../lib/conditions-bancaires-saisie';

/**
 * LIGNE MICROFINA-M3, LOT 2 · QUATRE ONGLETS DE LA FENÊTRE PERSONNEL ·
 * demandes de congé et titre de congé, échéancier des contrats, plan et suivi
 * de la formation, déclaration annuelle de la main-d'œuvre. Règles et textes
 * au serveur (`suivi-personnel.ts`), rien n'est recalculé ici ; une liste non
 * lue n'est jamais dite vide. Les boutons qui écrivent suivent `peutEcrire`.
 */

type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };
const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const champ = 'border border-border bg-transparent px-1.5 py-0.5';
const nombre = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));

/**
 * Un coût tapé · lu par la règle de la saisie des conditions bancaires
 * (`lireNombre`) · « 500.000 » est AMBIGU et refusé (en RDC le point sépare
 * les milliers, et le coût partait à 500). Vide, rien ; illisible, refus nommé.
 */
function coutSaisi(v: string, objet: string): { valeur?: number } | { refus: string } {
  const lu = lireNombre(v, 'montant');
  if ('vide' in lu) return {};
  if ('illisible' in lu) return { refus: `${objet} illisible · écrivez 500 000 ou 500000,00 (le point ne sépare pas les milliers).` };
  return { valeur: lu.valeur };
}

/**
 * La lecture d'un onglet · `lire` porte son adresse écrite en clair (chaque
 * `api.get` reste lisible par `comptes-retenus-ecrans.spec.ts`), `cle` la
 * relance quand elle change ; null n'est jamais une liste vide.
 */
function useLecture<T>(lire: (() => Promise<T>) | null, cle: string) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState('');
  const relire = useCallback(() => {
    if (!lire) return;
    setErreur('');
    lire().then(setDonnees, (e: ApiError) => {
      setDonnees(null);
      setErreur(e.message);
    });
    // `lire` change à chaque rendu · la clé seule dit quand relire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  useEffect(relire, [relire]);
  return { donnees, erreur, setErreur, relire };
}

function useEnvoi(relire: () => void, setErreur: (m: string) => void) {
  const [envoi, setEnvoi] = useState(false);
  const envoyer = async (fn: () => Promise<unknown>) => {
    setErreur('');
    setEnvoi(true);
    try {
      await fn();
      relire();
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Opération refusée');
      return false;
    } finally {
      setEnvoi(false);
    }
  };
  return { envoi, envoyer };
}

const Erreur = ({ m }: { m: string }) => (m ? <div className="border border-danger/30 bg-danger-soft text-danger px-3 py-2">{m}</div> : null);

// ---- Idée 7 ------------------------------------------------------------

type Demande = {
  id: string;
  salarieId: string;
  salarie: string;
  du: string;
  au: string;
  joursVoyage: number;
  moisDePaie: string;
  demandeLe: string;
  observation: string | null;
  statut: 'DEMANDEE' | 'ACCORDEE' | 'REFUSEE' | 'RETIREE';
  congeId: string | null;
  libelleStatut: string;
  saisiePar: string;
  decisionPar: string | null;
  motifDecision: string | null;
};
type Titre = {
  salarie: string;
  matricule: string | null;
  emploi: string | null;
  du: string;
  au: string;
  joursVoyage: number;
  jours: number | null;
  demandeLe: string;
  accordeLe: string | null;
  accordePar: string | null;
  fondement: string;
};

export function OngletDemandesConge({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  const { donnees, erreur, setErreur, relire } = useLecture(
    () => api.get<{ demandes: Demande[]; total: number; tronque: boolean }>('/personnel/demandes-conge'),
    'demandes',
  );
  const { envoi, envoyer } = useEnvoi(relire, setErreur);
  const [saisie, setSaisie] = useState({ salarieId: '', du: '', au: '', joursVoyage: '', moisDePaie: '', demandeLe: '' });
  const [titre, setTitre] = useState<Titre | null>(null);
  const motif = (question: string) => {
    const m = window.prompt(question);
    return m && m.trim().length >= 3 ? m : null;
  };
  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <Erreur m={erreur} />
      <div className="font-semibold flex items-center gap-1.5">
        Demandes de congé
        <Aide
          titre="Demandes de congé"
          texte="La date du congé se fixe de commun accord. La demande du travailleur se saisit avec sa date ; un autre utilisateur du dossier l'accorde ou la refuse. L'accord pose le congé par la route ordinaire, avec ses contrôles (solde, absences, bulletins émis). Le circuit est facultatif : le congé se pose aussi directement dans l'onglet Congés. Le délai de six mois de l'article 140 court de la naissance du droit, à l'expiration de l'année de services · le compteur des congés signale les jours nés non pris six mois après, sans jamais refuser le congé."
          source="Code du travail, art. 140, al. 4 et art. 141"
        />
      </div>
      {donnees === null && !erreur && <div className="text-text-dim">Lecture des demandes…</div>}
      {donnees && donnees.demandes.length === 0 && <div className="text-text-dim">Aucune demande.</div>}
      {donnees && libelleListeBornee(donnees, donnees.demandes.length, 'demandes') && <div className="text-warning">{libelleListeBornee(donnees, donnees.demandes.length, 'demandes')}</div>}
      {donnees && donnees.demandes.length > 0 && (
        <table className="w-full" aria-label="Demandes de congé">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">Salarié</th>
              <th className="text-left px-2 py-1">Congé</th>
              <th className="text-left px-2 py-1">Demandé le</th>
              <th className="text-left px-2 py-1">État</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {donnees.demandes.map((d) => (
              <tr key={d.id}>
                <td className="px-2 py-1">{d.salarie}</td>
                <td className="px-2 py-1">
                  du {d.du} au {d.au}
                  {d.joursVoyage ? ` · ${d.joursVoyage} j de voyage` : ''} · paie {d.moisDePaie}
                </td>
                <td className="px-2 py-1">{d.demandeLe}</td>
                <td className="px-2 py-1">
                  {d.libelleStatut}
                  {d.decisionPar ? <span className="text-text-dim"> · {d.decisionPar}</span> : null}
                  {d.motifDecision ? <span className="text-text-dim"> · {d.motifDecision}</span> : null}
                </td>
                <td className="px-2 py-1 text-right space-x-2">
                  {peutEcrire && d.statut === 'DEMANDEE' && (
                    <>
                      <button type="button" className="hover:underline" disabled={envoi} onClick={() => envoyer(() => api.post(`/personnel/demandes-conge/${d.id}/accord`, {}))}>
                        Accorder
                      </button>
                      <button
                        type="button"
                        className="hover:underline"
                        disabled={envoi}
                        onClick={() => {
                          const m = motif('Motif du refus');
                          if (m) void envoyer(() => api.post(`/personnel/demandes-conge/${d.id}/refus`, { motif: m }));
                        }}
                      >
                        Refuser
                      </button>
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        disabled={envoi}
                        onClick={() => {
                          const m = motif('Motif du retrait');
                          if (m) void envoyer(() => api.post(`/personnel/demandes-conge/${d.id}/retrait`, { motif: m }));
                        }}
                      >
                        Retirer
                      </button>
                    </>
                  )}
                  {peutEcrire && d.statut === 'ACCORDEE' && !d.congeId && (
                    <>
                      <span className="text-danger">accordée sans congé lié</span>
                      <button
                        type="button"
                        className="hover:underline"
                        disabled={envoi}
                        onClick={() => {
                          const congeId = window.prompt('Identifiant du congé posé pour cette demande (onglet Congés)');
                          const m = congeId ? motif('Motif du rattachement') : null;
                          if (congeId && m) void envoyer(() => api.post(`/personnel/demandes-conge/${d.id}/reparation`, { action: 'RELIER', congeId: congeId.trim(), motif: m }));
                        }}
                      >
                        Relier au congé
                      </button>
                      <button
                        type="button"
                        className="hover:underline"
                        disabled={envoi}
                        onClick={() => {
                          const m = motif('Motif de la remise en attente');
                          if (m) void envoyer(() => api.post(`/personnel/demandes-conge/${d.id}/reparation`, { action: 'REMETTRE_EN_ATTENTE', motif: m }));
                        }}
                      >
                        Remettre en attente
                      </button>
                    </>
                  )}
                  {d.statut === 'ACCORDEE' && d.congeId && (
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() =>
                        api.get<Titre>(`/personnel/demandes-conge/${d.id}/titre`).then(setTitre, (e: ApiError) => setErreur(e.message))
                      }
                    >
                      Titre de congé
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {titre && (
        <div className="border border-border px-4 py-3 space-y-1" aria-label="Titre de congé">
          <div className="font-semibold">Titre de congé</div>
          <div>
            {titre.salarie}
            {titre.matricule ? ` · matricule ${titre.matricule}` : ''}
            {titre.emploi ? ` · ${titre.emploi}` : ''}
          </div>
          <div>
            Congé du {titre.du} au {titre.au} inclus · {titre.jours === null ? 'jours non chiffrés' : `${titre.jours} jour(s) ouvrable(s)`}
            {titre.joursVoyage ? `, plus ${titre.joursVoyage} jour(s) de voyage` : ''}
          </div>
          <div>
            Date fixée de commun accord · demande du travailleur du {titre.demandeLe}, accord du {titre.accordeLe ?? '·'}
            {titre.accordePar ? ` (${titre.accordePar})` : ''}
          </div>
          <div className="text-text-dim">{titre.fondement}</div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => window.print()} className="bg-sel text-white font-semibold px-3 py-1">
              Imprimer le titre
            </button>
            <button type="button" onClick={() => setTitre(null)} className="border border-border px-3 py-1">
              Fermer
            </button>
          </div>
        </div>
      )}
      {peutEcrire && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <select aria-label="Salarié qui demande" value={saisie.salarieId} onChange={(e) => setSaisie({ ...saisie, salarieId: e.target.value })} className={champ}>
            <option value="">Salarié…</option>
            {salaries.map((s) => (
              <option key={s.id} value={s.id}>
                {nomDe(s)}
              </option>
            ))}
          </select>
          <input aria-label="Premier jour demandé" type="date" value={saisie.du} onChange={(e) => setSaisie({ ...saisie, du: e.target.value })} className={champ} />
          <input aria-label="Dernier jour demandé" type="date" value={saisie.au} onChange={(e) => setSaisie({ ...saisie, au: e.target.value })} className={champ} />
          <input aria-label="Jours de voyage" placeholder="Voyage (j)" value={saisie.joursVoyage} onChange={(e) => setSaisie({ ...saisie, joursVoyage: e.target.value })} className={`${champ} w-[80px] text-right`} />
          <input aria-label="Mois de paie de l'allocation" type="month" value={saisie.moisDePaie} onChange={(e) => setSaisie({ ...saisie, moisDePaie: e.target.value })} className={champ} />
          <input aria-label="Date de la demande" type="date" value={saisie.demandeLe} onChange={(e) => setSaisie({ ...saisie, demandeLe: e.target.value })} className={champ} />
          <button
            type="button"
            className="bg-sel text-white font-semibold px-3 py-1"
            disabled={envoi || !saisie.salarieId}
            onClick={async () => {
              const ok = await envoyer(() =>
                api.post(`/personnel/salaries/${saisie.salarieId}/demandes-conge`, {
                  du: saisie.du,
                  au: saisie.au,
                  moisDePaie: saisie.moisDePaie,
                  demandeLe: saisie.demandeLe,
                  ...(saisie.joursVoyage.trim() ? { joursVoyage: nombre(saisie.joursVoyage) } : {}),
                }),
              );
              if (ok) setSaisie((s) => ({ ...s, du: '', au: '', joursVoyage: '' }));
            }}
          >
            Enregistrer la demande
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Idée 10 -----------------------------------------------------------

type Echeance = { contratId: string; salarie: string; objet: 'FIN_CDD' | 'FIN_ESSAI'; echeance: string; joursRestants: number; depassee: boolean; article: string; consequence: string };

export function OngletEcheancierContrats() {
  const { donnees, erreur } = useLecture(
    () => api.get<{ aujourdhui: string; horizonJours: number; echeances: Echeance[]; total: number; tronque: boolean; contratsLus: number }>('/personnel/echeancier-contrats'),
    'echeances',
  );
  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <Erreur m={erreur} />
      <div className="font-semibold flex items-center gap-1.5">
        Fins de contrat et de période d&apos;essai
        <Aide
          titre="Échéancier des contrats"
          texte="Les contrats en cours dont le terme ou la fin d'essai tombe dans les soixante jours, ou est passé. Un contrat à durée déterminée prend fin au terme fixé ; conclu pour un emploi permanent, il est réputé à durée indéterminée. La prolongation des services au-delà de la durée maximale de l'essai confirme le contrat. Le plafond de l'essai se compte de date à date. L'échéancier ne termine ni ne requalifie aucun contrat."
          source="Code du travail, art. 42, 43 et 69"
        />
      </div>
      {donnees === null && !erreur && <div className="text-text-dim">Lecture des contrats…</div>}
      {donnees && donnees.tronque && <div className="text-warning">Liste tronquée · {donnees.contratsLus} contrats lus sur {donnees.total}.</div>}
      {donnees && donnees.echeances.length === 0 && <div className="text-text-dim">Aucune échéance d&apos;ici {donnees.horizonJours} jours.</div>}
      {donnees && donnees.echeances.length > 0 && (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">Salarié</th>
              <th className="text-left px-2 py-1">Échéance</th>
              <th className="text-left px-2 py-1">Date</th>
              <th className="text-left px-2 py-1">Conséquence</th>
            </tr>
          </thead>
          <tbody>
            {donnees.echeances.map((e) => (
              <tr key={`${e.contratId}-${e.objet}`} className={e.depassee ? 'text-danger' : undefined}>
                <td className="px-2 py-1">{e.salarie}</td>
                <td className="px-2 py-1">{e.objet === 'FIN_CDD' ? 'Terme du contrat' : "Fin de l'essai"}</td>
                <td className="px-2 py-1">
                  {e.echeance} · {e.depassee ? `passée de ${-e.joursRestants} j` : `dans ${e.joursRestants} j`}
                </td>
                <td className="px-2 py-1" title={e.article}>
                  {e.consequence}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---- Idée 8 ------------------------------------------------------------

type Formation = {
  id: string;
  intitule: string;
  organisme: string | null;
  interne: boolean;
  lieu: string | null;
  financement: string | null;
  prevueDu: string;
  prevueAu: string;
  coutPrevuFc: number | null;
  statut: 'PREVUE' | 'REALISEE' | 'ANNULEE';
  realiseeDu: string | null;
  realiseeAu: string | null;
  coutReelFc: number | null;
  motifAnnulation: string | null;
  participants: { salarieId: string; nom: string; present: boolean | null }[];
};
type Suivi = { prevues: number; realisees: number; annulees: number; coutPrevuFc: number; coutPrevuIncomplet: boolean; coutReelFc: number; coutReelIncomplet: boolean; inscrits: number; presents: number };

export function OngletFormation({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const { donnees, erreur, setErreur, relire } = useLecture(
    /^\d{4}$/.test(annee) ? () => api.get<{ formations: Formation[]; suivi: Suivi; total: number; tronque: boolean }>(`/personnel/formations?annee=${annee}`) : null,
    `formations-${annee}`,
  );
  const { envoi, envoyer } = useEnvoi(relire, setErreur);
  const [f, setF] = useState({ intitule: '', organisme: '', interne: false, prevueDu: '', prevueAu: '', coutPrevuFc: '', financement: '', participants: [] as string[] });
  const [realisation, setRealisation] = useState<Record<string, { du: string; au: string; cout: string; presents: string[] }>>({});
  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <Erreur m={erreur} />
      <div className="font-semibold flex items-center gap-1.5">
        Plan de formation
        <input aria-label="Année du plan" value={annee} onChange={(e) => setAnnee(e.target.value)} className={`${champ} w-[60px] font-normal`} />
        <Aide
          titre="Plan et suivi de la formation"
          texte="L'employeur a l'obligation d'assurer la formation, le perfectionnement ou l'adaptation professionnelle de ses travailleurs. Le plan tient le prévu et le réalisé, les inscrits et les présents ; le coût se passe par la facture au 633. Une formation assurée par l'employeur lui-même peut fonder une demande de réduction du taux de l'INPP, au plus du quart, accordée par le ministère du Travail sur avis de la délégation syndicale et de l'INPP : la réduction accordée se déclare au bulletin avec la référence de son acte, jamais déduite de ce plan."
          source="Code du travail, art. 8 · ordonnance n° 84/186, art. 1er, al. 2"
        />
      </div>
      {donnees === null && !erreur && <div className="text-text-dim">Lecture du plan…</div>}
      {donnees && (
        <div className="border border-border px-3 py-2">
          {donnees.suivi.prevues} formation(s) retenue(s), {donnees.suivi.realisees} réalisée(s), {donnees.suivi.annulees} annulée(s) · coût prévu {fc(donnees.suivi.coutPrevuFc)} FC
          {donnees.suivi.coutPrevuIncomplet ? ' (au moins un coût prévu non renseigné)' : ''} · coût réel {fc(donnees.suivi.coutReelFc)} FC
          {donnees.suivi.coutReelIncomplet ? ' (au moins un coût réel non renseigné)' : ''} · {donnees.suivi.inscrits} inscrit(s), {donnees.suivi.presents} présent(s)
          {donnees.tronque ? ` · liste tronquée, ${donnees.formations.length} sur ${donnees.total}` : ''}
        </div>
      )}
      {donnees && donnees.formations.length === 0 && <div className="text-text-dim">Aucune formation pour {annee}.</div>}
      {donnees?.formations.map((x) => {
        const r = realisation[x.id] ?? { du: x.prevueDu, au: x.prevueAu, cout: '', presents: x.participants.map((p) => p.salarieId) };
        return (
          <div key={x.id} className="border border-border px-3 py-2">
            <div className="flex flex-wrap gap-x-3">
              <span className="font-semibold">{x.intitule}</span>
              <span>{x.interne ? 'interne' : x.organisme ?? 'organisme non renseigné'}</span>
              <span className="text-text-dim">
                prévue du {x.prevueDu} au {x.prevueAu} · {x.coutPrevuFc === null ? 'coût non renseigné' : `${fc(x.coutPrevuFc)} FC`}
                {x.financement ? ` · ${x.financement}` : ''}
              </span>
              {x.statut === 'REALISEE' && (
                <span>
                  réalisée du {x.realiseeDu} au {x.realiseeAu} · {x.coutReelFc === null ? 'coût réel non renseigné' : `${fc(x.coutReelFc)} FC`}
                </span>
              )}
              {x.statut === 'ANNULEE' && <span className="text-danger">annulée · {x.motifAnnulation}</span>}
            </div>
            <div className="text-text-dim">
              {x.participants.length === 0
                ? 'Aucun inscrit.'
                : x.participants.map((p) => `${p.nom}${p.present === true ? ' (présent)' : p.present === false ? ' (absent)' : ''}`).join(' · ')}
            </div>
            {peutEcrire && x.statut === 'PREVUE' && (
              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                <input aria-label={`Début réel de ${x.intitule}`} type="date" value={r.du} onChange={(e) => setRealisation({ ...realisation, [x.id]: { ...r, du: e.target.value } })} className={champ} />
                <input aria-label={`Fin réelle de ${x.intitule}`} type="date" value={r.au} onChange={(e) => setRealisation({ ...realisation, [x.id]: { ...r, au: e.target.value } })} className={champ} />
                <input aria-label={`Coût réel de ${x.intitule}`} placeholder="Coût réel FC" value={r.cout} onChange={(e) => setRealisation({ ...realisation, [x.id]: { ...r, cout: e.target.value } })} className={`${champ} w-[110px] text-right`} />
                {x.participants.map((p) => (
                  <label key={p.salarieId} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={r.presents.includes(p.salarieId)}
                      onChange={(e) =>
                        setRealisation({
                          ...realisation,
                          [x.id]: { ...r, presents: e.target.checked ? [...r.presents, p.salarieId] : r.presents.filter((s) => s !== p.salarieId) },
                        })
                      }
                    />
                    {p.nom}
                  </label>
                ))}
                <button
                  type="button"
                  className="hover:underline"
                  disabled={envoi}
                  onClick={() => {
                    const cout = coutSaisi(r.cout, 'Coût réel');
                    if ('refus' in cout) return setErreur(cout.refus);
                    void envoyer(() =>
                      api.post(`/personnel/formations/${x.id}/realisation`, {
                        realiseeDu: r.du,
                        realiseeAu: r.au,
                        presents: r.presents,
                        ...(cout.valeur !== undefined ? { coutReelFc: cout.valeur } : {}),
                      }),
                    );
                  }}
                >
                  Constater la réalisation
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline ml-auto"
                  disabled={envoi}
                  onClick={() => {
                    const m = window.prompt("Motif de l'annulation");
                    if (m && m.trim().length >= 3) void envoyer(() => api.post(`/personnel/formations/${x.id}/annulation`, { motif: m }));
                  }}
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        );
      })}
      {peutEcrire && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <input aria-label="Intitulé de la formation" placeholder="Intitulé" value={f.intitule} onChange={(e) => setF({ ...f, intitule: e.target.value })} className={`${champ} w-[180px]`} />
          <input aria-label="Organisme de formation" placeholder="Organisme" value={f.organisme} onChange={(e) => setF({ ...f, organisme: e.target.value })} className={`${champ} w-[140px]`} />
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={f.interne} onChange={(e) => setF({ ...f, interne: e.target.checked })} />
            Assurée par l&apos;employeur
          </label>
          <input aria-label="Début prévu" type="date" value={f.prevueDu} onChange={(e) => setF({ ...f, prevueDu: e.target.value })} className={champ} />
          <input aria-label="Fin prévue" type="date" value={f.prevueAu} onChange={(e) => setF({ ...f, prevueAu: e.target.value })} className={champ} />
          <input aria-label="Coût prévu" placeholder="Coût prévu FC" value={f.coutPrevuFc} onChange={(e) => setF({ ...f, coutPrevuFc: e.target.value })} className={`${champ} w-[110px] text-right`} />
          <input aria-label="Financement" placeholder="Financement" value={f.financement} onChange={(e) => setF({ ...f, financement: e.target.value })} className={`${champ} w-[120px]`} />
          <select
            aria-label="Participants"
            multiple
            value={f.participants}
            onChange={(e) => setF({ ...f, participants: Array.from(e.target.selectedOptions).map((o) => o.value) })}
            className={`${champ} h-[52px]`}
          >
            {salaries.map((s) => (
              <option key={s.id} value={s.id}>
                {nomDe(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="bg-sel text-white font-semibold px-3 py-1"
            disabled={envoi || !f.intitule.trim()}
            onClick={async () => {
              const cout = coutSaisi(f.coutPrevuFc, 'Coût prévu');
              if ('refus' in cout) return setErreur(cout.refus);
              const ok = await envoyer(() =>
                api.post('/personnel/formations', {
                  intitule: f.intitule,
                  prevueDu: f.prevueDu,
                  prevueAu: f.prevueAu,
                  interne: f.interne,
                  participants: f.participants,
                  ...(f.organisme.trim() ? { organisme: f.organisme } : {}),
                  ...(f.financement.trim() ? { financement: f.financement } : {}),
                  ...(cout.valeur !== undefined ? { coutPrevuFc: cout.valeur } : {}),
                }),
              );
              if (ok) setF({ intitule: '', organisme: '', interne: false, prevueDu: '', prevueAu: '', coutPrevuFc: '', financement: '', participants: [] });
            }}
          >
            Prévoir la formation
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Idée 11 -----------------------------------------------------------

type Declaration = {
  annee: number;
  au: string;
  effectif: number;
  hommes: { nationaux: number | null; etrangers: number | null };
  femmes: { nationaux: number | null; etrangers: number | null };
  sexeNonRenseigne: number;
  sansNationalite: number;
  entrees: number;
  sorties: number;
  regleMouvements?: string;
  destinataires: string;
  reserve: string;
  reserveNationalite: string | null;
  dateLimite: string;
};

export function OngletDeclarationMainOeuvre() {
  const [annee, setAnnee] = useState(String(new Date().getFullYear() - 1));
  const { donnees, erreur } = useLecture(
    /^\d{4}$/.test(annee) ? () => api.get<Declaration>(`/personnel/declaration-main-oeuvre/${annee}`) : null,
    `declaration-${annee}`,
  );
  const n = (v: number | null) => (v === null ? 'non calculé' : String(v));
  return (
    <div className="ecran-seul max-w-[900px] text-[11.5px] space-y-3">
      <Erreur m={erreur} />
      <div className="font-semibold flex items-center gap-1.5">
        Déclaration de la main-d&apos;œuvre
        <input aria-label="Année déclarée" value={annee} onChange={(e) => setAnnee(e.target.value)} className={`${champ} w-[60px] font-normal`} />
        <Aide
          titre="Déclaration annuelle de la main-d'œuvre"
          texte="Toute entreprise fait parvenir chaque année, au plus tard le 31 janvier, à l'Inspection du travail et à l'Office national de l'emploi, une déclaration de la situation de la main-d'œuvre nationale et étrangère qu'elle emploie, en quatre exemplaires sur le formulaire officiel. Le formulaire compte le personnel permanent au 1er janvier. OmegaX en sert les chiffres de l'effectif tirés du registre ; le reste du formulaire et le bilan social ne sont pas servis."
          source="Code du travail, art. 218 et 219 ; arrêté ministériel n° 005/CAB/PVPM/ETPS/2010 du 1er avril 2010, art. 1er et 2"
        />
      </div>
      {donnees === null && !erreur && <div className="text-text-dim">Lecture du registre…</div>}
      {donnees && (
        <>
          <div className="text-warning">{donnees.reserve}</div>
          {donnees.reserveNationalite && <div className="text-warning">{donnees.reserveNationalite}</div>}
          <table className="w-full" aria-label="Main-d'œuvre au 1er janvier">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Au {donnees.au}</th>
                <th className="text-right px-2 py-1">Nationaux</th>
                <th className="text-right px-2 py-1">Étrangers</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1">Hommes</td>
                <td className="px-2 py-1 text-right">{n(donnees.hommes.nationaux)}</td>
                <td className="px-2 py-1 text-right">{n(donnees.hommes.etrangers)}</td>
              </tr>
              <tr>
                <td className="px-2 py-1">Femmes</td>
                <td className="px-2 py-1 text-right">{n(donnees.femmes.nationaux)}</td>
                <td className="px-2 py-1 text-right">{n(donnees.femmes.etrangers)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="px-2 py-1">Effectif</td>
                <td colSpan={2} className="px-2 py-1 text-right">
                  {donnees.effectif}
                </td>
              </tr>
            </tbody>
          </table>
          <div>
            Entrées de l&apos;année {donnees.entrees} · sorties {donnees.sorties}
            {donnees.regleMouvements && (
              <>
                {' '}
                <Aide titre="Entrées et sorties" texte={donnees.regleMouvements} source="Code du travail, art. 217 et 218" />
              </>
            )}
            {donnees.sexeNonRenseigne ? ` · ${donnees.sexeNonRenseigne} salarié(s) sans sexe renseigné` : ''}
          </div>
          <div>Au plus tard le {donnees.dateLimite}.</div>
          <div className="text-text-dim">À adresser {donnees.destinataires}</div>
        </>
      )}
    </div>
  );
}
