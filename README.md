# Umami Backend API

Backend API for the Umami Sake Discovery App. Built with Node.js, Express, Supabase, and deployed on Vercel.

## Tech Stack

- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2
- **API**: Express.js + TypeScript
- **Hosting**: Vercel (Serverless)
- **Image Recognition**: Roboflow
- **Translation**: DeepL
- **Email**: Resend
- **Push Notifications**: Firebase

## Project Structure

```
umami-backend/
├── api/
│   └── index.ts              # Main API endpoints
├── scripts/
│   ├── setup-database.ts     # Create database schema
│   ├── upload-images.ts      # Upload images to R2
│   ├── translate-names.ts    # Translate sake names to Japanese
│   └── seed.ts               # Seed database with sake data
├── data/                     # Generated data files
├── schema.sql                # Database schema
├── package.json
├── tsconfig.json
├── vercel.json               # Vercel deployment config
└── .env                      # Environment variables
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

This will create all tables, indexes, and triggers in Supabase:

```bash
npm run setup-db
```

If the script fails, manually run `schema.sql` in Supabase SQL Editor:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Paste contents of `schema.sql`
5. Execute

### 3. Upload Images to Cloudflare R2

```bash
npm run upload-images
```

This uploads all sake bottle images from `test_scrape/images` to R2 and generates a URL mapping.

### 4. (Optional) Translate Sake Names

```bash
npm run translate
```

This uses DeepL to translate English sake names to Japanese. Note: DeepL API has rate limits.

### 5. Seed Database

```bash
npm run seed
```

This will:
- Process sake data from `test_scrape/sake_data.json`
- Extract and create breweries
- Create sake entries with inferred data
- Generate 10-15 mock reviews per sake (flagged with `is_mock = true`)
- Create food pairings

### 6. Test API Locally

```bash
npm run dev
```

API will be available at `http://localhost:3000`

### 7. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... add all other env vars

# Deploy to production
vercel --prod
```

## API Endpoints

### Sake

- `GET /api/sake` - Get all sake (with filters)
  - Query params: `classification`, `prefecture`, `minPrice`, `maxPrice`, `minRating`, `search`, `sortBy`, `sortOrder`, `limit`, `offset`
- `GET /api/sake/:id` - Get sake by ID
- `POST /api/sake` - Create new sake
- `PUT /api/sake/:id` - Update sake
- `DELETE /api/sake/:id` - Delete sake

### Breweries

- `GET /api/breweries` - Get all breweries
- `GET /api/breweries/:id` - Get brewery by ID
- `GET /api/breweries/:id/sake` - Get all sake from brewery

### Reviews

- `GET /api/sake/:id/reviews` - Get reviews for sake
- `POST /api/reviews` - Create review

### Food Pairings

- `GET /api/food-pairings` - Get all food pairings
- `GET /api/food-pairings/:id/sake` - Get sake recommendations for dish

### Utilities

- `GET /api/classifications` - Get all sake classifications
- `GET /api/prefectures` - Get all prefectures
- `GET /api/stats` - Get database statistics
- `GET /health` - Health check

## Example Requests

### Get all sake sorted by rating

```bash
curl "http://localhost:3000/api/sake?sortBy=rating&sortOrder=desc&limit=10"
```

### Search sake

```bash
curl "http://localhost:3000/api/sake?search=dassai"
```

### Filter by classification and prefecture

```bash
curl "http://localhost:3000/api/sake?classification=Junmai%20Daiginjo&prefecture=Yamaguchi"
```

### Get sake with reviews

```bash
curl "http://localhost:3000/api/sake/[sake-id]"
curl "http://localhost:3000/api/sake/[sake-id]/reviews"
```

## Database Schema

### Tables

- `breweries` - Sake breweries
- `sake` - Sake products
- `users` - App users
- `reviews` - User reviews
- `food_pairings` - Food pairing categories
- `sake_food_pairings` - Junction table for sake-food pairings
- `user_collections` - User wishlists, favorites, cellar

### Mock Data

All mock data is flagged with `is_mock = true` for easy identification and deletion:

```sql
-- Delete all mock data
DELETE FROM reviews WHERE is_mock = true;
DELETE FROM sake WHERE is_mock = true;
DELETE FROM breweries WHERE is_mock = true;
DELETE FROM food_pairings WHERE is_mock = true;
```

## Data Sources

- Sake data: `test_scrape/sake_data.json`
- Images: `test_scrape/images/`
- Image URLs: `data/image-url-mapping.json` (generated)
- Translations: `data/sake_data_translated.json` (generated)

## Environment Variables

See `.env` file for all required environment variables.

## Future Enhancements

- [ ] Add authentication endpoints (Sign in with Apple, Google, Email)
- [ ] Add image recognition endpoint (Roboflow integration)
- [ ] Add user profile management
- [ ] Add user collections (wishlist, favorites, cellar)
- [ ] Add recommendation engine
- [ ] Add batch update endpoints for data enrichment
- [ ] Add rate limiting
- [ ] Add caching layer (Redis)
- [ ] Add email notifications (Resend)
- [ ] Add push notifications (Firebase)

## License

MIT
