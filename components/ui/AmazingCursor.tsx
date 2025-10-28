import { useCallback, useEffect, useState } from "react";

type CursorKind = "default" | "clickable" | "text";

const INTERACTIVE_TARGETS = [
  "a",
  "button",
  '[role="button"]',
  '[data-super-cursor="interactive"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  "select",
  "summary",
  ".cursor-pointer",
];

const TEXT_TARGETS = [
  "input",
  "textarea",
  '[contenteditable="true"]',
  '[data-super-cursor="text"]',
  ".cursor-text",
];

const CLICKABLE_SELECTOR = INTERACTIVE_TARGETS.join(", ");
const TEXT_SELECTOR = TEXT_TARGETS.join(", ");
const STYLE_TAG_ID = "amazing-cursor-style";

const BIBATA_DEFAULT_POINTER =
  "data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 256 256' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M201.163 133.54L201.149 133.528L201.134 133.515L91.6855 36.4935C86.5144 31.7659 81.4269 27.9549 76.5421 25.525C71.7671 23.1497 66.0861 21.5569 60.4133 23.1213C54.3118 24.8039 50.4875 29.4674 48.3639 34.759C46.3122 39.8715 45.4999 46.2787 45.4999 53.5383L45.4999 200.431V200.493L45.5008 200.555C45.6218 208.862 50.4279 217.843 55.9963 223.894C58.8934 227.043 62.5163 229.986 66.6704 231.742C70.9172 233.537 76.217 234.254 81.4691 231.884C85.7536 229.951 89.6754 226.055 92.8565 222.651C94.6841 220.695 96.8336 218.252 99.0355 215.749C100.71 213.847 102.414 211.91 104.03 210.126C112.189 201.122 121.346 192.286 132.161 187.407C143.013 182.511 155.809 181.375 167.963 181.146C170.959 181.089 173.85 181.087 176.65 181.085H176.663H176.686C179.447 181.083 182.164 181.081 184.662 181.019C189.231 180.906 194.643 180.609 198.777 178.88C208.711 174.723 210.972 163.838 210.753 156.445C210.521 148.596 207.57 139.272 201.163 133.54Z' fill='white' stroke='black' stroke-width='17'/%3E%3C/svg%3E";

const BIBATA_DEFAULT_POINTER_ACTIVE = BIBATA_DEFAULT_POINTER;

const BIBATA_INTERACTIVE_POINTER = "/cursor/bibata-pointer.svg";

const BIBATA_INTERACTIVE_POINTER_ACTIVE = BIBATA_INTERACTIVE_POINTER;

const BIBATA_TEXT =
  "data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 256 256' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M128 32V224M80 48H176M80 208H176' stroke='white' stroke-width='24'/%3E%3Cpath d='M128 32V224M80 48H176M80 208H176' stroke='black' stroke-width='12'/%3E%3C/svg%3E";

const FALLBACK_SCOPE = "body:not(.super-cursor-active)";

const joinWithScope = (scope: string, selectors: string[]) =>
  selectors.map((selector) => `${scope} ${selector}`).join(",\n      ");

const INTERACTIVE_STYLE_SCOPE = joinWithScope(
  FALLBACK_SCOPE,
  INTERACTIVE_TARGETS
);
const INTERACTIVE_CHILD_SCOPE = joinWithScope(
  FALLBACK_SCOPE,
  INTERACTIVE_TARGETS.map((selector) => `${selector} *`)
);
const INTERACTIVE_ACTIVE_SCOPE = joinWithScope(
  FALLBACK_SCOPE,
  INTERACTIVE_TARGETS.map((selector) => `${selector}:active`)
);
const INTERACTIVE_PRESSED_CHILD_SCOPE = joinWithScope(
  FALLBACK_SCOPE,
  INTERACTIVE_TARGETS.map((selector) => `${selector}:active *`)
);
const INTERACTIVE_ARIA_PRESSED_SCOPE = joinWithScope(
  FALLBACK_SCOPE,
  INTERACTIVE_TARGETS.map((selector) => `${selector}[aria-pressed="true"]`)
);
const INTERACTIVE_ARIA_PRESSED_CHILD_SCOPE = joinWithScope(
  FALLBACK_SCOPE,
  INTERACTIVE_TARGETS.map(
    (selector) => `${selector}[aria-pressed="true"] *`
  )
);
const TEXT_STYLE_SCOPE = joinWithScope(FALLBACK_SCOPE, TEXT_TARGETS);
const TEXT_CHILD_SCOPE = joinWithScope(
  FALLBACK_SCOPE,
  TEXT_TARGETS.map((selector) => `${selector} *`)
);

