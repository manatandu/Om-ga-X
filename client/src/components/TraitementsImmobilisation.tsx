import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { Aide } from './chrome/Aide';

/** Un traitement du bien, tel que le serveur le sert (`GET /immobilisations/:id/traitements`). */
interface TraitementLu {
  nature: string;
  acteId: string;
  libelle: string;
  exercice: { id: string; dateFin: string; statut: string };
  enregistreLe: string;
  montant: number | null;
  ecriture: { id: string; numeroPiece: number | null; statut: string } | null;
  portePlusieursBiens: boolean;
  motifRefus: string | null;
}

interface AnnulationLue {
  id: string;
  nature: string;
  libelle: string;
  montant: number | null;
  motif: string;
  traitement: string;
  numeroPieceOrigine: number | null;
  negatif: { id: string; numeroPiece: number | null; date: string } | null;
  annuleeLe: string;
}

/** L'aperçu de l'annulation de la sortie (`GET /immobilisations/:id/annulation-sortie`, point 3 de la ligne restes-immos-budgets). */
interface ApercuSortie {
  sortie: boolean;
  annulable: boolean;
  motifRefus: string | null;
  partielle: boolean;
  lot: { id: string; designation: string } | null;
  ecritures: { role: string; libelle: string; numeroPiece: number | null; statut: string; montant: number; traitement: string }[];
}

const LIBELLE_TRAITEMENT: Record<string, string> = {
  SUPPRIMEE: 'écriture retirée du brouillard',
  INSCRITE_EN_NEGATIF: 'écriture inscrite en négatif',
  SANS_ECRITURE: 'sans écriture',
};

const date = (d: string) => new Date(d).toLocaleDateString('fr-FR');

/**
 * LES TRAITEMENTS D'UN BIEN, ET LEUR ANNULATION (ligne sage-l4, fonction
 * n° 67). La liste et le motif de chaque refus viennent du serveur · l'écran
 * ne recalcule aucune dépendance. Le geste suit `peutValider` · il inscrit en
 * négatif une écriture validée, comme la route le réserve au comptable.
 */
