import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from './chrome/Aide';
import type { ControleEntreprise, Exercice } from '../lib/types';

/**
 * FICHE R2, cases ZN à ZS (AUDCIF Titre IX ch. 2 ; décision par la loi du
 * 2026-10-04, point 5) · faits DÉCLARÉS par exercice, SYSCOHADA seul (la
 * route se refuse au serveur hors SYSCOHADA). Une case vide s'enregistre
 * `null` et s'imprime « Non renseignée », jamais zéro.
 *
 * Relecture 1 · la liasse du Système minimal de trésorerie ne porte pas de
 * fiche R2 · l'écran ne la montre pas et le serveur la refuse. Mêmes rôles
 * que l'arrêté des comptes (administrateur du dossier) · les autres lisent.
 */
export function FicheR2Exercice({
  exercice,
  apresEnregistrement,
}: {
  exercice: Exercice;
  apresEnregistrement: () => Promise<void> | void;
}) {
  // Le droit se LIT dans le contexte de session · la route est réservée à
  // l'administrateur du dossier, comme l'arrêté des comptes.
  const { estAdmin: peutDeclarer } = useAuth();
  const [zn, setZn] = useState('');
  const [zo, setZo] = useState('');
  const [zp, setZp] = useState('');
  const [controle, setControle] = useState<'' | ControleEntreprise>('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Une réponse d'un exercice quitté, ou d'un envoi dépassé par un autre, ne
  // s'affiche pas · le numéro d'envoi change à chaque envoi et à chaque
  // changement d'exercice.
  const envoiCourant = useRef(0);

  // Changer d'exercice efface les messages et périme l'envoi en cours.
  useEffect(() => {
    envoiCourant.current += 1;
    setErreur(null);
    setInfo(null);
    setEnvoi(false);
  }, [exercice.id]);

  // Les champs suivent l'exercice sélectionné · sans cela, ceux du précédent
  // resteraient prêts à être enregistrés sur le mauvais exercice. Relus après
  // un enregistrement, ils n'effacent pas le message qui le confirme.
  useEffect(() => {
    const texte = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
    setZn(texte(exercice.nombreEtablissementsPays));
    setZo(texte(exercice.nombreEtablissementsHorsPays));
    setZp(texte(exercice.premiereAnneeExercicePays));
    setControle(exercice.controleEntreprise ?? '');
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
    const moi = ++envoiCourant.current;
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
      if (moi === envoiCourant.current) setInfo('Fiche R2 enregistrée.');
    } catch (err) {
      if (moi === envoiCourant.current) setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      if (moi === envoiCourant.current) setEnvoi(false);
    }
  };

  const champ = 'mt-1 block border border-border-dark px-2 py-1 text-[11.5px] placeholder:italic placeholder:text-text-dim';
  // En lecture, une case vide se lit « Non renseignée », jamais un blanc.
  const vide = peutDeclarer ? undefined : 'Non renseignée';
  const changer = (poser: (v: string) => void) => (e: { target: { value: string } }) => {
    poser(e.target.value);
    setInfo(null);
  };
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
          <input type="number" min={0} step={1} value={zn} disabled={!peutDeclarer} placeholder={vide} onChange={changer(setZn)} className={`${champ} w-28`} />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          Hors du pays, comptabilité distincte
          <input type="number" min={0} step={1} value={zo} disabled={!peutDeclarer} placeholder={vide} onChange={changer(setZo)} className={`${champ} w-28`} />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          Première année d’exercice dans le pays
          <input type="number" min={1000} max={9999} step={1} value={zp} disabled={!peutDeclarer} placeholder={vide} onChange={changer(setZp)} className={`${champ} w-28`} />
        </label>
        <label className="text-[11.5px] font-semibold text-text-dim">
          Contrôle de l’entreprise
          <select
            value={controle}
            disabled={!peutDeclarer}
            onChange={(e) => {
              setControle(e.target.value as '' | ControleEntreprise);
              setInfo(null);
            }}
            className={champ}
          >
            <option value="">Non renseigné</option>
            <option value="PUBLIC">Contrôle public</option>
            <option value="PRIVE_NATIONAL">Contrôle privé national</option>
            <option value="PRIVE_ETRANGER">Contrôle privé étranger</option>
          </select>
        </label>
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
