import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getAllGarments, getGarmentById, generateFullReview } from "./index.js";
import type { UserProfile } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.resolve(__dirname, "../public")));
app.use("/demo-images", express.static(path.resolve(__dirname, "../public/demo-images")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Aequidrape", mode: "simulation" });
});

app.get("/api/garments", (_req, res) => {
  res.json({ garments: getAllGarments() });
});

app.post("/api/evaluate", (req, res) => {
  const { profile, garmentId } = req.body ?? {};

  if (!profile || typeof profile !== "object") {
    res.status(400).json({ error: "A user profile is required." });
    return;
  }

  const garment = getGarmentById(typeof garmentId === "string" ? garmentId : "adaptive-jacket-001");
  if (!garment) {
    res.status(404).json({ error: "Garment not found." });
    return;
  }

  const safeProfile = profile as UserProfile;
  const result = generateFullReview(safeProfile, garment);
  res.json(result);
});

app.get("*", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

app.listen(port, () => {
  console.log(`Aequidrape running at http://localhost:${port}`);
});
