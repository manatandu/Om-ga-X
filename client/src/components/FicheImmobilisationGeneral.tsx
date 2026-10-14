import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { RETENUS, motifAucunCompteRetenu } from '../lib/comptes-proposes';
import type { CompteDuBien, ContrepartieAdmise } from '../lib/compte-du-bien';
import type { NatureBaremeFiscal } from '../lib/bareme-fiscal';
import { corpsModification, saisieDepuis, type SaisieFiche, type ValeursFiche } from '../lib/fiche-immobilisation';
import { Aide } from './chrome/Aide';

/** Ce que le serveur sert de la fiche (`GET /immobilisations/:id/modification`). */
interface EtatFiche {
  valeurs: ValeursFiche;
  acquisition: { numeroPiece: number | null; statut: string; journalId: string } | null;
  modificationAEffet: { ouverte: boolean; motif: string | null };
  suppression: { ouverte: boolean; motif: string | null };
}

/** La copie proposée par « Dupliquer » (`GET /immobilisations/:id/duplication`). */
export interface PropositionDuplication {
  designation: string;
  compteImmobilisationId: string;
  natureFiscaleCle: string | null;
  lieuId: string | null;
  valeurOrigine: number;
  valeurResiduelle: number;
  dureeAmortissementAns: number;
  modeAmortissement: string;
  unitesOeuvrePrevues: number | null;
  uniteOeuvreLibelle: string | null;
}

const MODES: { valeur: string; libelle: string }[] = [
  { valeur: 'LINEAIRE', libelle: 'Linéaire' },
  { valeur: 'DEGRESSIF', libelle: 'Dégressif' },
  { valeur: 'UNITES_DOEUVRE', libelle: 'Unités d’œuvre' },
];

const champ = 'mt-1 w-full border border-border-dark px-2.5 py-1.5 text-[12px] font-normal disabled:bg-surface-alt disabled:text-text-dim';
const etiquette = 'text-[11.5px] font-semibold text-text-dim';

/**
 * L'ONGLET GÉNÉRAL DE LA FICHE (ligne sage-l4, fonction n° 66, décision D7) ·
 * modifier, dupliquer, supprimer. Ce que la fiche admet vient du serveur, qui
 * seul juge · les champs à effet restent figés, motif dit, dès qu'une
 * écriture du bien est validée ou qu'un traitement les a lus.
 */
