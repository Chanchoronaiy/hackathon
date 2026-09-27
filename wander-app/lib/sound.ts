"use client";

const clips = new Map<string, HTMLAudioElement>();

function play(src: string) {
  if (typeof window === "undefined") return;
  let clip = clips.get(src);
  if (!clip) {
    clip = new Audio(src);
    clips.set(src, clip);
  }
  clip.currentTime = 0;
  void clip.play().catch(() => undefined);
}

export function playClick() {
  play("/sounds/bubble-click.wav");
}

export function playWalkStart() {
  play("/sounds/walk-start.wav");
}

export function playPartyHorn() {
  play("/sounds/party-horn.mp3");
}

let rulerLoop: HTMLAudioElement | null = null;

export function startRulerScrollSound() {
  if (typeof window === "undefined") return;
  if (!rulerLoop) {
    rulerLoop = new Audio("/sounds/ruler-scroll.mp3");
    rulerLoop.loop = true;
  }
  if (!rulerLoop.paused) return;
  void rulerLoop.play().catch(() => undefined);
}

export function stopRulerScrollSound() {
  if (!rulerLoop || rulerLoop.paused) return;
  rulerLoop.pause();
}
