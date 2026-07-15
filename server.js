import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { User, Lead, Team, Setting, CallLog } from './models.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(async () => {
      console.log('Connected to MongoDB Atlas');
      // Create default admin if none exists
      try {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount === 0) {
          const admin = new User({
            name: 'Admin User',
            email: 'admin@paisaneed.com',
            password: 'admin123',
            role: 'admin'
          });
          await admin.save();
          console.log('Default admin created: admin@paisaneed.com / admin123');
          
          // Seed default settings
          await Setting.findOneAndUpdate({ key: 'loan_types' }, { value: ['personal', 'home', 'business', 'lap', 'credit_card'] }, { upsert: true });
          await Setting.findOneAndUpdate({ key: 'sources' }, { value: ['website', 'referral', 'campaign', 'facebook', 'google', 'walkin'] }, { upsert: true });
          await Setting.findOneAndUpdate({ key: 'distribution_rules' }, { value: { method: 'round_robin', max_leads: 15, aging_days: 3 } }, { upsert: true });
          await Setting.findOneAndUpdate({ key: 'company_profile' }, { value: { name: 'Paisaneed CRM', contact_person: 'Admin', email: 'support@paisaneed.com', mobile: '+91 9876543210', address: '123, Financial District, Mumbai, India', website: 'www.paisaneed.com', other: '' } }, { upsert: true });
        }

        // Always ensure lead statuses and priorities settings exist
        const statusesExist = await Setting.findOne({ key: 'lead_statuses' });
        if (!statusesExist) {
          await Setting.create({ key: 'lead_statuses', value: ['new', 'contacted', 'interested', 'documents_pending', 'login_done', 'disbursed', 'rejected', 'not_interested', 'dead'] });
        }
        const statusLabelsExist = await Setting.findOne({ key: 'lead_status_labels' });
        if (!statusLabelsExist) {
          await Setting.create({ key: 'lead_status_labels', value: { new: 'New', contacted: 'Contacted', interested: 'Interested', documents_pending: 'Docs Pending', login_done: 'Login Done', disbursed: 'Disbursed', rejected: 'Rejected', not_interested: 'Not Interested', dead: 'Dead' } });
        }
        const prioritiesExist = await Setting.findOne({ key: 'lead_priorities' });
        if (!prioritiesExist) {
          await Setting.create({ key: 'lead_priorities', value: ['cold', 'warm', 'hot'] });
        }
        const priorityLabelsExist = await Setting.findOne({ key: 'lead_priority_labels' });
        if (!priorityLabelsExist) {
          await Setting.create({ key: 'lead_priority_labels', value: { cold: 'Cold', warm: 'Warm', hot: 'Hot' } });
        }
      } catch (err) {
        console.error('Error seeding data:', err);
      }
    })
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGODB_URI not found in environment variables. Running without DB.');
}

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const userData = req.body;
    if (!userData.password) {
      userData.password = 'Paisa@123'; // Default password
    }
    const user = new User(userData);
    await user.save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.active === false) {
      return res.status(403).json({ message: 'Contact your admin' });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, team_id: user.team_id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email, team_id: user.team_id } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.password = newPassword; // Pre-save hook will hash it
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- LEADS ROUTES ---
app.get('/api/leads', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, sort = 'created_at', dir = 'desc', search = '', status, loanType, source, agent, aging } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let query = {};
    if (req.user.role === 'agent') {
      query.assigned_agent_id = req.user.id;
    } else if (req.user.role === 'tl' && req.user.team_id) {
      const agentsInTeam = await User.find({ team_id: req.user.team_id }).select('_id');
      const agentIds = agentsInTeam.map(a => a._id);
      query.assigned_agent_id = { $in: agentIds };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) query.status = { $in: status.split(',') };
    if (loanType) query.loan_type = { $in: loanType.split(',') };
    if (source) query.source = { $in: source.split(',') };
    if (agent) query.assigned_agent_id = { $in: agent.split(',') };
    
    // Aging filter needs calculated field or complex query - skipping for now as it's complex
    
    const total = await Lead.countDocuments(query);
    const leads = await Lead.find(query)
      .sort({ [sort]: dir === 'asc' ? 1 : -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    
    res.json({ leads, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/leads', authenticate, async (req, res) => {
  try {
    const { phone, email } = req.body;
    
    // Check for existing lead with same phone or email
    const query = { $or: [{ phone }] };
    if (email) query.$or.push({ email });
    
    const duplicate = await Lead.findOne(query);
    if (duplicate) {
      const matchField = duplicate.phone === phone ? 'phone' : 'email';
      return res.status(400).json({ message: `A lead already exists with this ${matchField}.` });
    }

    const leadData = { ...req.body };
    if (leadData.assigned_agent_id) {
      leadData.assigned_at = Date.now();
    }
    const lead = new Lead(leadData);
    await lead.save();
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/api/leads/import', authenticate, async (req, res) => {
  try {
    const { leads, confirm } = req.body;
    if (!Array.isArray(leads)) return res.status(400).json({ message: 'Invalid data format' });

    // First pass: identify duplicates
    const toImport = [];
    const duplicates = [];
    for (const leadData of leads) {
      const query = { $or: [{ phone: leadData.phone || leadData.Phone }] };
      if (leadData.email || leadData.Email) query.$or.push({ email: leadData.email || leadData.Email });
      
      const duplicate = await Lead.findOne(query);
      if (duplicate) {
        duplicates.push(leadData);
      } else {
        toImport.push(leadData);
      }
    }

    if (!confirm && duplicates.length > 0) {
      return res.json({ status: 'duplicate_found', duplicatesCount: duplicates.length, newLeadsCount: toImport.length });
    }

    const results = { imported: 0, failed: 0, errors: [] };
    for (const leadData of toImport) {
      try {
        const lead = new Lead({
          name: leadData.name || leadData.Name,
          phone: leadData.phone || leadData.Phone,
          email: leadData.email || leadData.Email,
          city: leadData.city || leadData.City,
          loan_type: leadData.loantype || leadData['loan type'] || leadData['Loan Type'] || 'personal',
          amount_requested: parseInt((leadData.amount || leadData.Amount || '0').toString().replace(/[^0-9]/g, '')) || 0,
          source: leadData.source || leadData.Source || 'website',
          status: ((leadData.status !== undefined ? leadData.status : (leadData.Status !== undefined ? leadData.Status : 'new')) || 'new').toString().toLowerCase().trim(),
          created_at: new Date(),
          updated_at: new Date()
        });
        await lead.save();
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Error saving lead ${leadData.name || leadData.Name}: ${err.message}`);
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/leads/:id', authenticate, async (req, res) => {
  try {
    const existingLead = await Lead.findById(req.params.id);
    if (!existingLead) return res.status(404).json({ message: 'Lead not found' });
    
    const { phone, email } = req.body;
    
    // Check for duplicates excluding current lead
    if (phone || email) {
      const query = { _id: { $ne: req.params.id }, $or: [] };
      if (phone) query.$or.push({ phone });
      if (email) query.$or.push({ email });
      
      if (query.$or.length > 0) {
        const duplicate = await Lead.findOne(query);
        if (duplicate) {
          const matchField = duplicate.phone === phone ? 'phone' : 'email';
          return res.status(400).json({ message: `Another lead already exists with this ${matchField}.` });
        }
      }
    }

    const updateData = { ...req.body, updated_at: Date.now() };
    if (req.body.assigned_agent_id && !existingLead.assigned_at) {
      updateData.assigned_at = Date.now();
    }
    
    const lead = await Lead.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/leads/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'agent') return res.status(403).json({ message: 'Forbidden' });
    
    // 1. Delete lead and call logs
    await Lead.findByIdAndDelete(req.params.id);
    await CallLog.deleteMany({ lead_id: req.params.id });

    // 2. Remove related allocation history
    const historySetting = await Setting.findOne({ key: 'allocation_history' });
    if (historySetting && Array.isArray(historySetting.value)) {
      historySetting.value = historySetting.value.filter(h => h.lead_id !== req.params.id);
      await historySetting.save();
    }
    
    res.json({ message: 'Lead and related history deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- CALL LOGS ---
app.post('/api/calls', authenticate, async (req, res) => {
  try {
    const call = new CallLog({ ...req.body, agent_id: req.user.id });
    await call.save();
    
    // Also update lead status and priority if provided
    const updateData = { updated_at: Date.now() };
    if (req.body.new_status) {
      updateData.status = req.body.new_status;
    }
    if (req.body.new_priority) {
      updateData.priority = req.body.new_priority;
    }
    
    if (req.body.new_status || req.body.new_priority) {
      await Lead.findByIdAndUpdate(req.body.lead_id, updateData);
    }
    
    res.status(201).json(call);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/calls/:leadId', authenticate, async (req, res) => {
  try {
    const calls = await CallLog.find({ lead_id: req.params.leadId }).sort({ created_at: -1 });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/calls', authenticate, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'tl' && req.user.team_id) {
      const agents = await User.find({ team_id: req.user.team_id }).select('_id');
      const agentIds = agents.map(a => a._id);
      agentIds.push(req.user.id);
      query = { agent_id: { $in: agentIds } };
    } else if (req.user.role === 'agent') {
      query = { agent_id: req.user.id };
    }
    const calls = await CallLog.find(query).sort({ created_at: -1 });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- TEAMS ROUTES ---
app.get('/api/teams', authenticate, async (req, res) => {
  try {
    const teams = await Team.find().populate('leader_id', 'name');
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/teams', authenticate, async (req, res) => {
  try {
    const team = new Team(req.body);
    await team.save();
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/teams/:id', authenticate, async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/teams/:id', authenticate, async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- USERS ROUTES (for assignment) ---
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/users/:id', authenticate, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.password && updateData.password.trim() !== '') {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/users/:id', authenticate, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- SETTINGS ROUTES ---
app.get('/api/settings/:key', authenticate, async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    res.json(setting ? setting.value : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/settings/:key', authenticate, async (req, res) => {
  try {
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { value: req.body.value },
      { upsert: true, new: true }
    );
    res.json(setting.value);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// --- BACKUP & RESTORE ROUTES ---
app.get('/api/backup', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    
    const { start_date, end_date } = req.query;
    let leadFilter = {};
    let callFilter = {};
    
    if (start_date || end_date) {
      leadFilter.created_at = {};
      callFilter.created_at = {};
      if (start_date) {
        leadFilter.created_at.$gte = new Date(start_date);
        callFilter.created_at.$gte = new Date(start_date);
      }
      if (end_date) {
        leadFilter.created_at.$lte = new Date(end_date);
        callFilter.created_at.$lte = new Date(end_date);
      }
    }

    const [leads, users, teams, settings, callLogs] = await Promise.all([
      Lead.find(leadFilter),
      User.find().select('-password'),
      Team.find(),
      Setting.find(),
      CallLog.find(callFilter)
    ]);

    const backupData = {
      timestamp: new Date(),
      version: '1.0',
      leads,
      users,
      teams,
      settings,
      callLogs
    };

    res.json(backupData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/restore', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    
    const { leads, users, teams, settings, callLogs } = req.body;
    
    // Restore logic: Clear and insert (or merge)
    // For safety in this CRM, we'll replace the existing data for these collections
    if (leads) { await Lead.deleteMany({}); await Lead.insertMany(leads); }
    if (users) { 
      // We don't delete current user to avoid logout, but we update or insert others
      for (const u of users) {
        await User.findByIdAndUpdate(u._id || u.id, u, { upsert: true });
      }
    }
    if (teams) { await Team.deleteMany({}); await Team.insertMany(teams); }
    if (settings) {
      for (const s of settings) {
        await Setting.findOneAndUpdate({ key: s.key }, { value: s.value }, { upsert: true });
      }
    }
    if (callLogs) { await CallLog.deleteMany({}); await CallLog.insertMany(callLogs); }

    res.json({ message: 'Data restored successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Serve Index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
