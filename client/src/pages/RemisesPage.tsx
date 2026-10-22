import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { useGardeFermeture } from '../lib/fenetres';
import { ecouterEchap } from '../lib/echap';
import { montant as fmt } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';
import { Aide } from '../components/chrome/Aide';
import { PortailModale } from '../components/PortailModale';

/**
 * REMISES EN BANQUE · Traitement > Tiers et trésorerie (ligne sage-l3,
 * fonction 40 · chez Sage, « Moyens de paiement », remise en deux temps). Le
 * chèque ou la carte REÇU du tiers (513 ou 515, par le crédit du tiers), le
 * BORDEREAU qui le remet à la banque (514 pour les chèques), l'AVIS DE
 * CRÉDIT qui solde le 51 par la banque (commission en services bancaires),
 * et l'IMPAYÉ au 413. Règles au serveur (src/modules/remises/), l'écran ne
 * les refait pas · il propose, le serveur juge. Les types de remise sont une
 * structure (administrateur), sous Structure > Paramètres de saisie.
 */

type Nature = 'CHEQUES' | 'CARTES';
type StatutValeur = 'RECUE' | 'REMISE' | 'CREDITEE' | 'IMPAYEE' | 'ANNULEE';
type StatutRemise = 'REMISE' | 'CREDITEE' | 'ANNULEE';
type Onglet = 'valeurs' | 'remises' | 'types';

const LIBELLES_NATURE: Record<Nature, string> = { CHEQUES: 'Chèques', CARTES: 'Cartes de crédit' };
const LIBELLES_STATUT_VALEUR: Record<StatutValeur, string> = {
  RECUE: 'Reçue, non remise',
  REMISE: 'Remise en banque',
  CREDITEE: 'Créditée',
  IMPAYEE: 'Revenue impayée',
  ANNULEE: 'Annulée',
};
const LIBELLES_STATUT_REMISE: Record<StatutRemise, string> = { REMISE: 'Remise à la banque', CREDITEE: 'Créditée', ANNULEE: 'Annulée' };
const ONGLETS: ReadonlyArray<{ cle: Onglet; libelle: string }> = [
  { cle: 'valeurs', libelle: 'Valeurs reçues' },
  { cle: 'remises', libelle: 'Bordereaux de remise' },
  { cle: 'types', libelle: 'Types de remise' },
];

