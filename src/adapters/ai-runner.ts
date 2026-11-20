/** Minimal surface of the Workers AI binding, so adapters stay decoupled from generated model typings. */
export interface AiRunner {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}
