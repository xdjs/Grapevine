# Deploying Music Collaboration Network Visualizer to Vercel

⚠️ **Important Note**: This app is currently optimized for Replit deployment. For Vercel deployment, significant restructuring is needed since the current setup uses a single Express server for both frontend and backend.

## Recommended Alternative: Deploy to Railway

Since this app uses a unified Express+Vite setup, **Railway.app** is the easiest deployment option:

1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables (see below)
4. Deploy automatically - no configuration needed!

## For Vercel Deployment (Advanced)

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Database**: Set up a PostgreSQL database (Supabase, Neon, or Railway)

## Step 1: Prepare Your Environment Variables

Set these environment variables in Vercel dashboard:

### Required Variables:
- `CONNECTION_STRING` - Your PostgreSQL connection string
- `DATABASE_URL` - Same as CONNECTION_STRING (fallback)
- `OPENAI_API_KEY` - Your OpenAI API key for collaboration data
- `NODE_ENV` - Set to "production"

### Optional Variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SPOTIFY_CLIENT_ID` - Spotify Web API client ID
- `SPOTIFY_CLIENT_SECRET` - Spotify Web API secret

## Step 2: Update package.json Scripts

Add this script to your package.json:
```json
{
  "scripts": {
    "vercel-build": "vite build"
  }
}
```

## Step 3: Configure Vercel

The `vercel.json` file has been created with the proper configuration:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json", 
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/public/$1"
    }
  ]
}
```

## Step 4: Deployment Steps

1. **Connect Repository**: In Vercel dashboard, import your GitHub repository
2. **Configure Build Settings**:
   - Framework Preset: Other
   - Build Command: `npm run vercel-build`
   - Output Directory: `dist/public`
   - Install Command: `npm install`

3. **Add Environment Variables**: Go to Settings > Environment Variables and add all required variables

4. **Deploy**: Click "Deploy" button

## Step 5: Database Setup

After deployment, run database migrations:

```bash
# If using Drizzle migrations
npx drizzle-kit push
```

## Architecture Notes

- **Frontend**: React app built with Vite → static files served from `/dist/public`
- **Backend**: Express.js API → serverless functions under `/api/*`
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Network data cached in database `webmapdata` column

## Troubleshooting

### Common Issues:

1. **Build Errors**: Ensure all TypeScript types are correct
2. **Database Connection**: Verify CONNECTION_STRING format
3. **API Timeouts**: Check OpenAI API key and rate limits
4. **Missing Dependencies**: Ensure all packages are in dependencies, not devDependencies

### Environment Variable Format:

```bash
# PostgreSQL (Supabase example)
CONNECTION_STRING="postgresql://user:pass@host:port/db?sslmode=require"

# OpenAI
OPENAI_API_KEY="sk-..."
```

## Performance Optimization

- Network data is cached in database for instant loading
- First generation: ~7 seconds, cached requests: ~180ms
- Uses authentic music industry data from multiple APIs

## Alternative: Deploy to Railway

If you prefer Railway.app:

1. Connect GitHub repository
2. Add same environment variables
3. Railway auto-detects Node.js and builds automatically
4. No configuration files needed

## Need Help?

- Check Vercel deployment logs for specific errors
- Ensure all API keys are valid and have proper permissions
- Verify database connection string format