import type { FsmSpec } from './fixtures'

// Foto 4: A -0/00-> B, A -1/11-> C, B -0/00-> B, B -1/11-> A, C -0/00-> B, C -1/11-> A
export const M2: FsmSpec = {
  model: 'mealy',
  inputBits: 1,
  outputBits: 2,
  stateCount: 3,
  edges: [
    [0, 1, '0', '00'],
    [0, 2, '1', '11'],
    [1, 1, '0', '00'],
    [1, 0, '1', '11'],
    [2, 1, '0', '00'],
    [2, 0, '1', '11'],
  ],
}
export const M2_SNAPSHOT = [
  'q0|0->q1/00',
  'q0|1->q2/11',
  'q1|0->q1/00',
  'q1|1->q0/11',
  'q2|0->q1/00',
  'q2|1->q0/11',
]

// Foto 2 (Abb. 1.1): four states, input x, output y1y0
export const M1: FsmSpec = {
  model: 'mealy',
  inputBits: 1,
  outputBits: 2,
  stateCount: 4,
  edges: [
    [0, 1, '0', '00'],
    [0, 2, '1', '11'],
    [1, 0, '0', '00'],
    [1, 2, '1', '01'],
    [2, 0, '0', '10'],
    [2, 3, '1', '11'],
    [3, 0, '0', '11'],
    [3, 1, '1', '11'],
  ],
}
export const M1_SNAPSHOT = [
  'q0|0->q1/00',
  'q0|1->q2/11',
  'q1|0->q0/00',
  'q1|1->q2/01',
  'q2|0->q0/10',
  'q2|1->q3/11',
  'q3|0->q0/11',
  'q3|1->q1/11',
]

// Foto 1: Moore machine, two inputs, two outputs, one don't-care next state
export const M3: FsmSpec = {
  model: 'moore',
  inputBits: 2,
  outputBits: 2,
  stateCount: 4,
  mooreOutputs: ['01', '10', '11', '00'],
  edges: [
    [0, 2, '00'],
    [0, 2, '01'],
    [0, 1, '10'],
    [0, 0, '11'],
    [1, 3, '00'],
    [1, 3, '01'],
    [1, 0, '10'],
    [1, 1, '11'],
    [2, 3, '00'],
    [2, 3, '01'],
    [2, 0, '10'],
    [2, 2, '11'],
    [3, 2, '00'],
    [3, 2, '01'],
    [3, 1, '10'],
    // (q3, input 11) stays the all don't-care row, exactly like the "xx" in the sheet
  ],
}

export const M3_SNAPSHOT = [
  'q0|00->q2/-',
  'q0|01->q2/-',
  'q0|10->q1/-',
  'q0|11->q0/-',
  'q1|00->q3/-',
  'q1|01->q3/-',
  'q1|10->q0/-',
  'q1|11->q1/-',
  'q2|00->q3/-',
  'q2|01->q3/-',
  'q2|10->q0/-',
  'q2|11->q2/-',
  'q3|00->q2/-',
  'q3|01->q2/-',
  'q3|10->q1/-',
  'q3|11->pattern:xx/-',
]

// Extra FSM with six states, two inputs and partial patterns
export const M4: FsmSpec = {
  model: 'mealy',
  inputBits: 2,
  outputBits: 2,
  stateCount: 6,
  edges: [
    [0, 5, '00', '01'],
    [0, 1, '01', '10'],
    [0, '00x', '10', '11'],
    [0, 2, '11', '00'],
    [1, '10x', '00', '11'],
    [1, 0, '01', '00'],
    [1, 3, '10', '01'],
    [1, 1, '11', '10'],
    [2, 4, '00', '00'],
    [2, '0x1', '01', '11'],
    [2, 0, '10', '01'],
    [2, 5, '11', '10'],
    [3, 1, '00', '10'],
    [3, 2, '01', '11'],
    [3, 3, '10', '00'],
    [3, 4, '11', '01'],
    [4, 0, '00', '11'],
    [4, 5, '01', '00'],
    [4, 2, '10', '01'],
    [4, '01x', '11', '10'],
    [5, 3, '00', '00'],
    [5, 4, '01', '01'],
    [5, 1, '10', '11'],
    [5, 0, '11', '10'],
  ],
}

// Output patterns: partial (1x) and fully unspecified (xx) Mealy outputs
export const M5: FsmSpec = {
  model: 'mealy',
  inputBits: 1,
  outputBits: 2,
  stateCount: 3,
  edges: [
    [0, 1, '0', '1x'],
    [0, 2, '1', 'x1'],
    [1, 0, '0', '0x'],
    [1, 1, '1', 'xx'],
    [2, 2, '0', 'x0'],
    [2, 0, '1', '01'],
  ],
}
export const M5_SNAPSHOT = [
  'q0|0->q1/1x',
  'q0|1->q2/x1',
  'q1|0->q0/0x',
  'q1|1->q1/xx',
  'q2|0->q2/x0',
  'q2|1->q0/01',
]

export const FSM_SPECS: readonly { name: string; spec: FsmSpec; expected: string[] }[] = [
  { name: 'M2 (three states, Foto 4)', spec: M2, expected: M2_SNAPSHOT },
  { name: 'M1 (four states, Abb. 1.1)', spec: M1, expected: M1_SNAPSHOT },
  { name: 'M3 (Moore, Foto 1)', spec: M3, expected: M3_SNAPSHOT },
  { name: 'M4 (six states, patterns)', spec: M4, expected: [] },
  { name: 'M5 (output patterns)', spec: M5, expected: M5_SNAPSHOT },
]
