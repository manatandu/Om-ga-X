import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { montant as fmt } from '../lib/montants';
import { corpsMouvement, valeurUnitaireLue, type ChampsMouvement } from '../lib/titres-placement-saisie';
import { Aide } from './chrome/Aide';
import { CadreModale, messageDuRefus, useFermetureParEchap } from './CadreModaleTresorerie';

/**
 * TITRES DE PLACEMENT ET PARTS D'OPCVM · section de la fenêtre Financements
 * et placements (ligne sage-l3, fonction 47, décision D16 · chez Sage,
 * F_OPPLACEMENT). Le titre au 50, l'acquisition et la cession au journal de
 * banque, la cession au coût P.E.P.S., la revue de clôture qui ne passe que
 * l'écart avec la dépréciation en place. Règles au serveur
 * (src/modules/tresorerie/titres-placement.ts) · l'écran propose, le serveur
 * juge, et les positions sont celles qu'il sert.
 */

type Nature = 'ACQUISITION' | 'CESSION';
type NatureValeur = 'COURS_MOYEN_DERNIER_MOIS' | 'VALEUR_PROBABLE_NEGOCIATION';
interface CompteServi {
  id: string;
  numero: string;
  intitule: string;
}
export interface JournalTitre {
  id: string;
  code: string;
  intitule: string;
  type: string;
  estActif: boolean;
}
interface Piece {
  id: string;
  numeroPiece: string | null;
  statut: string;
}
interface Mouvement {
  id: string;
  nature: Nature;
  libelle: string;
  date: string;
  quantite: number;
  prix: number;
  frais: number;
  reference: string;
  coutPrixSorti: number | null;
  coutFraisSorti: number | null;
  resultat: number | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  journal: { id: string; code: string };
  ecriture: Piece | null;
  ecritureNegatif: Piece | null;
}
interface Revue {
  id: string;
  date: string;
  valeurUnitaire: number;
  nature: NatureValeur;
  source: string;
  quantite: number;
  cout: number;
  depreciationNecessaire: number;
  depreciationEnPlace: number;
  annuleLe: string | null;
  motifAnnulation: string | null;
  ecriture: Piece | null;
  ecritureNegatif: Piece | null;
}
interface Titre {
  id: string;
  code: string;
  intitule: string;
  cote: boolean;
  compteTitre: CompteServi;
  compteFrais: CompteServi | null;
  position: { date: string; quantite: number | null; cout: number | null; depreciationEnPlace: number; calculee: boolean };
  revueProposee: { date: string; nature: NatureValeur; quantite: number | null; cout: number | null; depreciationEnPlace: number } | null;
  mouvements: Mouvement[];
  mouvementsTronques: boolean;
  evaluations: Revue[];
}
interface ListeTitres {
  exercice: { id: string; dateDebut: string; dateFin: string; statut: string };
  titres: Titre[];
  total: number;
  tronque: boolean;
}
interface ComptesDuRole {
  comptes: CompteServi[];
  total: number;
  tronque: boolean;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const parts = (q: number | null) => (q === null ? '·' : q.toLocaleString('fr-FR', { maximumFractionDigits: 6 }));
const piece = (p: Piece | null) => (p ? `n° ${p.numeroPiece ?? '·'}${p.statut === 'BROUILLARD' ? ' (brouillard)' : ''}` : '·');
const LIBELLES_VALEUR: Record<NatureValeur, string> = { COURS_MOYEN_DERNIER_MOIS: 'Cours moyen du dernier mois', VALEUR_PROBABLE_NEGOCIATION: 'Valeur probable de négociation' };

export function TitresPlacementSection(p: {
  exerciceId: string;
  exerciceClos: boolean;
  peutEcrire: boolean;
  peutValider: boolean;
  banques: JournalTitre[];
  journauxOd: JournalTitre[];
  onGarde: (motif: string | null) => void;
}) {
  const [liste, setListe] = useState<ListeTitres | null>(null);
  // L'erreur d'un geste reste jusqu'au geste suivant ; celle de la lecture suit la dernière lecture (un rechargement réussi n'efface pas « le geste a pu passer »).
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    const n = ++jeton.current;
    try {
      const l = await api.get<ListeTitres>(`/titres-placement?exerciceId=${p.exerciceId}`);
      if (n !== jeton.current) return;
      setListe(l);
      setErreurLecture(null);
    } catch (err) {
      if (n === jeton.current) setErreurLecture(err instanceof ApiError ? err.message : 'Titres de placement illisibles');
    }
  }, [p.exerciceId]);
  useEffect(() => {
    setListe(null);
    setInfo(null);
    setErreur(null);
    setErreurLecture(null);
    void charger();
  }, [charger]);
  const fait = async (m: string) => {
    setInfo(m);
    setErreur(null);
    await charger();
  };
  const refus = useCallback(
    (err: unknown, defaut: string) => {
      setErreur(messageDuRefus(err, defaut));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) void charger();
    },
    [charger],
  );

  const [mouvement, setMouvement] = useState<{ titre: Titre; nature: Nature } | null>(null);
  const [revue, setRevue] = useState<Titre | null>(null);
  const [historique, setHistorique] = useState<Titre | null>(null);
  const [retrait, setRetrait] = useState<string | null>(null);
  const retirer = async (t: Titre) => {
    if (retrait) return;
    setRetrait(t.id);
    try {
      await api.delete(`/titres-placement/${t.id}`);
      await fait(`Titre ${t.code} retiré.`);
    } catch (err) {
      refus(err, 'Retrait impossible');
    } finally {
      setRetrait(null);
    }
  };
  const ouvert = !p.exerciceClos;

  return (
    <section aria-labelledby="titre-titres-placement" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titre-titres-placement" className="font-semibold">
          Titres de placement
        </h2>
        <Aide
          titre="Titres de placement"
          texte="Une part d'OPCVM, une action ou une obligation détenue pour la revendre à brève échéance va au compte 50, ses frais d'acquisition au 5016, 5026 ou 5036 de sa division. La cession sort au coût premier entré, premier sorti (frais compris) ; l'écart avec le prix diminué des frais de cession va au 777 (gain) ou au 6771 (perte). À la clôture, la valeur d'inventaire se déclare avec sa source · cours moyen du dernier mois pour un titre coté, valeur probable de négociation sinon ; la moins-value se déprécie au 590 par le 6795, reprise au 7795, titre par titre, sans compensation avec une plus-value, et seul l'écart avec la dépréciation en place se passe. Aucun mouvement ne s'antidate ni ne se date dans une période déjà revue ; tout s'annule à rebours, avec son motif."
          source="AUDCIF Titre VIII ch. 13 § 1.1, § 2.3, § 3.2, § 4 et § 4.2 ; fiche du compte 50 des deux plans ; AUDCIF art. 17, 3° et art. 20, al. 2"
        />
      </div>
      {[erreur, erreurLecture].filter(Boolean).map((m) => (
        <div key={m} role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">
          {m}
        </div>
      ))}
      <div role="status" aria-live="polite">
        {info && <div className="text-ok bg-ok-soft border border-ok/30 px-3 py-2">{info}</div>}
      </div>
      {p.peutEcrire && ouvert && <FormTitre onFait={fait} onRefus={refus} onGarde={p.onGarde} />}
      {liste === null && !erreurLecture && <div className="text-text-dim">Lecture des titres…</div>}
      {liste && liste.titres.length === 0 && <div className="text-text-dim">Aucun titre de placement dans ce dossier.</div>}
      {liste && liste.titres.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th scope="col" className="text-left px-2 py-1">Titre</th>
                <th scope="col" className="text-left px-2 py-1">Compte</th>
                <th scope="col" className="text-right px-2 py-1">Parts à la clôture</th>
                <th scope="col" className="text-right px-2 py-1">Coût</th>
                <th scope="col" className="text-right px-2 py-1">Dépréciation</th>
                <th scope="col" className="text-left px-2 py-1">À faire dans l'exercice</th>
                <th scope="col" className="text-left px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {liste.titres.map((t) => (
                <tr key={t.id} className="border-t border-border align-top">
                  <th scope="row" className="text-left font-normal px-2 py-1">
                    {t.code} · {t.intitule}
                    <div className="text-text-dim">{t.cote ? 'Coté' : 'Non coté'}</div>
                  </th>
                  <td className="px-2 py-1">{t.compteTitre.numero}</td>
                  <td className="px-2 py-1 text-right">{t.position.calculee ? parts(t.position.quantite) : 'Non calculé'}</td>
                  <td className="px-2 py-1 text-right">{t.position.cout === null ? '·' : fmt(t.position.cout)}</td>
                  <td className="px-2 py-1 text-right">{fmt(t.position.depreciationEnPlace)}</td>
                  <td className="px-2 py-1">
                    {t.revueProposee ? <div>Revoir à la clôture du {date(t.revueProposee.date)}</div> : <span className="text-text-dim">·</span>}
                    {t.mouvementsTronques && <div className="text-warn">Trop de mouvements pour un rejeu · ouvrez un titre nouveau pour la suite.</div>}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => setHistorique(t)} className="px-2 py-[1px] border border-border">
                        Historique
                      </button>
                      {p.peutEcrire && ouvert && (
                        <button type="button" onClick={() => setMouvement({ titre: t, nature: 'ACQUISITION' })} className="px-2 py-[1px] border border-border">
                          Acquérir
                        </button>
                      )}
                      {p.peutEcrire && ouvert && (t.position.quantite ?? 0) > 0 && (
                        <button type="button" onClick={() => setMouvement({ titre: t, nature: 'CESSION' })} className="px-2 py-[1px] border border-border">
                          Céder
                        </button>
                      )}
                      {p.peutEcrire && ouvert && t.revueProposee && (
                        <button type="button" onClick={() => setRevue(t)} className="px-2 py-[1px] border border-border">
                          Revoir
                        </button>
                      )}
                      {p.peutEcrire && t.mouvements.length === 0 && t.evaluations.length === 0 && (
                        <button type="button" disabled={retrait !== null} onClick={() => void retirer(t)} className="px-2 py-[1px] border border-border text-danger disabled:opacity-40">
                          {retrait === t.id ? '…' : 'Retirer'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {liste?.tronque && <div className="text-text-dim">{liste.titres.length} titres montrés sur {liste.total}.</div>}
      {mouvement && (
        <ModaleMouvement
          titre={mouvement.titre}
          nature={mouvement.nature}
          banques={p.banques}
          onFermer={() => setMouvement(null)}
          onRelire={refus}
          onFait={async (m) => {
            setMouvement(null);
            await fait(m);
          }}
        />
      )}
      {revue && liste && (
        <ModaleRevue
          titre={revue}
          exerciceId={liste.exercice.id}
          journauxOd={p.journauxOd}
          onFermer={() => setRevue(null)}
          onRelire={refus}
          onFait={async (m) => {
            setRevue(null);
            await fait(m);
          }}
        />
      )}
      {historique && (
        <ModaleHistorique
          titre={historique}
          peutValider={p.peutValider && ouvert}
          onFermer={() => setHistorique(null)}
          onRelire={refus}
          onFait={async (m) => {
            setHistorique(null);
            await fait(m);
          }}
        />
      )}
    </section>
  );
}

// ----- Nouveau titre ---------------------------------------------------------------

function FormTitre(p: { onFait: (m: string) => Promise<void>; onRefus: (err: unknown, defaut: string) => void; onGarde: (motif: string | null) => void }) {
  const [code, setCode] = useState('');
  const [intitule, setIntitule] = useState('');
  const [cote, setCote] = useState<'' | 'oui' | 'non'>('');
  const [compteTitreId, setCompteTitreId] = useState('');
  const [compteFraisId, setCompteFraisId] = useState('');
  const [comptes, setComptes] = useState<{ TITRE: ComptesDuRole; FRAIS: ComptesDuRole } | null>(null);
  const [erreurComptes, setErreurComptes] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    let vivant = true;
    Promise.all([api.get<ComptesDuRole>('/titres-placement/comptes?role=TITRE'), api.get<ComptesDuRole>('/titres-placement/comptes?role=FRAIS')])
      .then(([t, f]) => {
        if (!vivant) return;
        setComptes({ TITRE: t, FRAIS: f });
        if (t.comptes.length === 1) setCompteTitreId(t.comptes[0].id);
      })
      .catch((err) => vivant && setErreurComptes(err instanceof ApiError ? err.message : 'Comptes illisibles'));
    return () => {
      vivant = false;
    };
  }, []);
  const entame = code !== '' || intitule !== '' || cote !== '';
  useEffect(() => {
    p.onGarde(entame ? 'Un titre de placement est en cours de saisie.' : null);
    return () => p.onGarde(null);
    // p.onGarde est stable (setter d'état du parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entame]);
  // Les comptes lus d'abord · « Au compte du titre » n'est un choix que sur une liste des frais LUE.
  const pret = comptes !== null && code.trim() !== '' && intitule.trim() !== '' && cote !== '' && compteTitreId !== '';
  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi || !pret) return;
    setEnvoi(true);
    try {
      await api.post('/titres-placement', { code: code.trim(), intitule: intitule.trim(), cote: cote === 'oui', compteTitreId, ...(compteFraisId ? { compteFraisId } : {}) });
      const c = code.trim().toUpperCase();
      setCode('');
      setIntitule('');
      setCote('');
      setCompteFraisId('');
      await p.onFait(`Titre ${c} ouvert · passez son acquisition avec l'avis d'opéré.`);
    } catch (err) {
      p.onRefus(err, 'Ouverture impossible');
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <form onSubmit={creer} noValidate aria-label="Nouveau titre de placement" className="border border-border bg-surface p-3 flex flex-wrap items-end gap-2">
      {erreurComptes && (
        <div role="alert" className="w-full text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">
          {erreurComptes}
        </div>
      )}
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">Code</span>
        <input value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} className="border border-border px-2 py-[2px] w-28" />
      </label>
      <label className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
        <span className="text-text-dim">Intitulé</span>
        <input value={intitule} maxLength={100} onChange={(e) => setIntitule(e.target.value)} className="border border-border px-2 py-[2px]" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">Cotation</span>
        <select value={cote} onChange={(e) => setCote(e.target.value as '' | 'oui' | 'non')} className="border border-border px-2 py-[2px]">
          <option value="">Choisir</option>
          <option value="oui">Coté</option>
          <option value="non">Non coté</option>
        </select>
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">Compte du titre</span>
        <select value={compteTitreId} onChange={(e) => setCompteTitreId(e.target.value)} className="border border-border px-2 py-[2px] max-w-[260px]">
          <option value="">{comptes === null ? 'Lecture…' : comptes.TITRE.comptes.length === 0 ? 'Aucun compte sous le 50 · personnalisez-le dans Plan comptable' : 'Choisir'}</option>
          {comptes?.TITRE.comptes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numero} · {c.intitule}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">Compte des frais</span>
        <select value={compteFraisId} onChange={(e) => setCompteFraisId(e.target.value)} className="border border-border px-2 py-[2px] max-w-[260px]">
          <option value="">{comptes === null ? (erreurComptes ? 'Comptes illisibles' : 'Lecture…') : 'Au compte du titre'}</option>
          {comptes?.FRAIS.comptes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numero} · {c.intitule}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={envoi || !pret} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
        {envoi ? '…' : 'Ouvrir le titre'}
      </button>
    </form>
  );
}

