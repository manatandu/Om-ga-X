import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { entierSaisi, LIBELLES_REGIME, type ParametresPaie, type RegimeSalarialDeclare } from '../../lib/paie-en-lot';

/**
 * LIGNE PAIE-LOT · LES PARAMÈTRES DE PAIE DU DOSSIER, déclarés une fois.
 * Chaque champ vide est « pas encore dit » · rien ne se présume, et le calcul
 * s'abstient ou le dit comme quand la simulation ne reçoit pas le champ.
 */
export function OngletParametresPaie({ peutEcrire }: { peutEcrire: boolean }) {
  const [lus, setLus] = useState<ParametresPaie | null>(null);
  const [nature, setNature] = useState('');
  const [regime, setRegime] = useState('');
  const [effectif, setEffectif] = useState('');
  const [jours, setJours] = useState('');
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [enCours, setEnCours] = useState(false);

  const poser = (p: ParametresPaie) => {
    setLus(p);
    setNature(p.natureEmployeurInpp ?? '');
    setRegime(p.regimeSalarial ?? '');
    setEffectif(p.effectifInpp === null ? '' : String(p.effectifInpp));
    setJours(p.joursPayes === null ? '' : String(p.joursPayes));
  };

  useEffect(() => {
    api.get<ParametresPaie>('/personnel/parametres-paie').then(poser, (e: ApiError) => setErreur(e.message));
  }, []);

  const enregistrer = () => {
    setErreur('');
    setSucces('');
    const e = entierSaisi(effectif);
    const j = entierSaisi(jours);
    if (e === undefined) return setErreur('Effectif illisible · un nombre entier de travailleurs.');
    if (j === undefined || (j !== null && (j < 1 || j > 26))) return setErreur('Jours payés illisibles · un nombre entier de 1 à 26.');
    setEnCours(true);
    api
      .put<ParametresPaie>('/personnel/parametres-paie', {
        natureEmployeurInpp: nature === '' ? null : nature,
        regimeSalarial: regime === '' ? null : regime,
        effectifInpp: e,
        joursPayes: j,
      })
      .then(
        (p) => {
          poser(p);
          setSucces('Paramètres de paie enregistrés.');
          setEnCours(false);
        },
        (x: ApiError) => {
          setErreur(x.message);
          setEnCours(false);
        },
      );
  };

  const champ = 'border border-border px-2 py-1';
  return (
    <div className="max-w-[760px] text-[11.5px] border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2 font-semibold">
        Paramètres de paie du dossier
        <Aide
          titre="Paramètres de paie"
          texte="Déclarés une fois, ils préremplissent la simulation et la paie du mois en lot ; un champ vide reste « pas encore dit » et le calcul le signale (cotisation INPP non chiffrée, barème de droit commun retenu en le disant). La nature de l’employeur fixe le taux INPP, puis, pour le privé seulement, la tranche d’effectif. Les jours payés ne servent qu’au plancher de la CNSS d’un mois incomplet ; vide, le mois est entier. Le bulletin fige ce qu’il a lu · changer un paramètre ne touche aucun bulletin émis."
          source="Arrêté interministériel n° 002/CAB/MET/2025, art. 1er · loi n° 23/053, art. 118 et 121 · décret n° 18/041, art. 8 · décret n° 25/22, art. 7"
        />
      </div>
      {erreur && <div className="border border-danger/30 bg-danger-soft px-3 py-1.5 mb-2">{erreur}</div>}
      {succes && <div className="border border-ok/30 bg-ok-soft px-3 py-1.5 mb-2">{succes}</div>}
      {lus === null && !erreur && <div className="text-text-dim">Lecture…</div>}
      {lus !== null && (
        <fieldset disabled={!peutEcrire || enCours} className="grid gap-2 sm:grid-cols-2 min-w-0">
          <label className="flex flex-col gap-1">
            Nature de l’employeur (INPP)
            <select value={nature} onChange={(e) => setNature(e.target.value)} className={champ}>
              <option value="">Pas encore dit</option>
              <option value="PUBLIC">Public</option>
              <option value="PRIVE">Privé</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Effectif de la tranche INPP
            <input inputMode="numeric" value={effectif} onChange={(e) => setEffectif(e.target.value)} placeholder="Pas encore dit" className={champ} />
          </label>
          <label className="flex flex-col gap-1">
            Régime de la retenue IRPP
            <select value={regime} onChange={(e) => setRegime(e.target.value)} className={champ}>
              <option value="">Pas encore dit</option>
              {(Object.keys(LIBELLES_REGIME) as RegimeSalarialDeclare[]).map((r) => (
                <option key={r} value={r}>
                  {LIBELLES_REGIME[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Jours payés du mois
            <input inputMode="numeric" value={jours} onChange={(e) => setJours(e.target.value)} placeholder="Mois entier" className={champ} />
          </label>
          {peutEcrire && (
            <div className="sm:col-span-2">
              <button type="button" onClick={enregistrer} className="bg-sel text-white px-4 py-1.5 rounded-full disabled:opacity-50">
                Enregistrer
              </button>
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
