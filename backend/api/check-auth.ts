import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const sessionId = request.query.sessionId as string;

  if (!sessionId) {
    return response.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const key = `oauth:${sessionId}`;
    console.log('Checking Redis for key:', key);
    
    const tokenData = await redis.get(key);

    console.log('Redis result:', tokenData);

    if (tokenData) {
      await redis.del(key);
      
      const data = typeof tokenData === 'string' ? JSON.parse(tokenData) : tokenData;
      return response.status(200).json({
        status: 'success',
        ...data
      });
    } else {
      return response.status(404).json({ status: 'pending' });
    }
  } catch (error) {
    console.error('Check auth error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}