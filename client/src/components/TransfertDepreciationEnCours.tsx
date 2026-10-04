import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import type { Journal } from '../lib/types';
import { Aide } from './chrome/Aide';

/** Ce que le serveur rend (`propositionTransfertDepreciation`) · rien n'est recalculé ici. */
interface ApercuTransfert {
  etat: 'SANS_OBJET' | 'ABSTENTION' | 'A_PASSER';
  motif?: string | null;
  montant?: number;
  compteSource?: string;
  compteCible?: string | null;
  compteCibleId?: string | null;
  compteReprise?: string | null;
  compteDotation?: string | null;
  candidats: Array<{ id: string; numero: string; intitule: string }>;
}

const AIDE =
  'Pendant les travaux, la dépréciation du bien est inscrite au compte des immobilisations en cours (2919, 2929, 2939 ou 2949). ' +
  'À la mise en service, elle est reprise sur ce compte et dotée de nouveau, du même montant et le même jour, au compte 29 du bien achevé : ' +
  'le résultat net ne change pas, et le bilan la range sous le poste du bien. Les deux écritures emploient les seuls mouvements que la fiche ' +
  'du compte 29 connaît, la reprise au 79 (ou au 863) et la dotation au 69 (ou au 853), au niveau de la dotation d’origine.';

/**
 * LIGNE A22 BIS · l'aperçu du transfert de la dépréciation d'un bien en cours,
 * lu au serveur avant le geste. Le serveur refuse seul ce qui manque (29 du
 * bien achevé absent ou ambigu) · l'écran le dit et offre le choix du 29.
 */
export function ApercuTransfertDepreciation({
  immobilisationId,
  compteCibleId,
  onCompteCible,
}: {
  immobilisationId: string;
  compteCibleId: string;
  onCompteCible: (id: string) => void;
}) {
  // null tant que rien n'est lu · un aperçu inconnu ne se lit pas « rien à transférer ».
  const [apercu, setApercu] = useState<ApercuTransfert | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const jeton = useRef(0);

  useEffect(() => {
    const n = ++jeton.current;
    setApercu(null);
    setErreur(null);
    const cible = compteCibleId ? `?compteDepreciationCibleId=${compteCibleId}` : '';
    api
      .get<ApercuTransfert>(`/immobilisations/${immobilisationId}/transfert-depreciation${cible}`)
      .then((r) => {
        if (n === jeton.current) setApercu(r);
      })
      .catch((err) => {
        if (n === jeton.current) setErreur(err instanceof ApiError ? err.message : 'Transfert de la dépréciation illisible');
      });
  }, [immobilisationId, compteCibleId]);

  if (erreur) return <div className="mt-2 text-[11.5px] text-danger">{erreur}</div>;
  if (!apercu) return <div className="mt-2 text-[11.5px] text-text-dim">…</div>;
  if (apercu.etat === 'SANS_OBJET') return null;
  if (apercu.etat === 'ABSTENTION') return <div className="mt-2 text-[11.5px] text-warning">{apercu.motif}</div>;
  return (
    <div className="mt-2 text-[11.5px]" data-transfert-depreciation>
      <div className="flex items-center gap-1">
        <span className="font-semibold">Transfert de la dépréciation · {montant(apercu.montant ?? 0)}</span>
        <span className="text-text-dim">
          reprise {apercu.compteSource} au débit, {apercu.compteReprise ?? '·'} au crédit ; dotation {apercu.compteDotation ?? '·'} au débit,{' '}
          {apercu.compteCible ?? '·'} au crédit
        </span>
        <Aide titre="Transfert de la dépréciation" texte={AIDE} source="Fiches des comptes 29, 69 et 79 ; AUDCIF Titre VII ch. 2" />
      </div>
      {apercu.candidats.length > 1 && (
        <label className="mt-1 flex items-center gap-2 font-semibold text-text-dim">
          Compte 29 du bien achevé
          <select value={compteCibleId || apercu.compteCibleId || ''} onChange={(e) => onCompteCible(e.target.value)} className="border border-border-dark px-2 py-1 text-[11.5px] font-normal">
            <option value="" />
            {apercu.candidats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.intitule}
              </option>
            ))}
          </select>
        </label>
      )}
      {apercu.motif && <div className="mt-1 text-danger">{apercu.motif}</div>}
    </div>
  );
}

/**
 * LIGNE A22 BIS · le transfert d'un bien déjà mis en service dont la
 * dépréciation est restée au 29x9 (mis en service avant cette ligne, ou porté
 * d'emblée à son compte définitif). Même geste qu'à la mise en service.
 */
export function TransfertDepreciationBien({
  immobilisationId,
  exerciceId,
  journaux,
  onFait,
  onAnnuler,
}: {
  immobilisationId: string;
  exerciceId: string;
  journaux: Journal[];
  onFait: (message: string) => void;
  onAnnuler: () => void;
}) {
  // Le serveur refuse la lecture seule (`@Roles`) · l'écran ne propose pas le geste.
  const { peutEcrire } = useAuth();
  const [journalId, setJournalId] = useState(() => (journaux.find((j) => j.code === 'OD') ?? journaux[0])?.id ?? '');
  const [compteCibleId, setCompteCibleId] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ montant: number; compteSource: string; compteCible: string; date: string }>(
        `/immobilisations/${immobilisationId}/transfert-depreciation`,
        { exerciceId, journalId, ...(compteCibleId ? { compteDepreciationCibleId: compteCibleId } : {}) },
      );
      onFait(`Dépréciation de ${montant(r.montant)} transférée du ${r.compteSource} au ${r.compteCible} au ${r.date.split('-').reverse().join('/')}.`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de transférer la dépréciation');
    } finally {
      setEnvoi(false);
    }
  };

  if (!peutEcrire) return null;
  return (
    <form onSubmit={envoyer} className="bg-chrome border-b border-border px-4 py-3">
      <div className="grid grid-cols-4 gap-3 items-end">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Journal
          <select required value={journalId} onChange={(e) => setJournalId(e.target.value)} className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px]">
            <option value="" />
            {journaux.map((j) => (
              <option key={j.id} value={j.id}>
                {j.code} · {j.intitule}
              </option>
            ))}
          </select>
        </label>
        <span className="flex gap-2">
          <button type="submit" disabled={envoi || !journalId} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50">
            {envoi ? '…' : 'Transférer'}
          </button>
          <button type="button" onClick={onAnnuler} disabled={envoi} className="text-[11.5px] font-semibold text-text-dim px-3 py-1.5">
            Annuler
          </button>
        </span>
      </div>
      <ApercuTransfertDepreciation immobilisationId={immobilisationId} compteCibleId={compteCibleId} onCompteCible={setCompteCibleId} />
      {erreur && <div className="mt-2 text-[11.5px] text-danger">{erreur}</div>}
    </form>
  );
}
