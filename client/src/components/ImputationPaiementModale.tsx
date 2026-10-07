import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';
import { useGardeFermeture } from '../lib/fenetres';
import { ecouterEchap } from '../lib/echap';
import { montant } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';

/**
 * L'IMPUTATION DÉCLARÉE D'UN PAIEMENT (relecture du 2026-10-07, M2) · la
 * fenêtre du geste que la déclaration de TVA et le règlement des tiers
 * annoncent. Tout est SERVI par `GET /imputations-paiements/groupe/:ligneId`
 * (les factures du groupe, l'imputation retenue, déclarée ou légale, et ce
 * qui est déjà déclaré) ; l'écran ne recalcule rien. Déclarer et retirer sont
 * réservés au comptable (`peutValider`), comme au serveur.
 */
interface FactureDuGroupe {
  id: string;
  ligneADesigner: string | null;
  reportee: boolean;
  libelle: string;
  piece: number | null;
  date: string | null;
  echeance: string | null;
  montant: number;
  imputations: { paiementId: string; date: string | null; montant: number; fondement: string }[];
}
interface PaiementDuGroupe {
  id: string;
  designable: boolean;
  /** Pourquoi le paiement ne se déclare pas d'ici · la phrase du serveur (report à nouveau, exercice clôturé, autre groupe). */
  motifNonDesignable?: string;
  libelle: string;
  piece: number | null;
  date: string | null;
  montant: number;
  validee: boolean;
  declarees: { id: string; ligneFactureId: string; montant: number; fondement: string; pieceReference: string; pieceDate: string | null; preuveAcceptation: string | null }[];
}
interface GroupeImputation {
  lettrageId: string | null;
  compte: { numero: string; intitule: string };
  factures: FactureDuGroupe[];
  paiements: PaiementDuGroupe[];
  nonImpute: { paiementId: string; montant: number }[];
  tronque: boolean;
  declareesTronquees: boolean;
  nonServi?: string;
}
type Fondement = 'DECLARATION_DU_DEBITEUR' | 'QUITTANCE_ACCEPTEE';
interface Saisie {
  paiementId: string;
  fondement: Fondement;
  pieceReference: string;
  pieceDate: string;
  preuveAcceptation: string;
  parts: Record<string, string>;
}

const LIBELLE_FONDEMENT: Record<string, string> = {
  DECLARATION_DU_DEBITEUR: 'déclarée par le débiteur',
  QUITTANCE_ACCEPTEE: 'quittance acceptée',
  LEGALE: 'imputation légale',
};
const messageDe = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : String(e));
const jour = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR') : '·');

