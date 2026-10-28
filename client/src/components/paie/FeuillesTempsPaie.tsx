import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { BoutonsPaie as Boutons, CHAMP_PAIE, ChampPaie, ModalePaie, useEnvoiPaie as useEnvoi } from './ModalePaie';
import { dateCourte } from '../../lib/conges-paie';
import { useGardeFermeture } from '../../lib/fenetres';
import {
  heuresAffichees,
  lireHeures,
  natureAffichee,
  type CompteurLu,
  type DetailFeuille,
  type FeuilleLue,
  type ListeCompteurs,
  type ListeFeuilles,
} from '../../lib/feuilles-temps';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · L'ONGLET FEUILLES DE TEMPS DE LA
 * FENÊTRE PERSONNEL. Les heures se saisissent jour par jour, jamais un
 * montant ; le compte des heures supplémentaires, de nuit, du dimanche et des
 * fériés est rejoué au serveur et proposé à l'onglet Simulation. Les boutons
 * qui écrivent suivent `peutEcrire`, comme les routes.
 */

type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };
type Modale = { genre: 'ouvrir' } | { genre: 'annuler'; feuille: FeuilleLue } | { genre: 'compteur' };
/** Une ligne de la grille, telle que tapée · heures, nuit, et un champ par compteur. */
type Saisie = { heures: string; nuit: string; compteurs: Record<string, string> };

const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const JOURS_SEMAINE = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const champ = (n: number) => (n === 0 ? '' : String(n).replace('.', ','));

