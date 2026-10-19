import mongoose from 'mongoose';

const oauthStateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['linkedin', 'gmail'], required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthState = mongoose.model('OAuthState', oauthStateSchema);
