// ---------------------------------------------------------------------------
// ThreatFlix — EmberParticleField
// Floating ember particles background with mouse-driven parallax.
// ---------------------------------------------------------------------------

import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const PARTICLE_COUNT = 40;

const EMBER_COLORS = [
  "#ff6b35", // --ember-hot
  "#e8943a", // --ember-warm
  "#ff8c4a",
  "#f07830",
  "#ffb347", // --ember-glow
  "#d4783a",
];

interface Particle {
  el: HTMLDivElement;
  size: number;
}

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomColor(): string {
  return EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)];
}

function animateParticle(p: Particle, containerHeight: number) {
  const duration = randomRange(4, 8);
  const startX = randomRange(0, 100);
  const startY = randomRange(70, 100); // bottom 30%
  const drift = randomRange(-30, 30);

  gsap.set(p.el, {
    left: startX + "%",
    top: startY + "%",
    opacity: 0,
    scale: randomRange(0.6, 1),
    backgroundColor: randomColor(),
  });

  gsap.to(p.el, {
    y: -(containerHeight + 50),
    x: drift,
    opacity: 0,
    duration,
    ease: "none",
    onStart: () => {
      gsap.to(p.el, {
        opacity: randomRange(0.3, 0.7),
        duration: duration * 0.15,
        ease: "power1.in",
      });
      gsap.to(p.el, {
        opacity: 0,
        duration: duration * 0.3,
        delay: duration * 0.65,
        ease: "power1.out",
      });
    },
    onComplete: () => {
      animateParticle(p, containerHeight);
    },
  });
}

export function EmberParticleField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const quickXRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
  const quickYRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) return;

      // Create particle elements
      const particles: Particle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const el = document.createElement("div");
        const size = randomRange(2, 6);
        el.style.position = "absolute";
        el.style.width = size + "px";
        el.style.height = size + "px";
        el.style.borderRadius = "50%";
        el.style.pointerEvents = "none";
        el.style.willChange = "transform, opacity";
        container.appendChild(el);
        particles.push({ el, size });
      }
      particlesRef.current = particles;

      // Start animations with random initial delays
      const h = container.clientHeight || window.innerHeight;
      particles.forEach((p, i) => {
        gsap.delayedCall(randomRange(0, 4), () => {
          animateParticle(p, h);
        });
      });

      // Parallax quickTo for the container
      quickXRef.current = gsap.quickTo(container, "x", {
        duration: 0.8,
        ease: "power2.out",
      });
      quickYRef.current = gsap.quickTo(container, "y", {
        duration: 0.8,
        ease: "power2.out",
      });

      return () => {
        // Cleanup: remove particle elements
        particles.forEach((p) => {
          if (p.el.parentNode) {
            p.el.parentNode.removeChild(p.el);
          }
        });
      };
    },
    { scope: containerRef }
  );

  // Mouse parallax handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const normalX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const normalY = (e.clientY / window.innerHeight - 0.5) * 2;

      quickXRef.current?.(normalX * 15);
      quickYRef.current?.(normalY * 15);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
      aria-hidden="true"
    />
  );
}
