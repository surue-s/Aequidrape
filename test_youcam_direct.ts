import fs from "fs";
import path from "path";

const API_KEY = process.env.YOUCAM_API_KEY || "sk-XXDmxeDJuet9lu5pzNPP44X0hRAeM5CgPefSiBCkkD5-qHG1n18h3wigRFcsxqBh";
const API_URL = "https://api.youcam.com/api/v1/clothes/virtual-try-on";

async function test() {
  console.log("=== YouCam Direct Test ===");
  const garmentDir = path.join(process.cwd(), "public", "garments");
  const jacketPath = path.join(garmentDir, "jacket.jpg");
  const personPath = path.join(process.cwd(), "public", "demo-images", "01-standing-original.jpg");

  if (!fs.existsSync(jacketPath)) return console.log("Missing public/garments/jacket.jpg");
  if (!fs.existsSync(personPath)) return console.log("Missing public/demo-images/01-standing-original.jpg");

  const personBuffer = fs.readFileSync(personPath);
  const garmentBuffer = fs.readFileSync(jacketPath);
  
  const form = new FormData();
  form.append("image", new Blob([personBuffer], { type: "image/jpeg" }), "person.jpg");
  form.append("garment_image", new Blob([garmentBuffer], { type: "image/jpeg" }), "garment.jpg");

  console.log("Calling API...");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}` },
      body: form
    });
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text.slice(0, 800));
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}
test();
