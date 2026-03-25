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
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { code, redirectUri } = request.body;

  if (!code) {
    return response.status(400).json({ error: 'Authorization code is required' });
  }

  if (!CLIENT_SECRET) {
    return response.status(500).json({ error: 'Server configuration error: missing client secret' });
  }

  try {
    const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri || '',
      }),
    });

    const data = await tokenResponse.json();

    if (data.access_token) {
      // Fetch user info from Roblox
      let username = 'User';
      let userId = 'unknown';
      
      try {
        const userRes = await fetch('https://users.roblox.com/v1/users/me', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          username = userData.name || userData.displayName || 'User';
          userId = userData.id || 'unknown';
        }
      } catch (e) {
        console.log('Failed to get user info:', e);
      }

      return response.status(200).json({
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in,
        userId: userId,
        username: username,
      });
    } else {
      return response.status(400).json({
        error: data.error || 'Failed to exchange code for token',
        error_description: data.error_description,
      });
    }
  } catch (error) {
    console.error('OAuth exchange error:', error);
    return response.status(500).json({ error: 'Failed to exchange authorization code' });
  }
}