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
  product_url?: string;
}

// Helper functions
function inferRiceVariety(classification: string | null, description: string): string {
  const desc = (description || '').toLowerCase();

  if (desc.includes('yamada nishiki') || desc.includes('yamadanishiki')) {
    return 'Yamada Nishiki';
  }
  if (desc.includes('gohyakumangoku')) {
    return 'Gohyakumangoku';
  }
  if (desc.includes('miyama nishiki')) {
    return 'Miyama Nishiki';
  }

  // Default based on classification
  if (classification?.toLowerCase().includes('daiginjo')) {
    return 'Yamada Nishiki';
  }
  if (classification?.toLowerCase().includes('ginjo')) {
    return 'Gohyakumangoku';
  }

  return 'Local rice variety';
}

function smvToSweetness(smv: string | null): number {
  if (!smv) return 3; // Balanced default

  const value = parseFloat(smv.replace(/[^0-9.-]/g, ''));

  if (value <= -5) return 5; // Very Sweet
  if (value <= -2) return 4; // Sweet
  if (value <= 2) return 3; // Balanced
  if (value <= 5) return 2; // Dry
  return 1; // Very Dry
}

function deriveFlavorProfile(smv: string | null, acidity: number | null, classification: string | null) {
  const sweetness = smvToSweetness(smv);

  // Acidity (1-5)
  const acidityScore = acidity ? Math.min(5, Math.max(1, Math.round(acidity * 3))) : 3;

  // Body based on classification
  let body = 3;
  if (classification) {
    const cls = classification.toLowerCase();
    if (cls.includes('daiginjo')) body = 2; // Light
    else if (cls.includes('junmai') && !cls.includes('ginjo')) body = 4; // Full
    else if (cls.includes('ginjo')) body = 2; // Light to medium
  }

  // Umami (typically higher in Junmai)
  const umami = classification?.toLowerCase().includes('junmai') ? 4 : 3;

  // Aroma (higher in Ginjo/Daiginjo)
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

function extractBreweryInfo(manufacturerInfo: string) {
  const lines = manufacturerInfo.split('\n').filter(l => l.trim());
  const name = lines[0] || 'Unknown Brewery';

  return {
    name_english: name,
    name_japanese: name, // Will be translated later
    description: manufacturerInfo
  };
}

function generateServingTemperature(howToServe: string | null, classification: string | null): string[] {
  const temps: string[] = [];

  if (howToServe?.toLowerCase().includes('refrigerat') || howToServe?.toLowerCase().includes('cold')) {
    temps.push('Chilled (5-10°C)');
  }

  if (classification?.toLowerCase().includes('ginjo') || classification?.toLowerCase().includes('daiginjo')) {
    if (!temps.includes('Chilled (5-10°C)')) {
      temps.push('Chilled (5-10°C)');
    }
  } else {
    temps.push('Room temperature');
    temps.push('Warmed (40-45°C)');
  }

  return temps.length > 0 ? temps : ['Chilled (5-10°C)', 'Room temperature'];
}

function generateMockReviews(sakeId: string, sakeName: string, rating: number): any[] {
  const reviews = [];
  const reviewCount = Math.floor(Math.random() * 6) + 10; // 10-15 reviews

  const reviewTemplates = [
    { text: 'Excellent sake! The flavor profile is exceptional.', rating: 5.0 },
    { text: 'Very smooth and easy to drink. Highly recommended.', rating: 4.5 },
    { text: 'Great balance of sweetness and acidity.', rating: 4.5 },
    { text: 'Nice aroma, clean finish. Perfect with sushi.', rating: 4.0 },
    { text: 'Good quality for the price. Would buy again.', rating: 4.0 },
    { text: 'Decent sake but not exceptional.', rating: 3.5 },
    { text: 'Rich umami flavor, pairs well with grilled dishes.', rating: 4.5 },
    { text: 'Crisp and refreshing. Great as an aperitif.', rating: 4.0 },
    { text: 'Complex flavor profile with fruity notes.', rating: 5.0 },
    { text: 'Smooth texture, elegant finish. A real treat.', rating: 4.5 },
  ];

  for (let i = 0; i < reviewCount; i++) {
    const template = reviewTemplates[Math.floor(Math.random() * reviewTemplates.length)];
    reviews.push({
      sake_id: sakeId,
      user_id: null, // Will be set to a mock user ID
      rating: template.rating,
      review_text: template.text,
      language: 'en',
      tasting_location: ['home', 'restaurant', 'brewery'][Math.floor(Math.random() * 3)],
      serving_temperature: ['Chilled (5-10°C)', 'Room temperature'][Math.floor(Math.random() * 2)],
      helpful_count: Math.floor(Math.random() * 20),
      is_mock: true,
      created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 90 days
    });
  }

  return reviews;
}

async function seedDatabase() {
  console.log('🌱 Seeding Umami database...\n');

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
      console.log('⚠️  Image URL mapping not found. Run npm run upload-images first.');
    }

    console.log(`📦 Processing ${sakeData.length} sake entries...\n`);

    // Step 1: Extract and insert unique breweries
    console.log('🏭 Creating breweries...');
    const breweryMap = new Map<string, string>(); // brewery name -> id
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
          region: '', // Can be enriched later
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
      console.error('❌ Error inserting breweries:', breweriesError);
    } else {
      console.log(`✅ Created ${breweriesToInsert.length} breweries\n`);
    }

    // Step 2: Insert sake
    console.log('🍶 Creating sake entries...');
    const sakeToInsert = [];
    const allReviews = [];

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

      // Generate realistic rating
      const rating = (Math.random() * 1.5 + 3.5).toFixed(1); // 3.5-5.0

      const sakeId = crypto.randomUUID();

      sakeToInsert.push({
        id: sakeId,
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
        acidity_value: sake.acidity,
        image_url: imageUrl,
        price: sake.price || 0,
        content: sake.content || '720ml',
        rating: parseFloat(rating),
        review_count: 0, // Will be updated by trigger
        description: sake.description || '',
        serving_temperature: servingTemp,
        availability: 'In Stock',
        how_to_serve: sake.how_to_serve,
        is_mock: true
      });

      // Generate mock reviews for this sake
      const mockReviews = generateMockReviews(sakeId, sake.name, parseFloat(rating));
      allReviews.push(...mockReviews);
    }

    const { data: sakeInserted, error: sakeError } = await supabase
      .from('sake')
      .insert(sakeToInsert)
      .select();

    if (sakeError) {
      console.error('❌ Error inserting sake:', sakeError);
    } else {
      console.log(`✅ Created ${sakeToInsert.length} sake entries\n`);
    }

    // Step 3: Insert mock reviews
    console.log('📝 Creating mock reviews...');
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .insert(allReviews)
      .select();

    if (reviewsError) {
      console.error('❌ Error inserting reviews:', reviewsError);
    } else {
      console.log(`✅ Created ${allReviews.length} mock reviews\n`);
    }

    // Step 4: Create food pairings
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
      console.error('❌ Error inserting food pairings:', foodError);
    } else {
      console.log(`✅ Created ${foodPairingsWithIds.length} food pairings\n`);
    }

    console.log('✅ Database seeding completed!\n');
    console.log('📊 Summary:');
    console.log(`   🏭 Breweries: ${breweriesToInsert.length}`);
    console.log(`   🍶 Sake: ${sakeToInsert.length}`);
    console.log(`   📝 Reviews: ${allReviews.length} (mock data)`);
    console.log(`   🍱 Food pairings: ${foodPairingsWithIds.length}`);
    console.log('\n💡 To delete mock data later, run:');
    console.log('   DELETE FROM reviews WHERE is_mock = true;');
    console.log('   DELETE FROM sake WHERE is_mock = true;');
    console.log('   DELETE FROM breweries WHERE is_mock = true;');

  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
