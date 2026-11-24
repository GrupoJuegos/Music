import React from 'react';
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
