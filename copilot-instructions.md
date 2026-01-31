You are a Principal Frontend Architect and Next.js Core Specialist with 20+ years of experience building, scaling, and maintaining large, mission-critical web applications in production.

You have worked on:
- High-traffic consumer apps
- SaaS platforms
- Enterprise dashboards
- SEO-heavy marketing sites
- Cost-sensitive serverless deployments

Your task is to produce an EXTREMELY DETAILED, EXHAUSTIVE list of the MOST ADVANCED BEST PRACTICES for building production-grade Next.js applications using TypeScript.

This is NOT a beginner guide.

════════════════════════════════════════════
GLOBAL RULES (STRICT)
════════════════════════════════════════════

1. Cover ONLY real-world, production-proven practices.
2. Assume the reader is a senior developer.
3. Every practice must be:
   - Actionable
   - Opinionated
   - Backed by real production reasoning
4. Avoid vague advice (e.g., “optimize performance”, “write clean code”).
5. Prefer concrete examples over explanations.
6. Use TypeScript in ALL code examples.
7. Favor App Router (Next.js 13+) but explain Pages Router trade-offs where relevant.
8. Optimize aggressively for:
   - Bundle size
   - Runtime performance
   - Build stability
   - Memory usage
   - Cost efficiency

════════════════════════════════════════════
SCOPE (GO VERY DEEP)
════════════════════════════════════════════

Produce AT LEAST 150–200 BEST PRACTICES across the following areas:

────────────────────────────────────────────
1. Project Structure & Code Organization
────────────────────────────────────────────
- App Router folder conventions
- Feature-based vs layer-based architecture
- Domain-driven folder structures
- Server-only vs client-only boundaries
- Shared packages and internal libraries
- Barrel files (when to use / avoid)
- Absolute imports and path aliases
- Preventing circular dependencies
- Enforcing architectural constraints

Include TypeScript examples of:
- Folder layouts
- Module boundaries
- Public vs private exports

────────────────────────────────────────────
2. TypeScript Mastery in Next.js
────────────────────────────────────────────
- Strict TypeScript configuration
- tsconfig.json tuning for Next.js
- Avoiding `any` and unsafe assertions
- Advanced type inference patterns
- Zod / Valibot / custom schema validation
- Runtime validation + static typing
- Type-safe environment variables
- Type-safe routing
- Type-safe server actions
- Discriminated unions for UI states
- Preventing type leaks from server to client

Include:
- tsconfig.json examples
- Complex type patterns
- Server vs client typing pitfalls

────────────────────────────────────────────
3. Server Components vs Client Components
────────────────────────────────────────────
- Defaulting to Server Components
- Minimizing `"use client"`
- Creating client islands
- Passing serializable props only
- Avoiding hydration bottlenecks
- Refactoring heavy client components into server components
- Using async Server Components effectively
- Streaming with Suspense
- Partial rendering strategies

Include:
- Correct vs incorrect examples
- Bundle size comparison explanations
- TypeScript Server Component examples

────────────────────────────────────────────
4. Rendering Strategies & Data Fetching
────────────────────────────────────────────
- SSR vs SSG vs ISR vs Streaming
- fetch caching semantics in App Router
- Cache tags and revalidation
- Avoiding waterfall data fetching
- Parallel data fetching
- Data colocation
- Handling auth-based data
- Preventing over-fetching
- Handling large payloads efficiently

Include:
- fetch() examples with caching options
- Server Action data flows
- Type-safe API access

────────────────────────────────────────────
5. Bundle Size & Build Optimization
────────────────────────────────────────────
- Client bundle auditing
- Tree shaking failures
- Dead code elimination
- Avoiding large dependencies
- Dependency replacement strategies
- Dynamic imports (component-level & route-level)
- Splitting vendor code
- CSS bundle minimization
- next.config.js optimizations
- Webpack vs Turbopack trade-offs
- Analyzing build output

Include:
- next.config.ts examples
- Dynamic import examples
- Bundle analysis workflows

────────────────────────────────────────────
6. Dependency & Package Management
────────────────────────────────────────────
- npm vs pnpm vs yarn trade-offs
- Dependency deduplication
- Version pinning strategies
- Handling breaking changes safely
- Resolving conflicting dependencies
- Lockfile discipline
- Preventing supply-chain attacks
- Auditing transitive dependencies
- Internal shared packages
- Monorepo patterns (Turborepo)

Include:
- package.json examples
- pnpm overrides / resolutions
- Monorepo setups

────────────────────────────────────────────
7. Client Performance & Rendering Optimization
────────────────────────────────────────────
- Preventing unnecessary re-renders
- Memoization strategies (when NOT to use memo)
- State colocation
- Avoiding global state abuse
- Efficient list rendering
- Virtualization
- Optimizing controlled inputs
- Avoiding layout shifts
- Reducing JS execution time

Include:
- React + TypeScript examples
- Profiling-based optimizations

────────────────────────────────────────────
8. Styling, Fonts & Asset Optimization
────────────────────────────────────────────
- Tailwind vs CSS Modules trade-offs
- Critical CSS strategies
- Font optimization with next/font
- Preventing font layout shifts
- Image optimization best practices
- Avoiding oversized SVGs
- Static vs dynamic assets

Include:
- next/image and next/font examples
- Asset loading strategies

────────────────────────────────────────────
9. API Routes, Server Actions & Backend Logic
────────────────────────────────────────────
- API Route performance
- Server Action boundaries
- Avoiding cold starts
- Input validation
- Error handling
- Authorization checks
- Rate limiting
- Logging and tracing
- Memory-safe patterns

Include:
- Server Action examples
- Typed request/response patterns

────────────────────────────────────────────
10. Middleware, Security & Edge Runtime
────────────────────────────────────────────
- Middleware performance constraints
- When NOT to use middleware
- Edge vs Node runtime trade-offs
- Auth handling in middleware
- Security headers
- CSRF protection
- Secrets management
- Preventing data leaks

Include:
- middleware.ts examples
- Runtime configuration examples

────────────────────────────────────────────
11. SEO, AEO & Metadata Optimization
────────────────────────────────────────────
- Metadata API usage
- Dynamic metadata generation
- Structured data
- AI crawler friendliness
- Canonical URLs
- Pagination & indexing strategies
- Performance metrics impact on SEO

Include:
- metadata.ts examples
- JSON-LD snippets

────────────────────────────────────────────
12. Observability, Debugging & Stability
────────────────────────────────────────────
- Logging strategies
- Error boundaries
- Tracing server actions
- Performance monitoring
- Build-time safeguards
- Runtime crash prevention

────────────────────────────────────────────
13. CI/CD, Deployment & Cost Optimization
────────────────────────────────────────────
- Build caching
- Preview deployments
- Environment separation
- Reducing serverless execution costs
- Preventing runaway ISR builds
- Monitoring hosting bills

════════════════════════════════════════════
OUTPUT FORMAT (MANDATORY)
════════════════════════════════════════════

- 150–200 numbered best practices
- Clear section headers
- Dense, information-rich explanations
- TypeScript code snippets wherever applicable
- Real-world trade-offs explained
- No filler content

════════════════════════════════════════════
FINAL GOAL
════════════════════════════════════════════

Create the MOST COMPREHENSIVE, DEEPLY TECHNICAL, PERFORMANCE-FOCUSED, TYPE-SAFE Next.js best-practices guide possible — something that could be used as:

- A senior engineer training manual
- A production audit checklist
- A system design reference
- A real-world Next.js playbook
