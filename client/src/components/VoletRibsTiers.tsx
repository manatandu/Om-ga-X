import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from './chrome/Aide';
import { auteurDeLaSaisie, corpsDuVisa, etatDuVisa, peutViser, type VisaRibLu } from '../lib/visa-rib';

interface RibTiers {
  id: string;
  banque: string;
  titulaire: string | null;
  codeBanque: string | null;
  codeGuichet: string | null;
  numeroCompte: string | null;
  cle: string | null;
  iban: string | null;
  codeBic: string | null;
  devise: string | null;
  estPrincipal: boolean;
  commentaire: string | null;
  visa?: VisaRibLu;
}

const VIDE = { banque: '', titulaire: '', iban: '', codeBanque: '', codeGuichet: '', numeroCompte: '', cle: '', codeBic: '', devise: '' };

function coordonnees(r: RibTiers): string {
  if (r.iban) return `IBAN ${r.iban.replace(/(.{4})/g, '$1 ').trim()}`;
  return [r.codeBanque, r.codeGuichet, r.numeroCompte, r.cle].filter(Boolean).join(' ');
}

/**
 * Volet « Coordonnées bancaires » de la fiche tiers (RIB des tiers, priorité 1
 * de la comparaison avec les autres produits Sage). Lu par tous ; écrit par
 * l'administrateur seul, comme le reste de la structure du tiers · un RIB
 * changé en silence détourne un paiement, et la table est au journal d'audit.
 * Le RIB principal est celui que l'ordre de virement recopie.
 */
