import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLIENT_ID = process.env.ROBLOX_CLIENT_ID || '6051993114266710234';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, userId } = request.body;

  if (!apiKey || !userId) {
    return response.status(400).json({ error: 'Missing API key or User ID' });
  }

  try {
    // Test asset API access
    const res = await fetch(`https://apis.roblox.com/assets/v1/assets?assetType=Decal&limit=1`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      }
    });

    if (!res.ok) {
      return response.status(400).json({ 
        error: `API error: ${res.status}`,
        details: await res.text()
      });
    }

    // Get user info
    let displayName = null;
    let avatarUrl = null;

    try {
      const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
        method: 'GET',
        headers: { 'x-api-key': apiKey }
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        displayName = userData.displayName || userData.name;
        avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
      }
    } catch (e) {
      // User info is optional
    }

    return response.status(200).json({
      success: true,
      userId,
      displayName,
      avatarUrl,
    });
  } catch (err) {
    return response.status(500).json({ error: 'Connection failed', details: String(err) });
  }
}