# GitHub Repository Setup

## Initial Setup

1. **Create a new repository on GitHub**

   - Go to https://github.com/new
   - Name it: `anti-calculator` (or your preferred name)
   - Make it private or public (your choice)
   - Don't initialize with README, .gitignore, or license

2. **Initialize Git and push to GitHub**

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Anti-Calculator MVP"

# Add remote repository (replace with your GitHub repo URL)
git remote add origin https://github.com/YOUR_USERNAME/anti-calculator.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Environment Variables

**Important**: Never commit your `.env.local` file!

The `.env.local` file is already in `.gitignore`, but make sure to:

1. Add `MISTRAL_API_KEY` to your Vercel project settings
2. For local development, copy `env.example` to `.env.local` and add your key

## Vercel Deployment

1. Go to https://vercel.com
2. Import your GitHub repository
3. Add environment variable: `MISTRAL_API_KEY`
4. Deploy!

Your app will be live automatically on every push to `main` branch.
