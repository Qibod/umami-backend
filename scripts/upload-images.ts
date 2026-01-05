import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Configure R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${BUCKET_NAME}.r2.dev`;

interface UploadResult {
  success: number;
  failed: number;
  skipped: number;
  urls: Map<string, string>;
}

async function uploadImage(filePath: string, key: string): Promise<string> {
  try {
    const fileContent = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();

    // Determine content type
    const contentType = ext === '.png' ? 'image/png' :
                       ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                       'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000' // 1 year
    });

    await r2Client.send(command);

    const url = `${PUBLIC_URL}/${key}`;
    return url;

  } catch (error: any) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

function getAllImages(dir: string): string[] {
  const images: string[] = [];

  function traverse(currentPath: string) {
    const items = readdirSync(currentPath);

    for (const item of items) {
      const fullPath = join(currentPath, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (stat.isFile()) {
        const ext = extname(item).toLowerCase();
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          images.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return images;
}

async function uploadAllImages() {
  console.log('☁️  Uploading images to Cloudflare R2...\n');

  try {
    // Test R2 connection
    console.log('🔍 Testing R2 connection...');
    await r2Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log('✅ Connected to R2 bucket:', BUCKET_NAME);
    console.log('🌐 Public URL:', PUBLIC_URL, '\n');

    // Get all images from test_scrape folder
    const imagesDir = join(__dirname, '../../Umami/test_scrape/images');
    const imagePaths = getAllImages(imagesDir);

    console.log(`📸 Found ${imagePaths.length} images to upload\n`);

    const result: UploadResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      urls: new Map()
    };

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const fileName = basename(imagePath);

      // Create a clean key (remove special characters, ensure uniqueness)
      const cleanFileName = fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase();

      const key = `sake-bottles/${cleanFileName}`;

      console.log(`[${i + 1}/${imagePaths.length}] Uploading: ${fileName}`);

      try {
        const url = await uploadImage(imagePath, key);
        result.urls.set(fileName, url);
        result.success++;
        console.log(`  ✅ Uploaded to: ${url}\n`);

        // Small delay to avoid rate limiting
        if ((i + 1) % 10 === 0) {
          console.log('  ⏸️  Pausing briefly...\n');
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error: any) {
        result.failed++;
        console.log(`  ❌ Failed: ${error.message}\n`);
      }
    }

    console.log('\n📊 Upload Summary:');
    console.log(`   ✅ Successful: ${result.success}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log(`   ⏭️  Skipped: ${result.skipped}`);

    // Save URL mapping to file
    const mapping: Record<string, string> = {};
    result.urls.forEach((url, filename) => {
      mapping[filename] = url;
    });

    const mappingPath = join(__dirname, '../data/image-url-mapping.json');
    const fs = await import('fs/promises');
    await fs.mkdir(join(__dirname, '../data'), { recursive: true });
    await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));

    console.log(`\n💾 Image URL mapping saved to: ${mappingPath}`);

  } catch (error: any) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run upload
uploadAllImages();
