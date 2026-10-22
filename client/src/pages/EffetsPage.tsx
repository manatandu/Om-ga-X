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
 * EFFETS DE COMMERCE · Traitement > Tiers et trésorerie (ligne sage-l3,
 * fonction 39 · chez Sage, « Moyens de paiement », LCR à l'encaissement et à
 * décaisser). L'effet ACCEPTÉ entre au 412 (à recevoir) ou au 402 (à payer)
 * par le compte du tiers, lettré avec la facture ; il se REMET à
 * l'encaissement (512) ou à l'ESCOMPTE (415, décompte au 565), s'ENCAISSE ou
 * se DÉNOUE à l'échéance, revient IMPAYÉ (4132) ; l'effet à payer reçoit son
 * BON À PAYER puis se PAIE. Règles au serveur (src/modules/effets/), l'écran
 * ne les refait pas · il propose, le serveur juge. Au SYCEBNL, seul l'effet
 * à payer est servi (le serveur le dit).
 */

type Sens = 'A_RECEVOIR' | 'A_PAYER';
type Statut = 'EN_PORTEFEUILLE' | 'REMIS_A_L_ENCAISSEMENT' | 'ESCOMPTE' | 'ENCAISSE' | 'IMPAYE' | 'BON_A_PAYER' | 'PAYE' | 'ANNULE';
type NatureActe = 'ACCEPTATION' | 'REMISE_ENCAISSEMENT' | 'REMISE_ESCOMPTE' | 'DECOMPTE_ESCOMPTE' | 'ENCAISSEMENT' | 'DENOUEMENT_ESCOMPTE' | 'IMPAYE' | 'BON_A_PAYER' | 'PAIEMENT';

const LIBELLES_STATUT: Record<Statut, string> = {
  EN_PORTEFEUILLE: 'En portefeuille',
  REMIS_A_L_ENCAISSEMENT: "Remis à l'encaissement",
  ESCOMPTE: 'Escompté',
  ENCAISSE: 'Encaissé',
  IMPAYE: 'Impayé',
  BON_A_PAYER: 'Bon à payer',
  PAYE: 'Payé',
  ANNULE: 'Annulé',
};
const LIBELLES_ACTE: Record<NatureActe, string> = {
  ACCEPTATION: 'Acceptation',
  REMISE_ENCAISSEMENT: "Remise à l'encaissement",
  REMISE_ESCOMPTE: "Remise à l'escompte",
  DECOMPTE_ESCOMPTE: "Décompte d'escompte",
  ENCAISSEMENT: 'Encaissement',
  DENOUEMENT_ESCOMPTE: "Dénouement de l'escompte",
  IMPAYE: 'Impayé',
  BON_A_PAYER: 'Bon à payer',
  PAIEMENT: 'Paiement',
};
/** Les actes que chaque statut propose, par sens · le serveur tient la même liste (ACTES_ADMIS). */
const ACTES_PROPOSES: Record<Sens, Partial<Record<Statut, Exclude<NatureActe, 'ACCEPTATION'>[]>>> = {
  A_RECEVOIR: {
    EN_PORTEFEUILLE: ['REMISE_ENCAISSEMENT', 'REMISE_ESCOMPTE', 'IMPAYE'],
    REMIS_A_L_ENCAISSEMENT: ['ENCAISSEMENT', 'IMPAYE'],
    ESCOMPTE: ['DECOMPTE_ESCOMPTE', 'DENOUEMENT_ESCOMPTE', 'IMPAYE'],
  },
  A_PAYER: {
    EN_PORTEFEUILLE: ['BON_A_PAYER', 'PAIEMENT'],
    BON_A_PAYER: ['PAIEMENT'],
  },
};
/** Le chemin de chaque acte et le rôle du compte qu'il demande, le cas échéant. */
const CHEMINS: Record<Exclude<NatureActe, 'ACCEPTATION'>, { chemin: string; role?: string; champCompte?: string; banque?: boolean; frais?: boolean; commission?: boolean; reference?: boolean }> = {
  REMISE_ENCAISSEMENT: { chemin: 'remettre', role: 'ENCAISSEMENT', champCompte: 'compteEncaissementId' },
  REMISE_ESCOMPTE: { chemin: 'escompter', role: 'ESCOMPTE_NON_ECHU', champCompte: 'compteEscompteNonEchuId' },
  DECOMPTE_ESCOMPTE: { chemin: 'decompte', role: 'CREDIT_ESCOMPTE', champCompte: 'compteCreditEscompteId', banque: true, frais: true, commission: true, reference: true },
  ENCAISSEMENT: { chemin: 'encaisser', banque: true, commission: true, reference: true },
  DENOUEMENT_ESCOMPTE: { chemin: 'denouer' },
  IMPAYE: { chemin: 'impaye', role: 'IMPAYE', champCompte: 'compteImpayeId' },
  BON_A_PAYER: { chemin: 'bon-a-payer', reference: true },
  PAIEMENT: { chemin: 'payer', banque: true, reference: true },
};

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
interface Piece {
  id: string;
  numeroPiece: number | null;
  statut: string;
}
interface Acte {
  id: string;
  nature: NatureActe;
  libelle: string;
  date: string;
  montant: number;
  detail: Record<string, unknown> | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  compte: CompteServi | null;
  ecriture: Piece | null;
  ecritureNegatif: Piece | null;
}
interface Effet {
  id: string;
  sens: Sens;
  statut: Statut;
  montant: number;
  reference: string;
  tire: string | null;
  dateCreation: string;
  dateEcheance: string;
  compteTiers: CompteServi;
  compteEffet: CompteServi;
  actes: Acte[];
}
interface ListeEffets {
  effets: Effet[];
  total: number;
  tronque: boolean;
}
interface ComptesDuRole {
  racines: string[] | null;
  comptes: Array<CompteServi & { estRetenu: boolean }>;
  motif: string | null;
  total?: number;
  tronque?: boolean;
}
/** Lignes ouvertes telles que `/reglements/echeances` les sert · `montant` est
 * le RESTE dû (lettrage partiel compris), `echeance` la date retenue (premier
 * tour de relecture · lues sous d'autres noms, le montant s'affichait « · »). */
