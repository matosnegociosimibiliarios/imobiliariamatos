import { envStatus } from './_meta.js';
export default async function handler(req, res) { res.status(200).json(await envStatus(req)); }
