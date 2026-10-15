import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { ecouterEchap } from '../lib/echap';
import {
  ADRESSES_PIECES,
  FORMATS_PIECE,
  LONGUEUR_COMMENTAIRE_PIECE,
  refusAvantEnvoi,
  tailleLisible,
  type ObjetDesPieces,
  type PieceDetachee,
  type PieceJointe,
  type PiecesDeLObjet,
} from '../lib/pieces-jointes';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';

const message = (e: unknown, defaut: string) => (e instanceof ApiError || e instanceof Error ? e.message : defaut);

/** Ce que la bulle « ? » dit de chaque objet · le pourquoi, jamais à l'écran. */
const AIDES: Record<ObjetDesPieces, { titre: string; texte: string; source: string }> = {
  ECRITURE: {
    titre: 'Pièces justificatives de l’écriture',
    texte:
      'Copie de la pièce qui justifie l’écriture (facture, reçu, relevé, contrat) · PDF, image, Word ou Excel, 5 Mo au plus, avec un commentaire de 69 caractères. Le format est vérifié sur le contenu du fichier. Une écriture validée, même d’un exercice clôturé, reçoit sa pièce ; la pièce d’une écriture validée ne se retire plus, elle se conserve avec elle. Une écriture retirée au brouillard laisse sa pièce dans les pièces détachées. Les originaux restent la conservation.',
    source: 'AUDCIF art. 17, 3° ; art. 22, 2°, 6° et 7° ; art. 24 · Sage i7, documents de l’écriture',
  },
  SECTION: {
    titre: 'Documents de la section',
    texte:
      'Convention de financement, budget du bailleur, rapport d’exécution · PDF, image, Word ou Excel, 5 Mo au plus. Le document se dépose et se retire à tout moment ; une section qui en porte un ne se supprime pas tant qu’il reste.',
    source: 'Sage i7, documents du compte analytique · règle d’OmegaX',
  },
  IMMOBILISATION: {
    titre: 'Documents du bien',
    texte:
      'Facture d’achat, acte, carte grise, contrat de garantie, photo · PDF, image, Word ou Excel, 5 Mo au plus. Le document se dépose et se retire à tout moment ; une fiche qui en porte un ne se supprime pas tant qu’il reste.',
    source: 'Sage i7, documents de la fiche immobilisation · règle d’OmegaX',
  },
  SALARIE: {
    titre: 'Documents du salarié',
    texte:
      'Contrat, pièce d’identité, diplôme, certificat · données personnelles, lues aux droits du registre du personnel. Le document se retire toujours (droit à l’effacement) ; ce que la loi oblige à tenir vit dans le registre et les bulletins. Son nom et son commentaire n’entrent pas au journal d’audit.',
    source: 'Ordonnance-loi n° 23/10 du 13 mars 2023, art. 215 et 216 ; Code du travail, art. 213 à 215',
  },
};

/**
 * LE VOLET DES PIÈCES D'UN OBJET (ligne sage-l6, fonction n° 22), posé chez
 * l'objet · la fiche du bien, la fiche du salarié, la section, et la boîte
 * des pièces d'une écriture. Une liste part de `null` · « aucune pièce » ne
 * se dit que sur une liste LUE, et un échec de lecture se dit. Ce que l'objet
 * permet (déposer, retirer) vient du serveur avec la liste ; `peutEcrire` aligne
 * les boutons sur les rôles des routes (`peutEcrire` de la session, passé par l'écran).
 */
