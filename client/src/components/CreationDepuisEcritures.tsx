import { FormEvent, useEffect, useRef, useState } from 'react';
import { PortailModale } from './PortailModale';
import { Aide } from './chrome/Aide';
import { ecouterEchap } from '../lib/echap';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { corpsDepuisEcriture, saisieDepuisLigne, type LigneATransformer, type SaisieDepuisLigne } from '../lib/creation-depuis-ecritures';

/** Ce que le serveur sert (`GET /immobilisations/ecritures-a-transformer`). */
interface ListeLue {
  total: number;
  tronque: boolean;
  lignes: LigneATransformer[];
}

const etiquette = 'text-[11.5px] font-semibold text-text-dim';
const champ = 'mt-1 w-full border border-border-dark px-2.5 py-1.5 text-[12px] font-normal disabled:bg-surface-alt';

/**
 * CRÉER LES BIENS DEPUIS LES ÉCRITURES DÉJÀ PASSÉES (ligne sage-l4, fonction
 * n° 68) · la liste que le serveur sert, chaque ligne avec ce qui la refuse ;
 * la fiche naît de la ligne choisie par `POST /immobilisations/depuis-ecriture`,
 * sans écriture nouvelle. Rien n'est recalculé ici · compte, valeur et date
 * sont ceux de la ligne, lus par le serveur.
 */
