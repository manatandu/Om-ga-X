import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { montant } from '../lib/montants';
import { libelleExercice } from '../lib/libelle-exercice';
import { Aide } from './chrome/Aide';

/** Ce que sert `GET /immobilisations/simulation-dotations` (ligne immos, n° 72). */
export interface SimulationLue {
  periodes: { dateDebut: string; dateFin: string; exerciceId: string | null; fictive: boolean }[];
  biens: {
    id: string;
    designation: string;
    numeroInventaire: string | null;
    compte: { numero: string; intitule: string };
    valeurBrute: number;
    cumulAvant: number;
    annuites: (number | null)[];
    passees: boolean[];
    valeurNetteFin: number | null;
    nonAmortissable?: boolean;
    pasEnService?: boolean;
    unitesOeuvre?: boolean;
    degressifFiscal?: boolean;
  }[];
  totaux: { montant: number; nonCalcules: number }[];
}

const jour = (iso: string) => iso.split('-').reverse().join('/');

/**
 * LA SIMULATION DES DOTATIONS FUTURES (ligne immos, fonction n° 72) · le plan
 * de chaque bien en service, exercice par exercice, par le moteur de la
 * dotation, sans rien écrire. Lue à la demande · null tant qu'elle n'est pas
 * lue, une annuité non calculée (unités d'œuvre sans relevé) ne se lit jamais
 * comme zéro.
 */
export function SimulationDotations({ exerciceId }: { exerciceId: string | undefined }) {
  const [nombre, setNombre] = useState('5');
  const [lue, setLue] = useState<SimulationLue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Une réponse d'un exercice ou d'un nombre périmé est jetée.
  const jeton = useRef(0);

  useEffect(() => {
    jeton.current += 1;
    setLue(null);
    setErreur(null);
  }, [exerciceId]);

  const simuler = async () => {
    if (!exerciceId) return;
    const mien = ++jeton.current;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.get<SimulationLue>(
        `/immobilisations/simulation-dotations?exerciceId=${encodeURIComponent(exerciceId)}&exercices=${encodeURIComponent(nombre.trim())}`,
      );
      if (mien === jeton.current) setLue(r);
    } catch (err) {
      if (mien === jeton.current) {
        setLue(null);
        setErreur(err instanceof ApiError ? err.message : 'Simulation impossible · serveur injoignable');
      }
    } finally {
      if (mien === jeton.current) setEnvoi(false);
    }
  };

  const cellule = (a: number | null, passee: boolean) =>
    a === null ? <span className="text-warning">non calculée</span> : <span className={passee ? 'italic' : ''}>{montant(a)}</span>;

  return (
    <div className="border border-border bg-surface shadow-posee max-w-[1180px] mt-3 text-[11.5px]" data-simulation-dotations>
      <div className="px-3.5 py-1.5 bg-chrome border-b border-border font-semibold text-text-dim flex items-center gap-1.5">
        Simulation des dotations
        <Aide
          titre="Simulation des dotations"
          texte="Le plan d'amortissement de chaque bien en service, exercice par exercice, calculé par le moteur même de la dotation · rien n'est écrit. Une dotation déjà passée est lue au journal (en italique). Au-delà des exercices ouverts, les années sont fictives, de douze mois. La simulation ne voit ni acquisition, ni sortie, ni dépréciation, ni révision à venir ; un bien aux unités d'œuvre sans relevé pour l'exercice est dit non calculé, jamais nul. Le dérogatoire du dégressif fiscal a son propre plan, sur la fiche du bien. Outil de prévision, ce n'est pas un état déposé."
          source="Sage 100 Immobilisations · simulation ; calcul du plan d'OmegaX"
        />
      </div>
      <div className="px-3.5 py-2 flex flex-wrap items-end gap-3">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Exercices simulés
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            inputMode="numeric"
            className="mt-1 block w-20 border border-border-dark px-2 py-1 text-[11.5px] tabular-nums"
          />
        </label>
        <button
          type="button"
          onClick={() => void simuler()}
          disabled={!exerciceId || envoi}
          className="bg-sel text-white rounded-[3px] px-3 py-[3px] text-[11.5px] font-semibold disabled:opacity-50"
        >
          {envoi ? '…' : 'Simuler'}
        </button>
        {!exerciceId && <span className="text-text-dim">Choisissez d'abord un exercice.</span>}
      </div>
      {erreur && <div className="px-3.5 pb-2 text-danger">{erreur}</div>}
      {lue && lue.biens.length === 0 && <div className="px-3.5 pb-2 text-text-dim">Aucun bien en service à simuler.</div>}
      {lue && lue.biens.length > 0 && (
        <div className="overflow-x-auto px-3.5 pb-2.5">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Bien</th>
                <th className="text-left">Compte</th>
                <th className="text-right">Cumul d'ouverture</th>
                {lue.periodes.map((p) => (
                  <th key={p.dateDebut} className="text-right" title={`${jour(p.dateDebut)} au ${jour(p.dateFin)}${p.fictive ? ' · année fictive' : ''}`}>
                    {libelleExercice(p)}
                    {p.fictive ? '*' : ''}
                  </th>
                ))}
                <th className="text-right">Valeur nette finale</th>
              </tr>
            </thead>
            <tbody>
              {lue.biens.map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.designation}
                    {b.numeroInventaire ? ` (${b.numeroInventaire})` : ''}
                    {b.pasEnService && <span className="block text-[11px] text-text-dim">pas encore mis en service</span>}
                    {b.nonAmortissable && <span className="block text-[11px] text-text-dim">non amorti</span>}
                  </td>
                  <td className="tabular-nums">{b.compte.numero}</td>
                  <td className="text-right tabular-nums">{montant(b.cumulAvant)}</td>
                  {b.annuites.map((a, k) => (
                    <td key={lue.periodes[k].dateDebut} className="text-right tabular-nums">
                      {cellule(a, b.passees[k])}
                    </td>
                  ))}
                  <td className="text-right tabular-nums">{b.valeurNetteFin === null ? <span className="text-warning">non calculée</span> : montant(b.valeurNetteFin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={3}>Total</td>
                {lue.totaux.map((t, k) => (
                  <td key={lue.periodes[k].dateDebut} className="text-right tabular-nums">
                    {montant(t.montant)}
                    {t.nonCalcules > 0 && <span className="block text-[11px] font-normal text-warning">hors {t.nonCalcules} non calculé(s)</span>}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
          {lue.periodes.some((p) => p.fictive) && <div className="mt-1 text-[11px] text-text-dim">* année fictive de douze mois</div>}
        </div>
      )}
    </div>
  );
}
