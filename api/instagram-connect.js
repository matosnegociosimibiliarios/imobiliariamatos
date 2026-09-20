import { startInstagramOAuth } from './_instagram.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  await startInstagramOAuth(req, res);
}
