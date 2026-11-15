import {
  simulateOvernight,
  type OvernightInput,
  type OvernightResult,
} from './overnight';
import { fetchOvernightRemote } from './overnightRemote';

export type OvernightSource = 'remote' | 'local';

export type OvernightRun = {
  result: OvernightResult;
  source: OvernightSource;
};

/** Prefer remote LLM overnight when configured; fall back to local simulation. */
export async function runOvernightHunt(
  input: OvernightInput,
  now = () => new Date().toISOString(),
  idSeed = () => Date.now()
): Promise<OvernightRun> {
  const remote = await fetchOvernightRemote(input, now, idSeed);
  if (remote) return { result: remote, source: 'remote' };
  return {
    result: simulateOvernight(input, now, idSeed),
    source: 'local',
  };
}
