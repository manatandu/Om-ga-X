import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useExercice } from '../lib/exercice';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import { Aide } from '../components/chrome/Aide';
import { montant } from '../lib/montants';
import { LIBELLES_ETAT_CONCORDANCE, type Concordance, type EtatConcordance } from '../lib/concordance';

/**
 * CONCORDANCE DES MODULES AVEC LA COMPTABILITÉ (ligne microfina-m1, idée 12 ·
 * Microfina++, M p. 136). Une LECTURE · chaque famille relit la
 * confrontation que son module tient (`src/modules/concordance/`), et l'écart
 * se règle dans le module, que la ligne ouvre. « Non calculé » n'est jamais
 * un zéro, ni une concordance.
 */

const CLASSE_ETAT: Record<EtatConcordance, string> = {
  CONCORDE: 'text-positive bg-positive-soft border-positive/40',
  ECART: 'text-danger bg-danger-soft border-danger/40',
  NON_CALCULE: 'text-warning bg-warning-soft border-warning/40',
  SANS_OBJET: 'text-text-dim border-border',
};

export function ConcordancePage() {
  const { exerciceCourant } = useExercice();
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState<Concordance | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciceCourant) return;
    let vivant = true;
    setDonnees(null);
    setErreur(null);
    api.get<Concordance>(`/concordance?exerciceId=${exerciceCourant.id}`).then(
      (d) => vivant && setDonnees(d),
      (e) => vivant && setErreur(e instanceof ApiError ? e.message : 'Concordance illisible · serveur injoignable.'),
    );
    return () => {
      vivant = false;
    };
  }, [exerciceCourant?.id]);

  return (
    <div className="p-2 text-[11.5px]">
      <EnteteImpression titre="Concordance des modules avec la comptabilité" />
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        {donnees ? (
          <span>
            Exercice du {new Date(donnees.exercice.dateDebut).toLocaleDateString('fr-FR')} au{' '}
            {new Date(donnees.exercice.dateFin).toLocaleDateString('fr-FR')} · {donnees.synthese.concordent} concordante(s),{' '}
            <span className={donnees.synthese.ecarts > 0 ? 'text-danger font-semibold' : undefined}>{donnees.synthese.ecarts} en écart</span>,{' '}
            <span className={donnees.synthese.nonCalculees > 0 ? 'text-warning font-semibold' : undefined}>
              {donnees.synthese.nonCalculees} non calculée(s)
            </span>
            , {donnees.synthese.sansObjet} sans objet
          </span>
        ) : (
          <span />
        )}
        <Aide
          titre="Concordance des modules"
          texte="Chaque famille relit la confrontation que son module tient déjà · le registre des biens face à la balance, le registre des provisions face à ses comptes, les créances douteuses face au 416 et au 491, les cumuls analytiques face aux mouvements généraux, le dernier relevé de chaque banque face à son solde pointé. L'écart est la comptabilité moins le module. Rien n'est corrigé ici · un écart se règle dans le module, que le lien ouvre. Une famille non calculée dit pourquoi ; elle ne concorde pas pour autant."
          source="AUDCIF art. 42 et 69 · SYCEBNL art. 16, 2) · convention d'OmegaX"
        />
      </div>

      {erreur && <div className="mb-2 text-danger bg-danger-soft border border-danger/30 rounded-[3px] px-2.5 py-1.5">{erreur}</div>}
      {!exerciceCourant && <div className="text-text-dim">Aucun exercice choisi.</div>}
      {exerciceCourant && !donnees && !erreur && <div className="text-text-dim">Chargement…</div>}

      {donnees?.familles.map((f) => (
        <section key={f.cle} className="border border-border bg-surface rounded-[4px] mb-2.5 eviter-coupure">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border flex-wrap">
            <span className="flex items-center gap-2">
              <span className="font-bold">{f.libelle}</span>
              <span className={`text-[10.5px] font-bold rounded-[3px] px-1 border ${CLASSE_ETAT[f.etat]}`}>{LIBELLES_ETAT_CONCORDANCE[f.etat]}</span>
            </span>
            <button type="button" onClick={() => navigate(f.chemin)} className="text-sel hover:underline ecran-seul" title={f.source}>
              {f.ecran}
            </button>
          </div>
          {f.motif && <div className={`px-3 py-1.5 ${f.etat === 'NON_CALCULE' ? 'text-warning' : 'text-text-dim'}`}>{f.motif}</div>}
          {f.lignes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-1 w-[150px]">Référence</th>
                    <th className="text-left px-3 py-1">Intitulé</th>
                    <th className="text-right px-3 py-1 w-[130px]">Module</th>
                    <th className="text-right px-3 py-1 w-[130px]">Comptabilité</th>
                    <th className="text-right px-3 py-1 w-[120px]">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {f.lignes.map((l) => (
                    <tr key={l.reference}>
                      <td className="px-3 py-1">{l.reference}</td>
                      <td className="px-3 py-1 truncate">{l.intitule}</td>
                      <td className="px-3 py-1 text-right">{l.module === null ? 'non calculé' : montant(l.module)}</td>
                      <td className="px-3 py-1 text-right">{l.comptabilite === null ? 'non calculé' : montant(l.comptabilite)}</td>
                      <td className={`px-3 py-1 text-right ${l.ecart !== null && l.ecart !== 0 ? 'text-danger font-semibold' : ''}`}>
                        {l.ecart === null ? 'non calculé' : l.ecart === 0 ? '·' : montant(l.ecart)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {f.mentions.length > 0 && (
            <ul className="px-3 py-1.5 text-text-dim list-disc list-inside border-t border-border/50">
              {f.mentions.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
