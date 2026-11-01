import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ToucheReact } from 'react';
import { api, ApiError } from '../lib/api';
import { ecouterEchap } from '../lib/echap';
import { montant } from '../lib/montants';
import {
  adresseGrandLivre,
  adresseOrigine,
  celluleDuComposant,
  soldeLuParLesEtats,
  horsDesEtats,
  LIBELLE_COLONNE,
  type CelluleOrigine,
  type ContributionCompte,
  type OrigineDuMontant,
  type SourceOrigine,
} from '../lib/origine-montant';
import type { LigneGrandLivre } from '../lib/types';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';
import { FicheImputation } from './FicheImputation';

/**
 * D'OÙ VIENT CE CHIFFRE · LE ZOOM DE SAGE 100 COMPTABILITÉ (ligne
 * origine-des-montants, gel levé par Manasse le 2026-11-01).
 *
 * Dans les éditions de Sage 100, un double-clic sur un montant ouvre son
 * détail, puis le grand livre du compte, puis la pièce. La fenêtre reprend ce
 * chemin en trois niveaux, avec un fil qui se remonte (« Précédent », Échap) :
 *  1. le POSTE · sa règle de correspondance, ses comptes groupés comme le
 *     calcul les lit, chacun avec sa contribution, le total et l'écart ; ou,
 *     pour un total, les postes qui le font, chacun ouvrable ; ou la source
 *     d'un montant hors balance ;
 *  2. le GRAND LIVRE du compte sur l'exercice qui porte la colonne
 *     (`GET /ecritures/grand-livre/:compteId`, route bornée existante) ;
 *  3. la PIÈCE, par la fiche d'imputation (`FicheImputation`).
 *
 * Rien n'est recalculé ici · tout vient du serveur (`lib/origine-montant.ts`).
 * La présentation (tableau blanc à en-tête plein, total sur fond clair) est
 * celle des grilles d'OmegaX, charte § 9 ter.
 */

type Niveau =
  | { type: 'poste'; cellule: CelluleOrigine }
  | { type: 'grand-livre'; compte: ContributionCompte; exerciceId: string };

export function FenetreOrigineMontant({
  source,
  exerciceId,
  cellule,
  onFermer,
}: {
  source: SourceOrigine;
  exerciceId: string;
  cellule: CelluleOrigine;
  onFermer: () => void;
}) {
  const [pile, setPile] = useState<Niveau[]>([{ type: 'poste', cellule }]);
  const [ficheId, setFicheId] = useState<string | null>(null);
  const niveau = pile[pile.length - 1];

  const precedent = useCallback(() => {
    setPile((p) => (p.length > 1 ? p.slice(0, -1) : p));
  }, []);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  const longueurRef = useRef(pile.length);
  longueurRef.current = pile.length;
  const ficheRef = useRef(ficheId);
  ficheRef.current = ficheId;

  // Échap remonte d'un niveau, puis ferme · la fiche d'une pièce, au-dessus,
  // gère sa propre touche.
  useEffect(
    () =>
      ecouterEchap(() => {
        if (ficheRef.current) return false;
        if (longueurRef.current > 1) precedent();
        else fermerRef.current();
        return true;
      }),
    [precedent],
  );

  // Une ligne de note se nomme par son rang · le code de la note est le même pour le total et ses rubriques.
  const fil = pile.map((n) =>
    n.type === 'grand-livre'
      ? n.compte.numero
      : n.cellule.etat === 'note'
        ? `${n.cellule.ref} ligne ${(n.cellule.ligne ?? 0) + 1}`
        : n.cellule.ref || 'Ligne sans code',
  );

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-origine-montant"
          className="anim-modale w-full max-w-[860px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center justify-between pl-2.5 border-b border-border bg-(--bandeau) text-white">
            <span id="titre-origine-montant" className="font-semibold truncate">
              Origine du montant · {fil.join(' › ')}
            </span>
            <div className="flex items-center gap-1 self-stretch">
              <Aide
                titre="Origine du montant"
                texte="Double-cliquer un poste, un compte ou une ligne pour descendre d'un niveau · le poste et ses comptes, puis le grand livre du compte, puis la pièce. Entrée fait de même au clavier, Échap remonte. Chaque contribution est lue comme le calcul de l'état la lit · le total refait le montant affiché, et un écart se dit au centime."
                source="Sage 100 Comptabilité · zoom des éditions et des états"
              />
              {pile.length > 1 && (
                <button type="button" onClick={precedent} className="px-2 self-stretch hover:bg-white/15">
                  Précédent
                </button>
              )}
              <button
                type="button"
                onClick={onFermer}
                aria-label="Fermer"
                className="self-stretch w-[46px] flex items-center justify-center hover:bg-[#c42b1c]"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-3">
            {niveau.type === 'poste' ? (
              <NiveauPoste
                key={`${niveau.cellule.etat}-${niveau.cellule.ref}-${niveau.cellule.colonne}-${niveau.cellule.ligne ?? ''}`}
                source={source}
                exerciceId={exerciceId}
                cellule={niveau.cellule}
                ouvrirPoste={(c) => setPile((p) => [...p, { type: 'poste', cellule: c }])}
                ouvrirCompte={(compte, ex) => setPile((p) => [...p, { type: 'grand-livre', compte, exerciceId: ex }])}
              />
            ) : (
              <NiveauGrandLivre
                key={`${niveau.compte.compteId}-${niveau.exerciceId}`}
                compte={niveau.compte}
                exerciceId={niveau.exerciceId}
                // Une situation intermédiaire ne lit son exercice que jusqu'à sa date.
                au={source.type === 'etats' && niveau.exerciceId === exerciceId ? source.arreteAu : undefined}
                ouvrirPiece={setFicheId}
              />
            )}
          </div>
        </div>
      </div>
      {ficheId && <FicheImputation ecritureId={ficheId} onFermer={() => setFicheId(null)} />}
    </PortailModale>
  );
}

