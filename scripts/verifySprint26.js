import fs from 'fs';
import path from 'path';
import {
  handleAnalyzeGarmentServer,
  handleGenerateOutfitServer,
  handleSwapGarmentServer
} from '../server/geminiServer.js';

// Parse garmentCatalog.ts manually to extract catalog entries without requiring TS compilation
const catalogContent = fs.readFileSync(path.resolve(process.cwd(), 'src/data/garmentCatalog.ts'), 'utf8');

function parseCatalog(profileName) {
  const items = [];
  const regex = /id:\s*'([^']+)',\s*profile:\s*'([^']+)',\s*category:\s*'([^']+)',\s*name:\s*'([^']+)',\s*subcategory:\s*'([^']+)',\s*color:\s*'([^']+)',\s*hexColor:\s*'([^']+)',\s*fabric:\s*'([^']+)',\s*fit:\s*'([^']+)',\s*style:\s*'([^']+)',\s*seasons:[^,]+,\s*formality:\s*'([^']+)'(?:,\s*layeringRole:\s*'([^']+)')?/g;

  let match;
  while ((match = regex.exec(catalogContent)) !== null) {
    if (match[2] === profileName) {
      items.push({
        garmentId: match[1],
        name: match[4],
        category: match[3],
        subcategory: match[5],
        color: match[6],
        fabric: match[8],
        fit: match[9],
        formality: match[11],
        layeringRole: match[12] || 'primary_layer',
        tags: [match[10], match[5], match[6]],
        pairingNotes: `${match[4]} in ${match[6]}`
      });
    }
  }
  return items;
}

const menWardrobe = parseCatalog('men');
const womenWardrobe = parseCatalog('women');

console.log(`Parsed catalog: ${menWardrobe.length} men items, ${womenWardrobe.length} women items.`);

let requestCounter = 0;
let quotaExhausted = false;

async function executeTest(testName, actionFn) {
  if (quotaExhausted) {
    console.log(`\n[${testName}] SKIPPED due to prior 429 RESOURCE_EXHAUSTED`);
    return { status: 'NOT TESTED — QUOTA', testName };
  }

  requestCounter++;
  console.log(`\n========================================`);
  console.log(`=== Request #${requestCounter}: ${testName} ===`);
  console.log(`========================================`);
  try {
    const res = await actionFn();
    if (!res.ok) {
      if (res.error && (res.error.includes('RESOURCE_EXHAUSTED') || res.error.includes('429'))) {
        quotaExhausted = true;
        console.error(`🔴 429 RESOURCE_EXHAUSTED encountered on Request #${requestCounter}`);
        return { status: 'NOT TESTED — QUOTA', testName, error: res.error };
      }
      console.log(`⚠️ Response returned ok=false:`, res.error);
      return { status: 'FAIL', testName, error: res.error };
    }

    console.log(`✅ Success (mode=${res.mode})`);
    console.log('Result:', JSON.stringify(res.data, null, 2));
    return { status: 'PASS', testName, data: res.data };
  } catch (err) {
    if (err.message && (err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('429'))) {
      quotaExhausted = true;
      console.error(`🔴 429 RESOURCE_EXHAUSTED encountered on Request #${requestCounter}`);
      return { status: 'NOT TESTED — QUOTA', testName, error: err.message };
    }
    console.error(`🔴 Exception on ${testName}:`, err.message);
    return { status: 'FAIL', testName, error: err.message };
  }
}

async function runSuite() {
  console.log('Starting Sprint 26 Real Gemini Verification Suite...\n');

  const results = {};

  // Test 1: Garment Vision
  results.vision = await executeTest('TEST 1 — GARMENT VISION', async () => {
    const samplePath = path.resolve(process.cwd(), 'public/wardrobe/men/tops/charcoal_art_tee.webp');
    if (!fs.existsSync(samplePath)) throw new Error('Sample file missing: ' + samplePath);
    const imgBuffer = fs.readFileSync(samplePath);
    const base64 = imgBuffer.toString('base64');
    return handleAnalyzeGarmentServer({
      imageData: base64,
      mimeType: 'image/webp',
      categoryHint: 'tops'
    });
  });

  // Test 2: Casual vs Travel - Part A
  results.casual = await executeTest('TEST 2A — CASUAL WEEKEND', async () => {
    return handleGenerateOutfitServer({
      wardrobe: menWardrobe,
      prompt: 'casual weekend',
      layeringPreference: 'avoid'
    });
  });

  // Test 2: Casual vs Travel - Part B
  results.travel = await executeTest('TEST 2B — AIRPORT TRAVEL', async () => {
    return handleGenerateOutfitServer({
      wardrobe: menWardrobe,
      prompt: 'airport travel',
      layeringPreference: 'avoid'
    });
  });

  // Test 3: Date vs College - Part A
  results.college = await executeTest('TEST 3A — COLLEGE PRESENTATION', async () => {
    return handleGenerateOutfitServer({
      wardrobe: menWardrobe,
      prompt: 'college presentation tomorrow',
      layeringPreference: 'avoid'
    });
  });

  // Test 3: Date vs College - Part B
  results.date = await executeTest('TEST 3B — FIRST DATE DINNER', async () => {
    return handleGenerateOutfitServer({
      wardrobe: menWardrobe,
      prompt: 'first date dinner',
      layeringPreference: 'avoid'
    });
  });

  // Test 4: Job Interview
  results.interview = await executeTest('TEST 4 — JOB INTERVIEW', async () => {
    return handleGenerateOutfitServer({
      wardrobe: menWardrobe,
      prompt: 'job interview',
      layeringPreference: 'avoid'
    });
  });

  // Test 5: Layering (Usually)
  results.layering = await executeTest('TEST 5 — LAYERING USUALLY', async () => {
    return handleGenerateOutfitServer({
      wardrobe: menWardrobe,
      prompt: 'chilly autumn evening walk',
      layeringPreference: 'usually'
    });
  });

  // Test 6: Regenerate (with excludeGarmentIds)
  results.regenerate = await executeTest('TEST 6 — REGENERATE', async () => {
    const prevIds = results.casual?.data?.garmentIds || ['seed-m-top-1', 'seed-m-bottom-1', 'seed-m-shoes-1'];
    return handleGenerateOutfitServer({
      wardrobe: menWardrobe,
      prompt: 'casual weekend',
      layeringPreference: 'avoid',
      excludeGarmentIds: prevIds
    });
  });

  // Test 7: Swap
  results.swap = await executeTest('TEST 7 — SWAP', async () => {
    const prevIds = results.casual?.data?.garmentIds || ['seed-m-top-1', 'seed-m-bottom-1', 'seed-m-shoes-1'];
    return handleSwapGarmentServer({
      currentOutfitGarmentIds: prevIds,
      targetGarmentIdToSwap: prevIds[0],
      targetCategory: 'tops',
      prompt: 'casual weekend',
      wardrobe: menWardrobe
    });
  });

  // Test 8: Women Profile
  results.women = await executeTest('TEST 8 — WOMEN PROFILE', async () => {
    return handleGenerateOutfitServer({
      wardrobe: womenWardrobe,
      prompt: 'brunch with friends',
      layeringPreference: 'avoid'
    });
  });

  console.log('\n========================================');
  console.log(`TOTAL GEMINI REQUESTS EXECUTED: ${requestCounter}`);
  console.log('========================================\n');

  // Summary Report Output
  console.log('SUMMARY RESULTS:');
  Object.keys(results).forEach((k) => {
    console.log(`${k.toUpperCase()}: ${results[k].status} ${results[k].error ? '(' + results[k].error + ')' : ''}`);
  });
}

runSuite();
