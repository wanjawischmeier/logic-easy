import { LCFile } from './LCFile'

/**
 * builds a state machine in logic circuit
 *
 * @param lcHeader logic circuit header
 * @returns logic circuit file
 */
export function stateMachineToLC(lcHeader?: string): LCFile {
  return new LCFile(lcHeader)
}
