const sessionId = /^[a-f0-9]{32}$/;

export function newSessionId() {
  return crypto.randomUUID().replaceAll('-', '');
}

export function invitation(id: string, origin: string) {
  return new URL('/#p=' + id, origin).href;
}

export function readInvitation(text: string = location.href): string | null {
  try {
    const id = new URLSearchParams(new URL(text).hash.slice(1)).get('p');
    return id && sessionId.test(id) ? id : null;
  } catch {
    return null;
  }
}
