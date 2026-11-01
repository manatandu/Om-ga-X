import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useExercice } from '../../lib/exercice';
import { montant as fc } from '../../lib/montants';
import { lireNombre } from '../../lib/conditions-bancaires-saisie';
import { lirePourcentage, totalEnPointsDeBase, type RepartitionsLues } from '../../lib/repartition-analytique';
import { journauxDeLaRegularisation, LIBELLE_ISSUE, type IssueRegularisation, type JournalMin } from '../../lib/avance-mission';
import { Aide } from '../chrome/Aide';

/**
 * LIGNE PAIE-DECLARATIONS, POINT 3 · L'AVANCE DE MISSION, SA RÉGULARISATION
 * ET LA RÉPARTITION DES FRAIS PAR PROJET, dans la carte de chaque mission.
 * Les montants, l'issue et les comptes viennent du serveur
 * (`avance-mission.ts`) · rien n'est calculé ici. Verser, régulariser et
 * annuler passent une pièce au journal · `peutValider`, comme les routes
 * (`@ReserveAuComptable`). La répartition suit `peutEcrire`.
 */
export type AvanceDeMission = {
  annulees: number;
  active: {
    id: string;
    date: string;
    montantFc: number;
    pieceJustificative: string;
    piecePassee: string;
    regularisation: {
      id: string;
      date: string;
      issue: IssueRegularisation;
      justifieFc: number;
      avanceFc: number;
      ecartFc: number;
      piecePassee: string | null;
      avanceSalaireId: string | null;
    } | null;
  } | null;
};

export type RepartitionDeMission = { planId: string; planCode: string; sectionId: string; sectionCode: string; pourcentage: number };

type Proposition = { justifieFc: number; avanceFc: number; issue: IssueRegularisation | null; ecartFc: number; tropVerseAChoisir: boolean };

const champ = 'border border-border bg-transparent px-1.5 py-0.5';
const montantSaisi = (v: string): number | null => {
  const lu = lireNombre(v, 'montant');
  return 'valeur' in lu ? lu.valeur : null;
};

