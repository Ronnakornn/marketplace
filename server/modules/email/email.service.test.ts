import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { createEmailService } from './email.service.ts'

function context(environment: string): AppContext {
  return {
    config: { environment },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('createEmailService', () => {
  it('rejects the console provider in production', () => {
    expect(() => createEmailService(context('production'), { EMAIL_PROVIDER: 'console' } as unknown as NodeJS.ProcessEnv))
      .toThrow(/Unsupported email provider/)
  })

  it('fails closed when email delivery is disabled', async () => {
    const service = createEmailService(
      context('production'),
      { EMAIL_PROVIDER: 'disabled' } as unknown as NodeJS.ProcessEnv,
    )
    await expect(service.sendMessage({ to: 'buyer@example.com', subject: 'Test', text: 'Test' }))
      .rejects.toThrow(/not configured/)
  })

  it('sends OTP messages through the configured Resend endpoint', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    const service = createEmailService(context('production'), {
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM: 'Marketplace <no-reply@example.com>',
    } as unknown as NodeJS.ProcessEnv)

    await service.sendOtp({
      to: 'buyer@example.com',
      otp: '123456',
      purpose: 'EMAIL_VERIFICATION',
      expiresInMinutes: 15,
    })

    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer re_test_key' }),
    }))
    const request = fetchMock.mock.calls[0]![1]!
    expect(JSON.parse(String(request.body))).toMatchObject({
      from: 'Marketplace <no-reply@example.com>',
      to: 'buyer@example.com',
      subject: 'Verify your marketplace email',
    })
  })

  it('surfaces provider delivery failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(null, { status: 503 })))
    const service = createEmailService(context('production'), {
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM: 'Marketplace <no-reply@example.com>',
    } as unknown as NodeJS.ProcessEnv)

    await expect(service.sendMessage({ to: 'buyer@example.com', subject: 'Test', text: 'Test' }))
      .rejects.toThrow(/status 503/)
  })
})
