Pi

**The AI-First Frontend Framework**

Pi is a Redux-based framework designed specifically for AI development workflows. It completely separates application state from presentation state, making it the ultimate framework for building frontends with AI assistance.

## Core Philosophy

- **Complete State Separation**: Application logic lives entirely separate from presentation
- **AI-Optimized**: Rigidly defined structures with simple, predictable patterns
- **Zero Ambiguity**: Clear folder structure, naming conventions, and API patterns
- **Pure Presentation**: Views are purely `f(state)` - no side effects, no complexity
- **No Waterfalls**: Data fetching handled by module thunks that integrate with routing

## Key Features

### Redux-Based Architecture

- Centralized state management with predictable patterns
- Simple thunk-based async operations
- Built-in router integration

### AI-First Design

- Rigid module definitions for consistent code generation
- Simple, discoverable patterns that AI can easily understand and replicate
- Clear separation of concerns makes automated refactoring reliable

### Node-Testable

- Full framework can be tested in Node.js environment
- No browser dependencies for business logic
- Easy iteration and testing with Claude Code

### Built-in Router

- Router hooks directly into module thunks
- Eliminates data fetching waterfalls
- Seamless navigation state management

## Architecture

```
apps/
  cli/           # Development and testing CLI
packages/
  core/          # Core framework logic
  router/        # Built-in routing system
  logger/        # Shared utilities
```

## Getting Started

```bash
bun install
bun run cli:start
```

## Why Pi?

Traditional frontend frameworks leave too much to interpretation. Pi provides:

- **Predictable Structure**: Every module follows the same pattern
- **Clear Conventions**: Naming, exports, and APIs are standardized
- **AI-Friendly**: Simple patterns that AI can understand and extend
- **Pure Functions**: Presentation layer has zero side effects
- **Integrated Routing**: No manual wiring between routes and data

Perfect for teams using AI-assisted development workflows.

