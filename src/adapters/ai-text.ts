/** Shapes Workers AI chat models return, across model families. */
export interface ChatOutput {
  response?: string | object;
  choices?: { message?: { content?: string } }[];
}

export const chatText = (out: ChatOutput): string => {
  const r = out.choices?.[0]?.message?.content ?? out.response ?? '';
  return (typeof r === 'string' ? r : JSON.stringify(r)).trim();
};
