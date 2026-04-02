import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";

type ScrollFadeState = {
  showStart: boolean;
  showEnd: boolean;
};

type HorizontalPillStripProps = {
  ariaLabel: string;
  children: ReactNode;
  scrollClassName?: string;
  listClassName?: string;
};

export function HorizontalPillStrip({
  ariaLabel,
  children,
  scrollClassName = "",
  listClassName = ""
}: HorizontalPillStripProps) {
  const dragStateRef = useRef<{ element: HTMLDivElement; startX: number; startScrollLeft: number; didDrag: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [fadeState, setFadeState] = useState<ScrollFadeState>({ showStart: false, showEnd: true });

  function computeFadeState(element: HTMLDivElement | null): ScrollFadeState {
    if (!element) {
      return { showStart: false, showEnd: false };
    }

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    if (maxScrollLeft <= 1) {
      return { showStart: false, showEnd: false };
    }

    return {
      showStart: element.scrollLeft > 1,
      showEnd: element.scrollLeft < maxScrollLeft - 1
    };
  }

  useEffect(() => {
    function handleWindowMouseMove(event: MouseEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const deltaX = event.clientX - dragState.startX;
      if (Math.abs(deltaX) > 10) {
        dragState.didDrag = true;
        suppressClickRef.current = true;
        dragState.element.dataset.dragging = "true";
      }

      dragState.element.scrollLeft = dragState.startScrollLeft - deltaX;
      if (dragState.didDrag) {
        event.preventDefault();
      }
    }

    function handleWindowMouseUp() {
      if (!dragStateRef.current) return;
      delete dragStateRef.current.element.dataset.dragging;
      dragStateRef.current = null;
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, []);

  useEffect(() => {
    const updateFadeState = () => setFadeState(computeFadeState(scrollRef.current));

    updateFadeState();
    window.addEventListener("resize", updateFadeState);
    return () => window.removeEventListener("resize", updateFadeState);
  }, [children]);

  function handleHorizontalDragStart(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    suppressClickRef.current = false;
    dragStateRef.current = {
      element: event.currentTarget,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      didDrag: false
    };
  }

  function handleHorizontalDragClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  function handleHorizontalWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const canScrollHorizontally = element.scrollWidth > element.clientWidth;
    if (!canScrollHorizontally) return;

    const horizontalDelta = event.deltaX;
    const verticalDelta = event.deltaY;
    const intendedDelta = Math.abs(horizontalDelta) > 0 ? horizontalDelta : verticalDelta;
    if (intendedDelta === 0) return;

    element.scrollBy({
      left: intendedDelta,
      behavior: "smooth"
    });
    event.preventDefault();
  }

  const scrollClasses = ["pill-strip-scroll", fadeState.showStart ? "fade-start" : "", fadeState.showEnd ? "fade-end" : "", scrollClassName]
    .filter(Boolean)
    .join(" ");
  const listClasses = ["pill-strip-list", listClassName].filter(Boolean).join(" ");

  return (
    <div className={scrollClasses}>
      <div
        ref={scrollRef}
        className={listClasses}
        role="group"
        aria-label={ariaLabel}
        onMouseDown={handleHorizontalDragStart}
        onScroll={() => setFadeState(computeFadeState(scrollRef.current))}
        onWheel={handleHorizontalWheel}
        onClickCapture={handleHorizontalDragClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
