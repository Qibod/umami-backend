import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const DEEPL_API_KEY = process.env.DEEPL_API_KEY!;
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

interface SakeData {
  name: string;
  name_japanese?: string;
  [key: string]: any;
}

async function translateToJapanese(text: string): Promise<string> {
  try {
    const response = await axios.post(
      DEEPL_API_URL,
      new URLSearchParams({
        auth_key: DEEPL_API_KEY,
        text: text,
        target_lang: 'JA',
        source_lang: 'EN'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.translations[0].text;
  } catch (error: any) {
    console.error(`Error translating "${text}":`, error.message);
    return text; // Return original if translation fails
  }
}

async function translateSakeNames() {
  console.log('🌐 Translating sake names to Japanese using DeepL...\n');

  try {
    // Read the sake data
    const dataPath = join(__dirname, '../../Umami/test_scrape/sake_data.json');
    const sakeData: SakeData[] = JSON.parse(readFileSync(dataPath, 'utf-8'));

    console.log(`Found ${sakeData.length} sake entries to translate\n`);

    let translatedCount = 0;
    const translatedData: SakeData[] = [];

    for (let i = 0; i < sakeData.length; i++) {
      const sake = sakeData[i];
      const englishName = sake.name;

      console.log(`[${i + 1}/${sakeData.length}] Translating: ${englishName}`);

      // Add small delay to avoid rate limiting
      if (i > 0 && i % 5 === 0) {
        console.log('  ⏸️  Pausing to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const japaneseName = await translateToJapanese(englishName);

      translatedData.push({
        ...sake,
        name_japanese: japaneseName
      });

      translatedCount++;
      console.log(`  ✅ Translated to: ${japaneseName}\n`);
    }

    // Save translated data
    const outputPath = join(__dirname, '../data/sake_data_translated.json');
    writeFileSync(outputPath, JSON.stringify(translatedData, null, 2));

    console.log(`\n✅ Translation complete!`);
    console.log(`   Translated: ${translatedCount} sake names`);
    console.log(`   Saved to: ${outputPath}`);

  } catch (error: any) {
    console.error('❌ Translation failed:', error.message);
    process.exit(1);
  }
}

// Run translation
translateSakeNames();
