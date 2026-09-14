import { envStatus } from './_meta.js';
export default function handler(req, res) { res.status(200).json(envStatus(req)); }