export function ImputationPaiementModale({ ligneId, onFermer }: { ligneId: string; onFermer: () => void }) {
  const { peutEcrire, peutValider } = useAuth();
  const peutDeclarer = peutEcrire && peutValider;
  const [groupe, setGroupe] = useState<GroupeImputation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [retrait, setRetrait] = useState<{ paiementId: string; motif: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [version, setVersion] = useState(0);
  const envoiEnCours = useRef(false);
  envoiEnCours.current = envoi;
  // La fermeture de l'appelant, relue au moment de la touche · l'écoute
  // d'Échap ne se repose pas à chaque rendu de la page qui la monte.
  const fermeture = useRef(onFermer);
  fermeture.current = onFermer;
  const ref = useRef<HTMLDivElement | null>(null);
  const idBase = useId();
  const id = (nom: string) => `${idBase}-${nom}`;
  useGardeFermeture(saisie || retrait ? 'Une imputation est en cours de saisie · elle serait perdue.' : null);

  // Une réponse périmée (autre ligne, relecture) est jetée à son retour.
  useEffect(() => {
    let perimee = false;
    setGroupe(null);
    setErreur(null);
    api.get<GroupeImputation>(`/imputations-paiements/groupe/${ligneId}`).then(
      (g) => {
        if (!perimee) setGroupe(g);
      },
      (e) => {
        if (!perimee) setErreur(messageDe(e));
      },
    );
    return () => {
      perimee = true;
    };
  }, [ligneId, version]);

  useEffect(
    () =>
      ecouterEchap(() => {
        if (envoiEnCours.current) return true;
        fermeture.current();
        return true;
      }),
    [],
  );
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, []);

  function fermer() {
    if (envoi) return;
    onFermer();
  }

  async function declarer(ev: React.FormEvent) {
    ev.preventDefault();
    if (!saisie || envoi || !groupe) return;
    const factures: { ligneFactureId: string; montant: number }[] = [];
    for (const f of groupe.factures) {
      const brut = saisie.parts[f.id] ?? '';
      if (!brut.trim()) continue;
      const v = montantSaisi(brut);
      if (v == null || !(v > 0)) {
        setErreur(`Part illisible ou non positive pour la facture du ${jour(f.date)} · une part vide ne se déclare pas.`);
        return;
      }
      if (!f.ligneADesigner) {
        setErreur(`La facture du ${jour(f.date)} se désigne depuis le groupe qui la porte, pas d'ici.`);
        return;
      }
      factures.push({ ligneFactureId: f.ligneADesigner, montant: v });
    }
    if (factures.length === 0) {
      setErreur('Saisissez la part d’au moins une facture.');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ liquidation?: { message: string } | null }>('/imputations-paiements', {
        ligneReglementId: saisie.paiementId,
        fondement: saisie.fondement,
        pieceReference: saisie.pieceReference,
        pieceDate: saisie.pieceDate,
        ...(saisie.fondement === 'QUITTANCE_ACCEPTEE' ? { preuveAcceptation: saisie.preuveAcceptation } : {}),
        factures,
      });
      setInfo(r?.liquidation?.message ?? 'Imputation déclarée · la déclaration de TVA la lit désormais.');
      setSaisie(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(messageDe(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer(ev: React.FormEvent) {
    ev.preventDefault();
    if (!retrait || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ liquidation?: { message: string } | null }>(`/imputations-paiements/${retrait.paiementId}/retirer`, { motif: retrait.motif });
      setInfo(r?.liquidation?.message ?? 'Imputation retirée · l’imputation légale s’applique de nouveau.');
      setRetrait(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(messageDe(e));
    } finally {
      setEnvoi(false);
    }
  }

  const ouvrirSaisie = (p: PaiementDuGroupe) => {
    setRetrait(null);
    setErreur(null);
    setSaisie({ paiementId: p.id, fondement: 'DECLARATION_DU_DEBITEUR', pieceReference: '', pieceDate: (p.date ?? '').slice(0, 10), preuveAcceptation: '', parts: {} });
  };

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={id('titre')}
          className="anim-modale w-full max-w-[760px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 bg-surface text-text border-b border-border text-[11.5px]">
            <span id={id('titre')}>Imputation des paiements</span>
            <button
              type="button"
              aria-label="Fermer"
              disabled={envoi}
              onClick={fermer}
              className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c] disabled:opacity-50"
            >
              ✕
            </button>
          </div>
          <div className="p-4 text-[11.5px] space-y-2">
            {erreur && <div role="alert" className="border border-rouge/40 bg-rouge/5 text-rouge rounded-[3px] px-2 py-1 whitespace-pre-wrap">{erreur}</div>}
            {info && <div className="border border-warning/30 bg-warning-soft text-text rounded-[3px] px-2 py-1 whitespace-pre-wrap">{info}</div>}
            {!groupe && !erreur && <div className="text-text-dim">Lecture…</div>}
            {groupe && (
              <>
                <div className="flex items-center gap-1.5">
                  {groupe.compte.numero} · {groupe.compte.intitule}
                  <Aide
                    titre="Imputation des paiements"
                    texte="Le débiteur qui paie plusieurs factures déclare, en payant, celle qu'il entend acquitter ; à défaut, une quittance qu'il a acceptée fait foi. Sans l'une ni l'autre, le paiement va d'abord aux factures échues, puis à la plus ancienne, au prorata à date égale. Le lettrage posé par le créancier ne fixe pas l'imputation. La pièce est exigée, datée au plus tard du paiement pour une déclaration du débiteur."
                    source="Code civil, Livre III, art. 151 à 154"
                  />
                </div>
                {groupe.nonServi && <div className="text-text-dim">{groupe.nonServi}</div>}
                {groupe.declareesTronquees && <div className="text-warning">Imputations déclarées montrées en partie · le groupe en porte davantage.</div>}
                {groupe.factures.length > 0 && (
                  <div className="border border-bord rounded-[3px] overflow-x-auto">
                    <table className="w-full text-[11.5px] whitespace-nowrap">
                      <thead>
                        <tr>
                          <th scope="col" className="text-left px-1.5 py-1">Facture</th>
                          <th scope="col" className="text-left px-1.5">Date</th>
                          <th scope="col" className="text-left px-1.5">Échéance</th>
                          <th scope="col" className="text-right px-1.5">Montant</th>
                          <th scope="col" className="text-left px-1.5">Imputation retenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupe.factures.map((f) => (
                          <tr key={f.id} className="border-t border-bord/50 align-top">
                            <td className="px-1.5 py-[3px]">
                              {f.piece != null ? `n° ${f.piece} · ` : ''}
                              {f.libelle}
                              {f.reportee && <div className="text-text-dim">Reportée de l'exercice précédent</div>}
                            </td>
                            <td className="px-1.5">{jour(f.date)}</td>
                            <td className="px-1.5">{jour(f.echeance)}</td>
                            <td className="px-1.5 text-right tabular-nums">{montant(f.montant)}</td>
                            <td className="px-1.5">
                              {f.imputations.length === 0
                                ? '·'
                                : f.imputations.map((x, i) => (
                                    <div key={i}>
                                      {montant(x.montant)} le {jour(x.date)} · {LIBELLE_FONDEMENT[x.fondement] ?? x.fondement}
                                    </div>
                                  ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {groupe.nonImpute.length > 0 && (
                  <div className="text-warning">
                    Non imputé · {groupe.nonImpute.map((x) => montant(x.montant)).join(', ')} · aucune facture ouverte du groupe ne le reçoit.
                  </div>
                )}
                {groupe.paiements.length > 0 && (
                  <div className="space-y-1.5">
                    {groupe.paiements.map((p) => (
                      <div key={p.id} className="border border-bord rounded-[3px] px-2 py-1">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            Paiement {p.piece != null ? `n° ${p.piece} ` : ''}du {jour(p.date)} · {montant(p.montant)} · {p.libelle}
                          </span>
                          {peutDeclarer && p.designable && p.validee && (
                            <span className="space-x-2 shrink-0">
                              {p.declarees.length === 0 ? (
                                <button type="button" className="text-sel hover:underline" disabled={envoi} onClick={() => ouvrirSaisie(p)}>
                                  Déclarer l'imputation
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="text-rouge hover:underline"
                                  disabled={envoi}
                                  onClick={() => {
                                    setSaisie(null);
                                    setErreur(null);
                                    setRetrait({ paiementId: p.id, motif: '' });
                                  }}
                                >
                                  Retirer l'imputation
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                        {!p.validee && <div className="text-text-dim">Au brouillard · seul un paiement validé se déclare.</div>}
                        {!p.designable && (
                          <div className="text-text-dim">
                            {p.motifNonDesignable ?? "Paiement d'un autre groupe, lu avec son report · il se déclare depuis son groupe."}
                          </div>
                        )}
                        {p.declarees.map((d) => (
                          <div key={d.id} className="text-text-dim">
                            {montant(d.montant)} déclarés · {LIBELLE_FONDEMENT[d.fondement] ?? d.fondement} · pièce {d.pieceReference} du {jour(d.pieceDate)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {peutDeclarer && saisie && (
                  <form onSubmit={declarer} className="border border-border-dark rounded-[3px] p-2 space-y-1.5">
                    <div className="grid grid-cols-[160px_1fr] gap-x-2 gap-y-1 items-center">
                      <label htmlFor={id('fondement')} className="text-right">
                        Fondement :
                      </label>
                      <select
                        id={id('fondement')}
                        value={saisie.fondement}
                        onChange={(e) => setSaisie((s) => (s ? { ...s, fondement: e.target.value as Fondement } : s))}
                        className="border border-border-dark px-2 py-1"
                      >
                        <option value="DECLARATION_DU_DEBITEUR">Déclaration du débiteur, au paiement</option>
                        <option value="QUITTANCE_ACCEPTEE">Quittance acceptée par le débiteur</option>
                      </select>
                      <label htmlFor={id('piece')} className="text-right">
                        Pièce :
                      </label>
                      <input
                        id={id('piece')}
                        required
                        minLength={3}
                        maxLength={120}
                        value={saisie.pieceReference}
                        onChange={(e) => setSaisie((s) => (s ? { ...s, pieceReference: e.target.value } : s))}
                        className="border border-border-dark px-2 py-1"
                      />
                      <label htmlFor={id('date-piece')} className="text-right">
                        Date de la pièce :
                      </label>
                      <input
                        id={id('date-piece')}
                        type="date"
                        required
                        value={saisie.pieceDate}
                        onChange={(e) => setSaisie((s) => (s ? { ...s, pieceDate: e.target.value } : s))}
                        className="border border-border-dark px-2 py-1"
                      />
                      {saisie.fondement === 'QUITTANCE_ACCEPTEE' && (
                        <>
                          <label htmlFor={id('preuve')} className="text-right">
                            Preuve de l'acceptation :
                          </label>
                          <input
                            id={id('preuve')}
                            required
                            minLength={3}
                            maxLength={300}
                            value={saisie.preuveAcceptation}
                            onChange={(e) => setSaisie((s) => (s ? { ...s, preuveAcceptation: e.target.value } : s))}
                            className="border border-border-dark px-2 py-1"
                          />
                        </>
                      )}
                      {groupe.factures
                        .filter((f) => f.ligneADesigner)
                        .map((f) => (
                          <PartFacture
                            key={f.id}
                            idChamp={id(`part-${f.id}`)}
                            libelle={`Part de la facture du ${jour(f.date)} (${montant(f.montant)}) :`}
                            valeur={saisie.parts[f.id] ?? ''}
                            onChange={(v) => setSaisie((s) => (s ? { ...s, parts: { ...s.parts, [f.id]: v } } : s))}
                          />
                        ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" disabled={envoi} onClick={() => setSaisie(null)} className="border border-bord rounded-[3px] px-3 py-[3px] disabled:opacity-50">
                        Annuler la saisie
                      </button>
                      <button type="submit" disabled={envoi} className="bg-sel text-white rounded-full px-3 py-[3px] font-semibold disabled:opacity-50">
                        Déclarer
                      </button>
                    </div>
                  </form>
                )}
                {peutDeclarer && retrait && (
                  <form onSubmit={retirer} className="border border-border-dark rounded-[3px] p-2 space-y-1.5">
                    <label htmlFor={id('motif-retrait')} className="block">
                      Motif du retrait :
                    </label>
                    <textarea
                      id={id('motif-retrait')}
                      required
                      rows={2}
                      minLength={3}
                      maxLength={500}
                      value={retrait.motif}
                      onChange={(e) => setRetrait((r) => (r ? { ...r, motif: e.target.value } : r))}
                      className="w-full border border-border-dark px-2 py-1"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" disabled={envoi} onClick={() => setRetrait(null)} className="border border-bord rounded-[3px] px-3 py-[3px] disabled:opacity-50">
                        Annuler la saisie
                      </button>
                      <button type="submit" disabled={envoi || retrait.motif.trim().length < 3} className="bg-sel text-white rounded-full px-3 py-[3px] font-semibold disabled:opacity-50">
                        Retirer
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
            <div className="flex justify-end">
              <button type="button" disabled={envoi} onClick={fermer} className="border border-bord rounded-[3px] px-3 py-[3px] disabled:opacity-50">
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </PortailModale>
  );
}

function PartFacture({ idChamp, libelle, valeur, onChange }: { idChamp: string; libelle: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <>
      <label htmlFor={idChamp} className="text-right">
        {libelle}
      </label>
      <input id={idChamp} inputMode="decimal" value={valeur} onChange={(e) => onChange(e.target.value)} className="border border-border-dark px-2 py-1 tabular-nums" />
    </>
  );
}
