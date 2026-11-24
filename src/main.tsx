import React,{useEffect,useRef,useState} from 'react';import{createRoot}from'react-dom/client';import QRCode from 'qrcode';import {Link} from './connection';import {initial,validCommand,type State,type Track,type Command} from './model';import {search} from './providers';import './style.css';
type Mode='home'|'input'|'output';
import {invitation,newSessionId,readInvitation} from './invite';
import {publishPacket,waitForPacket} from './signaling';
const fmt=(n:number)=>Number.isFinite(n)?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'0:00';
function App(){const[mode,setMode]=useState<Mode>(()=>readInvitation()?'input':'home'),[state,setState]=useState<State>(initial),[status,setStatus]=useState('Sin conexión'),[authorized,setAuthorized]=useState(false),[pair,setPair]=useState(()=>!!readInvitation()),[session,setSession]=useState(()=>readInvitation()||''),[incoming,setIncoming]=useState(''),[pairError,setPairError]=useState(''),[qr,setQr]=useState(''),[camera,setCamera]=useState(false),[q,setQ]=useState(''),[results,setResults]=useState<Track[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[youtube,setYoutube]=useState(''),[jamendo,setJamendo]=useState(''),[settings,setSettings]=useState(false),[source,setSource]=useState(0);const link=useRef<Link|null>(null),audio=useRef<HTMLAudioElement>(null),video=useRef<HTMLDivElement>(null),scanner=useRef<HTMLVideoElement>(null),latest=useRef(state),abort=useRef<AbortController|null>(null),urls=useRef<string[]>([]),yt=useRef<any>(null),current=state.queue[state.index],active=current?.sources[source];const sourceRef=useRef(source);sourceRef.current=source;latest.current=state;
const patch=(p:Partial<State>)=>setState(s=>({...s,...p}));
function stop(){const a=audio.current;if(a){a.pause();a.removeAttribute('src');a.load();}yt.current?.destroy?.();yt.current=null;}
function reset(){stop();link.current?.close();link.current=null;abort.current?.abort();urls.current.forEach(URL.revokeObjectURL);urls.current=[];setState(initial());setAuthorized(false);setPair(false);setCamera(false);setSession('');setIncoming('');setPairError('');setResults([]);setQ('');setYoutube('');setJamendo('');setNotice('');history.replaceState(null,'',location.pathname);setMode('home');}
function select(i:number){const s=latest.current;if(i<0||i>=s.queue.length){stopAudio();patch({playing:false});return;}if(i===s.index){if(audio.current?.getAttribute('src')){audio.current.currentTime=0;void audio.current.play().catch(()=>patch({playing:false,error:'Pulsa reproducir en SALIDA.'}));}yt.current?.seekTo?.(0,true);yt.current?.playVideo?.();patch({time:0,playing:true,error:''});return;}setSource(0);patch({index:i,time:0,duration:0,error:'',playing:true});}
function command(c:Command){const s=latest.current;if(c.type==='add'){if(s.queue.length>=100){setNotice('Cola llena');return;}const queue=[...s.queue,c.track];setState({...s,queue,index:s.index<0?0:s.index,playing:s.index<0||s.playing,error:''});if(s.index<0)setSource(0);}
else if(c.type==='play'){if(s.index>=0){patch({playing:true,error:''});if(audio.current?.getAttribute('src'))audio.current.play().catch(()=>patch({playing:false,error:'Pulsa reproducir en SALIDA para habilitar el audio.'}));yt.current?.playVideo?.();}}
else if(c.type==='pause'){stopAudio();patch({playing:false});}
else if(c.type==='next')select(s.index+1);else if(c.type==='prev')select(Math.max(0,s.index-1));else if(c.type==='select')select(Math.floor(c.value));else if(c.type==='seek'){const v=Math.min(c.value,s.duration||0);if(audio.current?.getAttribute('src'))audio.current.currentTime=v;yt.current?.seekTo?.(v,true);patch({time:v});}
else if(c.type==='volume'){const v=Math.min(1,c.value);if(audio.current)audio.current.volume=v;yt.current?.setVolume?.(v*100);patch({volume:v});}
else if(c.type==='clear'){stop();setState(initial());setSource(0);}
else if(c.type==='remove'){const i=Math.floor(c.value);if(i>=s.queue.length)return;const queue=s.queue.filter((_,j)=>i!==j);if(i===s.index){stop();setSource(0);patch({queue,index:Math.min(i,queue.length-1),playing:queue.length>0,time:0,duration:0});}else patch({queue,index:s.index-(i<s.index?1:0)});}}
function stopAudio(){audio.current?.pause();yt.current?.pauseVideo?.();}
function send(c:Command){if(mode==='output')command(c);else if(authorized)link.current?.send({kind:'command',command:c});else setNotice('Conecta primero con SALIDA.');}
function failed(){const s=latest.current;if(source+1<(s.queue[s.index]?.sources.length??0)){setSource(i=>i+1);patch({error:'',playing:true});}else patch({playing:false,error:'La fuente no está disponible. Prueba otra canción.'});}
useEffect(()=>{if(mode!=='output'||!active)return;const a=audio.current;let cancelled=false;const shouldPlay=latest.current.playing;stop();if(a){a.removeAttribute('src');a.load();}if(active.provider!=='youtube'){if(a){a.src=active.url;a.volume=latest.current.volume;if(shouldPlay)a.play().catch(()=>{if(!cancelled)patch({playing:false,error:'Pulsa reproducir en SALIDA para habilitar el audio.'});});}}else{const w=window as any;const setup=()=>{if(cancelled||!video.current)return;video.current.replaceChildren();const el=document.createElement('div');video.current.append(el);yt.current=new w.YT.Player(el,{videoId:active.id,width:'100%',height:'260',playerVars:{origin:location.origin,playsinline:1},events:{onReady:(e:any)=>{e.target.setVolume(latest.current.volume*100);if(shouldPlay)e.target.playVideo();},onStateChange:(e:any)=>{if(e.data===0)command({type:'next'});else if(e.data===1)patch({playing:true,error:''});else if(e.data===2)patch({playing:false});},onError:()=>failed()}})};if(w.YT?.Player)setup();else{const previous=w.onYouTubeIframeAPIReady;w.onYouTubeIframeAPIReady=()=>{previous?.();setup();};if(!document.querySelector('#yt-api')){const el=document.createElement('script');el.id='yt-api';el.src='https://www.youtube.com/iframe_api';el.onerror=()=>{if(!cancelled)failed()};document.head.append(el);}}}return()=>{cancelled=true;stop();};},[mode,current?.id,state.index,source]);
useEffect(()=>{if(mode!=='output')return;const t=setInterval(()=>{if(yt.current?.getCurrentTime)patch({time:yt.current.getCurrentTime(),duration:yt.current.getDuration()});if(link.current?.authorized){const s=latest.current;link.current.send({kind:'state',source:sourceRef.current,state:{...s,queue:s.queue.map(t=>({...t,sources:t.sources.map(x=>({...x,url:x.provider==='local'?'':x.url}))}))}});}},700);return()=>clearInterval(t);},[mode]);
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
  const request=new AbortController();
  const {signal}=request;
  let connectionTimeout: number|undefined;
  const connection=new Link(raw=>{
    const m=raw as any;
    if(mode==='output'&&connection.authorized&&m?.kind==='command'&&validCommand(m.command))command(m.command);
    if(mode==='input'&&connection.authorized&&m?.kind==='state'&&Array.isArray(m.state?.queue)&&m.state.queue.length<=100){
      setState(m.state);
      setSource(Number.isInteger(m.source)&&m.source>=0&&m.source<5?m.source:0);
    }
  },status=>{
    if(link.current!==connection)return;
    setStatus(status);
    if(status==='Conectado'){
      setAuthorized(true);
      setPair(false);
    }else if(status==='Desconectado'){
      setAuthorized(false);
      if(!signal.aborted){
        request.abort();
        setPairError('No se completó la conexión. Usa un nuevo QR y comprueba que ambos dispositivos estén en la misma red Wi-Fi.');
      }
      if(mode==='input')setState(initial());
    }
  });
  link.current=connection;
  setStatus(mode==='output'?'Esperando al teléfono…':'Conectando con Salida…');
  void (async()=>{
    try{
      if(mode==='output'){
        const owner=newSessionId();
        const offer=await connection.offer();
        await publishPacket(session,'offer',offer,signal,owner);
        await connection.accept(await waitForPacket(session,'answer',signal,owner));
      }else{
        const offer=await waitForPacket(session,'offer',signal);
        const answer=await connection.answer(offer);
        await publishPacket(session,'answer',answer,signal);
      }
      if(!connection.authorized&&!signal.aborted){
        connectionTimeout=window.setTimeout(()=>connection.close(),15_000);
      }
    }catch(error){
      if(signal.aborted)return;
      connection.close();
      setPairError(error instanceof Error?error.message:'Error de conexión');
    }
  })();
  return()=>{
    request.abort();
    window.clearTimeout(connectionTimeout);
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
async function lookup(e:React.FormEvent){e.preventDefault();if(!q.trim())return;abort.current?.abort();const a=new AbortController();abort.current=a;setBusy(true);setResults([]);setNotice('');const timer=setTimeout(()=>a.abort(),18000);try{const r=await search(q.trim(),a.signal,{youtube,jamendo});if(abort.current===a){setResults(r.tracks);setNotice(r.warnings.join(' · ')||(!r.tracks.length?'No encontramos coincidencias.':''));}}catch{if(abort.current===a)setNotice('No se pudo buscar.');}finally{clearTimeout(timer);if(abort.current===a)setBusy(false);}}
function local(files:FileList|null){if(!files)return;const tracks=Array.from(files).filter(f=>f.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)).map(f=>{const url=URL.createObjectURL(f);urls.current.push(url);return{id:crypto.randomUUID(),title:f.name.replace(/\.[^.]+$/,''),artist:'Archivo local',sources:[{provider:'local' as const,id:crypto.randomUUID(),url}]}});setState(s=>({...s,queue:[...s.queue,...tracks].slice(0,100),index:s.index<0&&tracks.length?0:s.index,playing:s.playing||s.index<0&&tracks.length>0}));}
return <main className={'app mode-'+mode}><header><button className="brand" onClick={reset}><span className="logo" aria-hidden="true">♫</span> MusicBridge</button><div className="headright">{mode!=='home'&&<button onClick={showDevices}><span className={authorized?'dot online':'dot'}/> {authorized?'Conectado':'Conectar'}</button>}<button onClick={()=>setSettings(!settings)} aria-label="Configuración">⚙</button></div></header>{settings&&<section className="panel"><h3>Proveedores opcionales</h3><p>Solo claves públicas restringidas por dominio; se conservan en memoria. Nunca introduzcas secretos privados.</p><label>YouTube Data API<input type="password" value={youtube} onChange={e=>setYoutube(e.target.value)}/></label><label>Jamendo Client ID<input value={jamendo} onChange={e=>setJamendo(e.target.value)}/></label><button onClick={()=>setSettings(false)}>Cerrar</button></section>}{mode==='home'?<section className="welcome"><div className="eyebrow">UNA CONEXIÓN. TODA TU MÚSICA.</div><h1>La música,<br/>a tu manera<span>.</span></h1><p>Tu teléfono controla. Tu ordenador reproduce. Sin cuentas, sin historial.</p><div className="modes"><button onClick={()=>startPairing('input')}><span className="modeicon" aria-hidden="true">▯</span><h2>Entrada</h2><p>Controla la reproducción desde otro dispositivo.</p><b>Conectar →</b></button><button onClick={()=>startPairing('output')}><span className="modeicon mint" aria-hidden="true">▱</span><h2>Salida</h2><p>Escucha música y recibe controles remotos.</p><b>Reproducir →</b></button></div></section>:<><div className="eyebrow">{mode==='output'?'SALIDA · REPRODUCTOR':'ENTRADA · CONTROL REMOTO'}</div>{pair&&<section className="panel pairing">
  <div className="sectionhead">
    <h2>{authorized?'Dispositivos conectados':mode==='output'?'Conecta tu teléfono':'Conectar con Salida'}</h2>
    <button onClick={showDevices}>{mode==='output'&&!authorized?'Ir al reproductor':'Cerrar'}</button>
  </div>
  {authorized?<button onClick={()=>{link.current?.close();setPair(false);}}>Desconectar</button>:<>
    {mode==='output'&&<>
      <p>Escanea el QR con la cámara del teléfono y abre el enlace. Usa la misma red Wi-Fi.</p>
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
</section>}<div hidden={pair&&!authorized}><nav className="sectionnav" aria-label="Navegación"><a href="#now-playing">Reproducción</a><a href="#music-search">Buscar</a><a href="#queue">Cola</a><button onClick={showDevices}>Dispositivos</button></nav><div className="workspace"><section className="panel player" id="now-playing"><div className="sectionhead"><span className="eyebrow">SONANDO AHORA</span><span className="tag">{active?.provider??'Sin fuente'}</span></div><div className={'art '+(state.playing?'playing':'')}>{current?.art?<img src={current.art} alt="" referrerPolicy="no-referrer"/>:<span>♫</span>}</div><h2>{current?.title??'Tu próxima canción'}</h2><p>{current?.artist??'Busca música o agrega un archivo'}</p>{mode==='output'&&<><audio ref={audio} onPlay={()=>patch({playing:true,error:''})} onPause={()=>patch({playing:false})} onTimeUpdate={e=>patch({time:e.currentTarget.currentTime})} onLoadedMetadata={e=>patch({duration:Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:0})} onEnded={()=>command({type:'next'})} onError={()=>{if(active&&active.provider!=='youtube')failed()}}/><div ref={video} className={active?.provider==='youtube'?'video':'hidden'}/></>}<input disabled={!current||!state.duration} aria-label="Posición" type="range" min="0" max={state.duration||1} value={Math.min(state.time,state.duration||1)} onChange={e=>send({type:'seek',value:+e.target.value})}/><div className="times"><span>{fmt(state.time)}</span><span>{fmt(state.duration)}</span></div><div className="transport"><button onClick={()=>send({type:'prev'})} aria-label="Anterior">⏮</button><button disabled={!current} className="play" onClick={()=>send({type:state.playing?'pause':'play'})} aria-label={state.playing?'Pausar':'Reproducir'}>{state.playing?'Ⅱ':'▶'}</button><button onClick={()=>send({type:'next'})} aria-label="Siguiente">⏭</button></div><label className="volume">Volumen<input aria-label="Volumen" type="range" min="0" max="1" step=".01" value={state.volume} onChange={e=>send({type:'volume',value:+e.target.value})}/></label>{state.error&&<p role="alert">{state.error}</p>}</section><section className="library" id="music-search"><h2 className="librarytitle">Explorar música</h2><form className="search" onSubmit={lookup}><input aria-label="Buscar música" placeholder="Canción o artista..." value={q} onChange={e=>setQ(e.target.value)}/><button className="primary" disabled={busy}>{busy?'Buscando…':'Buscar'}</button></form>{mode==='output'&&<label className="file">＋ Agregar archivos locales<input type="file" multiple accept="audio/*,.flac,.m4a" onChange={e=>{local(e.target.files);e.target.value=''}}/></label>}{results.length>0&&<section className="panel"><h3>Mejor coincidencia</h3>{results.slice(0,1).map(t=><article className="track" key={t.id}><span className="trackart">{t.art?<img src={t.art} alt="" loading="lazy" referrerPolicy="no-referrer"/>:'♫'}</span><div><b>{t.title}</b><p>{t.artist} · {t.sources[0].provider}</p></div><button onClick={()=>send({type:'add',track:t})}>＋ Cola</button></article>)}{results.length>1&&<details><summary>Otras canciones</summary>{results.slice(1,12).map(t=><article className="track" key={t.id}><span className="trackart">{t.art?<img src={t.art} alt="" loading="lazy" referrerPolicy="no-referrer"/>:'♫'}</span><div><b>{t.title}</b><p>{t.artist} · {t.sources[0].provider}</p></div><button onClick={()=>send({type:'add',track:t})}>＋</button></article>)}</details>}</section>}<section className="panel queue" id="queue"><div className="sectionhead"><h3>Cola de reproducción · {state.queue.length}</h3><button onClick={()=>send({type:'clear'})}>Vaciar</button></div>{!state.queue.length&&<p>Tu cola está vacía.</p>}{state.queue.map((t,i)=><article className={'track '+(i===state.index?'selected':'')} key={t.id+':'+i}><button className="queueplay" onClick={()=>send({type:'select',value:i})} aria-label={'Reproducir '+t.title}>{i===state.index&&state.playing?'♫':'▶'}</button><div><b>{t.title}</b><p>{t.artist}</p></div><button onClick={()=>send({type:'remove',value:i})} aria-label="Eliminar">×</button></article>)}</section></section></div></div></>}{notice&&<p className="notice" role="status">{notice}</p>}<footer>MusicBridge <span>·</span> Sesiones temporales <span>·</span> Sin cuentas ni historial</footer></main>}
createRoot(document.getElementById('root')!).render(<App/>);if('serviceWorker'in navigator&&import.meta.env.PROD)navigator.serviceWorker.register('/sw.js').catch(()=>{});
