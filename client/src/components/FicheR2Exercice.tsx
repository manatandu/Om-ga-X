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
 *
 * DÉCISION PAR LA LOI DU 2026-10-07, POINT 4 · ZN compte le SIÈGE (AUDCIF
 * Titre VIII ch. 34, section 3, « le siège étant considéré lui-même comme un
 * établissement ») et les divisions à comptabilité autonome (section 1) ; ZQ à
 * ZS se lisent par l'art. 78 (bulles). Le contrôle public est PROPOSÉ quand la
 * quote-part déclarée de l'État dépasse la moitié du capital · un clic remplit
 * la case, l'enregistrement reste au cabinet, jamais une substitution.
 */
export function FicheR2Exercice({
  exercice,
  apresEnregistrement,
  quotePartEtatCapital = null,
}: {
  exercice: Exercice;
  apresEnregistrement: () => Promise<void> | void;
  /** Quote-part de l'État DÉCLARÉE (entreprise du portefeuille), en pourcentage · null sinon. */
  quotePartEtatCapital?: number | null;
}) {
  // Le droit se LIT dans le contexte de session · la route est réservée à
  // l'administrateur du dossier, comme l'arrêté des comptes.
  const { estAdmin: peutDeclarer } = useAuth();
  const [zn, setZn] = useState('');
  const [zo, setZo] = useState('');
  const [zp, setZp] = useState('');
  const [controle, setControle] = useState<'' | ControleEntreprise>('');
  // Le focus va à la case remplie par « Reprendre la proposition » · sans
  // quoi il tombait sur un bouton qui disparaît.
  const caseControle = useRef<HTMLSelectElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Une réponse d'un exercice quitté, ou d'un envoi dépassé par un autre, ne
  // s'affiche pas · le numéro d'envoi change à chaque envoi et à chaque
  // changement d'exercice.
  const envoiCourant = useRef(0);
  // L'exercice affiché · comparé à celui de l'envoi avant tout message.
  const exerciceAffiche = useRef(exercice.id);

  // Changer d'exercice efface les messages et périme l'envoi en cours.
  useEffect(() => {
    exerciceAffiche.current = exercice.id;
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
    const pour = exercice.id;
    const valable = () => moi === envoiCourant.current && exerciceAffiche.current === pour;
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
      if (valable()) setInfo('Fiche R2 enregistrée.');
    } catch (err) {
      if (valable()) setErreur(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      if (valable()) setEnvoi(false);
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
          <span className="flex items-center gap-1.5">
            Établissements dans le pays
            <Aide
              titre="Établissements dans le pays"
              texte="Le siège compte : il est considéré lui-même comme un établissement. Les autres établissements sont les divisions de l’entité qui disposent d’une comptabilité autonome (succursales, usines, ateliers…), rattachée à celle du siège par un compte de liaison."
              source="AUDCIF Titre VIII ch. 34, sections 1 et 3 · Titre VII, compte 18"
            />
          </span>
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
          <span className="flex items-center gap-1.5">
            Contrôle de l’entreprise
            <Aide
              titre="Contrôle de l’entreprise"
              texte="Le contrôle se lit par la seule définition de l’Acte : il résulte soit de la détention directe ou indirecte de la majorité des droits de vote ; soit de la désignation, pendant deux exercices successifs, de la majorité des membres des organes d’administration ou de direction, présumée au-delà de 40 % des droits de vote quand aucun autre associé n’en détient davantage ; soit du droit d’exercer une influence dominante en vertu d’un contrat ou de clauses statutaires. Contrôle public : l’État ou une personne morale de droit public contrôle, comme dans l’entreprise publique où l’État détient la totalité ou la majorité absolue des actions. Contrôle privé national ou étranger : selon la nationalité de la personne qui contrôle. Un contrôle conjoint, ou l’absence de détenteur du contrôle, n’est rangé par aucun texte : la case reste au cabinet."
              source="AUDCIF art. 78 · loi n° 08/010, art. 3"
            />
          </span>
          <select
            ref={caseControle}
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
      {/* PROPOSÉ, jamais coché d'office · la quote-part du capital n'établit
          pas seule la majorité des droits de vote (art. 78). */}
      {peutDeclarer && controle === '' && quotePartEtatCapital !== null && quotePartEtatCapital > 50 && (
        <div className="mt-2 text-[11.5px] flex items-center gap-2 flex-wrap">
          <span>Quote-part de l’État déclarée · {String(quotePartEtatCapital).replace('.', ',')} % · contrôle public proposé</span>
          <button
            type="button"
            onClick={() => {
              setControle('PUBLIC');
              setInfo(null);
              caseControle.current?.focus();
            }}
            className="border border-border-dark px-2 py-0.5 text-[11.5px] font-semibold hover:bg-surface-alt"
          >
            Reprendre la proposition
          </button>
        </div>
      )}
      {erreur && <div className="mt-2 text-[11.5px] text-danger">{erreur}</div>}
      {info && <div className="mt-2 text-[11.5px] text-positive">{info}</div>}
    </form>
  );
}
