# Aequidrape — Day 1 Brief

**Date:** 2026-08-08 17uman:30:51
**Track:** Apparel VTO / Adaptive Fit

---

## Decision A: YouCam VTO Viability

### Test Parameters
- **Garment:** Adaptive Front-Closure Jacket (magnetic closure, high back rise)
- **Test set:** 6 photo scenarios (standing, seated, wheelchair, prosthetic, asymmetric, lighting variant)
- **Scoring:** 0–4 (0=unusable, 4=demo-quality)

### Test Results

| Scenario | Description | Score | Notes |
|---|---|---|---|
| 01-standing | Standing neutral posture, face forward | 0/4 | Unusable / broken render |
| 02-seated | Seated position, upper body visible | 0/4 | Unusable / broken render |
| 03-wheelchair | Seated in wheelchair, full upper body visible | 0/4 | Unusable / broken render |
| 04-prosthetic | Standing, asymmetric limbs visible (prosthetic arm simulation) | 0/4 | Unusable / broken render |
| 05-asymmetric-posture | Standing with twisted/asymmetric posture | 0/4 | Unusable / broken render |
| 06-lighting-variant | Standing, low-light or unusual background | 0/4 | Unusable / broken render |

### Summary
- **Average score:** 0.00/4
- **Scores ≥3:** 0/6
- **Decision A:** FALLBACK — Simulation mode, insight panel carries demo
- **Reasoning:** <2 photos scored ≥3 (avg 0.0/4)

---

## Decision B: Persona Pairing (Locked)

**Primary demo pairing:**
- **Profile A (Contrast 1):** Seated + Limited Dexterity
- **Profile B (Contrast 2):** Standing + No Concerns
- **Garment:** Adaptive Front-Closure Jacket

**Why this pairing:**
- Magnetic closure = direct compatibility win for limited dexterity (vs. standard buttons)
- High back rise = seated user coverage advantage (prevents exposure)
- Differences are legible in 30 seconds; judges see the variance directly

**Garment metadata locked:**
- Closure: magnetic
- Back rise: high
- Stretch: moderate (good for seated comfort)
- Seams: minimal on back (accessibility-focused)

---

## Next Steps (Day 2–3)

1. Finalize garment catalog (5+ items with metadata)
2. Build rules engine for needs × garment → compatibility/risks
3. Implement needs profile form
4. Generate result page with summary + seller questions

**VTO Implementation (Day 8):**
- If Decision A = "HEADLINE": Build live API integration + caching
- If Decision A = "FEATURED": Use today's cached outputs + fallback mode
- If Decision A = "FALLBACK": Simulation mode only; demo focus on rules engine

---

## Garment Catalog (5+ items, all include adaptive features)

1. **Adaptive Front-Closure Jacket**
   - Closure: magnetic
   - Back rise: high
   - Stretch: moderate
   - Sensory: flat seams on back, tag-free neckline
   - Pocket access: side seams for seated reach

2. **Seated-Friendly Cargo Pants**
   - Closure: hook-and-loop
   - Back rise: high
   - Stretch: high in thighs
   - Seams: minimal on inner thigh
   - Pocket access: hip pockets reachable from seated

3. **One-Handed Buttonup Shirt**
   - Closure: magnetic buttons
   - Back rise: medium
   - Stretch: slight (upper arm)
   - Sensory: no stiff collar, soft fabric
   - Pocket access: chest pockets, low-effort openings

4. **Accessible Hoodie**
   - Closure: full-zip magnetic
   - Stretch: high (all directions)
   - Sensory: fleece lining, no drawstrings
   - Mobility: roomy sleeves for mobility aid accommodations
   - Pocket access: deep kangaroo pockets

5. **Adaptive Leggings**
   - Closure: elastic waist + side zippers (removable for leg braces)
   - Stretch: maximum (all directions)
   - Sensory: seam-free option available
   - Mobility: room for prosthetics/braces
   - Pocket-like features: side pockets for stoma bags, medical devices

---

## Definition of Done (Day 1)

- [x] Test YouCam VTO with 6 photo scenarios
- [x] Score all 6 outputs, record in this brief
- [x] Decision A written and locked
- [x] Decision B written and locked (persona pairing + garment)
- [x] Garment metadata schema frozen
- [ ] Next: repo + stack setup (Day 2)

