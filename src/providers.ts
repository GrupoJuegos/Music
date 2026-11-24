import type {Track} from './model';

export async function search(query: string, signal: AbortSignal): Promise<Track[]> {
  const response = await fetch('/api/youtube?' + new URLSearchParams({q: query}), {signal});
  if (!response.ok) throw Error('La búsqueda de YouTube no está disponible.');
  const {tracks} = await response.json();
  return tracks;
}
