self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('crm-system-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/Index.html',
        '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
