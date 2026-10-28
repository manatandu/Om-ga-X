import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { libelleListeBornee } from '../../lib/liste-bornee-personnel';
import { montant as fc } from '../../lib/montants';

/**
 * LIGNE MICROFINA-M3, IDÉE 3 · L'ONGLET MISSIONS DE LA FENÊTRE PERSONNEL.
 * L'ordre de mission, ses frais qualifiés un à un, la fin constatée et
 * l'annulation. Les frais dus au travailleur se portent au bulletin depuis
 * l'onglet Simulation ; le sort de chaque frais vient du serveur
 * (`missions-salarie.ts`), jamais recalculé ici. Les boutons qui écrivent
 * suivent `peutEcrire`, comme les routes.
 */

type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };

export type FraisMissionLu = {
  id: string;
  element: 'HEBERGEMENT' | 'RESTAURATION' | 'TRANSPORT' | 'DIVERS';
  qualification: 'JUSTIFIE' | 'FORFAIT' | 'REGLE_PAR_ENTITE';
  montantFc: number;
  piece: string | null;
  libelle: string | null;
  sort: string;
};

export type MissionLue = {
  id: string;
  numero: number;
  salarieId: string;
  salarie: string;
  objet: string;
  lieuDepart: string | null;
  destination: string;
  dateDepart: string;
  dateRetour: string;
  moyenTransport: string | null;
  accomplieLe: string | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  bulletin: { numero: number; moisDePaie: string } | null;
  frais: FraisMissionLu[];
  totaux: { justifieFc: number; forfaitFc: number; regleParEntiteFc: number; totalFc: number };
};

const ELEMENT: Record<FraisMissionLu['element'], string> = {
  HEBERGEMENT: 'Hébergement',
  RESTAURATION: 'Restauration',
  TRANSPORT: 'Transport',
  DIVERS: 'Frais divers',
};
const QUALIFICATION: Record<FraisMissionLu['qualification'], string> = {
  JUSTIFIE: 'Remboursement sur pièce',
  FORFAIT: 'Indemnité forfaitaire',
  REGLE_PAR_ENTITE: "Payé directement par l'entité",
};

const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const nombre = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));
const champ = 'border border-border bg-transparent px-1.5 py-0.5';

