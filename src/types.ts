/**
 * Aequidrape Data Model
 * All types locked from details.md Section 5
 */

/**
 * User Accessibility Profile
 * Represents physical/sensory/dexterity needs without inferring disability
 */
export type Posture = "seated" | "standing" | "mixed";
export type DexterityLevel = "standard" | "limited" | "one_handed";

export interface UserProfile {
  id?: string;
  posture: Posture;
  dexterity: DexterityLevel;
  sensory: string[]; // e.g., ["tag-sensitive", "seam-sensitive", "texture-sensitive"]
  mobility_aids: string[]; // e.g., ["wheelchair", "crutches", "leg-brace"]
  fit_concerns: string[]; // e.g., ["shoulder-access", "back-coverage", "hip-fit"]
}

/**
 * Garment Metadata
 * Locked from details.md Section 5 + docs/BRIEF.md garment specs
 */
export interface Garment {
  id: string;
  name: string;
  description: string;
  category: "top" | "bottom" | "outerwear" | "accessory";
  closure_type: string; // e.g., "magnetic", "hook-and-loop", "zipper", "button"
  fabric: string; // e.g., "cotton blend", "stretchy jersey"
  stretch: "none" | "slight" | "moderate" | "high" | "maximum";
  tags: string[]; // e.g., ["tag-free", "quiet-seams", "soft-neckline"]
  seams: string; // e.g., "flat seams on back", "minimal inner thigh", "raised side seams"
  back_rise: string; // e.g., "high", "medium", "low"
  sleeve_adjustable: boolean;
  pocket_access: string; // e.g., "side seams for seated reach", "hip pockets, low-effort"
  price_range?: string; // e.g., "$80-120"
  colors?: string[]; // e.g., ["navy", "tan", "black"]
}

/**
 * Rules Engine: Compatibility Assessment
 * Deterministic output based on UserProfile × Garment
 * Never makes fit guarantees; always "may", "consider", "check with seller"
 */
export interface AccessInsight {
  garment_id: string;
  garment_name: string;
  user_profile_id?: string;
  
  // Core output
  compatibility: string[]; // e.g., ["Magnetic closure matches your limited dexterity"]
  risks: string[]; // e.g., ["High back rise may expose lower back if you shift position"]
  questions_for_seller: string[]; // e.g., ["Are the side seams truly flat, or raised?"]
  
  // Confidence level (based on how many rules fire)
  confidence: "low" | "moderate" | "high";
  
  // Plain-language summary
  summary: string;
  
  // Reasoning (for transparency)
  reasoning?: {
    matched_rules: string[];
    unmatched_concerns: string[];
  };
}

/**
 * Composite Result (full form submission → rules engine → output)
 */
export interface ReviewResult {
  user_profile: UserProfile;
  garment: Garment;
  insight: AccessInsight;
  timestamp: string;
  mode: "live" | "cached" | "simulation"; // VTO mode
}

/**
 * For optional VTO integration (Day 8+)
 * Placeholder structure; filled during live or cached API responses
 */
export interface VTOResult {
  status: "success" | "failed" | "timeout" | "not_attempted";
  preview_url?: string; // URL or data URI of VTO output image
  vto_image_base64?: string; // Base64-encoded image if inline
  confidence?: number; // 0-1, how clean the render was
  error?: string;
  cached?: boolean; // True if this came from cache, not live API
}