export function VoletRibsTiers({ tiersId }: { tiersId: string }) {
  const { estAdmin, peutValider } = useAuth();
  // Null tant que la liste n'est pas LUE · « Aucun RIB » ne se dit que sur une liste lue.
  const [ribs, setRibs] = useState<RibTiers[] | null>(null);
  const [avis, setAvis] = useState<string | null>(null);
  const [saisie, setSaisie] = useState(VIDE);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = () =>
    api
      .get<RibTiers[]>(`/tiers/${tiersId}/ribs`)
      .then(setRibs)
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Coordonnées bancaires illisibles'));

  // Même drapeau que le volet Documents · une réponse arrivée après un
  // changement de tiers ne s'affiche pas sous la fiche suivante.
  useEffect(() => {
    let actuel = true;
    setRibs(null);
    setErreur(null);
    setAvis(null);
    api
      .get<RibTiers[]>(`/tiers/${tiersId}/ribs`)
      .then((l) => actuel && setRibs(l))
      .catch((e) => actuel && setErreur(e instanceof ApiError ? e.message : 'Coordonnées bancaires illisibles'));
    return () => {
      actuel = false;
    };
  }, [tiersId]);

  const ajouter = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    try {
      await api.post(`/tiers/${tiersId}/ribs`, saisie);
      setSaisie(VIDE);
      setOuvert(false);
      await recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'RIB non enregistré');
    }
  };

  const rendrePrincipal = async (r: RibTiers) => {
    setErreur(null);
    try {
      // La route reçoit le RIB entier · on renvoie ses champs tels quels, et
      // rien d'autre (identifiants et dates ne se modifient pas).
      const corps = Object.fromEntries(
        [...Object.keys(VIDE), 'commentaire'].map((k) => [k, (r[k as keyof RibTiers] as string | null) ?? '']),
      );
      await api.patch(`/ribs-tiers/${r.id}`, { ...corps, estPrincipal: true });
      await recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'RIB non modifié');
    }
  };

  // Le serveur juge qui vise (jamais l'auteur des coordonnées) et refuse un RIB
  // changé depuis la lecture · l'écran renvoie l'instant de la saisie qu'il a montrée.
  const viser = async (r: RibTiers) => {
    setErreur(null);
    setAvis(null);
    try {
      const rep = await api.post<{ avertissement: string | null }>(`/ribs-tiers/${r.id}/viser`, corpsDuVisa(r.visa!));
      setAvis(rep.avertissement);
      await recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Visa non enregistré');
    }
  };

  const retirer = async (r: RibTiers) => {
    if (!window.confirm(`Retirer le RIB ${r.banque} · ${coordonnees(r)} ?`)) return;
    setErreur(null);
    try {
      await api.delete(`/ribs-tiers/${r.id}`);
      await recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Retrait impossible');
    }
  };

  const champ = (cle: keyof typeof VIDE, libelle: string, largeur = 'w-full') => (
    <input
      aria-label={libelle}
      placeholder={libelle}
      value={saisie[cle]}
      onChange={(e) => setSaisie((s) => ({ ...s, [cle]: e.target.value }))}
      className={`${largeur} min-w-0 border border-border-dark px-2 py-1 text-[11.5px]`}
    />
  );

  return (
    <div className="border-t border-border pt-2.5 mt-3">
      <div className="text-[11px] font-bold text-text-dim mb-1.5 flex items-center gap-1.5">
        Coordonnées bancaires
        <Aide
          titre="Coordonnées bancaires du tiers"
          texte="RIB ou IBAN du tiers, recopiés sur l'ordre de virement préparé depuis Règlement des tiers. Le RIB principal est celui que l'ordre retient ; le premier RIB l'est d'office. Seul l'IBAN est contrôlé (clé ISO 13616) ; le RIB national se conserve tel qu'il est saisi. Modification réservée à l'administrateur."
          source="Sage, Moyens de paiement · RIB/IBAN/BIC par tiers · règles d'OmegaX"
        />
        <Aide
          titre="Visa des RIB"
          texte="Quand le dossier exige le visa des RIB (Paramètres du dossier), un ordre de virement ne part que sur un RIB principal visé par un administrateur ou un comptable autre que celui qui a saisi ses coordonnées. Changer la banque, le numéro, l'IBAN, le BIC ou la devise fait tomber le visa ; le commentaire et la marque de principal non. Un RIB saisi avant cette règle n'a pas d'auteur connu, et sa réponse le dit."
          source="Option d'OmegaX · aucun texte ne l'impose (AUDCIF art. 69 ; SYCEBNL art. 16, 2)"
        />
      </div>
      {erreur && <div className="text-[11px] text-danger mb-1.5">{erreur}</div>}
      {avis && <div className="text-[11px] text-warning mb-1.5">{avis}</div>}
      {ribs === null && !erreur && <div className="text-[11.5px] text-text-dim mb-2">Chargement…</div>}
      {ribs !== null && ribs.length === 0 && <div className="text-[11.5px] text-text-dim mb-2">Aucun RIB.</div>}
      {(ribs ?? []).map((r) => (
        <div key={r.id} className="border border-border mb-1.5 px-2.5 py-1.5 text-[11.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold truncate">{r.banque}</span>
            {r.estPrincipal && <span className="text-[10.5px] text-sel font-semibold shrink-0">Principal</span>}
          </div>
          <div className="truncate">{coordonnees(r)}</div>
          <div className="text-[11px] text-text-dim truncate">
            {[r.titulaire, r.codeBic && `BIC ${r.codeBic}`, r.devise].filter(Boolean).join(' · ')}
          </div>
          {/* Absent d'une réponse d'un serveur d'avant le visa · rien n'est dit plutôt qu'un état inventé. */}
          {r.visa && (
            <div
              className={`text-[11px] truncate ${!r.visa.vise && r.visa.exige ? 'text-warning' : 'text-text-dim'}`}
              title={auteurDeLaSaisie(r.visa)}
            >
              {etatDuVisa(r.visa)}
            </div>
          )}
          {(estAdmin || peutViser(r.visa, peutValider)) && (
            <div className="flex gap-2.5 mt-1">
              {peutViser(r.visa, peutValider) && (
                <button type="button" onClick={() => viser(r)} className="text-[11px] text-sel hover:underline">
                  Viser
                </button>
              )}
              {estAdmin && !r.estPrincipal && (
                <button type="button" onClick={() => rendrePrincipal(r)} className="text-[11px] text-sel hover:underline">
                  Rendre principal
                </button>
              )}
              {estAdmin && (
                <button type="button" onClick={() => retirer(r)} className="text-[11px] text-danger hover:underline">
                  Retirer
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {estAdmin && !ouvert && (
        <button type="button" onClick={() => setOuvert(true)} className="text-[11.5px] text-sel hover:underline">
          Ajouter un RIB
        </button>
      )}
      {estAdmin && ouvert && (
        <form onSubmit={ajouter} className="mt-1.5 space-y-1.5">
          {champ('banque', 'Banque')}
          {champ('titulaire', 'Titulaire (si différent du tiers)')}
          {champ('iban', 'IBAN')}
          <div className="flex gap-1.5">
            {champ('codeBanque', 'Code banque')}
            {champ('codeGuichet', 'Guichet')}
          </div>
          <div className="flex gap-1.5">
            {champ('numeroCompte', 'N° de compte')}
            {champ('cle', 'Clé', 'w-[60px]')}
          </div>
          <div className="flex gap-1.5">
            {champ('codeBic', 'BIC')}
            {champ('devise', 'Devise', 'w-[70px]')}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOuvert(false)} className="text-[11.5px] text-text-dim hover:underline">
              Annuler
            </button>
            <button type="submit" className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1">
              Enregistrer
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
