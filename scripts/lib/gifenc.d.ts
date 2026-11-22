// Types for gifenc (MIT), which ships none: only the parts scripts/record-demo.ts uses.
declare module 'gifenc' {
  export type Palette = number[][];
  export function quantize(rgba: Uint8Array, maxColors: number): Palette;
  export function applyPalette(rgba: Uint8Array, palette: Palette): Uint8Array;
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; delay?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): Encoder;
  const gifenc: { quantize: typeof quantize; applyPalette: typeof applyPalette; GIFEncoder: typeof GIFEncoder };
  export default gifenc;
}
