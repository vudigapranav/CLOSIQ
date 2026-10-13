import { handleApiRequest } from '../../server/apiRouter.js';

/**
 * Vercel serverless entry for every /api/ai/* route. The routing, auth gate
 * and Gemini / studio-photo handlers are the same modules `npm run dev` and
 * `npm run start` use (server/apiRouter.js), so behaviour is identical.
 */
export default async function handler(req, res) {
  const handled = await handleApiRequest(req, res);
  if (!handled) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }));
  }
}
