import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active' },
    preferences: {
      dailyGenerationEnabled: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      /** If true, 10 AM / 2 PM posts skip approval (default: approval email first). */
      autoPublishScheduledPosts: { type: Boolean, default: false },
      scheduledPostTimes: {
        type: [
          {
            hour: { type: Number, min: 0, max: 23, required: true },
            minute: { type: Number, min: 0, max: 59, required: true },
          },
        ],
        default: () => [
          { hour: 10, minute: 0 },
          { hour: 14, minute: 0 },
        ],
      },
      contentType: { type: String, default: 'javascript' },
      contentBrief: { type: String, default: '' },
      defaultTopics: {
        type: [String],
        default: [
          'JavaScript performance optimization',
          'Modern JavaScript patterns and ES features',
          'React hooks and component design',
          'Node.js backend scalability',
          'TypeScript for large codebases',
          'Web APIs and REST design',
          'Database indexing and query optimization',
          'System design for developers',
          'Clean code and refactoring in JavaScript',
          'Async JavaScript: promises, event loop, workers',
          'CSS layout and responsive UI',
          'DevOps and CI/CD for web teams',
          'Security essentials for web developers',
          'Debugging and profiling JavaScript apps',
        ],
      },
    },
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.verifyPassword = async function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
