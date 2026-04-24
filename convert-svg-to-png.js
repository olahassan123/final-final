import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, 'src', 'assets');

const slides = ['slide1', 'slide2', 'slide3', 'slide4', 'slide5'];

async function convertSVGsToPNG() {
  for (const slide of slides) {
    const svgPath = path.join(assetsDir, `${slide}.svg`);
    const pngPath = path.join(assetsDir, `${slide}.png`);

    try {
      if (fs.existsSync(svgPath)) {
        await sharp(svgPath)
          .png()
          .toFile(pngPath);
        console.log(`✓ Converted ${slide}.svg to ${slide}.png`);
      }
    } catch (error) {
      console.error(`✗ Error converting ${slide}.svg:`, error.message);
    }
  }

  console.log('Conversion complete!');
}

convertSVGsToPNG();
