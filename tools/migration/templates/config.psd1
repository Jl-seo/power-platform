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

    # Solutions to migrate, in dependency order
    solutions = @(
        'cr_CustomConnectors',
        'cr_Core',
        'cr_Flows',
        'cr_AIBuilder',
        'cr_Copilots'
    )

    # Output root for logs/state/artifacts
    outDir = 'C:\PPMigration\out'
}
