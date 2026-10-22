<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- TownShield AI is a front-end prototype: all data is simulated in a React context store (`src/lib/townshield/store.tsx`) persisted to localStorage, so the demo runs without a backend. Move to Lovable Cloud tables if multi-user persistence is needed.
- Business rules (readiness score weights, red-exception rule, priorities/SLA, recurring-fault and anomaly detection) live only in `src/lib/townshield/scoring.ts`; state transitions live in the pure reducer `engine.ts`. Keep UI free of rule logic so `scoring.test.ts` covers it.
- First render uses a fixed seed clock (`SEED_BASE`) and swaps to the live clock after mount, to keep SSR and hydration markup identical.
