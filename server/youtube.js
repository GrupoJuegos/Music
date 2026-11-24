export async function youtubeSearch(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return reply(405, { error: 'method_not_allowed' });
  }
  const query = new URL(req.url, 'http://localhost').searchParams.get('q')?.trim();
  if (!query || query.length > 200) return reply(400, { error: 'invalid_query' });

  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) return reply(503, { error: 'youtube_not_configured' });

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      videoCategoryId: '10',
      maxResults: '8',
      q: query,
    });
    const response = await fetch('https://www.googleapis.com/youtube/v3/search?' + params, {
      headers: { 'X-Goog-Api-Key': key },
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok) {
      const reason = data.error?.details?.find(detail => detail.reason)?.reason
        ?? data.error?.errors?.[0]?.reason ?? 'unknown';
      console.warn('YouTube search rejected', response.status, reason);
      return reply(502, { error: 'youtube_unavailable' });
    }

    const tracks = (data.items ?? []).flatMap(item => {
      const id = item.id?.videoId;
      const snippet = item.snippet;
      if (!id || !/^[\w-]{11}$/.test(id) || !snippet?.title) return [];
      return [{
        id: 'youtube:' + id,
        title: snippet.title,
        artist: snippet.channelTitle ?? 'YouTube',
        art: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
        sources: [{ provider: 'youtube', id, url: '' }],
      }];
    });
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return reply(200, { tracks });
  } catch {
    return reply(502, { error: 'youtube_unavailable' });
  }
}
