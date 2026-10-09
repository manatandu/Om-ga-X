import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { ecouterEchap } from '../lib/echap';
import { montant as fmt } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';
import { Aide } from '../components/chrome/Aide';
import { PortailModale } from '../components/PortailModale';
import {
  LIBELLES_NATURE_PIECE,
  NATURES_PIECE,
  caisseEnJeu,
  libelleSens,
  sensDuVirement,
  type NaturePieceVirement,
  type SensVirementFonds,
} from '../lib/virement-fonds';

/**
 * VIREMENT DE FONDS · Traitement > Tiers et trésorerie (demande de Manasse du
 * 2026-10-09). D'une banque ou d'une caisse vers une autre, chaque côté dans
 * son journal · deux pièces passées ensemble par le 585 « Virements de fonds »
 * (le 581 est la régie d'avance, AUDCIF Titre VII, compte 58), au sous-compte
 * du sens. Règles au serveur (src/modules/virements-fonds/), l'écran ne les
 * refait pas · il propose, le serveur juge.
 */

interface JournalServi {
  id: string;
  code: string;
  intitule: string;
  caisse: boolean;
  compteTresorerie: { id: string; numero: string; intitule: string } | null;
}

interface VirementServi {
  id: string;
  date: string;
  montant: number;
  sens: SensVirementFonds;
  naturePiece: NaturePieceVirement;
  referencePiece: string;
  datePiece: string;
  objet: string;
  porteur: string | null;
  observations: string | null;
  piecesPassees: string | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  journalOrigine: { code: string };
  journalDestination: { code: string };
  pieces: Array<{ id: string; nomFichier: string; taille: number }>;
}

interface Liste {
  journaux: JournalServi[];
  comptesDePassage: Array<{ sens: SensVirementFonds; libelle: string; compte: { numero: string; intitule: string } | null }>;
  virements: VirementServi[];
  total: number;
  tronque: boolean;
}

const TAILLE_MAX = 5 * 1024 * 1024;
const FORMATS = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx,.doc,.xls';
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

