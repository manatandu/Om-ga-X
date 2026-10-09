import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { IconLock, IconCheck } from '../components/chrome/icons';
import type { Cloture, Compte, GranulariteCloture, Journal, PlanningCloture } from '../lib/types';
import { Aide } from '../components/chrome/Aide';
import { montant } from '../lib/montants';
import { confirmationCloturePeriode } from '../lib/cloture-periode';
import { motifAucunCompteRetenu, RETENUS } from '../lib/comptes-proposes';
import { usePreselectionUnique } from '../lib/preselection-unique';
import { FicheR2Exercice } from '../components/FicheR2Exercice';
import { DatesPortefeuilleExercice } from '../components/DatesPortefeuilleExercice';
import { classeObservation, estNonCalcule, libelleEcheance, libelleMontant, montantNonCalcule } from '../lib/jalons-planning';
import { estSocieteCommerciale } from '../lib/mentions-dossier';
import { ApercuOuverture, issueSansDeclaration, libellesChoix, titreDeclaration } from '../lib/ouverture-suivante';
import { envoyerAvecAccords } from '../lib/accords-dissolution';

const LIBELLE_GRANULARITE: Record<GranulariteCloture, string> = {
  PARTIELLE: 'Partielle',
  TOTALE: 'Totale',
  PERIODE: 'Période',
};

/** AU2 · l'aperçu servi par `GET /exercices/:id/ouverture-suivante`. */
interface OuvertureSuivante extends ApercuOuverture {
  /** Bornée (R9) · `total` dit toujours le nombre de positions. */
  ecarts: {
    compteId: string;
    numero: string | null;
    intitule: string | null;
    devise: string | null;
    cloture: number;
    ouverture: number;
    clotureDevise: number | null;
    ouvertureDevise: number | null;
  }[];
  tronque: boolean;
  lignesTenues: { numero: string; piece: string; debit: number; credit: number; lettree: boolean; pointee: boolean }[];
  /**
   * Ligne lettrage-cloture · les lettrages partiels que la clôture reconduira
   * sur les lignes d'à-nouveau. Absent d'un serveur antérieur, `null` quand
   * l'exercice suivant n'existe pas encore.
   */
  lettragesPartielsAReconduire?: { total: number; groupes: { code: string; compte: string; reste: number }[] } | null;
}

/** Une ligne courte · les lettrages partiels qu'une clôture reconduira. Le détail et la source vont dans la bulle. */
function lettragesAReconduire(r: { total: number; groupes: { code: string; compte: string }[] } | null | undefined): string | null {
  if (!r || r.total === 0) return null;
  const cites = r.groupes.map((g) => `${g.compte} ${g.code}`).join(', ');
  return `${r.total} lettrage(s) partiel(s) reconduit(s) par la clôture sur les lignes d'à-nouveau (${cites}${r.total > r.groupes.length ? ', …' : ''}).`;
}

