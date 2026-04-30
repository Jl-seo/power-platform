# Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | SharePoint connection cannot use SPN | Certain | High | Track B OAuth interactive consent + polling |
| R2 | Knowledge source URLs in managed solution are immutable | High | High | All-Unmanaged strategy; if a managed component sneaks in, `Repair-PPSolutionGuids` unpacks/repacks unmanaged |
| R3 | Cloud flows get turned ON unexpectedly | Medium | High | `Import-PPSolution.ps1` omits `--activate-plugins`; `Assert-PPResourcesOff` forces statecode=0 |
| R4 | Bot auto-published | Low | Medium | `pac copilot publish` is never invoked by orchestrator; published state only reported, not unpublished |
| R5 | AI Builder model GUID mismatch source→target | High | High | Source/target ID inventories + `Set-AIBuilderModelBinding` re-binds via Web API |
| R6 | Owner notification email storm during connection re-binding | High | Medium | Phase 0 disables `flowFailureAlertSubscribed` per flow; Restore reverses |
| R7 | API throttling (429) | Certain on large solutions | Medium | `Invoke-PPRest` honors Retry-After, exponential backoff, per-host token buckets |
| R8 | Stale GUIDs inside topic YAML / flow JSON / AI plugin definitions | Certain when ALM not used previously | High | `Repair-PPSolutionGuids` rewrites pre-import, `Patch-PostImportReferences` sweeps post-import |
| R9 | Solution import async timeout > 60 min | Medium on large solutions | Medium | `--max-async-wait-time` configurable; checkpointed for `-Resume` |
| R10 | Conditional Access blocks SPN | Medium | High | Add SPN to CA exempt group, or use `pac auth create --azureDevOpsFederated` |
| R11 | Tenant settings need admin not granted to SPN | Certain | Low | Device-code admin token track via `MSAL.PS` |
| R12 | Re-running creates duplicate connections | High without idempotency | Low | `pac connection list` check before create; map persisted between runs |
| R13 | Secret leakage in logs | Certain without redaction | High | `Add-PPLogRedaction` registers secret values; `Invoke-PPRest` uses headers, transcript off |
| R14 | KeyVault unavailable | Certain in user's setup | Medium | Default backend is Windows Credential Manager (DPAPI), no Azure dependency |
| R15 | PowerShell 7-only constructs in scripts | Certain pitfall on PS 5.1 | High | Strict `#Requires -Version 5.1`, common entry block, manual JSON depth, no SecretStore, no `??`/`?:` |
| R16 | Source environment changed during migration window | Medium | Medium | Re-run PreFlight, reconcile detects diff, Apply overwrites |
| R17 | Custom connector dependency cycle | Low | High | Bootstrap installs connectors before connections; orchestrator follows config solutions order |
| R18 | Default env → cross-region: SharePoint sites differ | High when sites moved | Medium | Add explicit URL overrides in optional `url-map.json`; `Repair-PPSolutionGuids` substitutes; `Patch-PostImportReferences` cleans up survivors |
| R19 | Connection reference owner is wrong app user | Medium | Medium | Validation checks; per docs the connection must be owned by the SPN application user (or shared) |
| R20 | Mid-run failure leaves partial state | Certain over time | Low | `state.json` checkpointing + `failures.jsonl` + `Reconcile-PPMigration.ps1` |