/** Double-clic et Entrée · le même geste, au pointeur et au clavier. */
function ouvrable(ouvrir: () => void) {
  return {
    tabIndex: 0,
    role: 'button' as const,
    onDoubleClick: ouvrir,
    onKeyDown: (e: ToucheReact) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        ouvrir();
      }
    },
    className: 'cursor-pointer hover:bg-surface-alt focus:bg-sel-soft focus:outline-none',
  };
}

function NiveauPoste({
  source,
  exerciceId,
  cellule,
  ouvrirPoste,
  ouvrirCompte,
}: {
  source: SourceOrigine;
  exerciceId: string;
  cellule: CelluleOrigine;
  ouvrirPoste: (c: CelluleOrigine) => void;
  ouvrirCompte: (compte: ContributionCompte, exerciceId: string) => void;
}) {
  const [origine, setOrigine] = useState<OrigineDuMontant | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const premier = useRef<HTMLTableRowElement>(null);

  // L'adresse, et non les objets, porte la dépendance · un parent qui se
  // redessine ne relance pas la lecture.
  const adresse = adresseOrigine(source, exerciceId, cellule);
  useEffect(() => {
    let actif = true;
    api
      .get<OrigineDuMontant>(adresse)
      .then((o) => actif && setOrigine(o))
      .catch((e) => actif && setErreur(e instanceof ApiError ? e.message : "Lecture de l'origine impossible · serveur injoignable."));
    return () => {
      actif = false;
    };
  }, [adresse]);
  useEffect(() => premier.current?.focus({ preventScroll: true }), [origine]);

  if (erreur) return <div className="text-danger">{erreur}</div>;
  if (!origine) return <div className="text-text-dim">Lecture de l'origine…</div>;

  const exerciceDesComptes = origine.exerciceDesComptesId;
  let premierPose = false;
  const refPremier = () => {
    if (premierPose) return undefined;
    premierPose = true;
    return premier;
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-text-dim mr-2">{origine.ref}</span>
          <span className="font-semibold">{origine.libelle}</span>
        </div>
        <div className="shrink-0 flex items-baseline gap-2">
          <span className="text-text-dim">{LIBELLE_COLONNE[origine.colonne]}</span>
          <span className="font-mono font-semibold" data-montant-origine>
            {montant(origine.montant)}
          </span>
        </div>
      </div>

      {(origine.regle || origine.formule) && (
        <div className="flex items-center gap-1.5 text-text-dim">
          <span className="truncate">{origine.formule ?? origine.regle}</span>
          {(origine.mention || (origine.formule && origine.regle)) && (
            <Aide titre="Lecture du montant" texte={[origine.regle, origine.mention].filter(Boolean).join(' ')} source="Table de correspondance du poste" />
          )}
        </div>
      )}
      {!origine.regle && !origine.formule && origine.mention && origine.nature !== 'HORS_BALANCE' && (
        <div className="flex items-center gap-1.5 text-text-dim">
          <span>Lecture du montant</span>
          <Aide titre="Lecture du montant" texte={origine.mention} source="Table de correspondance du poste" />
        </div>
      )}

      {origine.nature === 'HORS_BALANCE' && (
        <div className="border border-border bg-surface-alt px-3 py-2" data-source-origine>
          {origine.source}
        </div>
      )}

      {origine.nature === 'FORMULE' && (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left w-[56px]">Réf.</th>
              <th className="text-left">Poste</th>
              <th className="text-center w-[40px]">Signe</th>
              <th className="text-right w-[130px]">Montant</th>
            </tr>
          </thead>
          <tbody>
            {origine.composants.map((c, i) => {
              const cible = celluleDuComposant(cellule, c);
              return (
              <tr
                key={c.ligne ?? `${c.ref}-${i}`}
                ref={cible ? refPremier() : undefined}
                {...(cible ? ouvrable(() => ouvrirPoste(cible)) : {})}
                title={cible ? "Double-cliquer pour voir d'où vient ce poste" : c.nonOuvrable}
                data-composant-origine={c.ligne ?? c.ref}
              >
                <td className="font-mono">{cellule.etat === 'note' ? '' : c.ref}</td>
                <td>{c.libelle}</td>
                <td className="text-center">{c.signe === 1 ? '+' : '−'}</td>
                <td className="text-right font-mono">{montant(c.montant)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {origine.nature === 'COMPTES' && origine.groupes.length === 0 && (
        <div className="text-text-dim">Aucun compte de la balance ne porte ce poste sur cet exercice.</div>
      )}

      {origine.nature === 'COMPTES' &&
        origine.groupes.map((g, i) => (
          <table key={`${g.titre}-${i}`} className="w-full">
            <thead>
              <tr>
                <th className="text-left" colSpan={2}>
                  <span className="inline-flex items-center gap-1.5">
                    {g.titre}
                    <Aide titre={g.titre} texte={[g.lecture, g.motif].filter(Boolean).join(' · ')} source="Table de correspondance du poste" />
                  </span>
                </th>
                <th className="text-right w-[130px]">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {g.comptes.map((c) => {
                const ouvrir = () => c.compteId && exerciceDesComptes && ouvrirCompte(c, exerciceDesComptes);
                const peut = Boolean(c.compteId && exerciceDesComptes);
                return (
                  <tr
                    key={c.numero}
                    ref={peut ? refPremier() : undefined}
                    {...(peut ? ouvrable(ouvrir) : {})}
                    title={
                      peut
                        ? 'Double-cliquer pour ouvrir le grand livre du compte'
                        : !c.compteId
                          ? "Ce numéro n'est plus au plan du dossier"
                          : "Aucun exercice du dossier ne porte cette colonne"
                    }
                    data-compte-origine={c.numero}
                  >
                    <td className="font-mono w-[96px]">{c.numero}</td>
                    <td>{c.intitule}</td>
                    <td className="text-right font-mono">{montant(c.montant)}</td>
                  </tr>
                );
              })}
              {origine.groupes.length > 1 && (
                <tr className="font-semibold">
                  <td colSpan={2}>Sous-total</td>
                  <td className="text-right font-mono">{montant(g.sousTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        ))}

      {origine.nature !== 'HORS_BALANCE' && (
        <table className="w-full">
          <tbody>
            <tr className="font-semibold bg-(--a-50)">
              <td>Total</td>
              <td className="text-right font-mono w-[130px]" data-total-origine>
                {montant(origine.total)}
              </td>
            </tr>
            {origine.ecart !== null && origine.ecart !== 0 && (
              <tr className="text-danger font-semibold" data-ecart-origine>
                <td>Écart avec le montant affiché</td>
                <td className="text-right font-mono">{montant(origine.ecart)}</td>
              </tr>
            )}
            {origine.total === null && (
              <tr className="text-text-dim">
                <td colSpan={2}>Un poste additionné est laissé vide · le total ne se refait pas.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface GrandLivreLu {
  compte: { id: string; numero: string; intitule: string };
  lignes: LigneGrandLivre[];
  soldeFinal: number;
}

function NiveauGrandLivre({
  compte,
  exerciceId,
  au,
  ouvrirPiece,
}: {
  compte: ContributionCompte;
  exerciceId: string;
  au?: string;
  ouvrirPiece: (ecritureId: string) => void;
}) {
  const [lu, setLu] = useState<GrandLivreLu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const premier = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    let actif = true;
    api
      .get<GrandLivreLu>(adresseGrandLivre(compte.compteId!, exerciceId, au))
      .then((r) => actif && setLu(r))
      .catch((e) => actif && setErreur(e instanceof ApiError ? e.message : 'Lecture du grand livre impossible · serveur injoignable.'));
    return () => {
      actif = false;
    };
  }, [compte.compteId, exerciceId, au]);
  useEffect(() => premier.current?.focus({ preventScroll: true }), [lu]);

  if (erreur) return <div className="text-danger">{erreur}</div>;
  if (!lu) return <div className="text-text-dim">Lecture du grand livre…</div>;

  const horsEtats = lu.lignes.filter((l) => horsDesEtats(l) !== null).length;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono mr-2">{lu.compte.numero}</span>
          <span className="font-semibold">{lu.compte.intitule}</span>
        </div>
        <div className="shrink-0 flex items-baseline gap-2">
          <span className="text-text-dim">Contribution au montant</span>
          <span className="font-mono font-semibold">{montant(compte.montant)}</span>
          <Aide
            titre="Grand livre et contribution"
            texte="Le grand livre porte tout l'exercice, brouillard compris. Les états ne lisent que le livre-journal (écritures validées), avant l'écriture qui solde les comptes de gestion, et la contribution suit le sens et la colonne que le poste lit (solde, mouvements, variation). Les lignes que les états ne lisent pas sont marquées."
            source="AUDCIF art. 22, 2° ; art. 19"
          />
        </div>
      </div>
      {lu.lignes.length === 0 ? (
        <div className="text-text-dim">Aucune ligne sur ce compte dans l'exercice.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr>
                <th className="text-left w-[78px]">Date</th>
                <th className="text-left w-[48px]">Jnl</th>
                <th className="text-left w-[56px]">Pièce</th>
                <th className="text-left">Libellé</th>
                <th className="text-right w-[100px]">Débit</th>
                <th className="text-right w-[100px]">Crédit</th>
                <th className="text-right w-[110px]">Solde</th>
              </tr>
            </thead>
            <tbody>
              {lu.lignes.map((l, i) => {
                const hors = horsDesEtats(l);
                const peut = Boolean(l.ecritureId);
                return (
                  <tr
                    key={l.id}
                    ref={i === 0 && peut ? premier : undefined}
                    {...(peut ? ouvrable(() => ouvrirPiece(l.ecritureId!)) : {})}
                    title={peut ? 'Double-cliquer pour ouvrir la pièce' : undefined}
                    data-ligne-grand-livre
                  >
                    <td>{l.date.slice(0, 10).split('-').reverse().join('/')}</td>
                    <td>{l.journalCode}</td>
                    <td>{l.numeroPiece ?? ''}</td>
                    <td className={hors ? 'italic' : ''}>
                      {l.libelle}
                      {hors && <span className="ml-2 text-text-dim">({hors})</span>}
                    </td>
                    <td className="text-right font-mono">{l.debit ? montant(l.debit) : ''}</td>
                    <td className="text-right font-mono">{l.credit ? montant(l.credit) : ''}</td>
                    <td className="text-right font-mono">{montant(l.soldeProgressif)}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold bg-(--a-50)">
                <td colSpan={6}>{au ? `Solde au ${au.split('-').reverse().join('/')}` : "Solde de l'exercice"}</td>
                <td className="text-right font-mono">{montant(lu.soldeFinal)}</td>
              </tr>
              {horsEtats > 0 && (
                <tr className="font-semibold">
                  <td colSpan={6}>
                    Solde des lignes lues par les états · {horsEtats} ligne{horsEtats > 1 ? 's' : ''} hors des états
                  </td>
                  <td className="text-right font-mono" data-solde-lu-par-les-etats>
                    {montant(soldeLuParLesEtats(lu.lignes))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Les attributs d'une cellule de montant d'état · double-clic et Entrée
 * ouvrent son origine. Le clic simple reste à la ligne (le dépliage des
 * comptes du SYSCOHADA), la touche Entrée est gardée par la cellule.
 */
export function celluleOrigine(ouvrir: () => void, cle: string) {
  return {
    tabIndex: 0,
    'data-origine': cle,
    title: "Double-cliquer pour voir d'où vient ce montant",
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      ouvrir();
    },
    onKeyDown: (e: ToucheReact) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        ouvrir();
      }
    },
  };
}
