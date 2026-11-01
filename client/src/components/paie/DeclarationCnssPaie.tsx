import { useState } from 'react';
import { api } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { montant as fc } from '../../lib/montants';
import { Erreur, useLecture } from './SuiviPersonnelPaie';

/**
 * LIGNE PAIE-DECLARATIONS, POINT 1 · LA DÉCLARATION CNSS DU MOIS, PRÉPARÉE
 * DEPUIS LES BULLETINS ÉMIS (`personnel/declaration-cnss.ts`). Le serveur lit
 * les bulletins figés et rend les dix énonciations de l'arrêté n° 146/2018,
 * art. 23 · l'écran ne calcule rien. Ce n'est pas l'imprimé de la Caisse, et
 * le titre le dit.
 */
type Enonciation = { rang: number; libelle: string; valeur: string | number | null; manque: string | null };
type Branche = { cle: string; libelle: string; charge: string; article: string; montantFc: number | null };
type LigneBulletin = {
  numero: number;
  nature: 'MOIS' | 'DECOMPTE_FINAL';
  nomComplet: string;
  matricule: string | null;
  numeroImmatriculation: string | null;
  totalVerseFc: number;
  baseCnssFc: number | null;
  parBranche: Record<string, number>;
  enfantsBeneficiaires: number | null;
};
export type DeclarationCnssLue = {
  mois: string;
  reserve: string;
  aucunBulletin: string | null;
  enonciations: Enonciation[];
  branches: Branche[];
  totalCotisationsFc: number | null;
  bulletins: LigneBulletin[];
  manques: string[];
  echeance: { dateLimite: string; regularisationAvant: string; fondement: string };
  reserves: string[];
};

const champ = 'border border-border bg-transparent px-1.5 py-0.5';
const MONTANTS = new Set([5, 6, 7]);
const jour = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

/** Une valeur lue · un montant se met au format, l'absence se dit, jamais zéro. */
export function valeurEnonciation(e: Enonciation): string {
  if (e.valeur === null) return 'Non renseigné';
  if (typeof e.valeur === 'number' && MONTANTS.has(e.rang)) return fc(e.valeur);
  return String(e.valeur);
}

