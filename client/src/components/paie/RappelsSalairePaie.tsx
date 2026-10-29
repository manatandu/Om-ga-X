import { useState } from 'react';
import { api } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { montant as fc } from '../../lib/montants';
import { libelleListeBornee } from '../../lib/liste-bornee-personnel';
import { lireNombre } from '../../lib/conditions-bancaires-saisie';
import { Erreur, useEnvoi, useLecture } from './SuiviPersonnelPaie';

/**
 * LIGNE PAIE-SUITE, FONCTION 87 · LES RAPPELS DE SALAIRE · une hausse de la
 * base à effet passé, calculée au serveur mois par mois sur les bulletins émis
 * (`personnel/rappel-salaire.ts`) · le rappel déclaré se paie ensuite par le
 * bulletin d'un mois postérieur, coché dans la simulation. Aucun arriéré
 * n'est saisi ici.
 */
type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };
const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const champ = 'border border-border bg-transparent px-1.5 py-0.5';

type Ligne = { mois: string; numero: number; salaireFigeFc: number; ancienneBase: number; arriereFc: number };
type Calcul = { lignes: Ligne[]; exclus: { mois: string; motif: string }[]; totalFc: number; reserve: string };
type Rappel = {
  id: string;
  salarie: string;
  moisDebut: string;
  moisFin: string;
  nouvelleBase: number;
  periodicite: string;
  deviseBase: string;
  motif: string;
  pieceJustificative: string;
  lignes: Ligne[];
  exclus: { mois: string; motif: string }[];
  totalFc: number;
  payePar: { numero: number; moisDePaie: string } | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
};