const AmazingCursor = () => {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [kind, setKind] = useState<CursorKind>("default");
  const [isVisible, setIsVisible] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [pressedKind, setPressedKind] = useState<CursorKind | null>(null);

  const getKindForTarget = useCallback((node: EventTarget | null): CursorKind => {
    if (!node || !(node instanceof Element)) {
      return "default";
    }

    if (node.closest(TEXT_SELECTOR)) {
      return "text";
    }

    if (node.closest(CLICKABLE_SELECTOR)) {
      return "clickable";
    }

    return "default";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const media = window.matchMedia("(pointer: fine)");
    const update = () => setEnabled(media.matches);

    update();
    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const existing = document.getElementById(STYLE_TAG_ID);
    if (existing) {
      existing.remove();
    }

    const style = document.createElement("style");
    style.id = STYLE_TAG_ID;
    style.textContent = `
      ${FALLBACK_SCOPE},
      ${FALLBACK_SCOPE} * {
        cursor: url("${BIBATA_DEFAULT_POINTER}") 0 0, default !important;
      }

      ${INTERACTIVE_STYLE_SCOPE},
      ${INTERACTIVE_CHILD_SCOPE} {
        cursor: url("${BIBATA_INTERACTIVE_POINTER}") 0 0, pointer !important;
      }

      ${INTERACTIVE_ACTIVE_SCOPE},
      ${INTERACTIVE_PRESSED_CHILD_SCOPE},
      ${INTERACTIVE_ARIA_PRESSED_SCOPE},
      ${INTERACTIVE_ARIA_PRESSED_CHILD_SCOPE} {
        cursor: url("${BIBATA_INTERACTIVE_POINTER_ACTIVE}") 0 0, pointer !important;
      }

      ${TEXT_STYLE_SCOPE},
      ${TEXT_CHILD_SCOPE} {
        cursor: url("${BIBATA_TEXT}") 12 12, text !important;
      }
    `;

    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return undefined;
    }

    const body = document.body;
    body.classList.add("super-cursor-active");

    const handleMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY });
      setIsVisible(true);

      setKind(getKindForTarget(event.target));
    };

    const handleLeave = () => {
      setIsVisible(false);
      setIsPressed(false);
      setPressedKind(null);
    };

    const handleEnter = () => {
      setIsVisible(true);
    };

    const handleDown = (event: MouseEvent) => {
      if (event.button === 0) {
        const pressKind = getKindForTarget(event.target);
        setPressedKind(pressKind);
        setIsPressed(true);
      }
    };

    const handleUp = () => {
      setIsPressed(false);
      setPressedKind(null);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        setIsVisible(false);
        setIsPressed(false);
        setPressedKind(null);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);
    window.addEventListener("mouseenter", handleEnter);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      body.classList.remove("super-cursor-active");
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("mouseenter", handleEnter);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, getKindForTarget]);

  if (!enabled) {
    return null;
  }

  const isText = kind === "text";
  const isClickable = kind === "clickable";
  const isPressingClickable = isPressed && pressedKind === "clickable";
  const isPressingDefault = isPressed && pressedKind === "default";
  const sprite = isText
    ? BIBATA_TEXT
    : isPressingClickable
    ? BIBATA_INTERACTIVE_POINTER_ACTIVE
    : isClickable
    ? BIBATA_INTERACTIVE_POINTER
    : isPressingDefault
    ? BIBATA_DEFAULT_POINTER_ACTIVE
    : BIBATA_DEFAULT_POINTER;

  const showInteractive = isClickable || isPressingClickable;

  const offsetX = isText ? 12 : showInteractive ? 6 : 0;
  const offsetY = isText ? 12 : showInteractive ? (isPressingClickable ? 6 : 4) : 0;

  const scale = isText
    ? 1
    : isPressingClickable
    ? 0.96
    : showInteractive
    ? 1.04
    : isPressingDefault
    ? 0.94
    : 1;

  const dropShadow = isText
    ? "drop-shadow(0 1px 1px rgba(0,0,0,0.45))"
    : isPressingClickable
    ? "drop-shadow(0 3px 4px rgba(0,0,0,0.55))"
    : showInteractive
    ? "drop-shadow(0 2px 4px rgba(0,0,0,0.48))"
    : isPressed
    ? "drop-shadow(0 3px 3px rgba(0,0,0,0.5))"
    : "drop-shadow(0 2px 3px rgba(0,0,0,0.45))";

  const width = 32;
  const height = showInteractive ? 48 : 32;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 120ms ease-out",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate3d(${position.x - offsetX}px, ${
            position.y - offsetY
          }px, 0) scale(${scale})`,
          transformOrigin: "top left",
          transition: "transform 90ms ease-out",
        }}
      >
        <img
          alt=""
          src={sprite}
          width={width}
          height={height}
          style={{
            display: "block",
            filter: dropShadow,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </span>
    </div>
  );
};

export default AmazingCursor;