interface CompteServi {
  id: string;
  numero: string;
  intitule: string;
}
interface JournalServi {
  id: string;
  code: string;
  intitule: string;
  type: string;
  estActif: boolean;
}
interface TypeRemise {
  id: string;
  code: string;
  intitule: string;
  nature: Nature;
  estActif: boolean;
  modeleBordereau: string | null;
  journalBanque: { id: string; code: string };
  journalOperations: { id: string; code: string };
  compteReception: CompteServi;
  compteTransit: CompteServi | null;
  compteCommission: CompteServi | null;
}
interface Piece {
  numeroPiece: string | null;
  statut: string;
}
/** Un avis de crédit ou un impayé annulé · sa paire est à l'historique, la remise ou la valeur reste libre (second tour, BLOQUANT B1). */
interface Annulation {
  id: string;
  nature: 'AVIS_CREDIT' | 'IMPAYE';
  traitement: 'SUPPRIMEE' | 'INSCRITE_EN_NEGATIF';
  numeroPieceOrigine: number | null;
  motif: string;
  annuleeLe: string;
  ecritureNegatif: Piece | null;
}
/** Ce qu'une annulation rend · la trace de la pièce retirée ou inscrite en négatif. */
interface ReponseAnnulation {
  ecritureNegatifReceptionId?: string | null;
  ecritureNegatifRemiseId?: string | null;
  annulation?: { traitement: 'SUPPRIMEE' | 'INSCRITE_EN_NEGATIF' };
}
interface Valeur {
  id: string;
  date: string;
  montant: number;
  reference: string;
  banqueTiree: string | null;
  titulaire: string | null;
  statut: StatutValeur;
  dateImpaye: string | null;
  typeRemise: { id: string; code: string; intitule: string; nature: Nature };
  compteTiersId: string;
  compteTiers: { numero: string; intitule: string };
  ecritureReception: Piece | null;
  ecritureImpaye: Piece | null;
  remise: { id: string; numero: number; statut: StatutRemise } | null;
  annulations: Annulation[];
}
interface Remise {
  id: string;
  numero: number;
  date: string;
  total: number;
  nombre: number;
  commission: number | null;
  referenceAvis: string | null;
  dateCredit: string | null;
  statut: StatutRemise;
  nombreImpressions: number;
  typeRemise: { id: string; code: string; intitule: string; nature: Nature };
  journalBanque: { code: string };
  ecritureRemise: Piece | null;
  ecritureCredit: Piece | null;
  annulations: Annulation[];
  _count: { valeurs: number };
}
interface Liste {
  total: number;
  tronque: boolean;
}
interface ListeValeurs extends Liste {
  valeurs: Valeur[];
}
interface ListeRemises extends Liste {
  remises: Remise[];
}
interface ListeTypes extends Liste {
  types: TypeRemise[];
}
interface ComptesDuRole {
  racine: string | null;
  comptes: Array<CompteServi & { estRetenu: boolean }>;
  motif: string | null;
  total?: number;
  tronque?: boolean;
}
interface GroupeEcheance {
  compteId: string;
  lignes: Array<{ id: string; libelle: string; montantDu: number; dateEcheance: string | null; reference?: string | null }>;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
/**
 * UN 5xx OU UNE RÉPONSE PERDUE N'EST PAS UN REFUS (relecture React, 4) · le
 * serveur a pu passer la réception avant que la réponse ne se perde ; dit
 * « impossible », le comptable recliquait et le 513 était débité deux fois.
 * Un refus nommé (4xx) s'affiche tel quel.
 */
const messageDuRefus = (err: unknown, defaut: string) =>
  err instanceof ApiError && err.status < 500 ? err.message : `${defaut} · réponse perdue, le geste a pu passer. Relisez la liste avant de le refaire.`;
const piece = (p: Piece | null) => (p ? `n° ${p.numeroPiece ?? '·'}${p.statut === 'BROUILLARD' ? ' (brouillard)' : ''}` : '·');
/** Une liste de comptes bornée à deux cents le dit (second tour, m3) · un dossier à plus de sous-comptes ne lisait pas le sien. */
const listeTronquee = (lus: ComptesDuRole | null) =>
  lus?.tronque ? <span className="text-text-dim">{lus.comptes.length} comptes montrés sur {lus.total} · un compte absent se cherche dans Plan comptable.</span> : null;
const annulationDite = (a: Annulation | undefined, objet: string) =>
  a ? `${objet} annulé le ${date(a.annuleeLe)}${a.traitement === 'INSCRITE_EN_NEGATIF' ? ` · négatif ${piece(a.ecritureNegatif)}` : ' · pièce du brouillard retirée'}` : null;

export function RemisesPage({ ongletInitial = 'valeurs' }: { ongletInitial?: Onglet }) {
  const { peutEcrire, peutValider, estAdmin } = useAuth();
  const { exerciceCourant } = useExercice();
  const exerciceId = exerciceCourant?.id ?? null;
  const exerciceClos = exerciceCourant?.statut === 'CLOTURE';
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial);
  // null tant que rien n'est lu · « aucune valeur » ne se dit que sur une liste lue.
  const [types, setTypes] = useState<ListeTypes | null>(null);
  const [valeurs, setValeurs] = useState<ListeValeurs | null>(null);
  const [remises, setRemises] = useState<ListeRemises | null>(null);
  const [journaux, setJournaux] = useState<JournalServi[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const bandeauErreur = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (erreur) bandeauErreur.current?.focus({ preventScroll: false });
  }, [erreur]);

  // Une réponse d'un exercice quitté est jetée (même garde que les virements).
  const exerciceAffiche = useRef(exerciceId);
  exerciceAffiche.current = exerciceId;
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    const n = ++jeton.current;
    const garde = () => n === jeton.current && exerciceId === exerciceAffiche.current;
    try {
      const [t, j] = await Promise.all([api.get<ListeTypes>('/remises/types'), api.get<JournalServi[]>('/journaux')]);
      if (!garde()) return;
      setTypes(t);
      setJournaux(j);
      if (exerciceId) {
        const [v, r] = await Promise.all([api.get<ListeValeurs>(`/remises/valeurs?exerciceId=${exerciceId}`), api.get<ListeRemises>(`/remises?exerciceId=${exerciceId}`)]);
        if (!garde()) return;
        setValeurs(v);
        setRemises(r);
      }
      setErreur(null);
    } catch (err) {
      if (garde()) setErreur(err instanceof ApiError ? err.message : 'Remises illisibles');
    }
  }, [exerciceId]);
  useEffect(() => {
    setValeurs(null);
    setRemises(null);
    setInfo(null);
    setErreur(null);
    void charger();
  }, [charger]);

  const fait = async (message: string) => {
    setInfo(message);
    setErreur(null);
    await charger();
  };
  const refus = useCallback(
    (err: unknown, defaut: string) => {
      setErreur(messageDuRefus(err, defaut));
      // Réponse perdue · la liste est relue, l'issue réelle s'y lit.
      if (!(err instanceof ApiError && err.status < 500)) void charger();
    },
    [charger],
  );
  // Le bordereau à imprimer · rendu DANS la page, sous `impression-seul`,
  // le reste de la fenêtre caché à l'impression (`avec-edition`), comme les
  // bulletins de paie · imprimé depuis la modale, le voile grisait la page et
  // la fenêtre entière sortait sur le papier (relecture React, 3).
  const [document, setDocument] = useState<{ numero: number; texte: string; duplicata: boolean } | null>(null);

  const typesActifs = useMemo(() => (types?.types ?? []).filter((t) => t.estActif), [types]);
  // UNE SEULE GARDE DE FERMETURE PAR FENÊTRE (second tour React, M1) ·
  // `useGardeFermeture` tient UNE garde par fenêtre ; appelée par deux
  // onglets, la seconde remplaçait la première, et la réception à moitié
  // tapée dans l'onglet caché ne retenait plus la fermeture. Chaque onglet
  // remonte son motif, la page compose.
  const [gardes, setGardes] = useState<{ valeurs: string | null; remises: string | null }>({ valeurs: null, remises: null });
  const garderValeurs = useCallback((m: string | null) => setGardes((g) => (g.valeurs === m ? g : { ...g, valeurs: m })), []);
  const garderRemises = useCallback((m: string | null) => setGardes((g) => (g.remises === m ? g : { ...g, remises: m })), []);
  useGardeFermeture(gardes.valeurs ?? gardes.remises);

  return (
    <div className="p-3 space-y-3 text-[11.5px] avec-edition">
      {document && (
        <pre className="impression-seul hidden whitespace-pre-wrap font-mono text-[11px]" aria-hidden="true">
          {document.texte}
        </pre>
      )}
      {erreur && (
        <div ref={bandeauErreur} tabIndex={-1} role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">
          {erreur}
        </div>
      )}
      <div role="status" aria-live="polite">
        {info && <div className="text-ok bg-ok-soft border border-ok/30 px-3 py-2">{info}</div>}
      </div>
      <div className="flex items-center justify-between">
        <div role="tablist" className="flex gap-1 border-b border-border flex-1">
          {ONGLETS.map((o) => (
            <button
              key={o.cle}
              type="button"
              role="tab"
              id={`onglet-remises-${o.cle}`}
              aria-selected={onglet === o.cle}
              aria-controls={`panneau-remises-${o.cle}`}
              onClick={() => setOnglet(o.cle)}
              className={`onglet ${onglet === o.cle ? 'onglet-actif' : ''}`}
            >
              {o.libelle}
            </button>
          ))}
        </div>
        <Aide
          titre="Remises en banque"
          texte="Un chèque reçu d'un tiers entre au 513 « Chèques à encaisser » (une carte au 515) par le crédit du tiers ; le bordereau le remet à la banque, au 514 « Chèques à l'encaissement » ; l'avis de crédit de la banque solde le 51 par le compte de banque, la commission prélevée en services bancaires (6315). Une valeur revenue impayée va au 413 (chèques, cartes impayés), jamais au compte du tiers. À la clôture, le 51 doit porter les chèques non encore remis · le module le tient en permanence. Chaque geste s'annule avec son motif · au brouillard la pièce est retirée, validée elle est inscrite en négatif."
          source="AUDCIF Titre VII, comptes 41 (413), 51 et 63 (6315) ; SYCEBNL Partie 2 ch. 3, comptes 41, 51 et 63 ; AUDCIF art. 17, art. 20, al. 2"
        />
      </div>
      {!exerciceId && <div className="text-text-dim">Aucun exercice · ouvrez-en un dans Exercices.</div>}
      {/* Les trois onglets restent MONTÉS (relecture React, 5) · démontés, un clic sur « Bordereaux » perdait la réception à moitié tapée. */}
      <div role="tabpanel" id="panneau-remises-valeurs" aria-labelledby="onglet-remises-valeurs" hidden={onglet !== 'valeurs'}>
        <OngletValeurs
          exerciceId={exerciceId}
          exerciceClos={exerciceClos}
          bornes={exerciceCourant ? { debut: exerciceCourant.dateDebut.slice(0, 10), fin: exerciceCourant.dateFin.slice(0, 10) } : null}
          types={typesActifs}
          typesLus={types !== null}
          valeurs={valeurs}
          peutEcrire={peutEcrire}
          peutValider={peutValider}
          onFait={fait}
          onRefus={refus}
          onGarde={garderValeurs}
        />
      </div>
      <div role="tabpanel" id="panneau-remises-remises" aria-labelledby="onglet-remises-remises" hidden={onglet !== 'remises'}>
        <OngletRemises
          exerciceId={exerciceId}
          exerciceClos={exerciceClos}
          bornes={exerciceCourant ? { debut: exerciceCourant.dateDebut.slice(0, 10), fin: exerciceCourant.dateFin.slice(0, 10) } : null}
          types={typesActifs}
          remises={remises}
          peutEcrire={peutEcrire}
          peutValider={peutValider}
          onFait={fait}
          onRefus={refus}
          onDocument={setDocument}
          onGarde={garderRemises}
        />
      </div>
      <div role="tabpanel" id="panneau-remises-types" aria-labelledby="onglet-remises-types" hidden={onglet !== 'types'}>
        <OngletTypes types={types} journaux={journaux} estAdmin={estAdmin} onFait={fait} onRefus={refus} />
      </div>
      {document && (
        <ModaleDocument titre={`Bordereau de remise n° ${document.numero}${document.duplicata ? ' · duplicata' : ''}`} texte={document.texte} onFermer={() => setDocument(null)} />
      )}
    </div>
  );
}

// ----- Valeurs reçues -------------------------------------------------------

