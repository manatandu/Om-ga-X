import { useEffect, useMemo, useRef, useState } from 'react';
import { ecouterEchap } from '../../lib/echap';
import { PortailModale } from '../PortailModale';
import { rechercherCommandes, type CommandeDuMenu } from './commandes-du-menu';

/**
 * ALLER À UNE FONCTION PAR SON NOM (ligne gl-saisie, fonction 97 · Sage i7,
 * F7). Une zone de frappe et la liste des commandes du menu qui répondent ·
 * flèches pour choisir, Entrée pour ouvrir, Échap pour fermer. Les commandes
 * viennent du menu que l'utilisateur voit (`commandes-du-menu.ts`).
 */
export function AllerAFonction({ commandes, onFermer }: { commandes: CommandeDuMenu[]; onFermer: () => void }) {
  const [frappe, setFrappe] = useState('');
  const [index, setIndex] = useState(0);
  const zone = useRef<HTMLInputElement>(null);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  useEffect(() => zone.current?.focus({ preventScroll: true }), []);
  useEffect(
    () =>
      ecouterEchap(() => {
        fermerRef.current();
        return true;
      }),
    [],
  );
  const trouvees = useMemo(() => rechercherCommandes(commandes, frappe), [commandes, frappe]);
  const courant = Math.min(index, Math.max(trouvees.length - 1, 0));
  const ouvrir = (c: CommandeDuMenu | undefined) => {
    if (!c) return;
    onFermer();
    c.executer();
  };

  return (
    <PortailModale>
      <div
        className="anim-voile fixed inset-0 z-50 bg-black/25 flex items-start justify-center p-4 pt-[12vh]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onFermer();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aller à une fonction"
          className="anim-modale w-full max-w-[560px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[12px]"
        >
          <div className="h-[32px] flex items-center px-2.5 border-b border-border">Aller à une fonction</div>
          <div className="p-3 space-y-2">
            <input
              ref={zone}
              value={frappe}
              role="combobox"
              aria-expanded={trouvees.length > 0}
              aria-controls="aller-a-fonction-liste"
              aria-activedescendant={trouvees.length > 0 ? `aller-a-fonction-${courant}` : undefined}
              aria-label="Nom de la fonction"
              placeholder="Tapez le nom d’une commande (balance, relances, lettrage…)"
              onChange={(e) => {
                setFrappe(e.target.value);
                setIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIndex((i) => Math.min(i + 1, trouvees.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  ouvrir(trouvees[courant]);
                }
              }}
              className="w-full border border-border-dark px-2 py-1.5"
            />
            {frappe.trim() !== '' && trouvees.length === 0 && (
              <div className="text-text-dim px-1">Aucune commande du menu ne porte ce nom.</div>
            )}
            {trouvees.length > 0 && (
              <ul id="aller-a-fonction-liste" role="listbox" className="border border-border">
                {trouvees.map((c, i) => (
                  <li
                    key={`${c.chemin}|${c.libelle}`}
                    id={`aller-a-fonction-${i}`}
                    role="option"
                    aria-selected={i === courant}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      ouvrir(c);
                    }}
                    onMouseEnter={() => setIndex(i)}
                    className={`px-2.5 py-1 flex items-baseline justify-between gap-3 cursor-default ${
                      i === courant ? 'bg-sel text-white' : 'hover:bg-chrome-alt'
                    }`}
                  >
                    <span className="truncate">{c.libelle}</span>
                    <span className={`shrink-0 text-[11px] ${i === courant ? 'text-white/80' : 'text-text-dim'}`}>{c.chemin}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
