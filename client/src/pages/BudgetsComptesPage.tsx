import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { Aide } from '../components/chrome/Aide';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import type { Compte } from '../lib/types';
import { montant } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';
import {
  NOMS_DES_MOIS,
  moisDeLExercice,
  type BudgetDuCompte,
  type EtatBudgetComptes,
  type LigneBudgetCompte,
  type NatureBudget,
} from '../lib/budget-compte';

/**
 * BUDGETS DES COMPTES GÉNÉRAUX (fonction n° 51) · Sage dote un budget sur le
 * compte général (volet Budget du compte) et compare la réalisation à
 * l'exercice précédent (états budgétaires). Deux entrées de menu, une fenêtre ·
 * Structure → Analytique → Budgets des comptes ouvre la DOTATION
 * (administrateur), État → Suivi et prévision → Budget des comptes ouvre la
 * COMPARAISON (tous). Le serveur sert l'écart, le sens défavorable et le hors
 * budget ; rien ne se recalcule ici, et un compte non doté n'a pas de budget,
 * jamais un budget à zéro.
 */

type Onglet = 'comparaison' | 'dotation';

const TEXTE_AIDE =
  "Le budget se porte sur un compte de détail des classes 6 et 7 · le résultat budgété est celui des activités ordinaires, comme au simulateur budgétaire. Le réalisé est le mouvement de l'exercice, écriture de clôture des comptes de gestion exclue, brouillard compris ; une charge se lit débit moins crédit, un produit crédit moins débit. L'écart est le budget moins le réalisé ; il est défavorable quand une charge dépasse son budget ou qu'un produit n'y arrive pas. Un compte mouvementé sans budget est « hors budget ». N-1 est l'exercice qui précède, au même mois quand un mois est choisi. La dotation annuelle se répartit sur les mois de l'exercice au centime, le reliquat sur le dernier ; chaque mois se retouche, l'année suit. Ce budget n'entre dans aucun état financier.";

