import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useExercice } from '../../lib/exercice';
import { montant as fc } from '../../lib/montants';
import { dateCourte } from '../../lib/conges-paie';
import { Aide } from '../chrome/Aide';
import { BoutonsPaie, CHAMP_PAIE, ChampPaie, ModalePaie, useEnvoiPaie } from './ModalePaie';
import {
  LIBELLE_MODE,
  MODES,
  journauxDuMode,
  lireCoupures,
  type Billetage,
  type ModePaiement,
  type PaiementLu,
  type PropositionPaiement,
} from '../../lib/paiement-salaires';

const dernierJour = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};

const LIBELLE_ORDRE = { A_IMPRIMER: 'à imprimer', IMPRIME: 'imprimé', ANNULE: 'annulé' } as const;

/**
 * LIGNE SAGE-L5, FONCTION 75 · LE PAIEMENT DES SALAIRES DU MOIS, sous la
 * passation, dans l'onglet Bulletins de la fenêtre Personnel. Tout ce qui est
 * chiffré vient du SERVEUR (reste à payer, billetage, refus) ; l'écran choisit
 * le mode, le journal, la date, les salariés et les chèques. Payer et annuler
 * écrivent au livre-journal · `peutValider`, comme la passation.
 */
export function PaiementSalaires({ mois }: { mois: string }) {
  const { peutValider } = useAuth();
  const { exerciceCourant } = useExercice();
  // Null tant que la proposition n'est pas LUE.
  const [p, setP] = useState<PropositionPaiement | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<ModePaiement>('VIREMENT');
  const [journalId, setJournalId] = useState('');
  const [date, setDate] = useState(dernierJour(mois));
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [cheques, setCheques] = useState<Record<string, string>>({});
  const [coupures, setCoupures] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<PaiementLu | null>(null);
  const jeton = useRef(0);

  const charger = useCallback(
    (avecCoupures?: number[]) => {
      const moi = ++jeton.current;
      setErreur('');
      const q = avecCoupures && avecCoupures.length ? `?coupures=${avecCoupures.join(',')}` : '';
      api.get<PropositionPaiement>(`/personnel/paiement-salaires/${mois}${q}`).then(
        (r) => {
          if (moi !== jeton.current) return;
          setP(r);
          setCoupures((c) => (c.trim() === '' ? r.coupuresProposees.join(' ') : c));
        },
        (e: ApiError) => {
          if (moi === jeton.current) setErreur(e.message);
        },
      );
    },
    [mois],
  );

  useEffect(() => {
    setP(null);
    setCoches(new Set());
    setCheques({});
    setMessage('');
    setDate(dernierJour(mois));
    charger();
  }, [charger, mois]);

  const lignesDuMode = useMemo(() => (p ? p.aPayer.filter((l) => l.mode === mode) : []), [p, mode]);
  const journaux = useMemo(() => (p ? journauxDuMode(p.journaux, mode) : []), [p, mode]);
  // Un choix unique se présélectionne · plusieurs, le cabinet choisit.
  useEffect(() => {
    setJournalId((courant) => (journaux.some((j) => j.id === courant) ? courant : journaux.length === 1 ? journaux[0].id : ''));
  }, [journaux]);

  const total = lignesDuMode.filter((l) => coches.has(l.bulletinId)).reduce((n, l) => n + Math.round(l.montant * 100), 0) / 100;

  const basculer = (id: string) =>
    setCoches((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const calculerBilletage = () => {
    const lues = lireCoupures(coupures);
    if (lues === null) {
      setErreur('Une coupure est illisible · tapez des valeurs positives séparées par des espaces (20000 10000 5000).');
      return;
    }
    charger(lues);
  };

  const payer = () => {
    if (!exerciceCourant || !journalId) return;
    const ids = lignesDuMode.filter((l) => coches.has(l.bulletinId)).map((l) => l.bulletinId);
    const lues = mode === 'ESPECES' ? lireCoupures(coupures) : [];
    if (lues === null) {
      setErreur('Une coupure est illisible · corrigez-la ou videz le champ.');
      return;
    }
    setEnCours(true);
    setErreur('');
    setMessage('');
    api
      .post<{ piecePassee: string; total: number; ordreVirement: { numero: number } | null }>(`/personnel/paiement-salaires/${mois}`, {
        mode,
        exerciceId: exerciceCourant.id,
        journalId,
        date,
        bulletinIds: ids,
        ...(mode === 'CHEQUE' ? { references: ids.map((id) => ({ bulletinId: id, reference: cheques[id] ?? '' })) } : {}),
        ...(mode === 'ESPECES' && lues && lues.length ? { coupures: lues } : {}),
      })
      .then(
        (r) => {
          setMessage(
            `Paiement passé au brouillard, pièce ${r.piecePassee}, ${fc(r.total)}` +
              (r.ordreVirement ? ` · ordre de virement n° ${r.ordreVirement.numero}, à imprimer dans Règlement des tiers.` : '.'),
          );
          setEnCours(false);
          setCoches(new Set());
          charger(mode === 'ESPECES' && lues ? lues : undefined);
        },
        (e: ApiError) => {
          setErreur(e.message);
          setEnCours(false);
        },
      );
  };

  if (!p) {
    return (
      <div className="ecran-seul border border-border px-3.5 py-2.5 mt-3">
        <div className="font-semibold mb-1.5">Paiement des salaires du mois</div>
        {erreur ? <div className="text-danger">{erreur}</div> : <div className="text-text-dim">Chargement…</div>}
      </div>
    );
  }

  const sansMode = p.aPayer.filter((l) => l.mode === null);

  return (
    <div className="ecran-seul border border-border px-3.5 py-2.5 mt-3">
      <div className="font-semibold mb-1.5 flex items-center gap-1.5">
        Paiement des salaires du mois
        <Aide
          titre="Paiement des salaires du mois"
          texte="Les bulletins émis du mois se paient ici, par le mode convenu avec chaque salarié. Le paiement passe au brouillard une écriture qui débite le 422 (Personnel, rémunérations dues) par le crédit du journal de trésorerie choisi, une caisse pour les espèces, une banque pour le virement et le chèque. Un virement fait naître l'ordre de virement, qui s'imprime dans Règlement des tiers ; un paiement en espèces garde le billetage des coupures déclarées, ventilé par les plus grosses coupures d'abord, et ce qui ne s'y ventile pas est dit. Un bulletin annulé déjà payé n'est pas payé deux fois · le bulletin réémis ne paie que la différence. Le salaire du mois se paie au plus tard six jours après la fin du mois ; les sommes dues à la fin du contrat, dans les deux jours ouvrables. Le décompte écrit se remet au moment du paiement."
          source="Code du travail, art. 98 à 100 et 103 · fiche du compte 42 des deux plans · AUDCIF art. 17, 3° et 5°"
        />
      </div>
      {erreur && (
        <div role="alert" className="border border-danger/30 bg-danger-soft px-3 py-1.5 mb-2">
          {erreur}
        </div>
      )}
      {message && <div className="border border-border bg-chrome px-3 py-1.5 mb-2">{message}</div>}
      <div className="text-text-dim mb-1.5" title="Code du travail, art. 99, al. 2">
        Salaire du mois à payer au plus tard le {dateCourte(p.echeanceArticle99)}.
      </div>
      {p.tronque && <div className="text-warning mb-1.5">Mois tronqué · seuls les premiers bulletins sont lus.</div>}
      {p.tropPayes.map((t) => (
        <div key={t.bulletinId} className="border border-warning/40 bg-warning/5 px-3 py-1.5 mb-1.5">
          Bulletin n° {t.numero} · {t.nomComplet} · un bulletin annulé du mois a déjà versé {fc(t.dejaPaye)}, {fc(t.excedent)} de plus que
          ce net ({fc(t.netAPayer)}).
        </div>
      ))}
      {(p.versementsSansBulletin ?? []).map((v) => (
        <div key={v.bulletinId} role="alert" className="border border-warning/40 bg-warning/5 px-3 py-1.5 mb-1.5">
          Bulletin n° {v.numero} · {v.nomComplet} · annulé après avoir été payé ({fc(v.montant)}
          {v.pieces.length ? `, ${v.pieces.map((x) => `pièce ${x.piece ?? '·'} du ${dateCourte(x.date)}`).join(', ')}` : ''}), et aucun bulletin
          émis du mois ne le remplace · le versement reste au journal sans bulletin. Réémettez le bulletin du mois, sur lequel il s’imputera, ou
          annulez le paiement.
        </div>
      ))}
      {p.confrontation422?.avertissement && (
        <div role="alert" className="border border-warning/40 bg-warning/5 px-3 py-1.5 mb-1.5">
          {p.confrontation422.avertissement}
        </div>
      )}
      {sansMode.length > 0 && (
        <div className="border border-warning/40 bg-warning/5 px-3 py-1.5 mb-1.5">
          Mode de paiement pas encore dit pour {sansMode.map((l) => l.nomComplet).join(', ')} · déclarez-le dans le Registre du personnel.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-1.5" role="group" aria-label="Mode du paiement">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setCoches(new Set());
            }}
            className={`px-2.5 py-1 border ${mode === m ? 'border-sel text-sel font-semibold' : 'border-border'}`}
          >
            {LIBELLE_MODE[m]} ({p.aPayer.filter((l) => l.mode === m).length})
          </button>
        ))}
      </div>

      {lignesDuMode.length === 0 ? (
        <div className="text-text-dim mb-2">Aucun bulletin émis à payer par {LIBELLE_MODE[mode].toLowerCase()} pour ce mois.</div>
      ) : (
        <div className="overflow-x-auto mb-2">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                {peutValider && (
                  <th className="px-2 py-1 w-[34px]">
                    <input
                      type="checkbox"
                      aria-label="Tout cocher"
                      checked={lignesDuMode.every((l) => coches.has(l.bulletinId))}
                      onChange={(e) => setCoches(e.target.checked ? new Set(lignesDuMode.map((l) => l.bulletinId)) : new Set())}
                    />
                  </th>
                )}
                <th className="text-left px-2 py-1">Bulletin</th>
                <th className="text-left px-2 py-1">Salarié</th>
                <th className="text-right px-2 py-1">Net à payer</th>
                <th className="text-right px-2 py-1" title="Ce qu'un bulletin annulé du même mois a déjà versé">
                  Déjà versé
                </th>
                <th className="text-right px-2 py-1">À payer</th>
                {mode === 'VIREMENT' && <th className="text-left px-2 py-1">RIB principal</th>}
                {mode === 'CHEQUE' && <th className="text-left px-2 py-1">N° du chèque</th>}
                <th className="text-left px-2 py-1">Passé au journal</th>
              </tr>
            </thead>
            <tbody>
              {lignesDuMode.map((l) => (
                <tr key={l.bulletinId}>
                  {peutValider && (
                    <td className="px-2 py-1">
                      <input type="checkbox" aria-label={`Payer ${l.nomComplet}`} checked={coches.has(l.bulletinId)} onChange={() => basculer(l.bulletinId)} />
                    </td>
                  )}
                  <td className="px-2 py-1">
                    n° {l.numero}
                    {l.nature === 'DECOMPTE_FINAL' ? ' · décompte final' : ''}
                  </td>
                  <td className="px-2 py-1">{l.nomComplet}</td>
                  <td className="px-2 py-1 text-right">{fc(l.netAPayer)}</td>
                  <td className="px-2 py-1 text-right">{l.dejaPayeAutres > 0 ? fc(l.dejaPayeAutres) : ''}</td>
                  <td className="px-2 py-1 text-right">{fc(l.montant)}</td>
                  {mode === 'VIREMENT' && <td className="px-2 py-1">{l.rib ?? <span className="text-warning">Aucun RIB principal</span>}</td>}
                  {mode === 'CHEQUE' && (
                    <td className="px-2 py-1">
                      <input
                        aria-label={`Chèque de ${l.nomComplet}`}
                        disabled={!peutValider}
                        value={cheques[l.bulletinId] ?? ''}
                        onChange={(e) => setCheques({ ...cheques, [l.bulletinId]: e.target.value })}
                        className={`${CHAMP_PAIE} w-[120px]`}
                      />
                    </td>
                  )}
                  <td className="px-2 py-1">{l.passeAuJournal ? 'Oui' : <span className="text-warning">Pas encore</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'ESPECES' && lignesDuMode.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="text-text-dim">Coupures</span>
              <input
                aria-label="Coupures déclarées"
                placeholder="20000 10000 5000 1000 500"
                value={coupures}
                onChange={(e) => setCoupures(e.target.value)}
                className={`${CHAMP_PAIE} w-[260px]`}
              />
            </label>
            <button type="button" className="border border-border px-2.5 py-1" onClick={calculerBilletage}>
              Calculer le billetage
            </button>
          </div>
          {p.billetage && <TableBilletage billetage={p.billetage} />}
        </div>
      )}

      {peutValider && lignesDuMode.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 mb-2">
          <label className="flex flex-col">
            <span className="text-text-dim">Journal</span>
            <select aria-label="Journal du paiement" value={journalId} onChange={(e) => setJournalId(e.target.value)} className={`${CHAMP_PAIE} w-auto`}>
              <option value="">{journaux.length ? 'Choisir…' : mode === 'ESPECES' ? 'Aucun journal de caisse' : 'Aucun journal de banque'}</option>
              {journaux.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} · {j.intitule}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="text-text-dim">Date</span>
            <input aria-label="Date du paiement" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${CHAMP_PAIE} w-auto`} />
          </label>
          <button
            type="button"
            disabled={enCours || !journalId || !date || !exerciceCourant || coches.size === 0}
            onClick={payer}
            className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-50"
          >
            {enCours ? 'Envoi…' : `Payer ${fc(total)}`}
          </button>
          {journaux.length === 0 && (
            <span className="text-warning">
              {mode === 'ESPECES' ? 'Ouvrez un journal de caisse (compte 57) dans Journaux.' : 'Ouvrez un journal de banque dans Journaux.'}
            </span>
          )}
        </div>
      )}

      <div className="font-semibold mt-2 mb-1">Paiements du mois</div>
      {p.paiements.length === 0 ? (
        <div className="text-text-dim">Aucun paiement passé pour ce mois.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Mode</th>
                <th className="text-left px-2 py-1">Date</th>
                <th className="text-left px-2 py-1">Pièce</th>
                <th className="text-right px-2 py-1">Total</th>
                <th className="text-left px-2 py-1">Salariés</th>
                <th className="text-left px-2 py-1">État</th>
                <th className="px-2 py-1 w-[90px]" />
              </tr>
            </thead>
            <tbody>
              {p.paiements.map((x) => (
                <tr key={x.id} className={x.annuleLe ? 'text-text-dim' : ''}>
                  <td className="px-2 py-1">
                    {LIBELLE_MODE[x.mode]}
                    {x.ordreVirement ? ` · ordre n° ${x.ordreVirement.numero} (${LIBELLE_ORDRE[x.ordreVirement.statut]})` : ''}
                  </td>
                  <td className="px-2 py-1">{dateCourte(x.date)}</td>
                  <td className="px-2 py-1">{x.piecePassee}</td>
                  <td className="px-2 py-1 text-right">{fc(x.total)}</td>
                  <td className="px-2 py-1">
                    {x.lignes.map((l) => `${l.nomComplet}${l.reference ? ` (chèque ${l.reference})` : ''}`).join(', ')}
                  </td>
                  <td className="px-2 py-1">
                    {x.annuleLe
                      ? `Annulé le ${dateCourte(x.annuleLe)}${x.ecritureNegatif ? ', inscrit en négatif' : ''} · ${x.motifAnnulation ?? ''}`
                      : x.statutEcriture === 'VALIDEE'
                        ? 'Validé'
                        : 'Au brouillard'}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {peutValider && !x.annuleLe && (
                      <button type="button" className="text-danger hover:underline" onClick={() => setAAnnuler(x)}>
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aAnnuler && (
        <ModaleAnnulerPaiement
          paiement={aAnnuler}
          onFermer={() => setAAnnuler(null)}
          onFait={() => {
            setAAnnuler(null);
            setMessage('Paiement annulé · ses bulletins sont de nouveau à payer.');
            charger();
          }}
        />
      )}
    </div>
  );
}

function TableBilletage({ billetage }: { billetage: Billetage }) {
  return (
    <div className="overflow-x-auto mt-1.5">
      <table className="w-full min-w-[620px]">
        <thead>
          <tr>
            <th className="text-left px-2 py-1">Salarié</th>
            <th className="text-right px-2 py-1">À payer</th>
            <th className="text-left px-2 py-1">Coupures</th>
            <th className="text-right px-2 py-1">Non ventilé</th>
          </tr>
        </thead>
        <tbody>
          {billetage.parSalarie.map((s) => (
            <tr key={s.salarieId}>
              <td className="px-2 py-1">{s.nomComplet}</td>
              <td className="px-2 py-1 text-right">{fc(s.montant)}</td>
              <td className="px-2 py-1">{s.detail.map((d) => `${d.nombre} × ${fc(d.valeur)}`).join(' · ')}</td>
              <td className="px-2 py-1 text-right">{s.reste > 0 ? fc(s.reste) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-2 py-1 font-semibold">Total par coupure</td>
            <td />
            <td className="px-2 py-1">{billetage.totaux.map((t) => `${t.nombre} × ${fc(t.valeur)}`).join(' · ')}</td>
            <td className="px-2 py-1 text-right">{billetage.resteTotal > 0 ? fc(billetage.resteTotal) : ''}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ModaleAnnulerPaiement({ paiement, onFermer, onFait }: { paiement: PaiementLu; onFermer: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { envoi, erreur, setErreur, envoyer } = useEnvoiPaie(onFait);
  const valider = () => {
    if (motif.trim().length < 3) {
      setErreur("L'annulation se fait avec son motif.");
      return;
    }
    void envoyer(() => api.post(`/personnel/paiements-salaires/${paiement.id}/annulation`, { motif: motif.trim() }));
  };
  return (
    <ModalePaie
      titre={`Annuler le paiement ${paiement.piecePassee}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsPaie envoi={envoi} onFermer={onFermer} valider="Annuler le paiement" />}
    >
      <ChampPaie libelle="Motif">
        <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}
