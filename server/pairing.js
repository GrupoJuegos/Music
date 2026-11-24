const sessionId = /^[a-f0-9]{32}$/;
const local = new Map();
const invitationLifetime = 300000;
const pairedIdleLimit = 30 * 60 * 1000;
const compareAndSet = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
if ARGV[2] == '' then redis.call('DEL', KEYS[1])
else redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) end
return 1`;

async function cache(command, development) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const [url, token] = KV_REST_API_URL && KV_REST_API_TOKEN
    ? [KV_REST_API_URL, KV_REST_API_TOKEN]
    : [UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN];
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
  if (command[0] === 'GET') return local.get(command[1])?.value ?? null;
  const [, , , key, before, after, ttl] = command;
  if ((local.get(key)?.value ?? '') !== before) return 0;
  if (after) local.set(key, { value: after, expires: now + ttl * 1000 });
  else local.delete(key);
  return 1;
}

async function bodyOf(req) {
  let body = req.body;
  if (body === undefined) {
    body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 200000) return null;
    }
  }
  if (typeof body === 'string') {
    if (body.length > 200000) return null;
    try { body = JSON.parse(body); } catch { return null; }
  }
  return body;
}

export async function pairing(req, res, development = false) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, data = {}) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };

  try {
    if (req.method !== 'POST') return reply(405);
    const body = await bodyOf(req);
    const { id, role, action, state, command, sequence, acknowledged } = body ?? {};
    const token = req.headers.authorization?.slice(7) ?? '';
    if (typeof id !== 'string' || !sessionId.test(id) || !sessionId.test(token) ||
        !['output', 'input'].includes(role) || !['join', 'sync', 'close'].includes(action)) return reply(400);
    if ((state && (role !== 'output' || JSON.stringify(state).length > 160000)) ||
        (command && (role !== 'input' || !Number.isSafeInteger(sequence) ||
          sequence < 1 || JSON.stringify(command).length > 12000))) return reply(400);

    const key = `musicbridge:control:${id}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = await cache(['GET', key], development) ?? '';
      const now = Date.now();
      if (!before && (role !== 'output' || action !== 'join')) {
        return reply(action === 'join' ? 404 : 410);
      }
      const room = before ? JSON.parse(before) : {
        output: token, outputAt: now, input: null, inputAt: 0, created: now,
        state: null, command: null, sequence: 0, acknowledged: 0,
      };
      if (role === 'output' && room.output !== token) return reply(403);
      if (role === 'input') {
        if (!room.input && action === 'join') room.input = token;
        if (room.input !== token) return reply(409);
      }
      const idleLimit = room.inputAt ? pairedIdleLimit : 25000;
      const expired = now - room.outputAt > idleLimit ||
        (room.inputAt ? now - room.inputAt > idleLimit : now - room.created > invitationLifetime);
      if (expired) return reply(410);

      if (role === 'output') {
        room.outputAt = now;
        if (state) room.state = state;
        if (acknowledged === room.sequence) {
          room.command = null;
          room.acknowledged = room.sequence;
        }
      } else {
        room.inputAt = now;
        if (command && !room.command && sequence === room.sequence + 1) {
          room.command = command;
          room.sequence = sequence;
        }
      }
      const after = action === 'close' ? '' : JSON.stringify(room);
      const ttl = room.inputAt ? Math.ceil(pairedIdleLimit / 1000) : 35;
      if (!await cache(['EVAL', compareAndSet, 1, key, before, after, ttl], development)) continue;
      if (action === 'close') return reply(200);
      return reply(200, role === 'output'
        ? { connected: !!room.input, command: room.command, sequence: room.sequence }
        : { connected: true, state: room.state, acknowledged: room.acknowledged });
    }
    return reply(503);
  } catch {
    return reply(503);
  }
}
