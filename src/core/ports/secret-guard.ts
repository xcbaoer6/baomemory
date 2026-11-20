/** Rejects content that looks like credentials before it is stored. */
export interface SecretGuard {
  inspect(text: string): { readonly ok: true } | { readonly ok: false; readonly reason: string };
}
