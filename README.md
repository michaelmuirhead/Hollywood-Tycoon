# Hollywood Tycoon

A 1985-era career and business simulator where you arrive in Hollywood with one craft, a small bank account, and forty-odd years to figure out what you want to be remembered for.

You can be an actor, director, producer, or writer. You can become two of those, or three, or four. You can run a studio, build a franchise, fall in love, get divorced in public, become America's horror director, marry your three-time co-star, retire as a legend, and then watch your name on the marquee thirty years later when your kid starts their own career.

The game is a single-file React component (`src/App.jsx`) — about 14,000 lines, no external state library, no router. State lives in React `useState` and persists via `localStorage`.

---

## Running locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Deploying

Push this folder to a GitHub repo and import it at [vercel.com/new](https://vercel.com/new). The Vite preset works out of the box. No environment variables, no backend.

## Target platform

The game is currently tuned for **iPad Pro 13"** (1024×1366). It works on desktop browsers too — touch-specific tuning (tap-to-show tooltips, 44pt minimum tap targets, iOS-styled range sliders) is gated by `@media (hover: none)` so it only kicks in on touch devices.

---

## How the game is structured

### One big component, lots of small ones

`App.jsx` exports a root `App` that handles save loading and the start screen. Once you have a player, `MainGame` takes over and renders one of about 22 views. Views are switched via local `view` state — there is no router.

Component dependencies look roughly like:

```
App
└── MainGame
    ├── StatsBar (always visible, shows fame/cash/energy/personal/comeback flags)
    ├── Hub (the main menu)
    │   ├── Welcome panel + nav buttons
    │   ├── Career Status panel + Action buttons
    │   ├── LogPanel + SkillsPanel
    │   ├── CollapsiblePanel × many:
    │   │   ├── Studio Reserves
    │   │   ├── Cameo Invitations
    │   │   ├── First-Look Pitches
    │   │   ├── Mentorship
    │   │   ├── Co-Producing
    │   │   ├── Your Wheelhouse (specialties)
    │   │   ├── Holdings (Boulevard purchases)
    │   │   ├── In Theaters
    │   │   └── Filmography
    │   └── Modals (foundStudio, retire confirm, etc.)
    ├── Offers (Casting Board)
    ├── Training
    ├── ProjectBuilder (greenlight)
    ├── ProductionScreen (preprod → filming → postprod → marketing)
    ├── PersonalLife
    ├── Boulevard (shop)
    ├── WorldView (industry NPCs + first-look + mentorship)
    ├── FranchisesView (own franchises + acquisition offers)
    ├── PressClippings
    ├── CareerHistory + CareerCharts
    ├── LegacyView (retirement)
    └── Modals:
        ├── TabloidEventModal
        ├── AwardCeremonyModal (incl. craft awards display)
        ├── YearInVarietyModal
        ├── OpeningWeekendModal
        ├── FilmChartModal (incl. Director's Cut option)
        └── LifetimeAchievementModal
```

### The player state object

The entire game state lives in one nested object. Key fields:

| Field | Purpose |
|---|---|
| `name`, `startingRole`, `startYear`, `age`, `year`, `week` | Identity + time |
| `cash`, `lifetimeEarnings`, `energy`, `burnoutWeeks` | Resources |
| `skills`, `reputation` | Per-role craft/reputation, 0–100 |
| `fame`, `peakFame` | Public visibility |
| `history` | All released films (closed runs) |
| `inTheaters` | Films currently playing with weekly grosses |
| `pendingProject`, `activeProduction` | Mid-flight production state |
| `studio` | Studio object if founded (name, reserves, budgetCap, etc.) |
| `awards` | Nominations, wins, full history |
| `possessions`, `indulgenceCounts` | Things you've bought |
| `genreCredits` | Per-genre film counts, drives specialization |
| `personal` | Status, partner, partnerHistory, children, relationshipHealth, lastVowRenewalYear |
| `scandals` | Active scandals with severity and expiry |
| `pendingEvent`, `pendingChain`, `tabloidHistory` | Tabloid system |
| `lastPlantedAt` | Cooldown for "Plant a Story" PR |
| `franchises` | Active franchises with entries and rootCrew |
| `soldFranchises` | History of franchises sold to other studios |
| `franchiseAcquisitionOffers` | Pending acquisition offers from major studios |
| `worldNPCs` | Persistent industry figures (see below) |
| `lastNPCTickYear` | Yearly NPC age/career update tracking |
| `inheritedLegends`, `generation` | Multi-generation play |
| `legacy`, `status` | Set on retirement |
| `lifetimeAchievementYear` | Year a lifetime achievement award was received |
| `cameoOffers` | Pending cameo invitations from friend NPCs |
| `comebackState` | Active when in a comeback arc (after major flop or 18mo silence) |
| `firstLookDeals` | Active retainers with NPC directors |
| `firstLookPitches` | Pending pitches from those directors |
| `mentorships` | Active mentorship arrangements |
| `mentoredAlumni` | Graduated mentees (permanent friendship floor) |
| `coProducingOffers` | Pending producer-on-hire offers from other studios |
| `coProductions` | Co-productions in flight (capital committed) |
| `coProductionsHistory` | Settled co-productions |

The state is intentionally flat-ish so save/load is straightforward JSON. `unpackSave()` backfills missing fields on older saves so we never break compatibility.

---

## Core systems

### Career arc

Time advances week by week. Year flips trigger the Year in Variety modal. Age ticks each year. Energy regenerates ~15/week (more with buffs). Burnout activates if energy stays under 20 for 2+ weeks.

**Roles and skills.** Four roles: actor, director, producer, writer. Each has a 0–100 skill and a 0–100 reputation. Skills can be trained (with diminishing returns). Reputation moves up or down based on a film's quality vs your rep.

**Heat.** A composite of skill + rep + fame for a given role. Drives offer probability and audition threshold.

**Hyphenate path.** You start with one role at skill 15 and the others at 5. The threshold to take on a role on your own film is skill ≥ 5, so any role is technically available from day one. Practical progression: train into a second skill, then a third, then potentially a fourth. The game tracks first-time role debuts, first hyphenate combos (writer-director, actor-producer, etc.), Triple Threats, and the rare Quadruple Threat. Each gets a Career History milestone and log entry.

### Film production

A multi-phase pipeline: **Pre-Production → Filming → Post-Production → Marketing → Release**. The player makes role-specific choices in each phase that accumulate into a `qualityMod`, `marketingMod`, and `costOverrun` on the production object.

Quality is a weighted blend of crew skills (Writer 32%, Director 30%, Actor 22%, Producer 16%) plus reputation halo, plus +/-15 luck, plus all the modifiers. Critic and audience scores derive from quality. Box office multiplies budget × multipliers × reviews × luck. Marketing matters disproportionately at low budget.

**Big-budget risk.** Films over $40M roll for "production hell" at greenlight: each $10M over adds 3% chance (max 50%). Hell doubles cost overruns and starts production with a -8 quality mod. Above $100M the budget multiplier soft-caps. Below quality 50, the review multiplier punishes mega-budgets exponentially. Heaven's Gate is a real failure mode.

### Director's Cut / Re-Release

Films you directed that are 3+ years old, closed, and haven't already had a re-release can be re-released as Director's Cuts. Cost: 5% of original budget (clamped to $100K–$2M). Time: 4 weeks. Returns 5–15% of the original gross, weighted by quality (high-quality films get bigger bumps). Also +1–4 fame and +2 director reputation.

Eligibility checked inside `FilmChartModal`. Re-released films display the re-release year and bump in their stats and persist with `directorsCut` metadata.

### Festival circuit

Four festivals modeled, each with a window in the calendar year, an acceptance algorithm, and trade-offs:

| Festival | Window | Fee | Quality Bar | Base Accept | Critic Boost | Audience Cost | Awards Boost |
|---|---|---|---|---|---|---|---|
| Sundance | Week 3–5 | $5K | 60+ | 40% | +8 | -3 | +4 |
| Cannes | Week 19–21 | $25K | 72+ | 20% | +18 | -5 | +10 |
| Venice | Week 35–37 | $15K | 68+ | 30% | +14 | -4 | +8 |
| Toronto | Week 37–39 | $12K | 64+ | 40% | +10 | -2 | +6 |

Acceptance is computed in `festivalAcceptanceChance` from base rate × quality vs threshold × budget sweet spot × genre match × director reputation × prior award wins. Submissions happen during the Marketing phase, only the producer or director can submit. The roll resolves immediately. Accepted films delay wide release by 4 weeks. The `awardScoreBoost` flows directly into awards body scoring at year-end, so festival cred translates to nomination odds.

### Franchises and sequels

When a player makes an original film and either owns the studio or is the producer on hire, the film is registered as a franchise. Sequels can be greenlit through the FranchisesView and inherit the original's title pattern (`II`, `III`, `IV`...), genre, and crew.

Sequels carry **fatigue** (-4 quality per entry beyond #2) offset by **goodwill carryover** from previous quality (`(prevQuality - 50) / 3`). Continuity bonus for returning crew (+2 to +3 each role), recast penalty for new faces. Audience expectation tax (-6 audience if previous wasn't a hit, growing +2 per entry without a hit). Hot franchises stay hot; mediocre ones decay visibly.

A `Sequel Forecast` panel in greenlight shows all this math live with a color-coded health label.

### Franchise acquisitions

Dormant franchises (5+ years since last entry, at least one hit OR avg quality ≥60) periodically attract bids from major studios. Generation is rate-limited (~1.5% per eligible franchise per week, capped at 2 pending offers). Offer amount is roughly 30% of lifetime gross (dampened by years dormant) plus $500K per hit. Cleaner numbers; 8 weeks to decide.

Accepting transfers the rights, removes the franchise from your roster, and adds it to `soldFranchises` for the historical record. Declining is free. UI lives at the top of the Franchises view in a gold-bordered alert when offers are active.

### Genre specialization

Each released film increments `genreCredits[genre]`. Three tiers:

- **Working In [Genre]** at 3 films: +2 quality, +5% offer probability
- **[Genre] Specialist** at 6 films: +5 quality, +3 audience, +12% offer prob
- **[Genre] Icon** at 10 films: +8 quality, +5 audience, +20% offer prob, 1.2× fame, +30% studio budget cap for that genre

Icons working *outside* their specialty take -2 quality / -3 audience. There's a real trade-off between dominating one genre and diversifying.

The casting board adds bonus listings in your specialty genre (one extra per active specialty) and tags them "Your wheelhouse."

### Persistent world NPCs

A pool of ~12 named industry figures seeded at game start. Each has a name, archetype ("Method Star," "Awards Magnet," "Action Hero"...), role, age, skill, fame, trajectory (rising/declining), and a personal history log. They appear:

- In award ceremonies (as competing nominees and winners)
- In casting boards (attached to offers/auditions)
- In studio greenlight crew (when you produce)
- In tabloid events (rivals, friend reunions)
- In the dating pool (high-friendship NPCs)
- As first-look deal partners
- As mentees (rising up-and-comers)
- As co-producing directors

NPCs age each year, accumulate careers, retire at 65+. The pool is maintained — when active NPCs drop below 8, new up-and-comers spawn.

**Rivalry and friendship.** Each NPC has a `rivalryScore` and `friendshipScore` relative to the player. Award losses build rivalry. Hit collaborations build friendship. Marriage gives +5 friendship. Divorce gives -3 friendship and +2 rivalry. These scores drive:

- Chemistry bonus in `simulateMovie` (+3 per friend NPC in crew, capped at +6 total)
- Rivalry penalty (-2 per rival, capped at -5)
- Tabloid event eligibility (some events require named rivals or friends)
- "Cast a Friend" button in greenlight
- Rival callouts in award ceremony when you lose to them
- Cameo offer eligibility (friendshipScore ≥ 3)
- Co-producing director attachment (avoids rivals)

### First-look deals

You can sign annual retainers with director NPCs from the Industry view. Cost scales with the NPC's fame and skill — a fame-30 working director costs ~$250K/year; a fame-90 award-magnet costs $1M+/year. Auto-renews at the *current* retainer (the NPC may have moved up since you signed). Manually cancellable.

While the deal is active, each week-advance rolls a ~5% chance for a pitch from that NPC. Each pitch carries a procedurally generated title, premise (era-appropriate), genre, and suggested budget. The player can:

- **Develop It** — routes directly into greenlight as a producer-only project with the NPC director pre-attached
- **Pass** — minor friendship hit (-0.3), the NPC shops it elsewhere

Capped at 3 pending pitches.

### Mentorship

Late-career system. Player eligibility: fame ≥ 60, age ≥ 45, history ≥ 5 films. Mentee eligibility: age 22–32, fame ≤ 25, rising trajectory, not retired.

In the Industry view, eligible NPC cards show a "Take Under Wing — Mentor Them" button. Up to 2 active mentorships at a time.

Each mentorship session: 1 week of game time, $0 cost. Gives the mentee +1 skill, +0.5 fame, +0.5 friendship with you, locks their trajectory to rising. Gives you +0.5 reputation in their specialty role. Capped at 5 sessions per year per mentee.

A useEffect checks mentorships each year:
- **Graduated** if mentee reaches fame 60 (the threshold for "made it"). Mentee enters `mentoredAlumni`, friendship floor locks to 5, NPC's history records "Mentored by [Player]".
- **Aged out** if 5 years pass without graduation.
- **NPC retired/missing** → auto-aged-out.

Career History records each graduation as a "🎓 Mentored [Name]" milestone with year span and session count.

### Co-producing (Producer-on-Hire)

The fourth money system, alongside reserves, director's cut residuals, and main-film production. Eligibility: cash ≥ $500K, 5+ films, producer reputation ≥ 15.

Other studios pitch you producer-on-hire roles, generated periodically with rate scaled by your producer rep. Each offer carries: originating studio, procedurally generated title and premise, total budget (scales with player rep), your capital commitment (20–40% of budget), your profit share (commitment % + 5% producer fee), an attached NPC director, and a quality projection.

Accept → commitment deducted immediately, project enters `coProductions` queue with ~50-week settlement window. You make no production decisions. When the settlement date hits, the film simulates with the attached director's skill plus reasonable crew defaults. Your share of revenue is paid (rough domestic-rentals-to-box-office ratio applied). Hit/flop affects producer reputation (+2 / -1).

UI in a hub CollapsiblePanel shows pending offers (full pitch + accept/decline), active co-productions (release countdown), and last 5 settled (color-coded P&L).

### Cameo offers

When you have friend NPCs (friendshipScore ≥ 3), they occasionally invite you for a one-day on-screen cameo. Generated at ~3% per friend per week, capped at 12% total and 3 pending offers. Each cameo:

- **Do it (1 wk)** — +2 fame, +1 friendship with that NPC, 1 week passes
- **Pass** — -0.5 friendship, no other cost

Filler activity between big projects. Maintains relationships, accumulates fame, feels appropriate for the rhythm of an active career.

### Comeback arc

Activated automatically two ways:
- **Major flop:** budget ≥ $20M and audience score < 35 at release
- **Inactivity:** 78 weeks (18 months) since last release, requires 3+ prior films

While in comeback state, the StatsBar shows "⚠ COMEBACK" under Personal. The next release resolves it:
- **Hit** → +5 bonus fame, "🎉 The comeback is real" log
- **Flop** → "didn't take, back to square one" log
- **Middling** → "decent — back to work" log

State clears either way. Creates a real "stakes" frame around the next picture after a setback.

### Tabloid system

Every week-tick rolls for a tabloid event. Base chance scales with fame (~2% to ~18% per week at fame 100). 59 events span the full fame range, from "casting couch rumor" at fame 0 to "lifetime achievement buzz" at fame 75+. Events have tiers (fame ranges), conditions (requires marriage, requires film, requires a named rival, etc.), weights for selection, headline+flavor templates, and 2–4 choices with their own effects and outcomes.

Some events generate **chain events** — a follow-up that fires the next week. Others modify `worldNPCs` directly (escalating or cooling a feud, building or breaking a friendship).

Archive entries record the headline, your choice, the outcome, and the NPC mentioned (if any). The system has memory: appearing in a story with the same NPC twice prepends "ROUND TWO:" to the headline. Three times: "AGAIN!" Four+: "IT NEVER ENDS:".

### Plant a Story

Once the player has the Publicist team buff, they can proactively plant positive stories from the Press Clippings view. 17 plant templates available, each with a cost ($5K–$40K), a backfire chance (the press sees through it), and a positive outcome on success. 4-week cooldown.

Templates range from cheap "hometown visit" stories to expensive "secret screenwriter" reveals. Higher-cost plants have bigger backfire risk and more dramatic outcomes both ways.

### Awards

Three award bodies model the real ones loosely:

- **Critics' Circle** (early in the year) — early-year recognition, smaller fame bump
- **Golden Globe** (mid-year) — middle weight
- **Academy Award** (late in the year) — biggest prestige

Each year, eligible films (released that year) are evaluated. The player's films compete against phantom NPC films generated to match the year's tier. The AwardCeremonyModal shows nominations first, then winners, with rival callouts when you lose to a known NPC.

**Below-the-line craft awards** run alongside the main four: Cinematography, Film Editing, Original Score, Costume Design, Sound Design, Art Direction, Visual Effects. Each picks a winner from the eligible pool weighted by quality × genre affinity × body prestige. When a player-directed film wins a craft award: +1 director reputation per win + small fame trickle. Display section labeled "✦ Earlier That Evening — Below-the-Line ✦" groups them by film. Player films highlighted in gold.

### Lifetime Achievement Award

Fires once per career when fame ≥ 85, age ≥ 60, history ≥ 10 films. Gold-bordered ceremony modal showing years active, films, peak fame, award wins. Flavored as a 6-minute standing ovation with a clip reel.

**Permanent effect:** fame floor of 60. Once received, fame clamps to `[60, 100]` instead of `[0, 100]` in `advanceWeek`. Inactivity decay, scandals, and burnout can't drop you below 60 ever again.

### Personal life

Dating pool with anonymous matches and (sometimes) high-friendship world NPCs. Marriage costs $50K and gives a fame bump. Power couple status (both partners famous) gives passive fame. Relationship health decays slowly and can recover with date nights. Children cost weekly upkeep and provide some passive fame. Divorce is expensive (20% of cash) and creates a long scandal.

**Vow renewals** unlock at 10+ years married AND 10+ years since last renewal. Costs $30K, resets relationshipHealth to 95, +2 fame.

### The Boulevard (shop)

Items in four categories:

- **Lifestyle**: homes, vehicles. Passive fame, status.
- **Team**: agent, publicist, manager, writers' room, etc. Gameplay buffs.
- **Studio upgrades**: backlot, sound stage, etc. Production buffs, larger budget caps.
- **Indulgences**: one-off purchases for fame/morale.

Items have prices, weekly upkeep, and gated requirements (fame, reputation, studio ownership).

### Studio reserves

Once a studio is founded, the player can park money in studio reserves earning 0.1%/week (~5.2% annualized). Reserves are locked during active production. UI: deposit/withdraw panel with quick presets.

### The four money systems

A complete economic spectrum spans the late game:

| System | Risk | Yield | Player Involvement |
|---|---|---|---|
| **Studio Reserves** | None | 5%/year | Set and forget |
| **Director's Cut** | Low | Modest, capped | Active choice on old films |
| **Co-Producing** | Medium | High variance | Pick the bet, then wait |
| **Make Your Own Film** | Maximum | Maximum | Every decision matters |

### Retirement and legacy

When the player has 5+ films or is 50+, they can retire. The `calcLegacy` function tallies:

- **Box Office** (0–50): lifetime gross / $10M, capped
- **Awards** (0–60): wins × 8 + extra noms × 2
- **Peak Fame** (0–40): peakFame × 0.4
- **Empire** (0–40): studio +20, franchises × 5
- **Body of Work** (0–30): films × 1.5

Tiers: Forgotten / Bit Player / Working / Established / Acclaimed / Legend. A preview shows on the retirement confirm screen.

### Multi-generation play

When the player retires and starts a new career, the world persists. World legends carry forward (up to 5 saved). Time jumps ~30 years per generation. The new player starts in a world where the previous generation's defining films are remembered. A "Previously, in Your Hollywood Story..." screen runs at the start of Gen 2+ careers.

---

## File layout

```
hollywood-tycoon/
├── README.md (this file)
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx (mounts <App />)
    └── App.jsx (everything else, ~14,000 lines)
```

`App.jsx` sections in rough order:

1. **Utilities** — `clamp`, `pick`, `randInt`, `fmtMoney`, `generateName`, `generateTitle`, `toRoman`
2. **Save/load** — `unpackSave`, `autoSave`, `loadAutoSave`, manual slots, world state
3. **Constants** — roles, genres, award bodies, award categories, craft awards, festivals
4. **Player initialization** — `initialPlayer`
5. **Simulation engine** — `simulateMovie` (the core quality + box office formula)
6. **Festival acceptance** — `festivalAcceptanceChance`
7. **Personal life** — `personalBuffs`, dating pool generation, partner generation
8. **Tabloid system** — `TABLOID_EVENTS` (59 events), `PLANT_STORIES` (17 plants), `chooseTabloidEvent`, headline generator
9. **World NPCs** — `seedWorldNPCs`, `tickWorldNPCs`, `pickWorldNPC`, `maintainWorldPool`
10. **Awards** — `runAwardBody`, phantom film generation, `extractPlayerAwards`, `evaluateCraftAwards`
11. **Career derivation** — `deriveCareerHistory`, `calcLegacy`, world evolution
12. **Purchases** — `PURCHASES` catalog, `ownedBuffs`
13. **Genre specialization** — `getGenreSpecialty`, `allSpecialties`, `genreSpecialtyEffects`
14. **CSS** — `STYLES` template literal
15. **UI components** — Panel, CollapsiblePanel, Tooltip, StatsBar, SkillsPanel, ReservesPanel, FirstLookPanel, MentorshipPanel, CoProducingPanel, CameoOffersPanel, CrewAttached, etc.
16. **Views** — StartScreen, MainGame and all the view sub-components
17. **Modals** — TabloidEventModal, AwardCeremonyModal, YearInVarietyModal, OpeningWeekendModal, FilmChartModal (with Director's Cut), LifetimeAchievementModal
18. **Root** — App, ResumeScreen

---

## Extending the game

### Adding a tabloid event

Append to `TABLOID_EVENTS` near the appropriate fame tier. Schema:

```js
{
  id: 'unique_id',
  tier: [minFame, maxFame],
  weight: 1.5,
  tags: ['scandal', 'rumor'],
  condition: (player) => boolean,
  headline: (player, ctx) => string,
  flavor: (player, ctx) => string,
  contextBuilder: (player) => ({ ... }),
  choices: [
    {
      label: 'Choice text',
      effects: { cash: -5000, fame: 2, scandal: { severity: 1, weeks: 3, desc: '...' }, rivalryDelta: 1 },
      outcome: 'Result text shown after choice',
      chain: 'follow_up_event_id',
    },
  ],
}
```

Effects supported: `cash`, `fame`, `energy`, `reputation`, `relationshipHealth`, `scandal`, `rivalryDelta`, `friendshipDelta`.

### Adding a plant template

Append to `PLANT_STORIES`. Schema:

```js
{
  id: 'unique_id',
  label: 'Display name',
  cost: 5000,
  fameGain: 3,
  backfireChance: 0.15,
  backfireSeverity: 0.8,
  condition: (player, production) => boolean,
  tags: ['planted', 'good'],
  headline: (p) => string,
  flavor: (p) => string,
  backfireHeadline: (p) => string,
  backfireFlavor: (p) => string,
}
```

### Adding a purchase

Append to `PURCHASES`. Schema:

```js
{
  id: 'unique',
  category: 'lifestyle' | 'team' | 'studio' | 'indulgence',
  name: 'Display name',
  price: 50000,
  weeklyUpkeep: 0,
  fameRequired: 0,
  studioRequired: false,
  effects: { fameWeekly: 0.1, energyRegenBonus: 5, ... },
  flavor: 'Italicized one-liner',
}
```

Buffs accumulate in `ownedBuffs(player)`. Add new effect keys there.

### Adding a film genre

Append to `GENRES`. The simulation doesn't gate on genre except for genre-specific specialization tracking, so a new genre Just Works. Title generation uses the genre name as a string, so colorful names produce colorful titles.

### Adding a world NPC archetype

Edit the `NPC_ARCHETYPES` and `NPC_SPECIALTIES` arrays. Archetypes affect flavor; specialties affect which role they fill.

### Adding a festival

Append to `FESTIVALS`. Schema:

```js
{
  id: 'unique',
  name: 'Full Name',
  shortName: 'Short Name',
  weekStart: 19,
  weekEnd: 21,
  location: 'City, Country',
  entryFee: 25_000,
  budgetSweetSpot: [3_000_000, 60_000_000],
  qualityThreshold: 72,
  acceptanceBase: 0.20,
  criticBoost: 18,
  audienceCost: 5,
  awardScoreBoost: 10,
  prestigeGenres: ['Drama', 'Romance'],
  blurb: 'Short pitch.',
}
```

### Adding a craft award category

Append to `CRAFT_AWARD_CATEGORIES`. Schema:

```js
{ id: 'unique', label: 'Display Name', genres: ['Drama', 'Sci-Fi'] }
```

Films matching the festival's prestige genres get a 40% weight bonus on selection.

---

## Design principles

These are the rules to keep consistent. If you extend the game, applying these will keep it feeling like the same game.

1. **It's 1985.** No anachronisms. Tabloids should sound like the era (talk shows, magazine covers, supermarket rags). Money amounts should feel period-appropriate (a $20M budget is large; $200M is huge).

2. **Realistic but fun.** Luck matters. Nothing is guaranteed. Big stars flop. Tiny indies hit. But the player's choices should *matter* — skill, marketing, and effort should shift the odds.

3. **Role-aware choices.** Only the writer chooses script tone. Only the producer chooses marketing budget. If you're acting in someone else's film, you don't get to greenlight it. Production phase choices filter on `proj.playerRoles`.

4. **Costs that matter.** Lifestyle has weekly upkeep. Children have weekly cost. Scandals drag fame. Reserves don't earn unless you put something in them. Energy isn't free. First-look retainers compound. Co-productions tie up capital.

5. **Hollywood has memory.** Persistent NPCs carry feuds across films. Tabloid events reference past stories. Award snubs build rivalries. Friendships from collaborations carry into the next picture. Mentees remember who taught them. The game should feel like a place where the same people keep showing up.

6. **The player isn't a god.** A studio mogul still loses to good rivals. A genre Icon still has bad days. Even at fame 100 with a fully buffed crew, a Heaven's Gate budget can wreck a career. Co-productions can lose money.

7. **Late game has its own texture.** Mentorship, Lifetime Achievement, Director's Cuts, franchise acquisitions, and co-producing all unlock at 45+ / fame 60+ / 5+ films. The mid- and late-career player has different concerns than the early-career one, and the game's mechanics reflect that.

8. **Generations are continuity, not reset.** When a player retires, the world persists. New generations inherit legends, name conventions, and at least an echo of the previous era. Don't introduce features that break this — every change should make sense in a world that's already 80 years old.

---

## Career-stage progression

Roughly what gets unlocked when:

- **Years 1–3** (~fame 0–25): Casting board, training, side gigs, marriage, kids
- **Years 4–7** (~fame 25–50): Studio founding ($250K + fame 25 or rep 30), franchises start, plant stories (with Publicist buff), specialty tiers begin
- **Years 8–15** (~fame 50–75): Co-producing offers (rep 15+ producer), first-look deals available, awards become consistent, Boulevard purchases scale up
- **Years 15+** (~fame 60+, age 45+): Mentorship, vow renewals (10+ years married), Director's Cuts (3+ year old films), franchise acquisition offers
- **Late career** (fame 85+, age 60+, 10+ films): Lifetime Achievement Award with permanent fame floor

---

## Known limitations

- **The single-file architecture** has scaling limits. At ~14,000 lines, splitting `App.jsx` into modules (engine, views, components, data) would help maintainability if you plan to keep adding systems.
- **NPC pool size** is fixed at ~12 active. A larger pool would mean richer industry texture but more compute on every refresh.
- **Award math** is approximate — phantom film generation does its best to feel real but is procedural. It won't reproduce industry politics.
- **No undo.** Every choice commits immediately. The save/load system is the only safety net.
- **Multi-tab editing** of saves isn't supported. Two open tabs will overwrite each other.
- **Co-production settlement** uses default crew assumptions (no specific NPCs beyond the director). A future version could attach specific actor/writer/producer NPCs to each co-production for richer outcomes.

---

## Version history (recent)

- **v0.27** — Producer-on-Hire system (co-productions, capital commitments, profit-share settlement)
- **v0.26** — Mentorship system (late-career, time-only investment, graduation/age-out)
- **v0.25** — Festival circuit (Sundance/Cannes/Venice/Toronto, acceptance algorithm, awards integration)
- **v0.24** — First-look deals (annual NPC director retainers, pitch generation, develop/pass)
- **v0.23** — Director's Cut re-releases (3+ year old films, quality-weighted bumps)
- **v0.22** — Below-the-line craft awards, comeback arc, franchise acquisitions
- **v0.21** — Box office milestones, Lifetime Achievement, vow renewals, cameo offers
- **v0.20** — Hyphenate milestones (Triple/Quadruple Threat, role debuts, hyphenate combos)
- **v0.19** — 30 new tabloid events + 10 plant templates (now 59 + 17 total)
- **v0.18** — iPad Pro 13" touch optimization
- **v0.17** — Collapsible hub, energy/burnout system, Year in Variety, studio reserves
- **v0.16** — Casting filters, sequel forecast, career charts, tooltips, retirement preview
- **v0.15** — Balance tuning (inactivity decay, big-budget risk, sequel fatigue, rival callouts)

---

## License

Personal project. Use it however you like.
