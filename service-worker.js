const VERSION='feathercad-v1.0.1';
const SHELL=[
  './','./index.html','./styles.css','./manifest.webmanifest',
  './assets/favicon.svg','./assets/logo-mark.svg','./assets/wordmark.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png',
  './src/app.js','./src/app.js?v=1.0.1','./src/commands.js','./src/constants.js','./src/db.js','./src/history.js','./src/renderer.js','./src/store.js','./src/utils.js',
  './src/geometry/csg.js','./src/geometry/features.js','./src/io/exporter.js','./src/io/importer.js',
  './src/sketch/controller.js','./src/sketch/model.js','./src/sketch/solver.js','./src/sketch/view.js',
  './src/ui/icons.js','./src/ui/properties.js','./src/ui/templates.js','./src/workers/import-worker.js',
  './vendor/three/three.module.min.js','./vendor/three/LICENSE','./vendor/three/addons/controls/OrbitControls.js',
  './vendor/three/addons/loaders/GLTFLoader.js','./vendor/three/addons/loaders/3MFLoader.js','./vendor/three/addons/exporters/STLExporter.js',
  './vendor/three/addons/exporters/OBJExporter.js','./vendor/three/addons/exporters/GLTFExporter.js','./vendor/three/addons/utils/BufferGeometryUtils.js','./vendor/three/addons/libs/fflate.module.js'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(!response||response.status!==200&&response.type!=='opaque')return response;const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response;})));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