export function FicheImmobilisationGeneral({
  bien,
  onFait,
  onDupliquer,
  onSupprime,
}: {
  bien: { id: string; designation: string };
  onFait: (message: string) => void;
  onDupliquer: (proposition: PropositionDuplication) => void;
  onSupprime: (message: string) => void;
}) {
  const { peutEcrire } = useAuth();
  const [etat, setEtat] = useState<EtatFiche | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [saisie, setSaisie] = useState<SaisieFiche | null>(null);
  const [comptesBien, setComptesBien] = useState<CompteDuBien[] | null>(null);
  const [contreparties, setContreparties] = useState<ContrepartieAdmise[] | null>(null);
  const [bareme, setBareme] = useState<NatureBaremeFiscal[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const jeton = useRef(0);

  const charger = useCallback(() => {
    const mien = ++jeton.current;
    setErreurLecture(null);
    api
      .get<EtatFiche>(`/immobilisations/${bien.id}/modification`)
      .then((e) => {
        if (mien !== jeton.current) return;
        setEtat(e);
        setSaisie(saisieDepuis(e.valeurs));
      })
      .catch((e) => mien === jeton.current && setErreurLecture(e instanceof ApiError ? e.message : 'Fiche illisible'));
  }, [bien.id]);
  useEffect(() => charger(), [charger]);

  const effetOuvert = !!etat?.modificationAEffet.ouverte && peutEcrire;
  // Les listes de comptes ne servent qu'aux champs à effet · lues seulement s'ils s'ouvrent.
  useEffect(() => {
    if (!effetOuvert) return;
    let vivant = true;
    api
      .get<CompteDuBien[]>(`/immobilisations/comptes-du-bien?${RETENUS}`)
      .then((c) => vivant && setComptesBien(c))
      .catch((e) => vivant && setErreur(e instanceof ApiError ? e.message : 'Comptes du bien illisibles'));
    api
      .get<NatureBaremeFiscal[]>('/immobilisations/bareme-fiscal')
      .then((b) => vivant && setBareme(b))
      .catch(() => vivant && setBareme([]));
    return () => {
      vivant = false;
    };
  }, [effetOuvert]);
  const compteBienId = saisie?.compteImmobilisationId ?? '';
  const repris = !!etat?.valeurs.repris;
  useEffect(() => {
    setContreparties(null);
    if (!effetOuvert || repris || !compteBienId) return;
    let vivant = true;
    api
      .get<ContrepartieAdmise[]>(`/immobilisations/contreparties-acquisition?compteImmobilisationId=${compteBienId}&${RETENUS}`)
      .then((c) => vivant && setContreparties(c))
      .catch((e) => {
        if (!vivant) return;
        setContreparties([]);
        setErreur(e instanceof ApiError ? e.message : 'Contreparties admises illisibles');
      });
    return () => {
      vivant = false;
    };
  }, [effetOuvert, repris, compteBienId]);

  const poser = (cle: keyof SaisieFiche, valeur: string) => setSaisie((s) => (s ? { ...s, [cle]: valeur } : s));

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!etat || !saisie) return;
    const { corps, illisibles } = corpsModification(etat.valeurs, saisie);
    if (illisibles.length > 0) {
      setErreur(`Montant illisible · ${illisibles.join(', ')}.`);
      return;
    }
    if (Object.keys(corps).length === 0) {
      setErreur('Rien n’a changé.');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.patch<EtatFiche>(`/immobilisations/${bien.id}`, corps);
      setEtat(r);
      setSaisie(saisieDepuis(r.valeurs));
      onFait(`Fiche « ${r.valeurs.designation} » modifiée.`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'La modification a échoué');
    } finally {
      setEnvoi(false);
    }
  };

  const dupliquer = async () => {
    setErreur(null);
    try {
      onDupliquer(await api.get<PropositionDuplication>(`/immobilisations/${bien.id}/duplication`));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'La copie n’a pas pu être préparée');
    }
  };

  const supprimer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api.delete(`/immobilisations/${bien.id}`);
      onSupprime(`Fiche « ${bien.designation} » supprimée${etat?.acquisition ? ', avec son écriture d’acquisition du brouillard' : ''}.`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'La suppression a échoué');
      setConfirmerSuppression(false);
    } finally {
      setEnvoi(false);
    }
  };

  if (erreurLecture) return <div className="text-danger text-[11.5px]">{erreurLecture}</div>;
  if (!etat || !saisie) return <div className="text-text-dim text-[11.5px]">Chargement…</div>;
  const v = etat.valeurs;
  const effetFige = !effetOuvert;
  const motifContrepartie = motifAucunCompteRetenu(contreparties, 'de financement admis pour ce bien');

  return (
    <form onSubmit={enregistrer} className="text-[11.5px]">
      <div className="font-semibold flex items-center gap-1.5 mb-2">
        Fiche du bien
        <Aide
          titre="Modifier la fiche"
          texte="La désignation, le numéro d'inventaire et la nature se modifient à tout moment. Valeur, compte, dates et plan fondent l'écriture d'acquisition et les dotations · ils se modifient tant qu'aucune écriture du bien n'est validée et qu'aucun traitement ne les a lus, et l'écriture d'acquisition du brouillard est alors remplacée. Ensuite, le compte se change par un reclassement, la durée et le mode par une révision du plan. La fiche se supprime tant qu'aucune écriture n'est retenue."
          source="AUDCIF, art. 20 et 22"
        />
      </div>
      {etat.acquisition && (
        <div className="mb-2 text-text-dim">
          Écriture d’acquisition · pièce n° {etat.acquisition.numeroPiece ?? '·'} · {etat.acquisition.statut === 'BROUILLARD' ? 'brouillard' : 'validée'}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className={`${etiquette} sm:col-span-2`}>
          Désignation
          <input required value={saisie.designation} disabled={!peutEcrire} onChange={(e) => poser('designation', e.target.value)} className={champ} />
        </label>
        <label className={etiquette}>
          N° inventaire
          <input value={saisie.numeroInventaire} disabled={!peutEcrire} onChange={(e) => poser('numeroInventaire', e.target.value)} className={champ} />
        </label>
        <label className={`${etiquette} sm:col-span-3`}>
          Nature du bien (barème fiscal)
          <select value={saisie.natureFiscaleCle} disabled={!peutEcrire} onChange={(e) => poser('natureFiscaleCle', e.target.value)} className={champ}>
            <option value="">Non précisée</option>
            {saisie.natureFiscaleCle && !bareme.some((n) => n.cle === saisie.natureFiscaleCle) && (
              <option value={saisie.natureFiscaleCle}>{saisie.natureFiscaleCle}</option>
            )}
            {bareme.map((n) => (
              <option key={n.cle} value={n.cle}>
                {n.section} · {n.designation} ({n.dureeAns} ans)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="font-semibold mt-4 mb-1.5">Valeur et plan</div>
      {etat.modificationAEffet.motif && <div className="mb-2 text-warning">{etat.modificationAEffet.motif}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className={`${etiquette} sm:col-span-2`}>
          Compte du bien
          <select value={saisie.compteImmobilisationId} disabled={effetFige} onChange={(e) => poser('compteImmobilisationId', e.target.value)} className={champ}>
            {!(comptesBien ?? []).some((c) => c.id === saisie.compteImmobilisationId) && (
              <option value={saisie.compteImmobilisationId}>Compte actuel</option>
            )}
            {(comptesBien ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.intitule}
              </option>
            ))}
          </select>
        </label>
        {!v.repris && (
          <label className={etiquette}>
            Financement
            <select value={saisie.compteContrepartieId} disabled={effetFige} onChange={(e) => poser('compteContrepartieId', e.target.value)} className={champ}>
              {!(contreparties ?? []).some((c) => c.id === saisie.compteContrepartieId) && saisie.compteContrepartieId && (
                <option value={saisie.compteContrepartieId}>Contrepartie actuelle</option>
              )}
              {(contreparties ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.intitule}
                </option>
              ))}
            </select>
            {effetOuvert && motifContrepartie && <span className="block font-normal text-warning">{motifContrepartie}</span>}
          </label>
        )}
        <label className={etiquette}>
          Date d’acquisition
          <input type="date" required value={saisie.dateAcquisition} disabled={effetFige} onChange={(e) => poser('dateAcquisition', e.target.value)} className={champ} />
        </label>
        <label className={etiquette}>
          Mise en service
          <input type="date" value={saisie.dateMiseEnService} disabled={effetFige} onChange={(e) => poser('dateMiseEnService', e.target.value)} className={champ} />
        </label>
        <label className={etiquette}>
          Valeur d’origine
          <input inputMode="decimal" required value={saisie.valeurOrigine} disabled={effetFige} onChange={(e) => poser('valeurOrigine', e.target.value)} className={`${champ} text-right`} />
        </label>
        <label className={etiquette}>
          Valeur résiduelle
          <input inputMode="decimal" value={saisie.valeurResiduelle} disabled={effetFige} onChange={(e) => poser('valeurResiduelle', e.target.value)} className={`${champ} text-right`} />
        </label>
        <label className={etiquette}>
          Durée (ans)
          <input inputMode="numeric" value={saisie.dureeAmortissementAns} disabled={effetFige} onChange={(e) => poser('dureeAmortissementAns', e.target.value)} className={`${champ} text-right`} />
        </label>
        <label className={etiquette}>
          Mode
          <select value={saisie.modeAmortissement} disabled={effetFige} onChange={(e) => poser('modeAmortissement', e.target.value)} className={champ}>
            {MODES.map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.libelle}
              </option>
            ))}
          </select>
        </label>
        {saisie.modeAmortissement === 'UNITES_DOEUVRE' && (
          <>
            <label className={etiquette}>
              Unités prévues
              <input inputMode="decimal" value={saisie.unitesOeuvrePrevues} disabled={effetFige} onChange={(e) => poser('unitesOeuvrePrevues', e.target.value)} className={`${champ} text-right`} />
            </label>
            <label className={etiquette}>
              Unité
              <input value={saisie.uniteOeuvreLibelle} disabled={effetFige} onChange={(e) => poser('uniteOeuvreLibelle', e.target.value)} className={champ} />
            </label>
          </>
        )}
        {v.repris && (
          <label className={etiquette}>
            Amortissement déjà pratiqué
            <input inputMode="decimal" value={saisie.amortissementAnterieur} disabled={effetFige} onChange={(e) => poser('amortissementAnterieur', e.target.value)} className={`${champ} text-right`} />
          </label>
        )}
      </div>
      {effetFige && (
        <div className="mt-2 text-text-dim">
          Valeur d’origine {montant(v.valeurOrigine)} · valeur résiduelle {montant(v.valeurResiduelle)}
        </div>
      )}

      {erreur && <div className="mt-2 text-danger">{erreur}</div>}
      {peutEcrire && (
        <div className="mt-3 flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => void dupliquer()} disabled={envoi} className="px-3 py-[3px] border border-border-dark rounded-[3px]">
            Dupliquer
          </button>
          {!confirmerSuppression ? (
            <button
              type="button"
              onClick={() => setConfirmerSuppression(true)}
              disabled={envoi || !etat.suppression.ouverte}
              title={etat.suppression.motif ?? 'Supprimer la fiche'}
              className="px-3 py-[3px] border border-border-dark rounded-[3px] text-danger disabled:opacity-40"
            >
              Supprimer la fiche
            </button>
          ) : (
            <button type="button" onClick={() => void supprimer()} disabled={envoi} className="px-3 py-[3px] rounded-[3px] bg-danger text-white font-semibold">
              Confirmer la suppression
            </button>
          )}
          <button type="submit" disabled={envoi} className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold disabled:opacity-50">
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
      {!etat.suppression.ouverte && etat.suppression.motif && peutEcrire && (
        <div className="mt-2 text-[11px] text-text-dim">Suppression · {etat.suppression.motif}</div>
      )}
    </form>
  );
}