export function ExercicePage() {
  const { estAdmin, utilisateur } = useAuth();
  const {
    exercices,
    chargement: chargementExercices,
    recharger: rechargerExercices,
    erreur: erreurExercices,
  } = useExercice();

  const [exerciceId, setExerciceId] = useState<string>('');
  const [clotures, setClotures] = useState<Cloture[] | null>(null);
  const [planning, setPlanning] = useState<PlanningCloture | null>(null);
  const [planningOuvert, setPlanningOuvert] = useState(true);
  const [journaux, setJournaux] = useState<Journal[]>([]);
  // Liste de choix (comptes retenus ou utilisés) · null tant qu'elle n'est pas lue.
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  // Les 12 du plan entier · seule destination admise de l’imputation d’ouverture.
  const [comptesReport, setComptesReport] = useState<Compte[] | null>(null);
  const [erreurComptes, setErreurComptes] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Journal + date limite (Partielle), journal seul (Totale), date limite seule (Période)
  const [journalPartielleId, setJournalPartielleId] = useState('');
  const [dateLimitePartielle, setDateLimitePartielle] = useState('');
  const [journalTotaleId, setJournalTotaleId] = useState('');
  // Vide = jusqu'à la fin de l'exercice · Sage vise un journal POUR UNE PÉRIODE.
  const [dateLimiteTotale, setDateLimiteTotale] = useState('');
  const [dateLimitePeriode, setDateLimitePeriode] = useState('');
  const [dateArrete, setDateArrete] = useState('');

  // AU2 · le bilan d'ouverture déjà passé dans l'exercice suivant, confronté
  // au bilan de clôture AVANT la clôture · null tant qu'il n'est pas lu.
  const [ouverture, setOuverture] = useState<OuvertureSuivante | null>(null);
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null);
  const [choixOuverture, setChoixOuverture] = useState<'' | 'RECTIFIER' | 'CONSERVER'>('');
  const [motifConservation, setMotifConservation] = useState('');

  // Imputation aux capitaux propres d'ouverture · voir imputerOuverture.
  const [imputationOuverte, setImputationOuverte] = useState(false);
  const [iMotif, setIMotif] = useState<'CHANGEMENT_METHODE' | 'CORRECTION_ERREUR_SIGNIFICATIVE'>('CHANGEMENT_METHODE');
  const [iMontant, setIMontant] = useState('');
  const [iJustification, setIJustification] = useState('');
  const [iCompteRan, setICompteRan] = useState('');
  const [iCompteContrepartie, setICompteContrepartie] = useState('');

  useEffect(() => {
    if (!exerciceId && exercices.length > 0) {
      const ouvert = exercices.find((e) => e.statut === 'OUVERT') ?? exercices[0];
      setExerciceId(ouvert.id);
    }
  }, [exercices, exerciceId]);

  const exercice = exercices.find((e) => e.id === exerciceId) ?? null;

  // Le champ suit l'exercice sélectionné · sans cela, changer d'exercice
  // laisserait la date du précédent dans la case, prête à être enregistrée
  // sur le mauvais exercice.
  useEffect(() => {
    setDateArrete(exercice?.dateArreteComptes ? exercice.dateArreteComptes.slice(0, 10) : '');
  }, [exercice?.id, exercice?.dateArreteComptes]);

  // Une réponse d'un exercice quitté, ou dépassée par une relecture plus
  // récente, est jetée · sans quoi le planning d'un exercice s'affichait sous
  // un autre (relecture 1 des décisions par la loi du 2026-10-04).
  const jetonCharger = useRef(0);
  // L'EXERCICE AFFICHÉ (relecture 2) · le jeton protège l'ORDRE des
  // réponses, pas l'exercice visé · un enregistrement lancé sur un exercice
  // et relu après en avoir changé remettait son planning sous l'autre.
  const exerciceVise = useRef<string>('');
  const charger = async () => {
    if (!exerciceId) return;
    // Relecture demandée par un geste d'un exercice quitté · rien à relire.
    if (exerciceVise.current !== exerciceId) return;
    const pour = exerciceId;
    const jeton = ++jetonCharger.current;
    try {
      const [c, p] = await Promise.all([
        api.get<Cloture[]>(`/exercices/${pour}/clotures`),
        api.get<PlanningCloture>(`/exercices/${pour}/planning-cloture`),
      ]);
      if (jeton !== jetonCharger.current || exerciceVise.current !== pour) return;
      setClotures(c);
      setPlanning(p);
      setErreur(null);
    } catch (err) {
      if (jeton !== jetonCharger.current || exerciceVise.current !== pour) return;
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les clôtures');
    }
  };

  useEffect(() => {
    // Le planning d'un autre exercice ne reste pas affiché pendant la lecture.
    if (exerciceVise.current !== exerciceId) {
      exerciceVise.current = exerciceId;
      setPlanning(null);
      setClotures(null);
    }
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciceId]);

  // AU2 · l'aperçu de l'ouverture suivante suit l'exercice choisi (et se
  // relit après chaque geste) ; une réponse d'un exercice quitté est jetée.
  useEffect(() => {
    if (!exerciceId) return;
    let actif = true;
    setOuverture(null);
    setErreurOuverture(null);
    setChoixOuverture('');
    setMotifConservation('');
    api.get<OuvertureSuivante>(`/exercices/${exerciceId}/ouverture-suivante`).then(
      (o) => {
        if (actif) setOuverture(o);
      },
      (err) => {
        if (actif) setErreurOuverture(err instanceof ApiError ? err.message : "Bilan d'ouverture de l'exercice suivant illisible");
      },
    );
    return () => {
      actif = false;
    };
  }, [exerciceId, info]);

  useEffect(() => {
    if (!estAdmin) return;
    // Un échec de lecture se dit (§ 9 ter) · avalé, la liste des journaux restait vide sans un mot.
    api.get<Journal[]>('/journaux').then(setJournaux, (err) =>
      setErreur(`Journaux illisibles · ${err instanceof ApiError ? err.message : 'serveur injoignable'}`),
    );
    // Comptes d'imputation, pour l'imputation aux capitaux propres d'ouverture.
    // Liste de choix · comptes retenus ou utilisés (`lib/comptes-proposes.ts`) ;
    // un échec de lecture se dit, il ne laisse pas deux listes muettes.
    api.get<Compte[]>(`/comptes?typeCompte=DETAIL&${RETENUS}`).then(
      (c) => {
        setComptes(c);
        setErreurComptes(null);
      },
      (err) => setErreurComptes(err instanceof ApiError ? err.message : 'serveur injoignable'),
    );
    /*
      LE 12 SE LIT DANS TOUT LE PLAN · c'est la SEULE destination que le
      serveur admet (« destination un 12, seul report à nouveau des deux
      plans », `imputerAuxCapitauxPropresDOuverture`), comme dans
      l'affectation du résultat, rangée au régime « texte » de
      `listes-de-comptes.ts`. Au premier exercice, aucun 12 n'est ni retenu ni
      mouvementé · la règle des comptes retenus viderait la liste au moment où
      le texte impose le compte. Un 12 unique se présélectionne.
    */
    api.get<Compte[]>('/comptes?classe=CLASSE_1&typeCompte=DETAIL').then(
      (c) => setComptesReport(c.filter((x) => x.numero.startsWith('12'))),
      (err) => setErreurComptes(err instanceof ApiError ? err.message : 'serveur injoignable'),
    );
  }, [estAdmin]);

  // La contrepartie, un poste de bilan, reste un CHOIX · liste des comptes
  // retenus ou utilisés. Un seul compte proposé se présélectionne.
  const comptesBilan = comptes ? comptes.filter((c) => !/^[67]/.test(c.numero)) : null;
  usePreselectionUnique(imputationOuverte ? comptesReport : null, iCompteRan, setICompteRan);
  usePreselectionUnique(imputationOuverte ? comptesBilan : null, iCompteContrepartie, setICompteContrepartie);

  const clorePartielle = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciceId) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/${exerciceId}/clotures/partielle`, {
        journalId: journalPartielleId,
        dateLimite: dateLimitePartielle,
      });
      setInfo('Clôture partielle enregistrée.');
      setJournalPartielleId('');
      setDateLimitePartielle('');
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer cette clôture partielle');
    } finally {
      setEnvoi(false);
    }
  };

  const cloreTotale = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciceId) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/${exerciceId}/clotures/totale`, {
        journalId: journalTotaleId,
        ...(dateLimiteTotale ? { dateLimite: dateLimiteTotale } : {}),
      });
      setInfo('Clôture totale enregistrée · définitive.');
      setJournalTotaleId('');
      setDateLimiteTotale('');
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer cette clôture totale');
    } finally {
      setEnvoi(false);
    }
  };

  /**
   * ARRÊTÉ DES COMPTES · quatrième mention obligatoire de chaque page publiée
   * (AUDCIF Titre IX ch. 1 § 2.4) et exigée dans toute publication par
   * l'art. 23, non exclu par l'art. 3 du SYCEBNL.
   *
   * Ce n'est pas la clôture : l'arrêté par les organes dirigeants lui est
   * postérieur de plusieurs semaines, dans la limite de quatre mois (Titre
   * VIII ch. 31 § 1.3). Il se DÉCLARE, il ne se déduit pas · d'où une saisie
   * et non un calcul.
   */
  const arreterComptes = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciceId) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/${exerciceId}/arrete-comptes`, {
        dateArreteComptes: dateArrete || null,
      });
      setInfo(
        dateArrete
          ? 'Date d’arrêté enregistrée · elle figure désormais sur chaque page des états.'
          : 'Date d’arrêté effacée · un nouvel arrêté peut être enregistré.',
      );
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer la date d’arrêté');
    } finally {
      setEnvoi(false);
    }
  };

  /**
   * IMPUTATION AUX CAPITAUX PROPRES D'OUVERTURE · l'une des DEUX seules
   * exceptions à la correspondance bilan de clôture / bilan d'ouverture
   * (AUDCIF art. 34 et Titre V ; SYCEBNL art. 16, 4) et cadre conceptuel
   * § 3.3.1.2.4).
   *
   * Ici et non dans la saisie ordinaire, pour la même raison que l'arrêté des
   * comptes : rompre la correspondance entre deux bilans n'est pas un geste de
   * saisie, c'est une décision sur les méthodes de l'entité ou l'aveu d'une
   * erreur significative.
   */
  const imputerOuverture = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciceId) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      const od = journaux.find((j) => j.code === 'OD');
      await api.post('/ecritures/imputation-ouverture', {
        exerciceId,
        journalId: od?.id ?? journaux[0]?.id,
        motif: iMotif,
        justification: iJustification,
        compteReportANouveauId: iCompteRan,
        compteContrepartieId: iCompteContrepartie,
        montant: Number(iMontant),
      });
      setInfo('Imputation enregistrée · elle porte son motif et sa justification, à reprendre en Notes annexes.');
      setIMontant('');
      setIJustification('');
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer cette imputation');
    } finally {
      setEnvoi(false);
    }
  };

  const clorePeriode = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciceId) return;
    if (!confirm(confirmationCloturePeriode(dateLimitePeriode))) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/${exerciceId}/clotures/periode`, { dateLimite: dateLimitePeriode });
      setInfo('Clôture de période enregistrée · définitive, tous journaux confondus.');
      setDateLimitePeriode('');
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer cette clôture de période');
    } finally {
      setEnvoi(false);
    }
  };

  const annuler = async (c: Cloture) => {
    if (!confirm(`Annuler la clôture ${LIBELLE_GRANULARITE[c.granularite]} du ${new Date(c.dateLimite).toLocaleDateString('fr-FR')} ?`)) return;
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/clotures/${c.id}/annuler`);
      setInfo('Clôture annulée.');
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’annuler cette clôture');
    }
  };

  // CRÉER UN EXERCICE (audit final F80) · la route existait sans aucun appel
  // de l'écran. Seul l'exercice SUIVANT naissait, par la clôture ou les
  // reports provisoires · une reprise (exercice antérieur), un exercice non
  // contigu ou l'exercice de liquidation (AUDCIF art. 7 al. 4) n'avaient
  // aucun chemin. Les règles de l'art. 7 sont celles du serveur, qui refuse.
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nDebut, setNDebut] = useState('');
  const [nFin, setNFin] = useState('');
  const [nLiquidation, setNLiquidation] = useState(false);
  const creerExercice = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post('/exercices', {
        dateDebut: nDebut,
        dateFin: nFin,
        ...(nLiquidation ? { liquidation: true } : {}),
      });
      setInfo(`Exercice du ${new Date(nDebut).toLocaleDateString('fr-FR')} au ${new Date(nFin).toLocaleDateString('fr-FR')} créé.`);
      setNDebut('');
      setNFin('');
      setNLiquidation(false);
      await rechargerExercices();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Création de l’exercice impossible');
    } finally {
      setEnvoi(false);
    }
  };

  // NOUVEL EXERCICE AVEC REPORTS PROVISOIRES (Sage i7) · relançable à
  // volonté, remplacé par le report définitif à la clôture.
  const [reporterBudgetsAussi, setReporterBudgetsAussi] = useState(true);
  const genererProvisoires = async () => {
    if (!exercice) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      const r = await api.post<{
        lignes: number;
        brouillardNonRepris: number;
        budgetsReportes: number | null;
        ouvertureDejaPassee: { pieces: string; comptesDivergents: number } | null;
        lettragesPartielsAReconduire?: { total: number; groupes: { code: string; compte: string; reste: number }[] } | null;
      }>(`/exercices/${exercice.id}/a-nouveaux-provisoires`, { reporterBudgets: reporterBudgetsAussi });
      // AU2 · un bilan d'ouverture déjà passé n'est jamais doublé · le
      // provisoire ne passe rien, et l'écran le dit.
      const dejaPassee = r.ouvertureDejaPassee;
      setInfo(
        (dejaPassee
          ? dejaPassee.comptesDivergents === 0
            ? `Le bilan d'ouverture déjà passé (${dejaPassee.pieces}) correspond au report · aucun report provisoire n'est ajouté.`
            : `Le bilan d'ouverture déjà passé (${dejaPassee.pieces}) diffère du report sur ${dejaPassee.comptesDivergents} position(s) · aucun report provisoire n'est passé, la clôture vous fera déclarer lequel fait foi.`
          : `Report à-nouveau provisoire passé au brouillard de l'exercice suivant (${r.lignes} ligne(s)).`) +
          (r.budgetsReportes !== null ? ` ${r.budgetsReportes} budget(s) reporté(s).` : '') +
          (r.brouillardNonRepris
            ? ` ${r.brouillardNonRepris} écriture(s) encore au brouillard n'y sont pas : validez-les puis relancez.`
            : '') +
          // Ligne lettrage-cloture · le provisoire ne se lettre pas (AU1) ;
          // la clôture dira la même chose, et le fera.
          (lettragesAReconduire(r.lettragesPartielsAReconduire) ? ` ${lettragesAReconduire(r.lettragesPartielsAReconduire)}` : ''),
      );
      await rechargerExercices();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Report provisoire impossible');
    } finally {
      setEnvoi(false);
    }
  };

  // LA DISSOLUTION DÉCLARÉE (décision par la loi du 2026-10-07, point 2) ·
  // l'exercice qui la contient s'arrête à sa date, puis UN exercice de
  // liquidation court du lendemain à la clôture de la liquidation, dont la fin
  // se reporte tant qu'elle n'est pas connue. Le serveur refuse tout le reste.
  const [finLiquidation, setFinLiquidation] = useState('');
  useEffect(() => {
    setFinLiquidation(exercice ? exercice.dateFin.slice(0, 10) : '');
  }, [exercice?.id, exercice?.dateFin]);
  const arreterALaDissolution = async () => {
    if (!exercice || !planning?.dissolution) return;
    const jour = new Date(planning.dissolution.date).toLocaleDateString('fr-FR');
    // LES ACTES CALCULÉS SUR LA PÉRIODE (bloquant 1) · nommés dans la
    // confirmation, retirés seulement avec cet accord, à refaire ensuite sur
    // chaque exercice. Jamais d'office.
    const actes = planning.dissolution.actesDeLaPeriodeARetirer ?? [];
    const retrait = actes.length
      ? `\n\n${actes.length} acte(s) calculé(s) sur la période de l'exercice seront retirés (au brouillard, avec leur écriture ; validés, par inscription en négatif), à refaire ensuite sur chaque exercice :\n· ${actes.slice(0, 8).join('\n· ')}${actes.length > 8 ? '\n· …' : ''}`
      : '';
    if (!confirm(`Arrêter l'exercice au ${jour}, date de la dissolution déclarée ?\n\nL'exercice de liquidation courra du lendemain.${retrait}`)) {
      return;
    }
    // Une réponse arrivée après un changement d'exercice ne s'affiche pas
    // sous un autre · même garde que la lecture du planning.
    const pour = exercice.id;
    const valable = () => exerciceVise.current === pour;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      // L'accord des actes est donné par la confirmation ci-dessus ; un autre
      // refus porteur d'un marqueur (ouverture annulée hors du premier jour,
      // second tour, BLOQUANT 2) se demande sous le refus et relance.
      const r = await envoyerAvecAccords(
        (corps) => api.post<{ actesRetires?: string[]; relevesARevoir?: string[] }>(`/exercices/${pour}/arreter-a-la-dissolution`, corps),
        actes.length ? { retirerActesDeLaPeriode: true } : {},
        (message) => confirm(message),
        (err) => (err instanceof ApiError ? err.message : null),
      );
      await rechargerExercices();
      await charger();
      const suites = [
        ...(r.actesRetires ?? []).map((a) => `${a} · à refaire sur chaque exercice`),
        ...(r.relevesARevoir ?? []),
      ];
      if (valable()) {
        setInfo(
          `Exercice arrêté au ${jour} · les écritures datées après la dissolution suivent leur date dans l'exercice de liquidation.` +
            (suites.length ? ` ${suites.join(' ; ')}.` : ''),
        );
      }
    } catch (err) {
      if (valable()) setErreur(err instanceof ApiError ? err.message : "Arrêt de l'exercice impossible");
    } finally {
      setEnvoi(false);
    }
  };
  // L'ARRÊT S'ANNULE (constat 2 de la relecture) · l'exercice reprend sa fin
  // d'origine et les écritures postérieures à la dissolution y reviennent ;
  // le serveur dit ce qui l'empêche. Rattacher un exercice repris en fait
  // l'exercice de liquidation (constat 13). Même garde de réponse périmée.
  const gesteDissolution = async (route: string, question: string, reussite: string, echec: string) => {
    if (!exercice) return;
    if (!confirm(question)) return;
    const pour = exercice.id;
    const valable = () => exerciceVise.current === pour;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    // LES ACTES CALCULÉS SUR LA PÉRIODE (bloquant 1) et L'OUVERTURE ANNULÉE
    // HORS DU PREMIER JOUR (second tour, BLOQUANT 2) · le serveur les nomme au
    // refus avec leur marqueur (`ACCORDS_DISSOLUTION`), et le geste se relance
    // avec l'accord du cabinet, jamais sans.
    try {
      const r = await envoyerAvecAccords(
        (corps) => api.post<{ actesRetires?: string[]; relevesARevoir?: string[] }>(`/exercices/${pour}/${route}`, corps),
        {},
        (message) => confirm(message),
        (err) => (err instanceof ApiError ? err.message : null),
      );
      await rechargerExercices();
      await charger();
      const suites = [...(r.actesRetires ?? []).map((a) => `${a} · à refaire sur chaque exercice`), ...(r.relevesARevoir ?? [])];
      if (valable()) setInfo(reussite + (suites.length ? ` ${suites.join(' ; ')}.` : ''));
    } catch (err) {
      if (valable()) setErreur(err instanceof ApiError ? err.message : echec);
    } finally {
      setEnvoi(false);
    }
  };
  const annulerArret = () =>
    gesteDissolution(
      'annuler-arret-dissolution',
      "Annuler l'arrêt de l'exercice à la dissolution ?\n\nL'exercice reprend sa fin d'origine, et les écritures datées après la dissolution y reviennent.",
      "Arrêt annulé · l'exercice a repris sa fin d'origine.",
      "Annulation de l'arrêt impossible",
    );
  const rattacherALaLiquidation = () =>
    gesteDissolution(
      'rattacher-a-la-liquidation',
      "Faire de cet exercice l'exercice de liquidation ?\n\nIl commencera le lendemain de la dissolution.",
      "L'exercice est devenu l'exercice de liquidation.",
      'Rattachement à la liquidation impossible',
    );
  const reporterFinLiquidation = async (e: FormEvent) => {
    e.preventDefault();
    if (!exercice) return;
    const pour = exercice.id;
    const valable = () => exerciceVise.current === pour;
    const fin = finLiquidation;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await api.post(`/exercices/${pour}/fin-de-liquidation`, { dateFin: fin });
      await rechargerExercices();
      await charger();
      if (valable()) setInfo(`Fin de l'exercice de liquidation portée au ${new Date(fin).toLocaleDateString('fr-FR')}.`);
    } catch (err) {
      if (valable()) setErreur(err instanceof ApiError ? err.message : 'Report de la fin de liquidation impossible');
    } finally {
      setEnvoi(false);
    }
  };
  // L'exercice de liquidation se prépare depuis l'exercice ARRÊTÉ · début au
  // lendemain de la dissolution, case cochée ; la fin reste à saisir.
  const preparerExerciceDeLiquidation = () => {
    if (!planning?.dissolution) return;
    const lendemain = new Date(new Date(planning.dissolution.date).getTime() + 86_400_000);
    setNDebut(lendemain.toISOString().slice(0, 10));
    setNFin('');
    setNLiquidation(true);
    setCreationOuverte(true);
  };

  const cloturerExercice = async () => {
    if (!exercice) return;
    if (
      !confirm(
        `Clôturer définitivement l'exercice ${new Date(exercice.dateDebut).toLocaleDateString('fr-FR')} · ${new Date(
          exercice.dateFin,
        ).toLocaleDateString('fr-FR')} ?\n\nCette action solde les comptes de charges/produits sur le résultat et génère le report à-nouveau réel dans l'exercice suivant.`,
      )
    ) {
      return;
    }
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      const r = await api.post<{ issueOuverture?: string[] }>(
        `/exercices/${exercice.id}/cloturer`,
        choixOuverture ? { ouvertureImportee: choixOuverture, motifConservation: motifConservation.trim() || undefined } : {},
      );
      // AU1 et AU2 · ce que la clôture a fait d'un bilan d'ouverture déjà
      // passé et du lettrage du report provisoire se dit, jamais en silence.
      const issue = r?.issueOuverture ?? [];
      setInfo(["Exercice clôturé · report à-nouveau généré dans l'exercice suivant.", ...issue].join(' '));
      await rechargerExercices();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de clôturer cet exercice");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="p-2">
      <div className="mb-3 flex items-center gap-2 max-w-[640px]">
        <label className="text-[11.5px] font-semibold text-text-dim">
          Exercice
          <select
            value={exerciceId}
            onChange={(e) => setExerciceId(e.target.value)}
            className="mt-1 ml-2 border border-border-dark px-2.5 py-1 text-[11.5px] font-normal"
          >
            {exercices.map((e) => (
              <option key={e.id} value={e.id}>
                {new Date(e.dateDebut).toLocaleDateString('fr-FR')} · {new Date(e.dateFin).toLocaleDateString('fr-FR')} (
                {e.statut === 'OUVERT' ? 'Ouvert' : 'Clôturé'})
              </option>
            ))}
          </select>
        </label>
        {chargementExercices && <span className="text-[11.5px] text-text-dim">Chargement…</span>}
        {/* Audit final F248 · la lecture manquée ne se lit plus « Chargement… »
            pour toujours ni comme un dossier sans exercice. Après une
            relecture manquée, la liste affichée est celle d'avant, et le
            libellé le dit, comme la barre d'état. */}
        {!chargementExercices && erreurExercices && (
          <span className="text-[11.5px] text-danger">
            {exercices.length > 0 ? 'Exercices non relus' : 'Exercices illisibles'} · {erreurExercices}
          </span>
        )}
        <Aide sujet="exerciceClos" />
      </div>

      {estAdmin && (
        <div className="mb-4 border border-border bg-surface max-w-[720px]">
          <div className="flex items-center pr-3 hover:bg-surface-alt">
            <button
              type="button"
              onClick={() => setCreationOuverte((v) => !v)}
              className="flex-1 text-left px-4 py-2 font-mono text-[11.5px] font-semibold text-text-dim"
            >
              {creationOuverte ? '▾' : '▸'} Créer un exercice
            </button>
            <Aide
              titre="Créer un exercice"
              texte="Pour un exercice antérieur (reprise d’un dossier), un exercice qui ne suit pas le dernier, ou l’exercice de liquidation. L’exercice suivant naît aussi de la clôture ou des reports provisoires. L’exercice coïncide avec l’année civile ; le premier peut être plus court ou, commencé au second semestre, plus long ; seule la liquidation échappe à l’année civile. La durée des opérations de liquidation est comptée pour un seul exercice « sous réserve de l’établissement de situations annuelles provisoires » : chaque année de liquidation a la sienne, que la situation intermédiaire des états financiers permet de produire. Pour une société commerciale, dans les cas de l’article 223 de l’AUSCGIE, le liquidateur établit en outre, dans les trois mois de la clôture de chaque exercice, les états financiers annuels et un rapport écrit sur les opérations de la liquidation ; l’assemblée des associés statue dans les six mois, à défaut le rapport est déposé au RCCM. Le planning de clôture ne calcule pas ces échéances."
              source="AUDCIF art. 7 (al. 4 pour la liquidation) · SYCEBNL, Partie 1 ch. 1 (EXERCICE) · AUSCGIE, art. 223, 232 et 233"
            />
          </div>
          {creationOuverte && (
            <form onSubmit={creerExercice} className="px-4 pb-3 flex items-end gap-2 flex-wrap">
              <label className="text-[11.5px] font-semibold text-text-dim">
                Début
                <input
                  type="date"
                  required
                  value={nDebut}
                  onChange={(e) => setNDebut(e.target.value)}
                  className="mt-1 block border border-border-dark px-2 py-1 text-[11.5px]"
                />
              </label>
              <label className="text-[11.5px] font-semibold text-text-dim">
                Fin
                <input
                  type="date"
                  required
                  value={nFin}
                  onChange={(e) => setNFin(e.target.value)}
                  className="mt-1 block border border-border-dark px-2 py-1 text-[11.5px]"
                />
              </label>
              <label className="text-[11.5px] flex items-center gap-1.5">
                <input type="checkbox" checked={nLiquidation} onChange={(e) => setNLiquidation(e.target.checked)} />
                Exercice de liquidation
              </label>
              <button
                type="submit"
                disabled={envoi || !nDebut || !nFin}
                className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                {envoi ? '…' : 'Créer'}
              </button>
            </form>
          )}
        </div>
      )}

      {/*
        DATE D'ARRÊTÉ DES COMPTES · la quatrième mention obligatoire de chaque
        page publiée (AUDCIF Titre IX ch. 1 § 2.4) et la seule que le dossier
        ne portait nulle part. Elle est ici et non dans les paramètres du
        dossier parce qu'elle appartient à L'EXERCICE : chaque exercice a la
        sienne, et un nouvel arrêté peut la remplacer (ch. 31 § 1.6).
      */}
      {exercice && (
        <form onSubmit={arreterComptes} className="mb-4 border border-border bg-surface px-4 py-3 max-w-[720px]">
          <div className="font-mono text-[11.5px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
            Arrêté des comptes
            <Aide
              titre="Arrêté des comptes"
              texte="Date à laquelle les organes dirigeants ont arrêté les comptes. Ce n’est pas la clôture : elle lui est postérieure de plusieurs semaines, dans la limite de quatre mois. Elle doit figurer sur chaque page des états financiers publiés, et le logiciel l’imprime dès qu’elle est renseignée."
              source="AUDCIF Titre IX ch. 1 § 2.4 · Titre VIII ch. 31 § 1.3"
            />
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            {/* La date se consulte par tous, elle ne se pose que par
                l'administrateur (@Roles ADMIN_CABINET sur arrete-comptes). */}
            {estAdmin && (
              <>
                <label className="text-[11.5px] font-semibold text-text-dim">
                  Comptes arrêtés le
                  <input
                    type="date"
                    value={dateArrete}
                    onChange={(e) => setDateArrete(e.target.value)}
                    className="mt-1 block border border-border-dark px-2 py-1 text-[11.5px] font-mono"
                  />
                </label>
                <button type="submit" disabled={envoi} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50">
                  {envoi ? '…' : 'Enregistrer'}
                </button>
              </>
            )}
            {exercice.dateArreteComptes ? (
              <span className="text-[11.5px] text-positive">
                Actuellement : {new Date(exercice.dateArreteComptes).toLocaleDateString('fr-FR')}
              </span>
            ) : (
              <span className="text-[11.5px] text-danger">Non renseignée · les états s’impriment sans elle</span>
            )}
          </div>
        </form>
      )}

      {/* LA DISSOLUTION · l'arrêt de l'exercice qui la contient et la fin de
          l'exercice de liquidation, à l'administrateur (@Roles ADMIN_CABINET
          sur les deux routes). */}
      {exercice && planning?.exerciceId === exercice.id && planning.dissolution && (
        <div className="mb-4 border border-border bg-surface px-4 py-3 max-w-[720px]">
          <div className="font-mono text-[11.5px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
            Dissolution et liquidation
            <Aide
              titre="Dissolution et liquidation"
              texte="La période qui précède la dissolution forme un exercice arrêté à la date de la dissolution : son bilan est le bilan avant liquidation, et une cotisation spéciale se déclare sur ses résultats dans le mois de la dissolution, compté de date à date, et avant que le dirigeant ne quitte le pays. L’arrêt fait passer à l’exercice de liquidation les écritures datées après la dissolution, sans rien changer d’elles (ni date, ni numéro, ni lignes), avec les actes qui en dépendent ; il s’annule tant que rien ne s’y oppose. La liquidation forme ensuite un seul exercice, du lendemain de la dissolution à la clôture de la liquidation, quelle que soit sa durée, avec une situation provisoire à chaque fin d’année civile ; sa fin se reporte tant que la clôture n’est pas connue, et il ne se clôture qu’à la clôture déclarée. Une seconde cotisation spéciale se déclare sur le dernier bilan de liquidation, dans le mois de la clôture : l’impôt de l’année de la dissolution se calcule une fois sur le total des deux résultats, moins la première cotisation et les acomptes. Aucune déclaration annuelle de l’impôt sur les sociétés n’est due pour cette année ni pour les suivantes, et aucun acompte après l’échéance de la dernière cotisation."
              source="Loi n° 23/053, art. 11, 12 et 13 · LPF, art. 16, 57 bis et 110 bis · AUDCIF, art. 7 al. 4, art. 22 et 59, Titre VIII ch. 40 § 2.1 · AUPSRVE, art. 1-14"
            />
          </div>
          <div className="text-[11.5px] mb-2">
            Dissolution déclarée le {new Date(planning.dissolution.date).toLocaleDateString('fr-FR')}
            {planning.dissolution.exerciceDeLiquidation ? ' · exercice de liquidation' : ''}
            {planning.dissolution.dateClotureLiquidation
              ? ` · liquidation clôturée le ${new Date(planning.dissolution.dateClotureLiquidation).toLocaleDateString('fr-FR')}`
              : ''}
          </div>
          {estAdmin && planning.dissolution.arretPropose && (
            <button
              type="button"
              onClick={arreterALaDissolution}
              disabled={envoi}
              className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50"
            >
              {envoi ? '…' : `Arrêter l’exercice au ${new Date(planning.dissolution.date).toLocaleDateString('fr-FR')}`}
            </button>
          )}
          {estAdmin && !planning.dissolution.arretPropose && planning.dissolution.motifArret && (
            <div className="text-[11.5px] text-danger mb-2" role="status">
              {planning.dissolution.motifArret}
            </div>
          )}
          {estAdmin && planning.dissolution.annulationProposee && (
            <button
              type="button"
              onClick={annulerArret}
              disabled={envoi}
              className="border border-border-dark bg-surface text-[11.5px] font-semibold px-3 py-1.5 mr-2 disabled:opacity-50"
            >
              {envoi ? '…' : 'Annuler l’arrêt'}
            </button>
          )}
          {estAdmin && planning.dissolution.rattachementPropose && (
            <button
              type="button"
              onClick={rattacherALaLiquidation}
              disabled={envoi}
              className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 mr-2 disabled:opacity-50"
            >
              {envoi ? '…' : 'Faire de cet exercice l’exercice de liquidation'}
            </button>
          )}
          {estAdmin &&
            exercice.dateFin.slice(0, 10) === planning.dissolution.date.slice(0, 10) &&
            !exercices.some((e) => e.dateDebut.slice(0, 10) > planning.dissolution!.date.slice(0, 10)) && (
              <button
                type="button"
                onClick={preparerExerciceDeLiquidation}
                disabled={envoi}
                className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                Préparer l’exercice de liquidation
              </button>
            )}
          {estAdmin && planning.dissolution.exerciceDeLiquidation && exercice.statut === 'OUVERT' && (
            <form onSubmit={reporterFinLiquidation} className="flex items-end gap-2 flex-wrap">
              <label className="text-[11.5px] font-semibold text-text-dim">
                Fin de l’exercice de liquidation
                <input
                  type="date"
                  required
                  value={finLiquidation}
                  min={exercice.dateDebut.slice(0, 10)}
                  onChange={(e) => setFinLiquidation(e.target.value)}
                  aria-label="Fin de l’exercice de liquidation"
                  className="mt-1 block border border-border-dark px-2 py-1 text-[11.5px] font-mono"
                />
              </label>
              <button
                type="submit"
                disabled={envoi || !finLiquidation || finLiquidation === exercice.dateFin.slice(0, 10)}
                className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                {envoi ? '…' : 'Enregistrer'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Fiche R2 (cases ZN à ZS) · SYSCOHADA seul, Système minimal de
          trésorerie excepté (sa liasse n'en porte pas), la route se refusant au
          serveur ailleurs (décision par la loi du 2026-10-04, point 5). */}
      {exercice &&
        utilisateur?.tenant.referentiel === 'SYSCOHADA' &&
        utilisateur.tenant.systemeComptableSyscohada !== 'MINIMAL_TRESORERIE' && (
          <FicheR2Exercice
            exercice={exercice}
            apresEnregistrement={rechargerExercices}
            quotePartEtatCapital={
              planning?.exerciceId === exercice.id && planning.entreprisePortefeuilleEtat === true
                ? (planning.quotePartEtatCapital ?? null)
                : null
            }
          />
        )}
      {/* Assemblée de l'exercice · toute société commerciale du SYSCOHADA (le
          procès-verbal fiscal en court) ; dépôt et procès-verbal au
          Portefeuille sur la seule réponse « oui ». */}
      {exercice &&
        planning?.exerciceId === exercice.id &&
        utilisateur?.tenant.referentiel === 'SYSCOHADA' &&
        estSocieteCommerciale(planning.formeJuridiqueSyscohada) && (
          <DatesPortefeuilleExercice
            exerciceId={exercice.id}
            portefeuille={planning.entreprisePortefeuilleEtat === true}
            dateAssembleeGenerale={planning.dateAssembleeGenerale ?? null}
            dateDepotEtatsPortefeuille={planning.dateDepotEtatsPortefeuille ?? null}
            dateTransmissionPvPortefeuille={planning.dateTransmissionPvPortefeuille ?? null}
            secteurMinier={planning.portefeuilleSecteurMinier === true}
            dateDeclarationDividendeEtat={planning.dateDeclarationDividendeEtat ?? null}
            dateNotePerceptionDividende={planning.dateNotePerceptionDividende ?? null}
            datePaiementDividendeEtat={planning.datePaiementDividendeEtat ?? null}
            apresEnregistrement={charger}
          />
        )}

      {/*
        LES DEUX SEULES EXCEPTIONS À LA CORRESPONDANCE BILAN DE CLÔTURE /
        BILAN D'OUVERTURE. Repliée par défaut : c'est une opération rare, et
        l'ouvrir d'emblée inviterait à s'en servir comme d'une saisie
        ordinaire, ce qu'elle n'est pas.
      */}
      {estAdmin && exercice && (
        <div className="mb-4 border border-border bg-surface max-w-[720px]">
          <div className="flex items-center pr-3 hover:bg-surface-alt">
            <button
              onClick={() => setImputationOuverte((v) => !v)}
              className="flex-1 flex items-center justify-between px-4 py-2.5 text-left"
            >
              <span className="font-mono text-[11.5px] font-semibold text-text-dim">
                Imputation aux capitaux propres d’ouverture
              </span>
              <span className="text-[11.5px] text-text-dim">{imputationOuverte ? 'Réduire' : 'Déployer'}</span>
            </button>
            <Aide
              titre="Imputation aux capitaux propres d’ouverture"
              texte="Le bilan d’ouverture d’un exercice doit correspondre au bilan de clôture du précédent. Les incidences d’un changement de méthode et les charges ou produits d’exercices antérieurs omis transitent par le compte de résultat, jamais directement par les capitaux propres. Deux exceptions seulement, et elles se justifient en Notes annexes."
              source="AUDCIF art. 34 · SYCEBNL art. 16, 4)"
            />
          </div>
          {imputationOuverte && (
            <form onSubmit={imputerOuverture} className="px-4 pb-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11.5px] font-semibold text-text-dim col-span-2">
                  Motif
                  <select value={iMotif} onChange={(e) => setIMotif(e.target.value as typeof iMotif)} className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px]">
                    <option value="CHANGEMENT_METHODE">Changement de méthode à impact fort significatif</option>
                    <option value="CORRECTION_ERREUR_SIGNIFICATIVE">Correction d’une erreur significative d’un exercice antérieur</option>
                  </select>
                </label>
                <label className="text-[11.5px] font-semibold text-text-dim">
                  Report à nouveau (compte 12)
                  <select required value={iCompteRan} onChange={(e) => setICompteRan(e.target.value)} className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px]">
                    <option value="" />
                    {(comptesReport ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.numero} · {c.intitule}</option>
                    ))}
                  </select>
                  {erreurComptes && <span className="block font-normal text-danger">Plan de comptes illisible · {erreurComptes}</span>}
                  {comptesReport && comptesReport.length === 0 && (
                    <span className="block font-normal text-warning">Aucun compte 12 au plan du dossier · ouvrez-le dans Plan comptable.</span>
                  )}
                </label>
                <label className="text-[11.5px] font-semibold text-text-dim">
                  Contrepartie (poste de bilan)
                  <select required value={iCompteContrepartie} onChange={(e) => setICompteContrepartie(e.target.value)} className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px]">
                    <option value="" />
                    {(comptesBilan ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.numero} · {c.intitule}</option>
                    ))}
                  </select>
                  {comptesBilan && comptesBilan.length === 0 && (
                    <span className="block font-normal text-warning">{motifAucunCompteRetenu(comptesBilan, 'de bilan')}</span>
                  )}
                </label>
                <label className="text-[11.5px] font-semibold text-text-dim col-span-2">
                  Montant · positif pour DÉBITER le report à nouveau, négatif pour le créditer
                  <input required type="number" step="0.01" value={iMontant} onChange={(e) => setIMontant(e.target.value)} className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px] font-mono" />
                </label>
                <label className="text-[11.5px] font-semibold text-text-dim col-span-2">
                  Justification · reprise en Notes annexes
                  <textarea
                    required
                    rows={3}
                    maxLength={2000}
                    value={iJustification}
                    onChange={(e) => setIJustification(e.target.value)}
                    placeholder="Nature du changement ou de l’erreur, exercice concerné, méthode de détermination de l’impact…"
                    className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px] leading-[1.5]"
                  />
                </label>
              </div>
              <button type="submit" disabled={envoi} className="mt-3 bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50">
                {envoi ? '…' : 'Enregistrer l’imputation'}
              </button>
            </form>
          )}
        </div>
      )}

      {erreur && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mb-3 max-w-[720px]">{erreur}</div>}
      {info && <div className="text-[11.5px] text-positive bg-positive-soft border border-positive/30 px-2.5 py-1.5 mb-3 max-w-[720px]">{info}</div>}

      {/*
        PLANNING DE CLÔTURE · l'état prévisionnel des travaux de fin
        d'exercice, décrit par le CPCC (« Notes de cours d'organisation
        comptable », § 2.3 et § 7.1) : « un état prévisionnel des différents
        travaux à exécuter préalablement à la publication, sous la forme
        légale ou normalisée, des états financiers ». La fenêtre savait
        clôturer, elle ne savait pas préparer la clôture.
        Les échéances légales sont indicatives et sourcées jalon par jalon ·
        voir docs/organisation-comptable-cpcc.md § 6 pour les réserves.
      */}
      {planning && (
        <div className="mb-5 border border-border max-w-[1100px] bg-surface">
          <button
            onClick={() => setPlanningOuvert((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface-alt"
          >
            <span className="font-mono text-[11.5px] font-semibold text-text-dim">
              PLANNING DE CLÔTURE · {planning.jalons.filter((j) => j.enRetard).length} jalon(s) en retard ·{' '}
              {planning.jalons.filter(estNonCalcule).length} non calculé(s)
              {planning.jalons.some(montantNonCalcule) && ` · ${planning.jalons.filter(montantNonCalcule).length} montant(s) non calculé(s)`}
            </span>
            <span className="text-[11.5px] text-text-dim">{planningOuvert ? 'Réduire' : 'Déployer'}</span>
          </button>

          {planningOuvert && (
            <div className="border-t border-border">
              <table className="w-full text-[11.5px] border-collapse">
                <thead>
                  <tr className="bg-chrome-alt text-[11px] font-mono text-text-dim">
                    <th className="text-left px-3 py-1.5 font-semibold w-8">#</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Travaux</th>
                    <th className="text-left px-3 py-1.5 font-semibold w-24">Échéance</th>
                    <th className="text-left px-3 py-1.5 font-semibold w-20">Nature</th>
                    <th className="text-left px-3 py-1.5 font-semibold w-64">État</th>
                  </tr>
                </thead>
                <tbody>
                  {planning.jalons.map((j) => (
                    <tr key={`${j.etape}-${j.libelle}-${j.debut ?? ''}`} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-mono text-text-dim">{j.etape}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold flex items-center gap-1.5">
                          {j.libelle}
                          <Aide titre={j.libelle} texte={j.detail} source={j.source} />
                        </div>
                        {/* La sanction est affichée SOUS le détail et non dans la
                            colonne « Nature » · l'étiquette LÉGAL y qualifie une
                            échéance opposable à un tiers, alors qu'ici c'est
                            l'omission qui est punie, quelle qu'ait été la date. */}
                        {j.sanction && (
                          <div className="text-[11px] text-danger mt-1 leading-[1.5]">{j.sanction}</div>
                        )}
                        {libelleMontant(j) !== null && (
                          <div className={`text-[11px] mt-1 ${montantNonCalcule(j) ? 'text-danger' : ''}`}>{libelleMontant(j)}</div>
                        )}
                      </td>
                      <td className={`px-3 py-2 font-mono ${j.enRetard ? 'text-danger font-bold' : ''}`}>
                        {/* Non calculée (une date déclarée manque), aucun délai au
                            texte, ou levée · trois sens d'une échéance nulle,
                            jamais confondus (`lib/jalons-planning.ts`). */}
                        {j.echeance === null ? (
                          <span className={estNonCalcule(j) ? 'text-danger' : 'text-text-dim'}>{libelleEcheance(j)}</span>
                        ) : (
                          libelleEcheance(j)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 ${
                            j.nature === 'LEGALE' ? 'bg-danger-soft text-danger' : 'bg-surface-alt text-text-dim'
                          }`}
                        >
                          {j.nature === 'LEGALE' ? 'LÉGAL' : 'INTERNE'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11.5px]">
                        {j.observation ? (
                          // Ambre · le fait lève le jalon, mais après son échéance.
                          <span className={classeObservation(j.observation)}>
                            {j.observation.satisfait ? '✓ ' : '! '}
                            {j.observation.libelle}
                          </span>
                        ) : (
                          <span className="text-text-dim">Suivi manuel</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-1.5 text-[11px] text-text-dim border-t border-border flex items-center gap-1.5">
                Jalons indicatifs · dernière vérification de la table : {planning.derniereVerification}
                <Aide
                  titre="Planning de clôture"
                  texte="Les dates se calculent à partir de la date de clôture de cet exercice. Chaque jalon porte sa source : ceux qui citent un acte uniforme, une loi ou un article ont été lus sur texte primaire ; ceux qui citent les notes de cours d’organisation comptable du CPCC (novembre 2020) en viennent, et n’ont pas été revérifiés sur texte primaire. Ce sont des jalons indicatifs, pas un calcul d’obligation. Aucune astreinte n’est chiffrée ici."
                  source="CPCC, notes de cours d’organisation comptable, § 2.3 et § 7.1"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {estAdmin && exercice && exercice.statut === 'OUVERT' && (
        <div className="mb-3 border border-border max-w-[720px] p-4 bg-surface">
          <div className="font-mono text-[11.5px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
            Nouvel exercice
            <Aide
              titre="Nouvel exercice avec reports provisoires"
              texte="Ouvre l'exercice suivant s'il n'existe pas et y passe le report à-nouveau calculé sur le livre-journal de celui-ci, comme le fera la clôture, résultat compris. Le report reste au brouillard, ne se valide pas, et se relance à volonté : chaque relance le remplace. La clôture le remplace par le report définitif. Une relance est refusée si une ligne du report a été lettrée ou pointée entre-temps. Les budgets des sections peuvent être reportés, sans écraser un budget déjà saisi ni doter une convention terminée."
              source="Sage 100 i7, Traitement / Fin d'exercice / Nouvel exercice · AUDCIF art. 22, 2°"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={genererProvisoires}
              disabled={envoi}
              className="bg-sel text-white text-[11.5px] font-semibold px-4 py-1.5 disabled:opacity-50"
            >
              {envoi ? '…' : 'Générer les à-nouveaux provisoires'}
            </button>
            <label className="flex items-center gap-1.5 text-[11.5px]">
              <input type="checkbox" checked={reporterBudgetsAussi} onChange={(e) => setReporterBudgetsAussi(e.target.checked)} />
              Reporter aussi les budgets
            </label>
          </div>
        </div>
      )}

      {exercice && (
        <div className="mb-5 border border-border max-w-[720px] p-4 bg-surface">
          <div className="font-mono text-[11.5px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
            Clôture annuelle
            <Aide
              titre="Clôture annuelle"
              texte="Solde les comptes de charges/produits (mode « Aucun ») sur le résultat de l'exercice, puis génère le report à-nouveau réel dans l'exercice suivant selon le mode de chaque compte (Solde/Détail). Action définitive."
              source="Clôture d'exercice"
            />
          </div>
          {exercice.statut === 'CLOTURE' ? (
            <span className="font-mono text-[11px] font-bold px-2 py-1 bg-surface-alt text-text-dim w-fit inline-block">
              Exercice déjà clôturé
            </span>
          ) : estAdmin ? (
            <>
            {erreurOuverture && <div className="text-[11.5px] text-danger mb-2">{erreurOuverture}</div>}
            {ouverture?.pieces && ouverture.auBrouillard && (
              <div className="text-[11.5px] text-danger mb-2">
                L'exercice suivant porte un bilan d'ouverture au brouillard ({ouverture.pieces}) · validez-le avant de clôturer.
              </div>
            )}
            {ouverture && issueSansDeclaration(ouverture) && (
              <div className="text-[11.5px] text-text-dim mb-2">{issueSansDeclaration(ouverture)}</div>
            )}
            {lettragesAReconduire(ouverture?.lettragesPartielsAReconduire) && (
              <div className="text-[11.5px] text-text-dim mb-2">{lettragesAReconduire(ouverture?.lettragesPartielsAReconduire)}</div>
            )}
            {/* R10 · l'aperçu illisible n'empêche pas de déclarer · le serveur rejoue la confrontation et refuse ce qui ne convient pas. */}
            {(erreurOuverture || (ouverture?.declarationRequise && !ouverture.auBrouillard)) && (
              <div className="mb-3 border border-border p-2.5">
                <div className="text-[11.5px] font-semibold mb-1.5 flex items-center gap-1.5">
                  {titreDeclaration(ouverture)}
                  <Aide
                    titre="Bilan d'ouverture importé"
                    texte="Le bilan d'ouverture d'un exercice doit correspondre au bilan de clôture du précédent. Rectifier · les livres de cet exercice sont tenus dans OmegaX, l'import est inscrit en négatif sur les comptes qui diffèrent puis le report exact est passé. Conserver · cet exercice n'est tenu ici que pour les comparatifs, l'import fait foi et rien n'est passé ; le motif reste au journal d'audit."
                    source="AUDCIF art. 34 et 20 · SYCEBNL art. 16, 4)"
                  />
                </div>
                {ouverture && (
                  <>
                    {ouverture.tronque && (
                      <div className="text-[11.5px] text-text-dim mb-1">
                        {ouverture.total} positions divergentes · {ouverture.ecarts.length} affichées.
                      </div>
                    )}
                    <table className="w-full text-[11.5px] mb-2">
                      <thead>
                        <tr>
                          <th className="text-left">Compte</th>
                          <th className="text-left">Devise</th>
                          <th className="text-right">Clôture</th>
                          <th className="text-right">Ouverture</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ouverture.ecarts.map((e) => (
                          <tr key={`${e.compteId}|${e.devise ?? ''}`}>
                            <td>
                              {e.numero ?? '?'} {e.intitule ?? ''}
                            </td>
                            <td>{e.devise ?? ''}</td>
                            <td className="text-right">
                              {montant(e.cloture)}
                              {e.devise ? ` (${montant(e.clotureDevise)} ${e.devise})` : ''}
                            </td>
                            <td className="text-right">
                              {montant(e.ouverture)}
                              {e.devise ? ` (${montant(e.ouvertureDevise)} ${e.devise})` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ouverture.lignesTenues.length > 0 && (
                      <div className="text-[11.5px] text-text-dim mb-2">
                        Rectifier inscrira en négatif des lignes lettrées ou pointées, qui le resteront ·{' '}
                        {ouverture.lignesTenues
                          .slice(0, 5)
                          .map((t) => `${t.numero} ${t.piece} ${montant(t.debit - t.credit)}${t.lettree ? ' lettrée' : ''}${t.pointee ? ' pointée' : ''}`)
                          .join(', ')}
                        {ouverture.lignesTenues.length > 5 ? ` et ${ouverture.lignesTenues.length - 5} autre(s)` : ''}.
                      </div>
                    )}
                  </>
                )}
                <div className="flex flex-col gap-1 text-[11.5px]">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="choixOuverture" checked={choixOuverture === 'RECTIFIER'} onChange={() => setChoixOuverture('RECTIFIER')} />
                    {libellesChoix(ouverture).rectifier}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="choixOuverture" checked={choixOuverture === 'CONSERVER'} onChange={() => setChoixOuverture('CONSERVER')} />
                    {libellesChoix(ouverture).conserver}
                  </label>
                  {choixOuverture === 'CONSERVER' && (
                    <label className="flex flex-col gap-1">
                      Motif
                      <textarea
                        value={motifConservation}
                        onChange={(e) => setMotifConservation(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className="border border-border-dark px-2 py-1"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={cloturerExercice}
              disabled={envoi}
              className="bg-danger text-white text-[11.5px] font-semibold px-4 py-1.5 disabled:opacity-50 flex items-center gap-1.5"
            >
              <IconLock width={14} height={14} />
              {envoi ? 'Clôture…' : "Clôturer l'exercice"}
            </button>
            </>
          ) : (
            <span className="text-[11.5px] text-text-dim">Réservé aux administrateurs du dossier.</span>
          )}
        </div>
      )}

      {estAdmin && exercice && exercice.statut === 'OUVERT' && (
        <div className="grid grid-cols-3 gap-3 mb-5 max-w-[980px]">
          <form onSubmit={clorePartielle} className="bg-surface border border-border p-3">
            <div className="font-mono text-[11px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
              Clôture partielle
              <Aide titre="Clôture partielle" texte="Verrouille la saisie d'un journal jusqu'à une date · réversible. Le lettrage et la ventilation analytique de ses lignes restent possibles." source="Sage 100 i7, clôture des journaux" />
            </div>
            <label className="block text-[11.5px] font-semibold text-text-dim mb-2">
              Journal
              <select
                required
                value={journalPartielleId}
                onChange={(e) => setJournalPartielleId(e.target.value)}
                className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px] font-normal"
              >
                <option value="">Sélectionner</option>
                {journaux.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11.5px] font-semibold text-text-dim mb-2">
              Date limite
              <input
                required
                type="date"
                value={dateLimitePartielle}
                onChange={(e) => setDateLimitePartielle(e.target.value)}
                className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px] font-normal"
              />
            </label>
            <button type="submit" disabled={envoi} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50">
              Clôturer
            </button>
          </form>

          <form onSubmit={cloreTotale} className="bg-surface border border-border p-3">
            <div className="font-mono text-[11px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
              Clôture totale
              <Aide titre="Clôture totale" texte="Fige un journal jusqu'à une date (la fin de l'exercice si la date est laissée vide) · définitive. Ni saisie, ni lettrage, ni ventilation analytique sur ses lignes jusqu'à cette date." source="Sage 100 i7, clôture des journaux" />
            </div>
            <label className="block text-[11.5px] font-semibold text-text-dim mb-2">
              Journal
              <select
                required
                value={journalTotaleId}
                onChange={(e) => setJournalTotaleId(e.target.value)}
                className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px] font-normal"
              >
                <option value="">Sélectionner</option>
                {journaux.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11.5px] font-semibold text-text-dim mb-2">
              Jusqu'au
              <input
                type="date"
                value={dateLimiteTotale}
                onChange={(e) => setDateLimiteTotale(e.target.value)}
                className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px] font-normal"
              />
            </label>
            <button type="submit" disabled={envoi} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50">
              Clôturer
            </button>
          </form>

          <form onSubmit={clorePeriode} className="bg-surface border border-border p-3">
            <div className="font-mono text-[11px] font-semibold text-text-dim mb-2 flex items-center gap-1.5">
              Clôture de période
              <Aide titre="Clôture de période" texte="Fige tous les journaux jusqu'à une date · définitive. Ni saisie, ni lettrage, ni ventilation analytique, ni OD analytique sur la période." source="Sage 100 i7, clôture des journaux" />
            </div>
            <label className="block text-[11.5px] font-semibold text-text-dim mb-2">
              Date limite
              <input
                required
                type="date"
                value={dateLimitePeriode}
                min={exercice?.dateDebut.slice(0, 10)}
                max={exercice?.dateFin.slice(0, 10)}
                onChange={(e) => setDateLimitePeriode(e.target.value)}
                className="mt-1 w-full border border-border-dark px-2 py-1 text-[11.5px] font-normal"
              />
            </label>
            <button type="submit" disabled={envoi} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1.5 disabled:opacity-50 mt-[38px]">
              Clôturer
            </button>
          </form>
        </div>
      )}

      <div
        // `overflow-x-auto` ici, `min-w` sur les lignes · les 558 px de colonnes
        // incompressibles du tableau ne tiennent pas dans les ~326 px utiles d'une
        // fenêtre à 360 px, et sans conteneur le débordement remontait à la fenêtre,
        // qui emportait alors titre, onglets et boutons hors de l'écran.
        className="border border-border bg-surface shadow-posee max-w-[980px] overflow-x-auto"
      >
        <div className="grid grid-cols-[90px_1fr_100px_110px_90px_100px] min-w-[710px] gap-2 px-3.5 py-1.5 bg-chrome border-b border-border text-[11px] font-bold text-text-dim">
          <span>Granularité</span>
          <span>Journal</span>
          <span>Date limite</span>
          <span>Créée le</span>
          <span>STATUT</span>
          <span>ACTION</span>
        </div>
        {!clotures && <div className="p-3 text-[11.5px] text-text-dim">Chargement…</div>}
        {clotures?.length === 0 && <div className="p-3 text-[11.5px] text-text-dim">Aucune clôture enregistrée sur cet exercice.</div>}
        {clotures?.map((c, i) => (
          <div
            key={c.id}
            className={`grid grid-cols-[90px_1fr_100px_110px_90px_100px] min-w-[710px] gap-2 items-center px-3.5 py-1.5 border-b border-border last:border-b-0 text-[11.5px] ${
              i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt'
            }`}
          >
            <span className="font-semibold">{LIBELLE_GRANULARITE[c.granularite]}</span>
            <span className="font-mono text-text-dim truncate">
              {c.journal ? `${c.journal.code} · ${c.journal.intitule}` : 'Tous journaux'}
            </span>
            <span className="font-mono text-[11px] text-text-dim">{new Date(c.dateLimite).toLocaleDateString('fr-FR')}</span>
            <span className="font-mono text-[11px] text-text-dim">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
            <span>
              {c.annuleeAt ? (
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-surface-alt text-text-dim">Annulée</span>
              ) : (
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-warning-soft text-warning flex items-center gap-1 w-fit">
                  <IconLock width={10} height={10} /> ACTIVE
                </span>
              )}
            </span>
            <span>
              {estAdmin && c.annulable && !c.annuleeAt && (
                <button onClick={() => annuler(c)} className="text-[11px] font-semibold text-sel hover:underline">
                  Annuler
                </button>
              )}
              {c.annuleeAt && <IconCheck width={12} height={12} className="text-text-dim" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
