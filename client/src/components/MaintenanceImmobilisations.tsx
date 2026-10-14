import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { Aide } from './chrome/Aide';
import {
  PARAMETRES_INITIAUX,
  requeteRenumerotation,
  type ApercuRenumerotation,
  type MaintenanceLue,
  type ParametresRenumerotation,
} from '../lib/maintenance-immobilisations';

const etiquette = 'text-[11.5px] font-semibold text-text-dim';
const champ = 'mt-1 w-full border border-border-dark px-2.5 py-1.5 text-[12px] font-normal';

/**
 * MAINTENANCE DU REGISTRE (ligne sage-l4, fonction n° 73) · le registre face
 * à la balance, servi par le serveur (`GET /immobilisations/maintenance`),
 * rien n'est recalculé ni corrigé ici. Un écart se dit avec ce que le module
 * en connaît ; le cabinet l'explique.
 */
export function MaintenanceImmobilisations({ exerciceId }: { exerciceId: string | undefined }) {
  const [lue, setLue] = useState<MaintenanceLue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const jeton = useRef(0);

  const lire = () => {
    if (!exerciceId) return;
    const n = ++jeton.current;
    setErreur(null);
    api.get<MaintenanceLue>(`/immobilisations/maintenance?exerciceId=${exerciceId}`).then(
      (m) => {
        if (n === jeton.current) setLue(m);
      },
      (e: Error) => {
        if (n === jeton.current) setErreur(e instanceof ApiError ? e.message : 'La maintenance n’a pas pu être lue.');
      },
    );
  };
  useEffect(lire, [exerciceId]);

  return (
    <div className="border border-border bg-surface p-3 mb-4 max-w-[1100px] text-[11.5px]">
      <div className="flex items-center gap-1.5 font-semibold mb-2">
        Registre et balance
        <Aide
          titre="Maintenance du registre"
          texte="Le registre des immobilisations, tel que le tableau des amortissements le relit à la clôture de l'exercice, face au solde de chaque compte de la balance (brouillard compris). Un écart n'est pas une erreur en soi · il se dit avec ce que le module en connaît (lignes d'acquisition sans fiche, à créer depuis les écritures ; bien reclassé après la clôture) et se justifie. Les dotations de l'exercice pas encore passées ne sont ni au registre ni à la balance, et se disent à part. Rien n'est corrigé d'office."
          source="AUDCIF art. 42 ; définition d’OmegaX"
        />
        <button type="button" onClick={lire} className="ml-auto px-2 py-[2px] border border-border-dark rounded-[3px] font-normal">
          Relire
        </button>
      </div>
      {!exerciceId && <div className="text-text-dim">Choisissez un exercice.</div>}
      {erreur && <div className="text-danger">{erreur}</div>}
      {exerciceId && !lue && !erreur && <div className="text-text-dim">Chargement…</div>}
      {lue && (
        <>
          <TableRapprochement
            titre="Comptes de biens"
            lignes={lue.comptesBien.map((l) => ({
              ...l,
              cause: l.lignesSansFiche.nombre > 0 ? `${l.lignesSansFiche.nombre} ligne(s) sans fiche · ${montant(l.lignesSansFiche.montant)}` : null,
            }))}
          />
          <TableRapprochement titre="Comptes d’amortissement" lignes={lue.comptesAmortissement.map((l) => ({ ...l, cause: null }))} />
          {lue.dotationsAPasser.nombre > 0 && (
            <div className="mt-2 text-text-dim">
              Dotations de l’exercice pas encore passées · {lue.dotationsAPasser.nombre} bien(s), {montant(lue.dotationsAPasser.montant)}.
            </div>
          )}
          {lue.reclassesApresLaClotureTotal > 0 && (
            <div className="mt-2 text-warning">
              Reclassés après la clôture ({lue.reclassesApresLaClotureTotal}) ·{' '}
              {lue.reclassesApresLaCloture.map((r) => `${r.designation} (du ${r.ancienCompte} au ${r.compteActuel} le ${new Date(r.date).toLocaleDateString('fr-FR')})`).join(', ')}
              {lue.reclassesApresLaClotureTotal > lue.reclassesApresLaCloture.length ? '…' : ''}
            </div>
          )}
          {lue.numerosEnDoubleTotal > 0 && (
            <div className="mt-2 text-warning">
              Numéros d’inventaire en double ({lue.numerosEnDoubleTotal}) ·{' '}
              {lue.numerosEnDouble.map((d) => `${d.numero} · ${d.fiches.map((f) => f.designation).join(', ')}`).join(' ; ')}
              {lue.numerosEnDoubleTotal > lue.numerosEnDouble.length ? '…' : ''}
            </div>
          )}
          {lue.biensEnServiceSansNumero > 0 && (
            <div className="mt-2 text-text-dim">Biens en service sans numéro d’inventaire · {lue.biensEnServiceSansNumero}.</div>
          )}
        </>
      )}
    </div>
  );
}