interface GroupeEcheance {
  compteId: string;
  lignes: Array<{ id: string; libelle: string; montant: number; echeance: string; reference?: string | null; deviseCode?: string | null; montantDevise?: number | null }>;
  /** Lignes d'à-nouveau PROVISOIRE écartées · la facture attend la clôture de l'exercice précédent (second tour). */
  aNouveauProvisoireEcartees?: number;
  creanceReclassee?: { compte416: string; date: string } | null;
}
interface ReponseAnnulation {
  statut: Statut;
  traitement: 'SUPPRIMEE' | 'INSCRITE_EN_NEGATIF' | 'SANS_PIECE';
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
/** Un 5xx ou une réponse perdue n'est pas un refus · le geste a pu passer (même règle que les remises). */
const messageDuRefus = (err: unknown, defaut: string) =>
  err instanceof ApiError && err.status < 500 ? err.message : `${defaut} · réponse perdue, le geste a pu passer. Relisez la liste avant de le refaire.`;
const piece = (p: Piece | null) => (p ? `n° ${p.numeroPiece ?? '·'}${p.statut === 'BROUILLARD' ? ' (brouillard)' : ''}` : '·');
const listeTronquee = (lus: ComptesDuRole | null, fenetre: 'Plan des tiers' | 'Plan comptable' = 'Plan comptable') =>
  lus?.tronque ? <span className="text-text-dim">{lus.comptes.length} comptes montrés sur {lus.total} · un compte absent se cherche dans {fenetre}.</span> : null;

export function EffetsPage({ sensInitial }: { sensInitial?: Sens } = {}) {
  const { peutEcrire, peutValider, utilisateur } = useAuth();
  const tenant = utilisateur?.tenant ?? null;
  const { exerciceCourant } = useExercice();
  const exerciceId = exerciceCourant?.id ?? null;
  const exerciceClos = exerciceCourant?.statut === 'CLOTURE';
  // Au SYCEBNL seul l'effet à payer existe (fiches du 41, 51 et 56 du plan) · l'onglet « À recevoir » n'y est pas offert, le serveur le refuse de même.
  const sycebnl = tenant?.referentiel === 'SYCEBNL';
  const onglets = useMemo<Sens[]>(() => (sycebnl ? ['A_PAYER'] : ['A_RECEVOIR', 'A_PAYER']), [sycebnl]);
  const [sens, setSens] = useState<Sens>(sensInitial && !(sycebnl && sensInitial === 'A_RECEVOIR') ? sensInitial : sycebnl ? 'A_PAYER' : 'A_RECEVOIR');
  const [effets, setEffets] = useState<ListeEffets | null>(null);
  const [journaux, setJournaux] = useState<JournalServi[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const bandeauErreur = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (erreur) bandeauErreur.current?.focus({ preventScroll: false });
  }, [erreur]);

