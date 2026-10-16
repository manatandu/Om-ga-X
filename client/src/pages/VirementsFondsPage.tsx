import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { useGardeFermeture } from '../lib/fenetres';
import { ecouterEchap } from '../lib/echap';
import { montant as fmt } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';
import { Aide } from '../components/chrome/Aide';
import { PortailModale } from '../components/PortailModale';
import {
  LIBELLES_NATURE_PIECE,
  LIBELLES_OPERATION,
  NATURES_PIECE,
  caisseEnJeu,
  sensDuVirement,
  type NaturePieceVirement,
  type OperationVirementFonds,
} from '../lib/virement-fonds';

/**
 * VIREMENT DE FONDS · Traitement > Tiers et trésorerie (demande de Manasse du
 * 2026-10-09). D'une banque ou d'une caisse vers une autre, chaque côté dans
 * son journal · deux pièces passées par le 585 « Virements de fonds » (le 581
 * est la régie d'avance, AUDCIF Titre VII, compte 58), au sous-compte du sens.
 * DEUX OPÉRATIONS, DEUX PIÈCES (demande du 2026-10-16) · la sortie des fonds et
 * leur entrée ont chacune leur pièce justificative, qui date leur écriture
 * (AUDCIF art. 16, al. 2). Le sens et le compte de passage ne s'affichent plus
 * (« T'es pas obligé de le mentionner ») · ils restent au journal et au plan
 * comptable. Règles au serveur (src/modules/virements-fonds/), l'écran ne les
 * refait pas · il propose, le serveur juge.
 */

interface JournalServi {
  id: string;
  code: string;
  intitule: string;
  caisse: boolean;
  compteTresorerie: { id: string; numero: string; intitule: string } | null;
}

interface PieceJointe {
  id: string;
  // null · jointe avant que la pièce de l'entrée ne se distingue de celle de la sortie.
  operation: OperationVirementFonds | null;
  nomFichier: string;
  taille: number;
}

interface VirementServi {
  id: string;
  date: string;
  montant: number;
  naturePiece: NaturePieceVirement;
  referencePiece: string;
  datePiece: string;
  naturePieceEntree: NaturePieceVirement;
  referencePieceEntree: string;
  datePieceEntree: string;
  objet: string;
  porteur: string | null;
  observations: string | null;
  piecesPassees: string | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  journalOrigine: { code: string };
  journalDestination: { code: string };
  pieces: PieceJointe[];
}

interface Liste {
  journaux: JournalServi[];
  virements: VirementServi[];
  total: number;
  tronque: boolean;
}

/** Ce que l'écran tient pour la pièce d'une opération · aucune nature par défaut. */
interface PieceSaisie {
  nature: NaturePieceVirement | '';
  reference: string;
  date: string;
}

const PIECE_VIDE: PieceSaisie = { nature: '', reference: '', date: '' };

/** Un scan choisi au passage d'un virement, que le serveur n'a pas joint. */
interface ScanManquant {
  virementId: string;
  operation: OperationVirementFonds;
  reference: string;
  jour: string;
  motif: string;
}
const OPERATIONS: readonly OperationVirementFonds[] = ['SORTIE', 'ENTREE'];
const TAILLE_MAX = 5 * 1024 * 1024;
const FORMATS = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx,.doc,.xls';

/**
 * Ce que l'écran juge d'un scan AVANT le virement · vide, trop lourd, ou d'une
 * extension hors de la liste (choix « Tous les fichiers »). La signature lue
 * dans les octets reste jugée par le serveur.
 */
