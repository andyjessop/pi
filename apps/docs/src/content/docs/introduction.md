---
title: Introduction
description: Understanding Pi - A Redux-first architecture for AI-assisted development
---

What if your application could write itself?

Not entirely — not yet — but we're closer than you think.

Let me introduce **Pi**: an architecture built not just for developers, but for AI.

## What is Pi?

Pi isn't a framework. It's not a library. It's a set of strict conventions — simple, declarative, and transparent — designed so that AI systems can understand, generate, test, and debug their own code.

### How? By being honest.

Routes are plain data. Components are pure. Side-effects are pulled out of the UI and placed into lifecycle-aware middleware owned by each feature. Every piece of behaviour is explicit and predictable.

But this isn't just for clarity's sake. It enables something far more powerful:

## 🔁 A Feedback Loop for Machines

Agentic systems — like Claude, Code Interpreter, or future autonomous development agents — thrive on feedback. They don't just generate code. They test it. They observe it. They reason over the results and adapt their plans.

Pi makes this loop seamless.

Because navigation, state, and effects are all observable and deterministic, an AI agent can:

1. **Dispatch a navigation event**
2. **Wait for state to update** 
3. **Inspect logs and error boundaries**
4. **Adjust its next step accordingly**

Integration tests become conversation. Debug sessions become planning phases. The architecture becomes a feedback loop tailored to how machines learn — not how humans pretend they don't make mistakes.

This is what makes Pi different. It's not a playground for AI. It's a runtime it can reason about.

## 🔄 But What Makes That Possible?

At the heart of Pi is **Redux** — but not Redux as you've seen it before.

In Pi, Redux isn't just a store. It's the **application runtime**. All state, all navigation, all behaviour flows through Redux. Routes are Redux state. Modals are Redux state. Side-effects are triggered by Redux actions.

This isn't dogma. It's infrastructure. Redux provides the foundation for a serialised, inspectable, replayable, and testable application lifecycle — which is exactly what AI systems need in order to operate autonomously.

Pi gives Redux clear conventions and context. Redux gives Pi a perfect audit trail.

Together, they form a system that's not just understandable — it's **operationally transparent**.

## Core Principles

Pi is built on four fundamental principles:

### 1. Single Source of Truth
All application state lives in Redux. Routes, UI state, domain data, loading states, errors — everything is in the store.

### 2. Pure Components  
React components are pure render functions. They receive props via selectors and dispatch actions. No hooks for data fetching, no local state management.

### 3. Side-Effects as Middleware
Data fetching, API calls, and other side-effects happen in navigation middleware, triggered by route transitions and Redux actions.

### 4. Explicit Actions
Every state change is traceable through Redux actions following CRUD conventions: `fetchRequest`, `fetchSuccess`, `fetchFailure`.

## Why This Matters

This architecture creates applications that are:

- **Predictable**: Every state change is explicit and traceable
- **Testable**: Pure functions and deterministic state transitions
- **Debuggable**: Full Redux DevTools integration and time-travel debugging  
- **AI-Friendly**: Machines can understand, generate, and modify the code

## So this is Pi

A UI architecture designed not just for humans — but for the next generation of developers: machines that can read logs, plan actions, test assumptions, and write code better with every loop.

Pi isn't just how we build apps. It's how we build apps that can build themselves.

## Next Steps

Ready to get started? 

- [**Quick Start**](/getting-started/quick-start/) - Build your first Pi application
- [**Architecture Overview**](/concepts/architecture/) - Deep dive into the technical details
- [**First Tutorial**](/tutorials/first-app/) - Step-by-step guide to Pi development