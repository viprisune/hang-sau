import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { CONFIG } from './config';
import { createCaveGame } from './game/createGame';
import { STRINGS } from './strings';

function PhaserCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Guard against duplicate instances under React StrictMode
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    container.innerHTML = '';

    const game = createCaveGame(container);
    gameRef.current = game;

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${CONFIG.VIEWPORT_WIDTH}px`,
        height: `${CONFIG.VIEWPORT_HEIGHT}px`,
      }}
      className="relative overflow-hidden rounded-lg border border-stone-800 bg-stone-950 shadow-2xl"
    />
  );
}

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <main className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 select-none">
      {!started ? (
        <section className="w-full max-w-md rounded-xl border border-stone-800 bg-stone-900/90 p-8 text-center shadow-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-amber-400">
            {STRINGS.GAME_TITLE}
          </h1>
          <p className="mt-2 text-sm text-stone-400">
            {STRINGS.GAME_SUBTITLE}
          </p>

          <div className="mt-6 rounded-lg border border-stone-800/80 bg-stone-950/60 p-4 text-left text-xs text-stone-300 space-y-2">
            <p className="font-semibold text-stone-200">
              {STRINGS.CONTROLS_HEADING}
            </p>
            <p>{STRINGS.CONTROL_MOVE}</p>
            <p>{STRINGS.CONTROL_RUN}</p>
            <p>{STRINGS.CONTROL_DEBUG}</p>
          </div>

          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-8 w-full cursor-pointer rounded-lg bg-amber-500 px-6 py-3 text-base font-semibold text-stone-950 transition-colors duration-150 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 whitespace-nowrap"
          >
            {STRINGS.START_BUTTON}
          </button>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3">
          <PhaserCanvas />
          <div className="flex items-center gap-4 text-xs text-stone-400">
            <span>{STRINGS.CONTROL_MOVE}</span>
            <span aria-hidden="true">·</span>
            <span>{STRINGS.CONTROL_RUN}</span>
            <span aria-hidden="true">·</span>
            <span>{STRINGS.CONTROL_DEBUG}</span>
          </div>
        </section>
      )}
    </main>
  );
}