export function CreationDepuisEcritures({
  onFermer,
  onFait,
  syscohada,
  unitesServies,
}: {
  onFermer: () => void;
  onFait: (message: string) => void;
  syscohada: boolean;
  unitesServies: boolean;
}) {
  const { peutEcrire } = useAuth();
  const [liste, setListe] = useState<ListeLue | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [choisie, setChoisie] = useState<LigneATransformer | null>(null);
  const [saisie, setSaisie] = useState<SaisieDepuisLigne | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  const jeton = useRef(0);

  const lire = () => {
    // Une réponse plus ancienne que la dernière demande est jetée.
    const n = ++jeton.current;
    setErreurLecture(null);
    api
      .get<ListeLue>('/immobilisations/ecritures-a-transformer')
      .then(
        (l) => {
          if (n === jeton.current) setListe(l);
        },
        (e: Error) => {
          if (n === jeton.current) setErreurLecture(e instanceof ApiError ? e.message : 'La liste des écritures n’a pas pu être lue.');
        },
      );
  };
  useEffect(lire, []);
  useEffect(
    () =>
      ecouterEchap(() => {
        // La fermeture attend la fin de l'envoi · sinon la fiche naît sans que personne ne le voie.
        if (!envoi) onFermer();
        return true;
      }),
    [onFermer, envoi],
  );
  useEffect(() => fermer.current?.focus({ preventScroll: true }), []);

  const choisir = (l: LigneATransformer) => {
    setChoisie(l);
    setSaisie(saisieDepuisLigne(l));
    setErreur(null);
  };

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (!choisie || !saisie) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api.post('/immobilisations/depuis-ecriture', corpsDepuisEcriture(choisie.ligneId, saisie));
      onFait(`Fiche « ${saisie.designation.trim()} » créée depuis la pièce n° ${choisie.numeroPiece ?? '·'} · aucune écriture passée.`);
      setChoisie(null);
      setSaisie(null);
      lire();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'La fiche n’a pas pu être créée.');
    } finally {
      setEnvoi(false);
    }
  };

  const poser = <K extends keyof SaisieDepuisLigne>(cle: K, valeur: SaisieDepuisLigne[K]) => setSaisie((s) => (s ? { ...s, [cle]: valeur } : s));

  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4" onClick={() => !envoi && onFermer()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Créer depuis les écritures"
          className="anim-modale w-[920px] max-w-full max-h-full overflow-auto rounded-[4px] bg-surface border border-border-dark shadow-dominante"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3.5 h-[32px] bg-surface text-text border-b border-border">
            <span className="text-[11.5px] font-semibold flex items-center gap-1.5">
              Créer depuis les écritures
              <Aide
                titre="Créer les biens depuis les écritures"
                texte="Les lignes au débit d'un compte de bien, d'écritures validées d'un exercice ouvert, qu'aucune fiche ne porte encore. La fiche naît de la ligne choisie · compte, valeur et date d'acquisition sont ceux de la ligne, et aucune écriture n'est passée (une seconde doublerait la valeur au bilan). L'écriture est alors retenue par la fiche, qui se retire tant qu'aucun traitement ne l'a lue. Un bien dont le coût est porté sur plusieurs lignes, ou une pièce de plusieurs biens qui crédite un fonds, se corrige d'abord au journal en une ligne et une pièce par bien. Une acquisition d'un exercice clôturé se déclare en bien repris."
                source="AUDCIF art. 20, 22 et 35 ; fiches des comptes 21 à 24"
              />
            </span>
            <button
              ref={fermer}
              type="button"
              aria-label="Fermer"
              onClick={() => !envoi && onFermer()}
              className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-danger text-[12px]"
            >
              ✕
            </button>
          </div>
          <div className="p-3.5 text-[11.5px]">
            {erreurLecture && <div className="text-danger mb-2">{erreurLecture}</div>}
            {!liste && !erreurLecture && <div className="text-text-dim">Chargement…</div>}
            {liste && liste.lignes.length === 0 && (
              <div className="text-text-dim">Aucune ligne d’acquisition validée sans fiche dans les exercices ouverts.</div>
            )}
            {liste && liste.lignes.length > 0 && (
              <>
                {liste.tronque && (
                  <div className="text-warning mb-1.5">
                    {liste.lignes.length} lignes les plus récentes sur {liste.total} · créez ou corrigez celles-ci pour voir les suivantes.
                  </div>
                )}
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Date</th>
                      <th className="text-left">Journal</th>
                      <th className="text-right">Pièce</th>
                      <th className="text-left">Compte</th>
                      <th className="text-left">Libellé</th>
                      <th className="text-right">Montant</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {liste.lignes.map((l) => (
                      <tr key={l.ligneId} aria-selected={choisie?.ligneId === l.ligneId}>
                        <td>{new Date(l.date).toLocaleDateString('fr-FR')}</td>
                        <td>{l.journal}</td>
                        <td className="text-right">{l.numeroPiece ?? '·'}</td>
                        <td title={l.compte.intitule}>{l.compte.numero}</td>
                        <td>
                          {l.libelle}
                          {l.motifRefus && <span className="block text-[11px] text-warning">{l.motifRefus}</span>}
                        </td>
                        <td className="text-right font-mono">{montant(l.montant)}</td>
                        <td className="text-right">
                          {peutEcrire && (
                            <button
                              type="button"
                              disabled={!!l.motifRefus || envoi}
                              title={l.motifRefus ?? 'Créer la fiche de ce bien'}
                              onClick={() => choisir(l)}
                              className="px-2 py-[2px] border border-border-dark rounded-[3px] disabled:opacity-40 whitespace-nowrap"
                            >
                              Créer la fiche
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {choisie && saisie && peutEcrire && (
              <form onSubmit={creer} className="mt-3 border-t border-border pt-3">
                <div className="font-semibold mb-2">
                  Pièce n° {choisie.numeroPiece ?? '·'} · {choisie.compte.numero} · {montant(choisie.montant)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={`${etiquette} sm:col-span-2`}>
                    Désignation
                    <input required autoFocus value={saisie.designation} onChange={(e) => poser('designation', e.target.value)} className={champ} />
                  </label>
                  <label className={etiquette}>
                    N° inventaire
                    <input value={saisie.numeroInventaire} onChange={(e) => poser('numeroInventaire', e.target.value)} className={champ} />
                  </label>
                  <label className={etiquette}>
                    Mise en service
                    <input
                      type="date"
                      value={saisie.dateMiseEnService}
                      disabled={saisie.pasEncoreEnService}
                      onChange={(e) => poser('dateMiseEnService', e.target.value)}
                      className={champ}
                    />
                  </label>
                  <label className={`${etiquette} flex items-center gap-1.5 self-end pb-1.5`}>
                    <input type="checkbox" checked={saisie.pasEncoreEnService} onChange={(e) => poser('pasEncoreEnService', e.target.checked)} />
                    Pas encore mis en service
                  </label>
                  <label className={etiquette}>
                    Durée (ans)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={saisie.dureeAmortissementAns}
                      placeholder="Celle de la famille"
                      onChange={(e) => poser('dureeAmortissementAns', e.target.value)}
                      className={champ}
                    />
                  </label>
                  {unitesServies && (
                    <label className={etiquette}>
                      Mode d’amortissement
                      <select
                        value={saisie.modeAmortissement}
                        onChange={(e) => poser('modeAmortissement', e.target.value as SaisieDepuisLigne['modeAmortissement'])}
                        className={champ}
                      >
                        <option value="">Celui de la famille</option>
                        <option value="LINEAIRE">Linéaire</option>
                        <option value="UNITES_DOEUVRE">Unités d’œuvre</option>
                        {!syscohada && <option value="DEGRESSIF">Dégressif</option>}
                      </select>
                    </label>
                  )}
                  {saisie.modeAmortissement === 'UNITES_DOEUVRE' && (
                    <>
                      <label className={etiquette}>
                        Total d’unités prévues
                        <input required type="number" min={1} value={saisie.unitesOeuvrePrevues} onChange={(e) => poser('unitesOeuvrePrevues', e.target.value)} className={champ} />
                      </label>
                      <label className={etiquette}>
                        Unité (km, heures, pièces…)
                        <input required value={saisie.uniteOeuvreLibelle} onChange={(e) => poser('uniteOeuvreLibelle', e.target.value)} className={champ} />
                      </label>
                    </>
                  )}
                </div>
                {erreur && <div className="mt-2 text-danger">{erreur}</div>}
                <div className="mt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    disabled={envoi}
                    onClick={() => {
                      setChoisie(null);
                      setSaisie(null);
                    }}
                    className="px-3 py-[3px] border border-border-dark rounded-[3px]"
                  >
                    Annuler
                  </button>
                  <button type="submit" disabled={envoi} className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold disabled:opacity-50">
                    {envoi ? 'Création…' : 'Créer la fiche'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </PortailModale>
  );
}
