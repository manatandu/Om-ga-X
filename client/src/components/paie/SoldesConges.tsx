import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { jours } from '../../lib/conges-paie';
import { Aide } from '../chrome/Aide';

interface LigneSolde {
  salarieId: string;
  nomComplet: string;
  matricule: string | null;
  refus: string | null;
  droitsNes: number | null;
  pris: number | null;
  solde: number | null;
  enCours: number | null;
  signaux: string[];
}

interface Soldes {
  aLa: string | null;
  lignes: LigneSolde[];
  total: number;
  tronque: boolean;
  plafond: number;
}

/**
 * LIGNE PAIE-LOT · L'ÉTAT DES SOLDES DE CONGÉS du personnel actif à une date.
 * Chaque ligne est le compteur du salarié (onglet Congés), lu par le serveur ·
 * rien n'est recalculé ici, et un solde non chiffré se dit « · », jamais zéro.
 */
export function OngletSoldesConges() {
  const [aLa, setALa] = useState('');
  const [soldes, setSoldes] = useState<Soldes | null>(null);
  const [erreur, setErreur] = useState('');
  const jeton = useRef(0);

  useEffect(() => {
    if (aLa !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(aLa)) return;
    const j = ++jeton.current;
    setErreur('');
    setSoldes(null);
    api.get<Soldes>(`/personnel/soldes-conges${aLa ? `?ala=${aLa}` : ''}`).then(
      (r) => j === jeton.current && setSoldes(r),
      (e: ApiError) => j === jeton.current && setErreur(e.message),
    );
  }, [aLa]);

  const td = 'px-2 py-1 align-top';
  return (
    <div className="max-w-[1240px] text-[11.5px]">
      <div className="ecran-seul flex flex-wrap items-center gap-3 mb-2.5">
        <label className="flex items-center gap-2">
          Soldes au
          <input type="date" value={aLa} onChange={(e) => setALa(e.target.value)} className="border border-border px-2 py-1" />
        </label>
        {soldes && (
          <span className="text-text-dim">
            {soldes.lignes.length} salarié(s) actif(s)
            {soldes.tronque ? ` sur ${soldes.total} · les ${soldes.plafond} premiers seulement` : ''}
          </span>
        )}
        <button type="button" onClick={() => window.print()} disabled={!soldes} className="border border-border px-3 py-1 disabled:opacity-50">
          Imprimer
        </button>
        <Aide
          titre="Soldes de congés"
          texte="Le compteur de chaque salarié actif, à la date choisie (aujourd’hui à Kinshasa si elle est vide) · droits nés des années de service révolues, congés pris ou posés depuis, solde, et jours de la période en cours qui ne sont pas encore nés. Un mois sans bulletin émis n’acquiert rien tant qu’il n’est pas payé ; un compteur qui ne se calcule pas dit pourquoi."
          source="Code du travail, art. 140 et 141"
        />
      </div>
      {erreur && <div className="border border-danger/30 bg-danger-soft px-3.5 py-2 mb-2.5">{erreur}</div>}
      {!soldes && !erreur && <div className="text-text-dim">Lecture…</div>}
      {soldes && (
        <div className="border border-border bg-surface overflow-x-auto">
          <div className="px-2 py-1.5 font-semibold">Soldes de congés au {soldes.aLa ? new Date(`${soldes.aLa}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '·'}</div>
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1.5">Salarié</th>
                <th className="px-2 py-1.5 text-right">Droits nés</th>
                <th className="px-2 py-1.5 text-right">Pris ou posés</th>
                <th className="px-2 py-1.5 text-right">Solde</th>
                <th className="px-2 py-1.5 text-right">En cours d’acquisition</th>
                <th className="px-2 py-1.5">Observations</th>
              </tr>
            </thead>
            <tbody>
              {soldes.lignes.length === 0 && (
                <tr>
                  <td colSpan={6} className={`${td} text-text-dim`}>
                    Aucun salarié actif au registre.
                  </td>
                </tr>
              )}
              {soldes.lignes.map((l) => (
                <tr key={l.salarieId} className="border-t border-border/60">
                  <td className={td}>
                    {l.nomComplet}
                    {l.matricule ? <span className="text-text-dim"> · {l.matricule}</span> : null}
                  </td>
                  <td className={`${td} text-right`}>{jours(l.droitsNes)}</td>
                  <td className={`${td} text-right`}>{jours(l.pris)}</td>
                  <td className={`${td} text-right ${l.solde !== null && l.solde < 0 ? 'text-danger' : ''}`}>{jours(l.solde)}</td>
                  <td className={`${td} text-right`}>{jours(l.enCours)}</td>
                  <td className={td}>
                    {l.refus && <div className="text-danger">{l.refus}</div>}
                    {l.signaux.map((s, i) => (
                      <div key={i} className="text-text-dim">
                        {s}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
