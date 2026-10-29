import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { ecouterEchap } from '../lib/echap';
import { montant } from '../lib/montants';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';
import { lettrageDeLaLigne, sensDuSolde, type InterrogationCompte } from '../lib/interrogation-compte';

/**
 * INTERROGER LE COMPTE DEPUIS LA SAISIE (ligne gl-saisie, fonction 13 · Sage
 * i7, double-clic sur le compte). Le solde que le compte porte déjà et ses
 * dernières lignes, lus au serveur (`GET /interrogation-compte/:compteId`),
 * sans quitter la pièce en cours · rien n'est écrit.
 *
 * Les trois sommes restent nommées · le livre-journal, le brouillard,
 * l'à-nouveau provisoire. Un échec de lecture se dit, jamais « aucune ligne ».
 */
export function ModaleInterrogationCompte({
  compteId,
  numero,
  exerciceId,
  onFermer,
}: {
  compteId: string;
  numero: string;
  exerciceId: string;
  onFermer: () => void;
}) {
  const [lu, setLu] = useState<InterrogationCompte | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => bouton.current?.focus({ preventScroll: true }), []);
  useEffect(
    () =>
      ecouterEchap(() => {
        fermerRef.current();
        return true;
      }),
    [],
  );
  useEffect(() => {
    let actif = true;
    setLu(null);
    setErreur(null);
    api
      .get<InterrogationCompte>(`/interrogation-compte/${compteId}?exerciceId=${exerciceId}`)
      .then((r) => actif && setLu(r))
      .catch((e) => actif && setErreur(e instanceof ApiError ? e.message : 'Lecture du compte impossible'));
    return () => {
      actif = false;
    };
  }, [compteId, exerciceId]);

  const ligneSomme = (titre: string, s: { debit: number; credit: number; solde: number }) => (
    <tr>
      <td>{titre}</td>
      <td className="text-right font-mono">{montant(s.debit)}</td>
      <td className="text-right font-mono">{montant(s.credit)}</td>
      <td className="text-right font-mono">
        {montant(Math.abs(s.solde))} {sensDuSolde(s.solde)}
      </td>
    </tr>
  );

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-interrogation-compte"
          className="anim-modale w-full max-w-[760px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 border-b border-border">
            <span id="titre-interrogation-compte">Interrogation du compte {numero}</span>
            <div className="flex items-center gap-2">
              <Aide
                titre="Interrogation du compte"
                texte="Ce que le compte porte déjà dans l’exercice, sans quitter la pièce · le livre-journal (écritures validées), le brouillard (saisi, non validé) et l’à-nouveau provisoire, que la clôture de l’exercice précédent remplacera. Le solde à ce jour additionne les trois. Les simulations du journal de situation et l’écriture qui solde les comptes de gestion à la clôture n’y entrent pas. Ce n’est pas le grand livre · seules les dernières lignes sont montrées, leur nombre total est dit."
                source="Sage 100 · interrogation du compte depuis la saisie ; AUDCIF art. 22, 2°"
              />
              <button
                ref={bouton}
                type="button"
                onClick={onFermer}
                aria-label="Fermer"
                className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c]"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {erreur && <div className="text-danger">{erreur}</div>}
            {!erreur && !lu && <div className="text-text-dim">Lecture du compte…</div>}
            {lu && (
              <>
                <div className="font-semibold">
                  {lu.compte.numero} · {lu.compte.intitule}
                  {!lu.compte.estActif && <span className="ml-2 text-warning">en sommeil</span>}
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Somme</th>
                      <th className="text-right">Débit</th>
                      <th className="text-right">Crédit</th>
                      <th className="text-right">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ligneSomme('Livre-journal', lu.livreJournal)}
                    {ligneSomme('Brouillard', lu.brouillard)}
                    {(lu.aNouveauProvisoire.debit !== 0 || lu.aNouveauProvisoire.credit !== 0) &&
                      ligneSomme('À-nouveau provisoire', lu.aNouveauProvisoire)}
                    <tr className="font-semibold">
                      <td colSpan={3}>Solde à ce jour</td>
                      <td className="text-right font-mono">
                        {montant(Math.abs(lu.soldeAuJour))} {sensDuSolde(lu.soldeAuJour)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="text-text-dim">
                  {lu.nombreLignes === 0
                    ? 'Aucune ligne sur ce compte dans l’exercice.'
                    : lu.tronque
                      ? `Les ${lu.lignes.length} lignes les plus récentes, sur ${lu.nombreLignes}.`
                      : `${lu.nombreLignes} ligne${lu.nombreLignes > 1 ? 's' : ''} dans l’exercice.`}
                </div>
                {lu.lignes.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr>
                          <th className="text-left">Date</th>
                          <th className="text-left">Journal</th>
                          <th className="text-left">Pièce</th>
                          <th className="text-left">Libellé</th>
                          <th className="text-right">Débit</th>
                          <th className="text-right">Crédit</th>
                          <th className="text-left">Lettrage</th>
                          <th className="text-left">État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lu.lignes.map((l) => (
                          <tr key={l.id}>
                            <td>{l.date.split('-').reverse().join('/')}</td>
                            <td>{l.journal}</td>
                            <td>{l.numeroPiece ?? l.reference ?? ''}</td>
                            <td className="truncate max-w-[220px]">{l.libelle}</td>
                            <td className="text-right font-mono">{l.debit ? montant(l.debit) : ''}</td>
                            <td className="text-right font-mono">{l.credit ? montant(l.credit) : ''}</td>
                            <td>{lettrageDeLaLigne(l)}</td>
                            <td>{l.aNouveauProvisoire ? 'À-nouveau provisoire' : l.statut === 'VALIDEE' ? 'Validée' : 'Brouillard'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
