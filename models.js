import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'tl', 'agent'], default: 'agent' },
  team_id: { type: String, default: null },
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

userSchema.index({ team_id: 1 });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  city: { type: String },
  loan_type: { type: String, required: true },
  amount_requested: { type: Number, required: true },
  source: { type: String, required: true },
  priority: { type: String, default: 'cold' },
  status: { type: String, default: 'new' },
  assigned_agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assigned_at: { type: Date },
  notes: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

leadSchema.index({ phone: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ assigned_agent_id: 1 });
leadSchema.index({ created_at: -1 });

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  leader_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now }
});

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'loan_types', 'sources'
  value: { type: mongoose.Schema.Types.Mixed, required: true }
});

const callLogSchema = new mongoose.Schema({
  lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  outcome: { type: String, required: true },
  notes: { type: String },
  follow_up_at: { type: Date },
  created_at: { type: Date, default: Date.now }
});

callLogSchema.index({ lead_id: 1 });
callLogSchema.index({ agent_id: 1 });
callLogSchema.index({ created_at: -1 });

export const User = mongoose.model('User', userSchema);
export const Lead = mongoose.model('Lead', leadSchema);
export const Team = mongoose.model('Team', teamSchema);
export const Setting = mongoose.model('Setting', settingSchema);
export const CallLog = mongoose.model('CallLog', callLogSchema);
