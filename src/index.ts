/**
 * Aequidrape — Main Application Interface
 * Day 1–2 Foundation: Core utilities + deterministic logic
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { Garment, UserProfile, AccessInsight, ReviewResult } from "./types.js";
import { evaluateGarmentFit } from "./rulesEngine.js";
import { generateAudioSummary, generateMarkdownSummary, generateSellerEmailTemplate } from "./summaryGenerator.js";

/**
 * Load garment catalog from JSON
 */
function loadGarments(): Garment[] {
  const catalogPath = resolve("data/garments.json");
  const rawData = readFileSync(catalogPath, "utf-8");
  return JSON.parse(rawData);
}

/**
 * Get garment by ID
 */
export function getGarmentById(id: string): Garment | null {
  const garments = loadGarments();
  return garments.find((g) => g.id === id) || null;
}

/**
 * Get all garments
 */
export function getAllGarments(): Garment[] {
  return loadGarments();
}

/**
 * Main evaluation workflow: Profile + Garment → Full Review Result
 */
export function evaluateAccessibility(profile: UserProfile, garment: Garment): ReviewResult {
  const insight = evaluateGarmentFit(profile, garment);

  return {
    user_profile: profile,
    garment,
    insight,
    timestamp: new Date().toISOString(),
    mode: "simulation", // No VTO on Day 1–2; will change to 'cached' or 'live' on Day 8
  };
}

/**
 * Full review with all output formats ready
 */
export interface FullReview extends ReviewResult {
  audio_summary: string;
  markdown_summary: string;
  seller_email_template: string;
}

export function generateFullReview(profile: UserProfile, garment: Garment): FullReview {
  const result = evaluateAccessibility(profile, garment);

  return {
    ...result,
    audio_summary: generateAudioSummary(result.insight),
    markdown_summary: generateMarkdownSummary(result.insight, profile, garment),
    seller_email_template: generateSellerEmailTemplate(result.insight, profile, garment),
  };
}

/**
 * Test Entry Point — Run manual tests on Day 2
 */
export function testFramework() {
  console.log("\n=== Aequidrape Foundation Test ===\n");

  // Test 1: Load garments
  console.log("[Test 1] Loading garment catalog...");
  const garments = getAllGarments();
  console.log(`✓ Loaded ${garments.length} garments`);
  garments.forEach((g) => {
    console.log(`  - ${g.name} (closure: ${g.closure_type}, back-rise: ${g.back_rise})`);
  });

  // Test 2: Create test profiles
  console.log("\n[Test 2] Creating test profiles...");
  const profile1: UserProfile = {
    posture: "seated",
    dexterity: "limited",
    sensory: ["tag-sensitive", "seam-sensitive"],
    mobility_aids: ["wheelchair"],
    fit_concerns: ["back-coverage", "pocket-access"],
  };
  const profile2: UserProfile = {
    posture: "standing",
    dexterity: "standard",
    sensory: [],
    mobility_aids: [],
    fit_concerns: [],
  };
  console.log(`✓ Created 2 test profiles (seated+limited vs. standing+standard)`);

  // Test 3: Evaluate jacket with both profiles
  console.log("\n[Test 3] Evaluating Adaptive Jacket with both profiles...");
  const jacket = garments.find((g) => g.id === "adaptive-jacket-001");
  if (!jacket) {
    console.error("✗ Jacket not found!");
    return;
  }

  const review1 = generateFullReview(profile1, jacket);
  const review2 = generateFullReview(profile2, jacket);

  console.log("\n--- Profile 1 (Seated + Limited Dexterity) ---");
  console.log(`Confidence: ${review1.insight.confidence}`);
  console.log(`Compatibility: ${review1.insight.compatibility.length} matches`);
  console.log(`Risks: ${review1.insight.risks.length} concerns`);
  console.log(`Summary: ${review1.insight.summary}`);
  console.log(`\nAudio (excerpt): ${review1.audio_summary.substring(0, 100)}...`);

  console.log("\n--- Profile 2 (Standing + Standard) ---");
  console.log(`Confidence: ${review2.insight.confidence}`);
  console.log(`Compatibility: ${review2.insight.compatibility.length} matches`);
  console.log(`Risks: ${review2.insight.risks.length} concerns`);
  console.log(`Summary: ${review2.insight.summary}`);

  // Test 4: Verify outputs differ (this is the key demo contrast)
  console.log("\n[Test 4] Verifying demo contrast...");
  if (review1.insight.confidence !== review2.insight.confidence) {
    console.log(`✓ CONTRAST ACHIEVED: Profile 1 = ${review1.insight.confidence}, Profile 2 = ${review2.insight.confidence}`);
  } else {
    console.log(`⚠ No confidence difference (both ${review1.insight.confidence})`);
  }

  if (review1.insight.risks.length > review2.insight.risks.length) {
    console.log(`✓ Risk difference detected: P1 = ${review1.insight.risks.length}, P2 = ${review2.insight.risks.length}`);
  }

  console.log("\n=== Foundation Test Complete ===\n");
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFramework();
}
