import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// ============================================================
// SAKE ENDPOINTS
// ============================================================

// GET /api/sake - Get all sake with filters
app.get('/api/sake', async (req: Request, res: Response) => {
  try {
    const {
      classification,
      prefecture,
      minPrice,
      maxPrice,
      minRating,
      search,
      sortBy = 'rating',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = req.query;

    let query = supabase
      .from('sake')
      .select('*', { count: 'exact' });

    // Apply filters
    if (classification) {
      query = query.eq('classification', classification);
    }
    if (prefecture) {
      query = query.eq('prefecture', prefecture);
    }
    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }
    if (minRating) {
      query = query.gte('rating', Number(minRating));
    }
    if (search) {
      query = query.or(`name_english.ilike.%${search}%,name_japanese.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    const validSortFields = ['rating', 'price', 'name_english', 'created_at', 'review_count'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'rating';
    const ascending = sortOrder === 'asc';

    query = query.order(sortField, { ascending });

    // Apply pagination
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      data,
      pagination: {
        total: count,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sake/:id - Get sake by ID
app.get('/api/sake/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('sake')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Sake not found' });

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sake - Create new sake
app.post('/api/sake', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('sake')
      .insert([req.body])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sake/:id - Update sake
app.put('/api/sake/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('sake')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sake/:id - Delete sake
app.delete('/api/sake/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('sake')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Sake deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// BREWERY ENDPOINTS
// ============================================================

// GET /api/breweries - Get all breweries
app.get('/api/breweries', async (req: Request, res: Response) => {
  try {
    const { prefecture, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('breweries')
      .select('*', { count: 'exact' });

    if (prefecture) {
      query = query.eq('prefecture', prefecture);
    }

    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      data,
      pagination: {
        total: count,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/breweries/:id - Get brewery by ID
app.get('/api/breweries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('breweries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Brewery not found' });

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/breweries/:id/sake - Get all sake from a brewery
app.get('/api/breweries/:id/sake', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('sake')
      .select('*')
      .eq('brewery_id', id);

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// REVIEW ENDPOINTS
// ============================================================

// GET /api/sake/:id/reviews - Get reviews for a sake
app.get('/api/sake/:id/reviews', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0, sortBy = 'created_at' } = req.query;

    const { data, error, count } = await supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('sake_id', id)
      .order(sortBy as string, { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    res.json({
      data,
      pagination: {
        total: count,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reviews - Create review
app.post('/api/reviews', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert([req.body])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// FOOD PAIRING ENDPOINTS
// ============================================================

// GET /api/food-pairings - Get all food pairings
app.get('/api/food-pairings', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('food_pairings')
      .select('*');

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/food-pairings/:id/sake - Get sake recommendations for a dish
app.get('/api/food-pairings/:id/sake', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('sake_food_pairings')
      .select(`
        *,
        sake (*)
      `)
      .eq('food_pairing_id', id);

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// UTILITY ENDPOINTS
// ============================================================

// GET /api/classifications - Get all sake classifications
app.get('/api/classifications', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('sake')
      .select('classification')
      .not('classification', 'is', null);

    if (error) throw error;

    const classifications = [...new Set(data.map(s => s.classification))].sort();

    res.json({ data: classifications });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/prefectures - Get all prefectures
app.get('/api/prefectures', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('sake')
      .select('prefecture')
      .not('prefecture', 'is', null);

    if (error) throw error;

    const prefectures = [...new Set(data.map(s => s.prefecture))].sort();

    res.json({ data: prefectures });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stats - Get database statistics
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const [sakeCount, breweryCount, reviewCount] = await Promise.all([
      supabase.from('sake').select('*', { count: 'exact', head: true }),
      supabase.from('breweries').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true })
    ]);

    res.json({
      data: {
        sake: sakeCount.count || 0,
        breweries: breweryCount.count || 0,
        reviews: reviewCount.count || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Umami Sake API',
    version: '1.0.0',
    endpoints: {
      sake: '/api/sake',
      breweries: '/api/breweries',
      reviews: '/api/reviews',
      foodPairings: '/api/food-pairings',
      stats: '/api/stats'
    }
  });
});

// Start server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Umami API running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;
