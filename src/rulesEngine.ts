/**
 * Aequidrape Rules Engine
 * Deterministic, no-AI core: UserProfile × Garment → AccessInsight
 * This is the non-wrapper part of Aequidrape (NOT just YouCam VTO)
 */

import { UserProfile, Garment, AccessInsight } from "./types.js";

/**
 * Rule: Check if closure type matches dexterity profile
 */
function checkClosureMatch(profile: UserProfile, garment: Garment): {
  matched: boolean;
  insight: string;
  risk: string | null;
} {
  const closureType = garment.closure_type.toLowerCase();

  if (profile.dexterity === "one_handed" || profile.dexterity === "limited") {
    // Magnetic and hook-and-loop are best for limited dexterity
    if (closureType.includes("magnetic") || closureType.includes("hook") || closureType.includes("zipper")) {
      return {
        matched: true,
        insight: `${garment.closure_type} closure is one-hand friendly`,
        risk: null,
      };
    } else if (closureType.includes("button")) {
      return {
        matched: false,
        insight: `${garment.closure_type} may be challenging with limited dexterity`,
        risk: `Traditional buttons can be difficult to manipulate one-handed. Consider asking seller about alternative closures.`,
      };
    }
  }

  return { matched: true, insight: `Closure type: ${garment.closure_type}`, risk: null };
}

/**
 * Rule: Check back rise suitability for seated posture
 */
function checkBackRise(profile: UserProfile, garment: Garment): {
  matched: boolean;
  insight: string;
  risk: string | null;
} {
  if (profile.posture === "seated" || profile.posture === "mixed") {
    const backRise = garment.back_rise.toLowerCase();

    if (backRise === "high") {
      return {
        matched: true,
        insight: `High back rise provides coverage and support in seated position`,
        risk: null,
      };
    } else if (backRise === "medium") {
      return {
        matched: true,
        insight: `Medium back rise may shift in seated position`,
        risk: `When sitting, the garment may expose your lower back. Ask seller about how much the back rises when seated.`,
      };
    } else {
      return {
        matched: false,
        insight: `Low back rise not ideal for seated users`,
        risk: `Low back rise will likely expose your lower back when sitting. Consider choosing a different style.`,
      };
    }
  }

  return { matched: true, insight: `Back rise: ${garment.back_rise}`, risk: null };
}

/**
 * Rule: Check stretch level against mobility needs / posture
 */
function checkStretch(profile: UserProfile, garment: Garment): {
  matched: boolean;
  insight: string;
  risk: string | null;
} {
  const stretchLevel = garment.stretch;
  const needsHighStretch = profile.posture === "mixed" || profile.mobility_aids.length > 0;

  if (needsHighStretch && (stretchLevel === "high" || stretchLevel === "maximum")) {
    return {
      matched: true,
      insight: `High stretch accommodates movement and mobility aids`,
      risk: null,
    };
  } else if (needsHighStretch && stretchLevel === "moderate") {
    return {
      matched: true,
      insight: `Moderate stretch may work; test range of motion first`,
      risk: `Moderate stretch may limit movement. If you use mobility aids, try it on and test seated and standing positions.`,
    };
  } else if (needsHighStretch && (stretchLevel === "slight" || stretchLevel === "none")) {
    return {
      matched: false,
      insight: `Low/no stretch not suitable for high-movement needs`,
      risk: `Minimal stretch may restrict your movement or interfere with mobility aids. Consider a more stretchy option.`,
    };
  }

  return { matched: true, insight: `Stretch level: ${stretchLevel}`, risk: null };
}

/**
 * Rule: Check sensory tags against sensory sensitivities
 */
function checkSensoryAccommodations(profile: UserProfile, garment: Garment): {
  matched: boolean;
  insights: string[];
  risks: string[];
} {
  const garmentTags = garment.tags.map((t) => t.toLowerCase());
  const insights: string[] = [];
  const risks: string[] = [];

  if (profile.sensory.includes("tag-sensitive") && garmentTags.includes("tag-free")) {
    insights.push(`Tag-free design addresses your tag sensitivity`);
  } else if (profile.sensory.includes("tag-sensitive")) {
    risks.push(
      `No tag-free labeling listed. Ask seller if internal tags can be safely removed or if the neckline is tagless.`
    );
  }

  if (profile.sensory.includes("seam-sensitive") && garmentTags.includes("flat-seams-back")) {
    insights.push(`Flat seams reduce seam-related irritation`);
  } else if (profile.sensory.includes("seam-sensitive")) {
    risks.push(`Seam construction not specified. Ask seller about seam placement and whether flat-seam options exist.`);
  }

  if (profile.sensory.includes("texture-sensitive") && garmentTags.includes("soft")) {
    insights.push(`Soft fabric noted in tags`);
  }

  return { matched: insights.length > 0, insights, risks };
}

/**
 * Rule: Check fit concerns mapping
 */
