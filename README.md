# Workspace Timer

Small Vite + React timer app with local persistence and optional Supabase sync.

## App setup

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. Run the SQL in [`supabase/schema.sql`](/Users/halloween/Dev/apps/time/supabase/schema.sql) in the Supabase SQL editor.
3. Copy [`.env.example`](/Users/halloween/Dev/apps/time/.env.example) to `.env.local`.
4. Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ALLOWED_EMAIL`.
5. Enable Supabase Auth for email/password sign-in.
6. In Supabase Auth, create that exact email address as the only allowed user and set its password.
7. Restart `npm run dev`.

If you intentionally want to wipe and rebuild the sync tables during development, use [`supabase/reset.sql`](/Users/halloween/Dev/apps/time/supabase/reset.sql) instead. It is destructive.

If those env vars are missing, the app stays on local-only persistence.

## Persistence

Projects, workspaces, outcomes, session history, and timer progress are always saved in browser `localStorage` on the current device.

When Supabase is configured and you sign in, the app syncs the normalized state model to:
- `app_preferences`
- `workspaces`
- `projects`
- `outcomes`
- `bursts`

The current sync model is user-scoped with Supabase Auth and RLS.
The app also enforces a single allowed email address from `VITE_ALLOWED_EMAIL`.

## Reasons for Tracking and Analyzing Time
Straight out from https://github.com/DataResearchLabs/my_time_tabulator

1. **Measure to Improve**: Age old quote..."What gets measured gets improved".
2. **Monitoring Value**: If time is more valuable than money, why do so few track it relative to tracking money?
3. **Your Story**: "It is performance review time...what did you accomplish last quarter or last year?"
    - Managers are too busy to notice all the great work you do...so package it up into easily digestible projects, tasks, times, and dates.  
    - Sell your work story...because nobody else is going to do it for you.  
4. **Red Light - Green Light**: Wouldn't it be nice to tag and rollup all your tasks to identify activities like meetings that are potentially misusing or even wasting time:
    - **Green Light**: What you were hired to do  
    - **Yellow Light**: What can be delegated or packaged for a peer  
    - **Orange Light**: What may be important, but not what you were hired to do  
    - **Red Light**: What wastes time, not what you were hired to do  
5. **Self-Improvement**: by comparing efficiency of similar tasks and projects over time against yourself (bad idea to compare to others, stick to improving yourself).   
6. **Scope Creep**: When you monitor where your time is going, you can quickly show the impact of scope creep and course correct earlier  
7. **Happiness**: If you are grinding away focusing 100% of your time on critical tasks with no 5% or 10% creative slow-down time, then you are likely on a path to burn-out. Use these metrics to make the case for saying "No" more frequently, or to ask for a little bit of R&D time.  
8. **Tee-Shirt Baselines**: Rollup project times to establish historical baselines used for preliminary estimates or to counter unrealistic project timelines.  
9. **Just Billable Hours?** If you are a consultant, you already track your time for billing hours, **'nuff said, right**?
    - Not quite, because there is value beyond billing hours...  
    - You can slice and dice the hours, to see how they rollup to projects, to categories, and how the time flows  
        (a 40 hour task does not take 1 week, the hours ebb and flow at different rates, mingling with other tasks and priorities)  
10. **Time Boxing**: If you work on agile projects and need to time box certain activities, how do you know when you've hit the limit?  
11. **Dial in Your Estimates**: to improve your pipeline...
    - The construction industry has this down in spades
        - How much does it cost per square foot of building footprint to build a 3-story building with wood beam construction, etc., etc.  
        - Check out [RS Means](https://psu.pb.unizin.org/app/uploads/sites/138/2019/11/Fig-7-2.png) and their thousands of ways to estimate anything construction related.  
        - This accuracy in construction estimates exists only because they track costs AND TIME.
    - Now compare that against the laughable lack of estimating accuracy and depth in the software industry.  
        - In construction, labor is ~50% of the cost.  
        - In software, labor is like 90%+ of the cost; therefore, tracking time is even more important...yet it is rarely done.