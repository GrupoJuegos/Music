import React, {useState} from 'react';

export function Artwork({url, large = false, playing = false}: {
  url?: string; large?: boolean; playing?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  return <div className={large ? 'art' + (playing ? ' playing' : '') : 'trackart'} aria-hidden="true">
    {url && url !== failed
      ? <img src={url} alt="" decoding="async" loading={large ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer" onError={() => setFailed(url)}/>
      : <span className="playback-icon icon-play"/>}
  </div>;
}
