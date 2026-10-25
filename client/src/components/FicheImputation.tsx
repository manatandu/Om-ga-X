import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { FicheImputation as Fiche } from '../lib/types';
import { PortailModale } from './PortailModale';
import { Aide } from './chrome/Aide';
import { montantOuVide as montant } from '../lib/montants';
import { ecouterEchap } from '../lib/echap';

/**
 * LA FICHE D'IMPUTATION (ligne microfina-m1, idée 1) · une pièce et ses
 * auteurs, telle qu'elle s'imprime. Microfina++ y porte « Saisie par » et
 * « Approuvée par » (M p. 154) ; la fiche type du CPCC porte le comptable et
 * « paraphe, visa du chef comptable » (organisation-comptable-cpcc, ch. 2,
 * § 2.6.1). Les auteurs sont servis par le serveur, résolus en courriel ; un
 * visa qui ne couvre plus le contenu présent le dit, jamais une approbation
 * affirmée qui ne vaut plus.
 */

const CLASSE_IMPRESSION = 'imprime-fiche';

const jour = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR') : null);
const instant = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('fr-FR') : null);

export function FicheImputation({ ecritureId, onFermer }: { ecritureId: string; onFermer: () => void }) {
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    setFiche(null);
    setErreur(null);
    api.get<Fiche>(`/circuit-visa/ecritures/${ecritureId}/fiche`).then(
      (f) => vivant && setFiche(f),
      (e) => vivant && setErreur(e instanceof ApiError ? e.message : 'Fiche illisible · serveur injoignable.'),
    );
    return () => {
      vivant = false;
    };
  }, [ecritureId]);

  useEffect(
    () =>
      ecouterEchap(() => {
        onFermer();
        return true;
      }),
    [onFermer],
  );

  // L'impression ne porte que la fiche · le reste de l'espace de travail se
  // retire le temps de l'impression, et revient ensuite.
  const imprimer = () => {
    document.body.classList.add(CLASSE_IMPRESSION);
    const retirer = () => {
      document.body.classList.remove(CLASSE_IMPRESSION);
      window.removeEventListener('afterprint', retirer);
    };
    window.addEventListener('afterprint', retirer);
    window.print();
  };

  const totalDebit = fiche?.lignes.reduce((t, l) => t + l.debit, 0) ?? 0;
  const totalCredit = fiche?.lignes.reduce((t, l) => t + l.credit, 0) ?? 0;

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 anim-voile voile-fiche">
        <div
          role="dialog"
          aria-label="Fiche d'imputation"
          className="w-full max-w-[820px] bg-surface border border-border rounded-[4px] overflow-hidden shadow-flottante anim-modale modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <div className="h-[32px] flex items-center justify-between px-3 bg-surface text-text border-b border-border text-[11.5px]">
            <span className="font-semibold">Fiche d’imputation</span>
            <span className="flex items-center gap-2 ecran-seul">
              <Aide
                titre="Fiche d'imputation"
                texte="La pièce telle qu'elle s'imprime, avec ses auteurs · qui l'a saisie, qui en a écrit le dernier contenu quand ce n'est plus la saisie, qui l'a visée et sur quel contenu, qui l'a validée, et le second regard nominatif porté hors du logiciel. Un utilisateur retiré du dossier est nommé comme tel."
                source="CPCC, ch. 2, § 2.6.1 · AUDCIF art. 22, 1° et 6°"
              />
              <button type="button" onClick={imprimer} disabled={!fiche} className="border border-border px-2 py-0.5 hover:bg-chrome-alt disabled:opacity-50">
                Imprimer
              </button>
              <button type="button" onClick={onFermer} className="border border-border px-2 py-0.5 hover:bg-chrome-alt">
                Fermer
              </button>
            </span>
          </div>
          <div className="p-3 text-[11.5px] flex flex-col gap-3">
            {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5">{erreur}</div>}
            {!fiche && !erreur && <div className="text-text-dim">Chargement…</div>}
            {fiche && (
              <>
                <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-x-3 gap-y-1">
                  <span className="text-text-dim">Journal</span>
                  <span>
                    {fiche.journal.code} · {fiche.journal.intitule}
                  </span>
                  <span className="text-text-dim">N° de pièce</span>
                  <span>{fiche.numeroPiece ?? '·'}</span>
                  <span className="text-text-dim">Date</span>
                  <span>{jour(fiche.date)}</span>
                  <span className="text-text-dim">Date de valeur</span>
                  <span>{jour(fiche.dateValeur) ?? '·'}</span>
                  <span className="text-text-dim">Libellé</span>
                  <span className="col-span-3">{fiche.libelle}</span>
                  <span className="text-text-dim">Référence</span>
                  <span>{fiche.reference ?? '·'}</span>
                  <span className="text-text-dim">Nature</span>
                  <span>
                    {fiche.natureLibelle}
                    {fiche.facture ? ` ${fiche.facture}` : ''}
                  </span>
                  <span className="text-text-dim">Statut</span>
                  <span>{fiche.statut === 'VALIDEE' ? 'Validée' : fiche.statut === 'BROUILLARD' ? 'Brouillard' : fiche.statut}</span>
                </div>

                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1 w-[90px]">Compte</th>
                      <th className="text-left px-2 py-1">Intitulé · libellé</th>
                      <th className="text-left px-2 py-1 w-[90px]">Échéance</th>
                      <th className="text-left px-2 py-1 w-[90px]">Sections</th>
                      <th className="text-right px-2 py-1 w-[110px]">Débit</th>
                      <th className="text-right px-2 py-1 w-[110px]">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.lignes.map((l, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">{l.compte}</td>
                        <td className="px-2 py-1">
                          {l.intitule}
                          {l.libelle ? <span className="text-text-dim"> · {l.libelle}</span> : null}
                        </td>
                        <td className="px-2 py-1">{jour(l.echeance) ?? ''}</td>
                        <td className="px-2 py-1">{l.sections.join(', ')}</td>
                        <td className="px-2 py-1 text-right">{montant(l.debit)}</td>
                        <td className="px-2 py-1 text-right">{montant(l.credit)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td colSpan={4} className="px-2 py-1">
                        Total
                      </td>
                      <td className="px-2 py-1 text-right">{montant(totalDebit)}</td>
                      <td className="px-2 py-1 text-right">{montant(totalCredit)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-[150px_1fr_160px] gap-x-3 gap-y-1 border-t border-border pt-2">
                  <span className="font-semibold">Saisie par</span>
                  <span>{fiche.saisie.par ?? 'non connu'}</span>
                  <span>{instant(fiche.saisie.le)}</span>
                  {fiche.dernierContenu && (
                    <>
                      <span className="font-semibold">Dernier contenu par</span>
                      <span>{fiche.dernierContenu.auteurConnu ? fiche.dernierContenu.par : 'auteur non connu'}</span>
                      <span>{instant(fiche.dernierContenu.le)}</span>
                    </>
                  )}
                  <span className="font-semibold">Visée par</span>
                  <span>
                    {fiche.visa ? fiche.visa.par : 'non visée'}
                    {fiche.visa && !fiche.visa.surLeContenuPresent && (
                      <span className="text-danger"> · le contenu a changé depuis le visa</span>
                    )}
                  </span>
                  <span>{fiche.visa ? instant(fiche.visa.le) : ''}</span>
                  <span className="font-semibold">Validée par</span>
                  <span>{fiche.validation ? fiche.validation.par : 'non validée'}</span>
                  <span>{fiche.validation ? instant(fiche.validation.le) : ''}</span>
                  {fiche.secondRegard && (
                    <>
                      <span className="font-semibold">Second regard</span>
                      <span className="col-span-2">
                        {fiche.secondRegard.nom} · {fiche.secondRegard.motif}
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
