/**
 * Run this ONCE, locally, after creating an OAuth Client ID (Desktop app type)
 * in Google Cloud Console:
 *
 *   node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>
 *
 * It opens a login URL for you to visit, you sign in with the Google account
 * whose Drive you want the app to use, and it prints the three environment
 * variables to paste into .env.local and Vercel. Nothing here is uploaded
 * anywhere except directly to Google's own OAuth servers.
 */
const { google } = require("googleapis");
const http = require("http");

const [, , CLIENT_ID, CLIENT_SECRET] = process.argv;
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Usage: node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline", // required to get a refresh_token back, not just a short-lived access token
  prompt: "consent", // forces Google to re-issue a refresh_token even if you've authorized this app before
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\n1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Sign in with the Google account whose Drive you want this app to use.");
console.log("3. Click Allow. You'll be redirected back here automatically.\n");
console.log("Waiting for you to finish signing in...");

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) {
    res.end("");
    return;
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");
  if (!code) {
    res.end("No authorization code found in the redirect. Check the terminal and try again.");
    return;
  }

  res.end("Success — you can close this tab and go back to your terminal.");
  server.close();

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.error(
        "\nGoogle didn't return a refresh_token. This usually means you've authorized this app " +
          "before — go to https://myaccount.google.com/permissions, remove access for this app, " +
          "and run this script again."
      );
      process.exit(1);
    }

    console.log("\nAdd these three to .env.local, and later to Vercel's Environment Variables:\n");
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("");
  } catch (err) {
    console.error("\nFailed to exchange the code for tokens:", err.message);
  } finally {
    process.exit(0);
  }
});

server.listen(PORT);
