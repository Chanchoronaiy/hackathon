"use client";

const CLICK_GAIN = 3;
const RULER_GAIN = 3;

const clips = new Map<string, HTMLAudioElement>();
let context: AudioContext | null = null;

// HTMLAudioElement volume caps at 1, so louder clips go through a gain node instead.
function amplify(clip: HTMLAudioElement, gainValue: number) {
  try {
    context ??= new AudioContext();
    const gain = context.createGain();
    gain.gain.value = gainValue;
    context.createMediaElementSource(clip).connect(gain).connect(context.destination);
  } catch {
    // Fall back to the element's own output.
  }
}

function resumeContext() {
  if (context?.state === "suspended") void context.resume().catch(() => undefined);
}

function play(src: string, gainValue = 1) {
  if (typeof window === "undefined") return;
  let clip = clips.get(src);
  if (!clip) {
    clip = new Audio(src);
    if (gainValue !== 1) amplify(clip, gainValue);
    clips.set(src, clip);
  }
  resumeContext();
  clip.currentTime = 0;
  void clip.play().catch(() => undefined);
}

export function playClick() {
  play("/sounds/bubble-click.wav", CLICK_GAIN);
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
    amplify(rulerLoop, RULER_GAIN);
  }
  resumeContext();
  if (!rulerLoop.paused) return;
  void rulerLoop.play().catch(() => undefined);
}

export function stopRulerScrollSound() {
  if (!rulerLoop || rulerLoop.paused) return;
  rulerLoop.pause();
}
