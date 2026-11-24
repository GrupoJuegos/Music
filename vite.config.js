import { defineConfig } from 'vite';
import { pairing } from './server/pairing.js';

export default defineConfig({
  plugins: [{
    name: 'musicbridge-pairing',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/pair') return next();
        void pairing(req, res, true);
      });
    },
  }],
});