  const exerciceAffiche = useRef(exerciceId);
  exerciceAffiche.current = exerciceId;
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    const n = ++jeton.current;
    const garde = () => n === jeton.current && exerciceId === exerciceAffiche.current;
    try {
      const j = await api.get<JournalServi[]>('/journaux');
      if (!garde()) return;
      setJournaux(j);
      if (exerciceId) {
        const e = await api.get<ListeEffets>(`/effets?exerciceId=${exerciceId}&sens=${sens}`);
        if (!garde()) return;
        setEffets(e);
      }
      setErreur(null);
    } catch (err) {
      if (garde()) setErreur(err instanceof ApiError ? err.message : 'Effets illisibles');
    }
  }, [exerciceId, sens]);
  useEffect(() => {
    setEffets(null);
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
      // Réponse perdue ou conflit (409 · l'effet a changé) · la liste se relit.
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) void charger();
    },
    [charger],
  );
  const [garde, setGarde] = useState<string | null>(null);
  useGardeFermeture(garde);
  const journauxOd = useMemo(() => (journaux ?? []).filter((j) => j.type === 'GENERAL' && j.estActif), [journaux]);
  const banques = useMemo(() => (journaux ?? []).filter((j) => j.type === 'TRESORERIE' && j.estActif), [journaux]);

  return (
    <div className="p-3 space-y-3 text-[11.5px] avec-edition">
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
          {onglets.map((o) => (
            <button
              key={o}
              type="button"
              role="tab"
              id={`onglet-effets-${o}`}
              aria-selected={sens === o}
              aria-controls="panneau-effets"
              onClick={() => setSens(o)}
              className={`onglet ${sens === o ? 'onglet-actif' : ''}`}
            >
              {o === 'A_RECEVOIR' ? 'Effets à recevoir' : 'Effets à payer'}
            </button>
          ))}
        </div>
        <Aide
          titre="Effets de commerce"
          texte="L'effet accepté entre au 412 « Clients, effets à recevoir en portefeuille » par le crédit du client (ou au 402 « Fournisseurs, effets à payer » par le débit du fournisseur), lettré avec la facture ; sa TVA est exigible à l'ÉCHÉANCE de la traite, même escomptée. Remis à l'encaissement, il passe au 512 jusqu'à l'avis de la banque, la commission au 6312 ; remis à l'escompte, au 415, le décompte de la banque crédite le net (frais et intérêts au 675) par le 565, dénoué après l'échéance. Revenu impayé, il va au 4132 ; escompté et décompté, la banque reprend le nominal. L'effet à payer reçoit son bon à payer puis se paie par la banque. Chaque acte s'annule à rebours, avec son motif · au brouillard la pièce est retirée, validée elle est inscrite en négatif. Au SYCEBNL, seul l'effet à payer existe (402)."
          source="AUDCIF Titre VII, comptes 40 (402), 41 (412, 413, 415), 51 (512), 56 (564, 565), 63 (6312) et 67 (675) ; SYCEBNL Partie 2 ch. 3, comptes 40 et 56 ; décret n° 011/42, art. 57 et 96 ; AUDCIF art. 17 et art. 20, al. 2"
        />
      </div>
      {!exerciceId && <div className="text-text-dim">Aucun exercice · ouvrez-en un dans Exercices.</div>}
      <div role="tabpanel" id="panneau-effets" aria-labelledby={`onglet-effets-${sens}`}>
        <Onglet
          key={sens}
          sens={sens}
          exerciceId={exerciceId}
          exerciceClos={exerciceClos}
          bornes={exerciceCourant ? { debut: exerciceCourant.dateDebut.slice(0, 10), fin: exerciceCourant.dateFin.slice(0, 10) } : null}
          effets={effets}
          journauxOd={journauxOd}
          banques={banques}
          journauxLus={journaux !== null}
          peutEcrire={peutEcrire}
          peutValider={peutValider}
          onFait={fait}
          onRefus={refus}
          onGarde={setGarde}
        />
      </div>
    </div>
  );
}

// ----- Un sens · acceptation et liste --------------------------------------------

