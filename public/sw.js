const CACHE_NAME='sunodown-pwa-v23-1';
const APP_SHELL=['/offline.html','/favicon.svg','/apple-touch-icon.png','/icon-maskable.svg'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(APP_SHELL))
      .catch(()=>undefined)
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys=>Promise.all(
        keys.filter(key=>key.startsWith('sunodown-pwa-')&&key!==CACHE_NAME)
          .map(key=>caches.delete(key))
      ))
    ])
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  // Never cache dynamic/API/audio responses. This avoids stale songs, auth state,
  // editor builds and range-request issues after a deploy.
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request).catch(()=>caches.match('/offline.html'))
    );
    return;
  }

  if(APP_SHELL.includes(url.pathname)){
    event.respondWith(
      caches.match(request).then(cached=>cached||fetch(request))
    );
  }
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{}
  const title=data.title||'SunoDown';
  const options={
    body:data.body||'Video của bạn đã render xong.',
    icon:'/apple-touch-icon.png',
    badge:'/apple-touch-icon.png',
    tag:data.jobId?`render-${data.jobId}`:'suno-render',
    data:{url:data.url||(data.jobId?`/?renderJob=${encodeURIComponent(data.jobId)}`:'/')}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
  event.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if('focus'in client){
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