function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function OngletDeclarationCnss() {
  const [mois, setMois] = useState(moisCourant);
  const valide = /^\d{4}-(0[1-9]|1[0-2])$/.test(mois);
  const { donnees, erreur } = useLecture(valide ? () => api.get<DeclarationCnssLue>(`/personnel/declaration-cnss/${mois}`) : null, `cnss-${mois}`);
  // L'échec d'un export se dit, jamais dans le vide (exports-signales.spec.ts).
  const [avisExport, setAvisExport] = useState<string | null>(null);
  return (
    <div className="max-w-[1240px] text-[11.5px] space-y-3">
      <div className="ecran-seul flex flex-wrap gap-1.5 items-center">
        <input aria-label="Mois de la déclaration" type="month" value={mois} onChange={(e) => setMois(e.target.value)} className={champ} />
        <button
          type="button"
          className="border border-border px-2.5 py-1"
          disabled={!valide || !donnees || !!donnees.aucunBulletin}
          onClick={() => void api.telechargerOuSignaler(`/personnel/declaration-cnss/${mois}/excel`, `declaration-cnss-${mois}.xlsx`, setAvisExport)}
        >
          Exporter en Excel
        </button>
        <Aide
          titre="Déclaration CNSS préparée"
          texte={
            donnees?.reserve ??
            "Les énonciations du formulaire de déclaration des cotisations, tirées des bulletins émis du mois. Ce n'est pas l'imprimé de la Caisse : recopiez-les sur l'imprimé déposé."
          }
          source="Arrêté n° 146/2018, art. 21 à 28 · décret n° 18/041, art. 2 à 4"
        />
        <Aide
          titre="Point 5 · sommes payées"
          texte="Le point 5 porte toutes les sommes payées aux travailleurs, et non la seule rémunération · le point 6 est la rémunération prise en considération pour les cotisations, qui exclut soins de santé, logement, allocations familiales légales, transport, frais de voyage et avantages accordés pour faciliter les fonctions. Le point 5 comprend donc ces sommes, remboursements de frais de mission compris (le total versé de chaque bulletin)."
          source="Arrêté n° 146/2018, art. 17, point 1, et 23 · Code du travail, art. 7, point 8"
        />
      </div>
      <Erreur m={erreur} />
      <Erreur m={avisExport ?? ''} />
      {valide && donnees === null && !erreur && <div className="text-text-dim">Lecture des bulletins…</div>}
      {donnees?.aucunBulletin && <div className="border border-border bg-surface-alt px-3 py-1.5">{donnees.aucunBulletin}</div>}
      {donnees && !donnees.aucunBulletin && (
        <>
          <div className="font-semibold">Déclaration des cotisations sociales de {donnees.mois} · état de préparation, pas l’imprimé de la Caisse</div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1 w-[44px]">Point</th>
                <th className="text-left px-2 py-1">Énonciation</th>
                <th className="text-right px-2 py-1 w-[180px]">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {donnees.enonciations.map((e) => (
                <tr key={e.rang}>
                  <td className="px-2 py-1">{e.rang}</td>
                  <td className="px-2 py-1">
                    {e.libelle}
                    {e.manque && <span className="block text-[11px] text-warning">{e.manque}</span>}
                  </td>
                  <td className={`px-2 py-1 text-right ${e.valeur === null ? 'text-text-dim' : ''}`}>{valeurEnonciation(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Cotisation par branche</th>
                <th className="text-left px-2 py-1">À la charge de</th>
                <th className="text-right px-2 py-1 w-[180px]">Montant</th>
              </tr>
            </thead>
            <tbody>
              {donnees.branches.map((b) => (
                <tr key={b.cle}>
                  <td className="px-2 py-1" title={b.article}>
                    {b.libelle}
                  </td>
                  <td className="px-2 py-1">{b.charge === 'TRAVAILLEUR' ? 'Travailleur' : 'Employeur'}</td>
                  <td className="px-2 py-1 text-right">{b.montantFc === null ? 'Non chiffré' : fc(b.montantFc)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-2 py-1" colSpan={2}>
                  Total des cotisations dues
                </td>
                <td className="px-2 py-1 text-right">{donnees.totalCotisationsFc === null ? 'Non chiffré' : fc(donnees.totalCotisationsFc)}</td>
              </tr>
            </tbody>
          </table>
          <div title={donnees.echeance.fondement}>
            Date limite de dépôt et de versement · <strong>{jour(donnees.echeance.dateLimite)}</strong> (régularisation au plus tard le{' '}
            {jour(donnees.echeance.regularisationAvant)})
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Bulletin</th>
                <th className="text-left px-2 py-1">Travailleur</th>
                <th className="text-left px-2 py-1">N° d’immatriculation</th>
                <th className="text-right px-2 py-1">Total versé</th>
                <th className="text-right px-2 py-1">Base de la CNSS</th>
                <th className="text-right px-2 py-1">Pensions, travailleur</th>
              </tr>
            </thead>
            <tbody>
              {donnees.bulletins.map((b) => (
                <tr key={b.numero}>
                  <td className="px-2 py-1">
                    n° {b.numero}
                    {b.nature === 'DECOMPTE_FINAL' ? ' · décompte final' : ''}
                  </td>
                  <td className="px-2 py-1">{b.nomComplet}</td>
                  <td className={`px-2 py-1 ${b.numeroImmatriculation ? '' : 'text-warning'}`}>{b.numeroImmatriculation ?? 'Non renseigné'}</td>
                  <td className="px-2 py-1 text-right">{fc(b.totalVerseFc)}</td>
                  <td className="px-2 py-1 text-right">{b.baseCnssFc === null ? 'Non lue' : fc(b.baseCnssFc)}</td>
                  <td className="px-2 py-1 text-right">{fc(b.parBranche['cnss-pension-travailleur'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {donnees.manques.length > 0 && (
            <ul role="status" className="border border-warning/30 bg-warning-soft text-warning px-3.5 py-2 list-disc pl-7">
              {donnees.manques.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <div className="ecran-seul flex items-center gap-1.5 text-text-dim">
            Réserves
            <Aide titre="Réserves de la déclaration" texte={donnees.reserves.join(' ')} source="Arrêté n° 146/2018, art. 22, 24, 27 et 28" />
          </div>
        </>
      )}
    </div>
  );
}
