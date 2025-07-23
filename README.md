# What if your application could write itself?

Not entirely — not yet — but we are closer than you think.

## Introducing **Pi**

An architecture built not merely for developers, but for AI.

Pi is neither a framework nor a library. It is a set of **strict conventions** — simple, declarative, and transparent — designed so that AI systems can understand, generate, test, and debug their own code.

### How? By being honest

- **Routes** are plain data.
- **Components** are pure.
- **Side‑effects** are extracted from the UI and placed into lifecycle‑aware middleware owned by each feature.
- Every piece of behaviour is explicit and predictable.

This rigour enables something far more powerful.

### 🔁 A feedback loop for machines

Agentic systems — such as Claude, Code Interpreter, and future autonomous development agents — thrive on feedback. They do not simply generate code; they **test**, **observe**, **reason**, and **adapt**.

Because navigation, state, and effects in Pi are all **observable** and **deterministic**, an AI agent can:

1. Dispatch a navigation event.
2. Wait for state to update.
3. Inspect logs and error boundaries.
4. Adjust its next step accordingly.

Integration tests become conversation; debug sessions become planning phases. The architecture itself becomes the feedback loop, tailored to how machines learn — not to how humans pretend they do not make mistakes.

Pi is not a playground for AI. It is a runtime AI can reason about.

### 🔄 But what makes that possible?

At the heart of Pi is **Redux** — but not Redux as you have seen it before.

In Pi, Redux is **the application runtime**:

- All state, navigation, and behaviour flow through Redux.
- Routes are Redux state.
- Modals are Redux state.
- Side‑effects are triggered by Redux actions.

This is not dogma; it is infrastructure. Redux provides a **serialised, inspectable, replayable, and testable** application lifecycle — exactly what AI systems require to operate autonomously.

Pi gives Redux clear conventions and context; Redux gives Pi a perfect **audit trail**. Together, they form a system that is not merely understandable but **operationally transparent**.

---

## In summary

**Pi** is a UI architecture designed not just for humans, but for the next generation of developers: machines that can read logs, plan actions, test assumptions, and write code better with every loop.

Pi is not only how we build applications; it is how we build **applications that can build themselves**.
