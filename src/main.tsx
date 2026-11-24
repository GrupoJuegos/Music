import React,{useEffect,useRef,useState} from 'react';import{createRoot}from'react-dom/client';import QRCode from 'qrcode';import {Link} from './connection';import {initial,validCommand,type State,type Track,type Command} from './model';import {search} from './providers';import './style.css';
import {Artwork} from './artwork';
import {Transport,VolumeControl} from './transport';
type Mode='home'|'input'|'output';
import {invitation,newSessionId,readInvitation} from './invite';
const fmt=(n:number)=>Number.isFinite(n)?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'0:00';
const rangeProgress=(value:number,max:number)=>({'--played':Math.max(0,Math.min(100,value/max*100))+'%'} as React.CSSProperties);
function App(){const[mode,setMode]=useState<Mode>(()=>readInvitation()?'input':'home'),[state,setState]=useState<State>(initial),[status,setStatus]=useState('Sin conexión'),[authorized,setAuthorized]=useState(false),[pair,setPair]=useState(()=>!!readInvitation()),[session,setSession]=useState(()=>readInvitation()||''),[incoming,setIncoming]=useState(''),[pairError,setPairError]=useState(''),[qr,setQr]=useState(''),[camera,setCamera]=useState(false),[q,setQ]=useState(''),[results,setResults]=useState<Track[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);const link=useRef<Link|null>(null),video=useRef<HTMLDivElement>(null),scanner=useRef<HTMLVideoElement>(null),latest=useRef(state),abort=useRef<AbortController|null>(null),yt=useRef<any>(null),current=state.queue[state.index],active=current?.sources.find(item=>item.provider==='youtube');latest.current=state;
const playerReady=useRef(false),loadedVideo=useRef<string|null>(null);
const patch=(p:Partial<State>)=>setState(s=>({...s,...p}));
const videoBlocked='Pulsa Reproducir en el video de YouTube en Salida para iniciar la reproducción.';
function stop(){
  playerReady.current=false;loadedVideo.current=null;
  yt.current?.destroy?.();yt.current=null;
}
function reset(){
  stop();link.current?.close();link.current=null;abort.current?.abort();abort.current=null;
  setState(initial());setAuthorized(false);setPair(false);setCamera(false);setSession('');
  setIncoming('');setPairError('');setResults([]);setQ('');setNotice('');setBusy(false);
  history.replaceState(null,'',location.pathname);setMode('home');
}
function select(index:number){
  const snapshot=latest.current;
  const track=snapshot.queue[index];
  if(!track){yt.current?.pauseVideo?.();patch({playing:false});return;}
  if(track.id===snapshot.queue[snapshot.index]?.id){
    yt.current?.seekTo?.(0,true);
    yt.current?.playVideo?.();
    patch({index,time:0,playing:true,error:''});
    return;
  }
  patch({index,time:0,duration:0,playing:true,error:''});
}
function command(c:Command){
  const snapshot=latest.current;
  switch(c.type){
    case 'add': {
      if(!c.track.sources.some(source=>source.provider==='youtube'))return;
      if(snapshot.queue.length>=100){setNotice('Cola llena');return;}
      const first=snapshot.index<0;
      patch({queue:[...snapshot.queue,c.track],index:first?0:snapshot.index,playing:first||snapshot.playing});
      return;
    }
    case 'play':
      if(snapshot.index>=0){patch({playing:true,error:''});yt.current?.playVideo?.();}
      return;
    case 'pause':
      patch({playing:false});yt.current?.pauseVideo?.();
      return;
    case 'next': return select(snapshot.index+1);
    case 'prev': return select(Math.max(0,snapshot.index-1));
    case 'select': return select(Math.floor(c.value));
    case 'seek': {
      const time=Math.min(c.value,snapshot.duration||0);
      yt.current?.seekTo?.(time,true);
      patch({time});
      return;
    }
    case 'volume': {
      const volume=Math.min(1,c.value);
      yt.current?.setVolume?.(volume*100);
      if(volume>0)yt.current?.unMute?.();
      patch({volume});
      return;
    }
    case 'clear':
      setState(initial());
      return;
    case 'remove': {
      const index=Math.floor(c.value);
      if(index>=snapshot.queue.length)return;
      const queue=snapshot.queue.filter((_,i)=>i!==index);
      if(index!==snapshot.index){
        patch({queue,index:snapshot.index-(index<snapshot.index?1:0)});
        return;
      }
      const next=Math.min(index,queue.length-1);
      if(queue[next]?.id===snapshot.queue[snapshot.index]?.id){
        yt.current?.seekTo?.(0,true);
        yt.current?.playVideo?.();
      }
      patch({queue,index:next,time:0,duration:0,playing:next>=0,error:''});
    }
  }
}
function send(c:Command){
  if(mode==='output')command(c);
  else if(authorized)link.current?.send({kind:'command',command:c});
  else setNotice('Conecta primero con Salida.');
}
const videoId=active?.id;
const hasVideo=!!videoId;
useEffect(()=>{
  if(mode!=='output'||!hasVideo)return;
  let cancelled=false;
  const w=window as any;
  const unavailable=()=>{if(!cancelled)patch({playing:false,error:'YouTube no pudo reproducir este video. Prueba con otro.'});};
  const setup=()=>{
    const snapshot=latest.current;
    const initialVideo=snapshot.queue[snapshot.index]?.sources.find(item=>item.provider==='youtube')?.id;
    if(cancelled||!video.current||!initialVideo)return;
    const mount=document.createElement('div');
    video.current.replaceChildren(mount);
    loadedVideo.current=initialVideo;
    yt.current=new w.YT.Player(mount,{
      videoId:initialVideo,
      playerVars:{origin:location.origin,playsinline:1,controls:1,rel:0},
      events:{
        onReady:({target}:any)=>{
          if(cancelled)return;
          playerReady.current=true;
          target.getIframe().title='Reproductor de YouTube';
          target.setVolume(latest.current.volume*100);
          const {queue,index,playing}=latest.current;
          const selection=queue[index]?.sources.find(item=>item.provider==='youtube')?.id;
          if(selection&&selection!==loadedVideo.current)loadVideo(selection);
          else if(playing)target.playVideo();
        },
        onStateChange:({data}:any)=>{
          if(cancelled)return;
          if(data===0)command({type:'next'});
          else if(data===1)patch({playing:true,error:''});
          else if(data===2)patch({playing:false});
        },
        onAutoplayBlocked:()=>{if(!cancelled)patch({playing:false,error:videoBlocked});},
        onError:unavailable,
      },
    });
  };
  let script:HTMLScriptElement|null=null;
  if(w.YT?.Player)setup();
  else {
    w.onYouTubeIframeAPIReady=setup;
    script=document.querySelector<HTMLScriptElement>('#yt-api');
    if(!script){
      const newScript=document.createElement('script');
      newScript.id='yt-api';
      newScript.src='https://www.youtube.com/iframe_api';
      newScript.addEventListener('error',()=>newScript.remove(),{once:true});
      document.head.append(newScript);
      script=newScript;
    }
    script.addEventListener('error',unavailable,{once:true});
  }
  return()=>{
    cancelled=true;
    script?.removeEventListener('error',unavailable);
    if(w.onYouTubeIframeAPIReady===setup)delete w.onYouTubeIframeAPIReady;
    stop();
  };
},[mode,hasVideo]);

useEffect(()=>{
  if(mode==='output'&&videoId&&playerReady.current&&loadedVideo.current!==videoId)loadVideo(videoId);
},[mode,videoId]);

function loadVideo(id:string){
  loadedVideo.current=id;
  if(latest.current.playing)yt.current?.loadVideoById(id);
  else yt.current?.cueVideoById(id);
}
useEffect(()=>{
  if(mode!=='output')return;
  const timer=setInterval(()=>{
    const player=yt.current;
    const time=player?.getCurrentTime?.(),duration=player?.getDuration?.();
    const volume=player?.isMuted?.()?0:player?.getVolume?.()/100;
    const snapshot={...latest.current};
    if(Number.isFinite(time)&&Number.isFinite(duration)){
      Object.assign(snapshot,{time,duration});
      if(Number.isFinite(volume))snapshot.volume=volume;
      if(time!==latest.current.time||duration!==latest.current.duration||snapshot.volume!==latest.current.volume){
        patch({time,duration,volume:snapshot.volume});
      }
    }
    if(link.current?.authorized)link.current.send({kind:'state',source:0,state:snapshot});
  },500);
  return()=>clearInterval(timer);
},[mode]);
useEffect(()=>{if(mode!=='output'||!('mediaSession'in navigator))return;const m=navigator.mediaSession;if(current)m.metadata=new MediaMetadata({title:current.title,artist:current.artist});for(const [action,c]of [['play','play'],['pause','pause'],['nexttrack','next'],['previoustrack','prev']] as const){try{m.setActionHandler(action,()=>command({type:c}));}catch{}}return()=>{for(const a of ['play','pause','nexttrack','previoustrack'] as const)try{m.setActionHandler(a,null)}catch{};m.metadata=null;};},[mode,current?.id]);
const pairUrl=mode==='output'&&session?invitation(session,location.origin):'';
useEffect(()=>{
  let live=true;
  setQr('');
  if(pairUrl)void QRCode.toDataURL(pairUrl,{errorCorrectionLevel:'M',scale:8,margin:4})
    .then(image=>{if(live)setQr(image);})
    .catch(()=>{if(live)setPairError('No se pudo mostrar el QR. Puedes copiar el enlace.');});
  return()=>{live=false;};
},[pairUrl]);

function startPairing(nextMode: 'input'|'output', id = '') {
  setMode(nextMode);
  setPair(true);
  setIncoming('');
  setPairError('');
  setNotice('');
  setSession(nextMode==='output'?newSessionId():id);
}

useEffect(()=>{
  if(!camera||!scanner.current)return;
  let live=true;
  let controls:{stop():void}|undefined;
  const preview=scanner.current;
  void import('@zxing/browser').then(({BrowserQRCodeReader})=>{
    if(!live)return;
    return new BrowserQRCodeReader().decodeFromVideoDevice(undefined,preview,result=>{
      if(!live||!result)return;
      const text=result.getText().trim();
      const id=readInvitation(text);
      if(!id||new URL(text).origin!==location.origin){
        setPairError('Escanea el QR de Salida de esta misma página.');
        return;
      }
      setCamera(false);
      startPairing('input',id);
    });
  }).then(c=>{controls=c;if(!live)c?.stop();}).catch(()=>{
    if(live){setPairError('Cámara no disponible. Pega el enlace de Salida.');setCamera(false);}
  });
  return()=>{live=false;controls?.stop();};
},[camera]);

useEffect(()=>{
  if(!pair||!session||mode==='home')return;
  if(readInvitation()===session)history.replaceState(null,'',location.pathname+location.search);
  const connection=new Link(session,mode,raw=>{
    const m=raw as any;
    if(mode==='output'&&connection.authorized&&m?.kind==='command'&&validCommand(m.command))command(m.command);
    if(mode==='input'&&connection.authorized&&m?.kind==='state'&&Array.isArray(m.state?.queue)&&m.state.queue.length<=100){
      setState(m.state);
    }
  },status=>{
    if(link.current!==connection)return;
    setStatus(status);
    if(status==='Conectado'){
      setAuthorized(true);
      setPair(false);
    }else if(status==='Desconectado'){
      setAuthorized(false);
      if(mode==='input')setState(initial());
    }
  },message=>{
    if(link.current===connection){
      setSession('');
      setPair(true);
      setPairError(message);
    }
  });
  link.current=connection;
  setStatus(mode==='output'?'Esperando al teléfono…':'Conectando con Salida…');
  connection.start();
  return()=>{
    if(!connection.authorized){
      if(link.current===connection)link.current=null;
      connection.close();
    }
  };
},[mode,pair,session]);

function showDevices(){
  if(pair){
    setPair(false);
    setCamera(false);
  }else if(authorized){
    setPair(true);
    setSession('');
    setPairError('');
  }else if(mode!=='home'){
    startPairing(mode);
  }
}
function connectFromText(event:React.FormEvent){
  event.preventDefault();
  const text=incoming.trim();
  const id=readInvitation(text);
  if(!id||new URL(text).origin!==location.origin){
    setPairError('Pega el enlace de Salida de esta misma página.');
    return;
  }
  setCamera(false);
  startPairing('input',id);
}
async function lookup(event:React.FormEvent){
  event.preventDefault();
  if(!q.trim())return;
  abort.current?.abort();
  const request=new AbortController();
  abort.current=request;
  setBusy(true);setResults([]);setNotice('');
  const timer=setTimeout(()=>request.abort(),12000);
  try{
    const tracks=await search(q.trim(),request.signal);
    if(abort.current!==request)return;
    setResults(tracks);
    if(!tracks.length)setNotice('No encontramos coincidencias en YouTube.');
  }catch{
    if(abort.current===request)setNotice('No se pudo buscar en YouTube.');
  }finally{
    clearTimeout(timer);
    if(abort.current===request)setBusy(false);
  }
}
return <main className={'app mode-'+mode}>
  <header>
    <button className="brand" onClick={reset}><span className="logo" aria-hidden="true"><span className="playback-icon icon-play"/></span> MusicBridge</button>
    <div className="headright">{mode!=='home'&&<button onClick={showDevices}><span className={authorized?'dot online':'dot'}/> {authorized?'Conectado':'Conectar'}</button>}</div>
  </header>
{mode==='home'?<section className="welcome">
  <h1>La música,<br/>a tu manera<span>.</span></h1>
  <p>Reproduce videos de YouTube en una pantalla y contrólalos desde el teléfono.</p>
  <div className="modes">
    <button onClick={()=>startPairing('output')}>
      <span className="modeicon" aria-hidden="true"><span className="device-screen"/></span>
      <h2>Salida</h2><p>Abre el reproductor en esta pantalla.</p><b>Empezar a reproducir <span aria-hidden="true">→</span></b>
    </button>
    <button onClick={()=>startPairing('input')}>
      <span className="modeicon" aria-hidden="true"><span className="device-phone"/></span>
      <h2>Entrada</h2><p>Usa este dispositivo como control remoto.</p><b>Conectar a un reproductor <span aria-hidden="true">→</span></b>
    </button>
  </div>
</section>:<>{pair&&<section className="panel pairing">
  <div className="sectionhead">
    <h2>{authorized?'Dispositivos conectados':mode==='output'?'Conecta tu teléfono':'Conectar con Salida'}</h2>
    <button onClick={showDevices}>{mode==='output'&&!authorized?'Ir al reproductor':'Cerrar'}</button>
  </div>
  {authorized?<button onClick={()=>{link.current?.close();setPair(false);}}>Desconectar</button>:<>
    {mode==='output'&&<>
      <p>Escanea el QR con la cámara del teléfono y abre el enlace.</p>
      {qr&&<img className="qr" src={qr} alt="QR para conectar el teléfono a MusicBridge"/>}
      {pairUrl&&<button onClick={()=>navigator.clipboard.writeText(pairUrl).then(()=>setNotice('Enlace copiado.')).catch(()=>setPairError('Puedes abrir el enlace desde otro dispositivo: '+pairUrl))}>Copiar enlace</button>}
      {pairError&&<button onClick={()=>startPairing('output')}>Generar otro QR</button>}
    </>}
    {mode==='input'&&!session&&<>
      <form className="search" onSubmit={connectFromText}>
        <input aria-label="Enlace de Salida" placeholder="Pega el enlace de Salida" value={incoming} onChange={e=>setIncoming(e.target.value)}/>
        <button className="primary" disabled={!incoming.trim()}>Conectar</button>
      </form>
      <button onClick={()=>setCamera(!camera)}>{camera?'Cerrar cámara':'Escanear QR'}</button>
      {camera&&<video ref={scanner} muted playsInline/>}
    </>}
    {(!pairError&&(mode==='output'||session))&&<p role="status">{status}</p>}
    {pairError&&<p role="alert">{pairError}</p>}
    {mode==='input'&&session&&pairError&&<button onClick={()=>startPairing('input')}>Usar otro enlace</button>}
  </>}
</section>}<div hidden={pair&&!authorized&&!(mode==='output'&&hasVideo)}><nav className="sectionnav" aria-label="Navegación"><a href="#now-playing">Reproducción</a><a href="#music-search">Buscar</a><a href="#queue">Cola</a><button onClick={showDevices}>Dispositivos</button></nav><div className="workspace">
  <section className="panel player" id="now-playing">
    <div className="sectionhead"><span className="eyebrow">{mode==='output'?'REPRODUCTOR':'CONTROL REMOTO'}</span><span className="tag">YouTube</span></div>
    {mode==='output'
      ? <div className="video-stage">
          <div className="video-frame" ref={video}/>
          {!videoId&&<p>Elige un video de YouTube para reproducirlo aquí.</p>}
        </div>
      : <Artwork key={videoId} large url={current?.art} playing={state.playing}/>}
    <div className="track-heading">
      <h2>{current?.title??'Tu próxima canción'}</h2>
      {current&&<p>{current.artist}</p>}
    </div>
    {mode==='input'&&<>
      <label className="position">Posición<input disabled={!authorized||!current||!state.duration} type="range" min="0" max={state.duration||1} step=".1" style={rangeProgress(state.time,state.duration||1)} value={Math.min(state.time,state.duration||1)} onChange={e=>send({type:'seek',value:+e.target.value})}/></label>
      <div className="times"><span>{fmt(state.time)}</span><span>{fmt(state.duration)}</span></div>
      <Transport state={state} enabled={authorized&&!!current} send={send}/>
      <VolumeControl volume={state.volume} enabled={authorized&&!!current} send={send}/>
    </>}
    {state.error&&<p role="alert">{state.error}</p>}
    {mode==='output'&&videoId&&<a className="youtube-link" href={'https://www.youtube.com/watch?v='+encodeURIComponent(videoId)} target="_blank" rel="noopener noreferrer">Abrir en YouTube</a>}
  </section>
  <section className="library" id="music-search">
    <h2 className="librarytitle">Buscar en YouTube</h2>
    <form className="search" onSubmit={lookup}>
      <input aria-label="Buscar música" placeholder="Canción o artista…" value={q} maxLength={200} onChange={e=>setQ(e.target.value)}/>
      <button className="primary" disabled={busy}>{busy?'Buscando…':'Buscar'}</button>
    </form>
    {results.length>0&&<section className="panel results-panel" aria-label="Resultados de YouTube">
      {results.map(track=><article className="track" key={track.id}>
        <Artwork url={track.art}/>
        <div><b>{track.title}</b><p>{track.artist}</p></div>
        <button className="track-add" onClick={()=>send({type:'add',track})}>Añadir</button>
      </article>)}
    </section>}
    <section className="panel queue" id="queue">
      <div className="sectionhead"><h3>Cola <span className="queue-count">{state.queue.length}</span></h3><button disabled={!state.queue.length} onClick={()=>send({type:'clear'})}>Vaciar</button></div>
      {!state.queue.length&&<p>Tu cola está vacía.</p>}
      {state.queue.map((track,index)=><article className={'track '+(index===state.index?'selected':'')} key={track.id+':'+index}>
        <Artwork url={track.art}/>
        <div><b>{track.title}</b><p>{track.artist}</p></div>
        <button onClick={()=>send({type:'select',value:index})} aria-label={'Reproducir '+track.title}><span className="playback-icon icon-play" aria-hidden="true"/></button>
        <button onClick={()=>send({type:'remove',value:index})} aria-label={'Quitar '+track.title}><span className="playback-icon icon-remove" aria-hidden="true"/></button>
      </article>)}
    </section>
  </section>
</div></div></>}{notice&&<p className="notice" role="status">{notice}</p>}<footer>MusicBridge</footer></main>}
createRoot(document.getElementById('root')!).render(<App/>);if('serviceWorker'in navigator&&import.meta.env.PROD)navigator.serviceWorker.register('/sw.js').catch(()=>{});
