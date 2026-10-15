import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { BoutonsPaie as Boutons, CHAMP_PAIE, ChampPaie, ModalePaie, useEnvoiPaie as useEnvoi } from './ModalePaie';
import { dateCourte, jours } from '../../lib/conges-paie';
import { montant as fc } from '../../lib/montants';
import {
  LIBELLE_REGIME,
  LIBELLE_TRAITEMENT,
  traitementsOuverts,
  type AbsenceLue,
  type Catalogue,
  type IndemniteCaisseLue,
  type TraitementIndemniteCaisse,
} from '../../lib/absences-paie';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 1 · L'ONGLET ABSENCES DE LA FENÊTRE
 * PERSONNEL. Les natures, leur texte et leur régime sont SERVIS par le
 * serveur (`GET /personnel/absences/catalogue`), jamais recopiés ici. Les
 * boutons qui écrivent suivent `peutEcrire`, comme les routes.
 */

type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };
type Modale =
  | { genre: 'declarer' }
  | { genre: 'annuler'; absence: AbsenceLue }
  | { genre: 'caisse'; absence: AbsenceLue }
  | { genre: 'annulerCaisse'; indemnite: IndemniteCaisseLue };

const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');

export function OngletAbsencesPaie({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  const [salarieId, setSalarieId] = useState(salaries.length === 1 ? salaries[0].id : '');
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  // Null tant que la liste n'est pas LUE · un échec ne se lit jamais « aucune absence ».
  const [liste, setListe] = useState<{ absences: AbsenceLue[]; total: number; tronque: boolean } | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [modale, setModale] = useState<Modale | null>(null);
  const jeton = useRef(0);

  useEffect(() => {
    if (!salarieId && salaries.length === 1) setSalarieId(salaries[0].id);
  }, [salaries, salarieId]);

  useEffect(() => {
    api.get<Catalogue>('/personnel/absences/catalogue').then(setCatalogue, (e: ApiError) => setErreur(e.message));
  }, []);

  const charger = useCallback(() => {
    const j = ++jeton.current;
    if (!salarieId) {
      setListe(null);
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur('');
    api.get<{ absences: AbsenceLue[]; total: number; tronque: boolean }>(`/personnel/salaries/${salarieId}/absences`).then(
      (r) => {
        if (j !== jeton.current) return;
        setListe(r);
        setChargement(false);
      },
      (e: ApiError) => {
        if (j !== jeton.current) return;
        setListe(null);
        setErreur(e.message);
        setChargement(false);
      },
    );
  }, [salarieId]);
  useEffect(charger, [charger]);

  const evenement = (cle: string | null) => catalogue?.evenements.find((e) => e.cle === cle)?.libelle ?? cle;

  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Salarié</span>
          <select aria-label="Salarié" value={salarieId} onChange={(e) => setSalarieId(e.target.value)} className={`${CHAMP_PAIE} min-w-[220px]`}>
            <option value="">Choisir…</option>
            {salaries.map((s) => (
              <option key={s.id} value={s.id}>
                {nomDe(s)}
              </option>
            ))}
          </select>
        </label>
        {peutEcrire && salarieId && liste && catalogue && (
          <button type="button" className="bg-sel text-white font-semibold px-3 py-1 rounded-full" onClick={() => setModale({ genre: 'declarer' })}>
            Déclarer une absence
          </button>
        )}
        <span className="ml-auto self-center">
          <Aide
            titre="Absences du personnel"
            texte="Chaque absence porte sa cause, telle que le Code du travail la nomme, et ce que l'employeur doit pour ses jours. Maladie ou accident, accident du travail et maternité · les deux tiers de la rémunération (l'accident du travail, les six premiers mois). Congé de circonstance · payé, jusqu'à quinze jours ouvrables par an, aux jours fixés par événement, sans fractionnement. Absence non autorisée · non payée, la rémunération n'étant due que pour le temps de service. Empêchement du fait de l'employeur · payé. Mise à pied, obligations militaires, réquisition, mandat public, grève, incarcération · les droits des parties sont fixés par un arrêté qui n'est pas au corpus, rien n'est chiffré. Force majeure · rien n'est dû. Les jours se comptent en jours ouvrables (fériés exclus, restés payés) ; une demi-journée se déclare au premier ou au dernier jour. Les absences hors service rendent le mois de congé non entier ; l'incapacité compte comme service jusqu'à six mois par année de service. L'onglet Simulation propose le salaire du mois et l'indemnité d'incapacité, à reprendre au clic."
            source="Code du travail, art. 7 point 9, 57 à 59, 93, 105, 106, 130, 141 et 146"
          />
        </span>
      </div>

      {erreur && (
        <div role="alert" className="border border-danger/30 bg-danger-soft text-danger px-3 py-2">
          {erreur}
        </div>
      )}
      {!salarieId &&
        (salaries.length === 0 ? (
          <div className="text-text-dim">Aucun salarié au registre · inscrivez-le d'abord dans l'onglet Registre.</div>
        ) : (
          <div className="text-text-dim">Choisissez un salarié pour lire ses absences.</div>
        ))}
      {chargement && <div className="text-text-dim">Lecture des absences…</div>}

      {liste && (
        <section>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Cause</th>
                  <th className="text-left px-2 py-1">Du</th>
                  <th className="text-left px-2 py-1">Au</th>
                  <th className="text-right px-2 py-1">Jours ouvrables</th>
                  <th className="text-left px-2 py-1">Rémunération</th>
                  <th className="text-left px-2 py-1">Pièce</th>
                  <th className="px-2 py-1 w-[200px]" />
                </tr>
              </thead>
              <tbody>
                {liste.absences.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-1 text-text-dim">
                      Aucune absence déclarée.
                    </td>
                  </tr>
                )}
                {liste.absences.map((a) => (
                  <tr key={a.id} className={a.annuleLe ? 'text-text-dim' : ''}>
                    <td className="px-2 py-1" title={a.fondement}>
                      {a.libelle}
                      {a.evenement && <span className="text-text-dim"> · {evenement(a.evenement)}</span>}
                      {a.annuleLe && (
                        <span className="text-text-dim" title={a.motifAnnulation ?? undefined}>
                          {' '}
                          · annulée
                        </span>
                      )}
                      {a.informations.map((t, i) => (
                        <div key={i} className="text-[11px] text-warning">
                          {t}
                        </div>
                      ))}
                      {a.indemnitesCaisse.map((ij) => (
                        <div key={ij.id} className={`text-[11px] ${ij.annuleLe ? 'text-text-dim line-through' : 'text-text-dim'}`}>
                          Caisse {ij.mois} · {fc(ij.montant)} · {LIBELLE_TRAITEMENT[ij.traitement]} · {ij.piece}
                          {peutEcrire && !ij.annuleLe && (
                            <button
                              type="button"
                              className="ml-2 text-danger hover:underline no-underline"
                              onClick={() => setModale({ genre: 'annulerCaisse', indemnite: ij })}
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="px-2 py-1">
                      {dateCourte(a.du)}
                      {a.demiJourneeDebut ? ' (demi-journée)' : ''}
                    </td>
                    <td className="px-2 py-1">
                      {dateCourte(a.au)}
                      {a.demiJourneeFin && a.du !== a.au ? ' (demi-journée)' : ''}
                    </td>
                    <td className="px-2 py-1 text-right">{jours(a.joursOuvrables)}</td>
                    <td className="px-2 py-1">{LIBELLE_REGIME[a.regime]}</td>
                    <td className="px-2 py-1">{a.piece ?? ''}</td>
                    <td className="px-2 py-1 text-right">
                      {peutEcrire && !a.annuleLe && traitementsOuverts(a.nature).length > 0 && (
                        <button type="button" className="text-sel hover:underline mr-2" onClick={() => setModale({ genre: 'caisse', absence: a })}>
                          Indemnité de la Caisse
                        </button>
                      )}
                      {peutEcrire && !a.annuleLe && (
                        <button type="button" className="text-danger hover:underline" onClick={() => setModale({ genre: 'annuler', absence: a })}>
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {liste.tronque && <div className="text-warning mt-1">Liste tronquée · {liste.absences.length} absences lues sur {liste.total}.</div>}
        </section>
      )}

      {modale?.genre === 'declarer' && catalogue && (
        <ModaleDeclarer
          salarieId={salarieId}
          catalogue={catalogue}
          onFermer={() => setModale(null)}
          onFait={() => {
            setModale(null);
            charger();
          }}
        />
      )}
      {modale?.genre === 'caisse' && (
        <ModaleCaisse
          absence={modale.absence}
          onFermer={() => setModale(null)}
          onFait={() => {
            setModale(null);
            charger();
          }}
        />
      )}
      {modale?.genre === 'annulerCaisse' && (
        <ModaleMotif
          titre={`Annuler l'indemnité de la Caisse de ${modale.indemnite.mois}`}
          valider="Annuler l'indemnité"
          chemin={`/personnel/indemnites-caisse/${modale.indemnite.id}/annulation`}
          onFermer={() => setModale(null)}
          onFait={() => {
            setModale(null);
            charger();
          }}
        />
      )}
      {modale?.genre === 'annuler' && (
        <ModaleAnnuler
          absence={modale.absence}
          onFermer={() => setModale(null)}
          onFait={() => {
            setModale(null);
            charger();
          }}
        />
      )}
    </div>
  );
}

function ModaleDeclarer({ salarieId, catalogue, onFermer, onFait }: { salarieId: string; catalogue: Catalogue; onFermer: () => void; onFait: () => void }) {
  const [f, setF] = useState({ nature: '', du: '', au: '', demiDebut: false, demiFin: false, evenement: '', piece: '', observation: '' });
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const def = catalogue.natures.find((n) => n.cle === f.nature) ?? null;
  const valider = () => {
    if (!f.nature || !f.du || !f.au) {
      setErreur("La cause et les deux dates de l'absence se déclarent.");
      return;
    }
    void envoyer(() =>
      api.post(`/personnel/salaries/${salarieId}/absences`, {
        nature: f.nature,
        du: f.du,
        au: f.au,
        ...(def?.demiJournees && f.demiDebut ? { demiJourneeDebut: true } : {}),
        ...(def?.demiJournees && f.demiFin ? { demiJourneeFin: true } : {}),
        ...(f.nature === 'CONGE_DE_CIRCONSTANCE' && f.evenement ? { evenement: f.evenement } : {}),
        ...(f.piece.trim() ? { piece: f.piece.trim() } : {}),
        ...(f.observation.trim() ? { observation: f.observation.trim() } : {}),
      }),
    );
  };
  return (
    <ModalePaie
      titre="Déclarer une absence"
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<Boutons envoi={envoi} onFermer={onFermer} valider="Déclarer" />}
    >
      <ChampPaie libelle="Cause">
        <select value={f.nature} onChange={(e) => setF({ ...f, nature: e.target.value })} className={CHAMP_PAIE}>
          <option value="">Choisir…</option>
          {catalogue.natures.map((n) => (
            <option key={n.cle} value={n.cle}>
              {n.libelle}
            </option>
          ))}
        </select>
      </ChampPaie>
      {def && (
        <div className="text-text-dim" title={def.fondement}>
          Rémunération · {LIBELLE_REGIME[def.regime]}
        </div>
      )}
      {f.nature === 'CONGE_DE_CIRCONSTANCE' && (
        <ChampPaie libelle="Événement">
          <select value={f.evenement} onChange={(e) => setF({ ...f, evenement: e.target.value })} className={CHAMP_PAIE}>
            <option value="">Choisir…</option>
            {catalogue.evenements.map((e) => (
              <option key={e.cle} value={e.cle}>
                {e.libelle} · {e.jours} jour(s)
              </option>
            ))}
          </select>
        </ChampPaie>
      )}
      <ChampPaie libelle="Premier jour">
        <input type="date" value={f.du} onChange={(e) => setF({ ...f, du: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Dernier jour">
        <input type="date" value={f.au} onChange={(e) => setF({ ...f, au: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      {def?.demiJournees && (
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.demiDebut} onChange={(e) => setF({ ...f, demiDebut: e.target.checked })} />
            Demi-journée au premier jour
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.demiFin} onChange={(e) => setF({ ...f, demiFin: e.target.checked })} />
            Demi-journée au dernier jour
          </label>
        </div>
      )}
      <ChampPaie libelle={def?.piece ? `Pièce (${def.piece})` : 'Pièce'}>
        <input value={f.piece} onChange={(e) => setF({ ...f, piece: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Observation">
        <textarea rows={2} value={f.observation} onChange={(e) => setF({ ...f, observation: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}

function ModaleAnnuler({ absence, onFermer, onFait }: { absence: AbsenceLue; onFermer: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const valider = () => {
    if (motif.trim().length < 3) {
      setErreur("Une absence s'annule avec son motif.");
      return;
    }
    void envoyer(() => api.post(`/personnel/absences/${absence.id}/annulation`, { motif: motif.trim() }));
  };
  return (
    <ModalePaie
      titre={`Annuler l'absence du ${dateCourte(absence.du)} au ${dateCourte(absence.au)}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<Boutons envoi={envoi} onFermer={onFermer} valider="Annuler l'absence" />}
    >
      <ChampPaie libelle="Motif">
        <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}

function ModaleCaisse({ absence, onFermer, onFait }: { absence: AbsenceLue; onFermer: () => void; onFait: () => void }) {
  const ouverts = traitementsOuverts(absence.nature);
  const [f, setF] = useState<{ mois: string; montant: string; traitement: string; piece: string }>({ mois: absence.du.slice(0, 7), montant: '', traitement: ouverts[0] ?? '', piece: '' });
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const valider = () => {
    const montant = Number(f.montant.replace(/\s/g, '').replace(',', '.'));
    if (!f.mois || !Number.isFinite(montant) || montant <= 0 || !f.traitement || f.piece.trim().length < 3) {
      setErreur('Le mois, le montant, le traitement et la pièce de la Caisse se déclarent ensemble.');
      return;
    }
    void envoyer(() =>
      api.post(`/personnel/absences/${absence.id}/indemnites-caisse`, {
        mois: f.mois,
        montant,
        traitement: f.traitement as TraitementIndemniteCaisse,
        piece: f.piece.trim(),
      }),
    );
  };
  return (
    <ModalePaie
      titre={`Indemnité de la Caisse · ${absence.libelle.toLowerCase()} du ${dateCourte(absence.du)}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<Boutons envoi={envoi} onFermer={onFermer} valider="Déclarer" />}
    >
      <ChampPaie libelle="Mois">
        <input type="month" value={f.mois} onChange={(e) => setF({ ...f, mois: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Montant versé par la Caisse">
        <input inputMode="decimal" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Traitement">
        <select value={f.traitement} onChange={(e) => setF({ ...f, traitement: e.target.value })} className={CHAMP_PAIE}>
          {ouverts.map((t) => (
            <option key={t} value={t}>
              {LIBELLE_TRAITEMENT[t]}
            </option>
          ))}
        </select>
      </ChampPaie>
      <ChampPaie libelle="Pièce de la Caisse">
        <input placeholder="Décision, bordereau de paiement" value={f.piece} onChange={(e) => setF({ ...f, piece: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}

function ModaleMotif({ titre, valider: libelleValider, chemin, onFermer, onFait }: { titre: string; valider: string; chemin: string; onFermer: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const valider = () => {
    if (motif.trim().length < 3) {
      setErreur("L'annulation se fait avec son motif.");
      return;
    }
    void envoyer(() => api.post(chemin, { motif: motif.trim() }));
  };
  return (
    <ModalePaie titre={titre} envoi={envoi} erreur={erreur} onFermer={onFermer} onValider={valider} pied={<Boutons envoi={envoi} onFermer={onFermer} valider={libelleValider} />}>
      <ChampPaie libelle="Motif">
        <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}
