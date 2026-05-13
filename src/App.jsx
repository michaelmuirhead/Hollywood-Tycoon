import React, { useState, useEffect, useMemo } from 'react';

// ============================================================
// HOLLYWOOD TYCOON
// A career/business sim set in the film industry
// ============================================================

// ---------- CONSTANTS / DATA ----------

const ROLES = ['actor', 'director', 'producer', 'writer'];

const ROLE_LABELS = {
  actor: 'Actor',
  director: 'Director',
  producer: 'Producer',
  writer: 'Writer',
};

const GENRES = [
  'Drama', 'Comedy', 'Action', 'Horror', 'Sci-Fi',
  'Romance', 'Thriller', 'Animation', 'Indie',
];

const FIRST_NAMES = [
  'Vera', 'Marlon', 'Greta', 'Cary', 'Ingrid', 'Orson', 'Rita', 'Humphrey',
  'Ava', 'Clark', 'Audrey', 'Sidney', 'Lauren', 'Kirk', 'Joan', 'Errol',
  'Gene', 'Bette', 'Spencer', 'Hedy', 'Tyrone', 'Lana', 'Robert', 'Myrna',
];

const LAST_NAMES = [
  'Crawford', 'Sterling', 'Lamont', 'Marlowe', 'Ashby', 'Devereaux', 'Vance',
  'Holloway', 'Sinclair', 'Beaumont', 'Cassidy', 'Whitlock', 'Pemberton',
  'Castellano', 'Fairchild', 'Rourke', 'Bellamy', 'Thorne', 'Calloway',
];

const STUDIO_PREFIXES = ['Silver', 'Golden', 'Crimson', 'Sunset', 'Apex', 'Monolith', 'Pinnacle', 'Lone Star', 'Liberty', 'Empire'];
const STUDIO_SUFFIXES = ['Pictures', 'Studios', 'Films', 'Cinema', 'Productions', 'Entertainment'];

// Title generator pools
const TITLE_ADJ = ['Last', 'Silent', 'Burning', 'Hidden', 'Crimson', 'Lonely', 'Eternal', 'Restless', 'Forgotten', 'Wicked', 'Velvet'];
const TITLE_NOUN_DRAMA = ['Letter', 'Promise', 'Hour', 'Confession', 'Goodbye', 'Garden', 'Inheritance'];
const TITLE_NOUN_ACTION = ['Strike', 'Run', 'Protocol', 'Frontier', 'Reckoning', 'Hunt', 'Edge'];
const TITLE_NOUN_HORROR = ['Whisper', 'House', 'Mirror', 'Ritual', 'Shadow', 'Visitor', 'Lullaby'];
const TITLE_NOUN_SCIFI = ['Signal', 'Station', 'Horizon', 'Quantum', 'Beacon', 'Vector', 'Drift'];
const TITLE_NOUN_GENERIC = ['Affair', 'Story', 'Game', 'Dream', 'Echo', 'Stranger', 'Heart'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function toRoman(n) {
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romans[n] || String(n);
}
function fmtMoney(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

// ---------- SAVE / LOAD ----------
//
// Storage strategy:
// - localStorage for daily auto-save and three manual save slots
// - JSON export/import for cross-device sharing (and for the in-chat artifact
//   where localStorage may be unavailable)
// - Schema version embedded in the save so future versions can migrate or warn

const SAVE_SCHEMA_VERSION = 1;
const AUTOSAVE_KEY = 'hollywoodTycoon:autosave';
const SLOT_KEY_PREFIX = 'hollywoodTycoon:slot:';

// Detect localStorage availability (artifacts may sandbox it)
function hasLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem('__ht_test__', '1');
    localStorage.removeItem('__ht_test__');
    return true;
  } catch {
    return false;
  }
}

function packSave(player) {
  return {
    schema: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    player,
  };
}

function unpackSave(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.player) return null;
  const p = raw.player;
  // Defensively backfill any missing fields from older saves
  return {
    ...p,
    personal: p.personal || {
      status: 'single', partner: null, partnerHistory: [], children: [],
      relationshipHealth: 100, lastDateNight: null,
    },
    scandals: p.scandals || [],
    tabloidHistory: p.tabloidHistory || [],
    franchises: p.franchises || {},
    awards: p.awards || { nominations: 0, wins: 0, history: [] },
    inTheaters: p.inTheaters || [],
    possessions: p.possessions || [],
    indulgenceCounts: p.indulgenceCounts || {},
    history: p.history || [],
    log: p.log || [],
    pendingEvent: p.pendingEvent || null,
    pendingChain: p.pendingChain || null,
    lastPlantedAt: p.lastPlantedAt || null,
    activeProduction: p.activeProduction || null,
    worldNPCs: p.worldNPCs || seedWorldNPCs(p.year || 1985),
    lastNPCTickYear: p.lastNPCTickYear || p.year || 1985,
    legacy: p.legacy || null,
    status: p.status || 'active',
    // If genreCredits missing, reconstruct from film history
    genreCredits: p.genreCredits || (() => {
      const counts = {};
      for (const f of (p.history || [])) {
        counts[f.genre] = (counts[f.genre] || 0) + 1;
      }
      for (const f of (p.inTheaters || [])) {
        counts[f.genre] = (counts[f.genre] || 0) + 1;
      }
      return counts;
    })(),
    inheritedLegends: p.inheritedLegends || [],
    generation: p.generation || 1,
    burnoutWeeks: p.burnoutWeeks || 0,
    cameoOffers: p.cameoOffers || [], // pending cameo offers from friend NPCs
    comebackState: p.comebackState || null, // { reason, sinceYear, sinceWeek } when in comeback eligibility
    franchiseAcquisitionOffers: p.franchiseAcquisitionOffers || [], // dormant franchises being shopped by major studios
    soldFranchises: p.soldFranchises || [], // franchises sold to other studios — historical record
    firstLookDeals: p.firstLookDeals || [], // active first-look retainers with NPC directors
    firstLookPitches: p.firstLookPitches || [], // pending project pitches from first-look NPCs
    mentorships: p.mentorships || [], // active mentorship arrangements with NPC up-and-comers
    mentoredAlumni: p.mentoredAlumni || [], // graduated mentees — for career history & legacy
    coProducingOffers: p.coProducingOffers || [], // pending producer-on-hire offers
    coProductions: p.coProductions || [], // films you have capital invested in, awaiting release
    coProductionsHistory: p.coProductionsHistory || [], // settled co-productions — for history
  };
}

function autoSave(player) {
  if (!hasLocalStorage() || !player) return;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(packSave(player)));
  } catch {
    // Storage may be full or sandboxed — silent fail
  }
}

function loadAutoSave() {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return unpackSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveToSlot(slot, player, label) {
  if (!hasLocalStorage()) return false;
  try {
    const pack = packSave(player);
    pack.label = label || `${player.name} · ${player.year}`;
    localStorage.setItem(SLOT_KEY_PREFIX + slot, JSON.stringify(pack));
    return true;
  } catch {
    return false;
  }
}

function loadFromSlot(slot) {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(SLOT_KEY_PREFIX + slot);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deleteSlot(slot) {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.removeItem(SLOT_KEY_PREFIX + slot);
    return true;
  } catch {
    return false;
  }
}

// Export current state as a downloadable JSON file
function exportSaveAsFile(player) {
  try {
    const pack = packSave(player);
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (player.name || 'career').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `hollywood-tycoon-${safeName}-${player.year}-w${player.week}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

// Parse a pasted JSON string back into a player
function importSaveFromText(text) {
  try {
    const pack = JSON.parse(text);
    return unpackSave(pack);
  } catch {
    return null;
  }
}

// ---------- MULTI-GENERATION WORLD STATE ----------
//
// When a player retires and starts a new career, the world persists:
// NPCs continue aging, legends are remembered, the industry evolves.

const WORLD_KEY = 'hollywoodTycoon:world';

function loadWorldState() {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(WORLD_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveWorldState(state) {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.setItem(WORLD_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// When a player retires, fold their career into the world state.
// The new player will inherit aged NPCs and a Legends Hall.
function evolveWorldForNewGeneration(retiredPlayer, yearsToSkip = 3) {
  const newStartYear = retiredPlayer.year + yearsToSkip;
  // Age all NPCs through the gap years
  let npcs = retiredPlayer.worldNPCs || {};
  for (let y = retiredPlayer.year + 1; y <= newStartYear; y++) {
    npcs = tickWorldNPCs(npcs, y);
    npcs = maintainWorldPool(npcs, y);
  }

  // Capture the retired player as a Legend in the world state
  const legend = {
    name: retiredPlayer.name,
    startingRole: retiredPlayer.startingRole,
    yearsActive: `${retiredPlayer.startYear || 1985}–${retiredPlayer.year}`,
    legacyTier: retiredPlayer.legacy?.tier?.label || 'Working Pro',
    legacyScore: retiredPlayer.legacy?.score || 0,
    bestFilm: retiredPlayer.legacy?.bestFilm?.title || null,
    awards: retiredPlayer.awards?.wins || 0,
  };

  const existing = loadWorldState() || { legends: [], generation: 1 };

  return {
    worldNPCs: npcs,
    newStartYear,
    legends: [...(existing.legends || []), legend],
    generation: (existing.generation || 1) + 1,
  };
}

function generateName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function generateStudioName(playerName) {
  // Sometimes use player's last name
  if (Math.random() < 0.4 && playerName) {
    const last = playerName.split(' ').pop();
    return `${last} ${pick(STUDIO_SUFFIXES)}`;
  }
  return `${pick(STUDIO_PREFIXES)} ${pick(STUDIO_SUFFIXES)}`;
}

function generateTitle(genre) {
  let nouns;
  switch (genre) {
    case 'Drama': case 'Romance': nouns = TITLE_NOUN_DRAMA; break;
    case 'Action': case 'Thriller': nouns = TITLE_NOUN_ACTION; break;
    case 'Horror': nouns = TITLE_NOUN_HORROR; break;
    case 'Sci-Fi': nouns = TITLE_NOUN_SCIFI; break;
    default: nouns = TITLE_NOUN_GENERIC;
  }
  const patterns = [
    () => `The ${pick(TITLE_ADJ)} ${pick(nouns)}`,
    () => `${pick(TITLE_ADJ)} ${pick(nouns)}`,
    () => `${pick(nouns)} of ${pick(LAST_NAMES)}`,
    () => `A ${pick(TITLE_ADJ)} ${pick(nouns)}`,
  ];
  return pick(patterns)();
}

// ---------- GAME LOGIC ----------

function initialPlayer(name, startingRole, inheritedWorld = null) {
  const skills = { actor: 5, director: 5, producer: 5, writer: 5 };
  const reputation = { actor: 0, director: 0, producer: 0, writer: 0 };
  skills[startingRole] = 15;
  const startYear = inheritedWorld?.newStartYear || 1985;
  return {
    name,
    startingRole,
    startYear,
    age: 22,
    year: startYear,
    cash: 5000,
    skills,
    reputation,
    fame: 0, // 0-100, overall stardom
    peakFame: 0, // highest fame ever reached
    lifetimeEarnings: 0, // every dollar that came in
    energy: 100,
    burnoutWeeks: 0,
    week: 1,
    studio: null, // becomes object when player founds one
    log: [],
    history: [], // released movies (closed runs)
    inTheaters: [], // films currently playing — with ongoing weekly grosses
    pendingProject: null, // a movie offered/being made
    achievements: [],
    possessions: [], // ids from PURCHASES catalog
    indulgenceCounts: {}, // {id: count} for one-shot purchases tracking
    genreCredits: {}, // { Drama: 3, Horror: 1, ... } — counts of films per genre for specialization
    // ---- Awards tracking ----
    awards: {
      nominations: 0,
      wins: 0,
      // Per-body, per-category history. Stored as a flat list for simplicity:
      // [{ year, body, category, role, film, won }]
      history: [],
    },
    lastAwardsYear: null, // which year's awards have been processed
    // ---- Personal life ----
    personal: {
      status: 'single', // single | dating | engaged | married | divorced | widowed
      partner: null,    // { name, isStar, fame, occupation, since: {year, week} }
      partnerHistory: [], // [{ name, started, ended, reason, isStar }]
      children: [],     // [{ name, born: year }]
      relationshipHealth: 100, // 0-100, decays over time without attention
      lastDateNight: null, // {year, week}
    },
    scandals: [],       // [{ id, type, severity, started: {year, week}, expires: {year, week}, description }]
    pendingEvent: null, // a tabloid/life event awaiting player response
    pendingChain: null, // a queued follow-up event from a prior choice (fires next advance)
    tabloidHistory: [], // [{ year, week, eventId, headline, choice, outcome }] for archive
    lastPlantedAt: null, // {year, week} of last planted story — for 4-week cooldown
    franchises: {},     // { [franchiseId]: { id, title, entries: [filmTitle...], rootCrew, ownerIsPlayer, originalGenre, lastEntryYear } }
    worldNPCs: inheritedWorld?.worldNPCs || seedWorldNPCs(startYear), // persistent industry figures who age + accumulate careers
    lastNPCTickYear: startYear,
    inheritedLegends: inheritedWorld?.legends || [], // legends from past careers in this world
    generation: inheritedWorld?.generation || 1,
    legacy: null,       // populated on retirement: { score, defining*, summary }
    status: 'active',   // active | retired
    cameoOffers: [],    // pending cameo offers from friend NPCs
    comebackState: null, // { reason: 'flop'|'inactivity', sinceYear, sinceWeek }
    franchiseAcquisitionOffers: [], // dormant franchises being shopped
    soldFranchises: [], // history of sold franchises
    firstLookDeals: [], // active first-look retainers
    firstLookPitches: [], // pending pitches from first-look NPCs
    mentorships: [], // active mentorships
    mentoredAlumni: [], // graduated mentees
    coProducingOffers: [],   // pending producer-on-hire offers
    coProductions: [],       // accepted, in-production
    coProductionsHistory: [], // settled (released)
  };
}

// Compute a movie's outcome based on skills, marketing, luck
function simulateMovie(project, player, ownStudio = false) {
  const {
    genre, budget, marketing,
    actorSkill, directorSkill, producerSkill, writerSkill,
    actorRep, directorRep, producerRep, writerRep,
    // Production modifiers — accumulated from preprod/filming/postprod phases
    qualityMod = 0,        // +/- to final quality
    marketingMod = 1.0,    // multiplier on marketing effectiveness (1.0 = neutral)
    costOverrun = 0,       // extra production cost from filming events
    // Franchise modifiers — set by sequel builder
    franchise = null,      // { id, entry, rootCrew, prevEntryQuality, prevEntryHit, continuityScore, recastPenalty }
  } = project;

  // Quality is weighted by role contributions
  // Writer & director matter most for quality; actor draws audience; producer manages budget/efficiency
  const craftScore =
    writerSkill * 0.32 +
    directorSkill * 0.30 +
    actorSkill * 0.22 +
    producerSkill * 0.16;

  // Add reputation halo (smaller effect)
  const repBonus = (writerRep + directorRep + actorRep + producerRep) / 4 * 0.15;

  // Luck factor +/- 15
  const luck = randInt(-15, 15);

  // Franchise quality modifiers
  let franchiseQualityMod = 0;
  let franchiseAudienceMod = 0;
  let franchiseCriticMod = 0;
  let franchiseBoxMultiplier = 1.0;

  if (franchise && franchise.entry > 1) {
    // Continuity bonus: each retained key role (vs the original) adds quality
    franchiseQualityMod += (franchise.continuityScore || 0); // 0 to 9 typically
    // Recast penalty hits audience score
    franchiseAudienceMod -= (franchise.recastPenalty || 0); // 0 to 8

    // Sequel fatigue: each entry beyond 2 drains quality unless prev was great
    // Steeper than before (was 3, now 4 per entry beyond #2)
    const fatigue = Math.max(0, franchise.entry - 2) * 4;
    // Goodwill carryover from previous entry — high prev quality reduces fatigue
    // Was (prevQuality - 60) / 4, now (prevQuality - 50) / 3 — wider band, more impact
    const prevGoodwill = franchise.prevEntryQuality
      ? Math.max(0, (franchise.prevEntryQuality - 50) / 3)
      : 0;
    franchiseQualityMod -= Math.max(0, fatigue - prevGoodwill);

    // Audience expectation tax — sequels are held to a higher bar
    // Steeper if previous wasn't a hit
    if (!franchise.prevEntryHit) {
      // For 3+ entries without a hit, the tax grows
      const noHitPenalty = 6 + Math.max(0, franchise.entry - 3) * 2;
      franchiseAudienceMod -= noHitPenalty;
      franchiseCriticMod -= 4;
    } else {
      // Hit prequel → small penalty
      franchiseAudienceMod -= 2;
      franchiseCriticMod -= 2;
    }

    // Built-in audience: opening bonus translates to box office multiplier
    // Bigger for franchises with hot prior entries
    const hotnessBoost = franchise.prevEntryHit ? 0.45 : 0.25;
    franchiseBoxMultiplier += hotnessBoost;
  }

  // Chemistry bonus: NPCs in the crew who are friends of the player
  // contribute small audience + quality bumps (real Hollywood — repeat
  // collaborators trust each other and the work shows it)
  // Cap total chemistry at +6 so a 4-friend stable doesn't lock in films.
  let chemistryBonus = 0;
  let rivalryPenalty = 0;
  if (project.crew && player.worldNPCs) {
    for (const role of ROLES) {
      const crewMember = project.crew[role];
      if (crewMember?.npcId) {
        const npc = player.worldNPCs[crewMember.npcId];
        if (npc) {
          const friendship = npc.friendshipScore || 0;
          const rivalry = npc.rivalryScore || 0;
          // +1 quality per 2 friendship (max +3 per NPC)
          chemistryBonus += Math.min(3, friendship / 2);
          // -2 quality per 3 rivalry (rivals working together is friction)
          rivalryPenalty += Math.min(2, rivalry / 3);
        }
      }
    }
  }
  // Total chemistry caps at +6 (strong but not dominating)
  chemistryBonus = Math.min(6, chemistryBonus);
  // Rivalry penalty caps at -5
  rivalryPenalty = Math.min(5, rivalryPenalty);

  // Genre specialty effects
  const specEffects = genreSpecialtyEffects(player, genre);

  const rawQuality = craftScore + repBonus + luck + qualityMod + franchiseQualityMod + chemistryBonus - rivalryPenalty + specEffects.quality;
  const quality = clamp(rawQuality, 1, 100);

  // Critic score skews toward craft + writer/director
  const criticBase = quality * 0.9 + (writerSkill + directorSkill) * 0.1 + randInt(-8, 8) + franchiseCriticMod;
  const criticScore = clamp(Math.round(criticBase), 1, 100);

  // Audience leans on actor + genre fun
  const audienceBase = quality * 0.7 + actorSkill * 0.3 + randInt(-10, 10) + franchiseAudienceMod + specEffects.audience;
  const audienceScore = clamp(Math.round(audienceBase), 1, 100);

  // Box office model
  // Budget multiplier soft-caps above $100M — mega-budgets stop scaling
  // (real-world: a $200M film doesn't open 4× a $50M one)
  let budgetMultiplier;
  if (budget <= 100_000_000) {
    budgetMultiplier = Math.log10(budget / 100000 + 1) + 1;
  } else {
    // Above $100M, log decays sharply
    const base = Math.log10(100_000_000 / 100000 + 1) + 1; // ~4.0
    const overage = (budget - 100_000_000) / 100_000_000;
    budgetMultiplier = base + Math.log10(overage + 1) * 0.4;
  }
  // Marketing effectiveness boosted/dampened by marketingMod (press tours, etc.)
  const effectiveMarketing = marketing * marketingMod;
  const marketingEffect = Math.log10(effectiveMarketing / 50000 + 1) + 1;
  const starPower = (player.fame / 100) * 0.5 + (actorRep / 100) * 0.5 + 0.5;
  // Review multiplier — punish bad reviews harder, especially at high budget
  // A $150M film with mid reviews can collapse; a $5M film with mid reviews still does okay
  let reviewMultiplier = (criticScore * 0.4 + audienceScore * 0.6) / 50;
  if (budget > 40_000_000 && reviewMultiplier < 1.0) {
    // Quadratic-ish punishment scaled by how big the budget is
    const budgetScale = Math.min(2.0, budget / 50_000_000);
    reviewMultiplier = Math.pow(reviewMultiplier, 1 + (budgetScale - 1) * 0.5);
  }
  const genreLuck = 0.8 + Math.random() * 0.6;

  let boxOffice = budget * budgetMultiplier * marketingEffect * starPower * reviewMultiplier * genreLuck * 0.55 * franchiseBoxMultiplier;
  boxOffice = Math.round(boxOffice);

  const totalCost = budget + marketing + costOverrun;
  const profit = boxOffice - totalCost;

  const skillGains = { actor: 0, director: 0, producer: 0, writer: 0 };
  const repGains = { actor: 0, director: 0, producer: 0, writer: 0 };

  for (const role of project.playerRoles) {
    skillGains[role] = randInt(1, 3);
    const repDelta = Math.round((quality - 50) / 10 + (profit > 0 ? 2 : -2));
    repGains[role] = repDelta;
  }

  const fameGain = Math.round(((criticScore + audienceScore) / 30 + (profit > 0 ? 2 : -1)) * specEffects.fameMult);

  return {
    quality: Math.round(quality),
    criticScore,
    audienceScore,
    boxOffice,
    profit,
    totalCost,
    costOverrun,
    skillGains,
    repGains,
    fameGain,
    success: profit > 0 && (criticScore > 50 || audienceScore > 60),
    hit: profit > totalCost * 1.5,
    flop: profit < -totalCost * 0.3,
  };
}

// ---------- THEATRICAL RUN MODEL ----------
//
// A movie's box office isn't one number — it's a curve over weeks.
// This function generates the weekly breakdown given total target gross,
// audience score, critic score, and genre.
//
// Different genres front-load differently:
//   horror/action: heavy front-load (~40% in week 1), fast decay
//   drama/indie: lighter front-load (~18-22%), longer tail
//   comedy/thriller: moderate (~28-32%)
//
// Decay rate per week is influenced by audience score:
//   high audience (80+): drops ~30% per week (great holds)
//   low audience (40-): drops ~55-65% per week (collapses)
//
// Awards-season buzz (nominations/wins) can spike a film back up.

function genreFrontloadProfile(genre) {
  // Returns { firstWeekShare, decayBase }
  // firstWeekShare: fraction of total that lands in week 1
  // decayBase: starting decay multiplier (lower = drops more)
  switch (genre) {
    case 'Horror':
      return { firstWeekShare: 0.42, decayBase: 0.40 };
    case 'Action':
      return { firstWeekShare: 0.38, decayBase: 0.45 };
    case 'Thriller':
      return { firstWeekShare: 0.32, decayBase: 0.50 };
    case 'Sci-Fi':
      return { firstWeekShare: 0.34, decayBase: 0.48 };
    case 'Comedy':
      return { firstWeekShare: 0.30, decayBase: 0.52 };
    case 'Animation':
      return { firstWeekShare: 0.26, decayBase: 0.58 };
    case 'Romance':
      return { firstWeekShare: 0.24, decayBase: 0.55 };
    case 'Drama':
      return { firstWeekShare: 0.20, decayBase: 0.62 };
    case 'Indie':
      return { firstWeekShare: 0.18, decayBase: 0.65 };
    default:
      return { firstWeekShare: 0.28, decayBase: 0.52 };
  }
}

function generateTheatricalRun(totalBoxOffice, audienceScore, criticScore, genre, franchise = null) {
  if (totalBoxOffice <= 0) return [];

  const profile = genreFrontloadProfile(genre);
  // Audience score modulates the decay: 80+ holds well, 40- collapses
  // Map audience [0-100] to a decay adjustment [-0.15 to +0.20]
  const audienceAdj = ((audienceScore - 60) / 100) * 0.35;
  let decayRate = clamp(profile.decayBase + audienceAdj, 0.25, 0.85);
  // Critic score gives a tiny bonus to legs (-0.05 to +0.05)
  const criticAdj = (criticScore - 60) / 1000;

  // Sequel front-loading: pre-existing audience shows up opening weekend en masse
  let firstWeekShare = profile.firstWeekShare;
  if (franchise && franchise.entry > 1) {
    // Bigger entry number = even more front-load (sequel/threequel/etc.)
    const bump = Math.min(0.18, 0.10 + franchise.entry * 0.02);
    firstWeekShare = Math.min(0.65, firstWeekShare + bump);
    // Sequels also drop faster after opening (frontload = steeper drop)
    decayRate = Math.max(0.20, decayRate - 0.05);
  }

  // Generate up to 14 weeks; stop when share falls below 0.3% of total
  const weeklyShares = [];
  let currentShare = firstWeekShare;
  let remaining = 1.0;
  for (let week = 0; week < 14; week++) {
    // Cap share by what's left
    const share = Math.min(currentShare, remaining);
    // Add small random jitter (±15%)
    const jittered = share * (0.85 + Math.random() * 0.3);
    const finalShare = Math.min(jittered, remaining);
    weeklyShares.push(finalShare);
    remaining -= finalShare;
    // Compute next week's expected share
    currentShare = currentShare * (decayRate + criticAdj);
    if (currentShare < 0.003 || remaining < 0.005) break;
  }

  // The tail (any remaining) gets dumped into a final low week
  if (remaining > 0.005) {
    weeklyShares.push(remaining);
  }

  // Convert to dollar amounts
  const weeklyGross = weeklyShares.map(s => Math.round(s * totalBoxOffice));
  // Cumulative
  const cumulative = [];
  let running = 0;
  for (const w of weeklyGross) {
    running += w;
    cumulative.push(running);
  }

  return weeklyGross.map((g, i) => ({
    weekInRun: i + 1,
    gross: g,
    cumulative: cumulative[i],
  }));
}


// Player's "heat" in a given role — used for project sizing and offer vs audition split
function playerHeat(player, roleType) {
  return player.skills[roleType] + Math.max(0, player.reputation[roleType]) + player.fame / 2;
}

// Some roles are A-list tiers (rough thresholds, in "heat" units):
//   < 30  : unknown / aspiring  (auditions only)
//   30-70 : working pro        (mostly auditions, some direct offers)
//   70-110: established        (mostly offers, some auditions for dream roles)
//   110+  : A-list             (mostly offers; auditions are competitive prestige roles)
//
// Producers are different — they pitch and finance, so they get mostly direct
// offers even early on (representing project leads coming their way).

function offerProbability(player, roleType) {
  const heat = playerHeat(player, roleType);
  if (roleType === 'producer') {
    // Producers mostly get direct offers throughout their career
    return clamp(0.6 + heat / 200, 0.6, 0.95);
  }
  if (roleType === 'writer') {
    // Writers: spec scripts early, assignments later
    if (heat < 30) return 0.05;
    if (heat < 70) return 0.25;
    if (heat < 110) return 0.6;
    return 0.85;
  }
  // Actor + director:
  if (heat < 30) return 0;       // pure unknowns audition for everything
  if (heat < 70) return 0.15;    // working pros get rare unsolicited offers
  if (heat < 110) return 0.55;   // established names get most things offered
  return 0.8;                    // A-list — mostly offered, but dream roles still audition
}

// Generate a base "project" (used by both offers and auditions)
// Optionally pulls from worldNPCs for attached talent — higher-tier projects
// are more likely to have named industry figures attached.
function generateBaseProject(player, roleType, { prestigeBias = 0, worldNPCs = null } = {}) {
  const genre = pick(GENRES);
  const heat = playerHeat(player, roleType);

  // Budget scales with how "hot" the player is, with prestige bias bumping it up
  let budget;
  const tier = heat + prestigeBias * 40;
  if (tier < 25) budget = randInt(200_000, 1_500_000);
  else if (tier < 60) budget = randInt(2_000_000, 12_000_000);
  else if (tier < 110) budget = randInt(15_000_000, 60_000_000);
  else budget = randInt(70_000_000, 220_000_000);

  // Pay scales with budget and player heat
  const payPct = 0.02 + (heat / 400);
  const pay = Math.round(budget * payPct);

  // NPC skill — for direct offers, the surrounding talent is roughly at player's level
  // For auditions, the project may have stronger attached talent
  const otherSkillBase = clamp(heat / 2 + randInt(-8, 8) + prestigeBias * 10, 10, 95);

  // Chance of a named (world) NPC being attached scales with project tier
  // Low-tier: rare. High-tier prestige: very likely.
  const namedChance = clamp(0.1 + (tier / 200) + prestigeBias * 0.3, 0.1, 0.85);

  // Try to attach a named NPC for a given role
  const tryNamed = (role) => {
    if (!worldNPCs || Math.random() > namedChance) return null;
    // Match the role's fame range to project tier
    const minFame = Math.max(0, Math.floor(tier * 0.5));
    const maxFame = 100;
    const npc = pickWorldNPC(worldNPCs, role, minFame, maxFame);
    if (!npc) return null;
    return { name: npc.name, skill: npc.skill, npcId: npc.id, archetype: npc.archetype };
  };

  // For each non-player role, try a named NPC first, fall back to generic
  const makeRole = (role) => {
    if (roleType === role) return null;
    const named = tryNamed(role);
    if (named) return named;
    return { name: generateName(), skill: clamp(otherSkillBase + randInt(-5, 5), 5, 95) };
  };

  return {
    title: generateTitle(genre),
    genre,
    budget,
    pay,
    playerRole: roleType,
    npcActor: makeRole('actor'),
    npcDirector: makeRole('director'),
    npcProducer: makeRole('producer'),
    npcWriter: makeRole('writer'),
    weeksToComplete: randInt(4, 10),
  };
}

// Generate an offer (direct, no audition)
function generateOffer(player, roleType) {
  return { ...generateBaseProject(player, roleType, { worldNPCs: player.worldNPCs }), kind: 'offer' };
}

// Generate an audition listing
// Auditions have a "competition level" — what the casting people are looking for
// The player succeeds if their relevant skill+rep+fame exceeds the threshold,
// with luck and audition-performance variance.
function generateAudition(player, roleType) {
  const heat = playerHeat(player, roleType);

  // Prestige roles audition even A-listers — boost prestige sometimes
  // for established players to represent "dream role" castings
  const isPrestige = heat > 70 && Math.random() < 0.5;
  const prestigeBias = isPrestige ? 1 : 0;

  const base = generateBaseProject(player, roleType, { prestigeBias, worldNPCs: player.worldNPCs });

  // Casting threshold: roughly what level of talent they want.
  // For aspirants (low heat), thresholds are modest. Prestige roles set higher bars.
  let threshold;
  if (isPrestige) {
    // Prestige: high bar, A-list competitors
    threshold = randInt(80, 130);
  } else if (heat < 30) {
    // Open calls — varied thresholds, often beatable
    threshold = randInt(15, 50);
  } else if (heat < 70) {
    threshold = randInt(40, 90);
  } else {
    threshold = randInt(70, 120);
  }

  // Number of other auditioning candidates (for flavor)
  const competitors = isPrestige ? randInt(3, 6) : randInt(5, 30);

  return {
    ...base,
    kind: 'audition',
    threshold,
    competitors,
    prestige: isPrestige,
    // Pay is lower for open-call auditions, but prestige roles still pay well
    pay: isPrestige ? base.pay : Math.round(base.pay * (heat < 30 ? 0.4 : 0.8)),
  };
}

// Run an audition attempt
function runAudition(player, audition) {
  const heat = playerHeat(player, audition.playerRole);

  // Skill check: roll player's "audition score" vs threshold
  // Audition performance has wide variance — nerves, chemistry, luck.
  const performance = heat + randInt(-25, 25);

  // Casting decision:
  //  - performance >= threshold + 10 → strong YES (booked)
  //  - performance >= threshold       → BOOKED
  //  - threshold-15 < performance < threshold → CALLBACK (close, but no)
  //  - else → REJECTED
  let result;
  let margin = performance - audition.threshold;
  if (margin >= 0) result = 'booked';
  else if (margin >= -15) result = 'callback';
  else result = 'rejected';

  return { result, performance, margin };
}

// ---------- AWARDS ENGINE ----------
//
// Three award bodies, each in a different week-window of awards season.
// Each body has categories. Each category nominates ~5 films, then picks a winner.
//
// Player-relevant categories check which role the player filled on the film;
// the actual nominee/winner of "Best Actor" is whoever filled the actor role
// (player or NPC). When the PLAYER held that role on a nominated/winning film,
// the player gets the nomination/win on their record.

const AWARD_BODIES = [
  {
    id: 'critics',
    name: "Critics' Circle",
    weekStart: 46,
    weekEnd: 47,
    // Pure quality, no campaign effect. Strong drama/indie bias.
    qualityWeight: 1.0,
    popularityWeight: 0,
    campaignWeight: 0,
    prestigeGenres: ['Drama', 'Indie', 'Romance'],
    genreBias: 8,
    prestige: 1.0,    // reputation multiplier on win
    categories: ['picture', 'director', 'actor', 'screenplay'],
  },
  {
    id: 'globes',
    name: 'The Golden Globes',
    weekStart: 49,
    weekEnd: 50,
    // Mixed: quality + a bit of popularity. Modest campaign effect.
    qualityWeight: 0.75,
    popularityWeight: 0.25,
    campaignWeight: 0.3,
    prestigeGenres: ['Drama', 'Comedy', 'Romance', 'Indie'],
    genreBias: 5,
    prestige: 1.4,
    categories: ['picture', 'director', 'actor', 'screenplay'],
  },
  {
    id: 'academy',
    name: 'The Academy Awards',
    weekStart: 51,
    weekEnd: 52,
    // The big one. Mostly quality, but campaigns matter a lot.
    qualityWeight: 0.85,
    popularityWeight: 0.15,
    campaignWeight: 0.7,
    prestigeGenres: ['Drama', 'Indie', 'Romance', 'Thriller'],
    genreBias: 6,
    prestige: 2.0,
    categories: ['picture', 'director', 'actor', 'screenplay'],
  },
];

const AWARD_CATEGORIES = {
  picture: { label: 'Best Picture', roleKey: null /* studio/producer credit */, articleA: 'Best Picture' },
  director: { label: 'Best Director', roleKey: 'director', articleA: 'Best Director' },
  actor: { label: 'Best Lead Performance', roleKey: 'actor', articleA: 'Best Lead Performance' },
  screenplay: { label: 'Best Screenplay', roleKey: 'writer', articleA: 'Best Screenplay' },
};

// Below-the-line craft categories. These don't compete with the player directly —
// they're awarded to films, and reflect glory on the director (when the player directed).
// Generates flavor + a small director reputation bump per win.
const CRAFT_AWARD_CATEGORIES = [
  { id: 'cinematography', label: 'Cinematography', genres: ['Drama', 'Thriller', 'Sci-Fi', 'Western', 'War'] },
  { id: 'editing', label: 'Film Editing', genres: ['Action', 'Thriller', 'Drama', 'War'] },
  { id: 'score', label: 'Original Score', genres: ['Drama', 'Romance', 'Sci-Fi', 'Adventure'] },
  { id: 'costume', label: 'Costume Design', genres: ['Drama', 'Romance', 'Period', 'Musical'] },
  { id: 'sound', label: 'Sound Design', genres: ['Action', 'Sci-Fi', 'Horror', 'War'] },
  { id: 'art_direction', label: 'Art Direction', genres: ['Drama', 'Sci-Fi', 'Period', 'Fantasy'] },
  { id: 'visual_effects', label: 'Visual Effects', genres: ['Sci-Fi', 'Action', 'Fantasy', 'Horror'] },
];

// Festival circuit — players can submit films before wide release for prestige + awards play
// at the cost of delayed release and lost opening weekend momentum.
const FESTIVALS = [
  {
    id: 'sundance',
    name: 'Sundance Film Festival',
    shortName: 'Sundance',
    weekStart: 3,
    weekEnd: 5,
    location: 'Park City, Utah',
    entryFee: 5_000,
    // Favors indie sensibilities — small budget films love it here
    budgetSweetSpot: [500_000, 8_000_000],
    qualityThreshold: 60,
    acceptanceBase: 0.4,
    criticBoost: 8,
    audienceCost: 3, // small audience hit from buzz delay
    awardScoreBoost: 4,
    prestigeGenres: ['Drama', 'Indie', 'Comedy'],
    blurb: 'Discovery festival. Indie sensibilities. Low budget films get the spotlight.',
  },
  {
    id: 'cannes',
    name: 'Festival de Cannes',
    shortName: 'Cannes',
    weekStart: 19,
    weekEnd: 21,
    location: 'Côte d\'Azur, France',
    entryFee: 25_000,
    budgetSweetSpot: [3_000_000, 60_000_000],
    qualityThreshold: 72,
    acceptanceBase: 0.20, // brutally selective
    criticBoost: 18,
    audienceCost: 5,
    awardScoreBoost: 10,
    prestigeGenres: ['Drama', 'Romance'],
    blurb: 'The global stage. Brutally selective. A Palme d\'Or-adjacent showing is career-defining.',
  },
  {
    id: 'venice',
    name: 'Venice Film Festival',
    shortName: 'Venice',
    weekStart: 35,
    weekEnd: 37,
    location: 'Venice, Italy',
    entryFee: 15_000,
    budgetSweetSpot: [2_000_000, 40_000_000],
    qualityThreshold: 68,
    acceptanceBase: 0.30,
    criticBoost: 14,
    audienceCost: 4,
    awardScoreBoost: 8,
    prestigeGenres: ['Drama', 'Romance', 'Thriller'],
    blurb: 'Auteur cinema. Awards-bait gold. European cred translates to Oscar campaigns.',
  },
  {
    id: 'toronto',
    name: 'Toronto International Film Festival',
    shortName: 'Toronto',
    weekStart: 37,
    weekEnd: 39,
    location: 'Toronto, Canada',
    entryFee: 12_000,
    budgetSweetSpot: [4_000_000, 50_000_000],
    qualityThreshold: 64,
    acceptanceBase: 0.40,
    criticBoost: 10,
    audienceCost: 2, // mild — TIFF's a populist fest
    awardScoreBoost: 6,
    prestigeGenres: ['Drama', 'Comedy', 'Romance', 'Thriller'],
    blurb: 'Populist prestige. Audience-friendly. Strong pre-buzz for a wide release.',
  },
];

// Compute a film's acceptance chance into a festival.
// Based on quality, budget sweet spot, and player fame/reputation.
function festivalAcceptanceChance(festival, film, player) {
  const q = film.qualityProjection || film.expectedQuality || 60;
  // Base chance scales with quality threshold
  let chance = festival.acceptanceBase;
  // Quality above threshold adds chance
  if (q >= festival.qualityThreshold) {
    chance += (q - festival.qualityThreshold) * 0.015;
  } else {
    // Quality below threshold tanks chance
    chance -= (festival.qualityThreshold - q) * 0.02;
  }
  // Budget sweet spot — outside it, chance drops
  const budget = film.budget || 0;
  const [lo, hi] = festival.budgetSweetSpot;
  if (budget < lo) {
    chance -= ((lo - budget) / lo) * 0.15;
  } else if (budget > hi) {
    chance -= Math.min(0.4, ((budget - hi) / hi) * 0.25);
  }
  // Genre bonus
  if (festival.prestigeGenres.includes(film.genre)) {
    chance += 0.08;
  }
  // Director reputation lifts a little
  const dirRep = player.reputation?.director || 0;
  chance += dirRep * 0.002; // up to +0.2 at rep 100
  // Existing award wins help
  chance += Math.min(0.15, (player.awards?.wins || 0) * 0.02);
  return clamp(chance, 0.02, 0.92);
}

// Evaluate craft awards for an awards ceremony. Returns:
//   { craftWins: [{ category, film, isPlayerFilm }], ... }
// Player-directed films with quality >= 75 have a chance to win each craft category,
// with genre affinity boosting the chance. Higher-quality films win more categories.
function evaluateCraftAwards(body, eligibleFilms, playerName) {
  const craftWins = [];
  // Sort films by quality (best chance first)
  const sortedFilms = [...eligibleFilms].sort((a, b) => (b.result?.quality || 0) - (a.result?.quality || 0));

  for (const cat of CRAFT_AWARD_CATEGORIES) {
    // Build candidates with weights
    const candidates = sortedFilms.map(f => {
      const q = f.result?.quality || 0;
      if (q < 50) return null; // films below quality 50 don't compete for craft awards
      const genreMatch = cat.genres.includes(f.genre) ? 1.4 : 1.0;
      // Body prestige tilts toward higher quality films
      const prestigeWeight = 1 + (body.prestige / 100) * 0.5;
      const weight = (q - 40) * genreMatch * prestigeWeight;
      return { film: f, weight: Math.max(0.1, weight) };
    }).filter(Boolean);

    if (candidates.length === 0) continue;

    // Weighted pick
    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    let winner = candidates[0];
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) { winner = c; break; }
    }

    craftWins.push({
      category: cat.id,
      categoryLabel: cat.label,
      film: winner.film,
      // Player-directed films are credited to the player's director
      isPlayerFilm: (winner.film.playerRoles || []).includes('director'),
    });
  }

  return craftWins;
}

// Compute a film's "awards score" for a given body and category.
// Higher = more likely to be nominated, and more likely to win once nominated.
function awardScoreFor(film, body, category) {
  const r = film.result;
  if (!r) return 0;

  // Base quality of the film
  const quality = r.quality || 0;
  const critic = r.criticScore || 0;
  const audience = r.audienceScore || 0;

  // Popularity proxy: box office relative to budget, capped
  const budget = film.budget || 1;
  const popRatio = Math.min(5, (r.boxOffice || 0) / budget);
  const popularity = popRatio * 20; // 0–100 scale

  // Genre bias
  const genreBonus = body.prestigeGenres.includes(film.genre) ? body.genreBias : 0;

  // For category-specific scoring, weight relevant role's skill
  let roleSkillBonus = 0;
  if (category === 'director') roleSkillBonus = (film.directorSkill || 0) * 0.15;
  else if (category === 'actor') roleSkillBonus = (film.actorSkill || 0) * 0.15;
  else if (category === 'screenplay') roleSkillBonus = (film.writerSkill || 0) * 0.18;
  else if (category === 'picture') {
    // Best Picture leans on overall quality and reviews
    roleSkillBonus = (critic * 0.05);
  }

  // Campaign effect (FYC spending), applied per body's campaignWeight
  const campaignScore = (film.fycSpend || 0) / 50000; // $50K of FYC = 1 point
  const campaignBonus = campaignScore * body.campaignWeight * 3;

  // Festival circuit boost — films that played festivals get awards momentum
  const festivalBonus = film.festivalRun ? film.festivalRun.awardScoreBoost : 0;

  // Combine
  const base =
    quality * 0.45 +
    critic * 0.30 +
    audience * 0.05 * body.popularityWeight +
    popularity * 0.10 * body.popularityWeight +
    roleSkillBonus +
    genreBonus +
    campaignBonus +
    festivalBonus;

  // Small luck so the same film doesn't sweep deterministically
  const noise = randInt(-6, 6);

  return Math.round(base * body.qualityWeight + noise);
}

// Decide nominations & winners for one award body, for a given year's films.
// `eligibleFilms` is films released that year. NPCs and player films mixed together
// — but we'll only generate NPC films as "phantom competition" if the player's
// pool is thin.
function runAwardBody(body, year, playerFilms, worldNPCs = null, addPhantomCompetition = true) {
  const results = {};

  for (const cat of body.categories) {
    // Score all player-released films for this category
    const scoredPlayerFilms = playerFilms.map(f => ({
      film: f,
      isPlayerCredit: f.playerRoles && (
        AWARD_CATEGORIES[cat].roleKey
          ? f.playerRoles.includes(AWARD_CATEGORIES[cat].roleKey)
          : (f.ownStudio || f.playerRoles.includes('producer')) // Best Picture credits producer/studio
      ),
      score: awardScoreFor(f, body, cat),
    }));

    // Generate 4 phantom NPC films as competition (so the nominees list looks alive)
    let candidates = scoredPlayerFilms.slice();
    if (addPhantomCompetition) {
      for (let i = 0; i < 4; i++) {
        candidates.push({
          film: makePhantomFilm(year, worldNPCs),
          isPlayerCredit: false,
          score: randInt(35, 90),
        });
      }
    }

    // Sort by score, take top 5 as nominees
    candidates.sort((a, b) => b.score - a.score);
    const nominees = candidates.slice(0, 5);

    // Winner: top-scored, but small upset chance based on score gap
    let winnerIdx = 0;
    if (nominees.length > 1) {
      const gap = nominees[0].score - nominees[1].score;
      // If gap small (<10), 30% upset chance
      if (gap < 10 && Math.random() < 0.3) winnerIdx = 1;
      else if (gap < 5 && Math.random() < 0.5) winnerIdx = randInt(0, Math.min(2, nominees.length - 1));
    }
    const winner = nominees[winnerIdx];

    results[cat] = {
      nominees: nominees.map(n => ({ ...n, isWinner: n === winner })),
      winner,
    };
  }
  return results;
}

// Generate a "phantom" film by an NPC for competition slots
// If worldNPCs provided, use real persistent NPCs for crew (the lead role
// at least matches the category being filled)
function makePhantomFilm(year, worldNPCs = null, categoryRole = null) {
  const genre = pick(GENRES);
  // For each crew role, try to use a world NPC; fall back to a random name
  const pickCrew = (role) => {
    if (worldNPCs) {
      const npc = pickWorldNPC(worldNPCs, role, 40, 95);
      if (npc) return { name: npc.name, skill: npc.skill, npcId: npc.id };
    }
    return { name: generateName(), skill: randInt(40, 90) };
  };
  return {
    title: generateTitle(genre),
    genre,
    year,
    isPhantom: true,
    crew: {
      actor: pickCrew('actor'),
      director: pickCrew('director'),
      writer: pickCrew('writer'),
      producer: pickCrew('producer'),
    },
    playerRoles: [],
    result: { quality: randInt(45, 90), criticScore: randInt(50, 90), audienceScore: randInt(40, 85), boxOffice: 0 },
  };
}

// Run all three bodies for a year's films, returning structured results
function runAwardsSeason(year, playerFilms, worldNPCs = null) {
  const seasonResults = [];
  for (const body of AWARD_BODIES) {
    const bodyResults = runAwardBody(body, year, playerFilms, worldNPCs);
    seasonResults.push({ body, results: bodyResults });
  }
  return seasonResults;
}

// Extract player's nominations and wins from a season's results
function extractPlayerAwards(seasonResults, year) {
  const playerEvents = []; // { body, category, film, role, won }
  for (const { body, results } of seasonResults) {
    for (const cat of Object.keys(results)) {
      const catData = results[cat];
      for (const nom of catData.nominees) {
        if (nom.isPlayerCredit) {
          const role = AWARD_CATEGORIES[cat].roleKey || 'producer';
          playerEvents.push({
            year,
            body: body.name,
            bodyId: body.id,
            category: cat,
            categoryLabel: AWARD_CATEGORIES[cat].label,
            film: nom.film.title,
            role,
            won: nom.isWinner,
            prestige: body.prestige,
          });
        }
      }
    }
  }
  return playerEvents;
}

// ---------- PERSONAL LIFE ENGINE ----------
//
// Models dating, marriage, kids, scandals, and tabloid events.
// Designed to feel like things happening *to* the character, not a stat
// to optimize, with player agency at key moments.

const PARTNER_OCCUPATIONS = [
  { label: 'Actress', isStar: true, baseFame: 50 },
  { label: 'Actor', isStar: true, baseFame: 50 },
  { label: 'Model', isStar: true, baseFame: 35 },
  { label: 'Musician', isStar: true, baseFame: 55 },
  { label: 'Director', isStar: true, baseFame: 40 },
  { label: 'Producer', isStar: true, baseFame: 30 },
  { label: 'Screenwriter', isStar: false, baseFame: 15 },
  { label: 'Studio Executive', isStar: false, baseFame: 10 },
  { label: 'Journalist', isStar: false, baseFame: 5 },
  { label: 'Architect', isStar: false, baseFame: 0 },
  { label: 'Restaurateur', isStar: false, baseFame: 0 },
  { label: 'Doctor', isStar: false, baseFame: 0 },
  { label: 'Photographer', isStar: false, baseFame: 8 },
  { label: 'Lawyer', isStar: false, baseFame: 0 },
];

const CHILD_NAMES = [
  'Sasha', 'Casey', 'Riley', 'Logan', 'Quinn', 'Avery', 'Rowan', 'Sage',
  'Iris', 'Felix', 'Theo', 'Cleo', 'Wren', 'Eliot', 'Juno', 'Hugo',
  'Lila', 'Atticus', 'Hazel', 'Milo', 'Pearl', 'Otis', 'Vera', 'Oscar',
];

// Generate a potential dating partner — tier scales with player fame
function generatePartner(player) {
  // Sometimes pull a high-friendship world NPC into the dating pool
  // (only if they're active, not retired, not currently a partner, and reasonably close in age)
  const friends = Object.values(player.worldNPCs || {})
    .filter(n => {
      if (n.status !== 'active') return false;
      if ((n.friendshipScore || 0) < 2) return false;
      // Reasonably close in age (within 18 years)
      if (Math.abs((n.age || 30) - player.age) > 18) return false;
      // Not the current partner
      if (player.personal?.partner?.npcId === n.id) return false;
      // Not a past partner
      if ((player.personal?.partnerHistory || []).some(h => h.npcId === n.id)) return false;
      return true;
    });

  // Friends with friendship 3+ have a ~40% chance of being in the dating pool
  if (friends.length > 0 && Math.random() < 0.35) {
    const npc = friends.sort((a, b) => (b.friendshipScore || 0) - (a.friendshipScore || 0))[0];
    return {
      name: npc.name,
      occupation: npc.roleLabel,
      isStar: true, // world NPCs are always industry
      fame: npc.fame,
      npcId: npc.id, // tag this partner so we can update worldNPCs on relationship events
      archetype: npc.archetype,
    };
  }

  // Fallback: generate a fresh anonymous partner
  const heat = player.fame;
  const starChance = clamp(0.2 + heat / 150, 0.2, 0.85);
  const occ = Math.random() < starChance
    ? pick(PARTNER_OCCUPATIONS.filter(o => o.isStar))
    : pick(PARTNER_OCCUPATIONS.filter(o => !o.isStar));
  const fame = clamp(Math.round(occ.baseFame + randInt(-15, 15) + heat / 6), 0, 100);
  return {
    name: generateName(),
    occupation: occ.label,
    isStar: occ.isStar,
    fame,
  };
}

// ---------- TABLOID HEADLINE GENERATOR ----------
//
// Tabloid headlines have a grammar: a verb in caps, sometimes a punchy prefix,
// sometimes a comma-spliced reaction. e.g.:
//   "STAR-STRUCK: VERA STERLING SEEN WITH MARLON CRAWFORD"
//   "MELTDOWN! 'HIDDEN PROMISE' STAR STORMS OFF SET"
//   "TROUBLE IN PARADISE? CLAUDIA MARLOWE SPOTTED CRYING"
//
// Headlines are generated procedurally so even the same event template
// produces fresh-feeling press coverage.

const TABLOID_PREFIXES = [
  "EXCLUSIVE", "SHOCKER", "BUSTED", "EXPOSED", "INSIDE STORY",
  "SCANDAL", "MELTDOWN", "OH NO", "SAY IT AIN'T SO",
  "TROUBLE IN PARADISE", "STAR-STRUCK", "CAUGHT", "GUESS WHO",
];

const TABLOID_NICKNAMES = [
  "the star", "the leading {role}", "the {genre} fixture", "Hollywood's favorite",
  "the {studio} mainstay", "the Oscar {awardSuffix}",
];

function genTabloidHeadline(template, player, ctx = {}) {
  // If template provides a headline function, use it.
  if (typeof template.headline === 'function') {
    return template.headline(player, ctx);
  }
  // Otherwise, treat headline as static string
  return template.headline;
}

// Pick a punchy prefix
function tabloidPrefix() {
  return pick(TABLOID_PREFIXES);
}

// Format a name in headline style
function headlineName(name) {
  if (!name) return 'STAR';
  return name.toUpperCase();
}

// ---------- TABLOID EVENT TEMPLATES ----------
//
// Each event:
//   id            — unique identifier (used for repeat prevention)
//   tier          — fame range where it can fire: [minFame, maxFame]
//   weight        — relative weight in the random pick (default 1)
//   tags          — categorization for variety filtering
//   condition(p)  — must return true for event to be eligible
//   headline(p, ctx)  — function or string; returns the headline
//   flavor(p, ctx)    — function or string; returns the lead paragraph
//   choices       — array of { label, effects, outcome }
//                   effects: { fame, cash, scandal, relationshipHealth, repHit, energy, fameAuto, chain }
//                   outcome: string shown after picking — narrative consequence
//                   chain: id of a follow-up event to queue for next week

const TABLOID_EVENTS = [
  // ============ STRUGGLING / EARLY CAREER (fame 0-25) ============

  {
    id: 'casting_couch_rumor',
    tier: [0, 30],
    tags: ['rumor', 'industry'],
    condition: (p) => p.history.length === 0 || p.history.length === 1,
    headline: (p) => `STAR-STRUCK: ${headlineName(p.name)} 'TRYING TOO HARD' AT INDUSTRY PARTIES?`,
    flavor: () => `A local gossip column is running a snide piece about you. The headline mentions "industry parties" and "doing whatever it takes." It's clearly aiming for a wink and a nod.`,
    choices: [
      {
        label: 'Ignore it (it goes away)',
        effects: { scandal: { severity: 0.4, weeks: 2, desc: 'gossip column smear' } },
        outcome: 'You keep your head down. The story doesn\'t pick up, but a whisper lingers.',
      },
      {
        label: 'Confront the columnist',
        effects: { fame: 1, scandal: { severity: 0.8, weeks: 3, desc: 'public feud' } },
        outcome: 'You called them out by name. Now everyone in the business knows your name — for better or worse.',
      },
      {
        label: 'Quietly thank them for the press',
        effects: { fame: 2 },
        outcome: 'Bizarre move. But the columnist is intrigued. Maybe an ally.',
      },
    ],
  },
  {
    id: 'broke_actor_piece',
    tier: [0, 20],
    tags: ['career', 'industry'],
    condition: (p) => p.cash < 3000 && p.history.length > 0,
    headline: (p) => `OH NO: WHATEVER HAPPENED TO ${headlineName(p.name)}?`,
    flavor: () => `A "where are they now" piece in a regional paper. They quote your old high school teacher. The framing is brutal.`,
    choices: [
      {
        label: 'Reach out, give a fresh interview',
        effects: { fame: 1, scandal: { severity: 0.3, weeks: 2, desc: 'career low piece' } },
        outcome: 'You spin the comeback narrative. Some of it lands.',
      },
      {
        label: 'No comment',
        effects: { scandal: { severity: 0.6, weeks: 4, desc: 'career low piece' } },
        outcome: 'The story sits there. Casting directors saw it.',
      },
    ],
  },
  {
    id: 'audition_humiliation',
    tier: [5, 35],
    tags: ['career', 'industry'],
    condition: (p) => p.history.length <= 2,
    headline: (p) => `BUSTED: ${headlineName(p.name)} 'BLEW THE AUDITION OF A LIFETIME'`,
    flavor: () => `A casting assistant talked to a magazine about a recent audition you blew. The details are specific. Either they have an axe to grind or you really blew it.`,
    choices: [
      {
        label: 'Public self-deprecating tweet (-equivalent)',
        effects: { fame: 2 },
        outcome: 'Owning it works. People remember your name.',
      },
      {
        label: 'Deny it happened',
        effects: { scandal: { severity: 1, weeks: 3, desc: 'audition disaster story' }, repHit: { role: 'actor', amount: -2 } },
        outcome: 'The casting community closes ranks against you.',
      },
      {
        label: 'Stay silent and work harder',
        effects: { scandal: { severity: 0.5, weeks: 2, desc: 'audition disaster story' } },
        outcome: 'Heads down. The story fades, but slowly.',
      },
    ],
  },

  // ============ WORKING PRO (fame 20-55) ============

  {
    id: 'rumor_costar',
    tier: [25, 100],
    weight: 2,
    tags: ['rumor', 'romance'],
    condition: (p) => p.history.length > 0 && (!p.personal.partner || p.personal.relationshipHealth < 60),
    headline: (p, ctx) => `${tabloidPrefix()}: ${headlineName(p.name)} SECRET ROMANCE WITH ${headlineName(ctx.costarName)}?`,
    flavor: (p, ctx) => `Photos surfaced of you and ${ctx.costarName} leaving ${pick(['Spago', 'The Polo Lounge', 'Chasen\'s', 'Mr Chow', 'Le Dome'])} late at night. Three sources "close to the production" are quoted. The pictures are grainy. The captions are not.`,
    contextBuilder: (p) => {
      const recent = p.history.slice(-3).reverse().find(f => f.crew?.actor);
      return { costarName: recent?.crew?.actor?.name || 'a recent co-star' };
    },
    choices: [
      {
        label: 'Issue a firm denial',
        effects: { fame: -1, scandal: { severity: 1, weeks: 4, desc: 'romance rumors' } },
        outcome: 'The denial gets a paragraph; the original story gets a cover. Standard tabloid math.',
      },
      {
        label: 'Ignore it completely',
        effects: { fame: 1, scandal: { severity: 0.5, weeks: 5, desc: 'romance rumors' } },
        outcome: 'No oxygen, no fire. Mostly.',
      },
      {
        label: 'Lean into the publicity',
        effects: { fame: 4, scandal: { severity: 1.5, weeks: 6, desc: 'romance rumors' } },
        outcome: 'You\'re photographed everywhere together for the next month. Your name is everywhere.',
      },
    ],
  },
  {
    id: 'set_behavior',
    tier: [25, 100],
    tags: ['scandal', 'industry'],
    condition: (p) => p.history.length >= 2,
    headline: (p) => `'IMPOSSIBLE': CREW ON ${headlineName(p.name)}'S LAST PICTURE BREAKS SILENCE`,
    flavor: (p) => {
      const lastFilm = p.history[p.history.length - 1];
      return `A crew member on "${lastFilm?.title || 'your last picture'}" spoke to a magazine. Words used: "diva," "demanding," "tantrums." Two more sources confirm on background. Your publicist has been calling all day.`;
    },
    choices: [
      {
        label: 'Public apology, blame stress',
        effects: { fame: -2, scandal: { severity: 0.8, weeks: 3, desc: 'on-set behavior' } },
        outcome: 'Apology accepted by the public. Industry insiders take note anyway.',
      },
      {
        label: 'Deny it firmly through your lawyer',
        effects: { scandal: { severity: 2, weeks: 6, desc: 'on-set behavior' }, cash: -8_000 },
        outcome: 'Three more crew members come forward by week\'s end.',
      },
      {
        label: 'Own it: "I have standards"',
        effects: { fame: 3, scandal: { severity: 1.5, weeks: 5, desc: 'on-set behavior' }, repHit: { role: 'actor', amount: -3 } },
        outcome: 'Half the industry thinks you\'re a monster. The other half wants to work with you more.',
      },
    ],
  },
  {
    id: 'wardrobe_malfunction',
    tier: [20, 80],
    tags: ['publicity'],
    condition: (p) => p.fame >= 20,
    headline: (p) => `OOPS! ${headlineName(p.name)} WARDROBE MISHAP AT ${pick(['PREMIERE', 'AWARDS GALA', 'CHARITY EVENT', 'AFTERPARTY'])}`,
    flavor: () => `Photos are everywhere. Front pages. Stills cropped suggestively. Your publicist is fielding twelve calls per minute.`,
    choices: [
      {
        label: 'Laugh it off in interviews',
        effects: { fame: 3, scandal: { severity: 0.3, weeks: 1, desc: 'wardrobe mishap' } },
        outcome: 'A self-deprecating talk-show bit kills the story while extending the press cycle.',
      },
      {
        label: 'Ignore it (these things happen)',
        effects: { fame: 1, scandal: { severity: 0.8, weeks: 2, desc: 'wardrobe mishap' } },
        outcome: 'The story has a life of its own for two weeks.',
      },
      {
        label: 'Sue the photographers',
        effects: { fame: -1, cash: -20_000, scandal: { severity: 1.2, weeks: 4, desc: 'lawsuit drama' } },
        outcome: 'You win in court eventually. The legal fees and headlines stretch out for months.',
      },
    ],
  },
  {
    id: 'restaurant_walkout',
    tier: [25, 100],
    tags: ['scandal', 'public'],
    condition: (p) => p.fame >= 25,
    headline: (p) => `RUDE! ${headlineName(p.name)} 'STORMED OUT' OF ${pick(['SPAGO', 'CHASEN\'S', 'THE POLO LOUNGE', 'MORTON\'S', 'NOBU'])}`,
    flavor: () => `A waiter told a tabloid you stormed out of a high-profile restaurant without paying and "called the maitre'd a name we can't print." The owner has politely declined to comment.`,
    choices: [
      {
        label: 'Send flowers and apologize',
        effects: { fame: 1, cash: -5_000, scandal: { severity: 0.3, weeks: 1, desc: 'restaurant rudeness' } },
        outcome: 'The owner returns the flowers with a thank-you note. Story dies in a week.',
      },
      {
        label: 'Counter-claim: "I was treated badly"',
        effects: { scandal: { severity: 1.5, weeks: 4, desc: 'restaurant feud' } },
        outcome: 'The waiter gives a follow-up interview. It\'s worse than the first one.',
      },
      {
        label: 'No comment',
        effects: { scandal: { severity: 0.8, weeks: 3, desc: 'restaurant story' } },
        outcome: 'Quiet works. Mostly.',
      },
    ],
  },

  // ============ ESTABLISHED (fame 40-80) ============

  {
    id: 'paparazzi_chase',
    tier: [40, 100],
    tags: ['paparazzi'],
    condition: () => true,
    headline: (p) => `${tabloidPrefix()}: ${headlineName(p.name)} IN HIGH-SPEED PAPARAZZI CHASE`,
    flavor: () => `A pack of photographers chased your car down ${pick(['Mulholland', 'Sunset', 'PCH', 'Coldwater Canyon'])} last night. There was a minor accident. No one hurt — yet — but the speculation is dialed up to eleven.`,
    choices: [
      {
        label: 'Sue the photographers ($25K legal)',
        effects: { fame: 2, cash: -25_000 },
        outcome: 'The lawsuit makes headlines. Two months later it settles quietly.',
      },
      {
        label: 'Champion privacy legislation publicly',
        effects: { fame: 3 },
        outcome: 'You get invited to testify before the state assembly. Cynics love it.',
      },
      {
        label: 'Stay quiet, change your routine',
        effects: { fame: -1 },
        outcome: 'No more late-night drives. The story fades within a week.',
      },
    ],
  },
  {
    id: 'party_photos',
    tier: [35, 100],
    tags: ['scandal', 'party'],
    condition: () => true,
    headline: (p) => `BOOZY! ${headlineName(p.name)} 'OUT OF CONTROL' AT HOLLYWOOD HILLS PARTY`,
    flavor: () => `Photos from a private party are in every checkout-line tabloid. You don\'t look your best. The captions are unkind. ${pick(['One photo in particular is everywhere.', 'A short blurry video clip is being passed around.', 'Three of the photos appear staged.'])}`,
    choices: [
      {
        label: 'PR damage control ($15K)',
        effects: { cash: -15_000, scandal: { severity: 0.4, weeks: 1, desc: 'party photos' } },
        outcome: 'Your team buries it under a charity announcement.',
      },
      {
        label: 'Laugh it off on a talk show',
        effects: { fame: 3, scandal: { severity: 1, weeks: 2, desc: 'party photos' } },
        outcome: 'The talk-show appearance is the highest-rated of the season.',
      },
      {
        label: 'Ignore it (it goes away)',
        effects: { scandal: { severity: 1.5, weeks: 5, desc: 'party photos' } },
        outcome: 'A second batch of photos drops two weeks later. Worse.',
        chain: 'followup_more_party_photos',
      },
    ],
  },
  {
    id: 'feud_with_rival',
    tier: [40, 100],
    tags: ['feud', 'industry'],
    condition: (p) => p.history.length >= 3,
    headline: (p, ctx) => `WAR! ${headlineName(p.name)} TRADES SHOTS WITH ${headlineName(ctx.rivalName)}`,
    flavor: (p, ctx) => {
      const opener = ctx.isNamedRival
        ? `Your long-running feud with ${ctx.rivalName} just went very public.`
        : `A long-simmering feud with another star just went very public.`;
      return `${opener} ${pick(['It started over a role you both wanted.', 'It started over a magazine ranking.', 'It started over something neither of you can remember.'])} The press is loving it.`;
    },
    contextBuilder: (p) => {
      // Try to find a real world rival first
      const rivals = Object.values(p.worldNPCs || {})
        .filter(n => n.status === 'active' && (n.rivalryScore || 0) >= 1);
      if (rivals.length > 0) {
        const rival = rivals.sort((a, b) => (b.rivalryScore || 0) - (a.rivalryScore || 0))[0];
        return { rivalName: rival.name, isNamedRival: true, rivalId: rival.id };
      }
      return { rivalName: generateName(), isNamedRival: false };
    },
    choices: [
      {
        label: 'Public peace offering',
        effects: { fame: 1, scandal: { severity: 0.4, weeks: 2, desc: 'industry feud' }, rivalryDelta: -1 },
        outcome: 'You appear together at a charity event. Photographers go feral.',
      },
      {
        label: 'Double down',
        effects: { fame: 4, scandal: { severity: 1.5, weeks: 5, desc: 'public feud' }, rivalryDelta: 1 },
        outcome: 'You traded barbs on three talk shows in two weeks. Ratings everywhere.',
      },
      {
        label: 'Refuse to comment',
        effects: { scandal: { severity: 0.8, weeks: 3, desc: 'feud' } },
        outcome: 'Silence works. The other side keeps talking, undermining themselves.',
      },
    ],
  },
  {
    id: 'rivalry_burns_hotter',
    tier: [40, 100],
    weight: 1.5,
    tags: ['feud', 'industry'],
    condition: (p) => Object.values(p.worldNPCs || {}).some(n => (n.rivalryScore || 0) >= 3 && n.status === 'active'),
    headline: (p, ctx) => `'${headlineName(ctx.rivalName)} ${pick(['CAN\'T HOLD A CANDLE', 'IS A HACK', 'STOLE MY ROLE', 'WILL NEVER WIN'])}' — ${headlineName(p.name)} ON RECORD`,
    flavor: (p, ctx) => `An off-the-record comment about ${ctx.rivalName} just hit the record. A young reporter recorded the whole conversation. Now it's a story.`,
    contextBuilder: (p) => {
      const rivals = Object.values(p.worldNPCs || {})
        .filter(n => n.status === 'active' && (n.rivalryScore || 0) >= 3)
        .sort((a, b) => (b.rivalryScore || 0) - (a.rivalryScore || 0));
      return { rivalName: rivals[0]?.name || 'a rival', rivalId: rivals[0]?.id };
    },
    choices: [
      {
        label: 'Walk it back: "I was misquoted"',
        effects: { fame: -1, scandal: { severity: 1, weeks: 3, desc: 'rivalry comments' } },
        outcome: 'The reporter releases the full tape. It\'s worse than what they printed.',
      },
      {
        label: 'Stand by it — let it burn',
        effects: { fame: 5, scandal: { severity: 2, weeks: 6, desc: 'open feud' }, rivalryDelta: 2 },
        outcome: 'Hollywood splits into camps. Your camp talks loudly. Theirs talks louder.',
      },
      {
        label: 'Apologize publicly',
        effects: { fame: 1, scandal: { severity: 0.3, weeks: 1, desc: 'feud apology' }, rivalryDelta: -1, friendshipDelta: 1 },
        outcome: 'The apology is read on entertainment news. People move on within a week.',
      },
    ],
  },
  {
    id: 'friend_collab_buzz',
    tier: [30, 100],
    tags: ['publicity', 'good', 'industry'],
    condition: (p) => Object.values(p.worldNPCs || {}).some(n => (n.friendshipScore || 0) >= 4 && n.status === 'active'),
    headline: (p, ctx) => `BUZZ: ${headlineName(p.name)} & ${headlineName(ctx.friendName)} 'REUNITING' FOR NEXT PICTURE?`,
    flavor: (p, ctx) => `The trades are speculating about another project pairing you with ${ctx.friendName}. Your previous collaborations are being rewatched. Sources say "nothing's signed but everyone's interested."`,
    contextBuilder: (p) => {
      const friends = Object.values(p.worldNPCs || {})
        .filter(n => n.status === 'active' && (n.friendshipScore || 0) >= 4)
        .sort((a, b) => (b.friendshipScore || 0) - (a.friendshipScore || 0));
      return { friendName: friends[0]?.name || 'a collaborator', friendId: friends[0]?.id };
    },
    choices: [
      {
        label: 'Confirm interest publicly',
        effects: { fame: 3, friendshipDelta: 1 },
        outcome: 'The story has its own legs for two weeks. Whether the project happens is another question.',
      },
      {
        label: 'Stay cagey',
        effects: { fame: 1 },
        outcome: 'A careful "no comment that\'s really a yes." The trades read between the lines.',
      },
      {
        label: 'Deny it',
        effects: { fame: -1, friendshipDelta: -1 },
        outcome: 'Why deny it? Now everyone wants to know what fell apart.',
      },
    ],
  },

  // ============ A-LIST / SUPERSTAR (fame 60-100) ============

  {
    id: 'meltdown_recording',
    tier: [55, 100],
    tags: ['scandal', 'industry'],
    condition: (p) => p.fame >= 55 && p.history.length >= 3,
    headline: (p) => `MELTDOWN: AUDIO LEAK OF ${headlineName(p.name)} 'LOSING IT' ON SET`,
    flavor: () => `Someone recorded a behind-the-scenes outburst and gave it to a magazine. The tape runs four minutes. The language is colorful. The trade papers are running transcripts.`,
    choices: [
      {
        label: 'Public mea culpa, donate to charity ($50K)',
        effects: { cash: -50_000, fame: -1, scandal: { severity: 0.6, weeks: 3, desc: 'meltdown tape' } },
        outcome: 'Genuine contrition lands. The damage is contained.',
      },
      {
        label: 'Deny authenticity, threaten litigation',
        effects: { scandal: { severity: 2.5, weeks: 7, desc: 'meltdown tape' }, repHit: { role: 'actor', amount: -5 } },
        outcome: 'The recording is verified within a week. Now you have two scandals.',
      },
      {
        label: 'Therapy announcement',
        effects: { fame: 2, scandal: { severity: 0.4, weeks: 2, desc: 'meltdown tape' } },
        outcome: 'The "humanizing" angle works. Magazine covers next month.',
      },
    ],
  },
  {
    id: 'exhaustion_collapse',
    tier: [30, 100],
    weight: 2,
    tags: ['scandal', 'health'],
    condition: (p) => (p.burnoutWeeks || 0) >= 3,
    headline: (p) => `EXHAUSTION: ${headlineName(p.name)} COLLAPSES, HOSPITALIZED`,
    flavor: () => `You collapsed on set / at a function / in a hotel lobby — depending on which paper you read. The hospital release cited "exhaustion." Everyone knows what that means. The trades are running concerned-think-pieces about your workload.`,
    choices: [
      {
        label: 'Take a real break ($20K, +25 energy)',
        effects: { cash: -20_000, energy: 25, fame: 1, scandal: { severity: 0.3, weeks: 2, desc: 'exhaustion' } },
        outcome: 'A month in the desert. You come back rested. The sympathetic coverage helps.',
      },
      {
        label: 'Issue a statement and keep working',
        effects: { fame: -2, scandal: { severity: 1.5, weeks: 5, desc: 'exhaustion' } },
        outcome: 'The trades note that you ignored medical advice. Insurance gets nervous.',
      },
      {
        label: 'Blame "an old injury"',
        effects: { fame: 0, scandal: { severity: 0.8, weeks: 3, desc: 'health rumors' } },
        outcome: 'A few outlets buy it. The rest start a whisper campaign.',
      },
    ],
  },
  {
    id: 'plastic_surgery_rumor',
    tier: [50, 100],
    tags: ['rumor', 'appearance'],
    condition: (p) => p.age >= 32,
    headline: (p) => `BEFORE & AFTER: ${headlineName(p.name)}'S 'NEW LOOK'`,
    flavor: () => `Tabloids ran a side-by-side photo spread. The text uses words like "work" and "refresh" and "remarkable transformation." None of it is flattering.`,
    choices: [
      {
        label: 'Address it candidly',
        effects: { fame: 2 },
        outcome: 'Honesty resets the conversation. The next cover is gentler.',
      },
      {
        label: 'Stay above it',
        effects: { scandal: { severity: 0.6, weeks: 4, desc: 'appearance rumors' } },
        outcome: 'The story rolls on for a month without your input.',
      },
    ],
  },
  {
    id: 'addiction_intervention',
    tier: [60, 100],
    tags: ['scandal', 'health'],
    condition: (p) => p.fame >= 60,
    headline: (p) => `${tabloidPrefix()}: ${headlineName(p.name)} ENTERING REHAB?`,
    flavor: () => `An item in the trade papers says you're "set to enter treatment" for "exhaustion." Everyone in the industry knows what that means. Your publicist did not call you before this ran.`,
    choices: [
      {
        label: 'Confirm rehab quietly (8 weeks out)',
        effects: { fame: 1, scandal: { severity: 0.4, weeks: 3, desc: 'rehab story' } },
        outcome: 'You vanish for two months. When you come back, you\'re inspirational.',
      },
      {
        label: 'Categorically deny',
        effects: { scandal: { severity: 2.5, weeks: 8, desc: 'denial spiral' } },
        outcome: 'A photo of you stumbling out of a club appears the next morning.',
        chain: 'followup_denial_caught_out',
      },
      {
        label: 'Take a "creative sabbatical"',
        effects: { fame: -2, scandal: { severity: 1, weeks: 5, desc: 'sabbatical murmurs' } },
        outcome: 'The euphemism convinces no one. But it buys you time.',
      },
    ],
  },
  {
    id: 'massive_charity',
    tier: [55, 100],
    tags: ['publicity', 'good'],
    condition: (p) => p.cash > 500_000,
    headline: (p) => `${headlineName(p.name)} DONATES ${pick(['$500K', '$1M', '$2M'])} TO ${pick(['CHILDREN\'S HOSPITAL', 'AIDS RESEARCH', 'EARTHQUAKE RELIEF', 'LITERACY PROGRAM'])}`,
    flavor: () => `A reporter caught wind of a major donation you made. The story makes the front page of the Trades.`,
    choices: [
      {
        label: 'Confirm the donation publicly',
        effects: { fame: 4, cash: -500_000 },
        outcome: 'The press tour around the donation is more valuable than the donation.',
      },
      {
        label: 'Confirm but ask for privacy ($1M)',
        effects: { fame: 6, cash: -1_000_000 },
        outcome: 'The "quiet hero" framing dominates the press cycle for a month.',
      },
      {
        label: 'Deny it (you didn\'t do it)',
        effects: { fame: -1 },
        outcome: 'Someone planted the story. You never find out who.',
      },
    ],
  },

  // ============ RELATIONSHIP / FAMILY EVENTS ============

  {
    id: 'public_fight',
    tier: [10, 100],
    tags: ['family', 'scandal'],
    condition: (p) => p.personal.status === 'married' && p.personal.relationshipHealth < 50,
    headline: (p) => `TROUBLE IN PARADISE: ${headlineName(p.name)} & ${headlineName(p.personal.partner.name)} IN HEATED ARGUMENT`,
    flavor: (p) => `You and ${p.personal.partner.name} were photographed arguing outside ${pick(['a restaurant', 'a hotel', 'your home', 'an industry event'])}. The body language is unmistakable.`,
    choices: [
      {
        label: 'Plan a vacation together ($30K)',
        effects: { cash: -30_000, relationshipHealth: 25 },
        outcome: 'Two weeks in St. Barts. Both of you come back tan and reconciled.',
      },
      {
        label: 'Joint statement: "We\'re fine"',
        effects: { relationshipHealth: 8, scandal: { severity: 1, weeks: 3, desc: 'marital strife' } },
        outcome: 'The statement convinces no one but provides PR cover.',
      },
      {
        label: 'Refuse to comment',
        effects: { relationshipHealth: -5, scandal: { severity: 1.5, weeks: 5, desc: 'marital strife' } },
        outcome: 'Silence is read as confirmation. Tabloids dig harder.',
      },
    ],
  },
  {
    id: 'affair_rumor',
    tier: [40, 100],
    tags: ['family', 'scandal'],
    condition: (p) => p.personal.status === 'married' && p.fame >= 40,
    headline: (p) => `EXCLUSIVE: ${headlineName(p.name)} 'CHEATING ON ${headlineName(p.personal.partner.name)}'?`,
    flavor: (p) => `A tabloid is claiming you're having an affair. ${p.personal.partner.name} hasn't commented publicly. Your publicist is in an undisclosed location.`,
    choices: [
      {
        label: 'Denial + lawsuit threat ($10K legal)',
        effects: { cash: -10_000, scandal: { severity: 1, weeks: 4, desc: 'affair rumors' }, relationshipHealth: -10 },
        outcome: 'The lawsuit threat keeps it out of the bigger papers.',
      },
      {
        label: 'Joint public appearance',
        effects: { fame: 2, relationshipHealth: 15, scandal: { severity: 0.5, weeks: 3, desc: 'affair rumors' } },
        outcome: 'Hand-holding photos at a premiere. The original story is quietly retracted.',
      },
      {
        label: 'Stay silent',
        effects: { scandal: { severity: 2, weeks: 6, desc: 'affair rumors' }, relationshipHealth: -20 },
        outcome: 'Your spouse stops returning your calls for a week.',
      },
    ],
  },
  {
    id: 'kid_school',
    tier: [10, 100],
    tags: ['family'],
    condition: (p) => p.personal.children.length > 0 && p.personal.children.some(c => p.year - c.born >= 6 && p.year - c.born <= 17),
    headline: (p, ctx) => `INSIDE STORY: ${headlineName(p.name)}'S KID '${ctx.action}' AT ${pick(['BEVERLY HILLS HIGH', 'BUCKLEY', 'CROSSROADS', 'HARVARD-WESTLAKE'])}`,
    flavor: (p, ctx) => `Your child ${ctx.kid.name} ${pick(['got into a fight', 'was caught skipping class', 'had a public outburst', 'was photographed somewhere they shouldn\'t have been'])}. The press caught wind. The other parents at school are calling each other.`,
    contextBuilder: (p) => {
      const kid = p.personal.children.find(c => p.year - c.born >= 6 && p.year - c.born <= 17);
      return { kid, action: pick(['BUSTED', 'IN TROUBLE', 'ACTING OUT']) };
    },
    choices: [
      {
        label: 'Private school transfer ($40K)',
        effects: { cash: -40_000 },
        outcome: 'The kid is moved discreetly. The story has no follow-up.',
      },
      {
        label: 'Family statement about parenting',
        effects: { fame: 2 },
        outcome: 'You wrote it together. It reads well.',
      },
      {
        label: 'Stay quiet',
        effects: { scandal: { severity: 0.6, weeks: 2, desc: 'family drama' } },
        outcome: 'The other parents talk for weeks.',
      },
    ],
  },
  {
    id: 'pregnancy_rumor',
    tier: [40, 100],
    tags: ['family', 'rumor'],
    condition: (p) => p.personal.status === 'married' && p.personal.relationshipHealth >= 50,
    headline: (p) => `BABY ON THE WAY? ${headlineName(p.name)} 'GLOWING' AT RECENT EVENT`,
    flavor: (p) => `A photo of you and ${p.personal.partner.name} at a recent event has the tabloids in a frenzy. They\'re analyzing the cut of your jacket.`,
    choices: [
      {
        label: 'Confirm (if you\'re ready for kids)',
        effects: { fame: 3, energy: -10 },
        outcome: 'Magazine covers. Baby brand deals. Strangers offering parenting advice.',
      },
      {
        label: 'Deny it',
        effects: { fame: 1, scandal: { severity: 0.4, weeks: 2, desc: 'pregnancy rumors' } },
        outcome: 'They run the denial alongside the original story.',
      },
      {
        label: 'No comment',
        effects: { scandal: { severity: 0.7, weeks: 3, desc: 'pregnancy rumors' } },
        outcome: 'The rumors get more specific.',
      },
    ],
  },

  // ============ GOOD NEWS / PUBLICITY ============

  {
    id: 'magazine_feature',
    tier: [20, 100],
    tags: ['publicity', 'good'],
    weight: 1.5,
    condition: () => true,
    headline: (p) => `${pick(['VOGUE', 'VANITY FAIR', 'ROLLING STONE', 'GQ', 'PEOPLE'])} WANTS ${headlineName(p.name)} FOR THE COVER`,
    flavor: () => `A glossy wants a major profile piece — home tour, family interview, the works. Their writer is famous and difficult.`,
    choices: [
      {
        label: 'Full access — home, family',
        effects: { fame: 4 },
        outcome: 'The piece is a love letter. Your stock goes up across the industry.',
      },
      {
        label: 'Interview only, no home tour',
        effects: { fame: 2 },
        outcome: 'They print it. It\'s polite.',
      },
      {
        label: 'Decline (too private)',
        effects: { fame: -1 },
        outcome: 'The writer ends up profiling someone else. Your name comes up in passing.',
      },
    ],
  },
  {
    id: 'fan_letter',
    tier: [10, 80],
    tags: ['good'],
    condition: () => true,
    headline: (p) => `HEARTWARMING: ${headlineName(p.name)} RESPONDS TO FAN'S LETTER`,
    flavor: () => `A fan sent a heartfelt letter — they're going through a hard time, your work helped. Their family wrote a follow-up letter to a magazine.`,
    choices: [
      {
        label: 'Reach out personally',
        effects: { fame: 3 },
        outcome: 'You sent a handwritten note. The family shared it. It went viral (for 1985 values of viral).',
      },
      {
        label: 'Quietly send something through your team',
        effects: { fame: 1 },
        outcome: 'A signed photo and a kind note. They don\'t share it publicly. You feel good about it.',
      },
      {
        label: 'Have an assistant handle it',
        effects: { fame: 0 },
        outcome: 'A form letter goes out. It\'s fine.',
      },
    ],
  },
  {
    id: 'lifetime_tribute',
    tier: [70, 100],
    tags: ['publicity', 'good'],
    condition: (p) => p.history.length >= 8,
    headline: (p) => `${headlineName(p.name)} HONORED AT ${pick(['HARVARD', 'AFI', 'KENNEDY CENTER', 'LINCOLN CENTER'])} TRIBUTE`,
    flavor: (p) => `An institution wants to mount an evening in your honor — career retrospective, dinner, speakers. The event would air on network TV.`,
    choices: [
      {
        label: 'Accept graciously',
        effects: { fame: 5 },
        outcome: 'The retrospective reignites interest in your back catalog. Three reissues happen.',
      },
      {
        label: 'Decline (too early for a tribute)',
        effects: { fame: -1 },
        outcome: 'The institution honors someone else. It\'s seen as classy.',
      },
    ],
  },

  // ============ INDUSTRY DRAMA ============

  {
    id: 'role_passed',
    tier: [40, 100],
    tags: ['industry', 'career'],
    condition: (p) => p.history.length >= 3,
    headline: (p) => `${headlineName(p.name)} 'PASSED' ON ${pick(['THE PROJECT OF THE YEAR', 'THIS YEAR\'S OSCAR FRONTRUNNER', 'A BLOCKBUSTER FRANCHISE', 'A DREAM ROLE'])}`,
    flavor: () => `A studio executive leaked that you passed on a role that's now hugely buzzed about. Someone else got it. The story makes you look either prescient or foolish.`,
    choices: [
      {
        label: 'Explain your artistic reasons',
        effects: { fame: 2 },
        outcome: 'The interview reads well. Half the industry agrees with you.',
      },
      {
        label: 'No comment',
        effects: { scandal: { severity: 0.5, weeks: 2, desc: 'passed on hit' } },
        outcome: 'When the film wins, your name is mentioned in every recap.',
      },
      {
        label: 'Backchannel: "I didn\'t actually pass"',
        effects: { fame: -2, scandal: { severity: 1, weeks: 3, desc: 'casting controversy' } },
        outcome: 'The exec leaks the original communications. It\'s embarrassing.',
      },
    ],
  },
  {
    id: 'studio_war',
    tier: [50, 100],
    tags: ['industry'],
    condition: (p) => !!p.studio,
    headline: (p) => `${headlineName(p.studio.name)} VS ${headlineName(generateStudioName(generateName()))} — TRADE WAR ESCALATES`,
    flavor: (p) => `A competitor studio is publicly poaching your talent. The trades are running it as a war story.`,
    choices: [
      {
        label: 'Match offers, lock in your people ($200K)',
        effects: { cash: -200_000, fame: 1 },
        outcome: 'You kept your roster intact. The competitor moves on. Industry respects the move.',
      },
      {
        label: 'Aggressive counter-poach',
        effects: { fame: 4, scandal: { severity: 1.5, weeks: 4, desc: 'studio war' } },
        outcome: 'You stole three of their stars. They are not pleased.',
      },
      {
        label: 'Let them go',
        effects: { fame: -2 },
        outcome: 'Two of your people leave. It hurts more than you expected.',
      },
    ],
  },

  // ============ FOLLOW-UP / CHAIN EVENTS (only fired via chain) ============

  {
    id: 'followup_more_party_photos',
    tier: [0, 100],
    tags: ['scandal', 'followup'],
    condition: () => false, // never fires randomly
    headline: (p) => `MORE PARTY PHOTOS LEAK — ${headlineName(p.name)} 'WORSE THAN WE THOUGHT'`,
    flavor: () => `Two weeks after the first set, more photos surface. These are worse. Your team is in crisis mode.`,
    choices: [
      {
        label: 'Major PR pivot — interview tour, charity push ($75K)',
        effects: { cash: -75_000, fame: 1, scandal: { severity: 0.5, weeks: 2, desc: 'post-scandal recovery' } },
        outcome: 'The charity stunt buries the story. Mostly.',
      },
      {
        label: 'Disappear for a month',
        effects: { fame: -3, scandal: { severity: 0.8, weeks: 3, desc: 'going to ground' } },
        outcome: 'You go off the grid. People notice. People wonder.',
      },
    ],
  },
  {
    id: 'followup_denial_caught_out',
    tier: [0, 100],
    tags: ['scandal', 'followup'],
    condition: () => false,
    headline: (p) => `CAUGHT: ${headlineName(p.name)} PHOTOGRAPHED LEAVING ${pick(['THE VIPER ROOM', 'A KNOWN HOTSPOT', 'A CELEBRITY ENABLER\'S HOUSE'])} AT 4AM`,
    flavor: () => `The denial didn't survive a week. Photos prove the original story was correct.`,
    choices: [
      {
        label: 'Public apology and treatment plan',
        effects: { fame: 1, scandal: { severity: 0.6, weeks: 3, desc: 'caught out' } },
        outcome: 'You finally check in. The press is sympathetic.',
      },
      {
        label: 'Disappear completely',
        effects: { fame: -5, scandal: { severity: 2, weeks: 6, desc: 'going to ground' } },
        outcome: 'Six months of silence. Your career stalls.',
      },
    ],
  },

  // ============ NEW: EARLY CAREER (fame 0-30) ============

  {
    id: 'audition_room_story',
    tier: [0, 30],
    tags: ['career', 'rumor'],
    condition: (p) => p.history.length <= 2,
    headline: (p) => `'WHO?': ${headlineName(p.name)} MISTAKEN FOR ANOTHER ASPIRING ACTOR AT MAJOR AUDITION`,
    flavor: () => `An anonymous casting director told a trade paper they "couldn't tell you apart from three other people in the room." Brutal, but at least they noticed.`,
    choices: [
      {
        label: 'Send a thoughtful letter to the casting office',
        effects: { reputation: { actor: 1 } },
        outcome: 'The follow-up gets read. You\'re not forgotten — you\'re a name they noticed twice.',
      },
      {
        label: 'Vent to a friend at a bar (loudly)',
        effects: { scandal: { severity: 0.5, weeks: 2, desc: 'bar rant' } },
        outcome: 'A waiter writes it down. The quote ends up in print.',
      },
      {
        label: 'Take it as motivation',
        effects: { energy: -5 },
        outcome: 'You audition four more times that month. You don\'t book any. But you remember.',
      },
    ],
  },
  {
    id: 'roommate_tell_all',
    tier: [5, 35],
    tags: ['scandal', 'lifestyle'],
    condition: (p) => p.history.length >= 1 && p.fame >= 5,
    headline: (p) => `'I LIVED WITH ${headlineName(p.name).toUpperCase()}': ROOMMATE'S TELL-ALL`,
    flavor: () => `Someone you crashed with back when you couldn't make rent is talking to a magazine. The details range from embarrassing to "you actually forgot that happened."`,
    choices: [
      {
        label: 'Pay them off ($5K)',
        effects: { cash: -5000, scandal: { severity: 0.3, weeks: 2, desc: 'old roommate' } },
        outcome: 'They go silent. The magazine prints the partial version. No one cares.',
      },
      {
        label: 'Laugh it off in an interview',
        effects: { fame: 2 },
        outcome: 'You retell the stories better than they did. Self-deprecation is having a moment.',
      },
      {
        label: 'Threaten legal action',
        effects: { scandal: { severity: 1.2, weeks: 4, desc: 'roommate lawsuit' } },
        outcome: 'They counter-sue. Now there are three more stories.',
      },
    ],
  },
  {
    id: 'open_call_meltdown',
    tier: [0, 25],
    tags: ['career', 'scandal'],
    condition: (p) => p.fame <= 25,
    headline: (p) => `OPEN CALL CHAOS: ${headlineName(p.name)} 'STORMS OUT' OF CATTLE-CALL AUDITION`,
    flavor: () => `A local trade reporter was there. You waited four hours. You left after they called the wrong name. Now there's a paragraph about you in tomorrow's column.`,
    choices: [
      {
        label: 'Issue an apology to the casting team',
        effects: { reputation: { actor: 2 } },
        outcome: 'A reputation for professionalism survives the moment. They remember the apology, not the exit.',
      },
      {
        label: 'Stand by the exit',
        effects: { fame: 1, scandal: { severity: 0.6, weeks: 3, desc: 'audition walkout' } },
        outcome: 'The "diva at zero fame" angle writes itself. The next call sheet skips you.',
      },
      {
        label: 'Pretend it never happened',
        effects: { scandal: { severity: 0.4, weeks: 2, desc: 'audition walkout' } },
        outcome: 'Two casting offices still talk about it.',
      },
    ],
  },
  {
    id: 'flyer_audition_scam',
    tier: [0, 20],
    tags: ['scandal', 'industry'],
    condition: (p) => p.history.length === 0,
    headline: (p) => `WARNING: 'AGENT' WHO PROMISED ${headlineName(p.name)} A ROLE WAS A FRAUD`,
    flavor: () => `You paid a "talent agent" $500 for a "guaranteed audition" that never existed. A reporter is doing a piece on the racket. Your name's in it.`,
    choices: [
      {
        label: 'Tell the truth, name the scammer',
        effects: { fame: 2, cash: 0 },
        outcome: 'The article runs. The scammer gets investigated. You become "the one with the story."',
      },
      {
        label: 'Deny being involved',
        effects: { scandal: { severity: 0.5, weeks: 2, desc: 'audition scam' } },
        outcome: 'The reporter finds the receipt. The denial is now the story.',
      },
      {
        label: 'Refuse to comment',
        effects: { },
        outcome: 'The article runs without you. Most people skip past your name.',
      },
    ],
  },
  {
    id: 'reading_circle',
    tier: [0, 30],
    tags: ['career', 'good'],
    condition: (p) => p.skills.writer >= 20 || p.skills.actor >= 25,
    headline: (p) => `'RAW TALENT': ${headlineName(p.name)} SPOTTED AT REGULAR INDIE READING GROUP`,
    flavor: () => `A small but respected weekly reading circle of working pros has mentioned you in three different interviews this month. You're "the one to watch," apparently.`,
    choices: [
      {
        label: 'Keep showing up. Stay quiet about it.',
        effects: { reputation: { writer: 2, actor: 2 } },
        outcome: 'Your name moves through casting offices via word of mouth. The right people start asking.',
      },
      {
        label: 'Hire a publicist to lean into it ($3K)',
        effects: { cash: -3000, fame: 3 },
        outcome: 'A trade write-up follows. You\'re a "hot up-and-comer." For now.',
      },
      {
        label: 'Politely stop attending',
        effects: { reputation: { writer: -1, actor: -1 } },
        outcome: 'The mention dries up. So does the goodwill that came with it.',
      },
    ],
  },
  {
    id: 'commercial_offer',
    tier: [0, 30],
    tags: ['career'],
    condition: (p) => p.cash < 10000,
    headline: (p) => `'PAYS THE BILLS': ${headlineName(p.name)} REPORTEDLY OFFERED CAR COMMERCIAL`,
    flavor: () => `Word in the industry: you've been offered a national commercial. It pays $15K. It might also be the kind of thing serious actors don't do. Or it might just be smart.`,
    choices: [
      {
        label: 'Take the money',
        effects: { cash: 15000, reputation: { actor: -2 }, fame: 1 },
        outcome: 'Rent paid. The spot runs for two years. Reviewers won\'t forget it.',
      },
      {
        label: 'Pass on principle',
        effects: { reputation: { actor: 1 } },
        outcome: 'Six months later you can\'t make rent. But the right people noticed you passed.',
      },
      {
        label: 'Negotiate for a smaller spot ($5K)',
        effects: { cash: 5000 },
        outcome: 'Compromise. Nobody loves it. But it\'s done.',
      },
    ],
  },
  {
    id: 'small_role_steal',
    tier: [5, 35],
    tags: ['career', 'good'],
    condition: (p) => p.history.length >= 1 && p.history.length <= 4,
    headline: (p) => `'STOLE EVERY SCENE': SUPPORTING TURN BY ${headlineName(p.name)} GETS UNEXPECTED PRESS`,
    flavor: () => `A small part you took in someone else's picture is getting talked about. A reviewer wrote a whole paragraph about your two scenes. People are looking at the actor list and finding your name.`,
    choices: [
      {
        label: 'Capitalize: do every interview you can',
        effects: { fame: 4, energy: -10 },
        outcome: 'Four weeks of press. Your phone starts ringing.',
      },
      {
        label: 'Let the work speak',
        effects: { fame: 2, reputation: { actor: 3 } },
        outcome: 'The reputation builds slower but lasts longer.',
      },
      {
        label: 'Push back on the press attention',
        effects: { reputation: { actor: 1 } },
        outcome: 'The story tapers. But two directors send scripts the next month.',
      },
    ],
  },
  {
    id: 'sublet_dispute',
    tier: [0, 25],
    tags: ['scandal', 'lifestyle'],
    condition: (p) => p.cash < 15000,
    headline: (p) => `'NEVER PAID THE LAST MONTH': LANDLORD CLAIMS ${headlineName(p.name)} SKIPPED OUT`,
    flavor: () => `A former landlord has been calling local papers about your unpaid rent from years ago. The amount is $340. The story is bigger than the money.`,
    choices: [
      {
        label: 'Pay it now, publicly',
        effects: { cash: -340, fame: 1 },
        outcome: 'You hand-deliver a check with cameras present. The story flips overnight.',
      },
      {
        label: 'Ignore it',
        effects: { scandal: { severity: 0.4, weeks: 2, desc: 'unpaid rent' } },
        outcome: 'The landlord keeps calling. Two more outlets pick it up.',
      },
      {
        label: 'Tell your side (it was a slumlord situation)',
        effects: { scandal: { severity: 0.6, weeks: 3, desc: 'landlord dispute' } },
        outcome: 'It becomes a long he-said situation. Both sides look bad.',
      },
    ],
  },
  {
    id: 'first_premiere_outfit',
    tier: [10, 35],
    tags: ['lifestyle'],
    condition: (p) => p.history.length >= 1 && p.history.length <= 3,
    headline: (p) => `${headlineName(p.name)} 'DARES TO BE DIFFERENT' AT FIRST RED CARPET`,
    flavor: () => `What you wore got more coverage than the film. Half the columns called it bold. The other half called it disastrous. Either way, your name is in print.`,
    choices: [
      {
        label: 'Own it — do it again next time',
        effects: { fame: 3 },
        outcome: 'A signature look. Magazine editors start calling.',
      },
      {
        label: 'Apologize to the designer in a polite interview',
        effects: { fame: 1, reputation: { actor: 1 } },
        outcome: 'The designer publicly forgives you. The whole thing becomes charming.',
      },
      {
        label: 'Blame your stylist',
        effects: { scandal: { severity: 0.5, weeks: 2, desc: 'fashion blame' } },
        outcome: 'The stylist quits. Their next interview is not kind.',
      },
    ],
  },
  {
    id: 'method_acting_doubts',
    tier: [10, 40],
    tags: ['career'],
    condition: (p) => (p.activeProduction || p.inTheaters?.length > 0) && p.skills.actor >= 25,
    headline: (p) => `'TOO MUCH'? ${headlineName(p.name)}'S METHOD APPROACH 'CONCERNING' SET SOURCES`,
    flavor: () => `Three sources from your last set say you stayed in character on lunch breaks, refused to use your real name, and slept in the costume trailer. The trades are split on whether it's dedication or pretension.`,
    choices: [
      {
        label: 'Defend the process eloquently',
        effects: { reputation: { actor: 3 }, energy: -5 },
        outcome: 'Your interviews about craft become well-quoted. Other young actors start citing you.',
      },
      {
        label: 'Make a joke of it',
        effects: { fame: 2, reputation: { actor: -1 } },
        outcome: 'The talk show clip plays everywhere. Serious people stop taking you seriously.',
      },
      {
        label: 'Refuse all comment',
        effects: { reputation: { actor: 1 } },
        outcome: 'Silence becomes its own statement. The right people respect it.',
      },
    ],
  },

  // ============ NEW: MID-CAREER (fame 30-60) ============

  {
    id: 'magazine_cover_pulled',
    tier: [30, 65],
    tags: ['scandal', 'industry'],
    condition: (p) => p.fame >= 30,
    headline: (p) => `'EDITORIAL DECISION': ${headlineName(p.name)} BUMPED FROM MAJOR COVER AT LAST MINUTE`,
    flavor: () => `You were supposed to be on the cover. Someone bigger came in. The magazine ran the bigger name. Your interview is buried on page 47.`,
    choices: [
      {
        label: 'Public class — congratulate the new cover',
        effects: { fame: 1, reputation: { actor: 1, producer: 1 } },
        outcome: 'Industry respect ticks up. The editor calls personally to thank you.',
      },
      {
        label: 'Burn the magazine on social channels',
        effects: { fame: 2, scandal: { severity: 1, weeks: 4, desc: 'magazine feud' } },
        outcome: 'Your name is in every magazine *except* theirs for a month.',
      },
      {
        label: 'Sue for breach of contract',
        effects: { cash: -25000, scandal: { severity: 1.5, weeks: 6, desc: 'magazine lawsuit' } },
        outcome: 'The suit drags out. You eventually settle for less than legal fees.',
      },
    ],
  },
  {
    id: 'set_romance_rumor',
    tier: [25, 65],
    tags: ['rumor', 'romance'],
    condition: (p) => (p.inTheaters?.length > 0 || p.activeProduction) && (!p.personal.partner || p.personal.relationshipHealth < 70),
    headline: (p) => `'IT'S DEFINITELY ON': PRODUCTION ASSISTANT 'SOURCES' ON ${headlineName(p.name)} SET ROMANCE`,
    flavor: () => `A "PA on the production" — three different ones, somehow — say there's something happening on set. Photos appear within a week. They're ambiguous.`,
    choices: [
      {
        label: 'No comment',
        effects: { scandal: { severity: 0.6, weeks: 3, desc: 'set romance rumors' } },
        outcome: 'The story has a moderate life. People move on.',
      },
      {
        label: 'Stage a "we\'re just friends" photo op',
        effects: { fame: 1, scandal: { severity: 0.4, weeks: 2, desc: 'set romance rumors' } },
        outcome: 'The "friendship" photo is interpreted exactly as you hoped — or didn\'t.',
      },
      {
        label: 'Address it directly: yes/no',
        effects: { fame: 3, scandal: { severity: 1.2, weeks: 4, desc: 'romance confirmed' } },
        outcome: 'The straight answer gets headlines for two weeks. Your publicist is annoyed.',
      },
    ],
  },
  {
    id: 'expose_workplace_culture',
    tier: [35, 75],
    tags: ['scandal', 'industry'],
    condition: (p) => p.studio && p.studio.releases >= 3,
    headline: (p) => `'TOXIC CULTURE'? FORMER ${headlineName(p.name)} STUDIO STAFF SPEAK OUT`,
    flavor: () => `Four former assistants and a junior producer are quoted in a 3,000-word piece. The complaints range from "long hours" to "screaming matches." Some of it sounds bad. Some of it sounds like Hollywood.`,
    choices: [
      {
        label: 'Hire an HR consultant publicly ($30K)',
        effects: { cash: -30000, fame: 1, scandal: { severity: 0.6, weeks: 3, desc: 'culture expose' } },
        outcome: 'The trades note the swift response. The story fades within a month.',
      },
      {
        label: 'Dispute every claim',
        effects: { scandal: { severity: 2.5, weeks: 8, desc: 'denied workplace expose' } },
        outcome: 'A second wave of sources comes forward. The story doubles.',
      },
      {
        label: 'Issue a measured statement, change nothing',
        effects: { scandal: { severity: 1.5, weeks: 5, desc: 'workplace expose' } },
        outcome: 'A familiar Hollywood ending. Some people leave the industry. The studio runs on.',
      },
    ],
  },
  {
    id: 'paparazzi_chase',
    tier: [40, 80],
    tags: ['scandal', 'lifestyle'],
    condition: (p) => p.fame >= 40,
    headline: (p) => `HIGH-SPEED PURSUIT: ${headlineName(p.name)} OUTRUNS PAPARAZZI ON CANYON ROADS`,
    flavor: () => `Three cars. Curves. No one hurt, miraculously. But the photos of the chase are everywhere by morning. The legal questions are not.`,
    choices: [
      {
        label: 'Issue a careful statement: "I felt unsafe"',
        effects: { fame: 1, scandal: { severity: 0.5, weeks: 3, desc: 'paparazzi chase' } },
        outcome: 'Sympathy lands. A few outlets reconsider their photographers\' tactics.',
      },
      {
        label: 'Sue the photographers',
        effects: { cash: -40000, fame: 3, scandal: { severity: 1.5, weeks: 5, desc: 'paparazzi lawsuit' } },
        outcome: 'A high-profile court case. You win. The photographers find other ways.',
      },
      {
        label: 'Go public, name names',
        effects: { fame: 4, scandal: { severity: 2, weeks: 6, desc: 'paparazzi feud' } },
        outcome: 'You become the story. Other stars quietly thank you.',
      },
    ],
  },
  {
    id: 'donation_revealed',
    tier: [30, 70],
    tags: ['good', 'industry'],
    condition: (p) => p.cash >= 100000,
    headline: (p) => `QUIET GENEROSITY: ${headlineName(p.name)} 'SECRETLY' FUNDED INDIE FOR YEARS`,
    flavor: () => `A small independent project you backed years ago is finally getting recognition. The director credits you in an acceptance speech. You hadn't told anyone.`,
    choices: [
      {
        label: 'Stay humble in interviews',
        effects: { fame: 3, reputation: { producer: 2 } },
        outcome: 'The "quiet patron" story has long legs. Other indie projects come knocking.',
      },
      {
        label: 'Announce more funding ($100K)',
        effects: { cash: -100000, fame: 5, reputation: { producer: 3 } },
        outcome: 'Big-hearted patron of the arts. Critics fall in love with this side of you.',
      },
      {
        label: 'Decline to comment publicly',
        effects: { fame: 2, reputation: { producer: 1 } },
        outcome: 'The silence is its own statement. The right people understand.',
      },
    ],
  },
  {
    id: 'caught_at_unflattering_event',
    tier: [25, 60],
    tags: ['rumor', 'lifestyle'],
    condition: (p) => p.fame >= 25,
    headline: (p) => `'WHAT WAS HE/SHE DOING THERE?': ${headlineName(p.name)} SPOTTED AT ${pick(['QUESTIONABLE GALA', 'CONTROVERSIAL FUNDRAISER', 'C-LIST INDUSTRY PARTY', 'CULT-ADJACENT WORKSHOP'])}`,
    flavor: () => `A photographer caught you somewhere you weren't supposed to be at. The framing is unflattering. The captions are worse. The actual story is mundane.`,
    choices: [
      {
        label: 'Explain the context (you were there for X)',
        effects: { fame: 1 },
        outcome: 'The explanation is reasonable and gets reported. People forget within a week.',
      },
      {
        label: 'Pretend nothing happened',
        effects: { scandal: { severity: 0.7, weeks: 3, desc: 'unflattering photo' } },
        outcome: 'Silence reads as guilt. The story has more legs than it should.',
      },
      {
        label: 'Mock the photographer publicly',
        effects: { fame: 2, scandal: { severity: 1, weeks: 3, desc: 'photographer feud' } },
        outcome: 'Funny tweet/quote. Some people love it. Some take it as confirmation.',
      },
    ],
  },
  {
    id: 'late_night_appearance',
    tier: [30, 70],
    tags: ['publicity', 'good'],
    condition: (p) => p.fame >= 30 && (p.history.length >= 2 || p.inTheaters?.length > 0),
    headline: (p) => `'A REVELATION': ${headlineName(p.name)} ON ${pick(['CARSON', 'LETTERMAN', 'ARSENIO', 'JOAN RIVERS'])} HAS EVERYONE TALKING`,
    flavor: () => `Your late night appearance is being clipped and shared in every office in town. You were funny. You were sharp. The audience couldn\'t stop. Now everyone wants you on their show.`,
    choices: [
      {
        label: 'Accept every booking — milk the moment',
        effects: { fame: 5, energy: -20 },
        outcome: 'Six shows in eight weeks. You are exhausted. Your fame is real.',
      },
      {
        label: 'Take one or two more, then disappear',
        effects: { fame: 3 },
        outcome: 'Smart move. The mystique grows. Bookings come in for next year.',
      },
      {
        label: 'Decline everything else',
        effects: { fame: 1, reputation: { actor: 1 } },
        outcome: 'The "didn\'t want to overstay" reputation is valuable. Quality bookings only from here.',
      },
    ],
  },
  {
    id: 'set_visit_disaster',
    tier: [30, 70],
    tags: ['scandal', 'industry'],
    condition: (p) => p.activeProduction || (p.inTheaters?.length > 0),
    headline: (p) => `STUDIO HEAD WALKED OFF ${headlineName(p.name)}'S SET 'DISGUSTED'`,
    flavor: () => `A visit from a major studio executive to your current production reportedly ended with them walking out. The reason: unclear. Speculation: rampant. Your publicist isn\'t taking calls.`,
    choices: [
      {
        label: 'Reach out personally, smooth things over',
        effects: { energy: -10, reputation: { producer: 1 } },
        outcome: 'A private dinner the next week. The exec leaves charmed. The trade story dies.',
      },
      {
        label: 'Insist the visit was fine',
        effects: { scandal: { severity: 1, weeks: 4, desc: 'set visit disaster' } },
        outcome: 'The exec doesn\'t deny the story. The narrative takes hold.',
      },
      {
        label: 'Go on offense — claim creative interference',
        effects: { fame: 2, scandal: { severity: 2, weeks: 6, desc: 'studio dispute' } },
        outcome: 'You\'re the auteur defending your vision. Half of Hollywood agrees. The studio doesn\'t.',
      },
    ],
  },
  {
    id: 'kid_in_school_problem',
    tier: [25, 70],
    tags: ['lifestyle', 'family'],
    condition: (p) => (p.personal.children || []).some(c => p.year - c.born >= 5 && p.year - c.born <= 16),
    headline: (p) => `'TROUBLES AT SCHOOL': SOURCES SAY ${headlineName(p.name)}'S CHILD STRUGGLING UNDER SPOTLIGHT`,
    flavor: () => `Your kid\'s private school has had reporters loitering at pickup. Parents at the school are talking. A "source close to the family" — possibly a teacher — described "behavioral incidents."`,
    choices: [
      {
        label: 'Pull them from school, hire private tutors',
        effects: { cash: -50000, fame: -1, relationshipHealth: 5 },
        outcome: 'The school stops being news. Your child has structure. Your accountant has questions.',
      },
      {
        label: 'Make a public statement about privacy',
        effects: { fame: 1, scandal: { severity: 0.5, weeks: 3, desc: 'family privacy plea' } },
        outcome: 'The statement is reprinted everywhere. The substance, ironically, gets more attention.',
      },
      {
        label: 'Sue the source',
        effects: { cash: -20000, scandal: { severity: 1.5, weeks: 5, desc: 'family lawsuit' } },
        outcome: 'The source is identified. They\'re a part-time custodian. The story metastasizes.',
      },
    ],
  },
  {
    id: 'rival_studio_poach',
    tier: [40, 75],
    tags: ['industry'],
    condition: (p) => p.reputation.actor >= 30 || p.reputation.director >= 30 || p.fame >= 40,
    headline: (p) => `'BIDDING WAR': RIVAL STUDIOS DANGLE ${headlineName(p.name)} MULTI-PICTURE DEAL`,
    flavor: () => `Three studios are reportedly competing to lock you into a long-term deal. Numbers being floated are large. Your agent is delighted. Your publicist is leaking everything.`,
    choices: [
      {
        label: 'Sign the biggest offer ($500K signing bonus)',
        effects: { cash: 500000, fame: 4, reputation: { actor: 2 } },
        outcome: 'Set for the next three pictures. The trades call it a coronation.',
      },
      {
        label: 'Hold out for creative control',
        effects: { fame: 2, reputation: { producer: 3, director: 2 } },
        outcome: 'No signing bonus. But the next deal you make is on your terms.',
      },
      {
        label: 'Decline all of them',
        effects: { fame: 3, reputation: { actor: 3 } },
        outcome: 'Independent and untouchable. The respect is enormous. So are the missed paychecks.',
      },
    ],
  },

  // ============ NEW: SUPERSTAR (fame 60-100) ============

  {
    id: 'biographer_unauthorized',
    tier: [55, 100],
    tags: ['scandal', 'industry'],
    condition: (p) => p.fame >= 55 && p.history.length >= 5,
    headline: (p) => `'EVERYTHING YOU NEVER WANTED PUBLIC': UNAUTHORIZED ${headlineName(p.name)} BIO HITS SHELVES`,
    flavor: () => `A 400-page book has appeared. The author had been calling old colleagues for two years and you hadn't known. The early excerpts are devastating.`,
    choices: [
      {
        label: 'Threaten the publisher with litigation',
        effects: { cash: -50000, scandal: { severity: 1.5, weeks: 6, desc: 'book lawsuit' } },
        outcome: 'They print a corrected second edition. Sales double from the publicity.',
      },
      {
        label: 'Write your own memoir as a response',
        effects: { cash: 200000, fame: 5, energy: -25 },
        outcome: 'Six months of writing. The advance is huge. Your version sells more.',
      },
      {
        label: 'Refuse to acknowledge it exists',
        effects: { scandal: { severity: 1, weeks: 4, desc: 'unauthorized bio' } },
        outcome: 'The book has its moment, then fades. Mostly.',
      },
    ],
  },
  {
    id: 'oscar_speech_prep',
    tier: [70, 100],
    tags: ['publicity'],
    condition: (p) => (p.awards?.nominations || 0) >= 3 && p.fame >= 70,
    headline: (p) => `'OVERPREPARED'? ${headlineName(p.name)}'S OSCAR SPEECH RUMORED TO BE 'FULLY MEMORIZED'`,
    flavor: () => `An assistant has been spotted with a thick speech draft. Various outlets are running speculation pieces about hubris. You haven\'t won yet.`,
    choices: [
      {
        label: 'Deliver something completely off-the-cuff',
        effects: { fame: 4, reputation: { actor: 2 } },
        outcome: 'The improv works. Genuine, emotional, viral. The story shifts.',
      },
      {
        label: 'Stick to the prepared speech',
        effects: { fame: 2 },
        outcome: 'It\'s polished. It\'s good. Some say "rehearsed." Most say "earned."',
      },
      {
        label: 'Open with a joke about the rumor',
        effects: { fame: 5 },
        outcome: 'Self-deprecation is the room\'s favorite mood. The bit gets quoted for years.',
      },
    ],
  },
  {
    id: 'jet_purchase_optics',
    tier: [70, 100],
    tags: ['lifestyle', 'scandal'],
    condition: (p) => p.cash >= 5_000_000,
    headline: (p) => `'OUT OF TOUCH': ${headlineName(p.name)} REPORTEDLY EYEING $${pick(['8', '12', '15'])}M PRIVATE JET`,
    flavor: () => `Tabloids got the broker\'s name and the model number. The think-piece writers have started warming up. Hollywood is performatively horrified.`,
    choices: [
      {
        label: 'Buy it anyway, fly it openly',
        effects: { cash: -10000000, fame: 3, scandal: { severity: 1.5, weeks: 4, desc: 'private jet' } },
        outcome: 'A few hot takes. But every studio in town can now reach you in three hours.',
      },
      {
        label: 'Cancel the purchase publicly',
        effects: { fame: 2, reputation: { producer: 2 } },
        outcome: '"Sober reflection" press. People appreciate it. The story flips entirely.',
      },
      {
        label: 'Lease it quietly through a holding company',
        effects: { cash: -100000, scandal: { severity: 0.5, weeks: 2, desc: 'jet rumors' } },
        outcome: 'The story dies. The jet is in the air the next week. Nobody notices.',
      },
    ],
  },
  {
    id: 'late_career_revival',
    tier: [55, 100],
    tags: ['good', 'career'],
    condition: (p) => p.age >= 50 && p.history.length >= 8,
    headline: (p) => `'COMEBACK': ${headlineName(p.name)} 'GREATEST PERFORMANCE IN YEARS'`,
    flavor: () => `Two critics in the same week. The phrase is "career-best." You\'re in the middle of what some are calling a "late renaissance." Funny how that works.`,
    choices: [
      {
        label: 'Lean in — take a serious dramatic role',
        effects: { fame: 4, reputation: { actor: 4 } },
        outcome: 'The "I\'m still working" press cycle. Your next picture\'s box office benefits.',
      },
      {
        label: 'Stay quiet, let the work do it',
        effects: { fame: 2, reputation: { actor: 3 } },
        outcome: 'Slow build. Industry respect compounds.',
      },
      {
        label: 'Push back: "I\'ve been doing this all along"',
        effects: { fame: 3, reputation: { actor: 2 } },
        outcome: 'A correction the press takes seriously. Old fans cheer.',
      },
    ],
  },
  {
    id: 'business_failure',
    tier: [55, 100],
    tags: ['scandal', 'industry'],
    condition: (p) => p.studio && p.fame >= 55 && (p.studio.flops || 0) >= 2,
    headline: (p) => `'CAN'T BUY A HIT': ${headlineName(p.name)}'S STUDIO CONCERN`,
    flavor: () => `A long trade-paper piece dissects your studio\'s recent run. The words "vanity," "out of touch," and "needs a hit" appear. Investors are quoted, mostly anonymously.`,
    choices: [
      {
        label: 'Announce a major personal investment',
        effects: { cash: -500000, fame: 1, reputation: { producer: 1 } },
        outcome: 'Skin in the game. The narrative shifts from "vanity" to "comeback."',
      },
      {
        label: 'Fire your COO publicly',
        effects: { fame: 2, scandal: { severity: 1, weeks: 4, desc: 'studio shakeup' } },
        outcome: 'Someone took the fall. The piece wraps up. The work doesn\'t change.',
      },
      {
        label: 'Defend the slate aggressively',
        effects: { scandal: { severity: 1.2, weeks: 4, desc: 'studio defense' } },
        outcome: 'The piece gets reprinted. Trade reporters look harder at next year\'s slate.',
      },
    ],
  },
  {
    id: 'home_robbery',
    tier: [50, 100],
    tags: ['scandal', 'lifestyle'],
    condition: (p) => p.fame >= 50 && (p.possessions || []).some(id => {
      const item = PURCHASES.find(x => x.id === id);
      return item && item.category === 'lifestyle' && item.price >= 500000;
    }),
    headline: (p) => `BREAK-IN: ${headlineName(p.name)}'S ${pick(['MANSION', 'ESTATE', 'COMPOUND'])} ROBBED OVERNIGHT`,
    flavor: () => `Three bedrooms, the safe, the garage. The police are investigating. The losses include "items of sentimental value." Your publicist is everywhere.`,
    choices: [
      {
        label: 'Stay quiet and let police work',
        effects: { fame: 1, scandal: { severity: 0.4, weeks: 2, desc: 'home robbery' } },
        outcome: 'Two suspects arrested in three weeks. The story has a clean ending.',
      },
      {
        label: 'Public plea + reward ($50K)',
        effects: { cash: -50000, fame: 3 },
        outcome: 'The reward gets results. Tips flood in. The case closes.',
      },
      {
        label: 'Use it: do interviews about your trauma',
        effects: { fame: 4, scandal: { severity: 0.7, weeks: 3, desc: 'robbery aftermath' } },
        outcome: 'Empathy. Cover stories. Some cynicism, too.',
      },
    ],
  },
  {
    id: 'rival_book_pan',
    tier: [60, 100],
    tags: ['feud', 'industry'],
    condition: (p) => p.fame >= 60 && p.history.length >= 6,
    headline: (p) => `${headlineName(p.name)} 'TRASHED' IN NEW BESTSELLING MEMOIR FROM ${pick(['LEGENDARY DIRECTOR', 'ACADEMY-WINNING ACTOR', 'STUDIO HEAD'])}`,
    flavor: () => `An older industry figure\'s tell-all has a whole chapter on you. None of it is flattering. None of it is libelous. Some of it might be true.`,
    choices: [
      {
        label: 'Class — congratulate them on the bestseller',
        effects: { fame: 2, reputation: { actor: 2, producer: 2 } },
        outcome: 'The contrast lands. People take your side without you asking.',
      },
      {
        label: 'Sue for libel',
        effects: { cash: -100000, scandal: { severity: 2, weeks: 8, desc: 'memoir lawsuit' } },
        outcome: 'The case drags. Discovery is brutal. You settle. Nobody comes out clean.',
      },
      {
        label: 'Hint that your own book is coming',
        effects: { fame: 3, scandal: { severity: 1, weeks: 4, desc: 'memoir feud' } },
        outcome: 'Publishers call within 48 hours. The story has a sequel.',
      },
    ],
  },
  {
    id: 'lifetime_achievement_buzz',
    tier: [75, 100],
    tags: ['good', 'industry'],
    condition: (p) => p.age >= 55 && p.fame >= 75 && (p.awards?.wins || 0) >= 2,
    headline: (p) => `'OVERDUE': WHISPERS OF LIFETIME ACHIEVEMENT NOMINATION FOR ${headlineName(p.name)}`,
    flavor: () => `Three different award bodies are reportedly considering a lifetime achievement honor. The phrase "career retrospective" is being used. You're not sure how to feel about that.`,
    choices: [
      {
        label: 'Embrace it — start preparing remarks',
        effects: { fame: 4, reputation: { actor: 3 } },
        outcome: 'A gracious acceptance. Industry-wide standing ovation. The retrospective tape plays.',
      },
      {
        label: 'Quietly signal you\'re "not done yet"',
        effects: { fame: 2, reputation: { actor: 2, director: 2, writer: 2, producer: 2 } },
        outcome: 'The bodies hold off. You announce a new project. Everyone takes the hint.',
      },
      {
        label: 'Take a victory lap publicly',
        effects: { fame: 5, scandal: { severity: 0.4, weeks: 2, desc: 'self-congratulation' } },
        outcome: 'You won\'t live this down. But you also won. Worth it? Probably.',
      },
    ],
  },
  {
    id: 'casting_controversy',
    tier: [50, 100],
    tags: ['scandal', 'industry'],
    condition: (p) => p.activeProduction && p.fame >= 50,
    headline: (p) => `'WRONG CHOICE': ${headlineName(p.name)} FACES CRITICISM OVER ${pick(['CASTING', 'CO-STAR', 'DIRECTOR'])} DECISION`,
    flavor: () => `A casting choice on your current production is generating a public debate. Letters to the editor. Op-eds. Some thoughtful, some bad-faith. None of it good for the production.`,
    choices: [
      {
        label: 'Defend the choice thoughtfully',
        effects: { fame: 1, reputation: { producer: 2 } },
        outcome: 'A nuanced press cycle. The film benefits from the conversation.',
      },
      {
        label: 'Recast — eat the cost',
        effects: { cash: -200000, fame: -1, scandal: { severity: 0.5, weeks: 2, desc: 'recast controversy' } },
        outcome: 'A capitulation. Two factions are now mad. The production survives.',
      },
      {
        label: 'Refuse to discuss it at all',
        effects: { scandal: { severity: 1, weeks: 4, desc: 'casting silence' } },
        outcome: 'Silence reads as confirmation. The film opens to a culture-war reception.',
      },
    ],
  },
  {
    id: 'old_film_resurrected',
    tier: [50, 100],
    tags: ['good', 'career'],
    condition: (p) => p.history.length >= 8 && p.fame >= 50,
    headline: (p) => `${pick(['REVIVAL', 'RE-RELEASE', 'RESTORATION'])}: ${headlineName(p.name)}'S OLD FLOP NOW A CULT CLASSIC`,
    flavor: () => `A film that flopped years ago has been rediscovered. Repertory theaters are programming it. A whole new generation of critics is writing about it. The trades are using "vindicated."`,
    choices: [
      {
        label: 'Attend a midnight screening — give a Q&A',
        effects: { fame: 3, reputation: { actor: 2, director: 2 } },
        outcome: 'The audience is electric. The Q&A video circulates. You feel younger.',
      },
      {
        label: 'License a remaster ($50K)',
        effects: { cash: -50000, fame: 4 },
        outcome: 'The Criterion-style release sells well. You get profit participation for years.',
      },
      {
        label: 'Joke that you always knew',
        effects: { fame: 2 },
        outcome: 'The interview clip plays for weeks. Half-self-deprecating, half-vindication.',
      },
    ],
  },

  // ============ NEW: AGE & LEGACY (any fame, late career) ============

  {
    id: 'ageism_complaint',
    tier: [25, 100],
    tags: ['scandal', 'career'],
    condition: (p) => p.age >= 45,
    headline: (p) => `'CAN'T GET CAST': ${headlineName(p.name)} BREAKS SILENCE ON HOLLYWOOD AGEISM`,
    flavor: () => `An interview given quietly is suddenly everywhere. Your remarks about the industry\'s treatment of older performers are getting praise from some, eyerolls from others.`,
    choices: [
      {
        label: 'Double down — give more interviews',
        effects: { fame: 3, scandal: { severity: 0.6, weeks: 3, desc: 'ageism speech' } },
        outcome: 'A movement forms around the comments. Some good roles follow. Some doors close.',
      },
      {
        label: 'Walk it back: "I was venting"',
        effects: { reputation: { actor: -1 } },
        outcome: 'You lose moral ground without gaining material ground. A poor trade.',
      },
      {
        label: 'Found a production company for older performers',
        effects: { cash: -300000, fame: 5, reputation: { producer: 4 } },
        outcome: 'A purpose-driven move. Industry coverage is unanimously positive. Your slate fills.',
      },
    ],
  },
];

// ============ END OF NEW TABLOID EVENTS ============

// Pick a tabloid event applicable to current state, or null if none.
// Uses fame tier filtering, weight-based selection, anti-repeat memory.
function chooseTabloidEvent(player) {
  const recentIds = (player.tabloidHistory || [])
    .slice(-15)
    .map(t => t.eventId);

  // Eligible: condition true, in fame tier, not a chain-only event, not recent
  const eligible = TABLOID_EVENTS.filter(e => {
    if (e.tags?.includes('followup')) return false; // chain-only
    if (!e.condition(player)) return false;
    const [minFame, maxFame] = e.tier || [0, 100];
    if (player.fame < minFame || player.fame > maxFame) return false;
    if (recentIds.includes(e.id)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Weighted pick
  const totalWeight = eligible.reduce((s, e) => s + (e.weight || 1), 0);
  let roll = Math.random() * totalWeight;
  let chosen = eligible[0];
  for (const e of eligible) {
    roll -= (e.weight || 1);
    if (roll <= 0) { chosen = e; break; }
  }

  // Build context (for templates that need extra data)
  const ctx = chosen.contextBuilder ? chosen.contextBuilder(player) : {};

  // Antagonist memory: if the contextual NPC has appeared in prior tabloid stories,
  // prepend a recurrence marker to make the story feel like part of an ongoing saga
  let headline = genTabloidHeadline(chosen, player, ctx);
  let flavor = typeof chosen.flavor === 'function' ? chosen.flavor(player, ctx) : chosen.flavor;
  const targetNpcId = ctx.rivalId || ctx.friendId;
  if (targetNpcId) {
    const priorMentions = (player.tabloidHistory || []).filter(t => t.mentionedNpcId === targetNpcId).length;
    if (priorMentions >= 1) {
      // Add a saga prefix
      const prefix = priorMentions >= 3
        ? 'IT NEVER ENDS: '
        : priorMentions >= 2
          ? 'AGAIN! '
          : 'ROUND TWO: ';
      headline = prefix + headline;
      // And add a one-liner to the flavor about the recurrence
      const npcName = ctx.rivalName || ctx.friendName || 'them';
      const sagaLine = priorMentions >= 3
        ? ` This is the ${priorMentions === 3 ? 'fourth' : priorMentions === 4 ? 'fifth' : 'umpteenth'} time you and ${npcName} have made the papers together. Hollywood is keeping score.`
        : ` After your last public moment with ${npcName}, the press was bound to come back to this.`;
      flavor = flavor + sagaLine;
    }
  }

  return {
    id: chosen.id,
    headline,
    flavor,
    choices: chosen.choices,
    tags: chosen.tags || [],
    ctx, // preserve context (e.g., rivalId, friendName) for outcome resolution
  };
}

// Look up a chain event template by id and build it for the player
function buildChainEvent(eventId, player) {
  const template = TABLOID_EVENTS.find(e => e.id === eventId);
  if (!template) return null;
  const ctx = template.contextBuilder ? template.contextBuilder(player) : {};
  return {
    id: template.id,
    headline: genTabloidHeadline(template, player, ctx),
    flavor: typeof template.flavor === 'function' ? template.flavor(player, ctx) : template.flavor,
    choices: template.choices,
    tags: template.tags || [],
    ctx,
  };
}

// ---------- WORLD NPCS (PERSISTENT INDUSTRY FIGURES) ----------
//
// A small pool of named industry figures who age alongside the player,
// accumulate their own careers and awards, and recur across systems
// (auditions, awards, tabloids, sequels). They become the textured
// supporting cast — the rivals, the friends, the legends.
//
// Lifecycle:
//   - At game start, seed ~8-12 NPCs with varied ages and specialties
//   - Each year, NPCs age, their careers progress, their fame drifts
//   - When the game needs a "real industry figure" name for high-stakes
//     contexts (award finalists, major co-stars), draw from this pool
//   - Track rivalry: every direct head-to-head (award, casting, feud)
//     increments a counter. 3+ events = "named rival" label.
//
// Persistence: stored on player.worldNPCs as { [id]: NPC }

const NPC_SPECIALTIES = [
  { role: 'actor', label: 'Actor', weight: 4 },
  { role: 'director', label: 'Director', weight: 2 },
  { role: 'producer', label: 'Producer', weight: 1 },
  { role: 'writer', label: 'Screenwriter', weight: 1.5 },
];

const NPC_ARCHETYPES = [
  'Method Star', 'Box Office Draw', 'Critics\' Darling', 'Action Hero',
  'Comedy Icon', 'Indie Auteur', 'Studio Workhorse', 'Awards Magnet',
  'Has-Been', 'Fading Star', 'Up-and-Comer', 'Industry Veteran',
];

// Generate a single NPC. tier influences starting fame.
function generateWorldNPC(currentYear, tier = 'mid') {
  // Pick specialty (weighted)
  const totalWeight = NPC_SPECIALTIES.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * totalWeight;
  let spec = NPC_SPECIALTIES[0];
  for (const s of NPC_SPECIALTIES) {
    roll -= s.weight;
    if (roll <= 0) { spec = s; break; }
  }

  // Fame range by tier
  let fameMin, fameMax, ageMin, ageMax;
  if (tier === 'top') { fameMin = 75; fameMax = 95; ageMin = 35; ageMax = 65; }
  else if (tier === 'high') { fameMin = 55; fameMax = 80; ageMin = 28; ageMax = 60; }
  else if (tier === 'low') { fameMin = 10; fameMax = 35; ageMin = 22; ageMax = 50; }
  else { fameMin = 30; fameMax = 60; ageMin = 25; ageMax = 55; } // mid

  const age = randInt(ageMin, ageMax);
  const fame = randInt(fameMin, fameMax);
  const skill = clamp(fame + randInt(-10, 15), 20, 95);

  return {
    id: `npc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: generateName(),
    role: spec.role,
    roleLabel: spec.label,
    archetype: pick(NPC_ARCHETYPES),
    age,
    bornYear: currentYear - age,
    fame,
    skill,
    careerStart: currentYear - randInt(2, age - 18),
    filmCount: randInt(1, Math.max(2, age - 22)),
    awardWins: randInt(0, Math.floor(fame / 25)),
    awardNoms: randInt(0, Math.floor(fame / 15)),
    status: 'active', // active | retired | disgraced
    // Relationship to player: built up over career
    rivalryScore: 0,    // -ish to +5+; player rivalry meter
    friendshipScore: 0, // collaborations stack here
    history: [],        // [{ year, type, detail }] — career events
    // Current trajectory: -1 = fading, 0 = steady, +1 = rising
    trajectory: pick([-1, 0, 0, 0, 1]),
  };
}

// Seed the world with a starting roster of NPCs
function seedWorldNPCs(startYear) {
  const npcs = {};
  // 2 top-tier stars
  for (let i = 0; i < 2; i++) {
    const npc = generateWorldNPC(startYear, 'top');
    npcs[npc.id] = npc;
  }
  // 4 mid-tier
  for (let i = 0; i < 4; i++) {
    const npc = generateWorldNPC(startYear, 'high');
    npcs[npc.id] = npc;
  }
  // 4 working
  for (let i = 0; i < 4; i++) {
    const npc = generateWorldNPC(startYear, 'mid');
    npcs[npc.id] = npc;
  }
  // 2 low-tier (rising or fading)
  for (let i = 0; i < 2; i++) {
    const npc = generateWorldNPC(startYear, 'low');
    npcs[npc.id] = npc;
  }
  return npcs;
}

// Annual tick: advance NPCs' careers, age them, retire some
function tickWorldNPCs(worldNPCs, currentYear) {
  const updated = {};
  for (const id in worldNPCs) {
    const npc = worldNPCs[id];
    if (npc.status === 'retired' || npc.status === 'disgraced') {
      updated[id] = npc; // frozen
      continue;
    }
    let n = { ...npc };
    n.age += 1;
    // Trajectory shifts: random walk weighted by age
    if (Math.random() < 0.2) {
      const shift = pick([-1, 0, 1]);
      n.trajectory = clamp(n.trajectory + shift, -2, 2);
    }
    // Fame drift based on trajectory + age decay
    let fameDelta = n.trajectory * randInt(1, 4);
    if (n.age > 55) fameDelta -= 1;
    if (n.age > 65) fameDelta -= 2;
    n.fame = clamp(n.fame + fameDelta, 0, 100);
    n.peakFame = Math.max(n.peakFame || n.fame, n.fame);
    // Films per year — chance scales with fame
    const filmChance = 0.3 + n.fame / 200;
    if (Math.random() < filmChance) {
      n.filmCount += 1;
      // Chance of award nom — scales with fame
      if (Math.random() < n.fame / 250) {
        n.awardNoms += 1;
        if (Math.random() < 0.3) {
          n.awardWins += 1;
          n.history.push({ year: currentYear, type: 'award_win', detail: 'won a major award' });
        } else {
          n.history.push({ year: currentYear, type: 'award_nom', detail: 'was nominated' });
        }
      }
    }
    // Retirement chance — scales with age and low fame
    if (n.age >= 65 && Math.random() < 0.08 + (75 - n.age < 0 ? 0.15 : 0)) {
      n.status = 'retired';
      n.history.push({ year: currentYear, type: 'retired', detail: 'retired from the industry' });
    }
    updated[id] = n;
  }
  return updated;
}

// Pick an NPC suitable for a context (role, fame tier). Returns NPC or null.
function pickWorldNPC(worldNPCs, role, minFame = 0, maxFame = 100, excludeIds = []) {
  const eligible = Object.values(worldNPCs || {}).filter(n =>
    n.status === 'active' &&
    n.role === role &&
    n.fame >= minFame &&
    n.fame <= maxFame &&
    !excludeIds.includes(n.id)
  );
  if (eligible.length === 0) return null;
  return pick(eligible);
}

// Record an event in an NPC's relationship to the player
// type: 'rivalry_award', 'rivalry_role', 'rivalry_feud', 'collaboration', 'friendship'
function recordNPCEvent(worldNPCs, npcId, type, currentYear, detail) {
  const npc = worldNPCs[npcId];
  if (!npc) return worldNPCs;
  const updated = { ...npc };
  updated.history = [...(npc.history || []), { year: currentYear, type, detail }];
  if (type.startsWith('rivalry')) {
    updated.rivalryScore = (npc.rivalryScore || 0) + 1;
  } else if (type === 'collaboration') {
    updated.friendshipScore = (npc.friendshipScore || 0) + 1;
  } else if (type === 'friendship') {
    updated.friendshipScore = (npc.friendshipScore || 0) + 2;
  }
  return { ...worldNPCs, [npcId]: updated };
}

// Maintain pool size: replace retired/inactive NPCs with up-and-comers
function maintainWorldPool(worldNPCs, currentYear) {
  const active = Object.values(worldNPCs).filter(n => n.status === 'active');
  if (active.length < 8) {
    const updated = { ...worldNPCs };
    const toAdd = 8 - active.length;
    for (let i = 0; i < toAdd; i++) {
      // New entrants are usually up-and-comers
      const npc = generateWorldNPC(currentYear, Math.random() < 0.7 ? 'low' : 'mid');
      // Tag as up-and-comer in archetype
      npc.archetype = 'Up-and-Comer';
      npc.trajectory = 1;
      updated[npc.id] = npc;
    }
    return updated;
  }
  return worldNPCs;
}

// Find films the player and a given NPC made together. Searches both history
// (closed) and inTheaters (active). Returns sorted oldest-first.
function findSharedFilms(player, npcId) {
  const all = [...(player.history || []), ...(player.inTheaters || [])];
  const shared = [];
  for (const film of all) {
    if (!film.crew) continue;
    for (const role of ['actor', 'director', 'writer', 'producer']) {
      if (film.crew[role]?.npcId === npcId) {
        shared.push({
          title: film.title,
          year: film.releaseYear || film.year,
          role,
          hit: !!film.result?.hit,
          flop: !!film.result?.flop,
        });
        break; // only one entry per film even if NPC is in multiple roles
      }
    }
  }
  return shared.sort((a, b) => a.year - b.year);
}


// ---------- PLANTED STORY TEMPLATES ----------
//
// Proactive PR options the player can pay their publicist to leak.
// Each plant has:
//   id, label, description     — UI display
//   cost                       — cash spent on the PR firm + payola
//   condition(p)               — eligibility (e.g., requires partner, recent film, etc.)
//   fameGain                   — base fame gained on success
//   backfireChance             — probability the press traces it back to a plant (0-1)
//   backfireSeverity           — scandal severity if it backfires
//   headline(p, ctx)           — the leaked headline
//   flavor(p, ctx)             — the story's lede when it runs
//   backfireHeadline(p, ctx)   — alternate headline if exposed as a plant
//   backfireFlavor(p, ctx)     — the exposure story
//   tags                       — for archive filtering

const PLANT_STORIES = [
  {
    id: 'plant_quiet_charity',
    label: 'Quiet Philanthropy',
    description: 'Leak a story about your generous, low-key donation to a good cause.',
    cost: 25_000,
    fameGain: 3,
    backfireChance: 0.08,
    backfireSeverity: 0.6,
    condition: (p) => p.cash >= 25_000,
    tags: ['planted', 'good'],
    headline: (p) => `${headlineName(p.name)} 'QUIETLY' DONATES TO ${pick(['CHILDREN\'S HOSPITAL', 'AIDS RESEARCH', 'LITERACY FUND', 'HOMELESS SHELTER'])}`,
    flavor: () => `A source "close to the production" tells the Trades you've been making sizable, anonymous donations for years. The "quiet hero" framing is meticulous. Your publicist did not return calls for comment.`,
    backfireHeadline: (p) => `${headlineName(p.name)}'S 'SECRET CHARITY' WAS A PR PLANT, SOURCES CLAIM`,
    backfireFlavor: () => `A rival publicist leaked the original pitch deck. The story falls apart in a week. Everyone in town is talking about it for all the wrong reasons.`,
  },
  {
    id: 'plant_hometown_visit',
    label: 'Hometown Visit',
    description: 'A wholesome "they never forgot where they came from" story.',
    cost: 8_000,
    fameGain: 2,
    backfireChance: 0.04,
    backfireSeverity: 0.4,
    condition: () => true,
    tags: ['planted', 'good'],
    headline: (p) => `${headlineName(p.name)} GOES HOME — VISITS ${pick(['HIGH SCHOOL', 'OLD NEIGHBORHOOD', 'CHILDHOOD CHURCH', 'LOCAL DINER'])}`,
    flavor: () => `Local paper got the scoop. Photos of you signing autographs at a small-town diner. Old friends quoted. Just enough nostalgia.`,
    backfireHeadline: (p) => `${headlineName(p.name)}'S 'HOMETOWN VISIT' STAGED, FORMER CLASSMATE CLAIMS`,
    backfireFlavor: () => `Someone you didn't recognize at the diner has a different story to tell. A magazine prints it. It's mostly true.`,
  },
  {
    id: 'plant_method_actor',
    label: 'Method Commitment',
    description: 'Leak how much you sacrificed for your most recent role. Boosts critic perception of your last film.',
    cost: 15_000,
    fameGain: 2,
    backfireChance: 0.15,
    backfireSeverity: 0.8,
    condition: (p) => p.history.length > 0 || (p.inTheaters && p.inTheaters.length > 0),
    tags: ['planted', 'career'],
    headline: (p) => {
      const recent = p.history[p.history.length - 1] || p.inTheaters?.[0];
      return `${headlineName(p.name)} 'LOST 20 POUNDS, LEARNED FOUR LANGUAGES' FOR "${recent?.title?.toUpperCase() || 'RECENT FILM'}"`;
    },
    flavor: (p) => {
      const recent = p.history[p.history.length - 1] || p.inTheaters?.[0];
      return `A behind-the-scenes piece in a major trade paper details your "obsessive preparation" for "${recent?.title || 'the part'}." The director (off-record) calls it "the most committed performance I've ever seen."`;
    },
    backfireHeadline: (p) => `'METHOD' STAR ${headlineName(p.name)}'S COMMITMENT 'EXAGGERATED' — INSIDERS`,
    backfireFlavor: () => `Three crew members give an interview pushing back on the legend. Their version is less flattering.`,
  },
  {
    id: 'plant_secret_romance',
    label: 'Strategic Romance Leak',
    description: 'Leak photos of you and your partner being adorable in public. Cheaper PR, big visibility.',
    cost: 12_000,
    fameGain: 4,
    backfireChance: 0.10,
    backfireSeverity: 0.7,
    condition: (p) => p.personal.status === 'dating' || p.personal.status === 'married',
    tags: ['planted', 'romance'],
    headline: (p) => `${headlineName(p.name)} & ${headlineName(p.personal.partner.name)} 'CAUGHT' BEING ADORABLE IN MALIBU`,
    flavor: (p) => `Photos surface of you and ${p.personal.partner.name} ${pick(['holding hands at the farmers market', 'laughing together at a small cafe', 'walking the dog at sunset', 'shopping for art at a gallery opening'])}. Every magazine wants the cover.`,
    backfireHeadline: (p) => `${headlineName(p.name)}-${headlineName(p.personal.partner?.name || 'PARTNER')} ROMANCE LEAK STAGED, PHOTOGRAPHER ADMITS`,
    backfireFlavor: () => `A paparazzi photog says he was paid. The relationship is real but the photos weren't candid. People feel a little fooled.`,
  },
  {
    id: 'plant_mentor',
    label: 'Mentor to an Up-and-Comer',
    description: 'Position yourself as the wise veteran taking a young star under your wing.',
    cost: 18_000,
    fameGain: 3,
    backfireChance: 0.07,
    backfireSeverity: 0.5,
    condition: (p) => p.fame >= 50 && p.history.length >= 3,
    tags: ['planted', 'industry'],
    headline: (p) => `${headlineName(p.name)} TAKES ${headlineName(generateName())} UNDER WING — 'PASSING THE TORCH'`,
    flavor: () => `A profile piece in a major magazine. You're photographed at lunch with a hot young rising star, giving career advice. Quotes about "giving back to the next generation." Casting directors call you sage and gracious.`,
    backfireHeadline: (p) => `${headlineName(p.name)}'S 'MENTORSHIP' MOMENT 'PURELY FOR THE CAMERAS'`,
    backfireFlavor: () => `The young star clarifies in their next interview that "we'd met once." It's awkward for everyone.`,
  },
  {
    id: 'plant_transformation',
    label: 'Dramatic Transformation',
    description: 'Build buzz around physical changes for an upcoming role. Only works while in production.',
    cost: 22_000,
    fameGain: 3,
    backfireChance: 0.12,
    backfireSeverity: 0.6,
    condition: (p, production) => !!production,
    tags: ['planted', 'career'],
    headline: (p) => `${headlineName(p.name)} 'UNRECOGNIZABLE' FOR UPCOMING ROLE`,
    flavor: () => `A "set source" gives a magazine grainy photos of your physical transformation. The captions use words like "shocking" and "transformative." The story runs in three magazines simultaneously.`,
    backfireHeadline: (p) => `${headlineName(p.name)} 'TRANSFORMATION' PHOTOS DOCTORED, EXPERT SAYS`,
    backfireFlavor: () => `A photo analyst makes their case in the trades. Your camp denies it. The story has legs anyway.`,
  },
  {
    id: 'plant_humanitarian',
    label: 'UN Humanitarian Trip',
    description: 'A high-profile, expensive humanitarian gesture. Big fame, big cost, real impact.',
    cost: 75_000,
    fameGain: 6,
    backfireChance: 0.05,
    backfireSeverity: 0.4,
    condition: (p) => p.fame >= 60 && p.cash >= 75_000,
    tags: ['planted', 'good'],
    headline: (p) => `${headlineName(p.name)} JOINS ${pick(['UNICEF', 'RED CROSS', 'AMNESTY'])} MISSION TO ${pick(['ETHIOPIA', 'GUATEMALA', 'CAMBODIA'])}`,
    flavor: () => `You spent ten days on the ground in a place most A-listers wouldn't visit. The photos are unstaged. The press conference afterward is moving. Diane Sawyer wants an exclusive.`,
    backfireHeadline: (p) => `${headlineName(p.name)} HUMANITARIAN TRIP 'BOOKED FOR PUBLICITY' — INSIDER`,
    backfireFlavor: () => `The trip was real. The motive, according to a former assistant, was not. The story still ends up positive — but messier.`,
  },

  // ============ NEW PLANT TEMPLATES ============

  {
    id: 'plant_mentor_young_actor',
    label: 'Mentoring a Newcomer',
    description: 'Story of you "discovering" an unknown talent and shepherding their career.',
    cost: 10_000,
    fameGain: 3,
    backfireChance: 0.10,
    backfireSeverity: 0.6,
    condition: (p) => p.fame >= 25,
    tags: ['planted', 'good'],
    headline: (p) => `'MY MENTOR': UNKNOWN ${pick(['ACTRESS', 'ACTOR', 'WRITER'])} CREDITS ${headlineName(p.name)} FOR EVERYTHING`,
    flavor: () => `A young hopeful tells a magazine about your weekly script meetings. The "passing the torch" narrative writes itself. Both of you photograph well together.`,
    backfireHeadline: (p) => `'NEVER MET ${headlineName(p.name).toUpperCase()}': MENTORED YOUNGSTER WAS A PLANT`,
    backfireFlavor: () => `The newcomer\'s actual roommate calls the trade. The two of you have spoken twice, briefly, at an industry event.`,
  },
  {
    id: 'plant_old_friend_loyal',
    label: 'Loyal to the Old Crew',
    description: 'A story about how you still get coffee with your unfamous high-school friends.',
    cost: 5_000,
    fameGain: 2,
    backfireChance: 0.06,
    backfireSeverity: 0.4,
    condition: () => true,
    tags: ['planted', 'good'],
    headline: (p) => `'STILL ONE OF US': ${headlineName(p.name)}'S OLD FRIENDS REVEAL UNCHANGED LOYALTY`,
    flavor: () => `A small-town newspaper got the exclusive: photos of you at a backyard BBQ with people from your "before fame" life. Anecdotes are sweet. None are too detailed.`,
    backfireHeadline: (p) => `${headlineName(p.name)}'S 'OLD FRIENDS' WERE PAID EXTRAS, NEIGHBOR ALLEGES`,
    backfireFlavor: () => `One person in the photos is now identified as a hired actor. The remaining attendees go quiet.`,
  },
  {
    id: 'plant_health_kick',
    label: 'Wellness Renaissance',
    description: 'A glossy magazine profile about your new health routine — running, juices, balance.',
    cost: 18_000,
    fameGain: 3,
    backfireChance: 0.12,
    backfireSeverity: 0.7,
    condition: (p) => p.fame >= 30,
    tags: ['planted', 'good'],
    headline: (p) => `INSIDE ${headlineName(p.name)}'S 'TRANSFORMATIVE' WELLNESS JOURNEY`,
    flavor: () => `Eight-page magazine spread. Crisp photos. Words like "balance," "alignment," and "intentional." A juice cleanse company quietly sponsored the shoot.`,
    backfireHeadline: (p) => `${headlineName(p.name)} 'WELLNESS' STORY WAS A BRAND DEAL, SOURCES SAY`,
    backfireFlavor: () => `The undisclosed sponsorship gets leaked. The piece is now an advertorial. The wellness brand wants its money back.`,
  },
  {
    id: 'plant_returning_to_roots',
    label: 'Returning to Theater Roots',
    description: 'A story about your humble plans to do a play "for the craft."',
    cost: 12_000,
    fameGain: 3,
    backfireChance: 0.10,
    backfireSeverity: 0.6,
    condition: (p) => p.fame >= 40,
    tags: ['planted', 'career'],
    headline: (p) => `'BACK TO BASICS': ${headlineName(p.name)} CONSIDERING OFF-BROADWAY RUN`,
    flavor: () => `A respected theater director is "in talks" with you about a small production. The leak is positioned as integrity. The play, importantly, may never happen.`,
    backfireHeadline: (p) => `'NEVER DISCUSSED': DIRECTOR DENIES ${headlineName(p.name)} THEATER RUMORS`,
    backfireFlavor: () => `The director was never asked. They\'re polite about it. But the denial is now the story.`,
  },
  {
    id: 'plant_secret_writer',
    label: 'Secret Screenwriter',
    description: 'Leak that you\'ve been quietly writing scripts under a pseudonym for years.',
    cost: 20_000,
    fameGain: 4,
    backfireChance: 0.18,
    backfireSeverity: 0.8,
    condition: (p) => p.skills.writer >= 20,
    tags: ['planted', 'career'],
    headline: (p) => `'I HAD NO IDEA': ${headlineName(p.name)} 'SECRETLY' BEHIND ${pick(['HIT INDIE', 'CRITICAL DARLING', 'AWARDS CONTENDER'])}`,
    flavor: () => `A respected colleague "lets it slip" in an interview. You wrote it under a pen name. You wanted the work judged on its merits. The narrative is gold.`,
    backfireHeadline: (p) => `ACTUAL SCREENWRITER DEMANDS CREDIT, EXPOSES ${headlineName(p.name)} CLAIM`,
    backfireFlavor: () => `Turns out the actual writer is a real person who is very alive and very upset. Receipts emerge. The story collapses.`,
  },
  {
    id: 'plant_anonymous_tip_award',
    label: 'For Your Consideration',
    description: 'Anonymous campaign tip to award voters about your "overlooked" performance.',
    cost: 30_000,
    fameGain: 2,
    backfireChance: 0.20,
    backfireSeverity: 1.0,
    condition: (p) => (p.history.length >= 1 || (p.inTheaters || []).length >= 1) && p.fame >= 35,
    tags: ['planted', 'career'],
    headline: (p) => `'SHOULD BE NOMINATED': ANONYMOUS CAMPAIGN REVIVES ${headlineName(p.name)} AWARDS BUZZ`,
    flavor: () => `Trade ads, op-eds, and "anonymous voter quotes" appear in coordinated fashion. The buzz is real. The puppet strings are slightly visible.`,
    backfireHeadline: (p) => `${headlineName(p.name)} AWARDS PUSH 'CROSSED LINES', VOTERS COMPLAIN`,
    backfireFlavor: () => `Two voters publicly complain about pressure tactics. The Academy issues a statement. You get less consideration, not more.`,
  },
  {
    id: 'plant_friend_in_high_places',
    label: 'Friend in High Places',
    description: 'A story about your "unlikely friendship" with a public figure — political, cultural, royal.',
    cost: 25_000,
    fameGain: 4,
    backfireChance: 0.15,
    backfireSeverity: 0.9,
    condition: (p) => p.fame >= 50,
    tags: ['planted', 'good'],
    headline: (p) => `'CLOSE FRIENDS': ${headlineName(p.name)} AND ${pick(['SENATOR', 'PRINCESS', 'NOBEL LAUREATE', 'BUSINESS TITAN'])} 'GETTING DINNER REGULARLY'`,
    flavor: () => `A photographer "happens" to catch you at a restaurant with someone unexpected. The story positions you as a serious cultural figure. The other party is reachable for comment.`,
    backfireHeadline: (p) => `${headlineName(p.name)}'S 'FAMOUS FRIEND' DECLINES TO CONFIRM RELATIONSHIP`,
    backfireFlavor: () => `Their press secretary calls the dinner "a meeting" and ducks further questions. The shine fades within days.`,
  },
  {
    id: 'plant_studio_breakthrough',
    label: 'Quiet Studio Success',
    description: 'Leak that your studio just signed a major distribution deal.',
    cost: 40_000,
    fameGain: 3,
    backfireChance: 0.12,
    backfireSeverity: 0.8,
    condition: (p) => !!p.studio && p.studio.releases >= 2,
    tags: ['planted', 'industry'],
    headline: (p) => `'BIG NUMBERS': ${headlineName(p.name)}'S STUDIO LANDS ${pick(['INTERNATIONAL DISTRIBUTION', 'OUTPUT DEAL', 'MULTI-YEAR PACT'])}`,
    flavor: () => `Variety leads with the story. The figures are big. The signing photograph is glossy. Two of your trade reporters had advance access.`,
    backfireHeadline: (p) => `'NO DEAL EXISTS': DISTRIBUTOR DENIES ${headlineName(p.name)} STUDIO PACT`,
    backfireFlavor: () => `The deal was in early talks, not signed. Variety prints a correction. The story becomes about the over-eager leak.`,
  },
  {
    id: 'plant_chef_kitchen',
    label: 'Home Chef Spread',
    description: 'A homey magazine spread of you cooking elaborate meals at home.',
    cost: 7_000,
    fameGain: 2,
    backfireChance: 0.05,
    backfireSeverity: 0.3,
    condition: () => true,
    tags: ['planted', 'good'],
    headline: (p) => `INSIDE ${headlineName(p.name)}'S KITCHEN: 'I COOK WHEN I CAN'T SLEEP'`,
    flavor: () => `A six-page food magazine spread. You\'re photographed making pasta from scratch. Recipes included. Authentic enough that nobody asks.`,
    backfireHeadline: (p) => `${headlineName(p.name)}'S 'HOME COOKING' SPREAD STAGED BY HIRED CHEF, ASSISTANT REVEALS`,
    backfireFlavor: () => `An ex-assistant tells a smaller magazine that the dishes were prepared by a hired chef five hours before the shoot. Minor scandal. Easily survived.`,
  },
  {
    id: 'plant_unlikely_hobby',
    label: 'Quirky Personal Hobby',
    description: 'Lifestyle piece about your unusual passion: beekeeping, pottery, vintage cars, etc.',
    cost: 6_000,
    fameGain: 2,
    backfireChance: 0.04,
    backfireSeverity: 0.3,
    condition: () => true,
    tags: ['planted', 'good'],
    headline: (p) => `'MY GREAT ESCAPE': ${headlineName(p.name)} REVEALS PASSION FOR ${pick(['BEEKEEPING', 'POTTERY', 'VINTAGE CAR RESTORATION', 'BIRDWATCHING', 'CHESS'])}`,
    flavor: () => `Charming photographs. A short paragraph about meditation and meaning. The hobby is real-enough — you bought all the gear last week.`,
    backfireHeadline: (p) => `${headlineName(p.name)} 'PASSION' BOUGHT FROM CATALOGUE WEEK BEFORE SHOOT, PHOTO CREDITS REVEAL`,
    backfireFlavor: () => `A photo metadata sleuth identifies the gear as new-out-of-box. Light embarrassment. The hobby still grows on you.`,
  },
];

// Get eligible plant stories for current player + production state
function eligiblePlants(player, production) {
  return PLANT_STORIES.filter(p => p.condition(player, production));
}


// Compute buffs/penalties from personal life state
function personalBuffs(player) {
  const p = player.personal || {};
  const buffs = {
    fameWeekly: 0,
    offerProbBonus: 0,
    energyDrain: 0,
    repBonus: 0,
    fycMult: 1,
  };
  // Married to a star → "power couple" effect
  if (p.status === 'married' && p.partner?.isStar) {
    const partnerHeat = (p.partner.fame || 0) / 100;
    buffs.fameWeekly += 0.15 * partnerHeat;
    buffs.offerProbBonus += 0.05 * partnerHeat;
  }
  // Married (any) → small image bonus
  if (p.status === 'married') {
    buffs.repBonus += 0.5; // small positive image
    if (p.relationshipHealth < 40) {
      // strained marriage drags fame slightly
      buffs.fameWeekly -= 0.05;
    }
  }
  // Kids → drain energy, small rep boost
  const numKids = (p.children || []).length;
  if (numKids > 0) {
    buffs.energyDrain += numKids * 1.5; // per week
    buffs.repBonus += numKids * 0.3;
  }
  // Active scandals → fame drag, offer prob drag
  const activeScandals = player.scandals || [];
  for (const s of activeScandals) {
    buffs.fameWeekly -= s.severity * 0.1;
    buffs.offerProbBonus -= s.severity * 0.04;
    buffs.fycMult *= (1 - s.severity * 0.05);
  }
  return buffs;
}

// Weekly upkeep cost from kids (private schools, nannies)
function childUpkeep(player) {
  const numKids = (player.personal?.children || []).length;
  return numKids * 500; // $500/wk per kid
}

// ---------- GENRE SPECIALIZATION ----------
//
// Track which genres the player has worked in. Reaching thresholds in a
// single genre awards a specialty tag with mechanical effects.
//   3 films  → "Working In [Genre]"   (small bonus)
//   6 films  → "[Genre] Specialist"    (real bonus, more offers in genre)
//   10 films → "[Genre] Icon"          (huge bonus in genre; small penalty out)
//
// Players can have multiple specialties (Spielberg did action AND drama).

const SPECIALTY_TIERS = [
  { min: 3, label: 'Working In' },
  { min: 6, label: 'Specialist' },
  { min: 10, label: 'Icon' },
];

// Get specialty info for the player in a given genre.
// Returns null if no specialty yet.
function getGenreSpecialty(player, genre) {
  const count = (player.genreCredits || {})[genre] || 0;
  let tier = null;
  for (const t of SPECIALTY_TIERS) {
    if (count >= t.min) tier = t;
  }
  if (!tier) return null;
  return { genre, count, tier };
}

// All specialties the player has
function allSpecialties(player) {
  const result = [];
  for (const g in (player.genreCredits || {})) {
    const sp = getGenreSpecialty(player, g);
    if (sp) result.push(sp);
  }
  return result.sort((a, b) => b.count - a.count);
}

// Compute genre-specific buffs/penalties for a given film
function genreSpecialtyEffects(player, filmGenre) {
  const effects = { quality: 0, audience: 0, offerProb: 0, fameMult: 1 };
  const specialty = getGenreSpecialty(player, filmGenre);
  if (specialty) {
    // Working In: +2 quality, +5% offer prob
    // Specialist: +5 quality, +12% offer prob, +3 audience
    // Icon: +8 quality, +20% offer prob, +5 audience, 1.2x fame from this film
    if (specialty.tier.label === 'Working In') {
      effects.quality += 2;
      effects.offerProb += 0.05;
    } else if (specialty.tier.label === 'Specialist') {
      effects.quality += 5;
      effects.audience += 3;
      effects.offerProb += 0.12;
    } else if (specialty.tier.label === 'Icon') {
      effects.quality += 8;
      effects.audience += 5;
      effects.offerProb += 0.20;
      effects.fameMult = 1.2;
    }
  } else {
    // Penalty: if player is an Icon in *another* genre, they take a small hit working outside it
    const specs = allSpecialties(player);
    const hasIcon = specs.some(s => s.tier.label === 'Icon');
    if (hasIcon) {
      effects.quality -= 2;
      effects.audience -= 3;
    }
  }
  return effects;
}

// ---------- PURCHASABLE ITEMS CATALOG ----------
//
// Items the player can buy. Each item has:
//   id, category, name, price, weeklyUpkeep, fameRequired (or repRequired/studioRequired),
//   effects: { fameWeekly, energyRegenBonus, offerQualityBonus, studioBudgetCap, ... },
//   flavor: a sentence to make it feel lived-in.
//
// Categories:
//   - lifestyle  : homes & vehicles (passive fame, status)
//   - team       : people who work for you (gameplay buffs, weekly cost)
//   - studio     : studio-owner-only upgrades
//   - indulgence : one-shot purchases (parties, vacations)

const PURCHASES = [
  // ===== LIFESTYLE — HOMES =====
  {
    id: 'apt_hollywood', category: 'lifestyle', kind: 'home', name: 'Hollywood Bachelor Apartment',
    price: 18_000, weeklyUpkeep: 80, fameRequired: 0,
    effects: { fameWeekly: 0.05, energyRegenBonus: 2 },
    flavor: 'A walk-up off Sunset. Nothing fancy, but it has a view of the sign on clear days.',
  },
  {
    id: 'house_laurel', category: 'lifestyle', kind: 'home', name: 'House in Laurel Canyon',
    price: 180_000, weeklyUpkeep: 600, fameRequired: 10,
    effects: { fameWeekly: 0.15, energyRegenBonus: 4 },
    flavor: 'Wood-paneled bungalow with a garden. Musicians have parties next door.',
  },
  {
    id: 'house_beverly', category: 'lifestyle', kind: 'home', name: 'Beverly Hills Mansion',
    price: 2_400_000, weeklyUpkeep: 4_500, fameRequired: 35,
    effects: { fameWeekly: 0.35, energyRegenBonus: 6 },
    flavor: 'Wrought-iron gates. A pool shaped like a kidney. Tour buses pause at the curb.',
  },
  {
    id: 'house_malibu', category: 'lifestyle', kind: 'home', name: 'Malibu Beach House',
    price: 6_800_000, weeklyUpkeep: 12_000, fameRequired: 60,
    effects: { fameWeekly: 0.55, energyRegenBonus: 10 },
    flavor: 'Floor-to-ceiling glass facing the Pacific. The neighbors are also famous.',
  },
  {
    id: 'estate_belair', category: 'lifestyle', kind: 'home', name: 'Bel Air Estate',
    price: 24_000_000, weeklyUpkeep: 45_000, fameRequired: 85,
    effects: { fameWeekly: 0.9, energyRegenBonus: 14 },
    flavor: 'Gated compound. Helipad. A small staff that lives on the property.',
  },

  // ===== LIFESTYLE — VEHICLES =====
  {
    id: 'car_mustang', category: 'lifestyle', kind: 'car', name: '1967 Mustang Convertible',
    price: 22_000, weeklyUpkeep: 40, fameRequired: 5,
    effects: { fameWeekly: 0.08 },
    flavor: 'Top down on Mulholland. The right kind of cliché.',
  },
  {
    id: 'car_porsche', category: 'lifestyle', kind: 'car', name: 'Porsche 911',
    price: 95_000, weeklyUpkeep: 180, fameRequired: 20,
    effects: { fameWeekly: 0.12 },
    flavor: 'European sleek. The paparazzi know your engine sound by now.',
  },
  {
    id: 'car_rolls', category: 'lifestyle', kind: 'car', name: 'Rolls-Royce Silver Shadow',
    price: 380_000, weeklyUpkeep: 800, fameRequired: 45,
    effects: { fameWeekly: 0.22 },
    flavor: 'A car for someone who has a driver. You have a driver now.',
  },
  {
    id: 'car_lambo', category: 'lifestyle', kind: 'car', name: 'Lamborghini Countach',
    price: 250_000, weeklyUpkeep: 600, fameRequired: 35,
    effects: { fameWeekly: 0.28 },
    flavor: 'Loud, low, and obviously expensive. Every kid on Sunset stops to stare.',
  },

  // ===== PERSONAL TEAM =====
  {
    id: 'agent_basic', category: 'team', kind: 'agent', name: 'Boutique Talent Agent',
    price: 5_000, weeklyUpkeep: 200, fameRequired: 0,
    effects: { offerCountBonus: 1, offerBudgetBonus: 0.05 },
    flavor: 'They hustle hard. More offers come across your desk.',
  },
  {
    id: 'agent_big', category: 'team', kind: 'agent', name: 'Top-Tier Agency Rep (CAA)',
    price: 50_000, weeklyUpkeep: 1_200, fameRequired: 30,
    effects: { offerCountBonus: 2, offerBudgetBonus: 0.20, offerProbabilityBonus: 0.10 },
    flavor: 'Suits, lunches at The Ivy, and access. The big offers start arriving.',
    replaces: 'agent_basic',
  },
  {
    id: 'publicist', category: 'team', kind: 'publicist', name: 'Personal Publicist',
    price: 8_000, weeklyUpkeep: 350, fameRequired: 10,
    effects: { promoFameMultiplier: 1.5, fameWeekly: 0.08 },
    flavor: 'They get you on covers, in magazines, in the right rooms.',
  },
  {
    id: 'trainer', category: 'team', kind: 'trainer', name: 'Personal Trainer & Chef',
    price: 4_000, weeklyUpkeep: 250, fameRequired: 0,
    effects: { energyRegenBonus: 8 },
    flavor: 'Energy stays high. The chef does macros. The trainer does the rest.',
  },
  {
    id: 'coach_acting', category: 'team', kind: 'coach', name: 'Acting Coach (Strasberg-trained)',
    price: 6_000, weeklyUpkeep: 300, fameRequired: 0,
    effects: { passiveSkill: 'actor' },
    flavor: 'Weekly sessions. You feel sharper between projects.',
  },
  {
    id: 'coach_directing', category: 'team', kind: 'coach', name: 'Directing Mentor',
    price: 6_000, weeklyUpkeep: 300, fameRequired: 0,
    effects: { passiveSkill: 'director' },
    flavor: 'A retired director who watches your dailies and gives notes.',
  },
  {
    id: 'coach_writing', category: 'team', kind: 'coach', name: 'Script Doctor on Retainer',
    price: 6_000, weeklyUpkeep: 300, fameRequired: 0,
    effects: { passiveSkill: 'writer' },
    flavor: 'They look over your pages and tell you what isn\'t working.',
  },
  {
    id: 'coach_producing', category: 'team', kind: 'coach', name: 'Producing Consultant',
    price: 6_000, weeklyUpkeep: 300, fameRequired: 0,
    effects: { passiveSkill: 'producer' },
    flavor: 'A veteran line producer who teaches you the business.',
  },
  {
    id: 'fyc_firm', category: 'team', kind: 'awards', name: 'Awards Campaign PR Firm',
    price: 80_000, weeklyUpkeep: 2_000, fameRequired: 25,
    effects: { fycMultiplier: 1.5 },
    flavor: 'They run the campaigns that win Oscars. Your FYC dollars work harder.',
  },

  // ===== STUDIO UPGRADES (require player.studio) =====
  {
    id: 'studio_lot', category: 'studio', kind: 'facility', name: 'Backlot & Soundstages',
    price: 1_500_000, weeklyUpkeep: 5_000, studioRequired: true,
    effects: { studioBudgetCap: 30_000_000, costOverrunReduction: 0.5 },
    flavor: 'Three sound stages, a backlot with western and city sets. Productions stay in-house.',
  },
  {
    id: 'studio_writers', category: 'studio', kind: 'staff', name: 'In-House Writers\' Room',
    price: 400_000, weeklyUpkeep: 3_500, studioRequired: true,
    effects: { freeScriptPolish: true, npcSkillBonus: 8 },
    flavor: 'A bullpen of writers under contract. Scripts come in sharper.',
  },
  {
    id: 'studio_casting', category: 'studio', kind: 'staff', name: 'Casting Department',
    price: 300_000, weeklyUpkeep: 2_500, studioRequired: true,
    effects: { npcSkillBonus: 10 },
    flavor: 'A casting director who knows everyone. Your NPC crews get better.',
  },
  {
    id: 'studio_distribution', category: 'studio', kind: 'facility', name: 'Distribution Arm',
    price: 5_000_000, weeklyUpkeep: 12_000, studioRequired: true,
    effects: { boxOfficeShareBonus: 0.10 },
    flavor: 'You own the theaters\' booking deals. More of the gross actually reaches you.',
  },
];

// Helpers to read player buffs from owned items
function ownedBuffs(player) {
  const owned = player.possessions || [];
  const acc = {
    fameWeekly: 0,
    energyRegenBonus: 0,
    offerCountBonus: 0,
    offerBudgetBonus: 0,
    offerProbabilityBonus: 0,
    promoFameMultiplier: 1,
    passiveSkills: [], // list of role keys
    fycMultiplier: 1,
    studioBudgetCap: 0,
    costOverrunReduction: 0,
    freeScriptPolish: false,
    npcSkillBonus: 0,
    boxOfficeShareBonus: 0,
  };
  for (const ownedId of owned) {
    const item = PURCHASES.find(p => p.id === ownedId);
    if (!item) continue;
    const e = item.effects || {};
    if (e.fameWeekly) acc.fameWeekly += e.fameWeekly;
    if (e.energyRegenBonus) acc.energyRegenBonus += e.energyRegenBonus;
    if (e.offerCountBonus) acc.offerCountBonus += e.offerCountBonus;
    if (e.offerBudgetBonus) acc.offerBudgetBonus += e.offerBudgetBonus;
    if (e.offerProbabilityBonus) acc.offerProbabilityBonus += e.offerProbabilityBonus;
    if (e.promoFameMultiplier) acc.promoFameMultiplier *= e.promoFameMultiplier;
    if (e.passiveSkill) acc.passiveSkills.push(e.passiveSkill);
    if (e.fycMultiplier) acc.fycMultiplier *= e.fycMultiplier;
    if (e.studioBudgetCap) acc.studioBudgetCap = Math.max(acc.studioBudgetCap, e.studioBudgetCap);
    if (e.costOverrunReduction) acc.costOverrunReduction = Math.max(acc.costOverrunReduction, e.costOverrunReduction);
    if (e.freeScriptPolish) acc.freeScriptPolish = true;
    if (e.npcSkillBonus) acc.npcSkillBonus += e.npcSkillBonus;
    if (e.boxOfficeShareBonus) acc.boxOfficeShareBonus += e.boxOfficeShareBonus;
  }
  return acc;
}

function totalWeeklyUpkeep(player) {
  const owned = player.possessions || [];
  let total = 0;
  for (const id of owned) {
    const item = PURCHASES.find(p => p.id === id);
    if (item) total += item.weeklyUpkeep || 0;
  }
  return total;
}

// ---------- CAREER HISTORY DERIVATION ----------
//
// Given the full player state, derive a structured career history:
//   - milestones    (first audition, first lead, first hit, first nom, etc.)
//   - records       (biggest hit, biggest flop, most acclaimed, etc.)
//   - roleStats     (films per role, avg critic, best/worst per role)
//   - timeline      (year-by-year events)

function deriveCareerHistory(player) {
  const history = player.history || [];
  const awards = (player.awards && player.awards.history) || [];

  // ===== MILESTONES =====
  const milestones = [];

  // Career start
  milestones.push({
    year: player.startYear || 1985,
    icon: '🎬',
    title: 'The Career Begins',
    detail: `Started in Hollywood as a young ${ROLE_LABELS[player.startingRole || 'actor'].toLowerCase()}.`,
  });

  // Sort films chronologically for milestone detection
  const sortedFilms = history.slice().sort((a, b) =>
    (a.releaseYear || a.year) - (b.releaseYear || b.year) || (a.week || 0) - (b.week || 0)
  );

  // First credit ever
  if (sortedFilms.length > 0) {
    const first = sortedFilms[0];
    milestones.push({
      year: first.releaseYear || first.year,
      icon: '⭐',
      title: 'First Screen Credit',
      detail: `"${first.title}" — as ${first.playerRoles.map(r => ROLE_LABELS[r]).join(' & ')}.`,
    });
  }

  // First lead role per role type
  const firstByRole = {};
  for (const film of sortedFilms) {
    for (const role of (film.playerRoles || [])) {
      if (!firstByRole[role]) {
        firstByRole[role] = film;
      }
    }
  }
  for (const role of ROLES) {
    if (firstByRole[role] && firstByRole[role] !== sortedFilms[0]) {
      const film = firstByRole[role];
      milestones.push({
        year: film.releaseYear || film.year,
        icon: '🎭',
        title: `First Credit as ${ROLE_LABELS[role]}`,
        detail: `"${film.title}".`,
      });
    }
  }

  // First hit (profit > 1.5x total cost)
  const firstHit = sortedFilms.find(f => f.result && f.result.hit);
  if (firstHit) {
    milestones.push({
      year: firstHit.releaseYear || firstHit.year,
      icon: '💥',
      title: 'First Hit',
      detail: `"${firstHit.title}" grossed ${fmtMoney(firstHit.result.boxOffice)}.`,
    });
  }

  // First flop (for the lows too)
  const firstFlop = sortedFilms.find(f => f.result && f.result.flop);
  if (firstFlop) {
    milestones.push({
      year: firstFlop.releaseYear || firstFlop.year,
      icon: '💀',
      title: 'First Bomb',
      detail: `"${firstFlop.title}" lost ${fmtMoney(Math.abs(firstFlop.result.profit))}.`,
    });
  }

  // First $100M gross
  const first100m = sortedFilms.find(f => f.result && f.result.boxOffice >= 100_000_000);
  if (first100m) {
    milestones.push({
      year: first100m.releaseYear || first100m.year,
      icon: '🌟',
      title: 'Crossed $100M',
      detail: `"${first100m.title}" became a blockbuster.`,
    });
  }

  // Studio founding
  if (player.studio) {
    milestones.push({
      year: player.studio.founded,
      icon: '🏛',
      title: 'Founded a Studio',
      detail: `${player.studio.name} opened its doors.`,
    });
  }

  // Franchise milestones: first sequel, first trilogy, etc.
  const franchises = Object.values(player.franchises || {});
  const firstSequel = franchises
    .filter(f => f.entries.length >= 2)
    .map(f => ({ f, year: f.entries[1].year }))
    .sort((a, b) => a.year - b.year)[0];
  if (firstSequel) {
    milestones.push({
      year: firstSequel.year,
      icon: '🎞️',
      title: 'First Sequel',
      detail: `Launched a franchise with "${firstSequel.f.entries[1].title}".`,
    });
  }
  const firstTrilogy = franchises
    .filter(f => f.entries.length >= 3)
    .map(f => ({ f, year: f.entries[2].year }))
    .sort((a, b) => a.year - b.year)[0];
  if (firstTrilogy) {
    milestones.push({
      year: firstTrilogy.year,
      icon: '🏆',
      title: 'Completed a Trilogy',
      detail: `Three entries of "${firstTrilogy.f.title}" in the can.`,
    });
  }

  // Genre specialty milestones — find the year the player crossed each tier
  // by counting films in each genre chronologically
  const filmsByYear = (player.history || []).slice().sort((a, b) => (a.releaseYear || a.year) - (b.releaseYear || b.year));
  const genreCounts = {};
  const tierLabels = { 3: 'Working In', 6: 'Specialist', 10: 'Icon' };
  const seenTiers = new Set();
  for (const f of filmsByYear) {
    genreCounts[f.genre] = (genreCounts[f.genre] || 0) + 1;
    const c = genreCounts[f.genre];
    if (tierLabels[c] && !seenTiers.has(`${f.genre}-${c}`)) {
      seenTiers.add(`${f.genre}-${c}`);
      const tierLabel = tierLabels[c];
      const fullLabel = tierLabel === 'Working In' ? `Working in ${f.genre}` : `${f.genre} ${tierLabel}`;
      milestones.push({
        year: f.releaseYear || f.year,
        icon: c === 10 ? '🌟' : c === 6 ? '⭐' : '🎬',
        title: `Became a ${fullLabel}`,
        detail: c >= 6
          ? `${c} ${f.genre} films into the career.`
          : `Three ${f.genre} films built a working identity.`,
      });
    }
  }

  // Hyphenate milestones — first time playing each role solo (other than starting role),
  // first hyphenate combos (writer-director, actor-director, etc.), and triple/quad threats
  const startingRole = player.startingRole;
  const roleNouns = { actor: 'Acting', director: 'Directing', producer: 'Producing', writer: 'Writing' };
  const debutVerb = { actor: 'Acting Debut', director: 'Directorial Debut', producer: 'Producing Debut', writer: 'Screenwriting Debut' };
  const seenRoleDebuts = new Set([startingRole]); // starting role isn't a "debut"
  const seenCombos = new Set();
  let firstTriple = null;
  let firstQuad = null;

  for (const f of filmsByYear) {
    const roles = f.playerRoles || [];
    if (roles.length === 0) continue;
    const year = f.releaseYear || f.year;

    // First-time solo role debuts (other than starting role)
    for (const r of roles) {
      if (!seenRoleDebuts.has(r)) {
        seenRoleDebuts.add(r);
        milestones.push({
          year,
          icon: r === 'director' ? '🎬' : r === 'writer' ? '✒️' : r === 'producer' ? '💼' : '🎭',
          title: debutVerb[r],
          detail: `First credit as ${roleNouns[r].toLowerCase()} — "${f.title}".`,
        });
      }
    }

    // Hyphenate combos — only pairs where neither role was the player's primary identity
    // Sort roles so combo key is deterministic
    const sortedRoles = [...roles].sort();
    if (sortedRoles.length === 2) {
      const comboKey = sortedRoles.join('-');
      if (!seenCombos.has(comboKey)) {
        seenCombos.add(comboKey);
        const labels = sortedRoles.map(r => ROLE_LABELS[r].toLowerCase());
        milestones.push({
          year,
          icon: '✨',
          title: `First as ${labels.join(' & ')}`,
          detail: `"${f.title}" — wore two hats at once.`,
        });
      }
    }

    // Triple threat — three roles on one picture
    if (sortedRoles.length === 3 && !firstTriple) {
      firstTriple = { year, film: f, roles: sortedRoles };
    }
    // Quad threat — all four roles on one picture (Welles-tier)
    if (sortedRoles.length === 4 && !firstQuad) {
      firstQuad = { year, film: f };
    }
  }

  if (firstTriple) {
    const labels = firstTriple.roles.map(r => ROLE_LABELS[r].toLowerCase()).join(', ');
    milestones.push({
      year: firstTriple.year,
      icon: '🎯',
      title: 'Triple Threat',
      detail: `"${firstTriple.film.title}" — credited as ${labels}.`,
    });
  }
  if (firstQuad) {
    milestones.push({
      year: firstQuad.year,
      icon: '🌟',
      title: 'Quadruple Threat',
      detail: `"${firstQuad.film.title}" — wrote, directed, produced, and starred. The Welles move.`,
    });
  }

  // Box office milestones — first $20M / $50M / $100M / $200M film
  // Boxoffice thresholds appropriate to 1985 (a $20M opening would have been huge)
  const boxOfficeThresholds = [
    { min: 20_000_000, icon: '💰', title: 'First $20M Picture' },
    { min: 50_000_000, icon: '💰', title: 'First $50M Picture' },
    { min: 100_000_000, icon: '💎', title: 'Crossed $100M' },
    { min: 200_000_000, icon: '👑', title: 'Crossed $200M' },
  ];
  for (const threshold of boxOfficeThresholds) {
    const first = filmsByYear.find(f => (f.result?.boxOffice || 0) >= threshold.min);
    if (first) {
      milestones.push({
        year: first.releaseYear || first.year,
        icon: threshold.icon,
        title: threshold.title,
        detail: `"${first.title}" grossed ${fmtMoney(first.result.boxOffice)}.`,
      });
    }
  }

  // Big-ticket purchases — surfaced as "currently owns" since we don't track buy year
  const owned = player.possessions || [];
  const ownedHomes = owned.map(id => PURCHASES.find(p => p.id === id)).filter(i => i && i.kind === 'home');
  const topHome = ownedHomes.sort((a, b) => b.price - a.price)[0];
  if (topHome && topHome.price >= 1_000_000) {
    milestones.push({
      year: player.year,
      icon: '🏡',
      title: 'A Real Estate Statement',
      detail: `Currently owns ${topHome.name}.`,
    });
  }

  // Mentorship milestones — each graduated alumnus is a career moment
  for (const alum of (player.mentoredAlumni || [])) {
    milestones.push({
      year: alum.graduatedYear,
      icon: '🎓',
      title: `Mentored ${alum.menteeName}`,
      detail: `Took them under your wing in ${alum.startedYear}; they made their name by ${alum.graduatedYear}. ${alum.totalSessions} sessions invested.`,
    });
  }
  if (owned.includes('agent_big')) {
    milestones.push({
      year: player.year,
      icon: '👔',
      title: 'Signed with a Top Agency',
      detail: 'Big-league representation.',
    });
  }

  // Personal life milestones
  const personal = player.personal || {};
  // Current marriage
  if (personal.status === 'married' && personal.partner) {
    milestones.push({
      year: personal.partner.since?.year || player.year,
      icon: '💍',
      title: `Married ${personal.partner.name}`,
      detail: personal.partner.isStar ? `A "power couple" marriage — they're a ${personal.partner.occupation}.` : `Marriage to ${personal.partner.occupation.toLowerCase()} ${personal.partner.name}.`,
    });
  }
  // Past marriages
  for (const past of (personal.partnerHistory || [])) {
    if (past.reason === 'divorce') {
      milestones.push({
        year: past.ended,
        icon: '💔',
        title: `Divorced ${past.name}`,
        detail: `End of a marriage that started ${past.started}.`,
      });
    }
  }
  // Children
  for (const c of (personal.children || [])) {
    milestones.push({
      year: c.born,
      icon: '👶',
      title: `${c.name} was born`,
      detail: `Welcomed a child into the family.`,
    });
  }

  // First award nomination
  const sortedAwards = awards.slice().sort((a, b) => a.year - b.year);
  const firstNom = sortedAwards[0];
  if (firstNom) {
    milestones.push({
      year: firstNom.year,
      icon: '⭐',
      title: 'First Award Nomination',
      detail: `${firstNom.categoryLabel} at ${firstNom.body} for "${firstNom.film}".`,
    });
  }

  // First award win
  const firstWin = sortedAwards.find(a => a.won);
  if (firstWin) {
    milestones.push({
      year: firstWin.year,
      icon: '🏆',
      title: 'First Award Won',
      detail: `${firstWin.categoryLabel} at ${firstWin.body} for "${firstWin.film}".`,
    });
  }

  // Triple crown — wins in at least 3 different roles
  const winRoles = new Set(awards.filter(a => a.won).map(a => a.role));
  if (winRoles.size >= 3) {
    // Find the year of the third-distinct-role win
    const seen = new Set();
    let crownYear = null;
    for (const a of sortedAwards) {
      if (a.won) {
        seen.add(a.role);
        if (seen.size === 3) { crownYear = a.year; break; }
      }
    }
    milestones.push({
      year: crownYear,
      icon: '👑',
      title: 'Triple Crown',
      detail: `Award wins in three distinct roles.`,
    });
  }

  // Peak fame milestones
  const peak = player.peakFame || 0;
  if (peak >= 90) {
    milestones.push({ year: player.year, icon: '🌟', title: 'Household Name', detail: 'Fame reached 90+.' });
  } else if (peak >= 70) {
    milestones.push({ year: player.year, icon: '✨', title: 'A-List Star', detail: 'Fame reached 70+.' });
  }

  // Sort milestones by year then push career-start to top
  milestones.sort((a, b) => (a.year || 9999) - (b.year || 9999));

  // ===== RECORDS =====
  const records = {};
  if (sortedFilms.length > 0) {
    const byBox = [...sortedFilms].sort((a, b) => b.result.boxOffice - a.result.boxOffice);
    const byCritic = [...sortedFilms].sort((a, b) => b.result.criticScore - a.result.criticScore);
    const byAudience = [...sortedFilms].sort((a, b) => b.result.audienceScore - a.result.audienceScore);
    const byProfit = [...sortedFilms].sort((a, b) => b.result.profit - a.result.profit);
    const byLoss = [...sortedFilms].sort((a, b) => a.result.profit - b.result.profit);

    records.highestGrossing = byBox[0];
    records.mostAcclaimed = byCritic[0];
    records.mostPopular = byAudience[0];
    records.biggestProfit = byProfit[0];
    records.biggestFlop = byLoss[0].result.profit < 0 ? byLoss[0] : null;
  }

  // ===== ROLE STATS =====
  const roleStats = {};
  for (const role of ROLES) {
    const filmsInRole = history.filter(f => f.playerRoles && f.playerRoles.includes(role));
    if (filmsInRole.length === 0) {
      roleStats[role] = null;
      continue;
    }
    const avgCritic = Math.round(filmsInRole.reduce((s, f) => s + f.result.criticScore, 0) / filmsInRole.length);
    const avgAudience = Math.round(filmsInRole.reduce((s, f) => s + f.result.audienceScore, 0) / filmsInRole.length);
    const totalBox = filmsInRole.reduce((s, f) => s + f.result.boxOffice, 0);
    const hits = filmsInRole.filter(f => f.result.hit).length;
    const flops = filmsInRole.filter(f => f.result.flop).length;
    const noms = awards.filter(a => a.role === role).length;
    const wins = awards.filter(a => a.role === role && a.won).length;
    const best = [...filmsInRole].sort((a, b) => b.result.criticScore - a.result.criticScore)[0];
    roleStats[role] = {
      count: filmsInRole.length,
      avgCritic,
      avgAudience,
      totalBox,
      hits,
      flops,
      noms,
      wins,
      best,
    };
  }

  // ===== TIMELINE (year-by-year events) =====
  const yearMap = {};
  const addToYear = (year, ev) => {
    if (!yearMap[year]) yearMap[year] = [];
    yearMap[year].push(ev);
  };

  // Films
  for (const film of sortedFilms) {
    const year = film.releaseYear || film.year;
    let label = `Released "${film.title}"`;
    if (film.result.hit) label += ' — HIT';
    else if (film.result.flop) label += ' — flop';
    addToYear(year, { type: 'film', label, film });
  }
  // Awards
  for (const a of awards) {
    addToYear(a.year, {
      type: a.won ? 'win' : 'nom',
      label: a.won ? `🏆 Won ${a.categoryLabel} at ${a.body}` : `⭐ Nominated for ${a.categoryLabel} at ${a.body}`,
      film: { title: a.film },
    });
  }
  // Studio founding
  if (player.studio) {
    addToYear(player.studio.founded, { type: 'studio', label: `🏛 Founded ${player.studio.name}` });
  }
  // Personal life: current spouse, past partners, kids
  if (personal.status === 'married' && personal.partner) {
    addToYear(personal.partner.since?.year || player.year, { type: 'personal', label: `💍 Married ${personal.partner.name}` });
  }
  for (const past of (personal.partnerHistory || [])) {
    if (past.reason === 'divorce') {
      addToYear(past.ended, { type: 'personal', label: `💔 Divorced ${past.name}` });
    } else if (past.reason === 'breakup' || past.reason === 'called off engagement') {
      addToYear(past.ended, { type: 'personal', label: `💔 Split with ${past.name}` });
    }
  }
  for (const c of (personal.children || [])) {
    addToYear(c.born, { type: 'personal', label: `👶 ${c.name} was born` });
  }
  // Career start
  addToYear(player.startYear || 1985, { type: 'start', label: `🎬 Career begins as ${ROLE_LABELS[player.startingRole || 'actor']}` });

  const timeline = Object.keys(yearMap)
    .map(y => parseInt(y, 10))
    .sort((a, b) => b - a)
    .map(y => ({ year: y, events: yearMap[y] }));

  // ===== SUMMARY NUMBERS =====
  const summary = {
    yearsActive: (player.year - (player.startYear || 1985)) + 1,
    totalFilms: history.length,
    totalBoxOffice: history.reduce((s, f) => s + (f.result?.boxOffice || 0), 0),
    lifetimeEarnings: player.lifetimeEarnings || 0,
    peakFame: player.peakFame || 0,
    totalNoms: player.awards?.nominations || 0,
    totalWins: player.awards?.wins || 0,
    hits: history.filter(f => f.result?.hit).length,
    flops: history.filter(f => f.result?.flop).length,
  };

  return { milestones, records, roleStats, timeline, summary };
}


// ---------- UI THEME (Vintage Hollywood) ----------
// Aesthetic: Art deco, sepia + gold, marquee lights, film grain.
// Display font: "Limelight" or "Playfair Display" - using Google Fonts via <link>
// Body: "Crimson Pro"

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Limelight&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Special+Elite&display=swap');

  :root {
    --bg: #0e0a06;
    --bg-2: #1a1208;
    --panel: #1e1509;
    --panel-2: #2a1d0d;
    --gold: #d4a64a;
    --gold-bright: #f0c460;
    --gold-dim: #8a6f2d;
    --cream: #f3e6c4;
    --cream-dim: #c9b885;
    --red: #a8261d;
    --red-bright: #d63828;
    --green: #5a8c3a;
    --ink: #0a0704;
    --border: #5a4422;
  }

  * { box-sizing: border-box; }

  body, .ht-root {
    margin: 0;
    background: var(--bg);
    color: var(--cream);
    font-family: 'Crimson Pro', Georgia, serif;
    min-height: 100vh;
  }

  /* Film grain overlay */
  .ht-root::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      radial-gradient(rgba(0,0,0,0.15) 1px, transparent 1px);
    background-size: 3px 3px, 5px 5px;
    background-position: 0 0, 1px 2px;
    opacity: 0.5;
    z-index: 1000;
    mix-blend-mode: overlay;
  }

  .ht-root::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%);
    z-index: 999;
  }

  .ht-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px;
    position: relative;
    z-index: 1;
  }

  /* ===== Touch device tuning (iPad and similar) =====
     iPad Pro 13" is 1024×1366 — plenty of real estate, but no hover and
     finger-sized tap targets matter. */
  @media (hover: none) {
    /* Tooltips can't work on touch — make them tap-to-show via active state */
    .ht-tt:active .ht-tt-bubble,
    .ht-tt:focus-within .ht-tt-bubble {
      visibility: visible !important;
      opacity: 1 !important;
    }
    /* Apple HIG: 44pt minimum tap target */
    .ht-btn { min-height: 44px; padding: 10px 18px; }
    .ht-btn-sm { min-height: 36px; padding: 7px 14px; }
    /* Inputs taller on touch */
    .ht-input { min-height: 44px; padding: 10px 14px; font-size: 1rem; }
    /* Range slider thumb is too small by default on iOS */
    input[type=range] {
      -webkit-appearance: none;
      height: 32px;
      background: transparent;
    }
    input[type=range]::-webkit-slider-runnable-track {
      height: 6px;
      background: var(--border);
      border-radius: 3px;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 28px;
      height: 28px;
      background: var(--gold-bright);
      border-radius: 50%;
      margin-top: -11px;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      border: 2px solid #1a1410;
    }
    /* Improve scroll feel on overflow areas */
    .ht-panel, .ht-modal-bg > div {
      -webkit-overflow-scrolling: touch;
    }
    /* Prevent double-tap zoom on buttons */
    .ht-btn, .ht-tab { touch-action: manipulation; }
  }

  /* ===== MARQUEE TITLE ===== */
  .ht-marquee {
    text-align: center;
    padding: 28px 20px 20px;
    border: 3px double var(--gold);
    background:
      radial-gradient(ellipse at top, rgba(212,166,74,0.15), transparent 70%),
      linear-gradient(180deg, #1f1608, #120c05);
    box-shadow:
      inset 0 0 40px rgba(0,0,0,0.6),
      0 0 0 6px var(--bg),
      0 0 0 8px var(--gold-dim);
    position: relative;
    margin-bottom: 30px;
  }

  .ht-marquee::before, .ht-marquee::after {
    content: '★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★';
    display: block;
    color: var(--gold);
    letter-spacing: 8px;
    font-size: 10px;
    overflow: hidden;
    white-space: nowrap;
    opacity: 0.7;
  }

  .ht-marquee-title {
    font-family: 'Limelight', serif;
    font-size: clamp(2.2rem, 6vw, 4.2rem);
    color: var(--gold-bright);
    letter-spacing: 0.08em;
    text-shadow:
      0 0 20px rgba(240,196,96,0.5),
      0 0 40px rgba(212,166,74,0.3),
      2px 2px 0 var(--ink);
    margin: 8px 0;
    line-height: 1;
    animation: flicker 4s infinite;
  }

  @keyframes flicker {
    0%, 100% { opacity: 1; }
    97% { opacity: 1; }
    97.5% { opacity: 0.7; }
    98% { opacity: 1; }
    98.5% { opacity: 0.85; }
    99% { opacity: 1; }
  }

  .ht-marquee-sub {
    font-family: 'Special Elite', monospace;
    font-size: 0.85rem;
    color: var(--cream-dim);
    letter-spacing: 0.25em;
    text-transform: uppercase;
  }

  /* ===== PANEL ===== */
  .ht-panel {
    background:
      linear-gradient(180deg, var(--panel), var(--panel-2));
    border: 1px solid var(--border);
    padding: 22px;
    margin-bottom: 20px;
    position: relative;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,166,74,0.1);
  }

  .ht-panel-corner {
    position: absolute;
    width: 14px;
    height: 14px;
    border: 2px solid var(--gold);
  }
  .ht-panel-corner.tl { top: 6px; left: 6px; border-right: none; border-bottom: none; }
  .ht-panel-corner.tr { top: 6px; right: 6px; border-left: none; border-bottom: none; }
  .ht-panel-corner.bl { bottom: 6px; left: 6px; border-right: none; border-top: none; }
  .ht-panel-corner.br { bottom: 6px; right: 6px; border-left: none; border-top: none; }

  .ht-panel-title {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-style: italic;
    font-size: 1.6rem;
    color: var(--gold);
    margin: 0 0 4px;
    letter-spacing: 0.02em;
  }
  .ht-panel-sub {
    font-family: 'Special Elite', monospace;
    font-size: 0.75rem;
    color: var(--cream-dim);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  /* ===== BUTTONS ===== */
  .ht-btn {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: 1rem;
    background: linear-gradient(180deg, #3a2a14, #261a09);
    color: var(--gold-bright);
    border: 1px solid var(--gold-dim);
    padding: 12px 22px;
    cursor: pointer;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: all 0.2s;
    position: relative;
    box-shadow: 0 2px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,166,74,0.2);
  }

  .ht-btn:hover:not(:disabled) {
    background: linear-gradient(180deg, #4d3819, #32220c);
    border-color: var(--gold);
    color: #fff4d4;
    box-shadow: 0 0 12px rgba(212,166,74,0.4), inset 0 1px 0 rgba(212,166,74,0.4);
    transform: translateY(-1px);
  }

  .ht-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ht-btn-primary {
    background: linear-gradient(180deg, #c08a30, #8a6020);
    color: var(--ink);
    border-color: var(--gold-bright);
    text-shadow: 0 1px 0 rgba(255,255,255,0.2);
  }
  .ht-btn-primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #e0a440, #a87830);
    color: var(--ink);
  }

  .ht-btn-danger {
    color: #f0c0c0;
    border-color: var(--red);
  }
  .ht-btn-danger:hover:not(:disabled) {
    background: linear-gradient(180deg, #4a1a14, #2a0e0a);
    border-color: var(--red-bright);
  }

  .ht-btn-sm {
    padding: 6px 12px;
    font-size: 0.85rem;
  }

  /* ===== ROLE CARDS (career select) ===== */
  .ht-role-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .ht-role-card {
    background: linear-gradient(180deg, #2a1c0a, #1a1106);
    border: 2px solid var(--gold-dim);
    padding: 24px 18px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }
  .ht-role-card:hover {
    border-color: var(--gold-bright);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(212,166,74,0.25);
  }
  .ht-role-card.selected {
    border-color: var(--gold-bright);
    background: linear-gradient(180deg, #3a2810, #221608);
    box-shadow: 0 0 20px rgba(212,166,74,0.4);
  }
  .ht-role-icon {
    font-size: 2.5rem;
    margin-bottom: 12px;
    display: block;
  }
  .ht-role-name {
    font-family: 'Limelight', serif;
    font-size: 1.3rem;
    color: var(--gold-bright);
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  .ht-role-desc {
    font-size: 0.92rem;
    color: var(--cream-dim);
    line-height: 1.4;
    font-style: italic;
  }

  /* ===== STATS BAR ===== */
  .ht-stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .ht-stat {
    background: linear-gradient(180deg, #1f1609, #15100a);
    border: 1px solid var(--border);
    padding: 10px 14px;
    border-left: 3px solid var(--gold);
  }
  .ht-stat-label {
    font-family: 'Special Elite', monospace;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--cream-dim);
  }
  .ht-stat-value {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-size: 1.4rem;
    color: var(--gold-bright);
    margin-top: 2px;
  }

  /* ===== SKILL BARS ===== */
  .ht-skills-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 600px) {
    .ht-skills-grid { grid-template-columns: 1fr; }
  }
  .ht-skill {
    background: rgba(0,0,0,0.3);
    padding: 10px 14px;
    border: 1px solid var(--border);
  }
  .ht-skill-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .ht-skill-name {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-style: italic;
    color: var(--cream);
    font-size: 1.05rem;
  }
  .ht-skill-num {
    font-family: 'Special Elite', monospace;
    color: var(--gold-bright);
    font-size: 0.85rem;
  }
  .ht-bar {
    height: 8px;
    background: var(--ink);
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
  }
  .ht-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--gold-dim), var(--gold-bright));
    box-shadow: 0 0 8px rgba(212,166,74,0.4);
    transition: width 0.5s;
  }
  .ht-bar-fill.rep {
    background: linear-gradient(90deg, #6a3a1a, #c8682a);
  }

  /* ===== LOG / NEWSPAPER ===== */
  .ht-log {
    max-height: 280px;
    overflow-y: auto;
    background: #f3e6c4;
    color: #2a1d0d;
    padding: 20px 24px;
    font-family: 'Special Elite', monospace;
    font-size: 0.92rem;
    line-height: 1.5;
    border: 1px solid var(--gold-dim);
    box-shadow: inset 0 0 30px rgba(139, 110, 50, 0.3);
    background-image:
      repeating-linear-gradient(
        0deg,
        rgba(139, 110, 50, 0.04) 0px,
        rgba(139, 110, 50, 0.04) 1px,
        transparent 1px,
        transparent 28px
      );
  }
  .ht-log::-webkit-scrollbar { width: 8px; }
  .ht-log::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
  .ht-log::-webkit-scrollbar-thumb { background: var(--gold-dim); }

  .ht-log-entry {
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed rgba(139, 110, 50, 0.3);
  }
  .ht-log-entry:last-child { border-bottom: none; }
  .ht-log-week {
    font-weight: bold;
    color: var(--red);
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
  }

  /* ===== POSTER (movie result modal) ===== */
  .ht-modal-bg {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
  }
  .ht-poster {
    background: linear-gradient(180deg, #1f1608, #0a0704);
    border: 3px double var(--gold);
    padding: 30px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 0 60px rgba(212,166,74,0.3);
  }
  .ht-poster-tag {
    font-family: 'Special Elite', monospace;
    text-align: center;
    color: var(--red-bright);
    letter-spacing: 0.3em;
    text-transform: uppercase;
    font-size: 0.85rem;
    border-bottom: 1px solid var(--red);
    border-top: 1px solid var(--red);
    padding: 6px 0;
    margin-bottom: 18px;
  }
  .ht-poster-title {
    font-family: 'Limelight', serif;
    text-align: center;
    font-size: clamp(1.6rem, 4vw, 2.5rem);
    color: var(--gold-bright);
    letter-spacing: 0.04em;
    line-height: 1.1;
    text-shadow: 0 0 20px rgba(212,166,74,0.4);
    margin: 0 0 8px;
  }
  .ht-poster-genre {
    text-align: center;
    font-family: 'Playfair Display', serif;
    font-style: italic;
    color: var(--cream-dim);
    margin-bottom: 24px;
    letter-spacing: 0.1em;
  }
  .ht-score-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin: 20px 0;
  }
  .ht-score-box {
    text-align: center;
    border: 1px solid var(--gold-dim);
    padding: 14px;
    background: rgba(0,0,0,0.3);
  }
  .ht-score-label {
    font-family: 'Special Elite', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--cream-dim);
  }
  .ht-score-num {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-size: 2.6rem;
    line-height: 1;
    margin-top: 4px;
  }
  .ht-score-num.hi { color: #6fcc4c; }
  .ht-score-num.mid { color: var(--gold-bright); }
  .ht-score-num.lo { color: var(--red-bright); }

  .ht-box-office {
    text-align: center;
    margin: 20px 0;
    padding: 16px;
    border: 2px solid var(--gold);
    background: linear-gradient(180deg, #2a1d0d, #1a1208);
  }
  .ht-box-office-label {
    font-family: 'Special Elite', monospace;
    color: var(--cream-dim);
    font-size: 0.8rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .ht-box-office-num {
    font-family: 'Limelight', serif;
    font-size: 2.2rem;
    color: var(--gold-bright);
    text-shadow: 0 0 15px rgba(212,166,74,0.5);
  }

  .ht-verdict {
    text-align: center;
    font-family: 'Limelight', serif;
    font-size: 1.8rem;
    margin: 16px 0;
    letter-spacing: 0.1em;
  }
  .ht-verdict.hit { color: #6fcc4c; text-shadow: 0 0 20px rgba(111,204,76,0.4); }
  .ht-verdict.ok { color: var(--gold-bright); }
  .ht-verdict.flop { color: var(--red-bright); text-shadow: 0 0 20px rgba(214,56,40,0.4); }

  /* ===== FORM ELEMENTS ===== */
  .ht-input, .ht-select {
    background: var(--ink);
    border: 1px solid var(--gold-dim);
    color: var(--cream);
    padding: 8px 12px;
    font-family: 'Crimson Pro', serif;
    font-size: 1rem;
    width: 100%;
  }
  .ht-input:focus, .ht-select:focus {
    outline: none;
    border-color: var(--gold-bright);
    box-shadow: 0 0 0 2px rgba(212,166,74,0.2);
  }
  .ht-label {
    font-family: 'Special Elite', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cream-dim);
    display: block;
    margin-bottom: 4px;
  }
  .ht-field { margin-bottom: 14px; }

  .ht-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  .ht-divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 20px 0;
    position: relative;
    text-align: center;
  }
  .ht-divider::after {
    content: '✦';
    color: var(--gold);
    background: var(--panel);
    padding: 0 14px;
    position: relative;
    top: -12px;
  }

  /* ===== STUDIO BANNER ===== */
  .ht-studio-banner {
    background: linear-gradient(135deg, #3a2810 0%, #1a1106 100%);
    border: 2px solid var(--gold);
    padding: 16px 22px;
    margin-bottom: 20px;
    position: relative;
  }
  .ht-studio-name {
    font-family: 'Limelight', serif;
    color: var(--gold-bright);
    font-size: 1.5rem;
    letter-spacing: 0.06em;
    text-shadow: 0 0 12px rgba(212,166,74,0.4);
  }
  .ht-studio-sub {
    font-family: 'Special Elite', monospace;
    color: var(--cream-dim);
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  /* Layout helpers */
  .ht-two-col {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
  }
  @media (max-width: 800px) {
    .ht-two-col { grid-template-columns: 1fr; }
  }

  .ht-tag {
    display: inline-block;
    padding: 2px 10px;
    border: 1px solid var(--gold-dim);
    color: var(--gold);
    font-family: 'Special Elite', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-right: 6px;
  }

  .ht-text-dim { color: var(--cream-dim); font-style: italic; }

  .ht-offer-card {
    border: 1px solid var(--gold-dim);
    padding: 14px;
    margin-bottom: 12px;
    background: rgba(0,0,0,0.25);
  }
  .ht-offer-title {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-style: italic;
    color: var(--gold-bright);
    font-size: 1.2rem;
  }

  /* ===== PRODUCTION HUD ===== */
  .ht-prod-hud {
    background: linear-gradient(180deg, #1f1608, #15100a);
    border: 1px solid var(--gold-dim);
    padding: 14px 18px;
    margin-bottom: 18px;
  }
  .ht-phase-track {
    display: flex;
    gap: 6px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .ht-phase-pill {
    font-family: 'Special Elite', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 5px 10px;
    border: 1px solid var(--border);
    color: var(--cream-dim);
    background: rgba(0,0,0,0.3);
    flex: 1;
    text-align: center;
    min-width: 90px;
  }
  .ht-phase-pill.done {
    color: var(--gold-dim);
    border-color: var(--gold-dim);
    background: rgba(212,166,74,0.05);
  }
  .ht-phase-pill.active {
    color: var(--ink);
    background: var(--gold-bright);
    border-color: var(--gold-bright);
    box-shadow: 0 0 12px rgba(240,196,96,0.4);
    font-weight: bold;
  }

  .ht-phase-block {
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--border);
    padding: 14px 16px;
    margin: 14px 0;
    border-left: 3px solid var(--gold-dim);
  }
  .ht-phase-block-title {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-style: italic;
    color: var(--gold);
    font-size: 1.1rem;
    margin-bottom: 6px;
  }

  .ht-event-card {
    background: linear-gradient(180deg, #2a1c0a, #1a1106);
    border: 2px solid var(--gold-dim);
    padding: 18px 20px;
    margin-top: 10px;
    position: relative;
  }
  .ht-event-card::before {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--gold-bright), transparent);
  }
  .ht-event-headline {
    font-family: 'Limelight', serif;
    color: var(--gold-bright);
    font-size: 1.2rem;
    letter-spacing: 0.03em;
    margin-bottom: 4px;
  }
  .ht-filming-day {
    font-family: 'Special Elite', monospace;
    font-size: 0.8rem;
    color: var(--cream-dim);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-align: right;
    margin-bottom: 8px;
  }

  /* ===== CAREER HISTORY ===== */
  .ht-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .ht-summary-stat {
    background: linear-gradient(180deg, #1f1609, #15100a);
    border: 1px solid var(--border);
    border-top: 3px double var(--gold);
    padding: 14px 12px;
    text-align: center;
  }
  .ht-summary-num {
    font-family: 'Limelight', serif;
    font-size: 1.6rem;
    color: var(--gold-bright);
    line-height: 1;
    text-shadow: 0 0 12px rgba(212,166,74,0.3);
  }
  .ht-summary-label {
    font-family: 'Special Elite', monospace;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--cream-dim);
    margin-top: 4px;
  }

  .ht-milestone {
    display: flex;
    gap: 14px;
    padding: 12px 14px;
    border-left: 3px solid var(--gold);
    background: linear-gradient(90deg, rgba(212,166,74,0.08), transparent);
    margin-bottom: 8px;
  }
  .ht-milestone-icon {
    font-size: 1.6rem;
    flex-shrink: 0;
  }
  .ht-milestone-body { flex: 1; }
  .ht-milestone-title {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-style: italic;
    color: var(--gold-bright);
    font-size: 1.05rem;
  }
  .ht-milestone-year {
    font-family: 'Special Elite', monospace;
    color: var(--cream-dim);
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    margin-left: 8px;
  }
  .ht-milestone-detail {
    color: var(--cream);
    font-size: 0.92rem;
    margin-top: 2px;
  }

  .ht-record {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 8px 0;
    border-bottom: 1px dashed var(--border);
  }
  .ht-record-label {
    font-family: 'Special Elite', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--cream-dim);
  }
  .ht-record-value {
    color: var(--gold-bright);
    font-weight: 700;
    font-family: 'Playfair Display', serif;
    font-style: italic;
  }

  .ht-timeline-year {
    margin-bottom: 18px;
  }
  .ht-timeline-year-label {
    font-family: 'Limelight', serif;
    color: var(--gold-bright);
    font-size: 1.4rem;
    border-bottom: 1px solid var(--gold-dim);
    padding-bottom: 4px;
    margin-bottom: 8px;
    letter-spacing: 0.06em;
    text-shadow: 0 0 10px rgba(212,166,74,0.3);
  }
  .ht-timeline-event {
    padding: 3px 12px;
    font-size: 0.92rem;
    color: var(--cream);
    border-left: 2px solid var(--border);
    margin-left: 4px;
    line-height: 1.5;
  }

  .ht-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .ht-tab {
    font-family: 'Special Elite', monospace;
    font-size: 0.8rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 8px 14px;
    background: none;
    color: var(--cream-dim);
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }
  .ht-tab:hover { color: var(--gold); }
  .ht-tab.active {
    color: var(--gold-bright);
    border-bottom-color: var(--gold-bright);
  }

  /* ===== SHOP ITEMS ===== */
  .ht-shop-item {
    background: linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.15));
    border: 1px solid var(--border);
    border-left: 3px solid var(--gold-dim);
    padding: 12px 14px;
    margin-bottom: 10px;
    transition: border-color 0.2s;
  }
  .ht-shop-item:hover {
    border-left-color: var(--gold-bright);
  }

  /* ===== TABLOID MODAL ===== */
  .ht-tabloid {
    background: #f3e6c4;
    color: #1a1208;
    padding: 30px 36px;
    max-width: 640px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    border: 2px solid #2a1d0d;
    box-shadow: 0 0 60px rgba(0,0,0,0.7), inset 0 0 80px rgba(139, 110, 50, 0.2);
    position: relative;
    background-image:
      repeating-linear-gradient(
        0deg,
        rgba(139, 110, 50, 0.04) 0px,
        rgba(139, 110, 50, 0.04) 1px,
        transparent 1px,
        transparent 24px
      );
    font-family: 'Special Elite', monospace;
  }
  .ht-tabloid::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 1px solid rgba(42, 29, 13, 0.3);
    pointer-events: none;
  }
  .ht-tabloid-masthead {
    text-align: center;
    font-family: 'Limelight', serif;
    font-size: 0.7rem;
    letter-spacing: 0.35em;
    color: #5a4422;
    border-bottom: 3px double #2a1d0d;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  .ht-tabloid-headline {
    font-family: 'Limelight', serif;
    font-size: clamp(1.4rem, 4vw, 2.2rem);
    line-height: 1.15;
    color: #1a1208;
    text-align: center;
    letter-spacing: 0.02em;
    margin: 8px 0 12px;
    text-transform: uppercase;
    text-shadow: 1px 1px 0 rgba(0,0,0,0.1);
  }
  .ht-tabloid-divider {
    border-top: 1px solid #2a1d0d;
    margin: 14px 0;
  }
  .ht-tabloid-lede {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 1.02rem;
    line-height: 1.55;
    color: #2a1d0d;
    margin: 0;
    text-align: justify;
    text-indent: 1.5em;
  }
  .ht-tabloid-lede::first-letter {
    font-family: 'Limelight', serif;
    font-size: 2.4rem;
    float: left;
    line-height: 0.9;
    padding: 4px 6px 0 0;
    color: #5a4422;
  }
  .ht-tabloid-outcome-label {
    font-family: 'Limelight', serif;
    text-align: center;
    color: #a8261d;
    letter-spacing: 0.3em;
    font-size: 0.85rem;
    margin: 16px 0 10px;
  }
  .ht-tabloid-outcome {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 1rem;
    line-height: 1.5;
    color: #2a1d0d;
    text-align: center;
    font-style: italic;
    padding: 0 12px;
  }
  /* Buttons inside the tabloid need their own light-on-dark style */
  .ht-tabloid .ht-btn {
    background: linear-gradient(180deg, #fff8e0, #e8d6a8);
    color: #2a1d0d;
    border-color: #5a4422;
    text-shadow: none;
  }
  .ht-tabloid .ht-btn:hover:not(:disabled) {
    background: linear-gradient(180deg, #fff4d0, #d8c490);
    border-color: #2a1d0d;
    color: #1a1208;
    box-shadow: 0 0 8px rgba(139, 110, 50, 0.4);
  }
  .ht-tabloid .ht-btn-primary {
    background: linear-gradient(180deg, #c08a30, #8a6020);
    color: #1a1208;
    border-color: #2a1d0d;
  }
  .ht-tabloid .ht-label {
    color: #5a4422;
  }

  /* ===== PRESS CLIPPING (archive view) ===== */
  .ht-clipping {
    background: linear-gradient(180deg, #f3e6c4 0%, #e8d6a8 100%);
    color: #2a1d0d;
    padding: 18px 22px;
    margin-bottom: 14px;
    border: 1px solid #5a4422;
    box-shadow: 2px 2px 6px rgba(0,0,0,0.4);
    background-image:
      repeating-linear-gradient(
        0deg,
        rgba(139, 110, 50, 0.04) 0px,
        rgba(139, 110, 50, 0.04) 1px,
        transparent 1px,
        transparent 22px
      );
    font-family: 'Crimson Pro', Georgia, serif;
    transform: rotate(-0.2deg);
  }
  .ht-clipping:nth-child(even) {
    transform: rotate(0.15deg);
  }
  .ht-clipping-date {
    font-family: 'Special Elite', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    color: #5a4422;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .ht-clipping-headline {
    font-family: 'Limelight', serif;
    font-size: clamp(1rem, 2.5vw, 1.3rem);
    line-height: 1.2;
    color: #1a1208;
    text-transform: uppercase;
    margin-bottom: 8px;
    letter-spacing: 0.02em;
  }
  .ht-clipping-lede {
    font-size: 0.92rem;
    line-height: 1.5;
    margin: 0 0 12px;
    font-style: italic;
    color: #2a1d0d;
  }
  .ht-clipping-resolution {
    border-top: 1px dashed #5a4422;
    padding-top: 8px;
    font-size: 0.88rem;
  }
  .ht-clipping-outcome {
    margin-top: 4px;
    color: #5a4422;
    font-style: italic;
  }

  /* Tooltips — hover-reveal */
  .ht-tt {
    border-bottom: 1px dotted var(--gold-dim);
    cursor: help;
  }
  .ht-tt:hover .ht-tt-bubble,
  .ht-tt:focus .ht-tt-bubble {
    visibility: visible !important;
    opacity: 1 !important;
  }

  .ht-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// ---------- COMPONENTS ----------

function Marquee() {
  return (
    <div className="ht-marquee">
      <div className="ht-marquee-title">Hollywood Tycoon</div>
      <div className="ht-marquee-sub">— A Picture of Ambition —</div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="ht-panel">
      <span className="ht-panel-corner tl" />
      <span className="ht-panel-corner tr" />
      <span className="ht-panel-corner bl" />
      <span className="ht-panel-corner br" />
      {title && <h2 className="ht-panel-title">{title}</h2>}
      {subtitle && <div className="ht-panel-sub">{subtitle}</div>}
      {children}
    </div>
  );
}

// CollapsiblePanel — Panel with a click-to-collapse header that remembers state in localStorage.
// Used on the hub for sections that get bulky late-game.
function CollapsiblePanel({ id, title, subtitle, defaultOpen = true, children, badge }) {
  const storageKey = id ? `ht-collapse-${id}` : null;
  const [open, setOpen] = useState(() => {
    if (!storageKey || !hasLocalStorage()) return defaultOpen;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'open') return true;
      if (stored === 'closed') return false;
    } catch (e) { /* ignore */ }
    return defaultOpen;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey && hasLocalStorage()) {
      try { localStorage.setItem(storageKey, next ? 'open' : 'closed'); } catch (e) { /* ignore */ }
    }
  };
  return (
    <div className="ht-panel">
      <span className="ht-panel-corner tl" />
      <span className="ht-panel-corner tr" />
      <span className="ht-panel-corner bl" />
      <span className="ht-panel-corner br" />
      <div
        onClick={toggle}
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <h2 className="ht-panel-title" style={{ margin: 0 }}>{title}</h2>}
          {subtitle && <div className="ht-panel-sub" style={{ marginBottom: open ? undefined : 0 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
          {badge && (
            <span className="ht-text-dim" style={{ fontFamily: "'Special Elite', monospace", letterSpacing: '0.05em' }}>
              {badge}
            </span>
          )}
          <span style={{ color: 'var(--gold-bright)', fontSize: '1.2rem', fontFamily: "'Special Elite', monospace", lineHeight: 1 }}>
            {open ? '▾' : '▸'}
          </span>
        </div>
      </div>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

function Bar({ value, max = 100, rep = false }) {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div className="ht-bar">
      <div className={`ht-bar-fill ${rep ? 'rep' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- SCREENS ----------

function StartScreen({ onStart, inheritedWorld }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState(null);
  // For Gen 2+, show a "Previously..." intro screen first
  const [introSeen, setIntroSeen] = useState(!inheritedWorld);

  const roleInfo = {
    actor: { icon: '🎭', desc: 'The face on the poster. Charisma, craft, and being in the right place.' },
    director: { icon: '🎬', desc: 'The vision. Shape the picture from the chair behind the camera.' },
    producer: { icon: '💼', desc: 'The deal-maker. Budgets, schedules, getting it made.' },
    writer: { icon: '✒️', desc: 'The page is everything. The story before there are any pictures.' },
  };

  const start = () => {
    if (!name.trim() || !role) return;
    onStart(name.trim(), role);
  };

  const legends = inheritedWorld?.legends || [];
  const lastLegend = legends.length > 0 ? legends[legends.length - 1] : null;

  // Intro screen for Gen 2+ — shows continuity before character creation
  if (!introSeen && inheritedWorld) {
    return (
      <div className="ht-fade-in">
        <Panel
          title={`Previously, in Your Hollywood Story...`}
          subtitle={`Generation ${inheritedWorld.generation} · The year is ${inheritedWorld.newStartYear}`}
        >
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.95rem', fontStyle: 'italic', color: 'var(--cream-dim)' }}>
            Three decades have passed since the lights first came on.
          </div>

          {lastLegend && (
            <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)', marginTop: 18 }}>
              <div className="ht-phase-block-title">★ Last Generation's Final Curtain</div>
              <p style={{ fontSize: '0.95rem', margin: '8px 0' }}>
                <strong style={{ color: 'var(--gold-bright)', fontFamily: "'Limelight', serif", fontSize: '1.2rem' }}>
                  {lastLegend.name}
                </strong>
                <span className="ht-text-dim"> — {lastLegend.legacyTier}</span>
              </p>
              <p style={{ fontSize: '0.9rem', margin: '6px 0' }}>
                {lastLegend.summary || `Active ${lastLegend.yearsActive}.`}
                {lastLegend.bestFilm && ` Their defining work was "${lastLegend.bestFilm}".`}
                {lastLegend.awards > 0 && ` They took home ${lastLegend.awards} major award${lastLegend.awards === 1 ? '' : 's'}.`}
              </p>
              {lastLegend.legacyScore && (
                <p className="ht-text-dim" style={{ fontSize: '0.82rem', marginTop: 8 }}>
                  Legacy score: <strong style={{ color: 'var(--gold-bright)' }}>{lastLegend.legacyScore}</strong>
                </p>
              )}
            </div>
          )}

          {legends.length > 1 && (
            <div style={{ marginTop: 14, fontSize: '0.88rem' }}>
              <div className="ht-label">Other names history remembers:</div>
              {legends.slice(0, -1).slice(-3).reverse().map((l, i) => (
                <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                  <strong style={{ color: 'var(--gold-bright)' }}>{l.name}</strong>
                  <span className="ht-text-dim"> — {l.legacyTier}</span>
                  {l.bestFilm && <span className="ht-text-dim"> · "{l.bestFilm}"</span>}
                </div>
              ))}
            </div>
          )}

          <p style={{ marginTop: 18, fontSize: '0.95rem', fontStyle: 'italic', textAlign: 'center', color: 'var(--cream)' }}>
            Now Hollywood is waiting for the next face. New blood. A new beginning.
          </p>

          <div className="ht-row" style={{ justifyContent: 'center', marginTop: 20 }}>
            <button className="ht-btn ht-btn-primary" onClick={() => setIntroSeen(true)}>
              Begin Your Story →
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="ht-fade-in">
      <Panel
        title={inheritedWorld ? `A New Generation` : `A New Career Begins`}
        subtitle={inheritedWorld
          ? `It is now ${inheritedWorld.newStartYear}. A new face arrives in Hollywood.`
          : `Choose your name and your craft`}
      >
        {inheritedWorld && legends.length > 0 && (
          <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)' }}>
            <div className="ht-phase-block-title">🏛 The Legends Came Before You</div>
            <p style={{ fontSize: '0.9rem', marginBottom: 8 }}>
              The industry you're walking into has memory. These names are spoken at every awards dinner:
            </p>
            {legends.slice(-5).reverse().map((l, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--border)', fontSize: '0.88rem' }}>
                <strong style={{ color: 'var(--gold-bright)' }}>{l.name}</strong>
                <span className="ht-text-dim"> — {l.legacyTier} ({l.yearsActive})</span>
                {l.bestFilm && <span className="ht-text-dim"> · "{l.bestFilm}"</span>}
                {l.awards > 0 && <span className="ht-text-dim"> · 🏆×{l.awards}</span>}
              </div>
            ))}
            <p className="ht-text-dim" style={{ fontSize: '0.82rem', marginTop: 8 }}>
              ⓘ NPCs from the previous era are aged and may still be active. Some have retired. The pool refreshes.
            </p>
          </div>
        )}

        <div className="ht-field">
          <label className="ht-label">Your Name</label>
          <input
            className="ht-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vera Sterling"
            maxLength={32}
          />
          <button
            className="ht-btn ht-btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setName(generateName())}
            type="button"
          >
            Randomize
          </button>
        </div>

        <hr className="ht-divider" />

        <div className="ht-label">Choose Your Starting Role</div>
        <div className="ht-role-grid">
          {ROLES.map(r => (
            <div
              key={r}
              className={`ht-role-card ${role === r ? 'selected' : ''}`}
              onClick={() => setRole(r)}
            >
              <span className="ht-role-icon">{roleInfo[r].icon}</span>
              <div className="ht-role-name">{ROLE_LABELS[r]}</div>
              <div className="ht-role-desc">{roleInfo[r].desc}</div>
            </div>
          ))}
        </div>

        <div className="ht-row" style={{ marginTop: 24, justifyContent: 'center' }}>
          <button
            className="ht-btn ht-btn-primary"
            disabled={!name.trim() || !role}
            onClick={start}
          >
            Sign the Contract →
          </button>
        </div>
      </Panel>

      <Panel subtitle="The Pitch">
        <p style={{ lineHeight: 1.6 }}>
          The year is <strong style={{ color: 'var(--gold)' }}>1985</strong>. The studios are hungry,
          the marquees are bright, and somewhere out there a young {role ? ROLE_LABELS[role].toLowerCase() : 'hopeful'} is
          waiting for their break. Build skills. Take roles. Make pictures.
          If you're good — and a little lucky — you might one day open the doors to your own studio.
        </p>
        <p style={{ lineHeight: 1.6 }} className="ht-text-dim">
          Talent matters. Reputation matters. The audience is fickle. The critics are merciless.
          Welcome to Hollywood.
        </p>
      </Panel>
    </div>
  );
}

// Display attached crew with named-NPC highlights (archetype, rival/friend tags)
// A simple tooltip — shows on hover, hidden otherwise. Pure CSS via title= would
// be standard but uglier; this gives us better styling.
function Tooltip({ children, text, side = 'top' }) {
  return (
    <span className="ht-tt" style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <span className="ht-tt-bubble" style={{
        position: 'absolute',
        bottom: side === 'top' ? '100%' : 'auto',
        top: side === 'bottom' ? '100%' : 'auto',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: side === 'top' ? 6 : 0,
        marginTop: side === 'bottom' ? 6 : 0,
        background: '#1a1410',
        color: 'var(--cream)',
        border: '1px solid var(--gold-dim)',
        padding: '6px 10px',
        fontSize: '0.78rem',
        fontFamily: "'Crimson Pro', serif",
        fontStyle: 'normal',
        maxWidth: 280,
        whiteSpace: 'normal',
        width: 'max-content',
        zIndex: 100,
        visibility: 'hidden',
        opacity: 0,
        transition: 'opacity 0.15s, visibility 0.15s',
        pointerEvents: 'none',
        lineHeight: 1.4,
      }}>
        {text}
      </span>
    </span>
  );
}

function CrewAttached({ project, player }) {
  const roleLabels = { actor: 'Actor', director: 'Dir.', writer: 'Writer', producer: 'Prod.' };
  const slots = [];
  for (const role of ['actor', 'director', 'writer', 'producer']) {
    const key = `npc${role.charAt(0).toUpperCase()}${role.slice(1)}`;
    const npc = project[key];
    if (!npc) continue;
    slots.push({ role, npc });
  }
  if (slots.length === 0) return <span className="ht-text-dim">—</span>;

  return (
    <span>
      {slots.map((s, i) => {
        const isNamed = !!s.npc.npcId;
        const worldNPC = isNamed ? player.worldNPCs?.[s.npc.npcId] : null;
        const isRival = worldNPC && (worldNPC.rivalryScore || 0) >= 1;
        const isFriend = worldNPC && (worldNPC.friendshipScore || 0) >= 1;
        return (
          <span key={i}>
            {i > 0 && <span className="ht-text-dim"> · </span>}
            <span style={{ color: isNamed ? 'var(--gold-bright)' : 'var(--cream)', fontWeight: isNamed ? 600 : 400 }}>
              {s.npc.name}
            </span>
            <span className="ht-text-dim"> ({roleLabels[s.role]}, sk.{s.npc.skill})</span>
            {s.npc.archetype && (
              <span className="ht-text-dim" style={{ fontSize: '0.78rem', fontStyle: 'italic' }}> · {s.npc.archetype}</span>
            )}
            {isRival && (
              <span style={{ color: 'var(--red-bright)', fontWeight: 700, fontSize: '0.78rem' }}> ★ Rival</span>
            )}
            {isFriend && !isRival && (
              <span style={{ color: '#6fcc4c', fontWeight: 700, fontSize: '0.78rem' }}> ★ Friend</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function StatsBar({ player }) {
  const upkeep = totalWeeklyUpkeep(player) + childUpkeep(player);
  const personal = player.personal || {};
  const scandalCount = (player.scandals || []).length;
  const personalIcon = personal.status === 'married' ? '💍'
    : personal.status === 'engaged' ? '💍'
    : personal.status === 'dating' ? '❤️'
    : personal.status === 'divorced' ? '💔'
    : '—';
  return (
    <div className="ht-stats-bar">
      <div className="ht-stat">
        <div className="ht-stat-label">Year / Week</div>
        <div className="ht-stat-value" style={{ fontSize: '1.1rem' }}>{player.year} · W{player.week}</div>
      </div>
      <div className="ht-stat">
        <div className="ht-stat-label">Age</div>
        <div className="ht-stat-value">{player.age}</div>
      </div>
      <div className="ht-stat">
        <div className="ht-stat-label">Cash</div>
        <div className="ht-stat-value">{fmtMoney(player.cash)}</div>
        {upkeep > 0 && (
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: '0.65rem', color: 'var(--red-bright)', marginTop: 2 }}>
            -{fmtMoney(upkeep)}/wk
          </div>
        )}
      </div>
      <div className="ht-stat">
        <div className="ht-stat-label">
          <Tooltip text="Your public visibility (0–100). Earned from film releases and lifestyle. Decays if you don't release a film for 26+ weeks. Drives offer probability, audition odds, and tabloid attention.">
            Fame
          </Tooltip>
        </div>
        <div className="ht-stat-value">{Math.round(player.fame)}</div>
      </div>
      <div className="ht-stat">
        <div className="ht-stat-label">
          <Tooltip text="Your reserves (0–100). Recovers ~15/week (more with team buffs). Drained by production and life events. Below 20 for 2+ weeks = burnt out: -3 quality on active production per week. Recover to 50+ to clear.">
            Energy
          </Tooltip>
        </div>
        <div className="ht-stat-value" style={{ color: (player.burnoutWeeks || 0) >= 2 ? 'var(--red-bright)' : player.energy < 25 ? 'var(--gold-dim)' : undefined }}>
          {player.energy}
          {(player.burnoutWeeks || 0) >= 2 && (
            <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--red-bright)', fontFamily: "'Special Elite', monospace", letterSpacing: '0.1em', marginTop: 2 }}>
              ⚠ BURNT OUT
            </span>
          )}
          {(player.burnoutWeeks || 0) < 2 && player.energy < 25 && (
            <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--gold-dim)', fontFamily: "'Special Elite', monospace", letterSpacing: '0.1em', marginTop: 2 }}>
              tired
            </span>
          )}
        </div>
      </div>
      <div className="ht-stat">
        <div className="ht-stat-label">Personal</div>
        <div className="ht-stat-value" style={{ fontSize: '1.2rem' }}>
          {personalIcon}
          {scandalCount > 0 && (
            <span style={{ color: 'var(--red-bright)', fontSize: '0.8rem', marginLeft: 4 }}>⚠{scandalCount}</span>
          )}
          {player.comebackState && (
            <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--red-bright)', fontFamily: "'Special Elite', monospace", letterSpacing: '0.1em', marginTop: 2 }}>
              ⚠ COMEBACK
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ReservesPanel — UI for studio reserves deposit/withdraw with interest projection
// CameoOffersPanel — shows pending cameo invitations from friend NPCs.
// Player can accept (1 week, +2 fame, +1 friendship) or decline (small friendship hit).
function CameoOffersPanel({ player, onAccept, onDecline }) {
  const offers = player.cameoOffers || [];
  if (offers.length === 0) {
    return (
      <p className="ht-text-dim" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        No cameo invitations right now. Friends in the industry will reach out when they have something in the works.
      </p>
    );
  }
  return (
    <div style={{ fontSize: '0.9rem' }}>
      <p className="ht-text-dim" style={{ marginTop: 0, marginBottom: 12, fontSize: '0.85rem' }}>
        One-day on-screen visits in friends' pictures. Small fame bump. Keeps a friendship warm. Expires in a few weeks if you don't respond.
      </p>
      {offers.map(offer => {
        const ageWeeks = (player.year - offer.year) * 52 + (player.week - offer.week);
        const weeksLeft = 4 - ageWeeks;
        return (
          <div
            key={offer.id}
            style={{
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--gold-bright)',
              marginBottom: 10,
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: 'var(--gold-bright)' }}>{offer.npcName}</strong>
              <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}> ({offer.npcArchetype})</span>
              <span className="ht-text-dim" style={{ fontSize: '0.78rem', float: 'right' }}>
                {weeksLeft}w left
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', marginBottom: 8 }}>
              Wants you to do a quick cameo in <em style={{ color: 'var(--cream)' }}>"{offer.filmTitle}"</em> ({offer.filmGenre}). One day on set.
            </div>
            <div className="ht-row" style={{ gap: 6 }}>
              <button className="ht-btn ht-btn-sm ht-btn-primary" onClick={() => onAccept(offer)}>
                Do it (1 wk)
              </button>
              <button className="ht-btn ht-btn-sm" onClick={() => onDecline(offer)}>
                Pass
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// FirstLookPanel — surfaces active deals and pending pitches from those deals
function FirstLookPanel({ player, onDevelop, onPass }) {
  const deals = player.firstLookDeals || [];
  const pitches = player.firstLookPitches || [];

  return (
    <div style={{ fontSize: '0.9rem' }}>
      {/* Pending pitches first — these are the actionable items */}
      {pitches.length > 0 && (
        <>
          <div className="ht-label" style={{ marginBottom: 8 }}>Active Pitches</div>
          {pitches.map(pitch => (
            <div
              key={pitch.id}
              style={{
                padding: '10px 12px',
                background: 'rgba(212,166,74,0.10)',
                border: '1px solid var(--gold-dim)',
                borderLeft: '3px solid var(--gold-bright)',
                marginBottom: 10,
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--gold-bright)' }}>{pitch.npcName}</strong>
                <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}> pitches you a {pitch.genre.toLowerCase()}</span>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, color: 'var(--cream)', marginBottom: 4 }}>
                "{pitch.workingTitle}"
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: 6, fontStyle: 'italic', color: 'var(--cream-dim)' }}>
                {pitch.premise}
              </div>
              <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
                Suggested budget: <strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(pitch.suggestedBudget)}</strong>
              </div>
              <div className="ht-row" style={{ gap: 6 }}>
                <button className="ht-btn ht-btn-sm ht-btn-primary" onClick={() => onDevelop(pitch)}>
                  Develop It →
                </button>
                <button className="ht-btn ht-btn-sm" onClick={() => onPass(pitch)}>
                  Pass
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Active deals list */}
      {deals.length > 0 && (
        <>
          <div className="ht-label" style={{ marginTop: pitches.length > 0 ? 14 : 0, marginBottom: 8 }}>Active Deals</div>
          {deals.map(d => (
            <div key={d.id} style={{ padding: '6px 10px', borderBottom: '1px dashed var(--border)', fontSize: '0.85rem' }}>
              <span><strong>{d.npcName}</strong></span>
              <span className="ht-text-dim"> · expires {d.expiresYear} · paid {fmtMoney(d.totalPaid || d.retainerPaid)}</span>
            </div>
          ))}
        </>
      )}

      {deals.length === 0 && pitches.length === 0 && (
        <p className="ht-text-dim" style={{ marginTop: 0, fontSize: '0.85rem' }}>
          No first-look deals active. Sign one with a director NPC in the Industry view.
        </p>
      )}
    </div>
  );
}

// MentorshipPanel — surfaces active mentees with per-mentee "Invest a Week" actions
// CoProducingPanel — shows pending offers and active co-productions
function CoProducingPanel({ player, onAccept, onDecline }) {
  const offers = player.coProducingOffers || [];
  const active = player.coProductions || [];
  const history = player.coProductionsHistory || [];

  if (offers.length === 0 && active.length === 0 && history.length === 0) {
    return (
      <p className="ht-text-dim" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        Other studios will pitch you producer-on-hire roles once you have 5+ films released and producer reputation 15+.
        You commit capital, share in profits. Hits make money; flops cost you.
      </p>
    );
  }

  return (
    <div style={{ fontSize: '0.9rem' }}>
      {/* Pending offers */}
      {offers.length > 0 && (
        <>
          <div className="ht-label" style={{ marginBottom: 8 }}>Pending Offers</div>
          {offers.map(offer => {
            const ageWeeks = (player.year - offer.year) * 52 + (player.week - offer.week);
            const weeksLeft = 6 - ageWeeks;
            const expectedReturn = Math.round(offer.commitment * 1.5); // rough expected on a decent picture
            return (
              <div
                key={offer.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(212,166,74,0.10)',
                  border: '1px solid var(--gold-dim)',
                  borderLeft: '3px solid var(--gold-bright)',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <strong style={{ color: 'var(--gold-bright)' }}>{offer.studio}</strong>
                    <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}> · {offer.genre.toLowerCase()}</span>
                  </div>
                  <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}>{weeksLeft}w left</span>
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, color: 'var(--cream)', marginTop: 4 }}>
                  "{offer.title}"
                </div>
                <div className="ht-text-dim" style={{ fontSize: '0.82rem', marginTop: 4, fontStyle: 'italic' }}>
                  {offer.premise}
                </div>
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', fontSize: '0.82rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
                    <div><span className="ht-text-dim">Director:</span> {offer.directorName}</div>
                    <div><span className="ht-text-dim">Total budget:</span> {fmtMoney(offer.budget)}</div>
                    <div><span className="ht-text-dim">Your commitment:</span> <strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(offer.commitment)}</strong></div>
                    <div><span className="ht-text-dim">Your share:</span> {Math.round(offer.profitSharePct * 100)}%</div>
                  </div>
                </div>
                <div className="ht-row" style={{ marginTop: 8, gap: 6 }}>
                  <button
                    className="ht-btn ht-btn-sm ht-btn-primary"
                    disabled={player.cash < offer.commitment}
                    onClick={() => onAccept(offer)}
                  >
                    Commit {fmtMoney(offer.commitment)}
                  </button>
                  <button className="ht-btn ht-btn-sm" onClick={() => onDecline(offer)}>
                    Pass
                  </button>
                </div>
                {player.cash < offer.commitment && (
                  <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    (insufficient cash)
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Active co-productions */}
      {active.length > 0 && (
        <>
          <div className="ht-label" style={{ marginTop: offers.length > 0 ? 12 : 0, marginBottom: 8 }}>In Production</div>
          {active.map(cp => {
            const weeksToRelease = (cp.releaseYear - player.year) * 52 + (cp.releaseWeek - player.week);
            return (
              <div key={cp.id} style={{ padding: '6px 10px', borderBottom: '1px dashed var(--border)', fontSize: '0.85rem' }}>
                <div>
                  <strong style={{ fontStyle: 'italic' }}>"{cp.title}"</strong>
                  <span className="ht-text-dim"> · {cp.studio} · directed by {cp.directorName}</span>
                </div>
                <div className="ht-text-dim" style={{ fontSize: '0.78rem' }}>
                  Committed: {fmtMoney(cp.commitment)} · Releases in ~{Math.max(0, weeksToRelease)} weeks
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* History — last 5 settled */}
      {history.length > 0 && (
        <>
          <div className="ht-label" style={{ marginTop: (offers.length + active.length) > 0 ? 12 : 0, marginBottom: 8 }}>Recent Settled</div>
          {history.slice(-5).reverse().map((h, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: i < Math.min(4, history.length - 1) ? '1px dashed var(--border)' : 'none', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span>
                <strong style={{ fontStyle: 'italic' }}>"{h.title}"</strong>
                <span className="ht-text-dim"> · {h.settledYear}</span>
              </span>
              <span style={{ color: h.profit > 0 ? '#6fcc4c' : h.profit < 0 ? 'var(--red-bright)' : 'var(--cream-dim)', fontWeight: 700 }}>
                {h.profit > 0 ? '+' : ''}{fmtMoney(h.profit)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function MentorshipPanel({ player, onInvest, onEnd }) {
  const active = (player.mentorships || []).filter(m => !m.endedYear);
  const alumni = player.mentoredAlumni || [];

  if (active.length === 0 && alumni.length === 0) {
    return (
      <p className="ht-text-dim" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        No active mentees. Visit the Industry view to take a rising up-and-comer under your wing.
      </p>
    );
  }

  return (
    <div style={{ fontSize: '0.9rem' }}>
      {/* Active mentorships */}
      {active.length > 0 && (
        <>
          {active.map(m => {
            const npc = player.worldNPCs?.[m.menteeNpcId];
            const yearsIn = player.year - m.startedYear;
            const sessionsThisYear = (m.sessionsByYear || {})[player.year] || 0;
            const sessionsLeft = 5 - sessionsThisYear;
            const fameLeft = npc ? Math.max(0, 60 - npc.fame) : 60;
            const progressPct = npc ? Math.min(100, (npc.fame / 60) * 100) : 0;
            return (
              <div
                key={m.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(212,166,74,0.08)',
                  border: '1px solid var(--gold-dim)',
                  borderLeft: '3px solid var(--gold-bright)',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <strong style={{ color: 'var(--gold-bright)' }}>{m.menteeName}</strong>
                    <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}> · {ROLE_LABELS[m.menteeRole]} · age {npc?.age || '?'}</span>
                  </div>
                  <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}>
                    Year {yearsIn + 1} / 5 · {m.totalSessions || 0} sessions
                  </span>
                </div>
                {/* Progress bar to graduation */}
                <div style={{ marginTop: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2 }}>
                    <span className="ht-text-dim">Fame {npc?.fame || 0} / 60 to graduate</span>
                    <span className="ht-text-dim">{fameLeft > 0 ? `${fameLeft} to go` : 'Ready!'}</span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.4)', height: 5 }}>
                    <div style={{ background: 'var(--gold-bright)', height: '100%', width: `${progressPct}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
                <div className="ht-row" style={{ gap: 6, marginTop: 8 }}>
                  <button
                    className="ht-btn ht-btn-sm ht-btn-primary"
                    onClick={() => onInvest(m.id)}
                    disabled={sessionsLeft <= 0}
                    title={sessionsLeft <= 0 ? 'Yearly session cap reached' : ''}
                  >
                    Invest a Week ({sessionsLeft}/5 this yr)
                  </button>
                  <button
                    className="ht-btn ht-btn-sm"
                    onClick={() => onEnd(m.id, 'walked_away')}
                  >
                    Step Back
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Alumni — flexed permanent friendships */}
      {alumni.length > 0 && (
        <div style={{ marginTop: active.length > 0 ? 12 : 0 }}>
          <div className="ht-label" style={{ marginBottom: 6 }}>🎓 Alumni</div>
          {alumni.map((a, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: i < alumni.length - 1 ? '1px dashed var(--border)' : 'none', fontSize: '0.82rem' }}>
              <strong>{a.menteeName}</strong>
              <span className="ht-text-dim"> · {ROLE_LABELS[a.menteeRole]} · graduated {a.graduatedYear} · {a.totalSessions} sessions invested</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReservesPanel({ player, onDeposit, onWithdraw, productionActive }) {
  const [amount, setAmount] = useState('');
  const reserves = player.studio?.reserves || 0;
  const cash = player.cash;
  const parsed = parseInt(amount.replace(/[^\d]/g, ''), 10) || 0;

  // Quick-amount presets — picked from sane fractions of available cash/reserves
  const depositPresets = [
    Math.min(cash, 10_000),
    Math.min(cash, 100_000),
    Math.min(cash, 1_000_000),
    Math.floor(cash / 2),
  ].filter((v, i, arr) => v >= 1000 && arr.indexOf(v) === i);

  const withdrawPresets = [
    Math.min(reserves, 10_000),
    Math.min(reserves, 100_000),
    Math.min(reserves, 1_000_000),
    reserves,
  ].filter((v, i, arr) => v >= 1000 && arr.indexOf(v) === i);

  // Annual interest projection
  const annualInterest = Math.round(reserves * 0.052);

  return (
    <div style={{ fontSize: '0.9rem' }}>
      <p className="ht-text-dim" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        Reserves earn <strong style={{ color: 'var(--gold-bright)' }}>~5.2% annually</strong> (0.1% weekly). Locked while a film is in production.
        {productionActive && (
          <span style={{ color: 'var(--red-bright)', display: 'block', marginTop: 4 }}>
            ⚠ Withdrawals locked — film in production.
          </span>
        )}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
          <div className="ht-text-dim" style={{ fontSize: '0.78rem', letterSpacing: '0.05em' }}>PERSONAL CASH</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--gold-bright)', fontSize: '1.2rem' }}>
            {fmtMoney(cash)}
          </div>
        </div>
        <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--gold-bright)', borderLeft: '3px solid var(--gold-bright)' }}>
          <div className="ht-text-dim" style={{ fontSize: '0.78rem', letterSpacing: '0.05em' }}>STUDIO RESERVES</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--gold-bright)', fontSize: '1.2rem' }}>
            {fmtMoney(reserves)}
          </div>
          {annualInterest > 0 && (
            <div className="ht-text-dim" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              ≈ {fmtMoney(annualInterest)}/yr
            </div>
          )}
        </div>
      </div>

      <div className="ht-field" style={{ marginBottom: 10 }}>
        <label className="ht-label">Amount</label>
        <input
          className="ht-input"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="$"
          inputMode="numeric"
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {[...new Set([...depositPresets, ...withdrawPresets])].sort((a, b) => a - b).map(v => (
            <button
              key={v}
              className="ht-btn ht-btn-sm"
              onClick={() => setAmount(String(v))}
              style={{ padding: '3px 8px', fontSize: '0.78rem' }}
            >
              {fmtMoney(v)}
            </button>
          ))}
        </div>
      </div>

      <div className="ht-row" style={{ marginTop: 10 }}>
        <button
          className="ht-btn ht-btn-primary"
          disabled={parsed <= 0 || parsed > cash}
          onClick={() => { onDeposit(parsed); setAmount(''); }}
        >
          → Deposit
        </button>
        <button
          className="ht-btn"
          disabled={parsed <= 0 || parsed > reserves || productionActive}
          onClick={() => { onWithdraw(parsed); setAmount(''); }}
        >
          ← Withdraw
        </button>
      </div>
    </div>
  );
}

function SkillsPanel({ player }) {
  return (
    <Panel title="Skills & Reputation" subtitle="The currency of your career">
      <div className="ht-skills-grid">
        {ROLES.map(r => (
          <div key={r} className="ht-skill">
            <div className="ht-skill-row">
              <span className="ht-skill-name">{ROLE_LABELS[r]}</span>
              <span className="ht-skill-num">
                SKL {player.skills[r]} · REP {player.reputation[r]}
              </span>
            </div>
            <Bar value={player.skills[r]} />
            <div style={{ height: 4 }} />
            <Bar value={Math.max(0, player.reputation[r])} rep />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LogPanel({ log }) {
  return (
    <Panel title="The Trades" subtitle="Daily Variety">
      <div className="ht-log">
        {log.length === 0 ? (
          <div className="ht-log-entry">— No headlines yet. Get to work, kid. —</div>
        ) : (
          log.slice().reverse().map((e, i) => (
            <div key={i} className="ht-log-entry">
              <span className="ht-log-week">{e.label}: </span>
              {e.text}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

// ---------- PROJECT BUILDER (when you have your own studio OR taking offers) ----------

function ProjectBuilder({ player, offer, sequelOf, onCancel, onProduce }) {
  const ownStudio = !!player.studio;
  const editable = ownStudio && !offer;

  // Compute sequel-specific defaults
  const sequelEntry = sequelOf ? sequelOf.entries.length + 1 : null;
  const sequelTitle = sequelOf
    ? `${sequelOf.title} ${toRoman(sequelEntry)}`
    : null;
  const prevEntry = sequelOf ? sequelOf.entries[sequelOf.entries.length - 1] : null;
  // Look up the previous film's record for quality/hit info — we'll receive it from the parent

  const [title, setTitle] = useState(sequelTitle || offer?.title || generateTitle('Drama'));
  const [genre, setGenre] = useState(sequelOf?.originalGenre || offer?.genre || 'Drama');
  // Sequel budgets typically larger
  const sequelBudgetDefault = sequelOf ? Math.round((sequelOf.lastBudget || 5_000_000) * 1.5) : 2_000_000;
  const [budget, setBudget] = useState(offer?.budget || sequelBudgetDefault);

  // Default marketing — what the producer/studio is currently planning
  const defaultMarketing = offer ? Math.round(offer.budget * 0.3) : Math.round(budget * 0.4);
  const [marketing, setMarketing] = useState(defaultMarketing);

  // Roles the player will fill personally
  // For sequels: pre-fill with same roles the player held on the original (if any)
  const sequelRolesDefault = sequelOf?.originalPlayerRoles?.length
    ? sequelOf.originalPlayerRoles.filter(r => player.skills[r] >= 5)
    : ['producer'];
  const [playerRoles, setPlayerRoles] = useState(
    offer ? [offer.playerRole] : sequelRolesDefault
  );

  // For sequels: per-role "return / recast" toggles for original crew
  // If player held the role, they're "returning" by default if they're filling it
  // If NPC held it, player chooses to bring them back (more expensive) or recast (cheaper, audience hit)
  const initialReturning = {};
  if (sequelOf?.rootCrew) {
    for (const r of ROLES) {
      const rootMember = sequelOf.rootCrew[r];
      if (rootMember) {
        // Default: bring back the original (continuity)
        initialReturning[r] = true;
      }
    }
  }
  const [returningCrew, setReturningCrew] = useState(initialReturning);
  const toggleReturning = (r) => {
    setReturningCrew(prev => ({ ...prev, [r]: !prev[r] }));
  };

  // Player controls marketing only if they're the producer (studio owner) OR
  // if they're playing producer on an outside offer.
  const playerControlsMarketing = ownStudio && !offer
    ? playerRoles.includes('producer')
    : offer
      ? offer.playerRole === 'producer'
      : false;

  const togglePlayerRole = (r) => {
    if (offer) return; // can't change role on outside offers
    setPlayerRoles(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  // Cast overrides: player can request a specific friend NPC for any open role.
  // Maps role → npcId. Cleared if that role becomes the player's own.
  const [castOverrides, setCastOverrides] = useState({});
  const [pickingRole, setPickingRole] = useState(null); // role being picked for, or null
  // Auto-clear overrides for roles the player has now claimed
  useEffect(() => {
    setCastOverrides(prev => {
      const next = { ...prev };
      let changed = false;
      for (const r of ROLES) {
        if (playerRoles.includes(r) && next[r]) {
          delete next[r];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [playerRoles]);

  const requestCastOverride = (role, npcId) => {
    setCastOverrides(prev => ({ ...prev, [role]: npcId }));
    setPickingRole(null);
  };
  const clearCastOverride = (role) => {
    setCastOverrides(prev => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
  };

  // For player-owned studio projects, NPCs fill the roles the player isn't doing
  // For sequels: returning crew uses the original NPCs (with skill bumped slightly for experience)
  const otherRoles = useMemo(() => {
    if (offer) {
      return {
        actor: offer.playerRole !== 'actor' ? offer.npcActor : null,
        director: offer.playerRole !== 'director' ? offer.npcDirector : null,
        producer: offer.playerRole !== 'producer' ? offer.npcProducer : null,
        writer: offer.playerRole !== 'writer' ? offer.npcWriter : null,
      };
    }
    const result = {};
    const buffs = ownedBuffs(player);
    // Budget + player fame determines if we can attract named talent
    const projectTier = Math.log10(budget / 100000 + 1) * 15 + player.fame;
    const namedChance = clamp(0.15 + projectTier / 200, 0.15, 0.85);
    for (const r of ROLES) {
      if (playerRoles.includes(r)) {
        result[r] = null;
      } else if (castOverrides[r] && player.worldNPCs?.[castOverrides[r]]) {
        // Player explicitly requested this NPC for this role
        const npc = player.worldNPCs[castOverrides[r]];
        result[r] = {
          name: npc.name,
          skill: npc.skill,
          npcId: npc.id,
          archetype: npc.archetype,
          returning: false,
          chosenByPlayer: true,
        };
      } else if (sequelOf && returningCrew[r] && sequelOf.rootCrew?.[r]) {
        // Returning crew from original — slight skill bump for franchise familiarity
        const orig = sequelOf.rootCrew[r];
        result[r] = { name: orig.name, skill: clamp((orig.skill || 50) + 2, 10, 100), returning: true, npcId: orig.npcId };
      } else {
        // Try to attract a named world NPC at appropriate fame level
        let cast = null;
        if (player.worldNPCs && Math.random() < namedChance) {
          const minFame = Math.max(0, Math.floor(projectTier * 0.4));
          const npc = pickWorldNPC(player.worldNPCs, r, minFame, 100);
          if (npc) {
            cast = { name: npc.name, skill: npc.skill, npcId: npc.id, archetype: npc.archetype, returning: false };
          }
        }
        if (!cast) {
          const baseSkill = clamp(20 + Math.log10(budget / 100000 + 1) * 12 + randInt(-6, 6) + buffs.npcSkillBonus, 10, 95);
          cast = { name: generateName(), skill: Math.round(baseSkill), returning: false };
        }
        result[r] = cast;
      }
    }
    return result;
  }, [playerRoles, budget, offer, player, sequelOf, returningCrew, castOverrides]);

  // Studio's planned marketing — shown to actor/director but not editable
  const plannedMarketing = offer ? defaultMarketing : marketing;

  const studioCost = ownStudio && !offer ? budget + marketing : 0;
  const canAfford = !offer ? player.cash >= studioCost : true;

  const start = () => {
    const proj = {
      title,
      genre,
      budget,
      marketing: playerControlsMarketing ? marketing : plannedMarketing,
      playerRoles,
      ...buildRoleStats(player, playerRoles, otherRoles),
      // For NPC names, carry through so phases can reference them
      crew: {
        actor: playerRoles.includes('actor') ? { name: player.name, skill: player.skills.actor } : otherRoles.actor,
        director: playerRoles.includes('director') ? { name: player.name, skill: player.skills.director } : otherRoles.director,
        producer: playerRoles.includes('producer') ? { name: player.name, skill: player.skills.producer } : otherRoles.producer,
        writer: playerRoles.includes('writer') ? { name: player.name, skill: player.skills.writer } : otherRoles.writer,
      },
    };

    // Franchise: if this is a sequel, attach the franchise object so simulateMovie can apply mods
    if (sequelOf) {
      // Compute continuity/recast scores
      let continuityScore = 0;
      let recastPenalty = 0;
      for (const r of ROLES) {
        const rootMember = sequelOf.rootCrew?.[r];
        if (!rootMember) continue;
        const playerHasThisRole = sequelOf.originalPlayerRoles?.includes(r);
        if (playerHasThisRole && playerRoles.includes(r)) {
          // Player held the role originally and is reprising it
          continuityScore += 3;
        } else if (playerHasThisRole && !playerRoles.includes(r)) {
          // Player held it originally but isn't reprising → recast
          recastPenalty += r === 'actor' || r === 'director' ? 4 : 2;
        } else if (returningCrew[r]) {
          // NPC was original; bringing them back
          continuityScore += 3;
        } else {
          // NPC was original; recasting
          recastPenalty += r === 'actor' || r === 'director' ? 4 : 2;
        }
      }

      proj.franchise = {
        id: sequelOf.id,
        entry: sequelEntry,
        rootCrew: sequelOf.rootCrew,
        prevEntryQuality: sequelOf.lastQuality,
        prevEntryHit: sequelOf.lastHit,
        continuityScore,
        recastPenalty,
      };
    }

    onProduce({ proj, studioCost, offer });
  };

  return (
    <div className="ht-fade-in">
      <Panel
        title={sequelOf
          ? `Greenlight: ${sequelOf.title} ${toRoman(sequelEntry)}`
          : offer ? 'Greenlight: Production Offer' : 'Greenlight: New Production'}
        subtitle={sequelOf
          ? `Sequel — Entry ${sequelEntry} in the franchise`
          : offer ? `An outside studio wants you as ${ROLE_LABELS[offer.playerRole]}` : 'Set the picture in motion'}
      >
        {sequelOf && (
          <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)' }}>
            <div className="ht-phase-block-title">🎞️ Franchise Context</div>
            <p style={{ fontSize: '0.9rem', margin: '6px 0' }}>
              Original: <strong>"{sequelOf.title}"</strong> ({sequelOf.entries[0]?.year}).
              {sequelOf.lastHit ? (
                <span style={{ color: '#6fcc4c' }}> The last entry was a hit — audiences are primed.</span>
              ) : (
                <span style={{ color: 'var(--gold-dim)' }}> The previous entry's reception was mixed — expectations are tempered.</span>
              )}
            </p>
            <p style={{ fontSize: '0.85rem' }} className="ht-text-dim">
              Sequels open bigger but drop faster, and critics hold them to a higher standard. Keeping original talent helps.
            </p>
          </div>
        )}

        <div className="ht-field">
          <label className="ht-label">Title</label>
          <input
            className="ht-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!editable && !!offer}
          />
          {editable && (
            <button className="ht-btn ht-btn-sm" style={{ marginTop: 8 }} onClick={() => setTitle(generateTitle(genre))}>
              Suggest Title
            </button>
          )}
        </div>

        <div className="ht-field">
          <label className="ht-label">Genre</label>
          <select className="ht-select" value={genre} onChange={e => setGenre(e.target.value)} disabled={!editable}>
            {GENRES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div className="ht-field">
          <label className="ht-label">
            Production Budget: <span style={{ color: 'var(--gold-bright)' }}>{fmtMoney(budget)}</span>
            {!editable && <span className="ht-text-dim"> (set by studio)</span>}
          </label>
          {editable && (() => {
            // Genre Icon bonus: +30% effective budget cap when greenlighting in your Icon genre
            const spec = getGenreSpecialty(player, genre);
            const iconBonus = spec?.tier?.label === 'Icon' ? 1.3 : 1.0;
            const baseCap = Math.max(player.studio.budgetCap || 50_000_000, (ownedBuffs(player).studioBudgetCap || 0));
            const effectiveCap = Math.min(baseCap * iconBonus, player.cash);
            return (
              <>
                <input
                  type="range"
                  min={200_000}
                  max={effectiveCap}
                  step={100_000}
                  value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                {iconBonus > 1 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--gold-bright)', marginTop: 4 }}>
                    ★ {genre} Icon bonus: +30% budget cap available
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="ht-field">
          <label className="ht-label">
            Marketing Budget: <span style={{ color: 'var(--gold-bright)' }}>{fmtMoney(playerControlsMarketing ? marketing : plannedMarketing)}</span>
            {!playerControlsMarketing && <span className="ht-text-dim"> (the producer decides — but you can boost it later)</span>}
          </label>
          {playerControlsMarketing ? (
            <input
              type="range"
              min={50_000}
              max={offer ? offer.budget * 2 : budget * 1.5}
              step={50_000}
              value={marketing}
              onChange={e => setMarketing(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          ) : (
            <div style={{ height: 8, background: 'var(--ink)', border: '1px solid var(--border)' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--gold-dim), var(--gold-bright))',
                width: `${clamp((plannedMarketing / (budget || 1)) * 60, 5, 100)}%`,
                opacity: 0.5,
              }} />
            </div>
          )}
        </div>

        <hr className="ht-divider" />

        <div className="ht-label">Your Role(s) on This Picture</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {ROLES.map(r => {
            const isSelected = playerRoles.includes(r);
            const canDo = player.skills[r] >= 5;
            const lockedByOffer = offer && r !== offer.playerRole;
            return (
              <button
                key={r}
                className={`ht-btn ht-btn-sm ${isSelected ? 'ht-btn-primary' : ''}`}
                onClick={() => togglePlayerRole(r)}
                disabled={offer ? lockedByOffer : !canDo}
                title={!canDo ? 'Skill too low' : ''}
              >
                {ROLE_LABELS[r]} {isSelected ? '✓' : ''}
              </button>
            );
          })}
        </div>

        <div className="ht-label">The Crew</div>
        <div style={{ fontSize: '0.95rem' }}>
          {ROLES.map(r => {
            const isPlayer = playerRoles.includes(r);
            const npc = otherRoles[r];
            const rootMember = sequelOf?.rootCrew?.[r];
            const isReturning = npc?.returning;
            return (
              <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                <span><strong>{ROLE_LABELS[r]}:</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isPlayer ? (
                    <span style={{ color: 'var(--gold-bright)' }}>
                      {player.name} (you)
                      {sequelOf?.originalPlayerRoles?.includes(r) && (
                        <span className="ht-tag" style={{ marginLeft: 6, borderColor: '#6fcc4c', color: '#6fcc4c' }}>Returning</span>
                      )}
                    </span>
                  ) : npc ? (
                    <span>
                      {npc.name} <span className="ht-text-dim">— skill {npc.skill}</span>
                      {npc.npcId && (() => {
                        const worldNPC = player.worldNPCs?.[npc.npcId];
                        if (!worldNPC) return null;
                        const isRival = (worldNPC.rivalryScore || 0) >= 1;
                        const isFriend = (worldNPC.friendshipScore || 0) >= 1;
                        return (
                          <>
                            {npc.archetype && (
                              <span className="ht-text-dim" style={{ fontSize: '0.78rem', marginLeft: 6, fontStyle: 'italic' }}>
                                ({npc.archetype})
                              </span>
                            )}
                            {isRival && (
                              <Tooltip text="Rivalry friction reduces this film's quality by up to 2 points. Total rivalry penalty across all crew caps at -5.">
                                <span className="ht-tag" style={{ marginLeft: 6, borderColor: 'var(--red-bright)', color: 'var(--red-bright)' }}>
                                  {(worldNPC.rivalryScore || 0) >= 3 ? '★ Rival' : 'Rival'}
                                </span>
                              </Tooltip>
                            )}
                            {isFriend && !isRival && (
                              <Tooltip text="Chemistry bonus adds up to +3 quality from this collaborator. Total chemistry across all crew caps at +6.">
                                <span className="ht-tag" style={{ marginLeft: 6, borderColor: '#6fcc4c', color: '#6fcc4c' }}>
                                  {(worldNPC.friendshipScore || 0) >= 3 ? '★ Friend' : 'Friend'}
                                </span>
                              </Tooltip>
                            )}
                          </>
                        );
                      })()}
                      {isReturning && (
                        <span className="ht-tag" style={{ marginLeft: 6, borderColor: '#6fcc4c', color: '#6fcc4c' }}>Returning</span>
                      )}
                      {sequelOf && rootMember && !isReturning && !isPlayer && (
                        <span className="ht-tag" style={{ marginLeft: 6, borderColor: 'var(--red-bright)', color: 'var(--red-bright)' }}>Recast</span>
                      )}
                    </span>
                  ) : '—'}
                  {sequelOf && rootMember && !isPlayer && (
                    <button
                      className="ht-btn ht-btn-sm"
                      onClick={() => toggleReturning(r)}
                      style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                    >
                      {returningCrew[r] ? `Recast` : `Bring ${rootMember.name} back`}
                    </button>
                  )}
                  {/* Cast a Friend: own studio, not offer, not player role, not in sequel-returning slot.
                      Show button only if there's at least one friend NPC of this role. */}
                  {editable && !isPlayer && !(sequelOf && rootMember) && (() => {
                    const friendCandidates = Object.values(player.worldNPCs || {}).filter(
                      n => n.status === 'active' && n.role === r && (n.friendshipScore || 0) >= 1
                    );
                    if (friendCandidates.length === 0) return null;
                    const isOverride = !!castOverrides[r];
                    return (
                      <>
                        <button
                          className="ht-btn ht-btn-sm"
                          onClick={() => setPickingRole(r)}
                          style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                        >
                          {isOverride ? 'Change' : '✓ Cast Friend'}
                        </button>
                        {isOverride && (
                          <button
                            className="ht-btn ht-btn-sm ht-btn-danger"
                            onClick={() => clearCastOverride(r)}
                            style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                            title="Clear cast override — back to random pick"
                          >
                            ×
                          </button>
                        )}
                      </>
                    );
                  })()}
                </span>
              </div>
            );
          })}
        </div>

        <hr className="ht-divider" />

        {/* Sequel forecast panel — shows expected quality range based on franchise health */}
        {sequelOf && (() => {
          // Look up previous entry data from player history
          const prevEntries = (player.history || []).filter(f =>
            (sequelOf.entries || []).some(e => e.title === f.title)
          );
          if (prevEntries.length === 0) return null;
          const prevFilm = prevEntries[prevEntries.length - 1];
          const prevQuality = prevFilm.result?.quality || 50;
          const prevHit = !!prevFilm.result?.hit;
          const entry = sequelEntry;

          // Compute continuity score: how many roles are returning from original
          let continuity = 0;
          let recast = 0;
          if (sequelOf.rootCrew) {
            for (const r of ROLES) {
              const root = sequelOf.rootCrew[r];
              if (!root) continue;
              if (playerRoles.includes(r) && sequelOf.originalPlayerRoles?.includes(r)) {
                continuity += 3; // player returns
              } else if (returningCrew[r]) {
                continuity += 2; // NPC returns
              } else {
                recast += 2; // recast
              }
            }
          }

          // Fatigue math (matches simulateMovie)
          const fatigue = Math.max(0, entry - 2) * 4;
          const prevGoodwill = Math.max(0, (prevQuality - 50) / 3);
          const netFatigue = Math.max(0, fatigue - prevGoodwill);

          // Audience expectation tax
          const noHitPenalty = prevHit ? 2 : (6 + Math.max(0, entry - 3) * 2);

          // Net quality modifier (rough estimate, no luck/skills yet)
          const netQualityMod = continuity - recast - netFatigue;

          let healthLabel, healthColor;
          if (netQualityMod >= 5 && prevHit) {
            healthLabel = 'Franchise is hot — sequel will benefit';
            healthColor = '#6fcc4c';
          } else if (netQualityMod >= 0) {
            healthLabel = 'Franchise is healthy';
            healthColor = 'var(--gold-bright)';
          } else if (netQualityMod >= -5) {
            healthLabel = 'Franchise is showing fatigue';
            healthColor = 'var(--gold-dim)';
          } else {
            healthLabel = '⚠ Franchise is exhausted — expect a flop';
            healthColor = 'var(--red-bright)';
          }

          return (
            <div className="ht-phase-block" style={{ borderLeftColor: healthColor, marginBottom: 14 }}>
              <div className="ht-phase-block-title">📊 Sequel Forecast — Entry #{entry}</div>
              <div style={{ marginTop: 6, fontSize: '0.88rem' }}>
                <div style={{ color: healthColor, fontWeight: 700, marginBottom: 6 }}>
                  {healthLabel}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.82rem' }}>
                  <div>
                    <span className="ht-text-dim">Previous: </span>
                    <span style={{ color: prevHit ? '#6fcc4c' : 'var(--cream)' }}>
                      Q{prevQuality} {prevHit ? '· hit' : '· no hit'}
                    </span>
                  </div>
                  <div>
                    <span className="ht-text-dim">Goodwill carryover: </span>
                    <span style={{ color: '#6fcc4c' }}>+{Math.round(prevGoodwill)}</span>
                  </div>
                  <div>
                    <span className="ht-text-dim">Continuity bonus: </span>
                    <span style={{ color: '#6fcc4c' }}>+{continuity}</span>
                  </div>
                  <div>
                    <span className="ht-text-dim">Recast penalty: </span>
                    <span style={{ color: 'var(--red-bright)' }}>-{recast}</span>
                  </div>
                  <div>
                    <span className="ht-text-dim">Fatigue: </span>
                    <span style={{ color: 'var(--red-bright)' }}>-{fatigue}</span>
                  </div>
                  <div>
                    <span className="ht-text-dim">Audience tax: </span>
                    <span style={{ color: 'var(--red-bright)' }}>-{noHitPenalty}</span>
                  </div>
                </div>
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', fontSize: '0.82rem' }}>
                  <span className="ht-text-dim">Net quality modifier (before luck): </span>
                  <strong style={{ color: netQualityMod >= 0 ? '#6fcc4c' : 'var(--red-bright)' }}>
                    {netQualityMod >= 0 ? '+' : ''}{netQualityMod.toFixed(1)}
                  </strong>
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="ht-label">Cost to You:</span>
          <span style={{ color: canAfford ? 'var(--gold-bright)' : 'var(--red-bright)', fontWeight: 700 }}>
            {fmtMoney(studioCost)}
          </span>
        </div>
        {offer && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="ht-label">Your Pay (on release):</span>
            <span style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>{fmtMoney(offer.pay)}</span>
          </div>
        )}

        <div className="ht-row" style={{ marginTop: 18 }}>
          <button className="ht-btn" onClick={onCancel}>Cancel</button>
          <button className="ht-btn ht-btn-primary" disabled={!canAfford || playerRoles.length === 0} onClick={start}>
            🎬 Begin Pre-Production →
          </button>
        </div>
      </Panel>

      {/* Cast a Friend modal */}
      {pickingRole && (
        <CastFriendModal
          role={pickingRole}
          player={player}
          currentOverrideId={castOverrides[pickingRole]}
          onPick={(npcId) => requestCastOverride(pickingRole, npcId)}
          onClose={() => setPickingRole(null)}
        />
      )}
    </div>
  );
}

// Modal: pick a friend NPC for a specific role
function CastFriendModal({ role, player, currentOverrideId, onPick, onClose }) {
  const candidates = Object.values(player.worldNPCs || {})
    .filter(n => n.status === 'active' && n.role === role && (n.friendshipScore || 0) >= 1)
    .sort((a, b) => (b.friendshipScore || 0) - (a.friendshipScore || 0));

  return (
    <div className="ht-modal-bg" onClick={onClose}>
      <div className="ht-poster" onClick={e => e.stopPropagation()}>
        <div className="ht-poster-tag">★ Cast a Friend ★</div>
        <div className="ht-poster-title" style={{ fontSize: '1.5rem' }}>
          Choose your {ROLE_LABELS[role]}
        </div>
        <p style={{ textAlign: 'center', fontStyle: 'italic', marginTop: 12, color: 'var(--cream-dim)' }}>
          Your collaborators. The ones you trust on set.
        </p>

        <div style={{ marginTop: 20, maxHeight: '50vh', overflowY: 'auto' }}>
          {candidates.length === 0 ? (
            <p className="ht-text-dim" style={{ textAlign: 'center' }}>
              No friend {ROLE_LABELS[role].toLowerCase()}s yet. Make films with someone in this role to build friendship.
            </p>
          ) : (
            candidates.map(npc => {
              const sharedFilms = findSharedFilms(player, npc.id);
              const isCurrent = currentOverrideId === npc.id;
              const isCloseFriend = (npc.friendshipScore || 0) >= 3;
              return (
                <div
                  key={npc.id}
                  style={{
                    padding: '12px',
                    marginBottom: 8,
                    border: isCurrent ? '2px solid var(--gold-bright)' : '1px solid var(--border)',
                    background: isCurrent ? 'rgba(212, 165, 78, 0.1)' : 'rgba(0,0,0,0.25)',
                    cursor: 'pointer',
                  }}
                  onClick={() => onPick(npc.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ color: 'var(--gold-bright)' }}>{npc.name}</strong>
                      <span className="ht-text-dim" style={{ fontStyle: 'italic', fontSize: '0.85rem', marginLeft: 6 }}>
                        ({npc.archetype})
                      </span>
                      {isCloseFriend && (
                        <span className="ht-tag" style={{ marginLeft: 6, borderColor: '#6fcc4c', color: '#6fcc4c' }}>★ Close Friend</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <span className="ht-text-dim">Skill {npc.skill} · Fame {npc.fame} · Age {npc.age}</span>
                    </div>
                  </div>
                  {sharedFilms.length > 0 && (
                    <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                      Together: {sharedFilms.map(f => `"${f.title}" (${f.year})`).join(', ')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="ht-row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button className="ht-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function buildRoleStats(player, playerRoles, otherRoles) {
  const result = {};
  for (const r of ROLES) {
    if (playerRoles.includes(r)) {
      result[`${r}Skill`] = player.skills[r];
      result[`${r}Rep`] = Math.max(0, player.reputation[r]);
    } else {
      result[`${r}Skill`] = otherRoles[r]?.skill || 20;
      result[`${r}Rep`] = otherRoles[r]?.skill ? Math.max(0, otherRoles[r].skill - 30) : 0;
    }
  }
  return result;
}

// ---------- RESULT MODAL ----------

function ResultModal({ result, project, onClose }) {
  if (!result) return null;
  const { criticScore, audienceScore, boxOffice, profit, totalCost, hit, flop } = result;
  const scoreClass = (s) => s >= 75 ? 'hi' : s >= 50 ? 'mid' : 'lo';
  const verdict = hit ? { txt: 'A SMASH HIT!', cls: 'hit' }
    : flop ? { txt: 'A Flop.', cls: 'flop' }
    : profit > 0 ? { txt: 'A Modest Success', cls: 'ok' }
    : { txt: 'Disappointing.', cls: 'flop' };

  return (
    <div className="ht-modal-bg" onClick={onClose}>
      <div className="ht-poster" onClick={e => e.stopPropagation()}>
        <div className="ht-poster-tag">★ Now Playing ★</div>
        <div className="ht-poster-title">{project.title}</div>
        <div className="ht-poster-genre">— A {project.genre} Picture —</div>

        <div className="ht-score-row">
          <div className="ht-score-box">
            <div className="ht-score-label">Critics</div>
            <div className={`ht-score-num ${scoreClass(criticScore)}`}>{criticScore}</div>
          </div>
          <div className="ht-score-box">
            <div className="ht-score-label">Audience</div>
            <div className={`ht-score-num ${scoreClass(audienceScore)}`}>{audienceScore}</div>
          </div>
        </div>

        <div className="ht-box-office">
          <div className="ht-box-office-label">Opening to Final Gross</div>
          <div className="ht-box-office-num">{fmtMoney(boxOffice)}</div>
          <div className="ht-text-dim" style={{ marginTop: 4 }}>
            Cost: {fmtMoney(totalCost)} · Profit: <span style={{ color: profit > 0 ? '#6fcc4c' : 'var(--red-bright)' }}>{fmtMoney(profit)}</span>
          </div>
        </div>

        <div className={`ht-verdict ${verdict.cls}`}>{verdict.txt}</div>

        {result.skillGains && Object.values(result.skillGains).some(v => v > 0) && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, border: '1px solid var(--border)', marginTop: 12 }}>
            <div className="ht-label">Gains</div>
            {ROLES.map(r => {
              const sg = result.skillGains[r];
              const rg = result.repGains[r];
              if (!sg && !rg) return null;
              return (
                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                  <span>{ROLE_LABELS[r]}</span>
                  <span style={{ color: 'var(--gold-bright)' }}>
                    {sg > 0 && `+${sg} skill `}
                    {rg !== 0 && (
                      <span style={{ color: rg > 0 ? '#6fcc4c' : 'var(--red-bright)' }}>
                        {rg > 0 ? '+' : ''}{rg} rep
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.95rem' }}>
              <span>Fame</span>
              <span style={{ color: result.fameGain >= 0 ? '#6fcc4c' : 'var(--red-bright)' }}>
                {result.fameGain >= 0 ? '+' : ''}{result.fameGain}
              </span>
            </div>
          </div>
        )}

        <div className="ht-row" style={{ marginTop: 20, justifyContent: 'center' }}>
          <button className="ht-btn ht-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- AUDITION RESULT MODAL ----------

function AuditionResultModal({ data, onAccept, onClose }) {
  if (!data) return null;
  const { audition, outcome } = data;

  const headline = outcome.result === 'booked'
    ? { txt: '★ You Got the Part! ★', cls: 'hit' }
    : outcome.result === 'callback'
      ? { txt: 'Callback — Then Cut', cls: 'ok' }
      : { txt: 'Not This Time', cls: 'flop' };

  const body = outcome.result === 'booked'
    ? `The casting director loved you. "${audition.title}" is yours — they want to start shooting soon.`
    : outcome.result === 'callback'
      ? `You read well enough to get called back, but the role went to someone else. The lessons stick — you're a little sharper for next time.`
      : `The room didn't connect with your read. ${audition.competitors} others auditioned. They went a different direction.`;

  return (
    <div className="ht-modal-bg" onClick={onClose}>
      <div className="ht-poster" onClick={e => e.stopPropagation()}>
        <div className="ht-poster-tag">★ The Audition ★</div>
        <div className="ht-poster-title">{audition.title}</div>
        <div className="ht-poster-genre">— Casting: {ROLE_LABELS[audition.playerRole]} —</div>

        <div className={`ht-verdict ${headline.cls}`} style={{ marginTop: 20 }}>{headline.txt}</div>

        <p style={{ textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5, padding: '0 8px' }}>{body}</p>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, border: '1px solid var(--border)', marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span className="ht-text-dim">Your performance</span>
            <span style={{ color: 'var(--gold-bright)' }}>{Math.round(outcome.performance)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: 4 }}>
            <span className="ht-text-dim">What they wanted</span>
            <span style={{ color: 'var(--cream)' }}>{audition.threshold}</span>
          </div>
        </div>

        <div className="ht-row" style={{ marginTop: 20, justifyContent: 'center' }}>
          {outcome.result === 'booked' ? (
            <button className="ht-btn ht-btn-primary" onClick={onAccept}>Start the Picture →</button>
          ) : (
            <button className="ht-btn" onClick={onClose}>Onward</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- BOX OFFICE CHART ----------
// A vintage-feel chart of a film's weekly run.
// We draw bars for each week's gross and overlay a line for cumulative total.

function BoxOfficeChart({ run, height = 180, showCumulative = true, projected = false }) {
  if (!run || run.length === 0) return null;

  const weeks = run.length;
  const maxWeekly = Math.max(...run.map(w => w.gross));
  const totalCum = run[run.length - 1].cumulative;

  const padL = 40;
  const padR = 20;
  const padT = 14;
  const padB = 28;
  const chartW = 600; // logical width; svg scales
  const chartH = height;
  const barAreaW = chartW - padL - padR;
  const barAreaH = chartH - padT - padB;
  const barW = barAreaW / weeks;

  // Bar heights
  const barY = (val) => padT + barAreaH - (val / (maxWeekly || 1)) * barAreaH;

  // Cumulative line
  const cumLine = run.map((w, i) => {
    const x = padL + i * barW + barW / 2;
    const y = padT + barAreaH - (w.cumulative / (totalCum || 1)) * barAreaH;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  // Y-axis labels (weekly grosses)
  const ticks = 4;
  const yLabels = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = maxWeekly * (1 - i / ticks);
    return {
      y: padT + (i / ticks) * barAreaH,
      label: fmtMoney(val).replace('$', ''),
    };
  });

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}
    >
      {/* Grid lines */}
      {yLabels.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={chartW - padR} y1={t.y} y2={t.y} stroke="rgba(212,166,74,0.1)" strokeWidth="1" />
          <text x={padL - 6} y={t.y + 4} textAnchor="end" fill="rgba(243,230,196,0.5)" fontSize="10" fontFamily="'Special Elite', monospace">{t.label}</text>
        </g>
      ))}

      {/* Bars (weekly gross) */}
      {run.map((w, i) => {
        const x = padL + i * barW + 1;
        const h = (w.gross / (maxWeekly || 1)) * barAreaH;
        const y = padT + barAreaH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={Math.max(2, barW - 2)}
              height={h}
              fill={projected ? 'rgba(212,166,74,0.3)' : 'url(#barGrad)'}
              stroke="var(--gold-dim)"
              strokeWidth="0.5"
            />
            {/* X-axis labels (week numbers) */}
            <text x={x + barW / 2} y={chartH - padB + 14} textAnchor="middle" fill="rgba(243,230,196,0.6)" fontSize="9" fontFamily="'Special Elite', monospace">
              W{w.weekInRun}
            </text>
          </g>
        );
      })}

      {/* Cumulative line overlay */}
      {showCumulative && (
        <>
          <path d={cumLine} stroke="var(--gold-bright)" strokeWidth="2" fill="none" opacity="0.85" />
          {run.map((w, i) => {
            const x = padL + i * barW + barW / 2;
            const y = padT + barAreaH - (w.cumulative / (totalCum || 1)) * barAreaH;
            return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--gold-bright)" />;
          })}
        </>
      )}

      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0c460" />
          <stop offset="100%" stopColor="#8a6f2d" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------- OPENING WEEKEND MODAL ----------

function OpeningWeekendModal({ data, onClose }) {
  if (!data) return null;
  const { film, result, openingGross, totalProjected } = data;
  const scoreClass = (s) => s >= 75 ? 'hi' : s >= 50 ? 'mid' : 'lo';

  // Pull the rough projection (don't reveal exact total)
  const projectionText = openingGross >= totalProjected * 0.35
    ? 'A front-loaded opening. The drop in week two may be steep.'
    : openingGross >= totalProjected * 0.22
    ? 'A solid opening. With good word of mouth it could have legs.'
    : 'A soft opening. But quieter films sometimes find their audience.';

  return (
    <div className="ht-modal-bg" onClick={onClose}>
      <div className="ht-poster" onClick={e => e.stopPropagation()}>
        <div className="ht-poster-tag">★ Opening Weekend ★</div>
        <div className="ht-poster-title">{film.title}</div>
        <div className="ht-poster-genre">— A {film.genre} Picture —</div>

        <div className="ht-score-row">
          <div className="ht-score-box">
            <div className="ht-score-label">Critics</div>
            <div className={`ht-score-num ${scoreClass(result.criticScore)}`}>{result.criticScore}</div>
          </div>
          <div className="ht-score-box">
            <div className="ht-score-label">Audience</div>
            <div className={`ht-score-num ${scoreClass(result.audienceScore)}`}>{result.audienceScore}</div>
          </div>
        </div>

        <div className="ht-box-office">
          <div className="ht-box-office-label">Opening Weekend Gross</div>
          <div className="ht-box-office-num">{fmtMoney(openingGross)}</div>
          <div className="ht-text-dim" style={{ marginTop: 6, fontSize: '0.85rem' }}>
            {projectionText}
          </div>
        </div>

        {result.skillGains && Object.values(result.skillGains).some(v => v > 0) && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, border: '1px solid var(--border)', marginTop: 12 }}>
            <div className="ht-label">Skill & Rep Changes</div>
            {ROLES.map(r => {
              const sg = result.skillGains[r];
              const rg = result.repGains[r];
              if (!sg && !rg) return null;
              return (
                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                  <span>{ROLE_LABELS[r]}</span>
                  <span style={{ color: 'var(--gold-bright)' }}>
                    {sg > 0 && `+${sg} skill `}
                    {rg !== 0 && (
                      <span style={{ color: rg > 0 ? '#6fcc4c' : 'var(--red-bright)' }}>
                        {rg > 0 ? '+' : ''}{rg} rep
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.95rem' }}>
              <span>Fame</span>
              <span style={{ color: result.fameGain >= 0 ? '#6fcc4c' : 'var(--red-bright)' }}>
                {result.fameGain >= 0 ? '+' : ''}{result.fameGain}
              </span>
            </div>
          </div>
        )}

        <p className="ht-text-dim" style={{ fontSize: '0.85rem', marginTop: 14, textAlign: 'center' }}>
          The film will play out over the coming weeks. Track its run from the hub.
        </p>

        <div className="ht-row" style={{ marginTop: 20, justifyContent: 'center' }}>
          <button className="ht-btn ht-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- FILM CHART MODAL — full run viewer ----------

function FilmChartModal({ film, player, onReRelease, onClose }) {
  if (!film) return null;
  const totalBox = film.isOpen ? film.currentCumulative : film.result.boxOffice;
  const totalCost = film.budget + film.marketing + (film.costOverrun || 0);
  const profit = totalBox - totalCost;

  // Eligibility for Director's Cut re-release:
  // - Player directed it
  // - Film is closed (not still playing)
  // - At least 3 years old
  // - Hasn't already had a director's cut
  // - Player still alive/active (not retired)
  const directedByPlayer = (film.playerRoles || []).includes('director');
  const filmYear = film.releaseYear || film.year;
  const yearsSinceRelease = player ? (player.year - filmYear) : 0;
  const alreadyReReleased = !!film.directorsCut;
  const reReleaseEligible = !film.isOpen && directedByPlayer && yearsSinceRelease >= 3 && !alreadyReReleased && player?.status === 'active';

  // Compute re-release cost and projected bump
  const reReleaseCost = Math.min(2_000_000, Math.max(100_000, Math.round(film.budget * 0.05)));
  const projectedBump = Math.round((film.result?.boxOffice || 0) * (0.05 + Math.random() * 0.10));

  return (
    <div className="ht-modal-bg" onClick={onClose}>
      <div className="ht-poster" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="ht-poster-tag">{film.isOpen ? '★ Now Playing ★' : alreadyReReleased ? '★ Director\'s Cut ★' : '★ Final Run ★'}</div>
        <div className="ht-poster-title">{film.title}</div>
        <div className="ht-poster-genre">— A {film.genre} Picture —</div>

        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <div className="ht-label">Weekly Box Office</div>
          <BoxOfficeChart
            run={film.isOpen ? film.run.slice(0, film.currentWeekInRun) : film.run}
            projected={false}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: 4, color: 'var(--cream-dim)', fontFamily: "'Special Elite', monospace" }}>
            <span>BARS: weekly gross</span>
            <span>LINE: cumulative</span>
          </div>
        </div>

        <div className="ht-score-row" style={{ marginTop: 12 }}>
          <div className="ht-score-box">
            <div className="ht-score-label">{film.isOpen ? 'Gross So Far' : 'Final Gross'}</div>
            <div className="ht-score-num hi" style={{ fontSize: '1.6rem' }}>{fmtMoney(totalBox)}</div>
          </div>
          <div className="ht-score-box">
            <div className="ht-score-label">Profit</div>
            <div className="ht-score-num" style={{ color: profit > 0 ? '#6fcc4c' : 'var(--red-bright)', fontSize: '1.6rem' }}>
              {fmtMoney(profit)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: '0.88rem', color: 'var(--cream-dim)' }}>
          {film.isOpen ? (
            <p>Week {film.currentWeekInRun} of an estimated {film.runWeeks}-week run.</p>
          ) : (
            <p>Closed after {film.run.length} weeks in theaters.</p>
          )}
          <p>Critics: <strong style={{ color: 'var(--gold-bright)' }}>{film.result.criticScore}</strong> · Audience: <strong style={{ color: 'var(--gold-bright)' }}>{film.result.audienceScore}</strong> · Budget: {fmtMoney(film.budget)} · Marketing: {fmtMoney(film.marketing)}</p>
          {alreadyReReleased && (
            <p style={{ color: 'var(--gold-bright)', marginTop: 6, fontStyle: 'italic' }}>
              ★ Director's Cut re-released in {film.directorsCut.year} — added {fmtMoney(film.directorsCut.bump)} to the gross.
            </p>
          )}
        </div>

        {/* Director's Cut re-release option */}
        {reReleaseEligible && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(212,166,74,0.10)', border: '1px solid var(--gold-dim)' }}>
            <div className="ht-label" style={{ marginBottom: 6, color: 'var(--gold-bright)' }}>
              ✦ Re-Release as Director's Cut
            </div>
            <p style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>
              Recut, remastered, and put back into limited theaters for a few weeks. Costs {fmtMoney(reReleaseCost)} and 4 weeks of your time. Expected box office bump: ~{fmtMoney(projectedBump)}, with a small fame and reputation boost.
            </p>
            <button
              className="ht-btn ht-btn-sm ht-btn-primary"
              disabled={!player || player.cash < reReleaseCost}
              onClick={() => onReRelease(film)}
            >
              Begin Re-Release · {fmtMoney(reReleaseCost)}
            </button>
            {player && player.cash < reReleaseCost && (
              <span className="ht-text-dim" style={{ fontSize: '0.8rem', marginLeft: 10 }}>(insufficient cash)</span>
            )}
          </div>
        )}

        <div className="ht-row" style={{ marginTop: 16, justifyContent: 'center' }}>
          <button className="ht-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- AWARD CEREMONY MODAL ----------

function AwardCeremonyModal({ ceremony, playerName, player, onClose }) {
  // Phase: 'nominations' | 'winners'
  const [phase, setPhase] = useState('nominations');

  if (!ceremony) return null;
  const { body, year, results } = ceremony;

  // Count player's nominations and wins across all categories of this body
  const playerCats = [];
  for (const cat of Object.keys(results)) {
    const catData = results[cat];
    const nominated = catData.nominees.some(n => n.isPlayerCredit);
    const won = catData.nominees.some(n => n.isPlayerCredit && n.isWinner);
    if (nominated) playerCats.push({ cat, won });
  }

  const totalNoms = playerCats.length;
  const totalWins = playerCats.filter(c => c.won).length;

  return (
    <div className="ht-modal-bg" onClick={() => {}}>
      <div className="ht-poster" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="ht-poster-tag">★ {year} Awards Season ★</div>
        <div className="ht-poster-title">{body.name}</div>
        <div className="ht-poster-genre">
          — {phase === 'nominations' ? 'The Nominations' : 'The Winners'} —
        </div>

        {totalNoms === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px 0' }} className="ht-text-dim">
            None of your films were nominated this year by {body.name}. The competition was steep.
          </p>
        ) : phase === 'nominations' ? (
          <>
            <p style={{ textAlign: 'center', color: 'var(--gold-bright)' }}>
              <strong>{totalNoms} nomination{totalNoms === 1 ? '' : 's'}</strong> for {playerName}!
            </p>
            {Object.keys(results).map(cat => {
              const catData = results[cat];
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div className="ht-label" style={{ marginBottom: 4 }}>
                    {AWARD_CATEGORIES[cat].label}
                  </div>
                  {catData.nominees.map((n, i) => {
                    const film = n.film;
                    const credit = renderFilmCredit(film, cat);
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '3px 8px',
                          background: n.isPlayerCredit ? 'rgba(212,166,74,0.15)' : 'transparent',
                          borderLeft: n.isPlayerCredit ? '3px solid var(--gold-bright)' : '3px solid transparent',
                          fontSize: '0.9rem',
                        }}
                      >
                        <span style={{ fontStyle: 'italic', color: n.isPlayerCredit ? 'var(--gold-bright)' : 'var(--cream)' }}>
                          "{film.title}"
                        </span>
                        <span className="ht-text-dim">{credit}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="ht-row" style={{ marginTop: 16, justifyContent: 'center' }}>
              <button className="ht-btn ht-btn-primary" onClick={() => setPhase('winners')}>
                And the Winner Is... →
              </button>
            </div>
          </>
        ) : (
          <>
            {totalWins > 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--gold-bright)' }}>
                <strong>{totalWins} win{totalWins === 1 ? '' : 's'}</strong> for {playerName}!
              </p>
            ) : (
              <p style={{ textAlign: 'center' }} className="ht-text-dim">
                No wins this time — but a nomination is no small thing.
              </p>
            )}
            {Object.keys(results).map(cat => {
              const catData = results[cat];
              const winner = catData.nominees.find(n => n.isWinner);
              if (!winner) return null;
              const isPlayerWin = winner.isPlayerCredit;
              const playerWasNominated = catData.nominees.some(n => n.isPlayerCredit);

              // Rival callout: did a rival NPC just win over the player?
              const catRole = cat.includes('actor') ? 'actor'
                : cat.includes('director') ? 'director'
                : cat.includes('writer') ? 'writer' : 'producer';
              const winnerNpcId = winner.film?.crew?.[catRole]?.npcId;
              const winnerNpc = winnerNpcId ? player?.worldNPCs?.[winnerNpcId] : null;
              const isRivalLoss = playerWasNominated && !isPlayerWin && winnerNpc && (winnerNpc.rivalryScore || 0) >= 1;

              return (
                <div
                  key={cat}
                  style={{
                    margin: '10px 0',
                    padding: '10px 14px',
                    background: isPlayerWin ? 'rgba(212,166,74,0.2)' : isRivalLoss ? 'rgba(170,30,30,0.18)' : 'rgba(0,0,0,0.3)',
                    borderLeft: '3px solid ' + (isPlayerWin ? 'var(--gold-bright)' : isRivalLoss ? 'var(--red-bright)' : 'var(--border)'),
                  }}
                >
                  <div className="ht-label" style={{ marginBottom: 4 }}>
                    {AWARD_CATEGORIES[cat].label}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, color: isPlayerWin ? 'var(--gold-bright)' : 'var(--cream)' }}>
                      "{winner.film.title}"
                    </span>
                    <span className="ht-text-dim" style={{ fontSize: '0.85rem' }}>
                      {renderFilmCredit(winner.film, cat)}
                    </span>
                  </div>
                  {isPlayerWin && (
                    <div style={{ marginTop: 4, color: 'var(--gold-bright)', fontFamily: "'Limelight', serif", fontSize: '0.9rem', letterSpacing: '0.1em' }}>
                      ★ YOU WIN ★
                    </div>
                  )}
                  {isRivalLoss && (
                    <div style={{ marginTop: 6, color: 'var(--red-bright)', fontFamily: "'Special Elite', monospace", fontSize: '0.82rem', fontStyle: 'italic' }}>
                      ⚔ {winnerNpc.name} beats you {(winnerNpc.rivalryScore || 0) >= 3 ? 'again. The crowd notices your face.' : "this time. You'll remember it."}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Below-the-line craft awards — flavored as part of the same evening */}
            {(ceremony.craftWins || []).length > 0 && (() => {
              // Group by film
              const byFilm = {};
              for (const cw of ceremony.craftWins) {
                const t = cw.film.title;
                if (!byFilm[t]) byFilm[t] = { film: cw.film, cats: [], isPlayerFilm: cw.isPlayerFilm };
                byFilm[t].cats.push(cw.categoryLabel);
              }
              const entries = Object.values(byFilm).sort((a, b) => b.cats.length - a.cats.length);
              return (
                <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px dashed var(--gold-dim)' }}>
                  <div className="ht-label" style={{ marginBottom: 8, textAlign: 'center', color: 'var(--gold)' }}>
                    ✦ Earlier That Evening — Below-the-Line ✦
                  </div>
                  {entries.map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '6px 12px',
                        marginBottom: 4,
                        fontSize: '0.85rem',
                        background: entry.isPlayerFilm ? 'rgba(212,166,74,0.12)' : 'rgba(0,0,0,0.2)',
                        borderLeft: '2px solid ' + (entry.isPlayerFilm ? 'var(--gold-bright)' : 'var(--border)'),
                      }}
                    >
                      <strong style={{ color: entry.isPlayerFilm ? 'var(--gold-bright)' : 'var(--cream)', fontStyle: 'italic' }}>
                        "{entry.film.title}"
                      </strong>
                      <span className="ht-text-dim"> — {entry.cats.length} {entry.cats.length === 1 ? 'craft award' : 'craft awards'}</span>
                      <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                        {entry.cats.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="ht-row" style={{ marginTop: 16, justifyContent: 'center' }}>
              <button className="ht-btn ht-btn-primary" onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {totalNoms === 0 && (
          <div className="ht-row" style={{ marginTop: 16, justifyContent: 'center' }}>
            <button className="ht-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

function renderFilmCredit(film, cat) {
  // For player-credit films, the player IS the credit
  if (film.playerRoles && film.playerRoles.length > 0) {
    const roleKey = AWARD_CATEGORIES[cat].roleKey;
    if (roleKey && film.playerRoles.includes(roleKey)) {
      return '— you'; // Will be replaced; this is generic. Below we use crew names.
    }
  }
  // Otherwise pull from crew
  const roleKey = AWARD_CATEGORIES[cat].roleKey;
  if (roleKey && film.crew && film.crew[roleKey]) {
    return film.crew[roleKey].name;
  }
  // Best Picture — show producer or "—"
  if (cat === 'picture') {
    if (film.crew && film.crew.producer) return film.crew.producer.name;
    return '—';
  }
  return '—';
}

// ---------- PRODUCTION PHASES ----------
// A multi-phase movie production:
//   1. preprod   — script polish (writer), casting choices, schedule decisions
//   2. filming   — weekly on-set events; player handles or delegates
//   3. postprod  — editing pass, test screening, optional reshoots
//   4. marketing — set/boost the marketing campaign (producer-only,
//                  with promo events for actor/director to boost reach)
//   5. release   — final box office (existing modal)
//
// Each phase accumulates production.mods: { qualityMod, marketingMod, costOverrun }

function makeFilmingEvents(production) {
  // Generate 3-5 events keyed to the production
  const pool = [
    {
      id: 'overrun', headline: 'Schedule is slipping',
      flavor: 'Shoot days are running long. The producer wants to cut a scene.',
      choices: [
        { label: 'Cut the scene', effect: { quality: -3, cost: 0 }, who: ['director', 'producer'] },
        { label: 'Power through (overtime)', effect: { quality: 2, cost: 0.04, energy: -12 }, who: ['director', 'producer'] },
        { label: 'Negotiate a half-day', effect: { quality: 0, cost: 0.015 }, who: ['producer'] },
      ],
    },
    {
      id: 'star_clash', headline: 'Lead actor clashes with the director',
      flavor: 'A creative disagreement on set is slowing everything down.',
      choices: [
        { label: 'Side with the director', effect: { quality: 4, cost: 0.01 }, who: ['director', 'producer'] },
        { label: 'Side with the actor', effect: { quality: -1, cost: 0 }, who: ['actor', 'producer'] },
        { label: 'Mediate a compromise', effect: { quality: 2, cost: 0.005 }, who: ['producer'] },
      ],
    },
    {
      id: 'weather', headline: 'Storm hits the exterior shoot',
      flavor: 'Three days of rain. The exterior schedule is wrecked.',
      choices: [
        { label: 'Reschedule (eat the cost)', effect: { quality: 0, cost: 0.05 }, who: ['producer', 'director'] },
        { label: 'Rewrite as interior scenes', effect: { quality: -2, cost: 0 }, who: ['writer', 'director'] },
        { label: 'Shoot in the rain — embrace it', effect: { quality: 5, cost: 0.02 }, who: ['director'] },
      ],
    },
    {
      id: 'great_take', headline: 'A magic take on set',
      flavor: 'Something special happened in that last take. Everyone felt it.',
      choices: [
        { label: 'Print it. Move on.', effect: { quality: 6, cost: 0 }, who: ['director', 'actor'] },
        { label: 'Try to top it', effect: { quality: 2, cost: 0.015, energy: -8 }, who: ['director', 'actor'] },
      ],
    },
    {
      id: 'equipment', headline: 'Camera breakdown',
      flavor: 'Primary camera is down. Rental house can ship a replacement tomorrow.',
      choices: [
        { label: 'Wait for the camera', effect: { quality: 0, cost: 0.02 }, who: ['producer'] },
        { label: 'Shoot insert/B-roll today', effect: { quality: 1, cost: 0 }, who: ['director'] },
        { label: 'Rent a backup at premium', effect: { quality: 0, cost: 0.03 }, who: ['producer'] },
      ],
    },
    {
      id: 'rewrite', headline: 'A scene isn\'t working',
      flavor: 'The scene on the page just isn\'t playing on the day.',
      choices: [
        { label: 'Improv on set', effect: { quality: 2, cost: 0 }, who: ['actor', 'director'] },
        { label: 'Page-one rewrite overnight', effect: { quality: 4, cost: 0.01 }, who: ['writer'] },
        { label: 'Shoot it as written', effect: { quality: -3, cost: 0 }, who: ['actor', 'director', 'producer', 'writer'] },
      ],
    },
    {
      id: 'press_visit', headline: 'A reporter wants on-set access',
      flavor: 'A trade reporter is asking for set visit. Good buzz — but distracting.',
      choices: [
        { label: 'Welcome them in', effect: { quality: -1, marketing: 0.1, cost: 0 }, who: ['actor', 'producer'] },
        { label: 'Politely decline', effect: { quality: 1, marketing: -0.02, cost: 0 }, who: ['actor', 'director', 'producer'] },
      ],
    },
    {
      id: 'injury', headline: 'A stunt goes wrong',
      flavor: 'A performer is hurt. Not seriously, but production halts.',
      choices: [
        { label: 'Pause for safety review', effect: { quality: 1, cost: 0.025 }, who: ['producer', 'director'] },
        { label: 'Reshoot with stunt double', effect: { quality: -1, cost: 0.015 }, who: ['producer'] },
        { label: 'Cut the stunt', effect: { quality: -2, cost: 0 }, who: ['director', 'producer'] },
      ],
    },
  ];
  // Shuffle and take 3-4
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, randInt(3, 4));
}

function ProductionHUD({ production }) {
  const { proj, mods, phase } = production;
  const phaseOrder = ['preprod', 'filming', 'postprod', 'marketing', 'release'];
  const phaseLabels = {
    preprod: 'Pre-Production',
    filming: 'Filming',
    postprod: 'Post-Production',
    marketing: 'Marketing',
    release: 'Release',
  };
  const currentIdx = phaseOrder.indexOf(phase);

  return (
    <div className="ht-prod-hud">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'Limelight', serif", fontSize: '1.4rem', color: 'var(--gold-bright)', letterSpacing: '0.04em' }}>
            "{proj.title}"
            {production.productionHell && (
              <span style={{ color: 'var(--red-bright)', fontSize: '0.7rem', marginLeft: 10, letterSpacing: '0.2em' }}>
                ⚠ PRODUCTION HELL
              </span>
            )}
          </div>
          <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>A {proj.genre} picture · Budget {fmtMoney(proj.budget)}</div>
        </div>
        <div style={{ fontFamily: "'Special Elite', monospace", fontSize: '0.75rem', color: 'var(--cream-dim)' }}>
          <Tooltip text="Quality modifier from your production decisions so far. Affects final critic + audience scores. Range typically -15 to +15.">QUAL MOD</Tooltip>: <span style={{ color: mods.qualityMod >= 0 ? '#6fcc4c' : 'var(--red-bright)' }}>{mods.qualityMod >= 0 ? '+' : ''}{mods.qualityMod}</span>
          {' · '}<Tooltip text="Marketing effectiveness multiplier. Press tours, magazine covers, and festivals boost this. Bad PR drops it.">MKT</Tooltip>: <span style={{ color: mods.marketingMod >= 1 ? '#6fcc4c' : mods.marketingMod < 1 ? 'var(--red-bright)' : 'var(--cream)' }}>×{mods.marketingMod.toFixed(2)}</span>
          {' · '}<Tooltip text="Cost overruns from filming events. Comes out of profit at release. Doubled if film is in production hell.">OVER</Tooltip>: <span style={{ color: mods.costOverrun > 0 ? 'var(--red-bright)' : 'var(--cream)' }}>{fmtMoney(mods.costOverrun)}</span>
        </div>
      </div>
      {production.productionHell && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(170, 30, 30, 0.2)', border: '1px solid var(--red-bright)', fontSize: '0.82rem' }}>
          The picture is in crisis. Every overrun doubles. Quality is compromised from the start.
        </div>
      )}
      <div className="ht-phase-track">
        {phaseOrder.map((p, i) => (
          <div key={p} className={`ht-phase-pill ${i < currentIdx ? 'done' : ''} ${i === currentIdx ? 'active' : ''}`}>
            {phaseLabels[p]}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreProductionScreen({ production, player, onAdvance, onChoice }) {
  const { proj } = production;
  const isWriter = proj.playerRoles.includes('writer');
  const isProducer = proj.playerRoles.includes('producer');
  const isDirector = proj.playerRoles.includes('director');
  const isActor = proj.playerRoles.includes('actor');

  const buffs = ownedBuffs(player);

  const [scriptPolished, setScriptPolished] = useState(production.preprod?.scriptPolished || false);
  const [tone, setTone] = useState(production.preprod?.tone || null);
  const [prepLevel, setPrepLevel] = useState(production.preprod?.prepLevel || null);
  const [writersRoomApplied, setWritersRoomApplied] = useState(production.preprod?.writersRoomApplied || false);

  // Auto-apply writers' room polish once (if player has it and hasn't yet)
  useEffect(() => {
    if (buffs.freeScriptPolish && !writersRoomApplied) {
      const bonus = randInt(2, 5);
      onChoice({ quality: bonus });
      setWritersRoomApplied(true);
    }
    // eslint-disable-next-line
  }, []);

  const polishScript = () => {
    if (scriptPolished) return;
    // Writer skill check: +5 to +10 quality if good roll
    const writerSkill = proj.writerSkill || 30;
    const bonus = Math.max(2, Math.round(writerSkill / 12 + randInt(-2, 4)));
    onChoice({ quality: bonus, energy: -8 });
    setScriptPolished(true);
  };

  const chooseTone = (label, effect) => {
    if (tone) return;
    onChoice(effect);
    setTone(label);
  };

  const choosePrep = (label, effect) => {
    if (prepLevel) return;
    onChoice(effect);
    setPrepLevel(label);
  };

  return (
    <div className="ht-fade-in">
      <Panel title="Pre-Production" subtitle="Before a single frame is shot">
        <p className="ht-text-dim" style={{ marginTop: 0 }}>
          Pre-production is where movies are won or lost on paper. Polish what you can. Make your choices.
        </p>

        {/* Writer phase */}
        <div className="ht-phase-block">
          <div className="ht-phase-block-title">✒️ Script</div>
          {buffs.freeScriptPolish && (
            <p style={{ color: 'var(--gold-bright)', fontSize: '0.9rem' }}>
              ✓ Your in-house writers' room gave the script an early pass.
            </p>
          )}
          {isWriter ? (
            <>
              <p>You can take one more pass at the script before cameras roll.</p>
              <button className="ht-btn ht-btn-sm" disabled={scriptPolished} onClick={polishScript}>
                {scriptPolished ? '✓ Script polished' : 'Polish the script (1 week)'}
              </button>
            </>
          ) : (
            <p className="ht-text-dim">
              {proj.crew.writer.name} is doing a final polish on the script. You'll see the pages soon.
            </p>
          )}
        </div>

        {/* Director phase: tone/style choice */}
        <div className="ht-phase-block">
          <div className="ht-phase-block-title">🎬 Visual Tone</div>
          {isDirector ? (
            <>
              <p>Set the look of the picture. The director's choice — though it has trade-offs.</p>
              <div className="ht-row">
                <button
                  className={`ht-btn ht-btn-sm ${tone === 'Stylish' ? 'ht-btn-primary' : ''}`}
                  disabled={!!tone}
                  onClick={() => chooseTone('Stylish', { quality: 4, cost: 0.03 })}
                >
                  Stylish & ambitious (+quality, +cost)
                </button>
                <button
                  className={`ht-btn ht-btn-sm ${tone === 'Conventional' ? 'ht-btn-primary' : ''}`}
                  disabled={!!tone}
                  onClick={() => chooseTone('Conventional', { quality: 1, cost: 0 })}
                >
                  Conventional (safe)
                </button>
                <button
                  className={`ht-btn ht-btn-sm ${tone === 'Lean' ? 'ht-btn-primary' : ''}`}
                  disabled={!!tone}
                  onClick={() => chooseTone('Lean', { quality: -2, cost: -0.04 })}
                >
                  Lean & fast (under budget)
                </button>
              </div>
            </>
          ) : (
            <p className="ht-text-dim">
              Director {proj.crew.director.name} is settling on the visual style. {tone ? `Approach chosen: ${tone}.` : ''}
            </p>
          )}
        </div>

        {/* Actor phase: prep level */}
        <div className="ht-phase-block">
          <div className="ht-phase-block-title">🎭 Performance Prep</div>
          {isActor ? (
            <>
              <p>How much do you prepare for this part?</p>
              <div className="ht-row">
                <button
                  className={`ht-btn ht-btn-sm ${prepLevel === 'Method' ? 'ht-btn-primary' : ''}`}
                  disabled={!!prepLevel}
                  onClick={() => choosePrep('Method', { quality: 5, energy: -25 })}
                >
                  Full method immersion (+quality, drains energy)
                </button>
                <button
                  className={`ht-btn ht-btn-sm ${prepLevel === 'Standard' ? 'ht-btn-primary' : ''}`}
                  disabled={!!prepLevel}
                  onClick={() => choosePrep('Standard', { quality: 2, energy: -10 })}
                >
                  Standard prep
                </button>
                <button
                  className={`ht-btn ht-btn-sm ${prepLevel === 'Wing' ? 'ht-btn-primary' : ''}`}
                  disabled={!!prepLevel}
                  onClick={() => choosePrep('Wing', { quality: -2, energy: 0 })}
                >
                  Wing it
                </button>
              </div>
            </>
          ) : (
            <p className="ht-text-dim">
              {proj.crew.actor.name} is preparing for the lead role. {prepLevel ? `Their approach: ${prepLevel}.` : ''}
            </p>
          )}
        </div>

        {/* Producer phase: scheduling */}
        {isProducer && (
          <div className="ht-phase-block">
            <div className="ht-phase-block-title">💼 Schedule & Budget Locks</div>
            <p>You're the producer. You can build contingency or run tight.</p>
            <div className="ht-row">
              <button
                className="ht-btn ht-btn-sm"
                onClick={() => onChoice({ cost: -0.02, qualityMod: 0 })}
              >
                Build contingency (-2% cost risk)
              </button>
              <button
                className="ht-btn ht-btn-sm"
                onClick={() => onChoice({ cost: 0.03, quality: 2 })}
              >
                Splurge on locations (+quality, +cost)
              </button>
            </div>
          </div>
        )}

        <div className="ht-row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="ht-btn ht-btn-primary" onClick={onAdvance}>
            Begin Principal Photography →
          </button>
        </div>
      </Panel>
    </div>
  );
}

function FilmingScreen({ production, player, onChoice, onAdvance }) {
  const { proj, filming } = production;
  const events = filming.events;
  const currentIdx = filming.currentEventIdx;
  const currentEvent = events[currentIdx];
  const done = currentIdx >= events.length;

  // Decide if player is the one making decisions on this event
  // Players who hold any of the "who" roles can decide
  const playerDeciding = !done && currentEvent.choices.some(c =>
    c.who.some(role => proj.playerRoles.includes(role))
  );

  const handleChoice = (choice) => {
    const effect = {};
    if (choice.effect.quality) effect.quality = choice.effect.quality;
    if (choice.effect.cost) effect.cost = choice.effect.cost; // as fraction of budget
    if (choice.effect.marketing) effect.marketing = choice.effect.marketing;
    onChoice({
      ...effect,
      eventResolution: { idx: currentIdx, choiceLabel: choice.label },
    });
  };

  // Auto-resolve if player isn't involved (NPC decides)
  useEffect(() => {
    if (!done && !playerDeciding && currentEvent) {
      // NPC picks based on which one their role can take
      const npcChoices = currentEvent.choices.filter(c => c.who.length > 0);
      const choice = pick(npcChoices.length ? npcChoices : currentEvent.choices);
      const id = setTimeout(() => handleChoice(choice), 800);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line
  }, [currentIdx, done]);

  return (
    <div className="ht-fade-in">
      <Panel title="Principal Photography" subtitle="The cameras are rolling">
        <div className="ht-filming-day">
          Week {filming.weeksShot + 1} of {events.length} on set
        </div>

        {done ? (
          <>
            <p>Picture's in the can. Time to head to the editing room.</p>
            <div className="ht-row" style={{ justifyContent: 'flex-end' }}>
              <button className="ht-btn ht-btn-primary" onClick={onAdvance}>
                Move to Post-Production →
              </button>
            </div>
          </>
        ) : (
          <div className="ht-event-card">
            <div className="ht-event-headline">{currentEvent.headline}</div>
            <p style={{ fontStyle: 'italic' }}>{currentEvent.flavor}</p>

            {playerDeciding ? (
              <>
                <div className="ht-label" style={{ marginTop: 10 }}>Your call:</div>
                <div className="ht-row">
                  {currentEvent.choices.map((c, i) => {
                    const canChoose = c.who.some(r => proj.playerRoles.includes(r));
                    return (
                      <button
                        key={i}
                        className="ht-btn ht-btn-sm"
                        disabled={!canChoose}
                        onClick={() => handleChoice(c)}
                        title={!canChoose ? `Only ${c.who.map(r => ROLE_LABELS[r]).join('/')} can choose this` : ''}
                      >
                        {c.label}
                        {!canChoose && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>🔒</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="ht-text-dim">
                You're not in the room for this decision. The crew is handling it...
              </p>
            )}

            {/* History of resolved events */}
            {filming.resolutions.length > 0 && (
              <div style={{ marginTop: 16, fontSize: '0.85rem' }}>
                <div className="ht-label">Earlier on set:</div>
                {filming.resolutions.map((r, i) => (
                  <div key={i} style={{ padding: '3px 0', color: 'var(--cream-dim)' }}>
                    • {events[r.idx].headline} → <em>{r.choiceLabel}</em>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function PostProductionScreen({ production, player, onChoice, onAdvance }) {
  const { proj, mods, postprod } = production;
  const isDirector = proj.playerRoles.includes('director');
  const isProducer = proj.playerRoles.includes('producer');

  // Test screening — show a preview of likely audience reception
  // (Doesn't reveal box office, but hints at quality)
  const testScreening = postprod.testScreening;

  const runTestScreening = () => {
    // Compute a noisy preview based on current quality state
    const baseQuality =
      proj.writerSkill * 0.32 +
      proj.directorSkill * 0.30 +
      proj.actorSkill * 0.22 +
      proj.producerSkill * 0.16 +
      mods.qualityMod;
    const noisy = clamp(baseQuality + randInt(-15, 15), 1, 100);
    let verdict;
    if (noisy >= 75) verdict = { txt: 'Audiences loved it', cls: 'hi' };
    else if (noisy >= 55) verdict = { txt: 'Audiences liked it', cls: 'mid' };
    else if (noisy >= 35) verdict = { txt: 'Mixed reception', cls: 'mid' };
    else verdict = { txt: 'Audiences were cold', cls: 'lo' };
    onChoice({ testScreening: { score: Math.round(noisy), verdict } });
  };

  const doReshoots = () => {
    // Costs 5% of budget, but +6 quality
    onChoice({ quality: 6, cost: 0.05, reshootsDone: true });
  };

  const finalEdit = (style) => {
    // Final edit pass — director's call
    const effects = {
      tight: { quality: 3 },
      arty: { quality: 5, marketing: -0.05 }, // hurts mainstream appeal
      crowd: { quality: 1, marketing: 0.05 },
    };
    onChoice({ ...effects[style], finalEdit: style });
  };

  return (
    <div className="ht-fade-in">
      <Panel title="Post-Production" subtitle="Editing, scoring, locking the picture">
        <p className="ht-text-dim" style={{ marginTop: 0 }}>
          Films are made in the edit. This is where decisions cost money or save the picture.
        </p>

        <div className="ht-phase-block">
          <div className="ht-phase-block-title">🎞️ Final Cut</div>
          {isDirector ? (
            <>
              <p>How do you want to lock the picture?</p>
              <div className="ht-row">
                <button className="ht-btn ht-btn-sm" disabled={!!postprod.finalEdit} onClick={() => finalEdit('tight')}>
                  Tight commercial cut
                </button>
                <button className="ht-btn ht-btn-sm" disabled={!!postprod.finalEdit} onClick={() => finalEdit('arty')}>
                  Director's vision (artier)
                </button>
                <button className="ht-btn ht-btn-sm" disabled={!!postprod.finalEdit} onClick={() => finalEdit('crowd')}>
                  Crowd-pleaser cut
                </button>
              </div>
              {postprod.finalEdit && <p className="ht-text-dim" style={{ fontSize: '0.85rem' }}>✓ Locked: {postprod.finalEdit}</p>}
            </>
          ) : (
            <p className="ht-text-dim">
              Director {proj.crew.director.name} is in the editing room.
            </p>
          )}
        </div>

        <div className="ht-phase-block">
          <div className="ht-phase-block-title">👥 Test Screening</div>
          {!testScreening ? (
            <>
              <p>A test screening can give you a read on how it'll play — and time for reshoots if needed.</p>
              <button className="ht-btn ht-btn-sm" onClick={runTestScreening}>
                Hold a test screening
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Test score:</span>
                <span style={{ fontFamily: "'Limelight', serif", fontSize: '2rem' }} className={`ht-score-num ${testScreening.verdict.cls}`}>
                  {testScreening.score}
                </span>
              </div>
              <p className="ht-text-dim" style={{ fontStyle: 'italic' }}>{testScreening.verdict.txt}</p>

              {(isDirector || isProducer) && !postprod.reshootsDone && testScreening.score < 70 && (
                <>
                  <p>You can still do reshoots. Expensive but it could save the picture.</p>
                  <button className="ht-btn ht-btn-sm" onClick={doReshoots}>
                    Order reshoots (5% over budget)
                  </button>
                </>
              )}
              {postprod.reshootsDone && <p style={{ color: 'var(--gold-bright)' }}>✓ Reshoots completed</p>}
            </>
          )}
        </div>

        <div className="ht-row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="ht-btn ht-btn-primary" onClick={onAdvance}>
            Hand Off to Marketing →
          </button>
        </div>
      </Panel>
    </div>
  );
}

function MarketingScreen({ production, player, onChoice, onAdvance }) {
  const { proj, marketing: mkt } = production;
  const isProducer = proj.playerRoles.includes('producer');
  const isActor = proj.playerRoles.includes('actor');
  const isDirector = proj.playerRoles.includes('director');
  const ownStudio = !proj.offer && !!player.studio;

  // The base marketing spend was set at greenlight; producer can still adjust if they control it.
  // Actors and directors do promo activities instead (boost marketingMod, not the dollar amount).
  const controlsMoney = isProducer;
  const cannotControlMoney = !controlsMoney;

  const promoEvents = [
    { id: 'talkshow', label: 'Late-night talk show tour', who: ['actor'], cost: 0, mktBoost: 0.10, fameBoost: 2, done: !!mkt.talkshow },
    { id: 'magazine', label: 'Magazine cover shoot', who: ['actor'], cost: 0, mktBoost: 0.07, fameBoost: 3, done: !!mkt.magazine },
    { id: 'redcarpet', label: 'Red-carpet premiere appearances', who: ['actor', 'director'], cost: 5000, mktBoost: 0.08, fameBoost: 1, done: !!mkt.redcarpet },
    { id: 'interviews', label: 'Press junket interviews', who: ['actor', 'director'], cost: 0, mktBoost: 0.06, fameBoost: 1, done: !!mkt.interviews },
  ];

  const doPromo = (ev) => {
    if (ev.done) return;
    if (player.cash < ev.cost) return;
    onChoice({
      marketing: ev.mktBoost,
      fame: ev.fameBoost || 0,
      quality: ev.qualityHalo || 0,
      cashSpent: ev.cost,
      promo: { [ev.id]: true },
    });
  };

  const boostBudget = (amount) => {
    onChoice({ marketingBudget: amount, cashSpent: amount });
  };

  return (
    <div className="ht-fade-in">
      <Panel title="Marketing & Press" subtitle="Get butts in seats">
        <p className="ht-text-dim" style={{ marginTop: 0 }}>
          The picture is done. Now it has to find an audience.
          {cannotControlMoney && <em> The producer holds the marketing purse — but your face and name carry weight.</em>}
        </p>

        <div className="ht-phase-block">
          <div className="ht-phase-block-title">💰 Marketing Budget</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span>Current spend:</span>
            <strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(proj.marketing + (mkt.budgetBoost || 0))}</strong>
          </div>
          {controlsMoney ? (
            <>
              <p>You can put more money behind the campaign.</p>
              <div className="ht-row">
                {[100_000, 500_000, 1_500_000].map(amt => (
                  <button
                    key={amt}
                    className="ht-btn ht-btn-sm"
                    disabled={player.cash < amt}
                    onClick={() => boostBudget(amt)}
                  >
                    +{fmtMoney(amt)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="ht-text-dim" style={{ fontSize: '0.9rem' }}>
              You're not in charge of the marketing budget on this picture. {proj.crew.producer?.name || 'The producer'} decided
              the spend at greenlight.
            </p>
          )}
        </div>

        <div className="ht-phase-block">
          <div className="ht-phase-block-title">📺 Promo Activities</div>
          <p style={{ fontSize: '0.9rem' }}>Each promo boosts the campaign's reach — and your fame.</p>
          {promoEvents.map(ev => {
            const canDo = ev.who.some(r => proj.playerRoles.includes(r));
            return (
              <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                <div>
                  <div style={{ color: ev.done ? 'var(--cream-dim)' : 'var(--cream)' }}>
                    {ev.done && '✓ '}{ev.label}
                  </div>
                  <div className="ht-text-dim" style={{ fontSize: '0.8rem' }}>
                    For: {ev.who.map(r => ROLE_LABELS[r]).join('/')}
                    {ev.cost > 0 && ` · ${fmtMoney(ev.cost)}`}
                    {' · +'}{Math.round(ev.mktBoost * 100)}% reach
                  </div>
                </div>
                <button
                  className="ht-btn ht-btn-sm"
                  disabled={ev.done || !canDo || player.cash < ev.cost}
                  onClick={() => doPromo(ev)}
                  title={!canDo ? `Only ${ev.who.map(r => ROLE_LABELS[r]).join('/')} can do this` : ''}
                >
                  {ev.done ? 'Done' : canDo ? 'Do It' : '🔒'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Festival Circuit — submit to a prestigious festival before wide release */}
        {(isProducer || isDirector) && !mkt.festivalAccepted && !mkt.festivalRejected && (
          <div className="ht-phase-block">
            <div className="ht-phase-block-title">🎟 Festival Circuit</div>
            <p style={{ fontSize: '0.9rem' }}>
              Submit to a prestigious festival before going wide. Acceptance gives a critic boost and awards momentum.
              Rejection costs the submission fee. Either way, accepted films delay wide release by ~4 weeks.
            </p>
            {mkt.festivalSubmitted && (
              <p className="ht-text-dim" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                Already submitted to {FESTIVALS.find(f => f.id === mkt.festivalSubmitted)?.shortName || 'a festival'}. Waiting on a decision.
              </p>
            )}
            {!mkt.festivalSubmitted && (
              <div style={{ marginTop: 8 }}>
                {FESTIVALS.map(fest => {
                  // Estimate quality projection from current production state
                  const filmPreview = {
                    ...proj,
                    qualityProjection: 50 + (production.qualityMod || 0),
                    budget: proj.budget,
                  };
                  const chance = festivalAcceptanceChance(fest, filmPreview, player);
                  const chancePct = Math.round(chance * 100);
                  const chanceColor = chance >= 0.5 ? '#6fcc4c' : chance >= 0.25 ? 'var(--gold-bright)' : 'var(--red-bright)';
                  return (
                    <div
                      key={fest.id}
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px dashed var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 60%' }}>
                        <strong>{fest.shortName}</strong>
                        <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}> · {fest.location}</span>
                        <div className="ht-text-dim" style={{ fontSize: '0.78rem', fontStyle: 'italic', marginTop: 2 }}>
                          {fest.blurb}
                        </div>
                        <div style={{ fontSize: '0.78rem', marginTop: 3 }}>
                          <span className="ht-text-dim">Entry: </span>
                          <strong>{fmtMoney(fest.entryFee)}</strong>
                          <span className="ht-text-dim"> · Acceptance: </span>
                          <strong style={{ color: chanceColor }}>~{chancePct}%</strong>
                          <span className="ht-text-dim"> · On accept: +{fest.criticBoost} critics, -{fest.audienceCost} audience</span>
                        </div>
                      </div>
                      <button
                        className="ht-btn ht-btn-sm"
                        disabled={player.cash < fest.entryFee}
                        onClick={() => {
                          // Submit: roll immediately for acceptance, store result
                          const accepted = Math.random() < chance;
                          onChoice({
                            cashSpent: fest.entryFee,
                            festivalSubmitted: fest.id,
                            festivalAccepted: accepted ? fest.id : null,
                            festivalRejected: accepted ? null : fest.id,
                          });
                        }}
                      >
                        Submit · {fmtMoney(fest.entryFee)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Show festival result if decided */}
        {mkt.festivalAccepted && (() => {
          const fest = FESTIVALS.find(f => f.id === mkt.festivalAccepted);
          if (!fest) return null;
          return (
            <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)' }}>
              <div className="ht-phase-block-title" style={{ color: 'var(--gold-bright)' }}>
                ✦ Accepted to {fest.name}
              </div>
              <p style={{ fontSize: '0.9rem' }}>
                Your picture screens at {fest.shortName} before wide release. The critics will see it first.
                Expect a <strong style={{ color: 'var(--gold-bright)' }}>+{fest.criticBoost} critic boost</strong> and improved awards positioning.
                A modest <strong style={{ color: 'var(--red-bright)' }}>-{fest.audienceCost} audience hit</strong> for the wait.
              </p>
            </div>
          );
        })()}
        {mkt.festivalRejected && (() => {
          const fest = FESTIVALS.find(f => f.id === mkt.festivalRejected);
          if (!fest) return null;
          return (
            <div className="ht-phase-block" style={{ borderLeftColor: 'var(--red-bright)' }}>
              <div className="ht-phase-block-title" style={{ color: 'var(--red-bright)' }}>
                ✕ Rejected by {fest.name}
              </div>
              <p style={{ fontSize: '0.9rem' }}>
                They passed. The picture goes straight to wide release. The submission fee is gone.
              </p>
            </div>
          );
        })()}

        <div className="ht-phase-block">
          <div className="ht-phase-block-title">🏆 Awards Campaign (For Your Consideration)</div>
          {controlsMoney ? (
            <>
              <p style={{ fontSize: '0.9rem' }}>
                A serious FYC campaign — trade-paper ads, screener mailings, panel events — can put this picture in awards conversation.
                Dramas and prestige genres benefit most. {(mkt.fycSpend || 0) > 0 && (
                  <strong style={{ color: 'var(--gold-bright)' }}> Current: {fmtMoney(mkt.fycSpend || 0)}.</strong>
                )}
              </p>
              <div className="ht-row">
                {[50_000, 200_000, 500_000].map(amt => (
                  <button
                    key={amt}
                    className="ht-btn ht-btn-sm"
                    disabled={player.cash < amt}
                    onClick={() => onChoice({ fycSpend: amt, cashSpent: amt })}
                  >
                    +{fmtMoney(amt)} FYC
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="ht-text-dim" style={{ fontSize: '0.9rem' }}>
              The producer decides whether to mount an awards campaign. {(mkt.fycSpend || 0) > 0 && (
                <em>Word is they're spending {fmtMoney(mkt.fycSpend || 0)} on FYC.</em>
              )}
            </p>
          )}
        </div>

        <div className="ht-row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="ht-btn ht-btn-primary" onClick={onAdvance}>
            Open the Picture →
          </button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- CAREER CHARTS VIEW ----------
//
// Three SVG charts showing the long arc of the career:
//   1. Fame over time (per release)
//   2. Films released per year
//   3. Lifetime earnings curve (cumulative)
//
// All hand-rolled SVG. Era-appropriate art-deco styling with gold strokes.

function CareerCharts({ player, onClose }) {
  // Build datasets from history
  const history = player.history || [];
  const startYear = player.startYear || 1985;
  const endYear = player.year;

  // ----- DATA: Fame trajectory (estimated from film releases + current) -----
  // We don't have a per-week fame log, but we have peakFame. We approximate by
  // building a line from start (fame ~10) to each release (cumulative fame gain
  // from quality scores) to current.
  const fameSeries = [];
  let estFame = 10;
  fameSeries.push({ year: startYear, fame: estFame, label: 'Career begins' });
  const sortedHistory = history.slice().sort((a, b) => (a.releaseYear || a.year || 0) - (b.releaseYear || b.year || 0));
  for (const f of sortedHistory) {
    const yr = f.releaseYear || f.year || startYear;
    // Approximate fame contribution from this film
    const filmFame = f.result?.fameGain ?? Math.round(((f.result?.criticScore || 50) + (f.result?.audienceScore || 50)) / 30);
    estFame = clamp(estFame + filmFame, 0, 100);
    fameSeries.push({ year: yr, fame: estFame, label: f.title });
  }
  // Current fame anchor
  fameSeries.push({ year: endYear, fame: player.fame, label: 'Now' });

  // ----- DATA: Films per year -----
  const filmsPerYear = {};
  for (let y = startYear; y <= endYear; y++) filmsPerYear[y] = 0;
  for (const f of history) {
    const yr = f.releaseYear || f.year || startYear;
    filmsPerYear[yr] = (filmsPerYear[yr] || 0) + 1;
  }
  const filmsSeries = Object.keys(filmsPerYear).sort().map(y => ({ year: +y, count: filmsPerYear[y] }));

  // ----- DATA: Lifetime earnings (cumulative) -----
  const earningsSeries = [];
  let cumulative = 0;
  earningsSeries.push({ year: startYear, total: 0 });
  for (const f of sortedHistory) {
    const yr = f.releaseYear || f.year || startYear;
    // Player's pay from this film. Best estimate: cash + profit share if studio's.
    // We don't track per-film player earnings precisely; approximate via box office / 30.
    const filmEarn = f.result?.boxOffice ? Math.round(f.result.boxOffice / 30) : 0;
    cumulative += filmEarn;
    earningsSeries.push({ year: yr, total: cumulative });
  }
  // Current cash anchor (rough — lifetime earnings if available, else cash)
  const finalTotal = player.lifetimeEarnings || cumulative;
  earningsSeries.push({ year: endYear, total: finalTotal });

  // ----- Chart rendering helpers -----
  const W = 600;
  const H = 200;
  const padL = 50, padR = 20, padT = 20, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Generic line chart
  const renderLineChart = (series, getY, maxY, yLabel, color) => {
    if (series.length === 0) return null;
    const xMin = startYear;
    const xMax = Math.max(endYear, startYear + 1);
    const scaleX = (y) => padL + ((y - xMin) / (xMax - xMin)) * innerW;
    const scaleY = (v) => padT + innerH - (v / maxY) * innerH;

    const points = series.map(p => `${scaleX(p.year)},${scaleY(getY(p))}`).join(' ');
    const area = `M ${scaleX(series[0].year)},${padT + innerH} L ${points.split(' ').join(' L ')} L ${scaleX(series[series.length - 1].year)},${padT + innerH} Z`;

    // Y-axis labels (4 ticks)
    const yTicks = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];
    // X-axis labels (year markers, ~5 ticks)
    const yearSpan = xMax - xMin;
    const tickInterval = yearSpan <= 5 ? 1 : yearSpan <= 15 ? 2 : yearSpan <= 30 ? 5 : 10;
    const xTicks = [];
    for (let y = xMin; y <= xMax; y += tickInterval) xTicks.push(y);
    if (xTicks[xTicks.length - 1] !== xMax) xTicks.push(xMax);

    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i} x1={padL} y1={scaleY(t)} x2={padL + innerW} y2={scaleY(t)} stroke="#3a2a18" strokeWidth="0.5" strokeDasharray="2,3" />
        ))}
        {/* Area under curve */}
        <path d={area} fill={color} fillOpacity="0.15" />
        {/* Line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
        {/* Points */}
        {series.map((p, i) => (
          <circle key={i} cx={scaleX(p.year)} cy={scaleY(getY(p))} r="2.5" fill={color} />
        ))}
        {/* Y labels */}
        {yTicks.map((t, i) => (
          <text key={i} x={padL - 6} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="#a08868" fontFamily="'Special Elite', monospace">
            {yLabel(t)}
          </text>
        ))}
        {/* X labels */}
        {xTicks.map((y, i) => (
          <text key={i} x={scaleX(y)} y={H - 10} textAnchor="middle" fontSize="10" fill="#a08868" fontFamily="'Special Elite', monospace">
            {y}
          </text>
        ))}
        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#6a4d28" strokeWidth="1" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#6a4d28" strokeWidth="1" />
      </svg>
    );
  };

  // Bar chart for films per year
  const renderBarChart = (series, color) => {
    if (series.length === 0) return null;
    const xMin = startYear;
    const xMax = Math.max(endYear, startYear + 1);
    const maxCount = Math.max(1, ...series.map(p => p.count));
    const barW = Math.max(2, (innerW / (xMax - xMin + 1)) * 0.7);
    const scaleX = (y) => padL + ((y - xMin) / (xMax - xMin)) * innerW;
    const scaleY = (v) => padT + innerH - (v / maxCount) * innerH;

    const yTicks = [];
    for (let i = 0; i <= maxCount; i++) yTicks.push(i);
    const yearSpan = xMax - xMin;
    const tickInterval = yearSpan <= 5 ? 1 : yearSpan <= 15 ? 2 : yearSpan <= 30 ? 5 : 10;
    const xTicks = [];
    for (let y = xMin; y <= xMax; y += tickInterval) xTicks.push(y);
    if (xTicks[xTicks.length - 1] !== xMax) xTicks.push(xMax);

    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
        {yTicks.map((t, i) => (
          <line key={i} x1={padL} y1={scaleY(t)} x2={padL + innerW} y2={scaleY(t)} stroke="#3a2a18" strokeWidth="0.5" strokeDasharray="2,3" />
        ))}
        {series.map((p, i) => p.count > 0 && (
          <rect key={i} x={scaleX(p.year) - barW / 2} y={scaleY(p.count)} width={barW} height={innerH - (scaleY(p.count) - padT)} fill={color} fillOpacity="0.7" stroke={color} strokeWidth="0.5" />
        ))}
        {yTicks.map((t, i) => (
          <text key={i} x={padL - 6} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="#a08868" fontFamily="'Special Elite', monospace">
            {t}
          </text>
        ))}
        {xTicks.map((y, i) => (
          <text key={i} x={scaleX(y)} y={H - 10} textAnchor="middle" fontSize="10" fill="#a08868" fontFamily="'Special Elite', monospace">
            {y}
          </text>
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#6a4d28" strokeWidth="1" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#6a4d28" strokeWidth="1" />
      </svg>
    );
  };

  return (
    <div className="ht-fade-in">
      <Panel title="Career in Numbers" subtitle="The long arc of your work">
        <p className="ht-text-dim" style={{ marginTop: 0 }}>
          {history.length} {history.length === 1 ? 'film' : 'films'} across {endYear - startYear + 1} year{endYear - startYear === 0 ? '' : 's'}.
          {history.length === 0 && ' Make some films and check back — the charts will draw themselves.'}
        </p>

        {history.length > 0 && (
          <>
            {/* Fame trajectory */}
            <div style={{ marginTop: 18 }}>
              <div className="ht-label" style={{ marginBottom: 6 }}>★ Fame Trajectory</div>
              <p className="ht-text-dim" style={{ fontSize: '0.82rem', margin: '0 0 8px' }}>
                Public visibility, estimated from each release. Peak fame: <strong style={{ color: 'var(--gold-bright)' }}>{Math.round(player.peakFame || 0)}</strong>.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', border: '1px solid var(--border)' }}>
                {renderLineChart(fameSeries, p => p.fame, 100, (t) => Math.round(t), '#d4a64a')}
              </div>
            </div>

            {/* Films per year */}
            <div style={{ marginTop: 18 }}>
              <div className="ht-label" style={{ marginBottom: 6 }}>★ Productivity</div>
              <p className="ht-text-dim" style={{ fontSize: '0.82rem', margin: '0 0 8px' }}>
                Films released per year. {(() => {
                  const max = Math.max(0, ...filmsSeries.map(p => p.count));
                  const maxYear = filmsSeries.find(p => p.count === max)?.year;
                  return max > 0 ? `Busiest year: ${maxYear} (${max} ${max === 1 ? 'film' : 'films'}).` : '';
                })()}
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', border: '1px solid var(--border)' }}>
                {renderBarChart(filmsSeries, '#d4a64a')}
              </div>
            </div>

            {/* Earnings curve */}
            <div style={{ marginTop: 18 }}>
              <div className="ht-label" style={{ marginBottom: 6 }}>★ Lifetime Earnings (cumulative)</div>
              <p className="ht-text-dim" style={{ fontSize: '0.82rem', margin: '0 0 8px' }}>
                Total earned across the career: <strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(finalTotal)}</strong>.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', border: '1px solid var(--border)' }}>
                {renderLineChart(earningsSeries, p => p.total, Math.max(1_000_000, finalTotal), (t) => fmtMoney(t).replace(/\.0$/, ''), '#d4a64a')}
              </div>
            </div>

            {/* Per-genre breakdown */}
            {Object.keys(player.genreCredits || {}).length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div className="ht-label" style={{ marginBottom: 6 }}>★ Genre Breakdown</div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', border: '1px solid var(--border)' }}>
                  {Object.entries(player.genreCredits || {}).sort((a, b) => b[1] - a[1]).map(([genre, count]) => {
                    const maxCount = Math.max(...Object.values(player.genreCredits));
                    const pct = (count / maxCount) * 100;
                    const spec = getGenreSpecialty(player, genre);
                    return (
                      <div key={genre} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 2 }}>
                          <span>
                            <strong style={{ color: 'var(--cream)' }}>{genre}</strong>
                            {spec && (
                              <span className="ht-text-dim" style={{ marginLeft: 8, fontStyle: 'italic', fontSize: '0.78rem' }}>
                                — {spec.tier.label === 'Working In' ? 'Working in' : spec.tier.label}
                              </span>
                            )}
                          </span>
                          <span style={{ color: 'var(--gold-bright)', fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{count}</span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.4)', height: 6, position: 'relative' }}>
                          <div style={{ background: spec?.tier?.label === 'Icon' ? 'var(--gold-bright)' : spec?.tier?.label === 'Specialist' ? 'var(--gold)' : 'var(--gold-dim)', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-role breakdown — how many films in each capacity */}
            {(() => {
              const roleCounts = { actor: 0, director: 0, producer: 0, writer: 0 };
              for (const f of (player.history || [])) {
                for (const r of (f.playerRoles || [])) {
                  roleCounts[r] = (roleCounts[r] || 0) + 1;
                }
              }
              const total = Object.values(roleCounts).reduce((s, n) => s + n, 0);
              if (total === 0) return null;
              const maxRoleCount = Math.max(...Object.values(roleCounts));
              return (
                <div style={{ marginTop: 18 }}>
                  <div className="ht-label" style={{ marginBottom: 6 }}>★ Role Breakdown</div>
                  <p className="ht-text-dim" style={{ fontSize: '0.82rem', margin: '0 0 8px' }}>
                    {(() => {
                      const distinct = Object.values(roleCounts).filter(n => n > 0).length;
                      if (distinct === 1) return 'Sticking to one craft.';
                      if (distinct === 2) return 'A hyphenate career.';
                      if (distinct === 3) return 'Triple-threat territory.';
                      return 'Quadruple-threat: you do it all.';
                    })()}
                  </p>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', border: '1px solid var(--border)' }}>
                    {Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => {
                      if (count === 0) return null;
                      const pct = (count / maxRoleCount) * 100;
                      const isStarter = role === player.startingRole;
                      return (
                        <div key={role} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 2 }}>
                            <span>
                              <strong style={{ color: 'var(--cream)' }}>{ROLE_LABELS[role]}</strong>
                              {isStarter && (
                                <span className="ht-text-dim" style={{ marginLeft: 8, fontStyle: 'italic', fontSize: '0.78rem' }}>
                                  — where you started
                                </span>
                              )}
                            </span>
                            <span style={{ color: 'var(--gold-bright)', fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{count}</span>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.4)', height: 6, position: 'relative' }}>
                            <div style={{ background: isStarter ? 'var(--gold-bright)' : 'var(--gold-dim)', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        <div className="ht-row" style={{ marginTop: 18 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- CAREER HISTORY VIEW ----------

function CareerHistory({ player, onClose }) {
  const [tab, setTab] = useState('overview');
  const career = useMemo(() => deriveCareerHistory(player), [player]);
  const { milestones, records, roleStats, timeline, summary } = career;

  // Most-used role
  const primaryRole = ROLES
    .map(r => ({ r, count: roleStats[r]?.count || 0 }))
    .sort((a, b) => b.count - a.count)[0];
  const primaryRoleLabel = primaryRole.count > 0
    ? ROLE_LABELS[primaryRole.r]
    : ROLE_LABELS[player.startingRole || 'actor'];

  return (
    <div className="ht-fade-in">
      <Panel
        title={`${player.name} — A Hollywood Life`}
        subtitle={`Started ${player.startYear || 1985} as ${ROLE_LABELS[player.startingRole || 'actor']} · Best known as a ${primaryRoleLabel}`}
      >
        {/* Headline numbers */}
        <div className="ht-summary-grid">
          <div className="ht-summary-stat">
            <div className="ht-summary-num">{summary.yearsActive}</div>
            <div className="ht-summary-label">Years Active</div>
          </div>
          <div className="ht-summary-stat">
            <div className="ht-summary-num">{summary.totalFilms}</div>
            <div className="ht-summary-label">Films</div>
          </div>
          <div className="ht-summary-stat">
            <div className="ht-summary-num">{fmtMoney(summary.totalBoxOffice)}</div>
            <div className="ht-summary-label">Total Box Office</div>
          </div>
          <div className="ht-summary-stat">
            <div className="ht-summary-num">{fmtMoney(summary.lifetimeEarnings)}</div>
            <div className="ht-summary-label">Lifetime Earnings</div>
          </div>
          <div className="ht-summary-stat">
            <div className="ht-summary-num">{summary.peakFame}</div>
            <div className="ht-summary-label">Peak Fame</div>
          </div>
          <div className="ht-summary-stat">
            <div className="ht-summary-num">{summary.totalWins}<span style={{ fontSize: '0.9rem', color: 'var(--cream-dim)' }}>/{summary.totalNoms}</span></div>
            <div className="ht-summary-label">Awards (W/N)</div>
          </div>
        </div>

        <div className="ht-tabs">
          <button className={`ht-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>★ Milestones</button>
          <button className={`ht-tab ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>The Records</button>
          <button className={`ht-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>By Role</button>
          <button className={`ht-tab ${tab === 'timeline' ? 'active' : ''}`} onClick={() => setTab('timeline')}>Timeline</button>
        </div>

        {/* MILESTONES TAB */}
        {tab === 'overview' && (
          <div>
            {milestones.length === 0 ? (
              <p className="ht-text-dim">Your story is just getting started.</p>
            ) : (
              milestones.map((m, i) => (
                <div key={i} className="ht-milestone">
                  <div className="ht-milestone-icon">{m.icon}</div>
                  <div className="ht-milestone-body">
                    <div>
                      <span className="ht-milestone-title">{m.title}</span>
                      <span className="ht-milestone-year">{m.year}</span>
                    </div>
                    <div className="ht-milestone-detail">{m.detail}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* RECORDS TAB */}
        {tab === 'records' && (
          <div>
            {summary.totalFilms === 0 ? (
              <p className="ht-text-dim">Make some films and the records will write themselves.</p>
            ) : (
              <>
                {records.highestGrossing && (
                  <div className="ht-record">
                    <span className="ht-record-label">💰 Highest Grossing</span>
                    <span className="ht-record-value">
                      "{records.highestGrossing.title}" — {fmtMoney(records.highestGrossing.result.boxOffice)}
                    </span>
                  </div>
                )}
                {records.biggestProfit && (
                  <div className="ht-record">
                    <span className="ht-record-label">📈 Biggest Profit</span>
                    <span className="ht-record-value">
                      "{records.biggestProfit.title}" — {fmtMoney(records.biggestProfit.result.profit)}
                    </span>
                  </div>
                )}
                {records.mostAcclaimed && (
                  <div className="ht-record">
                    <span className="ht-record-label">🎖 Most Acclaimed</span>
                    <span className="ht-record-value">
                      "{records.mostAcclaimed.title}" — {records.mostAcclaimed.result.criticScore} critics
                    </span>
                  </div>
                )}
                {records.mostPopular && (
                  <div className="ht-record">
                    <span className="ht-record-label">🎟 Audience Favorite</span>
                    <span className="ht-record-value">
                      "{records.mostPopular.title}" — {records.mostPopular.result.audienceScore} audience
                    </span>
                  </div>
                )}
                {records.biggestFlop && (
                  <div className="ht-record">
                    <span className="ht-record-label">💀 Biggest Bomb</span>
                    <span className="ht-record-value" style={{ color: 'var(--red-bright)' }}>
                      "{records.biggestFlop.title}" — {fmtMoney(records.biggestFlop.result.profit)}
                    </span>
                  </div>
                )}
                <div className="ht-record">
                  <span className="ht-record-label">🎬 Hits / Flops</span>
                  <span className="ht-record-value">{summary.hits} hits · {summary.flops} flops</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* BY ROLE TAB */}
        {tab === 'roles' && (
          <div>
            {ROLES.every(r => !roleStats[r]) ? (
              <p className="ht-text-dim">No films released yet.</p>
            ) : (
              ROLES.map(r => {
                const stats = roleStats[r];
                if (!stats) return null;
                return (
                  <div key={r} style={{ marginBottom: 18, padding: 14, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderLeft: '3px solid var(--gold)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontStyle: 'italic', fontSize: '1.2rem', color: 'var(--gold-bright)' }}>
                        As {ROLE_LABELS[r]}
                      </span>
                      <span className="ht-text-dim" style={{ fontSize: '0.85rem' }}>
                        {stats.count} film{stats.count === 1 ? '' : 's'} · {fmtMoney(stats.totalBox)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginTop: 10, fontSize: '0.88rem' }}>
                      <div><span className="ht-text-dim">Avg critic:</span> <strong style={{ color: 'var(--gold-bright)' }}>{stats.avgCritic}</strong></div>
                      <div><span className="ht-text-dim">Avg audience:</span> <strong style={{ color: 'var(--gold-bright)' }}>{stats.avgAudience}</strong></div>
                      <div><span className="ht-text-dim">Hits/Flops:</span> <strong>{stats.hits} · {stats.flops}</strong></div>
                      <div><span className="ht-text-dim">Awards:</span> <strong style={{ color: 'var(--gold-bright)' }}>{stats.wins}W / {stats.noms}N</strong></div>
                    </div>
                    {stats.best && (
                      <div style={{ marginTop: 10, fontSize: '0.9rem' }}>
                        <span className="ht-text-dim">Best work: </span>
                        <em style={{ color: 'var(--gold-bright)' }}>"{stats.best.title}"</em>
                        <span className="ht-text-dim"> ({stats.best.result.criticScore} critics)</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {tab === 'timeline' && (
          <div>
            {timeline.length === 0 ? (
              <p className="ht-text-dim">No history yet.</p>
            ) : (
              timeline.map(({ year, events }) => (
                <div key={year} className="ht-timeline-year">
                  <div className="ht-timeline-year-label">{year}</div>
                  {events.map((ev, i) => (
                    <div key={i} className="ht-timeline-event">{ev.label}</div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        <div className="ht-row" style={{ marginTop: 16 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- PRESS CLIPPINGS VIEW ----------
//
// Archive of every tabloid event the player has resolved, in reverse chronological
// order. Each clipping shows the headline, the lede, your response, and the fallout.
// Optional filter by tag (scandal, romance, family, etc.).

function PressClippings({ player, onClose }) {
  const history = (player.tabloidHistory || []).slice().reverse();
  const [filter, setFilter] = useState('all');

  const allTags = Array.from(new Set(history.flatMap(h => h.tags || [])));
  const filtered = filter === 'all' ? history : history.filter(h => (h.tags || []).includes(filter));

  return (
    <div className="ht-fade-in">
      <Panel title="Press Clippings" subtitle={`${history.length} ${history.length === 1 ? 'story' : 'stories'} on the record`}>
        {history.length === 0 ? (
          <p className="ht-text-dim">No press coverage yet. Get famous enough and the tabloids will find you.</p>
        ) : (
          <>
            <div className="ht-tabs">
              <button className={`ht-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`ht-tab ${filter === tag ? 'active' : ''}`}
                  onClick={() => setFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            {filtered.map((clip, i) => (
              <div key={i} className="ht-clipping">
                <div className="ht-clipping-date">{clip.year} · W{clip.week}</div>
                <div className="ht-clipping-headline">{clip.headline}</div>
                <p className="ht-clipping-lede">{clip.flavor}</p>
                <div className="ht-clipping-resolution">
                  <strong>Response:</strong> <em>{clip.choice}</em>
                  {clip.outcome && (
                    <div className="ht-clipping-outcome">{clip.outcome}</div>
                  )}
                </div>
                {clip.tags && clip.tags.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {clip.tags.map(t => <span key={t} className="ht-tag">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        <div className="ht-row" style={{ marginTop: 16 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- THE BOULEVARD (SHOP) ----------

function Boulevard({ player, onBuy, onSell, onIndulgence, onClose }) {
  const [tab, setTab] = useState('lifestyle');

  const owned = player.possessions || [];
  const cash = player.cash;
  const fame = player.fame;
  const hasStudio = !!player.studio;
  const upkeep = totalWeeklyUpkeep(player);

  // Group catalog by category
  const byCategory = {
    lifestyle: PURCHASES.filter(p => p.category === 'lifestyle'),
    team: PURCHASES.filter(p => p.category === 'team'),
    studio: PURCHASES.filter(p => p.category === 'studio'),
  };

  const canAfford = (item) => cash >= item.price;
  const meetsFame = (item) => fame >= (item.fameRequired || 0);
  const meetsStudio = (item) => !item.studioRequired || hasStudio;
  const isOwned = (item) => owned.includes(item.id);
  const isReplaced = (item) => {
    // If a strictly-better version is owned, treat this one as "outgrown"
    return PURCHASES.some(other => owned.includes(other.id) && other.replaces === item.id);
  };
  const hasBetter = (item) => {
    // Is this item replaced by something the player owns?
    if (!item.replaces) return false;
    return owned.includes(item.replaces);
  };

  const renderItem = (item) => {
    const own = isOwned(item);
    const afford = canAfford(item);
    const fameOk = meetsFame(item);
    const studioOk = meetsStudio(item);
    const outgrown = isReplaced(item);
    const buyable = !own && afford && fameOk && studioOk && !outgrown;

    let lockReason = '';
    if (own) lockReason = 'Owned';
    else if (outgrown) lockReason = 'You\'ve outgrown this';
    else if (!studioOk) lockReason = 'Studio required';
    else if (!fameOk) lockReason = `Need fame ${item.fameRequired}`;
    else if (!afford) lockReason = `Costs ${fmtMoney(item.price)}`;

    return (
      <div key={item.id} className="ht-shop-item" style={own ? { borderColor: 'var(--gold-bright)' } : {}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.1rem', color: own ? 'var(--gold-bright)' : 'var(--cream)' }}>
              {own && '✓ '}{item.name}
            </div>
            <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>{item.flavor}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>{fmtMoney(item.price)}</div>
            {item.weeklyUpkeep > 0 && (
              <div className="ht-text-dim" style={{ fontSize: '0.75rem' }}>+{fmtMoney(item.weeklyUpkeep)}/wk upkeep</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 6, fontSize: '0.82rem' }}>
          {renderEffects(item.effects)}
        </div>

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {own ? (
            <button className="ht-btn ht-btn-sm ht-btn-danger" onClick={() => onSell(item)}>Sell</button>
          ) : (
            <button className="ht-btn ht-btn-sm ht-btn-primary" disabled={!buyable} onClick={() => onBuy(item)}>
              {buyable ? `Buy · ${fmtMoney(item.price)}` : lockReason}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ht-fade-in">
      <Panel
        title="The Boulevard"
        subtitle={`Cash: ${fmtMoney(cash)} · Weekly upkeep: ${fmtMoney(upkeep)}`}
      >
        <div className="ht-tabs">
          <button className={`ht-tab ${tab === 'lifestyle' ? 'active' : ''}`} onClick={() => setTab('lifestyle')}>🏛 Lifestyle</button>
          <button className={`ht-tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>👥 Your Team</button>
          {hasStudio && (
            <button className={`ht-tab ${tab === 'studio' ? 'active' : ''}`} onClick={() => setTab('studio')}>🎬 Studio</button>
          )}
          <button className={`ht-tab ${tab === 'indulgence' ? 'active' : ''}`} onClick={() => setTab('indulgence')}>🥂 Indulgences</button>
        </div>

        {tab === 'lifestyle' && (
          <>
            <p className="ht-text-dim" style={{ marginTop: 0 }}>
              The bigger your name, the bigger the address. Lifestyle items give passive fame and faster energy regen — but they're not cheap to maintain.
            </p>
            <div className="ht-label" style={{ marginTop: 14 }}>🏠 Homes</div>
            {byCategory.lifestyle.filter(i => i.kind === 'home').map(renderItem)}
            <div className="ht-label" style={{ marginTop: 14 }}>🚗 Vehicles</div>
            {byCategory.lifestyle.filter(i => i.kind === 'car').map(renderItem)}
          </>
        )}

        {tab === 'team' && (
          <>
            <p className="ht-text-dim" style={{ marginTop: 0 }}>
              The people you pay to make your career easier. Coaches grow your skills passively; agents bring better offers; publicists amplify your fame.
            </p>
            {byCategory.team.map(renderItem)}
          </>
        )}

        {tab === 'studio' && (
          <>
            <p className="ht-text-dim" style={{ marginTop: 0 }}>
              Vertical integration. Bigger budget caps, better crews, more of the gross reaches you.
            </p>
            {byCategory.studio.map(renderItem)}
          </>
        )}

        {tab === 'indulgence' && (
          <Indulgences player={player} onIndulgence={onIndulgence} />
        )}

        <div className="ht-row" style={{ marginTop: 18 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>
    </div>
  );
}

function renderEffects(effects) {
  if (!effects) return null;
  const parts = [];
  if (effects.fameWeekly) parts.push(`+${effects.fameWeekly.toFixed(2)} fame/week`);
  if (effects.energyRegenBonus) parts.push(`+${effects.energyRegenBonus} energy regen/week`);
  if (effects.offerCountBonus) parts.push(`+${effects.offerCountBonus} listings`);
  if (effects.offerBudgetBonus) parts.push(`+${Math.round(effects.offerBudgetBonus * 100)}% project budgets`);
  if (effects.offerProbabilityBonus) parts.push(`+${Math.round(effects.offerProbabilityBonus * 100)}% offer chance`);
  if (effects.promoFameMultiplier) parts.push(`${effects.promoFameMultiplier}× promo fame`);
  if (effects.passiveSkill) parts.push(`Passive ${ROLE_LABELS[effects.passiveSkill]} skill growth`);
  if (effects.fycMultiplier) parts.push(`${effects.fycMultiplier}× FYC effectiveness`);
  if (effects.studioBudgetCap) parts.push(`Studio budget cap: ${fmtMoney(effects.studioBudgetCap)}`);
  if (effects.costOverrunReduction) parts.push(`${Math.round(effects.costOverrunReduction * 100)}% less cost overruns`);
  if (effects.freeScriptPolish) parts.push(`Automatic script polish on your pictures`);
  if (effects.npcSkillBonus) parts.push(`+${effects.npcSkillBonus} skill to NPC crew on your pictures`);
  if (effects.boxOfficeShareBonus) parts.push(`+${Math.round(effects.boxOfficeShareBonus * 100)}% box office share`);
  return parts.length ? (
    <span style={{ color: 'var(--gold)' }}>{parts.join(' · ')}</span>
  ) : null;
}

// ---------- INDULGENCES (one-shot purchases) ----------

const INDULGENCES = [
  {
    id: 'house_party', name: 'Throw a Hollywood Party', price: 25_000, fameRequired: 5,
    flavor: 'Industry types, champagne, and gossip columns by morning.',
    effects: { fame: 3, energy: -10 },
  },
  {
    id: 'gala', name: 'Charity Gala (host a table)', price: 75_000, fameRequired: 20,
    flavor: 'You\'re photographed in a tux next to senators and studio heads.',
    effects: { fame: 5, energy: -5 },
  },
  {
    id: 'vegas', name: 'Vegas Weekend', price: 30_000, fameRequired: 0,
    flavor: 'High rollers, late nights, and a chance to come back richer — or broker.',
    effects: { gamble: true, energy: -20 },
  },
  {
    id: 'paris', name: 'Two Weeks in Paris', price: 60_000, fameRequired: 0,
    flavor: 'No phones. No scripts. Just bread and wine.',
    effects: { energy: 80, weeksAdvance: 2 },
  },
  {
    id: 'tabloid', name: 'Plant a Tabloid Story', price: 5_000, fameRequired: 0,
    flavor: 'Cheap fame. Risk of looking desperate.',
    effects: { fame: 4, repRisk: true },
  },
];

function Indulgences({ player, onIndulgence }) {
  return (
    <>
      <p className="ht-text-dim" style={{ marginTop: 0 }}>
        One-shot splurges. Some help; some hurt. All of them tell the press something about you.
      </p>
      {INDULGENCES.map(item => {
        const can = player.cash >= item.price && player.fame >= (item.fameRequired || 0);
        const lockReason = player.cash < item.price
          ? `Need ${fmtMoney(item.price)}`
          : player.fame < (item.fameRequired || 0)
            ? `Need fame ${item.fameRequired}`
            : '';
        return (
          <div key={item.id} className="ht-shop-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.05rem', color: 'var(--cream)' }}>
                  {item.name}
                </div>
                <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>{item.flavor}</div>
              </div>
              <div style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>{fmtMoney(item.price)}</div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="ht-btn ht-btn-sm" disabled={!can} onClick={() => onIndulgence(item)}>
                {can ? 'Do It' : lockReason}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------- FRANCHISES VIEW ----------
//
// Browse the player's franchises (registered when films are released as
// original IPs by the player's studio or producer credit). Pick one to
// "Make a Sequel" — routes back through the production builder with
// sequel context attached.

function FranchisesView({ player, onMakeSequel, onAcceptSale, onDeclineSale, onClose }) {
  const franchises = Object.values(player.franchises || {});
  const acquisitionOffers = player.franchiseAcquisitionOffers || [];
  const soldFranchises = player.soldFranchises || [];

  // For each franchise, determine if the player can make a sequel right now.
  // Conditions:
  // - Player must own the rights (ownerIsPlayer = true) OR be a producer in original
  //   For now we keep it simple: only ownerIsPlayer franchises are sequelable by the player
  // - The latest entry must be CLOSED (i.e. in player.history), not still in theaters
  // - The latest entry must not have been a critical/commercial disaster (allow but warn)

  const closedTitles = new Set(player.history.map(f => f.title));
  const inTheaterTitles = new Set((player.inTheaters || []).map(f => f.title));

  return (
    <div className="ht-fade-in">
      <Panel title="Franchises" subtitle="Your owned IP">

        {/* Acquisition offers — appears when major studios are bidding for dormant franchises */}
        {acquisitionOffers.length > 0 && (
          <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(212,166,74,0.12)', border: '2px solid var(--gold-bright)' }}>
            <div className="ht-label" style={{ marginBottom: 8, color: 'var(--gold-bright)' }}>
              ✉ ACQUISITION OFFERS
            </div>
            <p className="ht-text-dim" style={{ fontSize: '0.85rem', marginTop: 0 }}>
              Major studios are interested in dormant franchises. Sell and take the lump sum — or hold the rights and hope to revive it.
            </p>
            {acquisitionOffers.map(offer => {
              const ageWeeks = (player.year - offer.year) * 52 + (player.week - offer.week);
              const weeksLeft = 8 - ageWeeks;
              return (
                <div
                  key={offer.id}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--gold-dim)',
                    marginTop: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                    <div>
                      <strong style={{ color: 'var(--gold-bright)' }}>{offer.studio}</strong>
                      <span className="ht-text-dim" style={{ fontSize: '0.82rem' }}> offers for </span>
                      <strong style={{ fontStyle: 'italic' }}>"{offer.franchiseTitle}"</strong>
                    </div>
                    <span className="ht-text-dim" style={{ fontSize: '0.78rem' }}>{weeksLeft}w left</span>
                  </div>
                  <div style={{ marginTop: 6, fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.4rem', color: 'var(--gold-bright)' }}>
                    {fmtMoney(offer.amount)}
                  </div>
                  <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                    {offer.entries} {offer.entries === 1 ? 'entry' : 'entries'} · {offer.hits} hit{offer.hits === 1 ? '' : 's'} · dormant {offer.yearsDormant} years
                  </div>
                  <div className="ht-row" style={{ marginTop: 10, gap: 6 }}>
                    <button
                      className="ht-btn ht-btn-sm ht-btn-primary"
                      onClick={() => onAcceptSale(offer)}
                    >
                      Sell ({fmtMoney(offer.amount)})
                    </button>
                    <button
                      className="ht-btn ht-btn-sm"
                      onClick={() => onDeclineSale(offer)}
                    >
                      Keep the rights
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {franchises.length === 0 ? (
          <p className="ht-text-dim">No franchises yet. When you produce or studio-own a film, it becomes a franchise you can build sequels for.</p>
        ) : (
          franchises.map((f, idx) => {
            const sortedEntries = f.entries.slice().sort((a, b) => a.entry - b.entry);
            const lastEntry = sortedEntries[sortedEntries.length - 1];
            // Look up the last entry's film record for quality/hit info
            const lastFilm = [...player.history, ...(player.inTheaters || [])]
              .find(film => film.title === lastEntry.title);
            const lastIsClosed = closedTitles.has(lastEntry.title);
            const lastIsInTheaters = inTheaterTitles.has(lastEntry.title);
            const sequelable = f.ownerIsPlayer && lastIsClosed && lastFilm;
            // Years since last entry — for "sequel fatigue" hint
            const yearsSince = player.year - (f.lastEntryYear || lastEntry.year);

            return (
              <div key={f.id} className="ht-offer-card" style={{ borderLeft: '3px solid var(--gold-bright)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="ht-offer-title">{f.title}</div>
                    <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>
                      A {f.originalGenre} franchise · {f.entries.length} entr{f.entries.length === 1 ? 'y' : 'ies'}
                      {!f.ownerIsPlayer && ' · (Rights held by outside studio)'}
                    </div>
                  </div>
                </div>

                {/* Entries list */}
                <div style={{ marginTop: 10, fontSize: '0.9rem' }}>
                  {sortedEntries.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span>
                        <strong>{toRoman(e.entry)}.</strong> "{e.title}"
                        {inTheaterTitles.has(e.title) && <span style={{ color: 'var(--gold-bright)', marginLeft: 8, fontSize: '0.8rem' }}>(in theaters)</span>}
                      </span>
                      <span className="ht-text-dim">{e.year}</span>
                    </div>
                  ))}
                </div>

                {/* Sequel button */}
                <div className="ht-row" style={{ marginTop: 10 }}>
                  {sequelable ? (
                    <button
                      className="ht-btn ht-btn-sm ht-btn-primary"
                      onClick={() => onMakeSequel(f, lastFilm)}
                    >
                      🎬 Make a Sequel
                    </button>
                  ) : (
                    <span className="ht-text-dim" style={{ fontSize: '0.85rem' }}>
                      {!f.ownerIsPlayer
                        ? '— You don\'t own these rights'
                        : lastIsInTheaters
                          ? '— Wait for the current entry to finish its run'
                          : '— Unable to make sequel right now'}
                    </span>
                  )}
                  {yearsSince > 5 && f.ownerIsPlayer && lastIsClosed && (
                    <span className="ht-text-dim" style={{ fontSize: '0.8rem', marginLeft: 12 }}>
                      ⓘ Long gap ({yearsSince} years) — audience may have moved on
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Sold Franchises — historical record of franchises sold to other studios */}
        {soldFranchises.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--gold-dim)' }}>
            <div className="ht-label" style={{ marginBottom: 8 }}>★ Sold to Other Studios</div>
            <p className="ht-text-dim" style={{ fontSize: '0.82rem', marginTop: 0 }}>
              Franchises you've sold off. The rights are no longer yours, but the cash was nice.
            </p>
            {soldFranchises.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  marginBottom: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <span>
                  <strong style={{ fontStyle: 'italic', color: 'var(--cream)' }}>"{f.title}"</strong>
                  <span className="ht-text-dim"> — to {f.soldTo} in {f.soldYear}</span>
                </span>
                <span style={{ color: 'var(--gold-bright)', fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                  {fmtMoney(f.soldAmount)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="ht-row" style={{ marginTop: 16 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- LEGACY / RETIREMENT ----------
//
// Compute a career retrospective. Called at retirement time.
// Returns a structured legacy object with score, tier, and defining moments.

const LEGACY_TIERS = [
  { min: 0,   label: 'Forgotten',   blurb: 'The industry rolled on without you.' },
  { min: 30,  label: 'Working Pro', blurb: 'A solid career. The work was the work.' },
  { min: 60,  label: 'Respected',   blurb: 'When your name comes up, people nod.' },
  { min: 100, label: 'Acclaimed',   blurb: 'The serious people took you seriously.' },
  { min: 140, label: 'Iconic',      blurb: 'A name that means something.' },
  { min: 180, label: 'Legend',      blurb: 'One of the names that defined the era.' },
];

function calcLegacy(player) {
  // Raw scores
  const lifetimeBoxOffice = player.history.reduce((s, f) => s + (f.result?.boxOffice || 0), 0);
  const boxOfficeScore = clamp(lifetimeBoxOffice / 10_000_000, 0, 50);

  const wins = player.awards?.wins || 0;
  const noms = player.awards?.nominations || 0;
  const awardScore = clamp(wins * 8 + (noms - wins) * 2, 0, 60);

  const peakFameScore = clamp((player.peakFame || 0) * 0.4, 0, 40);

  let empireScore = 0;
  if (player.studio) empireScore += 20;
  empireScore += Math.min(20, Object.keys(player.franchises || {}).length * 5);

  const filmScore = clamp(player.history.length * 1.5, 0, 30);

  const totalScore = Math.round(boxOfficeScore + awardScore + peakFameScore + empireScore + filmScore);

  // Tier
  let tier = LEGACY_TIERS[0];
  for (const t of LEGACY_TIERS) {
    if (totalScore >= t.min) tier = t;
  }

  // Defining decade: highest film count + award activity in any decade window
  const decadeStats = {};
  for (const f of player.history) {
    const year = f.releaseYear || f.year;
    const decade = Math.floor(year / 10) * 10;
    if (!decadeStats[decade]) decadeStats[decade] = { films: 0, awards: 0, fame: 0 };
    decadeStats[decade].films += 1;
  }
  for (const a of (player.awards?.history || [])) {
    const decade = Math.floor(a.year / 10) * 10;
    if (!decadeStats[decade]) decadeStats[decade] = { films: 0, awards: 0, fame: 0 };
    decadeStats[decade].awards += a.won ? 3 : 1;
  }
  let bestDecade = null;
  let bestScore = 0;
  for (const d in decadeStats) {
    const s = decadeStats[d].films + decadeStats[d].awards;
    if (s > bestScore) { bestScore = s; bestDecade = d; }
  }

  // Most-remembered film: highest combined critic+audience
  let bestFilm = null;
  let bestFilmScore = 0;
  for (const f of player.history) {
    const s = (f.result?.criticScore || 0) + (f.result?.audienceScore || 0);
    if (s > bestFilmScore) { bestFilmScore = s; bestFilm = f; }
  }

  // Biggest box office
  let topGrosser = null;
  let topGross = 0;
  for (const f of player.history) {
    if ((f.result?.boxOffice || 0) > topGross) { topGross = f.result.boxOffice; topGrosser = f; }
  }

  // Biggest rival
  let topRival = null;
  let topRivalScore = 0;
  for (const id in (player.worldNPCs || {})) {
    const n = player.worldNPCs[id];
    if ((n.rivalryScore || 0) > topRivalScore) { topRivalScore = n.rivalryScore; topRival = n; }
  }

  // Sequels mastery: longest franchise
  let topFranchise = null;
  let topFranchiseLen = 0;
  for (const id in (player.franchises || {})) {
    const f = player.franchises[id];
    if (f.entries.length > topFranchiseLen) { topFranchiseLen = f.entries.length; topFranchise = f; }
  }

  // Number of children, marriages, divorces
  const kids = (player.personal?.children || []).length;
  const marriages = (player.personal?.partnerHistory || []).filter(h => h.reason === 'divorce').length + (player.personal?.status === 'married' ? 1 : 0);
  const scandalsTotal = (player.tabloidHistory || []).filter(t => t.tags?.includes('scandal') || t.tags?.includes('backfired')).length;

  return {
    score: totalScore,
    tier,
    breakdown: {
      boxOffice: Math.round(boxOfficeScore),
      awards: Math.round(awardScore),
      peakFame: Math.round(peakFameScore),
      empire: Math.round(empireScore),
      films: Math.round(filmScore),
    },
    lifetimeBoxOffice,
    bestDecade,
    bestFilm,
    topGrosser,
    topRival,
    topFranchise,
    kids,
    marriages,
    scandalsTotal,
    yearsActive: player.year - (player.startYear || 1985),
    retiredYear: player.year,
    retiredAge: player.age,
  };
}

// ---------- LEGACY VIEW (RETIREMENT SCREEN) ----------

function LegacyView({ player, onNewCareer, onContinue }) {
  const legacy = player.legacy || calcLegacy(player);

  return (
    <div className="ht-fade-in">
      <Panel title="A Career Retrospective" subtitle={`${player.name} · ${player.startYear || 1985}–${legacy.retiredYear}`}>
        {/* The Headline */}
        <div className="ht-poster" style={{ background: 'transparent', border: 'none', padding: 0, marginBottom: 20 }}>
          <div className="ht-poster-tag">★ The Trades ★</div>
          <div className="ht-poster-title">{legacy.tier.label.toUpperCase()}</div>
          <p style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '1.1rem', margin: '10px 20px' }}>
            "{legacy.tier.blurb}"
          </p>
          <div style={{ textAlign: 'center', fontSize: '2.5rem', color: 'var(--gold-bright)', fontFamily: "'Limelight', serif", margin: '15px 0' }}>
            {legacy.score}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--cream-dim)', letterSpacing: '0.2em' }}>
            LEGACY SCORE
          </div>
        </div>

        {/* Score breakdown */}
        <div className="ht-phase-block">
          <div className="ht-phase-block-title">How They Add Up</div>
          <div style={{ fontSize: '0.92rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>Box Office (lifetime)</span>
              <span style={{ color: 'var(--gold-bright)' }}>+{legacy.breakdown.boxOffice}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>Awards & Acclaim</span>
              <span style={{ color: 'var(--gold-bright)' }}>+{legacy.breakdown.awards}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>Peak Fame</span>
              <span style={{ color: 'var(--gold-bright)' }}>+{legacy.breakdown.peakFame}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>Empire & IP</span>
              <span style={{ color: 'var(--gold-bright)' }}>+{legacy.breakdown.empire}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>Body of Work</span>
              <span style={{ color: 'var(--gold-bright)' }}>+{legacy.breakdown.films}</span>
            </div>
          </div>
        </div>

        {/* Defining moments */}
        <div className="ht-phase-block">
          <div className="ht-phase-block-title">The Career, in Brief</div>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>{legacy.yearsActive} years in the industry, retired at {legacy.retiredAge}.</li>
            <li>{player.history.length} films released, grossing {fmtMoney(legacy.lifetimeBoxOffice)} lifetime.</li>
            {player.awards?.wins > 0 && (
              <li>{player.awards.wins} major award{player.awards.wins === 1 ? '' : 's'}, {player.awards.nominations} nominations total.</li>
            )}
            {legacy.bestDecade && (
              <li>The {legacy.bestDecade}s were their decade.</li>
            )}
            {legacy.bestFilm && (
              <li>Their most-remembered film: <strong style={{ color: 'var(--gold-bright)' }}>"{legacy.bestFilm.title}"</strong> ({legacy.bestFilm.releaseYear || legacy.bestFilm.year}) — critics {legacy.bestFilm.result.criticScore}, audiences {legacy.bestFilm.result.audienceScore}.</li>
            )}
            {legacy.topGrosser && legacy.topGrosser !== legacy.bestFilm && (
              <li>Biggest hit: <strong>"{legacy.topGrosser.title}"</strong> — {fmtMoney(legacy.topGrosser.result.boxOffice)}.</li>
            )}
            {legacy.topFranchise && legacy.topFranchise.entries.length >= 2 && (
              <li>Built the <strong>"{legacy.topFranchise.title}"</strong> franchise — {legacy.topFranchise.entries.length} entries.</li>
            )}
            {player.studio && (
              <li>Ran <strong>{player.studio.name}</strong>, released {player.studio.releases} pictures.</li>
            )}
            {legacy.topRival && legacy.topRival.rivalryScore >= 2 && (
              <li>Their defining rival: <strong style={{ color: 'var(--red-bright)' }}>{legacy.topRival.name}</strong>.</li>
            )}
            {legacy.marriages > 0 && (
              <li>{legacy.marriages} marriage{legacy.marriages === 1 ? '' : 's'}{legacy.kids > 0 ? `, ${legacy.kids} child${legacy.kids === 1 ? '' : 'ren'}` : ''}.</li>
            )}
            {legacy.scandalsTotal >= 3 && (
              <li>{legacy.scandalsTotal} scandals across the years. {legacy.scandalsTotal >= 8 ? 'Notorious.' : 'Memorable.'}</li>
            )}
          </ul>
        </div>

        <div className="ht-row" style={{ justifyContent: 'center', marginTop: 20 }}>
          {onContinue && (
            <button className="ht-btn" onClick={onContinue}>← Keep Looking Back</button>
          )}
          {onNewCareer && (
            <button className="ht-btn ht-btn-primary" onClick={onNewCareer}>Begin a New Career →</button>
          )}
        </div>
        {onNewCareer && (
          <p className="ht-text-dim" style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: 12 }}>
            The industry remembers. NPCs from your career may still be around in the next.
          </p>
        )}
      </Panel>
    </div>
  );
}

// ---------- WORLD VIEW (PERSISTENT NPCS) ----------
//
// Browse the industry around you — the named figures who age alongside
// the player and recur across awards, casting, and tabloids.

function WorldView({ player, onSignFirstLook, onCancelFirstLook, firstLookCost, onStartMentorship, canMentor, isMenteeEligible, onClose }) {
  const npcs = Object.values(player.worldNPCs || {});
  const [filter, setFilter] = useState('all');

  // Sort by fame descending
  const sorted = npcs.slice().sort((a, b) => b.fame - a.fame);

  const filtered = filter === 'all' ? sorted
    : filter === 'rivals' ? sorted.filter(n => (n.rivalryScore || 0) >= 1)
    : filter === 'friends' ? sorted.filter(n => (n.friendshipScore || 0) >= 1)
    : filter === 'retired' ? sorted.filter(n => n.status === 'retired')
    : sorted.filter(n => n.role === filter);

  const rivalsCount = sorted.filter(n => (n.rivalryScore || 0) >= 1).length;
  const friendsCount = sorted.filter(n => (n.friendshipScore || 0) >= 1).length;
  const retiredCount = sorted.filter(n => n.status === 'retired').length;

  const getRelationshipLabel = (npc) => {
    const r = npc.rivalryScore || 0;
    const f = npc.friendshipScore || 0;
    if (r >= 3) return { label: '★ Bitter Rival', color: 'var(--red-bright)' };
    if (r >= 1) return { label: 'Rival', color: 'var(--red-bright)' };
    if (f >= 3) return { label: '★ Close Friend', color: '#6fcc4c' };
    if (f >= 1) return { label: 'Friend', color: '#6fcc4c' };
    return null;
  };

  const getTrajectoryArrow = (t) => {
    if (t >= 1) return { arrow: '↗', label: 'rising', color: '#6fcc4c' };
    if (t <= -1) return { arrow: '↘', label: 'fading', color: 'var(--red-bright)' };
    return { arrow: '→', label: 'steady', color: 'var(--gold-dim)' };
  };

  return (
    <div className="ht-fade-in">
      <Panel title="The Industry" subtitle={`${npcs.length} figures in your Hollywood`}>
        <div className="ht-tabs">
          <button className={`ht-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({sorted.length})</button>
          <button className={`ht-tab ${filter === 'actor' ? 'active' : ''}`} onClick={() => setFilter('actor')}>Actors</button>
          <button className={`ht-tab ${filter === 'director' ? 'active' : ''}`} onClick={() => setFilter('director')}>Directors</button>
          <button className={`ht-tab ${filter === 'writer' ? 'active' : ''}`} onClick={() => setFilter('writer')}>Writers</button>
          <button className={`ht-tab ${filter === 'producer' ? 'active' : ''}`} onClick={() => setFilter('producer')}>Producers</button>
          {rivalsCount > 0 && (
            <button className={`ht-tab ${filter === 'rivals' ? 'active' : ''}`} onClick={() => setFilter('rivals')} style={{ color: 'var(--red-bright)' }}>Rivals ({rivalsCount})</button>
          )}
          {friendsCount > 0 && (
            <button className={`ht-tab ${filter === 'friends' ? 'active' : ''}`} onClick={() => setFilter('friends')} style={{ color: '#6fcc4c' }}>Friends ({friendsCount})</button>
          )}
          {retiredCount > 0 && (
            <button className={`ht-tab ${filter === 'retired' ? 'active' : ''}`} onClick={() => setFilter('retired')}>Retired ({retiredCount})</button>
          )}
          {(player.inheritedLegends || []).length > 0 && (
            <button className={`ht-tab ${filter === 'legends' ? 'active' : ''}`} onClick={() => setFilter('legends')} style={{ color: 'var(--gold-bright)' }}>
              Legends ({player.inheritedLegends.length})
            </button>
          )}
        </div>

        {filter === 'legends' ? (
          <>
            <p className="ht-text-dim" style={{ fontSize: '0.92rem', margin: '12px 0' }}>
              Names whispered at every awards dinner. Careers that ended before you started. The industry remembers.
            </p>
            {(player.inheritedLegends || []).slice().reverse().map((l, i) => (
              <div key={i} className="ht-offer-card" style={{ borderLeft: '3px solid var(--gold-bright)' }}>
                <div className="ht-offer-title">
                  {l.name}
                  <span className="ht-tag" style={{ marginLeft: 8, color: 'var(--gold-bright)', borderColor: 'var(--gold-bright)' }}>
                    {l.legacyTier}
                  </span>
                </div>
                <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>
                  {l.yearsActive}
                  {l.bestFilm && <> · best known for <strong>"{l.bestFilm}"</strong></>}
                  {l.awards > 0 && <> · 🏆 ×{l.awards}</>}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
        {filtered.map(npc => {
          const rel = getRelationshipLabel(npc);
          const traj = getTrajectoryArrow(npc.trajectory);
          const isRetired = npc.status === 'retired';
          const sharedFilms = findSharedFilms(player, npc.id);
          return (
            <div key={npc.id} className="ht-offer-card" style={{ borderLeft: rel ? `3px solid ${rel.color}` : '3px solid var(--gold-dim)', opacity: isRetired ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="ht-offer-title">
                    {npc.name}
                    {rel && <span className="ht-tag" style={{ marginLeft: 8, color: rel.color, borderColor: rel.color }}>{rel.label}</span>}
                    {isRetired && <span className="ht-tag" style={{ marginLeft: 8 }}>Retired</span>}
                  </div>
                  <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>
                    {npc.archetype} {npc.roleLabel.toLowerCase()} · age {npc.age}
                    {!isRetired && <span style={{ color: traj.color, marginLeft: 8 }}>{traj.arrow} {traj.label}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', color: 'var(--gold-bright)', fontWeight: 700 }}>Fame {npc.fame}</div>
                  <div className="ht-text-dim" style={{ fontSize: '0.78rem' }}>{npc.filmCount} films · 🏆{npc.awardWins} ⭐{npc.awardNoms}</div>
                </div>
              </div>

              {/* Shared films with the player */}
              {sharedFilms.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.82rem', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                  <strong style={{ color: 'var(--gold-bright)', fontSize: '0.78rem', letterSpacing: '0.05em' }}>
                    ★ WORKED TOGETHER:
                  </strong>{' '}
                  {sharedFilms.map((f, i) => (
                    <span key={i}>
                      {i > 0 && <span className="ht-text-dim">, </span>}
                      <span style={{ color: f.hit ? '#6fcc4c' : f.flop ? 'var(--red-bright)' : 'var(--cream)' }}>
                        "{f.title}" ({f.year})
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {npc.history && npc.history.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', maxHeight: 80, overflowY: 'auto', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                  {npc.history.slice(-3).reverse().map((h, i) => (
                    <div key={i} className="ht-text-dim">
                      <strong>{h.year}:</strong> {h.detail}
                    </div>
                  ))}
                </div>
              )}

              {/* First-Look Deal section — only for director NPCs */}
              {npc.role === 'director' && !isRetired && onSignFirstLook && (() => {
                const existingDeal = (player.firstLookDeals || []).find(d => d.npcId === npc.id);
                const cost = firstLookCost(npc);
                if (existingDeal) {
                  return (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(212,166,74,0.10)', border: '1px solid var(--gold-dim)', borderRadius: 2 }}>
                      <div style={{ fontSize: '0.82rem' }}>
                        <strong style={{ color: 'var(--gold-bright)' }}>📜 First-Look Deal Active</strong>
                        <span className="ht-text-dim"> · expires {existingDeal.expiresYear} · paid {fmtMoney(existingDeal.totalPaid || existingDeal.retainerPaid)}</span>
                      </div>
                      <button
                        className="ht-btn ht-btn-sm"
                        style={{ marginTop: 6, fontSize: '0.78rem' }}
                        onClick={() => onCancelFirstLook(existingDeal.id)}
                      >
                        Cancel — Don't Auto-Renew
                      </button>
                    </div>
                  );
                }
                return (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <div style={{ fontSize: '0.82rem', marginBottom: 4 }}>
                      <strong>First-Look Deal:</strong>
                      <span className="ht-text-dim"> {fmtMoney(cost)}/year — they pitch you first</span>
                    </div>
                    <button
                      className="ht-btn ht-btn-sm ht-btn-primary"
                      style={{ fontSize: '0.78rem' }}
                      disabled={player.cash < cost}
                      onClick={() => onSignFirstLook(npc)}
                    >
                      Sign · {fmtMoney(cost)}
                    </button>
                  </div>
                );
              })()}

              {/* Mentorship section — for up-and-comer NPCs when player is mentor-eligible */}
              {canMentor && isMenteeEligible && isMenteeEligible(npc) && onStartMentorship && (() => {
                const activeMentorship = (player.mentorships || []).find(m => m.menteeNpcId === npc.id && !m.endedYear);
                const wasAlumnus = (player.mentoredAlumni || []).some(a => a.menteeNpcId === npc.id);
                const activeCount = (player.mentorships || []).filter(m => !m.endedYear).length;
                if (activeMentorship) {
                  // Already mentoring — handled on hub panel
                  return null;
                }
                if (wasAlumnus) {
                  return (
                    <div style={{ marginTop: 8, padding: '6px 10px', fontSize: '0.82rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--gold-dim)' }}>
                      <span className="ht-text-dim">🎓 You mentored {npc.name}. They never forgot.</span>
                    </div>
                  );
                }
                return (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.82rem', marginBottom: 4 }}>
                      <strong>Take {npc.name} under your wing?</strong>
                    </div>
                    <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginBottom: 6 }}>
                      A rising {ROLE_LABELS[npc.role].toLowerCase()} at age {npc.age}. Costs no money — just your time.
                    </div>
                    <button
                      className="ht-btn ht-btn-sm ht-btn-primary"
                      style={{ fontSize: '0.78rem' }}
                      disabled={activeCount >= 2}
                      onClick={() => onStartMentorship(npc)}
                      title={activeCount >= 2 ? 'You already have two active mentees' : ''}
                    >
                      Mentor Them
                    </button>
                    {activeCount >= 2 && (
                      <span className="ht-text-dim" style={{ fontSize: '0.78rem', marginLeft: 8 }}>(2/2 active)</span>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="ht-text-dim" style={{ textAlign: 'center', padding: 20 }}>No one in this category yet.</p>
        )}
          </>
        )}

        <div className="ht-row" style={{ marginTop: 16 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- SAVE / LOAD VIEW ----------
//
// Three manual slots, JSON export, JSON import. Auto-save is silent and
// happens on every week tick — this view is for explicit checkpoints.

function SaveLoadView({ player, onLoad, onClose }) {
  const [slots, setSlots] = useState([null, null, null]);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState(null);
  const [confirmLoad, setConfirmLoad] = useState(null); // { slot, pack }
  const [feedback, setFeedback] = useState(null);

  const storageAvailable = hasLocalStorage();

  // Read current slot contents
  const refreshSlots = () => {
    setSlots([1, 2, 3].map(s => loadFromSlot(s)));
  };

  useEffect(() => {
    refreshSlots();
  }, []);

  const flash = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const doSave = (slot) => {
    const ok = saveToSlot(slot, player);
    if (ok) {
      flash(`Saved to Slot ${slot}.`);
      refreshSlots();
    } else {
      flash(`Save failed — storage unavailable.`);
    }
  };

  const doLoad = (slot) => {
    const pack = loadFromSlot(slot);
    if (pack && pack.player) {
      setConfirmLoad({ slot, pack });
    }
  };

  const confirmLoadAction = () => {
    onLoad(confirmLoad.pack.player);
    setConfirmLoad(null);
  };

  const doDelete = (slot) => {
    if (deleteSlot(slot)) {
      flash(`Deleted Slot ${slot}.`);
      refreshSlots();
    }
  };

  const doExport = () => {
    const ok = exportSaveAsFile(player);
    flash(ok ? 'Export downloaded.' : 'Export failed.');
  };

  const doImport = () => {
    const p = importSaveFromText(importText);
    if (p) {
      onLoad(p);
      setImportError(null);
      setImportText('');
      setShowImport(false);
    } else {
      setImportError('Could not parse that save file. Make sure you pasted the full JSON.');
    }
  };

  return (
    <div className="ht-fade-in">
      <Panel title="Save & Load" subtitle="Checkpoint your career">
        {!storageAvailable && (
          <div className="ht-phase-block" style={{ borderLeftColor: 'var(--red-bright)' }}>
            <div className="ht-phase-block-title" style={{ color: 'var(--red-bright)' }}>⚠ Local Storage Unavailable</div>
            <p style={{ fontSize: '0.9rem' }}>
              This environment doesn't allow local saves. Use the Export/Import options below to checkpoint your career as a JSON file you can keep on your computer.
            </p>
          </div>
        )}

        {feedback && (
          <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)' }}>
            <strong>{feedback}</strong>
          </div>
        )}

        {/* Current career summary */}
        <div className="ht-phase-block">
          <div className="ht-phase-block-title">Current Career</div>
          <p style={{ fontSize: '0.92rem', margin: '4px 0' }}>
            <strong style={{ color: 'var(--gold-bright)' }}>{player.name}</strong> · Year {player.year} · Week {player.week} · Fame {Math.round(player.fame)} · {fmtMoney(player.cash)}
          </p>
        </div>

        {/* Manual slots */}
        {storageAvailable && (
          <div className="ht-phase-block">
            <div className="ht-phase-block-title">Save Slots</div>
            {[1, 2, 3].map((slot, i) => {
              const data = slots[i];
              return (
                <div key={slot} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--border)', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <strong>Slot {slot}:</strong>{' '}
                    {data ? (
                      <span>
                        <span style={{ color: 'var(--gold-bright)' }}>{data.player?.name}</span>
                        <span className="ht-text-dim">
                          {' · '}Year {data.player?.year} · W{data.player?.week} · Fame {Math.round(data.player?.fame || 0)}
                          {data.savedAt && ` · saved ${new Date(data.savedAt).toLocaleDateString()}`}
                        </span>
                      </span>
                    ) : (
                      <span className="ht-text-dim">empty</span>
                    )}
                  </div>
                  <div className="ht-row" style={{ flexWrap: 'nowrap' }}>
                    <button className="ht-btn ht-btn-sm" onClick={() => doSave(slot)}>
                      {data ? 'Overwrite' : 'Save Here'}
                    </button>
                    {data && (
                      <>
                        <button className="ht-btn ht-btn-sm" onClick={() => doLoad(slot)}>Load</button>
                        <button className="ht-btn ht-btn-sm ht-btn-danger" onClick={() => doDelete(slot)}>×</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="ht-text-dim" style={{ fontSize: '0.82rem', marginTop: 10 }}>
              ⓘ The game also auto-saves silently after each week. Closing your browser won't lose progress.
            </p>
          </div>
        )}

        {/* Export / Import */}
        <div className="ht-phase-block">
          <div className="ht-phase-block-title">Portable Saves</div>
          <p style={{ fontSize: '0.88rem' }}>Export your career as a JSON file you can keep, share, or import later.</p>
          <div className="ht-row" style={{ marginTop: 10 }}>
            <button className="ht-btn ht-btn-sm" onClick={doExport}>📥 Export to File</button>
            <button className="ht-btn ht-btn-sm" onClick={() => { setShowImport(s => !s); setImportError(null); }}>
              📤 Import from Text
            </button>
          </div>
          {showImport && (
            <div style={{ marginTop: 12 }}>
              <textarea
                className="ht-input"
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Paste your save JSON here…"
                rows={6}
                style={{ width: '100%', fontFamily: "'Special Elite', monospace", fontSize: '0.8rem' }}
              />
              {importError && <p style={{ color: 'var(--red-bright)', fontSize: '0.85rem', marginTop: 6 }}>{importError}</p>}
              <div className="ht-row" style={{ marginTop: 8 }}>
                <button className="ht-btn ht-btn-sm ht-btn-primary" onClick={doImport} disabled={!importText.trim()}>
                  Load From Text
                </button>
                <button className="ht-btn ht-btn-sm" onClick={() => { setShowImport(false); setImportText(''); setImportError(null); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ht-row" style={{ marginTop: 16 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>

      {/* Confirm load (overwrites current career) */}
      {confirmLoad && (
        <div className="ht-modal-bg" onClick={() => setConfirmLoad(null)}>
          <div className="ht-poster" onClick={e => e.stopPropagation()}>
            <div className="ht-poster-tag">★ Load Save? ★</div>
            <div className="ht-poster-title" style={{ fontSize: '1.5rem' }}>
              Load Slot {confirmLoad.slot}?
            </div>
            <p style={{ marginTop: 16, lineHeight: 1.5 }}>
              This will replace your current career as <strong>{player.name}</strong> with the save:
            </p>
            <p style={{ textAlign: 'center', margin: 14, padding: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--gold-bright)' }}>{confirmLoad.pack.player?.name}</strong><br />
              <span className="ht-text-dim">Year {confirmLoad.pack.player?.year} · Week {confirmLoad.pack.player?.week} · Fame {Math.round(confirmLoad.pack.player?.fame || 0)}</span>
            </p>
            <p className="ht-text-dim" style={{ fontSize: '0.85rem', marginTop: 8 }}>Your current career won't be saved automatically. Save first if you want to keep it.</p>
            <div className="ht-row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="ht-btn ht-btn-primary" onClick={confirmLoadAction}>Load</button>
              <button className="ht-btn" onClick={() => setConfirmLoad(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- PERSONAL LIFE VIEW ----------

function PersonalLife({ player, production, onAction, onPlant, onClose }) {
  const personal = player.personal || {};
  const status = personal.status || 'single';

  // Dating pool — regenerated when player opens or clicks "show me others"
  const [datingPool, setDatingPool] = useState([]);

  useEffect(() => {
    if (status === 'single' || status === 'divorced' || status === 'widowed') {
      setDatingPool([generatePartner(player), generatePartner(player), generatePartner(player)]);
    }
    // eslint-disable-next-line
  }, [status]);

  const refreshPool = () => {
    setDatingPool([generatePartner(player), generatePartner(player), generatePartner(player)]);
  };

  // ===== Plant a Story logic =====
  const hasPublicist = (player.possessions || []).includes('publicist');
  // Cooldown check: 4 weeks since last plant
  const lastPlant = player.lastPlantedAt;
  let weeksUntilNextPlant = 0;
  if (lastPlant) {
    const totalWeeksSince = (player.year - lastPlant.year) * 52 + (player.week - lastPlant.week);
    weeksUntilNextPlant = Math.max(0, 4 - totalWeeksSince);
  }
  const plantAvailable = hasPublicist && weeksUntilNextPlant === 0 && !player.pendingEvent;
  const plants = eligiblePlants(player, production);
  const [showPlants, setShowPlants] = useState(false);

  return (
    <div className="ht-fade-in">
      <Panel title="Personal Life" subtitle={`Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`}>

        {/* Current partner / status display */}
        {personal.partner && (
          <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)' }}>
            <div className="ht-phase-block-title">
              {status === 'married' ? '💍 Married to' : status === 'engaged' ? '💍 Engaged to' : '❤️ Dating'} {personal.partner.name}
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              {personal.partner.occupation} · {personal.partner.isStar ? `Fame ${personal.partner.fame}` : 'Outside the industry'}
              {personal.partner.since && ` · Since ${personal.partner.since.year}`}
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="ht-skill-row">
                <span className="ht-skill-name">Relationship Health</span>
                <span className="ht-skill-num">{Math.round(personal.relationshipHealth ?? 100)}</span>
              </div>
              <Bar value={personal.relationshipHealth ?? 100} />
            </div>

            <div className="ht-row" style={{ marginTop: 14 }}>
              {status === 'dating' && (
                <>
                  <button className="ht-btn ht-btn-sm ht-btn-primary" onClick={() => onAction({ type: 'propose' })}>
                    💍 Propose
                  </button>
                  <button className="ht-btn ht-btn-sm" onClick={() => onAction({ type: 'date_night' })} disabled={player.cash < 2000}>
                    🌹 Date Night ($2K)
                  </button>
                  <button className="ht-btn ht-btn-sm ht-btn-danger" onClick={() => onAction({ type: 'break_up' })}>
                    Break Up
                  </button>
                </>
              )}
              {status === 'engaged' && (
                <>
                  <button className="ht-btn ht-btn-sm ht-btn-primary" onClick={() => onAction({ type: 'marry' })} disabled={player.cash < 50_000}>
                    💒 Get Married ($50K wedding)
                  </button>
                  <button className="ht-btn ht-btn-sm" onClick={() => onAction({ type: 'date_night' })} disabled={player.cash < 2000}>
                    🌹 Date Night ($2K)
                  </button>
                  <button className="ht-btn ht-btn-sm ht-btn-danger" onClick={() => onAction({ type: 'break_off' })}>
                    Call It Off
                  </button>
                </>
              )}
              {status === 'married' && (
                <>
                  <button className="ht-btn ht-btn-sm" onClick={() => onAction({ type: 'have_child' })} disabled={player.cash < 20_000}>
                    👶 Have a Child ($20K)
                  </button>
                  <button className="ht-btn ht-btn-sm" onClick={() => onAction({ type: 'date_night' })} disabled={player.cash < 2000}>
                    🌹 Date Night ($2K)
                  </button>
                  <button className="ht-btn ht-btn-sm" onClick={() => onAction({ type: 'vacation' })} disabled={player.cash < 30_000}>
                    ✈️ Vacation ($30K)
                  </button>
                  {(() => {
                    const sinceYear = personal.partner?.since?.year;
                    const yearsmarried = sinceYear ? (player.year - sinceYear) : 0;
                    const lastRenewal = personal.lastVowRenewalYear || 0;
                    const yearsSinceRenewal = player.year - lastRenewal;
                    // Eligible if married 10+ years AND not renewed in the last 10 years
                    if (yearsmarried >= 10 && yearsSinceRenewal >= 10) {
                      return (
                        <button
                          className="ht-btn ht-btn-sm"
                          onClick={() => onAction({ type: 'renew_vows' })}
                          disabled={player.cash < 30_000}
                          style={{ borderColor: 'var(--gold-bright)', color: 'var(--gold-bright)' }}
                        >
                          💍 Renew Vows ($30K)
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button className="ht-btn ht-btn-sm ht-btn-danger" onClick={() => onAction({ type: 'divorce' })}>
                    Divorce
                  </button>
                </>
              )}
            </div>

            {personal.relationshipHealth < 30 && (
              <p style={{ color: 'var(--red-bright)', fontSize: '0.85rem', marginTop: 10 }}>
                ⚠ The relationship is in serious trouble.
              </p>
            )}
          </div>
        )}

        {/* Children */}
        {(personal.children || []).length > 0 && (
          <div className="ht-phase-block">
            <div className="ht-phase-block-title">👨‍👩‍👧 Children</div>
            {personal.children.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                <span>{c.name}</span>
                <span className="ht-text-dim">{player.year - c.born} year{player.year - c.born === 1 ? '' : 's'} old · born {c.born}</span>
              </div>
            ))}
            <div className="ht-text-dim" style={{ fontSize: '0.8rem', marginTop: 6 }}>
              Weekly upkeep: {fmtMoney(childUpkeep(player))}
            </div>
          </div>
        )}

        {/* Dating pool (only when single) */}
        {(status === 'single' || status === 'divorced' || status === 'widowed') && (
          <div className="ht-phase-block">
            <div className="ht-phase-block-title">💃 Who's Around</div>
            <p className="ht-text-dim" style={{ fontSize: '0.88rem' }}>
              Friends keep introducing you to people. {status === 'divorced' && 'The dust has settled from the divorce. '}{status === 'widowed' && 'It\'s been a while. '}Some are in the industry. Some are not. Choose carefully — or don't.
            </p>
            {datingPool.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: '1px dashed var(--border)', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <strong style={{ color: 'var(--gold-bright)' }}>{p.name}</strong>
                  <span className="ht-text-dim"> · {p.occupation}</span>
                  {p.isStar && <span className="ht-tag" style={{ marginLeft: 8 }}>Fame {p.fame}</span>}
                  {p.npcId && (
                    <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginTop: 2, fontStyle: 'italic' }}>
                      Someone you've worked with — feels different from a setup.
                    </div>
                  )}
                </div>
                <button className="ht-btn ht-btn-sm" onClick={() => onAction({ type: 'start_dating', partner: p })}>
                  Start Dating
                </button>
              </div>
            ))}
            <div className="ht-row" style={{ marginTop: 10 }}>
              <button className="ht-btn ht-btn-sm" onClick={refreshPool}>Meet Other People</button>
            </div>
          </div>
        )}

        {/* Scandals */}
        {(player.scandals || []).length > 0 && (
          <div className="ht-phase-block" style={{ borderLeftColor: 'var(--red-bright)' }}>
            <div className="ht-phase-block-title" style={{ color: 'var(--red-bright)' }}>🚨 Active Scandals</div>
            {player.scandals.map((s, i) => {
              const totalWeeksSince = (player.year - s.started.year) * 52 + (player.week - s.started.week);
              const weeksLeft = Math.max(0, s.weeks - totalWeeksSince);
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                  <span>{s.description}</span>
                  <span className="ht-text-dim">{weeksLeft} week{weeksLeft === 1 ? '' : 's'} left · severity {s.severity.toFixed(1)}</span>
                </div>
              );
            })}
            <p className="ht-text-dim" style={{ fontSize: '0.82rem', marginTop: 8 }}>
              Scandals hurt your fame growth, offer probability, and awards prospects until they fade.
            </p>
          </div>
        )}

        {/* Plant a Story (publicist-only) */}
        {hasPublicist && (
          <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)' }}>
            <div className="ht-phase-block-title">📞 Your Publicist Is On The Line</div>
            <p style={{ fontSize: '0.9rem', margin: '4px 0' }}>
              {weeksUntilNextPlant > 0 ? (
                <span className="ht-text-dim">
                  Your team just placed a story. The press will get suspicious if you flood them — wait {weeksUntilNextPlant} more week{weeksUntilNextPlant === 1 ? '' : 's'} before planting another.
                </span>
              ) : (
                <span>"Got a slow news cycle. Want me to put something out there?" Each plant costs cash, gives fame, and carries some risk of being traced back.</span>
              )}
            </p>
            {plantAvailable && (
              <button className="ht-btn ht-btn-sm ht-btn-primary" style={{ marginTop: 8 }} onClick={() => setShowPlants(s => !s)}>
                {showPlants ? 'Close Story Options' : '✒ Plant a Story'}
              </button>
            )}
            {showPlants && plantAvailable && (
              <div style={{ marginTop: 12 }}>
                {plants.length === 0 ? (
                  <p className="ht-text-dim" style={{ fontSize: '0.88rem' }}>No plants are viable right now. (Some require a partner, a recent film, an active production, or higher fame.)</p>
                ) : (
                  plants.map(plant => (
                    <div key={plant.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--border)', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <strong>{plant.label}</strong>
                        <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>{plant.description}</div>
                        <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                          <span className="ht-tag">+{plant.fameGain} fame</span>
                          <span className="ht-tag" style={{ color: 'var(--red-bright)', borderColor: 'var(--red-bright)' }}>
                            {Math.round(plant.backfireChance * 100)}% backfire risk
                          </span>
                          <span className="ht-tag">{fmtMoney(plant.cost)}</span>
                        </div>
                      </div>
                      <button
                        className="ht-btn ht-btn-sm"
                        disabled={player.cash < plant.cost}
                        onClick={() => { onPlant(plant); setShowPlants(false); }}
                      >
                        Place It
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Past relationships */}
        {(personal.partnerHistory || []).length > 0 && (
          <div className="ht-phase-block">
            <div className="ht-phase-block-title">📜 Past Relationships</div>
            {personal.partnerHistory.map((h, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--border)', fontSize: '0.9rem' }}>
                <strong>{h.name}</strong> <span className="ht-text-dim">— {h.started} to {h.ended} ({h.reason})</span>
              </div>
            ))}
          </div>
        )}

        <div className="ht-row" style={{ marginTop: 16 }}>
          <button className="ht-btn" onClick={onClose}>← Back</button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- YEAR IN VARIETY MODAL ----------
//
// Fires at year rollover. Summarizes the year just ended:
//   - Films released this year (with quality + box office)
//   - Award wins/nominations this year
//   - Top tabloid stories
//   - Top NPC movements (rivals/friends and their year)
//   - Personal milestones (marriage, kids, etc.)

// ---------- LIFETIME ACHIEVEMENT AWARD MODAL ----------
// Fires once per career when fame >= 85, age >= 60, history >= 10 films.
// Gives a permanent fame floor and a unique career milestone.

function LifetimeAchievementModal({ player, onAccept }) {
  if (!player) return null;
  const yearsActive = player.year - (player.startYear || 1985);
  const careerHits = (player.history || []).filter(f => f.result?.hit).length;
  const wins = player.awards?.wins || 0;

  return (
    <div className="ht-modal-bg">
      <div className="ht-poster" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, borderColor: 'var(--gold-bright)', borderWidth: 3 }}>
        <div className="ht-poster-tag" style={{ color: 'var(--gold-bright)' }}>★ LIFETIME ACHIEVEMENT ★</div>
        <div className="ht-poster-title" style={{ fontFamily: "'Limelight', serif", fontSize: '2rem', color: 'var(--gold-bright)' }}>
          AN HONOR FOR
        </div>
        <div style={{ textAlign: 'center', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.8rem', color: 'var(--gold-bright)', marginTop: 8, letterSpacing: '0.05em' }}>
          {player.name}
        </div>

        <p style={{ textAlign: 'center', marginTop: 22, fontStyle: 'italic', fontSize: '1rem', lineHeight: 1.6, color: 'var(--cream)' }}>
          The Academy is honoring you with a Lifetime Achievement Award. Forty years, when you count it. {player.history.length} pictures. {careerHits} hit{careerHits === 1 ? '' : 's'}. {wins} statuette{wins === 1 ? '' : 's'} on the shelf.
        </p>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.92rem', color: 'var(--cream-dim)' }}>
          The standing ovation lasts six minutes. They show a clip reel. Every face in the room is one you knew.
        </p>

        <div className="ht-phase-block" style={{ marginTop: 20, borderLeftColor: 'var(--gold-bright)' }}>
          <div className="ht-phase-block-title">★ The Honor Includes</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 8, fontSize: '0.92rem' }}>
            <div><span className="ht-text-dim">Years active:</span> <strong>{yearsActive}</strong></div>
            <div><span className="ht-text-dim">Films:</span> <strong>{player.history.length}</strong></div>
            <div><span className="ht-text-dim">Peak fame:</span> <strong>{Math.round(player.peakFame || 0)}</strong></div>
            <div><span className="ht-text-dim">Major wins:</span> <strong>{wins}</strong></div>
          </div>
          <p style={{ fontSize: '0.85rem', marginTop: 12, color: 'var(--gold-bright)', fontStyle: 'italic' }}>
            ★ Permanent fame floor: 60. Whatever happens next, you will not be forgotten.
          </p>
        </div>

        <div className="ht-row" style={{ justifyContent: 'center', marginTop: 22 }}>
          <button className="ht-btn ht-btn-primary" onClick={onAccept}>
            Accept the Honor →
          </button>
        </div>
      </div>
    </div>
  );
}

function YearInVarietyModal({ year, player, onClose }) {
  if (!year) return null;

  // ----- Films released this year -----
  const yearFilms = (player.history || []).filter(f => (f.releaseYear || f.year) === year);
  const yearInTheaters = (player.inTheaters || []).filter(f => f.releaseYear === year);
  const allYearFilms = [...yearFilms, ...yearInTheaters];

  // ----- Award activity this year -----
  const yearAwards = (player.awards?.history || []).filter(a => a.year === year);
  const yearWins = yearAwards.filter(a => a.won);
  const yearNoms = yearAwards.filter(a => !a.won);

  // ----- Tabloid stories from this year -----
  const yearTabloids = (player.tabloidHistory || []).filter(t => t.year === year);
  // Pick the top 3 most "newsworthy" — events that affected fame the most are ones
  // we'd guess by tag (scandal > feud > rumor > positive)
  const topTabloids = yearTabloids.slice(-3);

  // ----- NPC movements this year -----
  const npcMovements = [];
  for (const npc of Object.values(player.worldNPCs || {})) {
    const events = (npc.history || []).filter(h => h.year === year);
    for (const ev of events) {
      npcMovements.push({ name: npc.name, archetype: npc.archetype, ...ev });
    }
  }
  // Limit to top 4 most interesting
  const topNpcMovements = npcMovements.slice(0, 4);

  // ----- Personal milestones this year -----
  const personalEvents = [];
  // Marriage/divorce
  for (const h of (player.personal?.partnerHistory || [])) {
    if (h.ended === year) {
      personalEvents.push(`Split with ${h.name} (${h.reason})`);
    }
    if (h.started === year && h.ended === year) {
      // brief relationship — skip
    }
  }
  if (player.personal?.partner?.since?.year === year) {
    personalEvents.push(`Started dating ${player.personal.partner.name}`);
  }
  // Kids born this year
  for (const child of (player.personal?.children || [])) {
    if (child.born === year) {
      personalEvents.push(`Welcomed ${child.name} into the world`);
    }
  }
  // Studio founded
  if (player.studio && player.studio.foundedYear === year) {
    personalEvents.push(`Founded ${player.studio.name}`);
  }

  // ----- Year summary stats -----
  const yearBoxOffice = allYearFilms.reduce((s, f) => s + (f.result?.boxOffice || 0), 0);
  const yearHits = allYearFilms.filter(f => f.result?.hit).length;
  const yearFlops = allYearFilms.filter(f => f.result?.flop).length;

  // Is there anything to recap? If totally empty year, show a brief "quiet year" message
  const hasContent = allYearFilms.length > 0 || yearAwards.length > 0 ||
                     topTabloids.length > 0 || personalEvents.length > 0 ||
                     topNpcMovements.length > 0;

  return (
    <div className="ht-modal-bg" onClick={onClose}>
      <div className="ht-poster" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="ht-poster-tag">★ {year} in Review ★</div>
        <div className="ht-poster-title" style={{ fontFamily: "'Limelight', serif", fontSize: '1.8rem' }}>
          THE YEAR IN VARIETY
        </div>
        <div style={{ textAlign: 'center', fontFamily: "'Special Elite', monospace", fontSize: '0.75rem', color: 'var(--cream-dim)', letterSpacing: '0.2em', marginTop: 4 }}>
          {player.name} · {year}
        </div>

        {!hasContent && (
          <p style={{ textAlign: 'center', marginTop: 18, fontStyle: 'italic', color: 'var(--cream-dim)' }}>
            A quiet year. No releases, no headlines, no major moves. Sometimes Hollywood lets you breathe.
          </p>
        )}

        {/* Films */}
        {allYearFilms.length > 0 && (
          <div className="ht-phase-block" style={{ marginTop: 18 }}>
            <div className="ht-phase-block-title">🎬 At the Movies</div>
            <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
              {allYearFilms.length} {allYearFilms.length === 1 ? 'picture' : 'pictures'} hit screens.
              {yearHits > 0 && ` ${yearHits} ${yearHits === 1 ? 'hit' : 'hits'}.`}
              {yearFlops > 0 && ` ${yearFlops} ${yearFlops === 1 ? 'flop' : 'flops'}.`}
              {' '}Total at the box office: <strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(yearBoxOffice)}</strong>.
            </p>
            <div style={{ marginTop: 8 }}>
              {allYearFilms.map((f, i) => {
                const hit = f.result?.hit;
                const flop = f.result?.flop;
                return (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--border)', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>
                      <strong style={{ color: hit ? '#6fcc4c' : flop ? 'var(--red-bright)' : 'var(--gold-bright)', fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>
                        "{f.title}"
                      </strong>
                      <span className="ht-text-dim"> · {f.genre}</span>
                      {hit && <span className="ht-tag" style={{ marginLeft: 6, borderColor: '#6fcc4c', color: '#6fcc4c' }}>Hit</span>}
                      {flop && <span className="ht-tag" style={{ marginLeft: 6, borderColor: 'var(--red-bright)', color: 'var(--red-bright)' }}>Flop</span>}
                    </span>
                    <span className="ht-text-dim" style={{ fontSize: '0.82rem' }}>
                      Q{f.result?.quality || '?'} · {fmtMoney(f.result?.boxOffice || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Awards */}
        {yearAwards.length > 0 && (
          <div className="ht-phase-block" style={{ marginTop: 14 }}>
            <div className="ht-phase-block-title">🏆 Awards Season</div>
            <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
              {yearWins.length > 0 && (
                <>
                  <strong style={{ color: 'var(--gold-bright)' }}>{yearWins.length} win{yearWins.length === 1 ? '' : 's'}</strong>
                  {yearNoms.length > 0 && ', '}
                </>
              )}
              {yearNoms.length > 0 && (
                <span>{yearNoms.length} additional nomination{yearNoms.length === 1 ? '' : 's'}</span>
              )}
              {yearAwards.length > 0 && '.'}
            </p>
            {yearWins.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {yearWins.slice(0, 4).map((a, i) => (
                  <div key={i} style={{ fontSize: '0.82rem', padding: '2px 0' }}>
                    <span style={{ color: 'var(--gold-bright)' }}>★</span> {AWARD_CATEGORIES[a.category]?.label || a.category} — "{a.film}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabloid */}
        {topTabloids.length > 0 && (
          <div className="ht-phase-block" style={{ marginTop: 14 }}>
            <div className="ht-phase-block-title">📰 The Press Had Plenty</div>
            {topTabloids.map((t, i) => (
              <div key={i} style={{ padding: '5px 0', borderBottom: i < topTabloids.length - 1 ? '1px dashed var(--border)' : 'none', fontSize: '0.82rem' }}>
                <div style={{ fontFamily: "'Limelight', serif", fontSize: '0.78rem', color: 'var(--cream)', letterSpacing: '0.04em' }}>
                  {t.headline}
                </div>
                <div className="ht-text-dim" style={{ fontSize: '0.78rem', fontStyle: 'italic', marginTop: 2 }}>
                  Your move: "{t.choice}"
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NPC movements */}
        {topNpcMovements.length > 0 && (
          <div className="ht-phase-block" style={{ marginTop: 14 }}>
            <div className="ht-phase-block-title">⚙ Around the Industry</div>
            {topNpcMovements.map((ev, i) => (
              <div key={i} style={{ padding: '3px 0', fontSize: '0.82rem' }}>
                <strong style={{ color: 'var(--gold-bright)' }}>{ev.name}</strong>
                <span className="ht-text-dim"> ({ev.archetype})</span> — {ev.detail}
              </div>
            ))}
          </div>
        )}

        {/* Personal */}
        {personalEvents.length > 0 && (
          <div className="ht-phase-block" style={{ marginTop: 14 }}>
            <div className="ht-phase-block-title">❤️ In Your Life</div>
            {personalEvents.map((e, i) => (
              <div key={i} style={{ padding: '3px 0', fontSize: '0.85rem' }}>
                {e}
              </div>
            ))}
          </div>
        )}

        {/* Year-end stats */}
        <div style={{ marginTop: 18, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
          <div className="ht-label" style={{ marginBottom: 6 }}>End of {year}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            <div><span className="ht-text-dim">Age:</span> <strong>{player.age}</strong></div>
            <div><span className="ht-text-dim">Fame:</span> <strong>{Math.round(player.fame)}</strong></div>
            <div><span className="ht-text-dim">Cash:</span> <strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(player.cash)}</strong></div>
            <div><span className="ht-text-dim">Films:</span> <strong>{(player.history || []).length}</strong></div>
          </div>
        </div>

        <div className="ht-row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="ht-btn ht-btn-primary" onClick={onClose}>
            Onward to {year + 1} →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- TABLOID EVENT MODAL ----------

function TabloidEventModal({ event, onChoose }) {
  const [chosenOutcome, setChosenOutcome] = useState(null);

  // Reset outcome state when event changes
  useEffect(() => {
    setChosenOutcome(null);
  }, [event?.id, event?.headline]);

  if (!event) return null;

  const handleChoose = (c) => {
    if (c.outcome) {
      setChosenOutcome(c);
    } else {
      onChoose(c);
    }
  };

  const confirmOutcome = () => {
    onChoose(chosenOutcome);
    setChosenOutcome(null);
  };

  return (
    <div className="ht-modal-bg" onClick={() => {}}>
      <div className="ht-tabloid" onClick={e => e.stopPropagation()}>
        <div className="ht-tabloid-masthead">
          THE HOLLYWOOD INSIDER · LATE EDITION
        </div>
        <div className="ht-tabloid-headline">{event.headline}</div>
        <div className="ht-tabloid-divider" />
        <p className="ht-tabloid-lede">{event.flavor}</p>

        {!chosenOutcome ? (
          <div style={{ marginTop: 20 }}>
            <div className="ht-label">Your move?</div>
            {event.choices.map((c, i) => (
              <button
                key={i}
                className="ht-btn"
                style={{ width: '100%', marginTop: 8, textAlign: 'left' }}
                onClick={() => handleChoose(c)}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            <div className="ht-tabloid-outcome-label">— THE FALLOUT —</div>
            <p className="ht-tabloid-outcome">{chosenOutcome.outcome}</p>
            <div className="ht-row" style={{ justifyContent: 'center', marginTop: 18 }}>
              <button className="ht-btn ht-btn-primary" onClick={confirmOutcome}>
                Turn the Page →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- MAIN GAME ----------

function MainGame({ player, setPlayer, onLoad, onRetireToNew }) {
  const [view, setView] = useState('hub'); // hub | offers | train | studio | newproj | production
  const [listings, setListings] = useState([]); // mix of offers AND auditions
  // Casting board filters
  const [castingFilter, setCastingFilter] = useState('all'); // all | offers | auditions | wheelhouse
  const [castingSort, setCastingSort] = useState('default'); // default | budget | pay | genre
  const [activeOffer, setActiveOffer] = useState(null);
  const [result, setResult] = useState(null);
  const [resultProject, setResultProject] = useState(null);
  const [pendingFoundStudio, setPendingFoundStudio] = useState(false);
  const [auditionResult, setAuditionResult] = useState(null); // { audition, outcome }
  const [production, setProduction] = useState(player.activeProduction || null); // active multi-phase production
  // Sync production back into player so it survives saves/loads
  useEffect(() => {
    setPlayer(p => {
      if (p.activeProduction === production) return p;
      // Strip phase callbacks since they're not in production object anyway
      return { ...p, activeProduction: production };
    });
    // eslint-disable-next-line
  }, [production]);
  // If on load, the saved player has activeProduction and view should jump to production
  useEffect(() => {
    if (production && view === 'hub') {
      setView('production');
    }
    // eslint-disable-next-line
  }, []);
  const [awardsSeason, setAwardsSeason] = useState(null); // { year, results } when triggered
  const [shownAwardBodies, setShownAwardBodies] = useState({}); // { 'critics-1985': true } — tracks which bodies the user has acknowledged
  const [opening, setOpening] = useState(null); // { film, result, openingGross, totalProjected } when a film opens
  const [viewedFilm, setViewedFilm] = useState(null); // a film in history whose chart we're viewing
  const [sequelOf, setSequelOf] = useState(null); // when making a sequel: { ...franchise, lastQuality, lastHit, lastBudget }
  const [pendingYearRecap, setPendingYearRecap] = useState(null); // { year } when a year rollover should show the recap modal
  const [pendingLifetimeAchievement, setPendingLifetimeAchievement] = useState(false); // one-time award when fame >= 85 + age >= 60

  // Awards season trigger — when in-game week enters an award body's window
  // and that year's awards for that body haven't been processed yet.
  useEffect(() => {
    // Find a body whose window we're in for the current year
    const currentYear = player.year;
    const currentWeek = player.week;
    for (const body of AWARD_BODIES) {
      const key = `${body.id}-${currentYear}`;
      if (
        currentWeek >= body.weekStart &&
        currentWeek <= body.weekEnd &&
        !shownAwardBodies[key]
      ) {
        triggerAwardCeremony(body, currentYear);
        // Mark so we don't re-trigger
        setShownAwardBodies(prev => ({ ...prev, [key]: true }));
        break; // One body at a time
      }
    }
    // eslint-disable-next-line
  }, [player.week, player.year]);

  // Lifetime Achievement Award — one-time, fires when fame >= 85 and age >= 60
  useEffect(() => {
    if (player.lifetimeAchievementYear) return; // already received
    if (player.fame >= 85 && player.age >= 60 && (player.history || []).length >= 10) {
      setPendingLifetimeAchievement(true);
    }
    // eslint-disable-next-line
  }, [player.fame, player.age]);

  // Comeback arc inactivity trigger — activates after 18 months (78 weeks) without a release,
  // but only if the player has at least 3 prior releases (otherwise they're just early-career)
  useEffect(() => {
    if (player.comebackState) return; // already active
    const films = player.history || [];
    if (films.length < 3) return; // need a real career to "come back" from
    // Find most recent release year+week
    const sortedFilms = [...films].sort((a, b) => {
      const ya = a.releaseYear || a.year || 0;
      const yb = b.releaseYear || b.year || 0;
      if (ya !== yb) return yb - ya;
      return (b.releaseWeek || 0) - (a.releaseWeek || 0);
    });
    const last = sortedFilms[0];
    const lastYear = last.releaseYear || last.year || player.year;
    const lastWeek = last.releaseWeek || 1;
    const weeksSince = (player.year - lastYear) * 52 + (player.week - lastWeek);
    if (weeksSince >= 78) {
      // Skip if there's an active production — they're already working
      if (production) return;
      setPlayer(p => ({
        ...p,
        comebackState: { reason: 'inactivity', sinceYear: p.year, sinceWeek: p.week, weeksSilent: weeksSince },
      }));
      addLog('Comeback', `⚠ It's been ${Math.floor(weeksSince / 52)}+ years since your last release. Hollywood has a short memory. Your next picture is a comeback.`);
    }
    // eslint-disable-next-line
  }, [player.week, player.year]);

  const triggerAwardCeremony = (body, year) => {
    // Films released in this year that are eligible
    // Films released in this year — both closed (history) and still playing
    const allReleased = [...player.history, ...(player.inTheaters || [])];
    const eligibleFilms = allReleased.filter(f => (f.releaseYear || f.year) === year);
    // If player has NO eligible films, skip this body silently (no ceremony to attend)
    if (eligibleFilms.length === 0) return;

    const bodyResults = runAwardBody(body, year, eligibleFilms, player.worldNPCs);
    // Evaluate craft awards using the same eligible films pool plus phantom competition
    // Pull phantom films from bodyResults so the craft pool matches
    const craftPool = [...eligibleFilms];
    for (const cat of Object.keys(bodyResults)) {
      for (const nom of bodyResults[cat].nominees) {
        if (nom.film?.isPhantom && !craftPool.includes(nom.film)) {
          craftPool.push(nom.film);
        }
      }
    }
    const craftWins = evaluateCraftAwards(body, craftPool, player.name);
    setAwardsSeason({ body, year, results: bodyResults, craftWins });
  };

  const closeAwardsCeremony = () => {
    if (!awardsSeason) return;
    const { body, year, results, craftWins = [] } = awardsSeason;
    // Extract player nominations/wins and apply rewards
    const playerEvents = extractPlayerAwards([{ body, results }], year);

    // Player-film craft wins (player directed) — small director reputation bumps
    const playerCraftWins = craftWins.filter(c => c.isPlayerFilm);

    // Identify rivalries: player was nominated but lost — find the winner's NPC
    const rivalryRecords = [];
    for (const cat in results) {
      const r = results[cat];
      if (!r) continue;
      const playerNom = r.nominees.find(n => n.isPlayerCredit);
      if (playerNom && !playerNom.isWinner && r.winner) {
        // The winner was a phantom; check if it links to a world NPC
        const winnerFilm = r.winner.film;
        if (winnerFilm?.isPhantom && winnerFilm.crew) {
          // Find the relevant NPC for this category role
          const catRole = cat.includes('actor') ? 'actor'
            : cat.includes('director') ? 'director'
            : cat.includes('writer') ? 'writer' : 'producer';
          const npcId = winnerFilm.crew[catRole]?.npcId;
          if (npcId) {
            rivalryRecords.push({ npcId, category: cat, body, year });
          }
        }
      }
    }

    if (playerEvents.length > 0 || rivalryRecords.length > 0 || playerCraftWins.length > 0) {
      setPlayer(p => {
        const newAwards = playerEvents.length > 0 ? {
          nominations: p.awards.nominations + playerEvents.length,
          wins: p.awards.wins + playerEvents.filter(e => e.won).length,
          history: [...p.awards.history, ...playerEvents],
        } : p.awards;

        // Apply rep/fame bonuses
        const newRep = { ...p.reputation };
        let fameGain = 0;
        for (const ev of playerEvents) {
          const role = ev.role;
          let repBump = Math.round(2 * ev.prestige);
          if (ev.won) repBump = Math.round(8 * ev.prestige);
          if (role && newRep[role] !== undefined) {
            newRep[role] = clamp(newRep[role] + repBump, -50, 100);
          }
          fameGain += ev.won ? Math.round(4 * ev.prestige) : Math.round(1 * ev.prestige);
        }

        // Craft wins on player-directed films: +1 director rep each, small fame trickle
        for (const cw of playerCraftWins) {
          newRep.director = clamp((newRep.director || 0) + 1, -50, 100);
          fameGain += Math.round(0.5 * body.prestige);
        }

        // Apply rivalry records to world NPCs
        let newWorldNPCs = p.worldNPCs || {};
        for (const r of rivalryRecords) {
          newWorldNPCs = recordNPCEvent(newWorldNPCs, r.npcId, 'rivalry_award', r.year, `won ${r.category} at ${r.body}`);
        }

        // Log the events
        const newLog = [...p.log];
        for (const ev of playerEvents) {
          newLog.push({
            label: ev.won ? 'Award Won' : 'Nomination',
            text: ev.won
              ? `Won ${ev.categoryLabel} at ${ev.body} for "${ev.film}"!`
              : `Nominated for ${ev.categoryLabel} at ${ev.body} for "${ev.film}".`,
            week: p.week,
            year: p.year,
          });
        }
        // Craft wins log entry — group by film
        const craftByFilm = {};
        for (const cw of playerCraftWins) {
          const t = cw.film.title;
          (craftByFilm[t] = craftByFilm[t] || []).push(cw.categoryLabel);
        }
        for (const title in craftByFilm) {
          const cats = craftByFilm[title];
          newLog.push({
            label: 'Craft Honors',
            text: `"${title}" won ${cats.length} below-the-line ${cats.length === 1 ? 'award' : 'awards'} at ${body.name}: ${cats.join(', ')}.`,
            week: p.week,
            year: p.year,
          });
        }

        const newFame = clamp(p.fame + fameGain, 0, 100);
        return {
          ...p,
          awards: newAwards,
          reputation: newRep,
          fame: newFame,
          peakFame: Math.max(p.peakFame || 0, newFame),
          worldNPCs: newWorldNPCs,
          log: newLog.slice(-60),
        };
      });
    }
    setAwardsSeason(null);
  };

  // Generate fresh listings when entering screen
  useEffect(() => {
    if (view === 'offers' && listings.length === 0) {
      refreshListings();
    }
    // eslint-disable-next-line
  }, [view]);

  const refreshListings = () => {
    const buffs = ownedBuffs(player);
    // Number depends on overall heat. Unknowns still have plenty of audition postings.
    const totalRep = ROLES.reduce((s, r) => s + Math.max(0, player.reputation[r]), 0);
    const overallHeat = player.fame + totalRep / 2;
    const baseCount = clamp(3 + Math.floor(overallHeat / 25), 3, 6);
    const count = baseCount + buffs.offerCountBonus;

    // Weighted pick — biased toward player's strongest roles, but always
    // include at least the starting role if everything is low.
    const roleWeights = ROLES.map(r => ({ r, w: Math.max(2, player.skills[r] + player.reputation[r]) }));
    const list = [];
    for (let i = 0; i < count; i++) {
      const total = roleWeights.reduce((s, x) => s + x.w, 0);
      let pickV = Math.random() * total;
      let chosen = roleWeights[0].r;
      for (const rw of roleWeights) {
        pickV -= rw.w;
        if (pickV <= 0) { chosen = rw.r; break; }
      }
      // Decide: offer or audition? Agent bumps offer probability. Power couple status and scandals modulate it too.
      const personalMod = personalBuffs(player).offerProbBonus;
      let offerP = clamp(offerProbability(player, chosen) + buffs.offerProbabilityBonus + personalMod, 0, 0.95);
      const project = Math.random() < offerP
        ? generateOffer(player, chosen)
        : generateAudition(player, chosen);

      // Genre specialty: if the project's genre matches a specialty, bump
      // it from audition → offer when possible (specialists get offered things)
      const specEffects = genreSpecialtyEffects(player, project.genre);
      if (specEffects.offerProb > 0 && project.kind === 'audition' && Math.random() < specEffects.offerProb) {
        // Re-roll as offer
        const replaced = generateOffer(player, chosen);
        replaced.genre = project.genre; // preserve the matched genre
        replaced.title = project.title;
        Object.assign(project, replaced, { kind: 'offer' });
      }

      // Agent budget bonus: bump the project's budget and pay
      if (buffs.offerBudgetBonus > 0) {
        project.budget = Math.round(project.budget * (1 + buffs.offerBudgetBonus));
        project.pay = Math.round(project.pay * (1 + buffs.offerBudgetBonus));
      }
      list.push(project);
    }

    // Specialty bonus listings: for each specialty (Working In / Specialist / Icon),
    // add one extra listing in that genre. Stronger tier = better project.
    const specs = allSpecialties(player);
    for (const spec of specs) {
      // Pick a role weighted as before
      const roleWeights = ROLES.map(r => ({ r, w: Math.max(2, player.skills[r] + player.reputation[r]) }));
      const total = roleWeights.reduce((s, x) => s + x.w, 0);
      let pickV = Math.random() * total;
      let chosen = roleWeights[0].r;
      for (const rw of roleWeights) {
        pickV -= rw.w;
        if (pickV <= 0) { chosen = rw.r; break; }
      }
      // Genre-specific listings are usually offers (you're known for this)
      const isOffer = Math.random() < 0.65 + (spec.tier.label === 'Icon' ? 0.25 : spec.tier.label === 'Specialist' ? 0.10 : 0);
      const project = isOffer ? generateOffer(player, chosen) : generateAudition(player, chosen);
      project.genre = spec.genre;
      project.title = generateTitle(spec.genre);
      project.specialtyOffer = true; // tag so UI can highlight
      list.push(project);
    }

    setListings(list);
  };

  const addLog = (label, text) => {
    setPlayer(p => ({
      ...p,
      log: [...p.log, { label, text, week: p.week, year: p.year }].slice(-60),
    }));
  };

  // Advance one week (time passes)
  const advanceWeek = (weeks = 1) => {
    // Compute burnout state ahead of the setPlayer so we can act on it
    // (we know whether the player WAS already burnt out coming into this tick)
    const wasBurntOut = (player.burnoutWeeks || 0) >= 2;
    if (wasBurntOut && production) {
      // Burnout penalty on active production: -3 qualityMod per week tick
      setProduction(prod => {
        if (!prod) return prod;
        return {
          ...prod,
          mods: { ...prod.mods, qualityMod: prod.mods.qualityMod - 3 * weeks },
        };
      });
    }

    setPlayer(p => {
      const buffs = ownedBuffs(p);
      const pBuffs = personalBuffs(p);
      const upkeep = totalWeeklyUpkeep(p) + childUpkeep(p);

      let newWeek = p.week + weeks;
      let newYear = p.year;
      let newAge = p.age;
      while (newWeek > 52) {
        newWeek -= 52;
        newYear += 1;
        newAge += 1;
      }

      // Total cost of upkeep for this advance
      const upkeepCost = upkeep * weeks;
      const newCash = p.cash - upkeepCost;

      // Passive fame from lifestyle items + personal life modifiers (power couple, scandals)
      let fameGain = (buffs.fameWeekly + pBuffs.fameWeekly) * weeks;

      // Inactivity decay: if no film is in theaters, no production active, and no film
      // released in the past 26 weeks, fame drifts down. Hollywood forgets fast.
      const hasInTheaters = (p.inTheaters || []).length > 0;
      const hasActiveProduction = !!p.activeProduction;
      const lastReleaseWeeks = (() => {
        if ((p.history || []).length === 0) return Infinity;
        const lastFilm = p.history[p.history.length - 1];
        const ly = lastFilm.releaseYear || lastFilm.year || p.year;
        // Approximate: assume mid-year release if no week stored
        return (p.year - ly) * 52 + p.week;
      })();
      const isInactive = !hasInTheaters && !hasActiveProduction && lastReleaseWeeks > 26;
      if (isInactive) {
        // -0.3 fame/week, scaled by how high above 0 they are (high fame falls faster)
        const decayRate = 0.3 * (1 + p.fame / 200);
        fameGain -= decayRate * weeks;
      }

      // Lifetime Achievement holders have a permanent fame floor of 60
      const fameFloor = p.lifetimeAchievementYear ? 60 : 0;
      const newFame = clamp(p.fame + fameGain, fameFloor, 100);

      // Energy regen — base 15/week + any bonus from items - kid drain
      const energyRegen = (15 + buffs.energyRegenBonus - pBuffs.energyDrain) * weeks;
      const newEnergy = clamp(p.energy + energyRegen, 0, 100);

      // ---- Burnout tracking ----
      // If energy < 20, accumulate burnoutWeeks. Once burnoutWeeks >= 2, the player is "burnt out":
      // -3 quality mod per week applied to any active production, +chance of an exhaustion tabloid.
      // burnoutWeeks resets to 0 when energy >= 50.
      let burnoutWeeks = p.burnoutWeeks || 0;
      if (newEnergy < 20) {
        burnoutWeeks += weeks;
      } else if (newEnergy >= 50) {
        burnoutWeeks = 0;
      }
      const isBurntOut = burnoutWeeks >= 2;

      // Passive skill growth from coaches — every 4 weeks, +1 to coached skills
      const newSkills = { ...p.skills };
      for (const role of buffs.passiveSkills) {
        const triggers = Math.floor((p.week + weeks) / 4) - Math.floor(p.week / 4);
        if (triggers > 0 && newSkills[role] < 100) {
          newSkills[role] = clamp(newSkills[role] + triggers, 1, 100);
        }
      }

      // ---- Personal life decay & age scandals ----
      const personal = { ...p.personal };
      // Relationship health decays slightly if married, recovers slightly if energy is high
      if (personal.status === 'married' || personal.status === 'dating' || personal.status === 'engaged') {
        let healthDelta = -0.5 * weeks; // small natural decay
        // High energy = more attention paid
        if (p.energy > 70) healthDelta += 0.3 * weeks;
        if (p.energy < 30) healthDelta -= 0.5 * weeks; // burnt out = neglect
        personal.relationshipHealth = clamp((personal.relationshipHealth ?? 100) + healthDelta, 0, 100);
      }

      // Age active scandals — expire if past their window
      let remainingScandals = [];
      for (const s of (p.scandals || [])) {
        const totalWeeksSince = (newYear - s.started.year) * 52 + (newWeek - s.started.week);
        if (totalWeeksSince < s.weeks) {
          remainingScandals.push(s);
        }
      }

      // World NPC annual tick — when the year rolls over, age and progress NPCs
      let newWorldNPCs = p.worldNPCs || {};
      let newLastNPCTickYear = p.lastNPCTickYear || newYear;
      while (newLastNPCTickYear < newYear) {
        newLastNPCTickYear += 1;
        newWorldNPCs = tickWorldNPCs(newWorldNPCs, newLastNPCTickYear);
        newWorldNPCs = maintainWorldPool(newWorldNPCs, newLastNPCTickYear);
      }

      // ---- Studio reserves interest ----
      // 0.4% per 4-week month = ~5.2% annualized. Accrues weekly at 0.1%.
      let newStudio = p.studio;
      if (newStudio && (newStudio.reserves || 0) > 0) {
        const weeklyRate = 0.001; // 0.1% per week
        const interestThisAdvance = Math.round((newStudio.reserves || 0) * weeklyRate * weeks);
        if (interestThisAdvance > 0) {
          newStudio = { ...newStudio, reserves: (newStudio.reserves || 0) + interestThisAdvance };
        }
      }

      return {
        ...p,
        week: newWeek,
        year: newYear,
        age: newAge,
        cash: newCash,
        fame: newFame,
        peakFame: Math.max(p.peakFame || 0, newFame),
        energy: newEnergy,
        skills: newSkills,
        personal,
        scandals: remainingScandals,
        worldNPCs: newWorldNPCs,
        lastNPCTickYear: newLastNPCTickYear,
        burnoutWeeks,
        studio: newStudio,
      };
    });

    // If player became newly burnt out this tick, log it
    if (!wasBurntOut && (player.burnoutWeeks || 0) < 2 && player.energy < 20) {
      // Will likely flip to burnt out — soft warning
    }

    // Tick any in-theaters films forward (separate setPlayer for clarity)
    tickInTheaters(weeks);

    // Tabloid event chance — rolled per week tick
    maybeTriggerTabloid(weeks);

    // Year rollover detection — if this advance crossed at least one year boundary,
    // queue up a Year in Variety recap for the year that just ended
    // (Use a small timeout so the recap doesn't compete with the same-tick film release)
    const oldYear = player.year;
    const oldWeek = player.week;
    const totalNewWeek = oldWeek + weeks;
    if (totalNewWeek > 52) {
      const yearJustEnded = oldYear;
      setTimeout(() => setPendingYearRecap({ year: yearJustEnded }), 100);
    }

    // Cameo offer generation — friends occasionally invite player for a quick on-screen visit
    maybeGenerateCameoOffer(weeks);

    // Franchise acquisition offers — major studios may bid for dormant franchises
    maybeGenerateFranchiseOffer(weeks);

    // First-look deals — generate pitches from NPC directors under retainer
    maybeGenerateFirstLookPitch(weeks);

    // Co-producing offers — other studios pitch you producer-on-hire roles
    maybeGenerateCoProducingOffer(weeks);
  };

  // Generate cameo offers from friend NPCs.
  // Conditions: player has friend NPCs (friendshipScore >= 3), not in production,
  // not too many pending offers already (cap at 3), small per-week chance.
  const maybeGenerateCameoOffer = (weeks) => {
    setPlayer(p => {
      // Clean up expired offers first (expire after 4 weeks)
      const fresh = (p.cameoOffers || []).filter(o => {
        const ageWeeks = (p.year - o.year) * 52 + (p.week - o.week);
        return ageWeeks < 4;
      });
      if (fresh.length >= 3) return { ...p, cameoOffers: fresh }; // cap reached
      if (production) return { ...p, cameoOffers: fresh }; // no offers during production
      // Find friends
      const friends = Object.values(p.worldNPCs || {}).filter(npc =>
        (npc.friendshipScore || 0) >= 3 && !npc.retired
      );
      if (friends.length === 0) return { ...p, cameoOffers: fresh };
      // Roll for offer — ~3% per week scaled by friend count
      const offerChance = Math.min(0.12, 0.03 * friends.length) * weeks;
      if (Math.random() > offerChance) return { ...p, cameoOffers: fresh };
      // Pick a friend
      const friend = pick(friends);
      // Avoid duplicate offers from the same friend
      if (fresh.some(o => o.npcId === friend.id)) return { ...p, cameoOffers: fresh };
      // Build the offer
      const filmGenres = ['Drama', 'Comedy', 'Action', 'Thriller', 'Romance'];
      const offer = {
        id: `cameo-${p.year}-${p.week}-${friend.id}`,
        npcId: friend.id,
        npcName: friend.name,
        npcArchetype: friend.archetype,
        filmTitle: generateTitle(pick(filmGenres)),
        filmGenre: pick(filmGenres),
        year: p.year,
        week: p.week,
      };
      return { ...p, cameoOffers: [...fresh, offer] };
    });
  };

  // Accept a cameo offer — small fame + friendship bumps, 1 week passes
  const acceptCameo = (offer) => {
    setPlayer(p => {
      let newNPCs = { ...p.worldNPCs };
      if (newNPCs[offer.npcId]) {
        const npc = { ...newNPCs[offer.npcId] };
        npc.friendshipScore = (npc.friendshipScore || 0) + 1;
        newNPCs[offer.npcId] = npc;
      }
      return {
        ...p,
        cameoOffers: p.cameoOffers.filter(o => o.id !== offer.id),
        fame: clamp(p.fame + 2, 0, 100),
        worldNPCs: newNPCs,
      };
    });
    addLog('Career', `🎬 Did a cameo for ${offer.npcName} in "${offer.filmTitle}". A one-day shoot. Good for both of you.`);
    advanceWeek(1);
  };

  // Decline a cameo offer — slight friendship cost
  const declineCameo = (offer) => {
    setPlayer(p => {
      let newNPCs = { ...p.worldNPCs };
      if (newNPCs[offer.npcId]) {
        const npc = { ...newNPCs[offer.npcId] };
        npc.friendshipScore = Math.max(0, (npc.friendshipScore || 0) - 0.5);
        newNPCs[offer.npcId] = npc;
      }
      return {
        ...p,
        cameoOffers: p.cameoOffers.filter(o => o.id !== offer.id),
        worldNPCs: newNPCs,
      };
    });
    addLog('Career', `Passed on ${offer.npcName}'s cameo offer. They understood. Mostly.`);
  };

  // Studio names that might acquire a franchise (era-appropriate, fictional)
  const ACQUIRING_STUDIO_NAMES = [
    'Crescent Pictures', 'Beacon Hill Films', 'Northbrook Studios',
    'Trans-Coastal', 'Vanguard Pictures', 'Meridian Films',
    'Apex Entertainment', 'Continental Pictures', 'Renaissance Studios',
  ];

  // Generate franchise acquisition offers.
  // Conditions: franchise dormant 5+ years, had at least one hit OR avg quality >= 60,
  // and player owns at least one such franchise. Cap pending offers at 2.
  const maybeGenerateFranchiseOffer = (weeks) => {
    setPlayer(p => {
      // Clean up expired offers (8 weeks to decide)
      const fresh = (p.franchiseAcquisitionOffers || []).filter(o => {
        const ageWeeks = (p.year - o.year) * 52 + (p.week - o.week);
        return ageWeeks < 8;
      });
      if (fresh.length >= 2) return { ...p, franchiseAcquisitionOffers: fresh };

      // Find eligible franchises
      const franchises = Object.values(p.franchises || {});
      const eligible = franchises.filter(f => {
        if (!f.entries || f.entries.length === 0) return false;
        // Skip if already pending an offer
        if (fresh.some(o => o.franchiseTitle === f.title)) return false;
        // Dormant — last entry must be 5+ years old
        const lastYear = Math.max(...f.entries.map(e => e.year || 0));
        if (p.year - lastYear < 5) return false;
        // Had at least one hit OR average quality >= 60
        const hits = f.entries.filter(e => e.hit).length;
        const avgQ = f.entries.reduce((s, e) => s + (e.quality || 0), 0) / f.entries.length;
        return hits >= 1 || avgQ >= 60;
      });

      if (eligible.length === 0) return { ...p, franchiseAcquisitionOffers: fresh };

      // Roll for offer — ~1.5% per week per eligible franchise, capped
      const offerChance = Math.min(0.06, 0.015 * eligible.length) * weeks;
      if (Math.random() > offerChance) return { ...p, franchiseAcquisitionOffers: fresh };

      // Pick one
      const franchise = pick(eligible);
      // Calculate offer amount: based on past success
      const totalGross = franchise.entries.reduce((s, e) => s + (e.boxOffice || 0), 0);
      const hits = franchise.entries.filter(e => e.hit).length;
      const yearsDormant = p.year - Math.max(...franchise.entries.map(e => e.year || 0));
      // Base: 30% of total gross, dampened by dormancy
      let offerAmount = Math.round(totalGross * 0.30 * Math.pow(0.92, yearsDormant - 5));
      // Hit bonus
      offerAmount += hits * 500_000;
      // Round to a clean number
      offerAmount = Math.max(500_000, Math.round(offerAmount / 100_000) * 100_000);

      const offer = {
        id: `acq-${p.year}-${p.week}-${franchise.title.replace(/\s/g, '')}`,
        franchiseTitle: franchise.title,
        franchiseGenre: franchise.genre,
        entries: franchise.entries.length,
        hits,
        amount: offerAmount,
        studio: pick(ACQUIRING_STUDIO_NAMES),
        year: p.year,
        week: p.week,
        yearsDormant,
      };
      return { ...p, franchiseAcquisitionOffers: [...fresh, offer] };
    });
  };

  // Accept a franchise acquisition — lump sum, franchise leaves roster
  const acceptFranchiseSale = (offer) => {
    setPlayer(p => {
      const newFranchises = { ...p.franchises };
      // Find franchise key
      const key = Object.keys(newFranchises).find(k => newFranchises[k].title === offer.franchiseTitle);
      let soldFranchise = null;
      if (key) {
        soldFranchise = {
          ...newFranchises[key],
          soldTo: offer.studio,
          soldYear: p.year,
          soldAmount: offer.amount,
        };
        delete newFranchises[key];
      }
      return {
        ...p,
        cash: p.cash + offer.amount,
        franchises: newFranchises,
        franchiseAcquisitionOffers: p.franchiseAcquisitionOffers.filter(o => o.id !== offer.id),
        soldFranchises: soldFranchise ? [...(p.soldFranchises || []), soldFranchise] : (p.soldFranchises || []),
      };
    });
    addLog('Business', `💰 Sold the "${offer.franchiseTitle}" franchise to ${offer.studio} for ${fmtMoney(offer.amount)}. Rights are transferred.`);
  };

  // Decline a franchise offer
  const declineFranchiseSale = (offer) => {
    setPlayer(p => ({
      ...p,
      franchiseAcquisitionOffers: p.franchiseAcquisitionOffers.filter(o => o.id !== offer.id),
    }));
    addLog('Business', `Turned down ${offer.studio}'s offer for "${offer.franchiseTitle}". You'll hold on to the rights.`);
  };

  // Begin a Director's Cut re-release on an old film.
  // Costs money + 4 weeks. Generates a box office bump, small fame boost,
  // and tags the film with a directorsCut entry so it can't be re-released again.
  const beginDirectorsCut = (film) => {
    const cost = Math.min(2_000_000, Math.max(100_000, Math.round(film.budget * 0.05)));
    if (player.cash < cost) return;
    // Compute bump: 5-15% of original gross, weighted by quality
    const qualityMod = (film.result?.quality || 50) / 100; // 0-1
    const baseBump = (film.result?.boxOffice || 0) * (0.05 + Math.random() * 0.10);
    const bump = Math.round(baseBump * (0.7 + qualityMod * 0.6)); // higher quality → larger bump
    // Fame boost: based on quality of the film
    const fameBoost = Math.max(1, Math.round((film.result?.quality || 50) / 25));

    setPlayer(p => {
      // Find the film in history and tag it
      const newHistory = (p.history || []).map(f => {
        if (f.title === film.title && (f.releaseYear || f.year) === (film.releaseYear || film.year)) {
          return {
            ...f,
            directorsCut: { year: p.year, bump, cost },
            // Increase lifetime box office tracked on the film
            result: { ...f.result, boxOffice: (f.result?.boxOffice || 0) + bump },
          };
        }
        return f;
      });
      return {
        ...p,
        cash: p.cash - cost + bump, // cost paid, then bump returned over the re-release window
        history: newHistory,
        fame: clamp(p.fame + fameBoost, 0, 100),
        reputation: {
          ...p.reputation,
          director: clamp((p.reputation.director || 0) + 2, -50, 100),
        },
        lifetimeEarnings: (p.lifetimeEarnings || 0) + bump,
      };
    });
    addLog('Release', `Re-released "${film.title}" as a Director's Cut. Added ${fmtMoney(bump)} to the gross. The critics took another look — kinder, this time.`);
    advanceWeek(4);
    setViewedFilm(null); // close the modal
  };

  // ===== First-Look Deals =====
  // Calculate the annual retainer cost for a first-look deal with an NPC director.
  // Based on the NPC's fame and skill — bigger names cost more.
  const firstLookRetainer = (npc) => {
    if (!npc) return 0;
    const base = 200_000;
    const fameMultiplier = 1 + (npc.fame || 0) / 60; // up to ~2.7x for fame 100
    const skillMultiplier = 1 + ((npc.skill || 50) - 50) / 100; // up to 1.5x for skill 100
    return Math.round(base * fameMultiplier * skillMultiplier / 25_000) * 25_000;
  };

  // Sign a first-look deal with an NPC director.
  const signFirstLookDeal = (npc) => {
    if (!npc || npc.role !== 'director') return;
    const cost = firstLookRetainer(npc);
    if (player.cash < cost) return;
    // Don't duplicate deals
    if ((player.firstLookDeals || []).some(d => d.npcId === npc.id)) return;
    setPlayer(p => ({
      ...p,
      cash: p.cash - cost,
      firstLookDeals: [
        ...(p.firstLookDeals || []),
        {
          id: `flk-${npc.id}-${p.year}`,
          npcId: npc.id,
          npcName: npc.name,
          startedYear: p.year,
          retainerPaid: cost,
          expiresYear: p.year + 1,
          lastPitchYear: null,
          lastPitchWeek: null,
          totalPaid: cost,
        },
      ],
    }));
    addLog('Business', `📜 Signed a first-look deal with ${npc.name} for ${fmtMoney(cost)}/year. Their next pitch comes to you first.`);
  };

  // Cancel a first-look deal at expiry. Saves the annual retainer going forward.
  const cancelFirstLookDeal = (dealId) => {
    setPlayer(p => ({
      ...p,
      firstLookDeals: (p.firstLookDeals || []).filter(d => d.id !== dealId),
    }));
    addLog('Business', `Cancelled a first-look deal. The agreement won't auto-renew.`);
  };

  // Develop a pitch — turns it into a project that goes through greenlight.
  // The NPC director is locked in as director; player retains producer role and chooses other crew.
  const developFirstLookPitch = (pitch) => {
    // Remove the pitch
    setPlayer(p => ({
      ...p,
      firstLookPitches: (p.firstLookPitches || []).filter(x => x.id !== pitch.id),
    }));
    const npc = player.worldNPCs?.[pitch.npcId];
    if (!npc) return;
    // Build an offer-like object so the greenlight view treats this like an outside studio offer
    // where the player is the producer and the NPC director is pre-attached.
    setActiveOffer({
      isFirstLookPitch: true,
      title: pitch.workingTitle,
      genre: pitch.genre,
      playerRole: 'producer', // player is producer; locked
      // NPC director pre-attached — greenlight reads npcDirector when offer is present
      npcDirector: {
        npcId: npc.id,
        name: npc.name,
        skill: npc.skill,
        rep: npc.rep || 0,
        archetype: npc.archetype,
      },
      // Other crew unattached — player chooses or default fills
      npcActor: null,
      npcProducer: null,
      npcWriter: null,
      budget: pitch.suggestedBudget,
      pitchPremise: pitch.premise,
      origin: 'first-look',
    });
    addLog('Business', `Developing ${npc.name}'s pitch "${pitch.workingTitle}". You'll produce; they direct.`);
    setView('newproj');
  };

  const passFirstLookPitch = (pitch) => {
    setPlayer(p => {
      // Slight friendship hit
      let newNPCs = { ...p.worldNPCs };
      if (newNPCs[pitch.npcId]) {
        const npc = { ...newNPCs[pitch.npcId] };
        npc.friendshipScore = Math.max(0, (npc.friendshipScore || 0) - 0.3);
        newNPCs[pitch.npcId] = npc;
      }
      return {
        ...p,
        firstLookPitches: (p.firstLookPitches || []).filter(x => x.id !== pitch.id),
        worldNPCs: newNPCs,
      };
    });
    addLog('Business', `Passed on ${pitch.npcName}'s pitch "${pitch.workingTitle}". They'll shop it elsewhere.`);
  };

  // Premise templates for first-look pitches — short, era-appropriate
  const FIRST_LOOK_PREMISES = {
    Drama: ['A father and son reckon with old wounds on a long drive.', 'A small-town doctor confronts a buried scandal.', 'Two estranged siblings inherit a failing family business.'],
    Comedy: ['A divorce lawyer falls for his client\'s ex.', 'A cynical journalist gets assigned to cover a wedding.', 'A failed athlete coaches a hopeless youth team.'],
    Action: ['A retired soldier is pulled back in for one last job.', 'A getaway driver becomes the target of his own crew.', 'A detective tracks a killer across three cities.'],
    Thriller: ['A psychiatrist suspects her own patient.', 'A whistleblower discovers her sources are being killed.', 'A jury foreman uncovers something nobody wants found.'],
    Horror: ['A college quartet finds an old reel they shouldn\'t have.', 'A small town wakes up to an unspeakable absence.', 'A grieving family moves into a house with history.'],
    Romance: ['Two rival journalists assigned to the same story.', 'A widower meets the woman who raised his late wife.', 'A wedding planner falls for the groom\'s best man.'],
    'Sci-Fi': ['First contact arrives — politely, and on the wrong continent.', 'A scientist discovers she\'s been speaking to her future self.', 'A colony ship\'s captain learns the destination doesn\'t exist.'],
    Western: ['A retired marshal returns to track an old enemy.', 'A widow defends her ranch against a railroad baron.', 'Two outlaws plan one final score.'],
  };

  // Roll for first-look pitches — once per ~12-18 weeks per active deal
  const maybeGenerateFirstLookPitch = (weeks) => {
    setPlayer(p => {
      const deals = p.firstLookDeals || [];
      if (deals.length === 0) return p;
      // Cap total pending pitches at 3
      if ((p.firstLookPitches || []).length >= 3) return p;
      // Also expire deals whose year has passed
      const currentYear = p.year;
      const expired = deals.filter(d => currentYear > d.expiresYear);
      const active = deals.filter(d => currentYear <= d.expiresYear);
      // Auto-renew check — for each deal at expiration, charge retainer
      let cashDelta = 0;
      let logEntries = [];
      const renewedDeals = active.map(d => {
        if (d.expiresYear === currentYear && d.lastRenewalYear !== currentYear) {
          // Compute current retainer (NPC may have moved up/down)
          const npc = p.worldNPCs?.[d.npcId];
          if (!npc || npc.retired) {
            // NPC unavailable — let deal lapse
            return null;
          }
          const renewCost = firstLookRetainer(npc);
          if (p.cash + cashDelta >= renewCost) {
            cashDelta -= renewCost;
            logEntries.push(`📜 Renewed first-look with ${npc.name} for ${fmtMoney(renewCost)}.`);
            return {
              ...d,
              expiresYear: currentYear + 1,
              totalPaid: (d.totalPaid || 0) + renewCost,
              lastRenewalYear: currentYear,
            };
          } else {
            logEntries.push(`⚠ Couldn't renew first-look with ${npc.name} — insufficient cash. Deal lapses.`);
            return null;
          }
        }
        return d;
      }).filter(Boolean);

      // Generate pitches for active deals
      const newPitches = [...(p.firstLookPitches || [])];
      for (const deal of renewedDeals) {
        if (newPitches.length >= 3) break;
        // Skip if there's already a pending pitch from this deal
        if (newPitches.some(pi => pi.dealId === deal.id)) continue;
        // Roll for pitch — ~5% per week
        const chance = 0.05 * weeks;
        if (Math.random() > chance) continue;
        const npc = p.worldNPCs?.[deal.npcId];
        if (!npc || npc.retired) continue;
        const genres = Object.keys(FIRST_LOOK_PREMISES);
        const genre = pick(genres);
        // Suggested budget based on NPC fame/skill
        const baseBudget = 5_000_000 + (npc.fame || 0) * 200_000 + ((npc.skill || 50) - 50) * 100_000;
        const suggestedBudget = Math.max(2_000_000, Math.round(baseBudget / 1_000_000) * 1_000_000);
        newPitches.push({
          id: `pitch-${deal.id}-${p.year}-${p.week}`,
          dealId: deal.id,
          npcId: deal.npcId,
          npcName: deal.npcName,
          genre,
          workingTitle: generateTitle(genre),
          premise: pick(FIRST_LOOK_PREMISES[genre]),
          suggestedBudget,
          year: p.year,
          week: p.week,
        });
      }
      // Log entries from renewals
      const newLog = [...p.log];
      for (const text of logEntries) {
        newLog.push({ label: 'Business', text, week: p.week, year: p.year });
      }
      return {
        ...p,
        cash: p.cash + cashDelta,
        firstLookDeals: renewedDeals,
        firstLookPitches: newPitches,
        log: newLog.slice(-60),
      };
    });
  };

  // ===== Mentorship =====
  // Player can take an up-and-coming NPC under their wing.
  // Eligibility: player fame >= 60, age >= 45, history >= 5 films.
  // Mentee eligibility: age 22-32, fame <= 25, not retired, rising trajectory.
  // Up to 2 active mentorships at once. Each ends when mentee reaches fame 60
  // ("graduated") or 5 years pass with no graduation ("aged out").
  const canMentor = (player.fame >= 60) && (player.age >= 45) && ((player.history || []).length >= 5);
  const isMenteeEligible = (npc) => {
    if (!npc || npc.retired) return false;
    if (npc.age < 22 || npc.age > 32) return false;
    if (npc.fame > 25) return false;
    if ((npc.trajectory || 0) < 0) return false; // declining NPCs aren't a fit
    return true;
  };

  const startMentorship = (npc) => {
    if (!canMentor || !isMenteeEligible(npc)) return;
    const active = (player.mentorships || []).filter(m => !m.endedYear);
    if (active.length >= 2) return; // cap reached
    // Don't duplicate
    if (active.some(m => m.menteeNpcId === npc.id)) return;
    setPlayer(p => ({
      ...p,
      mentorships: [
        ...(p.mentorships || []),
        {
          id: `mentor-${npc.id}-${p.year}`,
          menteeNpcId: npc.id,
          menteeName: npc.name,
          menteeRole: npc.role,
          startedYear: p.year,
          startedWeek: p.week,
          sessionsThisYear: 0,
          totalSessions: 0,
          sessionsByYear: { [p.year]: 0 },
          endedYear: null,
          outcome: null, // 'graduated' | 'aged_out'
        },
      ],
    }));
    addLog('Career', `🧑‍🏫 Took ${npc.name} under your wing. They could be something — with guidance.`);
  };

  // Investing a "session" — 1 week of your time, +1 skill in mentee's specialty,
  // +0.5 friendship, modest player rep gain in that role.
  // Capped at 5 sessions/year per mentee.
  const investMentorshipSession = (mentorshipId) => {
    const mentorship = (player.mentorships || []).find(m => m.id === mentorshipId);
    if (!mentorship || mentorship.endedYear) return;
    const currentYearSessions = (mentorship.sessionsByYear || {})[player.year] || 0;
    if (currentYearSessions >= 5) return; // yearly cap
    const npc = player.worldNPCs?.[mentorship.menteeNpcId];
    if (!npc || npc.retired) return;

    setPlayer(p => {
      // Update the mentorship record
      const updatedMentorships = (p.mentorships || []).map(m => {
        if (m.id !== mentorshipId) return m;
        const yr = p.year;
        const sbY = { ...(m.sessionsByYear || {}) };
        sbY[yr] = (sbY[yr] || 0) + 1;
        return {
          ...m,
          totalSessions: (m.totalSessions || 0) + 1,
          sessionsByYear: sbY,
        };
      });

      // Update the NPC: +1 skill, +0.5 friendship, +0.5 fame (small boost)
      const newNPCs = { ...p.worldNPCs };
      if (newNPCs[mentorship.menteeNpcId]) {
        const npcCopy = { ...newNPCs[mentorship.menteeNpcId] };
        npcCopy.skill = clamp((npcCopy.skill || 50) + 1, 1, 100);
        npcCopy.fame = clamp((npcCopy.fame || 0) + 0.5, 0, 100);
        npcCopy.friendshipScore = (npcCopy.friendshipScore || 0) + 0.5;
        npcCopy.trajectory = Math.max((npcCopy.trajectory || 0), 1); // mentees always trend up
        // Mentor credit in their history
        if (!npcCopy.mentoredBy || npcCopy.mentoredBy.year !== mentorship.startedYear) {
          npcCopy.mentoredBy = { name: p.name, year: mentorship.startedYear };
        }
        newNPCs[mentorship.menteeNpcId] = npcCopy;
      }

      // Small player rep gain in the mentee's role (you're "the kind of pro who develops talent")
      const newRep = { ...p.reputation };
      if (mentorship.menteeRole && newRep[mentorship.menteeRole] !== undefined) {
        newRep[mentorship.menteeRole] = clamp(newRep[mentorship.menteeRole] + 0.5, -50, 100);
      }

      return {
        ...p,
        mentorships: updatedMentorships,
        worldNPCs: newNPCs,
        reputation: newRep,
      };
    });
    addLog('Career', `Spent a week with ${mentorship.menteeName}. Notes on craft, war stories, a few hard truths.`);
    advanceWeek(1);
  };

  // End a mentorship — either explicit (player walks away) or implicit (graduation/age out)
  const endMentorship = (mentorshipId, outcome) => {
    const m = (player.mentorships || []).find(mm => mm.id === mentorshipId);
    if (!m || m.endedYear) return;
    setPlayer(p => {
      const updated = (p.mentorships || []).map(mm => {
        if (mm.id !== mentorshipId) return mm;
        return { ...mm, endedYear: p.year, outcome };
      });
      // If graduated, add to alumni and lock friendship floor on the NPC
      let newAlumni = p.mentoredAlumni || [];
      let newNPCs = p.worldNPCs || {};
      if (outcome === 'graduated' && !newAlumni.some(a => a.menteeNpcId === m.menteeNpcId)) {
        newAlumni = [...newAlumni, {
          menteeNpcId: m.menteeNpcId,
          menteeName: m.menteeName,
          menteeRole: m.menteeRole,
          startedYear: m.startedYear,
          graduatedYear: p.year,
          totalSessions: m.totalSessions || 0,
        }];
        // Friendship floor for graduated mentees
        if (newNPCs[m.menteeNpcId]) {
          const npc = { ...newNPCs[m.menteeNpcId] };
          npc.friendshipScore = Math.max(npc.friendshipScore || 0, 5);
          newNPCs = { ...newNPCs, [m.menteeNpcId]: npc };
        }
      }
      return { ...p, mentorships: updated, mentoredAlumni: newAlumni, worldNPCs: newNPCs };
    });
    if (outcome === 'graduated') {
      addLog('Career', `🎓 ${m.menteeName} graduated. They're "made" in this town now — and they'll never forget you taught them how.`);
    } else if (outcome === 'aged_out') {
      addLog('Career', `${m.menteeName} aged out of mentorship. Whatever you taught them, they have it now.`);
    } else {
      addLog('Career', `Stepped back from mentoring ${m.menteeName}. They'll find their own way.`);
    }
  };

  // Check active mentorships each year for graduation or age-out
  useEffect(() => {
    const active = (player.mentorships || []).filter(m => !m.endedYear);
    for (const m of active) {
      const npc = player.worldNPCs?.[m.menteeNpcId];
      if (!npc || npc.retired) {
        endMentorship(m.id, 'aged_out');
        continue;
      }
      // Graduate if mentee reached fame 60
      if (npc.fame >= 60) {
        endMentorship(m.id, 'graduated');
        continue;
      }
      // Age out after 5 years
      if (player.year - m.startedYear >= 5) {
        endMentorship(m.id, 'aged_out');
      }
    }
    // eslint-disable-next-line
  }, [player.year]);

  // ===== Producer-on-Hire =====
  // Other studios pitch you co-producing roles. Your capital, their production.
  // Hits make you money; flops cost you the commitment.
  const CO_PRODUCING_STUDIOS = [
    'Crescent Pictures', 'Beacon Hill Films', 'Northbrook Studios',
    'Trans-Coastal', 'Vanguard Pictures', 'Meridian Films',
    'Apex Entertainment', 'Continental Pictures', 'Renaissance Studios',
  ];
  const CO_PRODUCING_PREMISES = {
    Drama: ['A multi-generational saga.', 'A small story with big feelings.', 'A character study set against history.'],
    Comedy: ['An ensemble piece about modern life.', 'A road movie with a sharp edge.', 'A workplace comedy that bites.'],
    Action: ['A spy thriller with international scope.', 'A heist with elaborate set pieces.', 'A revenge story that escalates.'],
    Thriller: ['A paranoid conspiracy unfolds in a quiet town.', 'A cat-and-mouse pursuit across decades.', 'A puzzle-box mystery.'],
    Horror: ['A slow-burn psychological piece.', 'A creature feature with practical effects.', 'A haunted-house riff with a twist.'],
    Romance: ['A meet-cute set in the wrong era.', 'An autumnal love story.', 'A friends-to-rivals-to-lovers arc.'],
    'Sci-Fi': ['A near-future cautionary tale.', 'A space opera with a small cast.', 'A first-contact story with quiet stakes.'],
    Western: ['A revisionist piece about a small town.', 'A pursuit across hostile country.', 'A gunslinger reckoning with the past.'],
  };

  // Roll for a producer-on-hire offer.
  // Eligibility: cash > $500K, 5+ films, producer rep >= 15. Capped at 2 pending.
  const maybeGenerateCoProducingOffer = (weeks) => {
    setPlayer(p => {
      // Cleanup expired (6 weeks to decide)
      const fresh = (p.coProducingOffers || []).filter(o => {
        const ageWeeks = (p.year - o.year) * 52 + (p.week - o.week);
        return ageWeeks < 6;
      });
      if (fresh.length >= 2) return { ...p, coProducingOffers: fresh };
      // Eligibility
      if ((p.history || []).length < 5) return { ...p, coProducingOffers: fresh };
      if ((p.reputation?.producer || 0) < 15) return { ...p, coProducingOffers: fresh };
      if (p.cash < 500_000) return { ...p, coProducingOffers: fresh };
      // Roll — 2% per week base, scaled by producer rep
      const baseChance = 0.02 + (p.reputation.producer / 1000); // up to ~12% at rep 100
      const chance = Math.min(0.15, baseChance) * weeks;
      if (Math.random() > chance) return { ...p, coProducingOffers: fresh };

      // Generate the offer
      const genres = Object.keys(CO_PRODUCING_PREMISES);
      const genre = pick(genres);
      // Budget scales with player rep (bigger projects offered to established producers)
      const budgetTiers = [4_000_000, 8_000_000, 15_000_000, 25_000_000, 40_000_000];
      const tierIdx = clamp(Math.floor(((p.reputation.producer || 15) - 15) / 20), 0, budgetTiers.length - 1);
      const budget = budgetTiers[tierIdx];
      // Player's commitment: 20-40% of budget
      const commitmentPct = 0.20 + Math.random() * 0.20;
      const commitment = Math.round(budget * commitmentPct / 100_000) * 100_000;
      // Player's profit share: commitment % + a 5% producer fee
      const profitSharePct = commitmentPct + 0.05;

      // Find an attached director NPC — prefer non-rivals, non-retired, with reasonable skill
      const directorCandidates = Object.values(p.worldNPCs || {}).filter(npc =>
        npc.role === 'director' && !npc.retired && (npc.rivalryScore || 0) < 2 && (npc.skill || 0) >= 40
      );
      const director = directorCandidates.length > 0 ? pick(directorCandidates) : null;

      // Expected quality projection — based on director skill + a touch of optimism
      const qualityProjection = director ? clamp(director.skill + randInt(-8, 10), 30, 95) : 60;

      const offer = {
        id: `cop-${p.year}-${p.week}-${Math.floor(Math.random() * 1000)}`,
        studio: pick(CO_PRODUCING_STUDIOS),
        title: generateTitle(genre),
        genre,
        premise: pick(CO_PRODUCING_PREMISES[genre]),
        budget,
        commitment,
        profitSharePct,
        directorNpcId: director?.id || null,
        directorName: director?.name || 'TBD',
        directorSkill: director?.skill || 50,
        qualityProjection,
        year: p.year,
        week: p.week,
      };
      return { ...p, coProducingOffers: [...fresh, offer] };
    });
  };

  // Accept a co-producing offer — capital committed immediately, project enters production queue
  const acceptCoProducingOffer = (offer) => {
    if (player.cash < offer.commitment) return;
    setPlayer(p => {
      // Move offer to coProductions; commit capital
      const newOffers = (p.coProducingOffers || []).filter(o => o.id !== offer.id);
      const newCoProduction = {
        ...offer,
        committedYear: p.year,
        committedWeek: p.week,
        releaseYear: p.year + 1, // ~50 weeks to release
        releaseWeek: p.week,
        status: 'in_production',
      };
      return {
        ...p,
        cash: p.cash - offer.commitment,
        coProducingOffers: newOffers,
        coProductions: [...(p.coProductions || []), newCoProduction],
      };
    });
    addLog('Business', `💼 Committed ${fmtMoney(offer.commitment)} to co-producing "${offer.title}" with ${offer.studio}. They run the show.`);
  };

  const declineCoProducingOffer = (offer) => {
    setPlayer(p => ({
      ...p,
      coProducingOffers: (p.coProducingOffers || []).filter(o => o.id !== offer.id),
    }));
    addLog('Business', `Passed on ${offer.studio}'s co-producing pitch for "${offer.title}".`);
  };

  // Settle a co-production when its release year arrives.
  // Simulates the film, computes profit/loss for player's share, adds to history.
  const settleCoProduction = (coProd) => {
    // Build a film-like object for simulation
    const npc = player.worldNPCs?.[coProd.directorNpcId];
    const fakeProj = {
      title: coProd.title,
      genre: coProd.genre,
      budget: coProd.budget,
      marketing: Math.round(coProd.budget * 0.5),
      qualityMod: 0,
      marketingMod: 0,
      costOverrun: 0,
      fycSpend: 0,
      crew: {
        director: { name: coProd.directorName, skill: coProd.directorSkill, rep: 30 },
        actor: { name: 'A Working Star', skill: 60, rep: 20 },
        writer: { name: 'A Veteran Pen', skill: 55, rep: 15 },
        producer: { name: 'The Studio', skill: 60, rep: 30 },
      },
      playerRoles: [], // player gets no on-screen credit
    };
    const result = simulateMovie(fakeProj, player, false);
    const totalRevenue = result.boxOffice || 0;
    const totalCost = coProd.budget + fakeProj.marketing;
    // Player's share of revenue based on profitSharePct
    const playerRevenue = Math.round(totalRevenue * coProd.profitSharePct * 0.4); // *0.4 is the rentals-vs-box-office ratio (rough 1985 norm)
    const playerOutcome = playerRevenue - coProd.commitment;
    const settled = {
      ...coProd,
      result,
      playerRevenue,
      playerOutcome,
      profit: playerOutcome,
      settledYear: player.year,
      settledWeek: player.week,
      status: 'settled',
    };
    setPlayer(p => {
      // Small producer rep gain on a hit, slight loss on a bomb
      let repDelta = 0;
      if (result.hit) repDelta = 2;
      else if (result.flop) repDelta = -1;
      return {
        ...p,
        cash: p.cash + playerRevenue,
        lifetimeEarnings: (p.lifetimeEarnings || 0) + Math.max(0, playerOutcome),
        coProductions: (p.coProductions || []).filter(cp => cp.id !== coProd.id),
        coProductionsHistory: [...(p.coProductionsHistory || []), settled],
        reputation: {
          ...p.reputation,
          producer: clamp((p.reputation.producer || 0) + repDelta, -50, 100),
        },
      };
    });
    const verdict = playerOutcome > 0
      ? `Returned ${fmtMoney(playerRevenue)} (net +${fmtMoney(playerOutcome)}).`
      : playerOutcome < 0
        ? `Returned ${fmtMoney(playerRevenue)} (net ${fmtMoney(playerOutcome)}).`
        : `Broke even on your share.`;
    addLog('Business', `🎬 Co-production "${coProd.title}" settled. ${verdict} ${result.hit ? 'A hit.' : result.flop ? 'A flop.' : 'Mid-pack.'}`);
  };

  // Check co-productions each year for releases that are ready to settle
  useEffect(() => {
    const ready = (player.coProductions || []).filter(cp => {
      return (player.year > cp.releaseYear) ||
        (player.year === cp.releaseYear && player.week >= cp.releaseWeek);
    });
    for (const cp of ready) {
      settleCoProduction(cp);
    }
    // eslint-disable-next-line
  }, [player.week, player.year]);

  // Roll for a tabloid event during the week advance
  const maybeTriggerTabloid = (weeks) => {
    if (player.pendingEvent) return; // already have one queued

    // Chained follow-up events fire after a 1-week delay
    if (player.pendingChain) {
      if (player.pendingChain.ageInWeeks >= 1) {
        const chained = buildChainEvent(player.pendingChain.eventId, player);
        if (chained) {
          setPlayer(p => ({ ...p, pendingEvent: chained, pendingChain: null }));
          return;
        }
      } else {
        // Age the chain
        setPlayer(p => ({
          ...p,
          pendingChain: { ...p.pendingChain, ageInWeeks: p.pendingChain.ageInWeeks + weeks },
        }));
      }
    }

    // Chance scales with fame; ~3-15% per week
    const baseChance = clamp(player.fame / 800 + 0.02, 0.02, 0.18);
    let triggered = false;
    for (let i = 0; i < weeks; i++) {
      if (Math.random() < baseChance) { triggered = true; break; }
    }
    if (!triggered) return;
    const event = chooseTabloidEvent(player);
    if (event) {
      setPlayer(p => ({ ...p, pendingEvent: event }));
    }
  };

  // Take a direct offer — straight to production
  const acceptOffer = (offer) => {
    setActiveOffer(offer);
    setView('newproj');
  };

  // Audition for a role — costs a week + small fee, may book the role
  const attemptAudition = (audition) => {
    const fee = 50; // headshot/sides/travel — minimal
    setPlayer(p => ({
      ...p,
      cash: Math.max(0, p.cash - fee),
      energy: clamp(p.energy - 10, 0, 100),
    }));
    advanceWeek(1);

    const outcome = runAudition(player, audition);
    setAuditionResult({ audition, outcome });

    if (outcome.result === 'booked') {
      addLog('Audition', `Booked "${audition.title}" — ${ROLE_LABELS[audition.playerRole]} role.`);
      // Remove this listing from the board (you got it)
      setListings(prev => prev.filter(l => l !== audition));
    } else if (outcome.result === 'callback') {
      addLog('Audition', `Callback for "${audition.title}" but the role went elsewhere. So close.`);
      // Slight skill bump from the experience
      setPlayer(p => ({
        ...p,
        skills: { ...p.skills, [audition.playerRole]: clamp(p.skills[audition.playerRole] + 1, 1, 100) },
      }));
      setListings(prev => prev.filter(l => l !== audition));
    } else {
      addLog('Audition', `Didn't book "${audition.title}". Onto the next one.`);
      setListings(prev => prev.filter(l => l !== audition));
    }
  };

  // Confirm booking from audition modal — move to production
  const acceptBookedRole = () => {
    if (auditionResult?.outcome.result === 'booked') {
      // Convert audition into a regular offer-style project
      const { audition } = auditionResult;
      const asOffer = { ...audition, kind: 'offer' };
      setAuditionResult(null);
      setActiveOffer(asOffer);
      setView('newproj');
    } else {
      setAuditionResult(null);
    }
  };

  // Train: spend a week + money on a skill
  const train = (role) => {
    const cost = 2000 + player.skills[role] * 80;
    if (player.cash < cost) {
      addLog('Training', `Couldn't afford ${ROLE_LABELS[role]} coaching ($${cost}).`);
      return;
    }
    // Skill gain decreases as skill rises (logarithmic-ish)
    const gain = Math.max(1, Math.round(4 - player.skills[role] / 30));
    setPlayer(p => ({
      ...p,
      cash: p.cash - cost,
      energy: clamp(p.energy - 20, 0, 100),
      skills: { ...p.skills, [role]: p.skills[role] + gain },
    }));
    addLog('Training', `Studied ${ROLE_LABELS[role].toLowerCase()} craft. +${gain} skill (cost ${fmtMoney(cost)}).`);
    advanceWeek(1);
  };

  // Take a side job (small money, time passes)
  const sideJob = () => {
    const pay = randInt(800, 3000);
    setPlayer(p => ({ ...p, cash: p.cash + pay, lifetimeEarnings: (p.lifetimeEarnings || 0) + pay, energy: clamp(p.energy - 15, 0, 100) }));
    addLog('Hustle', `Worked a side gig for ${fmtMoney(pay)}.`);
    advanceWeek(1);
  };

  // ---------- PRODUCTION STATE MACHINE ----------
  // startProduction is called from ProjectBuilder. It builds a production object
  // and routes into the pre-production phase.

  const startProduction = ({ proj, studioCost, offer }) => {
    // Charge upfront studio cost (own studio pays its own budget now)
    if (studioCost > 0) {
      setPlayer(p => ({ ...p, cash: p.cash - studioCost }));
    }

    // Production hell roll: big-budget films can spiral out of control.
    // For films above $40M, every $10M over adds ~3% chance of hell.
    // Hell doubles cost overruns and starts production with a -8 quality mod.
    let initialQualityMod = 0;
    let productionHell = false;
    if (proj.budget > 40_000_000) {
      const overTier = (proj.budget - 40_000_000) / 10_000_000;
      const hellChance = Math.min(0.50, overTier * 0.03);
      if (Math.random() < hellChance) {
        productionHell = true;
        initialQualityMod = -8;
        addLog('Production', `⚠ "${proj.title}" is in production hell. Cost overruns will compound. Quality is suffering.`);
      }
    }

    const production = {
      proj: { ...proj, offer }, // remember whether this is an outside offer
      studioCost,
      phase: 'preprod',
      productionHell,
      mods: { qualityMod: initialQualityMod, marketingMod: 1.0, costOverrun: 0 },
      preprod: { scriptPolished: false, tone: null, prepLevel: null },
      filming: {
        events: makeFilmingEvents({ proj }),
        currentEventIdx: 0,
        weeksShot: 0,
        resolutions: [],
      },
      postprod: { testScreening: null, finalEdit: null, reshootsDone: false },
      marketing: { budgetBoost: 0, talkshow: false, magazine: false, redcarpet: false, festival: false, interviews: false },
    };
    setProduction(production);
    addLog('Production', `Pre-production begins on "${proj.title}".`);
    setView('production');
    setActiveOffer(null);
  };

  // Apply a choice's effects to the current production
  const applyProductionChoice = (effect) => {
    setProduction(prod => {
      if (!prod) return prod;
      const next = { ...prod, mods: { ...prod.mods }, preprod: { ...prod.preprod }, postprod: { ...prod.postprod }, marketing: { ...prod.marketing }, filming: { ...prod.filming } };

      // Quality
      if (effect.quality) next.mods.qualityMod += effect.quality;

      // Cost (as fraction of budget; OR absolute cashSpent)
      // Production hell doubles cost overruns
      const hellMult = prod.productionHell ? 2 : 1;
      if (effect.cost) next.mods.costOverrun += Math.round(prod.proj.budget * effect.cost * hellMult);
      if (effect.cashSpent) {
        // Direct cash out of player's pocket (promo spending) — handled below
      }

      // Marketing multiplier
      if (effect.marketing) next.mods.marketingMod += effect.marketing;

      // Marketing budget direct boost (producer's call)
      if (effect.marketingBudget) {
        next.marketing.budgetBoost = (next.marketing.budgetBoost || 0) + effect.marketingBudget;
      }

      // For Your Consideration awards campaign (producer's call)
      if (effect.fycSpend) {
        next.marketing.fycSpend = (next.marketing.fycSpend || 0) + effect.fycSpend;
      }

      // Phase-specific flags
      if (effect.eventResolution) {
        next.filming.resolutions = [...next.filming.resolutions, effect.eventResolution];
        next.filming.currentEventIdx = prod.filming.currentEventIdx + 1;
        next.filming.weeksShot = prod.filming.weeksShot + 1;
      }
      if (effect.testScreening) next.postprod.testScreening = effect.testScreening;
      if (effect.finalEdit) next.postprod.finalEdit = effect.finalEdit;
      if (effect.reshootsDone) next.postprod.reshootsDone = true;
      if (effect.promo) next.marketing = { ...next.marketing, ...effect.promo };

      // Festival submission tracking
      if (effect.festivalSubmitted) next.marketing.festivalSubmitted = effect.festivalSubmitted;
      if (effect.festivalAccepted) next.marketing.festivalAccepted = effect.festivalAccepted;
      if (effect.festivalRejected) next.marketing.festivalRejected = effect.festivalRejected;

      return next;
    });

    // Side effects on the player (energy, fame, cash out for promo)
    setPlayer(p => {
      const buffs = ownedBuffs(p);
      const updates = {};
      if (effect.energy) updates.energy = clamp(p.energy + effect.energy, 0, 100);
      if (effect.fame) {
        // Publicist multiplies promo fame gains
        const fameAmount = effect.fame * buffs.promoFameMultiplier;
        updates.fame = clamp(p.fame + fameAmount, 0, 100);
        updates.peakFame = Math.max(p.peakFame || 0, updates.fame);
      }
      if (effect.cashSpent) updates.cash = Math.max(0, p.cash - effect.cashSpent);
      if (effect.marketingBudget) updates.cash = Math.max(0, p.cash - effect.marketingBudget);
      return { ...p, ...updates };
    });

    // Filming events also pass a week of in-game time
    if (effect.eventResolution) {
      advanceWeek(1);
    }
  };

  // Advance to next phase
  const advancePhase = () => {
    if (!production) return;
    const order = ['preprod', 'filming', 'postprod', 'marketing', 'release'];
    const idx = order.indexOf(production.phase);
    if (idx < 0 || idx >= order.length - 1) return;
    const nextPhase = order[idx + 1];

    // Phase transition side effects (logs, time, release trigger) — outside the updater
    if (nextPhase === 'filming') {
      addLog('Production', `Principal photography starts on "${production.proj.title}".`);
    } else if (nextPhase === 'postprod') {
      addLog('Production', `"${production.proj.title}" wraps. Now in post.`);
      advanceWeek(2);
    } else if (nextPhase === 'marketing') {
      addLog('Production', `Picture locked. Marketing campaign for "${production.proj.title}" begins.`);
      advanceWeek(2);
    } else if (nextPhase === 'release') {
      // Trigger release flow on next tick
      setTimeout(() => releaseFilm(), 0);
    }
    setProduction(prod => prod ? { ...prod, phase: nextPhase } : prod);
  };

  // Final release — runs simulateMovie with accumulated mods
  const releaseFilm = () => {
    const prod = production;
    if (!prod) return;
    const { proj, mods, marketing: mkt } = prod;
    const offer = proj.offer;

    // Final marketing spend includes any boosts the producer added
    const finalMarketing = proj.marketing + (mkt.budgetBoost || 0);

    const playerBuffs = ownedBuffs(player);
    // Apply cost overrun reduction from studio backlot
    const adjustedCostOverrun = Math.round(mods.costOverrun * (1 - playerBuffs.costOverrunReduction));
    // Apply FYC multiplier from awards PR firm
    const adjustedFyc = Math.round((mkt.fycSpend || 0) * playerBuffs.fycMultiplier);

    const enrichedProj = {
      ...proj,
      marketing: finalMarketing,
      qualityMod: mods.qualityMod,
      marketingMod: mods.marketingMod,
      costOverrun: adjustedCostOverrun,
      fycSpend: adjustedFyc,
      releaseYear: player.year,
    };

    const result = simulateMovie(enrichedProj, player);

    // Apply festival effects if accepted
    let festivalRun = null;
    if (mkt.festivalAccepted) {
      const fest = FESTIVALS.find(f => f.id === mkt.festivalAccepted);
      if (fest) {
        result.criticScore = clamp(result.criticScore + fest.criticBoost, 0, 100);
        result.audienceScore = clamp(result.audienceScore - fest.audienceCost, 0, 100);
        // Award score boost is captured by tagging the film for awards eval
        festivalRun = {
          festivalId: fest.id,
          festivalName: fest.shortName,
          awardScoreBoost: fest.awardScoreBoost,
        };
        addLog('Festival', `🎟 "${proj.title}" premiered at ${fest.name}. Critics: ${result.criticScore}. The hype is real.`);
      }
    }

    // Apply distribution arm: bonus on box office share (own studio only)
    if (!proj.offer && playerBuffs.boxOfficeShareBonus > 0) {
      const bonus = Math.round(result.boxOffice * playerBuffs.boxOfficeShareBonus);
      result.boxOffice += bonus;
      result.profit += bonus;
    }

    // ---- Generate week-by-week theatrical run ----
    const run = generateTheatricalRun(result.boxOffice, result.audienceScore, result.criticScore, proj.genre, proj.franchise);
    const openingWeek = run[0] || { gross: 0, cumulative: 0 };

    // Player gets cash incrementally as the film plays. For week 1:
    // - if outside offer: player's pay + a partial backend (rest comes if the film hits)
    // - if own studio: opening weekend gross flows to studio
    // Costs (budget overruns, marketing boost) hit immediately at release.

    let openingCashDelta;
    if (offer) {
      // Outside offer: pay arrives at release; backend percentages tracked & paid per week
      openingCashDelta = offer.pay;
    } else {
      // Own studio: receives opening weekend gross minus the immediate costs
      openingCashDelta = openingWeek.gross - mods.costOverrun - (mkt.budgetBoost || 0);
    }

    setPlayer(p => {
      const newSkills = { ...p.skills };
      const newRep = { ...p.reputation };
      for (const r of ROLES) {
        newSkills[r] = clamp(newSkills[r] + (result.skillGains[r] || 0), 1, 100);
        newRep[r] = clamp(newRep[r] + (result.repGains[r] || 0), -50, 100);
      }
      const newFame = clamp(p.fame + result.fameGain, 0, 100);

      // The film as an in-theaters object — separate from history until it closes
      const inTheatersFilm = {
        ...enrichedProj,
        result,
        year: p.year,
        week: p.week,
        ownStudio: !offer,
        run, // [{ weekInRun, gross, cumulative }, ...]
        currentWeekInRun: 1, // week 1 just played
        currentCumulative: openingWeek.gross,
        runWeeks: run.length,
        isOpen: true,
        festivalRun, // null or { festivalId, festivalName, awardScoreBoost }
      };

      // Studio bookkeeping: only opening week so far
      let newStudio = p.studio;
      if (!offer && p.studio) {
        newStudio = {
          ...p.studio,
          totalRevenue: p.studio.totalRevenue + openingWeek.gross,
          releases: p.studio.releases + 1,
          // hits/flops decided at close, not now
          budgetCap: Math.max(p.studio.budgetCap, openingWeek.gross * 0.5),
        };
      }

      // Franchise registration:
      // - If this film is a sequel (proj.franchise exists), append its title to the existing franchise's entries
      // - If this is an original AND the player has rights (own studio or producer credit), create a new franchise
      //   (rights only register if the player could later make a sequel themselves)
      let newFranchises = { ...(p.franchises || {}) };
      if (proj.franchise && proj.franchise.id) {
        const fid = proj.franchise.id;
        const existing = newFranchises[fid];
        if (existing) {
          newFranchises[fid] = {
            ...existing,
            entries: [...existing.entries, { title: proj.title, year: p.year, entry: proj.franchise.entry }],
            lastEntryYear: p.year,
          };
        }
      } else {
        // Original — only register if player has sequel rights
        const playerHasRights = !offer || proj.playerRoles.includes('producer');
        if (playerHasRights) {
          const fid = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          newFranchises[fid] = {
            id: fid,
            title: proj.title,
            entries: [{ title: proj.title, year: p.year, entry: 1 }],
            rootCrew: proj.crew, // remember who made the original
            originalGenre: proj.genre,
            originalPlayerRoles: proj.playerRoles,
            ownerIsPlayer: !offer, // true if player's own studio, false if hired-producer
            lastEntryYear: p.year,
          };
          // Tag the film record with its franchise ID
          // (Mutated here to flow into the in-theaters/history records below)
          enrichedProj.franchise = {
            id: fid,
            entry: 1,
            rootCrew: proj.crew,
          };
        }
      }

      // Increment genre credit count — feeds into specialization tiers
      const newGenreCredits = { ...(p.genreCredits || {}) };
      newGenreCredits[proj.genre] = (newGenreCredits[proj.genre] || 0) + 1;

      return {
        ...p,
        cash: p.cash + openingCashDelta,
        lifetimeEarnings: (p.lifetimeEarnings || 0) + Math.max(0, openingCashDelta),
        skills: newSkills,
        reputation: newRep,
        fame: newFame,
        peakFame: Math.max(p.peakFame || 0, newFame),
        inTheaters: [...(p.inTheaters || []), inTheatersFilm],
        studio: newStudio,
        franchises: newFranchises,
        genreCredits: newGenreCredits,
      };
    });

    // Show opening weekend modal (not the final-result modal)
    setOpening({ film: enrichedProj, result, openingGross: openingWeek.gross, totalProjected: result.boxOffice });

    const headline = `"${proj.title}" opens to ${fmtMoney(openingWeek.gross)}. ${result.criticScore >= 70 ? 'Critics are raving.' : result.criticScore >= 50 ? 'Reviews are mixed.' : 'The reviews are brutal.'}`;
    addLog('Release', headline);

    // Specialty milestone — check if this release just pushed the player across a tier
    const prevCount = (player.genreCredits || {})[proj.genre] || 0;
    const newCount = prevCount + 1;
    for (const t of SPECIALTY_TIERS) {
      if (newCount === t.min) {
        const label = t.label === 'Working In' ? `Working in ${proj.genre}` : `${proj.genre} ${t.label}`;
        addLog('Career', `🎬 You are now considered a ${label}.`);
        break;
      }
    }

    // Hyphenate milestones — detect first-time role + combo + triple/quad on this release
    // Use player.history (pre-release) to determine "first time"
    const priorFilms = player.history || [];
    const projRoles = proj.playerRoles || [];
    const startingRole = player.startingRole;
    const debutLabels = {
      actor: 'acting',
      director: 'directorial',
      producer: 'producing',
      writer: 'screenwriting',
    };
    // First-time role debuts (other than starting role)
    for (const r of projRoles) {
      if (r === startingRole) continue;
      const everPlayedBefore = priorFilms.some(f => (f.playerRoles || []).includes(r));
      if (!everPlayedBefore) {
        addLog('Career', `✨ Your ${debutLabels[r]} debut — "${proj.title}".`);
      }
    }
    // First-time hyphenate (2-role combo)
    if (projRoles.length === 2) {
      const sortedRoles = [...projRoles].sort();
      const everComboBefore = priorFilms.some(f => {
        const fRoles = [...(f.playerRoles || [])].sort();
        return fRoles.length === 2 && fRoles[0] === sortedRoles[0] && fRoles[1] === sortedRoles[1];
      });
      if (!everComboBefore) {
        const labels = sortedRoles.map(r => ROLE_LABELS[r].toLowerCase()).join('-');
        addLog('Career', `✨ First time as a ${labels} on "${proj.title}".`);
      }
    }
    // First triple threat
    if (projRoles.length === 3) {
      const everTripleBefore = priorFilms.some(f => (f.playerRoles || []).length === 3);
      if (!everTripleBefore) {
        addLog('Career', `🎯 Triple threat: you wrote, directed, and produced — or some combo of three — on "${proj.title}".`);
      }
    }
    // First quadruple threat
    if (projRoles.length === 4) {
      const everQuadBefore = priorFilms.some(f => (f.playerRoles || []).length === 4);
      if (!everQuadBefore) {
        addLog('Career', `🌟 Quadruple threat. You wore every hat on "${proj.title}". They call this the Welles move.`);
      }
    }

    // ---- Comeback arc resolution ----
    // If the player was in comebackState, this release closes it.
    // If the new film is a hit, they get a bonus fame bump + log highlight.
    const wasInComeback = !!player.comebackState;
    const isComebackHit = wasInComeback && result.hit;
    const isMajorFlop = (proj.budget || 0) >= 20_000_000 && result.audienceScore < 35;

    if (wasInComeback) {
      // Clear comeback state and award bonus if applicable
      setPlayer(p => ({
        ...p,
        comebackState: null,
        fame: clamp(p.fame + (isComebackHit ? 5 : 0), 0, 100),
      }));
      if (isComebackHit) {
        addLog('Comeback', `🎉 The comeback is real. "${proj.title}" is a hit. The trades are calling it a renaissance.`);
      } else if (result.flop) {
        addLog('Comeback', `The comeback didn't take. "${proj.title}" didn't deliver. Back to square one.`);
      } else {
        addLog('Comeback', `"${proj.title}" is decent. Not the splash needed for a true comeback — but you're working again.`);
      }
    } else if (isMajorFlop) {
      // Activate comeback state — major flop puts player in recovery mode
      setPlayer(p => ({
        ...p,
        comebackState: { reason: 'flop', sinceYear: p.year, sinceWeek: p.week, filmTitle: proj.title },
      }));
      addLog('Comeback', `⚠ "${proj.title}" is a major flop. The trades are writing your obituary. Your next move matters.`);
    }

    // Festival run adds 4 weeks before normal opening rhythm advances
    const festivalDelay = mkt.festivalAccepted ? 4 : 0;
    advanceWeek(1 + festivalDelay);
    setProduction(null);
    setView('hub');
  };

  // Process all in-theaters films during a week tick.
  // For each film: pay out next week's gross, mark closed if run is done.
  const tickInTheaters = (weeks = 1) => {
    setPlayer(p => {
      const inTheaters = p.inTheaters || [];
      if (inTheaters.length === 0) return p;

      let cashDelta = 0;
      let lifetimeGain = 0;
      const stillOpen = [];
      const closed = []; // films that closed this tick
      let newStudio = p.studio;

      for (const film of inTheaters) {
        let currentWeek = film.currentWeekInRun;
        let currentCum = film.currentCumulative;
        let weeksToProcess = weeks;
        let filmClosed = false;

        while (weeksToProcess > 0 && currentWeek < film.run.length) {
          const nextWeekData = film.run[currentWeek]; // 0-indexed: this is week (currentWeek+1) in run
          if (!nextWeekData) break;
          // Player's cut depends on whether this is their studio's film
          let weekCashCut;
          if (film.offer) {
            // Outside offer: player gets backend on hits only
            if (film.result.hit) {
              weekCashCut = Math.round(nextWeekData.gross * 0.03);
            } else {
              weekCashCut = 0;
            }
          } else {
            // Own studio: gets full gross (already paid budget/marketing upfront)
            weekCashCut = nextWeekData.gross;
          }
          cashDelta += weekCashCut;
          if (weekCashCut > 0) lifetimeGain += weekCashCut;
          currentCum = nextWeekData.cumulative;
          currentWeek += 1;
          weeksToProcess -= 1;

          // Studio tally — own studio films only
          if (!film.offer && newStudio) {
            newStudio = {
              ...newStudio,
              totalRevenue: newStudio.totalRevenue + nextWeekData.gross,
            };
          }
        }

        if (currentWeek >= film.run.length) {
          // Film closed
          filmClosed = true;
        }

        const updatedFilm = {
          ...film,
          currentWeekInRun: currentWeek,
          currentCumulative: currentCum,
          isOpen: !filmClosed,
        };

        if (filmClosed) {
          closed.push(updatedFilm);
        } else {
          stillOpen.push(updatedFilm);
        }
      }

      // Closed films go into history; recompute their result.boxOffice from actual run total
      let newHistory = p.history;
      let newWorldNPCs = p.worldNPCs || {};
      for (const closedFilm of closed) {
        const actualBox = closedFilm.run.reduce((s, w) => s + w.gross, 0);
        const totalCost = closedFilm.budget + closedFilm.marketing + (closedFilm.costOverrun || 0);
        const actualProfit = actualBox - totalCost;
        const finalResult = {
          ...closedFilm.result,
          boxOffice: actualBox,
          profit: actualProfit,
          totalCost,
          hit: actualProfit > totalCost * 1.5,
          flop: actualProfit < -totalCost * 0.3,
        };
        const archivedFilm = {
          ...closedFilm,
          result: finalResult,
          isOpen: false,
        };
        newHistory = [...newHistory, archivedFilm];

        // Studio hit/flop bookkeeping at close
        if (!closedFilm.offer && newStudio) {
          newStudio = {
            ...newStudio,
            hits: newStudio.hits + (finalResult.hit ? 1 : 0),
            flops: newStudio.flops + (finalResult.flop ? 1 : 0),
            budgetCap: Math.max(newStudio.budgetCap, actualBox * 0.5),
          };
        }

        // Collaboration tracking: any NPC crew member on a closed film
        // contributes friendship. Hits give 2 friendship; flops give 0.
        const friendshipGain = finalResult.hit ? 2 : (finalResult.flop ? 0 : 1);
        if (friendshipGain > 0 && closedFilm.crew) {
          for (const role of ROLES) {
            const crewMember = closedFilm.crew[role];
            if (crewMember?.npcId && newWorldNPCs[crewMember.npcId]) {
              // Bump friendship score
              const detail = finalResult.hit
                ? `co-starred on "${closedFilm.title}" — a hit`
                : `worked together on "${closedFilm.title}"`;
              const updated = { ...newWorldNPCs[crewMember.npcId] };
              updated.friendshipScore = (updated.friendshipScore || 0) + friendshipGain;
              updated.history = [...(updated.history || []), {
                year: p.year,
                type: 'collaboration',
                detail,
              }];
              newWorldNPCs = { ...newWorldNPCs, [crewMember.npcId]: updated };
            }
          }
        }
      }

      return {
        ...p,
        cash: p.cash + cashDelta,
        lifetimeEarnings: (p.lifetimeEarnings || 0) + lifetimeGain,
        inTheaters: stillOpen,
        history: newHistory,
        studio: newStudio,
        worldNPCs: newWorldNPCs,
      };
    });

    // Side-effect logging for closes (after state update — done outside the updater)
    // Note: we'll log closes via an effect below
  };

  // Found a studio
  const foundStudio = () => {
    const cost = 250_000;
    if (player.cash < cost) {
      addLog('Studio', `Need ${fmtMoney(cost)} to incorporate a studio. Saved cash: ${fmtMoney(player.cash)}.`);
      return;
    }
    const name = generateStudioName(player.name);
    setPlayer(p => ({
      ...p,
      cash: p.cash - cost,
      studio: {
        name,
        founded: p.year,
        foundedYear: p.year, // for Year in Variety detection
        totalRevenue: 0,
        releases: 0,
        hits: 0,
        flops: 0,
        budgetCap: 8_000_000,
        reserves: 0, // separate pool earning monthly interest
      },
    }));
    addLog('Studio', `Founded ${name}! The doors are open. (Cost: ${fmtMoney(cost)})`);
    setPendingFoundStudio(false);
  };

  // ===== Studio reserves =====
  // Move money between personal cash and studio reserves. Reserves earn 0.1%/wk interest.
  // Locked during active production (can't withdraw if a film is being made).
  const depositToReserves = (amount) => {
    if (!player.studio || amount <= 0 || amount > player.cash) return;
    setPlayer(p => ({
      ...p,
      cash: p.cash - amount,
      studio: { ...p.studio, reserves: (p.studio.reserves || 0) + amount },
    }));
    addLog('Studio', `Moved ${fmtMoney(amount)} to studio reserves.`);
  };

  const withdrawFromReserves = (amount) => {
    if (!player.studio || amount <= 0 || amount > (player.studio.reserves || 0)) return;
    if (production) {
      addLog('Studio', `Can't withdraw from reserves during active production.`);
      return;
    }
    setPlayer(p => ({
      ...p,
      cash: p.cash + amount,
      studio: { ...p.studio, reserves: (p.studio.reserves || 0) - amount },
    }));
    addLog('Studio', `Withdrew ${fmtMoney(amount)} from studio reserves.`);
  };

  // ===== Make a Sequel =====
  // Called from FranchisesView with a franchise + the latest film record
  const startSequel = (franchise, lastFilm) => {
    // Build sequelOf object combining franchise data with last entry's stats
    const sequelContext = {
      ...franchise,
      lastQuality: lastFilm?.result?.quality || 50,
      lastHit: lastFilm?.result?.hit || false,
      lastBudget: lastFilm?.budget || 5_000_000,
    };
    setSequelOf(sequelContext);
    setActiveOffer(null);
    setView('newproj');
  };

  // ===== Purchases =====
  const buyItem = (item) => {
    if (player.cash < item.price) return;
    setPlayer(p => {
      // If this item replaces a previous tier, drop the older one automatically
      let newPossessions = p.possessions || [];
      if (item.replaces) {
        newPossessions = newPossessions.filter(id => id !== item.replaces);
      }
      newPossessions = [...newPossessions, item.id];
      return {
        ...p,
        cash: p.cash - item.price,
        possessions: newPossessions,
      };
    });
    addLog('Acquired', `Acquired ${item.name} for ${fmtMoney(item.price)}.`);
  };

  const sellItem = (item) => {
    // Sell back at 50% for material items (homes/cars); team services have no resale
    const refund = (item.category === 'lifestyle') ? Math.round(item.price * 0.5) : 0;
    setPlayer(p => ({
      ...p,
      cash: p.cash + refund,
      possessions: (p.possessions || []).filter(id => id !== item.id),
    }));
    if (refund > 0) {
      addLog('Sold', `Sold ${item.name} for ${fmtMoney(refund)}.`);
    } else {
      addLog('Released', `Released ${item.name} from service.`);
    }
  };

  const doIndulgence = (item) => {
    if (player.cash < item.price) return;
    const effects = item.effects || {};

    // Gamble: 35% chance of 2-4x, 65% chance of total loss
    if (effects.gamble) {
      const win = Math.random() < 0.35;
      const multiplier = win ? (2 + Math.random() * 2) : 0;
      const result = Math.round(item.price * multiplier);
      setPlayer(p => ({
        ...p,
        cash: p.cash - item.price + result,
        lifetimeEarnings: (p.lifetimeEarnings || 0) + Math.max(0, result - item.price),
        energy: clamp(p.energy + (effects.energy || 0), 0, 100),
      }));
      if (win) {
        addLog('Vegas', `Hit it big in Vegas — won ${fmtMoney(result)} on a ${fmtMoney(item.price)} weekend.`);
      } else {
        addLog('Vegas', `Lost the whole ${fmtMoney(item.price)} in Vegas. Should've stayed home.`);
      }
      advanceWeek(1);
      return;
    }

    // Tabloid: fame up, but small chance of rep hit
    if (effects.repRisk) {
      const backfires = Math.random() < 0.25;
      setPlayer(p => {
        const fameBoost = backfires ? 1 : (effects.fame || 0);
        const newFame = clamp(p.fame + fameBoost, 0, 100);
        let newRep = { ...p.reputation };
        if (backfires) {
          // Hit a random role rep by -3
          const role = pick(ROLES);
          newRep[role] = clamp(newRep[role] - 3, -50, 100);
        }
        return {
          ...p,
          cash: p.cash - item.price,
          fame: newFame,
          peakFame: Math.max(p.peakFame || 0, newFame),
          reputation: newRep,
        };
      });
      addLog('Tabloid', backfires
        ? `The tabloid story backfired — you came off desperate.`
        : `The tabloid story ran — fame boost.`);
      return;
    }

    // Generic indulgence — apply fame, energy, weeks
    setPlayer(p => {
      const newFame = clamp(p.fame + (effects.fame || 0), 0, 100);
      return {
        ...p,
        cash: p.cash - item.price,
        fame: newFame,
        peakFame: Math.max(p.peakFame || 0, newFame),
        energy: clamp(p.energy + (effects.energy || 0), 0, 100),
      };
    });
    addLog('Indulgence', `${item.name}. ${fmtMoney(item.price)} spent.`);
    if (effects.weeksAdvance) {
      advanceWeek(effects.weeksAdvance);
    }
  };

  // ===== Personal life actions =====
  const handlePersonalAction = (action) => {
    switch (action.type) {
      case 'start_dating': {
        setPlayer(p => ({
          ...p,
          personal: {
            ...p.personal,
            status: 'dating',
            partner: { ...action.partner, since: { year: p.year, week: p.week } },
            relationshipHealth: 80,
          },
        }));
        addLog('Personal', `Started dating ${action.partner.name} (${action.partner.occupation}).`);
        break;
      }
      case 'propose': {
        setPlayer(p => ({
          ...p,
          personal: { ...p.personal, status: 'engaged' },
        }));
        addLog('Personal', `Engaged to ${player.personal.partner.name}.`);
        break;
      }
      case 'marry': {
        if (player.cash < 50_000) return;
        setPlayer(p => {
          // If the partner is a world NPC, bump their friendship as a major life event
          let newWorldNPCs = p.worldNPCs || {};
          const partnerNpcId = p.personal.partner?.npcId;
          if (partnerNpcId && newWorldNPCs[partnerNpcId]) {
            const updated = { ...newWorldNPCs[partnerNpcId] };
            updated.friendshipScore = (updated.friendshipScore || 0) + 5;
            updated.history = [...(updated.history || []), {
              year: p.year, type: 'marriage', detail: `married ${p.name}`,
            }];
            newWorldNPCs = { ...newWorldNPCs, [partnerNpcId]: updated };
          }
          return {
            ...p,
            cash: p.cash - 50_000,
            personal: { ...p.personal, status: 'married', relationshipHealth: 95 },
            fame: clamp(p.fame + (p.personal.partner?.isStar ? 4 : 1), 0, 100),
            worldNPCs: newWorldNPCs,
          };
        });
        addLog('Personal', `Married ${player.personal.partner.name}. The wedding was in all the papers.`);
        break;
      }
      case 'date_night': {
        if (player.cash < 2000) return;
        setPlayer(p => ({
          ...p,
          cash: p.cash - 2000,
          personal: {
            ...p.personal,
            relationshipHealth: clamp((p.personal.relationshipHealth ?? 100) + 8, 0, 100),
            lastDateNight: { year: p.year, week: p.week },
          },
        }));
        addLog('Personal', `Quiet date night with ${player.personal.partner.name}.`);
        break;
      }
      case 'vacation': {
        if (player.cash < 30_000) return;
        setPlayer(p => ({
          ...p,
          cash: p.cash - 30_000,
          energy: clamp(p.energy + 30, 0, 100),
          personal: {
            ...p.personal,
            relationshipHealth: clamp((p.personal.relationshipHealth ?? 100) + 20, 0, 100),
          },
        }));
        addLog('Personal', `Two weeks away with ${player.personal.partner.name}. Recharged.`);
        advanceWeek(2);
        break;
      }
      case 'renew_vows': {
        if (player.cash < 30_000) return;
        if (player.personal.status !== 'married') return;
        const sinceYear = player.personal.partner?.since?.year;
        const yearsMarried = sinceYear ? (player.year - sinceYear) : 0;
        setPlayer(p => ({
          ...p,
          cash: p.cash - 30_000,
          fame: clamp(p.fame + 2, 0, 100),
          personal: {
            ...p.personal,
            relationshipHealth: 95,
            lastVowRenewalYear: p.year,
          },
        }));
        addLog('Personal', `💍 You and ${player.personal.partner.name} renewed your vows after ${yearsMarried} years. The photos were lovely.`);
        break;
      }
      case 'have_child': {
        if (player.cash < 20_000) return;
        const childName = pick(CHILD_NAMES);
        setPlayer(p => ({
          ...p,
          cash: p.cash - 20_000,
          personal: {
            ...p.personal,
            children: [...(p.personal.children || []), { name: childName, born: p.year }],
          },
          fame: clamp(p.fame + 2, 0, 100),
        }));
        addLog('Personal', `Welcomed ${childName} into the family. The press loved the baby photos.`);
        break;
      }
      case 'break_up':
      case 'break_off': {
        const partnerName = player.personal.partner?.name;
        setPlayer(p => {
          // If partner was a world NPC, small friendship hit (less than divorce)
          let newWorldNPCs = p.worldNPCs || {};
          const partnerNpcId = p.personal.partner?.npcId;
          if (partnerNpcId && newWorldNPCs[partnerNpcId]) {
            const updated = { ...newWorldNPCs[partnerNpcId] };
            updated.friendshipScore = Math.max(0, (updated.friendshipScore || 0) - 1);
            updated.history = [...(updated.history || []), {
              year: p.year, type: 'breakup', detail: `split with ${p.name}`,
            }];
            newWorldNPCs = { ...newWorldNPCs, [partnerNpcId]: updated };
          }
          return {
            ...p,
            personal: {
              ...p.personal,
              status: 'single',
              partner: null,
              relationshipHealth: 100,
              partnerHistory: [
                ...(p.personal.partnerHistory || []),
                {
                  name: partnerName,
                  started: p.personal.partner?.since?.year,
                  ended: p.year,
                  reason: action.type === 'break_off' ? 'called off engagement' : 'breakup',
                  isStar: p.personal.partner?.isStar,
                  npcId: p.personal.partner?.npcId,
                },
              ],
            },
            fame: clamp(p.fame - 2, 0, 100),
            scandals: [
              ...(p.scandals || []),
              {
                id: `breakup_${Date.now()}`,
                type: 'breakup',
                severity: player.personal.partner?.isStar ? 1.5 : 0.5,
                started: { year: p.year, week: p.week },
                weeks: player.personal.partner?.isStar ? 5 : 2,
                description: 'breakup buzz',
              },
            ],
            worldNPCs: newWorldNPCs,
          };
        });
        addLog('Personal', `Split with ${partnerName}. The tabloids feasted.`);
        break;
      }
      case 'divorce': {
        const partner = player.personal.partner;
        // Alimony: 15% of cash plus annual depending on partner's fame
        const alimony = Math.round(player.cash * 0.20);
        setPlayer(p => {
          // If partner was a world NPC, divorce creates a rivalry record + friendship loss
          let newWorldNPCs = p.worldNPCs || {};
          if (partner?.npcId && newWorldNPCs[partner.npcId]) {
            const updated = { ...newWorldNPCs[partner.npcId] };
            updated.rivalryScore = (updated.rivalryScore || 0) + 2;
            updated.friendshipScore = Math.max(0, (updated.friendshipScore || 0) - 3);
            updated.history = [...(updated.history || []), {
              year: p.year, type: 'divorce', detail: `divorce from ${p.name}`,
            }];
            newWorldNPCs = { ...newWorldNPCs, [partner.npcId]: updated };
          }
          return {
            ...p,
            cash: p.cash - alimony,
            personal: {
              ...p.personal,
              status: 'divorced',
              partner: null,
              relationshipHealth: 100,
              partnerHistory: [
                ...(p.personal.partnerHistory || []),
                {
                  name: partner?.name,
                  started: partner?.since?.year,
                  ended: p.year,
                  reason: 'divorce',
                  isStar: partner?.isStar,
                  npcId: partner?.npcId,
                },
              ],
            },
            fame: clamp(p.fame - 4, 0, 100),
            scandals: [
              ...(p.scandals || []),
              {
                id: `divorce_${Date.now()}`,
                type: 'divorce',
                severity: partner?.isStar ? 2.5 : 1.5,
                started: { year: p.year, week: p.week },
                weeks: partner?.isStar ? 8 : 4,
                description: 'divorce proceedings',
              },
            ],
            worldNPCs: newWorldNPCs,
          };
        });
        addLog('Personal', `Divorced ${partner?.name}. Alimony cost ${fmtMoney(alimony)}.`);
        break;
      }
      default:
        break;
    }
  };

  // Resolve a pending tabloid event with the chosen response
  const resolveTabloid = (choice) => {
    const effects = choice.effects || {};
    const currentEvent = player.pendingEvent;
    setPlayer(p => {
      let newCash = p.cash + (effects.cash || 0);
      let newFame = clamp(p.fame + (effects.fame || 0), 0, 100);
      let newRep = { ...p.reputation };
      let newPersonal = { ...p.personal };
      let newScandals = [...(p.scandals || [])];
      let newEnergy = p.energy;

      if (effects.repHit) {
        newRep[effects.repHit.role] = clamp(newRep[effects.repHit.role] + effects.repHit.amount, -50, 100);
      }
      if (effects.relationshipHealth) {
        newPersonal.relationshipHealth = clamp((newPersonal.relationshipHealth ?? 100) + effects.relationshipHealth, 0, 100);
      }
      if (effects.scandal) {
        newScandals.push({
          id: `tabloid_${Date.now()}`,
          type: 'tabloid',
          severity: effects.scandal.severity,
          started: { year: p.year, week: p.week },
          weeks: effects.scandal.weeks,
          description: effects.scandal.desc,
        });
      }
      if (effects.energy) {
        newEnergy = clamp(p.energy + effects.energy, 0, 100);
      }

      // Apply rivalry/friendship deltas to the contextual NPC if any
      let newWorldNPCs = p.worldNPCs || {};
      const ctx = currentEvent?.ctx || {};
      const targetNpcId = ctx.rivalId || ctx.friendId;
      if (targetNpcId && newWorldNPCs[targetNpcId]) {
        const updated = { ...newWorldNPCs[targetNpcId] };
        if (effects.rivalryDelta) {
          updated.rivalryScore = Math.max(0, (updated.rivalryScore || 0) + effects.rivalryDelta);
        }
        if (effects.friendshipDelta) {
          updated.friendshipScore = Math.max(0, (updated.friendshipScore || 0) + effects.friendshipDelta);
        }
        // Record this event in their history
        if (effects.rivalryDelta || effects.friendshipDelta) {
          const dir = (effects.rivalryDelta || 0) > 0 ? 'feud escalated' :
                      (effects.rivalryDelta || 0) < 0 ? 'feud cooled' :
                      (effects.friendshipDelta || 0) > 0 ? 'collaboration buzz' : 'distancing';
          updated.history = [...(updated.history || []), {
            year: p.year, type: 'tabloid', detail: dir,
          }];
        }
        newWorldNPCs = { ...newWorldNPCs, [targetNpcId]: updated };
      }

      // Archive the resolved story
      const archiveEntry = {
        year: p.year,
        week: p.week,
        eventId: currentEvent?.id,
        headline: currentEvent?.headline,
        flavor: currentEvent?.flavor,
        choice: choice.label,
        outcome: choice.outcome || null,
        tags: currentEvent?.tags || [],
        mentionedNpcId: ctx.rivalId || ctx.friendId || null,
      };

      // Chain event: queue for next week's tick
      let newPendingChain = p.pendingChain;
      if (choice.chain) {
        newPendingChain = { eventId: choice.chain, ageInWeeks: 0 };
      }

      return {
        ...p,
        cash: Math.max(0, newCash),
        fame: newFame,
        peakFame: Math.max(p.peakFame || 0, newFame),
        energy: newEnergy,
        reputation: newRep,
        personal: newPersonal,
        scandals: newScandals,
        worldNPCs: newWorldNPCs,
        pendingEvent: null,
        pendingChain: newPendingChain,
        tabloidHistory: [...(p.tabloidHistory || []), archiveEntry],
      };
    });
    // Log the headline + choice
    const headlineShort = currentEvent?.headline ? currentEvent.headline.split(':')[0].slice(0, 50) : 'Tabloid story';
    addLog('Tabloid', `${headlineShort} — chose "${choice.label}". ${choice.outcome || ''}`);
  };

  // ===== Plant a Story =====
  // Pay the publicist to leak a positive story. Roll for backfire.
  const plantStory = (plant) => {
    if (player.cash < plant.cost) return;

    const backfires = Math.random() < plant.backfireChance;
    const ctx = {}; // plant templates can use this if needed

    setPlayer(p => {
      const headline = typeof plant.headline === 'function' ? plant.headline(p, ctx) : plant.headline;
      const flavor = typeof plant.flavor === 'function' ? plant.flavor(p, ctx) : plant.flavor;
      const backfireHeadline = typeof plant.backfireHeadline === 'function' ? plant.backfireHeadline(p, ctx) : plant.backfireHeadline;
      const backfireFlavor = typeof plant.backfireFlavor === 'function' ? plant.backfireFlavor(p, ctx) : plant.backfireFlavor;

      let newFame = p.fame;
      let newScandals = [...(p.scandals || [])];
      let archiveEntry;

      if (backfires) {
        // Backfire: smaller fame gain (the story still partially ran), plus a scandal
        newFame = clamp(p.fame + Math.floor(plant.fameGain / 3), 0, 100);
        newScandals.push({
          id: `plant_backfire_${Date.now()}`,
          type: 'planted',
          severity: plant.backfireSeverity,
          started: { year: p.year, week: p.week },
          weeks: Math.round(3 + plant.backfireSeverity * 2),
          description: 'planted story exposed',
        });
        archiveEntry = {
          year: p.year,
          week: p.week,
          eventId: plant.id + '_backfired',
          headline: backfireHeadline,
          flavor: backfireFlavor,
          choice: `Tried to plant: ${plant.label}`,
          outcome: 'The press traced it back. Now it\'s a scandal.',
          tags: [...(plant.tags || []), 'backfired'],
        };
      } else {
        // Success: full fame gain, no scandal
        newFame = clamp(p.fame + plant.fameGain, 0, 100);
        archiveEntry = {
          year: p.year,
          week: p.week,
          eventId: plant.id,
          headline,
          flavor,
          choice: `Planted by publicist`,
          outcome: 'The story ran. Nobody knows it was placed.',
          tags: plant.tags || [],
        };
      }

      return {
        ...p,
        cash: p.cash - plant.cost,
        fame: newFame,
        peakFame: Math.max(p.peakFame || 0, newFame),
        scandals: newScandals,
        lastPlantedAt: { year: p.year, week: p.week },
        tabloidHistory: [...(p.tabloidHistory || []), archiveEntry],
      };
    });

    if (backfires) {
      addLog('PR', `Your "${plant.label}" plant backfired. The press exposed it.`);
    } else {
      addLog('PR', `Planted story: "${plant.label}" ran cleanly. +${plant.fameGain} fame.`);
    }
  };

  // ===== Retire =====
  const retire = () => {
    setPlayer(p => {
      const legacy = calcLegacy(p);
      return {
        ...p,
        status: 'retired',
        legacy,
      };
    });
    setView('legacy');
  };

  // Eligibility to found studio
  const canFoundStudio = !player.studio
    && player.cash >= 250_000
    && (player.fame >= 25 || ROLES.some(r => player.reputation[r] >= 30));

  // ============ RENDER ============

  if (view === 'newproj') {
    return (
      <>
        <ProjectBuilder
          player={player}
          offer={activeOffer}
          sequelOf={sequelOf}
          onCancel={() => { setActiveOffer(null); setSequelOf(null); setView('hub'); }}
          onProduce={(data) => { startProduction(data); setSequelOf(null); }}
        />
        <OpeningWeekendModal data={opening} onClose={() => setOpening(null)} />
        <AwardCeremonyModal ceremony={awardsSeason} playerName={player.name} player={player} onClose={closeAwardsCeremony} />
        <TabloidEventModal event={player.pendingEvent} onChoose={resolveTabloid} />
      </>
    );
  }

  if (view === 'production' && production) {
    return (
      <>
        <StatsBar player={player} />
        <ProductionHUD production={production} />
        {production.phase === 'preprod' && (
          <PreProductionScreen
            production={production}
            player={player}
            onChoice={applyProductionChoice}
            onAdvance={advancePhase}
          />
        )}
        {production.phase === 'filming' && (
          <FilmingScreen
            production={production}
            player={player}
            onChoice={applyProductionChoice}
            onAdvance={advancePhase}
          />
        )}
        {production.phase === 'postprod' && (
          <PostProductionScreen
            production={production}
            player={player}
            onChoice={applyProductionChoice}
            onAdvance={advancePhase}
          />
        )}
        {production.phase === 'marketing' && (
          <MarketingScreen
            production={production}
            player={player}
            onChoice={applyProductionChoice}
            onAdvance={advancePhase}
          />
        )}
        <OpeningWeekendModal data={opening} onClose={() => setOpening(null)} />
        <AwardCeremonyModal ceremony={awardsSeason} playerName={player.name} player={player} onClose={closeAwardsCeremony} />
        <TabloidEventModal event={player.pendingEvent} onChoose={resolveTabloid} />
      </>
    );
  }

  return (
    <div className="ht-fade-in">
      <StatsBar player={player} />

      {player.studio && (
        <div className="ht-studio-banner">
          <div className="ht-studio-name">{player.studio.name}</div>
          <div className="ht-studio-sub">
            Est. {player.studio.founded} · {player.studio.releases} releases · {player.studio.hits} hits · {player.studio.flops} flops · Lifetime gross {fmtMoney(player.studio.totalRevenue)}
          </div>
        </div>
      )}

      {view === 'hub' && (
        <>
          <Panel title={`Welcome, ${player.name}`} subtitle="What's your next move?">
            <p style={{ marginTop: 0 }} className="ht-text-dim">
              Take an offer to keep money coming in. Train to sharpen your craft. If you've built a name,
              you can found your own studio and call your own shots.
            </p>
            <div className="ht-row">
              <button className="ht-btn ht-btn-primary" onClick={() => { setListings([]); setView('offers'); }}>
                📜 Casting Board
              </button>
              <button className="ht-btn" onClick={() => setView('train')}>
                🎯 Train Skills
              </button>
              <button className="ht-btn" onClick={sideJob}>
                💵 Side Gig
              </button>
              {player.awards.history.length > 0 && (
                <button className="ht-btn" onClick={() => setView('awards')}>
                  🏆 Awards Cabinet
                </button>
              )}
              <button className="ht-btn" onClick={() => setView('career')}>
                📖 Career History
              </button>
              {(player.history || []).length > 0 && (
                <button className="ht-btn" onClick={() => setView('charts')}>
                  📊 Career Charts
                </button>
              )}
              <button className="ht-btn" onClick={() => setView('boulevard')}>
                🥂 The Boulevard
              </button>
              <button className="ht-btn" onClick={() => setView('personal')}>
                ❤️ Personal Life
                {(player.scandals || []).length > 0 && (
                  <span style={{ color: 'var(--red-bright)', marginLeft: 4 }}>!</span>
                )}
              </button>
              {Object.keys(player.franchises || {}).length > 0 && (
                <button className="ht-btn" onClick={() => setView('franchises')}>
                  🎞️ Franchises
                </button>
              )}
              {(player.tabloidHistory || []).length > 0 && (
                <button className="ht-btn" onClick={() => setView('clippings')}>
                  📰 Press Clippings
                </button>
              )}
              <button className="ht-btn" onClick={() => setView('saveload')}>
                💾 Save / Load
              </button>
              <button className="ht-btn" onClick={() => setView('world')}>
                🌐 The Industry
              </button>
              {player.studio && (
                <button className="ht-btn ht-btn-primary" onClick={() => { setActiveOffer(null); setView('newproj'); }}>
                  🎬 Greenlight Picture
                </button>
              )}
              {!player.studio && (
                <button
                  className="ht-btn"
                  disabled={!canFoundStudio}
                  onClick={() => setPendingFoundStudio(true)}
                  title={canFoundStudio ? '' : 'Need $250K cash and either 25+ fame or 30+ reputation in a role'}
                >
                  🏛 Found Your Studio
                </button>
              )}
              {(player.history.length >= 5 || player.age >= 50) && (
                <button className="ht-btn" onClick={() => setView('retire_confirm')}>
                  ⌛ Retire
                </button>
              )}
            </div>
          </Panel>

          <div className="ht-two-col">
            <LogPanel log={player.log} />
            <SkillsPanel player={player} />
          </div>

          {/* Studio Reserves — appears once studio is founded */}
          {player.studio && (
            <CollapsiblePanel
              id="reserves"
              title="Studio Reserves"
              subtitle="Park money for slow growth — locked during production"
              badge={(player.studio.reserves || 0) > 0 ? fmtMoney(player.studio.reserves || 0) : 'Empty'}
              defaultOpen={false}
            >
              <ReservesPanel
                player={player}
                onDeposit={depositToReserves}
                onWithdraw={withdrawFromReserves}
                productionActive={!!production}
              />
            </CollapsiblePanel>
          )}

          {/* Cameo offers — appears when there are pending or eligibility */}
          {((player.cameoOffers || []).length > 0 ||
            Object.values(player.worldNPCs || {}).some(n => (n.friendshipScore || 0) >= 3)) && (
            <CollapsiblePanel
              id="cameos"
              title="Cameo Invitations"
              subtitle="Quick on-screen favors from friends"
              badge={(player.cameoOffers || []).length > 0 ? `${(player.cameoOffers || []).length} pending` : 'None'}
              defaultOpen={(player.cameoOffers || []).length > 0}
            >
              <CameoOffersPanel
                player={player}
                onAccept={acceptCameo}
                onDecline={declineCameo}
              />
            </CollapsiblePanel>
          )}

          {/* First-Look Pitches — appears when there are deals or pending pitches */}
          {((player.firstLookDeals || []).length > 0 || (player.firstLookPitches || []).length > 0) && (
            <CollapsiblePanel
              id="firstlook"
              title="First-Look Pitches"
              subtitle="Projects pitched to you under retainer"
              badge={
                (player.firstLookPitches || []).length > 0
                  ? `${(player.firstLookPitches || []).length} pitch${(player.firstLookPitches || []).length === 1 ? '' : 'es'}`
                  : `${(player.firstLookDeals || []).length} deal${(player.firstLookDeals || []).length === 1 ? '' : 's'}`
              }
              defaultOpen={(player.firstLookPitches || []).length > 0}
            >
              <FirstLookPanel
                player={player}
                onDevelop={developFirstLookPitch}
                onPass={passFirstLookPitch}
              />
            </CollapsiblePanel>
          )}

          {/* Mentorship — appears when player has active mentees, alumni, or is mentor-eligible */}
          {((player.mentorships || []).filter(m => !m.endedYear).length > 0
            || (player.mentoredAlumni || []).length > 0
            || canMentor) && (
            <CollapsiblePanel
              id="mentorship"
              title="Mentorship"
              subtitle="Pass it on — invest in the next generation"
              badge={(() => {
                const active = (player.mentorships || []).filter(m => !m.endedYear).length;
                const alumni = (player.mentoredAlumni || []).length;
                if (active > 0) return `${active} active`;
                if (alumni > 0) return `${alumni} alumn${alumni === 1 ? 'us' : 'i'}`;
                return 'Available';
              })()}
              defaultOpen={(player.mentorships || []).filter(m => !m.endedYear).length > 0}
            >
              <MentorshipPanel
                player={player}
                onInvest={investMentorshipSession}
                onEnd={endMentorship}
              />
            </CollapsiblePanel>
          )}

          {/* Co-Producing — surfaces when player has pending offers, active investments, or settled history */}
          {((player.coProducingOffers || []).length > 0
            || (player.coProductions || []).length > 0
            || (player.coProductionsHistory || []).length > 0
            || ((player.history || []).length >= 5 && (player.reputation?.producer || 0) >= 15)) && (
            <CollapsiblePanel
              id="coproducing"
              title="Co-Producing"
              subtitle="Other studios' projects, your capital"
              badge={(() => {
                const offers = (player.coProducingOffers || []).length;
                const active = (player.coProductions || []).length;
                if (offers > 0) return `${offers} offer${offers === 1 ? '' : 's'}`;
                if (active > 0) return `${active} in flight`;
                return 'Available';
              })()}
              defaultOpen={(player.coProducingOffers || []).length > 0}
            >
              <CoProducingPanel
                player={player}
                onAccept={acceptCoProducingOffer}
                onDecline={declineCoProducingOffer}
              />
            </CollapsiblePanel>
          )}

          {/* Specialties panel */}
          {allSpecialties(player).length > 0 && (
            <CollapsiblePanel
              id="wheelhouse"
              title="Your Wheelhouse"
              subtitle="What Hollywood thinks you do best"
              badge={`${allSpecialties(player).length} ${allSpecialties(player).length === 1 ? 'specialty' : 'specialties'}`}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {allSpecialties(player).map(spec => {
                  const label = spec.tier.label === 'Working In'
                    ? `Working in ${spec.genre}`
                    : `${spec.genre} ${spec.tier.label}`;
                  const tierColor = spec.tier.label === 'Icon' ? 'var(--gold-bright)' :
                                    spec.tier.label === 'Specialist' ? 'var(--gold)' :
                                    'var(--gold-dim)';
                  return (
                    <div key={spec.genre} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderLeft: `3px solid ${tierColor}`, padding: '10px 14px' }}>
                      <div style={{ fontFamily: "'Limelight', serif", color: tierColor, fontSize: '0.95rem' }}>
                        {label}
                      </div>
                      <div className="ht-text-dim" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                        {spec.count} {spec.count === 1 ? 'film' : 'films'} in {spec.genre}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsiblePanel>
          )}

          {(player.possessions || []).length > 0 && (
            <CollapsiblePanel
              id="holdings"
              title="Holdings"
              subtitle="What you own"
              badge={`${(player.possessions || []).length} ${(player.possessions || []).length === 1 ? 'item' : 'items'}`}
              defaultOpen={false}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {(player.possessions || []).map(id => {
                  const item = PURCHASES.find(p => p.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderLeft: '3px solid var(--gold)', padding: '8px 12px' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, color: 'var(--gold-bright)', fontSize: '0.95rem' }}>
                        {item.name}
                      </div>
                      {item.weeklyUpkeep > 0 && (
                        <div className="ht-text-dim" style={{ fontSize: '0.75rem' }}>
                          {fmtMoney(item.weeklyUpkeep)}/wk upkeep
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsiblePanel>
          )}

          {(player.inTheaters || []).length > 0 && (
            <CollapsiblePanel
              id="intheaters"
              title="In Theaters"
              subtitle="Films currently in their run"
              badge={`${(player.inTheaters || []).length} active`}
            >
              {player.inTheaters.map((film, i) => {
                const totalSoFar = film.currentCumulative || 0;
                const projectedTotal = film.result.boxOffice;
                const pct = clamp((totalSoFar / projectedTotal) * 100, 0, 100);
                // Mini sparkline data: pad with empty until current week
                const partialRun = film.run.slice(0, film.currentWeekInRun);
                return (
                  <div
                    key={i}
                    style={{
                      padding: '12px 14px',
                      marginBottom: 10,
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid var(--border)',
                      borderLeft: '3px solid var(--gold-bright)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setViewedFilm(film)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <strong style={{ color: 'var(--gold-bright)', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '1.05rem' }}>
                          "{film.title}"
                        </strong>
                        <span className="ht-text-dim"> · {film.genre} · Week {film.currentWeekInRun} of {film.runWeeks}</span>
                      </div>
                      <div>
                        <span className="ht-tag">C {film.result.criticScore}</span>
                        <span className="ht-tag">A {film.result.audienceScore}</span>
                        <strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(totalSoFar)}</strong>
                      </div>
                    </div>
                    {/* Mini sparkline */}
                    <div style={{ marginTop: 8 }}>
                      <BoxOfficeChart run={partialRun} height={70} showCumulative={false} />
                    </div>
                  </div>
                );
              })}
            </CollapsiblePanel>
          )}

          {player.history.length > 0 && (
            <CollapsiblePanel
              id="filmography"
              title="Filmography"
              subtitle="Your body of work — click to see the run"
              badge={`${player.history.length} ${player.history.length === 1 ? 'film' : 'films'}`}
              defaultOpen={false}
            >
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {player.history.slice().reverse().slice(0, 12).map((m, i) => {
                  // Find awards events for this film
                  const filmAwards = player.awards.history.filter(e => e.film === m.title && e.year === (m.releaseYear || m.year));
                  const filmWins = filmAwards.filter(e => e.won).length;
                  const filmNoms = filmAwards.length;
                  return (
                    <div
                      key={i}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)', cursor: 'pointer' }}
                      onClick={() => setViewedFilm(m)}
                    >
                      <span>
                        <strong style={{ color: 'var(--gold-bright)' }}>{m.title}</strong>
                        {m.franchise && m.franchise.entry > 1 && (
                          <span className="ht-tag" style={{ marginLeft: 6, borderColor: 'var(--gold-bright)', color: 'var(--gold-bright)' }}>
                            Sequel · Entry {m.franchise.entry}
                          </span>
                        )}
                        {(m.playerRoles || []).length === 3 && (
                          <span className="ht-tag" style={{ marginLeft: 6, borderColor: 'var(--gold-bright)', color: 'var(--gold-bright)' }}>
                            Triple Threat
                          </span>
                        )}
                        {(m.playerRoles || []).length === 4 && (
                          <span className="ht-tag" style={{ marginLeft: 6, borderColor: 'var(--gold-bright)', color: 'var(--gold-bright)', background: 'rgba(212,166,74,0.2)' }}>
                            ★ Quadruple Threat
                          </span>
                        )}
                        {m.festivalRun && (
                          <span className="ht-tag" style={{ marginLeft: 6, borderColor: 'var(--gold-bright)', color: 'var(--gold-bright)' }} title={`Played at ${m.festivalRun.festivalName}`}>
                            🎟 {m.festivalRun.festivalName}
                          </span>
                        )}
                        {filmWins > 0 && <span title={`${filmWins} award win${filmWins === 1 ? '' : 's'}`}> 🏆{filmWins > 1 ? `×${filmWins}` : ''}</span>}
                        {filmNoms > filmWins && <span title={`${filmNoms - filmWins} nomination${filmNoms - filmWins === 1 ? '' : 's'}`}> ⭐{filmNoms - filmWins > 1 ? `×${filmNoms - filmWins}` : ''}</span>}
                        <span className="ht-text-dim"> · {m.genre} · {m.year} · as {m.playerRoles.map(r => ROLE_LABELS[r]).join('/')}</span>
                      </span>
                      <span>
                        <span className="ht-tag">C {m.result.criticScore}</span>
                        <span className="ht-tag">A {m.result.audienceScore}</span>
                        <span style={{ color: m.result.profit > 0 ? '#6fcc4c' : 'var(--red-bright)', fontWeight: 700 }}>
                          {fmtMoney(m.result.boxOffice)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </CollapsiblePanel>
          )}

          {pendingFoundStudio && (
            <div className="ht-modal-bg" onClick={() => setPendingFoundStudio(false)}>
              <div className="ht-poster" onClick={e => e.stopPropagation()}>
                <div className="ht-poster-tag">★ A Bold New Venture ★</div>
                <div className="ht-poster-title">Open Your Own Studio?</div>
                <p style={{ textAlign: 'center', marginTop: 20 }}>
                  Incorporating a studio costs <strong style={{ color: 'var(--gold-bright)' }}>$250,000</strong>.
                  Once founded, you can greenlight your own pictures — but you'll pay every dollar of the budget
                  yourself, and keep every dollar of the gross.
                </p>
                <div className="ht-row" style={{ justifyContent: 'center', marginTop: 20 }}>
                  <button className="ht-btn" onClick={() => setPendingFoundStudio(false)}>Not Yet</button>
                  <button className="ht-btn ht-btn-primary" onClick={foundStudio}>Sign the Papers</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'offers' && (() => {
        // Apply filter
        let filteredListings = listings;
        if (castingFilter === 'offers') filteredListings = listings.filter(l => l.kind === 'offer');
        else if (castingFilter === 'auditions') filteredListings = listings.filter(l => l.kind === 'audition');
        else if (castingFilter === 'wheelhouse') filteredListings = listings.filter(l => getGenreSpecialty(player, l.genre));
        // Apply sort
        if (castingSort === 'budget') filteredListings = [...filteredListings].sort((a, b) => b.budget - a.budget);
        else if (castingSort === 'pay') filteredListings = [...filteredListings].sort((a, b) => b.pay - a.pay);
        else if (castingSort === 'genre') filteredListings = [...filteredListings].sort((a, b) => a.genre.localeCompare(b.genre));

        return (
        <Panel title="The Casting Board" subtitle="Offers, auditions, and open calls">
          <p className="ht-text-dim" style={{ marginTop: 0 }}>
            Big names get offered roles outright. Everyone else auditions. Either way: this is where the work comes from.
          </p>

          {/* Filter / sort controls */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, marginTop: 6, padding: '8px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="ht-text-dim" style={{ fontSize: '0.78rem', letterSpacing: '0.05em' }}>FILTER:</span>
              {[['all', 'All'], ['offers', 'Offers'], ['auditions', 'Auditions'], ['wheelhouse', '★ Wheelhouse']].map(([k, lbl]) => (
                <button
                  key={k}
                  className={`ht-btn ht-btn-sm ${castingFilter === k ? 'ht-btn-primary' : ''}`}
                  onClick={() => setCastingFilter(k)}
                  style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="ht-text-dim" style={{ fontSize: '0.78rem', letterSpacing: '0.05em' }}>SORT:</span>
              {[['default', 'Default'], ['budget', 'Budget'], ['pay', 'Pay'], ['genre', 'Genre']].map(([k, lbl]) => (
                <button
                  key={k}
                  className={`ht-btn ht-btn-sm ${castingSort === k ? 'ht-btn-primary' : ''}`}
                  onClick={() => setCastingSort(k)}
                  style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* OFFERS section */}
          {filteredListings.some(l => l.kind === 'offer') && (
            <>
              <div className="ht-label" style={{ marginTop: 10 }}>📜 Direct Offers</div>
              {filteredListings.filter(l => l.kind === 'offer').map((o, i) => {
                const spec = getGenreSpecialty(player, o.genre);
                return (
                <div key={`o-${i}`} className="ht-offer-card" style={spec ? { borderLeft: '3px solid var(--gold-bright)' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div className="ht-offer-title">
                        {o.title}
                        {spec && (
                          <Tooltip text={
                            spec.tier.label === 'Icon'
                              ? `${spec.genre} Icon: +8 quality, +5 audience, 1.2× fame on this film. +30% studio budget cap.`
                              : spec.tier.label === 'Specialist'
                                ? `${spec.genre} Specialist: +5 quality, +3 audience. You're known for this.`
                                : `Working in ${spec.genre}: +2 quality. Building a track record.`
                          }>
                            <span className="ht-tag" style={{ marginLeft: 8, color: 'var(--gold-bright)', borderColor: 'var(--gold-bright)' }}>
                              Your wheelhouse
                            </span>
                          </Tooltip>
                        )}
                      </div>
                      <div className="ht-text-dim">A {o.genre} picture · You: {ROLE_LABELS[o.playerRole]}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div><span className="ht-tag">Budget</span><strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(o.budget)}</strong></div>
                      <div style={{ marginTop: 4 }}><span className="ht-tag">Your Pay</span><strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(o.pay)}</strong></div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.88rem', marginTop: 10 }}>
                    <strong>Attached: </strong>
                    <CrewAttached project={o} player={player} />
                  </div>
                  <div className="ht-row">
                    <button className="ht-btn ht-btn-primary ht-btn-sm" onClick={() => acceptOffer(o)}>
                      Accept Role
                    </button>
                  </div>
                </div>
                );
              })}
            </>
          )}

          {/* AUDITIONS section */}
          {filteredListings.some(l => l.kind === 'audition') && (
            <>
              <div className="ht-label" style={{ marginTop: 18 }}>🎤 Auditions & Open Calls</div>
              {filteredListings.filter(l => l.kind === 'audition').map((a, i) => {
                const heat = playerHeat(player, a.playerRole);
                // Rough player-facing odds preview
                const oddsRaw = (heat - a.threshold + 25) / 50; // -25 margin = 0%, +25 = 100%
                const oddsPct = clamp(Math.round(oddsRaw * 100), 1, 99);
                const oddsLabel = oddsPct >= 75 ? 'Strong shot' : oddsPct >= 50 ? 'Decent shot' : oddsPct >= 25 ? 'Long shot' : 'Dark horse';
                return (
                  <div key={`a-${i}`} className="ht-offer-card" style={a.prestige ? { borderColor: 'var(--gold-bright)', borderWidth: 2 } : {}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div className="ht-offer-title">
                          {a.title}
                          {a.prestige && <span className="ht-tag" style={{ marginLeft: 8, borderColor: 'var(--gold-bright)', color: 'var(--gold-bright)' }}>Prestige</span>}
                        </div>
                        <div className="ht-text-dim">A {a.genre} picture · Casting: {ROLE_LABELS[a.playerRole]}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div><span className="ht-tag">Budget</span><strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(a.budget)}</strong></div>
                        <div style={{ marginTop: 4 }}><span className="ht-tag">If Booked</span><strong style={{ color: 'var(--gold-bright)' }}>{fmtMoney(a.pay)}</strong></div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.88rem', marginTop: 10 }}>
                      <strong>Attached: </strong>
                      <CrewAttached project={a} player={player} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <span className="ht-text-dim">Competing with {a.competitors} others</span>
                        <span style={{ marginLeft: 12, color: oddsPct >= 50 ? '#6fcc4c' : oddsPct >= 25 ? 'var(--gold-bright)' : 'var(--red-bright)' }}>
                          <Tooltip text="Based on your skill, reputation, and fame for this role vs. the casting threshold. Auditions still have luck — strong shots can fail, dark horses can win.">
                            {oddsLabel} (~{oddsPct}%)
                          </Tooltip>
                        </span>
                      </div>
                      <button className="ht-btn ht-btn-sm" onClick={() => attemptAudition(a)}>
                        Audition (1 week)
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {filteredListings.length === 0 && listings.length > 0 && (
            <p className="ht-text-dim">No listings match this filter. Try "All" or refresh the board.</p>
          )}
          {listings.length === 0 && (
            <p className="ht-text-dim">Nothing on the board. Refresh and check back.</p>
          )}

          <div className="ht-row" style={{ marginTop: 16 }}>
            <button className="ht-btn" onClick={() => setView('hub')}>← Back</button>
            <button className="ht-btn" onClick={refreshListings}>Refresh Board</button>
          </div>
        </Panel>
        );
      })()}

      {view === 'train' && (
        <Panel title="Training" subtitle="Sharpen your craft">
          <p className="ht-text-dim" style={{ marginTop: 0 }}>
            A week of coaching costs more as you get better — and gives less. Pros work at the margins.
          </p>
          {ROLES.map(r => {
            const cost = 2000 + player.skills[r] * 80;
            return (
              <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                <div>
                  <div className="ht-skill-name">{ROLE_LABELS[r]} Coaching</div>
                  <div className="ht-text-dim" style={{ fontSize: '0.85rem' }}>Current skill: {player.skills[r]}</div>
                </div>
                <button
                  className="ht-btn ht-btn-sm"
                  onClick={() => train(r)}
                  disabled={player.cash < cost}
                >
                  Train · {fmtMoney(cost)}
                </button>
              </div>
            );
          })}
          <div className="ht-row" style={{ marginTop: 16 }}>
            <button className="ht-btn" onClick={() => setView('hub')}>← Back</button>
          </div>
        </Panel>
      )}

      {view === 'awards' && (
        <Panel title="Awards Cabinet" subtitle={`${player.awards.wins} wins · ${player.awards.nominations} nominations`}>
          {player.awards.history.length === 0 ? (
            <p className="ht-text-dim">No awards recognition yet. Make a great picture — and consider a serious FYC campaign.</p>
          ) : (
            <>
              {/* Group by year, descending */}
              {Array.from(new Set(player.awards.history.map(e => e.year))).sort((a, b) => b - a).map(year => {
                const yearEvents = player.awards.history.filter(e => e.year === year);
                const wins = yearEvents.filter(e => e.won).length;
                const noms = yearEvents.length;
                return (
                  <div key={year} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--gold-dim)', paddingBottom: 4, marginBottom: 8 }}>
                      <span style={{ fontFamily: "'Limelight', serif", color: 'var(--gold-bright)', fontSize: '1.2rem' }}>{year}</span>
                      <span className="ht-text-dim" style={{ fontSize: '0.85rem' }}>{wins} won · {noms} nominated</span>
                    </div>
                    {yearEvents.map((e, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.92rem' }}>
                        <span style={{ color: e.won ? 'var(--gold-bright)' : 'var(--cream)' }}>
                          {e.won ? '🏆 ' : '⭐ '}
                          <strong>{e.categoryLabel}</strong>
                          <span className="ht-text-dim"> for "{e.film}"</span>
                        </span>
                        <span className="ht-text-dim" style={{ fontSize: '0.85rem' }}>{e.body}</span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Lifetime per-role summary */}
              <hr className="ht-divider" />
              <div className="ht-label">Career Totals</div>
              <div className="ht-skills-grid" style={{ marginTop: 10 }}>
                {ROLES.map(r => {
                  const roleNoms = player.awards.history.filter(e => e.role === r).length;
                  const roleWins = player.awards.history.filter(e => e.role === r && e.won).length;
                  if (roleNoms === 0) return null;
                  return (
                    <div key={r} className="ht-skill">
                      <div className="ht-skill-row">
                        <span className="ht-skill-name">{ROLE_LABELS[r]}</span>
                        <span className="ht-skill-num">{roleWins}W · {roleNoms}N</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="ht-row" style={{ marginTop: 16 }}>
            <button className="ht-btn" onClick={() => setView('hub')}>← Back</button>
          </div>
        </Panel>
      )}

      {view === 'career' && (
        <CareerHistory player={player} onClose={() => setView('hub')} />
      )}

      {view === 'charts' && (
        <CareerCharts player={player} onClose={() => setView('hub')} />
      )}

      {view === 'boulevard' && (
        <Boulevard
          player={player}
          onBuy={buyItem}
          onSell={sellItem}
          onIndulgence={doIndulgence}
          onClose={() => setView('hub')}
        />
      )}

      {view === 'personal' && (
        <PersonalLife
          player={player}
          production={production}
          onAction={handlePersonalAction}
          onPlant={plantStory}
          onClose={() => setView('hub')}
        />
      )}

      {view === 'franchises' && (
        <FranchisesView
          player={player}
          onMakeSequel={startSequel}
          onAcceptSale={acceptFranchiseSale}
          onDeclineSale={declineFranchiseSale}
          onClose={() => setView('hub')}
        />
      )}

      {view === 'clippings' && (
        <PressClippings
          player={player}
          onClose={() => setView('hub')}
        />
      )}

      {view === 'saveload' && (
        <SaveLoadView
          player={player}
          onLoad={(p) => { onLoad(p); setView('hub'); }}
          onClose={() => setView('hub')}
        />
      )}

      {view === 'world' && (
        <WorldView
          player={player}
          onSignFirstLook={signFirstLookDeal}
          onCancelFirstLook={cancelFirstLookDeal}
          firstLookCost={firstLookRetainer}
          onStartMentorship={startMentorship}
          canMentor={canMentor}
          isMenteeEligible={isMenteeEligible}
          onClose={() => setView('hub')}
        />
      )}

      {view === 'retire_confirm' && (() => {
        const previewLegacy = calcLegacy(player);
        return (
          <div className="ht-fade-in">
            <Panel title="Retire from the Industry?" subtitle="A career has a beginning, a middle, and an end">
              <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                You've been at this for {player.year - (player.startYear || 1985)} years. {player.history.length} films. {player.awards?.wins || 0} wins.
              </p>

              {/* Legacy preview */}
              <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)', marginTop: 16 }}>
                <div className="ht-phase-block-title">★ If You Retired Today...</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                  <div>
                    <div className="ht-text-dim" style={{ fontSize: '0.82rem', letterSpacing: '0.05em' }}>LEGACY TIER</div>
                    <div style={{ fontFamily: "'Limelight', serif", fontSize: '1.4rem', color: 'var(--gold-bright)' }}>
                      {previewLegacy.tier.label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="ht-text-dim" style={{ fontSize: '0.82rem', letterSpacing: '0.05em' }}>SCORE</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.6rem', color: 'var(--gold-bright)' }}>
                      {previewLegacy.score}
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div style={{ marginTop: 12, fontSize: '0.82rem' }}>
                  <div className="ht-label" style={{ marginBottom: 4 }}>Score Breakdown</div>
                  {(() => {
                    const lifetimeBox = player.history.reduce((s, f) => s + (f.result?.boxOffice || 0), 0);
                    const boxScore = Math.round(clamp(lifetimeBox / 10_000_000, 0, 50));
                    const wins = player.awards?.wins || 0;
                    const noms = player.awards?.nominations || 0;
                    const awardScore = Math.round(clamp(wins * 8 + (noms - wins) * 2, 0, 60));
                    const peakScore = Math.round(clamp((player.peakFame || 0) * 0.4, 0, 40));
                    let empireScore = 0;
                    if (player.studio) empireScore += 20;
                    empireScore += Math.min(20, Object.keys(player.franchises || {}).length * 5);
                    const filmScore = Math.round(clamp(player.history.length * 1.5, 0, 30));
                    const rows = [
                      ['Lifetime Box Office', boxScore, 50, fmtMoney(lifetimeBox)],
                      ['Awards (wins + noms)', awardScore, 60, `${wins} wins, ${noms - wins} additional noms`],
                      ['Peak Fame', peakScore, 40, `peaked at ${Math.round(player.peakFame || 0)}`],
                      ['Empire (studio + franchises)', empireScore, 40, `${player.studio ? 'studio' : 'no studio'}, ${Object.keys(player.franchises || {}).length} franchise${Object.keys(player.franchises || {}).length === 1 ? '' : 's'}`],
                      ['Body of Work', filmScore, 30, `${player.history.length} films`],
                    ];
                    return rows.map(([label, val, max, detail]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed var(--border)' }}>
                        <span>
                          <span style={{ color: 'var(--cream)' }}>{label}</span>
                          <span className="ht-text-dim" style={{ fontSize: '0.78rem', marginLeft: 6 }}>({detail})</span>
                        </span>
                        <span style={{ color: 'var(--gold-bright)', fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                          {val}<span className="ht-text-dim" style={{ fontSize: '0.78rem' }}>/{max}</span>
                        </span>
                      </div>
                    ));
                  })()}
                </div>

                {previewLegacy.definingDecade && (
                  <p className="ht-text-dim" style={{ fontSize: '0.85rem', marginTop: 10, fontStyle: 'italic' }}>
                    Defining era: the {previewLegacy.definingDecade}s.
                  </p>
                )}
              </div>

              <p style={{ fontStyle: 'italic', color: 'var(--cream-dim)', margin: '18px 0 14px' }}>
                You can keep working — more films can raise your score and tier. But retiring closes the book and lets you begin a new generation in the same world.
              </p>
              <div className="ht-row" style={{ justifyContent: 'center', marginTop: 20 }}>
                <button className="ht-btn ht-btn-primary" onClick={retire}>Retire as {previewLegacy.tier.label}</button>
                <button className="ht-btn" onClick={() => setView('hub')}>← Not Yet</button>
              </div>
            </Panel>
          </div>
        );
      })()}

      {view === 'legacy' && (
        <LegacyView
          player={player}
          onNewCareer={onRetireToNew}
          onContinue={null}
        />
      )}

      <AuditionResultModal data={auditionResult} onAccept={acceptBookedRole} onClose={() => setAuditionResult(null)} />
      <AwardCeremonyModal ceremony={awardsSeason} playerName={player.name} player={player} onClose={closeAwardsCeremony} />
      <OpeningWeekendModal data={opening} onClose={() => setOpening(null)} />
      <FilmChartModal
        film={viewedFilm}
        player={player}
        onReRelease={beginDirectorsCut}
        onClose={() => setViewedFilm(null)}
      />
      <TabloidEventModal event={player.pendingEvent} onChoose={resolveTabloid} />
      {pendingYearRecap && (
        <YearInVarietyModal
          year={pendingYearRecap.year}
          player={player}
          onClose={() => setPendingYearRecap(null)}
        />
      )}
      {pendingLifetimeAchievement && (
        <LifetimeAchievementModal
          player={player}
          onAccept={() => {
            setPlayer(p => ({
              ...p,
              lifetimeAchievementYear: p.year,
              fame: Math.max(p.fame, 60), // floor effective immediately
            }));
            addLog('Career', `🌟 You received a Lifetime Achievement Award. Hollywood remembers.`);
            setPendingLifetimeAchievement(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- ROOT ----------

export default function App() {
  const [player, setPlayer] = useState(null);
  // On first mount, check for an auto-save and offer to resume
  const [pendingResume, setPendingResume] = useState(null);
  // When a player retires and clicks "Begin New Career," capture the inherited world
  const [inheritedWorld, setInheritedWorld] = useState(null);

  useEffect(() => {
    const saved = loadAutoSave();
    if (saved && saved.name && saved.status !== 'retired') {
      setPendingResume(saved);
    } else {
      // No active career to resume — check for inherited world state
      const world = loadWorldState();
      if (world && world.legends && world.legends.length > 0) {
        // Inherit the world for the next career
        // Use the last known year as the new start, but bump it forward by a few years
        // We don't have NPCs stored separately, so seed fresh ones
        // (NPCs are tied to player saves, not world state — we just preserve legends + generation)
        setInheritedWorld({
          worldNPCs: null, // will fall through to fresh seed in initialPlayer
          newStartYear: 1985 + (world.generation - 1) * 30, // each generation = 30 years later
          legends: world.legends,
          generation: world.generation,
        });
      }
    }
    // eslint-disable-next-line
  }, []);

  // Auto-save whenever the player state changes
  useEffect(() => {
    if (player) {
      autoSave(player);
    }
  }, [player]);

  const start = (name, role) => {
    const p = initialPlayer(name, role, inheritedWorld);
    p.log.push({
      label: 'Headline',
      text: inheritedWorld
        ? `${name} arrives in Hollywood as the new generation. The names on the marquee have changed.`
        : `${name} signs with an agent and starts knocking on doors as a young ${ROLE_LABELS[role].toLowerCase()}.`,
    });
    setPlayer(p);
    setPendingResume(null);
    setInheritedWorld(null); // consumed
  };

  const resumeAutoSave = () => {
    setPlayer(pendingResume);
    setPendingResume(null);
  };

  const declineResume = () => {
    setPendingResume(null);
  };

  const loadPlayer = (p) => {
    setPlayer(p);
  };

  // Retirement → new career: evolve the world, save it, clear the player so
  // StartScreen shows. The new player will inherit the world via inheritedWorld.
  const retireToNew = () => {
    if (!player) return;
    const evolved = evolveWorldForNewGeneration(player, 3);
    saveWorldState({ legends: evolved.legends, generation: evolved.generation });
    setInheritedWorld(evolved);
    // Clear the autosave of the retired player so it doesn't resume
    if (hasLocalStorage()) {
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
    }
    setPlayer(null);
  };

  const reset = () => {
    if (typeof window !== 'undefined' && window.confirm('End this career? Your auto-save will be cleared. (Save manually first to keep it.)')) {
      if (hasLocalStorage()) {
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
      }
      setPlayer(null);
      setInheritedWorld(null);
    }
  };

  return (
    <div className="ht-root">
      <style>{STYLES}</style>
      <div className="ht-container">
        <Marquee />
        {pendingResume && !player ? (
          <ResumeScreen save={pendingResume} onResume={resumeAutoSave} onDecline={declineResume} />
        ) : !player ? (
          <StartScreen onStart={start} inheritedWorld={inheritedWorld} />
        ) : (
          <>
            <MainGame
              key={`${player.name}-${player.startYear}`}
              player={player}
              setPlayer={setPlayer}
              onLoad={loadPlayer}
              onRetireToNew={retireToNew}
            />
            <div style={{ textAlign: 'center', marginTop: 30 }}>
              <button className="ht-btn ht-btn-danger ht-btn-sm" onClick={reset}>
                End Career (Reset)
              </button>
            </div>
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: 30, color: 'var(--cream-dim)', fontFamily: "'Special Elite', monospace", fontSize: '0.75rem', letterSpacing: '0.2em' }}>
          ★ HOLLYWOOD TYCOON · v0.27 ★
        </div>
      </div>
    </div>
  );
}

// Resume-from-auto-save splash screen
function ResumeScreen({ save, onResume, onDecline }) {
  return (
    <div className="ht-fade-in">
      <Panel title="Welcome Back" subtitle="An auto-saved career is waiting">
        <div className="ht-phase-block" style={{ borderLeftColor: 'var(--gold-bright)' }}>
          <div className="ht-phase-block-title">Your career so far:</div>
          <p style={{ margin: '6px 0', fontSize: '1.05rem' }}>
            <strong style={{ color: 'var(--gold-bright)', fontFamily: "'Limelight', serif", fontSize: '1.3rem' }}>{save.name}</strong>
          </p>
          <p style={{ fontSize: '0.92rem' }}>
            Year {save.year} · Week {save.week} · Age {save.age}<br />
            Fame {Math.round(save.fame)} · {fmtMoney(save.cash)} on hand<br />
            {save.history?.length || 0} films released
            {save.studio && ` · runs ${save.studio.name}`}
          </p>
        </div>
        <div className="ht-row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button className="ht-btn ht-btn-primary" onClick={onResume}>Resume Career</button>
          <button className="ht-btn ht-btn-danger" onClick={onDecline}>Start Fresh</button>
        </div>
        <p className="ht-text-dim" style={{ fontSize: '0.82rem', marginTop: 14, textAlign: 'center' }}>
          ⓘ "Start Fresh" abandons your saved career. It won't be recoverable unless you exported it.
        </p>
      </Panel>
    </div>
  );
}
