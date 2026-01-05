import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SakeDataInput {
  name: string;
  name_japanese?: string;
  price: number;
  description: string;
  prefecture: string;
  alcohol: number;
  classification: string | null;
  content: string;
  rice_polishing_ratio: string | null;
  smv: string | null;
  acidity: number | null;
  how_to_serve: string | null;
  manufacturer_info: string;
}

// Helper functions
function inferRiceVariety(classification: string | null, description: string): string {
  const desc = (description || '').toLowerCase();
  if (desc.includes('yamada nishiki') || desc.includes('yamadanishiki')) return 'Yamada Nishiki';
  if (desc.includes('gohyakumangoku')) return 'Gohyakumangoku';
  if (desc.includes('miyama nishiki')) return 'Miyama Nishiki';
  if (classification?.toLowerCase().includes('daiginjo')) return 'Yamada Nishiki';
  if (classification?.toLowerCase().includes('ginjo')) return 'Gohyakumangoku';
  return 'Local rice variety';
}

function smvToSweetness(smv: string | null): number {
  if (!smv) return 3;
  const value = parseFloat(smv.replace(/[^0-9.-]/g, ''));
  if (value <= -5) return 5;
  if (value <= -2) return 4;
  if (value <= 2) return 3;
  if (value <= 5) return 2;
  return 1;
}

function deriveFlavorProfile(smv: string | null, acidity: number | null, classification: string | null) {
  const sweetness = smvToSweetness(smv);
  const acidityScore = acidity ? Math.min(5, Math.max(1, Math.round(acidity * 3))) : 3;

  let body = 3;
  if (classification) {
    const cls = classification.toLowerCase();
    if (cls.includes('daiginjo')) body = 2;
    else if (cls.includes('junmai') && !cls.includes('ginjo')) body = 4;
    else if (cls.includes('ginjo')) body = 2;
  }

  const umami = classification?.toLowerCase().includes('junmai') ? 4 : 3;
  const aromaIntensity = classification?.toLowerCase().includes('ginjo') ? 4 : 3;

  return { sweetness, acidity: acidityScore, body, umami, aromaIntensity };
}

function parsePolishRatio(ratio: string | null): number | null {
  if (!ratio) return null;
  const value = parseInt(ratio.replace(/[^0-9]/g, ''));
  return value > 0 && value <= 100 ? value : null;
}

function normalizeClassification(classification: string | null): string {
  if (!classification) return 'Junmai';
  const cls = classification.toLowerCase();
  if (cls.includes('junmai daiginjo')) return 'Junmai Daiginjo';
  if (cls.includes('junmai ginjo')) return 'Junmai Ginjo';
  if (cls.includes('daiginjo')) return 'Daiginjo';
  if (cls.includes('ginjo')) return 'Ginjo';
  if (cls.includes('honjozo') || cls.includes('honjōzō')) return 'Honjozo';
  if (cls.includes('junmai')) return 'Junmai';
  if (cls.includes('nigori')) return 'Nigori';
  if (cls.includes('sparkling')) return 'Sparkling';
  if (cls.includes('namazake')) return 'Namazake';
  if (cls.includes('futsu')) return 'Futsu-shu';
  return 'Junmai';
}

function extractBreweryInfo(manufacturerInfo: string | undefined) {
  if (!manufacturerInfo) {
    return {
      name_english: 'Unknown Brewery',
      name_japanese: '不明な酒造',
      description: 'Brewery information not available'
    };
  }
  const lines = manufacturerInfo.split('\n').filter(l => l.trim());
  const name = lines[0] || 'Unknown Brewery';
  return {
    name_english: name,
    name_japanese: name,
    description: manufacturerInfo
  };
}

function generateServingTemperature(howToServe: string | null, classification: string | null): string[] {
  const temps: string[] = [];
  if (howToServe?.toLowerCase().includes('refrigerat') || howToServe?.toLowerCase().includes('cold')) {
    temps.push('Chilled (5-10°C)');
  }
  if (classification?.toLowerCase().includes('ginjo') || classification?.toLowerCase().includes('daiginjo')) {
    if (!temps.includes('Chilled (5-10°C)')) temps.push('Chilled (5-10°C)');
  } else {
    temps.push('Room temperature');
    temps.push('Warmed (40-45°C)');
  }
  return temps.length > 0 ? temps : ['Chilled (5-10°C)', 'Room temperature'];
}

