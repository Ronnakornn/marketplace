import https from 'node:https'
import webpush, { type PushSubscription } from 'web-push'

export const pushRequestDeadlineMs = 10_000
const maxResponseBytes = 64 * 1024

// web-push's timeout is socket inactivity, not a request deadline. Keep its
// encryption/signing but own the request so the deadline destroys the transport.
export async function sendWebPush(subscription: PushSubscription, payload: string): Promise<void> {
  const details = webpush.generateRequestDetails(subscription, payload)
  const endpoint = new URL(details.endpoint)
  if (endpoint.protocol !== 'https:') throw new Error('Push endpoint must use HTTPS')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      const request = https.request(endpoint, {
        method: details.method,
        headers: details.headers,
        agent: false,
      }, response => {
        let bytes = 0
        response.on('error', error => { request.destroy(error); reject(error) })
        response.once('aborted', () => {
          const error = new Error('Push response aborted')
          request.destroy(error)
          reject(error)
        })
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > maxResponseBytes) request.destroy(new Error('Push response exceeds limit'))
        })
        response.on('end', () => {
          const statusCode = response.statusCode ?? 0
          if (statusCode >= 200 && statusCode < 300) resolve()
          else reject(Object.assign(new Error('Push provider rejected delivery'), { statusCode }))
        })
      })
      request.on('error', reject)
      request.once('close', () => reject(new Error('Push request closed before completion')))
      timer = setTimeout(() => request.destroy(new Error('Push request deadline exceeded')), pushRequestDeadlineMs)
      request.end(details.body)
    })
  } finally {
    if (timer) clearTimeout(timer)
  }
}
