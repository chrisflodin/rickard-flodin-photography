"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import PhotoImage from "@/components/photo-image";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/types/photo";

export default function PhotoLightbox({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in"
        aria-label={`View ${photo.title} larger`}
      >
        <PhotoImage
          photo={photo}
          priority
          sizes="(max-width: 768px) 100vw, 80vw"
          className="max-h-[68vh] w-full object-contain object-left"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={photo.title}
          onClick={() => setOpen(false)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-10 text-white hover:bg-white/10 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
            aria-label="Close large photo view"
          >
            <X className="h-6 w-6" />
          </Button>

          <div
            className="flex max-h-[94vh] max-w-[96vw] items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <PhotoImage
              photo={photo}
              sizes="100vw"
              className="h-auto max-h-[94vh] w-auto max-w-[96vw] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
