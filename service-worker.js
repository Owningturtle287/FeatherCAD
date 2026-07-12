const VERSION='feathercad-v1.0.0';
const SHELL=['./','./index.html','./styles.css','./manifest.webmanifest','./assets/favicon.svg','./assets/logo-mark.svg','./assets/wordmark.svg','./assets/icon-192.png','./src/app.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(!response||response.status!==200&&response.type!=='opaque')return response;const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):undefined)));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
