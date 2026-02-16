#!/bin/bash
echo "🚀 Setting up CoE Portal Preview Environment..."

# 1. Backend Setup
echo "📦 Setting up Backend (FastAPI)..."
cd portal-app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Frontend Setup
echo "🎨 Setting up Frontend (Next.js)..."
cd ../frontend

# Clean up previous failed attempts (but keep page.tsx if it exists)
if [ -f page.tsx ]; then
    mv page.tsx page.tsx.bak
fi
rm -rf app node_modules package.json package-lock.json postcss.config.js tailwind.config.js tsconfig.json

echo "Creating Next.js app structure..."
npm init -y
# Install dependencies
npm install next react react-dom typescript @types/react @types/node tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Create directory structure
mkdir -p app

# Restore page.tsx
if [ -f page.tsx.bak ]; then
    mv page.tsx.bak app/page.tsx
else
    # Creates specific dummy page if original missing
    echo "export default function Home() { return <div>Error: page.tsx missing</div> }" > app/page.tsx
fi

# Create globals.css
echo "@tailwind base;
@tailwind components;
@tailwind utilities;" > app/globals.css

# Fix tsconfig for Next.js (Minimal)
echo '{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}' > tsconfig.json

# 3. Create Start Script
echo "✨ Setup Complete!"
echo "To run the preview:"
echo "1. Terminal 1 (Backend): cd portal-app/backend && source venv/bin/activate && uvicorn main:app --reload"
echo "2. Terminal 2 (Frontend): cd portal-app/frontend && npm run dev -- -p 3001"
