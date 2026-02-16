#!/bin/bash

# Load variables from .env
set -a
source portal-app/backend/.env
set +a

echo "🔐 Uploading secrets from .env to Azure Key Vault..."

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI (az) could not be found. Please install it first."
    exit 1
fi

# 1. Login check
echo "Checking Azure login status..."
az account show > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️ Not logged in. Please login..."
    az login
fi

# 2. Get Key Vault Name
if [ -z "$KEY_VAULT_NAME" ]; then
    read -p "Enter your Key Vault Name (e.g., kv-coe-portal): " KEY_VAULT_NAME
else
    echo "Using Key Vault: $KEY_VAULT_NAME"
fi

if [ -z "$KEY_VAULT_NAME" ]; then
    echo "❌ Key Vault name is required."
    exit 1
fi

# 3. Upload Secrets
echo "Uploading TENANT-ID..."
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "TENANT-ID" --value "$TENANT_ID" > /dev/null

echo "Uploading CLIENT-ID..."
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "CLIENT-ID" --value "$CLIENT_ID" > /dev/null

echo "Uploading CLIENT-SECRET..."
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "CLIENT-SECRET" --value "$CLIENT_SECRET" > /dev/null

echo "✅ All secrets uploaded successfully!"
echo "---------------------------------------------------"
echo "Please update your portal-app/backend/.env file:"
echo "KEY_VAULT_URL=https://$KEY_VAULT_NAME.vault.azure.net/"
echo "(You can now remove the plain text secrets from .env)"
