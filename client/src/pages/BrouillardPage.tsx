import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { Aide } from '../components/chrome/Aide';
import type { Compte, EtatBrouillard, Journal, LigneBrouillard, NaturePiece, ResultatValidation, ResultatVisa } from '../lib/types';
import { FicheImputation } from '../components/FicheImputation';
import { LIBELLES_ETAT_VISA, LIBELLES_NATURE_PIECE, phraseDuVisa } from '../lib/circuit-visa';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import { PortailModale } from '../components/PortailModale';
import { montantOuVide as montant } from '../lib/montants';
import { compteDuNumeroTape } from '../lib/comptes-proposes';
import { messageSuppressionBrouillard } from '../lib/pieces-jointes';
import { ecouterEchap } from '../lib/echap';

/**
 * BROUILLARD · État → Brouillard de Sage 100 i7 : « un document qui permet de
 * conserver une trace écrite des saisies faites sur une période ou un
 * journal ». Ici, il fait un peu plus que conserver une trace, il donne le
 * bouton qui fait entrer les écritures au livre-journal.
 *
 * La colonne ANCIENNETÉ est la part réglementaire de cet écran, et son délai
 * N'EST PAS LE MÊME DANS LES DEUX RÉFÉRENTIELS · le serveur le calcule et
 * l'écran l'affiche, il n'est écrit en dur nulle part ici :
 *
 *  · SYCEBNL, Partie 2 ch. 2 · « les données des documents auxiliaires sont
 *    centralisées AU MOINS CHAQUE SEMAINE dans le journal ou le grand-livre » ;
 *  · AUDCIF, art. 19 · « les totaux de ces supports sont périodiquement et AU
 *    MOINS UNE FOIS PAR MOIS centralisés dans le livre-journal et le
 *    grand-livre ».
 *
 * Au-delà du délai applicable, une écriture qui séjourne au brouillard n'est
 * plus un document de travail, c'est un retard de centralisation · le logiciel
 * le dit au lieu de le taire.
 *
 * Sage, lui, se contente d'exiger qu'un journal soit imprimé avant d'être
 * clôturé. C'est moins exigeant, et sans rapport avec un délai.
 */

type LigneOrigine = LigneBrouillard['lignes'][number];

/** Une ligne en cours de modification · l'origine garde tout ce que l'écran ne montre pas. */
interface LigneEditee {
  origine: LigneOrigine | null;
  compteId: string;
  numero: string;
  libelle: string;
  debit: string;
  credit: string;
}

/**
 * Le TRANSFERT d'un brouillard resté dans un journal de situation (reprise des
 * écritures tenues) · journal d'arrivée ordinaire, report au premier jour non
 * clôturé sur demande (AUDCIF art. 22, 4°). Les lignes ne bougent pas.
 */
interface Transfert {
  ligne: LigneBrouillard;
  journalId: string;
  reporter: boolean;
}

interface EcritureEditee {
  id: string;
  numeroPiece: number | null;
  journal: string;
  date: string;
  libelle: string;
  reference: string;
  lignes: LigneEditee[];
}

