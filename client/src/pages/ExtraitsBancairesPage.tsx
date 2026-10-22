import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Aide } from '../components/chrome/Aide';
import { montant } from '../lib/montants';
import { messageOuDefaut, statutDe } from '../lib/message-refus';

/**
 * EXTRAITS BANCAIRES (ligne sage-l3, fonction 45 · Sage 100 Moyens de paiement,
 * manuel de référence v16, p. 25 ; Prise en main, ch. 8) · la liste des relevés
 * importés dans les rapprochements, compte par compte, et leur édition chaînée
 * en un classeur, une feuille par extrait. Rien ne s'écrit depuis cet écran ·
 * l'extrait se consulte dans son rapprochement, l'édition se télécharge.
 * Décision D14 (architecture.md) · l'édition est une reconstitution datée ; la
 * pièce probante reste le relevé reçu de la banque (AUDCIF art. 22, 7°, art. 24).
 *
 * LA LISTE EST UNE TRANCHE (§ 8 bis), par compte · le serveur sert à part les
 * comptes qui portent un extrait, et un compte choisi restreint la lecture
 * DANS la requête (premier tour de relecture, M1 · au-delà de deux cents
 * extraits, les comptes de numéro élevé n'apparaissaient plus et rien ne
 * permettait de les atteindre).
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
  statut: 'EN_COURS' | 'CLOTURE';
  releveImporteLe: string | null;
  releveNomFichier: string | null;
}
interface CompteAExtrait {
  id: string;
  numero: string;
  intitule: string;
  extraits: number;
}
interface ListeExtraits {
  extraits: TeteExtrait[];
  total: number;
  tronque: boolean;
  comptes: CompteAExtrait[];
  comptesTronques: boolean;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const instant = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'short', timeStyle: 'short' });
const LIBELLE_STATUT: Record<TeteExtrait['statut'], string> = { EN_COURS: 'En cours', CLOTURE: 'Clos' };
const GRILLE = 'grid grid-cols-[100px_110px_110px_110px_110px_70px_90px_80px_1fr] min-w-[900px] gap-3 px-3.5';

export function ExtraitsBancairesPage() {
  const navigate = useNavigate();
  const [liste, setListe] = useState<ListeExtraits | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [compteChoisi, setCompteChoisi] = useState('');
  const [cochees, setCochees] = useState<string[]>([]);
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Une lecture par compte choisi · la réponse d'un choix abandonné est jetée.
  useEffect(() => {
    let vivant = true;
    setListe(null);
    setErreur(null);
    api
      .get<ListeExtraits>(`/rapprochements/extraits${compteChoisi ? `?compteId=${encodeURIComponent(compteChoisi)}` : ''}`)
      .then((l) => {
        if (!vivant) return;
        setListe(l);
        // Un compte coché qui n'a plus d'extrait connu ne se coche plus.
        setCochees((c) => c.filter((id) => l.comptes.some((x) => x.id === id)));
      })
      .catch((e) => vivant && setErreur(`Lecture des extraits impossible · ${messageOuDefaut(e, 'serveur injoignable')}`));
    return () => {
      vivant = false;
    };
  }, [compteChoisi]);

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

  const relire = useCallback(() => setCompteChoisi((c) => c), []);

  const editer = async () => {
    if (bornesIllisibles) return;
    setEnvoi(true);
    try {
      const q = new URLSearchParams();
      const comptes = cochees.length > 0 ? cochees : compteChoisi ? [compteChoisi] : [];
      if (comptes.length > 0) q.set('compteIds', comptes.join(','));
      if (du) q.set('du', du);
      if (au) q.set('au', au);
      const suffixe = q.toString() ? `?${q.toString()}` : '';
      await api.telecharger(`/rapprochements/extraits/edition${suffixe}`, 'extraits-bancaires.xlsx');
      setErreurEdition(null);
    } catch (e) {
      const statut = statutDe(e);
      // Un refus porte son motif ; une panne ou un téléchargement interrompu
      // (la connexion est détruite après le premier octet) n'a produit aucun
      // classeur, et c'est dit. Un compte introuvable fait relire la liste.
      setErreurEdition(
        statut !== null && statut < 500
          ? messageOuDefaut(e, "L'édition a été refusée.")
          : "L'édition n'a pas abouti · aucun classeur n'a été produit. Relancez-la, ou restreignez-la par compte ou par dates.",
      );
      if (statut === 404) {
        setCochees([]);
        setListe(null);
        api
          .get<ListeExtraits>(`/rapprochements/extraits${compteChoisi ? `?compteId=${encodeURIComponent(compteChoisi)}` : ''}`)
          .then(setListe)
          .catch((e2) => setErreur(`Lecture des extraits impossible · ${messageOuDefaut(e2, 'serveur injoignable')}`));
      }
    } finally {
      setEnvoi(false);
    }
  };

  const nombreAEditer = cochees.length > 0 ? cochees.length : compteChoisi ? 1 : 0;

  return (
    <div className="p-4 text-[12px]">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Compte de banque
          <select
            value={compteChoisi}
            onChange={(e) => setCompteChoisi(e.target.value)}
            className="mt-1 block border border-border-dark px-2.5 py-1.5 text-[12px] font-normal min-w-[220px]"
          >
            <option value="">Tous les comptes à extrait</option>
            {(liste?.comptes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.intitule} ({c.extraits})
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          Relevés du
          <input
            type="date"
            value={du}
            max={au || undefined}
            onChange={(e) => setDu(e.target.value)}
            className="mt-1 block border border-border-dark px-2.5 py-1.5 text-[12px] font-normal font-mono"
          />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          au
          <input
            type="date"
            aria-label="Relevés au"
            value={au}
            min={du || undefined}
            onChange={(e) => setAu(e.target.value)}
            className="mt-1 block border border-border-dark px-2.5 py-1.5 text-[12px] font-normal font-mono"
          />
        </label>
        <button
          type="button"
          onClick={editer}
          disabled={envoi || !liste || liste.extraits.length === 0 || bornesIllisibles !== null}
          className="bg-sel text-white text-[11.5px] font-semibold px-4 py-1.5 rounded-full disabled:opacity-50"
        >
          {envoi ? 'Édition…' : nombreAEditer > 0 ? `Éditer les extraits de ${nombreAEditer} compte(s)` : 'Éditer tous les extraits'}
        </button>
        <Aide
          titre="Édition chaînée des extraits"
          texte="Un classeur, une feuille de sommaire puis une feuille par extrait, compte par compte et du plus ancien au plus récent · solde de départ, lignes du relevé avec leur solde progressif, totaux, solde imprimé par la banque et lignes rapprochées. L'édition est une reconstitution datée depuis le fichier importé · la pièce probante reste le relevé reçu de la banque, conservé (AUDCIF art. 22, 7° ; art. 24). Les bornes portent sur la date du relevé. La liste montre deux cents extraits au plus · au-delà, choisissez un compte."
          source="Sage 100 Moyens de paiement, manuel de référence v16, p. 25 · AUDCIF art. 22, 7° et art. 24"
        />
      </div>
      {bornesIllisibles && <div className="text-[11.5px] text-danger mb-2">{bornesIllisibles}</div>}
      {erreurEdition && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mb-3 max-w-[900px]">{erreurEdition}</div>}
      {erreur && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mb-3 max-w-[900px]">
          {erreur}{' '}
          <button type="button" onClick={relire} className="underline">
            Relire
          </button>
        </div>
      )}
      {!liste && !erreur && <div className="text-[11.5px] text-text-dim">Chargement…</div>}
      {liste && liste.extraits.length === 0 && (
        <div className="text-[11.5px] text-text-dim">
          {compteChoisi
            ? 'Aucun relevé importé sur ce compte.'
            : 'Aucun relevé importé · un extrait naît de l’import d’un relevé dans un rapprochement bancaire (Traitement › Rapprochement bancaire).'}
        </div>
      )}
      {liste?.tronque && (
        <div className="text-[11.5px] text-warning mb-2">
          {liste.extraits.length} extraits montrés sur {liste.total}
          {compteChoisi ? ' pour ce compte · restreignez l’édition par dates.' : ' · les comptes au-delà ne sont pas montrés, choisissez un compte.'}
        </div>
      )}
      {liste?.comptesTronques && <div className="text-[11.5px] text-warning mb-2">La liste des comptes à extrait est tronquée · les comptes au-delà ne se choisissent pas ici.</div>}
      {parCompte.map((g) => (
        <div key={g.compteId} className="border border-border bg-surface shadow-posee max-w-[1000px] overflow-x-auto mb-3" role="table" aria-label={`Extraits du compte ${g.numero}`}>
          <label className="flex items-center gap-2 px-3.5 py-1.5 bg-chrome border-b border-border text-[11.5px] font-bold">
            <input type="checkbox" checked={cochees.includes(g.compteId)} onChange={(e) => cocher(g.compteId, e.target.checked)} />
            <span>
              {g.numero} · {g.nom}
            </span>
            <span className="font-normal text-text-dim">
              · {g.extraits.length} extrait{g.extraits.length > 1 ? 's' : ''}
            </span>
          </label>
          <div role="row" className={`${GRILLE} py-1 border-b border-border text-[11px] font-bold text-text-dim`}>
            <span role="columnheader">Relevé au</span>
            <span role="columnheader" className="text-right">
              Solde de départ
            </span>
            <span role="columnheader" className="text-right">
              Mouvements
            </span>
            <span role="columnheader" className="text-right">
              Solde imprimé
            </span>
            <span role="columnheader" className="text-right">
              Écart
            </span>
            <span role="columnheader" className="text-right">
              Lignes
            </span>
            <span role="columnheader" className="text-right">
              Rapprochées
            </span>
            <span role="columnheader">Statut</span>
            <span role="columnheader">Fichier importé</span>
          </div>
          {g.extraits.map((e, i) => {
            const fichier = e.releveImporteLe ? `${e.releveNomFichier ?? 'sans nom'} · ${instant(e.releveImporteLe)}` : 'import non daté';
            return (
              <button
                type="button"
                role="row"
                key={e.rapprochementId}
                onClick={() => navigate(`/rapprochement/${e.rapprochementId}`)}
                title="Ouvrir le rapprochement de cet extrait"
                className={`${GRILLE} py-1.5 items-center border-b border-border last:border-b-0 text-[11.5px] w-full text-left hover:bg-a-50 ${
                  i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt'
                }`}
              >
                <span role="cell" className="font-mono text-[11px]">
                  {date(e.dateReleve)}
                </span>
                <span role="cell" className="font-mono text-right">
                  {e.soldeDepart === null ? 'inconnu' : montant(e.soldeDepart)}
                </span>
                <span role="cell" className="font-mono text-right">
                  {montant(e.mouvementsNet)}
                </span>
                <span role="cell" className="font-mono text-right">
                  {montant(e.soldeReleve)}
                </span>
                <span role="cell" className={`font-mono text-right ${e.ecartReleve !== null && Math.abs(e.ecartReleve) >= 0.005 ? 'text-danger' : ''}`}>
                  {e.ecartReleve === null ? '·' : montant(e.ecartReleve)}
                </span>
                <span role="cell" className="font-mono text-right">
                  {e.nombreLignes}
                </span>
                <span role="cell" className="font-mono text-right">
                  {e.nombreRapprochees}
                </span>
                <span role="cell">{LIBELLE_STATUT[e.statut]}</span>
                <span role="cell" className="text-text-dim truncate" title={fichier}>
                  {fichier}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
