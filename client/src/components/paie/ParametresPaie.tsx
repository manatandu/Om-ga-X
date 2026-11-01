import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { entierSaisi, LIBELLES_REGIME, type ParametresPaie, type RegimeSalarialDeclare } from '../../lib/paie-en-lot';

/**
 * LIGNE PAIE-LOT · LES PARAMÈTRES DE PAIE DU DOSSIER, déclarés une fois.
 * Chaque champ vide est « pas encore dit » · rien ne se présume, et le calcul
 * s'abstient ou le dit comme quand la simulation ne reçoit pas le champ.
 * Nature et effectif INPP portent leur mois d'effet · ils ne se reprennent
 * jamais pour un mois antérieur.
 */
export function OngletParametresPaie({ peutEcrire }: { peutEcrire: boolean }) {
  const [lus, setLus] = useState<ParametresPaie | null>(null);
  const [nature, setNature] = useState('');
  const [effectif, setEffectif] = useState('');
  const [depuis, setDepuis] = useState('');
  const [regime, setRegime] = useState('');
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [enCours, setEnCours] = useState(false);

  const poser = (p: ParametresPaie) => {
    setLus(p);
    setNature(p.natureEmployeurInpp ?? '');
    setEffectif(p.effectifInpp === null ? '' : String(p.effectifInpp));
    setDepuis(p.inppDepuisMois ?? '');
    setRegime(p.regimeSalarial ?? '');
  };

  useEffect(() => {
    api.get<ParametresPaie>('/personnel/parametres-paie').then(poser, (e: ApiError) => setErreur(e.message));
  }, []);

  const enregistrer = () => {
    setErreur('');
    setSucces('');
    const e = entierSaisi(effectif);
    if (e === undefined) return setErreur('Effectif illisible · un nombre entier de travailleurs.');
    const inppDit = nature !== '' || e !== null;
    if (inppDit && !/^\d{4}-(0[1-9]|1[0-2])$/.test(depuis)) return setErreur('La nature et l’effectif INPP se déclarent avec leur mois d’effet.');
    setEnCours(true);
    api
      .put<ParametresPaie>('/personnel/parametres-paie', {
        natureEmployeurInpp: nature === '' ? null : nature,
        effectifInpp: e,
        inppDepuisMois: inppDit ? depuis : null,
        regimeSalarial: regime === '' ? null : regime,
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
          texte="Déclarés une fois, ils préremplissent la simulation et la paie du mois en lot ; un champ vide reste « pas encore dit » et le calcul le signale (cotisation INPP non chiffrée, barème de droit commun retenu en le disant). La nature de l’employeur fixe le taux INPP, puis, pour le privé seulement, la tranche d’effectif · tous deux valent à partir du mois d’effet déclaré, jamais pour un mois antérieur. Le régime déclaré ici est celui que l’employeur porte (barème, ou salariés d’une micro-entreprise) ; le personnel domestique se déclare dans la simulation du salarié. Les jours payés sont ceux de chaque salarié, lus sur ses absences et ses congés du mois. Le bulletin fige ce qu’il a lu · changer un paramètre ne touche aucun bulletin émis."
          source="Arrêté interministériel n° 002/CAB/MET/2025, art. 1er · loi n° 23/053, art. 118 et 121"
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
            À partir du mois de paie
            <input type="month" value={depuis} onChange={(e) => setDepuis(e.target.value)} className={champ} />
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
