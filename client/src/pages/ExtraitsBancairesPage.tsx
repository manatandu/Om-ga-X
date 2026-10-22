import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Aide } from '../components/chrome/Aide';
import { montant } from '../lib/montants';

/**
 * EXTRAITS BANCAIRES (ligne sage-l3, fonction 45 · Sage 100 Moyens de paiement,
 * manuel de référence v16, p. 25 ; Prise en main, ch. 8) · la liste des relevés
 * importés dans les rapprochements, compte par compte, et leur édition chaînée
 * en un classeur, une feuille par extrait. Rien ne s'écrit depuis cet écran ·
 * l'extrait se consulte dans son rapprochement, l'édition se télécharge.
 * Décision D14 (architecture.md) · l'édition est une reconstitution datée ; la
 * pièce probante reste le relevé reçu de la banque (AUDCIF art. 22, 7°, art. 24).
 */

interface TeteExtrait {
  rapprochementId: string;
  compteId: string;
  compteNumero: string;
  compteNom: string;
  dateReleve: string;
  soldeReleve: number;
  soldeDepart: number | null;
  mouvementsNet: number;
  ecartReleve: number | null;
  nombreLignes: number;
  nombreRapprochees: number;
  statut: 'EN_COURS' | 'CLOTURE' | 'ANNULE';
  releveImporteLe: string | null;
  releveNomFichier: string | null;
}
interface ListeExtraits {
  extraits: TeteExtrait[];
  total: number;
  tronque: boolean;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const instant = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'short', timeStyle: 'short' });
const LIBELLE_STATUT: Record<TeteExtrait['statut'], string> = { EN_COURS: 'En cours', CLOTURE: 'Clos', ANNULE: 'Annulé' };

