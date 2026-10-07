import { Fragment, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useExercice } from '../lib/exercice';
import { useAuth } from '../lib/auth';
import type { Journal } from '../lib/types';
import { montant as fc } from '../lib/montants';
import { Aide } from '../components/chrome/Aide';

/**
 * P9 · LA PAIE DU MOIS AU JOURNAL, EN UNE ÉCRITURE.
 *
 * L'écran ne calcule rien et n'envoie aucun montant : il montre la
 * proposition que le serveur rejoue sur les bulletins émis du mois, et
 * n'envoie que ce qui appartient au cabinet · le journal, la date, le
 * libellé. Le serveur rejoue encore tout au moment de passer.
 */

/**
 * Les trois temps de l'écriture de paie, dans l'ordre du Guide d'application
 * SYSCOHADA (Partie 1 ch. 3 section 4, Application 10). L'impôt retenu est au
 * deuxième, jamais au troisième : c'est une retenue sur le salarié. Un
 * quatrième porte l'INPP et l'ONEM au 64 contre le 4428 · des impôts et taxes,
 * pas des charges sociales (décision T1 du 2026-10-07). Un cinquième transfère
 * les avantages en nature au 6617 par le 781 (§ 4.5), hors du 422 (audit
 * final F22).
 */
export const TITRE_BLOC_PAIE = {
  BRUT: '1 · Salaire brut dû au personnel',
  RETENUES: '2 · Retenues sur le salaire (cotisations ouvrières, impôt)',
  PATRONALES: '3 · Charges sociales patronales (CNSS)',
  IMPOTS_ET_TAXES_SUR_SALAIRES: '4 · Impôts et taxes sur salaires (INPP, ONEM)',
  AVANTAGES_EN_NATURE: '5 · Avantages en nature transférés (781)',
  // Relecture M3 · l'écriture d'origine d'un bulletin annulé, recopiée en
  // négatif ligne à ligne (AUDCIF art. 20, al. 2) · aucun temps du Guide.
  REPRISE_EN_NEGATIF: '6 · Reprise en négatif de l’écriture d’origine',
} as const;

type Bloc = keyof typeof TITRE_BLOC_PAIE;

interface PropositionPaieDuMois {
  moisDePaie: string;
  aPasser: { id: string; numero: number; nomComplet: string }[];
  dejaPasses: { numero: number; nomComplet: string; ecritureId: string }[];
  annulesApresPassation: { numero: number; nomComplet: string; ecritureId: string; ecritureNegatifId: string | null }[];
  /** C2 · annulés après passation que cette écriture reprendrait en négatif. */
  negatifsAPasser: { id: string; numero: number; nomComplet: string; ecritureId: string }[];
  refus: { numero: number; nomComplet: string; motifs: string[] }[];
  lignes: { bloc: Bloc; compte: string; intitule: string; sens: 'DEBIT' | 'CREDIT'; montantFc: number; negatif?: boolean }[];
  totalDebitFc: number;
  totalCreditFc: number;
  equilibree: boolean;
  solde422Fc: number;
  sommeDesNetsFc: number;
  reserves: string[];
  pieces: { id: string; numeroPiece: number | null; date: string; statut: 'BROUILLARD' | 'VALIDEE' }[];
}

const dernierJour = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};

