/**
 * Logo oficial do Grupo Trivion, vetorizado a partir do manual de marca
 * (Brand Design — Grupo Trivion).
 *
 * O símbolo é a "pedra angular": três pilares independentes que se unem em um
 * alicerce completo. O wordmark usa as letras originais em Mugen Grotesk
 * convertidas em contornos, então não depende de nenhuma fonte instalada.
 *
 * Todas as peças pintam com `currentColor` — quem usa define a cor pelo
 * `className` (ex.: `text-brand` no escuro, `text-navy` no claro).
 */

const SYMBOL_PATH =
  "M 19.797 11.051 L 11.184 15.309 L 11.609 15.52 L 19.797 19.566 L 19.797 49.66 L 11.609 45.617 L 11.609 26.57 L 0 20.836 L 0 9.781 L 19.797 0 Z M 21.793 49.66 L 29.98 45.617 L 29.98 26.57 L 41.59 20.836 L 41.59 9.781 L 21.793 19.566 Z M 21.793 11.051 L 28.41 14.332 L 39.594 8.805 L 21.793 0 Z M 21.793 11.051";

const WORDMARK_PATH =
  "M 9.716 14.922 L 7.821 14.922 L 7.821 1.922 L -0.003 1.922 L -0.003 0 L 17.54 0 L 17.54 1.922 L 9.716 1.922 Z M 22.462 14.922 L 20.544 14.922 L 20.544 7.293 L 33.462 7.293 C 34.528 7.293 35.282 7.094 35.724 6.695 C 36.161 6.297 36.384 5.742 36.384 5.031 L 36.384 4.352 C 36.384 3.641 36.161 3.059 35.724 2.602 C 35.282 2.149 34.521 1.922 33.442 1.922 L 20.544 1.922 L 20.544 0 L 33.696 0 C 35.317 0 36.489 0.352 37.216 1.047 C 37.939 1.742 38.302 2.746 38.302 4.051 L 38.302 5.223 C 38.302 6.559 37.939 7.555 37.216 8.207 C 36.548 8.82 35.423 9.153 33.845 9.211 L 38.005 14.922 L 35.681 14.922 L 31.525 9.211 L 22.462 9.211 Z M 43.228 14.922 L 41.306 14.922 L 41.306 0 L 43.228 0 Z M 55.271 14.922 L 46.208 0 L 48.47 0 L 56.38 12.985 L 64.306 0 L 66.525 0 L 57.485 14.922 Z M 71.427 14.922 L 69.509 14.922 L 69.509 0 L 71.427 0 Z M 88.095 12.918 C 89.29 12.918 90.099 12.653 90.525 12.121 C 90.954 11.586 91.165 10.914 91.165 10.106 L 91.165 4.778 C 91.165 3.981 90.962 3.32 90.548 2.793 C 90.138 2.27 89.325 2.004 88.118 2.004 L 79.442 2.004 C 78.204 2.004 77.376 2.278 76.958 2.817 C 76.54 3.356 76.329 4.039 76.329 4.863 L 76.329 10.129 C 76.329 10.938 76.544 11.606 76.97 12.129 C 77.396 12.656 78.204 12.918 79.4 12.918 Z M 78.696 14.922 C 77.317 14.922 76.259 14.551 75.521 13.805 C 74.782 13.059 74.411 11.996 74.411 10.617 L 74.411 4.309 C 74.411 2.93 74.782 1.867 75.521 1.121 C 76.259 0.375 77.317 0 78.696 0 L 88.778 0 C 90.157 0 91.22 0.375 91.966 1.121 C 92.712 1.867 93.083 2.93 93.083 4.309 L 93.083 10.617 C 93.083 11.996 92.712 13.059 91.966 13.805 C 91.22 14.551 90.157 14.922 88.778 14.922 Z M 96.091 0 L 98.435 0 L 112.716 12.664 L 112.716 0 L 114.614 0 L 114.614 14.922 L 112.376 14.922 L 98.009 2.176 L 98.009 14.922 L 96.091 14.922 Z M 96.091 0";

export function TrivionSymbol({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 41.59 49.66"
      width={size * (41.59 / 49.66)}
      height={size}
      className={className}
      role="img"
      aria-label="Trivion"
    >
      <path fill="currentColor" fillRule="evenodd" d={SYMBOL_PATH} />
    </svg>
  );
}

export function TrivionWordmark({ className = "", width = 110 }: { className?: string; width?: number }) {
  return (
    <svg
      viewBox="0 0 114.614 14.922"
      width={width}
      height={width * (14.922 / 114.614)}
      className={className}
      role="img"
      aria-label="TRIVION"
    >
      <path fill="currentColor" fillRule="evenodd" d={WORDMARK_PATH} />
    </svg>
  );
}

/**
 * Lockup horizontal (símbolo | TRIVION + descritor), como nas "Formas de uso"
 * do manual. Usado no menu lateral e na tela de login.
 */
export function TrivionLockup({
  descriptor = "Self Booking",
  symbolClassName = "text-brand",
  wordmarkClassName = "text-white",
  descriptorClassName = "text-[var(--sidebar-fg)]",
  size = 34,
}: {
  descriptor?: string;
  symbolClassName?: string;
  wordmarkClassName?: string;
  descriptorClassName?: string;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <TrivionSymbol size={size} className={symbolClassName} />
      <span aria-hidden className="w-px self-stretch bg-current opacity-20" />
      <div className="flex flex-col gap-1">
        <TrivionWordmark width={size * 2.6} className={wordmarkClassName} />
        {descriptor && (
          <span className={`brand-eyebrow text-[9px] leading-none ${descriptorClassName}`}>
            {descriptor}
          </span>
        )}
      </div>
    </div>
  );
}
