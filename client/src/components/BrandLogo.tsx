import type { CSSProperties } from "react";

type BrandLogoProps = {
  size?: number;
  showText?: boolean;
  compact?: boolean;
};

export function BrandLogo({ size = 36, showText = false, compact = false }: BrandLogoProps) {
  return (
    <span
      className={`brand-logo ${compact ? "brand-logo-compact" : ""}`}
      style={{ "--brand-logo-size": `${size}px` } as CSSProperties}
    >
      <span className="brand-logo-mark" aria-hidden="true">
        <img alt="" className="brand-logo-image" src="/deliverhub-logo.png" />
      </span>
      {showText && (
        <span className="brand-logo-text">
          <strong>
            <span>Deliver</span>
            <em>Hub</em>
          </strong>
        </span>
      )}
    </span>
  );
}
