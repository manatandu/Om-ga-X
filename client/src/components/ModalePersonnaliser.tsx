import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ecouterEchap } from '../lib/echap';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';

/**
 * PERSONNALISER UN COMPTE DU PLAN (décision de Manasse du 2026-10-09 ·
 * « aller dans plan de compte, choisir le numéro de compte, puis le
 * personnaliser »). Deux gestes, et le cabinet choisit · ADOPTER le compte du
 * plan tel quel (même numéro, son intitulé à lui), ou OUVRIR UN SOUS-COMPTE
 * sous lui (52110000 → 52110001 « Rawbank »), dont le numéro est proposé par
 * le serveur et reste modifiable. Seul un compte personnalisé se saisit et se
 * rattache à un tiers ou à un journal · le sous-compte reprend les réglages
 * du compte du plan (lettrage, report, taxe par défaut).
 *
 * Rien n'est décidé ici · le serveur rejuge le numéro et l'intitulé, et son
 * refus s'affiche tel quel.
 */
export function ModalePersonnaliser({
  compte,
  onFermer,
  onFait,
}: {
  compte: { id: string; numero: string; intitule: string; estRetenu?: boolean; utilise?: boolean; subdivise?: boolean };
  onFermer: () => void;
  onFait: (message: string) => Promise<void> | void;
}) {
  // La structure du plan est réservée à l'administrateur (`@Roles` des routes
  // /comptes) · la boîte ne s'ouvre que pour lui, et ne valide rien sans lui.
  const { estAdmin } = useAuth();
  const dejaPersonnalise = !!compte.estRetenu || !!compte.utilise;
  // Un compte déjà personnalisé ne s'adopte plus · on y ouvre un sous-compte.
  // Un compte SUBDIVISÉ non plus · la saisie va à ses sous-comptes, et
  // l'adopter le dirait admis alors qu'elle le refuse encore.
  const adoptionFermee = dejaPersonnalise || !!compte.subdivise;
  const [geste, setGeste] = useState<'ADOPTER' | 'SOUS_COMPTE'>(adoptionFermee ? 'SOUS_COMPTE' : 'ADOPTER');
  const [intituleAdopte, setIntituleAdopte] = useState(compte.intitule);
  const [numero, setNumero] = useState('');
  const [intituleSous, setIntituleSous] = useState(compte.intitule);
  // null = pas encore lu ; une lecture échouée se dit, jamais lue comme « aucun numéro ».
  const [proposition, setProposition] = useState<{ numero: string | null; motif: string | null } | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const premierChamp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let actif = true;
    api
      .get<{ numero: string | null; intitule: string; motif: string | null }>(`/comptes/${compte.id}/sous-compte-propose`)
      .then((r) => {
        if (!actif) return;
        setProposition({ numero: r.numero, motif: r.motif });
        // Ce que l'administrateur a déjà tapé n'est jamais écrasé.
        if (r.numero) setNumero((tape) => tape || (r.numero as string));
      })
      .catch((e) => {
        if (actif) setErreurLecture(e instanceof ApiError ? e.message : 'Lecture du numéro proposé impossible');
      });
    return () => {
      actif = false;
    };
  }, [compte.id]);

  useEffect(() => premierChamp.current?.focus({ preventScroll: true }), [geste]);
  // Échap ferme, sauf pendant l'envoi · la réponse arriverait sur une boîte
  // fermée. UN SEUL abonnement, qui lit l'état par des références · `onFermer`
  // change à chaque rendu du parent.
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

  const valider = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      if (geste === 'ADOPTER') {
        await api.patch(`/comptes/${compte.id}`, {
          estRetenu: true,
          ...(intituleAdopte.trim() && intituleAdopte.trim() !== compte.intitule ? { intitule: intituleAdopte.trim() } : {}),
        });
        await onFait(`Le compte ${compte.numero} est personnalisé.`);
      } else {
        await api.post('/comptes', { numero: numero.trim(), intitule: intituleSous.trim(), typeCompte: 'DETAIL' });
        // Le numéro reste libre · le message ne prétend pas qu'il est sous ce compte.
        await onFait(`Le compte ${numero.trim()} ${intituleSous.trim()} est ouvert.`);
      }
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Personnalisation impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const sousCompteImpossible = proposition !== null && proposition.numero === null;
  const formulaireValide =
    estAdmin &&
    !envoi &&
    (geste === 'ADOPTER'
      ? !adoptionFermee && intituleAdopte.trim() !== ''
      : !sousCompteImpossible && /^\d+$/.test(numero.trim()) && intituleSous.trim() !== '');

  return (
    <PortailModale>
      <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-personnaliser"
          onSubmit={(e) => {
            e.preventDefault();
            if (formulaireValide) void valider();
          }}
          className="anim-modale w-full max-w-[480px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center justify-between px-2.5 border-b border-border">
            <span id="titre-personnaliser">
              Personnaliser le compte {compte.numero}
            </span>
            <div className="flex items-center gap-2">
              <Aide
                titre="Compte personnalisé"
                texte="Seuls les comptes personnalisés du dossier se saisissent et se rattachent à un tiers ou à un journal. Adopter garde le numéro du plan, avec l'intitulé du cabinet ; un sous-compte s'ouvre sous lui et en reprend les réglages. Un compte qu'une écriture automatique, un journal, un tiers ou un taux de taxe utilise est personnalisé d'office."
                source="AUDCIF art. 18, al. 3 (l'entité peut ouvrir toutes subdivisions nécessaires) · règle d'organisation d'OmegaX"
              />
              <button
                type="button"
                onClick={onFermer}
                disabled={envoi}
                aria-label="Fermer"
                className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c] disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <fieldset className="space-y-1.5">
              <legend className="sr-only">Geste</legend>
              <label className={`flex items-center gap-2 ${adoptionFermee ? 'opacity-50' : ''}`}>
                <input
                  type="radio"
                  name="geste-personnaliser"
                  checked={geste === 'ADOPTER'}
                  disabled={adoptionFermee}
                  onChange={() => setGeste('ADOPTER')}
                />
                <span>
                  Adopter ce compte tel quel
                  {dejaPersonnalise ? ' · déjà personnalisé' : compte.subdivise ? ' · subdivisé, la saisie va à ses sous-comptes' : ''}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="geste-personnaliser" checked={geste === 'SOUS_COMPTE'} onChange={() => setGeste('SOUS_COMPTE')} />
                <span>Ouvrir un sous-compte sous lui</span>
              </label>
            </fieldset>

            {geste === 'ADOPTER' ? (
              <div className="grid grid-cols-[90px_1fr] items-center gap-x-3 gap-y-2">
                <span className="text-right">Numéro :</span>
                <span className="px-2.5 py-1.5">{compte.numero}</span>
                <label htmlFor="intitule-adopte" className="text-right">Intitulé :</label>
                <input
                  id="intitule-adopte"
                  ref={premierChamp}
                  value={intituleAdopte}
                  onChange={(e) => setIntituleAdopte(e.target.value)}
                  className="border border-border-dark px-2.5 py-1.5 text-[12px]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-[90px_1fr] items-center gap-x-3 gap-y-2">
                <label htmlFor="numero-sous-compte" className="text-right">Numéro :</label>
                <input
                  id="numero-sous-compte"
                  ref={premierChamp}
                  inputMode="numeric"
                  value={numero}
                  disabled={sousCompteImpossible}
                  placeholder={proposition === null && !erreurLecture ? 'Lecture…' : ''}
                  onChange={(e) => setNumero(e.target.value)}
                  aria-describedby={sousCompteImpossible || erreurLecture ? 'motif-sous-compte' : undefined}
                  className="border border-border-dark px-2.5 py-1.5 text-[12px]"
                />
                <label htmlFor="intitule-sous-compte" className="text-right">Intitulé :</label>
                <input
                  id="intitule-sous-compte"
                  value={intituleSous}
                  disabled={sousCompteImpossible}
                  onChange={(e) => setIntituleSous(e.target.value)}
                  className="border border-border-dark px-2.5 py-1.5 text-[12px]"
                />
                {(sousCompteImpossible || erreurLecture) && (
                  <p id="motif-sous-compte" role="status" className="col-span-2 text-warning">
                    {erreurLecture ?? proposition?.motif}
                  </p>
                )}
              </div>
            )}

            {erreur && (
              <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-1.5">
                {erreur}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onFermer}
                disabled={envoi}
                className="border border-border-dark bg-chrome hover:bg-chrome-alt px-4 py-1.5 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!formulaireValide}
                className="bg-sel text-white px-4 py-1.5 font-semibold disabled:opacity-50"
              >
                {envoi ? 'Enregistrement…' : geste === 'ADOPTER' ? 'Adopter le compte' : 'Ouvrir le sous-compte'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PortailModale>
  );
}
