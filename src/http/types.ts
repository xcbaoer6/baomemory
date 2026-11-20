import type { Env } from '../config/env';
import type { Services } from '../core/services';

export interface AppEnv {
  Bindings: Env;
  Variables: { services: Services };
}