export function OngletMissionsPaie({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  // Null tant que la liste n'est pas LUE · un échec ne se lit jamais « aucune mission ».
  const [liste, setListe] = useState<{ missions: MissionLue[]; total: number; tronque: boolean } | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [mission, setMission] = useState({ salarieId: '', objet: '', lieuDepart: '', destination: '', dateDepart: '', dateRetour: '', moyenTransport: '' });
  const [frais, setFrais] = useState<Record<string, { element: string; qualification: string; montantFc: string; piece: string }>>({});
  const [fin, setFin] = useState<Record<string, string>>({});

  const charger = useCallback(() => {
    api.get<{ missions: MissionLue[]; total: number; tronque: boolean }>('/personnel/missions').then(setListe, (e: ApiError) => {
      setListe(null);
      setErreur(e.message);
    });
  }, []);
  useEffect(charger, [charger]);

  const envoyer = async (fn: () => Promise<unknown>) => {
    setErreur('');
    setEnvoi(true);
    try {
      await fn();
      charger();
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Opération refusée');
      return false;
    } finally {
      setEnvoi(false);
    }
  };

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    const corps = {
      objet: mission.objet,
      destination: mission.destination,
      dateDepart: mission.dateDepart,
      dateRetour: mission.dateRetour,
      ...(mission.lieuDepart.trim() ? { lieuDepart: mission.lieuDepart } : {}),
      ...(mission.moyenTransport.trim() ? { moyenTransport: mission.moyenTransport } : {}),
    };
    if (await envoyer(() => api.post(`/personnel/salaries/${mission.salarieId}/missions`, corps))) {
      setMission((m) => ({ ...m, objet: '', lieuDepart: '', destination: '', dateDepart: '', dateRetour: '', moyenTransport: '' }));
    }
  };

  const fraisDe = (id: string) => frais[id] ?? { element: 'HEBERGEMENT', qualification: 'JUSTIFIE', montantFc: '', piece: '' };

  const ajouterFrais = async (m: MissionLue) => {
    const f = fraisDe(m.id);
    const corps = {
      element: f.element,
      qualification: f.qualification,
      montantFc: nombre(f.montantFc),
      ...(f.piece.trim() ? { piece: f.piece } : {}),
    };
    if (await envoyer(() => api.post(`/personnel/missions/${m.id}/frais`, corps))) {
      setFrais((x) => ({ ...x, [m.id]: { ...f, montantFc: '', piece: '' } }));
    }
  };

  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      {erreur && <div className="border border-danger/30 bg-danger-soft text-danger px-3 py-2">{erreur}</div>}
      <div className="font-semibold flex items-center gap-1.5">
        Ordres de mission
        <Aide
          titre="Missions et frais de mission"
          texte="Chaque frais se qualifie. Le remboursement d'une dépense effective, sur pièce, n'est ni rémunération ni revenu imposable ; l'indemnité forfaitaire est hors rémunération mais imposable. Les deux se portent au bulletin du mois depuis l'onglet Simulation et se passent au 6384 « Missions ». Une dépense réglée par l'entité elle-même se passe par sa facture et n'est suivie ici que pour le coût de la mission. La taxe qui grève hébergement, restauration et transport n'ouvre pas droit à déduction. Une mission portée par un bulletin émis ne change plus ; l'annulation du bulletin la rend."
          source="Code du travail, art. 7, point 8 · loi n° 23/053, art. 68, 1° · O.-L. n° 10/001, art. 41, 1° · fiche du compte 66 (AUDCIF, SYCEBNL)"
        />
      </div>
      {liste === null && !erreur && <div className="text-text-dim">Lecture des missions…</div>}
      {liste && liste.missions.length === 0 && <div className="text-text-dim">Aucune mission.</div>}
      {liste && libelleListeBornee(liste, liste.missions.length, 'missions') && (
        <div className="text-warning">{libelleListeBornee(liste, liste.missions.length, 'missions')}</div>
      )}
      {liste?.missions.map((m) => {
        const f = fraisDe(m.id);
        const ouverte = !m.annuleLe && !m.bulletin;
        return (
          <div key={m.id} className="border border-border px-3 py-2">
            <div className="flex flex-wrap gap-x-3 items-baseline">
              <span className="font-semibold">n° {m.numero}</span>
              <span>{m.salarie}</span>
              <span>
                {m.lieuDepart ? `${m.lieuDepart} → ` : ''}
                {m.destination}
              </span>
              <span className="text-text-dim">
                du {m.dateDepart} au {m.dateRetour}
                {m.moyenTransport ? ` · ${m.moyenTransport}` : ''}
              </span>
              <span>{m.objet}</span>
              {m.accomplieLe && <span className="text-text-dim">accomplie le {m.accomplieLe}</span>}
              {m.bulletin && <span className="text-text-dim">portée par le bulletin n° {m.bulletin.numero} ({m.bulletin.moisDePaie})</span>}
              {m.annuleLe && <span className="text-danger">annulée · {m.motifAnnulation}</span>}
            </div>
            <table className="w-full mt-1">
              <tbody>
                {m.frais.map((x) => (
                  <tr key={x.id} className="border-t border-border/40">
                    <td className="py-0.5 pr-2">{ELEMENT[x.element]}</td>
                    <td className="py-0.5 pr-2">{QUALIFICATION[x.qualification]}</td>
                    <td className="py-0.5 pr-2 text-text-dim">{x.piece ?? ''}</td>
                    <td className="py-0.5 pr-2 text-right">{fc(x.montantFc)}</td>
                    <td className="py-0.5 pr-2 text-[11px] text-text-dim" title={x.sort}>
                      {x.sort.split(' · ')[0]}
                    </td>
                    <td className="py-0.5 text-right">
                      {peutEcrire && ouverte && (
                        <button type="button" className="text-danger hover:underline" disabled={envoi} onClick={() => envoyer(() => api.delete(`/personnel/missions/frais/${x.id}`))}>
                          Retirer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td colSpan={3} className="py-0.5 pr-2">
                    Dû au travailleur {fc(m.totaux.justifieFc + m.totaux.forfaitFc)} · dont forfait imposable {fc(m.totaux.forfaitFc)}
                  </td>
                  <td className="py-0.5 pr-2 text-right">{fc(m.totaux.totalFc)}</td>
                  <td colSpan={2} className="py-0.5 text-[11px] font-normal text-text-dim">
                    coût de la mission
                  </td>
                </tr>
              </tbody>
            </table>
            {peutEcrire && ouverte && (
              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                <select aria-label={`Élément de frais de la mission ${m.numero}`} value={f.element} onChange={(e) => setFrais({ ...frais, [m.id]: { ...f, element: e.target.value } })} className={champ}>
                  {Object.entries(ELEMENT).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <select aria-label={`Qualification du frais de la mission ${m.numero}`} value={f.qualification} onChange={(e) => setFrais({ ...frais, [m.id]: { ...f, qualification: e.target.value } })} className={champ}>
                  {Object.entries(QUALIFICATION).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input aria-label={`Montant du frais de la mission ${m.numero}`} placeholder="Montant FC" value={f.montantFc} onChange={(e) => setFrais({ ...frais, [m.id]: { ...f, montantFc: e.target.value } })} className={`${champ} w-[110px] text-right`} />
                <input aria-label={`Pièce du frais de la mission ${m.numero}`} placeholder="Pièce justificative" value={f.piece} onChange={(e) => setFrais({ ...frais, [m.id]: { ...f, piece: e.target.value } })} className={`${champ} w-[180px]`} />
                <button type="button" className="hover:underline" disabled={envoi || !f.montantFc.trim()} onClick={() => ajouterFrais(m)}>
                  Ajouter le frais
                </button>
                {!m.accomplieLe && (
                  <>
                    <input aria-label={`Fin constatée de la mission ${m.numero}`} type="date" value={fin[m.id] ?? ''} onChange={(e) => setFin({ ...fin, [m.id]: e.target.value })} className={champ} />
                    <button type="button" className="hover:underline" disabled={envoi || !fin[m.id]} onClick={() => envoyer(() => api.patch(`/personnel/missions/${m.id}/fin`, { accomplieLe: fin[m.id] }))}>
                      Constater la fin
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="text-danger hover:underline ml-auto"
                  disabled={envoi}
                  onClick={() => {
                    const motif = window.prompt('Motif de l’annulation de la mission');
                    if (motif && motif.trim().length >= 3) void envoyer(() => api.post(`/personnel/missions/${m.id}/annulation`, { motif }));
                  }}
                >
                  Annuler la mission
                </button>
              </div>
            )}
          </div>
        );
      })}
      {peutEcrire && (
        <form onSubmit={creer} className="flex flex-wrap gap-1.5 items-center">
          <select aria-label="Salarié en mission" value={mission.salarieId} onChange={(e) => setMission({ ...mission, salarieId: e.target.value })} className={champ} required>
            <option value="">Salarié…</option>
            {salaries.map((s) => (
              <option key={s.id} value={s.id}>
                {nomDe(s)}
              </option>
            ))}
          </select>
          <input aria-label="Objet de la mission" placeholder="Objet" value={mission.objet} onChange={(e) => setMission({ ...mission, objet: e.target.value })} className={`${champ} w-[180px]`} required />
          <input aria-label="Lieu de départ" placeholder="Départ" value={mission.lieuDepart} onChange={(e) => setMission({ ...mission, lieuDepart: e.target.value })} className={`${champ} w-[110px]`} />
          <input aria-label="Destination" placeholder="Destination" value={mission.destination} onChange={(e) => setMission({ ...mission, destination: e.target.value })} className={`${champ} w-[120px]`} required />
          <input aria-label="Date de départ" type="date" value={mission.dateDepart} onChange={(e) => setMission({ ...mission, dateDepart: e.target.value })} className={champ} required />
          <input aria-label="Date de retour" type="date" value={mission.dateRetour} onChange={(e) => setMission({ ...mission, dateRetour: e.target.value })} className={champ} required />
          <input aria-label="Moyen de transport" placeholder="Transport" value={mission.moyenTransport} onChange={(e) => setMission({ ...mission, moyenTransport: e.target.value })} className={`${champ} w-[110px]`} />
          <button type="submit" className="bg-sel text-white font-semibold px-3 py-1" disabled={envoi}>
            Ordonner la mission
          </button>
        </form>
      )}
    </div>
  );
}
