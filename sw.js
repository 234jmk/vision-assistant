/* 视障助手 - Service Worker */
const CACHE_NAME = 'vision-assistant-v1';

/* 需要缓存的资源列表 */
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* TensorFlow.js 和 COCO-SSD 的 CDN 地址（缓存模型脚本） */
const CDN_CACHE_PATTERNS = [
  'cdn.jsdelivr.net/npm/@tensorflow',
  'cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd',
];

/* 安装：预缓存核心资源 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存核心资源');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  /* 立即激活，不等待旧 SW 关闭 */
  self.skipWaiting();
});

/* 激活：清理旧缓存 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

/* 请求拦截：网络优先，失败则用缓存 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* 只处理 GET 请求 */
  if (event.request.method !== 'GET') return;

  /* CDN 资源：缓存优先（模型很大，下载慢） */
  const isCDN = CDN_CACHE_PATTERNS.some((p) => url.href.includes(p));
  if (isCDN) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  /* 本地资源：网络优先，离线回退缓存 */
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response('离线模式', { status: 503 });
        });
      })
  );
});