function checkFitConcerns(profile: UserProfile, garment: Garment): {
  matched: boolean;
  insights: string[];
  risks: string[];
} {
  const insights: string[] = [];
  const risks: string[] = [];

  if (profile.fit_concerns.includes("shoulder-access")) {
    // Check sleeve adjustability
    if (garment.sleeve_adjustable) {
      insights.push(`Adjustable sleeves allow shoulder customization`);
    } else {
      risks.push(`Sleeves are not adjustable. Ensure sleeve width works for your shoulder access needs.`);
    }
  }

  if (profile.fit_concerns.includes("back-coverage")) {
    // Check back rise + seams
    if (garment.back_rise === "high") {
      insights.push(`High back rise ensures back coverage`);
    }
    if (garment.tags.includes("flat-seams-back")) {
      insights.push(`Flat back seams support back comfort`);
    }
  }

  if (profile.fit_concerns.includes("pocket-access")) {
    if (garment.pocket_access && garment.pocket_access.length > 0) {
      insights.push(`Pockets designed for access: ${garment.pocket_access}`);
    }
  }

  if (profile.fit_concerns.includes("hip-fit")) {
    if (garment.stretch === "high" || garment.stretch === "maximum") {
      insights.push(`High stretch allows hip movement and comfort`);
    }
  }

  return { matched: insights.length > 0, insights, risks };
}

/**
 * Main Rules Engine
 * Runs all rules and generates AccessInsight
 */
export function evaluateGarmentFit(profile: UserProfile, garment: Garment): AccessInsight {
  const closureMatch = checkClosureMatch(profile, garment);
  const backRiseMatch = checkBackRise(profile, garment);
  const stretchMatch = checkStretch(profile, garment);
  const sensoryMatch = checkSensoryAccommodations(profile, garment);
  const fitMatch = checkFitConcerns(profile, garment);

  // Aggregate results
  const compatibilityPoints: string[] = [];
  const riskPoints: string[] = [];
  const questions: string[] = [];

  if (closureMatch.matched) {
    compatibilityPoints.push(closureMatch.insight);
  }
  if (closureMatch.risk) {
    riskPoints.push(closureMatch.risk);
    questions.push(`Can you describe the closure mechanism in detail and how easy it is to operate one-handed?`);
  }

  if (backRiseMatch.matched) {
    compatibilityPoints.push(backRiseMatch.insight);
  }
  if (backRiseMatch.risk) {
    riskPoints.push(backRiseMatch.insight);
  }

  if (stretchMatch.matched) {
    compatibilityPoints.push(stretchMatch.insight);
  }
  if (stretchMatch.risk) {
    riskPoints.push(stretchMatch.risk);
  }

  compatibilityPoints.push(...sensoryMatch.insights);
  riskPoints.push(...sensoryMatch.risks);

  compatibilityPoints.push(...fitMatch.insights);
  riskPoints.push(...fitMatch.risks);

  // Remove duplicates
  const uniqueCompatibility = Array.from(new Set(compatibilityPoints));
  const uniqueRisks = Array.from(new Set(riskPoints));
  const uniqueQuestions = Array.from(new Set(questions));

  // Add universal accessibility questions
  uniqueQuestions.push(
    `Can I try this on at home and return it within 30 days if it doesn't work for my access needs?`,
    `Are there try-before-you-buy or extended return options for adaptive apparel?`
  );

  // Compute confidence based on rule matches
  const rulesFired = uniqueCompatibility.length;
  let confidence: "low" | "moderate" | "high";
  if (rulesFired >= 5) {
    confidence = "high";
  } else if (rulesFired >= 3) {
    confidence = "moderate";
  } else {
    confidence = "low";
  }

  // Generate summary
  const summary = generateAccessSummary(profile, garment, uniqueCompatibility, uniqueRisks, confidence);

  return {
    garment_id: garment.id,
    garment_name: garment.name,
    compatibility: uniqueCompatibility,
    risks: uniqueRisks,
    questions_for_seller: uniqueQuestions,
    confidence,
    summary,
    reasoning: {
      matched_rules: uniqueCompatibility,
      unmatched_concerns: uniqueRisks,
    },
  };
}

/**
 * Generate plain-language summary of accessibility assessment
 * Never claims guaranteed fit; always tentative language
 */
function generateAccessSummary(
  profile: UserProfile,
  garment: Garment,
  compatibility: string[],
  risks: string[],
  confidence: "low" | "moderate" | "high"
): string {
  let summary = ``;

  // Opening
  const confidencePhrase = {
    high: "This garment may work well for you.",
    moderate: "This garment may work for you, but check a few details first.",
    low: "This garment may not be a good fit for your access needs.",
  }[confidence];

  summary += `${confidencePhrase} `;

  // Strengths
  if (compatibility.length > 0) {
    summary += `Strengths: ${compatibility.slice(0, 2).join(", ")}. `;
  }

  // Concerns
  if (risks.length > 0) {
    summary += `Things to check: ${risks.slice(0, 2).join(", ")} `;
  }

  // Call to action
  summary += `Before buying, we recommend asking the seller the questions below to confirm this garment will work for your needs. If it's available, try it on or use a generous return window.`;

  return summary;
}
