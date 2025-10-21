const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Telegram initData verification
function verifyTelegramInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash ? Object.fromEntries(urlParams) : null;
  } catch (error) {
    console.error('Error verifying Telegram initData:', error);
    return null;
  }
}

// Editor middleware
function requireEditor(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const allowedIds = process.env.ALLOWED_EDITOR_IDS.split(',').map(id => parseInt(id.trim()));
    
    if (!allowedIds.includes(decoded.tg_user_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Auth endpoint
app.post('/api/auth', async (req, res) => {
  const { initData } = req.body;
  
  if (!initData) {
    return res.status(400).json({ error: 'initData required' });
  }

  const verifiedData = verifyTelegramInitData(initData);
  if (!verifiedData) {
    return res.status(401).json({ error: 'Invalid Telegram data' });
  }

  const userData = JSON.parse(verifiedData.user);
  const allowedIds = process.env.ALLOWED_EDITOR_IDS.split(',').map(id => parseInt(id.trim()));
  
  // Check if user is in allow list
  const isEditor = allowedIds.includes(userData.id);
  
  // Create JWT token
  const token = jwt.sign(
    { 
      tg_user_id: userData.id,
      isEditor: isEditor 
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Upsert user in database
  try {
    const { error } = await supabase
      .from('users')
      .upsert({
        tg_user_id: userData.id,
        name: `${userData.first_name} ${userData.last_name || ''}`.trim(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tg_user_id'
      });

    if (error) {
      console.error('Error upserting user:', error);
    }
  } catch (error) {
    console.error('Error with user upsert:', error);
  }

  res.json({ 
    token,
    user: {
      id: userData.id,
      name: `${userData.first_name} ${userData.last_name || ''}`.trim(),
      isEditor
    }
  });
});

// Get current user
app.get('/api/me', requireEditor, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('tg_user_id', req.user.tg_user_id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      ...user,
      isEditor: req.user.isEditor
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Content Routes
app.get('/api/admin/content', requireEditor, async (req, res) => {
  try {
    // Get all content
    const [programsResult, pagesResult, reportsResult] = await Promise.all([
      supabase.from('programs').select(`
        *,
        program_days (
          *,
          exercises (*)
        )
      `).order('created_at', { ascending: false }),
      supabase.from('pages').select('*'),
      supabase.from('reports_settings').select('*').single()
    ]);

    res.json({
      programs: programsResult.data || [],
      pages: pagesResult.data || [],
      reports: reportsResult.data || { calendar_enabled: true }
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Home page content
app.put('/api/admin/pages/home', requireEditor, async (req, res) => {
  try {
    const { hero_image_url, headline, greeting, cta_text } = req.body;
    
    const { error } = await supabase
      .from('pages')
      .upsert({
        key: 'home',
        hero_image_url,
        headline,
        greeting,
        cta_text: cta_text || 'Перейти к упражнениям',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (error) {
      return res.status(500).json({ error: 'Failed to update home page' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Programs CRUD
app.post('/api/admin/programs', requireEditor, async (req, res) => {
  try {
    const { title, slug, description, image_url, details_md, is_published } = req.body;
    
    const { data, error } = await supabase
      .from('programs')
      .insert({
        title,
        slug,
        description,
        image_url,
        details_md,
        is_published: is_published !== false,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create program' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/programs/:id', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, description, image_url, details_md, is_published } = req.body;
    
    const { data, error } = await supabase
      .from('programs')
      .update({
        title,
        slug,
        description,
        image_url,
        details_md,
        is_published,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update program' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/programs/:id', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete program' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Program days
app.post('/api/admin/programs/:id/days', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get current max day_index
    const { data: maxDay } = await supabase
      .from('program_days')
      .select('day_index')
      .eq('program_id', id)
      .order('day_index', { ascending: false })
      .limit(1)
      .single();

    const nextDayIndex = (maxDay?.day_index || 0) + 1;
    
    const { data, error } = await supabase
      .from('program_days')
      .insert({
        program_id: id,
        day_index: nextDayIndex
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create day' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Exercises
app.post('/api/admin/days/:day_id/exercises', requireEditor, async (req, res) => {
  try {
    const { day_id } = req.params;
    const { title, video_url, description } = req.body;
    
    // Get current max order_index
    const { data: maxExercise } = await supabase
      .from('exercises')
      .select('order_index')
      .eq('program_day_id', day_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const nextOrderIndex = (maxExercise?.order_index || 0) + 1;
    
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        program_day_id: day_id,
        title,
        video_url,
        description,
        order_index: nextOrderIndex
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create exercise' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/exercises/:id', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, video_url, description, order_index } = req.body;
    
    const { data, error } = await supabase
      .from('exercises')
      .update({
        title,
        video_url,
        description,
        order_index
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update exercise' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/exercises/:id', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete exercise' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reports settings
app.put('/api/admin/reports-settings', requireEditor, async (req, res) => {
  try {
    const { calendar_enabled } = req.body;
    
    const { error } = await supabase
      .from('reports_settings')
      .upsert({
        id: 1,
        calendar_enabled: calendar_enabled !== false
      }, {
        onConflict: 'id'
      });

    if (error) {
      return res.status(500).json({ error: 'Failed to update reports settings' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public API routes
app.get('/api/programs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
        program_days (
          *,
          exercises (*)
        )
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch programs' });
    }

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/programs/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
        program_days (
          *,
          exercises (*)
        )
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy API routes for backward compatibility
app.get('/api/user/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('tg_user_id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/user/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    const profileData = req.body;
    
    const { data, error } = await supabase
      .from('users')
      .upsert({
        tg_user_id: userId,
        ...profileData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tg_user_id'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/:userId/subscription', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('users')
      .select('subscription_expires_at')
      .eq('tg_user_id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      expiresAt: data.subscription_expires_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/user/:userId/subscription', async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan, durationDays } = req.body;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (durationDays || 30));
    
    const { data, error } = await supabase
      .from('users')
      .upsert({
        tg_user_id: userId,
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tg_user_id'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    res.json({
      expiresAt: data.subscription_expires_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/:userId/progress', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('tg_user_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch progress' });
    }

    // Convert to object format expected by frontend
    const progressObj = {};
    data.forEach(item => {
      progressObj[item.date] = item.completed;
    });

    res.json(progressObj);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/user/:userId/progress', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, completed } = req.body;
    
    const { error } = await supabase
      .from('user_progress')
      .upsert({
        tg_user_id: userId,
        date,
        completed,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tg_user_id,date'
      });

    if (error) {
      return res.status(500).json({ error: 'Failed to save progress' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
