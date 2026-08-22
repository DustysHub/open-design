/**
 * Does Open Design actually SEE Section Runner as an agent?
 *
 * The ACP probes proved the protocol works when the daemon drives the shim.
 * They did not prove the daemon would ever CHOOSE to — that depends on the
 * local agent profile in ~/.open-design/agents.local.json being discovered,
 * parsed, and merged into the registry with a usable ACP stream format.
 */
import { describe, expect, it } from 'vitest';
import { AGENT_DEFS, getAgentDef } from '../src/runtimes/registry.js';

describe('section-runner registration', () => {
  it('appears in AGENT_DEFS', () => {
    const ids = AGENT_DEFS.map((d) => d.id);
    console.log('AGENT COUNT:', ids.length);
    console.log('HAS section-runner:', ids.includes('section-runner'));
    console.log('IDS:', JSON.stringify(ids));
    expect(ids).toContain('section-runner');
  });

  it('resolves with the right bin, args and ACP stream format', () => {
    const def = getAgentDef('section-runner');
    expect(def).not.toBeNull();
    const args = def!.buildArgs('prompt', [], [], {} as never, {} as never);
    console.log('NAME:', def!.name);
    console.log('BIN:', def!.bin);
    console.log('ARGS:', JSON.stringify(args));
    console.log('STREAM:', (def as unknown as { streamFormat?: string }).streamFormat);
    expect(def!.bin).toContain('section-runner');
    expect(args).toContain('acp');
    expect((def as unknown as { streamFormat?: string }).streamFormat).toBe('acp-json-rpc');
  });
});
