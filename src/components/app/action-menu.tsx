"use client";

import { useRef } from "react";
import type { ReactNode, MouseEvent } from "react";

/**
 * Wrapper de <details> que se fecha sozinho depois que uma ação dentro dele é
 * disparada. O <details>/<summary> nativo não fecha automaticamente quando um
 * formulário interno é enviado (inclusive Server Actions) — sem isso, o menu
 * fica "preso" aberto na tela depois de qualquer clique em uma ação.
 */
export function ActionMenu({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  function handleClick(e: MouseEvent<HTMLDetailsElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('button[type="submit"]')) {
      // Espera o próximo frame para não interromper o envio do formulário
      // que esse mesmo clique disparou.
      requestAnimationFrame(() => {
        ref.current?.removeAttribute("open");
      });
    }
  }

  return (
    <details ref={ref} className={className} onClick={handleClick}>
      {children}
    </details>
  );
}
