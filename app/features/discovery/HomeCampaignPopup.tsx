'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog'
import { useLocale, useTranslations } from '#/i18n/client'
import { useLocalePath } from '#/i18n/navigation'
import {
  marketplaceHomeQueryOptions,
  type DiscoveryHomeResponse,
} from '#/features/marketplace/queries'
import {
  markPopupSeen,
  normalizePopupFrequency,
  popupIsActive,
  popupSeen,
  safePopupUrl,
} from './popup-policy'

type Popup = NonNullable<DiscoveryHomeResponse['sections']['popups']>[number]
export function HomeCampaignPopup({
  initialHome,
}: {
  initialHome?: DiscoveryHomeResponse
}) {
  const locale = useLocale(),
    t = useTranslations(),
    localePath = useLocalePath()
  const { data } = useQuery({
    ...marketplaceHomeQueryOptions({ locale }),
    initialData: initialHome,
  })
  const [active, setActive] = useState<Popup | null>(null),
    chosen = useRef(false)
  useEffect(() => {
    if (chosen.current) return
    const now = new Date()
    const popup = data?.sections.popups?.find((banner) => {
      if (!popupIsActive(banner, now)) return false
      const frequency = normalizePopupFrequency(banner.popupFrequency)
      try {
        return !popupSeen(
          frequency === 'SESSION' ? sessionStorage : localStorage,
          banner.id,
          frequency,
          now,
        )
      } catch {
        return true
      }
    })
    if (!popup) return
    chosen.current = true
    const frequency = normalizePopupFrequency(popup.popupFrequency)
    try {
      markPopupSeen(
        frequency === 'SESSION' ? sessionStorage : localStorage,
        popup.id,
        frequency,
        now,
      )
    } catch {
      /* Restricted storage still permits the campaign to display. */
    }
    setActive(popup)
  }, [data])
  useEffect(() => {
    if (!active?.endsAt) return
    const deadline = Date.parse(active.endsAt)
    let timeout: ReturnType<typeof setTimeout>
    const expire = () => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        setActive(null)
        return
      }
      timeout = setTimeout(expire, Math.min(remaining, 2_147_483_647))
    }
    expire()
    return () => clearTimeout(timeout)
  }, [active])
  if (!active) return null
  const title =
    (locale === 'th' ? active.titleTh : active.titleEn) || active.title
  const body =
    (locale === 'th' ? active.bodyTh : active.bodyEn) || active.subtitle
  const target = safePopupUrl(active.targetUrl),
    image = safePopupUrl(active.imageUrl)
  const href = target?.startsWith('/') ? localePath(target) : target
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setActive(null)
      }}
    >
      <DialogContent showCloseButton={false} className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-6">
          <DialogTitle>{title}</DialogTitle>
          {body ? (
            <DialogDescription className="whitespace-pre-line">
              {body}
            </DialogDescription>
          ) : null}
          {image ? (
            <img
              src={image}
              alt={title}
              className="max-h-80 w-full rounded object-cover"
            />
          ) : null}
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <button className="rounded border px-4 py-2 text-sm">
                {t('common.close')}
              </button>
            </DialogClose>
            {href ? (
              <a
                className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
                href={href}
              >
                {t('home.shopNow')}
              </a>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
