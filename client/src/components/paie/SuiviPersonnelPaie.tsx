import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { libelleListeBornee } from '../../lib/liste-bornee-personnel';
import { montant as fc } from '../../lib/montants';
import { lireNombre } from '../../lib/conditions-bancaires-saisie';
import { imprimerLeFormulaire } from '../../lib/impression-formulaire';
import { saisieAEnvoyer, type LigneEditee, type MonnaieBilan } from '../../lib/bilan-social';
import { useGardeFermeture } from '../../lib/fenetres';

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
export function useLecture<T>(lire: (() => Promise<T>) | null, cle: string) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState('');
  // Une lecture par jeton · la réponse d'une clé dépassée est jetée, et une
  // clé nouvelle vide d'abord ce que l'ancienne avait servi (relecture DASMO,
  // le formulaire de 2025 restait affiché, et imprimable, sous « 2026 »).
  const jeton = useRef(0);
  const derniereCle = useRef<string | null>(null);
  const relire = useCallback(() => {
    const n = ++jeton.current;
    if (derniereCle.current !== cle) {
      derniereCle.current = cle;
      setDonnees(null);
    }
    if (!lire) return;
    setErreur('');
    lire().then(
      (d) => { if (n === jeton.current) setDonnees(d); },
      (e: ApiError) => {
        if (n !== jeton.current) return;
        setDonnees(null);
        setErreur(e.message);
      },
    );
    // `lire` change à chaque rendu · la clé seule dit quand relire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  useEffect(relire, [relire]);
  /** La réponse d'un enregistrement prend la place de la lecture, sans relire · et jette toute lecture en vol. */
  const remplacer = useCallback((d: T) => {
    jeton.current += 1;
    setDonnees(d);
  }, []);
  return { donnees, erreur, setErreur, relire, remplacer };
}

export function useEnvoi(relire: () => void, setErreur: (m: string) => void) {
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

export const Erreur = ({ m }: { m: string }) => (m ? <div className="border border-danger/30 bg-danger-soft text-danger px-3 py-2">{m}</div> : null);

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

type Echeance = { contratId: string; salarie: string; objet: 'FIN_CDD' | 'FIN_ESSAI' | 'PLAFOND_ARTICLE_41'; echeance: string; joursRestants: number; depassee: boolean; article: string; consequence: string };

export function OngletEcheancierContrats() {
  const { donnees, erreur } = useLecture(
    () => api.get<{ aujourdhui: string; horizonJours: number; echeances: Echeance[]; total: number; tronque: boolean; contratsLus: number }>('/personnel/echeancier-contrats'),
    'echeances',
  );
  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <Erreur m={erreur} />
      <div className="font-semibold flex items-center gap-1.5">
        Fins de contrat, de période d&apos;essai et de durée maximale
        <Aide
          titre="Échéancier des contrats"
          texte="Les contrats en cours dont le terme, la fin d'essai ou la durée maximale tombe dans les soixante jours, ou est passé. Un contrat à durée déterminée prend fin au terme fixé ; conclu pour un emploi permanent, il est réputé à durée indéterminée. Il ne peut excéder deux ans, un an pour le travailleur séparé de sa famille, comptés de date à date depuis son entrée en vigueur ; ce plafond n'est dit que quand le contrat ne fixe pas de terme ou le fixe au-delà. La prolongation des services au-delà de la durée maximale de l'essai confirme le contrat. L'échéancier ne termine ni ne requalifie aucun contrat."
          source="Code du travail, art. 41, 42, 43 et 69"
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
                <td className="px-2 py-1">{e.objet === 'FIN_CDD' ? 'Terme du contrat' : e.objet === 'PLAFOND_ARTICLE_41' ? 'Durée maximale du contrat' : "Fin de l'essai"}</td>
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

type Cellules = {
  congolais: { h: number; f: number; total: number } | null;
  etrangers: { h: number; f: number; total: number } | null;
  totaux: { h: number; f: number; total: number };
};

type FormulaireDasmo = {
  exercice: number;
  au: string;
  dateLimite: string;
  anneePrecedente: string;
  anneeAnterieure: string;
  identification: { numero: number; libelle: string; valeur: string | null }[];
  effectifs: { lignes: { cle: string; libelle: string; cellules: Cellules | null }[]; totaux: Cellules; sansClasse: string[] };
  permanents: { annee: number; anneePrecedente: number; anneeAnterieure: number };
  nonPermanents: { journaliers: number; temporaires: number; apprentis: number; noteTemporaires: string };
  manquants: string[];
  reserveRequalifications: string | null;
  nonRemplies: string[];
  modele: string;
  fondement: string;
};

type Declaration = {
  exercice: number;
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
  formulaire: FormulaireDasmo;
};

/** Une case laissée au cabinet · des pointillés, à remplir à la main sur le papier, dite aux lecteurs d'écran. */
function Vide() {
  return (
    <span className="text-text-dim" aria-label="non renseigné">
      ……
    </span>
  );
}

/** Une ligne du tableau des effectifs · une cellule non calculée reste en pointillés, jamais à zéro. */
function CellulesDasmo({ c }: { c: Cellules | null }) {
  const trois = (v: { h: number; f: number; total: number } | null | undefined) =>
    [v?.h, v?.f, v?.total].map((x, i) => (
      <td key={i} className="px-1.5 py-0.5 text-right">
        {x === undefined || x === null ? <Vide /> : x}
      </td>
    ));
  return (
    <>
      {trois(c?.congolais)}
      {trois(c?.etrangers)}
      {trois(c?.totaux)}
    </>
  );
}

/**
 * LA DÉCLARATION ANNUELLE DE LA SITUATION DE LA MAIN-D'ŒUVRE · le modèle de
 * l'ONEM annexé à l'arrêté du 24 février 2023, rempli par le serveur
 * (`situation-main-oeuvre.ts`), rien n'est recalculé ici. L'exercice est
 * l'année du 1er janvier, comme sur le formulaire. Il s'imprime · les
 * réglages ne s'impriment pas (`ecran-seul`).
 */
export function OngletDeclarationMainOeuvre() {
  const [exercice, setExercice] = useState(String(new Date().getFullYear()));
  const lisible = /^\d{4}$/.test(exercice);
  const { donnees, erreur } = useLecture(
    lisible ? () => api.get<Declaration>(`/personnel/declaration-main-oeuvre/${exercice}`) : null,
    `declaration-${exercice}`,
  );
  const f = donnees?.formulaire;
  const aCompleter = f ? [...f.manquants, ...f.nonRemplies] : [];
  const td = 'px-2 py-0.5';
  const thLigne = 'px-2 py-0.5 text-left font-normal';
  return (
    <div className="max-w-[1000px] text-[11.5px] space-y-3">
      <div className="ecran-seul space-y-2">
        <Erreur m={erreur} />
        <div className="font-semibold flex items-center gap-1.5">
          Déclaration annuelle de la situation de la main-d&apos;œuvre
          <Aide
            titre="Déclaration annuelle de la situation de la main-d'œuvre"
            texte="Toute entreprise dépose chaque année, au plus tard le 31 janvier, la déclaration de la situation de la main-d'œuvre nationale et étrangère qu'elle emploie, sur le formulaire de l'ONEM annexé à l'arrêté de 2023, en quatre exemplaires. L'exercice est l'année du 1er janvier, comme sur le formulaire. OmegaX le remplit pour ce que le registre porte · l'identification, l'effectif permanent (un salarié compte une fois, permanent dès qu'un contrat à durée indéterminée est en vigueur) par catégorie de la grille du décret n° 25/22, nationalité et sexe, et les non-permanents. Les rubriques III à V (masse salariale, durée du travail, besoins en main-d'œuvre et en formation) se remplissent à la main, et tout ce qui manque est nommé."
            source={f?.fondement ?? "Code du travail, art. 218 et 219 ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 1er à 5, et son modèle annexé"}
          />
          <label htmlFor="dasmo-exercice" className="font-normal ml-2">
            Exercice
          </label>
          <input
            id="dasmo-exercice"
            value={exercice}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => setExercice(e.target.value)}
            className={`${champ} w-[60px] font-normal`}
          />
          {f && (
            <button type="button" onClick={() => imprimerLeFormulaire('dasmo-formulaire')} className="bg-sel text-white font-semibold px-3 py-1 ml-auto">
              Imprimer le formulaire
            </button>
          )}
        </div>
        {!lisible && <div className="text-warning">Exercice illisible · quatre chiffres (AAAA).</div>}
        {lisible && donnees === null && !erreur && <div className="text-text-dim">Lecture du registre…</div>}
        {donnees && (
          <>
            <div className="text-warning">{donnees.reserve}</div>
            {donnees.reserveNationalite && <div className="text-warning">{donnees.reserveNationalite}</div>}
            {f?.reserveRequalifications && <div className="text-warning">{f.reserveRequalifications}</div>}
            {aCompleter.length > 0 && (
              <div>
                <div className="font-semibold">À compléter avant le dépôt</div>
                <ul className="list-disc pl-5">
                  {aCompleter.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {f && f.effectifs.sansClasse.length > 0 && (
              <div className="text-text-dim">Permanents sans classe au contrat · {f.effectifs.sansClasse.join(', ')}.</div>
            )}
            <div>
              Mouvements de l&apos;année {donnees.annee} · entrées {donnees.entrees}, sorties {donnees.sorties}
              {donnees.regleMouvements && (
                <>
                  {' '}
                  <Aide titre="Entrées et sorties" texte={donnees.regleMouvements} source="Code du travail, art. 217 et 218" />
                </>
              )}
            </div>
            <div>
              Situation au {donnees.au} · dépôt au plus tard le {donnees.dateLimite} · destinataires · {donnees.destinataires}
            </div>
          </>
        )}
      </div>
      {f && (
        <section id="dasmo-formulaire" className="border border-border px-4 py-3 space-y-2" aria-labelledby="dasmo-titre">
          <div id="dasmo-titre" className="font-semibold">
            Déclaration annuelle de la situation de la main-d&apos;œuvre · exercice {f.exercice}
          </div>
          <div className="impression-seul text-text-dim">{f.fondement}</div>
          <div id="dasmo-identification" className="font-semibold">
            I. Identification de l&apos;entreprise
          </div>
          <table className="w-full eviter-coupure" aria-labelledby="dasmo-identification">
            <tbody>
              {f.identification.map((c) => (
                <tr key={c.numero}>
                  <td className={`${td} w-[40px] text-right`}>{c.numero}</td>
                  <th scope="row" className={`${thLigne} w-[240px]`}>
                    {c.libelle}
                  </th>
                  <td className={td}>{c.valeur ?? <Vide />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div id="dasmo-effectifs" className="font-semibold">
            II. Effectif des travailleurs et répartition du personnel · personnel permanent au {f.au}
          </div>
          <table className="w-full eviter-coupure" aria-labelledby="dasmo-effectifs">
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className="text-left px-1.5 py-0.5">
                  Catégories professionnelles
                </th>
                <th scope="colgroup" colSpan={3} className="px-1.5 py-0.5">
                  Congolaise
                </th>
                <th scope="colgroup" colSpan={3} className="px-1.5 py-0.5">
                  Étrangère
                </th>
                <th scope="colgroup" colSpan={3} className="px-1.5 py-0.5">
                  Totaux
                </th>
              </tr>
              <tr>
                {['H', 'F', 'Total', 'H', 'F', 'Total', 'H', 'F', 'Total'].map((x, i) => (
                  <th key={i} scope="col" className="text-right px-1.5 py-0.5">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.effectifs.lignes.map((l) => (
                <tr key={l.cle}>
                  <th scope="row" className="px-1.5 py-0.5 text-left font-normal">
                    {l.libelle}
                  </th>
                  <CellulesDasmo c={l.cellules} />
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="px-1.5 py-0.5 text-left">
                  Totaux
                </th>
                <CellulesDasmo c={f.effectifs.totaux} />
              </tr>
            </tbody>
          </table>
          {f.effectifs.sansClasse.length > 0 && (
            // Sur le papier aussi · sans elle, la somme des lignes diffère du total sans un mot.
            <div>Permanents comptés au total, non rangés par catégorie · {f.effectifs.sansClasse.length}</div>
          )}
          <table className="w-full eviter-coupure" aria-label="Permanents et non-permanents">
            <tbody>
              {(
                [
                  [`Personnel permanent au ${f.au}`, f.permanents.annee],
                  [`Personnel permanent au ${f.anneePrecedente}`, f.permanents.anneePrecedente],
                  [`Personnel permanent au ${f.anneeAnterieure}`, f.permanents.anneeAnterieure],
                  [`Journaliers en service au ${f.au}`, f.nonPermanents.journaliers],
                ] as const
              ).map(([libelle, n]) => (
                <tr key={libelle}>
                  <th scope="row" className={thLigne}>
                    {libelle}
                  </th>
                  <td className={`${td} text-right`}>{n}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className={thLigne}>
                  Temporaires en service au {f.au} <Aide titre="Temporaires" texte={f.nonPermanents.noteTemporaires} source={f.modele} />
                </th>
                <td className={`${td} text-right`}>{f.nonPermanents.temporaires}</td>
              </tr>
              <tr>
                <th scope="row" className={thLigne}>
                  Consultants · saisonniers
                </th>
                <td className={`${td} text-right`}>
                  <Vide />
                </td>
              </tr>
              <tr>
                <th scope="row" className={thLigne}>
                  Effectif maximum de chaque catégorie de non-permanents, et sa période
                </th>
                <td className={`${td} text-right`}>
                  <Vide />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="font-semibold">III à V. Masse salariale, durée du travail, besoins en main-d&apos;œuvre et en formation</div>
          <div>
            <Vide />
          </div>
          <div>Fait à ……………………, le …………………… · signature du déclarant</div>
        </section>
      )}
    </div>
  );
}

type LigneBilanSocial = {
  numero: number;
  libelle: string;
  nombre: number | null;
  budgete: string | null;
  realise: string | null;
  devise: MonnaieBilan | null;
  solde: string | null;
  proposition: { realise: string; devise: 'CDF'; origine: string } | null;
};

type BilanSocial = {
  exercice: number;
  du: string;
  au: string;
  dateLimite: string;
  identification: { libelle: string; valeur: string | null }[];
  effectifActifAu: string;
  lignes: LigneBilanSocial[];
  total: { devise: MonnaieBilan; budgete: string; realise: string; solde: string | null; incomplet: boolean }[];
  commentaire: string | null;
  enregistreLe: string | null;
  enregistrePar: string | null;
  modele: string;
  fondement: string;
};

const editer = (b: BilanSocial): LigneEditee[] =>
  b.lignes.map((l) => ({ numero: l.numero, nombre: l.nombre === null ? '' : String(l.nombre), budgete: l.budgete ?? '', realise: l.realise ?? '', devise: l.devise ?? '' }));

/**
 * LE BILAN SOCIAL DE L'ONEM · les vingt et une lignes du modèle, saisies par
 * le cabinet ; l'identification et la proposition de la ligne 10 servies par
 * le serveur (`bilan-social.ts`), solde et total aussi, rien recalculé ici.
 * L'exercice est l'année écoulée, déposée au plus tard le 31 janvier qui suit.
 */
export function OngletBilanSocial({ peutEcrire, onModifie }: { peutEcrire: boolean; onModifie?: (motif: string | null) => void }) {
  // Deux états · l'exercice TAPÉ et l'exercice LU. Le second ne change qu'une
  // fois les quatre chiffres validés (sortie du champ ou Entrée), et une
  // saisie non enregistrée le fait confirmer · sans cela une frappe effaçait
  // les vingt et une lignes (relecture, bloquant).
  const [exerciceTape, setExerciceTape] = useState(String(new Date().getFullYear() - 1));
  const [exercice, setExercice] = useState(exerciceTape);
  const lisible = /^\d{4}$/.test(exerciceTape);
  const { donnees, erreur, setErreur, remplacer } = useLecture(
    () => api.get<BilanSocial>(`/personnel/bilan-social/${exercice}`),
    `bilan-social-${exercice}`,
  );
  const [envoi, setEnvoi] = useState(false);
  const [lignes, setLignes] = useState<LigneEditee[] | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [modifie, setModifie] = useState(false);
  const MOTIF_NON_ENREGISTRE = 'Le bilan social a des lignes non enregistrées · elles seraient perdues.';
  useGardeFermeture(modifie ? MOTIF_NON_ENREGISTRE : null);
  useEffect(() => {
    onModifie?.(modifie ? MOTIF_NON_ENREGISTRE : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifie]);
  useEffect(() => {
    // Chaque lecture (exercice changé ou enregistrement servi) refait la grille.
    setLignes(donnees ? editer(donnees) : null);
    setCommentaire(donnees?.commentaire ?? '');
    setModifie(false);
  }, [donnees]);
  const appliquerExercice = () => {
    if (!lisible || exerciceTape === exercice) return;
    if (modifie && !window.confirm(`${MOTIF_NON_ENREGISTRE} Lire l'exercice ${exerciceTape} quand même ?`)) {
      setExerciceTape(exercice);
      return;
    }
    setExercice(exerciceTape);
  };
  const changer = (numero: number, champ: keyof Omit<LigneEditee, 'numero'>, v: string) => {
    setLignes((ls) => ls && ls.map((l) => (l.numero === numero ? { ...l, [champ]: v } : l)));
    setModifie(true);
  };
  const reporter = (numero: number, realise: string) => {
    const e = lignes?.find((l) => l.numero === numero);
    // Le report ne change jamais en silence la monnaie d'un budgétisé déjà saisi.
    if (e && e.devise && e.devise !== 'CDF' && e.budgete.trim() !== '') {
      setErreur(`Ligne ${numero} · le budgétisé est en ${e.devise} · la proposition est en CDF, à reporter à la main dans la même monnaie.`);
      return;
    }
    setLignes((ls) => ls && ls.map((l) => (l.numero === numero ? { ...l, realise, devise: 'CDF' } : l)));
    setModifie(true);
  };
  const enregistrer = async () => {
    if (!lignes || !donnees) return;
    const s = saisieAEnvoyer(lignes, commentaire, donnees.enregistreLe);
    if ('erreur' in s) {
      setErreur(s.erreur);
      return;
    }
    const pour = exercice;
    setErreur('');
    setEnvoi(true);
    try {
      const r = await api.put<BilanSocial>(`/personnel/bilan-social/${pour}`, s.corps);
      // La réponse vaut lecture · une relecture qui échouerait ensuite ne ferait pas disparaître ce qui est enregistré.
      remplacer(r);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement refusé');
    } finally {
      setEnvoi(false);
    }
  };
  const b = donnees;
  const td = 'px-1.5 py-0.5';
  return (
    <div className="max-w-[1000px] text-[11.5px] space-y-3">
      <div className="ecran-seul space-y-2">
        <Erreur m={erreur} />
        <div className="font-semibold flex items-center gap-1.5">
          Bilan social
          <Aide
            titre="Bilan social"
            texte="Chaque entreprise dépose, au plus tard le 31 janvier de chaque année, le bilan social de l'exercice écoulé, sur le modèle de l'ONEM. Les vingt et une lignes ne répondent à aucun compte du plan · le nombre, le montant budgétisé, le montant réalisé et sa monnaie se saisissent. Le solde est le budgétisé moins le réalisé ; le total s'additionne par monnaie. La rémunération annuelle reçoit une proposition, le total versé des bulletins émis de l'année, à reporter si elle convient."
            source={b?.fondement ?? "Code du travail, art. 218 ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023, art. 3"}
          />
          <label htmlFor="bilan-social-exercice" className="font-normal ml-2">
            Exercice
          </label>
          <input
            id="bilan-social-exercice"
            value={exerciceTape}
            inputMode="numeric"
            maxLength={4}
            disabled={envoi}
            onChange={(e) => setExerciceTape(e.target.value)}
            onBlur={appliquerExercice}
            onKeyDown={(e) => {
              if (e.key === 'Enter') appliquerExercice();
            }}
            className={`${champ} w-[60px] font-normal`}
          />
          {b && (
            <button type="button" onClick={() => imprimerLeFormulaire('bilan-social-formulaire')} className="border border-border px-3 py-1 ml-auto" disabled={modifie} title={modifie ? "Enregistrez d'abord les lignes saisies" : undefined}>
              Imprimer le formulaire
            </button>
          )}
          {b && peutEcrire && (
            <button type="button" onClick={() => void enregistrer()} disabled={envoi || !modifie} className="bg-sel text-white font-semibold px-3 py-1 disabled:opacity-50">
              Enregistrer
            </button>
          )}
        </div>
        {!lisible && <div className="text-warning">Exercice illisible · quatre chiffres (AAAA).</div>}
        {b === null && !erreur && <div className="text-text-dim">Lecture du bilan social…</div>}
        {b && (
          <div>
            Exercice du {b.du} au {b.au} · dépôt au plus tard le {b.dateLimite}
            {b.enregistreLe ? ` · enregistré le ${b.enregistreLe.slice(0, 10)} par ${b.enregistrePar}` : ' · pas encore enregistré'}
          </div>
        )}
        {b && lignes && (
          <table className="w-full" aria-label="Saisie du bilan social">
            <thead>
              <tr>
                <th scope="col" className={`${td} text-right`}>N°</th>
                <th scope="col" className={`${td} text-left`}>Désignation</th>
                <th scope="col" className={`${td} text-right`}>Nombre</th>
                <th scope="col" className={`${td} text-right`}>Montant budgétisé</th>
                <th scope="col" className={`${td} text-right`}>Montant réalisé</th>
                <th scope="col" className={td}>Monnaie</th>
                <th scope="col" className={`${td} text-right`}>Solde</th>
              </tr>
            </thead>
            <tbody>
              {b.lignes.map((l) => {
                const e = lignes.find((x) => x.numero === l.numero);
                if (!e) return null;
                const lectureSeule = !peutEcrire || envoi;
                return (
                  <tr key={l.numero}>
                    <td className={`${td} text-right`}>{l.numero}</td>
                    <th scope="row" className={`${td} text-left font-normal`}>
                      {l.libelle}
                      {l.proposition && (
                        <div className="text-text-dim">
                          Proposé · {fc(l.proposition.realise)} CDF{' '}
                          <Aide titre="Proposition" texte={l.proposition.origine} source={b.modele} />
                          {peutEcrire && (
                            <button
                              type="button"
                              className="underline ml-1"
                              disabled={envoi}
                              onClick={() => reporter(l.numero, l.proposition!.realise)}
                            >
                              Reporter
                            </button>
                          )}
                        </div>
                      )}
                    </th>
                    <td className={td}>
                      <input aria-label={`Nombre, ligne ${l.numero}`} readOnly={lectureSeule} inputMode="numeric" value={e.nombre} onChange={(x) => changer(l.numero, 'nombre', x.target.value)} className={`${champ} w-[70px] text-right`} />
                    </td>
                    <td className={td}>
                      <input aria-label={`Montant budgétisé, ligne ${l.numero}`} readOnly={lectureSeule} inputMode="decimal" value={e.budgete} onChange={(x) => changer(l.numero, 'budgete', x.target.value)} className={`${champ} w-[120px] text-right`} />
                    </td>
                    <td className={td}>
                      <input aria-label={`Montant réalisé, ligne ${l.numero}`} readOnly={lectureSeule} inputMode="decimal" value={e.realise} onChange={(x) => changer(l.numero, 'realise', x.target.value)} className={`${champ} w-[120px] text-right`} />
                    </td>
                    <td className={td}>
                      <select aria-label={`Monnaie, ligne ${l.numero}`} disabled={lectureSeule} value={e.devise} onChange={(x) => changer(l.numero, 'devise', x.target.value)} className={champ}>
                        <option value="">·</option>
                        <option value="CDF">CDF</option>
                        <option value="USD">USD</option>
                      </select>
                    </td>
                    <td className={`${td} text-right`}>{modifie || l.solde === null ? <Vide /> : `${fc(l.solde)} ${l.devise ?? ''}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {b && (
          <div>
            <label htmlFor="bilan-social-commentaire" className="font-semibold block">
              Commentaire du tableau social
            </label>
            <textarea
              id="bilan-social-commentaire"
              readOnly={!peutEcrire || envoi}
              value={commentaire}
              maxLength={4000}
              onChange={(e) => {
                setCommentaire(e.target.value);
                setModifie(true);
              }}
              className={`${champ} w-full h-[80px]`}
            />
          </div>
        )}
      </div>
      {b && (
        <section id="bilan-social-formulaire" className="impression-seul border border-border px-4 py-3 space-y-2" aria-labelledby="bilan-social-titre">
          <div id="bilan-social-titre" className="font-semibold">
            Bilan social · exercice {b.exercice}
          </div>
          <div className="text-text-dim">{b.fondement}</div>
          <div className="font-semibold">I. Identification</div>
          <table className="w-full eviter-coupure" aria-label="Identification">
            <tbody>
              {b.identification.map((c) => (
                <tr key={c.libelle}>
                  <th scope="row" className={`${td} text-left font-normal w-[220px]`}>
                    {c.libelle}
                  </th>
                  <td className={td}>{c.valeur ?? <Vide />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="font-semibold">II. Désignation</div>
          <table className="w-full eviter-coupure" aria-label="Désignation">
            <thead>
              <tr>
                {['N°', 'Désignation', 'Nombre', 'Montant budgétisé', 'Montant réalisé', 'Solde'].map((x) => (
                  <th key={x} scope="col" className={`${td} ${x === 'Désignation' ? 'text-left' : 'text-right'}`}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.lignes.map((l) => (
                <tr key={l.numero}>
                  <td className={`${td} text-right`}>{l.numero}</td>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    {l.libelle}
                  </th>
                  <td className={`${td} text-right`}>{l.nombre ?? <Vide />}</td>
                  <td className={`${td} text-right`}>{l.budgete === null ? <Vide /> : `${fc(l.budgete)} ${l.devise ?? ''}`}</td>
                  <td className={`${td} text-right`}>{l.realise === null ? <Vide /> : `${fc(l.realise)} ${l.devise ?? ''}`}</td>
                  <td className={`${td} text-right`}>{l.solde === null ? <Vide /> : `${fc(l.solde)} ${l.devise ?? ''}`}</td>
                </tr>
              ))}
              {b.total.length === 0 ? (
                <tr className="font-semibold">
                  <th scope="row" colSpan={3} className={`${td} text-left`}>
                    Total
                  </th>
                  <td className={td} colSpan={3}>
                    <Vide />
                  </td>
                </tr>
              ) : (
                b.total.map((t) => (
                  <tr key={t.devise} className="font-semibold">
                    <th scope="row" colSpan={3} className={`${td} text-left`}>
                      Total en {t.devise}
                      {t.incomplet ? ' (lignes chiffrées d’un seul côté comprises)' : ''}
                    </th>
                    <td className={`${td} text-right`}>{fc(t.budgete)}</td>
                    <td className={`${td} text-right`}>{fc(t.realise)}</td>
                    <td className={`${td} text-right`}>{t.solde === null ? <Vide /> : fc(t.solde)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="font-semibold">Commentaire du tableau social</div>
          <div className="whitespace-pre-wrap">{b.commentaire ?? <Vide />}</div>
          <div>Fait à ……………………, le …………………… · signature du chef de l&apos;entreprise ou de l&apos;établissement</div>
        </section>
      )}
    </div>
  );
}
