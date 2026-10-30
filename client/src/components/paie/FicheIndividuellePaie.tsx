import { useState } from 'react';
import { api } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { montant as fc } from '../../lib/montants';
import { Erreur, useLecture } from './SuiviPersonnelPaie';

/**
 * LIGNE PAIE-SUITE, FONCTION 89 · LA FICHE INDIVIDUELLE ET LES CUMULS ANNUELS
 * PAR RUBRIQUE d'un salarié · ce que ses bulletins émis de l'année ont figé,
 * lu au serveur (`personnel/fiche-individuelle.ts`) · rien n'est additionné
 * ici, et l'export Excel est le même calcul.
 */
type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };
const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const champ = 'border border-border bg-transparent px-1.5 py-0.5';

type Totaux = { brut: number; assietteSociale: number; cotisationsTravailleur: number; cotisationsEmployeur: number; irpp: number; retenuesAvances: number; net: number };
type Fiche = {
  annee: number;
  salarie: { nom: string; matricule: string | null };
  mois: { mois: string; bulletins: { numero: number; nature: string }[]; totaux: Totaux }[];
  cumul: Totaux;
  rubriques: { cle: string; code: string | null; libelle: string; nature: string; parMois: Record<string, number>; total: number }[];
  annules: { numero: number; moisDePaie: string }[];
  illisibles: number[];
  reserve: string;
};

const COLONNES: { cle: keyof Totaux; titre: string }[] = [
  { cle: 'brut', titre: 'Total versé' },
  { cle: 'assietteSociale', titre: 'Assiette sociale' },
  { cle: 'cotisationsTravailleur', titre: 'Cotisations travailleur' },
  { cle: 'cotisationsEmployeur', titre: 'Cotisations employeur' },
  { cle: 'irpp', titre: 'Retenue IRPP' },
  { cle: 'retenuesAvances', titre: "Retenues d'avance" },
  { cle: 'net', titre: 'Net à payer' },
];

export function OngletFicheIndividuelle({ salaries }: { salaries: SalarieMin[] }) {
  const [salarieId, setSalarieId] = useState(salaries.length === 1 ? salaries[0].id : '');
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const valide = !!salarieId && /^\d{4}$/.test(annee);
  const { donnees, erreur } = useLecture(
    valide ? () => api.get<Fiche>(`/personnel/salaries/${salarieId}/fiche-individuelle?annee=${annee}`) : null,
    `fiche-${salarieId}-${annee}`,
  );
  // L'échec d'un export se dit, jamais dans le vide (exports-signales.spec.ts).
  const [avisExport, setAvisExport] = useState<string | null>(null);
  const mois = Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, '0')}`);
  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        <select aria-label="Salarié" value={salarieId} onChange={(e) => setSalarieId(e.target.value)} className={champ}>
          <option value="">Salarié…</option>
          {salaries.map((s) => (
            <option key={s.id} value={s.id}>
              {nomDe(s)}
            </option>
          ))}
        </select>
        <input aria-label="Année" value={annee} onChange={(e) => setAnnee(e.target.value)} className={`${champ} w-[70px]`} />
        <button
          type="button"
          className="border border-border px-2.5 py-1"
          disabled={!valide}
          onClick={() =>
            void api.telechargerOuSignaler(`/personnel/salaries/${salarieId}/fiche-individuelle/excel?annee=${annee}`, `fiche-individuelle-${annee}.xlsx`, setAvisExport)
          }
        >
          Exporter en Excel
        </button>
        <Aide
          titre="Fiche individuelle"
          texte={donnees?.reserve ?? "Ce que les bulletins émis de l'année ont figé, mois par mois, et le cumul de chaque élément par rubrique du cabinet, ou par nature sans rubrique."}
          source="Code du travail, art. 213 · loi n° 23/053, art. 116 et 121"
        />
      </div>
      <Erreur m={erreur} />
      <Erreur m={avisExport ?? ''} />
      {valide && donnees === null && !erreur && <div className="text-text-dim">Lecture des bulletins…</div>}
      {donnees && donnees.mois.length === 0 && <div className="text-text-dim">Aucun bulletin émis en {donnees.annee} pour ce salarié.</div>}
      {donnees && donnees.mois.length > 0 && (
        <>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Mois</th>
                <th className="text-left px-2 py-1">Bulletins</th>
                {COLONNES.map((c) => (
                  <th key={c.cle} className="text-right px-2 py-1">
                    {c.titre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donnees.mois.map((m) => (
                <tr key={m.mois}>
                  <td className="px-2 py-1">{m.mois}</td>
                  <td className="px-2 py-1">{m.bulletins.map((b) => `n° ${b.numero}`).join(', ')}</td>
                  {COLONNES.map((c) => (
                    <td key={c.cle} className="px-2 py-1 text-right">
                      {fc(m.totaux[c.cle])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-2 py-1" colSpan={2}>
                  Total de l&apos;année
                </td>
                {COLONNES.map((c) => (
                  <td key={c.cle} className="px-2 py-1 text-right">
                    {fc(donnees.cumul[c.cle])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {donnees.annules.length > 0 && (
            <div className="text-text-dim">Bulletins annulés, hors cumul · {donnees.annules.map((a) => `n° ${a.numero} (${a.moisDePaie})`).join(', ')}</div>
          )}
          <div className="font-semibold">Cumuls par rubrique</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Rubrique</th>
                  {mois.map((m) => (
                    <th key={m} className="text-right px-1.5 py-1">
                      {m.slice(5)}
                    </th>
                  ))}
                  <th className="text-right px-2 py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {donnees.rubriques.map((r) => (
                  <tr key={r.cle}>
                    <td className="px-2 py-1">{r.code ? `${r.code} · ${r.libelle}` : r.libelle}</td>
                    {mois.map((m) => (
                      <td key={m} className="px-1.5 py-1 text-right">
                        {r.parMois[m] ? fc(r.parMois[m]) : ''}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-semibold">{fc(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {donnees.illisibles.length > 0 && (
            <div className="text-warning">
              Bulletins dont les éléments ne se relisent pas, hors des rubriques (leurs totaux restent à la fiche) · n° {donnees.illisibles.join(', ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
