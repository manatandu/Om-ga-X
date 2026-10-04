import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { montant } from '../lib/montants';
import { RETENUS } from '../lib/comptes-proposes';
import { reserveExigee, reservePreselectionnee, type EcartALaSortie } from '../lib/reevaluation-suites';
import { Aide } from './chrome/Aide';

interface ReponseReserves {
  comptes: Array<{ id: string; numero: string; intitule: string }>;
  nonRetenus: number;
  /** SYCEBNL · le 118 est IMPOSÉ par le serveur, montré sans liste et jamais envoyé. */
  impose: boolean;
  motifVide: string | null;
}

/**
 * LIGNES A15 ET A15 BIS · CE QUE LA SORTIE FERA DE L'ÉCART DE RÉÉVALUATION DU
 * BIEN, dans le formulaire de sortie. Le serveur dit ce qui sera passé (106
 * vers une réserve, 154 repris au 861), le même pour toute sortie et aux deux
 * référentiels (`sortDesEcarts`) · l'écran ne décide rien, il demande la
 * réserve quand le serveur l'exige. Rien n'apparaît pour un bien jamais
 * réévalué.
 */
export function EcartReevaluationSortie({
  immobilisationId,
  compteReserve,
  setCompteReserve,
}: {
  immobilisationId: string;
  compteReserve: string;
  setCompteReserve: (v: string) => void;
}) {
  const [lu, setLu] = useState<EcartALaSortie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reserves, setReserves] = useState<ReponseReserves | null>(null);
  const [erreurReserves, setErreurReserves] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    setLu(null);
    setErreur(null);
    api.get<EcartALaSortie>(`/immobilisations/reevaluation-bilan/ecart-a-la-sortie?immobilisationId=${encodeURIComponent(immobilisationId)}`).then(
      (r) => actif && setLu(r),
      (e) => actif && setErreur(e instanceof ApiError ? e.message : 'Lecture impossible'),
    );
    return () => {
      actif = false;
    };
  }, [immobilisationId]);

  const sorts = lu ? lu.sorts : null;
  const exigee = reserveExigee(sorts);

  useEffect(() => {
    if (!exigee) {
      setCompteReserve('');
      return;
    }
    let actif = true;
    setReserves(null);
    setErreurReserves(null);
    api.get<ReponseReserves>(`/immobilisations/reevaluation-bilan/comptes-reserve?${RETENUS}`).then(
      (r) => {
        if (!actif) return;
        setReserves(r);
        if (r.impose) return;
        const unique = reservePreselectionnee(r.comptes);
        if (unique) setCompteReserve(unique);
      },
      (e) => actif && setErreurReserves(e instanceof ApiError ? e.message : 'Lecture impossible'),
    );
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exigee]);

  if (erreur) return <div className="col-span-4 text-[11.5px] text-danger">Écart de réévaluation du bien · lecture impossible : {erreur}</div>;
  if (!sorts || sorts.length === 0) return null;
  return (
    <div className="col-span-4 border border-border bg-surface px-3 py-2 text-[11.5px]" data-cadre="ecart-reevaluation-sortie">
      <div className="flex items-center gap-1.5 font-semibold mb-1">
        Écart de réévaluation du bien
        <Aide
          titre="Écart de réévaluation à la sortie"
          texte={
            'La plus-value ou moins-value se calcule sur la valeur réévaluée. Le solde de l’écart d’un bien cédé ou mis hors ' +
            'service est transféré à une réserve · au SYSCOHADA une réserve non distribuable (réserve légale, réserves ' +
            'statutaires ou autres réserves réglementées du 1138, jamais une réserve libre ni une réserve réglementée à objet ' +
            'propre) ; au SYCEBNL, dont le texte se tait, le 118 Autres réserves, imposé. Le reste de la ' +
            'provision spéciale de réévaluation est repris en entier au 861 à toute sortie, pour que la réévaluation reste ' +
            'sans influence sur le résultat. La réintégration au résultat fiscal reste au cabinet.'
          }
          source="AUDCIF Titre VIII ch. 28 § 6 · fiches des comptes 11 et 15 · loi n° 23/053, art. 132, 133 et 19"
        />
      </div>
      <ul className="space-y-0.5">
        {sorts.map((s) => (
          <li key={s.ligneId}>
            {s.compteEcart} · {montant(s.montant)} · {s.traitement === 'RESERVE' ? 'transféré à la réserve choisie' : 'repris au 861'}
          </li>
        ))}
      </ul>
      {exigee && reserves?.impose && (
        <div className="mt-2 font-semibold text-text-dim" data-reserve="imposee">
          Réserve ·{' '}
          {reserves.comptes[0] ? (
            <span className="font-normal">
              {reserves.comptes[0].numero} · {reserves.comptes[0].intitule}
            </span>
          ) : (
            <span className="font-normal text-danger">{reserves.motifVide}</span>
          )}
        </div>
      )}
      {exigee && !reserves?.impose && (
        <label className="block mt-2 font-semibold text-text-dim">
          Réserve non distribuable
          <select required value={compteReserve} onChange={(e) => setCompteReserve(e.target.value)} className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px]">
            <option value="" />
            {(reserves?.comptes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.intitule}
              </option>
            ))}
          </select>
          {erreurReserves && <span className="block mt-1 font-normal text-danger">Lecture impossible : {erreurReserves}</span>}
          {reserves && reserves.comptes.length === 0 && reserves.motifVide && <span className="block mt-1 font-normal text-danger">{reserves.motifVide}</span>}
        </label>
      )}
    </div>
  );
}
