// Minimaler Marionette-Client (Protokoll v3, Länge:JSON), ohne Abhängigkeiten.
import net from 'node:net';

export class Marionette {
  constructor() { this.id = 0; this.pending = new Map(); this.buf = Buffer.alloc(0); }

  connect(port = 2828, host = '127.0.0.1') {
    return new Promise((resolve, reject) => {
      this.sock = net.connect(port, host);
      this.sock.on('error', reject);
      this.sock.on('data', (d) => this.#onData(d));
      this.hello = resolve;
    });
  }

  #onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const colon = this.buf.indexOf(':');
      if (colon < 0) return;
      const len = Number(this.buf.slice(0, colon).toString());
      if (this.buf.length < colon + 1 + len) return;
      const msg = JSON.parse(this.buf.slice(colon + 1, colon + 1 + len).toString());
      this.buf = this.buf.slice(colon + 1 + len);
      if (!Array.isArray(msg)) { this.hello?.(msg); this.hello = null; continue; }
      const [, id, err, res] = msg;
      const p = this.pending.get(id);
      if (p) { this.pending.delete(id); err ? p.reject(new Error(JSON.stringify(err))) : p.resolve(res); }
    }
  }

  send(name, params = {}) {
    const id = ++this.id;
    const body = JSON.stringify([0, id, name, params]);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.sock.write(`${Buffer.byteLength(body)}:${body}`);
    });
  }

  async script(source, args = []) {
    const r = await this.send('WebDriver:ExecuteScript', { script: `return (async () => { ${source} })();`, args, sandbox: 'system' });
    return r?.value;
  }

  close() { this.sock.destroy(); }
}
