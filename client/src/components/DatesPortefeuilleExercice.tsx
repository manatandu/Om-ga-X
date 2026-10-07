import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from './chrome/Aide';

/**
 * L'ASSEMBLÉE GÉNÉRALE ORDINAIRE DE L'EXERCICE, ET POUR UNE ENTREPRISE DU
 * PORTEFEUILLE DE L'ÉTAT LE DÉPÔT ET LE PROCÈS-VERBAL (O.-L. n° 13/003,
 * art. 112 et 113 ; décision par la loi du 2026-10-04, point 1 ; relecture 1).
 *
 * Montré à toute société commerciale du SYSCOHADA · la date de l'assemblée
 * fait aussi courir le procès-verbal à transmettre à l'Administration des
 * impôts (LPF art. 13 bis), compté depuis elle quand elle est déclarée. Le
 * dépôt au ministère et la transmission du procès-verbal ne sont demandés
 * qu'à l'entreprise du portefeuille. Déclarées, jamais supposées · sans
 * elles, le planning dit « Non calculée ».
 *
 * Mêmes rôles que l'arrêté des comptes (administrateur du dossier) · la
 * route se refuse aux autres, l'écran ne leur montre qu'une lecture.
 */
export function DatesPortefeuilleExercice({
  exerciceId,
  portefeuille,
  dateAssembleeGenerale,
  dateDepotEtatsPortefeuille,
  dateTransmissionPvPortefeuille,
  apresEnregistrement,
}: {
  exerciceId: string;
  /** Entreprise du portefeuille de l'État déclarée (« oui ») · dépôt et procès-verbal demandés. */
  portefeuille: boolean;
  dateAssembleeGenerale: string | null;
  dateDepotEtatsPortefeuille: string | null;
  dateTransmissionPvPortefeuille: string | null;
  apresEnregistrement: () => Promise<void> | void;
}) {
  // Le droit se LIT dans le contexte de session · la route est réservée à
  // l'administrateur du dossier, comme l'arrêté des comptes.
  const { estAdmin: peutDeclarer } = useAuth();
  const [assemblee, setAssemblee] = useState('');
  const [depot, setDepot] = useState('');
  const [transmission, setTransmission] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Une réponse d'un exercice quitté, ou d'un envoi dépassé par un autre, ne
  // s'affiche pas · le numéro d'envoi change à chaque envoi et à chaque
  // changement d'exercice.
  const envoiCourant = useRef(0);

  // Changer d'exercice efface les messages et périme l'envoi en cours.
  useEffect(() => {
    envoiCourant.current += 1;
    setErreur(null);
    setInfo(null);
    setEnvoi(false);
  }, [exerciceId]);

  // Les champs suivent l'exercice et les dates servies (relues après un
  // enregistrement, sans effacer le message qui le confirme).
  useEffect(() => {
    setAssemblee(dateAssembleeGenerale ? dateAssembleeGenerale.slice(0, 10) : '');
    setDepot(dateDepotEtatsPortefeuille ? dateDepotEtatsPortefeuille.slice(0, 10) : '');
    setTransmission(dateTransmissionPvPortefeuille ? dateTransmissionPvPortefeuille.slice(0, 10) : '');
  }, [exerciceId, dateAssembleeGenerale, dateDepotEtatsPortefeuille, dateTransmissionPvPortefeuille]);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    const moi = ++envoiCourant.current;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/${exerciceId}/dates-portefeuille`, {
        dateAssembleeGenerale: assemblee === '' ? null : assemblee,
        ...(portefeuille
          ? {
              dateDepotEtatsPortefeuille: depot === '' ? null : depot,
              dateTransmissionPvPortefeuille: transmission === '' ? null : transmission,
            }
          : {}),
      });
      await apresEnregistrement();
      if (moi === envoiCourant.current) setInfo('Dates enregistrées.');
    } catch (err) {
      if (moi === envoiCourant.current) setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      if (moi === envoiCourant.current) setEnvoi(false);
    }
  };

  const champ = 'mt-1 block border border-border-dark px-2 py-1 text-[11.5px]';
  const lecture = (iso: string) => (iso === '' ? 'Non renseignée' : new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' }));
  const date = (libelle: string, valeur: string, changer: (v: string) => void) => (
    <label className="text-[11.5px] font-semibold text-text-dim">
      {libelle}
      {peutDeclarer ? (
        <input
          type="date"
          value={valeur}
          onChange={(e) => {
            changer(e.target.value);
            setInfo(null);
          }}
          className={champ}
        />
      ) : (
        <span className={`${champ} border-transparent ${valeur === '' ? 'text-text-dim italic' : 'text-text'}`}>{lecture(valeur)}</span>
      )}
    </label>
  );

  return (
    <form onSubmit={enregistrer} className="mb-4 border border-border bg-surface px-4 py-3 max-w-[720px]">
      <div className="text-[11.5px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
        {portefeuille ? 'Assemblée et dépôt au ministère du Portefeuille' : 'Assemblée générale ordinaire'}
        <Aide
          titre={portefeuille ? 'Entreprise du portefeuille de l’État' : 'Assemblée générale ordinaire'}
          texte={
            portefeuille
              ? 'L’assemblée générale ordinaire statuant sur l’exercice clos au 31 décembre se tient au plus tard le 31 mars, et son procès-verbal part à l’Administration des recettes non fiscales dans les dix jours. L’affectation des résultats intervient dans les soixante jours du dépôt des états financiers au ministère du Portefeuille. Ces dates ne sont dans aucun livre : déclarez-les pour que le planning calcule les échéances et lève les jalons accomplis. La date de l’assemblée fait aussi courir le procès-verbal à transmettre à l’Administration des impôts.'
              : 'La date de l’assemblée générale ordinaire qui statue sur l’exercice fait courir le délai du procès-verbal à transmettre à l’Administration des impôts. Elle n’est dans aucun livre : déclarez-la. Sans elle, le planning retient la date limite de l’assemblée.'
          }
          source={portefeuille ? 'Ordonnance-loi n° 13/003, art. 112 et 113 ; loi de procédures fiscales, art. 13 bis' : 'Loi de procédures fiscales, art. 13 bis'}
        />
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        {date('Assemblée générale tenue le', assemblee, setAssemblee)}
        {portefeuille && date('États déposés au ministère le', depot, setDepot)}
        {portefeuille && date('Procès-verbal communiqué le', transmission, setTransmission)}
        {peutDeclarer && (
          <button type="submit" disabled={envoi} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50">
            {envoi ? '…' : 'Enregistrer'}
          </button>
        )}
      </div>
      {erreur && <div className="mt-2 text-[11.5px] text-danger">{erreur}</div>}
      {info && <div className="mt-2 text-[11.5px] text-positive">{info}</div>}
    </form>
  );
}
