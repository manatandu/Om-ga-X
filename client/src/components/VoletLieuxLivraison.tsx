import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from './chrome/Aide';
import { corpsDuLieu, LIEU_VIDE, saisieDuLieu, type LieuLivraison, type ListeLieux, type SaisieLieu } from '../lib/lieux-livraison';

/**
 * Volet « Lieux de livraison » de la fiche d'un client (ligne sage-l2,
 * fonction 31 · Sage, F_LIVRAISON). Lu par tous ; écrit par l'administrateur
 * seul, comme les RIB et le reste de la structure du tiers. Le serveur juge
 * tout (client seulement, intitulé unique, un seul principal) et l'écran dit
 * son refus.
 */
export function VoletLieuxLivraison({ tiersId }: { tiersId: string }) {
  const { estAdmin } = useAuth();
  const [liste, setListe] = useState<ListeLieux | null>(null);
  const [saisie, setSaisie] = useState<SaisieLieu>(LIEU_VIDE);
  /** `null` · formulaire fermé ; '' · nouveau lieu ; sinon l'identifiant du lieu retouché. */
  const [edite, setEdite] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const lire = () => api.get<ListeLieux>(`/tiers/${tiersId}/lieux-livraison`);
  const recharger = () =>
    lire()
      .then(setListe)
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Lieux de livraison illisibles'));

  // Une réponse arrivée après un changement de client ne s'affiche pas sous la fiche suivante.
  useEffect(() => {
    let actuel = true;
    lire()
      .then((l) => actuel && setListe(l))
      .catch((e) => actuel && setErreur(e instanceof ApiError ? e.message : 'Lieux de livraison illisibles'));
    return () => {
      actuel = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiersId]);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    try {
      if (edite) await api.patch(`/lieux-livraison/${edite}`, corpsDuLieu(saisie));
      else await api.post(`/tiers/${tiersId}/lieux-livraison`, corpsDuLieu(saisie));
      setSaisie(LIEU_VIDE);
      setEdite(null);
      await recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Lieu non enregistré');
    }
  };

  const basculer = async (l: LieuLivraison, champ: { estPrincipal: true } | { estActif: boolean }) => {
    setErreur(null);
    try {
      await api.patch(`/lieux-livraison/${l.id}`, { intitule: l.intitule, ...champ });
      await recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Lieu non modifié');
    }
  };

  const retirer = async (l: LieuLivraison) => {
    if (!window.confirm(`Retirer le lieu de livraison « ${l.intitule} » ?`)) return;
    setErreur(null);
    try {
      await api.delete(`/lieux-livraison/${l.id}`);
      await recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Retrait impossible');
    }
  };

  const champ = (cle: keyof SaisieLieu, libelle: string, largeur = 'w-full') => (
    <input
      aria-label={libelle}
      placeholder={libelle}
      value={saisie[cle]}
      maxLength={cle === 'intitule' ? 35 : undefined}
      onChange={(e) => setSaisie((s) => ({ ...s, [cle]: e.target.value }))}
      className={`${largeur} min-w-0 border border-border-dark px-2 py-1 text-[11.5px]`}
    />
  );

  return (
    <div className="border-t border-border pt-2.5 mt-3">
      <div className="text-[11px] font-bold text-text-dim mb-1.5 flex items-center gap-1.5">
        Lieux de livraison
        <Aide
          titre="Lieux de livraison du client"
          texte="Les adresses où le client reçoit ses marchandises, à côté de l'adresse de la fiche, qui reste celle des factures et des relances. Un seul lieu principal, le premier d'office ; un lieu en sommeil ne l'est jamais. Aucun effet comptable. Modification réservée à l'administrateur."
          source="Sage 100, F_LIVRAISON · règles d'OmegaX"
        />
      </div>
      {erreur && (
        <div role="alert" className="text-[11px] text-danger mb-1.5">
          {erreur}
        </div>
      )}
      {liste === null && !erreur && <div className="text-[11.5px] text-text-dim mb-2">Lecture…</div>}
      {liste !== null && liste.lieux.length === 0 && <div className="text-[11.5px] text-text-dim mb-2">Aucun lieu de livraison.</div>}
      {liste?.tronque && (
        <div className="text-[11px] text-warning mb-1.5">
          {liste.lieux.length} lieux montrés sur {liste.total}.
        </div>
      )}
      {liste?.lieux.map((l) => (
        <div key={l.id} className={`border border-border mb-1.5 px-2.5 py-1.5 text-[11.5px] ${l.estActif ? '' : 'opacity-60'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold truncate">{l.intitule}</span>
            {l.estPrincipal && <span className="text-[10.5px] text-sel font-semibold shrink-0">Principal</span>}
            {!l.estActif && <span className="text-[10.5px] text-warning font-semibold shrink-0">En sommeil</span>}
          </div>
          <div className="truncate">{[l.adresse, l.complement, l.boitePostale].filter(Boolean).join(' · ')}</div>
          <div className="text-[11px] text-text-dim truncate">{[l.ville, l.pays, l.contact, l.telephone, l.email].filter(Boolean).join(' · ')}</div>
          {estAdmin && (
            <div className="flex flex-wrap gap-2.5 mt-1">
              {!l.estPrincipal && l.estActif && (
                <button
                  type="button"
                  aria-label={`Rendre principal le lieu ${l.intitule}`}
                  onClick={() => void basculer(l, { estPrincipal: true })}
                  className="text-[11px] text-sel hover:underline">
                  Rendre principal
                </button>
              )}
              <button
                type="button"
                aria-label={`Modifier le lieu ${l.intitule}`}
                onClick={() => {
                  setSaisie(saisieDuLieu(l));
                  setEdite(l.id);
                }}
                className="text-[11px] text-sel hover:underline"
              >
                Modifier
              </button>
              <button
                type="button"
                aria-label={`${l.estActif ? 'Mettre en sommeil' : 'Réactiver'} le lieu ${l.intitule}`}
                onClick={() => void basculer(l, { estActif: !l.estActif })}
                className="text-[11px] text-sel hover:underline">
                {l.estActif ? 'Mettre en sommeil' : 'Réactiver'}
              </button>
              <button type="button" aria-label={`Retirer le lieu ${l.intitule}`} onClick={() => void retirer(l)} className="text-[11px] text-danger hover:underline">
                Retirer
              </button>
            </div>
          )}
        </div>
      ))}

      {estAdmin && edite === null && (
        <button
          type="button"
          onClick={() => {
            setSaisie(LIEU_VIDE);
            setEdite('');
          }}
          className="text-[11.5px] text-sel hover:underline"
        >
          Ajouter un lieu
        </button>
      )}
      {estAdmin && edite !== null && (
        <form onSubmit={enregistrer} className="mt-1.5 space-y-1.5">
          {champ('intitule', 'Intitulé du lieu')}
          {champ('adresse', 'Adresse du lieu')}
          {champ('complement', "Complément d'adresse")}
          <div className="flex gap-1.5">
            {champ('boitePostale', 'Boîte postale du lieu')}
            {champ('ville', 'Ville du lieu')}
          </div>
          <div className="flex gap-1.5">
            {champ('pays', 'Pays du lieu')}
            {champ('contact', 'Contact sur place')}
          </div>
          <div className="flex gap-1.5">
            {champ('telephone', 'Téléphone du lieu')}
            {champ('email', 'Courriel du lieu')}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEdite(null)} className="text-[11.5px] text-text-dim hover:underline">
              Annuler
            </button>
            <button type="submit" className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1">
              Enregistrer le lieu
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