export function OngletRappelsSalaire({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  const { donnees, erreur, setErreur, relire } = useLecture(
    () => api.get<{ rappels: Rappel[]; total: number; tronque: boolean; reserve: string }>('/personnel/rappels'),
    'rappels',
  );
  const { envoi, envoyer } = useEnvoi(relire, setErreur);
  const [f, setF] = useState({ salarieId: '', moisDebut: '', moisFin: '', nouvelleBase: '', periodicite: 'MOIS', deviseBase: 'CDF', motif: '', pieceJustificative: '' });
  const [calcul, setCalcul] = useState<Calcul | null>(null);
  const [motifs, setMotifs] = useState<Record<string, string>>({});

  const corps = (): Record<string, unknown> | null => {
    const lu = lireNombre(f.nouvelleBase, 'montant');
    if (!('valeur' in lu)) {
      setErreur('Nouvelle base illisible · écrivez 560 000 ou 560000,00 (le point ne sépare pas les milliers).');
      return null;
    }
    return { moisDebut: f.moisDebut, moisFin: f.moisFin, nouvelleBase: lu.valeur, periodicite: f.periodicite, deviseBase: f.deviseBase, motif: f.motif, pieceJustificative: f.pieceJustificative };
  };

  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-4">
      <Erreur m={erreur} />
      <section>
        <div className="font-semibold mb-1 flex items-center gap-1.5">
          Rappels de salaire
          <Aide
            titre="Rappel de salaire"
            texte={`${donnees?.reserve ?? ''} L'arriéré d'un mois est le salaire figé sur son bulletin multiplié par l'écart relatif de la base · un mois payé en entier rend la différence des bases. Une baisse n'est pas rappelée. Le rappel déclaré se paie en le cochant dans la simulation d'un bulletin postérieur à ses mois ; annuler ce bulletin le libère.`}
            source="Code du travail, art. 112 et 213 · arrêté du 8 août 2008, mention 13"
          />
        </div>
        {donnees === null && !erreur && <div className="text-text-dim">Lecture des rappels…</div>}
        {donnees && libelleListeBornee(donnees, donnees.rappels.length, 'rappels') && (
          <div className="text-warning">{libelleListeBornee(donnees, donnees.rappels.length, 'rappels')}</div>
        )}
        {donnees && donnees.rappels.length === 0 && <div className="text-text-dim">Aucun rappel.</div>}
        {donnees && donnees.rappels.length > 0 && (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Salarié</th>
                <th className="text-left px-2 py-1">Mois</th>
                <th className="text-left px-2 py-1">Motif et pièce</th>
                <th className="text-right px-2 py-1">Arriérés</th>
                <th className="text-left px-2 py-1">État</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {donnees.rappels.map((r) => (
                <tr key={r.id} className={r.annuleLe ? 'text-text-dim' : undefined}>
                  <td className="px-2 py-1">{r.salarie}</td>
                  <td className="px-2 py-1">
                    {r.moisDebut} à {r.moisFin}
                    <div className="text-[11px] text-text-dim">{r.lignes.map((l) => `${l.mois} ${fc(l.arriereFc)}`).join(' · ')}</div>
                    {r.exclus.length > 0 && <div className="text-[11px] text-warning">{r.exclus.map((e) => `${e.mois} · ${e.motif}`).join(' ; ')}</div>}
                  </td>
                  <td className="px-2 py-1">
                    {r.motif} <span className="text-text-dim">· {r.pieceJustificative}</span>
                  </td>
                  <td className="px-2 py-1 text-right font-semibold">{fc(r.totalFc)}</td>
                  <td className="px-2 py-1">
                    {r.annuleLe ? `Annulé · ${r.motifAnnulation ?? ''}` : r.payePar ? `Payé par le bulletin n° ${r.payePar.numero} (${r.payePar.moisDePaie})` : 'À payer'}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {peutEcrire && !r.annuleLe && !r.payePar && (
                      <span className="inline-flex gap-1 items-center">
                        <input aria-label="Motif de l'annulation" placeholder="Motif" value={motifs[r.id] ?? ''} onChange={(e) => setMotifs({ ...motifs, [r.id]: e.target.value })} className={`${champ} w-[140px]`} />
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          disabled={envoi || (motifs[r.id] ?? '').trim().length < 3}
                          onClick={() => void envoyer(() => api.post(`/personnel/rappels/${r.id}/annulation`, { motif: motifs[r.id] }))}
                        >
                          Annuler
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {peutEcrire && (
        <section>
          <div className="font-semibold mb-1">Déclarer un rappel</div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <select aria-label="Salarié" value={f.salarieId} onChange={(e) => (setF({ ...f, salarieId: e.target.value }), setCalcul(null))} className={champ}>
              <option value="">Salarié…</option>
              {salaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {nomDe(s)}
                </option>
              ))}
            </select>
            <input aria-label="Premier mois rappelé" type="month" value={f.moisDebut} onChange={(e) => (setF({ ...f, moisDebut: e.target.value }), setCalcul(null))} className={champ} />
            <input aria-label="Dernier mois rappelé" type="month" value={f.moisFin} onChange={(e) => (setF({ ...f, moisFin: e.target.value }), setCalcul(null))} className={champ} />
            <input aria-label="Nouvelle base" placeholder="Nouvelle base" value={f.nouvelleBase} onChange={(e) => (setF({ ...f, nouvelleBase: e.target.value }), setCalcul(null))} className={`${champ} w-[110px] text-right`} />
            <select aria-label="Périodicité de la base" value={f.periodicite} onChange={(e) => (setF({ ...f, periodicite: e.target.value }), setCalcul(null))} className={champ}>
              <option value="MOIS">par mois</option>
              <option value="SEMAINE">par semaine</option>
              <option value="JOUR">par jour</option>
              <option value="ANNEE">par an</option>
            </select>
            <select aria-label="Monnaie de la base" value={f.deviseBase} onChange={(e) => (setF({ ...f, deviseBase: e.target.value }), setCalcul(null))} className={champ}>
              <option value="CDF">CDF</option>
              <option value="USD">USD</option>
            </select>
            <input aria-label="Motif du rappel" placeholder="Motif (avenant, décision…)" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} className={`${champ} w-[180px]`} />
            <input aria-label="Pièce justificative" placeholder="Pièce justificative" value={f.pieceJustificative} onChange={(e) => setF({ ...f, pieceJustificative: e.target.value })} className={`${champ} w-[180px]`} />
            <button
              type="button"
              className="border border-border px-2.5 py-1"
              disabled={envoi || !f.salarieId}
              onClick={() => {
                const c = corps();
                if (c) void envoyer(async () => setCalcul(await api.post<Calcul>(`/personnel/salaries/${f.salarieId}/rappels/simulation`, c)));
              }}
            >
              Calculer
            </button>
            {calcul && calcul.lignes.length > 0 && (
              <button
                type="button"
                className="bg-sel text-white font-semibold px-3 py-1"
                disabled={envoi}
                onClick={() => {
                  const c = corps();
                  if (c)
                    void envoyer(async () => {
                      await api.post(`/personnel/salaries/${f.salarieId}/rappels`, c);
                      setCalcul(null);
                    });
                }}
              >
                Déclarer le rappel ({fc(calcul.totalFc)})
              </button>
            )}
          </div>
          {calcul && (
            <table className="w-full mt-2">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Mois</th>
                  <th className="text-left px-2 py-1">Bulletin</th>
                  <th className="text-right px-2 py-1">Salaire figé</th>
                  <th className="text-right px-2 py-1">Base figée</th>
                  <th className="text-right px-2 py-1">Arriéré</th>
                </tr>
              </thead>
              <tbody>
                {calcul.lignes.map((l) => (
                  <tr key={l.mois}>
                    <td className="px-2 py-1">{l.mois}</td>
                    <td className="px-2 py-1">n° {l.numero}</td>
                    <td className="px-2 py-1 text-right">{fc(l.salaireFigeFc)}</td>
                    <td className="px-2 py-1 text-right">{fc(l.ancienneBase)}</td>
                    <td className="px-2 py-1 text-right font-semibold">{fc(l.arriereFc)}</td>
                  </tr>
                ))}
                {calcul.exclus.map((e) => (
                  <tr key={e.mois} className="text-warning">
                    <td className="px-2 py-1">{e.mois}</td>
                    <td className="px-2 py-1" colSpan={4}>
                      Exclu · {e.motif}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
