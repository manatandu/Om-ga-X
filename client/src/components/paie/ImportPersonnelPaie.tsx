import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { Erreur } from './SuiviPersonnelPaie';

/**
 * LIGNE PAIE-SUITE, FONCTION 82 · L'IMPORT DU PERSONNEL DEPUIS EXCEL · le
 * fichier est jugé au serveur par les règles de la saisie
 * (`personnel/import-personnel.ts`) · la simulation dit chaque ligne et ses
 * refus, l'import rejoue la simulation et n'écrit que tout ou rien.
 */
type Simulation = {
  lignes: { rang: number; nom: string; matricule: string | null; avecContrat: boolean; refus: string[] }[];
  colonnesIgnorees: string[];
  total: number;
  refusees: number;
  aImporter: number;
};

export function OngletImportPersonnel({ peutEcrire, onImporte }: { peutEcrire: boolean; onImporte: () => void }) {
  const [fichier, setFichier] = useState<{ nomFichier: string; contenuBase64: string } | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [erreur, setErreur] = useState('');
  const [avisModele, setAvisModele] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState<string | null>(null);

  const choisir = async (f: File) => {
    setErreur('');
    setSimulation(null);
    setFait(null);
    const octets = new Uint8Array(await f.arrayBuffer());
    let binaire = '';
    for (let i = 0; i < octets.length; i += 8192) binaire += String.fromCharCode(...octets.subarray(i, i + 8192));
    setFichier({ nomFichier: f.name, contenuBase64: btoa(binaire) });
  };

  const geste = async (fn: () => Promise<void>) => {
    setErreur('');
    setEnvoi(true);
    try {
      await fn();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Opération refusée');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          type="button"
          className="border border-border px-2.5 py-1"
          onClick={() => void api.telechargerOuSignaler('/personnel/import/modele', 'modele-import-personnel.xlsx', setAvisModele)}
        >
          Télécharger le modèle
        </button>
        {peutEcrire && (
          <input
            aria-label="Fichier du personnel"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void choisir(f);
            }}
          />
        )}
        {peutEcrire && (
          <button
            type="button"
            className="border border-border px-2.5 py-1"
            disabled={!fichier || envoi}
            onClick={() => void geste(async () => setSimulation(await api.post<Simulation>('/personnel/import/simulation', fichier)))}
          >
            Simuler
          </button>
        )}
        {peutEcrire && simulation && simulation.refusees === 0 && simulation.total > 0 && (
          <button
            type="button"
            className="bg-sel text-white font-semibold px-3 py-1"
            disabled={envoi}
            onClick={() =>
              void geste(async () => {
                const r = await api.post<{ salaries: number; contrats: number }>('/personnel/import', fichier);
                setFait(`${r.salaries} fiche(s) et ${r.contrats} contrat(s) importés.`);
                setSimulation(null);
                setFichier(null);
                onImporte();
              })
            }
          >
            Importer {simulation.total} salarié(s)
          </button>
        )}
        <Aide
          titre="Import du personnel"
          texte="Partez du modèle · une ligne par salarié, et, si vous le voulez, son premier contrat (type et date d'entrée en vigueur ensemble). Chaque ligne est jugée par les règles de la saisie du registre · un montant sans sa monnaie, un matricule déjà pris, une date qui n'existe pas sont refusés. La simulation n'écrit rien ; l'import rejoue la simulation et n'écrit que si aucune ligne n'est refusée. Une colonne inconnue est nommée et ignorée. Écrivez 500 000 ou 500000,00 · le point ne sépare pas les milliers."
          source="Code du travail, art. 212 · règles du registre du personnel"
        />
      </div>
      <Erreur m={erreur} />
      <Erreur m={avisModele ?? ''} />
      {fait && <div className="border border-ok/30 bg-ok-soft px-3 py-2">{fait}</div>}
      {simulation && (
        <>
          <div className={simulation.refusees ? 'text-warning' : 'text-text-dim'}>
            {simulation.total} ligne(s) lue(s) · {simulation.aImporter} sans refus, {simulation.refusees} refusée(s)
            {simulation.refusees ? ' · rien ne sera importé tant qu’une ligne est refusée.' : '.'}
            {simulation.colonnesIgnorees.length > 0 && ` Colonnes ignorées · ${simulation.colonnesIgnorees.join(', ')}.`}
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1 w-[60px]">Ligne</th>
                <th className="text-left px-2 py-1">Salarié</th>
                <th className="text-left px-2 py-1">Contrat</th>
                <th className="text-left px-2 py-1">Refus</th>
              </tr>
            </thead>
            <tbody>
              {simulation.lignes.map((l) => (
                <tr key={l.rang} className={l.refus.length ? 'text-danger' : undefined}>
                  <td className="px-2 py-1">{l.rang}</td>
                  <td className="px-2 py-1">
                    {l.nom}
                    {l.matricule ? ` · ${l.matricule}` : ''}
                  </td>
                  <td className="px-2 py-1">{l.avecContrat ? 'oui' : 'non'}</td>
                  <td className="px-2 py-1">{l.refus.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