export function TraitementsImmobilisation({
  bien,
  onFait,
  onEtatTravail,
}: {
  bien: { id: string; designation: string };
  onFait: (message: string) => void;
  /** L'annulation en cours et le motif tapé · la fenêtre de la fiche tient sa fermeture sur eux. */
  onEtatTravail?: (etat: { occupe: boolean; nonEnregistre: boolean }) => void;
}) {
  const { peutValider } = useAuth();
  // null tant que la liste n'est pas lue · « aucun traitement » ne se dit que sur une liste lue.
  const [traitements, setTraitements] = useState<TraitementLu[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [historique, setHistorique] = useState<{ annulations: AnnulationLue[]; total: number; tronque: boolean } | null>(null);
  const [erreurHistorique, setErreurHistorique] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<TraitementLu | null>(null);
  const [sortie, setSortie] = useState<ApercuSortie | null>(null);
  const [erreurSortie, setErreurSortie] = useState<string | null>(null);
  const [annulerLaSortie, setAnnulerLaSortie] = useState(false);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const motifTape = (!!choisi || annulerLaSortie) && motif.trim().length > 0;
  // AVANT TOUT ÉVÉNEMENT SUIVANT (tests navigateur, WebKit, 2026-10-21) ·
  // signalé par un useEffect, l'état « non enregistré » arrivait à la fiche un
  // tour plus tard, et un Échap tapé aussitôt après la saisie la fermait sans
  // rien demander. Le useLayoutEffect le pose dans le même passage.
  useLayoutEffect(() => onEtatTravail?.({ occupe: envoi, nonEnregistre: motifTape }), [envoi, motifTape, onEtatTravail]);
  const champMotif = useRef<HTMLTextAreaElement>(null);
  // Une réponse arrivée après un rechargement plus récent est jetée.
  const jeton = useRef(0);

  const charger = useCallback(() => {
    const mien = ++jeton.current;
    setErreurLecture(null);
    setErreurHistorique(null);
    api
      .get<{ traitements: TraitementLu[] }>(`/immobilisations/${bien.id}/traitements`)
      .then((r) => mien === jeton.current && setTraitements(r.traitements))
      .catch((e) => mien === jeton.current && setErreurLecture(e instanceof ApiError ? e.message : 'Traitements illisibles'));
    api
      .get<{ annulations: AnnulationLue[]; total: number; tronque: boolean }>(`/immobilisations/annulations-traitements?immobilisationId=${bien.id}`)
      .then((r) => mien === jeton.current && setHistorique(r))
      .catch((e) => mien === jeton.current && setErreurHistorique(e instanceof ApiError ? e.message : 'Historique illisible'));
    setErreurSortie(null);
    api
      .get<ApercuSortie>(`/immobilisations/${bien.id}/annulation-sortie`)
      .then((r) => mien === jeton.current && setSortie(r))
      .catch((e) => mien === jeton.current && setErreurSortie(e instanceof ApiError ? e.message : 'Sortie illisible'));
  }, [bien.id]);

  useEffect(() => charger(), [charger]);
  useEffect(() => {
    if (choisi || annulerLaSortie) champMotif.current?.focus({ preventScroll: true });
  }, [choisi, annulerLaSortie]);

  const annuler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (annulerLaSortie) return annulerSortie();
    if (!choisi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ traitement: string; negatif: { numeroPiece: number | null } | null }>('/immobilisations/traitements/annulation', {
        nature: choisi.nature,
        acteId: choisi.acteId,
        motif: motif.trim(),
      });
      onFait(
        r.negatif
          ? `${choisi.libelle} annulée · écriture inscrite en négatif (pièce n° ${r.negatif.numeroPiece ?? '·'}).`
          : `${choisi.libelle} annulée · ${LIBELLE_TRAITEMENT[r.traitement] ?? r.traitement}.`,
      );
      setChoisi(null);
      setMotif('');
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'L’annulation a échoué');
    } finally {
      setEnvoi(false);
    }
  };

  // La sortie annulée · une fiche d'unités sorties d'un lot disparaît, ses unités rendues au lot.
  const annulerSortie = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ partielle: boolean; ecritures: { libelle: string; traitement: string; negatif: { numeroPiece: number | null } | null }[] }>(
        `/immobilisations/${bien.id}/annuler-sortie`,
        { motif: motif.trim() },
      );
      const negatifs = r.ecritures.filter((x) => x.negatif).map((x) => `n° ${x.negatif?.numeroPiece ?? '·'}`);
      onFait(
        `Sortie de « ${bien.designation} » annulée${r.partielle ? ' · les unités sont rendues au lot' : ''}` +
          (negatifs.length ? ` · écritures inscrites en négatif (pièces ${negatifs.join(', ')}).` : ' · écritures retirées du brouillard.'),
      );
      setAnnulerLaSortie(false);
      setMotif('');
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'L’annulation a échoué');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="text-[11.5px]">
      <div className="font-semibold flex items-center gap-1.5 mb-2">
        Traitements · {bien.designation}
        <Aide
          titre="Annuler un traitement"
          texte="Dotation, dépréciation, révision du plan, dérogatoire, réévaluation et reprises s'annulent avec un motif. Au brouillard l'écriture est retirée ; validée, elle est inscrite en négatif, jamais supprimée. On annule à partir du plus récent · un traitement qu'un acte postérieur a lu ne s'annule qu'après lui. Dans un exercice clôturé, l'erreur relève du report à nouveau."
          source="AUDCIF, art. 20 et 22"
        />
      </div>

      {erreurLecture && <div className="text-danger mb-2">{erreurLecture}</div>}
      {!traitements && !erreurLecture && <div className="text-text-dim">Chargement…</div>}
      {traitements && traitements.length === 0 && <div className="text-text-dim">Aucun traitement sur ce bien.</div>}
      {traitements && traitements.length > 0 && (
        <div className="border border-border overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr>
                <th className="text-left">Traitement</th>
                <th className="text-left">Pièce</th>
                <th className="text-right">Montant</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {traitements.map((t) => (
                <tr key={`${t.nature}-${t.acteId}`}>
                  <td>
                    {t.libelle}
                    {t.portePlusieursBiens && <span className="block text-[11px] text-text-dim">Porte sur plusieurs biens</span>}
                    {t.motifRefus && <span className="block text-[11px] text-text-dim">{t.motifRefus}</span>}
                  </td>
                  <td>
                    {t.ecriture ? `n° ${t.ecriture.numeroPiece ?? '·'} · ${t.ecriture.statut === 'BROUILLARD' ? 'brouillard' : 'validée'}` : '·'}
                  </td>
                  <td className="text-right">{montant(t.montant)}</td>
                  <td className="text-right">
                    {peutValider && (
                      <button
                        type="button"
                        disabled={!!t.motifRefus || envoi}
                        title={t.motifRefus ?? 'Annuler ce traitement'}
                        onClick={() => {
                          setChoisi(t);
                          setAnnulerLaSortie(false);
                          setErreur(null);
                        }}
                        className="text-[11px] text-sel hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {erreurSortie && <div className="text-danger mt-3">{erreurSortie}</div>}
      {sortie?.sortie && (
        <div className="mt-3 border border-border p-2.5">
          <div className="font-semibold flex items-center gap-1.5 mb-1.5">
            Sortie du bien{sortie.partielle && sortie.lot ? ` · unités du lot « ${sortie.lot.designation} »` : ''}
            <Aide
              titre="Annuler la sortie"
              texte="La sortie s'annule avec un motif, dans l'exercice de la sortie seulement. Au brouillard ses écritures sont retirées ; validées, elles sont inscrites en négatif. La fiche revient en service telle qu'avant la sortie ; des unités sorties d'un lot reviennent au lot, et leur fiche disparaît. Ce qui a lu la sortie depuis s'annule d'abord."
              source="AUDCIF, art. 20 et 22"
            />
          </div>
          {sortie.ecritures.map((x) => (
            <div key={x.role} className="flex gap-3">
              <span className="flex-1">{x.libelle}</span>
              <span>n° {x.numeroPiece ?? '·'} · {x.statut === 'BROUILLARD' ? 'brouillard' : 'validée'}</span>
              <span className="w-[110px] text-right">{montant(x.montant)}</span>
            </div>
          ))}
          {sortie.motifRefus && <div className="text-[11px] text-text-dim mt-1">{sortie.motifRefus}</div>}
          {peutValider && (
            <div className="mt-1.5 text-right">
              <button
                type="button"
                disabled={!sortie.annulable || envoi}
                title={sortie.motifRefus ?? 'Annuler la sortie'}
                onClick={() => {
                  setChoisi(null);
                  setAnnulerLaSortie(true);
                  setErreur(null);
                }}
                className="text-[11px] text-sel hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Annuler la sortie
              </button>
            </div>
          )}
        </div>
      )}

      {(choisi || annulerLaSortie) && peutValider && (
        <form onSubmit={annuler} className="mt-3 border border-border bg-surface-alt p-3">
          <div className="font-semibold mb-1.5">Annuler · {annulerLaSortie ? `la sortie de ${bien.designation}` : choisi?.libelle}</div>
          <label className="block text-[11.5px] font-semibold text-text-dim">
            Motif
            <textarea
              ref={champMotif}
              required
              minLength={3}
              maxLength={500}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-border-dark px-2.5 py-1.5 text-[12px] font-normal"
            />
          </label>
          {erreur && <div className="mt-2 text-danger">{erreur}</div>}
          <div className="mt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setChoisi(null);
                setAnnulerLaSortie(false);
              }}
              disabled={envoi}
              className="px-3 py-[3px] border border-border-dark rounded-[3px]"
            >
              Fermer
            </button>
            <button type="submit" disabled={envoi || motif.trim().length < 3} className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold disabled:opacity-50">
              {envoi ? 'Annulation…' : 'Confirmer l’annulation'}
            </button>
          </div>
        </form>
      )}

      <div className="font-semibold mt-4 mb-1.5">Annulations</div>
      {erreurHistorique && <div className="text-danger">{erreurHistorique}</div>}
      {!historique && !erreurHistorique && <div className="text-text-dim">Chargement…</div>}
      {historique && historique.annulations.length === 0 && <div className="text-text-dim">Aucune annulation sur ce bien.</div>}
      {historique && historique.annulations.length > 0 && (
        <ul className="space-y-1">
          {historique.annulations.map((a) => (
            <li key={a.id} className="border-b border-border pb-1">
              <span className="font-semibold">{a.libelle}</span> · {montant(a.montant)} · {LIBELLE_TRAITEMENT[a.traitement] ?? a.traitement}
              {a.negatif && ` (pièce n° ${a.negatif.numeroPiece ?? '·'})`} · le {date(a.annuleeLe)}
              <span className="block text-[11px] text-text-dim">Motif · {a.motif}</span>
            </li>
          ))}
          {historique.tronque && <li className="text-text-dim">{historique.annulations.length} annulations montrées sur {historique.total}.</li>}
        </ul>
      )}
    </div>
  );
}
