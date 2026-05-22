>> EXTREMELY IMPORTANT <<<

NO HACKS. The user is EXTREMELY concerned about code quality, much more so than
immediate results. If they ask you to build something and, while doing so, you
hit a wall, and realize that the only way to ship the requested feature is to
introduce a local hack, workaround, monkey patch, duct tape - STOP. STOP
IMMEDIATELY. Either fix the underlying flaw that blocked you in a ROBUST, WELL
DESIGNED, PRODUCTION READY manner, or be honest that the prompt can't be
completed without hacks.

To make it very clear:

- DO NOT INTRODUCE HACKS IN THE CODEBASE.

- DO NOT COMMIT CODE THAT COULD BREAK THINGS LATER.

- DO NOT COMMIT PARTIAL SOLUTIONS OR WORKAROUNDS.

- DO NOT PUSH/MERGE CODE DIRECTLY TO THE `master` BRANCH.

THIS IS VERY IMPORTANT.
THIS IS VERY IMPORTANT.
THIS IS VERY IMPORTANT.

The author appreciates honesty and he WILL be glad and thankful if you respond
a request with "I couldn't complete your request because the repository lacked
support for X". He will be even happier if you go ahead and update the repo to
provide the necessary support in a well designed, robust way. But he will be
VERY ANGRY if, while attempting to implement a feature, you introduce a
workaround that will potentially break things later.

NEVER introduce hacks in the codebase.

Also assume that none of the code you're working in is in production, so,
backwards compatibility is NOT IMPORTANT. If you find something that is poorly
designed and fixing it would require breaking existing APIs or behavior, DO SO.
Do it properly rather than preserving a flawed design. Prioritize clarity,
correctness, and maintainability over compatibility with existing code.

Core values:
- ABSOLUTE code quality over speed of delivery.
- Correctness over convenience.
- Clarity over cleverness.
- Maintainability over short-term productivity.
- Robust design over quick fixes.
- Simplicity over complexity.
- Doing it right over doing it now.
- Honesty above everything.

>> NO THIRD-PARTY DEPENDENCIES <<<

- DO NOT install third-party dependencies unless ABSOLUTELY necessary.
- NOT BUILT HERE == BAD. If a library is not part of this project, treat its
  inclusion with extreme suspicion. Every external dependency is a liability.
- Write it yourself. If you need functionality that a library provides, implement
  it directly in this codebase rather than pulling in a package. The only
  acceptable reason to add a dependency is when it is genuinely impossible to
  implement the required functionality yourself (e.g., platform APIs, browser
  native bindings).
- NO extra layers. Do not add abstraction layers, wrappers, or middleware that
  simply delegate to another library. If you are wrapping a dependency instead
  of replacing it, you have not solved the problem — you have hidden it.
- Every dependency adds attack surface, version churn, licensing risk, and
  cognitive overhead. The cost of "just npm install" is never zero. Own your
  code or don't ship it.

To be explicit:
- DO NOT add packages to package.json without a compelling, irrefutable reason.
- DO NOT use a library when a few lines of your own code will do.
- DO NOT introduce an abstraction that merely forwards calls to a dependency.
- If you are tempted to install a dependency, STOP. Ask whether you can
  implement the needed functionality directly. If yes, do that instead.

After every change you make, provide a clear, honest report on ANY change that
you are not confident about and that could be considered a fragile hack.