export function VoletPiecesJointes({
  objet,
  objetId,
  peutEcrire,
  titre = 'Documents',
  montrerDescription = false,
  onOccupe,
  onChange,
}: {
  objet: ObjetDesPieces;
  objetId: string;
  peutEcrire: boolean;
  titre?: string;
  montrerDescription?: boolean;
  onOccupe?: (occupe: boolean) => void;
  onChange?: () => void;
}) {
  const adresses = ADRESSES_PIECES[objet];
  const [liste, setListe] = useState<PiecesDeLObjet | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [commentaire, setCommentaire] = useState('');
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);
  // UNE RÉPONSE PÉRIMÉE EST JETÉE · la liste d'un objet lente à venir ne
  // s'affiche jamais sous un autre, où « Retirer » viserait la mauvaise pièce.
  const jeton = useRef(0);

  const lire = useCallback(() => {
    const mien = ++jeton.current;
    setErreurLecture(null);
    api.get<PiecesDeLObjet>(adresses.liste(objetId)).then(
      (r) => {
        if (mien === jeton.current) setListe(r);
      },
      (e) => {
        if (mien !== jeton.current) return;
        setListe(null);
        setErreurLecture(message(e, 'Pièces jointes illisibles'));
      },
    );
  }, [adresses, objetId]);

  useEffect(() => {
    setListe(null);
    setErreur(null);
    setEdition(null);
    lire();
    return () => {
      jeton.current++;
    };
  }, [lire]);

  const occupe = (o: boolean) => {
    setEnvoi(o);
    onOccupe?.(o);
  };

  const deposer = async (e: FormEvent) => {
    e.preventDefault();
    const fichier = champFichier.current?.files?.[0];
    if (!fichier) {
      setErreur('Choisissez un fichier.');
      return;
    }
    const refus = refusAvantEnvoi(fichier);
    if (refus) {
      setErreur(refus);
      return;
    }
    const corps = new FormData();
    corps.append('fichier', fichier);
    if (commentaire.trim()) corps.append('commentaire', commentaire.trim());
    occupe(true);
    setErreur(null);
    try {
      await api.envoyerFichier(adresses.liste(objetId), corps);
      setCommentaire('');
      if (champFichier.current) champFichier.current.value = '';
      lire();
      onChange?.();
    } catch (err) {
      setErreur(message(err, 'Dépôt impossible'));
    } finally {
      occupe(false);
    }
  };

  const telecharger = async (p: PieceJointe) => {
    setErreur(null);
    try {
      await api.telecharger(`${adresses.piece(p.id)}/fichier`, p.nomFichier);
    } catch (err) {
      setErreur(message(err, 'Téléchargement impossible'));
    }
  };

  const enregistrerCommentaire = async () => {
    if (!edition) return;
    setErreur(null);
    occupe(true);
    try {
      await api.patch(adresses.piece(edition.id), { commentaire: edition.texte });
      setEdition(null);
      lire();
    } catch (err) {
      setErreur(message(err, 'Commentaire non enregistré'));
    } finally {
      occupe(false);
    }
  };

  const retirer = async (p: PieceJointe) => {
    if (!window.confirm(`Retirer « ${p.nomFichier} » ? La pièce est supprimée du dossier.`)) return;
    setErreur(null);
    occupe(true);
    try {
      await api.delete(adresses.piece(p.id));
      lire();
      onChange?.();
    } catch (err) {
      setErreur(message(err, 'Retrait impossible'));
    } finally {
      occupe(false);
    }
  };

  const aide = AIDES[objet];

  return (
    // La région se nomme par son objet · deux volets ouverts dans deux fenêtres ne se confondent pas.
    <section aria-label={AIDES[objet].titre} className="text-[11.5px]">
      <div className="text-[11px] font-bold text-text-dim mb-1.5 flex items-center gap-1.5">
        {titre}
        {liste && liste.total > 0 && <span className="font-normal">({liste.total})</span>}
        <Aide titre={aide.titre} texte={aide.texte} source={aide.source} />
      </div>
      {montrerDescription && liste && <div className="mb-1.5 truncate" title={liste.description}>{liste.description}</div>}
      {erreur && (
        <div role="alert" className="text-danger mb-1.5">
          {erreur}
        </div>
      )}
      {erreurLecture ? (
        <div role="alert" className="text-danger mb-2">
          Pièces jointes illisibles · {erreurLecture}{' '}
          <button type="button" onClick={lire} className="text-sel hover:underline">
            Relire
          </button>
        </div>
      ) : liste === null ? (
        <div className="text-text-dim mb-2">Chargement…</div>
      ) : (
        <>
          {liste.pieces.length === 0 && <div className="text-text-dim mb-2">Aucune pièce jointe.</div>}
          {liste.tronque && (
            <div className="text-warning mb-1.5">
              Les {liste.pieces.length} plus récentes sur {liste.total}.
            </div>
          )}
          {liste.pieces.map((p) => (
            <div key={p.id} className="border border-border mb-1.5 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => telecharger(p)}
                  className="text-sel hover:underline truncate text-left"
                  title="Télécharger"
                >
                  {p.nomFichier}
                </button>
                <span className="text-[11px] text-text-dim shrink-0">{tailleLisible(p.taille)}</span>
              </div>
              {edition?.id === p.id ? (
                <div className="flex gap-1.5 mt-1">
                  <input
                    autoFocus
                    aria-label="Commentaire de la pièce"
                    maxLength={LONGUEUR_COMMENTAIRE_PIECE}
                    value={edition.texte}
                    onChange={(e) => setEdition({ id: p.id, texte: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void enregistrerCommentaire();
                      }
                    }}
                    className="flex-1 min-w-0 border border-border-dark px-1.5 py-0.5"
                  />
                  <button type="button" disabled={envoi} onClick={enregistrerCommentaire} className="text-[11px] text-sel hover:underline disabled:opacity-50">
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEdition(null)} className="text-[11px] text-text-dim hover:underline">
                    Annuler
                  </button>
                </div>
              ) : (
                p.commentaire && <div className="text-[11px] mt-0.5">{p.commentaire}</div>
              )}
              <div className="flex items-center justify-between mt-1 gap-2">
                <span className="text-[11px] text-text-dim truncate">
                  {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                  {p.deposePar && ` · ${p.deposePar}`}
                </span>
                {peutEcrire && edition?.id !== p.id && (
                  <span className="flex gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEdition({ id: p.id, texte: p.commentaire ?? '' })}
                      className="text-[11px] text-sel hover:underline"
                    >
                      Commentaire
                    </button>
                    {liste.retrait.permis && (
                      <button type="button" disabled={envoi} onClick={() => retirer(p)} className="text-[11px] text-danger hover:underline disabled:opacity-50">
                        Retirer
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
          {!liste.retrait.permis && liste.retrait.motif && liste.pieces.length > 0 && (
            <div className="text-[11px] text-text-dim mb-1.5">{liste.retrait.motif}</div>
          )}
          {peutEcrire && !liste.depot.permis && liste.depot.motif && <div className="text-warning mb-1.5">{liste.depot.motif}</div>}
          {peutEcrire && liste.depot.permis && (
            <form onSubmit={deposer} className="mt-2">
              <input
                ref={champFichier}
                type="file"
                accept={FORMATS_PIECE}
                className="w-full text-[11px] mb-1.5"
                aria-label="Fichier à joindre"
              />
              <div className="flex gap-1.5">
                <input
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  maxLength={LONGUEUR_COMMENTAIRE_PIECE}
                  placeholder="Commentaire (69 caractères)"
                  aria-label="Commentaire"
                  className="flex-1 min-w-0 border border-border-dark px-2 py-1"
                />
                <button type="submit" disabled={envoi} className="bg-sel text-white font-semibold px-3 py-1 disabled:opacity-60">
                  {envoi ? 'Envoi…' : 'Joindre'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

/** La boîte commune · voile, dialogue borné en hauteur, Échap tenu pendant un envoi. */
function BoitePieces({
  titreId,
  titre,
  occupe,
  onFermer,
  children,
}: {
  titreId: string;
  titre: string;
  occupe: boolean;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const occupeRef = useRef(occupe);
  occupeRef.current = occupe;
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  useEffect(() => boite.current?.focus({ preventScroll: true }), []);
  useEffect(
    () =>
      ecouterEchap(() => {
        if (!occupeRef.current) fermerRef.current();
        return true;
      }),
    [],
  );
  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <div
          ref={boite}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titreId}
          className="anim-modale w-full max-w-[520px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px] outline-none"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 border-b border-border">
            <span id={titreId}>{titre}</span>
            <button
              type="button"
              onClick={onFermer}
              disabled={occupe}
              aria-label="Fermer"
              className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c] disabled:opacity-40"
            >
              ✕
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </PortailModale>
  );
}

/** Les pièces d'une écriture, ouvertes depuis la saisie ou le journal. */
export function ModalePiecesEcriture({
  ecritureId,
  peutEcrire,
  onFermer,
  onChange,
}: {
  ecritureId: string;
  peutEcrire: boolean;
  onFermer: () => void;
  onChange?: () => void;
}) {
  const [occupe, setOccupe] = useState(false);
  return (
    <BoitePieces titreId="titre-pieces-ecriture" titre="Pièces jointes de l’écriture" occupe={occupe} onFermer={onFermer}>
      <VoletPiecesJointes
        objet="ECRITURE"
        objetId={ecritureId}
        peutEcrire={peutEcrire}
        titre="Pièces justificatives"
        montrerDescription
        onOccupe={setOccupe}
        onChange={onChange}
      />
    </BoitePieces>
  );
}

/**
 * LES PIÈCES DÉTACHÉES · jointes à une écriture retirée depuis au brouillard.
 * Gardées avec ce qu'elles justifiaient au dépôt, elles se téléchargent pour
 * être jointes à l'écriture ressaisie, et se retirent.
 */
export function ModalePiecesDetachees({ peutEcrire, onFermer }: { peutEcrire: boolean; onFermer: () => void }) {
  const [liste, setListe] = useState<{ pieces: PieceDetachee[]; total: number; tronque: boolean } | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const jeton = useRef(0);

  const lire = useCallback(() => {
    const mien = ++jeton.current;
    setErreurLecture(null);
    api.get<{ pieces: PieceDetachee[]; total: number; tronque: boolean }>('/pieces-jointes-ecritures/detachees').then(
      (r) => mien === jeton.current && setListe(r),
      (e) => {
        if (mien !== jeton.current) return;
        setListe(null);
        setErreurLecture(message(e, 'Pièces détachées illisibles'));
      },
    );
  }, []);
  useEffect(() => {
    lire();
    return () => {
      jeton.current++;
    };
  }, [lire]);

  const telecharger = async (p: PieceDetachee) => {
    setErreur(null);
    try {
      await api.telecharger(`${ADRESSES_PIECES.ECRITURE.piece(p.id)}/fichier`, p.nomFichier);
    } catch (err) {
      setErreur(message(err, 'Téléchargement impossible'));
    }
  };
  const retirer = async (p: PieceDetachee) => {
    if (!window.confirm(`Retirer « ${p.nomFichier} » ? La pièce est supprimée du dossier.`)) return;
    setErreur(null);
    setOccupe(true);
    try {
      await api.delete(ADRESSES_PIECES.ECRITURE.piece(p.id));
      lire();
    } catch (err) {
      setErreur(message(err, 'Retrait impossible'));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <BoitePieces titreId="titre-pieces-detachees" titre="Pièces détachées" occupe={occupe} onFermer={onFermer}>
      <div className="text-[11px] font-bold text-text-dim mb-1.5 flex items-center gap-1.5">
        Pièces d’écritures retirées au brouillard
        <Aide
          titre="Pièces détachées"
          texte="Une écriture retirée au brouillard laisse ses pièces ici, avec la description de l’écriture qu’elles justifiaient au dépôt · rien ne se perd. Téléchargez la pièce pour la joindre à l’écriture ressaisie, puis retirez-la."
          source="AUDCIF art. 17, 3° et art. 24 · règle d’OmegaX"
        />
      </div>
      {erreur && (
        <div role="alert" className="text-danger mb-1.5">
          {erreur}
        </div>
      )}
      {erreurLecture ? (
        <div role="alert" className="text-danger">
          Pièces détachées illisibles · {erreurLecture}
        </div>
      ) : liste === null ? (
        <div className="text-text-dim">Chargement…</div>
      ) : (
        <>
          {liste.pieces.length === 0 && <div className="text-text-dim">Aucune pièce détachée.</div>}
          {liste.tronque && (
            <div className="text-warning mb-1.5">
              Les {liste.pieces.length} plus récentes sur {liste.total}.
            </div>
          )}
          {liste.pieces.map((p) => (
            <div key={p.id} className="border border-border mb-1.5 px-2.5 py-1.5">
              <div className="truncate text-text-dim" title={p.ecritureDecrite}>
                {p.ecritureDecrite}
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <button type="button" onClick={() => telecharger(p)} className="text-sel hover:underline truncate text-left" title="Télécharger">
                  {p.nomFichier}
                </button>
                <span className="text-[11px] text-text-dim shrink-0">{tailleLisible(p.taille)}</span>
              </div>
              {p.commentaire && <div className="text-[11px] mt-0.5">{p.commentaire}</div>}
              <div className="flex items-center justify-between mt-1 gap-2">
                <span className="text-[11px] text-text-dim truncate">
                  {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                  {p.deposePar && ` · ${p.deposePar}`}
                </span>
                {peutEcrire && (
                  <button type="button" disabled={occupe} onClick={() => retirer(p)} className="text-[11px] text-danger hover:underline disabled:opacity-50">
                    Retirer
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </BoitePieces>
  );
}

/** Le bouton d'une écriture · le nombre de pièces quand il est lu, jamais « 0 » sur un décompte illisible. */
export function BoutonPiecesEcriture({ nombre, onOuvrir }: { nombre: number | null; onOuvrir: () => void }) {
  const libelle = nombre === null ? 'Pièces jointes' : nombre === 0 ? 'Aucune pièce jointe' : `${nombre} pièce${nombre > 1 ? 's' : ''} jointe${nombre > 1 ? 's' : ''}`;
  return (
    <button
      type="button"
      onClick={onOuvrir}
      title={libelle}
      aria-label={libelle}
      className={`text-[11px] font-bold px-1 rounded-[3px] border ${
        nombre ? 'text-sel border-sel/40 bg-sel-soft' : 'text-text-dim border-border hover:text-sel'
      }`}
    >
      PJ{nombre ? ` ${nombre}` : ''}
    </button>
  );
}
