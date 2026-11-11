/** jsdom has no matchMedia. Pretend the screen is a laptop (min-width: 1024px) or not. */
export function stubLaptop(laptop = true, { reducedMotion = false } = {}) {
  window.matchMedia = ((q: string) => ({
    matches: q === '(min-width: 1024px)' ? laptop : q === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

export function unstubMedia() {
  // @ts-expect-error removing the stub
  delete window.matchMedia
}
