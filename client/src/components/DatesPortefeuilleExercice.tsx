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
 *
 * ENTREPRISE MINIÈRE DU PORTEFEUILLE (décision par la loi du 2026-10-07,
 * point 3 · arrêté interministériel du 10 décembre 2025, art. 2) · trois dates
 * de plus · déclaration du dividende prioritaire, réception de la note de
 * perception (elle fait courir les huit jours) et paiement. Le procès-verbal
 * à l'Administration des impôts n'est dû que sous commissaire aux comptes
 * (point 7), et la bulle le dit.
 */
export function DatesPortefeuilleExercice({
  exerciceId,
  portefeuille,
  dateAssembleeGenerale,
  dateDepotEtatsPortefeuille,
  dateTransmissionPvPortefeuille,
  secteurMinier = false,
  dateDeclarationDividendeEtat = null,
  dateNotePerceptionDividende = null,
  datePaiementDividendeEtat = null,
  apresEnregistrement,
}: {
  exerciceId: string;
  /** Entreprise du portefeuille de l'État déclarée (« oui ») · dépôt et procès-verbal demandés. */
  portefeuille: boolean;
  dateAssembleeGenerale: string | null;
  dateDepotEtatsPortefeuille: string | null;
  dateTransmissionPvPortefeuille: string | null;
  /** Entreprise MINIÈRE du portefeuille déclarée · les dates du dividende prioritaire sont demandées. */
  secteurMinier?: boolean;
  dateDeclarationDividendeEtat?: string | null;
  dateNotePerceptionDividende?: string | null;
  datePaiementDividendeEtat?: string | null;
  apresEnregistrement: () => Promise<void> | void;
}) {
  // Le droit se LIT dans le contexte de session · la route est réservée à
  // l'administrateur du dossier, comme l'arrêté des comptes.
  const { estAdmin: peutDeclarer } = useAuth();
  const [assemblee, setAssemblee] = useState('');
  const [depot, setDepot] = useState('');
  const [transmission, setTransmission] = useState('');
  const [declarationDividende, setDeclarationDividende] = useState('');
  const [notePerception, setNotePerception] = useState('');
  const [paiementDividende, setPaiementDividende] = useState('');
  const dividende = portefeuille && secteurMinier;
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Une réponse d'un exercice quitté, ou d'un envoi dépassé par un autre, ne
  // s'affiche pas · le numéro d'envoi change à chaque envoi et à chaque
  // changement d'exercice.
  const envoiCourant = useRef(0);
  // L'exercice affiché · comparé à celui de l'envoi avant tout message.
  const exerciceAffiche = useRef(exerciceId);

  // Changer d'exercice efface les messages et périme l'envoi en cours.
  useEffect(() => {
    exerciceAffiche.current = exerciceId;
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
    setDeclarationDividende(dateDeclarationDividendeEtat ? dateDeclarationDividendeEtat.slice(0, 10) : '');
    setNotePerception(dateNotePerceptionDividende ? dateNotePerceptionDividende.slice(0, 10) : '');
    setPaiementDividende(datePaiementDividendeEtat ? datePaiementDividendeEtat.slice(0, 10) : '');
  }, [
    exerciceId,
    dateAssembleeGenerale,
    dateDepotEtatsPortefeuille,
    dateTransmissionPvPortefeuille,
    dateDeclarationDividendeEtat,
    dateNotePerceptionDividende,
    datePaiementDividendeEtat,
  ]);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    const moi = ++envoiCourant.current;
    const pour = exerciceId;
    const valable = () => moi === envoiCourant.current && exerciceAffiche.current === pour;
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
        // Le serveur refuse ces dates hors d'une entreprise minière du
        // portefeuille déclarée · elles ne partent qu'avec elle.
        ...(dividende
          ? {
              dateDeclarationDividendeEtat: declarationDividende === '' ? null : declarationDividende,
              dateNotePerceptionDividende: notePerception === '' ? null : notePerception,
              datePaiementDividendeEtat: paiementDividende === '' ? null : paiementDividende,
            }
          : {}),
      });
      await apresEnregistrement();
      if (valable()) setInfo('Dates enregistrées.');
    } catch (err) {
      if (valable()) setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      if (valable()) setEnvoi(false);
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
              ? 'L’assemblée générale ordinaire statuant sur l’exercice clos au 31 décembre se tient au plus tard le 31 mars, et son procès-verbal part à l’Administration des recettes non fiscales dans les dix jours, ainsi qu’au Secrétariat Général du Portefeuille avec celui du conseil d’administration ; la transmission tardive donne lieu à une astreinte de 100 USD par jour de retard, que le logiciel ne calcule pas. L’affectation des résultats intervient dans les soixante jours du dépôt des états financiers au ministère du Portefeuille. Ces dates ne sont dans aucun livre : déclarez-les pour que le planning calcule les échéances et lève les jalons accomplis. La date de l’assemblée fait aussi courir le procès-verbal à transmettre à l’Administration des impôts, dû quand un commissaire aux comptes certifie les états, toujours dans une société anonyme.' +
                (dividende
                  ? ' Entreprise minière : le dividende de l’État, prioritaire sur toute autre affectation du bénéfice net comptable, se déclare au plus tard le 15 mai, indépendamment de l’assemblée, et se paie dans les huit jours de la réception de la note de perception. Son montant est le bénéfice multiplié par la quote-part de l’État déclarée dans Paramètres du dossier.'
                  : '')
              : 'La date de l’assemblée générale ordinaire qui statue sur l’exercice fait courir le délai du procès-verbal à transmettre à l’Administration des impôts, dix jours après la tenue, quand un commissaire aux comptes certifie les états, toujours dans une société anonyme ; ailleurs, sans commissaire, il n’est pas dû. C’est l’échéancier fiscal qui la lit, pas le planning de clôture. Elle n’est dans aucun livre : déclarez-la. Sans elle, l’échéancier retient un repère, à corriger sur la date réelle.'
          }
          source={
            portefeuille
              ? `Ordonnance-loi n° 13/003, art. 112 et 113 ; loi de procédures fiscales, art. 13 bis ; arrêté interministériel du 10 décembre 2025, art. 1er et 5${dividende ? ', 2 et 3' : ''}`
              : 'Loi de procédures fiscales, art. 13 bis'
          }
        />
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        {date('Assemblée générale tenue le', assemblee, setAssemblee)}
        {portefeuille && date('États déposés au ministère le', depot, setDepot)}
        {portefeuille && date('Procès-verbal communiqué le', transmission, setTransmission)}
        {dividende && date('Dividende déclaré le', declarationDividende, setDeclarationDividende)}
        {dividende && date('Note de perception reçue le', notePerception, setNotePerception)}
        {dividende && date('Dividende payé le', paiementDividende, setPaiementDividende)}
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
