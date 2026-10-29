import { useState } from 'react';
import { api } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { Erreur, useEnvoi, useLecture } from './SuiviPersonnelPaie';

/**
 * LIGNE PAIE-SUITE, FONCTION 76 · LES COMPTES INDIVIDUELS DES SALARIÉS SOUS LE
 * 422 · l'état (option, salariés avec et sans compte) et l'ouverture du
 * registre par tranches de cent, réservée à l'administrateur comme le compte
 * d'un tiers. Rien ne s'affiche quand l'option est retirée et qu'aucun compte
 * n'existe · la bande n'aurait rien à dire.
 */
type Etat = { option: boolean; avecCompte: number; sansCompte: number };

export function BandeComptesIndividuels({ estAdmin, onOuverts }: { estAdmin: boolean; onOuverts: () => void }) {
  const lecture = useLecture<Etat>(() => api.get<Etat>('/personnel/comptes-individuels'), 'comptes-individuels');
  const [fait, setFait] = useState<string | null>(null);
  const { envoi, envoyer } = useEnvoi(() => {
    lecture.relire();
    onOuverts();
  }, lecture.setErreur);

  if (lecture.erreur) return <Erreur m={lecture.erreur} />;
  const e = lecture.donnees;
  if (!e || (!e.option && e.avecCompte === 0)) return null;

  const ouvrir = () =>
    void envoyer(async () => {
      const r = await api.post<{ ouverts: number; restent: number }>('/personnel/comptes-individuels', {});
      setFait(`${r.ouverts} compte(s) ouvert(s)${r.restent > 0 ? ` · ${r.restent} salarié(s) restent sans compte, relancez` : ''}.`);
    });

  return (
    <div className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 text-[11.5px]">
      <span>
        Comptes individuels sous le 422 · {e.avecCompte} salarié(s) avec compte, {e.sansCompte} sans
        {!e.option && ' · option retirée, la paie va au collectif'}{' '}
        <Aide
          titre="Comptes individuels des salariés"
          texte="La paie crédite le brut et débite les retenues sur le compte du salarié, le paiement y débite le net, et la balance générale fond ces comptes sur le 422. Un bulletin passé avant l’ouverture de son compte se paie et se reprend sur le collectif, où son net a été inscrit. L’ouverture se fait par tranches de cent salariés."
          source="Fiche du compte 42 des deux plans · option d’OmegaX"
        />
      </span>
      {estAdmin && e.option && e.sansCompte > 0 && (
        <button type="button" className="border border-border px-2.5 py-0.5" disabled={envoi} onClick={ouvrir}>
          Ouvrir les comptes individuels
        </button>
      )}
      {fait && <span className="text-text-dim">{fait}</span>}
    </div>
  );
}
