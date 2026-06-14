// English test corpus for Agent D round-6
// Hardcoded public-domain English texts. No network fetching.
// 3 short (20-50 chars), 4 medium (50-150 chars), 3 long (150-300 chars),
// 2 with proper nouns/numbers/dates.

export const ENGLISH_TEXTS = [
  // ----- 3 SHORT (20-50 chars) -----
  {
    id: "en-1-short",
    category: "short",
    text: "The quick brown fox jumps over the lazy dog."
  },
  {
    id: "en-2-short",
    category: "short",
    text: "Reading is to the mind what exercise is to the body."
  },
  {
    id: "en-3-short",
    category: "short",
    text: "All that glitters is not gold, and not all who wander are lost."
  },

  // ----- 4 MEDIUM (50-150 chars) -----
  {
    id: "en-4-medium",
    category: "medium",
    text: "The Tortoise and the Hare were neighbors. The Hare always laughed at the Tortoise for being slow. One day the Tortoise grew tired of the laughter and challenged the Hare to a race."
  },
  {
    id: "en-5-medium",
    category: "medium",
    text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness. Cities sprung up and empires fell across the small planet."
  },
  {
    id: "en-6-medium",
    category: "medium",
    text: "To be, or not to be, that is the question. Whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles."
  },
  {
    id: "en-7-medium",
    category: "medium",
    text: "Knowledge is of no value unless you put it into practice. A single conversation with a wise man is better than ten years of solitary study."
  },

  // ----- 3 LONG (150-300 chars) -----
  {
    id: "en-8-long",
    category: "long",
    text: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort. It had a perfectly round door like a porthole, painted green, with a shiny yellow brass knob in the exact middle."
  },
  {
    id: "en-9-long",
    category: "long",
    text: "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen, and regulating the circulation."
  },
  {
    id: "en-10-long",
    category: "long",
    text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters."
  },

  // ----- 2 WITH PROPER NOUNS / NUMBERS / DATES -----
  {
    id: "en-11-proper",
    category: "proper-nouns",
    text: "On July 4, 1776, the Declaration of Independence was signed in Philadelphia by delegates from the thirteen American colonies."
  },
  {
    id: "en-12-proper",
    category: "proper-nouns",
    text: "Albert Einstein published his theory of general relativity in 1915, and later received the Nobel Prize in Physics in 1921 for his work on the photoelectric effect."
  }
];