export function OngletFeuillesTempsPaie({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  const [salarieId, setSalarieId] = useState(salaries.length === 1 ? salaries[0].id : '');
  // Null tant que la liste n'est pas LUE · un échec ne se lit jamais « aucune feuille ».
  const [liste, setListe] = useState<ListeFeuilles | null>(null);
  const [compteurs, setCompteurs] = useState<ListeCompteurs | null>(null);
  const [detail, setDetail] = useState<DetailFeuille | null>(null);
  const [saisie, setSaisie] = useState<Record<string, Saisie>>({});
  const [modifiee, setModifiee] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  // La feuille relue après un enregistrement · ses champs restent fermés
  // jusqu'au retour, sans quoi une heure retapée pendant la relecture était
  // écrasée en silence par la valeur relue.
  const [relecture, setRelecture] = useState(false);
  const [desactivation, setDesactivation] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [modale, setModale] = useState<Modale | null>(null);
  // Deux lectures, deux jetons · la liste relue après un enregistrement ne
  // doit pas jeter la feuille ouverte au même instant, ni l'inverse.
  const jetonListe = useRef(0);
  const jetonDetail = useRef(0);
  // Le salarié affiché À L'INSTANT · la réponse d'un enregistrement relit la
  // feuille et la liste seulement s'il n'a pas changé entre-temps.
  const salarieCourant = useRef(salarieId);
  salarieCourant.current = salarieId;

  useGardeFermeture(modifiee ? 'Des heures de la feuille ne sont pas enregistrées · elles seraient perdues.' : null);

  useEffect(() => {
    if (!salarieId && salaries.length === 1) setSalarieId(salaries[0].id);
  }, [salaries, salarieId]);

  const chargerCompteurs = useCallback(() => {
    api.get<ListeCompteurs>('/personnel/compteurs-heures').then(setCompteurs, (e: ApiError) => {
      setCompteurs(null);
      setErreur(e.message);
    });
  }, []);
  useEffect(chargerCompteurs, [chargerCompteurs]);

  // Un autre salarié ferme la feuille ouverte.
  useEffect(() => {
    jetonDetail.current += 1;
    setDetail(null);
    setModifiee(false);
  }, [salarieId]);

  const charger = useCallback(() => {
    const j = ++jetonListe.current;
    if (!salarieId) {
      setListe(null);
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur('');
    api.get<ListeFeuilles>(`/personnel/salaries/${salarieId}/feuilles-temps`).then(
      (r) => {
        if (j !== jetonListe.current) return;
        setListe(r);
        setChargement(false);
      },
      (e: ApiError) => {
        if (j !== jetonListe.current) return;
        setListe(null);
        setErreur(e.message);
        setChargement(false);
      },
    );
  }, [salarieId]);
  useEffect(charger, [charger]);
  // `charger` par référence · la réponse d'un enregistrement appelle celui du
  // rendu COURANT, jamais celui, figé, du salarié de l'envoi.
  const chargerRef = useRef(charger);
  chargerRef.current = charger;

  const ouvrir = useCallback((id: string) => {
    const j = ++jetonDetail.current;
    setErreur('');
    return api.get<DetailFeuille>(`/personnel/feuilles-temps/${id}`).then(
      (d) => {
        if (j !== jetonDetail.current) return;
        setDetail(d);
        setSaisie(
          Object.fromEntries(
            d.jours.map((x) => [
              x.jour,
              { heures: champ(x.heures), nuit: champ(x.heuresNuit), compteurs: Object.fromEntries(x.compteurs.map((c) => [c.compteurId, champ(c.heures)])) },
            ]),
          ),
        );
        setModifiee(false);
      },
      (e: ApiError) => {
        if (j !== jetonDetail.current) return;
        setDetail(null);
        setErreur(e.message);
      },
    );
  }, []);

  // Les compteurs qui ont une colonne · les actifs, et les désactivés que la
  // feuille ouverte porte déjà (leurs heures restent lisibles).
  // UN COMPTEUR DÉSACTIVÉ PENDANT LA SAISIE garde sa colonne tant qu'elle
  // porte une valeur tapée · sa disparition perdait la valeur sans un mot. Le
  // serveur refuse des heures nouvelles sur lui, et l'écran le dit
  // (`compteursFermesTapes`).
  const colonnes: CompteurLu[] = useMemo(() => {
    const portes = new Set(detail?.jours.flatMap((j) => j.compteurs.filter((c) => c.heures > 0).map((c) => c.compteurId)) ?? []);
    const tapes = new Set(Object.values(saisie).flatMap((x) => Object.entries(x.compteurs).filter(([, v]) => (lireHeures(v) ?? 1) !== 0).map(([id]) => id)));
    return (compteurs?.compteurs ?? []).filter((c) => c.actif || portes.has(c.id) || tapes.has(c.id));
  }, [compteurs, detail, saisie]);
  const compteursFermesTapes = useMemo(() => {
    if (!detail) return [];
    return colonnes.filter(
      (c) =>
        !c.actif &&
        detail.jours.some((j) => {
          const tape = lireHeures(saisie[j.jour]?.compteurs[c.id] ?? '');
          const lu = j.compteurs.find((x) => x.compteurId === c.id)?.heures ?? 0;
          return tape !== null && Math.round(tape * 100) !== Math.round(lu * 100);
        }),
    );
  }, [colonnes, detail, saisie]);

  /** Changer de salarié · une saisie non enregistrée se confirme, jamais perdue en silence. */
  const changerDeSalarie = (id: string) => {
    if (id === salarieId) return;
    if (modifiee && !window.confirm('Des heures de la feuille ouverte ne sont pas enregistrées · elles seront perdues. Changer de salarié ?')) return;
    setSalarieId(id);
  };

  const desactiverCompteur = (c: CompteurLu) => {
    if (desactivation) return;
    if (!window.confirm(`Désactiver le compteur ${c.code} ? Il ne reçoit plus d'heures ; celles déjà saisies restent lisibles.`)) return;
    setDesactivation(c.id);
    api.post(`/personnel/compteurs-heures/${c.id}/desactivation`, {}).then(
      () => {
        setDesactivation(null);
        chargerCompteurs();
      },
      (e: ApiError) => {
        setDesactivation(null);
        setErreur(e.message);
      },
    );
  };

  const modifier = (jour: string, p: Partial<Saisie>) => {
    setSaisie((s) => ({ ...s, [jour]: { ...(s[jour] ?? { heures: '', nuit: '', compteurs: {} }), ...p } }));
    setModifiee(true);
    setSucces('');
  };

  const total = (f: (s: Saisie) => string) =>
    Object.values(saisie).reduce((n, s) => {
      const v = lireHeures(f(s));
      return n + Math.round((v ?? 0) * 100);
    }, 0) / 100;

  const enregistrer = () => {
    if (!detail) return;
    const jours = [];
    for (const j of detail.jours) {
      const s = saisie[j.jour];
      if (!s) continue;
      const heures = lireHeures(s.heures);
      const nuit = lireHeures(s.nuit);
      if (heures === null || nuit === null) {
        setErreur(`Le ${dateCourte(j.jour)} · les heures se tapent en chiffres (« 7,5 »).`);
        return;
      }
      const cpt = [];
      for (const c of colonnes) {
        const v = lireHeures(s.compteurs[c.id] ?? '');
        if (v === null) {
          setErreur(`Le ${dateCourte(j.jour)} · les heures du compteur ${c.code} se tapent en chiffres.`);
          return;
        }
        cpt.push({ compteurId: c.id, heures: v });
      }
      jours.push({ jour: j.jour, heures, heuresNuit: nuit, compteurs: cpt });
    }
    setEnvoi(true);
    setErreur('');
    const salarieDeLEnvoi = salarieId;
    const feuille = detail.id;
    api.put<{ enregistre: boolean; gestes: number }>(`/personnel/feuilles-temps/${feuille}/jours`, { jours }).then(
      (r) => {
        setEnvoi(false);
        // Enregistré · la garde de fermeture tombe dès la réponse, la relecture
        // ne fait que rafraîchir l'affichage.
        setModifiee(false);
        setSucces(r.gestes === 0 ? 'Rien à enregistrer · la feuille était à jour.' : 'Feuille enregistrée.');
        if (salarieCourant.current !== salarieDeLEnvoi) return;
        setRelecture(true);
        void Promise.resolve(ouvrir(feuille)).finally(() => setRelecture(false));
        chargerRef.current();
      },
      (e: ApiError) => {
        setEnvoi(false);
        setErreur(e.message);
      },
    );
  };

  const ecrire = peutEcrire && !!detail && !detail.annuleLe && !relecture;

  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Salarié</span>
          <select
            aria-label="Salarié"
            value={salarieId}
            disabled={envoi}
            onChange={(e) => changerDeSalarie(e.target.value)}
            className={`${CHAMP_PAIE} min-w-[220px]`}
          >
            <option value="">Choisir…</option>
            {salaries.map((s) => (
              <option key={s.id} value={s.id}>
                {nomDe(s)}
              </option>
            ))}
          </select>
        </label>
        {peutEcrire && salarieId && liste && (
          <button type="button" className="bg-sel text-white font-semibold px-3 py-1 rounded-full" onClick={() => setModale({ genre: 'ouvrir' })}>
            Nouvelle feuille
          </button>
        )}
        <span className="ml-auto self-center">
          <Aide
            titre="Feuilles de temps"
            texte="Une feuille couvre au plus trente et un jours d'un salarié ; les heures de chaque jour se saisissent, et parmi elles celles de nuit (de 19 h à 5 h). Une heure au-delà de huit dans la journée, ou au-delà de quarante-cinq dans la semaine pour les heures restées dans les huit, est une heure supplémentaire, comptée une fois. La semaine va du lundi au dimanche et se paie au mois de son dimanche, ou au mois de la fin du service s'il s'achève avant ; un jour de contrat qu'aucune feuille ne couvre laisse la semaine incomplète, et le compte se dit alors un minimum. Les heures du dimanche, des jours fériés et, à part, du samedi sont comptées pour leurs suppléments. L'onglet Simulation propose ces heures au bulletin, avec la majoration déclarée quand elle est seule ; le taux horaire se tape. Un jour d'absence ou de congé ne reçoit pas d'heures, et un jour dont la semaine est payée par un bulletin émis ne se corrige qu'après l'annulation du bulletin. Les compteurs libres cumulent des heures nommées par le dossier, sans effet sur la paie."
            source="Code du travail, art. 7 point 9, 93, 119, 120, 121 et 124 · arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, mentions 8 à 11"
          />
        </span>
      </div>

      {erreur && (
        <div role="alert" className="border border-danger/30 bg-danger-soft text-danger px-3 py-2">
          {erreur}
        </div>
      )}
      {succes && (
        <div role="status" className="border border-ok/30 bg-ok-soft px-3 py-2">
          {succes}
        </div>
      )}

      <section className="border border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Compteurs libres</span>
          {compteurs === null && <span className="text-text-dim">Compteurs non lus.</span>}
          {compteurs && compteurs.compteurs.length === 0 && <span className="text-text-dim">Aucun compteur déclaré.</span>}
          {compteurs?.compteurs.map((c) => (
            <span key={c.id} className={`border border-border px-2 py-0.5 ${c.actif ? '' : 'text-text-dim line-through'}`} title={c.libelle}>
              {c.code} · {c.libelle}
              {peutEcrire && c.actif && (
                <button
                  type="button"
                  className="ml-2 text-danger hover:underline disabled:opacity-50"
                  aria-label={`Désactiver le compteur ${c.code}`}
                  disabled={desactivation !== null}
                  onClick={() => desactiverCompteur(c)}
                >
                  {desactivation === c.id ? 'Désactivation…' : 'Désactiver'}
                </button>
              )}
            </span>
          ))}
          {peutEcrire && compteurs && (
            <button type="button" className="text-sel hover:underline" onClick={() => setModale({ genre: 'compteur' })}>
              Nouveau compteur
            </button>
          )}
        </div>
      </section>

      {!salarieId &&
        (salaries.length === 0 ? (
          <div className="text-text-dim">Aucun salarié au registre · inscrivez-le d'abord dans l'onglet Registre.</div>
        ) : (
          <div className="text-text-dim">Choisissez un salarié pour lire ses feuilles de temps.</div>
        ))}
      {chargement && <div className="text-text-dim">Lecture des feuilles…</div>}

      {liste && (
        <section>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Du</th>
                  <th className="text-left px-2 py-1">Au</th>
                  <th className="text-right px-2 py-1">Heures</th>
                  <th className="text-right px-2 py-1">Dont nuit</th>
                  <th className="text-left px-2 py-1">Observation</th>
                  <th className="px-2 py-1 w-[160px]" />
                </tr>
              </thead>
              <tbody>
                {liste.feuilles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-1 text-text-dim">
                      Aucune feuille de temps.
                    </td>
                  </tr>
                )}
                {liste.feuilles.map((f) => (
                  <tr key={f.id} className={f.annuleLe ? 'text-text-dim' : detail?.id === f.id ? 'bg-a-50' : ''}>
                    <td className="px-2 py-1">{dateCourte(f.du)}</td>
                    <td className="px-2 py-1">
                      {dateCourte(f.au)}
                      {f.annuleLe && (
                        <span title={f.motifAnnulation ?? undefined}>
                          {' '}
                          · annulée
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">{heuresAffichees(f.heures)}</td>
                    <td className="px-2 py-1 text-right">{heuresAffichees(f.heuresNuit)}</td>
                    <td className="px-2 py-1">{f.observation ?? ''}</td>
                    <td className="px-2 py-1 text-right">
                      <button type="button" className="text-sel hover:underline mr-2" onClick={() => ouvrir(f.id)}>
                        Ouvrir
                      </button>
                      {peutEcrire && !f.annuleLe && (
                        <button type="button" className="text-danger hover:underline" onClick={() => setModale({ genre: 'annuler', feuille: f })}>
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {liste.tronque && <div className="text-warning mt-1">Liste tronquée · {liste.feuilles.length} feuilles lues sur {liste.total}.</div>}
        </section>
      )}

      {detail && (
        <section aria-label={`Feuille du ${dateCourte(detail.du)} au ${dateCourte(detail.au)}`}>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold">
              Feuille du {dateCourte(detail.du)} au {dateCourte(detail.au)}
            </span>
            {detail.annuleLe && <span className="text-text-dim">· annulée</span>}
            {ecrire && (
              <button type="button" disabled={envoi || !modifiee} className="ml-auto bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-50" onClick={enregistrer}>
                {envoi ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
          {compteursFermesTapes.length > 0 && (
            <div role="status" className="text-warning mb-1">
              {compteursFermesTapes.map((c) => c.code).join(', ')} · désactivé depuis la saisie · ses heures nouvelles seront refusées à l'enregistrement ; videz-les ou
              gardez celles déjà enregistrées.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Jour</th>
                  <th className="text-left px-2 py-1" />
                  <th className="text-right px-2 py-1">Heures</th>
                  <th className="text-right px-2 py-1">Dont nuit</th>
                  {colonnes.map((c) => (
                    <th key={c.id} className="text-right px-2 py-1" title={c.libelle}>
                      {c.code}
                    </th>
                  ))}
                  <th className="text-left px-2 py-1">Payé en</th>
                </tr>
              </thead>
              <tbody>
                {detail.jours.map((j) => {
                  const s = saisie[j.jour] ?? { heures: '', nuit: '', compteurs: {} };
                  // Les heures d'un jour ne se tapent que là où le serveur les
                  // admet · sous contrat, sans absence ni congé, sans bulletin
                  // émis. Les compteurs, sans effet de paie, restent ouverts.
                  // UN JOUR DEVENU ABSENCE OU CONGÉ APRÈS LA SAISIE garde son
                  // champ ouvert tant qu'il porte des heures enregistrées · le
                  // cabinet les VIDE (le serveur admet le zéro), jamais il n'en
                  // ajoute.
                  const aVider = !!j.occupation && (j.heures > 0 || j.heuresNuit > 0);
                  const fermeHeures = !ecrire || !j.sousContrat || (!!j.occupation && !aVider) || !!j.bulletinEmis;
                  const motif = !j.sousContrat
                    ? 'Aucun contrat ne couvre ce jour.'
                    : j.occupation
                      ? `Ce jour porte ${j.occupation}.`
                      : j.bulletinEmis
                        ? `Payé au bulletin n° ${j.bulletinEmis.numero} de ${j.bulletinEmis.mois}, déjà émis.`
                        : undefined;
                  return (
                    <tr key={j.jour} className={j.nature !== 'OUVRABLE' ? 'bg-a-50' : ''}>
                      <td className="px-2 py-0.5">
                        {JOURS_SEMAINE[new Date(`${j.jour}T00:00:00Z`).getUTCDay()]} {dateCourte(j.jour)}
                      </td>
                      <td className="px-2 py-0.5 text-text-dim" title={motif}>
                        {natureAffichee(j)}
                        {motif ? (natureAffichee(j) ? ' · ' : '') + (j.bulletinEmis ? `bulletin n° ${j.bulletinEmis.numero}` : !j.sousContrat ? 'hors contrat' : 'absence ou congé') : ''}
                      </td>
                      <td className="px-2 py-0.5 text-right">
                        <input
                          aria-label={`Heures du ${j.jour}`}
                          inputMode="decimal"
                          disabled={fermeHeures}
                          title={motif}
                          value={s.heures}
                          onChange={(e) => modifier(j.jour, { heures: e.target.value })}
                          className="border border-border bg-transparent px-1.5 py-0.5 w-[70px] text-right disabled:opacity-60"
                        />
                      </td>
                      <td className="px-2 py-0.5 text-right">
                        <input
                          aria-label={`Heures de nuit du ${j.jour}`}
                          inputMode="decimal"
                          disabled={fermeHeures}
                          title={motif}
                          value={s.nuit}
                          onChange={(e) => modifier(j.jour, { nuit: e.target.value })}
                          className="border border-border bg-transparent px-1.5 py-0.5 w-[70px] text-right disabled:opacity-60"
                        />
                      </td>
                      {colonnes.map((c) => (
                        <td key={c.id} className="px-2 py-0.5 text-right">
                          <input
                            aria-label={`Compteur ${c.code} du ${j.jour}`}
                            inputMode="decimal"
                            disabled={!ecrire || (!c.actif && !(lireHeures(s.compteurs[c.id] ?? '') ?? 1))}
                            value={s.compteurs[c.id] ?? ''}
                            onChange={(e) => modifier(j.jour, { compteurs: { ...s.compteurs, [c.id]: e.target.value } })}
                            className="border border-border bg-transparent px-1.5 py-0.5 w-[60px] text-right disabled:opacity-60"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-0.5 text-text-dim">{j.moisDePaiement}</td>
                    </tr>
                  );
                })}
                <tr className="font-semibold">
                  <td className="px-2 py-1" colSpan={2}>
                    Total
                  </td>
                  <td className="px-2 py-1 text-right">{heuresAffichees(total((s) => s.heures))}</td>
                  <td className="px-2 py-1 text-right">{heuresAffichees(total((s) => s.nuit))}</td>
                  {colonnes.map((c) => (
                    <td key={c.id} className="px-2 py-1 text-right">
                      {heuresAffichees(total((s) => s.compteurs[c.id] ?? ''))}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modale?.genre === 'ouvrir' && (
        <ModaleOuvrir
          salarieId={salarieId}
          onFermer={() => setModale(null)}
          onFait={(id) => {
            setModale(null);
            charger();
            ouvrir(id);
          }}
        />
      )}
      {modale?.genre === 'annuler' && (
        <ModaleAnnuler
          feuille={modale.feuille}
          onFermer={() => setModale(null)}
          onFait={() => {
            const annulee = modale.feuille.id;
            setModale(null);
            charger();
            // La feuille ouverte annulée se relit · « Enregistrer » disparaît,
            // l'annulation s'affiche.
            if (detail?.id === annulee) void ouvrir(annulee);
          }}
        />
      )}
      {modale?.genre === 'compteur' && (
        <ModaleCompteur
          onFermer={() => setModale(null)}
          onFait={() => {
            setModale(null);
            chargerCompteurs();
          }}
        />
      )}
    </div>
  );
}

function ModaleOuvrir({ salarieId, onFermer, onFait }: { salarieId: string; onFermer: () => void; onFait: (id: string) => void }) {
  const [f, setF] = useState({ du: '', au: '', observation: '' });
  // L'identifiant né se lit au retour du serveur, avant que `useEnvoi`
  // n'appelle la suite · un état React n'y serait pas encore posé.
  const cree = useRef<string | null>(null);
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(() => {
    if (cree.current) onFait(cree.current);
  });
  const valider = () => {
    if (!f.du || !f.au) {
      setErreur('Le premier et le dernier jour de la feuille se déclarent.');
      return;
    }
    void envoyer(async () => {
      const r = await api.post<{ id: string }>(`/personnel/salaries/${salarieId}/feuilles-temps`, {
        du: f.du,
        au: f.au,
        ...(f.observation.trim() ? { observation: f.observation.trim() } : {}),
      });
      cree.current = r.id;
    });
  };
  return (
    <ModalePaie
      titre="Nouvelle feuille de temps"
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<Boutons envoi={envoi} onFermer={onFermer} valider="Ouvrir la feuille" />}
    >
      <ChampPaie libelle="Premier jour">
        <input type="date" value={f.du} onChange={(e) => setF({ ...f, du: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Dernier jour">
        <input type="date" value={f.au} onChange={(e) => setF({ ...f, au: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Observation">
        <textarea rows={2} value={f.observation} onChange={(e) => setF({ ...f, observation: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}

function ModaleAnnuler({ feuille, onFermer, onFait }: { feuille: FeuilleLue; onFermer: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const valider = () => {
    if (motif.trim().length < 3) {
      setErreur("Une feuille s'annule avec son motif.");
      return;
    }
    void envoyer(() => api.post(`/personnel/feuilles-temps/${feuille.id}/annulation`, { motif: motif.trim() }));
  };
  return (
    <ModalePaie
      titre={`Annuler la feuille du ${dateCourte(feuille.du)} au ${dateCourte(feuille.au)}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<Boutons envoi={envoi} onFermer={onFermer} valider="Annuler la feuille" />}
    >
      <ChampPaie libelle="Motif">
        <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}

function ModaleCompteur({ onFermer, onFait }: { onFermer: () => void; onFait: () => void }) {
  const [f, setF] = useState({ code: '', libelle: '' });
  const { envoi, erreur, setErreur, envoyer } = useEnvoi(onFait);
  const valider = () => {
    if (!f.code.trim() || f.libelle.trim().length < 3) {
      setErreur('Le code et le nom du compteur se déclarent.');
      return;
    }
    void envoyer(() => api.post('/personnel/compteurs-heures', { code: f.code.trim().toUpperCase(), libelle: f.libelle.trim() }));
  };
  return (
    <ModalePaie
      titre="Nouveau compteur libre"
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<Boutons envoi={envoi} onFermer={onFermer} valider="Créer le compteur" />}
    >
      <ChampPaie libelle="Code">
        <input maxLength={10} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Nom">
        <input maxLength={60} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}
