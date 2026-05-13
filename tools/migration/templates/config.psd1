@{
    # Source and target environments (same tenant assumed for the default-env -> cross-region prod scenario)
    #
    # Two identifiers per environment:
    #   <name>EnvUrl  : Dataverse instance URL (https://orgXXXX.crm.dynamics.com).  Used for Web API calls.
    #   <name>EnvId   : Power Platform environment GUID.                            Used for Power Apps RP calls
    #                                                                               (connection create, BAP admin API).
    # Both are needed. Find them in Power Platform Admin Center -> Environments -> click env -> Details.
    sourceEnvUrl = 'https://orgSOURCE.crm.dynamics.com'
    sourceEnvId  = '00000000-0000-0000-0000-000000000000'
    targetEnvUrl = 'https://orgTARGET.crm.dynamics.com'   # TODO: fill the Dataverse URL of env f7862d09-ee88-ee8e-bc80-afc7ead10e86
    targetEnvId  = 'f7862d09-ee88-ee8e-bc80-afc7ead10e86'
    tenantId     = '00000000-0000-0000-0000-000000000000'

    # Service principal used for SPN-track operations. Created/updated by Initialize-PPMigrationSpn.ps1.
    spnAppId = '00000000-0000-0000-0000-000000000000'

    # Secret backend selector (PowerShell 5.1 compatible).
    # Options:
    #   CredentialManager    - Windows Credential Manager (DPAPI). Default. Requires CredentialManager module.
    #   DPAPIFile            - encrypted files under %LOCALAPPDATA%\PPMigration
    #   KeyVault             - Az.KeyVault module (set keyVaultName)
    #   Interactive          - prompt every time
    #   EnvironmentVariable  - process env var PP_<name>
    secretBackend = 'CredentialManager'
    secretPrefix  = 'PPMigration:'
    # keyVaultName = 'kv-pp-migration'    # used only when secretBackend = 'KeyVault'

    secrets = @{
        spnClientSecret = 'spn-secret'
        # Add more named secret entries here, then refer to them in connection-bootstrap.json as @secret:name
        # azureOpenAIKey = 'aoai-key'
    }

    # Solutions to migrate, in dependency order (single src→tgt mode only)
    solutions = @(
        'cr_CustomConnectors',
        'cr_Core',
        'cr_Flows',
        'cr_AIBuilder',
        'cr_Copilots'
    )

    # Output root for logs/state/artifacts
    outDir = 'C:\PPMigration\out'

    # ---------- Per-owner Copilot migration mode ----------
    # Used by Invoke-PPCopilotMigration.ps1 (default env -> each owner's Developer env).
    # When this mode runs, targetEnvUrl/Id above are ignored and each bot's owner is
    # auto-mapped to their personal Developer environment via BAP admin API.
    perOwnerMode         = $true
    ownerSlug            = 'localpart'      # email -> slug rule for solution naming
    solutionPrefix       = 'cr_AgentMig'    # prefix for the per-owner temporary solution
    publisherUniqueName  = 'pp_migration'
    publisherDisplayName = 'PP Migration'
    publisherPrefix      = 'pp'

    # Bot / owner filters (all empty means migrate everyone)
    onlyBotSchemaNames = @()
    onlyOwnerEmails    = @()
    excludeOwnerEmails = @()                # exclude guests / service accounts here

    # Cleanup the source-env temporary solutions after a successful migration
    cleanupSourceSolutions = $false
}
