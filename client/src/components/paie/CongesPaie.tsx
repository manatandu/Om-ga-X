import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { montant } from '../../lib/montants';
import { Aide } from '../chrome/Aide';
import { CHAMP_PAIE, ChampPaie, ModalePaie } from './ModalePaie';
import {
  dateCourte,
  etatConge,
  jours,
  LIBELLE_ETAT_PERIODE,
  LIBELLE_STATUT_MOIS,
  lireNombre,
  moisDuDepart,
  type CongeLu,
  type PeriodeDeConges,
  type Propositions,
  type ReponseConges,
} from '../../lib/conges-paie';

/**
 * LIGNE SAGE-L5, FONCTION 79 · L'ONGLET CONGÉS DE LA FENÊTRE PERSONNEL. Le
 * compteur, la reprise et les congés pris d'un salarié, lus au serveur à une
 * date ; rien n'est recalculé ici. Les boutons qui écrivent suivent
 * `peutEcrire`, comme les routes (admin, comptable, gestionnaire de paie).
 */

type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };
type Modale = { genre: 'reprise' } | { genre: 'conge' } | { genre: 'allocation'; conge: CongeLu } | { genre: 'annulation'; conge: CongeLu };

const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const porteParUnBulletin = (c: CongeLu) => c.bulletin?.statut === 'EMIS';