export function AvanceMissionPaie({
  mission,
  envoi,
  envoyer,
}: {
  mission: {
    id: string;
    numero: number;
    salarieId: string;
    annuleLe: string | null;
    bulletin: unknown;
    avance?: AvanceDeMission;
    repartitions?: RepartitionDeMission[];
    repartitionsTronquees?: boolean;
  };
  envoi: boolean;
  envoyer: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { peutValider, peutEcrire } = useAuth();
  const { exerciceCourant } = useExercice();
  // Null tant que rien n'est LU · un journal absent ne se dit qu'après lecture.
  const [journaux, setJournaux] = useState<JournalMin[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState('');
  const [avance, setAvance] = useState({ journalId: '', date: '', montant: '', piece: '' });
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [regul, setRegul] = useState({ journalId: '', date: '', piece: '', tropVerse: '' as '' | 'RENDU' | 'RETENU' });
  const [plans, setPlans] = useState<RepartitionsLues['plans'] | null>(null);
  const [repartition, setRepartition] = useState<{ planId: string; lignes: { sectionId: string; pourcentage: string }[] } | null>(null);

  const active = mission.avance?.active ?? null;
  const ouverte = !mission.annuleLe;
  const besoinJournaux = peutValider && ouverte && (!active || !active.regularisation);

  useEffect(() => {
    if (!besoinJournaux || journaux !== null) return;
    api.get<JournalMin[]>('/journaux').then(setJournaux, (e: ApiError) => setErreurLecture(e.message));
  }, [besoinJournaux, journaux]);

  const tresorerie = (journaux ?? []).filter((j) => j.type === 'TRESORERIE' && j.estActif);

  const verser = async () => {
    const montantFc = montantSaisi(avance.montant);
    if (montantFc === null || !exerciceCourant) return;
    if (
      await envoyer(() =>
        api.post(`/personnel/missions/${mission.id}/avance`, {
          exerciceId: exerciceCourant.id,
          journalId: avance.journalId,
          date: avance.date,
          montantFc,
          pieceJustificative: avance.piece,
        }),
      )
    ) {
      setAvance({ journalId: '', date: '', montant: '', piece: '' });
    }
  };

  const ouvrirRegularisation = (avanceId: string) => {
    setProposition(null);
    api.get<Proposition>(`/personnel/missions/avances/${avanceId}/regularisation/proposition`).then(setProposition, (e: ApiError) => setErreurLecture(e.message));
  };

  const regulariser = async (avanceId: string) => {
    if (!exerciceCourant) return;
    const ok = await envoyer(() =>
      api.post(`/personnel/missions/avances/${avanceId}/regularisation`, {
        exerciceId: exerciceCourant.id,
        journalId: regul.journalId,
        date: regul.date,
        pieceJustificative: regul.piece,
        ...(regul.tropVerse ? { tropVerse: regul.tropVerse } : {}),
      }),
    );
    if (ok) setProposition(null);
  };

  const annuler = (url: string, quoi: string) => {
    const motif = window.prompt(`Motif de l’annulation ${quoi}`);
    if (motif === null) return;
    // Un motif trop court se dit, jamais un clic sans effet.
    if (motif.trim().length < 3) {
      setErreurLecture('Le motif de l’annulation compte au moins trois caractères · rien n’est annulé.');
      return;
    }
    setErreurLecture('');
    void envoyer(() => api.post(url, { motif: motif.trim() }));
  };

  const ouvrirRepartition = () => {
    setRepartition({ planId: '', lignes: [{ sectionId: '', pourcentage: '' }] });
    if (plans === null) {
      api.get<RepartitionsLues>(`/personnel/salaries/${mission.salarieId}/repartitions-analytiques`).then(
        (r) => setPlans(r.plans.filter((p) => p.ventileLaPaie)),
        (e: ApiError) => setErreurLecture(e.message),
      );
    }
  };
  const totalPoints = repartition ? totalEnPointsDeBase(repartition.lignes.map((l) => l.pourcentage)) : null;
  const enregistrerRepartition = async () => {
    if (!repartition || !repartition.planId) return;
    const lignes = repartition.lignes
      .filter((l) => l.sectionId)
      .map((l) => ({ sectionId: l.sectionId, pourcentage: lirePourcentage(l.pourcentage) }));
    if (lignes.some((l) => l.pourcentage === null)) return;
    if (await envoyer(() => api.put(`/personnel/missions/${mission.id}/repartitions/${repartition.planId}`, { lignes }))) setRepartition(null);
  };

  const issueChoisie: IssueRegularisation | null = proposition
    ? proposition.issue ?? (regul.tropVerse === 'RENDU' ? 'TROP_VERSE_RENDU' : regul.tropVerse === 'RETENU' ? 'TROP_VERSE_RETENU' : null)
    : null;
  const journauxRegul = journauxDeLaRegularisation(journaux, issueChoisie);
  const planChoisi = plans?.find((p) => p.id === repartition?.planId) ?? null;

  return (
    <div className="mt-1 border-t border-border/40 pt-1 space-y-1">
      {erreurLecture && <div className="text-danger">{erreurLecture}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold flex items-center gap-1">
          Avance
          <Aide
            titre="Avance de mission"
            texte="L'avance versée avant le départ passe au brouillard D 4213 Frais avancés au personnel / C trésorerie du journal choisi ; une caisse ne verse que ce qu'elle contient. Au retour, la régularisation impute les frais justifiés au 6384 Missions et solde le 4213 · le complément se paie au salarié, le trop-versé est rendu, ou reclassé au 4211 et retenu sur sa paie comme une avance du registre. La répartition par projet ventile le 6384 de la régularisation. Une mission avancée ne porte plus ses frais justifiés au bulletin ; le forfait imposable y reste. Les frais se figent à la régularisation ; l'annuler les rend modifiables."
            source="Fiche du compte 42 (AUDCIF, SYCEBNL) · fiche du compte 66 · Code du travail, art. 112, c) · AUDCIF art. 20, al. 2"
          />
        </span>
        {!active && mission.avance && mission.avance.annulees > 0 && <span className="text-text-dim">{mission.avance.annulees} avance(s) annulée(s)</span>}
        {!active && !ouverte && <span className="text-text-dim">mission annulée</span>}
        {active && (
          <span>
            {fc(active.montantFc)} versée le {active.date} · {active.piecePassee} · pièce {active.pieceJustificative}
          </span>
        )}
        {active?.regularisation && (
          <span>
            · régularisée le {active.regularisation.date} · {LIBELLE_ISSUE[active.regularisation.issue]}
            {active.regularisation.ecartFc > 0 ? ` (${fc(active.regularisation.ecartFc)})` : ''} · frais justifiés {fc(active.regularisation.justifieFc)}
            {active.regularisation.piecePassee ? ` · ${active.regularisation.piecePassee}` : ''}
          </span>
        )}
        {peutValider && active && !active.regularisation && (
          <>
            <button type="button" className="hover:underline" disabled={envoi} onClick={() => ouvrirRegularisation(active.id)}>
              Régulariser
            </button>
            <button type="button" className="text-danger hover:underline" disabled={envoi} onClick={() => annuler(`/personnel/missions/avances/${active.id}/annulation`, 'de l’avance')}>
              Annuler l’avance
            </button>
          </>
        )}
        {peutValider && active?.regularisation && (
          <button
            type="button"
            className="text-danger hover:underline"
            disabled={envoi}
            onClick={() => annuler(`/personnel/missions/regularisations/${active.regularisation!.id}/annulation`, 'de la régularisation')}
          >
            Annuler la régularisation
          </button>
        )}
      </div>

      {peutValider && ouverte && !active && !mission.bulletin && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <select aria-label={`Journal de l'avance de la mission ${mission.numero}`} value={avance.journalId} onChange={(e) => setAvance({ ...avance, journalId: e.target.value })} className={champ}>
            <option value="">{journaux === null ? 'Lecture des journaux…' : tresorerie.length === 0 ? 'Aucun journal de banque ou de caisse actif' : 'Journal de trésorerie…'}</option>
            {tresorerie.map((j) => (
              <option key={j.id} value={j.id}>
                {j.code} · {j.intitule}
              </option>
            ))}
          </select>
          <input aria-label={`Date de l'avance de la mission ${mission.numero}`} type="date" value={avance.date} onChange={(e) => setAvance({ ...avance, date: e.target.value })} className={champ} />
          <input aria-label={`Montant de l'avance de la mission ${mission.numero}`} placeholder="Montant FC" value={avance.montant} onChange={(e) => setAvance({ ...avance, montant: e.target.value })} className={`${champ} w-[110px] text-right`} />
          <input aria-label={`Pièce de l'avance de la mission ${mission.numero}`} placeholder="Reçu, bon de sortie" value={avance.piece} onChange={(e) => setAvance({ ...avance, piece: e.target.value })} className={`${champ} w-[150px]`} />
          <button
            type="button"
            className="hover:underline"
            disabled={envoi || !avance.journalId || !avance.date || montantSaisi(avance.montant) === null || !avance.piece.trim()}
            onClick={verser}
          >
            Verser l’avance
          </button>
        </div>
      )}

      {peutValider && active && proposition && !active.regularisation && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span>
            Frais justifiés {fc(proposition.justifieFc)} · avance {fc(proposition.avanceFc)}
            {proposition.issue ? ` · ${LIBELLE_ISSUE[proposition.issue]}${proposition.ecartFc > 0 ? ` (${fc(proposition.ecartFc)})` : ''}` : ` · trop-versé ${fc(proposition.ecartFc)}`}
          </span>
          {proposition.tropVerseAChoisir && (
            <select aria-label="Sort du trop-versé" value={regul.tropVerse} onChange={(e) => setRegul({ ...regul, tropVerse: e.target.value as '' | 'RENDU' | 'RETENU', journalId: '' })} className={champ}>
              <option value="">Trop-versé…</option>
              <option value="RENDU">Rendu par le salarié</option>
              <option value="RETENU">Retenu sur sa paie</option>
            </select>
          )}
          <select aria-label="Journal de la régularisation" value={regul.journalId} onChange={(e) => setRegul({ ...regul, journalId: e.target.value })} className={champ} disabled={issueChoisie === null}>
            <option value="">{journauxRegul.length === 0 ? 'Aucun journal ne convient' : 'Journal…'}</option>
            {journauxRegul.map((j) => (
              <option key={j.id} value={j.id}>
                {j.code} · {j.intitule}
              </option>
            ))}
          </select>
          <input aria-label="Date de la régularisation" type="date" value={regul.date} onChange={(e) => setRegul({ ...regul, date: e.target.value })} className={champ} />
          <input aria-label="Pièce de la régularisation" placeholder="Décompte des frais" value={regul.piece} onChange={(e) => setRegul({ ...regul, piece: e.target.value })} className={`${champ} w-[150px]`} />
          <button type="button" className="hover:underline" disabled={envoi || issueChoisie === null || !regul.journalId || !regul.date || !regul.piece.trim()} onClick={() => regulariser(active.id)}>
            Passer la régularisation
          </button>
        </div>
      )}

      {/*
        La répartition ne sert qu'à la régularisation de l'avance (elle ventile
        son 6384) · le serveur la refuse sans avance, et l'écran ne l'offre
        qu'alors. Sans avance, les frais portés au bulletin suivent la
        répartition du salarié.
      */}
      {active && (
      <div className="flex flex-wrap gap-x-3 items-center">
        <span className="font-semibold">Projets</span>
        {(mission.repartitions ?? []).length === 0 ? (
          <span className="text-text-dim">aucune répartition · le 6384 ne se ventile pas</span>
        ) : (
          <span>{(mission.repartitions ?? []).map((r) => `${r.planCode} ${r.sectionCode} ${r.pourcentage} %`).join(' · ')}</span>
        )}
        {mission.repartitionsTronquees && <span className="text-warning">liste tronquée</span>}
        {peutEcrire && ouverte && !active.regularisation && !repartition && (
          <button type="button" className="hover:underline" disabled={envoi} onClick={ouvrirRepartition}>
            Répartir entre projets
          </button>
        )}
      </div>
      )}
      {active && !active.regularisation && repartition && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <select aria-label="Plan analytique" value={repartition.planId} onChange={(e) => setRepartition({ planId: e.target.value, lignes: [{ sectionId: '', pourcentage: '' }] })} className={champ}>
            <option value="">{plans === null ? 'Lecture des plans…' : plans.length === 0 ? 'Aucun plan ne ventile la classe 6' : 'Plan…'}</option>
            {(plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.intitule}
              </option>
            ))}
          </select>
          {repartition.lignes.map((l, i) => (
            <span key={i} className="flex gap-1">
              <select
                aria-label={`Section ${i + 1}`}
                value={l.sectionId}
                onChange={(e) => setRepartition({ ...repartition, lignes: repartition.lignes.map((x, k) => (k === i ? { ...x, sectionId: e.target.value } : x)) })}
                className={champ}
                disabled={!planChoisi}
              >
                <option value="">Section…</option>
                {(planChoisi?.sections ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.intitule}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Pourcentage ${i + 1}`}
                value={l.pourcentage}
                onChange={(e) => setRepartition({ ...repartition, lignes: repartition.lignes.map((x, k) => (k === i ? { ...x, pourcentage: e.target.value } : x)) })}
                className={`${champ} w-[60px] text-right`}
                placeholder="%"
              />
            </span>
          ))}
          <button type="button" className="hover:underline" onClick={() => setRepartition({ ...repartition, lignes: [...repartition.lignes, { sectionId: '', pourcentage: '' }] })}>
            Ajouter une section
          </button>
          <span className={totalPoints === 10_000 ? 'text-text-dim' : 'text-warning'}>{totalPoints === null ? 'pourcentage illisible' : `total ${(totalPoints / 100).toFixed(2)} %`}</span>
          <button type="button" className="hover:underline" disabled={envoi || !repartition.planId || totalPoints !== 10_000} onClick={enregistrerRepartition}>
            Enregistrer
          </button>
          <button type="button" className="hover:underline" disabled={envoi || !repartition.planId} onClick={() => void envoyer(() => api.put(`/personnel/missions/${mission.id}/repartitions/${repartition.planId}`, { lignes: [] }))}>
            Retirer la répartition du plan
          </button>
          <button type="button" className="text-text-dim hover:underline" onClick={() => setRepartition(null)}>
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
