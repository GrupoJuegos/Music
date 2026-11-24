type Role = 'offer' | 'answer';

async function exchange(id: string, role: Role, signal: AbortSignal, owner?: string, packet?: string) {
  const headers = new Headers();
  if (owner) headers.set('Authorization', 'Bearer ' + owner);
  if (packet) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/pair?id=${id}&role=${role}`, {
    method: packet ? 'POST' : 'GET',
    headers,
    body: packet ? JSON.stringify({ packet }) : undefined,
    signal,
  });
  if (response.status === 409) throw Error('Esta invitación ya está en uso. Abre un nuevo QR en Salida.');
  if (!response.ok) throw Error('No se pudo conectar. Abre un nuevo QR en Salida e inténtalo de nuevo.');
  return (await response.json()).packet as string | null | undefined;
}

export async function publishPacket(id: string, role: Role, packet: string, signal: AbortSignal, owner?: string) {
  await exchange(id, role, signal, owner, packet);
}

export async function waitForPacket(id: string, role: Role, signal: AbortSignal, owner?: string) {
  const deadline = Date.now() + (role === 'offer' ? 20_000 : 295_000);
  while (Date.now() < deadline) {
    const packet = await exchange(id, role, signal, owner);
    if (packet) return packet;
    await new Promise(resolve => setTimeout(resolve, 750));
    signal.throwIfAborted();
  }
  throw Error('La invitación caducó. Abre un nuevo QR en Salida.');
}