function OngletValeurs(p: {
  exerciceId: string | null;
  exerciceClos: boolean;
  bornes: { debut: string; fin: string } | null;
  types: TypeRemise[];
  typesLus: boolean;
  valeurs: ListeValeurs | null;
  peutEcrire: boolean;
  peutValider: boolean;
  onFait: (m: string) => Promise<void>;
  onRefus: (e: unknown, d: string) => void;
  onGarde: (motif: string | null) => void;
}) {
  const [typeId, setTypeId] = useState('');
  const [tiers, setTiers] = useState<CompteServi[] | null>(null);
  const [tiersId, setTiersId] = useState('');
  const [jour, setJour] = useState('');
  const [somme, setSomme] = useState('');
  const [reference, setReference] = useState('');
  const [banqueTiree, setBanqueTiree] = useState('');
  const [titulaire, setTitulaire] = useState('');
  const [echeances, setEcheances] = useState<GroupeEcheance[] | null>(null);
  // Un échec de lecture n'est pas « aucune ligne ouverte » (§ 9 ter) · lu
  // ainsi, le comptable recevait le chèque sans lettrage en croyant la
  // créance déjà réglée (relecture, M2).
  const [erreurEcheances, setErreurEcheances] = useState<string | null>(null);
  // Relues après chaque réception · les lignes qui viennent d'être lettrées
  // restaient cochables pour le chèque suivant (relecture React, 10).
  const [version, setVersion] = useState(0);
  const [lignesChoisies, setLignesChoisies] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<Valeur | null>(null);
  const [aDeclarerImpayee, setADeclarerImpayee] = useState<Valeur | null>(null);
  const [impayeAAnnuler, setImpayeAAnnuler] = useState<Valeur | null>(null);

  // Un choix unique se présélectionne (§ 9 ter) ; un type mis en sommeil
  // entre-temps quitte le choix (second tour React, m6).
  useEffect(() => {
    if (!typeId && p.types.length === 1) setTypeId(p.types[0].id);
    if (typeId && !p.types.some((t) => t.id === typeId)) setTypeId('');
  }, [typeId, p.types]);
  // Les comptes de tiers · la liste du plan sous sa règle (retenus ou
  // utilisés), bornée à la classe 4 à l'écran, jugée au serveur. Lue pour
  // qui peut recevoir seulement. `onRefus` lu par une référence (second
  // tour React, m4) · dans les dépendances, chaque relecture de la page la
  // faisait relire les comptes.
  const { peutEcrire } = p;
  const onRefus = useRef(p.onRefus);
  onRefus.current = p.onRefus;
  useEffect(() => {
    if (!peutEcrire) return;
    let vivant = true;
    api
      .get<CompteServi[]>('/comptes?actifsSeuls=true&typeCompte=DETAIL&retenus=true')
      .then((c) => vivant && setTiers(c.filter((x) => x.numero.startsWith('4'))))
      .catch((e) => vivant && onRefus.current(e, 'Comptes de tiers illisibles'));
    return () => {
      vivant = false;
    };
  }, [peutEcrire]);
  // Les lignes ouvertes du tiers choisi · ce que le chèque règle.
  useEffect(() => {
    setLignesChoisies([]);
    setEcheances(null);
    setErreurEcheances(null);
    if (!tiersId || !p.exerciceId) return;
    let vivant = true;
    api
      .get<GroupeEcheance[]>(`/reglements/echeances?exerciceId=${p.exerciceId}&sens=CLIENT`)
      .then((g) => vivant && setEcheances(g.filter((x) => x.compteId === tiersId)))
      .catch((e) => vivant && setErreurEcheances(e instanceof ApiError ? e.message : 'Lignes ouvertes du tiers illisibles · relancez la lecture en rechoisissant le tiers.'));
    return () => {
      vivant = false;
    };
  }, [tiersId, p.exerciceId, version]);

  const type = p.types.find((t) => t.id === typeId) ?? null;
  const valeur = montantSaisi(somme);
  const manque = (): string | null => {
    if (!p.exerciceId) return 'Choisissez un exercice.';
    if (p.exerciceClos) return 'Cet exercice est clôturé.';
    if (!type) return 'Choisissez le type de remise.';
    if (!tiersId) return 'Choisissez le compte du tiers.';
    if (erreurEcheances) return 'Les lignes ouvertes du tiers sont illisibles · rechoisissez le tiers.';
    if (echeances === null) return 'Lecture des lignes ouvertes du tiers…';
    if (!jour) return 'La date de réception est exigée.';
    if (valeur === null || valeur <= 0) return 'Le montant doit être un nombre positif.';
    if (!reference.trim()) return 'La référence (numéro du chèque, transaction) est exigée.';
    return null;
  };
  const formulaireEntame = !!(somme || reference || banqueTiree || titulaire || lignesChoisies.length > 0);
  const motifGarde = envoi ? 'La réception est en cours d’envoi · fermer maintenant laisserait son issue inconnue.' : formulaireEntame ? 'Une valeur est en cours de saisie et n’est pas reçue.' : null;
  const { onGarde } = p;
  useEffect(() => {
    onGarde(motifGarde);
    return () => onGarde(null);
  }, [motifGarde, onGarde]);
  const recevoir = async (e: FormEvent) => {
    e.preventDefault();
    if (manque()) return;
    setEnvoi(true);
    try {
      const r = await api.post<{ lettre: string | null; avertissement: string | null }>('/remises/valeurs', {
        exerciceId: p.exerciceId,
        typeRemiseId: typeId,
        compteTiersId: tiersId,
        date: jour,
        montant: valeur,
        reference: reference.trim(),
        banqueTiree: banqueTiree.trim() || undefined,
        titulaire: titulaire.trim() || undefined,
        ligneIds: lignesChoisies.length > 0 ? lignesChoisies : undefined,
      });
      setSomme('');
      setReference('');
      setBanqueTiree('');
      setTitulaire('');
      setLignesChoisies([]);
      setVersion((v) => v + 1);
      await p.onFait(`Valeur reçue au ${type!.compteReception.numero}${r.lettre ? ` · lettrée ${r.lettre} avec les factures choisies` : ''}.${r.avertissement ? ` ${r.avertissement}` : ''}`);
    } catch (err) {
      p.onRefus(err, 'Réception impossible');
    } finally {
      setEnvoi(false);
    }
  };
  const lignesOuvertes = echeances?.flatMap((g) => g.lignes) ?? [];

  return (
    <div className="space-y-3">
      {p.peutEcrire && (
        <form onSubmit={recevoir} noValidate className="border border-border bg-surface p-3 space-y-2">
          <div className="font-semibold">Recevoir un chèque ou un paiement par carte</div>
          {p.typesLus && p.types.length === 0 && <div className="text-text-dim">Aucun type de remise actif · créez-en un sous l'onglet « Types de remise » (administrateur).</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Type de remise</span>
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">·</option>
                {p.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.intitule} ({LIBELLES_NATURE[t.nature]})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Compte du tiers</span>
              <select value={tiersId} onChange={(e) => setTiersId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">{tiers === null ? '…' : tiers.length === 0 ? 'Aucun compte de tiers personnalisé · personnalisez-le dans Plan comptable' : '·'}</option>
                {(tiers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Date de réception</span>
              <input type="date" value={jour} min={p.bornes?.debut} max={p.bornes?.fin} onChange={(e) => setJour(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Montant</span>
              <input inputMode="decimal" value={somme} onChange={(e) => setSomme(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">{type?.nature === 'CARTES' ? 'Référence de la transaction' : 'Numéro du chèque'}</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">{type?.nature === 'CARTES' ? 'Réseau' : 'Banque tirée'}</span>
              <input value={banqueTiree} onChange={(e) => setBanqueTiree(e.target.value)} maxLength={120} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Titulaire</span>
              <input value={titulaire} onChange={(e) => setTitulaire(e.target.value)} maxLength={120} className="border border-border px-2 py-[2px]" />
            </label>
          </div>
          {tiersId && (
            <fieldset className="border border-border p-2">
              <legend className="px-1 text-text-dim" title="Lettrage manuel, partiel admis · jamais plus que le dû">
                Factures réglées par cette valeur
              </legend>
              {erreurEcheances ? (
                <div className="text-danger">{erreurEcheances}</div>
              ) : echeances === null ? (
                <div className="text-text-dim">…</div>
              ) : lignesOuvertes.length === 0 ? (
                <div className="text-text-dim">Aucune ligne ouverte sur ce compte · la valeur reste non lettrée.</div>
              ) : (
                lignesOuvertes.map((l) => (
                  <label key={l.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lignesChoisies.includes(l.id)}
                      onChange={(e) => setLignesChoisies((c) => (e.target.checked ? [...c, l.id] : c.filter((x) => x !== l.id)))}
                    />
                    <span>
                      {l.libelle} · {l.dateEcheance ? `échéance ${date(l.dateEcheance)} · ` : ''}
                      {fmt(l.montantDu)}
                    </span>
                  </label>
                ))
              )}
            </fieldset>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={envoi || manque() !== null} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
              {envoi ? '…' : 'Recevoir'}
            </button>
            {manque() && <span className="text-text-dim">{manque()}</span>}
          </div>
        </form>
      )}
      <div className="overflow-auto">
        {!p.exerciceId ? null : p.valeurs === null ? (
          <div className="text-text-dim">Lecture…</div>
        ) : p.valeurs.valeurs.length === 0 ? (
          <div className="text-text-dim">Aucune valeur reçue sur cet exercice.</div>
        ) : (
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th scope="col" className="text-left px-2 py-1">Date</th>
                <th scope="col" className="text-left px-2 py-1">Type</th>
                <th scope="col" className="text-left px-2 py-1">Tiers</th>
                <th scope="col" className="text-left px-2 py-1">Référence</th>
                <th scope="col" className="text-left px-2 py-1">Banque tirée</th>
                <th scope="col" className="text-right px-2 py-1 w-[120px]">Montant</th>
                <th scope="col" className="text-left px-2 py-1">Statut</th>
                <th scope="col" className="text-left px-2 py-1">Pièce</th>
                <th scope="col" className="text-left px-2 py-1">Remise</th>
                <th scope="col" className="text-left px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {p.valeurs.valeurs.map((v) => (
                <tr key={v.id} className={v.statut === 'ANNULEE' ? 'text-text-dim line-through' : ''}>
                  <td className="px-2 py-1">{date(v.date)}</td>
                  <td className="px-2 py-1">{v.typeRemise.code}</td>
                  <td className="px-2 py-1">
                    {v.compteTiers.numero} · {v.compteTiers.intitule}
                  </td>
                  <td className="px-2 py-1">{v.reference}</td>
                  <td className="px-2 py-1">{v.banqueTiree ?? '·'}</td>
                  <td className="px-2 py-1 text-right">{fmt(v.montant)}</td>
                  <td className="px-2 py-1">
                    {LIBELLES_STATUT_VALEUR[v.statut]}
                    {v.dateImpaye && ` le ${date(v.dateImpaye)}`}
                  </td>
                  <td className="px-2 py-1">
                    {piece(v.ecritureReception)}
                    {v.ecritureImpaye && <div>impayé {piece(v.ecritureImpaye)}</div>}
                    {v.annulations.length > 0 && (
                      <div className="text-text-dim">
                        {annulationDite(v.annulations[0], 'impayé')}
                        {v.annulations.length > 1 ? ` (${v.annulations.length} annulations)` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1">{v.remise ? `n° ${v.remise.numero}` : '·'}</td>
                  <td className="px-2 py-1 space-x-2">
                    {p.peutValider && v.statut === 'RECUE' && (
                      <button type="button" aria-label={`Annuler la réception de ${v.reference}`} onClick={() => setAAnnuler(v)} className="text-danger hover:underline">
                        Annuler la réception
                      </button>
                    )}
                    {p.peutEcrire && (v.statut === 'REMISE' || v.statut === 'CREDITEE') && (
                      <button type="button" aria-label={`Impayé de ${v.reference}`} onClick={() => setADeclarerImpayee(v)} className="text-sel hover:underline">
                        Impayé
                      </button>
                    )}
                    {p.peutValider && v.statut === 'IMPAYEE' && (
                      <button type="button" aria-label={`Annuler l'impayé de ${v.reference}`} onClick={() => setImpayeAAnnuler(v)} className="text-danger hover:underline">
                        Annuler l'impayé
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {p.valeurs?.tronque && <div className="text-text-dim mt-1">{p.valeurs.valeurs.length} valeurs montrées sur {p.valeurs.total}.</div>}
      </div>
      {aAnnuler && (
        <ModaleMotif
          titre={`Annuler la réception de ${aAnnuler.reference}`}
          resume={`${aAnnuler.compteTiers.intitule} · ${fmt(aAnnuler.montant)} · pièce ${piece(aAnnuler.ecritureReception)}`}
          action="Annuler la réception"
          chemin={`/remises/valeurs/${aAnnuler.id}/annuler`}
          onFermer={() => setAAnnuler(null)}
          onFait={async (r) => {
            setAAnnuler(null);
            await p.onFait(r.ecritureNegatifReceptionId ? 'Réception annulée · la pièce validée est inscrite en négatif.' : 'Réception annulée · la pièce du brouillard est retirée.');
          }}
        />
      )}
      {aDeclarerImpayee && <ModaleImpaye valeur={aDeclarerImpayee} onFermer={() => setADeclarerImpayee(null)} onFait={p.onFait} />}
      {impayeAAnnuler && (
        <ModaleMotif
          titre={`Annuler l'impayé de ${impayeAAnnuler.reference}`}
          resume={`${impayeAAnnuler.compteTiers.intitule} · ${fmt(impayeAAnnuler.montant)} · pièce ${piece(impayeAAnnuler.ecritureImpaye)}`}
          action="Annuler l'impayé"
          chemin={`/remises/valeurs/${impayeAAnnuler.id}/impaye/annuler`}
          onFermer={() => setImpayeAAnnuler(null)}
          onFait={async (r) => {
            setImpayeAAnnuler(null);
            await p.onFait(r.annulation?.traitement === 'INSCRITE_EN_NEGATIF' ? 'Impayé annulé · la pièce validée est inscrite en négatif, la valeur peut être redéclarée impayée.' : 'Impayé annulé · la pièce du brouillard est retirée.');
          }}
        />
      )}
    </div>
  );
}

// ----- Bordereaux -------------------------------------------------------------

interface Candidate {
  id: string;
  date: string;
  montant: number;
  reference: string;
  compteTiers: { numero: string; intitule: string };
  exercice: { id: string; libelle: string };
}
interface ListeCandidates extends Liste {
  valeurs: Candidate[];
}

function OngletRemises(p: {
  exerciceId: string | null;
  exerciceClos: boolean;
  bornes: { debut: string; fin: string } | null;
  types: TypeRemise[];
  remises: ListeRemises | null;
  peutEcrire: boolean;
  peutValider: boolean;
  onFait: (m: string) => Promise<void>;
  onRefus: (e: unknown, d: string) => void;
  onDocument: (d: { numero: number; texte: string; duplicata: boolean }) => void;
  onGarde: (motif: string | null) => void;
}) {
  const [typeId, setTypeId] = useState('');
  const [jour, setJour] = useState('');
  const [choisies, setChoisies] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [aCrediter, setACrediter] = useState<Remise | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Remise | null>(null);
  const [avisAAnnuler, setAvisAAnnuler] = useState<Remise | null>(null);
  // LES CANDIDATES AU BORDEREAU, SANS BORNE D'EXERCICE (relecture, M1) · un
  // chèque reçu en décembre se remet en janvier ; tirées de la liste de
  // l'exercice courant, les valeurs de N n'apparaissaient plus en N+1 et le
  // 513 les gardait pour toujours. Lues à part, relues après chaque geste.
  const [candidates, setCandidates] = useState<ListeCandidates | null>(null);
  const [erreurCandidates, setErreurCandidates] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!typeId && p.types.length === 1) setTypeId(p.types[0].id);
    if (typeId && !p.types.some((t) => t.id === typeId)) setTypeId('');
  }, [typeId, p.types]);
  // Les cases cochées ne se vident qu'au changement de type (second tour
  // React, m2) · vidées à chaque relecture des candidates, un geste sur un
  // autre onglet effaçait la sélection en cours ; une valeur partie de la
  // liste sort d'elle-même des cochées (`choisiesValides`).
  useEffect(() => setChoisies([]), [typeId]);
  useEffect(() => {
    setCandidates(null);
    setErreurCandidates(null);
    if (!typeId || !p.peutEcrire) return;
    let vivant = true;
    api
      .get<ListeCandidates>(`/remises/valeurs/a-remettre?typeRemiseId=${encodeURIComponent(typeId)}`)
      .then((c) => vivant && setCandidates(c))
      .catch((e) => vivant && setErreurCandidates(e instanceof ApiError ? e.message : 'Valeurs à remettre illisibles · rechoisissez le type.'));
    return () => {
      vivant = false;
    };
  }, [typeId, p.peutEcrire, version, p.remises]);
  const type = p.types.find((t) => t.id === typeId) ?? null;
  const lignes = candidates?.valeurs ?? [];
  // Une valeur sortie de la liste (remise par un autre poste) ne compte plus.
  const choisiesValides = choisies.filter((id) => lignes.some((v) => v.id === id));
  const total = lignes.filter((v) => choisiesValides.includes(v.id)).reduce((s, v) => s + v.montant, 0);
  const manque = (): string | null => {
    if (!p.exerciceId) return 'Choisissez un exercice.';
    if (p.exerciceClos) return 'Cet exercice est clôturé.';
    if (!type) return 'Choisissez le type de remise.';
    if (erreurCandidates) return 'Les valeurs à remettre sont illisibles · rechoisissez le type.';
    if (!jour) return 'La date de la remise est exigée.';
    if (choisiesValides.length === 0) return 'Cochez au moins une valeur reçue.';
    return null;
  };
  const motifGarde = envoi ? 'Le bordereau est en cours d’envoi · fermer maintenant laisserait son issue inconnue.' : choisiesValides.length > 0 || jour ? 'Un bordereau est en cours de saisie et n’est pas établi.' : null;
  const { onGarde } = p;
  useEffect(() => {
    onGarde(motifGarde);
    return () => onGarde(null);
  }, [motifGarde, onGarde]);
  const remettre = async (e: FormEvent) => {
    e.preventDefault();
    if (manque()) return;
    setEnvoi(true);
    try {
      const r = await api.post<{ numero: number; total: number }>('/remises', { exerciceId: p.exerciceId, typeRemiseId: typeId, date: jour, valeurIds: choisiesValides });
      setChoisies([]);
      setVersion((v) => v + 1);
      await p.onFait(`Bordereau n° ${r.numero} établi · ${fmt(r.total)}${type!.nature === 'CHEQUES' && type!.compteTransit ? ` passés du ${type!.compteReception.numero} au ${type!.compteTransit.numero}` : ''}.`);
    } catch (err) {
      p.onRefus(err, 'Remise impossible');
    } finally {
      setEnvoi(false);
    }
  };
  const imprimer = async (r: Remise) => {
    try {
      const i = await api.post<{ numero: number; document: string; duplicata: boolean }>(`/remises/${r.id}/impression`, {});
      p.onDocument({ numero: i.numero, texte: i.document, duplicata: i.duplicata });
    } catch (err) {
      p.onRefus(err, 'Impression impossible');
    }
  };

  return (
    <div className="space-y-3">
      {p.peutEcrire && (
        <form onSubmit={remettre} noValidate className="border border-border bg-surface p-3 space-y-2">
          <div className="font-semibold">Remettre en banque</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Type de remise</span>
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">·</option>
                {p.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.intitule} · {t.journalBanque.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Date de la remise</span>
              <input type="date" value={jour} min={p.bornes?.debut} max={p.bornes?.fin} onChange={(e) => setJour(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
          </div>
          {type && (
            <fieldset className="border border-border p-2">
              <legend className="px-1 text-text-dim">Valeurs reçues, non remises</legend>
              {erreurCandidates ? (
                <div className="text-danger">{erreurCandidates}</div>
              ) : candidates === null ? (
                <div className="text-text-dim">…</div>
              ) : lignes.length === 0 ? (
                <div className="text-text-dim">Aucune valeur de ce type en attente de remise · recevez-la d'abord sous « Valeurs reçues ».</div>
              ) : (
                <>
                  {lignes.map((v) => (
                    <label key={v.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={choisiesValides.includes(v.id)} onChange={(e) => setChoisies((c) => (e.target.checked ? [...c, v.id] : c.filter((x) => x !== v.id)))} />
                      <span>
                        {date(v.date)} · {v.reference} · {v.compteTiers.intitule} · {fmt(v.montant)}
                        {v.exercice.id !== p.exerciceId && <span className="text-text-dim"> · exercice {v.exercice.libelle}</span>}
                      </span>
                    </label>
                  ))}
                  {candidates.tronque && <div className="text-text-dim">{lignes.length} valeurs montrées sur {candidates.total} · remettez les plus anciennes d'abord.</div>}
                </>
              )}
            </fieldset>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={envoi || manque() !== null} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
              {envoi ? '…' : 'Établir le bordereau'}
            </button>
            {choisiesValides.length > 0 && <span>{choisiesValides.length} valeur(s) · {fmt(total)}</span>}
            {manque() && <span className="text-text-dim">{manque()}</span>}
          </div>
        </form>
      )}
      <div className="overflow-auto">
        {!p.exerciceId ? null : p.remises === null ? (
          <div className="text-text-dim">Lecture…</div>
        ) : p.remises.remises.length === 0 ? (
          <div className="text-text-dim">Aucun bordereau sur cet exercice.</div>
        ) : (
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th scope="col" className="text-left px-2 py-1">N°</th>
                <th scope="col" className="text-left px-2 py-1">Date</th>
                <th scope="col" className="text-left px-2 py-1">Type</th>
                <th scope="col" className="text-left px-2 py-1">Banque</th>
                <th scope="col" className="text-right px-2 py-1">Valeurs</th>
                <th scope="col" className="text-right px-2 py-1 w-[120px]">Total</th>
                <th scope="col" className="text-left px-2 py-1">Statut</th>
                <th scope="col" className="text-left px-2 py-1">Bordereau</th>
                <th scope="col" className="text-left px-2 py-1">Avis de crédit</th>
                <th scope="col" className="text-left px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {p.remises.remises.map((r) => (
                <tr key={r.id} className={r.statut === 'ANNULEE' ? 'text-text-dim line-through' : ''}>
                  <td className="px-2 py-1">{r.numero}</td>
                  <td className="px-2 py-1">{date(r.date)}</td>
                  <td className="px-2 py-1">
                    {r.typeRemise.code} · {LIBELLES_NATURE[r.typeRemise.nature]}
                  </td>
                  <td className="px-2 py-1">{r.journalBanque.code}</td>
                  <td className="px-2 py-1 text-right">{r._count.valeurs}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.total)}</td>
                  <td className="px-2 py-1">{LIBELLES_STATUT_REMISE[r.statut]}</td>
                  <td className="px-2 py-1">
                    {r.typeRemise.nature === 'CHEQUES' ? piece(r.ecritureRemise) : 'sans pièce (cartes)'}
                    {r.nombreImpressions > 0 && <span className="text-text-dim"> · imprimé {r.nombreImpressions > 1 ? `${r.nombreImpressions} fois` : 'une fois'}</span>}
                  </td>
                  <td className="px-2 py-1">
                    {r.statut === 'CREDITEE' && r.dateCredit ? (
                      <>
                        {date(r.dateCredit)} · {r.referenceAvis} · {piece(r.ecritureCredit)}
                        {r.commission ? ` · commission ${fmt(r.commission)}` : ''}
                      </>
                    ) : (
                      '·'
                    )}
                    {r.annulations.length > 0 && (
                      <div className="text-text-dim">
                        {annulationDite(r.annulations[0], 'avis')}
                        {r.annulations.length > 1 ? ` (${r.annulations.length} annulations)` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 space-x-2">
                    {p.peutEcrire && r.statut !== 'ANNULEE' && (
                      <button type="button" aria-label={`Imprimer le bordereau n° ${r.numero}`} onClick={() => imprimer(r)} className="text-sel hover:underline">
                        Imprimer
                      </button>
                    )}
                    {p.peutEcrire && r.statut === 'REMISE' && (
                      <button type="button" aria-label={`Avis de crédit de la remise n° ${r.numero}`} onClick={() => setACrediter(r)} className="text-sel hover:underline">
                        Avis de crédit
                      </button>
                    )}
                    {p.peutValider && r.statut === 'REMISE' && (
                      <button type="button" aria-label={`Annuler la remise n° ${r.numero}`} onClick={() => setAAnnuler(r)} className="text-danger hover:underline">
                        Annuler la remise
                      </button>
                    )}
                    {p.peutValider && r.statut === 'CREDITEE' && (
                      <button type="button" aria-label={`Annuler l'avis de crédit de la remise n° ${r.numero}`} onClick={() => setAvisAAnnuler(r)} className="text-danger hover:underline">
                        Annuler l'avis
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {p.remises?.tronque && <div className="text-text-dim mt-1">{p.remises.remises.length} bordereaux montrés sur {p.remises.total}.</div>}
      </div>
      {aCrediter && <ModaleAvisCredit remise={aCrediter} onFermer={() => setACrediter(null)} onFait={p.onFait} />}
      {aAnnuler && (
        <ModaleMotif
          titre={`Annuler la remise n° ${aAnnuler.numero}`}
          resume={`${aAnnuler.journalBanque.code} · ${fmt(aAnnuler.total)} · ${aAnnuler._count.valeurs} valeur(s) rendue(s) « reçues, non remises »`}
          action="Annuler la remise"
          chemin={`/remises/${aAnnuler.id}/annuler`}
          onFermer={() => setAAnnuler(null)}
          onFait={async (r) => {
            setAAnnuler(null);
            await p.onFait(r.ecritureNegatifRemiseId ? 'Remise annulée · le bordereau validé est inscrit en négatif.' : 'Remise annulée · ses valeurs sont de nouveau à remettre.');
          }}
        />
      )}
      {avisAAnnuler && (
        <ModaleMotif
          titre={`Annuler l'avis de crédit de la remise n° ${avisAAnnuler.numero}`}
          resume={`${avisAAnnuler.journalBanque.code} · ${fmt(avisAAnnuler.total)} · pièce ${piece(avisAAnnuler.ecritureCredit)}`}
          action="Annuler l'avis"
          chemin={`/remises/${avisAAnnuler.id}/avis-credit/annuler`}
          onFermer={() => setAvisAAnnuler(null)}
          onFait={async (r) => {
            setAvisAAnnuler(null);
            await p.onFait(r.annulation?.traitement === 'INSCRITE_EN_NEGATIF' ? 'Avis annulé · la pièce validée est inscrite en négatif, la remise attend de nouveau son crédit.' : 'Avis annulé · la pièce du brouillard est retirée, la remise attend de nouveau son crédit.');
          }}
        />
      )}
    </div>
  );
}

// ----- Types de remise -------------------------------------------------------

function OngletTypes(p: { types: ListeTypes | null; journaux: JournalServi[] | null; estAdmin: boolean; onFait: (m: string) => Promise<void>; onRefus: (e: unknown, d: string) => void }) {
  const [code, setCode] = useState('');
  const [intitule, setIntitule] = useState('');
  const [nature, setNature] = useState<Nature>('CHEQUES');
  const [journalBanqueId, setJournalBanqueId] = useState('');
  const [journalOperationsId, setJournalOperationsId] = useState('');
  const [comptes, setComptes] = useState<Record<'RECEPTION' | 'TRANSIT' | 'COMMISSION', ComptesDuRole | null>>({ RECEPTION: null, TRANSIT: null, COMMISSION: null });
  const [receptionId, setReceptionId] = useState('');
  const [transitId, setTransitId] = useState('');
  const [commissionId, setCommissionId] = useState('');
  const [modele, setModele] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [modeleEdite, setModeleEdite] = useState<{ id: string; texte: string } | null>(null);

  // Les comptes de chaque rôle, sous la racine que le serveur prescrit
  // (`/remises/comptes`, régime « texte » de listes-de-comptes.ts).
  const { estAdmin } = p;
  const onRefus = useRef(p.onRefus);
  onRefus.current = p.onRefus;
  useEffect(() => {
    // Lu pour l'administrateur seul · trois lectures par visite, et un échec
    // dans le bandeau d'un lecteur sans formulaire (relecture React, 8).
    // `onRefus` par référence (second tour, m4) · en dépendance, chaque
    // relecture de la page faisait relire les trois listes.
    if (!estAdmin) return;
    let vivant = true;
    setReceptionId('');
    setTransitId('');
    setCommissionId('');
    const roles = ['RECEPTION', 'TRANSIT', 'COMMISSION'] as const;
    Promise.all(roles.map((role) => api.get<ComptesDuRole>(`/remises/comptes?role=${role}&nature=${nature}`)))
      .then((r) => {
        if (!vivant) return;
        const lus = { RECEPTION: r[0], TRANSIT: r[1], COMMISSION: r[2] };
        setComptes(lus);
        // Un choix unique se présélectionne.
        if (lus.RECEPTION.comptes.length === 1) setReceptionId(lus.RECEPTION.comptes[0].id);
        if (lus.TRANSIT.comptes.length === 1) setTransitId(lus.TRANSIT.comptes[0].id);
      })
      .catch((e) => vivant && onRefus.current(e, 'Comptes de remise illisibles'));
    return () => {
      vivant = false;
    };
  }, [nature, estAdmin]);

  // Mémorisés (second tour, m5) · recalculés à chaque rendu, ils relançaient
  // l'effet de présélection sans fin.
  const banques = useMemo(() => (p.journaux ?? []).filter((j) => j.type === 'TRESORERIE' && j.estActif), [p.journaux]);
  const operations = useMemo(() => (p.journaux ?? []).filter((j) => j.type === 'GENERAL' && j.estActif), [p.journaux]);
  // Un choix unique se présélectionne (§ 9 ter).
  useEffect(() => {
    if (!journalBanqueId && banques.length === 1) setJournalBanqueId(banques[0].id);
    if (!journalOperationsId && operations.length === 1) setJournalOperationsId(operations[0].id);
  }, [journalBanqueId, journalOperationsId, banques, operations]);
  const manque = (): string | null => {
    if (!/^[A-Za-z0-9]{1,10}$/.test(code.trim())) return 'Le code est de un à dix lettres ou chiffres.';
    if (intitule.trim().length < 3) return "L'intitulé est exigé · trois caractères au moins.";
    if (!journalBanqueId) return 'Choisissez la banque de remise.';
    if (!journalOperationsId) return "Choisissez le journal d'opérations diverses.";
    if (!receptionId) return `Choisissez le compte de réception (${nature === 'CHEQUES' ? '513' : '515'}).`;
    if (nature === 'CHEQUES' && !transitId) return 'Choisissez le compte de transit (514).';
    return null;
  };
  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (manque()) return;
    setEnvoi(true);
    try {
      await api.post('/remises/types', {
        code: code.trim().toUpperCase(),
        intitule: intitule.trim(),
        nature,
        journalBanqueId,
        journalOperationsId,
        compteReceptionId: receptionId,
        compteTransitId: nature === 'CHEQUES' ? transitId : undefined,
        compteCommissionId: commissionId || undefined,
        modeleBordereau: modele.trim() || undefined,
      });
      setCode('');
      setIntitule('');
      setModele('');
      await p.onFait('Type de remise créé.');
    } catch (err) {
      p.onRefus(err, 'Création impossible');
    } finally {
      setEnvoi(false);
    }
  };
  const retoucher = async (t: TypeRemise, corps: Record<string, unknown>, message: string) => {
    try {
      await api.patch(`/remises/types/${t.id}`, corps);
      setModeleEdite(null);
      await p.onFait(message);
    } catch (err) {
      p.onRefus(err, 'Modification impossible');
    }
  };
  const selectComptes = (role: 'RECEPTION' | 'TRANSIT' | 'COMMISSION', valeur: string, poser: (v: string) => void, libelle: string) => {
    const lus = comptes[role];
    return (
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">{libelle}</span>
        <select value={valeur} onChange={(e) => poser(e.target.value)} className="border border-border px-2 py-[2px]">
          <option value="">{lus === null ? '…' : lus.comptes.length === 0 ? (lus.motif ?? `Aucun compte sous le ${lus.racine} · ouvrez-le dans Plan comptable`) : '·'}</option>
          {(lus?.comptes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.numero} · {c.intitule}
              {c.estRetenu ? '' : ' (non personnalisé)'}
            </option>
          ))}
        </select>
        {listeTronquee(lus)}
      </label>
    );
  };

  return (
    <div className="space-y-3">
      {p.estAdmin && (
        <form onSubmit={creer} noValidate className="border border-border bg-surface p-3 space-y-2">
          <div className="font-semibold">Nouveau type de remise</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={10} className="border border-border px-2 py-[2px] uppercase" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Intitulé</span>
              <input value={intitule} onChange={(e) => setIntitule(e.target.value)} maxLength={60} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Nature</span>
              <select value={nature} onChange={(e) => setNature(e.target.value as Nature)} className="border border-border px-2 py-[2px]">
                <option value="CHEQUES">Chèques</option>
                <option value="CARTES">Cartes de crédit</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Banque de remise</span>
              <select value={journalBanqueId} onChange={(e) => setJournalBanqueId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">{p.journaux === null ? '…' : banques.length === 0 ? 'Aucun journal de trésorerie' : '·'}</option>
                {banques.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Journal des opérations diverses</span>
              <select value={journalOperationsId} onChange={(e) => setJournalOperationsId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">{p.journaux === null ? '…' : operations.length === 0 ? 'Aucun journal général' : '·'}</option>
                {operations.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            {selectComptes('RECEPTION', receptionId, setReceptionId, nature === 'CHEQUES' ? 'Compte de réception (513)' : 'Compte de réception (515)')}
            {nature === 'CHEQUES' && selectComptes('TRANSIT', transitId, setTransitId, 'Compte de transit (514)')}
            {selectComptes('COMMISSION', commissionId, setCommissionId, 'Compte de commission (631, facultatif)')}
          </div>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim" title={`Jetons admis · ${'{dossier} {banque} {type} {numero} {date} {nature} {nombre} {total} {lignes}'} · {lignes} exigé une fois`}>
              Modèle du bordereau (facultatif)
            </span>
            <textarea value={modele} onChange={(e) => setModele(e.target.value)} rows={3} maxLength={4000} className="border border-border px-2 py-[2px] font-mono text-[11px]" />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={envoi || manque() !== null} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
              {envoi ? '…' : 'Créer'}
            </button>
            {manque() && <span className="text-text-dim">{manque()}</span>}
          </div>
        </form>
      )}
      <div className="overflow-auto">
        {p.types === null ? (
          <div className="text-text-dim">Lecture…</div>
        ) : p.types.types.length === 0 ? (
          <div className="text-text-dim">Aucun type de remise{p.estAdmin ? '' : ' · l’administrateur du dossier les crée'}.</div>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th scope="col" className="text-left px-2 py-1">Code</th>
                <th scope="col" className="text-left px-2 py-1">Intitulé</th>
                <th scope="col" className="text-left px-2 py-1">Nature</th>
                <th scope="col" className="text-left px-2 py-1">Banque</th>
                <th scope="col" className="text-left px-2 py-1">Opérations</th>
                <th scope="col" className="text-left px-2 py-1">Réception</th>
                <th scope="col" className="text-left px-2 py-1">Transit</th>
                <th scope="col" className="text-left px-2 py-1">Commission</th>
                <th scope="col" className="text-left px-2 py-1">Modèle</th>
                <th scope="col" className="text-left px-2 py-1">Actif</th>
              </tr>
            </thead>
            <tbody>
              {p.types.types.map((t) => (
                <tr key={t.id} className={t.estActif ? '' : 'text-text-dim'}>
                  <td className="px-2 py-1">{t.code}</td>
                  <td className="px-2 py-1">{t.intitule}</td>
                  <td className="px-2 py-1">{LIBELLES_NATURE[t.nature]}</td>
                  <td className="px-2 py-1">{t.journalBanque.code}</td>
                  <td className="px-2 py-1">{t.journalOperations.code}</td>
                  <td className="px-2 py-1">{t.compteReception.numero}</td>
                  <td className="px-2 py-1">{t.compteTransit?.numero ?? '·'}</td>
                  <td className="px-2 py-1">{t.compteCommission?.numero ?? '·'}</td>
                  <td className="px-2 py-1">
                    {modeleEdite?.id === t.id ? (
                      <span className="flex flex-col gap-1">
                        <textarea value={modeleEdite.texte} onChange={(e) => setModeleEdite({ id: t.id, texte: e.target.value })} rows={3} maxLength={4000} className="border border-border px-2 py-[2px] font-mono text-[11px] min-w-[260px]" />
                        <span className="space-x-2">
                          <button type="button" aria-label={`Enregistrer le modèle du type ${t.code}`} onClick={() => retoucher(t, { modeleBordereau: modeleEdite.texte.trim() || null }, 'Modèle du bordereau enregistré.')} className="text-sel hover:underline">
                            Enregistrer
                          </button>
                          <button type="button" aria-label={`Fermer le modèle du type ${t.code}`} onClick={() => setModeleEdite(null)} className="hover:underline">
                            Fermer
                          </button>
                        </span>
                      </span>
                    ) : (
                      <>
                        {t.modeleBordereau ? 'du type' : 'par défaut'}
                        {p.estAdmin && (
                          <button type="button" aria-label={`Modifier le modèle du type ${t.code}`} onClick={() => setModeleEdite({ id: t.id, texte: t.modeleBordereau ?? '' })} className="text-sel hover:underline ml-2">
                            Modifier
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {p.estAdmin ? (
                      <button type="button" aria-label={`${t.estActif ? 'Mettre en sommeil' : 'Réveiller'} le type ${t.code}`} onClick={() => retoucher(t, { estActif: !t.estActif }, t.estActif ? `Type ${t.code} mis en sommeil.` : `Type ${t.code} réveillé.`)} className="text-sel hover:underline">
                        {t.estActif ? 'Mettre en sommeil' : 'Réveiller'}
                      </button>
                    ) : t.estActif ? (
                      'Oui'
                    ) : (
                      'En sommeil'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ----- Modales ----------------------------------------------------------------

function useFermetureParEchap(onFermer: () => void, envoi: boolean) {
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  const envoiRef = useRef(envoi);
  envoiRef.current = envoi;
  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoiRef.current) fermerRef.current();
        return true;
      }),
    [],
  );
}

function Cadre(p: {
  id: string;
  titre: string;
  onFermer: () => void;
  envoi: boolean;
  onSubmit?: (e: FormEvent) => void;
  enfants: React.ReactNode;
  pied: React.ReactNode;
  /** Une boîte sans champ reçoit le focus sur son conteneur (relecture React, 14). */
  focus?: React.RefObject<HTMLDivElement>;
}) {
  const Conteneur = p.onSubmit ? 'form' : 'div';
  return (
    <PortailModale>
      <div className="anim-voile ecran-seul fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <Conteneur
          ref={p.focus as React.RefObject<HTMLDivElement & HTMLFormElement> | undefined}
          tabIndex={p.focus ? -1 : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby={p.id}
          onSubmit={p.onSubmit}
          className="anim-modale w-full max-w-[520px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center px-2.5 border-b border-border">
            <span id={p.id}>{p.titre}</span>
          </div>
          <div className="p-3 space-y-2">{p.enfants}</div>
          <div className="flex justify-end gap-2 px-3 pb-3">
            <button type="button" onClick={p.onFermer} disabled={p.envoi} className="px-3 py-1 border border-border">
              Fermer
            </button>
            {p.pied}
          </div>
        </Conteneur>
      </div>
    </PortailModale>
  );
}

function ModaleMotif(p: { titre: string; resume: string; action: string; chemin: string; onFermer: () => void; onFait: (r: ReponseAnnulation) => Promise<void> }) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (motif.trim().length < 3) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<ReponseAnnulation>(p.chemin, { motif: motif.trim() });
      await p.onFait(r);
    } catch (err) {
      setErreur(messageDuRefus(err, 'Annulation impossible'));
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre
      id="titre-modale-motif"
      titre={p.titre}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={envoyer}
      enfants={
        <>
          <div>{p.resume}</div>
          {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Motif</span>
            <input ref={champ} required minLength={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className="border border-border px-2 py-[2px]" />
          </label>
        </>
      }
      pied={
        <button type="submit" disabled={envoi || motif.trim().length < 3} className="bg-danger text-white font-semibold px-3 py-1 disabled:opacity-40">
          {envoi ? '…' : p.action}
        </button>
      }
    />
  );
}

function ModaleAvisCredit(p: { remise: Remise; onFermer: () => void; onFait: (m: string) => Promise<void> }) {
  const [jour, setJour] = useState('');
  const [reference, setReference] = useState('');
  const [commission, setCommission] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const montantCommission = commission.trim() ? montantSaisi(commission) : 0;
  const pret = jour !== '' && reference.trim() !== '' && montantCommission !== null;
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!pret) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await api.post(`/remises/${p.remise.id}/avis-credit`, { date: jour, referenceAvis: reference.trim(), commission: montantCommission || undefined });
      p.onFermer();
      await p.onFait(`Remise n° ${p.remise.numero} créditée au ${p.remise.journalBanque.code}${montantCommission ? ` · commission ${fmt(montantCommission)}` : ''}.`);
    } catch (err) {
      setErreur(messageDuRefus(err, 'Avis impossible'));
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre
      id="titre-avis-credit"
      titre={`Avis de crédit · remise n° ${p.remise.numero}`}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={envoyer}
      enfants={
        <>
          <div>
            {p.remise.journalBanque.code} · {fmt(p.remise.total)} · {p.remise._count.valeurs} valeur(s)
          </div>
          {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Date de l'avis</span>
            <input ref={champ} type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="border border-border px-2 py-[2px]" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Référence de l'avis ou du relevé</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className="border border-border px-2 py-[2px]" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Commission prélevée (facultatif)</span>
            <input inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
          </label>
        </>
      }
      pied={
        <>
          {commission.trim() !== '' && montantCommission === null && <span className="text-danger self-center">La commission doit être un nombre.</span>}
          <button type="submit" disabled={envoi || !pret} className="bg-sel text-white font-semibold px-3 py-1 disabled:opacity-40">
            {envoi ? '…' : 'Créditer'}
          </button>
        </>
      }
    />
  );
}

function ModaleImpaye(p: { valeur: Valeur; onFermer: () => void; onFait: (m: string) => Promise<void> }) {
  const [jour, setJour] = useState('');
  const [comptes, setComptes] = useState<ComptesDuRole | null>(null);
  const [compteId, setCompteId] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  useEffect(() => {
    let vivant = true;
    api
      .get<ComptesDuRole>(`/remises/comptes?role=IMPAYE&nature=${p.valeur.typeRemise.nature}&compteTiersId=${encodeURIComponent(p.valeur.compteTiersId)}`)
      .then((c) => {
        if (!vivant) return;
        setComptes(c);
        if (c.comptes.length === 1) setCompteId(c.comptes[0].id);
      })
      .catch((e) => vivant && setErreur(e instanceof ApiError ? e.message : "Comptes d'impayé illisibles"));
    return () => {
      vivant = false;
    };
  }, [p.valeur]);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!jour || !compteId) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ compteImpaye: string }>(`/remises/valeurs/${p.valeur.id}/impaye`, { date: jour, compteImpayeId: compteId });
      p.onFermer();
      await p.onFait(`Impayé de ${p.valeur.reference} passé au ${r.compteImpaye}.`);
    } catch (err) {
      setErreur(messageDuRefus(err, 'Impayé impossible'));
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre
      id="titre-impaye"
      titre={`Impayé · ${p.valeur.reference}`}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={envoyer}
      enfants={
        <>
          <div>
            {p.valeur.compteTiers.numero} · {p.valeur.compteTiers.intitule} · {fmt(p.valeur.montant)} · {LIBELLES_STATUT_VALEUR[p.valeur.statut]}
          </div>
          {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Date de l'impayé</span>
            <input ref={champ} type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="border border-border px-2 py-[2px]" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Compte d'impayé{comptes?.racine ? ` (${comptes.racine})` : ''}</span>
            <select value={compteId} onChange={(e) => setCompteId(e.target.value)} className="border border-border px-2 py-[2px]">
              <option value="">{comptes === null ? '…' : comptes.comptes.length === 0 ? `Aucun compte sous le ${comptes.racine} · ouvrez-le dans Plan comptable` : '·'}</option>
              {(comptes?.comptes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.intitule}
                </option>
              ))}
            </select>
            {listeTronquee(comptes)}
          </label>
        </>
      }
      pied={
        <button type="submit" disabled={envoi || !jour || !compteId} className="bg-sel text-white font-semibold px-3 py-1 disabled:opacity-40">
          {envoi ? '…' : "Déclarer l'impayé"}
        </button>
      }
    />
  );
}

function ModaleDocument(p: { titre: string; texte: string; onFermer: () => void }) {
  useFermetureParEchap(p.onFermer, false);
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => boite.current?.focus({ preventScroll: true }), []);
  return (
    <Cadre
      id="titre-bordereau"
      titre={p.titre}
      onFermer={p.onFermer}
      envoi={false}
      focus={boite}
      enfants={<pre className="whitespace-pre-wrap font-mono text-[11px]">{p.texte}</pre>}
      pied={
        <button type="button" onClick={() => window.print()} className="bg-sel text-white font-semibold px-3 py-1">
          Imprimer
        </button>
      }
    />
  );
}
