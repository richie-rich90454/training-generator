// Service Worker for offline support
let CACHE_NAME="training-generator-v2"

let PRECACHE_URLS=[
    "/",
    "/index.html",
    "/src/styles/main.css",
    "/src/renderer/app.ts",
]

self.addEventListener("install",(event:any)=>{
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache=>{
            console.log("[SW] Pre-caching app shell")
            return cache.addAll(PRECACHE_URLS)
        }).catch(err=>{
            console.warn("[SW] Pre-cache failed:",err)
        })
    )
    ;(self as any).skipWaiting()
})

self.addEventListener("activate",(event:any)=>{
    event.waitUntil(
        caches.keys().then(cacheNames=>{
            return Promise.all(
                cacheNames.map(cacheName=>{
                    if(cacheName!==CACHE_NAME){
                        console.log("[SW] Deleting old cache:",cacheName)
                        return caches.delete(cacheName)
                    }
                })
            )
        }).then(()=>{
            ;(self as any).clients.claim()
        })
    )
})

self.addEventListener("fetch",(event:any)=>{
    if(event.request.method!=="GET")return
    if(event.request.url.includes("/api/")||event.request.url.includes("localhost:11434")){
        return
    }
    event.respondWith(
        caches.match(event.request).then(cachedResponse=>{
            if(cachedResponse){
                return cachedResponse
            }
            return fetch(event.request).then(response=>{
                if(!response||response.status!==200||response.type!=="basic"){
                    return response
                }
                let responseToCache=response.clone()
                caches.open(CACHE_NAME).then(cache=>{
                    cache.put(event.request,responseToCache)
                })
                return response
            }).catch(()=>{
                if(event.request.mode==="navigate"){
                    return caches.match("/index.html") as Promise<Response>
                }
                return new Response("Offline",{status:503})
            })
        })
    )
})