function Onglet(p: {
  sens: Sens;
  exerciceId: string | null;
  exerciceClos: boolean;
  bornes: { debut: string; fin: string } | null;
  effets: ListeEffets | null;
  journauxOd: JournalServi[];
  banques: JournalServi[];
  journauxLus: boolean;
  peutEcrire: boolean;
  peutValider: boolean;
  onFait: (m: string) => Promise<void>;
  onRefus: (e: unknown, d: string) => void;
  onGarde: (motif: string | null) => void;
}) {
  const [journalId, setJournalId] = useState('');
  const [tiers, setTiers] = useState<ComptesDuRole | null>(null);
  const [tiersId, setTiersId] = useState('');
  // LE DÉBUT DU NUMÉRO RESTREINT LA LISTE DES TIERS (second tour, BLOQUANT 1) ·
  // servie par tranche de 200, elle laissait le 201e client sans issue.
  const [numeroTiers, setNumeroTiers] = useState('');
  const [portefeuille, setPortefeuille] = useState<ComptesDuRole | null>(null);
  const [compteEffetId, setCompteEffetId] = useState('');
  const [creation, setCreation] = useState('');
  const [echeance, setEcheance] = useState('');
  const [somme, setSomme] = useState('');
  const [reference, setReference] = useState('');
  const [tire, setTire] = useState('');
  const [echeances, setEcheances] = useState<GroupeEcheance[] | null>(null);
  const [erreurEcheances, setErreurEcheances] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [lignesChoisies, setLignesChoisies] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [acte, setActe] = useState<{ effet: Effet; nature: Exclude<NatureActe, 'ACCEPTATION'> } | null>(null);
  const [aAnnuler, setAAnnuler] = useState<{ effet: Effet; acte: Acte } | null>(null);
  const [detail, setDetail] = useState<Effet | null>(null);

  useEffect(() => {
    if (!journalId && p.journauxOd.length === 1) setJournalId(p.journauxOd[0].id);
    if (journalId && !p.journauxOd.some((j) => j.id === journalId)) setJournalId('');
  }, [journalId, p.journauxOd]);
  // Les comptes du tiers et du portefeuille, sous les racines que le serveur prescrit · lus pour qui peut accepter seulement.
  const { peutEcrire, sens } = p;
  const onRefus = useRef(p.onRefus);
  onRefus.current = p.onRefus;
  const numeroTape = numeroTiers.replace(/\D/g, '').slice(0, 13);
  useEffect(() => {
    if (!peutEcrire) return;
    let vivant = true;
    Promise.all([
      api.get<ComptesDuRole>(`/effets/comptes?role=TIERS&sens=${sens}${numeroTape ? `&numero=${numeroTape}` : ''}`),
      api.get<ComptesDuRole>(`/effets/comptes?role=PORTEFEUILLE&sens=${sens}`),
    ])
      .then(([t, pf]) => {
        if (!vivant) return;
        setTiers(t);
        setPortefeuille(pf);
        if (pf.comptes.length === 1) setCompteEffetId(pf.comptes[0].id);
      })
      .catch((e) => vivant && onRefus.current(e, 'Comptes des effets illisibles'));
    return () => {
      vivant = false;
    };
  }, [peutEcrire, sens, numeroTape]);
  // Un tiers qui sort de la liste restreinte n'est plus choisi.
  useEffect(() => {
    if (tiersId && tiers && !tiers.comptes.some((c) => c.id === tiersId)) setTiersId('');
  }, [tiers, tiersId]);
  useEffect(() => {
    setLignesChoisies([]);
    setEcheances(null);
    setErreurEcheances(null);
    if (!tiersId || !p.exerciceId) return;
    let vivant = true;
    api
      .get<GroupeEcheance[]>(`/reglements/echeances?exerciceId=${p.exerciceId}&sens=${sens === 'A_RECEVOIR' ? 'CLIENT' : 'FOURNISSEUR'}`)
      .then((g) => vivant && setEcheances(g.filter((x) => x.compteId === tiersId)))
      .catch((e) => vivant && setErreurEcheances(e instanceof ApiError ? e.message : 'Lignes ouvertes du tiers illisibles · rechoisissez le tiers.'));
    return () => {
      vivant = false;
    };
  }, [tiersId, p.exerciceId, sens, version]);

  const valeur = montantSaisi(somme);
  const manque = (): string | null => {
    if (!p.exerciceId) return 'Choisissez un exercice.';
    if (p.exerciceClos) return 'Cet exercice est clôturé.';
    if (portefeuille?.motif) return portefeuille.motif;
    if (!journalId) return "Choisissez le journal d'opérations diverses.";
    if (!tiersId) return 'Choisissez le compte du tiers.';
    if (!compteEffetId) return 'Choisissez le compte de portefeuille.';
    // Les lignes ouvertes illisibles ne ferment pas l'acceptation (premier
    // tour de relecture) · l'effet s'accepte SANS lettrage, et l'écran le dit.
    if (!erreurEcheances && echeances === null) return 'Lecture des lignes ouvertes du tiers…';
    if (!creation) return 'La date de création est exigée.';
    if (!echeance) return "L'échéance est exigée.";
    if (valeur === null || valeur <= 0) return 'Le montant doit être un nombre positif.';
    if (!reference.trim()) return 'La référence de la traite est exigée.';
    return null;
  };
  const entame = !!(somme || reference || tire || lignesChoisies.length > 0);
  const motifGarde = envoi ? "L'acceptation est en cours d'envoi · fermer maintenant laisserait son issue inconnue." : entame ? "Un effet est en cours de saisie et n'est pas accepté." : null;
  const { onGarde } = p;
  useEffect(() => {
    onGarde(motifGarde);
    return () => onGarde(null);
  }, [motifGarde, onGarde]);
  const accepter = async (e: FormEvent) => {
    e.preventDefault();
    if (manque()) return;
    setEnvoi(true);
    try {
      const r = await api.post<Effet & { lettre: string | null; lignesAuBrouillard?: number }>('/effets', {
        exerciceId: p.exerciceId,
        sens,
        journalId,
        compteTiersId: tiersId,
        compteEffetId,
        montant: valeur,
        reference: reference.trim(),
        tire: tire.trim() || undefined,
        dateCreation: creation,
        dateEcheance: echeance,
        ligneIds: lignesChoisies.length > 0 ? lignesChoisies : undefined,
      });
      setSomme('');
      setReference('');
      setTire('');
      setLignesChoisies([]);
      setVersion((v) => v + 1);
      await p.onFait(
        `Effet ${r.reference} accepté au ${r.compteEffet.numero}, échéance ${date(r.dateEcheance)}${
          r.lettre ? ` · lettré ${r.lettre} avec les factures choisies` : ' · sans lettrage · lettrez-le avec sa facture pour que la TVA se lise à l\'échéance'
        }${
          r.lignesAuBrouillard ? ` · ${r.lignesAuBrouillard} facture(s) choisie(s) encore au brouillard` : ''
        }.`,
      );
    } catch (err) {
      p.onRefus(err, 'Acceptation impossible');
    } finally {
      setEnvoi(false);
    }
  };
  const lignesOuvertes = echeances?.flatMap((g) => g.lignes) ?? [];
  const ecartees = echeances?.reduce((n, g) => n + (g.aNouveauProvisoireEcartees ?? 0), 0) ?? 0;
  const reclassee = echeances?.find((g) => g.creanceReclassee)?.creanceReclassee ?? null;
  const dernierActe = (e: Effet) => [...e.actes].reverse().find((a) => !a.annuleLe) ?? null;

  return (
    <div className="space-y-3">
      {p.peutEcrire && (
        <form onSubmit={accepter} noValidate className="border border-border bg-surface p-3 space-y-2">
          <div className="font-semibold">{sens === 'A_RECEVOIR' ? 'Accepter un effet à recevoir' : 'Accepter un effet à payer'}</div>
          {portefeuille?.motif && <div className="text-text-dim">{portefeuille.motif}</div>}
          {p.journauxLus && p.journauxOd.length === 0 && <div className="text-text-dim">Aucun journal d'opérations diverses actif · créez-en un dans Structure › Codes journaux.</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Journal des opérations</span>
              <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">·</option>
                {p.journauxOd.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Compte du tiers{tiers?.racines ? ` (${tiers.racines.join(', ')})` : ''}</span>
              <select value={tiersId} onChange={(e) => setTiersId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">{tiers === null ? '…' : tiers.comptes.length === 0 ? 'Aucun compte de tiers · ouvrez-le dans Plan des tiers' : '·'}</option>
                {(tiers?.comptes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.intitule}
                  </option>
                ))}
              </select>
              <input
                value={numeroTiers}
                onChange={(e) => setNumeroTiers(e.target.value)}
                inputMode="numeric"
                maxLength={13}
                placeholder="Numéro commence par…"
                aria-label="Début du numéro du compte du tiers"
                className="border border-border px-2 py-[2px] mt-0.5"
              />
              {tiers?.tronque ? (
                <span className="text-text-dim">
                  {tiers.comptes.length} comptes montrés sur {tiers.total} · tapez le début du numéro pour trouver le tiers.
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Compte de portefeuille{portefeuille?.racines ? ` (${portefeuille.racines.join(', ')})` : ''}</span>
              <select value={compteEffetId} onChange={(e) => setCompteEffetId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">{portefeuille === null ? '…' : portefeuille.comptes.length === 0 ? `Aucun compte sous le ${portefeuille.racines?.join(' ou ') ?? '·'} · ouvrez-le dans Plan comptable` : '·'}</option>
                {(portefeuille?.comptes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.intitule}
                  </option>
                ))}
              </select>
              {listeTronquee(portefeuille)}
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Montant</span>
              <input inputMode="decimal" value={somme} onChange={(e) => setSomme(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Date de création</span>
              <input type="date" value={creation} min={p.bornes?.debut} max={p.bornes?.fin} onChange={(e) => setCreation(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim" title="Date du règlement pour la TVA (décret n° 011/42, art. 57)">
                Échéance
              </span>
              <input type="date" value={echeance} min={creation || p.bornes?.debut} onChange={(e) => setEcheance(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Référence de la traite</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">{sens === 'A_RECEVOIR' ? 'Tiré' : 'Tireur'}</span>
              <input value={tire} onChange={(e) => setTire(e.target.value)} maxLength={120} className="border border-border px-2 py-[2px]" />
            </label>
          </div>
          {tiersId && (
            <fieldset className="border border-border p-2">
              <legend className="px-1 text-text-dim" title="Lettrage manuel, partiel admis · jamais plus que le dû">
                Factures réglées par cet effet
              </legend>
              {erreurEcheances ? (
                <div className="text-danger">{erreurEcheances} · l'effet peut être accepté sans lettrage, à lettrer ensuite.</div>
              ) : echeances === null ? (
                <div className="text-text-dim">…</div>
              ) : lignesOuvertes.length === 0 ? (
                <div className="text-text-dim">Aucune ligne ouverte sur ce compte dans cet exercice · l'effet reste non lettré.</div>
              ) : (
                lignesOuvertes.map((l) => (
                  <label key={l.id} className={`flex items-center gap-2 ${l.deviseCode ? 'text-text-dim' : ''}`} title={l.deviseCode ? 'Une facture en devise se règle dans sa devise (Règlement des tiers) · un effet en francs ne la lettre pas.' : undefined}>
                    <input
                      type="checkbox"
                      disabled={!!l.deviseCode}
                      checked={lignesChoisies.includes(l.id)}
                      onChange={(e) => setLignesChoisies((c) => (e.target.checked ? [...c, l.id] : c.filter((x) => x !== l.id)))}
                    />
                    <span>
                      {l.libelle}
                      {l.reference ? ` · ${l.reference}` : ''} · échéance {date(l.echeance)} · {fmt(l.montant)}
                      {l.deviseCode ? ` · ${l.montantDevise ?? '·'} ${l.deviseCode}, se règle dans sa devise` : ''}
                    </span>
                  </label>
                ))
              )}
              {ecartees > 0 && (
                <div className="text-warning">
                  {ecartees} ligne(s) d'à-nouveau provisoire écartée(s) · clôturez l'exercice précédent ou passez un bilan d'ouverture, puis lettrez l'effet avec sa facture.
                </div>
              )}
              {reclassee && (
                <div className="text-warning">
                  Créance reclassée au {reclassee.compte416} le {date(reclassee.date)} · son encaissement se passe par « Recouvrement » dans « Créances douteuses ou litigieuses ».
                </div>
              )}
            </fieldset>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={envoi || manque() !== null} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
              {envoi ? '…' : 'Accepter'}
            </button>
            {manque() && <span className="text-text-dim">{manque()}</span>}
          </div>
        </form>
      )}
      <div className="overflow-auto">
        {!p.exerciceId ? null : p.effets === null ? (
          <div className="text-text-dim">Lecture…</div>
        ) : p.effets.effets.length === 0 ? (
          <div className="text-text-dim">Aucun effet {sens === 'A_RECEVOIR' ? 'à recevoir' : 'à payer'} en cours, ni arrivé à terme sur cet exercice.</div>
        ) : (
          <>
            {p.effets.tronque && <div className="text-text-dim">{p.effets.effets.length} effets montrés sur {p.effets.total}.</div>}
            <table className="w-full min-w-[980px]">
              <thead>
                <tr>
                  <th scope="col" className="text-left px-2 py-1">Référence</th>
                  <th scope="col" className="text-left px-2 py-1">Tiers</th>
                  <th scope="col" className="text-left px-2 py-1">Portefeuille</th>
                  <th scope="col" className="text-left px-2 py-1">Création</th>
                  <th scope="col" className="text-left px-2 py-1">Échéance</th>
                  <th scope="col" className="text-right px-2 py-1 w-[120px]">Montant</th>
                  <th scope="col" className="text-left px-2 py-1">Statut</th>
                  <th scope="col" className="text-left px-2 py-1">Dernier acte</th>
                  <th scope="col" className="text-left px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {p.effets.effets.map((e) => {
                  const dernier = dernierActe(e);
                  const proposes = ACTES_PROPOSES[e.sens][e.statut] ?? [];
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-2 py-1">{e.reference}{e.tire ? ` · ${e.tire}` : ''}</td>
                      <td className="px-2 py-1">{e.compteTiers.numero} · {e.compteTiers.intitule}</td>
                      <td className="px-2 py-1">{e.compteEffet.numero}</td>
                      <td className="px-2 py-1">{date(e.dateCreation)}</td>
                      <td className="px-2 py-1">{date(e.dateEcheance)}</td>
                      <td className="px-2 py-1 text-right">{fmt(e.montant)}</td>
                      <td className="px-2 py-1">{LIBELLES_STATUT[e.statut]}</td>
                      <td className="px-2 py-1">{dernier ? `${dernier.libelle} · ${date(dernier.date)} · ${dernier.ecriture ? piece(dernier.ecriture) : 'sans pièce'}` : '·'}</td>
                      <td className="px-2 py-1">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => setDetail(e)} className="px-2 py-[1px] border border-border" aria-label={`Actes de l'effet ${e.reference}`}>
                            Actes
                          </button>
                          {p.peutEcrire &&
                            proposes.map((n) => (
                              <button key={n} type="button" onClick={() => setActe({ effet: e, nature: n })} className="px-2 py-[1px] border border-border" aria-label={`${LIBELLES_ACTE[n]} · effet ${e.reference}`}>
                                {LIBELLES_ACTE[n]}
                              </button>
                            ))}
                          {p.peutValider && dernier && (
                            <button type="button" onClick={() => setAAnnuler({ effet: e, acte: dernier })} className="px-2 py-[1px] border border-danger/40 text-danger" aria-label={`Annuler ${dernier.libelle} · effet ${e.reference}`}>
                              Annuler le dernier acte
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
      {acte && <ModaleActe effet={acte.effet} nature={acte.nature} banques={p.banques} onFermer={() => setActe(null)} onFait={p.onFait} onRelire={p.onRefus} />}
      {aAnnuler && (
        <ModaleMotif
          titre={`Annuler · ${aAnnuler.acte.libelle} · effet ${aAnnuler.effet.reference}`}
          resume={`${aAnnuler.acte.libelle} du ${date(aAnnuler.acte.date)} · ${aAnnuler.acte.ecriture ? `pièce ${piece(aAnnuler.acte.ecriture)}, retirée au brouillard ou inscrite en négatif` : 'sans pièce'}.`}
          action="Annuler l'acte"
          chemin={`/effets/${aAnnuler.effet.id}/actes/${aAnnuler.acte.id}/annuler`}
          onFermer={() => setAAnnuler(null)}
          onRelire={p.onRefus}
          onFait={async (r) => {
            setAAnnuler(null);
            await p.onFait(`${aAnnuler.acte.libelle} de l'effet ${aAnnuler.effet.reference} annulé · ${r.traitement === 'INSCRITE_EN_NEGATIF' ? 'pièce inscrite en négatif' : r.traitement === 'SUPPRIMEE' ? 'pièce du brouillard retirée' : 'aucune pièce'} · l'effet est « ${LIBELLES_STATUT[r.statut]} ».`);
          }}
        />
      )}
      {detail && <ModaleActes effet={detail} onFermer={() => setDetail(null)} />}
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

function Cadre(p: { id: string; titre: string; onFermer: () => void; envoi: boolean; onSubmit?: (e: FormEvent) => void; enfants: React.ReactNode; pied: React.ReactNode; focus?: React.RefObject<HTMLDivElement> }) {
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
          className="anim-modale w-full max-w-[560px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
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

function SelecteurCompte(p: { libelle: string; comptes: ComptesDuRole | null; valeur: string; onChange: (id: string) => void; erreur?: string | null }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-text-dim">
        {p.libelle}
        {p.comptes?.racines ? ` (${p.comptes.racines.join(' ou ')})` : ''}
      </span>
      <select value={p.valeur} onChange={(e) => p.onChange(e.target.value)} className="border border-border px-2 py-[2px]">
        <option value="">{p.erreur ? p.erreur : p.comptes === null ? '…' : p.comptes.motif ? p.comptes.motif : p.comptes.comptes.length === 0 ? `Aucun compte sous le ${p.comptes.racines?.join(' ou ') ?? '·'} · ouvrez-le dans Plan comptable` : '·'}</option>
        {(p.comptes?.comptes ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.numero} · {c.intitule}
          </option>
        ))}
      </select>
      {listeTronquee(p.comptes)}
    </label>
  );
}

/** Un acte de l'effet · ses champs suivent sa nature (CHEMINS), le serveur juge. */
function ModaleActe(p: {
  effet: Effet;
  nature: Exclude<NatureActe, 'ACCEPTATION'>;
  banques: JournalServi[];
  onFermer: () => void;
  onFait: (m: string) => Promise<void>;
  /** Réponse perdue ou conflit · la liste derrière se relit (second tour, 5). */
  onRelire: (err: unknown, defaut: string) => void;
}) {
  const regle = CHEMINS[p.nature];
  const [jour, setJour] = useState('');
  const [compteId, setCompteId] = useState('');
  const [comptes, setComptes] = useState<ComptesDuRole | null>(null);
  // Une lecture de comptes qui échoue se dit DANS le sélecteur (second tour, MAJEUR 4) · sinon « … » pour toujours.
  const [erreurComptes, setErreurComptes] = useState<string | null>(null);
  const [banqueId, setBanqueId] = useState(p.banques.length === 1 ? p.banques[0].id : '');
  const [frais, setFrais] = useState('');
  const [compteFraisId, setCompteFraisId] = useState('');
  const [comptesFrais, setComptesFrais] = useState<ComptesDuRole | null>(null);
  const [commission, setCommission] = useState('');
  const [compteCommissionId, setCompteCommissionId] = useState('');
  const [comptesCommission, setComptesCommission] = useState<ComptesDuRole | null>(null);
  const [reference, setReference] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const { sens } = p.effet;
  useEffect(() => {
    let vivant = true;
    const lire = (role: string, poser: (c: ComptesDuRole) => void, choisir: (id: string) => void) =>
      api
        .get<ComptesDuRole>(`/effets/comptes?role=${role}&sens=${sens}`)
        .then((c) => {
          if (!vivant) return;
          poser(c);
          if (c.comptes.length === 1) choisir(c.comptes[0].id);
        })
        .catch((e) => {
          if (!vivant) return;
          const message = `Comptes illisibles (${e instanceof ApiError ? e.message : 'serveur injoignable'}) · fermez et rouvrez.`;
          setErreur(message);
          setErreurComptes(message);
        });
    if (regle.role) void lire(regle.role, setComptes, setCompteId);
    if (regle.frais) void lire('FRAIS_ESCOMPTE', setComptesFrais, setCompteFraisId);
    if (regle.commission) void lire('COMMISSION', setComptesCommission, setCompteCommissionId);
    return () => {
      vivant = false;
    };
  }, [regle, sens]);
  const fraisM = frais.trim() ? montantSaisi(frais) : 0;
  const commissionM = commission.trim() ? montantSaisi(commission) : 0;
  const manque = (): string | null => {
    if (!jour) return "La date de l'acte est exigée.";
    if (erreurComptes) return erreurComptes;
    if (regle.role && !compteId) return 'Choisissez le compte.';
    if (regle.banque && !banqueId) return 'Choisissez le journal de banque.';
    if (regle.frais && (fraisM === null || fraisM < 0)) return 'Les frais sont un nombre positif ou nul.';
    if (regle.commission && (commissionM === null || commissionM < 0)) return 'La commission est un nombre positif ou nul.';
    if (regle.frais && fraisM && !compteFraisId) return 'Choisissez le compte des frais (675).';
    if (regle.commission && commissionM && !compteCommissionId) return 'Choisissez le compte de commission (6312).';
    if (regle.reference && p.nature !== 'BON_A_PAYER' && !reference.trim()) return 'La référence de la pièce de la banque est exigée.';
    return null;
  };
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (manque()) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const corps: Record<string, unknown> = { date: jour };
      if (regle.champCompte) corps[regle.champCompte] = compteId;
      if (regle.banque) corps.journalBanqueId = banqueId;
      if (regle.frais && fraisM) {
        corps.frais = fraisM;
        corps.compteFraisId = compteFraisId;
      }
      if (regle.commission && commissionM) {
        corps.commission = commissionM;
        corps.compteCommissionId = compteCommissionId;
      }
      if (regle.reference && reference.trim()) corps.referencePiece = reference.trim();
      const r = await api.post<Effet>(`/effets/${p.effet.id}/${regle.chemin}`, corps);
      p.onFermer();
      await p.onFait(`${LIBELLES_ACTE[p.nature]} de l'effet ${p.effet.reference} passé · l'effet est « ${LIBELLES_STATUT[r.statut]} ».`);
    } catch (err) {
      setErreur(messageDuRefus(err, `${LIBELLES_ACTE[p.nature]} impossible`));
      // Réponse perdue (le geste a pu passer) ou conflit (l'effet a changé) · la liste se relit, la modale se ferme.
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, `${LIBELLES_ACTE[p.nature]} impossible`);
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  const net = p.effet.montant - (fraisM ?? 0) - (commissionM ?? 0);
  return (
    <Cadre
      id="titre-acte-effet"
      titre={`${LIBELLES_ACTE[p.nature]} · effet ${p.effet.reference}`}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={envoyer}
      enfants={
        <>
          <div>
            {p.effet.compteTiers.numero} · {p.effet.compteTiers.intitule} · {fmt(p.effet.montant)} · échéance {date(p.effet.dateEcheance)} · {LIBELLES_STATUT[p.effet.statut]}
          </div>
          {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Date</span>
            <input ref={champ} type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="border border-border px-2 py-[2px]" />
          </label>
          {regle.role && <SelecteurCompte libelle="Compte" comptes={comptes} valeur={compteId} onChange={setCompteId} erreur={erreurComptes} />}
          {regle.banque && (
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Journal de banque</span>
              <select value={banqueId} onChange={(e) => setBanqueId(e.target.value)} className="border border-border px-2 py-[2px]">
                <option value="">{p.banques.length === 0 ? 'Aucun journal de trésorerie actif · créez-en un dans Structure › Codes journaux' : '·'}</option>
                {p.banques.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
          )}
          {regle.frais && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-text-dim">Frais et intérêts d'escompte</span>
                <input inputMode="decimal" value={frais} onChange={(e) => setFrais(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
              </label>
              <SelecteurCompte libelle="Compte des frais" comptes={comptesFrais} valeur={compteFraisId} onChange={setCompteFraisId} />
            </div>
          )}
          {regle.commission && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-text-dim">Commission</span>
                <input inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
              </label>
              <SelecteurCompte libelle="Compte de commission" comptes={comptesCommission} valeur={compteCommissionId} onChange={setCompteCommissionId} />
            </div>
          )}
          {(regle.frais || regle.commission) && p.nature !== 'PAIEMENT' && <div className="text-text-dim">Net crédité · {fraisM === null || commissionM === null ? '·' : fmt(net)}</div>}
          {regle.reference && (
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">{p.nature === 'BON_A_PAYER' ? 'Référence du relevé (facultative)' : 'Référence de la pièce de la banque'}</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} className="border border-border px-2 py-[2px]" />
            </label>
          )}
          {p.nature === 'IMPAYE' && p.effet.statut === 'ESCOMPTE' && p.effet.actes.some((a) => !a.annuleLe && a.nature === 'DECOMPTE_ESCOMPTE') && (
            <div className="text-text-dim">Effet escompté et décompté · la banque reprend le nominal sur le compte de banque du décompte, dans la même pièce.</div>
          )}
        </>
      }
      pied={
        <button type="submit" disabled={envoi || manque() !== null} className="bg-sel text-white font-semibold px-3 py-1 disabled:opacity-40">
          {envoi ? '…' : LIBELLES_ACTE[p.nature]}
        </button>
      }
    />
  );
}

function ModaleMotif(p: { titre: string; resume: string; action: string; chemin: string; onFermer: () => void; onFait: (r: ReponseAnnulation) => Promise<void>; onRelire: (err: unknown, defaut: string) => void }) {
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
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, 'Annulation impossible');
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre
      id="titre-modale-motif-effet"
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

/** Les actes d'un effet, annulés compris · chaque pièce et son négatif nommés. */
function ModaleActes(p: { effet: Effet; onFermer: () => void }) {
  useFermetureParEchap(p.onFermer, false);
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => boite.current?.focus({ preventScroll: true }), []);
  return (
    <Cadre
      id="titre-actes-effet"
      titre={`Actes · effet ${p.effet.reference}`}
      onFermer={p.onFermer}
      envoi={false}
      focus={boite}
      enfants={
        <table className="w-full">
          <thead>
            <tr>
              <th scope="col" className="text-left px-2 py-1">Acte</th>
              <th scope="col" className="text-left px-2 py-1">Date</th>
              <th scope="col" className="text-left px-2 py-1">Compte</th>
              <th scope="col" className="text-left px-2 py-1">Pièce</th>
              <th scope="col" className="text-left px-2 py-1">Annulation</th>
            </tr>
          </thead>
          <tbody>
            {p.effet.actes.map((a) => (
              <tr key={a.id} className={`border-t border-border ${a.annuleLe ? 'text-text-dim' : ''}`}>
                <td className="px-2 py-1">{a.libelle}</td>
                <td className="px-2 py-1">{date(a.date)}</td>
                <td className="px-2 py-1">{a.compte ? a.compte.numero : '·'}</td>
                <td className="px-2 py-1">{a.ecriture ? piece(a.ecriture) : 'sans pièce'}</td>
                <td className="px-2 py-1">{a.annuleLe ? `annulé le ${date(a.annuleLe)}${a.ecritureNegatif ? ` · négatif ${piece(a.ecritureNegatif)}` : ''}${a.motifAnnulation ? ` · ${a.motifAnnulation}` : ''}` : '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      pied={null}
    />
  );
}
