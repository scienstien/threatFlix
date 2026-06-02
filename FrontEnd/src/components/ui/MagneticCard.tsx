// ---------------------------------------------------------------------------
// ThreatFlix — MagneticCard
// 3D tilt effect wrapper using GSAP quickTo for buttery-smooth interaction.
// ---------------------------------------------------------------------------

import { useRef, type ReactNode, type CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface MagneticCardProps {
  className?: string;
  children: ReactNode;
  intensity?: number;
  style?: CSSProperties;
}

export function MagneticCard({
  className = "",
  children,
  intensity = 1,
  style,
}: MagneticCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);

  // Store quickTo setters in a ref so they persist across renders
  const quickRef = useRef<{
    rotateX: ReturnType<typeof gsap.quickTo> | null;
    rotateY: ReturnType<typeof gsap.quickTo> | null;
    lightX: ReturnType<typeof gsap.quickTo> | null;
    lightY: ReturnType<typeof gsap.quickTo> | null;
  }>({ rotateX: null, rotateY: null, lightX: null, lightY: null });

  useGSAP(() => {
    if (!cardRef.current || !lightRef.current) return;

    // Set initial transforms
    gsap.set(cardRef.current, {
      rotateX: 0,
      rotateY: 0,
      transformPerspective: 1200,
    });

    // Create quickTo setters for 60fps smoothness
    quickRef.current.rotateX = gsap.quickTo(cardRef.current, "rotateX", {
      duration: 0.4,
      ease: "power2.out",
    });
    quickRef.current.rotateY = gsap.quickTo(cardRef.current, "rotateY", {
      duration: 0.4,
      ease: "power2.out",
    });
    quickRef.current.lightX = gsap.quickTo(lightRef.current, "left", {
      duration: 0.3,
      ease: "power2.out",
    });
    quickRef.current.lightY = gsap.quickTo(lightRef.current, "top", {
      duration: 0.3,
      ease: "power2.out",
    });
  }, { scope: wrapperRef });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalize offset to -1..1
    const normalX = (e.clientX - centerX) / (rect.width / 2);
    const normalY = (e.clientY - centerY) / (rect.height / 2);

    // Map to rotation (Y-axis rotates on horizontal movement, X-axis on vertical)
    const maxRotateY = 8 * intensity;
    const maxRotateX = 5 * intensity;

    quickRef.current.rotateY?.(normalX * maxRotateY);
    quickRef.current.rotateX?.(-normalY * maxRotateX);

    // Move the light spot to follow cursor within the card
    const lightX = ((e.clientX - rect.left) / rect.width) * 100;
    const lightY = ((e.clientY - rect.top) / rect.height) * 100;
    quickRef.current.lightX?.(lightX + "%");
    quickRef.current.lightY?.(lightY + "%");
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;

    gsap.to(card, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.5,
      ease: "power2.out",
    });

    if (lightRef.current) {
      gsap.to(lightRef.current, {
        opacity: 0,
        duration: 0.3,
      });
    }
  };

  const handleMouseEnter = () => {
    if (lightRef.current) {
      gsap.to(lightRef.current, {
        opacity: 1,
        duration: 0.3,
      });
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        perspective: "1200px",
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      <div
        ref={cardRef}
        style={{
          transformStyle: "preserve-3d",
          willChange: "transform",
          position: "relative",
        }}
      >
        {/* Inner light spot that follows cursor */}
        <div
          ref={lightRef}
          style={{
            position: "absolute",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,179,71,0.12) 0%, transparent 70%)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            opacity: 0,
            zIndex: 1,
          }}
        />
        {children}
      </div>
    </div>
  );
}
