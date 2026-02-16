// ================================================================
// Power Platform CoE Governance Agent — Azure Infrastructure
// ================================================================
// Deploys the Data Plane Agent to a customer's Azure subscription:
//   - Azure Function App (Python 3.11, Consumption Plan)
//   - Key Vault (secrets storage)
//   - Application Insights (monitoring)
//   - Storage Account (Functions runtime)
// ================================================================

@description('Base name for all resources (e.g., "coe-governance")')
param baseName string = 'coe-governance'

@description('Azure region for deployment')
param location string = resourceGroup().location

@description('Entra Tenant ID for Power Platform API access')
@secure()
param tenantId string

@description('Entra App Client ID')
@secure()
param clientId string

@description('Entra App Client Secret')
@secure()
param clientSecret string

@description('ISV frontend URL for CORS (e.g., "https://portal.isv-domain.com")')
param isvFrontendUrl string = ''

@description('Agent version tag')
param agentVersion string = '1.0.0'

// ================================================================
// Variables
// ================================================================

var uniqueSuffix = uniqueString(resourceGroup().id)
var functionAppName = '${baseName}-agent-${uniqueSuffix}'
var hostingPlanName = '${baseName}-plan-${uniqueSuffix}'
var storageAccountName = replace('${baseName}st${uniqueSuffix}', '-', '')
var keyVaultName = '${baseName}-kv-${uniqueSuffix}'
var appInsightsName = '${baseName}-ai-${uniqueSuffix}'

// ================================================================
// Storage Account (required by Azure Functions runtime)
// ================================================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: take(storageAccountName, 24) // Storage account names max 24 chars
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// ================================================================
// Application Insights (monitoring & logging)
// ================================================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
  }
}

// ================================================================
// Key Vault (secure secret storage)
// ================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take(keyVaultName, 24) // Key Vault names max 24 chars
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// Store secrets in Key Vault
resource secretTenantId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'TENANT-ID'
  properties: { value: tenantId }
}

resource secretClientId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'CLIENT-ID'
  properties: { value: clientId }
}

resource secretClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'CLIENT-SECRET'
  properties: { value: clientSecret }
}

// ================================================================
// App Service Plan (Consumption / Serverless)
// ================================================================

resource hostingPlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: hostingPlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
}

// ================================================================
// Function App (the Agent itself)
// ================================================================

resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned' // For Key Vault access via Managed Identity
  }
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    siteConfig: {
      pythonVersion: '3.11'
      linuxFxVersion: 'Python|3.11'
      cors: {
        allowedOrigins: empty(isvFrontendUrl) ? [
          'https://portal.azure.com'
        ] : [
          isvFrontendUrl
          'https://portal.azure.com'
        ]
        supportCredentials: true
      }
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=core.windows.net;AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: appInsights.properties.InstrumentationKey }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'KEY_VAULT_URL', value: keyVault.properties.vaultUri }
        { name: 'AGENT_VERSION', value: agentVersion }
        { name: 'ISV_FRONTEND_URL', value: isvFrontendUrl }
      ]
    }
  }
}

// ================================================================
// RBAC: Grant Function App access to Key Vault secrets
// ================================================================

// Key Vault Secrets User role
var keyVaultSecretsUserRole = '4633458b-17de-408a-b874-0445c86b69e6'

resource functionAppKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, keyVaultSecretsUserRole)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRole)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ================================================================
// Outputs
// ================================================================

output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output functionAppName string = functionApp.name
output keyVaultName string = keyVault.name
output keyVaultUrl string = keyVault.properties.vaultUri
output appInsightsName string = appInsights.name
output healthEndpoint string = 'https://${functionApp.properties.defaultHostName}/api/health'
