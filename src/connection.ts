import {newSessionId} from './invite';
import type {Command, State} from './model';

type RelayReply = {
  connected: boolean;
  command?: unknown;
  sequence?: number;
  state?: unknown;
  acknowledged?: number;
};

export class Link {
  authorized = false;
  private token = newSessionId();
  private controller = new AbortController();
  private timer?: number;
  private state: unknown;
  private commands: unknown[] = [];
  private sequence = 0;
  private received = 0;

  constructor(
    private id: string,
    private role: 'output'|'input',
    private receive: (message: unknown) => void,
    private status: (status: string) => void,
    private error: (message: string) => void,
  ) {}

  start() {
    void this.sync(true, Date.now());
  }

  send(payload: {kind: 'command'; command: Command} | {kind: 'state'; source: number; state: State}) {
    if (payload.kind === 'state') this.state = payload;
    if (payload.kind === 'command' && this.commands.length < 32) this.commands.push(payload.command);
  }

  private request(action: 'join'|'sync'|'close', signal?: AbortSignal) {
    return fetch('/api/pair', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer '+this.token},
      body: JSON.stringify({
        id: this.id, role: this.role, action,
        ...(action === 'close' ? {} : this.role === 'output'
          ? {state: this.state, acknowledged: this.received}
          : {command: this.commands[0], sequence: this.sequence + 1}),
      }),
      signal,
      keepalive: action === 'close',
    });
  }

  private async sync(joining: boolean, lastSuccess: number) {
    const signal = this.controller.signal;
    try {
      const response = await this.request(joining ? 'join' : 'sync', signal);
      if (signal.aborted) return;
      if (response.status === 409) throw Error('Este QR ya está conectado a otro teléfono.');
      if (response.status === 410) throw Error('La sesión terminó. Abre un nuevo QR en Salida.');
      if (!response.ok) {
        if (Date.now() - lastSuccess < 12000 && [404, 503].includes(response.status)) {
          this.schedule(joining, lastSuccess);
          return;
        }
        throw Error('No se pudo conectar. Abre un nuevo QR en Salida.');
      }
      const data: RelayReply = await response.json();
      if (signal.aborted) return;
      if (data.connected && !this.authorized) {
        this.authorized = true;
        this.status('Conectado');
      }
      if (this.role === 'output' && data.command && data.sequence === this.received + 1) {
        this.receive({kind: 'command', command: data.command});
        this.received = data.sequence;
      }
      if (this.role === 'input') {
        if (this.commands.length && data.acknowledged === this.sequence + 1) {
          this.commands.shift();
          this.sequence++;
        }
        if (data.state) this.receive(data.state);
      }
      this.schedule(false, Date.now());
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof TypeError && Date.now() - lastSuccess < 12000) {
        this.schedule(joining, lastSuccess);
        return;
      }
      this.close();
      this.error(error instanceof Error ? error.message : 'Error de conexión');
    }
  }

  private schedule(joining: boolean, lastSuccess: number) {
    this.timer = window.setTimeout(() => void this.sync(joining, lastSuccess), this.authorized ? 850 : 650);
  }

  close() {
    if (this.controller.signal.aborted) return;
    this.controller.abort();
    window.clearTimeout(this.timer);
    this.authorized = false;
    this.status('Desconectado');
    void this.request('close').catch(() => {});
  }
}
