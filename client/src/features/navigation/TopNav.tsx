import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import type { RoleRoute } from "../../shared/types";

export function TopNav({ activeRoute: _activeRoute }: { activeRoute: RoleRoute }) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const hideThreshold = window.innerHeight * 0.2;
      const scrollingDown = currentScrollY > lastScrollY.current;

      setHidden(scrollingDown && currentScrollY > hideThreshold);
      lastScrollY.current = currentScrollY;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`top-nav top-nav-logo-only ${hidden ? "top-nav-hidden" : ""}`}>
      <a className="brand nav-brand" href="#hero">
        <BrandLogo showText size={32} />
      </a>
    </header>
  );
}
