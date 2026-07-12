# Stremio 3D Only Filter v2

This addon filters streams from your existing AIOStreams manifest and keeps only streams labeled:

- 3D
- SBS / HSBS / FSBS
- OU / HOU / TAB / top-and-bottom
- MVC
- frame-packed

## Update an existing Vercel deployment

1. Open the GitHub repository connected to your Vercel project.
2. Replace these files:
   - `api/index.js`
   - `package.json`
   - `vercel.json`
3. Commit the changes.
4. Vercel redeploys automatically.
5. Open your Vercel deployment URL.
6. Paste your private AIOStreams manifest URL.
7. Click **Create installation link**.
8. Click **Install in Stremio**.

## Limitation

This addon only filters streams returned by AIOStreams. It cannot alter the IMDb request into a keyword search such as “Avatar SBS,” because normal Stremio stream requests identify the title by IMDb ID.
