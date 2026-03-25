import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const CLIENT_ID = process.env.ROBLOX_CLIENT_ID || '6051993114266710234';
const CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { code, error: oauthError } = request.query;

  if (oauthError) {
    return response.send(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #1a1a1a; color: #fff; }
    h1 { color: #ff6b6b; }
    a { color: #6c5ce7; }
  </style>
</head>
<body>
  <h1>OAuth Error</h1>
  <p>${oauthError}</p>
  <p><a href="/">Go back</a></p>
</body>
</html>`);
  }

  if (!code) {
    return response.redirect('/');
  }

  const state = request.query.state as string;
  const sessionId = state || 'unknown';

  if (!CLIENT_SECRET) {
    return response.send(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #1a1a1a; color: #fff; }
    h1 { color: #ff6b6b; }
  </style>
</head>
<body>
  <h1>Server Error</h1>
  <p>Missing client secret configuration</p>
</body>
</html>`);
  }

  try {
    const redirectUri = `https://figroexporter-tawny.vercel.app/oauth/callback`;
    const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    const data = await tokenResponse.json();

    if (data.access_token) {
      let username = 'User';
      let userId = 'unknown';
      
      // Get user info using OAuth userinfo endpoint
      try {
        const userRes = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        const userData = await userRes.json();
        console.log('Userinfo response:', JSON.stringify(userData));
        
        if (userData.sub) {
          userId = userData.sub;
          username = userData.name || userData.display_name || 'User';
        }
      } catch (e) {
        console.log('Failed to get user info:', e);
      }

      console.log('User info:', username, userId);

      console.log('User info:', username, userId);

      // Save to Redis with sessionId as key
      const tokenData = {
        access_token: data.access_token,
        userId: userId,
        username: username,
        expires_in: data.expires_in,
      };
      
      console.log('Saving to Redis:', sessionId, tokenData);
      
      let redisSuccess = false;
      try {
        await redis.set(`oauth:${sessionId}`, JSON.stringify(tokenData), { ex: 300 });
        redisSuccess = true;
        console.log('Saved to Redis successfully');
      } catch (redisError) {
        console.error('Redis save error:', redisError);
      }

      return response.send(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #1a1a1a; color: #fff; }
    h1 { color: #00d68f; margin-bottom: 20px; }
    p { color: #888; font-size: 16px; }
  </style>
</head>
<body>
  <h1>✅ Successfully Connected!</h1>
  <p>You can now return to the Figma plugin.</p>
  <p>Logged in as: <strong>${username}</strong> (ID: ${userId})</p>
  <p style="color:#666;font-size:12px;">Session: ${sessionId}</p>
  <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`);
    } else {
      return response.send(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #1a1a1a; color: #fff; }
    h1 { color: #ff6b6b; }
  </style>
</head>
<body>
  <h1>Token Exchange Failed</h1>
  <p>${data.error_description || data.error}</p>
</body>
</html>`);
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
    return response.send(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #1a1a1a; color: #fff; }
    h1 { color: #ff6b6b; }
  </style>
</head>
<body>
  <h1>Error</h1>
  <p>Failed to exchange code</p>
</body>
</html>`);
  }
}