export function PaieDuMois({ mois, apresChangement }: { mois: string; apresChangement: () => void }) {
  // Le droit se LIT ici, jamais reçu en prop · passé par l'écran parent sous
  // le nom `peutEcrire`, il satisfaisait le contrôle des écrans qui écrivent
  // sans que ce composant lise quoi que ce soit. Passer la paie au journal
  // est réservé au comptable (`@ReserveAuComptable`), d'où `peutValider`.
  const { peutValider } = useAuth();
  const { exerciceCourant } = useExercice();
  const [p, setP] = useState<PropositionPaieDuMois | null>(null);
  const [journaux, setJournaux] = useState<Journal[]>([]);
  const [journalId, setJournalId] = useState('');
  const [date, setDate] = useState(dernierJour(mois));
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  // C2 · la reprise en négatif se CONFIRME · décochée par défaut, elle a pu
  // être inscrite à la main quand la proposition le demandait.
  const [reprendreNegatifs, setReprendreNegatifs] = useState(false);

  const charger = useCallback(() => {
    setErreur('');
    api.get<PropositionPaieDuMois>(`/personnel/paie-du-mois/${mois}`).then(setP, (e: ApiError) => setErreur(e.message));
  }, [mois]);

  useEffect(() => {
    charger();
    setDate(dernierJour(mois));
    setMessage('');
    setReprendreNegatifs(false);
  }, [charger, mois]);

  useEffect(() => {
    if (!peutValider) return;
    api.get<Journal[]>('/journaux').then(
      (js) => {
        const actifs = js.filter((j) => j.estActif);
        setJournaux(actifs);
        // Le journal des opérations diverses est proposé, jamais imposé · le
        // cabinet peut avoir ouvert un journal de paie dédié.
        const od = actifs.find((j) => j.type === 'GENERAL');
        setJournalId((courant) => courant || od?.id || '');
      },
      () => undefined,
    );
  }, [peutValider]);

  const passer = () => {
    if (!exerciceCourant || !journalId) return;
    setEnCours(true);
    setErreur('');
    api
      .post<{ ecriture: { numeroPiece: number | null } }>(`/personnel/paie-du-mois/${mois}/comptabilisation`, {
        exerciceId: exerciceCourant.id,
        journalId,
        date,
        ...(p && p.negatifsAPasser.length > 0 ? { inscrireNegatifs: reprendreNegatifs } : {}),
      })
      .then(
        (r) => {
          setMessage(`Écriture de paie passée au brouillard, pièce n° ${r.ecriture.numeroPiece ?? ''}.`);
          setEnCours(false);
          charger();
          apresChangement();
        },
        (e: ApiError) => {
          setErreur(e.message);
          setEnCours(false);
        },
      );
  };

  const defaire = (ecritureId: string) => {
    setEnCours(true);
    setErreur('');
    api.delete(`/personnel/paie-du-mois/comptabilisation/${ecritureId}`).then(
      () => {
        setMessage('Comptabilisation annulée · les bulletins sont de nouveau à passer.');
        setEnCours(false);
        charger();
        apresChangement();
      },
      (e: ApiError) => {
        setErreur(e.message);
        setEnCours(false);
      },
    );
  };

  if (!p) return erreur ? <div className="ecran-seul text-danger mt-3">{erreur}</div> : null;
  const pieceDe = (id: string) => p.pieces.find((x) => x.id === id);
  const ecrituresPassees = [...new Set(p.dejaPasses.map((b) => b.ecritureId))];
  // C2 · l'écriture qui ne fait que reprendre un bulletin annulé en négatif
  // se défait de même, tant qu'elle est au brouillard.
  const reprisesSeules = [
    ...new Set(
      p.annulesApresPassation.flatMap((b) =>
        b.ecritureNegatifId && !ecrituresPassees.includes(b.ecritureNegatifId) ? [b.ecritureNegatifId] : [],
      ),
    ),
  ];
  const negatifsEnAttente = p.negatifsAPasser.length > 0;

  return (
    <div className="ecran-seul border border-border px-3.5 py-2.5 mt-3">
      <div className="font-semibold mb-1.5">Passation de la paie du mois au journal</div>

      {erreur && <div className="border border-danger/30 bg-danger-soft px-3 py-1.5 mb-2">{erreur}</div>}
      {message && <div className="border border-border bg-chrome px-3 py-1.5 mb-2">{message}</div>}

      {ecrituresPassees.map((id) => {
        const piece = pieceDe(id);
        const n = p.dejaPasses.filter((b) => b.ecritureId === id).map((b) => `n° ${b.numero}`);
        return (
          <div key={id} className="flex flex-wrap items-center gap-3 mb-1.5">
            <span>
              Bulletins {n.join(', ')} passés dans la pièce n° {piece?.numeroPiece ?? '·'}
              {piece?.statut === 'VALIDEE' ? ' (validée)' : ' (au brouillard)'}.
            </span>
            {peutValider && piece?.statut === 'BROUILLARD' && (
              <button type="button" disabled={enCours} onClick={() => defaire(id)} className="px-2.5 py-1 border border-border">
                Annuler la comptabilisation
              </button>
            )}
          </div>
        );
      })}

      {reprisesSeules.map((id) => {
        const piece = pieceDe(id);
        const n = p.annulesApresPassation.filter((b) => b.ecritureNegatifId === id).map((b) => `n° ${b.numero}`);
        return (
          <div key={id} className="flex flex-wrap items-center gap-3 mb-1.5">
            <span>
              Bulletins annulés {n.join(', ')} repris en négatif dans la pièce n° {piece?.numeroPiece ?? '·'}
              {piece?.statut === 'VALIDEE' ? ' (validée)' : ' (au brouillard)'}.
            </span>
            {peutValider && piece?.statut === 'BROUILLARD' && (
              <button type="button" disabled={enCours} onClick={() => defaire(id)} className="px-2.5 py-1 border border-border">
                Annuler la comptabilisation
              </button>
            )}
          </div>
        );
      })}

      {negatifsEnAttente && (
        <div className="border border-warning/40 bg-warning/5 px-3 py-1.5 mb-2">
          Annulé(s) après passation, à reprendre en négatif :{' '}
          {p.negatifsAPasser.map((b) => `n° ${b.numero} (${b.nomComplet})`).join(', ')}.
          <Aide
            titre="Reprise en négatif d’un bulletin annulé"
            texte="Le salaire d’un bulletin passé puis annulé reste dans l’écriture validée qui l’a passé. La passation du mois le reprend en négatif, ligne à ligne, à côté du bulletin réémis · seule la différence pèse sur l’exercice où l’écriture est passée. Erreur d’un exercice clôturé · elle se corrige dans les comptes de l’exercice en cours, avec la date de valeur du mois, et se dit aux Notes annexes ; significative, elle passe par le report à nouveau. Un négatif déjà inscrit à la main se contre-passe d’abord."
            source="AUDCIF art. 20, al. 2 à 4 ; art. 22, 4°"
          />
        </div>
      )}

      {p.refus.length > 0 && (
        <div className="border border-warning/40 bg-warning/5 px-3 py-2 mb-2">
          <div className="font-semibold mb-1">La paie du mois n’est pas passée</div>
          <ul>
            {p.refus.map((r) => (
              <li key={r.numero} className="py-0.5 border-t border-border/40">
                Bulletin n° {r.numero} · {r.nomComplet} · {r.motifs.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.aPasser.length === 0 && !negatifsEnAttente && p.refus.length === 0 && (
        <div className="text-text-dim">Aucun bulletin émis à passer pour ce mois.</div>
      )}

      {p.lignes.length > 0 && (
        <>
          <div className="text-text-dim mb-1">
            {p.aPasser.length} bulletin(s) à passer
            {p.aPasser.length > 0 ? ` : ${p.aPasser.map((b) => `n° ${b.numero}`).join(', ')}` : ''}
            {negatifsEnAttente ? ` · ${p.negatifsAPasser.length} repris en négatif : ${p.negatifsAPasser.map((b) => `n° ${b.numero}`).join(', ')}` : ''}.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="py-1">Compte</th>
                  <th className="py-1">Intitulé</th>
                  <th className="py-1 text-right">Débit</th>
                  <th className="py-1 text-right">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {p.lignes.map((l, i, tout) => (
                  <Fragment key={i}>
                    {(i === 0 || tout[i - 1].bloc !== l.bloc) && (
                      <tr>
                        <td colSpan={4} className="pt-2 pb-1 font-semibold">
                          {TITRE_BLOC_PAIE[l.bloc]}
                        </td>
                      </tr>
                    )}
                    <tr className={l.negatif ? 'text-text-dim' : undefined}>
                      <td className="py-1 pr-2 font-mono">{l.compte}</td>
                      <td className="py-1 pr-2">{l.intitule}</td>
                      <td className="py-1 pr-2 text-right font-mono">{l.sens === 'DEBIT' ? fc(l.montantFc) : ''}</td>
                      <td className="py-1 text-right font-mono">{l.sens === 'CREDIT' ? fc(l.montantFc) : ''}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="py-1" colSpan={2}>
                    Totaux
                  </td>
                  <td className="py-1 pr-2 text-right font-mono">{fc(p.totalDebitFc)}</td>
                  <td className="py-1 text-right font-mono">{fc(p.totalCreditFc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="text-text-dim mt-1">
            Solde du 422 après l’écriture : {fc(p.solde422Fc)} FC, net à payer des bulletins : {fc(p.sommeDesNetsFc)} FC.
          </div>

          {peutValider && (
            <div className="flex flex-wrap items-end gap-3 mt-2.5">
              <label className="flex flex-col gap-0.5">
                Journal
                <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className="border border-border px-2 py-1">
                  <option value="">Choisir un journal</option>
                  {journaux.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} · {j.intitule}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-border px-2 py-1" />
              </label>
              {negatifsEnAttente && (
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={reprendreNegatifs} onChange={(e) => setReprendreNegatifs(e.target.checked)} />
                  Reprendre en négatif les bulletins annulés
                </label>
              )}
              <button
                type="button"
                disabled={!journalId || !date || !exerciceCourant || enCours || !p.equilibree || (negatifsEnAttente && !reprendreNegatifs)}
                onClick={passer}
                className="bg-sel text-white rounded-[3px] px-3 py-[3px] text-[11.5px] font-semibold hover:opacity-90 disabled:opacity-40"
              >
                {enCours ? 'Enregistrement…' : 'Passer l’écriture de paie'}
              </button>
            </div>
          )}
        </>
      )}

      <ul className="mt-2 text-[11px] text-text-dim">
        {p.reserves.map((r, i) => (
          <li key={i} className="py-0.5 border-t border-border/40">
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
