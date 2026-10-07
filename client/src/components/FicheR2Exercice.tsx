import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Aide } from './chrome/Aide';
import type { ControleEntreprise, Exercice } from '../lib/types';

/**
 * FICHE R2, cases ZN à ZS (AUDCIF Titre IX ch. 2 ; décision par la loi du
 * 2026-10-04, point 5) · faits DÉCLARÉS par exercice, SYSCOHADA seul (la
 * route se refuse au serveur hors SYSCOHADA). Une case vide s'enregistre
 * `null` et s'imprime « Non renseignée », jamais zéro.
 */
export function FicheR2Exercice({
  exercice,
  peutEcrire,
  apresEnregistrement,
}: {
  exercice: Exercice;
  peutEcrire: boolean;
  apresEnregistrement: () => Promise<void> | void;
}) {
  const [zn, setZn] = useState('');
  const [zo, setZo] = useState('');
  const [zp, setZp] = useState('');
  const [controle, setControle] = useState<'' | ControleEntreprise>('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Les champs suivent l'exercice sélectionné · sans cela, ceux du précédent
  // resteraient prêts à être enregistrés sur le mauvais exercice.
  useEffect(() => {
    const texte = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
    setZn(texte(exercice.nombreEtablissementsPays));
    setZo(texte(exercice.nombreEtablissementsHorsPays));
    setZp(texte(exercice.premiereAnneeExercicePays));
    setControle(exercice.controleEntreprise ?? '');
    setErreur(null);
    setInfo(null);
  }, [
    exercice.id,
    exercice.nombreEtablissementsPays,
    exercice.nombreEtablissementsHorsPays,
    exercice.premiereAnneeExercicePays,
    exercice.controleEntreprise,
  ]);

  const entier = (v: string): number | null => (v.trim() === '' ? null : Number(v));

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/${exercice.id}/fiche-r2`, {
        nombreEtablissementsPays: entier(zn),
        nombreEtablissementsHorsPays: entier(zo),
        premiereAnneeExercicePays: entier(zp),
        controleEntreprise: controle === '' ? null : controle,
      });
      await apresEnregistrement();
      setInfo('Fiche R2 enregistrée.');
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  const champ = 'mt-1 block border border-border-dark px-2 py-1 text-[11.5px]';
  return (
    <form onSubmit={enregistrer} className="mb-4 border border-border bg-surface px-4 py-3 max-w-[720px]">
      <div className="text-[11.5px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
        Renseignements divers de la liasse
        <Aide
          titre="Établissements et contrôle"
          texte="Cases ZN à ZS de la fiche R2 du Système normal. Chaque valeur est déclarée par le cabinet pour l’exercice, jamais déduite du dossier : le nombre de cellules d’un groupe n’est pas le nombre d’établissements, et le premier exercice tenu dans le logiciel n’est pas la première année d’activité. Seuls comptent, hors du pays, les établissements qui tiennent une comptabilité distincte. Le contrôle est une seule réponse ; l’imprimé emploie deux fois le code ZQ, transcrit tel quel. Une case vide s’imprime « Non renseignée »."
          source="AUDCIF Titre IX ch. 2, fiche R2"
        />
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Établissements dans le pays
          <input type="number" min={0} step={1} value={zn} disabled={!peutEcrire} onChange={(e) => setZn(e.target.value)} className={`${champ} w-24`} />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          Hors du pays, comptabilité distincte
          <input type="number" min={0} step={1} value={zo} disabled={!peutEcrire} onChange={(e) => setZo(e.target.value)} className={`${champ} w-24`} />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          Première année d’exercice dans le pays
          <input type="number" min={1000} max={9999} step={1} value={zp} disabled={!peutEcrire} onChange={(e) => setZp(e.target.value)} className={`${champ} w-24`} />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          Contrôle de l’entreprise
          <select value={controle} disabled={!peutEcrire} onChange={(e) => setControle(e.target.value as '' | ControleEntreprise)} className={champ}>
            <option value="">Non renseigné</option>
            <option value="PUBLIC">Contrôle public</option>
            <option value="PRIVE_NATIONAL">Contrôle privé national</option>
            <option value="PRIVE_ETRANGER">Contrôle privé étranger</option>
          </select>
        </label>
        {peutEcrire && (
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
