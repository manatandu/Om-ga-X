import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Journal } from '../lib/types';
import { Aide } from '../components/chrome/Aide';
import { LIBELLES_NATURES, NATURES, PLAFOND_MODES_REGLEMENT, type ModeReglement, type NatureModeReglement } from '../lib/modes-reglement';

/**
 * MODES DE RÈGLEMENT (ligne sage-l2, fonction 1 · Sage 100, table
 * P_REGLEMENT) · Structure > Paramètres de saisie. Trente modes au plus, un
 * code, un intitulé, une nature, un code interbancaire libre et un journal de
 * trésorerie proposé au règlement. La structure appartient à l'administrateur
 * (`@Roles` ADMIN_CABINET au serveur) ; les autres la lisent.
 */
export function ModesReglementPage() {
  const { estAdmin } = useAuth();
  const [liste, setListe] = useState<ModeReglement[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [journaux, setJournaux] = useState<Journal[] | null>(null);
  const [erreurJournaux, setErreurJournaux] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const [code, setCode] = useState('');
  const [intitule, setIntitule] = useState('');
  const [nature, setNature] = useState<NatureModeReglement | ''>('');
  const [codeInterbancaire, setCodeInterbancaire] = useState('');
  const [journalId, setJournalId] = useState('');

  const charger = async () => {
    setListe(await api.get<ModeReglement[]>('/modes-reglement'));
    setErreurLecture(null);
  };
  useEffect(() => {
    charger().catch((e) => {
      setListe(null);
      setErreurLecture(e instanceof ApiError ? e.message : "La liste des modes de règlement n'a pas pu être lue.");
    });
    api.get<Journal[]>('/journaux').then(
      (js) => setJournaux(js.filter((j) => j.type === 'TRESORERIE')),
      (e) => setErreurJournaux(e instanceof ApiError ? e.message : 'serveur injoignable'),
    );
  }, []);

  /** Rend vrai si le geste a abouti · un refus est affiché, et l'appelant rétablit ce qu'il montrait. */
  const agir = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    try {
      await fn();
      await charger();
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Action impossible');
      return false;
    } finally {
      setEnvoi(false);
    }
  };

  const creer = (e: FormEvent) => {
    e.preventDefault();
    if (!nature) {
      setErreur('Choisissez la nature du mode de règlement.');
      return;
    }
    void agir(async () => {
      await api.post('/modes-reglement', {
        code: code.trim(),
        intitule: intitule.trim(),
        nature,
        ...(codeInterbancaire.trim() ? { codeInterbancaire: codeInterbancaire.trim() } : {}),
        ...(journalId ? { journalId } : {}),
      });
      setCode('');
      setIntitule('');
      setNature('');
      setCodeInterbancaire('');
      setJournalId('');
    });
  };

  const creerUsuels = () =>
    void agir(async () => {
      const r = await api.post<{ crees: string[]; dejaPresents: string[] }>('/modes-reglement/usuels', {});
      setInfo(
        (r.crees.length ? `Créés · ${r.crees.join(', ')}.` : 'Aucun mode créé.') +
          (r.dejaPresents.length ? ` Déjà présents · ${r.dejaPresents.join(', ')}.` : ''),
      );
    });

  const complet = liste !== null && liste.length >= PLAFOND_MODES_REGLEMENT;
  const nomJournal = (m: ModeReglement) => (m.journal ? `${m.journal.code} · ${m.journal.intitule}` : '·');

  return (
    <div className="p-2 max-w-[1040px]">
      <div className="flex items-center justify-end gap-2 mb-2">
        {estAdmin && liste !== null && (
          <button
            type="button"
            disabled={envoi || complet}
            onClick={creerUsuels}
            className="border border-border-dark bg-chrome hover:bg-chrome-alt px-3 py-1 text-[11.5px] disabled:opacity-50"
          >
            Créer les modes usuels
          </button>
        )}
        <Aide
          titre="Modes de règlement"
          texte="Le mode de règlement dit comment un tiers paie ou est payé · espèces, chèque, virement, carte bancaire, monnaie électronique, effet de commerce, prélèvement. Il se pose sur la fiche du tiers (mode habituel), sur chaque échéance d'un modèle de règlement, sur une ligne de saisie et sur un règlement des tiers. Le code interbancaire est libre (aucune nomenclature bancaire ne s'impose en RDC) ; le journal proposé est présélectionné au règlement. Un paiement d'au moins 1 000 000 FC entre assujettis à la TVA doit se faire par chèque, virement ou carte bancaire, sinon la TVA supportée n'est pas déductible · le règlement d'un fournisseur par un autre mode est averti. Trente modes au plus ; un mode porté par un tiers, un modèle ou une écriture ne se supprime pas, il se met en sommeil."
          source="O.-L. n° 10/001, art. 59 bis et 74 bis · Sage 100, modes de règlement (P_REGLEMENT)"
        />
      </div>
      {erreur && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">{erreur}</div>}
      {info && <div className="text-[11.5px] text-positive bg-positive-soft border border-positive/30 px-3 py-1.5 mb-2">{info}</div>}
      {erreurJournaux && <div className="text-[11.5px] text-danger mb-2">Journaux de trésorerie illisibles · {erreurJournaux}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] min-w-[760px]">
          <thead>
            <tr>
              <th className="text-left w-[80px]">Code</th>
              <th className="text-left">Intitulé</th>
              <th className="text-left w-[150px]">Nature</th>
              <th className="text-left w-[130px]">Code interbancaire</th>
              <th className="text-left w-[190px]">Journal proposé</th>
              <th className="text-center w-[60px]">Actif</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {liste?.map((m) => (
              <tr key={m.id} className={m.estActif ? '' : 'text-text-dim'}>
                <td className="font-semibold">{m.code}</td>
                <td>
                  {estAdmin ? (
                    <input
                      // Remonté sur la valeur ENREGISTRÉE · un refus ne reste pas affiché.
                      key={`${m.id}:${m.intitule}`}
                      aria-label={`Intitulé du mode ${m.code}`}
                      defaultValue={m.intitule}
                      maxLength={35}
                      onBlur={(e) => {
                        const champ = e.currentTarget;
                        const v = champ.value.trim();
                        if (!v) {
                          champ.value = m.intitule;
                          return;
                        }
                        if (v === m.intitule) return;
                        void agir(() => api.patch(`/modes-reglement/${m.id}`, { intitule: v })).then((fait) => {
                          if (!fait) champ.value = m.intitule;
                        });
                      }}
                      className="w-full border border-transparent hover:border-border px-1 py-0.5"
                    />
                  ) : (
                    m.intitule
                  )}
                </td>
                <td>
                  {estAdmin ? (
                    <select
                      aria-label={`Nature du mode ${m.code}`}
                      value={m.nature}
                      disabled={envoi}
                      onChange={(e) => void agir(() => api.patch(`/modes-reglement/${m.id}`, { nature: e.target.value }))}
                      className="border border-border px-1 py-0.5 bg-surface w-full"
                    >
                      {NATURES.map((n) => (
                        <option key={n} value={n}>
                          {LIBELLES_NATURES[n]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    LIBELLES_NATURES[m.nature]
                  )}
                </td>
                <td>
                  {estAdmin ? (
                    <input
                      key={`${m.id}:${m.codeInterbancaire ?? ''}`}
                      aria-label={`Code interbancaire du mode ${m.code}`}
                      defaultValue={m.codeInterbancaire ?? ''}
                      maxLength={17}
                      onBlur={(e) => {
                        const champ = e.currentTarget;
                        const v = champ.value.trim();
                        if (v === (m.codeInterbancaire ?? '')) return;
                        void agir(() => api.patch(`/modes-reglement/${m.id}`, { codeInterbancaire: v || null })).then((fait) => {
                          if (!fait) champ.value = m.codeInterbancaire ?? '';
                        });
                      }}
                      className="w-full border border-transparent hover:border-border px-1 py-0.5"
                    />
                  ) : (
                    m.codeInterbancaire ?? '·'
                  )}
                </td>
                <td>
                  {estAdmin && journaux ? (
                    <select
                      aria-label={`Journal proposé du mode ${m.code}`}
                      value={m.journalId ?? ''}
                      disabled={envoi}
                      onChange={(e) => void agir(() => api.patch(`/modes-reglement/${m.id}`, { journalId: e.target.value || null }))}
                      className="border border-border px-1 py-0.5 bg-surface w-full"
                    >
                      <option value="">Aucun</option>
                      {journaux.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.code} · {j.intitule}
                          {j.estActif ? '' : ' (en sommeil)'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    nomJournal(m)
                  )}
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    aria-label={`Mode ${m.code} actif`}
                    checked={m.estActif}
                    disabled={!estAdmin || envoi}
                    onChange={(e) => void agir(() => api.patch(`/modes-reglement/${m.id}`, { estActif: e.target.checked }))}
                  />
                </td>
                <td className="text-right">
                  {estAdmin && (
                    <button
                      type="button"
                      disabled={envoi}
                      onClick={() => {
                        if (!window.confirm(`Supprimer le mode ${m.code} ? Cette suppression est définitive.`)) return;
                        void agir(() => api.delete(`/modes-reglement/${m.id}`));
                      }}
                      className="text-danger hover:underline disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {erreurLecture ? (
              <tr>
                <td colSpan={7} className="text-danger">
                  Liste des modes de règlement illisible · {erreurLecture}
                </td>
              </tr>
            ) : liste === null ? (
              <tr>
                <td colSpan={7} className="italic text-text-dim">
                  Chargement…
                </td>
              </tr>
            ) : (
              liste.length === 0 && (
                <tr>
                  <td colSpan={7} className="italic text-text-dim">
                    Aucun mode de règlement.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {estAdmin && liste !== null && (
        <form onSubmit={creer} className="mt-2 flex flex-wrap gap-2 items-end text-[11.5px]">
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Code</span>
            <input
              required
              aria-label="Code du nouveau mode"
              maxLength={10}
              value={code}
              disabled={complet}
              onChange={(e) => setCode(e.target.value)}
              className="border border-border-dark px-2 py-1 w-[90px] disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[160px]">
            <span className="text-text-dim">Intitulé</span>
            <input
              required
              aria-label="Intitulé du nouveau mode"
              maxLength={35}
              value={intitule}
              disabled={complet}
              onChange={(e) => setIntitule(e.target.value)}
              placeholder={complet ? `Les ${PLAFOND_MODES_REGLEMENT} modes sont créés` : ''}
              className="border border-border-dark px-2 py-1 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Nature</span>
            <select
              required
              aria-label="Nature du nouveau mode"
              value={nature}
              disabled={complet}
              onChange={(e) => setNature(e.target.value as NatureModeReglement)}
              className="border border-border-dark px-2 py-1 bg-surface"
            >
              <option value="">·</option>
              {NATURES.map((n) => (
                <option key={n} value={n}>
                  {LIBELLES_NATURES[n]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Code interbancaire</span>
            <input
              aria-label="Code interbancaire du nouveau mode"
              maxLength={17}
              value={codeInterbancaire}
              disabled={complet}
              onChange={(e) => setCodeInterbancaire(e.target.value)}
              className="border border-border-dark px-2 py-1 w-[120px]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Journal proposé</span>
            <select
              aria-label="Journal proposé du nouveau mode"
              value={journalId}
              disabled={complet || !journaux}
              onChange={(e) => setJournalId(e.target.value)}
              className="border border-border-dark px-2 py-1 bg-surface"
            >
              <option value="">Aucun</option>
              {journaux
                ?.filter((j) => j.estActif)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" disabled={envoi || complet} className="bg-sel text-white px-3.5 py-1 font-semibold disabled:opacity-50">
            Ajouter
          </button>
        </form>
      )}
    </div>
  );
}
