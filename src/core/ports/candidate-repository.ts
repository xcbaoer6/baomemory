import type { Candidate, NewCandidate } from '../domain/candidate';

/** Review-queue storage port. */
export interface CandidateRepository {
  addMany(candidates: readonly NewCandidate[]): Promise<number>;
  list(limit: number): Promise<Candidate[]>;
  count(): Promise<number>;
  getMany(ids: readonly string[]): Promise<Candidate[]>;
  removeMany(ids: readonly string[]): Promise<void>;
}
