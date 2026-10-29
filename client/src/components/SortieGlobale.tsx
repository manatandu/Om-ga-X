import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { RETENUS } from '../lib/comptes-proposes';
import { LIBELLES_NATURE_SORTIE, naturesSortieOffertes, type NatureSortie } from '../lib/nature-sortie';
import { contrepartieCessionProposee } from '../lib/contrepartie-cession';
import { fondsPreselectionne, messageFondsProjet, type ReponseFondsProjet } from '../lib/fonds-projet-sortie';
import { corpsSortieGlobale, type LigneSortieGlobale } from '../lib/sortie-globale';
import type { Compte, Immobilisation, Journal } from '../lib/types';
import { Aide } from './chrome/Aide';

const champ = 'mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px]';
const etiquette = 'text-[11.5px] font-semibold text-text-dim';

/**
 * LA SORTIE GLOBALE DE PLUSIEURS BIENS (ligne immos, fonction n° 69) · un lot
 * de biens sort en un geste, sous une même pièce justificative · le serveur
 * juge chaque bien par les règles de la sortie ordinaire avant le premier,
 * et refuse le lot entier en nommant chaque refus. Une écriture par bien.
 */
export function SortieGlobale({
  biens,
  exerciceId,
  journaux,
  comptesFinancement,
  syscohada,
  projetDeveloppement,
  onFait,
}: {
  /** Null tant que le registre n'est pas lu · jamais présenté comme vide. */
  biens: Immobilisation[] | null;
  exerciceId: string | undefined;
  journaux: Journal[];
  comptesFinancement: Compte[] | null;
  syscohada: boolean;
  projetDeveloppement: boolean;
  onFait: () => void;
}) {
  const { peutEcrire, utilisateur } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [lignes, setLignes] = useState<Record<string, LigneSortieGlobale>>({});
  const [type, setType] = useState<'CESSION' | 'MISE_HORS_SERVICE'>('MISE_HORS_SERVICE');
  const [date, setDate] = useState('');
  const [nature, setNature] = useState<NatureSortie | ''>('');
  const [refPiece, setRefPiece] = useState('');
  const [datePiece, setDatePiece] = useState('');
  const [journalId, setJournalId] = useState('');
  const [contrepartie, setContrepartie] = useState('');
  const [fonds, setFonds] = useState<ReponseFondsProjet | null>(null);
  const [erreurFonds, setErreurFonds] = useState<string | null>(null);
  const [compteFonds, setCompteFonds] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const enService = useMemo(() => (biens === null ? null : biens.filter((b) => b.statut === 'EN_SERVICE')), [biens]);
  const natures = naturesSortieOffertes({ type, projetDeveloppement, usufruit: false });

  useEffect(() => {
    if (!ouvert || !projetDeveloppement) return;
    let vivant = true;
    api
      .get<ReponseFondsProjet>(`/immobilisations/comptes-fonds-projet?${RETENUS}`)
      .then((r) => {
        if (!vivant) return;
        setFonds(r);
        setCompteFonds(fondsPreselectionne(r.comptes) ?? '');
      })
      .catch((e) => vivant && setErreurFonds(e instanceof ApiError ? e.message : 'lecture impossible'));
    return () => {
      vivant = false;
    };
  }, [ouvert, projetDeveloppement]);

  if (!peutEcrire) return null;

  const choisis = Object.values(lignes).filter((l) => l.choisi);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciceId) return;
    const corps = corpsSortieGlobale(lignes, type);
    if ('motif' in corps) {
      setErreur(corps.motif);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      const r = await api.post<{ nombre: number; reference: string }>('/immobilisations/sortie-globale', {
        biens: corps.biens,
        type,
        dateSortie: date,
        natureSortie: nature,
        referencePieceSortie: refPiece,
        datePieceSortie: datePiece,
        exerciceId,
        journalId,
        ...(type === 'CESSION' ? { compteContrepartieId: contrepartie } : {}),
        ...(projetDeveloppement ? { compteFondsProjetId: compteFonds } : {}),
      });
      setInfo(`${r.nombre} biens sortis sous la pièce ${r.reference} · une écriture par bien.`);
      setLignes({});
      onFait();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Sortie globale refusée · serveur injoignable');
    } finally {
      setEnvoi(false);
    }
  };

  const poserLigne = (id: string, l: Partial<LigneSortieGlobale>) =>
    setLignes((v) => {
      const base: LigneSortieGlobale = v[id] ?? { choisi: false, prix: '' };
      return { ...v, [id]: { ...base, ...l } };
    });
  const encaissement = (comptesFinancement ?? []).filter((c) => contrepartieCessionProposee(utilisateur?.tenant.referentiel, false, c.numero));

  return (
    <div className="border border-border bg-surface shadow-posee max-w-[1180px] mt-3 text-[11.5px]" data-sortie-globale>
      <div className="px-3.5 py-1.5 bg-chrome border-b border-border font-semibold text-text-dim flex items-center gap-1.5">
        Sortie globale de plusieurs biens
        <Aide
          titre="Sortie globale"
          texte="Un lot de biens sort en un seul geste (mise au rebut, destruction, vol d'un lot, vente en bloc), sous une même pièce justificative. Chaque bien est jugé comme s'il sortait seul, avant que le premier ne sorte · un seul refus arrête le lot, et chaque refus est nommé. Chaque bien reçoit sa propre écriture de sortie, avec sa dotation complémentaire. Une vente globale se répartit par bien, prix par prix. Un bien qui porte un matériel récupéré sort seul."
          source="Fiche du compte 81 des deux plans · AUDCIF art. 17, 3° et 5°"
        />
        <button type="button" onClick={() => setOuvert((o) => !o)} className="ml-auto text-[11px] text-sel hover:underline">
          {ouvert ? 'Fermer' : 'Ouvrir'}
        </button>
      </div>
      {ouvert && (
        <form onSubmit={(e) => void envoyer(e)} className="px-3.5 py-2">
          {erreur && <div className="text-danger mb-1.5">{erreur}</div>}
          {info && <div className="text-positive mb-1.5">{info}</div>}
          {!exerciceId && <div className="text-text-dim mb-1.5">Choisissez d'abord un exercice.</div>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
            <label className={etiquette}>
              Type
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as 'CESSION' | 'MISE_HORS_SERVICE');
                  setNature('');
                }}
                className={champ}
              >
                <option value="MISE_HORS_SERVICE">Mise hors service</option>
                <option value="CESSION">Cession</option>
              </select>
            </label>
            <label className={etiquette}>
              Date
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
            </label>
            <label className={etiquette}>
              Nature
              <select required value={nature} onChange={(e) => setNature(e.target.value as NatureSortie)} className={champ}>
                <option value="" />
                {natures.map((n) => (
                  <option key={n} value={n}>
                    {LIBELLES_NATURE_SORTIE[n]}
                  </option>
                ))}
              </select>
            </label>
            <label className={etiquette}>
              Journal
              <select required value={journalId} onChange={(e) => setJournalId(e.target.value)} className={champ}>
                <option value="" />
                {journaux.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className={etiquette}>
              Pièce justificative
              <input required maxLength={120} value={refPiece} onChange={(e) => setRefPiece(e.target.value)} className={champ} />
            </label>
            <label className={etiquette}>
              Date de la pièce
              <input required type="date" value={datePiece} onChange={(e) => setDatePiece(e.target.value)} className={champ} />
            </label>
            {type === 'CESSION' && (
              <label className={etiquette}>
                Encaissé sur
                <select required value={contrepartie} onChange={(e) => setContrepartie(e.target.value)} className={champ}>
                  <option value="" />
                  {encaissement.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numero} · {c.intitule}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {projetDeveloppement && (
              <label className={etiquette}>
                Fonds affecté repris
                <select required value={compteFonds} onChange={(e) => setCompteFonds(e.target.value)} className={champ}>
                  <option value="" />
                  {(fonds?.comptes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numero} · {c.intitule}
                    </option>
                  ))}
                </select>
                {messageFondsProjet(fonds, erreurFonds) && <span className="block font-normal text-text-dim">{messageFondsProjet(fonds, erreurFonds)}</span>}
              </label>
            )}
          </div>
          {enService === null ? (
            <div className="text-text-dim">…</div>
          ) : enService.length === 0 ? (
            <div className="text-text-dim">Aucun bien en service.</div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto border border-border">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left w-8" />
                    <th className="text-left">Bien</th>
                    <th className="text-left">Compte</th>
                    <th className="text-right">Valeur d'origine</th>
                    {type === 'CESSION' && <th className="text-right">Prix de cession</th>}
                  </tr>
                </thead>
                <tbody>
                  {enService.map((b) => {
                    const l = lignes[b.id];
                    return (
                      <tr key={b.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Sortir ${b.designation}`}
                            checked={!!l?.choisi}
                            onChange={(e) => poserLigne(b.id, { choisi: e.target.checked })}
                          />
                        </td>
                        <td>
                          {b.designation}
                          {b.numeroInventaire ? ` (${b.numeroInventaire})` : ''}
                        </td>
                        <td className="tabular-nums">{b.compteImmobilisation?.numero ?? '·'}</td>
                        <td className="text-right tabular-nums">{montant(b.valeurOrigine)}</td>
                        {type === 'CESSION' && (
                          <td className="text-right">
                            <input
                              aria-label={`Prix de cession de ${b.designation}`}
                              inputMode="decimal"
                              disabled={!l?.choisi}
                              value={l?.prix ?? ''}
                              onChange={(e) => poserLigne(b.id, { prix: e.target.value })}
                              className="w-32 border border-border-dark px-2 py-0.5 text-[11.5px] text-right tabular-nums"
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="submit"
              disabled={envoi || !exerciceId || choisis.length < 2}
              className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50"
            >
              {envoi ? '…' : `Sortir les ${choisis.length} biens`}
            </button>
            {choisis.length < 2 && <span className="text-text-dim">Cochez au moins deux biens.</span>}
            {syscohada && type === 'CESSION' && <span className="text-text-dim">Une cession courante (654 / 754) se passe bien par bien.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
