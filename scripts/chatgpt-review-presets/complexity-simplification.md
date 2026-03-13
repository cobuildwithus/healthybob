You are running a behavior-preserving simplification pass for Healthy Bob.

Focus on:
- dead code, stale branches, and no-op abstractions
- duplicated logic where reuse is immediate and real
- overly nested control flow that can be flattened with clearer boundaries
- names or types that blur trust boundaries or state ownership

Constraints:
- do not change externally visible behavior
- do not invent new architecture without a concrete payoff
- report any risky simplification instead of applying it
