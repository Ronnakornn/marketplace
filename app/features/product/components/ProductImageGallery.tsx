"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ImageOffIcon, PlayIcon, XIcon } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "#/components/ui/carousel";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { useTranslations } from "#/i18n/client";

interface ProductImageGalleryProps {
  images: string[];
  title: string;
  video: { url: string; contentType: string } | null;
}

const CAROUSEL_OPTIONS = { align: "start", loop: false } as const;

export function ProductImageGallery({ images, title, video }: ProductImageGalleryProps) {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(images.length === 0 && Boolean(video));
  const [mainApi, setMainApi] = useState<CarouselApi>();
  const [dialogApi, setDialogApi] = useState<CarouselApi>();
  const imageButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.min(selectedIndex, Math.max(0, images.length - 1));
  const imageLabel = (index: number) => t("product.productImage").replace("{title}", title).replace("{index}", String(index + 1));

  const syncSelection = useCallback((api: CarouselApi) => {
    if (!api) return;
    const index = api.selectedScrollSnap();
    if (!dialogOpen && imageButtons.current.some((button) => button === document.activeElement)) {
      imageButtons.current[index]?.focus({ preventScroll: true });
    }
    setSelectedIndex(index);
  }, [dialogOpen]);

  useEffect(() => {
    if (!mainApi) return;
    mainApi.on("select", syncSelection);
    return () => { mainApi.off("select", syncSelection); };
  }, [mainApi, syncSelection]);

  useEffect(() => {
    if (!dialogApi) return;
    dialogApi.on("select", syncSelection);
    return () => { dialogApi.off("select", syncSelection); };
  }, [dialogApi, syncSelection]);

  useEffect(() => {
    if (!showVideo && mainApi?.selectedScrollSnap() !== activeIndex) mainApi?.scrollTo(activeIndex, true);
    if (dialogOpen && dialogApi?.selectedScrollSnap() !== activeIndex) dialogApi?.scrollTo(activeIndex, true);
  }, [activeIndex, showVideo, mainApi, dialogApi, dialogOpen]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      dialogApi?.scrollPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      dialogApi?.scrollNext();
    }
  }

  return (
    <div className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {showVideo && video ? (
        <div className="h-[50dvh] max-h-[520px] bg-slate-100 lg:h-[min(60dvh,520px)]">
          <video controls preload="metadata" className="size-full object-contain" aria-label={t("product.productVideo").replace("{title}", title)}>
            <source src={video.url} type={video.contentType} />
          </video>
        </div>
      ) : images.length ? (
        <Carousel opts={CAROUSEL_OPTIONS} setApi={setMainApi} aria-label={t("product.productMediaGallery")} className="bg-slate-50">
          <CarouselContent className="ml-0 touch-pan-y">
            {images.map((image, index) => (
              <CarouselItem key={`${image}-${index}`} className="pl-0" aria-hidden={index !== activeIndex}>
                <button
                  ref={(button) => { imageButtons.current[index] = button; }}
                  type="button"
                  tabIndex={index === activeIndex ? 0 : -1}
                  aria-label={imageLabel(index)}
                  aria-haspopup="dialog"
                  className="relative block h-[50dvh] max-h-[520px] w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 lg:h-[min(60dvh,520px)]"
                  onClick={() => setDialogOpen(true)}
                >
                  <Image src={image} alt={title} fill sizes="(max-width: 1024px) 100vw, 55vw" loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : undefined} draggable={false} className="select-none object-contain" />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
          {images.length > 1 ? <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-xs tabular-nums text-slate-600">{activeIndex + 1} / {images.length}</span> : null}
        </Carousel>
      ) : (
        <div className="flex h-[50dvh] max-h-[520px] flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center text-slate-500 lg:h-[min(60dvh,520px)]" role="img" aria-label={t("product.noProductImages").replace("{title}", title)}>
          <ImageOffIcon className="size-12 text-slate-400" aria-hidden="true" />
          <p className="max-w-xs text-sm font-medium text-slate-600">{t("product.noProductImageAvailable")}</p>
        </div>
      )}

      {images.length > 0 || video ? (
        <div role="listbox" aria-label={t("product.productMediaGallery")} className="flex gap-2 overflow-x-auto p-3">
          {images.map((image, index) => (
            <button key={`${image}-${index}`} type="button" role="option" aria-label={t("product.showProductImage").replace("{index}", String(index + 1))} aria-selected={!showVideo && activeIndex === index}
              className={`relative size-12 shrink-0 overflow-hidden rounded-md border bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${!showVideo && activeIndex === index ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200"}`}
              onClick={() => { setShowVideo(false); setSelectedIndex(index); }}>
              <Image src={image} alt={imageLabel(index)} fill sizes="48px" draggable={false} className="object-contain" />
            </button>
          ))}
          {video ? <button type="button" role="option" aria-label={t("product.showProductVideo")} aria-selected={showVideo}
            className={`flex size-12 shrink-0 items-center justify-center rounded-md border bg-slate-950 text-white outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${showVideo ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200"}`}
            onClick={() => setShowVideo(true)}><PlayIcon className="size-4" aria-hidden="true" /></button> : null}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton={false} aria-describedby={undefined}
          className="inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-slate-950 p-0 text-white sm:max-w-none"
          onKeyDown={handleDialogKeyDown}
          onCloseAutoFocus={(event) => { event.preventDefault(); imageButtons.current[activeIndex]?.focus(); }}>
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogClose asChild><button type="button" aria-label={t("common.close")} className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"><XIcon className="size-5" aria-hidden="true" /></button></DialogClose>
          <Carousel opts={CAROUSEL_OPTIONS} setApi={setDialogApi} aria-label={t("product.productMediaGallery")} className="w-full flex-1">
            <CarouselContent className="ml-0 touch-pan-y">
              {images.map((image, index) => <CarouselItem key={`${image}-${index}`} className="pl-0" aria-hidden={index !== activeIndex}>
                <div className="relative h-dvh w-full">
                  <Image src={image} alt={imageLabel(index)} fill sizes="100vw" draggable={false} className="select-none object-contain p-6 py-16 sm:p-12 sm:py-16" />
                </div>
              </CarouselItem>)}
            </CarouselContent>
          </Carousel>
          <span aria-hidden="true" className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-sm tabular-nums text-white/75">{activeIndex + 1} / {images.length}</span>
        </DialogContent>
      </Dialog>
    </div>
  );
}
