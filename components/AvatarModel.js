"use client";
import { useEffect, useRef, useState } from "react";
import { avatarImage } from "@/lib/avatar";
export default function AvatarModel({ avatar, view = "body" }) {
  const canvas = useRef(null),
    stage = useRef(null),
    latest = useRef({ avatar, view });
  latest.current = { avatar, view };
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let active = true,
      cleanup;
    async function mount() {
      try {
        const { createAvatarStage } = await import("@/lib/avatar-stage");
        if (!active) return;
        const el = canvas.current,
          scene = createAvatarStage(el);
        stage.current = scene;
        scene.setAvatar(latest.current.avatar);
        scene.setView(latest.current.view);
        const resize = () => {
          const r = el.getBoundingClientRect();
          scene.resize(r.width, r.height);
          scene.render();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(el);
        resize();
        setStatus("ready");
        let down = null,
          frame,
          last = 0;
        const start = (e) => {
          down = e.clientX;
          el.setPointerCapture(e.pointerId);
        };
        const move = (e) => {
          if (down === null) return;
          scene.setYaw(scene.getYaw() + (e.clientX - down) * 0.012);
          down = e.clientX;
          scene.render();
        };
        const end = () => {
          down = null;
        };
        const key = (e) => {
          if (["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
            e.preventDefault();
            scene.setYaw(
              e.key === "Home"
                ? 0.13
                : scene.getYaw() + (e.key === "ArrowLeft" ? -0.18 : 0.18),
            );
            scene.render();
          }
        };
        el.addEventListener("pointerdown", start);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
        el.addEventListener("keydown", key);
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        const draw = (t) => {
          if (!active) return;
          if (!document.hidden && !reduced.matches && t - last > 42) {
            scene.render(t / 1000, true);
            last = t;
          }
          frame = requestAnimationFrame(draw);
        };
        if (!reduced.matches) frame = requestAnimationFrame(draw);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          el.removeEventListener("pointerdown", start);
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", end);
          el.removeEventListener("pointercancel", end);
          el.removeEventListener("keydown", key);
          scene.dispose();
          stage.current = null;
        };
      } catch {
        if (active) setStatus("fallback");
      }
    }
    mount();
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    if (stage.current) {
      stage.current.setAvatar(avatar);
      stage.current.render();
    }
  }, [avatar]);
  useEffect(() => {
    if (stage.current) {
      stage.current.setView(view);
      stage.current.render();
    }
  }, [view]);
  return (
    <>
      {status !== "fallback" && (
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label="3D avatar. Drag or use left and right arrow keys to rotate. Home resets the angle."
          style={{
            width: "100%",
            height: "100%",
            touchAction: "none",
            cursor: "grab",
          }}
        />
      )}
      {status === "fallback" && (
        <img
          src={avatarImage(avatar, true)}
          alt="Full body avatar illustration"
        />
      )}
      {status === "loading" && (
        <span className="avatar-loading" role="status">
          Opening your dressing room…
        </span>
      )}
      {status === "fallback" && (
        <span className="avatar-render-notice">
          3D is unavailable on this device. Your avatar is still editable.
        </span>
      )}
    </>
  );
}