function lireMontant(s: string): number {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Le corps du PATCH, avec les MÊMES clés que la saisie. Le serveur remplace
 * les lignes en bloc : tout ce que la ligne portait (taux de TVA, échéance,
 * date de versement, devise, ventilation) est renvoyé tel quel, sans quoi la
 * correction d'un libellé effacerait une facture en dollars ou sortirait une
 * dépense de son projet. Une ventilation qui couvrait la ligne entière suit le
 * nouveau montant, comme à la saisie (une section par axe) ; une ventilation
 * partielle reste telle quelle, et le serveur refuse si elle ne boucle plus.
 */
function corpsModification(e: EcritureEditee) {
  return {
    date: e.date,
    libelle: e.libelle,
    reference: e.reference,
    lignes: e.lignes.map((l) => {
      const debit = lireMontant(l.debit);
      const credit = lireMontant(l.credit);
      const o = l.origine;
      const ventilations = (o?.ventilations ?? []).map((v) =>
        v.debit === o!.debit && v.credit === o!.credit
          ? { sectionId: v.sectionId, debit: debit || undefined, credit: credit || undefined }
          : { sectionId: v.sectionId, debit: v.debit || undefined, credit: v.credit || undefined },
      );
      return {
        compteId: l.compteId,
        libelle: l.libelle || undefined,
        debit: debit || undefined,
        credit: credit || undefined,
        tauxTvaId: o?.tauxTvaId ?? undefined,
        dateEcheance: o?.dateEcheance ?? undefined,
        dateVersement: o?.dateVersement ?? undefined,
        // Le mode de règlement suit la ligne (ligne sage-l2, fonction 1) · le
        // PATCH remplace les lignes, et un champ omis serait effacé.
        modeReglementId: o?.modeReglementId ?? undefined,
        deviseId: o?.deviseId ?? undefined,
        montantDevise: o?.montantDevise ?? undefined,
        coursApplique: o?.coursApplique ?? undefined,
        ...(ventilations.length > 0 ? { ventilations } : {}),
      };
    }),
  };
}

export function BrouillardPage() {
  // Valider est retiré à l'aide-comptable · il supprime encore ses brouillons.
  const { utilisateur, peutEcrire, peutValider } = useAuth();
  const { exerciceCourant } = useExercice();
  const [etat, setEtat] = useState<EtatBrouillard | null>(null);
  const [journaux, setJournaux] = useState<Journal[]>([]);
  const [journalId, setJournalId] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [deplie, setDeplie] = useState<Set<string>>(new Set());
  const [dateLimite, setDateLimite] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [edition, setEdition] = useState<EcritureEditee | null>(null);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [transfert, setTransfert] = useState<Transfert | null>(null);
  const [erreurTransfert, setErreurTransfert] = useState<string | null>(null);
  // Ligne microfina-m1 · la fiche d'imputation ouverte, et le filtre « objet par objet ».
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [nature, setNature] = useState<NaturePiece | ''>('');
  // LA DÉROGATION NOMINATIVE (relecture du circuit de visa, M3) · le motif de
  // l'auteur inconnu et celui du double regard la nomment comme issue, et le
  // serveur l'accepte (`secondRegardNom`, `secondRegardMotif`), mais aucun
  // écran ne l'envoyait · l'issue écrite était impossible. Offerte après un
  // refus de ce type seulement, jamais d'office.
  const [derogationOfferte, setDerogationOfferte] = useState(false);
  const [secondRegardNom, setSecondRegardNom] = useState('');
  const [secondRegardMotif, setSecondRegardMotif] = useState('');

  const charger = async () => {
    if (!exerciceCourant) return;
    try {
      const r = await api.get<EtatBrouillard>(
        `/ecritures/brouillard?exerciceId=${exerciceCourant.id}${journalId ? `&journalId=${journalId}` : ''}`,
      );
      setEtat(r);
      setSelection(new Set());
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  };

  useEffect(() => {
    api.get<Journal[]>('/journaux').then(setJournaux, () => setJournaux([]));
  }, []);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciceCourant?.id, journalId]);

  useEffect(() => {
    if (exerciceCourant && !dateLimite) setDateLimite(new Date().toISOString().slice(0, 10));
  }, [exerciceCourant, dateLimite]);

  const basculer = (id: string) =>
    setSelection((prev) => {
      const suivante = new Set(prev);
      if (suivante.has(id)) suivante.delete(id);
      else suivante.add(id);
      return suivante;
    });

  // Le brouillard resté dans un journal de situation ne se valide pas sur
  // place · il se transfère d'abord (le serveur le refuse en le nommant).
  // Le filtre par nature (ligne microfina-m1) ne retire rien du brouillard ·
  // les totaux restent ceux du serveur, la liste seule se restreint.
  const lignesVues = useMemo(() => (etat?.lignes ?? []).filter((l) => !nature || l.nature === nature), [etat, nature]);
  const selectionnables = useMemo(() => lignesVues.filter((l) => l.equilibree && !l.journalDeSituation), [lignesVues]);
  const circuit = etat?.circuitVisa === true;
  const heritees = useMemo(() => (etat?.lignes ?? []).filter((l) => l.journalDeSituation).length, [etat]);
  // Les journaux où la pièce peut aller · ordinaires et actifs.
  const journauxDArrivee = useMemo(() => journaux.filter((j) => j.type !== 'SITUATION' && j.estActif), [journaux]);

  /**
   * CE QUE L'ÉCRAN DIT APRÈS UNE VALIDATION, et pourquoi ce n'est pas un
   * simple compteur.
   *
   * L'ancienne phrase de `validerJusqua` annonçait « Rien à valider jusqu'à
   * cette date. » dès que `validees` valait zéro. Avec le double regard, c'est
   * le mensonge le plus exact possible : le brouillard est PLEIN, il vient
   * d'être refusé en entier, et l'écran annonce qu'il est vide. Le comptable
   * croit sa période centralisée, l'AUDCIF art. 22, 2° la veut faite « au
   * terme de chaque période qui ne peut excéder un mois », et rien ne le
   * détrompera avant la clôture.
   *
   * Le compteur des écartées passe donc AVANT le cas vide, et le motif sourcé
   * le suit.
   */
  const phraseValidation = (r: ResultatValidation, siRienAFaire?: string) => {
    // Le brouillard resté dans un journal de situation, écarté et compté par
    // la validation par période · dit après le reste, jamais tu (la période
    // ne passerait pas pour centralisée).
    const situation =
      ((r.ecarteesJournalDeSituation ?? 0) > 0 ? ` ${r.motifEcarteesJournalDeSituation ?? ''}`.trimEnd() : '') +
      // Une pièce retirée pendant la validation n'est pas entrée au
      // livre-journal · dite, jamais lue comme déjà validée (relecture M5).
      ((r.retireesEntreTemps ?? 0) > 0
        ? ` ${r.retireesEntreTemps} pièce(s) retirée(s) du brouillard pendant la validation, non validée(s).`
        : '');
    // LE VISA ET L'AUTEUR INCONNU (ligne microfina-m1) · comptés comme le
    // double regard, AVANT le cas vide · un lot écarté faute de visa n'est pas
    // un brouillard vide.
    const ecarteesVisa = r.refuseesVisa ?? 0;
    const ecarteesInconnu = r.refuseesAuteurInconnu ?? 0;
    if (r.refuseesSecondRegard > 0 || ecarteesVisa > 0 || ecarteesInconnu > 0) {
      const motifs = [
        r.refuseesSecondRegard > 0 ? r.motifRefus : null,
        ecarteesInconnu > 0 ? r.motifAuteurInconnu : null,
        ecarteesVisa > 0 ? r.motifVisa : null,
      ]
        .filter(Boolean)
        .join(' ');
      return (
        `${r.validees} écriture(s) entrée(s) au livre-journal, ` +
        `${r.refuseesSecondRegard + ecarteesVisa + ecarteesInconnu} écartée(s). ${motifs}${situation}`
      );
    }
    if (r.validees === 0 && siRienAFaire && !situation) return siRienAFaire;
    const visa = r.sousDerogation > 0 ? ' Second regard nominatif porté au journal.' : '';
    return `${r.validees} écriture(s) entrée(s) au livre-journal.${visa}${situation}`;
  };

  /** Les deux champs vont ensemble · le serveur refuse l'un sans l'autre, en le disant. */
  const derogation = () =>
    derogationOfferte && (secondRegardNom.trim() || secondRegardMotif.trim())
      ? { secondRegardNom: secondRegardNom.trim(), secondRegardMotif: secondRegardMotif.trim() }
      : {};

  const apresValidation = (r: ResultatValidation, siRienAFaire?: string) => {
    setInfo(phraseValidation(r, siRienAFaire));
    if (r.refuseesSecondRegard > 0 || (r.refuseesAuteurInconnu ?? 0) > 0) setDerogationOfferte(true);
    else if (r.sousDerogation > 0) {
      setSecondRegardNom('');
      setSecondRegardMotif('');
      setDerogationOfferte(false);
    }
  };

  const validerSelection = async () => {
    if (selection.size === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<ResultatValidation>('/ecritures/valider', {
        ecritureIds: [...selection],
        ...derogation(),
      });
      apresValidation(r);
      await charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Validation impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const validerJusqua = async () => {
    if (!exerciceCourant || !dateLimite) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<ResultatValidation>('/ecritures/valider-jusqua', {
        exerciceId: exerciceCourant.id,
        dateLimite,
        journalId: journalId || undefined,
        ...derogation(),
      });
      apresValidation(r, 'Rien à valider jusqu’à cette date.');
      await charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Validation impossible');
    } finally {
      setEnvoi(false);
    }
  };

  /**
   * VISER LA SÉLECTION (ligne microfina-m1, idée 1) · chaque pièce part avec
   * l'empreinte du contenu que la liste a montré · le serveur refuse un
   * contenu changé depuis, et rend chaque refus nommé.
   */
  const viserSelection = async () => {
    if (!etat || selection.size === 0) return;
    const pieces = etat.lignes.filter((l) => selection.has(l.id) && l.empreinte).map((l) => ({ id: l.id, empreinte: l.empreinte as string }));
    if (pieces.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<ResultatVisa>('/circuit-visa/ecritures', { pieces });
      setInfo(phraseDuVisa(r));
      await charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Visa impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const retirerVisaSelection = async () => {
    if (selection.size === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ retires: number; refusees: { piece: string; motif: string }[] }>('/circuit-visa/ecritures/retrait', {
        ecritureIds: [...selection],
      });
      const refus = r.refusees.map((x) => `${x.piece} · ${x.motif}`).join(' ');
      setInfo(`${r.retires} visa(s) retiré(s).${refus ? ` ${r.refusees.length} refusé(s) · ${refus}` : ''}`);
      await charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Retrait impossible');
    } finally {
      setEnvoi(false);
    }
  };

  /**
   * « Modifier » une écriture du brouillard (audit de l'interface du
   * 2026-09-27, I11) · la route existait sans geste, si bien qu'une erreur de
   * compte ou de montant imposait de supprimer la pièce et de la ressaisir, en
   * perdant son numéro. Seul le brouillard se modifie ; une écriture validée
   * passe par la correction (AUDCIF art. 20), et le serveur refuse une pièce
   * lettrée, pointée ou tenue par un module.
   */
  const ouvrirEdition = (l: LigneBrouillard) => {
    setErreurEdition(null);
    // UN NUMÉRO TAPÉ SE RÉSOUT DANS TOUT LE PLAN (`lib/comptes-proposes.ts`) ·
    // l'édition n'offre aucune liste de choix, et la liste des comptes
    // personnalisés aurait dit « introuvable au plan » d'un compte qui y est ;
    // le serveur refuse ensuite un compte non personnalisé en le nommant. Un
    // échec de lecture se dit au lieu d'une liste vide.
    if (!comptes)
      api.get<Compte[]>('/comptes?typeCompte=DETAIL').then(setComptes, (e) =>
        setErreurEdition(`Plan de comptes illisible · ${e instanceof ApiError ? e.message : 'serveur injoignable'}`),
      );
    setEdition({
      id: l.id,
      numeroPiece: l.numeroPiece,
      journal: l.journal,
      date: l.date,
      libelle: l.libelle,
      reference: l.reference ?? '',
      lignes: l.lignes.map((li) => ({
        origine: li,
        compteId: li.compteId,
        numero: li.compteNumero,
        libelle: li.libelle ?? '',
        debit: li.debit ? String(li.debit) : '',
        credit: li.credit ? String(li.credit) : '',
      })),
    });
  };

  const changerLigne = (i: number, champ: 'numero' | 'libelle' | 'debit' | 'credit', valeur: string) =>
    setEdition((e) => {
      if (!e) return e;
      const lignes = e.lignes.map((l, k) => {
        if (k !== i) return l;
        if (champ !== 'numero') return { ...l, [champ]: valeur };
        const trouve = compteDuNumeroTape(valeur, comptes ?? []);
        return { ...l, numero: valeur, compteId: trouve?.id ?? '' };
      });
      return { ...e, lignes };
    });

  const totalEdition = (e: EcritureEditee) => ({
    debit: e.lignes.reduce((s, l) => s + lireMontant(l.debit), 0),
    credit: e.lignes.reduce((s, l) => s + lireMontant(l.credit), 0),
  });

  const enregistrerEdition = async (confirmerComptesEnSommeil = false) => {
    if (!edition) return;
    const inconnue = edition.lignes.findIndex((l) => !l.compteId);
    if (inconnue >= 0) {
      setErreurEdition(`Ligne ${inconnue + 1} : compte ${edition.lignes[inconnue].numero || 'vide'} introuvable au plan.`);
      return;
    }
    setEnvoi(true);
    setErreurEdition(null);
    try {
      const corps = {
        ...corpsModification(edition),
        ...(confirmerComptesEnSommeil ? { confirmerComptesEnSommeil: true } : {}),
      };
      await api.patch(`/ecritures/${edition.id}`, corps, { rejouerConflit: true });
      setEdition(null);
      setInfo('Écriture du brouillard modifiée.');
      await charger();
    } catch (e) {
      setErreurEdition(e instanceof ApiError ? e.message : 'Modification impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrirTransfert = (l: LigneBrouillard) => {
    setErreurTransfert(null);
    // Un choix unique se présélectionne.
    setTransfert({ ligne: l, journalId: journauxDArrivee.length === 1 ? journauxDArrivee[0].id : '', reporter: false });
  };

  useEffect(() => {
    if (!transfert) return;
    return ecouterEchap(() => {
      if (envoi) return true;
      setTransfert(null);
      return true;
    });
  }, [transfert, envoi]);

  const transferer = async () => {
    if (!transfert || !transfert.journalId) return;
    setEnvoi(true);
    setErreurTransfert(null);
    try {
      const r = await api.post<{ numeroPiece: number | null; journal: { code: string } }>(
        `/ecritures/${transfert.ligne.id}/transfert`,
        { journalId: transfert.journalId, ...(transfert.reporter ? { reporterAuPremierJourOuvert: true } : {}) },
      );
      setTransfert(null);
      setInfo(
        `Pièce ${transfert.ligne.journal} ${transfert.ligne.numeroPiece ?? '·'} transférée en ${r.journal.code} ` +
          `${r.numeroPiece ?? '·'} · elle se valide maintenant comme toute pièce.`,
      );
      await charger();
    } catch (e) {
      setErreurTransfert(e instanceof ApiError ? e.message : 'Transfert impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const fermerFiche = useCallback(() => setFicheId(null), []);

  const supprimer = async (id: string) => {
    setErreur(null);
    try {
      const r = await api.delete<{ supprime: boolean; piecesDetachees?: number }>(`/ecritures/${id}`);
      setInfo(messageSuppressionBrouillard(r?.piecesDetachees));
      await charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  };

  // 656 px de colonnes fixes + 8 gouttières de 8 px + 24 px de marges =
  // 744 px incompressibles, pour ~326 px utiles à 360 px · le `min-w` va de
  // pair avec le conteneur défilant posé plus bas, sans quoi les dernières
  // colonnes étaient ROGNÉES sans barre pour aller les chercher.
  const grille =
    'grid grid-cols-[28px_92px_60px_70px_1fr_120px_120px_96px_70px] min-w-[744px] gap-2';

  return (
    <div className="p-2">
      <EnteteImpression titre="Brouillard" />
      <div className="flex items-end justify-end mb-1.5 gap-3 flex-wrap">
        <div className="flex items-end gap-2.5 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Journal</span>
            <select
              value={journalId}
              onChange={(e) => setJournalId(e.target.value)}
              className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px] min-w-[170px]"
            >
              <option value="">Tous les journaux</option>
              {journaux.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} · {j.intitule}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Nature</span>
            <select
              value={nature}
              onChange={(e) => {
                setNature(e.target.value as NaturePiece | '');
                // Une pièce masquée par le filtre ne se vise ni ne se valide à l'aveugle.
                setSelection(new Set());
              }}
              className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px] min-w-[150px]"
            >
              <option value="">Toutes les pièces</option>
              {(Object.keys(LIBELLES_NATURE_PIECE) as NaturePiece[]).map((n) => (
                <option key={n} value={n}>
                  {LIBELLES_NATURE_PIECE[n]}
                </option>
              ))}
            </select>
          </label>
          {peutValider && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-text-dim">Valider jusqu'au</span>
                <input
                  type="date"
                  value={dateLimite}
                  onChange={(e) => setDateLimite(e.target.value)}
                  className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px] font-mono"
                />
              </label>
              <button
                onClick={validerJusqua}
                disabled={envoi || !dateLimite}
                className="border border-border rounded-[3px] bg-surface px-3 py-1.5 text-[11.5px] font-semibold hover:bg-chrome-alt disabled:opacity-50"
              >
                Valider la période
              </button>
              {circuit && (
                <>
                  <button
                    onClick={viserSelection}
                    disabled={envoi || selection.size === 0}
                    className="border border-border rounded-[3px] bg-surface px-3 py-1.5 text-[11.5px] font-semibold hover:bg-chrome-alt disabled:opacity-50"
                  >
                    Viser la sélection ({selection.size})
                  </button>
                  <button
                    onClick={retirerVisaSelection}
                    disabled={envoi || selection.size === 0}
                    className="border border-border rounded-[3px] bg-surface px-3 py-1.5 text-[11.5px] hover:bg-chrome-alt disabled:opacity-50"
                  >
                    Retirer le visa
                  </button>
                </>
              )}
              <button
                onClick={validerSelection}
                disabled={envoi || selection.size === 0}
                className="bg-sel text-white text-[11.5px] font-bold px-3.5 py-1.5 rounded-[3px] hover:brightness-110 disabled:opacity-50"
              >
                Valider la sélection ({selection.size})
              </button>
            </>
          )}
          <span className="flex items-center gap-1.5 pb-1.5">
            <Aide sujet="brouillard" />
            {circuit && (
              <Aide
                titre="Circuit de visa"
                texte="Ce dossier exige qu'une pièce soit visée avant sa validation, par un administrateur ou un comptable autre que l'auteur de son dernier contenu. Le visa porte sur le contenu affiché · une modification, une réimputation ou une ventilation changée le fait tomber, et la pièce se revise. La validation écarte, en les comptant, les pièces non visées et celles dont le visa est tombé. La fiche d'imputation imprime la saisie, le visa et la validation."
                source="AUDCIF art. 22, 2° · option du dossier"
              />
            )}
            <Aide
              titre="Brouillard et clôture"
              texte="La clôture de l'exercice refuse de s'exécuter tant qu'il reste quoi que ce soit au brouillard."
              source="Fin d'exercice"
            />
          </span>
        </div>
      </div>

      {erreur && (
        <div className="mb-2.5 text-[11.5px] text-danger bg-danger-soft border border-danger/30 rounded-[3px] px-2.5 py-1.5">
          {erreur}
        </div>
      )}
      {info && (
        <div className="mb-2.5 text-[11.5px] text-positive bg-positive-soft border border-positive/30 rounded-[3px] px-2.5 py-1.5 flex justify-between">
          <span>{info}</span>
          <button onClick={() => setInfo(null)} className="font-bold hover:underline">
            Fermer
          </button>
        </div>
      )}
      {peutValider && derogationOfferte && (
        <fieldset className="mb-2.5 flex flex-wrap items-end gap-2 border border-border rounded-[3px] bg-surface px-2.5 py-1.5">
          <legend className="text-[11px] font-bold text-text-dim px-1">Second regard porté hors du logiciel</legend>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Nom</span>
            <input
              value={secondRegardNom}
              onChange={(e) => setSecondRegardNom(e.target.value)}
              maxLength={120}
              className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px] min-w-[180px]"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <span className="text-[11px] font-bold text-text-dim">Ce qui a été relu</span>
            <input
              value={secondRegardMotif}
              onChange={(e) => setSecondRegardMotif(e.target.value)}
              maxLength={300}
              className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px]"
            />
          </label>
          <Aide
            titre="Second regard porté hors du logiciel"
            texte="Renseignés, le nom et le motif accompagnent la prochaine validation · ils lèvent le double regard, jamais le visa, et sont portés sur chaque pièce validée et sur sa fiche d'imputation."
            source="Double regard · option du dossier"
          />
        </fieldset>
      )}

      {etat && etat.totaux.enRetard > 0 && (
        <div className="mb-2.5 text-[11.5px] text-warning bg-warning-soft border border-warning/30 rounded-[3px] px-2.5 py-1.5 flex items-center gap-1.5">
          <strong>
            {etat.totaux.enRetard} écriture(s) séjournent au brouillard depuis plus de {etat.delaiCentralisationJours}{' '}
            jours.
          </strong>
          {utilisateur?.tenant.referentiel === 'SYSCOHADA' ? (
            <Aide
              titre="Retard de centralisation"
              texte="L'AUDCIF veut les journaux auxiliaires centralisés au moins une fois par mois dans le livre-journal et le grand-livre : au-delà, ce n'est plus un document de travail, c'est un retard de centralisation."
              source="AUDCIF, art. 19"
            />
          ) : (
            <Aide
              titre="Retard de centralisation"
              texte="Le SYCEBNL veut les journaux auxiliaires centralisés au moins chaque semaine dans le journal ou le grand-livre : au-delà, ce n'est plus un document de travail, c'est un retard de centralisation."
              source="SYCEBNL, Partie 2, ch. 2"
            />
          )}
        </div>
      )}
      {heritees > 0 && (
        <div className="mb-2.5 text-[11.5px] text-warning bg-warning-soft border border-warning/30 rounded-[3px] px-2.5 py-1.5 flex items-center gap-1.5">
          <strong>
            {heritees} pièce(s) de la liste sont restées au brouillard dans un journal de situation · elles ne s’y
            valident pas, transférez-les dans un journal ordinaire.
          </strong>
          <Aide
            titre="Brouillard d'un journal de situation"
            texte="Saisies avant la règle des écritures de situation et tenues par une lettre, un pointage ou un module, ces pièces sont restées au brouillard. Le transfert les fait passer dans un journal ordinaire, au numéro suivant de ce journal, sans toucher à leurs lignes · lettrage, pointage et liens des modules restent tels quels. Datée d'une période close dans le journal choisi, la pièce va au premier jour non clôturé si vous le demandez, sa date d'origine gardée en date de valeur. Elle se valide ensuite comme toute pièce."
            source="AUDCIF, art. 22, 1° à 4°"
          />
        </div>
      )}
      {etat && etat.totaux.desequilibrees > 0 && (
        <div className="mb-2.5 text-[11.5px] text-danger bg-danger-soft border border-danger/30 rounded-[3px] px-2.5 py-2">
          {etat.totaux.desequilibrees} écriture(s) sont déséquilibrées et ne peuvent pas être validées. Reprenez-les
          dans la saisie.
        </div>
      )}

      <div className="bg-surface border border-border rounded-[4px] shadow-posee overflow-x-auto">
        <div
          className={`${grille} px-3 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim`}
        >
          <span>
            {peutValider && (
              <input
                type="checkbox"
                checked={selection.size > 0 && selection.size === selectionnables.length}
                onChange={(e) =>
                  setSelection(e.target.checked ? new Set(selectionnables.map((l) => l.id)) : new Set())
                }
              />
            )}
          </span>
          <span>DATE</span>
          <span>JAL</span>
          <span>Pièce</span>
          <span>Libellé</span>
          <span className="text-right">Débit</span>
          <span className="text-right">Crédit</span>
          <span className="text-right">Ancienneté</span>
          <span />
        </div>

        {!etat && <div className="px-3 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
        {etat && lignesVues.map((l) => (
          <div key={l.id}>
            <div
              className={`${grille} px-3 py-1 text-[11.5px] items-center border-b border-border/40 ${
                !l.equilibree ? 'bg-danger-soft' : l.retardCentralisation ? 'bg-warning-soft' : ''
              }`}
            >
              <span>
                {peutValider && l.equilibree && !l.journalDeSituation && (
                  <input type="checkbox" checked={selection.has(l.id)} onChange={() => basculer(l.id)} />
                )}
              </span>
              <span className="font-mono">{l.date}</span>
              <span className="font-mono">{l.journal}</span>
              <span className="font-mono text-text-dim">{l.numeroPiece ?? '·'}</span>
              <span className="flex items-center gap-1.5 min-w-0">
                {/* L'ÉTAT DU VISA (ligne microfina-m1), en tête du libellé ·
                    sous le circuit seulement, son auteur et le refus que le
                    lecteur recevrait en bulle. */}
                {circuit && l.visa && (
                  <span
                    className={`shrink-0 text-[10.5px] font-bold rounded-[3px] px-1 border ${
                      l.visa.etat === 'VISEE'
                        ? 'text-positive bg-positive-soft border-positive/40'
                        : l.visa.etat === 'VISA_TOMBE'
                          ? 'text-danger bg-danger-soft border-danger/40'
                          : 'text-text-dim border-border'
                    }`}
                    title={[
                      l.visa.visePar ? `Visée par ${l.visa.visePar}` : null,
                      l.saisiePar ? `Saisie par ${l.saisiePar}` : null,
                      l.dernierContenuLe ? `Dernier contenu par ${l.dernierContenuConnu ? l.dernierContenuPar : 'un auteur non connu'}` : null,
                      l.motifRefusVisa ?? null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  >
                    {LIBELLES_ETAT_VISA[l.visa.etat]}
                  </span>
                )}
                <button
                  onClick={() =>
                    setDeplie((prev) => {
                      const s = new Set(prev);
                      if (s.has(l.id)) s.delete(l.id);
                      else s.add(l.id);
                      return s;
                    })
                  }
                  className="text-left truncate hover:underline"
                  title="Voir le détail des lignes"
                >
                  {l.libelle}
                  {l.reference && <span className="text-text-dim"> · {l.reference}</span>}
                </button>
              </span>
              <span className="text-right font-mono">{montant(l.debit)}</span>
              <span className="text-right font-mono">{montant(l.credit)}</span>
              <span
                className={`text-right font-mono text-[11.5px] ${
                  l.retardCentralisation ? 'text-warning font-bold' : 'text-text-dim'
                }`}
              >
                {l.ancienneteJours} j
              </span>
              <span className="text-right whitespace-nowrap">
                <button
                  onClick={() => setFicheId(l.id)}
                  title="Fiche d'imputation · saisie, visa et validation"
                  className="text-[11.5px] text-sel hover:underline mr-2"
                >
                  Fiche
                </button>
                {peutEcrire && l.journalDeSituation && (
                  <button
                    onClick={() => ouvrirTransfert(l)}
                    title="Transférer dans un journal ordinaire, où la pièce se valide"
                    className="text-[11.5px] text-sel font-semibold hover:underline mr-2"
                  >
                    Transférer
                  </button>
                )}
                {peutEcrire && (
                  <button
                    onClick={() => ouvrirEdition(l)}
                    title="Modifier la pièce au brouillard"
                    className="text-[11.5px] text-sel hover:underline mr-2"
                  >
                    Modifier
                  </button>
                )}
                {peutEcrire && (
                  <button
                    onClick={() => supprimer(l.id)}
                    title="Supprimer du brouillard"
                    className="text-[11.5px] text-danger hover:text-danger"
                  >
                    Supprimer
                  </button>
                )}
              </span>
            </div>
            {deplie.has(l.id) &&
              l.lignes.map((li, i) => (
                <div
                  key={i}
                  className={`${grille} px-3 py-0.5 text-[11.5px] border-b border-border/30 bg-chrome-alt/50`}
                >
                  <span />
                  <span />
                  <span />
                  <span className="font-mono text-text-dim">{li.compteNumero}</span>
                  <span className="truncate text-text-dim">{li.libelle ?? li.compteIntitule}</span>
                  <span className="text-right font-mono">{montant(li.debit)}</span>
                  <span className="text-right font-mono">{montant(li.credit)}</span>
                  <span />
                  <span />
                </div>
              ))}
          </div>
        ))}

        {etat && etat.lignes.length > 0 && lignesVues.length === 0 && (
          <div className="px-3 py-3 text-[11.5px] text-text-dim italic">
            Aucune pièce de cette nature dans la liste lue · choisissez « Toutes les pièces » pour revoir le brouillard.
          </div>
        )}
        {etat && etat.lignes.length === 0 && (
          <div className="px-3 py-5 text-[11.5px] text-text-dim italic">
            Le brouillard est vide : toutes les écritures de cet exercice sont entrées au livre-journal.
          </div>
        )}

        {etat && etat.lignes.length > 0 && (
          <div className={`${grille} px-3 py-1.5 bg-chrome border-t border-border text-[11.5px] font-bold`}>
            <span />
            <span />
            <span />
            <span />
            <span>{etat.totaux.nombre} écriture(s) en brouillard</span>
            <span className="text-right font-mono">{montant(etat.totaux.debit)}</span>
            <span className="text-right font-mono">{montant(etat.totaux.credit)}</span>
            <span />
            <span />
          </div>
        )}
        {/* Une tranche se dit (audit final F185) · les totaux ci-dessus portent
            tout le brouillard, la liste seulement ses premières écritures. */}
        {etat?.tronque && (
          <div className="px-3 py-1 text-[11px] text-text-dim">
            {etat.lignes.length} premières écritures sur {etat.totaux.nombre} · restreignez au journal pour les voir toutes.
          </div>
        )}
      </div>

      {ficheId && <FicheImputation ecritureId={ficheId} onFermer={fermerFiche} />}

      {transfert && (
        <PortailModale>
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 anim-voile">
            <form
              role="dialog"
              aria-label="Transférer dans un journal ordinaire"
              onSubmit={(e) => {
                e.preventDefault();
                void transferer();
              }}
              className="w-full max-w-[460px] bg-surface border border-border rounded-[4px] overflow-hidden shadow-flottante anim-modale modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
            >
              <div className="h-[32px] flex items-center justify-between px-3 bg-surface text-text border-b border-border text-[11.5px]">
                <span>
                  Transférer la pièce {transfert.ligne.journal} {transfert.ligne.numeroPiece ?? ''}
                </span>
                <Aide
                  titre="Transférer dans un journal ordinaire"
                  texte="La pièce change de journal et prend le numéro suivant du journal choisi. Ses lignes, son lettrage, son pointage et ses liens aux modules ne bougent pas, et le journal d'audit garde son journal et son numéro d'origine. Si sa date tombe dans une période close du journal choisi, cochez le report · elle sera enregistrée au premier jour non clôturé, sa date d'origine gardée en date de valeur, jamais au-delà de l'exercice."
                  source="AUDCIF, art. 22, 1° à 4°"
                />
              </div>
              <div className="p-3 flex flex-col gap-2.5 text-[11.5px]">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-text-dim">Journal d'arrivée</span>
                  <select
                    autoFocus
                    required
                    value={transfert.journalId}
                    onChange={(e) => setTransfert({ ...transfert, journalId: e.target.value })}
                    className="border border-border rounded-[3px] bg-surface px-2 py-1"
                  >
                    <option value="">Choisir un journal…</option>
                    {journauxDArrivee.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.code} · {j.intitule}
                      </option>
                    ))}
                  </select>
                </label>
                {journauxDArrivee.length === 0 && (
                  <div className="text-warning">
                    Aucun journal ordinaire actif dans ce dossier · créez-en un dans Structure, Journaux, puis revenez.
                  </div>
                )}
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={transfert.reporter}
                    onChange={(e) => setTransfert({ ...transfert, reporter: e.target.checked })}
                  />
                  <span>Reporter au premier jour non clôturé si la date tombe dans une période close</span>
                </label>
                {erreurTransfert && (
                  <div className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">{erreurTransfert}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={envoi} onClick={() => setTransfert(null)} className="border border-border px-3 py-1">
                    Abandonner
                  </button>
                  <button
                    type="submit"
                    disabled={envoi || !transfert.journalId}
                    className="bg-sel text-white font-semibold px-3.5 py-1 disabled:opacity-50"
                  >
                    Transférer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </PortailModale>
      )}

      {edition && (
        <PortailModale>
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 anim-voile">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void enregistrerEdition();
              }}
              className="w-full max-w-[760px] bg-surface border border-border rounded-[4px] overflow-hidden shadow-flottante anim-modale modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
            >
              <div className="h-[32px] flex items-center justify-between px-3 bg-surface text-text border-b border-border text-[11.5px]">
                <span>
                  Modifier la pièce {edition.journal} {edition.numeroPiece ?? ''}
                </span>
                <Aide
                  titre="Modifier au brouillard"
                  texte="Tant qu'elle n'est pas validée, une pièce se modifie : date, libellé, référence, comptes et montants. Le taux de TVA, l'échéance, la devise et la ventilation de chaque ligne sont conservés. Une pièce lettrée ou pointée se délettre ou se dépointe d'abord ; une pièce validée se corrige par inscription en négatif."
                  source="AUDCIF, art. 20 et 22"
                />
              </div>
              <div className="p-3 flex flex-col gap-2.5 text-[11.5px]">
                <div className="grid grid-cols-[140px_1fr_160px] gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Date</span>
                    <input
                      type="date"
                      required
                      value={edition.date}
                      onChange={(e) => setEdition({ ...edition, date: e.target.value })}
                      className="border border-border px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Libellé</span>
                    <input
                      required
                      value={edition.libelle}
                      onChange={(e) => setEdition({ ...edition, libelle: e.target.value })}
                      className="border border-border px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Référence</span>
                    <input
                      value={edition.reference}
                      onChange={(e) => setEdition({ ...edition, reference: e.target.value })}
                      className="border border-border px-2 py-1"
                    />
                  </label>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left w-[110px]">Compte</th>
                      <th className="text-left">Libellé</th>
                      <th className="text-right w-[110px]">Débit</th>
                      <th className="text-right w-[110px]">Crédit</th>
                      <th className="w-[70px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {edition.lignes.map((l, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            value={l.numero}
                            onChange={(e) => changerLigne(i, 'numero', e.target.value)}
                            title={
                              (comptes ?? []).find((c) => c.id === l.compteId)?.intitule ??
                              l.origine?.compteIntitule ??
                              ''
                            }
                            className={`w-full border px-1.5 py-0.5 ${l.compteId ? 'border-border' : 'border-danger'}`}
                          />
                        </td>
                        <td>
                          <input
                            value={l.libelle}
                            onChange={(e) => changerLigne(i, 'libelle', e.target.value)}
                            className="w-full border border-border px-1.5 py-0.5"
                          />
                        </td>
                        <td>
                          <input
                            value={l.debit}
                            onChange={(e) => changerLigne(i, 'debit', e.target.value)}
                            className="w-full border border-border px-1.5 py-0.5 text-right"
                          />
                        </td>
                        <td>
                          <input
                            value={l.credit}
                            onChange={(e) => changerLigne(i, 'credit', e.target.value)}
                            className="w-full border border-border px-1.5 py-0.5 text-right"
                          />
                        </td>
                        <td className="text-right">
                          {edition.lignes.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setEdition({ ...edition, lignes: edition.lignes.filter((_, k) => k !== i) })}
                              className="text-danger hover:text-danger"
                            >
                              Retirer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2}>
                        <button
                          type="button"
                          onClick={() =>
                            setEdition({
                              ...edition,
                              lignes: [
                                ...edition.lignes,
                                { origine: null, compteId: '', numero: '', libelle: '', debit: '', credit: '' },
                              ],
                            })
                          }
                          className="text-sel hover:underline"
                        >
                          Ajouter une ligne
                        </button>
                      </td>
                      <td className="text-right font-mono font-bold">{montant(totalEdition(edition).debit)}</td>
                      <td className="text-right font-mono font-bold">{montant(totalEdition(edition).credit)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
                {erreurEdition && (
                  <div className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">
                    {erreurEdition}
                    {erreurEdition.startsWith('Compte en sommeil') && (
                      <button
                        type="button"
                        disabled={envoi}
                        onClick={() => void enregistrerEdition(true)}
                        className="ml-2 px-2 py-0.5 border border-border bg-surface text-text"
                      >
                        Confirmer la saisie sur le compte en sommeil
                      </button>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEdition(null)} className="border border-border px-3 py-1">
                    Abandonner
                  </button>
                  <button type="submit" disabled={envoi} className="bg-sel text-white font-semibold px-3.5 py-1 disabled:opacity-50">
                    Enregistrer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </PortailModale>
      )}
    </div>
  );
}
