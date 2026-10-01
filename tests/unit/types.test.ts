import { describe, expectTypeOf, it } from 'vitest';
import { AGENT_EVENT_TYPES, type AgentEventType } from '../../src/core/types';

describe('AGENT_EVENT_TYPES', () => {
  it('lists exactly the AgentEvent discriminants', () => {
    expectTypeOf<(typeof AGENT_EVENT_TYPES)[number]>().toEqualTypeOf<AgentEventType>();
  });
});
