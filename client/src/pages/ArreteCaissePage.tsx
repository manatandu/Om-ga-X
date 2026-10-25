import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import { montant } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';
import { coupuresAEnvoyer, grilleProposee, totalCoupuresCentimes, type CoupureSaisie } from '../lib/arrete-caisse';

/**
 * ARRÊTÉ DE CAISSE PAR COUPURES ET PLAFOND D'ENCAISSE (ligne microfina-m2,
 * idée 5). Fiche du compte 57 des deux plans · le solde de la caisse « doit
 * toujours correspondre exactement à la somme disponible réellement ». Le
 * serveur lit le solde, calcule les espèces des coupures et écrit les
 * mentions ; l'écran ne fait que montrer. Le plafond avertit, jamais ne refuse.
 */

interface LigneSituation {
  caisse: { id: string; numero: string; intitule: string };
  solde: number | null;
  unite: string | null;
  plafond: number | null;
  auDelaDuPlafond: boolean | null;
  plafondNonCompare: string | null;
  dernierArrete: { jour: string; ecart: number } | null;
}

interface Apercu {
  caisse: { id: string; numero: string; intitule: string };
  jour: string;
  exerciceClos: boolean;
  unite: string | null;
  codeUnite: string | null;
  soldeTheorique: number;
  ecrituresAuBrouillard: number;
  plafond: number | null;
  soldeAuDelaDuPlafond: boolean | null;
  plafondNonCompare: string | null;
  arreteExistantId: string | null;
  coupuresProposees: number[];
}

interface Arrete {
  id: string;
  caisse: { numero: string; intitule: string };
  jour: string;
  heure: string | null;
  unite: string | null;
  soldeTheorique: number;
  ecrituresAuBrouillard: number;
  especesComptees: number;
  ecart: number;
  plafond: number | null;
  caissier: string;
  controlePar: string | null;
  observations: string | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  coupures: { valeurUnitaire: number; nombre: number }[];
  mentions: string[];
}

interface Plafond {
  id: string;
  dateEffet: string;
  montant: number;
  unite: string | null;
  motif: string;
}

const aujourdhui = () => {
  // Le jour de Kinshasa (UTC+1) · le serveur juge aussi sur lui.
  const d = new Date(Date.now() + 3600_000);
  return d.toISOString().slice(0, 10);
};
const jourFr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

