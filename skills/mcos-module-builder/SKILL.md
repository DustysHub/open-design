---
name: mcos-module-builder
description: |
  Build modules for Mission Control OS (MCOS) — the universal business operating system.
  Scaffolds the full module structure: manifest, React component, MCP tool actions,
  entity declarations, Prisma models, and tests. Follows MCOS conventions enforced
  by 216 Anvil audit findings.
triggers:
  - "build mcos module"
  - "mcos module"
  - "mission control module"
  - "scaffold module"
od:
  mode: code
  category: fullstack
  capabilities_required:
    - file_write
    - terminal
---

# MCOS Module Builder

Build production-quality modules for Mission Control OS. Agent, follow this workflow exactly.

## Background

MCOS is a TypeScript monorepo (`apps/api` + `apps/web` + `packages/*`). Modules live at `packages/modules/<name>/` and are auto-discovered by both the frontend (via `import.meta.glob`) and backend (via `fs-register.ts` scanning `module.json` files). Each module can expose:

- A **React component** rendered in the MCOS dashboard
- **MCP tool actions** callable by AI agents (Omni, specialists)
- **Entity declarations** that project into the unified entity bus
- **Prisma models** for persistent storage

Stack: TypeScript (strict), React 18, Tailwind CSS, Prisma ORM, Zod, Vitest, Express.

## 1. Gather requirements

Ask the user:

1. **Module name** — lowercase kebab-case (e.g. `invoice-tracker`)
2. **Module type** — `internal` (React UI + actions) or `external` (IframeBridge wrapping an external app)
3. **What it does** — one sentence
4. **Key actions** — what operations should agents be able to perform? (list 3-5 verbs)
5. **Entities** — does it create its own data type? (e.g. "invoices", "appointments")
6. **Category** — `dev`, `ops`, `finance`, `creative`, `comms`, `data`, `general`

## 2. Scaffold file structure

Every module has this structure. Create all files:

```
packages/modules/<name>/
  src/
    index.tsx          # Module class + React component
  actions.ts           # MCP tool action definitions (if any)
  module.json          # Backend registration metadata
  package.json         # Package manifest
  tsconfig.json        # TypeScript config
  actions.test.ts      # Action unit tests
```

### 2.1 module.json

```json
{
  "id": "<name>",
  "name": "<Display Name>",
  "version": "1.0.0",
  "type": "internal",
  "permissions": ["data.read", "data.write"],
  "description": "<one-line description>",
  "category": "<category>",
  "icon": "<emoji>",
  "author": "nexu-io"
}
```

Valid types: `internal`, `external`. Valid permissions: `data.read`, `data.write`, `system.admin`, `comms.send`.

### 2.2 package.json

```json
{
  "name": "@mission-control/<name>",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.tsx",
  "dependencies": {
    "@mission-control/module-sdk": "workspace:*",
    "@mission-control/core": "workspace:*",
    "zod": "^3.23.0"
  }
}
```

### 2.3 tsconfig.json

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "actions.ts"]
}
```

### 2.4 src/index.tsx — Internal module

```tsx
import { BaseModule, IframeBridge } from '@mission-control/module-sdk';
import type { ModuleManifest, SpaceContext } from '@mission-control/core';

function <PascalName>Component({ spaceContext }: { spaceContext: SpaceContext }) {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold"><Display Name></h2>
      {/* Module UI here */}
    </div>
  );
}

export default class <PascalName>Module extends BaseModule {
  manifest: ModuleManifest = {
    id: '<name>',
    name: '<Display Name>',
    version: '1.0.0',
    type: 'internal',
    permissions: ['data.read', 'data.write'],
    description: '<description>',
    category: '<category>',
    icon: '<emoji>',
    author: 'nexu-io',
  };

  getComponent() {
    return <PascalName>Component;
  }
}
```

### 2.5 src/index.tsx — External module (IframeBridge)

For modules wrapping an external app (e.g. a Next.js app on another port):

```tsx
import { BaseModule, IframeBridge } from '@mission-control/module-sdk';
import type { ModuleManifest, SpaceContext } from '@mission-control/core';

const DEFAULT_URL = 'http://localhost:<port>';

function <PascalName>Component({ spaceContext }: { spaceContext: SpaceContext }) {
  return (
    <IframeBridge
      moduleId="<name>"
      url={DEFAULT_URL}
      displayName="<Display Name>"
      icon="<emoji>"
      spaceId={spaceContext.spaceId}
    />
  );
}

export default class <PascalName>Module extends BaseModule {
  manifest: ModuleManifest = {
    id: '<name>',
    name: '<Display Name>',
    version: '1.0.0',
    type: 'external',
    permissions: ['data.read', 'data.write'],
    description: '<description>',
    category: '<category>',
    icon: '<emoji>',
    author: 'nexu-io',
  };

