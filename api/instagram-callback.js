import { instagramOAuthCallback } from './_instagram.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }
  await instagramOAuthCallback(req, res);
}
