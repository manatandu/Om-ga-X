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
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const motifTape = !!choisi && motif.trim().length > 0;
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
  }, [bien.id]);

  useEffect(() => charger(), [charger]);
  useEffect(() => {
    if (choisi) champMotif.current?.focus({ preventScroll: true });
  }, [choisi]);

  const annuler = async (e: React.FormEvent) => {
    e.preventDefault();
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

      {choisi && peutValider && (
        <form onSubmit={annuler} className="mt-3 border border-border bg-surface-alt p-3">
          <div className="font-semibold mb-1.5">Annuler · {choisi.libelle}</div>
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
            <button type="button" onClick={() => setChoisi(null)} disabled={envoi} className="px-3 py-[3px] border border-border-dark rounded-[3px]">
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
