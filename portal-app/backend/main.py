from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Power Platform CoE API")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

# Key Vault Integration
KEY_VAULT_URL = os.getenv("KEY_VAULT_URL")

def get_secret(secret_name: str) -> str:
    if not KEY_VAULT_URL:
        # Fallback for local dev without Key Vault (not recommended for prod)
        return os.getenv(secret_name)
    
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=KEY_VAULT_URL, credential=credential)
    return client.get_secret(secret_name).value

# Configuration
TENANT_ID = get_secret("TENANT-ID")
CLIENT_ID = get_secret("CLIENT-ID")
CLIENT_SECRET = get_secret("CLIENT-SECRET")
API_ENDPOINT = "https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

async def get_access_token():
    # Simple Client Credentials flow (Note: Inventory API mainly supports Delegated, 
    # but for backend service scenarios we might need a service principal with correct perms 
    # or handle OBO. For this demo/preview, we assume Client Creds or hardcoded dev token)
    
    # NOTE: Actual Inventory API often requires Delegated permissions. 
    # For a real backend, implement On-Behalf-Of flow or use a service account.
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://api.powerplatform.com/.default"
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data=data)
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail=f"Auth failed: {resp.text}")
        return resp.json().get("access_token")

class KQLRequest(BaseModel):
    query: str

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Power Platform CoE Backend"}

@app.get("/api/resources")
async def get_resources():
    token = await get_access_token()
    
    # Default Query: Summarize by Type
    kql_body = {
        "TableName": "PowerPlatformResources",
        "Clauses": [
            {
                "$type": "summarize",
                "SummarizeClauseExpression": {
                    "OperatorName": "count",
                    "OperatorFieldName": "count",
                    "FieldList": ["type"]
                }
            }
        ]
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            API_ENDPOINT, 
            json=kql_body,
            headers={"Authorization": f"Bearer {token}"}
        )
        return resp.json()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
