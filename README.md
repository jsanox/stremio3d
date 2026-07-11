# 3D Only Filter for Stremio

This private Stremio stream addon proxies your existing AIOStreams addon and only returns streams labeled 3D, SBS/HSBS/FSBS, OU/HOU/TAB, MVC, or frame-packed.

It does not host or provide media. It only filters stream metadata returned by the upstream addon.

## Important limitation

It can only filter streams that AIOStreams already returns. It cannot force a provider to discover a 3D release that was absent from the original results.

## Deploy free on Vercel

1. Create a free GitHub account and free Vercel account if needed.
2. Create a new GitHub repository.
3. Upload every file and folder from this project.
4. In Vercel choose **Add New → Project**.
5. Import the GitHub repository and click **Deploy**.
6. Open the deployed URL.
7. Paste your personalized AIOStreams manifest/addon URL.
8. Click **Create installation link**, then **Install in Stremio**.

No environment variables or API keys are required.

## Privacy

Your upstream AIOStreams URL is encoded in the personalized manifest URL, not encrypted. Do not share it publicly.
