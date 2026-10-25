# Pistes à valider · audit de sécurité d'OmegaX (2026-10-25)

Onze pistes, toutes au verdict `needs_validation` : le code source les rend plausibles, mais aucune n'a été exécutée (aucun bac à sable isolé du système n'était disponible). Ce ne sont PAS des vulnérabilités confirmées, et aucune ne porte de gravité. L'ordre ci-dessous est une priorité de vérification, du plus large pouvoir en jeu au plus étroit.

Chaque piste reprend le texte des vérificateurs (en anglais, tel qu'il est consigné dans `findings.json`). Les vérifications du propriétaire sont en lecture seule ; n'envoyez jamais de trafic d'essai au service de production.

## 1. A co-administrator of the operator's dossier can reset the operator's password, strip its TOTP and pass the 2FA-gated platform console

Empreinte : `utilisateurs/reinitialiserMotDePasse:operator-2fa-reset-by-co-admin`

POST /utilisateurs/:id/reinitialiser-mot-de-passe is open to any ADMIN_CABINET of the dossier (class-level @Roles). UtilisateurService.reinitialiserMotDePasse looks the target up by id and tenantId only and writes a caller-chosen password hash plus SANS_DOUBLE_AUTH (secret, activation date, replay step and recovery codes cleared) with no exclusion of accounts whose estOperateurPlateforme is true; the flag is left untouched. The caller then logs in as the operator with the provisional password (TOTP no longer active, so the password alone yields a session marked connexionComplete), changes the password through the allowed provisional-password exit, initiates and activates TOTP with an authenticator it controls (activation only asks for the current password, which the caller set), and OperateurPlateformeGuard admits it: flag true, doubleAuthentificationActive reloaded true, full login under 8 h. The guard's stated purpose (a password stolen once must not open cross-tenant powers) is thereby bypassed by the password of any other admin of the operator's dossier, who need not have 2FA. The only reaction is detective: a reset notice and a 2FA-activation notice are queued to the operator's address through the tenant's own mail queue (readable by the same admin, possibly without transport); nothing refuses the transition.

**Cause supposée.** The tenant-level password reset treats the platform-operator account like any collaborator: it accepts an admin-chosen secret and removes the operator's second factor, while the operator privilege (estOperateurPlateforme) is kept and is not tied to the identity proof that was removed.

**Chemin dans le code.**

- entrypoint · `src/modules/utilisateurs/utilisateur.controller.ts:71` (POST /utilisateurs/:id/reinitialiser-mot-de-passe) · Authenticated route guarded by JwtAuthGuard, LicenceGuard and RolesGuard with class-level @Roles(ADMIN_CABINET); the body field motDePasseProvisoire (min 10 chars) is chosen by the caller and forwarded with the session tenantId and the path id.
- propagation · `src/modules/utilisateurs/utilisateur.service.ts:273` (UtilisateurService.reinitialiserMotDePasse) · Target found by { id, tenantId } only; no check of estOperateurPlateforme, of the target's role, or of the target holding a stronger assurance than the caller.
- propagation · `src/modules/utilisateurs/utilisateur.service.ts:284` (UtilisateurService.reinitialiserMotDePasse) · Update writes the bcrypt hash of the caller-chosen password, doitChangerMotDePasse, session revocation, lockout reset and ...SANS_DOUBLE_AUTH; estOperateurPlateforme is not touched.
- propagation · `src/modules/auth/auth.service.ts:523` (AuthService login) · With TOTP cleared, password-only login emits a session with connexionComplete: 'maintenant'.
- propagation · `src/modules/auth/auth.service.ts:635` (AuthService.activerDoubleAuth) · After initierDoubleAuth, activation checks only the current password (known to the caller) and a code from the secret the caller just obtained, sets doubleAuthActiveDepuis and reissues the session as a complete login.
- sink · `src/modules/plateforme/operateur-plateforme.guard.ts:40` (OperateurPlateformeGuard.canActivate) · Checks flag (line 32), doubleAuthentificationActive (line 40) and login age only; all three now hold for a principal that never held the operator's original factor, so the /plateforme console is admitted.

**Éléments relus.**

- `src/modules/auth/double-authentification.ts:168` · SANS_DOUBLE_AUTH clears secretDoubleAuth, doubleAuthActiveDepuis, dernierPasDoubleAuth and codesSecoursDoubleAuth; its comment assumes the resetter already holds the account's entry, without considering operator accounts.
- `src/modules/plateforme/operateur-plateforme.guard.ts:37` · Comment states 2FA is required because a password stolen once would otherwise give the keys to every cabinet.
- `src/modules/utilisateurs/utilisateur.controller.ts:16` · Class-level @Roles(RoleUtilisateur.ADMIN_CABINET): any admin of the dossier may call the reset on any user of the dossier.
- `src/modules/auth/jwt.strategy.ts:191` · doubleAuthentificationActive is recomputed per request from doubleAuthActiveDepuis, so the caller's re-enrolment is accepted immediately.
- `src/modules/utilisateurs/avis-acces.service.ts:161` · annoncerReinitialisation only queues a notice in the same tenant's mail queue; detective, not preventive.

**Ce qui manque pour trancher.**

- No OS-enforced sandbox on the audit host, so the bounded local reproduction could not be run in this source-only run.
- Whether the dossier that holds the production operator account (estOperateurPlateforme) has, or can be given, another ADMIN_CABINET user, and whether that user lacks 2FA, is deployment data not visible in source; it decides whether the escalation is reachable in practice.

**Vérification locale bornée.** On a disposable PostgreSQL database with the compiled server: tenant E with users op (ADMIN_CABINET, estOperateurPlateforme=true, TOTP active) and adm (ADMIN_CABINET, no TOTP). As adm, POST /utilisateurs/<op id>/reinitialiser-mot-de-passe {"motDePasseProvisoire":"Provisoire-123456"}; POST /auth/login as op with that password (no code); change the password through the provisional-password exit; call the TOTP initiate route, then activate with motDePasseActuel and a code generated locally from the returned secret; then GET /plateforme/cabinets. Vulnerable if 200; fixed if the reset is refused (403/409) for an estOperateurPlateforme target or the 2FA is never cleared on such an account. Same check for role change and deactivation of that account.

**Vérification par le propriétaire (lecture seule).** Owner-observed, read-only: for each account with estOperateurPlateforme=true, count other active ADMIN_CABINET users in the same tenantId and whether they have doubleAuthActiveDepuis set; review the audit chain for password resets (User updates clearing secretDoubleAuth) targeting operator accounts. Do not send audit traffic to the deployment.

## 2. Platform-operator flag granted at boot to whichever account holds a listed address, with no proof of address ownership

Empreinte : `plateforme/onModuleInit:operator-grant-by-unverified-email`

PlateformeService.onModuleInit runs on every server instance start and, outside tenant isolation, sets estOperateurPlateforme=true on any User whose stored email exactly equals an address in OPERATEURS_PLATEFORME. No source-visible door that writes a User email proves control of the address or reserves listed operator addresses: POST /auth/changer-adresse (any authenticated user, all five roles, own current password only; uniqueness enforced by the DB constraint only), POST /utilisateurs (ADMIN_CABINET chooses email and password), and POST /groupe/cellules (siege chooses the cell admin email via register). The grant is accord-only, the code comment explicitly anticipates listing an address before its account exists, and the operator flag stays on the account when its holder changes address, so a still-listed old address becomes free. If, at some boot, a listed address is held by no User row (pre-listed associate, address vacated by the operator's own change, typo in the secret), any tenant user can claim it via changer-adresse, wait for the next Cloud Run instance start, self-enrol TOTP (activerDoubleAuth mints connexionComplete) and then satisfy OperateurPlateformeGuard, which checks only the DB-reloaded flag, active TOTP and a recent full login, with no binding to the editor dossier or to a proven address. The result would be cross-tenant platform-console powers. If the self-service trial (INSCRIPTION_ESSAI) is enabled, an anonymous visitor can also obtain the needed account, but an existing tenant user already suffices. Whether any listed address is currently or historically unclaimed is a deployment fact.

**Cause supposée.** Operator identity is bound to a mutable, unverified email string rather than to an account identifier or a proven address: the boot grant (re-run on every instance start) trusts whichever account currently stores the listed email, while changerAdresse, UtilisateurService.creer and register accept any unclaimed address without ownership proof and without reserving addresses listed in OPERATEURS_PLATEFORME.

**Chemin dans le code.**

- entrypoint · `src/modules/auth/auth.controller.ts:233` (POST /auth/changer-adresse) · JwtAuthGuard only, opened to the payroll role too (@AccesRolesCantonnes gestionnairePaie); any authenticated user submits nouvelleAdresse plus their own current password.
- propagation · `src/modules/auth/auth.service.ts:753` (AuthService.changerAdresse) · Writes the normalized new address as the account email; only P2002 uniqueness is handled, no ownership verification and no check against OPERATEURS_PLATEFORME.
- propagation · `src/modules/utilisateurs/utilisateur.service.ts:80` (UtilisateurService.creer) · Parallel door: an ADMIN_CABINET creates a user with any unclaimed email and a password it chooses (doitChangerMotDePasse only forces a change by the same holder).
- propagation · `.github/workflows/deploy-cloud-run.yml:330` (deploy job env) · OPERATEURS_PLATEFORME is taken from secret API_OPERATEURS_PLATEFORME (documented as the way to add associates) or defaults to admin@vmgconsulting.net; the deployed value is not in the repository.
- propagation · `src/modules/plateforme/plateforme.service.ts:76` (PlateformeService.onModuleInit) · On each instance boot, inside horsCloisonnement, updateMany({where:{email, estOperateurPlateforme:false}, data:{estOperateurPlateforme:true}}) promotes whichever account in any dossier holds the address.
- propagation · `src/modules/auth/jwt.strategy.ts:190` (JwtStrategy.validate) · The flag is reloaded from the DB per request and exposed as request.user.estOperateurPlateforme.
- sink · `src/modules/plateforme/operateur-plateforme.guard.ts:32` (OperateurPlateformeGuard.canActivate) · Admits any request whose user has the flag, active TOTP and a full login under 8 h; all three are satisfiable by the claimant on its own account, with no binding to the editor dossier or a verified address.

**Éléments relus.**

- `src/modules/plateforme/plateforme.service.ts:53` · Comment: an address not yet known is not an error; the account will be promoted at the first restart after its creation (pre-listing is a designed workflow).
- `src/modules/plateforme/plateforme.service.ts:50` · Grant only, never automatically revoked; revocation is a manual SQL step, so a listed address stays granting across boots.
- `src/modules/auth/auth.service.ts:741` · Comment: role, dossier and operator flag are on the account, not the address, and follow an address change, so an operator changing address leaves the old listed address free unless the list is updated.
- `src/modules/groupe/groupe.service.ts:471` · creerCellule calls register with a siege-chosen emailAdmin; a third door setting an unverified email.
- `src/modules/auth/auth.service.ts:635` · activerDoubleAuth reissues the session with connexionComplete=true, so the claimant satisfies the console's 2FA and recent-full-login requirements on its own account.

**Ce qui manque pour trancher.**

- Decisive deployment fact outside the repository: whether the deployed OPERATEURS_PLATEFORME (secret API_OPERATEURS_PLATEFORME, or the default admin@vmgconsulting.net) currently or at any past boot contained an address held by no User row. Without such an address the path yields nothing.
- No OS-enforced sandbox is available on the audit host for this run, so the local reproduction (claim a listed unclaimed address, restart, enrol TOTP, call a /plateforme route) could not be executed and no observed result exists.

**Vérification locale bornée.** On a disposable PostgreSQL with the compiled server inside an isolated sandbox: start with OPERATEURS_PLATEFORME=op@example.invalid and no account holding that address; create tenant A with a COMPTABLE user; as that user call POST /auth/changer-adresse {"motDePasseActuel":"<its password>","nouvelleAdresse":"op@example.invalid"}; restart the server; enrol TOTP via the 2FA activation route with password and code; then GET /plateforme/cabinets with the resulting session. Vulnerable if 200; fixed if changer-adresse (and POST /utilisateurs, register) refuse a listed address or the grant is bound to a user id or verified address.

**Vérification par le propriétaire (lecture seule).** Owner-run, read-only: for each address in the deployed OPERATEURS_PLATEFORME value (and any historical value of the secret), count User rows with that exact email and report estOperateurPlateforme for each; any listed address with zero rows is claimable now. Also review the audit chain for User email updates whose new value is a listed address, and list all accounts with estOperateurPlateforme=true to confirm each is a known VMG operator.

## 3. Production secrets are repository-scoped and reachable by workflows run from non-main refs, bypassing the main-only deploy gate

Empreinte : `ci/production-secrets-repository-scoped-reachable-from-branch-workflows`

No workflow in .github/workflows declares `environment:`; every production credential (API_DATABASE_URL direct endpoint to the multi-tenant database, API_DATABASE_URL_POOLED, GCP_SA_KEY used for the Cloud Run deploy and the backup bucket, API_JWT_SECRET that signs every session including the platform operator's, API_CLE_PRIVEE_LICENCE, API_SMTP_*, FIREBASE_SERVICE_ACCOUNT_OMEGA_X_EC07A) is read as a plain `secrets.*`, which source-wise implies repository or organisation scope. GitHub runs a workflow from the triggering ref, so the only control on the production job, the `if: github.ref == 'refs/heads/main' && (push || workflow_dispatch)` expression of deploy-cloud-run.yml, binds only the copy of the file on main. A principal who can push a non-main branch but cannot merge to main (the repository rules require agent sessions to push `travail/<ligne>` branches and assume they are safe because the `on: push` triggers on main are bounded to main) could (a) push a branch carrying a new or edited workflow with `on: push` on that branch, or a same-repo pull request whose `pull_request` workflows are taken from the PR head, and reference any repository secret; or (b) without touching any workflow file, open a same-repo pull request that changes client/package.json or client/vite.config.ts: firebase-hosting-pull-request.yml runs `npm ci && npm run build` of that PR-controlled code and, in the same job on the same runner, then hands FIREBASE_SERVICE_ACCOUNT_OMEGA_X_EC07A (project omega-x-ec07a, the same GCP project as the Cloud Run service) to action-hosting-deploy. Possible result if the hosted facts hold: a branch writer obtains production database read/write over all tenants, the deploy identity, live Hosting deploy and the JWT signing secret (forgeable sessions for any user). Whether a lower-trust branch writer exists, and whether the secrets are in fact repository/organisation scoped, are not observable from source.

**Cause supposée.** Production secrets are not bound to a protected GitHub environment with a main-only deployment-branch policy (and reviewers); the only gate is an `if:` expression inside a workflow file, which binds only the copy on main, while same-repo pull_request workflows execute PR-controlled build code in a job that then receives a deploy credential.

**Chemin dans le code.**

- entrypoint · `.github/workflows/firebase-hosting-pull-request.yml:4` (on: pull_request) · Same-repo pull request (non-main head ref, Dependabot and forks excluded at line 23) triggers this workflow; GitHub evaluates the workflow and the checked-out code from the PR head.
- propagation · `.github/workflows/firebase-hosting-pull-request.yml:35` (jobs.build_and_preview, step `npm ci && npm run build` (working-directory client)) · PR-controlled client/package.json scripts, dependency install scripts and Vite config execute on the runner before the deploy step of the same job.
- propagation · `.github/workflows/firebase-hosting-pull-request.yml:44` (FirebaseExtended/action-hosting-deploy@v0 with firebaseServiceAccount) · The Firebase deploy service account secret is materialised in a later step of the job whose runner the PR code already controls; the same secret deploys the live site in firebase-hosting-merge.yml.
- propagation · `.github/workflows/deploy-cloud-run.yml:238` (jobs.migrer-et-deployer.if) · The only gate on the production secrets is this expression in the workflow file itself; no `environment:` key on the job (line 229), so a workflow authored or edited in another ref is not bound by it.
- sink · `.github/workflows/deploy-cloud-run.yml:261` (step `Appliquer les migrations Prisma`) · secrets.API_DATABASE_URL (direct production endpoint) is referenced without environment binding; GCP_SA_KEY (line 265), API_JWT_SECRET (317), SMTP secrets (339-344) and API_CLE_PRIVEE_LICENCE (348) likewise, so any workflow in the repository can reference them identically.

**Éléments relus.**

- `.github/workflows/deploy-cloud-run.yml:229` · Job migrer-et-deployer has no `environment:` key; grep finds no `environment:` in any of the nine workflow files.
- `.github/workflows/deploy-cloud-run.yml:31` · The workflow also triggers on pull_request; for a same-repo PR the PR head's copy of the file runs (verifier job reads no secret in the main copy).
- `.github/workflows/firebase-hosting-merge.yml:53` · The same FIREBASE_SERVICE_ACCOUNT_OMEGA_X_EC07A deploys the live channel on push to main.
- `.github/workflows/sauvegarde-base.yml:113` · API_DATABASE_URL referenced from a second workflow (and GCP_SA_KEY at line 338) without environment, consistent with repository-level scope.
- `.github/workflows/requetes-production.yml:95` · workflow_dispatch with API_DATABASE_URL; the read-only PGOPTIONS and the textual filter are defined in the dispatched ref's own files, so they bind only the copy being run.
- `CLAUDE.md:175` · States that no workflow deploys the `travail/<ligne>` backup branches because the `on: push` are bounded to main, i.e. the design relies on main's workflow files rather than on secret scoping.

**Ce qui manque pour trancher.**

- Whether these secrets are repository/organisation secrets or environment secrets with a main-only branch policy is not observable from source (only the absence of `environment:` in the workflows is).
- Who can push non-main branches or open same-repo pull requests without being able to merge to main (collaborators, GitHub Apps, agent-session tokens) and whether rulesets restrict branch creation is not observable; if every branch writer is already fully trusted with main, no privilege boundary is crossed.
- Whether those tokens can push `.github/workflows/**` changes (GitHub requires the `workflow` scope / `workflows` app permission) is not observable; this decides path (a) but not path (b), which needs no workflow change.
- The IAM roles of the Firebase service account in project omega-x-ec07a (Hosting only, or broader on Cloud Run/Storage) are not observable and bound the impact of path (b).
- No OS-enforced sandbox and no fixture GitHub repository are available in this run; nothing was executed.

**Vérification locale bornée.** In a throwaway GitHub repository (no real credentials) with repository secret DUMMY_MARKER: (1) push branch `travail/test` adding a workflow `on: push: branches: [travail/test]` whose single step writes `sha256(${{ secrets.DUMMY_MARKER }})` to the step summary; observe whether it resolves the marker; (2) open a same-repo PR that changes a `build` script in a copy of client/package.json to append the job's environment variable names (not values) and the list of processes visible on the runner to the summary, with a later step passing DUMMY_MARKER via `with:` to a dummy action, and observe whether the build step's code can observe that later step; (3) move DUMMY_MARKER to an environment `production` restricted to main and confirm both runs now see an empty value.

**Vérification par le propriétaire (lecture seule).** Owner observes, without running any audit traffic: in Settings > Secrets and variables > Actions, the scope (repository, organisation or environment) of API_DATABASE_URL, API_DATABASE_URL_POOLED, GCP_SA_KEY, API_JWT_SECRET, API_CLE_PRIVEE_LICENCE, API_SMTP_* and FIREBASE_SERVICE_ACCOUNT_OMEGA_X_EC07A; in Settings > Collaborators/Integrations and Rules, which users, apps and agent tokens can push non-main branches or `.github/workflows/**` and whether any ruleset restricts them; the IAM roles of the Firebase service account in project omega-x-ec07a; and the Actions history for runs on `travail/*` refs or same-repo PRs. Remediation if confirmed: move the production secrets into a `production` environment with deployment-branch policy `main` and required reviewers, add `environment: production` to migrer-et-deployer, sauvegarde-base, requetes-production and firebase-hosting-merge, give the PR preview a separate preview-only Hosting identity, and replace GCP_SA_KEY with Workload Identity Federation bound to `environment:production`.

## 4. Operator console can graft any client dossier into a group it controls and read or write that client's ledger

Empreinte : `plateforme/modifierGroupe:operator-bridges-client-dossier-into-own-group`

PATCH /plateforme/cabinets/:tenantId/groupe (operator only) sets dossierMereId of an existing client dossier to any mother dossier, subject only to structural checks (target has no cells, is not the editor dossier, mother is not itself a cell, same referentiel and, under SYSCOHADA, same system). No consent, notice or artefact from the client is required, and the client's licence is overwritten with the mother's. POST /plateforme/cabinets lets the operator create a dossier with an admin address of its choice and returns the generated temporary password to the operator, so the operator can hold credentials for a mother. Logged into that mother, GET /groupe/cellules/:victimId/balance?exerciceId=<victim exercise> returns the victim's trial balance (all roles of the mother), and for SYCEBNL dossiers GET /groupe/cellules/:victimId/canevas exports a canevas and POST /groupe/cellules/:victimId/import-canevas (ADMIN_CABINET or COMPTABLE) creates draft (brouillard) entries in the victim's treasury journal. The console UI exposes the rattachement select (client/src/pages/PlateformePage.tsx:288-295), so this is a reachable, documented console function. It conflicts with the stated rule that VMG never sees a client's information, which was the reason reinitialiserAdmin stopped revealing passwords; whether the operator is inside the threat model for this capability is an owner decision.

**Cause supposée.** Group membership (Tenant.dossierMereId), the sole input from which GroupeService.dansLeGroupe builds the widened perimetreDeGroupe scope, is set unilaterally by the platform operator with no client-side consent, while the same operator can obtain working credentials for an arbitrary mother dossier through creerCabinet.

**Chemin dans le code.**

- entrypoint · `src/modules/plateforme/plateforme.controller.ts:124` (PATCH /plateforme/cabinets/:tenantId/groupe (controller-level JwtAuthGuard + OperateurPlateformeGuard, line 36)) · Operator supplies the victim tenantId and a dossierMereId of a mother dossier it created.
- propagation · `src/modules/plateforme/plateforme.service.ts:351` (PlateformeService.modifierGroupe) · After structural checks only (no cells, not editor licence, verifierMere: mother not a cell, same referentiel/system), writes victim.dossierMereId and aligns the victim licence on the mother's (lines 353-358).
- propagation · `src/modules/plateforme/plateforme.service.ts:510` (PlateformeService.creerCabinet) · Returns motDePasseTemporaire (generated at line 458) for the operator-chosen emailAdmin, giving the operator a usable mother account (it must change the password at first login, which it can).
- propagation · `src/modules/groupe/groupe.service.ts:382` (GroupeService.dansLeGroupe) · Builds the perimetreDeGroupe list from tenants whose dossierMereId equals the session dossier, now including the victim.
- propagation · `src/modules/groupe/groupe.service.ts:1412` (GroupeService.celluleDuGroupe) · Membership check (id = celluleId and dossierMereId = session tenant) passes on the grafted link.
- sink · `src/modules/groupe/groupe.service.ts:1565` (GroupeService.balanceCelluleDuGroupe) · Returns ecritureService.balance(victimId, exerciceId) to the mother's session; importerCanevasDuGroupe (line 1675 onwards) creates draft entries in the victim for SYCEBNL dossiers.

**Éléments relus.**

- `src/common/cloisonnement/contexte-cloisonnement.ts:88` · perimetreDeGroupe admits the session dossier plus the server-built list; its correctness rests entirely on dossierMereId.
- `src/modules/groupe/groupe.controller.ts:82` · GET /groupe/cellules/:celluleId/balance carries no @Roles, open to every role of the mother dossier; canevas routes (lines 91-110) are SYCEBNL-only, import restricted to ADMIN_CABINET and COMPTABLE.
- `src/modules/plateforme/plateforme.service.ts:549` · Comment records the decision that the console must never know a client password because VMG must not see client information; modifierGroupe applies no comparable control.
- `client/src/pages/PlateformePage.tsx:288` · The console UI sends PATCH /plateforme/cabinets/:id/groupe with an operator-selected dossierMereId, so the function is exposed, not latent.

**Ce qui manque pour trancher.**

- No OS-enforced sandbox is available on the audit host, so the end-to-end read of a grafted dossier's balance cannot be observed locally in this run.
- Whether operator-initiated attachment of an existing client dossier to an operator-controlled mother is an accepted operational capability or a breach of the stated rule that VMG never sees a client's information is an owner policy decision not answerable from source.

**Vérification locale bornée.** In a sandbox with a disposable PostgreSQL: create client dossier V (SYCEBNL, no cells) with one validated entry; as an operator account with TOTP and a fresh full login, POST /plateforme/cabinets {nomEntite:'M',emailAdmin:'m@example.test',referentiel:'SYCEBNL'} and keep motDePasseTemporaire; PATCH /plateforme/cabinets/<V>/groupe {dossierMereId:<M>}; log in as m@example.test, change the password, then GET /groupe/cellules/<V>/balance?exerciceId=<V exercise id>. Expected if vulnerable: V's balance lines are returned to M's session. Regression after fix: the PATCH is refused for an existing dossier without a recorded consent from V's administrator.

**Vérification par le propriétaire (lecture seule).** Owner check (read-only, no audit traffic): list tenants whose dossierMereId was set through the console (audit chain entries for Tenant updates) and confirm each attachment was requested by the cell's own administrator; state whether operator-side attachment without client consent is intended.

## 5. Double regard at validation is bypassed silently by rewriting a colleague's draft before validating it

Empreinte : `src/modules/comptabilite/ecriture.service.ts:valider:double-regard-createdBy-ignores-modification`

When a dossier enables Tenant.doubleRegardValidation, EcritureService.valider sets aside only the brouillard entries whose createdBy equals the validator (ecriture.service.ts:2275). PATCH /ecritures/:id (ADMIN_CABINET, COMPTABLE; AIDE_COMPTABLE by inheritance) calls modifier without the acting user, and modifier rewrites date, libelle, reference and, when lignes are sent, deletes and recreates every line (ecriture.service.ts:1622-1633) without touching or recording any content author; POST /ecritures/reimputation on brouillard lines likewise moves compteId in place (ecriture.service.ts:2738). A comptable C can therefore take a draft created by comptable B, replace its whole content, then validate it via POST /ecritures/valider: createdBy (B) differs from valideeBy (C), the entry enters the livre-journal irreversibly with no secondRegardNom stamp, and reads as a two-person review although only C saw the final content. The after-the-fact control VALIDATION_PAR_SON_AUTEUR (controles.service.ts:1789) uses the same createdBy predicate and stays silent. Calibration: the service already lets any validator bypass the double regard by a nominative derogation (secondRegardNom + secondRegardMotif, visaSecondRegard at ecriture.service.ts:2316), but that path stamps the entry and is excluded from the control by design; the rewrite path produces the same outcome with no stamp on the entry, only an Ecriture header update in the generic audit chain (LigneEcriture is not an audited model). Impact is limited to the integrity of the tenant's own maker-checker control by an insider holding a validating role; no cross-tenant or privilege escalation.

**Cause supposée.** The maker-checker invariant is keyed on the immutable creation author (Ecriture.createdBy) instead of on whoever last entered the content; the brouillard modification paths (EcritureService.modifier, reimputer on brouillard lines) neither take the acting user nor record a content author that valider could compare against.

**Chemin dans le code.**

- entrypoint · `src/modules/comptabilite/ecriture.controller.ts:137` (PATCH /ecritures/:id (Roles ADMIN_CABINET, COMPTABLE)) · Authenticated modification of a brouillard entry; the controller passes user.tenantId, id and dto to modifier but not user.userId.
- propagation · `src/modules/comptabilite/ecriture.service.ts:1625` (EcritureService.modifier) · tx.ecriture.update rewrites date, libelle, reference and recreates all lines after ligneEcriture.deleteMany (1622); no author or modifier field is written, createdBy keeps the original user.
- propagation · `src/modules/comptabilite/ecriture.service.ts:2738` (EcritureService.reimputer (brouillard branch)) · Variant: brouillard lines are moved to another account by ligneEcriture.updateMany in place, without changing the entry's createdBy.
- propagation · `src/modules/comptabilite/ecriture.controller.ts:192` (POST /ecritures/valider (ReserveAuComptable, Roles ADMIN_CABINET, COMPTABLE)) · The user who rewrote the draft validates it; valideeBy = user.userId.
- sink · `src/modules/comptabilite/ecriture.service.ts:2275` (EcritureService.valider double regard partition) · ecartees = soumises.filter(e => e.createdBy === valideeBy); the rewritten entry is not set aside and updateMany (2281) sets statut VALIDEE, valideeBy, valideeAt irreversibly, without a secondRegardNom stamp.

**Éléments relus.**

- `src/modules/comptabilite/ecriture.service.ts:2275` · Only createdBy is compared with the validator in the double regard partition.
- `src/modules/comptabilite/ecriture.service.ts:1555` · modifier(tenantId, ecritureId, dto, options) has no user parameter; nothing records who changed the content.
- `prisma/schema.prisma:2001` · Ecriture carries createdBy, valideeBy and the derogation fields only; no last-content-author field exists for the double regard to use.
- `src/modules/controles/controles.service.ts:1789` · The VALIDATION_PAR_SON_AUTEUR control also tests e.createdBy === e.valideeBy, so the rewritten-then-self-validated entry is not reported.
- `src/modules/comptabilite/ecriture.controller.ts:138` · Modification is open to COMPTABLE, the same role that validates (and to AIDE_COMPTABLE by inheritance).
- `src/modules/comptabilite/ecriture.service.ts:2316` · Calibration: the nominative derogation also lets a self-validator pass, but it stamps secondRegardNom/secondRegardMotif on the entry; the rewrite path reaches the same result without any stamp.

**Ce qui manque pour trancher.**

- No OS-enforced sandbox is available on the audit host for this run, so target code (compiled server and a disposable PostgreSQL) cannot be executed; the bypass is established from source but the end-to-end result (validees=1, refuseesSecondRegard=0 for an entry rewritten and validated by the same user) has not been observed locally.

**Vérification locale bornée.** In an isolated sandbox with no network, run the compiled server against a disposable PostgreSQL. Create a tenant with doubleRegardValidation=true, an open exercice, a non-treasury journal, two personalised detail accounts, and two COMPTABLE users B and C. As B, POST /ecritures a balanced brouillard entry (e.g. D 1000 / C 1000). As C, PATCH /ecritures/:id with different libelle and a different balanced lignes set. As C, POST /ecritures/valider {"ecritureIds":[id]} with no derogation fields. Secure result: refuseesSecondRegard=1, statut stays BROUILLARD. Source-predicted result: validees=1, statut VALIDEE, createdBy=B, valideeBy=C, secondRegardNom null, and GET of the self-validation control shows nothing for this entry. Repeat with POST /ecritures/reimputation on the draft's line by C instead of PATCH. Regression test after the fix: valider by the last content author (modifier or reimputer actor) must be set aside.

## 6. Circularisation request accepts another tenant's tiers id and returns that tiers' code and name

Empreinte : `circularisation/creerDemande:tiersId-not-bound-to-tenant`

POST /circularisation/:id/demandes (ADMIN_CABINET or COMPTABLE, active licence, campaign in PREPARATION) stores dto.tiersId on a DemandeConfirmation without checking that the Tiers belongs to the session tenant; only compteId is looked up with a tenant bound. GET /circularisation/:id (any authenticated role of the tenant) then reads the campaign with include demandes.tiers { code, nom } and returns the whole object. The tenant-isolation Prisma extension runs only on top-level model operations ($allModels.$allOperations): on create it compares data.tenantId alone, and a unit read whose where is bound to the session tenant is returned without inspecting included relation rows. The database FK demandes_confirmation.tiersId -> tiers.id has no tenant component. A user of tenant A who already knows the UUID of a Tiers of tenant B can therefore make OmegaX return B's tiers code and name and keep a durable cross-tenant reference in A's data. Tiers ids are random v4 UUIDs (@default(uuid())), so exploitation requires an id obtained out of band.

**Cause supposée.** CircularisationService.creerDemande validates compteId with a tenant-bound findFirst but writes tiersId: dto.tiersId ?? null with no ownership check; the cloisonnement extension does not verify scalar foreign-key targets in create data or rows returned through include, and the FK has no tenant component, so no other layer rejects or filters the foreign Tiers.

**Chemin dans le code.**

- entrypoint · `src/modules/circularisation/circularisation.controller.ts:56` (POST :id/demandes (creerDemande)) · Controller guarded by JwtAuthGuard, LicenceGuard, RolesGuard; @Roles ADMIN_CABINET, COMPTABLE; body CreerDemandeDto passed with user.tenantId.
- propagation · `src/modules/circularisation/circularisation.service.ts:256` (creerDemande) · Only compteId is looked up with { id: dto.compteId, tenantId }; tiersId is never looked up in the service.
- propagation · `src/modules/circularisation/circularisation.service.ts:278` (creerDemande demandeConfirmation.create) · tiersId: dto.tiersId ?? null is written alongside tenantId of the session.
- propagation · `src/common/cloisonnement/extension-cloisonnement.ts:261` (garderCloisonnement CREATIONS) · Creation check reads only dossierCree(data) (tenantId / tenant.connect.id); scalar FKs like tiersId are not inspected, then query(args) runs.
- propagation · `src/common/cloisonnement/extension-cloisonnement.ts:349` (garderCloisonnement LECTURES_UNITAIRES) · A unit read whose where is bound to the session tenant is returned as-is; included relation rows (demandes.tiers) are never verified.
- sink · `src/modules/circularisation/circularisation.service.ts:584` (consulter) · campagneCircularisation.findFirst({ where: { id, tenantId }, include: { demandes: { include: { tiers: { select: { code, nom } } } } } }) result is spread into the response (line 611), returning the foreign Tiers' code and nom.

**Éléments relus.**

- `src/modules/circularisation/dto/circularisation.dto.ts:45` · tiersId is optional and validated only with @IsUUID.
- `src/modules/circularisation/circularisation.service.ts:278` · tiersId stored directly from the DTO; the only other tiersId/tiers occurrences in the service are comments and the include at line 584.
- `prisma/migrations/20260918180000_circularisation/migration.sql:67` · FK demandes_confirmation.tiersId -> tiers.id ON DELETE SET NULL has no tenant component; no later migration adds one (only a unique index on campagneId, compteId).
- `src/common/cloisonnement/extension-cloisonnement.ts:59` · dossierCree only reads tenantId and tenant.connect.id from creation data.
- `src/common/cloisonnement/extension-cloisonnement.ts:373` · Extension hooks $allModels.$allOperations only, so nested include reads are not separately intercepted.
- `src/modules/commercial/commercial.service.ts:161` · Sibling path (devis tiersId) validates the tiers with { id: dto.tiersId, tenantId } and 'Tiers introuvable dans ce dossier.', showing the intended policy.
- `prisma/schema.prisma:2837` · Tiers.id is @default(uuid()), random and not enumerable, so the attacker needs an id leaked out of band.

**Ce qui manque pour trancher.**

- No OS-enforced sandbox on the audit host for this run: the compiled server was not executed against two dummy tenants, so the cross-tenant code/nom disclosure is source-inferred, not observed.
- How a Tiers UUID of another tenant can reach a user of a different cabinet (shared exports, a user who moved between cabinets, group relations) is not established from source; the ids are random v4 UUIDs.

**Vérification locale bornée.** On a disposable PostgreSQL with the compiled server: create tenants A and B via the normal pipeline; as admin of B create a Tiers (code T-B, nom 'Dummy B') and record its id; as COMPTABLE of A create an exercice and a circularisation campaign, then POST /circularisation/<campagneA>/demandes with { compteId: <a 401/411 compte of A>, tiersId: <tiers id of B>, destinataire: 'x' }; GET /circularisation/<campagneA> and check whether demandes[0].tiers equals { code: 'T-B', nom: 'Dummy B' }. Stop there. Regression after fix: the POST returns 404 'Tiers introuvable dans ce dossier.' and no row is created.

**Vérification par le propriétaire (lecture seule).** Owner check only, read-only, count only: SELECT count(*) FROM demandes_confirmation d JOIN tiers t ON t.id = d."tiersId" WHERE t."tenantId" <> d."tenantId"; a non-zero count shows an existing cross-tenant reference. Do not return ids or names.

## 7. Cloud Run service accepts direct public traffic while Express trusts two X-Forwarded-For hops, letting a caller choose req.ip

Empreinte : `deploy/cloud-run-public-ingress-forwarded-for-trust-two-hops`

The API is deployed with `gcloud run deploy --allow-unauthenticated` and no `--ingress` flag anywhere in the workflows, so unless ingress was restricted outside the workflow the run.app URL is reachable directly (the workflow's own health check and surveillance.yml call it directly). The server fixes Express `trust proxy` to 2 in hosted mode, which makes req.ip the second-from-right X-Forwarded-For entry, on the assumption that every request crossed Firebase Hosting and then the Cloud Run front end. On a direct run.app call only the front end appends an address, so if it appends rather than overwrites, the entry the caller wrote becomes req.ip (and req.ips[0], which @nestjs/throttler 6 uses as its default tracker, resolves to the same address under trust proxy 2). req.ip keys the global ThrottlerGuard (300/min) and the per-route auth throttles (inscription-essai 5/hour, login and other auth routes 20/min, register 30/hour), and is written as the actor address into the hash-chained audit log (audit context interceptor, CONNEXION link at login) and into the restitution export record. An anonymous caller could then rotate forged addresses to get a fresh throttle bucket per request (unbounded trial-tenant creation and outbound trial mails when INSCRIPTION_ESSAI is open; password spraying across accounts, still bounded per account by the database lockout) and plant chosen IP addresses in audit evidence. The source comment in sauts-de-confiance.ts acknowledges the gap and defers it to infrastructure.

**Cause supposée.** Ingress to Cloud Run is not restricted to the Firebase Hosting relay and the backend has no proof that a request came through it, while the proxy-trust depth is a fixed count that assumes every request traversed both relays.

**Chemin dans le code.**

- entrypoint · `.github/workflows/deploy-cloud-run.yml:492` (gcloud run deploy flags) · `--allow-unauthenticated` with no `--ingress` flag (none in any workflow); the direct run.app URL is also used by the post-deploy health check (line 580) and by surveillance.yml (URL_SANTE, line 28), showing it is meant to be publicly reachable.
- propagation · `src/common/sauts-de-confiance.ts:34` (SAUTS_EN_LIGNE / sautsDeConfiance) · Hosted mode trusts exactly two hops unless SAUTS_PROXY_CONFIANCE is set (it is not set by the deploy workflow); the comment at lines 20-24 records that a direct run.app call crosses one relay and leaves the client-written entry as the address.
- propagation · `src/bootstrap.ts:59` (configurerApplication) · `trust proxy` set to sautsDeConfiance() || false (2 in hosted mode); no middleware checks a relay-injected header or the request origin, and retirerPrefixeApi (lines 14-18) makes routes work identically without the /api relay prefix.
- propagation · `src/app.module.ts:90` (ThrottlerModule.forRoot / APP_GUARD ThrottlerGuard (line 161)) · Global throttle 300/min and per-route @Throttle limits use the default tracker of @nestjs/throttler ^6.5.0 (req.ips[0] or req.ip, equal under trust proxy 2), so each forged address gets its own bucket.
- sink · `src/common/audit/audit-contexte.interceptor.ts:32` (acteur.adresseIp) · req.ip recorded as the actor address of every audited act in the hash-chained audit log; also passed to the CONNEXION link at login (src/modules/auth/auth.controller.ts line 141) and to the restitution record (src/modules/exports/restitution/restitution.controller.ts line 56).

**Éléments relus.**

- `src/common/sauts-de-confiance.ts:21` · Source comment: a direct call to *.run.app crosses only one relay so the second entry from the right is the client's own, and closing it requires admitting only Firebase traffic to Cloud Run in infrastructure.
- `src/modules/auth/auth.controller.ts:120` · Trial sign-up throttled to 5 per hour per tracked address; each accepted request creates a tenant and sends a mail when INSCRIPTION_ESSAI is open.
- `src/modules/auth/auth.controller.ts:135` · Login throttled to 20 per minute per tracked address; the per-account lockout (src/modules/auth/verrouillage.ts) still applies, so the bypass matters for spraying across accounts.
- `.github/workflows/deploy-cloud-run.yml:498` · Deploy command ends with --env-vars-file; no `--ingress internal-and-cloud-load-balancing` or equivalent, and no SAUTS_PROXY_CONFIANCE override, anywhere in the workflow.
- `src/modules/exports/restitution/restitution.controller.ts:56` · req.ip stored as adresseIp of the restitution requester.

**Ce qui manque pour trancher.**

- Effective ingress setting and invoker IAM of the deployed comptaflow-api service are not observable from source (gcloud run deploy without --ingress keeps whatever value the service already has, which could have been restricted in the console).
- Whether the Cloud Run front end appends to, rather than overwrites, a client-supplied X-Forwarded-For header on a direct run.app request (and the exact header Firebase Hosting forwards) is a hosted-provider fact not observable from source; it decides whether the forged entry reaches req.ip.
- No OS-enforced sandbox is available on the audit host for this run, so the Express/proxy-addr selection under trust proxy 2 was not executed locally.

**Vérification locale bornée.** In an isolated sandbox with no network, start a minimal Express 4.22 app with `app.set('trust proxy', 2)` and a route returning JSON {ip: req.ip, ips: req.ips}; send one request with header `X-Forwarded-For: 203.0.113.9, 198.51.100.7` (forged entry, then the address a single front end would append) and expect ip = 203.0.113.9 and ips[0] = 203.0.113.9; send a second with `X-Forwarded-For: 203.0.113.9, 198.51.100.7, 35.0.0.1` (forged, client, Firebase) and expect ip = 198.51.100.7, showing the Firebase path is not forgeable while the direct path is.

**Vérification par le propriétaire (lecture seule).** Owner runs `gcloud run services describe comptaflow-api --region us-east1 --format='value(metadata.annotations."run.googleapis.com/ingress")'` and `gcloud run services get-iam-policy comptaflow-api --region us-east1`; if ingress is `all`, the owner, against a non-production revision of the same image deployed the same way, sends one GET /health directly to its run.app URL with `X-Forwarded-For: 203.0.113.9` and reads a temporary debug log line of req.ip. Remediation if confirmed: restrict ingress so only the relay path reaches the service (external HTTPS load balancer with internal-and-cloud-load-balancing ingress), or require a relay-injected secret header verified before trusting forwarded addresses (otherwise treat trust proxy as 0), and move the health checks to the relay URL.

## 8. Uploaded xlsx parsed with no bound on decompressed size or cell count

Empreinte : `xlsx-load-without-decompressed-size-bound`

The ledger import (POST /import/analyser and /import/executer, ADMIN_CABINET), the bank statement import (POST /rapprochements/:id/releve), the consolidation entity balance import and the group cash canvas import (POST /groupe/cellules/:celluleId/import-canevas) decode a base64 xlsx and hand the whole buffer to ExcelJS xlsx.load. The only source-visible bounds apply to the compressed transfer (Express json limit 12mb; DTO MaxLength 11,000,000 base64 characters on the import DTO; none at all on ImporterBalanceEntiteDto). An xlsx is a ZIP container; nothing checks the declared uncompressed entry sizes, total expanded size, row count or cell count before or during parsing, and lireXlsx then copies every row of the first sheet into arrays. The hosted service runs one Node process per Cloud Run instance with --concurrency 80 and --max-instances 4 and no --memory flag in the workflow, so if a small compressed workbook expands beyond the instance heap, one authenticated tenant could crash or stall an instance and abort concurrent requests of other tenants. Whether ExcelJS 4.x actually expands such input to exhaustion, and the deployed memory limit and recovery, are not source-visible.

**Cause supposée.** lireXlsx (src/modules/import/lecture-fichier.ts) and GroupeService.importerCanevasDuGroupe call ExcelJS xlsx.load on an untrusted archive after checking only that the buffer is non-empty and the encoded transfer is within the body/DTO limit; there is no limit on uncompressed entry size, total expanded size, row count or cell count.

**Chemin dans le code.**

- entrypoint · `src/modules/import/import.controller.ts:22` (ImportController.analyser · POST /import/analyser (JwtAuthGuard, LicenceGuard, RolesGuard, ADMIN_CABINET)) · Accepts AnalyserImportDto carrying nomFichier and contenuBase64 from an authenticated tenant administrator; rapprochement POST :id/releve, consolidation entity balance import and groupe import-canevas reach the same kind of sink
- propagation · `src/bootstrap.ts:65` (configurerApplication) · app.use(json({ limit: '12mb' })) is the only aggregate bound, applied to the encoded (compressed) request body
- propagation · `src/modules/import/lecture-fichier.ts:217` (lireFichier) · Buffer.from(contenuBase64, 'base64'); only rejects an empty buffer, then dispatches a name ending in .xlsx to lireXlsx
- sink · `src/modules/import/lecture-fichier.ts:165` (lireXlsx) · await classeur.xlsx.load(contenu) parses the whole workbook in the shared process heap with no expanded-size or cell-count bound; feuille.eachRow then copies every row into the toutes array

**Éléments relus.**

- `src/modules/import/dto/import.dto.ts:15` · TAILLE_MAX_BASE64 = 11_000_000, applied by @MaxLength at line 25, limits only the encoded transfer
- `src/modules/consolidation/dto/perimetre.dto.ts:152` · ImporterBalanceEntiteDto.contenuBase64 is @IsString() with no MaxLength; it relies on the 12mb body cap
- `src/modules/consolidation/cumul.service.ts:123` · Consolidation balance import calls lireFichier on the uploaded content, reaching the same lireXlsx sink
- `src/modules/groupe/groupe.service.ts:1682` · Second sink: wb.xlsx.load(contenu) on the uploaded group cash canvas with no expanded-size bound; the marker and data-row checks run only after the full load
- `src/modules/rapprochement/rapprochement.service.ts:921` · Bank statement import calls lireFichier after only checking that the reconciliation is in progress
- `.github/workflows/deploy-cloud-run.yml:496` · --concurrency 80 with --max-instances 4 and no --memory flag: up to 80 requests from different tenants share one Node process per instance
- `Dockerfile:49` · Runtime CMD node dist/main.js with no NODE_OPTIONS heap setting; effective heap depends on the undeclared Cloud Run memory limit

**Ce qui manque pour trancher.**

- No OS-enforced sandbox is available on the audit host, so no fixture could be parsed to observe ExcelJS memory growth; target code was not executed
- ExcelJS 4.x (package.json ^4.4.0) expansion behaviour and peak memory per compressed input byte are not source-visible here (node_modules absent)
- The deployed Cloud Run memory limit (no --memory flag in the workflow) and the restart and in-flight request behaviour on out-of-memory are not in the repository

**Vérification locale bornée.** In an isolated sandbox with no network, a read-only target copy and a hard memory cap (for example node --max-old-space-size=460 under a 512 MiB cgroup limit), write a unit test that calls lireFichier('a.xlsx', base64) on a locally generated workbook whose sheet1.xml compresses to under 8 MB but declares an uncompressed size several times the cap (for example highly repetitive cells), and record whether the process exceeds the cap or a bounded 400 is returned. Repeat for GroupeService.importerCanevasDuGroupe with a stubbed Prisma. Then apply the fix (read the ZIP central directory before xlsx.load and refuse when any declared uncompressed size or the total exceeds a fixed budget such as 50 MB; cap rows and cells while reading; add MaxLength to ImporterBalanceEntiteDto.contenuBase64) and assert a 400 on the same fixture.

**Vérification par le propriétaire (lecture seule).** Owner observes, without sending audit traffic, the configured memory limit of the Cloud Run service revision, the effective Node heap in the container, and whether an out-of-memory termination of an instance aborts other in-flight requests on that instance.

## 9. Login CSRF: a cross-site form can log the victim's browser into an attacker-controlled dossier

Empreinte : `auth-login-csrf-cross-site-form`

POST /auth/login (anonymous, only a throttle) accepts application/x-www-form-urlencoded bodies through the global urlencoded parser, and no source-visible layer checks Origin, Referer, Sec-Fetch-Site or a pre-session CSRF token (grep of src/ finds no such check; the CSRF control in JwtStrategy applies only to cookie-authenticated mutations after login). On success the controller sets __session with httpOnly, Secure, SameSite=None in hosted mode, which overwrites any existing __session for the site. An attacker page can auto-submit a top-level form to https://oomega.web.app/api/auth/login carrying the attacker's own email/motDePasse (resterConnecte omitted; an account without second factor). If the Firebase relay forwards the POST and the browser stores the cookie, the victim's next visit to the SPA calls GET /auth/me, which re-serves the session's CSRF token (client/src/lib/auth.tsx:170-173 adopts it), so the SPA operates normally in the attacker's dossier. Data the victim then enters (entries, RIBs, payroll) lands in a dossier the attacker can read; the victim's own session is displaced. Requires victim interaction and that the victim does not notice the dossier/account shown in the interface. On-site mode uses SameSite=Lax without Secure and is not covered by this record.

**Cause supposée.** The anonymous login route is a state-changing endpoint reachable by a CORS-simple cross-site request (urlencoded form) and sets an ambient SameSite=None session cookie without verifying request origin or a pre-session CSRF token.

**Chemin dans le code.**

- entrypoint · `src/modules/auth/auth.controller.ts:136` (AuthController.login) · Anonymous @Post('login'), no auth guard and no Origin/Sec-Fetch-Site/CSRF check; only @Throttle (line 135).
- propagation · `src/bootstrap.ts:65` (configurerApplication) · Global express urlencoded parser, so a plain HTML form POST (CORS-simple, no preflight) populates the body; ValidationPipe whitelist accepts email/motDePasse.
- propagation · `src/modules/auth/dto/login.dto.ts:4` (LoginDto) · email and motDePasse accepted as strings from a form body; code and resterConnecte optional and may be omitted.
- sink · `src/modules/auth/session.constants.ts:45` (OPTIONS_COOKIE_SESSION) · Hosted session cookie is sameSite 'none' + secure, set via poserCookieSession (line 87-90) on the response to the cross-site request, replacing the victim's __session.

**Éléments relus.**

- `src/modules/auth/auth.controller.ts:144` · poserSession(res, r) sets the attacker-account cookie on the login response (poserSession at line 45-49 calls poserCookieSession).
- `src/modules/auth/auth.controller.ts:194` · GET /auth/me returns the current session's csrfToken, letting the SPA operate the fixed session.
- `client/src/lib/auth.tsx:170` · The SPA reloads /auth/me and synchronises the returned CSRF token, so it adopts whatever session the cookie carries.
- `src/modules/auth/jwt.strategy.ts:103` · CSRF header check exists only for cookie-borne mutating requests by an already authenticated session, not for /auth/login.
- `client/firebase.json:12` · Firebase Hosting rewrites /api/** to the Cloud Run service, making the cookie first-party to oomega.web.app.

**Ce qui manque pour trancher.**

- No OS-enforced sandbox on the audit host for this run: no server, relay or browser may be executed, so the cross-site form submission cannot be observed locally.
- Whether Firebase Hosting forwards a cross-site urlencoded POST on /api/** to Cloud Run and returns the Set-Cookie __session, and whether current Chromium and WebKit store a SameSite=None; Secure cookie from the response to a top-level cross-site POST navigation, is proxy/browser behaviour not visible in source.

**Vérification locale bornée.** In an approved sandbox with a disposable PostgreSQL, run the compiled server and the client via vite preview with OMEGAX_API_RELAIS (CLAUDE.md section 10 local montage). Create two dummy accounts in separate dossiers: victim V and attacker A (no second factor). Log V in through the app in Playwright Chromium and WebKit. From a second local origin (e.g. http://127.0.0.1:5999) serve <form method=POST action=http://localhost:4173/api/auth/login> with hidden fields email=A, motDePasse=A's password, auto-submitted. Then reload http://localhost:4173 and record GET /api/auth/me. Vulnerable if it returns account A. Fix check: refuse /auth/login when Sec-Fetch-Site is cross-site or Origin is not an allowed site origin (or require Content-Type application/json and drop the urlencoded parser on auth routes), then rerun and expect V to remain logged in.

**Vérification par le propriétaire (lecture seule).** Owner, in a Firebase preview channel, submits a cross-origin HTML form POST to <preview>/api/auth/login with a dummy test account and observes in browser devtools whether a __session cookie for the preview host is stored; no audit traffic is sent by the auditors.

## 10. Per-account login lockout and second-factor one-time state use a stale read-then-write, so concurrent attempts can bypass the lockout

Empreinte : `auth-login-failure-counter-lost-update`

AuthService.login reads the User row once (auth.service.ts:417), runs bcrypt (447), checks the lock against the pre-bcrypt snapshot (456), and on failure writes tentativesEchouees / verrouilleJusqua / dernierEchecLe as absolute values computed from that snapshot (decompteApresEchec, verrouillage.ts:82; update at auth.service.ts:468-471). There is no atomic increment, no conditional WHERE on the previous value and no re-read under lock: the audit extension serializes the audited update under the dossier lock (extension-audit.ts:376-383) but replays the same precomputed data, so it does not restore the increment. N concurrent failed attempts (wrong password, or wrong TOTP code behind a known password) that read the row before the first failure is persisted all pass the lock check and all write the same count+1. The lockout is the documented control against distributed guessing on ONE account (verrouillage.ts:4-6; app.module.ts:86-89 says the per-instance in-memory throttler is assumed and brute force is held by the per-account lock); burst concurrency therefore multiplies the guesses allowed per lock period, bounded by attacker source addresses x per-IP route throttle (20/min, auth.controller.ts:135) x up to 4 Cloud Run instances. The same snapshot pattern lets one TOTP step or one backup code authorize two concurrent logins (secondFacteurAccepte against the snapshot, consumption written unconditionally at 507-510), which requires the password and the code and is low impact on its own.

**Cause supposée.** Non-atomic read-modify-write of security counters and one-time factor state: decompteApresEchec computes echecs = stale tentativesEchouees + 1 and the user.update is unconditional (no increment, no WHERE on the prior value, no SELECT ... FOR UPDATE re-read), and the lock check uses the snapshot read before bcrypt.

**Chemin dans le code.**

- entrypoint · `src/modules/auth/auth.controller.ts:136` (AuthController.login) · Anonymous POST /auth/login, throttled 20/min per IP (line 135) on an in-memory per-instance store.
- propagation · `src/modules/auth/auth.service.ts:417` (AuthService.login) · Single findUnique snapshot of the user, including tentativesEchouees, verrouilleJusqua, dernierEchecLe, dernierPasDoubleAuth, codesSecoursDoubleAuth.
- propagation · `src/modules/auth/auth.service.ts:456` (AuthService.login) · Lock decision taken on the snapshot after bcrypt (line 447); concurrent requests that read before any failure is persisted all pass.
- propagation · `src/modules/auth/verrouillage.ts:82` (decompteApresEchec) · New count = stale tentativesEchouees + 1, returned as an absolute value together with verrouilleJusqua derived from it.
- sink · `src/modules/auth/auth.service.ts:468` (AuthService.login compterEchec) · Unconditional user.update writing the absolute values (data at line 470); concurrent failures collapse to one increment.

**Éléments relus.**

- `src/modules/auth/auth.service.ts:470` · compterEchec writes data: decompteApresEchec(user, maintenant) from the request's snapshot, no atomic increment or conditional update.
- `src/common/audit/extension-audit.ts:382` · The audit extension replays the audited update inside a short transaction under the dossier lock with the original args; it serializes writes but does not re-read, so precomputed absolute values still overwrite each other.
- `src/modules/auth/auth.service.ts:493` · secondFacteurAccepte evaluated against the snapshot's dernierPasDoubleAuth and backup-code list.
- `src/modules/auth/auth.service.ts:509` · Consumption of the TOTP step / remaining backup codes written unconditionally with the reset, allowing two concurrent logins with the same code.
- `src/modules/auth/double-authentification.ts:93` · Replay protection only compares to the dernierPas value read earlier in the request.
- `src/app.module.ts:90` · ThrottlerModule.forRoot without storage (per-instance in-memory); comment at 86-89 states brute force is held by the per-account lock.

**Ce qui manque pour trancher.**

- No OS-enforced sandbox is available on the audit host for this run, so the concurrent burst against a compiled server and a disposable PostgreSQL could not be executed and the collapsed counter was not observed.
- The achievable burst size and the fraction of concurrent attempts that read the same snapshot depend on bcryptjs scheduling on a one-core instance, the dossier-lock wait (some concurrent audited updates may instead fail with the 409 lock-timeout path), and deployed Cloud Run concurrency/instance count; none of these is observable from source.

**Vérification locale bornée.** On a disposable PostgreSQL with the compiled server (throttler limit raised or distinct trusted source addresses in a test module), create a dummy tenant user with tentativesEchouees=0 and dernierEchecLe=null; send 40 simultaneous POST /auth/login with wrong passwords for that address; then read users.tentativesEchouees and count responses. Vulnerable if the stored count is well below 40 while all 40 received MOTIF_IDENTIFIANTS_INVALIDES after a full bcrypt compare (none short-circuited by a persisted lock). Second fixture: a 2FA-enabled dummy user, correct password and the same valid TOTP code in two simultaneous requests; vulnerable if two sessions are issued. Fix check: replace the write with an atomic UPDATE ... SET tentativesEchouees = CASE ... END, verrouilleJusqua = ... WHERE id = $1 RETURNING (or SELECT ... FOR UPDATE in a short transaction that re-reads verrouilleJusqua and the counter), and make factor consumption conditional (WHERE dernierPasDoubleAuth IS DISTINCT FROM the accepted step / the backup code still present), then rerun both fixtures.

**Vérification par le propriétaire (lecture seule).** Owner reviews Cloud Run request logs and the users table history for bursts of concurrent /auth/login failures on a single account where tentativesEchouees advanced by less than the number of failures; no live probing.

## 11. On-site external backup destination accepts arbitrary UNC paths that the LocalSystem service then touches hourly (possible machine-account NTLM coercion)

Empreinte : `sur-site/sauvegarde-sur-site.service/definirCopieExterne-unc-localsystem`

POST /sur-site/sauvegardes/copie-externe lets the ADMIN_CABINET of the installation tenant (an application role) set any absolute directory, explicitly including a UNC path, as the external backup destination. definirCopieExterne checks it only with isAbsolute, existsSync/statSync and a test write, then immediately re-encrypts the latest dump into it; recopierSiAbsente, run every hour from onModuleInit, calls existsSync on the stored path again. The Windows service is defined without a service account, so per its own comments it runs under the system account. If Node's fs calls on \\host\share from that account authenticate to the chosen host as the machine account (SERVER$), an OmegaX application administrator can make the server repeatedly send machine-account NTLM authentication to a host they control, a Windows-level capability (relay toward AD CS, LDAP or SMB without signing in a domain) outside the application role's intended authority. Corrections to the hunter's wording: the SYSTEM-privileged file operations are limited to fixed names (.omegax-essai-<pid> containing 'essai', omegax-<ts>.dump.chiffre and its .partiel, both AES-GCM ciphertext the caller does not control) and the unlinks at line 379 only remove files matching OmegaX copy patterns, so there is no controlled-content arbitrary file write; and shipping the encrypted all-tenant dump to the admin's own share is the documented intended function of this role (the backup contains every tenant by design and the admin chooses the phrase), not an additional impact.

**Cause supposée.** definirCopieExterne validates the destination only with isAbsolute, existsSync/statSync and a test write, with no rejection of UNC/network paths or OS-administrator-configured allowlist, while the I/O on that application-chosen path is performed by a Windows service running as the system account, so an application role selects the network host to which the server's machine account may authenticate.

**Chemin dans le code.**

- entrypoint · `src/modules/sur-site/sur-site.controller.ts:75` (SurSiteController.copieExterne) · POST /sur-site/sauvegardes/copie-externe, guarded by JwtAuthGuard, RolesGuard (ADMIN_CABINET) and AdministrateurInstallationGuard, passes dto.dossier and dto.phrase to definirCopieExterne (line 77).
- propagation · `src/modules/sur-site/sauvegarde-sur-site.service.ts:315` (SauvegardeSurSiteService.definirCopieExterne) · Only isAbsolute(d) is required; the refusal message itself suggests a \\SERVEUR\partage UNC path.
- propagation · `src/modules/sur-site/sauvegarde-sur-site.service.ts:316` (SauvegardeSurSiteService.definirCopieExterne) · existsSync(d) and statSync(d) on the caller-chosen path, the first filesystem access to a UNC host.
- propagation · `src/modules/sur-site/sauvegarde-sur-site.service.ts:322` (SauvegardeSurSiteService.definirCopieExterne) · writeFileSync of .omegax-essai-<pid> (fixed content) into the chosen directory, then unlink; path stored at line 329 and the latest dump recopied at line 331.
- propagation · `src/modules/sur-site/sauvegarde-sur-site.service.ts:343` (SauvegardeSurSiteService.recopierSiAbsente) · Called every hour by the setInterval at line 155; existsSync on the stored external path re-touches the chosen host.
- sink · `src/modules/sur-site/sauvegarde-sur-site.service.ts:364` (SauvegardeSurSiteService.recopier) · chiffrerFichier writes the encrypted dump (via .partiel then rename) into the chosen directory and readdirSync lists it, both performed by the service process on the UNC path.

**Éléments relus.**

- `installation/windows/omegax-service.xml:10` · Comment states the service runs under the system account because no account is declared; the <service> element (lines 14-32) indeed declares none.
- `installation/windows/initialiser.ps1:44` · Installer comment confirms OmegaX runs under the system account (WinSW without declared account).
- `src/modules/sur-site/administrateur-installation.guard.ts:23` · The only gate is an application check (ADMIN_CABINET of the oldest tenant); nothing ties the caller to Windows administrative rights on the server.
- `src/modules/sur-site/sur-site.dto.ts:7` · CopieExterneDto.dossier is any string up to 500 characters; no UNC rejection or allowlist.
- `src/modules/sur-site/chiffrement-sauvegarde.ts:63` · chiffrerFichier writes ciphertext to <cible>.partiel and renames it; content is AES-256-GCM output, not caller-controlled bytes, which bounds the file-write impact.

**Ce qui manque pour trancher.**

- No OS-enforced sandbox and no Windows host available for this run, so no target code may be executed.
- Whether Node fs calls on a \\host\share path made by a LocalSystem service authenticate to an arbitrary host as the machine account, and whether SMB signing, EPA, NTLM restrictions or outbound 445 filtering on typical client networks prevent a useful relay, is Windows/network behaviour not visible in source.
- Whether, in real installations, the installation-tenant ADMIN_CABINET is a principal distinct from the Windows administrator of the server (if they coincide, no privilege boundary is crossed).

**Vérification locale bornée.** In an isolated, network-segmented lab of two Windows VMs with dummy credentials: VM1 runs OmegaX installed from the package (service as LocalSystem, MODE_INSTALLATION=SUR_SITE); VM2 runs an SMB listener that logs incoming NTLM authentications. Log in as the installation tenant ADMIN_CABINET and POST /sur-site/sauvegardes/copie-externe with {"dossier":"\\\\<VM2-ip>\\share","phrase":"dummy-phrase-123456"}. Observe whether VM2 logs an NTLM authentication from VM1's machine account (VM1$) at the request and again at the next hourly tick. Regression test: definirCopieExterne must refuse a \\host\share (and \\?\UNC\) path, or any path outside an OS-administrator-configured allowlist, before any fs call, asserted with mocked fs showing existsSync is never invoked.

**Vérification par le propriétaire (lecture seule).** Owner observation on a representative client install, without sending audit traffic: in services.msc confirm the OmegaX service logon account, whether the server is domain-joined, whether SMB signing is required and NTLM outbound restricted by policy, and whether the person holding the installation-tenant admin account also holds Windows administrator rights on that server.