// ----- Acquisition et cession --------------------------------------------------------

function ModaleMouvement(p: { titre: Titre; nature: Nature; banques: JournalTitre[]; onFermer: () => void; onFait: (m: string) => Promise<void>; onRelire: (err: unknown, defaut: string) => void }) {
  const [c, setC] = useState<ChampsMouvement>({ journalBanqueId: p.banques.length === 1 ? p.banques[0].id : '', date: '', quantite: '', prix: '', frais: '', reference: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const premier = useRef<HTMLSelectElement>(null);
  useEffect(() => premier.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const cession = p.nature === 'CESSION';
  const maj = (k: keyof ChampsMouvement) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setC((v) => ({ ...v, [k]: e.target.value }));
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const lu = corpsMouvement(c);
    if ('refus' in lu) {
      setErreur(lu.refus);
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ resultat: number | null }>(`/titres-placement/${p.titre.id}/${cession ? 'cessions' : 'acquisitions'}`, lu.corps);
      const suite = cession && r.resultat !== null ? (r.resultat >= 0 ? ` · gain de ${fmt(r.resultat)}` : ` · perte de ${fmt(-r.resultat)}`) : '';
      await p.onFait(`${cession ? 'Cession' : 'Acquisition'} de ${parts(lu.corps.quantite)} part(s) ${p.titre.code} passée au ${date(lu.corps.date)}${suite}.`);
    } catch (err) {
      setErreur(messageDuRefus(err, cession ? 'Cession impossible' : 'Acquisition impossible'));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, cession ? 'Cession impossible' : 'Acquisition impossible');
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <CadreModale
      id="titre-modale-mouvement-titre"
      titre={`${cession ? 'Céder' : 'Acquérir'} · ${p.titre.code} · ${p.titre.intitule}`}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={envoyer}
      enfants={
        <>
          {cession && <div>Parts détenues à la clôture de l'exercice · {parts(p.titre.position.quantite)}. Le coût sorti est calculé par le serveur, premier entré, premier sorti.</div>}
          {erreur && (
            <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">
              {erreur}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5 col-span-2">
              <span className="text-text-dim">Journal de banque</span>
              <select ref={premier} value={c.journalBanqueId} onChange={maj('journalBanqueId')} className="border border-border px-2 py-[2px]">
                <option value="">{p.banques.length === 0 ? 'Aucun journal de trésorerie actif' : 'Choisir'}</option>
                {p.banques.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Date de l'avis d'opéré</span>
              <input type="date" value={c.date} onChange={maj('date')} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Référence de l'avis</span>
              <input value={c.reference} maxLength={100} onChange={maj('reference')} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Nombre de parts</span>
              <input inputMode="decimal" value={c.quantite} onChange={maj('quantite')} className="border border-border px-2 py-[2px] text-right" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">{cession ? 'Prix de cession' : "Prix d'achat"}</span>
              <input inputMode="decimal" value={c.prix} onChange={maj('prix')} className="border border-border px-2 py-[2px] text-right" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">{cession ? 'Frais de cession' : "Frais d'acquisition"}</span>
              <input inputMode="decimal" value={c.frais} onChange={maj('frais')} className="border border-border px-2 py-[2px] text-right" />
            </label>
          </div>
        </>
      }
      pied={
        <button type="submit" disabled={envoi} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
          {envoi ? '…' : cession ? 'Céder' : 'Acquérir'}
        </button>
      }
    />
  );
}

// ----- Revue de clôture --------------------------------------------------------------

function ModaleRevue(p: { titre: Titre; exerciceId: string; journauxOd: JournalTitre[]; onFermer: () => void; onFait: (m: string) => Promise<void>; onRelire: (err: unknown, defaut: string) => void }) {
  const proposee = p.titre.revueProposee;
  const [journalOdId, setJournalOdId] = useState(p.journauxOd.length === 1 ? p.journauxOd[0].id : '');
  const [valeur, setValeur] = useState('');
  const [source, setSource] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const premier = useRef<HTMLInputElement>(null);
  useEffect(() => premier.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi || !proposee) return;
    const v = valeurUnitaireLue(valeur);
    if ('refus' in v) {
      setErreur(v.refus);
      return;
    }
    if (!journalOdId) {
      setErreur("Choisissez le journal d'opérations diverses de la revue.");
      return;
    }
    if (!source.trim()) {
      setErreur('La source de la valeur est exigée (bulletin de la cote, valeur liquidative publiée, attestation).');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ ecart: number; depreciationNecessaire: number }>(`/titres-placement/${p.titre.id}/revues`, { exerciceId: p.exerciceId, journalOdId, valeurUnitaire: v.corps, nature: proposee.nature, source: source.trim() });
      const suite = r.ecart > 0 ? `dotation de ${fmt(r.ecart)}` : r.ecart < 0 ? `reprise de ${fmt(-r.ecart)}` : 'dépréciation maintenue, aucune pièce';
      await p.onFait(`Revue de ${p.titre.code} au ${date(proposee.date)} · dépréciation nécessaire ${fmt(r.depreciationNecessaire)}, ${suite}.`);
    } catch (err) {
      setErreur(messageDuRefus(err, 'Revue impossible'));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, 'Revue impossible');
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <CadreModale
      id="titre-modale-revue-titre"
      titre={`Revoir à la clôture · ${p.titre.code} · ${p.titre.intitule}`}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={envoyer}
      enfants={
        <>
          {proposee && (
            <div>
              Au {date(proposee.date)} · {parts(proposee.quantite)} part(s) pour un coût de {proposee.cout === null ? '·' : fmt(proposee.cout)} ; dépréciation en place {fmt(proposee.depreciationEnPlace)}. Valeur attendue · {LIBELLES_VALEUR[proposee.nature].toLowerCase()}.
            </div>
          )}
          {erreur && (
            <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">
              {erreur}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Valeur unitaire</span>
              <input ref={premier} inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Journal d'opérations diverses</span>
              <select value={journalOdId} onChange={(e) => setJournalOdId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">{p.journauxOd.length === 0 ? "Aucun journal d'opérations diverses actif" : 'Choisir'}</option>
                {p.journauxOd.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 col-span-2">
              <span className="text-text-dim">Source de la valeur</span>
              <input value={source} maxLength={200} onChange={(e) => setSource(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
          </div>
        </>
      }
      pied={
        <button type="submit" disabled={envoi || !proposee} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
          {envoi ? '…' : 'Revoir'}
        </button>
      }
    />
  );
}

// ----- Historique et annulations -----------------------------------------------------

function ModaleHistorique(p: { titre: Titre; peutValider: boolean; onFermer: () => void; onFait: (m: string) => Promise<void>; onRelire: (err: unknown, defaut: string) => void }) {
  const [aAnnuler, setAAnnuler] = useState<{ chemin: string; resume: string } | null>(null);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useFermetureParEchap(() => (aAnnuler ? setAAnnuler(null) : p.onFermer()), envoi);
  const cadre = useRef<HTMLDivElement>(null);
  const champMotif = useRef<HTMLInputElement>(null);
  useEffect(() => cadre.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (aAnnuler) champMotif.current?.focus({ preventScroll: true });
  }, [aAnnuler]);
  const choisir = (a: { chemin: string; resume: string }) => {
    setMotif('');
    setErreur(null);
    setAAnnuler(a);
  };
  const dernierMouvement = [...p.titre.mouvements].reverse().find((m) => !m.annuleLe) ?? null;
  const derniereRevue = [...p.titre.evaluations].reverse().find((e) => !e.annuleLe) ?? null;
  const annuler = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi || !aAnnuler || motif.trim().length < 3) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ traitement: string }>(aAnnuler.chemin, { motif: motif.trim() });
      await p.onFait(`${aAnnuler.resume} annulé · ${r.traitement === 'INSCRITE_EN_NEGATIF' ? 'pièce inscrite en négatif' : r.traitement === 'SUPPRIMEE' ? 'pièce du brouillard retirée' : 'aucune pièce'}.`);
    } catch (err) {
      setErreur(messageDuRefus(err, 'Annulation impossible'));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, 'Annulation impossible');
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <CadreModale
      id="titre-modale-historique-titre"
      titre={`Historique · ${p.titre.code} · ${p.titre.intitule}`}
      onFermer={p.onFermer}
      envoi={envoi}
      large
      focus={cadre}
      onSubmit={annuler}
      enfants={
        <>
          {erreur && (
            <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">
              {erreur}
            </div>
          )}
          <table className="w-full">
            <caption className="text-left font-semibold pb-1">Mouvements</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left px-2 py-1">Date</th>
                <th scope="col" className="text-left px-2 py-1">Nature</th>
                <th scope="col" className="text-right px-2 py-1">Parts</th>
                <th scope="col" className="text-right px-2 py-1">Prix</th>
                <th scope="col" className="text-right px-2 py-1">Frais</th>
                <th scope="col" className="text-right px-2 py-1">Coût sorti</th>
                <th scope="col" className="text-right px-2 py-1">Résultat</th>
                <th scope="col" className="text-left px-2 py-1">Pièce</th>
                <th scope="col" className="text-left px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {p.titre.mouvements.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-1 text-text-dim">
                    Aucun mouvement.
                  </td>
                </tr>
              )}
              {p.titre.mouvements.map((m) => (
                <tr key={m.id} className={`border-t border-border ${m.annuleLe ? 'text-text-dim line-through' : ''}`}>
                  <td className="px-2 py-1">{date(m.date)}</td>
                  <td className="px-2 py-1">{m.libelle}</td>
                  <td className="px-2 py-1 text-right">{parts(m.quantite)}</td>
                  <td className="px-2 py-1 text-right">{fmt(m.prix)}</td>
                  <td className="px-2 py-1 text-right">{fmt(m.frais)}</td>
                  <td className="px-2 py-1 text-right">{m.coutPrixSorti === null ? '·' : fmt(m.coutPrixSorti + (m.coutFraisSorti ?? 0))}</td>
                  <td className="px-2 py-1 text-right">{m.resultat === null ? '·' : fmt(m.resultat)}</td>
                  <td className="px-2 py-1">
                    {piece(m.ecriture)}
                    {m.ecritureNegatif && <div>négatif {piece(m.ecritureNegatif)}</div>}
                  </td>
                  <td className="px-2 py-1">
                    {p.peutValider && dernierMouvement?.id === m.id && !aAnnuler && (
                      <button type="button" onClick={() => choisir({ chemin: `/titres-placement/${p.titre.id}/mouvements/${m.id}/annuler`, resume: `${m.libelle} du ${date(m.date)}` })} className="px-2 py-[1px] border border-border text-danger">
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full">
            <caption className="text-left font-semibold pb-1">Revues de clôture</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left px-2 py-1">Date</th>
                <th scope="col" className="text-right px-2 py-1">Valeur unitaire</th>
                <th scope="col" className="text-left px-2 py-1">Source</th>
                <th scope="col" className="text-right px-2 py-1">Nécessaire</th>
                <th scope="col" className="text-right px-2 py-1">En place avant</th>
                <th scope="col" className="text-left px-2 py-1">Pièce</th>
                <th scope="col" className="text-left px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {p.titre.evaluations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-1 text-text-dim">
                    Aucune revue.
                  </td>
                </tr>
              )}
              {p.titre.evaluations.map((e) => (
                <tr key={e.id} className={`border-t border-border ${e.annuleLe ? 'text-text-dim line-through' : ''}`}>
                  <td className="px-2 py-1">{date(e.date)}</td>
                  <td className="px-2 py-1 text-right">{fmt(e.valeurUnitaire)}</td>
                  <td className="px-2 py-1">{e.source}</td>
                  <td className="px-2 py-1 text-right">{fmt(e.depreciationNecessaire)}</td>
                  <td className="px-2 py-1 text-right">{fmt(e.depreciationEnPlace)}</td>
                  <td className="px-2 py-1">
                    {e.ecriture ? piece(e.ecriture) : 'Aucune (maintenue)'}
                    {e.ecritureNegatif && <div>négatif {piece(e.ecritureNegatif)}</div>}
                  </td>
                  <td className="px-2 py-1">
                    {p.peutValider && derniereRevue?.id === e.id && !aAnnuler && (
                      <button type="button" onClick={() => choisir({ chemin: `/titres-placement/${p.titre.id}/revues/${e.id}/annuler`, resume: `La revue du ${date(e.date)}` })} className="px-2 py-[1px] border border-border text-danger">
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {aAnnuler && (
            <div className="border border-border p-2 space-y-1">
              <div>Annuler · {aAnnuler.resume}</div>
              <label className="flex flex-col gap-0.5">
                <span className="text-text-dim">Motif</span>
                <input ref={champMotif} required minLength={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className="border border-border px-2 py-[2px]" />
              </label>
            </div>
          )}
        </>
      }
      pied={
        aAnnuler ? (
          <button type="submit" disabled={envoi || motif.trim().length < 3} className="bg-danger text-white font-semibold px-3 py-1 disabled:opacity-40">
            {envoi ? '…' : 'Confirmer l’annulation'}
          </button>
        ) : null
      }
    />
  );
}
