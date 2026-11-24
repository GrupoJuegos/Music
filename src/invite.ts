// A URL fragment carries the temporary SDP offer without sending it to the host.
export function invitation(code:string,origin:string){const url=new URL('/',origin);url.hash='pair='+encodeURIComponent(code);return url.href;}
export function readInvitation(text:string=location.href):string|null{try{const url=new URL(text);const code=new URLSearchParams(url.hash.slice(1)).get('pair');return code?.startsWith('MB1:')&&code.length<=30000?code:null;}catch{return null;}}