export function ArreteCaissePage() {
  const { peutEcrire, peutValider, estAdmin } = useAuth();
  const [jour, setJour] = useState(aujourdhui());
  const [situation, setSituation] = useState<{ caisses: LigneSituation[]; exerciceTrouve: boolean; total: number; tronque: boolean } | null>(null);
  const [erreurSituation, setErreurSituation] = useState<string | null>(null);
  const [compteId, setCompteId] = useState('');
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [grille, setGrille] = useState<CoupureSaisie[]>([{ valeur: '', nombre: '' }]);
  const [heure, setHeure] = useState('');
  const [caissier, setCaissier] = useState('');
  const [controlePar, setControlePar] = useState('');
  const [observations, setObservations] = useState('');
  const [arretes, setArretes] = useState<{ arretes: Arrete[]; total: number; tronque: boolean } | null>(null);
  const [plafonds, setPlafonds] = useState<Plafond[] | null>(null);
  const [plafondSaisi, setPlafondSaisi] = useState({ dateEffet: aujourdhui(), montant: '', motif: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string[] | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const jeton = useRef(0);

  const chargerSituation = useCallback(async () => {
    const j = ++jeton.current;
    try {
      const s = await api.get<{ caisses: LigneSituation[]; exerciceTrouve: boolean; total: number; tronque: boolean }>(`/caisses/situation?jour=${jour}`);
      if (j !== jeton.current) return;
      setSituation(s);
      setErreurSituation(null);
      // Une seule caisse · elle se présélectionne.
      if (s.caisses.length === 1) setCompteId((c) => c || s.caisses[0].caisse.id);
    } catch (e) {
      if (j === jeton.current) setErreurSituation(e instanceof ApiError ? e.message : 'Situation des caisses illisible.');
    }
  }, [jour]);

  // Une réponse d'une autre caisse ou d'un autre jour, arrivée tard, est jetée ·
  // sans quoi l'écran montrait le solde d'une caisse sous le nom d'une autre.
  const jetonCaisse = useRef(0);
  const chargerCaisse = useCallback(async () => {
    const j = ++jetonCaisse.current;
    setApercu(null);
    setArretes(null);
    setPlafonds(null);
    if (!compteId) return;
    try {
      const [a, l, p] = await Promise.all([
        api.get<Apercu>(`/caisses/arretes/apercu?compteId=${compteId}&jour=${jour}`),
        api.get<{ arretes: Arrete[]; total: number; tronque: boolean }>(`/caisses/arretes?compteId=${compteId}`),
        api.get<Plafond[]>(`/caisses/plafonds?compteId=${compteId}`),
      ]);
      if (j !== jetonCaisse.current) return;
      setApercu(a);
      setGrille(grilleProposee(a.coupuresProposees));
      setArretes(l);
      setPlafonds(p);
    } catch (e) {
      if (j === jetonCaisse.current) setErreur(e instanceof ApiError ? e.message : 'Caisse illisible.');
    }
  }, [compteId, jour]);

  useEffect(() => {
    setSituation(null);
    void chargerSituation();
  }, [chargerSituation]);

  useEffect(() => {
    void chargerCaisse();
  }, [chargerCaisse]);

  async function geste(f: () => Promise<{ mentions?: string[] } | unknown>, succes: string) {
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    try {
      const r = (await f()) as { mentions?: string[] } | undefined;
      setInfo([succes, ...(r?.mentions ?? [])]);
      await Promise.all([chargerSituation(), chargerCaisse()]);
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Geste impossible.');
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function onEtablir(e: FormEvent) {
    e.preventDefault();
    if (!apercu) return;
    const c = coupuresAEnvoyer(grille);
    if ('motif' in c) {
      setErreur(c.motif);
      return;
    }
    const ok = await geste(
      () =>
        api.post('/caisses/arretes', {
          compteId,
          jour,
          heure: heure || undefined,
          uniteAttendue: apercu.unite,
          coupures: c.coupures,
          caissier,
          controlePar: controlePar || undefined,
          observations: observations || undefined,
        }),
      'Arrêté établi.',
    );
    if (ok) {
      setObservations('');
    }
  }

  async function onAnnuler(id: string) {
    const motif = window.prompt("Motif de l'annulation de l'arrêté :");
    if (motif === null) return;
    await geste(() => api.post(`/caisses/arretes/${id}/annulation`, { motif }), 'Arrêté annulé · il reste au registre.');
  }

  async function onPlafond(e: FormEvent) {
    e.preventDefault();
    const m = montantSaisi(plafondSaisi.montant);
    if (m === null) {
      setErreur('Le plafond est illisible.');
      return;
    }
    const unite = situation?.caisses.find((x) => x.caisse.id === compteId)?.unite ?? null;
    const ok = await geste(
      () => api.post('/caisses/plafonds', { compteId, dateEffet: plafondSaisi.dateEffet, montant: m, deviseId: unite ?? undefined, motif: plafondSaisi.motif }),
      "Plafond d'encaisse enregistré.",
    );
    if (ok) setPlafondSaisi((p) => ({ ...p, montant: '', motif: '' }));
  }

  const total = totalCoupuresCentimes(grille);
  const unite = apercu?.codeUnite ? ` ${apercu.codeUnite}` : '';

  return (
    <div className="flex flex-col gap-3 p-3">
      <EnteteImpression titre="Arrêté de caisse" sousTitre={`Situation des caisses au ${jourFr(jour)}`} />

      <div className="ecran-seul flex flex-wrap items-end justify-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-text-dim">Jour</span>
          <input type="date" value={jour} max={aujourdhui()} onChange={(e) => setJour(e.target.value)} className="border border-border-dark bg-surface px-2 py-1 text-[11.5px]" />
        </label>
        <Aide
          titre="L'arrêté de caisse"
          texte={
            "L'arrêté compte la caisse au jour, par coupures, et la compare au solde de tout ce qui est saisi à la fin de ce jour, brouillard compris. " +
            "Les coupures font les espèces comptées. L'écart, le solde créditeur et le dépassement du plafond sont dits, rien n'est passé au journal. " +
            "Un arrêté faux s'annule avec son motif. Le plafond d'encaisse est fixé par le dossier · aucun texte n'en fixe, il avertit et ne refuse rien. " +
            "La caisse comptée pour la clôture relève du procès-verbal de comptage de l'inventaire."
          }
          source="Fiche du compte 57 (SYCEBNL Partie 2 ch. 3 ; AUDCIF Titre VII) · éléments de contrôle « procès-verbaux de caisse ; bordereaux de situation journalière »"
        />
      </div>

      {erreur && <div className="ecran-seul border border-danger bg-danger/10 px-3 py-1.5 text-[11.5px]">{erreur}</div>}
      {info && (
        <div className="ecran-seul border border-border bg-surface-alt px-3 py-1.5 text-[11.5px]">
          {info.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
      )}

      {erreurSituation && <div className="border border-danger bg-danger/10 px-3 py-1.5 text-[11.5px]">{erreurSituation}</div>}
      {situation === null && !erreurSituation && <div className="text-[11.5px] text-text-dim">Lecture des caisses…</div>}
      {situation && (
        <div className="overflow-x-auto">
          {!situation.exerciceTrouve && <div className="text-[11px] text-warning">Aucun exercice du dossier ne couvre ce jour · les soldes ne sont pas calculés.</div>}
          <table className="w-full min-w-[820px] text-[11.5px]">
            <thead>
              <tr>
                <th className="text-left">Caisse</th>
                <th className="text-right">Solde du jour</th>
                <th className="text-right">Plafond d'encaisse</th>
                <th className="text-left">Plafond</th>
                <th className="text-left">Dernier arrêté</th>
              </tr>
            </thead>
            <tbody>
              {situation.caisses.map((l) => (
                <tr key={l.caisse.id} onClick={() => setCompteId(l.caisse.id)} className={`cursor-pointer ${compteId === l.caisse.id ? 'bg-a-50' : ''}`}>
                  <td>
                    {l.caisse.numero} · {l.caisse.intitule}
                  </td>
                  <td className={`text-right ${l.solde !== null && l.solde < 0 ? 'text-danger font-semibold' : ''}`}>{l.solde === null ? 'non calculé' : montant(l.solde)}</td>
                  <td className="text-right">{l.plafond === null ? '·' : montant(l.plafond)}</td>
                  <td>{l.auDelaDuPlafond ? <span className="text-warning font-semibold">Au-delà du plafond</span> : l.plafondNonCompare ? <span className="text-text-dim">Non comparé</span> : '·'}</td>
                  <td>{l.dernierArrete ? `${jourFr(l.dernierArrete.jour)} · écart ${montant(l.dernierArrete.ecart)}` : 'Aucun'}</td>
                </tr>
              ))}
              {situation.caisses.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-text-dim">
                    Aucune caisse au plan · ouvrez un compte 57 (Structure &gt; Plan comptable).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {situation.tronque && <div className="text-[11px] text-warning">{situation.caisses.length} caisses affichées sur {situation.total}.</div>}
        </div>
      )}

      {apercu && (
        <div className="flex flex-col gap-2 border border-border bg-surface px-3 py-2 text-[11.5px]">
          <div className="flex flex-wrap gap-4">
            <span className="font-bold">
              {apercu.caisse.numero} · {apercu.caisse.intitule}
            </span>
            <span>
              Solde du {jourFr(apercu.jour)} · {montant(apercu.soldeTheorique)}
              {unite}
            </span>
            {apercu.ecrituresAuBrouillard > 0 && <span className="text-text-dim">dont {apercu.ecrituresAuBrouillard} écriture(s) au brouillard</span>}
            {apercu.plafond !== null && (
              <span>
                Plafond {montant(apercu.plafond)}
                {unite}
              </span>
            )}
            {apercu.soldeAuDelaDuPlafond && <span className="text-warning font-semibold">Solde au-delà du plafond d'encaisse</span>}
            {apercu.plafondNonCompare && <span className="text-text-dim">{apercu.plafondNonCompare}</span>}
          </div>

          {apercu.exerciceClos && <div className="text-warning">L'exercice de ce jour est clôturé · la caisse se compte par le procès-verbal de comptage de l'inventaire.</div>}
          {apercu.arreteExistantId && <div className="text-text-dim">Cette caisse a déjà son arrêté pour ce jour.</div>}

          {peutEcrire && !apercu.exerciceClos && !apercu.arreteExistantId && (
            <form onSubmit={(e) => void onEtablir(e)} className="ecran-seul flex flex-col gap-2">
              <table className="w-full max-w-[520px]">
                <thead>
                  <tr>
                    <th className="text-right">Valeur faciale</th>
                    <th className="text-right">Nombre</th>
                    <th className="text-right">Montant</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {grille.map((c, i) => {
                    const maj = (champ: keyof CoupureSaisie, v: string) => setGrille((g) => g.map((x, k) => (k === i ? { ...x, [champ]: v } : x)));
                    const v = montantSaisi(c.valeur);
                    const n = montantSaisi(c.nombre);
                    return (
                      <tr key={i}>
                        <td className="text-right">
                          <input value={c.valeur} onChange={(e) => maj('valeur', e.target.value)} inputMode="decimal" className="w-[120px] border border-border-dark bg-surface px-1 py-0.5 text-right" />
                        </td>
                        <td className="text-right">
                          <input value={c.nombre} onChange={(e) => maj('nombre', e.target.value)} inputMode="numeric" className="w-[90px] border border-border-dark bg-surface px-1 py-0.5 text-right" />
                        </td>
                        <td className="text-right">{v !== null && n !== null ? montant(v * n) : '·'}</td>
                        <td>
                          {grille.length > 1 && (
                            <button type="button" onClick={() => setGrille((g) => g.filter((_, k) => k !== i))} className="border border-border px-1">
                              Retirer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap items-end gap-2">
                <button type="button" onClick={() => setGrille((g) => [...g, { valeur: '', nombre: '' }])} className="border border-border-dark px-2 py-0.5">
                  Ajouter une coupure
                </button>
                <span className="font-semibold">
                  Espèces comptées · {total === null ? '·' : montant(total / 100)}
                  {unite}
                </span>
                {total !== null && <span className={total / 100 === apercu.soldeTheorique ? 'text-text-dim' : 'text-warning'}>écart {montant(total / 100 - apercu.soldeTheorique)}</span>}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-text-dim">Heure</span>
                  <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className="border border-border-dark bg-surface px-2 py-1" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-text-dim">Compté par</span>
                  <input value={caissier} onChange={(e) => setCaissier(e.target.value)} required maxLength={100} className="w-[200px] border border-border-dark bg-surface px-2 py-1" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-text-dim">Contrôlé par</span>
                  <input value={controlePar} onChange={(e) => setControlePar(e.target.value)} maxLength={100} className="w-[200px] border border-border-dark bg-surface px-2 py-1" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-text-dim">Observations</span>
                  <input value={observations} onChange={(e) => setObservations(e.target.value)} maxLength={1000} className="w-[300px] border border-border-dark bg-surface px-2 py-1" />
                </label>
                <button type="submit" disabled={envoi || total === null} className="bg-sel px-3 py-1 font-bold text-white disabled:opacity-60">
                  Établir l'arrêté
                </button>
              </div>
            </form>
          )}

          {arretes && (
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className="text-left">Jour</th>
                  <th className="text-right">Solde</th>
                  <th className="text-right">Espèces</th>
                  <th className="text-right">Écart</th>
                  <th className="text-left">Compté par</th>
                  <th className="text-left">Mentions</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {arretes.arretes.map((a) => (
                  <tr key={a.id} className={a.annuleLe ? 'text-text-dim line-through' : ''}>
                    <td>
                      {jourFr(a.jour)}
                      {a.heure ? ` ${a.heure}` : ''}
                    </td>
                    <td className="text-right">{montant(a.soldeTheorique)}</td>
                    <td className="text-right">{montant(a.especesComptees)}</td>
                    <td className={`text-right ${a.ecart !== 0 && !a.annuleLe ? 'text-warning font-semibold' : ''}`}>{montant(a.ecart)}</td>
                    <td>
                      {a.caissier}
                      {a.controlePar ? ` · ${a.controlePar}` : ''}
                    </td>
                    <td className="max-w-[360px] whitespace-normal">{a.annuleLe ? `Annulé · ${a.motifAnnulation ?? ''}` : a.mentions.join(' ')}</td>
                    <td>
                      {peutValider && !a.annuleLe && (
                        <button type="button" onClick={() => void onAnnuler(a.id)} className="ecran-seul border border-border px-1">
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {arretes.arretes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-text-dim">
                      Aucun arrêté pour cette caisse.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {plafonds && (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              <span className="font-bold">Plafond d'encaisse</span>
              {plafonds.length === 0 && <span className="text-text-dim">Aucun plafond fixé pour cette caisse.</span>}
              {plafonds.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span>
                    Dès le {jourFr(p.dateEffet)} · {montant(p.montant)}
                    {p.unite ? ` ${p.unite}` : ''} · {p.motif}
                  </span>
                  {estAdmin && (
                    <button type="button" onClick={() => void geste(() => api.delete(`/caisses/plafonds/${p.id}`), 'Plafond retiré.')} className="ecran-seul border border-border px-1">
                      Retirer
                    </button>
                  )}
                </div>
              ))}
              {estAdmin && (
                <form onSubmit={(e) => void onPlafond(e)} className="ecran-seul flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Date d'effet</span>
                    <input type="date" value={plafondSaisi.dateEffet} onChange={(e) => setPlafondSaisi((p) => ({ ...p, dateEffet: e.target.value }))} className="border border-border-dark bg-surface px-2 py-1" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Plafond</span>
                    <input value={plafondSaisi.montant} onChange={(e) => setPlafondSaisi((p) => ({ ...p, montant: e.target.value }))} inputMode="decimal" className="w-[140px] border border-border-dark bg-surface px-2 py-1 text-right" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Décision qui le fixe</span>
                    <input value={plafondSaisi.motif} onChange={(e) => setPlafondSaisi((p) => ({ ...p, motif: e.target.value }))} maxLength={300} className="w-[280px] border border-border-dark bg-surface px-2 py-1" />
                  </label>
                  <button type="submit" disabled={envoi} className="border border-border-dark px-3 py-1 disabled:opacity-60">
                    Fixer le plafond
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
