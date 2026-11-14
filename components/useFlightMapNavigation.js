"use client";
import { useEffect, useRef } from "react";

// Match JungleGame's map gestures while keeping travel in charge of the camera.
export default function useFlightMapNavigation(viewport, blocked) {
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const drag = useRef(null);
  const hold = useRef({ frame: null, direction: 0, moved: false });
  function stopHold() {
    hold.current.direction = 0;
    cancelAnimationFrame(hold.current.frame);
  }
  function endDrag() {
    const el = viewport.current;
    if (drag.current && el?.hasPointerCapture(drag.current.id))
      el.releasePointerCapture(drag.current.id);
    drag.current = null;
    el?.classList.remove("is-dragging");
  }
  function stop() {
    stopHold();
    endDrag();
  }
  function pan(direction) {
    if (blockedRef.current) return;
    viewport.current?.scrollBy({
      left: direction * 580,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function startHold(event, direction) {
    if (event.button !== 0 || blockedRef.current) return;
    stopHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    hold.current = {
      frame: null,
      direction,
      moved: false,
      started: performance.now(),
      previous: performance.now(),
    };
    const tick = (time) => {
      const state = hold.current;
      if (!state.direction || blockedRef.current) {
        stopHold();
        return;
      }
      if (time - state.started > 280) {
        viewport.current?.scrollBy({
          left: state.direction * Math.min(time - state.previous, 40) * 0.65,
          behavior: "instant",
        });
        state.moved = true;
      }
      state.previous = time;
      state.frame = requestAnimationFrame(tick);
    };
    hold.current.frame = requestAnimationFrame(tick);
  }
  useEffect(() => {
    const el = viewport.current;
    function wheel(event) {
      if (
        blockedRef.current ||
        event.ctrlKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? el.clientWidth
            : 1);
      if (
        (delta < 0 && el.scrollLeft > 0) ||
        (delta > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth)
      ) {
        event.preventDefault();
        el.scrollLeft += delta;
      }
    }
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheel);
      stop();
    };
  }, []);
  useEffect(() => {
    if (blocked) stop();
  }, [blocked]);
  return {
    stop,
    arrowProps: (direction) => ({
      onPointerDown: (event) => startHold(event, direction),
      onPointerUp: stopHold,
      onPointerCancel: stopHold,
      onLostPointerCapture: stopHold,
      onBlur: stopHold,
      onClick: (event) => {
        if (event.detail === 0 || !hold.current.moved) pan(direction);
        hold.current.moved = false;
      },
    }),
    viewportProps: {
      onKeyDown: (event) => {
        if (blockedRef.current || event.target !== event.currentTarget) return;
        if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          pan(event.key === "ArrowLeft" ? -1 : 1);
        }
        if (["Home", "End"].includes(event.key)) {
          event.preventDefault();
          event.currentTarget.scrollTo({
            left: event.key === "Home" ? 0 : event.currentTarget.scrollWidth,
          });
        }
      },
      onPointerDown: (event) => {
        if (
          blockedRef.current ||
          event.pointerType !== "mouse" ||
          event.button !== 0 ||
          event.target.closest("button,a,input,textarea,select")
        )
          return;
        drag.current = {
          x: event.clientX,
          left: event.currentTarget.scrollLeft,
          id: event.pointerId,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add("is-dragging");
      },
      onPointerMove: (event) => {
        if (drag.current && !blockedRef.current)
          event.currentTarget.scrollLeft =
            drag.current.left + drag.current.x - event.clientX;
      },
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
    },
  };
}