export function BudgetsComptesPage({ ongletInitial = 'comparaison' }: { ongletInitial?: Onglet }) {
  const { estAdmin } = useAuth();
  const { exerciceCourant } = useExercice();
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial);
  const [mois, setMois] = useState(0);
  const [etat, setEtat] = useState<EtatBudgetComptes | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);

  // Dotation · les comptes partent de null, une lecture tombée se dit.
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [compteId, setCompteId] = useState('');
  const [montantAnnuel, setMontantAnnuel] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [detail, setDetail] = useState<{ compte: LigneBudgetCompte; budget: BudgetDuCompte | null } | null>(null);
  const [moisSaisis, setMoisSaisis] = useState<Record<number, string>>({});

  const modifiable = estAdmin && exerciceCourant?.statut !== 'CLOTURE';
  const echec = (e: unknown, defaut: string) => setErreur(e instanceof ApiError ? e.message : defaut);

  useEffect(() => {
    if (!exerciceCourant) return;
    setEtat(null);
    setErreur(null);
    // La dotation lit l'exercice entier · un budget se dote à l'année.
    const m = onglet === 'comparaison' && mois ? `&mois=${mois}` : '';
    api
      .get<EtatBudgetComptes>(`/analytique/etats/budget-comptes?exerciceId=${exerciceCourant.id}${m}`)
      .then(setEtat, (e) => echec(e, "L'état des budgets n'a pas pu être lu."));
  }, [exerciceCourant?.id, mois, onglet, rechargement]);

  useEffect(() => {
    if (!modifiable || onglet !== 'dotation') return;
    api
      .get<Compte[]>('/comptes?actifsSeuls=true&typeCompte=DETAIL&retenus=true')
      .then((cs) => setComptes(cs.filter((c) => c.classe === 'CLASSE_6' || c.classe === 'CLASSE_7')), (e) =>
        echec(e, "Les comptes n'ont pas pu être lus."),
      );
  }, [modifiable, onglet]);

  const moisExercice = useMemo(
    () => (etat ? moisDeLExercice(etat.exercice.dateDebut, etat.exercice.dateFin) : []),
    [etat?.exercice.dateDebut, etat?.exercice.dateFin],
  );

  const doter = async () => {
    if (!exerciceCourant) return;
    const m = montantSaisi(montantAnnuel);
    if (m === null) {
      setErreur('Le montant annuel est à saisir · zéro se tape.');
      return;
    }
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    try {
      await api.post(`/analytique/comptes/${compteId}/budget`, { exerciceId: exerciceCourant.id, montantAnnuel: m });
      setInfo("Budget doté · réparti sur les mois de l'exercice.");
      setMontantAnnuel('');
      setCompteId('');
      setRechargement((n) => n + 1);
    } catch (e) {
      echec(e, "Le budget n'a pas pu être doté.");
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrirDetail = (l: LigneBudgetCompte) => {
    if (!exerciceCourant) return;
    setDetail({ compte: l, budget: null });
    setMoisSaisis({});
    api.get<BudgetDuCompte>(`/analytique/comptes/${l.compteId}/budget?exerciceId=${exerciceCourant.id}`).then(
      (b) => {
        setDetail({ compte: l, budget: b });
        setMoisSaisis(Object.fromEntries(b.mensuel.map((x) => [x.mois, String(x.montant).replace('.', ',')])));
      },
      (e) => echec(e, "Le budget du compte n'a pas pu être lu."),
    );
  };

  const enregistrerMois = async (m: number) => {
    if (!exerciceCourant || !detail) return;
    const v = montantSaisi(moisSaisis[m] ?? '');
    if (v === null) {
      setErreur(`Le montant de ${NOMS_DES_MOIS[m - 1]} est à saisir · zéro se tape.`);
      return;
    }
    setErreur(null);
    try {
      const b = await api.patch<BudgetDuCompte>(`/analytique/comptes/${detail.compte.compteId}/budget`, {
        exerciceId: exerciceCourant.id,
        mois: m,
        montant: v,
      });
      setDetail({ ...detail, budget: b });
      setRechargement((n) => n + 1);
    } catch (e) {
      echec(e, "Le mois n'a pas pu être retouché.");
    }
  };

  const retirer = async (l: LigneBudgetCompte) => {
    if (!exerciceCourant) return;
    if (!window.confirm(`Retirer le budget du compte ${l.numero} sur l'exercice ? Ses mouvements deviendront « hors budget ».`)) return;
    setErreur(null);
    try {
      await api.delete(`/analytique/comptes/${l.compteId}/budget?exerciceId=${exerciceCourant.id}`);
      setDetail(null);
      setInfo('Budget retiré.');
      setRechargement((n) => n + 1);
    } catch (e) {
      echec(e, "Le budget n'a pas pu être retiré.");
    }
  };

  const colonnes = 'grid-cols-[110px_1fr_130px_130px_130px_70px_130px]';
  const ongletClasse = (o: Onglet) =>
    `px-4 py-1.5 text-[11.5px] font-bold ${onglet === o ? 'bg-surface border-x border-border' : 'text-text-dim'}`;

  const bloc = (nature: NatureBudget, titre: string) => {
    if (!etat) return null;
    const lignes = etat.lignes.filter((l) => l.nature === nature && (onglet === 'comparaison' || l.budget !== null));
    const t = nature === 'CHARGE' ? etat.totaux.charges : etat.totaux.produits;
    return (
      <Fragment key={nature}>
        <div className={`grid ${colonnes} min-w-[900px] gap-2 px-4 py-1 bg-chrome-alt text-[11px] font-bold border-y border-border`}>
          <span />
          <span>{titre}</span>
        </div>
        {lignes.map((l) => (
          <div
            key={l.compteId}
            className={`grid ${colonnes} min-w-[900px] gap-2 px-4 py-1 text-[11.5px] border-b border-border/40 items-center ${
              l.horsBudget ? 'bg-danger-soft' : l.defavorable ? 'bg-warning-soft' : ''
            }`}
          >
            <span className="font-mono">{l.numero}</span>
            <span className="truncate">
              {l.intitule}
              {l.horsBudget && <span className="ml-2 text-[11px] font-bold text-danger">hors budget</span>}
            </span>
            <span className="text-right font-mono">{l.budget === null ? '' : montant(l.budget)}</span>
            <span className="text-right font-mono">{montant(l.realise)}</span>
            <span className={`text-right font-mono ${l.defavorable ? 'text-danger font-bold' : ''}`}>
              {l.ecart === null ? '' : montant(l.ecart)}
            </span>
            <span className="text-right font-mono text-text-dim">
              {l.tauxRealisation === null ? '' : `${l.tauxRealisation.toFixed(0)} %`}
            </span>
            <span className="text-right font-mono text-text-dim">
              {onglet === 'dotation' && modifiable ? (
                <button type="button" onClick={() => ouvrirDetail(l)} className="text-sel hover:underline font-sans">
                  Mois…
                </button>
              ) : l.realiseN1 === null ? (
                ''
              ) : (
                montant(l.realiseN1)
              )}
            </span>
          </div>
        ))}
        {lignes.length === 0 && (
          <div className="px-4 py-2 text-[11.5px] text-text-dim italic">
            {onglet === 'dotation' ? 'Aucun compte doté.' : 'Aucun compte doté ni mouvementé.'}
          </div>
        )}
        <div className={`grid ${colonnes} min-w-[900px] gap-2 px-4 py-1 text-[11.5px] font-bold border-b border-border`}>
          <span />
          <span>Total {titre.toLowerCase()}</span>
          <span className="text-right font-mono">{montant(t.budget)}</span>
          <span className="text-right font-mono">{montant(t.realise)}</span>
          <span />
          <span />
          <span className="text-right font-mono">{onglet === 'comparaison' && t.realiseN1 !== null ? montant(t.realiseN1) : ''}</span>
        </div>
      </Fragment>
    );
  };

  return (
    <div className="p-2 flex flex-col gap-2">
      <EnteteImpression titre="Budgets des comptes" />
      <div className="flex items-end justify-end gap-2.5">
        <span className="pb-1.5">
          <Aide titre="Budget par compte" texte={TEXTE_AIDE} source="Convention d'OmegaX (Sage, budget du compte général)" />
        </span>
        {onglet === 'comparaison' && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Période</span>
            <select
              value={mois}
              onChange={(e) => setMois(Number(e.target.value))}
              className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px]"
            >
              <option value={0}>Exercice entier</option>
              {moisExercice.map((m) => (
                <option key={m} value={m}>
                  {NOMS_DES_MOIS[m - 1]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {erreur && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 rounded-[3px] px-2.5 py-1.5">{erreur}</div>
      )}
      {info && (
        <div className="text-[11.5px] text-positive bg-positive-soft border border-positive/30 rounded-[3px] px-2.5 py-1.5">{info}</div>
      )}

      <div>
        <div className="flex bg-chrome border border-border border-b-0 rounded-t-[10px] overflow-hidden">
          <button onClick={() => setOnglet('comparaison')} className={ongletClasse('comparaison')}>
            Comparaison
          </button>
          <button onClick={() => setOnglet('dotation')} className={ongletClasse('dotation')}>
            Dotation
          </button>
        </div>
        <div className="border border-border bg-surface rounded-b-[10px] overflow-x-auto">
          <div className={`grid ${colonnes} min-w-[900px] gap-2 px-4 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim`}>
            <span>COMPTE</span>
            <span>Intitulé</span>
            <span className="text-right">BUDGET</span>
            <span className="text-right">Réalisé</span>
            <span className="text-right">Écart</span>
            <span className="text-right">%</span>
            <span className="text-right">{onglet === 'dotation' ? '' : 'Réalisé N-1'}</span>
          </div>
          {!etat && !erreur && <div className="px-4 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
          {etat && (
            <>
              {bloc('CHARGE', 'Charges')}
              {bloc('PRODUIT', 'Produits')}
              <div className={`grid ${colonnes} min-w-[900px] gap-2 px-4 py-1.5 bg-chrome text-[11.5px] font-bold`}>
                <span />
                <span>Résultat des activités ordinaires</span>
                <span className="text-right font-mono">{montant(etat.totaux.resultat.budget)}</span>
                <span className="text-right font-mono">{montant(etat.totaux.resultat.realise)}</span>
                <span />
                <span />
                <span className="text-right font-mono">
                  {onglet === 'comparaison' && etat.totaux.resultat.realiseN1 !== null ? montant(etat.totaux.resultat.realiseN1) : ''}
                </span>
              </div>
              {onglet === 'comparaison' && (
                <div className="px-4 py-1 text-[11px] text-text-dim border-t border-border/40">
                  Du {etat.periode.du.split('-').reverse().join('/')} au {etat.periode.au.split('-').reverse().join('/')} · brouillard
                  compris
                  {etat.exercicePrecedent
                    ? ` · N-1 du ${etat.exercicePrecedent.du.split('-').reverse().join('/')} au ${etat.exercicePrecedent.au.split('-').reverse().join('/')}`
                    : ` · N-1 non lu : ${etat.motifN1 ?? ''}`}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {onglet === 'dotation' && modifiable && (
        <div className="border border-border bg-surface rounded-[10px] p-3 flex flex-wrap items-end gap-3 text-[11.5px]">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Compte</span>
            <select
              value={compteId}
              onChange={(e) => setCompteId(e.target.value)}
              className="border border-border rounded-[3px] bg-surface px-2 py-1 min-w-[300px]"
            >
              <option value="">
                {comptes === null
                  ? 'Chargement…'
                  : comptes.length === 0
                    ? 'Aucun compte personnalisé des classes 6 et 7 · personnalisez-le dans Plan comptable'
                    : 'Compte…'}
              </option>
              {comptes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.intitule}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Budget annuel</span>
            <input
              value={montantAnnuel}
              inputMode="decimal"
              onChange={(e) => setMontantAnnuel(e.target.value)}
              className="border border-border rounded-[3px] px-2 py-1 w-[160px] text-right"
            />
          </label>
          <button
            type="button"
            disabled={envoi || !compteId}
            onClick={() => void doter()}
            className="bg-sel text-white font-semibold px-4 py-1 rounded-full disabled:opacity-50"
          >
            Doter le compte
          </button>
        </div>
      )}
      {onglet === 'dotation' && !modifiable && (
        <div className="text-[11.5px] text-text-dim">
          {exerciceCourant?.statut === 'CLOTURE'
            ? "L'exercice est clôturé · son budget se lit, il ne se modifie plus."
            : "La dotation des budgets est réservée à l'administrateur du dossier."}
        </div>
      )}

      {detail && (
        <div className="border border-border bg-surface rounded-[10px] p-3 flex flex-col gap-2 text-[11.5px]">
          <div className="flex items-center justify-between">
            <span className="font-bold">
              {detail.compte.numero} · {detail.compte.intitule}
            </span>
            <span className="flex gap-3">
              <button type="button" onClick={() => void retirer(detail.compte)} className="text-danger hover:underline">
                Retirer le budget
              </button>
              <button type="button" onClick={() => setDetail(null)} className="border border-border px-2.5 py-0.5">
                Fermer
              </button>
            </span>
          </div>
          {!detail.budget && <div className="text-text-dim">Chargement…</div>}
          {detail.budget && detail.budget.mensuel.length === 0 && (
            <div className="text-text-dim">Sur un exercice de plus de douze mois, le budget reste annuel.</div>
          )}
          {detail.budget && detail.budget.mensuel.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
              {detail.budget.mensuel.map((m) => (
                <label key={m.mois} className="flex items-center gap-1.5">
                  <span className="w-[44px] text-text-dim">{NOMS_DES_MOIS[m.mois - 1]}</span>
                  <input
                    value={moisSaisis[m.mois] ?? ''}
                    inputMode="decimal"
                    onChange={(e) => setMoisSaisis((prev) => ({ ...prev, [m.mois]: e.target.value }))}
                    onBlur={() => {
                      const v = montantSaisi(moisSaisis[m.mois] ?? '');
                      if (v !== null && Math.round(v * 100) !== Math.round(m.montant * 100)) void enregistrerMois(m.mois);
                    }}
                    aria-label={`Budget de ${NOMS_DES_MOIS[m.mois - 1]}`}
                    className="border border-border rounded-[3px] px-1.5 py-0.5 w-[100px] text-right"
                  />
                </label>
              ))}
            </div>
          )}
          {detail.budget && detail.budget.annuel !== null && (
            <div className="font-bold">Année · {montant(detail.budget.annuel)}</div>
          )}
        </div>
      )}
    </div>
  );
}