  getComponent() {
    return <PascalName>Component;
  }
}
```

If the external app sets `X-Frame-Options` or CSP `frame-ancestors`, you need a Vite proxy entry in `apps/web/vite.config.ts`. If it does NOT set those headers, use the direct URL (simpler, avoids Next.js asset path issues).

## 3. Define actions (MCP tools)

Actions are the primary interface between AI agents and your module. Each action becomes an MCP tool, a REST endpoint, and a typed React Query hook — all from one definition.

### 3.1 Action pattern

```typescript
// actions.ts
import { z } from 'zod';
import { defineAction, registerAction } from '@mission-control/module-sdk';
import { prisma } from '../../../apps/api/src/db/prisma.js';

// --- Action: <module>.<verb> ---

const create<Entity> = defineAction({
  name: '<module>.create<Entity>',      // MUST match pattern: <module>.<camelAction>
  description: 'Create a new <entity>',
  kind: 'mutation',                      // 'mutation' for writes, 'query' for reads
  input: z.object({
    title: z.string().describe('Title of the <entity>'),
    description: z.string().optional().describe('Optional description'),
  }),
  output: z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string(),
  }),
  handler: async (args, ctx) => {
    // ctx.spaceId is ALWAYS available — use it for tenant isolation
    const record = await (prisma as any).<entity>.create({
      data: {
        spaceId: ctx.spaceId,    // REQUIRED: tenant isolation
        title: args.title,
        description: args.description ?? null,
      },
    });
    return {
      id: record.id,
      title: record.title,
      createdAt: record.createdAt.toISOString(),
    };
  },
});

registerAction(create<Entity>);
```

### 3.2 Action naming convention

Action names follow `<module>.<camelCaseVerb>` pattern. The regex is: `^[a-z][a-z0-9-]*\.[a-zA-Z][a-zA-Z0-9]*$`

Examples:
- `task-manager.createTask`
- `notepad.searchPages`
- `finance.addTransaction`
- `crm.moveDealStage`

### 3.3 Common action patterns

**List action (query):**
```typescript
const list<Entities> = defineAction({
  name: '<module>.list<Entities>',
  description: 'List all <entities> in the current space',
  kind: 'query',
  input: z.object({
    status: z.enum(['active', 'archived', 'all']).optional().default('active'),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
  }),
  output: z.object({
    items: z.array(z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
    })),
    total: z.number(),
  }),
  handler: async (args, ctx) => {
    const where: any = { spaceId: ctx.spaceId };
    if (args.status !== 'all') where.status = args.status;

    const [items, total] = await Promise.all([
      (prisma as any).<entity>.findMany({
        where,
        take: args.limit,
        skip: args.offset,
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).<entity>.count({ where }),
    ]);

    return {
      items: items.map((i: any) => ({
        id: i.id, title: i.title, status: i.status,
      })),
      total,
    };
  },
});
registerAction(list<Entities>);
```

**Update action (mutation):**
```typescript
const update<Entity> = defineAction({
  name: '<module>.update<Entity>',
  description: 'Update an existing <entity>',
  kind: 'mutation',
  input: z.object({
    id: z.string().describe('ID of the <entity> to update'),
    title: z.string().optional(),
    status: z.enum(['active', 'archived']).optional(),
  }),
  output: z.object({ id: z.string(), updated: z.boolean() }),
  handler: async (args, ctx) => {
    const { id, ...data } = args;
    await (prisma as any).<entity>.updateMany({
      where: { id, spaceId: ctx.spaceId },   // spaceId ensures tenant isolation
      data,
    });
    return { id, updated: true };
  },
});
registerAction(update<Entity>);
```

### 3.4 Zod schema rules

- Every field MUST have `.describe('...')` — this becomes the MCP tool parameter description
- Use `.optional()` for non-required fields
- Use `.default(value)` for fields with defaults
- Supported Zod types: `z.string()`, `z.number()`, `z.boolean()`, `z.enum([...])`, `z.array(...)`, `z.object({...})`
- Complex nested objects work but keep schemas flat when possible

## 4. Entity declarations (optional)

If your module creates its own data type, declare an entity so it appears in the unified entity bus and can be linked to other entities:

```typescript
import { defineEntity } from '@mission-control/module-sdk';

