export function getFsmVariableNames(stateBits: number, inputBits: number, outputBits: number) {
  return {
    inputs: [
      ...Array.from({ length: stateBits }, (_, i) => `Z_{${stateBits - 1 - i}}`),
      ...Array.from({ length: inputBits }, (_, i) => `X_{${inputBits - 1 - i}}`),
    ],
    outputs: [
      ...Array.from({ length: stateBits }, (_, i) => `Z_{${stateBits - 1 - i}}^{+}`),
      ...Array.from({ length: outputBits }, (_, i) => `Y_{${outputBits - 1 - i}}`),
    ],
  }
}
