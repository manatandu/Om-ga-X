import { useEffect, useRef, useState } from 'react';
import { PortailModale } from './PortailModale';
import { ecouterEchap } from '../lib/echap';
import { TraitementsImmobilisation } from './TraitementsImmobilisation';
import { FicheImmobilisationGeneral, type PropositionDuplication } from './FicheImmobilisationGeneral';

export type OngletFiche = 'general' | 'traitements';

const ONGLETS_FICHE: readonly { cle: OngletFiche; libelle: string }[] = [
  { cle: 'general', libelle: 'Général' },
  { cle: 'traitements', libelle: 'Traitements' },
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
  const fermer = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      ecouterEchap(() => {
        onFermer();
        return true;
      }),
    [onFermer],
  );
  useEffect(() => fermer.current?.focus({ preventScroll: true }), []);

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={onFermer}>
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
              onClick={onFermer}
              className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-danger text-[12px]"
            >
              ✕
            </button>
          </div>
          <div role="tablist" className="flex gap-1 px-3.5 pt-2 border-b border-border">
            {ONGLETS_FICHE.map((o) => (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={onglet === o.cle}
                onClick={() => setOnglet(o.cle)}
                className={`onglet ${onglet === o.cle ? 'onglet-actif' : ''}`}
              >
                {o.libelle}
              </button>
            ))}
          </div>
          <div className="p-3.5" role="tabpanel">
            {onglet === 'general' && (
              <FicheImmobilisationGeneral bien={bien} onFait={onFait} onDupliquer={onDupliquer} onSupprime={onSupprime} />
            )}
            {onglet === 'traitements' && <TraitementsImmobilisation bien={bien} onFait={onFait} />}
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
