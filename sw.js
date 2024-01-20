const cacheName = 'v1';

// Cache assets
const assetsToCache = [
  '/',
  '/index.html',
  '/script.js',
  '/style.css',
  '/images/logo.jpeg',
  '/images/bomb.png',
  '/audios/*'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(assetsToCache); 
    })
  );
});

// Serve from cache
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});