export function advanceTime(t: number, delta: number, duration: number, speed: number) {
  return ((t + delta * speed / duration) % 1 + 1) % 1;
}

export function validatePreset(value: unknown, groups: Record<string, object>, tricks: string[]) {
  const p = value as { version?: number; trick?: string; tuning?: Record<string, Record<string, number>> };
  if (!p || p.version !== 1 || !tricks.includes(p.trick ?? '') || !p.tuning) throw new Error('Not a Trick Lab v1 preset');
  for (const [name, values] of Object.entries(groups)) {
    const incoming = p.tuning[name];
    if (!incoming || Object.keys(incoming).length !== Object.keys(values).length) throw new Error(`Missing or unexpected ${name} controls`);
    validateTree(incoming, values, name);
  }
  for (const name of ['HEAD_TUNING', 'HEAD_TUNING_BS']) {
    if (p.tuning[name].WHIP_END <= p.tuning[name].HOLD_FRAC) throw new Error(`${name}: whip end must follow hold`);
  }
  if (p.tuning.STYLE_BS.P2_END <= p.tuning.STYLE_BS.P1_END) throw new Error('Style phase 2 must follow phase 1');
  return p as { version: 1; trick: string; tuning: Record<string, Record<string, number>> };
}

function validateTree(value: unknown, template: unknown, path: string) {
  if (typeof template === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10) throw new Error(`Invalid ${path}`);
    return;
  }
  if (!value || typeof value !== 'object' || !template || typeof template !== 'object' || Object.keys(value).length !== Object.keys(template).length) throw new Error(`Invalid ${path}`);
  for (const [key, child] of Object.entries(template)) {
    if (!Object.hasOwn(value, key)) throw new Error(`Missing ${path}.${key}`);
    validateTree((value as Record<string, unknown>)[key], child, `${path}.${key}`);
  }
}
