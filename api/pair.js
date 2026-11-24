import { pairing } from '../server/pairing.js';

export default function handler(req, res) {
  return pairing(req, res);
}
