const lifetime = 300;
const sessionId = /^[a-f0-9]{32}$/;
const local = new Map();

async function cache(command, development) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error('Pairing storage unavailable');
    const { result, error } = await response.json();
    if (error) throw Error('Pairing storage unavailable');
    return result;
  }
  if (!development) throw Error('Pairing storage unavailable');

  const now = Date.now();
  for (const [key, entry] of local) {
    if (entry.expires <= now) local.delete(key);
  }
  const [method, key, value] = command;
  if (method === 'GET') return local.get(key)?.value ?? null;
  if (local.has(key)) return null;
  local.set(key, { value, expires: now + lifetime * 1000 });
  return 'OK';
}

export async function pairing(req, res, development = false) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, data) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };

  try {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id') ?? '';
    const role = url.searchParams.get('role');
    const owner = req.headers.authorization?.slice(7) ?? '';
    if (!sessionId.test(id) || !['offer', 'answer'].includes(role)) return reply(400, {});
    if ((role === 'offer' && req.method === 'POST') ||
        (role === 'answer' && req.method === 'GET')) {
      if (!sessionId.test(owner)) return reply(403, {});
    }
    const offerKey = `musicbridge:${id}:offer`;
    const answerKey = `musicbridge:${id}:answer`;

    if (req.method === 'GET' && role === 'offer') {
      const offer = await cache(['GET', offerKey], development);
      return reply(200, { packet: offer ? JSON.parse(offer).packet : null });
    }
    if (req.method === 'GET' && role === 'answer') {
      const offer = await cache(['GET', offerKey], development);
      if (!offer || JSON.parse(offer).owner !== owner) return reply(403, {});
      return reply(200, { packet: await cache(['GET', answerKey], development) });
    }
    if (req.method !== 'POST') return reply(405, {});

    let body = req.body;
    if (body === undefined) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 32000) return reply(413, {});
      }
      body = raw;
    }
    if (typeof body === 'string') {
      if (body.length > 32000) return reply(413, {});
      try { body = JSON.parse(body); } catch { return reply(400, {}); }
    }
    const packet = body?.packet;
    if (typeof packet !== 'string' || packet.length > 30000 || !/^MB1:[A-Za-z0-9+/]+=*$/.test(packet)) {
      return reply(400, {});
    }
    if (role === 'answer' && !await cache(['GET', offerKey], development)) return reply(404, {});
    const key = role === 'offer' ? offerKey : answerKey;
    const value = role === 'offer' ? JSON.stringify({ owner, packet }) : packet;
    const stored = await cache(['SET', key, value, 'EX', lifetime, 'NX'], development);
    return reply(stored ? 201 : 409, {});
  } catch {
    return reply(503, {});
  }
}