defineEntity({
  type: '<module>.<entityType>',        // e.g. 'invoice-tracker.invoice'
  label: { singular: 'Invoice', plural: 'Invoices' },
  icon: '<emoji>',
  schema: {
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'status', type: 'enum', values: ['draft', 'sent', 'paid'] },
      { name: 'dueDate', type: 'date' },
    ],
  },
  projections: {
    task: {
      title: (e) => e.title,
      status: (e) => e.status === 'paid' ? 'done' : 'todo',
    },
  },
});
```

Entities can be linked to other entities (tasks, notes, contacts) via the entity bus using `EntityLinks` from the module-sdk.

## 5. Prisma model (if needed)

If your module needs persistent storage, add a model to the Prisma schema at `apps/api/src/db/prisma/schema.prisma`:

```prisma
model <Entity> {
  id        String   @id @default(cuid())
  spaceId   String                        // REQUIRED: tenant isolation
  title     String
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([spaceId])                      // REQUIRED: index for tenant queries
}
```

After adding the model:
```bash
npx prisma generate --schema=apps/api/src/db/prisma/schema.prisma
```

CRITICAL: Never use `--accept-data-loss` with Prisma migrations.

## 6. Write tests

Every action needs a test. Place tests at `packages/modules/<name>/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing actions
vi.mock('../../../apps/api/src/db/prisma.js', () => ({
  prisma: {
    <entity>: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { getAction } from '@mission-control/module-sdk';
import './<name>/actions.js';

describe('<module> actions', () => {
  const ctx = { spaceId: 'space-1' } as any;

  beforeEach(() => { vi.clearAllMocks(); });

  it('<module>.create<Entity> creates with spaceId', async () => {
    const { prisma } = await import('../../../apps/api/src/db/prisma.js');
    (prisma as any).<entity>.create.mockResolvedValue({
      id: 'new-1', title: 'Test', createdAt: new Date('2026-01-01'),
    });

    const action = getAction('<module>.create<Entity>');
    expect(action).toBeDefined();

    const result = await action!.handler({ title: 'Test' }, ctx);
    expect(result.id).toBe('new-1');

    // Verify tenant isolation
    expect((prisma as any).<entity>.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ spaceId: 'space-1' }),
      }),
    );
  });

  it('<module>.list<Entities> filters by spaceId', async () => {
    const { prisma } = await import('../../../apps/api/src/db/prisma.js');
    (prisma as any).<entity>.findMany.mockResolvedValue([]);
    (prisma as any).<entity>.count.mockResolvedValue(0);

    const action = getAction('<module>.list<Entities>');
    const result = await action!.handler({}, ctx);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);

    expect((prisma as any).<entity>.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ spaceId: 'space-1' }),
      }),
    );
  });
});
```

Run tests: `npx vitest run packages/modules/<name>/`

## 7. Coding standards

These are non-negotiable. Learned from 216 Anvil audit findings:

1. **No dead code** — grep every new export/import before finishing. Remove unused code.
2. **Match specs literally** — exact labels, exact behavior. Comment any deviations.
3. **Read consumer types** — open the interface/type before constructing payloads.
4. **Clean up timers** — useRef + useEffect cleanup for all intervals/timeouts.
5. **Search before writing** — grep for existing helpers first. Don't duplicate.
6. **Tailwind only** — no inline `style={{}}`. Use Tailwind arbitrary syntax for dynamic values.
7. **No cross-boundary imports** — no `../../` across packages, no `@ts-ignore`.
8. **Meaningful tests** — `.toThrow()` with parens, mocks must implement the methods the SUT calls.
9. **No debug artifacts** — use structured logger (`src/utils/logger.ts`), never `console.log`.
10. **Tenant isolation** — every query MUST include `spaceId`. SSE filters by client.
11. **Correct error semantics** — `error` for unexpected failures, `warn` for expected conditions.

## 8. Verification checklist

Before declaring the module complete, verify:

- [ ] `module.json` has all required fields and valid `type`/`category`
- [ ] Module class extends `BaseModule` and implements `getComponent()`
- [ ] All actions registered with `registerAction()`
- [ ] Action names match `<module>.<camelVerb>` regex
- [ ] Every Zod field has `.describe()`
- [ ] Every Prisma query includes `spaceId` in `where`
- [ ] Tests exist for every action
- [ ] Tests verify tenant isolation (spaceId in queries)
- [ ] No `console.log` — use structured logger
- [ ] No inline styles — Tailwind only
- [ ] No cross-boundary imports
- [ ] TypeScript compiles: `cd apps/api && npx tsc --noEmit`
- [ ] Tests pass: `npx vitest run packages/modules/<name>/`

## Quick reference: auto-discovery

**Frontend:** `apps/web/src/modules/moduleLoader.ts` uses:
```typescript
import.meta.glob('../../../packages/modules/*/src/index.tsx')
```
Any module with `src/index.tsx` is auto-discovered. No manual registration needed.

**Backend:** `apps/api/src/mcp/fs-register.ts` scans for `module.json` files. Actions are loaded from `actions.ts` and registered as MCP tools.

**Vite config:** If your module needs a proxy (external app with iframe-blocking headers), add an entry to `apps/web/vite.config.ts` using the `stripIframeHeaders` pattern.
