import React, {useEffect, useId, useRef, useState} from 'react';
import type {Command, State} from './model';

export function Transport({state, enabled, send}: {
  state: State;
  enabled: boolean;
  send: (command: Command) => void;
}) {
  const label = state.playing ? 'Pausar' : 'Reproducir';
  return <div className="transport remote-transport" role="group" aria-label="Controles de reproducción">
    <button disabled={!enabled || state.index <= 0} onClick={() => send({type: 'prev'})}>
      <span aria-hidden="true" className="playback-icon icon-previous"/>
      Anterior
    </button>
    <button className="primary" disabled={!enabled} onClick={() => send({type: state.playing ? 'pause' : 'play'})}>
      <span aria-hidden="true" className={'playback-icon ' + (state.playing ? 'icon-pause' : 'icon-play')}/>
      {label}
    </button>
    <button disabled={!enabled || state.index + 1 >= state.queue.length} onClick={() => send({type: 'next'})}>
      <span aria-hidden="true" className="playback-icon icon-next"/>
      Siguiente
    </button>
  </div>;
}

export function VolumeControl({volume, enabled, send}: {
  volume: number;
  enabled: boolean;
  send: (command: Command) => void;
}) {
  const sliderId = useId();
  const confirmed = Math.round(volume * 100);
  const [draft, setDraft] = useState<number | null>(null);
  const previousLevel = useRef(100);
  const level = enabled ? draft ?? confirmed : confirmed;
  const muted = level === 0;

  useEffect(() => {
    if (draft === null) {
      if (confirmed > 0) previousLevel.current = confirmed;
      return;
    }
    // Hold the local value while the player catches up to the remote command.
    const timer = window.setTimeout(() => setDraft(null), enabled
      ? (confirmed === draft ? 400 : 3000)
      : 0);
    return () => window.clearTimeout(timer);
  }, [confirmed, draft, enabled]);

  function adjust(nextLevel: number) {
    if (nextLevel > 0) previousLevel.current = nextLevel;
    setDraft(nextLevel);
    send({type: 'volume', value: nextLevel / 100});
  }

  return <div className="volume-control" role="group" aria-label="Volumen de Salida">
    <div className="volume-heading">
      <label htmlFor={sliderId}>Volumen</label>
      <span aria-hidden="true">{level}%</span>
    </div>
    <div className="volume-adjust">
      <button type="button" disabled={!enabled} onClick={() => adjust(muted ? previousLevel.current : 0)}
        aria-label={muted ? 'Restaurar volumen' : 'Silenciar'}>
        <span aria-hidden="true" className={muted ? 'speaker-icon muted' : 'speaker-icon'}/>
      </button>
      <input id={sliderId} type="range" min="0" max="100" step="1" value={level}
        disabled={!enabled} aria-valuetext={level + ' %'}
        style={{'--played': level + '%'} as React.CSSProperties}
        onChange={event => adjust(event.currentTarget.valueAsNumber)}/>
    </div>
  </div>;
}