function motifRefusScan(fichier: File): string | null {
  if (fichier.size === 0) return 'Le fichier est vide.';
  if (fichier.size > TAILLE_MAX) return 'Le fichier dépasse 5 Mo · réduisez-le ou numérisez-le en plus basse définition.';
  const point = fichier.name.lastIndexOf('.');
  const extension = point >= 0 ? fichier.name.slice(point).toLowerCase() : '';
  if (!FORMATS.split(',').includes(extension)) return 'Format non admis · PDF, PNG, JPEG, Word ou Excel.';
  return null;
}
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
// « de la sortie des fonds », « de l'entrée des fonds ».
const deLa = (o: OperationVirementFonds) => (o === 'SORTIE' ? 'de la ' : 'de l’') + LIBELLES_OPERATION[o];
const aLa = (o: OperationVirementFonds) => (o === 'SORTIE' ? 'à la ' : 'à l’') + LIBELLES_OPERATION[o];
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function VirementsFondsPage() {
  const { peutEcrire, peutValider } = useAuth();
  const { exerciceCourant } = useExercice();
  // null tant que la liste n'est pas lue · « aucun virement » ne se dit que sur une liste lue.
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Le virement est passé, mais quelque chose n'a pas suivi (un scan) · dit à
  // part du succès, jamais noyé dans le bandeau vert. Gardé par scan manquant
  // (second tour de l'écran, 3) · une phrase figée restait affichée à côté du
  // « Scan joint » de la reprise, et ne nommait pas le virement.
  const [scansManquants, setScansManquants] = useState<ScanManquant[]>([]);
  // Une issue que l'écran ne connaît pas (réponse perdue) · dite à part.
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // UN REFUS SE MONTRE (second tour de l'écran, 6) · sous `noValidate`, il ne
  // vivait que dans le bandeau du haut, hors de vue d'une fenêtre défilée.
  const bandeauErreur = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (erreur) bandeauErreur.current?.focus({ preventScroll: false });
  }, [erreur]);
  const [envoiJoindre, setEnvoiJoindre] = useState<string | null>(null);
  const [aAnnuler, setAAnnuler] = useState<VirementServi | null>(null);

  const [origineId, setOrigineId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [somme, setSomme] = useState('');
  const [pieces, setPieces] = useState<Record<OperationVirementFonds, PieceSaisie>>({ SORTIE: PIECE_VIDE, ENTREE: PIECE_VIDE });
  const [objet, setObjet] = useState('');
  const [porteur, setPorteur] = useState('');
  const [observations, setObservations] = useState('');
  // LE SCAN CHOISI SE GARDE DANS L'ÉTAT (relecture de l'écran, majeur) · un
  // champ de fichier n'est pas piloté par React, et le formulaire démonté au
  // changement d'exercice le vidait en silence, le reste de la saisie gardé ·
  // le virement passait sans son scan, sans un mot.
  const [scansChoisis, setScansChoisis] = useState<Record<OperationVirementFonds, File | null>>({ SORTIE: null, ENTREE: null });
  const champScanSortie = useRef<HTMLInputElement>(null);
  const champScanEntree = useRef<HTMLInputElement>(null);
  const champScan: Record<OperationVirementFonds, typeof champScanSortie> = { SORTIE: champScanSortie, ENTREE: champScanEntree };
  const champJoindre = useRef<HTMLInputElement>(null);
  // La cible de « Joindre » dans une ref · lue au choix du fichier, vidée si la
  // boîte de sélection est annulée.
  const joindreA = useRef<{ id: string; operation: OperationVirementFonds } | null>(null);
  useEffect(() => {
    const champ = champJoindre.current;
    if (!champ) return;
    const annuler = () => {
      joindreA.current = null;
    };
    champ.addEventListener('cancel', annuler);
    return () => champ.removeEventListener('cancel', annuler);
    // Le champ est toujours monté · un seul branchement.
  }, []);

  const modifierPiece = (o: OperationVirementFonds, champ: Partial<PieceSaisie>) => setPieces((p) => ({ ...p, [o]: { ...p[o], ...champ } }));

  // Une réponse d'un exercice quitté est jetée · elle afficherait les virements
  // d'un autre exercice sous le sélecteur de celui-ci. Le jeton seul ne suffit
  // pas · un `charger` capturé avant le changement (après un envoi) relisait
  // l'ancien exercice avec le jeton le plus récent ; la réponse n'est donc
  // appliquée que si elle vise encore l'exercice affiché.
  const exerciceId = exerciceCourant?.id ?? null;
  const exerciceAffiche = useRef(exerciceId);
  exerciceAffiche.current = exerciceId;
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    const n = ++jeton.current;
    if (!exerciceId) return;
    try {
      const l = await api.get<Liste>(`/virements-fonds?exerciceId=${exerciceId}`);
      if (n === jeton.current && exerciceId === exerciceAffiche.current) {
        setListe(l);
        setErreur(null);
      }
    } catch (err) {
      if (n === jeton.current && exerciceId === exerciceAffiche.current) setErreur(err instanceof ApiError ? err.message : 'Virements illisibles');
    }
  }, [exerciceId]);

  // Sur l'IDENTIFIANT seul · l'objet de l'exercice est recalculé à chaque
  // relecture du contexte, et le formulaire, démonté, perdait le scan choisi.
  useEffect(() => {
    setListe(null);
    setErreur(null);
    setInfo(null);
    setAvertissement(null);
    setScansManquants([]);
    void charger();
  }, [charger]);

  const journaux = liste?.journaux ?? [];
  const origine = journaux.find((j) => j.id === origineId) ?? null;
  const destination = journaux.find((j) => j.id === destinationId) ?? null;
  const sens = origine?.compteTresorerie && destination?.compteTresorerie ? sensDuVirement(origine.compteTresorerie.numero, destination.compteTresorerie.numero) : null;
  const porteurExige = sens !== null && caisseEnJeu(sens);
  const valeur = montantSaisi(somme);
  const exerciceClos = exerciceCourant?.statut === 'CLOTURE';
  const debutExercice = exerciceCourant?.dateDebut.slice(0, 10);
  const finExercice = exerciceCourant?.dateFin.slice(0, 10);
  // CE QUI MANQUE, dit · un bouton grisé ne disait pas quoi corriger.
  const manque = (): string | null => {
    if (!origine) return 'Choisissez la banque ou la caisse d’origine.';
    if (!destination) return 'Choisissez la banque ou la caisse de destination.';
    if (valeur === null || valeur <= 0) return 'Le montant doit être un nombre positif.';
    if (Math.round(valeur * 100) / 100 !== valeur) return 'Le montant se saisit au centime près.';
    if (objet.trim().length < 3) return 'L’objet est exigé · trois caractères au moins.';
    for (const o of OPERATIONS) {
      const p = pieces[o];
      if (!p.nature) return `Choisissez la nature de la pièce ${deLa(o)}.`;
      if (!p.reference.trim()) return `La référence de la pièce ${deLa(o)} est exigée.`;
      if (!p.date) return `La date de la pièce ${deLa(o)} est exigée.`;
      if ((debutExercice && p.date < debutExercice) || (finExercice && p.date > finExercice)) {
        // La voie de rechange ne vaut que pour une entrée sur l'exercice suivant, comme au serveur.
        const suite = o === 'ENTREE' && finExercice && p.date > finExercice ? ' Une entrée qui tombe sur l’exercice suivant se passe à la main.' : '';
        return `La date ${deLa(o)} tombe hors de l’exercice.${suite}`;
      }
    }
    // Le jour s'écrit AAAA-MM-JJ · l'ordre des chaînes est celui des dates.
    if (pieces.ENTREE.date < pieces.SORTIE.date) return 'L’entrée des fonds est datée avant leur sortie.';
    if (porteurExige && !porteur.trim()) return 'Une caisse est en jeu · nommez le porteur des espèces.';
    return null;
  };
  // TOUT CE QUI SE SAISIT COMPTE · une saisie commencée par une nature, une
  // date ou un scan se perdait à la fermeture sans être demandée. Les deux
  // journaux restent choisis après un virement passé, pour le suivant · seuls,
  // ils ne sont pas une saisie (second tour de l'écran, majeur) · la garde
  // disait « pas passé » sous le bandeau du virement passé, et poussait à le
  // repasser. Pendant l'envoi, l'issue n'est pas encore connue · dite telle.
  const formulaireEntame =
    !!(somme || objet || porteur || observations) ||
    OPERATIONS.some((o) => !!(pieces[o].nature || pieces[o].reference || pieces[o].date || scansChoisis[o]));
  useGardeFermeture(
    envoi
      ? 'Le virement est en cours d’envoi · fermer maintenant laisserait son issue inconnue.'
      : formulaireEntame
        ? 'Un virement est en cours de saisie et n’est pas passé.'
        : null,
  );

  const joindre = async (virementId: string, operation: OperationVirementFonds, fichier: File) => {
    // Refus immédiat · le serveur refuse de toute façon (signature lue chez lui).
    const motif = motifRefusScan(fichier);
    if (motif) throw new ApiError(400, motif);
    const corps = new FormData();
    corps.append('fichier', fichier);
    await api.envoyerFichier(`/virements-fonds/${virementId}/pieces?operation=${operation}`, corps);
  };

  const passer = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciceCourant) return;
    const motif = manque();
    if (motif || valeur === null) {
      setErreur(motif ?? 'Le montant doit être un nombre positif.');
      return;
    }
    // LES SCANS SE JUGENT AVANT LE VIREMENT · refusés après, ils laissaient un
    // virement passé sans sa pièce.
    const scans = OPERATIONS.map((o) => ({ o, fichier: scansChoisis[o] })).filter(
      (s): s is { o: OperationVirementFonds; fichier: File } => !!s.fichier,
    );
    // Vide, trop lourd ou d'un format hors liste · refusé après, il laissait
    // le virement passé sans sa pièce (second tour de l'écran, 4).
    for (const s of scans) {
      const refus = motifRefusScan(s.fichier);
      if (refus) {
        setErreur(`Le scan ${deLa(s.o)} · ${refus.replace(/\.$/, '')}. Rien n’est passé.`);
        return;
      }
    }
    const pieceDe = (o: OperationVirementFonds) => ({ nature: pieces[o].nature, reference: pieces[o].reference.trim(), date: pieces[o].date });
    setErreur(null);
    setInfo(null);
    setAvertissement(null);
    setEnvoi(true);
    // Passé au serveur ? Lu dans le `catch` · une réponse perdue APRÈS le
    // virement n'est pas un virement refusé.
    let passe = false;
    try {
      const v = await api.post<VirementServi>('/virements-fonds', {
        exerciceId: exerciceCourant.id,
        journalOrigineId: origineId,
        journalDestinationId: destinationId,
        montant: valeur,
        sortie: pieceDe('SORTIE'),
        entree: pieceDe('ENTREE'),
        objet: objet.trim(),
        ...(porteur.trim() ? { porteur: porteur.trim() } : {}),
        ...(observations.trim() ? { observations: observations.trim() } : {}),
      });
      passe = true;
      let message = `Virement passé · ${v.piecesPassees ?? 'deux pièces'}.`;
      const manques: ScanManquant[] = [];
      for (const s of scans) {
        try {
          await joindre(v.id, s.o, s.fichier);
          message += ` Scan joint ${aLa(s.o)}.`;
        } catch (err) {
          manques.push({
            virementId: v.id,
            operation: s.o,
            reference: pieces[s.o].reference.trim(),
            jour: pieces[s.o].date,
            motif: err instanceof ApiError ? err.message.replace(/\.$/, '') : 'envoi impossible',
          });
        }
      }
      // Le virement EST passé · le dire, et dire ce qui manque, à part.
      setScansManquants(manques);
      setInfo(message);
      setSomme('');
      setPieces({ SORTIE: PIECE_VIDE, ENTREE: PIECE_VIDE });
      setObjet('');
      setPorteur('');
      setObservations('');
      setScansChoisis({ SORTIE: null, ENTREE: null });
      for (const o of OPERATIONS) if (champScan[o].current) champScan[o].current!.value = '';
      await charger();
    } catch (err) {
      if (passe) {
        // Le virement est passé, la suite a manqué · jamais « non passé ».
        setErreur(err instanceof ApiError ? err.message : 'Liste des virements illisible');
      } else if (err instanceof ApiError && err.status < 500) {
        setErreur(err.message);
      } else {
        // RÉPONSE PERDUE OU RELAIS EN PANNE (second tour, échecs silencieux 5
        // et écran 2) · le serveur a pu passer le virement avant que la
        // réponse ne se perde. « Non passé » faisait repasser un doublon ;
        // la liste est relue, et l'issue dite inconnue.
        setAvertissement('Réponse perdue · le virement a pu passer. Relisez la liste ci-dessous avant de le repasser.');
        void charger();
      }
    } finally {
      setEnvoi(false);
    }
  };

  const joindreDepuisLaListe = async (fichier: File | undefined) => {
    const cible = joindreA.current;
    joindreA.current = null;
    if (!fichier || !cible) return;
    // L'avertissement reste · il peut rappeler l'autre scan non joint.
    setErreur(null);
    setInfo(null);
    setEnvoiJoindre(`${cible.id}:${cible.operation}`);
    try {
      await joindre(cible.id, cible.operation, fichier);
      setInfo(`Scan joint ${aLa(cible.operation)}.`);
      // Le manque qu'il comble se retire ; l'autre, s'il y en a un, reste dit.
      setScansManquants((m) => m.filter((x) => !(x.virementId === cible.id && x.operation === cible.operation)));
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Pièce non jointe');
    } finally {
      setEnvoiJoindre(null);
      if (champJoindre.current) champJoindre.current.value = '';
    }
  };

  const telecharger = async (p: { id: string; nomFichier: string }) => {
    setErreur(null);
    try {
      await api.telecharger(`/pieces-virement-fonds/${p.id}/fichier`, p.nomFichier);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Téléchargement impossible');
    }
  };

  const listeOptions = (exclu: string) =>
    journaux
      .filter((j) => j.id !== exclu)
      .map((j) => (
        <option key={j.id} value={j.id}>
          {j.code} · {j.intitule}
          {j.compteTresorerie ? ` (${j.compteTresorerie.numero})` : ''}
        </option>
      ));

  // Le bloc d'une opération · son journal, sa pièce, sa date, son scan.
  const blocOperation = (o: OperationVirementFonds) => {
    const p = pieces[o];
    const sortie = o === 'SORTIE';
    const titre = majuscule(LIBELLES_OPERATION[o]);
    return (
      <fieldset className="border border-border p-2 flex flex-wrap items-end gap-3 min-w-0">
        <legend className="px-1 font-semibold">{titre}</legend>
        <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
          <span className="text-text-dim">{sortie ? 'De (banque ou caisse)' : 'Vers (banque ou caisse)'}</span>
          <select
            value={sortie ? origineId : destinationId}
            onChange={(e) => (sortie ? setOrigineId : setDestinationId)(e.target.value)}
            className="border border-border px-2 py-[3px] bg-surface"
          >
            <option value="">Choisir…</option>
            {listeOptions(sortie ? destinationId : origineId)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Pièce justificative</span>
          <select
            required
            value={p.nature}
            onChange={(e) => modifierPiece(o, { nature: e.target.value as NaturePieceVirement | '' })}
            className="border border-border px-2 py-[3px] bg-surface"
          >
            <option value="">Choisir…</option>
            {NATURES_PIECE.map((n) => (
              <option key={n} value={n}>
                {LIBELLES_NATURE_PIECE[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Référence de la pièce</span>
          <input
            required
            maxLength={100}
            value={p.reference}
            onChange={(e) => modifierPiece(o, { reference: e.target.value })}
            className="w-[160px] border border-border px-2 py-[2px]"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Date de la pièce</span>
          <input
            type="date"
            required
            value={p.date}
            min={sortie ? debutExercice : pieces.SORTIE.date || debutExercice}
            max={finExercice}
            onChange={(e) => modifierPiece(o, { date: e.target.value })}
            className="border border-border px-2 py-[2px]"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Scan de la pièce (facultatif)</span>
          <input
            ref={champScan[o]}
            type="file"
            accept={FORMATS}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setScansChoisis((s) => ({ ...s, [o]: f }));
            }}
            className="text-[11px]"
          />
        </label>
        {scansChoisis[o] && (
          <span className="flex items-center gap-2 text-[11px]">
            Retenu · {scansChoisis[o]!.name}
            <button
              type="button"
              onClick={() => {
                setScansChoisis((s) => ({ ...s, [o]: null }));
                if (champScan[o].current) {
                  champScan[o].current!.value = '';
                  // Le bouton disparaît · le focus revient au champ qu'il vidait.
                  champScan[o].current!.focus();
                }
              }}
              className="text-sel hover:underline"
              aria-label={`Retirer le scan retenu ${deLa(o)}`}
            >
              Retirer
            </button>
          </span>
        )}
      </fieldset>
    );
  };

  // La pièce d'une opération dans la liste · nature, référence, date, scans.
  const pieceDansLaListe = (v: VirementServi, o: OperationVirementFonds) => {
    const [nature, reference, jourPiece] =
      o === 'SORTIE' ? [v.naturePiece, v.referencePiece, v.datePiece] : [v.naturePieceEntree, v.referencePieceEntree, v.datePieceEntree];
    // Un scan joint avant la distinction des deux pièces n'a pas d'opération ·
    // il valait pour le virement entier, montré des deux côtés et dit tel. Un
    // serveur d'avant, qui ne sert pas le champ, rend `undefined` · lu comme
    // nul, jamais comme un scan qui disparaît.
    const scans = v.pieces.filter((p) => p.operation === o || p.operation == null);
    const cle = `${v.id}:${o}`;
    // UN ANCIEN VIREMENT PEUT AVOIR SES ÉCRITURES À UNE AUTRE DATE QUE SA PIÈCE ·
    // passées à la date du virement, avant la séparation des deux pièces.
    // Un virement neuf a toujours `date` égale à la pièce de sortie ; dès
    // qu'elles diffèrent, c'est un ancien, dont les DEUX écritures sont à
    // `date` · dit des deux côtés (second tour, échecs silencieux 2).
    const ancien = v.date.slice(0, 10) !== v.datePiece.slice(0, 10);
    const jourEcriture = ancien ? v.date : null;
    return (
      <>
        {LIBELLES_NATURE_PIECE[nature]} {reference} du {date(jourPiece)}
        {jourEcriture && jourEcriture.slice(0, 10) !== jourPiece.slice(0, 10) && <span className="text-text-dim"> · écritures du {date(jourEcriture)}</span>}
        {scans.map((p) => (
          <div key={p.id}>
            <button type="button" onClick={() => telecharger(p)} className="text-sel hover:underline" title="Télécharger">
              {p.nomFichier}
            </button>
            {p.operation == null && <span className="text-text-dim"> (virement entier)</span>}
          </div>
        ))}
        {peutEcrire && !v.annuleLe && (
          <div>
            <button
              type="button"
              disabled={envoiJoindre !== null}
              aria-busy={envoiJoindre === cle}
              aria-label={`Joindre un scan ${aLa(o)} du virement du ${date(v.date)}, pièce ${reference}`}
              onClick={() => {
                joindreA.current = { id: v.id, operation: o };
                champJoindre.current?.click();
              }}
              className="text-sel hover:underline disabled:opacity-40"
            >
              {envoiJoindre === cle ? 'Envoi…' : 'Joindre'}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="p-3 space-y-3 text-[11.5px]">
      {erreur && (
        <div ref={bandeauErreur} tabIndex={-1} role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">
          {erreur}
        </div>
      )}
      {/* La zone d'état reste montée · un lecteur d'écran n'annonce pas une
          zone qui naît avec son texte. */}
      <div role="status" className={info ? 'text-positive bg-positive-soft border border-positive/30 px-3 py-2' : 'sr-only'}>
        {info ?? ''}
      </div>
      {avertissement && (
        <div role="alert" className="text-warning bg-warning-soft border border-warning/30 px-3 py-2">
          {avertissement}
        </div>
      )}
      {scansManquants.length > 0 && (
        <div role="alert" className="text-warning bg-warning-soft border border-warning/30 px-3 py-2">
          Scan non joint ·{' '}
          {scansManquants
            .map((m) => `${deLa(m.operation)}, pièce ${m.reference} du ${date(m.jour)} (${m.motif})`)
            .join(' ; ')}{' '}
          · joignez-le depuis la liste.
        </div>
      )}
      {!exerciceCourant && <p className="text-text-dim">Aucun exercice · ouvrez-en un dans Exercices.</p>}
      {exerciceCourant && !liste && !erreur && <p className="text-text-dim">Chargement…</p>}
      {liste && journaux.length < 2 && (
        <p className="text-warning">
          Un virement va d'un journal de banque ou de caisse à un autre · ce dossier{' '}
          {journaux.length === 0 ? "n'en a aucun" : "n'en a qu'un"} avec son compte. Les journaux se créent dans Structure › Codes journaux.
        </p>
      )}
      {liste && exerciceClos && <p className="text-text-dim">Exercice clôturé · ses virements se consultent, aucun ne se passe ni ne s'annule.</p>}

      {peutEcrire && liste && journaux.length >= 2 && !exerciceClos && (
        // `noValidate` · l'écran dit lui-même ce qui manque (`manque`), dans
        // l'ordre du formulaire, au lieu que le navigateur parle le premier.
        <form noValidate onSubmit={passer} className="border border-border bg-surface p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Montant</span>
              <input
                required
                inputMode="decimal"
                value={somme}
                onChange={(e) => setSomme(e.target.value)}
                className="w-[150px] border border-border px-2 py-[2px] text-right"
              />
            </label>
            <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
              <span className="text-text-dim">Objet</span>
              <input required minLength={3} maxLength={200} value={objet} onChange={(e) => setObjet(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <Aide
              titre="Virement de fonds"
              texte="Les fonds quittent une banque ou une caisse pour une autre. Le virement compte deux opérations, chacune avec sa pièce justificative · la sortie des fonds au journal d'origine (chèque, ordre de virement, bon de caisse…), leur entrée au journal de destination (bordereau de versement, avis de crédit…). Chaque écriture prend la date de sa pièce ; l'entrée ne précède jamais la sortie et tombe dans le même exercice. Entre les deux, les fonds attendent au compte de passage, sous-compte du 585 propre au sens du virement, qui revient à zéro à l'entrée. Une même pièce peut appuyer les deux opérations, sa référence portée des deux côtés. Le porteur des espèces est exigé dès qu'une caisse est en jeu (exigence d'OmegaX). Un virement s'annule avec son motif · au brouillard ses pièces sont retirées, validées elles sont inscrites en négatif."
              source="AUDCIF art. 16, al. 2, art. 17, 3° et 5°, art. 22, 7°, Titre VII, compte 58 (585 « Virements de fonds ») ; SYCEBNL Partie 2 ch. 3, compte 58 ; AUDCIF art. 20, al. 2"
            />
          </div>
          {blocOperation('SORTIE')}
          {blocOperation('ENTREE')}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5 min-w-[200px]">
              <span className="text-text-dim">Porteur des espèces{porteurExige ? ' (exigé)' : ' (facultatif)'}</span>
              <input required={porteurExige} maxLength={120} value={porteur} onChange={(e) => setPorteur(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
              <span className="text-text-dim">Observations (facultatif)</span>
              <input maxLength={500} value={observations} onChange={(e) => setObservations(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <button type="submit" disabled={envoi} className="ml-auto bg-sel text-white font-semibold px-4 py-1.5 disabled:opacity-40">
              {envoi ? 'Envoi…' : 'Passer le virement'}
            </button>
          </div>
        </form>
      )}

      {liste?.tronque && (
        <p className="text-warning">
          Les {liste.virements.length} virements les plus récents sur {liste.total} sont affichés.
        </p>
      )}
      {liste && liste.virements.length === 0 && <p className="text-text-dim">Aucun virement de fonds sur cet exercice.</p>}
      {liste && liste.virements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">De · vers</th>
                <th className="text-left px-2 py-1">Sortie des fonds</th>
                <th className="text-left px-2 py-1">Entrée des fonds</th>
                <th className="text-left px-2 py-1">Objet</th>
                <th className="text-left px-2 py-1">Pièces passées</th>
                <th className="text-right px-2 py-1 w-[120px]">Montant</th>
                <th className="text-left px-2 py-1 w-[120px]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {liste.virements.map((v) => (
                <tr key={v.id} className={v.annuleLe ? 'text-text-dim' : undefined}>
                  <td className="px-2 py-1">
                    {v.journalOrigine.code} · {v.journalDestination.code}
                    {v.porteur && <div className="text-text-dim">Porteur · {v.porteur}</div>}
                  </td>
                  <td className="px-2 py-1">{pieceDansLaListe(v, 'SORTIE')}</td>
                  <td className="px-2 py-1">{pieceDansLaListe(v, 'ENTREE')}</td>
                  <td className="px-2 py-1">
                    {v.objet}
                    {v.observations && <div className="text-text-dim">{v.observations}</div>}
                  </td>
                  <td className="px-2 py-1">{v.piecesPassees ?? '·'}</td>
                  <td className="px-2 py-1 text-right">{fmt(v.montant)}</td>
                  <td className="px-2 py-1">
                    {v.annuleLe ? (
                      <span>
                        Annulé le {new Date(v.annuleLe).toLocaleDateString('fr-FR')}
                        {v.motifAnnulation && <div className="text-text-dim">{v.motifAnnulation}</div>}
                      </span>
                    ) : (
                      peutValider &&
                      !exerciceClos && (
                        <button
                          type="button"
                          aria-label={`Annuler le virement du ${date(v.date)}`}
                          onClick={() => setAAnnuler(v)}
                          className="text-danger hover:underline"
                        >
                          Annuler
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <input
        ref={champJoindre}
        type="file"
        accept={FORMATS}
        className="hidden"
        aria-label="Scan à joindre au virement"
        onChange={(e) => void joindreDepuisLaListe(e.target.files?.[0])}
      />

      {aAnnuler && (
        <ModaleAnnulation
          virement={aAnnuler}
          onFermer={() => setAAnnuler(null)}
          onFait={async (message) => {
            setAAnnuler(null);
            setInfo(message);
            setErreur(null);
            await charger();
          }}
        />
      )}
    </div>
  );
}

function ModaleAnnulation({
  virement,
  onFermer,
  onFait,
}: {
  virement: VirementServi;
  onFermer: () => void;
  onFait: (message: string) => Promise<void>;
}) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  // Échap ferme, sauf pendant l'envoi · la réponse arriverait sur une boîte fermée.
  const envoiRef = useRef(envoi);
  envoiRef.current = envoi;
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoiRef.current) fermerRef.current();
        return true;
      }),
    [],
  );

  const annuler = async (e: FormEvent) => {
    e.preventDefault();
    if (motif.trim().length < 3) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ ecritureNegatifOrigineId: string | null; ecritureNegatifDestinationId: string | null; piecesPassees: string | null }>(
        `/virements-fonds/${virement.id}/annuler`,
        { motif: motif.trim() },
      );
      // CE QUI EST ARRIVÉ, dit · le serveur rend les négatifs qu'il a inscrits.
      const negatifs = [r.ecritureNegatifOrigineId, r.ecritureNegatifDestinationId].filter(Boolean).length;
      await onFait(
        negatifs === 0
          ? 'Virement annulé · ses deux pièces étaient au brouillard, elles sont retirées.'
          : negatifs === 2
            ? `Virement annulé · ses deux pièces validées sont inscrites en négatif (${r.piecesPassees ?? ''}).`
            : `Virement annulé · une pièce retirée du brouillard, l'autre inscrite en négatif (${r.piecesPassees ?? ''}).`,
      );
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Annulation impossible');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-annuler-virement"
          onSubmit={annuler}
          className="anim-modale w-full max-w-[460px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center px-2.5 border-b border-border">
            <span id="titre-annuler-virement">Annuler le virement du {date(virement.date)}</span>
          </div>
          <div className="p-3 space-y-2">
            <div>
              {virement.journalOrigine.code} · {virement.journalDestination.code} · {fmt(virement.montant)} · {virement.piecesPassees ?? ''}
            </div>
            {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Motif</span>
              <input ref={champ} required minLength={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
          </div>
          <div className="flex justify-end gap-2 px-3 pb-3">
            <button type="button" onClick={onFermer} disabled={envoi} className="px-3 py-1 border border-border">
              Fermer
            </button>
            <button type="submit" disabled={envoi || motif.trim().length < 3} className="bg-danger text-white font-semibold px-3 py-1 disabled:opacity-40">
              {envoi ? '…' : 'Annuler le virement'}
            </button>
          </div>
        </form>
      </div>
    </PortailModale>
  );
}
