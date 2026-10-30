import { useCallback, useEffect, useRef, useState } from 'react';
import { PortailModale } from './PortailModale';
import { ecouterEchap } from '../lib/echap';
import { useGardeFermeture } from '../lib/fenetres';
import { TraitementsImmobilisation } from './TraitementsImmobilisation';
import { FicheImmobilisationGeneral, type PropositionDuplication } from './FicheImmobilisationGeneral';
import { VoletPiecesJointes } from './PiecesJointes';
import { useAuth } from '../lib/auth';
import { DetenteurImmobilisation } from './DetentionsBiens';
import { detentionsLisiblesPar } from '../lib/detention-bien';

export type OngletFiche = 'general' | 'traitements' | 'documents' | 'detenteur';

const ONGLETS_FICHE: readonly { cle: OngletFiche; libelle: string }[] = [
  { cle: 'general', libelle: 'Général' },
  { cle: 'traitements', libelle: 'Traitements' },
  // Ligne sage-l6, fonction n° 22 · le volet Documents de la fiche du bien (Sage i7).
  { cle: 'documents', libelle: 'Documents' },
  // Ligne Microfina M4 · le salarié qui détient le bien, et l'historique.
  { cle: 'detenteur', libelle: 'Détenteur' },
];

/**
 * LA FICHE D'UN BIEN, en fenêtre posée sur la liste (ligne sage-l4) · ce qui
 * porte sur la fiche elle-même et sur ses traitements, à côté des gestes de
 * la ligne. Échap ferme la fiche, et elle seule (audit final F177).
 */
export function FicheImmobilisation({
  bien,
  onFermer,
  onFait,
  onDupliquer,
  onSupprime,
}: {
  bien: { id: string; designation: string };
  onFermer: () => void;
  onFait: (message: string) => void;
  onDupliquer: (proposition: PropositionDuplication) => void;
  onSupprime: (message: string) => void;
}) {
  const [onglet, setOnglet] = useState<OngletFiche>('general');
  const { peutEcrire, utilisateur } = useAuth();
  // Le volet ne se montre qu'à qui le serveur l'ouvre (detention-bien.controller.ts).
  const detentionsLisibles = detentionsLisiblesPar(utilisateur?.role);
  const fermer = useRef<HTMLButtonElement>(null);
  // LA FERMETURE SE GARDE (relecture de la ligne · CLAUDE.md, Échap et la
  // fermeture, F177) · un envoi en cours la tient ; une saisie non
  // enregistrée la fait confirmer, ici comme pour la fenêtre qui porte la fiche.
  const [travail, setTravail] = useState({ occupe: false, nonEnregistre: false });
  const travailCourant = useRef(travail);
  travailCourant.current = travail;
  const motifGarde = travail.occupe
    ? 'Un enregistrement de la fiche est en cours.'
    : travail.nonEnregistre
      ? 'Des modifications de la fiche ne sont pas enregistrées · elles seraient perdues.'
      : null;
  useGardeFermeture(motifGarde);
  const peutQuitter = useCallback(() => {
    const t = travailCourant.current;
    if (t.occupe) return false;
    return !t.nonEnregistre || window.confirm('Des modifications de la fiche ne sont pas enregistrées · elles seraient perdues.\n\nContinuer quand même ?');
  }, []);
  const fermerSiLibre = useCallback(() => {
    if (peutQuitter()) onFermer();
  }, [peutQuitter, onFermer]);
  const changerDOnglet = (o: OngletFiche) => {
    if (o === onglet || !peutQuitter()) return;
    setTravail({ occupe: false, nonEnregistre: false });
    setOnglet(o);
  };

  useEffect(
    () =>
      ecouterEchap(() => {
        fermerSiLibre();
        return true;
      }),
    [fermerSiLibre],
  );
  useEffect(() => fermer.current?.focus({ preventScroll: true }), []);

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={fermerSiLibre}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Fiche · ${bien.designation}`}
          className="anim-modale w-[760px] max-w-full max-h-full overflow-auto rounded-[4px] bg-surface border border-border-dark shadow-dominante"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3.5 h-[32px] bg-surface text-text border-b border-border">
            <span className="text-[11.5px] font-semibold truncate">Fiche · {bien.designation}</span>
            <button
              ref={fermer}
              type="button"
              aria-label="Fermer la fiche"
              onClick={fermerSiLibre}
              className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-danger text-[12px]"
            >
              ✕
            </button>
          </div>
          <div role="tablist" className="flex gap-1 px-3.5 pt-2 border-b border-border">
            {ONGLETS_FICHE.filter((o) => o.cle !== 'detenteur' || detentionsLisibles).map((o) => (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={onglet === o.cle}
                onClick={() => changerDOnglet(o.cle)}
                className={`onglet ${onglet === o.cle ? 'onglet-actif' : ''}`}
              >
                {o.libelle}
              </button>
            ))}
          </div>
          <div className="p-3.5" role="tabpanel">
            {onglet === 'general' && (
              <FicheImmobilisationGeneral bien={bien} onFait={onFait} onDupliquer={onDupliquer} onSupprime={onSupprime} onEtatTravail={setTravail} />
            )}
            {onglet === 'traitements' && <TraitementsImmobilisation bien={bien} onFait={onFait} onSupprime={onSupprime} onEtatTravail={setTravail} />}
            {onglet === 'detenteur' && detentionsLisibles && (
              <DetenteurImmobilisation bien={bien} onFait={onFait} onEtatTravail={setTravail} />
            )}
            {onglet === 'documents' && (
              <VoletPiecesJointes
                objet="IMMOBILISATION"
                objetId={bien.id}
                peutEcrire={peutEcrire}
                onOccupe={(occupe) => setTravail({ occupe, nonEnregistre: false })}
              />
            )}
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