async function seedDatabase() {
  console.log('🌱 Seeding Umami database (Simple Mode - No Reviews)...\n');

  try {
    // Load sake data
    const dataPath = join(__dirname, '../../Umami/test_scrape/sake_data.json');
    const sakeData: SakeDataInput[] = JSON.parse(readFileSync(dataPath, 'utf-8'));

    // Load image URL mapping
    let imageMapping: Record<string, string> = {};
    try {
      const mappingPath = join(__dirname, '../data/image-url-mapping.json');
      imageMapping = JSON.parse(readFileSync(mappingPath, 'utf-8'));
    } catch {
      console.log('⚠️  Image URL mapping not found. Images will not have URLs.');
    }

    console.log(`📦 Processing ${sakeData.length} sake entries...\n`);

    // Step 1: Extract and insert unique breweries
    console.log('🏭 Creating breweries...');
    const breweryMap = new Map<string, string>();
    const breweriesToInsert = [];

    for (const sake of sakeData) {
      const breweryInfo = extractBreweryInfo(sake.manufacturer_info);
      const breweryKey = breweryInfo.name_english;

      if (!breweryMap.has(breweryKey)) {
        const breweryId = crypto.randomUUID();
        breweryMap.set(breweryKey, breweryId);

        breweriesToInsert.push({
          id: breweryId,
          name_english: breweryInfo.name_english,
          name_japanese: breweryInfo.name_japanese,
          prefecture: sake.prefecture || 'Unknown',
          region: '',
          description: breweryInfo.description,
          is_mock: true
        });
      }
    }

    const { data: breweriesData, error: breweriesError } = await supabase
      .from('breweries')
      .insert(breweriesToInsert)
      .select();

    if (breweriesError) {
      console.error('❌ Error inserting breweries:', breweriesError.message);
      throw breweriesError;
    }
    console.log(`✅ Created ${breweriesToInsert.length} breweries\n`);

    // Step 2: Insert sake
    console.log('🍶 Creating sake entries...');
    const sakeToInsert = [];

    for (const sake of sakeData) {
      const breweryInfo = extractBreweryInfo(sake.manufacturer_info);
      const breweryId = breweryMap.get(breweryInfo.name_english);

      const classification = normalizeClassification(sake.classification);
      const flavorProfile = deriveFlavorProfile(sake.smv, sake.acidity, classification);
      const polishRatio = parsePolishRatio(sake.rice_polishing_ratio);
      const riceVariety = inferRiceVariety(classification, sake.description);
      const servingTemp = generateServingTemperature(sake.how_to_serve, classification);

      // Find matching image
      const sakeName = sake.name.toLowerCase().replace(/\s+/g, '_');
      let imageUrl = '';
      for (const [filename, url] of Object.entries(imageMapping)) {
        if (filename.toLowerCase().includes(sakeName.substring(0, 20))) {
          imageUrl = url;
          break;
        }
      }

      // Generate realistic rating (we'll set review_count to a random number for appearance)
      const rating = parseFloat((Math.random() * 1.5 + 3.5).toFixed(1));
      const reviewCount = Math.floor(Math.random() * 20) + 5; // 5-25 reviews

      sakeToInsert.push({
        id: crypto.randomUUID(),
        name_english: sake.name,
        name_japanese: sake.name_japanese || sake.name,
        brewery_id: breweryId,
        brewery_name: breweryInfo.name_english,
        prefecture: sake.prefecture || 'Unknown',
        classification,
        rice_variety: riceVariety,
        polish_ratio: polishRatio,
        alcohol_content: sake.alcohol || 15.0,
        sweetness: flavorProfile.sweetness,
        acidity: flavorProfile.acidity,
        body: flavorProfile.body,
        umami: flavorProfile.umami,
        aroma_intensity: flavorProfile.aromaIntensity,
        smv: sake.smv,
        acidity_value: sake.acidity ? Math.min(sake.acidity, 9.99) : null,
        image_url: imageUrl,
        price: sake.price || 0,
        content: sake.content || '720ml',
        rating: rating,
        review_count: reviewCount, // Mock review count
        description: sake.description || '',
        serving_temperature: servingTemp,
        availability: 'In Stock',
        how_to_serve: sake.how_to_serve,
        is_mock: true
      });
    }

    const { data: sakeInserted, error: sakeError } = await supabase
      .from('sake')
      .insert(sakeToInsert)
      .select();

    if (sakeError) {
      console.error('❌ Error inserting sake:', sakeError.message);
      throw sakeError;
    }
    console.log(`✅ Created ${sakeToInsert.length} sake entries\n`);

    // Step 3: Create food pairings
    console.log('🍱 Creating food pairings...');
    const foodPairings = [
      { dish_name: 'Sushi', dish_name_japanese: '寿司', category: 'Sushi', description: 'Clean sake that won\'t overpower delicate fish flavors' },
      { dish_name: 'Sashimi', dish_name_japanese: '刺身', category: 'Sashimi', description: 'Light, dry sake complements raw fish' },
      { dish_name: 'Tempura', dish_name_japanese: '天ぷら', category: 'Tempura', description: 'Aromatic sake cuts through fried richness' },
      { dish_name: 'Yakitori', dish_name_japanese: '焼き鳥', category: 'Yakitori', description: 'Rich, umami-forward sake pairs with grilled chicken' },
      { dish_name: 'Ramen', dish_name_japanese: 'ラーメン', category: 'Ramen', description: 'Full-bodied sake stands up to rich broth' },
      { dish_name: 'Wagyu Beef', dish_name_japanese: '和牛', category: 'Meat', description: 'Premium sake for premium beef' },
    ];

    const foodPairingsWithIds = foodPairings.map(fp => ({
      ...fp,
      id: crypto.randomUUID(),
      is_mock: true
    }));

    const { data: foodData, error: foodError } = await supabase
      .from('food_pairings')
      .insert(foodPairingsWithIds)
      .select();

    if (foodError) {
      console.error('❌ Error inserting food pairings:', foodError.message);
    } else {
      console.log(`✅ Created ${foodPairingsWithIds.length} food pairings\n`);
    }

    console.log('✅ Database seeding completed!\n');
    console.log('📊 Summary:');
    console.log(`   🏭 Breweries: ${breweriesToInsert.length}`);
    console.log(`   🍶 Sake: ${sakeToInsert.length}`);
    console.log(`   🍱 Food pairings: ${foodPairingsWithIds.length}`);
    console.log('\n💡 Note: Reviews are not created in simple mode.');
    console.log('   Sake entries have mock review counts for display purposes.');
    console.log('\n🗑️  To delete mock data later, run:');
    console.log('   DELETE FROM sake WHERE is_mock = true;');
    console.log('   DELETE FROM breweries WHERE is_mock = true;');
    console.log('   DELETE FROM food_pairings WHERE is_mock = true;');

  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
