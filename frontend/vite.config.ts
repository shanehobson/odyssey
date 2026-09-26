import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * In development the app talks to the BFF through this proxy so the HttpOnly
 * session cookie is first-party on localhost. The proxy target is the Lambda
 * Function URL (or CloudFront) of a deployed backend, configured in `.env`.
 * These are deliberately not VITE_-prefixed so Vite never exposes them to the bundle:
 *
 *   DEV_PROXY_TARGET       https://<function-url-host>  (required for /api and /auth)
 *   DEV_PROXY_COOKIE_DOMAIN the cookie domain the backend sets, rewritten to localhost
 *   DEV_PROXY_BFF_AUTH     the CloudFront->origin shared secret; the backend rejects
 *                           /api and /auth requests that don't carry it
 */
function bffProxy(env: Record<string, string>, port: number): ProxyOptions {
  const cookieDomain = env.DEV_PROXY_COOKIE_DOMAIN
  return {
    target: env.DEV_PROXY_TARGET,
    changeOrigin: true,
    secure: true,
    ws: true,
    cookieDomainRewrite: cookieDomain ? { [cookieDomain]: 'localhost' } : undefined,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('Origin', `http://localhost:${port}`)
        proxyReq.setHeader('Referer', `http://localhost:${port}/`)
        if (env.DEV_PROXY_BFF_AUTH) {
          proxyReq.setHeader('X-Bff-Auth', env.DEV_PROXY_BFF_AUTH)
        }
      })
      proxy.on('proxyRes', (proxyRes, req) => {
        console.log('[proxy]', proxyRes.statusCode, req.method, req.url)
        // Cookies are set with `Secure`; strip it so the browser keeps them on http://localhost
        const setCookie = proxyRes.headers['set-cookie']
        if (setCookie) {
          proxyRes.headers['set-cookie'] = setCookie.map((cookie: string) =>
            cookie.replace(/;\s*Secure/gi, '')
          )
        }
      })
      proxy.on('error', (err, req) => {
        console.error('[proxy] error', err.message, 'for', req.url)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'DEV_PROXY_'])
  const port = 3001
  const proxy = env.DEV_PROXY_TARGET
    ? { '/api': bffProxy(env, port), '/auth': bffProxy(env, port) }
    : undefined

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: { port, proxy },
  }
})
