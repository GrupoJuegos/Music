import { defineConfig } from 'vite';
import { youtubeSearch } from './server/youtube.js';
import { pairing } from './server/pairing.js';

export default defineConfig({
  plugins: [{
    name: 'musicbridge-pairing',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path === '/api/youtube') return void youtubeSearch(req, res);
        if (path === '/api/pair') return void pairing(req, res, true);
        next();
      });
    },
  }],
});