export function OngletCongesPaie({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  const [salarieId, setSalarieId] = useState(salaries.length === 1 ? salaries[0].id : '');
  const [aLa, setALa] = useState(aujourdhui());
  // Null tant que le compteur n'est pas LU · un échec ne se lit jamais comme
  // « aucun congé ».
  const [donnees, setDonnees] = useState<ReponseConges | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [modale, setModale] = useState<Modale | null>(null);
  // Une réponse périmée (salarié ou date changés entre-temps) est jetée.
  const jeton = useRef(0);

  useEffect(() => {
    if (!salarieId && salaries.length === 1) setSalarieId(salaries[0].id);
  }, [salaries, salarieId]);

  const charger = useCallback(() => {
    const j = ++jeton.current;
    setOuverte(null);
    if (!salarieId) {
      setDonnees(null);
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur('');
    api.get<ReponseConges>(`/personnel/salaries/${salarieId}/conges${aLa ? `?ala=${aLa}` : ''}`).then(
      (r) => {
        if (j !== jeton.current) return;
        setDonnees(r);
        setChargement(false);
      },
      (e: ApiError) => {
        if (j !== jeton.current) return;
        setDonnees(null);
        setErreur(e.message);
        setChargement(false);
      },
    );
  }, [salarieId, aLa]);
  useEffect(charger, [charger]);

  const apresGeste = () => {
    setModale(null);
    charger();
  };

  const compteur = donnees && !('refus' in donnees.compteur) ? donnees.compteur : null;
  const refusCompteur = donnees && 'refus' in donnees.compteur ? donnees.compteur.refus : null;

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
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">À la date</span>
          <input aria-label="Date de lecture du compteur" type="date" value={aLa} onChange={(e) => setALa(e.target.value)} className={CHAMP_PAIE} />
        </label>
        {peutEcrire && salarieId && donnees && (
          <>
            <button type="button" className="bg-sel text-white font-semibold px-3 py-1 rounded-full" onClick={() => setModale({ genre: 'conge' })}>
              Poser un congé
            </button>
            <button type="button" className="border border-border px-3 py-1" onClick={() => setModale({ genre: 'reprise' })}>
              {donnees.reprise ? 'Corriger la reprise' : 'Déclarer la reprise'}
            </button>
          </>
        )}
        <span className="ml-auto self-center">
          <Aide
            titre="Congés acquis chaque mois"
            texte="Le compteur suit l'année de services de date à date depuis l'entrée en service. Chaque mois entier de service, couvert par un bulletin émis et sans jour hors service, acquiert un jour ouvrable de congé (un jour et demi avant dix-huit ans) ; chaque tranche de cinq années d'ancienneté ajoute un jour, due entière à la période qui compte au moins un mois. Le droit naît à l'expiration de l'année · le solde ne compte que les droits nés, la période en cours est dite en cours d'acquisition. Un congé se compte en jours ouvrables (du lundi au samedi, fériés exclus), sans les jours de voyage ni de maladie. Son allocation est la rémunération journalière plus la moyenne mensuelle des douze mois de commissions, primes, prestations supplémentaires et participation, ramenée au jour à 1/26 · le même calcul que l'indemnité compensatoire du décompte final. Elle se paie au départ, au plus tard le dernier jour ouvrable qui le précède, et le bulletin du mois choisi la porte. Les droits acquis avant OmegaX se déclarent par la reprise, avec leur source. La continuité du service (contrats renouvelés ou qui se suivent sans un jour d'écart) est une convention d'OmegaX."
            source="Code du travail, art. 7 point 9, 140 à 145 · décret n° 25/22, art. 7, par analogie · décision T6 du 2026-10-07"
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
          <div className="text-text-dim">Choisissez un salarié pour lire son compteur de congés.</div>
        ))}
      {chargement && <div className="text-text-dim">Lecture du compteur…</div>}

      {donnees && (
        <>
          {refusCompteur && <div className="border border-warning/30 bg-warning-soft text-warning px-3 py-2">{refusCompteur}</div>}

          {compteur && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { cle: 'nes', titre: 'Droits nés', valeur: compteur.droitsNes },
                  { cle: 'pris', titre: 'Pris', valeur: compteur.pris },
                  { cle: 'solde', titre: 'Solde', valeur: compteur.solde },
                  { cle: 'encours', titre: "En cours d'acquisition", valeur: compteur.enCours },
                ].map((b) => (
                  <div key={b.cle} className="border border-border bg-surface px-3 py-2">
                    <div className="text-text-dim">{b.titre}</div>
                    <div className={`text-[15px] font-semibold ${b.cle === 'solde' && (b.valeur ?? 0) < 0 ? 'text-danger' : ''}`}>
                      {b.valeur === null ? 'Non chiffré' : `${jours(b.valeur)} j`}
                    </div>
                  </div>
                ))}
              </div>
              {compteur.signaux.length > 0 && (
                <ul className="border border-warning/30 bg-warning-soft text-warning px-3 py-2 space-y-0.5">
                  {compteur.signaux.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}

              <section>
                <div className="font-semibold mb-1">Périodes de services</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1">Période</th>
                        <th className="text-left px-2 py-1">État</th>
                        <th className="text-right px-2 py-1">Mois acquis</th>
                        <th className="text-right px-2 py-1">Jours des mois</th>
                        <th className="text-right px-2 py-1">Ancienneté</th>
                        <th className="text-right px-2 py-1">Jours acquis</th>
                        <th className="px-2 py-1 w-[90px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {compteur.periodes.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-2 py-1 text-text-dim">
                            Aucune période de services à cette date.
                          </td>
                        </tr>
                      )}
                      {compteur.periodes.map((p) => (
                        <PeriodeLigne key={p.rang} periode={p} ouverte={ouverte === p.rang} basculer={() => setOuverte(ouverte === p.rang ? null : p.rang)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <section>
            <div className="font-semibold mb-1">Reprise des congés acquis avant OmegaX</div>
            {donnees.reprise ? (
              <div>
                Arrêtée au {dateCourte(donnees.reprise.arreteAu)} · {jours(donnees.reprise.joursNesNonPris)} jour(s) nés non pris ·{' '}
                {donnees.reprise.moisEnCoursAccomplis} mois accomplis dans la période en cours ·{' '}
                <span className="text-text-dim">
                  source {donnees.reprise.source} · déclarée par {donnees.reprise.declarePar}
                </span>
                {compteur && compteur.congesAvantReprise.length > 0 && (
                  <div className="text-warning">
                    {compteur.congesAvantReprise.length} congé(s) daté(s) avant la reprise · la reprise les compte déjà, ils ne se retranchent pas une seconde fois.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-text-dim">Aucune reprise déclarée.</div>
            )}
          </section>

          <section>
            <div className="font-semibold mb-1">Congés</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1">Du</th>
                    <th className="text-left px-2 py-1">Au</th>
                    <th className="text-right px-2 py-1">Jours</th>
                    <th className="text-left px-2 py-1">Bulletin</th>
                    <th className="text-right px-2 py-1">Allocation</th>
                    <th className="text-left px-2 py-1">État</th>
                    <th className="px-2 py-1 w-[150px]" />
                  </tr>
                </thead>
                <tbody>
                  {donnees.conges.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-1 text-text-dim">
                        Aucun congé posé.
                      </td>
                    </tr>
                  )}
                  {donnees.conges.map((c) => {
                    const ouvert = !c.annuleLe && !porteParUnBulletin(c);
                    return (
                      <tr key={c.id} className={c.annuleLe ? 'text-text-dim' : ''}>
                        <td className="px-2 py-1">{dateCourte(c.du)}</td>
                        <td className="px-2 py-1">{dateCourte(c.au)}</td>
                        <td className="px-2 py-1 text-right" title={c.joursVoyage ? `${c.joursVoyage} jour(s) de voyage retranché(s)` : undefined}>
                          {jours(c.allocation.jours)}
                        </td>
                        <td className="px-2 py-1">{c.moisDePaie}</td>
                        <td className="px-2 py-1 text-right">
                          {c.allocation.montant === null ? (
                            <span className="text-warning" title={c.allocation.motif ?? undefined}>
                              Non chiffrée
                            </span>
                          ) : (
                            `${montant(c.allocation.montant)} ${c.allocation.devise ?? ''}`
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <span title={c.annuleLe ? (c.motifAnnulation ?? undefined) : undefined}>{etatConge(c)}</span>
                          {c.auDelaDuSolde && (
                            <span className="text-warning" title={c.motifAuDelaDuSolde ?? undefined}>
                              {' '}
                              · au-delà du solde
                            </span>
                          )}
                          {ouvert && c.paiementAuPlusTard && (
                            <div className="text-[11px] text-text-dim">À payer au plus tard le {dateCourte(c.paiementAuPlusTard)}</div>
                          )}
                          {ouvert && c.allocation.montant === null && c.allocation.motif && (
                            <div className="text-[11px] text-warning">{c.allocation.motif}</div>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          {peutEcrire && ouvert && (
                            <>
                              <button type="button" className="text-sel hover:underline" onClick={() => setModale({ genre: 'allocation', conge: c })}>
                                Allocation
                              </button>{' '}
                              <button type="button" className="text-danger hover:underline" onClick={() => setModale({ genre: 'annulation', conge: c })}>
                                Annuler
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {donnees.tronque && <div className="text-warning mt-1">Liste tronquée · seuls les {donnees.conges.length} premiers congés sont lus.</div>}
          </section>
        </>
      )}

      {modale?.genre === 'reprise' && donnees && (
        <ModaleReprise salarieId={salarieId} reprise={donnees.reprise} onFermer={() => setModale(null)} onFait={apresGeste} />
      )}
      {modale?.genre === 'conge' && <ModaleConge salarieId={salarieId} onFermer={() => setModale(null)} onFait={apresGeste} />}
      {modale?.genre === 'allocation' && (
        <ModaleAllocation salarieId={salarieId} conge={modale.conge} onFermer={() => setModale(null)} onFait={apresGeste} />
      )}
      {modale?.genre === 'annulation' && <ModaleAnnulation conge={modale.conge} onFermer={() => setModale(null)} onFait={apresGeste} />}
    </div>
  );
}

function PeriodeLigne({ periode: p, ouverte, basculer }: { periode: PeriodeDeConges; ouverte: boolean; basculer: () => void }) {
  return (
    <>
      <tr>
        <td className="px-2 py-1">
          {dateCourte(p.du)} au {dateCourte(p.au)}
        </td>
        <td className="px-2 py-1">{LIBELLE_ETAT_PERIODE[p.etat]}</td>
        <td className="px-2 py-1 text-right">{p.moisAcquis}</td>
        <td className="px-2 py-1 text-right">{jours(p.joursDeBase)}</td>
        <td className="px-2 py-1 text-right">{jours(p.joursDAnciennete)}</td>
        <td className="px-2 py-1 text-right font-semibold">{jours(p.joursAcquis)}</td>
        <td className="px-2 py-1 text-right">
          <button type="button" aria-expanded={ouverte} className="text-sel hover:underline" onClick={basculer}>
            {ouverte ? 'Masquer' : 'Détail'}
          </button>
        </td>
      </tr>
      {ouverte && (
        <tr>
          <td colSpan={7} className="px-2 py-1 bg-surface-alt">
            <ul className="space-y-0.5">
              {p.mois.map((m) => (
                <li key={m.du} className={m.statut === 'ACQUIS' || m.statut === 'REPRIS' ? '' : 'text-text-dim'}>
                  {dateCourte(m.du)} au {dateCourte(m.au)} · {LIBELLE_STATUT_MOIS[m.statut]}
                  {m.jours !== null && m.statut === 'ACQUIS' ? ` · ${jours(m.jours)} j` : ''}
                  {m.motif ? ` · ${m.motif}` : ''}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

/** L'envoi d'une modale · l'erreur du serveur reste dans la modale, avec son motif. */
function useEnvoi(onFait: () => void) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoyer = async (fn: () => Promise<unknown>) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await fn();
      setEnvoi(false);
      onFait();
    } catch (e) {
      setEnvoi(false);
      setErreur(e instanceof ApiError ? e.message : 'Opération refusée.');
    }
  };
  return { envoi, erreur, setErreur, envoyer };
}

function BoutonsModale({ envoi, onFermer, valider }: { envoi: boolean; onFermer: () => void; valider: string }) {
  return (
    <>
      <button type="button" className="border border-border px-3 py-1" disabled={envoi} onClick={onFermer}>
        Fermer
      </button>
      <button type="submit" className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-50" disabled={envoi}>
        {envoi ? 'Envoi…' : valider}
      </button>
    </>
  );
}

function ModaleReprise({
  salarieId,
  reprise,
  onFermer,
  onFait,
}: {
  salarieId: string;
  reprise: ReponseConges['reprise'];
  onFermer: () => void;
  onFait: () => void;
}) {
  const [f, setF] = useState({
    arreteAu: reprise?.arreteAu ?? '',
    joursNesNonPris: reprise ? String(reprise.joursNesNonPris) : '',
    moisEnCoursAccomplis: reprise ? String(reprise.moisEnCoursAccomplis) : '',
    source: reprise?.source ?? '',
  });
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const valider = () => {
    const nes = lireNombre(f.joursNesNonPris);
    const mois = lireNombre(f.moisEnCoursAccomplis);
    if (!f.arreteAu || nes === undefined || mois === undefined || f.source.trim().length < 3) {
      setErreur('La date, les jours nés non pris, les mois accomplis et la source se déclarent ensemble.');
      return;
    }
    void envoyer(() =>
      api.put(`/personnel/salaries/${salarieId}/conges/reprise`, {
        arreteAu: f.arreteAu,
        joursNesNonPris: nes,
        moisEnCoursAccomplis: mois,
        source: f.source.trim(),
      }),
    );
  };
  return (
    <ModalePaie
      titre={reprise ? 'Corriger la reprise des congés' : 'Déclarer la reprise des congés'}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsModale envoi={envoi} onFermer={onFermer} valider="Enregistrer" />}
    >
      <ChampPaie libelle="Arrêtée au">
        <input type="date" value={f.arreteAu} onChange={(e) => setF({ ...f, arreteAu: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Jours nés et non pris">
        <input inputMode="decimal" value={f.joursNesNonPris} onChange={(e) => setF({ ...f, joursNesNonPris: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Mois accomplis de la période en cours">
        <input inputMode="numeric" value={f.moisEnCoursAccomplis} onChange={(e) => setF({ ...f, moisEnCoursAccomplis: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Source">
        <input
          placeholder="Registre des congés, ancien logiciel, attestation…"
          value={f.source}
          onChange={(e) => setF({ ...f, source: e.target.value })}
          className={CHAMP_PAIE}
        />
      </ChampPaie>
    </ModalePaie>
  );
}

/** Les éléments de l'allocation, avec les propositions du serveur reprises au clic. */
function useAllocation(salarieId: string, du: string, initial?: { devise: string | null; taux: number | null; moyenne: number | null }) {
  const [devise, setDevise] = useState(initial?.devise ?? '');
  const [taux, setTaux] = useState(initial?.taux === null || initial?.taux === undefined ? '' : String(initial.taux));
  const [moyenne, setMoyenne] = useState(initial?.moyenne === null || initial?.moyenne === undefined ? '' : String(initial.moyenne));
  const [propositions, setPropositions] = useState<Propositions | null>(null);
  const [lecture, setLecture] = useState('');
  const jeton = useRef(0);

  useEffect(() => {
    const j = ++jeton.current;
    setPropositions(null);
    setLecture('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(du)) return;
    api.get<Propositions>(`/personnel/salaries/${salarieId}/conges/propositions?du=${du}`).then(
      (r) => j === jeton.current && setPropositions(r),
      (e: ApiError) => j === jeton.current && setLecture(e.message),
    );
  }, [salarieId, du]);

  const reprendre = () => {
    if (!propositions) return;
    if (propositions.tauxJournalier.valeur !== null) {
      setTaux(String(propositions.tauxJournalier.valeur));
      setDevise(propositions.tauxJournalier.devise);
    }
    if (propositions.moyenneMensuelleArticle142.valeur !== null) setMoyenne(String(propositions.moyenneMensuelleArticle142.valeur));
  };

  const corps = () => {
    const t = lireNombre(taux);
    const m = lireNombre(moyenne);
    return {
      ...(devise ? { deviseAllocation: devise } : {}),
      ...(t !== undefined ? { remunerationJournaliere: t } : {}),
      ...(m !== undefined ? { moyenneMensuelleArticle142: m } : {}),
    };
  };

  const champs = (
    <>
      <ChampPaie libelle="Monnaie">
        <select value={devise} onChange={(e) => setDevise(e.target.value)} className={CHAMP_PAIE}>
          <option value="">Non renseignée</option>
          <option value="CDF">CDF</option>
          <option value="USD">USD</option>
        </select>
      </ChampPaie>
      <ChampPaie libelle="Rémunération journalière">
        <input inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Moyenne mensuelle des douze mois">
        <input inputMode="decimal" value={moyenne} onChange={(e) => setMoyenne(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
      {lecture && <div className="text-danger">{lecture}</div>}
      {propositions && (
        <div className="border border-border bg-surface-alt px-2 py-1.5 space-y-0.5">
          <div>
            Rémunération journalière proposée ·{' '}
            {propositions.tauxJournalier.valeur === null
              ? propositions.tauxJournalier.motif
              : `${montant(propositions.tauxJournalier.valeur)} ${propositions.tauxJournalier.devise} · ${propositions.tauxJournalier.explication}`}
          </div>
          <div>
            Moyenne proposée ·{' '}
            {propositions.moyenneMensuelleArticle142.valeur === null
              ? propositions.moyenneMensuelleArticle142.motif
              : `${montant(propositions.moyenneMensuelleArticle142.valeur)} · ${propositions.moyenneMensuelleArticle142.explication}`}
          </div>
          {(propositions.tauxJournalier.valeur !== null || propositions.moyenneMensuelleArticle142.valeur !== null) && (
            <button type="button" className="text-sel hover:underline" onClick={reprendre}>
              Reprendre les propositions
            </button>
          )}
        </div>
      )}
    </>
  );
  return { champs, corps };
}

function ModaleConge({ salarieId, onFermer, onFait }: { salarieId: string; onFermer: () => void; onFait: () => void }) {
  const [f, setF] = useState({ du: '', au: '', joursVoyage: '', moisDePaie: '', auDela: false, motif: '' });
  const [moisTouche, setMoisTouche] = useState(false);
  const allocation = useAllocation(salarieId, f.du);
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  // Le mois de paie suit le départ tant qu'il n'a pas été choisi (art. 145, payée au départ).
  const moisDePaie = moisTouche ? f.moisDePaie : moisDuDepart(f.du);
  const valider = () => {
    if (!f.du || !f.au || !moisDePaie) {
      setErreur('Les deux dates et le mois du bulletin qui porte l’allocation se déclarent.');
      return;
    }
    const voyage = lireNombre(f.joursVoyage);
    void envoyer(() =>
      api.post(`/personnel/salaries/${salarieId}/conges`, {
        du: f.du,
        au: f.au,
        moisDePaie,
        ...(voyage !== undefined ? { joursVoyage: voyage } : {}),
        ...allocation.corps(),
        ...(f.auDela ? { auDelaDuSolde: true, motifAuDelaDuSolde: f.motif.trim() } : {}),
      }),
    );
  };
  return (
    <ModalePaie
      titre="Poser un congé"
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsModale envoi={envoi} onFermer={onFermer} valider="Poser le congé" />}
    >
      <ChampPaie libelle="Premier jour">
        <input type="date" value={f.du} onChange={(e) => setF({ ...f, du: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Dernier jour">
        <input type="date" value={f.au} onChange={(e) => setF({ ...f, au: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Jours de voyage">
        <input inputMode="numeric" placeholder="0" value={f.joursVoyage} onChange={(e) => setF({ ...f, joursVoyage: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Bulletin qui porte l'allocation">
        <input
          type="month"
          value={moisDePaie}
          onChange={(e) => {
            setMoisTouche(true);
            setF({ ...f, moisDePaie: e.target.value });
          }}
          className={CHAMP_PAIE}
        />
      </ChampPaie>
      {allocation.champs}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={f.auDela} onChange={(e) => setF({ ...f, auDela: e.target.checked })} />
        Au-delà du solde des droits nés
      </label>
      {f.auDela && (
        <ChampPaie libelle="Motif">
          <textarea rows={2} value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} className={CHAMP_PAIE} />
        </ChampPaie>
      )}
    </ModalePaie>
  );
}

function ModaleAllocation({ salarieId, conge, onFermer, onFait }: { salarieId: string; conge: CongeLu; onFermer: () => void; onFait: () => void }) {
  const allocation = useAllocation(salarieId, conge.du, {
    devise: conge.deviseAllocation,
    taux: conge.remunerationJournaliere,
    moyenne: conge.moyenneMensuelleArticle142,
  });
  const { envoi, erreur, envoyer } = useEnvoi(onFait);
  return (
    <ModalePaie
      titre={`Allocation du congé du ${dateCourte(conge.du)} au ${dateCourte(conge.au)}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={() => void envoyer(() => api.patch(`/personnel/conges/${conge.id}/allocation`, allocation.corps()))}
      pied={<BoutonsModale envoi={envoi} onFermer={onFermer} valider="Enregistrer" />}
    >
      {allocation.champs}
    </ModalePaie>
  );
}

function ModaleAnnulation({ conge, onFermer, onFait }: { conge: CongeLu; onFermer: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const valider = () => {
    if (motif.trim().length < 3) {
      setErreur("Un congé s'annule avec son motif.");
      return;
    }
    void envoyer(() => api.post(`/personnel/conges/${conge.id}/annulation`, { motif: motif.trim() }));
  };
  return (
    <ModalePaie
      titre={`Annuler le congé du ${dateCourte(conge.du)} au ${dateCourte(conge.au)}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsModale envoi={envoi} onFermer={onFermer} valider="Annuler le congé" />}
    >
      <ChampPaie libelle="Motif">
        <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}
