import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Aide } from '../chrome/Aide';
import { BoutonsPaie, CHAMP_PAIE, ChampPaie, ModalePaie, useEnvoiPaie } from './ModalePaie';
import {
  lirePourcentage,
  totalEnPointsDeBase,
  type PlanDeRepartition,
  type RepartitionsLues,
  type VersionDeRepartition,
} from '../../lib/repartition-analytique';

const pct = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;

/**
 * LIGNE SAGE-L5, FONCTION 88 · LA RÉPARTITION ANALYTIQUE DU SALARIÉ, dans le
 * Registre du personnel. Une version par plan et par mois d'effet, qui ne se
 * modifie pas · elle se retire avec son motif. La passation du mois
 * l'applique aux lignes de l'écriture de paie. Les boutons suivent les
 * routes · `peutEcrire` (registre du personnel, gestionnaire de paie compris).
 */
export function RepartitionAnalytique({ salarieId }: { salarieId: string }) {
  const { peutEcrire } = useAuth();
  // Null tant que rien n'est LU · « aucune répartition » ne se dit que sur une liste lue.
  const [lu, setLu] = useState<RepartitionsLues | null>(null);
  const [erreur, setErreur] = useState('');
  const [declarer, setDeclarer] = useState(false);
  const [retrait, setRetrait] = useState<VersionDeRepartition | null>(null);
  const jeton = useRef(0);

  const charger = useCallback(() => {
    const moi = ++jeton.current;
    setErreur('');
    api.get<RepartitionsLues>(`/personnel/salaries/${salarieId}/repartitions-analytiques`).then(
      (r) => {
        if (moi === jeton.current) setLu(r);
      },
      (e: ApiError) => {
        if (moi === jeton.current) setErreur(e.message);
      },
    );
  }, [salarieId]);
  useEffect(() => {
    setLu(null);
    charger();
  }, [charger]);

  const plansDeLaPaie = lu ? lu.plans.filter((p) => p.ventileLaPaie) : [];

  return (
    <section className="mt-3 border-t border-border pt-2 text-[11.5px]">
      <div className="font-bold mb-1 flex items-center gap-1.5">
        Répartition analytique
        <Aide
          titre="Répartition analytique"
          texte="La répartition dit, par plan analytique, entre quelles sections les charges de ce salarié se partagent, à partir d'un mois de paie. La passation de la paie du mois l'applique aux lignes de l'écriture · la part de chaque salarié dans chaque ligne se répartit selon SA répartition, au centime, les centimes restants allant au plus fort reste. Un salarié sans répartition laisse la ligne non ventilée sur ce plan, et la proposition le dit · rien n'est réparti au prorata des autres. Seules les sections Détail actives d'un plan qui ventile la classe 6 se choisissent. Une version ne se modifie pas · retirez-la, puis déclarez la nouvelle. Une version sans section dit qu'à partir de ce mois le salarié ne se répartit plus sur ce plan. Convention d'OmegaX, la comptabilité analytique étant de libre usage."
          source="Plans de comptes SYSCOHADA et SYCEBNL, classe 9 (libre usage) · règles de ventilation d'OmegaX"
        />
      </div>
      {erreur && (
        <div role="alert" className="border border-danger/30 bg-danger-soft text-danger px-3 py-1.5 mb-1.5">
          {erreur}
        </div>
      )}
      {!lu && !erreur && <div className="text-text-dim">Chargement…</div>}
      {lu && (
        <>
          {plansDeLaPaie.length === 0 && (
            <div className="text-text-dim mb-1">
              Aucun plan analytique actif ne ventile les charges de personnel (classe 6) · créez-en un, ou ajoutez la classe 6 à ses
              classes ventilées, dans Structure, Plans analytiques.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Plan</th>
                  <th className="text-left px-2 py-1">À partir de</th>
                  <th className="text-left px-2 py-1">Sections</th>
                  <th className="text-left px-2 py-1">État</th>
                  <th className="px-2 py-1 w-[90px]" />
                </tr>
              </thead>
              <tbody>
                {lu.versions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-1 text-text-dim">
                      Aucune répartition déclarée.
                    </td>
                  </tr>
                )}
                {lu.versions.map((v) => (
                  <tr key={v.id} className={v.retireLe ? 'text-text-dim' : undefined}>
                    <td className="px-2 py-1">{v.planCode}</td>
                    <td className="px-2 py-1">{v.moisEffet}</td>
                    <td className="px-2 py-1">
                      {v.lignes.length === 0 ? 'Plus réparti sur ce plan' : v.lignes.map((l) => `${l.sectionCode} ${pct(l.pourcentage)}`).join(' · ')}
                    </td>
                    <td className="px-2 py-1">
                      {v.retireLe ? `Retirée le ${v.retireLe.slice(0, 10)}${v.motifRetrait ? ` · ${v.motifRetrait}` : ''}` : 'Déclarée'}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {peutEcrire && !v.retireLe && (
                        <button type="button" className="text-danger hover:underline" onClick={() => setRetrait(v)}>
                          Retirer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lu.plansTronques && <div className="text-warning mt-1">Liste des plans tronquée aux cinquante premiers.</div>}
          {lu.tronque && (
            <div className="text-warning mt-1">
              Liste tronquée · {lu.versions.length} répartitions lues sur {lu.total}.
            </div>
          )}
          {peutEcrire && plansDeLaPaie.length > 0 && (
            <button type="button" className="mt-1.5 border border-border px-2.5 py-1" onClick={() => setDeclarer(true)}>
              Déclarer une répartition
            </button>
          )}
        </>
      )}
      {declarer && lu && (
        <ModaleDeclarer
          salarieId={salarieId}
          plans={plansDeLaPaie}
          proposition={lu.propositionOrganigramme ?? null}
          onFermer={() => setDeclarer(false)}
          onFait={() => {
            setDeclarer(false);
            charger();
          }}
        />
      )}
      {retrait && (
        <ModaleRetrait
          version={retrait}
          onFermer={() => setRetrait(null)}
          onFait={() => {
            setRetrait(null);
            charger();
          }}
        />
      )}
    </section>
  );
}

function ModaleDeclarer({
  salarieId,
  plans,
  proposition,
  onFermer,
  onFait,
}: {
  salarieId: string;
  plans: PlanDeRepartition[];
  proposition: RepartitionsLues['propositionOrganigramme'] | null;
  onFermer: () => void;
  onFait: () => void;
}) {
  // LIGNE PAIE-SUITE · la section de l'unité de l'organigramme se PROPOSE ·
  // préremplie quand son plan est l'un de ceux qui ventilent la paie, jamais
  // déclarée sans le clic. Sinon, un choix unique se présélectionne.
  const sectionProposee =
    proposition?.section && plans.some((p) => p.id === proposition.section!.planId && p.sections.some((x) => x.id === proposition.section!.id))
      ? proposition.section
      : null;
  const [planId, setPlanId] = useState(sectionProposee ? sectionProposee.planId : plans.length === 1 ? plans[0].id : '');
  const [moisEffet, setMoisEffet] = useState('');
  const [lignes, setLignes] = useState<{ sectionId: string; pourcentage: string }[]>([{ sectionId: sectionProposee?.id ?? '', pourcentage: '100' }]);
  const { envoi, erreur, setErreur, envoyer } = useEnvoiPaie(onFait);
  const plan = plans.find((p) => p.id === planId) ?? null;
  const total = totalEnPointsDeBase(lignes.map((l) => l.pourcentage));

  const valider = () => {
    if (!plan) return setErreur('Choisissez le plan analytique.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(moisEffet)) return setErreur("Choisissez le mois de paie à partir duquel la répartition vaut.");
    if (lignes.some((l) => !l.sectionId)) return setErreur('Choisissez la section de chaque ligne, ou retirez la ligne.');
    const lues = lignes.map((l) => ({ sectionId: l.sectionId, pourcentage: lirePourcentage(l.pourcentage) }));
    if (lues.some((l) => l.pourcentage === null)) return setErreur('Un pourcentage est illisible (deux décimales au plus, entre 0 et 100).');
    void envoyer(() =>
      api.post(`/personnel/salaries/${salarieId}/repartitions-analytiques`, { planId: plan.id, moisEffet, lignes: lues }),
    );
  };

  return (
    <ModalePaie
      titre="Déclarer une répartition analytique"
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsPaie envoi={envoi} onFermer={onFermer} valider="Déclarer" />}
    >
      <ChampPaie libelle="Plan analytique">
        <select
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            setLignes([{ sectionId: '', pourcentage: '100' }]);
          }}
          className={CHAMP_PAIE}
        >
          <option value="">Choisir un plan</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.intitule}
            </option>
          ))}
        </select>
      </ChampPaie>
      {proposition && (
        <div className={sectionProposee ? 'text-text-dim' : 'text-warning'}>
          {sectionProposee ? `Proposée par l’unité ${proposition.unite.code} · ${sectionProposee.code} ${sectionProposee.intitule}, à 100 %.` : proposition.motif}
        </div>
      )}
      <ChampPaie libelle="À partir du mois de paie">
        <input type="month" value={moisEffet} onChange={(e) => setMoisEffet(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
      {plan && plan.sections.length === 0 && (
        <div className="text-warning">
          Le plan {plan.code} n'a aucune section Détail active · ouvrez-en une dans Structure, Plans analytiques.
        </div>
      )}
      {plan && plan.sectionsTronquees && <div className="text-warning">Liste des sections tronquée aux 500 premières.</div>}
      {plan &&
        lignes.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Section ${i + 1}`}
              value={l.sectionId}
              onChange={(e) => setLignes(lignes.map((x, k) => (k === i ? { ...x, sectionId: e.target.value } : x)))}
              className={`${CHAMP_PAIE} flex-1 min-w-[180px]`}
            >
              <option value="">Choisir une section</option>
              {plan.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.intitule}
                </option>
              ))}
            </select>
            <input
              aria-label={`Pourcentage ${i + 1}`}
              value={l.pourcentage}
              onChange={(e) => setLignes(lignes.map((x, k) => (k === i ? { ...x, pourcentage: e.target.value } : x)))}
              className={`${CHAMP_PAIE} w-[90px] text-right`}
              inputMode="decimal"
            />
            <span>%</span>
            <button type="button" className="text-danger hover:underline" onClick={() => setLignes(lignes.filter((_, k) => k !== i))}>
              Retirer
            </button>
          </div>
        ))}
      {plan && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="border border-border px-2.5 py-1" onClick={() => setLignes([...lignes, { sectionId: '', pourcentage: '' }])}>
            Ajouter une section
          </button>
          <span className={total === 10_000 || lignes.length === 0 ? 'text-text-dim' : 'text-warning'}>
            {lignes.length === 0
              ? 'Aucune section · le salarié ne se répartit plus sur ce plan à partir de ce mois.'
              : total === null
                ? 'Total · un pourcentage est illisible.'
                : `Total · ${pct(total / 100)}`}
          </span>
        </div>
      )}
    </ModalePaie>
  );
}

function ModaleRetrait({ version, onFermer, onFait }: { version: VersionDeRepartition; onFermer: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { envoi, erreur, setErreur, envoyer } = useEnvoiPaie(onFait);
  const valider = () => {
    if (motif.trim().length < 3) return setErreur('Le motif du retrait est exigé (trois caractères au moins).');
    void envoyer(() => api.post(`/personnel/repartitions-analytiques/${version.id}/retrait`, { motif: motif.trim() }));
  };
  return (
    <ModalePaie
      titre={`Retirer la répartition ${version.planCode} à partir de ${version.moisEffet}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsPaie envoi={envoi} onFermer={onFermer} valider="Retirer la répartition" />}
    >
      <ChampPaie libelle="Motif">
        <input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP_PAIE} maxLength={500} />
      </ChampPaie>
    </ModalePaie>
  );
}
