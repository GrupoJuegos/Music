import React, {useState} from 'react';

export function Artwork({url, large = false, playing = false}: {
  url?: string; large?: boolean; playing?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  return <div className={large ? 'art' + (playing ? ' playing' : '') : 'trackart'} aria-hidden="true">
    {url && url !== failed
      ? <img src={url} alt="" decoding="async" loading={large ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer" onError={() => setFailed(url)}/>
      : <span>♫</span>}
  </div>;
}

export async function embeddedArtwork(file: File) {
  const {parseBlob, selectCover} = await import('music-metadata');
  const {common} = await parseBlob(file, {duration: false});
  const cover = selectCover(common.picture);
  if (!cover || cover.data.length > 10_000_000) return undefined;

  const image = await createImageBitmap(new Blob([new Uint8Array(cover.data)], {type: cover.format}));
  try {
    const scale = Math.min(1, 384 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.fillStyle = '#19181b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const artwork = canvas.toDataURL('image/jpeg', 0.78);
    return artwork.length <= 40000 ? artwork : canvas.toDataURL('image/jpeg', 0.5);
  } finally {
    image.close();
  }
}
