import puppeteer from "puppeteer";
import { resolve } from "path";

async function renderOG() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

  const templatePath = resolve(__dirname, "og-template.html");
  const publicPath = resolve(__dirname, "..", "public");

  // Serve the template with access to public assets
  await page.goto(`file://${templatePath}`, { waitUntil: "networkidle0" });

  // Fix image path for local file access
  await page.evaluate((pubPath: string) => {
    const img = document.querySelector("img");
    if (img) {
      img.src = `file://${pubPath}/app-screenshot.png`;
    }
  }, publicPath);

  await page.waitForSelector("img");
  await new Promise((r) => setTimeout(r, 1000));

  await page.screenshot({
    path: resolve(__dirname, "..", "public", "og-image.png"),
    type: "png",
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });

  console.log("OG image saved to public/og-image.png");
  await browser.close();
}

renderOG().catch((err) => {
  console.error(err);
  process.exit(1);
});