function TableRapprochement({
  titre,
  lignes,
}: {
  titre: string;
  lignes: { numero: string; intitule: string; registre: number; balance: number; ecart: number; cause: string | null }[];
}) {
  return (
    <div className="mb-3">
      <div className="font-semibold mb-1">{titre}</div>
      {lignes.length === 0 ? (
        <div className="text-text-dim">Aucun solde au registre ni à la balance.</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left">Compte</th>
              <th className="text-left">Intitulé</th>
              <th className="text-right">Registre</th>
              <th className="text-right">Balance</th>
              <th className="text-right">Écart</th>
              <th className="text-left">Connu du module</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.numero}>
                <td>{l.numero}</td>
                <td>{l.intitule}</td>
                <td className="text-right font-mono">{montant(l.registre)}</td>
                <td className="text-right font-mono">{montant(l.balance)}</td>
                <td className={`text-right font-mono ${l.ecart !== 0 ? 'text-warning font-semibold' : ''}`}>{montant(l.ecart)}</td>
                <td>{l.cause ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * RENUMÉROTATION DES BIENS (ligne sage-l4, fonction n° 73) · l'aperçu, puis
 * la confirmation · le serveur rejoue le plan, l'écran ne l'envoie pas.
 * Administrateur seul, comme au serveur.
 */
export function RenumerotationImmobilisations({ onFait }: { onFait: (message: string) => void }) {
  const { estAdmin } = useAuth();
  const [p, setP] = useState<ParametresRenumerotation>(PARAMETRES_INITIAUX);
  const [apercu, setApercu] = useState<ApercuRenumerotation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  if (!estAdmin) return null;
  const poser = <K extends keyof ParametresRenumerotation>(cle: K, valeur: ParametresRenumerotation[K]) => {
    setP((x) => ({ ...x, [cle]: valeur }));
    setApercu(null);
  };

  const voir = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      setApercu(await api.get<ApercuRenumerotation>(`/immobilisations/renumerotation?${requeteRenumerotation(p)}`));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'L’aperçu n’a pas pu être lu.');
    } finally {
      setEnvoi(false);
    }
  };

  const confirmer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ renumerotes: number; inchanges: number }>('/immobilisations/renumerotation', {
        ...p,
        premierNumero: Number(p.premierNumero),
        largeur: Number(p.largeur),
      });
      onFait(`${r.renumerotes} bien(s) renuméroté(s), ${r.inchanges} déjà à leur numéro.`);
      setApercu(null);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'La renumérotation a échoué.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={voir} className="border border-border bg-surface p-3 mb-4 max-w-[1100px] text-[11.5px]">
      <div className="flex items-center gap-1.5 font-semibold mb-2">
        Renumérotation des biens
        <Aide
          titre="Renumérotation des biens"
          texte="Donne aux biens en service une suite de numéros d'inventaire (préfixe, premier numéro, largeur), dans l'ordre d'acquisition ou par compte puis par date. Seuls les biens sans numéro, ou tous les biens en service. Un bien sorti garde son numéro · il figure sous lui aux états des exercices qui l'ont vu. Un numéro déjà porté par un bien hors du périmètre est refusé. Aucune écriture · chaque changement est au journal d'audit."
          source="Définition d’OmegaX (Sage, « Renumérotation ») ; AUDCIF art. 42"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <label className={etiquette}>
          Préfixe
          <input value={p.prefixe} maxLength={20} onChange={(e) => poser('prefixe', e.target.value)} className={champ} />
        </label>
        <label className={etiquette}>
          Premier numéro
          <input type="number" min={0} value={p.premierNumero} onChange={(e) => poser('premierNumero', e.target.value)} className={champ} />
        </label>
        <label className={etiquette}>
          Largeur
          <input type="number" min={1} max={8} value={p.largeur} onChange={(e) => poser('largeur', e.target.value)} className={champ} />
        </label>
        <label className={etiquette}>
          Ordre
          <select value={p.ordre} onChange={(e) => poser('ordre', e.target.value as ParametresRenumerotation['ordre'])} className={champ}>
            <option value="ACQUISITION">Date d’acquisition</option>
            <option value="COMPTE">Compte, puis date</option>
          </select>
        </label>
        <label className={etiquette}>
          Biens
          <select value={p.perimetre} onChange={(e) => poser('perimetre', e.target.value as ParametresRenumerotation['perimetre'])} className={champ}>
            <option value="SANS_NUMERO">Sans numéro</option>
            <option value="EN_SERVICE">Tous les biens en service</option>
          </select>
        </label>
      </div>
      {erreur && <div className="mt-2 text-danger">{erreur}</div>}
      {apercu && (
        <div className="mt-2">
          <div className={apercu.motifRefus ? 'text-warning' : ''}>
            {apercu.motifRefus ?? `${apercu.aChanger} bien(s) changeront de numéro sur ${apercu.nombre}.`}
          </div>
          {apercu.attributions.length > 0 && (
            <table className="w-full mt-1">
              <thead>
                <tr>
                  <th className="text-left">Bien</th>
                  <th className="text-left">Numéro actuel</th>
                  <th className="text-left">Nouveau numéro</th>
                </tr>
              </thead>
              <tbody>
                {apercu.attributions.map((a) => (
                  <tr key={a.id}>
                    <td>{a.designation}</td>
                    <td>{a.ancien ?? '·'}</td>
                    <td>{a.nouveau}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {apercu.tronque && <div className="text-text-dim mt-1">Les {apercu.attributions.length} premiers changements sur {apercu.aChanger}.</div>}
        </div>
      )}
      <div className="mt-3 flex gap-2 justify-end">
        <button type="submit" disabled={envoi} className="px-3 py-[3px] border border-border-dark rounded-[3px]">
          Aperçu
        </button>
        <button
          type="button"
          onClick={() => void confirmer()}
          disabled={envoi || !apercu || !!apercu.motifRefus || apercu.aChanger === 0}
          className="bg-sel text-white rounded-[3px] px-3 py-[3px] font-semibold disabled:opacity-50"
        >
          Renuméroter
        </button>
      </div>
    </form>
  );
}
