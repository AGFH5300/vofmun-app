// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import { useEffect, useState } from 'react';

const FALLBACK_TEXT = 'Welcome to VOFMUN ONE';
const WORDS = [
  FALLBACK_TEXT,
  'Your one stop hub for collaboration',
  'Your one stop hub for innovation',
  'Your one stop hub for inspiration',
  'Your one stop hub for interaction',
  'Your one stop hub for ideas',
  'Your one stop hub for all information',
  'Your one stop hub for news',
  'Are you still reading this?',
] as const;

const sharedPrefixLength = (left: string, right: string) => {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return index;
};

export default function TypeWriter() {
  const [text, setText] = useState(FALLBACK_TEXT);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let wordIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    const schedule = (callback: () => void, delay: number) => {
      timer = window.setTimeout(() => {
        if (!cancelled) callback();
      }, delay);
    };

    const tick = () => {
      const currentWord = WORDS[wordIndex];
      const nextWordIndex = (wordIndex + 1) % WORDS.length;
      const nextWord = WORDS[nextWordIndex];
      const sharedLength = sharedPrefixLength(currentWord, nextWord);

      if (!deleting) {
        if (characterIndex < currentWord.length) {
          characterIndex += 1;
          setText(currentWord.slice(0, characterIndex));
          schedule(tick, 80);
          return;
        }

        deleting = true;
        schedule(tick, 900);
        return;
      }

      if (characterIndex > sharedLength) {
        characterIndex -= 1;
        setText(currentWord.slice(0, characterIndex));
        schedule(tick, 55);
        return;
      }

      wordIndex = nextWordIndex;
      deleting = false;
      characterIndex = sharedLength;
      setText(nextWord.slice(0, sharedLength));
      schedule(tick, 180);
    };

    // Preserve useful server-rendered text, then begin the animation only after
    // hydration. Every pending callback is cancelled during unmount or refresh.
    schedule(() => {
      setText('');
      tick();
    }, 250);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="flex min-h-[3.5rem] items-center justify-center">
      <h1
        className="text-center text-4xl font-heading font-black leading-tight text-deep-red"
        style={{ color: '#701e1e' }}
      >
        {text}
        <span
          className="ml-1 inline-block w-[0.5ch] animate-pulse align-middle text-deep-red"
          aria-hidden="true"
        >
          |
        </span>
      </h1>
    </div>
  );
}
