// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const FALLBACK_TEXT = "Welcome to VOFMUN ONE";

export default function TypeWriter() {
  const [text, setText] = useState(FALLBACK_TEXT);
  const [blinker, setBlinker] = useState("|");
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausingAfterTyping' | 'deleting' | 'pausingAfterDeleting'>("typing");
  const [charIndex, setCharIndex] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);

  const words = useMemo<string[]>(() => [
    FALLBACK_TEXT,
    "Your one stop hub for collaboration",
    "Your one stop hub for innovation",
    "Your one stop hub for inspiration",
    "Your one stop hub for interaction",
    "Your one stop hub for ideas",
    "Your one stop hub for all information",
    "Your one stop hub for news",
    "Are you still reading this?",
  ], []);

  const returnIndex = useCallback((index: number) => index % words.length, [words.length]);

  // Keep meaningful text in the server-rendered page, then restart the
  // animation only after React has attached its client event handlers.
  useEffect(() => {
    setText("");
    setCount(0);
    setPhase("typing");
    setCharIndex(0);
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || phase === "typing") {
      setBlinker("|");
      return;
    }

    const interval = window.setInterval(() => {
      setBlinker((previous) => previous === "|" ? "\u00A0" : "|");
    }, 400);
    return () => window.clearInterval(interval);
  }, [hasMounted, phase]);

  useEffect(() => {
    if (!hasMounted) return;

    const currentWord = words[count];
    const nextWord = words[returnIndex(count + 1)];
    let shared = 0;
    while (
      shared < currentWord.length &&
      shared < nextWord.length &&
      currentWord[shared] === nextWord[shared]
    ) {
      shared += 1;
    }

    let timeout: number;
    if (phase === "typing") {
      if (charIndex < currentWord.length) {
        timeout = window.setTimeout(() => {
setText(currentWord.slice(0, charIndex + 1));
setCharIndex((index) => index + 1);
        }, 80);
      } else {
        timeout = window.setTimeout(() => setPhase("pausingAfterTyping"), 800);
      }
    } else if (phase === "pausingAfterTyping") {
      timeout = window.setTimeout(() => {
        setPhase("deleting");
        setCharIndex(currentWord.length);
      }, 100);
    } else if (phase === "deleting") {
      if (charIndex > shared) {
        timeout = window.setTimeout(() => {
setText(currentWord.slice(0, charIndex - 1));
setCharIndex((index) => index - 1);
        }, 60);
      } else {
        timeout = window.setTimeout(() => setPhase("pausingAfterDeleting"), 600);
      }
    } else {
      timeout = window.setTimeout(() => {
        setCount(returnIndex(count + 1));
        setPhase("typing");
        setCharIndex(shared);
        setText(nextWord.slice(0, shared));
      }, 100);
    }

    return () => window.clearTimeout(timeout);
  }, [charIndex, count, hasMounted, phase, returnIndex, words]);

  return (
    <div className="flex min-h-[3.5rem] items-center justify-center" aria-live="polite">
      <h1 className="text-center text-4xl font-heading font-black leading-tight text-deep-red" style={{ color: "#701e1e" }}>
        {text}
        <span className="ml-1 inline-block w-[0.5ch] align-middle text-deep-red" aria-hidden="true">{blinker}</span>
      </h1>
    </div>
  );
}
