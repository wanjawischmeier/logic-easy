
 // Raw payload shape received from fsm editor messages
export interface RawFsmTransition {
  id?: string | number
  from?: string | number
  to?: string | number
  input?: string | unknown
  output?: string | unknown
  mealy_output?: string | unknown
  toPattern?: string | unknown
  label?: string | unknown
}

export interface RawFsmState {
  id?: string | number | null
  name?: string | null
  initial?: boolean | null
  final?: boolean | null
  x?: string | number | null
  y?: string | number | null
}

