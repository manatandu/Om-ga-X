import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { montant as fc } from '../../lib/montants';
import { issueIncertaine } from '../../lib/message-refus';
import { Aide } from '../chrome/Aide';
import {
  corpsAEmettre,
  emettreLesCoches,
  type CorpsPropose,
  type IssueEmission,
  type LigneLot,
  type PropositionLot,
  type VerdictLot,
} from '../../lib/paie-en-lot';

type LigneProposee = Extract<LigneLot, { verdict: VerdictLot }>;

const moisCourant = () => new Date().toISOString().slice(0, 7);

/**
 * LIGNE PAIE-LOT · LA PAIE DU MOIS EN LOT. Le serveur PROPOSE un bulletin à
 * chaque salarié actif sous contrat, avec le verdict du calcul ; l'écran
 * n'en émet AUCUN tant que le cabinet ne coche pas (cases décochées) et ne
 * clique pas « Émettre ». Chaque bulletin coché part par la route de
 * l'émission unitaire, l'un après l'autre · un refus n'arrête pas les autres
 * et se dit nommément.
 */
export function OngletPaieEnLot({ peutEcrire }: { peutEcrire: boolean }) {
  const [mois, setMois] = useState(moisCourant());
  const [lot, setLot] = useState<PropositionLot | null>(null);
  const [erreur, setErreur] = useState('');
  const [lecture, setLecture] = useState(false);
  const [coches, setCoches] = useState<Record<string, boolean>>({});
  const [personnes, setPersonnes] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<IssueEmission[] | null>(null);
  const [emission, setEmission] = useState(false);
  // Le verdict RECALCULÉ par le serveur avec les personnes à charge saisies ·
  // la clé porte la saisie, une réponse périmée ne s'affiche pas.
  const [recalculs, setRecalculs] = useState<Record<string, { pour: string; verdict: VerdictLot } | { pour: string; refus: string }>>({});
  const jeton = useRef(0);

  const charger = useCallback(() => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) {
      setLot(null);
      return;
    }
    const j = ++jeton.current;
    setErreur('');
    setLecture(true);
    setLot(null);
    setCoches({});
    api.get<PropositionLot>(`/personnel/paie-en-lot/${mois}`).then(
      (r) => {
        if (j !== jeton.current) return;
        setLot(r);
        setLecture(false);
      },
      (e: ApiError) => {
        if (j !== jeton.current) return;
        setErreur(e.message);
        setLecture(false);
      },
    );
  }, [mois]);

  useEffect(() => {
    setIssues(null);
    setPersonnes({});
    setRecalculs({});
    charger();
  }, [charger]);

  const emissibles = (lot?.lignes ?? []).filter(
    (l): l is LigneProposee => l.etat === 'EMISSIBLE',
  );
  const nbCoches = emissibles.filter((l) => coches[l.salarieId]).length;

  const recalculer = (l: LigneProposee) => {
    const saisie = personnes[l.salarieId] ?? '';
    if (saisie.trim() === '') {
      setRecalculs(({ [l.salarieId]: _retire, ...reste }) => reste);
      return;
    }
    const c = corpsAEmettre(l.corps, saisie);
    if ('refus' in c) {
      setRecalculs((r) => ({ ...r, [l.salarieId]: { pour: saisie, refus: c.refus } }));
      return;
    }
    api
      .post<{ net: { totalVerseFc: number; netAPayerFc: number | null }; cotisations: { totalTravailleurFc: number; totalEmployeurFc: number }; retenue: { retenueFc: number } | null; conversion: VerdictLot['conversion'] }>(
        `/personnel/simulation?salarieId=${l.salarieId}`,
        c,
      )
      .then(
        (s) =>
          setRecalculs((r) => ({
            ...r,
            [l.salarieId]: {
              pour: saisie,
              verdict: {
                totalVerseFc: s.net.totalVerseFc,
                cotisationsTravailleurFc: s.cotisations.totalTravailleurFc,
                cotisationsEmployeurFc: s.cotisations.totalEmployeurFc,
                irppFc: s.retenue === null ? null : s.retenue.retenueFc,
                netAPayerFc: s.net.netAPayerFc,
                conversion: s.conversion ?? null,
              },
            },
          })),
        (e: ApiError) => setRecalculs((r) => ({ ...r, [l.salarieId]: { pour: saisie, refus: e.message } })),
      );
  };

  const emettre = async () => {
    if (emission) return;
    setErreur('');
    const choisis: { salarieId: string; nomComplet: string; corps: CorpsPropose }[] = [];
    for (const l of emissibles) {
      if (!coches[l.salarieId]) continue;
      const c = corpsAEmettre(l.corps, personnes[l.salarieId] ?? '');
      if ('refus' in c) return setErreur(`${l.nomComplet} · ${c.refus}`);
      choisis.push({ salarieId: l.salarieId, nomComplet: l.nomComplet, corps: c });
    }
    if (choisis.length === 0) return;
    if (!window.confirm(`Émettre ${choisis.length} bulletin(s) pour ${mois} ? Chaque bulletin émis est numéroté et ne s’efface pas · une erreur s’annule avec un motif.`)) return;
    setEmission(true);
    const r = await emettreLesCoches(
      choisis,
      (salarieId, corps) => api.post<{ numero: number }>(`/personnel/salaries/${salarieId}/bulletins`, corps),
      (e) =>
        issueIncertaine(e)
          ? 'Issue incertaine (réseau ou serveur) · relisez la liste, un bulletin émis y paraît comme déjà émis.'
          : e instanceof Error
            ? e.message
            : 'Refus du serveur.',
    );
    setIssues(r);
    setEmission(false);
    charger();
  };

  const td = 'px-2 py-1 align-top';
  return (
    <div className="max-w-[1240px] text-[11.5px]">
      <div className="flex flex-wrap items-center gap-3 mb-2.5">
        <label className="flex items-center gap-2">
          Mois de paie
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className="border border-border px-2 py-1" />
        </label>
        <button type="button" onClick={charger} disabled={lecture || emission} className="border border-border px-3 py-1 disabled:opacity-50">
          Relire
        </button>
        {lot && (
          <span className="text-text-dim">
            {lot.lignes.length} salarié(s) sous contrat · {lot.totalActifs} actif(s) au registre
            {lot.sansContrat > 0 ? ` · ${lot.sansContrat} sans contrat ce mois` : ''}
            {lot.tronque ? ` · les ${lot.plafond} premiers seulement` : ''}
          </span>
        )}
        <Aide
          titre="Paie du mois en lot"
          texte="Pour chaque salarié actif sous contrat, le serveur propose un bulletin : le salaire du contrat dans sa monnaie (le salaire des jours dus quand le mois porte des absences ou des congés), les allocations de congé du mois qui se portent, les paramètres de paie du dossier et la classe du contrat, puis rejoue le calcul. Les personnes à charge ne sont jamais reprises du registre · tapez le nombre retenu sur la ligne, sinon aucune réduction ne s’applique. Missions, heures majorées, rappels et retenues d’avance ne sont pas portés · émettez ces bulletins depuis la Simulation. Rien n’est émis sans case cochée ; chaque bulletin coché passe par l’émission unitaire, avec ses refus, et un refus n’arrête pas les autres. Un salarié qui a déjà un bulletin ce mois est écarté."
          source="Code du travail, art. 103, 124, 142 et 214 · loi n° 23/053, art. 124 et 125"
        />
      </div>

      {erreur && <div className="border border-danger/30 bg-danger-soft px-3.5 py-2 mb-2.5">{erreur}</div>}
      {lecture && <div className="text-text-dim mb-2">Calcul des propositions…</div>}

      {issues && (
        <div className="border border-border bg-surface px-3 py-2 mb-2.5" role="status">
          <div className="font-semibold mb-1">
            Émission · {issues.filter((i) => i.emis).length} émis, {issues.filter((i) => !i.emis).length} refusé(s)
          </div>
          <ul className="list-disc pl-5">
            {issues.map((i) => (
              <li key={i.salarieId} className={i.emis ? undefined : 'text-danger'}>
                {i.nomComplet} · {i.emis ? `bulletin n° ${i.numero}` : i.motif}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lot && lot.lignes.length === 0 && <div className="text-text-dim">Aucun salarié actif sous contrat ce mois.</div>}

      {lot && lot.lignes.length > 0 && (
        <div className="border border-border bg-surface overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1.5">
                  {peutEcrire && emissibles.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label="Tout cocher"
                      checked={nbCoches === emissibles.length}
                      onChange={(e) => setCoches(Object.fromEntries(emissibles.map((l) => [l.salarieId, e.target.checked])))}
                    />
                  )}
                </th>
                <th className="px-2 py-1.5">Salarié</th>
                <th className="px-2 py-1.5 text-right">Total versé</th>
                <th className="px-2 py-1.5 text-right">Cotisations ouvrières</th>
                <th className="px-2 py-1.5 text-right">IRPP</th>
                <th className="px-2 py-1.5 text-right">Net à payer</th>
                <th className="px-2 py-1.5">Personnes à charge</th>
                <th className="px-2 py-1.5">Observations</th>
              </tr>
            </thead>
            <tbody>
              {lot.lignes.map((l) => (
                <tr key={l.salarieId} className="border-t border-border/60">
                  <td className={td}>
                    {l.etat === 'EMISSIBLE' && peutEcrire && (
                      <input
                        type="checkbox"
                        aria-label={`Émettre le bulletin de ${l.nomComplet}`}
                        checked={coches[l.salarieId] === true}
                        onChange={(e) => setCoches((c) => ({ ...c, [l.salarieId]: e.target.checked }))}
                      />
                    )}
                  </td>
                  <td className={td}>
                    {l.nomComplet}
                    {l.matricule ? <span className="text-text-dim"> · {l.matricule}</span> : null}
                  </td>
                  {l.etat === 'EMISSIBLE' || l.etat === 'NON_EMISSIBLE' ? (
                    <>
                      {(() => {
                        const r = recalculs[l.salarieId];
                        const v = r && 'verdict' in r && r.pour === (personnes[l.salarieId] ?? '') ? r.verdict : l.verdict;
                        return (
                          <>
                            <td className={`${td} text-right`}>{fc(v.totalVerseFc)}</td>
                            <td className={`${td} text-right`}>{fc(v.cotisationsTravailleurFc)}</td>
                            <td className={`${td} text-right`}>{fc(v.irppFc)}</td>
                            <td className={`${td} text-right`}>{fc(v.netAPayerFc)}</td>
                          </>
                        );
                      })()}
                      <td className={td}>
                        {l.etat === 'EMISSIBLE' ? (
                          <input
                            inputMode="numeric"
                            value={personnes[l.salarieId] ?? ''}
                            onChange={(e) => setPersonnes((p) => ({ ...p, [l.salarieId]: e.target.value }))}
                            onBlur={() => recalculer(l)}
                            disabled={!peutEcrire}
                            placeholder={l.personnesAChargeProposees === null ? 'Aucune' : `Registre · ${l.personnesAChargeProposees}`}
                            title="Nombre retenu par le cabinet (art. 124 et 125) · vide, aucune réduction"
                            className="border border-border px-1.5 py-0.5 w-[110px]"
                          />
                        ) : null}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className={td} />
                  )}
                  <td className={td}>
                    <Observations ligne={l} personnesSaisies={personnes[l.salarieId] ?? ''} recalcul={recalculs[l.salarieId]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lot && peutEcrire && emissibles.length > 0 && (
        <div className="flex items-center gap-3 mt-2.5">
          <button
            type="button"
            onClick={() => void emettre()}
            disabled={emission || nbCoches === 0}
            className="bg-sel text-white px-4 py-1.5 rounded-full disabled:opacity-50"
          >
            {emission ? 'Émission…' : `Émettre les ${nbCoches} bulletin(s) cochés`}
          </button>
        </div>
      )}
    </div>
  );
}

function Observations({
  ligne: l,
  personnesSaisies,
  recalcul,
}: {
  ligne: LigneLot;
  personnesSaisies: string;
  recalcul?: { pour: string; verdict: VerdictLot } | { pour: string; refus: string };
}) {
  if (l.etat === 'DEJA_EMIS') return <span className="text-text-dim">{l.motif}</span>;
  const textes: { t: string; grave: boolean }[] = [];
  for (const m of l.motifs) textes.push({ t: m, grave: true });
  for (const m of l.manques ?? []) textes.push({ t: m, grave: false });
  if (l.etat === 'EMISSIBLE' || l.etat === 'NON_EMISSIBLE') {
    for (const a of l.avertissements) textes.push({ t: a, grave: false });
    if (l.verdict.conversion) textes.push({ t: `Converti au cours du ${l.verdict.conversion.dateCours.slice(0, 10)} · ${fc(l.verdict.conversion.cours)} FC pour 1 USD.`, grave: false });
    // Le verdict affiché est calculé SANS personnes à charge · une saisie
    // sur la ligne change l'impôt et le net, que l'émission rejouera.
    if (personnesSaisies.trim() !== '') {
      if (recalcul && recalcul.pour === personnesSaisies && 'refus' in recalcul) textes.push({ t: recalcul.refus, grave: true });
      else if (!recalcul || recalcul.pour !== personnesSaisies) textes.push({ t: 'Personnes à charge saisies · montants non encore recalculés, l’émission les rejouera.', grave: false });
      else textes.push({ t: `Recalculé avec ${personnesSaisies} personne(s) à charge.`, grave: false });
    }
  }
  if (textes.length === 0) return <span className="text-text-dim">·</span>;
  return (
    <ul className="list-none">
      {textes.map((x, i) => (
        <li key={i} className={x.grave ? 'text-danger' : 'text-text-dim'}>
          {x.t}
        </li>
      ))}
    </ul>
  );
}