export function VirementsFondsPage() {
  const { peutEcrire, peutValider } = useAuth();
  const { exerciceCourant } = useExercice();
  // null tant que la liste n'est pas lue · « aucun virement » ne se dit que sur une liste lue.
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<VirementServi | null>(null);

  const [origineId, setOrigineId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [jour, setJour] = useState('');
  const [somme, setSomme] = useState('');
  const [nature, setNature] = useState<NaturePieceVirement>('ORDRE_VIREMENT');
  const [reference, setReference] = useState('');
  const [datePiece, setDatePiece] = useState('');
  const [objet, setObjet] = useState('');
  const [porteur, setPorteur] = useState('');
  const [observations, setObservations] = useState('');
  const champFichier = useRef<HTMLInputElement>(null);
  const champJoindre = useRef<HTMLInputElement>(null);
  const [joindreA, setJoindreA] = useState<string | null>(null);

  // Une réponse d'un exercice quitté est jetée · elle afficherait les virements
  // d'un autre exercice sous le sélecteur de celui-ci.
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    if (!exerciceCourant) return;
    const n = ++jeton.current;
    try {
      const l = await api.get<Liste>(`/virements-fonds?exerciceId=${exerciceCourant.id}`);
      if (n === jeton.current) setListe(l);
    } catch (err) {
      if (n === jeton.current) setErreur(err instanceof ApiError ? err.message : 'Virements illisibles');
    }
  }, [exerciceCourant]);

  useEffect(() => {
    setListe(null);
    void charger();
  }, [charger]);

  const journaux = liste?.journaux ?? [];
  const origine = journaux.find((j) => j.id === origineId) ?? null;
  const destination = journaux.find((j) => j.id === destinationId) ?? null;
  const sens = origine?.compteTresorerie && destination?.compteTresorerie ? sensDuVirement(origine.compteTresorerie.numero, destination.compteTresorerie.numero) : null;
  const passage = sens ? liste?.comptesDePassage.find((c) => c.sens === sens)?.compte ?? null : null;
  const porteurExige = sens !== null && caisseEnJeu(sens);
  const valeur = montantSaisi(somme);
  const pret =
    !!exerciceCourant &&
    !!origine &&
    !!destination &&
    origine.id !== destination.id &&
    !!jour &&
    valeur !== null &&
    valeur > 0 &&
    reference.trim() !== '' &&
    !!datePiece &&
    objet.trim().length >= 3 &&
    (!porteurExige || porteur.trim() !== '');

  const joindre = async (virementId: string, fichier: File) => {
    // Refus immédiat · le serveur refuse de toute façon au-delà de 5 Mo.
    if (fichier.size > TAILLE_MAX) throw new ApiError(400, 'Le fichier dépasse 5 Mo · réduisez-le ou numérisez-le en plus basse définition.');
    const corps = new FormData();
    corps.append('fichier', fichier);
    await api.envoyerFichier(`/virements-fonds/${virementId}/pieces`, corps);
  };

  const passer = async (e: FormEvent) => {
    e.preventDefault();
    if (!pret || !exerciceCourant || valeur === null) return;
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    try {
      const v = await api.post<VirementServi & { comptePassage: { numero: string } }>('/virements-fonds', {
        exerciceId: exerciceCourant.id,
        journalOrigineId: origineId,
        journalDestinationId: destinationId,
        date: jour,
        montant: valeur,
        naturePiece: nature,
        referencePiece: reference.trim(),
        datePiece,
        objet: objet.trim(),
        ...(porteur.trim() ? { porteur: porteur.trim() } : {}),
        ...(observations.trim() ? { observations: observations.trim() } : {}),
      });
      let message = `Virement passé · ${v.piecesPassees ?? 'deux pièces'}, au compte ${v.comptePassage.numero}.`;
      const fichier = champFichier.current?.files?.[0];
      if (fichier) {
        try {
          await joindre(v.id, fichier);
          message += ' Pièce jointe.';
        } catch (err) {
          // Le virement EST passé · le dire, et dire ce qui manque, sans le
          // présenter comme un échec du virement.
          message += ` La pièce n'est pas jointe · ${err instanceof ApiError ? err.message : 'envoi impossible'} Joignez-la depuis la liste.`;
        }
      }
      setInfo(message);
      setSomme('');
      setReference('');
      setObjet('');
      setPorteur('');
      setObservations('');
      if (champFichier.current) champFichier.current.value = '';
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Virement non passé');
    } finally {
      setEnvoi(false);
    }
  };

  const joindreDepuisLaListe = async (fichier: File | undefined) => {
    const id = joindreA;
    setJoindreA(null);
    if (!fichier || !id) return;
    setErreur(null);
    setInfo(null);
    try {
      await joindre(id, fichier);
      setInfo('Pièce jointe au virement.');
      await charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Pièce non jointe');
    } finally {
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

  return (
    <div className="p-3 space-y-3 text-[11.5px]">
      {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">{erreur}</div>}
      {info && <div className="text-positive bg-positive-soft border border-positive/30 px-3 py-2">{info}</div>}
      {liste && journaux.length < 2 && (
        <p className="text-warning">
          Un virement va d'un journal de banque ou de caisse à un autre · ce dossier en a {journaux.length === 0 ? 'aucun' : 'un seul'} avec son
          compte. Créez-le dans Structure › Journaux.
        </p>
      )}

      {peutEcrire && liste && journaux.length >= 2 && (
        <form onSubmit={passer} className="border border-border bg-surface p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
              <span className="text-text-dim">De (banque ou caisse)</span>
              <select value={origineId} onChange={(e) => setOrigineId(e.target.value)} className="border border-border px-2 py-[3px] bg-surface">
                <option value="">Choisir…</option>
                {listeOptions(destinationId)}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
              <span className="text-text-dim">Vers (banque ou caisse)</span>
              <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="border border-border px-2 py-[3px] bg-surface">
                <option value="">Choisir…</option>
                {listeOptions(origineId)}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Date du virement</span>
              <input
                type="date"
                required
                value={jour}
                min={exerciceCourant?.dateDebut.slice(0, 10)}
                max={exerciceCourant?.dateFin.slice(0, 10)}
                onChange={(e) => setJour(e.target.value)}
                className="border border-border px-2 py-[2px]"
              />
            </label>
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
            <Aide
              titre="Virement de fonds"
              texte="Les fonds quittent une banque ou une caisse pour une autre. Deux pièces naissent ensemble, chacune dans son journal · au journal d'origine, débit du compte de passage et crédit de sa trésorerie ; au journal de destination, débit de sa trésorerie et crédit du compte de passage, qui revient à zéro. Le compte de passage est le sous-compte du 585 propre au sens du virement. La nature, la référence et la date de la pièce justificative sont exigées ; le porteur des espèces l'est dès qu'une caisse est en jeu (exigence d'OmegaX). Un virement s'annule avec son motif · au brouillard ses pièces sont retirées, validées elles sont inscrites en négatif."
              source="AUDCIF Titre VII, compte 58 (585 « Virements de fonds ») et art. 17 ; SYCEBNL Partie 2 ch. 3, compte 58 ; AUDCIF art. 20, al. 2"
            />
          </div>
          {sens && (
            <div className="text-text-dim">
              Virement {libelleSens(sens)} ·{' '}
              {passage ? (
                <>
                  compte de passage {passage.numero} · {passage.intitule}
                </>
              ) : (
                'le compte de passage de ce sens sera ouvert sous le 58500000'
              )}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Pièce justificative</span>
              <select value={nature} onChange={(e) => setNature(e.target.value as NaturePieceVirement)} className="border border-border px-2 py-[3px] bg-surface">
                {NATURES_PIECE.map((n) => (
                  <option key={n} value={n}>
                    {LIBELLES_NATURE_PIECE[n]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Référence de la pièce</span>
              <input required maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} className="w-[160px] border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Date de la pièce</span>
              <input type="date" required value={datePiece} onChange={(e) => setDatePiece(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
              <span className="text-text-dim">Objet</span>
              <input required minLength={3} maxLength={200} value={objet} onChange={(e) => setObjet(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5 min-w-[200px]">
              <span className="text-text-dim">Porteur des espèces{porteurExige ? '' : ' (facultatif)'}</span>
              <input required={porteurExige} maxLength={120} value={porteur} onChange={(e) => setPorteur(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
              <span className="text-text-dim">Observations (facultatif)</span>
              <input maxLength={500} value={observations} onChange={(e) => setObservations(e.target.value)} className="border border-border px-2 py-[2px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Scan de la pièce (facultatif)</span>
              <input ref={champFichier} type="file" accept={FORMATS} className="text-[11px]" aria-label="Scan de la pièce" />
            </label>
            <button type="submit" disabled={envoi || !pret} className="ml-auto bg-sel text-white font-semibold px-4 py-1.5 disabled:opacity-40">
              {envoi ? '…' : 'Passer le virement'}
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
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className="text-left px-2 py-1 w-[84px]">Date</th>
                <th className="text-left px-2 py-1">De · vers</th>
                <th className="text-left px-2 py-1">Pièce justificative</th>
                <th className="text-left px-2 py-1">Objet</th>
                <th className="text-left px-2 py-1">Pièces passées</th>
                <th className="text-right px-2 py-1 w-[120px]">Montant</th>
                <th className="text-left px-2 py-1 w-[150px]" />
              </tr>
            </thead>
            <tbody>
              {liste.virements.map((v) => (
                <tr key={v.id} className={v.annuleLe ? 'text-text-dim' : undefined}>
                  <td className="px-2 py-1">{date(v.date)}</td>
                  <td className="px-2 py-1">
                    {v.journalOrigine.code} · {v.journalDestination.code}
                    <div className="text-text-dim">{libelleSens(v.sens)}</div>
                  </td>
                  <td className="px-2 py-1">
                    {LIBELLES_NATURE_PIECE[v.naturePiece]} {v.referencePiece} du {date(v.datePiece)}
                    {v.porteur && <div className="text-text-dim">Porteur · {v.porteur}</div>}
                    {v.pieces.map((p) => (
                      <div key={p.id}>
                        <button type="button" onClick={() => telecharger(p)} className="text-sel hover:underline" title="Télécharger">
                          {p.nomFichier}
                        </button>
                      </div>
                    ))}
                  </td>
                  <td className="px-2 py-1">
                    {v.objet}
                    {v.observations && <div className="text-text-dim">{v.observations}</div>}
                  </td>
                  <td className="px-2 py-1">{v.piecesPassees ?? '·'}</td>
                  <td className="px-2 py-1 text-right">{fmt(v.montant)}</td>
                  <td className="px-2 py-1">
                    {v.annuleLe ? (
                      <span title={v.motifAnnulation ?? undefined}>Annulé le {new Date(v.annuleLe).toLocaleDateString('fr-FR')}</span>
                    ) : (
                      <span className="flex gap-2.5">
                        {peutEcrire && (
                          <button
                            type="button"
                            onClick={() => {
                              setJoindreA(v.id);
                              champJoindre.current?.click();
                            }}
                            className="text-sel hover:underline"
                          >
                            Joindre
                          </button>
                        )}
                        {peutValider && (
                          <button type="button" onClick={() => setAAnnuler(v)} className="text-danger hover:underline">
                            Annuler
                          </button>
                        )}
                      </span>
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
        aria-label="Pièce à joindre au virement"
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
      await api.post(`/virements-fonds/${virement.id}/annuler`, { motif: motif.trim() });
      await onFait('Virement annulé · ses pièces au brouillard sont retirées, les validées sont inscrites en négatif.');
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