export function ExtraitsBancairesPage() {
  const navigate = useNavigate();
  const [liste, setListe] = useState<ListeExtraits | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cochees, setCochees] = useState<string[]>([]);
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    api
      .get<ListeExtraits>('/rapprochements/extraits')
      .then((l) => vivant && setListe(l))
      .catch((e) => vivant && setErreur(`Lecture des extraits impossible · ${e instanceof ApiError ? e.message : 'serveur injoignable'}`));
    return () => {
      vivant = false;
    };
  }, []);

  // Les comptes, dans l'ordre des extraits (numéro croissant), chacun avec les siens.
  const parCompte = useMemo(() => {
    const groupes = new Map<string, { compteId: string; numero: string; nom: string; extraits: TeteExtrait[] }>();
    for (const e of liste?.extraits ?? []) {
      const g = groupes.get(e.compteId) ?? { compteId: e.compteId, numero: e.compteNumero, nom: e.compteNom, extraits: [] };
      g.extraits.push(e);
      groupes.set(e.compteId, g);
    }
    return [...groupes.values()];
  }, [liste]);

  const bornesIllisibles = du && au && du > au ? 'La borne « du » est postérieure à la borne « au ».' : null;
  const cocher = (compteId: string, coche: boolean) => setCochees((c) => (coche ? [...new Set([...c, compteId])] : c.filter((x) => x !== compteId)));

  const editer = async () => {
    if (bornesIllisibles) return;
    setEnvoi(true);
    const q = new URLSearchParams();
    if (cochees.length > 0) q.set('compteIds', cochees.join(','));
    if (du) q.set('du', du);
    if (au) q.set('au', au);
    const suffixe = q.toString() ? `?${q.toString()}` : '';
    await api.telechargerOuSignaler(`/rapprochements/extraits/edition${suffixe}`, 'extraits-bancaires.xlsx', setErreurEdition);
    setEnvoi(false);
  };

  return (
    <div className="p-4 text-[12px]">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Relevés du
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="mt-1 block border border-border-dark px-2.5 py-1.5 text-[12px] font-normal font-mono" />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          au
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="mt-1 block border border-border-dark px-2.5 py-1.5 text-[12px] font-normal font-mono" />
        </label>
        <button
          type="button"
          onClick={editer}
          disabled={envoi || !liste || liste.extraits.length === 0 || bornesIllisibles !== null}
          className="bg-sel text-white text-[11.5px] font-semibold px-4 py-1.5 rounded-full disabled:opacity-50"
        >
          {envoi ? 'Édition…' : cochees.length > 0 ? `Éditer les extraits des ${cochees.length} compte(s) cochés` : 'Éditer tous les extraits'}
        </button>
        <Aide
          titre="Édition chaînée des extraits"
          texte="Un classeur, une feuille de sommaire puis une feuille par extrait, compte par compte et du plus ancien au plus récent · solde de départ, lignes du relevé avec leur solde progressif, totaux, solde imprimé par la banque et lignes rapprochées. L'édition est une reconstitution datée depuis le fichier importé · la pièce probante reste le relevé reçu de la banque, conservé (AUDCIF art. 22, 7° ; art. 24). Les bornes portent sur la date du relevé."
          source="Sage 100 Moyens de paiement, manuel de référence v16, p. 25 · AUDCIF art. 22, 7° et art. 24"
        />
      </div>
      {bornesIllisibles && <div className="text-[11.5px] text-danger mb-2">{bornesIllisibles}</div>}
      {erreurEdition && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mb-3 max-w-[900px]">{erreurEdition}</div>}
      {erreur && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mb-3 max-w-[900px]">{erreur}</div>}
      {!liste && !erreur && <div className="text-[11.5px] text-text-dim">Chargement…</div>}
      {liste && liste.extraits.length === 0 && (
        <div className="text-[11.5px] text-text-dim">Aucun relevé importé · un extrait naît de l'import d'un relevé dans un rapprochement bancaire (Traitement › Rapprochement bancaire).</div>
      )}
      {liste?.tronque && (
        <div className="text-[11.5px] text-warning mb-2">
          {liste.extraits.length} extraits montrés sur {liste.total} · l'édition de tout le dossier est refusée, restreignez-la par compte ou par dates.
        </div>
      )}
      {parCompte.map((g) => (
        <div key={g.compteId} className="border border-border bg-surface shadow-posee max-w-[1000px] overflow-x-auto mb-3">
          <label className="flex items-center gap-2 px-3.5 py-1.5 bg-chrome border-b border-border text-[11.5px] font-bold">
            <input type="checkbox" checked={cochees.includes(g.compteId)} onChange={(e) => cocher(g.compteId, e.target.checked)} />
            <span>
              {g.numero} · {g.nom}
            </span>
            <span className="font-normal text-text-dim">
              · {g.extraits.length} extrait{g.extraits.length > 1 ? 's' : ''}
            </span>
          </label>
          <div className="grid grid-cols-[100px_110px_110px_110px_110px_70px_90px_80px_1fr] min-w-[900px] gap-3 px-3.5 py-1 border-b border-border text-[11px] font-bold text-text-dim">
            <span>Relevé au</span>
            <span className="text-right">Solde de départ</span>
            <span className="text-right">Mouvements</span>
            <span className="text-right">Solde imprimé</span>
            <span className="text-right">Écart</span>
            <span className="text-right">Lignes</span>
            <span className="text-right">Rapprochées</span>
            <span>Statut</span>
            <span>Fichier importé</span>
          </div>
          {g.extraits.map((e, i) => (
            <button
              type="button"
              key={e.rapprochementId}
              onClick={() => navigate(`/rapprochement/${e.rapprochementId}`)}
              title="Ouvrir le rapprochement de cet extrait"
              className={`grid grid-cols-[100px_110px_110px_110px_110px_70px_90px_80px_1fr] min-w-[900px] gap-3 px-3.5 py-1.5 items-center border-b border-border last:border-b-0 text-[11.5px] w-full text-left hover:bg-a-50 ${
                i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt'
              }`}
            >
              <span className="font-mono text-[11px]">{date(e.dateReleve)}</span>
              <span className="font-mono text-right">{e.soldeDepart === null ? 'inconnu' : montant(e.soldeDepart)}</span>
              <span className="font-mono text-right">{montant(e.mouvementsNet)}</span>
              <span className="font-mono text-right">{montant(e.soldeReleve)}</span>
              <span className={`font-mono text-right ${e.ecartReleve !== null && Math.abs(e.ecartReleve) >= 0.005 ? 'text-danger' : ''}`}>
                {e.ecartReleve === null ? '·' : montant(e.ecartReleve)}
              </span>
              <span className="font-mono text-right">{e.nombreLignes}</span>
              <span className="font-mono text-right">{e.nombreRapprochees}</span>
              <span>{LIBELLE_STATUT[e.statut]}</span>
              <span className="text-text-dim truncate">{e.releveImporteLe ? `${e.releveNomFichier ?? 'sans nom'} · ${instant(e.releveImporteLe)}` : 'import non daté'}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
